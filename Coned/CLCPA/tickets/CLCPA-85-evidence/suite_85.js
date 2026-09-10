/* CLCPA-85: the Report Data spreadsheet import.
 *
 * The centrepiece is the EQUIVALENCE PROOF (see "=== ruling 1 ===" below):
 * for every fixture cell, the value the import writes is === the value the
 * editor's own input/blur handlers would write for the same keystrokes. Both
 * go through parseNumericInput, so the proof is that they agree cell for cell,
 * including type. That is what makes "as if the operator had typed it" a
 * demonstrated fact rather than a claim about intent.
 *
 * ONE baseline. BASE is pre-85 and never moves; there is no PREV yet.
 *
 * What this CANNOT prove, recorded honestly: the real <input type="file"> and
 * the real download on Dataverse, and how a genuine ConEd export behaves. The
 * fixtures are mine, so they cannot surprise me the way a real file can. Those
 * are hosted-only.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSS_REL = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const FIX = path.join(__dirname, 'fixtures');
const BASE = process.env.DAC_BASE_COMMIT || '11e2b96';   // pre-85, as deployed

const toCRLF = (t) => t.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
const SRC = fs.readFileSync(path.join(REPO, REL), 'utf8');
const CSS = fs.readFileSync(path.join(REPO, CSS_REL), 'utf8');
const BASE_SRC = toCRLF(execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
const PAYLOAD = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => { if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); } return !!c; };

/* ---------- extraction ---------------------------------------------------- */
function grab(src, name) {
  for (const pad of ['  ', '    ', '']) {
    for (const kw of ['function ', 'async function ']) {
      const head = '\r\n' + pad + kw + name + '(';
      const i = src.indexOf(head);
      if (i < 0) continue;
      const close = '\r\n' + pad + '}';
      const j = src.indexOf(close, i + head.length);
      if (j >= 0) return src.slice(i + 2, j + close.length);
    }
  }
  return null;
}
/* DERIVED_COLS is an IIFE: `const DERIVED_COLS = (function () { ... })();`
 *
 * A brace-balanced grab from the first { stops at the FUNCTION BODY's close and
 * yields an uncalled function, so DERIVED_COLS came back with zero keys and I
 * nearly recorded "no table has derived columns" as a fact. It has 26. So this
 * is line-based and ends on the invocation, not on a brace. */
function grabDecl(src, name) {
  const L = src.split('\r\n');
  let s = -1, e = -1;
  const open = new RegExp('^  const ' + name + ' = ');
  for (let i = 0; i < L.length; i++) {
    if (s < 0) { if (open.test(L[i])) s = i; }
    else if (/^  \}\)\(\);/.test(L[i]) || /^  \};/.test(L[i])) { e = i; break; }
  }
  if (s < 0 || e < 0) return null;
  return L.slice(s, e + 1).join('\n');
}

/* isSplitCell and friends come from CLCPA-216, which was rolled back under the
 * payload freeze: the payload holds ZERO split cells today (measured, not
 * assumed). They are extracted because totalRowFlags and rawNum call them, so
 * leaving them out makes the shared functions throw rather than run. */
const WANT_FN = ['parseCsvRows', 'normIngestKey', 'ingestComputed', 'buildIngestImport',
  /* CLCPA-240 dependencies: buildIngestImport and buildIngestWorkbook read
     these, so the functions cannot be assembled without them. */
  'ingestKeyColCount', 'ingestIsBlankCell', 'ingestIsHeaderRow', 'ingestGroupOf', 'ingestRowKey',
                 'parseNumericInput', 'totalRowFlags', 'rawNum',
                 'ingestTemplateSource', 'getTableSchema', 'getTableBody',
                 'formatIngestValue', 'compareTableIds', 'isStrictTotalRowLabel',
                 'isSplitCell', 'cellText', 'cellCount', 'cellPct'];
const missing = [];
const parts = [];
WANT_FN.forEach(n => {
  const t = grab(SRC, n);
  if (t) parts.push(t); else missing.push(n);
});
const DC = grabDecl(SRC, 'DERIVED_COLS');
if (!DC) missing.push('DERIVED_COLS');
if (missing.length) {
  console.error('EXTRACTION FAILED, missing: ' + missing.join(', '));
  process.exit(1);
}

/* CLCPA-85 round 4: the CSV template is GONE. The template is now an .xlsx
 * workbook, built by buildIngestWorkbook and covered by suite_85_xlsx.js.
 * This suite is the ENGINE suite and keeps the import path, which is
 * unchanged and still CSV only. */

