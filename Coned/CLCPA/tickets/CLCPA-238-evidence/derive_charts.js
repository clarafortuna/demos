/* CLCPA-238 step 2, the chart half: are the 12 charts DERIVABLE from table
 * data, and at what cost?
 *
 * OFFLINE. Reads payload.json and nothing else. No network, no org, no writes.
 *
 * WHY THIS EXISTS. charts and kpis carry their own copies of numbers that also
 * live in tables, so "nothing hardcoded" forces derivation. My audit probe
 * reproduced 9 of 35 chart-years with one narrow hypothesis (project a
 * name-guessed table, sort, truncate) and I reported the other 26 as UNPROVEN
 * rather than underivable, because the probe had failed on its own heuristic in
 * at least some cases. This converts that 26 into a known quantity by authoring
 * one explicit spec per chart.
 *
 * WHAT THE AUDIT PROBE GOT WRONG, now that the specs are written:
 *   - F8's `total` is NOT a column. It is dac + nondac, computed.
 *   - H1 orders the columns Non-DAC then DAC, the opposite of F8, so a
 *     positional guess maps dac to the wrong column.
 *   - C3/C5 carry null columns from merged cells, so the value columns sit at
 *     3, 5 and 7 rather than 1, 2 and 3.
 *   - G_replacement and G_abandonment are not single-table projections at all.
 *     They aggregate FOUR tables each, one per borough (G2/G4/G6/G8 replaced,
 *     G3/G5/G7/G9 abandoned), with the borough name coming from the TABLE and
 *     not from any cell.
 * None of those were failures of derivability. All were failures of my guess.
 *
 * TOTAL ROWS are dropped using the SHIPPED predicate, extracted from app.js --
 * isStrictTotalRowLabel, the CLCPA-209 structural one -- rather than a rule
 * retyped here. A retyped rule would let this file agree with itself while
 * disagreeing with the app.
 */
const fs = require('fs');
const path = require('path');

const DEV = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev';
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const SRC = fs.readFileSync(path.join(DEV, 'app.js'), 'utf8');

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
function guard(label, fn) {
  try { fn(); }
  catch (e) { ok(false, label + ' THREW instead of failing: ' + (e && e.message ? e.message : String(e))); }
}
function grab(name) {
  for (const pad of ['  ', '    ', '']) for (const kw of ['function ', 'async function ']) {
    const head = '\r\n' + pad + kw + name + '(';
    const i = SRC.indexOf(head); if (i < 0) continue;
    const close = '\r\n' + pad + '}';
    const j = SRC.indexOf(close, i + head.length);
    if (j >= 0) return SRC.slice(i + 2, j + close.length);
  } return null;
}

/* ---- the shipped total-row predicate --------------------------------- */
const isTotalSrc = grab('isStrictTotalRowLabel');
if (!isTotalSrc) { console.error('isStrictTotalRowLabel not found in app.js'); process.exit(1); }
const isStrictTotalRowLabel = new Function(
  isTotalSrc + '\nreturn isStrictTotalRowLabel;')();

/* ---- CANONICAL DEEP COMPARE, as ruled -------------------------------- *
 * NOT JSON.stringify equality. A composed object's key order will differ from
 * the file's and stringify is order-sensitive; H1_boroughs already proves the
 * point, storing nondac before dac where F8 stores dac first. Nothing in the
 * app consumes key order (Object.keys on tables appears once, for .length),
 * so an order-insensitive compare is the CORRECT test rather than a weakened
 * one. -0 and NaN are handled explicitly because both survive JSON round trips
 * badly and would otherwise compare equal to 0 and to nothing.               */
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
/* and the first difference, so a mismatch is a coordinate not a shrug */
function firstDiff(a, b, p) {
  p = p || '';
  const ca = canon(a), cb = canon(b);
  if (JSON.stringify(ca) === JSON.stringify(cb)) return null;
  if (ca === null || cb === null || typeof ca !== 'object' || typeof cb !== 'object') {
    return p + ': ' + JSON.stringify(ca) + ' vs ' + JSON.stringify(cb);
  }
  if (Array.isArray(ca) !== Array.isArray(cb)) return p + ': array vs object';
  if (Array.isArray(ca)) {
    if (ca.length !== cb.length) return p + ': length ' + ca.length + ' vs ' + cb.length;
    for (let i = 0; i < ca.length; i++) {
      const d = firstDiff(a[i], b[i], p + '[' + i + ']'); if (d) return d;
    }
    return null;
  }
  const keys = Array.from(new Set(Object.keys(ca).concat(Object.keys(cb))));
  for (const k of keys) {
    const d = firstDiff(a[k], b[k], p + '.' + k); if (d) return d;
  }
  return null;
}

