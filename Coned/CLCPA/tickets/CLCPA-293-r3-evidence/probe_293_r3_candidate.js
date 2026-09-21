/* CLCPA-293 round 3: THE CANDIDATE, MEASURED AND NOT SHIPPED.
 *
 * THIS IS NOT AN ACCEPTANCE SUITE AND app.js DOES NOT CONTAIN THIS CHANGE.
 * It was built under the ruling, measured against every condition on that
 * ruling, and then withdrawn on evidence -- the third fix this ticket has
 * withdrawn, and the first withdrawn before merge rather than after. The
 * candidate is applied to a copy of app.js IN MEMORY below, so this file
 * keeps every measurement without the change being in the build.
 *
 * WHY IT WAS WITHDRAWN, in one line: implemented literally, the doctrine
 * accepts a preparer's figure into A1's Total, and that is the CLCPA-88
 * defect coming back. See block G, and CLCPA-293-r3-build.md.
 *
 * THE RULING. A cell is REFUSED only when a DECLARED rule derives it -- the
 * registry (DERIVED_COLS), DERIVED_ROWS, or a detectSumColumns relationship.
 * Otherwise it is ACCEPTED and NAMED by the kept-figure advisory. The stored
 * figures happening to add up is never the classifier. This is the B7 and
 * CLCPA-272 doctrine reaching the one surface still using the trap.
 *
 * THIS TICKET HAS TWO WITHDRAWN FIXES BEHIND IT, so the conditions on the
 * ruling are heavier than usual and each block below is one of them:
 *
 *   A  every anatomy, before and after, offline (the browser half is
 *      repro_293_r3.js and covers the same five)
 *   B  the staged count and the landed count AGREE, or what was excluded is
 *      stated with its reason
 *   C  controls on BOTH sides in the same evidence: A8/2098's filed 777 and
 *      222 accepted, kept and named; A1's Total, which HAS a declared rule,
 *      still refused
 *   D  value identity per stored year: no published figure moves from this
 *      change alone
 *   E  the census of record
 *
 * MID, not BASE, is the "before" side for attribution: this ticket sits on
 * top of a stack that already moved the importer, and crediting it with its
 * siblings' work is how round 2 reached a wrong verdict.
 *
 * Pins: DAC_BASE_COMMIT, DAC_MID_COMMIT, DAC_APP_OVERRIDE.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'probe-293-r3-candidate-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || 'd84c0d3';
const MID_REF = process.env.DAC_MID_COMMIT || 'a331392';
const SHIPPED = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');

/* THE CANDIDATE, applied to a copy in memory. Every anchor is asserted to
 * hit exactly once: a patch that silently misses would leave this file
 * measuring the shipped build twice and reporting it as a comparison. */
const PRED_FN =
  '  function ingestDeclaredDerives(schema, rows, tableId) {\r\n' +
  '    const cols = {};\r\n' +
  '    ((tableId && DERIVED_COLS[tableId]) || []).forEach((d) => { cols[d.column] = true; });\r\n' +
  '    try {\r\n' +
  '      (detectSumColumns(schema, rows, tableId) || []).forEach((s) => { cols[s.column] = true; });\r\n' +
  '    } catch (e) { /* a detector that cannot run declares nothing */ }\r\n' +
  '    const rowSet = {};\r\n' +
  '    ((tableId && DERIVED_ROWS[tableId]) || []).forEach((d) => { rowSet[d.row] = true; });\r\n' +
  '    return (ri, c) => !!cols[c] || !!rowSet[ri];\r\n' +
  '  }\r\n\r\n';
const HEAD_FROM = '  function ingestRebuildableTotals(rows, schema, tableId, totals) {\r\n' +
  '    const out = new Set();\r\n' +
  '    if (!Array.isArray(rows) || !rows.length || !schema || !schema.length) return out;\r\n' +
  '    rows.forEach((row, ri) => {';
const HEAD_TO = PRED_FN +
  '  function ingestRebuildableTotals(rows, schema, tableId, totals) {\r\n' +
  '    const out = new Set();\r\n' +
  '    if (!Array.isArray(rows) || !rows.length || !schema || !schema.length) return out;\r\n' +
  '    const declared = ingestDeclaredDerives(schema, rows, tableId);\r\n' +
  '    rows.forEach((row, ri) => {';
const THROW_FROM = "        for (let c = 1; c < schema.length; c++) out.add(ri + ',' + c);\r\n" +
  '        return;\r\n      }\r\n';
const THROW_TO = '        for (let c = 1; c < schema.length; c++) {\r\n' +
  "          if (declared(ri, c)) out.add(ri + ',' + c);\r\n" +
  '        }\r\n        return;\r\n      }\r\n';
