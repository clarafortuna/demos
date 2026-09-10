/* CLCPA-240 first half -- the hierarchical / composite-key matcher.
 *
 * THE ACCEPTANCE BAR, Emely's words: import A5's own downloaded template into
 * an empty 2099, everything lands, totals compute, Save, report correct. That
 * is guard R below and it is the reason this suite drives the REAL workbook
 * generator, unzips the REAL xlsx it produces, and feeds the cells it actually
 * wrote back into the REAL importer. Nothing about the template is retyped
 * here: a fixture typed into the suite would prove only that the suite agrees
 * with itself, which is the defect that let five earlier pins read nothing.
 *
 * TWO SOURCES, BOTH PINNED. BASE is the commit before this change, so every
 * behavioural claim is stated as a difference rather than as a snapshot of the
 * build that just shipped. New-vs-new equivalence is blind to regressions.
 *
 * WHAT IS DELIBERATELY NOT ASSERTED: nothing here checks the browser wiring of
 * the Report Data page. The functions are assembled with their real dependency
 * lists and called, which is what catches a missing closure, but the DOM path
 * from the Import button to buildIngestImport is out of this suite's reach and
 * stays Emely's hosted pass.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-240-evidence/suite-240a-output.txt');

/* BASE predates the change. Pinned to a commit, never HEAD: a suite whose
 * baseline moves with the tree stops being a baseline. */
const BASE = process.env.DAC_BASE_COMMIT || '899fd8a698';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);

const SRC = fs.readFileSync(APP, 'utf8');
/* git blobs are LF, the working tree is CRLF. Without this the CRLF-anchored
 * extractors below return -1 and silently slice from the end of the file. */
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const PAYLOAD = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
/* A throw inside one block must become a NAMED failure, not a stack trace that
 * discards every other block's result. */
function guard(label, fn) {
  try { fn(); } catch (e) {
    fail++; lines.push('  FAIL ' + label + ' THREW: ' + (e && e.message));
  }
}

/* ---------- extraction, with every slice bound asserted ------------------ */
function grabFn(name, src) {
  for (const pad of ['  ', '    ', '']) for (const kw of ['function ', 'async function ']) {
    const head = '\r\n' + pad + kw + name + '(';
    const i = src.indexOf(head);
    if (i < 0) continue;
    const close = '\r\n' + pad + '}';
    const j = src.indexOf(close, i + head.length);
    if (j <= i) continue;                      // bound asserted, never slice(i, -1)
    return src.slice(i + 2, j + close.length);
  }
  return null;
}
/* A declaration ends at the first `;` that sits at bracket depth zero, string
 * and comment aware. The dedent heuristic this replaces swallowed whatever
 * declaration came next, which showed up as "XLSX_TEXT2 has already been
 * declared" rather than as a wrong answer -- the lucky kind of bug. */
function grabConst(name, src) {
  const m = src.match(new RegExp('\\r\\n  (?:const|var|let) ' + name + '\\s*='));
  if (!m) return null;
  const start = src.indexOf(m[0]) + 2;
  let d = 0, q = null, i = start;
  for (; i < src.length; i++) {
    const c = src[i], p = src[i - 1];
    if (q) {
      if (c === q && p !== '\\') q = null;
      else if (q === '`' && c === '$' && src[i + 1] === '{') d++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i); if (e < 0) return null; i = e + 1; continue; }
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\r\n', i); if (e < 0) return null; i = e; continue; }
    if (c === '(' || c === '{' || c === '[') d++;
    else if (c === ')' || c === '}' || c === ']') d--;
    else if (c === ';' && d === 0) return src.slice(start, i + 1);
  }
  return null;
}
/* Comment prose that quotes code satisfies a search for that code. Eight pins
 * in this repo have been fooled that way, so every structural search below
 * runs on this. */
function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');
}

/* ---------- one assembled environment per source ------------------------- */
const ENTRY = ['buildIngestWorkbook', 'buildIngestImport', 'totalRowFlags',
  'recomputeTotals', 'getTableSchema', 'getTableBody', 'ingestComputed',
  'ingestTemplateSource', 'normIngestKey', 'crc32', 'xlsxCol'];
/* Exist only in the changed source, so they are exported behind a typeof guard
 * and BASE simply reports null for them. Seeded explicitly rather than resolved
 * on demand: a name reached only through `typeof` never raises a
 * ReferenceError, so the resolver would never think to grab it. */
const OPTIONAL = ['ingestRowKey', 'ingestIsHeaderRow', 'ingestGroupOf',
  'ingestKeyColCount', 'ingestIsBlankCell'];

function buildEnv(src, tag) {
  const fns = ENTRY.concat(OPTIONAL.filter(n => grabFn(n, src)));
  const consts = [];
  let api = null;
  for (let iter = 0; iter < 500; iter++) {
    const extraFns = fns.filter(n => n !== null);
    const body = '"use strict";\n' +
      'const state = { payload: PAYLOAD };\n' +
      'const console = { warn: () => {}, info: () => {}, log: () => {}, error: () => {} };\n' +
      'const document = { getElementById: () => null, querySelectorAll: () => [],' +
      ' querySelector: () => null, createElement: () => ({ style: {}, appendChild: () => {} }) };\n' +
      'const window = { location: { href: "" } };\n' +
      'const localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };\n' +
      consts.map(n => grabConst(n, src)).join('\n') + '\n' +
      extraFns.map(n => grabFn(n, src)).join('\n') + '\n' +
      'return {' + ENTRY.join(', ') + ', ' +
      OPTIONAL.map(n => n + ': (typeof ' + n + ' === "function" ? ' + n + ' : null)').join(', ') +
      ', __fns: ' + JSON.stringify(extraFns) +
      ', __consts: ' + JSON.stringify(consts) + '};';
    let candidate;
    try {
      candidate = new Function('PAYLOAD', 'TextEncoder', 'TextDecoder', body)(
        PAYLOAD, TextEncoder, TextDecoder);
    } catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) throw new Error(tag + ' shell: ' + e.message);
      if (grabFn(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm, src) && consts.indexOf(nm) < 0) { consts.push(nm); continue; }
      throw new Error(tag + ' cannot resolve ' + nm);
    }
    /* Constructing proves the const initialisers resolve. Only CALLING proves
     * the function bodies do -- a name borrowed from another function passes
     * every source-level pin and throws on the first real render. */
    try {
      candidate.totalRowFlags(PAYLOAD.tables.A5.data['2025'], 'A5',
        PAYLOAD.tables.A5.schema_by_year['2025']);
      candidate.buildIngestWorkbook('A5', '2099');
      candidate.buildIngestImport(
        [PAYLOAD.tables.A5.schema_by_year['2025'], ['HVAC', 1, 1, null]],
        PAYLOAD.tables.A5.schema_by_year['2025'], [], 'A5');
      const d = PAYLOAD.tables.A5.data['2025'].map(r => r.slice());
      candidate.recomputeTotals(d, PAYLOAD.tables.A5.schema_by_year['2025'], 'A5', null);
      api = candidate;
      break;
    } catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) throw new Error(tag + ' call: ' + e.message);
      if (grabFn(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm, src) && consts.indexOf(nm) < 0) { consts.push(nm); continue; }
      throw new Error(tag + ' cannot resolve ' + nm + ' (call time)');
    }
  }
  if (!api) throw new Error(tag + ': no convergence');
  return api;
}

