/* CLCPA-310 round 2 mutation controls: the near-zero percentage rule.
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
const SUITE = path.join(__dirname, 'suite_310_r2.js');
const OUT = path.join(__dirname, 'mut-310-r2-output.txt');
const MUTANT = path.join(os.tmpdir(), 'clcpa310r2-mutant-app.js');

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
    what: 'the rule never fires, so a near-zero share reads as absent again',
    targets: ['C1', 'C2', 'C3', 'C7', 'D1'],
    apply: (s) => s.replace(
      '    if (Number(Math.abs(pct).toFixed(d)) !== 0) return null;',
      () => '    if (true) return null;'),
  },
  {
    id: 2,
    what: 'the threshold is hardcoded at one decimal instead of following the precision',
    targets: ['A2', 'C3'],
    apply: (s) => s.replace(
      "    return (pct < 0 ? '>-' : '<') + Math.pow(10, -d).toFixed(d) + '%';",
      () => "    return (pct < 0 ? '>-' : '<') + (0.1).toFixed(1) + '%';"),
  },
  {
    id: 3,
    what: 'a negative near-zero claims the wrong direction',
    targets: ['A5', 'C2'],
    apply: (s) => s.replace(
      "    return (pct < 0 ? '>-' : '<') + Math.pow(10, -d).toFixed(d) + '%';",
      () => "    return '<' + Math.pow(10, -d).toFixed(d) + '%';"),
  },
  {
    id: 4,
    what: 'a TRUE zero is dressed up as a near-zero, which is a lie the other way',
    targets: ['C8'],
    apply: (s) => s.replace(
      "    if (typeof pct !== 'number' || !isFinite(pct) || pct === 0) return null;",
      () => "    if (typeof pct !== 'number' || !isFinite(pct)) return null;"),
  },
  {
    id: 5,
    what: 'the section page stops asking the rule, so the two surfaces disagree',
    targets: ['B2'],
    apply: (s) => s.replace(
      '            const nearD = nearZeroPctText(c * 100, declaredPct[colIdx].decimals);',
      () => '            const nearD = null;'),
  },
  {
    id: 6,
    what: 'the editor stops routing a declared row through the shared formatter',
    targets: ['B4'],
    apply: (s) => s.replace(
      '            : (rowDesc ? fmtDerivedCell(v, rowDesc, currencyCol[colIdx])',
      () => '            : (false ? fmtDerivedCell(v, rowDesc, currencyCol[colIdx])'),
  },
  {
    id: 7,
    what: 'the boundary moves, so a value that should render is suppressed',
    targets: ['C6'],
    apply: (s) => s.replace(
      '    if (Number(Math.abs(pct).toFixed(d)) !== 0) return null;',
      () => '    if (Math.abs(pct) > Math.pow(10, -d)) return null;'),
  },
];

log('CLCPA-310 round 2: mutation controls');
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
