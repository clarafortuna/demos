/* CLCPA-281 round 2: an all-empty row is body data, never header structure.
 *
 * THE OWNER'S GESTURE SEQUENCE, reproduced in a REAL BROWSER against a served
 * build before any code, and re-run after it. The Node bench cannot see this:
 * every symptom is a rendered one.
 *
 *   F6, fresh user-added year 2099, PRE-FIX
 *     a. grid at 0 rows        both header rows visible, sub-labels present
 *     b. click Add Row ONCE    the SECOND HEADER ROW GOES BLANK,
 *                              0 editable rows, status says Unsaved Changes
 *     c. click Add Row again   1 editable row appears, the first click's row
 *                              rides the draft as a phantom
 *
 * TWO DEFECTS, and either alone leaves the bug standing.
 *
 *   1. ingestRowIsStoredHeader tested only the blank LABEL column -- which a
 *      freshly added, untyped row also has. So the new row was consumed as
 *      anatomy and the real sub-header was displaced.
 *   2. headerRowCount was min(header_levels - 1, draft.length), so a draft of
 *      one row counted that row as header and the BODY skipped it. The header
 *      renderer already asked the right question through
 *      ingestYearCarriesHeaderRows; the body did not, and the two disagreed
 *      about the same draft.
 *
 * This suite proves the logic half. The gesture half is in the PR, per step,
 * as rendered DOM readings -- suite output is no longer sufficient on its own.
 *
 * BASE predates the change: c98ccb1, main at the deploy of fcc9fa30bd.
 *
 * Run:  node suite_281_r2.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { boot } = require('../_kit/live_editor.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || 'c98ccb1';
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

const EMPTY_ROW = [null, null, null, null, null, null, null];
const SUBHDR = P.tables.F6.data['2025'][0];

/** F6 on a user-added year whose draft is exactly `rows` */
const withDraft = (src, rows) => {
  const pay = JSON.parse(JSON.stringify(P));
  pay.tables.F6.data['2099'] = rows.map(r => r.slice());
  pay.meta.years = ['2099'].concat(pay.meta.years);
  return boot({ payload: pay, tableId: 'F6', year: '2099', src: src });
};
const headRows = (H) => H.doc.querySelectorAll('thead tr').length;
const headSecond = (H) => {
  const tr = H.doc.querySelectorAll('thead tr')[1];
  return tr ? tr.querySelectorAll('th').map(t => t.textContent.trim()) : null;
};
const editableRows = (H) => H.doc.querySelectorAll('tbody tr')
  .filter(tr => tr.querySelectorAll('input.ingest-cell').length).length;

log('======================================================================');
log('CLCPA-281 round 2 -- an all-empty row is data, not anatomy');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the predicate itself -------------------------------------------- */
log('');
log('A. WHAT COUNTS AS A STORED HEADER ROW');
guard('A-block', () => {
  const H = withDraft(SRC, [SUBHDR]);
  const f = H.api.ingestRowIsStoredHeader;
  ok(typeof f === 'function', 'A0 the predicate is reachable');
  ok(f(SUBHDR) === true,
    'A1 the real sub-header still qualifies -- ' + JSON.stringify(SUBHDR).slice(0, 52));
  ok(f(EMPTY_ROW) === false,
    'A2 an ALL-EMPTY row does NOT: it names no column');
  ok(f([null, null, '', '  ', null, null, null]) === false,
    'A3 nor one whose headings are blank or whitespace');
  ok(f(['Test Row', null, 5677, null, 88888, null, null]) === false,
    'A4 nor a data row, which has a label');
  ok(f([null, null, 'Excludable', null, null, null, null]) === true,
    'A5 ONE heading is enough -- a partial sub-header is still a sub-header');
  /* the BASE build accepted the empty row, which is the whole defect */
  const B = withDraft(BASE_SRC, [SUBHDR]);
  ok(B.api.ingestRowIsStoredHeader(EMPTY_ROW) === true,
    'A6 on BASE the same empty row WAS accepted as a header');
});

/* ---- B. the defect, as the grid renders it ------------------------------ */
log('');
log('B. THE DEFECT, ON THE BUILD THAT SHIPPED IT');
guard('B-block', () => {
  /* the draft after the owner's ONE Add Row click on a fresh year */
  const B = withDraft(BASE_SRC, [EMPTY_ROW]);
  ok(headRows(B) === 2, 'B1 BASE still draws two header rows');
  ok(headSecond(B).every(v => v === ''),
    'B2 but the second is BLANK -- the new row displaced it: ' +
    JSON.stringify(headSecond(B)));
  ok(editableRows(B) === 0,
    'B3 and NO editable row is rendered: the click produced nothing visible');
});

