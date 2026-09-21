/* CLCPA-301: the IMPORT path computes the row Grand Total it was leaving blank.
 *
 * THE GESTURE, in a real browser on a served build, through the real Add Data
 * dialog and the real hidden file input, both provenances. H1, four rows, the
 * total column carrying the template's own (calculated) marker on three of
 * them and a filed 999 on the fourth:
 *
 *   PRE-FIX   Manhattan 100 + 200 -> ""      Queens 300 + 400 -> ""
 *             Bronx      50 +  25 -> ""      Westchester 10 + 20 -> 999
 *             and SAVED that way: the store held no totals at all, while the
 *             grey column-totals row summed perfectly.
 *
 *   POST-FIX  Manhattan 300, Queens 700, Bronx 75, Westchester STILL 999 with
 *             the "does not add up" advisory still naming it. Saved, and the
 *             computed totals survive the save and a reload.
 *
 * THE CAUSE. The importer RECOGNISES a (calculated) marker and deliberately
 * does not write that cell, recording it in notTouched.computed so the app can
 * fill it. Nothing filled it. applyIngestImport installed the draft and called
 * recomputeTotals -- which strikes the COLUMN totals row, and is exactly why
 * that row looked right while every row total was blank.
 *
 * recomputeDerivableSums could not be reused as-is, and the reason matters:
 * its guardian asks whether the total was consistent BEFORE the edit, and an
 * imported row has no before. On import the qualifying case is a total the
 * file left BLANK. Same engine, same bareNumber semantics, different question
 * about which rows qualify -- which is why it is a second entry point over one
 * engine rather than a second engine.
 *
 * BASE predates the change: 3614466.
 *
 * Run:  node suite_301.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || '3614466';
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
function grabDecl(name, src) {
  let i = src.indexOf('\r\n  const ' + name + ' = ');
  if (i < 0) i = src.indexOf('\r\n  var ' + name + ' = ');
  if (i < 0) i = src.indexOf('\r\n  let ' + name + ' = ');
  if (i < 0) throw new Error('grabDecl: no declaration ' + name);
  let d = 0;
  for (let k = i + 2; k < src.length; k++) {
    const c = src[k];
    if (c === '{' || c === '[' || c === '(') d++;
    else if (c === '}' || c === ']' || c === ')') d--;
    else if (c === ';' && d === 0) return src.slice(i + 2, k + 1);
  }
  throw new Error('grabDecl: unterminated ' + name);
}
const grabAny = (n, s) => { try { return grab(n, s); } catch (e) { return grabDecl(n, s); } };
function assemble(names, src, extra) {
  const body = names.map(n => grabAny(n, src)).join('\n');
  const decl = Object.keys(extra || {});
  return new Function(...decl, body + '\nreturn {' + names.map(n => n + ':' + n).join(',') + '};')
    (...decl.map(k => extra[k]));
}
/* nothing is ever stubbed: every resolved name is grabbed from app.js */
function assembleResolving(seed, src, extra, label, probe) {
  const names = seed.slice();
  for (let i = 0; i < 40; i++) {
    try {
      const H = assemble(names, src, extra);
      if (probe) probe(H);            /* exercised, not merely built */
      if (label) log('       ' + label + ' assembled and exercised, ' + names.length +
        ' real functions: ' + names.join(', '));
      return H;
    } catch (e) {
      const m = /(\w+) is not defined/.exec((e && e.message) || '');
      if (!m || names.indexOf(m[1]) >= 0) throw e;
      names.push(m[1]);
    }
  }
  throw new Error('assembleResolving: unresolved after 40 rounds');
}

/* H1's shape, and the four rows the gesture imports */
const SCHEMA = ['Borough / County', 'Non-DAC Repairs', 'DAC Repairs', 'Grand Total'];
const imported = () => [
  ['Manhattan', 100, 200, null],
  ['Queens', 300, 400, null],
  ['Bronx', 50, 25, null],
  ['Westchester', 10, 20, 999],
];

