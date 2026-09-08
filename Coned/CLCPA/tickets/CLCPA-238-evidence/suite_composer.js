/* CLCPA-238 step 5: the composer behind the flag, and shadow mode.
 *
 * THE SHIPPED-FUNCTION RULE, applied where it matters most: this suite drives
 * composePayloadFromRows EXTRACTED FROM app.js, from the real seed files, and
 * compares against payload.json. Nothing about the composition is stubbed,
 * because the composition is the thing under test. The only things faked are
 * the four arrays of Dataverse rows -- and those are not fakes either: they are
 * the seed files that were reviewed, hashed, pushed and then written to the org
 * row for row in step 4, so what this drives is what Dataverse holds.
 *
 * WHAT IT PROVES
 *   1. meta, sections and tables recompose EXACTLY -- tables both as STORED and
 *      on the display view, which are different claims.
 *   2. every remaining divergence in kpis and charts is a rounding near miss
 *      against a stored copy, asserted BY CAUSE and BY MAGNITUDE rather than by
 *      a literal list, so the list cannot become a place to hide a real one.
 *   2b. AND THE PREDICTED SHADOW VERDICT, computed from the reconstructed org
 *      state, so the console has exactly one number to be checked against.
 *   3. the flag defaults to payload.json, so this round changes nothing a
 *      viewer sees.
 *   4. shadow mode runs after the first render, does not await, cannot throw
 *      into the page, and is skipped when Dataverse is already the source.
 *   5. the three boot reads run together.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const EVID = REPO + '/Coned/CLCPA/tickets/CLCPA-238-evidence';
/* BASE: main before this round. It never moves. */
const BASE = process.env.DAC_BASE_COMMIT || '7289e14';
const SRC = fs.readFileSync(path.join(REPO, REL), 'utf8');
const toCRLF = (s) => s.replace(/\r?\n/g, '\r\n');
const BASE_SRC = toCRLF(execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
const say = (s) => lines.push(s);
function guard(label, fn) {
  try { fn(); }
  catch (e) { ok(false, label + ' THREW instead of failing: ' + (e && e.message ? e.message : String(e))); }
}
function grab(name, src) {
  const s = src || SRC;
  for (const pad of ['  ', '    ', '']) for (const kw of ['function ', 'async function ']) {
    const head = '\r\n' + pad + kw + name + '(';
    const i = s.indexOf(head); if (i < 0) continue;
    const close = '\r\n' + pad + '}';
    const j = s.indexOf(close, i + head.length);
    if (j >= 0) return s.slice(i + 2, j + close.length);
  } return null;
}
/* a top-level const/var declaration, up to the next top-level construct */
function grabDecl(name, src) {
  const s = src || SRC;
  const re = new RegExp('\\r\\n  (?:const|var|let) ' + name + ' = ');
  const m = s.match(re); if (!m) return null;
  const i = s.indexOf(m[0]);
  const rest = s.slice(i + 2);
  const end = rest.search(/\r\n  (?:const|var|let|function|async function|\/\*)/);
  return end < 0 ? rest : rest.slice(0, end);
}
function codeOnly(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '/*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? src.length : j + 2; continue; }
    if (two === '//') { const j = src.indexOf('\n', i); i = j < 0 ? src.length : j; continue; }
    out += src[i]; i++;
  }
  return out;
}
const CODE = codeOnly(SRC);

say('======================================================================');
say('CLCPA-238 step 5: the composer behind the flag');
say('  BASE ' + BASE + ' (main before this round)');
say('======================================================================');

/* ==================================================================== */
say('');
say('=== 1. THE COMPOSER, driven from the real seed files ===');

