/* Mutation controls: the retired placeholder card.
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
const SUITE = path.join(__dirname, 'suite_coming_soon.js');
const OUT = path.join(__dirname, 'mut-coming-soon-output.txt');
const MUTANT = path.join(os.tmpdir(), 'daccs-mutant-app.js');

const CLEAN = fs.readFileSync(APP, 'utf8');
const CRLF = String.fromCharCode(13) + String.fromCharCode(10);
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
    what: 'the placeholder card is put back into the panel',
    targets: ['A3', 'A4', 'C1', 'C2'],
    apply: (s) => s.replace(
      '        eapCard +',
      () => "        '<div class=\"dac-kpi-card dac-kpi-card-placeholder\">" +
        "Coming soon</div>' +" + CRLF + "        eapCard +"),
  },
  {
    id: 2,
    what: 'the card is retired but its dead CSS is left behind',
    targets: ['B3'],
    /* the suite reads styles.css from disk, so this control writes the rule
     * back there and restores it afterwards -- the runner's byte-restore
     * check covers app.js only, so this one restores its own file. */
    css: true,
    apply: (s) => s,
  },
];

log('the placeholder card: mutation controls');
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

/* A MUTATION THAT LIVES IN THE STYLESHEET.
 *
 * The suite reads styles.css from disk, so a control aimed at its assertions
 * has to write there -- DAC_APP_OVERRIDE only carries app.js. It gets the
 * same guarantee app.js has: the original is held in memory, restored in a
 * finally, and the restore is verified byte-for-byte before the run is
 * called trustworthy. A control that leaves a tracked file modified would be
 * worse than no control. */
const CSSPATH = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css');
const CSS_CLEAN = fs.readFileSync(CSSPATH, 'utf8');
const CSS_DEAD_RULE = CRLF + '.dac-kpi-card-placeholder {' + CRLF +
  '  border-left: 3px solid var(--line);' + CRLF + '}' + CRLF;

MUTATIONS.forEach((m) => {
  if (m.css) {
    log('MUTATION ' + m.id + ': ' + m.what);
    let r;
    try {
      fs.writeFileSync(CSSPATH, CSS_CLEAN + CSS_DEAD_RULE);
      r = runSuite(null);
    } finally {
      fs.writeFileSync(CSSPATH, CSS_CLEAN);
    }
    const restored = fs.readFileSync(CSSPATH, 'utf8') === CSS_CLEAN;
    const hit = m.targets.filter(t => r.failed.some(f => f.indexOf(t + ' ') === 0));
    const miss = m.targets.filter(t => hit.indexOf(t) < 0);
    log('  the suite says: ' + (r.out.match(/\d+ passed, \d+ failed/) || ['?'])[0]);
    log('  targeted red  : ' + (hit.join(', ') || 'NONE'));
    log('  styles.css restored byte-for-byte: ' + restored);
    if (miss.length || !restored || r.code === 0) {
      bad++;
      log('  BROKEN CONTROL  ' + (miss.length
        ? 'stayed green under a break aimed at them: ' + miss.join(', ')
        : (!restored ? 'styles.css was NOT restored' : 'the suite exited 0')));
    } else { good++; log('  the control holds.'); }
    log('');
    return;
  }
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
