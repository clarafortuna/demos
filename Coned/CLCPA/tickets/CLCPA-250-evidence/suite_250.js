/* CLCPA-250 -- a year whose data arrives after boot never needs a reload.
 *
 * WHAT THE RE-VERIFICATION ESTABLISHED, kept here because it shaped the fix:
 *
 *   The ticket's prime suspect was dacCol carrying the oldest-year schema
 *   fallback. It is not: CLCPA-257 already changed it to the newest year, the
 *   same choice getTableSchema makes. And it is moot for H1 anyway, whose
 *   three stored schemas are column-compatible (only column 0's label
 *   differs), so Grand Total resolves to 3 and DAC Repairs to 2 whichever
 *   year is borrowed, pre-257 and post-257 alike.
 *
 *   The org was read. H1:2097, H1:2098 and H1:2099 ALL carry cr2bf_schema
 *   null, and 2097's and 2099's rows are clean -- a row labelled exactly
 *   "Grand Total" with 3 of 3 value cells numeric. On those rows the KPI
 *   computes. Four candidate mechanisms measured, four refuted.
 *
 * What survives is structural and is what this ticket fixes:
 * composePayloadFromRows runs ONCE, at boot. Nothing recomputed after a save,
 * so a year whose rows arrived later had no KPI entry until a reload. The
 * editor wrote the rows into the live payload "so the dashboard updates
 * immediately"; the figures derived from those rows did not.
 *
 * Whether that gap is the WHOLE reported symptom is not settled here. It needs
 * a hosted observation on a clean load.
 *
 * BASE predates the change: 4016675, this branch's parent (CLCPA-267's tip).
 *
 * Run:  node suite_250.js
 */
