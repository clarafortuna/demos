/* CLCPA-292 round 2: a fresh-year template must not photocopy a scratch year.
 *
 * ROUND 1 SHIPPED THE KEY PRE-FILL AND MEASURED GREEN, and it was measured
 * against payload.json -- where every donor year is clean. The org is not
 * payload.json. A3 there carries 2098, an operator's working year: 22 rows
 * keyed "Test Program 1..22", a Total, then 22 phantom rows whose Program
 * Name cells hold the pattern figures 333/111/888. ingestTemplateSource took
 * the NEWEST year holding rows, so the "fresh" 2094 template was a photocopy
 * of that: 46 rows against a real structure of 23, junk keys, 22 rows below
 * the Total, and not one marker anywhere. A1 passed the identical test only
 * because its newest year happened to be clean. That is the whole lesson:
 * round 1's green came from the donor, not from the code.
 *
 * THE FIX IS ONE RULE IN TWO PLACES. Structure is decided by the PUBLISHED
 * years and never by a year somebody is working in:
 *   - ingestTemplateSource borrows from a published year
 *   - ingestTextOnlyColumn judges a column on the published years
 * The second is what CLCPA-291 rides on, and it was broken by the same cause:
 * the phantom rows put numbers in a column of programme names, so the Total
 * row's Program Name came out (calculated) instead of (no value).
 *
 * This is the same borrowed-donor mechanism as CLCPA-320 in Section G. One
 * root, and the declaration is on the ticket.
 *
 * Pins: DAC_BASE_COMMIT (the pre-change baseline), DAC_APP_OVERRIDE (feed a
 * broken app.js in -- how mut_292_r2.js works).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const KIT = path.join(ROOT, 'Coned/CLCPA/tickets/_kit');
const { boot } = require(path.join(KIT, 'live_editor.js'));
const { templateRows, dense } = require(path.join(KIT, 'xlsx_read.js'));

/* THE BASELINE PREDATES THE CHANGE. 2201ce2 is the tip the round 2 work
 * started from; pinning HEAD would make this a new-vs-new comparison, which
 * is blind to exactly the regression it is here to catch. */
const BASE = process.env.DAC_BASE_COMMIT || '2201ce2';

