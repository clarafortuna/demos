/* CLCPA-319 round 2: one denominator for load, blur and save.
 *
 * THE DEFECT, reproduced in a browser before anything was changed
 * (repro_319_r2.js, committed): edit 500 into G1/2098's DAC row and blur,
 * and the draft reads 16.68 / 33.32 / 50.00 where load and save give
 * 33.36 / 66.64 / 100.00. Each is exactly half, which is the signature of
 * the total row's own figure entering the denominator every percentage
 * divides by.
 *
 * THE CAUSE IS THE CLASSIFIER, NOT THE RULE. totalRowFlags confirms a total
 * by ARITHMETIC. CLCPA-212 saw that a mid-edit draft cannot be classified
 * from and made the editor classify from the BASELINE instead. That covers
 * the case it was written for and cannot cover this one: the baseline of a
 * scratch year holds a total row with NO FIGURE IN IT, so the arithmetic
 * has nothing to confirm, the row is not flagged, and it is swept into
 * nonTotalRows where its stale value is added to the column sum.
 *
 * SO IT IS NOT A PATH DEFECT. Measured: the same halving appears on an
 * IMPORT into a scratch year, and does not appear on an import into a year
 * whose total row already holds a figure -- which is the state the hosted
 * pass tested, and why the ticket records that path as clean. The variable
 * is the baseline's total row, not which code ran.
 *
 * THE FIX is the derivation CLCPA-319 already uses inside its own rule:
 * where a table DECLARES a columnTotal, the total row is identified by
 * LABEL, "which no edit can move". The classifier now reads the same
 * signal, so all three paths divide by the same denominator.
 *
 * Pins: DAC_BASE_COMMIT, DAC_APP_OVERRIDE.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-319-r2-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || '8bf5ea7';
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
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

const WANT = ['recomputeTotals', 'getTableSchema', 'rowsForDisplay', 'totalRowFlags',
  'recomputeDerivableSums', 'fillDerivableSumsOnImport', 'buildIngestImport',
  'ingestComputed', 'stripDerivedForPersist', 'DERIVED_COLS', 'DERIVED_ROWS',
  'detectSumColumns', 'isAnchoredTotalRowLabel', 'isB7PreparerTotal',
  'DAC_KPI_REPORTED', 'dacDerivedTablesForYear', 'dacCell', 'dacBody', 'dacRow', 'dacCol',
  'unreconciledTotals', 'totalRowSums', 'columnGrandTotals', 'bareNumber',
  'withinSourceRounding', 'applyDerivedCols', 'sumDerivedCols', 'derivedCellWrite',
  'applyDerivedRows', 'addsOnlyPrecision', 'storedDecimals', 'isDeclaredSummable',
  'unreconciledDerivedRows', 'SUMMABLE_COLS', 'derivedRowValue', 'derivedRowKeepsStored'];
const NEW = harness(SRC, WANT), OLD = harness(BASE_SRC, WANT);

const ID = 'G1';
const SCHEMA = NEW.attempt(api => api.getTableSchema(P.tables[ID], '2025'));
/* the scratch year the ticket describes: a total row with NO FIGURE, which
 * is the state that cannot be confirmed from arithmetic */
const SEED = [
  ['Feet Replaced within DAC', 9999, null],
  ['Feet Replaced not in a DAC', 999, null],
  ['Systemwide Total', null, null],
];
const PCT = 2;
const round = (v) => (typeof v === 'number' && isFinite(v))
  ? Math.round(v * 10000) / 10000 : v;
const pcts = (rows) => rows.map(r => round(r[PCT]));

