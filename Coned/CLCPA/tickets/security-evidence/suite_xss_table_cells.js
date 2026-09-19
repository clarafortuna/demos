/* security -- the report table body cell.
 *
 * Part of the combined XSS + OData remediation. This suite FAILS against the
 * vulnerable implementation and PASSES against the remediated one; mut_security.js
 * drives both directions so the pass is never mistaken for a vacuous one.
 */
/* SECURITY REGRESSION -- stored XSS through report table cells.
 *
 * THE CHAIN, as traced in the _dev canonical source at acbd12c:
 *
 *   Report Data editor cell          app.js:23858
 *     state.ingest.draft[r][c] = (c === 0) ? e.target.value
 *                                          : parseNumericInput(e.target.value)
 *     -- column 0 stores the raw string; parseNumericInput returns the RAW
 *        trimmed string for anything non-finite, so EVERY column accepts text.
 *        ↓  Storage.saveTable  ->  cr2bf_rows (Memo)
 *   composePayloadFromRows           app.js:15874
 *     t.data[y] = JSON.parse(x.cr2bf_rows)      -- no sanitisation
 *        ↓
 *   formatCell                       app.js:4364, string passthrough at 4366
 *     if (typeof c === 'string') return c;      -- returned verbatim
 *        ↓
 *   renderTable body cell            app.js:4517
 *     return `<td${numCls}>${formatCell(cv, i, row[0])}</td>`;   -- NOT escaped
 *        ↓
 *   renderCurrentView                view.innerHTML = html
 *
 * WHAT THIS SUITE PROVES, and what it does not.
 *
 * It drives the SHIPPED renderTable -- extracted from app.js by the same
 * auto-resolving dependency reader the other suites use, so there is no
 * hand-built copy to drift. It then sets the emitted HTML on the _kit DOM's
 * innerHTML, which is the real sink, and asks whether attacker text became an
 * ELEMENT or stayed TEXT.
 *
 * No browser runs here, so no script executes and nothing is "exploited". The
 * assertion is structural and it is the right one: a value that materialises
 * as an element node with an event-handler attribute is, in a browser,
 * executable. That is the whole of the defect.
 *
 * A6/A7 are the CONTROL. The header path of the SAME function escapes
 * correctly (app.js:4390). If the suite ever reports the header unescaped, the
 * harness is lying and every other assertion here is void.
 *
 * NOTHING IS EXECUTED, FETCHED OR WRITTEN. The payload sets a sentinel that no
 * code in this process defines or reads; src=x is a relative token the fake DOM
 * never resolves; there is no alert, no remote URL, no Dataverse call.
 *
 * EXPECTED TODAY (vulnerable):  A1-A5 FAIL, A6-A8 pass.
 * EXPECTED ONCE REMEDIATED:     all pass, unchanged.
 */
'use strict';

/* capture what we print, so the committed output file matches the console */
const _lines = [];
{ const _log = console.log; console.log = function () {
    const s = Array.prototype.join.call(arguments, ' ');
    _lines.push(s); _log.apply(console, arguments); }; }


const fs = require('fs');
const path = require('path');

/* ---- portable root resolution (see Phase 3 report, section D) ------------
 * No absolute path anywhere. DAC_REPO wins, then an upward search for the
 * marker that identifies this repository, then a relative guess. */
function findRepoRoot(start) {
  let d = start;
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(d, 'Coned', 'CLCPA', 'ExecutiveDashboard_dev', 'app.js'))) return d;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return null;
}
const REPO = process.env.DAC_REPO || findRepoRoot(__dirname) ||
  path.resolve(__dirname, '..', 'demos');
const APP = process.env.DAC_APP_OVERRIDE ||
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const KIT = process.env.DAC_KIT ||
  path.join(REPO, 'Coned/CLCPA/tickets/_kit/live_page.js');

const SRC = fs.readFileSync(APP, 'utf8');
const EOL = SRC.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const { makeDocument } = require(KIT);

/* ---- house result contract ---------------------------------------------- */
let pass = 0, fail = 0;
const lines = [];
const log = (s) => { lines.push(s); };
const ok = (cond, msg) => {
  if (cond) { pass++; log('  ok   ' + msg); }
  else { fail++; log('  FAIL ' + msg); }
};

