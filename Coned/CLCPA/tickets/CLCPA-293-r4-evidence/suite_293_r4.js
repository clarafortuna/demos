/* CLCPA-293 round 4: the B7 registry, and the second surface.
 *
 * RULED, after round 3's inverse was built and withdrawn. An explicit
 * registry of totals that BELONG TO THE PREPARER because the engine cannot
 * honestly derive them. The import guard accepts, keeps and names registry
 * members; everything else is refused exactly as today. Registry rows carry
 * CLCPA-241 kept-figure semantics, so an accepted figure SURVIVES the
 * recompute and the save.
 *
 * THE BLOCKS ARE THE CONDITIONS:
 *
 *   H  the harness is running the real function, on every table-year
 *   A  every anatomy, before and after, with the figure surviving to a save
 *   B  the staged count and the landed count agree
 *   C  both controls: A8 accepted, kept and named; A1's Total still refuses
 *      111,111, asserted at the guard and observed at the import
 *   D  value identity per stored year: no published figure moves
 *   E  SAFE BY CONSTRUCTION: a total not in the registry behaves exactly as
 *      it did before, so an omission is never a CLCPA-88 regression
 *   F  the census of record, this round's and the last one's
 *
 * BEFORE is the DEPLOYED build, 8bf5ea7, which is what is live in the org.
 * That is the only comparison that answers "what does this change".
 *
 * Pins: DAC_BASE_COMMIT, DAC_APP_OVERRIDE.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-293-r4-output.txt');

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

/* THE SIXTEEN THE ASSEMBLER CANNOT FIND, plus this round's two. The import
 * guard wraps recomputeTotals in a production try/catch that eats the
 * ReferenceError this harness follows, so an unresolved dependency turns
 * every figure below into a measurement of the fallback branch. Block H is
 * the standing proof that it does not. */
const WANT = ['buildIngestImport', 'getTableSchema', 'ingestComputed',
  'recomputeTotals', 'ingestRebuildableTotals', 'stripDerivedForPersist',
  'totalRowFlags', 'isAnchoredTotalRowLabel', 'isStrictTotalRowLabel',
  'DERIVED_COLS', 'DERIVED_ROWS', 'detectSumColumns', 'rowsForDisplay',
  'DAC_KPI_REPORTED', 'dacDerivedTablesForYear',
  'dacCell', 'dacBody', 'dacRow', 'dacCol',
  'isB7PreparerTotal', 'B7_PREPARER_TOTALS',
  'unreconciledTotals', 'totalRowSums', 'columnGrandTotals', 'bareNumber',
  'withinSourceRounding', 'applyDerivedCols', 'sumDerivedCols',
  'derivedCellWrite', 'applyDerivedRows', 'addsOnlyPrecision',
  'storedDecimals', 'isDeclaredSummable', 'unreconciledDerivedRows',
  'SUMMABLE_COLS', 'derivedRowValue', 'derivedRowKeepsStored'];
const NEW = harness(SRC, WANT), OLD = harness(BASE_SRC, WANT);

const ID = 'A8';
const T = P.tables[ID];
const SCHEMA = NEW.attempt(api => api.getTableSchema(T, '2025'));
const STORED = T.data['2025'];
const SUBTOTAL = 24, GRAND = 25;
const F_TOTAL = 777, F_DAC = 222;