const LOOP_FROM = '      for (let c = 1; c < schema.length; c++) {\r\n' +
  '        const back = probe[ri] ? probe[ri][c] : null;\r\n';
const LOOP_TO = '      for (let c = 1; c < schema.length; c++) {\r\n' +
  '        if (!declared(ri, c)) continue;\r\n' +
  '        const back = probe[ri] ? probe[ri][c] : null;\r\n';
const SRC = (function () {
  let s = SHIPPED;
  [['head', HEAD_FROM, HEAD_TO], ['throw branch', THROW_FROM, THROW_TO],
   ['probe loop', LOOP_FROM, LOOP_TO]].forEach(([what, from, to]) => {
    const n = s.split(from).length - 1;
    if (n !== 1) {
      console.error('probe_293_r3_candidate: the ' + what + ' anchor matched ' +
        n + ' times, expected 1. Refusing to report a comparison it cannot make.');
      process.exit(2);
    }
    s = s.replace(from, () => to);
  });
  return s;
})();
/* "before" is the shipped build itself, since the candidate is not in it */
const MID_SRC = SHIPPED;
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

const WANT = ['buildIngestImport', 'getTableSchema', 'ingestComputed',
  'recomputeTotals', 'ingestRebuildableTotals', 'stripDerivedForPersist',
  'totalRowFlags', 'isAnchoredTotalRowLabel', 'DERIVED_COLS', 'DERIVED_ROWS',
  'detectSumColumns', 'rowsForDisplay', 'DAC_KPI_REPORTED', 'ingestDeclaredDerives',
  'dacDerivedTablesForYear', 'dacCell', 'dacBody', 'dacRow', 'dacCol',
  /* ELEVEN NAMES THE ASSEMBLER CANNOT DISCOVER, and the reason they are
   * listed is the whole of block H below.
   *
   * ingestRebuildableTotals wraps its recomputeTotals call in a PRODUCTION
   * try/catch, and that catch swallows the ReferenceError the assembler
   * listens for. So a missing dependency never surfaces: the probe silently
   * takes its exception branch, the function returns the fallback answer,
   * and every measurement taken through it describes the harness rather
   * than the app. It is not a hypothetical -- the first cut of this suite
   * measured the whole census that way, and the numbers were wrong. */
  'unreconciledTotals', 'totalRowSums', 'columnGrandTotals', 'bareNumber',
  'withinSourceRounding', 'applyDerivedCols', 'sumDerivedCols',
  'derivedCellWrite', 'applyDerivedRows', 'addsOnlyPrecision',
  'storedDecimals', 'isDeclaredSummable', 'unreconciledDerivedRows',
  'SUMMABLE_COLS', 'derivedRowValue', 'derivedRowKeepsStored'];
const NEW = harness(SRC, WANT), MID = harness(MID_SRC, WANT);

const ID = 'A8';
const T = P.tables[ID];
const SCHEMA = NEW.attempt(api => api.getTableSchema(T, '2025'));
const STORED = T.data['2025'];
const SUBTOTAL = 24;   /* "Residential Programs Installations Total", derivable */
const GRAND = 25;      /* "Total CES Programs Installations", B7-class */
const F_TOTAL = 777, F_DAC = 222;   /* the preparer's filed grand total */

