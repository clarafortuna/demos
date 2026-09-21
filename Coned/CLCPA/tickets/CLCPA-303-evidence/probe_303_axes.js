/* CLCPA-303, OPTION (C): what each AXIS already does, before anything is
 * declared.
 *
 * The ruling is to declare both directions, so that "any future divergence
 * surfaces as a kept figure with the amber advisory, never silent drift".
 * That is a statement about behaviour on divergence, and B2 does not diverge
 * anywhere today -- 12 of 12 cells agree -- so the only way to find out what
 * the engine does on the disagreement is to CREATE one and watch.
 *
 * Six gestures, on every stored year:
 *
 *   1  edit a body cell            does the row total follow? the column
 *                                  total? the corner where they cross?
 *   2  file a divergent ROW total  kept, or overwritten? advised, or silent?
 *   3  file a divergent COLUMN     same two questions on the other axis
 *      total (the Total row)
 *   4  file a divergent CORNER     and here the two rules disagree about one
 *                                  cell, which is the question the ruling
 *                                  says has to be settled
 *   5  blank the row total         what fills it back, and from which axis
 *   6  blank the whole Total row   same
 *
 * Nothing is asserted here. This file measures; suite_303 pins.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'probe-303-axes-output.txt');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

function harness(src, want) {
  const L = src.split('\r\n');
  const TOP = [];
  L.forEach((ln, n) => {
    const m = /^ {2}(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (nm) => {
    const k = TOP.findIndex(d => d.name === nm);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n');
  };
  const parts = [], have = new Set();
  const add = (n) => {
    if (have.has(n)) return false;
    const f = find(n);
    if (!f) return false;
    have.add(n); parts.push(f); return true;
  };
  want.forEach(add);
  let api = null;
  const attempt = (call) => {
    for (let r = 0; r < 400; r++) {
      try {
        if (!api) {
          api = new Function('PAYLOAD', 'const state = { payload: PAYLOAD };\n' +
            parts.join('\n\n') +
            '\n;return {' + want.filter(n => have.has(n)).join(',') + '};')(P);
        }
        return call(api);
      } catch (e) {
        const m = /(\w+) is not defined/.exec(String(e && e.message));
        if (m && add(m[1])) { api = null; continue; }
        throw e;
      }
    }
    throw new Error('assembly did not converge');
  };
  return { attempt };
}

const H = harness(SRC, ['recomputeTotals', 'rowsForDisplay', 'getTableSchema',
  'detectSumColumns', 'recomputeDerivableSums', 'fillDerivableSumsOnImport',
  'reconcileSumColumns', 'unreconciledTotals', 'totalRowFlags',
  'stripDerivedForPersist', 'DERIVED_COLS', 'DERIVED_ROWS', 'rowSumIsConsistent']);

const T = P.tables.B2;
const YEARS = Object.keys(T.data).sort();

log('CLCPA-303 OPTION (C): what each axis does, measured before anything is built');
log('app.js: ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* B2 is three rows: DAC, Non-DAC, Total. The last column is the row-wise
 * total; the last row is the column-wise one; they cross at one cell. */
function shape(y) {
  const schema = H.attempt(api => api.getTableSchema(T, y));
  const rows = T.data[y];
  const rel = H.attempt(api => api.detectSumColumns(schema, rows, 'B2'))[0];
  return { schema: schema, rows: rows, rel: rel,
    totalCol: rel ? rel.column : schema.length - 1,
    totalRow: rows.length - 1 };
}

/* run the editor's recompute exactly as the grid does: draft, plus the
 * baseline it classifies from */
function edit(y, r, c, v) {
  const S = shape(y);
  const draft = S.rows.map(row => row.slice());
  const before = S.rows.map(row => row.slice());
  draft[r][c] = v;
  H.attempt(api => api.recomputeDerivableSums(draft, S.schema, 'B2', r, before[r], c));
  H.attempt(api => api.recomputeTotals(draft, S.schema, 'B2', before));
  return { S: S, draft: draft, before: before };
}

log('=======================================================================');
log(' 1. EDIT A BODY CELL: which totals follow?');
log('=======================================================================');
YEARS.forEach((y) => {
  const S = shape(y);
  const c = 1;                       /* "L2 Plugs", a component of both */
  const was = S.rows[0][c];
  const E = edit(y, 0, c, was + 100);
  log('  ' + y + '  DAC / ' + S.schema[c] + ': ' + was + ' -> ' + (was + 100));
  log('      row total   DAC / ' + S.schema[S.totalCol] + ': ' +
      S.rows[0][S.totalCol] + ' -> ' + E.draft[0][S.totalCol] +
      (E.draft[0][S.totalCol] === S.rows[0][S.totalCol] + 100 ? '   FOLLOWED' : '   did not follow'));
  log('      column total  Total / ' + S.schema[c] + ': ' +
      S.rows[S.totalRow][c] + ' -> ' + E.draft[S.totalRow][c] +
      (E.draft[S.totalRow][c] === S.rows[S.totalRow][c] + 100 ? '   FOLLOWED' : '   did not follow'));
  log('      THE CORNER    Total / ' + S.schema[S.totalCol] + ': ' +
      S.rows[S.totalRow][S.totalCol] + ' -> ' + E.draft[S.totalRow][S.totalCol] +
      (E.draft[S.totalRow][S.totalCol] === S.rows[S.totalRow][S.totalCol] + 100
        ? '   FOLLOWED' : '   did not follow'));
});

