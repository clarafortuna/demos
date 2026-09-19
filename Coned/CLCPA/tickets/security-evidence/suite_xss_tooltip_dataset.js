/* security -- the dataset -> innerHTML tooltip reads.
 *
 * Part of the combined XSS + OData remediation. This suite FAILS against the
 * vulnerable implementation and PASSES against the remediated one; mut_security.js
 * drives both directions so the pass is never mistaken for a vacuous one.
 */
/* SECURITY REGRESSION -- the dataset -> innerHTML tooltip sinks.
 *
 * THE DEFECT SHAPE. A payload-derived name is written into a data-* attribute
 * and read back with element.dataset.*, which returns the DECODED value. The
 * tooltip then concatenates it straight into innerHTML:
 *
 *   write  app.js:13118   data-name="${cat.name}"
 *   read   app.js:14949   '<div class="e-tt-name">' + row.dataset.name + '</div>'
 *
 * Escaping the WRITE side alone does not fix this: the browser undoes it on the
 * way out. Both sides are required, for different reasons --
 *   write side  stops the value closing the attribute,
 *   read  side  stops the decoded value being parsed as markup.
 *
 * ---------------------------------------------------------------------------
 * A LIMITATION OF _kit/live_page.js THAT THIS SUITE WORKS AROUND, DELIBERATELY.
 *
 * The kit's dataset getter returns the RAW stored attribute text:
 *     Object.keys(n._attrs) ... d[key] = n._attrs[k]          live_page.js:214-222
 * and its parser performs no entity decoding. Measured:
 *     innerHTML '<div data-name="&lt;img src=x&gt;">'
 *       -> dataset.name === '&lt;img src=x&gt;'   (a browser gives '<img src=x>')
 *
 * So driving this defect through the kit would report the VULNERABLE code as
 * safe -- a false negative. This suite therefore supplies the browser's
 * decoding step explicitly, in decodeEntities() below, and says so rather than
 * pretending the kit modelled it. The kit is still used for the final
 * does-it-become-an-element check, which it does model correctly.
 * ---------------------------------------------------------------------------
 *
 * EXPECTED against the repository baseline : B1-B3 FAIL, controls pass.
 * EXPECTED against the scratch-remediated  : all pass.
 */
'use strict';

/* capture what we print, so the committed output file matches the console */
const _lines = [];
{ const _log = console.log; console.log = function () {
    const s = Array.prototype.join.call(arguments, ' ');
    _lines.push(s); _log.apply(console, arguments); }; }


const fs = require('fs');
const path = require('path');

function findRepoRoot(start) {
  let d = start;
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(d, 'Coned', 'CLCPA', 'ExecutiveDashboard_dev', 'app.js'))) return d;
    const up = path.dirname(d); if (up === d) break; d = up;
  }
  return null;
}
const REPO = process.env.DAC_REPO || findRepoRoot(__dirname);
if (!REPO) { console.error('ABORT: repo root not found; set DAC_REPO'); process.exit(1); }
const APP = process.env.DAC_APP_OVERRIDE ||
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const KIT = process.env.DAC_KIT || path.join(REPO, 'Coned/CLCPA/tickets/_kit/live_page.js');

const SRC = fs.readFileSync(APP, 'utf8');
const EOL = SRC.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const L = SRC.split(EOL);
const { makeDocument } = require(KIT);

let pass = 0, fail = 0;
const log = (s) => console.log(s);
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };

/* What a browser's dataset getter does and the kit does not. Minimal on
 * purpose: only the entities escapeHtml produces. */
const decodeEntities = (s) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&');           // last, so &amp;lt; -> &lt; not <

