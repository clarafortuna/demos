const _dacRepo = () => {
  const p = require('path'), f = require('fs');
  if (process.env.DAC_REPO) return p.resolve(process.env.DAC_REPO);
  let d = __dirname;
  for (let i = 0; i < 16; i++) {
    if (f.existsSync(p.join(d, '.clcpa-root'))) {
      const two = p.resolve(d, '..', '..');
      return f.existsSync(p.join(two, '.git')) ? two : d;
    }
    const u = p.dirname(d); if (u === d) break; d = u;
  }
  throw new Error('CLCPA project root not found above ' + __dirname + '; set DAC_REPO');
};
/* CLCPA-281: the editor renders the second header row, in the header.
 *
 * LIVE REPRODUCTION FIRST, on BOTH provenances, through the real page.
 *
 *   F6 seed 2025, BASE       thead rows = 1
 *                            the four sub-labels rendered as the first BODY
 *                            row -- read-only since CLCPA-233, but sitting in
 *                            the data area, so the four value columns are
 *                            indistinguishable in the grid
 *   F6 user-added 2099, BASE the same, and the year carries no sub-header of
 *                            its own at all
 *   A9 / A10, BASE           worse: the top row collapses to one "2024" and
 *                            one "2025" with the Total/DAC detail in the body
 *
 * The section page has always drawn both levels. The editor never did.
 *
 * THE FIX reads the same anatomy the writer uses, through the helpers
 * CLCPA-274 round 3 extracted: how many header rows the table declares, and
 * where they live when the open year does not carry them. Display structure
 * only -- the row stays exactly where it is in the store, and nothing here
 * writes.
 *
 * BASE predates the change: 771e008, CLCPA-274 round 3.
 *
 * Run:  node suite_281.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { boot } = require('../_kit/live_editor.js');

const REPO = _dacRepo() + '';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || '771e008';
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

const open = (src, id, y) => boot({ payload: JSON.parse(JSON.stringify(P)), tableId: id, year: y, src: src });
const headRows = (H) => H.doc.querySelectorAll('thead tr');
const headTexts = (H, n) => {
  const r = headRows(H)[n];
  return r ? r.querySelectorAll('th').map(t => t.textContent.trim()) : null;
};
const bodyCount = (H) => H.doc.querySelectorAll('tbody tr').length;
const TWO_LEVEL = ['F6', 'A9', 'A10'];
const ONE_LEVEL = ['H1', 'B2', 'D1', 'F7'];

log('======================================================================');
log('CLCPA-281 -- the editor draws both header levels');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the defect, on BASE, both provenances --------------------------- */
log('');
log('A. THE DEFECT, ON THE BUILD THAT SHIPPED IT');
guard('A: seed year', () => {
  TWO_LEVEL.forEach((id) => {
    const H = open(BASE_SRC, id, '2025');
    ok(headRows(H).length === 1,
      'A1.' + id + ' BASE draws ONE header row for a two-level table');
  });
  const H = open(BASE_SRC, 'F6', '2025');
  const firstBody = H.doc.querySelectorAll('tbody tr')[0];
  const txt = firstBody.querySelectorAll('td').map(d => d.textContent.trim());
  ok(txt.indexOf('Non- Excludable') >= 0,
    'A2 and the sub-labels are in the BODY instead -- ' + JSON.stringify(txt.slice(0, 5)));
});
guard('A: user-added year', () => {
  const H = open(BASE_SRC, 'F6', '2025');
  H.addYear('2099');
  ok(H.provenance('2099') === 'user-added', 'A3 2099 is user-added');
  ok(headRows(H).length === 1, 'A4 and BASE draws one header row there too');
  ok(((H.state().payload.tables.F6.data || {})['2099'] || []).length === 0,
    'A5 while that year carries no sub-header row of its own at all');
});

/* ---- B. the fix, seed years --------------------------------------------- */
log('');
log('B. BOTH LEVELS, ON A SEED YEAR');
guard('B-block', () => {
  TWO_LEVEL.forEach((id) => {
    const H = open(SRC, id, '2025');
    ok(headRows(H).length === 2, 'B1.' + id + ' draws TWO header rows');
    const stored = P.tables[id].data['2025'][0];
    const want = stored.map(v => (v == null ? '' : String(v).trim()));
    const got = headTexts(H, 1).slice(0, want.length);
    ok(JSON.stringify(got) === JSON.stringify(want),
      'B2.' + id + ' the second row is the stored sub-header -- ' +
      JSON.stringify(got).slice(0, 62));
  });
  /* and it left the body */
  const now = open(SRC, 'F6', '2025'), was = open(BASE_SRC, 'F6', '2025');
  ok(bodyCount(now) === bodyCount(was) - 1,
    'B3 the body has exactly one row fewer -- ' + bodyCount(was) + ' to ' + bodyCount(now));
  const first = now.doc.querySelectorAll('tbody tr')[0]
    .querySelectorAll('td').map(d => d.textContent.trim());
  ok(first.indexOf('Non- Excludable') < 0,
    'B4 and the first body row is no longer the sub-header');
});