let api;
try {
  const body = '"use strict";\n' +
    'const state = { payload: PAYLOAD, ingest: {} };\n' +
    'const console = { warn: () => {}, info: () => {}, error: () => {} };\n' +
    DC + '\n' +
    /* CLCPA-240 dependencies. Single-line consts, so a bounded one-line match
     * rather than grabDecl, which scans to the next dedented `};`. Read from
     * the SOURCE, never retyped. */
    ['INGEST_KEY_COLS', 'INGEST_GROUPED', 'INGEST_KEY_SEP', 'INGEST_CALC_MARKER']
      .map(n => (SRC.match(new RegExp('\\r\\n  const ' + n + ' = [^;\\r\\n]*;')) || [''])[0].trim())
      .filter(Boolean).join('\n') + '\n' +
    parts.join('\n') + '\n' +
    'return { parseCsvRows, buildIngestImport, parseNumericInput,' +
    ' ingestComputed, normIngestKey, ingestTemplateSource, getTableSchema, getTableBody,' +
    ' totalRowFlags, state };';
  api = new Function('PAYLOAD', body)(PAYLOAD);
} catch (e) {
  console.error('SHELL FAILED: ' + e.message);
  process.exit(1);
}

const A1 = PAYLOAD.tables['A1'];
const A1_SCHEMA = api.getTableSchema(A1, '2023');
const A1_DRAFT = () => api.getTableBody(A1, '2023').map(r => r.slice());
const readFix = (n) => fs.readFileSync(path.join(FIX, n), 'utf8');
const plan = (fixture, schema, draft, tableId) =>
  api.buildIngestImport(api.parseCsvRows(readFix(fixture)),
    schema || A1_SCHEMA, draft || A1_DRAFT(), tableId || 'A1');

lines.push('======================================================================');
lines.push('CLCPA-85 -- Report Data import from CSV');
lines.push('======================================================================');

lines.push('');
lines.push('=== the CSV parser, against what real exports emit ===');
{
  ok(api.parseCsvRows('a,b\r\n1,2\r\n').length === 2, 'CRLF is ONE terminator, not two rows');
  ok(api.parseCsvRows('a,b\n1,2\n').length === 2, 'LF alone works');
  ok(api.parseCsvRows('a,b\r1,2\r').length === 2, 'bare CR works');
  ok(api.parseCsvRows('\uFEFFa,b\r\n1,2').length === 2 &&
     api.parseCsvRows('\uFEFFa,b\r\n1,2')[0][0] === 'a', 'a UTF-8 BOM is stripped');
  const q = api.parseCsvRows('a,b\r\n"x, y",2');
  ok(q[1][0] === 'x, y', 'a quoted field keeps its comma');
  const qq = api.parseCsvRows('a\r\n"say ""hi"""');
  ok(qq[1][0] === 'say "hi"', 'doubled quotes unescape to one');
  ok(api.parseCsvRows('a,b\r\n1,2\r\n\r\n\r\n').length === 2, 'trailing blank lines are dropped');
  const ml = api.parseCsvRows('a\r\n"one\r\ntwo"');
  ok(ml.length === 2 && /\r?\n/.test(ml[1][0]), 'a quoted newline stays INSIDE the field');
  // the fixture forms
  ok(api.parseCsvRows(readFix('a1-2023-lf-bom.csv'))[0][0] === 'Program Name',
     'the LF+BOM fixture parses to a clean header');
  ok(api.parseCsvRows(readFix('a1-2023-reordered.csv')).length === 2,
     'the reordered fixture drops its two trailing blank lines');
}

