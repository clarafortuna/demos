/* CLCPA-305 and CLCPA-306: the reconciliation advisory, measured.
 *
 *   305: the page and the Confirm-save dialog report different counts.
 *   306: the advisory counts a figure the ENGINE computed as one the operator
 *        filed.
 *
 * Both are about the same list. The advisory says "Does not add up: N rows",
 * and N is what this measures on each surface.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'probe-305-306-output.txt');

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

const H = harness(SRC, ['reconcileSumColumns', 'getTableSchema', 'detectSumColumns',
  'ingestComputed', 'totalRowFlags', 'isAnchoredTotalRowLabel', 'recomputeTotals']);

log('CLCPA-305 / CLCPA-306: the reconciliation advisory');
log('app.js: ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ===================================================================== */
log('=======================================================================');
log('CLCPA-306: whose figure is the advisory counting?');
log('=======================================================================');
log('');
log('  The advisory says "the filed value is kept; check which figure is');
log('  right", which is a sentence about a figure a PERSON filed. It walks');
log('  every row, and a TOTAL ROW is a row the engine computes.');
log('');

/* WHICH TABLES CAN RAISE ONE AT ALL. The first cut of this probe picked A5
 * for its scenario, and A5 has no total-headed column: detectSumColumns
 * returned nothing, the edit landed on column `undefined`, and both surfaces
 * reported 0 of 0. A measurement that cannot produce the thing it measures
 * agrees with itself. */
const withSums = [];
Object.keys(P.tables).sort().forEach((tid) => {
  const t = P.tables[tid];
  Object.keys(t.data || {}).sort().forEach((yr) => {
    const rows = t.data[yr];
    if (!rows || !rows.length) return;
    const sch = H.attempt(api => api.getTableSchema(t, yr));
    const rel = H.attempt(api => api.detectSumColumns(sch, rows, tid));
    if (!rel.length) return;
    const tot = rows.findIndex(r => H.attempt(api => api.isAnchoredTotalRowLabel(r[0])));
    withSums.push({ id: tid, year: yr, rel: rel[0], schema: sch, totalRow: tot });
  });
});
log('  table-years with a derivable total COLUMN, which is what this advisory');
log('  reconciles: ' + withSums.length);
log('    ' + JSON.stringify(withSums.slice(0, 10).map(w => w.id + ':' + w.year)));
log('');

let total = 0, onComputed = 0;
const computedOnes = [];
Object.keys(P.tables).sort().forEach((id) => {
  const t = P.tables[id];
  Object.keys(t.data || {}).sort().forEach((y) => {
    const rows = t.data[y];
    if (!rows || !rows.length) return;
    const schema = H.attempt(api => api.getTableSchema(t, y));
    const notices = H.attempt(api => api.reconcileSumColumns(rows, schema, id));
    if (!notices.length) return;
    const isEngineRow = H.attempt((api) => {
      const c = api.ingestComputed(rows, id, schema);
      return notices.map(n => ({
        n: n,
        /* the same two questions the rest of the app asks about a row */
        flagged: !!c.totalRow(n.rowIndex),
        role: !!api.isAnchoredTotalRowLabel(rows[n.rowIndex][0]),
        marked: c.marksInTemplate(n.rowIndex, 1),
      }));
    });
    isEngineRow.forEach((x) => {
      total++;
      if (x.flagged || x.role) {
        onComputed++;
        computedOnes.push(id + ':' + y + ' r' + x.n.rowIndex + ' ' +
          JSON.stringify(String(x.n.label).slice(0, 28)) +
          '  filed ' + x.n.filed + ' vs ' + x.n.computed +
          '  (arithmetic total: ' + x.flagged + ', total by role: ' + x.role + ')');
      }
    });
  });
});

log('  reconciliation notices on the payload AS FILED: ' + total);
log('  of those, ones landing on a row the app treats as a TOTAL: ' + onComputed);
log('');
if (computedOnes.length) {
  computedOnes.slice(0, 20).forEach(c => log('    ' + c));
  if (computedOnes.length > 20) log('    ... and ' + (computedOnes.length - 20) + ' more');
}
log('  Zero is the right answer for stored data and it is not the interesting');
log('  case: this advisory exists for a DRAFT. The question is what it says');
log('  when a row stops adding up, so the draft below is the one an operator');
log('  actually has in front of them.');
log('');

/* THE GESTURE THAT IS ACTUALLY REACHABLE.
 *
 * The first cut of this edited a part ON the total row, and that is not a
 * thing an operator can do: the total row renders as read-only calc cells and
 * the importer skips them. A scenario the UI forbids proves nothing.
 *
 * The reachable one is ordinary. B2's "Total Plugs" is NOT in DERIVED_COLS, so
 * on a DATA row it is an editable input. Type a wrong figure there, let the
 * editor recompute, and the TOTAL ROW's own cell moves with it: the engine
 * sums the Total Plugs COLUMN downward, while that row's L2 + DCFC is
 * untouched. The row then disagrees with itself, and the figure the advisory
 * calls "filed" is the one the engine just wrote. */
