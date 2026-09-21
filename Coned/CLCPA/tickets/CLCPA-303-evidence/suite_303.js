/* CLCPA-303, OPTION (C): both directions declared on B2.
 *
 * B2 is two totals crossing. "Total Plugs" is a COLUMN summing plug types
 * across a row; "Total" is a ROW summing categories down a column; one cell
 * is both at once. The ruling: declare both, so that any future divergence
 * surfaces as a kept figure with the amber advisory rather than silent drift,
 * with the kept-figure guardians intact and value identity asserted per
 * stored year.
 *
 * WHAT WAS ALREADY TRUE, and is asserted here so the build is not credited
 * with it: the ROW-wise direction needed nothing. detectSumColumns reads it
 * off the heading, and CLCPA-272 ruled its behaviour -- reconcile and advise,
 * never compute over the preparer's figure.
 *
 * WHAT WAS NOT. Measured on the pre-change build, the column-wise direction
 * silently overwrote a divergent figure and left a blanked Total row blank on
 * every surface. The two axes did not behave the same way on any of the four
 * gestures that distinguish them. diag_303_axes.js is that measurement.
 *
 * AND THE CORNER, which the ruling says has to have an owner. It is the one
 * cell two rules could write. It belongs to the COLUMN rule, following
 * CLCPA-306, which already held that a total row's cell in a total column is
 * the engine's rather than the operator's.
 *
 * Pins: DAC_BASE_COMMIT, DAC_APP_OVERRIDE.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-303-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || 'd84c0d3';
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
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

const WANT = ['rowsForDisplay', 'getTableSchema', 'recomputeTotals',
  'recomputeDerivableSums', 'detectSumColumns', 'reconcileSumColumns',
  'fillDerivableSumsOnImport', 'ingestComputed', 'stripDerivedForPersist',
  'DERIVED_COLS', 'DAC_KPI_REPORTED', 'dacDerivedTablesForYear',
  'isAnchoredTotalRowLabel', 'PERSIST_STRIP_TABLES',
  'dacCell', 'dacBody', 'dacRow', 'dacCol'];
/* THREE BUILDS, because a two-way delta would credit this ticket with its
 * siblings' work. The first cut of block C did exactly that: it reported the
 * row axis going from 2 advisory rows to 1 and called it a CLCPA-303
 * regression, when the change is CLCPA-306's -- the ticket, earlier in this
 * same stack, that stopped the advisory reporting a cell the engine itself
 * had just written.
 *
 * MID is the working tree with THIS ticket reverted and nothing else:
 *
 *     NEW vs MID   is CLCPA-303, alone
 *     MID vs BASE  is the rest of the stack, and not this ticket's to explain
 *
 * Both reverts are asserted to hit exactly once. A silent miss would make
 * CLCPA-303 look like it changed nothing at all, which is the failure mode
 * that matters most in a suite whose headline claim is "nothing moves". */
const C303_REG = '      B2: [colTotal(1), colTotal(2), colTotal(3), colTotal(4)],\r\n';
const C303_OWN = "    if (((tableId && DERIVED_COLS[tableId]) || []).some(d => d.type === 'columnTotal') &&\r\n" +
  '        isAnchoredTotalRowLabel((rows[rowIndex] || [])[0])) return done;\r\n';
/* A MISSING ANCHOR IS A NAMED FAILURE, NOT AN EXIT.
 *
 * The first cut called process.exit here, and it cost the whole mutation
 * runner: every control that edits one of these two anchors made the suite
 * refuse to start, so it printed no FAIL lines at all and five mutations
 * were scored as "changed nothing". A throw that discards the run is the
 * defect guard() exists to prevent, and an exit is the same thing with the
 * evidence removed. The attribution assertions go red by name; every
 * ABSOLUTE assertion still runs and can still catch the mutation. */
const anchorMiss = [];
[['registry', C303_REG], ['corner ownership', C303_OWN]].forEach(([what, s]) => {
  const n = SRC.split(s).length - 1;
  if (n !== 1) anchorMiss.push(what + ' matched ' + n + ' times, expected 1');
});
const MID_SRC = SRC.replace(C303_REG, () => '').replace(C303_OWN, () => '');
/* and the relative blocks say so rather than comparing a build to itself */
const attributable = anchorMiss.length === 0;

