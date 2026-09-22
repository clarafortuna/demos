/* CLCPA-247 acceptance: CLCPA-242's fixes reach the fourteen section-page
 * tooltip surfaces that its own suite pinned out of scope.
 *
 * THE RENDERED HALF IS repro_247.js, and it is where the claim actually lives:
 * a real pointer travelling through every child of every surface, on a served
 * build, with the BEFORE side served from a commit. This suite pins the source
 * that produces it, and reads that run's verdicts back so the two cannot
 * drift apart.
 *
 * WHAT THIS TICKET DOES NOT DO, asserted rather than trusted: it does not
 * touch placeTooltipAtPointer, it does not touch fix C, and it does not
 * redesign the delegated handler. Every one of those is a byte-identity check
 * below.
 *
 * Pins:
 *   DAC_BASE_COMMIT    the pre-change baseline, default d880c0b
 *   DAC_APP_OVERRIDE   feed a deliberately broken app.js in (mut_247.js)
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { SURFACES, ALL_SELECTORS } = require('./surfaces.js');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSSREL = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const OUT = path.join(__dirname, 'suite-247-output.txt');
const CRLF = String.fromCharCode(13) + String.fromCharCode(10);
const LF = new RegExp(String.fromCharCode(92) + 'r?' + String.fromCharCode(92) + 'n', 'g');

const BASE = process.env.DAC_BASE_COMMIT || 'd880c0b';
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
/* git blobs are LF and the working tree is CRLF, and every anchor below is
 * CRLF: an un-normalised baseline resolves nothing and reads as "the old code
 * was never there" */
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: ROOT, maxBuffer: 1 << 29 }).toString('utf8').replace(LF, CRLF);

const RAW_POSITIONER = "tip.style.left = (e.pageX + 14)";
const CALL = 'placeTooltipAtPointer(tip, e)';

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  PASS  ' + m); } else { fail++; log('  FAIL  ' + m); } };
const guard = (label, fn) => {
  try { fn(); } catch (e) { fail++; log('  FAIL  ' + label + ' threw: ' + (e && e.message)); }
};
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const count = (s, needle) => s.split(needle).length - 1;

/* ONE EXTRACTOR, shared with gate_247 and self-tested in block 0 below.
 * Its header records why an indentation anchor cannot read this file. */
const { grab: grabIn } = require('./extract.js');
const grab = (name, src) => grabIn(name, src || SRC);

log('CLCPA-247: the fourteen section-page tooltip surfaces join CLCPA-242');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ---- 0. THE EXTRACTOR CHECKS ITSELF FIRST ---------------------------- */
/* Because the extractor is what failed last time, and it failed SILENTLY: it
 * returned blocks that were syntactically fine on their own and simply
 * contained half the file. Two checks, on both builds: every block parses,
 * and no block contains the head of another top-level function. */
log('0. THE EXTRACTOR');
guard('0  extractor', () => {
  const HEADS = [...new Set(SURFACES.map(s => s.fn))].concat([
    'wireControlTips', 'hideExecTooltip', 'wireSectionInteractions',
    'wireExecutiveInteractions', 'placeTooltipAtPointer', 'ensureTooltip']);
  let bad = [];
  [['shipped', SRC], ['base', BASE_SRC]].forEach(([which, src]) => {
    HEADS.forEach((n) => {
      const b = grab(n, src);
      if (!b) { bad.push(which + ':' + n + ' not found'); return; }
      try { new Function('return ' + b.replace(/^\s*function/, 'function') + ';'); }
      catch (e) { bad.push(which + ':' + n + ' does not parse (' + e.message + ')'); }
      /* AN OVER-READ SWALLOWS A SIBLING, so look for another of the functions
       * under test declared inside this block.
       *
       * The first version of this check looked for ANY function head and
       * flagged drawSectionEArc, which legitimately contains a nested
       * drawSemi() helper -- a false alarm from a check that could not tell a
       * nested declaration from a swallowed sibling. It also stripped the name
       * with a regex whose `.*` cannot cross the newline it was matching, so
       * it reported the offender as the empty string. Named siblings only. */
      const others = HEADS.filter(x => x !== n &&
        new RegExp('\\r\\n(?:  |    )?(?:async )?function ' + x + '\\(').test(b));
      if (others.length) bad.push(which + ':' + n + ' over-read into ' + others.join(','));
    });
  });
  bad.forEach(b => log('    ' + b));
  ok(bad.length === 0, '0.1 every block parses and none over-reads: ' + bad.length + ' problem(s)');
  /* AND IT CAN STILL FAIL: a name that is not there must come back null,
   * not come back with somebody else's block. */
  ok(grab('thisFunctionDoesNotExist') === null,
    '0.2 and a name that is not in the file returns nothing');
});

