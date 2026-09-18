/* CLCPA-274 round 2: the template's SECOND HEADER ROW.
 *
 * THE LIVE REPRODUCTION CAME FIRST, and it is what this suite is aligned to.
 * Driven through the real page with the real workbook writer, reading the
 * generated .xlsx back cell by cell:
 *
 *   F6 template, before:  row1 the group spans, row2 SEVEN BLANK CELLS,
 *                         data from row3. The four value columns are
 *                         unlabelled and the operator cannot tell
 *                         NON-NETWORK/Excludable from NETWORK/Excludable.
 *
 * MEASURED, and this answers the ticket's first question: it PREDATES the
 * wave. The identical blank row 2 comes out of ca4c90a (main before the
 * package), out of the CLCPA-274 follow-up, and out of the deployed build. The
 * F6 marker correction did not cause it.
 *
 * WIDER THAN F6, also measured: A9 emitted the same blank row, and A10 emitted
 * "(calculated)" INTO its sub-header row -- a header row told it has something
 * to calculate. All three are the same missing derivation.
 *
 * THE FIX is one shared rule. renderIngestEditor already knew how to read
 * header_levels; the writer did not, and blanked the row like any data row
 * because a template is deliberately emptied for the preparer to fill. The
 * derivation is now ingestHeaderRowCount(), read by both.
 *
 * BASE predates the change: df6173f, main at the deploy of b0c8c99ebf.
 *
 * Run:  node suite_274_r2.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { boot } = require('../_kit/live_editor.js');
const { templateRows, dense } = require('../_kit/xlsx_read.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || 'df6173f';
/* PINNED ON BOTH SIDES (CLAUDE.md). This suite asserts what CLCPA-274 round 2
 * did to functions a LATER round has since changed, so its post-change side
 * reads that build rather than live main. A blast-radius claim can only be
 * true at the commit that made the change. DAC_APP_OVERRIDE still wins, so
 * the mutation runner keeps working. */
