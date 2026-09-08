/* CLCPA-238 SHADOW ALARM, part 2: what the four divergences actually are.
 *
 * OFFLINE. No org, no network, no writes. The live diagnosis established that
 * the org differs from the seed files in EXACTLY TWO ways, both of them things
 * step 4 did on purpose:
 *   - A1:2099 exists in the org and not in the seed (2099 is not a payload
 *     year, so the seed has no row for it and step 4 left the existing row
 *     alone);
 *   - A1:2025's cr2bf_rows is the ORG's value, 1305 bytes, not the seed file's
 *     1306, because step 4 deliberately patched only schema and title so as
 *     not to destroy three operator-typed zeros.
 * Everything else -- 52 table rows, 10 sections, 31 metrics, 153 other
 * table-years -- is identical, and the change history holds ZERO entries after
 * the seed, so nothing was saved through the editor.
 *
 * That lets the org be reconstructed here exactly, from the seed files plus the
 * pre-seed backup, with no network. This file then tests the hypothesis the
 * live verdict points at.
 *
 * THE HYPOTHESIS. Shadow mode compares the composed payload against RAW
 * payload.json. But the composed payload is built from cr2bf_dacingesttest
 * tabledata1, which under CLCPA-238 is the SOURCE -- and which, before
 * CLCPA-238, was the OVERRIDE STORE. So the composed payload already has every
 * stored override baked in, while raw payload.json has none of them. The two
 * can never agree wherever an override exists, and that is not a defect in the
 * composer or in the data: it is the shadow comparing the wrong two things.
 *
 * What the app RENDERS today is payload.json after applyAddedYears and
 * applyOverrides. That is the only fair comparison for a composed payload, and
 * this file measures both so the difference between them is visible.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const DEV = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev';
const EVID = REPO + '/Coned/CLCPA/tickets/CLCPA-238-evidence';
const PRESEED = REPO + '/deploy-backups/2026-09-08-clcpa238-pre-seed/tabledata.json';

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
const say = (s) => lines.push(s);
function guard(label, fn) {
  try { fn(); }
  catch (e) { ok(false, label + ' THREW: ' + (e && e.message ? e.message : String(e))); }
}
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

/* ---- the SHIPPED composer and compare, extracted from app.js ---------- */
const SRC = fs.readFileSync(path.join(DEV, 'app.js'), 'utf8');
function grab(name) {
  for (const pad of ['  ', '    ', '']) for (const kw of ['function ', 'async function ']) {
    const head = '\r\n' + pad + kw + name + '(';
    const i = SRC.indexOf(head); if (i < 0) continue;
    const close = '\r\n' + pad + '}';
    const j = SRC.indexOf(close, i + head.length);
    if (j >= 0) return SRC.slice(i + 2, j + close.length);
  } return null;
}
function grabDecl(name) {
  const re = new RegExp('\\r\\n  (?:const|var|let) ' + name + ' = ');
  const m = SRC.match(re); if (!m) return null;
  const i = SRC.indexOf(m[0]);
  const rest = SRC.slice(i + 2);
  const end = rest.search(/\r\n  (?:const|var|let|function|async function|\/\*)/);
  return end < 0 ? rest : rest.slice(0, end);
}
const FNS = ['dacCanon', 'dacFirstDiff', 'dacRow', 'dacCol', 'dacCell', 'dacPct',
  'dacBody', 'dacPick', 'dacGBoroughs', 'dacCPrograms', 'dacJAverage',
  'composePayloadFromRows', 'isStrictTotalRowLabel', 'kpiDacPct'];
const DECLS = ['DAC_TOTAL_RE', 'DAC_CHART_RULES', 'DAC_KPI_REPORTED', 'dacShare',
  'dacJ9Share', 'DAC_KPI_ANALYTICAL'];
const API = new Function(DECLS.map(grabDecl).join('\n') + '\n' +
  FNS.map(grab).join('\n') +
  '\nreturn { composePayloadFromRows, dacFirstDiff };')();

