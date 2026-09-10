/* Mutation controls for CLCPA-242 round 2.
 *
 * Fix A is a behaviour change in a delegated handler, so the controls attack
 * the BEHAVIOUR through the driven harness rather than the source text: each
 * branch is broken in turn and the synthetic events must notice.
 *
 * The dangerous direction for fix A is OVER-widening -- an early-out that also
 * swallows the legitimate hide would leave control tips stuck open forever,
 * which is a worse defect than the one being fixed. Two controls cover it.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DIR = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/CLCPA-242-evidence';
const APP = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_242_r2.js';

const M = [
  /* ---- fix A, reverted and mis-scoped -------------------------------- */
  { t: APP, name: 'FIX A REVERTED: the handler blanket-hides again',
    from: "      const el = target(e);\n      if (el) { show(el); return; }\n      /* not a control, and a surface that manages the tip itself is under the\n       * pointer: leave it alone */\n      if (ownsTip(e)) return;\n      hide();",
    to:   "      const el = target(e);\n      if (el) show(el); else hide();",
    expect: 'a mouseover inside a chart row LEAVES the tooltip alone' },
  { t: APP, name: 'OVER-WIDENED: it never hides, so control tips stick open',
    from: "      if (ownsTip(e)) return;\n      hide();",
    to:   "      return;",
    /* worse than the original defect: a tooltip that never closes */
    expect: 'STILL hides it, so control tips still close' },
  { t: APP, name: 'the early-out runs AFTER the hide, so the hide still wins',
    from: "      if (ownsTip(e)) return;\n      hide();",
    to:   "      hide();\n      if (ownsTip(e)) return;",
    expect: 'a mouseover inside a chart row LEAVES the tooltip alone' },
  { t: APP, name: 'the control branch is tested AFTER the early-out',
    from: "      const el = target(e);\n      if (el) { show(el); return; }",
    to:   "      const el = target(e);\n      if (false) { show(el); return; }",
    /* a control nested inside a chart row would then never show */
    expect: 'a mouseover over a [data-tip] control still SHOWS' },
  { t: APP, name: 'a surface is dropped from the owning list',
    from: "    const OWNS_TIP = '.dumb-row, .strip-row, .ai-header-card, .radar-dot';",
    to:   "    const OWNS_TIP = '.dumb-row, .strip-row, .radar-dot';",
    expect: 'the four owning surfaces are named exactly' },
  { t: APP, name: 'the owning list becomes a catch-all',
    from: "    const OWNS_TIP = '.dumb-row, .strip-row, .ai-header-card, .radar-dot';",
    to:   "    const OWNS_TIP = 'div';",
    expect: 'the four owning surfaces are named exactly' },
  { t: APP, name: 'ownsTip stops guarding against a missing closest',
    from: "      return !!(t && t.closest && t.closest(OWNS_TIP));",
    to:   "      return !!t.closest(OWNS_TIP);",
    expect: 'does NOT throw' },

  /* ---- the other listeners must keep working ------------------------- */
  { t: APP, name: 'Escape stops dismissing',
    from: "    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });",
    to:   "    document.addEventListener('keydown', (e) => { if (e.key === 'EscapeX') hide(); });",
    expect: 'Escape still dismisses, driven' },
  { t: APP, name: 'leaving a control stops hiding it',
    from: "    document.addEventListener('mouseout', (e) => { if (target(e)) hide(); });",
    to:   "    document.addEventListener('mouseout', (e) => { if (false) hide(); });",
    expect: 'leaving a control still hides it' },
  { t: APP, name: 'the once-per-document guard is removed',
    from: "    if (wireControlTips._wired) return;   // delegated: once per document",
    to:   "    if (false) return;   // delegated: once per document",
    expect: 'registers NO further mouseover listener' },

  /* ---- fix B --------------------------------------------------------- */
  { t: APP, name: 'FIX B REVERTED: the floors run on an unmeasured box again',
    from: "    const knownW = w > 0, knownH = h > 0;\n    let left = e.pageX + 14;\n    if (knownW) {\n      if (left + w > sx + vw - 8) left = e.pageX - w - 14;\n      if (left < sx + 8) left = sx + 8;\n    }\n    let top = e.pageY - 8;\n    if (knownH) {\n      if (top + h > sy + vh - 8) top = sy + vh - h - 8;\n      if (top < sy + 8) top = sy + 8;\n    }",
    to:   "    let left = e.pageX + 14;\n    if (w && left + w > sx + vw - 8) left = e.pageX - w - 14;\n    if (left < sx + 8) left = sx + 8;\n    let top = e.pageY - 8;\n    if (h && top + h > sy + vh - 8) top = sy + vh - h - 8;\n    if (top < sy + 8) top = sy + 8;",
    expect: 'now keeps its plain offset instead of being floored' },
  { t: APP, name: 'zero is treated as known, so an empty box clamps',
    from: "    const knownW = w > 0, knownH = h > 0;",
    to:   "    const knownW = true, knownH = true;",
    expect: 'now keeps its plain offset instead of being floored' },
  { t: APP, name: 'a NEGATIVE size counts as known',
    from: "    const knownW = w > 0, knownH = h > 0;",
    to:   "    const knownW = w >= 0, knownH = h >= 0;",
    expect: 'now keeps its plain offset instead of being floored' },
  { t: APP, name: 'the two axes are coupled, so one unknown disables both',
    from: "    const knownW = w > 0, knownH = h > 0;",
    to:   "    const knownW = w > 0 && h > 0, knownH = w > 0 && h > 0;",
    expect: 'a known WIDTH still flips even when the height is unknown' },

  /* ---- round 1 must not regress -------------------------------------- */
  { t: APP, name: 'the right-edge flip is lost',
    from: "      if (left + w > sx + vw - 8) left = e.pageX - w - 14;",
    to:   "      if (false) left = e.pageX - w - 14;",
    expect: 'right edge: flips' },
  { t: APP, name: 'the bottom slide is lost',
    from: "      if (top + h > sy + vh - 8) top = sy + vh - h - 8;",
    to:   "      if (false) top = sy + vh - h - 8;",
    expect: 'bottom edge: slides up' },
  { t: APP, name: 'the scroll offset is dropped from the slide',
    from: "      if (top + h > sy + vh - 8) top = sy + vh - h - 8;",
    to:   "      if (top + h > vh - 8) top = vh - h - 8;",
    expect: 'the scrolled-page case still holds' },
  { t: APP, name: 'a surface stops routing through the clamp',
    from: "      el.addEventListener('mousemove', e => placeTooltipAtPointer(tip, e));",
    to:   "      el.addEventListener('mousemove', e => { tip.style.left = e.pageX + 'px'; });",
    expect: 'wireExecutiveTooltips is byte-identical' },

  /* ---- fix C must NOT appear ----------------------------------------- */
  { t: APP, name: 'fix C is smuggled in: a claim token appears',
    from: "  function ensureTooltip() {",
    to:   "  function ensureTooltip() {\n    /* claimTip placeholder */",
    expect: 'the change to ensureTooltip is accounted for' },

  /* ---- the harness itself -------------------------------------------- */
  { t: SUITE, name: 'a name in the exclusion list is misspelled',
    /* Anchor updated when CLCPA-240's first half removed totalRowFlags from
     * this exclusion list. A mutation whose anchor has rotted reports
     * "ANCHOR 0, NOT APPLIED", which is a dead control rather than a passing
     * one -- so it is repointed at the line as it now reads. */
    from: "   'buildSectionDAC'].forEach(fn => {",
    to:   "   'buildSectionDACX'].forEach(fn => {",
    expect: 'exists in both sources' },

  /* ---- exclusions ----------------------------------------------------- */
  { t: APP, name: 'EXCLUSION: a third function is changed',
    from: "  function hideExecTooltip() {",
    to:   "  function hideExecTooltip() {\n    void 0;",
    expect: 'exactly TWO functions changed' },
  { t: APP, name: 'EXCLUSION: the section-page positioners are converted',
    from: "  function wireGSectionTooltips() {\n    const tip = ensureTooltip();",
    to:   "  function wireGSectionTooltips() {\n    const tip = ensureTooltip();\n    const _raw = (e) => { tip.style.left = (e.pageX + 14) + 'px'; };",
    expect: 'still exactly 14 raw positioners' },
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
  try { out = execFileSync('node', ['suite_242_r2.js'], { cwd: DIR, encoding: 'utf8' }); }
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
try { execFileSync('node', ['suite_242_r2.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) {
  cleanOk = false;
  console.error('THE CLEAN RE-RUN FAILED.');
  console.error((e.stdout || '').split('\n').filter(l => /FAIL/.test(l)).join('\n'));
}

console.log('======================================================================');
console.log('CLCPA-242 round 2 -- mutation controls');
console.log('======================================================================');
report.forEach(l => console.log(l));
console.log('');
console.log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length);
console.log('  clean re-run against restored source: ' + (cleanOk ? 'PASSES' : 'FAILED'));
process.exitCode = (missed || !cleanOk) ? 1 : 0;
