/* The black-button ticket: + Add Row inverts to near-black on hover/active.
 *
 * THE MEASUREMENT IS THE BROWSER'S. A CSS assertion is not a rendering
 * observation -- that confusion is a named defect in this repo -- so the
 * colours in the ticket record come from getComputedStyle on the real element
 * with each state really applied, and this suite guards the RULE that produces
 * them plus the blast radius the argument depends on.
 *
 *   PRE-FIX   rest  bg rgba(0,0,0,0)     focus bg rgba(0,0,0,0)
 *             hover bg rgb(10,36,54)     active bg rgb(10,36,54)
 *   POST-FIX  all four transparent, foreground rgb(47,84,150) throughout
 *
 * The report said FOCUS. Focus was always clean; it is hover and active that
 * invert. A fix aimed at :focus would have changed nothing and measured green.
 *
 * SCOPED BY ID, like its neighbour. The shared-rule fix was written first and
 * backed out: suite_85_ui pins .btn:hover, .btn-link and .btn-link:hover
 * byte-identical and asserts the fix is scoped by id, which is CLCPA-85
 * round 2's standing ruling. The case for changing it is in the ticket record
 * and awaits the owner.
 *
 * BASE predates the change: 6498c57.
 *
 * Run:  node suite_black_button.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const CSS_REL = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const APP_REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || '6498c57';
const CSS_PATH = process.env.DAC_CSS_OVERRIDE || path.join(REPO, CSS_REL);
const CSS = fs.readFileSync(CSS_PATH, 'utf8');
const APP = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(REPO, APP_REL), 'utf8');
const CSS_BASE = execSync('git show ' + BASE + ':"' + CSS_REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => { try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); } };
/* CSS comments only: // is not a comment in CSS, and a URL contains one */
const cssCode = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

log('======================================================================');
log('BLACK BUTTON -- + Add Row keeps its background on hover and active');
log('  styles.css : ' + CSS_PATH);
log('  BASE       : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the defect, on the build that shipped it ----------------------- */
log('');
log('A. THE DEFECT, ON BASE');
guard('A-block', () => {
  const was = cssCode(CSS_BASE);
  ok(/\n\.btn:hover \{ background: var\(--ink-2\); \}/.test(was),
    'A1 .btn:hover fills with --ink-2 at 0-2-0');
  ok(/\.btn-link \{\s*background: transparent;/.test(was),
    'A2 .btn-link rests transparent at 0-1-0, which loses to it');
  ok(/\n\.btn-link:hover \{ text-decoration: underline; \}/.test(was),
    'A3 and .btn-link:hover set ONLY text-decoration, so nothing contested the fill');
  ok(/#ingest-template:hover \{ background: transparent; \}/.test(was),
    'A4 one control had a per-id patch; the reported one did not');
  ok(!/#ingest-add-row:hover/.test(was),
    'A5 nothing held the background for + Add Row');
});

/* ---- B. the fix --------------------------------------------------------- */
log('');
log('B. A RULE SCOPED TO THE CONTROL');
guard('B-block', () => {
  const code = cssCode(CSS);
  ok(/#ingest-add-row:hover,\s*\r?\n#ingest-add-row:active \{ background: transparent; \}/.test(code),
    'B1 #ingest-add-row holds its background on hover AND active');
  /* NEWLINE-ANCHORED. ".ingest-form-actions .btn:hover { ... }" CONTAINS the
   * bare selector, so an unanchored test is satisfied by that rule and cannot
   * fail for the reason it claims -- a mutation gutting the real .btn:hover
   * went unnoticed against the loose form. */
  ok(/\n\.btn:hover \{ background: var\(--ink-2\); \}/.test(code),
    'B2 .btn:hover itself is untouched -- solid buttons still darken');
  ok(/\n\.btn-link:hover \{ text-decoration: underline; \}/.test(code),
    'B3 and .btn-link:hover is untouched, as CLCPA-85 round 2 requires');
  ok(/#ingest-template:hover \{ background: transparent; \}/.test(code),
    'B4 the neighbour\'s per-id patch is left in place');
  /* no new literal: transparent is .btn-link's own resting value */
  const rule = /#ingest-add-row:hover,[\s\S]*?\}/.exec(code);
  ok(rule && !/#[0-9a-fA-F]{3,8}/.test(rule[0]) && !/rgb/.test(rule[0]),
    'B5 and no colour literal was introduced');
});

/* ---- C. the blast radius, measured ------------------------------------- */
log('');
log('C. WHO CARRIES BOTH CLASSES');
guard('C-block', () => {
  /* A CLASS IS A WHOLE TOKEN, not a substring. \b treats "-" as a word
   * boundary, so /\bbtn\b/ matches inside "btn-link" and reported every
   * control as carrying .btn -- the same false-positive class this repo has
   * already paid for with /total/i. Split on whitespace and compare exactly. */
  const hasClass = (list, name) => String(list).split(/\s+/).indexOf(name) >= 0;
  const both = [];
  const only = [];
  const re = /class="([^"]*)"/g;
  let m;
  while ((m = re.exec(APP))) {
    if (!hasClass(m[1], 'btn-link')) continue;
    (hasClass(m[1], 'btn') ? both : only).push(m[1]);
  }
  ok(both.length === 2,
    'C1 exactly two controls carry BOTH btn and btn-link -- ' + JSON.stringify(both));
  ok(only.length === 5,
    'C2 and five carry btn-link alone (one has no id at all) -- ' + only.length);
  /* order-agnostic: id and class are not written in a fixed order */
  ['ingest-add-row', 'ingest-template'].forEach((id) => {
    const tag = new RegExp('<[^>]*id="' + id + '"[^>]*>').exec(APP);
    const cls = tag && /class="([^"]*)"/.exec(tag[0]);
    ok(cls && hasClass(cls[1], 'btn') && hasClass(cls[1], 'btn-link'),
      'C3.' + id + ' is one of the two -- ' + (cls ? cls[1] : '(not found)'));
  });
  ['ingest-history-showall', 'ingest-history-showless', 'ml-breaks-reset', 'ml-ramp-reset']
    .forEach((id) => {
      const tag = new RegExp('<[^>]*id="' + id + '"[^>]*>').exec(APP);
      const cls = tag && /class="([^"]*)"/.exec(tag[0]);
      ok(cls && !hasClass(cls[1], 'btn'),
        'C4.' + id + ' never carried .btn, so nothing about it changes');
    });
});

