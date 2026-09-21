/* CLCPA-291: a TEXT column in a structure row has no value, it is not calculated.
 *
 * THE ARTEFACT IS BYTES, NOT DOM. This ticket is about what the generated
 * workbook contains, so the evidence is the real workbook built by the real
 * writer and read back cell by cell -- the same shape suite_274 uses, and the
 * one that has passed hosted. The browser adds download plumbing and nothing
 * this ticket can be wrong about.
 *
 *   BEFORE  A3 total row  ["Total","(calculated)","(calculated)","(calculated)","(calculated)"]
 *   AFTER   A3 total row  ["Total","(no value)",  "(calculated)","(calculated)","(calculated)"]
 *
 * (calculated) tells the preparer the dashboard fills the cell in, and makes
 * the importer SKIP it. Nothing can fill in a programme name, so the marker
 * was a promise about a text column that no code could keep.
 *
 * THE PREDICATE HAS TO SPAN EVERY YEAR, and that is the whole difficulty.
 * A7's "DAC Installations" holds numbers in 2024 and nothing in 2025, so a
 * test scoped to the displayed year calls it text and converts a genuine
 * numeric column. And a percent column is stored as the STRING "45%", which
 * bareNumber refuses by design -- asking it alone stamped (no value) across
 * J3, J4, J6 and J7. Both were measured before they reached a commit.
 *
 * MEASURED BLAST RADIUS: across every table in the payload, exactly TWO cells
 * change. A3 row 23 col 1 and A4 row 23 col 1.
 *
 * BASE predates the change: 91640bf.
 *
 * Run:  node suite_291.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
/* CLCPA-293's delta to the import path, extracted from app.js and shared,
 * so the four suites that reverse it cannot drift from it or each other. */
