/* CLCPA-278 -- the engine's own figure recomputes; the preparer's is kept.
 *
 * CLCPA-272 ruling (b) protects the PREPARER's figure. It does not protect the
 * SYSTEM's own: on a fresh year the engine computed a Grand Total left blank
 * on import, and editing a component then froze that computed figure and
 * flagged it as "the filed value is kept" -- telling the operator their number
 * was respected when they never filed one.
 *
 * The distinction needs no new storage. A total that EQUALS its components is
 * consistent and follows the edit; one that ALREADY disagrees was chosen by
 * somebody and is kept, per (b).
 *
 * BASE predates the change: f2c7137 (CLCPA-274's tip).
 *
 * Run:  node suite_278.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || 'f2c7137';
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
const run = api(SRC, ['recomputeDerivableSums', 'rowSumIsConsistent',
  'reconcileSumColumns', 'buildIngestImport', 'detectSumColumns']);

const H = P.tables.H1;
const SCH = H.schema_by_year['2025'];
/* Edit cell (row, col) of `rows` to `v`, the way the blur handler does it.
 *
 * THE CAPTURE AND THE WRITE HAPPEN OUTSIDE run(). The resolver re-runs its
 * callback on every ReferenceError while it discovers closures, so a callback
 * that MUTATES state runs its mutation more than once -- and here the second
 * pass captured `before` from the already-edited row, which is no longer
 * consistent, so the recompute correctly declined and A1 read 1443. The
 * symptom looked exactly like the feature being broken. Only the call itself
 * belongs inside the retry. */
const edit = (rows, r, c, v) => {
  const before = rows[r].slice();
  rows[r][c] = v;
  run(a => a.recomputeDerivableSums(rows, SCH, 'H1', r, before, c));
  return rows;
};

log('======================================================================');
log('CLCPA-278 -- the engine\'s figure recomputes, the preparer\'s is kept');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the two cases -------------------------------------------------- */
log('');
log('A. WHOSE FIGURE IS IT');
guard('A-block', () => {
  let rows = [['Westchester', 666, 777, 1443]];
  edit(rows, 0, 1, 700);
  ok(rows[0][3] === 1477,
    'A1 a CONSISTENT total follows the edit: 1443 -> 1477 (got ' + rows[0][3] + ')');

  rows = [['Westchester', 666, 777, 1500]];
  edit(rows, 0, 1, 700);
  ok(rows[0][3] === 1500,
    'A2 a total that ALREADY disagreed is KEPT: 1500 stays (got ' + rows[0][3] + ')');

  /* and CLCPA-272 still advises on the one that was kept */
  const found = run(a => a.reconcileSumColumns(rows, SCH, 'H1'));
  ok(found.length === 1 && found[0].filed === 1500 && found[0].computed === 1477,
    'A3 and CLCPA-272 advises on it, filed 1500 against 1477');

  /* the one that followed raises nothing */
  const rows2 = [['Westchester', 666, 777, 1443]];
  edit(rows2, 0, 1, 700);
  ok(run(a => a.reconcileSumColumns(rows2, SCH, 'H1')).length === 0,
    'A4 while the recomputed one raises NOTHING -- it is consistent again');
});

