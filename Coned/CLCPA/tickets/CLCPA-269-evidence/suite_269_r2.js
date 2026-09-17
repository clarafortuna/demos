/* CLCPA-269 round 2 -- the confirm-save count is the PREPARER's cells.
 *
 * ROUND 1 WAS RIGHT ABOUT THE WRONG BASELINE. It replaced a rows-times-columns
 * count with a real per-cell diff, which is correct against a POPULATED
 * baseline and wrong against an EMPTY one: with nothing stored, every non-empty
 * cell differs, so the count became "every cell in the draft".
 *
 * AND MY ROUND-1 BENCH REPORTED 12 FOR THIS SHAPE. It was wrong: it compared a
 * hand-built draft/baseline pair instead of the draft the editor actually
 * holds on an empty year, where the baseline is EMPTY and the import ADDS
 * every row. This suite builds the live draft -- getTableBody for the
 * baseline, buildIngestImport for the rows, recomputeTotals as the editor runs
 * it -- and only then counts. The reproduction comes first; the fix follows it.
 *
 * BASE predates the change: e08bbad (CLCPA-278's tip).
 *
 * Run:  node suite_269_r2.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || 'e08bbad';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);
const SRC = fs.readFileSync(APP, 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => { try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); } };
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p);

function api(src, want) {
  const L = src.split('\r\n'); const TOP = [];
  L.forEach((ln, n) => { const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n }); });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (n) => { const k = TOP.findIndex(d => d.name === n);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n'); };
  const parts = [], have = new Set();
  const add = (n) => { if (have.has(n)) return false; const f = find(n);
    if (!f) return false; have.add(n); parts.push(f); return true; };
  want.forEach(add);
  const make = () => new Function('const state={};' + parts.join('\n\n') +
    '\nreturn {' + want.join(',') + '};')();
  return (fn) => {
    for (let r = 0; r < 500; r++) {
      try { return fn(make()); }
      catch (e) { const m = /(\w+) is not defined/.exec(e.message);
        if (m && add(m[1])) continue; throw e; }
    }
    throw new Error('dependency resolution did not converge');
  };
}
const WANT = ['getTableBody', 'getTableSchema', 'buildIngestImport',
  'ingestComputed', 'ingestKeyColCount', 'recomputeTotals', 'recomputeDerivableSums'];
const run = api(SRC, WANT);
const runBase = api(BASE_SRC, WANT);

/* THE SHIPPED changeCount, cut from the confirm-save modal of each build and
 * given the closures it needs. Cutting it is the point: a re-implementation
 * here would be my copy, not the dialog's. */
function counterFrom(src, runner) {
  const i0 = src.indexOf('    const changeCount = (() => {');
  const i1 = src.indexOf('    })();', i0);
  if (i0 < 0 || i1 < 0) throw new Error('changeCount not found');
  const body = src.slice(i0, i1 + 9);
  return (arg) => runner(a => new Function('i', 'ingestComputed', 'ingestKeyColCount',
    '"use strict";' + body + '\nreturn changeCount;')(
    arg, a.ingestComputed, a.ingestKeyColCount));
}
const count = counterFrom(SRC, run);
const countBase = counterFrom(BASE_SRC, runBase);

/* ---- the live empty-year draft ----------------------------------------- */
const H = P.tables.H1;
const YEAR = '2097';
const SCHEMA = run(a => a.getTableSchema(H, YEAR));
const BASELINE = run(a => a.getTableBody(H, YEAR));
const FILE = [SCHEMA.map(h => (h == null ? '' : String(h))),
  ['Manhattan', '1309', '491', '1800'],
  ['Queens', '1563', '281', '1844'],
  ['Westchester', '1886', '1094', '2980'],
  ['Bronx', '163', '689', '852'],
  ['Grand Total', '(calculated)', '(calculated)', '(calculated)'],
];
function liveDraft() {
  const plan = run(a => a.buildIngestImport(FILE, SCHEMA, BASELINE.map(r => r.slice()), 'H1'));
  const d = plan.candidate;
  run(a => a.recomputeTotals(d, SCHEMA, 'H1', BASELINE));
  return { plan: plan, draft: d };
}