/* ---- the shipped renderer, extracted with its real dependencies ---------- */
function api(src, want) {
  const L = src.split(EOL);
  const TOP = [];
  L.forEach((ln, n) => {
    const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (n) => {
    const k = TOP.findIndex(d => d.name === n);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n');
  };
  const parts = [], have = new Set(), added = [];
  const add = (n) => {
    if (have.has(n)) return false;
    const f = find(n);
    if (!f) return false;
    have.add(n); parts.push(f); added.push(n); return true;
  };
  want.forEach(add);
  const make = () => new Function(
    'const state={payload:{tables:{}},year:"2025"};' +
    parts.join('\n\n') + '\nreturn {' + want.join(',') + '};')();
  return {
    run(fn) {
      for (let r = 0; r < 800; r++) {
        try { return fn(make()); }
        catch (e) {
          const m = /(\w+) is not defined/.exec(e.message);
          if (m && add(m[1])) continue;
          throw e;
        }
      }
      throw new Error('dependency resolution did not converge');
    },
    deps: added,
  };
}

/* ---- the sentinel -------------------------------------------------------
 * Inert everywhere: no alert, no remote URL, no exfiltration. It only sets a
 * variable that nothing in this process defines or reads. */
const SENT = '__DAC_XSS_SENTINEL__';
const PAYLOAD = '<img src=x onerror="window.' + SENT + '=1">';
const TAGGED = '<x-dac-probe data-sentinel="' + SENT + '"></x-dac-probe>';

const A = api(SRC, ['renderTable']);
/* Warm the resolver once so the dependency list below is the real one. */
A.run((M) => M.renderTable([['h'], ['x']], { tableId: 'A1' }));

log('======================================================================');
log('SECURITY -- stored XSS through report table cells (renderTable)');
log('source: ' + path.relative(REPO, APP).replace(/\\/g, '/'));
log('shipped dependencies pulled in: ' + A.deps.length + '  [' + A.deps.join(', ') + ']');
log('======================================================================');

/* ================================================================== A1-A3
 * The ROW LABEL (column 0) -- free text in the editor by construction. */
log('');
log('A. the row label (column 0) is free text in the editor');

const htmlLabel = A.run((M) => M.renderTable(
  [['Program', 'Amount'], [PAYLOAD, 1]], { tableId: 'A1' }));

ok(htmlLabel.indexOf(PAYLOAD) < 0,
  'A1 the raw payload does NOT survive verbatim into the emitted HTML');
ok(htmlLabel.indexOf('&lt;img') >= 0,
  'A2 the payload appears HTML-escaped (&lt;img) in the emitted HTML');

{
  const { document } = makeDocument();
  const host = document.createElement('div');
  host.innerHTML = htmlLabel;
  const imgs = host.querySelectorAll('img');
  ok(imgs.length === 0,
    'A3 no <img> ELEMENT materialises in the DOM from a row label (found ' + imgs.length + ')');
}

/* ================================================================== A4-A5
 * A NON-LABEL column. parseNumericInput returns the raw trimmed string for
 * any non-finite input, so text reaches value columns too. */
log('');
log('B. a value column -- parseNumericInput passes non-numeric text through');

const htmlValue = A.run((M) => M.renderTable(
  [['Program', 'Notes'], ['Clean Heat', TAGGED]], { tableId: 'A1' }));

ok(htmlValue.indexOf(TAGGED) < 0,
  'A4 the raw payload does NOT survive verbatim from a value column');

{
  const { document } = makeDocument();
  const host = document.createElement('div');
  host.innerHTML = htmlValue;
  const probes = host.querySelectorAll('x-dac-probe');
  ok(probes.length === 0,
    'A5 no injected ELEMENT materialises from a value column (found ' + probes.length + ')');
}

/* ================================================================== A6-A7
 * CONTROL. The header path of the SAME function escapes (app.js:4390).
 * If these fail, the harness is wrong and A1-A5 mean nothing. */
log('');
log('C. control -- the header path of the same function already escapes');

const htmlHeader = A.run((M) => M.renderTable(
  [[PAYLOAD, 'Amount'], ['Clean Heat', 1]], { tableId: 'A1' }));

ok(htmlHeader.indexOf(PAYLOAD) < 0 && htmlHeader.indexOf('&lt;img') >= 0,
  'A6 CONTROL a header cell IS escaped -- the harness can tell the two apart');

{
  const { document } = makeDocument();
  const host = document.createElement('div');
  host.innerHTML = htmlHeader;
  ok(host.querySelectorAll('img').length === 0,
    'A7 CONTROL no <img> element materialises from a header cell');
}

/* ================================================================== A8
 * The benign path must be untouched by any future fix: ordinary text and
 * numbers keep rendering exactly as they do now. */
log('');
log('D. the benign path is unchanged (guards the future fix)');

const htmlPlain = A.run((M) => M.renderTable(
  [['Program', 'Amount'], ['Clean Heat - Residential ASHP', 78690616]], { tableId: 'A1' }));

{
  const { document } = makeDocument();
  const host = document.createElement('div');
  host.innerHTML = htmlPlain;
  const tds = host.querySelectorAll('td');
  const label = tds.length ? tds[0].textContent : '';
  ok(label === 'Clean Heat - Residential ASHP',
    'A8 an ordinary label still renders as its exact text');
}

/* ---- report ------------------------------------------------------------- */
log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');

const text = lines.join('\n') + '\n';
process.stdout.write(text);
if (process.env.DAC_OUT) fs.writeFileSync(process.env.DAC_OUT, text);
/* ---- committed run output -------------------------------------------------
 * Written beside the suite, as every other ticket directory does, so a reader
 * can see the result without running anything. DAC_OUT redirects it, which is
 * how the portable harness keeps test output out of the source tree. */
try {
  const _outPath = process.env.DAC_OUT ||
    require('path').join(__dirname, 'xss-table-cells-output.txt');
  require('fs').writeFileSync(_outPath, _lines.join('\n') + '\n');
} catch (e) { /* a read-only checkout must not fail the suite */ }

process.exit(fail ? 1 : 0);