const NEW = harness(SRC, WANT), OLD = harness(BASE_SRC, WANT),
      MID = harness(MID_SRC, WANT);

const T = P.tables.B2;
const YEARS = Object.keys(T.data).sort();
const shape = (H, y) => {
  const schema = H.attempt(api => api.getTableSchema(T, y));
  const rows = T.data[y];
  const rel = H.attempt(api => api.detectSumColumns(schema, rows, 'B2'))[0];
  return { schema, rows, rel, totalCol: rel ? rel.column : schema.length - 1,
    totalRow: rows.length - 1 };
};
/* the editor's two writes, in the order the grid runs them */
function edit(H, y, r, c, v) {
  const S = shape(H, y);
  const draft = S.rows.map(row => row.slice());
  const before = S.rows.map(row => row.slice());
  draft[r][c] = v;
  H.attempt(api => api.recomputeDerivableSums(draft, S.schema, 'B2', r, before[r], c));
  H.attempt(api => api.recomputeTotals(draft, S.schema, 'B2', before));
  return { S, draft };
}

log('CLCPA-303 option (C): both directions declared on B2');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ============ A. VALUE IDENTITY, PER STORED YEAR ====================== */
log('A. VALUE IDENTITY PER STORED YEAR, which the ruling requires');
guard('A-block', () => {
  let cells = 0, moved = [];
  YEARS.forEach((y) => {
    const S = shape(NEW, y);
    const was = OLD.attempt(api => api.rowsForDisplay(
      S.rows.map(r => r.slice()), S.schema, 'B2'));
    const now = NEW.attempt(api => api.rowsForDisplay(
      S.rows.map(r => r.slice()), S.schema, 'B2'));
    S.rows.forEach((r, i) => {
      for (let c = 0; c < S.schema.length; c++) {
        cells++;
        if (JSON.stringify(was[i][c]) !== JSON.stringify(now[i][c])) {
          moved.push(y + ' r' + i + 'c' + c + ' ' +
            JSON.stringify(was[i][c]) + ' -> ' + JSON.stringify(now[i][c]));
        }
      }
    });
    /* and that the display still equals what is STORED, both ways: the
     * ruling's "12 of 12 agree" is what makes this change safe, so it is
     * re-measured here rather than quoted from the earlier probe */
    S.rows.forEach((r, i) => {
      for (let c = 1; c < S.schema.length; c++) {
        if (JSON.stringify(now[i][c]) !== JSON.stringify(r[c])) {
          moved.push(y + ' r' + i + 'c' + c + ' display differs from stored');
        }
      }
    });
  });
  ok(cells >= 36, 'A1 every cell of every stored year is compared: ' + cells);
  ok(moved.length === 0,
     'A2 and not one of them moves, nor differs from the filed figure: ' +
     JSON.stringify(moved.slice(0, 6)));
  /* the corner, named, in both directions, per year */
  const corner = [];
  YEARS.forEach((y) => {
    const S = shape(NEW, y);
    const rowWise = S.rel.parts.reduce((a, c) => a + S.rows[S.totalRow][c], 0);
    const colWise = S.rows.filter((r, i) => i !== S.totalRow)
      .reduce((a, r) => a + r[S.totalCol], 0);
    const filed = S.rows[S.totalRow][S.totalCol];
    corner.push(y + ': filed ' + filed + ' rowwise ' + rowWise + ' colwise ' + colWise);
    if (!(filed === rowWise && filed === colWise)) corner.push(y + ' DISAGREES');
  });
  log('    ' + corner.join('  |  '));
  ok(!corner.some(c => /DISAGREES/.test(c)),
     'A3 and the corner reproduces from BOTH axes on every stored year, ' +
     'which is what makes declaring both safe');
});

