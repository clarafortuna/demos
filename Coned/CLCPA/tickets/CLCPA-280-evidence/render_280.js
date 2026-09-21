/* The five Data Sources family tabs, produced by a build's OWN renderDsDictView.
 *
 * WHY THE PAGE IS NOT DRIVEN IN THE BROWSER FOR THIS ONE, and it is a
 * limitation, not a preference. The family tab row is gated:
 * renderMlTabs() returns '' when Storage.isDataverse() is false, and the
 * backend is chosen from a real Xrm context. On localhost the app runs on
 * localStorage, so Map Data shows only the Map Layers tab and the other four
 * family entries are unreachable by clicking. MEASURED, not assumed: driving
 * the real page in Chrome reaches Data Sources through the real button and
 * then finds no [data-ds-dict-go] element at all.
 *
 * So each build's own renderDsDictView is extracted and run with
 * Storage.isDataverse() forced true -- the one stub -- and repro_280.js paints
 * the result in Chrome under the app's real stylesheet and measures it. The
 * markup, the strings and the CSS are the app's own. This is the same
 * arrangement CLCPA-221 used to render these tabs in the first place.
 *
 * The extractor below is CLCPA-221's, unchanged in behaviour: its comments
 * record two real defects (an indentation-blind grab that swallowed unrelated
 * functions, and a declaration scan that stopped at the first parsable prefix)
 * and both fixes are load-bearing here too.
 */
const fs = require('fs');
const path = require('path');

const TABS = ['layers', 'indicators', 'shapes', 'coned', 'territory'];

function makeRenderer(src, label) {
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
    mlSaveStatusText: () => 'Working',
    mlSwatchStyle: () => '',
    mlRowMeta: () => '',
    dsRecIsIndicators: (r) => r.datasetKey === 'nyserda_dac',
    dsRecIsGeometry: (r) => r.datasetKey === 'tract_geometry',
    dsRecIsConed: (r) => r.datasetKey === 'coned_operational',
    dsRecIsTerritories: (r) => r.datasetKey === 'service_territories',
    dsSourceChip: () => '<span class="ml-chip">dataset</span>',
    _dsRecordsLoaded: true,
    confirm: () => true,
    _mlLayers: [],
    mlSavedLayers: () => [],
    mlSessionLayers: () => [],
    dsRecords: () => [],
    dsState: () => ({ rec: null, coverage: null }),
    dsGeometry: () => ({ rec: null }),
    dsConed: () => ({ rec: null }),
    dsTerritoryRec: () => null,
    _territorySource: 'dataverse',
    dsHelpDrawerHtml: () => '',
    renderMlRequirementsDrawer: () => '',
    renderDsHelpDrawer: () => '',
  };

  const WANT = ['renderMapLayersPage', 'renderDsDictView', 'renderDsSessionBox',
                'dsDictClose', 'dsDictGo', 'renderMlTabs',
                'renderDsSkeleton', 'renderMlNote', 'renderMlSessionList',
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
      const code = b
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .split(/\r?\n/).filter(l => !/^\s*\/\//.test(l)).join('\n');
      for (const m of code.matchAll(/\b((?:ds|ml|render|wire|init)[A-Za-z0-9_]*)\s*\(/g)) {
        if (m[1] !== n) queue.push(m[1]);
      }
      for (const c of new Set(code.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || [])) queue.push(c);
      for (const v of new Set(code.match(/\b_[a-zA-Z][A-Za-z0-9_]*\b/g) || [])) queue.push(v);
      continue;
    }
    const d = grabDecl(n);
    if (d) { decls.set(n, { text: d, at: src.indexOf(d) }); continue; }
    missing.add(n);
  }
  const keys = Object.keys(scope);
  const body = '"use strict";\nconst state = { mapLayers: null, route: { name: "maplayers" } };\n' +
    [...decls.values()].sort((a, b) => a.at - b.at).map(d => d.text).join('\n') +
    '\n' + [...bodies.values()].join('\n') +
    '\nlet _redraws = 0;\nfunction rerenderMapLayersPage() { _redraws++; }\n' +
    '\nreturn { page: renderMapLayersPage, ' +
    'dict: (entry, from) => { const d = initMapLayersState(); d.dict = true; ' +
    'd.dictEntry = entry; d.dictReturnTab = from || "layers"; }, ' +
    'dsDict: () => DS_DICT, ' +
    'redraws: () => _redraws };';
  let api;
  try { api = new Function(...keys, body)(...keys.map(k => scope[k])); }
  catch (e) {
    const dump = path.join(__dirname, 'assembled-' + (label || 'x') + '.js');
    fs.writeFileSync(dump, body);
    return { error: e.message, missing: [...missing], dump: dump };
  }
  return { api, missing: [...missing], resolved: bodies.size };
}

/** one build in, the five family tab pages out. Throws rather than returning a
 * half-built object: a renderer that failed to assemble must not read as an
 * empty page that happens to contain no placeholders. */
function pagesFor(src, label) {
  const R = makeRenderer(src, label);
  if (R.error) {
    throw new Error('render_280: the ' + (label || '') + ' renderer did not assemble: ' +
      R.error + ' (dump: ' + R.dump + ')');
  }
  const out = {};
  TABS.forEach((t) => { R.api.dict(t, 'layers'); out[t] = R.api.page(); });
  return out;
}

module.exports = { makeRenderer, pagesFor, TABS };
