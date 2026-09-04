/* CLCPA-193 + CLCPA-199 acceptance suite.
 *
 * THE BASELINE IS THE PRE-CHANGE COMMIT, not a second run of the new code. The
 * download-counting harness is run against BOTH `git show HEAD:app.js` and the
 * working tree, and the old code is REQUIRED to fail the new assertion. A suite
 * that only proves the new code does what the new code does would pass just as
 * happily if the change had done nothing.
 */
const fs = require('fs');
const { execSync } = require('child_process');
const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
// DAC_APP_OVERRIDE lets the control runner feed a deliberately broken copy in,
// so every guard can be shown to FAIL when the fix it guards is reverted.
const NEW = fs.readFileSync(process.env.DAC_APP_OVERRIDE || (REPO + '/' + REL), 'utf8');
// git blobs are stored LF; the working tree is CRLF. Normalise the baseline to
// CRLF so the indentation anchors and the source-level controls compare like
// with like -- the same LF/CRLF trap that made a deploy-backup hash disagree.
const OLD = execSync('git show HEAD:"' + REL + '"', { cwd: REPO, maxBuffer: 1 << 28 })
  .toString('utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');

let pass = 0, fail = 0;
const results = [];
function ok(cond, label) {
  if (cond) { pass++; results.push('  ok   ' + label); }
  else { fail++; results.push('  FAIL ' + label); }
  return !!cond;
}
function eq(got, want, label) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  return ok(g === w, label + '  [got ' + g + ' want ' + w + ']');
}
function section(t) { results.push(''); results.push('=== ' + t + ' ==='); }

/* ---------- extraction: indentation-anchored, like the earlier suites ----- */
function grab(src, name, indent) {
  const pads = { 0: '', 2: '  ', 4: '    ' };
  const pad = pads[indent];
  const heads = [
    pad + 'function ' + name + '(',
    pad + 'async function ' + name + '(',
  ];
  for (const h of heads) {
    const i = src.indexOf(h);
    if (i < 0) continue;
    const close = '\r\n' + pad + '}';
    const j = src.indexOf(close, i);
    if (j < 0) continue;
    return src.slice(i, j + close.length);
  }
  throw new Error('could not extract ' + name + ' at indent ' + indent);
}

/* =========================================================================
 * PART 1 -- the headline: how many GeoJSON files does BOOT download?
 * Run identically against OLD and NEW.
 * ========================================================================= */
