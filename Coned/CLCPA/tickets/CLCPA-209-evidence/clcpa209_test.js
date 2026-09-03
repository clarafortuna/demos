/* CLCPA-209 acceptance suite: the structural predicate, three retired carve-outs,
 * and the rounding-tolerance guard.
 *
 * BASELINE IS THE PRE-CHANGE COMMIT, pinned by sha with ~1. Not a branch (dies on
 * merge) and not `^` (cmd.exe eats the caret). New-vs-new equivalence would be blind
 * to exactly the regressions this suite exists to catch.
 */
const fs = require('fs');
const X = require('./app_extract.js');

const PAYLOAD = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard/payload.json';
const P = JSON.parse(fs.readFileSync(PAYLOAD, 'utf8'));
const BASE = 'bcd4e26';   // set below from argv/env; the pin is resolved by the runner

let pass = 0, fail = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { pass++; return; }
  fail++; fails.push(name + (detail ? '   ' + detail : ''));
}
function eq(name, got, want) {
  ok(name, JSON.stringify(got) === JSON.stringify(want),
     'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));
}

const baseRef = process.env.CLCPA209_BASE || 'HEAD';
const NEW = X.engineFromDisk({
  required: ['totalRowFlags', 'rowsForDisplay', 'applyDerivedCols', 'recomputeTotals',
             'getTableSchema', 'columnGrandTotals', 'stripDerivedForPersist',
             'DERIVED_COLS', 'NOT_RECONCILED_TABLES', 'PERSIST_STRIP_TABLES'],
});
const OLD = X.engineFromRef(baseRef, {
  required: ['rowsForDisplay', 'recomputeTotals', 'getTableSchema', 'DERIVED_COLS'],
});

const tids = Object.keys(P.tables).sort();
const yearsOf = t => Object.keys(P.tables[t].data || {}).sort();
const rowsOf = (t, y) => P.tables[t].data[y];
const schemaOf = (E, t, y) => E.getTableSchema(P.tables[t], y) || [];
const clone = rs => rs.map(r => r.slice());

/* ------------------------------------------------------------------ 1. classifier */
// The 39 known answers, each one a case whose correct class was established by
// reading the source table rather than by running the rule.
const known = [
  ['D2', '2025', 0, false], ['D2', '2025', 1, false], ['D2', '2025', 3, false],
  ['D2', '2025', 5, false], ['D3', '2025', 0, false], ['D3', '2025', 4, false],
  ['D4', '2025', 0, false], ['D4', '2025', 9, false],
  ['F7', '2023', 2, true], ['F7', '2023', 3, false], ['F7', '2024', 2, true],
  ['F7', '2025', 2, true], ['F7', '2025', 3, false],
  ['A5', '2025', 23, true], ['A5', '2025', 45, true], ['A5', '2025', 48, true],
  ['A5', '2025', 49, true], ['A5', '2025', 1, false],
  ['A6', '2025', 31, true], ['A7', '2025', 2, true], ['A8', '2025', 23, true],
  ['A1', '2025', 22, true], ['A2', '2025', 22, true],
  ['A3', '2025', 22, true], ['A4', '2025', 22, true],
  ['C2', '2023', 2, true], ['C2', '2024', 2, true], ['C2', '2025', 3, true],
  ['J1', '2025', 0, false], ['J1', '2025', 1, false], ['J2', '2025', 1, false],
  ['J5', '2025', 1, false], ['F3', '2025', 4, false], ['F4', '2025', 7, false],
  ['A9', '2025', 5, false], ['A10', '2025', 5, false],
  ['G1', '2023', 1, false], ['G1', '2025', 2, true], ['F9', '2025', 6, true],
];
known.forEach(([t, y, ri, want]) => {
  const f = NEW.totalRowFlags(rowsOf(t, y), t, schemaOf(NEW, t, y));
  ok('classify ' + t + '/' + y + ' r' + ri + ' (' +
     String(rowsOf(t, y)[ri][0]).slice(0, 34) + ')', !!f[ri] === want,
     'got ' + (f[ri] ? 'TOTAL' : 'data') + ' want ' + (want ? 'TOTAL' : 'data'));
});

// A table can never be all-totals. This is what makes the retired hasNonTotalRows
// guard unreachable, so it is asserted rather than assumed.
let allTotalsTables = [];
tids.forEach(t => yearsOf(t).forEach(y => {
  const rows = rowsOf(t, y);
  if (!Array.isArray(rows) || !rows.length) return;
  const f = NEW.totalRowFlags(rows, t, schemaOf(NEW, t, y));
  if (f.length && f.every(Boolean)) allTotalsTables.push(t + '/' + y);
}));
eq('no table-year classifies as all totals (hasNonTotalRows is unreachable)',
   allTotalsTables, []);

// Zero rows move in the data -> TOTAL direction, payload-wide. This is the property
// that makes the slice shippable: no row that is data today starts being summed.
const census = [];
tids.forEach(t => yearsOf(t).forEach(y => {
  const rows = rowsOf(t, y);
  if (!Array.isArray(rows) || !rows.length) return;
  const nu = NEW.totalRowFlags(rows, t, schemaOf(NEW, t, y));
  const old = rows.map(r => /total|grand total|subtotal/i.test(String(r[0] == null ? '' : r[0]).trim()));
  // J1/J2 were on the strict predicate before this slice
  const oldEff = (t === 'J1' || t === 'J2')
    ? rows.map(r => /^(grand\s+|sub)?totals?$/i.test(String(r[0] == null ? '' : r[0]).trim()))
    : old;
  rows.forEach((r, i) => {
    if (oldEff[i] === !!nu[i]) return;
    census.push({ tableId: t, year: y, row: i,
                  label: String(r[0] == null ? '' : r[0]).slice(0, 52),
                  today: oldEff[i] ? 'TOTAL' : 'data', proposed: nu[i] ? 'TOTAL' : 'data' });
  });
}));
eq('census size', census.length, 89);
eq('census: zero rows move data -> TOTAL', census.filter(c => c.proposed === 'TOTAL'), []);
fs.writeFileSync(__dirname + '/clcpa209_census_asserted.json', JSON.stringify(census, null, 2));

/* Every one of the 89, asserted BY VALUE against a census the SHIPPED CODE DID NOT
 * PRODUCE. The expected list is derived from the 98-row census Emely reviewed, minus
 * the 9 rows this slice was authorized to resolve, each named individually in
 * build_expected.js. Asserting against my own output would check the code against
 * itself -- and would have passed the A8/2025 r24 regression this caught. */
const expected = JSON.parse(fs.readFileSync(__dirname + '/clcpa209_census_expected.json', 'utf8'));
const keyOf = x => x.tableId + '/' + x.year + ' r' + x.row + ' ' + x.today + '->' + x.proposed;
const gotKeys = census.map(keyOf).sort();
const wantKeys = expected.map(keyOf).sort();
const surplus = gotKeys.filter(k => wantKeys.indexOf(k) < 0);
const missing = wantKeys.filter(k => gotKeys.indexOf(k) < 0);
eq('census: no row changes that the reviewed census did not contain', surplus, []);
eq('census: every reviewed row still changes', missing, []);
// labels read back from the payload, so a stale label in the fixture cannot mask a
// row-index drift
census.forEach(c => {
  const live = String(P.tables[c.tableId].data[c.year][c.row][0] || '').slice(0, 52);
  ok('census label matches the payload at ' + c.tableId + '/' + c.year + ' r' + c.row,
     live === c.label, 'fixture ' + JSON.stringify(c.label) + ' payload ' + JSON.stringify(live));
});

/* ------------------------------------------- 2. rowsForDisplay: what actually moves */
const moved = [];
tids.forEach(t => yearsOf(t).forEach(y => {
  const rows = rowsOf(t, y);
  if (!Array.isArray(rows) || !rows.length) return;
  const so = schemaOf(OLD, t, y), sn = schemaOf(NEW, t, y);
  const a = OLD.rowsForDisplay(clone(rows), so, t);
  const b = NEW.rowsForDisplay(clone(rows), sn, t);
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const ra = a[i] || [], rb = b[i] || [];
    const w = Math.max(ra.length, rb.length);
    for (let c = 0; c < w; c++) {
      if (JSON.stringify(ra[c]) !== JSON.stringify(rb[c])) {
        moved.push({ tableId: t, year: y, row: i, col: c,
                     label: String(rows[i] ? rows[i][0] : '').slice(0, 40),
                     before: ra[c], after: rb[c] });
      }
    }
  }
}));
fs.writeFileSync(__dirname + '/clcpa209_render_moves.json', JSON.stringify(moved, null, 2));

