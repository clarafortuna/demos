/* Mutation controls for suite_292. Temp copy via DAC_APP_OVERRIDE. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const APP = path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_292.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const TMP = path.join(os.tmpdir(), 'clcpa-292-app.js');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

const MUTATIONS = [
  {
    label: 'the fix is reverted: only the first column is a key',
    from: '        if (c < keyCols) {',
    to: '        if (c < 1) {',
    expect: ['B1'],
  },
  {
    label: 'the key branch swallows an EMPTY key, so the Total row loses (no value)',
    from: '          const kv = row[c];\r\n          if (kv != null && String(kv).trim() !== \'\') {',
    to: '          const kv = row[c];\r\n          if (true) {',
    expect: ['B4'],
  },
  {
    label: 'the writer invents its own key count instead of the declared one',
    from: '    const keyCols = Math.max(1, Math.min(ingestKeyColCount(tableId), schema.length));\r\n    const code = tableId.replace',
    to: '    const keyCols = 2;\r\n    const code = tableId.replace',
    expect: ['C1', 'D1'],
  },
  /* A NUMERIC-CELL CONTROL WAS TRIED HERE AND MOVED OUT. Reverting xlsxCell's
   * numeric branch is CLCPA-274 option (c)'s concern, not this ticket's, and
   * every assertion here reads a FRESH-year template, which contains no
   * numeric cell at all -- so it could not fail. It lives in mut_274_r4
   * against suite_274_r4's C6, which reads the real cell types. */
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
log('CLCPA-292 -- mutation controls');
log('  suite  : ' + path.basename(SUITE));
log('  mutant : ' + TMP + '  (the working tree is never written)');
log('======================================================================');

fs.writeFileSync(TMP, ORIGINAL);
const base = runSuite(TMP);
log('');
log('BASELINE (unmutated): ' + base.passed + ' passed, ' + base.failed + ' failed');
if (base.failed !== 0) {
  log('STOP: the suite is not green before mutation.');
  fs.writeFileSync(__dirname + '/mut-292-output.txt', lines.join('\n') + '\n');
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

fs.writeFileSync(__dirname + '/mut-292-output.txt', lines.join('\n') + '\n');
try { fs.unlinkSync(TMP); } catch (e) {}
process.exit((missed === 0 && after.failed === 0 && restoredSame && untouched) ? 0 : 1);