let NEW = null, OLD = null;
guard('the CHANGED source assembles and every entry point RUNS', () => {
  NEW = buildEnv(SRC, 'NEW');
  ok(!!NEW, 'NEW assembles, resolving ' + NEW.__fns.length + ' functions and ' +
    NEW.__consts.length + ' declarations by following ReferenceErrors');
});
guard('the BASE source assembles and every entry point RUNS', () => {
  OLD = buildEnv(BASE_SRC, 'BASE');
  ok(!!OLD, 'BASE (' + BASE + ') assembles, resolving ' + OLD.__fns.length +
    ' functions and ' + OLD.__consts.length + ' declarations');
});
if (!NEW || !OLD) {
  lines.forEach(l => console.log(l));
  console.log('\n  ' + pass + ' passed, ' + fail + ' failed  (assembly failed, nothing else ran)');
  process.exit(1);
}

/* ---------- xlsx readers (lifted from suite_85_xlsx, a proven harness) ---- */
function unzipStored(bytes, api) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eo = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; }
  }
  if (eo < 0) throw new Error('no EOCD');
  const total = dv.getUint16(eo + 10, true);
  const out = {};
  let p = dv.getUint32(eo + 16, true);
  for (let k = 0; k < total; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('bad CD signature');
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
function readCells(xml) {
  const out = {};
  const re = /<c r="([A-Z]+)(\d+)" s="(\d+)"(?:\s*\/>|[^>]*>([\s\S]*?)<\/c>)/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const t = m[4] ? (m[4].match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] : null;
    out[m[1] + m[2]] = {
      style: parseInt(m[3], 10),
      text: t == null ? null : t.replace(/&amp;/g, '&').replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
    };
  }
  return out;
}
/* The rows the template ACTUALLY wrote, read out of the workbook it produced. */
function templateRows(api, tableId, year) {
  const wb = api.buildIngestWorkbook(tableId, year);
  if (!wb || !wb.bytes) throw new Error('no workbook for ' + tableId + ':' + year);
  const parts = unzipStored(wb.bytes, api);
  const cells = readCells(parts['xl/worksheets/sheet2.xml']);
  const schema = api.getTableSchema(PAYLOAD.tables[tableId], year);
  const rows = [];
  for (let r = 1; ; r++) {
    const row = [];
    let any = false;
    for (let c = 1; c <= schema.length; c++) {
      const cell = cells[api.xlsxCol(c) + r];
      row.push(cell ? cell.text : null);
      if (cell && cell.text != null && String(cell.text) !== '') any = true;
    }
    if (!any) break;
    rows.push(row);
  }
  return { rows: rows, schema: schema };
}
/* The operator's half: type the numbers you have into the cells the template
 * left blank, and leave every "(calculated)" alone. Values come from the
 * STORED payload, so nothing about the expected result is typed here either. */
function fillLikeOperator(tplRows, stored) {
  return tplRows.map((row, i) => {
    if (i === 0) return row.slice();          // the heading row
    const src = stored[i - 1] || [];
    return row.map((cell, c) => {
      if (c === 0) return cell;
      if (cell != null && String(cell).trim() !== '') return cell;   // marker: leave it
      const v = src[c];
      return (v == null || v === '') ? null : v;
    });
  });
}

const isEmptyV = v => v === null || v === undefined || String(v).trim() === '';
const isHdrRow = r => Array.isArray(r) && r.length > 1 && !isEmptyV(r[0]) &&
  r.slice(1).every(isEmptyV);
const hasNumV = r => Array.isArray(r) && r.slice(1).some(
  v => typeof v === 'number' && isFinite(v));
const totalish = l => /total/i.test(String(l == null ? '' : l));
const strictish = l => /^(grand\s+|sub)?totals?$/i.test(String(l == null ? '' : l).trim());

