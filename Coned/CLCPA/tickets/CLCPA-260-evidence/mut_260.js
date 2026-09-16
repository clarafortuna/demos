/* Mutation controls for Section C group D: CLCPA-260.
 *
 * The dangerous directions:
 *
 *   A REAL COLUMN IS ERASED -- the predicate drops condition 2 or 3 and takes
 *   A9/A10/F7's label column or F6's detail columns with it. Twelve columns
 *   holding up to 25 values each; this is the one that matters.
 *
 *   NOTHING IS HIDDEN -- the filter is declared and never applied, on either
 *   surface. The fix that looks applied and is not.
 *
 *   THE CROSS-WIDTH INDEX BUG RETURNS -- asking whether a column is blank in
 *   EVERY year, which leaves C1 six columns wide. My own first cut.
 *
 *   THE BODY FILTER SHIFTS THE INDEX -- filtering before the map instead of
 *   after, so `c` becomes the visible position and every cell reads the wrong
 *   column. This is the shape of the harness defect the audit found, planted
 *   in the app where it would be a real defect.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-260-evidence';
const APP = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_260.js';

const M = [
  /* ---- a real column is erased ------------------------------------------ */
  /* CONDITIONS 2 AND 3 ARE DEFENCE IN DEPTH ON THIS PAYLOAD, measured: no
   * single-level table has a blank-headed column past index 0 that holds
   * data, and the two-level families have no blank-headed column past index 0
   * at all. So these three controls went GREEN until the suite grew synthetic
   * tables in the real shape for them to break. Aimed at those. */
  { t: APP, name: 'CONDITION 2 GOES: a blank-headed column that HOLDS data is hidden',
    from: '      if (carries) continue;',
    to:   '',
    expect: 'T3c condition 2: a blank-headed column holding' },
  { t: APP, name: 'condition 2 asks only the year on screen, not its whole width',
    from: '      const carries = sameWidth.some(y =>',
    to:   '      const carries = [year].some(y =>',
    /* inert on the real payload, and the single-year synthetic carrier cannot
     * see it either -- ZZ3 holds the value in the OTHER year of the same
     * width, which is what T3e is for */
    expect: 'T3e condition 2 spans the WIDTH, not the year' },
  { t: APP, name: 'CONDITION 3 GOES: the two-level families are filtered too',
    from: '    if (hl === 2) return out;                     /* condition 3 */',
    to:   '',
    expect: 'T4c condition 3: the same shape marked two-level' },
  { t: APP, name: 'the label column itself becomes eligible',
    from: '    for (let c = 1; c < schema.length; c++) {\r\n      const h = schema[c];',
    to:   '    for (let c = 0; c < schema.length; c++) {\r\n      const h = schema[c];',
    /* no stored single-level table has a blank label header, so only ZZ4 can
     * see this */
    expect: 'T3g the label column is never hidden' },

  /* ---- nothing is hidden ------------------------------------------------- */
  { t: APP, name: 'THE FIX SHIPS INERT: the predicate always returns nothing',
    from: '    const out = [];\r\n    if (!t) return out;',
    to:   '    const out = [];\r\n    if (t) return out;',
    expect: 'T1 C1:2025' },
  { t: APP, name: 'the EDITOR declares the filter and never applies it',
    from: "        if (hiddenCols.indexOf(colIdx) >= 0) return '';",
    to:   '',
    expect: 'E9 and so do the body cells' },
  { t: APP, name: 'the TEMPLATE declares it and never applies it to the heading',
    from: '    const rows = [visible(schema).map(h => ({ style: XLSX_STYLE_HEADER, text: h }))];',
    to:   '    const rows = [schema.map(h => ({ style: XLSX_STYLE_HEADER, text: h }))];',
    expect: 'E3 the heading row is filtered' },
  { t: APP, name: 'the widths keep the spacer columns, so the sheet is wrong',
    from: '    const widths = visible(schema).map((h, i) => (i === 0',
    to:   '    const widths = schema.map((h, i) => (i === 0',
    expect: 'E5 and so are the widths' },

  /* ---- the cross-width index bug, my own first cut ---------------------- */
  { t: APP, name: 'MY FIRST CUT: blank in EVERY year rather than in THIS year',
    from: '    const sameWidth = Object.keys(by).filter(y =>\r\n      Array.isArray(by[y]) && by[y].length === schema.length);',
    to:   '    const sameWidth = Object.keys(by).filter(y => Array.isArray(by[y]));',
    /* C1:2023 names index 1 "Category", so the wider years keep their spacer
     * there and C1 stays six columns wide -- T1 is what counts the width */
    expect: 'T1 C1:2025' },

  /* ---- the body filter shifts the index --------------------------------- */
  { t: APP, name: 'THE HARNESS DEFECT, planted in the APP: filter BEFORE the map',
    from: '      rows.push(visible(schema.map((h, c) => {',
    to:   '      rows.push(visible(schema).map((h, c) => {',
    /* c then means the VISIBLE position, so every emitted cell reads the wrong
     * stored column -- exactly what fillLikeOperator was doing by accident */
    expect: 'E4 the body maps over the FULL schema then filters' },

  /* ---- the stored-year gate --------------------------------------------- */
  { t: APP, name: 'THE REPORT PAGE gets the filter too, which is out of scope',
    from: '    const colGroup = Array.isArray(opts.colWidths) && opts.colWidths.length',
    to:   '    const colGroup = false && Array.isArray(opts.colWidths) && opts.colWidths.length',
    /* it trips the blast radius first, which is the honest place for it: a
     * change to renderTable is not this ticket's to make */
    expect: 'the change to renderTable is accounted for' },

  /* ---- the harness ------------------------------------------------------ */
  { t: SUITE, name: 'HARNESS: the round trip compares a file with itself',
    /* gutting the ASSERTION leaves R5 passing and proves nothing; starving
     * the guard of a NARROWER file is what R0 sees */
    from: '  const narrowHeader = schema.filter((_, i) => hide.indexOf(i) < 0);',
    to:   '  const narrowHeader = schema.slice();',
    expect: 'R0 the wide file has 8 headings and the narrow one 4' },
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '0076083';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X3 BASE is a literal commit sha' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('Section C group D -- mutation controls');
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
  try { out = execFileSync('node', ['suite_260.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }
  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const hit = fails.filter(l => l.indexOf(m.expect) >= 0);
  if (hit.length) {
    log('  red  ' + m.name);
    log('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 104));
    caught++;
  } else if (fails.length) {
    log('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    log('       want: ' + m.expect);
    log('       got : ' + fails[0].trim().slice(5, 104));
    missed++;
  } else { log('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.'); missed++; }
});

log('');
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length + ' guards');
let clean = '';
try { clean = execFileSync('node', ['suite_260.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-260-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