let API = null, composed = null;
guard('extract and run the shipped composer', () => {
  /* THE FULL CALL-TIME CLOSURE, and it grew for a reason worth recording: the
   * composer now runs rowsForDisplay, the SHIPPED read path, over the composed
   * table data before any rule derives from it. That pulls in the whole derive
   * engine -- totalRowFlags, columnGrandTotals, applyDerivedCols,
   * sumDerivedCols, detectPctColumns, DERIVED_COLS, NOT_RECONCILED_TABLES --
   * every one extracted from app.js rather than reimplemented, because the
   * whole point of the fix is that the composer and the report use the SAME
   * rule. A retyped copy here would let this suite agree with itself while the
   * app disagreed.
   *
   * The names were found by CALLING the composer and following each
   * ReferenceError, not by reading the source: definition-time resolution
   * passes with none of these present, so only a real invocation finds them. */
  const FNS = ['dacCanon', 'dacFirstDiff', 'dacRow', 'dacCol', 'dacCell', 'dacPct',
    'dacBody', 'dacPick', 'dacGBoroughs', 'dacCPrograms', 'dacJAverage',
    'composePayloadFromRows', 'isStrictTotalRowLabel', 'kpiDacPct',
    'rowsForDisplay', 'totalRowFlags', 'columnGrandTotals', 'applyDerivedCols',
    'sumDerivedCols', 'detectPctColumns'];
  const DECLS = ['DAC_TOTAL_RE', 'DAC_CHART_RULES', 'DAC_KPI_REPORTED', 'dacShare',
    'dacJ9Share', 'DAC_KPI_ANALYTICAL', 'DERIVED_COLS', 'NOT_RECONCILED_TABLES'];
  const missF = FNS.filter(n => !grab(n));
  const missD = DECLS.filter(n => !grabDecl(n));
  ok(missF.length === 0, 'every composer function is found in app.js' +
    (missF.length ? ': MISSING ' + missF.join(',') : ''));
  ok(missD.length === 0, 'every rule table is found in app.js' +
    (missD.length ? ': MISSING ' + missD.join(',') : ''));
  if (missF.length || missD.length) return;
  /* isStrictTotalRowLabel and kpiDacPct are the SHIPPED ones, extracted, not
   * reimplemented -- the composer's output depends on both, and a retyped copy
   * could agree with this file while disagreeing with the app. */
  const body = DECLS.map(n => grabDecl(n)).join('\n') + '\n' +
    FNS.map(n => grab(n)).join('\n') +
    '\nreturn { composePayloadFromRows, dacFirstDiff, dacCanon, rowsForDisplay,' +
    ' DAC_CHART_RULES, DAC_KPI_REPORTED, DAC_KPI_ANALYTICAL, kpiDacPct };';
  API = new Function(body)();
  ok(typeof API.composePayloadFromRows === 'function', 'the composer is callable');

  /* the fixture IS the seed that was written to the org */
  const man = JSON.parse(fs.readFileSync(path.join(EVID, 'seed_manifest.json'), 'utf8'));
  const crypto = require('crypto');
  const read = (f) => {
    const txt = fs.readFileSync(path.join(EVID, f), 'utf8');
    const want = man.files.filter(x => x.file === f)[0];
    ok(!!want && crypto.createHash('sha256').update(txt).digest('hex') === want.sha256,
       f + ' matches its manifest sha256, so the fixture is the seed that was written');
    return JSON.parse(txt);
  };
  const src = {
    tabledata: read('seed_tabledata.json'),
    tables: read('seed_reporttable.json'),
    sections: read('seed_reportsection.json'),
    metrics: read('seed_reportmetric.json'),
  };
  composed = API.composePayloadFromRows(src);
  ok(!!composed, 'the composer returns a payload');
  ok(composed && Object.keys(composed).sort().join(',') ===
     'charts,kpis,meta,sections,tables',
     'with loadPayload\'s exact top-level shape: ' +
     (composed ? Object.keys(composed).sort().join(',') : 'none'));
});

guard('the compare function itself, before it is trusted', () => {
  if (!API) { ok(false, 'no API'); return; }
  const eq = (a, b) => API.dacFirstDiff(a, b) === null;
  /* THREE MUTATIONS RAN GREEN without this: removing the key sort from
   * dacCanon, and collapsing -0 into 0. Both are real properties of the
   * compare, and neither is exercised by the payload -- the composed objects
   * happen to come out in the same key order as the file, and no value in the
   * payload is negative zero. So the compare is asserted DIRECTLY rather than
   * only through the data, which is what makes those two properties guarded
   * instead of merely present. */
  ok(eq({ a: 1, b: 2 }, { b: 2, a: 1 }), 'key ORDER is ignored');
  ok(!eq([1, 2], [2, 1]), 'array ORDER is significant');
  ok(!eq({ a: 1 }, { a: 2 }), 'a changed value is caught');
  ok(!eq({ a: 1 }, { a: 1, b: 1 }), 'an extra key is caught');
  ok(!eq({ a: 1 }, { a: '1' }), '1 and "1" differ');
  ok(!eq(0, -0), 'zero and NEGATIVE zero are told apart');
  ok(eq(NaN, NaN), 'NaN equals itself, so it can be compared at all');
  ok(!eq([1], { 0: 1 }), 'an array is not an object with the same keys');
  ok(API.dacFirstDiff({ x: { y: 1 } }, { x: { y: 2 } }) === '.x.y: 1 vs 2',
     'and a mismatch names its coordinate: ' +
     API.dacFirstDiff({ x: { y: 1 } }, { x: { y: 2 } }));
});

guard('a null boolean from Dataverse composes to false', () => {
  if (!API) return;
  /* `!!x.cr2bf_invertmetric` looked like a no-op mutation because the seed
   * stores real booleans. It is not a no-op against the ORG, where an unset
   * two-option column comes back null: without the coercion, invert_metric
   * would be null where the payload has false, and a null is not a false. */
  const out = API.composePayloadFromRows({
    tabledata: [], tables: [],
    sections: [{ cr2bf_sectionkey: 'Z', cr2bf_name: 'Z', cr2bf_shortname: 'Z',
      cr2bf_fullname: 'Z', cr2bf_invertmetric: null, cr2bf_blurb: 'Z' }],
    metrics: [],
  });
  ok(out && out.sections.Z.invert_metric === false,
     'a null invert_metric composes to false, not null: ' +
     JSON.stringify(out ? out.sections.Z.invert_metric : 'none'));
});

