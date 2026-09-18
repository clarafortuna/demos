/* Mutation controls for CLCPA-277 round 2.
 *
 * Two controls carry this ticket: the target must keep its YEAR, and the
 * advisory must keep FOLLOWING the box without redrawing it.
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
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-277-r2-evidence';
const SUITE = DIR + '/suite_277_r2.js';
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || null;
const APP = path.join(os.tmpdir(), 'clcpa-277-r2-app.js');
fs.writeFileSync(APP, NEW_COMMIT
  ? execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n')
  : fs.readFileSync(path.join(REPO, REL), 'utf8'));

const CRLF = String.fromCharCode(13) + String.fromCharCode(10);
const M = [
  { t: APP, name: "THE DEFECT RETURNS: target() loses its year again",
    from: "      year: drawYear(),",
    to:   "",
    expect: "C1 staging a 2099 file into 2097 warns",
    alt: "G1 target() now carries the destination year" },
  { t: APP, name: "THE TARGET reads the validation year, which is empty before a keystroke",
    from: "      year: drawYear(),",
    to:   "      year: typedYear(),",
    expect: "C1 staging a 2099 file into 2097 warns",
    alt: "G1 target() now carries the destination year" },
  { t: APP, name: "THE ADVISORY stops following the box",
    from: "          syncStagedYearWarn();",
    to:   "",
    expect: "D2 retyping the destination to 2099 removes it",
    alt: "G3 called from the year input handler" },
  { t: APP, name: "IT FOLLOWS BY REDRAWING, which takes the focus out of the field",
    from: "          syncStagedYearWarn();",
    to:   "          draw();",
    expect: "G4 and that handler still does not redraw the dialog",
    alt: "D6 and the year box still holds what was typed" },
  { t: APP, name: "THE ADVISORY is raised even when the years agree",
    from: "      const note = staged ? importYearNotice(staged.name, drawYear()) : null;",
    to:   "      const note = staged ? (importYearNotice(staged.name, drawYear()) || 'mismatch') : null;",
    expect: "D2 retyping the destination to 2099 removes it",
    alt: "E1 a file staged into its OWN year says nothing" },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-277 round 2 -- mutation controls');
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
fs.writeFileSync(DIR + '/mut-277-r2-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
