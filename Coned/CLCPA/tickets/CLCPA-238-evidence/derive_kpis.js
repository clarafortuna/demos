/* CLCPA-238 step 5: are the 18 KPIs derivable from table data, and by what rule?
 *
 * OFFLINE. payload.json only. No network, no org, no writes.
 *
 * WHY THIS EXISTS. CLCPA-143 established that every reported KPI's `total` and
 * `dac` equal its source table's stored totals, and derived `dac_pct` from them
 * -- but it explicitly DECLINED to invent the KPI-to-table-and-column map,
 * because nothing then needed it. CLCPA-238 needs it: once payload.json is
 * retired there is no stored copy to read. The 6 analytical KPIs are worse off
 * still: they carry `source_calc`, but as ENGLISH PROSE like
 * "(A1 DAC% + B1 DAC% + E1 DAC%) / 3", which documents a rule for a human and
 * cannot be executed.
 *
 * So this authors one rule per KPI and proves it against the stored value for
 * every year. Same discipline as derive_charts.js: the stored copy is the
 * oracle, and a rule is only as trustworthy as the comparison behind it.
 *
 * WHAT THE MAP TURNED OUT TO BE, and it is not uniform. `total` and `dac` come
 * from the same row and different columns for some KPIs (A1, A2, F7, H1), from
 * DIFFERENT ROWS of one table for others (B1, B2, D2, G1), from TWO DIFFERENT
 * TABLES for dr_participation (C2 total against C3 DAC), from a product for
 * strategic_capital (E1 grand total times its own DAC percentage), from a SUM
 * for residential_customers (J9 DAC plus non-DAC), and with no DAC figure at
 * all for clean_energy_jobs. A single positional convention would have been
 * wrong for nine of the twelve.
 */
const fs = require('fs');
const path = require('path');

const DEV = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev';
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
const say = (s) => lines.push(s);

/* ---- helpers over table data ---------------------------------------- */
const body = (id, y) => ((P.tables[id] || {}).data || {})[y] || null;
const schema = (id, y) => ((P.tables[id] || {}).schema_by_year || {})[y] || null;
/* a row found by its LABEL, never by index: row order shifts between years and
 * an index would silently read a neighbour. */
function row(id, y, labelRe) {
  const d = body(id, y); if (!d) return null;
  return d.find(r => labelRe.test(String(r[0]))) || null;
}
/* a column found by its NAME, for the same reason -- and step 2 proved these
 * headers drift year to year. */
function col(id, y, nameRe) {
  const s = schema(id, y); if (!s) return -1;
  for (let i = 0; i < s.length; i++) if (s[i] != null && nameRe.test(String(s[i]))) return i;
  return -1;
}
const cell = (id, y, labelRe, nameRe) => {
  const r = row(id, y, labelRe); const c = col(id, y, nameRe);
  if (!r || c < 0) return undefined;
  return r[c];
};
/* a percentage that may be stored as 0.44 or as "44%" */
const pct = (v) => {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && /%$/.test(v.trim())) return parseFloat(v) / 100;
  return undefined;
};
const near = (a, b, tol) => (typeof a === 'number' && typeof b === 'number' &&
  Math.abs(a - b) <= (tol === undefined ? 1e-9 : tol));

/* A PUBLISHED PERCENTAGE, PREFERRED OVER A RECOMPUTED ONE -- and this is the
 * subtlest thing in the file.
 *
 * The 6 analytical KPIs divide by percentages, and their source_calc names them
 * literally: "J9 customers DAC%", "A1 DAC%". Those ARE real table columns, so
 * reading them is reading source data, not reading a stored copy of an answer.
 * And the published values are ROUNDED: A1's Total "% in DACs" is 0.49 where
 * dac/total gives 0.4939730464674628, and J9's "DAC % of Total" is 0.44 where
 * the division gives 0.4367888. Every stored analytical value was computed from
 * the rounded figures, so deriving the shares instead reproduces none of them.
 *
 * My first pass derived, and four of the six missed by around a thousandth --
 * one cause, not four bugs.
 *
 * So the published column is preferred, and the derived share is the FALLBACK
 * for when it is absent. That fallback is not hypothetical: A1 and J9 are both
 * in PERSIST_STRIP_TABLES, so those percentage columns are stripped on save,
 * and A1/2025's is already null in Dataverse after the CLCPA-142 cleanup. Where
 * the published figure is gone, the precise share is the only honest answer
 * available -- and it will differ from what the report published. That
 * divergence is measured and reported rather than smoothed over.
 */
