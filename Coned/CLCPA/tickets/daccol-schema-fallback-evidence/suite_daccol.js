/* THE COMPOSED LAYER WAS BLIND TO IMPORTED YEARS.
 *
 * NO TICKET NUMBER YET, and the directory is named for the defect rather than
 * guessing one -- the same choice made for prewalkthrough-evidence and
 * badge-title-case-evidence. This is NOT CLCPA-240: that ticket's subject was a
 * Total row with no numbers. This is a different function, a different cause,
 * and it was merely FOUND during 240's follow-up pass. Provenance is not
 * identity, so it wants its own number and Emely assigns it.
 *
 * THE DEFECT. A year created by import carries cr2bf_schema = null, so the
 * composed table has no schema_by_year entry for it. dacCol returned -1 on the
 * missing entry, dacCell returned undefined, and EVERY KPI and chart rule that
 * names a column by header silently produced nothing. 2099 held 23 saved A1
 * rows; the section page rendered them correctly while the Executive Summary
 * dashed Clean Energy on both charts and on card 2.
 *
 * Not "A1 is insufficient" -- clean_energy_spend derives from A1 alone. The
 * COLUMN could not be found.
 *
 * THE FIX is the fallback getTableSchema has always carried, with the same
 * documented reason, which is why the section page and editor never saw this.
 *
 * THE GUARD IS THE DELIVERABLE: every existing table-year's composed output is
 * asserted identical to BASE. dacCol feeds every KPI and every chart rule, so
 * nothing narrower would cover it.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const EVID238 = REPO + '/Coned/CLCPA/tickets/CLCPA-238-evidence';
/* BASE: main before this session -- the deployed build 7a69dabb96 */
const BASE = process.env.DAC_BASE_COMMIT || '80db8e8';
const toCRLF = (s) => s.replace(/\r?\n/g, '\r\n');
const SRC = fs.readFileSync(path.join(REPO, REL), 'utf8');
const BASE_SRC = toCRLF(execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
const NL = String.fromCharCode(10);

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

const FNS = ['dacCanon', 'dacFirstDiff', 'dacRow', 'dacCol', 'dacCell', 'dacPct',
  'dacBody', 'dacPick', 'dacGBoroughs', 'dacCPrograms', 'dacJAverage',
  'composePayloadFromRows', 'isStrictTotalRowLabel', 'kpiDacPct',
  'rowsForDisplay', 'totalRowFlags', 'columnGrandTotals', 'applyDerivedCols',
  'sumDerivedCols', 'detectPctColumns'];
const DECLS = ['DAC_TOTAL_RE', 'DAC_CHART_RULES', 'DAC_KPI_REPORTED', 'dacShare',
  'dacJ9Share', 'DAC_KPI_ANALYTICAL', 'DERIVED_COLS', 'NOT_RECONCILED_TABLES'];
const composerFrom = (src) => new Function(
  DECLS.map(n => grabDecl(n, src)).join(NL) + NL +
  FNS.map(n => grab(n, src)).join(NL) + NL + 'return composePayloadFromRows;')();

/* ---- the org, and an imported-year variant of it --------------------- */
const PRE = JSON.parse(fs.readFileSync(
  REPO + '/deploy-backups/2026-09-08-clcpa238-pre-seed/tabledata.json', 'utf8'));
const p9 = PRE.filter(r => r.cr2bf_key === 'A1:2099')[0];
const A1_2025_ROWS = JSON.parse(PRE.filter(r => r.cr2bf_key === 'A1:2025')[0].cr2bf_rows);
function baseOrg() {
  const man = JSON.parse(fs.readFileSync(path.join(EVID238, 'seed_manifest.json'), 'utf8'));
  const S = {};
  man.files.forEach(f => { S[f.entitySet] = JSON.parse(fs.readFileSync(path.join(EVID238, f.file), 'utf8')); });
  const td = JSON.parse(JSON.stringify(S['cr2bf_dacingesttesttabledata1s']));
  td.filter(r => r.cr2bf_key === 'A1:2025')[0].cr2bf_rows =
    PRE.filter(r => r.cr2bf_key === 'A1:2025')[0].cr2bf_rows;
  return { tabledata: td, tables: S['cr2bf_dacreporttables'],
           sections: S['cr2bf_dacreportsections'], metrics: S['cr2bf_dacreportmetrics'] };
}
/* the IMPORTED YEAR, exactly as the org holds it after Emely's Save:
 * 999 in both money columns, a computed Total, and cr2bf_schema NULL */
function importedOrg() {
  const org = baseOrg();
  const rows = A1_2025_ROWS.map(r => String(r[0])).map(lab =>
    /^(grand\s+|sub)?totals?$/i.test(lab.trim()) ? [lab, 21978, 21978, 1] : [lab, 999, 999, 1]);
  org.tabledata.push({ cr2bf_key: 'A1:2099', cr2bf_section: p9.cr2bf_section,
    cr2bf_tableid: p9.cr2bf_tableid, cr2bf_year: p9.cr2bf_year,
    cr2bf_rows: JSON.stringify(rows), cr2bf_schema: null, cr2bf_title: null });
  return org;
}

function callWith(src, payload, want, year, args, extra) {
  const fns = FNS.slice(), decls = DECLS.slice();
  if (fns.indexOf(want) < 0) fns.push(want);
  const g = Object.assign({
    state: { payload: payload, year: String(year) },
    escapeHtml: (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    document: { getElementById: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem: () => {} },
    getBaseline: () => 35, console: console,
  }, extra || {});
  for (let i = 0; i < 120; i++) {
    const names = Object.keys(g);
    const body = decls.map(n => grabDecl(n, src)).join(NL) + NL +
      [...new Set(fns)].map(n => grab(n, src)).join(NL) + NL + 'return ' + want + ';';
    try { return new Function(...names, body)(...names.map(k => g[k])).apply(null, args || []); }
    catch (e) {
      const m = /^(\w+) is not defined$/.exec(e.message || '');
      if (!m) throw e;
      const nm = m[1];
      if (grab(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabDecl(nm, src) && decls.indexOf(nm) < 0) { decls.push(nm); continue; }
      throw new Error('cannot resolve ' + nm);
    }
  }
  throw new Error('no convergence for ' + want);
}

say('======================================================================');
say('THE COMPOSED LAYER WAS BLIND TO IMPORTED YEARS -- dacCol schema fallback');
say('  BASE ' + BASE + ' (the deployed build 7a69dabb96)');
say('======================================================================');

/* ==================================================================== */
say('');
say('=== 1. THE DEFECT, DRIVEN, AND ITS EXACT DISCRIMINATOR ===');

guard('BASE control: an imported year derives nothing', () => {
  const P = composerFrom(BASE_SRC)(importedOrg());
  const a1 = (P.tables.A1.data || {})['2099'] || [];
  ok(a1.length === 23, 'the composer SEES all 23 saved rows: ' + a1.length);
  ok(JSON.stringify(a1[a1.length - 1]) === '["Total",21978,21978,1]',
     'including the computed Total: ' + JSON.stringify(a1[a1.length - 1]));
  ok((P.tables.A1.schema_by_year || {})['2099'] === undefined,
     'but there is NO schema_by_year entry, because cr2bf_schema is null');
  const ces = P.kpis.reported.find(k => k.id === 'clean_energy_spend');
  ok(!(ces && ces.values && ces.values['2099']),
     'so clean_energy_spend has no 2099 value at BASE -- the rows are visible ' +
     'and the COLUMN is not findable');
  const withY = P.kpis.reported.filter(k => k.values && k.values['2099']).map(k => k.id);
  ok(withY.length === 0, 'and NO reported KPI derives at all: ' +
     (withY.length ? withY.join(',') : 'none'));
  /* the mechanism, quoted */
  const baseFn = codeOnly(grab('dacCol', BASE_SRC));
  ok(/const s = \(t\.schema_by_year \|\| \{\}\)\[y\]; if \(!s\) return -1;/.test(baseFn),
     'because dacCol returned -1 on a missing entry, with no fallback');
});

guard('the fix: the same fallback getTableSchema already documents', () => {
  const fn = codeOnly(grab('dacCol'));
  ok(/const anyYear = Object\.keys\(by\)\[0\];/.test(fn),
     'dacCol falls back to any year\'s schema');
  /* IT IS THE SAME RULE, not a new invention -- proved against the other reader */
  const gts = codeOnly(grab('getTableSchema'));
  ok(/const anyYear = Object\.keys\(table\.schema_by_year\)\[0\];/.test(gts),
     'and getTableSchema has carried exactly that for as long as new years have ' +
     'existed, which is why the section page was never affected');
  ok(/Fall back to any year's schema \(used when adding a brand-new year\)/
     .test(grab('getTableSchema')),
     'with its reason written down: "used when adding a brand-new year"');
  ok(grab('getTableSchema') === grab('getTableSchema', BASE_SRC),
     'and getTableSchema itself is byte-identical to BASE: only dacCol moved');

  /* ONLY THE SCHEMA FALLS BACK */
  const rowFn = codeOnly(grab('dacRow'));
  ok(/const d = \(t\.data \|\| \{\}\)\[y\]; if \(!d\) return null;/.test(rowFn),
     'dacRow still refuses to fall back: borrowing another year\'s VALUES would ' +
     'be fabrication, where borrowing its COLUMN NAMES is the table\'s own shape');
  ok(grab('dacRow') === grab('dacRow', BASE_SRC), 'and dacRow is byte-identical to BASE');
});

/* ==================================================================== */
say('');
say('=== 2. THE GUARD: every existing table-year composes IDENTICALLY ===');

guard('the whole composed payload is unchanged for the real org', () => {
  /* dacCol feeds EVERY KPI and EVERY chart rule. Nothing narrower than the
   * whole composed output covers that blast radius. */
  const now = composerFrom(SRC)(baseOrg());
  const before = composerFrom(BASE_SRC)(baseOrg());
  const a = JSON.stringify(now), b = JSON.stringify(before);
  ok(a.length > 50000, 'the composed payload is substantial: ' + a.length + ' chars');
  ok(a === b, 'and it is IDENTICAL to BASE, byte for byte');
  /* named, so a failure says WHERE */
  ['tables', 'kpis', 'charts', 'sections', 'meta'].forEach(k => {
    ok(JSON.stringify(now[k]) === JSON.stringify(before[k]),
       '  ' + k + ' identical');
  });
  const yrs = new Set();
  Object.keys(now.tables).forEach(id =>
    Object.keys(now.tables[id].data || {}).forEach(y => yrs.add(id + ':' + y)));
  ok(yrs.size > 100, 'covering ' + yrs.size + ' table-years');
});

guard('the fallback CANNOT fire for a year that has its own schema', () => {
  /* the only way an existing year could move is if the fallback preempted a
   * present schema. It is reached only when by[y] is falsy. */
  const fn = codeOnly(grab('dacCol'));
  ok(/let s = by\[y\];[\s\S]{0,40}if \(!s\) \{/.test(fn),
     'the fallback is inside `if (!s)`, so a present schema is never overridden');
  /* driven: a table-year WITH a schema resolves to the same column at BASE */
  const P = composerFrom(SRC)(baseOrg());
  const PB = composerFrom(BASE_SRC)(baseOrg());
  ['A1', 'E1', 'J4', 'F7', 'D2'].forEach(id => {
    ['2025', '2024', '2023'].forEach(y => {
      const s1 = (P.tables[id].schema_by_year || {})[y];
      const s2 = (PB.tables[id].schema_by_year || {})[y];
      ok(JSON.stringify(s1) === JSON.stringify(s2), id + ':' + y + ' schema unchanged');
    });
  });
});

/* ==================================================================== */
say('');
say('=== 3. THE NEW-YEAR FIXTURE: an imported year now derives ===');

guard('the KPI resolves once the data is saved', () => {
  const P = composerFrom(SRC)(importedOrg());
  const ces = P.kpis.reported.find(k => k.id === 'clean_energy_spend');
  const v = ces && ces.values && ces.values['2099'];
  ok(!!v, 'clean_energy_spend HAS a 2099 value now');
  ok(v && v.total === 21978 && v.dac === 21978,
     'and it is the saved figures: ' + JSON.stringify(v));
  ok(v && v.dac_pct === 1, 'with a 100% share, which is what 999/999 means');
  /* and ONLY that one: the others genuinely have no 2099 data */
  const withY = P.kpis.reported.filter(k => k.values && k.values['2099']).map(k => k.id);
  ok(withY.length === 1 && withY[0] === 'clean_energy_spend',
     'and it is the ONLY reported KPI with a 2099 value: ' + withY.join(','));
});

guard('EMELY\'S SCREEN: Clean Energy renders, cards 1 and 3 stay dashed', () => {
  const P = composerFrom(SRC)(importedOrg());
  const secs = callWith(SRC, P, 'buildSectionDAC', '2099', []);
  const A = secs.filter(s => s.id === 'A')[0];
  ok(A && A.pctByYear['2099'] === 1,
     'section A\'s share for 2099 is 1 (100%): ' + (A && A.pctByYear['2099']));
  const others = secs.filter(s => s.id !== 'A' && s.pctByYear['2099'] != null);
  ok(others.length === 0,
     'and no other section has one, correctly: ' +
     (others.length ? others.map(s => s.id).join(',') : 'none'));

  /* CHART 1: Movement vs Prior Year -- A gets a dot and a delta */
  const dumb = callWith(SRC, P, 'renderDumbbell', '2099', [35, '2099', secs]);
  const aRow = (dumb.match(/<div class="dumb-row[^"]*"[^>]*data-section="A"[^>]*>/) || [''])[0];
  ok(aRow && !/is-na/.test(aRow), 'Movement: section A is NO LONGER is-na');
  ok(/data-pct="100\.0%"/.test(aRow), 'and its tooltip carries 100.0%: ' +
     ((/data-pct="([^"]*)"/.exec(aRow) || [])[1]));
  ok((dumb.match(/class="dumb-row[^"]*is-na/g) || []).length === 9,
     'while the other nine areas stay dashed: ' +
     (dumb.match(/class="dumb-row[^"]*is-na/g) || []).length);

  /* CHART 2: Impact by Section -- A computes, the rest N/A */
  const strip = callWith(SRC, P, 'renderStripWithGap', '2099', [35, '2099', secs]);
  ok((strip.match(/strip-empty-label/g) || []).length === 9,
     'Impact by Section: nine N/A bars, not ten: ' +
     (strip.match(/strip-empty-label/g) || []).length);
  ok(/data-section="A"[^>]*data-pct="100\.0%"/.test(strip),
     'and section A carries 100.0%');

  /* THE CARDS: 2 renders, 1 and 3 correctly stay dashed */
  const cards = callWith(SRC, P, 'computeHeaderCards', '2099', []);
  const DASH = '\u2014';
  ok(cards[1].hero !== DASH, 'card 2 Clean Energy Incentive Spend RENDERS: ' +
     JSON.stringify(cards[1].hero));
  ok(cards[0].hero === DASH,
     'card 1 Strategic Capital STAYS dashed -- E1 has no 2099 data, and the ' +
     'partial-rendering design is correct as shipped');
  ok(cards[2].hero === DASH, 'card 3 Customer Arrears STAYS dashed -- J4 has none');
  /* and the dashes are because the TABLES are empty, not because of a lookup */
  ok(!((P.tables.E1.data || {})['2099']), 'E1 genuinely has no 2099 data');
  ok(!((P.tables.J4.data || {})['2099']), 'J4 genuinely has no 2099 data');
});

guard('A SECOND GAP, MEASURED: section-page charts are year-pinned', () => {
  /* I ASSERTED THE CHARTS WOULD DERIVE TOO AND THEY DO NOT. The assertion was
   * wrong and the truth is a separate defect, recorded here rather than
   * softened.
   *
   * dacCol does back DAC_CHART_RULES, so the column lookup is fixed for them.
   * But the composer writes chart values over `(spec.years || years)`, and
   * every chart metric row carries an explicit spec.years pinned to the seed
   * years. So a chart cannot compose for a year that list does not name, no
   * matter what dacCol returns.
   *
   * THIS DOES NOT AFFECT THE EXEC SUMMARY, which is what Emely verifies:
   * Movement and Impact by Section are driven by buildSectionDAC via the KPI
   * map, and the KPI loop iterates `years` -- every year -- with no spec gate.
   * The charts object feeds SECTION-PAGE charts instead.
   *
   * OPEN, NOT FIXED HERE: closing it means adding the year to 12 stored
   * cr2bf_spec rows, which is a Dataverse DATA change and therefore Emely's
   * call under the freeze discipline, not a code fix riding this ticket. */
  const now = composerFrom(SRC)(importedOrg());
  const before = composerFrom(BASE_SRC)(importedOrg());
  ok(JSON.stringify(now.charts) === JSON.stringify(before.charts),
     'the composed CHARTS are identical to BASE even for the imported year');
  const with2099 = Object.keys(now.charts).filter(k =>
    now.charts[k].values && now.charts[k].values['2099'] !== undefined);
  ok(with2099.length === 0,
     'and none has a 2099 entry: ' + (with2099.length ? with2099.join(',') : 'none'));
  /* the cause, quoted from the shipped composer */
  const comp = codeOnly(grab('composePayloadFromRows'));
  ok(/\(spec\.years \|\| years\)\.forEach/.test(comp),
     'because the chart loop iterates (spec.years || years)');
  ok(/reported\.forEach\(k => \{[\s\S]{0,200}years\.forEach\(y/.test(comp),
     'while the reported-KPI loop iterates `years` with no spec gate, which is ' +
     'why the exec summary IS fixed and the section charts are not');
  /* and every chart metric really is pinned */
  const metrics = JSON.parse(fs.readFileSync(
    path.join(EVID238, 'seed_reportmetric.json'), 'utf8'))
    .filter(m => m.cr2bf_kind === 'chart');
  ok(metrics.length === 12, 'there are 12 chart metrics: ' + metrics.length);
  const pinned = metrics.filter(m => {
    let s = {}; try { s = JSON.parse(m.cr2bf_spec || '{}'); } catch (e) {}
    return Array.isArray(s.years) && s.years.indexOf('2099') < 0;
  });
  ok(pinned.length === 12,
     'and ALL TWELVE pin spec.years to the seed years, excluding 2099: ' +
     pinned.length);
  /* for the real org nothing moves either, which is the point */
  ok(JSON.stringify(composerFrom(SRC)(baseOrg()).charts) ===
     JSON.stringify(composerFrom(BASE_SRC)(baseOrg()).charts),
     'and for the real org the charts are identical to BASE, as everything else is');
});

/* ==================================================================== */
say('');
say('=== 4. THE BLAST RADIUS ===');

guard('one function', () => {
  const names = new Set();
  [SRC, BASE_SRC].forEach(s => {
    const r = /\r\n  (?:async )?function (\w+)\(/g;
    let m; while ((m = r.exec(s))) names.add(m[1]);
  });
  const changed = [];
  names.forEach(n => { if (grab(n, BASE_SRC) !== grab(n, SRC)) changed.push(n); });
  changed.sort();
  say('       changed functions: ' + changed.join(', '));
  /* CLCPA-242 landed on top of this branch and added five tooltip-wiring
   * functions. THIS ticket's blast radius is still one; the others are named
   * so the claim stays exact rather than being relaxed to a bigger number. */
  /* CLCPA-240's first half then landed too, adding or changing eight more.
   * Same treatment: named, not absorbed into a looser number. */
  const ALSO = ['placeTooltipAtPointer', 'hideExecTooltip', 'wireExecutiveTooltips',
                'wireHeaderCardsTooltips', 'wireExecutiveInteractions',
                'wireControlTips',
                'buildIngestImport', 'buildIngestWorkbook', 'totalRowFlags',
                'ingestRowKey', 'ingestGroupOf', 'ingestIsHeaderRow',
                'ingestIsBlankCell', 'ingestKeyColCount'];
  const mine = changed.filter(n => ALSO.indexOf(n) < 0);
  ALSO.forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed, and it belongs to CLCPA-242, not this ticket'));
  ok(mine.length === 1 && mine[0] === 'dacCol',
     'exactly ONE function is THIS ticket\'s, and it is dacCol: ' + mine.join(', '));
  /* every name compared must exist, or the comparison means nothing */
  /* totalRowFlags left this list when CLCPA-240's first half changed it; it is
   * named in ALSO above instead, so the claim is still exact. */
  ['dacRow', 'dacCell', 'getTableSchema', 'composePayloadFromRows', 'kpiDacPct',
   'buildSectionDAC', 'computeHeaderCards', 'rowsForDisplay',
   'renderDumbbell', 'renderStripWithGap'].forEach(fn => {
    const a = grab(fn), b = grab(fn, BASE_SRC);
    if (!ok(a !== null && b !== null, fn + ' exists in both sources')) return;
    ok(a === b, fn + ' is byte-identical to BASE');
  });
  ok(grabDecl('DAC_KPI_REPORTED') === grabDecl('DAC_KPI_REPORTED', BASE_SRC),
     'DAC_KPI_REPORTED is byte-identical: no rule was widened to compensate');
  ok(grabDecl('DAC_CHART_RULES') === grabDecl('DAC_CHART_RULES', BASE_SRC),
     'and so is DAC_CHART_RULES');
});

/* ==================================================================== */
console.log(lines.join('\n'));
console.log('');
console.log('======================================================================');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
console.log('======================================================================');
process.exitCode = fail ? 1 : 0;
