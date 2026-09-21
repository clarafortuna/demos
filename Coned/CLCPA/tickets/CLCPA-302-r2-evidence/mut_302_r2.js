/* CLCPA-302 round 2 mutation controls.
 *
 * Every assertion in suite_302_r2 that could pass by accident gets a
 * deliberate break here, and the break has to turn THAT assertion red. A
 * mutation that only reddens the run is not a control: it could be
 * reddening a neighbour.
 *
 * The mutants go to ONE temp file outside the repo, overwritten each time
 * and removed at the end, and the run finishes against byte-restored
 * source. DAC_APP_OVERRIDE is what carries the mutant in; BASE stays
 * pinned to a commit, so only the post-change side moves and the BASE
 * assertions (D, E4, F4) are expected to stay green throughout.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const APP = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_302_r2.js');
const OUT = path.join(__dirname, 'mut-302-r2-output.txt');
const MUTANT = path.join(os.tmpdir(), 'clcpa302r2-mutant-app.js');

const CLEAN = fs.readFileSync(APP, 'utf8');
const CLEAN_BYTES = Buffer.byteLength(CLEAN);

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
    out,
    code: r.status,
    failed: out.split('\n').filter(l => /^\s+FAIL\s/.test(l))
      .map(l => l.trim().replace(/^FAIL\s+/, '')),
  };
}

/* a mutant that does not parse proves nothing, so every one is checked */
function parses(src) {
  fs.writeFileSync(MUTANT, src);
  return spawnSync(process.execPath, ['--check', MUTANT], { encoding: 'utf8' }).status === 0;
}

const MUTATIONS = [
  {
    id: 1,
    what: 'ingestOperatorCell drops the derivability exclusion this round adds',
    targets: ['B7', 'C1', 'C2', 'C4'],
    apply: (s) => s.replace(
      '      if (typeof computed.marksInTemplate === \'function\' &&\r\n' +
      '          computed.marksInTemplate(r, c)) return false;',
      () => '      if (false) return false;'),
  },
  {
    id: 2,
    what: 'the confirm count keeps its own copy of the rule again',
    targets: ['B3', 'B4', 'C1'],
    apply: (s) => s.replace(
      '          if (!ingestOperatorCell(computed, keyCols, r, c)) continue;',
      () => '          if (c < keyCols) continue;\r\n' +
            '          if (computed.any(r, c)) continue;'),
  },
  {
    id: 3,
    what: 'diffRows keeps its own copy instead of delegating',
    targets: ['B2', 'C2', 'C3'],
    apply: (s) => s.replace(
      '      const operatorCell = (r, c) => ingestOperatorCell(computed, keyCols, r, c);',
      () => '      const operatorCell = (r, c) => !(c < keyCols) && !(computed && computed.any(r, c));'),
  },
  {
    id: 4,
    what: 'a missing classifier excludes instead of counting (unsafe direction)',
    targets: ['A1', 'B8'],
    apply: (s) => s.replace(
      '    if (!computed) return true;',
      () => '    if (!computed) return false;'),
  },
  {
    id: 5,
    what: 'the key-cell exclusion is removed from the reader',
    targets: ['B5'],
    apply: (s) => s.replace(
      '    if (c < keyCols) return false;',
      () => '    if (c < -1) return false;'),
  },
  {
    id: 6,
    what: 'the engine-cell exclusion is removed from the reader',
    targets: ['B6'],
    apply: (s) => s.replace(
      '    if (computed.any(r, c)) return false;',
      () => '    if (computed.any(r, c) && false) return false;'),
  },
  {
    id: 7,
    what: 'the exclusion is widened so the operator is billed for nothing',
    targets: ['C1', 'C2', 'F1', 'F2'],
    apply: (s) => s.replace(
      '    if (c < keyCols) return false;',
      () => '    if (c >= keyCols) return false;'),
  },
];

log('CLCPA-302 round 2: mutation controls');
log('app.js ' + CLEAN_BYTES + ' bytes, mutants via DAC_APP_OVERRIDE');
log('');

/* the clean run first, so a suite that is already red is not read as a
 * mutation working */
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
    log('  BROKEN CONTROL  the mutation matched nothing, so the suite was');
    log('                  never asked the question. Its anchor has moved.');
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

/* ---- BYTE-RESTORED, AND SAID LOUDLY -------------------------------- */
try { fs.unlinkSync(MUTANT); } catch (e) { /* already gone */ }
const now = fs.readFileSync(APP, 'utf8');
log('--- RESTORED -------------------------------------------------------');
log('app.js untouched on disk: ' + (now === CLEAN) + '  (' +
  Buffer.byteLength(now) + ' bytes, was ' + CLEAN_BYTES + ')');
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
