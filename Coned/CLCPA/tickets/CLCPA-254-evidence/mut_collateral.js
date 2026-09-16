/* Mutation controls for group E's COLLATERAL re-pins.
 *
 * Group E turned twenty-two sibling suites red. Nineteen were census maps and
 * counts, which are self-guarding: an unnamed function fails the map and a
 * wrong count fails the tally. The other five re-pins are new logic, and new
 * logic in a harness is exactly where a guard goes quietly inert:
 *
 *   suite_244 S7 / suite_245 X4 -- "recomputeTotals is byte-identical" became
 *   "byte-identical ONCE CLCPA-254's exception is undone". A substitution that
 *   swallowed more than that one exception would pass for any later edit.
 *
 *   suite_badge -- the same shape on renderIngestImportResult, protecting the
 *   CLCPA-234 panel text Emely approved verbatim.
 *
 *   suite_240a_r2 / r3 -- onlyTheTotalRowX, a predicate that lets a table
 *   differ from BASE by the total row's delete button AND NOTHING ELSE. If it
 *   were loose, forty editor tables would stop being compared at all.
 *
 * Each mutation below changes something those pins must NOT forgive, and must
 * turn its suite red on the named assertion. Ends with a CLEAN re-run against
 * byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const T = REPO + '/Coned/CLCPA/tickets';
const APP = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js';

const M = [
  /* ---- the recomputeTotals substitution is NARROW ----------------------- */
  { name: 'a SECOND edit lands in recomputeTotals, outside CLCPA-254s exception',
    from: '        if (!sums.colHasNum[c]) continue;             // nothing to sum: keep stored',
    to:   '        if (!sums.colHasNum[c]) continue;             // nothing to sum: keep it',
    runs: [
      { dir: 'CLCPA-244-evidence', suite: 'suite_244.js',
        expect: 'S7 recomputeTotals is byte-identical once CLCPA-254s declared-summable' },
      { dir: 'CLCPA-245-evidence', suite: 'suite_245.js',
        expect: 'X4 recomputeTotals is byte-identical once CLCPA-254s exception is undone' },
    ] },
  { name: 'CLCPA-254s exception is written TWICE, so undoing one leaves one',
    from: '        if ((pctCol[c] || avgCol[c]) &&\r\n            !isDeclaredSummable(tableId, schema[c])) continue;',
    to:   '        if ((pctCol[c] || avgCol[c]) &&\r\n            !isDeclaredSummable(tableId, schema[c])) continue;\r\n' +
          '        if ((pctCol[c] || avgCol[c]) &&\r\n            !isDeclaredSummable(tableId, schema[c])) continue;',
    /* the anchor count assertion is what sees this, and it is there because a
     * one-shot String.replace on a doubled block would silently undo half */
    runs: [
      { dir: 'CLCPA-244-evidence', suite: 'suite_244.js',
        expect: 'S7 recomputeTotals is byte-identical once CLCPA-254s declared-summable' },
    ] },

  /* ---- the CLCPA-234 panel text is still protected ---------------------- */
  { name: 'the CLCPA-234 panel text Emely approved verbatim is reworded',
    from: "      '<p>Review the values below, then press Save. Nothing has been saved yet.</p>' +",
    to:   "      '<p>Review the values below, then press Save. Nothing is saved yet.</p>' +",
    runs: [
      { dir: 'badge-title-case-evidence', suite: 'suite_badge.js',
        expect: 'the import result panel is unchanged by this round once CLCPA-261s unit notice is undone' },
    ] },

  /* ---- onlyTheTotalRowX forgives the x AND NOTHING ELSE ----------------- */
  { name: 'a SECOND change lands in the editor row, alongside the missing x',
    from: '      return `<tr${rowCls} data-row="${rowIdx}">',
    to:   '      return `<tr${rowCls} data-rowx="1" data-row="${rowIdx}">',
    runs: [
      { dir: 'CLCPA-240-evidence', suite: 'suite_240a_r2.js',
        expect: 'F2 every one is byte-identical to BASE, or differs by CLCPA-255s total-row x alone' },
      { dir: 'CLCPA-240-evidence', suite: 'suite_240a_r3.js',
        expect: 'F2 every one is byte-identical to BASE, or differs by CLCPA-255s total-row x alone' },
    ] },
  { name: 'the x is taken off EVERY row, not the recognised total row',
    from: "        <td class=\"ingest-td-actions\">${(isHeaderRow || lockTotalRow || isTotal) ? ''",
    to:   "        <td class=\"ingest-td-actions\">${true ? ''",
    /* every row loses its button, so the predicate's row-by-row substitution
     * still matches -- what catches it is the claim that the rows AROUND the
     * total keep theirs, which is what says a ROW was recognised. */
    runs: [
      { dir: 'CLCPA-240-evidence', suite: 'suite_240a_r2.js',
        expect: 'F5b while the body rows around it still carry theirs' },
      { dir: 'CLCPA-240-evidence', suite: 'suite_240a_r3.js',
        expect: 'F4c and the body rows around it still carry theirs' },
    ] },
  { name: 'CLCPA-255 is reverted, so nothing differs and the bucket empties',
    from: "        <td class=\"ingest-td-actions\">${(isHeaderRow || lockTotalRow || isTotal) ? ''",
    to:   "        <td class=\"ingest-td-actions\">${(isHeaderRow || lockTotalRow) ? ''",
    /* the pin that must NOT pass quietly as "nothing differed" */
    runs: [
      { dir: 'CLCPA-240-evidence', suite: 'suite_240a_r2.js',
        expect: 'F2b and CLCPA-255s total rows are the tables that differ' },
      { dir: 'CLCPA-240-evidence', suite: 'suite_240a_r3.js',
        expect: 'F2b and CLCPA-255s total rows are the tables that differ' },
    ] },

  /* ---- the seeded dependency is a REAL dependency ----------------------- */
  { name: 'buildIngestImport stops asking which columns are percentage columns',
    from: '        if (/^\\s*[-+]?[\\d.,]+\\s*%\\s*$/.test(String(raw)) && !pctCols[cIdx]) {',
    to:   '        if (false && !pctCols[cIdx]) {',
    /* suite_85_ui drives the real staging path end to end, so a notice that
     * stops being raised shows up as the summary line it prints. */
    runs: [
      { dir: 'CLCPA-254-evidence', suite: 'suite_254_255_261.js',
        expect: 'N2 and three cells are noticed' },
    ] },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('Section C group E -- COLLATERAL mutation controls');
