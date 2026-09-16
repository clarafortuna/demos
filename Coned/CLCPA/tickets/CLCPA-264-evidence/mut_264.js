/* Mutation controls for CLCPA-264.
 *
 * The dangerous directions:
 *
 *   IT REJECTS. The ruling is an advisory, never a rejection. A version that
 *   flips plan.ok, or turns the staged box red, has overshot the ticket.
 *
 *   IT CRIES WOLF. A predicate that fires on ordinary filenames gets turned
 *   off, and then it is not there for the case it exists for. The five silent
 *   shapes are the guard.
 *
 *   IT GOES QUIET. It stops firing, or fires only for the reported pair
 *   instead of all 88, or claims identical headings where they are not.
 *
 *   THE MISSING CLOSURE COMES BACK. getTarget is out of scope in the dialog
 *   and the first cut used it; that would throw the moment a file was staged.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-264-evidence';
const APP = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSS = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const SUITE = DIR + '/suite_264.js';

const M = [
  /* ---- it rejects -------------------------------------------------------- */
  { t: APP, name: 'IT REJECTS: the advisory flips plan.ok',
    from: '              plan.identityNotice = importIdentityNotice(staged.name, i.tableId);',
    to:   '              plan.identityNotice = importIdentityNotice(staged.name, i.tableId);\r\n' +
          '              if (plan.identityNotice) plan.ok = false;',
    expect: 'R4c and with it undone the call site is BYTE-IDENTICAL to BASE' },
  { t: APP, name: 'IT REJECTS: the staged box turns red on a mismatch',
    from: '      const bad = !!(staged.error || (staged.dry && !staged.dry.ok));',
    to:   '      const bad = !!(staged.error || (staged.dry && !staged.dry.ok) ||\r\n' +
          '        importIdentityNotice(staged.name, target().tableId));',
    expect: 'D5 and `bad` is unchanged' },

  /* ---- it cries wolf ----------------------------------------------------- */
  { t: APP, name: 'IT CRIES WOLF: the id is matched anywhere in the name',
    from: '    const m = /^([A-Za-z])(\\d{1,2})(?=[-_. ]|$)/.exec(base);',
    to:   '    const m = /([A-Za-z])(\\d{1,2})(?=[-_. ]|$)/.exec(base);',
    expect: 'S2 silent: "notes-about-C3.csv"' },
  { t: APP, name: 'IT CRIES WOLF: an id this payload does not have still warns',
    from: '    return Object.prototype.hasOwnProperty.call(tables, id) ? id : null;',
    to:   '    return id;',
    expect: 'S2 silent: "Z9-2025.csv"' },
  { t: APP, name: 'IT CRIES WOLF: a file named for its own destination warns',
    from: '    if (!declared || !destTableId || declared === destTableId) return null;',
    to:   '    if (!declared || !destTableId) return null;',
    expect: 'S1 all 27 twin tables are silent on their own file' },

  /* ---- it goes quiet ----------------------------------------------------- */
  { t: APP, name: 'IT GOES QUIET: the advisory never fires',
    from: '  function importIdentityNotice(fileName, destTableId) {',
    to:   '  function importIdentityNotice(fileName, destTableId) {\r\n    if (true) return null;',
    expect: 'W2 every one warns' },
  { t: APP, name: 'IT GOES QUIET: only the reported pair is recognised',
    from: "    const m = /^([A-Za-z])(\\d{1,2})(?=[-_. ]|$)/.exec(base);",
    to:   "    const m = /^(C)(3)(?=[-_. ]|$)/.exec(base);",
    expect: 'W2 every one warns' },
  { t: APP, name: 'IT OVERCLAIMS: every mismatch is called an identical-heading twin',
    from: '    const twins = mine.some(s => theirs.indexOf(s) >= 0);',
    to:   '    const twins = true;',
    expect: 'W7 but does NOT claim identical headings' },
  { t: APP, name: 'the two-digit id is truncated, so A10 reads as A1',
    from: "    const m = /^([A-Za-z])(\\d{1,2})(?=[-_. ]|$)/.exec(base);",
    to:   "    const m = /^([A-Za-z])(\\d{1})(?=[-_. ]|$)/.exec(base);",
    expect: 'S4 and a two-digit id survives: A10' },

  /* ---- the missing closure ----------------------------------------------- */
  { t: APP, name: 'THE MISSING CLOSURE: stagedBlock reaches for getTarget again',
    from: '      const idNote = importIdentityNotice(staged.name, target().tableId);',
    to:   '      const idNote = importIdentityNotice(staged.name, getTarget().tableId);',
    expect: 'D2 it calls importIdentityNotice with the staged name and target().tableId',
    alt: 'D3 and NOT getTarget, which is out of scope here' },

  /* ---- the panel --------------------------------------------------------- */
  { t: APP, name: 'the result panel stops announcing it',
    from: "      '</div>' + notices + identity;",
    to:   "      '</div>' + notices;",
    expect: 'R8 and carries the advisory heading' },
  { t: APP, name: 'the panel announces it even when there is nothing to say',
    from: '    const identity = r.identityNotice',
    to:   '    const identity = true',
    expect: 'R10 and a matching file renders no advisory block at all' },

  /* ---- the styling ------------------------------------------------------- */
  { t: CSS, name: 'the advisory is styled as a REJECTION, in red',
    from: '  color: var(--warn-fg, #8a5a00);\r\n  font-weight: 500;\r\n}',
    to:   '  color: var(--red);\r\n  font-weight: 500;\r\n}',
    expect: 'C2 and it uses the warn colour',
    alt: 'C3 not the red of .is-bad' },

  /* ---- the harness ------------------------------------------------------- */
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '63dea00';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X3 BASE is a literal commit sha' },
  { t: SUITE, name: 'HARNESS: the families are hardcoded instead of measured',
    from: "const FAMILIES = Object.keys(SIG).map(k => [...SIG[k]]).filter(t => t.length > 1);",
    to:   "const FAMILIES = [['C3', 'C4', 'C5']];",
    /* the whole point of measuring them here is that the suite and the audit
     * cannot drift apart. F1 is what notices. */
    /* the expectation must not quote the COUNT: the mutation changes it, so
     * an expect naming 14 could never match the red line it causes. */
    expect: 'F1 1 header signatures are shared by more than one table',
    alt: 'W1 88 ordered sibling pairs' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-264 -- mutation controls');
log('======================================================================');

let caught = 0, missed = 0;
M.forEach((m) => {
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  /* normalised to the TARGET file's own endings: app.js and styles.css are
   * CRLF, the suite was written LF, and a mismatched anchor reports 0 and
   * skips the control silently. */
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  if (n !== 1) { log('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED'); missed++; return; }
  fs.writeFileSync(m.t, base.replace(from, () => to));
  let out = '';
  try { out = execFileSync('node', ['suite_264.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }
  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const want = [m.expect].concat(m.alt ? [m.alt] : []);
  const hit = fails.filter(l => want.some(w => l.indexOf(w) >= 0));
  if (hit.length) {
    log('  red  ' + m.name);
    log('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 104));
    caught++;
  } else if (fails.length) {
    log('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    log('       want: ' + want.join(' OR '));
    log('       got : ' + fails[0].trim().slice(5, 104));
    missed++;
  } else { log('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.'); missed++; }
});

log('');
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length + ' guards');
let clean = '';
try { clean = execFileSync('node', ['suite_264.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-264-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
