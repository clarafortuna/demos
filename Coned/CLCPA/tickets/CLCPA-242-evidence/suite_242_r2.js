/* CLCPA-242 round 2: the collision the positioning fix exposed.
 *
 * Emely's hosted pass on 5d4d42c9a6 FAILED this ticket. Positioning passed --
 * the edge flip and the slide work. What failed, her words: the tooltips
 * "salen de momento pero se esconden", and a screenshot showing a GHOST, a
 * semi-transparent tooltip carrying card 2's content, frozen mid-opacity over
 * the map widget.
 *
 * ROUND 1 WAS INCOMPLETE, NOT WRONG, and the record says so. The audit found a
 * collision that PREDATES this ticket: .exec-tooltip is ONE div on
 * document.body shared by nine wirings, and CLCPA-226's delegated control-tip
 * handler blanket-hid it on any mouseover not over a [data-tip] control. A
 * chart row is not one. So the row's mouseenter opened the tooltip and the next
 * bubbling mouseover closed it -- and mouseover RE-FIRES when the pointer
 * crosses into a child of the same row, while mouseenter does not. Round 1
 * placed the box correctly, which turned a dismissible flicker into an obvious
 * defect.
 *
 * FIX A  the delegated handler declines to hide over the four surfaces that
 *        own the tip themselves.
 * FIX B  a measured size of 0 is UNKNOWN, not zero, so an unmeasured box is
 *        never pinned to a viewport edge.
 *
 * Fix C -- one owner for the shared div, claim and release across all nine
 * wirings -- is a separate ticket by ruling and is NOT in here. Section 4 pins
 * that, and the fourteen section-page tooltips stay out of scope.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
/* BASE: the DEPLOYED build 5d4d42c9a6, which is what failed the hosted pass */
const BASE = process.env.DAC_BASE_COMMIT || 'd58141b';
const toCRLF = (s) => s.replace(/\r?\n/g, '\r\n');
const SRC = fs.readFileSync(path.join(REPO, REL), 'utf8');
const BASE_SRC = toCRLF(execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
const say = (s) => lines.push(s);
function guard(label, fn) {
  try { fn(); }
  catch (e) { ok(false, label + ' THREW instead of failing: ' + (e && e.message ? e.message : String(e))); }
}
function grab(name, src) {
  const s = src || SRC;
  for (const pad of ['  ', '    ', '']) for (const kw of ['function ', 'async function ']) {
    const head = '\r\n' + pad + kw + name + '(';
    const i = s.indexOf(head); if (i < 0) continue;
    const close = '\r\n' + pad + '}';
    const j = s.indexOf(close, i + head.length);
    if (j >= 0) return s.slice(i + 2, j + close.length);
  } return null;
}
function codeOnly(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '/*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? src.length : j + 2; continue; }
    if (two === '//') { const j = src.indexOf('\n', i); i = j < 0 ? src.length : j; continue; }
    out += src[i]; i++;
  }
  return out;
}
const CODE = codeOnly(SRC);

/* ---- DRIVEN HARNESS -------------------------------------------------
 * wireControlTips registers document listeners. Build it against a fake
 * document that captures them, then fire synthetic events and watch what
 * happens to the shared tip. Nothing is read as source text here. */
function controlTipsHarness(src) {
  const tip = { style: { opacity: '1' }, classList: { add() {}, remove() {} },
    textContent: '', setAttribute() {}, removeAttribute() {},
    getBoundingClientRect: () => ({ left: 0, bottom: 0, width: 0 }),
    offsetWidth: 100 };
  const handlers = {};
  const doc = {
    addEventListener: (t, fn) => { (handlers[t] = handlers[t] || []).push(fn); },
    querySelector: () => tip,
    createElement: () => tip,
    body: { appendChild() {} },
  };
  const win = { pageXOffset: 0, pageYOffset: 0, innerWidth: 1400, innerHeight: 900 };
  const fn = new Function('document', 'window', 'ensureTooltip',
    grab('wireControlTips', src) + '\nreturn wireControlTips;')(
      doc, win, () => tip);
  fn();
  return { tip: tip, handlers: handlers, fn: fn };
}
/* a synthetic event whose closest() answers for the two selectors that matter */
function evt(opts) {
  const o = opts || {};
  return { target: { closest: (sel) => {
    if (sel === '[data-tip]') return o.dataTip ? {
      getAttribute: () => 'a label',
      setAttribute() {}, removeAttribute() {},
      getBoundingClientRect: () => ({ left: 10, bottom: 20, width: 50 }),
    } : null;
    return o.ownsTip ? {} : null;
  } } };
}

