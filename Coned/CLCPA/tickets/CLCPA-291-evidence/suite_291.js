/* CLCPA-291: a TEXT column in a structure row has no value, it is not calculated.
 *
 * THE ARTEFACT IS BYTES, NOT DOM. This ticket is about what the generated
 * workbook contains, so the evidence is the real workbook built by the real
 * writer and read back cell by cell -- the same shape suite_274 uses, and the
 * one that has passed hosted. The browser adds download plumbing and nothing
 * this ticket can be wrong about.
 *
 *   BEFORE  A3 total row  ["Total","(calculated)","(calculated)","(calculated)","(calculated)"]
 *   AFTER   A3 total row  ["Total","(no value)",  "(calculated)","(calculated)","(calculated)"]
 *
 * (calculated) tells the preparer the dashboard fills the cell in, and makes
 * the importer SKIP it. Nothing can fill in a programme name, so the marker
 * was a promise about a text column that no code could keep.
 *
 * THE PREDICATE HAS TO SPAN EVERY YEAR, and that is the whole difficulty.
 * A7's "DAC Installations" holds numbers in 2024 and nothing in 2025, so a
 * test scoped to the displayed year calls it text and converts a genuine
 * numeric column. And a percent column is stored as the STRING "45%", which
 * bareNumber refuses by design -- asking it alone stamped (no value) across
 * J3, J4, J6 and J7. Both were measured before they reached a commit.
 *
 * MEASURED BLAST RADIUS: across every table in the payload, exactly TWO cells
 * change. A3 row 23 col 1 and A4 row 23 col 1.
 *
 * BASE predates the change: 91640bf.
 *
 * Run:  node suite_291.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { boot } = require('../_kit/live_editor.js');
const { templateRows, dense } = require('../_kit/xlsx_read.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || '91640bf';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);
const SRC = fs.readFileSync(APP, 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => { try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); } };
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p);

function grab(name, src) {
  const anchor = '\r\n  function ' + name + '(';
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error('grab: no function ' + name);
  let j = src.indexOf('{', i), d = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) { j = k; break; } }
  }
  return src.slice(i + 2, j + 1);
}
const assemble = (names, src) =>
  new Function(names.map(n => grab(n, src)).join('\n') +
    '\nreturn {' + names.map(n => n + ':' + n).join(',') + '};')();

/** the REAL workbook for a table's newest year, read back cell by cell */
const tmpl = (id, src) => {
  const ys = Object.keys(P.tables[id].data || {});
  const y = ys[ys.length - 1];
  return templateRows(boot({ payload: P, tableId: id, year: y, src: src })
    .api.buildIngestWorkbook(id, y)).map(dense);
};
const totalRow = (rows) => rows.find(r => /^total$/i.test(String(r[0] || '').trim()));

log('======================================================================');
log('CLCPA-291 -- a text column in a structure row has NO VALUE');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the defect, on the build that shipped it ----------------------- */
log('');
log('A. THE DEFECT, ON BASE');
guard('A-block', () => {
  ok(!/function ingestTextOnlyColumn/.test(codeOnly(BASE_SRC)),
    'A1 BASE had no notion of a text-only column');
  ['A3', 'A4'].forEach((id) => {
    const t = totalRow(tmpl(id, BASE_SRC));
    ok(t && String(t[1]).trim() === '(calculated)',
      'A2.' + id + ' its Total row marked the Program Name cell (calculated) -- ' +
      JSON.stringify(t));
  });
  /* the marker is a promise with teeth: the importer SKIPS the cell */
  ok(/the template marks this cell as calculated, so it is left to /.test(BASE_SRC),
    'A3 and the importer skips a (calculated) cell, so the promise had teeth');
});

/* ---- B. the fix, in the real workbook ---------------------------------- */
log('');
log('B. WHAT THE TEMPLATE EMITS NOW');
guard('B-block', () => {
  ['A3', 'A4'].forEach((id) => {
    const t = totalRow(tmpl(id, SRC));
    ok(t && String(t[1]).trim() === '(no value)',
      'B1.' + id + ' the Program Name cell is (no value) -- ' + JSON.stringify(t));
    ok(t && String(t[2]).trim() === '(calculated)' &&
       String(t[3]).trim() === '(calculated)' && String(t[4]).trim() === '(calculated)',
      'B2.' + id + ' and every NUMERIC column of that row is still (calculated)');
    ok(t && String(t[0]).trim() === 'Total',
      'B3.' + id + ' the label column still carries the row label, not a marker');
  });
});