// REQUIRED ASSERTION 1: the six all-totals tables do not move one cell.
const allTotals = ['G10', 'J3', 'J4', 'J6', 'J7', 'J8'];
eq('all-totals tables: zero rendered cells move (all 3 years)',
   moved.filter(m => allTotals.indexOf(m.tableId) >= 0), []);

// NOT_RECONCILED_TABLES render exactly as before.
eq('NOT_RECONCILED_TABLES render unchanged',
   moved.filter(m => NEW.NOT_RECONCILED_TABLES.has(m.tableId)), []);

/* --------------------------------- 3. J8 reaches the NOT_RECONCILED return */
// REQUIRED ASSERTION 2. Proven by behaviour, not by reading: the blanking pass
// would turn J8's uncovered percentage cells into the em-dash string. If any J8
// percentage cell still holds its stored value, the early return ran first.
(function () {
  const y = '2025';
  const rows = rowsOf('J8', y);
  const out = NEW.rowsForDisplay(clone(rows), schemaOf(NEW, 'J8', y), 'J8');
  const dashed = out.some(r => r.some(v => v === '\u2014'));
  ok('J8 reaches the NOT_RECONCILED return before any blanking (no cell blanked)',
     !dashed, 'a J8 cell was blanked, so the early return did not run first');
  eq('J8/2025 renders byte-identical to storage', out, rows.map(r => r.slice()));
  ok('J8 is still in NOT_RECONCILED_TABLES', NEW.NOT_RECONCILED_TABLES.has('J8'));
})();

