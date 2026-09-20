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
/* Mutation controls for suite_283.
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

const REPO = _dacRepo() + '';
const APP = path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_283.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const TMP = path.join(os.tmpdir(), 'clcpa-283-app.js');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

/* A mutation is (label, from, to, expected assertion ids). `from` must occur
 * EXACTLY ONCE: a patch that matched the wrong construct, or matched nothing
 * at all, is the failure this count exists to refuse. */
const MUTATIONS = [
  {
    label: 'holding data protects a year again (the contradiction restored)',
    from: "    return (state.seedYears || []).map(String).includes(y);",
    to:   "    return (state.seedYears || []).map(String).includes(y) ||\r\n      Object.values((state.payload && state.payload.tables) || {}).some(function (t) {\r\n        var rows = (t.data || {})[y]; return rows && rows.length; });",
    expect: ['B2'],
  },
  {
    label: 'seed years stop being protected, so the report years become removable',
    from: "    return (state.seedYears || []).map(String).includes(y);",
    to:   "    return false;",
    expect: ['B3'],
  },
  {
    label: 'the button stops asking the predicate, so it shows for seed years too',
    from: "    const show = yr != null && Storage.getAddedYears().includes(yr) && !isYearProtected(yr);",
    to:   "    const show = yr != null && Storage.getAddedYears().includes(yr);",
    expect: ['D1'],
  },
  {
    label: 'the last line of defence in Storage.removeYear is removed',
    from: "        if (isYearProtected(year)) {",
    to:   "        if (false) {",
    expect: ['D2'],
  },
  {
    label: 'removing a year keeps its saved data, breaking the dialog\'s promise',
    from: "          Object.keys(overrides).forEach(k => { if (k.endsWith(':' + y)) delete overrides[k]; });",
    to:   "          /* left in place */",
    expect: ['D6'],
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
  fs.writeFileSync(__dirname + '/mut-283-output.txt', lines.join('\n') + '\n');
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

fs.writeFileSync(__dirname + '/mut-283-output.txt', lines.join('\n') + '\n');
try { fs.unlinkSync(TMP); } catch (e) {}
process.exit((missed === 0 && after.failed === 0 && restoredSame && workingTreeUntouched) ? 0 : 1);
