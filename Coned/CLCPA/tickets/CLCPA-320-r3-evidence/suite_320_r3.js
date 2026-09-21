/* CLCPA-320 round 3: the populated-year workbook marker.
 *
 * THE DEFECT, reproduced on the real emission path: G3s POPULATED 2098
 * downloaded County Total as (no value) while the FRESH 2094 downloaded
 * (calculated), for the same cell. With CLCPA-319 shipped the app computes
 * that cell, so (no value) is a false statement about it.
 *
 * THE CAUSE. ingestIsHeaderRow says a row with a label and no values is a
 * GROUP HEADER, and a group header emits (no value) before any marker
 * branch runs. That is right for a caption and wrong for a total nobody has
 * filled in yet, which is what a populated years total row is before the
 * operator reaches it.
 *
 * THE FIX. A row whose LABEL is a total is never a caption: the same signal
 * CLCPA-319s own rule uses, and one no edit can move. Restricting it to the
 * label matters, because a group header in a table with a derived column
 * would otherwise look derivable and lose its marker, which is A5 to A8.
 *
 * READ FROM THE WORKBOOK, not from an accessor: marksInTemplate already
 * answered the same for both anatomies, so only the generated .xlsx could
 * show the difference.
 *
 * WHY THE REAL EMISSION PATH. marksInTemplate is only one of the branches
 * that decides a template cell, and on this payload it already answers the
 * same for both anatomies. The reported difference is between the two
 * WORKBOOKS, so the workbooks are what this reads: built by the shipped
 * buildIngestWorkbook, unzipped, and parsed cell by cell.
 *
 * The four checks the ruling sets:
 *   1  the G3 pair reads (calculated) / (calculated) on BOTH
 *   2  the J8 pair stays fill-in on BOTH
 *   3  A3's fresh control is unchanged
 *   4  the CLCPA-320 amendment's declared cost, the A3 and A4 stored-year
 *      rows, re-measured under this direction on the same emission path
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-320-r3-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || '8bf5ea7';
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

/* the payload is MUTATED per scenario, so each build gets its own copy */
const basePayload = () => JSON.parse(
  fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

function harness(src, P, want) {
  const L = src.split('\r\n');
  const TOP = [];
  L.forEach((ln, n) => {
    const m = /^ {2}(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (nm) => {
    const k = TOP.findIndex(d => d.name === nm);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n');
  };
  const parts = [], have = new Set();
  const add = (n) => {
    if (have.has(n)) return false;
    const f = find(n);
    if (!f) return false;
    have.add(n); parts.push(f); return true;
  };
  want.forEach(add);
  let api = null;
  const attempt = (call) => {
    for (let r = 0; r < 500; r++) {
      try {
        if (!api) {
          api = new Function('PAYLOAD', 'TextEncoder',
            '"use strict";\nconst console = { warn(){}, info(){}, log(){}, error(){} };\n' +
            'const state = { payload: PAYLOAD,\n' +
            '  seedYears: ((PAYLOAD.meta && PAYLOAD.meta.years) || []).map(String) };\n' +
            parts.join('\n\n') +
            '\n;return {' + want.filter(n => have.has(n)).join(',') + '};')(P, TextEncoder);
        }
        return call(api);
      } catch (e) {
        const m = /(\w+) is not defined/.exec(String(e && e.message));
        if (m && add(m[1])) { api = null; continue; }
        throw e;
      }
    }
    throw new Error('assembly did not converge');
  };
  return { attempt };
}

const WANT = ['buildIngestWorkbook', 'crc32', 'getTableSchema', 'ingestComputed',
  'ingestTemplateSource', 'ingestMarkerSource', 'ingestTextOnlyColumn',
  'isB7PreparerTotal', 'isAnchoredTotalRowLabel'];

/* STORED entries, so the archive reads back without an inflate. Lifted from
 * suite_85_xlsx, which has read these workbooks since round 4. */
function unzipStored(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eo = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; }
  }
  if (eo < 0) throw new Error('no EOCD');
  const total = dv.getUint16(eo + 10, true);
  const cdOffset = dv.getUint32(eo + 16, true);
  const out = {};
  let p = cdOffset;
  for (let k = 0; k < total; k++) {
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nlen));
    const lnlen = dv.getUint16(lho + 26, true);
    const lelen = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lnlen + lelen;
    out[name] = new TextDecoder().decode(bytes.subarray(start, start + csize));
    p += 46 + nlen + elen + clen;
  }
  return out;
}

/* the TABLE sheet's rows, as arrays of cell text. A cell with no text is
 * emitted as a self-closing <c/>, which is the "fill-in" a preparer types
 * into, so it reads back as an empty string rather than being skipped. */
