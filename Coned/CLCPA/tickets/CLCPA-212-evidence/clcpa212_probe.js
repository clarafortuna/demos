/* CLCPA-212 planning probe. READ ONLY, no app.js changes.
 *
 * Sizes each proposed fix against the 9 save-writing table-years and the 70 that
 * open dirty, by reproducing recomputeTotals' additive write with the candidate
 * guards applied. Nothing here ships; it exists to make the plan's numbers real
 * rather than estimated.
 */
const fs = require('fs');
const X = require('./app_extract.js');
const P = JSON.parse(fs.readFileSync(
  'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard/payload.json', 'utf8'));
const E = X.engineFromDisk({
  required: ['recomputeTotals', 'stripDerivedForPersist', 'getTableSchema', 'getTableBody',
             'totalRowFlags', 'columnGrandTotals', 'detectPctColumns', 'applyDerivedCols',
             'DERIVED_COLS', 'PERSIST_STRIP_TABLES'],
});

const clone = rs => rs.map(r => r.slice());
const tids = Object.keys(P.tables).sort();
const yearsOf = t => Object.keys(P.tables[t].data || {}).sort();
const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;

// candidate detector for AVERAGE columns, which do not sum either
const isAvgHeader = h => h != null &&
  /\bavg\b|\baverage\b|\bper\s+participant\b|\bmean\b/i.test(String(h));

/* Reimplements ONLY the additive-write decision, so each guard can be toggled.
 * Returns the cells the additive write would change, under the given options. */
function additiveWrites(tid, y, opts) {
  const table = P.tables[tid];
  const schema = E.getTableSchema(table, y) || [];
  const rows = E.getTableBody(table, y);
  if (!Array.isArray(rows) || !rows.length || !schema.length) return [];
  const flags = E.totalRowFlags(rows, tid, schema);
  const derived = new Set((E.DERIVED_COLS[tid] || []).map(d => d.column));
  const pct = E.detectPctColumns(schema);
  const out = [];
  let prev = -1;
  flags.forEach((isTot, idx) => {
    if (!isTot) return;
    const seg = [];
    for (let i = prev + 1; i < idx; i++) if (!flags[i]) seg.push(rows[i]);
    prev = idx;
    const above = rows.filter((r, i) => i < idx && !flags[i]);
    const src = seg.length ? seg : above;
    if (!src.length) return;
    const g = E.columnGrandTotals(src, schema.length);
    for (let c = 1; c < schema.length; c++) {
      if (derived.has(c)) continue;
      if (opts.skipPct && pct[c]) continue;
      if (opts.skipAvg && isAvgHeader(schema[c])) continue;
      if (!g.colHasNum[c]) continue;
      const stored = rows[idx][c], computed = g.colSum[c];
      if (opts.guard) {
        const tol = opts.magnitudeAware
          ? Math.max(Math.abs(computed) * 1e-3, Math.abs(computed) < 10 ? 0.011 : 1.5)
          : Math.max(1.5, Math.abs(computed) * 1e-4);
        if (num(stored) !== null && num(computed) !== null && Math.abs(stored - computed) <= tol) continue;
      }
      if (JSON.stringify(stored) !== JSON.stringify(computed)) {
        out.push({ tid, y, row: idx, col: c, header: String(schema[c]).slice(0, 40),
                   label: String(rows[idx][0]).slice(0, 40), stored, computed });
      }
    }
  });
  return out;
}

const SCENARIOS = [
  ['shipped today      (guard, flat 1.5 floor)', { guard: true }],
  ['+ skip pct columns                        ', { guard: true, skipPct: true }],
  ['+ skip pct and avg columns                ', { guard: true, skipPct: true, skipAvg: true }],
  ['+ magnitude-aware tolerance too           ', { guard: true, skipPct: true, skipAvg: true, magnitudeAware: true }],
];

console.log('=== additive-write cells that differ from stored, payload-wide ===');
const results = {};
SCENARIOS.forEach(([name, opts]) => {
  const all = [];
  tids.forEach(t => yearsOf(t).forEach(y => { all.push(...additiveWrites(t, y, opts)); }));
  const keys = [...new Set(all.map(c => c.tid + '/' + c.y))].sort();
  results[name] = all;
  console.log('  ' + name + '  ' + String(all.length).padStart(3) + ' cells in ' +
              String(keys.length).padStart(2) + ' table-years   ' + keys.join(', '));
});

console.log('');
console.log('=== what SURVIVES the full fix, cell by cell (these need a ruling) ===');
const final = results['+ magnitude-aware tolerance too           '];
if (!final.length) console.log('  NONE');
final.forEach(c => console.log('  ' + (c.tid + '/' + c.y).padEnd(10) + 'r' + String(c.row).padStart(2) +
  'c' + c.col + '  ' + c.label.padEnd(42) + c.header.padEnd(42) +
  JSON.stringify(c.stored) + ' -> ' + JSON.stringify(c.computed)));

console.log('');
console.log('=== F9/2025 specifically, both percentage columns ===');
['shipped today      (guard, flat 1.5 floor)', '+ skip pct columns                        '].forEach(k => {
  const hits = results[k].filter(c => c.tid === 'F9' && c.y === '2025');
  console.log('  ' + k.trim() + ' -> ' + (hits.length ? hits.map(c => 'r' + c.row + 'c' + c.col +
    ' ' + JSON.stringify(c.stored) + '->' + JSON.stringify(c.computed)).join(', ') : 'no write'));
});

console.log('');
console.log('=== does skipping pct columns LOSE a legitimate total anywhere? ===');
// A pct column with no derive rule whose stored total DOES equal the row sum would
// have been correctly maintained by the old behaviour. Those are the regressions to
// watch for, so enumerate them.
let legit = [];
tids.forEach(t => yearsOf(t).forEach(y => {
  const table = P.tables[t];
  const schema = E.getTableSchema(table, y) || [];
  const rows = E.getTableBody(table, y);
  if (!Array.isArray(rows) || !rows.length || !schema.length) return;
  const flags = E.totalRowFlags(rows, t, schema);
  const derived = new Set((E.DERIVED_COLS[t] || []).map(d => d.column));
  const pct = E.detectPctColumns(schema);
  flags.forEach((isTot, idx) => {
    if (!isTot) return;
    const above = rows.filter((r, i) => i < idx && !flags[i]);
    if (!above.length) return;
    const g = E.columnGrandTotals(above, schema.length);
    for (let c = 1; c < schema.length; c++) {
      if (derived.has(c) || !pct[c] || !g.colHasNum[c]) continue;
      const s = num(rows[idx][c]), comp = num(g.colSum[c]);
      if (s !== null && comp !== null && Math.abs(s - comp) < 1e-9) {
        legit.push(t + '/' + y + ' r' + idx + 'c' + c + ' (' + String(schema[c]).slice(0, 30) + ') = ' + s);
      }
    }
  });
}));
console.log('  ' + (legit.length ? legit.join('\n  ') : 'NONE -- no undrived percentage column has a total that equals its column sum,\n  so skipping them cannot lose a correct value.'));

console.log('');
console.log('=== columns an AVG detector would newly skip ===');
const avgCols = [];
tids.forEach(t => yearsOf(t).forEach(y => {
  const schema = E.getTableSchema(P.tables[t], y) || [];
  schema.forEach((h, c) => { if (c && isAvgHeader(h)) avgCols.push(t + '/' + y + ' c' + c + ' ' + String(h).slice(0, 46)); });
}));
console.log('  ' + (avgCols.length ? avgCols.join('\n  ') : 'NONE'));