function pctPublished(id, y, rowRe, colRe, fallback) {
  const v = pct(cell(id, y, rowRe, colRe));
  if (typeof v === 'number') return { value: v, source: 'published' };
  const d = fallback();
  return { value: d, source: 'derived' };
}

/* =====================================================================
 * THE 12 REPORTED KPI RULES
 * ===================================================================== */
const TOTALRE = /^(grand\s+)?total$/i;
const REPORTED = {
  clean_energy_spend: (y) => ({
    total: cell('A1', y, TOTALRE, /Total Funds Expended/i),
    dac: cell('A1', y, TOTALRE, /DAC Funding/i),
  }),
  energy_savings: (y) => ({
    total: cell('A2', y, TOTALRE, /Total Energy Savings/i),
    dac: cell('A2', y, TOTALRE, /DAC Energy Savings/i),
  }),
  /* B1 splits by ROW, not by column */
  ev_funding: (y) => ({
    total: cell('B1', y, TOTALRE, /Incentive Funding/i),
    dac: cell('B1', y, /^DAC$/i, /Incentive Funding/i),
  }),
  ev_plugs: (y) => ({
    total: cell('B2', y, TOTALRE, /Total Plugs/i),
    dac: cell('B2', y, /^DAC$/i, /Total Plugs/i),
  }),
  /* TWO TABLES: the all-customers total against the DAC-only table's total */
  dr_participation: (y) => ({
    total: cell('C2', y, TOTALRE, /Participants/i),
    dac: cell('C3', y, TOTALRE, /Participants/i),
  }),
  /* D2's cumulative column is "Up to 2025" in 2025 and "Cumulative through
   * 2023" in 2023. Same quantity, different words. */
  der_mw: (y) => ({
    total: cell('D2', y, /^Total MW installed \(All DERs\)$/i, /^(Up to|Cumulative through)/i),
    dac: cell('D2', y, /^Total MW installed in DACs \(All DERs\)$/i, /^(Up to|Cumulative through)/i),
  }),
  /* a PRODUCT: the grand total times its own DAC percentage. The stored dac
   * appears nowhere as a cell, which is why a cell search found nothing. */
  strategic_capital: (y) => {
    const t = cell('E1', y, /^Grand Total$/i, /Total Investment/i);
    const p = pct(cell('E1', y, /^Grand Total$/i, /Percentage.*Affecting DACs/i));
    return { total: t, dac: (typeof t === 'number' && typeof p === 'number') ? t * p : undefined };
  },
  customer_outages: (y) => ({
    total: cell('F7', y, /^Grand Total$/i, /Total Customers Interrupted/i),
    dac: cell('F7', y, /^Grand Total$/i, /^DAC Customers Interrupted/i),
  }),
  /* G1 IS THE SYSTEMWIDE TABLE, BUT IT IS EMPTY IN 2023. Its two rows carry
   * null that year and it has no Systemwide Total row at all, so the 2023
   * figures exist NOWHERE as a cell -- a value search found neither. They are
   * the sum across the four borough Replaced tables: G2 Bronx, G4 Manhattan,
   * G6 Queens, G8 Westchester. Summing those gives 194,062 within DAC and
   * 422,428 in total, which is exactly what the KPI stores.
   *
   * The boroughs are NOT used when G1 is populated, and that is deliberate
   * rather than lazy: for 2025 the borough sum is 193,384 within DAC while G1
   * reports 202,384. The two disagree by 9,000 feet. G1 is the systemwide
   * table and is authoritative where it exists; the boroughs are the fallback
   * only where it does not. That disagreement is a data question for ConEd,
   * noted here and not resolved by choosing quietly. */
  main_replacement: (y) => {
    const t = cell('G1', y, /^Systemwide Total$/i, /Feet Replaced/i);
    const d = cell('G1', y, /within DAC/i, /Feet Replaced/i);
    if (typeof t === 'number' && typeof d === 'number') return { total: t, dac: d };
    const BOROUGHS = ['G2', 'G4', 'G6', 'G8'];
    let st = 0, sd = 0, got = 0;
    BOROUGHS.forEach(id => {
      const inDac = cell(id, y, /within DAC/i, /Feet Replaced/i);
      const notDac = cell(id, y, /not in a DAC/i, /Feet Replaced/i);
      if (typeof inDac === 'number' && typeof notDac === 'number') {
        sd += inDac; st += inDac + notDac; got++;
      }
    });
    if (got !== BOROUGHS.length) return { total: undefined, dac: undefined };
    return { total: st, dac: sd };
  },
  leak_repairs: (y) => ({
    total: cell('H1', y, /^Grand Total$/i, /Grand Total/i),
    /* ANCHORED. /DAC Repairs/ matches "Non-DAC Repairs" first, which is the
     * neighbouring column, and it read 4,961 where 3,062 was wanted. The same
     * substring trap as the isTotalRowLabel bug in CLCPA-200. */
    dac: cell('H1', y, /^Grand Total$/i, /^DAC Repairs/i),
  }),
  /* no DAC breakdown exists for jobs, and null is the honest answer rather
   * than a zero */
  clean_energy_jobs: (y) => ({
    total: cell('I1', y, /^Number of jobs placed as a result/i, /^Unique$/i),
    dac: null,
  }),
  /* a SUM: J9 reports DAC and non-DAC, never the total */
  residential_customers: (y) => {
    /* the row is "Residential Customers" in 2025 and "Total Number of
     * Residential Customers" in 2023, so the label is matched at its END */
    const d = cell('J9', y, /Residential Customers$/i, /^Total in DAC/i);
    const n = cell('J9', y, /Residential Customers$/i, /^Total in Non-DAC/i);
    return { total: (typeof d === 'number' && typeof n === 'number') ? d + n : undefined, dac: d };
  },
};