/* ---- A. THE POSITIONERS --------------------------------------------- */
log('');
log('A. THE POSITIONERS');
guard('A  positioners', () => {
  const was = codeOnly(BASE_SRC), now = codeOnly(SRC);
  ok(count(was, RAW_POSITIONER) === 14,
    'A1 BASE ' + BASE + ' carried exactly fourteen raw positioners: ' +
    count(was, RAW_POSITIONER));
  ok(count(now, RAW_POSITIONER) === 0,
    'A2 the shipped build carries none: ' + count(now, RAW_POSITIONER));
  const before = count(was, CALL), after = count(now, CALL);
  log('    placeTooltipAtPointer(tip, e) call sites: ' + before + ' -> ' + after);
  ok(after - before === 14,
    'A3 fourteen call sites were added, one per retired positioner: +' + (after - before));

  /* EVERY NAMED WIRING FUNCTION GOES THROUGH IT. A count alone cannot say the
   * fourteen calls landed in the fourteen places. */
  const fns = [...new Set(SURFACES.map(s => s.fn))];
  fns.forEach((fn) => {
    const body = grab(fn);
    ok(!!body, 'A4.' + fn + ' is still in the bundle');
    if (!body) return;
    const n = count(codeOnly(body), CALL);
    const expected = SURFACES.filter(s => s.fn === fn).length;
    ok(n === expected, 'A5.' + fn + ' calls the shared positioner ' + expected +
      ' time(s), one per site it owns: ' + n);
    ok(count(codeOnly(body), RAW_POSITIONER) === 0,
      'A6.' + fn + ' has no raw positioner left');
  });
});

/* ---- B. THE SHARED CLAMP IS UNTOUCHED -------------------------------- */
log('');
log('B. WHAT THIS TICKET DID NOT TOUCH');
guard('B  untouched', () => {
  /* EXTEND, DO NOT REDESIGN. The clamp, the flip, the slide and fix B all
   * arrive by ROUTING the fourteen through code that already shipped and was
   * already proved. If that function moved, this ticket did something it was
   * not asked to do. */
  ok(grab('placeTooltipAtPointer') === grab('placeTooltipAtPointer', BASE_SRC),
    'B1 placeTooltipAtPointer is byte-identical to ' + BASE + ': the clamp, the ' +
    'horizontal flip, the vertical slide and fix B are the shipped ones');
  ok(grab('ensureTooltip') === grab('ensureTooltip', BASE_SRC),
    'B2 ensureTooltip is byte-identical: the shared div is still shared');
  /* FIX C IS NOT IN SCOPE, and is asserted absent rather than remembered */
  ok(!/tipOwner|claimTip|releaseTip|data-tip-owner/.test(codeOnly(SRC)),
    'B3 no claim/release mechanism was smuggled in: fix C is still its own ticket');
  const ens = count(codeOnly(SRC), 'ensureTooltip()');
  ok(ens >= 9, 'B4 the shared div still has all its callers: ' + ens);
});

