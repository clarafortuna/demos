/* CLCPA-290: A3/A4's Total row computes only one of its three promised cells. */
const fs = require('fs');
const { boot } = require('c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/_kit/live_editor.js');
const DEV = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/';
const P = JSON.parse(fs.readFileSync(DEV + 'payload.json', 'utf8'));
const SRC = fs.readFileSync(DEV + 'app.js', 'utf8');
['A3','A4'].forEach(function(id){
  console.log('=== ' + id + ' schema: ' + JSON.stringify(P.tables[id].schema_by_year['2025']));
  const stored = P.tables[id].data['2025'] || [];
  const tot = stored.find(function(r){ return /^total$/i.test(String(r[0]||'').trim()); });
  console.log('  STORED 2025 Total row : ' + JSON.stringify(tot));
  /* a live-calculated year: same rows, Total row emptied so the engine must fill it */
  const pay = JSON.parse(JSON.stringify(P));
  pay.meta.years = ['2094'].concat(pay.meta.years);
  const rows = stored.map(function(r){ return r.slice(); });
  rows.forEach(function(r){ if (/^total$/i.test(String(r[0]||'').trim())) { for (let c=1;c<r.length;c++) r[c]=null; } });
  pay.tables[id].data['2094'] = rows;
  const H = boot({ payload: pay, tableId: id, year: '2094', src: SRC });
  const shown = H.api.rowsForDisplay(rows, H.api.getTableSchema(P.tables[id], '2025'), id);
  const st = shown.find(function(r){ return /^total$/i.test(String(r[0]||'').trim()); });
  console.log('  COMPUTED on 2094      : ' + JSON.stringify(st));
  /* what the columns should sum/average to, from the data rows */
  const data = rows.filter(function(r){ return !/^total$/i.test(String(r[0]||'').trim()); });
  for (let c = 2; c < 5; c++) {
    let sum = 0, n = 0;
    data.forEach(function(r){ const v = parseFloat(r[c]); if (!isNaN(v)) { sum += v; n++; } });
    console.log('    col ' + c + '  sum=' + sum.toFixed(1) + '  n=' + n);
  }
});
