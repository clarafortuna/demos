/* Mutation controls for CLCPA-237 item F.
 *
 * ONE LESSON APPLIED THROUGHOUT, adopted after the grid-cascade miss: a
 * mutation must target the STRONGEST competitor in the file, not a nearby
 * neighbour. The old item-D control moved the solo rule past the media query
 * four lines below and went red, which felt like proof and was not -- the rule
 * that actually owned the property was an !important block 330 lines further
 * down. So the CSS controls here restore the deleted modifiers AND assert that
 * restoring them changes nothing that renders, which is the real claim.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DIR = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/CLCPA-237-evidence';
const APP = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSS = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/styles.css';

const M = [
  /* ---- item 2, card 3: THE CRASH ------------------------------------- */
  { t: APP, name: 'THE CRASH RETURNS: card 3 guards on j4Then alone again',
    from: "        detail: (j4Then && j4Now)\n          ? fmtBig(j4Then.dac) + ' \u2192 ' + fmtBig(j4Now.dac)\n          : (j4Then ? fmtBig(j4Then.dac) + ' \u2192 ' + fmtBig(null)\n                    : (j4Now ? fmtBig(j4Now.total) + ' total unpaid' : '\u2014')),",
    to:   "        detail: j4Then\n          ? fmtBig(j4Then.dac) + ' \u2192 ' + fmtBig(j4Now.dac)\n          : (j4Now ? fmtBig(j4Now.total) + ' total unpaid' : '\u2014'),",
    expect: 'computeHeaderCards(2099) does NOT throw' },
  { t: APP, name: 'the guard is inverted, so a POPULATED year loses its detail',
    from: "        detail: (j4Then && j4Now)",
    to:   "        detail: (j4Then && !j4Now)",
    expect: 'IDENTICAL to BASE for 2025' },
  { t: APP, name: 'the prior-only arm drops the prior figure entirely',
    from: "          : (j4Then ? fmtBig(j4Then.dac) + ' \u2192 ' + fmtBig(null)",
    to:   "          : (j4Then ? fmtBig(null) + ' \u2192 ' + fmtBig(null)",
    expect: 'the left side is a REAL prior figure' },
  { t: APP, name: 'the prior-only arm renders the PRIOR figure as the current one',
    from: "          : (j4Then ? fmtBig(j4Then.dac) + ' \u2192 ' + fmtBig(null)",
    to:   "          : (j4Then ? fmtBig(null) + ' \u2192 ' + fmtBig(j4Then.dac)",
    /* THE HONESTY RULE: a stale figure standing where the selected year goes */
    expect: 'prior context ends in an arrow to a dash' },

  /* ---- item 2, card 1: THE INVENTED NUMBER --------------------------- */
  { t: APP, name: 'THE $0 RETURNS: the sums go back to a bare reduce',
    from: "    const eHas = eCats.length > 0;\n    const eTotal = eHas ? eCats.reduce((s, c) => s + (c.total || 0), 0) : null;\n    const eDacTotal = eHas\n      ? eCats.reduce((s, c) => s + (c.total || 0) * (c.dac_pct || 0), 0)\n      : null;",
    to:   "    const eHas = eCats.length > 0;\n    const eTotal = eCats.reduce((s, c) => s + (c.total || 0), 0);\n    const eDacTotal = eCats.reduce((s, c) => s + (c.total || 0) * (c.dac_pct || 0), 0);",
    expect: 'card 1 hero on 2099 is the dash glyph' },
  { t: APP, name: 'only the HERO sum is restored, so the detail still says $0',
    from: "    const eDacTotal = eHas\n      ? eCats.reduce((s, c) => s + (c.total || 0) * (c.dac_pct || 0), 0)\n      : null;",
    to:   "    const eDacTotal = eCats.reduce((s, c) => s + (c.total || 0) * (c.dac_pct || 0), 0);",
    expect: '"$0" appears nowhere in it' },
  { t: APP, name: 'THE FABRICATED DELTA: the current side is dropped from eGrow',
    from: "    const eGrow = (eDacPrev && eDacPrev > 0 && eDacTotal !== null)",
    to:   "    const eGrow = (eDacPrev && eDacPrev > 0)",
    expect: 'the delta requires the CURRENT side' },
  { t: APP, name: 'the null share test leans on `null > 0` again',
    from: "    const eDacPct = (eTotal !== null && eTotal > 0) ? (eDacTotal / eTotal * 100) : null;",
    to:   "    const eDacPct = eTotal > 0 ? (eDacTotal / eTotal * 100) : null;",
    expect: 'the share guards the null explicitly' },
  { t: APP, name: 'the emptiness test is deleted outright',
    from: "    const eHas = eCats.length > 0;",
    to:   "    const eHas = true;",
    expect: 'emptiness is tested explicitly' },
  { t: APP, name: 'the "0 categories" fallback comes back',
    from: "          : (eHas ? 'Weighted across ' + eCats.length + ' categories' : '\u2014'),",
    to:   "          : 'Weighted across ' + eCats.length + ' categories',",
    expect: 'the detail is a dash rather than' },

  /* ---- item 1: the branch is GONE ------------------------------------ */
  { t: APP, name: 'anyData comes back, dead but present',
    from: "    /* CLCPA-237 item F: ONE LAYOUT FOR EVERY YEAR.",
    to:   "    const anyData = false;\n    /* CLCPA-237 item F: ONE LAYOUT FOR EVERY YEAR.",
    expect: 'anyData is not declared any more' },
  { t: APP, name: 'a SECOND return template appears, so there are two layouts again',
    from: "    return `\n      ${header}",
    to:   "    if (false) { return `x`; }\n    return `\n      ${header}",
    expect: 'exactly ONE return template' },
  { t: APP, name: 'THE REGRESSION GUARD: the populated branch is edited',
    from: "          ${renderDumbbell(baseline, year, sections)}",
    to:   "          ${renderDumbbell(baseline, year, sections)}${''}",
    /* 2025 must render with zero visual diff */
    expect: 'byte-identical to BASE, so 2025 is untouched' },
  { t: APP, name: 'the map is dropped from the one layout, undoing CLCPA-158',
    from: "          ${renderDACMap(baseline, year, sections)}",
    to:   "          ",
    expect: 'byte-identical to BASE, so 2025 is untouched' },
  { t: APP, name: 'the page header template is lost in the cut',
    from: "    const header = `",
    to:   "    const headerX = `",
    expect: 'the page header template survived the cut' },

  /* ---- items 3 and 4: pinned as UNTOUCHED ---------------------------- */
  { t: APP, name: 'the dumbbell stops listing areas without the year',
    from: "    const rows = data.map(s => {\n      const curr = s.pctByYear[year];",
    to:   "    const rows = data.filter(s => s.pctByYear[year] != null).map(s => {\n      const curr = s.pctByYear[year];",
    expect: 'renderDumbbell is byte-identical to BASE' },
  { t: APP, name: 'the strip stops listing sections without the year',
    from: "      const rows = data.map(s => {\n      const pct = s.pctByYear[year];",
    to:   "      const rows = data.filter(s => s.pctByYear[year] != null).map(s => {\n      const pct = s.pctByYear[year];",
    expect: 'renderStripWithGap is byte-identical to BASE' },
  { t: APP, name: 'the strip plots 0% instead of dashing',
    from: "      const pctText = has ? pctNum.toFixed(1) + '%' : '\u2014';",
    to:   "      const pctText = pctNum.toFixed(1) + '%';",
    expect: 'renderStripWithGap is byte-identical to BASE' },
  { t: APP, name: 'the dumbbell invents a direction for a missing year',
    from: "      let pillCls = 'dumb-pill-neutral';",
    to:   "      let pillCls = 'dumb-pill-up';",
    expect: 'renderDumbbell is byte-identical to BASE' },

  /* ---- the CSS: the modifiers are DELETED, not repaired --------------
   * Restoring them must NOT change what renders, because they never won.
   * That is the claim the old control failed to make. */
  { t: CSS, name: 'the deleted pair modifier is restored (and still loses)',
    from: "/* ===== Card shell",
    to:   ".exec-shares-grid-pair { grid-template-columns: 1fr 1fr; }\n\n/* ===== Card shell",
    expect: 'exec-shares-grid-pair is absent from the stylesheet' },
  { t: CSS, name: 'the deleted solo modifier is restored',
    from: "/* ===== Card shell",
    to:   ".exec-shares-grid-solo { grid-template-columns: 1fr; }\n\n/* ===== Card shell",
    expect: 'exec-shares-grid-solo is absent from the stylesheet' },
  { t: CSS, name: 'the deleted empty header-cards modifier is restored',
    from: "/* ===== Card shell",
    to:   ".exec-header-cards-empty { grid-template-columns: 1fr; }\n\n/* ===== Card shell",
    expect: 'exec-header-cards-empty is absent from the stylesheet' },
  { t: CSS, name: 'THE STRONGEST COMPETITOR: the !important block is removed',
    from: "  grid-template-columns: 2fr 1fr !important;",
    to:   "  grid-template-columns: 2fr 1fr;",
    /* the whole reason the modifiers are deleted rather than fixed */
    expect: 'the block that outranked them is still there, still !important' },
  { t: CSS, name: 'the nth-child placement is removed with it',
    from: ".exec-shares-grid > .exec-card:nth-child(1) {\n  grid-column: 2 !important;",
    to:   ".exec-shares-grid > .exec-card:nth-child(1) {\n  grid-column: 2;",
    expect: 'it still places children by nth-child' },
  { t: CSS, name: 'the BASE grid rule is deleted, breaking the one layout',
    from: ".exec-shares-grid {\n  display: grid;",
    to:   ".exec-shares-grid-x {\n  display: grid;",
    expect: 'the base .exec-shares-grid rule survives' },

  /* ---- exclusions ---------------------------------------------------- */
  { t: APP, name: 'EXCLUSION: the derive engine is touched',
    from: "  function applyDerivedCols(rows, tableId, colSum, schema) {",
    to:   "  function applyDerivedCols(rows, tableId, colSum, schema) {\n    void 0;",
    expect: 'applyDerivedCols is byte-identical to BASE' },
  { t: APP, name: 'EXCLUSION: DAC_SOURCE is flipped back',
    from: "  var DAC_SOURCE = 'dataverse';",
    to:   "  var DAC_SOURCE = 'payload';",
    expect: "DAC_SOURCE is still 'dataverse'" },
  { t: APP, name: 'EXCLUSION: a third function is changed',
    from: "  function renderHeaderCards() {",
    to:   "  function renderHeaderCards() {\n    void 0;",
    expect: 'exactly TWO functions changed' },
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
  try { out = execFileSync('node', ['suite_237f.js'], { cwd: DIR, encoding: 'utf8' }); }
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
try { execFileSync('node', ['suite_237f.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) {
  cleanOk = false;
  console.error('THE CLEAN RE-RUN FAILED.');
  console.error((e.stdout || '').split('\n').filter(l => /FAIL/.test(l)).join('\n'));
}

console.log('======================================================================');
console.log('CLCPA-237 item F -- mutation controls');
console.log('======================================================================');
report.forEach(l => console.log(l));
console.log('');
console.log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length);
console.log('  clean re-run against restored source: ' + (cleanOk ? 'PASSES' : 'FAILED'));
process.exitCode = (missed || !cleanOk) ? 1 : 0;