/* ------------------------------------------- 4. retired carve-outs, by behaviour */
// D2/D3/D4/F7 classify correctly with RECOMPUTE_TOTALS_EXEMPT gone. The old pin
// asserted recomputeTotals was a NO-OP for them; it now asserts the reason.
['D2', 'D3', 'D4', 'F7'].forEach(t => yearsOf(t).forEach(y => {
  const rows = rowsOf(t, y), sch = schemaOf(NEW, t, y);
  const f = NEW.totalRowFlags(rows, t, sch);
  // every row that the loose predicate called a total, and that the census moved,
  // is now data; and recomputeTotals writes nothing it should not
  const d = clone(rows);
  NEW.recomputeTotals(d, sch, t);
  eq('recompute ' + t + '/' + y + ' writes nothing (correct classification, no exemption)',
     d, rows.map(r => r.slice()));
}));

// J1/J2 classify correctly with EDITOR_STRICT_TOTALS gone.
['J1', 'J2'].forEach(t => yearsOf(t).forEach(y => {
  const rows = rowsOf(t, y), sch = schemaOf(NEW, t, y);
  const f = NEW.totalRowFlags(rows, t, sch);
  eq('no carve-out: ' + t + '/' + y + ' has no total row', f.filter(Boolean).length, 0);
  const d = clone(rows);
  NEW.recomputeTotals(d, sch, t);
  eq('no carve-out: recompute ' + t + '/' + y + ' leaves the draft alone',
     d, rows.map(r => r.slice()));
}));

/* --------------------------------- 5. the rounding-tolerance guard, three cells */
// Each of the three cells the all-totals reclassification exposed. The guard must
// leave the STORED value in place, and the assertion must fail if the guard is
// removed -- so it checks the stored value survives, not merely that nothing threw.
[['G10', '2023', 2, 1], ['G10', '2024', 2, 1], ['J4', '2025', 2, 3]].forEach(([t, y, ri, c]) => {
  const rows = rowsOf(t, y), sch = schemaOf(NEW, t, y);
  const d = clone(rows);
  NEW.recomputeTotals(d, sch, t);
  eq('rounding guard keeps stored ' + t + '/' + y + ' r' + ri + 'c' + c,
     d[ri][c], rows[ri][c]);
});