/* ---- B. the edges ------------------------------------------------------ */
log('');
log('B. THE EDGES');
guard('B-block', () => {
  let rows = [['Westchester', 666, 777, 1443]];
  edit(rows, 0, 3, 9999);
  ok(rows[0][3] === 9999,
    'B1 editing the TOTAL ITSELF is the preparer filing one -- not overwritten');

  rows = [['Westchester', 666, 777, null]];
  edit(rows, 0, 1, 700);
  ok(rows[0][3] === null,
    'B2 a BLANK total is not consistent, so nothing is invented into it');

  rows = [['Westchester', 666, null, 1443]];
  edit(rows, 0, 1, 700);
  ok(rows[0][3] === 1443,
    'B3 a row with a missing component is left alone -- a partial sum is not a sum');

  /* B3 above is decided by the PRE-edit row already being inconsistent, so it
   * cannot see a missing guard on the post-edit sum. This is the case that
   * can: consistent before, and the edit itself EMPTIES a component. Without
   * the completeness guard the total would become 666, a sum of one part. */
  /* TWO ROWS, and that is what makes it reach the guard. With a single row,
   * emptying a component makes columnNumericMask drop that column, so
   * detectSumColumns finds no relationship at all and the completeness guard
   * is never consulted -- the assertion passed either way and proved nothing.
   * A second row keeps the column numeric. */
  rows = [['Manhattan', 100, 200, 300], ['Westchester', 666, 777, 1443]];
  edit(rows, 1, 2, null);
  ok(rows[1][3] === 1443,
    'B3b and an edit that EMPTIES a component leaves the total alone (got ' +
    rows[1][3] + ')');

  rows = [['Westchester', 666, 777, 'n/a']];
  edit(rows, 0, 1, 700);
  ok(rows[0][3] === 'n/a', 'B4 a non-numeric total is left alone');

  /* the rounding tolerance is the engine's own, so a stored figure inside it
   * counts as consistent and follows */
  rows = [['Westchester', 666, 777, 1444]];
  edit(rows, 0, 1, 700);
  ok(rows[0][3] === 1477,
    'B5 a total within the engine\'s own rounding tolerance counts as consistent');

  /* editing a column that is not a component changes nothing */
  rows = [['Westchester', 666, 777, 1443]];
  edit(rows, 0, 0, 'Westchester County');
  ok(rows[0][3] === 1443, 'B6 editing the LABEL recomputes nothing');
});

/* ---- C. every derivable table, not just H1 ------------------------------ */
log('');
log('C. EVERY ENUMERATED DERIVABLE-COLUMN TABLE');
guard('C-block', () => {
  const ids = ['B2', 'F2', 'F4', 'F5', 'F6', 'F7', 'H1'];
  let worked = 0;
  ids.forEach((id) => {
    const y = Object.keys(P.tables[id].schema_by_year).sort().pop();
    const schema = P.tables[id].schema_by_year[y];
    const src = (P.tables[id].data || {})[y] || [];
    const rel = run(a => a.detectSumColumns(schema, src, id))[0];
    if (!rel) return;
    /* a synthetic consistent row for this table's own relationship */
    const row = schema.map(() => null);
    row[0] = 'probe';
    rel.parts.forEach((c, i) => { row[c] = (i + 1) * 10; });
    row[rel.column] = rel.parts.reduce((s, c) => s + row[c], 0);
    const rows = [row];
    const before = row.slice();
    rows[0][rel.parts[0]] = 999;
    run(a => a.recomputeDerivableSums(rows, schema, id, 0, before, rel.parts[0]));
    const want = rel.parts.reduce((s, c) => s + rows[0][c], 0);
    if (rows[0][rel.column] === want) worked++;
    else log('     ' + id + ' did NOT follow: ' + rows[0][rel.column] + ' want ' + want);
  });
  ok(worked === ids.length,
    'C1 the rule works on all ' + ids.length + ' enumerated tables -- ' + worked);
});

/* ---- D. import is untouched -------------------------------------------- */
log('');
log('D. THE IMPORT PATH IS UNCHANGED');
guard('D-block', () => {
  const header = SCH.map(h => h == null ? '' : String(h));
  const rows = H.data['2025'].map(r => r.slice());
  const mk = (gt) => { const l = SCH.map(() => ''); l[0] = 'Westchester';
    l[1] = '666'; l[2] = '777'; if (gt !== null) l[3] = gt; return l; };

  const provided = run(a => a.buildIngestImport([header, mk('1500')], SCH, rows, 'H1'));
  const pr = provided.candidate.find(r => r[0] === 'Westchester');
  ok(pr && pr[3] === 1500, 'D1 a PROVIDED total still lands as filed');
  ok((provided.reconcileNotices || []).length === 1, 'D2 and is still advised on');

  const blank = run(a => a.buildIngestImport([header, mk(null)], SCH, rows, 'H1'));
  ok(blank.ok === true, 'D3 an import leaving the column blank still succeeds');

  /* byte proof: buildIngestImport itself did not move */
  const grab = (s) => {
    const a = s.indexOf('\r\n  function buildIngestImport(');
    return a < 0 ? null : s.slice(a, s.indexOf('\r\n  }', a));
  };
  ok(grab(SRC) && grab(SRC) === grab(BASE_SRC),
    'D4 buildIngestImport is BYTE-IDENTICAL to BASE');
});

