/* CLCPA-303 round 2 acceptance: the kept-figure contract reaches the COLUMN
 * axis, and nothing is ever dropped in silence.
 *
 * The ruling: "the import path must ingest a filed value found in the Total
 * row ... keep it per the kept-figure pattern, and name it with the amber
 * advisory ... If any value in a computed cell is ever excluded rather than
 * kept, the exclusion must be named in the staging count and the import
 * result box, never silent."
 *
 * Driven through buildIngestImport, the real parse, on BOTH builds: BASE is
 * pinned and must still drop the figure, or this suite is not guarding the
 * defect it was written for. The browser legs (repro_303_r2, before/after)
 * carry the rendered half; this pins the logic.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-303-r2-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || 'cb93541';
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
const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

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
    for (let r = 0; r < 500; r++) {
      try {
        if (!api) {
          api = new Function('PAYLOAD', 'const state = { payload: PAYLOAD };\n' +
            'const document = undefined;\n' +
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
  return { attempt, have };
}

const WANT = ['buildIngestImport', 'ingestComputed', 'getTableSchema',
  'ingestFiledTotalReason', 'ingestDeclaredTotalCell', 'isB7PreparerTotal',
  'ingestStagedSummary', 'DERIVED_COLS', 'isTotalOnlyDerived',
  'ingestRebuildableTotals', 'detectSumColumns', 'totalRowFlags',
  'columnGrandTotals', 'parseNumericInput', 'ingestKeyColCount'];
const NEW = harness(SRC, WANT), OLD = harness(BASE_SRC, WANT);

/* ---- the fixture: B2/2098, the ruling's own gesture ------------------ */
const SCHEMA = ['Category', 'L2 Plugs', 'DCFC Plugs',
  'Micromobility Power Cabinets', 'Total Plugs'];
const DRAFT = [['DAC', 143, 10, 0, 153], ['Non-DAC', 100, 40, 0, 140],
  ['Total', 243, 50, 0, 293]];
/* the file the operator saves from the template: markers everywhere the
 * engine computes, and 999 typed over ONE of them */
const FILE = [
  SCHEMA.slice(),
  ['DAC', '143', '10', '0', '(calculated)'],
  ['Non-DAC', '100', '40', '0', '(calculated)'],
  ['Total', '999', '(calculated)', '(calculated)', '(calculated)'],
];
const run = (H, file) => H.attempt(api =>
  api.buildIngestImport(file || FILE, SCHEMA, DRAFT.map(r => r.slice()), 'B2'));

