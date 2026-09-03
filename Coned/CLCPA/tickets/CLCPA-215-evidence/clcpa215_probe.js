/* CLCPA-215: characterise D2/2024's propagation behaviour exactly. READ ONLY.
 *
 * Emely tested a D2/2024 edit and asked a propagation question I do not have. This
 * maps the actual behaviour across edit sizes and both columns, so whatever the
 * question is, the answer is measured rather than reasoned.
 *
 * The suspected mechanism, if the report was "it did not move": addsOnlyPrecision
 * restores the stored value when the recomputation still rounds to it at the stored
 * value's own precision AND is within 2% relative. For a stored 0.34 that band is
 * plus or minus 0.005 absolute (2 decimals) or 0.0068 relative (2%), whichever is
 * tighter -- so a small edit legitimately leaves the cell alone. Same phenomenon as
 * E1's weight edits, which is already pinned.
 */
const fs = require('fs');
const X = require('./app_extract.js');
const P = JSON.parse(fs.readFileSync(
  'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard/payload.json', 'utf8'));
const E = X.engineFromDisk({
  required: ['recomputeTotals', 'getTableSchema', 'getTableBody', 'addsOnlyPrecision',
             'storedDecimals', 'unreconciledDerivedRows', 'DERIVED_ROWS'],
});
const clone = rs => rs.map(r => r.slice());

const T = 'D2', Y = '2024';
const sch = E.getTableSchema(P.tables[T], Y);
const base = E.getTableBody(P.tables[T], Y);

console.log('=== D2/2024 as stored ===');
console.log('  schema: ' + JSON.stringify(sch));
base.forEach((r, i) => console.log('  r' + i + '  ' + JSON.stringify(r)));
console.log('');
console.log('  rules: r2 = r1/r0,  r5 = r4/r3');
console.log('  protected cells: ' +
  ([...E.unreconciledDerivedRows(base, sch, T)].join(', ') || 'NONE'));
console.log('');

/* For each column and each rule, walk the edit size up and report the first size at
 * which the percentage row actually moves. */
[[2, 1, 0], [5, 4, 3]].forEach(([pctRow, numRow, denRow]) => {
  for (let col = 1; col < sch.length; col++) {
    const stored = base[pctRow][col];
    const n0 = base[numRow][col], d0 = base[denRow][col];
    if (typeof n0 !== 'number' || typeof d0 !== 'number') continue;
    console.log('--- r' + pctRow + 'c' + col + '  "' + String(base[pctRow][0]).slice(0, 44) + '"');
    console.log('    stored ' + stored + '   = r' + numRow + '/r' + denRow +
                ' = ' + n0 + '/' + d0 + ' = ' + (n0 / d0).toFixed(6));
    console.log('    storedDecimals=' + E.storedDecimals(stored) +
                '  so the rounding band is +/-' + (0.5 / Math.pow(10, E.storedDecimals(stored))) +
                ' and the 2% cap is +/-' + (Math.abs(stored) * 0.02).toFixed(5));
    let firstMove = null;
    [1, 5, 10, 25, 50, 100, 200, 500, 1000].forEach(delta => {
      const d = clone(base);
      d[numRow][col] = n0 + delta;
      E.recomputeTotals(d, sch, T, base);
      const moved = JSON.stringify(d[pctRow][col]) !== JSON.stringify(stored);
      if (moved && firstMove === null) firstMove = delta;
      console.log('      +' + String(delta).padStart(5) + ' on r' + numRow +
        '  -> pct ' + String(d[pctRow][col]).padEnd(22) +
        (moved ? 'MOVED' : 'held at stored') +
        '   (true ratio ' + ((n0 + delta) / d0).toFixed(6) + ')');
    });
    console.log('    first edit size that moves the cell: ' +
      (firstMove === null ? 'none up to +1000' : '+' + firstMove));
    console.log('');
  }
});

console.log('=== the same question for the OTHER Tier 3 tables, one column each ===');
[['D3', '2024', 2, 1, 0], ['D4', '2024', 2, 1, 0], ['F7', '2024', 3, 2, 2]].forEach(
  ([t, y, pctRow, numRow, denRow]) => {
    const s = E.getTableSchema(P.tables[t], y), b = E.getTableBody(P.tables[t], y);
    const col = 1;
    const stored = b[pctRow][col];
    let firstMove = null;
    [1, 10, 100, 1000, 10000].forEach(delta => {
      const d = clone(b);
      if (typeof d[numRow][col] !== 'number') return;
      d[numRow][col] = d[numRow][col] + delta;
      E.recomputeTotals(d, s, t, b);
      if (JSON.stringify(d[pctRow][col]) !== JSON.stringify(stored) && firstMove === null) firstMove = delta;
    });
    console.log('  ' + (t + '/' + y).padEnd(9) + 'r' + pctRow + 'c' + col +
      '  stored ' + String(stored).padEnd(10) +
      'first moving edit: ' + (firstMove === null ? 'none up to +10000' : '+' + firstMove));
  });
