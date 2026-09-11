/* CLCPA-244 ROUND 3: the gauge strip uses BOTH dimensions.
 *
 * Emely's pass on 03ee74fdb2 accepted the mechanics -- all four gauges shrink
 * together, System Expansion never disappears, resize redraws -- and rejected
 * the sizing rule: at narrow widths the shrunken strip left a DEAD BAND of
 * empty card beneath it. Round 2 scaled against WIDTH alone, and .chart-row is
 * a CSS grid, so this card is stretched to its row-mate's height. That spare
 * height was simply wasted.
 *
 * THE RULING: fit the width, but grow to fill the card's height, up to the
 * full-size geometry. Scaling by height alone cannot do it -- a semicircle's
 * height follows its radius and the radius is what width constrains -- so the
 * way to spend vertical space is FEWER GAUGES PER ROW. At 500px, four in one
 * row forces k = 0.64; two rows of two need 392px per row and go back to
 * k = 0.96. The layout now picks the column count that makes the gauges
 * biggest within both dimensions.
 *
 * THREE GUARANTEES, each asserted here rather than asserted about:
 *   - never smaller than round 2 (the width-only answer is the search floor);
 *   - never larger than full size, so a wide window is byte-identical to the
 *     layout Emely has already accepted twice;
 *   - never clips horizontally, and never claims height it does not have.
 *
 * THE LIMIT, AGAIN AND UNCHANGED: these are GEOMETRY assertions, not RENDERING
 * assertions. A canvas cannot be read from node. Emely's eye is the acceptance.
 *
 * WHAT THE HARNESS DOES NOT RETYPE: rowHeightFor is EXTRACTED FROM THE SOURCE
 * AND CALLED. My first draft of this round gave the planner its own simplified
 * height model and the two disagreed wherever the text floor bit -- it accepted
 * a two-row layout at 321px against 320px of card. A model of the renderer is
 * a second source of truth. The suite calls the shipped function for the same
 * reason the app does.
 *
 * BASE is 3cdb178, the round-2 build Emely tested.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-244-evidence/suite-244-r3-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || '3cdb178';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);

const SRC = fs.readFileSync(APP, 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const BS = String.fromCharCode(92);

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
const say = (m) => lines.push(m);
function guard(label, fn) {
  try { fn(); } catch (e) {
    fail++; lines.push('  FAIL ' + label + ' THREW: ' + (e && e.message));
  }
}
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

/* brace-matching extractor: grab() over-reads for column-0 functions, which is
 * exactly where this ticket's code lives. See suite_244_r2's note. */
function grabFn(name, src) {
  src = src || SRC;
  const re = new RegExp('(?:^|\\r\\n)([ \\t]*)(?:async )?function ' + name + '\\s*\\(');
  const m = re.exec(src);
  if (!m) return null;
  const start = src.indexOf(m[0]) + (m[0].startsWith('\r\n') ? 2 : 0);
  let i = src.indexOf('{', start);
  if (i < 0) return null;
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i], n2 = src[i + 1];
    if (c === '/' && n2 === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 1; continue; }
    if (c === '/' && n2 === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      for (i++; i < src.length; i++) { if (src[i] === BS) { i++; continue; } if (src[i] === q) break; }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}