/* ---- helpers over table data ----------------------------------------- */
const body = (id, y) => ((P.tables[id] || {}).data || {})[y] || null;
const schema = (id, y) => ((P.tables[id] || {}).schema_by_year || {})[y] || null;
const dropTotals = (rows) => rows.filter(r => !isStrictTotalRowLabel(r[0]));

/* COLUMNS ARE RESOLVED BY NAME, NOT BY INDEX, and that is the whole lesson of
 * this exercise. My first pass hard-coded indices and four chart-years failed:
 *   - C3 and C5 have FOUR columns in 2023 and EIGHT in 2024/2025, because
 *     merged cells arrived and brought null columns with them, moving
 *     "Committed Load Relief (MW)" from index 2 to index 5.
 *   - B2 has no "Micromobility Power Cabinets" column before 2025, and the
 *     stored chart correctly omits the key rather than carrying a zero.
 * Both are exactly what schema_by_year exists to describe, so the resolver
 * reads it. This also means the shipped engine survives the next schema
 * change instead of silently deriving from the wrong column -- which is the
 * failure mode that would put a wrong number on a ConEd slide.
 *
 * A column that does not exist in a given year returns -1, and the spec omits
 * the key. Absent is not zero. */
function col(id, y, name) {
  const s = schema(id, y); if (!s) return -1;
  const want = String(name).trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    if (s[i] == null) continue;
    if (String(s[i]).trim().toLowerCase() === want) return i;
  }
  return -1;
}
/* E1's value column embeds the year -- "2025 Total Investment" -- so it is
 * matched by pattern. Named separately rather than making col() fuzzy, because
 * a fuzzy exact-match helper is how the wrong column gets picked quietly. */
function colLike(id, y, re) {
  const s = schema(id, y); if (!s) return -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] != null && re.test(String(s[i]))) return i;
  }
  return -1;
}
/* pick named columns off a row, omitting any the year does not have */
function pick(row, map) {
  const out = {};
  Object.keys(map).forEach(k => { const i = map[k]; if (i >= 0) out[k] = row[i]; });
  return out;
}

/* ======================================================================
 * THE TWELVE SPECS. One per chart, authored from the data rather than
 * guessed, each a pure function of table data for one year.
 * ====================================================================== */