say('======================================================================');
say('CLCPA-242 round 2 -- the collision, and the unmeasured box');
say('  BASE ' + BASE + ' (the deployed build 5d4d42c9a6 that failed the pass)');
say('======================================================================');

/* ==================================================================== */
say('');
say('=== 1. FIX A: the delegated handler stops hiding other surfaces\' tips ===');

guard('BASE control: it blanket-hid, and the rows are not controls', () => {
  const b = codeOnly(grab('wireControlTips', BASE_SRC));
  ok(/if \(el\) show\(el\); else hide\(\);/.test(b),
     'at BASE the handler was `if (el) show(el); else hide();`');
  ok(!/OWNS_TIP/.test(b), 'with no notion of a surface that owns the tip');
  /* and the rows carry no data-tip, so target() was null over them */
  ['dumb-row', 'strip-row', 'ai-header-card'].forEach(c => {
    const re = new RegExp('class="' + c + '[^"]*"[^>]*data-tip');
    ok(!re.test(CODE), '.' + c + ' carries no data-tip, so target() is null over it');
  });
  /* DRIVEN at BASE: hovering a row hides the tip */
  const h = controlTipsHarness(BASE_SRC);
  h.tip.style.opacity = '1';
  h.handlers.mouseover[0](evt({ ownsTip: true }));
  ok(h.tip.style.opacity === '0',
     'DRIVEN at BASE: a mouseover inside a chart row HIDES the shared tip -- ' +
     'opacity ' + h.tip.style.opacity);
});

guard('the early-out, driven over the shipped handler', () => {
  const f = codeOnly(grab('wireControlTips'));
  ok(/const OWNS_TIP = '\.dumb-row, \.strip-row, \.ai-header-card, \.radar-dot';/.test(f),
     'the four owning surfaces are named exactly');
  ok(/if \(ownsTip\(e\)\) return;/.test(f), 'and the handler returns before hiding');
  const iOwns = f.indexOf('if (ownsTip(e)) return;');
  const iHide = f.indexOf('hide();', iOwns);
  ok(iOwns >= 0 && iHide > iOwns, 'the early-out precedes the hide, not after it');

  const h = controlTipsHarness(SRC);
  /* 1. inside a tip-owning surface: MUST NOT hide */
  h.tip.style.opacity = '1';
  h.handlers.mouseover[0](evt({ ownsTip: true }));
  ok(h.tip.style.opacity === '1',
     'a mouseover inside a chart row LEAVES the tooltip alone: opacity ' +
     h.tip.style.opacity);
  /* 2. ordinary page background: MUST still hide, or the control tips stick */
  h.tip.style.opacity = '1';
  h.handlers.mouseover[0](evt({}));
  ok(h.tip.style.opacity === '0',
     'a mouseover over ordinary background STILL hides it, so control tips ' +
     'still close: opacity ' + h.tip.style.opacity);
  /* 3. a real control: shows, and the early-out does not block it */
  h.tip.style.opacity = '0';
  h.handlers.mouseover[0](evt({ dataTip: true }));
  ok(h.tip.style.opacity === '1',
     'a mouseover over a [data-tip] control still SHOWS: opacity ' +
     h.tip.style.opacity);
  /* 4. a control INSIDE an owning surface: the control wins, since show comes first */
  h.tip.style.opacity = '0';
  h.handlers.mouseover[0](evt({ dataTip: true, ownsTip: true }));
  ok(h.tip.style.opacity === '1',
     'and a control nested inside an owning surface still shows: the control ' +
     'branch is tested first');
});

