/* Mutation controls for suite_320_r3.
 *
 * Control 2 is the one worth having. Dropping the label restriction and
 * treating any empty row as non-header fixes G3 perfectly well and keeps
 * every G assertion green, while taking the (no value) marker off the real
 * group headers of A5 to A8 -- the captions that make a downloaded template
 * readable and tell the importer which group a row belongs to. Only the
 * fresh A3 control sees it.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const APP = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_320_r3.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const SHA = (s) => require('crypto').createHash('sha256').update(s).digest('hex').slice(0, 12);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mut320r3-'));

const CLAUSE = '      const isGroupHeader = ingestIsHeaderRow(row, [0]) &&\r\n' +
  '        !isAnchoredTotalRowLabel(row[0]);';

const MUTATIONS = [
  {
    name: 'THE DEFECT ITSELF: an empty total row is a group header again, so ' +
          'the populated workbook says (no value) about a computed cell',
    from: CLAUSE,
    to: '      const isGroupHeader = ingestIsHeaderRow(row, [0]);',
    expect: ['A1', 'A2', 'B1', 'B2'],
  },
  {
    /* Right answer on G3, wrong blast radius: the captions lose their marker. */
    name: 'THE LABEL RESTRICTION IS DROPPED: nothing is a group header, which ' +
          'fixes G3 and strips the caption marker from A5 to A8',
    from: CLAUSE,
    to: '      const isGroupHeader = false;',
    expect: ['E1', 'E2'],
  },
  {
    name: 'THE TEST IS INVERTED: only a TOTAL row is treated as a caption, ' +
          'which is the defect with the sign flipped',
    from: CLAUSE,
    to: '      const isGroupHeader = ingestIsHeaderRow(row, [0]) &&\r\n' +
        '        isAnchoredTotalRowLabel(row[0]);',
    expect: ['A1', 'A2', 'E1', 'E2'],
  },
  {
    name: 'THE STRICT PREDICATE is used instead of the anchored one, so ' +
          'G3s "County Total" stops being recognised as a total at all',
    from: '        !isAnchoredTotalRowLabel(row[0]);',
    to: '        !isStrictTotalRowLabel(row[0]);',
    expect: ['A1', 'A2'],
  },
];

const runSuite = (srcPath) => {
  const r = spawnSync(process.execPath, [SUITE], {
    cwd: __dirname, encoding: 'utf8',
    env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: srcPath }),
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const red = [];
  out.split(/\r?\n/).forEach((l) => {
    const m = /^\s*FAIL\s+([A-Z][A-Za-z0-9-]*[0-9])\b/.exec(l);
    if (m) red.push(m[1]);
  });
  return { red: Array.from(new Set(red)), out: out, code: r.status };
};

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

log('Mutation controls for suite_320_r3');
log('  app.js sha256[0:12] before: ' + SHA(ORIGINAL));
log('');

let problems = 0;
MUTATIONS.forEach((m, i) => {
  const hits = ORIGINAL.split(m.from).length - 1;
  log('  [' + (i + 1) + '] ' + m.name);
  if (hits !== 1) {
    problems++;
    log('      ANCHOR MATCHED ' + hits + ' TIMES, expected 1 -- not run');
    log('');
    return;
  }
  const mutated = ORIGINAL.replace(m.from, () => m.to);
  const p = path.join(TMP, 'app_' + (i + 1) + '.js');
  fs.writeFileSync(p, mutated);
  const chk = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
  if (chk.status !== 0) {
    problems++;
    log('      MUTANT DOES NOT PARSE -- not run');
    log('');
    return;
  }
  const r = runSuite(p);
  const missing = m.expect.filter(e => r.red.indexOf(e) < 0);
  log('      expected red : ' + m.expect.join(', '));
  log('      actually red : ' + (r.red.length ? r.red.join(', ') : '(none)'));
  if (missing.length) { problems++; log('      SUITE DEFECT: did not fail: ' + missing.join(', ')); }
  else log('      ok');
  log('');
});

log('========================================================================');
log('  app.js sha256[0:12] after : ' + SHA(fs.readFileSync(APP, 'utf8')));
log('  app.js is byte-for-byte unchanged: every mutation went to a temp copy.');
log('');
const clean = runSuite(APP);
const tail = (clean.out.match(/\s+(\d+) passed, (\d+) failed/) || []);
log('  CLEAN RE-RUN against the restored source:');
log('    ' + (tail[1] || '?') + ' passed, ' + (tail[2] || '?') +
    ' failed   exit ' + clean.code);
log('========================================================================');
if (problems) log('  ' + problems + ' PROBLEM(S)');
else {
  log('  all ' + MUTATIONS.length + ' controls turned the suite red on the ' +
      'assertions they target, and the');
  log('  clean re-run is green against byte-restored source.');
}
log('========================================================================');

fs.writeFileSync(path.join(__dirname, 'mut-320-r3-output.txt'), lines.join('\n') + '\n');
if (problems || clean.code !== 0) process.exit(1);
