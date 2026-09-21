/* CLCPA-274 round 4: the template's sub-header survives a phantom empty row.
 *
 * THE OWNER'S GESTURE, hosted, F6 year 2099 which holds one saved data row
 * (Test Row, 5677 / 88888) plus a phantom empty row persisted by the defect
 * CLCPA-281 round 2 fixes:
 *
 *   a. download the template for F6/2099
 *   b. PRE-FIX: row 2 is BLANK -- the sub-labels are gone
 *   c. GREEN:   row 1 top headers, row 2 the four sub-labels, data below
 *
 * SAME ROOT CAUSE as CLCPA-281 round 2 and fixed in the same place: the
 * header-anatomy predicate accepted an all-empty row as a stored sub-header,
 * so the phantom row was read as anatomy by every consumer. The predicate now
 * requires a blank label AND at least one heading in the value positions.
 *
 * THE VALUE HALF WAS DEFERRED BY ROUND 4 AND HAS NOW BEEN RULED: option (c).
 *
 * Round 4 found that the template emitted row labels and blanked every value,
 * for every table and every year, by CLCPA-85's design -- H1/2025 rendered
 * "Manhattan" with no figures exactly as F6/2099 rendered "Test Row" with
 * none. That was not a defect, so round 4 did not change it; it PINNED it, so
 * the deferred decision could not be taken by accident.
 *
 * The owner has now taken it. A year that HOLDS data exports it; a fresh year
 * stays a blank form. Section C is re-pointed at that contract rather than
 * deleted, and the mutation that used to turn the template into an export now
 * turns it back into a blank form -- red either way, which is the point of
 * keeping it. Section E is re-pointed too: seed-year templates DO move now,
 * by design, and what must not move is the fresh-year form.
 *
 * The options record that carried the decision is
 * CLCPA-274-template-as-export-options.md.
 *
 * BASE predates the change: c98ccb1, main at the deploy of fcc9fa30bd.
 *
 * Run:  node suite_274_r4.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { boot } = require('../_kit/live_editor.js');
const { templateRows, dense, worksheets } = require('../_kit/xlsx_read.js');

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

const EMPTY = [null, null, null, null, null, null, null];
const TESTROW = ['Test Row', null, 5677, null, 88888, null, null];
const SUBLABELS = ['', '', 'Non- Excludable', 'Excludable', 'Non- Excludable', 'Excludable', ''];

/** F6 on the owner's 2099: a phantom empty row, then the saved data row */
const owners2099 = (src) => {
  const pay = JSON.parse(JSON.stringify(P));
  pay.tables.F6.data['2099'] = [EMPTY.slice(), TESTROW.slice()];
  pay.meta.years = ['2099'].concat(pay.meta.years);
  return boot({ payload: pay, tableId: 'F6', year: '2099', src: src });
};
const tmpl = (H, id, y) => templateRows(H.api.buildIngestWorkbook(id, y)).map(dense);

log('======================================================================');
log('CLCPA-274 round 4 -- the sub-header survives a phantom empty row');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the owner's download, on BASE ----------------------------------- */
log('');
log('A. THE DEFECT, ON THE BUILD THAT SHIPPED IT');
guard('A-block', () => {
  const r = tmpl(owners2099(BASE_SRC), 'F6', '2099');
  ok(r[1].every(v => v === '' || v === null),
    'A1 row 2 is BLANK on BASE -- ' + JSON.stringify(r[1]));
  ok(r[2] && r[2][0] === 'Test Row',
    'A2 and the data row follows it at row 3 -- ' + JSON.stringify(r[2]).slice(0, 48));
});

/* ---- B. the fix ---------------------------------------------------------- */
log('');
log('B. THE SUB-LABELS ARE THERE');
guard('B-block', () => {
  const r = tmpl(owners2099(SRC), 'F6', '2099');
  ok(JSON.stringify(r[1]) === JSON.stringify(SUBLABELS),
    'B1 row 2 is the four sub-labels -- ' + JSON.stringify(r[1]));
  ok(r[0][2] === 'NON-NETWORK' && r[0][4] === 'NETWORK',
    'B2 with the group spans above them in row 1');
  /* the phantom row is DATA now, so it takes a row of its own */
  ok(r[2] && r[2][0] === '', 'B3 the phantom empty row renders as an empty DATA row');
  ok(r[3] && r[3][0] === 'Test Row',
    'B4 and Test Row follows it -- ' + JSON.stringify(r[3][0]));
  ok(r.length === 4, 'B5 four rows in total: two header, two data -- ' + r.length);
});

