/* CLCPA-144 Tier 3 acceptance suite: derived ROWS for the transposed tables.
 *
 * EXPECTATIONS ARE INDEPENDENT OF THIS CODE. The 49 candidate cells, their rules and
 * the six client-visible movers were enumerated in the investigation and reviewed by
 * Emely BEFORE any of this was written; the rule triples below are re-derived here
 * from the payload rather than read out of DERIVED_ROWS, so a wrong rule in the
 * shipped table fails rather than agreeing with itself.
 *
 * THE RULING THIS SUITE ENFORCES: editor-only. rowsForDisplay must not move one of
 * the 49 cells. Baseline pinned by sha.
 */
const fs = require('fs');
const X = require('./app_extract.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos/';
const P = JSON.parse(fs.readFileSync(REPO + 'Coned/CLCPA/ExecutiveDashboard/payload.json', 'utf8'));
const BASE_REF = process.env.TIER3_BASE || 'e8b056e';
const nowSrc = fs.readFileSync(REPO + 'Coned/CLCPA/ExecutiveDashboard_dev/app.js', 'utf8');

let pass = 0, fail = 0, ctl = 0;
const fails = [];
const check = (n, ok, d) => { if (ok) { pass++; return; } fail++; fails.push(n + (d !== undefined ? '   <- ' + d : '')); };
const control = (n, ok, d) => { if (ok) { ctl++; return; } fail++; fails.push('CONTROL GREEN, BAD: ' + n + (d !== undefined ? '   <- ' + d : '')); };
const eq = (n, got, want) => check(n, JSON.stringify(got) === JSON.stringify(want),
  'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));

const NEW = X.engineFromDisk({
  required: ['recomputeTotals', 'rowsForDisplay', 'getTableSchema', 'getTableBody',
             'applyDerivedRows', 'derivedRowValue', 'derivedRowKeepsStored',
             'unreconciledDerivedRows', 'storedDecimals', 'addsOnlyPrecision',
             'DERIVED_ROWS', 'stripDerivedForPersist'],
});
const OLD = X.engineFromRef(BASE_REF, {
  required: ['recomputeTotals', 'rowsForDisplay', 'getTableSchema', 'getTableBody'],
});

const clone = rs => rs.map(r => r.slice());
const T3 = ['D2', 'D3', 'D4', 'F7'];
const tids = Object.keys(P.tables).sort();
const yearsOf = t => Object.keys(P.tables[t].data || {}).sort();
const schOf = (E, t, y) => E.getTableSchema(P.tables[t], y) || [];
const baseOf = (E, t, y) => E.getTableBody(P.tables[t], y);
const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;

/* The rules, restated from the investigation. NOT read from DERIVED_ROWS. */
const RULES = {
  D2: [[2, 1, 0], [5, 4, 3]],
  D3: [[2, 1, 0], [4, 3, 0]],
  D4: [[2, 1, 0], [4, 3, 0], [7, 6, 5], [9, 8, 5]],
};
const F7_RULE = [3, 2, 2];      // r3[c] = r2[c] / r2[last]

/** editor render, as the app performs it */
function edit(t, y) {
  const sch = schOf(NEW, t, y), base = baseOf(NEW, t, y);
  if (!Array.isArray(base) || !base.length || !sch.length) return null;
  const draft = clone(base);
  NEW.recomputeTotals(draft, sch, t, base);
  return { sch: sch, base: base, draft: draft };
}

/* ===================================================== 1. the rules are the right ones
 * Independently recompute every candidate cell and confirm the shipped rule produces
 * the same number. A wrong triple in DERIVED_ROWS fails here.
 */
let cells = 0;
Object.keys(RULES).forEach(t => yearsOf(t).forEach(y => {
  const sch = schOf(NEW, t, y), base = baseOf(NEW, t, y);
  RULES[t].forEach(([dr, nr, den]) => {
    for (let c = 1; c < sch.length; c++) {
      const N = num(base[nr][c]), D = num(base[den][c]);
      if (N === null || D === null || D === 0) continue;
      cells++;
      const mine = N / D;
      const theirs = NEW.derivedRowValue(base, { row: dr, numerator: nr, denominator: den, denomCol: null }, c, sch);
      check(t + '/' + y + ' r' + dr + 'c' + c + ' rule matches an independent r' + nr + '/r' + den,
            theirs !== null && Math.abs(theirs - mine) < 1e-12,
            'engine ' + theirs + ' independent ' + mine);
    }
  });
}));
yearsOf('F7').forEach(y => {
  const sch = schOf(NEW, 'F7', y), base = baseOf(NEW, 'F7', y);
  const [dr, nr] = F7_RULE;
  const D = num(base[nr][sch.length - 1]);
  for (let c = 1; c < sch.length; c++) {
    const N = num(base[nr][c]);
    if (N === null || D === null || D === 0) continue;
    cells++;
    const mine = N / D;
    const theirs = NEW.derivedRowValue(base, { row: dr, numerator: nr, denominator: nr, denomCol: 'last' }, c, sch);
    check('F7/' + y + ' r3c' + c + ' rule matches an independent r2[c]/r2[last]',
          theirs !== null && Math.abs(theirs - mine) < 1e-12,
          'engine ' + theirs + ' independent ' + mine);
  }
});
check('all 49 candidate cells were exercised', cells === 49, String(cells));

/* ===================================================== 2. THE RULING: editor only.
 * rowsForDisplay must not move one cell, in any table, anywhere in the payload.
 */
(function () {
  let bad = [];
  tids.forEach(t => yearsOf(t).forEach(y => {
    const rows = P.tables[t].data[y];
    if (!Array.isArray(rows) || !rows.length) return;
    const a = OLD.rowsForDisplay(clone(rows), OLD.getTableSchema(P.tables[t], y), t);
    const b = NEW.rowsForDisplay(clone(rows), NEW.getTableSchema(P.tables[t], y), t);
    if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(t + '/' + y);
  }));
  eq('the client report moves ZERO cells, payload-wide', bad, []);
})();
// and specifically the six movers the census flagged: pinned as NOT moving
const MOVERS = [
  ['D4', '2024', 4, 2, 0.4, 0.3397], ['D4', '2024', 7, 2, 0.02, 0.0205],
  ['F7', '2024', 3, 1, '34%', 0.3428], ['F7', '2024', 3, 2, '66%', 0.6572],
  ['F7', '2025', 3, 1, '32%', 0.3159], ['F7', '2025', 3, 2, '68%', 0.6841],
];
MOVERS.forEach(([t, y, r, c, stored, computed]) => {
  const rep = NEW.rowsForDisplay(clone(P.tables[t].data[y]), schOf(NEW, t, y), t);
  eq('REPORT keeps ' + t + '/' + y + ' r' + r + 'c' + c + ' at its published value',
     rep[r][c], stored);
  check(t + '/' + y + ' r' + r + 'c' + c + ' stored value matches the census',
        JSON.stringify(P.tables[t].data[y][r][c]) === JSON.stringify(stored));
});
check('applyDerivedRows is called exactly once in the source',
      (nowSrc.match(/applyDerivedRows\(/g) || []).length === 2,   // 1 definition + 1 call
      String((nowSrc.match(/applyDerivedRows\(/g) || []).length));
/* Containment asserted by INDEX, not by a regex window.
 *
 * My first version bounded it with a 6,000-character regex window and it failed:
 * the call sits 9,915 characters into the function. A character budget is the wrong
 * tool for "is this inside that" -- widening it only makes the assertion weaker,
 * since a large enough window would also match a call in the NEXT function.
 *
 * Bracketed by the following declaration instead, found with a literal indexOf on
 * '\n  function ' so it works on CRLF as well as LF. (My second version used a
 * regex literal and a heredoc turned its escape into a real newline, which is why
 * there is no regex here at all.) */
function bodyOf(src, decl) {
  const start = src.indexOf('function ' + decl);
  if (start < 0) return '';
  const next = src.indexOf('\n  function ', start + 10);
  return src.slice(start, next < 0 ? src.length : next);
}
check('the applyDerivedRows call is inside recomputeTotals',
      bodyOf(nowSrc, 'recomputeTotals').indexOf('applyDerivedRows(draft') > 0);
check('rowsForDisplay does NOT call applyDerivedRows',
      bodyOf(nowSrc, 'rowsForDisplay').indexOf('applyDerivedRows') < 0);
control('bodyOf actually isolates a body (recomputeTotals is not the whole file)',
        bodyOf(nowSrc, 'recomputeTotals').length > 500 &&
        bodyOf(nowSrc, 'recomputeTotals').length < nowSrc.length / 4);

/* ===================================================== 3. opening changes nothing */
const movedOnOpen = [];
T3.forEach(t => yearsOf(t).forEach(y => {
  const o = edit(t, y);
  o.draft.forEach((r, i) => r.forEach((v, c) => {
    if (JSON.stringify(v) !== JSON.stringify(o.base[i][c])) movedOnOpen.push(t + '/' + y + ' r' + i + 'c' + c);
  }));
}));
eq('opening D2/D3/D4/F7 with no edit changes nothing', movedOnOpen, []);
// payload-wide, a Save with no edit still persists nothing (slice B's guarantee)
const persists = [];
tids.forEach(t => yearsOf(t).forEach(y => {
  const o = edit(t, y);
  if (!o) return;
  const a = NEW.stripDerivedForPersist(clone(o.draft), t, o.sch);
  const b = NEW.stripDerivedForPersist(clone(o.base), t, o.sch);
  if (JSON.stringify(a) !== JSON.stringify(b)) persists.push(t + '/' + y);
}));
eq('a Save with no user edit still persists NOTHING, payload-wide', persists, []);

/* ===================================================== 4. the protected cells */
const prot = [];
T3.forEach(t => yearsOf(t).forEach(y => {
  NEW.unreconciledDerivedRows(baseOf(NEW, t, y), schOf(NEW, t, y), t)
     .forEach(k => prot.push(t + '/' + y + ' ' + k));
}));
eq('exactly D4/2024 has source disagreements in its derived rows',
   prot.sort(), ['D4/2024 4,2', 'D4/2024 7,2']);
check('D4/2024 r4c2 is the 6-point gap the census found',
      Math.abs(3545 / 10436 - 0.33969) < 1e-4 && P.tables.D4.data['2024'][4][2] === 0.4);
// F7's whole-percent strings are kept by the string branch, NOT by the protection
yearsOf('F7').forEach(y => {
  const o = edit('F7', y);
  [1, 2, 3].forEach(c => {
    check('F7/' + y + ' r3c' + c + ' keeps its stored form exactly',
          JSON.stringify(o.draft[3][c]) === JSON.stringify(o.base[3][c]),
          JSON.stringify(o.draft[3][c]));
  });
});
check('the percent-string branch keeps "34%" rather than replacing it with a number',
      NEW.derivedRowKeepsStored('34%', 0.342825).keep === true &&
      NEW.derivedRowKeepsStored('34%', 0.342825).value === '34%');
control('a percent string far from the computation is NOT kept',
        NEW.derivedRowKeepsStored('34%', 0.55).keep === false);

/* ===================================================== 5. THE POINT: edits propagate
 * The gap Tier 3 exists to close. Editing a count must move its percentage row.
 */
[['D2', '2025', 1, 2, 0], ['D3', '2025', 1, 2, 0], ['D4', '2025', 3, 4, 0]].forEach(
  ([t, y, numRow, pctRow, col0]) => {
    const o = edit(t, y);
    const c = 1;
    const draft = clone(o.base);
    const before = draft[pctRow][c];
    draft[numRow][c] = Number(draft[numRow][c]) * 2;      // double the DAC count
    NEW.recomputeTotals(draft, o.sch, t, o.base);
    check(t + '/' + y + ': doubling r' + numRow + ' moves the percentage row r' + pctRow,
          draft[pctRow][c] !== before && typeof draft[pctRow][c] === 'number',
          'stayed ' + JSON.stringify(draft[pctRow][c]));
    const expect = Number(o.base[numRow][c]) * 2 / Number(o.base[col0][c]);
    check(t + '/' + y + ': and to the right value',
          Math.abs(draft[pctRow][c] - expect) < 1e-9,
          draft[pctRow][c] + ' vs ' + expect);
    control('on ' + BASE_REF + ' the percentage row did NOT move', (function () {
      const d = clone(o.base);
      d[numRow][c] = Number(d[numRow][c]) * 2;
      OLD.recomputeTotals(d, o.sch, t, o.base);
      return JSON.stringify(d[pctRow][c]) === JSON.stringify(o.base[pctRow][c]);
    })());
  });
// F7 too, through its fixed-column denominator
(function () {
  const o = edit('F7', '2025');
  const draft = clone(o.base);
  draft[0][1] = Number(draft[0][1]) + 100000;    // more DAC interruptions
  NEW.recomputeTotals(draft, o.sch, 'F7', o.base);
  check('F7/2025: editing a body row moves the % of Grand Total row',
        JSON.stringify(draft[3][1]) !== JSON.stringify(o.base[3][1]),
        JSON.stringify(draft[3][1]));
})();
// and an edit does NOT unlock a protected cell
(function () {
  const o = edit('D4', '2024');
  const draft = clone(o.base);
  draft[1][1] = Number(draft[1][1]) + 10;        // edit a different row entirely
  NEW.recomputeTotals(draft, o.sch, 'D4', o.base);
  eq('D4/2024 r4c2 stays protected through an unrelated edit', draft[4][2], 0.4);
  eq('D4/2024 r7c2 stays protected too', draft[7][2], 0.02);
})();

/* ===================================================== 6. storedDecimals, the fix */
eq('storedDecimals reads through float noise (0.09300000000000001)',
   NEW.storedDecimals(0.09300000000000001), 3);
eq('storedDecimals(0.059000000000000004)', NEW.storedDecimals(0.059000000000000004), 3);
eq('storedDecimals(0.4)', NEW.storedDecimals(0.4), 1);
eq('storedDecimals(0.45)', NEW.storedDecimals(0.45), 2);
eq('storedDecimals(0.3754)', NEW.storedDecimals(0.3754), 4);
eq('storedDecimals(27833)', NEW.storedDecimals(27833), 0);
check('the two float-noise cells are NOT treated as source disagreements',
      NEW.addsOnlyPrecision(0.09300000000000001, 0.092703) === true &&
      NEW.addsOnlyPrecision(0.059000000000000004, 0.058942) === true);
control('on ' + BASE_REF + ' the string-length reading called them full precision',
        String(0.09300000000000001).split('.')[1].length > 12);
// slice B's E1 behaviour is unchanged by the fix
[[0.4, 0.399065128291635], [0.5, 0.49866709233477036], [0.45, 0.45279327779072387]].forEach(
  ([s, c]) => check('E1 unchanged: addsOnlyPrecision(' + s + ', ...)', NEW.addsOnlyPrecision(s, c) === true));
check('and the guards still hold', NEW.addsOnlyPrecision(0.4, 0.44) === false &&
      NEW.addsOnlyPrecision(9.48, 0.527) === false);

/* ===================================================== 7. no other table gained a rule */
eq('DERIVED_ROWS covers exactly D2, D3, D4, F7',
   Object.keys(NEW.DERIVED_ROWS).sort(), ['D2', 'D3', 'D4', 'F7']);
(function () {
  let bad = [];
  tids.forEach(t => { if (T3.indexOf(t) < 0 && NEW.DERIVED_ROWS[t]) bad.push(t); });
  eq('no other table has a derived-row rule', bad, []);
})();

console.log('CLCPA-144 Tier 3 acceptance suite');
console.log('  baseline ref : ' + BASE_REF);
console.log('  assertions   : ' + (pass + fail) + '   pass ' + pass +
            '   controls red ' + ctl + '   FAIL ' + fail);
if (fail) {
  console.log('');
  console.log('FAILURES:');
  fails.forEach(f => console.log('  X ' + (f.length > 260 ? f.slice(0, 260) + ' ...' : f)));
  process.exitCode = 1;
} else {
  console.log('  ALL PASS');
}