/* ---- D. what the browser measured --------------------------------------- */
log('');
log('D. THE RENDERED EVIDENCE IS COMMITTED');
guard('D-block', () => {
  ['gesture_black_button.js', 'button-states-prefix.txt', 'button-states-postfix.txt']
    .forEach((f) => ok(fs.existsSync(path.join(__dirname, f)),
      'D1 evidence committed: ' + f));
  const pre = fs.readFileSync(path.join(__dirname, 'button-states-prefix.txt'), 'utf8');
  const post = fs.readFileSync(path.join(__dirname, 'button-states-postfix.txt'), 'utf8');
  /* THE SETTLED COLOUR, not a frame of the transition. These controls animate
   * background over 0.15s, and a read at a fixed delay returned 0.992 on one
   * run and 0.97 on the next -- a fake precision that nearly went into the
   * record as a measurement. The gesture script polls until two reads agree. */
  ok(/hover\s+bg rgb\(10, 36, 54\)/.test(pre),
    'D2 BEFORE: the browser measured a near-black hover fill');
  ok(/active\s+bg rgb\(10, 36, 54\)/.test(pre),
    'D3 BEFORE: and a near-black active fill');
  ok(!/rgb\(10, 36, 54\)/.test(post) && !/rgba\(10, 36, 54/.test(post),
    'D4 AFTER: no near-black fill anywhere in the sweep');
  const addRow = /Add Row \(reported\)[\s\S]*?\n\n/.exec(pre);
  ok(addRow && /focus\s+bg rgba\(0, 0, 0, 0\)/.test(addRow[0]),
    'D5 and FOCUS was clean before the fix -- the report named the wrong state');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(cssCode(self)),
    'X1 BASE is a literal sha that predates the change');
  ok(/button-states-prefix\.txt/.test(self) && /getComputedStyle/.test(
      fs.readFileSync(path.join(__dirname, 'gesture_black_button.js'), 'utf8')),
    'X2 the colours come from getComputedStyle in a real browser, not from CSS text');
  ok(/const cssCode = /.test(self),
    'X3 the comment stripper is CSS-only: // is not a comment in CSS');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-black-button-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