/* ---- C. FIX A: THE SURFACES THAT OWN THE TIP ------------------------- */
log('');
log('C. FIX A, EXTENDED TO THE FOURTEEN');
guard('C  ownsTip', () => {
  const wc = grab('wireControlTips'), wcBase = grab('wireControlTips', BASE_SRC);
  ok(!!wc && !!wcBase, 'C1 wireControlTips is present in both builds');
  const decl = /const OWNS_TIP = ([\s\S]*?);\r\n/.exec(wc);
  const declBase = /const OWNS_TIP = ([\s\S]*?);\r\n/.exec(wcBase);
  ok(!!decl && !!declBase, 'C2 both builds declare OWNS_TIP');
  if (!decl || !declBase) return;
  /* THE SELECTOR STRING IS EVALUATED, NOT PATTERN-MATCHED. It is written as a
   * concatenation across a dozen lines with comments between them, and a
   * regex over that text would be checking the formatting. */
  const value = new Function('return ' + codeOnly(decl[1]).replace(/\r\n/g, ' ') + ';')();
  const valueBase = new Function('return ' + codeOnly(declBase[1]).replace(/\r\n/g, ' ') + ';')();
  const sels = value.split(',').map(s => s.trim()).filter(Boolean);
  const selsBase = valueBase.split(',').map(s => s.trim()).filter(Boolean);
  log('    OWNS_TIP: ' + selsBase.length + ' selectors -> ' + sels.length);

  /* THE FIVE THAT WERE ALREADY THERE MUST STILL BE THERE. An "extend" that
   * replaces the list would pass a naive contains-check on the new entries
   * and silently un-fix CLCPA-242 and CLCPA-245. */
  selsBase.forEach((s, i) => ok(sels.indexOf(s) >= 0,
    'C3.' + i + ' the pre-existing surface ' + s + ' is still registered'));

  ALL_SELECTORS.forEach((s, i) => ok(sels.indexOf(s) >= 0,
    'C4.' + i + ' ' + s + ' is registered as a tip-owning surface'));
  ok(selsBase.every(s => sels.indexOf(s) >= 0) && sels.length === selsBase.length + ALL_SELECTORS.length,
    'C5 the list is exactly the old one plus this ticket\'s ' + ALL_SELECTORS.length +
    ': ' + sels.length);

  /* IT IS A VALID SELECTOR LIST. closest() throws on a malformed one, which
   * would turn the early-out into an exception inside a document-level
   * mouseover handler -- every tooltip in the app, on every move. */
  ok(/^[^{}]+$/.test(value) && !/,\s*,/.test(value) && !/,\s*$/.test(value.trim()),
    'C6 the selector list is well formed: no empty term, no trailing comma');

  /* THE EARLY-OUT IS STILL AN EARLY-OUT, AND STILL ONLY AN EARLY-OUT. The
   * control tips must still close when the pointer leaves a control for
   * ordinary page background, so hide() has to remain reachable after it. */
  const code = codeOnly(wc);
  /* THE ORDER IS CHECKED INSIDE THE MOUSEOVER HANDLER, not across the whole
   * function. The first version searched for `hide();` starting AFTER the
   * early-out, so when the mutation control swapped the two lines it simply
   * found the OTHER hide() in the mouseout handler further down and passed.
   * The control caught it; the assertion is now scoped to the block it is
   * about, and the FIRST hide() in that block is the one that matters. */
  const hStart = code.indexOf("document.addEventListener('mouseover'");
  const hEnd = code.indexOf('});', hStart);
  const handler = hStart >= 0 && hEnd > hStart ? code.slice(hStart, hEnd) : '';
  ok(!!handler, 'C7a the delegated mouseover handler is still there');
  const iShow = handler.indexOf('if (el) { show(el); return; }');
  const iOwns = handler.indexOf('if (ownsTip(e)) return;');
  const iHide = handler.indexOf('hide();');
  ok(iShow >= 0 && iOwns > iShow && iHide > iOwns,
    'C7 the order inside that handler is unchanged: control first, then the ' +
    'early-out, then hide  [show ' + iShow + ', ownsTip ' + iOwns + ', hide ' + iHide + ']');
  ok(/const ownsTip = \(e\) =>/.test(code) && /closest\(OWNS_TIP\)/.test(code),
    'C8 ownsTip still reads the list through closest()');
});

