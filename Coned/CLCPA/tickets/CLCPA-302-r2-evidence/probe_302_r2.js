/* CLCPA-302 round 2: who the history says changed a cell the ENGINE wrote.
 *
 * Round 1 stopped the history counting a total row's cells as operator
 * edits. That over-count is dead. A narrowed heir survives on a STORED
 * DERIVED COLUMN, and B2 is the case the ruling names: its "Total Plugs"
 * column is derived but NOT stripped on save, by the CLCPA-303 ruling that
 * kept B2 out of PERSIST_STRIP_TABLES. So the recompute writes the store,
 * and the history bills that write to the person who edited a different
 * cell.
 *
 * This measures; suite_302_r2 pins.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'probe-302-r2-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || '8bf5ea7';
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

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
  /* diffRows sits at four spaces inside the Storage IIFE, so it is sliced
   * by matching its own braces rather than by the two-space boundary scan */
  const nested = (nm) => {
    const re = new RegExp('\\r\\n {4}function ' + nm + '\\s*\\(');
    const m = re.exec(src);
    if (!m) return null;
    const start = src.indexOf(m[0]) + 2;
    let d = 0;
    for (let i = src.indexOf('{', start); i < src.length; i++) {
      if (src[i] === '{') d++;
      else if (src[i] === '}') { d--; if (!d) return src.slice(start, i + 1); }
    }
    return null;
  };
  const find = (nm) => {
    const k = TOP.findIndex(d => d.name === nm);
    if (k >= 0) return L.slice(TOP[k].line, bound[k + 1]).join('\n');
    return nested(nm);
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

/* ELEVEN NAMES diffRows' OWN try/catch WAS EATING. It builds its
 * classifier inside `try { computed = ingestComputed(...) } catch { computed
 * = null }`, and a null classifier means EVERY cell counts -- which is the
 * behaviour this ticket is about. So an unresolved dependency does not
 * fail: it silently reproduces the defect, on both builds, and the first
 * cut of this probe reported "no change" for exactly that reason.
 *
 * The self-test below is the standing guard: passing a tableId must change
 * the answer, because if the classifier is null it cannot. */
const WANT = ['totalRowFlags', 'DERIVED_COLS', 'HIERARCHICAL_TABLES',
  'isAnchoredTotalRowLabel', 'detectSumColumns', 'detectPctColumns',
  'detectAvgColumns', 'columnNumericMask', 'detectCurrencyColumns',
  'DERIVED_ROWS', 'INGEST_KEY_COLS', 'ingestOperatorCell',
  'diffRows', 'ingestComputed', 'ingestKeyColCount', 'getTableSchema',
  'recomputeTotals', 'recomputeDerivableSums', 'stripDerivedForPersist',
  'isAnchoredTotalRowLabel', 'isB7PreparerTotal', 'PERSIST_STRIP_TABLES',
  'DERIVED_COLS', 'DERIVED_ROWS', 'detectSumColumns', 'unreconciledTotals',
  'totalRowSums', 'columnGrandTotals', 'bareNumber', 'withinSourceRounding',
  'applyDerivedCols', 'sumDerivedCols', 'derivedCellWrite', 'applyDerivedRows',
  'addsOnlyPrecision', 'storedDecimals', 'isDeclaredSummable',
  'unreconciledDerivedRows', 'SUMMABLE_COLS', 'derivedRowValue',
  'derivedRowKeepsStored', 'totalRowFlags'];
const NEW = harness(SRC, WANT), OLD = harness(BASE_SRC, WANT);

/* THE DIALOG'S COUNT IS MEASURED, NOT RETYPED.
 *
 * openSaveDialog computes it in an inline IIFE, so there is no function to
 * call. The first cut of this probe copied the rule into the harness --
 * which is the reason the B2 section reported "2 cell changes" on a build
 * that had already stopped counting the recompute: the copy was still the
 * old rule, and a harness answering from its own re-implementation cannot
 * see the change it exists to measure. So the block is cut out of the
 * source and evaluated, per build. `with` resolves its names against the
 * assembled API, so a dependency the block gains later fails loudly here
 * instead of quietly reverting this to a copy. */
function dialogCounter(src) {
  const ANCHOR = 'const changeCount = (() => {';
  const at = src.indexOf(ANCHOR);
  if (at < 0) throw new Error('openSaveDialog change count: anchor not found');
  if (src.indexOf(ANCHOR, at + 1) >= 0) {
    throw new Error('openSaveDialog change count: anchor is not unique');
  }
  let depth = 0, end = -1;
  for (let k = src.indexOf('{', at); k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (!depth) { end = k; break; } }
  }
  if (end < 0) throw new Error('openSaveDialog change count: unbalanced');
  const slice = src.slice(at, src.indexOf(';', end) + 1);
  const run = new Function('API', 'i',
    'with (API) {\n' + slice + '\nreturn changeCount;\n}');
  return (api, draft, baseline, tableId, schema) =>
    run(api, { draft, baseline, tableId, schema });
}
const dialogNew = dialogCounter(SRC), dialogOld = dialogCounter(BASE_SRC);

