const _dacRepo = () => {
  const p = require('path'), f = require('fs');
  if (process.env.DAC_REPO) return p.resolve(process.env.DAC_REPO);
  let d = __dirname;
  for (let i = 0; i < 16; i++) {
    if (f.existsSync(p.join(d, '.clcpa-root'))) {
      const two = p.resolve(d, '..', '..');
      return f.existsSync(p.join(two, '.git')) ? two : d;
    }
    const u = p.dirname(d); if (u === d) break; d = u;
  }
  throw new Error('CLCPA project root not found above ' + __dirname + '; set DAC_REPO');
};
/* CLCPA-272 -- a filed total is reconciled against its own parts.
 *
 * H1's per-row Grand Total was preparer-entered and nothing checked it. The
 * probe filed Westchester 1,500 against a true 666 + 777 = 1,443: it imported,
 * saved and published clean, the total row stopped reconciling with itself,
 * the header KPI computed from the bad figure, and the borough chart -- which
 * recomputes the row -- disagreed with the table on screen.
 *
 * RULED OPTION (b): reconcile on import and on save, advise in the amber box,
 * name the row, never reject, never compute over the preparer's figure.
 *
 * The relationship is DERIVED from the schema. No table, borough or column is
 * named in the code. The two false-positive traps this had to survive are both
 * pinned below: a second LABEL column (F4/F5 carry two) and a blank schema
 * heading that is a real column named in a SECOND header row (F6, header_levels 2).
 *
 * BASE predates the change: 6972a74, this branch's parent (CLCPA-250's tip).
 *
 * Run:  node suite_272.js
 */
const fs = require('fs');
const { execFileSync } = require('child_process');

const REPO = _dacRepo() + '';
const APP = process.env.DAC_APP_OVERRIDE || (REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const PAYLOAD = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/payload.json';
const BASE = process.env.DAC_BASE_COMMIT || '6972a74';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';

const SRC = fs.readFileSync(APP, 'utf8');
const P = JSON.parse(fs.readFileSync(PAYLOAD, 'utf8'));
const baseSrc = execFileSync('git', ['show', BASE + ':' + REL],
  { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 }).replace(/\r?\n/g, '\r\n');

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, label) => { if (c) { pass++; log('  ok   ' + label); }
  else { fail++; log('  FAIL ' + label); } };
const guard = (label, fn) => {
  try { fn(); } catch (e) { fail++; log('  FAIL ' + label + ' -- THREW: ' + (e && e.message)); }
};
const codeOnly = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p);
const clone = (o) => JSON.parse(JSON.stringify(o));

function api(src, want) {
  const L = src.split('\r\n'); const TOP = [];
  L.forEach((ln, n) => { const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n }); });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (n) => { const k = TOP.findIndex(d => d.name === n);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n'); };
  const parts = [], have = new Set();
  const add = (n) => { if (have.has(n)) return false; const f = find(n);
    if (!f) return false; have.add(n); parts.push(f); return true; };
  want.forEach(add);
  const make = () => new Function('const state={};' + parts.join('\n\n') +
    '\nreturn {' + want.join(',') + '};')();
  return (fn) => {
    for (let r = 0; r < 500; r++) {
      try { return fn(make()); }
      catch (e) { const m = /(\w+) is not defined/.exec(e.message);
        if (m && add(m[1])) continue; throw e; }
    }
    throw new Error('dependency resolution did not converge');
  };
}
const now = api(SRC, ['detectSumColumns', 'reconcileSumColumns',
  'renderReconcileNotice', 'buildIngestImport']);

const tableYears = [];
Object.keys(P.tables).sort().forEach(id =>
  Object.keys(P.tables[id].schema_by_year || {}).sort().forEach(y => tableYears.push([id, y])));

log('======================================================================');
log('CLCPA-272 -- a filed total is reconciled against its own parts');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('  stored table-years: ' + tableYears.length);
log('======================================================================');