guard('the hardening around the early-out, both cases driven', () => {
  /* TWO CONTROLS WENT GREEN AGAINST THE FIRST VERSION OF THIS SUITE, and both
   * were harness gaps rather than code that did not matter:
   *   - the harness always supplied a `closest`, so removing ownsTip's guard
   *     against a missing one changed nothing here;
   *   - the harness wired once, so removing the once-per-document guard was
   *     invisible.
   * Both are now exercised. */
  const h = controlTipsHarness(SRC);

  /* 1. a target with NO closest -- a text node or the document itself. The
   * handler must not throw, and must fall through to hiding. */
  h.tip.style.opacity = '1';
  let threw = false;
  try { h.handlers.mouseover[0]({ target: {} }); } catch (e) { threw = true; }
  ok(!threw, 'a mouseover whose target has no closest() does NOT throw');
  ok(h.tip.style.opacity === '0',
     'and it still hides, because a node that cannot be matched owns nothing');

  /* 2. wiring twice must register nothing the second time.
   *
   * The first version of this built a SECOND function object with new
   * Function, and it failed on clean source -- because `_wired` is set on the
   * function itself, so two separately-built copies never share it. That was
   * my harness, not the code: the app has exactly one wireControlTips.
   * Re-calling the SAME object is the honest test, and it is the second time
   * in this suite that a driven check was wrong before the code was. */
  const before = h.handlers.mouseover.length;
  h.fn();
  ok(h.handlers.mouseover.length === before,
     'calling the SAME wireControlTips twice registers NO further mouseover ' +
     'listener: ' + before + ' -> ' + h.handlers.mouseover.length +
     ' (listeners on a shared div must not accumulate)');
});

guard('the other four document listeners are untouched', () => {
  /* mouseout/focusin/focusout/keydown were not part of the symptom and are not
   * widened here. Escape must still dismiss. */
  const f = grab('wireControlTips'), b = grab('wireControlTips', BASE_SRC);
  ['mouseout', 'focusin', 'focusout', 'keydown'].forEach(t => {
    const re = new RegExp("document\\.addEventListener\\('" + t + "'");
    ok(re.test(f), t + ' is still registered');
  });
  const h = controlTipsHarness(SRC);
  h.tip.style.opacity = '1';
  h.handlers.keydown[0]({ key: 'Escape' });
  ok(h.tip.style.opacity === '0', 'Escape still dismisses, driven');
  h.tip.style.opacity = '1';
  h.handlers.mouseout[0](evt({ dataTip: true }));
  ok(h.tip.style.opacity === '0', 'and leaving a control still hides it');
  /* the guard against double-registration survives */
  ok(/wireControlTips\._wired/.test(codeOnly(f)),
     'and the once-per-document guard is intact, so listeners cannot accumulate');
});

/* ==================================================================== */
say('');
say('=== 2. FIX B: a size of zero is UNKNOWN, never clamped ===');

function placer(src) {
  return (win, tip, ev) => {
    const f = new Function('window', 'const g = ' + grab('placeTooltipAtPointer', src) + '; return g;')(win);
    f(tip, ev); return tip.style;
  };
}
const WIN = { pageXOffset: 0, pageYOffset: 2000, innerWidth: 1400, innerHeight: 900 };
const box = (w, h) => ({ offsetWidth: w, offsetHeight: h, style: {} });
const px = (v) => parseInt(String(v), 10);