const PAY = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const PARTS = ['meta', 'sections', 'tables', 'kpis', 'charts'];

say('======================================================================');
say('CLCPA-238 shadow alarm, part 2: the mechanism, offline');
say('======================================================================');

/* ---- reconstruct the org, from the seed + the pre-seed backup --------- */
const MAN = JSON.parse(fs.readFileSync(path.join(EVID, 'seed_manifest.json'), 'utf8'));
const SEED = {};
MAN.files.forEach(f => {
  const txt = fs.readFileSync(path.join(EVID, f.file), 'utf8');
  if (sha(txt) !== f.sha256) { console.error('seed file changed: ' + f.file); process.exit(1); }
  SEED[f.entitySet] = JSON.parse(txt);
});
const PRE = JSON.parse(fs.readFileSync(PRESEED, 'utf8'));

say('');
say('=== 1. THE ORG, RECONSTRUCTED from the seed plus the pre-seed backup ===');
let liveTabledata = null;
guard('reconstruct', () => {
  const seedTd = JSON.parse(JSON.stringify(SEED['cr2bf_dacingesttesttabledata1s']));
  const preA1 = PRE.filter(r => r.cr2bf_key === 'A1:2025')[0];
  const pre2099 = PRE.filter(r => r.cr2bf_key === 'A1:2099')[0];
  ok(!!preA1 && !!pre2099, 'the pre-seed backup holds both rows that existed');
  /* step 4 patched schema and title onto A1:2025 and left cr2bf_rows alone */
  const a1 = seedTd.filter(r => r.cr2bf_key === 'A1:2025')[0];
  ok(!!a1, 'the seed holds an A1:2025 row');
  a1.cr2bf_rows = preA1.cr2bf_rows;
  /* and A1:2099 was left entirely alone: no schema, no title */
  seedTd.push({ cr2bf_key: 'A1:2099', cr2bf_section: pre2099.cr2bf_section,
    cr2bf_tableid: pre2099.cr2bf_tableid, cr2bf_year: pre2099.cr2bf_year,
    cr2bf_rows: pre2099.cr2bf_rows, cr2bf_schema: null, cr2bf_title: null });
  liveTabledata = seedTd;
  ok(liveTabledata.length === 155,
     'the reconstruction has 155 rows, matching what the org reported: ' + liveTabledata.length);
  say('    (the live diagnosis proved the org differs from the seed in exactly');
  say('     these two ways, and in nothing else, across all four tables)');
});

const liveSrc = () => ({
  tabledata: liveTabledata,
  tables: SEED['cr2bf_dacreporttables'],
  sections: SEED['cr2bf_dacreportsections'],
  metrics: SEED['cr2bf_dacreportmetrics'],
});

const verdict = (composed, against) => {
  const v = {};
  PARTS.forEach(p => { v[p] = API.dacFirstDiff(composed[p], against[p]); });
  return v;
};
const show = (label, v) => {
  const same = PARTS.filter(p => v[p] === null).length;
  say('  ' + label + ': ' + same + ' of 5');
  PARTS.forEach(p => say('      ' + (v[p] === null ? 'MATCH  ' : 'differ ') +
    p.padEnd(9) + (v[p] === null ? '' : String(v[p]).slice(0, 130))));
  return same;
};

say('');
say('=== 2. THE RECONSTRUCTION REPRODUCES THE LIVE VERDICT ===');
let composed = null;
guard('reproduce 1 of 5', () => {
  composed = API.composePayloadFromRows(liveSrc());
  const v = verdict(composed, PAY);
  const same = show('reconstructed org vs RAW payload.json', v);
  ok(same === 1, 'the reconstruction reproduces the live 1 of 5 exactly: ' + same);
  ok(v.sections === null, 'and sections is the one part that matches, as live');
  ok(v.meta !== null && /current_year/.test(String(v.meta)),
     'meta differs first on current_year, as live');
});