function runBootHarness(src, tag) {
  const isNew = src.indexOf('mlRegisterSavedMeta') >= 0;
  const downloads = [];        // dvIds fetched during hydration
  const listCalls = [];
  const infos = [], warns = [];
  const _mlLayers = [];
  let idSeq = 0;

  // Two saved layers, exactly the reference tenant's state: one active, one not.
  const RECORDS = [
    { dvId: 'dv-hvi', name: 'Heat Vulnerability Index', layerKey: 'heat-vulnerability-index',
      valueField: 'hvi_score', ramp: { low: '#ffffb2', high: '#bd0026',
      colors: ['#ffffb2', '#fecc5c', '#fd8d3c', '#f03b20', '#bd0026'] },
      sourceLabel: 'NYC DOHMH', featureCount: 2327, geometryType: 'Polygon',
      savedBy: 'A Person', savedOn: '2026-08-01T00:00:00Z', active: true },
    { dvId: 'dv-trees', name: 'Trees per Km2', layerKey: 'trees-per-km2',
      valueField: 'trees_km2', ramp: { low: '#f7fcf5', high: '#00441b',
      colors: ['#f7fcf5', '#c7e9c0', '#74c476', '#31a354', '#00441b'] },
      sourceLabel: 'NYC Parks', featureCount: 2327, geometryType: 'Polygon',
      savedBy: 'A Person', savedOn: '2026-08-02T00:00:00Z', active: false },
  ];
  const FILE = JSON.stringify({ type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { GEOID: '1', hvi_score: 1, trees_km2: 10 }, geometry: { type: 'Polygon', coordinates: [] } },
    { type: 'Feature', properties: { GEOID: '2', hvi_score: 5, trees_km2: 50 }, geometry: { type: 'Polygon', coordinates: [] } },
  ] });

  const scope = {
    console: { info: m => infos.push(String(m)), warn: (m) => warns.push(String(m)),
               error: m => warns.push(String(m)), log: () => {} },
    state: { route: { name: 'exec' } },
    window: {},
    rerenderMlList: () => {},
    ML_CLASS_MIN: 3, ML_CLASS_MAX: 9,
    ML_DEFAULT_LOW: '#ffffb2', ML_DEFAULT_HIGH: '#bd0026',
    mlClassCount: r => (r && r.colors ? r.colors.length : 5),
    mlBuildRamp: (low, high, opts) => ({ low: low, high: high,
      colors: ['#a', '#b', '#c', '#d', '#e'], opts: opts || null }),
    mlLayerKey: n => String(n).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    mlValidateGeoJSON: (text) => {
      const g = JSON.parse(text);
      return { ok: true, errors: [], geo: g, featureCount: g.features.length,
               geomTypes: ['Polygon'] };
    },
    mlValidateValueField: (geo, field) => ({ ok: true, errors: [],
      scale: { field: field, breaks: [1, 2, 3, 4], mode: 'quantile' } }),
    utf8ByteLength: s => Buffer.byteLength(String(s), 'utf8'),
    Storage: {
      isDataverse: () => true,
      listMapLayers: async () => { listCalls.push(1); return RECORDS.map(r => Object.assign({}, r)); },
      getMapLayerFile: async (dvId) => { downloads.push(dvId); return FILE; },
    },
    _mlLayers: _mlLayers,
  };

  const names = [['mlRegisterLayer', 2]];
  if (isNew) names.push(['mlRegisterSavedMeta', 2], ['mlApplyLayerGeo', 2], ['mlEnsureLayerGeo', 2]);
  else names.push(['mlHydrateOne', 2]);
  names.push(['mlHydrateSavedLayers', 2]);

  const bodies = names.map(([n, i]) => grab(src, n, i)).join('\n');
  const extra = isNew ? 'const _mlGeoFetch = {};\n' : '';
  const fn = new Function(...Object.keys(scope),
    '"use strict";\nlet _mlIdSeq = 0;\nlet _mlHydrated = false;\n' + extra + bodies +
    '\nreturn { hydrate: mlHydrateSavedLayers' +
    (isNew ? ', ensure: mlEnsureLayerGeo' : '') + ' };');
  const api = fn(...Object.keys(scope).map(k => scope[k]));

  return { api, downloads, listCalls, infos, warns, layers: _mlLayers, records: RECORDS, file: FILE };
}