/* ---- D. HIDE ON RE-RENDER ------------------------------------------- */
log('');
log('D. NOTHING SHOWING WHEN THE VIEW RE-RENDERS');
guard('D  hide', () => {
  const decl = /const POINTER_TIP_SELECTORS = ([\s\S]*?);\r\n/.exec(SRC);
  ok(!!decl, 'D1 the build declares one list of pointer-following tips');
  if (!decl) return;
  const list = new Function('return ' + decl[1].replace(/\r\n/g, ' ') + ';')();
  log('    POINTER_TIP_SELECTORS: ' + JSON.stringify(list));

  /* THE LIST IS CHECKED AGAINST THE BUNDLE, NOT AGAINST A COPY IN THIS FILE.
   * A retyped list proves the suite agrees with itself. Every entry must be a
   * div the shipped code actually creates, and every div the shipped code
   * creates must be in the list. */
  const created = [...new Set((codeOnly(SRC)
    .match(/tip\.className = '([a-z0-9-]+)'/g) || [])
    .map(m => '.' + m.replace(/.*'([a-z0-9-]+)'.*/, '$1')))];
  log('    tip divs the bundle creates: ' + JSON.stringify(created));
  created.forEach((c, i) => ok(list.indexOf(c) >= 0,
    'D2.' + i + ' ' + c + ' is on the hide list'));
  list.forEach((c, i) => ok(c === '.exec-tooltip' || created.indexOf(c) >= 0,
    'D3.' + i + ' ' + c + ' is a div the bundle really creates'));
  ok(list.indexOf('.exec-tooltip') >= 0,
    'D4 and the shared div is on it, which ensureTooltip creates by another route');

  /* DRIVEN, on both builds, with a fake document: BASE clears one box, the
   * shipped build clears all of them. A source-level check cannot see a loop
   * that iterates the list and forgets to clear. */
  const drive = (src) => {
    const body = grab('hideExecTooltip', src);
    if (!body) return null;
    const boxes = {};
    const d = (sel) => (boxes[sel] = boxes[sel] ||
      { style: { opacity: '1' }, innerHTML: 'stale' });
    const declText = /const POINTER_TIP_SELECTORS = [\s\S]*?;\r\n/.exec(src);
    const fn = new Function('document', 'POINTER_TIP_SELECTORS_OUTER',
      (declText ? declText[0] : '') +
      'const f = ' + body + '; return function(){ f(); return null; };')(
      { querySelector: d }, null);
    fn();
    return boxes;
  };
  const nowBoxes = drive(SRC);
  const baseBoxes = drive(BASE_SRC);
  ok(baseBoxes && Object.keys(baseBoxes).length === 1,
    'D5 BASE cleared exactly one box: ' + JSON.stringify(Object.keys(baseBoxes || {})));
  /* AGAINST THE BUNDLE, NOT AGAINST THE LIST. Comparing the driven result to
   * list.length is self-referential: drop a div from the list and both sides
   * shrink together, which is exactly what the mutation control did while
   * this stayed green. The claim is that every tip div the bundle CREATES is
   * cleared, so that is what it is measured against. */
  ok(nowBoxes && created.every(c => Object.keys(nowBoxes).indexOf(c) >= 0),
    'D6 the shipped build clears every tip div the bundle creates (' +
    created.length + '): ' + JSON.stringify(Object.keys(nowBoxes || {})));
  Object.keys(nowBoxes || {}).forEach((k, i) => {
    ok(nowBoxes[k].style.opacity === '0' && nowBoxes[k].innerHTML === '',
      'D7.' + i + ' ' + k + ' is hidden AND its content cleared');
  });

  /* CALLED FROM BOTH RENDER PATHS, and first in each. */
  const wsi = codeOnly(grab('wireSectionInteractions') || '');
  const wei = codeOnly(grab('wireExecutiveInteractions') || '');
  ok(/hideExecTooltip\(\);/.test(wsi),
    'D8 the SECTION render path calls it, which is what this ticket adds');
  ok(/hideExecTooltip\(\);/.test(wei),
    'D9 and the executive render path still does');
  const iHide = wsi.indexOf('hideExecTooltip();');
  const iWire = wsi.indexOf('wireRankToggle();');
  ok(iHide >= 0 && iWire > iHide,
    'D10 and on the section path it runs BEFORE anything is wired');
  ok(!/hideExecTooltip\(\);/.test(codeOnly(grab('wireSectionInteractions', BASE_SRC) || '')),
    'D11 BASE ' + BASE + ' did not call it from the section path');
});