const SPECS = {
  /* project, drop totals, rank by total, keep the top 12 */
  A1_programs: (y) => {
    const d = body('A1', y); if (!d) return null;
    const m = { total: col('A1', y, 'Total Funds Expended ($)'),
                dac: col('A1', y, 'DAC Funding ($)'),
                dac_pct: col('A1', y, '% in DACs') };
    return dropTotals(d).map(r => Object.assign({ name: r[0] }, pick(r, m)))
      .sort((a, b) => b.total - a.total).slice(0, 12);
  },
  /* source order, totals dropped. The value column name carries the year. */
  E1_categories: (y) => {
    const d = body('E1', y); if (!d) return null;
    /* BOTH E1 columns are matched by pattern, because the HEADER TEXT ITSELF
     * drifts year to year: "2023 Total Investment ($)" against "2025 Total
     * Investment", and "Percentage (%) Affecting DACs" against "Percentage
     * Affecting DACs". An exact match got 2024 and 2025 and silently produced
     * undefined for 2023.
     *
     * This is the sharpest lesson in the file, and it cuts both ways: names
     * drift, so patterns are necessary -- and patterns are how the WRONG column
     * gets picked without anyone noticing. What makes them safe is that every
     * derived chart-year is diffed against the stored copy here. A pattern is
     * only ever as trustworthy as the test standing behind it. */
    const m = { total: colLike('E1', y, /Total Investment/i),
                dac_pct: colLike('E1', y, /Percentage.*Affecting DACs/i) };
    return dropTotals(d).map(r => Object.assign({ name: r[0] }, pick(r, m)));
  },
  /* total is COMPUTED: dac + nondac. It is not a column. */
  F8_boroughs: (y) => {
    const d = body('F8', y); if (!d) return null;
    const iD = col('F8', y, 'DAC'), iN = col('F8', y, 'Non-DAC');
    if (iD < 0 || iN < 0) return null;
    return dropTotals(d).map(r => ({ name: r[0], dac: r[iD], nondac: r[iN],
      total: r[iD] + r[iN] }));
  },
  /* H1 orders Non-DAC BEFORE DAC, and carries its own Grand Total column */
  H1_boroughs: (y) => {
    const d = body('H1', y); if (!d) return null;
    const m = { nondac: col('H1', y, 'Non-DAC Repairs'),
                dac: col('H1', y, 'DAC Repairs'),
                total: col('H1', y, 'Grand Total') };
    return dropTotals(d).map(r => Object.assign({ name: r[0] }, pick(r, m)));
  },
  /* FOUR tables, one per borough. The name comes from the table, not a cell. */
  G_replacement: (y) => gBoroughs(y, [['Bronx', 'G2'], ['Manhattan', 'G4'],
    ['Queens', 'G6'], ['Westchester', 'G8']]),
  G_abandonment: (y) => gBoroughs(y, [['Bronx', 'G3'], ['Manhattan', 'G5'],
    ['Queens', 'G7'], ['Westchester', 'G9']]),
  /* null columns from merged cells put the values at 3, 5, 7 */
  C5_programs: (y) => cPrograms(y, 'C5'),
  C3_programs: (y) => cPrograms(y, 'C3'),
  /* an OBJECT keyed by the row label, not an array */
  B2_plugs: (y) => {
    const d = body('B2', y); if (!d) return null;
    /* Micromobility Power Cabinets does not exist before 2025, and the stored
     * chart omits the key rather than carrying a zero. pick() omits it too. */
    const m = { L2: col('B2', y, 'L2 Plugs'), DCFC: col('B2', y, 'DCFC Plugs'),
                Micromobility: col('B2', y, 'Micromobility Power Cabinets'),
                Total: col('B2', y, 'Total Plugs') };
    const out = {};
    d.forEach(r => { out[r[0]] = pick(r, m); });
    return out;
  },
  /* named metrics picked out of a metric-per-row table */
  D2: (y) => {
    const d = body('D2', y); if (!d) return null;
    const at = (needle) => {
      const row = d.find(r => String(r[0]).trim().toLowerCase() === needle);
      return row ? row[1] : undefined;
    };
    return {
      year: String(y),
      projects_total: at('total # of projects'),
      projects_dac: at('total # of projects in dacs'),
      mw_total: at('total mw installed (all ders)'),
      mw_dac: at('total mw installed in dacs (all ders)'),
    };
  },
  J1_avg_usage: (y) => jAverage(y, 'J1'),
  J2_avg_gas: (y) => jAverage(y, 'J2'),
};

function gBoroughs(y, pairs) {
  const out = [];
  for (const [name, id] of pairs) {
    const d = body(id, y); if (!d) return null;
    const dac = d[0] ? d[0][1] : undefined;
    const nondac = d[1] ? d[1][1] : undefined;
    out.push({ name: name, dac: dac, nondac: nondac, total: dac + nondac });
  }
  return out;
}
function cPrograms(y, id) {
  const d = body(id, y); if (!d) return null;
  /* FOUR columns in 2023, EIGHT from 2024 once merged cells brought null
   * columns with them. By name, so the year does not matter. */
  const m = { participants: col(id, y, 'Program Participants'),
              committed: col(id, y, 'Committed Load Relief (MW)'),
              delivered: col(id, y, 'Delivered Load Relief (MW)') };
  return dropTotals(d).map(r => Object.assign({ name: r[0] }, pick(r, m)));
}
function jAverage(y, id) {
  const d = body(id, y); if (!d) return null;
  /* the AVERAGE row, found by its label rather than by index */
  const row = d.find(r => /^average/i.test(String(r[0])));
  if (!row) return null;
  return { dac: row[1], nondac: row[3] };
}