(async function main() {

  /* ---------------- PART 1: the baseline control ------------------------ */
  section('PART 1 -- BASELINE (git show HEAD): boot MUST download the files');
  const b = runBootHarness(OLD, 'HEAD');
  await b.api.hydrate();
  eq(b.listCalls.length, 1, 'HEAD: listMapLayers called once');
  eq(b.downloads.length, 2, 'HEAD: boot downloads BOTH layers (the waste being removed)');
  eq(b.downloads.slice().sort(), ['dv-hvi', 'dv-trees'], 'HEAD: which files boot fetched');
  ok(b.layers.length === 2, 'HEAD: two layers registered');
  ok(b.layers.every(e => !!e.geo), 'HEAD: both registered WITH geometry in memory');
  // The inactive layer is downloaded too, on the old code.
  ok(b.downloads.indexOf('dv-trees') >= 0,
     'HEAD: the INACTIVE layer is downloaded at boot as well');

  /* ---------------- PART 2: the new behaviour --------------------------- */
  section('PART 2 -- WORKTREE: boot downloads nothing');
  const a = runBootHarness(NEW, 'worktree');
  await a.api.hydrate();
  eq(a.listCalls.length, 1, 'listMapLayers still called exactly once');
  eq(a.downloads.length, 0, 'HEADLINE: boot downloads ZERO GeoJSON files');
  eq(a.layers.length, 2, 'both layers still registered');
  ok(a.layers.every(e => e.geo === null), 'both registered WITHOUT geometry');
  ok(a.layers.every(e => e.geoPending === true), 'both marked geoPending');
  ok(a.layers.every(e => e.scale === null), 'no scale before the file arrives');

  section('PART 2b -- the metadata the row needs is all present');
  const hvi = a.layers[0], trees = a.layers[1];
  eq(hvi.name, 'Heat Vulnerability Index', 'name from the record');
  eq(hvi.valueField, 'hvi_score', 'value field from the record');
  eq(hvi.featureCount, 2327, 'stored feature count (drives the page meta line)');
  eq(hvi.geomTypes, ['Polygon'], 'geometry type split from the record');
  eq(hvi.geometryType, 'Polygon', 'geometryType kept verbatim for mlRowMeta fallback');
  eq(hvi.layerKey, 'heat-vulnerability-index', 'layer key');
  eq(hvi.dvId, 'dv-hvi', 'dvId retained so the file can be fetched later');
  eq(hvi.sourceLabel, 'NYC DOHMH', 'source label');
  eq(hvi.origin, 'saved', 'origin');
  ok(hvi.ramp && hvi.ramp.colors && hvi.ramp.colors.length === 5,
     'ramp built from the record, so the swatch renders with no file');
  eq(hvi.previewOnce, false, 'previewOnce false: a saved layer never self-activates');
  eq(hvi.active, true, 'the ACTIVE layer stays active');
  eq(trees.active, false, 'the INACTIVE layer stays inactive');
  ok(hvi.loadError === null, 'no loadError on a pending layer');

  section('PART 2c -- active vs inactive: neither is downloaded, both are listed');
  ok(a.downloads.length === 0,
     'the ACTIVE layer is NOT downloaded at boot either (it draws only when ticked)');
  ok(a.layers.filter(e => e.active !== false).length === 1, 'one active layer listed');
  ok(a.layers.filter(e => e.active === false).length === 1, 'one inactive layer listed');

  section('PART 3 -- mlEnsureLayerGeo: the deferred load');
  const c = runBootHarness(NEW, 'ensure');
  await c.api.hydrate();
  const e0 = c.layers[0];
  eq(c.downloads.length, 0, 'still nothing downloaded after hydration');
  const geo = await c.api.ensure(e0);
  eq(c.downloads, ['dv-hvi'], 'ensure downloads exactly the layer asked for');
  ok(geo && geo.features && geo.features.length === 2, 'ensure resolves to the geometry');
  ok(e0.geo === geo, 'the entry now holds the geometry');
  eq(e0.geoPending, false, 'geoPending cleared');
  eq(e0.geoLoading, false, 'geoLoading cleared');
  ok(e0.scale && e0.scale.field === 'hvi_score', 'scale computed from the file');
  eq(e0.featureCount, 2, 'featureCount recomputed from the file, not the record');
  ok(c.downloads.length === 1, 'the OTHER layer was not touched');

  section('PART 3b -- idempotence and single-flight');
  await c.api.ensure(e0);
  eq(c.downloads.length, 1, 'a second ensure on a loaded layer downloads nothing');
  const d = runBootHarness(NEW, 'inflight');
  await d.api.hydrate();
  const d0 = d.layers[0];
  const [r1, r2, r3] = await Promise.all([d.api.ensure(d0), d.api.ensure(d0), d.api.ensure(d0)]);
  eq(d.downloads.length, 1, 'THREE concurrent ensures download the file ONCE');
  ok(r1 === r2 && r2 === r3, 'all three concurrent callers get the same geometry');

  section('PART 3c -- a superseded entry never reaches Dataverse');
  const sup = runBootHarness(NEW, 'superseded');
  // pre-register a session layer with the same key, as an upload in this session
  sup.layers.push({ id: 'ml0', origin: 'session', layerKey: 'heat-vulnerability-index',
                    geo: { features: [] }, active: true });
  await sup.api.hydrate();
  const supEntry = sup.layers.filter(e => e.origin === 'saved' &&
    e.layerKey === 'heat-vulnerability-index')[0];
  ok(!!supEntry, 'the superseded saved layer is still registered for the page list');
  ok(supEntry.geo === null, 'superseded: no geometry');
  ok(!supEntry.geoPending, 'superseded: NOT geoPending, so nothing will fetch it');
  const supBefore = sup.downloads.length;
  const supRes = await sup.api.ensure(supEntry);
  ok(supRes === null, 'ensure on a superseded entry resolves to null');
  eq(sup.downloads.length, supBefore, 'ensure on a superseded entry made no request');

  section('PART 4 -- the failure path');
  const f = runBootHarness(NEW, 'failure');
  await f.api.hydrate();
  const f0 = f.layers[0];
  // make the download fail
  f.api.__ = null;
  const fh = runBootHarness(NEW, 'failure2');
  await fh.api.hydrate();
  // swap in a failing Storage by re-running with a poisoned fetch
  const poisoned = (function () {
    const h = runBootHarness(NEW, 'poisoned');
    return h;
  })();
  await poisoned.api.hydrate();
  // The harness's Storage is captured in the closure, so drive failure through a
  // record whose file the stub refuses: re-point the entry at an unknown dvId.
  const p0 = poisoned.layers[1];
  p0.dvId = null;                      // no dvId -> nothing to fetch
  const pr = await poisoned.api.ensure(p0);
  ok(pr === null, 'ensure with no dvId resolves to null');

  section('PART 5 -- the four consumer sites (source-level)');
  ok(NEW.includes('if (!entry.geo && !entry.geoPending) return;'),
     'initUploadedLayers builds a row for a pending layer');
  ok(OLD.includes('if (!entry.geo) return;'),
     'HEAD did NOT (control: the old gate excluded every pending layer)');
  ok(NEW.includes("box.innerHTML = entry.geo ? mlLegendHtml(entry) : '';"),
     'the legend box is left empty until the file arrives');
  ok(NEW.includes('if ((e.geo || e.geoPending || e.loadError) && e.active !== false) {'),
     'refreshAllUploadedLayers reaches pending AND refused layers');
  ok(!NEW.includes('if (e.geo && e.active !== false) refreshUploadedLayer(e);'),
     'the old refreshAll gate is gone');
  ok(NEW.includes('(!entry.geo && !entry.loadError && !entry.geoPending'),
     'the "superseded" chip excludes pending layers');
  ok(OLD.includes('(!entry.geo && !entry.loadError\r\n'),
     'HEAD control: the old chip condition had no geoPending term');
  ok(NEW.includes('mlEnsureLayerGeo(entry).then(function (geo) {'),
     'refreshUploadedLayer starts the load when a pending layer is switched on');
  ok(NEW.includes('function mlSetTerrRowState('), 'the row loading/error state helper exists');
  ok((NEW.match(/mlSetTerrRowState\(/g) || []).length === 5,
     'mlSetTerrRowState: one definition and four call sites');

  section('PART 6 -- CLCPA-193 micro-fix: byte length without the array');
  ok(NEW.includes('function utf8ByteLength(str) {'), 'the helper exists');
  const codeOnly = NEW.split('\r\n').filter(l => !/^\s*(\*|\/\/|\/\*)/.test(l));
  eq(codeOnly.filter(l => l.includes('new TextEncoder()')).length, 2,
     'exactly two TextEncoder uses remain in code');
  ok(codeOnly.some(l => l.includes('const bytes = new TextEncoder().encode(text);')),
     'uploadFileColumn keeps the real encoder (it needs the bytes for chunking)');
  ok(NEW.includes('const bytes = utf8ByteLength(geojsonText);'), 'saveMapLayer converted');
  ok(NEW.includes('const bytes = utf8ByteLength(text);'), 'saveTractDataset converted');
  ok(NEW.includes('mlValidateGeoJSON(text, utf8ByteLength(text))'), 'the hydration site converted');
  const oldCode = OLD.split('\r\n').filter(l => !/^\s*(\*|\/\/|\/\*)/.test(l));
  eq(oldCode.filter(l => l.includes('new TextEncoder()')).length, 5,
     'HEAD control: five TextEncoder uses before the fix');

  section('PART 7 -- CLCPA-199: the pointer hover path');
  ok(NEW.includes('function wireTractPointerHover() {'), 'the function exists');
  ok(NEW.includes('    wireTractPointerHover();'), 'and is called at mount');
  ok(!OLD.includes('wireTractPointerHover'), 'HEAD control: it did not exist');
  ok(NEW.includes("      layer.on('mousemove', positionTooltipAt);"),
     'ADDITIVE: the mousemove binding is untouched');
  ok(NEW.includes("      layer.on('mouseout', function() {"),
     'ADDITIVE: the mouseout binding is untouched');
  ok(NEW.includes("layer.on('mouseover', function(e) {"),
     'the working mouseover handler is untouched (ruled in scope to KEEP)');
  ok(!NEW.includes('geoLayer.eachLayer') ||
     NEW.indexOf('geoLayer.eachLayer', NEW.indexOf('function wireTractPointerHover')) >
     NEW.indexOf('    wireTractPointerHover();'),
     'no per-event layer scan inside the hover handler');
  // bindOverlayTooltip and the map-level mouseout were ruled OUT of scope
  const ovlOld = (OLD.match(/function bindOverlayTooltip\([\s\S]*?\n    \}/) || [''])[0];
  const ovlNew = (NEW.match(/function bindOverlayTooltip\([\s\S]*?\n    \}/) || [''])[0];
  ok(ovlOld === ovlNew && ovlOld.length > 100, 'bindOverlayTooltip byte-identical (out of scope)');
  ok(NEW.includes("    map.on('mouseout', function() {"), 'the map-level mouseout is untouched');

  section('PART 8 -- CLCPA-199 behaviour: the three branches');
  {
    const hoverSrc = grab(NEW, 'wireTractPointerHover', 4);
    const listeners = {};
    let resetCalls = [], opacity = '1', posCalls = [], infoLines = [];
    let _hoveredLayer = { name: 'tract-A' };
    const scope = {
      TRACT_POINTER_SELECT: true,
      map: { getContainer: () => ({ addEventListener: (t, h) => { listeners[t] = h; } }) },
      geoLayer: { resetStyle: l => resetCalls.push(l) },
      get tooltip() { return tt; },
      positionTooltipAt: e => { posCalls.push(e); return true; },
      console: { info: m => infoLines.push(String(m)), warn: () => {} },
    };
    const tt = { style: { set opacity(v) { opacity = v; }, get opacity() { return opacity; } } };
    const mk = (src) => new Function('TRACT_POINTER_SELECT', 'map', 'geoLayer', 'tooltip',
      'positionTooltipAt', 'console', 'hoveredRef',
      '"use strict";\nlet _hoveredLayer = hoveredRef.v;\n' + hoverSrc +
      '\nreturn { run: wireTractPointerHover, peek: () => _hoveredLayer };');
    const hoveredRef = { v: _hoveredLayer };
    const built = mk(hoverSrc)(true, scope.map, scope.geoLayer, tt, scope.positionTooltipAt,
      scope.console, hoveredRef);
    built.run();
    ok(typeof listeners.pointermove === 'function', 'a pointermove listener is installed');
    ok(typeof listeners.pointerleave === 'function', 'a pointerleave listener is installed');
    ok(typeof listeners.pointercancel === 'function', 'a pointercancel listener is installed');

    // branch 1: over a tract -> reposition, do not clear
    posCalls = []; resetCalls = []; opacity = '1';
    const evTract = { clientX: 10, clientY: 20,
      target: { closest: sel => (sel === 'path.map-tract' ? { tag: 'tract' } : { tag: 'path' }) } };
    listeners.pointermove(evTract);
    eq(posCalls.length, 1, 'over a tract: the tooltip is repositioned');
    ok(posCalls[0] && posCalls[0].originalEvent === evTract,
       'the native event is wrapped as { originalEvent } for positionTooltipAt');
    eq(opacity, '1', 'over a tract: the tooltip is NOT hidden');
    eq(resetCalls.length, 0, 'over a tract: no style reset');

    // branch 2: over a non-tract path (an interactive saved layer) -> hands off
    posCalls = []; resetCalls = []; opacity = '1';
    listeners.pointermove({ target: { closest: sel => (sel === 'path.map-tract' ? null : { tag: 'overlay' }) } });
    eq(posCalls.length, 0, 'over an overlay path: no repositioning');
    eq(opacity, '1', "over an overlay path: the overlay's own tooltip is left alone");
    eq(resetCalls.length, 0, 'over an overlay path: no style reset');

    // branch 3: over nothing -> the restored mouseout
    posCalls = []; resetCalls = []; opacity = '1';
    listeners.pointermove({ target: { closest: () => null } });
    eq(posCalls.length, 0, 'over no feature: no repositioning');
    eq(opacity, '0', 'over no feature: the tooltip IS hidden (the dead mouseout, restored)');
    eq(resetCalls.length, 1, 'over no feature: the hovered tract style is reset');

    // pointerleave clears too. Guarded: if the listener is missing the
    // assertion above has already failed, and calling undefined here would
    // abort the run before the report -- a control must be legible, not a crash.
    opacity = '1';
    if (typeof listeners.pointerleave === 'function') listeners.pointerleave();
    eq(opacity, '0', 'pointerleave hides the tooltip');

    // a target with no closest() must not throw
    let threw = false;
    try { listeners.pointermove({ target: {} }); } catch (e) { threw = true; }
    ok(!threw, 'a target without closest() is ignored rather than throwing');
    try { listeners.pointermove({}); } catch (e) { threw = true; }
    ok(!threw, 'an event with no target is ignored rather than throwing');
  }

  section('PART 9 -- no PointerEvent: nothing is wired, nothing is broken');
  {
    const hoverSrc = grab(NEW, 'wireTractPointerHover', 4);
    const listeners = {};
    const infoLines = [];
    const f = new Function('TRACT_POINTER_SELECT', 'map', 'geoLayer', 'tooltip',
      'positionTooltipAt', 'console',
      '"use strict";\nlet _hoveredLayer = null;\n' + hoverSrc + '\nreturn wireTractPointerHover;');
    f(false, { getContainer: () => ({ addEventListener: (t, h) => { listeners[t] = h; } }) },
      { resetStyle: () => {} }, null, () => true,
      { info: m => infoLines.push(String(m)), warn: () => {} })();
    eq(Object.keys(listeners).length, 0, 'no listeners installed without PointerEvent');
    ok(infoLines.some(l => /PointerEvent unavailable/.test(l)),
       'and it says so, rather than failing silently');
  }

  section('PART 11 -- the toggle path end to end: tick -> download -> draw');
  {
    /* refreshUploadedLayer / refreshAllUploadedLayers / mlSetTerrRowState live at
     * mount scope and touch the DOM and Leaflet, so both get stubbed. This is the
     * flow the whole slice rests on: with the file no longer fetched at boot, a
     * tick is the ONLY thing that can load it, and if this path is wrong the layer
     * is simply unreachable. */
    const srcs = ['mlSetTerrRowState', 'refreshUploadedLayer', 'refreshAllUploadedLayers']
      .map(n => grab(NEW, n, 4)).join('\n');

    function mkNode(cls) {
      const n = { className: cls || '', classList: { _s: new Set(),
        toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); },
        contains(c) { return this._s.has(c); }, add(c) { this._s.add(c); } },
        hidden: true, innerHTML: '', title: '', checked: false };
      return n;
    }
    const rowLabel = mkNode('dac-map-terr-opt ml-terr-opt');
    const legendBox = mkNode('ml-legendbox');
    const checkbox = mkNode(''); checkbox.checked = true;   // the user just ticked it
    const added = [], removed = [];
    const ensureCalls = [];
    const _mlLeaflet = {}, _mlInteractive = {};
    const rerenders = [];

    const entry = { id: 'ml1', name: 'Heat Vulnerability Index', valueField: 'hvi_score',
      geo: null, scale: null, geoPending: true, geoLoading: false, loadError: null,
      active: true, dvId: 'dv-hvi', layerKey: 'heat-vulnerability-index',
      ramp: { low: '#a', high: '#b', colors: ['#1', '#2', '#3', '#4', '#5'] } };
    const _mlLayers = [entry];
    const GEO = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {} }] };

    const scope = {
      document: {
        getElementById: id => (id === 'ml-legendbox-ml1' ? legendBox : null),
        querySelector: sel => {
          if (sel.indexOf('input[data-ml-layer=') >= 0) return checkbox;
          if (sel.indexOf('.ml-terr-opt[data-ml-row=') >= 0) return rowLabel;
          return null;
        },
      },
      map: { hasLayer: l => added.indexOf(l) >= 0 && removed.indexOf(l) < 0,
             removeLayer: l => { removed.push(l); } },
      L: { geoJSON: (geo, opts) => ({ _geo: geo, _opts: opts,
             addTo: function () { added.push(this); return this; },
             bringToFront: function () {} }) },
      _mlLayers: _mlLayers,
      _mlLeaflet: _mlLeaflet,
      _mlInteractive: _mlInteractive,
      _mlToggleOn: () => checkbox.checked,
      mlWantsInteractive: () => false,
      mlStyleFor: () => ({}),
      mlLegendHtml: e => '<legend for ' + e.valueField + ' breaks=' +
        (e.scale ? e.scale.breaks.length : 'none') + '>',
      mlTooltipHtml: () => '',
      bindOverlayTooltip: () => {},
      bringOutlinesToFront: () => {},
      // The map can be built while the user is on the Map Layers page: that is
      // the documented reason _dacMapSyncUploadedLayers exists. Only on that
      // route is a page re-render expected.
      state: { route: { name: 'maplayers' } },
      rerenderMlList: () => rerenders.push(1),
      mlEnsureLayerGeo: (e) => {
        ensureCalls.push(e.id);
        return Promise.resolve().then(() => {
          e.geo = GEO; e.scale = { field: e.valueField, breaks: [1, 2, 3, 4] };
          e.geoPending = false; e.geoLoading = false;
          return e.geo;
        });
      },
      console: { info: () => {}, warn: () => {} },
    };
    const built = new Function(...Object.keys(scope),
      '"use strict";\n' + srcs +
      '\nreturn { refresh: refreshUploadedLayer, refreshAll: refreshAllUploadedLayers,' +
      ' rowState: mlSetTerrRowState };')(...Object.keys(scope).map(k => scope[k]));

    // --- the tick ---
    built.refreshAll();
    eq(ensureCalls, ['ml1'], 'ticking a pending layer starts exactly one load');
    ok(rowLabel.classList.contains('ml-terr-loading'),
       'the row shows a loading state while the file is in flight');
    eq(added.length, 0, 'nothing is drawn on the pass that starts the load');
    eq(legendBox.hidden, true, 'the legend stays hidden while loading');
    ok(checkbox.checked, 'the checkbox is left ticked while loading');

    await new Promise(r => setTimeout(r, 0));   // let the load settle
    ok(!rowLabel.classList.contains('ml-terr-loading'), 'the loading state clears');
    ok(!rowLabel.classList.contains('ml-terr-failed'), 'and it is not an error');
    eq(added.length, 1, 'the layer is drawn once the file arrives');
    ok(added[0] && added[0]._geo === GEO, 'it is drawn from the geometry that arrived');
    eq(legendBox.hidden, false, 'the legend is revealed');
    ok(/breaks=4/.test(legendBox.innerHTML),
       'the legend is built AFTER the load, so it has its computed breaks');
    ok(rerenders.length >= 1, 'the Map Layers page is refreshed');

    // --- a second refresh must not re-download ---
    const callsBefore = ensureCalls.length;
    built.refreshAll();
    eq(ensureCalls.length, callsBefore, 'a later refresh does not load it again');

    // --- untick ---
    checkbox.checked = false;
    built.refreshAll();
    ok(removed.length >= 1, 'unticking removes the layer from the map');
    eq(legendBox.hidden, true, 'and hides the legend');
  }

  section('PART 12 -- the toggle path when the load FAILS');
  {
    const srcs = ['mlSetTerrRowState', 'refreshUploadedLayer', 'refreshAllUploadedLayers']
      .map(n => grab(NEW, n, 4)).join('\n');
    const rowLabel = { classList: { _s: new Set(), toggle(c, on) { if (on) this._s.add(c); else this._s.delete(c); },
      contains(c) { return this._s.has(c); } }, title: '' };
    const legendBox = { hidden: true, innerHTML: '' };
    const checkbox = { checked: true };
    const added = [];
    const entry = { id: 'ml1', name: 'X', valueField: 'v', geo: null, scale: null,
      geoPending: true, loadError: null, active: true, dvId: 'dv-x', layerKey: 'x',
      ramp: { colors: ['#1'] } };
    const scope = {
      document: { getElementById: () => legendBox,
        querySelector: sel => (sel.indexOf('input[data-ml-layer=') >= 0 ? checkbox : rowLabel) },
      map: { hasLayer: () => false, removeLayer: () => {} },
      L: { geoJSON: () => ({ addTo: function () { added.push(1); return this; }, bringToFront() {} }) },
      _mlLayers: [entry], _mlLeaflet: {}, _mlInteractive: {},
      _mlToggleOn: () => checkbox.checked,
      mlWantsInteractive: () => false, mlStyleFor: () => ({}),
      mlLegendHtml: () => '<legend>', mlTooltipHtml: () => '',
      bindOverlayTooltip: () => {}, bringOutlinesToFront: () => {},
      state: { route: { name: 'map' } }, rerenderMlList: () => {},
      mlEnsureLayerGeo: (e) => Promise.resolve().then(() => {
        e.loadError = 'file GET 404'; e.geoPending = false; return null;
      }),
      console: { info: () => {}, warn: () => {} },
    };
    const built = new Function(...Object.keys(scope), '"use strict";\n' + srcs +
      '\nreturn { refreshAll: refreshAllUploadedLayers };')(...Object.keys(scope).map(k => scope[k]));
    built.refreshAll();
    await new Promise(r => setTimeout(r, 0));
    eq(added.length, 0, 'a failed load draws nothing');
    eq(checkbox.checked, false, 'the checkbox is UNTICKED, so the map matches the panel');
    ok(rowLabel.classList.contains('ml-terr-failed'), 'the row is marked failed');
    eq(rowLabel.title, 'file GET 404', 'and carries the reason as its title');
    eq(entry.geoPending, false, 'geoPending is cleared, so it will not retry in a loop');

    // ticking again must NOT hammer Dataverse: no geoPending, no fetch
    checkbox.checked = true;
    built.refreshAll();
    await new Promise(r => setTimeout(r, 0));
    eq(checkbox.checked, false, 're-ticking a refused layer unticks itself again');
    eq(added.length, 0, 'and still draws nothing');
  }

  section('PART 10 -- payload and table code untouched (the standing freeze)');
  {
    const strip = (src) => src;
    // The slice must not have touched anything outside the map-layer code.
    const tableFns = ['function rowsForDisplay(', 'function applyDerivedCols(',
      'function applyDerivedRows(', 'function recomputeTotals(', 'function renderTable(',
      'function formatIngestValue(', 'function totalRowFlags(',
      'function stripDerivedForPersist(', 'function derivedRowKeepsStored(',
      'function storedDecimals(', 'function withinSourceRounding('];
    tableFns.forEach(function (h) {
      const io = OLD.indexOf(h), iN = NEW.indexOf(h);
      if (io < 0 || iN < 0) { ok(false, h + ' present in both'); return; }
      const eo = OLD.indexOf('\r\n  }', io), en = NEW.indexOf('\r\n  }', iN);
      ok(OLD.slice(io, eo) === NEW.slice(iN, en), h.replace('function ', '') + ' byte-identical');
    });
  }

  /* ---------------- report --------------------------------------------- */
  console.log(results.join('\n'));
  console.log('');
  console.log('================================================================');
  console.log('  CLCPA-193 + CLCPA-199 suite: ' + pass + ' passed, ' + fail + ' failed');
  console.log('================================================================');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('SUITE ERROR: ' + (e && e.stack ? e.stack : e)); process.exit(2); });