/* ---- E. the CLCPA-269 hand-off ----------------------------------------- */
log('');
log('E. WHAT THIS MEANS FOR A "CHANGED CELL" (the CLCPA-269 interaction)');
guard('E-block', () => {
  /* A recomputed total is a cell the preparer did NOT change. Stated here so
   * the two tickets cannot drift: CLCPA-269's count must not attribute it to
   * the operator. This suite asserts the SHAPE the count has to handle. */
  const rows = [['Westchester', 666, 777, 1443]];
  const before = rows.map(r => r.slice());
  edit(rows, 0, 1, 700);
  const diff = [];
  rows.forEach((r, ri) => r.forEach((v, ci) => { if (v !== before[ri][ci]) diff.push([ri, ci]); }));
  ok(diff.length === 2,
    'E1 one edit moved TWO cells: the component and its recomputed total');
  ok(diff.some(d => d[1] === 1) && diff.some(d => d[1] === 3),
    'E2 column 1 (typed) and column 3 (derived)');
  log('     -> CLCPA-269 must count 1 here, not 2: the derived cell is the ' +
      'engine\'s, not the preparer\'s.');
});

/* ---- F. style of change ------------------------------------------------- */
log('');
log('F. STYLE OF CHANGE');
guard('F-block', () => {
  const code = codeOnly(SRC);
  ok(/function recomputeDerivableSums\(rows, headerRow, tableId, rowIndex, beforeRow, editedCol\)/.test(code),
    'F1 the recompute takes the PRE-EDIT row');
  ok(/const beforeRow = Array\.isArray\(state\.ingest\.draft\[r\]\)/.test(code),
    'F2 and the blur handler captures it BEFORE the write');
  /* THE ORDER OF THE THREE, measured in the whole handler rather than in a
   * slice that starts at one of them. Round 1 sliced FROM the capture, so
   * moving the capture below the write simply moved the slice and the
   * assertion passed -- a pin that cannot fail. */
  /* SCOPED TO THE BLUR HANDLER. The write line appears twice -- the `input`
   * handler commits on every keystroke as well -- so a bare indexOf found the
   * INPUT handler's copy, which sits above the capture, and the order
   * assertion failed on perfectly good source. */
  const blur = code.slice(code.indexOf('noteTypedPercent(r, c, e.target.value);'));
  const posCapture = blur.indexOf('const beforeRow = Array.isArray(state.ingest.draft[r])');
  const posWrite = blur.indexOf('state.ingest.draft[r][c] = (c === 0) ? e.target.value');
  const posRecompute = blur.indexOf('recomputeDerivableSums(state.ingest.draft');
  ok(posCapture > 0 && posWrite > 0 && posRecompute > 0,
    'F3a all three steps of the blur handler are present');
  ok(posCapture < posWrite && posWrite < posRecompute,
    'F3 they run in order: capture the row, write the cell, then recompute');
  ok(/withinSourceRounding\(filed, sum\)/.test(code),
    'F4 consistency uses the engine\'s own tolerance, not a new one');
  ok(/detectSumColumns\(headerRow, rows, tableId\)/.test(code),
    'F5 the relationship comes from the schema');
  const added = SRC.split('\r\n').filter(l => BASE_SRC.indexOf(l) < 0)
    .filter(l => l.trim() && !/^\s*[*/]/.test(l.trim()));
  ok(!added.some(l => /['"][A-J]\d+['"]/.test(l)), 'F6 no added code line names a table');
  ok(!added.some(l => /Grand Total|Westchester/.test(l)), 'F7 nor a column or a row');
  ok(code.indexOf('cr2bf_schema:') < 0 && /cr2bf_rows: JSON\.stringify\(newRows\)/.test(code),
    'F8 no stored data: a save still writes rows only');
});

/* ---- X. the harness ----------------------------------------------------- */
log('');
log('X. THE HARNESS');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  const m = /const BASE = process\.env\.DAC_BASE_COMMIT \|\| '([0-9a-f]+)';/.exec(self);
  ok(!!m && /^[0-9a-f]{7,40}$/.test(m[1]), 'X1 BASE is a literal sha -- ' + (m ? m[1] : 'none'));
  ok(BASE_SRC.indexOf('recomputeDerivableSums') < 0, 'X2 and predates this ticket');
  ok(/^function recomputeDerivableSums\b/.test(String(run(a => a.recomputeDerivableSums))),
    'X3 the function under test is the one sliced from app.js');
  ok(666 + 777 === 1443 && 700 + 777 === 1477, 'X4 the probe arithmetic checks out');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-278-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