/* ============ B. THE COLUMN AXIS GAINS THE GUARDIAN =================== */
log('');
log('B. THE COLUMN AXIS NOW BEHAVES LIKE THE ROW AXIS');
guard('B-block', () => {
  const res = { wasKept: [], nowKept: [], wasAdv: [], nowAdv: [] };
  YEARS.forEach((y) => {
    const S = shape(NEW, y);
    const bogus = S.rows[S.totalRow][1] + 500;
    const w = edit(MID, y, S.totalRow, 1, bogus);
    const n = edit(NEW, y, S.totalRow, 1, bogus);
    res.wasKept.push(w.draft[S.totalRow][1] === bogus);
    res.nowKept.push(n.draft[S.totalRow][1] === bogus);
    res.wasAdv.push(MID.attempt(api =>
      api.reconcileSumColumns(w.draft, S.schema, 'B2')).length);
    res.nowAdv.push(NEW.attempt(api =>
      api.reconcileSumColumns(n.draft, S.schema, 'B2')).length);
  });
  ok(attributable && res.wasKept.every(x => x === false),
     'B1 without this ticket the engine silently overwrote a divergent ' +
     'column total on every year, so this block cannot pass on the tree ' +
     'with the declaration removed' +
     (attributable ? '' : '   [ANCHOR: ' + anchorMiss.join('; ') + ']'));
  ok(attributable && res.wasAdv.every(x => x === 0),
     'B2 and said nothing about it: advisory count ' + JSON.stringify(res.wasAdv));
  ok(res.nowKept.every(x => x === true),
     'B3 this build KEEPS the filed figure on every year: ' + JSON.stringify(res.nowKept));
  ok(res.nowAdv.every(x => x > 0),
     'B4 and raises the amber advisory on it: ' + JSON.stringify(res.nowAdv));
});

/* ============ C. THE ROW AXIS IS UNTOUCHED ============================ */
log('');
log('C. AND THE ROW AXIS IS EXACTLY AS IT WAS');
guard('C-block', () => {
  /* AGAINST MID, not BASE: the row axis DID change earlier in this stack,
   * under CLCPA-306, and that change is not this ticket's to defend. */
  const same = [];
  YEARS.forEach((y) => {
    const S = shape(NEW, y);
    const bogus = S.rows[0][S.totalCol] + 500;
    const w = edit(MID, y, 0, S.totalCol, bogus);
    const n = edit(NEW, y, 0, S.totalCol, bogus);
    if (w.draft[0][S.totalCol] !== n.draft[0][S.totalCol]) same.push(y + ' kept');
    const a = MID.attempt(api => api.reconcileSumColumns(w.draft, S.schema, 'B2')).length;
    const b = NEW.attempt(api => api.reconcileSumColumns(n.draft, S.schema, 'B2')).length;
    if (a !== b) same.push(y + ' advisory ' + a + ' -> ' + b);
  });
  ok(attributable && same.length === 0,
     'C1 a divergent ROW total is kept and advised exactly as before this ' +
     'ticket: ' + JSON.stringify(same) +
     (attributable ? '' : '   [ANCHOR: ' + anchorMiss.join('; ') + ']'));
  /* and the sibling change IS named, so it is not hidden by the re-pointing */
  const stack = YEARS.map((y) => {
    const S = shape(NEW, y);
    const bogus = S.rows[0][S.totalCol] + 500;
    const w = edit(OLD, y, 0, S.totalCol, bogus);
    return OLD.attempt(api => api.reconcileSumColumns(w.draft, S.schema, 'B2')).length;
  });
  ok(stack.every(x => x === 2),
     'C1b while against ' + BASE + ' it reads ' + JSON.stringify(stack) +
     ' rather than 1, which is CLCPA-306 earlier in this stack no longer ' +
     'reporting the cell the engine itself wrote, and is named here rather ' +
     'than absorbed into this ticket');
  /* and an ordinary body edit still propagates along the row */
  const followed = YEARS.map((y) => {
    const S = shape(NEW, y);
    const n = edit(NEW, y, 0, 1, S.rows[0][1] + 100);
    return n.draft[0][S.totalCol] === S.rows[0][S.totalCol] + 100;
  });
  ok(followed.every(Boolean),
     'C2 and editing a component still carries along the row: ' +
     JSON.stringify(followed));
});

