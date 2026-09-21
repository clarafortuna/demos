/* CLCPA-319: G1 through G9's total row is COMPUTED, not stored.
 *
 * WHAT THE TICKET IS. The percentage rule on these tables already divides by
 * the sum of the two rows above the total -- that sum IS the total row's
 * figure, built on every render and thrown away while the row printed whatever
 * was stored. The stored figure is not wrong today; it is a SECOND SOURCE OF
 * TRUTH, kept in step only by the one surface that maintains it, and the
 * repo's central rule is that no computable figure gets a stored copy.
 *
 * REPRODUCED IN A BROWSER FIRST, on both builds (repro_319.js):
 *   shipped  persists ["Systemwide Total", 530538, null]
 *   fix      persists ["Systemwide Total", null,   null]
 * with the operator's own 302,384 intact on both and the page printing
 * 530,538 on both.
 *
 * THREE OF THESE ASSERTIONS EXIST BECAUSE THE BROWSER FOUND A DEFECT THAT A
 * GREEN SWEEP DID NOT, and they are the reason this file is not just a
 * restatement of the rule:
 *
 *   S-STRIP  saving nulled the operator's typed figure. The probe leaves a
 *            columnTotal's source rows populated so the rule has something to
 *            sum, so on those rows the "rebuilt" value is the operator's own
 *            figure and the strip loop nulled it. Every suite was green.
 *   S-FMT    the total cell rendered a bare 430538 beneath rows rendering
 *            202,384: the rule carries no `decimals`, so toFixed(undefined)
 *            ran. CLCPA-271's defect, one rule type later.
 *   S-PCT    making the quantity column derived hid it from the arithmetic
 *            confirmation, nothing confirmed the total, it re-entered the
 *            column sum and every G percentage halved to 50%.
 *
 * Pins: DAC_BASE_COMMIT, DAC_APP_OVERRIDE.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-319-output.txt');

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

/* ---- assemble the real functions, following ReferenceErrors -------------- */
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

const WANT = ['rowsForDisplay', 'getTableSchema', 'DERIVED_COLS', 'totalRowFlags',
  'isAnchoredTotalRowLabel', 'columnGrandTotals', 'bareNumber',
  'stripDerivedForPersist', 'isTotalOnlyDerived', 'fmtDerivedCell',
  'applyDerivedCols', 'PERSIST_STRIP_TABLES', 'recomputeTotals'];
const NEW = harness(SRC, WANT);

const G9 = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9'];
const yearsOf = (id) => Object.keys((P.tables[id] || {}).data || {}).sort();

log('CLCPA-319: the G total row computes');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ===================== R: the rule is declared ========================== */
say('=== R. the rule, and what it is declared as =========================');
guard('R: declaration', () => {
  const types = {};
  G9.concat(['G10']).forEach(id => {
    types[id] = NEW.attempt(api => (api.DERIVED_COLS[id] || []).map(d => d.type).sort().join('+'));
  });
  ok(G9.every(id => types[id] === 'columnTotal+percentage'),
     'R1 G1 to G9 each declare a columnTotal beside the percentage: ' +
     JSON.stringify(types));
  ok(types.G10 === 'percentage',
     'R2 and G10 does NOT, which is the counter-example the ticket names: ' + types.G10);

  const col = NEW.attempt(api => (api.DERIVED_COLS.G1 || []).find(d => d.type === 'columnTotal'));
  ok(col && col.column === 1, 'R3 it is declared on the QUANTITY column, not the percentage');
  ok(col && col.keepFiled === true,
     'R4 with keepFiled ON, so a filed total the rows do not reproduce is kept and named');

  ok(NEW.attempt(api => api.isTotalOnlyDerived({ type: 'columnTotal' })) === true,
     'R5 a columnTotal is TOTAL-ONLY: the column is source data on every other row');
  ok(NEW.attempt(api => api.isTotalOnlyDerived({ type: 'percentage' })) === false,
     'R6 while a percentage is not, so the two are not conflated');
});

