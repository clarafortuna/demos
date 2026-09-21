/* CLCPA-246: G1's "Systemwide Total" flagged but not computing on an
 * imported year, and the Executive Summary missing G1's value.
 *
 * THE TICKET'S OWN DIAGNOSIS, which this tests rather than repeats:
 *   "Systemwide Total" does not match isStrictTotalRowLabel (not the bare
 *   word), so CLCPA-240's value-less bootstrap never reaches it. G1 is flat,
 *   so the positional branch scoped to A5/A6/A7/A8 does not either. CLCPA-245
 *   R2 FLAGS it by anchored suffix, but flagging is not computing. The gap is
 *   the recompute path for a FLAT NON-STRICT total on a value-less import.
 *
 * WHY IT IS RE-MEASURED AGAINST THE CLCPA-319 BUILD. That build declares a
 * columnTotal rule on G1 to G9 and identifies its own row BY LABEL --
 * isAnchoredTotalRowLabel, the same anchored suffix that flags the row --
 * rather than by the value-dependent classifier. If the diagnosis is right,
 * the rule reaches exactly the row the bootstrap cannot.
 *
 * The ticket's figures are used verbatim: 9,999 DAC and 999 non-DAC, with the
 * Systemwide Total row present and value-less, as an import leaves it.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'probe-246-g1-import-output.txt');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

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

const H = harness(SRC, ['rowsForDisplay', 'getTableSchema', 'totalRowFlags',
  'recomputeTotals', 'isAnchoredTotalRowLabel', 'isStrictTotalRowLabel',
  'DERIVED_COLS', 'DAC_KPI_REPORTED', 'dacCell',
  'stripDerivedForPersist',
  /* LISTED EXPLICITLY, and they have to be. dacCell now falls back to the
   * display view inside a try/catch, so a ReferenceError for one of these
   * is SWALLOWED rather than raised -- the assembler never sees it, never
   * adds the dependency, and the cell reads as null. It reported the fix as
   * not working when the fix was fine. */
  'dacBody', 'dacRow', 'dacCol']);