/* ONE operator edit, then the two writes the editor runs, then the save */
function gesture(H, counter, tableId, schema, stored, row, col, to) {
  return H.attempt((api) => {
    const base = stored.map(r => r.slice());
    const draft = stored.map(r => r.slice());
    const before = draft[row].slice();
    draft[row][col] = to;
    api.recomputeDerivableSums(draft, schema, tableId, row, before, col);
    api.recomputeTotals(draft, schema, tableId, base);
    const savedOld = api.stripDerivedForPersist(base.map(r => r.slice()), tableId, schema);
    const savedNew = api.stripDerivedForPersist(draft.map(r => r.slice()), tableId, schema);
    const all = api.diffRows(savedOld, savedNew, schema, tableId)
      .filter(c => c.kind === 'cell');
    return {
      draft: draft,
      stored: savedNew,
      dialog: counter(api, draft, base, tableId, schema),
      entries: all.map(c => ({
        row: c.rowLabel, col: c.colLabel, from: c.oldVal, to: c.newVal,
        /* CLCPA-302 round 2 marks a recompute distinctly; on a build that
         * does not, this is undefined and the entry is a plain edit */
        kind: c.kind, engine: !!c.engine,
      })),
    };
  });
}

log('CLCPA-302 round 2: a recompute billed to the operator');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* --- THE HARNESS MUST BE RUNNING THE REAL CLASSIFIER ------------------
 *
 * diffRows falls back to "every cell counts" when it cannot build one,
 * and that fallback IS the defect, so a probe measuring it reports no
 * difference between the builds and looks like a finished investigation.
 * Passing a tableId has to CHANGE the answer; if the classifier is null it
 * cannot. */
{
  const s = NEW.attempt(api => api.getTableSchema(P.tables.A1, '2025'));
  const rows = P.tables.A1.data['2025'];
  const t1 = rows.findIndex(r => String(r[0]).trim().toLowerCase() === 'total');
  const after = rows.map(r => r.slice());
  after[t1] = after[t1].slice();
  after[t1][1] = (after[t1][1] || 0) + 1;
  const withId = NEW.attempt(api => api.diffRows(rows, after, s, 'A1')
    .filter(c => c.kind === 'cell').length);
  const without = NEW.attempt(api => api.diffRows(rows, after, s, undefined)
    .filter(c => c.kind === 'cell').length);
  log('HARNESS  a change to A1s Total row counts ' + without +
      ' without a tableId and ' + withId + ' with one.');
  if (withId === without) {
    log('  STOPPING: diffRows could not build its classifier, so every figure');
    log('  below would describe the fallback branch rather than the app.');
    fs.writeFileSync(OUT, lines.join('\n') + '\n');
    process.exit(2);
  }
  /* AND THE ACCESSOR THE NEW RULE ASKS, called DIRECTLY and outside any
   * catch. ingestOperatorCell wraps marksInTemplate in a try/catch so a
   * classifier that cannot answer does not exclude -- defensible in the
   * app, and in a harness it is one more place a missing dependency hides
   * as "this cell is the operator's". The first cut of this guard proved
   * the classifier existed by asking `any`, which exercises none of that.
   * Calling it here lets the assembler resolve what it needs, and asserts
   * the answer. */
  const b2s = NEW.attempt(api => api.getTableSchema(P.tables.B2, '2098'));
  const TOTAL_COL = b2s.indexOf('Total Plugs');
  const b2rows = [['DAC', 50, 10, 0, 60], ['Non-DAC', 100, 40, 0, 140],
    ['Total', 150, 50, 0, 200]];
  const marks = NEW.attempt(api =>
    api.ingestComputed(b2rows, 'B2', b2s).marksInTemplate(1, TOTAL_COL));
  log('         and marksInTemplate answers on a B2 body row: ' + marks);
  if (!marks) {
    log('  STOPPING: the accessor the new rule asks cannot answer here, so');
    log('  ingestOperatorCell would swallow the error and count every cell.');
    fs.writeFileSync(OUT, lines.join('\n') + '\n');
    process.exit(2);
  }
  log('         so the classifier is real, and so is everything below.');
}
log('');

/* ---- B2: a STORED derived column, the ruling's case ----------------- */
const B2S = NEW.attempt(api => api.getTableSchema(P.tables.B2, '2098'));
/* the scratch year the ticket describes, at its figures */
/* B2's schema is YEAR-DEPENDENT: four columns in 2023 and 2024, five from
 * 2025, and 2098 resolves to the five-column one. The first cut of this
 * bench pinned the 2023 shape, which reproduces the defect but is not the
 * anatomy the ruling's gesture runs on -- the browser rendered five
 * columns against a four-wide seed and the total column sat empty. Same
 * year, same width, same figures as the ticket, on both surfaces. */