/* =====================================================================
 * THE 6 ANALYTICAL RULES, translated from their prose source_calc
 * ===================================================================== */
const share = (o) => (o && typeof o.dac === 'number' && typeof o.total === 'number' &&
  o.total > 0) ? o.dac / o.total : undefined;
/* THREE of the six ratios divide by the same thing, so it is written once.
 *
 * AND THE ANSWER IS FORCED BY THE ARCHITECTURE, which is worth stating plainly.
 * Solving for the denominator the stored values actually used gives, for all
 * three ratios and all three years, exactly `residential_customers.dac_pct` --
 * the REPORTED KPI's own stored share. Nine of nine, to the last digit.
 *
 * That stored share is inconsistently rounded. 2023 and 2024 carry full
 * precision and equal dac/total exactly; 2025 carries exactly 0.44 where the
 * division gives 0.43676506537302767. Which is CLCPA-143's finding verbatim:
 * "every one of them was a round 2dp value, while every value that still agreed
 * carried full precision."
 *
 * Once payload.json is retired that stored share does not exist -- it is
 * derived, by kpiDacPct, which CLCPA-143 shipped precisely to stop reading
 * rounded copies. So the denominator here MUST be the derived share. This is
 * not a preference between two options; there is only one input left.
 *
 * The consequence is measured, not waved past: 2023 and 2024 reproduce exactly,
 * and the three 2025 ratios come out about 0.7% higher than the payload
 * publishes, because the payload divided by a rounded number. Asserted below as
 * a named exception so a NEW divergence still fails. */