lines.push('');
lines.push('=== ruling 1: EQUIVALENCE with the typing path ===');
{
  /* The editor writes, for a value column:
   *     state.ingest.draft[r][c] = parseNumericInput(e.target.value)
   * so the proof is: for every cell the import writes, the written value is
   * === parseNumericInput(<the raw file text>). Same function, same result,
   * same TYPE. Checked across every fixture that imports.
   */
  const fixtures = ['a1-2023-complete.csv', 'a1-2023-partial.csv',
                    'a1-2023-with-totals.csv', 'a1-2023-bad-header.csv',
                    'a1-2023-lf-bom.csv', 'a1-2023-reordered.csv'];
  let checked = 0, agreed = 0;
  const disagreed = [];
  fixtures.forEach(f => {
    const raw0 = api.parseCsvRows(readFix(f));
    const before = A1_DRAFT();
    const res = api.buildIngestImport(raw0, A1_SCHEMA, before.map(r => r.slice()), 'A1');
    if (!res.ok) return;
    // mirror the engine: skip leading comment lines, find the label column by
    // its heading rather than assuming column 0.
    let rows = raw0;
    while (rows.length && /^\s*#/.test(String(rows[0][0] == null ? '' : rows[0][0]))) rows = rows.slice(1);
    const header = rows[0].map(api.normIngestKey);
    const schemaNorm = A1_SCHEMA.map(api.normIngestKey);
    const labelCol = header.indexOf(api.normIngestKey(A1_SCHEMA[0]));
    /* Classify on the PRE-WRITE draft, which is what the engine does.
     *
     * totalRowFlags is VALUE-dependent: it decides a row is a total partly by
     * whether it sums the rows above. Classifying on the post-write candidate
     * de-classified A1's Total row the moment the import changed a body row,
     * and this check then demanded that the total have been overwritten. The
     * engine is right and the check was wrong. */
    const computed = api.ingestComputed(before, 'A1', A1_SCHEMA);
    rows.slice(1).forEach(r => {
      header.forEach((h, fIdx) => {
        if (fIdx === labelCol || !h) return;
        const c = schemaNorm.indexOf(h);
        if (c <= 0) return;
        const raw = r[fIdx];
        if (raw == null || String(raw).trim() === '') return;
        const lbl = api.normIngestKey(r[labelCol]);
        const rIdx = res.candidate.findIndex(row => api.normIngestKey(row[0]) === lbl);
        if (rIdx < 0) return;
        if (computed.any(rIdx, c)) return;   // never written, by design
        checked++;
        const typed = api.parseNumericInput(raw);
        if (res.candidate[rIdx][c] === typed) agreed++;
        else disagreed.push(f + ' ' + lbl + '/' + A1_SCHEMA[c] +
          ' got ' + JSON.stringify(res.candidate[rIdx][c]) +
          ' want ' + JSON.stringify(typed));
      });
    });
  });
  if (disagreed.length) lines.push('       ' + disagreed.join('\n       '));
  ok(checked > 0, 'the equivalence check had ' + checked + ' cells to compare');
  ok(checked === agreed,
     'EVERY imported cell === what the typing path would store: ' + agreed + '/' + checked);

  // and the same for types specifically, which is where a parser goes wrong
  ok(api.parseNumericInput('1,234') === 1234, 'commas stripped, as when typed');
  ok(api.parseNumericInput('$2500') === 2500, 'dollar signs stripped, as when typed');
  ok(api.parseNumericInput('') === null, 'empty becomes null, as when typed');
  ok(api.parseNumericInput('31%') === '31%', 'a percent stays the STRING "31%"');
  ok(typeof api.parseNumericInput('7') === 'number', 'a number is a number, not a string');
}

lines.push('');
lines.push('=== mapping: headers and labels, order-blind ===');
{
  const r = plan('a1-2023-complete.csv');
  ok(r.ok, 'the complete fixture imports');
  ok(r.populated.length === 6, 'three rows x two editable columns = 6 cells: ' + r.populated.length);
  ok(r.addedRows.length === 0, 'and it adds no rows: every label already existed');

  const ro = plan('a1-2023-reordered.csv');
  ok(ro.ok && ro.populated.length === 1, 'a file with its COLUMNS reversed still lands');
  const target = ro.candidate.filter(x => api.normIngestKey(x[0]) === 'ameep - electric & gas')[0];
  ok(target && target[2] === 888, 'and lands in the right column: ' + (target && target[2]));

  const pa = plan('a1-2023-partial.csv');
  ok(pa.ok, 'the partial fixture imports');
  ok(pa.populated.length === 2, 'two cells, one column: ' + pa.populated.length);
  ok(pa.notTouched.unmatchedRows.length > 0,
     'and the rows it did not mention are LISTED: ' + pa.notTouched.unmatchedRows.length);
  // rows out of order landed on the right labels
  const g = pa.candidate.filter(x => api.normIngestKey(x[0]) === 'clean heat \u2013 c&i gshp')[0];
  const am = pa.candidate.filter(x => api.normIngestKey(x[0]) === 'ameep - electric & gas')[0];
  ok(g && g[2] === 111 && am && am[2] === 222,
     'rows matched by LABEL, not position, though the file reversed them');

  // untouched cells keep their draft value
  const before = A1_DRAFT();
  ok(before[0][1] === pa.candidate[0][1],
     'a column the file omitted is untouched in the draft');

  /* A BLANK is not an instruction to erase.
   *
   * The operator's file will routinely have gaps, and an import that read a gap
   * as "set this to nothing" would silently delete published figures. So a
   * blank LEAVES the draft alone and is counted. */
  const bl = plan('a1-2023-blank-cell.csv');
  ok(bl.ok, 'a file with a blank cell imports');
  const am2 = bl.candidate.filter(x => api.normIngestKey(x[0]) === 'ameep - electric & gas')[0];
  const orig2 = before.filter(x => api.normIngestKey(x[0]) === 'ameep - electric & gas')[0];
  ok(am2 && orig2 && am2[1] === orig2[1],
     'the BLANK cell left the draft value alone: ' + (am2 && am2[1]));
  ok(am2 && am2[1] !== null, 'and specifically did not erase it to null');
  ok(am2 && am2[2] === 31700000, 'while the filled cell beside it did import');
  ok(bl.blankSkipped.length === 1, 'and the blank is counted: ' + bl.blankSkipped.length);
}

lines.push('');
lines.push('=== percent strings and text round-trip ===');
{
  const C2 = PAYLOAD.tables['C2'];
  const r = api.buildIngestImport(api.parseCsvRows(readFix('c2-2023-percent.csv')),
    api.getTableSchema(C2, '2023'), api.getTableBody(C2, '2023').map(x => x.slice()), 'C2');
  ok(r.ok, 'the C2 percent fixture imports');
  const dac = r.candidate.filter(x => api.normIngestKey(x[0]) === 'dac')[0];
  ok(dac && dac[1] === '44%', 'a percent cell is stored as the STRING "44%": ' + (dac && dac[1]));
  ok(dac && typeof dac[1] === 'string', 'and its type is string, not 0.44');

  const F5 = PAYLOAD.tables['F5'];
  const rf = api.buildIngestImport(api.parseCsvRows(readFix('f5-2023-text.csv')),
    api.getTableSchema(F5, '2023'), api.getTableBody(F5, '2023').map(x => x.slice()), 'F5');
  ok(rf.ok, 'the F5 text fixture imports');
  const bk = rf.candidate.filter(x => api.normIngestKey(x[0]) === 'beekman')[0];
  ok(bk && bk[1] === 'Manhattan', 'a text column keeps its text');
  ok(bk && bk[2] === 1234, 'and "1,234" became the number 1234');
  const bo = rf.candidate.filter(x => api.normIngestKey(x[0]) === 'borden')[0];
  ok(bo && bo[2] === 2500, 'and "$2500" became 2500');
}

lines.push('');
lines.push('=== ruling C: computed cells are NOT TOUCHED, not rejected ===');
{
  const r = plan('a1-2023-with-totals.csv');
  ok(r.ok, 'a file containing calculated cells still IMPORTS (not a hard rejection)');
  ok(r.notTouched.computed.length > 0,
     'the calculated cells are reported: ' + r.notTouched.computed.length);
  ok(r.notTouched.computed.every(x => /calculated/.test(x.why)),
     'each with a reason naming why');
  // the derived column is A1's "% in DACs"
  ok(r.notTouched.computed.some(x => x.column === '% in DACs'),
     'the derived column is among them, by name');
  // and it was NOT written
  const am = r.candidate.filter(x => api.normIngestKey(x[0]) === 'ameep - electric & gas')[0];
  const dIdx = A1_SCHEMA.indexOf('% in DACs');
  const orig = A1_DRAFT().filter(x => api.normIngestKey(x[0]) === 'ameep - electric & gas')[0];
  ok(am && orig && am[dIdx] === orig[dIdx],
     'and the derived cell still holds what it held, not the file value');
  ok(!r.rejections.length, 'nothing was rejected for it');

  /* ROUND 4: the template's own marker is never a value.
   *
   * Found by the .xlsx round trip, not by inspection. totalRowFlags is
   * VALUE-dependent, so on a brand new year (labels only, no numbers) a Total
   * row is not classified as computed, and the "(calculated)" the template
   * wrote into its cells would have imported as that literal string. */
  const mk = plan('a1-2023-marker.csv');
  ok(mk.ok, 'a file containing the (calculated) marker still imports');
  const mkRow = mk.candidate.filter(x => api.normIngestKey(x[0]) === 'ameep - electric & gas')[0];
  const mkOrig = A1_DRAFT().filter(x => api.normIngestKey(x[0]) === 'ameep - electric & gas')[0];
  ok(mkRow && mkOrig && mkRow[1] === mkOrig[1],
     'the marked cell keeps its draft value: ' + (mkRow && mkRow[1]));
  ok(mkRow && mkRow[1] !== '(calculated)',
     'and is NOT the literal string, which is the defect this fixes');
  ok(mkRow && mkRow[2] === 31700000, 'while the real value beside it imports');
  ok(mk.notTouched.computed.some(x => /template marks this cell as calculated/.test(x.why)),
     'and it is reported as not touched, with the marker named as the reason');

  /* The Total row is protected BEHAVIOURALLY, not just reported. A1's row 24 is
   * "Total" and the fixture supplies values for it. */
  const tot = r.candidate.filter(x => api.normIngestKey(x[0]) === 'total')[0];
  const totOrig = A1_DRAFT().filter(x => api.normIngestKey(x[0]) === 'total')[0];
  ok(tot && totOrig && tot[1] === totOrig[1] && tot[2] === totOrig[2],
     'the Total ROW kept its values, though the file supplied new ones');
  ok(r.notTouched.computed.some(x => api.normIngestKey(x.label) === 'total'),
     'and it is named in not-touched');

  /* ORDERING, and it is load-bearing. totalRowFlags is VALUE-dependent: it
   * decides a row is a total partly by whether it sums the rows above. So
   * classification must happen BEFORE the writes. Classify afterwards and a
   * changed body row de-classifies the total, which would then be overwritten.
   * My own harness had this backwards first, which is how it surfaced. */
  const engine = grab(SRC, 'buildIngestImport');
  const classifyAt = engine.indexOf('const computed = ingestComputed(candidate');
  const writeAt = engine.indexOf('candidate[t.rowIdx][cIdx] = parseNumericInput(raw);');
  ok(classifyAt > 0 && writeAt > 0 && classifyAt < writeAt,
     'the engine classifies computed cells BEFORE it writes any value');
  /* Demonstrate the dependency, so the ordering is not folklore.
   *
   * Measured: changing ONE body cell does not move the flag, but zeroing the
   * body does. So the sensitivity is real and a whole-table import is exactly
   * the size of change that trips it. */
  const flagsBefore = api.totalRowFlags(A1_DRAFT(), 'A1', A1_SCHEMA);
  ok(flagsBefore[24] === true, 'A1 row 24 IS a total row on the unmodified draft');
  const zeroed = A1_DRAFT();
  zeroed.slice(0, 24).forEach(row => { row[1] = 0; row[2] = 0; });
  const flagsAfter = api.totalRowFlags(zeroed, 'A1', A1_SCHEMA);
  ok(flagsAfter[24] === false,
     'and rewriting the body de-classifies it, which is why order matters');
}

lines.push('');
lines.push('=== hard rejections: the WHOLE import fails, draft untouched ===');
{
  [['a1-2023-bad-cell.csv', /formula/i, 'a formula'],
   ['a1-2023-multiline.csv', /more than one line/i, 'a multi-line cell'],
   ['a1-2023-dup-label.csv', /rows with this label/i, 'duplicate labels']].forEach(([f, re, what]) => {
    const r = plan(f);
    ok(!r.ok, what + ': the import FAILS');
    ok(r.candidate === null, what + ': and no candidate draft is produced at all');
    ok(r.rejections.length > 0 && re.test(r.rejections[0].why),
       what + ': with a reason saying why');
    ok(r.rejections.some(x => x.label || x.column),
       what + ': and NAMING the cell or row');
  });

  // a file that matches no column at all
  const none = api.buildIngestImport(
    api.parseCsvRows('Nope,Nothing\r\na,1'), A1_SCHEMA, A1_DRAFT(), 'A1');
  ok(!none.ok && /template/i.test(none.rejections[0].why),
     'a file matching no column is rejected and points at the template');

  // one data row only
  const bare = api.buildIngestImport(
    api.parseCsvRows('Program Name,DAC Funding ($)'), A1_SCHEMA, A1_DRAFT(), 'A1');
  ok(!bare.ok && /header row and at least one data row/.test(bare.rejections[0].why),
     'a header with no data rows is rejected');
}

lines.push('');
lines.push('=== unmatched columns are reported, not guessed ===');
{
  const r = plan('a1-2023-bad-header.csv');
  ok(r.ok, 'an unknown column does not fail the import');
  ok(r.notTouched.unmatchedColumns.indexOf('Nonsense Column') >= 0,
     'it is listed by its own heading');
  ok(r.populated.length === 1, 'and the column that DID match still imported');
}

lines.push('');
lines.push('=== the PRIMARY FLOW: a freshly added year has zero rows ===');
{
  // The seeding truth, asserted rather than assumed: applyAddedYears adds the
  // year to meta.years and creates NO table data, so getTableBody returns [].
  ok(/all\.sort\(\(a, b\) => parseInt\(b\) - parseInt\(a\)\); payload\.meta\.years = all/
     .test(SRC), 'applyAddedYears only writes meta.years');
  ok(!/applyAddedYears[\s\S]{0,600}\.data\[/.test(SRC),
     'and never writes table.data, so a new year has no rows');
  ok(api.getTableBody(A1, '2026').length === 0,
     'getTableBody for an unseeded year returns zero rows');
  ok(api.getTableSchema(A1, '2026').length === A1_SCHEMA.length,
     'but the SCHEMA falls back, so the columns are known: ' +
     api.getTableSchema(A1, '2026').length);

  // so every file row must become a NEW row
  const r = api.buildIngestImport(api.parseCsvRows(readFix('a1-2026-newyear.csv')),
    api.getTableSchema(A1, '2026'), [], 'A1');
  ok(r.ok, 'importing into an empty year works');
  ok(r.addedRows.length === 2, 'both file rows became NEW rows: ' + r.addedRows.length);
  ok(r.candidate.length === 2, 'and the draft now has two rows');
  ok(r.populated.length === 4, 'with four cells populated: ' + r.populated.length);
  ok(r.candidate[0][0] === 'AMEEP - Electric & Gas', 'the label came from the file');
  ok(r.candidate[0][1] === 40000000 && r.candidate[0][2] === 36000000, 'and the values with it');
  // a new row is shaped exactly as the editor's + Add row shapes one
  ok(/const newRow = state\.ingest\.schema\.map\(\(\) => null\);/.test(SRC) &&
     /newRow\[0\] = '';/.test(SRC),
     'the editor shapes a new row as schema.map(() => null) with label in col 0');
  ok(r.candidate[0].length === api.getTableSchema(A1, '2026').length,
     'and the imported row is that same shape');
}

lines.push('');
lines.push('=== ruling D: the template moved to .xlsx (round 4) ===');
{
  /* The CSV template and its assertions are DELETED, not weakened: the
   * deliverable is an .xlsx workbook now, and suite_85_xlsx.js proves the
   * same properties on it (borrowed labels, blank values, (calculated)
   * markers, and a round trip through this suite's own importer).
   *
   * What is asserted HERE is only that the dead CSV generator really is gone
   * and took nothing live with it. */
  ok(SRC.indexOf('function buildIngestTemplate') < 0,
     'the CSV template generator is deleted');
  ok(SRC.indexOf('function csvField') < 0,
     'and csvField with it, having had no other caller');
  ok(BASE_SRC.indexOf('function buildIngestTemplate') < 0,
     'BASE control: neither existed before this ticket');
  ok(SRC.indexOf('function buildIngestWorkbook') >= 0,
     'and the workbook builder is what replaced it');
  ok(SRC.indexOf('function ingestTemplateSource') >= 0,
     'ingestTemplateSource SURVIVES: the workbook borrows labels the same way');
}

lines.push('');
lines.push('=== leading # comment lines are still skipped (round 6 gap) ===');
{
  /* FOUND by re-running the ROUND 1 mutation set against round 6 code: the
   * mutation that stops the importer skipping leading # lines left every suite
   * green. The skip used to be covered incidentally, because round 1's CSV
   * template emitted comment lines and every template round trip went through
   * them. Round 4 replaced that template with the workbook, which emits none,
   * and the shipped skip lost its only coverage.
   *
   * It is guarded here rather than deleted: an operator can still hand-write a
   * CSV with a comment line, and tolerating that is a real behaviour. */
  const withComments = '# A.1 Incentive $, reporting year 2026\r\n' +
    '# do not edit the header row\r\n' +
    A1_SCHEMA.join(',') + '\r\n' +
    '"AMEEP - Electric & Gas",111,222,\r\n';
  const rows = api.parseCsvRows(withComments);
  ok(rows.length === 4, 'the parser hands over all four rows, comments included');
  const res = api.buildIngestImport(rows, A1_SCHEMA, [], 'A1');
  ok(res.ok, 'the import plans cleanly despite the two comment lines' +
     (res.ok ? '' : ': ' + (res.rejections[0] || {}).why));
  ok(res.populated.length === 2,
     'and the DATA row imports: ' + res.populated.length + ' cells');
  ok(res.addedRows.length === 1 && res.addedRows[0] === 'AMEEP - Electric & Gas',
     'under its real label, not a comment line: ' + JSON.stringify(res.addedRows));
  ok(!res.notTouched.unmatchedRows.some(x => /^#/.test(String(x.label || ''))),
     'no comment line is reported as an unmatched row');
  /* the failure mode the skip prevents: row 0 read as the header */
  ok(res.notTouched.unmatchedColumns.length === 0,
     'and no column is unmatched, which is what a comment read as the header does');
}

lines.push('');
lines.push('=== ruling 1 control: the import cannot reach Dataverse ===');
{
  const engine = [grab(SRC, 'buildIngestImport'), grab(SRC, 'applyIngestImport'),
                  grab(SRC, 'parseCsvRows'), grab(SRC, 'wireIngestStaging'),
                  grab(SRC, 'buildIngestWorkbook')].join('\n');
  ok(!/Storage\./.test(engine), 'no Storage call anywhere in the import path');
  ok(!/dvCreate|dvUpdate|dvDelete|saveTable/.test(engine), 'no write of any kind');
  ok(!/fetch\(/.test(engine), 'and no fetch');
  // it ends at the draft, and Save is untouched
  const apply = grab(SRC, 'applyIngestImport');
  ok(/i\.draft = res\.candidate;/.test(apply), 'apply assigns the DRAFT');
  ok(/recomputeTotals\(/.test(apply) && /recomputeDirty\(\)/.test(apply),
     'then runs the same two steps the editor runs after any edit');
  ok(BASE_SRC.indexOf('Storage.saveTable(i.tableId, i.year, clone2D(i.draft)') >= 0 &&
     SRC.indexOf('Storage.saveTable(i.tableId, i.year, clone2D(i.draft)') >= 0,
     'the Save path is byte-identical to the pre-85 build');
}

lines.push('');
lines.push('=== the surfaces exist and say the right things ===');
{
  /* Round 2 moved the CONTROLS into the dialog and left the RECEIPT on the
   * page, so these now check renderIngestImportBar.
   *
   * RENDERED, not read as source. The bar builds its sentence across two string
   * literals, so /then you press/ never matched the source even though the
   * output says exactly that: the check was testing the concatenation rather
   * than the words the operator sees. */
  const panel = new Function(
    grab(SRC, 'renderIngestImportBar') + '\nreturn renderIngestImportBar();')();
  const result = grab(SRC, 'renderIngestImportResult');
  ok(/accept=\\"\.csv,text\/csv\\"/.test(panel) || /accept="\.csv,text\/csv"/.test(panel),
     'the file input accepts CSV only');
  ok(/Save Excel files as CSV/.test(panel), 'the bar says to save Excel as CSV (ruling A)');
  ok(/then you press/.test(panel) && /Save/.test(panel),
     'and that the operator presses Save');
  ok(/Nothing was imported/.test(result) && /draft below is untouched/.test(result),
     'the rejected case says nothing was imported and the draft is untouched');
  /* CLCPA-234 addendum: THE SUCCESS PANEL IS TWO LINES. The not-touched
   * section and the added-rows call-out are gone from it, deliberately: on a
   * success the filled table is on screen immediately below, so the operator
   * reads the values rather than a description of them.
   *
   * Asserted as an ABSENCE rather than by dropping the pin, so the detail
   * cannot creep back onto the success panel unnoticed. */
  const successHalf = result.slice(result.indexOf('CLCPA-234 addendum'));
  ok(successHalf.length > 0, 'the success half of the renderer is found');
  ok(!/Not touched/.test(successHalf),
     'the success panel has NO not-touched section: the table is right below it');
  ok(!/Rows added/.test(successHalf),
     'and no added-rows enumeration');
  ok(/Imported into the draft: /.test(successHalf) &&
     /Nothing has been saved yet/.test(successHalf),
     'it is the cell count and the save reminder, and nothing else');
  /* AND THE HALF THE RULING PROTECTS: a rejection still names everything,
   * because there is nothing on screen for the operator to read instead. */
  const rejectHalf = result.slice(0, result.indexOf('CLCPA-234 addendum'));
  ok(/r\.rejections\.map/.test(rejectHalf),
     'a rejection still lists every rejection');
  ok(/cell\(x\)/.test(rejectHalf),
     'naming the cell and column for each');
  ok(/Nothing was imported/.test(rejectHalf),
     'and heads the panel with the fact that nothing was imported');
  ok(/ingest-import-bad/.test(result) && /\.ingest-import-bad/.test(CSS),
     'the rejected case is styled distinctly, and that rule exists');
  ok(/i\.importResult = null;/.test(SRC), 'a stale result is cleared on selection change');
  ok(grab(SRC, 'loadIngestDraft').indexOf('importResult = null') > 0,
     'and cleared in loadIngestDraft, which every picker handler calls');

  // BASE controls
  ok(BASE_SRC.indexOf('renderIngestImport') < 0, 'BASE control: no import panel before');
  ok(BASE_SRC.indexOf('parseCsvRows') < 0, 'BASE control: no CSV parser before');
  ok(BASE_SRC.indexOf('downloadTextFile') < 0, 'BASE control: no shared download helper before');

  /* A CORRECTION to a claim in the plan. I wrote that no download mechanism
   * existed because wireExportButton is window.print(). Wrong: the app already
   * open-coded Blob downloads TWICE, in the map CSV export and in
   * mlDownloadExample. So downloadTextFile generalises rather than invents, and
   * mlDownloadExample now calls it instead of being a third copy. */
  /* Counted, after getting it wrong once: my first count of 3 included my OWN
   * new helper in the current file. BASE had TWO open-coded Blob downloads. */
  ok((BASE_SRC.match(/new Blob\(/g) || []).length === 2,
     'BASE fact: two open-coded Blob downloads existed, not zero');
  /* Counted again in round 4, which added downloadBinaryFile for the .xlsx.
   * Two SHARED helpers (text and binary) plus the one inside the map closure
   * they cannot reach. The duplicate mlDownloadExample used to be is still
   * gone, which is the property that matters. */
  ok((SRC.match(/new Blob\(/g) || []).length === 3,
     'three Blob sites: two shared helpers plus the map closure s own');
  ok(/function downloadTextFile\(/.test(SRC) && /function downloadBinaryFile\(/.test(SRC),
     'and the two shared ones are the text and binary helpers');
  ok(/function mlDownloadExample\(\) \{\r?\n\s*downloadTextFile\(/.test(SRC),
     'mlDownloadExample calls the shared helper rather than repeating it');
  ok(!/csvCell/.test(grab(SRC, 'buildIngestWorkbook') || ''),
     'the workbook builder does not reach the map closure’s csvCell either');

  /* THE BOM, and why these assertions INVERTED in round 4.
   *
   * The write-side BOM existed because the CSV template had to survive Excel
   * OPENING it: without one Excel read the local codepage and mangled the long
   * dashes in the row labels, and a mangled label then failed to match on
   * re-import, silently duplicating the row.
   *
   * The template is an .xlsx now, which Excel reads natively, so nothing writes
   * a CSV for Excel and the parameter lost its only caller. The concern does
   * not disappear, it CHANGES DIRECTION: Excel writes the CSV and the parser
   * reads it, so what matters is the READ side stripping a BOM. That is
   * asserted in the parser section above and re-stated here. */
  ok(!/function downloadTextFile\(filename, text, mime, bom\)/.test(SRC),
     'the write-side bom parameter is gone, having lost its only caller');
  ok(!/\\uFEFF' \+ text/.test(SRC), 'and nothing prepends one on write');
  ok(api.parseCsvRows('\uFEFFa,b\r\n1,2')[0][0] === 'a',
     'the READ side strips a BOM, which is the direction that matters now');
  // the labels that made it matter really are in the data, and still are
  ok(api.getTableBody(A1, '2023').some(r => /–/.test(String(r[0]))),
     'A1 really does have long dashes in its row labels: ' +
     JSON.stringify((api.getTableBody(A1, '2023').filter(r => /–/.test(String(r[0])))[0] || [])[0]));
  ok(/window\.print\(\)/.test(BASE_SRC), 'BASE fact: the Export BUTTON is still window.print()');

  /* THE DASH RULE, on the strings this ticket adds. No long dashes anywhere,
   * UI strings included. An ESCAPED — renders as an em dash to the
   * operator, so it breaks the rule exactly as a literal one would, and mine
   * was escaped: checked in both forms. */
  const mine = [grab(SRC, 'renderIngestImport'), grab(SRC, 'renderIngestImportResult'),
                grab(SRC, 'buildIngestWorkbook'), grab(SRC, 'buildIngestImport'),
                grab(SRC, 'parseCsvRows'), grab(SRC, 'downloadBinaryFile'),
                grab(SRC, 'wireIngestStaging'), grab(SRC, 'xlsxInstructionLines')].join('\n');
  ok(!/[—–]/.test(mine), 'no LITERAL long dash in any CLCPA-85 function');
  ok(!/\\u201[34]/.test(mine), 'and no ESCAPED one either, which renders the same');
}

lines.push('');
lines.push('======================================================================');
lines.push('  ' + pass + ' passed, ' + fail + ' failed');
lines.push('======================================================================');
const out = lines.join('\n');
console.log(out);
fs.writeFileSync(path.join(__dirname, 'suite-output.txt'), out + '\n');
process.exitCode = fail ? 1 : 0;