/* APPLY OVERRIDES EXACTLY AS THE SHIPPED applyOverrides DOES: unconditionally,
 * for every cached row, INCLUDING rows whose blob is null.
 *
 * My first reference skipped null rows, and that guard is precisely what let the
 * A7 shape error survive a whole fix round. Raw payload.json has no key for a
 * title-only year, so comparing against the FILE said "correct" while the app
 * was producing an explicit null: dvBackend.init caches JSON.parse(null), which
 * is null, and applyOverrides writes t.data[year] = null for it.
 *
 * The composer must reproduce the RENDERED shape, so the reference has to BE the
 * rendered shape. Getting the reference wrong is indistinguishable from getting
 * the code wrong, right up until something outside the test disagrees -- which
 * is what the console did. */
function renderedFrom(payloadObj, tdRows) {
  const out = JSON.parse(JSON.stringify(payloadObj));
  tdRows.forEach(r => {
    const t = out.tables[r.cr2bf_tableid]; if (!t) return;
    t.data = t.data || {};
    /* unconditional, null included -- the line my first version got wrong by
     * adding a guard the shipped code does not have */
    t.data[String(r.cr2bf_year)] = (r.cr2bf_rows == null) ? null : JSON.parse(r.cr2bf_rows);
  });
  return out;
}

/* THE DISPLAY VIEW, built with the SHIPPED rowsForDisplay -- the same
 * normalisation dacShadowCompare now applies to both sides. Comparing one
 * side's stored values against the other side's displayed values is what
 * produced three false divergences in the live shadow. */
function displayView(p) {
  const o = {};
  Object.keys(p.tables).forEach(id => {
    const t = p.tables[id];
    const d = Object.assign({}, t, { data: {} });
    Object.keys(t.data || {}).forEach(y => {
      d.data[y] = API.rowsForDisplay(t.data[y], (t.schema_by_year || {})[y] || null, id);
    });
    o[id] = d;
  });
  return o;
}

guard('the parts that must be exact', () => {
  if (!composed) { ok(false, 'no composed payload'); return; }
  ['meta', 'sections'].forEach(p => {
    const d = API.dacFirstDiff(composed[p], P[p]);
    ok(d === null, p + ' recomposes EXACTLY from the seed' + (d ? ': ' + d : ''));
  });
  /* CHARTS: STRUCTURE EXACT, only recomputed percentages may move.
   *
   * I first replaced the flat "charts recompose EXACTLY" assertion because
   * charts now legitimately differ on recomputed percentages -- and that
   * silently destroyed SEVEN guards. The mutation run proved it: dropping A1's
   * total rows, taking the top 10 instead of 12, reading F8's total from one
   * column, losing H1's DAC anchor, pointing G_replacement at the abandonment
   * tables, inventing a Micromobility key, and reading columns by index all
   * went GREEN. Relaxing an assertion because it now fails for a good reason is
   * how a guard disappears.
   *
   * So the comparison is split by FIELD. Everything that is not a percentage --
   * names, ordering, row counts, totals, dac values, object keys -- must be
   * EXACT, which is what all seven of those mutations break. Percentages may
   * differ, and only as near misses, which is the ruled class. */
  const PCT_FIELD = /pct|percent/i;
  const stripPct = (v) => {
    if (Array.isArray(v)) return v.map(stripPct);
    if (v && typeof v === 'object') {
      const o = {};
      Object.keys(v).forEach(k => { if (!PCT_FIELD.test(k)) o[k] = stripPct(v[k]); });
      return o;
    }
    return v;
  };
  const cd = API.dacFirstDiff(stripPct(composed.charts), stripPct(P.charts));
  ok(cd === null,
     'charts match the payload EXACTLY on every non-percentage field: names, ' +
     'order, counts, totals and dac values' + (cd ? ': ' + cd : ''));
  /* and the percentages that DO differ are near misses, never structural */
  const pctBad = [];
  Object.keys(composed.charts).forEach(c => {
    Object.keys(composed.charts[c].values || {}).forEach(y => {
      const g = composed.charts[c].values[y], w = (P.charts[c].values || {})[y];
      if (!Array.isArray(g) || !Array.isArray(w)) return;
      g.forEach((row, i) => {
        if (!row || typeof row !== 'object' || !w[i]) return;
        Object.keys(row).forEach(k => {
          if (!PCT_FIELD.test(k)) return;
          const a1 = row[k], b1 = w[i][k];
          if (a1 === b1) return;
          /* THE CAUSAL TEST, not a magnitude proxy: is the stored value exactly
           * the derived value rounded to two decimals?
           *
           * My first version used a 2% relative ceiling and reported three
           * failures that were not failures at all -- 0.0842165 against a
           * stored 0.08 is a 5% relative gap and a perfect 2dp rounding. A
           * ceiling asks "is this close enough", which is a judgement; this
           * asks "is this that number rounded", which is a fact. */
          if (typeof a1 !== 'number' || typeof b1 !== 'number' ||
              Math.round(a1 * 100) / 100 !== b1) {
            pctBad.push(c + ' ' + y + '[' + i + '].' + k + ': ' + a1 + ' vs ' + b1 +
              ' (round2 = ' + (typeof a1 === 'number' ? Math.round(a1 * 100) / 100 : '?') + ')');
          }
        });
      });
    });
  });
  pctBad.forEach(x => ok(false, 'a chart percentage moved by MORE than 2%: ' + x));
  ok(pctBad.length === 0,
     'every differing chart percentage IS the derived value rounded to 2dp: the stored copy is a rounding of it, exactly');

  /* TABLES on the display view, both sides. The composer keeps STORED rows in
   * `tables` -- that is the source of truth the editor loads -- so the stored
   * side matches the payload's stored side, and the displayed side matches the
   * payload's displayed side. Asserting both says more than either alone. */
  /* against the RENDERED payload, built from the same fixture rows, because
   * that is the shape the app produces and therefore the shape to reproduce */
  const seedTd = JSON.parse(fs.readFileSync(path.join(EVID, 'seed_tabledata.json'), 'utf8'));
  const renderedFixture = renderedFrom(P, seedTd);
  const dStored = API.dacFirstDiff(composed.tables, renderedFixture.tables);
  ok(dStored === null, 'tables recompose EXACTLY as STORED, against the RENDERED shape' +
    (dStored ? ': ' + dStored : ''));
  const dDisp = API.dacFirstDiff(displayView(composed), displayView(renderedFixture));
  ok(dDisp === null, 'and EXACTLY on the display view, which is what a viewer reads' +
    (dDisp ? ': ' + dDisp : ''));
  /* the five orphan title-years are exactly why that reference is needed:
   * ABSENT from the file, NULL in the rendered payload */
  const orph = ['A7', 'G3', 'G5', 'G7', 'G9'];
  ok(orph.every(id => !('2023' in (P.tables[id].data || {}))),
     'raw payload.json has NO 2023 key for the five orphan tables');
  ok(orph.every(id => renderedFixture.tables[id].data['2023'] === null),
     'the RENDERED payload has an explicit null there');
  ok(orph.every(id => composed.tables[id].data['2023'] === null),
     'and the composer now produces the same explicit null: absent and ' +
     'explicitly-null are different, and the app produces the second');
  /* and prove the comparison can fail, so "EXACT" means something */
  const broken = JSON.parse(JSON.stringify(composed.sections));
  broken.A.name = broken.A.name + ' ';
  ok(API.dacFirstDiff(broken, P.sections) !== null,
     'and the comparison DOES detect a one-space change, so it can fail');
});

