/* CLCPA-274 round 3: the sub-header belongs to the TABLE, not to the year.
 *
 * BOTH PROVENANCES, REPRODUCED FIRST, which is the instruction this round was
 * written under and the reason round 2 shipped a half fix.
 *
 *   SEED 2025, before the fix       row2 = the four sub-labels        CORRECT
 *   USER-ADDED 2099, no data yet    row2 = the four sub-labels        CORRECT
 *   USER-ADDED 2099, WITH saved rows
 *                                   row2 = ["Borough Hall","Brooklyn",
 *                                           "607","","307","","2728"]  DEFECT
 *
 * Round 2 verified the no-data shape and stopped there. A year the operator
 * adds is created by IMPORT, so its rows are data from the first one and
 * nothing prepends the stored sub-header -- but ingestHeaderRowCount was
 * applied to whatever rows came back, so the first DATA row was emitted into
 * the header position the moment that year held anything.
 *
 * THE DERIVATION, and it is structural rather than a guess: a stored
 * sub-header row has a BLANK label column, because a column-heading row names
 * no row. Measured across the whole declared family -- F6 null, A9 and A10 ""
 * -- while every data row carries the label the importer keys on. So the
 * sub-header is taken from a year that carries it and the source year
 * contributes only data, skipping the header rows it happens to hold.
 *
 * BASE predates the change: acbd12c, main at the deploy of 3b20bdbd6d.
 *
 * Run:  node suite_274_r3.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { boot } = require('../_kit/live_editor.js');
const { templateRows, dense } = require('../_kit/xlsx_read.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || 'acbd12c';
/* PINNED ON BOTH SIDES (CLAUDE.md). This suite asserts what ROUND 3 did to a
 * predicate ROUND 4 has since changed: an all-empty row is no longer read as a
 * header, because that is how the operator's first Add Row was consumed. Round
 * 3's claim is history and is true at the commit that made it, so the
 * post-change side reads that build rather than live main. DAC_APP_OVERRIDE
 * still wins, so the mutation runner keeps working. */
const NEWREV = process.env.DAC_NEW_COMMIT || '771e008';
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

const F6CSV = 'Network or Load Area,Borough / County,NON-NETWORK,,NETWORK,,Grand Total\n' +
  'Borough Hall,Brooklyn,607,907,307,907,2728\n';

/** a year the OPERATOR added, created by import and saved, like the audit's */
function userAddedWithData(src, tableId, year, csv) {
  const H = boot({ payload: JSON.parse(JSON.stringify(P)), tableId: tableId, year: '2025', src: src });
  H.openAddYear();
  H.setDialogYear(year);
  H.stageFile(tableId + '-' + year + '.csv', csv);
  H.doc.body.querySelector('[data-act="addyear"]').dispatchEvent({ type: 'click' });
  H.api.openSaveModal();
  const c = H.doc.body.querySelector('#ingest-modal-confirm');
  if (c) c.dispatchEvent({ type: 'click' });
  return H;
}
const tmplOf = (H, id, y) => templateRows(H.api.buildIngestWorkbook(id, y)).map(dense);
const SUBLABELS = ['', '', 'Non- Excludable', 'Excludable', 'Non- Excludable', 'Excludable', ''];

log('======================================================================');
log('CLCPA-274 round 3 -- the sub-header is the table\'s, not the year\'s');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. provenance, and that the harness can tell them apart ------------ */
log('');
log('A. THE TWO PROVENANCES');
guard('A-block', () => {
  const H = boot({ payload: JSON.parse(JSON.stringify(P)), tableId: 'F6', year: '2025', src: SRC });
  ok(H.provenance('2025') === 'seed', 'A1 2025 is a SEED year -- the published report shipped it');
  H.addYear('2099');
  ok(H.provenance('2099') === 'user-added',
    'A2 2099 is USER-ADDED -- registered in the store, not in meta at boot');
  ok(((H.state().payload.tables.F6.data || {})['2099'] || []).length === 0,
    'A3 and it starts with NO stored rows, which is why round 2 never saw this');
});

