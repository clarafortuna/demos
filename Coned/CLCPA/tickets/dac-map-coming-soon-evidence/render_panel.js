/* Render the Customer Counts panel from the SHIPPED renderMapKPI, on both
 * builds, and hand the HTML to the browser leg.
 *
 * WHY THIS EXISTS, stated plainly. The DAC map cannot paint in this sandbox:
 * ExecutiveDashboard.html loads Leaflet and Turf from unpkg.com, there is no
 * network here and no vendored copy, so window.L is undefined, renderDACMap
 * never builds the map, and renderMapKPI -- which the map calls -- never
 * runs. Measured: the panel element exists at 288px wide and stays empty for
 * 60 seconds with zero leaflet panes.
 *
 * So the panel is driven directly instead: the app's OWN function, the app's
 * OWN map_payload.json (2,333 real tract features), and the HTML it produces.
 * Nothing about the panel is simulated -- only Leaflet's absence is worked
 * around, and the figures below are the real ones. The browser leg then
 * paints that HTML under the app's own stylesheet, which is where the layout
 * question actually lives.
 *
 * The rendered map itself remains the owner's hosted pass.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const BASE = process.env.DAC_BASE_COMMIT || 'facc1bc';
const CRLF = String.fromCharCode(13) + String.fromCharCode(10);

const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { cwd: ROOT, maxBuffer: 1e9 })
  .toString('utf8').replace(new RegExp(String.fromCharCode(92) + 'r?' +
    String.fromCharCode(92) + 'n', 'g'), CRLF);
const GEO = JSON.parse(fs.readFileSync(path.join(DEV, 'map_payload.json'), 'utf8'));
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const CATALOG = JSON.parse(fs.readFileSync(
  path.join(DEV, 'Data/out/nyserda_dac_v1_0.json'), 'utf8'));

function renderWith(src) {
  const L = src.split(CRLF);
  const TOP = [];
  L.forEach((ln, n) => {
    const m = /^ {2}(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (nm) => {
    const k = TOP.findIndex(d => d.name === nm);
    return k >= 0 ? L.slice(TOP[k].line, bound[k + 1]).join('\n') : null;
  };
  const parts = [], have = new Set();
  const add = (n) => {
    if (have.has(n)) return false;
    const f = find(n); if (!f) return false;
    have.add(n); parts.push(f); return true;
  };
  ['renderMapKPI'].forEach(add);
  let api = null, captured = null;
  for (let r = 0; r < 600; r++) {
    try {
      if (!api) {
        /* the ONE thing stubbed: the element the panel writes into, so its
         * innerHTML can be read. Everything else is the shipped code. */
        const panel = { innerHTML: '' };
        const doc = {
          getElementById: (id) => (id === 'dac-map-kpi' ? panel : null),
          querySelector: () => null, querySelectorAll: () => [],
          createElement: () => ({ style: {}, classList: { add() {}, remove() {} },
            appendChild() {}, addEventListener() {}, setAttribute() {} }),
        };
        /* THE REAL INDICATOR CATALOG, not the empty default.
         *
         * _indCatalog is hydrated from a dataset at runtime, so an assembled
         * slice starts with the empty one -- and indIsDAC then reads no
         * dacFlag role and classifies EVERY tract as non-DAC. The first run
         * of this script reported DAC 0 and Non-DAC 3.97M, which is not the
         * panel anybody sees. Loading the shipped catalog fixes it: it
         * classifies 1,059 of the 2,333 tracts as DAC, which is what puts
         * the real figures below. */
        api = new Function('PAYLOAD', 'GEO', 'document', 'PANEL', 'CATALOG',
          'const state = { payload: PAYLOAD };\n' +
          'const window = { L: undefined };\n' +
          parts.join('\n\n') +
          '\n;if (typeof _indCatalog !== "undefined") _indCatalog = CATALOG;' +
          '\n;return { renderMapKPI: renderMapKPI };')(P, GEO, doc, panel, CATALOG);
        captured = panel;
      }
      api.renderMapKPI(GEO);
      return captured.innerHTML;
    } catch (e) {
      const m = /(\w+) is not defined/.exec(String(e && e.message));
      if (m && add(m[1])) { api = null; continue; }
      throw new Error('cannot assemble renderMapKPI: ' + (e && e.message));
    }
  }
  throw new Error('assembly did not converge');
}

module.exports = { renderWith: renderWith, SRC: SRC, BASE_SRC: BASE_SRC };

/* run as a script, it writes the two evidence files; required as a module it
 * hands the renderer over so a suite can render from the build under test
 * rather than from a file on disk -- mutation 1 proved that a block reading
 * the files could not be turned red by any change to app.js. */
if (require.main !== module) return;

const now = renderWith(SRC);
const was = renderWith(BASE_SRC);
fs.writeFileSync(path.join(__dirname, 'panel-after.html'), now);
fs.writeFileSync(path.join(__dirname, 'panel-before.html'), was);

const figures = (s) => (String(s).replace(/<[^>]*>/g, ' ').match(/\d+(?:\.\d+)?[KM]/g) || []);
const cards = (s) => (String(s).match(/class="dac-kpi-card[^"]*"/g) || []);

console.log('BEFORE  cards: ' + cards(was).length);
cards(was).forEach(c => console.log('    ' + c));
console.log('BEFORE  "Coming soon" present: ' + /Coming soon/i.test(was));
console.log('BEFORE  figures: ' + JSON.stringify(figures(was)));
console.log('');
console.log('AFTER   cards: ' + cards(now).length);
cards(now).forEach(c => console.log('    ' + c));
console.log('AFTER   "Coming soon" present: ' + /Coming soon/i.test(now));
console.log('AFTER   figures: ' + JSON.stringify(figures(now)));
console.log('');
console.log('figures identical: ' + (JSON.stringify(figures(was)) === JSON.stringify(figures(now))));
console.log('written: panel-before.html, panel-after.html');
