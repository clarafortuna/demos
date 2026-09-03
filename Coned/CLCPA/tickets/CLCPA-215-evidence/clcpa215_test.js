/* CLCPA-215 acceptance suite: the stored-value restoration is keyed to INPUTS.
 *
 * EXPECTATIONS ARE INDEPENDENT OF THIS CODE, and specifically they are anchored to
 * the MEASURED BEFORE TABLE that Emely reviewed:
 *
 *     D2/2024 r2c1  stored 0.323 (3dp)   first moving edit  +25
 *     D2/2024 r2c2  stored 0.34  (2dp)   first moving edit  +100
 *     D2/2024 r5c1  stored 0.37  (2dp)   first moving edit  +10
 *     D2/2024 r5c2  stored 0.354 (3dp)   first moving edit  +1
 *     D3/2024 r2c1  stored 0.331         first moving edit  +10
 *     D4/2024 r2c1  stored 0.059         first moving edit  +10
 *     F7/2024 r3c1  stored "34%"         NEVER moved, up to +10,000
 *
 * Each of those is asserted two ways: it moves on an edit of +1 NOW, and it did NOT
 * move at its old threshold-minus-one on the pinned baseline. The controls are what
 * make this suite unable to pass on a build where the gap never existed.
 */
const fs = require('fs');
const X = require('./app_extract.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos/';
const P = JSON.parse(fs.readFileSync(REPO + 'Coned/CLCPA/ExecutiveDashboard/payload.json', 'utf8'));
const BASE_REF = process.env.CLCPA215_BASE || '5ac07f4';

let pass = 0, fail = 0, ctl = 0;
const fails = [];
const check = (n, ok, d) => { if (ok) { pass++; return; } fail++; fails.push(n + (d !== undefined ? '   <- ' + d : '')); };
const control = (n, ok, d) => { if (ok) { ctl++; return; } fail++; fails.push('CONTROL GREEN, BAD: ' + n + (d !== undefined ? '   <- ' + d : '')); };
const eq = (n, got, want) => check(n, JSON.stringify(got) === JSON.stringify(want),
  'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));

const NEW = X.engineFromDisk({
  required: ['recomputeTotals', 'rowsForDisplay', 'getTableSchema', 'getTableBody',
             'stripDerivedForPersist', 'unreconciledDerivedRows', 'DERIVED_COLS'],
});
const OLD = X.engineFromRef(BASE_REF, {
  required: ['recomputeTotals', 'rowsForDisplay', 'getTableSchema', 'getTableBody',
             'stripDerivedForPersist'],
});

const clone = rs => rs.map(r => r.slice());
const tids = Object.keys(P.tables).sort();
const yearsOf = t => Object.keys(P.tables[t].data || {}).sort();
const schOf = (E, t, y) => E.getTableSchema(P.tables[t], y) || [];
const baseOf = (E, t, y) => E.getTableBody(P.tables[t], y);

/** edit one cell by delta and report the derived cell afterwards */
function afterEdit(E, t, y, editRow, editCol, delta, readRow, readCol) {
  const sch = E.getTableSchema(P.tables[t], y) || [];
  const base = E.getTableBody(P.tables[t], y);
  const d = clone(base);
  d[editRow][editCol] = Number(d[editRow][editCol]) + delta;
  E.recomputeTotals(d, sch, t, base);
  return { value: d[readRow][readCol], stored: base[readRow][readCol] };
}

/* ============================ 1. THE MEASURED TABLE, both directions
 * [table, year, pctRow, numRow, col, storedPct, oldThreshold]
 */
/* [table, year, pctRow, numRow, col, storedPct, firstMover, largestMeasuredNonMover]
 *
 * The last field is NOT firstMover-1. The probe walked a ladder
 * (1,5,10,25,50,100,...) so "first mover +25" means "moved somewhere above +10", not
 * "held at +24". My first version of these controls used threshold-minus-one and four
 * of them went green-when-they-should-be-red, because +99 does move. The control has
 * to use a delta the probe actually OBSERVED holding still. */
const MEASURED = [
  ['D2', '2024', 2, 1, 1, 0.323, 25, 10],
  ['D2', '2024', 2, 1, 2, 0.34, 100, 50],
  ['D2', '2024', 5, 4, 1, 0.37, 10, 5],
  ['D2', '2024', 5, 4, 2, 0.354, 1, 0],
  ['D3', '2024', 2, 1, 1, 0.331, 10, 1],
  ['D4', '2024', 2, 1, 1, 0.059, 10, 1],
];
MEASURED.forEach(([t, y, pctRow, numRow, col, stored, oldThresh, heldAt]) => {
  const tag = t + '/' + y + ' r' + pctRow + 'c' + col;
  check(tag + ' stored value matches the reviewed table',
        P.tables[t].data[y][pctRow][col] === stored,
        String(P.tables[t].data[y][pctRow][col]));
  // NOW: a +1 edit moves it
  const now = afterEdit(NEW, t, y, numRow, col, 1, pctRow, col);
  check(tag + ' moves on an edit of +1 (was +' + oldThresh + ')',
        now.value !== now.stored && typeof now.value === 'number',
        'stayed at ' + JSON.stringify(now.value));
  // and to the right value
  const b = baseOf(NEW, t, y);
  const denRow = pctRow - 2 === numRow - 1 ? numRow - 1 : (pctRow === 5 ? 3 : 0);
  const expect = (Number(b[numRow][col]) + 1) / Number(b[denRow][col]);
  check(tag + ' moves to the independently computed ratio',
        Math.abs(now.value - expect) < 1e-9,
        now.value + ' vs ' + expect);
  // CONTROL: on the baseline, the largest edit the probe OBSERVED holding still
  if (heldAt > 0) {
    const was = afterEdit(OLD, t, y, numRow, col, heldAt, pctRow, col);
    control(tag + ' held still on ' + BASE_REF + ' for +' + heldAt,
            JSON.stringify(was.value) === JSON.stringify(was.stored),
            'moved to ' + JSON.stringify(was.value));
  }
});

/* F7/2024, the CHAINED case, and the one whose measurement I first got wrong.
 *
 * My probe reported "never moved up to +10,000", but it was editing r2c1 -- the
 * Grand Total row itself -- which the additive write immediately overwrites, so the
 * edit was erased rather than ignored. Measured properly, editing the BODY row r0c1
 * on the baseline:
 *
 *    +1, +5, +10       the Grand Total held at 164,715 (inside the integer
 *                      tolerance) AND r3c1 held at "34%"
 *    +20 .. +1000      the Grand Total updated, but r3c1 STILL held at "34%",
 *                      because the recomputed share still rounds to 34%
 *    +10,000           r3c1 finally moved
 *
 * So +1000 is the observed non-mover, and it is a stronger control than the wrong
 * claim was: a thousand-unit edit produced no visible change before, and +1 does now.
 */
(function () {
  const now = afterEdit(NEW, 'F7', '2024', 0, 1, 1, 3, 1);
  check('F7/2024 r3c1 moves on +1 through the chained Grand Total',
        now.value !== now.stored && typeof now.value === 'number',
        'stayed at ' + JSON.stringify(now.value));
  control('F7/2024 r3c1 held still on ' + BASE_REF + ' for +1000',
          (function () {
            const was = afterEdit(OLD, 'F7', '2024', 0, 1, 1000, 3, 1);
            return JSON.stringify(was.value) === JSON.stringify(was.stored);
          })());
  control('and its Grand Total held still on ' + BASE_REF + ' for +10, so the chain was frozen at both links',
          (function () {
            const was = afterEdit(OLD, 'F7', '2024', 0, 1, 10, 2, 1);
            return JSON.stringify(was.value) === JSON.stringify(was.stored);
          })());
  check('the Grand Total itself now moves on +1',
        afterEdit(NEW, 'F7', '2024', 0, 1, 1, 2, 1).value === 164716);
  eq('F7/2024 r3c1 stored form matches the reviewed table',
     P.tables.F7.data['2024'][3][1], '34%');
})();

/* ============================ 2. the IDLE guarantees are intact
 * This is what the fix must not cost, and it is what my first version DID cost.
 */
const dirty = [], persists = [];
let n = 0;
tids.forEach(t => yearsOf(t).forEach(y => {
  const sch = schOf(NEW, t, y), base = baseOf(NEW, t, y);
  if (!Array.isArray(base) || !base.length || !sch.length) return;
  n++;
  const ref = clone(base); NEW.recomputeTotals(ref, sch, t, base);
  const draft = clone(base); NEW.recomputeTotals(draft, sch, t, base);
  if (JSON.stringify(draft) !== JSON.stringify(ref)) dirty.push(t + '/' + y);
  const a = NEW.stripDerivedForPersist(clone(draft), t, sch);
  const b = NEW.stripDerivedForPersist(clone(base), t, sch);
  if (JSON.stringify(a) !== JSON.stringify(b)) persists.push(t + '/' + y);
}));
check('all 149 table-years exercised', n === 149, String(n));
eq('every table-year still opens clean', dirty, []);
eq('a Save with no user edit still persists NOTHING', persists, []);

/* ============================ 3. E1: the pin that flipped, both halves */
(function () {
  const sch = schOf(NEW, 'E1', '2025'), base = baseOf(NEW, 'E1', '2025');
  const idle = clone(base); NEW.recomputeTotals(idle, sch, 'E1', base);
  eq('E1/2025 IDLE keeps the stored 0.45', idle[4][2], 0.45);
  const w = afterEdit(NEW, 'E1', '2025', 0, 1, Number(base[0][1]), 4, 2);   // double it
  check('E1/2025 a WEIGHT edit now moves the mean (CLCPA-215 flip)',
        w.value !== 0.45, 'stayed at ' + w.value);
  const pc = clone(base); pc[0][2] = 0.9;
  NEW.recomputeTotals(pc, sch, 'E1', base);
  check('E1/2025 a PERCENTAGE edit still moves the mean', pc[4][2] !== 0.45);
  control('on ' + BASE_REF + ' the weight edit did NOT move it', (function () {
    const os_ = OLD.getTableSchema(P.tables.E1, '2025'), ob = OLD.getTableBody(P.tables.E1, '2025');
    const d = clone(ob); d[0][1] = Number(d[0][1]) * 2;
    OLD.recomputeTotals(d, os_, 'E1', ob);
    return d[4][2] === ob[4][2];
  })());
  // the self-referential-numerator trap: wmean declares numerator [column]
  check('E1 rule still declares its own column as numerator (the trap this handles)',
        JSON.stringify(NEW.DERIVED_COLS.E1[0].numerator) === '[2]' &&
        NEW.DERIVED_COLS.E1[0].column === 2);
})();

/* ============================ 4. protection is input-conditional, not absolute */
(function () {
  const sch = schOf(NEW, 'D4', '2024'), base = baseOf(NEW, 'D4', '2024');
  eq('D4/2024 still reports its two source disagreements',
     [...NEW.unreconciledDerivedRows(base, sch, 'D4')].sort(), ['4,2', '7,2']);
  // an UNRELATED edit leaves the protected cell alone
  const u = clone(base); u[1][1] = Number(u[1][1]) + 10;
  NEW.recomputeTotals(u, sch, 'D4', base);
  eq('D4/2024 r4c2 stays 0.4 through an unrelated edit', u[4][2], 0.4);
  // an edit to ITS OWN input updates it: the operator changed this percentage
  const rel = clone(base); rel[3][2] = Number(rel[3][2]) + 10;
  NEW.recomputeTotals(rel, sch, 'D4', base);
  check('D4/2024 r4c2 DOES update when its own numerator is edited',
        rel[4][2] !== 0.4, 'stayed at ' + rel[4][2]);
  check('and to the computed ratio',
        Math.abs(rel[4][2] - (Number(base[3][2]) + 10) / Number(base[0][2])) < 1e-9);
  control('on ' + BASE_REF + ' the protection was absolute and did not update', (function () {
    const os_ = OLD.getTableSchema(P.tables.D4, '2024'), ob = OLD.getTableBody(P.tables.D4, '2024');
    const d = clone(ob); d[3][2] = Number(d[3][2]) + 10;
    OLD.recomputeTotals(d, os_, 'D4', ob);
    return d[4][2] === 0.4;
  })());
})();

/* ============================ 5. the report is STILL untouched */
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

console.log('CLCPA-215 acceptance suite');
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
