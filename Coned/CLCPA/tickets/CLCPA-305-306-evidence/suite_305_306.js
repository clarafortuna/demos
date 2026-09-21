/* CLCPA-305 and CLCPA-306: the reconciliation advisory.
 *
 *   305: the page and the Confirm-save dialog reported different counts. The
 *        page rendered r.reconcileNotices, a snapshot of the CANDIDATE taken
 *        at import time and carried for as long as the panel lived; the dialog
 *        called reconcileSumColumns(i.draft, ...) fresh on every open.
 *        Measured: import a file with one row that does not add up, correct
 *        that very cell, and the page says 1 row while the dialog says 0 at
 *        the moment of saving.
 *
 *   306: the advisory counted a figure the ENGINE wrote as one an operator
 *        filed. B2/2023, typing 1399 into the DAC row's "Total Plugs" where
 *        899 belongs:
 *
 *          "DAC"   / Total Plugs: filed 1399, L2 + DCFC = 899   (theirs)
 *          "Total" / Total Plugs: filed 3509, L2 + DCFC = 3009  (the engine's)
 *
 *        One wrong figure, two complaints, under "The filed value is kept;
 *        check which figure is right". Nobody filed 3509.
 *
 * THE 306 TEST IS ARITHMETIC, NOT "IS THIS A TOTAL ROW", and the first cut of
 * it was the latter. suite_278_r3 caught that: H1's frozen total is a KEPT
 * FILED figure which happens to equal the column sum, and suppressing total
 * rows as a class would have hidden the very thing that ticket exists to
 * report. Block F below is that case, asserted here so it cannot be lost again.
 *
 * Pins: DAC_BASE_COMMIT, DAC_APP_OVERRIDE.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-305-306-output.txt');

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

const WANT = ['reconcileSumColumns', 'getTableSchema', 'detectSumColumns',
  'recomputeTotals', 'totalRowFlags', 'isAnchoredTotalRowLabel'];
const NEW = harness(SRC, WANT), OLD = harness(BASE_SRC, WANT);

const fnOf = (src, n) => {
  const c = codeOnly(src);
  const i = c.indexOf('function ' + n + '(');
  return i < 0 ? '' : c.slice(i, c.indexOf('\r\n  }', i));
};

log('CLCPA-305 / CLCPA-306: the reconciliation advisory');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ===================== A: 305, one source ============================= */
say('=== A. the page and the dialog read the same thing ==================');
guard('A: one source', () => {
  const panel = fnOf(SRC, 'renderIngestImportResult');
  const page = fnOf(SRC, 'renderIngestImport');
  ok(panel.indexOf('renderReconcileNotice') < 0,
     'A1 the import PANEL no longer renders the reconciliation advisory');
  ok(/renderReconcileNotice\(draftReconcile\)/.test(page),
     'A2 the PAGE renders it, from the draft');
  ok(!/r\.reconcileNotices && r\.reconcileNotices\.length/.test(page),
     'A3 and no longer stands aside when an import produced a list of its own');
  ok(/reconcileSumColumns\(i\.draft, i\.schema, i\.tableId\)/.test(page),
     'A4 that list is reconcileSumColumns over i.draft');
  /* the dialog, which has always read the draft, is untouched */
  const dialogCalls = (codeOnly(SRC)
    .match(/renderReconcileNotice\(reconcileSumColumns\(i\.draft, i\.schema, i\.tableId\)\)/g) || []).length;
  ok(dialogCalls === 1,
     'A5 and the Confirm-save dialog still reads the draft, unchanged: ' + dialogCalls);
  /* BASE really did differ */
  const oldPanel = fnOf(BASE_SRC, 'renderIngestImportResult');
  ok(/renderReconcileNotice\(r\.reconcileNotices\)/.test(oldPanel),
     'A6 while BASE rendered the IMPORT-TIME list from the panel');
});

/* ===================== B: 305, the divergence ========================= */
say('');
say('=== B. what the two surfaces said, before and after ==================');
guard('B: the scenario', () => {
  const id = 'B2', y = '2023';
  const schema = NEW.attempt(api => api.getTableSchema(P.tables[id], y));
  const rel = NEW.attempt(api => api.detectSumColumns(schema, P.tables[id].data[y], id))[0];
  ok(!!rel, 'B1 B2 has a derivable total column: ' + JSON.stringify(rel && schema[rel.column]));

  /* a file arrives with one row that does not add up */
  const atImport = P.tables[id].data[y].map(r => r.slice());
  atImport[0][rel.column] += 700;
  const importList = NEW.attempt(api => api.reconcileSumColumns(atImport, schema, id));
  ok(importList.length === 1,
     'B2 the candidate raises exactly one notice at import: ' + importList.length);

  /* the operator corrects that very cell */
  const draft = atImport.map(r => r.slice());
  draft[0][rel.column] -= 700;
  const draftList = NEW.attempt(api => api.reconcileSumColumns(draft, schema, id));
  ok(draftList.length === 0,
     'B3 and after the correction the DRAFT raises none: ' + draftList.length);
  ok(importList.length !== draftList.length,
     'B4 so the import-time list and the draft genuinely disagree, which is ' +
     'what the page used to show against what the dialog showed');
});