log('CLCPA-303 round 2: a filed column total, kept and named');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ---- A. the reader, and that it is ONE reader ------------------------ */
log('A. ONE READER, NAMING THE RULE THAT CLAIMED THE CELL');
guard('A  structure', () => {
  const code = codeOnly(SRC);
  ok(/function ingestFiledTotalReason\(computed, tableId, schema, rowLabel, r, c, rebuildable\)/
    .test(code), 'A1 ingestFiledTotalReason is declared');
  ok(/function ingestDeclaredTotalCell\(tableId, colIndex\)/.test(code),
    'A2 ingestDeclaredTotalCell is declared');
  ok(/return 'registry';/.test(code) && /return 'declared';/.test(code) &&
    /return 'unrebuildable';/.test(code),
  'A3 it returns the three reasons rather than a boolean');
  ok(/const reason = ingestFiledTotalReason\(computed, tableId, schema,/.test(code),
    'A4 the import path asks it');
  ok(!/const b7 = isB7PreparerTotal\(tableId, candidate\[t\.rowIdx\]\[0\], schema\[cIdx\]\);/
    .test(code), 'A5 and no longer carries the registry test inline');
  /* the two widenings SHARE this reader, which is the interaction the owner
   * asked to be declared rather than built as two copies */
  const fn = code.slice(code.indexOf('function ingestFiledTotalReason'));
  ok(/isB7PreparerTotal/.test(fn.slice(0, 900)),
    'A6 the CLCPA-293 registry is consulted inside it');
  ok(/ingestDeclaredTotalCell/.test(fn.slice(0, 900)),
    'A7 and so is this rounds declared column total');
  ok(/d\.type === 'columnTotal'/.test(
    code.slice(code.indexOf('function ingestDeclaredTotalCell'),
      code.indexOf('function ingestDeclaredTotalCell') + 400)),
  'A8 the declared test reads the RULE TYPE, not a value probe');
});

/* ---- B. the reader answers correctly, per axis ----------------------- */
log('');
log('B. WHAT THE READER SAYS ABOUT EACH CELL');
guard('B  reasons', () => {
  const answer = (tableId, schema, rows, r, c) => NEW.attempt((api) => {
    const computed = api.ingestComputed(rows, tableId, schema);
    /* the signature the import path itself uses: a PREDICATE, not the
     * classifier object. Guessed wrong first, and the throw named it. */
    const reb = api.ingestRebuildableTotals(rows, schema, tableId,
      (i) => computed.totalRow(i));
    return api.ingestFiledTotalReason(computed, tableId, schema,
      (rows[r] || [])[0], r, c, reb);
  });
  ok(answer('B2', SCHEMA, DRAFT, 2, 1) === 'declared',
    'B1 B2 Total row / L2 Plugs is a DECLARED column total: ' +
    answer('B2', SCHEMA, DRAFT, 2, 1));
  ok(answer('B2', SCHEMA, DRAFT, 2, 4) === 'declared',
    'B2 so is the corner where both axes cross');
  /* A1's percentage column is CLCPA-88's protection and must stay refused */
  const a1s = NEW.attempt(api => api.getTableSchema(P.tables.A1, '2025'));
  const a1r = P.tables.A1.data['2025'];
  const a1t = a1r.findIndex(r => String(r[0]).trim().toLowerCase() === 'total');
  ok(answer('A1', a1s, a1r, a1t, 3) === null,
    'B3 A1 Total row / % in DACs is claimed by NOBODY, so it stays refused: ' +
    JSON.stringify(answer('A1', a1s, a1r, a1t, 3)));
  ok(NEW.attempt(api => api.ingestDeclaredTotalCell('A1', 3)) === false,
    'B4 because a percentage is not a columnTotal');
  ok(NEW.attempt(api => api.ingestDeclaredTotalCell('B2', 1)) === true,
    'B5 while B2s L2 Plugs is one');
  /* and it can only ever speak about a total row */
  ok(answer('B2', SCHEMA, DRAFT, 0, 1) !== 'declared',
    'B6 a BODY row is never claimed by the declared rule');
});

/* ---- C. the real parse, both builds --------------------------------- */
log('');
log('C. THE REAL PARSE, DRIVEN ON BOTH BUILDS');
guard('C  now', () => {
  const r = run(NEW);
  const kept = (r.preparerTotals || []).filter(x => x.column === 'L2 Plugs' &&
    String(x.label).trim() === 'Total');
  ok(kept.length === 1, 'C1 the filed 999 is taken as filed: ' + kept.length + ' cell');
  ok(kept.length === 1 && kept[0].value === 999,
    'C2 at its filed value: ' + (kept[0] && kept[0].value));
  ok(kept.length === 1 && kept[0].itemised === 243,
    'C3 and the advisory carries what the rows itemise: ' + (kept[0] && kept[0].itemised));
  ok(kept.length === 1 && kept[0].reason === 'declared',
    'C4 claimed by the declared rule, not by the registry: ' + (kept[0] && kept[0].reason));
  ok(r.candidate[2][1] === 999,
    'C5 the draft carries it: ' + r.candidate[2][1]);
  ok((r.populated || []).length === 7,
    'C6 seven values land where six did: ' + (r.populated || []).length);
});
guard('D  BASE ' + BASE, () => {
  const r = run(OLD);
  const kept = (r.preparerTotals || []).filter(x => x.column === 'L2 Plugs');
  ok(kept.length === 0, 'D1 BASE takes nothing as filed: ' + kept.length);
  ok(r.candidate[2][1] === 243,
    'D2 BASE leaves the computed figure in the draft: ' + r.candidate[2][1]);
  ok((r.populated || []).length === 6,
    'D3 BASE lands six values: ' + (r.populated || []).length);
  const silent = (r.notTouched.computed || []).filter(x => x.filed != null);
  ok(silent.length === 0,
    'D4 and records nothing about what it dropped, which is the defect: ' +
    silent.length);
});

/* ---- E. nothing is dropped in silence any more ---------------------- */
log('');
log('E. A REFUSAL IS NAMED, IN BOTH PLACES THE RULING NAMES');
guard('E  the refusal record', () => {
  const a1s = NEW.attempt(api => api.getTableSchema(P.tables.A1, '2025'));
  const a1r = P.tables.A1.data['2025'];
  const a1t = a1r.findIndex(r => String(r[0]).trim().toLowerCase() === 'total');
  const file = [a1s.slice()].concat(a1r.map((row, i) => {
    const o = row.map(v => v == null ? '' : String(v));
    /* THE TEMPLATE'S OWN SHAPE: every computed cell carries a marker,
     * which is what a real round trip looks like. The first cut filed the
     * Total row's own sums as text too, and the parse refused all three --
     * correctly, but it measured a file no operator downloads. */
    if (i === a1t) { for (let c = 1; c < o.length; c++) o[c] = '(calculated)'; }
    o[3] = (i === a1t) ? '88' : '(calculated)';
    return o;
  }));
  const r = NEW.attempt(api => api.buildIngestImport(file, a1s,
    a1r.map(x => x.slice()), 'A1'));
  const refused = (r.notTouched.computed || []).filter(x => x.filed != null);
  ok(refused.length === 1, 'E1 the refused figure is recorded: ' + refused.length);
  ok(refused.length === 1 && refused[0].filed === '88',
    'E2 with the value the file gave: ' + (refused[0] && refused[0].filed));
  ok(refused.length === 1 && /calculated from the other columns/.test(refused[0].why),
    'E3 and why it was refused');
  /* THE MARKER IS NOT A FILED VALUE. Every other computed cell in that file
   * carries "(calculated)", and announcing those would bury the one figure
   * the operator actually typed. */
  ok(refused.length === 1,
    'E4 the markers left in the file are not announced as refusals');
  /* and the staging line says so BEFORE anything is imported */
  const staged = NEW.attempt(api => api.ingestStagedSummary(
    { name: 'A1.csv', dry: r }, { existing: true }));
  ok(/will not be imported/.test(staged),
    'E5 the staging count announces it: ' + JSON.stringify(staged.slice(-96)));
  ok(/1 filed value in calculated cell will not be imported/.test(staged),
    'E6 counted, singular, and named');
  const clean = NEW.attempt(api => api.ingestStagedSummary(
    { name: 'B2.csv', dry: run(NEW) }, { existing: true }));
  ok(!/will not be imported/.test(clean),
    'E7 and says nothing when nothing is refused: ' + JSON.stringify(clean.slice(-60)));
});
guard('F  the rendered notice', () => {
  const code = codeOnly(SRC);
  ok(/function renderRefusedFiledNotice\(list\)/.test(code),
    'F1 renderRefusedFiledNotice is declared');
  ok(/renderRefusedFiledNotice\(r\.notTouched && r\.notTouched\.computed\)/.test(code),
    'F2 the result box renders it');
  const fn = code.slice(code.indexOf('function renderRefusedFiledNotice'));
  ok(/is-alert/.test(fn.slice(0, 900)),
    'F3 in the alert box, not the amber one: a refusal is not an advisory');
  ok(/x\.filed != null/.test(fn.slice(0, 900)),
    'F4 listing only cells that carried a filed value');
});

/* ---- G. the row axis is untouched ----------------------------------- */
log('');
log('G. THE ROW AXIS, WHICH ALREADY WORKED, IS UNCHANGED');
guard('G  row axis', () => {
  const rowFile = [
    SCHEMA.slice(),
    ['DAC', '143', '10', '0', '900'],
    ['Non-DAC', '100', '40', '0', '(calculated)'],
    ['Total', '(calculated)', '(calculated)', '(calculated)', '(calculated)'],
  ];
  const n = run(NEW, rowFile), o = run(OLD, rowFile);
  ok(n.candidate[0][4] === 900 && o.candidate[0][4] === 900,
    'G1 a filed row total is kept on both builds');
  ok((n.reconcileNotices || []).length === (o.reconcileNotices || []).length,
    'G2 and reconciles identically: ' + (n.reconcileNotices || []).length +
    ' vs ' + (o.reconcileNotices || []).length);
});

log('');
log(pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