log('CLCPA-293 round 3: registry-derivability on the import guard');
log('BASE ' + BASE + '   MID ' + MID_REF + '   app.js ' +
    (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ============ H. THE HARNESS, BEFORE ANY CLAIM IT MAKES =============== */
log('H. THE HARNESS CAN ACTUALLY RUN THE FUNCTION UNDER TEST');
guard('H-block', () => {
  /* THE PROBE INSIDE ingestRebuildableTotals MUST NOT BE THROWING.
   *
   * It calls recomputeTotals inside a try/catch whose purpose is to be
   * conservative in production. In a harness that catch is a trap: it eats
   * the ReferenceError the ReferenceError-following assembler needs to see,
   * so an unresolved dependency turns into "the probe cannot run" and the
   * function answers from its fallback branch. Nothing fails; the numbers
   * are simply about a different code path.
   *
   * This is not theory. The first cut of this suite measured 472 refused
   * cells and 302 undeclared through that fallback, on eleven dependencies
   * the assembler never got to resolve.
   *
   * recomputeTotals is called here DIRECTLY, on the same inputs and in the
   * same assembled scope. If it runs clean here it runs clean there, and
   * every number below is about the app. */
  /* EVERY stored table-year, not a sample. The first version of this block
   * checked four tables and passed while twelve table-years across A3, A4,
   * C2, F7 and F9 were still taking the fallback, on five more dependencies
   * the first four never needed. A spot check of a silent failure mode is
   * not a guard. */
  const threwOn = [];
  let checked = 0;
  Object.keys(P.tables).sort().forEach((id) => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach((y) => {
      const rows = t.data[y];
      if (!rows || !rows.length) return;
      checked++;
      try {
        NEW.attempt((api) => {
          const schema = api.getTableSchema(t, y);
          if (!schema || !schema.length) return null;
          api.recomputeTotals(rows.map(r => r.slice()), schema, id,
            rows.map(r => r.slice()));
          return null;
        });
      } catch (e) { threwOn.push(id + ':' + y + ' ' + (e && e.message)); }
    });
  });
  ok(checked > 100, 'H0 every stored table-year is exercised: ' + checked);
  ok(threwOn.length === 0,
     'H1 recomputeTotals runs in this harness on every one of them, so the ' +
     'probe inside ingestRebuildableTotals is the real one everywhere: ' +
     JSON.stringify(threwOn.slice(0, 4)));
  /* and the same on MID, because a census compares the two */
  let midThrew = null;
  try {
    MID.attempt((api) => {
      const schema = api.getTableSchema(P.tables.A8, '2025');
      api.recomputeTotals(P.tables.A8.data['2025'].map(r => r.slice()), schema, 'A8',
        P.tables.A8.data['2025'].map(r => r.slice()));
      return null;
    });
  } catch (e) { midThrew = e && e.message; }
  ok(midThrew === null,
     'H2 and on ' + MID_REF + ' too, so the two sides of every comparison ' +
     'below are running the same path' + (midThrew ? '  THREW: ' + midThrew : ''));
});

/* ---------------- the five anatomies ---------------------------------- */
const itemised = () => STORED.map(r => r.slice());
const blankRow = (rows, ri) => {
  for (let c = 1; c < SCHEMA.length; c++) rows[ri][c] = null;
  return rows;
};
/* 5 is the owner's: the grand-total row as an ORDINARY STORED ROW with
 * stored values, written by an import-and-save in the era when imports
 * created Total rows as ordinary rows. Replayed, not hand-built: the
 * itemised rows as filed, and both totals written in as a prior FILE's
 * figures, which is the only way that row can hold a number the engine
 * cannot produce. */
const replayed = NEW.attempt((api) => {
  const probe = itemised();
  blankRow(probe, SUBTOTAL); blankRow(probe, GRAND);
  api.recomputeTotals(probe, SCHEMA, ID, itemised());
  const rows = itemised();
  rows[SUBTOTAL] = [STORED[SUBTOTAL][0], probe[SUBTOTAL][1], probe[SUBTOTAL][2], null];
  rows[GRAND] = [STORED[GRAND][0], probe[SUBTOTAL][1], probe[SUBTOTAL][2], null];
  return api.stripDerivedForPersist(rows, ID, SCHEMA);
});
const ANATOMIES = [
  ['1 rowless', []],
  ['2 structural, no figures in the row', blankRow(itemised(), GRAND)],
  ['3 holding a figure its rows do NOT come to',
    (() => { const d = itemised(); d[GRAND][1] = 999999; return d; })()],
  ['4 holding the figure its rows DO come to',
    (() => { const d = itemised(); d[GRAND][1] = d[SUBTOTAL][1]; d[GRAND][2] = d[SUBTOTAL][2]; return d; })()],
  ['5 ordinary stored row, replayed (the hosted anatomy)', replayed],
];

/* a file that fills every itemised figure and files the grand total itself */
function buildFile(rows) {
  const file = [SCHEMA.slice()];
  const staged = [];
  rows.forEach((r, ri) => {
    const out = [r[0], '', '', ''];
    const heading = String(r[1]) === '' && String(r[2]) === '';
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

function runImport(H, rows) {
  if (!rows.length) return { staged: 0, landed: 0, lost: [], named: new Set(), res: null };
  const { file, staged } = buildFile(rows);
  const res = H.attempt(api => api.buildIngestImport(file, SCHEMA,
    rows.map(r => r.slice()), ID));
  const cand = res.candidate || [];
  /* BY LABEL AND OCCURRENCE, against the candidate. Two harness mistakes
   * are behind this and both invented exclusions the app never made:
   *
   *   a bare label lookup resolves all four of A8's "HVAC" rows to the
   *   first one, so three were scored as never having landed;
   *
   *   a bare INDEX lookup assumes the candidate has the draft's rows in the
   *   draft's order, and it need not -- on the structural anatomy the
   *   importer APPENDS a row for a label whose draft row is value-less, so
   *   the figure lands at 26 while the draft's row 25 stays blank.
   *
   * Counting the nth row with a given label answers the only question that
   * matters -- is the preparer's figure in the candidate -- and survives
   * both. */
  const nth = (arr, label, k) => {
    let seen = 0;
    for (let i = 0; i < arr.length; i++) {
      if (String((arr[i] || [])[0]) !== String(label)) continue;
      if (seen === k) return i;
      seen++;
    }
    return -1;
  };
  /* WHERE the figure ended up, per staged cell: the candidate row bearing
   * that label which actually holds it. The draft's own occurrence index is
   * tried first, so an ordinary import reports the row it filled; when the
   * importer appended instead, the search finds the appended row and the
   * cell still counts as landed, because it IS in the table the operator
   * is about to save. Rows with a repeated label hold different figures,
   * so the fallback cannot cross them. */
  const occ = {};
  const place = {};            /* draft row -> candidate row holding it */
  rows.forEach((r, ri) => {
    const lbl = String(r[0]);
    const k = occ[lbl] = (occ[lbl] === undefined ? 0 : occ[lbl] + 1);
    place[ri] = nth(cand, lbl, k);
  });
  const holds = (k) => {
    const [r, c] = k.split(',').map(Number);
    const want = String(file[r + 1][c]);
    const first = place[r];
    if (first >= 0 && cand[first] && String(cand[first][c]) === want) return first;
    const lbl = String(rows[r][0]);
    for (let i = 0; i < cand.length; i++) {
      if (String((cand[i] || [])[0]) === lbl && String(cand[i][c]) === want) return i;
    }
    return -1;
  };
  const landedSet = new Set(staged.filter(k => holds(k) >= 0));
  const named = new Set((res.preparerTotals || []).map((e) => {
    const ri = rows.findIndex(x => String(x[0]) === String(e.label));
    return ri + ',' + SCHEMA.indexOf(e.column);
  }));
  const gr = holds(GRAND + ',1');
  return {
    staged: staged.length,
    landed: landedSet.size,
    lost: staged.filter(k => !landedSet.has(k)),
    named, res,
    added: (res.addedRows || []).length,
    grandAt: gr,
    grandHolds: gr >= 0 && cand[gr] ? [cand[gr][1], cand[gr][2]] : null,
  };
}

/* ============ A. every anatomy, before and after ====================== */
log('A. EVERY ANATOMY, BEFORE AND AFTER');
guard('A-block', () => {
  const rowBearing = [];
  ANATOMIES.forEach(([label, rows]) => {
    const was = runImport(MID, rows), now = runImport(NEW, rows);
    if (!rows.length) {
      log('    ' + label + ': no rows, nothing to file into');
      ok(was.staged === 0 && now.staged === 0,
         'A0 ' + label + ' stages nothing on either build, as it must');
      return;
    }
    rowBearing.push(label);
    const grandWas = [1, 2].every(c => was.landed && was.lost.indexOf(GRAND + ',' + c) < 0);
    const grandNow = [1, 2].every(c => now.lost.indexOf(GRAND + ',' + c) < 0);
    log('    ' + label);
    log('        ' + MID_REF + ': staged ' + was.staged + ' landed ' + was.landed +
        '   grand total ' + (grandWas ? 'kept' : 'DISCARDED') +
        ', named ' + (was.named.has(GRAND + ',1') ? 'yes' : 'no'));
    log('        this build: staged ' + now.staged + ' landed ' + now.landed +
        '   grand total ' + (grandNow ? 'kept' : 'DISCARDED') +
        ', named ' + (now.named.has(GRAND + ',1') ? 'yes' : 'no'));
    ok(grandNow,
       'A1 ' + label + ': the preparer\'s grand total survives the import');
    ok(String((now.grandHolds || [])[0]) === String(F_TOTAL) &&
       String((now.grandHolds || [])[1]) === String(F_DAC),
       'A2 ' + label + ': and the draft holds their figures, ' + F_TOTAL +
       ' and ' + F_DAC + ': ' + JSON.stringify(now.grandHolds));
  });
  ok(rowBearing.length === 4,
     'A3 four row-bearing anatomies were exercised, the rowless one having ' +
     'nothing to file into: ' + rowBearing.length);
  /* THE ONE THAT DID NOT REPRODUCE BEFORE. Anatomies 4 and 5 are where the
   * discard lived, and this block cannot pass on the pre-change build. */
  const four = runImport(MID, ANATOMIES[3][1]), five = runImport(MID, ANATOMIES[4][1]);
  ok(four.lost.indexOf(GRAND + ',1') >= 0 && five.lost.indexOf(GRAND + ',1') >= 0,
     'A4 while on ' + MID_REF + ' anatomies 4 and 5 DISCARD it, so this block ' +
     'cannot pass on the build the ruling was written against');
  ok(four.named.size === 0 && five.named.size === 0,
     'A5 and named nothing when they did: the discard was silent');
});

/* ============ B. staged equals landed ================================= */
log('');
log('B. THE STAGED COUNT AND THE LANDED COUNT AGREE');
guard('B-block', () => {
  ANATOMIES.forEach(([label, rows]) => {
    if (!rows.length) return;
    const now = runImport(NEW, rows);
    ok(now.staged === now.landed && now.lost.length === 0,
       'B1 ' + label + ': staged ' + now.staged + ', landed ' + now.landed +
       ', excluded ' + now.lost.length +
       (now.lost.length ? '  ' + JSON.stringify(now.lost.slice(0, 6)) : ''));
  });
  /* and the reasons the earlier accounting disagreed are recorded, because
   * both were the harness and not the app. */
  const dupes = STORED.map(r => String(r[0])).filter((l, i, a) => a.indexOf(l) !== i);
  ok(dupes.length > 0,
     'B2 A8 really does repeat row labels, which is why a bare label lookup ' +
     'cannot be used: ' + JSON.stringify(Array.from(new Set(dupes))));
  /* THE SECOND ONE IS A REAL BEHAVIOUR AND IS RECORDED, NOT FIXED HERE.
   * On the structural anatomy the draft's grand-total row is value-less,
   * and the importer does not fill it -- it APPENDS a row carrying the
   * preparer's figures, leaving two rows with the same label, one blank and
   * one filled. The app says so in addedRows, so it is disclosed rather
   * than silent, and it is unchanged by this ticket. It is not this
   * ruling's subject and it is raised in the report as its own item. */
  const st = runImport(NEW, ANATOMIES[1][1]);
  const stWas = runImport(MID, ANATOMIES[1][1]);
  ok(st.added === 1 && st.grandAt === STORED.length,
     'B3 the structural anatomy lands its grand total on an APPENDED row (' +
     st.grandAt + '), and addedRows discloses it: ' + st.added);
  ok(stWas.added === st.added,
     'B4 and that is unchanged from ' + MID_REF + ', so it is not this ' +
     'ticket: added ' + stWas.added + ' before, ' + st.added + ' after');
});

/* ============ C. controls on both sides =============================== */
log('');
log('C. BOTH SIDES, IN THE SAME EVIDENCE');
guard('C-block', () => {
  /* ACCEPTED SIDE: A8's grand total has no declared rule. */
  const now = runImport(NEW, ANATOMIES[4][1]);
  ok(now.named.has(GRAND + ',1') && now.named.has(GRAND + ',2'),
     'C1 A8 grand total: both filed cells are NAMED by the kept-figure ' +
     'advisory, not merely kept in silence');
  const decl = NEW.attempt((api) => {
    const cols = new Set(((api.DERIVED_COLS[ID]) || []).map(d => d.column));
    (api.detectSumColumns(SCHEMA, ANATOMIES[4][1], ID) || []).forEach(s => cols.add(s.column));
    return { c1: cols.has(1), c2: cols.has(2) };
  });
  ok(!decl.c1 && !decl.c2,
     'C2 and it is accepted for the stated REASON: no declared rule derives ' +
     'either column');

  /* REFUSED SIDE: A1's Total is a declared derived column and must still
   * refuse, whatever the file offers. This is the control that killed the
   * first withdrawn fix, and it is in the same file as the accepted side so
   * neither can be reported without the other. */
  const A1 = P.tables.A1;
  const y1 = Object.keys(A1.data).sort().pop();
  const s1 = NEW.attempt(api => api.getTableSchema(A1, y1));
  const r1 = A1.data[y1];
  const t1 = r1.findIndex(r => NEW.attempt(api => api.isAnchoredTotalRowLabel(r[0])));
  ok(t1 >= 0, 'C3 A1 has a Total row: r' + t1);
  const declared1 = NEW.attempt(api =>
    ((api.DERIVED_COLS.A1) || []).map(d => d.column));
  const f1 = [s1.slice()].concat(r1.map(r => r.slice()));
  f1[t1 + 1] = f1[t1 + 1].slice();
  declared1.forEach((c) => { f1[t1 + 1][c] = 111111; });
  const res1 = NEW.attempt(api => api.buildIngestImport(f1, s1,
    r1.map(r => r.slice()), 'A1'));
  const held = declared1.map(c => (res1.candidate || [])[t1][c]);
  ok(declared1.length > 0,
     'C4 A1s Total sits in DECLARED derived columns: ' + JSON.stringify(declared1));
  ok(held.every(v => String(v) !== '111111'),
     'C5 and the import still REFUSES 111111 into every one of them: ' +
     JSON.stringify(held));
  const reb1 = NEW.attempt((api) => {
    const c = api.ingestComputed(r1, 'A1', s1);
    return Array.from(api.ingestRebuildableTotals(r1, s1, 'A1', r => c.totalRow(r)));
  });
  ok(declared1.every(c => reb1.indexOf(t1 + ',' + c) >= 0),
     'C6 asserted at the guard as well as observed at the import: the cell ' +
     'is in the refused set ' + JSON.stringify(reb1.slice(0, 6)));
});

/* ============ D. value identity per stored year ======================= */
log('');
log('D. NO PUBLISHED FIGURE MOVES FROM THIS CHANGE ALONE');
guard('D-block', () => {
  let cells = 0;
  const movedT = [];
  Object.keys(P.tables).sort().forEach((id) => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach((y) => {
      const rows = t.data[y];
      if (!rows || !rows.length) return;
      const schema = NEW.attempt(api => api.getTableSchema(t, y));
      const a = MID.attempt(api => api.rowsForDisplay(rows.map(r => r.slice()), schema, id));
      const b = NEW.attempt(api => api.rowsForDisplay(rows.map(r => r.slice()), schema, id));
      rows.forEach((r, i) => { cells += (schema || []).length; });
      if (JSON.stringify(a) !== JSON.stringify(b)) movedT.push(id + ':' + y);
    });
  });
  ok(cells > 1000, 'D1 every stored table-year is compared: ' + cells + ' cells');
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
  const wasK = realBy(MID), nowK = realBy(NEW);
  const movedK = Object.keys(nowK).filter(k => nowK[k] !== wasK[k]);
  ok(movedK.length === 0,
     'D3 and no KPI figure moves: ' + JSON.stringify(movedK.slice(0, 6)));
  /* this guard runs on IMPORT, not on render, so identity is expected --
   * and asserting it is what proves the change is confined to the importer */
  ok(codeOnly(SRC).indexOf('ingestDeclaredDerives') > 0,
     'D4 the change is a new predicate on the import path and nothing else');
});

/* ============ E. the census of record ================================= */
log('');
log('E. THE CENSUS OF RECORD');
guard('E-block', () => {
  const census = (H) => H.attempt((api) => {
    const acc = { refused: 0, undeclared: 0, tables: {} };
    Object.keys(P.tables).sort().forEach((id) => {
      const t = P.tables[id];
      Object.keys(t.data || {}).sort().forEach((y) => {
        const rows = t.data[y];
        if (!rows || !rows.length) return;
        const schema = api.getTableSchema(t, y);
        if (!schema || !schema.length) return;
        const c = api.ingestComputed(rows, id, schema);
        const reb = api.ingestRebuildableTotals(rows, schema, id, r => c.totalRow(r));
        const cols = new Set(((api.DERIVED_COLS[id]) || []).map(d => d.column));
        (api.detectSumColumns(schema, rows, id) || []).forEach(s => cols.add(s.column));
        reb.forEach((k) => {
          acc.refused++;
          if (!cols.has(Number(k.split(',')[1]))) { acc.undeclared++; acc.tables[id] = true; }
        });
      });
    });
    return acc;
  });
  const was = census(MID), now = census(NEW);
  log('    ' + MID_REF + ': refused ' + was.refused + ', of them undeclared ' +
      was.undeclared + ', tables ' + Object.keys(was.tables).length);
  log('    this build: refused ' + now.refused + ', of them undeclared ' + now.undeclared);
  /* 407 AND 240, AND THE HISTORY OF THIS NUMBER IS THE POINT.
   *
   * It has been reported four times: 445/275, then 472/302, then 439/272,
   * and now this. Every earlier figure was taken through
   * ingestRebuildableTotals' exception branch, because that function wraps
   * recomputeTotals in a PRODUCTION try/catch and the catch eats the
   * ReferenceError this harness follows. Sixteen dependencies were being
   * swallowed, and each round of resolving them moved the census again.
   *
   * What makes this one different is not that it is the latest. It is that
   * block H proves, on all 149 stored table-years, that the probe runs --
   * so the figure describes the app. The earlier ones described the
   * harness, and a census with no such proof should not be quoted. */
  ok(was.refused === 407 && was.undeclared === 240,
     'E1 the census of record, measured on ' + MID_REF + ' with the probe ' +
     'proven to run on all 149 table-years: 407 refused, 240 of them with ' +
     'no declared rule -- got ' + was.refused + '/' + was.undeclared);
  ok(Object.keys(was.tables).length === 23,
     'E2 across 23 tables: ' + Object.keys(was.tables).length);
  ok(now.undeclared === 0,
     'E3 and this build refuses no undeclared cell at all: ' + now.undeclared);
  /* THE FIGURES CLOSE, and that is the check: the remainder is measured on a
   * different build by different code, not computed by subtraction here. */
  ok(now.refused === was.refused - was.undeclared,
     'E4 and the three close: ' + was.refused + ' - ' + was.undeclared + ' = ' +
     (was.refused - was.undeclared) + ', measured independently as ' + now.refused);
});

/* ============ F. WHAT THIS FIX DOES NOT REACH ======================== */
log('');
log('F. THE SECOND SURFACE, WHICH THIS TICKET DOES NOT FIX');
guard('F-block', () => {
  /* THE IMPORT GUARD IS HALF THE PATH, and the browser half of this
   * evidence is what found it. The import now accepts the preparer's
   * grand total and the amber advisory names it -- and the editor's very
   * next recomputeTotals overwrites it, because that function writes any
   * row totalRowFlags confirms and the classifier there still reads
   * values.
   *
   * Measured end to end on anatomy 5:
   *
   *     after the import     777 / 222      the advisory's claim
   *     after the recompute  283,936        the engine's column sum
   *     what a SAVE writes   283,936
   *     what the REPORT shows 283,936
   *
   * So shipped ALONE this change makes the advisory describe an outcome
   * that does not happen, which is exactly the defect CLCPA-309 was raised
   * for. These assertions exist so that fact travels with the code and
   * nobody merges this believing the ticket is closed. They pass on the
   * CURRENT behaviour: they are a record, not a gate. */
  const rows = ANATOMIES[4][1].map(r => r.slice());
  const { file } = buildFile(rows);
  const res = NEW.attempt(api => api.buildIngestImport(file, SCHEMA,
    rows.map(r => r.slice()), ID));
  const cand = res.candidate.map(r => r.slice());
  const atImport = [cand[GRAND][1], cand[GRAND][2]];
  NEW.attempt(api => api.recomputeTotals(cand, SCHEMA, ID,
    rows.map(r => r.slice())));
  const afterRecompute = [cand[GRAND][1], cand[GRAND][2]];
  const saved = NEW.attempt(api => api.stripDerivedForPersist(
    cand.map(r => r.slice()), ID, SCHEMA));
  const atSave = [saved[GRAND][1], saved[GRAND][2]];
  log('    after the import      : ' + JSON.stringify(atImport));
  log('    after the recompute   : ' + JSON.stringify(afterRecompute));
  log('    what a SAVE writes    : ' + JSON.stringify(atSave));
  ok(String(atImport[0]) === String(F_TOTAL),
     'F1 the import accepts the preparer\'s figure, which is what this ' +
     'ticket fixes: ' + JSON.stringify(atImport));
  ok(String(afterRecompute[0]) !== String(F_TOTAL),
     'F2 and the editor\'s recompute then overwrites it, which this ticket ' +
     'does NOT fix: ' + JSON.stringify(afterRecompute));
  ok(String(atSave[0]) !== String(F_TOTAL),
     'F3 so the figure the advisory calls "taken as filed" is not what a ' +
     'save writes: ' + JSON.stringify(atSave));
  /* and the size of the surface, so the next ruling has a number */
  const wider = NEW.attempt((api) => {
    let maintained = 0, unclaimed = 0;
    Object.keys(P.tables).sort().forEach((id) => {
      const t = P.tables[id];
      Object.keys(t.data || {}).sort().forEach((y) => {
        const rr = t.data[y];
        if (!rr || !rr.length) return;
        const schema = api.getTableSchema(t, y);
        if (!schema || !schema.length) return;
        const flags = api.totalRowFlags(rr, id, schema) || [];
        const decl = api.ingestDeclaredDerives(schema, rr, id);
        rr.forEach((r, i) => {
          if (!flags[i]) return;
          for (let c = 1; c < schema.length; c++) {
            if (r[c] == null || r[c] === '') continue;
            maintained++;
            if (!decl(i, c)) unclaimed++;
          }
        });
      });
    });
    return { maintained, unclaimed };
  });
  log('    total-row cells the editor maintains : ' + wider.maintained);
  log('    of those, no declared rule claims    : ' + wider.unclaimed);
  ok(wider.unclaimed > 200,
     'F4 and applying the same doctrine to the editor is NOT the answer: it ' +
     'would stop the editor maintaining ' + wider.unclaimed + ' of ' +
     wider.maintained + ' total cells, and keeping a total in step with its ' +
     'rows is a feature. The narrow fix is to protect the cells an import ' +
     'just accepted, and that is a second surface and a second ruling.');
});

/* ============ G. WHY THIS WAS WITHDRAWN =============================== */
log('');
log('G. THE COLLISION WITH CLCPA-88, WHICH IS WHY THIS DOES NOT SHIP');
guard('G-block', () => {
  /* The ruling's own control condition says A1's Total "HAS a declared
   * rule" and must still be refused. Block C shows that is true of ONE
   * column. A1's schema is
   *
   *     ["Program Name","Total Funds Expended ($)","DAC Funding ($)","% in DACs"]
   *
   * and DERIVED_COLS.A1 declares column 3 alone. Columns 1 and 2 of the
   * Total row are plain additive totals: the engine rebuilds them through
   * recomputeTotals' generic path, which is a RULE but not a REGISTRY
   * ENTRY. So the doctrine, read literally, hands them to the preparer.
   *
   * suite_293's own D block calls that "the CLCPA-88 defect coming back",
   * and it is the same guard that killed the first withdrawn fix in round
   * 2. It caught this one too, on the regression sweep, running last. */
  const A1 = P.tables.A1;
  const y1 = Object.keys(A1.data).sort().pop();
  const s1 = MID.attempt(api => api.getTableSchema(A1, y1));
  const r1 = A1.data[y1];
  const t1 = r1.findIndex(r => String(r[0]).trim().toLowerCase() === 'total');
  ok(t1 >= 0, 'G1 A1 has a Total row: r' + t1);
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
  const was = run(MID), now = run(NEW);
  log('    shipped   : taken from the preparer ' + was.taken +
      ', the row holds ' + JSON.stringify(was.holds));
  log('    candidate : taken from the preparer ' + now.taken +
      ', the row holds ' + JSON.stringify(now.holds));
  ok(was.taken === 0 && String(was.holds[0]) !== '111111',
     'G2 the SHIPPED build refuses 111111 into A1s Total, which is the ' +
     'protection CLCPA-88 exists for');
  ok(now.taken > 0 && String(now.holds[0]) === '111111',
     'G3 and THE CANDIDATE ACCEPTS IT: ' + now.taken + ' cells taken from ' +
     'the preparer, the row now holding ' + JSON.stringify(now.holds) +
     '. That is the defect coming back, and it is why this is not shipped');
  /* the size of the collision, so the corrected design has a number */
  const wide = NEW.attempt((api) => {
    let tot = 0, handed = 0;
    Object.keys(P.tables).sort().forEach((id) => {
      const t = P.tables[id];
      Object.keys(t.data || {}).sort().forEach((y) => {
        const rr = t.data[y];
        if (!rr || !rr.length) return;
        const schema = api.getTableSchema(t, y);
        if (!schema || !schema.length) return;
        const flags = api.totalRowFlags(rr, id, schema) || [];
        const decl = api.ingestDeclaredDerives(schema, rr, id);
        rr.forEach((r, i) => {
          if (!flags[i]) return;
          for (let c = 1; c < schema.length; c++) {
            if (r[c] == null || r[c] === '') continue;
            tot++;
            if (!decl(i, c)) handed++;
          }
        });
      });
    });
    return { tot, handed };
  });
  ok(wide.handed > 200,
     'G4 and it is not one table: ' + wide.handed + ' of ' + wide.tot +
     ' total-row cells the engine rebuilds today would be handed to the ' +
     'preparer, because a generic additive total is not a registry entry');
});

/* ============ X. the baseline ========================================= */
log('');
log('X. THE BASELINE');
guard('X-block', () => {
  ok(/^[0-9a-f]{7,40}$/.test(MID_REF), 'X1 MID is a literal commit sha: ' + MID_REF);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + MID_REF + ' HEAD', { cwd: ROOT }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'X2 and HEAD descends from it');
  ok(codeOnly(MID_SRC).indexOf('ingestDeclaredDerives') < 0,
     'X3 the SHIPPED build has no such predicate: this change is not in it');
  ok(codeOnly(SRC).indexOf('ingestDeclaredDerives') > 0,
     'X4 while the candidate does, so the two sides really differ');
});

log('');
log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
if (fail) process.exit(1);