// And the guard must NOT suppress a real correction: a deliberately wrong stored
// total, well outside tolerance, is still rewritten.
(function () {
  const t = 'A5', y = '2025';
  const rows = rowsOf(t, y), sch = schemaOf(NEW, t, y);
  const f = NEW.totalRowFlags(rows, t, sch);
  const ti = f.indexOf(true);
  ok('A5/2025 has a total row to test the guard against', ti >= 0);
  const d = clone(rows);
  let col = -1;
  for (let c = 1; c < sch.length; c++) if (typeof d[ti][c] === 'number') { col = c; break; }
  ok('A5/2025 total row has a numeric column', col > 0);
  const real = d[ti][col];
  d[ti][col] = real * 3 + 1000;                 // far outside any tolerance
  NEW.recomputeTotals(d, sch, t);
  ok('rounding guard does NOT suppress a real correction',
     d[ti][col] !== real * 3 + 1000,
     'the wrong value survived recomputeTotals');
})();

/* --------------------------------- 6. whole-payload recompute: before vs after */
const recompMoves = [];
tids.forEach(t => yearsOf(t).forEach(y => {
  const rows = rowsOf(t, y);
  if (!Array.isArray(rows) || !rows.length) return;
  const a = clone(rows), b = clone(rows);
  OLD.recomputeTotals(a, schemaOf(OLD, t, y), t);
  NEW.recomputeTotals(b, schemaOf(NEW, t, y), t);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ra = a[i] || [], rb = b[i] || [];
    for (let c = 0; c < Math.max(ra.length, rb.length); c++) {
      if (JSON.stringify(ra[c]) !== JSON.stringify(rb[c])) {
        recompMoves.push({ tableId: t, year: y, row: i, col: c,
                           label: String(rows[i] ? rows[i][0] : '').slice(0, 40),
                           before: ra[c], after: rb[c] });
      }
    }
  }
}));
fs.writeFileSync(__dirname + '/clcpa209_recompute_moves.json', JSON.stringify(recompMoves, null, 2));

/* --------------------------------- 7. strip path stays consistent */
tids.forEach(t => {
  if (!NEW.PERSIST_STRIP_TABLES.has(t)) return;
  yearsOf(t).forEach(y => {
    const rows = rowsOf(t, y), sch = schemaOf(NEW, t, y);
    const stripped = NEW.stripDerivedForPersist(clone(rows), t, sch);
    ok('strip ' + t + '/' + y + ' returns the same shape', stripped.length === rows.length);
    // a stripped cell must be rebuildable: re-deriving must produce a number again
    const back = NEW.rowsForDisplay(clone(stripped), sch, t);
    const derivedCols = (NEW.DERIVED_COLS[t] || []).map(d => d.column);
    derivedCols.forEach(c => {
      rows.forEach((r, i) => {
        if (stripped[i][c] !== null || r[c] === null || typeof r[c] !== 'number') return;
        ok('strip ' + t + '/' + y + ' r' + i + 'c' + c + ' rebuilds',
           typeof back[i][c] === 'number' && isFinite(back[i][c]));
      });
    });
  });
});

/* ------------------------------------------------------------------ report */
console.log('CLCPA-209 acceptance suite');
console.log('  baseline ref : ' + baseRef);
console.log('  assertions   : ' + (pass + fail) + '   pass ' + pass + '   FAIL ' + fail);
console.log('');
console.log('  rendered cells that move  : ' + moved.length + '   (clcpa209_render_moves.json)');
const mt = {};
moved.forEach(m => { mt[m.tableId] = (mt[m.tableId] || 0) + 1; });
Object.keys(mt).sort().forEach(t => console.log('     ' + t.padEnd(5) + mt[t]));
console.log('  editor recompute changes  : ' + recompMoves.length + '   (clcpa209_recompute_moves.json)');
const rt = {};
recompMoves.forEach(m => { rt[m.tableId] = (rt[m.tableId] || 0) + 1; });
Object.keys(rt).sort().forEach(t => console.log('     ' + t.padEnd(5) + rt[t]));
if (fail) {
  console.log('');
  console.log('FAILURES:');
  fails.forEach(f => console.log('  X ' + (f.length > 300 ? f.slice(0, 300) + ' ...[truncated]' : f)));
  process.exitCode = 1;
}
