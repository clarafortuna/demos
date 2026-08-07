/* check_hidden_guard.js -- static guard over the [hidden] rule in styles.css.
 *
 * Why this file is committed and the browser harnesses are not: the runtime
 * sweep proves the rule WORKS, but it lives in a scratch directory and will not
 * be here in six months. This one needs no browser and no dependencies, so it
 * can sit in the repo and keep failing long after the sweep is gone.
 *
 * It asserts three things:
 *
 *   1. the generic rule `[hidden] { display: none !important }` is present
 *   2. it is the LAST display-setting rule in the file -- seven `!important`
 *      rules tie with it on specificity, so source order is what makes it win;
 *      moving it up silently breaks it while leaving it present
 *   3. no per-class `.foo[hidden] { display: none }` guard has come back --
 *      seven of those accumulated one at a time before this rule replaced them,
 *      and an eighth means someone patched an instance instead of the class
 *
 * Run:  node Data/check_hidden_guard.js        (from ExecutiveDashboard_dev/)
 * Exits non-zero on failure, so it works as a pre-commit or CI step.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CSS = path.join(__dirname, '..', 'styles.css');

// The rule we require, matched loosely on whitespace but strictly on content:
// the bare [hidden] selector, display none, and !important.
const GENERIC = /(^|\})\s*\[hidden\]\s*\{\s*display\s*:\s*none\s*!important\s*;?\s*\}/;

// A per-class guard: anything MORE than the bare attribute selector, ending in
// [hidden], set to display none. `.dac-map-terr-opt[hidden] { display: none; }`
// is the shape we are refusing to see again.
const PER_CLASS = /(^|[},])\s*([^\s{},]+\[hidden\][^\s{},]*)\s*\{\s*display\s*:\s*none/g;

function main() {
  const raw = fs.readFileSync(CSS, 'utf8');
  // Comments talk ABOUT these selectors, at length. Strip them or the guard
  // reads its own documentation as a violation.
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');
  const fails = [];

  if (!GENERIC.test(css)) {
    fails.push('the generic rule `[hidden] { display: none !important; }` is missing from ' +
               'styles.css. Without it every author `display` rule un-hides elements ' +
               'marked hidden in markup, because the browser\'s own [hidden] rule loses ' +
               'to any author declaration.');
  } else {
    // Position check: nothing may set `display` after it. Slice past the END of
    // the matched rule, or the rule reads as coming after itself.
    const hit = css.match(GENERIC);
    const after = css.slice(hit.index + hit[0].length);
    const later = after.match(/(^|\})\s*([^{}]+)\{[^{}]*display\s*:/);
    if (later) {
      fails.push('the generic [hidden] rule is no longer last. `' +
                 later[2].trim().replace(/\s+/g, ' ').slice(0, 60) +
                 '` sets `display` after it. Seven !important rules tie with [hidden] on ' +
                 'specificity, so the tie breaks on source order -- the rule only wins ' +
                 'from the bottom of the file.');
    }
  }

  const revived = [];
  let m;
  while ((m = PER_CLASS.exec(css)) !== null) revived.push(m[2]);
  if (revived.length) {
    fails.push('per-class [hidden] guard(s) are back: ' + revived.join(', ') +
               '. Seven of these accumulated one at a time before the generic rule ' +
               'replaced them. Fix the class of bug at the generic rule, or give the ' +
               'element a reason not to use the attribute -- do not add another one-off.');
  }

  if (fails.length) {
    console.error('FAIL  Data/check_hidden_guard.js');
    fails.forEach((f, i) => console.error('\n  ' + (i + 1) + '. ' + f));
    process.exit(1);
  }
  console.log('PASS  [hidden] guard present, last display rule in the file, no per-class guards');
}

main();
