/* CLCPA-144 Tier 3 investigation. READ ONLY.
 *
 * D2, D3, D4 and F7 are TRANSPOSED: metrics run down the rows, so a percentage is a
 * ROW derived from two other ROWS within the same column. DERIVED_COLS cannot express
 * that -- it is {column, numerator[], denominator[]} applied per row.
 *
 * This enumerates the candidate rules and compares each stored cell against what the
 * rule computes, for every table, year and column. Client-visible cells, so the
 * enumeration is the deliverable.
 */
const fs = require('fs');
const P = JSON.parse(fs.readFileSync(
  'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard/payload.json', 'utf8'));

// candidate row rules: [derivedRow, numeratorRow, denominatorRow]
const RULES = {
  D2: [[2, 1, 0], [5, 4, 3]],
  D3: [[2, 1, 0], [4, 3, 0]],
  D4: [[2, 1, 0], [4, 3, 0], [7, 6, 5], [9, 8, 5]],
};
// F7 is different: r3[c] = r2[c] / r2[lastCol]
const F7_TOTAL_ROW = 2, F7_PCT_ROW = 3;

const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
const pctString = v => typeof v === 'string' && /%/.test(v);
const parsePct = v => pctString(v) ? Number(String(v).replace(/[%,\s]/g, '')) / 100 : null;

const rows = [];
console.log('=== D2 / D3 / D4: percentage ROWS derived from two rows above ===');
Object.keys(RULES).sort().forEach(t => {
  const tb = P.tables[t];
  Object.keys(tb.data || {}).sort().forEach(y => {
    const d = tb.data[y];
    const sch = (tb.schema_by_year && tb.schema_by_year[y]) || tb.schema;
    RULES[t].forEach(([dr, nr, den]) => {
      for (let c = 1; c < sch.length; c++) {
        const stored = d[dr] ? d[dr][c] : undefined;
        const N = num(d[nr] ? d[nr][c] : null), D = num(d[den] ? d[den][c] : null);
        if (N === null || D === null || D === 0) {
          console.log('  ' + (t + '/' + y).padEnd(9) + 'r' + dr + 'c' + c +
                      '  cannot derive (numerator ' + JSON.stringify(d[nr] ? d[nr][c] : null) +
                      ', denominator ' + JSON.stringify(d[den] ? d[den][c] : null) + ')');
          continue;
        }
        const computed = N / D;
        const s = num(stored);
        const same = s !== null && Math.abs(s - computed) < 1e-9;
        const round2 = s !== null && Math.abs(s - Math.round(computed * 1000) / 1000) < 1e-9;
        rows.push({ t: t, y: y, row: dr, col: c, stored: stored, computed: computed,
                    label: String(d[dr][0]).slice(0, 52), same: same });
        console.log('  ' + (t + '/' + y).padEnd(9) + 'r' + dr + 'c' + c + '  ' +
          ('r' + nr + '/r' + den).padEnd(8) +
          'stored ' + String(stored).padEnd(22) + 'computed ' + computed.toFixed(6) +
          '   ' + (same ? 'IDENTICAL' : round2 ? 'stored is the 3dp rounding' : 'DIFFERS'));
      }
    });
  });
});

console.log('');
console.log('=== F7: r3[c] = r2[c] / r2[last]  (share of the grand total) ===');
Object.keys(P.tables.F7.data).sort().forEach(y => {
  const d = P.tables.F7.data[y];
  const sch = (P.tables.F7.schema_by_year && P.tables.F7.schema_by_year[y]) || P.tables.F7.schema;
  const last = sch.length - 1;
  const denom = num(d[F7_TOTAL_ROW][last]);
  for (let c = 1; c < sch.length; c++) {
    const stored = d[F7_PCT_ROW][c];
    const N = num(d[F7_TOTAL_ROW][c]);
    if (N === null || !denom) { console.log('  F7/' + y + ' r3c' + c + '  cannot derive'); continue; }
    const computed = N / denom;
    const s = num(stored) !== null ? num(stored) : parsePct(stored);
    const same = s !== null && Math.abs(s - computed) < 1e-9;
    const near = s !== null && Math.abs(s - computed) < 0.005;
    rows.push({ t: 'F7', y: y, row: 3, col: c, stored: stored, computed: computed,
                label: '% of Grand Total', same: same });
    console.log('  F7/' + y + '  r3c' + c + '  ' + String(N).padStart(7) + '/' + denom +
      '   stored ' + JSON.stringify(stored).padEnd(10) + ' computed ' + computed.toFixed(6) +
      '   ' + (same ? 'IDENTICAL' : near ? 'stored is the rounding (' + (s * 100).toFixed(0) + '%)' : 'DIFFERS'));
  }
});

console.log('');
console.log('=== WOULD ANY RENDERED CELL CHANGE? ===');
const changed = rows.filter(r => !r.same);
console.log('  cells where stored !== computed exactly : ' + changed.length + ' of ' + rows.length);
// what matters is the DISPLAYED value; these columns render as percentages
console.log('');
console.log('  displayed at 1 decimal of a percent (the report format for pct columns):');
let dispChanged = [];
rows.forEach(r => {
  const s = num(r.stored) !== null ? num(r.stored) : parsePct(r.stored);
  if (s === null) { dispChanged.push(r); return; }
  const a = (s * 100).toFixed(1), b = (r.computed * 100).toFixed(1);
  if (a !== b) dispChanged.push(Object.assign({}, r, { dispBefore: a, dispAfter: b }));
});
console.log('  cells whose DISPLAYED value moves: ' + dispChanged.length);
dispChanged.forEach(r => console.log('     ' + (r.t + '/' + r.y).padEnd(9) + 'r' + r.row + 'c' + r.col +
  '  ' + String(r.label).slice(0, 46).padEnd(48) +
  (r.dispBefore !== undefined ? r.dispBefore + '% -> ' + r.dispAfter + '%'
     : 'stored ' + JSON.stringify(r.stored) + ' -> ' + (r.computed * 100).toFixed(1) + '%')));

fs.writeFileSync(__dirname + '/tier3_census.json', JSON.stringify(rows, null, 2));
console.log('');
console.log('written tier3_census.json  (' + rows.length + ' candidate derived cells)');