/* ===================== V: value identity ================================= */
say('');
say('=== V. value identity, every stored G year ==========================');
guard('V: no published figure moves', () => {
  /* THE CLAIM IS ABOUT THE COLUMN THIS TICKET TOUCHES, and the first cut of
   * this assertion was not. It compared every cell and went red on the
   * PERCENTAGE column, where the stored 0.47 is a rounded copy and the engine
   * has always rendered the exact ratio -- behaviour that predates this ticket
   * by many waves. Widening the tolerance would have hidden the real claim;
   * naming the column keeps it. */
  let checked = 0, moved = [], computed = 0, totalYears = 0;
  G9.forEach(id => {
    yearsOf(id).forEach(y => {
      const rows = P.tables[id].data[y];
      const schema = NEW.attempt(api => api.getTableSchema(P.tables[id], y));
      const disp = NEW.attempt(api => api.rowsForDisplay(rows, schema, id, { fillTotals: true }));
      rows.forEach((r, i) => {
        checked++;
        const a = JSON.stringify(r[1]), b = JSON.stringify(disp[i] ? disp[i][1] : undefined);
        if (a !== b) moved.push(id + ':' + y + ' r' + i + ' ' + a + ' -> ' + b);
        if (NEW.attempt(api => api.isAnchoredTotalRowLabel(r[0]))) {
          totalYears++;
          if (typeof (disp[i] || [])[1] === 'number') computed++;
        }
      });
    });
  });
  ok(checked === 67, 'V1 the G1 to G9 quantity column rendered: ' + checked + ' cells');
  ok(moved.length === 0,
     'V2 and NOT ONE of them moves: ' + JSON.stringify(moved.slice(0, 6)));
  /* 21, not 23: G1 files no total row at all for 2023 or 2024, so there are
   * 21 total rows across the 23 in-scope table-years. Measured by
   * probe_319_gboard.js, which prints all 26 including G10's three. */
  ok(totalYears === 21 && computed === 21,
     'V3 and all 21 in-scope total-row quantities are produced BY the engine: ' +
     computed + ' of ' + totalYears);
});

/* ===================== S: the three the browser found =================== */
say('');
say('=== S. the three defects a green sweep did not see ==================');

guard('S-STRIP: saving must not eat the operator figure', () => {
  const id = 'G1', y = '2025';
  const rows = P.tables[id].data[y].map(r => r.slice());
  /* the operator corrects the DAC quantity, exactly as the browser repro does */
  rows[0][1] = 302384;
  rows[2][1] = 530538;
  const schema = NEW.attempt(api => api.getTableSchema(P.tables[id], y));
  const kept = NEW.attempt(api => api.stripDerivedForPersist(rows, id, schema));

  ok(kept[0][1] === 302384,
     'S-STRIP-1 the typed 302,384 SURVIVES the save: ' + JSON.stringify(kept[0][1]));
  ok(kept[1][1] === 228154,
     'S-STRIP-2 and so does the untouched non-DAC figure: ' + JSON.stringify(kept[1][1]));
  ok(kept[2][1] === null,
     'S-STRIP-3 while the TOTAL is nulled, so no stored copy is kept: ' +
     JSON.stringify(kept[2][1]));
  ok(kept[0][2] === null && kept[1][2] === null,
     'S-STRIP-4 the percentage column is still stripped on every row, as before');
  /* and the round trip: what is persisted must render back to what was saved */
  const back = NEW.attempt(api => api.rowsForDisplay(kept, schema, id, { fillTotals: true }));
  ok(back[2][1] === 530538,
     'S-STRIP-5 and the stripped rows RENDER the total back: ' + JSON.stringify(back[2][1]));
});

guard('S-FMT: a column total is a quantity, not a ratio', () => {
  const d = NEW.attempt(api => (api.DERIVED_COLS.G1 || []).find(x => x.type === 'columnTotal'));
  const shown = NEW.attempt(api => api.fmtDerivedCell(430538, d, false));
  ok(shown === '430,538',
     'S-FMT-1 430538 renders as 430,538, the way the cells above it render: ' +
     JSON.stringify(shown));
  const money = NEW.attempt(api => api.fmtDerivedCell(430538, d, true));
  ok(money === '$430,538',
     'S-FMT-2 and it follows the COLUMN when the column is money: ' + JSON.stringify(money));
  const pctRule = NEW.attempt(api => (api.DERIVED_COLS.G1 || []).find(x => x.type === 'percentage'));
  ok(NEW.attempt(api => api.fmtDerivedCell(0.47, pctRule, false)) === '47.00%',
     'S-FMT-3 while a percentage is untouched, so the branch is narrow');
  /* BOTH surfaces, which is the CLCPA-271 lesson: the renderer and the
   * refresher each formatted for themselves and disagreed after a blur */
  const code = codeOnly(SRC);
  /* the DECLARATION is not a call site, and the first cut of this counted it */
  const calls = (code.match(/(?:function\s+)?fmtDerivedCell\([^)]*\)/g) || [])
    .filter(s => !/^function/.test(s));
  /* RE-PINNED 2 -> 3 for CLCPA-310 round 2, which sends a DECLARED DERIVED
   * ROW's cell through this same formatter: that row's rule carries its own
   * type and precision, and formatting it by column rendered D3's share as a
   * bare "0" with no percent sign. The property asserted is unchanged and is
   * the CLCPA-271 lesson itself -- EVERY call site passes the column money
   * flag, so no two of them can disagree about what the column is. A new call
   * site that forgot it still turns this red. */
  ok(calls.length === 3 && calls.every(s => /,\s*currencyCol\[/.test(s)),
     'S-FMT-4 and EVERY call site passes the column money flag: ' + JSON.stringify(calls));
});

