/* CLCPA-238 STEP 4, part 1 of 3: GENERATE THE SEED. Entirely offline.
 *
 * No network, no org, no auth, no writes to Dataverse. Reads payload.json and
 * the preserved 2026-09-02 cleanup artifact; writes the seed as JSON files with
 * sha256s so that the rows LATER WRITTEN are provably the rows reviewed here.
 * That chain is the point: payload.json -> seed files (reviewed, hashed) -> org
 * rows (verified against the same hashes). A seed generated inside the writing
 * script could not be reviewed before it landed.
 *
 * WHAT THIS PRODUCES
 *   seed_tabledata.json    154 rows for cr2bf_dacingesttesttabledata1
 *   seed_reporttable.json   52 rows for cr2bf_dacreporttable
 *   seed_reportsection.json 10 rows for cr2bf_dacreportsection
 *   seed_reportmetric.json  31 rows for cr2bf_dacreportmetric
 *   seed_manifest.json      counts and sha256 per file
 *
 * WHAT IT CHECKS BEFORE ANY OF THAT IS TRUSTED
 *   - the generated seed is DIFFED against the preserved 2026-09-02 artifact
 *     across the 149 shared keys. Under the CLCPA-219 rule a divergence is a
 *     FINDING TO REPORT, never a file to fix, so this prints and counts them
 *     and never edits anything.
 *   - the 5 orphan title-years are asserted PRESENT, which is why the count is
 *     154 and not 149.
 *   - the seed is RECOMPOSED back into payload shape and compared canonically
 *     against payload.json, so the seed is proven sufficient before it is
 *     written rather than after.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const DEV = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev';
const ART = REPO + '/deploy-backups/2026-09-02-clcpa142-cleanup/tabledata.json';
const OUT = __dirname;

const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const SRC = fs.readFileSync(path.join(DEV, 'app.js'), 'utf8');

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

/* the canonical deep compare, same rules as derive_charts.js */
function canon(v) {
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'number') {
      if (Number.isNaN(v)) return 'NaN';
      if (v === 0) return Object.is(v, -0) ? '-0' : '0';
    }
    return v;
  }
  if (Array.isArray(v)) return v.map(canon);
  const out = {};
  Object.keys(v).sort().forEach(k => { out[k] = canon(v[k]); });
  return out;
}
const deepEq = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
function firstDiff(a, b, p) {
  p = p || '';
  if (JSON.stringify(canon(a)) === JSON.stringify(canon(b))) return null;
  const ca = canon(a), cb = canon(b);
  if (ca === null || cb === null || typeof ca !== 'object' || typeof cb !== 'object') {
    return p + ': ' + JSON.stringify(ca) + ' vs ' + JSON.stringify(cb);
  }
  if (Array.isArray(ca) !== Array.isArray(cb)) return p + ': array vs object';
  if (Array.isArray(ca)) {
    if (ca.length !== cb.length) return p + ': length ' + ca.length + ' vs ' + cb.length;
    for (let i = 0; i < ca.length; i++) { const d = firstDiff(a[i], b[i], p + '[' + i + ']'); if (d) return d; }
    return null;
  }
  for (const k of new Set(Object.keys(ca).concat(Object.keys(cb)))) {
    const d = firstDiff(a[k], b[k], p + '.' + k); if (d) return d;
  }
  return null;
}

say('======================================================================');
say('CLCPA-238 STEP 4 part 1: GENERATE THE SEED. Offline, no org, no writes.');
say('======================================================================');

/* =====================================================================
 * 1. cr2bf_dacingesttesttabledata1 -- 154 rows
 * ===================================================================== */
const overrideKey = (t, y) => String(t) + ':' + String(y);
const tdRows = [];
Object.keys(P.tables).forEach(id => {
  const t = P.tables[id];
  /* the union of data-years and title-years. Data-years alone would silently
   * drop the 5 orphan titles found in the audit -- A7:2023 and the four
   * abandonment tables G3/G5/G7/G9:2023, which have titles but no data because
   * abandonment was not reported that year. */
  const years = new Set(
    Object.keys(t.data || {}).concat(Object.keys(t.title_by_year || {})));
  Array.from(years).sort().forEach(y => {
    const data = (t.data || {})[y];
    const schema = (t.schema_by_year || {})[y];
    const title = (t.title_by_year || {})[y];
    tdRows.push({
      cr2bf_key: overrideKey(id, y),
      cr2bf_section: t.section,
      cr2bf_tableid: id,
      cr2bf_year: parseInt(y, 10),
      /* null, not "[]", when the year has no data: absent is not empty, and an
       * empty array would render as a table with no rows rather than as a year
       * that was never reported. */
      cr2bf_rows: data === undefined ? null : JSON.stringify(data),
      cr2bf_schema: schema === undefined ? null : JSON.stringify(schema),
      cr2bf_title: title === undefined ? null : title,
    });
  });
});

