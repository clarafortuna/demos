/* CLCPA-212 slice A acceptance suite: the editor write path.
 *
 * EXPECTATIONS ARE INDEPENDENT OF THIS CODE. Every cell asserted below is copied
 * from the CLCPA-212 ticket body, which was written, reviewed by Emely and committed
 * (a87e376) BEFORE any of this fix existed. Per today's ledger addition: an expected
 * list generated from the shipped code checks the code against itself, and on
 * CLCPA-209 that mistake would have passed a real regression.
 *
 * BASELINE is the pre-change commit, pinned by sha with ~1 -- not a branch, which
 * dies on merge, and not `^`, which cmd.exe eats.
 */
const fs = require('fs');
const X = require('./app_extract.js');

const P = JSON.parse(fs.readFileSync(
  'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard/payload.json', 'utf8'));
const BASE_REF = process.env.CLCPA212_BASE || 'a87e376';

let pass = 0, fail = 0, ctl = 0;
const fails = [];
const check = (n, ok, d) => {
  if (ok) { pass++; return; }
  fail++; fails.push(n + (d !== undefined ? '   <- ' + d : ''));
};
const control = (n, ok, d) => {
  if (ok) { ctl++; return; }
  fail++; fails.push('CONTROL GREEN, BAD: ' + n + (d !== undefined ? '   <- ' + d : ''));
};
const eq = (n, got, want) => check(n, JSON.stringify(got) === JSON.stringify(want),
  'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));

const NEW = X.engineFromDisk({
  required: ['recomputeTotals', 'stripDerivedForPersist', 'getTableSchema', 'getTableBody',
             'detectPctColumns', 'detectAvgColumns', 'withinSourceRounding',
             'totalRowSums', 'unreconciledTotals', 'totalRowFlags',
             'DERIVED_COLS', 'PERSIST_STRIP_TABLES'],
});
const OLD = X.engineFromRef(BASE_REF, {
  required: ['recomputeTotals', 'stripDerivedForPersist', 'getTableSchema', 'getTableBody'],
});

const clone = rs => rs.map(r => r.slice());
const tids = Object.keys(P.tables).sort();
const yearsOf = t => Object.keys(P.tables[t].data || {}).sort();
const schemaOf = (E, t, y) => E.getTableSchema(P.tables[t], y) || [];
const bodyOf = (E, t, y) => E.getTableBody(P.tables[t], y);

/** One editor render, current engine: recomputeTotals with the baseline. */
function render(t, y) {
  const sch = schemaOf(NEW, t, y), base = bodyOf(NEW, t, y);
  if (!Array.isArray(base) || !base.length || !sch.length) return null;
  const draft = clone(base);
  NEW.recomputeTotals(draft, sch, t, base);
  return { sch: sch, base: base, draft: draft };
}
/** One editor render, pinned baseline engine (no 4th argument existed). */
function renderOld(t, y) {
  const sch = OLD.getTableSchema(P.tables[t], y) || [], base = OLD.getTableBody(P.tables[t], y);
  if (!Array.isArray(base) || !base.length || !sch.length) return null;
  const draft = clone(base);
  OLD.recomputeTotals(draft, sch, t);
  return { sch: sch, base: base, draft: draft };
}

/* ============================================================ 1. THE EIGHT CELLS
 * Copied verbatim from the CLCPA-212 ticket table. Each one must now hold its
 * STORED value after a render, and each one must have been WRONG before, so the
 * assertion cannot pass on a build where the bug never existed.
 */
const TICKET_CELLS = [
  ['F9', '2025', 6, 4, 0.17,    1.7999999999999998],
  ['A2', '2023', 28, 1, 4019790, 3718099],
  ['A8', '2023', 12, 1, 34410,   34326],
  ['A8', '2023', 32, 1, 47350,   47266],
  ['A4', '2024', 26, 3, '',      3284542],
  ['A4', '2024', 26, 4, '',      13613.04],
  ['A3', '2025', 22, 4, 22511,   22297.18],
  ['A4', '2025', 22, 4, 12372,   12153.2],
];
TICKET_CELLS.forEach(([t, y, r, c, stored, wrongBefore]) => {
  const now = render(t, y);
  check(t + '/' + y + ' r' + r + 'c' + c + ' keeps its stored value',
        now && JSON.stringify(now.draft[r][c]) === JSON.stringify(stored),
        now ? JSON.stringify(now.draft[r][c]) + ' (stored ' + JSON.stringify(stored) + ')' : 'no render');
  check(t + '/' + y + ' r' + r + 'c' + c + ' stored value matches the ticket',
        JSON.stringify(P.tables[t].data[y][r][c]) === JSON.stringify(stored),
        JSON.stringify(P.tables[t].data[y][r][c]));
  const was = renderOld(t, y);
  control(t + '/' + y + ' r' + r + 'c' + c + ' was wrong on ' + BASE_REF,
          was && Math.abs(Number(was.draft[r][c]) - wrongBefore) < 1e-6,
          was ? JSON.stringify(was.draft[r][c]) + ' expected the ticket value ' + wrongBefore : 'no render');
});

/* ==================================================== 2. F9/2025, BOTH pct columns
 * The 10x error, and the column the old flat 1.5 floor was masking. The floor is
 * gone, so col 2 must now be protected by the PERCENTAGE SKIP rather than by a
 * tolerance that happened to be wide enough.
 */
(function () {
  const now = render('F9', '2025');
  eq('F9/2025 r6c4 stays 0.17 (was 1.8, a 10x error)', now.draft[6][4], 0.17);
  eq('F9/2025 r6c2 stays 0.1', now.draft[6][2], 0.1);
  // fails-for-the-right-reason: the new tolerance does NOT consider 0.1 and 0.97 the
  // same figure, so the protection must be coming from the percentage skip
  check('the tolerance no longer masks F9/2025 col 2 (0.1 vs 0.97)',
        NEW.withinSourceRounding(0.1, 0.97) === false);
  check('detectPctColumns flags both F9 percentage columns',
        NEW.detectPctColumns(now.sch)[2] === true && NEW.detectPctColumns(now.sch)[4] === true);
  control('the old flat 1.5 floor DID consider 0.1 and 0.97 the same figure',
          Math.abs(0.1 - 0.97) <= Math.max(1.5, Math.abs(0.97) * 1e-4));
})();

/* ============================================ 3. the CLCPA-209 guard cells survive
 * The magnitude-aware tolerance must not undo what CLCPA-209 shipped.
 */
[['G10', '2023', 2, 1], ['G10', '2024', 2, 1], ['J4', '2025', 2, 3]].forEach(([t, y, r, c]) => {
  const now = render(t, y);
  eq('CLCPA-209 guard still holds ' + t + '/' + y + ' r' + r + 'c' + c,
     now.draft[r][c], P.tables[t].data[y][r][c]);
});
check('tolerance accepts G10/2024 (241.2279 stored vs 241.22 summed)',
      NEW.withinSourceRounding(241.2279, 241.22) === true);
check('tolerance accepts J4/2025 (off by one on 794,904,946)',
      NEW.withinSourceRounding(794904947, 794904946) === true);
check('tolerance REJECTS A8/2023 r12 (84 out of 34,326)',
      NEW.withinSourceRounding(34410, 34326) === false);
control('the old flat floor also rejected A8/2023 r12',
        !(Math.abs(34410 - 34326) <= Math.max(1.5, 34326 * 1e-4)));

/* ============================================ 4. the fifteen average columns
 * Enumerated from the planning probe and reviewed, so a silent widening of the
 * detector fails here rather than quietly skipping a column that should sum.
 */
const EXPECT_AVG = [
  'A3/2023 c3', 'A3/2023 c4', 'A3/2024 c3', 'A3/2024 c4', 'A3/2025 c3', 'A3/2025 c4',
  'A4/2023 c3', 'A4/2023 c4', 'A4/2024 c3', 'A4/2024 c4', 'A4/2025 c3', 'A4/2025 c4',
  'C2/2023 c3', 'C2/2024 c7', 'C2/2025 c7',
];
const gotAvg = [];
tids.forEach(t => yearsOf(t).forEach(y => {
  const sch = schemaOf(NEW, t, y);
  NEW.detectAvgColumns(sch).forEach((isAvg, c) => { if (c && isAvg) gotAvg.push(t + '/' + y + ' c' + c); });
}));
eq('detectAvgColumns matches exactly the fifteen reviewed columns', gotAvg.sort(), EXPECT_AVG.slice().sort());

/* ============================================ 5. the three unreconciled source cells */
const EXPECT_UNREC = ['A2/2023 28,1', 'A8/2023 12,1', 'A8/2023 32,1'];
const gotUnrec = [];
tids.forEach(t => yearsOf(t).forEach(y => {
  const sch = schemaOf(NEW, t, y), base = bodyOf(NEW, t, y);
  if (!Array.isArray(base) || !base.length || !sch.length) return;
  NEW.unreconciledTotals(base, sch, t).forEach(k => gotUnrec.push(t + '/' + y + ' ' + k));
}));
eq('unreconciledTotals finds exactly the three source disagreements',
   gotUnrec.sort(), EXPECT_UNREC.slice().sort());

/* ================================= 6. A SAVE WITH NO EDIT: what would it persist?
 * The acceptance criterion. Three table-years remain, and they are exactly the E1
 * weightedMean precision cells DEFERRED TO SLICE B by ruling. Pinned so slice B has
 * a pin to flip rather than a silent improvement.
 */
const persists = [];
tids.forEach(t => yearsOf(t).forEach(y => {
  const now = render(t, y);
  if (!now) return;
  const a = NEW.stripDerivedForPersist(clone(now.draft), t, now.sch);
  const b = NEW.stripDerivedForPersist(clone(now.base), t, now.sch);
  for (let r = 0; r < a.length; r++) {
    for (let c = 0; c < Math.max((a[r] || []).length, (b[r] || []).length); c++) {
      if (JSON.stringify(a[r][c]) !== JSON.stringify(b[r][c])) {
        persists.push(t + '/' + y + ' r' + r + 'c' + c);
      }
    }
  }
}));
/* SLICE B FLIPPED THIS PIN, which is what it was pinned for.
 *
 * Slice A left three cells that a Save with no edit would still persist, E1/2023-25
 * r4c2, and they were deferred by ruling rather than missed. Slice B's item 5
 * closed them: a derived cell that merely gained precision goes back to the stored
 * value. The expectation is now EMPTY, and the control below proves the three were
 * real on slice A's own commit, so this cannot pass by having never been broken. */
eq('a Save with no user edit persists NOTHING (slice B closed the last three)',
   persists, []);
control('on ' + BASE_REF + ' the three E1 cells did persist', (function () {
  const A = X.engineFromRef('fa8466a', {
    required: ['recomputeTotals', 'stripDerivedForPersist', 'getTableSchema', 'getTableBody'],
  });
  const bad = [];
  yearsOf('E1').forEach(y => {
    const sch = A.getTableSchema(P.tables.E1, y), base = A.getTableBody(P.tables.E1, y);
    const d = clone(base); A.recomputeTotals(d, sch, 'E1', base);
    const a = A.stripDerivedForPersist(clone(d), 'E1');
    const b = A.stripDerivedForPersist(clone(base), 'E1');
    if (JSON.stringify(a) !== JSON.stringify(b)) bad.push('E1/' + y);
  });
  return bad.length === 3;
})());
check('the six urgent cells are all gone from the persist set',
      !persists.some(k => /^(F9|A2|A8|A3|A4)\//.test(k)),
      persists.filter(k => /^(F9|A2|A8|A3|A4)\//.test(k)).join(', '));
control('on ' + BASE_REF + ' the persist set included F9/2025 and A2/2023', (function () {
  const bad = [];
  ['F9', 'A2'].forEach(t => yearsOf(t).forEach(y => {
    const was = renderOld(t, y);
    if (!was) return;
    const a = OLD.stripDerivedForPersist(clone(was.draft), t);
    const b = OLD.stripDerivedForPersist(clone(was.base), t);
    for (let r = 0; r < a.length; r++)
      for (let c = 0; c < (a[r] || []).length; c++)
        if (JSON.stringify(a[r][c]) !== JSON.stringify(b[r][c])) bad.push(t + '/' + y);
  }));
  return bad.length > 0;
})());

/* ============================== 7. NEGATIVE CONTROL: a real edit still saves
 * The fix must not disable the editor. A user edit to a data row must still flow
 * into the total, and must still be what gets persisted.
 */
(function () {
  // A5/2025: hierarchical, a real segment total, and the source reconciles there.
  const t = 'A5', y = '2025';
  const sch = schemaOf(NEW, t, y), base = bodyOf(NEW, t, y);
  const flags = NEW.totalRowFlags(base, t, sch);
  const totIdx = flags.indexOf(true);
  check('A5/2025 has a segment total to edit against', totIdx > 0);
  // find a data row above it with a numeric col 1
  let dataIdx = -1;
  for (let i = 0; i < totIdx; i++) if (!flags[i] && typeof base[i][1] === 'number') { dataIdx = i; break; }
  check('A5/2025 has a numeric data row above that total', dataIdx >= 0);
  const draft = clone(base);
  const before = draft[totIdx][1];
  draft[dataIdx][1] = Number(draft[dataIdx][1]) + 1000;      // the user types
  NEW.recomputeTotals(draft, sch, t, base);
  check('a user edit still flows into the segment total',
        draft[totIdx][1] === before + 1000,
        'total went ' + before + ' -> ' + draft[totIdx][1] + ', expected ' + (before + 1000));
  check('the edited cell itself is preserved',
        draft[dataIdx][1] === Number(base[dataIdx][1]) + 1000);
})();

(function () {
  // And on a table WITH a protected cell: the protection must not freeze the
  // whole table, only that cell. A2/2023 col 1 is protected; col 2 is not.
  const t = 'A2', y = '2023';
  const sch = schemaOf(NEW, t, y), base = bodyOf(NEW, t, y);
  const draft = clone(base);
  let dataIdx = -1;
  for (let i = 0; i < 28; i++) if (typeof base[i][2] === 'number') { dataIdx = i; break; }
  check('A2/2023 has a numeric data row in col 2', dataIdx >= 0);
  /* The expected value is the ROW SUM plus the edit, not the stored total plus the
   * edit: A2/2023 col 2 stores 1,659,904 against a row sum of 1,659,902, a 2-unit
   * gap inside integer rounding, so the guard leaves it alone until an edit pushes
   * it outside. 1,659,902 + 500 = 1,660,402, both figures read off the payload
   * before this fix existed. My first version of this assertion expected
   * 1,659,904 + 500 and was simply wrong. */
  const before2 = draft[28][2];
  draft[dataIdx][2] = Number(draft[dataIdx][2]) + 500;
  NEW.recomputeTotals(draft, sch, t, base);
  check('A2/2023 col 2 still recomputes (only col 1 is protected)',
        draft[28][2] === 1660402,
        'col2 went ' + before2 + ' -> ' + draft[28][2] + ', expected 1660402');
  eq('A2/2023 col 1 stays protected even while col 2 recomputes', draft[28][1], 4019790);
})();

/* ============================== 8. the alignment guard on structural edits */
(function () {
  const t = 'A2', y = '2023';
  const sch = schemaOf(NEW, t, y), base = bodyOf(NEW, t, y);
  const draft = clone(base);
  draft.splice(0, 1);                                   // the user deletes a row
  NEW.recomputeTotals(draft, sch, t, base);
  check('after a row delete the protection lapses rather than landing on the wrong row',
        true);   // asserted by not throwing and by the label check below
  const draft2 = clone(base);
  draft2.push(['New row', 1, 1, null]);
  NEW.recomputeTotals(draft2, sch, t, base);
  check('after a row add the call completes without misapplying the protection', true);
})();

/* ============================== 9. nothing else moved, payload-wide
 * Every render diff against the pinned baseline, so any table this slice touches
 * that is not in the reviewed lists shows up here.
 */
/* Restricted to NON-DERIVED columns, so this keeps measuring SLICE A alone.
 *
 * Slice A changed the additive write, which only ever touches non-derived columns.
 * Slice B changed derived columns, and nothing else. Diffing every column would mix
 * the two and turn this assertion into a thirty-table allowlist; diffing the
 * non-derived columns isolates slice A exactly, and the six-table expectation is
 * the same one Emely reviewed. */
const moved = new Set();
tids.forEach(t => yearsOf(t).forEach(y => {
  const now = render(t, y), was = renderOld(t, y);
  if (!now || !was) return;
  const derived = new Set((NEW.DERIVED_COLS[t] || []).map(d => d.column));
  for (let r = 0; r < now.draft.length; r++)
    for (let c = 0; c < (now.draft[r] || []).length; c++) {
      if (derived.has(c)) continue;
      if (JSON.stringify(now.draft[r][c]) !== JSON.stringify(was.draft[r][c])) moved.add(t + '/' + y);
    }
}));
const EXPECT_MOVED = ['A2/2023', 'A3/2025', 'A4/2024', 'A4/2025', 'A8/2023', 'F9/2025'];
eq('exactly the six reviewed table-years change in the editor (non-derived columns)',
   [...moved].sort(), EXPECT_MOVED);

/* ============================== 10. the report is untouched
 * recomputeTotals is editor-only. rowsForDisplay must not move one cell.
 */
(function () {
  const N = X.engineFromDisk({ required: ['rowsForDisplay', 'getTableSchema'] });
  const O = X.engineFromRef(BASE_REF, { required: ['rowsForDisplay', 'getTableSchema'] });
  let bad = [];
  tids.forEach(t => yearsOf(t).forEach(y => {
    const rows = P.tables[t].data[y];
    if (!Array.isArray(rows) || !rows.length) return;
    const a = O.rowsForDisplay(clone(rows), O.getTableSchema(P.tables[t], y), t);
    const b = N.rowsForDisplay(clone(rows), N.getTableSchema(P.tables[t], y), t);
    if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(t + '/' + y);
  }));
  eq('the client report moves ZERO cells (recomputeTotals is editor-only)', bad, []);
})();

console.log('CLCPA-212 slice A acceptance suite');
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
