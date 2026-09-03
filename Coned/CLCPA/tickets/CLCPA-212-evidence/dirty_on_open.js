/* Finding 1: which tables open DIRTY with no user edits, and what a Save would write.
 *
 * The render path is:
 *     recomputeTotals(i.draft, i.schema, i.tableId);   // mutates the draft
 *     recomputeDirty();                                // diffs draft vs baseline
 *
 * i.baseline is the STORED rows (getTableBody) and i.draft starts as a clone of it,
 * so any cell recomputeTotals changes sets dirty = true with zero user input.
 *
 * What a Save PERSISTS is not the draft, it is stripDerivedForPersist(draft): for the
 * 25 tables in PERSIST_STRIP_TABLES the derived columns are nulled where the engine
 * can rebuild them. So "what would a Save write" has to be asked in the persisted
 * representation, comparing strip(draft) against strip(baseline).
 *
 * Run against BOTH the current build and the pre-CLCPA-209 baseline, so the report
 * can say whether this slice caused it, widened it, or narrowed it.
 */
const fs = require('fs');
const X = require('./app_extract.js');
const P = JSON.parse(fs.readFileSync(
  'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard/payload.json', 'utf8'));

const BASE_REF = process.env.BASE_REF || '7b9add6';
const NEW = X.engineFromDisk({
  required: ['recomputeTotals', 'stripDerivedForPersist', 'getTableSchema', 'getTableBody',
             'DERIVED_COLS', 'PERSIST_STRIP_TABLES'],
});
const OLD = X.engineFromRef(BASE_REF, {
  required: ['recomputeTotals', 'stripDerivedForPersist', 'getTableSchema', 'getTableBody'],
});

const clone = rs => rs.map(r => r.slice());
const tids = Object.keys(P.tables).sort();
const yearsOf = t => Object.keys(P.tables[t].data || {}).sort();

/** Reproduce one render for one table-year and report what it did. */
function openTable(E, tid, y, withSchemaArg) {   // withSchemaArg also => pass baseline
  const table = P.tables[tid];
  const schema = E.getTableSchema(table, y) || [];
  const baseline = E.getTableBody(table, y);
  if (!Array.isArray(baseline) || !baseline.length) return null;
  const draft = clone(baseline);
  // CLCPA-212: the current engine takes the baseline as a 4th argument; the pinned
  // pre-change one does not, and passing it there would be ignored anyway.
  if (withSchemaArg) E.recomputeTotals(draft, schema, tid, baseline);
  else E.recomputeTotals(draft, schema, tid);

  // the badge: recomputeDirty() diffs draft against baseline, cell by cell, with !==
  const dirtyCells = [];
  for (let r = 0; r < draft.length; r++) {
    const a = draft[r] || [], b = baseline[r] || [];
    for (let c = 0; c < Math.max(a.length, b.length); c++) {
      if (a[c] !== b[c]) {
        dirtyCells.push({ row: r, col: c, label: String(baseline[r] ? baseline[r][0] : '').slice(0, 44),
                          stored: b[c], recomputed: a[c] });
      }
    }
  }

  // what a Save would actually persist
  const persistNew = withSchemaArg
    ? E.stripDerivedForPersist(clone(draft), tid, schema)
    : E.stripDerivedForPersist(clone(draft), tid);
  const persistOld = withSchemaArg
    ? E.stripDerivedForPersist(clone(baseline), tid, schema)
    : E.stripDerivedForPersist(clone(baseline), tid);
  const writeCells = [];
  for (let r = 0; r < persistNew.length; r++) {
    const a = persistNew[r] || [], b = persistOld[r] || [];
    for (let c = 0; c < Math.max(a.length, b.length); c++) {
      if (JSON.stringify(a[c]) !== JSON.stringify(b[c])) {
        writeCells.push({ row: r, col: c, label: String(baseline[r] ? baseline[r][0] : '').slice(0, 44),
                          stored: b[c], wouldWrite: a[c] });
      }
    }
  }
  return { dirtyCells, writeCells, stripped: E.PERSIST_STRIP_TABLES
           ? E.PERSIST_STRIP_TABLES.has(tid) : null };
}

