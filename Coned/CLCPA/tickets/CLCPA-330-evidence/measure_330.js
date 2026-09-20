/* The blast radius for BOTH tickets, measured from the real predicates.
 *
 * CLCPA-325's symptom is a PERCENT value carrying a $ prefix. That happens
 * when a cell whose value is a percentage sits in a column the app treats as
 * currency, either because currency_cols names it or because
 * detectCurrencyColumns infers it.
 *
 * CLCPA-330's symptom is a NON-MONEY row carrying a $ prefix, in a table whose
 * currency declaration is per COLUMN while its rows differ in unit.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const SRC = fs.readFileSync(path.join(DEV, 'app.js'), 'utf8');

function grab(n) {
  const a = '\r\n  function ' + n + '(';
  const i = SRC.indexOf(a);
  if (i < 0) throw new Error('no ' + n);
  let j = SRC.indexOf('{', i), d = 0;
  for (let k = j; k < SRC.length; k++) {
    if (SRC[k] === '{') d++;
    else if (SRC[k] === '}') { d--; if (!d) { j = k; break; } }
  }
  return SRC.slice(i + 2, j + 1);
}
/* resolve by following ReferenceErrors rather than hand-feeding */
const WANT = ['detectCurrencyColumns', 'isPercentLiteral', 'bareNumber'];
let names = WANT.slice(), api = null;
for (let it = 0; it < 60; it++) {
  try {
    api = new Function('"use strict";\n' + names.map(grab).join('\n') +
      '\nreturn {' + WANT.map(n => n + ':' + n).join(',') + '};')();
    break;
  } catch (e) {
    const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
    if (!nm) throw e;
    names.push(nm);
  }
}
console.log('  resolved: ' + names.join(', '));
console.log('');

let pctInCurrency = [];   /* CLCPA-325's shape */
let tablesWithMixedRows = [];

Object.keys(P.tables).sort().forEach((id) => {
  const t = P.tables[id];
  Object.keys(t.data || {}).forEach((y) => {
    const rows = t.data[y] || [];
    const schema = (t.schema_by_year || {})[y] || [];
    if (!rows.length || !schema.length) return;
    let cur;
    if (Array.isArray(t.currency_cols)) {
      cur = {}; t.currency_cols.forEach(c => { cur[c] = true; });
    } else {
      let d = null;
      try { d = api.detectCurrencyColumns(rows, schema, id); } catch (e) { d = null; }
      cur = d || {};
    }
    rows.forEach((r, ri) => (r || []).forEach((v, c) => {
      if (!cur[c]) return;
      if (v == null || String(v).trim() === '') return;
      if (api.isPercentLiteral(v)) pctInCurrency.push(id + ':' + y + ' r' + ri + ' c' + c + ' = ' + JSON.stringify(v));
    }));
  });
});

console.log('  CLCPA-325  a PERCENT value sitting in a CURRENCY column:');
console.log('    occurrences in payload.json : ' + pctInCurrency.length);
pctInCurrency.slice(0, 8).forEach(h => console.log('      ' + h));

console.log('');
console.log('  CLCPA-330  A9, the table whose ROWS differ in unit while its');
console.log('             currency declaration is per COLUMN:');
const a9 = P.tables.A9;
console.log('    currency_cols : ' + JSON.stringify(a9.currency_cols) + '   (a COLUMN declaration)');
(a9.data['2025'] || []).forEach((r, i) => {
  if (i === 0) return;
  console.log('      row ' + i + '  ' + JSON.stringify(r[0]));
});
console.log('');
console.log('  Is there ANY per-row type available to derive from?');
const keys = new Set();
Object.keys(P.tables).forEach(id => Object.keys(P.tables[id]).forEach(k => keys.add(k)));
console.log('    table-definition keys, all tables : ' + Array.from(keys).sort().join(', '));
console.log('    a per-row type key                : NONE');
