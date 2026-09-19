/* Mutation controls for suite_282.
 *
 * The mutant is a temp copy of app.js fed back through DAC_APP_OVERRIDE, which
 * is what the suite reads. A runner that mutates a file the suite does not read
 * is the silent no-op that once left eleven of thirteen runners green.
 *
 * Run:  node mut_282.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const APP = path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_282.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const TMP = path.join(os.tmpdir(), 'clcpa-282-app.js');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

const MUTATIONS = [
  {
    label: 'the group row stops carrying forward, so a spanned column loses its group',
    from: '      if (top) carried = top;',
    to: '      carried = top;',
    expect: ['B4'],
  },
  {
    label: 'the pair collapses to the sub-label alone (the ambiguity restored)',
    from: '      keys.push(!group && !sub ? \'\' : group + INGEST_KEY_SEP + sub);',
    to: '      keys.push(sub);',
    expect: ['B1'],
  },
  {
    label: 'the pair collapses to the group alone',
    from: '      keys.push(!group && !sub ? \'\' : group + INGEST_KEY_SEP + sub);',
    to: '      keys.push(group);',
    expect: ['B1'],
  },
  {
    label: 'a ONE-level table is composed as a pair too, changing what it was',
    from: '      if (headerCount < 2) { keys.push(top); continue; }',
    to: '      if (headerCount < 0) { keys.push(top); continue; }',
    expect: ['B7'],
  },
  {
    label: 'the importer stops asking whether the FILE carries a sub-header',
    from: '    const fileCarriesSub = declaredSub > 0 &&\r\n      ingestYearCarriesHeaderRows(fileRows.slice(1), declaredSub);',
    to: '    const fileCarriesSub = declaredSub > 0;',
    expect: ['C2'],
  },
  {
    label: 'the body is taken from row 1 again, so a header row becomes data',
    from: '    const body = fileRows.slice(headerCount);',
    to: '    const body = fileRows.slice(1);',
    expect: ['C3'],
  },
  {
    label: 'the schema side keeps the old single-row spelling, so the sides disagree',
    from: '    const labelCol = header.indexOf(schemaNorm[0]);',
    to: '    const labelCol = header.indexOf(normIngestKey(schema[0]));',
    expect: ['C5'],
  },
  {
    label: 'the separator becomes an ordinary character a heading could contain',
    from: '  const INGEST_KEY_SEP = String.fromCharCode(31);',
    to: '  const INGEST_KEY_SEP = \' / \';',
    expect: ['D2'],
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
log('CLCPA-282 / 285 -- mutation controls');
log('  suite  : ' + path.basename(SUITE));
log('  mutant : ' + TMP + '  (the working tree is never written)');
log('======================================================================');

fs.writeFileSync(TMP, ORIGINAL);
const base = runSuite(TMP);
log('');
log('BASELINE (unmutated): ' + base.passed + ' passed, ' + base.failed + ' failed');
if (base.failed !== 0) {
  log('STOP: the suite is not green before mutation. Nothing below would mean anything.');
  fs.writeFileSync(__dirname + '/mut-282-output.txt', lines.join('\n') + '\n');
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

fs.writeFileSync(__dirname + '/mut-282-output.txt', lines.join('\n') + '\n');
try { fs.unlinkSync(TMP); } catch (e) {}
process.exit((missed === 0 && after.failed === 0 && restoredSame && untouched) ? 0 : 1);
