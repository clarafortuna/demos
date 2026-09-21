/* CLCPA-241 + CLCPA-289, option (B): kept-figure semantics.
 *
 * THE COMPLAINT. A9's "% Change" pair was stored text that nothing recomputed,
 * so editing an underlying count left the percentage stale. Twenty cells.
 *
 * THE RULING. Register the rule and compute the EIGHTEEN cells whose stored
 * figures the derivation reproduces, where value identity holds. KEEP the two
 * it does not reproduce, as filed, and NAME them in the amber advisory rather
 * than republishing them. applyDerivedCols gains the kept-figure conditional
 * and must never overwrite a stored cell unconditionally. 289 ships with it:
 * (calculated) markers that tell the truth because the app now computes.
 *
 * THE TWO CELLS, both in A9/2024:
 *   "Energy Savings (MMBtu)"             filed 8%   the rows give 33.362%
 *   "Average Incentive per Participant"  filed 62%  the rows give 62.500%
 * The first is not rounding. Both are data questions for Con Edison, and
 * recomputing either would resolve that question by accident.
 *
 * THE TRAP THIS SUITE EXISTS TO HOLD SHUT. A conditional that keeps a filed
 * figure cannot, on its own, tell "the source disagrees with its own rows"
 * from "the operator just edited one of those rows": after an edit the
 * derivation stops reproducing the filed figure in exactly the same way. The
 * first implementation did exactly that and reinstated the stale cell 241
 * exists to remove. Only the BASELINE separates them, which is CLCPA-144
 * Tier 3's rule. Block H drives it.
 *
 * Pins: DAC_BASE_COMMIT, DAC_APP_OVERRIDE.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const KIT = path.join(ROOT, 'Coned/CLCPA/tickets/_kit');
const { boot } = require(path.join(KIT, 'live_editor.js'));
const { templateRows, dense } = require(path.join(KIT, 'xlsx_read.js'));

const BASE = process.env.DAC_BASE_COMMIT || 'aca5faf';
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => { try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); } };
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

function grabFn(n, src) {
  const a = '\r\n  function ' + n + '(';
  const i = src.indexOf(a);
  if (i < 0) return null;
  let j = src.indexOf('{', i), d = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) { j = k; break; } }
  }
  return src.slice(i + 2, j + 1);
}
function grabConst(n, src) {
  const m = new RegExp('\\r\\n  (?:const|var|let) ' + n + '\\s*=').exec(src);
  if (!m) return null;
  let i = m.index + 2, d = 0, started = false, j = i;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (c === '{' || c === '[' || c === '(') { d++; started = true; }
    else if (c === '}' || c === ']' || c === ')') { d--; }
    else if (c === ';' && (!started || d === 0)) { j = k; break; }
  }
  return src.slice(i, j + 1);
}

/* Dependencies resolved by FOLLOWING ReferenceErrors at construct AND call
 * time. The call-time half is not optional here: recomputeTotals only reaches
 * its unreconciled branch when a BASELINE is passed, so a null-baseline
 * warm-up leaves that branch's dependencies unresolved and the suite throws
 * from inside block H rather than answering. */
const ENTRY = ['applyDerivedCols', 'recomputeTotals', 'rowsForDisplay',
  'stripDerivedForPersist', 'totalRowFlags', 'columnGrandTotals', 'getTableSchema',
  'fmtDerivedCell'];
/* Exist only in the CHANGED source, so they are exported behind a typeof guard
 * and the BASE side reports null. Required entries here would make BASE fail to
 * assemble at all, which reads as a broken suite rather than as the absence
 * block A is asserting. */
const OPTIONAL = ['derivedCellWrite', 'derivedFiledReproduced', 'derivedPctCols',
  'unreconciledDerivedCols', 'renderKeptFigureNotice'];