log('======================================================================');
log('CLCPA-269 round 2 -- the count is the preparer\'s cells');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the reproduction ----------------------------------------------- */
log('');
log('A. THE LIVE EMPTY-YEAR PATH, reproduced before anything was changed');
guard('A-block', () => {
  const { plan, draft } = liveDraft();
  ok(BASELINE.length === 0, 'A1 the baseline of an empty year is EMPTY');
  ok(plan.addedRows.length === 5, 'A2 the import ADDS all five rows (' + plan.addedRows.length + ')');
  ok(plan.populated.length === 12,
    'A3 and populates exactly 12 cells -- what the preparer brought (' +
    plan.populated.length + ')');
  ok(draft.length === 5, 'A4 the draft holds 5 rows');

  const was = countBase({ draft: draft, baseline: BASELINE, tableId: 'H1', schema: SCHEMA });
  ok(was === 20,
    'A5 on BASE the dialog said 20 -- the hosted build\'s exact number (got ' + was + ')');
  const now = count({ draft: draft, baseline: BASELINE, tableId: 'H1', schema: SCHEMA });
  ok(now === 12, 'A6 it now says 12 (got ' + now + ')');
});

/* ---- B. where the 20 came from ----------------------------------------- */
log('');
log('B. THE TWENTY, CLASSIFIED');
guard('B-block', () => {
  const { draft } = liveDraft();
  const cls = run((a) => {
    const c = a.ingestComputed(draft, 'H1', SCHEMA);
    const keyCols = Math.max(1, a.ingestKeyColCount('H1'));
    let key = 0, computed = 0, preparer = 0;
    draft.forEach((row, r) => row.forEach((v, ci) => {
      if (v == null || v === '') return;
      if (ci < keyCols) { key++; return; }
      if (c.any(r, ci)) { computed++; return; }
      preparer++;
    }));
    return { key: key, computed: computed, preparer: preparer };
  });
  log('     key/label cells : ' + cls.key);
  log('     engine cells    : ' + cls.computed);
  log('     preparer cells  : ' + cls.preparer);
  ok(cls.key === 5, 'B1 five label cells');
  ok(cls.computed === 3, 'B2 three engine cells, the total row');
  ok(cls.preparer === 12, 'B3 twelve preparer cells');
  ok(cls.key + cls.computed + cls.preparer === 20, 'B4 and they account for all 20');
});

/* ---- C. the populated path still counts sensibly ------------------------ */
log('');
log('C. THE POPULATED-BASELINE PATH');
guard('C-block', () => {
  const draft = P.tables.H1.data['2025'].map(r => r.slice());
  const base = P.tables.H1.data['2024'].map(r => r.slice());
  const sch = P.tables.H1.schema_by_year['2025'];
  const was = countBase({ draft: draft, baseline: base, tableId: 'H1', schema: sch });
  const now = count({ draft: draft, baseline: base, tableId: 'H1', schema: sch });
  log('     BASE ' + was + '  ->  ' + now);
  ok(was === 15, 'C1 BASE read 15 on this pair, as the ticket reports (got ' + was + ')');
  ok(now < was, 'C2 and it is now lower, the label and total-row cells removed');
  /* 12, not 8: four boroughs x THREE value columns. The Grand Total column is
   * counted on body rows by the decision stated in section D -- only the
   * total ROW and the derived columns are the engine's. 15 - 12 = the three
   * cells of the total row; the labels were already equal on this pair so
   * they never contributed. */
  ok(now === 12,
    'C3 specifically 12: four boroughs x three value columns (got ' + now + ')');
  ok(was - now === 3,
    'C4a and the three cells removed are exactly the total row\'s (got ' + (was - now) + ')');

  /* nothing changed -> zero, on BOTH paths */
  const same = P.tables.H1.data['2025'].map(r => r.slice());
  ok(count({ draft: same, baseline: same, tableId: 'H1', schema: sch }) === 0,
    'C4 an untouched draft still counts 0');
  ok(count({ draft: [], baseline: [], tableId: 'H1', schema: sch }) === 0,
    'C5 and so does an empty one');
});

