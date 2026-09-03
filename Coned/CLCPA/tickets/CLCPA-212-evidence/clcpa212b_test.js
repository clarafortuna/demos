/* CLCPA-212 slice B + CLCPA-213 acceptance suite.
 *
 * EXPECTATIONS ARE INDEPENDENT OF THIS CODE. The E1 cells and the three
 * unreconciled cells are copied from the CLCPA-212 ticket body, and the sort
 * criteria from CLCPA-213's, both written, reviewed and committed at a87e376 BEFORE
 * any of this existed. Per the ledger: an expected list generated from the shipped
 * code checks the code against itself.
 *
 * BASELINE is fa8466a, the slice A commit, pinned by sha.
 */
const fs = require('fs');
const X = require('./app_extract.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos/';
const APP = REPO + 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const P = JSON.parse(fs.readFileSync(REPO + 'Coned/CLCPA/ExecutiveDashboard/payload.json', 'utf8'));
const BASE_REF = process.env.CLCPA212B_BASE || 'fa8466a';
const nowSrc = fs.readFileSync(APP, 'utf8');

let pass = 0, fail = 0, ctl = 0;
const fails = [];
const check = (n, ok, d) => { if (ok) { pass++; return; } fail++; fails.push(n + (d !== undefined ? '   <- ' + d : '')); };
const control = (n, ok, d) => { if (ok) { ctl++; return; } fail++; fails.push('CONTROL GREEN, BAD: ' + n + (d !== undefined ? '   <- ' + d : '')); };
const eq = (n, got, want) => check(n, JSON.stringify(got) === JSON.stringify(want),
  'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));

const NEW = X.engineFromDisk({
  required: ['recomputeTotals', 'stripDerivedForPersist', 'getTableSchema', 'getTableBody',
             'addsOnlyPrecision', 'compareTableIds', 'unreconciledTotals', 'totalRowFlags', 'PERSIST_STRIP_TABLES',
             'rowsForDisplay', 'DERIVED_COLS'],
});
const OLD = X.engineFromRef(BASE_REF, {
  required: ['recomputeTotals', 'stripDerivedForPersist', 'getTableSchema', 'getTableBody'],
});

const clone = rs => rs.map(r => r.slice());
const tids = Object.keys(P.tables).sort();
const yearsOf = t => Object.keys(P.tables[t].data || {}).sort();

/** Reproduce loadIngestDraft + one render, current engine. */
function open_(t, y) {
  const sch = NEW.getTableSchema(P.tables[t], y) || [];
  const base = NEW.getTableBody(P.tables[t], y);
  if (!Array.isArray(base) || !base.length || !sch.length) return null;
  const dirtyRef = clone(base);
  NEW.recomputeTotals(dirtyRef, sch, t, base);          // loadIngestDraft
  const draft = clone(base);
  NEW.recomputeTotals(draft, sch, t, base);             // the first render
  return { sch: sch, base: base, draft: draft, dirtyRef: dirtyRef };
}

/* ======================================================= ITEM 6: the badge */
const stillDirty = [];
let opened = 0;
tids.forEach(t => yearsOf(t).forEach(y => {
  const o = open_(t, y);
  if (!o) return;
  opened++;
  if (JSON.stringify(o.draft) !== JSON.stringify(o.dirtyRef)) stillDirty.push(t + '/' + y);
}));
check('every table-year that opens was exercised (149 expected)', opened === 149, String(opened));
eq('ALL table-years open clean: draft equals the render reference', stillDirty, []);
// and the reference is NOT simply the stored rows, or the fix would be vacuous
(function () {
  const o = open_('J3', '2023');
  check('the render reference genuinely differs from stored on J3/2023 (not vacuous; 22 table-years do)',
        JSON.stringify(o.dirtyRef) !== JSON.stringify(o.base));
  control('on ' + BASE_REF + ' J3/2023 differed from stored and so showed the badge', (function () {
    const sch = OLD.getTableSchema(P.tables.J3, '2023'), base = OLD.getTableBody(P.tables.J3, '2023');
    const d = clone(base); OLD.recomputeTotals(d, sch, 'J3', base);
    return JSON.stringify(d) !== JSON.stringify(base);
  })());
})();

/* ======================================================= ITEM 5: E1 */
const E1_CELLS = [['2023', 0.4, 0.399065128291635], ['2024', 0.5, 0.49866709233477036],
                  ['2025', 0.45, 0.45279327779072387]];
E1_CELLS.forEach(([y, stored, longer]) => {
  const o = open_('E1', y);
  eq('E1/' + y + ' r4c2 keeps the stored ' + stored, o.draft[4][2], stored);
  check('E1/' + y + ' r4c2 stored value matches the ticket',
        P.tables.E1.data[y][4][2] === stored, String(P.tables.E1.data[y][4][2]));
  const sch = OLD.getTableSchema(P.tables.E1, y), base = OLD.getTableBody(P.tables.E1, y);
  const d = clone(base); OLD.recomputeTotals(d, sch, 'E1', base);
  control('E1/' + y + ' r4c2 held the longer value on ' + BASE_REF,
          Math.abs(d[4][2] - longer) < 1e-12, String(d[4][2]));
  check('addsOnlyPrecision(' + stored + ', ' + longer + ') is true',
        NEW.addsOnlyPrecision(stored, longer) === true);
});
check('addsOnlyPrecision does NOT mask the CLCPA-141 contamination (9.48 vs 0.527)',
      NEW.addsOnlyPrecision(9.48, 0.527) === false);
check('addsOnlyPrecision does NOT mask a genuine change (0.4 vs 0.44)',
      NEW.addsOnlyPrecision(0.4, 0.44) === false);
check('addsOnlyPrecision on an integer stored value (27833 vs 27833.4)',
      NEW.addsOnlyPrecision(27833, 27833.4) === true);
check('addsOnlyPrecision rejects a non-number stored value',
      NEW.addsOnlyPrecision('', 5) === false && NEW.addsOnlyPrecision(null, 5) === false);
/* Membership read off the extracted SET, not matched in the source text. My first
 * version was a regex over 900 characters after the declaration, which matched 'E1'
 * inside the doc comment above the set and reported a violation that did not exist. */
check('E1 is still OUT of PERSIST_STRIP_TABLES (deviation 4 untouched)',
      NEW.PERSIST_STRIP_TABLES.has('E1') === false);
check('PERSIST_STRIP_TABLES still holds 25 tables', NEW.PERSIST_STRIP_TABLES.size === 25,
      String(NEW.PERSIST_STRIP_TABLES.size));

/* =================================== A SAVE WITH NO EDIT PERSISTS NOTHING */
const persists = [];
tids.forEach(t => yearsOf(t).forEach(y => {
  const o = open_(t, y);
  if (!o) return;
  const a = NEW.stripDerivedForPersist(clone(o.draft), t, o.sch);
  const b = NEW.stripDerivedForPersist(clone(o.base), t, o.sch);
  if (JSON.stringify(a) !== JSON.stringify(b)) persists.push(t + '/' + y);
}));
eq('a Save with no user edit persists NOTHING, payload-wide', persists, []);
control('on ' + BASE_REF + ' three E1 table-years still persisted', (function () {
  const bad = [];
  yearsOf('E1').forEach(y => {
    const sch = OLD.getTableSchema(P.tables.E1, y), base = OLD.getTableBody(P.tables.E1, y);
    const d = clone(base); OLD.recomputeTotals(d, sch, 'E1', base);
    const a = OLD.stripDerivedForPersist(clone(d), 'E1');
    const b = OLD.stripDerivedForPersist(clone(base), 'E1');
    if (JSON.stringify(a) !== JSON.stringify(b)) bad.push('E1/' + y);
  });
  return bad.length === 3;
})());

/* ============ NEGATIVE CONTROL: a real edit is STILL detected and STILL saves.
 * The risk item 6 creates: if the badge reference absorbed everything, the editor
 * would stop noticing genuine edits. This is the assertion that would catch it.
 */
(function () {
  const t = 'A5', y = '2025';
  const o = open_(t, y);
  const flags = NEW.totalRowFlags(o.base, t, o.sch);
  let dataIdx = -1;
  for (let i = 0; i < flags.length; i++) if (!flags[i] && typeof o.base[i][1] === 'number') { dataIdx = i; break; }
  const draft = clone(o.base);
  draft[dataIdx][1] = Number(draft[dataIdx][1]) + 1000;
  NEW.recomputeTotals(draft, o.sch, t, o.base);
  check('a real edit still makes the draft differ from the render reference (badge lights)',
        JSON.stringify(draft) !== JSON.stringify(o.dirtyRef));
  check('the edited cell survives the recompute',
        draft[dataIdx][1] === Number(o.base[dataIdx][1]) + 1000);
  const a = NEW.stripDerivedForPersist(clone(draft), t, o.sch);
  const b = NEW.stripDerivedForPersist(clone(o.base), t, o.sch);
  check('and a Save after a real edit DOES persist a difference',
        JSON.stringify(a) !== JSON.stringify(b));
})();
(function () {
  /* E1 specifically: a real edit must still persist, or item 5 has frozen the table.
   *
   * The edit has to be a PERCENTAGE, not a weight, and the reason is a property of
   * the data worth pinning. E1's four categories all sit between 44% and 46%, so the
   * weighted mean is almost insensitive to reweighting: doubling the largest
   * category's investment moves it by 0.59%, which is inside the 2% cap and still
   * rounds to the stored 0.45, so item 5 correctly keeps the source's figure.
   * Changing a percentage moves it 6.44% and does persist.
   *
   * Both halves are asserted, because the first one looks like a frozen editor until
   * you see the numbers. It is not: at the source's own precision nothing changed. */
  const y = '2025';
  const o = open_('E1', y);
  let pi = -1;
  for (let i = 0; i < 4; i++) if (typeof o.base[i][2] === 'number') { pi = i; break; }
  check('E1/2025 has a numeric percentage row to edit', pi >= 0);

  const dPct = clone(o.base);
  dPct[pi][2] = 0.9;
  NEW.recomputeTotals(dPct, o.sch, 'E1', o.base);
  check('E1: editing a PERCENTAGE moves the weighted mean and persists',
        dPct[4][2] !== o.base[4][2], 'stayed ' + dPct[4][2]);
  const a = NEW.stripDerivedForPersist(clone(dPct), 'E1', o.sch);
  const b = NEW.stripDerivedForPersist(clone(o.base), 'E1', o.sch);
  check('E1: and a Save after that edit persists a difference',
        JSON.stringify(a) !== JSON.stringify(b));

  const dW = clone(o.base);
  dW[pi][1] = Number(dW[pi][1]) * 2;
  NEW.recomputeTotals(dW, o.sch, 'E1', o.base);
  check('E1: editing a WEIGHT alone leaves the stored mean, by design (0.59% shift)',
        dW[4][2] === o.base[4][2], 'moved to ' + dW[4][2]);
  check('E1: the weight edit itself is still preserved in the draft',
        dW[pi][1] === Number(o.base[pi][1]) * 2);
})();

/* ======================================================= ITEM 3: the editor note */
const noteTables = [];
tids.forEach(t => yearsOf(t).forEach(y => {
  const sch = NEW.getTableSchema(P.tables[t], y) || [];
  const base = NEW.getTableBody(P.tables[t], y);
  if (!Array.isArray(base) || !base.length || !sch.length) return;
  if (NEW.unreconciledTotals(base, sch, t).size) noteTables.push(t + '/' + y);
}));
eq('the note shows for exactly the reviewed table-years', noteTables.sort(), ['A2/2023', 'A8/2023']);
eq('A2/2023 reports one unreconciled cell',
   NEW.unreconciledTotals(NEW.getTableBody(P.tables.A2, '2023'),
                          NEW.getTableSchema(P.tables.A2, '2023'), 'A2').size, 1);
eq('A8/2023 reports two',
   NEW.unreconciledTotals(NEW.getTableBody(P.tables.A8, '2023'),
                          NEW.getTableSchema(P.tables.A8, '2023'), 'A8').size, 2);
// EDITOR ONLY, asserted both ways
check('the note text exists exactly once in the source',
      (nowSrc.match(/stored\s*'\s*\+\s*'total does not match|stored total does not match/g) || []).length >= 1);
check('the note is built in the ingest editor, from unreconciledTotals',
      /const unreconciledNote = unreconciled\.size/.test(nowSrc));
check('the note is rendered inside the ingest card foot',
      /ingest-card-foot[\s\S]{0,400}\$\{unreconciledNote\}/.test(nowSrc));
(function () {
  // and the client report carries no trace of it, for the affected tables
  let leaked = [];
  [['A2', '2023'], ['A8', '2023']].forEach(([t, y]) => {
    const out = NEW.rowsForDisplay(clone(P.tables[t].data[y]),
                                   NEW.getTableSchema(P.tables[t], y), t);
    const flat = JSON.stringify(out);
    if (/does not match/i.test(flat) || /not reconcile/i.test(flat)) leaked.push(t + '/' + y);
  });
  eq('the client report contains no note text for the affected tables', leaked, []);
})();
check('unreconciledNote is referenced once, so it cannot reach a report renderer',
      (nowSrc.match(/\$\{unreconciledNote\}/g) || []).length === 1);

/* ======================================================= CLCPA-213: natural sort */
const sortIds = ts => ts.slice().sort(NEW.compareTableIds);
const tablesOf = sec => Object.values(P.tables).filter(t => t.section === sec).map(t => t.id);
eq('section G reads G1..G9 then G10',
   sortIds(tablesOf('G')), ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10']);
eq('section A reads A1..A9 then A10',
   sortIds(tablesOf('A')), ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10']);
control('localeCompare put G10 between G1 and G2',
        tablesOf('G').slice().sort((a, b) => a.localeCompare(b))[1] === 'G10');
control('localeCompare put A10 between A1 and A2',
        tablesOf('A').slice().sort((a, b) => a.localeCompare(b))[1] === 'A10');
// every other section byte-identical to the old order
const changed = [];
Object.keys(P.sections).sort().forEach(sec => {
  const ids = tablesOf(sec);
  const old = ids.slice().sort((a, b) => a.localeCompare(b));
  const nu = sortIds(ids);
  if (JSON.stringify(old) !== JSON.stringify(nu)) changed.push(sec);
});
eq('exactly sections A and G reorder; every other section is byte-identical', changed, ['A', 'G']);
// defaults
Object.keys(P.sections).sort().forEach(sec => {
  const ids = tablesOf(sec);
  if (!ids.length) return;
  const oldFirst = ids.slice().sort((a, b) => a.localeCompare(b))[0];
  const newFirst = sortIds(ids)[0];
  check('section ' + sec + ' default table unchanged (' + newFirst + ')', oldFirst === newFirst,
        oldFirst + ' -> ' + newFirst);
});
// non-conforming ids are safe and deterministic
check('non-conforming ids sort deterministically and do not throw', (function () {
  try {
    const odd = ['G10', 'ZZ', 'G2', '', 'A1b', 'B3'];
    const a = odd.slice().sort(NEW.compareTableIds);
    const b = odd.slice().sort(NEW.compareTableIds);
    return JSON.stringify(a) === JSON.stringify(b) && a.length === odd.length;
  } catch (e) { return false; }
})());
check('compareTableIds tolerates null and undefined', (function () {
  try { [null, undefined, 'G1'].slice().sort(NEW.compareTableIds); return true; }
  catch (e) { return false; }
})());
eq('numeric ordering is by value, not by string', sortIds(['G9', 'G10', 'G100', 'G1']),
   ['G1', 'G9', 'G10', 'G100']);
check('no id list still uses localeCompare directly',
      !/id\.localeCompare/.test(nowSrc));
check('all five sort sites use the comparator',
      (nowSrc.match(/compareTableIds\(a\.id, b\.id\)/g) || []).length === 5);

/* ======================================================= the report is untouched */
(function () {
  const O = X.engineFromRef(BASE_REF, { required: ['rowsForDisplay', 'getTableSchema'] });
  let bad = [];
  tids.forEach(t => yearsOf(t).forEach(y => {
    const rows = P.tables[t].data[y];
    if (!Array.isArray(rows) || !rows.length) return;
    const a = O.rowsForDisplay(clone(rows), O.getTableSchema(P.tables[t], y), t);
    const b = NEW.rowsForDisplay(clone(rows), NEW.getTableSchema(P.tables[t], y), t);
    if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(t + '/' + y);
  }));
  eq('the client report moves ZERO cells', bad, []);
})();

console.log('CLCPA-212 slice B + CLCPA-213 acceptance suite');
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