log('======================================================================');
log('CLCPA-301 -- the import path computes the row Grand Total');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the defect, on the build that shipped it ----------------------- */
log('');
log('A. THE DEFECT, ON BASE');
guard('A-block', () => {
  ok(!/function fillDerivableSumsOnImport/.test(codeOnly(BASE_SRC)),
    'A1 BASE has no import-side fill at all');
  const applyBase = grab('applyIngestImport', BASE_SRC);
  ok(!/fillDerivableSumsOnImport/.test(applyBase),
    'A2 and applyIngestImport never filled anything');
  ok(/recomputeTotals\(/.test(applyBase),
    'A3 it called recomputeTotals -- the COLUMN totals, which is why the grey ' +
    'row summed while every row total was blank');
  /* the importer's own deliberate skip, unchanged by this ticket */
  ok(/the template marks this cell as calculated, so it is left to /.test(BASE_SRC),
    'A4 the importer already left a (calculated) cell to the app, on purpose');
});

/* ---- B. the fill, run for real ----------------------------------------- */
log('');
log('B. WHAT THE IMPORT NOW COMPUTES');
guard('B-block', () => {
  const rows = imported();
  const H = assembleResolving(['fillDerivableSumsOnImport'], SRC, { state: {} }, 'NEW',
    (h) => h.fillDerivableSumsOnImport(imported(), SCHEMA, 'H1'));
  const written = H.fillDerivableSumsOnImport(rows, SCHEMA, 'H1');
  ok(rows[0][3] === 300, 'B1 Manhattan 100 + 200 = 300  -- got ' + rows[0][3]);
  ok(rows[1][3] === 700, 'B2 Queens 300 + 400 = 700  -- got ' + rows[1][3]);
  ok(rows[2][3] === 75, 'B3 Bronx 50 + 25 = 75  -- got ' + rows[2][3]);
  ok(rows[3][3] === 999,
    'B4 Westchester KEEPS its filed 999 though its parts make 30 -- got ' + rows[3][3]);
  ok(written.length === 3, 'B5 exactly three cells were written -- ' + written.length);
  ok(written.every(w => w.column === 3), 'B6 all of them in the total column');
  /* the components are never touched */
  ok(JSON.stringify(rows.map(r => r.slice(0, 3))) ===
     JSON.stringify(imported().map(r => r.slice(0, 3))),
    'B7 and no component cell moved');
});

/* ---- C. one engine, one reader ----------------------------------------- */
log('');
log('C. THE SAME ENGINE AS THE EDITOR PATH');
guard('C-block', () => {
  const fn = grab('fillDerivableSumsOnImport', SRC);
  ok(/detectSumColumns\(headerRow, rows, tableId\)/.test(fn),
    'C1 the relationships come from detectSumColumns, as on the editor path');
  ok(/bareNumber\(row\[rel\.column\]\)/.test(fn) && /bareNumber\(row\[c\]\)/.test(fn),
    'C2 and every cell is read through bareNumber -- the one reader');
  /* (?<![A-Za-z]) because bareNumber( CONTAINS Number( -- the first cut of
   * this assertion failed on the very reader it exists to require. */
  ok(!/\bparseFloat\b|(?<![A-Za-z])Number\(/.test(codeOnly(fn)),
    'C3 with no second spelling of "what number does this cell hold"');
  ok(!/total/i.test(codeOnly(fn)),
    'C4 and NO row-label predicate: the rule is derived from the cells (CLCPA-200)');
  /* codeOnly FIRST: this function's own comment names recomputeTotals while
   * explaining the ordering, and an ordering test that reads prose is testing
   * the prose. Eight defects in this repo have come from exactly that. */
  const apply = codeOnly(grab('applyIngestImport', SRC));
  ok(/fillDerivableSumsOnImport\(i\.draft, i\.schema, i\.tableId\)/.test(apply),
    'C5 applyIngestImport -- the single apply funnel -- calls it');
  ok(apply.indexOf('fillDerivableSumsOnImport') < apply.indexOf('recomputeTotals'),
    'C6 BEFORE recomputeTotals, so the column totals are struck over a whole draft');
});

/* ---- D. the guardians --------------------------------------------------- */
log('');
log('D. WHAT MUST NOT HAPPEN');
guard('D-block', () => {
  const H = assembleResolving(['fillDerivableSumsOnImport'], SRC, { state: {} }, null,
    (h) => h.fillDerivableSumsOnImport(imported(), SCHEMA, 'H1'));
  /* A row that is not fully numeric is left alone entirely.
   *
   * THE ROW SET NEEDS A COMPLETE ROW IN IT. detectSumColumns returns NOTHING
   * for a set whose only row has a hole, so an assertion built on that alone
   * passes because the engine never ran -- it cannot fail, and the mutation
   * that deletes this very guard went unnoticed against it. Row 0 makes the
   * relationship detectable; row 1 is the one under test. */
  const partial = [['Manhattan', 100, 200, null], ['Queens', 300, null, null]];
  H.fillDerivableSumsOnImport(partial, SCHEMA, 'H1');
  ok(partial[0][3] === 300, 'D0 (the complete row still computes, so the engine ran)');
  ok(partial[1][3] === null,
    'D1 a row missing a component gets NO total -- ' + JSON.stringify(partial[1]));
  /* a numeric STRING is a number, per CLCPA-278 round 3 */
  const strs = [['Manhattan', '100', '200', null]];
  H.fillDerivableSumsOnImport(strs, SCHEMA, 'H1');
  ok(strs[0][3] === 300,
    'D2 numeric strings sum, the bareNumber semantics -- ' + JSON.stringify(strs[0]));
  /* a filed total that AGREES is still not rewritten: it is the preparer's */
  const agrees = [['Manhattan', 100, 200, 300]];
  const w = H.fillDerivableSumsOnImport(agrees, SCHEMA, 'H1');
  ok(agrees[0][3] === 300 && w.length === 0,
    'D3 a filed total that agrees is left as filed, not rewritten');
  /* an empty string is blank, not a figure */
  const blankStr = [['Manhattan', 100, 200, '']];
  H.fillDerivableSumsOnImport(blankStr, SCHEMA, 'H1');
  ok(blankStr[0][3] === 300,
    'D4 an empty-string total counts as blank -- ' + JSON.stringify(blankStr[0]));
});

/* ---- E. the editor path is untouched ------------------------------------ */
log('');
log('E. CLCPA-278 DOES NOT REGRESS');
guard('E-block', () => {
  /* RE-POINTED, not widened. This ticket still does not touch the editor
   * path. CLCPA-303 does, by exactly one guard: where a table declares a
   * column-wise total row, the row-wise recompute stands off the rows that
   * rule owns, so the cell where the two totals cross has one writer instead
   * of two. That clause is named and reversed here; every other byte still
   * has to match, and the reversal is armed so it cannot silently no-op. */
  const C303_OWN = "    if (((tableId && DERIVED_COLS[tableId]) || []).some(d => d.type === 'columnTotal') &&\r\n" +
    '        isAnchoredTotalRowLabel((rows[rowIndex] || [])[0])) return done;\r\n';
  const now = grab('recomputeDerivableSums', SRC);
  const hits = String(now).split(C303_OWN).length - 1;
  ok(hits === 1,
    'E0 the CLCPA-303 corner-ownership guard is present exactly once, so the ' +
    'reversal below tests something: ' + hits);
  ok(String(now).replace(C303_OWN, () => '')
       .replace(/[ ]*\/\* CLCPA-303: ONE WRITER PER CELL[\s\S]*?\*\/\r\n/, '') ===
     grab('recomputeDerivableSums', BASE_SRC),
    'E1 recomputeDerivableSums is BYTE-IDENTICAL to BASE apart from that ' +
    'one guard: this ticket leaves the editor path alone');
  ok(grab('rowSumIsConsistent', SRC) === grab('rowSumIsConsistent', BASE_SRC),
    'E2 and so is the kept-figure guardian it consults');
  ok(grab('bareNumber', SRC) === grab('bareNumber', BASE_SRC),
    'E3 and so is bareNumber, which both paths read through');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha that predates the change');
  ok(/if \(probe\) probe\(H\);/.test(self),
    'X2 the assembled function is CALLED, not merely built');
  ['gesture_301.js', 'gesture_301_save.js', 'repro_301_prefix_2097.png',
   'repro_301_postfix_2097.png'].forEach((f) => {
    ok(fs.existsSync(path.join(__dirname, f)), 'X3 gesture evidence committed: ' + f);
  });
  /* THE SAVE LEG IS PART OF THE GESTURE. The symptom was "land and SAVE with
   * no row totals", and a suite that stopped at the draft would have passed
   * through exactly the half the operator complained about. */
  ok(/STORED after save/.test(fs.readFileSync(path.join(__dirname, 'gesture_301_save.js'), 'utf8')),
    'X4 and the save leg is driven, not assumed');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-301-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