/* ---- E. THE FOURTEEN ARE REAL --------------------------------------- */
log('');
log('E. THE INVENTORY IS OF THINGS THAT EXIST');
guard('E  inventory', () => {
  ok(SURFACES.length === 14, 'E1 fourteen sites are named: ' + SURFACES.length);
  const code = codeOnly(SRC);
  ALL_SELECTORS.forEach((sel, i) => {
    /* the selector is looked for as the bundle spells it in a query or a
     * class attribute, so a registered surface that no longer exists is a
     * failure rather than dead registration */
    const bare = sel.replace(/^[.#]/, '').replace(/\[.*$/, '').replace(/ .*$/, '');
    ok(code.indexOf(bare) >= 0,
      'E2.' + i + ' ' + sel + ' names something the bundle renders');
  });
  const fns = [...new Set(SURFACES.map(s => s.fn))];
  log('    wiring functions: ' + fns.join(', '));
  ok(fns.length === 11, 'E3 across eleven wiring functions: ' + fns.length);
});

/* ---- F. THE RENDERED VERDICTS --------------------------------------- */
log('');
log('F. WHAT THE BROWSER SAW');
guard('F  rendered', () => {
  const read = (l) => {
    const p = path.join(__dirname, 'verdicts-' + l + '.json');
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  };
  const before = read('before'), after = read('after');
  ok(!!before && !!after, 'F1 both runs of repro_247 left their verdicts');
  if (!before || !after) return;
  ok(before.length === 14 && after.length === 14,
    'F2 both walked all fourteen: ' + before.length + ' / ' + after.length);
  const hides = (v) => v.filter(x => x.opens && !x.survives).map(x => x.n);
  const off = (v) => v.filter(x => x.offscreen).map(x => x.n);
  log('    hides mid-travel  before ' + JSON.stringify(hides(before)) +
    '  after ' + JSON.stringify(hides(after)));
  log('    off screen        before ' + JSON.stringify(off(before)) +
    '  after ' + JSON.stringify(off(after)));
  ok(hides(before).length === 7,
    'F3 BEFORE, seven surfaces hid mid-travel: ' + JSON.stringify(hides(before)));
  ok(hides(after).length === 0,
    'F4 AFTER, none does: ' + JSON.stringify(hides(after)));
  ok(off(before).length === 5,
    'F5 BEFORE, five went off screen at their worst case: ' + JSON.stringify(off(before)));
  ok(off(after).length === 0,
    'F6 AFTER, none does: ' + JSON.stringify(off(after)));
  ok(after.every(x => x.opens), 'F7 and every one of the fourteen still opens');
  /* THE SEVEN ARE THE SHARED-DIV ONES, which is the whole argument for fix A:
   * the six with a div of their own were never reachable by the blanket hide,
   * and the eighth shared one is an SVG circle with no child for the pointer
   * to cross into. */
  const sharedNs = SURFACES.filter(s => s.shared).map(s => s.n);
  ok(hides(before).every(n => sharedNs.indexOf(n) >= 0),
    'F8 and every one of them writes to the SHARED div: ' + JSON.stringify(sharedNs));
});

/* ---- G. BLAST RADIUS ------------------------------------------------- */
log('');
log('G. WHAT ELSE MOVED');
guard('G  radius', () => {
  const names = new Set();
  [SRC, BASE_SRC].forEach(s => {
    [/\r\n  (?:async )?function (\w+)\(/g, /\r\nfunction (\w+)\(/g].forEach(r => {
      let m; while ((m = r.exec(s))) names.add(m[1]);
    });
  });
  const changed = [];
  names.forEach(n => { if (grab(n, BASE_SRC) !== grab(n, SRC)) changed.push(n); });
  changed.sort();
  log('    changed functions: ' + changed.join(', '));
  const EXPECT = {
    wireControlTips: 'fix A extended: the fourteen join OWNS_TIP',
    hideExecTooltip: 'the hide now covers every pointer-following tip, not only the shared one',
    wireSectionInteractions: 'the section render path calls the hide, as the executive one already did',
  };
  SURFACES.forEach(s => { EXPECT[s.fn] = 'routed through the shared positioner'; });
  changed.forEach(n => ok(n in EXPECT, 'G1 the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    'G2 ' + n + ' changed as intended: ' + EXPECT[n]));
  ok(changed.length === Object.keys(EXPECT).length,
    'G3 exactly this many functions changed: ' + changed.length +
    ' against ' + Object.keys(EXPECT).length);

  /* THE STYLESHEET DOES NOT MOVE. Nothing here is a styling change. */
  const css = fs.readFileSync(path.join(DEV, 'styles.css'), 'utf8');
  const baseCss = execSync('git show ' + BASE + ':"' + CSSREL + '"',
    { cwd: ROOT, maxBuffer: 1 << 29 }).toString('utf8').replace(LF, CRLF);
  ok(css === baseCss, 'G4 styles.css is byte-identical to ' + BASE);

  const diff = execSync('git diff -U0 ' + BASE + ' -- "' + REL + '"',
    { cwd: ROOT, maxBuffer: 1 << 28 }).toString();
  const added = diff.split(/\r?\n/).filter(l => /^\+/.test(l) && !/^\+\+\+/.test(l));
  ok(!added.some(l => /[—–]|&mdash;|&ndash;/.test(l)),
    'G5 nothing added carries a long dash');
  /* NO DATA CONTACT. This ticket is presentation only. */
  ok(!added.some(l => /payload|state\.payload|DERIVED_|composePayload/.test(l)),
    'G6 nothing added touches the payload or the derive engine');
});

log('');
log(pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
