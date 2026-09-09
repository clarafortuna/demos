/* Mutation controls for CLCPA-242.
 *
 * The clamp is arithmetic, so most of these attack the arithmetic rather than
 * the source text: each edge is removed in turn and the driven section must
 * notice. The scroll-offset control is the one that matters most -- mixing
 * document and viewport coordinates is the trap CLCPA-226 recorded, and it is
 * invisible on an unscrolled page.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DIR = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/CLCPA-242-evidence';
const APP = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_242.js';

const M = [
  /* ---- the clamp, edge by edge -------------------------------------- */
  { t: APP, name: 'THE CLAMP IS REVERTED: the chart rows position raw again',
    from: "      el.addEventListener('mousemove', e => placeTooltipAtPointer(tip, e));",
    to:   "      el.addEventListener('mousemove', e => {\n        tip.style.left = (e.pageX + 14) + 'px';\n        tip.style.top = (e.pageY - 8) + 'px';\n      });",
    expect: 'NEITHER positions raw any more' },
  { t: APP, name: 'the KPI cards position raw again',
    from: "      card.addEventListener('mousemove', e => placeTooltipAtPointer(tip, e));",
    to:   "      card.addEventListener('mousemove', e => {\n        tip.style.left = (e.pageX + 14) + 'px';\n        tip.style.top = (e.pageY - 8) + 'px';\n      });",
    expect: 'NEITHER positions raw any more' },
  { t: APP, name: 'RIGHT EDGE: the flip is removed',
    /* round 2 wrapped these in if (knownW) / if (knownH), so the anchors are
     * re-indented and the `w &&` / `h &&` guards are gone. Same controls. */
    from: "      if (left + w > sx + vw - 8) left = e.pageX - w - 14;",
    to:   "      if (false) left = e.pageX - w - 14;",
    expect: 'at the right edge it FLIPS to the left of the cursor' },
  { t: APP, name: 'BOTTOM EDGE: the slide is removed',
    from: "      if (top + h > sy + vh - 8) top = sy + vh - h - 8;",
    to:   "      if (false) top = sy + vh - h - 8;",
    expect: 'at the bottom it slides up' },
  { t: APP, name: 'LEFT EDGE: the floor is removed',
    from: "    if (left < sx + 8) left = sx + 8;",
    to:   "    if (false) left = sx + 8;",
    expect: 'is floored at 8, not off-screen left' },
  { t: APP, name: 'TOP EDGE: the floor is removed',
    from: "    if (top < sy + 8) top = sy + 8;",
    to:   "    if (false) top = sy + 8;",
    expect: 'near the top it is floored at 8' },
  { t: APP, name: 'THE SCROLL TRAP: the viewport side loses its offset',
    from: "      if (top + h > sy + vh - 8) top = sy + vh - h - 8;",
    to:   "      if (top + h > vh - 8) top = vh - h - 8;",
    /* invisible on an unscrolled page; drags the tip to the top on a scrolled one */
    expect: 'on a page scrolled 2000px the tip is NOT dragged to the viewport top' },
  { t: APP, name: 'the clamp stops measuring the tip and assumes a size',
    from: "    const w = tip.offsetWidth || 0;\n    const h = tip.offsetHeight || 0;",
    to:   "    const w = 0;\n    const h = 0;",
    expect: 'at the right edge it FLIPS to the left of the cursor' },

  /* ---- placed before shown ------------------------------------------ */
  { t: APP, name: 'the chart rows go back to positioning only on move',
    from: "        placeTooltipAtPointer(tip, e);\n        tip.style.opacity = '1';\n      });\n      el.addEventListener('mousemove'",
    to:   "        tip.style.opacity = '1';\n      });\n      el.addEventListener('mousemove'",
    expect: 'chart rows: positions inside the enter handler' },
  { t: APP, name: 'the cards reveal BEFORE placing',
    from: "        placeTooltipAtPointer(tip, e);\n        tip.style.opacity = '1';\n      });\n      card.addEventListener('mousemove'",
    to:   "        tip.style.opacity = '1';\n        placeTooltipAtPointer(tip, e);\n      });\n      card.addEventListener('mousemove'",
    expect: 'KPI cards: and does it BEFORE revealing' },
  { t: APP, name: 'the enter handler stops receiving the event',
    from: "      el.addEventListener('mouseenter', (e) => {\n        const id = el.getAttribute('data-section');",
    to:   "      el.addEventListener('mouseenter', () => {\n        const e = null;\n        const id = el.getAttribute('data-section');",
    expect: 'the chart enter handler takes the event' },

  /* ---- hide on re-render -------------------------------------------- */
  { t: APP, name: 'HIDE IS REMOVED from the render path',
    from: "    hideExecTooltip();\n    wireBaselineToggle();",
    to:   "    wireBaselineToggle();",
    expect: 'the render path calls it' },
  /* The first version of this control moved hide ONE line down, past
   * wireBaselineToggle, and went GREEN -- correctly, because that is still
   * before the tooltips are re-wired, which is exactly what the assertion
   * claims. A mutation that does not violate the claim is not a control.
   * This one moves it past wireExecutiveTooltips, which IS the defect. */
  { t: APP, name: 'hide runs AFTER the tooltips are re-wired',
    from: "    hideExecTooltip();\n    wireBaselineToggle();\n    wireExecutiveTooltips();",
    to:   "    wireBaselineToggle();\n    wireExecutiveTooltips();\n    hideExecTooltip();",
    expect: 'and calls it FIRST, before re-wiring' },
  { t: APP, name: 'hide stops clearing the stale content',
    from: "    tip.style.opacity = '0';\n    tip.innerHTML = '';",
    to:   "    tip.style.opacity = '0';",
    expect: 'AND clears the content' },
  { t: APP, name: 'hide throws when no tooltip exists yet',
    from: "    const tip = document.querySelector('.exec-tooltip');\n    if (!tip) return;",
    to:   "    const tip = document.querySelector('.exec-tooltip');",
    expect: 'it is safe before any tooltip exists' },

  /* ---- the honesty content, closing the 237 limit ------------------- */
  { t: APP, name: 'HONESTY: the prior figure loses its "Prior year" label',
    from: "          html += `<div class=\"tt-row\"><span>Prior year</span><span class=\"v\">${prevPct}</span></div>`;",
    to:   "          html += `<div class=\"tt-row\"><span>Share</span><span class=\"v\">${prevPct}</span></div>`;",
    expect: 'the prior figure is rendered under the words "Prior year"' },
  { t: APP, name: 'HONESTY: the current row stops naming the selected year',
    from: "        html += `<div class=\"tt-row\"><span>DAC share \u00b7 ${state.year}</span><span class=\"v\">${pct}</span></div>`;",
    to:   "        html += `<div class=\"tt-row\"><span>DAC share</span><span class=\"v\">${pct}</span></div>`;",
    expect: 'the current figure under the SELECTED year, named' },
  { t: APP, name: 'HONESTY: an absent prior renders as an empty row',
    from: "        if (prevPct && prevPct !== 'n/a') {",
    to:   "        if (true) {",
    expect: 'the prior row is omitted entirely when there is none' },
  { t: APP, name: 'LEAKAGE: a null reaches a tooltip attribute',
    from: "      const prevTxt = hasPrev ? (prevPct * 100).toFixed(1) + '%' : 'n/a';",
    to:   "      const prevTxt = hasPrev ? (prevPct * 100).toFixed(1) + '%' : String(null);",
    expect: 'no null, NaN, undefined or [object reaches any tooltip attribute' },

  /* ---- the out-of-scope pin ----------------------------------------- */
  { t: APP, name: 'a raw positioner is ADDED, violating the pinned scope',
    /* INVERTED, because converting one is not uniquely anchorable: all five
     * -10 blocks are contextually identical, so a "convert one" mutation
     * matches five sites and never applies. A scope violation is equally a raw
     * positioner being ADDED -- new unclamped code -- and that has a unique
     * anchor. Either direction must move the pinned count off 14. */
    from: "  function wireGSectionTooltips() {\n    const tip = ensureTooltip();",
    to:   "  function wireGSectionTooltips() {\n    const tip = ensureTooltip();\n    const _raw = (e) => { tip.style.left = (e.pageX + 14) + 'px'; };",
    /* scope is asserted, not promised: 14 must stay 14 */
    expect: 'exactly 14 raw positioners remain' },

  /* ---- the harness -------------------------------------------------- */
  { t: SUITE, name: 'a name in the exclusion list is misspelled',
    from: "   'rowsForDisplay', 'renderExecutiveSummary', 'renderIngestPicker', 'ensureTooltip',",
    to:   "   'rowsForDisplayX', 'renderExecutiveSummary', 'renderIngestPicker', 'ensureTooltip',",
    expect: 'exists in both sources' },

  /* ---- exclusions --------------------------------------------------- */
  { t: APP, name: 'EXCLUSION: the map positioner is touched',
    from: "    function positionTooltipAt(e) {",
    to:   "    function positionTooltipAt(e) {\n      void 0;",
    expect: 'positionTooltipAt is byte-identical to BASE' },
  { t: APP, name: 'EXCLUSION: tooltip CONTENT is changed, not just wiring',
    from: "  function renderDumbbell(baseline, year, sections) {",
    to:   "  function renderDumbbell(baseline, year, sections) {\n    void 0;",
    expect: 'renderDumbbell is byte-identical to BASE' },
  { t: APP, name: 'EXCLUSION: dacCol is touched by this ticket',
    from: "  function dacCol(T, id, y, nameRe) {",
    to:   "  function dacCol(T, id, y, nameRe) {\n    void 0;",
    expect: 'dacCol is byte-identical to BASE' },
];