log('CLCPA-246: G1s Systemwide Total on an imported, value-less year');
log('app.js: ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* THE TICKET'S OWN YEAR, built as an import leaves it: the two data rows
 * carry the figures, the total row carries its label and nothing else. */
const schema = H.attempt(api => api.getTableSchema(P.tables.G1, '2025'));
const imported = [
  ['Feet Replaced within DAC', 9999, null],
  ['Feet Replaced not in a DAC', 999, null],
  ['Systemwide Total', null, null],
];
log('  schema: ' + JSON.stringify(schema));
imported.forEach((r, i) => log('    r' + i + ' ' + JSON.stringify(r)));
log('');

/* ---- the three predicates the ticket names ------------------------- */
log('=== the predicates, on "Systemwide Total" ==========================');
const label = 'Systemwide Total';
log('  isStrictTotalRowLabel   : ' +
    H.attempt(api => api.isStrictTotalRowLabel(label)) +
    '   <- why CLCPA-240s value-less bootstrap never reaches it');
log('  isAnchoredTotalRowLabel : ' +
    H.attempt(api => api.isAnchoredTotalRowLabel(label)) +
    '   <- why CLCPA-245 R2 flags it');
/* HIERARCHICAL_TABLES is NOT requested from the assembler: its slice comes
 * back empty, and an empty Set silently changes what totalRowFlags does.
 * The membership question is answered off the source text instead. */
const hierSrc = /const HIERARCHICAL_TABLES = new Set([([^]]*)]/.exec(SRC);
const hier = hierSrc ? hierSrc[1].split(',').map(x => x.trim().replace(/['"]/g, '')).filter(Boolean) : [];
log('  G1 in HIERARCHICAL_TABLES: ' + (hier.indexOf('G1') >= 0) +
    '   <- why the positional branch does not reach it either');
log('  hierarchical tables: ' + JSON.stringify(hier));
log('');

/* ---- what the classifier says, and what the engine does ------------ */
log('=== flagged, and computed? ========================================');
const flags = H.attempt(api => api.totalRowFlags(imported, 'G1', schema)) || [];
log('  totalRowFlags: ' + JSON.stringify(flags) +
    '   (r2 flagged = ' + !!flags[2] + ')');

const declared = H.attempt(api => (api.DERIVED_COLS.G1 || []).map(d => d.type + '@' + d.column));
log('  DERIVED_COLS.G1: ' + JSON.stringify(declared));

/* THE REPORT PAGE */
const disp = H.attempt(api => api.rowsForDisplay(imported, schema, 'G1', { fillTotals: true }));
log('');
log('  the REPORT PAGE renders:');
disp.forEach((r, i) => log('    r' + i + ' ' + JSON.stringify(r)));
const totalShown = disp[2] ? disp[2][1] : undefined;
log('');
log('  Systemwide Total, Feet Replaced: ' + JSON.stringify(totalShown) +
    '   (the rows come to ' + (9999 + 999) + ')');

/* THE EDITOR */
const draft = imported.map(r => r.slice());
H.attempt(api => api.recomputeTotals(draft, schema, 'G1', imported.map(r => r.slice())));
log('  recomputeTotals called in ISOLATION gives: ' + JSON.stringify(draft[2]));
log('    (the percentage here is NOT what the editor shows. Driven in a real');
log('     browser the grid reads 100.00%; calling recomputeTotals on its own,');
log('     outside the editor flow, is not the editor. repro_246.js is the');
log('     authority and it reads the grid.)');

/* ---- the Executive Summary KPI ------------------------------------- */
log('');
log('=== the Executive Summary, which the ticket asks to attribute ======');
const kpiKeys = H.attempt(api => Object.keys(api.DAC_KPI_REPORTED || {}));
log('  KPI keys: ' + JSON.stringify(kpiKeys));
const mains = kpiKeys.filter(k => /main|pipe|leak/i.test(k));
log('  the one this ticket names (Mains / main_replacement): ' +
    JSON.stringify(mains));
if (mains.length) {
  /* feed the imported year through the KPI's own accessor */
  const T = JSON.parse(JSON.stringify(P.tables));
  T.G1.data['2098'] = imported.map(r => r.slice());
  T.G1.schema_by_year = T.G1.schema_by_year || {};
  /* NO try/catch AROUND THE CALL. The assembler resolves a missing dependency
   * by catching the ReferenceError and adding it, so swallowing that error
   * here reported "THREW dacRow is not defined" as though it were the app's
   * behaviour. It was mine. */
  log('    the two cells the KPI reads, on the imported year:');
  log('      total (Systemwide Total / Feet Replaced): ' + JSON.stringify(
    H.attempt(api => api.dacCell(T, 'G1', '2098', /^Systemwide Total$/i, /^Feet Replaced$/i))));
  log('      dac   (within DAC / Feet Replaced)      : ' + JSON.stringify(
    H.attempt(api => api.dacCell(T, 'G1', '2098', /within DAC/i, /^Feet Replaced$/i))));
  mains.forEach((k) => {
    log('    ' + k + '(2098, imported) -> ' +
      JSON.stringify(H.attempt(api => api.DAC_KPI_REPORTED[k](T, '2098'))));
    log('    ' + k + '(2025, stored)   -> ' +
      JSON.stringify(H.attempt(api => api.DAC_KPI_REPORTED[k](P.tables, '2025'))));
  });
}

/* ---- AND THE QUESTION CLCPA-319 RAISES FOR THIS KPI ------------------
 *
 * The KPI reads a STORED cell. CLCPA-319 makes G's total a derived figure and
 * STRIPS it on persist, so after any save through the editor the stored total
 * row is null by design. If the KPI reads storage rather than the display
 * view, that is a regression this ticket has to catch rather than inherit. */
log('');
log('=== what the KPI sees AFTER a save, with CLCPA-319 stripping ========');
const stripped = H.attempt(api =>
  api.stripDerivedForPersist(P.tables.G1.data['2025'].map(r => r.slice()), 'G1', schema));
log('  G1/2025 as it persists after a save: ' + JSON.stringify(stripped));
const T2 = JSON.parse(JSON.stringify(P.tables));
T2.G1.data['2025'] = stripped;
mains.slice(0, 1).forEach((k) => {
  log('    ' + k + '(2025, after a save) -> ' +
    JSON.stringify(H.attempt(api => api.DAC_KPI_REPORTED[k](T2, '2025'))));
});
log('');
log('  AND THROUGH THE COMPOSED LAYER, which is what the hosted app reads:');
log('  composePayloadFromRows rebuilds the payload from stored rows, and the');
log('  report page renders through rowsForDisplay. The question is whether the');
log('  KPI is fed the stored rows or the displayed ones.');
const kpiSrc = (function () {
  const c = SRC.replace(/\/\*[\s\S]*?\*\//g, '');
  const i = c.indexOf('main_replacement:');
  return i < 0 ? '(not found)' : c.slice(i, c.indexOf('\r\n', c.indexOf('}),', i))).trim();
})();
log('    main_replacement reads: ' + JSON.stringify(kpiSrc).slice(0, 300));

log('');
log('--- verdict ------------------------------------------------------------');
if (totalShown === 10998) {
  log('  THE TOTAL COMPUTES: ' + totalShown + ', which is 9,999 + 999.');
  log('  The ticket DIES with the CLCPA-319 build, and for exactly the reason');
  log('  its own audit note predicted: the gap was the recompute path for a');
  log('  FLAT NON-STRICT total on a value-less import, and the columnTotal');
  log('  rule identifies its row by the SAME anchored suffix that flags it,');
  log('  so it reaches the row the strict-label bootstrap cannot.');
} else {
  log('  THE TOTAL IS STILL ' + JSON.stringify(totalShown) + ': the ticket survives.');
}

fs.writeFileSync(OUT, lines.join('\n') + '\n');
