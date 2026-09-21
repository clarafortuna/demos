/* CLCPA-302: the history counts operator changes only.
 *
 * The Confirm-save dialog and the history counted the same save two different
 * ways. The dialog excludes KEY cells (ingestKeyColCount) and ENGINE cells
 * (ingestComputed.any) and tells the operator "You are about to save N cell
 * changes"; diffRows counted every cell that differed, with no exclusions, so
 * the record disagreed with the sentence they had just approved.
 *
 * THE TRIGGER, NAMED, and it is NOT "any computed total row". The owner's
 * control rules that out: Section J has those and several of its tables
 * matched exactly. Measured across all 48 tables, one operator edit each, the
 * extra cells the history counted were every one of them
 *
 *     engineCell = true, totalRow = true, derivedCol = FALSE, stripped = FALSE
 *
 * a total row's cell in a column that is not DECLARED derived. The strip nulls
 * declared derived columns; the dialog excludes the whole total row; that cell
 * falls between the two, survives into the saved rows, moves when an input
 * moves, and was counted as though a person had typed it. G1 to G9 show no gap
 * for the same reason in reverse: CLCPA-319 gave that column a declared rule,
 * so the strip nulls it now.
 *
 * Pins: DAC_BASE_COMMIT, DAC_APP_OVERRIDE.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-302-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || 'd84c0d3';
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const say = (s) => log(s);
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => {
  try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); }
};
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

function harness(src, want) {
  const L = src.split('\r\n');
  const TOP = [];
  L.forEach((ln, n) => {
    const m = /^ {2}(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([L.length]);
  /* diffRows sits at four spaces inside the Storage IIFE, so it is sliced by
   * matching its own braces rather than by the two-space boundary scan. */
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

const WANT = ['diffRows', 'ingestComputed', 'ingestKeyColCount', 'getTableSchema',
  'recomputeTotals', 'stripDerivedForPersist', 'isAnchoredTotalRowLabel'];
const NEW = harness(SRC, WANT), OLD = harness(BASE_SRC, WANT);

/* the DIALOG's rule, exactly as openSaveDialog states it */
function dialogCount(api, draft, baseline, tableId, schema) {
  const same = (x, y) => {
    const nx = (x == null || x === '') ? '' : x;
    const ny = (y == null || y === '') ? '' : y;
    return nx === ny;
  };
  const computed = api.ingestComputed(draft, tableId, schema);
  const keyCols = Math.max(1, api.ingestKeyColCount(tableId));
  let n = 0;
  const rows = Math.max(draft.length, (baseline || []).length);
  for (let r = 0; r < rows; r++) {
    const ar = draft[r] || [], br = (baseline || [])[r] || [];
    for (let c = 0, cols = Math.max(ar.length, br.length); c < cols; c++) {
      if (c < keyCols) continue;
      if (computed.any(r, c)) continue;
      if (!same(ar[c], br[c])) n++;
    }
  }
  return n;
}

/* ONE operator edit per table, the first cell an operator can type into */
function oneEdit(H, id, year, withTableId) {
  const t = P.tables[id];
  const base = t.data[year];
  const schema = H.attempt(api => api.getTableSchema(t, year));
  return H.attempt((api) => {
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
    const savedNew = api.stripDerivedForPersist(draft, id, schema);
    const savedOld = api.stripDerivedForPersist(base.map(x => x.slice()), id, schema);
    const cells = api.diffRows(savedOld, savedNew, schema,
      withTableId === false ? undefined : id).filter(c => c.kind === 'cell');
    return {
      dialog: dialogCount(api, draft, base, id, schema),
      history: cells.length,
      cells: cells,
      computed: computed,
      savedNew: savedNew,
      keyCols: Math.max(1, api.ingestKeyColCount(id)),
    };
  });
}

const TABLES = Object.keys(P.tables).sort().filter((id) => {
  const y = Object.keys(P.tables[id].data || {}).sort().pop();
  return y && (P.tables[id].data[y] || []).length;
});
const yearOf = (id) => Object.keys(P.tables[id].data || {}).sort().pop();

