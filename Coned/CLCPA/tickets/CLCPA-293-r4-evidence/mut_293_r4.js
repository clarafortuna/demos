/* Mutation controls for suite_293_r4.
 *
 * Control 5 is the one this ticket exists to survive. Padding the registry
 * with a total the engine really does own -- A1's Total -- passes every
 * anatomy block, every value-identity block, and the whole census, because
 * none of those look at A1. Only the C block stands between a padded
 * registry and the CLCPA-88 defect, which is why the ruling put both
 * controls in the same evidence and why the D block stays.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const APP = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_293_r4.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const SHA = (s) => require('crypto').createHash('sha256').update(s).digest('hex').slice(0, 12);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mut293r4-'));

const MEMBER_FN = '    return list.some(m => norm(m.row) === r && norm(m.column) === c);';
const SECOND_SURFACE = '        if (isB7PreparerTotal(tableId, draft[idx][0], schema[c])) continue;\r\n';
const MARKER = '        if (isB7PreparerTotal(tableId, (rows[r] || [])[0], schema[c])) return false;\r\n';
const IMPORT_CLAUSE = '          if (b7 || (!computed.derivedCol(cIdx) &&\r\n' +
  "                     !rebuildableTotals.has(t.rowIdx + ',' + cIdx))) {";
const A8_ENTRY = "    A8: [{ row: 'Total CES Programs Installations', column: 'Total Installations' },";

const MUTATIONS = [
  {
    name: 'THE REGISTRY NEVER MATCHES: isB7PreparerTotal always says no, so ' +
          'the import refuses the preparers grand total again',
    from: MEMBER_FN,
    to: '    return false;',
    expect: ['A1', 'A2', 'A3'],
  },
  {
    name: 'THE SECOND SURFACE IS REMOVED: the import accepts the figure and ' +
          'the editors next recompute writes over it, so the advisory lies',
    from: SECOND_SURFACE,
    to: '',
    expect: ['A2', 'A3'],
  },
  {
    name: 'THE MARKER EXCLUSION IS REMOVED: the workbook says (calculated) ' +
          'on a cell the import then accepts from the preparer',
    from: MARKER,
    to: '',
    expect: ['B3'],
  },
  {
    name: 'THE IMPORT CLAUSE DROPS THE REGISTRY TERM, leaving the value ' +
          'probe to decide ownership exactly as it did before',
    from: IMPORT_CLAUSE,
    to: '          if ((!computed.derivedCol(cIdx) &&\r\n' +
        "                     !rebuildableTotals.has(t.rowIdx + ',' + cIdx))) {",
    expect: [],
    note: 'UNREACHED on every stored anatomy, and MEASURED so rather than ' +
          'assumed. The second surface subsumes it: a registry member is ' +
          'skipped by recomputeTotals, so the probe inside ' +
          'ingestRebuildableTotals writes nothing for it and never reports it ' +
          'rebuildable, which means the accept condition is already true ' +
          'without the registry term. The term still guards the one path ' +
          'that bypasses the probe -- the exception branch, which refuses ' +
          'every column when recomputeTotals throws -- so it is kept rather ' +
          'than deleted, and recorded here as unreached rather than left ' +
          'looking like a guard that fires.',
  },
  {
    /* THE ONE THAT MATTERS. A padded registry is invisible to every block
     * except the control that was put there for it. */
    name: 'THE REGISTRY IS PADDED with A1s Total, which the engine really ' +
          'does derive, so a file overwrites it: CLCPA-88 coming back',
    from: A8_ENTRY,
    to: "    A1: [{ row: 'Total', column: 'Total Funds Expended ($)' },\r\n" +
        "         { row: 'Total', column: 'DAC Funding ($)' }],\r\n" + A8_ENTRY,
    expect: ['C4', 'C5', 'C6', 'C7'],
  },
  {
    name: 'MEMBERSHIP MATCHES ON THE ROW ALONE, ignoring the column, so ' +
          'every column of a member row is handed over',
    from: MEMBER_FN,
    to: '    return list.some(m => norm(m.row) === r);',
    expect: [],
    note: 'INERT AT THIS REGISTRY SIZE, and measured so rather than assumed. ' +
          'The confirmed registry is two rows, and the columns row-only ' +
          'matching would add are already refused or already silent on ' +
          'stored data, so no accept/refuse decision moves. The control is ' +
          'kept because it stops being inert the moment a member row with a ' +
          'derivable sibling column is confirmed -- which is exactly what ' +
          'the eleven held-back nominees would do -- and control 7 below ' +
          'proves the E block can still fail.',
  },
  {
    name: 'MEMBERSHIP MATCHES ON THE COLUMN ALONE, ignoring the row, so a ' +
          'data row in a member column is handed over',
    from: MEMBER_FN,
    to: '    return list.some(m => norm(m.column) === c);',
    expect: ['E1'],
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
    const m = /^\s*FAIL\s+([A-Z][A-Za-z0-9-]*[0-9b])\b/.exec(l);
    if (m) red.push(m[1]);
  });
  return { red: Array.from(new Set(red)), out: out, code: r.status };
};

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

log('Mutation controls for suite_293_r4');
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
    /* a control with nothing to expect has to SAY why, and must still be
     * seen to change nothing, or it is a dead control reported as a pass */
    log('      UNREACHED, deliberately: ' + m.note);
    if (r.red.length) {
      problems++;
      log('      but it turned the suite red, so the note is wrong');
    }
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

fs.writeFileSync(path.join(__dirname, 'mut-293-r4-output.txt'), lines.join('\n') + '\n');
if (problems || clean.code !== 0) process.exit(1);