log('CLCPA-293 round 4: the B7 registry and the second surface');
log('BASE ' + BASE + ' (the deployed build)   app.js ' +
    (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ============ H. the harness ========================================== */
log('H. THE HARNESS IS RUNNING THE REAL FUNCTION');
guard('H-block', () => {
  const threw = [];
  let n = 0;
  [['new', NEW], ['base', OLD]].forEach(([tag, Hh]) => {
    Object.keys(P.tables).sort().forEach((id) => {
      const t = P.tables[id];
      Object.keys(t.data || {}).sort().forEach((y) => {
        const rows = t.data[y];
        if (!rows || !rows.length) return;
        if (tag === 'new') n++;
        try {
          Hh.attempt((api) => {
            const schema = api.getTableSchema(t, y);
            if (!schema || !schema.length) return null;
            api.recomputeTotals(rows.map(r => r.slice()), schema, id,
              rows.map(r => r.slice()));
            return null;
          });
        } catch (e) { threw.push(tag + ' ' + id + ':' + y); }
      });
    });
  });
  ok(n > 100, 'H0 every stored table-year is exercised: ' + n);
  ok(threw.length === 0,
     'H1 recomputeTotals runs on both builds without throwing, so the probe ' +
     'inside the guard is the real one: ' + JSON.stringify(threw.slice(0, 4)));
});

/* ---------------- the five anatomies ---------------------------------- */
const itemised = () => STORED.map(r => r.slice());
const blankRow = (rows, ri) => {
  for (let c = 1; c < SCHEMA.length; c++) rows[ri][c] = null;
  return rows;
};
/* the engine's own figure for the itemised rows, taken from the engine and
 * never retyped: a hand-summed list of row indices double-counted the
 * segment subtotals last round and made every anatomy behave alike */
const ENG = NEW.attempt((api) => {
  const rows = itemised();
  blankRow(rows, SUBTOTAL); blankRow(rows, GRAND);
  api.recomputeTotals(rows, SCHEMA, ID, itemised());
  return [rows[SUBTOTAL][1], rows[SUBTOTAL][2]];
});
const ANATOMIES = [
  ['1 rowless', []],
  ['2 structural, no figures in the row', blankRow(itemised(), GRAND)],
  ['3 holding a figure its rows do NOT come to',
    (() => { const d = itemised(); d[GRAND][1] = 999999; d[GRAND][2] = 888888; return d; })()],
  ['4 holding the figure its rows DO come to',
    (() => { const d = itemised(); d[GRAND][1] = ENG[0]; d[GRAND][2] = ENG[1]; return d; })()],
  ['5 ordinary stored row, replayed (the hosted anatomy)',
    (() => {
      const d = itemised();
      d[SUBTOTAL] = [STORED[SUBTOTAL][0], ENG[0], ENG[1], null];
      d[GRAND] = [STORED[GRAND][0], ENG[0], ENG[1], null];
      return d;
    })()],
];

function buildFile(rows) {
  const file = [SCHEMA.slice()];
  const staged = [];
  rows.forEach((r, ri) => {
    const out = [r[0], '', '', ''];
    const heading = String(STORED[ri][1]) === '' && String(STORED[ri][2]) === '';
    if (!heading) {
      out[1] = ri === GRAND ? F_TOTAL
        : (typeof STORED[ri][1] === 'number' ? STORED[ri][1] + 7 : 0);
      out[2] = ri === GRAND ? F_DAC
        : (typeof STORED[ri][2] === 'number' ? STORED[ri][2] + 3 : 0);
      staged.push(ri + ',1'); staged.push(ri + ',2');
    }
    file.push(out);
  });
  return { file, staged };
}

/* THE WHOLE JOURNEY, not just the import: what the draft holds, what
 * survives the recompute, and what a save would write. Round 3 proved the
 * import alone is not the answer. */
function journey(H, rows) {
  if (!rows.length) return { staged: 0, landed: 0, lost: [], named: 0, b7: 0 };
  const { file, staged } = buildFile(rows);
  const res = H.attempt(api => api.buildIngestImport(file, SCHEMA,
    rows.map(r => r.slice()), ID));
  const cand = (res.candidate || []).map(r => r.slice());
  /* by label and occurrence, against the candidate: A8 repeats row labels
   * and the importer APPENDS for a value-less row, so neither a bare label
   * lookup nor a bare index lookup can find where a figure landed */
  const nth = (arr, label, k) => {
    let seen = 0;
    for (let i = 0; i < arr.length; i++) {
      if (String((arr[i] || [])[0]) !== String(label)) continue;
      if (seen === k) return i;
      seen++;
    }
    return -1;
  };
  const occ = {}, place = {};
  rows.forEach((r, ri) => {
    const lbl = String(r[0]);
    const k = occ[lbl] = (occ[lbl] === undefined ? 0 : occ[lbl] + 1);
    place[ri] = nth(cand, lbl, k);
  });
  const holds = (arr, key) => {
    const [r, c] = key.split(',').map(Number);
    const want = String(file[r + 1][c]);
    const first = place[r];
    if (first >= 0 && arr[first] && String(arr[first][c]) === want) return first;
    const lbl = String(rows[r][0]);
    for (let i = 0; i < arr.length; i++) {
      if (String((arr[i] || [])[0]) === lbl && String(arr[i][c]) === want) return i;
    }
    return -1;
  };
  const landedSet = new Set(staged.filter(k => holds(cand, k) >= 0));
  /* and then the editor's recompute and the save, in that order */
  const after = cand.map(r => r.slice());
  H.attempt(api => api.recomputeTotals(after, SCHEMA, ID, rows.map(r => r.slice())));
  const saved = H.attempt(api => api.stripDerivedForPersist(
    after.map(r => r.slice()), ID, SCHEMA));
  const gr = holds(cand, GRAND + ',1');
  const grAfter = holds(after, GRAND + ',1');
  const grSaved = holds(saved, GRAND + ',1');
  const pt = (res.preparerTotals || []);
  return {
    staged: staged.length, landed: landedSet.size,
    lost: staged.filter(k => !landedSet.has(k)),
    named: pt.filter(p => String(p.label) === String(STORED[GRAND][0])).length,
    b7: pt.filter(p => p.b7).length,
    atImport: gr >= 0 ? [cand[gr][1], cand[gr][2]] : null,
    afterRecompute: grAfter >= 0 ? [after[grAfter][1], after[grAfter][2]] : null,
    atSave: grSaved >= 0 ? [saved[grSaved][1], saved[grSaved][2]] : null,
  };
}

/* ============ A. every anatomy, all the way to a save ================= */
log('');
log('A. EVERY ANATOMY, AND THE FIGURE SURVIVES TO A SAVE');
guard('A-block', () => {
  let bearing = 0;
  ANATOMIES.forEach(([label, rows]) => {
    if (!rows.length) {
      ok(journey(NEW, rows).staged === 0,
         'A0 ' + label + ': nothing to file into, on either build');
      return;
    }
    bearing++;
    const was = journey(OLD, rows), now = journey(NEW, rows);
    log('    ' + label);
    log('        ' + BASE + ': import ' + JSON.stringify(was.atImport) +
        '  recompute ' + JSON.stringify(was.afterRecompute) +
        '  save ' + JSON.stringify(was.atSave) + '  named ' + was.named);
    log('        now:      import ' + JSON.stringify(now.atImport) +
        '  recompute ' + JSON.stringify(now.afterRecompute) +
        '  save ' + JSON.stringify(now.atSave) + '  named ' + now.named);
    ok(String((now.atImport || [])[0]) === String(F_TOTAL),
       'A1 ' + label + ': the import accepts the preparer\'s figure');
    ok(String((now.afterRecompute || [])[0]) === String(F_TOTAL),
       'A2 ' + label + ': and it SURVIVES the recompute: ' +
       JSON.stringify(now.afterRecompute));
    ok(String((now.atSave || [])[0]) === String(F_TOTAL) &&
       String((now.atSave || [])[1]) === String(F_DAC),
       'A3 ' + label + ': and a SAVE writes it: ' + JSON.stringify(now.atSave));
    /* NAMED WHERE THE ENGINE WOULD OTHERWISE HAVE CLAIMED THE CELL, and
     * the distinction is real rather than a softened assertion.
     *
     * On anatomy 3 the stored figure does not reconcile, so totalRowFlags
     * does not confirm the row and ingestComputed.any is false: the engine
     * never claims that cell, the import writes it like any other operator
     * value, and there is nothing for an advisory to say. On 2, 4 and 5 the
     * engine DOES claim it, and the advisory is what tells the operator
     * their figure was taken instead. Measured, not assumed. */
    const claimed = NEW.attempt(api =>
      !!api.ingestComputed(rows, ID, SCHEMA).any(GRAND, 1));
    if (claimed) {
      ok(now.named > 0 && now.b7 > 0,
         'A4 ' + label + ': the engine claims this cell, so the advisory ' +
         'names it as the preparer\'s: ' + now.named + ' named, ' +
         now.b7 + ' as registry members');
    } else {
      ok(now.named === 0,
         'A4 ' + label + ': the engine does not claim this cell at all, so ' +
         'the figure lands as an ordinary operator value with no advisory, ' +
         'which is what it is');
    }
  });
  ok(bearing === 4, 'A5 four row-bearing anatomies exercised: ' + bearing);
  /* and the block cannot pass on the deployed build */
  const four = journey(OLD, ANATOMIES[3][1]), five = journey(OLD, ANATOMIES[4][1]);
  ok(String((four.atSave || [])[0]) !== String(F_TOTAL) &&
     String((five.atSave || [])[0]) !== String(F_TOTAL),
     'A6 while on ' + BASE + ' the figure does not reach a save on either ' +
     'anatomy 4 or 5: ' + JSON.stringify([four.atSave, five.atSave]));
});

/* ============ B. staged equals landed ================================= */
log('');
log('B. THE STAGED COUNT AND THE LANDED COUNT AGREE');
guard('B-block', () => {
  /* THE FILE HAS TO BE THE ONE A PREPARER WOULD ACTUALLY FILE, and the
   * first cut of this block forgot that.
   *
   * It staged every figure column on every row, including the six segment
   * subtotals, and then asserted that all 40 land. They do not, and they
   * must not: the engine derives "EmPower+ Total" from the rows above it,
   * and letting a file overwrite that is the CLCPA-88 defect round 1's own
   * D block exists to refuse. Round 3's candidate DID accept all 40, which
   * is exactly why it was withdrawn.
   *
   * The workbook already tells the preparer which cells are theirs: a
   * derivable total is marked (calculated) and a registry member is not.
   * So the honest test is the one the contract makes -- file the cells the
   * workbook leaves open, and every one of them lands -- with the second
   * half proving nothing else went missing quietly. */
  ANATOMIES.forEach(([label, rows]) => {
    if (!rows.length) return;
    const { file, staged } = buildFile(rows);
    const marks = NEW.attempt((api) => {
      const c = api.ingestComputed(rows, ID, SCHEMA);
      const m = {};
      staged.forEach((k) => {
        const [r, col] = k.split(',').map(Number);
        m[k] = !!c.marksInTemplate(r, col);
      });
      return m;
    });
    const invited = staged.filter(k => !marks[k]);
    const res = NEW.attempt(api => api.buildIngestImport(
      file.map(r => r.slice()), SCHEMA, rows.map(r => r.slice()), ID));
    const cand = (res.candidate || []);
    const landedAt = (k) => {
      const [r, col] = k.split(',').map(Number);
      const want = String(file[r + 1][col]);
      const lbl = String(rows[r][0]);
      for (let i = 0; i < cand.length; i++) {
        if (String((cand[i] || [])[0]) === lbl && String(cand[i][col]) === want) return i;
      }
      return -1;
    };
    const lostInvited = invited.filter(k => landedAt(k) < 0);
    ok(lostInvited.length === 0,
       'B1 ' + label + ': every cell the workbook INVITES the preparer to ' +
       'fill lands: ' + invited.length + ' of ' + invited.length +
       (lostInvited.length ? '  lost ' + JSON.stringify(lostInvited) : ''));
    const lostAll = staged.filter(k => landedAt(k) < 0);
    const allMarked = lostAll.every(k => marks[k]);
    ok(allMarked,
       'B2 ' + label + ': and every cell that does NOT land is one the ' +
       'workbook marks (calculated), so nothing the preparer was invited ' +
       'to fill goes missing: ' + lostAll.length + ' excluded, all marked ' +
       allMarked);
  });
  /* AND THE REGISTRY MEMBER IS AMONG THE INVITED, which is the point: the
   * workbook must not mark a cell (calculated) and then have the import
   * accept it, nor mark it open and then refuse it. */
  const rows5 = ANATOMIES[4][1];
  const marked = NEW.attempt((api) =>
    !!api.ingestComputed(rows5, ID, SCHEMA).marksInTemplate(GRAND, 1));
  ok(marked === false,
     'B3 and the workbook does NOT mark the registry member (calculated), ' +
     'so the contract and the import agree about whose cell it is');
});

/* ============ C. both controls ======================================== */
log('');
log('C. BOTH SIDES, IN THE SAME EVIDENCE');
guard('C-block', () => {
  /* ACCEPTED: A8's grand total is a registry member, by measurement. */
  ok(NEW.attempt(api => api.isB7PreparerTotal('A8',
       'Total CES Programs Installations', 'Total Installations')),
     'C1 A8s grand total is a registry member');
  ok(NEW.attempt(api => api.isB7PreparerTotal('J8', 'Total', 'Electric')),
     'C2 and so is J8s Total, the other member named by standing ruling');

  /* REFUSED: A1's Total. The control that killed round 2's fix and round
   * 3's, asserted at the guard AND observed at the import, in this file. */
  const A1 = P.tables.A1;
  const y1 = Object.keys(A1.data).sort().pop();
  const s1 = NEW.attempt(api => api.getTableSchema(A1, y1));
  const r1 = A1.data[y1];
  const t1 = r1.findIndex(r => String(r[0]).trim().toLowerCase() === 'total');
  ok(t1 >= 0, 'C3 A1 has a Total row: r' + t1);
  ok(!NEW.attempt(api => api.isB7PreparerTotal('A1', 'Total', s1[1])) &&
     !NEW.attempt(api => api.isB7PreparerTotal('A1', 'Total', s1[2])),
     'C4 and it is NOT a registry member, in any of its columns');
  const f1 = [s1.slice()].concat(r1.map(r => [r[0], r[1], r[2], null]));
  f1[t1 + 1][1] = 111111; f1[t1 + 1][2] = 222222;
  const run = (H) => H.attempt((api) => {
    const plan = api.buildIngestImport(f1.map(r => r.slice()), s1,
      r1.map(r => r.slice()), 'A1');
    return {
      taken: (plan.preparerTotals || [])
        .filter(p => /^total$/i.test(String(p.label))).length,
      holds: [(plan.candidate || [])[t1][1], (plan.candidate || [])[t1][2]],
    };
  });
  const was = run(OLD), now = run(NEW);
  ok(String(now.holds[0]) !== '111111' && String(now.holds[1]) !== '222222',
     'C5 the import still REFUSES 111,111 into A1s Total: ' +
     JSON.stringify(now.holds));
  ok(now.taken === 0,
     'C6 and takes nothing from the preparer there: ' + now.taken);
  ok(JSON.stringify(was) === JSON.stringify(now),
     'C7 byte for byte the same answer as ' + BASE + ', so this ticket did ' +
     'not touch it: ' + JSON.stringify(now.holds));
});

/* ============ D. value identity per stored year ====================== */
log('');
log('D. NO PUBLISHED FIGURE MOVES');
guard('D-block', () => {
  let cells = 0;
  const movedT = [];
  Object.keys(P.tables).sort().forEach((id) => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach((y) => {
      const rows = t.data[y];
      if (!rows || !rows.length) return;
      const schema = NEW.attempt(api => api.getTableSchema(t, y));
      const a = OLD.attempt(api => api.rowsForDisplay(rows.map(r => r.slice()), schema, id));
      const b = NEW.attempt(api => api.rowsForDisplay(rows.map(r => r.slice()), schema, id));
      cells += rows.length * (schema || []).length;
      if (JSON.stringify(a) !== JSON.stringify(b)) movedT.push(id + ':' + y);
    });
  });
  ok(cells > 1000, 'D1 every stored table-year compared: ' + cells + ' cells');
  ok(movedT.length === 0,
     'D2 and not one published table-year moves: ' + JSON.stringify(movedT.slice(0, 8)));
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
  const movedK = Object.keys(nowK).filter(k => nowK[k] !== wasK[k]);
  ok(movedK.length === 0, 'D3 and no KPI figure moves: ' +
     JSON.stringify(movedK.slice(0, 6)));
  /* THE EDITOR TOO, because that is the surface this round changed. On
   * STORED data the engine writes nothing for a registry member, so
   * protecting it must change nothing there either. */
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
     'D4 and the editor recompute on stored data is identical: ' +
     JSON.stringify(editMoved.slice(0, 8)));
});