/* ======================================================================
 * RUN every chart-year, compare against the stored copy
 * ====================================================================== */
lines.push('======================================================================');
lines.push('CLCPA-238 step 2 -- are the charts derivable from table data?');
lines.push('  offline: payload.json only. No network, no org, no writes.');
lines.push('  total rows dropped by the SHIPPED isStrictTotalRowLabel');
lines.push('  compared by CANONICAL deep compare, not JSON.stringify');
lines.push('======================================================================');

guard('the compare function itself', () => {
  /* asserted before it is trusted */
  ok(deepEq({ a: 1, b: 2 }, { b: 2, a: 1 }), 'key ORDER is ignored, as ruled');
  ok(!deepEq({ a: 1 }, { a: 2 }), 'a changed value is caught');
  ok(!deepEq([1, 2], [2, 1]), 'array ORDER is significant');
  ok(!deepEq({ a: 1 }, { a: 1, b: 1 }), 'an extra key is caught');
  ok(!deepEq({ a: 1 }, { a: '1' }), '1 and "1" are different');
  ok(!deepEq(0, -0), 'zero and negative zero are told apart');
  ok(deepEq(NaN, NaN), 'NaN equals itself here, so it can be compared at all');
  ok(firstDiff({ x: { y: 1 } }, { x: { y: 2 } }) === '.x.y: 1 vs 2',
     'and a mismatch names its coordinate: ' + firstDiff({ x: { y: 1 } }, { x: { y: 2 } }));
});

guard('the shipped predicate is the shipped one', () => {
  ok(typeof isStrictTotalRowLabel === 'function', 'isStrictTotalRowLabel extracted from app.js');
  ok(isStrictTotalRowLabel('Total') === true, 'it calls "Total" a total row');
  ok(isStrictTotalRowLabel('Clean Heat - Residential ASHP') === false,
     'and a program name not a total row');
});

lines.push('');
lines.push('=== EVERY CHART-YEAR ===');
const results = [];
Object.keys(P.charts).forEach(c => {
  const years = Object.keys((P.charts[c].values) || {});
  years.forEach(y => {
    const stored = P.charts[c].values[y];
    let derived = null, err = null;
    try { derived = SPECS[c] ? SPECS[c](y) : null; }
    catch (e) { err = e.message; }
    const match = !err && derived != null && deepEq(derived, stored);
    results.push({ chart: c, year: y, match: match,
      why: err ? ('THREW: ' + err) : (derived == null ? 'no spec or no source data'
        : (match ? '' : firstDiff(derived, stored))) });
  });
});

const good = results.filter(r => r.match);
const bad = results.filter(r => !r.match);
results.forEach(r => {
  if (r.match) lines.push('  ok   ' + r.chart + ' ' + r.year + '  DERIVED exactly');
  else lines.push('  FAIL ' + r.chart + ' ' + r.year + '  ' + r.why);
});
pass += good.length; fail += bad.length;

lines.push('');
lines.push('  chart-years derived exactly : ' + good.length + ' of ' + results.length);
lines.push('  still not reproduced        : ' + bad.length);

/* per-chart summary, so the cost is per spec rather than per year */
lines.push('');
lines.push('=== BY CHART ===');
Object.keys(P.charts).forEach(c => {
  const rs = results.filter(r => r.chart === c);
  const n = rs.filter(r => r.match).length;
  lines.push('  ' + (n === rs.length ? 'ok  ' : 'FAIL') + ' ' + c.padEnd(16) +
    n + '/' + rs.length + ' year(s)');
});

lines.push('');
lines.push('======================================================================');
lines.push('  ' + pass + ' passed, ' + fail + ' failed');
lines.push('======================================================================');

const out = lines.join('\n') + '\n';
process.stdout.write(out);
fs.writeFileSync(path.join(__dirname, 'derive-charts-output.txt'), out);
process.exitCode = fail ? 1 : 0;