/* ---- THE FAIR COMPARISON --------------------------------------------- */
say('');
say('=== 3. THE FAIR COMPARISON: what the app actually RENDERS today ===');
say('    payload.json AFTER applyAddedYears and applyOverrides, which is what');
say('    a viewer sees. The composed payload already contains the overrides,');
say('    because the table it is built from WAS the override store.');
guard('compare against the rendered payload', () => {
  const rendered = JSON.parse(JSON.stringify(PAY));
  /* applyOverrides: every stored table-year replaces the payload's */
  liveTabledata.forEach(r => {
    if (r.cr2bf_rows == null) return;
    const t = rendered.tables[r.cr2bf_tableid]; if (!t) return;
    t.data = t.data || {};
    t.data[String(r.cr2bf_year)] = JSON.parse(r.cr2bf_rows);
  });
  /* applyAddedYears: the reporting-year table holds 2099 */
  const years = Array.from(new Set(rendered.meta.years.concat(['2099'])))
    .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
  rendered.meta.years = years;

  const v = verdict(composed, rendered);
  const same = show('reconstructed org vs RENDERED payload', v);

  ok(v.tables === null,
     'TABLES NOW MATCH: the A1:2025 divergence was the shadow comparing a ' +
     'composed payload that HAS the override against a raw one that does not');
  /* I ASSERTED CHARTS WOULD MATCH HERE AND THEY DO NOT. The assertion is
   * corrected rather than deleted, because its failure is the second finding
   * and deleting it would hide that I had expected otherwise. */
  ok(v.charts !== null,
     'CHARTS STILL DIFFER -- I predicted they would match once tables did, and ' +
     'they do not: ' + String(v.charts).slice(0, 90));
  ok(v.sections === null, 'sections still match');
  ok(v.meta !== null, 'meta still differs: defect 1');
  say('');
  say('    DEFECT 2, and it is the one I did not see coming.');
  say('');
  say('    applyOverrides replaces tables[].data and NOTHING ELSE. It does not');
  say('    touch charts, and it does not need to: A1\'s "% in DACs" is a DERIVED');
  say('    column, and the app recomputes derived columns at RENDER through the');
  say('    CLCPA-88 shared rule. So today the table DISPLAYS a computed 0.58');
  say('    even though the store holds null, and the payload\'s stored chart');
  say('    values hold 0.58 to match.');
  say('');
  say('    The composer derives charts and KPI shares straight from the STORED');
  say('    table data, without recomputing the derived columns first. So every');
  say('    stripped derived cell propagates into the composed charts as null,');
  say('    where the app shows a number. A1 is in PERSIST_STRIP_TABLES along');
  say('    with 25 other tables, so this is not one chart: it is every chart');
  say('    and every KPI share that reads a derived column of a stripped table.');
  say('');
  say('    THE FIX IS STRUCTURAL AND ALREADY EXISTS. The app has one shared');
  say('    derive engine, and the composer must run it over the composed table');
  say('    data before deriving anything from it -- exactly as the render path');
  say('    does. Not a new rule; the existing one, applied one step earlier.');
  say('');
  say('    so of the four live divergences: TWO were the comparison baseline');
  say('    (tables, and the kpis coordinate that followed from it) and TWO are');
  say('    genuine composer defects. ' + same + ' of 5 on the fair comparison,');
  say('    against 1 of 5 on the unfair one.');
});