guard('MY GHOST HYPOTHESIS IS DISPROVEN, and this records it', () => {
  /* THE AUDIT SAID: a zero offsetHeight would make `top = sy + vh - h - 8`
   * collapse to the viewport bottom, which on a scrolled page is where the map
   * sits -- the ghost's placement. I labelled it a hypothesis rather than a
   * finding, and its own BASE control has now killed it.
   *
   * BASE already wrote `if (h && top + h > ...)`. With h === 0 the guard is
   * FALSY, so the bottom clamp never ran and the box kept its plain offset.
   * The same for the width flip. Only the two FLOORS ran unconditionally, and
   * a floor can move a box by at most a few pixels toward the top-left of the
   * viewport -- it cannot teleport one over the map.
   *
   * So fix B is a real correctness fix and NOT the ghost's cause. The ghost's
   * placement remains UNEXPLAINED, and this assertion exists so that stays on
   * the record instead of quietly becoming a fixed thing. */
  const st = placer(BASE_SRC)(WIN, box(0, 0), { pageX: 300, pageY: 2100 });
  ok(px(st.top) === 2092,
     'at BASE a zero-height box already kept its plain offset: top ' + st.top +
     ', NOT the viewport bottom (2892). The hypothesis was wrong.');
  const b = codeOnly(grab('placeTooltipAtPointer', BASE_SRC));
  ok(/if \(h && top \+ h > sy \+ vh - 8\)/.test(b),
     'because BASE guarded the slide with `if (h && ...)` all along');
  ok(/if \(w && left \+ w > sx \+ vw - 8\)/.test(b),
     'and the flip with `if (w && ...)`');
  /* WHAT BASE DID GET WRONG, which is what fix B actually corrects */
  ok(/\n?\s*if \(left < sx \+ 8\) left = sx \+ 8;/.test(b) &&
     /\n?\s*if \(top < sy \+ 8\) top = sy \+ 8;/.test(b),
     'what BASE ran unconditionally were the two FLOORS -- that is the whole ' +
     'of what fix B changes');
  /* driven: the floor firing on an unmeasured box, near the top of a scroll */
  const stFloor = placer(BASE_SRC)(WIN, box(0, 0), { pageX: 2, pageY: 2004 });
  /* left comes out 16 because pageX + 14 already clears the floor; only TOP is
   * floored in this case. Asserting 8 was my own guess and the run corrected
   * it, which is the second wrong prediction this section has caught. */
  ok(px(stFloor.top) === 2008 && px(stFloor.left) === 16,
     'BASE floored the TOP of an UNMEASURED box to sy+8: ' + stFloor.top +
     ' (left ' + stFloor.left + ' already cleared it) -- small, wrong, now fixed');
});