const j9Share = (y) => share(REPORTED.residential_customers(y));
const ANALYTICAL = {
  /* "(A1 DAC% + B1 DAC% + E1 DAC%) / 3" */
  equity_index: (y) => {
    const a = pctPublished('A1', y, TOTALRE, /% in DACs/i,
      () => share(REPORTED.clean_energy_spend(y))).value;
    /* B1 has no percentage column at all, so its share is derived and always
     * was: the stored dac_pct for ev_funding carries full precision, which is
     * the signature of a computed value rather than a transcribed one. */
    const b = share(REPORTED.ev_funding(y));
    const e = pct(cell('E1', y, /^Grand Total$/i, /Percentage.*Affecting DACs/i));
    if ([a, b, e].some(x => typeof x !== 'number')) return undefined;
    return (a + b + e) / 3;
  },
  /* "Section A: total incentive $ / total MMBtu saved" */
  cost_per_mmbtu: (y) => {
    const spend = REPORTED.clean_energy_spend(y).total;
    const mmbtu = REPORTED.energy_savings(y).total;
    if (typeof spend !== 'number' || typeof mmbtu !== 'number' || mmbtu === 0) return undefined;
    return spend / mmbtu;
  },
  /* "B2 plugs DAC% / J9 customers DAC%" */
  ev_equity_ratio: (y) => {
    const p = share(REPORTED.ev_plugs(y));
    const c = j9Share(y);
    return (typeof p === 'number' && typeof c === 'number' && c !== 0) ? p / c : undefined;
  },
  /* "F7 customers interrupted DAC% / J9 customers DAC%" */
  outage_burden_ratio: (y) => {
    const o = share(REPORTED.customer_outages(y));
    const c = j9Share(y);
    return (typeof o === 'number' && typeof c === 'number' && c !== 0) ? o / c : undefined;
  },
  /* "H1 leak repairs DAC% / J9 customers DAC%" */
  leak_velocity_ratio: (y) => {
    const l = share(REPORTED.leak_repairs(y));
    const c = j9Share(y);
    return (typeof l === 'number' && typeof c === 'number' && c !== 0) ? l / c : undefined;
  },
  /* "(J8 DAC electric + gas $) / (J7 DAC electric + gas + dual enrollees)" */
  eap_per_customer: (y) => {
    /* "Electric" in 2025, "Electric ($)" in 2023 */
    const e = cell('J8', y, /^Total in DAC$/i, /^Electric(\s*\(\$\))?$/i);
    const g = cell('J8', y, /^Total in DAC$/i, /^Gas(\s*\(\$\))?$/i);
    const ce = cell('J7', y, /^Total in DAC$/i, /^Electric-only$/i);
    const cg = cell('J7', y, /^Total in DAC$/i, /^Gas-only$/i);
    const cd = cell('J7', y, /^Total in DAC$/i, /^Dual Service$/i);
    if ([e, g, ce, cg, cd].some(x => typeof x !== 'number')) return undefined;
    const cust = ce + cg + cd;
    return cust ? (e + g) / cust : undefined;
  },
};

/* =====================================================================
 * RUN
 * ===================================================================== */
say('======================================================================');
say('CLCPA-238 step 5: are the 18 KPIs derivable from table data?');
say('  offline: payload.json only. The stored value is the oracle.');
say('======================================================================');

say('');
say('=== THE 12 REPORTED KPIs: total and dac ===');
let repOk = 0, repTotal = 0;
P.kpis.reported.forEach(k => {
  const rule = REPORTED[k.id];
  if (!rule) { ok(false, k.id + ': NO RULE'); return; }
  const years = Object.keys(k.values || {});
  const bad = [];
  years.forEach(y => {
    repTotal++;
    const got = rule(y);
    const want = k.values[y];
    /* strategic_capital's dac is a float product, so it is compared with a
     * tolerance rather than exactly -- and the tolerance is stated, not hidden:
     * one part in a billion of the value. */
    const tol = k.id === 'strategic_capital' ? Math.abs(want.dac || 0) * 1e-9 : 0;
    const tOk = (want.total === null && got.total == null) ||
                (tol ? near(got.total, want.total, tol) : got.total === want.total);
    const dOk = (want.dac === null && (got.dac === null || got.dac === undefined)) ||
                (tol ? near(got.dac, want.dac, tol) : got.dac === want.dac);
    if (tOk && dOk) repOk++;
    else bad.push(y + ' total ' + JSON.stringify(got.total) + ' vs ' +
      JSON.stringify(want.total) + ', dac ' + JSON.stringify(got.dac) + ' vs ' +
      JSON.stringify(want.dac));
  });
  ok(bad.length === 0, k.id.padEnd(24) + ' ' + (years.length - bad.length) + '/' +
    years.length + ' years' + (bad.length ? '  ' + bad[0] : ''));
});
say('  reported KPI-years derived exactly: ' + repOk + ' of ' + repTotal);