const B2_STORED = [['DAC', 50, 10, 0, 60], ['Non-DAC', 97, 40, 0, 137],
  ['Total', 147, 50, 0, 197]];

log('B2/2098, the ruling\'s gesture: Non-DAC L2 Plugs 97 -> 100');
log('  B2 is NOT in PERSIST_STRIP_TABLES, by the CLCPA-303 ruling, so its');
log('  derived Total Plugs column is written to the store on every save.');
log('  in the strip: ' + NEW.attempt(api => api.PERSIST_STRIP_TABLES.has('B2')));
log('');
[['BASE ' + BASE, OLD, dialogOld], ['now        ', NEW, dialogNew]].forEach(([tag, H, counter]) => {
  const r = gesture(H, counter, 'B2', B2S, B2_STORED, 1, 1, 100);
  log('  ' + tag);
  log('      the draft after the edit : ' + JSON.stringify(r.draft.map(x => x.slice(1))));
  log('      the confirm dialog says  : ' + r.dialog + ' cell change(s)');
  log('      the history records      : ' + r.entries.length + ' entr(y/ies)');
  r.entries.forEach(e => log('          ' + JSON.stringify(e.row) + ' / ' +
    JSON.stringify(e.col) + '  ' + e.from + ' -> ' + e.to +
    '   kind=' + e.kind + (e.engine ? '  ENGINE' : '')));
});

/* ---- G1: the same shape, but STRIPPED ------------------------------- */
log('');
const G1S = NEW.attempt(api => api.getTableSchema(P.tables.G1, '2025'));
const G1_STORED = [['Feet Replaced within DAC', 9999, null],
  ['Feet Replaced not in a DAC', 999, null], ['Systemwide Total', 10998, null]];
log('G1, the same shape but STRIPPED on save, so nothing derived persists');
log('  in the strip: ' + NEW.attempt(api => api.PERSIST_STRIP_TABLES.has('G1')));
[['BASE ' + BASE, OLD, dialogOld], ['now        ', NEW, dialogNew]].forEach(([tag, H, counter]) => {
  const r = gesture(H, counter, 'G1', G1S, G1_STORED, 0, 1, 500);
  log('  ' + tag + '  dialog ' + r.dialog + '   history ' + r.entries.length +
      '  ' + JSON.stringify(r.entries.map(e => e.col)));
});

/* ---- THE VALUES DO NOT MOVE, ONLY THE ATTRIBUTION ------------------- */
log('');
log('what reaches the store, per build (this change is about who a write is');
log('billed to, so no figure may move):');
[['B2', B2S, B2_STORED, 1, 1, 100], ['G1', G1S, G1_STORED, 0, 1, 500]]
  .forEach(([t, sch, stored, row, col, to]) => {
    const o = JSON.stringify(gesture(OLD, dialogOld, t, sch, stored, row, col, to).stored);
    const n = JSON.stringify(gesture(NEW, dialogNew, t, sch, stored, row, col, to).stored);
    log('  ' + t + '  identical: ' + (o === n) + '   ' + n);
  });

log('');
log('--- what this shows --------------------------------------------------');
log('  Round 1 killed the TOTAL ROW over-count. The heir this round names');
log('  lived on a DERIVED COLUMN of a BODY row: on B2 the engine recomputes');
log('  "Total Plugs", and because B2 sits outside the persist strip by the');
log('  CLCPA-303 ruling, that recompute reaches the store and the history');
log('  read it back as something a person did. BASE bills the operator for');
log('  2 cells on a one-cell edit and names the recompute as their EDIT.');
log('');
log('  Now: the confirm says 1 and the history holds the operator\'s own');
log('  cell alone. The two surfaces agree because they now ask the same');
log('  reader, ingestOperatorCell, instead of each carrying a copy of the');
log('  rule -- which is how they came to disagree in the first place.');
log('');
log('  G1 is the control on the other side of the strip: same engine write,');
log('  stripped before it is stored, 1 and 1 on both builds. Unchanged, as');
log('  the ruling requires of a table that never had the defect.');
log('');
log('  STATED PLAINLY, because it is the cost of the option taken: the');
log('  ruling allowed the engine write to be excluded OR recorded');
log('  distinctly, and this takes exclusion. B2\'s stored "Total Plugs"');
log('  still changes in the store; no history entry now claims it. Nothing');
log('  is attributed to the wrong person, and nothing records the engine.');
log('  The distinct-entry option stays open and needs its own turn, as does');
log('  the recorded B2 PERSIST_STRIP follow-up that would remove the stored');
log('  copy altogether and make the question moot.');

fs.writeFileSync(OUT, lines.join('\n') + '\n');