/* ---- the shipped layout, read and CALLED ------------------------------- */
function layoutFrom(src) {
  const fn = grabFn('drawSectionEArc', src);
  if (!fn) return null;
  const num = (re) => { const m = re.exec(fn); return m ? parseFloat(m[1]) : null; };
  const R_OUT_F = num(/R_OUT_F = (\d+)/);
  const SW_OUT_F = num(/SW_OUT_F = (\d+)/);
  const MIN_GAP = num(/MIN_GAP = (\d+)/);
  const floor = num(/floorK = ([\d.]+)/) !== null ? num(/floorK = ([\d.]+)/)
    : num(/const k = Math\.max\(([\d.]+),/);
  const wraps = /for \(let c = N - 1; c >= 1; c--\)/.test(fn) &&
                /if \(availH > 0\)/.test(fn);
  /* THE HEIGHT FORMULA IS NOT MODELLED. It is cut out of the source and run.
   *
   * BASE has no rowHeightFor -- round 2 computed the height inline -- so for
   * that side the equivalent is built from BASE's OWN constants, and only
   * after its inline expression is confirmed present verbatim. If that line
   * ever changes, this returns null and every sweep using it fails loudly
   * rather than comparing against a formula BASE does not have. */
  let rowHeightFor = null, heightSource = null;
  const rh = /function rowHeightFor\(kk\) \{[\s\S]*?\r\n    \}/.exec(fn);
  if (rh) {
    try {
      rowHeightFor = new Function('R_OUT_F', 'SW_OUT_F',
        rh[0] + '\nreturn rowHeightFor;')(R_OUT_F, SW_OUT_F);
      heightSource = 'shipped function, extracted and called';
    } catch (e) { rowHeightFor = null; }
  } else if (fn.indexOf('const CH = CY + LABEL_PAD + LINE_H * 3 + 4;') >= 0 &&
             fn.indexOf('const TOP_PAD = SW_OUT/2 + 4;') >= 0 &&
             fn.indexOf('const CY = TOP_PAD + R_OUT;') >= 0 &&
             fn.indexOf('const LABEL_PAD = 1, LINE_H = 22 * TEXT_K;') >= 0 &&
             fn.indexOf('const TEXT_K = Math.max(0.7, k);') >= 0) {
    rowHeightFor = (kk) => (SW_OUT_F * kk / 2 + 4) + R_OUT_F * kk + 1 +
      (22 * Math.max(0.7, kk)) * 3 + 4;
    heightSource = 'BASE inline expression, each line confirmed present';
  }
  const readable = [R_OUT_F, SW_OUT_F, MIN_GAP, floor].every(v => typeof v === 'number' && isFinite(v)) &&
    typeof rowHeightFor === 'function' && isFinite(rowHeightFor(1));
  const search = searchFrom(src);
  let searchRuns = false;
  try {
    const card = { clientHeight: 320, querySelector: () => null };
    const probe = search && search(900, [{}, {}, {}, {}], { parentElement: card },
      { devicePixelRatio: 2, getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px' }) });
    searchRuns = !!probe && isFinite(probe.k) && probe.k > 0 && isFinite(probe.right);
  } catch (e) { searchRuns = false; }
  const readable2 = readable && searchRuns;
  return { R_OUT_F, SW_OUT_F, MIN_GAP, floor, wraps, rowHeightFor,
           readable: readable2, heightSource, search, searchRuns };
}

/* THE SHIPPED SEARCH, CUT OUT AND RUN -- not modelled.
 *
 * The first draft of this suite re-implemented the column search and read
 * only the constants from source. Its own mutation controls exposed the
 * cost: NINE of nineteen mutations to the SEARCH left every behavioural
 * sweep unmoved, because the sweeps were running the harness's copy of the
 * algorithm rather than the shipped one. Only the structural greps noticed,
 * which makes the behavioural half decorative.
 *
 * The layout block is pure arithmetic once CW, availH and the gauge count
 * are supplied, so it is sliced out between two anchors and evaluated. If
 * either anchor moves, this returns null and every sweep fails loudly
 * rather than silently testing the harness against itself.
 */
function searchFrom(src) {
  const fn = grabFn('drawSectionEArc', src);
  if (!fn) return null;
  const A = fn.indexOf('const R_OUT_F = ');
  const tail = fn.indexOf('const SPACING = ARC_WIDTH + GAP;');
  if (A < 0 || tail < A) return null;
  const zEnd = tail + 'const SPACING = ARC_WIDTH + GAP;'.length;
  const slice = fn.slice(A, zEnd);
  const RET = [
    "\nvar _cols = (typeof COLS !== 'undefined') ? COLS : cats.length;",
    "var _rows = (typeof ROWS !== 'undefined') ? ROWS : 1;",
    "var _rh = (typeof ROW_H !== 'undefined') ? ROW_H : CH;",
    "return { cols: _cols, rows: _rows, k: k, R_OUT: R_OUT,",
    "  right: SIDE_PAD + (_cols - 1) * SPACING + R_OUT + SW_OUT/2,",
    "  height: _rh * _rows };",
  ].join("\n");
  try {
    return new Function('CW', 'cats', 'canvas', 'window', slice + RET);
  } catch (e) { return null; }
}

function planWith(L, CW, availH, N) {
  const cats = new Array(N).fill(0).map(() => ({}));
  /* A STUBBED CARD, not an injected number: the slice measures the card
   * itself, so driving it this way puts the measurement under test too.
   * Head and padding are zero, so clientHeight IS the available height. */
  const card = { clientHeight: availH, querySelector: () => null };
  const canvas = { parentElement: card };
  const win = { devicePixelRatio: 2,
    getComputedStyle: () => ({ paddingTop: '0px', paddingBottom: '0px' }) };
  const r = L.search(CW, cats, canvas, win);
  /* round 2's width-only answer, for the never-regress comparison */
  const ARC = (L.R_OUT_F + L.SW_OUT_F / 2) * 2;
  const singleK = Math.max(L.floor,
    Math.min(1, CW > 0 ? CW / (ARC * N + L.MIN_GAP * (N + 1)) : 1));
  return { cols: r.cols, rows: r.rows, k: r.k, right: r.right,
           height: r.height, singleK: singleK };
}
const WIDTHS = [1400, 1200, 1000, 900, 800, 768, 700, 600, 500, 420, 360, 320];
const HEIGHTS = [0, 100, 160, 200, 240, 320, 400, 520, 700];

say('======================================================================');
say('CLCPA-244 ROUND 3 -- the gauge strip uses BOTH dimensions');
say('  BASE ' + BASE + ' (the round-2 build Emely tested)');
say('======================================================================');

let LN = null, LB = null;
guard('both layouts are readable', () => {
  LN = layoutFrom(SRC); LB = layoutFrom(BASE_SRC);
  ok(!!LN && !!LB, 'R0 the draw function was found in both sources');
  /* the round-2 lesson: a null read makes every sweep below vacuous */
  ok(LN && LN.readable, 'R1 the shipped constants AND rowHeightFor were really read');
  ok(LB && LB.readable, 'R2 and BASEs were too');
  if (LN) say('       height formula, shipped: ' + LN.heightSource);
  if (LB) say('       height formula, BASE   : ' + LB.heightSource);
  ok(LN && LN.wraps === true, 'R3 the shipped layout has the wrap search');
  ok(LB && LB.wraps === false, 'R4 BASE did not, which is the defect Emely saw');
});
if (!LN || !LB || !LN.readable || !LB.readable) {
  lines.forEach(l => console.log(l));
  console.log('\n  ' + pass + ' passed, ' + fail + ' failed  (layout unreadable)');
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(1);
}

/* =============== D: the dead band is gone ============================== */
say('');
say('=== D. the dead band: a stretched card is USED, not wasted ===========');
guard('D: at narrow widths the strip grows to fill the card', () => {
  const H = 320;
  let bigger = 0, filled = 0;
  const det = [];
  [700, 600, 500, 420, 360, 320].forEach(w => {
    const p = planWith(LN, w, H, 4);
    if (p.k > p.singleK + 1e-9) bigger++;
    /* "fills" means it uses most of the height it was given, rather than
     * leaving the band Emely photographed */
    if (p.height >= H * 0.8) filled++;
    det.push(w + ':' + p.cols + 'x' + p.rows + ' k=' + p.k.toFixed(2) +
             ' h=' + p.height.toFixed(0));
  });
  say('       ' + det.join('  '));
  ok(bigger === 6, 'D1 all six narrow widths render BIGGER than round 2: ' + bigger + '/6');
  ok(filled === 6, 'D2 and each uses at least 80% of the card height: ' + filled + '/6');
  const p500 = planWith(LN, 500, H, 4);
  ok(p500.rows === 2 && p500.cols === 2,
     'D3 500px lays out 2x2 rather than 4x1: ' + p500.cols + 'x' + p500.rows);
  ok(p500.k > 0.9,
     'D4 and the gauges are near full size again: k=' + p500.k.toFixed(3) +
     ' against round 2s ' + p500.singleK.toFixed(3));
});

/* =============== W: a wide window is untouched ========================== */
say('');
say('=== W. the accepted layout is reproduced EXACTLY at full width =======');
guard('W: wide windows are byte-identical to BASE', () => {
  let same = 0; const diff = [];
  [1400, 1200, 1000, 900, 800].forEach(w => {
    HEIGHTS.forEach(h => {
      const a = planWith(LN, w, h, 4), b = planWith(LB, w, h, 4);
      if (a.cols === 4 && a.rows === 1 && a.k === 1 &&
          Math.abs(a.right - b.right) < 1e-9) same++;
      else diff.push(w + 'x' + h + ' ' + a.cols + 'x' + a.rows + ' k=' + a.k.toFixed(3));
    });
  });
  ok(diff.length === 0,
     'W1 every wide width, at EVERY height, still renders 4x1 at full size (' +
     same + ' cases)' + (diff.length ? ': ' + diff.slice(0, 4).join(', ') : ''));
});

/* =============== F: the fallbacks are round 2, exactly ================== */
say('');
say('=== F. no height measurement, or too little: round 2 unchanged =======');
guard('F: wrapping requires a height it can actually fit in', () => {
  let identical = 0; const diff = [];
  WIDTHS.forEach(w => {
    /* availH 0 = not laid out yet; 100/160 = a card too short to wrap into */
    [0, 100, 160].forEach(h => {
      const a = planWith(LN, w, h, 4), b = planWith(LB, w, h, 4);
      if (a.cols === 4 && a.rows === 1 && Math.abs(a.k - b.k) < 1e-9) identical++;
      else diff.push(w + 'x' + h + ' -> ' + a.cols + 'x' + a.rows + ' k=' + a.k.toFixed(3));
    });
  });
  ok(diff.length === 0,
     'F1 all ' + identical + ' cases fall back to round 2 EXACTLY' +
     (diff.length ? ': ' + diff.slice(0, 4).join(', ') : ''));
  ok(/if \(availH > 0\)/.test(codeOnly(grabFn('drawSectionEArc'))),
     'F2 and the source gates wrapping on a real measurement');
});

/* =============== S: the sweep, both dimensions ========================== */
say('');
say('=== S. the sweep: nothing clips, overflows, regresses or degenerates ==');
guard('S: 1-6 gauges x 9 heights x 12 widths', () => {
  const clip = [], over = [], regress = [], degen = [];
  let cases = 0;
  [1, 2, 3, 4, 5, 6].forEach(N => HEIGHTS.forEach(h => WIDTHS.forEach(w => {
    cases++;
    const p = planWith(LN, w, h, N);
    if (p.right > w + 0.5) clip.push(N + '@' + w + 'x' + h);
    /* height is a promise only where we USED it to wrap */
    if (p.rows > 1 && p.height > h + 0.5) over.push(N + '@' + w + 'x' + h);
    if (p.k < p.singleK - 1e-9) regress.push(N + '@' + w + 'x' + h);
    if (!(p.k > 0)) degen.push(N + '@' + w + 'x' + h);
  })));
  ok(cases === 648, 'S1 swept ' + cases + ' width/height/count combinations');
  ok(clip.length === 0, 'S2 nothing clips horizontally' +
     (clip.length ? ': ' + clip.slice(0, 5).join(', ') : ''));
  ok(over.length === 0, 'S3 no WRAPPED layout claims height it does not have' +
     (over.length ? ': ' + over.slice(0, 5).join(', ') : ''));
  ok(regress.length === 0, 'S4 nothing is smaller than round 2 rendered it' +
     (regress.length ? ': ' + regress.slice(0, 5).join(', ') : ''));
  ok(degen.length === 0, 'S5 no radius goes degenerate' +
     (degen.length ? ': ' + degen.slice(0, 5).join(', ') : ''));
  /* and BASE must FAIL the dead-band property, or D proves nothing */
  let baseWasted = 0;
  [700, 600, 500, 420].forEach(w => {
    const b = planWith(LB, w, 320, 4);
    if (b.height < 320 * 0.8) baseWasted++;
  });
  ok(baseWasted === 4,
     'S6 BASE wasted the height at all four narrow widths, which is the defect');
});

/* =============== G: the code is row-aware ============================== */
say('');
say('=== G. one height formula, and a strip that knows it has rows ========');
guard('G: the planner calls the renderers formula, not a copy of it', () => {
  const fn = codeOnly(grabFn('drawSectionEArc'));
  ok(/function rowHeightFor\(kk\)/.test(fn), 'G1 rowHeightFor exists');
  ok(/const ROW_H = rowHeightFor\(k\);/.test(fn),
     'G2 the renderer CALLS it rather than re-deriving the height');
  ok(/rowHeightFor\(mid\) \* rows <= availH/.test(fn),
     'G3 and so does the planner, so the two cannot disagree');
  ok(!/naturalRowH/.test(fn),
     'G4 the earlier simplified model is GONE, not left beside it');
});

guard('G: the draw and the hit test both know about rows', () => {
  const fn = codeOnly(grabFn('drawSectionEArc'));
  ok(/function drawSemi\(cx, cy, r, pct, color, sw\)/.test(fn),
     'G5 drawSemi takes cy as a parameter');
  ok(!/ctx\.arc\(cx, CY, r,/.test(fn),
     'G6 and no longer draws every arc on one shared centre line');
  ok(/const cx = SIDE_PAD \+ colOf\(i\) \* SPACING;/.test(fn),
     'G7 x comes from the COLUMN, not the index');
  ok(/const cy = cyOf\(i\);/.test(fn), 'G8 and y from the row');
  ok(/let ty = cy \+ LABEL_PAD;/.test(fn),
     'G9 labels hang off their own gauge, not off row 0');
  ok(/my >= z\.cy - \(TOP_PAD \+ R_OUT\) && my < z\.cy - \(TOP_PAD \+ R_OUT\) \+ ROW_H/.test(fn),
     'G10 the hit test is two-dimensional, so row 2 gets its own tooltips');
  const baseFn = codeOnly(grabFn('drawSectionEArc', BASE_SRC));
  ok(/hitZones\.find\(z => Math\.abs\(mx - z\.cx\) < SPACING\/2\)/.test(baseFn) &&
     !/my >= z\.cy/.test(baseFn),
     'G11 BASEs hit test was x-only, which a second row would have broken');
});

/* =============== X: nothing else moved ================================= */
say('');
say('=== X. the exclusions ================================================');
guard('X: round 2s other half is untouched', () => {
  ok(grabFn('parseNumericInput') === grabFn('parseNumericInput', BASE_SRC),
     'X1 parseNumericInput is byte-identical to BASE: the % unit rule is unchanged');
  ok(grabFn('wireSectionEArcResize') === grabFn('wireSectionEArcResize', BASE_SRC),
     'X2 and so is the resize redraw');
  const code = codeOnly(SRC);
  ok(code.indexOf("(secDacPct * 100).toFixed(1) + '%'") >= 0,
     'X3 the section header still multiplies unconditionally, as ruled');
  ok(/const pctNum = has \? pct \* 100 : 0;/.test(code),
     'X4 and so does the section-goals gauge row');
  const styles = fs.readFileSync(path.join(REPO,
    'Coned/CLCPA/ExecutiveDashboard_dev/styles.css'), 'utf8');
  const baseStyles = execSync('git show ' + BASE +
    ':"Coned/CLCPA/ExecutiveDashboard_dev/styles.css"',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
  ok(styles === baseStyles, 'X5 styles.css is byte-identical: this is not a CSS fix');
});

guard('X: the blast radius is exactly one function', () => {
  const names = [...new Set((SRC.match(/(?:^|\r\n)[ \t]*(?:async )?function (\w+)\s*\(/g) || [])
    .map(m => /function (\w+)/.exec(m)[1]))];
  const changed = names.filter(n => grabFn(n) !== grabFn(n, BASE_SRC));
  say('       changed: ' + changed.sort().join(', '));
  /* THREE, not one: drawSemi and rowHeightFor are NESTED inside
   * drawSectionEArc, and the name scan sees nested declarations too. My first
   * version of this assertion claimed one and was wrong about its own subject.
   * Named individually so the count stays exact rather than being relaxed:
   * drawSemi gained its cy parameter, and rowHeightFor is the new single
   * height formula that both the planner and the renderer call. */
  const EXPECT = {
    drawSectionEArc: 'the two-dimensional layout search',
    drawSemi: 'takes cy, because there is more than one row now',
    rowHeightFor: 'the shared height formula (new)',
  };
  changed.forEach(n => ok(n in EXPECT, 'the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  ok(changed.length === 3,
     'X6 exactly THREE functions changed, all inside the arc strip: ' + changed.length);
  ok(changed.every(n => grabFn(n) !== null),
     'X6b and each really exists in the shipped source, so the list means something');
});

guard('X: the baseline is literal and predates the change', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X7 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: REPO }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'X8 and it is an ancestor of HEAD');
});

lines.forEach(l => console.log(l));
console.log('');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n\n  ' + pass + ' passed, ' + fail + ' failed\n');
process.exitCode = fail ? 1 : 0;
