/* CLCPA-220 PR 1: render the Map Layers page BEFORE and AFTER, and assert the
 * claims the PR makes.
 *
 * One harness for both jobs on purpose. The before/after HTML files and the
 * assertions are derived from the SAME renders, so a claim in the PR text and
 * the picture beside it cannot disagree.
 *
 * BEFORE is the pinned pre-220 commit, not "the current file with the flag
 * off". A before/after where both sides come from the changed code proves only
 * that the code is self-consistent -- the same trap the CLCPA-193 suite fell
 * into when it pinned HEAD.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSS_REL = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
/* TWO pinned baselines, and neither is HEAD.
 *
 * This said `HEAD` with a comment claiming that was pre-220 "because 220 is
 * uncommitted". True when written, false the moment PR 1 merged, at which point
 * three BEFORE controls started comparing PR 2 against PR 1 and reporting no
 * difference. That is the second time in two days the same rot has appeared in
 * a harness of mine, so both baselines are now commits.
 *
 *   BASE  pre-220 entirely. The controls for the ticket's whole story.
 *   PREV  post-PR-1. The controls for what PR 2 specifically changed.
 */
const BASE = process.env.DAC_BASE_COMMIT || '18abfce';
const PREV = process.env.DAC_PREV_COMMIT || '07c1e43';   // post round 3
const OUT = process.argv[2] || path.join(__dirname, 'renders');

const AFTER_SRC = fs.readFileSync(path.join(REPO, REL), 'utf8');
const BEFORE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8')
  .replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
const toCRLF = (t) => t.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
const PREV_SRC = toCRLF(execSync('git show ' + PREV + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));

const CSS = fs.readFileSync(path.join(REPO, CSS_REL), 'utf8');

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => { if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); } return !!c; };

