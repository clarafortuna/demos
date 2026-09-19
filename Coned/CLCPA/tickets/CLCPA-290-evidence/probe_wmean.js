/* If A3's average columns were registered as weightedMean, what would the
 * PUBLISHED year render? Measured on a scratch copy; nothing is written. */
const fs = require('fs');
const DEV = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/';
const P = JSON.parse(fs.readFileSync(DEV + 'payload.json', 'utf8'));
let SRC = fs.readFileSync(DEV + 'app.js', 'utf8');

/* register the rule exactly as the E1 precedent does, on a copy in memory */
const anchor = "    const gPct = [pct(2, [1], [1], 'total', 2)];";
if (SRC.split(anchor).length - 1 !== 1) { console.error('anchor not unique'); process.exit(1); }
SRC = SRC.replace(anchor, () =>
  "    const a3avg = [wmean(3, 2, 0), wmean(4, 2, 0)];\r\n" + anchor);
const tail = "  })();";
const idx = SRC.indexOf("  const DERIVED_COLS = (function () {");
const endIdx = SRC.indexOf("\r\n  })();", idx);
const retIdx = SRC.lastIndexOf("return {", endIdx);
SRC = SRC.slice(0, retIdx) + SRC.slice(retIdx).replace("return {", "return { A3: a3avg, A4: a3avg,");

const tmp = __dirname + '/app_wmean.js';
fs.writeFileSync(tmp, SRC);
const { boot } = require('c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/_kit/live_editor.js');
['A3'].forEach(function (id) {
  const rows = P.tables[id].data['2025'];
  const sch = P.tables[id].schema_by_year['2025'];
  [['CURRENT', fs.readFileSync(DEV + 'app.js', 'utf8')], ['WITH wmean REGISTERED', SRC]]
    .forEach(function (pair) {
      try {
        const H = boot({ payload: P, tableId: id, year: '2025', src: pair[1] });
        const shown = H.api.rowsForDisplay(rows, sch, id);
        const t = shown.find(function (r) { return /^total$/i.test(String(r[0] || '').trim()); });
        console.log('  ' + id + '/2025 ' + pair[0].padEnd(22) + ' Total row: ' + JSON.stringify(t));
      } catch (e) { console.log('  ' + id + ' ' + pair[0] + ' THREW: ' + e.message); }
    });
});
try { fs.unlinkSync(tmp); } catch (e) {}