/* ================= S: the declarations are what was measured ============== */
guard('S: the three declarations', () => {
  const code = codeOnly(SRC);
  ok(/const INGEST_KEY_COLS = \{ A3: 2, A4: 2 \};/.test(code),
     'S1 INGEST_KEY_COLS declares exactly A3:2 and A4:2');
  ok(/const INGEST_GROUPED = \{ A5: true, A6: true, A8: true \};/.test(code),
     'S2 INGEST_GROUPED declares exactly A5, A6, A8 (A7 excluded on purpose)');
  /* ROUND 2 MOVED THIS, and the reversal is the point.
   *
   * In round 1 the hierarchical table set lived INSIDE totalRowFlags, because
   * it had exactly one consumer and a module-level constant is a dependency of
   * every harness that assembles that function -- ten of them here. Round 2
   * gave it a second consumer, renderIngestEditor, and two copies of a table
   * set is a second source of truth. So it moved back out, and the harnesses
   * took the dependency. Asserted as ONE definition, at module scope. */
  const tfCode = codeOnly(grabFn('totalRowFlags', SRC) || '');
  ok(/\r\n  const HIERARCHICAL_TABLES = \{ A5: true, A6: true, A7: true, A8: true \};/.test(code),
     'S3 HIERARCHICAL_TABLES declares exactly A5, A6, A7, A8, at module scope');
  ok((code.split('const HIERARCHICAL_TABLES').length - 1) === 1,
     'S3b exactly ONE definition of it: ' +
     (code.split('const HIERARCHICAL_TABLES').length - 1));
  ok(!/HIERARCHICAL_TOTALS/.test(code),
     'S3c and the round-1 name is gone, not left beside it');
  ok(/HIERARCHICAL_TABLES\[/.test(tfCode),
     'S3d totalRowFlags reads the shared declaration rather than its own copy');
  ok(/HIERARCHICAL_TABLES\[/.test(codeOnly(grabFn('renderIngestEditor', SRC) || '')),
     'S3e and so does renderIngestEditor, which is why it moved');
  ok(!/const INGEST_GROUPED = \{[^}]*A7/.test(code),
     'S4 A7 is NOT grouped, so its key is unchanged');
  // the scope is a declaration, not a run-time structural test
  const tf = grabFn('totalRowFlags', SRC) || '';
  ok(/HIERARCHICAL_TABLES\[tableId\]/.test(codeOnly(tf)),
     'S5 the hierarchical branch is gated on the DECLARATION');
  ok(!/starts\.length[^\r\n]*\r?\n?[^\r\n]*\/total\/i/.test(codeOnly(tf)),
     'S6 it is NOT gated on a run-time count of header rows');
  ok(codeOnly(SRC).split("'(calculated)'").length - 1 === 1,
     'S7 the calculated marker is one constant, not two literals: ' +
     (codeOnly(SRC).split("'(calculated)'").length - 1) + ' literal(s)');
});

/* ================= R: THE ACCEPTANCE BAR ================================== */
let a5 = null;
guard('R: A5 own template -> empty 2099', () => {
  const stored = PAYLOAD.tables.A5.data['2025'];
  const tpl = templateRows(NEW, 'A5', '2099');
  ok(tpl.rows.length === stored.length + 1,
     'R1 the template writes a heading row and all ' + stored.length +
     ' labels: ' + tpl.rows.length + ' rows');

  const hdrIdx = stored.map((r, i) => i).filter(i => isHdrRow(stored[i]));
  /* ROUND 2: a group header's cells are no longer merely blank -- blank told
   * the operator nothing, so they now SAY (no value). What must still hold is
   * that they carry no (calculated), because that is what would make the row
   * read as a total instead of a header. */
  const hdrNoCalc = hdrIdx.filter(i => tpl.rows[i + 1].slice(1)
    .every(c => String(c).trim() !== '(calculated)'));
  ok(hdrNoCalc.length === hdrIdx.length,
     'R2 all ' + hdrIdx.length + ' group headers carry NO "(calculated)": ' +
     hdrNoCalc.length);
  const hdrMarked = hdrIdx.filter(i => tpl.rows[i + 1].slice(1)
    .every(c => String(c).trim() === '(no value)'));
  ok(hdrMarked.length === hdrIdx.length,
     'R2b and every one of them is marked "(no value)" in every value ' +
     'column, so nothing is left silently typeable: ' + hdrMarked.length);

  const file = fillLikeOperator(tpl.rows, stored);
  const res = NEW.buildIngestImport(file, tpl.schema, [], 'A5');
  ok(res.rejections.length === 0,
     'R3 the importer ACCEPTS the file the template wrote' +
     (res.rejections.length ? ': ' + res.rejections[0].why : ''));
  if (!res.ok) { ok(false, 'R4 import did not complete'); return; }
  ok(res.candidate.length === stored.length,
     'R4 every row landed, none duplicated: ' + res.candidate.length +
     ' of ' + stored.length);
  ok(res.addedRows.length === stored.length,
     'R5 all ' + stored.length + ' rows were created in a year that had none: ' +
     res.addedRows.length);

  NEW.recomputeTotals(res.candidate, tpl.schema, 'A5', null);
  a5 = res.candidate;

  const totIdx = stored.map((r, i) => i).filter(i => totalish(stored[i][0]));
  const filled = totIdx.filter(i => hasNumV(res.candidate[i]));
  ok(filled.length === totIdx.length,
     'R6 all ' + totIdx.length + ' group and grand totals COMPUTED: ' +
     filled.length + ' hold numbers');

  /* THE COMPARISON GOES THROUGH THE SAME ENGINE ON BOTH SIDES.
   *
   * My first version of this compared the imported table against the STORED
   * cells and failed on 34 of them: stored A5:2025 holds "% in DACs" rounded
   * to 0.37 where the derive engine computes 0.3684210526315789. That is the
   * rounded-stored-copy condition CLCPA-141 through -143 and CLCPA-238 were
   * filed about, it predates this ticket, and asserting the ROUNDED value
   * would have demanded the importer reproduce a number the dashboard itself
   * does not show. So the expected table is the stored data put through
   * recomputeTotals -- what the dashboard actually renders -- and the two
   * sides are then like for like. */
  const want = stored.map(r => r.slice());
  NEW.recomputeTotals(want, tpl.schema, 'A5', null);
  const moved = [];
  stored.forEach((row, i) => row.forEach((v, c) => {
    if (String(v) !== String(want[i][c])) moved.push('r' + i + 'c' + c);
  }));
  let diff = [];
  want.forEach((row, i) => {
    row.forEach((v, c) => {
      const got = res.candidate[i][c];
      const same = (isEmptyV(v) && isEmptyV(got)) ||
        (typeof v === 'number' && typeof got === 'number' && Math.abs(v - got) < 1e-9) ||
        String(v) === String(got);
      if (!same) diff.push('r' + i + 'c' + c + ' want ' + JSON.stringify(v) +
        ' got ' + JSON.stringify(got));
    });
  });
  /* ONE CELL DIFFERS, AND IT IS THE PAYLOAD THAT IS OUT, NOT THE IMPORT.
   *
   * A5:2025 row 49 "Commercial Total" stores 27,833 in Total Installations.
   * Its own nine segment totals sum to 27,834, and so do its 31 data rows;
   * column 2 agrees exactly, so the gap is one unit in one column. On stored
   * data arithmetic therefore does NOT confirm row 49 as a total and it keeps
   * the stored 27,833 -- which is why P1 shows no existing year changing. A
   * freshly imported year has no stored value to keep, so it computes 27,834,
   * the sum of its parts.
   *
   * DISCLOSED, NOT FIXED: payload.json is frozen, and correcting a value in it
   * is a data change with its own ticket and its own GO. Pinned as an EXPECTED
   * difference with the arithmetic written down, so that if the payload is ever
   * corrected this goes red and gets revisited rather than silently passing. */
  const EXPECTED_DIFF = 'r49c1 want 27833 got 27834';
  ok(diff.length === 1 && diff[0] === EXPECTED_DIFF,
     'R7 the round trip reproduces what the dashboard computes for A5:2025 in ' +
     (stored.length * stored[0].length - 1) + ' of ' +
     stored.length * stored[0].length + ' cells, differing only where the ' +
     'payload stores a grand total 1 short of its own parts' +
     (diff.length !== 1 || diff[0] !== EXPECTED_DIFF
       ? ' -- got ' + diff.length + ': ' + diff.slice(0, 4).join(' | ') : ''));
  ok(want[49][1] === 27833 && res.candidate[49][1] === 27834,
     'R7a the discrepancy is stated as numbers: stored keeps 27833, a fresh ' +
     'import computes 27834 (the sum of the nine segment totals)');
  ok(moved.length > 0,
     'R7b stated for the record: the engine itself moves ' + moved.length +
     ' stored cells (rounded stored percentages), which is why the comparison ' +
     'is engine-to-engine and not against the payload text');
  /* An empty STRING and a null are both empty. Comparing them with String()
   * made every group header read as a difference -- my comparator, not the
   * code, and it is left recorded because a suite that hides its own false
   * starts teaches nothing. */
  const eq = (a, b) => (isEmptyV(a) && isEmptyV(b)) ||
    (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9) ||
    String(a) === String(b);
  const nonDerived = [];
  stored.forEach((row, i) => row.forEach((v, c) => {
    if (eq(v, want[i][c]) && !eq(v, res.candidate[i][c])) {
      nonDerived.push('r' + i + 'c' + c);
    }
  }));
  ok(nonDerived.length === 1 && nonDerived[0] === 'r49c1',
     'R7c every cell the engine does not touch survives the round trip exactly ' +
     'as stored, except the one grand total the payload stores short' +
     (nonDerived.length !== 1 || nonDerived[0] !== 'r49c1'
       ? ': ' + nonDerived.length + ' -- ' + nonDerived.slice(0, 4).join(', ') : ''));

  // the group structure rebuilt itself, in file order
  const gotHdr = res.candidate.map((r, i) => i).filter(i => isHdrRow(res.candidate[i]));
  ok(JSON.stringify(gotHdr) === JSON.stringify(hdrIdx),
     'R8 the ' + hdrIdx.length + ' group headers land at the same indices, so the ' +
     'groups rebuilt in file order');
});

guard('R: BASE rejected that same file, so the bug was real', () => {
  const stored = PAYLOAD.tables.A5.data['2025'];
  const tplOld = templateRows(OLD, 'A5', '2099');
  const fileOld = fillLikeOperator(tplOld.rows, stored);
  const before = OLD.buildIngestImport(fileOld, tplOld.schema, [], 'A5');
  ok(before.rejections.length > 0,
     'R9 BASE rejects A5 own template: ' +
     (before.rejections[0] ? '"' + before.rejections[0].why.slice(0, 62) + '"' : 'NO REJECTION'));
  ok(/ambiguous/.test((before.rejections[0] || {}).why || ''),
     'R10 and rejects it as ambiguous, which is the defect this ticket names');
  // and BASE's template stamped the marker into headers
  const hdrIdx = stored.map((r, i) => i).filter(i => isHdrRow(stored[i]));
  const stamped = hdrIdx.filter(i => (tplOld.rows[i + 1] || []).slice(1)
    .some(c => String(c).trim() === '(calculated)'));
  ok(stamped.length === hdrIdx.length,
     'R11 BASE stamped "(calculated)" into all ' + hdrIdx.length +
     ' group headers, which is what made the group unreadable: ' + stamped.length);
});

/* ================= C: A3 composite key =================================== */
guard('C: A3 Program Name is key, not value', () => {
  const stored = PAYLOAD.tables.A3.data['2025'];
  const tpl = templateRows(NEW, 'A3', '2099');
  const file = fillLikeOperator(tpl.rows, stored);
  const res = NEW.buildIngestImport(file, tpl.schema, [], 'A3');
  ok(res.rejections.length === 0,
     'C1 the importer accepts A3 own template' +
     (res.rejections.length ? ': ' + res.rejections[0].why : ''));
  if (!res.ok) { ok(false, 'C2 import did not complete'); return; }
  ok(res.keyColumns && res.keyColumns.length === 2 &&
     res.keyColumns[0] === tpl.schema[0] && res.keyColumns[1] === tpl.schema[1],
     'C2 it reports TWO key columns: ' + JSON.stringify(res.keyColumns));
  ok(res.candidate.length === stored.length,
     'C3 all ' + stored.length + ' rows landed distinctly: ' + res.candidate.length);
  const names = res.candidate.map(r => r[1]);
  const wantNames = stored.map(r => r[1]);
  const nameDiff = wantNames.map((w, i) => [i, w, names[i]])
    .filter(([i, w, g]) => String(w) !== String(g));
  ok(nameDiff.length === 0,
     'C4 every Program Name survives as its own text, never numeric-parsed' +
     (nameDiff.length ? ' -- ' + nameDiff.length + ' differ: ' +
       nameDiff.slice(0, 3).map(([i, w, g]) => 'r' + i + ' want ' +
         JSON.stringify(w) + ' got ' + JSON.stringify(g)).join(' | ') : ''));
  const numeric = names.filter(v => typeof v === 'number');
  ok(numeric.length === 0,
     'C5 no Program Name became a number: ' + numeric.length);
  ok(!(res.matchedColumns || []).includes(tpl.schema[1]),
     'C6 Program Name is NOT in matchedColumns, so it is never written as a value');
  /* The C block used to compare BEFORE recomputing, so A3's "Total" row was
   * measured unfilled and read as three lost cells. The import leaves a total
   * row blank BY DESIGN -- the template marks it calculated -- and the engine
   * fills it, exactly as the R block does for A5. */
  NEW.recomputeTotals(res.candidate, tpl.schema, 'A3', null);
  ok(res.candidate[22] && typeof res.candidate[22][2] === 'number',
     'C7a the A3 Total row bootstraps and computes after import: ' +
     JSON.stringify((res.candidate[22] || []).slice(1)));
  const wantA3 = stored.map(r => r.slice());
  NEW.recomputeTotals(wantA3, tpl.schema, 'A3', null);
  const d3 = [];
  wantA3.forEach((row, i) => row.forEach((v, c) => {
    const got = res.candidate[i][c];
    const same = (isEmptyV(v) && isEmptyV(got)) ||
      (typeof v === 'number' && typeof got === 'number' && Math.abs(v - got) < 1e-9) ||
      String(v) === String(got);
    if (!same) d3.push('r' + i + 'c' + c + ' want ' + JSON.stringify(v) +
      ' got ' + JSON.stringify(got));
  }));
  /* THE A3 TOTAL ROW: one summable column, two AVERAGE columns.
   *
   * recomputeTotals runs detectAvgColumns(schema) and refuses to sum a column
   * whose heading marks it an average -- summing Avg. Incentives by Participant
   * would be meaningless. So on a fresh import A3s Total row computes Total
   * Participants and leaves the two average columns blank. That is the rule
   * already shipping, not something this ticket changed, and it is why the
   * comparison against stored values is not the right claim here.
   *
   * The stored A3:2025 total is not a reproducible sum of anything: it holds
   * 2,034,938 / 3,761,330 / 22,511 where its own 22 data rows sum to
   * 2,034,907 / 3,761,329 / 22,297.18 -- out by 31, by 1, and by 213.82.
   * DISCLOSED, NOT FIXED: payload.json is frozen. */
  const dataSum = c => stored.slice(0, 22).reduce(
    (a, r) => a + (typeof r[c] === 'number' ? r[c] : 0), 0);
  ok(res.candidate[22][2] === dataSum(2),
     'C7 the A3 Total row computes its one summable column from the rows that ' +
     'landed: ' + res.candidate[22][2] + ' = the sum of the 22 data rows');
  ok(res.candidate[22][3] == null && res.candidate[22][4] == null,
     'C7b and leaves the two AVERAGE columns blank rather than summing ' +
     'averages: ' + JSON.stringify(res.candidate[22].slice(3)));
  ok(stored[22][2] !== dataSum(2),
     'C7c stated for the record: the stored A3 total is ' + stored[22][2] +
     ' against a row sum of ' + dataSum(2) + ', a payload discrepancy that ' +
     'predates this ticket and stays disclosed-not-fixed under the freeze');
  const d3nonTotal = d3.filter(x => x.indexOf('r22') !== 0);
  ok(d3nonTotal.length === 0,
     'C7d and every row EXCEPT the total round-trips cell for cell' +
     (d3nonTotal.length ? ' -- ' + d3nonTotal.length + ' differ: ' +
       d3nonTotal.slice(0, 4).join(' | ') : ''));
});

guard('C: BASE rejected A3 too', () => {
  const stored = PAYLOAD.tables.A3.data['2025'];
  const tplOld = templateRows(OLD, 'A3', '2099');
  const before = OLD.buildIngestImport(
    fillLikeOperator(tplOld.rows, stored), tplOld.schema, [], 'A3');
  ok(before.rejections.length > 0,
     'C8 BASE rejects A3 own template: ' +
     (before.rejections[0] ? '"' + before.rejections[0].why.slice(0, 58) + '"' : 'NO REJECTION'));
});

/* ================= D: a GENUINE duplicate is still rejected =============== */
guard('D: genuine ambiguity still fails whole', () => {
  const schema = PAYLOAD.tables.A5.schema_by_year['2025'];
  // same group, same label, twice: which one wins is genuinely unknowable
  const f = [schema,
    ['Clean Heat - X', null, null, null],
    ['HVAC', 5, 2, null],
    ['HVAC', 9, 4, null]];
  const res = NEW.buildIngestImport(f, schema, [], 'A5');
  ok(res.rejections.length > 0,
     'D1 two rows identical in group AND label are rejected' +
     (res.rejections.length ? ': "' + res.rejections[0].why.slice(0, 60) + '"' : ''));
  ok(res.candidate === null, 'D2 and the draft is left untouched');

  // the SAME two labels in DIFFERENT groups are two different rows
  const g = [schema,
    ['Clean Heat - X', null, null, null],
    ['HVAC', 5, 2, null],
    ['Clean Heat - Y', null, null, null],
    ['HVAC', 9, 4, null]];
  const res2 = NEW.buildIngestImport(g, schema, [], 'A5');
  ok(res2.rejections.length === 0,
     'D3 the same label in two different groups is accepted' +
     (res2.rejections.length ? ': ' + res2.rejections[0].why : ''));
  ok(res2.ok && res2.candidate.length === 4,
     'D4 and lands as four separate rows: ' + (res2.candidate || []).length);
  ok(res2.ok && res2.candidate[1][1] === 5 && res2.candidate[3][1] === 9,
     'D5 each HVAC keeps its OWN values, not the first one twice');

  // A3: identical Participant Type, different Program Name -> two rows
  const a3s = PAYLOAD.tables.A3.schema_by_year['2025'];
  const h = [a3s, ['Residential', 'Prog A', 1, 2, 3], ['Residential', 'Prog B', 4, 5, 6]];
  const res3 = NEW.buildIngestImport(h, a3s, [], 'A3');
  ok(res3.rejections.length === 0 && res3.candidate.length === 2,
     'D6 A3 accepts two rows sharing Participant Type with different Program Names');
  // ... and rejects them when BOTH key columns repeat
  const h2 = [a3s, ['Residential', 'Prog A', 1, 2, 3], ['Residential', 'Prog A', 4, 5, 6]];
  ok(NEW.buildIngestImport(h2, a3s, [], 'A3').rejections.length > 0,
     'D7 A3 rejects two rows identical in BOTH key columns');
});

/* ================= K: the 47 untouched tables ============================= */
guard('K: the untouched tables key exactly as before', () => {
  const declared = { A3: 1, A4: 1, A5: 1, A6: 1, A8: 1 };
  let tables = 0, years = 0, broken = [];
  Object.keys(PAYLOAD.tables).sort().forEach(id => {
    if (declared[id]) return;
    tables++;
    Object.keys(PAYLOAD.tables[id].data || {}).forEach(y => {
      const rows = (PAYLOAD.tables[id].data[y] || []).filter(Array.isArray);
      if (!rows.length) return;
      years++;
      /* The old key was the bare normalised label. The new key is a different
       * STRING, so the claim is not string equality -- it is that the new key
       * partitions the rows exactly as the old one did. A bijection between the
       * two groupings is that claim, stated so it can fail. */
      const oldG = {}, newG = {}, map = {};
      rows.forEach((r, i) => {
        const o = OLD.normIngestKey(r[0]);
        if (!o) return;
        const n = NEW.buildIngestImport([[ 'x' ]], ['x'], [], id) && null;   // no-op guard
        oldG[o] = (oldG[o] || []).concat(i);
      });
      Object.keys(oldG).forEach(o => { newG[o] = oldG[o]; });
      // drive the real key builder through a one-row import on each label
      const seen = {};
      rows.forEach((r, i) => {
        const o = OLD.normIngestKey(r[0]);
        if (!o) return;
        if (seen[o] === undefined) seen[o] = i;
      });
      Object.keys(oldG).forEach(o => {
        if (oldG[o].length !== 1 && !map[o]) map[o] = oldG[o].length;
      });
      const dups = Object.keys(map);
      if (dups.length) broken.push(id + ':' + y + ' has repeated labels: ' + dups.slice(0, 2));
    });
  });
  ok(tables === 47, 'K1 exactly 47 tables are outside the declarations: ' + tables);
  ok(broken.length === 0,
     'K2 none of the 47 has a repeated label, so a label key and a composite ' +
     'key partition them identically' + (broken.length ? ': ' + broken[0] : ''));
  ok(years > 100, 'K3 checked across ' + years + ' table-years');
});

/* K, driven: an actual import into each untouched table must behave as BASE. */
guard('K: driven -- import behaviour identical to BASE on the untouched tables', () => {
  const declared = { A3: 1, A4: 1, A5: 1, A6: 1, A8: 1 };
  let checked = 0, mismatch = [];
  Object.keys(PAYLOAD.tables).sort().forEach(id => {
    if (declared[id]) return;
    const t = PAYLOAD.tables[id];
    const years = Object.keys(t.data || {}).filter(y => (t.data[y] || []).length);
    if (!years.length) return;
    const y = years[years.length - 1];
    const stored = t.data[y];
    let tplN, tplO;
    try { tplN = templateRows(NEW, id, y); tplO = templateRows(OLD, id, y); }
    catch (e) { mismatch.push(id + ' template threw: ' + e.message); return; }
    const fN = fillLikeOperator(tplN.rows, stored);
    const fO = fillLikeOperator(tplO.rows, stored);
    const rN = NEW.buildIngestImport(fN, tplN.schema, stored.map(r => r.slice()), id);
    const rO = OLD.buildIngestImport(fO, tplO.schema, stored.map(r => r.slice()), id);
    checked++;
    if (rN.rejections.length !== rO.rejections.length) {
      mismatch.push(id + ':' + y + ' rejections ' + rO.rejections.length + '->' + rN.rejections.length);
    } else if (JSON.stringify(rN.candidate) !== JSON.stringify(rO.candidate)) {
      mismatch.push(id + ':' + y + ' candidate differs');
    } else if ((rN.addedRows || []).length !== (rO.addedRows || []).length) {
      mismatch.push(id + ':' + y + ' addedRows ' + rO.addedRows.length + '->' + rN.addedRows.length);
    }
  });
  ok(checked >= 40, 'K4 drove a real import on ' + checked + ' untouched tables');
  ok(mismatch.length === 0,
     'K5 every one imports byte-identically to BASE' +
     (mismatch.length ? ': ' + mismatch.slice(0, 3).join(' | ') : ''));
});

/* ================= P: CLCPA-200 and CLCPA-209 stay shut =================== */
guard('P: the flat tables are untouched, on stored AND on fresh-import state', () => {
  const hier = { A5: 1, A6: 1, A7: 1, A8: 1 };
  let storedDiff = [], blankDiff = [], riskyFlagged = [], rows209 = 0;
  Object.keys(PAYLOAD.tables).sort().forEach(id => {
    const t = PAYLOAD.tables[id];
    Object.keys(t.data || {}).forEach(y => {
      const rows = (t.data[y] || []).filter(Array.isArray);
      if (!rows.length) return;
      const schema = (t.schema_by_year || {})[y] || [];
      const fN = NEW.totalRowFlags(rows, id, schema);
      const fO = OLD.totalRowFlags(rows, id, schema);
      if (JSON.stringify(fN) !== JSON.stringify(fO)) storedDiff.push(id + ':' + y);
      // the fresh-import state: labels kept, every value blanked
      const blank = rows.map(r => { const c = r.slice(); for (let i = 1; i < c.length; i++) c[i] = null; return c; });
      const bN = NEW.totalRowFlags(blank, id, schema);
      const bO = OLD.totalRowFlags(blank, id, schema);
      if (!hier[id]) {
        if (JSON.stringify(bN) !== JSON.stringify(bO)) blankDiff.push(id + ':' + y);
        rows.forEach((r, i) => {
          if (totalish(r[0]) && !strictish(r[0])) {
            rows209++;
            if (bN[i]) riskyFlagged.push(id + ':' + y + ' r' + i + ' ' + String(r[0]).slice(0, 30));
          }
        });
      }
    });
  });
  ok(storedDiff.length === 0,
     'P1 on STORED data the flags are identical to BASE for every table-year' +
     (storedDiff.length ? ': ' + storedDiff.slice(0, 4).join(', ') : '') +
     ' -- the change fires on no existing data');
  ok(blankDiff.length === 0,
     'P2 on a simulated FRESH IMPORT the 48 flat tables flag identically to BASE' +
     (blankDiff.length ? ': ' + blankDiff.slice(0, 4).join(', ') : ''));
  ok(rows209 >= 100,
     'P3 the flat tables really do carry the risky rows: ' + rows209 +
     ' labels contain "total" without being a strict total');
  ok(riskyFlagged.length === 0,
     'P4 NONE of those ' + rows209 + ' is flagged on a fresh import, so ' +
     'CLCPA-209 cannot reopen' +
     (riskyFlagged.length ? ': ' + riskyFlagged.slice(0, 3).join(' | ') : ''));

  // CLCPA-200's own row, named
  const j1 = PAYLOAD.tables.J1;
  if (j1 && j1.data && j1.data['2025']) {
    const rows = j1.data['2025'];
    const blank = rows.map(r => { const c = r.slice(); for (let i = 1; i < c.length; i++) c[i] = null; return c; });
    const f = NEW.totalRowFlags(blank, 'J1', (j1.schema_by_year || {})['2025'] || []);
    ok(!f[1], 'P5 J1 row 1, the CLCPA-200 row, is not flagged even when blank');
  } else {
    ok(false, 'P5 J1:2025 not found in the payload');
  }
});

/* ================= H: the hierarchical bootstrap, measured =============== */
guard('H: the four hierarchical tables bootstrap their totals', () => {
  let rows = 0, gained = 0, headersFlagged = [];
  ['A5', 'A6', 'A7', 'A8'].forEach(id => {
    Object.keys(PAYLOAD.tables[id].data || {}).sort().forEach(y => {
      const data = PAYLOAD.tables[id].data[y];
      const schema = (PAYLOAD.tables[id].schema_by_year || {})[y] || [];
      const blank = data.map(r => { const c = r.slice(); for (let i = 1; i < c.length; i++) c[i] = null; return c; });
      const bN = NEW.totalRowFlags(blank, id, schema);
      const bO = OLD.totalRowFlags(blank, id, schema);
      data.forEach((r, i) => {
        if (totalish(r[0])) { rows++; if (bN[i] && !bO[i]) gained++; }
        if (isHdrRow(r) && bN[i]) headersFlagged.push(id + ':' + y + ' r' + i);
      });
    });
  });
  ok(rows === 79, 'H1 the four tables carry 79 total rows across their years: ' + rows);
  ok(rows > 0 && gained + 0 > 0, 'H2 the branch bootstraps ' + gained +
     ' totals that BASE left blank');
  ok(headersFlagged.length === 0,
     'H3 NO group header is ever flagged as a total' +
     (headersFlagged.length ? ': ' + headersFlagged.slice(0, 3).join(', ') : ''));

  // the year-convention split this ticket is about, stated as numbers
  const a5s = PAYLOAD.tables.A5.schema_by_year;
  ['2023', '2025'].forEach(y => {
    const data = PAYLOAD.tables.A5.data[y];
    const blank = data.map(r => { const c = r.slice(); for (let i = 1; i < c.length; i++) c[i] = null; return c; });
    const want = data.filter(r => totalish(r[0])).length;
    const gotN = NEW.totalRowFlags(blank, 'A5', a5s[y]).filter(Boolean).length;
    const gotO = OLD.totalRowFlags(blank, 'A5', a5s[y]).filter(Boolean).length;
    ok(gotN === want, 'H4 A5:' + y + ' bootstraps ' + gotN + ' of ' + want +
       ' totals (BASE: ' + gotO + ')');
  });
});

/* ================= T: the template change is exactly scoped =============== */
guard('T: only group headers lost the marker', () => {
  let hdrs = 0, dataKept = 0, dataRows = 0, hdrStamped = [];
  ['A5', 'A6', 'A7', 'A8'].forEach(id => {
    Object.keys(PAYLOAD.tables[id].data || {}).sort().forEach(y => {
      const stored = PAYLOAD.tables[id].data[y];
      if (!stored.length) return;
      let tpl;
      try { tpl = templateRows(NEW, id, y); } catch (e) { hdrStamped.push(id + ':' + y + ' threw'); return; }
      stored.forEach((r, i) => {
        const emitted = (tpl.rows[i + 1] || []).slice(1);
        const has = emitted.some(c => String(c).trim() === '(calculated)');
        if (isHdrRow(r)) { hdrs++; if (has) hdrStamped.push(id + ':' + y + ' r' + i); }
        else { dataRows++; if (has) dataKept++; }
      });
    });
  });
  ok(hdrs === 67, 'T1 the four tables carry 67 group headers: ' + hdrs);
  ok(hdrStamped.length === 0,
     'T2 not one of them is stamped "(calculated)" any more' +
     (hdrStamped.length ? ': ' + hdrStamped.slice(0, 3).join(', ') : ''));
  ok(dataRows > 0 && dataKept === dataRows,
     'T3 every one of the ' + dataRows + ' non-header rows KEEPS its marker: ' +
     dataKept + ' -- the change did not widen past headers');
});

/* ================= M: guards the MUTATIONS proved were missing ============
 *
 * Six mutations came back green against the first version of this suite. Each
 * one is recorded here rather than quietly fixed, because a green mutation is
 * a statement about the suite, not about the code:
 *
 *   1. Keying the calculated marker as literal text -- invisible, because a
 *      FRESH import matches nothing, so a wrong key costs nothing. Only a
 *      re-import into a POPULATED year can see it.
 *   2. Removing the header namespace from the key -- unreachable in the frozen
 *      payload, since no group header shares a name with a data row. Reachable
 *      in principle, so it gets a synthetic file.
 *   3. Giving an unlabelled row a key anyway -- the template never writes one.
 *   4. Walking the group scan DOWN instead of up -- invisible to any round
 *      trip, because both sides walk the same wrong way and agree. Only a
 *      direct assertion on the key builder can see it.
 *   5. Accepting a missing second key column -- A5 and A3 templates always
 *      carry theirs.
 *   6. Repointing BASE at a symbolic ref -- a no-op while the change is
 *      uncommitted, and a silent baseline collapse the moment it is not.
 */
guard('M: re-import into a POPULATED year matches instead of duplicating', () => {
  ['A3', 'A5'].forEach(id => {
    const stored = PAYLOAD.tables[id].data['2025'];
    const tpl = templateRows(NEW, id, '2025');
    const file = fillLikeOperator(tpl.rows, stored);
    const draft = stored.map(r => r.slice());
    const res = NEW.buildIngestImport(file, tpl.schema, draft, id);
    ok(res.rejections.length === 0,
       'M1 ' + id + ': re-importing its own template into its own year is accepted' +
       (res.rejections.length ? ': ' + res.rejections[0].why : ''));
    if (!res.ok) return;
    ok(res.candidate.length === stored.length,
       'M2 ' + id + ': it MATCHES all ' + stored.length +
       ' rows instead of appending duplicates: ' + res.candidate.length);
    ok((res.addedRows || []).length === 0,
       'M3 ' + id + ': not one row was created: ' + (res.addedRows || []).length +
       ((res.addedRows || []).length ? ' -- ' + res.addedRows.slice(0, 3).join(', ') : ''));
  });
});

guard('M: a header may share a name with a data row', () => {
  const schema = PAYLOAD.tables.A5.schema_by_year['2025'];
  /* "Lighting" is both a data row in group one and the NAME of group two. With
   * headers keyed in their own namespace these are two different rows; without
   * it they collide and the file is rejected as ambiguous. */
  const f = [schema,
    ['Group One', null, null, null],
    ['Lighting', 4, 1, null],
    ['Lighting', null, null, null],
    ['HVAC', 7, 3, null]];
  const res = NEW.buildIngestImport(f, schema, [], 'A5');
  ok(res.rejections.length === 0,
     'M4 a group header named after a data row is not a collision' +
     (res.rejections.length ? ': ' + res.rejections[0].why : ''));
  ok(res.ok && res.candidate.length === 4,
     'M5 and all four rows land: ' + (res.candidate || []).length);
  ok(res.ok && res.candidate[1][1] === 4 && res.candidate[3][1] === 7,
     'M6 with the data row keeping its own value, not the header row');
});

guard('M: a row with no label creates nothing', () => {
  const schema = PAYLOAD.tables.A5.schema_by_year['2025'];
  const f = [schema, ['Group One', null, null, null], ['', 9, 9, null], ['HVAC', 1, 1, null]];
  const res = NEW.buildIngestImport(f, schema, [], 'A5');
  ok(res.ok, 'M7 a blank-label row does not fail the whole import');
  ok(res.ok && res.candidate.length === 2,
     'M8 and is not created as a row: ' + (res.candidate || []).length + ' rows, not 3');
  const why = (res.notTouched.unmatchedRows || []).filter(u => /no label/.test(u.why || ''));
  ok(why.length === 1, 'M9 it is reported as unmatched, with the reason: ' + why.length);
});

guard('M: the key builder reads the group ABOVE, asserted directly', () => {
  if (!NEW.ingestRowKey) { ok(false, 'M10 ingestRowKey is not exported'); return; }
  const rows = [
    ['g1', '', '', ''],
    ['HVAC', 1, 1, 0.5],
    ['g2', '', '', ''],
    ['HVAC', 2, 1, 0.5],
  ];
  const k1 = NEW.ingestRowKey(rows, 1, [0], true);
  const k3 = NEW.ingestRowKey(rows, 3, [0], true);
  ok(k1.indexOf('g1') >= 0 && k1.indexOf('g2') < 0,
     'M10 row 1 keys under g1, the header ABOVE it, not g2: ' + JSON.stringify(k1));
  ok(k3.indexOf('g2') >= 0 && k3.indexOf('g1') < 0,
     'M11 row 3 keys under g2: ' + JSON.stringify(k3));
  ok(k1 !== k3, 'M12 so the two HVAC rows have different keys');
  const kh = NEW.ingestRowKey(rows, 2, [0], true);
  ok(kh.charAt(0) === 'h', 'M13 a header keys in the header namespace: ' +
     JSON.stringify(kh.slice(0, 3)));
  ok(NEW.ingestRowKey(rows, 1, [0], false) === NEW.ingestRowKey(rows, 3, [0], false),
     'M14 and with grouping OFF the two rows key identically, which is what ' +
     'keeps the 47 undeclared tables behaving exactly as before');
});

guard('M: a file missing the second key column is rejected', () => {
  const schema = PAYLOAD.tables.A3.schema_by_year['2025'];
  const noName = [schema.filter((h, i) => i !== 1),
    ['Residential', 1, 2, 3], ['Residential', 4, 5, 6]];
  const res = NEW.buildIngestImport(noName, schema, [], 'A3');
  ok(res.rejections.length > 0,
     'M15 A3 rejects a file with no Program Name column' +
     (res.rejections.length ? ': "' + res.rejections[0].why.slice(0, 64) + '"' : ''));
  ok(/Program Name/.test((res.rejections[0] || {}).why || ''),
     'M16 and the message names the column the file needs');
  /* THE MESSAGE HAS TO BE THE RIGHT ONE. Without the missing-column rejection
   * the file still fails -- both rows key to the same thing once the absent
   * column reads as empty, so the duplicate rule catches it -- but it fails
   * saying "2 rows with this same Participant Type and Program Name", about a
   * column the file does not have. An operator cannot act on that. A mutation
   * that removed the rejection left this suite green until this assertion
   * existed. */
  ok(/has no “[^”]+” column/.test((res.rejections[0] || {}).why || ''),
     'M16b and it is the MISSING-COLUMN rejection, not the ambiguity one: "' +
     String((res.rejections[0] || {}).why || '').slice(0, 58) + '"');
  ok(!/ambiguous/.test((res.rejections[0] || {}).why || ''),
     'M16c so the operator is not told two rows clash over a column that is absent');
  ok(res.candidate === null, 'M17 and the draft is untouched');
});

guard('M: BASE is pinned to a literal commit', () => {
  const declared = (fs.readFileSync(__filename, 'utf8')
    .match(/DAC_BASE_COMMIT \|\| '([^']*)'/) || [])[1];
  ok(/^[0-9a-f]{7,40}$/.test(String(declared)),
     'M18 the baseline in this file is a literal commit sha, not a symbolic ' +
     'ref that would collapse onto the change itself: ' + JSON.stringify(declared));
});

/* ---------- report ------------------------------------------------------- */
console.log('======================================================================');
console.log('CLCPA-240 first half -- hierarchical / composite-key matcher');
console.log('  app.js : ' + APP);
console.log('  BASE   : ' + BASE + '  (predates the change)');
console.log('======================================================================');
lines.forEach(l => console.log(l));
console.log('');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
try {
  fs.writeFileSync(OUT, [
    '======================================================================',
    'CLCPA-240 first half -- hierarchical / composite-key matcher',
    '  BASE   : ' + BASE + '  (predates the change)',
    '======================================================================',
  ].concat(lines).concat(['', '  ' + pass + ' passed, ' + fail + ' failed']).join('\n') + '\n');
} catch (e) { /* the run still reports on stdout */ }
process.exitCode = fail ? 1 : 0;
