const _dacRepo = () => {
  const p = require('path'), f = require('fs');
  if (process.env.DAC_REPO) return p.resolve(process.env.DAC_REPO);
  let d = __dirname;
  for (let i = 0; i < 16; i++) {
    if (f.existsSync(p.join(d, '.clcpa-root'))) {
      const two = p.resolve(d, '..', '..');
      return f.existsSync(p.join(two, '.git')) ? two : d;
    }
    const u = p.dirname(d); if (u === d) break; d = u;
  }
  throw new Error('CLCPA project root not found above ' + __dirname + '; set DAC_REPO');
};
/* Section A re-verification on the current tip.
 *
 * Every finding was recorded against b1108e5fcf, many waves back. Each is
 * re-measured here against the tip before any of them is built, because a
 * finding that has already been fixed retires with evidence and no code.
 *
 * Offline where the question is about stored shape, template output or the
 * derive engine. 287 is a rendered-surface question and is driven in Chrome
 * separately.
 */
const fs = require('fs');
const path = require('path');
const { boot } = require(_dacRepo() + '/Coned/CLCPA/tickets/_kit/live_editor.js');
const { templateRows, dense } = require(_dacRepo() + '/Coned/CLCPA/tickets/_kit/xlsx_read.js');

const DEV = _dacRepo() + '/Coned/CLCPA/ExecutiveDashboard_dev/';
const P = JSON.parse(fs.readFileSync(DEV + 'payload.json', 'utf8'));
const SRC = fs.readFileSync(DEV + 'app.js', 'utf8');

const say = (s) => console.log(s);
const hr = (t) => { say(''); say('=================================================================='); say(t); say('=================================================================='); };

const tmpl = (id, y, pay) => {
  const H = boot({ payload: pay || P, tableId: id, year: y, src: SRC });
  return templateRows(H.api.buildIngestWorkbook(id, y)).map(dense);
};
/* a user-added year: present in meta.years, holding nothing */
const freshPayload = (y) => {
  const p = JSON.parse(JSON.stringify(P));
  p.meta.years = [y].concat(p.meta.years);
  return p;
};

/* ---------------- 289: A9's % Change pair and the (calculated) marker ---- */
hr('CLCPA-289  A9 "% Change" columns are not marked (calculated)');
{
  const t9 = tmpl('A9', '2025');
  say('  A9 template row 0 : ' + JSON.stringify(t9[0]));
  say('  A9 template row 1 : ' + JSON.stringify(t9[1]));
  say('  A9 template row 2 : ' + JSON.stringify(t9[2]));
  const markers9 = t9.reduce((n, r) => n + r.filter(c => /calculated/i.test(String(c))).length, 0);
  say('  (calculated) markers in the whole A9 template : ' + markers9);
  const t10 = tmpl('A10', '2025');
  const markers10 = t10.reduce((n, r) => n + r.filter(c => /calculated/i.test(String(c))).length, 0);
  say('  A10 template row 2 : ' + JSON.stringify(t10[2]));
  say('  (calculated) markers in the whole A10 template: ' + markers10);
  /* is % Change actually derived? compare stored values against the ratio */
  const rows = P.tables.A9.data['2025'];
  say('  A9 stored rows (label, then the six values):');
  rows.slice(1, 4).forEach(r => say('    ' + JSON.stringify(r)));
}

/* ---------------- 291 / 292: the A3/A4 templates ------------------------- */
hr('CLCPA-291 / CLCPA-292  the A3 and A4 templates');
['A3', 'A4'].forEach((id) => {
  const t = tmpl(id, '2025');
  say('  ' + id + ' schema      : ' + JSON.stringify(P.tables[id].schema_by_year['2025']));
  say('  ' + id + ' template r0 : ' + JSON.stringify(t[0]));
  say('  ' + id + ' template r1 : ' + JSON.stringify(t[1]));
  say('  ' + id + ' template r2 : ' + JSON.stringify(t[2]));
  const totalRow = t.find(r => /^total$/i.test(String(r[0] || '').trim()));
  say('  ' + id + ' template TOTAL row : ' + JSON.stringify(totalRow));
  /* 292: is the key column pre-filled? */
  const col1 = t.slice(1).map(r => r[1]).filter(v => v != null && String(v).trim() !== '');
  say('  ' + id + ' column B non-blank in template : ' + col1.length + ' of ' + (t.length - 1) +
      '  ' + JSON.stringify(col1.slice(0, 3)));
});

/* ---------------- 295: the A6 / A7 first-column heading ------------------ */
hr('CLCPA-295  A6 / A7 first-column heading carries a stray "Total"');
['A5', 'A6', 'A7', 'A8'].forEach((id) => {
  const sch = P.tables[id].schema_by_year && P.tables[id].schema_by_year['2025'];
  const rows = P.tables[id].data['2025'] || [];
  const totalLabels = rows.map(r => r[0]).filter(v => /total$/i.test(String(v || '')));
  say('  ' + id + ' heading[0] : ' + JSON.stringify(sch && sch[0]));
  say('  ' + id + ' rows whose label ends in Total : ' + JSON.stringify(totalLabels.slice(0, 2)));
  if (sch && totalLabels.indexOf(sch[0]) >= 0) {
    say('    >>> the heading is CHARACTER-FOR-CHARACTER a total row label');
  }
});

/* ---------------- 296: group header vs subtotal sharing a key ------------ */
hr('CLCPA-296  a group header and its subtotal share one row key');
['A5', 'A6', 'A7', 'A8'].forEach((id) => {
  const rows = P.tables[id].data['2025'] || [];
  const seen = {};
  const collisions = [];
  rows.forEach((r, i) => {
    const k = String(r[0] == null ? '' : r[0]).trim().toLowerCase();
    if (!k) return;
    if (seen[k] !== undefined) collisions.push({ key: r[0], rows: [seen[k], i] });
    else seen[k] = i;
  });
  say('  ' + id + ' : ' + collisions.length + ' duplicate first-column keys');
  collisions.slice(0, 3).forEach(c =>
    say('      ' + JSON.stringify(c.key) + '  rows ' + JSON.stringify(c.rows)));
});

/* ---------------- 294: a computed ratio at or above 1 -------------------- */
hr('CLCPA-294  a computed "% in DACs" loses the x100 when the ratio reaches 1');
{
  /* drive the real display derivation on a table that computes a share */
  const pay = freshPayload('2094');
  pay.tables.A1.data['2094'] = [
    ['Below one', 888, 333, null],
    ['Exactly one', 333, 333, null],
    ['Above one', 333, 777, null],
    ['Far above', 0.1, 555, null],
  ];
  const H = boot({ payload: pay, tableId: 'A1', year: '2094', src: SRC });
  say('  A1 schema : ' + JSON.stringify(H.api.getTableSchema(P.tables.A1, '2025')));
  const shown = H.api.rowsForDisplay(pay.tables.A1.data['2094'],
    H.api.getTableSchema(P.tables.A1, '2025'), 'A1');
  shown.forEach(r => say('    ' + JSON.stringify(r)));
}

say('');
say('done.');