const NEWREV = process.env.DAC_NEW_COMMIT || 'ec6d208';
const APP = process.env.DAC_APP_OVERRIDE || ('git show ' + NEWREV + ':' + REL);
const SRC = process.env.DAC_APP_OVERRIDE
  ? fs.readFileSync(process.env.DAC_APP_OVERRIDE, 'utf8')
  : execSync('git show ' + NEWREV + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
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

/** every template row of one table, as dense arrays, through the real writer */
function tmpl(tableId, year, src) {
  const H = boot({ payload: P, tableId: tableId, year: year, src: src });
  return templateRows(H.api.buildIngestWorkbook(tableId, year)).map(dense);
}
const NOW = (id, y) => tmpl(id, y, SRC);
const THEN = (id, y) => tmpl(id, y, BASE_SRC);

log('======================================================================');
log('CLCPA-274 round 2 -- the template carries its second header row');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the defect, reproduced on BASE ---------------------------------- */
log('');
log('A. THE DEFECT, ON THE BUILD THAT SHIPPED IT');
guard('A-block', () => {
  const before = THEN('F6', '2025');
  ok(before[1].length > 0 && before[1].every(v => v === '' || v === null),
    'A1 on BASE, F6 template row 2 is entirely blank -- ' + JSON.stringify(before[1]));
  const stored = P.tables.F6.data['2025'][0];
  ok(stored.filter(v => v != null && v !== '').length === 4,
    'A2 while the STORED sub-header carries four labels -- ' +
    JSON.stringify(stored.filter(v => v != null && v !== '')));
  ok(before[0].indexOf('NON-NETWORK') >= 0 && before[0].indexOf('NETWORK') >= 0,
    'A3 row 1 did carry the group spans, so only the sub-labels were lost');
  /* the whole declared two-level family, not just the table in the ticket */
  const a9 = THEN('A9', '2025'), a10 = THEN('A10', '2025');
  ok(a9[1].every(v => v === '' || v === null),
    'A4 A9 was blank in the same way -- the same missing derivation');
  ok(a10[1].some(v => v === '(calculated)'),
    'A5 and A10 was worse: its sub-header row carried "(calculated)"');
});

/* ---- B. it predates the wave -------------------------------------------- */
log('');
log('B. WHOSE DEFECT IT IS: NOT THIS WAVE\'S');
guard('B-block', () => {
  /* the question the ticket asks, answered by measurement on three builds */
  const PRE = execSync('git show ca4c90a:"' + REL + '"',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
  const pre = tmpl('F6', '2025', PRE)[1];
  ok(pre.every(v => v === '' || v === null),
    'B1 ca4c90a -- main BEFORE the whole package -- emitted the same blank row');
  const FU = execSync('git show b902b0b:"' + REL + '"',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
  ok(tmpl('F6', '2025', FU)[1].every(v => v === '' || v === null),
    'B2 and so did the CLCPA-274 follow-up, so the marker correction is not the cause');
});

/* ---- C. the fix, on the live path --------------------------------------- */
log('');
log('C. THE SUB-HEADER IS EMITTED, VERBATIM');
guard('C-block', () => {
  const now = NOW('F6', '2025');
  const stored = P.tables.F6.data['2025'][0];
  ok(JSON.stringify(now[1].map(v => (v === '' ? null : v))) ===
     JSON.stringify(stored.map(v => (v == null || v === '' ? null : String(v)))),
    'C1 F6 row 2 is now the stored sub-header, cell for cell -- ' + JSON.stringify(now[1]));
  ok(now[0].length === now[1].length,
    'C2 and it is the same width as row 1: ' + now[0].length + ' and ' + now[1].length);
  ok(now[2][0] === 'Borough Hall',
    'C3 the first DATA row still follows it -- ' + JSON.stringify(now[2].slice(0, 2)));
  /* the marker, re-verified against the RESTORED two-row header */
  ok(now[1].every(v => v !== '(calculated)'),
    'C4 the header row carries NO (calculated) marker: a header has nothing to calculate');
  ok(now[2][now[2].length - 1] === '(calculated)',
    'C5 while the body row below it still marks its derivable Grand Total');
  const marked = now.reduce((n, r) => n + r.filter(v => v === '(calculated)').length, 0);
  ok(marked === 24, 'C6 F6 carries 24 marked cells, the follow-up\'s own number -- ' + marked);
});

/* ---- D. the rest of the declared family --------------------------------- */
log('');
log('D. THE WHOLE TWO-LEVEL FAMILY, AND NOBODY ELSE');
guard('D-block', () => {
  ['A9', 'A10'].forEach((id) => {
    const now = NOW(id, '2025');
    const stored = P.tables[id].data['2025'][0];
    ok(JSON.stringify(now[1].map(v => (v === '' ? null : v))) ===
       JSON.stringify(stored.map(v => (v == null || v === '' ? null : String(v)))),
      'D1.' + id + ' emits its stored sub-header verbatim -- ' + JSON.stringify(now[1]).slice(0, 70));
    ok(now[1].every(v => v !== '(calculated)'),
      'D2.' + id + ' and no marker reaches that row');
  });
  /* D1 carries header_levels 0 and its first row is genuine data: the
   * predicate must be "a number, at least 2", never "has the key" */
  ok(P.tables.D1.header_levels === 0, 'D3 D1 really does carry header_levels 0');
  const d1 = NOW('D1', '2025');
  ok(d1[1][0] === P.tables.D1.data['2025'][0][0],
    'D4 and D1 row 2 is still its DATA row, not treated as a header -- ' +
    JSON.stringify(d1[1][0]).slice(0, 48));
});

/* ---- E. the tables the owner's pass covered, unchanged ------------------- */
log('');
log('E. EVERY OTHER ENUMERATED TEMPLATE IS BYTE-FOR-BYTE WHAT IT WAS');
guard('E-block', () => {
  ['H1', 'B2', 'F2', 'F4', 'F5', 'F7'].forEach((id) => {
    const a = JSON.stringify(THEN(id, '2025'));
    const b = JSON.stringify(NOW(id, '2025'));
    ok(a === b, 'E1.' + id + ' identical to BASE (' + JSON.parse(b).length + ' rows)');
  });
});

/* ---- F. one derivation, two readers ------------------------------------- */
log('');
log('F. THE RULE LIVES IN ONE PLACE');
guard('F-block', () => {
  const code = codeOnly(SRC);
  ok(/function ingestHeaderRowCount\(table, rowCount\) \{/.test(code),
    'F1 the derivation is a named function');
  const calls = (code.match(/ingestHeaderRowCount\(/g) || []).length;
  ok(calls === 3, 'F2 declared once and called from BOTH readers -- ' + calls + ' occurrences');
  ok(/const headerRowCount = ingestHeaderRowCount\(table, i\.draft\.length\);/.test(code),
    'F3 the editor reads it');
  ok(/const templateHeaderRows = ingestHeaderRowCount\(table, src\.rows\.length\);/.test(code),
    'F4 and the template writer reads it');
  /* the inline copy the editor used must be GONE, or there are two rules */
  ok(!/const lv = table\.header_levels;[\s\S]{0,120}Math\.min\(lv - 1, i\.draft\.length\)/.test(code),
    'F5 the editor no longer carries its own inline copy');
  ok(/typeof lv !== 'number' \|\| lv < 2/.test(code),
    'F6 and the predicate is "a number, at least 2" -- never "has the key"');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha');
  /* THE READER IS NOT ASSUMED. Its first cut merged self-closing empty cells
   * and made a correct H1 template look like it had lost four columns, which
   * would have put a fabricated defect in a ticket. */
  const { sheetRows } = require('../_kit/xlsx_read.js');
  const probe = sheetRows('<row r="2"><c r="A2" t="inlineStr"><is><t>x</t></is></c>' +
    '<c r="B2" s="2"/><c r="C2" s="2"/><c r="D2" t="inlineStr"><is><t>y</t></is></c></row>')[0];
  ok(Object.keys(probe).length === 4 && probe.B === '' && probe.D === 'y',
    'X2 the xlsx reader keeps blank cells distinct -- ' + JSON.stringify(probe));
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-274-r2-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