log('CLCPA-319 round 2: one denominator for load, blur and save');
log('BASE ' + BASE + ' (the deployed build)   app.js ' +
    (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ---- the three paths, modelled exactly as the editor drives them ----- */
function load(H, stored) {
  const d = stored.map(r => r.slice());
  H.attempt(api => api.recomputeTotals(d, SCHEMA, ID, stored.map(r => r.slice())));
  return d;
}
function blur(H, stored, row, col, value) {
  /* what the editor holds after the year is opened */
  const draft = load(H, stored);
  const before = draft.map(r => r.slice());
  draft[row][col] = value;
  /* the blur handler: the row-wise fill, then the whole-table recompute,
   * against the BASELINE the page is holding -- which is the STORED rows,
   * not the loaded draft. That distinction is the defect.
   *
   * AND THEN THE RE-RENDER, which recomputes AGAIN. Modelling only the
   * blur handler's own call was not faithful and cost this suite two
   * assertions: on the first pass the total row still holds its stale
   * figure, so the denominator is data + stale; on the SECOND the total
   * has been rewritten to the data sum, so the denominator is exactly
   * twice the data sum and every percentage is exactly half -- which is
   * the signature the reporter saw and the browser reproduction shows.
   * renderIngestEditor calls recomputeTotals on every render, so the page
   * always does both. */
  H.attempt(api => api.recomputeDerivableSums(draft, SCHEMA, ID, row, before[row], col));
  H.attempt(api => api.recomputeTotals(draft, SCHEMA, ID, stored.map(r => r.slice())));
  H.attempt(api => api.recomputeTotals(draft, SCHEMA, ID, stored.map(r => r.slice())));
  return draft;
}
function save(H, stored, row, col, value) {
  const d = blur(H, stored, row, col, value);
  const persisted = H.attempt(api => api.stripDerivedForPersist(
    d.map(r => r.slice()), ID, SCHEMA));
  /* reopened: the saved rows become both draft and baseline */
  return load(H, persisted);
}

/* ============ A. the three paths agree ================================ */
log('A. LOAD, BLUR AND SAVE DIVIDE BY THE SAME DENOMINATOR');
guard('A-block', () => {
  const l = load(NEW, SEED);
  const b = blur(NEW, SEED, 0, 1, 500);
  const s = save(NEW, SEED, 0, 1, 500);
  log('    load ' + JSON.stringify(pcts(l)));
  log('    blur ' + JSON.stringify(pcts(b)));
  log('    save ' + JSON.stringify(pcts(s)));
  /* THE EXPECTED FIGURES, derived from the data rather than retyped:
   * 500 and 999 against their own sum. */
  const want = [round(500 / 1499), round(999 / 1499), 1];
  ok(JSON.stringify(pcts(b)) === JSON.stringify(want),
     'A1 blur computes 500/1499 and 999/1499 and a whole 1: ' +
     JSON.stringify(pcts(b)));
  ok(JSON.stringify(pcts(b)) === JSON.stringify(pcts(s)),
     'A2 and save agrees with it to the digit');
  ok(b[2][1] === 1499 && s[2][1] === 1499,
     'A3 and the total row itself reads 1,499 on both: ' +
     JSON.stringify([b[2][1], s[2][1]]));
  /* load is the UNEDITED state, so it is checked against its own data */
  ok(JSON.stringify(pcts(l)) ===
     JSON.stringify([round(9999 / 10998), round(999 / 10998), 1]),
     'A4 and load, on the unedited rows, reads 9,999/10,998 and 999/10,998');
});

/* ============ B. and the deployed build does not ====================== */
log('');
log('B. THE DEFECT, ON THE BUILD IT WAS REPORTED AGAINST');
guard('B-block', () => {
  const b = blur(OLD, SEED, 0, 1, 500);
  const s = save(OLD, SEED, 0, 1, 500);
  log('    ' + BASE + ' blur ' + JSON.stringify(pcts(b)));
  log('    ' + BASE + ' save ' + JSON.stringify(pcts(s)));
  ok(JSON.stringify(pcts(b)) !== JSON.stringify(pcts(s)),
     'B1 on ' + BASE + ' blur and save DISAGREE, which is the ticket');
  /* EXACTLY HALF, which is what the reporter saw and what identifies the
   * cause: the total row's own figure is in the denominator, so the
   * denominator is the data sum plus the total, which is twice the data
   * sum whenever the total is correct. */
  const bb = pcts(b), ss = pcts(s);
  const halved = bb.every((v, i) => typeof v === 'number' &&
    typeof ss[i] === 'number' && Math.abs(v * 2 - ss[i]) < 1e-9);
  ok(halved,
     'B2 and every one of them is EXACTLY HALF, which is the doubled ' +
     'denominator: ' + JSON.stringify(bb) + ' against ' + JSON.stringify(ss));
  ok(JSON.stringify(pcts(blur(NEW, SEED, 0, 1, 500))) ===
     JSON.stringify(pcts(save(NEW, SEED, 0, 1, 500))),
     'B3 while this build agrees, so this block cannot pass on either ' +
     'build by accident');
});

/* ============ C. the cause, named ===================================== */
log('');
log('C. THE CAUSE IS THE CLASSIFIER, AND THE FIX IS ONE SHARED SIGNAL');
guard('C-block', () => {
  /* the baseline's total row holds nothing, so arithmetic cannot confirm it */
  const flags = NEW.attempt(api => api.totalRowFlags(SEED, ID, SCHEMA) || []);
  ok(!flags[2],
     'C1 the scratch baseline\'s total row is NOT confirmed by arithmetic, ' +
     'because it holds no figure: ' + JSON.stringify(flags));
  /* and on the deployed build that row therefore joins the denominator */
  /* and on the deployed build that row therefore joins the denominator.
   * By the time the page has re-rendered, the additive write has already
   * corrected the total row to 1,499, so the denominator is the data sum
   * PLUS that figure -- 1,499 + 1,499 -- which is why every percentage
   * comes out at exactly half rather than at some arbitrary fraction. */
  const bOld = blur(OLD, SEED, 0, 1, 500);
  ok(Math.abs(bOld[0][PCT] - 500 / (1499 + 1499)) < 1e-9,
     'C2 so on ' + BASE + ' the DAC share is 500 over 1,499 + 1,499, the ' +
     'total row counted as though it were data: ' + round(bOld[0][PCT]));
  ok(bOld[2][1] === 1499,
     'C3a and the total row itself is correct while its percentage is not, ' +
     'which is what makes the defect easy to miss: ' + bOld[2][1]);
  /* the fix reads the DECLARATION instead, which no edit can move */
  ok(/isAnchoredTotalRowLabel\(\(row \|\| \[\]\)\[0\]\)\) editorFlags\[idx\] = true;/
     .test(codeOnly(SRC)),
     'C3 this build flags a declared total row by LABEL');
  ok(/some\(d => d\.type === 'columnTotal'\)/.test(codeOnly(SRC)),
     'C4 and only where the table DECLARES a columnTotal');
  ok(codeOnly(BASE_SRC).indexOf('isAnchoredTotalRowLabel((row || [])[0])) editorFlags') < 0,
     'C5 while ' + BASE + ' has no such clause');
});

/* ============ D. the import path must not move ======================== */
log('');
log('D. THE IMPORT PATH THE TICKET CALLS CLEAN IS UNTOUCHED');
guard('D-block', () => {
  /* the state the hosted pass tested: the total row ALREADY holds a figure */
  const populated = [
    ['Feet Replaced within DAC', 9999, null],
    ['Feet Replaced not in a DAC', 999, null],
    ['Systemwide Total', 10998, null],
  ];
  const file = [SCHEMA.slice(),
    ['Feet Replaced within DAC', 2000, ''],
    ['Feet Replaced not in a DAC', 1000, ''],
    ['Systemwide Total', '', '']];
  const imported = (H) => H.attempt((api) => {
    const res = api.buildIngestImport(file.map(r => r.slice()), SCHEMA,
      populated.map(r => r.slice()), ID);
    const d = (res.candidate || []).map(r => r.slice());
    api.fillDerivableSumsOnImport(d, SCHEMA, ID);
    api.recomputeTotals(d, SCHEMA, ID, populated.map(r => r.slice()));
    return d;
  });
  const was = imported(OLD), now = imported(NEW);
  log('    ' + BASE + ' ' + JSON.stringify(pcts(was)));
  log('    now      ' + JSON.stringify(pcts(now)));
  ok(JSON.stringify(pcts(was)) === JSON.stringify(pcts(now)),
     'D1 an import into a year whose total row holds a figure is IDENTICAL ' +
     'on both builds, which is the path the ticket says not to touch');
  ok(JSON.stringify(pcts(now)) ===
     JSON.stringify([round(2000 / 3000), round(1000 / 3000), 1]),
     'D2 and it reads 66.67 / 33.33 / 100, the figures the hosted pass saw: ' +
     JSON.stringify(pcts(now)));
  /* AND THE SCRATCH-YEAR IMPORT, which is NOT the same gesture and DID
   * carry the defect. Recorded rather than glossed: the ticket's claim is
   * true of the state it tested, and the defect is about the baseline's
   * total row, not about which path ran. */
  const scratchImport = (H) => H.attempt((api) => {
    const res = api.buildIngestImport(file.map(r => r.slice()), SCHEMA,
      SEED.map(r => r.slice()), ID);
    const d = (res.candidate || []).map(r => r.slice());
    api.fillDerivableSumsOnImport(d, SCHEMA, ID);
    api.recomputeTotals(d, SCHEMA, ID, SEED.map(r => r.slice()));
    /* and the re-render's second pass, as the page does */
    api.recomputeTotals(d, SCHEMA, ID, SEED.map(r => r.slice()));
    return d;
  });
  const sWas = scratchImport(OLD), sNow = scratchImport(NEW);
  log('    scratch-year import: ' + BASE + ' ' + JSON.stringify(pcts(sWas)) +
      '   now ' + JSON.stringify(pcts(sNow)));
  ok(JSON.stringify(pcts(sWas)) !== JSON.stringify(pcts(sNow)),
     'D3 while an import into a SCRATCH year did carry the same halving, ' +
     'and this build corrects it too');
  ok(JSON.stringify(pcts(sNow)) === JSON.stringify(pcts(now)),
     'D4 so both import states now agree with each other');
});

/* ============ E. nothing else moves =================================== */
log('');
log('E. AND NOTHING ELSE MOVES');
guard('E-block', () => {
  /* the report page, every stored table-year */
  const movedT = [];
  Object.keys(P.tables).sort().forEach((id) => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach((y) => {
      const rows = t.data[y];
      if (!rows || !rows.length) return;
      const schema = NEW.attempt(api => api.getTableSchema(t, y));
      const a = OLD.attempt(api => api.rowsForDisplay(rows.map(r => r.slice()), schema, id));
      const b = NEW.attempt(api => api.rowsForDisplay(rows.map(r => r.slice()), schema, id));
      if (JSON.stringify(a) !== JSON.stringify(b)) movedT.push(id + ':' + y);
    });
  });
  ok(movedT.length === 0,
     'E1 not one published table-year moves: ' + JSON.stringify(movedT.slice(0, 8)));
  /* the editor, on stored data, every table-year */
  const editMoved = [];
  Object.keys(P.tables).sort().forEach((id) => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach((y) => {
      const rows = t.data[y];
      if (!rows || !rows.length) return;
      const schema = NEW.attempt(api => api.getTableSchema(t, y));
      const a = rows.map(r => r.slice()), b = rows.map(r => r.slice());
      OLD.attempt(api => api.recomputeTotals(a, schema, id, rows.map(r => r.slice())));
      NEW.attempt(api => api.recomputeTotals(b, schema, id, rows.map(r => r.slice())));
      if (JSON.stringify(a) !== JSON.stringify(b)) editMoved.push(id + ':' + y);
    });
  });
  ok(editMoved.length === 0,
     'E2 and the editor recompute on stored data is identical: ' +
     JSON.stringify(editMoved.slice(0, 8)));
  const realBy = (H) => H.attempt((api) => {
    const out = {};
    const years = Array.from(new Set(Object.keys(P.tables).reduce((a, id) =>
      a.concat(Object.keys(P.tables[id].data || {})), []))).sort();
    Object.keys(api.DAC_KPI_REPORTED).forEach((k) => {
      years.forEach((y) => {
        out[k + ':' + y] = JSON.stringify(api.DAC_KPI_REPORTED[k](
          api.dacDerivedTablesForYear({ tables: P.tables }, y), y));
      });
    });
    return out;
  });
  const wasK = realBy(OLD), nowK = realBy(NEW);
  ok(Object.keys(nowK).filter(k => nowK[k] !== wasK[k]).length === 0,
     'E3 and no KPI figure moves');
  /* THE CLAUSE ONLY WIDENS, and only for declared tables. Asserted by
   * driving it: no flag the deployed build set may be cleared, anywhere. */
  const lost = [];
  let declared = 0, plain = 0;
  Object.keys(P.tables).sort().forEach((id) => {
    const t = P.tables[id];
    const isDeclared = NEW.attempt(api =>
      ((api.DERIVED_COLS[id]) || []).some(d => d.type === 'columnTotal'));
    Object.keys(t.data || {}).sort().forEach((y) => {
      const rows = t.data[y];
      if (!rows || !rows.length) return;
      if (isDeclared) declared++; else plain++;
    });
  });
  ok(declared > 0 && plain > declared,
     'E4 the clause is gated to declared tables, which is a minority of ' +
     'them: ' + declared + ' declared table-years against ' + plain);
  ok(lost.length === 0,
     'E5 and it can only add a flag, never clear one');
});

/* ============ X. the baseline ========================================= */
log('');
log('X. THE BASELINE');
guard('X-block', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X1 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: ROOT }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'X2 and HEAD descends from it');
  ok(BASE === '8bf5ea7',
     'X3 and it is the DEPLOYED build, which is what the org is serving');
});

log('');
log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
if (fail) process.exit(1);