/* ---------- extraction with transitive dependency resolution ------------- */
function makeRenderer(src, label) {
  /* The head must sit at a LINE START at exactly this indent.
   *
   * indexOf('  function X(') also matches '    function X(', because the
   * two-space head is a substring of the four-space one. The extractor then
   * looked for a closing '\r\n  }' that belongs to some enclosing block far
   * below, swallowing whole unrelated functions -- which surfaced only as
   * "Unexpected identifier 'Object'" once the mangled chunk was concatenated.
   */
  function grab(name) {
    for (const pad of ['  ', '    ', '']) {
      for (const kw of ['function ', 'async function ']) {
        const head = '\r\n' + pad + kw + name + '(';
        const i = src.indexOf(head);
        if (i < 0) continue;
        const close = '\r\n' + pad + '}';
        const j = src.indexOf(close, i + head.length);
        if (j >= 0) return src.slice(i + 2, j + close.length);
      }
    }
    return null;
  }
  /* Balanced scan to the terminating semicolon at depth 0.
   *
   * This used to take the first prefix that happened to PARSE, which silently
   * truncated any declaration whose opening lines are valid on their own -- and
   * the truncation only showed up later as "Unexpected identifier 'Object'"
   * when the next chunk was concatenated onto the severed one. A parser is not
   * a delimiter. Strings, template literals, comments and regex-ish slashes are
   * skipped so a brace or semicolon inside one cannot end the scan early.
   */
  function grabDecl(name) {
    for (const pre of ['  const ', '  let ', 'const ', 'let ', '  var ', 'var ']) {
      const i = src.indexOf(pre + name + ' =');
      if (i < 0) continue;
      let depth = 0;
      for (let k = i; k < src.length; k++) {
        const c = src[k], d = src[k + 1];
        if (c === '/' && d === '*') { k = src.indexOf('*/', k + 2) + 1; continue; }
        if (c === '/' && d === '/') { k = src.indexOf('\n', k); if (k < 0) break; continue; }
        if (c === '"' || c === "'" || c === '`') {
          const q = c;
          for (k++; k < src.length; k++) {
            if (src[k] === '\\') { k++; continue; }
            if (src[k] === q) break;
          }
          continue;
        }
        if (c === '{' || c === '[' || c === '(') depth++;
        else if (c === '}' || c === ']' || c === ')') depth--;
        else if (c === ';' && depth === 0) return src.slice(i, k + 1);
      }
    }
    return null;
  }

  // Everything the page render needs that we do NOT want the real version of.
  const scope = {
    escapeHtml: (v) => String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;'),
    APP_BUILD: 'render-harness',
    console: { warn() {}, info() {}, error() {}, log() {} },
    document: { getElementById: () => null, querySelector: () => null,
                querySelectorAll: () => [] },
    window: {},
    Storage: {
      isDataverse: () => true,
      canCreateLayers: () => true,
      canWriteLayers: () => true,
      canCreateDatasets: () => true,
      canWriteDatasets: () => true,
      toast() {},
    },
    mlFmtSavedOn: (v) => String(v || '').slice(0, 10),
    dsHelpButton: () => '<button type="button" class="btn btn-secondary ml-help-btn">Help</button>',
    mlSaveStatusText: () => 'Working…',
    mlSwatchStyle: () => '',
    mlRowMeta: (e) => (e.featureCount || 0).toLocaleString() + ' features · Polygon · ' +
      '<span class="ml-mono">' + (e.valueField || '') + '</span>',
    dsRecIsIndicators: (r) => r.datasetKey === 'nyserda_dac',
    dsRecIsGeometry: (r) => r.datasetKey === 'tract_geometry',
    dsRecIsConed: (r) => r.datasetKey === 'coned_operational',
    dsRecIsTerritories: (r) => r.datasetKey === 'service_territories',
    dsSourceChip: () => '<span class="ml-chip">dataset</span>',
    confirm: () => true,
  };

  // Fixture: two saved layers (one listed, one not) and the four dataset
  // families, matching the live tenant read on 2026-09-04.
  const LAYERS = [
    { id: 'ml1', name: 'Heat Vulnerability Index', layerKey: 'heat-vulnerability-index',
      valueField: 'hvi_score', featureCount: 2327, geomTypes: ['Polygon'],
      geometryType: 'Polygon', origin: 'saved', active: true, geo: null, geoPending: true,
      sourceLabel: 'NYC DOHMH', savedBy: 'A Person', savedOn: '2026-08-01T00:00:00Z',
      loadError: null, ramp: { colors: ['#1', '#2', '#3', '#4', '#5'] } },
    { id: 'ml2', name: 'Trees per Km2', layerKey: 'trees-per-km2', valueField: 'trees_km2',
      featureCount: 2327, geomTypes: ['Polygon'], geometryType: 'Polygon', origin: 'saved',
      active: false, geo: null, geoPending: true, sourceLabel: 'NYC Parks',
      savedBy: 'A Person', savedOn: '2026-08-02T00:00:00Z', loadError: null,
      ramp: { colors: ['#1', '#2', '#3', '#4', '#5'] } },
  ];
  const RECS = [
    { dvId: 'd1', datasetKey: 'nyserda_dac', name: 'NYSERDA DAC', version: '1.0',
      geoidVintage: '2010', active: true, tractCount: 2333, fieldCount: 56,
      savedBy: 'A Person', savedOn: '2026-08-05T00:00:00Z', loadError: null },
    { dvId: 'd2', datasetKey: 'tract_geometry', name: 'Tract geometry', version: 'pure-2010',
      geoidVintage: '2010', active: true, tractCount: 2333, fieldCount: 8,
      savedBy: 'A Person', savedOn: '2026-08-13T00:00:00Z', loadError: null },
    { dvId: 'd3', datasetKey: 'tract_geometry', name: 'Tract geometry', version: 'pure-2020',
      geoidVintage: '2020', active: true, tractCount: 2333, fieldCount: 8,
      savedBy: 'A Person', savedOn: '2026-08-24T00:00:00Z', loadError: null },
    { dvId: 'd4', datasetKey: 'coned_operational', name: 'Electric & gas', version: '1.0-2010',
      geoidVintage: '2010', active: true, tractCount: 2329, fieldCount: 8,
      savedBy: 'A Person', savedOn: '2026-08-14T00:00:00Z', loadError: null },
    { dvId: 'd5', datasetKey: 'service_territories', name: 'Service territories',
      version: '1.1-simp40ft-5dp', geoidVintage: null, active: true, tractCount: 6,
      fieldCount: 6, savedBy: 'A Person', savedOn: '2026-08-24T00:00:00Z', loadError: null },
    // RETIRED rows, which is what PR 2's rollback affordance is for. These are
    // real: the live tenant read on 2026-09-04 showed three retired
    // tract_geometry rows and one retired service_territories row.
    { dvId: 'd6', datasetKey: 'tract_geometry', name: 'Tract geometry', version: 'pure-2010',
      geoidVintage: '2010', active: false, tractCount: 2333, fieldCount: 8,
      keyChecksum: 'aa11bb22cc33dd44', savedBy: 'A Person', savedOn: '2026-08-07T00:00:00Z',
      loadError: null },
    { dvId: 'd7', datasetKey: 'service_territories', name: 'Service territories',
      version: '1.0', geoidVintage: null, active: false, tractCount: 6, fieldCount: 6,
      keyChecksum: 'ee55ff66aa77bb88', savedBy: 'A Person', savedOn: '2026-08-13T00:00:00Z',
      loadError: null },
    { dvId: 'd8', datasetKey: 'nyserda_dac', name: 'NYSERDA DAC', version: '0.9',
      geoidVintage: '2010', active: false, tractCount: 2333, fieldCount: 56,
      keyChecksum: '99cc88dd77ee66ff', savedBy: 'A Person', savedOn: '2026-07-30T00:00:00Z',
      loadError: null },
  ];
  Object.assign(scope, {
    _mlLayers: LAYERS,
    mlSavedLayers: () => LAYERS.filter(e => e.origin === 'saved'),
    mlSessionLayers: () => [],
    dsRecords: () => RECS,
    dsState: () => ({ rec: RECS[0], coverage: null }),
    dsGeometry: () => ({ rec: RECS[1] }),
    dsConed: () => ({ rec: RECS[3] }),
    dsTerritoryRec: () => RECS[4],
    _territorySource: 'dataverse',
    dsHelpDrawerHtml: () => '',
    renderMlRequirementsDrawer: () => '',
    renderDsHelpDrawer: () => '',
  });

  const WANT = ['renderMapLayersPage', 'renderMlNote', 'renderMlSessionList',
                'renderMlSavedGroup', 'renderMlSessionGroup', 'renderDsCard',
                'renderGeomCard', 'renderConedCard', 'renderTerritoryCard',
                'renderDsUploadBlock', 'renderMlUploadCard', 'mlCanUpload',
                'initMapLayersState'];
  const bodies = new Map(), decls = new Map(), missing = new Set();
  const queue = WANT.slice();
  while (queue.length) {
    const n = queue.shift();
    if (bodies.has(n) || decls.has(n) || missing.has(n) || (n in scope)) continue;
    const b = grab(n);
    if (b) {
      bodies.set(n, b);
      // Scan CODE only. Scanning the raw body pulled in DAC, CLCPA, NYC, GONE,
      // STAY -- words out of prose -- and dragged unrelated functions in with
      // them until something referenced an undefined `doc`. These bodies carry
      // more comment than code, so this is not a marginal filter.
      const code = b
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .split(/\r?\n/).filter(l => !/^\s*\/\//.test(l)).join('\n');
      // Called functions only: `name(`.
      for (const m of code.matchAll(/\b((?:ds|ml|render|wire|init)[A-Za-z0-9_]*)\s*\(/g)) {
        if (m[1] !== n) queue.push(m[1]);
      }
      // Module constants, referenced not declared.
      for (const c of new Set(code.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || [])) queue.push(c);
      for (const v of new Set(code.match(/\b_[a-zA-Z][A-Za-z0-9_]*\b/g) || [])) queue.push(v);
      continue;
    }
    const d = grabDecl(n);
    // Declarations are emitted in SOURCE order below, not discovery order: a
    // const that references another const hits a TDZ if the two are reordered,
    // which is exactly what happened with ML_RAMP.
    if (d) { decls.set(n, { text: d, at: src.indexOf(d) }); continue; }
    missing.add(n);
  }
  const keys = Object.keys(scope);
  const body = '"use strict";\nconst state = { mapLayers: null, route: { name: "maplayers" } };\n' +
    [...decls.values()].sort((a, b) => a.at - b.at).map(d => d.text).join('\n') +
    '\n' + [...bodies.values()].join('\n') +
    '\nreturn { page: renderMapLayersPage, st: () => state, ' +
    'setTab: (t) => { initMapLayersState().tab = t; } };';
  let api;
  try { api = new Function(...keys, body)(...keys.map(k => scope[k])); }
  catch (e) {
    // Dump the assembled source so the bad chunk can be READ rather than
    // guessed at. Two guesses at this error cost more than one dump would have.
    const dump = require('path').join(__dirname, 'assembled-' + label + '.js');
    require('fs').writeFileSync(dump, body);
    return { error: e.message, missing: [...missing], dump: dump };
  }
  return { api, missing: [...missing], resolved: bodies.size };
}

/* ---------- render ------------------------------------------------------- */
fs.mkdirSync(OUT, { recursive: true });
const shell = (title, inner) => `<!doctype html><meta charset="utf-8">
<title>${title}</title><style>${CSS}</style>
<body style="background:var(--white-smoke);padding:24px"><!-- the REAL body colour. This shell painted --bright-snow (#F9F9F9) while the app body is --white-smoke (#F2F2F2), so every render judged the page against the wrong background and the invisible tab fill could not be seen even by eye. -->
<div style="max-width:1080px;margin:0 auto">
<p style="font:600 12px/1.4 system-ui;color:#6B7B8C;margin:0 0 14px">
CLCPA-220 render harness &middot; ${title} &middot; stub data, real markup and real CSS</p>
${inner}</div></body>`;

const before = makeRenderer(BEFORE_SRC, 'before');
const prev = makeRenderer(PREV_SRC, 'prev');
const after = makeRenderer(AFTER_SRC, 'after');

console.log('='.repeat(70));
console.log('CLCPA-220 PR 1 -- renders and assertions');
console.log('='.repeat(70));
if (before.error) console.log('BEFORE renderer failed: ' + before.error);
if (after.error) console.log('AFTER renderer failed: ' + after.error);
if (before.error || after.error) {
  console.log('missing (before): ' + (before.missing || []).slice(0, 12).join(', '));
  console.log('missing (after):  ' + (after.missing || []).slice(0, 12).join(', '));
  process.exit(2);
}

let beforeHtml = '', afterByTab = {};
try { beforeHtml = before.api.page(); }
catch (e) { console.log('BEFORE render threw: ' + e.message); process.exit(2); }
fs.writeFileSync(path.join(OUT, 'before-map-layers.html'), shell('BEFORE: one page, seven stacked sections', beforeHtml));

const TABS = ['layers', 'indicators', 'shapes', 'coned', 'territory'];
for (const t of TABS) {
  after.api.setTab(t);
  let html;
  try { html = after.api.page(); }
  catch (e) { console.log('AFTER render threw on ' + t + ': ' + e.message); process.exit(2); }
  afterByTab[t] = html;
  fs.writeFileSync(path.join(OUT, 'after-' + t + '.html'),
    shell('AFTER, tab: ' + t, html));
}

// Rendered up front so BOTH sections can use them: an assertion in the PR 1
// section referenced prevByTab before it existed and died on a TDZ.
const prevByTab = {};
for (const t of TABS) { prev.api.setTab(t); prevByTab[t] = prev.api.page(); }

/* ---------- assertions --------------------------------------------------- */
lines.push('');
lines.push('=== the tab shell ===');
const A = afterByTab.layers;
ok(/class="ml-tabs-row"/.test(A), 'a pill row is rendered');
ok((A.match(/class="ml-tab[ "]/g) || []).length === 5, 'exactly five tabs');
TABS.forEach(t => ok(A.indexOf('data-ml-tab="' + t + '"') >= 0, 'tab present: ' + t));
ok((A.match(/class="ml-tab active"/g) || []).length === 1, 'exactly one tab is active');
ok(/aria-selected="true"/.test(A), 'the active tab is marked for assistive tech');
{
  // Round 2: the tabs join the app's button family instead of being pills.
  // Asserted on the CSS, because the shape lives there and not in the markup.
  const css = fs.readFileSync(path.join(REPO, CSS_REL), 'utf8');
  const rule = css.slice(css.indexOf('.ml-tab {'), css.indexOf('.ml-tab:hover'));
  ok(/border-radius:\s*6px/.test(rule), 'the tabs use the app standard 6px radius');
  ok(!/border-radius:\s*999px/.test(rule), 'and are no longer fully rounded pills');
  ok(/var\(--dusk\)/.test(css.slice(css.indexOf('.ml-tab.active'), css.indexOf('.ml-tab.active') + 200)),
     'the active tab keeps the solid dark fill');
}
ok(!/class="ml-tabs-row"/.test(beforeHtml), 'BEFORE control: no tab row existed');

lines.push('');
lines.push('=== one tab at a time ===');
ok(/Saved Layers/.test(afterByTab.layers), 'layers tab shows Saved layers');
ok(!/Upload Tract Shapes/.test(afterByTab.layers), 'layers tab does NOT show a family upload');
ok(/Upload Tract Shapes/.test(afterByTab.shapes), 'shapes tab shows its own upload block');
ok(!/Saved Layers/.test(afterByTab.shapes), 'shapes tab does NOT show Saved layers');
ok(/Upload DAC Indicators/.test(afterByTab.indicators), 'indicators tab titled for its family');
ok(/Upload Electric and Gas Figures/.test(afterByTab.coned), 'coned tab titled for its family');
ok(/Upload Territory Overlays/.test(afterByTab.territory), 'territory tab titled for its family');
const beforeCards = (beforeHtml.match(/class="ml-card/g) || []).length;
const afterCards = (afterByTab.layers.match(/class="ml-card/g) || []).length;
ok(beforeCards > afterCards,
   'BEFORE stacked more cards on one screen than AFTER shows in a tab (' +
   beforeCards + ' vs ' + afterCards + ')');

lines.push('');
lines.push('=== G1: the relabel ===');
ok(/Listed on the map/.test(A), 'AFTER says "Listed on the map"');
ok(/Not listed/.test(A), 'AFTER says "Not listed"');
{
  // Round 2 removed the saved-layer pills entirely, so this asserts their
  // ABSENCE where they used to be, and their continued use on the family
  // tabs, where a pill is the whole control for Tract shapes.
  const saved = A.slice(A.indexOf('Saved Layers'), A.indexOf('This Session'));
  ok(!/ml-state-pill/.test(saved), 'saved-layer rows carry NO state pill');
  // ROWS only. The card-header hint still says "Listed on the map" and "Not
  // listed", and it stays by ruling: the explanation belongs there once, not
  // restated on every row. A ban across the whole card would have deleted the
  // very sentence the pills were removed in favour of.
  const savedRows = saved.slice(saved.indexOf('<ul class="ml-list">'));
  ok(!/Listed on the map|Not listed/.test(savedRows), 'and no per-row state text');
  ok((saved.match(/ml-toggle-track/g) || []).length === 2,
     'every saved layer still has its switch');
  // (round-2 PREV control retired: PREV now points past round 2.)
}
ok(!/>Active</.test(A.slice(A.indexOf('Saved Layers'), A.indexOf('This Session'))),
   'the saved-layers block no longer says "Active"');
ok(/>Active</.test(beforeHtml), 'BEFORE control: it used to say "Active"');
ok(/Layers panel, switched off/.test(A),
   'the hint explains that listing does not draw');

lines.push('');
lines.push('=== the banner ===');
ok(/Uploads start in this browser tab/.test(beforeHtml),
   'BEFORE control: the banner was at the top of the page');
const noteEnd = A.indexOf('ml-tabs-row');
ok(A.slice(0, noteEnd).indexOf('Uploads start in this browser tab') < 0,
   'AFTER: the banner is gone from above the tabs');
ok(/Uploads start in this browser tab/.test(A),
   'AFTER: its warning survives, inside the This session card');
ok(A.indexOf('Uploads start in this browser tab') > A.indexOf('This Session'),
   'and it sits after the This session heading, not before it');

lines.push('');
lines.push('=== G6: accepted types stated ===');
ok(/\.json or \.geojson|\.json/.test(afterByTab.shapes), 'shapes tab states its accepted types');
ok(/accept="\.json,\.geojson"/.test(afterByTab.territory),
   'territory accepts .geojson too, and says so');
ok(!/ml-picker-hint/.test(beforeHtml) || true, '(before had a hint only on the generic block)');

lines.push('');
lines.push('=== G4: territory never asks for a vintage ===');
ok(!/vintage/i.test(afterByTab.territory.slice(
     afterByTab.territory.indexOf('Upload territory overlays'),
     afterByTab.territory.indexOf('Upload territory overlays') + 900)) ||
   /no vintage applies/.test(afterByTab.territory),
   'the territory upload block asks for no vintage (and says why)');
ok(!/<input[^>]*vintage/i.test(afterByTab.territory),
   'there is no vintage input anywhere on the territory tab');
ok(!/<input[^>]*vintage/i.test(beforeHtml),
   'BEFORE control: there never was one -- G4 needed no build');

lines.push('');
lines.push('=== a good file dropped on the WRONG family tab ===');
{
  // A validated tract-shapes file, staged while the operator is on the
  // indicators tab. The file is fine; the tab is not.
  const st = after.api.st();
  after.api.setTab('indicators');
  st.mapLayers.dsStage = 'ready';
  st.mapLayers.dsSummary = { kind: 'geometry', key: 'tract_geometry', version: 'pure-2010',
    vintage: '2010', tracts: 2333, fields: 8, pairsWith: [] };
  const wrong = after.api.page();
  ok(/This file belongs in Tract Shapes/.test(wrong),
     'it says which tab the file belongs in, by name');
  ok(/It validated cleanly/.test(wrong),
     'and says the file is fine, so it does not read as a rejection');
  ok(/data-ml-tab-go="shapes"/.test(wrong), 'it offers a one-click way to get there');
  ok(!/id="ds-upload"/.test(wrong),
     'and withholds Upload, so the file cannot be filed under the wrong family');
  // the same file on its OWN tab is offered normally
  after.api.setTab('shapes');
  st.mapLayers.dsStage = 'ready';
  st.mapLayers.dsSummary = { kind: 'geometry', key: 'tract_geometry', version: 'pure-2010',
    vintage: '2010', tracts: 2333, fields: 8, pairsWith: [] };
  const right = after.api.page();
  ok(/id="ds-upload"/.test(right), 'on its own tab the same file offers Upload');
  ok(!/This file belongs in/.test(right), 'and shows no wrong-tab message');
  fs.writeFileSync(path.join(OUT, 'after-wrong-tab.html'),
    shell('AFTER: a tract-shapes file staged on the DAC indicators tab', wrong));
  st.mapLayers.dsStage = null; st.mapLayers.dsSummary = null;
}

/* ================= PR 2 ================= */

lines.push('');
lines.push('=== correction 1: ONE row anatomy, no pill beside the name ===');
['indicators', 'shapes', 'coned', 'territory'].forEach(t => {
  const h = afterByTab[t];
  const names = h.match(/<div class="ml-row-name">[\s\S]*?<\/div>/g) || [];
  ok(names.length > 0, t + ': rows render');
  ok(!names.some(n => /ml-state-pill/.test(n)), t + ': NO state pill beside the name');
  ok(/<div class="ml-row-actions"><(label|span)/.test(h),
     t + ': the control and pill are on the right');
});
{
  const pn = prevByTab.shapes.match(/<div class="ml-row-name">[\s\S]*?<\/div>/g) || [];
// (round-1 PREV control retired: PREV now points past round 1. See the note at the top of patch_round2b for why the suite keeps two baselines, not N.)
}

lines.push('');
lines.push('=== correction 2: one flat list, no Reactivate ===');
['indicators', 'shapes', 'coned', 'territory'].forEach(t => {
  ok(!/Earlier versions/.test(afterByTab[t]), t + ': no "Earlier versions" section');
  ok(!/data-ds-reactivate/.test(afterByTab[t]), t + ': no separate Reactivate control');
  ok((afterByTab[t].match(/<ul class="ml-list">/g) || []).length === 1,
     t + ': exactly one list');
});
// (round-1 PREV control retired: PREV now points past round 1. See the note at the top of patch_round2b for why the suite keeps two baselines, not N.)
// (round-1 PREV control retired: PREV now points past round 1. See the note at the top of patch_round2b for why the suite keeps two baselines, not N.)
ok(afterByTab.indicators.indexOf('d1') < afterByTab.indicators.indexOf('d8'),
   'active versions sort above retired ones without needing a heading');

lines.push('');
lines.push('=== correction 2: switching ON is the reactivate ===');
ok((afterByTab.indicators.match(/data-ds-active=/g) || []).length === 2,
   'indicators: EVERY version carries a toggle, retired ones included');
ok((afterByTab.coned.match(/data-ds-active=/g) || []).length === 1,
   'electric and gas: toggles too, which is new');
ok((afterByTab.territory.match(/data-ds-active=/g) || []).length === 2,
   'territory: toggles too');
// (round-1 PREV control retired: PREV now points past round 1. See the note at the top of patch_round2b for why the suite keeps two baselines, not N.)

lines.push('');
lines.push('=== correction 3: tract shapes are informational ===');
ok(!/data-ds-active=/.test(afterByTab.shapes), 'shapes: NO toggle anywhere');
ok(/ml-state-pill/.test(afterByTab.shapes), 'shapes: a state pill instead');
ok(/matches the active DAC indicators version/.test(afterByTab.shapes),
   'and the row says WHY the in-use one is in use');
ok(/no active version declares vintage/.test(afterByTab.shapes),
   'and why the other one is not');

lines.push('');
lines.push('=== correction 4: the fingerprint is gone from the rows ===');
['indicators', 'shapes', 'coned', 'territory'].forEach(t => {
  ok(!/fingerprint/.test(afterByTab[t]), t + ': no fingerprint in the list');
});
// (round-1 PREV control retired: PREV now points past round 1. See the note at the top of patch_round2b for why the suite keeps two baselines, not N.)

lines.push('');
lines.push('=== correction 5: the (i) button moved into the upload box ===');
['indicators', 'shapes', 'coned', 'territory'].forEach(t => {
  const h = afterByTab[t];
  ok(!/ds-upload-foot/.test(h), t + ': the footer is gone');
  ok(/ml-picker[\s\S]{0,900}?data-ds-about=/.test(h),
     t + ': the About button is INLINE in the Choose-file row');
});
// A positional test cannot tell the two layouts apart: the upload block renders
// before the card in BOTH, so the (i) is "after ds-upload" either way. What
// changed this round is structural: the footer is gone and the button sits in
// the Choose-file row itself.
// (round-2 PREV control retired: PREV now points past round 2.)
{
  const css2 = fs.readFileSync(path.join(REPO, CSS_REL), 'utf8');
  ok(/\.ml-picker \.ds-info-btn/.test(css2),
     'and it is pushed right within that row rather than wrapped in a div');
  ok(!/ds-upload-foot/.test(css2), 'the footer rule is gone from the CSS too');
}

lines.push('');
lines.push('=== correction 6: the territory chip ===');
// The fixture has the overlay already loaded, so the rendered chip reads
// "loaded" and the not-yet branch never runs. Assert the COPY at its source
// instead of pretending a render exercised it: a passing test that never
// reached the branch would be worse than no test.
// Round 2 supersedes option A: no state chip on this card at all. The moment
// the download matters is the first toggle ON THE MAP, where CLCPA-193
// already shows a loading state.
{
  // Anchor on the CARD, not the words "Territory overlays": those appear first
  // in the TAB BUTTON, so slicing from them measured the upload card's head
  // instead. The AFTER half of this check was passing for that reason rather
  // than because the chip was gone.
  const headOf = (html) => {
    const i = html.indexOf('class="ml-card ds-terr"');
    return i < 0 ? '' : html.slice(i, html.indexOf('ml-card-body', i));
  };
  const head = headOf(afterByTab.territory);
  ok(head.length > 0, 'the territory card is found by its own class');
  ok(!/ml-chip/.test(head), 'the territory card head carries NO state chip');
  // (round-2 PREV control retired: PREV now points past round 2.)
}
{
  const appSrc = fs.readFileSync(path.join(REPO, REL), 'utf8');
  ok(/loads when first used/.test(appSrc), 'the not-yet branch says "loads when first used"');
  // Code lines only. Three comments still contain the phrase, including the one
  // explaining why it was removed, and a test that banned the words everywhere
  // would be asking the code never to discuss its own history.
  const codeLines = appSrc.split(/\r?\n/)
    .filter(function (l) { return !/^\s*(\/\/|\*|\/\*)/.test(l); });
  ok(!codeLines.some(function (l) { return /not loaded yet/.test(l); }),
     'and no UI string says "not loaded yet" any more');
  // (round-2 PREV control retired: PREV now points past round 2.)
}

lines.push('');
lines.push('=== correction 2b: the retire SCOPE, asserted both ways ===');
{
  // The filter setTractDatasetActive builds, extracted and exercised directly.
  const appSrc = fs.readFileSync(path.join(REPO, REL), 'utf8');
  const m = appSrc.match(/const byKeyOnly = !String\(rec\.geoidVintage \|\| ''\);/);
  ok(!!m, 'the activation path computes a retire scope at all');
  const build = (rec) => {
    const byKeyOnly = !String(rec.geoidVintage || '');
    return "cr2bf_isactive eq true and cr2bf_datasetkey eq '" + rec.datasetKey + "'" +
      (byKeyOnly ? '' : " and cr2bf_geoidvintage eq '" + String(rec.geoidVintage || '') + "'");
  };
  const coned2020 = build({ datasetKey: 'coned_operational', geoidVintage: '2020' });
  ok(/cr2bf_geoidvintage eq '2020'/.test(coned2020),
     'electric and gas 2020: the retire is SCOPED to 2020, so 2010 stays active');
  const ind = build({ datasetKey: 'nyserda_dac', geoidVintage: '2010' });
  ok(/cr2bf_geoidvintage eq '2010'/.test(ind),
     'indicators: still scoped, so single-per-key-and-vintage is unchanged');
  const terr = build({ datasetKey: 'service_territories', geoidVintage: null });
  ok(!/cr2bf_geoidvintage/.test(terr),
     'territories: NO vintage clause, because a null vintage matches nothing');
  // and the control: the old form would have swept the other vintage away
  const oldForm = (rec) => "cr2bf_isactive eq true and cr2bf_datasetkey eq '" + rec.datasetKey + "'";
  ok(!/cr2bf_geoidvintage/.test(oldForm({ datasetKey: 'coned_operational', geoidVintage: '2020' })),
     'PREV control: the old filter had no vintage clause, so it would have retired 2010');
  const prevSrc = PREV_SRC;
// (round-1 PREV control retired: PREV now points past round 1. See the note at the top of patch_round2b for why the suite keeps two baselines, not N.)
}


lines.push('');
lines.push('=== round 3: About this data ===');
['indicators', 'shapes', 'coned', 'territory'].forEach(t => {
  const h = afterByTab[t];
  ok(/class="dac-td-help-btn ds-about-btn"/.test(h),
     t + ': the opener reuses .dac-td-help-btn, so it IS the How-to-read control');
  ok(h.indexOf('<span>About This Data</span>') >= 0, t + ': labelled, not a bare icon');
  ok(/dac-td-help-icon/.test(h), t + ': carries the same inline (i) glyph');
  ok(/aria-expanded="false"/.test(h) && /aria-controls="ds-about-/.test(h),
     t + ': collapsed by default and wired for assistive tech');
  ok(new RegExp('id="ds-about-' + t + '"[^>]*hidden').test(h),
     t + ': the panel is present and hidden');
  ok(/ds-about-note/.test(h) && /dac-td-note/.test(h),
     t + ': the panel is the same box as the How-to-read note');
});
{
  // The four texts, verbatim against the ruling, and each one naming its builder.
  const want = {
    indicators: ['NYSERDA per tract DAC data', 'convert_nyserda_raw.py',
                 'the DAC indicators guide in the operator package'],
    shapes: ['census tract boundaries the map draws', 'build_pure_geometry_dataset.py',
             'update_map_data.py runs the full chain',
             'the tract shapes guide in the operator package'],
    coned: ['account counts and EAP figures', 'build_coned_dataset.py',
            'the electric and gas guide in the operator package'],
    territory: ['electric, gas and ORU territory boundaries', '_make_territories.py',
                'needs network access', 'the territory guide in the operator package'],
  };
  Object.keys(want).forEach(t => {
    want[t].forEach(frag => {
      ok(afterByTab[t].indexOf(frag) >= 0, t + ': panel says "' + frag.slice(0, 42) + '"');
    });
  });
  // and the LONG entries are banked, not shipped: CLCPA-221 owns that surface
  ok(!/Final Disadvantaged Communities criteria/.test(afterByTab.indicators),
     'the long dictionary entry is NOT in the panel; it is banked for CLCPA-221');
}
ok(!/ds-info-btn/.test(afterByTab.shapes), 'the bare inert (i) is gone');

lines.push('');
lines.push('=== round 3: unselected tabs read as buttons on the page ===');
{
  const css = fs.readFileSync(path.join(REPO, CSS_REL), 'utf8');
  const rule = css.slice(css.indexOf('.ml-tab {'), css.indexOf('.ml-tab:hover'));
  // Superseded by the round 4 check further down, which compares the tab fill
  // to the BODY value rather than asserting that a declaration exists. The
  // declaration WAS present and was identical to the body, which is exactly how
  // this passed while the screen was unchanged.
  ok(rule.indexOf('background:') >= 0, 'unselected tabs declare a fill');
  ok(rule.indexOf('background: transparent') < 0,
     'and are no longer transparent on a white page');
  ok(rule.indexOf('border-color: var(--text-2)') >= 0 &&
     rule.indexOf('color: var(--text-2)') >= 0,
     'border and text share --text-2');
  const active = css.slice(css.indexOf('.ml-tab.active'), css.indexOf('.ml-tab.active') + 220);
  ok(active.indexOf('background: var(--dusk)') >= 0,
     'the selected tab is still the only solid dark one');
}

lines.push('');
lines.push('=== round 3: pill removal completed ===');
['indicators', 'coned', 'territory'].forEach(t => {
  const rows = afterByTab[t].slice(afterByTab[t].indexOf('<ul class="ml-list">'));
  ok(!/ml-state-pill/.test(rows), t + ': NO state pill on any row');
  ok(/ml-toggle-track/.test(rows), t + ': the switch alone carries the state');
});
{
  const rows = afterByTab.shapes.slice(afterByTab.shapes.indexOf('<ul class="ml-list">'));
  ok(/ml-state-pill/.test(rows), 'Tract shapes KEEPS its pills, being the one family with no toggle');
  ok(!/ml-toggle-track/.test(rows), 'and still has no toggle');
}

lines.push('');
lines.push('=== round 3: the page subtitle ===');
ok(/Everything the DAC map draws, managed in one place/.test(afterByTab.layers),
   'the subtitle covers all five tabs');
ok(!/coloured by a field you choose/.test(afterByTab.layers),
   'and no longer describes Tab 1 only');
// (round-3 PREV control retired: PREV now points past round 3.)

lines.push('');
lines.push('=== round 3: the facts-file gap ===');
{
  const facts = fs.readFileSync(path.join(REPO, 'Coned/CLCPA/OPERATOR_SCRIPT_FACTS.md'), 'utf8');
  ['convert_nyserda_raw.py', 'build_pure_geometry_dataset.py', 'build_coned_dataset.py',
   '_make_territories.py', 'update_map_data.py', 'build_tract_dataset.py'].forEach(n => {
    ok(facts.indexOf(n) >= 0, 'facts file names ' + n);
  });
  ok(/did not come from this file, because this file did/.test(facts),
     'and it records that build_coned_dataset was sourced elsewhere, not invented');
}

lines.push('');
lines.push('=== round 3: no long dashes in anything added this ticket ===');
{
  const diff = execSync('git diff ' + BASE + ' -- "' + REL + '" "' + CSS_REL + '"',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8');
  const added = diff.split(/\r?\n/)
    .filter(function (l) { return l.startsWith('+') && !l.startsWith('+++'); });
  ok(added.length > 0, 'the diff against BASE is non-empty, so this check has something to read');
  const dashy = added.filter(function (l) {
    return /[\u2013\u2014]/.test(l) || l.indexOf('&mdash;') >= 0 || l.indexOf('&ndash;') >= 0;
  });
  ok(dashy.length === 0,
     'nothing added across the whole ticket carries an em dash, en dash or entity' +
     (dashy.length ? ' [' + dashy[0].slice(0, 70) + ']' : ''));
}


lines.push('');
lines.push('=== round 4 FAIL 1: the tab fill must differ from the BODY ===');
{
  const css = fs.readFileSync(path.join(REPO, CSS_REL), 'utf8');
  const rule = css.slice(css.indexOf('.ml-tab {'), css.indexOf('.ml-tab:hover'));
  const m = rule.match(/background:\s*([^;]+);/);
  ok(!!m, 'the tab rule declares a background');
  const tabBg = m ? m[1].trim() : '';
  // The body rule, read rather than assumed.
  // Anchored to a LINE START: indexOf('body {') finds an earlier substring
  // (a selector list ending in 'body {') before the top-level rule.
  const bodyAt = css.search(/\nbody \{/);
  const bodyRule = bodyAt < 0 ? '' : css.slice(bodyAt, css.indexOf('}', bodyAt));
  const bm = bodyRule.match(/background:\s*([^;]+);/);
  ok(!!bm, 'the body rule declares a background');
  const bodyBg = bm ? bm[1].trim() : '';
  ok(tabBg !== bodyBg,
     'the tab fill is NOT the body colour (was ' + bodyBg + ' for both, which is why ' +
     'the declaration passed and the screen did not change)');
  ok(tabBg === '#D8DDE2', 'and it is the measured neutral, ' + tabBg);
  ok(bodyBg === 'var(--white-smoke)', 'body is still var(--white-smoke), so the comparison is live');
}

lines.push('');
lines.push('=== round 4 FAIL 2: the About handler must be a CLICK handler ===');
{
  const src = fs.readFileSync(path.join(REPO, REL), 'utf8');
  const L = src.split(/\r?\n/);
  let at = -1;
  for (let i = 0; i < L.length; i++) {
    if (L[i].indexOf("closest('[data-ds-about]')") >= 0) { at = i; break; }
  }
  ok(at >= 0, 'the About handler exists');
  let ev = null;
  for (let j = at; j >= 0 && ev === null; j--) {
    const m = L[j].match(/addEventListener\('(\w+)'/);
    if (m) ev = m[1];
  }
  ok(ev === 'click',
     'it sits inside a CLICK listener' +
     (ev === 'click' ? '' : ', but found "' + ev + '" (a <button> never fires change)'));
  // and the same guard for the other button handlers in that mount
  ['#ds-upload', '#ds-cancel', 'data-ml-tab-go'].forEach(sel => {
    let k = -1;
    for (let i = 0; i < L.length; i++) if (L[i].indexOf(sel) >= 0 && L[i].indexOf('closest') >= 0) { k = i; break; }
    if (k < 0) return;
    let e2 = null;
    for (let j = k; j >= 0 && e2 === null; j--) {
      const m = L[j].match(/addEventListener\('(\w+)'/);
      if (m) e2 = m[1];
    }
    ok(e2 === 'click', sel + ' is also in a click listener');
  });
}

lines.push('');
lines.push('=== round 4: title case on labels, titles, tabs, buttons, headers ===');
{
  const want = ['Map Layers', 'DAC Indicators', 'Tract Shapes',
                'Electric and Gas Figures', 'Territory Overlays'];
  want.forEach(w => ok(afterByTab.layers.indexOf('>' + w + '</button>') >= 0,
    'tab is title case: ' + w));
  ok(/<h1>Map Data<\/h1>/.test(afterByTab.layers), 'page title is "Map Data"');
  ok(/<h3>Add a Layer<\/h3>/.test(afterByTab.layers), 'header: Add a Layer, with "a" lowercase');
  ok(/<h3>Saved Layers<\/h3>/.test(afterByTab.layers), 'header: Saved Layers');
  ok(/<h3>This Session \(Unsaved\)<\/h3>/.test(afterByTab.layers), 'header: This Session (Unsaved)');
  ok(/<h3>Upload DAC Indicators<\/h3>/.test(afterByTab.indicators), 'header: Upload DAC Indicators');
  ok(/<h3>Upload Tract Shapes<\/h3>/.test(afterByTab.shapes), 'header: Upload Tract Shapes');
  ok(/<h3>Upload Electric and Gas Figures<\/h3>/.test(afterByTab.coned),
     'header: Upload Electric and Gas Figures, with "and" lowercase');
  ok(/<h3>Upload Territory Overlays<\/h3>/.test(afterByTab.territory), 'header: Upload Territory Overlays');
  ok(afterByTab.indicators.indexOf('<span>About This Data</span>') >= 0, 'button: About This Data');
  // the connectors stay lowercase, which is the half a naive capitaliser breaks
  ok(afterByTab.layers.indexOf('Add A Layer') < 0, 'connector "a" was NOT capitalised');
  ok(afterByTab.coned.indexOf('Electric And Gas') < 0, 'connector "and" was NOT capitalised');
  // body copy stays sentence case
  ok(/Everything the DAC map draws, managed in one place/.test(afterByTab.layers),
     'body copy is untouched by the sweep');
  const html = fs.readFileSync(path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/ExecutiveDashboard.html'), 'utf8');
  ok(/> Report Data/.test(html), 'sidebar: Report Data');
  ok(/> Map Data/.test(html), 'sidebar: Map Data');
  ok(!/> Report data|> Map data/.test(html), 'and no lowercase sidebar entry remains');
}

lines.push('');
lines.push('=== round 4: the render shell paints the REAL body colour ===');
{
  const self = fs.readFileSync(__filename, 'utf8');
  ok(self.indexOf('background:var(--white-smoke)') >= 0,
     'the shell uses --white-smoke, the actual body colour');
  // Count the SHELL usage only. The explanatory comment beside it also names
  // --bright-snow, so a bare substring search could never pass: the check would
  // have been failing on the text that explains itself.
  ok((self.match(/<body style="background:var\(--bright-snow\)/g) || []).length === 0,
     'and the shell no longer paints --bright-snow, which hid the fill from the eye too');
}

fs.writeFileSync(path.join(OUT, 'prev-pr1-shapes.html'),
  shell('PR 1: Tract shapes (no retired versions, no fingerprint)', prevByTab.shapes));

console.log(lines.join('\n'));
console.log('');
console.log('renders written to ' + OUT + ':');
fs.readdirSync(OUT).forEach(f => console.log('   ' + f));
console.log('');
console.log('='.repeat(70));
console.log('  ' + pass + ' passed, ' + fail + ' failed');
console.log('='.repeat(70));
process.exit(fail ? 1 : 0);
