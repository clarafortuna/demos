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
/* Mutation controls for suite_291.
 *
 * The mutant is a temp copy of app.js fed back through DAC_APP_OVERRIDE, which
 * is what the suite reads.
 *
 * Two of these are the defects that nearly shipped: a year-scoped predicate,
 * and asking bareNumber alone about a percent column. Both were caught by
 * measurement before a commit, and both are kept here so they cannot come back
 * quietly.
 *
 * Run:  node mut_291.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = _dacRepo() + '';
const APP = path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_291.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const TMP = path.join(os.tmpdir(), 'clcpa-291-app.js');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

const MUTATIONS = [
  {
    label: 'the fix is reverted: every named column of a total row is (calculated) again',
    from: '            text: ingestTextOnlyColumn(table, c)\r\n              ? INGEST_NOVALUE_MARKER : INGEST_CALC_MARKER,',
    to: '            text: INGEST_CALC_MARKER,',
    expect: ['B1'],
  },
  {
    label: 'the predicate is scoped to ONE year, converting A7s numeric column',
    from: '    const years = Object.keys(data);',
    to: '    const years = Object.keys(data).slice(-1);',
    /* D2b, not D2: A7's 2025 column is blank, so the blank-column guard
     * answers before the all-years scope is ever reached. D2 could not fail
     * on this mutation, which is why it went unnoticed. */
    expect: ['D2b'],
  },
  {
    label: 'bareNumber is asked alone, so every percent column becomes text',
    from: '        if (bareNumber(v) !== null || isPercentLiteral(v)) return false;',
    to: '        if (bareNumber(v) !== null) return false;',
    expect: ['D5', 'C1'],
  },
  {
    label: 'a column blank everywhere is called text, converting empty columns',
    from: '    return sawSomething;',
    to: '    return true;',
    expect: ['D7'],
  },
  {
    label: 'the marker is inverted: numeric columns get (no value)',
    from: '            text: ingestTextOnlyColumn(table, c)\r\n              ? INGEST_NOVALUE_MARKER : INGEST_CALC_MARKER,',
    to: '            text: ingestTextOnlyColumn(table, c)\r\n              ? INGEST_CALC_MARKER : INGEST_NOVALUE_MARKER,',
    expect: ['B1', 'B2'],
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
log('CLCPA-291 -- mutation controls');
log('  suite  : ' + path.basename(SUITE));
log('  mutant : ' + TMP + '  (the working tree is never written)');
log('======================================================================');

fs.writeFileSync(TMP, ORIGINAL);
const base = runSuite(TMP);
log('');
log('BASELINE (unmutated): ' + base.passed + ' passed, ' + base.failed + ' failed');
if (base.failed !== 0) {
  log('STOP: the suite is not green before mutation. Nothing below would mean anything.');
  fs.writeFileSync(__dirname + '/mut-291-output.txt', lines.join('\n') + '\n');
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

fs.writeFileSync(__dirname + '/mut-291-output.txt', lines.join('\n') + '\n');
try { fs.unlinkSync(TMP); } catch (e) {}
process.exit((missed === 0 && after.failed === 0 && restoredSame && untouched) ? 0 : 1);