/* ---- C. the value half: RE-PINNED to option (c), as ruled --------------- */
log('');
log('C. A POPULATED YEAR EXPORTS, A FRESH YEAR STAYS A BLANK FORM');
guard('C-block', () => {
  /* THE PIN IS NOT REMOVED, it is pointed at the contract that now holds.
   * Round 4 pinned "the template carries no stored values" so the deferred
   * decision could not be taken by accident. The owner has now taken it:
   * option (c). The same assertions, inverted, keep it from drifting back. */
  const r = tmpl(owners2099(SRC), 'F6', '2099');
  ok(r[3].indexOf('5677') >= 0 && r[3].indexOf('88888') >= 0,
    'C1 Test Row EXPORTS its stored values: 2099 holds data -- ' + JSON.stringify(r[3]));
  ok(r[3][r[3].length - 1] === '(calculated)',
    'C2 while its derivable column still carries the marker, not a figure');
  /* the same shape on tables nobody reported, which is what makes it design */
  [['H1', 'Manhattan'], ['B2', 'DAC'], ['F5', 'Bay Ridge']].forEach(([id, label]) => {
    const t = tmpl(boot({ payload: P, tableId: id, year: '2025', src: SRC }), id, '2025');
    const stored = P.tables[id].data['2025'][0];
    const storedVals = stored.slice(1)
      .filter(v => v != null && String(v).trim() !== '').map(String);
    const emitted = t[1].slice(1).map(String);
    const carried = storedVals.filter(v => emitted.indexOf(v) >= 0).length;
    ok(t[1][0] === label && carried > 0,
      'C3.' + id + ' label AND stored values emitted -- stored ' +
      JSON.stringify(stored).slice(0, 34) + ' -> ' + JSON.stringify(t[1]).slice(0, 44));
  });
  /* A FRESH YEAR IS STILL A BLANK FORM, which is the half of (c) that is
   * easy to lose: exporting a borrowed row would hand the operator last
   * year's figures presented as this year's. */
  const fresh = JSON.parse(JSON.stringify(P));
  fresh.meta.years = ['2094'].concat(fresh.meta.years);
  const f = tmpl(boot({ payload: fresh, tableId: 'H1', year: '2094', src: SRC }), 'H1', '2094');
  ok(f[1][0] === 'Manhattan' && f[1][1] === '' && f[1][2] === '',
    'C4 a fresh year emits labels and NO values -- ' + JSON.stringify(f[1]));
  ok(/a year that HAS data exports it; a\s+\*\s+fresh year stays a blank format/.test(SRC),
    'C5 and the code says which contract it is following');
  /* A NUMBER IS WRITTEN AS A NUMBER, and this is not cosmetic. Every cell was
   * t="inlineStr", which was harmless while the template emitted only labels
   * and markers. Under (c) a figure written as an inline string arrives in
   * Excel as TEXT: left-aligned, not summable, flagged as a number stored as
   * text. The CSV round trip would still work, so no assertion about the
   * round trip would have caught it -- the artefact handed to the operator is
   * what would have been wrong. */
  const wb = boot({ payload: P, tableId: 'H1', year: '2025', src: SRC })
    .api.buildIngestWorkbook('H1', '2025');
  const sheets = worksheets(wb.bytes);
  const xml = sheets[sheets.length - 1];
  const numeric = (xml.match(/<c r="[A-Z]+[0-9]+" s="[0-9]+"><v>/g) || []).length;
  ok(numeric === 8,
    'C6 H1/2025 writes its 8 value cells as NUMERIC cells, not inline strings -- ' + numeric);
  ok(/t="inlineStr"/.test(xml),
    'C7 while labels and markers stay inline strings, as they were');
  const freshWb = (function () {
    const f = JSON.parse(JSON.stringify(P));
    f.meta.years = ['2094'].concat(f.meta.years);
    return boot({ payload: f, tableId: 'H1', year: '2094', src: SRC })
      .api.buildIngestWorkbook('H1', '2094');
  })();
  const freshXml = worksheets(freshWb.bytes).slice(-1)[0];
  ok((freshXml.match(/<c r="[A-Z]+[0-9]+" s="[0-9]+"><v>/g) || []).length === 0,
    'C8 and a fresh year writes NO numeric cell at all');
});

