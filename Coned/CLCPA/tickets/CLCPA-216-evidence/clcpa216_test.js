/* CLCPA-216 acceptance suite: C2's split-shape migration.
 *
 * EXPECTATIONS ARE INDEPENDENT OF THIS CODE. The 21 cells and their target values
 * come from the shape census in the plan Emely reviewed, restated below as literals.
 * The PRE-migration payload is read from the pinned commit, not from a file I wrote,
 * so "identical to before" is measured against the real prior state.
 *
 * NEGATIVE vs POSITIVE, per the ledger lesson. What is asserted here:
 *   NEGATIVE  the rendered HTML is byte-identical, payload-wide and per C2 row
 *   NEGATIVE  no table but C2 changed; C2's schema and metadata untouched
 *   NEGATIVE  the diff is exactly 21 lines per payload copy
 *   POSITIVE  the 21 cells carry the right count/pct/text
 *   POSITIVE  both shapes are readable, so a payload rollback still works
 * The positive BEHAVIOURAL claims -- what the screen shows, what the editor does on
 * open and save -- are named in the PR as hosted checks and are NOT claimed here.
 */
const fs = require('fs');
const { execSync } = require('child_process');
const X = require('./app_extract.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos/';
const CLIENT = 'Coned/CLCPA/ExecutiveDashboard/payload.json';
const DEV = 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json';
const BASE_REF = process.env.CLCPA216_BASE || 'be0a4d9';

const POST = JSON.parse(fs.readFileSync(REPO + CLIENT, 'utf8'));
const POST_DEV = JSON.parse(fs.readFileSync(REPO + DEV, 'utf8'));
const PRE = JSON.parse(execSync('git -C "' + REPO + '" show ' + BASE_REF + ':' + CLIENT,
  { encoding: 'utf8', maxBuffer: 1 << 28 }));

let pass = 0, fail = 0, ctl = 0;
const fails = [];
const check = (n, ok, d) => { if (ok) { pass++; return; } fail++; fails.push(n + (d !== undefined ? '   <- ' + d : '')); };
const control = (n, ok, d) => { if (ok) { ctl++; return; } fail++; fails.push('CONTROL GREEN, BAD: ' + n + (d !== undefined ? '   <- ' + d : '')); };
const eq = (n, got, want) => check(n, JSON.stringify(got) === JSON.stringify(want),
  'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));

const E = X.engineFromDisk({
  required: ['renderTable', 'isSplitCell', 'cellText', 'cellCount', 'cellPct',
             'rawNum', 'getTableSchema', 'recomputeTotals', 'totalRowFlags',
             'getTableBody', 'stripDerivedForPersist'],
});
if (typeof global.state === 'undefined') global.state = {};
global.state.payload = POST;

const clone = rs => rs.map(r => r.slice());
const schemaOf = (P, t, y) => (P.tables[t].schema_by_year && P.tables[t].schema_by_year[y])
  || P.tables[t].schema;

/* ===================================================== 1. THE 21 CELLS, by value
 * Restated from the reviewed census: [year, row, col, count, pct, text]
 */
const CELLS = [
  ['2023', 0, 1, null, 0.31, '31%'], ['2023', 0, 2, null, 0.32, '32%'],
  ['2023', 0, 3, null, 0.34, '34%'], ['2023', 1, 1, null, 0.09, '9%'],
  ['2023', 1, 2, null, 0.01, '1%'], ['2023', 1, 3, null, 0.01, '1%'],
  ['2024', 0, 3, 32919, 0.32, '32,919 (32%)'], ['2024', 0, 5, 404.87, 0.41, '404.87 (41%)'],
  ['2024', 0, 7, 303.07, 0.40, '303.07 (40%)'], ['2024', 1, 3, 8929, 0.09, '8,929 (9%)'],
  ['2024', 1, 5, 5.26, 0.01, '5.26 (1%)'], ['2024', 1, 7, 3.33, 0, '3.33 (0%)'],
  ['2025', 0, 3, 37988, 0.33, '37,988 (33%)'], ['2025', 0, 5, 389.65, 0.41, '389.65 (41%)'],
  ['2025', 0, 7, 299.57, 0.41, '299.57 (41%)'], ['2025', 1, 3, 9492, 0.08, '9,492 (8%)'],
  ['2025', 1, 5, 6.84, 0.01, '6.84 (1%)'], ['2025', 1, 7, 2.82, 0, '2.82 (0%)'],
  ['2025', 2, 3, 69101, 0.59, '69,101 (59%)'], ['2025', 2, 5, 558.57, 0.58, '558.57 (58%)'],
  ['2025', 2, 7, 434.34, 0.58, '434.34 (58%)'],
];
check('the census has 21 cells', CELLS.length === 21, String(CELLS.length));
CELLS.forEach(([y, r, c, count, pct, text]) => {
  const tag = 'C2/' + y + ' r' + r + 'c' + c;
  const v = POST.tables.C2.data[y][r][c];
  check(tag + ' is a split cell', E.isSplitCell(v), JSON.stringify(v));
  eq(tag + ' count', E.cellCount(v), count);
  check(tag + ' pct', Math.abs(E.cellPct(v) - pct) < 1e-12, String(E.cellPct(v)));
  eq(tag + ' text', E.cellText(v), text);
  // the text must be EXACTLY what the pre-migration cell held
  eq(tag + ' text equals the pre-migration value', E.cellText(v), PRE.tables.C2.data[y][r][c]);
  // and the same cell in the _dev copy must match
  eq(tag + ' identical in the _dev copy', POST_DEV.tables.C2.data[y][r][c], v);
});
control('the PRE payload really held packed strings (this is not a no-op)',
        typeof PRE.tables.C2.data['2025'][0][3] === 'string' &&
        PRE.tables.C2.data['2025'][0][3] === '37,988 (33%)');
control('and PRE 2023 really held bare percentages',
        PRE.tables.C2.data['2023'][0][1] === '31%');

/* 2023's counts are null BECAUSE they never existed. Asserted as a property of the
 * ruling, and the rejected alternative pinned so nobody reintroduces it. */
['2023'].forEach(y => {
  [0, 1].forEach(r => {
    for (let c = 1; c <= 3; c++) {
      const v = POST.tables.C2.data[y][r][c];
      eq('C2/' + y + ' r' + r + 'c' + c + ' count is explicitly null', E.cellCount(v), null);
    }
  });
});
check('no 2023 count was back-computed from pct x total',
      [0, 1].every(r => [1, 2, 3].every(c => {
        const v = POST.tables.C2.data['2023'][r][c];
        const total = POST.tables.C2.data['2023'][2][c];
        const derived = E.cellPct(v) * Number(total);
        return E.cellCount(v) === null && derived > 0;   // derivable, deliberately not stored
      })));
control('back-computing 2023 would not even match the KPI it explains',
        Math.abs(0.31 * 93187 - 28967) > 50 &&
        POST.kpis.reported.find(k => k.id === 'dr_participation').values['2023'].dac === 28967);

/* ===================================================== 2. REPORT IMMOBILITY */
function render(P, t, y) {
  const sch = schemaOf(P, t, y);
  const body = P.tables[t].data[y];
  if (!Array.isArray(sch) || !Array.isArray(body)) return null;
  const levels = P.tables[t].header_levels !== undefined ? P.tables[t].header_levels : 1;
  const rows = levels === 2 ? [sch, sch].concat(body) : [sch].concat(body);
  return E.renderTable(rows, { headerLevels: levels, tableId: t });
}
const movedTY = [];
let rendered = 0;
Object.keys(POST.tables).sort().forEach(t => {
  Object.keys(POST.tables[t].data || {}).sort().forEach(y => {
    const a = render(PRE, t, y), b = render(POST, t, y);
    if (a === null || b === null) return;
    rendered++;
    if (a !== b) movedTY.push(t + '/' + y);
  });
});
check('149 table-years rendered and compared', rendered === 149, String(rendered));
eq('the rendered report is BYTE-IDENTICAL, payload-wide', movedTY, []);
// per C2 row, which is what Emely asked to see stated per row
['2023', '2024', '2025'].forEach(y => {
  const a = render(PRE, 'C2', y), b = render(POST, 'C2', y);
  eq('C2/' + y + ' rendered HTML byte-identical', a === b, true);
  const trs = h => (h.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []);
  const ta = trs(a), tb = trs(b);
  check('C2/' + y + ' has the same row count', ta.length === tb.length,
        ta.length + ' vs ' + tb.length);
  ta.forEach((row, i) => {
    eq('C2/' + y + ' row ' + i + ' byte-identical', row === tb[i], true);
  });
});

/* ===================================================== 3. SCOPE of the data change */
(function () {
  const drifted = Object.keys(PRE.tables).filter(t =>
    JSON.stringify(PRE.tables[t]) !== JSON.stringify(POST.tables[t]));
  eq('exactly one table changed, and it is C2', drifted, ['C2']);
  check('C2 schema_by_year untouched',
        JSON.stringify(PRE.tables.C2.schema_by_year) === JSON.stringify(POST.tables.C2.schema_by_year));
  check('C2 metadata untouched apart from data',
        JSON.stringify(Object.assign({}, PRE.tables.C2, { data: 0 })) ===
        JSON.stringify(Object.assign({}, POST.tables.C2, { data: 0 })));
  ['kpis', 'sections', 'meta', 'charts'].forEach(k => {
    if (PRE[k] === undefined) return;
    check('top-level "' + k + '" untouched', JSON.stringify(PRE[k]) === JSON.stringify(POST[k]));
  });
  /* C2's year key ORDER must survive in the FILE, and this has to read the TEXT.
   *
   * My first version compared Object.keys(POST...) against Object.keys(PRE...) and
   * passed trivially: JavaScript reorders INTEGER-LIKE keys on parse, so both are
   * ["2023","2024","2025"] in memory no matter what the file says. The assertion
   * could not fail. That reordering is exactly the trap that made my first migration
   * attempt rewrite 3,789 lines, so the one thing worth asserting was the one thing
   * the parsed object cannot show. */
  const yearOrderInFile = (text) => {
    const c2 = text.indexOf('"C2": {');
    const dataKey = text.indexOf('"data": {', c2);
    let i = text.indexOf('{', dataKey), depth = 0, end = -1;
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    return (text.slice(dataKey, end).match(/"(\d{4})":\s*\[/g) || [])
      .map(m => m.replace(/[^\d]/g, ''));
  };
  const preText = execSync('git -C "' + REPO + '" show ' + BASE_REF + ':' + CLIENT,
    { encoding: 'utf8', maxBuffer: 1 << 28 });
  const postText = fs.readFileSync(REPO + CLIENT, 'utf8');
  eq('C2 year order in the FILE is unchanged',
     yearOrderInFile(postText), yearOrderInFile(preText));
  eq('and that order is the source order, not ascending',
     yearOrderInFile(postText), ['2024', '2023', '2025']);
  control('the PARSED object shows ascending order, which is why the file had to be read',
          JSON.stringify(Object.keys(POST.tables.C2.data)) === '["2023","2024","2025"]');
})();
(function () {
  const stat = execSync('git -C "' + REPO + '" diff --numstat ' + BASE_REF +
    ' -- ' + CLIENT + ' ' + DEV, { encoding: 'utf8' }).trim().split(/\r?\n/);
  const parsed = stat.map(l => l.split('\t'));
  check('the payload diff is exactly 21 added and 21 removed lines per copy',
        parsed.length === 2 && parsed.every(p => p[0] === '21' && p[1] === '21'),
        JSON.stringify(parsed));
  /* The reorder trap, demonstrated rather than asserted from memory: re-serialising
   * the parsed payload moves every table's years into ascending order, so the diff
   * is thousands of lines with zero semantic change. Measured here on C2 alone. */
  control('parse-and-restringify WOULD reorder C2 years (the trap that cost the first attempt)',
          JSON.stringify(JSON.parse(JSON.stringify(PRE)).tables.C2.data
            ? Object.keys(JSON.parse(JSON.stringify(PRE)).tables.C2.data) : []) !==
          JSON.stringify(['2024', '2023', '2025']));
})();

/* ===================================================== 4. ROLLBACK: both shapes read */
(function () {
  // the OLD shape must still render and read, or a payload rollback needs a code
  // rollback too, which is not a rollback
  const a = render(PRE, 'C2', '2025');
  check('the packed-string shape still renders', typeof a === 'string' && a.indexOf('37,988 (33%)') > 0);
  check('cellText passes a plain string through', E.cellText('37,988 (33%)') === '37,988 (33%)');
  check('cellText passes a number through', E.cellText(116581) === 116581);
  check('cellCount reads a plain number', E.cellCount(116581) === 116581);
  check('cellPct is null for a non-split cell', E.cellPct('37,988 (33%)') === null);
  check('isSplitCell rejects a plain object without pct/text', E.isSplitCell({ a: 1 }) === false);
  check('isSplitCell rejects null and arrays',
        E.isSplitCell(null) === false && E.isSplitCell([1, 2]) === false);
  check('rawNum shows the published text for a split cell',
        E.rawNum(POST.tables.C2.data['2025'][0][3]) === '37,988 (33%)');
})();

/* ===================================================== 5. the ENGINE is unmoved
 * A split cell is non-numeric, exactly as the packed string was, so nothing
 * downstream changes -- including C2/2024's Total row keeping its classification.
 */
(function () {
  ['2023', '2024', '2025'].forEach(y => {
    const schPre = schemaOf(PRE, 'C2', y), schPost = schemaOf(POST, 'C2', y);
    const fPre = E.totalRowFlags(PRE.tables.C2.data[y], 'C2', schPre);
    const fPost = E.totalRowFlags(POST.tables.C2.data[y], 'C2', schPost);
    eq('C2/' + y + ' total-row classification unchanged', fPost, fPre);
  });
  check('C2/2024 Total is still classified a total (NOT declassified)',
        E.totalRowFlags(POST.tables.C2.data['2024'], 'C2',
                        schemaOf(POST, 'C2', '2024'))[2] === true);
  control('its parts genuinely do not sum, so bare numbers WOULD have declassified it',
          Math.abs((32919 + 8929) - 104025) > 1.5);
  // the editor opens C2 clean, and a Save with no edit persists nothing
  ['2023', '2024', '2025'].forEach(y => {
    const sch = E.getTableSchema(POST.tables.C2, y);
    const base = E.getTableBody(POST.tables.C2, y);
    const draft = clone(base);
    E.recomputeTotals(draft, sch, 'C2', base);
    eq('C2/' + y + ' editor open changes nothing', draft, base.map(r => r.slice()));
    const p1 = E.stripDerivedForPersist(clone(draft), 'C2', sch);
    const p2 = E.stripDerivedForPersist(clone(base), 'C2', sch);
    eq('C2/' + y + ' a Save with no edit persists nothing', p1, p2);
  });
})();

console.log('CLCPA-216 acceptance suite');
console.log('  baseline ref : ' + BASE_REF);
console.log('  assertions   : ' + (pass + fail) + '   pass ' + pass +
            '   controls red ' + ctl + '   FAIL ' + fail);
if (fail) {
  console.log('');
  console.log('FAILURES:');
  fails.forEach(f => console.log('  X ' + (f.length > 260 ? f.slice(0, 260) + ' ...' : f)));
  process.exitCode = 1;
} else {
  console.log('  ALL PASS');
}