say('');
say('=== 4. THE REAL DEFECT: current_year derives to a test year ===');
guard('current_year', () => {
  ok(composed.meta.current_year === '2099',
     'the composer derives current_year = ' + composed.meta.current_year);
  ok(PAY.meta.current_year === '2025',
     'the payload publishes current_year = ' + PAY.meta.current_year);
  say('');
  say('    MECHANISM. composePayloadFromRows sets current_year = years[0], the');
  say('    newest year carrying data. The org contains A1:2099, a row created');
  say('    during CLCPA-235 testing for a year the report does not cover, so');
  say('    the newest year with data is 2099 and the composer calls it current.');
  say('');
  say('    WHY MY OFFLINE PROOF MISSED IT. gen_seed.js recomposed from the SEED');
  say('    FILES, which contain no 2099 row -- the payload has no such year, so');
  say('    the seed could not have one. The fixture was therefore structurally');
  say('    incapable of exposing this, and my "the fixture is what Dataverse');
  say('    holds" claim was true for 153 of 155 rows and false for the two that');
  say('    mattered.');
  say('');
  say('    THE PRINCIPLE IT BREAKS. I derived current_year on the argument that');
  say('    storing it would be a second source of truth for a fact the rows');
  say('    already state. The 2099 row disproves that: the rows state which');
  say('    years HAVE DATA, which is not the same fact as which year the report');
  say('    COVERS. The first is data; the second is an editorial decision that');
  say('    cannot be derived from data at all. So current_year belongs in the');
  say('    meta row beside baseline_options, and deriving it was wrong on');
  say('    principle rather than merely unlucky.');
  say('');
  say('    years[] is a different question and is NOT obviously wrong: the app');
  say('    already merges added years into meta.years through applyAddedYears,');
  say('    so a selector showing 2099 is what ships today. Left for Emely.');

  /* and the consequence, stated in user terms rather than as a field name */
  const y = composed.meta.years;
  ok(Array.isArray(y) && y[0] === '2099',
     'the derived year list leads with 2099: ' + y.join(', '));
  say('');
  say('    CONSEQUENCE IF FLIPPED AS IT STANDS: the dashboard would open on');
  say('    2099 -- a test year with one table of data -- instead of 2025. Every');
  say('    KPI card and every chart would read from a year that has A1 and');
  say('    nothing else. That is not a subtle drift; it is the whole report');
  say('    landing on an empty year, and it is exactly what the shadow was');
  say('    built to catch before a flip rather than after.');
});

say('');
say('=== 5. WHAT THE kpis DIVERGENCE IS, on the fair comparison ===');
guard('kpis', () => {
  const rendered = JSON.parse(JSON.stringify(PAY));
  liveTabledata.forEach(r => {
    if (r.cr2bf_rows == null) return;
    const t = rendered.tables[r.cr2bf_tableid]; if (!t) return;
    t.data = t.data || {}; t.data[String(r.cr2bf_year)] = JSON.parse(r.cr2bf_rows);
  });
  const d = API.dacFirstDiff(composed.kpis, rendered.kpis);
  say('    first coordinate: ' + String(d).slice(0, 140));
  /* the analytical[0] equity_index divergence is the A1 published-percentage
   * fallback, which the composer's own comment predicted */
  ok(d !== null, 'kpis still differs, as expected: the rounded stored copies');
  const a1pct = composed.kpis.analytical.filter(k => k.id === 'equity_index')[0];
  ok(!!a1pct, 'equity_index is present');
  say('    equity_index 2025 composed = ' +
    (a1pct.values['2025'] ? a1pct.values['2025'].value : 'none'));
  say('    payload published        = ' + PAY.kpis.analytical[0].values['2025'].value);
  say('');
  say('    That one is the A1 published-percentage fallback the composer\'s own');
  say('    comment predicted: A1 is in PERSIST_STRIP_TABLES, its "% in DACs"');
  say('    Total cell is null in the org after the CLCPA-142 cleanup, so the');
  say('    precise share is used instead of the rounded published one. I wrote');
  say('    that down in the code and then left it out of the verdict I told');
  say('    Emely to expect, which is why the count I gave was wrong twice over.');
});

say('');
say('======================================================================');
say('  ' + pass + ' passed, ' + fail + ' failed');
say('======================================================================');

const out = lines.join('\n') + '\n';
process.stdout.write(out);
fs.writeFileSync(path.join(__dirname, 'diag-baseline-output.txt'), out);
process.exitCode = fail ? 1 : 0;