/* =====================================================================
 * 2. cr2bf_dacreporttable -- 52 rows
 * ===================================================================== */
const rtRows = Object.keys(P.tables).map(id => {
  const t = P.tables[id];
  /* PRESENTATION HINTS, and finding them is why this file recomposes before it
   * writes. My audit inventoried a table's keys by reading ONE table and
   * reported eight. The union across all 52 has ten: `header_levels` on A9,
   * A10, D1 and F6, and `currency_cols` on A9 alone. Sampling one member of a
   * collection and calling the result the shape of the collection is the whole
   * mistake, and the recomposition caught it with nothing written.
   *
   * They travel together as presentation metadata and only 5 tables carry
   * either, so they share one JSON column rather than earning two typed ones --
   * the same choice already made for `mapping`.
   *
   * `header_levels` takes the value 0 on some tables, so presence is tested
   * with !== undefined. A truthy test would silently drop a real 0 and the
   * recomposition would fail on a key that IS there. */
  const pres = {};
  if (t.header_levels !== undefined) pres.header_levels = t.header_levels;
  if (t.currency_cols !== undefined) pres.currency_cols = t.currency_cols;
  return {
    cr2bf_tablekey: id,
    cr2bf_section: t.section,
    cr2bf_number: typeof t.number === 'number' ? t.number : parseInt(t.number, 10),
    cr2bf_shorttitle: t.short_title == null ? null : String(t.short_title),
    cr2bf_mapping: t.mapping == null ? null : JSON.stringify(t.mapping),
    cr2bf_presentation: Object.keys(pres).length ? JSON.stringify(pres) : null,
  };
});

/* =====================================================================
 * 3. cr2bf_dacreportsection -- 10 rows
 * ===================================================================== */
const rsRows = Object.keys(P.sections).map(k => {
  const s = P.sections[k];
  return {
    cr2bf_sectionkey: k,
    cr2bf_name: s.name == null ? null : s.name,
    cr2bf_shortname: s.short_name == null ? null : s.short_name,
    cr2bf_fullname: s.full_name == null ? null : s.full_name,
    cr2bf_invertmetric: !!s.invert_metric,
    cr2bf_blurb: s.blurb == null ? null : s.blurb,
  };
});

/* =====================================================================
 * 4. cr2bf_dacreportmetric -- 31 rows: DEFINITIONS ONLY, never values
 * ===================================================================== */
const rmRows = [];
P.kpis.reported.forEach(k => rmRows.push({
  cr2bf_metrickey: k.id, cr2bf_kind: 'kpi_reported',
  cr2bf_label: k.label == null ? null : k.label,
  cr2bf_section: k.section == null ? null : k.section,
  cr2bf_format: k.format == null ? null : k.format,
  cr2bf_unit: k.unit == null ? null : k.unit,
  cr2bf_primarymetric: k.primary_metric == null ? null : k.primary_metric,
  cr2bf_narrative: k.narrative == null ? null : k.narrative,
  cr2bf_sourcecalc: k.source_calc == null ? null : k.source_calc,
  cr2bf_spec: null,
}));
P.kpis.analytical.forEach(k => rmRows.push({
  cr2bf_metrickey: k.id, cr2bf_kind: 'kpi_analytical',
  cr2bf_label: k.label == null ? null : k.label,
  cr2bf_section: k.section == null ? null : k.section,
  cr2bf_format: k.format == null ? null : k.format,
  cr2bf_unit: k.unit == null ? null : k.unit,
  cr2bf_primarymetric: k.primary_metric == null ? null : k.primary_metric,
  cr2bf_narrative: k.narrative == null ? null : k.narrative,
  cr2bf_sourcecalc: k.source_calc == null ? null : k.source_calc,
  /* composite and lower_is_better are analytical-only flags with nowhere else
   * to live; they go in spec rather than earning columns for 6 rows. */
  cr2bf_spec: JSON.stringify({
    composite: k.composite === undefined ? null : k.composite,
    lower_is_better: k.lower_is_better === undefined ? null : k.lower_is_better,
  }),
}));
Object.keys(P.charts).forEach(c => rmRows.push({
  cr2bf_metrickey: c, cr2bf_kind: 'chart',
  cr2bf_label: null, cr2bf_section: null, cr2bf_format: null, cr2bf_unit: null,
  cr2bf_primarymetric: null, cr2bf_narrative: null, cr2bf_sourcecalc: null,
  /* the chart's years, recorded so the composer knows which years to derive.
   * The derive RULE stays in code -- step 2 proved the rules involve
   * cross-table aggregation and pattern-matched columns, which is logic, not
   * configuration. */
  cr2bf_spec: JSON.stringify({ years: Object.keys(P.charts[c].values || {}).sort() }),
}));
rmRows.push({
  cr2bf_metrickey: 'meta', cr2bf_kind: 'meta',
  cr2bf_label: P.meta.title == null ? null : P.meta.title,
  cr2bf_section: null, cr2bf_format: null, cr2bf_unit: null,
  cr2bf_primarymetric: null, cr2bf_narrative: null, cr2bf_sourcecalc: null,
  /* YEARS are derivable from the table-year rows and are NOT stored: a copy of
   * them would be a second source of truth for the same fact, which is the
   * mistake CLCPA-238 exists to undo.
   *
   * CURRENT_YEAR IS STORED, and the earlier version of this comment claimed
   * both were derivable. That was the error the shadow caught: the rows state
   * which years HAVE DATA, which is not the same fact as which year the report
   * COVERS. A 2099 test row made the newest year with data 2099, and a derived
   * current_year would have opened the dashboard on a year holding one table.
   * The second fact is editorial and cannot be derived from data at all. */
  cr2bf_spec: JSON.stringify({
    current_year: P.meta.current_year,
    baseline_options: P.meta.baseline_options,
    default_baseline: P.meta.default_baseline,
  }),
});

