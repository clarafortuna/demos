/* CLCPA-300: the staged summary counts the columns that receive values.
 *
 * THE GESTURE, in a real browser through the real Add Data dialog. H1 has four
 * columns and the file supplies all four; the Grand Total is calculated and
 * the importer deliberately skips it.
 *
 *   BEFORE : "2 rows, 3 matching columns, 4 values ready to import."
 *   AFTER  : "2 rows, 2 columns with values, 4 values ready to import."
 *
 * Two columns across two rows is four values. The number is now a figure the
 * operator can check against their own sheet.
 *
 * THE OWNER'S PRE-RULING offered aligning the count or rewording it so it
 * cannot read as a check figure. ALIGNED, because the aligned number IS a
 * check figure, and a number the reader is told not to trust is worth less
 * than a true one. The VALUE count is unchanged, as ruled.
 *
 * ON THE TICKET'S A3 CASE -- "importing a fourth text column that is not
 * counted": that column is Program Name, a KEY column. It carries row
 * identity, not a value, and the reworded phrase says so. A3 reports three
 * columns with values and six values, which is three value columns across two
 * rows.
 *
 * BASE predates the change: 5cd167b.
 *
 * Run:  node suite_300.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
/* CLCPA-293's delta to the import path, extracted from app.js and shared,
 * so the four suites that reverse it cannot drift from it or each other. */
const bii = require('../_kit/bii_deltas.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || '5cd167b';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);
const SRC = fs.readFileSync(APP, 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => { try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); } };
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p);

function grab(name, src) {
  const anchor = '\r\n  function ' + name + '(';
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error('grab: no function ' + name);
  let j = src.indexOf('{', i), d = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) { j = k; break; } }
  }
  return src.slice(i + 2, j + 1);
}
/** the summary function, built and CALLED on a hand-made plan.
 *
 * ingestStagedSummary takes the STAGED wrapper { error, dry }, not the plan
 * itself. A first cut matched the function by guessing its parameter name,
 * found nothing, and took three guards down as THREW -- which is what guard()
 * exists for, but it was still the harness being wrong about the app. Grabbed
 * by NAME now. */
const summary = (src) => {
  const fn = new Function(grab('ingestStagedSummary', src) +
    '\nreturn ingestStagedSummary;')();
  return (plan) => fn({ dry: plan });
};

/* H1's shape: values land in two columns, the Grand Total is skipped */
const PLAN = {
  ok: true,
  addedRows: [{}, {}],
  matchedColumns: ['Non-DAC Repairs', 'DAC Repairs', 'Grand Total'],
  populated: [
    { column: 'Non-DAC Repairs' }, { column: 'DAC Repairs' },
    { column: 'Non-DAC Repairs' }, { column: 'DAC Repairs' },
  ],
};

log('======================================================================');
log('CLCPA-300 -- the summary counts the columns that receive values');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the defect, on the build that shipped it ----------------------- */
log('');
log('A. THE COUNT, ON BASE');
guard('A-block', () => {
  const s = summary(BASE_SRC)(PLAN);
  ok(/3 matching columns/.test(s), 'A1 BASE counted the MATCHED columns -- ' + s);
  ok(/4 values/.test(s), 'A2 while the value count was already right');
  ok(PLAN.matchedColumns.length === 3 &&
     new Set(PLAN.populated.map(p => p.column)).size === 2,
    'A3 three matched, two written: the third is the calculated column');
});

/* ---- B. the fix --------------------------------------------------------- */
log('');
log('B. WHAT IT SAYS NOW');
guard('B-block', () => {
  const s = summary(SRC)(PLAN);
  ok(/2 columns with values/.test(s), 'B1 two columns with values -- ' + s);
  ok(/4 values ready to import/.test(s), 'B2 and the value count is unchanged, as ruled');
  ok(!/matching column/.test(s), 'B3 the phrase that read as a match count is gone');
  /* THE TWO FIGURES ARE THE SAME DATA COUNTED TWICE, so they cannot disagree */
  ok(/2 rows, 2 columns with values, 4 values/.test(s),
    'B4 and 2 columns across 2 rows is 4 values: the number checks out');
});