/* ---- C. the blast radius, measured across every table ------------------ */
log('');
log('C. EXACTLY TWO CELLS CHANGE, IN THE WHOLE PAYLOAD');
guard('C-block', () => {
  const diffs = [];
  Object.keys(P.tables).sort().forEach((id) => {
    const ys = Object.keys(P.tables[id].data || {});
    if (!ys.length) return;
    let a, b;
    try { a = tmpl(id, BASE_SRC); b = tmpl(id, SRC); } catch (e) { return; }
    a.forEach((r, ri) => (r || []).forEach((v, c) => {
      const w = (b[ri] || [])[c];
      if (String(v) !== String(w)) diffs.push(id + ' r' + ri + ' c' + c + ' ' +
        JSON.stringify(v) + '->' + JSON.stringify(w));
    }));
  });
  ok(diffs.length === 2, 'C1 exactly two template cells moved -- ' + diffs.length);
  ok(diffs.every(d => /^A[34] /.test(d)),
    'C2 both in A3 and A4 -- ' + JSON.stringify(diffs));
  ok(diffs.every(d => /"\(calculated\)"->"\(no value\)"/.test(d)),
    'C3 and both from (calculated) to (no value), nothing else');
});

/* ---- D. the predicate, and the two ways it nearly went wrong ----------- */
log('');
log('D. WHAT COUNTS AS A TEXT COLUMN');
guard('D-block', () => {
  const H = assemble(['ingestTextOnlyColumn', 'bareNumber', 'isPercentLiteral'], SRC);
  ok(H.ingestTextOnlyColumn(P.tables.A3, 1) === true,
    'D1 A3 Program Name is text in every year it has');
  /* A7's column holds numbers in 2024 and NOTHING in 2025. Worth keeping, but
   * be exact about WHICH guard saves it: 2025 is blank, so the blank-column
   * guard answers first and the all-years scope is never reached. A mutation
   * that scoped the predicate to one year went unnoticed against this. */
  ok(H.ingestTextOnlyColumn(P.tables.A7, 2) === false,
    'D2 A7 DAC Installations is NOT text (its 2025 column is blank, not textual)');
  /* THE ALL-YEARS SCOPE, exercised. A column holding TEXT in the newest year
   * and NUMBERS in an older one is the shape a year-scoped predicate gets
   * wrong, and the payload happens not to contain one -- so it is constructed.
   * The predicate is pure, so a constructed input tests its contract; the
   * blast-radius guard in C is what tests it against the real data. */
  const mixed = { data: { '2024': [[null, 5], [null, 7]], '2025': [[null, 'n/a'], [null, 'tbd']] } };
  ok(H.ingestTextOnlyColumn(mixed, 1) === false,
    'D2b a column with numbers in ANY year is not text, whatever the newest year holds');
  const allText = { data: { '2024': [[null, 'a']], '2025': [[null, 'b']] } };
  ok(H.ingestTextOnlyColumn(allText, 1) === true,
    'D2c and a column textual in every year IS text');
  /* a percent column is stored as a STRING and bareNumber refuses it */
  ok(H.bareNumber('63%') === null,
    'D3 (bareNumber refuses a percent literal, by design)');
  ok(H.isPercentLiteral('63%') === true, 'D4 and isPercentLiteral is what reads it');
  ['J3', 'J4', 'J6', 'J7'].forEach((id) => {
    const sch = P.tables[id].schema_by_year[Object.keys(P.tables[id].schema_by_year)[0]];
    const pc = sch.findIndex(h => /%/.test(String(h || '')));
    ok(pc > 0 && H.ingestTextOnlyColumn(P.tables[id], pc) === false,
      'D5.' + id + ' its percent column is NOT text -- ' + JSON.stringify(sch[pc]));
  });
  ok(H.ingestTextOnlyColumn(P.tables.A3, 2) === false,
    'D6 a plainly numeric column is not text');
  /* a column blank everywhere says nothing and must not be converted */
  const blank = { data: { '2025': [[null, null], [null, '']] } };
  ok(H.ingestTextOnlyColumn(blank, 1) === false,
    'D7 a column blank in every year is left exactly as it was');
});

/* ---- E. the import path does not change -------------------------------- */
log('');
log('E. WHAT THE IMPORTER DOES WITH THE NEW MARKER');
guard('E-block', () => {
  const code = codeOnly(SRC);
  ok(/if \(String\(raw\)\.trim\(\) === INGEST_NOVALUE_MARKER\) \{/.test(code),
    'E1 the importer already skips a (no value) cell');
  ok(/if \(String\(raw\)\.trim\(\) === INGEST_CALC_MARKER\) \{/.test(code),
    'E2 as it skips a (calculated) one');
  ok(grab('buildIngestImport', SRC) === grab('buildIngestImport', BASE_SRC),
    'E3 and buildIngestImport is BYTE-IDENTICAL to BASE: the import path is untouched');
  ok(/s === '' \|\| s === INGEST_NOVALUE_MARKER;/.test(code),
    'E4 (no value) still counts as shape-blank, so the structure stays readable');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha that predates the change');
  /* C walks EVERY table rather than the two the ticket names: the blast
   * radius is measured, not asserted, and it is how the J-family regression
   * was caught before it was committed. */
  ok(/Object\.keys\(P\.tables\)\.sort\(\)\.forEach/.test(self),
    'X2 the blast radius is measured across every table, not the two named');
  ok(/templateRows\(boot\(/.test(self),
    'X3 the evidence is the REAL generated workbook, read back cell by cell');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-291-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
