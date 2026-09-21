/* CLCPA-330 -- mutation controls.
 *
 * suite_330 is green. That is worth nothing until the suite is shown to go RED
 * when the guard it checks is broken, so each mutant below damages the shipped
 * narrowing in one specific way and the suite must catch it.
 *
 * NOTHING IS MUTATED IN PLACE. Each mutant is written to a temp copy of app.js
 * and the suite is pointed at it with DAC_APP_OVERRIDE, so the repository file
 * is never modified and a crash cannot leave a damaged app.js behind. An
 * earlier incident in this project restored 19 files by hand after in-place
 * edits; this avoids the class entirely.
 */
'use strict';

const _lines = [];
{ const _log = console.log; console.log = function () {
    const s = Array.prototype.join.call(arguments, ' ');
    _lines.push(s); _log.apply(console, arguments); }; }

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

function findRoot(start) {
  let d = start;
  for (;;) {
    if (fs.existsSync(path.join(d, '.clcpa-root'))) return d;
    const up = path.dirname(d);
    if (up === d) throw new Error('.clcpa-root not found above ' + start);
    d = up;
  }
}
const ROOT = findRoot(__dirname);
const APP = path.join(ROOT, 'ExecutiveDashboard_dev', 'app.js');
const SUITE = path.join(__dirname, 'suite_330.js');
const SRC = fs.readFileSync(APP, 'utf8');

const MUTANTS = [
  { name: 'THE NARROWING IS REMOVED from the money branch',
    from: 'if (currCols[colIdx] && rowIsCurrency(rowLabel)) {',
    to:   'if (currCols[colIdx]) {' },
  { name: 'EVERY ROW is currency, so the declaration decides nothing',
    from: '      if (!tableCurrRows) return true;   /* undeclared: the column decides, as before */',
    to:   '      return true;' },
  { name: 'NO ROW is currency, so declared money rows lose their $',
    from: '      if (!tableCurrRows) return true;   /* undeclared: the column decides, as before */',
    to:   '      return false;' },
  { name: 'THE DECLARATION IS NEVER READ off the table definition',
    from: '    const tableCurrRows = tableDef && Array.isArray(tableDef.currency_rows)',
    to:   '    const tableCurrRows = false && Array.isArray(tableDef.currency_rows)' },
  { name: 'MATCHING BECOMES CASE-SENSITIVE',
    from: "      return tableCurrRows.indexOf(String(rowLabel == null ? '' : rowLabel).trim().toLowerCase()) >= 0;",
    to:   "      return tableCurrRows.indexOf(String(rowLabel == null ? '' : rowLabel).trim()) >= 0;" },
  { name: 'DECLARED-BUT-EMPTY is treated as absent',
    from: '    const tableCurrRows = tableDef && Array.isArray(tableDef.currency_rows)',
    to:   '    const tableCurrRows = tableDef && Array.isArray(tableDef.currency_rows) && tableDef.currency_rows.length' },
];

function runSuite(appPath) {
  try {
    const out = execFileSync(process.execPath, [SUITE], {
      env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: appPath, DAC_OUT: os.devNull }),
      encoding: 'utf8', maxBuffer: 1 << 26,
    });
    return out;
  } catch (e) { return String((e.stdout || '') + (e.stderr || '')); }
}
function tally(out) {
  const m = /(\d+) passed, (\d+) failed/.exec(out || '');
  return m ? { passed: +m[1], failed: +m[2] } : null;
}

console.log('======================================================================');
console.log('  CLCPA-330 -- mutation controls');
console.log('======================================================================');
console.log('');

const clean = tally(runSuite(APP));
console.log('  baseline, unmutated : ' + (clean ? clean.passed + ' passed, ' + clean.failed + ' failed' : 'NO SUMMARY'));
let caught = 0, applied = 0, missed = [];

const tmp = path.join(os.tmpdir(), 'clcpa-330-mutant-' + process.pid + '.js');
MUTANTS.forEach((mut, i) => {
  const hits = SRC.split(mut.from).length - 1;
  if (hits !== 1) {
    console.log('  ???  ' + mut.name + '  -- ANCHOR ' + hits + ', NOT APPLIED');
    return;
  }
  applied++;
  fs.writeFileSync(tmp, SRC.split(mut.from).join(mut.to));
  const t = tally(runSuite(tmp));
  const red = t && t.failed > 0;
  if (red) caught++; else missed.push(mut.name);
  console.log('  ' + (red ? 'red ' : '*** GREEN, NOT CAUGHT') + '  ' + mut.name +
    (t ? '  (' + t.passed + ' passed, ' + t.failed + ' failed)' : '  (no summary)'));
});
try { fs.unlinkSync(tmp); } catch (e) {}

console.log('');
console.log('  ' + caught + ' caught, ' + (applied - caught) + ' not caught, of ' + applied + ' applied');

/* the repository file must be exactly as it was: nothing here should have
 * touched it, and this proves it rather than assuming it */
const after = fs.readFileSync(APP, 'utf8');
const untouched = after === SRC;
console.log('  app.js untouched by this run: ' + (untouched ? 'YES' : '*** NO'));

const cleanAgain = tally(runSuite(APP));
const stillGreen = cleanAgain && cleanAgain.failed === 0;
console.log('  clean re-run against the repository file: ' +
  (stillGreen ? 'PASSES' : 'FAILS -- ' + (cleanAgain ? cleanAgain.passed + '/' + cleanAgain.failed : 'no summary')));

const failed = (applied === 0) || (caught !== applied) || !untouched || !stillGreen;
console.log('');
console.log('======================================================================');
console.log('  ' + (applied + (untouched ? 1 : 0) + (stillGreen ? 1 : 0) - (failed ? 0 : 0) - missed.length) +
  ' passed, ' + (missed.length + (untouched ? 0 : 1) + (stillGreen ? 0 : 1)) + ' failed');
console.log('======================================================================');

try {
  const out = process.env.DAC_OUT || path.join(__dirname, 'mut-330-output.txt');
  fs.writeFileSync(out, _lines.join('\n') + '\n');
} catch (e) { /* a read-only checkout must not fail the runner */ }

process.exit(failed ? 1 : 0);