/* ---- A. the probe ------------------------------------------------------- */
log('');
log('A. THE PROBE FROM THE TICKET: Westchester 1,500 against 666 + 777');
guard('A-block', () => {
  const H = P.tables.H1, schema = H.schema_by_year['2025'];
  const rows = H.data['2025'].map(r => r.slice());
  rows[2] = ['Westchester', 666, 777, 1500];
  const found = now(a => a.reconcileSumColumns(rows, schema, 'H1'));
  ok(found.length === 1, 'A1 exactly one row is flagged -- found ' + found.length);
  ok(found[0] && found[0].label === 'Westchester', 'A2 and it NAMES the row');
  ok(found[0] && found[0].filed === 1500 && found[0].computed === 1443,
    'A3 reporting filed 1500 against a computed 1443');
  ok(found[0] && found[0].column === 'Grand Total', 'A4 and names the column');
  ok(found[0] && found[0].parts.join(' + ') === 'Non-DAC Repairs + DAC Repairs',
    'A5 and the parts it was reconciled against');

  /* THE PREPARER'S FIGURE IS UNTOUCHED. This is the ruling: advise, never
   * compute over it. */
  ok(rows[2][3] === 1500, 'A6 the filed value is NOT overwritten -- 1500 still stands');
  const before = JSON.stringify(rows);
  now(a => a.reconcileSumColumns(rows, schema, 'H1'));
  ok(JSON.stringify(rows) === before, 'A7 and the function is pure: the rows are unchanged');
});

/* ---- B. NO FALSE POSITIVES ON STORED DATA ------------------------------- */
log('');
log('B. THE GATE: no stored table-year may be flagged');
guard('B-block', () => {
  let flagged = 0, checked = 0;
  const detail = [];
  tableYears.forEach(([id, y]) => {
    const schema = P.tables[id].schema_by_year[y];
    const rows = (P.tables[id].data || {})[y] || [];
    const f = now(a => a.reconcileSumColumns(rows, schema, id));
    checked++;
    if (f.length) { flagged += f.length; detail.push(id + ':' + y + ' x' + f.length); }
  });
  log('     stored table-years checked: ' + checked + '   rows flagged: ' + flagged);
  ok(checked === tableYears.length && checked > 100,
    'B1 every stored table-year was reconciled (' + checked + ')');
  ok(flagged === 0,
    'B2 NOT ONE stored row is flagged -- ' + flagged + ' flagged' +
    (detail.length ? ': ' + detail.slice(0, 6).join(', ') : ''));
});

/* ---- C. the two false-positive traps ------------------------------------ */
log('');
log('C. THE TRAPS THIS HAD TO SURVIVE');
guard('C-block', () => {
  /* TRAP 1: a second LABEL column. F4 and F5 carry "Load Area" then
   * "Borough / County", both text. A header-only rule offered the second as
   * an addend. */
  const f4 = P.tables.F4;
  const rel4 = now(a => a.detectSumColumns(f4.schema_by_year['2025'], f4.data['2025'], 'F4'));
  ok(rel4.length === 1, 'C1 F4 has one sum relationship');
  ok(rel4[0].parts.indexOf(1) < 0,
    'C2 and "Borough / County" (column 1, text) is NOT one of its parts');
  ok(rel4[0].parts.length === 2, 'C3 its parts are the two numeric columns');

  /* TRAP 2: a blank schema heading that is a REAL column named in a second
   * header row. F6 carries header_levels 2 and two null schema entries. */
  const f6 = P.tables.F6;
  const rel6 = now(a => a.detectSumColumns(f6.schema_by_year['2025'], f6.data['2025'], 'F6'));
  ok(rel6.length === 1, 'C4 F6 has one sum relationship');
  ok(rel6[0].parts.length === 4,
    'C5 with FOUR parts, including the two merged columns whose names live in ' +
    'the second header row -- got ' + rel6[0].parts.length);
  ok(f6.header_levels === 2, 'C6 (F6 really does carry header_levels 2)');
  ok(f6.schema_by_year['2025'][3] === null && f6.schema_by_year['2025'][5] === null,
    'C7 (and its schema really does hold nulls at 3 and 5)');
  /* the row that proves it: 0 + 0 + 835 + 2044 = 2879 */
  const bh = f6.data['2025'].find(r => r[0] === 'Borough Hall');
  ok(bh && bh[2] + bh[3] + bh[4] + bh[5] === bh[6],
    'C8 and Borough Hall reconciles on all four: ' +
    (bh ? bh[2] + ' + ' + bh[3] + ' + ' + bh[4] + ' + ' + bh[5] + ' = ' + bh[6] : 'row missing'));
  const f6bad = now(a => a.reconcileSumColumns(f6.data['2025'], f6.schema_by_year['2025'], 'F6'));
  ok(f6bad.length === 0,
    'C9 so F6 raises NOTHING -- the blank-heading rule would have raised 60 rows');

  /* the second header row itself is never flagged */
  const sub = f6.data['2025'][0];
  ok(sub && typeof sub[6] !== 'number',
    'C10 the second header row has no numeric total, so it cannot be flagged');

  /* A NON-NUMERIC TOTAL IS NOT A DISAGREEMENT. Where the second header row is
   * protected twice over -- its total is not a number AND its parts are not
   * numbers -- this case leaves only the first guard standing, so it is what
   * a mutation of that guard can actually be measured against. */
  const H = P.tables.H1, hs = H.schema_by_year['2025'];
  const na = H.data['2025'].map(r => r.slice());
  na[1] = ['Queens', 1563, 281, 'n/a'];
  const naFound = now(a => a.reconcileSumColumns(na, hs, 'H1'));
  ok(naFound.length === 0,
    'C11 a row whose total cell holds text is not flagged -- it is unfilled, ' +
    'not wrong. Found ' + naFound.length);
});