function buildEnv(src, tag) {
  const fns = ENTRY.concat(OPTIONAL.filter(n => grabFn(n, src)));
  const consts = [];
  for (let it = 0; it < 400; it++) {
    const body = '"use strict";\n' +
      'const state = { payload: PAYLOAD, seedYears: (PAYLOAD.meta.years||[]).map(String) };\n' +
      'const console = { warn(){}, info(){}, log(){}, error(){} };\n' +
      'const document = { getElementById: () => null, querySelector: () => null,' +
      ' querySelectorAll: () => [] };\n' +
      consts.map(n => grabConst(n, src)).join('\n') + '\n' +
      fns.map(n => grabFn(n, src)).join('\n') + '\n' +
      'return {' + ENTRY.join(',') + ', DERIVED_COLS, PERSIST_STRIP_TABLES, ' +
      OPTIONAL.map(n => n + ': (typeof ' + n + ' === "function" ? ' + n + ' : null)').join(',') + '};';
    let cand;
    try { cand = new Function('PAYLOAD', body)(P); }
    catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) throw new Error(tag + ' shell: ' + e.message);
      if (grabFn(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm, src) && consts.indexOf(nm) < 0) { consts.push(nm); continue; }
      throw new Error(tag + ' cannot resolve ' + nm);
    }
    try {
      const s = P.tables.A9.schema_by_year['2025'];
      const r = () => P.tables.A9.data['2025'].map(x => x.slice());
      cand.rowsForDisplay(r(), s, 'A9');
      cand.recomputeTotals(r(), s, 'A9', null);
      cand.recomputeTotals(r(), s, 'A9', r());      /* WITH a baseline */
      cand.stripDerivedForPersist(r(), 'A9', s);
      if (cand.unreconciledDerivedCols) {
        cand.unreconciledDerivedCols(r(), 'A9', s);
        /* and the advisory, so escapeHtml resolves: it is reached only from
         * inside the renderer and never raises at construct time. */
        cand.renderKeptFigureNotice(cand.unreconciledDerivedCols(A9('2024'), 'A9', S9('2024')));
      }
      /* OTHER TABLE SHAPES TOO. Block D sweeps every table with a rule, and a
       * hierarchical one reaches classifier code A9 never does: driving A9
       * alone left isAnchoredTotalRowLabel unresolved and D threw mid-loop
       * instead of answering. */
      ['A5', 'A1', 'G1', 'J3', 'E1'].forEach((id) => {
        const t = P.tables[id];
        if (!t) return;
        Object.keys(t.data || {}).forEach((yy) => {
          const rows = (t.data[yy] || []).map(x => x.slice());
          const sc = (t.schema_by_year || {})[yy];
          if (!rows.length || !sc) return;
          if (cand.unreconciledDerivedCols) cand.unreconciledDerivedCols(rows, id, sc);
          cand.stripDerivedForPersist(rows, id, sc);
        });
      });
      return cand;
    } catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) throw new Error(tag + ' call: ' + e.message);
      if (grabFn(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm, src) && consts.indexOf(nm) < 0) { consts.push(nm); continue; }
      throw new Error(tag + ' cannot resolve ' + nm + ' (call time)');
    }
  }
  throw new Error(tag + ': no convergence');
}

const A9 = (y) => P.tables.A9.data[y].map(r => r.slice());
const S9 = (y) => P.tables.A9.schema_by_year[y];

log('='.repeat(70));
log('CLCPA-241 + CLCPA-289 -- kept-figure semantics for A9s % Change');
log('  BASE : ' + BASE + ' (predates this change)');
log('='.repeat(70));

const NEW = buildEnv(SRC, 'NEW');

