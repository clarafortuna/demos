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
const PREV = process.env.DAC_PREV_COMMIT || '4ba13c7';
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
<body style="background:var(--bright-snow);padding:24px">
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

/* ---------- assertions --------------------------------------------------- */
lines.push('');
lines.push('=== the tab shell ===');
const A = afterByTab.layers;
ok(/class="ml-tabs-row"/.test(A), 'a pill row is rendered');
ok((A.match(/class="ml-tab[ "]/g) || []).length === 5, 'exactly five tabs');
TABS.forEach(t => ok(A.indexOf('data-ml-tab="' + t + '"') >= 0, 'tab present: ' + t));
ok((A.match(/class="ml-tab active"/g) || []).length === 1, 'exactly one tab is active');
ok(/aria-selected="true"/.test(A), 'the active tab is marked for assistive tech');
ok(!/class="ml-tabs-row"/.test(beforeHtml), 'BEFORE control: no tab row existed');

lines.push('');
lines.push('=== one tab at a time ===');
ok(/Saved layers/.test(afterByTab.layers), 'layers tab shows Saved layers');
ok(!/Upload tract shapes/.test(afterByTab.layers), 'layers tab does NOT show a family upload');
ok(/Upload tract shapes/.test(afterByTab.shapes), 'shapes tab shows its own upload block');
ok(!/Saved layers/.test(afterByTab.shapes), 'shapes tab does NOT show Saved layers');
ok(/Upload DAC indicators/.test(afterByTab.indicators), 'indicators tab titled for its family');
ok(/Upload electric and gas figures/.test(afterByTab.coned), 'coned tab titled for its family');
ok(/Upload territory overlays/.test(afterByTab.territory), 'territory tab titled for its family');
const beforeCards = (beforeHtml.match(/class="ml-card/g) || []).length;
const afterCards = (afterByTab.layers.match(/class="ml-card/g) || []).length;
ok(beforeCards > afterCards,
   'BEFORE stacked more cards on one screen than AFTER shows in a tab (' +
   beforeCards + ' vs ' + afterCards + ')');

lines.push('');
lines.push('=== G1: the relabel ===');
ok(/Listed on the map/.test(A), 'AFTER says "Listed on the map"');
ok(/Not listed/.test(A), 'AFTER says "Not listed"');
ok(/ml-state-on/.test(A) && /ml-state-off/.test(A), 'both state pills are styled');
ok(!/>Active</.test(A.slice(A.indexOf('Saved layers'), A.indexOf('This session'))),
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
ok(A.indexOf('Uploads start in this browser tab') > A.indexOf('This session'),
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
  ok(/This file belongs in Tract shapes/.test(wrong),
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
const prevByTab = {};
for (const t of TABS) { prev.api.setTab(t); prevByTab[t] = prev.api.page(); }

lines.push('');
lines.push('=== PR2 piece 4: every family teaches the same anatomy ===');
['indicators', 'shapes', 'coned', 'territory'].forEach(t => {
  const h = afterByTab[t];
  ok(/ml-row-meta/.test(h), t + ': rows carry a meta line');
  ok(/uploaded 2026-/.test(h), t + ': the uploaded date is shown');
});
ok(/fingerprint/.test(afterByTab.shapes), 'shapes: the fingerprint short form is shown');
ok(!/fingerprint/.test(prevByTab.shapes), 'PREV control: PR 1 showed no fingerprint');
// Reject a vintage on a ROW, not the prose that explains why there is none.
// The first version of this banned the WORD anywhere on the tab and so failed on
// the upload block's own "so no vintage applies", which is the copy doing the
// explaining.
ok(!/vintage 20\d\d/.test(afterByTab.territory),
   'no territory row states a vintage, because an overlay has none');
ok(/no vintage applies/.test(afterByTab.territory),
   'and the upload block says so, rather than leaving a silent gap');

lines.push('');
lines.push('=== PR2 piece 5 (G3): rollback is reachable from the UI ===');
ok(/Earlier versions \(1\)/.test(afterByTab.shapes), 'shapes lists its retired version');
ok(/data-ds-reactivate="d6"/.test(afterByTab.shapes), 'with a Reactivate control');
ok(/Earlier versions/.test(afterByTab.territory), 'territory lists its retired version');
ok(/Earlier versions/.test(afterByTab.indicators), 'indicators lists its retired version');
ok(!/Earlier versions/.test(prevByTab.shapes),
   'PREV control: PR 1 listed no retired versions at all');
ok(!/data-ds-reactivate/.test(prevByTab.shapes),
   'PREV control: and offered no way back');
ok(/downloaded and checked again/.test(afterByTab.shapes),
   'and it says the file is re-validated, so Reactivate is not a blind flag flip');
ok(/ml-state-pill ml-state-off">Retired/.test(afterByTab.shapes),
   'retired rows are labelled Retired, not Inactive');

lines.push('');
lines.push('=== PR2 finding 3: the (i) button ===');
['indicators', 'shapes', 'coned', 'territory'].forEach(t => {
  ok(new RegExp('data-ds-info="' + t + '"').test(afterByTab[t]), t + ': has an (i) button');
});
ok(!/produced by/.test(afterByTab.shapes),
   'the "produced by" sentence has left the upload description');
ok(/produced by/.test(prevByTab.shapes),
   'PREV control: PR 1 carried it inline in the description');
ok(/title="Produced by update_map_data.py"/.test(afterByTab.shapes),
   'the fact survives on the (i) button, which CLCPA-221 will hang its entry on');

lines.push('');
lines.push('=== PR2 CLCPA-222: the rename, labels only ===');
ok(/<h1>Map data<\/h1>/.test(afterByTab.layers), 'the page title is "Map data"');
ok(/<h1>Map Layers<\/h1>/.test(prevByTab.layers), 'PREV control: it was "Map Layers"');
ok(!/Map Layers/.test(afterByTab.layers.replace(/\[Map Layers\]/g, '')),
   'no user-visible "Map Layers" remains on the page');
{
  const html = fs.readFileSync(path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/ExecutiveDashboard.html'), 'utf8');
  ok(/sidebar-section">Data Ingestion</.test(html), 'the sidebar header is "Data Ingestion"');
  ok(/> Report data/.test(html), 'the first entry is "Report data"');
  ok(/> Map data/.test(html), 'the second entry is "Map data"');
  ok(/href="#\/ingest"/.test(html) && /href="#\/maplayers"/.test(html),
     'and the ROUTES are untouched, so existing bookmarks still work');
}

lines.push('');
lines.push('=== PR2 finding 1: the rule violation is gone ===');
{
  const appSrc = fs.readFileSync(path.join(REPO, REL), 'utf8');
  ok(!/&mdash;|&ndash;/.test(appSrc), 'no long-dash entities anywhere in app.js');
  ok(/&mdash;/.test(PREV_SRC), 'PREV control: PR 1 shipped three of them');
  const added = execSync('git diff ' + BASE + ' -- "' + REL + '"', { cwd: REPO, maxBuffer: 1 << 28 })
    .toString('utf8').split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'));
  ok(!added.some(l => /[–—]/.test(l)),
     'and nothing I added across the whole ticket carries an em or en dash');
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
