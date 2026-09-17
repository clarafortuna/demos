/* Mutation controls for CLCPA-273.
 *
 * Two things have to be provable: the TYPED route really notices now, and the
 * IMPORT route really did not move (H1 is the reference wording and must not
 * regress). Controls for both, plus the ones that keep the advisory advisory.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-273-evidence';
const APP = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_273.js';

const M = [
  /* ---- the typed route ---------------------------------------------------- */
  { t: APP, name: 'THE DEFECT RETURNS: the blur handler stops noticing',
    from: '        noteTypedPercent(r, c, e.target.value);\r\n',
    to:   '',
    expect: 'F1 the raw text is read BEFORE parseNumericInput destroys it' },
  { t: APP, name: 'NOTICED TOO LATE: read after the parse, when the evidence is gone',
    from: '        noteTypedPercent(r, c, e.target.value);\r\n        state.ingest.draft[r][c] = (c === 0) ? e.target.value : parseNumericInput(e.target.value);',
    to:   '        state.ingest.draft[r][c] = (c === 0) ? e.target.value : parseNumericInput(e.target.value);\r\n        noteTypedPercent(r, c, state.ingest.draft[r][c]);',
    expect: 'F1 the raw text is read BEFORE parseNumericInput destroys it' },
  { t: APP, name: 'THE COLUMN TEST IS DROPPED, so a % column advises about itself',
    from: '    if (!isPercentLiteral(raw) || pctCols[c]) {',
    to:   '    if (!isPercentLiteral(raw)) {',
    expect: 'C6 a percent typed into a PERCENTAGE column says nothing',
    alt: 'D2 typed and imported agree on ALL 156 columns' },
  { t: APP, name: 'THE COLUMNS ARE NOT DERIVED: an empty pct mask',
    from: '    const pctCols = detectPctColumns(i.schema || []);',
    to:   '    const pctCols = [];',
    expect: 'F2 the editor derives its percentage columns from the SCHEMA',
    alt: 'C6 a percent typed into a PERCENTAGE column says nothing' },
  { t: APP, name: 'THE LABEL COLUMN stops being exempt',
    from: '    if (!i || c === 0) return;',
    to:   '    if (!i) return;',
    expect: 'C13 the label column is exempt' },
  { t: APP, name: 'ADVISORIES STACK: retyping one cell leaves duplicates',
    from: '    if (at >= 0) i.typedUnitNotices[at] = entry; else i.typedUnitNotices.push(entry);',
    to:   '    i.typedUnitNotices.push(entry);',
    expect: 'C8 retyping one cell REPLACES its advisory' },
  { t: APP, name: 'A CORRECTED CELL keeps its advisory forever',
    from: '      if (at >= 0) i.typedUnitNotices.splice(at, 1);\r\n      return;',
    to:   '      return;',
    expect: 'C10 and correcting the value REMOVES the advisory' },
  { t: APP, name: 'NOT CLEARED when the operator changes table-year',
    from: '    i.typedUnitNotices = [];\r\n',
    to:   '',
    expect: 'F8 and the advisories are cleared when the editor changes table-year' },

  /* ---- the CLCPA-266 component ------------------------------------------- */
  { t: APP, name: 'THE WRONG ACCENT: the advisory turns red like a rejection',
    from: "    return '<div class=\"ingest-import-notice is-warn\">' +\r\n      '<h4>Read as a fraction: '",
    to:   "    return '<div class=\"ingest-import-notice is-alert\">' +\r\n      '<h4>Read as a fraction: '",
    expect: 'C2 and renders in the CLCPA-266 AMBER box' },
  { t: APP, name: 'THE WORDING drifts from H1\'s reference',
    from: "      '<h4>Read as a fraction: ' + n.length + ' cell' + (n.length === 1 ? '' : 's') + '</h4>' +",
    to:   "      '<h4>Percent converted: ' + n.length + ' cell' + (n.length === 1 ? '' : 's') + '</h4>' +",
    expect: 'C3 with CLCPA-261\'s wording, H1 as the reference' },
  { t: APP, name: 'THE CELL IS NOT NAMED, so the operator cannot find it',
    from: "    const cell = (x) => (x.label ? x.label + ' / ' : '') + (x.column == null ? '' : x.column);",
    to:   "    const cell = (x) => 'a cell';",
    expect: 'C4 naming the row and the column, as the import advisory does' },

  /* ---- the import path must not move -------------------------------------- */
  { t: APP, name: 'THE IMPORT PATH REGRESSES: its predicate is retuned',
    from: '  function isPercentLiteral(raw) {\r\n    return /^\\s*[-+]?[\\d.,]+\\s*%\\s*$/.test(String(raw));',
    to:   '  function isPercentLiteral(raw) {\r\n    return /%/.test(String(raw));',
    expect: 'B2 the regex is the one CLCPA-261 shipped, character for character',
    alt: 'E4 the import plan is IDENTICAL to BASE on all four tables, notices included' },
  { t: APP, name: 'THE IMPORT PATH REGRESSES: its column gate is inverted',
    from: '        if (isPercentLiteral(raw) && !pctCols[cIdx]) {',
    to:   '        if (isPercentLiteral(raw) && pctCols[cIdx]) {',
    expect: 'A1 the import advisory fires for ALL FOUR tables (H1, I1, C2, C3)',
    alt: 'E4 the import plan is IDENTICAL to BASE on all four tables, notices included' },
  { t: APP, name: 'THE INLINE COPY comes back, so there are two predicates again',
    from: '        if (isPercentLiteral(raw) && !pctCols[cIdx]) {',
    to:   '        if (/^\\s*[-+]?[\\d.,]+\\s*%\\s*$/.test(String(raw)) && !pctCols[cIdx]) {',
    expect: 'B3 and it now appears exactly ONCE -- the inline copy is gone',
    alt: 'E3 and it is the call to the extracted predicate' },

  /* ---- advisory, never a rejection --------------------------------------- */
  { t: APP, name: 'THE ADVISORY STARTS REJECTING',
    from: '  function noteTypedPercent(r, c, raw) {\r\n    const i = state.ingest;',
    to:   '  function noteTypedPercent(r, c, raw) {\r\n    const i = state.ingest;\r\n    if (i && i.typedUnitNotices) i.reject = true;',
    expect: 'F7 the typed advisory rejects nothing' },
  { t: APP, name: 'A TABLE IS HARDCODED into the new code',
    from: "    const pctCols = detectPctColumns(i.schema || []);",
    to:   "    const pctCols = i.tableId === 'H1' ? detectPctColumns(i.schema || []) : [];",
    expect: 'F4 no added CODE line names a table id',
    alt: 'C6 a percent typed into a PERCENTAGE column says nothing' },

  /* ---- the harness -------------------------------------------------------- */
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || 'be1d2a2';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X1 BASE is pinned to a literal commit sha' },
  { t: SUITE, name: 'HARNESS: the predicate is re-implemented instead of sliced',
    from: "  const f = h.call(a => a.isPercentLiteral);",
    to:   "  const f = (s) => /^\\s*[-+]?[\\d.,]+\\s*%\\s*$/.test(String(s));",
    /* a suite that carries its own copy proves nothing about the shipped one */
    expect: 'B0 the predicate under test is the NAMED function sliced from app.js',
    alt: 'B0b and its body is byte-present in the shipped app.js' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-273 -- mutation controls');
log('======================================================================');

let caught = 0, missed = 0, applied = 0;
M.forEach((m) => {
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  if (n !== 1) { log('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED'); missed++; return; }
  applied++;
  fs.writeFileSync(m.t, base.replace(from, () => to));
  let out = '';
  try { out = execFileSync('node', ['suite_273.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }
  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const want = [m.expect].concat(m.alt ? [m.alt] : []);
  const hit = fails.filter(l => want.some(w => l.indexOf(w) >= 0));
  if (hit.length) {
    log('  red  ' + m.name);
    log('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 112));
    caught++;
  } else if (fails.length) {
    log('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    log('       want: ' + want.join(' OR '));
    log('       got : ' + fails[0].trim().slice(5, 112));
    missed++;
  } else { log('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.'); missed++; }
});

log('');
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + applied + ' applied');
let clean = '';
try { clean = execFileSync('node', ['suite_273.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-273-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