/* ---- C. the fix, one click at a time ------------------------------------ */
log('');
log('C. EACH ADD ROW APPENDS EXACTLY ONE VISIBLE ROW');
guard('C-block', () => {
  const none = withDraft(SRC, []);
  ok(headRows(none) === 2 && headSecond(none)[2] === 'Non- Excludable',
    'C1 at zero rows both header levels are drawn, borrowed from the table');
  ok(editableRows(none) === 0, 'C2 and no editable rows');
  [1, 2, 3].forEach((n) => {
    const rows = [];
    for (let k = 0; k < n; k++) rows.push(EMPTY_ROW.slice());
    const H = withDraft(SRC, rows);
    ok(headRows(H) === 2 && H.doc.querySelectorAll('thead tr')[1]
      .querySelectorAll('th').map(t => t.textContent.trim())[2] === 'Non- Excludable',
      'C3.' + n + ' after ' + n + ' added row(s) the sub-labels are still there');
    ok(editableRows(H) === n,
      'C4.' + n + ' and exactly ' + n + ' editable row(s) render -- got ' + editableRows(H));
  });
});

/* ---- D. the persisted residue renders as data --------------------------- */
log('');
log('D. THE PHANTOM ROW ALREADY IN F6/2099');
guard('D-block', () => {
  const H = withDraft(SRC, [EMPTY_ROW, ['Test Row', null, 5677, null, 88888, null, null]]);
  ok(headSecond(H)[2] === 'Non- Excludable',
    'D1 the sub-header is the table\'s, not the empty row');
  ok(editableRows(H) === 2, 'D2 both stored rows render as editable data rows');
  const first = H.doc.querySelectorAll('tbody tr')[0];
  ok(first.querySelectorAll('input.ingest-cell').length > 0,
    'D3 the empty row is a harmless visible EMPTY DATA ROW');
  ok(first.querySelectorAll('.ingest-row-delete').length === 1,
    'D4 carrying a delete control, so the owner can remove it -- 224 residue');
  const second = H.doc.querySelectorAll('tbody tr')[1]
    .querySelectorAll('input').map(i => i.value);
  ok(second[0] === 'Test Row', 'D5 and Test Row follows it -- ' + JSON.stringify(second.slice(0, 2)));
});

/* ---- E. seed years and one-level tables untouched ----------------------- */
log('');
log('E. NOTHING ELSE MOVED');
guard('E-block', () => {
  ['F6', 'A9', 'A10'].forEach((id) => {
    const now = boot({ payload: P, tableId: id, year: '2025', src: SRC });
    const was = boot({ payload: P, tableId: id, year: '2025', src: BASE_SRC });
    ok(headRows(now) === 2 && headRows(was) === 2,
      'E1.' + id + ' a seed year still draws two header rows');
    ok(editableRows(now) === editableRows(was),
      'E2.' + id + ' with the same body count -- ' + editableRows(now));
  });
  ['H1', 'B2', 'D1'].forEach((id) => {
    const now = boot({ payload: P, tableId: id, year: '2025', src: SRC });
    ok(headRows(now) === 1, 'E3.' + id + ' a one-level table still draws one');
  });
});

/* ---- F. one question, asked once ---------------------------------------- */
log('');
log('F. THE TWO READERS AGREE');
guard('F-block', () => {
  const code = codeOnly(SRC);
  ok(/return row\.slice\(1\)\.some\(v => v != null && String\(v\)\.trim\(\) !== ''\);/.test(code),
    'F1 the predicate requires a heading, not just a blank label');
  ok(/const declaredHeaderRows = ingestHeaderRowCount\(table, Infinity\);/.test(code),
    'F2 the editor asks what the TABLE declares');
  ok(/const headerRowCount = ingestYearCarriesHeaderRows\(i\.draft, declaredHeaderRows\)\s*\r?\n?\s*\? declaredHeaderRows : 0;/.test(code),
    'F3 then asks whether THIS DRAFT carries them, which is the other question');
  ok(!/ingestHeaderRowCount\(table, i\.draft\.length\)/.test(code),
    'F4 and no longer measures the draft by its LENGTH');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha');
  /* THIS SUITE PROVES LOGIC ONLY. The gestures are in the PR, driven in
   * Chrome, because three hosted FAILs shipped green out of this bench. */
  ok(fs.existsSync(path.join(REPO, 'Coned/CLCPA/tickets/_kit/cdp.js')) &&
     fs.existsSync(path.join(REPO, 'Coned/CLCPA/tickets/_kit/live_browser.js')),
    'X2 the browser driver exists and the gesture evidence comes from it');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-281-r2-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