/* ============ D. THE CORNER HAS ONE OWNER ============================= */
log('');
log('D. ONE WRITER FOR THE CELL WHERE THEY CROSS');
guard('D-block', () => {
  /* The row rule must stand off the total row. Measured by asking
   * recomputeDerivableSums alone -- no applyDerivedCols afterwards -- what it
   * writes when the Total row's component is edited. */
  const wrote = YEARS.map((y) => {
    const S = shape(NEW, y);
    const draft = S.rows.map(r => r.slice());
    const before = S.rows.map(r => r.slice());
    draft[S.totalRow][1] = S.rows[S.totalRow][1] + 500;
    return NEW.attempt(api => api.recomputeDerivableSums(
      draft, S.schema, 'B2', S.totalRow, before[S.totalRow], 1));
  });
  ok(wrote.every(w => w.length === 0),
     'D1 the row rule writes nothing into the Total row: ' + JSON.stringify(wrote));
  /* but it still owns the body rows */
  const body = YEARS.map((y) => {
    const S = shape(NEW, y);
    const draft = S.rows.map(r => r.slice());
    const before = S.rows.map(r => r.slice());
    draft[0][1] = S.rows[0][1] + 100;
    return NEW.attempt(api => api.recomputeDerivableSums(
      draft, S.schema, 'B2', 0, before[0], 1));
  });
  ok(body.every(w => w.length === 1),
     'D2 while it still owns the body rows: ' + JSON.stringify(body));
  /* and the standing-off is keyed to the DECLARATION, not to the label, so
   * no other table changes behaviour */
  const code = codeOnly(SRC);
  ok(/d\.type === 'columnTotal'\)\s*&&\s*\r?\n?\s*isAnchoredTotalRowLabel/.test(code),
     'D3 and it stands off only where a columnTotal rule is DECLARED, so a ' +
     'table without one is untouched');
});

/* ============ E. BLAST RADIUS ========================================= */
log('');
log('E. EVERY OTHER TABLE, AND EVERY OTHER SURFACE');
guard('E-block', () => {
  /* the display view of every table-year, both builds */
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
     'E1 not one published table-year moves, B2 included: ' +
     JSON.stringify(movedT.slice(0, 8)));

  /* every KPI, on the path the app actually takes */
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
  ok(movedK.length === 0,
     'E2 and no KPI figure moves either: ' + JSON.stringify(movedK.slice(0, 6)));
  ok(nowK['ev_plugs:2025'] && /8884/.test(nowK['ev_plugs:2025']),
     'E3 including ev_plugs, which reads the corner: ' + nowK['ev_plugs:2025']);

  /* WHAT PERSISTS IS DELIBERATELY UNCHANGED. B2 is not in
   * PERSIST_STRIP_TABLES and this ticket does not add it: the ruling ordered
   * the declaration and the guardians, not a new strip, and a strip change
   * needs its own round-trip proof (CLCPA-143's data-loss finding). Named
   * here so it reads as a boundary rather than an oversight. */
  ok(NEW.attempt(api => !api.PERSIST_STRIP_TABLES.has('B2')),
     'E4 B2 still persists its own total row: this ticket declares the ' +
     'derivation, it does not change what is stored');
  const persisted = YEARS.map((y) => {
    const S = shape(NEW, y);
    return JSON.stringify(NEW.attempt(api =>
      api.stripDerivedForPersist(S.rows.map(r => r.slice()), 'B2', S.schema)));
  });
  const before = YEARS.map((y) => {
    const S = shape(NEW, y);
    return JSON.stringify(OLD.attempt(api =>
      api.stripDerivedForPersist(S.rows.map(r => r.slice()), 'B2', S.schema)));
  });
  ok(persisted.every((p, i) => p === before[i]),
     'E5 and a save writes byte-identical rows to what it wrote before');
});