const fs = require('fs');
const { execFileSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const APP = process.env.DAC_APP_OVERRIDE || (REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const PAYLOAD = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/payload.json';
const BASE = process.env.DAC_BASE_COMMIT || '4016675';
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
const now = api(SRC, ['recomputeYearDerived', 'dacDerivedTablesForYear',
  'DAC_KPI_REPORTED', 'getTableSchema', 'rowsForDisplay']);

/* The org's real H1 rows for the two failing years, as read on 2026-09-16. */
const H1_2097 = [['Manhattan', 979797, 979797, 1959594], ['Queens', 979797, 979797, 1959594],
  ['Westchester', 979797, 979797, 1959594], ['Bronx', 979797, 979797, 1959594],
  ['Grand Total', 3919188, 3919188, 7838376]];
const H1_2099 = [['Manhattan', 99, 999, 1098], ['Queens', 999, 999, 1998],
  ['Westchester', 99, 99, 198], ['Bronx', 9999, 9, 10008],
  ['Grand Total', 11196, 2106, 13302]];

const storedYears = (P.meta && P.meta.years) ? P.meta.years.map(String) : [];

log('======================================================================');
log('CLCPA-250 -- one year re-derived when its rows arrive');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('  stored years in the payload: ' + storedYears.join(', '));
log('======================================================================');

/* ---- A. the gap, demonstrated ------------------------------------------- */
log('');
log('A. THE GAP: rows arrive after boot, figures do not follow');
guard('A-block', () => {
  const pay = clone(P);
  /* a year that did not exist when the payload was composed */
  pay.tables.H1.data['2097'] = clone(H1_2097);

  const before = pay.kpis.reported.find(k => k.id === 'leak_repairs');
  ok(!!before, 'A1 the leak_repairs KPI exists in the payload');
  ok(before.values['2097'] === undefined,
    'A2 and it has NO entry for the year whose rows just arrived -- the gap');

  const wrote = now(a => a.recomputeYearDerived(pay, '2097'));
  const after = pay.kpis.reported.find(k => k.id === 'leak_repairs');
  log('     entries written for 2097: ' + wrote);
  ok(wrote > 0, 'A3 the recompute writes entries (' + wrote + ')');
  ok(after.values['2097'] !== undefined,
    'A4 leak_repairs now HAS a 2097 entry -- no reload needed');
  ok(after.values['2097'].total === 7838376,
    'A5 with the total from the org\'s own rows -- got ' + after.values['2097'].total);
  ok(after.values['2097'].dac === 3919188,
    'A6 and the DAC figure -- got ' + after.values['2097'].dac);
  ok(typeof after.values['2097'].dac_pct === 'number',
    'A7 and a dac_pct, through the shipped kpiDacPct');

  /* the second year, different numbers, so the suite cannot be passing on a
   * constant it happens to have been handed */
  const pay2 = clone(P);
  pay2.tables.H1.data['2099'] = clone(H1_2099);
  now(a => a.recomputeYearDerived(pay2, '2099'));
  const v = pay2.kpis.reported.find(k => k.id === 'leak_repairs').values['2099'];
  ok(v && v.total === 13302 && v.dac === 2106,
    'A8 and 2099 derives its OWN figures, 13302 / 2106 -- got ' +
    (v ? v.total + ' / ' + v.dac : 'nothing'));
});

/* ---- B. NO STORED YEAR MOVES -------------------------------------------- */
log('');
log('B. THE NO-MOVEMENT GATE: re-deriving a composed year changes nothing');
guard('B-block', () => {
  /* THE BASELINE MUST BE A COMPOSED PAYLOAD, not payload.json.
   *
   * Round 1 of this gate compared the recompute against payload.json's own
   * stored KPI values and went red on all three years. That was the harness
   * asking the wrong question: the live build runs on DAC_SOURCE 'dataverse',
   * where those values were produced BY this engine at boot. The right claim
   * is that re-deriving a year that was already derived changes nothing --
   * which is what the live path actually does.
   *
   * The payload.json divergence is real, pre-existing, and measured in
   * section G below rather than hidden by this assertion. */
  const composed = clone(P);
  storedYears.forEach(y => now(a => a.recomputeYearDerived(composed, y)));

  let moved = 0, checked = 0;
  const detail = [];
  storedYears.forEach((y) => {
    const pay = clone(composed);
    const before = JSON.stringify({ k: pay.kpis, c: pay.charts });
    now(a => a.recomputeYearDerived(pay, y));
    const after = JSON.stringify({ k: pay.kpis, c: pay.charts });
    checked++;
    if (before !== after) { moved++; detail.push(y); }
  });
  log('     composed years re-derived: ' + checked + '   changed: ' + moved);
  ok(checked === storedYears.length && checked > 0,
    'B1 every stored year was re-derived (' + checked + ')');
  ok(moved === 0,
    'B2 NOT ONE composed year\'s KPI or chart values moved' +
    (detail.length ? ' -- moved: ' + detail.join(', ') : ''));

  /* idempotence: twice is the same as once */
  const pay = clone(P);
  pay.tables.H1.data['2097'] = clone(H1_2097);
  now(a => a.recomputeYearDerived(pay, '2097'));
  const once = JSON.stringify(pay.kpis);
  now(a => a.recomputeYearDerived(pay, '2097'));
  ok(JSON.stringify(pay.kpis) === once, 'B3 running it twice is the same as running it once');

  /* it touches ONLY the year it is given */
  const pay3 = clone(P);
  const otherBefore = JSON.stringify(pay3.kpis.reported.map(k =>
    storedYears.map(y => k.values && k.values[y])));
  pay3.tables.H1.data['2097'] = clone(H1_2097);
  now(a => a.recomputeYearDerived(pay3, '2097'));
  const otherAfter = JSON.stringify(pay3.kpis.reported.map(k =>
    storedYears.map(y => k.values && k.values[y])));
  ok(otherBefore === otherAfter,
    'B4 and every OTHER year is untouched by a recompute of 2097');
});

/* ---- C. the composer's third schema fallback ---------------------------- */
log('');
log('C. THE 244/257 PATTERN, THIRD AND LAST LIFE');
guard('C-block', () => {
  const code = codeOnly(SRC), codeBase = codeOnly(baseSrc);
  ok(codeBase.indexOf("const schema = (t.schema_by_year || {})[y] || null;") >= 0,
    'C1 on BASE the composer resolved a schema with NO fallback');
  /* SCOPED TO THE COMPOSER. The identical expression also lives in
   * dacShadowCompare's displayView, where it is deliberate: that comparison's
   * correctness rests on applying the SAME normalisation to both sides, not on
   * resolving a fallback, so it is out of this ticket's scope and stays. A
   * file-wide search would have demanded a change nobody asked for. */
  const comp = code.slice(code.indexOf('function composePayloadFromRows'));
  const compBody = comp.slice(0, comp.indexOf('function dacShadowCompare'));
  ok(compBody.indexOf("const schema = (t.schema_by_year || {})[y] || null;") < 0,
    'C2 that direct read is gone FROM THE COMPOSER');
  ok(code.indexOf("const schema = (t.schema_by_year || {})[y] || null;") >= 0,
    'C2b and the shadow comparator keeps its own symmetric read, untouched');
  ok(code.indexOf('rowsForDisplay(t.data[y], getTableSchema(t, y), id)') >= 0,
    'C3 and the composer now resolves it through getTableSchema, as the editor does');

  /* behaviour: a schema-less year now composes with the borrowed schema */
  const t = clone(P.tables.H1);
  t.data['2097'] = clone(H1_2097);
  const s = now(a => a.getTableSchema(t, '2097'));
  ok(Array.isArray(s) && s.length === 4,
    'C4 a schema-less year resolves to the borrowed 4-column shape, not null');
  ok(s.indexOf('Grand Total') === 3 && s.indexOf('DAC Repairs') === 2,
    'C5 with Grand Total at 3 and DAC Repairs at 2');

  /* and all three readers agree -- the point of the ticket */
  const viaEditor = now(a => a.getTableSchema(t, '2097'));
  const rows = now(a => a.rowsForDisplay(t.data['2097'], viaEditor, 'H1'));
  ok(JSON.stringify(rows) === JSON.stringify(H1_2097),
    'C6 and H1\'s rows survive the display view unchanged (it has no derived columns)');
});

/* ---- D. the re-verification, kept as evidence --------------------------- */
log('');
log('D. THE REFUTED MECHANISMS (measured against the org\'s own rows)');
guard('D-block', () => {
  const T = { H1: { id: 'H1', data: { '2097': clone(H1_2097), '2099': clone(H1_2099) },
    schema_by_year: clone(P.tables.H1.schema_by_year) } };
  const r97 = now(a => a.DAC_KPI_REPORTED.leak_repairs(T, '2097'));
  const r99 = now(a => a.DAC_KPI_REPORTED.leak_repairs(T, '2099'));
  ok(r97 && typeof r97.total === 'number',
    'D1 on a SCHEMA-LESS year the KPI computes -- the missing schema is not the cause');
  ok(r99 && typeof r99.total === 'number', 'D2 the same for 2099');

  /* H1's schemas are column-compatible, so the donor choice cannot matter */
  const by = P.tables.H1.schema_by_year;
  const years = Object.keys(by).sort();
  const cols = years.map(y => JSON.stringify(by[y].slice(1)));
  ok(cols.every(c => c === cols[0]),
    'D3 H1\'s stored schemas agree on every column but the label -- ' +
    'so oldest-vs-newest donor cannot move this KPI');
  ok(new Set(years.map(y => by[y][0])).size > 1,
    'D4 and they differ ONLY in column 0 ("Area" vs "Borough / County")');

  /* the label and the types really are clean in the org's rows */
  [['2097', H1_2097], ['2099', H1_2099]].forEach(([y, rows]) => {
    const tot = rows.find(r => /^grand total$/i.test(String(r[0])));
    ok(!!tot, 'D5 ' + y + ' holds a row matching /^Grand Total$/i exactly');
    ok(tot.slice(1).every(c => typeof c === 'number'),
      'D6 ' + y + ' total row is numeric in every value cell');
  });
});

/* ---- E. wiring ----------------------------------------------------------- */
log('');
log('E. WHERE IT IS TRIGGERED');
guard('E-block', () => {
  const code = codeOnly(SRC);
  const gated = (code.match(/recomposeYearIfComposed\(/g) || []).length;
  const raw = (code.match(/recomputeYearDerived\(/g) || []).length;
  ok(gated === 3,
    'E1 the gate is declared once and called twice (save + year change) -- found ' +
    gated + ' occurrences');
  ok(raw === 2,
    'E1b and the ungated engine is declared once and called once, by the gate -- found ' + raw);
  ok(/table\.data\[i\.year\] = clone2D\(i\.draft\);[\s\S]{0,500}recomposeYearIfComposed\(i\.year\)/.test(code),
    'E2 a SAVE re-derives the year it just wrote');
  ok(/state\.year = e\.target\.value;[\s\S]{0,500}recomposeYearIfComposed\(state\.year\)/.test(code),
    'E3 and changing the reporting year re-derives the year selected');
  ok(baseSrc.indexOf('recomputeYearDerived') < 0,
    'E4 neither trigger existed on BASE');
});

/* ---- F. style of change -------------------------------------------------- */
log('');
log('F. STYLE OF CHANGE');
guard('F-block', () => {
  const code = codeOnly(SRC);
  const added = SRC.split('\r\n').filter(l => baseSrc.indexOf(l) < 0);
  /* CLCPA-241 added A9 to PERSIST_STRIP_TABLES, now that its % Change pair
   * has a rule. That is a DECLARATION -- a table joining a registry, exactly
   * like the members beside it -- and not the per-table special case in code
   * this guard exists to forbid. Excluded by its exact text, so the guard
   * still catches a real one. */
  const KNOWN_DECL_LINES = [
    /* and the call site that hands the share over: it named D3 before this
     * ticket touched it, and changed only by gaining the argument. */
    "            ${dBarMetric('LMI subscribers (EAP)', fmtCompact, d3Lmi.upTo, null,           d3Lmi.prevCum,  null,             'D3', true,",
    /* CLCPA-311 reads the share D3 files, beside the line that already
     * reads the count: renderSectionD names D2, D3 and D4 throughout, so a
     * sibling of an existing getDRow call is not the per-table special case
     * in code this guard forbids. Excluded by its exact text. */
    "      const d3LmiPct  = getDRow('D3', ['percentage', 'low-income', 'energy affordability']);",
    "    'A1', 'A2', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10', 'F2',",
  ];
  const codeAdded = added.filter(l => l.trim() && !/^\s*[*/]/.test(l.trim()))
    .filter(l => KNOWN_DECL_LINES.indexOf(l) < 0);
  log('     added code lines: ' + codeAdded.length);
  ok(!codeAdded.some(l => /['"][A-J]\d+['"]/.test(l)), 'F1 no added code line names a table id');
  ok(!codeAdded.some(l => /['"](?:19|20)\d{2}['"]/.test(l)), 'F2 no added code line names a year');
  ok(!codeAdded.some(l => /leak_repairs|Grand Total|DAC Repairs/.test(l)),
    'F3 no added code line names a KPI or a column');

  /* DERIVED, never stored: the recompute must not write to Dataverse */
  ok(!/recomputeYearDerived[\s\S]{0,1200}(dvCreate|dvUpdate|Storage\.save)/.test(code),
    'F4 the recompute writes nothing to storage');
  ok(code.indexOf('cr2bf_schema:') < 0, 'F5 and still nothing writes cr2bf_schema');

  /* the CLCPA-237 item E rule survives, in both directions */
  /* SCOPED TO THE RECOMPUTE'S OWN BODY. The composer carries the identical
   * lines, so a file-wide grep stays green while the recompute's copy is
   * loosened -- two mutations proved exactly that. An assertion that cannot
   * distinguish the function it is about is not a guard. */
  const rcStart = code.indexOf('function recomputeYearDerived');
  const rcBody = code.slice(rcStart, code.indexOf('function recomposeYearIfComposed'));
  ok(rcStart > 0 && rcBody.length > 200, 'F6a the recompute body was located for scoping');
  ok(/typeof v\.total === 'number' \|\| typeof v\.dac === 'number'/.test(rcBody),
    'F6 "has a usable value" (CLCPA-237 item E) is the test IN THE RECOMPUTE, unchanged');
  /* BEHAVIOURAL, not a grep. A search for "delete k.values[y]" stays green
   * while the reported branch loses its delete, because the analytical branch
   * still has one -- the mutation that removed exactly that went unnoticed
   * until this was driven instead of read. */
  const stale = clone(P);
  stale.tables.H1.data['2097'] = clone(H1_2097);
  now(a => a.recomputeYearDerived(stale, '2097'));
  const had = stale.kpis.reported.find(k => k.id === 'leak_repairs').values['2097'];
  delete stale.tables.H1.data['2097'];
  now(a => a.recomputeYearDerived(stale, '2097'));
  const kept = stale.kpis.reported.find(k => k.id === 'leak_repairs').values['2097'];
  ok(had !== undefined && kept === undefined,
    'F7 a year that stops being derivable LOSES its entry rather than keeping a stale one');

  /* one derive engine: the recompute must not carry its own copy of the rules */
  ok(/DAC_KPI_REPORTED\[k\.id\]/.test(code) && /DAC_KPI_ANALYTICAL\[k\.id\]/.test(code) &&
     /DAC_CHART_RULES\[key\]/.test(code),
    'F8 it runs the SHIPPED rule tables, not a second copy');
  ok(/e\.dac_pct = kpiDacPct\(e\)/.test(rcBody),
    'F9 and dac_pct IN THE RECOMPUTE still goes through the shipped kpiDacPct');
});

/* ---- G. the parachute, and why the recompute is gated ------------------- */
log('');
log('G. THE PAYLOAD.JSON DIVERGENCE (pre-existing, disclosed, NOT fixed here)');
guard('G-block', () => {
  /* payload.json's stored KPI values are rounded copies of figures the engine
   * derives at full precision -- the CLCPA-141/142/143 and CLCPA-238 family.
   * Ungated, a year change on the parachute would silently move published
   * percentages, so recomposeYearIfComposed runs only on the composed source.
   * The count is PINNED so it cannot grow quietly. */
  let diff = 0;
  const examples = [];
  storedYears.forEach((y) => {
    const pay = clone(P);
    const before = clone(pay.kpis);
    now(a => a.recomputeYearDerived(pay, y));
    pay.kpis.reported.forEach((k, i) => {
      const b = before.reported[i].values[y], a2 = k.values[y];
      if (JSON.stringify(b) !== JSON.stringify(a2)) {
        diff++;
        if (examples.length < 3) examples.push(y + ' ' + k.id + '  stored ' +
          JSON.stringify(b && b.dac_pct) + ' vs derived ' + JSON.stringify(a2 && a2.dac_pct));
      }
    });
    (pay.kpis.analytical || []).forEach((k, i) => {
      const b = before.analytical[i].values[y], a2 = k.values[y];
      if (JSON.stringify(b) !== JSON.stringify(a2)) diff++;
    });
  });
  log('     stored KPI entries disagreeing with the engine: ' + diff);
  examples.forEach(e => log('       ' + e));
  ok(diff === 19,
    'G1 exactly 19 stored KPI entries disagree with the engine -- ' +
    'pinned so the divergence cannot grow unnoticed. Found ' + diff);

  const code = codeOnly(SRC);
  ok(/function recomposeYearIfComposed\([\s\S]{0,200}DAC_SOURCE !== 'dataverse'/.test(code),
    'G2 and the recompute is gated to the composed source, so the parachute ' +
    'renders exactly what it renders today');
  ok(code.indexOf('recomputeYearDerived(state.payload, i.year)') < 0 &&
     code.indexOf('recomputeYearDerived(state.payload, state.year)') < 0,
    'G3 neither trigger calls the ungated function directly');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  const m = /const BASE = process\.env\.DAC_BASE_COMMIT \|\| '([^']*)';/.exec(self);
  ok(!!m && /^[0-9a-f]{7,40}$/.test(m[1]),
    'X1 BASE is pinned to a literal commit sha -- got ' + (m ? JSON.stringify(m[1]) : 'none'));
  ok(baseSrc.indexOf('function recomputeYearDerived(') < 0,
    'X2 and that baseline really predates this ticket');
  const f = now(a => a.recomputeYearDerived);
  ok(/^function recomputeYearDerived\b/.test(String(f)),
    'X3 the function under test is the one sliced from app.js');
  /* the org rows are DATA read from Dataverse, not values retyped from a
   * rendered screen -- see org-reads-evidence/ for the read that produced them */
  ok(H1_2097[4][3] === H1_2097[4][1] + H1_2097[4][2],
    'X4 the 2097 fixture reconciles with itself (3919188 + 3919188 = 7838376)');
  ok(H1_2099[4][3] === H1_2099[4][1] + H1_2099[4][2],
    'X5 and the 2099 fixture does too (11196 + 2106 = 13302)');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-250-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
