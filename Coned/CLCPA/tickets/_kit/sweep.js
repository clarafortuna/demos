/* The regression sweep, with the hole closed.
 *
 * WHY THIS IS A FILE AND NOT A SHELL ONE-LINER. The ad-hoc sweep read each
 * suite's "N passed, M failed" line and summed it. A suite that THREW before
 * printing that line contributed 0 passed and 0 failed -- so it was invisible:
 * not red, not counted, just quietly gone.
 *
 * That is not hypothetical. CLCPA-282 added calls to the shared header
 * anatomy inside buildIngestImport, and suite_85.js and suite_85_xlsx.js
 * assemble that function from a hand-fed dependency list. They threw with
 * "ingestHeaderRowCount is not defined" and the sweep reported 0 failed. 398
 * assertions disappeared and the run still looked green. The only reason it
 * was caught is that the TOTAL fell when it should have risen.
 *
 * So: a suite that prints no tally is a FAILURE here, named and non-zero, and
 * the total is printed beside the suite count so a silent loss shows up as a
 * number that moved the wrong way.
 *
 * Usage:
 *   node sweep.js            all suites
 *   node sweep.js --quiet    only the failures and the total
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const TICKETS = path.join(__dirname, '..');
const QUIET = process.argv.indexOf('--quiet') >= 0;

const files = [];
fs.readdirSync(TICKETS).forEach((d) => {
  const dir = path.join(TICKETS, d);
  let st;
  try { st = fs.statSync(dir); } catch (e) { return; }
  if (!st.isDirectory()) return;
  fs.readdirSync(dir).forEach((f) => {
    /* gate_* TOO, and the omission was not harmless: gate_149_stacked.js sat
     * outside this pattern, so the sweep called the tree green while the
     * DEPLOY's own suite gate -- which scans more widely -- found it red and
     * refused to run. A sweep that is narrower than the gate it stands in for
     * is a sweep that lies about being ready to deploy. */
    if (/^(suite|derive|diag|gate)_.*\.js$/.test(f)) files.push({ dir, file: f });
  });
});
files.sort((a, b) => (a.file < b.file ? -1 : 1));

let totalPassed = 0, totalFailed = 0, broken = 0;
const problems = [];

files.forEach(({ dir, file }) => {
  const r = spawnSync(process.execPath, [file], { cwd: dir, encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const m = /(\d+) passed, (\d+) failed/.exec(out.split(/\r?\n/).reverse().join('\n'));
  if (!m) {
    /* NO TALLY AT ALL. The suite threw, hung or exited early. This is the
     * case the old sweep scored as zero. */
    broken++;
    const why = (out.split(/\r?\n/).filter(Boolean).slice(-40)
      .find(l => /Error|error:|THREW|FAILED/.test(l)) || '(no tally, no error line)').trim();
    problems.push('  BROKEN  ' + file + '  exit ' + r.status + '  ' + why.slice(0, 120));
    return;
  }
  const passed = +m[1], failed = +m[2];
  totalPassed += passed;
  totalFailed += failed;
  if (failed) problems.push('  RED     ' + file + '  ' + passed + ' passed, ' + failed + ' failed');
  else if (!QUIET) console.log('  ok      ' + file.padEnd(28) + passed + ' passed');
});

if (problems.length) { console.log(''); problems.forEach(p => console.log(p)); }
console.log('');
console.log('SWEEP: ' + files.length + ' suites, ' + totalPassed + ' assertions, ' +
  totalFailed + ' failed, ' + broken + ' broken (no tally)');
process.exit((totalFailed || broken) ? 1 : 0);
