/* CLCPA-330: the unit belongs to the ROW, and the declaration says so.
 *
 * THE DEFECT. currency_cols is a statement about columns. A9's columns are
 * Total and DAC for two years, and every one of them holds money on one row and
 * MMBtu or a participant count on the next, so declaring the columns currency
 * put a $ on three of five data rows:
 *
 *     Energy Savings (MMBtu)                  $4.4M   should be 4.4M
 *     Participation                           $2.1M   should be 2.1M
 *     Average Energy Savings Per Participant  $2.09   should be 2.09
 *
 * THE FIX, per the owner's ruling. An optional currency_rows on the table
 * DEFINITION names the rows that are money; where a table declares it, money
 * requires a currency column AND a currency row. Absent, nothing changes.
 *
 * WHAT THIS SUITE HAS TO PROVE, and each is a separate section below:
 *   A  all five A9 rows render with the correct unit, on real payload data
 *   B  it would have FAILED against the old declaration -- the assertions
 *      discriminate rather than passing on anything
 *   C  values and calculations are untouched: only the $ moves
 *   D  the model is reusable by ANOTHER mixed-unit table with NO code change
 *   E  tables that do not declare currency_rows are bit-for-bit unaffected
 *   F  the matching rules, including declared-but-empty
 *
 * The renderer is EXECUTED, not pattern-matched: the shipped renderTable is
 * extracted from app.js and run, so a fix that only looks right in source
 * cannot pass.
 */
'use strict';

const _lines = [];
{ const _log = console.log; console.log = function () {
    const s = Array.prototype.join.call(arguments, ' ');
    _lines.push(s); _log.apply(console, arguments); }; }

const fs = require('fs');
const path = require('path');

function findRoot(start) {
  let d = start;
  for (;;) {
    if (fs.existsSync(path.join(d, '.clcpa-root'))) return d;
    const up = path.dirname(d);
    if (up === d) throw new Error('.clcpa-root not found above ' + start);
    d = up;
  }
}
const ROOT = findRoot(__dirname);
const APP = process.env.DAC_APP_OVERRIDE || path.join(ROOT, 'ExecutiveDashboard_dev', 'app.js');
const PAYLOAD = path.join(ROOT, 'ExecutiveDashboard_dev', 'payload.json');
const SRC = fs.readFileSync(APP, 'utf8');
const payload = JSON.parse(fs.readFileSync(PAYLOAD, 'utf8'));

/* The house extractor, with one change: the sandbox's state is supplied by the
 * caller, because this ticket is entirely about what renderTable reads OUT of
 * state.payload.tables. */
