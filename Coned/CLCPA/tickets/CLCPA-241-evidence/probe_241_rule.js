/* If A9 gained a percent_change rule, what would the PUBLISHED years render?
 * Measured on a scratch copy; nothing is written to the repo. */
const fs = require('fs');
const DEV = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/';
const P = JSON.parse(fs.readFileSync(DEV + 'payload.json', 'utf8'));
let SRC = fs.readFileSync(DEV + 'app.js', 'utf8');

/* register it the way the existing rule types are registered */
const anchor = "    const gPct = [pct(2, [1], [1], 'total', 2)];";
if (SRC.split(anchor).length - 1 !== 1) { console.error('anchor'); process.exit(1); }
SRC = SRC.replace(anchor, () =>
  "    const a9chg = [pct(5, [3], [1], 'row', 0), pct(6, [4], [2], 'row', 0)];\r\n" + anchor);
const endIdx = SRC.indexOf('\r\n  })();', SRC.indexOf('const DERIVED_COLS = (function () {'));
const retIdx = SRC.lastIndexOf('return {', endIdx);
SRC = SRC.slice(0, retIdx) + SRC.slice(retIdx).replace('return {', 'return { A9: a9chg,');

const { boot } = require('c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/_kit/live_editor.js');
['2024', '2025'].forEach(function (y) {
  const now = boot({ payload: P, tableId: 'A9', year: y, src: fs.readFileSync(DEV + 'app.js', 'utf8') });
  const wth = boot({ payload: P, tableId: 'A9', year: y, src: SRC });
  const sch = now.api.getTableSchema(P.tables.A9, y);
  const a = now.api.rowsForDisplay(P.tables.A9.data[y], sch, 'A9');
  const b = wth.api.rowsForDisplay(P.tables.A9.data[y], sch, 'A9');
  console.log('=== A9/' + y);
  a.forEach(function (r, i) {
    if (JSON.stringify(r) === JSON.stringify(b[i])) return;
    console.log('   row ' + i + ' ' + JSON.stringify(r[0]));
    console.log('      now  : ' + JSON.stringify(r.slice(5)));
    console.log('      ruled: ' + JSON.stringify(b[i].slice(5)));
  });
});