log('');
log('A. THE BASELINE CARRIES THE DEFECT');
guard('A-block', () => {
  ok(!/A9: \[pctChange/.test(codeOnly(BASE_SRC)), 'A1 BASE: A9 had no derive rule at all');
  ok(!/function derivedCellWrite/.test(codeOnly(BASE_SRC)),
    'A2 BASE: and nothing stopped applyDerivedCols overwriting a stored cell');
  const OLD = buildEnv(BASE_SRC, 'BASE');
  /* On BASE the cell is a stored STRING and stays one however the row moves. */
  const d = A9('2024');
  d[1][3] = 999999999;
  OLD.recomputeTotals(d, S9('2024'), 'A9', A9('2024'));
  ok(d[1][5] === '45%',
    'A3 BASE: editing Incentives left the % Change at its stored "45%" -- ' + JSON.stringify(d[1][5]));
});

log('');
log('B. THE RULE, DECLARED AND MATCHING THE SCHEMA');
guard('B-block', () => {
  const rules = NEW.DERIVED_COLS.A9 || [];
  ok(rules.length === 2, 'B1 A9 declares two rules');
  ok(rules.every(r => r.type === 'percentChange'), 'B2 both of type percentChange');
  /* THE POSITIONS ARE CHECKED AGAINST THE SCHEMA, for every stored year, so a
   * schema change cannot silently point the rule at the wrong pair. */
  let checked = 0;
  Object.keys(P.tables.A9.schema_by_year).forEach((y) => {
    const s = S9(y);
    if (!s || !P.tables.A9.data[y]) return;
    checked++;
    rules.forEach((r) => {
      ok(/%\s*change/i.test(String(s[r.column])),
        'B3.' + y + '.' + r.column + ' column ' + r.column + ' is headed "% Change"');
      ok(String(s[r.current]) > String(s[r.previous]),
        'B4.' + y + '.' + r.column + ' current year ' + s[r.current] +
        ' is later than previous ' + s[r.previous]);
    });
  });
  ok(checked === 2, 'B5 checked against every stored year (' + checked + ')');
});

log('');
log('C. VALUE IDENTITY: THE EIGHTEEN COMPUTE AND LOOK UNCHANGED');
guard('C-block', () => {
  /* The rendered TEXT is the client-visible thing, and it is what must not
   * move. gate_149_stacked asserts this across all 149 table-years; here it
   * is asserted on A9 specifically, which is the table that changed. */
  /* live_editor's boot does not expose renderSourceTables, so the panel is
   * rendered through a line-sliced harness that resolves what it needs by
   * following ReferenceErrors -- the same shape suite_263 and the 149-year
   * gate use. The artefact under test is the CLIENT-VISIBLE TEXT. */
  const renderer = (src) => {
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
    const add = (n) => { if (have.has(n)) return false; const f = find(n); if (!f) return false;
      have.add(n); parts.push(f); return true; };
    add('renderSourceTables');
    let api = null;
    return (y) => {
      for (let r = 0; r < 400; r++) {
        try {
          if (!api) api = new Function('PAYLOAD',
            'const state = { payload: PAYLOAD, seedYears: (PAYLOAD.meta.years||[]).map(String) };\n' +
            'const document = { getElementById: () => null, querySelector: () => null,' +
            ' querySelectorAll: () => [] };\n' +
            parts.join('\n\n') + '\n;return { renderSourceTables };')(P);
          return String(api.renderSourceTables([P.tables.A9], y, {}, 'A9'));
        } catch (e) {
          const m = /(\w+) is not defined/.exec(e.message);
          if (m && add(m[1])) { api = null; continue; }
          throw e;
        }
      }
      throw new Error('renderer: no convergence');
    };
  };
  const rNew = renderer(SRC), rOld = renderer(BASE_SRC);
  const render = (src, y) => (src === SRC ? rNew : rOld)(y);
  ['2024', '2025'].forEach((y) => {
    ok(render(SRC, y) === render(BASE_SRC, y),
      'C1.' + y + ' A9s rendered panel is byte-identical to BASE');
  });
  /* and the underlying VALUES did change: 18 became numbers */
  let numbers = 0, strings = 0;
  ['2024', '2025'].forEach((y) => {
    const out = NEW.rowsForDisplay(A9(y), S9(y), 'A9');
    out.forEach((r, i) => [5, 6].forEach((c) => {
      if (i === 0) return;
      if (typeof r[c] === 'number') numbers++;
      else if (r[c] != null && String(r[c]).trim() !== '') strings++;
    }));
  });
  ok(numbers === 18, 'C2 eighteen cells are now COMPUTED numbers -- ' + numbers);
  ok(strings === 2, 'C3 and exactly two remain as filed strings -- ' + strings);
});

log('');
log('D. THE TWO KEPT FIGURES, NAMED');
guard('D-block', () => {
  const kept = [];
  ['2024', '2025'].forEach((y) => {
    NEW.unreconciledDerivedCols(A9(y), 'A9', S9(y))
      .forEach(k => kept.push(y + '|' + k.label + '|' + k.filed));
  });
  ok(kept.length === 2, 'D1 exactly two kept figures in A9 -- ' + kept.length);
  ok(kept.indexOf('2024|Energy Savings (MMBtu)|8%') >= 0,
    'D2 the 8% against a derived 33.362% -- ' + JSON.stringify(kept));
  ok(kept.indexOf('2024|Average Incentive per Participant|62%') >= 0,
    'D3 and the 62% against a derived 62.500%');
  /* PAYLOAD-WIDE: no other table gains a kept figure, because only this rule
   * type opts in. The mechanism is general; the engagement is declared. */
  let all = 0;
  Object.keys(NEW.DERIVED_COLS).forEach((id) => {
    const t = P.tables[id];
    if (!t) return;
    Object.keys(t.data || {}).forEach((y) => {
      const rows = (t.data[y] || []).map(r => (Array.isArray(r) ? r.slice() : r));
      const s = (t.schema_by_year || {})[y];
      if (!rows.length || !s) return;
      all += NEW.unreconciledDerivedCols(rows, id, s).length;
    });
  });
  ok(all === 2, 'D4 and payload-wide the total is still two -- ' + all);
  /* the advisory says so, in words */
  const html = NEW.renderKeptFigureNotice(NEW.unreconciledDerivedCols(A9('2024'), 'A9', S9('2024')));
  ok(/Kept as filed: 2 figures/.test(html), 'D5 the advisory names both');
  ok(/Energy Savings \(MMBtu\)/.test(html) && /filed 8%/.test(html),
    'D6 with the label and the filed figure');
  ok(/33\.4%|33\.362/.test(html), 'D7 and what the rows actually give');
  ok(NEW.renderKeptFigureNotice([]) === '', 'D8 while a table with none renders no box');
  /* AND THE GRID AGREES WITH IT. The editor draws a derived cell through
   * fmtDerivedCell, which dashed anything that was not a number -- so the
   * kept figure read "8%" in the advisory and an em dash in the cell above
   * it, on one screen. Found in the browser, because each half was right on
   * its own. */
  const rule = (NEW.DERIVED_COLS.A9 || [])[0];
  ok(NEW.fmtDerivedCell('8%', rule) === '8%',
    'D9 the editor cell shows a KEPT figure as filed, not a dash -- ' +
    JSON.stringify(NEW.fmtDerivedCell('8%', rule)));
  ok(NEW.fmtDerivedCell(-0.2580, rule) === '-26%',
    'D10 while a computed one is scaled at the declared precision -- ' +
    JSON.stringify(NEW.fmtDerivedCell(-0.2580, rule)));
  ok(NEW.fmtDerivedCell(null, rule) === '—', 'D11 and an empty cell is still a dash');
});

log('');
log('E. THE STRIP: EIGHTEEN GO, TWO ARE REFUSED');
guard('E-block', () => {
  ok(NEW.PERSIST_STRIP_TABLES.has('A9'), 'E1 A9 is in PERSIST_STRIP_TABLES');
  let stripped = 0; const survived = [];
  ['2024', '2025'].forEach((y) => {
    const rows = A9(y);
    const out = NEW.stripDerivedForPersist(rows, 'A9', S9(y));
    rows.forEach((r, i) => [5, 6].forEach((c) => {
      if (i === 0) return;
      const was = r[c];
      if (was == null || String(was).trim() === '') return;
      if (out[i][c] === null) stripped++;
      else survived.push(y + ' ' + r[0] + ' = ' + JSON.stringify(out[i][c]));
    }));
  });
  ok(stripped === 18, 'E2 eighteen derived cells are nulled for persistence -- ' + stripped);
  ok(survived.length === 2,
    'E3 and the two kept figures SURVIVE the strip -- ' + JSON.stringify(survived));
  /* THE LENGTH IS PART OF THE ASSERTION, and the mutation controls are why.
   * every() on an empty array is TRUE, so with the strip nulling everything
   * this read green while the two figures it names had just been deleted:
   * an assertion that cannot fail in exactly the case it exists to catch. */
  ok(survived.length === 2 && survived.every(s => /8%|62%/.test(s)),
    'E4 they are the filed 8% and 62%, so nothing can delete them -- ' +
    JSON.stringify(survived));
});

log('');
log('F. CLCPA-289: THE MARKER TELLS THE TRUTH');
guard('F-block', () => {
  const tmpl = (src) => {
    const pay = JSON.parse(JSON.stringify(P));
    pay.meta.years = ['2094'].concat(P.meta.years.map(String));
    const b = boot({ payload: pay, tableId: 'A9', year: '2094', src: src });
    b.state().seedYears = P.meta.years.map(String);
    return templateRows(b.api.buildIngestWorkbook('A9', '2094')).map(dense);
  };
  const was = tmpl(BASE_SRC), now = tmpl(SRC);
  const marked = (rows) => rows.filter(r => String(r[5]) === '(calculated)' &&
                                            String(r[6]) === '(calculated)').length;
  ok(marked(was) === 0, 'F1 BASE marked none: the column was not computed');
  ok(marked(now) === 5, 'F2 every data row now marks both % Change cells -- ' + marked(now));
  /* and the operator's own input columns stay blank */
  ok(now.slice(2).every(r => [1, 2, 3, 4].every(c => String(r[c]) === '')),
    'F3 while the four figure columns stay blank for the preparer');
});

log('');
log('H. AN EDIT RECOMPUTES, WHICH IS THE COMPLAINT');
guard('H-block', () => {
  const base = A9('2024'), s = S9('2024');
  /* no edit: the reproducing cell computes, the kept one stays as filed */
  const quiet = A9('2024');
  NEW.recomputeTotals(quiet, s, 'A9', base);
  ok(typeof quiet[1][5] === 'number',
    'H1 with no edit, a reproducing cell computes -- ' + JSON.stringify(quiet[1][5]));
  ok(quiet[2][5] === '8%',
    'H2 and the kept figure stays exactly as filed -- ' + JSON.stringify(quiet[2][5]));
  /* edit: BOTH must move, the kept one included */
  const edited = A9('2024');
  edited[1][3] = 999999999;
  edited[2][3] = 9999999;
  NEW.recomputeTotals(edited, s, 'A9', base);
  ok(typeof edited[1][5] === 'number' && edited[1][5] !== quiet[1][5],
    'H3 editing an input recomputes it -- ' + JSON.stringify(edited[1][5]));
  ok(typeof edited[2][5] === 'number',
    'H4 and the KEPT cell recomputes too once its own input is edited -- ' +
    JSON.stringify(edited[2][5]));
  /* THE REGRESSION THIS BLOCK EXISTS FOR: without the baseline, H4 reads "8%"
   * because an edit and a source disagreement look identical to the
   * conditional. Asserted as a value, not as a shape. */
  ok(edited[2][5] !== '8%', 'H5 it is NOT the stale filed figure');
});

log('');
log('X. THE CHANGE IS WHERE IT SAYS IT IS');
guard('X-block', () => {
  const code = codeOnly(SRC);
  ok(/function derivedCellWrite\(stored, computed, rule, inputsChanged\) \{/.test(code),
    'X1 the kept-figure conditional exists, and takes the edit signal');
  ok(/if \(!rule \|\| !rule\.keepFiled\) return \{ write: true \};/.test(code),
    'X2 a rule OPTS IN, so the mechanism is general and the engagement declared');
  ok(/if \(inputsChanged\) return \{ write: true \};/.test(code),
    'X3 and an edit always wins');
  ok(/function derivedFiledReproduced\(stored, computed\) \{/.test(code),
    'X4 value identity is its own predicate, not derivedRowKeepsStored');
  /* SIX: the definition, the three writes in applyDerivedCols, the strip's
   * refusal, and unreconciledDerivedCols asking the same question. Counted off
   * the source rather than reasoned about, because the number is the point:
   * a write added later that skips the conditional moves it. */
  /* SEVEN now: CLCPA-319's columnTotal branch asks the same question before
   * writing a total it computed from the rows beneath it. */
  ok((code.match(/derivedCellWrite\(/g) || []).length === 7,
    'X5 every write in the engine goes through it, and the strip and advisory ask it too');
  ok(/applyDerivedCols\(draft, tableId, colSum, schema, baseline\);/.test(code),
    'X6 recomputeTotals hands the baseline down');
  ok(codeOnly(BASE_SRC).indexOf('derivedCellWrite') < 0, 'X7 (BASE carries none of this)');
});

log('');
log('='.repeat(70));
log('  ' + pass + ' passed, ' + fail + ' failed');
log('='.repeat(70));
fs.writeFileSync(path.join(__dirname, 'suite-241-289-output.txt'), lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
