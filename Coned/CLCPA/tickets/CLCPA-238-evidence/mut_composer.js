/* CLCPA-238 step 5 mutation controls.
 *
 * The ones that matter most: break a derive rule in a way that still produces a
 * number, and flip the flag. If either goes green, the round is unguarded.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DIR = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/CLCPA-238-evidence';
const APP = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/app.js';

const M = [
  /* ---- the flag: the shipped default ---------------------------------- */
  { name: "THE FLIP IS REVERTED: back onto payload.json",
    from: "  var DAC_SOURCE = 'dataverse';",
    to:   "  var DAC_SOURCE = 'payload';",
    /* The revert is a LEGITIMATE operation -- it is the parachute. So this
     * proves the suite NOTICES it, not that it is forbidden. A revert that
     * happened silently would be the dangerous thing. */
    expect: "DAC_SOURCE is 'dataverse'" },
  { name: 'THE PARACHUTE IS CUT: loadPayload stops running before the flag',
    from: "      state.payload = await loadPayload();",
    to:   "      state.payload = null; void loadPayload;",
    /* If the file is not loaded on every boot, reverting the flag would need a
     * deploy -- exactly the property ruled to hold through Sept 10.
     *
     * Caught by the ORDERING assertion, not by the fetch one: removing the CALL
     * leaves loadPayload's body intact, so `fetch('payload.json')` is still
     * present in the source. My first expectation named the weaker of the two,
     * and the distinction is the point -- the function existing is not the same
     * as the function running. */
    expect: 'loadPayload() still runs BEFORE the flag is consulted' },
  { name: 'seedYears stops subtracting the added years, freezing 2099 as a seed',
    from: "            .map(String).filter(y => addedYears.indexOf(y) < 0);",
    to:   "            .map(String);",
    expect: 'seedYears subtracts the added-year table' },
  { name: 'shadow mode is switched off',
    from: '  var DAC_SHADOW = true;',
    to:   '  var DAC_SHADOW = false;',
    expect: 'DAC_SHADOW is still true' },
  { name: 'a failed compose blanks the payload instead of keeping it',
    from: "        if (fromDv) {\n          state.payload = fromDv;",
    to:   "        {\n          state.payload = fromDv;",
    expect: 'a null composition does not replace the payload' },
  { name: 'the source switch moves BEFORE Storage.init, where composing cannot work',
    from: "    await Storage.init();\n\n    /* CLCPA-238: THE SOURCE SWITCH.",
    to:   "    /* CLCPA-238: THE SOURCE SWITCH.",
    expect: 'the source switch runs AFTER Storage.init()' },

  /* ---- shadow mode must not touch the page ---------------------------- */
  { name: 'SHADOW MODE STARTS RENDERING: it assigns state.payload',
    from: "    const parts = ['meta', 'sections', 'tables', 'kpis', 'charts'];",
    to:   "    state.payload = composed;\n    const parts = ['meta', 'sections', 'tables', 'kpis', 'charts'];",
    expect: 'it NEVER assigns state.payload' },
  { name: 'shadow mode raises a toast, so a viewer sees a diagnostic',
    from: "      console.warn('[CLCPA-238] shadow: ' + same + ' of ' + parts.length +",
    to:   "      showToast('shadow mismatch', 'error');\n      console.warn('[CLCPA-238] shadow: ' + same + ' of ' + parts.length +",
    expect: 'it touches no DOM and raises no toast' },
  { name: 'shadow mode is awaited, delaying the page on a slow org',
    from: "      dacShadowCompare(state.payload).catch(e =>",
    to:   "      await dacShadowCompare(state.payload).catch(e =>",
    expect: 'never awaited, so it cannot delay a pixel' },
  { name: 'shadow mode runs even when Dataverse is already the source',
    from: "    if (DAC_SHADOW && DAC_SOURCE !== 'dataverse') {",
    to:   "    if (DAC_SHADOW) {",
    expect: 'skipped when Dataverse is already the source' },

  /* ---- the boot reads -------------------------------------------------- */
  { name: 'the three boot reads go back to being sequential',
    from: "          const [td, hh, yy] = await Promise.all([",
    to:   "          const td = await getAll(SET_TABLEDATA, '$select=' + ID_TABLEDATA + ',cr2bf_key,cr2bf_section,cr2bf_tableid,cr2bf_year,cr2bf_rows');\n          const hh = await getAll(SET_HISTORY, '$select=' + ID_HISTORY + ',cr2bf_tableid,cr2bf_year,cr2bf_user,cr2bf_email,cr2bf_savedat,cr2bf_changes&$orderby=cr2bf_savedat desc');\n          const yy = await getAll(SET_YEARS, '$select=' + ID_YEARS + ',cr2bf_reportingyear');\n          const _unused = ([",
    expect: 'the three reads are destructured from one Promise.all' },
  { name: 'the four report-source reads become sequential',
    from: "          const [td, rt, rs, rm] = await Promise.all([",
    to:   "          const [td, rt, rs, rm] = await Promise.resolve([",
    expect: 'it reads its four tables together' },
  { name: 'the localStorage backend returns an empty shape instead of null',
    from: "        async getReportSource() { return null; },",
    to:   "        async getReportSource() { return { tabledata: [], tables: [], sections: [], metrics: [] }; },",
    expect: 'the localStorage backend returns null' },

  /* ---- the orphan title-year SHAPE, which survived a whole fix round -- */
  { name: 'A TITLE-ONLY ROW COMPOSES TO undefined AGAIN, not an explicit null',
    from: "        t.data[y] = null;",
    to:   "        void y;",
    /* This is the shape error the shadow caught twice. Raw payload.json has no
     * key for a title-only year, so the offline proof said "correct" while the
     * app produced an explicit null through applyOverrides. Now caught against
     * the RENDERED reference. */
    expect: 'tables recompose EXACTLY as STORED, against the RENDERED shape' },
  { name: 'the null is written for EVERY row, not only the ones with no data',
    from: "      if (x.cr2bf_rows != null) { try { t.data[y] = JSON.parse(x.cr2bf_rows); } catch (e) {} }",
    to:   "      if (false) { try { t.data[y] = JSON.parse(x.cr2bf_rows); } catch (e) {} }",
    expect: 'tables recompose EXACTLY as STORED, against the RENDERED shape' },

  /* ---- the composer: STRUCTURE ---------------------------------------- */
  { name: 'years are stored on the meta row instead of derived',
    from: "    years.sort((a, b) => parseInt(b, 10) - parseInt(a, 10));",
    to:   "    years.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));",
    expect: 'meta.years matches' },
  { name: 'the title-only rows create a year that was never reported',
    from: "      if (x.cr2bf_rows == null) return;\n      const y = String(x.cr2bf_year);\n      if (years.indexOf(y) < 0) years.push(y);",
    to:   "      const y = String(x.cr2bf_year);\n      if (years.indexOf(y) < 0) years.push(y);",
    /* A DEMONSTRATED NO-OP ON THIS DATA, recorded as one rather than dressed
     * up as a control. All five title-only rows are 2023, and 2023 is already
     * a year because other tables reported it, so including them changes the
     * year list not at all. It WOULD matter for a title-only row in a year
     * nothing else reported, which the payload does not contain. Kept in the
     * list so the green is explained instead of looking like a gap. */
    noop: true, expect: '(no-op on this data)' },
  { name: 'presentation hints are dropped, losing header_levels on 4 tables',
    from: "      if (x.cr2bf_presentation != null) {",
    to:   "      if (false) {",
    expect: 'tables recompose EXACTLY as STORED' },
  { name: 'mapping is dropped from every table',
    from: "      if (x.cr2bf_mapping != null) { try { t.mapping = JSON.parse(x.cr2bf_mapping); } catch (e) {} }",
    to:   "      void x.cr2bf_mapping;",
    expect: 'tables recompose EXACTLY as STORED' },
  { name: 'the schema column is ignored, so every table loses schema_by_year',
    from: "      if (x.cr2bf_schema != null) { try { t.schema_by_year[y] = JSON.parse(x.cr2bf_schema); } catch (e) {} }",
    to:   "      void x.cr2bf_schema;",
    expect: 'EXACTLY' },
  { name: 'section invert_metric is passed through untruthed, so 0 stays 0',
    from: "        invert_metric: !!x.cr2bf_invertmetric, blurb: x.cr2bf_blurb };",
    to:   "        invert_metric: x.cr2bf_invertmetric, blurb: x.cr2bf_blurb };",
    /* green against the seed, which stores real booleans. The suite now drives
     * a NULL through the composer, which is what Dataverse returns for an
     * unset two-option column. */
    expect: 'a null invert_metric composes to false' },

  /* ---- the composer: DERIVE RULES, broken but still numeric ---------- */
  { name: 'A1_programs keeps the total rows instead of dropping them',
    from: "      return d.filter(r => !isStrictTotalRowLabel(r[0]))\n        .map(r => Object.assign({ name: r[0] }, dacPick(r, m)))\n        .sort((a, b) => b.total - a.total).slice(0, 12);",
    to:   "      return d.map(r => Object.assign({ name: r[0] }, dacPick(r, m)))\n        .sort((a, b) => b.total - a.total).slice(0, 12);",
    expect: 'charts match the payload EXACTLY on every non-percentage field' },
  { name: 'A1_programs takes the top 10 instead of the top 12',
    from: ".sort((a, b) => b.total - a.total).slice(0, 12);",
    to:   ".sort((a, b) => b.total - a.total).slice(0, 10);",
    expect: 'charts match the payload EXACTLY on every non-percentage field' },
  { name: "F8's total becomes a column read instead of dac + nondac",
    from: "        .map(r => ({ name: r[0], dac: r[iD], nondac: r[iN], total: r[iD] + r[iN] }));",
    to:   "        .map(r => ({ name: r[0], dac: r[iD], nondac: r[iN], total: r[iD] }));",
    expect: 'charts match the payload EXACTLY on every non-percentage field' },
  { name: "H1's DAC column loses its anchor, matching Non-DAC Repairs first",
    from: "      const m = { nondac: dacCol(T, 'H1', y, /^Non-DAC Repairs/i),\n                  dac: dacCol(T, 'H1', y, /^DAC Repairs/i),",
    to:   "      const m = { nondac: dacCol(T, 'H1', y, /^Non-DAC Repairs/i),\n                  dac: dacCol(T, 'H1', y, /DAC Repairs/i),",
    expect: 'charts match the payload EXACTLY on every non-percentage field' },
  { name: 'G_replacement reads the abandonment tables',
    from: "      [['Bronx', 'G2'], ['Manhattan', 'G4'], ['Queens', 'G6'], ['Westchester', 'G8']]),",
    to:   "      [['Bronx', 'G3'], ['Manhattan', 'G5'], ['Queens', 'G7'], ['Westchester', 'G9']]),",
    expect: 'charts match the payload EXACTLY on every non-percentage field' },
  { name: 'B2 stops omitting Micromobility, inventing a key for 2023 and 2024',
    from: "                  Micromobility: dacCol(T, 'B2', y, /^Micromobility Power Cabinets$/i),",
    to:   "                  Micromobility: Math.max(0, dacCol(T, 'B2', y, /^Micromobility Power Cabinets$/i)),",
    expect: 'charts match the payload EXACTLY on every non-percentage field' },
  { name: 'columns are read by INDEX instead of by name, which 2023 breaks',
    from: "    const m = { participants: dacCol(T, id, y, /^Program Participants$/i),\n                committed: dacCol(T, id, y, /^Committed Load Relief/i),\n                delivered: dacCol(T, id, y, /^Delivered Load Relief/i) };",
    to:   "    const m = { participants: 3, committed: 5, delivered: 7 };",
    expect: 'charts match the payload EXACTLY on every non-percentage field' },

  /* ---- the KPI rules -------------------------------------------------- */
  { name: 'dr_participation reads its DAC figure from C2 instead of C3',
    from: "      dac: dacCell(T, 'C3', y, DAC_TOTAL_RE, /^Program Participants$/i) }),",
    to:   "      dac: dacCell(T, 'C2', y, DAC_TOTAL_RE, /^Participants$/i) }),",
    expect: 'rounding near miss' },
  { name: "strategic_capital's dac stops being a product and reads a cell",
    from: "      return { total: t, dac: (typeof t === 'number' && typeof p === 'number') ? t * p : undefined };",
    to:   "      return { total: t, dac: t };",
    expect: 'rounding near miss' },
  { name: 'main_replacement always sums the boroughs, ignoring G1',
    from: "      if (typeof t === 'number' && typeof d === 'number') return { total: t, dac: d };",
    to:   "      if (false) return { total: t, dac: d };",
    expect: 'rounding near miss' },
  { name: 'residential_customers reads a total column that does not exist',
    from: "      return { total: (typeof d === 'number' && typeof n === 'number') ? d + n : undefined, dac: d };",
    to:   "      return { total: dacCell(T, 'J9', y, /Residential Customers$/i, /^Total$/i), dac: d };",
    expect: 'rounding near miss' },
  { name: 'clean_energy_jobs invents a zero where there is no DAC figure',
    from: "      dac: null }),",
    to:   "      dac: 0 }),",
    expect: 'rounding near miss' },
  { name: 'dac_pct is stored from the row instead of derived by kpiDacPct',
    from: "          e.dac_pct = kpiDacPct(e);",
    to:   "          e.dac_pct = Math.round((e.dac / e.total) * 100) / 100;",
    expect: 'every composed dac_pct IS what the shipped kpiDacPct' },
  { name: 'equity_index loses its published-percentage preference',
    from: "      let a = dacPct(dacCell(T, 'A1', y, DAC_TOTAL_RE, /^% in DACs/i));\n      if (typeof a !== 'number') a = dacShare(DAC_KPI_REPORTED.clean_energy_spend(T, y));",
    to:   "      let a = dacShare(DAC_KPI_REPORTED.clean_energy_spend(T, y));",
    expect: 'equity_index still PREFERS the A1 published' },
  { name: 'the J9 share reads the rounded column, hiding the finding',
    from: "  const dacJ9Share = (T, y) => dacShare(DAC_KPI_REPORTED.residential_customers(T, y));",
    to:   "  const dacJ9Share = (T, y) => dacPct(dacCell(T, 'J9', y, /Residential Customers$/i, /^DAC % of Total/i));",
    /* this makes the three 2025 ratios MATCH the payload, which sounds like an
     * improvement and is not: it reintroduces reading a rounded copy, the
     * defect CLCPA-143 exists to have removed. Caught by the exception count. */
    expect: 'the J9 share is DERIVED' },
  { name: 'eap_per_customer drops dual-service customers from the denominator',
    from: "      const cust = ce + cg + cd;",
    to:   "      const cust = ce + cg;",
    expect: 'under the 1.5% ceiling' },

  /* ---- the canonical compare ------------------------------------------ */
  { name: 'the canonical compare becomes order-SENSITIVE',
    from: "    Object.keys(v).sort().forEach(k => { o[k] = dacCanon(v[k]); });",
    to:   "    Object.keys(v).forEach(k => { o[k] = dacCanon(v[k]); });",
    /* A NO-OP FOR CORRECTNESS, and finding out why was worth the detour.
     *
     * I expected this to be caught by the direct assertion that key order is
     * ignored. It is not, and the assertion is still right: dacFirstDiff gets
     * its order-insensitivity from its RECURSIVE DESCENT, which walks the union
     * of both key sets and compares values by name. dacCanon's sort only serves
     * the fast-path stringify comparison at the top of the function. Remove the
     * sort and the fast path stops matching for reordered objects, so the
     * function falls through to the descent and returns the same verdict, more
     * slowly.
     *
     * So the sort is an optimisation, not the mechanism, and the mutation
     * changes speed rather than answers. Recorded rather than papered over,
     * because "this guard exists but that mutation cannot reach it" is a
     * different statement from "this is guarded". */
    noop: true, expect: '(no-op: the sort is a fast path, not the mechanism)' },
  { name: 'the compare stops distinguishing 0 from -0',
    from: "        if (v === 0) return (1 / v === -Infinity) ? '-0' : '0';",
    to:   "        if (v === 0) return '0';",
    /* also green at first, for the same reason: no value in the payload is
     * negative zero. Now caught by the direct assertion. */
    expect: 'zero and NEGATIVE zero are told apart' },
];