/* ---- D. the other consumers of the same anatomy ------------------------- */
log('');
log('D. EVERY CONSUMER OF THAT YEAR\'S ANATOMY');
guard('D-block', () => {
  const H = owners2099(SRC);
  /* the editor grid, which CLCPA-281 round 2 covers in full */
  const second = H.doc.querySelectorAll('thead tr')[1];
  ok(!!second && second.querySelectorAll('th').map(t => t.textContent.trim())[2] === 'Non- Excludable',
    'D1 editor grid: the sub-header is the table\'s');
  ok(H.doc.querySelectorAll('tbody tr').length === 2,
    'D2 editor grid: both stored rows are body rows');
  /* the template writer, above */
  ok(tmpl(H, 'F6', '2099')[1][2] === 'Non- Excludable', 'D3 template writer: same answer');
  /* and the derivation they share */
  ok(H.api.ingestRowIsStoredHeader(EMPTY) === false,
    'D4 because the ONE predicate they both consume refuses an empty row');
  ok(H.api.ingestYearCarriesHeaderRows([EMPTY], 1) === false,
    'D5 so that year does not "carry" a header row it never had');
});

/* ---- E. what did NOT move ----------------------------------------------- */
log('');
log('E. A FRESH YEAR IS UNCHANGED');
guard('E-block', () => {
  /* Seed-year templates DO move now, by design: that is option (c). What
   * must not move is the fresh-year form, so the assertion is re-pointed
   * rather than deleted. */
  let changed = [];
  ['F6', 'A9', 'A10', 'H1', 'B2', 'F2', 'F4', 'F5', 'F7', 'D1'].forEach((id) => {
    const fresh = JSON.parse(JSON.stringify(P));
    fresh.meta.years = ['2094'].concat(fresh.meta.years);
    const a = JSON.stringify(tmpl(boot({ payload: fresh, tableId: id, year: '2094', src: SRC }), id, '2094'));
    const b = JSON.stringify(tmpl(boot({ payload: fresh, tableId: id, year: '2094', src: BASE_SRC }), id, '2094'));
    if (a !== b) changed.push(id);
  });
  /* RE-PINNED: A9 moves for CLCPA-289, which marks its "% Change" pair
   * (calculated) now that CLCPA-241 gave the column a rule. Named, so the
   * assertion still says exactly which templates may move and why. */
  /* RE-PINNED: CLCPA-308 marks a DERIVED ROW (calculated) too, and F7 declares
   * one. Named alongside A9 rather than the count relaxed. */
  ok(JSON.stringify(changed.slice().sort()) === JSON.stringify(['A9', 'F7']),
    'E1 every FRESH-year template is byte-identical to BASE except A9 (CLCPA-289) and F7 (CLCPA-308) -- ' +
    (changed.length ? changed.join(',') : 'all 10'));
  /* and the seed years moved in exactly one way: they gained values */
  let gained = 0;
  ['H1', 'B2', 'F5'].forEach((id) => {
    const a = tmpl(boot({ payload: P, tableId: id, year: '2025', src: SRC }), id, '2025');
    const b = tmpl(boot({ payload: P, tableId: id, year: '2025', src: BASE_SRC }), id, '2025');
    if (JSON.stringify(a) !== JSON.stringify(b)) gained++;
  });
  ok(gained === 3,
    'E2 and every POPULATED seed year did move, which is the ruling -- ' + gained + ' of 3');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha');
  ok(fs.existsSync(path.join(REPO,
    'Coned/CLCPA/tickets/CLCPA-274-template-as-export-options.md')),
    'X2 the deferred template-as-export decision is recorded, not lost');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-274-r4-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