/* ===================== C: 306, the double report ====================== */
say('');
say('=== C. one wrong figure, one notice =================================');
guard('C: the engines own cell', () => {
  const id = 'B2', y = '2023';
  const schema = NEW.attempt(api => api.getTableSchema(P.tables[id], y));
  const rel = NEW.attempt(api => api.detectSumColumns(schema, P.tables[id].data[y], id))[0];
  const totalRow = P.tables[id].data[y].findIndex(r =>
    NEW.attempt(api => api.isAnchoredTotalRowLabel(r[0])));

  const rows = P.tables[id].data[y].map(r => r.slice());
  rows[0][rel.column] += 500;                       /* the operator mistypes */
  NEW.attempt(api => api.recomputeTotals(rows, schema, id, P.tables[id].data[y]));
  ok(rows[totalRow][rel.column] === 3509,
     'C1 the editor carries the mistake into the total row: ' +
     JSON.stringify(rows[totalRow]));

  const now = NEW.attempt(api => api.reconcileSumColumns(rows, schema, id));
  const was = OLD.attempt(api => api.reconcileSumColumns(rows, schema, id));
  ok(was.length === 2,
     'C2 BASE reported TWO rows for one wrong figure: ' +
     JSON.stringify(was.map(n => n.label + ' ' + n.filed)));
  ok(now.length === 1,
     'C3 and this build reports one: ' +
     JSON.stringify(now.map(n => n.label + ' ' + n.filed)));
  ok(now.length === 1 && now[0].rowIndex !== totalRow,
     'C4 the one it reports is the row the operator typed into, not the ' +
     'engines: r' + (now[0] && now[0].rowIndex));
});

/* ===================== D: nothing else moves ========================== */
say('');
say('=== D. the payload as filed ========================================');
guard('D: no stored figure gains or loses a notice', () => {
  let moved = [];
  Object.keys(P.tables).sort().forEach((id) => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach((y) => {
      const rows = t.data[y];
      if (!rows || !rows.length) return;
      const schema = NEW.attempt(api => api.getTableSchema(t, y));
      const a = OLD.attempt(api => api.reconcileSumColumns(rows, schema, id));
      const b = NEW.attempt(api => api.reconcileSumColumns(rows, schema, id));
      if (JSON.stringify(a) !== JSON.stringify(b)) moved.push(id + ':' + y);
    });
  });
  ok(moved.length === 0,
     'D1 every stored table-year reconciles identically on both builds: ' +
     JSON.stringify(moved));
});

/* ===================== F: the case that must NOT be lost ============== */
say('');
say('=== F. a KEPT FILED total is still named ===========================');
guard('F: suite_278_r3s case, asserted here too', () => {
  /* H1 with an unreadable component: the total FREEZES at its filed value and
   * the advisory has to say so. An earlier cut of CLCPA-306 suppressed total
   * rows as a class and silently took this away. */
  const schema = NEW.attempt(api => api.getTableSchema(P.tables.H1, '2025'));
  const rows = [['Manhattan', 42, '33%', 1098], ['Grand Total', 42, 999, 1098]];
  const now = NEW.attempt(api => api.reconcileSumColumns(rows, schema, 'H1'));
  const onTotal = now.filter(n => /total/i.test(String(n.label)));
  ok(onTotal.length === 1,
     'F1 the frozen total on the "Grand Total" row is STILL reported: ' +
     JSON.stringify(now.map(n => n.label + ' ' + n.filed + ' vs ' + n.computed)));
  ok(onTotal.length === 1 && onTotal[0].filed === 1098,
     'F2 naming the filed figure the engine could not reproduce: ' +
     (onTotal[0] && onTotal[0].filed));
  /* and the discrimination: no row beneath explains this gap */
  ok(now.length === 1,
     'F3 and nothing below it was reported, which is exactly why it survives ' +
     'the CLCPA-306 filter: ' + now.length);
});

/* ===================== X: the baseline ================================ */
say('');
say('=== X. the baseline =================================================');
guard('X: pins', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X1 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: ROOT }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'X2 and HEAD descends from it');
  ok(fnOf(BASE_SRC, 'reconcileSumColumns').indexOf('isTotalRow') < 0,
     'X3 while BASE had no such filter at all, so this suite cannot pass on it');
  /* CLCPA-278 round 3s rule: one reader, no private copies */
  ok(!/typeof [\w.[\]]+ === 'number'/.test(fnOf(SRC, 'reconcileSumColumns')),
     'X4 and the new code carries no private copy of "is this a number"');
});

say('');
log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
if (fail) process.exit(1);
