/* Mutation controls for suite_303.
 *
 * The two worth having are 4 and 5. Control 4 removes the corner's owner:
 * both rules then write the same cell, they agree on every stored year, and
 * every value assertion in the suite stays green. Only D1 stands between
 * that and a second source of truth shipping unnoticed. Control 5 turns
 * keepFiled off, which is invisible on this data for the same reason -- the
 * figures all reconcile -- and shows up only on the divergence the suite
 * manufactures.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const APP = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_303.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const SHA = (s) => require('crypto').createHash('sha256').update(s).digest('hex').slice(0, 12);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mut303-'));

const OWNER = "    if (((tableId && DERIVED_COLS[tableId]) || []).some(d => d.type === 'columnTotal') &&\r\n" +
  '        isAnchoredTotalRowLabel((rows[rowIndex] || [])[0])) return done;\r\n';

const MUTATIONS = [
  {
    name: 'THE DECLARATION IS DROPPED: B2 goes back to one axis engined and ' +
          'the other silently overwriting',
    from: '      B2: [colTotal(1), colTotal(2), colTotal(3), colTotal(4)],\r\n',
    to: '',
    expect: ['B3', 'B4'],
  },
  {
    name: 'ONLY THE YEARS THAT SHARE A SHAPE: columns 1 to 3 are declared and ' +
          'column 4 is not, so 2025s "Total Plugs" loses its rule while 2023 ' +
          'and 2024 keep theirs',
    from: '      B2: [colTotal(1), colTotal(2), colTotal(3), colTotal(4)],',
    to:   '      B2: [colTotal(1), colTotal(2), colTotal(3)],',
    expect: ['G1'],
  },
  {
    name: 'THE WRONG COLUMNS: the rule is declared on the label column, which ' +
          'no year sums',
    from: '      B2: [colTotal(1), colTotal(2), colTotal(3), colTotal(4)],',
    to:   '      B2: [colTotal(0)],',
    expect: ['B3', 'B4', 'G1'],
  },
  {
    /* The one that matters. Both axes write the corner, they agree on every
     * stored year, and nothing in the value assertions can see it. */
    name: 'THE CORNER LOSES ITS OWNER: the row rule writes the Total row too, ' +
          'so one cell has two writers and they agree on all present data',
    from: OWNER,
    to: '',
    expect: ['D1'],
  },
  {
    name: 'THE OWNERSHIP IS KEYED TO THE LABEL INSTEAD OF THE DECLARATION, so ' +
          'every table with a total row loses its row-wise recompute',
    from: OWNER,
    to: '    if (isAnchoredTotalRowLabel((rows[rowIndex] || [])[0])) return done;\r\n',
    expect: ['D3'],
  },
  {
    name: 'keepFiled OFF: a divergent total is silently recomputed again, ' +
          'which is invisible on data that reconciles everywhere',
    from: "      ({ column, type: 'columnTotal', keepFiled: true,",
    to:   "      ({ column, type: 'columnTotal', keepFiled: false,",
    expect: ['B3'],
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

log('Mutation controls for suite_303');
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

fs.writeFileSync(path.join(__dirname, 'mut-303-output.txt'), lines.join('\n') + '\n');
if (problems || clean.code !== 0) process.exit(1);