function api(src, want, seedState) {
  const EOL = src.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const L = src.split(EOL);
  const TOP = [];
  L.forEach((ln, n) => {
    const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (n) => {
    const k = TOP.findIndex(d => d.name === n);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n');
  };
  const parts = [], have = new Set();
  const add = (n) => {
    if (have.has(n)) return false;
    const f = find(n); if (!f) return false;
    have.add(n); parts.push(f); return true;
  };
  want.forEach(add);
  const make = () => new Function('__state',
    'const state=__state;' + parts.join('\n\n') +
    '\nreturn {' + want.join(',') + '};')(seedState);
  return (fn) => {
    for (let r = 0; r < 800; r++) {
      try { return fn(make()); }
      catch (e) {
        const m = /(\w+) is not defined/.exec(e.message);
        if (m && add(m[1])) continue;
        throw e;
      }
    }
    throw new Error('dependency resolution did not converge');
  };
}

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ok   ' + msg); }
  else { fail++; console.log('  FAIL ' + msg); }
}

/* Render one table definition and return the visible text of each body row,
 * keyed by its label. */
function renderRows(tableDef, rows, year) {
  const state = { payload: { tables: {} }, year: year || '2025' };
  state.payload.tables[tableDef.id] = tableDef;
  const run = api(SRC, ['renderTable'], state);
  const html = run(a => a.renderTable(rows, {
    tableId: tableDef.id,
    headerLevels: tableDef.header_levels || 1,
  }));
  const out = {};
  const body = html.split('<tbody>')[1] || html;
  body.split('<tr').slice(1).forEach(tr => {
    const cells = (tr.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [])
      .map(td => td.replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').trim());
    if (cells.length) out[cells[0]] = cells.slice(1);
  });
  return out;
}

const A9 = payload.tables.A9;
const YEAR = Object.keys(A9.data)[0];
/* THE SCHEMA ROW IS PART OF THE INPUT. resolveRows hands renderTable
 * [schema, ...rows], and A9 declares header_levels 2 -- so a suite that passes
 * the data alone has its first real row eaten as the second header level, and
 * "Incentives" simply disappears. That is what the first run of this suite
 * did. */
const A9ROWS = [A9.schema_by_year[YEAR]].concat(A9.data[YEAR]);

/* A9's five data rows, and the unit each one actually carries. This table is
 * the ticket's subject, so the expectation is written out rather than derived
 * from the declaration it is meant to check. */
const A9_EXPECT = [
  { label: 'Incentives', money: true },
  { label: 'Energy Savings (MMBtu)', money: false },
  { label: 'Participation', money: false },
  { label: 'Average Incentive per Participant', money: true },
  { label: 'Average Energy Savings Per Participant', money: false },
];

console.log('======================================================================');
console.log('  CLCPA-330 -- the unit belongs to the row');
console.log('  app.js: ' + path.basename(APP) + '   payload year: ' + YEAR);
console.log('======================================================================');

console.log('');
console.log('A. all five A9 rows render with the correct unit');
const shipped = renderRows(A9, A9ROWS, YEAR);
A9_EXPECT.forEach(({ label, money }) => {
  const cells = shipped[label];
  if (!cells) { ok(false, 'A: row present: ' + label); return; }
  /* columns 1..4 are the declared currency columns; 5 and 6 are % Change */
  const numeric = cells.slice(0, 4).filter(c => c !== '' && c !== '—');
  const withDollar = numeric.filter(c => c.indexOf('$') === 0);
  ok(numeric.length > 0, 'A: ' + label + ' has figures to check (' + numeric.length + ')');
  if (money) {
    ok(withDollar.length === numeric.length,
      'A: ' + label + ' is MONEY and every figure carries $  ' + JSON.stringify(cells.slice(0, 4)));
  } else {
    ok(withDollar.length === 0,
      'A: ' + label + ' is NOT money and no figure carries $  ' + JSON.stringify(cells.slice(0, 4)));
  }
});

console.log('');
console.log('B. the same assertions FAIL against the old declaration');
/* currency_rows removed == exactly the definition that shipped the defect. */
const oldDef = Object.assign({}, A9); delete oldDef.currency_rows;
const before = renderRows(oldDef, A9ROWS, YEAR);
const wrongBefore = A9_EXPECT.filter(({ label, money }) => {
  if (money) return false;
  const cells = (before[label] || []).slice(0, 4).filter(c => c !== '' && c !== '—');
  return cells.length > 0 && cells.every(c => c.indexOf('$') === 0);
});
ok(wrongBefore.length === 3,
  'B: without currency_rows exactly the three non-money rows are wrongly $-prefixed: ' +
  JSON.stringify(wrongBefore.map(w => w.label)));
ok(JSON.stringify(before['Energy Savings (MMBtu)']) !== JSON.stringify(shipped['Energy Savings (MMBtu)']),
  'B: and the fix actually changes that row, so section A is not passing vacuously');

console.log('');
console.log('C. values and calculations are untouched');
/* NOT a string comparison. The currency format also ABBREVIATES -- $4.4M where
 * the plain format writes 4,019,790 -- so "the same once the $ is stripped" is
 * simply false, and asserting it was this suite's own error on its first run.
 * What must hold is that the FIGURE still denotes the stored number. So each
 * rendered cell is read back to a number and compared with the datum it came
 * from, at the precision its own format implies. */
function readBack(text) {
  if (text == null) return null;
  let s = String(text).trim().replace(/^\$/, '').replace(/,/g, '');
  let mult = 1;
  if (/B$/i.test(s)) { mult = 1e9; s = s.slice(0, -1); }
  else if (/M$/i.test(s)) { mult = 1e6; s = s.slice(0, -1); }
  else if (/K$/i.test(s)) { mult = 1e3; s = s.slice(0, -1); }
  const n = parseFloat(s);
  return isNaN(n) ? null : n * mult;
}
const bodyByLabel = {};
A9.data[YEAR].forEach(r => { if (r && String(r[0] || '').trim()) bodyByLabel[String(r[0]).trim()] = r; });
A9_EXPECT.forEach(({ label }) => {
  const stored = bodyByLabel[label] || [];
  const rendered = shipped[label] || [];
  let checked = 0, agreed = 0;
  for (let c = 1; c <= 4; c++) {
    const raw = stored[c];
    if (typeof raw !== 'number') continue;
    const got = readBack(rendered[c - 1]);
    if (got == null) continue;
    checked++;
    /* the abbreviated forms round, so agreement is to the precision shown */
    const tol = Math.max(Math.abs(raw) * 0.005, 0.005);
    if (Math.abs(got - raw) <= tol) agreed++;
  }
  ok(checked > 0 && agreed === checked,
    'C: ' + label + ' -- every rendered figure still reads back to its stored value (' +
    agreed + '/' + checked + ')');
});
/* and the strongest form: the payload array itself is not mutated by rendering */
ok(JSON.stringify(payload.tables.A9.data[YEAR]) ===
   JSON.stringify(JSON.parse(fs.readFileSync(PAYLOAD, 'utf8')).tables.A9.data[YEAR]),
  'C: rendering mutated no stored row');

console.log('');
console.log('D. reusable by another mixed-unit table, with NO code change');
/* A table this project has never seen: different id, different labels,
 * different currency columns, two header levels off. Nothing about it is known
 * to app.js -- if the model needed code per table, this could not work. */
const OTHER = {
  id: 'ZZ1', section: 'Z', number: 1, short_title: 'Synthetic mixed-unit',
  header_levels: 1,
  currency_cols: [1, 2],
  currency_rows: ['Capital spend', 'Operating spend'],
};
const OTHER_ROWS = [
  ['Measure', 'Plan', 'Actual'],
  ['Capital spend', 1500000, 1425000],
  ['Operating spend', 250000, 262000],
  ['Emissions avoided (tCO2e)', 48000, 51200],
  ['Households served', 12400, 13100],
];
const other = renderRows(OTHER, OTHER_ROWS, YEAR);
ok((other['Capital spend'] || []).every(c => c.indexOf('$') === 0),
  'D: a declared money row in an unknown table is $-prefixed  ' + JSON.stringify(other['Capital spend']));
ok((other['Operating spend'] || []).every(c => c.indexOf('$') === 0),
  'D: the second declared money row too  ' + JSON.stringify(other['Operating spend']));
ok((other['Emissions avoided (tCO2e)'] || []).every(c => c.indexOf('$') < 0),
  'D: an undeclared row in a currency column is NOT money  ' + JSON.stringify(other['Emissions avoided (tCO2e)']));
ok((other['Households served'] || []).every(c => c.indexOf('$') < 0),
  'D: nor the second undeclared row  ' + JSON.stringify(other['Households served']));
ok(SRC.indexOf('ZZ1') < 0 && SRC.indexOf('Capital spend') < 0,
  'D: and app.js names neither that table nor its rows -- no code change was needed');

console.log('');
console.log('E. a table that does not declare currency_rows is unaffected');
const LEGACY = { id: 'ZZ2', section: 'Z', number: 2, short_title: 'Legacy',
  header_levels: 1, currency_cols: [1, 2] };
const legacy = renderRows(LEGACY, OTHER_ROWS, YEAR);
ok(Object.keys(legacy).every(k => (legacy[k] || []).every(c => c === '' || c === '—' || c.indexOf('$') === 0)),
  'E: every figure in a currency column is money when no rows are declared');
ok(SRC.indexOf('currency_rows') > 0,
  'E: ...and the narrowing is present in the shipped source, so E is not green by its absence');

console.log('');
console.log('F. the matching rules');
const CASE = Object.assign({}, OTHER, { currency_rows: ['  CAPITAL SPEND  '] });
const cased = renderRows(CASE, OTHER_ROWS, YEAR);
ok((cased['Capital spend'] || []).every(c => c.indexOf('$') === 0),
  'F: matching ignores case and surrounding space');
ok((cased['Operating spend'] || []).every(c => c.indexOf('$') < 0),
  'F: and a row no longer declared stops being money');
const EMPTY = Object.assign({}, OTHER, { currency_rows: [] });
const empty = renderRows(EMPTY, OTHER_ROWS, YEAR);
ok(Object.keys(empty).every(k => (empty[k] || []).every(c => c.indexOf('$') < 0)),
  'F: declared-but-empty means NO row is money -- it is not treated as absent');

console.log('');
console.log('======================================================================');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
console.log('======================================================================');

try {
  const out = process.env.DAC_OUT || path.join(__dirname, 'suite-330-output.txt');
  fs.writeFileSync(out, _lines.join('\n') + '\n');
} catch (e) { /* a read-only checkout must not fail the suite */ }

process.exit(fail ? 1 : 0);