const bii = require('../_kit/bii_deltas.js');
const { boot } = require('../_kit/live_editor.js');
const { templateRows, dense } = require('../_kit/xlsx_read.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || '91640bf';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);
const SRC = fs.readFileSync(APP, 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

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
const assemble = (names, src) =>
  new Function(names.map(n => grab(n, src)).join('\n') +
    '\nreturn {' + names.map(n => n + ':' + n).join(',') + '};')();

/* CLCPA-292 round 2 scoped this predicate to the PUBLISHED years, so the
 * slice now needs isYearProtected AND the state it reads. A hand-fed slice
 * cannot see a missing closure -- it threw here rather than answering wrongly,
 * which is the good failure -- so the state is fed explicitly and by name. */
const assembleSeeded = (names, src, seedYears) =>
  new Function('__seed',
    'const state = { seedYears: __seed.map(String) };\n' +
    names.map(n => grab(n, src)).join('\n') +
    '\nreturn {' + names.map(n => n + ':' + n).join(',') + '};')(seedYears);

/** the REAL workbook for a table's newest year, read back cell by cell */
const tmpl = (id, src) => {
  const ys = Object.keys(P.tables[id].data || {});
  const y = ys[ys.length - 1];
  return templateRows(boot({ payload: P, tableId: id, year: y, src: src })
    .api.buildIngestWorkbook(id, y)).map(dense);
};
const totalRow = (rows) => rows.find(r => /^total$/i.test(String(r[0] || '').trim()));

log('======================================================================');
log('CLCPA-291 -- a text column in a structure row has NO VALUE');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the defect, on the build that shipped it ----------------------- */
log('');
log('A. THE DEFECT, ON BASE');
guard('A-block', () => {
  ok(!/function ingestTextOnlyColumn/.test(codeOnly(BASE_SRC)),
    'A1 BASE had no notion of a text-only column');
  ['A3', 'A4'].forEach((id) => {
    const t = totalRow(tmpl(id, BASE_SRC));
    ok(t && String(t[1]).trim() === '(calculated)',
      'A2.' + id + ' its Total row marked the Program Name cell (calculated) -- ' +
      JSON.stringify(t));
  });
  /* the marker is a promise with teeth: the importer SKIPS the cell */
  ok(/the template marks this cell as calculated, so it is left to /.test(BASE_SRC),
    'A3 and the importer skips a (calculated) cell, so the promise had teeth');
});

/* ---- B. the fix, in the real workbook ---------------------------------- */
log('');
log('B. WHAT THE TEMPLATE EMITS NOW');
guard('B-block', () => {
  ['A3', 'A4'].forEach((id) => {
    const t = totalRow(tmpl(id, SRC));
    ok(t && String(t[1]).trim() === '(no value)',
      'B1.' + id + ' the Program Name cell is (no value) -- ' + JSON.stringify(t));
    ok(t && String(t[2]).trim() === '(calculated)' &&
       String(t[3]).trim() === '(calculated)' && String(t[4]).trim() === '(calculated)',
      'B2.' + id + ' and every NUMERIC column of that row is still (calculated)');
    ok(t && String(t[0]).trim() === 'Total',
      'B3.' + id + ' the label column still carries the row label, not a marker');
  });
});

/* ---- C. the blast radius, measured across every table ------------------ */
log('');
log('C. EXACTLY TWO CELLS CHANGE, IN THE WHOLE PAYLOAD');
guard('C-block', () => {
  const diffs = [];
  Object.keys(P.tables).sort().forEach((id) => {
    const ys = Object.keys(P.tables[id].data || {});
    if (!ys.length) return;
    let a, b;
    try { a = tmpl(id, BASE_SRC); b = tmpl(id, SRC); } catch (e) { return; }
    /* MARKER CELLS ONLY. This ticket changes which MARKER a cell carries, and
     * the blast radius that matters is the set of marker cells that moved.
     * Diffing every cell also catches CLCPA-274 option (c), which lands later
     * in the same stack and legitimately changes hundreds of value cells --
     * that took this assertion red on a change it has no opinion about. */
    const isMarker = (x) => x === '(calculated)' || x === '(no value)';
    a.forEach((r, ri) => (r || []).forEach((v, c) => {
      const w = (b[ri] || [])[c];
      if (!isMarker(String(v).trim()) && !isMarker(String(w).trim())) return;
      if (String(v) !== String(w)) diffs.push(id + ' r' + ri + ' c' + c + ' ' +
        JSON.stringify(v) + '->' + JSON.stringify(w));
    }));
  });
  /* RE-PINNED by PARTITION, not by relaxing the count.
   *
   * CLCPA-241 gave A9's "% Change" pair a rule and CLCPA-289 therefore marks
   * it (calculated), which is ten more marker cells in the same sweep. This
   * ticket's own radius is still exactly two, and saying so requires
   * separating the two changes rather than widening the test to cover both. */
  const mine = diffs.filter(d => /"\(calculated\)"->"\(no value\)"/.test(d));
  const c289 = diffs.filter(d => /^A9 /.test(d) && /""->"\(calculated\)"/.test(d));
  /* CLCPA-308 marks the DERIVED ROWS of D2, D3, D4 and F7 the same way. A
   * separate bucket, so this ticket's own radius stays exactly two. */
  const c308 = diffs.filter(d => /^(D2|D3|D4|F7) /.test(d) && /""->"\(calculated\)"/.test(d));
  /* CLCPA-320 marks a total row by its ROLE, so J8's "Total" is marked in
   * every year rather than only where the arithmetic happened to confirm
   * it. Its own bucket: this ticket's radius stays exactly two. */
  const c320 = diffs.filter(d => /^J8 /.test(d) && /""->"\(calculated\)"/.test(d));
  ok(mine.length === 2, 'C1 exactly two template cells moved for THIS ticket -- ' + mine.length);
  ok(mine.every(d => /^A[34] /.test(d)),
    'C2 both in A3 and A4 -- ' + JSON.stringify(mine));
  ok(diffs.length === mine.length + c289.length + c308.length + c320.length,
    'C3 every other moved cell is CLCPA-289 marking A9 (' + c289.length +
    '), CLCPA-308 marking a derived row (' + c308.length +
    ') or CLCPA-320 marking J8s Total by role (' + c320.length + ') -- ' +
    JSON.stringify(diffs.filter(d => mine.indexOf(d) < 0 && c289.indexOf(d) < 0 &&
      c308.indexOf(d) < 0 && c320.indexOf(d) < 0)));
});

/* ---- D. the predicate, and the two ways it nearly went wrong ----------- */
log('');
log('D. WHAT COUNTS AS A TEXT COLUMN');
guard('D-block', () => {
  /* Every year named in this block is a PUBLISHED year, so scoping the
   * predicate to the published set leaves each assertion below saying exactly
   * what it said before -- D2b included, which is why it still exercises the
   * across-years contract it was written for. */
  const H = assembleSeeded(
    ['ingestTextOnlyColumn', 'isYearProtected', 'bareNumber', 'isPercentLiteral'],
    SRC, (P.meta && P.meta.years) || []);
  ok(H.ingestTextOnlyColumn(P.tables.A3, 1) === true,
    'D1 A3 Program Name is text in every year it has');
  /* A7's column holds numbers in 2024 and NOTHING in 2025. Worth keeping, but
   * be exact about WHICH guard saves it: 2025 is blank, so the blank-column
   * guard answers first and the all-years scope is never reached. A mutation
   * that scoped the predicate to one year went unnoticed against this. */
  ok(H.ingestTextOnlyColumn(P.tables.A7, 2) === false,
    'D2 A7 DAC Installations is NOT text (its 2025 column is blank, not textual)');
  /* THE ALL-YEARS SCOPE, exercised. A column holding TEXT in the newest year
   * and NUMBERS in an older one is the shape a year-scoped predicate gets
   * wrong, and the payload happens not to contain one -- so it is constructed.
   * The predicate is pure, so a constructed input tests its contract; the
   * blast-radius guard in C is what tests it against the real data. */
  const mixed = { data: { '2024': [[null, 5], [null, 7]], '2025': [[null, 'n/a'], [null, 'tbd']] } };
  ok(H.ingestTextOnlyColumn(mixed, 1) === false,
    'D2b a column with numbers in ANY year is not text, whatever the newest year holds');
  const allText = { data: { '2024': [[null, 'a']], '2025': [[null, 'b']] } };
  ok(H.ingestTextOnlyColumn(allText, 1) === true,
    'D2c and a column textual in every year IS text');
  /* CLCPA-292 round 2: A SCRATCH YEAR CANNOT DECIDE STRUCTURE. This is the
   * A3/2098 shape exactly -- phantom rows below the Total put the pattern
   * figures into the Program Name column, the all-years scope read them as
   * evidence the column was numeric, and the Total row lost its (no value)
   * marker as a result. 2098 is not published, so it no longer votes. */
  const poisoned = { data: { '2025': [[null, 'Clean Heat']], '2098': [[null, 333]] } };
  ok(H.ingestTextOnlyColumn(poisoned, 1) === true,
    'D2d a scratch year holding numbers does not make a name column numeric');
  /* and the scope is PUBLISHED, not newest-only: 2024 still votes */
  const oldNumeric = { data: { '2024': [[null, 5]], '2025': [[null, 'n/a']] } };
  ok(H.ingestTextOnlyColumn(oldNumeric, 1) === false,
    'D2e while an older PUBLISHED year holding numbers still disqualifies it');
  /* a percent column is stored as a STRING and bareNumber refuses it */
  ok(H.bareNumber('63%') === null,
    'D3 (bareNumber refuses a percent literal, by design)');
  ok(H.isPercentLiteral('63%') === true, 'D4 and isPercentLiteral is what reads it');
  ['J3', 'J4', 'J6', 'J7'].forEach((id) => {
    const sch = P.tables[id].schema_by_year[Object.keys(P.tables[id].schema_by_year)[0]];
    const pc = sch.findIndex(h => /%/.test(String(h || '')));
    ok(pc > 0 && H.ingestTextOnlyColumn(P.tables[id], pc) === false,
      'D5.' + id + ' its percent column is NOT text -- ' + JSON.stringify(sch[pc]));
  });
  ok(H.ingestTextOnlyColumn(P.tables.A3, 2) === false,
    'D6 a plainly numeric column is not text');
  /* a column blank everywhere says nothing and must not be converted */
  const blank = { data: { '2025': [[null, null], [null, '']] } };
  ok(H.ingestTextOnlyColumn(blank, 1) === false,
    'D7 a column blank in every year is left exactly as it was');
});

/* ---- E. the import path does not change -------------------------------- */
log('');
log('E. WHAT THE IMPORTER DOES WITH THE NEW MARKER');
guard('E-block', () => {
  const code = codeOnly(SRC);
  ok(/if \(String\(raw\)\.trim\(\) === INGEST_NOVALUE_MARKER\) \{/.test(code),
    'E1 the importer already skips a (no value) cell');
  ok(/if \(String\(raw\)\.trim\(\) === INGEST_CALC_MARKER\) \{/.test(code),
    'E2 as it skips a (calculated) one');
  /* RE-POINTED, not widened. This ticket does not touch buildIngestImport and
   * still does not. What DOES touch it, later in the same stack, is the
   * CLCPA-282 operator-prose sweep, which makes one rejection message say how
   * many heading rows a two-level table needs. That ONE message is normalised
   * away; every other byte still has to match. */
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
  /* CLCPA-309 does too, later in the same stack: the fraction advisory stops
   * firing on cells the engine recomputes, because it was telling operators
   * their figure had landed when the next recompute overwrote it. Reversed
   * through the same kit, by name, for the same reason. */
  {
    /* WHERE it differs, not merely THAT it differs. A byte-equality guard
     * over a 900-line function that reports only "not equal" costs an hour
     * to act on, every time a later ticket touches the import path. */
    /* NEWEST DELTA FIRST. reverse293's anchor is the accept clause that
     * CLCPA-293 round 4 rewrote, so running it before round 4's reversal
     * matches nothing and leaves round 1's delta in place -- which is what
     * the FIRST DIFFERENCE line reported until this order was fixed. */
    const got = bii.reverse293(bii.reverse309(bii.reverse293r4(
      normalise(grab('buildIngestImport', SRC)))));
    const want = grab('buildIngestImport', BASE_SRC);
    const ga = got.split('\r\n'), wa = want.split('\r\n');
    let d = 0;
    while (d < ga.length && d < wa.length && ga[d] === wa[d]) d++;
    const at = got === want ? '' : '  FIRST DIFFERENCE line ' + d +
      ': got ' + JSON.stringify((ga[d] || '').slice(0, 64)) +
      '  want ' + JSON.stringify((wa[d] || '').slice(0, 64));
    ok(got === want,
      'E3 buildIngestImport matches BASE apart from the CLCPA-282 heading-rows ' +
      'message: this ticket leaves the import path alone' + at);
  }
  ok(/s === '' \|\| s === INGEST_NOVALUE_MARKER;/.test(code),
    'E4 (no value) still counts as shape-blank, so the structure stays readable');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha that predates the change');
  /* C walks EVERY table rather than the two the ticket names: the blast
   * radius is measured, not asserted, and it is how the J-family regression
   * was caught before it was committed. */
  ok(/Object\.keys\(P\.tables\)\.sort\(\)\.forEach/.test(self),
    'X2 the blast radius is measured across every table, not the two named');
  ok(/templateRows\(boot\(/.test(self),
    'X3 the evidence is the REAL generated workbook, read back cell by cell');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-291-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