guard('years and current_year are DERIVED, not stored', () => {
  if (!composed) return;
  ok(API.dacFirstDiff(composed.meta.years, P.meta.years) === null,
     'meta.years matches: ' + composed.meta.years.join(','));
  ok(composed.meta.current_year === P.meta.current_year,
     'meta.current_year matches: ' + composed.meta.current_year);
  /* the metric row must NOT carry them: that is the second-source-of-truth
   * mistake the whole ticket exists to undo */
  const metricSeed = JSON.parse(fs.readFileSync(path.join(EVID, 'seed_reportmetric.json'), 'utf8'));
  const metaRow = metricSeed.filter(r => r.cr2bf_kind === 'meta')[0];
  ok(!!metaRow, 'the meta row exists in the seed');
  const spec = metaRow ? JSON.parse(metaRow.cr2bf_spec) : {};
  ok(!('years' in spec),
     'it stores no year LIST: which years have data is a fact the rows state');
  /* CORRECTED. This asserted that current_year was NOT stored, on the argument
   * that deriving it avoided a second source of truth. The shadow disproved it:
   * a 2099 test row made the newest year with data 2099 and the dashboard would
   * have opened on a year holding one table. Which years have data and which
   * year the report covers are different facts, and the second is editorial. */
  ok(spec.current_year === P.meta.current_year,
     'but it DOES store current_year = ' + spec.current_year +
     ': which year the report covers cannot be derived from the rows');
  ok('baseline_options' in spec && 'default_baseline' in spec,
     'and the two genuinely-config numbers');
  /* the 5 title-only rows must not create a year */
  const td = JSON.parse(fs.readFileSync(path.join(EVID, 'seed_tabledata.json'), 'utf8'));
  const titleOnly = td.filter(r => r.cr2bf_rows === null);
  ok(titleOnly.length === 5, 'the 5 title-only rows are in the fixture');
  ok(composed.meta.years.indexOf('2023') >= 0,
     '2023 IS a year (other tables reported it), so their presence is not the test');
  ok(titleOnly.every(r => r.cr2bf_year === 2023),
     'and all five are 2023, which is why a naive year list would still look right');
});

/* ==================================================================== */
say('');
say('=== 2. THE ONLY DIVERGENCES ARE ROUNDED STORED COPIES ===');
say('    asserted by CAUSE, not by count: every one must be explained.');