/* The shipped escapeHtml, pulled from the source under test. */
function shippedEscapeHtml() {
  const i = L.findIndex(l => /^  function escapeHtml\(/.test(l));
  if (i < 0) { console.error('ABORT: escapeHtml not found'); process.exit(1); }
  const body = L.slice(i, i + 6).join('\n');
  return new Function(body + '\nreturn escapeHtml;')();
}
const escapeHtml = shippedEscapeHtml();

const SENT = '__DAC_XSS_SENTINEL__';
const PAYLOAD = '<img src=x onerror="window.' + SENT + '=1">';

/* The three shipped read sites, located by CONTENT not by line number.
 *
 * Line numbers were brittle and it showed: between acbd12c and c98ccb1 the
 * concurrent workstream shifted all three by +32, and the suite then failed
 * for the wrong reason -- "that line does not say what I expected" rather than
 * "that site does not escape". Anchoring on the emitted class name makes the
 * assertion survive any revision that does not change the sink itself. */
const SITES = [
  { name: 'Section E category tooltip', varName: 'row',   cls: 'e-tt-name' },
  { name: 'Section F borough tooltip',  varName: 'b',     cls: 'f-tt-name' },
  { name: 'Section H pie tooltip',      varName: 'slice', cls: 'h-pie-tt-name' },
].map((s) => {
  const anchor = '<div class="' + s.cls + '">';
  const idx = L.findIndex(l => l.indexOf(anchor) >= 0 && l.indexOf('.dataset.name') >= 0);
  return Object.assign({}, s, { line: idx >= 0 ? idx + 1 : -1 });
});

log('======================================================================');
log('SECURITY -- dataset -> innerHTML tooltip sinks');
log('source: ' + path.relative(REPO, APP).replace(/\\/g, '/'));
log('NOTE: browser entity-decoding is supplied by this suite; see the header.');
log('======================================================================');

/* ================================================================= B1-B3
 * STATIC: does each shipped read site escape? Exact, and the thing that
 * actually regresses if someone edits these lines later. */
log('');
log('A. the shipped read sites must escape what dataset.* hands back');

SITES.forEach((s, i) => {
  if (s.line < 0) {
    ok(false, 'B' + (i + 1) + ' ' + s.name + ' -- SINK NOT FOUND by anchor "' + s.cls +
      '". Either it was removed (re-scope this suite) or renamed (re-anchor it).');
    return;
  }
  const line = L[s.line - 1];
  const raw = new RegExp('\\+\\s*' + s.varName + '\\.dataset\\.name\\s*\\+');
  const safe = new RegExp('escapeHtml\\(\\s*' + s.varName + '\\.dataset\\.name\\s*\\)');
  ok(!raw.test(line) && safe.test(line),
    'B' + (i + 1) + ' ' + s.name + ' (found at L' + s.line + ') escapes dataset.name');
});

/* ================================================================= B4-B5
 * SEMANTIC: prove the principle, with the browser's decode supplied. */
log('');
log('B. semantics -- an escaped attribute is NOT safe once dataset decodes it');

{
  const attrValue = escapeHtml(PAYLOAD);          // what the write side stores
  const decoded = decodeEntities(attrValue);      // what a browser's dataset returns
  ok(decoded === PAYLOAD,
    'B4 dataset decoding restores the original payload (write-side escaping alone is undone)');

  const vulnerable = '<div class="e-tt-name">' + decoded + '</div>';
  const remediated = '<div class="e-tt-name">' + escapeHtml(decoded) + '</div>';

  const { document } = makeDocument();
  const a = document.createElement('div'); a.innerHTML = vulnerable;
  const b = document.createElement('div'); b.innerHTML = remediated;
  ok(a.querySelectorAll('img').length === 1 && b.querySelectorAll('img').length === 0,
    'B5 CONTROL unescaped decoded value becomes an <img> element; escaped does not');
}

/* ================================================================= B6
 * The benign path must survive: a normal borough name still reads correctly. */
log('');
log('C. benign values are unchanged');
{
  const name = 'Westchester';
  const roundTrip = decodeEntities(escapeHtml(name));
  ok(roundTrip === name, 'B6 an ordinary name survives write+read unchanged');
  const amp = 'Electric & Gas';
  ok(decodeEntities(escapeHtml(amp)) === amp, 'B7 a name containing & survives unchanged');
}

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
/* ---- committed run output -------------------------------------------------
 * Written beside the suite, as every other ticket directory does, so a reader
 * can see the result without running anything. DAC_OUT redirects it, which is
 * how the portable harness keeps test output out of the source tree. */
try {
  const _outPath = process.env.DAC_OUT ||
    require('path').join(__dirname, 'xss-tooltip-dataset-output.txt');
  require('fs').writeFileSync(_outPath, _lines.join('\n') + '\n');
} catch (e) { /* a read-only checkout must not fail the suite */ }

process.exit(fail ? 1 : 0);