let caught = 0, missed = 0;
const report = [];
M.forEach((m) => {
  const base = fs.readFileSync(APP, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  if (n !== 1) {
    report.push('  ??? ' + m.name + ' -- ANCHOR ' + n + ', NOT APPLIED');
    missed++; return;
  }
  fs.writeFileSync(APP, base.replace(from, () => to));
  let out = '';
  try { out = execFileSync('node', ['suite_composer.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(APP, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(APP, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }

  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const hit = fails.filter(l => l.indexOf(m.expect) >= 0);
  if (m.noop && fails.length) {
    report.push('  ??? ' + m.name + ' -- declared a NO-OP but it went RED: ' +
      fails[0].trim().slice(5, 90));
    missed++; return;
  }
  if (hit.length) {
    report.push('  red  ' + m.name);
    report.push('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 106));
    caught++;
  } else if (fails.length) {
    report.push('  ??? ' + m.name + ' -- ' + fails.length + ' red, not the expected one');
    report.push('       want: ' + m.expect);
    report.push('       got : ' + fails[0].trim().slice(5, 106));
    missed++;
  } else if (m.noop) {
    report.push('  noop ' + m.name);
    report.push('       green as expected: this mutation changes nothing on this data');
    caught++;
  } else {
    report.push('  GREEN ' + m.name + ' -- NOT NOTICED. Not a guard.');
    missed++;
  }
});

/* CLEAN RE-RUN against restored source, per the standing law. */
let cleanOk = true;
try { execFileSync('node', ['suite_composer.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) {
  cleanOk = false;
  console.error('THE CLEAN RE-RUN FAILED: the restored source does not pass.');
  console.error((e.stdout || '').split('\n').filter(l => /FAIL/.test(l)).join('\n'));
}

console.log('======================================================================');
console.log('CLCPA-238 step 5 -- mutation controls');
console.log('======================================================================');
report.forEach(l => console.log(l));
console.log('');
console.log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length);
console.log('  clean re-run against restored source: ' + (cleanOk ? 'PASSES' : 'FAILED'));
process.exitCode = (missed || !cleanOk) ? 1 : 0;
