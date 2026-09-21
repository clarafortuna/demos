/* CLCPA-302 round 2 acceptance: a recompute is not the operator's edit.
 *
 * The ruling: "engine-recomputed cells that persist are either excluded
 * from the operator's count or recorded DISTINCTLY (a recompute entry,
 * never an EDIT attributed to the person); the confirm count matches the
 * operator's own cells; consistent across stored and stripped tables".
 * This build takes exclusion, through one shared reader both surfaces ask.
 *
 * BASE is the pre-change commit and is pinned. The post-change side reads
 * the working tree (or DAC_APP_OVERRIDE), because mut_302_r2 drives it.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-302-r2-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || '8bf5ea7';
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  PASS  ' + m); } else { fail++; log('  FAIL  ' + m); } };
const guard = (label, fn) => {
  try { fn(); } catch (e) { fail++; log('  FAIL  ' + label + ' threw: ' + (e && e.message)); }
};

/* a doc comment quoting the old code satisfies a search for the old code,
 * so every structural pin below reads this, not the raw source */
function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

function harness(src, want) {
  const L = src.split('\r\n');
  const TOP = [];
  L.forEach((ln, n) => {
    const m = /^ {2}(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([L.length]);
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

/* diffRows builds its classifier inside its OWN try/catch and falls back to
 * "every cell counts" -- which IS the defect. An unresolved dependency
 * therefore does not fail, it silently reproduces the bug on both sides and
 * the suite goes green on a lie. These are the names that fallback ate. */
const WANT = ['totalRowFlags', 'DERIVED_COLS', 'HIERARCHICAL_TABLES',
  'isAnchoredTotalRowLabel', 'detectSumColumns', 'detectPctColumns',
  'detectAvgColumns', 'columnNumericMask', 'detectCurrencyColumns',
  'DERIVED_ROWS', 'INGEST_KEY_COLS', 'ingestOperatorCell',
  'diffRows', 'ingestComputed', 'ingestKeyColCount', 'getTableSchema',
  'recomputeTotals', 'recomputeDerivableSums', 'stripDerivedForPersist',
  'isB7PreparerTotal', 'PERSIST_STRIP_TABLES', 'unreconciledTotals',
  'totalRowSums', 'columnGrandTotals', 'bareNumber', 'withinSourceRounding',
  'applyDerivedCols', 'sumDerivedCols', 'derivedCellWrite', 'applyDerivedRows',
  'addsOnlyPrecision', 'storedDecimals', 'isDeclaredSummable',
  'unreconciledDerivedRows', 'SUMMABLE_COLS', 'derivedRowValue',
  'derivedRowKeepsStored'];
const NEW = harness(SRC, WANT), OLD = harness(BASE_SRC, WANT);

/* the CONFIRM COUNT is cut out of openSaveDialog and evaluated, never
 * retyped: the rule under test is the one the operator reads */
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

/* one operator gesture: the edit, the two writes the editor runs, the save */
function gesture(H, counter, tableId, schema, stored, edits) {
  return H.attempt((api) => {
    const base = stored.map(r => r.slice());
    const draft = stored.map(r => r.slice());
    edits.forEach(([row, col, to]) => {
      const before = draft[row].slice();
      draft[row][col] = to;
      api.recomputeDerivableSums(draft, schema, tableId, row, before, col);
    });
    api.recomputeTotals(draft, schema, tableId, base);
    const savedOld = api.stripDerivedForPersist(base.map(r => r.slice()), tableId, schema);
    const savedNew = api.stripDerivedForPersist(draft.map(r => r.slice()), tableId, schema);
    const all = api.diffRows(savedOld, savedNew, schema, tableId)
      .filter(c => c.kind === 'cell');
    return {
      stored: savedNew,
      dialog: counter(api, draft, base, tableId, schema),
      cells: all.map(c => c.rowLabel + ' / ' + c.colLabel),
    };
  });
}

log('CLCPA-302 round 2: a recompute is not the operator\'s edit');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

let dialogNew = null, dialogOld = null;
guard('X  the confirm count can be cut out of both builds', () => {
  dialogNew = dialogCounter(SRC);
  dialogOld = dialogCounter(BASE_SRC);
  ok(!!dialogNew && !!dialogOld, 'X1 openSaveDialog\'s change count extracted from both builds');
});

/* ---- A. the harness is running the real classifier ------------------ */
log('');
log('A. THE HARNESS IS RUNNING THE REAL CLASSIFIER');
guard('A  classifier liveness', () => {
  const s = NEW.attempt(api => api.getTableSchema(P.tables.A1, '2025'));
  const rows = P.tables.A1.data['2025'];
  const t1 = rows.findIndex(r => String(r[0]).trim().toLowerCase() === 'total');
  const after = rows.map(r => r.slice());
  after[t1] = after[t1].slice();
  after[t1][1] = Number(after[t1][1] || 0) + 7;
  const blind = NEW.attempt(api => api.diffRows(rows, after, s, null)
    .filter(c => c.kind === 'cell').length);
  const seeing = NEW.attempt(api => api.diffRows(rows, after, s, 'A1')
    .filter(c => c.kind === 'cell').length);
  ok(blind === 1, 'A1 without a tableId the total row counts: ' + blind);
  ok(seeing === 0, 'A2 with one it does not: ' + seeing);

  /* ingestOperatorCell swallows a marksInTemplate that throws, so a missing
   * dependency would read as "this cell is the operator's". Ask the
   * accessor DIRECTLY, outside that catch, or the guard above proves only
   * half of the rule. */
  const b2s = NEW.attempt(api => api.getTableSchema(P.tables.B2, '2098'));
  const marks = NEW.attempt(api => api.ingestComputed(
    [['DAC', 50, 10, 0, 60], ['Non-DAC', 100, 40, 0, 140], ['Total', 150, 50, 0, 200]],
    'B2', b2s).marksInTemplate(1, b2s.indexOf('Total Plugs')));
  ok(marks === true, 'A3 marksInTemplate answers on a B2 body row: ' + marks);
});

/* ---- B. one reader, asked by both surfaces -------------------------- */
log('');
log('B. ONE READER, ASKED BY BOTH SURFACES');
guard('B  structure', () => {
  const code = codeOnly(SRC);
  ok(/function ingestOperatorCell\(computed, keyCols, r, c\)/.test(code),
    'B1 ingestOperatorCell is declared');
  ok(/const operatorCell = \(r, c\) => ingestOperatorCell\(computed, keyCols, r, c\);/
    .test(code), 'B2 diffRows delegates to it');

  const at = code.indexOf('const changeCount = (() => {');
  const block = code.slice(at, at + 1200);
  ok(/if \(!ingestOperatorCell\(computed, keyCols, r, c\)\) continue;/.test(block),
    'B3 the confirm count asks it too');
  ok(!/if \(c < keyCols\) continue;/.test(block) && !/if \(computed\.any\(r, c\)\) continue;/.test(block),
    'B4 and keeps no copy of the rule of its own');

  /* the copies are gone from the CALLERS; the one reader holds them */
  const fn = code.slice(code.indexOf('function ingestOperatorCell'));
  ok(/if \(c < keyCols\) return false;/.test(fn.slice(0, 700)),
    'B5 the key-cell exclusion lives in the reader');
  ok(/if \(computed\.any\(r, c\)\) return false;/.test(fn.slice(0, 700)),
    'B6 so does the engine-cell exclusion');
  ok(/marksInTemplate\(r, c\)\) return false;/.test(fn.slice(0, 700)),
    'B7 and the derivability exclusion this round adds');
  ok(/if \(!computed\) return true;/.test(fn.slice(0, 700)),
    'B8 no classifier still means every cell counts, the safe direction');
});

/* ---- C. the ruling's gesture ---------------------------------------- */
const B2S = NEW.attempt(api => api.getTableSchema(P.tables.B2, '2098'));
/* B2's schema is YEAR-DEPENDENT: four columns in 2023 and 2024, five from
 * 2025, and 2098 resolves to the five-column one. The first cut of this
 * bench pinned the 2023 shape, which reproduces the defect but is not the
 * anatomy the ruling's gesture runs on -- the browser rendered five
 * columns against a four-wide seed and the total column sat empty. Same
 * year, same width, same figures as the ticket, on both surfaces. */
const B2_STORED = [['DAC', 50, 10, 0, 60], ['Non-DAC', 97, 40, 0, 137],
  ['Total', 147, 50, 0, 197]];
const G1S = NEW.attempt(api => api.getTableSchema(P.tables.G1, '2025'));
const G1_STORED = [['Feet Replaced within DAC', 9999, null],
  ['Feet Replaced not in a DAC', 999, null], ['Systemwide Total', 10998, null]];

log('');
log('C. THE RULING\'S GESTURE: B2/2098 Non-DAC L2 Plugs 97 -> 100');
guard('C  B2 now', () => {
  const r = gesture(NEW, dialogNew, 'B2', B2S, B2_STORED, [[1, 1, 100]]);
  ok(r.dialog === 1, 'C1 the confirm says 1 cell change: ' + r.dialog);
  ok(r.cells.length === 1, 'C2 the history records one entry: ' + r.cells.length);
  /* the WHOLE list, not cells[0]: an entry appended after the operator's
   * own leaves a first-element check green, and mutation 3 is exactly that
   * shape -- it is how this assertion was caught being weak */
  ok(r.cells.join('|') === 'Non-DAC / L2 Plugs',
    'C3 and it is the operator\'s own cell, alone: ' + JSON.stringify(r.cells));
  ok(!r.cells.some(c => /Total Plugs/.test(c)),
    'C4 the recompute is not billed to them');
});

/* the guard has to fail on the bug, or it is not guarding anything */
guard('D  B2 on the pre-change build', () => {
  const r = gesture(OLD, dialogOld, 'B2', B2S, B2_STORED, [[1, 1, 100]]);
  ok(r.dialog === 2, 'D1 BASE ' + BASE + ' confirms 2 cell changes: ' + r.dialog);
  ok(r.cells.length === 2, 'D2 BASE records two entries: ' + r.cells.length);
  ok(r.cells.some(c => c === 'Non-DAC / Total Plugs'),
    'D3 BASE bills the recompute to the operator: ' + JSON.stringify(r.cells));
});

/* ---- E. consistent across stored and stripped ----------------------- */
log('');
log('E. CONSISTENT ACROSS STORED AND STRIPPED TABLES');
guard('E  G1, the other side of the strip', () => {
  ok(NEW.attempt(api => api.PERSIST_STRIP_TABLES.has('G1')) === true,
    'E1 G1 is in PERSIST_STRIP_TABLES');
  ok(NEW.attempt(api => api.PERSIST_STRIP_TABLES.has('B2')) === false,
    'E2 B2 is not, by the CLCPA-303 ruling');
  const n = gesture(NEW, dialogNew, 'G1', G1S, G1_STORED, [[0, 1, 500]]);
  const o = gesture(OLD, dialogOld, 'G1', G1S, G1_STORED, [[0, 1, 500]]);
  ok(n.dialog === 1 && n.cells.length === 1,
    'E3 G1 now: dialog ' + n.dialog + ', history ' + n.cells.length);
  ok(o.dialog === 1 && o.cells.length === 1,
    'E4 G1 on BASE: dialog ' + o.dialog + ', history ' + o.cells.length);
  ok(n.dialog === o.dialog && n.cells.join('|') === o.cells.join('|'),
    'E5 a stripped table is untouched by this change');
});

/* ---- F. the operator's own cells are all still counted -------------- */
log('');
log('F. THE COUNT MATCHES THE OPERATOR\'S OWN CELLS, NO MORE AND NO LESS');
guard('F  two real edits', () => {
  const r = gesture(NEW, dialogNew, 'B2', B2S, B2_STORED, [[1, 1, 100], [0, 2, 25]]);
  ok(r.dialog === 2, 'F1 two operator edits confirm as 2: ' + r.dialog);
  ok(r.cells.length === 2, 'F2 and record two entries: ' + r.cells.length);
  ok(!r.cells.some(c => /Total Plugs/.test(c)),
    'F3 with neither recompute among them: ' + JSON.stringify(r.cells));
  const o = gesture(OLD, dialogOld, 'B2', B2S, B2_STORED, [[1, 1, 100], [0, 2, 25]]);
  ok(o.dialog === 4 && o.cells.length === 4,
    'F4 BASE billed the same two edits as 4: ' + o.dialog + ' / ' + o.cells.length);
});

/* ---- G. no figure moves --------------------------------------------- */
log('');
log('G. NO FIGURE MOVES: THIS CHANGES WHO A WRITE IS BILLED TO');
guard('G  value identity', () => {
  [['B2', B2S, B2_STORED, [[1, 1, 100]]], ['G1', G1S, G1_STORED, [[0, 1, 500]]]]
    .forEach(([t, sch, stored, edits], k) => {
      const n = JSON.stringify(gesture(NEW, dialogNew, t, sch, stored, edits).stored);
      const o = JSON.stringify(gesture(OLD, dialogOld, t, sch, stored, edits).stored);
      ok(n === o, 'G' + (k + 1) + ' ' + t + ' persists identical rows on both builds');
    });
});

log('');
log(pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
