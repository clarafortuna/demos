/* Mutation controls for suite_319_r2.
 *
 * Control 3 is the one worth having. Flagging EVERY anchored total row,
 * not just those in a declared table, fixes the G board perfectly well and
 * passes every assertion about G1 -- while silently changing the classifier
 * for the other 123 stored table-years. Only the blast-radius block sees
 * it, which is why that block drives every table rather than the one the
 * ticket names.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const APP = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_319_r2.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const SHA = (s) => require('crypto').createHash('sha256').update(s).digest('hex').slice(0, 12);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mut319r2-'));

const CLAUSE = "    if (((tableId && DERIVED_COLS[tableId]) || []).some(d => d.type === 'columnTotal')) {\r\n" +
  '      draft.forEach((row, idx) => {\r\n' +
  '        if (isAnchoredTotalRowLabel((row || [])[0])) editorFlags[idx] = true;\r\n' +
  '      });\r\n' +
  '    }\r\n';

const MUTATIONS = [
  {
    name: 'THE DEFECT ITSELF: the clause is removed, so the classifier falls ' +
          'back to arithmetic on a total row that has no figure to confirm',
    from: CLAUSE,
    to: '',
    expect: ['A1', 'A2', 'B3', 'D3'],
  },
  {
    name: 'THE FLAG IS CLEARED RATHER THAN SET, so a declared total row is ' +
          'forced INTO the denominator instead of out of it',
    from: '        if (isAnchoredTotalRowLabel((row || [])[0])) editorFlags[idx] = true;',
    to: '        if (isAnchoredTotalRowLabel((row || [])[0])) editorFlags[idx] = false;',
    expect: ['A1', 'A2'],
  },
  {
    /* The one that matters: right answer on G1, wrong blast radius. */
    name: 'THE GATE IS DROPPED: every anchored total row in every table is ' +
          'flagged, which fixes G1 and changes the classifier everywhere else',
    from: "    if (((tableId && DERIVED_COLS[tableId]) || []).some(d => d.type === 'columnTotal')) {\r\n",
    to: '    if (true) {\r\n',
    expect: ['E2'],
  },
  {
    name: 'THE LABEL TEST IS REPLACED BY THE VALUE TEST it was brought in to ' +
          'escape, so the clause reasserts exactly what was already there',
    from: '        if (isAnchoredTotalRowLabel((row || [])[0])) editorFlags[idx] = true;',
    to: '        if (editorFlags[idx]) editorFlags[idx] = true;',
    expect: ['A1', 'A2', 'B3', 'D3'],
  },
  {
    name: 'THE CLAUSE READS THE BASELINE instead of the draft, so a scratch ' +
          'year with no aligned baseline is left exactly as it was',
    from: '      draft.forEach((row, idx) => {',
    to: '      (aligned ? baseline : []).forEach((row, idx) => {',
    expect: [],
    note: 'EQUIVALENT ON THIS GESTURE, and measured so rather than assumed. '
        + 'The defect is not that the baseline is misaligned -- it is aligned '
        + 'here -- but that its total row holds no figure for the arithmetic '
        + 'to confirm. Both arrays carry the same labels, so flagging from '
        + 'either finds the same row. The two diverge only where the draft '
        + 'has rows the baseline does not, which is Add Row and Delete Row, '
        + 'and neither is this ticket gesture. The shipped clause reads the '
        + 'DRAFT because the draft is what gets summed: a flag keyed to rows '
        + 'that are not the ones being added up is the CLCPA-212 index-drift '
        + 'trap waiting to happen.',
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
    const m = /^\s*FAIL\s+([A-Z][A-Za-z0-9-]*[0-9a-b]?)\b/.exec(l);
    if (m) red.push(m[1]);
  });
  return { red: Array.from(new Set(red)), out: out, code: r.status };
};

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

log('Mutation controls for suite_319_r2');
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
  log('      expected red : ' + (m.expect.length ? m.expect.join(', ') : '(none)'));
  log('      actually red : ' + (r.red.length ? r.red.join(', ') : '(none)'));
  if (!m.expect.length) {
    log('      UNREACHED, deliberately: ' + m.note);
    if (r.red.length) { problems++; log('      but it turned the suite red, so the note is wrong'); }
  } else {
    const missing = m.expect.filter(e => r.red.indexOf(e) < 0);
    if (missing.length) { problems++; log('      SUITE DEFECT: did not fail: ' + missing.join(', ')); }
    else log('      ok');
  }
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

fs.writeFileSync(path.join(__dirname, 'mut-319-r2-output.txt'), lines.join('\n') + '\n');
if (problems || clean.code !== 0) process.exit(1);
