/* CLCPA-320 round 3: what the WORKBOOK actually emits, fresh against
 * populated, read out of the generated .xlsx rather than asked of an
 * accessor.
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
const OUT = path.join(__dirname, 'probe-320-r3-output.txt');

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

log('CLCPA-320 round 3: the populated-year workbook marker');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ---------------------------------------------------------------- 1, 2, 3 */
function scenario(label, mutate, tableId, year, rowLabel) {
  log('  ' + label);
  [['BASE ' + BASE, BASE_SRC], ['now       ', SRC]].forEach(([tag, src]) => {
    const P = basePayload();
    mutate(P);
    let row = null, err = null;
    try { row = rowNamed(workbookRows(src, P, tableId, year), rowLabel); }
    catch (e) { err = e && e.message; }
    log('      ' + tag + '  ' +
      (err ? 'THREW: ' + err : JSON.stringify((row || []).slice(0, 4))));
  });
}

/* G3: a POPULATED year whose total row has not been filled in, against a
 * FRESH year that borrows its structure */
scenario('G3 POPULATED 2098, County Total (data rows filled, total empty)',
  (P) => {
    P.tables.G3.data['2098'] = [
      ['Feet Abandoned within DAC', 3276, null],
      ['Feet Abandoned not in a DAC', 0, null],
      ['County Total', null, null],
    ];
  }, 'G3', '2098', 'County Total');
scenario('G3 FRESH 2094, County Total (the year holds nothing)',
  (P) => { P.tables.G3.data['2094'] = []; }, 'G3', '2094', 'County Total');

log('');
scenario('J8 POPULATED 2098, Total (a B7 registry member: fill-in)',
  (P) => {
    const y = Object.keys(P.tables.J8.data).sort().pop();
    P.tables.J8.data['2098'] = (P.tables.J8.data[y] || []).map(r =>
      r.map((v, i) => (i === 0 ? v : null)));
  }, 'J8', '2098', 'Total');
scenario('J8 FRESH 2094, Total',
  (P) => { P.tables.J8.data['2094'] = []; }, 'J8', '2094', 'Total');

log('');
scenario('A3 FRESH 2094, Total (the control that must not move)',
  (P) => { P.tables.A3.data['2094'] = []; }, 'A3', '2094', 'Total');

/* ------------------------------------------------------- 4, the cost */
log('');
log('  THE CLCPA-320 AMENDMENT COST, re-measured on this emission path.');
log('  The amendment withheld the marker from A3/2023, A3/2024 and A4/2023,');
log('  which is what made A3 year-dependent again. Those are STORED years,');
log('  so this reads their workbooks as they are, with no mutation.');
[['A3', '2023'], ['A3', '2024'], ['A3', '2025'], ['A4', '2023'], ['A4', '2024'],
 ['A4', '2025']].forEach(([id, y]) => {
  const out = [];
  [['BASE', BASE_SRC], ['now', SRC]].forEach(([tag, src]) => {
    const P = basePayload();
    let row = null;
    try { row = rowNamed(workbookRows(src, P, id, y), 'Total'); }
    catch (e) { row = ['THREW: ' + (e && e.message)]; }
    out.push(tag + ' ' + JSON.stringify((row || []).slice(1, 5)));
  });
  log('      ' + id + '/' + y + '  ' + out.join('   '));
});

fs.writeFileSync(OUT, lines.join('\n') + '\n');
