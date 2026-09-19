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
/* Mutation controls for CLCPA-276 round 2.
 *
 * The control that carries this ticket is that the repaint REACHES the
 * notice mount. Round 1 cleared the right state and was wired to nothing,
 * so a control that only removes the state clear proves the wrong thing.
 *
 * THE MUTATION TARGET IS THE PINNED BUILD, not the working tree: the suite is
 * handed the mutant through DAC_APP_OVERRIDE, which is mut_271's shape and the
 * standing one. Mutating the repo's own file is what disarmed all seven
 * runners last wave.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync, execSync } = require('child_process');

const REPO = _dacRepo() + '';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-276-r2-evidence';
const SUITE = DIR + '/suite_276_r2.js';
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || null;
const APP = path.join(os.tmpdir(), 'clcpa-276-r2-app.js');
fs.writeFileSync(APP, NEW_COMMIT
  ? execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n')
  : fs.readFileSync(path.join(REPO, REL), 'utf8'));

const CRLF = String.fromCharCode(13) + String.fromCharCode(10);
const M = [
  { t: APP, name: "THE DEFECT RETURNS: the editor repaint stops touching the notices",
    from: "    wireIngestEditor();\n    refreshIngestNotices();",
    to:   "    wireIngestEditor();",
    expect: "C3 and the notice area is now empty",
    alt: "C4 a year switch leaves nothing behind" },
  { t: APP, name: "THE REPAINT becomes a BLANK, which erases a live discrepancy too",
    from: "    if (mount) mount.innerHTML = renderIngestImport();",
    to:   "    if (mount) mount.innerHTML = '';",
    expect: "C7 a repaint KEEPS a live discrepancy" },
  { t: APP, name: "THE NOTICE MOUNT is repainted from stale state rather than recomputed",
    from: "  function refreshIngestNotices() {\n    const mount = document.getElementById('ingest-import-mount');\n    if (mount) mount.innerHTML = renderIngestImport();",
    to:   "  function refreshIngestNotices() {\n    const mount = document.getElementById('ingest-import-mount');\n    if (mount && false) mount.innerHTML = renderIngestImport();",
    expect: "C3 and the notice area is now empty",
    alt: "C7 a repaint KEEPS a live discrepancy" },
  { t: APP, name: "RESET stops restoring the draft, so the suite is not just reading paint",
    from: "          state.ingest.draft = clone2D(state.ingest.baseline);",
    to:   "          state.ingest.draft = state.ingest.draft;",
    expect: "C2 Reset restores the draft",
    alt: "X3 it takes answering the guard" },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-276 round 2 -- mutation controls');
log('======================================================================');

let caught = 0, missed = 0, applied = 0;
M.forEach((m) => {
  /* THE FILE IS CRLF and every multi-line anchor here is written with LF.
   * An indexOf of LF text in a CRLF file finds nothing, and this runner
   * reports that as ANCHOR 0 -- which looks exactly like a control that was
   * applied and passed. Normalised so a multi-line mutation is possible. */
  m.from = m.from.replace(/\r?\n/g, CRLF);
  m.to = m.to.replace(/\r?\n/g, CRLF);
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const n = m.all ? (base.split(m.from).length - 1) : (base.split(m.from).length - 1);
  if (n < 1 || (!m.all && n !== 1)) {
    log('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED');
    missed++; return;
  }
  applied++;
  let mutated = m.all ? base.split(m.from).join(m.to) : base.replace(m.from, () => m.to);
  if (m.from2 !== undefined) {
    const f2 = m.from2.replace(/\r?\n/g, CRLF);
    if (mutated.indexOf(f2) < 0) { log('  ???  ' + m.name + '  -- SECOND ANCHOR MISSING'); fs.writeFileSync(m.t, base); missed++; applied--; return; }
    mutated = mutated.replace(f2, () => m.to2.replace(/\r?\n/g, CRLF));
  }
  fs.writeFileSync(m.t, mutated);
  let out = '';
  try {
    out = execFileSync('node', [path.basename(SUITE)],
      { cwd: DIR, encoding: 'utf8',
        env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) });
  } catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }
  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const want = [m.expect].concat(m.alt ? [m.alt] : []);
  const hit = fails.filter(l => want.some(w => l.indexOf(w) >= 0));
  if (hit.length) {
    log('  red  ' + m.name);
    log('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 112));
    caught++;
  } else if (fails.length) {
    log('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    log('       want: ' + want.join(' OR '));
    log('       got : ' + fails[0].trim().slice(5, 112));
    missed++;
  } else {
    log('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.');
    missed++;
  }
});

log('');
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + applied + ' applied');
let clean = '';
try {
  clean = execFileSync('node', [path.basename(SUITE)],
    { cwd: DIR, encoding: 'utf8',
      env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) });
} catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-276-r2-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
