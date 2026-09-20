/* CLCPA-287: the page keeps the promise the dialog makes.
 *
 * The rejection text says, in as many words: "Add Year will still add the
 * year, and the page will say what was rejected." The page said nothing. The
 * only trace was the red note inside the dialog, which disappears with it, so
 * an operator who closed the dialog had no record of why their file was
 * refused.
 *
 * THE GESTURES, in a real browser, both of the two the owner named:
 *
 *   WRONG TABLE  an A3 file offered to H1
 *     before  page: (nothing)
 *     after   page: "Nothing was imported / The draft below is untouched. Fix
 *                    the file and import again. / The file has no
 *                    "Borough / County" column..."
 *
 *   MALFORMED    two columns sharing one heading
 *     before  page: (nothing)
 *     after   page: "Nothing was imported ... (no label), column
 *                    "Non-DAC Repairs": The file has two columns with the
 *                    same heading..."
 *
 *   The dialog stays OPEN in both, which is what CLCPA-262 requires.
 *
 * NOTHING NEEDED WRITING TO SAY IT. i.importResult already held the rejected
 * plan, renderIngestImportResult already had its !r.ok branch, and the mount
 * is already in the editor markup. The report existed and was never drawn,
 * because the failure path returns before anything repaints. One call.
 *
 * BASE predates the change: c24892d.
 *
 * Run:  node suite_287.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
/* CLCPA-293's delta to the import path, extracted from app.js and shared,
 * so the four suites that reverse it cannot drift from it or each other. */
const bii = require('../_kit/bii_deltas.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || 'c24892d';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);
const SRC = fs.readFileSync(APP, 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => { try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); } };
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p);

function grab(name, src) {
  const anchor = '\r\n  function ' + name + '(';
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error('grab: no function ' + name);
  let j = src.indexOf('{', i), d = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) { j = k; break; } }
  }
  return src.slice(i + 2, j + 1);
}
/** the rejection panel, built and CALLED on a rejected plan */
const panel = (src, plan) => new Function(
  'escapeHtml',
  grab('renderIngestImportResult', src) + '\nreturn renderIngestImportResult;'
)(s => String(s))(plan);

const REJECTED = {
  ok: false,
  rejections: [
    { why: 'The file has two columns with the same heading, so which one wins is ambiguous.',
      column: 'Non-DAC Repairs' },
  ],
};

log('======================================================================');
log('CLCPA-287 -- the page says what was rejected');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the defect, on the build that shipped it ----------------------- */
log('');
log('A. THE PROMISE, AND THE SILENCE');
guard('A-block', () => {
  ok(/Add Year will still add the year, and the page will say what was /.test(BASE_SRC),
    'A1 the dialog promised the page would say what was rejected');
  const oldPath = grab('openAddYearDialog', BASE_SRC);
  ok(/err\.style\.display = 'block';\s*\r?\n\s*\}\s*\r?\n\s*return;/.test(oldPath),
    'A2 and the failure path returned straight after the dialog note');
  ok(!/refreshIngestNotices\(\);\s*\r?\n\s*return;/.test(oldPath),
    'A3 repainting nothing on the page first');
  /* the report ALREADY EXISTED on BASE: that is what makes this one call */
  ok(/<h4>Nothing was imported<\/h4>/.test(BASE_SRC),
    'A4 while the rejection panel was already written, and never drawn');
});

/* ---- B. the fix --------------------------------------------------------- */
log('');
log('B. THE PAGE IS REPAINTED');
guard('B-block', () => {
  const nowPath = codeOnly(grab('openAddYearDialog', SRC));
  /* RE-PINNED IN ROUND 2, not widened. Round 1 asserted the path repaints and
   * then RETURNS, holding the dialog open. The owner ruled in round 2 that a
   * rejected Load dismisses exactly as an accepted one does, so the return is
   * gone and the path falls through to the same close(). The assertion moves
   * to the new contract rather than relaxing to cover both. */
  ok(/refreshIngestNotices\(\);\s*\r?\n\s*\}\s*\r?\n\s*close\(\);/.test(nowPath),
    'B1 the failure path repaints the notice mount and then closes, as an accepted load does');
  ok(/const mount = document\.getElementById\('ingest-import-mount'\);/.test(
      codeOnly(grab('refreshIngestNotices', SRC))),
    'B2 and that helper repaints THAT MOUNT ONLY, not the page');
  /* The repaint still touches ONE mount and nothing else. In round 1 that
   * mattered because it kept the dialog alive; in round 2 the dialog closes
   * anyway, and it matters because a full rebuild would discard the draft the
   * report is describing as untouched. The label said "so the dialog stays
   * open", which stopped being true the moment close() moved: a passing
   * assertion whose words are wrong is the kind that gets believed later. */
  ok(!/rerenderIngestAll\(\);\s*\r?\n\s*return;/.test(nowPath),
    'B3 nothing rebuilds the view: the repaint touches one mount, and close() alone dismisses');
});

