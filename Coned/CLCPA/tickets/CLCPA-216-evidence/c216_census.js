/* CLCPA-216: the C2 shape census. READ ONLY.
 *
 * Sweeps EVERY cell of every C2 row across all three years and classifies its
 * storage form. The standing census lesson applies: sweep everything, not where
 * movement is expected. So this also sweeps the WHOLE PAYLOAD for the same packed
 * form, in case C2 is not the only table carrying it.
 */
const fs = require('fs');
const P = JSON.parse(fs.readFileSync(
  'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard/payload.json', 'utf8'));

const schemaOf = (t, y) => (P.tables[t].schema_by_year && P.tables[t].schema_by_year[y])
  || P.tables[t].schema;

/** classify one cell's storage form */
function form(v) {
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  if (v === '') return 'empty-string';
  if (typeof v === 'number') return 'number';
  if (typeof v !== 'string') return typeof v;
  if (/^-?[\d,]+(\.\d+)?\s*\(\s*-?[\d.]+\s*%\s*\)$/.test(v)) return 'PACKED count (pct)';
  if (/^-?[\d.]+\s*%$/.test(v)) return 'PERCENT-ONLY string';
  if (/^-?[\d,]+(\.\d+)?$/.test(v)) return 'numeric string';
  return 'text';
}
/** split a packed "37,988 (33%)" into its two numbers */
function unpack(v) {
  const m = /^(-?[\d,]+(?:\.\d+)?)\s*\(\s*(-?[\d.]+)\s*%\s*\)$/.exec(String(v));
  if (!m) return null;
  return { count: Number(m[1].replace(/,/g, '')), pct: Number(m[2]) / 100 };
}
const pctOnly = v => {
  const m = /^(-?[\d.]+)\s*%$/.exec(String(v));
  return m ? Number(m[1]) / 100 : null;
};

console.log('################ C2: every row, every year, every cell ################');
['2023', '2024', '2025'].forEach(y => {
  const sch = schemaOf('C2', y);
  const rows = P.tables.C2.data[y] || [];
  console.log('');
  console.log('=== C2/' + y + '   ' + sch.length + ' columns, ' + rows.length + ' rows');
  console.log('    schema: ' + JSON.stringify(sch));
  const nulls = sch.map((h, i) => h === null ? i : -1).filter(i => i >= 0);
  console.log('    null header columns: ' + (nulls.length ? '[' + nulls.join(',') + ']  <- the colspan artifact' : 'none'));
  rows.forEach((r, i) => {
    console.log('    r' + i + '  "' + r[0] + '"');
    for (let c = 1; c < Math.max(sch.length, r.length); c++) {
      const f = form(r[c]);
      if (f === 'null' || f === 'undefined') continue;          // padding, reported above
      let extra = '';
      const u = unpack(r[c]);
      if (u) extra = '   -> count ' + u.count + ', pct ' + u.pct;
      const po = pctOnly(r[c]);
      if (po !== null) extra = '   -> pct ' + po + ', COUNT ABSENT';
      console.log('         c' + c + ' [' + String(sch[c] === null ? '(null header)' : sch[c]).slice(0, 34).padEnd(36) + '] ' +
        JSON.stringify(r[c]).padEnd(18) + f.padEnd(22) + extra);
    }
  });
});

console.log('');
console.log('################ can 2023 counts be RECOVERED? ################');
(function () {
  const rows = P.tables.C2.data['2023'];
  const total = rows[2];
  console.log('  the Total row is numeric: ' + JSON.stringify(total));
  [0, 1].forEach(ri => {
    console.log('  r' + ri + ' "' + rows[ri][0] + '"');
    for (let c = 1; c <= 3; c++) {
      const p = pctOnly(rows[ri][c]);
      if (p === null) continue;
      const implied = p * Number(total[c]);
      console.log('     c' + c + '  pct ' + p + ' x total ' + total[c] +
        ' = ' + implied.toFixed(2) + '   <- DERIVED, not a source figure');
    }
  });
  // do 2023's percentages even sum to something coherent?
  console.log('');
  console.log('  do the 2023 percentages account for the whole? (2025 has an All Others row; 2023 does not)');
  for (let c = 1; c <= 3; c++) {
    const a = pctOnly(rows[0][c]), b = pctOnly(rows[1][c]);
    console.log('     c' + c + '  DAC ' + a + ' + Low-Income ' + b + ' = ' + (a + b).toFixed(4) +
      '   remainder to 1.0: ' + (1 - a - b).toFixed(4));
  }
})();

console.log('');
console.log('################ 2024/2025: do the packed pcts agree with count/total? ################');
['2024', '2025'].forEach(y => {
  const rows = P.tables.C2.data[y];
  const totalRow = rows[rows.length - 1];
  rows.slice(0, -1).forEach((r, ri) => {
    for (let c = 1; c < r.length; c++) {
      const u = unpack(r[c]);
      if (!u) continue;
      const denom = Number(totalRow[c]);
      const computed = denom ? u.count / denom : null;
      console.log('  ' + (y + ' r' + ri + 'c' + c).padEnd(14) + 'packed pct ' + u.pct +
        '   count/total = ' + (computed === null ? 'n/a' : computed.toFixed(4)) +
        (computed !== null && Math.abs(computed - u.pct) < 0.005 ? '   agrees' : '   DIFFERS'));
    }
  });
});

console.log('');
console.log('################ payload-wide: is C2 the ONLY table with packed cells? ################');
const packedElsewhere = [];
const pctOnlyElsewhere = [];
Object.keys(P.tables).sort().forEach(t => {
  Object.keys(P.tables[t].data || {}).sort().forEach(y => {
    const rows = P.tables[t].data[y];
    if (!Array.isArray(rows)) return;
    rows.forEach((r, ri) => {
      if (!Array.isArray(r)) return;
      r.forEach((v, c) => {
        const f = form(v);
        if (f === 'PACKED count (pct)') packedElsewhere.push(t + '/' + y + ' r' + ri + 'c' + c + ' ' + JSON.stringify(v));
        if (f === 'PERCENT-ONLY string') pctOnlyElsewhere.push(t + '/' + y + ' r' + ri + 'c' + c + ' ' + JSON.stringify(v));
      });
    });
  });
});
console.log('  PACKED "count (pct)" cells: ' + packedElsewhere.length);
packedElsewhere.forEach(k => console.log('     ' + k));
console.log('');
console.log('  PERCENT-ONLY string cells: ' + pctOnlyElsewhere.length);
pctOnlyElsewhere.forEach(k => console.log('     ' + k));

console.log('');
console.log('################ null-header (colspan) columns payload-wide ################');
Object.keys(P.tables).sort().forEach(t => {
  Object.keys(P.tables[t].data || {}).sort().forEach(y => {
    const sch = schemaOf(t, y);
    if (!Array.isArray(sch)) return;
    const nulls = sch.map((h, i) => h === null ? i : -1).filter(i => i > 0);
    if (nulls.length) console.log('  ' + (t + '/' + y).padEnd(10) + 'null headers at [' + nulls.join(',') + ']  of ' + sch.length);
  });
});