/* ---- D. the CLCPA-278 interaction, decided and stated ------------------- */
log('');
log('D. A RECOMPUTED ROW TOTAL, and the decision the ticket asked for');
guard('D-block', () => {
  const sch = P.tables.H1.schema_by_year['2025'];
  const base = P.tables.H1.data['2025'].map(r => r.slice());
  const draft = P.tables.H1.data['2025'].map(r => r.slice());
  /* edit one component the way the blur handler does, letting CLCPA-278 bring
   * the row's total with it */
  const before = draft[0].slice();
  draft[0][1] = draft[0][1] + 10;
  run(a => a.recomputeDerivableSums(draft, sch, 'H1', 0, before, 1));
  const moved = draft[0].filter((v, ci) => v !== base[0][ci]).length;
  ok(moved === 2, 'D1 one edit moved two cells: the component and its row total');
  const n = count({ draft: draft, baseline: base, tableId: 'H1', schema: sch });
  log('     the dialog reports: ' + n);
  ok(n === 2,
    'D2 and the dialog counts BOTH -- the decision, stated: a body row\'s total ' +
    'is a figure in the table, and the value being saved has moved (got ' + n + ')');
  log('     DECISION: the total ROW and the derived COLUMNS are the engine\'s and');
  log('     are excluded on every path. A body row\'s total column is not: the');
  log('     preparer files it in the template and CLCPA-278 may recompute it,');
  log('     and either way the saved value moved. Excluding it would have');
  log('     reported 8 for an import that plainly brought 12.');
});

/* ---- E. every table, no table named ------------------------------------ */
log('');
log('E. THE EXCLUSIONS ARE DERIVED, NOT LISTED');
guard('E-block', () => {
  const code = codeOnly(SRC);
  ok(/const computed = ingestComputed\(a, i\.tableId, i\.schema\);/.test(code),
    'E1 the engine cells come from the shipped classifier');
  ok(/const keyCols = Math\.max\(1, ingestKeyColCount\(i\.tableId\)\);/.test(code),
    'E2 and the key columns from the shipped declaration');
  ok(/if \(c < keyCols\) continue;/.test(code) && /if \(computed\.any\(r, c\)\) continue;/.test(code),
    'E3 both exclusions are applied in the count');
  const added = SRC.split('\r\n').filter(l => BASE_SRC.indexOf(l) < 0)
    .filter(l => l.trim() && !/^\s*[*/]/.test(l.trim()));
  ok(!added.some(l => /['"][A-J]\d+['"]/.test(l)), 'E4 no added code line names a table');

  /* A3/A4 declare TWO key columns, so the count must respect that rather than
   * assuming column 0 */
  const a3 = P.tables.A3;
  const y = Object.keys(a3.schema_by_year).sort().pop();
  const kc = run(a => a.ingestKeyColCount('A3'));
  ok(kc === 2, 'E5 A3 declares two key columns (got ' + kc + ')');
  const d = a3.data[y].map(r => r.slice());
  const b = a3.data[y].map(r => r.slice());
  d[3][0] = 'renamed'; d[3][1] = 'also renamed';
  ok(count({ draft: d, baseline: b, tableId: 'A3', schema: a3.schema_by_year[y] }) === 0,
    'E6 and renaming BOTH of them counts 0 -- neither is a figure');
});

/* ---- X. the harness ----------------------------------------------------- */
log('');
log('X. THE HARNESS');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  const m = /const BASE = process\.env\.DAC_BASE_COMMIT \|\| '([0-9a-f]+)';/.exec(self);
  ok(!!m && /^[0-9a-f]{7,40}$/.test(m[1]), 'X1 BASE is a literal sha -- ' + (m ? m[1] : 'none'));
  ok(BASE_SRC.indexOf('const keyCols = Math.max(1, ingestKeyColCount(i.tableId));') < 0,
    'X2 and predates this change');
  /* THE BENCH BUILDS THE LIVE DRAFT. Round 1's did not, which is why it
   * reported 12 while the hosted build showed 20. */
  /* IDENTITY, not resemblance. Round 1 of this control swapped the real plan
   * for a hand-made object with the same counts and the assertion passed --
   * which is precisely the failure it exists to catch. The draft under test
   * must BE the plan's candidate, and the plan must be a real import result. */
  const lv = liveDraft();
  ok(BASELINE.length === 0, 'X3 the baseline of the year under test is empty');
  ok(lv.draft === lv.plan.candidate,
    'X3b the draft under test IS the import plan\'s candidate, not a copy of ' +
    'stored data that happens to look like one');
  ok(typeof lv.plan.ok === 'boolean' && Array.isArray(lv.plan.populated) &&
     lv.plan.notTouched && Array.isArray(lv.plan.rejections),
    'X3c and the plan is a real buildIngestImport result');
  ok(lv.draft.map(r => String(r[0])).join('|') ===
     FILE.slice(1).map(r => r[0]).join('|'),
    'X3d whose rows are the FILE\'s rows, in the file\'s order');
  ok(1309 + 491 === 1800 && 1563 + 281 === 1844,
    'X4 the file\'s own arithmetic checks out');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-269-r2-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
