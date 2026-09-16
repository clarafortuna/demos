/* Mutation controls for CLCPA-266.
 *
 * A style ticket's controls have to prove two different things:
 *
 *   THE STYLE IS REALLY APPLIED. The whole defect was a class emitted with no
 *   rule behind it -- a declaration that is absent looks exactly like one that
 *   is present and inert. Every accent, every shared property, and the
 *   stacking margin get a control that removes them.
 *
 *   NOTHING ELSE MOVED. "Style only" is the ruling, so a reworded notice, a
 *   reordered panel, a rejection, or a second component wearing the first
 *   one's name must all turn this red.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-266-evidence';
const APP = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSS = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const SUITE = DIR + '/suite_266.js';

const M = [
  /* ---- the style is really applied --------------------------------------- */
  { t: CSS, name: 'THE DEFECT RETURNS: .ingest-import-notice loses its box again',
    from: '.ingest-import-result,\r\n.ingest-import-notice {\r\n  margin-top: 12px; padding: 14px 16px;',
    to:   '.ingest-import-result {\r\n  margin-top: 12px; padding: 14px 16px;',
    expect: 'B1 padding is the same on all four shapes' },
  { t: CSS, name: 'THE AMBER ACCENT is dropped, so the fraction notice looks like the info box',
    from: '.ingest-import-notice.is-warn { border-left-color: var(--amber); }',
    to:   '',
    expect: 'B4 the fraction notice is AMBER',
    alt: 'B7 the three post-load accents are three DIFFERENT colours' },
  { t: CSS, name: 'THE RED ACCENT is dropped from the identity notice',
    from: '.ingest-import-notice.is-alert { border-left-color: var(--red); }',
    to:   '',
    expect: 'B5 the identity notice is RED',
    alt: 'B7 the three post-load accents are three DIFFERENT colours' },
  { t: CSS, name: 'THE TWO ADVISORIES SHARE ONE ACCENT, so the amber says nothing',
    from: '.ingest-import-notice.is-warn { border-left-color: var(--amber); }',
    to:   '.ingest-import-notice.is-warn { border-left-color: var(--red); }',
    expect: 'B7 the three post-load accents are three DIFFERENT colours' },
  { t: CSS, name: 'AN ACCENT IS A LITERAL COLOUR instead of a token',
    from: '.ingest-import-notice.is-warn { border-left-color: var(--amber); }',
    to:   '.ingest-import-notice.is-warn { border-left-color: #B8860B; }',
    expect: 'B8 warn uses a token, not a literal colour' },
  { t: CSS, name: 'A VARIANT DECLARES MORE THAN THE ACCENT, becoming a second component',
    from: '.ingest-import-notice.is-warn { border-left-color: var(--amber); }',
    to:   '.ingest-import-notice.is-warn { border-left-color: var(--amber); padding: 20px; }',
    expect: 'B9 .is-warn declares border-left-color and nothing else',
    alt: 'B1 padding is the same on all four shapes' },
  { t: CSS, name: 'THE TYPOGRAPHY does not follow the box into a notice',
    from: '.ingest-import-result h4,\r\n.ingest-import-notice h4 { font-size: 12.5px; margin: 0 0 6px; color: var(--ink); }',
    to:   '.ingest-import-result h4 { font-size: 12.5px; margin: 0 0 6px; color: var(--ink); }',
    expect: 'T1 h4 font-size matches in both' },
  { t: CSS, name: 'THE BOXES TOUCH: the stacking margin is removed',
    from: '.ingest-import-result,\r\n.ingest-import-notice {\r\n  margin-top: 12px; padding: 14px 16px;',
    to:   '.ingest-import-result,\r\n.ingest-import-notice {\r\n  padding: 14px 16px;',
    expect: 'S6 every box carries margin-top' },
  { t: CSS, name: 'THE LAST CHILD keeps a trailing gap inside its box',
    from: '.ingest-import-result > :last-child,\r\n.ingest-import-notice > :last-child { margin-bottom: 0; }',
    to:   '',
    expect: 'S8 and the last element inside a box has no trailing margin' },

  /* ---- the modal twin ----------------------------------------------------- */
  { t: CSS, name: 'THE MODAL TWIN diverges: the staged warning goes back to amber text',
    from: '  border-left-color: var(--red); border-radius: 6px;',
    to:   '  border-left-color: var(--amber); border-radius: 6px;',
    expect: 'M1 the staged warning resolves the SAME red accent as its twin' },
  { t: CSS, name: 'THE MODAL LAYOUT is changed alongside the warning',
    from: '.ingest-staged {\r\n  margin: 12px 0 0;',
    to:   '.ingest-staged {\r\n  margin: 20px 0 0;',
    expect: 'M7 and .ingest-staged itself is byte-identical' },

  /* ---- style ONLY --------------------------------------------------------- */
  { t: APP, name: 'STYLE ONLY BREAKS: a notice is reworded',
    from: "        '<h4>Check the table this file was for</h4>' +",
    to:   "        '<h4>Check the table this file came from</h4>' +",
    expect: 'L1 with the two class attributes undone, app.js is BYTE-IDENTICAL to BASE',
    alt: 'L2 the rendered TEXT is identical to BASE, word for word' },
  { t: APP, name: 'STYLE ONLY BREAKS: the two notices are reordered',
    from: "      '</div>' + notices + identity;",
    to:   "      '</div>' + identity + notices;",
    expect: 'S3 then the fraction notice',
    alt: 'L1 with the two class attributes undone, app.js is BYTE-IDENTICAL to BASE' },
  { t: APP, name: 'STYLE ONLY BREAKS: the advisory starts rejecting',
    from: '    const identity = r.identityNotice',
    to:   '    if (r.identityNotice) r.ok = false;\r\n    const identity = r.identityNotice',
    expect: 'L6 rendering rejects nothing and does not touch the plan',
    alt: 'L1 with the two class attributes undone, app.js is BYTE-IDENTICAL to BASE' },
  { t: APP, name: 'THE ACCENT CLASS is put on the wrong notice',
    from: '      ? \'<div class="ingest-import-notice is-warn">\' +',
    to:   '      ? \'<div class="ingest-import-notice is-alert">\' +',
    expect: 'S3 then the fraction notice' },
  /* the anchor is the single line, not the line plus its follower: CLCPA-266
   * put a comment between them and the two-line form reported ANCHOR 0. */
  { t: APP, name: 'A CLEAN IMPORT starts rendering empty notice boxes',
    from: '    const identity = r.identityNotice',
    to:   '    const identity = true || r.identityNotice',
    expect: 'L7 a clean import still renders exactly ONE box' },

  /* ---- the harness -------------------------------------------------------- */
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    /* the literal moved when the branch took main in: CLCPA-252 round 3 landed
     * on main mid-flight and this suite's baseline was re-pointed to 11c22d6,
     * so the control's anchor had to follow it. A mutation whose anchor has
     * gone stale reports ANCHOR 0 and skips silently, which is why the runner
     * counts a skip as a miss rather than a pass. */
    from: "const BASE = process.env.DAC_BASE_COMMIT || '11c22d6';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X5 BASE is a literal commit sha' },
  { t: SUITE, name: 'HARNESS: the style claims stop resolving and just grep the text',
    from: "const win = (el, prop) => {\r\n  const r = cascade.resolve(CSS_SRC, el, prop);",
    to:   "const win = (el, prop) => {\r\n  if (CSS_SRC.indexOf(prop) >= 0) return { value: 'var(--amber)', sel: 'grep', cond: 0 };\r\n  const r = cascade.resolve(CSS_SRC, el, prop);",
    /* a grep says "the declaration is there", which is the exact claim
     * CLCPA-248 and CLCPA-249 proved worthless. */
    expect: 'B3 info keeps the blue it always had',
    alt: 'B1 padding is the same on all four shapes' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-266 -- mutation controls');
log('======================================================================');

let caught = 0, missed = 0;
M.forEach((m) => {
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  if (n !== 1) { log('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED'); missed++; return; }
  fs.writeFileSync(m.t, base.replace(from, () => to));
  let out = '';
  try { out = execFileSync('node', ['suite_266.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }
  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const want = [m.expect].concat(m.alt ? [m.alt] : []);
  const hit = fails.filter(l => want.some(w => l.indexOf(w) >= 0));
  if (hit.length) {
    log('  red  ' + m.name);
    log('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 110));
    caught++;
  } else if (fails.length) {
    log('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    log('       want: ' + want.join(' OR '));
    log('       got : ' + fails[0].trim().slice(5, 110));
    missed++;
  } else { log('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.'); missed++; }
});

log('');
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length + ' guards');
let clean = '';
try { clean = execFileSync('node', ['suite_266.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-266-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
