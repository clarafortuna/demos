/* CLCPA-307 round 2 mutation controls.
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
const SUITE = path.join(__dirname, 'suite_307_r2.js');
const OUT = path.join(__dirname, 'mut-307-r2-output.txt');
const MUTANT = path.join(os.tmpdir(), 'clcpa307r2-mutant-app.js');

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
    what: 'the help text goes back to a literal Add Year',
    targets: ['A5', 'E4'],
    apply: (s) => s.replace(
      "          'it; it is imported when you press ' + primaryLabel() + '.') +",
      () => "          'it; it is imported when you press Add Year.') +"),
  },
  {
    id: 2,
    what: 'the rejection sentence names Add Year on both paths again',
    targets: ['B1', 'B2'],
    apply: (s) => s.replace(
      "      return why + ' ' + ingestPrimaryLabel(ctx.existing) + ' will still ' +",
      () => "      return why + ' Add Year will still add the year, and the ' +"),
  },
  {
    id: 3,
    what: 'the existing path promises a year addition again',
    targets: ['B2'],
    apply: (s) => s.replace(
      "    return yearAlreadyExists ? 'load the table-year' : 'add the year';",
      () => "    return 'add the year';"),
  },
  {
    id: 4,
    what: 'the two labels are swapped, so every screen names the wrong button',
    targets: ['C1', 'C2', 'B1', 'B3'],
    apply: (s) => s.replace(
      "    return yearAlreadyExists ? 'Load Data' : 'Add Year';",
      () => "    return yearAlreadyExists ? 'Add Year' : 'Load Data';"),
  },
  {
    id: 5,
    what: 'a caller with no context gets a button invented for it',
    targets: ['B6'],
    apply: (s) => s.replace(
      "      if (!ctx || typeof ctx.existing !== 'boolean') return why;",
      () => "      if (!ctx || typeof ctx.existing !== 'boolean') ctx = { existing: false };"),
  },
  {
    id: 6,
    what: 'the dialog stops telling the summary which path it is on',
    targets: ['A6'],
    apply: (s) => s.replace(
      "        escapeHtml(ingestStagedSummary(staged, { existing: isExisting() })) +",
      () => "        escapeHtml(ingestStagedSummary(staged)) +"),
  },
  {
    id: 7,
    what: 'the help text stops following the year box as it is typed',
    targets: ['F2'],
    apply: (s) => s.replace(
      "          const note = modal.querySelector('#ingest-import-note');",
      () => "          const note = null;"),
  },
];

log('CLCPA-307 round 2: mutation controls');
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