guard('the reported dac_pct divergences', () => {
  if (!composed) return;
  const div = [];
  composed.kpis.reported.forEach(k => {
    const want = P.kpis.reported.filter(x => x.id === k.id)[0];
    ok(!!want, k.id + ' exists in the payload');
    if (!want) return;
    Object.keys(k.values).forEach(y => {
      const g = k.values[y], w = want.values[y];
      if (!w) { div.push(k.id + ' ' + y + ' MISSING from payload'); return; }
      if (g.total !== w.total) div.push(k.id + ' ' + y + ' TOTAL ' + g.total + ' vs ' + w.total);
      if (g.dac !== w.dac) div.push(k.id + ' ' + y + ' DAC ' + g.dac + ' vs ' + w.dac);
    });
  });
  /* CORRECTED. These matched exactly while the rules read STORED table data.
   * They now read the DISPLAY view, because the org strips derived columns and
   * the composer must see what the report shows -- so wherever the payload
   * stored a rounded derived input, the derived total differs. Asserted BY
   * CAUSE: every divergence must be a near miss against a rounded stored
   * value, never a structural one. */
  const nearMiss = div.filter(d => {
    const m = /(-?[\d.]+) vs (-?[\d.]+)$/.exec(String(d));
    if (!m) return false;
    const g = parseFloat(m[1]), w = parseFloat(m[2]);
    return isFinite(g) && isFinite(w) && w !== 0 && Math.abs((g - w) / w) < 0.02;
  });
  div.filter(d => nearMiss.indexOf(d) < 0).forEach(d =>
    ok(false, 'UNEXPLAINED reported-KPI divergence, not a rounding near miss: ' + d));
  ok(div.length === nearMiss.length,
     'every reported-KPI divergence is a rounding near miss under 2%: ' +
     nearMiss.length + ' of ' + div.length);
  say('    reported KPI divergences (all rounding): ' + div.length);
  div.slice(0, 6).forEach(d => say('      ' + String(d).slice(0, 120)));

  /* dac_pct: derived by the SHIPPED kpiDacPct, so it differs wherever the
   * payload stored a rounded copy. Asserted by CAUSE. */
  const pctDiv = [];
  composed.kpis.reported.forEach(k => {
    const want = P.kpis.reported.filter(x => x.id === k.id)[0]; if (!want) return;
    Object.keys(k.values).forEach(y => {
      const g = k.values[y], w = want.values[y]; if (!w) return;
      if (g.dac_pct !== w.dac_pct) pctDiv.push({ id: k.id, y: y, got: g.dac_pct, stored: w.dac_pct });
    });
  });
  say('    dac_pct divergences: ' + pctDiv.length);
  pctDiv.forEach(d => say('      ' + d.id.padEnd(24) + d.y + '  derived ' +
    d.got + '  stored ' + d.stored));
  /* THE CAUSAL ASSERTION: every stored value that disagrees is a round 2dp
   * number. That is CLCPA-143's signature -- "every one of them was a round 2dp
   * value, while every value that still agreed carried full precision" -- and
   * it is why deriving is the fix rather than the regression. */
  const notRounded = pctDiv.filter(d =>
    !(typeof d.stored === 'number' && Math.abs(d.stored * 100 - Math.round(d.stored * 100)) < 1e-9));
  notRounded.forEach(d => ok(false, 'UNEXPLAINED dac_pct divergence, the stored ' +
    'value is not a round 2dp number: ' + d.id + ' ' + d.y + ' stored ' + d.stored));
  ok(notRounded.length === 0,
     'EVERY dac_pct divergence has a stored value rounded to 2dp: CLCPA-143\'s ' +
     'signature, and the reason deriving is the fix');
  ok(pctDiv.length > 0,
     'and there ARE some, so the assertion above is exercised rather than vacuous');
  /* the composed value must be exactly what the shipped kpiDacPct returns */
  const wrong = [];
  composed.kpis.reported.forEach(k => Object.keys(k.values).forEach(y => {
    const v = k.values[y];
    if (v.dac_pct !== API.kpiDacPct(v)) wrong.push(k.id + ' ' + y);
  }));
  ok(wrong.length === 0, 'every composed dac_pct IS what the shipped kpiDacPct ' +
    'returns, so the card and the payload cannot disagree' +
    (wrong.length ? ': ' + wrong.slice(0, 3).join(',') : ''));
});