guard('S-PCT: the percentages did not halve', () => {
  let bad = [];
  G9.forEach(id => {
    yearsOf(id).forEach(y => {
      const rows = P.tables[id].data[y];
      const schema = NEW.attempt(api => api.getTableSchema(P.tables[id], y));
      const disp = NEW.attempt(api => api.rowsForDisplay(rows, schema, id, { fillTotals: true }));
      disp.forEach((r, i) => {
        if (!NEW.attempt(api => api.isAnchoredTotalRowLabel(r[0]))) return;
        if (typeof r[2] === 'number' && Math.abs(r[2] - 1) > 1e-9) bad.push(id + ':' + y + '=' + r[2]);
      });
    });
  });
  ok(bad.length === 0,
     'S-PCT-1 every G total row still shows 100%, not 50%: ' + JSON.stringify(bad));
  /* the cause, pinned directly: the confirmer must NOT skip this type */
  const code = codeOnly(SRC);
  ok(/\.filter\(d => d\.type !== 'columnTotal'\)/.test(code),
     'S-PCT-2 because totalRowFlags excludes columnTotal from its skip set');
});

/* ===================== C: the classifier trap =========================== */
say('');
say('=== C. the classifier may not gate the value it reads ===============');
guard('C: identification is by label', () => {
  const id = 'G1', y = '2025';
  const base = P.tables[id].data[y].map(r => r.slice());
  const draft = base.map(r => r.slice());
  const schema = NEW.attempt(api => api.getTableSchema(P.tables[id], y));
  /* DOUBLE the DAC row, which is the gesture that broke the first cut: the
   * filed 430,538 now matches nothing, so the ARITHMETIC confirmation stops
   * calling row 2 a total at all. This is the EDITOR path, which is where an
   * operator's edit actually lands and the only path handed a baseline. */
  draft[0][1] = 404768;
  const flags = NEW.attempt(api => api.totalRowFlags(draft, id, schema)) || [];
  NEW.attempt(api => api.recomputeTotals(draft, schema, id, base));
  ok(draft[2][1] === 404768 + 228154,
     'C1 the total recomputes to ' + (404768 + 228154) +
     ' after an edit its own filed figure no longer matches: ' + JSON.stringify(draft[2][1]));
  ok(draft[2][1] !== 1063460,
     'C2 and the total row is NOT swallowed into its own sum (1,063,460 was the first cut)');
  ok(flags.every(f => !f),
     'C3 while the arithmetic confirmation calls NONE of those rows a total, ' +
     'which is exactly why the rule does not ask it: ' + JSON.stringify(flags));
});