/* ---- C. what the panel says -------------------------------------------- */
log('');
log('C. THE REPORT ITSELF, BUILT AND CALLED');
guard('C-block', () => {
  const html = panel(SRC, REJECTED);
  ok(/ingest-import-bad/.test(html),
    'C1 it is the CLCPA-266 box with the red accent');
  ok(/Nothing was imported/.test(html), 'C2 headed "Nothing was imported"');
  ok(/The draft below is untouched/.test(html),
    'C3 saying the draft is untouched, which is the operator\'s real question');
  ok(/two columns with the same heading/.test(html), 'C4 and giving the reason');
  ok(/Non-DAC Repairs/.test(html), 'C5 naming the column it objected to');
  /* unchanged from BASE: this ticket draws the panel, it does not rewrite it */
  /* CLCPA-293 adds the accepted-totals advisory to this panel. Reversed
   * through the shared kit; every other byte still has to match. */
  /* CLCPA-310 formats the value the fraction advisory shows. Reversed through
   * the shared kit as well, composed rather than widened. */
  ok(bii.reverseRender310(bii.reverseRender293(grab('renderIngestImportResult', SRC))) ===
     grab('renderIngestImportResult', BASE_SRC),
    'C6 and the panel is BYTE-IDENTICAL to BASE: this ticket only draws it');
});

/* ---- D. the CLCPA-276 lifecycle ---------------------------------------- */
log('');
log('D. THE LIFECYCLE IT INHERITS');
guard('D-block', () => {
  const code = codeOnly(SRC);
  /* the rejection lives in the SAME field the success receipt does, so it
   * inherits the lifecycle by construction rather than by a second rule */
  ok(/i\.importResult = plan;/.test(code),
    'D1 a rejected plan is stored in i.importResult, like a successful one');
  ok(/t\.importResult = null;/.test(codeOnly(grab('clearIngestNotices', SRC))),
    'D2 and clearIngestNotices empties that field');
  ok((code.match(/clearIngestNotices\(/g) || []).length >= 4,
    'D3 which the reset, switch and save paths already call');
  ok(/refreshIngestNotices\(\);/.test(codeOnly(grab('rerenderIngestEditor', SRC))),
    'D4 and the editor rerender repaints the mount, so a clear reaches the screen');
  /* MEASURED IN THE BROWSER: the year-switch leg. The Reset and Save legs
   * could not be driven -- see the note in X. */
  const life = fs.readFileSync(path.join(__dirname, 'lifecycle-287-output.txt'), 'utf8');
  ok(/report present : true/.test(life),
    'D5 (live) the report is on the page after a rejected import');
  ok(/"status":". No Changes"/.test(life),
    'D6 (live) and a rejected import leaves the draft untouched: No Changes');
});

/* ---- X. the harness, and what it could not show ------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha that predates the change');
  ok(/panel\(SRC, REJECTED\)/.test(self),
    'X2 the panel is BUILT AND CALLED, not asserted from source text');
  ['gesture_287.js', 'gesture-287-output.txt', 'lifecycle-287-output.txt']
    .forEach(f => ok(fs.existsSync(path.join(__dirname, f)),
      'X3 evidence committed: ' + f));
  /* WHAT THIS DOES NOT SHOW, stated rather than glossed. The year-switch leg
   * of the CLCPA-276 lifecycle was driven live and passes. The Reset and Save
   * legs were NOT: with the draft dirtied, a click on #ingest-reset produced
   * no discard prompt and no state change in the driver, so the leg could not
   * be exercised. D1-D4 show the rejection uses the same field and the same
   * clearing function as the success receipt, so it inherits the lifecycle by
   * construction -- but that is an argument, not a measurement, and the
   * distinction belongs in the record rather than in a green tick. */
  const g = fs.readFileSync(path.join(__dirname, 'lifecycle-287-output.txt'), 'utf8');
  ok(/discard prompt : false/.test(g),
    'X4 and the un-driven Reset leg is recorded in the evidence, not hidden');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-287-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