/* ---- D. the enumeration the ruling asked for ---------------------------- */
log('');
log('D. EVERY SECTION WITH A PREPARER-ENTERED DERIVABLE COLUMN');
guard('D-block', () => {
  const found = [];
  Object.keys(P.tables).sort().forEach((id) => {
    const t = P.tables[id];
    const y = Object.keys(t.schema_by_year || {}).sort().pop();
    if (!y) return;
    const rel = now(a => a.detectSumColumns(t.schema_by_year[y], (t.data || {})[y] || [], id));
    if (rel.length) found.push(id);
  });
  found.forEach((id) => {
    const t = P.tables[id];
    const y = Object.keys(t.schema_by_year).sort().pop();
    const s = t.schema_by_year[y];
    const rel = now(a => a.detectSumColumns(s, t.data[y] || [], id));
    log('     ' + (id + ':' + y).padEnd(10) + rel.map(r => s[r.column] + ' = ' +
      r.parts.map(c => s[c] == null ? '(col ' + c + ', 2nd header row)' : s[c]).join(' + ')).join('; '));
  });
  ok(found.length === 7,
    'D1 SEVEN tables carry a preparer-entered derivable column -- found ' + found.length);
  ok(JSON.stringify(found) === JSON.stringify(['B2', 'F2', 'F4', 'F5', 'F6', 'F7', 'H1']),
    'D2 and they are B2, F2, F4, F5, F6, F7, H1 -- got ' + found.join(', '));
  /* H1 is not special: the ticket named it, the rule found six more */
  ok(found.indexOf('H1') >= 0 && found.length > 1,
    'D3 H1 is one of seven, not a special case');
  /* none of them is already covered by the derive engine */
  const covered = (codeOnly(SRC).match(/DERIVED_COLS = \{[\s\S]*?\n  \};/) || [''])[0];
  ok(found.every(id => covered.indexOf("'" + id + "'") < 0 && covered.indexOf(id + ':') < 0),
    'D4 and none of the seven is in DERIVED_COLS -- they are all still ' +
    'preparer-entered, which is what option (b) preserves');
});