function sheetRows(xml) {
  const rows = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let m;
  while ((m = rowRe.exec(xml))) {
    const cells = [];
    const cellRe = /<c\b[^>]*?(\/>|>([\s\S]*?)<\/c>)/g;
    let c;
    while ((c = cellRe.exec(m[1]))) {
      if (c[1] === '/>') { cells.push(''); continue; }
      const inner = c[2] || '';
      const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner);
      if (t) { cells.push(t[1]); continue; }
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
      cells.push(v ? v[1] : '');
    }
    rows.push(cells);
  }
  return rows;
}

function workbookRows(src, P, tableId, year) {
  const H = harness(src, P, WANT);
  const wb = H.attempt(api => api.buildIngestWorkbook(tableId, year));
  if (!wb || !wb.bytes) return null;
  const bytes = wb.bytes instanceof Uint8Array ? wb.bytes : new Uint8Array(wb.bytes);
  const files = unzipStored(bytes);
  /* sheet2 is the table; sheet1 carries the instructions */
  const name = Object.keys(files).filter(n => /worksheets\/sheet2\.xml$/.test(n))[0] ||
    Object.keys(files).filter(n => /worksheets\/sheet\d\.xml$/.test(n)).pop();
  return sheetRows(files[name]);
}

const rowNamed = (rows, label) =>
  (rows || []).filter(r => String(r[0] || '').trim().toLowerCase() ===
    String(label).trim().toLowerCase())[0] || null;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => {
  try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); }
};
const rowOn = (src, mutate, tableId, year, rowLabel) => {
  const P = basePayload();
  if (mutate) mutate(P);
  return rowNamed(workbookRows(src, P, tableId, year), rowLabel);
};

log('CLCPA-320 round 3: the populated-year workbook marker');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

const G3POP = (P) => {
  P.tables.G3.data['2098'] = [
    ['Feet Abandoned within DAC', 3276, null],
    ['Feet Abandoned not in a DAC', 0, null],
    ['County Total', null, null],
  ];
};
const G3FRESH = (P) => { P.tables.G3.data['2094'] = []; };
const J8POP = (P) => {
  const y = Object.keys(P.tables.J8.data).sort().pop();
  P.tables.J8.data['2098'] = (P.tables.J8.data[y] || []).map(r =>
    r.map((v, i) => (i === 0 ? v : null)));
};
const J8FRESH = (P) => { P.tables.J8.data['2094'] = []; };

log('A. THE G3 PAIR READS THE SAME ON BOTH YEARS');
guard('A-block', () => {
  const pop = rowOn(SRC, G3POP, 'G3', '2098', 'County Total');
  const fresh = rowOn(SRC, G3FRESH, 'G3', '2094', 'County Total');
  log('    populated ' + JSON.stringify(pop));
  log('    fresh     ' + JSON.stringify(fresh));
  ok(JSON.stringify(pop) === JSON.stringify(fresh),
     'A1 the two workbooks agree cell for cell');
  ok(pop && pop[1] === '(calculated)' && pop[2] === '(calculated)',
     'A2 and both figure columns read (calculated), because the app does ' +
     'compute them: ' + JSON.stringify((pop || []).slice(1, 3)));
  const wasPop = rowOn(BASE_SRC, G3POP, 'G3', '2098', 'County Total');
  const wasFresh = rowOn(BASE_SRC, G3FRESH, 'G3', '2094', 'County Total');
  log('    ' + BASE + ' populated ' + JSON.stringify(wasPop));
  ok(JSON.stringify(wasPop) !== JSON.stringify(wasFresh),
     'A3 while on ' + BASE + ' the two DISAGREE, which is the ticket');
  ok(wasPop && wasPop[1] === '(no value)',
     'A4 the populated one saying (no value) about a cell the app computes: ' +
     JSON.stringify((wasPop || []).slice(1, 3)));
});

log('');
log('B. THE J8 PAIR STAYS FILL-IN ON BOTH');
guard('B-block', () => {
  const pop = rowOn(SRC, J8POP, 'J8', '2098', 'Total');
  const fresh = rowOn(SRC, J8FRESH, 'J8', '2094', 'Total');
  log('    populated ' + JSON.stringify(pop));
  log('    fresh     ' + JSON.stringify(fresh));
  ok(JSON.stringify(pop) === JSON.stringify(fresh),
     'B1 the two workbooks agree cell for cell');
  ok(pop && pop.slice(1).every(v => v === ''),
     'B2 and every figure column is FILL-IN, carrying no marker at all, ' +
     'because J8s Total is a B7 registry member and belongs to the ' +
     'preparer: ' + JSON.stringify((pop || []).slice(1)));
  const wasPop = rowOn(BASE_SRC, J8POP, 'J8', '2098', 'Total');
  ok(wasPop && wasPop[1] === '(no value)',
     'B3 while on ' + BASE + ' the populated year said (no value), telling ' +
     'the preparer not to fill in the one cell that is theirs: ' +
     JSON.stringify((wasPop || []).slice(1)));
});