log('');
log('=======================================================================');
log(' 2. FILE A DIVERGENT ROW TOTAL (the operator types it themselves)');
log('=======================================================================');
YEARS.forEach((y) => {
  const S = shape(y);
  const bogus = S.rows[0][S.totalCol] + 500;
  const E = edit(y, 0, S.totalCol, bogus);
  const adv = H.attempt(api => api.reconcileSumColumns(E.draft, S.schema, 'B2'));
  log('  ' + y + '  DAC / ' + S.schema[S.totalCol] + ' filed as ' + bogus +
      ' (row sums to ' + S.rows[0][S.totalCol] + ')');
  log('      after the recompute the cell holds: ' + E.draft[0][S.totalCol] +
      (E.draft[0][S.totalCol] === bogus ? '   KEPT' : '   OVERWRITTEN'));
  log('      reconciliation advisory rows: ' + adv.length +
      (adv.length ? '   ' + JSON.stringify(adv.map(a => a.label + '/' + a.column)) : '   SILENT'));
});

log('');
log('=======================================================================');
log(' 3. FILE A DIVERGENT COLUMN TOTAL (the Total row, in a plain column)');
log('=======================================================================');
YEARS.forEach((y) => {
  const S = shape(y);
  const bogus = S.rows[S.totalRow][1] + 500;
  const E = edit(y, S.totalRow, 1, bogus);
  const adv = H.attempt(api => api.reconcileSumColumns(E.draft, S.schema, 'B2'));
  const unrec = H.attempt(api =>
    Array.from(api.unreconciledTotals(S.rows, S.schema, 'B2') || []));
  log('  ' + y + '  Total / ' + S.schema[1] + ' filed as ' + bogus +
      ' (column sums to ' + S.rows[S.totalRow][1] + ')');
  log('      after the recompute the cell holds: ' + E.draft[S.totalRow][1] +
      (E.draft[S.totalRow][1] === bogus ? '   KEPT' : '   OVERWRITTEN'));
  log('      reconciliation advisory rows: ' + adv.length +
      (adv.length ? '' : '   SILENT'));
  log('      unreconciledTotals on the STORED table: ' + JSON.stringify(unrec));
});

log('');
log('=======================================================================');
log(' 4. THE CORNER: file a value the two axes disagree about');
log('=======================================================================');
YEARS.forEach((y) => {
  const S = shape(y);
  const bogus = S.rows[S.totalRow][S.totalCol] + 500;
  const E = edit(y, S.totalRow, S.totalCol, bogus);
  const adv = H.attempt(api => api.reconcileSumColumns(E.draft, S.schema, 'B2'));
  const disp = H.attempt(api => api.rowsForDisplay(
    E.draft.map(r => r.slice()), S.schema, 'B2'));
  log('  ' + y + '  the corner filed as ' + bogus +
      ' (both axes say ' + S.rows[S.totalRow][S.totalCol] + ')');
  log('      after the recompute : ' + E.draft[S.totalRow][S.totalCol] +
      (E.draft[S.totalRow][S.totalCol] === bogus ? '   KEPT' : '   OVERWRITTEN'));
  log('      through the display : ' + disp[S.totalRow][S.totalCol]);
  log('      advisory rows       : ' + adv.length + (adv.length ? '' : '   SILENT'));
});

log('');
log('=======================================================================');
log(' 5. BLANK CELLS: which axis fills them back?');
log('=======================================================================');
YEARS.forEach((y) => {
  const S = shape(y);
  /* the row total on a body row */
  const a = S.rows.map(r => r.slice());
  a[0][S.totalCol] = null;
  H.attempt(api => api.fillDerivableSumsOnImport(a, S.schema, 'B2'));
  const aDisp = H.attempt(api => api.rowsForDisplay(a.map(r => r.slice()), S.schema, 'B2'));
  /* the whole Total row */
  const b = S.rows.map(r => r.slice());
  for (let c = 1; c < S.schema.length; c++) b[S.totalRow][c] = null;
  H.attempt(api => api.fillDerivableSumsOnImport(b, S.schema, 'B2'));
  const bDisp = H.attempt(api => api.rowsForDisplay(b.map(r => r.slice()), S.schema, 'B2'));
  log('  ' + y);
  log('      DAC row total blanked -> import fill ' + JSON.stringify(a[0][S.totalCol]) +
      ', display ' + JSON.stringify(aDisp[0][S.totalCol]));
  log('      Total row blanked     -> import fill ' + JSON.stringify(b[S.totalRow].slice(1)));
  log('                               display     ' + JSON.stringify(bDisp[S.totalRow].slice(1)));
});

log('');
log('=======================================================================');
log(' 6. WHAT IS DECLARED TODAY');
log('=======================================================================');
log('  DERIVED_COLS.B2 = ' + JSON.stringify(H.attempt(api => api.DERIVED_COLS.B2) || null));
log('  DERIVED_ROWS.B2 = ' + JSON.stringify(H.attempt(api => api.DERIVED_ROWS.B2) || null));
YEARS.forEach((y) => {
  const S = shape(y);
  log('  ' + y + '  detectSumColumns finds: ' +
      JSON.stringify(S.rel ? { column: S.rel.column, parts: S.rel.parts } : null));
  log('        stripDerivedForPersist keeps: ' + JSON.stringify(
    H.attempt(api => api.stripDerivedForPersist(S.rows.map(r => r.slice()), 'B2', S.schema))));
});

fs.writeFileSync(OUT, lines.join('\n') + '\n');
