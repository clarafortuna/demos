/* CLCPA-216: prove report immobility by RENDERING, not by reasoning.
 *
 * Runs the shipped renderTable over the PRE-migration payload and the POST-migration
 * payload and compares the emitted HTML byte for byte, per table-year and per row.
 *
 * This is still a harness, and yesterday's lesson stands: a green here is evidence
 * about renderTable, not about the app. It is much closer than reasoning about the
 * code, and the hosted checks named in the plan are what verify the positive claims.
 */
const fs = require('fs');
const X = require('./app_extract.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos/';
const PRE = JSON.parse(fs.readFileSync(__dirname + '/c216_payload_pre.json', 'utf8'));
const POST = JSON.parse(fs.readFileSync(REPO + 'Coned/CLCPA/ExecutiveDashboard/payload.json', 'utf8'));

const E = X.engineFromDisk({ required: ['renderTable', 'cellText', 'isSplitCell', 'getTableSchema'] });

// renderTable reads state.payload for currency_cols; give it the post payload.
if (typeof global.state === 'undefined') global.state = {};
global.state.payload = POST;

const schemaOf = (P, t, y) => (P.tables[t].schema_by_year && P.tables[t].schema_by_year[y])
  || P.tables[t].schema;

/** renderTable takes header rows + body as one array, headerLevels tells it how many */
function render(P, t, y) {
  const sch = schemaOf(P, t, y);
  const body = P.tables[t].data[y];
  if (!Array.isArray(sch) || !Array.isArray(body)) return null;
  const levels = P.tables[t].header_levels !== undefined ? P.tables[t].header_levels : 1;
  const rows = levels === 2 ? [sch, sch].concat(body) : [sch].concat(body);
  return E.renderTable(rows, { headerLevels: levels, tableId: t });
}

let checked = 0, moved = [];
Object.keys(POST.tables).sort().forEach(t => {
  Object.keys(POST.tables[t].data || {}).sort().forEach(y => {
    const a = render(PRE, t, y), b = render(POST, t, y);
    if (a === null || b === null) return;
    checked++;
    if (a !== b) moved.push({ t: t, y: y, before: a, after: b });
  });
});

console.log('=== rendered HTML, PRE vs POST migration ===');
console.log('  table-years rendered and compared : ' + checked);
console.log('  table-years whose HTML DIFFERS    : ' + moved.length);
moved.forEach(m => {
  console.log('');
  console.log('  --- ' + m.t + '/' + m.y);
  // find the first differing character for a precise report
  let i = 0;
  while (i < m.before.length && i < m.after.length && m.before[i] === m.after[i]) i++;
  console.log('      first difference at char ' + i);
  console.log('      before ...' + m.before.slice(Math.max(0, i - 60), i + 60));
  console.log('      after  ...' + m.after.slice(Math.max(0, i - 60), i + 60));
});

console.log('');
console.log('=== C2 specifically: per-row verdict ===');
['2023', '2024', '2025'].forEach(y => {
  const a = render(PRE, 'C2', y), b = render(POST, 'C2', y);
  const same = a === b;
  console.log('  C2/' + y + '  ' + (same ? 'BYTE-IDENTICAL' : 'DIFFERS') +
    '   (' + a.length + ' chars before, ' + b.length + ' after)');
  // per-row: pull the <tr> blocks out and compare
  const trs = h => (h.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []);
  const ta = trs(a), tb = trs(b);
  ta.forEach((row, i) => {
    const lbl = (row.match(/<td[^>]*>([^<]*)</) || [])[1] || '(header)';
    console.log('     row ' + i + '  ' + String(lbl).padEnd(14) +
      (row === tb[i] ? 'byte-identical' : 'DIFFERS'));
  });
});

console.log('');
console.log('=== the split-cell readers, on real migrated cells ===');
const c25 = POST.tables.C2.data['2025'];
[[0, 3], [1, 3], [2, 3], [3, 3]].forEach(([r, c]) => {
  const v = c25[r][c];
  console.log('  C2/2025 r' + r + 'c' + c + '  ' + JSON.stringify(v).slice(0, 46).padEnd(48) +
    ' isSplit=' + E.isSplitCell(v) + '  text=' + JSON.stringify(E.cellText(v)));
});
const c23 = POST.tables.C2.data['2023'];
console.log('  C2/2023 r0c1  ' + JSON.stringify(c23[0][1]).slice(0, 46).padEnd(48) +
  ' isSplit=' + E.isSplitCell(c23[0][1]) + '  text=' + JSON.stringify(E.cellText(c23[0][1])));

process.exitCode = moved.length ? 1 : 0;