let caught = 0, missed = 0;
const report = [];
M.forEach((m) => {
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  if (n !== 1) {
    report.push('  ??? ' + m.name + ' -- ANCHOR ' + n + ', NOT APPLIED');
    missed++; return;
  }
  fs.writeFileSync(m.t, base.replace(from, () => to));
  let out = '';
  try { out = execFileSync('node', ['suite_242.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }

  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const hit = fails.filter(l => l.indexOf(m.expect) >= 0);
  if (hit.length) {
    report.push('  red  ' + m.name);
    report.push('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 110));
    caught++;
  } else if (fails.length) {
    report.push('  ??? ' + m.name + ' -- ' + fails.length + ' red, not the expected one');
    report.push('       want: ' + m.expect);
    report.push('       got : ' + fails[0].trim().slice(5, 110));
    missed++;
  } else {
    report.push('  GREEN ' + m.name + ' -- NOT NOTICED. Not a guard.');
    missed++;
  }
});

let cleanOk = true;
try { execFileSync('node', ['suite_242.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) {
  cleanOk = false;
  console.error('THE CLEAN RE-RUN FAILED.');
  console.error((e.stdout || '').split('\n').filter(l => /FAIL/.test(l)).join('\n'));
}

console.log('======================================================================');
console.log('CLCPA-242 -- mutation controls');
console.log('======================================================================');
report.forEach(l => console.log(l));
console.log('');
console.log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length);
console.log('  clean re-run against restored source: ' + (cleanOk ? 'PASSES' : 'FAILED'));
process.exitCode = (missed || !cleanOk) ? 1 : 0;