/* git blobs are LF, the working tree is CRLF, and every anchored search in
 * this harness looks for '\r\n'. An un-normalised baseline silently slices
 * from the end of the file instead of failing. */
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { maxBuffer: 1e9 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

let passed = 0, failed = 0;
const ok = (cond, label) => {
  if (cond) { passed++; console.log('  ok   ' + label); }
  else { failed++; console.log('  FAIL ' + label); }
};
const guard = (label, fn) => {
  try { fn(); } catch (e) { failed++; console.log('  FAIL ' + label + ' THREW: ' + e.message); }
};
/* a doc comment quoting the old code satisfies a search for the old code.
 * That has happened eight times in this repo, so structural pins go through
 * this and never through the raw source. */
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

/* ------------------------------------------------------------------ */
/* the org's A3/2098, reconstructed: 22 audit rows, a Total, 22 phantoms */
function contaminated() {
  const rows = [];
  for (let i = 1; i <= 22; i++) rows.push(['Residential', 'Test Program ' + i, 333, 111, 888]);
  rows.push(['Total', null, 7326, 2442, 19536]);
  for (let i = 1; i <= 22; i++) rows.push([null, [333, 111, 888][i % 3], null, null, null]);
  return rows;
}
const SEED = P.meta.years.map(String);

/* The app composes meta.years FROM THE ROWS, so an operator's year appears
 * there, and boot then subtracts the added-year table to rebuild seedYears.
 * Modelling only the first half -- which an earlier bench did -- makes every
 * year look published and the bench cannot tell a seed donor from a scratch
 * one. Both halves are modelled. */
function withScratchYears() {
  const pay = JSON.parse(JSON.stringify(P));
  pay.tables.A3.data['2098'] = contaminated();
  pay.meta.years = ['2094', '2098'].concat(SEED);
  return pay;
}
const template = (src, id, pay, seed) => {
  const b = boot({ payload: pay, tableId: id, year: '2094', src: src });
  b.state().seedYears = (seed || SEED).slice();
  return templateRows(b.api.buildIngestWorkbook(id, '2094')).map(dense);
};
const keyCol = (rows, c) => rows.map(r => String(r[c] == null ? '' : r[c]).trim());
const totalIdx = (rows) => rows.findIndex(r => /^total$/i.test(String(r[0] || '').trim()));

/* ================================================================== */
guard('A: the baseline really does carry the defect', () => {
  /* A suite whose premise has quietly stopped being true passes for the wrong
   * reason forever. The defect is asserted PRESENT on the baseline first. */
  const a3 = template(BASE_SRC, 'A3', withScratchYears());
  ok(a3.length === 46, 'A1 BASE: A3/2094 emits 46 rows, the scratch year copied whole (' + a3.length + ')');
  ok(keyCol(a3, 1).filter(v => /^Test Program/.test(v)).length === 22,
    'A2 BASE: 22 keys are "Test Program N"');
  ok(keyCol(a3, 1).filter(v => /^(333|111|888)$/.test(v)).length === 22,
    'A3 BASE: 22 keys are pattern FIGURES, from the rows below the Total');
  const ti = totalIdx(a3);
  ok(ti >= 0 && a3.length - 1 - ti === 22, 'A4 BASE: 22 rows sit BELOW the Total');
  ok(a3.every(r => !r.some(c => /^\((calculated|no value)\)$/.test(String(c)))),
    'A5 BASE: and not one marker anywhere in the sheet');
});

guard('B: the fix takes its structure from the published year', () => {
  const a3 = template(SRC, 'A3', withScratchYears());
  const real = P.tables.A3.data[SEED[0]].length;
  ok(a3.length === real + 1, 'B1 A3/2094 emits the published structure, ' +
    (real + 1) + ' rows with the heading (' + a3.length + ')');
  ok(keyCol(a3, 1).filter(v => /^Test Program/.test(v)).length === 0,
    'B2 no "Test Program" key survives');
  ok(keyCol(a3, 1).filter(v => /^(333|111|888)$/.test(v)).length === 0,
    'B3 no pattern FIGURE is keyed as a programme name');
  const ti = totalIdx(a3);
  ok(ti === a3.length - 1, 'B4 the Total is the last row: nothing sits below it');
  /* THE KEYS ARE THE PUBLISHED ONES, cell for cell, not merely "not junk".
   *
   * Read back through xlsx_read, which decodes LATIN1 BY DESIGN and does not
   * unescape XML, so a programme name with an en dash or an ampersand comes
   * back mangled by the READER rather than by the app. Undoing exactly those
   * two known losses is the honest comparison; widening the assertion to
   * "close enough" would delete the guard. The last row is excluded because
   * it is the Total, whose key cell is a marker by design -- C1 asserts it. */
  const unread = (s) => Buffer.from(s, 'latin1').toString('utf8')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
  const got = keyCol(a3, 1).slice(1, -1).map(unread);
  const want = P.tables.A3.data[SEED[0]].slice(0, -1)
    .map(r => String(r[1] == null ? '' : r[1]).trim());
  ok(JSON.stringify(got) === JSON.stringify(want),
    'B5 and every data key matches the published year exactly, in order');
});

guard('C: the CLCPA-291 gate, which rides this same download', () => {
  const a3 = template(SRC, 'A3', withScratchYears());
  const t = a3[totalIdx(a3)];
  ok(String(t[1]) === '(no value)',
    'C1 the Total row Program Name is (no value): nothing can compute a name');
  ok(t.slice(2).every(c => String(c) === '(calculated)'),
    'C2 and every numeric column on that row is (calculated)');
  /* the baseline got this WRONG, and for the same cause: the phantom rows put
   * figures in a column of names, so the predicate judged it numeric. */
  const base = template(BASE_SRC, 'A3', withScratchYears());
  const bt = base[totalIdx(base)];
  ok(!(bt && String(bt[1]) === '(no value)'),
    'C3 BASE did not, which is why 291 could not be signed off on a download');
});

guard('D: the clean donor is untouched, and that is the control', () => {
  /* A1's newest year was already clean, so the fix must change NOTHING here.
   * Round 1 passed on A1 alone; if the fix moved A1 it would be trading one
   * defect for another. */
  const before = template(BASE_SRC, 'A1', withScratchYears());
  const after = template(SRC, 'A1', withScratchYears());
  ok(JSON.stringify(before) === JSON.stringify(after),
    'D1 A1/2094 is byte-for-byte what it was');
  ok(after.length === 24 && totalIdx(after) === 23,
    'D2 (24 rows, Total last -- the shape that passed round 1)');
});

guard('E: every table, not the two that were looked at', () => {
  /* The blast radius. Round 1 measured two tables and shipped; this asserts
   * the rule over all of them: no fresh template may key a row on anything
   * the published year does not key it on. */
  const pay = withScratchYears();
  let checked = 0, bad = [];
  Object.keys(P.tables).forEach((id) => {
    const seedYear = SEED.filter(y => (P.tables[id].data[y] || []).length)[0];
    if (!seedYear) return;
    let rows;
    try { rows = template(SRC, id, pay); } catch (e) { bad.push(id + ' THREW ' + e.message); return; }
    checked++;
    const want = P.tables[id].data[seedYear].length + 1;
    if (rows.length !== want) bad.push(id + ' emitted ' + rows.length + ' want ' + want);
  });
  ok(checked >= 40, 'E1 the rule is measured over every table with a published year (' + checked + ')');
  ok(bad.length === 0, 'E2 and every one of them emits its published structure' +
    (bad.length ? ': ' + bad.slice(0, 4).join('; ') : ''));
});

guard('F: the degradation path, because losing the feature is worse', () => {
  /* A published-ONLY rule with an empty seedYears emits a heading and nothing
   * else FOR EVERY TABLE IN THE APP -- measured, during the build. That is a
   * larger failure than the one being fixed, so the rule prefers a published
   * year rather than requiring one. */
  const a3 = template(SRC, 'A3', withScratchYears(), []);
  ok(a3.length > 1, 'F1 with no published year known, a template still has rows (' + a3.length + ')');
  ok(a3.length === 46, 'F2 and it degrades to exactly the previous behaviour');
});

guard('X: the change is where it says it is', () => {
  const code = codeOnly(SRC);
  ok(/const published = withRows\.filter\(y => isYearProtected\(y\)\);/.test(code),
    'X1 ingestTemplateSource filters its donors by isYearProtected');
  ok(/const donor = published\.length \? published\[0\] : withRows\[0\];/.test(code),
    'X2 and prefers a published donor rather than requiring one');
  ok(/const published = all\.filter\(y => isYearProtected\(y\)\);/.test(code),
    'X3 ingestTextOnlyColumn judges on the published years too');
  /* ONE definition of "published", not two. isYearProtected is already that
   * definition and is reused rather than restated. */
  ok(!/seedYears/.test(codeOnly(
    SRC.slice(SRC.indexOf('function ingestTemplateSource'),
      SRC.indexOf('function ingestTemplateSource') + 1400))),
    'X4 and neither place restates what a published year is');
  ok(codeOnly(BASE_SRC).indexOf('const donor = published.length') < 0,
    'X5 (the baseline carries none of this)');
});

console.log('');
console.log('='.repeat(70));
console.log('  ' + passed + ' passed, ' + failed + ' failed');
console.log('='.repeat(70));
process.exit(failed ? 1 : 0);
