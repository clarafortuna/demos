/* CLCPA-237 item F, expanded: ONE LAYOUT FOR EVERY YEAR.
 *
 * The empty branch is deleted, not repaired. Every renderer below it already
 * handled a year with nothing in it -- except the header cards, which had two
 * defects the branch had been hiding for as long as it existed.
 *
 * THE ONE THAT MATTERS. computeHeaderCards THREW on a year whose prior year was
 * populated and whose own year was not:
 *     TypeError: Cannot read properties of null (reading 'dac')
 * Card 3's detail read `fmtBig(j4Now.dac)` inside the `j4Then ?` arm. It was
 * unreachable only because the branch caught every such year first -- and that
 * shape is exactly what a live import creates. Deleting the branch without
 * fixing this would have replaced a wrong layout with a thrown exception on the
 * screen the walkthrough audience watches.
 *
 * DRIVEN, NOT READ. Both cases are proved by CALLING the shipped functions over
 * the composed Dataverse payload at 2099 -- one A1 table with rows, every DAC
 * column null, a fully populated 2025 beside it -- and by calling BASE's own
 * bytes to show the defect reproduces there. Source-level pins could not see
 * either defect; that is the whole reason this suite drives.
 *
 * OPEN LIMIT, recorded rather than omitted: the honesty rule is asserted on the
 * FIVE surfaces measured in the audit -- the three header cards, the dumbbell
 * and the strip. A tooltip-by-tooltip sweep of every prior-year label is
 * DEFERRED post-Sept-10 by ruling. This suite does not claim it.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSSREL = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const EVID238 = REPO + '/Coned/CLCPA/tickets/CLCPA-238-evidence';
/* BASE: main before this session -- the deployed walkthrough build d7e9e7921d */
const BASE = process.env.DAC_BASE_COMMIT || 'd658ab7';
const toCRLF = (s) => s.replace(/\r?\n/g, '\r\n');
const SRC = fs.readFileSync(path.join(REPO, REL), 'utf8');
const CSS = fs.readFileSync(path.join(REPO, CSSREL), 'utf8');
const BASE_SRC = toCRLF(execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
const BASE_CSS = toCRLF(execSync('git show ' + BASE + ':"' + CSSREL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));

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
const CODE = codeOnly(SRC);

/* ---- the org, reconstructed the way the CLCPA-238 evidence does ------- */
function orgRows() {
  const man = JSON.parse(fs.readFileSync(path.join(EVID238, 'seed_manifest.json'), 'utf8'));
  const S = {};
  man.files.forEach(f => { S[f.entitySet] = JSON.parse(fs.readFileSync(path.join(EVID238, f.file), 'utf8')); });
  const PRE = JSON.parse(fs.readFileSync(
    REPO + '/deploy-backups/2026-09-08-clcpa238-pre-seed/tabledata.json', 'utf8'));
  const td = JSON.parse(JSON.stringify(S['cr2bf_dacingesttesttabledata1s']));
  const pa = PRE.filter(r => r.cr2bf_key === 'A1:2025')[0];
  const p9 = PRE.filter(r => r.cr2bf_key === 'A1:2099')[0];
  td.filter(r => r.cr2bf_key === 'A1:2025')[0].cr2bf_rows = pa.cr2bf_rows;
  td.push({ cr2bf_key: 'A1:2099', cr2bf_section: p9.cr2bf_section,
    cr2bf_tableid: p9.cr2bf_tableid, cr2bf_year: p9.cr2bf_year,
    cr2bf_rows: p9.cr2bf_rows, cr2bf_schema: null, cr2bf_title: null });
  return { tabledata: td, tables: S['cr2bf_dacreporttables'],
           sections: S['cr2bf_dacreportsections'], metrics: S['cr2bf_dacreportmetrics'] };
}

const BASE_FNS = ['dacCanon', 'dacFirstDiff', 'dacRow', 'dacCol', 'dacCell', 'dacPct',
  'dacBody', 'dacPick', 'dacGBoroughs', 'dacCPrograms', 'dacJAverage',
  'composePayloadFromRows', 'isStrictTotalRowLabel', 'kpiDacPct',
  'rowsForDisplay', 'totalRowFlags', 'columnGrandTotals', 'applyDerivedCols',
  'sumDerivedCols', 'detectPctColumns'];
const BASE_DECLS = ['DAC_TOTAL_RE', 'DAC_CHART_RULES', 'DAC_KPI_REPORTED', 'dacShare',
  'dacJ9Share', 'DAC_KPI_ANALYTICAL', 'DERIVED_COLS', 'NOT_RECONCILED_TABLES'];
const NL = String.fromCharCode(10);

function composerFrom(src) {
  return new Function(
    BASE_DECLS.map(n => grabDecl(n, src)).join(NL) + NL +
    BASE_FNS.map(n => grab(n, src)).join(NL) + NL + 'return composePayloadFromRows;')();
}
const ROWS = orgRows();
const P = composerFrom(SRC)(ROWS);
const P_BASE = composerFrom(BASE_SRC)(ROWS);

/* CALL-TIME dependency resolution. Resolving only at construction reported
 * `prevYearOf is not defined` as though it were an app defect; these closures
 * bind when invoked, so the loop has to wrap the invocation. */
function callWith(src, payload, want, year, args, extra) {
  const fns = BASE_FNS.slice(), decls = BASE_DECLS.slice();
  if (fns.indexOf(want) < 0) fns.push(want);
  const g = Object.assign({
    state: { payload: payload, year: String(year) },
    escapeHtml: (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    document: { getElementById: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem: () => {} },
    getBaseline: () => 35,
    console: console,
  }, extra || {});
  for (let i = 0; i < 120; i++) {
    const names = Object.keys(g);
    const body = decls.map(n => grabDecl(n, src)).join(NL) + NL +
      [...new Set(fns)].map(n => grab(n, src)).join(NL) + NL + 'return ' + want + ';';
    try {
      return new Function(...names, body)(...names.map(k => g[k])).apply(null, args || []);
    } catch (e) {
      const m = /^(\w+) is not defined$/.exec(e.message || '');
      if (!m) throw e;
      const nm = m[1];
      if (grab(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabDecl(nm, src) && decls.indexOf(nm) < 0) { decls.push(nm); continue; }
      throw new Error('cannot resolve dependency: ' + nm);
    }
  }
  throw new Error('closure did not converge for ' + want);
}
const cardsAt = (src, payload, year) => callWith(src, payload, 'computeHeaderCards', year, []);
const DASH = '\u2014';   /* the existing null glyph, ruled NOT punctuation */

say('======================================================================');
say('CLCPA-237 item F -- ONE LAYOUT FOR EVERY YEAR');
say('  BASE ' + BASE + ' (the deployed build d7e9e7921d)');
say('======================================================================');

/* ==================================================================== */
say('');
say('=== 1. THE CRASH THE BRANCH WAS HIDING (item 2, card 3) ===');

guard('BASE control: the populated cards CANNOT render a bare year', () => {
  let threw = null;
  try { cardsAt(BASE_SRC, P_BASE, '2099'); }
  catch (e) { threw = e; }
  ok(threw !== null, 'at BASE, computeHeaderCards(2099) THROWS');
  ok(threw !== null && /Cannot read properties of null \(reading 'dac'\)/.test(threw.message),
     'and the message names the exact dereference: ' +
     (threw ? threw.message : '(no throw)'));
  /* the shape, stated so the scenario is checkable rather than described */
  ok(!!((P_BASE.tables.J4.data || {})['2025'] || []).length,
     'the scenario: the PRIOR year (2025) has J4 data');
  ok(!((P_BASE.tables.J4.data || {})['2099'] || []).length,
     'and the selected year (2099) has none -- which is what a live import makes');
  const baseFn = codeOnly(grab('computeHeaderCards', BASE_SRC));
  ok(/j4Then\s*\r?\n?\s*\?\s*fmtBig\(j4Then\.dac\) \+ ' \u2192 ' \+ fmtBig\(j4Now\.dac\)/.test(baseFn),
     'because BASE guarded on j4Then alone and then dereferenced j4Now');
});

guard('the cards now render every year, and dash rather than throw', () => {
  let cards = null, threw = null;
  try { cards = cardsAt(SRC, P, '2099'); } catch (e) { threw = e; }
  ok(threw === null, 'computeHeaderCards(2099) does NOT throw' +
     (threw ? ': ' + threw.message : ''));
  if (!cards) return;
  ok(cards.length === 3, 'all THREE cards are returned, none hidden: ' + cards.length);
  cards.forEach((c, i) => {
    ok(c.hero === DASH, 'card ' + (i + 1) + ' (' + c.tag + ') hero is the dash glyph: ' +
       JSON.stringify(c.hero));
    ok(c.delta === null, '  and its delta is null, so no percentage is invented');
  });
  /* the four j4 cases, all named in the shipped code */
  const fn = codeOnly(grab('computeHeaderCards'));
  ok(/\(j4Then && j4Now\)/.test(fn), 'card 3 requires BOTH before it dereferences either');
  ok(/j4Then \? fmtBig\(j4Then\.dac\) \+ ' \u2192 ' \+ fmtBig\(null\)/.test(fn),
     'prior-only renders the prior figure against a dashed current');
  ok(/j4Now \? fmtBig\(j4Now\.total\) \+ ' total unpaid'/.test(fn),
     'current-only keeps its own wording');
  ok(/: '\u2014'\)\)/.test(fn), 'and neither renders the dash');
});

guard('a POPULATED year is unaffected by the guard', () => {
  const cards = cardsAt(SRC, P, '2025');
  ok(cards.length === 3, '2025 still returns three cards');
  ok(cards.every(c => c.hero !== DASH),
     'and every hero is a real figure: ' + cards.map(c => c.hero).join(', '));
  const base = cardsAt(BASE_SRC, P_BASE, '2025');
  ok(JSON.stringify(cards.map(c => [c.hero, c.delta, c.detail])) ===
     JSON.stringify(base.map(c => [c.hero, c.delta, c.detail])),
     'and hero/delta/detail are IDENTICAL to BASE for 2025: the populated year ' +
     'is untouched by this ticket');
});

/* ==================================================================== */
say('');
say('=== 2. CARD 1 STOPS INVENTING A NUMBER (items 2 and 5) ===');

guard('BASE control: an empty year reported $0 invested', () => {
  /* card 3 throws at BASE, so card 1 is reached through the same helpers
   * rather than through computeHeaderCards -- the arithmetic is the claim */
  const cats = callWith(BASE_SRC, P_BASE, 'parseE1Categories', '2099',
    [P_BASE.tables.E1, '2099']);
  const prev = callWith(BASE_SRC, P_BASE, 'parseE1Categories', '2099',
    [P_BASE.tables.E1, '2025']);
  ok(cats.length === 0, 'E1 has no 2099 categories: ' + cats.length);
  ok(prev.length > 0, 'while 2025 has ' + prev.length);
  const baseFn = codeOnly(grab('computeHeaderCards', BASE_SRC));
  ok(/const eDacTotal = eCats\.reduce\(\(s, c\) => s \+ \(c\.total \|\| 0\) \* \(c\.dac_pct \|\| 0\), 0\);/
     .test(baseFn),
     'and BASE summed them with a bare reduce seeded at 0, so the hero was $0');
  ok(!/const eHas/.test(baseFn), 'with no emptiness test at all');
  /* the measured consequence, recomputed here from BASE's own expression */
  const eDacTotal = cats.reduce((s, c) => s + (c.total || 0) * (c.dac_pct || 0), 0);
  const eDacPrev = prev.reduce((s, c) => s + (c.total || 0) * (c.dac_pct || 0), 0);
  ok(eDacTotal === 0, 'BASE eDacTotal = ' + eDacTotal + ' -- a figure, not an absence');
  ok(Math.round((eDacTotal - eDacPrev) / eDacPrev * 100) === -100,
     'and BASE would have shown a confident -100% delta for a year that has ' +
     'not reported');
});

guard('no data is NULL, and the delta needs the current side', () => {
  const fn = codeOnly(grab('computeHeaderCards'));
  ok(/const eHas = eCats\.length > 0;/.test(fn), 'emptiness is tested explicitly');
  ok(/const eTotal = eHas \? eCats\.reduce/.test(fn) &&
     /const eDacTotal = eHas/.test(fn),
     'and both sums are null rather than 0 when there is nothing to sum');
  ok(/const eDacPct = \(eTotal !== null && eTotal > 0\)/.test(fn),
     'the share guards the null explicitly, not by relying on null > 0');
  ok(/eDacPrev && eDacPrev > 0 && eDacTotal !== null/.test(fn),
     'and the delta requires the CURRENT side, so null - prior cannot become -100%');
  /* driven: the values the card actually carries */
  const c1 = cardsAt(SRC, P, '2099')[0];
  ok(c1.hero === DASH, 'card 1 hero on 2099 is the dash glyph, not "$0": ' +
     JSON.stringify(c1.hero));
  ok(c1.delta === null, 'and no delta at all');
  ok(c1.detail === '$538.4M \u2192 ' + DASH,
     'the detail shows prior against a dashed current: ' + JSON.stringify(c1.detail));
  ok(c1.detail.indexOf('$0') < 0, 'and "$0" appears nowhere in it');
  /* the tooltip rows are year-labelled and dash too */
  const rows = c1.tooltip.rows.map(r => r.label + '=' + r.value);
  ok(rows.some(r => /^Total invested 2099=\u2014$/.test(r)) &&
     rows.some(r => /^DAC invested 2099=\u2014$/.test(r)),
     'and the 2099 tooltip rows dash rather than read $0: ' + rows.join(' | '));

  /* NEITHER SIDE PRESENT, which 2099 does not exercise because its prior year
   * is populated. A mutation restoring the old "Weighted across 0 categories"
   * fallback went GREEN for exactly that reason, so the case gets a fixture of
   * its own -- SYNTHETIC, and labelled: the composed payload with E1's data
   * removed, which is the only way to reach both-absent. */
  const noE1 = JSON.parse(JSON.stringify(P));
  noE1.tables.E1.data = {};
  const cNo = callWith(SRC, noE1, 'computeHeaderCards', '2099', [])[0];
  ok(cNo.hero === DASH, 'SYNTHETIC (E1 emptied): card 1 hero is the dash glyph');
  ok(cNo.detail === DASH,
     'and with no prior figure either, the detail is a dash rather than ' +
     '"Weighted across 0 categories": ' + JSON.stringify(cNo.detail));
  ok(cNo.detail.indexOf('0 categories') < 0,
     'the count of an empty list is never presented as a finding');
});

/* ==================================================================== */
say('');
say('=== 3. ITEMS 3 AND 4 WERE ALREADY BUILT -- REGRESSION PINS ===');

guard('the two charts are byte-identical to BASE', () => {
  /* the spec is satisfied by code this ticket did not write. The honest
   * assertion is therefore that it did not TOUCH it either. */
  ['renderDumbbell', 'renderStripWithGap'].forEach(fn => {
    ok(grab(fn) === grab(fn, BASE_SRC), fn + ' is byte-identical to BASE');
  });
  ok(grab('renderHeaderCards') === grab('renderHeaderCards', BASE_SRC),
     'and so is renderHeaderCards: only computeHeaderCards changed');
});

guard('item 3: Movement lists every area, dashed where absent', () => {
  const sections = callWith(SRC, P, 'buildSectionDAC', '2099', []);
  ok(sections.length === 10, 'ten sections exist: ' + sections.length);
  ok(sections.filter(s => s.pctByYear['2099'] != null).length === 0,
     'and none has a 2099 figure, so every row must take the dash treatment');
  const html = callWith(SRC, P, 'renderDumbbell', '2099', [35, '2099', sections]);
  const rows = html.match(/class="dumb-row[^"]*"/g) || [];
  ok(rows.length === 10, 'all ten areas are still LISTED, none hidden: ' + rows.length);
  ok(rows.filter(r => /is-na/.test(r)).length === 10,
     'and all ten carry is-na, the existing dash treatment');
  ok((html.match(/dumb-pill-neutral/g) || []).length === 10,
     'with a neutral pill rather than an invented direction');
  ok(!/dumb-dot-curr/.test(html), 'and no current-year dot is plotted at all');
  /* prior-year context survives, and is labelled as prior */
  ok(/data-prev-pct="[0-9.]+%"/.test(html),
     'prior-year context is still carried, in a PREV-named attribute');
  ok(/No prior-year baseline available|2025 \u2192 2099 change/.test(html),
     'and the sub-text names both years explicitly');
});

guard('item 4: Impact by Section computes or dashes, per section', () => {
  const sections = callWith(SRC, P, 'buildSectionDAC', '2099', []);
  const html = callWith(SRC, P, 'renderStripWithGap', '2099', [35, '2099', sections]);
  ok((html.match(/class="strip-row"/g) || []).length === 10,
     'ten rows, one per section');
  ok((html.match(/strip-empty-label/g) || []).length === 10, 'ten N/A bars');
  ok((html.match(/sg-pill-na/g) || []).length === 10, 'ten not-available pills');
  ok(!/width:NaN/.test(html) && !/NaN/.test(html), 'and no NaN reaches the markup');
  ok(html.indexOf('Each bar = DAC share \u00b7 2099') >= 0,
     'the sub-text names the selected year, so the empty bars are unambiguous');
  /* A POPULATED YEAR, and the number here is measured rather than assumed.
   *
   * I first asserted 2025 had ZERO N/A bars and it has one: section I, Jobs,
   * which carries no DAC share in ANY year -- 2023, 2024 and 2025 alike. That
   * is exactly the "Jobs pattern" the spec names as the existing dash
   * treatment, so it is pinned here rather than asserted away. It also proves
   * the point better than a zero would: the dash treatment is driven by data,
   * is already live on every populated year, and 2099 simply has ten of what
   * 2025 has one of. */
  ['2025', '2024', '2023'].forEach(y => {
    const sy = callWith(SRC, P, 'buildSectionDAC', y, []);
    const hy = callWith(SRC, P, 'renderStripWithGap', y, [35, y, sy]);
    const na = sy.filter(s => s.pctByYear[y] == null);
    ok(na.length === 1 && na[0].id === 'I',
       y + ' has exactly ONE section with no share, and it is I (Jobs): ' +
       na.map(s => s.id).join(','));
    ok((hy.match(/strip-empty-label/g) || []).length === 1,
       '  and exactly one N/A bar renders for it, unchanged by this ticket');
  });
});

/* ==================================================================== */
say('');
say('=== 4. ITEM 1: THE EMPTY BRANCH IS GONE, NOT FIXED ===');

guard('the branch and its predicate are deleted', () => {
  const ex = codeOnly(grab('renderExecutiveSummary'));
  ok(!/if \(!anyData\)/.test(ex), 'no `if (!anyData)` remains');
  ok(!/const anyData/.test(ex), 'and anyData is not declared any more');
  ok(!/anyData/.test(codeOnly(SRC)), 'nor referenced anywhere in the file');
  ok(!/emptyCard/.test(codeOnly(SRC)), 'the placeholder helper is gone with it');
  /* ONE return template, so there is provably one layout */
  ok((ex.match(/return `/g) || []).length === 1,
     'renderExecutiveSummary has exactly ONE return template: ' +
     (ex.match(/return `/g) || []).length);
  const baseEx = codeOnly(grab('renderExecutiveSummary', BASE_SRC));
  ok(/if \(!anyData\)/.test(baseEx), 'BASE control: the branch was there');
  ok((baseEx.match(/return `/g) || []).length === 1 &&
     /return header \+ `/.test(baseEx),
     'and BASE had a second, differently-shaped return for it');
});

guard('the three dead grid modifiers are deleted from the stylesheet', () => {
  ['exec-shares-grid-solo', 'exec-shares-grid-pair', 'exec-header-cards-empty']
    .forEach(cls => {
      ok(BASE_CSS.indexOf(cls) >= 0, 'BASE control: .' + cls + ' existed');
      ok(CSS.indexOf(cls) < 0, '.' + cls + ' is absent from the stylesheet');
      ok(CODE.indexOf(cls) < 0, 'and nothing in app.js emits it');
    });
  /* WHY they are deleted rather than repaired: they never won. The competitor
   * is an !important block, not the media query the old mutation targeted. */
  ok(/\.exec-shares-grid,[\s\S]{0,80}grid-template-columns: 2fr 1fr !important/.test(CSS),
     'the block that outranked them is still there, still !important');
  ok(/\.exec-shares-grid > \.exec-card:nth-child\(1\) \{[^}]*grid-column: 2 !important/.test(CSS),
     'and it still places children by nth-child, which is why a plain modifier ' +
     'on the container could never have taken effect');
  /* the base grid SURVIVES: the populated layout depends on it */
  ok(/\.exec-shares-grid \{\r?\n\s*display: grid;/.test(CSS),
     'the base .exec-shares-grid rule survives, since one layout now uses it');
});

/* ==================================================================== */
say('');
say('=== 5. THE REGRESSION GUARD: 2025 RENDERS WITH ZERO VISUAL DIFF ===');

guard('the populated branch is byte-identical to BASE', () => {
  /* bounded at both ends and checked, in BOTH sources. `return \`` matches only
   * the populated return: BASE's empty branch used `return header + \``, which
   * does not contain the backtick after the space. */
  const cut = (src) => {
    const c = codeOnly(grab('renderExecutiveSummary', src));
    const n = (c.match(/return `/g) || []).length;
    const i = c.indexOf('return `');
    if (i < 0 || n !== 1) return null;
    return c.slice(i);
  };
  const now = cut(SRC), base = cut(BASE_SRC);
  ok(now !== null && base !== null && now.length > 400 && base.length > 400,
     'both populated branches are located and bounded: ' +
     (now || '').length + ' vs ' + (base || '').length + ' chars');
  ok(now === base,
     'the POPULATED branch is byte-identical to BASE, so 2025 is untouched');
  ok(/renderHeaderCards\(\)/.test(now) &&
     /renderDumbbell\(baseline, year, sections\)/.test(now) &&
     /renderStripWithGap\(baseline, year, sections\)/.test(now) &&
     /renderDACMap\(baseline, year, sections\)/.test(now),
     'and it is the branch that renders all four visuals for real');
  /* the header template above it also survived the deletion */
  ok(/const header = `/.test(codeOnly(grab('renderExecutiveSummary'))),
     'the page header template survived the cut');
});

/* ==================================================================== */
say('');
say('=== 6. THE HONESTY RULE, ON THE FIVE MEASURED SURFACES ===');

guard('no prior-year figure ever renders as the selected year value', () => {
  const cards = cardsAt(SRC, P, '2099');
  /* the hero is THE selected year's value. It must never hold a prior figure. */
  cards.forEach((c, i) => {
    ok(c.hero === DASH,
       'card ' + (i + 1) + ': the hero (the selected year) is a dash, never the ' +
       'prior figure');
  });
  /* prior context IS shown, in the prior-to-current arrow form, AND THE PRIOR
   * FIGURE IS REALLY THERE.
   *
   * The first version asserted only that the detail ended in an arrow to a
   * dash, which "\u2014 \u2192 \u2014" satisfies just as well. A mutation that dropped the
   * prior figure entirely left it green. The claim is two-sided: a real figure
   * on the left, a dash on the right. */
  cards.forEach((c, i) => {
    const d = String(c.detail);
    ok(d.indexOf(' \u2192 ' + DASH) === d.length - 4,
       'card ' + (i + 1) + ': prior context ends in an arrow to a dash, so the ' +
       'left figure reads as prior: ' + JSON.stringify(d));
    ok(/^\$[\d.]+[KMB]? \u2192 \u2014$/.test(d),
       '  and the left side is a REAL prior figure, not a second dash: ' +
       JSON.stringify(d.split(' ')[0]));
  });
  ok(cards.every(c => c.deltaSub === 'vs Prior Year' || c.deltaSub === 'of total'),
     'and every delta sub-label names its own basis');
  /* the two charts label their years */
  const sections = callWith(SRC, P, 'buildSectionDAC', '2099', []);
  const dumb = callWith(SRC, P, 'renderDumbbell', '2099', [35, '2099', sections]);
  ok(/legend-item[^>]*>[\s\S]{0,120}2025[\s\S]{0,200}2099/.test(dumb),
     'the dumbbell legend distinguishes 2025 from 2099 by name');
  const strip = callWith(SRC, P, 'renderStripWithGap', '2099', [35, '2099', sections]);
  ok(strip.indexOf('\u00b7 2099') >= 0, 'and the strip names the selected year');
  /* THE OPEN LIMIT, recorded as a limit rather than a silence */
  ok(true, 'OPEN LIMIT: the tooltip-by-tooltip honesty sweep is DEFERRED ' +
     'post-Sept-10 by ruling. This section covers the three cards, the ' +
     'dumbbell and the strip -- the five surfaces the audit measured -- and ' +
     'claims nothing beyond them.');
});

/* ==================================================================== */
say('');
say('=== 7. WHAT THIS TICKET DID NOT TOUCH ===');

guard('the blast radius is two functions', () => {
  const names = [...new Set((SRC.match(/\r\n  (?:async )?function (\w+)\(/g) || [])
    .map(m => /function (\w+)\(/.exec(m)[1]))];
  const changed = names.filter(n => grab(n) !== grab(n, BASE_SRC));
  say('       changed functions: ' + changed.sort().join(', '));
  ok(changed.length === 2, 'exactly TWO functions changed: ' + changed.length);
  ok(changed.indexOf('computeHeaderCards') >= 0, 'computeHeaderCards, for item 2');
  ok(changed.indexOf('renderExecutiveSummary') >= 0, 'renderExecutiveSummary, for item 1');
});

guard('the exclusions hold', () => {
  const dc = grabDecl('DERIVED_COLS'), dcB = grabDecl('DERIVED_COLS', BASE_SRC);
  ok(dc === dcB, 'DERIVED_COLS is byte-identical to BASE');
  ['applyDerivedCols', 'rowsForDisplay', 'recomputeTotals', 'kpiDacPct',
   'composePayloadFromRows', 'dacShadowCompare', 'renderDACMap', 'renderTable',
   'renderIngestEditor', 'renderSourceTables'].forEach(fn => {
    ok(grab(fn) === grab(fn, BASE_SRC), fn + ' is byte-identical to BASE');
  });
  ok(/var DAC_SOURCE = 'dataverse';/.test(CODE), "DAC_SOURCE is still 'dataverse'");
  /* CLCPA-158 still holds, and is now unconditional */
  ok(/\$\{renderDACMap\(baseline, year, sections\)\}/.test(SRC),
     'the map still renders from the one layout, so CLCPA-158 is unconditional now');
});

/* ==================================================================== */
console.log(lines.join('\n'));
console.log('');
console.log('======================================================================');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
console.log('======================================================================');
process.exitCode = fail ? 1 : 0;