/* ============ E. safe by construction ================================ */
log('');
log('E. A TOTAL NOT IN THE REGISTRY BEHAVES EXACTLY AS BEFORE');
guard('E-block', () => {
  /* THE RULING ASKED FOR THIS ASSERTION BY NAME. The registry can only
   * WIDEN what is accepted, so an omission is never a CLCPA-88 regression.
   * Measured over every total cell of every stored table-year: the
   * accept/refuse decision is compared between the deployed build and this
   * one, and every difference must be a registry member. */
  /* THE EXPECTED MEMBER SET COMES FROM THE COMMITTED CENSUS, not from the
   * app's own predicate.
   *
   * The first cut asked isB7PreparerTotal whether each difference was
   * excusable, which is a guard asking the mutated code whether the
   * mutation is allowed. Two controls proved it: matching on the row alone,
   * and on the column alone, both hand over cells the engine owns, and both
   * left this block green because the widened predicate also widened what
   * it would forgive. The measurement of record is the only fixed point. */
  const CENSUS = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'census-293-r4-summary.json'), 'utf8'));
  const norm = (v) => String(v == null ? '' : v).trim().toLowerCase();
  const expectedMember = (id, rowLabel, colHead) =>
    (CENSUS.proposed || []).some(m => m.table === id &&
      norm(m.row) === norm(rowLabel) && norm(m.column) === norm(colHead));

  const diffs = [], members = [];
  Object.keys(P.tables).sort().forEach((id) => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach((y) => {
      const rows = t.data[y];
      if (!rows || !rows.length) return;
      const schema = NEW.attempt(api => api.getTableSchema(t, y));
      if (!schema || !schema.length) return;
      const decide = (H) => H.attempt((api) => {
        const c = api.ingestComputed(rows, id, schema);
        const reb = api.ingestRebuildableTotals(rows, schema, id, r => c.totalRow(r));
        const out = {};
        rows.forEach((r, i) => {
          for (let col = 1; col < schema.length; col++) {
            if (!c.any(i, col)) continue;
            out[i + ',' + col] = !!(c.derivedCol(col) || reb.has(i + ',' + col));
          }
        });
        return out;
      });
      const a = decide(OLD), b = decide(NEW);
      Object.keys(b).forEach((k) => {
        if (a[k] === b[k]) return;
        const i = Number(k.split(',')[0]), col = Number(k.split(',')[1]);
        const isMember = expectedMember(id, rows[i][0], schema[col]);
        (isMember ? members : diffs).push(id + ':' + y + ' r' + i + 'c' + col +
          ' ' + JSON.stringify(String(rows[i][0]).slice(0, 28)) + '/' +
          JSON.stringify(String(schema[col]).slice(0, 20)));
      });
    });
  });
  ok(diffs.length === 0,
     'E1 not one NON-member total cell decides differently from ' + BASE +
     ': ' + JSON.stringify(diffs.slice(0, 8)));
  log('    registry-member cells whose decision moves: ' + members.length);
  /* and the registry itself is what the census produced */
  const reg = NEW.attempt(api => api.B7_PREPARER_TOTALS);
  const count = Object.keys(reg).reduce((n, k) => n + reg[k].length, 0);
  /* FIVE, not the census's sixteen: the confirmed set. C2 showed that a
   * census cannot tell structural silence from data-shaped silence, and
   * three of its nominees would have contradicted CLCPA-254. The rest are
   * enumerated in the report and wait for a ruling, which costs nothing
   * because a total left out behaves exactly as it does today. */
  ok(count === 5,
     'E2 the registry holds the five CONFIRMED cells rather than the ' +
     'census sixteen nominees: ' + count);
  ok(Object.keys(reg).sort().join(',') === 'A8,J8',
     'E3 on the two rows standing rulings already settled: ' +
     Object.keys(reg).sort().join(','));
  /* THE MEASUREMENT BEHIND EVERY MEMBER, re-derived here rather than
   * trusted: the engine must produce NOTHING for it, in every stored year
   * that holds a figure. */
  const notSilent = [];
  Object.keys(reg).forEach((id) => {
    const t = P.tables[id];
    reg[id].forEach((m) => {
      Object.keys(t.data || {}).sort().forEach((y) => {
        const rows = t.data[y];
        if (!rows || !rows.length) return;
        const schema = NEW.attempt(api => api.getTableSchema(t, y));
        const ci = (schema || []).findIndex(h =>
          String(h).trim().toLowerCase() === m.column.trim().toLowerCase());
        const ri = rows.findIndex(r =>
          String(r[0]).trim().toLowerCase() === m.row.trim().toLowerCase());
        if (ci < 0 || ri < 0) return;
        const stored = rows[ri][ci];
        if (stored == null || String(stored).trim() === '') return;
        const got = NEW.attempt((api) => {
          const probe = rows.map(r => r.slice());
          for (let c = 1; c < schema.length; c++) probe[ri][c] = null;
          try { api.recomputeTotals(probe, schema, id, rows.map(r => r.slice())); }
          catch (e) { return 'THREW'; }
          return probe[ri][ci];
        });
        if (!(got == null || String(got).trim() === '')) {
          notSilent.push(id + ':' + y + ' ' + m.row + '/' + m.column +
            ' engine produced ' + JSON.stringify(got));
        }
      });
    });
  });
  ok(notSilent.length === 0,
     'E4 and the engine produces NOTHING for every member, in every stored ' +
     'year that holds a figure: ' + JSON.stringify(notSilent.slice(0, 4)));
});