/* ---- C. the shapes that must still read correctly ---------------------- */
log('');
log('C. SINGULARS, EMPTIES AND KEY COLUMNS');
guard('C-block', () => {
  const f = summary(SRC);
  ok(/1 column with values/.test(f({ ok: true, addedRows: [{}], populated: [{ column: 'x' }] })),
    'C1 one column is singular');
  ok(/0 columns with values, 0 values/.test(f({ ok: true, addedRows: [], populated: [] })),
    'C2 nothing imported reads as zero, not as a crash');
  /* A3: three VALUE columns; Program Name is a key, and carries identity */
  const a3 = f({ ok: true, addedRows: [{}, {}], populated:
    ['Total Participants', 'Avg. Incentives by Participant', 'Avg. Energy Savings by Participant (MMBtu)']
      .concat(['Total Participants', 'Avg. Incentives by Participant', 'Avg. Energy Savings by Participant (MMBtu)'])
      .map(c => ({ column: c })) });
  ok(/3 columns with values, 6 values/.test(a3),
    'C3 A3 reads three value columns and six values -- ' + a3);
  /* a rejected plan is untouched by this ticket */
  ok(/cannot be imported/.test(f({ ok: false, rejections: [{ why: 'nope.' }] })),
    'C4 a rejected file still reports its reason');
});

/* ---- D. what did not change -------------------------------------------- */
log('');
log('D. THE IMPORT ITSELF');
guard('D-block', () => {
  /* RE-POINTED, not widened: the CLCPA-282 operator-prose sweep lands later in
   * the same stack and rewords one rejection message. That ONE message is
   * normalised away; every other byte still has to match. */
  const NEW_MSG = "reject(headerCount > 1\r\n" +
    "        ? 'The file needs its ' + headerCount + ' heading rows and at least one ' +\r\n" +
    "          'data row. This table carries its headings on ' + headerCount + ' rows: ' +\r\n" +
    "          'a heading spanning several columns, then a row naming each one.'\r\n" +
    "        : 'The file needs a header row and at least one data row.', {});";
  const OLD_MSG = "reject('The file needs a header row and at least one data row.', {});";
  const K_NEW1 = "      reject('The file has no ' + ingestKeyColDescription(schema, 0).phrase +\r\n        ', which is the one that says which row each value belongs to. Download ' +\r\n        'the template for this table and year to see the headings it expects.', {});";
  const K_OLD1 = "      reject('The file has no \\u201c' + schema[0] + '\\u201d column, which is the one ' +\r\n        'that says which row each value belongs to. Download the template for this ' +\r\n        'table and year to see the headings it expects.', {});";
  const K_NEW2 = "        reject('The file has no ' + ingestKeyColDescription(schema, s).phrase +\r\n          '. This table has rows that repeat the same ' +\r\n          ingestKeyColDescription(schema, 0).short + ', so that column on ' +\r\n          'its own cannot say which row a value belongs to. Download the template ' +\r\n          'for this table and year to see the headings it expects.', {});";
  const K_OLD2 = "        reject('The file has no “' + schema[s] + '” column. This table has ' +\r\n          'rows that repeat the same “' + schema[0] + '”, so that column on ' +\r\n          'its own cannot say which row a value belongs to. Download the template ' +\r\n          'for this table and year to see the headings it expects.', {});";
  const normalise = (t) => t.replace(NEW_MSG, () => OLD_MSG)
    .replace(/      \/\* CLCPA-282: this message knows the count[\s\S]*?\*\/\r\n/, '')
    /* CLCPA-287 round 2: the two KEY-COLUMN rejections now describe a
     * column by role when it has no heading, because six published
     * table-years said: the file has no “” column. Named and reversed
     * here, exactly as the CLCPA-282 message above is. */
    .replace(K_NEW1, () => K_OLD1).replace(K_NEW2, () => K_OLD2);
  /* CLCPA-293 legitimately changes this path: a total the engine cannot
   * derive is now accepted from the preparer instead of being discarded in
   * silence. Its delta is reversed through the SHARED kit, extracted from
   * app.js rather than retyped, so the four suites that reverse it cannot
   * drift from the code or from each other. Every other byte still has to
   * match. */
  ok(bii.reverse293(normalise(grab('buildIngestImport', SRC))) ===
     grab('buildIngestImport', BASE_SRC),
    'D1 buildIngestImport matches BASE apart from the CLCPA-282 heading-rows ' +
    'message: only the summary sentence changed here');
  ok(/res\.matchedColumns\.push\(schema\[sIdx\]\);/.test(codeOnly(SRC)),
    'D2 matchedColumns is still collected, for anything else that wants it');
  ok(/const cols = new Set\(d\.populated\.map\(x => x\.column\)\)\.size;/.test(codeOnly(SRC)),
    'D3 and the summary counts distinct columns in the WRITTEN record');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha that predates the change');
  /* the summary is BUILT AND CALLED on both builds rather than grepped: the
   * defect is what the sentence SAYS, and only running it says that */
  ok(/summary\(BASE_SRC\)\(PLAN\)/.test(self) && /summary\(SRC\)\(PLAN\)/.test(self),
    'X2 the sentence is produced by both builds, not asserted from source text');
  ok(fs.existsSync(path.join(__dirname, 'gesture-300-output.txt')),
    'X3 and the browser gesture is committed beside it');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-300-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