/* ============ F. THE WORKBOOK ========================================= */
log('');
log('F. WHAT THE PREPARER DOWNLOADS');
guard('F-block', () => {
  const marks = (H, y) => {
    const S = shape(H, y);
    return H.attempt((api) => {
      const c = api.ingestComputed(S.rows, 'B2', S.schema);
      const out = [];
      S.rows.forEach((r, i) => {
        const row = [];
        for (let col = 1; col < S.schema.length; col++) {
          if (c.marksInTemplate(i, col)) row.push(col);
        }
        out.push(row);
      });
      return out;
    });
  };
  const deltas = [];
  YEARS.forEach((y) => {
    const a = JSON.stringify(marks(OLD, y)), b = JSON.stringify(marks(NEW, y));
    if (a !== b) deltas.push(y + ' ' + a + ' -> ' + b);
  });
  log('    marker changes: ' + (deltas.length ? deltas.join(' | ') : 'none'));
  /* THE J8 RULE, applied here: a total row that IS derivable from its own
   * rows may carry the marker. B2's Total is derivable in both directions,
   * which A3 just proved, so a marker on it is honest either way. This
   * asserts the rule is satisfied, not a particular count. */
  YEARS.forEach((y) => {
    const S = shape(NEW, y);
    const m = marks(NEW, y)[S.totalRow];
    ok(m.length > 0,
       'F1 ' + y + ': the Total row is marked as computed, and it is genuinely ' +
       'derivable from its own rows: columns ' + JSON.stringify(m));
  });
  /* and a body row's plain component is never marked */
  YEARS.forEach((y) => {
    const m = marks(NEW, y)[0];
    ok(m.indexOf(1) < 0,
       'F2 ' + y + ': a body row component is still the preparer\'s to fill in');
  });
});

/* ============ G. THE HOLE THIS ACTUALLY CLOSES ======================== */
log('');
log('G. A VALUE-LESS TOTAL ROW IS REBUILT, WHICH IT WAS NOT');
guard('G-block', () => {
  /* The CLCPA-246 shape, on B2. A total row with no figures in it cannot be
   * confirmed by totalRowFlags, because that classifier confirms a total by
   * ARITHMETIC and an empty row has none. colTotal identifies its row by
   * label instead, so it survives the emptiness. Measured per year and per
   * column, because 2025 has a column the other two do not. */
  const blanked = (H, y) => {
    const S = shape(H, y);
    const rows = S.rows.map(r => r.slice());
    for (let c = 1; c < S.schema.length; c++) rows[S.totalRow][c] = null;
    const disp = H.attempt(api => api.rowsForDisplay(rows, S.schema, 'B2'));
    return { S, out: disp[S.totalRow].slice(1) };
  };
  YEARS.forEach((y) => {
    const was = blanked(MID, y), now = blanked(NEW, y);
    log('    ' + y + '  without this ticket ' + JSON.stringify(was.out) +
        '   with it ' + JSON.stringify(now.out));
    /* EVERY numeric column of that year, named one by one: a rule declared
     * for three of 2025's four columns would leave one null and pass any
     * assertion phrased as "something came back". */
    const filled = now.out.every(v => typeof v === 'number' && isFinite(v));
    ok(filled,
       'G1 ' + y + ': every numeric column of the Total row is rebuilt from ' +
       'its own column, including the corner: ' + JSON.stringify(now.out));
    /* and rebuilt to the figure that is actually stored there */
    const want = now.S.rows[now.S.totalRow].slice(1);
    ok(JSON.stringify(now.out) === JSON.stringify(want),
       'G2 ' + y + ': and to the filed figure exactly, not merely to a number');
  });
  /* the before side, so the block cannot pass on a build that never had it */
  const before = YEARS.map(y => blanked(MID, y).out.some(v => v == null));
  ok(attributable && before.every(Boolean),
     'G3 while without this ticket the row came back empty on every year: ' +
     JSON.stringify(before) +
     (attributable ? '' : '   [ANCHOR: ' + anchorMiss.join('; ') + ']'));
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
  ok(OLD.attempt(api => !api.DERIVED_COLS.B2),
     'X3 and B2 had no declared rule at all on it');
  ok(NEW.attempt(api => (api.DERIVED_COLS.B2 || []).length === 4),
     'X4 while this build declares four, one per numeric column across every ' +
     'stored year, since 2025 shifts Total Plugs from index 3 to index 4');
});

log('');
log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
if (fail) process.exit(1);