/* ---- C. the fix, a user-added year -------------------------------------- */
log('');
log('C. AND ON A YEAR THE OPERATOR ADDED');
guard('C-block', () => {
  const H = open(SRC, 'F6', '2025');
  H.addYear('2099');
  ok(headRows(H).length === 2, 'C1 a user-added year still gets both levels');
  const stored = P.tables.F6.data['2025'][0].map(v => (v == null ? '' : String(v).trim()));
  const got = headTexts(H, 1).slice(0, stored.length);
  ok(JSON.stringify(got) === JSON.stringify(stored),
    'C2 borrowing the table\'s sub-header, since that year has none -- ' +
    JSON.stringify(got).slice(0, 58));
  ok(bodyCount(H) === 0, 'C3 with no body rows, because the year is empty');
});

/* ---- D. one-level tables are untouched ---------------------------------- */
log('');
log('D. NOBODY ELSE GAINS A HEADER ROW');
guard('D-block', () => {
  ONE_LEVEL.forEach((id) => {
    const now = open(SRC, id, '2025'), was = open(BASE_SRC, id, '2025');
    ok(headRows(now).length === 1, 'D1.' + id + ' still draws one header row');
    ok(bodyCount(now) === bodyCount(was),
      'D2.' + id + ' and the same number of body rows -- ' + bodyCount(now));
  });
  /* D1 carries header_levels 0 and its first row is genuine, editable data */
  ok(P.tables.D1.header_levels === 0, 'D3 D1 really does carry header_levels 0');
  const d1 = open(SRC, 'D1', '2025');
  ok(d1.doc.querySelectorAll('tbody tr input.ingest-cell').length > 0,
    'D4 and its first row is still editable, not promoted to a header');
});

/* ---- E. the rows the handlers address ----------------------------------- */
log('');
log('E. THE CELL INDICES STILL POINT AT THE DRAFT');
guard('E-block', () => {
  const H = open(SRC, 'F6', '2025');
  const draft = H.draft();
  const cell = H.cell(1, 2);   /* draft row 1 = the first DATA row */
  ok(!!cell, 'E1 the first data row is addressable at its DRAFT index, not a renumbered one');
  ok(H.doc.querySelector('input[data-row="0"]') === null,
    'E2 while the header row offers no input at all');
  /* drive a real edit and confirm it lands on the row the index names */
  const before = JSON.stringify(draft[1]);
  cell.value = '4242';
  cell.dispatchEvent({ type: 'input' });
  cell.dispatchEvent({ type: 'blur' });
  ok(draft[1][2] === 4242,
    'E3 and an edit lands on draft row 1 -- was ' + before.slice(0, 40));
  ok(JSON.stringify(draft[0]) === JSON.stringify(P.tables.F6.data['2025'][0]),
    'E4 while the stored sub-header row in the draft is untouched');
});

/* ---- F. display only ----------------------------------------------------- */
log('');
log('F. DISPLAY STRUCTURE, NOT DATA');
guard('F-block', () => {
  const H = open(SRC, 'F6', '2025');
  const stored = JSON.stringify(P.tables.F6.data['2025']);
  ok(JSON.stringify(H.state().payload.tables.F6.data['2025']) === stored,
    'F1 nothing stored moved');
  ok(JSON.stringify(H.draft()[0]) === JSON.stringify(P.tables.F6.data['2025'][0]),
    'F2 and the sub-header is still row 0 of the draft, where the report reads it');
  const code = codeOnly(SRC);
  ok(/const subHeaderCells = \(\) => \{|const subHeaderCells = \(\(\) => \{/.test(code),
    'F3 the header cells are built in their own derivation');
  ok(/ingestHeaderRowCount\(table, Infinity\)/.test(code),
    'F4 which asks the SHARED count, not a per-table literal');
  ok(/ingestStoredHeaderRows\(table, count\)/.test(code),
    'F5 and the shared "where do they live" helper for a year without them');
  const block = /const subHeaderCells = [\s\S]*?\n    \}\)\(\);/.exec(code);
  ok(!!block && !/['"](?:F6|A9|A10)['"]/.test(block[0]),
    'F6 with no table named anywhere in it');
  ok(/if \(rowIdx < headerRowCount\) return '';/.test(code),
    'F7 and the body skips what the header now draws');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha');
  /* document.querySelectorAll used to return every node TWICE, because root is
   * appended into body and the kit queried both and concatenated. A grid with
   * 8 <th> reported 16, and every count in this suite would have been double. */
  const H = open(SRC, 'H1', '2025');
  const ths = H.doc.querySelectorAll('thead th');
  ok(ths.length === H.ingest().schema.length + 1,
    'X2 the kit counts each node once -- ' + ths.length + ' for ' +
    H.ingest().schema.length + ' columns plus the actions cell');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-281-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