log('');
log('C. A3s FRESH CONTROL DOES NOT MOVE');
guard('C-block', () => {
  const m = (P) => { P.tables.A3.data['2094'] = []; };
  const now = rowOn(SRC, m, 'A3', '2094', 'Total');
  const was = rowOn(BASE_SRC, m, 'A3', '2094', 'Total');
  log('    ' + BASE + ' ' + JSON.stringify(was));
  log('    now       ' + JSON.stringify(now));
  ok(JSON.stringify(now) === JSON.stringify(was),
     'C1 A3s fresh template is byte-identical to ' + BASE);
});

log('');
log('D. THE CLCPA-320 AMENDMENT COST, RE-MEASURED ON THIS PATH');
guard('D-block', () => {
  const rows = [['A3', '2023'], ['A3', '2024'], ['A3', '2025'],
                ['A4', '2023'], ['A4', '2024'], ['A4', '2025']];
  const before = {}, after = {};
  rows.forEach(([id, y]) => {
    before[id + '/' + y] = rowOn(BASE_SRC, null, id, y, 'Total');
    after[id + '/' + y] = rowOn(SRC, null, id, y, 'Total');
    log('    ' + id + '/' + y + '  ' + BASE + ' ' +
        JSON.stringify((before[id + '/' + y] || []).slice(1, 5)) +
        '   now ' + JSON.stringify((after[id + '/' + y] || []).slice(1, 5)));
  });
  ['A3/2023', 'A3/2024', 'A4/2023'].forEach((k) => {
    const b = before[k] || [], a = after[k] || [];
    ok(b[1] === '' && a[1] === '(no value)',
       'D1 ' + k + ': the label column regains its marker, blank to (no value)');
    ok(a[3] === '(calculated)' && a[4] === '(calculated)',
       'D2 ' + k + ': and the two average columns read (calculated) again');
  });
  const shape = (r) => JSON.stringify([(r || [])[1], (r || [])[3], (r || [])[4]]);
  ok(shape(after['A3/2023']) === shape(after['A3/2025']) &&
     shape(after['A3/2024']) === shape(after['A3/2025']),
     'D3 so A3s three stored years now carry the SAME marker shape, and the ' +
     'table stops being year-dependent: ' + shape(after['A3/2025']));
  ok(shape(before['A3/2023']) !== shape(before['A3/2025']),
     'D4 while on ' + BASE + ' they differ, which is the cost the amendment ' +
     'declared');
});

log('');
log('E. AND A REAL GROUP HEADER KEEPS ITS CAPTION MARKER');
guard('E-block', () => {
  /* THE CONTROL THE RULING'S OWN ONE CANNOT BE. A3's fresh template has no
   * group headers, so it cannot see a change to the group-header branch:
   * two mutations that strip the caption marker from every table left C1
   * green. A5 and A8 DO have them, and they are what the branch exists for.
   * A caption that loses (no value) becomes indistinguishable from a data
   * row in the downloaded file, and the importer can no longer tell which
   * group a row belongs to. */
  const fresh = (id) => (P) => { P.tables[id].data['2094'] = []; };
  [['A8', 'Clean Heat – Midstream Heat Pump Water Heater'],
   ['A5', null]].forEach(([id, label]) => {
    const rows = workbookRows(SRC, (() => {
      const P = basePayload(); fresh(id)(P); return P;
    })(), id, '2094');
    /* the caption rows are the ones with a label and no figures at all */
    const caps = (rows || []).slice(1).filter(r =>
      String(r[0] || '').trim() !== '' &&
      r.slice(1).every(v => v === '(no value)'));
    ok(caps.length > 0,
       'E1 ' + id + ' still emits group-header captions marked (no value): ' +
       caps.length + (caps[0] ? '  e.g. ' + JSON.stringify(caps[0]) : ''));
    if (label) {
      const named = (rows || []).filter(r =>
        String(r[0] || '').trim() === label)[0];
      ok(named && named.slice(1).every(v => v === '(no value)'),
         'E2 including ' + JSON.stringify(label.slice(0, 30)) + ': ' +
         JSON.stringify((named || []).slice(1)));
    }
  });
});

log('');
log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
if (fail) process.exit(1);