const sumT = withSums.find(w => w.totalRow >= 0);
if (sumT) {
  const rows = P.tables[sumT.id].data[sumT.year].map(r => r.slice());
  const dataRow = rows.findIndex((r, i) =>
    i !== sumT.totalRow && typeof r[sumT.rel.column] === 'number');
  log('  ' + sumT.id + ':' + sumT.year + '   total column ' +
      JSON.stringify(sumT.schema[sumT.rel.column]) + ', parts ' +
      JSON.stringify(sumT.rel.parts.map(c => sumT.schema[c])));
  log('      the operator types a wrong ' + JSON.stringify(sumT.schema[sumT.rel.column]) +
      ' on r' + dataRow + ' ' + JSON.stringify(String(rows[dataRow][0])) +
      ': ' + rows[dataRow][sumT.rel.column] + ' -> ' +
      (rows[dataRow][sumT.rel.column] + 500));
  rows[dataRow][sumT.rel.column] += 500;
  /* the editor recomputes on every edit, which is the step that moves the
   * total row's cell without anyone typing into it */
  H.attempt(api => api.recomputeTotals(rows, sumT.schema, sumT.id,
    P.tables[sumT.id].data[sumT.year]));
  log('      the editor recomputes, and the TOTAL row now reads ' +
      JSON.stringify(rows[sumT.totalRow]));
  const after = H.attempt(api => api.reconcileSumColumns(rows, sumT.schema, sumT.id));
  const onTotal = after.filter(n => n.rowIndex === sumT.totalRow);
  const onData = after.filter(n => n.rowIndex !== sumT.totalRow);
  log('');
  log('      the advisory raises ' + after.length + ' notice(s):');
  onData.forEach(n => log('        OPERATOR  ' + JSON.stringify(String(n.label)) +
    ' / ' + n.column + ': filed ' + n.filed + ', ' + n.parts.join(' + ') +
    ' = ' + n.computed));
  onTotal.forEach(n => log('        ENGINE    ' + JSON.stringify(String(n.label)) +
    ' / ' + n.column + ': filed ' + n.filed + ', ' + n.parts.join(' + ') +
    ' = ' + n.computed));
  log('');
  if (onTotal.length) {
    log('      THE SECOND ONE IS THE DEFECT. Its heading counts it among rows');
    log('      that "do not add up", and the sentence beneath reads "The filed');
    log('      value is kept; check which figure is right" -- but nobody filed');
    log('      ' + onTotal[0].filed + '. The engine wrote it one line earlier, out');
    log('      of the operator\'s own mistake on the row above. There is one');
    log('      wrong figure in this table and the advisory reports two.');
  } else {
    log('      ONE WRONG FIGURE, ONE NOTICE, and it names the row the operator');
    log('      actually typed into. The total row\'s cell is the engine\'s own');
    log('      column sum and is no longer counted as a figure someone filed.');
  }
  log('');
  log('      on the total row: ' + onTotal.length + ', on operator rows: ' + onData.length);
}

/* ===================================================================== */
log('');
log('=======================================================================');
log('CLCPA-305: the page and the dialog, counted side by side');
log('=======================================================================');
log('');
log('  The two surfaces do NOT ask the same question:');
log('');
log('    the page    renders r.reconcileNotices when an import produced any,');
log('                and those were computed from the CANDIDATE at import');
log('                time and stored on the result object.');
log('    the dialog  calls reconcileSumColumns(i.draft, ...) fresh, every');
log('                time it opens.');
log('');
log('  So they agree only while the draft has not been touched since the');
log('  import. This walks that sequence on a real table.');
log('');

/* A TABLE THAT CAN ACTUALLY RAISE ONE. Picked from the census above rather
 * than named by hand, so this scenario cannot quietly test nothing. */
const pick = withSums.find(w => w.rel.parts.length >= 1 &&
  P.tables[w.id].data[w.year].some(r => typeof r[w.rel.parts[0]] === 'number'));
let importNotices = [], draftNotices = [];
if (!pick) {
  log('  NO TABLE IN THE PAYLOAD HAS A DERIVABLE TOTAL COLUMN. Nothing to show.');
} else {
  const { id, year, schema, rel } = pick;
  /* the file arrives and its candidate is reconciled: this is what the page
   * stores on the result object and goes on rendering */
  const atImport = P.tables[id].data[year].map(r => r.slice());
  /* make the imported file itself disagree, so the page has something to say */
  const firstData = atImport.findIndex((r, i) =>
    typeof r[rel.parts[0]] === 'number' && i !== pick.totalRow);
  atImport[firstData][rel.column] = (atImport[firstData][rel.column] || 0) + 700;
  importNotices = H.attempt(api => api.reconcileSumColumns(atImport, schema, id));
  log('  ' + id + ':' + year + '  the imported file has one row that does not add');
  log('      up, so the candidate raises ' + importNotices.length + ' notice(s), and the');
  log('      page stores that list on the result object.');

  /* the operator then FIXES it in the draft, which is what an advisory is for */
  const draft = atImport.map(r => r.slice());
  draft[firstData][rel.column] = draft[firstData][rel.column] - 700;
  draftNotices = H.attempt(api => api.reconcileSumColumns(draft, schema, id));
  log('      the operator corrects that cell in the draft.');
  log('');
  log('      THE PAGE still shows the import-time list : ' + importNotices.length + ' row(s)');
  log('      THE DIALOG recomputes from the draft      : ' + draftNotices.length + ' row(s)');
  log('');
  log('      the two agree: ' + (importNotices.length === draftNotices.length));
  log('');
  log('      So the operator fixes the figure the advisory complained about,');
  log('      the page goes on reporting it, and the Confirm-save dialog says');
  log('      something different at the moment they commit.');
}

log('');
log('--- summary -----------------------------------------------------------');
log('  CLCPA-306: ' + onComputed + ' of ' + total + ' notices are raised against a row the');
log('             app itself computes, under a sentence that says the figure');
log('             was filed and asks the operator which one is right.');
log('  CLCPA-305: page ' + importNotices.length + ', dialog ' + draftNotices.length +
    ' on the same table after one edit.');

fs.writeFileSync(OUT, lines.join('\n') + '\n');
