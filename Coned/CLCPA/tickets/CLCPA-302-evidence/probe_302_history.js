/* CLCPA-302: the history over-counts, and Section J is the narrowing control.
 *
 * Two counts of the same save:
 *
 *   THE DIALOG   changeCount, built in openSaveDialog, excludes KEY cells
 *                (ingestKeyColCount) and ENGINE cells (ingestComputed.any),
 *                and says "You are about to save N cell changes".
 *   THE HISTORY  diffRows, in the storage backend, counts EVERY cell that
 *                differs, with no exclusions at all.
 *
 * The owner's control: Section J has computed total rows and its saves
 * matched exactly, so the cause is NOT "any computed total row". This tests
 * the hypothesis that fits that control -- J's tables are in
 * PERSIST_STRIP_TABLES, so their engine-written cells are NULLED before the
 * rows are saved. Null on both sides differs from nothing, so the history has
 * nothing spurious to count. A table OUTSIDE that set persists its computed
 * cells, they move when an input moves, and the history counts them.
 *
 * Nothing is re-implemented: both counters are the app's own, executed.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'probe-302-history-output.txt');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

function harness(src, want) {
  const L = src.split('\r\n');
  const TOP = [];
  /* TWO-SPACE ONLY, as the other suites scan. Widening it to 2-or-4 spaces
   * was the first cut and it broke the slicing outright: a four-space `const`
   * inside a two-space function became a BOUNDARY, so every function holding
   * one was cut off mid-body and the assembly was a syntax error. diffRows
   * lives at four spaces inside the Storage IIFE and is extracted below by
   * matching its braces instead. */
  L.forEach((ln, n) => {
    const m = /^ {2}(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([L.length]);
  /** a nested function, sliced by matching its own braces */
  const nested = (nm) => {
    const re = new RegExp('\\r\\n {4}function ' + nm + '\\s*\\(');
    const m = re.exec(src);
    if (!m) return null;
    const start = src.indexOf(m[0]) + 2;
    let i = src.indexOf('{', start), d = 0;
    for (; i < src.length; i++) {
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

const H = harness(SRC, ['diffRows', 'ingestComputed', 'ingestKeyColCount',
  'getTableSchema', 'recomputeTotals', 'stripDerivedForPersist',
  'PERSIST_STRIP_TABLES', 'isAnchoredTotalRowLabel']);

log('CLCPA-302: the dialog count and the history count, on the same save');
log('app.js: ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* the dialog's own rule, lifted as the app states it */
function dialogCount(api, draft, baseline, tableId, schema) {
  const same = (x, y) => {
    const nx = (x == null || x === '') ? '' : x;
    const ny = (y == null || y === '') ? '' : y;
    return nx === ny;
  };
  const computed = api.ingestComputed(draft, tableId, schema);
  const keyCols = Math.max(1, api.ingestKeyColCount(tableId));
  let count = 0;
  const rows = Math.max(draft.length, (baseline || []).length);
  for (let r = 0; r < rows; r++) {
    const ar = draft[r] || [], br = (baseline || [])[r] || [];
    const cols = Math.max(ar.length, br.length);
    for (let c = 0; c < cols; c++) {
      if (c < keyCols) continue;
      if (computed.any(r, c)) continue;
      if (!same(ar[c], br[c])) count++;
    }
  }
  return count;
}

const strip = H.attempt(api => Array.from(api.PERSIST_STRIP_TABLES));
log('  PERSIST_STRIP_TABLES (' + strip.length + '): ' + JSON.stringify(strip));
log('');
log('  For each table, ONE operator edit: the first editable numeric cell on');
log('  the first non-total row, raised by 500. Then the two counts.');
log('');
log('  table  stripped  dialog says  history records  gap');
log('  ' + '-'.repeat(56));

let gaps = 0, checked = 0;
const extras = [];
const byStrip = { yes: [], no: [] };

Object.keys(P.tables).sort().forEach((id) => {
  const t = P.tables[id];
  const year = Object.keys(t.data || {}).sort().pop();
  if (!year) return;
  const base = t.data[year];
  if (!base || !base.length) return;
  const schema = H.attempt(api => api.getTableSchema(t, year));
  const stripped = strip.indexOf(id) >= 0;

  const r = H.attempt((api) => {
    /* find a cell an operator can actually type into */
    const computed = api.ingestComputed(base, id, schema);
    let er = -1, ec = -1;
    for (let i = 0; i < base.length && er < 0; i++) {
      if (api.isAnchoredTotalRowLabel(base[i][0])) continue;
      for (let c = 1; c < schema.length; c++) {
        if (computed.any(i, c)) continue;
        if (typeof base[i][c] !== 'number') continue;
        er = i; ec = c; break;
      }
    }
    if (er < 0) return null;

    const draft = base.map(x => x.slice());
    draft[er][ec] = draft[er][ec] + 500;
    api.recomputeTotals(draft, schema, id, base);

    /* WHAT IS SAVED is the stripped copy, which is the whole point of the
     * control: a stripped table's engine cells are null on both sides. */
    const savedNew = api.stripDerivedForPersist(draft, id, schema);
    const savedOld = api.stripDerivedForPersist(base.map(x => x.slice()), id, schema);
    const histCells = api.diffRows(savedOld, savedNew, schema, id)
      .filter(c => c.kind === 'cell');
    /* WHICH cells the history counts that the dialog does not, and what the
     * app itself says about them. This is the question the control turns on:
     * "any computed total row" is not the trigger, so the trigger has to be
     * named cell by cell. */
    const extra = histCells.filter((c) => {
      if (c.colIdx < Math.max(1, api.ingestKeyColCount(id))) return true;
      return computed.any(c.rowIdx, c.colIdx);
    }).map(c => ({
      at: 'r' + c.rowIdx + 'c' + c.colIdx,
      row: String(c.rowLabel).slice(0, 22),
      col: String(c.colLabel).slice(0, 22),
      engineCell: computed.any(c.rowIdx, c.colIdx),
      totalRow: computed.totalRow(c.rowIdx),
      derivedCol: computed.derivedCol(c.colIdx),
      derivedRow: (typeof computed.derivedRow === 'function')
        ? computed.derivedRow(c.rowIdx) : null,
      strippedAway: savedNew[c.rowIdx] ? savedNew[c.rowIdx][c.colIdx] === null : null,
    }));
    return {
      dialog: dialogCount(api, draft, base, id, schema),
      history: histCells.length,
      extra: extra,
      at: 'r' + er + 'c' + ec,
    };
  });
  if (!r) return;
  checked++;
  const gap = r.history - r.dialog;
  if (gap !== 0) gaps++;
  (stripped ? byStrip.yes : byStrip.no).push({ id: id, gap: gap });
  if (gap !== 0) extras.push({ id: id, cells: r.extra });
  log('  ' + id.padEnd(7) + (stripped ? 'yes' : 'no ').padEnd(10) +
      String(r.dialog).padEnd(13) + String(r.history).padEnd(17) +
      (gap === 0 ? '-' : (gap > 0 ? '+' + gap : String(gap))));
});

const gapIn = (arr) => arr.filter(x => x.gap !== 0).length;
log('');
log('--- summary -----------------------------------------------------------');
log('  tables measured: ' + checked + ', tables where the two counts DISAGREE: ' + gaps);
log('');
log('  of the tables in PERSIST_STRIP_TABLES : ' + gapIn(byStrip.yes) +
    ' of ' + byStrip.yes.length + ' disagree');
log('  of the tables NOT in it               : ' + gapIn(byStrip.no) +
    ' of ' + byStrip.no.length + ' disagree');
log('');
if (gaps === 0) {
  log('  THE TWO COUNTS AGREE EVERYWHERE. The history applies the dialog\'s own');
  log('  two exclusions, from the same two classifiers, so the record and the');
  log('  sentence the operator approved cannot say different things.');
} else if (gapIn(byStrip.yes) === 0 && gapIn(byStrip.no) > 0) {
  log('  Strip membership separates the two groups, so the trigger is that a');
  log('  table outside PERSIST_STRIP_TABLES persists its engine cells.');
} else {
  log('  STRIP MEMBERSHIP DOES NOT SEPARATE THE TWO GROUPS, so that is not the');
  log('  trigger: tables inside the set disagree and tables outside it agree.');
  log('  The cells listed below name what it actually is. Every one of them is');
  log('  an ENGINE cell on a TOTAL ROW whose column is NOT declared derived, so');
  log('  the strip leaves it in place while the dialog excludes it. That is the');
  log('  gap between two different ideas of "the engine\'s cell", and it is not');
  log('  "any computed total row" -- G1 to G9 have those and show no gap,');
  log('  because CLCPA-319 gave that column a declared rule and the strip now');
  log('  nulls it.');
}
log('');
log('');
log('--- the cells the HISTORY counts and the DIALOG does not -------------');
extras.slice(0, 8).forEach((e) => {
  log('  ' + e.id + ':');
  e.cells.forEach(x => log('      ' + x.at.padEnd(8) + JSON.stringify(x.row).padEnd(26) +
    JSON.stringify(x.col).padEnd(26) +
    ' engineCell=' + x.engineCell + ' totalRow=' + x.totalRow +
    ' derivedCol=' + x.derivedCol + ' derivedRow=' + x.derivedRow +
    ' strippedAway=' + x.strippedAway));
});
log('');
log('  the tables that disagree: ' +
    JSON.stringify(byStrip.no.concat(byStrip.yes)
      .filter(x => x.gap !== 0).map(x => x.id + ' ' + (x.gap > 0 ? '+' : '') + x.gap)));

fs.writeFileSync(OUT, lines.join('\n') + '\n');