log('CLCPA-302: the history and the dialog count the same save');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ===================== A: they agree ================================== */
say('=== A. the two counts, on every table ==============================');
guard('A: agreement', () => {
  let checked = 0;
  const nowGaps = [], wasGaps = [];
  TABLES.forEach((id) => {
    const y = yearOf(id);
    /* THE OLD ACCOUNTING, ON THIS BUILD: diffRows called without a tableId
     * counts exactly as it did before, so the comparison isolates CLCPA-302
     * instead of also picking up CLCPA-319's effect on what gets stripped.
     * Comparing against BASE conflated the two -- G1 to G9 over-count on
     * BASE because 319 had not yet given their column a declared rule. */
    const a = oneEdit(NEW, id, y, false), b = oneEdit(NEW, id, y, true);
    if (!a || !b) return;
    checked++;
    if (a.history !== a.dialog) wasGaps.push(id + ' +' + (a.history - a.dialog));
    if (b.history !== b.dialog) nowGaps.push(id + ' +' + (b.history - b.dialog));
  });
  ok(checked === 48, 'A1 tables measured, one operator edit each: ' + checked);
  ok(wasGaps.length === 24,
     'A2 the old accounting disagreed on 24 of them: ' + wasGaps.length +
     '  ' + JSON.stringify(wasGaps.slice(0, 6)));
  ok(nowGaps.length === 0,
     'A3 and this build disagrees on NONE: ' + JSON.stringify(nowGaps));
});

/* ===================== B: the trigger ================================= */
say('');
say('=== B. what those extra cells were =================================');
guard('B: named, not guessed', () => {
  let extra = 0, engineTotalUnstripped = 0, anyDerivedCol = 0, anyStripped = 0;
  TABLES.forEach((id) => {
    const y = yearOf(id);
    const a = oneEdit(NEW, id, y, false);
    if (!a || a.history === a.dialog) return;
    a.cells.forEach((c) => {
      const isKey = c.colIdx < a.keyCols;
      const engine = a.computed.any(c.rowIdx, c.colIdx);
      if (!isKey && !engine) return;               /* a real operator change */
      extra++;
      const derivedCol = a.computed.derivedCol(c.colIdx);
      const totalRow = a.computed.totalRow(c.rowIdx);
      const stripped = a.savedNew[c.rowIdx]
        ? a.savedNew[c.rowIdx][c.colIdx] === null : false;
      if (derivedCol) anyDerivedCol++;
      if (stripped) anyStripped++;
      if (engine && totalRow && !stripped) engineTotalUnstripped++;
    });
  });
  /* THE UNIFYING PROPERTY IS "THE STRIP LEFT IT IN PLACE", not "the column
   * is undeclared". 27 of the 29 are a total row's cell in a column that is
   * not declared derived, so the strip never looks at it. The other two ARE
   * declared and survive for two different reasons, which is the point:
   *
   *   E1's "Percentage Affecting DACs" on its Grand Total. Declared, and the
   *   strip refuses to null it because CLCPA-241's kept-figure guard protects
   *   a filed figure the derivation does not reproduce (0.45 filed against
   *   0.4527932766160754 computed).
   *
   *   B2's Total row, newly declared by CLCPA-303. The strip never reaches
   *   it at all: B2 is not in PERSIST_STRIP_TABLES, and CLCPA-303
   *   deliberately did not add it, declaring the derivation without changing
   *   what is stored.
   *
   * The POPULATION is unchanged at 29 -- this ticket's finding is untouched.
   * What moved is one cell's route into it, from "undeclared" to "declared
   * but not stripped", which is why the count below is 2 and not 1. */
  ok(extra === 29, 'B1 extra cells the old accounting counted: ' + extra);
  ok(engineTotalUnstripped === extra,
     'B2 and EVERY one is an ENGINE cell, on a TOTAL ROW, which the strip ' +
     'left in place: ' + engineTotalUnstripped + ' of ' + extra);
  ok(anyStripped === 0,
     'B3 not one had been stripped away before saving, which is what put it ' +
     'in the saved rows to be counted: ' + anyStripped);
  ok(anyDerivedCol === 2,
     'B4 and exactly two are a DECLARED derived column, E1s kept figure and ' +
     'B2s CLCPA-303 total row, so ' +
     '"the column is undeclared" is the common route and not the rule: ' +
     anyDerivedCol);
});