/* =====================================================================
 * CHECKS
 * ===================================================================== */
say('');
say('=== 1. COUNTS ===');
ok(tdRows.length === 154, 'tabledata1 seed is 154 rows: ' + tdRows.length);
ok(rtRows.length === 52, 'reporttable seed is 52 rows: ' + rtRows.length);
ok(rsRows.length === 10, 'reportsection seed is 10 rows: ' + rsRows.length);
ok(rmRows.length === 31, 'reportmetric seed is 31 rows: ' + rmRows.length);
{
  const kinds = {};
  rmRows.forEach(r => { kinds[r.cr2bf_kind] = (kinds[r.cr2bf_kind] || 0) + 1; });
  ok(kinds.kpi_reported === 12 && kinds.kpi_analytical === 6 &&
     kinds.chart === 12 && kinds.meta === 1,
     'metric kinds are 12/6/12/1: ' + JSON.stringify(kinds));
  ok(rmRows.every(r => r.cr2bf_spec === null || !/\"values\"/.test(r.cr2bf_spec)),
     'NO metric row carries values: definitions only, as ruled');
}

say('');
say('=== 2. THE 5 ORPHAN TITLE-YEARS ARE PRESENT ===');
{
  const withData = tdRows.filter(r => r.cr2bf_rows !== null).length;
  const noData = tdRows.filter(r => r.cr2bf_rows === null);
  ok(withData === 149, 'rows carrying data: 149 (the value sets): ' + withData);
  ok(noData.length === 5, 'rows with a title but NO data: 5: ' + noData.length);
  const keys = noData.map(r => r.cr2bf_key).sort();
  ok(deepEq(keys, ['A7:2023', 'G3:2023', 'G5:2023', 'G7:2023', 'G9:2023']),
     'and they are exactly the audited five: ' + keys.join(', '));
  ok(noData.every(r => r.cr2bf_title && r.cr2bf_title.length > 0),
     'each carries the title that would otherwise have been lost');
  ok(noData.every(r => r.cr2bf_schema === null),
     'and none invents a schema it never had');
}

say('');
say('=== 3. DIFF AGAINST THE PRESERVED 2026-09-02 ARTIFACT ===');
say('    CLCPA-219 rule: a divergence is a FINDING to report, never a file to fix.');
{
  const art = JSON.parse(fs.readFileSync(ART, 'utf8'));
  const arr = Array.isArray(art) ? art : (art.value || art.records || []);
  ok(arr.length === 149, 'the artifact holds 149 records: ' + arr.length);
  const byKey = {};
  arr.forEach(r => { byKey[r.cr2bf_key] = r; });
  const seedByKey = {};
  tdRows.forEach(r => { seedByKey[r.cr2bf_key] = r; });

  const shared = Object.keys(byKey).filter(k => seedByKey[k]);
  ok(shared.length === 149, 'all 149 artifact keys appear in the seed: ' + shared.length);

  const div = [];
  shared.forEach(k => {
    let a, b;
    try { a = JSON.parse(byKey[k].cr2bf_rows); } catch (e) { a = '<unparsable>'; }
    try { b = JSON.parse(seedByKey[k].cr2bf_rows); } catch (e) { b = '<unparsable>'; }
    if (!deepEq(a, b)) div.push({ key: k, diff: firstDiff(a, b) });
  });
  say('    shared keys compared : ' + shared.length);
  say('    DIVERGENT            : ' + div.length);
  div.slice(0, 40).forEach(d => say('      ' + d.key + '   ' + d.diff));
  if (div.length > 40) say('      ... and ' + (div.length - 40) + ' more');
  /* NOT an assertion that divergence is zero. The artifact was captured before
   * the CLCPA-142 cleanup nulled 23 derived cells in A1/2025, so at least that
   * key is EXPECTED to differ. Asserting zero here would be asserting that a
   * documented cleanup never happened. */
  ok(true, 'divergence counted and reported, not corrected: ' + div.length + ' key(s)');
  const a1 = div.find(d => d.key === 'A1:2025');
  ok(!!a1 || div.length === 0,
     a1 ? 'A1:2025 diverges as expected: the artifact predates the CLCPA-142 nulling'
        : 'no divergence at all, including A1:2025');
}

say('');
say('=== 4. RECOMPOSE THE SEED AND COMPARE CANONICALLY TO payload.json ===');
say('    the seed is proven sufficient BEFORE it is written, not after.');
{
  /* tables, from the seed rows alone */
  const tables = {};
  rtRows.forEach(r => {
    const t = {
      id: r.cr2bf_tablekey, section: r.cr2bf_section, number: r.cr2bf_number,
      short_title: r.cr2bf_shorttitle,
      mapping: r.cr2bf_mapping == null ? undefined : JSON.parse(r.cr2bf_mapping),
      data: {}, title_by_year: {}, schema_by_year: {},
    };
    /* only re-attach a hint the row actually carries, so a table without one
     * does not gain the key */
    if (r.cr2bf_presentation) {
      const p = JSON.parse(r.cr2bf_presentation);
      if (p.header_levels !== undefined) t.header_levels = p.header_levels;
      if (p.currency_cols !== undefined) t.currency_cols = p.currency_cols;
    }
    tables[r.cr2bf_tablekey] = t;
  });
  tdRows.forEach(r => {
    const t = tables[r.cr2bf_tableid]; if (!t) return;
    const y = String(r.cr2bf_year);
    if (r.cr2bf_rows !== null) t.data[y] = JSON.parse(r.cr2bf_rows);
    if (r.cr2bf_schema !== null) t.schema_by_year[y] = JSON.parse(r.cr2bf_schema);
    if (r.cr2bf_title !== null) t.title_by_year[y] = r.cr2bf_title;
  });
  const tdiff = firstDiff(tables, P.tables);
  ok(tdiff === null, 'tables recompose EXACTLY' + (tdiff ? ': ' + tdiff : ''));

  /* sections */
  const sections = {};
  rsRows.forEach(r => {
    sections[r.cr2bf_sectionkey] = {
      name: r.cr2bf_name, short_name: r.cr2bf_shortname,
      full_name: r.cr2bf_fullname, invert_metric: r.cr2bf_invertmetric,
      blurb: r.cr2bf_blurb,
    };
  });
  const sdiff = firstDiff(sections, P.sections);
  ok(sdiff === null, 'sections recompose EXACTLY' + (sdiff ? ': ' + sdiff : ''));

  /* meta: years DERIVED from the rows, current_year STORED.
   *
   * current_year was derived here too, and the org disproved it within a day: a
   * 2099 test row made the newest year with data 2099, so the dashboard would
   * have opened on a year holding one table. Which years have data is a fact
   * the rows state; which year the report covers is editorial. */
  const yrs = Array.from(new Set(tdRows.filter(r => r.cr2bf_rows !== null)
    .map(r => String(r.cr2bf_year)))).sort((a, b) => parseInt(b) - parseInt(a));
  const metaRow = rmRows.find(r => r.cr2bf_kind === 'meta');
  const cfg = JSON.parse(metaRow.cr2bf_spec);
  const meta = {
    title: metaRow.cr2bf_label, years: yrs,
    current_year: cfg.current_year != null ? String(cfg.current_year) : yrs[0],
    baseline_options: cfg.baseline_options, default_baseline: cfg.default_baseline,
  };
  ok(cfg.current_year === P.meta.current_year,
     'the meta row STORES current_year = ' + cfg.current_year +
     ', rather than deriving it from the newest year with data');
  const mdiff = firstDiff(meta, P.meta);
  ok(mdiff === null, 'meta recomposes EXACTLY, with years DERIVED' +
    (mdiff ? ': ' + mdiff : ''));

  /* kpi + chart DEFINITIONS (values are derived, and are not seeded) */
  const defOf = (k, kind) => {
    const r = rmRows.find(x => x.cr2bf_metrickey === k.id && x.cr2bf_kind === kind);
    if (!r) return null;
    const o = { id: r.cr2bf_metrickey, label: r.cr2bf_label, format: r.cr2bf_format };
    if (r.cr2bf_section !== null) o.section = r.cr2bf_section;
    if (r.cr2bf_unit !== null) o.unit = r.cr2bf_unit;
    if (r.cr2bf_primarymetric !== null) o.primary_metric = r.cr2bf_primarymetric;
    if (r.cr2bf_narrative !== null) o.narrative = r.cr2bf_narrative;
    if (r.cr2bf_sourcecalc !== null) o.source_calc = r.cr2bf_sourcecalc;
    if (r.cr2bf_spec) {
      const s = JSON.parse(r.cr2bf_spec);
      if (s.composite !== null && s.composite !== undefined) o.composite = s.composite;
      if (s.lower_is_better !== null && s.lower_is_better !== undefined) o.lower_is_better = s.lower_is_better;
    }
    return o;
  };
  let defOk = 0, defBad = [];
  ['reported', 'analytical'].forEach(fam => {
    const kind = fam === 'reported' ? 'kpi_reported' : 'kpi_analytical';
    P.kpis[fam].forEach(k => {
      const got = defOf(k, kind);
      const want = Object.assign({}, k); delete want.values;
      const d = firstDiff(got, want);
      if (d === null) defOk++; else defBad.push(k.id + ' ' + d);
    });
  });
  ok(defBad.length === 0, 'all 18 KPI DEFINITIONS recompose exactly (' + defOk +
    '/18)' + (defBad.length ? ': ' + defBad.slice(0, 3).join(' | ') : ''));

  /* THE HONEST GAP, stated rather than papered over */
  say('');
  say('    KPI VALUES: NOT SEEDED and NOT YET DERIVED.');
  say('      dac_pct on the 12 reported KPIs is already derived in the shipped');
  say('      app by kpiDacPct (CLCPA-143). total and dac are derivable -- that');
  say('      ticket asserts each equals its source table\'s stored totals -- but');
  say('      the KPI-to-table-and-column map does not exist, and the 6');
  say('      analytical source_calc entries are English prose, not executable');
  say('      rules. So a FULL recomposition of kpis.*.values cannot be claimed');
  say('      here and is reported MISSING rather than estimated. It is the');
  say('      remaining line item: 12 map entries plus 6 translated rules.');
  say('    CHART VALUES: derived, and proven 35 of 35 in derive_charts.js.');
}

/* =====================================================================
 * WRITE THE SEED FILES + MANIFEST
 * ===================================================================== */
const files = [
  ['seed_tabledata.json', tdRows, 'cr2bf_dacingesttesttabledata1s'],
  ['seed_reporttable.json', rtRows, 'cr2bf_dacreporttables'],
  ['seed_reportsection.json', rsRows, 'cr2bf_dacreportsections'],
  ['seed_reportmetric.json', rmRows, 'cr2bf_dacreportmetrics'],
];
const manifest = { generatedAt: new Date().toISOString(),
  source: 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json',
  note: 'CLCPA-238 step 4 seed. Generated offline and hashed so that the rows ' +
        'written to Dataverse are provably the rows reviewed here.',
  files: [] };
files.forEach(([name, rows, set]) => {
  const txt = JSON.stringify(rows, null, 2);
  fs.writeFileSync(path.join(OUT, name), txt);
  manifest.files.push({ file: name, entitySet: set, rows: rows.length,
    bytes: Buffer.byteLength(txt), sha256: sha(txt) });
});
fs.writeFileSync(path.join(OUT, 'seed_manifest.json'), JSON.stringify(manifest, null, 2));

say('');
say('=== SEED FILES WRITTEN ===');
manifest.files.forEach(f => say('  ' + f.file.padEnd(26) + String(f.rows).padStart(4) +
  ' rows  ' + String(f.bytes).padStart(7) + ' B  sha256 ' + f.sha256.slice(0, 16)));

say('');
say('======================================================================');
say('  ' + pass + ' passed, ' + fail + ' failed');
say('======================================================================');

const out = lines.join('\n') + '\n';
process.stdout.write(out);
fs.writeFileSync(path.join(OUT, 'gen-seed-output.txt'), out);
process.exitCode = fail ? 1 : 0;