/* ---- E. advisory, never a rejection ------------------------------------- */
log('');
log('E. ADVISORY ONLY');
guard('E-block', () => {
  const H = P.tables.H1, schema = H.schema_by_year['2025'];
  const header = schema.map(h => h == null ? '' : String(h));
  const line = ['Westchester', '666', '777', '1500'];
  const res = now(a => a.buildIngestImport([header, line], schema,
    H.data['2025'].map(r => r.slice()), 'H1'));
  ok(res.ok === true, 'E1 an import carrying a bad total still SUCCEEDS (ok=' + res.ok + ')');
  ok((res.rejections || []).length === 0, 'E2 with no rejections');
  ok((res.reconcileNotices || []).length === 1,
    'E3 and one reconciliation advisory -- found ' + (res.reconcileNotices || []).length);
  const cand = res.candidate.find(r => r[0] === 'Westchester');
  ok(cand && cand[3] === 1500,
    'E4 the preparer\'s 1500 is what lands in the draft, not a computed 1443');

  /* the rendered box */
  const html = now(a => a.renderReconcileNotice(res.reconcileNotices));
  ok(/ingest-import-notice is-warn/.test(html),
    'E5 it renders in the CLCPA-266 AMBER box');
  ok(/Does not add up: 1 row</.test(html), 'E6 with a counted heading');
  ok(/Westchester/.test(html), 'E7 naming the row');
  ok(/filed 1500/.test(html) && /1443/.test(html), 'E8 and both figures');
  ok(now(a => a.renderReconcileNotice([])) === '',
    'E9 and a clean table renders no box at all');
});

/* ---- F. style of change -------------------------------------------------- */
log('');
log('F. STYLE OF CHANGE');
guard('F-block', () => {
  const code = codeOnly(SRC);
  const added = SRC.split('\r\n').filter(l => baseSrc.indexOf(l) < 0);
  const codeAdded = added.filter(l => l.trim() && !/^\s*[*/]/.test(l.trim()));
  log('     added code lines: ' + codeAdded.length);
  ok(!codeAdded.some(l => /['"][A-J]\d+['"]/.test(l)), 'F1 no added code line names a table id');
  ok(!codeAdded.some(l => /Westchester|Bronx|Brooklyn|Queens|Manhattan/.test(l)),
    'F2 no added code line names a borough');
  ok(!codeAdded.some(l => /DAC Repairs|Non-DAC Repairs|NON-NETWORK/.test(l)),
    'F3 no added code line names a data column');

  /* the relationship is derived, and reuses the shipped detectors */
  ok(/detectPctColumns\(headerRow\)[\s\S]{0,200}detectAvgColumns\(headerRow\)/.test(code),
    'F4 the exclusions reuse the shipped percentage and average detectors');
  ok(/columnNumericMask\(headerRow, rows, tableId\)/.test(code),
    'F5 and column membership comes from the shipped numeric mask, read from the body');
  ok(/withinSourceRounding\(filed, sum\)/.test(code),
    'F6 the tolerance is the totals engine\'s own, so the two cannot contradict ' +
    'each other about the same numbers');

  /* never computes over the figure, never rejects */
  const fnStart = code.indexOf('function reconcileSumColumns');
  const fnBody = code.slice(fnStart, code.indexOf('function detectAvgColumns'));
  ok(fnStart > 0 && fnBody.length > 100, 'F7a the reconcile body was located');
  ok(!/row\[rel\.column\]\s*=/.test(fnBody), 'F7 it never assigns to the total cell');
  ok(!/\breject\b|res\.ok = false/.test(fnBody), 'F8 and never rejects');

  /* both surfaces the ruling named */
  ok(/res\.reconcileNotices = reconcileSumColumns\(candidate, schema, tableId\)/.test(code),
    'F9 IMPORT reconciles the candidate');
  ok((code.match(/renderReconcileNotice\(reconcileSumColumns\(i\.draft/g) || []).length === 1 &&
     /reconcileSumColumns\(i\.draft, i\.schema, i\.tableId\)/.test(code),
    'F10 and SAVE reconciles the draft, in the confirm dialog');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  const m = /const BASE = process\.env\.DAC_BASE_COMMIT \|\| '([^']*)';/.exec(self);
  ok(!!m && /^[0-9a-f]{7,40}$/.test(m[1]),
    'X1 BASE is pinned to a literal commit sha -- got ' + (m ? JSON.stringify(m[1]) : 'none'));
  ok(baseSrc.indexOf('function reconcileSumColumns(') < 0,
    'X2 and that baseline really predates this ticket');
  const f = now(a => a.reconcileSumColumns);
  ok(/^function reconcileSumColumns\b/.test(String(f)),
    'X3 the function under test is the one sliced from app.js');
  /* the probe arithmetic is the ticket's, checked rather than retyped */
  ok(666 + 777 === 1443, 'X4 666 + 777 = 1443, as the ticket states');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-272-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
