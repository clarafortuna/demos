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
/* Mutation controls for suite_294. Temp copy via DAC_APP_OVERRIDE. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = _dacRepo() + '';
const APP = path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_294.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const TMP = path.join(os.tmpdir(), 'clcpa-294-app.js');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

const MUTATIONS = [
  {
    label: 'the editor calc cell guesses by size again',
    from: "    if (d.type === 'percentage') return (v * 100).toFixed(d.decimals) + '%';",
    to:   "    if (d.type === 'percentage') return (Math.abs(v) <= 1 ? v * 100 : v).toFixed(d.decimals) + '%';",
    expect: ['C2', 'C5'],
  },
  {
    label: 'the rendered table guesses by size again',
    from: "          if (declaredPct[colIdx]) return (c * 100).toFixed(1) + '%';",
    to:   "          if (false) return (c * 100).toFixed(1) + '%';",
    expect: ['C3'],
  },
  {
    label: 'the declared set is emptied, so no column is ever scaled by type',
    from: "      if (d.type === 'percentage' || d.type === 'weightedMean') out[d.column] = true;",
    to:   "      if (false) out[d.column] = true;",
    expect: ['C1b'],
  },
  {
    label: 'an UNDECLARED percent column is force-scaled too, breaking stored data',
    from: "          return (Math.abs(c) <= 1 ? c * 100 : c).toFixed(1) + '%';",
    to:   "          return (c * 100).toFixed(1) + '%';",
    expect: ['C4'],
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
    passed: m ? +m[1] : -1,
    failed: m ? +m[2] : -1,
    failedIds: (out.match(/ {2}FAIL (\S+)/g) || []).map(s => s.replace(/ {2}FAIL /, '')),
  };
};

log('======================================================================');
log('CLCPA-294 -- mutation controls');
log('  suite  : ' + path.basename(SUITE));
log('  mutant : ' + TMP + '  (the working tree is never written)');
log('======================================================================');

fs.writeFileSync(TMP, ORIGINAL);
const base = runSuite(TMP);
log('');
log('BASELINE (unmutated): ' + base.passed + ' passed, ' + base.failed + ' failed');
if (base.failed !== 0) {
  log('STOP: the suite is not green before mutation.');
  fs.writeFileSync(__dirname + '/mut-294-output.txt', lines.join('\n') + '\n');
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
  fs.writeFileSync(TMP, ORIGINAL.replace(mut.from, () => mut.to));
  const r = runSuite(TMP);
  const hit = mut.expect.filter(id => r.failedIds.some(f => f.indexOf(id) === 0));
  log('  suite: ' + r.passed + ' passed, ' + r.failed + ' failed');
  log('  failed ids: ' + (r.failedIds.join(', ') || '(none)'));
  log('  expected to break: ' + mut.expect.join(', ') + '  ->  ' +
      (hit.length ? 'NOTICED on ' + hit.join(', ') : 'NOT NOTICED'));
  if (hit.length) noticed++; else missed++;
});

log('');
log('======================================================================');
fs.writeFileSync(TMP, ORIGINAL);
const restoredSame = fs.readFileSync(TMP, 'utf8') === ORIGINAL;
const after = runSuite(TMP);
log('RESTORED: the mutant file is byte-identical to app.js: ' + restoredSame);
log('CLEAN RE-RUN: ' + after.passed + ' passed, ' + after.failed + ' failed');
const untouched = fs.readFileSync(APP, 'utf8') === ORIGINAL;
log('THE WORKING TREE WAS NEVER WRITTEN: ' + untouched);
log('');
log('  ' + noticed + ' of ' + MUTATIONS.length + ' mutations noticed, ' + missed + ' missed');
log('======================================================================');

fs.writeFileSync(__dirname + '/mut-294-output.txt', lines.join('\n') + '\n');
try { fs.unlinkSync(TMP); } catch (e) {}
process.exit((missed === 0 && after.failed === 0 && restoredSame && untouched) ? 0 : 1);