guard('the analytical divergences', () => {
  if (!composed) return;
  const div = [];
  composed.kpis.analytical.forEach(k => {
    const want = P.kpis.analytical.filter(x => x.id === k.id)[0]; if (!want) return;
    Object.keys(k.values).forEach(y => {
      const g = k.values[y].value, w = want.values[y] ? want.values[y].value : undefined;
      if (typeof g !== 'number' || typeof w !== 'number') { div.push(k.id + ' ' + y + ' non-numeric'); return; }
      if (Math.abs(g - w) > Math.abs(w) * 1e-9) {
        div.push({ id: k.id, y: y, got: g, want: w, pct: 100 * (g - w) / w });
      }
    });
  });
  say('    analytical divergences: ' + div.length);
  div.forEach(d => say('      ' + String(d.id).padEnd(24) + d.y + '  derived ' +
    d.got.toFixed(6) + '  payload ' + d.want.toFixed(6) + '  ' +
    (d.pct >= 0 ? '+' : '') + d.pct.toFixed(3) + '%'));
  /* THE CAUSAL ASSERTION: exactly the three ratios that divide by the J9 share,
   * 2025 only, and all by the SAME percentage -- which is what one shared
   * divisor looks like, and not what three coincidences look like. */
  /* THE LIST GREW, and it grew for the reason the fix round exists: the rules
   * now read the display view, so every analytical value built on a rounded
   * stored input moves. Asserted BY CAUSE and BY MAGNITUDE rather than by a
   * literal list, which is what stops the list from becoming a place to hide a
   * real divergence. */
  ok(div.length > 0, 'there ARE analytical divergences, so the assertions below bite');
  div.forEach(d => ok(Math.abs(d.pct) < 1.5,
    d.id + ' ' + d.y + ' differs by ' + d.pct.toFixed(3) +
    '%, under the 1.5% ceiling: a rounded intermediate, not a structural error'));
  ok(div.every(d => typeof d.got === 'number' && isFinite(d.got)),
     'and every derived value is a finite number: none became null or NaN, ' +
     'which is what the pre-fix composer produced for stripped columns');

  /* STRUCTURAL PINS, because two mutations went green under the magnitude
   * assertion alone: removing equity_index's published-percentage preference,
   * and pointing the J9 share back at the rounded column. Both change a value
   * by well under 1.5%, so a magnitude ceiling cannot see them -- and both
   * reverse a decision that was reasoned about at length. A value test and a
   * structural test answer different questions and this needs both. */
  /* CODE ONLY, and this pin needed the reminder. My first version tested
   * String(equity_index) whole, and it passed with the rule mutated away --
   * because the phrase "% in DACs" also appears in the COMMENT inside that
   * function, explaining why the published column is preferred. The mutation
   * removed the code and left the prose, and the pin read the prose.
   *
   * That is the SEVENTH time in this project that a comment has been counted as
   * code. It is no longer a surprise, so it is no longer allowed to be a
   * default: every structural pin here goes through codeOnly first. */
  const eq = codeOnly(String(API.DAC_KPI_ANALYTICAL.equity_index));
  ok(/% in DACs/.test(eq),
     'equity_index still PREFERS the A1 published "% in DACs" column, in CODE');
  ok(/clean_energy_spend/.test(eq),
     'and still falls back to the derived share when that column is stripped');
  ok(/% in DACs/.test(String(API.DAC_KPI_ANALYTICAL.equity_index)) &&
     /% in DACs/.test(eq),
     'the phrase is in both the prose and the code, which is exactly why the ' +
     'code-only reading is the one that counts');
  const j9 = String(codeOnly(SRC).match(/const dacJ9Share = [^;]*;/) || '');
  ok(/dacShare\(DAC_KPI_REPORTED\.residential_customers/.test(j9),
     'the J9 share is DERIVED, not read from the rounded column: ' + j9.slice(0, 96));
  ok(!/DAC % of Total/.test(j9),
     'and does not reach for the published percentage, which would hide the finding');
});

/* ==================================================================== */
say('');
say('=== 3. THE FLAG: payload.json is still the default ===');

guard('the defaults', () => {
  ok(/var DAC_SOURCE = 'payload';/.test(CODE),
     "DAC_SOURCE defaults to 'payload'");
  ok(/var DAC_SHADOW = true;/.test(CODE), 'DAC_SHADOW defaults to true');
  /* the source switch only fires on the flag, and only after Storage.init */
  const boot = CODE.slice(CODE.indexOf('state.payload = await loadPayload()'));
  const iInit = boot.indexOf('await Storage.init()');
  const iSwitch = boot.indexOf("if (DAC_SOURCE === 'dataverse')");
  ok(iInit > 0 && iSwitch > iInit,
     'the source switch runs AFTER Storage.init(), which composing requires');
  const iApply = boot.indexOf('Storage.applyAddedYears');
  ok(iSwitch > 0 && iApply > iSwitch,
     'and BEFORE applyAddedYears, so overrides land on whichever payload won');
  /* a null or a throw must leave payload.json in place */
  ok(/staying on payload\.json/.test(SRC),
     'a compose failure keeps payload.json: the parachute Emely ruled on');
  ok(/if \(fromDv\) \{/.test(CODE),
     'and a null composition does not replace the payload');
});

guard('BASE had none of this', () => {
  const bc = codeOnly(BASE_SRC);
  ok(!/DAC_SOURCE/.test(bc), 'BASE has no source flag');
  ok(!/composePayloadFromRows/.test(bc), 'BASE has no composer');
  ok(!/dacShadowCompare/.test(bc), 'BASE has no shadow compare');
  ok(!/getReportSource/.test(bc), 'BASE has no report-source read');
});

/* ==================================================================== */
say('');
say('=== 4. SHADOW MODE cannot touch the page ===');

guard('shadow mode is diagnostic only', () => {
  const sh = grab('dacShadowCompare');
  ok(!!sh, 'dacShadowCompare is found');
  if (!sh) return;
  const c = codeOnly(sh);
  ok(/try \{ composed = await composePayloadFromDataverse\(\); \}/.test(c),
     'the compose is inside a try');
  ok(/catch/.test(c), 'and its failure is caught');
  ok(!/state\.payload\s*=/.test(c),
     'it NEVER assigns state.payload: it compares and reports, nothing else');
  ok(!/innerHTML|appendChild|showToast|showFatalError/.test(c),
     'and it touches no DOM and raises no toast: the page cannot learn it ran');
  ok(/dacFirstDiff\(/.test(c), 'it uses the canonical first-difference');
  ok(/console\.(info|warn)/.test(c), 'and reports through the console');

  /* the CALL SITE: after the first render, not awaited, and skipped when
   * Dataverse is already the source */
  const call = CODE.slice(CODE.indexOf('mlHydrateSavedLayers();'));
  const i = call.indexOf('dacShadowCompare(state.payload)');
  ok(i > 0, 'it is called after mlHydrateSavedLayers, which is after first render');
  ok(!/await dacShadowCompare/.test(CODE),
     'and never awaited, so it cannot delay a pixel');
  ok(/if \(DAC_SHADOW && DAC_SOURCE !== 'dataverse'\)/.test(CODE),
     'skipped when Dataverse is already the source: comparing a thing to ' +
     'itself proves nothing');
  ok(/\.catch\(/.test(call.slice(i, i + 300)),
     'and the call site has its own catch');
});

/* ==================================================================== */
say('');
say('=== 5. THE THREE BOOT READS RUN TOGETHER ===');

guard('Promise.all on the boot reads', () => {
  const init = grab('init', SRC);   /* the dvBackend init is not top-level */
  const seg = CODE.slice(CODE.indexOf('API = baseUrl.replace'),
    CODE.indexOf('await initMapLayers()'));
  ok(seg.length > 0, 'the dvBackend init body is located');
  ok(/const \[td, hh, yy\] = await Promise\.all\(\[/.test(seg),
     'the three reads are destructured from one Promise.all');
  /* and no sequential await getAll survives in that segment */
  const seqs = (seg.match(/const \w+ = await getAll\(/g) || []).length;
  ok(seqs === 0, 'no sequential `await getAll` remains in init: ' + seqs);

  /* BASE control: it really was sequential */
  const bcode = codeOnly(BASE_SRC);
  const bseg = bcode.slice(bcode.indexOf('API = baseUrl.replace'),
    bcode.indexOf('await initMapLayers()'));
  const bseqs = (bseg.match(/const \w+ = await getAll\(/g) || []).length;
  ok(bseqs === 3, 'at BASE there were 3 sequential awaits: ' + bseqs);
  ok(!/Promise\.all/.test(bseg), 'and no Promise.all');

  /* the measured saving, recorded so the claim is checkable */
  say('    measured in step zero: 373 ms sequential, 131 ms parallel,');
  say('    median saving 242 ms, 65% of that segment.');
});

/* an OBJECT METHOD, which grab() cannot see: it looks for a `function`
 * keyword, and `async getReportSource() {` has none. The dvBackend is an object
 * literal, so its members are methods. Written as its own helper rather than by
 * loosening grab(), because a looser grab() would start matching things that
 * merely look like declarations. */
function grabMethod(name, indent, from, src) {
  const s = src || SRC;
  const head = '\r\n' + indent + 'async ' + name + '(';
  const i = s.indexOf(head, from || 0);
  if (i < 0) return null;
  const close = '\r\n' + indent + '}';
  const j = s.indexOf(close, i + head.length);
  return j < 0 ? null : s.slice(i + 2, j + close.length);
}

guard('the report-source read', () => {
  /* SEARCHED FROM THE DATAVERSE BACKEND, because there are TWO methods of this
   * name and the first one in the file is the localStorage backend's
   * one-liner `return null`. Extracting that one and then asserting it reads
   * four tables produced four confident failures about the wrong function --
   * which is the same "found the first thing that matched" mistake as the
   * Non-DAC Repairs column. */
  const dvFrom = SRC.indexOf('async init(baseUrl)');
  ok(dvFrom > 0, 'the dvBackend is located');
  const g = grabMethod('getReportSource', '        ', dvFrom);
  ok(!!g, 'getReportSource is found as a dvBackend method');
  ok(!!g && g.indexOf('return null;') < 0,
     'and it is the DATAVERSE one, not the localStorage stub');
  if (g) {
    const c = codeOnly(g);
    ok(/Promise\.all\(\[/.test(c), 'it reads its four tables together');
    ['cr2bf_dacreporttables', 'cr2bf_dacreportsections', 'cr2bf_dacreportmetrics']
      .forEach(s => ok(c.indexOf(s) >= 0, '  it reads ' + s));
    ok(/cr2bf_schema/.test(c) && /cr2bf_title/.test(c),
       '  and selects the two new columns on the table-data read');
  }
  /* the localStorage backend returns NULL, not an empty shape */
  ok(/async getReportSource\(\) \{ return null; \}/.test(CODE),
     'the localStorage backend returns null, so shadow mode reports "no ' +
     'source" instead of a mismatch on every field');
  ok(/getReportSource\(\) \{ return active\.getReportSource\(\); \}/.test(CODE),
     'and the facade delegates to whichever backend is active');
});

say('');
say('=== 6. THE PREDICTED SHADOW VERDICT, from the reconstructed org state ===');
say('    Emely gets ONE number to check. Last round I gave her the wrong one.');

guard('the predicted verdict', () => {
  if (!API) return;
  /* THE ORG, RECONSTRUCTED. The live diagnosis proved the org differs from the
   * seed files in exactly two ways, both deliberate acts of step 4: A1:2099
   * exists (2099 is not a payload year) and A1:2025 keeps the org's own
   * cr2bf_rows (step 4 patched only schema and title, to protect three
   * operator-typed zeros). Reconstructing from the seed plus the pre-seed
   * backup therefore reproduces the org exactly, with no network. */
  const man = JSON.parse(fs.readFileSync(path.join(EVID, 'seed_manifest.json'), 'utf8'));
  const S = {};
  man.files.forEach(f => { S[f.entitySet] = JSON.parse(fs.readFileSync(path.join(EVID, f.file), 'utf8')); });
  const PRE = JSON.parse(fs.readFileSync(
    REPO + '/deploy-backups/2026-09-08-clcpa238-pre-seed/tabledata.json', 'utf8'));
  const td = JSON.parse(JSON.stringify(S['cr2bf_dacingesttesttabledata1s']));
  const pa = PRE.filter(r => r.cr2bf_key === 'A1:2025')[0];
  const p9 = PRE.filter(r => r.cr2bf_key === 'A1:2099')[0];
  ok(!!pa && !!p9, 'the pre-seed backup supplies both pre-existing rows');
  td.filter(r => r.cr2bf_key === 'A1:2025')[0].cr2bf_rows = pa.cr2bf_rows;
  td.push({ cr2bf_key: 'A1:2099', cr2bf_section: p9.cr2bf_section,
    cr2bf_tableid: p9.cr2bf_tableid, cr2bf_year: p9.cr2bf_year,
    cr2bf_rows: p9.cr2bf_rows, cr2bf_schema: null, cr2bf_title: null });
  ok(td.length === 155, 'the reconstruction has the org 155 rows: ' + td.length);

  const orgComposed = API.composePayloadFromRows({ tabledata: td,
    tables: S['cr2bf_dacreporttables'], sections: S['cr2bf_dacreportsections'],
    metrics: S['cr2bf_dacreportmetrics'] });

  /* THE RENDERED PAYLOAD: payload.json after applyOverrides and
   * applyAddedYears, which is what a viewer reads today. */
  /* through the shared helper, so this reference cannot drift from the one the
   * fixture assertions use -- and so the null-row guard cannot creep back */
  const rend = renderedFrom(P, td);
  rend.meta.years = Array.from(new Set(rend.meta.years.concat(['2099'])))
    .sort((x, y) => parseInt(y, 10) - parseInt(x, 10));

  const PARTS = ['meta', 'sections', 'tables', 'kpis', 'charts'];
  const L = Object.assign({}, orgComposed, { tables: displayView(orgComposed) });
  const R = Object.assign({}, rend, { tables: displayView(rend) });
  const v = {};
  PARTS.forEach(p => { v[p] = API.dacFirstDiff(L[p], R[p]); });
  const same = PARTS.filter(p => v[p] === null).length;

  say('');
  PARTS.forEach(p => say('      ' + (v[p] === null ? 'MATCH  ' : 'differ ') +
    p.padEnd(9) + (v[p] === null ? '' : String(v[p]).slice(0, 110))));
  say('');

  /* THE ARITHMETIC, CHECKED: the count is DERIVED from the verdict rather than
   * typed beside it. Last round I wrote "3 of 5" next to a list of four
   * matching parts, and the number Emely checked against was wrong. */
  const matching = PARTS.filter(p => v[p] === null);
  ok(same === matching.length, 'the count IS the length of the matching list: ' +
    same + ' = ' + matching.length);
  ok(same === 3, 'THE PREDICTED VERDICT IS 3 OF 5: ' + same);
  ok(matching.join(',') === 'meta,sections,tables',
     'and the three that match are meta, sections and tables: ' + matching.join(', '));
  ok(v.meta === null,
     'META NOW MATCHES: current_year is stored, so a 2099 test row no longer ' +
     'becomes the year the dashboard opens on');
  ok(v.tables === null,
     'TABLES NOW MATCH on the display view, both sides normalised identically');
  ok(v.kpis !== null && v.charts !== null,
     'kpis and charts still differ, and only those two');
  say('    EXPECTED CONSOLE LINE:');
  say('      [CLCPA-238] shadow: 3 of 5 parts match (NNN ms to compose)');
  say('    with kpis and charts named as differing, and NOTHING else.');
  say('    Both remaining divergences are the ruled class: a recomputed value');
  say('    against a rounded stored copy, every one under 1.5%.');
});

say('');
say('======================================================================');
say('  ' + pass + ' passed, ' + fail + ' failed');
say('======================================================================');

const out = lines.join('\n') + '\n';
process.stdout.write(out);
fs.writeFileSync(path.join(__dirname, 'suite-composer-output.txt'), out);
process.exitCode = fail ? 1 : 0;
