/* CLCPA-303, THE MEASUREMENT, and nothing else. The owner rules before this
 * one is built.
 *
 * The ticket says B2's "Total Plugs" is described three ways. This asks each
 * surface what it says, on the current tip, and then asks the only question
 * that decides how much any of it matters: would a stored published figure
 * move if the figure were derived instead of read?
 *
 * Nothing here is re-implemented. Every answer is produced by the app's own
 * function, executed.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'probe-303-totalplugs-output.txt');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

function harness(src, want) {
  const L = src.split('\r\n');
  const TOP = [];
  L.forEach((ln, n) => {
    const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
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

const H = harness(SRC, ['getTableSchema', 'detectSumColumns', 'totalRowFlags',
  'parseB2Plugs', 'ingestComputed', 'rowsForDisplay', 'DERIVED_COLS',
  'DAC_KPI_REPORTED', 'columnGrandTotals', 'recomputeTotals']);

const T = P.tables;
const B2 = T.B2;
const years = Object.keys(B2.data || {}).sort();

log('CLCPA-303 MEASUREMENT: what each surface says about B2s "Total Plugs"');
log('app.js: ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');
log('B2 IS TWO TOTALS CROSSING. "Total Plugs" is a COLUMN, summing the plug');
log('types across a row. "Total" is a ROW, summing the categories down a');
log('column. The cell where they meet is both at once, and it is the cell the');
log('headline KPI reads.');
log('');

/* ---------- surface 1: what is STORED ---------------------------------- */
log('=======================================================================');
log('SURFACE 1: the stored table, which is what the report page publishes');
log('=======================================================================');
years.forEach((y) => {
  const schema = H.attempt(api => api.getTableSchema(B2, y));
  log('  ' + y + '  schema ' + JSON.stringify(schema));
  (B2.data[y] || []).forEach((r, i) => log('      r' + i + ' ' + JSON.stringify(r)));
});

/* ---------- surface 2: the derivable SUM COLUMN ------------------------ */
log('');
log('=======================================================================');
log('SURFACE 2: detectSumColumns, which decides what the workbook MARKS and');
log('what the import advisory RECONCILES against');
log('=======================================================================');
years.forEach((y) => {
  const rows = B2.data[y];
  const schema = H.attempt(api => api.getTableSchema(B2, y));
  const sums = H.attempt(api => api.detectSumColumns(schema, rows, 'B2'));
  log('  ' + y + '  sum columns: ' + JSON.stringify(sums.map(s =>
    ({ column: s.column, head: schema[s.column], parts: s.parts,
       partHeads: s.parts.map(c => schema[c]) }))));
  const marks = H.attempt((api) => {
    const c = api.ingestComputed(rows, 'B2', schema);
    return rows.map((r, i) => {
      const m = [];
      for (let col = 1; col < schema.length; col++) if (c.marksInTemplate(i, col)) m.push(col);
      return { row: i, label: r[0], marks: m, importSkips: c.any(i, schema.length - 1) };
    });
  });
  marks.forEach(m => log('      r' + m.row + ' ' + JSON.stringify(String(m.label)) +
    '  workbook marks columns ' + JSON.stringify(m.marks) +
    '  import skips the Total Plugs cell: ' + m.importSkips));
});

/* ---------- surface 3: the KPI ----------------------------------------- */
log('');
log('=======================================================================');
log('SURFACE 3: the ev_plugs KPI, which reads the corner cell as a STORED');
log('figure and never asks whether it reproduces');
log('=======================================================================');
years.forEach((y) => {
  const kpi = H.attempt(api => api.DAC_KPI_REPORTED.ev_plugs(T, y));
  log('  ' + y + '  ev_plugs: ' + JSON.stringify(kpi) +
      (kpi && kpi.total ? ('   DAC share ' +
        (Math.round((kpi.dac / kpi.total) * 1000) / 10) + '%') : ''));
});
log('');
log('  and parseB2Plugs, which Section B\'s chart and tornado read:');
years.forEach((y) => {
  log('  ' + y + '  ' + JSON.stringify(H.attempt(api => api.parseB2Plugs(B2, y))));
});