/* ---- B. the defect, on BASE, on the provenance that has it -------------- */
log('');
log('B. THE DEFECT, ON THE BUILD THAT SHIPPED IT');
guard('B: user-added WITH data', () => {
  const H = userAddedWithData(BASE_SRC, 'F6', '2099', F6CSV);
  const stored = (H.state().payload.tables.F6.data || {})['2099'] || [];
  ok(stored.length === 1, 'B1 2099 now holds one saved row -- ' + JSON.stringify(stored[0]));
  const r = tmplOf(H, 'F6', '2099');
  ok(r[1][0] === 'Borough Hall',
    'B2 and BASE emits that DATA row into the sub-header position -- ' + JSON.stringify(r[1]));
  ok(r[1].some(v => /^\d+$/.test(String(v))),
    'B3 so row 2 carries NUMBERS where four column labels belong');
});
guard('B: the shapes BASE got right, so the cause is provenance not the table', () => {
  const seed = tmplOf(boot({ payload: JSON.parse(JSON.stringify(P)), tableId: 'F6',
    year: '2025', src: BASE_SRC }), 'F6', '2025');
  ok(JSON.stringify(seed[1]) === JSON.stringify(SUBLABELS),
    'B4 a SEED year was already correct on BASE');
  const H = boot({ payload: JSON.parse(JSON.stringify(P)), tableId: 'F6', year: '2025', src: BASE_SRC });
  H.addYear('2098');
  ok(JSON.stringify(tmplOf(H, 'F6', '2098')[1]) === JSON.stringify(SUBLABELS),
    'B5 and so was a user-added year with NO data -- exactly what round 2 verified');
});

/* ---- C. the fix, on every provenance ------------------------------------ */
log('');
log('C. THE SUB-LABELS ARE THERE, WHATEVER THE YEAR HOLDS');
guard('C-block', () => {
  const H = userAddedWithData(SRC, 'F6', '2099', F6CSV);
  const r = tmplOf(H, 'F6', '2099');
  ok(JSON.stringify(r[1]) === JSON.stringify(SUBLABELS),
    'C1 user-added WITH data: row 2 is the four sub-labels -- ' + JSON.stringify(r[1]));
  ok(r[2][0] === 'Borough Hall', 'C2 and the data row moved to row 3 -- ' + JSON.stringify(r[2][0]));
  ok(r.length === 3, 'C3 emitted once, not twice: ' + r.length + ' rows for one saved row');
  const H2 = boot({ payload: JSON.parse(JSON.stringify(P)), tableId: 'F6', year: '2025', src: SRC });
  H2.addYear('2098');
  ok(JSON.stringify(tmplOf(H2, 'F6', '2098')[1]) === JSON.stringify(SUBLABELS),
    'C4 user-added with NO data still correct');
  ok(JSON.stringify(tmplOf(boot({ payload: JSON.parse(JSON.stringify(P)), tableId: 'F6',
    year: '2025', src: SRC }), 'F6', '2025')[1]) === JSON.stringify(SUBLABELS),
    'C5 and the seed year is unchanged');
});

/* ---- D. the rest of the family and everyone else ------------------------ */
log('');
log('D. NOTHING ELSE MOVED');
guard('D-block', () => {
  let changed = [];
  ['A9', 'A10', 'F6', 'H1', 'B2', 'F2', 'F4', 'F5', 'F7', 'D1'].forEach((id) => {
    const a = JSON.stringify(tmplOf(boot({ payload: P, tableId: id, year: '2025', src: SRC }), id, '2025'));
    const b = JSON.stringify(tmplOf(boot({ payload: P, tableId: id, year: '2025', src: BASE_SRC }), id, '2025'));
    if (a !== b) changed.push(id);
  });
  ok(changed.length === 0,
    'D1 every SEED-year template is byte-identical to BASE -- ' +
    (changed.length ? changed.join(',') : 'all 10'));
  /* and the other two-level tables get the same protection on a fresh year */
  ['A9', 'A10'].forEach((id) => {
    const H = boot({ payload: JSON.parse(JSON.stringify(P)), tableId: id, year: '2025', src: SRC });
    H.addYear('2097');
    const stored = P.tables[id].data['2025'][0];
    const r = tmplOf(H, id, '2097');
    ok(JSON.stringify(r[1].map(v => (v === '' ? null : v))) ===
       JSON.stringify(stored.map(v => (v == null || v === '' ? null : String(v)))),
      'D2.' + id + ' borrows its sub-header onto a user-added year -- ' +
      JSON.stringify(r[1]).slice(0, 56));
  });
});

