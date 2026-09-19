/* CLCPA security regression -- the payload-derived label sinks in the section
 * renderers.
 *
 * WHY THIS SUITE EXISTS AT ALL, and it is not a duplicate of the table-cell one.
 *
 * The mutation runner found the gap: reverting
 *     data-name="${escapeHtml(b.name)}"  ->  data-name="${b.name}"
 * broke nothing. suite_xss_table_cells drives renderTable; the tooltip suite
 * drives the READ side. Neither touches the section renderers, so a borough or
 * category name could quietly go back to being emitted raw.
 *
 * THIS IS ALSO THE SUITE THAT COMPENSATES FOR THE CENSUS BLIND SPOT.
 * The per-ticket provenance census reads functions with grabFn, which tries
 * indents of 2, 4 and 0 and returns null otherwise -- and null !== null is
 * false, so a function it cannot read registers as UNCHANGED. Measured on this
 * codebase, 49 functions are invisible that way, including every renderSection*
 * and the wire*Tooltips family. Those are exactly the functions these sinks
 * live in. Provenance will not notice them moving; this suite will.
 *
 * METHOD. Source-shape assertions, deliberately. Driving renderSectionF end to
 * end would need most of the payload, the year state and the chart helpers, and
 * would test the fixture more than the sink. What must hold is narrow and
 * checkable: no payload-derived label reaches HTML unescaped.
 *
 * WHAT IS DELIBERATELY NOT ASSERTED. Literal-only interpolations stay
 * untouched and must keep passing -- Section D/G/J labels, the tornado
 * metric/source, the F3 tile labels and both href sinks all interpolate string
 * constants, and escaping them would be churn with no security value. Section
 * C below pins that, so a future "escape everything" sweep is caught too.
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
const SRC = fs.readFileSync(APP, 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const count = (needle) => SRC.split(needle).length - 1;

console.log('======================================================================');
console.log('CLCPA security regression -- payload-derived label sinks');
console.log('source: ' + path.relative(REPO, APP).replace(/\\/g, '/'));
console.log('======================================================================');

/* ================================================== A. the unsafe shapes are gone
 * Each of these traces to r[0] / row[0] of a report table, which the Report
 * Data editor writes as free text. The expected counts are the measured ones. */
console.log('');
console.log('A. no payload-derived label is interpolated raw');

const UNSAFE = [
  ['data-name="${b.name}"',                          'borough name, attribute (F3, H1 card, H1 pie)'],
  ['data-name="${cat.name}"',                        'E1 category, attribute'],
  ['<div class="f3-borough-name">${b.name}</div>',    'borough name, text'],
  ['<div class="e-yoy-label">${cat.name}</div>',      'E1 category, text'],
  ['<div class="c2-prog-info-name">${p.name}</div>',  'C2 program name, text'],
  ['</span>${b.name}',                               'H1 legend, text'],
];
UNSAFE.forEach(([shape, why]) => ok(count(shape) === 0,
  'A: raw ' + why + ' -- ' + (count(shape) === 0 ? 'absent' : 'PRESENT x' + count(shape))));

/* ================================================== B. the safe shapes are present
 * The counterpart: absence alone would also be satisfied by deleting the sink,
 * so the escaped form must be there in the measured multiplicity. */
console.log('');
console.log('B. each one is present in its escaped form');

const SAFE = [
  ['data-name="${escapeHtml(b.name)}"',                          3, 'borough name, attribute x3'],
  ['data-name="${escapeHtml(cat.name)}"',                        1, 'E1 category, attribute'],
  ['<div class="f3-borough-name">${escapeHtml(b.name)}</div>',    2, 'borough name, text x2'],
  ['<div class="e-yoy-label">${escapeHtml(cat.name)}</div>',      1, 'E1 category, text'],
  ['<div class="c2-prog-info-name">${escapeHtml(p.name)}</div>',  1, 'C2 program name, text'],
  ['</span>${escapeHtml(b.name)}',                               1, 'H1 legend, text'],
];
SAFE.forEach(([shape, want, why]) => {
  const n = count(shape);
  ok(n === want, 'B: ' + why + ' -- found ' + n + ', want ' + want);
});

/* ================================================== C. the lookup key is untouched
 * boroughColors is keyed on the RAW name. Escaping the key would look tidy and
 * would silently break the palette, so it is pinned here. */
console.log('');
console.log('C. the palette lookup key is deliberately NOT escaped');
ok(count('background:${boroughColors[b.name]}') === 1,
  'C1 boroughColors[b.name] is still keyed on the raw name');
ok(count('boroughColors[escapeHtml(b.name)]') === 0,
  'C2 and nothing escaped it into a lookup miss');

/* ================================================== D. literal-only sinks stay as they are
 * Not laziness: escaping a string constant is churn, and a sweep that did it
 * everywhere would hide which sinks actually carry untrusted data. */
console.log('');
console.log('D. literal-only interpolations are left alone');
const LITERAL_OK = [
  ['data-label="${label}"',        'Section B/D funding + metric labels (literals)'],
  ['data-metric="${row.metric}"',  'tornado metric (literal array)'],
  ['data-source="${row.source}"',  'tornado source (literal array)'],
  ['data-tt-label="${r.label}"',   'Section G borough label (BOROUGHS literal)'],
  ['data-label="${r.label}"',      'Section J row label (literals)'],
];
LITERAL_OK.forEach(([shape, why]) => ok(count(shape) >= 1,
  'D: still present, correctly unescaped -- ' + why));

/* ================================================== E. provenance compensation
 * State the relationship explicitly so a later reader does not have to rederive
 * it: these sinks live in functions the census cannot see. */
console.log('');
console.log('E. the functions these sinks live in, and what provenance sees');
const BLIND = ['renderSectionC', 'renderSectionE', 'renderSectionF', 'renderSectionH'];
BLIND.forEach(n => {
  const declared = new RegExp('^function ' + n + '\\s*\\(', 'm').test(SRC);
  ok(declared, 'E: ' + n + ' is declared at indent 0 -- grabFn returns null, so the census cannot see it');
});
console.log('       (that is why this suite asserts the sinks directly)');

console.log('');
console.log('======================================================================');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
console.log('======================================================================');

try {
  const _outPath = process.env.DAC_OUT || path.join(__dirname, 'label-sinks-output.txt');
  fs.writeFileSync(_outPath, _lines.join('\n') + '\n');
} catch (e) { /* a read-only checkout must not fail the suite */ }

process.exit(fail ? 1 : 0);