log('======================================================================');

let caught = 0, missed = 0;
M.forEach((m) => {
  const base = fs.readFileSync(APP, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const n = base.split(m.from).length - 1;
  if (n !== 1) { log('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED'); missed++; return; }
  fs.writeFileSync(APP, base.replace(m.from, () => m.to));
  log('  --   ' + m.name);
  let allRed = true;
  m.runs.forEach((r) => {
    let out = '';
    try { out = execFileSync('node', [r.suite], { cwd: T + '/' + r.dir, encoding: 'utf8' }); }
    catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
    const fails = (out.match(/^  FAIL .*$/gm) || []);
    const hit = fails.filter(l => l.indexOf(r.expect) >= 0);
    if (hit.length) log('       red  ' + r.suite + ' -- ' + hit[0].trim().slice(5, 96));
    else if (fails.length) {
      allRed = false;
      log('       ???  ' + r.suite + ' -- ' + fails.length + ' red, not the expected one');
      log('            want: ' + r.expect);
      log('            got : ' + fails[0].trim().slice(5, 96));
    } else { allRed = false; log('       GREEN ' + r.suite + ' -- NOT NOTICED. Not a guard.'); }
  });
  fs.writeFileSync(APP, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(APP, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }
  if (allRed) caught++; else missed++;
});

log('');
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length + ' mutations');
/* THE CLEAN RE-RUN, against byte-restored source, on every suite this runner
 * touched. A mutation runner that does not end here has left the evidence
 * describing a mutated file. */
const CLEAN = [
  ['CLCPA-244-evidence', 'suite_244.js'], ['CLCPA-245-evidence', 'suite_245.js'],
  ['badge-title-case-evidence', 'suite_badge.js'],
  ['CLCPA-240-evidence', 'suite_240a_r2.js'], ['CLCPA-240-evidence', 'suite_240a_r3.js'],
  ['CLCPA-254-evidence', 'suite_254_255_261.js'],
];
let dirty = 0;
CLEAN.forEach(([d, s]) => {
  let out = '';
  try { out = execFileSync('node', [s], { cwd: T + '/' + d, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  const t = /(\d+) passed, (\d+) failed/.exec(out) || [];
  if (t[2] !== '0') dirty++;
  log('  clean re-run ' + s + ': ' + (t[2] === '0' ? 'PASSES' : 'FAILS') +
      ' -- ' + (t[0] || 'no tally'));
});
log('  clean re-run against byte-restored source: ' + (dirty ? 'FAILS' : 'ALL PASS'));
fs.writeFileSync(__dirname + '/mut-collateral-output.txt', lines.join('\n') + '\n');
process.exit(missed || dirty ? 1 : 0);