/* ---- E. the derivation, and that it is one ------------------------------ */
log('');
log('E. THE RULE, AND WHERE IT LIVES');
guard('E-block', () => {
  const code = codeOnly(SRC);
  ok(/function ingestRowIsStoredHeader\(row\) \{/.test(code),
    'E1 "is this row a stored header" is a named function');
  ok(/function ingestYearCarriesHeaderRows\(rows, headerCount\) \{/.test(code),
    'E2 so is "does this year carry them"');
  ok(/function ingestStoredHeaderRows\(table, headerCount\) \{/.test(code),
    'E3 and "where do the table\'s own header rows live"');
  /* the test is the LABEL column, not a table name and not a row index */
  ok(/return label == null \|\| String\(label\)\.trim\(\) === '';/.test(code),
    'E4 the test is the blank label column');
  const ids = ['F6', 'A9', 'A10'].filter(id =>
    new RegExp("['\"]" + id + "['\"]").test(
      /function ingestStoredHeaderRows[\s\S]*?\n  \}/.exec(code)[0]));
  ok(ids.length === 0, 'E5 and no table is named anywhere in it');
  /* the writer takes the header from the table and the data from the year */
  ok(/const headerRows = ingestStoredHeaderRows\(table, headerCount\);/.test(code),
    'E6 the writer emits the TABLE\'s header rows');
  ok(/const skip = ingestYearCarriesHeaderRows\(src\.rows, headerCount\) \? headerCount : 0;/.test(code),
    'E7 and skips them in the source year rather than emitting them twice');
});

/* ---- F. the structural property this rests on --------------------------- */
log('');
log('F. THE PROPERTY, MEASURED ON THE PAYLOAD');
guard('F-block', () => {
  let heads = 0, dataRows = 0, bad = [];
  ['A9', 'A10', 'F6'].forEach((id) => {
    const t = P.tables[id];
    Object.keys(t.data || {}).forEach((y) => {
      const rows = t.data[y] || [];
      if (!rows.length) return;
      const l0 = rows[0][0];
      if (l0 == null || String(l0).trim() === '') heads++; else bad.push(id + ':' + y);
      rows.slice(1).forEach((r) => {
        const l = r[0];
        if (l != null && String(l).trim() !== '') dataRows++;
      });
    });
  });
  ok(bad.length === 0,
    'F1 every stored sub-header in the declared family has a blank label -- ' +
    heads + ' rows' + (bad.length ? ', except ' + bad.join(',') : ''));
  ok(dataRows > 50, 'F2 while ' + dataRows + ' data rows below them carry labels');
  /* a ONE-level table must not be caught by it */
  ok(ingestHeaderCountOf('H1') === 0 && ingestHeaderCountOf('D1') === 0,
    'F3 and a one-level table has no header rows to borrow at all');
  function ingestHeaderCountOf(id) {
    const H = boot({ payload: P, tableId: id, year: '2025', src: SRC });
    return H.api.ingestHeaderRowCount(P.tables[id], 99);
  }
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha');
  /* THE PROVENANCE MUST BE REAL. Every reproduction before this round ran on a
   * seed year because payload.json holds nothing else, and that is exactly how
   * two defects in a row were verified green and shipped broken. */
  const H = userAddedWithData(SRC, 'F6', '2099', F6CSV);
  ok(H.provenance('2099') === 'user-added',
    'X2 the year under test really is user-added, not a seed year renamed');
  ok(((H.state().payload.tables.F6.data || {})['2099'] || []).length > 0,
    'X3 and it really holds saved rows, which is the shape that breaks');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-274-r3-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