/* ---------- surface 0: what the REPORT PAGE does ----------------------- */
log('');
log('=======================================================================');
log('AND THE SURFACE THAT DECIDES WHAT THE CLIENT SEES: the report page.');
log('B2 has no entry in DERIVED_COLS, so the question is whether anything');
log('computes this column at render, or whether the stored figure is simply');
log('printed.');
log('=======================================================================');
log('  DERIVED_COLS.B2 = ' +
    JSON.stringify(H.attempt(api => api.DERIVED_COLS.B2 || null)));
years.forEach((y) => {
  const rows = B2.data[y];
  const schema = H.attempt(api => api.getTableSchema(B2, y));
  const disp = H.attempt(api => api.rowsForDisplay(rows, schema, 'B2', { fillTotals: true }));
  const diff = [];
  rows.forEach((r, i) => r.forEach((v, c) => {
    if (JSON.stringify(v) !== JSON.stringify((disp[i] || [])[c])) {
      diff.push('r' + i + 'c' + c + ' ' + JSON.stringify(v) + ' -> ' +
        JSON.stringify((disp[i] || [])[c]));
    }
  }));
  log('  ' + y + '  cells the render changes: ' +
      (diff.length ? JSON.stringify(diff) : 'none, the stored figure is printed as filed'));
});

/* ---------- the arithmetic: does anything move? ------------------------ */
log('');
log('=======================================================================');
log('THE QUESTION THAT DECIDES IT: would a derived Total Plugs differ from');
log('the filed one, anywhere?');
log('=======================================================================');
let moved = 0, cells = 0;
years.forEach((y) => {
  const rows = B2.data[y];
  const schema = H.attempt(api => api.getTableSchema(B2, y));
  const sums = H.attempt(api => api.detectSumColumns(schema, rows, 'B2'));
  const flags = H.attempt(api => api.totalRowFlags(rows, 'B2', schema)) || [];
  sums.forEach((s) => {
    rows.forEach((r, i) => {
      const filed = r[s.column];
      if (typeof filed !== 'number') return;
      const sum = s.parts.reduce((a, c) => a + (typeof r[c] === 'number' ? r[c] : 0), 0);
      cells++;
      const same = Math.abs(filed - sum) < 1e-9;
      if (!same) moved++;
      log('  ' + y + ' r' + i + ' ' + JSON.stringify(String(r[0])) +
          '  filed ' + filed + '  row-sum ' + sum + (same ? '  AGREE' : '  DIFFER'));
    });
    /* and the same column read DOWNWARDS, which is the other total */
    const body = rows.filter((r, i) => !flags[i]);
    const len = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const col = H.attempt(api => api.columnGrandTotals(body, len).colSum)[s.column];
    const totRow = rows.findIndex((r, i) => flags[i]);
    if (totRow >= 0) {
      const filed = rows[totRow][s.column];
      cells++;
      const same = Math.abs(filed - col) < 1e-9;
      if (!same) moved++;
      log('  ' + y + ' the Total ROW read DOWN the Total Plugs column: filed ' +
          filed + '  column-sum ' + col + (same ? '  AGREE' : '  DIFFER'));
    }
  });
});

log('');
log('--- summary -----------------------------------------------------------');
log('  Total Plugs cells checked, both directions: ' + cells);
log('  cells where the filed figure and the derivation DISAGREE: ' + moved);
log('');
if (!moved) {
  log('  So no published figure moves. Whatever is ruled here is a question of');
  log('  which surface OWNS the number, not of correcting one: on every stored');
  log('  year the three descriptions agree to the digit.');
}

fs.writeFileSync(OUT, lines.join('\n') + '\n');
