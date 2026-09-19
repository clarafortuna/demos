/* Mutation controls for suite_281_r3.
 *
 * Each mutation breaks ONE thing the suite claims to guard, and must turn the
 * suite red ON THE ASSERTION IT TARGETS. A mutation that goes unnoticed means
 * the assertion cannot fail, and an assertion that cannot fail is a deleted
 * guard wearing a green tick.
 *
 * THE MUTATION GOES INTO A TEMP COPY, fed back through DAC_APP_OVERRIDE. The
 * suite reads DAC_APP_OVERRIDE for its post-change side, so mutating the
 * working tree would be both unnecessary and destructive -- and a runner that
 * mutates a file the suite does not read is the silent no-op that once left
 * eleven of thirteen runners green while changing nothing.
 *
 * Run:  node mut_281_r3.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const APP = path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_281_r3.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const TMP = path.join(os.tmpdir(), 'clcpa-281-r3-app.js');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

/* A mutation is (label, from, to, expected assertion ids). `from` must occur
 * EXACTLY ONCE: a patch that matched the wrong construct, or matched nothing
 * at all, is the failure this count exists to refuse. */
const MUTATIONS = [
  {
    label: 'the helper stops asking the year (round 2 regressed onto all three surfaces)',
    from: '    return ingestYearCarriesHeaderRows(rows, declared) ? declared : 0;',
    to:   '    return declared;',
    expect: ['A3'],
  },
  {
    label: 'the section table no longer borrows the sub-header',
    from: '      const borrowed = storedHeaderRowsInYear(t, yr)\r\n        ? [] : ingestStoredHeaderRows(t, ingestHeaderRowCount(t, Infinity));',
    to:   '      const borrowed = [];',
    expect: ['B1'],
  },
  {
    label: 'the has-data check goes back to one unconditional count',
    from: '    const bodyRowsCurrent = ((t.data || {})[year] || []).slice(storedHeaderRowsInYear(t, year));',
    to:   '    const bodyRowsCurrent = ((t.data || {})[year] || []).slice(Math.max(0, (t.header_levels || 1) - 1));',
    expect: ['B2'],
  },
  {
    label: 'the width loop subtracts the declared count again',
    from: '      (table.data[y] || []).slice(storedHeaderRowsInYear(table, y)).forEach(r => body.push(r));',
    to:   '      (table.data[y] || []).slice(Math.max(0, ((table.header_levels || 1) - 1))).forEach(r => body.push(r));',
    expect: ['B3', 'C3'],
  },
  {
    label: 'an all-empty row counts as a stored header again (the round 2 defect)',
    from: "    return row.slice(1).some(v => v != null && String(v).trim() !== '');",
    to:   '    return true;',
    /* A9p, not A3: A3 reads a row with a LABEL, which returns false at the
     * label guard and never reaches the predicate this mutation breaks. The
     * mutation went unnoticed until the all-empty case had an assertion of its
     * own -- which is the whole point of running these. */
    expect: ['A9p'],
  },
];

const runSuite = (appPath) => {
  const r = spawnSync(process.execPath, [SUITE], {
    cwd: __dirname,
    env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: appPath }),
    encoding: 'utf8',
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const m = /(\d+) passed, (\d+) failed/.exec(out);
  return {
    out,
    passed: m ? +m[1] : -1,
    failed: m ? +m[2] : -1,
    code: r.status,
    failedIds: (out.match(/ {2}FAIL (\S+)/g) || []).map(s => s.replace(/ {2}FAIL /, '')),
  };
};

log('======================================================================');
log('CLCPA-281 r3 -- mutation controls');
log('  suite  : ' + path.basename(SUITE));
log('  mutant : ' + TMP + '  (the working tree is never written)');
log('======================================================================');

/* the clean baseline the mutants are measured against */
fs.writeFileSync(TMP, ORIGINAL);
const base = runSuite(TMP);
log('');
log('BASELINE (unmutated): ' + base.passed + ' passed, ' + base.failed + ' failed');
if (base.failed !== 0) {
  log('STOP: the suite is not green before mutation. Nothing below would mean anything.');
  fs.writeFileSync(__dirname + '/mut-281-r3-output.txt', lines.join('\n') + '\n');
  process.exit(1);
}

let noticed = 0, missed = 0;
MUTATIONS.forEach((mut, i) => {
  log('');
  log('--- mutation ' + (i + 1) + ': ' + mut.label);
  const n = ORIGINAL.split(mut.from).length - 1;
  if (n !== 1) {
    log('  NOT APPLIED: the anchor occurs ' + n + ' times, expected exactly 1.');
    missed++;
    return;
  }
  /* function form: a replacement containing $& or $\' would EXPAND */
  fs.writeFileSync(TMP, ORIGINAL.replace(mut.from, () => mut.to));
  const r = runSuite(TMP);
  const hit = mut.expect.filter(id => r.failedIds.some(f => f.indexOf(id) === 0));
  const targeted = hit.length > 0;
  log('  suite: ' + r.passed + ' passed, ' + r.failed + ' failed');
  log('  failed ids: ' + (r.failedIds.join(', ') || '(none)'));
  log('  expected to break: ' + mut.expect.join(', ') +
      '  ->  ' + (targeted ? 'NOTICED on ' + hit.join(', ') : 'NOT NOTICED'));
  if (targeted) noticed++; else missed++;
});

/* THE CLEAN RE-RUN, against byte-restored source, said loudly. Without it a
 * runner can leave a mutant in place and the next reader has no way to know. */
log('');
log('======================================================================');
fs.writeFileSync(TMP, ORIGINAL);
const restoredSame = fs.readFileSync(TMP, 'utf8') === ORIGINAL;
const after = runSuite(TMP);
log('RESTORED: the mutant file is byte-identical to app.js: ' + restoredSame);
log('CLEAN RE-RUN: ' + after.passed + ' passed, ' + after.failed + ' failed');
const workingTreeUntouched = fs.readFileSync(APP, 'utf8') === ORIGINAL;
log('THE WORKING TREE WAS NEVER WRITTEN: ' + workingTreeUntouched);
log('');
log('  ' + noticed + ' of ' + MUTATIONS.length + ' mutations noticed, ' + missed + ' missed');
log('======================================================================');

fs.writeFileSync(__dirname + '/mut-281-r3-output.txt', lines.join('\n') + '\n');
try { fs.unlinkSync(TMP); } catch (e) {}
process.exit((missed === 0 && after.failed === 0 && restoredSame && workingTreeUntouched) ? 0 : 1);
