/* CLCPA-291: enumerate EVERY table where a text column in a structure row is
 * marked (calculated). Derived from the data, not a list of names. */
const fs = require('fs');
const { boot } = require('c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/_kit/live_editor.js');
const { templateRows, dense } = require('c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/_kit/xlsx_read.js');
const DEV = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/';
const P = JSON.parse(fs.readFileSync(DEV + 'payload.json', 'utf8'));
const SRC = fs.readFileSync(DEV + 'app.js', 'utf8');

let hits = 0;
Object.keys(P.tables).sort().forEach(function (id) {
  const t = P.tables[id];
  const years = Object.keys(t.data || {});
  if (!years.length) return;
  const y = years[years.length - 1];
  const sch = (t.schema_by_year || {})[y];
  if (!sch) return;
  let rows;
  try { rows = templateRows(boot({ payload: P, tableId: id, year: y, src: SRC })
      .api.buildIngestWorkbook(id, y)).map(dense); } catch (e) { return; }
  /* which columns hold a number ANYWHERE in the stored data */
  const numeric = sch.map(function (_, c) {
    /* bareNumber SEMANTICS, not typeof. A percent column is stored as the
     * STRING "45%" and is still a number: judging it by typeof marked every
     * genuine computed percent column in the J family as text and would have
     * converted them to (no value), which is a far worse defect than the one
     * being fixed. */
    return (t.data[y] || []).some(function (r) {
      const v = r[c];
      if (typeof v === 'number') return true;
      if (typeof v !== 'string') return false;
      return /^-?[0-9][0-9,.]*%?$/.test(v.trim());
    });
  });
  rows.forEach(function (r, ri) {
    r.forEach(function (v, c) {
      if (String(v).trim() !== '(calculated)') return;
      if (numeric[c]) return;                    /* a real computed column */
      if (!sch[c] || String(sch[c]).trim() === '') return;  /* spacer, CLCPA-253 */
      hits++;
      console.log('  ' + id + '/' + y + '  template row ' + ri +
        '  col ' + c + '  heading ' + JSON.stringify(sch[c]) +
        '  rowlabel ' + JSON.stringify(r[0]));
    });
  });
});
console.log('');
console.log('  total (calculated) markers on a NON-NUMERIC named column: ' + hits);