guard('an unmeasured box now keeps its plain offset', () => {
  const f = codeOnly(grab('placeTooltipAtPointer'));
  ok(/const knownW = w > 0, knownH = h > 0;/.test(f), 'zero is treated as unknown');
  ok(/if \(knownW\) \{/.test(f) && /if \(knownH\) \{/.test(f),
     'and BOTH axes skip their edge handling when unmeasured');
  const st = placer(SRC)(WIN, box(0, 0), { pageX: 300, pageY: 2100 });
  ok(px(st.top) === 2092, 'top is the plain offset: ' + st.top);
  ok(px(st.left) === 314, 'and left likewise: ' + st.left);
  /* and the same box at BASE also kept 2092 -- see the disproof above. The
   * DIFFERENCE fix B makes is the floors, proved by the near-origin case. */
  const near = placer(SRC)(WIN, box(0, 0), { pageX: 2, pageY: 2004 });
  ok(px(near.left) === 16 && px(near.top) === 1996,
     'an unmeasured box near the scroll origin now keeps its plain offset ' +
     'instead of being floored: ' + near.left + ' ' + near.top);
  /* one axis unmeasured must not disable the other */
  const st2 = placer(SRC)(WIN, box(200, 0), { pageX: 1390, pageY: 2100 });
  ok(px(st2.left) === 1390 - 200 - 14,
     'a known WIDTH still flips even when the height is unknown: ' + st2.left);
  ok(px(st2.top) === 2092, 'while the unknown height keeps its plain offset');
});

guard('a measured box still clamps exactly as round 1 proved', () => {
  const W = { pageXOffset: 0, pageYOffset: 0, innerWidth: 1400, innerHeight: 900 };
  let st = placer(SRC)(W, box(200, 150), { pageX: 100, pageY: 300 });
  ok(px(st.left) === 114 && px(st.top) === 292, 'inside: plain offset');
  st = placer(SRC)(W, box(200, 150), { pageX: 1350, pageY: 300 });
  ok(px(st.left) === 1350 - 200 - 14, 'right edge: flips');
  st = placer(SRC)(W, box(200, 150), { pageX: 100, pageY: 880 });
  ok(px(st.top) + 150 <= 900 - 8, 'bottom edge: slides up');
  st = placer(SRC)({ pageXOffset: 0, pageYOffset: 0, innerWidth: 300, innerHeight: 900 },
                   box(280, 150), { pageX: 290, pageY: 300 });
  ok(px(st.left) === 8, 'a flip that would go negative is still floored at 8: ' + st.left);
  st = placer(SRC)(WIN, box(200, 150), { pageX: 100, pageY: 2400 });
  ok(px(st.top) === 2392, 'and the scrolled-page case still holds');
});

/* ==================================================================== */
say('');
say('=== 3. WHAT ROUND 1 GOT RIGHT IS UNCHANGED ===');

guard('the positioning that PASSED the hosted pass still holds', () => {
  /* Emely passed the edge flip and slide. Those must not move. */
  ok(/placeTooltipAtPointer\(tip, e\)/.test(codeOnly(grab('wireExecutiveTooltips'))),
     'the chart rows still route through the shared clamp');
  ok(/placeTooltipAtPointer\(tip, e\)/.test(codeOnly(grab('wireHeaderCardsTooltips'))),
     'and so do the KPI cards');
  ok(grab('hideExecTooltip') === grab('hideExecTooltip', BASE_SRC),
     'hideExecTooltip is byte-identical: the re-render hook was cleared by the ' +
     'audit and is not the cause');
  ok(grab('wireExecutiveInteractions') === grab('wireExecutiveInteractions', BASE_SRC),
     'and so is its caller');
  ok(grab('wireExecutiveTooltips') === grab('wireExecutiveTooltips', BASE_SRC),
     'wireExecutiveTooltips is byte-identical: fix A lives in the DELEGATED ' +
     'handler, not in the surfaces');
  ok(grab('wireHeaderCardsTooltips') === grab('wireHeaderCardsTooltips', BASE_SRC),
     'and so is the card wiring');
});

/* ==================================================================== */
say('');
say('=== 4. WHAT IS DELIBERATELY NOT HERE ===');

guard('fix C is not smuggled in', () => {
  /* one owner for the shared div, claim and release across nine wirings: its
   * own ticket by ruling. If it had been done here, there would be a claim
   * token on the tip and the wirings would consult it. */
  ok(!/tipOwner|claimTip|releaseTip|data-tip-owner/.test(CODE),
     'no claim/release mechanism exists yet: fix C is still a separate ticket');
  ok((CODE.match(/ensureTooltip\(\)/g) || []).length >= 9,
     'the div is still shared by all nine wirings: ' +
     (CODE.match(/ensureTooltip\(\)/g) || []).length + ' call sites');
});

guard('the fourteen section-page tooltips stay out of scope', () => {
  const raw = (CODE.match(/tip\.style\.left = \(e\.pageX \+ 14\) \+ 'px';/g) || []).length;
  ok(raw === 14, 'still exactly 14 raw positioners, unchanged by this round: ' + raw);
  const baseRaw = (codeOnly(BASE_SRC).match(/tip\.style\.left = \(e\.pageX \+ 14\) \+ 'px';/g) || []).length;
  ok(baseRaw === raw, 'the same count as the deployed build: ' + baseRaw);
});

/* ==================================================================== */
say('');
say('=== 5. THE BLAST RADIUS ===');

guard('two functions', () => {
  const names = new Set();
  [SRC, BASE_SRC].forEach(s => {
    const r = /\r\n  (?:async )?function (\w+)\(/g;
    let m; while ((m = r.exec(s))) names.add(m[1]);
  });
  const changed = [];
  names.forEach(n => { if (grab(n, BASE_SRC) !== grab(n, SRC)) changed.push(n); });
  changed.sort();
  say('       changed functions: ' + changed.join(', '));
  const EXPECT = {
    wireControlTips: 'fix A: the early-out for tip-owning surfaces',
    placeTooltipAtPointer: 'fix B: a size of zero is unknown',
    /* CLCPA-240 first half has since landed. Its eight functions are named
     * here rather than absorbed into a larger number, so the count stays
     * exact and this suite still says what IT changed. */
    buildIngestImport: 'NOT this brief: CLCPA-240 first half, the composite key',
    buildIngestWorkbook: 'NOT this brief: CLCPA-240 first half, the template header cells',
    totalRowFlags: 'NOT this brief: CLCPA-240 first half, the hierarchical bootstrap',
    ingestRowKey: 'NOT this brief: CLCPA-240 first half (new)',
    ingestGroupOf: 'NOT this brief: CLCPA-240 first half (new)',
    ingestIsHeaderRow: 'NOT this brief: CLCPA-240 first half (new)',
    ingestIsBlankCell: 'NOT this brief: CLCPA-240 first half (new)',
    ingestKeyColCount: 'NOT this brief: CLCPA-240 first half (new)',
    /* CLCPA-240 ROUND 2, Emely’s finding after the round-1 hosted pass:
     * hierarchical group headers and totals are now render-only, and the
     * template marks a heading (no value). Named, so the exact count below
     * survives as a guard rather than being relaxed. */
    ingestIsShapeBlank: 'NOT this brief: CLCPA-240 round 2, the shape-blank predicate (new)',
    renderIngestEditor: 'NOT this brief: CLCPA-240 round 2, the group-header lock',
    xlsxInstructionBlocks: 'NOT this brief: CLCPA-240 round 2, the (no value) instruction',
    /* CLCPA-240 ROUND 3: the group-header lock now works on the screen it
     * exists for -- a year imported but not yet saved. */
    isHierarchicalTotalLabel: 'NOT this brief: CLCPA-240 round 3, the shared total-label rule (new)',
    /* CLCPA-244, Emely's two E1 defects. Named so the exact count below
     * stays a guard: the weighted-mean marking became total-row-only, and
     * getTableSchema's fallback stopped serving the OLDEST year. */
    isTotalOnlyDerived: 'NOT this brief: CLCPA-244, the total-row-only rule predicate (new)',
    ingestComputed: 'NOT this brief: CLCPA-244, a weighted mean marks only its total row',
    getTableSchema: 'NOT this brief: CLCPA-244, the fallback takes the most recent year',
    /* CLCPA-244 ROUND 2. Two of that round's four: drawSectionEArc and
     * wireSectionEArcResize are declared at COLUMN 0 and this suite's name
     * scan is IIFE-scoped, so it cannot see them. suite_244_r2 owns those. */
    parseNumericInput: 'NOT this brief: CLCPA-244 round 2, a trailing % is a unit',
    /* CLCPA-244 ROUND 4 removed wireSectionInteractions from this list:
     * Emely reverted the gauge sizing after the round-3 hosted pass, so the
     * call site went back to its original one-line form and the function is
     * unchanged again. parseNumericInput stays -- the percent-unit rule
     * survived the revert. */
  };
  changed.forEach(n => ok(n in EXPECT, 'the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  /* 2 -> 10: CLCPA-240's first half added eight, each named in EXPECT above,
   * so the count stays exact rather than becoming a range. */
  /* 14 -> 17: CLCPA-244 changed three more, every one named in EXPECT. */
  /* 17 -> 19: CLCPA-244 round 2 changed two this suite can see. */
  /* 19 -> 18: round 4's revert restored wireSectionInteractions. */
  ok(changed.length === 18, 'EIGHTEEN: this round\'s two, CLCPA-240\'s twelve ' +
     'and CLCPA-244\'s four: ' + changed.length);
});

guard('the exclusions hold', () => {
  ['dacCol', 'dacRow', 'ensureTooltip', 'positionTooltipAt', 'renderDumbbell',
   'renderStripWithGap', 'computeHeaderCards', 'composePayloadFromRows',
   /* totalRowFlags left this list when CLCPA-240's first half changed it. That
    * ticket owns the change and asserts it by name; this suite's claim is only
    * that ROUND 2 did not touch it, which the named inventory above states. */
   'buildSectionDAC'].forEach(fn => {
    const a = grab(fn), b = grab(fn, BASE_SRC);
    if (!ok(a !== null && b !== null, fn + ' exists in both sources')) return;
    ok(a === b, fn + ' is byte-identical to BASE');
  });
  ok(/var DAC_SOURCE = 'dataverse';/.test(CODE), "DAC_SOURCE is still 'dataverse'");
});

/* ==================================================================== */
console.log(lines.join('\n'));
console.log('');
console.log('======================================================================');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
console.log('======================================================================');
process.exitCode = fail ? 1 : 0;