/* ============ F. the census of record ================================ */
log('');
log('F. THE MEASUREMENTS OF RECORD ARE COMMITTED');
guard('F-block', () => {
  /* THIS ROUND's census, read from its committed output rather than
   * recomputed here, because a number a suite derives for itself is not a
   * record of anything. */
  const cen = path.join(__dirname, 'census-293-r4-summary.json');
  ok(fs.existsSync(cen), 'F1 this round\'s B7 census is committed beside this suite');
  const j = JSON.parse(fs.readFileSync(cen, 'utf8'));
  ok(j.cells === 335 && j.owned === 162 && j.candidates === 173,
     'F2 and it reads 335 total cells, 162 the engine reproduces, 173 ' +
     'candidates: ' + j.cells + '/' + j.owned + '/' + j.candidates);
  ok((j.proposed || []).length === 16,
     'F3 nominating 16 cells, of which five are shipped and eleven wait for ' +
     'a ruling: ' + (j.proposed || []).length);
  /* AND ROUND 3's, which the ruling named as the measurement of record for
   * the approach that was withdrawn. It is committed in that round's
   * evidence, and it is asserted here so that replacing the approach does
   * not quietly drop the number that justified replacing it. */
  const r3 = path.join(__dirname, '..', 'CLCPA-293-r3-evidence',
    'probe-293-r3-candidate-output.txt');
  ok(fs.existsSync(r3), 'F4 round 3\'s census is committed in its own evidence');
  const txt = fs.readFileSync(r3, 'utf8');
  ok(/407 refused, 240 of them with no declared rule/.test(txt) ||
     (/refused 407/.test(txt) && /undeclared 240/.test(txt)),
     'F5 and still reads 407 refused, 240 of them undeclared, with block H ' +
     'proving the probe ran on all 149 table-years');
});

/* ============ X. the baseline ======================================== */
log('');
log('X. THE BASELINE');
guard('X-block', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X1 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: ROOT }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'X2 and HEAD descends from it');
  ok(codeOnly(BASE_SRC).indexOf('B7_PREPARER_TOTALS') < 0,
     'X3 while the deployed build has no registry at all');
  ok(codeOnly(SRC).indexOf('B7_PREPARER_TOTALS') > 0,
     'X4 and this build does, so the two really differ');
});

log('');
log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
if (fail) process.exit(1);