say('');
say('=== dac_pct: already derived in the shipped app, asserted consistent ===');
{
  /* kpiDacPct is dac/total. Assert the derived total and dac reproduce the
   * SHIPPED derivation, so the composer and the app agree by construction. */
  let n = 0, bad = 0;
  P.kpis.reported.forEach(k => {
    Object.keys(k.values || {}).forEach(y => {
      const got = REPORTED[k.id](y);
      if (typeof got.dac !== 'number' || typeof got.total !== 'number' || got.total <= 0) return;
      n++;
      const derived = got.dac / got.total;
      const stored = k.values[y].dac_pct;
      /* the stored copy is sometimes a rounded 2dp value -- that is the exact
       * defect CLCPA-143 found and fixed by deriving. So this asserts the
       * derivation is SANE, not that it equals a rounded copy. */
      if (!(derived >= 0 && derived <= 1.0001)) bad++;
    });
  });
  ok(bad === 0, 'dac/total is a sane share for all ' + n + ' KPI-years with both inputs');
}

say('');
say('=== THE 6 ANALYTICAL KPIs, prose translated into rules ===');
let anOk = 0, anTotal = 0;
/* THE NAMED EXCEPTION: three ratios, 2025 only, because the payload divided by
 * a rounded share that no longer exists once it is retired. Anything else that
 * diverges is a real failure. */
const ROUNDING_EXCEPTION = {
  ev_equity_ratio: ['2025'], outage_burden_ratio: ['2025'],
  leak_velocity_ratio: ['2025'],
};
const excepted = [];
P.kpis.analytical.forEach(k => {
  const rule = ANALYTICAL[k.id];
  if (!rule) { ok(false, k.id + ': NO RULE'); return; }
  const years = Object.keys(k.values || {});
  const bad = [];
  years.forEach(y => {
    anTotal++;
    const got = rule(y);
    const want = k.values[y] ? k.values[y].value : undefined;
    /* every analytical value is a float quotient, so a relative tolerance is
     * the only honest comparison. Stated at one part in a billion. */
    const tol = Math.abs(want || 0) * 1e-9;
    const allowed = (ROUNDING_EXCEPTION[k.id] || []).indexOf(y) >= 0;
    if (near(got, want, tol)) { anOk++; if (allowed) bad.push(y +
      ' MATCHED but was listed as an exception -- the list is now wrong'); }
    else if (allowed) {
      excepted.push({ id: k.id, year: y, got: got, want: want,
        pctDiff: 100 * (got - want) / want });
    } else {
      bad.push(y + ' got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));
    }
  });
  const nEx = (ROUNDING_EXCEPTION[k.id] || []).length;
  ok(bad.length === 0, k.id.padEnd(24) + ' ' + (years.length - bad.length - nEx) +
    '/' + (years.length - nEx) + ' years' + (nEx ? ' (' + nEx + ' excepted)' : '') +
    (bad.length ? '  ' + bad[0] : ''));
  say('        source_calc: ' + k.source_calc);
});
say('');
say('  THE ROUNDING EXCEPTION, quantified rather than asserted away:');
excepted.forEach(e => say('    ' + e.id.padEnd(22) + e.year + '  derived ' +
  e.got.toFixed(6) + '  payload ' + e.want.toFixed(6) + '  ' +
  (e.pctDiff >= 0 ? '+' : '') + e.pctDiff.toFixed(3) + '%'));
ok(excepted.length === 3,
   'exactly 3 excepted KPI-years, all 2025, all the same cause: ' + excepted.length);
ok(excepted.every(e => Math.abs(e.pctDiff) < 1.5),
   'and each differs by under 1.5%, so no figure moves materially');
say('  analytical KPI-years derived exactly: ' + anOk + ' of ' + anTotal);

say('');
say('======================================================================');
say('  ' + pass + ' passed, ' + fail + ' failed');
say('======================================================================');

const out = lines.join('\n') + '\n';
process.stdout.write(out);
fs.writeFileSync(path.join(__dirname, 'derive-kpis-output.txt'), out);
process.exitCode = fail ? 1 : 0;
