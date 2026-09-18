/* Mutation controls for CLCPA-278 round 2.
 *
 * The control that carries this ticket is the ORDER: the capture must
 * happen before the first write. Moving it back into blur is exactly the
 * shipped defect, and it must turn the real-gesture assertions red while
 * the blur-alone one stays green -- which is how it hid.
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

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-278-r2-evidence';
const SUITE = DIR + '/suite_278_r2.js';
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || null;
const APP = path.join(os.tmpdir(), 'clcpa-278-r2-app.js');
fs.writeFileSync(APP, NEW_COMMIT
  ? execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n')
  : fs.readFileSync(path.join(REPO, REL), 'utf8'));

const CRLF = String.fromCharCode(13) + String.fromCharCode(10);
const M = [
  { t: APP, name: "THE DEFECT RETURNS: the capture goes back into the blur handler",
    from: "        const beforeRow = (preEdit && preEdit.r === r) ? preEdit.row\n          : (Array.isArray(state.ingest.draft[r]) ? state.ingest.draft[r].slice() : null);",
    to:   "        const beforeRow = Array.isArray(state.ingest.draft[r])\n          ? state.ingest.draft[r].slice() : null;",
    expect: "B1 input then blur now recomputes to 1809",
    alt: "B4 the snapshot is the row before the FIRST keystroke" },
  { t: APP, name: "THE CAPTURE happens on EVERY keystroke, not the first",
    from: "        if (!preEdit || preEdit.r !== r) {",
    to:   "        if (true) {",
    expect: "B4 the snapshot is the row before the FIRST keystroke" },
  { t: APP, name: "THE SNAPSHOT is never released, so a second episode reads a stale row",
    from: "        preEdit = null;",
    to:   "",
    expect: "E6 and releases it, so it cannot leak" },
  { t: APP, name: "THE SNAPSHOT stops being keyed by row",
    from: "        if (!preEdit || preEdit.r !== r) {",
    to:   "        if (!preEdit) {",
    expect: "E4 the INPUT handler captures, once per episode" },
  { t: APP, name: "A DISAGREEING TOTAL starts being overwritten, against the ruling",
    from: "        const beforeRow = (preEdit && preEdit.r === r) ? preEdit.row\n          : (Array.isArray(state.ingest.draft[r]) ? state.ingest.draft[r].slice() : null);",
    to:   "        const beforeRow = null;",
    expect: "C2 editing a component KEEPS it",
    alt: "B1 input then blur now recomputes to 1809" },
  { t: APP, name: "THE SNAPSHOT is hung on the stored state",
    from: "    let preEdit = null;",
    to:   "    state.ingest.preEdit = null; let preEdit = null;",
    expect: "E3 nothing transient was hung on the stored state" },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-278 round 2 -- mutation controls');
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
fs.writeFileSync(DIR + '/mut-278-r2-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
