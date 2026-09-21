/* CLCPA-303 round 2 mutation controls.
 *
 * Each break must turn the assertion it targets red. A run that only goes
 * red proves nothing: it could be reddening a neighbour. Mutants go to one
 * temp file outside the repo and the run ends against byte-restored source.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const APP = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_303_r2.js');
const OUT = path.join(__dirname, 'mut-303-r2-output.txt');
const MUTANT = path.join(os.tmpdir(), 'clcpa303r2-mutant-app.js');

const CLEAN = fs.readFileSync(APP, 'utf8');
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
let good = 0, bad = 0;

function runSuite(src) {
  const env = Object.assign({}, process.env);
  if (src == null) delete env.DAC_APP_OVERRIDE;
  else { fs.writeFileSync(MUTANT, src); env.DAC_APP_OVERRIDE = MUTANT; }
  const r = spawnSync(process.execPath, [SUITE], { encoding: 'utf8', env });
  const out = (r.stdout || '') + (r.stderr || '');
  return {
    out, code: r.status,
    failed: out.split('\n').filter(l => /^\s+FAIL\s/.test(l))
      .map(l => l.trim().replace(/^FAIL\s+/, '')),
  };
}
const parses = (src) => {
  fs.writeFileSync(MUTANT, src);
  return spawnSync(process.execPath, ['--check', MUTANT], { encoding: 'utf8' }).status === 0;
};

const MUTATIONS = [
  {
    id: 1,
    what: 'the declared column total is never recognised, so the column axis ' +
          'goes back to being unreachable',
    targets: ['B1', 'B2', 'B5', 'C1', 'C5'],
    apply: (s) => s.replace(
      "    return !!d && d.type === 'columnTotal';",
      () => '    return false;'),
  },
  {
    id: 2,
    what: 'the reader forgets to ask whether the row is a total row',
    targets: ['B6'],
    apply: (s) => s.replace(
      '    if (computed && computed.totalRow(r) && ingestDeclaredTotalCell(tableId, c)) {',
      () => '    if (computed && ingestDeclaredTotalCell(tableId, c)) {'),
  },
  {
    id: 3,
    what: 'ANY declared column is claimed, which hands a percentage to the file ' +
          'and is CLCPA-88 coming back',
    targets: ['B3', 'B4', 'A8'],
    apply: (s) => s.replace(
      "    return !!d && d.type === 'columnTotal';",
      () => '    return !!d;'),
  },
  {
    id: 4,
    what: 'a refusal stops recording what it refused, so the drop is silent again',
    targets: ['E1', 'E2', 'E3', 'E5', 'E6'],
    apply: (s) => s.replace(
      '              refused.filed = rawTxt;',
      () => '              void rawTxt;'),
  },
  {
    id: 5,
    what: 'the staging count stops announcing the refusal',
    targets: ['E5', 'E6'],
    /* the WHOLE tail expression, so the mutant is valid JS: my first cut
     * spliced a fragment and the runner correctly called itself broken */
    apply: (s) => s.replace(
      "    const tail = refused.length",
      () => "    const tail = '' || refused.length && false"),
  },
  {
    id: 6,
    what: 'the result box stops rendering the refusal notice',
    targets: ['F2'],
    apply: (s) => s.replace(
      '      renderRefusedFiledNotice(r.notTouched && r.notTouched.computed);',
      () => "      '';"),
  },
  {
    id: 7,
    what: 'the reader drops the registry, so CLCPA-293 round 4 is undone by ' +
          'this rounds refactor',
    targets: ['A6'],
    apply: (s) => s.replace(
      "    if (isB7PreparerTotal(tableId, rowLabel, (schema || [])[c])) return 'registry';",
      () => '    if (false) return null;'),
  },
];

log('CLCPA-303 round 2: mutation controls');
log('app.js ' + Buffer.byteLength(CLEAN) + ' bytes, mutants via DAC_APP_OVERRIDE');
log('');

const first = runSuite(null);
log('CLEAN, before any mutation: ' + (first.out.match(/\d+ passed, \d+ failed/) || ['?'])[0]);
if (first.code !== 0) {
  log('STOPPING: the suite is not green on clean source, so no mutation below');
  log('would mean anything.');
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(2);
}
log('');

MUTATIONS.forEach((m) => {
  const src = m.apply(CLEAN);
  log('MUTATION ' + m.id + ': ' + m.what);
  if (src === CLEAN) {
    bad++;
    log('  BROKEN CONTROL  the mutation matched nothing: its anchor has moved,');
    log('                  so the suite was never asked the question.');
    log('');
    return;
  }
  if (!parses(src)) {
    bad++;
    log('  BROKEN CONTROL  the mutant does not parse');
    log('');
    return;
  }
  const r = runSuite(src);
  const hit = m.targets.filter(t => r.failed.some(f => f.indexOf(t + ' ') === 0));
  const miss = m.targets.filter(t => hit.indexOf(t) < 0);
  log('  the suite says: ' + (r.out.match(/\d+ passed, \d+ failed/) || ['?'])[0]);
  log('  targeted red  : ' + (hit.join(', ') || 'NONE'));
  if (miss.length) {
    bad++;
    log('  BROKEN CONTROL  these stayed green under a break aimed at them: ' +
      miss.join(', '));
  } else if (r.code === 0) {
    bad++;
    log('  BROKEN CONTROL  the suite exited 0 on a mutated build');
  } else {
    good++;
    log('  the control holds.');
  }
  const other = r.failed.filter(f => !m.targets.some(t => f.indexOf(t + ' ') === 0));
  if (other.length) log('  also red (collateral): ' + other.map(f => f.split(' ')[0]).join(', '));
  log('');
});

try { fs.unlinkSync(MUTANT); } catch (e) { /* already gone */ }
const now = fs.readFileSync(APP, 'utf8');
log('--- RESTORED -------------------------------------------------------');
log('app.js untouched on disk: ' + (now === CLEAN) + '  (' +
  Buffer.byteLength(now) + ' bytes)');
log('mutant file removed     : ' + !fs.existsSync(MUTANT));
const last = runSuite(null);
log('clean re-run            : ' + (last.out.match(/\d+ passed, \d+ failed/) || ['?'])[0] +
  ', exit ' + last.code);
log('');
log(good + ' controls held, ' + bad + ' broken');
const clean = (now === CLEAN) && last.code === 0 && bad === 0;
log(clean
  ? 'EVERY MUTATION TURNED ITS OWN ASSERTION RED AND THE SOURCE IS CLEAN.'
  : 'THIS RUN IS NOT TRUSTWORTHY: see the broken controls above.');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(clean ? 0 : 1);