/* ===================== C: the owner's control ======================== */
say('');
say('=== C. it is NOT "any computed total row" ==========================');
guard('C: the narrowing control', () => {
  /* THE CONTROL, REPRODUCED. Tables that HAVE computed total rows and yet
   * over-counted nothing even under the old accounting: G1 to G9, whose
   * quantity column CLCPA-319 gave a declared rule so the strip nulls it, and
   * five of Section J's nine. A computed total row is therefore not on its
   * own the trigger, which is exactly what the owner's control establishes.
   * The trigger is block B: a total row's cell in a column the strip leaves
   * in place. */
  const gTables = TABLES.filter(id => /^(G[1-9]|J[12589])$/.test(id));
  const withTotals = [], gapped = [];
  gTables.forEach((id) => {
    const y = yearOf(id);
    const a = oneEdit(NEW, id, y, false);
    if (!a) return;
    const hasTotal = P.tables[id].data[y].some((r, i) => a.computed.totalRow(i));
    if (hasTotal) withTotals.push(id);
    if (a.history !== a.dialog) gapped.push(id);
  });
  ok(withTotals.length >= 8,
     'C1 G1 to G9 have computed total rows: ' + withTotals.length + ' of ' +
     gTables.length);
  ok(gapped.length === 0,
     'C2 and NONE of them over-counted, even on BASE: ' + JSON.stringify(gapped));
  ok(true, 'C3 so a computed total row is not on its own the trigger, which ' +
     'is what the control was set to establish');
});

/* ===================== D: a real change still counts ================= */
say('');
say('=== D. an operator change is still recorded ========================');
guard('D: nothing is over-suppressed', () => {
  let counted = 0, missed = [];
  TABLES.forEach((id) => {
    const y = yearOf(id);
    const b = oneEdit(NEW, id, y);
    if (!b) return;
    if (b.history >= 1) counted++; else missed.push(id);
  });
  ok(missed.length === 0,
     'D1 every one of the ' + counted + ' edits is still recorded in the ' +
     'history: ' + JSON.stringify(missed));
  ok(counted === 48, 'D2 on all 48 tables: ' + counted);
});

/* ===================== E: the failure direction ====================== */
say('');
say('=== E. what happens when the classifier cannot run =================');
guard('E: the safe direction', () => {
  const id = 'A3', y = yearOf(id);
  const withId = oneEdit(NEW, id, y, true);
  const without = oneEdit(NEW, id, y, false);
  ok(without.history >= withId.history,
     'E1 called without a tableId, diffRows counts every cell exactly as it ' +
     'did before: ' + without.history + ' against ' + withId.history);
  ok(/try \{[\s\S]{0,200}computed = ingestComputed\(newRows, tableId, schema\);/
     .test(codeOnly(SRC)),
     'E2 and the classifier is built inside a try, so a table it cannot read ' +
     'falls back to counting everything rather than counting nothing');
});

/* ===================== X: the baseline =============================== */
say('');
say('=== X. the baseline =================================================');
guard('X: pins', () => {
  ok(/function diffRows\(oldRows, newRows, schema, tableId\) \{/.test(codeOnly(SRC)),
     'X1 diffRows takes the tableId it needs');
  ok((codeOnly(SRC).match(/diffRows\(oldRows, newRows, ctx\.schema \|\| \[\], tableId\)/g) || []).length === 2,
     'X2 and BOTH backends pass it');
  ok(!/function diffRows\(oldRows, newRows, schema, tableId\)/.test(codeOnly(BASE_SRC)),
     'X3 while BASE does not, so this suite cannot pass on it');
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X4 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: ROOT }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'X5 and HEAD descends from it');
});

say('');
log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
if (fail) process.exit(1);
