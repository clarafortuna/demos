const _dacRepo = () => {
  const p = require('path'), f = require('fs');
  if (process.env.DAC_REPO) return p.resolve(process.env.DAC_REPO);
  let d = __dirname;
  for (let i = 0; i < 16; i++) {
    if (f.existsSync(p.join(d, '.clcpa-root'))) {
      const two = p.resolve(d, '..', '..');
      return f.existsSync(p.join(two, '.git')) ? two : d;
    }
    const u = p.dirname(d); if (u === d) break; d = u;
  }
  throw new Error('CLCPA project root not found above ' + __dirname + '; set DAC_REPO');
};
/* Mutation controls for suite_black_button.
 *
 * This ticket's fix is in styles.css, so the mutant is a CSS copy fed back
 * through DAC_CSS_OVERRIDE -- which is what the suite reads. A runner that
 * mutates a file the suite does not read is the silent no-op that once left
 * eleven of thirteen runners green while changing nothing.
 *
 * Run:  node mut_black_button.js
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO = _dacRepo() + '';
const CSS = path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css');
const SUITE = path.join(__dirname, 'suite_black_button.js');
const ORIGINAL = fs.readFileSync(CSS, 'utf8');
const TMP = path.join(os.tmpdir(), 'black-button-styles.css');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

const FIX = '#ingest-add-row:hover,\r\n#ingest-add-row:active { background: transparent; }';
/* NEWLINE-ANCHORED, and it has to be: ".ingest-form-actions .btn:hover { ... }"
 * CONTAINS ".btn:hover { ... }" as a substring, so the bare form matches twice
 * and the runner refuses the mutation rather than patching the wrong rule. */
const BTN_HOVER = '\r\n.btn:hover { background: var(--ink-2); }';
const LINK_HOVER = '\r\n.btn-link:hover { text-decoration: underline; }';

const MUTATIONS = [
  {
    label: 'the fix is reverted entirely',
    from: FIX,
    to: '/* removed */',
    expect: ['B1'],
  },
  {
    label: 'only :hover is held, so a HELD button still inverts',
    from: FIX,
    to: '#ingest-add-row:hover { background: transparent; }',
    expect: ['B1'],
  },
  {
    label: 'the background is held but with a hardcoded colour',
    from: FIX,
    to: '#ingest-add-row:hover,\r\n#ingest-add-row:active { background: #ffffff; }',
    expect: ['B5'],
  },
  {
    label: 'the shared rule is restyled instead, against the CLCPA-85 round 2 ruling',
    from: LINK_HOVER,
    to: '\r\n.btn-link:hover { text-decoration: underline; background: transparent; }',
    expect: ['B3'],
  },
  {
    label: 'solid buttons stop darkening: .btn:hover loses its fill',
    from: BTN_HOVER,
    to: '\r\n.btn:hover { background: transparent; }',
    expect: ['B2'],
  },
  {
    label: 'the neighbour\'s per-id patch is dropped',
    from: '#ingest-template:hover { background: transparent; }',
    to: '/* removed */',
    expect: ['B4'],
  },
];

const runSuite = (cssPath) => {
  const r = spawnSync(process.execPath, [SUITE], {
    cwd: __dirname,
    env: Object.assign({}, process.env, { DAC_CSS_OVERRIDE: cssPath }),
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
log('BLACK BUTTON -- mutation controls');
log('  suite  : ' + path.basename(SUITE));
log('  mutant : ' + TMP + '  (the working tree is never written)');
log('======================================================================');

fs.writeFileSync(TMP, ORIGINAL);
const base = runSuite(TMP);
log('');
log('BASELINE (unmutated): ' + base.passed + ' passed, ' + base.failed + ' failed');
if (base.failed !== 0) {
  log('STOP: the suite is not green before mutation. Nothing below would mean anything.');
  fs.writeFileSync(__dirname + '/mut-black-button-output.txt', lines.join('\n') + '\n');
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
log('RESTORED: the mutant file is byte-identical to styles.css: ' + restoredSame);
log('CLEAN RE-RUN: ' + after.passed + ' passed, ' + after.failed + ' failed');
const untouched = fs.readFileSync(CSS, 'utf8') === ORIGINAL;
log('THE WORKING TREE WAS NEVER WRITTEN: ' + untouched);
log('');
log('  ' + noticed + ' of ' + MUTATIONS.length + ' mutations noticed, ' + missed + ' missed');
log('======================================================================');

fs.writeFileSync(__dirname + '/mut-black-button-output.txt', lines.join('\n') + '\n');
try { fs.unlinkSync(TMP); } catch (e) {}
process.exit((missed === 0 && after.failed === 0 && restoredSame && untouched) ? 0 : 1);
