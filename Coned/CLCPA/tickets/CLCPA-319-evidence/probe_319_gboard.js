/* CLCPA-319, THE MEASUREMENT: the whole G board, every stored year.
 *
 * This is the evidence base for three separate claims, and it is a
 * MEASUREMENT, not an acceptance suite -- it asserts nothing, it reports.
 *
 *   1. VALUE IDENTITY. For every G1 to G9 table-year, does the figure the
 *      rows produce equal the figure that is filed? If any year disagrees,
 *      the kept-figure guardian holds the filed value and this prints it by
 *      name, because a disagreement is a data question for Con Edison, not a
 *      thing to quietly republish.
 *   2. THE SEGMENT QUESTION. The rule segments by label: a total owns the
 *      rows between it and the total row above it, the same segment the
 *      percentage rule beside it takes. A flat sum over every non-total row
 *      agrees with that only while a table has a single total row, so this
 *      prints BOTH figures per year and counts the total rows per table --
 *      the first cut of the rule summed flat while its comment claimed to
 *      segment, and this column is what would have caught that.
 *   3. G10, the counter-example the ticket names: it is NOT in scope, and
 *      this prints what it files against what its rows sum to, so the reason
 *      it is excluded is on the record rather than asserted.
 *
 * The rule is EXECUTED from app.js, never re-implemented here. A harness that
 * retypes the arithmetic agrees with itself while the app does something
 * else, which this repo has shipped before.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'probe-319-gboard-output.txt');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

/* ---- the ReferenceError-following assembler, as the other suites use ---- */
function harness(src, want, optional) {
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
  (optional || []).forEach(add);
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

const H = harness(SRC,
  ['rowsForDisplay', 'getTableSchema', 'DERIVED_COLS', 'totalRowFlags',
   'isAnchoredTotalRowLabel', 'columnGrandTotals', 'bareNumber'], []);

/* ---- the board ------------------------------------------------------- */
const G = Object.keys(P.tables).filter(id => /^G\d+$/.test(id))
  .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

log('CLCPA-319 MEASUREMENT: the G board, every stored year');
log('app.js: ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

let multiTotal = 0, disagree = 0, yearCount = 0, tableCount = 0, noTotal = 0;
const disagreements = [];

G.forEach((id) => {
  const t = P.tables[id];
  const years = Object.keys(t.data || {}).sort();
  if (!years.length) return;
  tableCount++;
  const inScope = id !== 'G10';
  log('=== ' + id + (inScope ? '' : '   (G10: the declared counter-example, NOT in scope)'));

  const declared = H.attempt(api => (api.DERIVED_COLS[id] || []).map(d => d.type + '@' + d.column));
  log('    rules declared: ' + (declared.length ? declared.join(', ') : 'none'));

  years.forEach((y) => {
    yearCount++;
    const rows = t.data[y];
    const schema = H.attempt(api => api.getTableSchema(t, y));

    /* total rows two ways: by LABEL, which is what the rule uses, and by the
     * value-dependent classifier, which is what the rest of the page uses */
    const byLabel = [];
    rows.forEach((r, i) => {
      if (H.attempt(api => api.isAnchoredTotalRowLabel(r && r[0]))) byLabel.push(i);
    });
    const flags = H.attempt(api => api.totalRowFlags(rows, id, schema)) || [];
    const byFlag = [];
    flags.forEach((f, i) => { if (f) byFlag.push(i); });

    if (byLabel.length > 1) multiTotal++;

    /* the flat sum the rule computes, and the SEGMENTED sum the percentage
     * rule beside it would use -- executed through the app's own summer */
    const col = 1;
    const nonTotal = rows.filter((r, i) => byLabel.indexOf(i) < 0);
    const len = rows.reduce((m, r) => Math.max(m, (r || []).length), 0);
    const flat = H.attempt(api => api.columnGrandTotals(nonTotal, len).colSum)[col];

    const ti = byLabel.length ? byLabel[byLabel.length - 1] : -1;
    let seg = null;
    if (ti >= 0) {
      const prev = byLabel.filter(i => i < ti).pop();
      const from = (prev === undefined ? -1 : prev) + 1;
      const src = rows.filter((r, i) => i >= from && i < ti && byLabel.indexOf(i) < 0);
      if (src.length) seg = H.attempt(api => api.columnGrandTotals(src, len).colSum)[col];
    }

    const stored = ti >= 0 ? (rows[ti] || [])[col] : null;
    const storedNum = H.attempt(api => api.bareNumber(stored));

    /* and what the REPORT PAGE now shows for that cell */
    const disp = H.attempt(api => api.rowsForDisplay(rows, schema, id, { fillTotals: true }));
    const shown = ti >= 0 ? (disp[ti] || [])[col] : null;

    /* THREE outcomes, not two. A year with no total row has nothing to agree
     * or disagree about, and calling that a disagreement is how a measurement
     * reports a defect that is not there -- the first cut of this script did
     * exactly that and named G1:2023 and G1:2024 as mismatches. */
    let verdict;
    if (ti < 0) verdict = 'NO TOTAL ROW';
    else if (storedNum === null) verdict = 'NO FIGURE FILED';
    else if (flat === null) verdict = 'NO ROWS TO SUM';
    else if (Math.abs(storedNum - flat) < 1e-9) verdict = 'identical';
    else { verdict = 'DISAGREE'; }
    if (inScope && verdict === 'DISAGREE') { disagree++; disagreements.push(id + ':' + y); }
    if (verdict === 'NO TOTAL ROW' || verdict === 'NO FIGURE FILED') noTotal++;

    log('    ' + y +
        '  totalRows(label)=' + JSON.stringify(byLabel) +
        ' (flag)=' + JSON.stringify(byFlag) +
        '  filed=' + JSON.stringify(stored) +
        '  rowsSum=' + JSON.stringify(flat) +
        '  segSum=' + JSON.stringify(seg) +
        '  shown=' + JSON.stringify(shown) +
        '  ' + verdict +
        (seg !== null && flat !== null && Math.abs(seg - flat) > 1e-9 ? '  SEGMENT DIFFERS' : ''));
  });
  log('');
});

log('--- summary -----------------------------------------------------------');
log('  G tables with stored years: ' + tableCount + ', table-years: ' + yearCount);
log('  table-years with MORE THAN ONE total row by label: ' + multiTotal);
log('  table-years with NO total row or no figure filed in it: ' + noTotal);
log('  in-scope (G1 to G9) table-years where a filed figure and its row sum');
log('  DISAGREE: ' + disagree + (disagreements.length ? '  ' + JSON.stringify(disagreements) : ''));
log('');
log('  Read this with the rule: where they disagree the kept-figure guardian');
log('  holds the FILED value, so a disagreement is a disclosed data question,');
log('  never a republished figure.');

fs.writeFileSync(OUT, lines.join('\n') + '\n');
