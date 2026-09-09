/* Mutation controls for the dacCol schema fallback.
 *
 * The dangerous direction is WIDENING: a fallback that fires when the year DOES
 * have a schema would silently read another year's column layout for a real
 * reporting year, and the payload-wide equivalence assertion is what catches
 * that. The other direction -- dacRow gaining the same fallback -- would
 * fabricate values, so it gets its own control.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DIR = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/daccol-schema-fallback-evidence';
const APP = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_daccol.js';

const M = [
  /* ---- the fix, reverted -------------------------------------------- */
  { t: APP, name: 'THE FIX IS REVERTED: no fallback',
    from: "    const by = t.schema_by_year || {};\n    let s = by[y];\n    if (!s) {\n      const anyYear = Object.keys(by)[0];\n      s = anyYear ? by[anyYear] : null;\n    }\n    if (!s) return -1;",
    to:   "    const s = (t.schema_by_year || {})[y]; if (!s) return -1;",
    expect: 'clean_energy_spend HAS a 2099 value now' },

  /* ---- WIDENED: the fallback preempts a present schema -------------- */
  { t: APP, name: 'WIDENED: the fallback fires even when the year HAS a schema',
    from: "    let s = by[y];\n    if (!s) {",
    to:   "    let s = by[y];\n    if (true) {",
    /* now every real year reads whichever schema happens to be first */
    expect: 'it is IDENTICAL to BASE, byte for byte' },
  { t: APP, name: 'WIDENED: the fallback replaces the lookup entirely',
    from: "    let s = by[y];\n    if (!s) {\n      const anyYear = Object.keys(by)[0];\n      s = anyYear ? by[anyYear] : null;\n    }",
    to:   "    const anyYear = Object.keys(by)[0];\n    let s = anyYear ? by[anyYear] : null;",
    expect: 'it is IDENTICAL to BASE, byte for byte' },
  { t: APP, name: 'the fallback picks the LAST year rather than any',
    from: "      const anyYear = Object.keys(by)[0];",
    to:   "      const anyYear = Object.keys(by)[Object.keys(by).length - 1];",
    /* A1's years all share a schema so this is invisible there; the guard that
     * must catch it is the payload-wide one, across tables whose schema DOES
     * vary by year -- B2 gained a column in 2025 */
    /* caught STRUCTURALLY, and that is the honest description: first-vs-last
     * is behaviourally unreachable on current data, because the fallback only
     * fires for a year with NO schema and every such year belongs to a table
     * whose other years share one layout. B2 is the table whose schema varies
     * (it gained a column in 2025) and it has no schema-less year. */
    expect: 'dacCol falls back to any year' },

  /* ---- the OTHER direction: dacRow must never fall back ------------- */
  { t: APP, name: 'FABRICATION: dacRow gains the same fallback',
    from: "    const d = (t.data || {})[y]; if (!d) return null;",
    to:   "    const by = t.data || {}; let d = by[y];\n    if (!d) { const a = Object.keys(by)[0]; d = a ? by[a] : null; }\n    if (!d) return null;",
    /* another year's VALUES presented as this year's */
    expect: 'dacRow still refuses to fall back' },
  { t: APP, name: 'dacRow is edited at all',
    from: "  function dacRow(T, id, y, labelRe) {",
    to:   "  function dacRow(T, id, y, labelRe) {\n    void 0;",
    expect: 'dacRow is byte-identical to BASE' },

  /* ---- the claim that it is the SAME rule --------------------------- */
  { t: APP, name: 'getTableSchema loses its fallback, breaking the parity claim',
    from: "    if (table.schema_by_year) {\n      const anyYear = Object.keys(table.schema_by_year)[0];",
    to:   "    if (false) {\n      const anyYear = Object.keys(table.schema_by_year)[0];",
    expect: 'getTableSchema itself is byte-identical to BASE' },

  /* ---- downstream: the screen Emely verifies ----------------------- */
  { t: APP, name: 'the KPI usable-test rejects the imported year again',
    from: "        const usable = v && (typeof v.total === 'number' || typeof v.dac === 'number');",
    to:   "        const usable = v && (typeof v.total === 'number' && typeof v.dac === 'number' && false);",
    expect: 'clean_energy_spend HAS a 2099 value now' },
  { t: APP, name: 'buildSectionDAC stops reading the primary KPI',
    from: "        const v = kpi && kpi.values && kpi.values[y];",
    to:   "        const v = null;",
    expect: 'share for 2099 is 1' },
  { t: APP, name: 'card 1 starts rendering a figure for an empty E1',
    from: "    const eHas = eCats.length > 0;",
    to:   "    const eHas = true;",
    /* cards 1 and 3 must STAY dashed: the partial-rendering design */
    expect: 'card 1 Strategic Capital STAYS dashed' },

  /* ---- the second gap, pinned as measured -------------------------- */
  { t: APP, name: 'the chart loop drops its spec gate',
    from: "      (spec.years || years).forEach(y => {",
    to:   "      years.forEach(y => {",
    /* would make the charts compose for 2099 -- which is a DATA decision, not
     * a code one, so the suite must notice the code deciding it unilaterally */
    expect: 'the composed CHARTS are identical to BASE even for the imported year' },

  /* ---- the harness itself ------------------------------------------ */
  { t: SUITE, name: 'a name in the exclusion list is misspelled',
    from: "   'renderDumbbell', 'renderStripWithGap'].forEach(fn => {",
    to:   "   'renderDumbbellX', 'renderStripWithGap'].forEach(fn => {",
    expect: 'exists in both sources' },

  /* ---- exclusions -------------------------------------------------- */
  { t: APP, name: 'EXCLUSION: a KPI rule is widened to compensate',
    from: "    clean_energy_spend: (T, y) => ({",
    to:   "    clean_energy_spend: (T, y) => ({ /* x */",
    expect: 'DAC_KPI_REPORTED is byte-identical' },
  { t: APP, name: 'EXCLUSION: a second function is changed',
    from: "  function dacCell(T, id, y, labelRe, nameRe) {",
    to:   "  function dacCell(T, id, y, labelRe, nameRe) {\n    void 0;",
    expect: 'exactly ONE function changed' },
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
  try { out = execFileSync('node', ['suite_daccol.js'], { cwd: DIR, encoding: 'utf8' }); }
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
try { execFileSync('node', ['suite_daccol.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) {
  cleanOk = false;
  console.error('THE CLEAN RE-RUN FAILED.');
  console.error((e.stdout || '').split('\n').filter(l => /FAIL/.test(l)).join('\n'));
}

console.log('======================================================================');
console.log('dacCol schema fallback -- mutation controls');
console.log('======================================================================');
report.forEach(l => console.log(l));
console.log('');
console.log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length);
console.log('  clean re-run against restored source: ' + (cleanOk ? 'PASSES' : 'FAILED'));
process.exitCode = (missed || !cleanOk) ? 1 : 0;