/* ===================== G: the guardian ================================== */
say('');
say('=== G. the kept-figure guardian, intact =============================');
guard('G: a filed figure the rows do not reproduce is kept', () => {
  const id = 'G1', y = '2025';
  const rows = P.tables[id].data[y].map(r => r.slice());
  /* a filed total that the rows do not make, with NO edit to the inputs --
   * the G10/2024 shape, which is the one this guardian exists for */
  rows[2][1] = 999999;
  const schema = NEW.attempt(api => api.getTableSchema(P.tables[id], y));
  const disp = NEW.attempt(api => api.rowsForDisplay(rows, schema, id, { fillTotals: true }));
  ok(disp[2][1] === 999999,
     'G1 an unreproduced filed total is KEPT, not quietly republished: ' +
     JSON.stringify(disp[2][1]));
  const kept = NEW.attempt(api => api.stripDerivedForPersist(rows, id, schema));
  ok(kept[2][1] === 999999,
     'G2 and the save REFUSES to strip it, so it cannot be deleted: ' +
     JSON.stringify(kept[2][1]));
  /* AND THE TWO PATHS DIFFER, deliberately, which is worth stating plainly
   * because it is the whole behavioural contract of keepFiled:
   *
   *   rowsForDisplay  (the report page) hands applyDerivedCols NO baseline,
   *                   so nothing counts as an input change and a filed figure
   *                   the rows do not reproduce is published AS FILED.
   *   recomputeTotals (the editor) hands it the pre-edit rows, so an operator
   *                   correcting an input sees the total follow.
   *
   * That is why no published figure can move on this build, and it is also
   * the limit of the claim: the report page does not silently correct a
   * disagreement, it preserves it. G10/2024 is the live example. */
  const edited = rows.map(r => r.slice());
  edited[0][1] = 302384;
  NEW.attempt(api => api.recomputeTotals(edited, schema, id, rows));
  ok(edited[2][1] === 302384 + 228154,
     'G3 but an operator EDIT recomputes it on the editor path, or CLCPA-241s ' +
     'stale cell comes straight back: ' + JSON.stringify(edited[2][1]));
  const stillFiled = NEW.attempt(api => {
    const e2 = rows.map(r => r.slice());
    e2[0][1] = 302384;
    return api.rowsForDisplay(e2, schema, id, { fillTotals: true })[2][1];
  });
  ok(stillFiled === 999999,
     'G4 while the REPORT path, which has no baseline, still publishes the ' +
     'filed figure: ' + JSON.stringify(stillFiled));
});

/* ===================== X: what this did NOT touch ======================= */
say('');
say('=== X. the exclusions ================================================');
guard('X: G10 and the other sections', () => {
  const rows = P.tables.G10.data['2024'];
  const schema = NEW.attempt(api => api.getTableSchema(P.tables.G10, '2024'));
  const disp = NEW.attempt(api => api.rowsForDisplay(rows, schema, 'G10', { fillTotals: true }));
  ok(disp[2][1] === 241.2279,
     'X1 G10/2024 still publishes its filed 241.2279 against rows summing 241.22: ' +
     JSON.stringify(disp[2][1]));
  const strip = NEW.attempt(api => api.PERSIST_STRIP_TABLES);
  ok(strip.has('G1') && strip.has('G10'),
     'X2 the persist strip covers the G board as it already did');
  /* RE-POINTED. The claim that matters is that the rule is built in ONE
   * place, and it still is: one factory, one 'columnTotal' type. What has
   * changed is the number of tables handed it -- CLCPA-303 declares B2's
   * column-wise total row with the same factory, which is the reuse this
   * ticket's design was for. The call sites are enumerated rather than
   * counted, so a silent widening to a table neither ticket names fails. */
  const callers = (codeOnly(SRC).match(/^ +(?:const \w+ = )?\[?colTotal\(|\bcolTotal\(\d\)/gm) || []);
  const decl = codeOnly(SRC).match(/^\s+(\w+): \[colTotal\(1\), colTotal\(2\), colTotal\(3\), colTotal\(4\)\],/m);
  ok(codeOnly(SRC).indexOf("type: 'columnTotal'") > 0 &&
     (codeOnly(SRC).match(/const colTotal = /g) || []).length === 1,
     'X3 the rule is still built in ONE place: one factory, one type');
  ok(!!decl && decl[1] === 'B2',
     'X3b and the only table besides the G board handed it is B2, under ' +
     'CLCPA-303: ' + (decl ? decl[1] : '(none)'));
  ok((codeOnly(SRC).match(/gPct = \[colTotal\(1\)/g) || []).length === 1,
     'X3c while the G board still takes it exactly once, through gPct');
});

guard('X: the baseline', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X4 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: ROOT }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'X5 and HEAD descends from it');
  ok(SRC !== BASE_SRC, 'X6 and the two sources genuinely differ');
  ok(codeOnly(BASE_SRC).indexOf("'columnTotal'") < 0,
     'X7 while BASE has no columnTotal at all, so this suite cannot pass on it');
});

say('');
log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
if (fail) process.exit(1);