const rows = [];
tids.forEach(t => yearsOf(t).forEach(y => {
  const now = openTable(NEW, t, y, true);
  const was = openTable(OLD, t, y, false);
  if (!now) return;
  rows.push({ key: t + '/' + y, tid: t, y: y,
              nowDirty: now.dirtyCells.length, wasDirty: was ? was.dirtyCells.length : null,
              nowWrite: now.writeCells.length, wasWrite: was ? was.writeCells.length : null,
              dirtyCells: now.dirtyCells, writeCells: now.writeCells,
              stripped: now.stripped });
}));

const dirtyNow = rows.filter(r => r.nowDirty > 0);
const dirtyWas = rows.filter(r => r.wasDirty > 0);
const writesNow = rows.filter(r => r.nowWrite > 0);
const writesWas = rows.filter(r => r.wasWrite > 0);

console.log('=== OPENS DIRTY (badge shows, no user edits) ===');
console.log('  current build      : ' + dirtyNow.length + ' of ' + rows.length + ' table-years');
console.log('  pre-CLCPA-209 (' + BASE_REF + '): ' + dirtyWas.length + ' of ' + rows.length);
console.log('');
console.log('=== A SAVE WOULD WRITE SOMETHING DIFFERING FROM STORED ===');
console.log('  current build      : ' + writesNow.length + ' table-years');
console.log('  pre-CLCPA-209 (' + BASE_REF + '): ' + writesWas.length + ' table-years');
console.log('');

const NAMED = ['G1/2025', 'G10/2025', 'A5/2025'];
console.log('=== THE THREE TABLES REPORTED FROM THE HOSTED APP ===');
NAMED.forEach(k => {
  const r = rows.find(x => x.key === k);
  if (!r) { console.log('  ' + k + '  not found'); return; }
  console.log('  ' + k + '   stripped-on-persist=' + r.stripped +
              '   opens dirty: ' + (r.nowDirty > 0 ? 'YES (' + r.nowDirty + ' cells)' : 'no') +
              '   was: ' + (r.wasDirty > 0 ? 'YES (' + r.wasDirty + ')' : 'no'));
  r.dirtyCells.slice(0, 12).forEach(c => console.log(
    '      badge  r' + String(c.row).padStart(2) + 'c' + c.col + '  ' +
    c.label.padEnd(46) + JSON.stringify(c.stored) + '  ->  ' + JSON.stringify(c.recomputed)));
  if (!r.writeCells.length) {
    console.log('      SAVE WOULD WRITE: nothing differing from stored');
  } else {
    console.log('      SAVE WOULD WRITE ' + r.writeCells.length + ' cell(s):');
    r.writeCells.slice(0, 12).forEach(c => console.log(
      '      write  r' + String(c.row).padStart(2) + 'c' + c.col + '  ' +
      c.label.padEnd(46) + JSON.stringify(c.stored) + '  ->  ' + JSON.stringify(c.wouldWrite)));
  }
  console.log('');
});

console.log('=== EVERY table-year whose SAVE would write something (current build) ===');
if (!writesNow.length) console.log('  NONE');
writesNow.forEach(r => {
  console.log('  ' + r.key + '  (' + r.nowWrite + ' cells, stripped=' + r.stripped + ')');
  r.writeCells.slice(0, 8).forEach(c => console.log(
    '      r' + String(c.row).padStart(2) + 'c' + c.col + '  ' + c.label.padEnd(46) +
    JSON.stringify(c.stored) + '  ->  ' + JSON.stringify(c.wouldWrite)));
});

console.log('');
console.log('=== all table-years that open dirty (current build) ===');
console.log('  ' + dirtyNow.map(r => r.key + '(' + r.nowDirty + ')').join(', '));
console.log('');
console.log('=== opens dirty NOW but did NOT before ===');
const newlyDirty = rows.filter(r => r.nowDirty > 0 && r.wasDirty === 0).map(r => r.key);
console.log('  ' + (newlyDirty.length ? newlyDirty.join(', ') : 'NONE'));
console.log('=== opened dirty BEFORE but not now (fixed by this slice) ===');
const fixed = rows.filter(r => r.wasDirty > 0 && r.nowDirty === 0).map(r => r.key);
console.log('  ' + (fixed.length ? fixed.join(', ') : 'NONE'));

fs.writeFileSync(__dirname + '/dirty_on_open.json', JSON.stringify(rows, null, 2));
console.log('');
console.log('written dirty_on_open.json');
