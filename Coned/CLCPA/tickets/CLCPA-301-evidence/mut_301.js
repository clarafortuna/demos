/* Mutation controls for suite_301.
 *
 * Each mutation breaks ONE thing the suite claims to guard and must turn it
 * red ON THE ASSERTION IT TARGETS. An assertion that cannot fail is a deleted
 * guard wearing a green tick.
 *
 * The mutation goes into a TEMP COPY fed back through DAC_APP_OVERRIDE, which
 * is what the suite reads. A runner that mutates a file the suite does not
 * read is the silent no-op that once left eleven of thirteen runners green
 * while changing nothing.
 *
 * Run:  node mut_301.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const APP = path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_301.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const TMP = path.join(os.tmpdir(), 'clcpa-301-app.js');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

const CALL = '    res.derivedOnImport = fillDerivableSumsOnImport(i.draft, i.schema, i.tableId);';
const TOTALS = '    recomputeTotals(i.draft, i.schema, i.tableId, i.baseline);';

const MUTATIONS = [
  {
    label: 'the import fill is never called (the defect exactly as it shipped)',
    from: CALL,
    to: '    res.derivedOnImport = [];',
    expect: ['C5'],
  },
  {
    label: 'a filed total is overwritten, trading away the CLCPA-278 guardian',
    from: '        if (bareNumber(row[rel.column]) !== null) return;   /* filed: keep it */',
    to: '',
    expect: ['B4'],
  },
  {
    label: 'a partly numeric row is totalled anyway',
    from: '        if (seen !== rel.parts.length) return;              /* not fully numeric */',
    to: '',
    expect: ['D1'],
  },
  {
    label: 'a second reader replaces bareNumber on the components',
    from: '          const n = bareNumber(row[c]);\r\n          if (n !== null) { sum += n; seen++; }\r\n        });\r\n        if (seen !== rel.parts.length) return;              /* not fully numeric */',
    to: "          const n = (typeof row[c] === 'number' ? row[c] : null);\r\n          if (n !== null) { sum += n; seen++; }\r\n        });\r\n        if (seen !== rel.parts.length) return;              /* not fully numeric */",
    expect: ['C2', 'D2'],
  },
  {
    label: 'the fill runs AFTER recomputeTotals, over a draft already struck',
    from: CALL + '\r\n' + TOTALS,
    to: TOTALS + '\r\n' + CALL,
    expect: ['C6'],
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
log('CLCPA-301 -- mutation controls');
log('  suite  : ' + path.basename(SUITE));
log('  mutant : ' + TMP + '  (the working tree is never written)');
log('======================================================================');

fs.writeFileSync(TMP, ORIGINAL);
const base = runSuite(TMP);
log('');
log('BASELINE (unmutated): ' + base.passed + ' passed, ' + base.failed + ' failed');
if (base.failed !== 0) {
  log('STOP: the suite is not green before mutation. Nothing below would mean anything.');
  fs.writeFileSync(__dirname + '/mut-301-output.txt', lines.join('\n') + '\n');
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
  /* function form: a replacement containing $& or $' would expand */
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

fs.writeFileSync(__dirname + '/mut-301-output.txt', lines.join('\n') + '\n');
try { fs.unlinkSync(TMP); } catch (e) {}
process.exit((missed === 0 && after.failed === 0 && restoredSame && untouched) ? 0 : 1);
