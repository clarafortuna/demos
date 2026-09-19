/* CLCPA security regression -- the indicators dataset.key charset guard.
 *
 * WHY THIS IS A SEPARATE SUITE FROM THE ENCODING ONE. They defend different
 * things and either can regress without the other noticing:
 *
 *   suite_odata_encoding  the value cannot escape its literal OR its query
 *                         parameter, whatever it contains.
 *   this suite            a key that could never round-trip is refused at the
 *                         door, so it is not stored as an identifier either.
 *
 * SCOPE, and it is narrower than it first appears. Four dataset families reach
 * saveTractDataset, and three of them pin ds.key to a constant:
 *
 *     if (ds.key !== DS_GEOMETRY_KEY)  ...   geometry
 *     if (ds.key !== DS_CONED_KEY)     ...   coned
 *     if (ds.key !== DS_TERRITORY_KEY) ...   territories
 *
 * Only INDICATORS accepts whatever `doc.dataset.key` an uploaded manifest
 * carries -- dsSummary takes `key: ds.key || ''` verbatim, and the only other
 * constraint before it reaches a $filter is .slice(0, 100) at write time. So
 * dsValidateDoc, the indicators validator, is where the door is, and that is
 * the single place this guard belongs.
 *
 * THE RULE IS NOT INVENTED. It is the charset mlLayerKey already enforces for
 * saved map layers, which is why a legitimate key has never needed anything
 * outside it -- asserted below against every dataset manifest in the repository.
 *
 * FAILS against the vulnerable implementation (no guard), PASSES against the
 * remediated one.
 */
'use strict';

/* capture what we print, so the committed output file matches the console */
const _lines = [];
{ const _log = console.log; console.log = function () {
    const s = Array.prototype.join.call(arguments, ' ');
    _lines.push(s); _log.apply(console, arguments); }; }

const fs = require('fs');
const path = require('path');

/* Repo root by asking the filesystem, never by being told. Works from any
 * checkout, any OS, and in a CI runner. */
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

console.log('======================================================================');
console.log('CLCPA security regression -- indicators dataset.key validation');
console.log('source: ' + path.relative(REPO, APP).replace(/\\/g, '/'));
console.log('======================================================================');

/* ============================================================== A. the guard
 * Read the rule OUT OF THE SHIPPED SOURCE rather than restating it here. A
 * retyped copy of the rule under test is how a suite comes back agreeing with
 * itself. */
console.log('');
console.log('A. the guard exists in dsValidateDoc and is readable');

const guardRe = /if\s*\(\s*!\s*(\/\^\[[^/]+\/)\s*\.test\(\s*dsKey\s*\)\s*\)/;
const m = guardRe.exec(SRC);
ok(!!m, 'A1 a charset test on dsKey is present in the source');

let RULE = null;
if (m) {
  try { RULE = eval(m[1]); } catch (e) { /* reported by A2 */ }
}
ok(RULE instanceof RegExp, 'A2 and it is a literal regular expression this suite can drive');
if (RULE) console.log('       rule as shipped: ' + String(RULE));

ok(/const dsKey\s*=\s*\(doc\.dataset && doc\.dataset\.key\)/.test(SRC),
  'A3 the value tested is doc.dataset.key, the field the manifest carries');

/* The guard must sit in the INDICATORS validator, after the kind refusal --
 * before it, a territories file would be rejected for the wrong reason. */
const vIdx = SRC.indexOf('function dsValidateDoc');
const kIdx = SRC.indexOf("card for its own family.');");
const gIdx = SRC.indexOf('.test(dsKey)');
ok(vIdx >= 0 && gIdx > vIdx, 'A4 the guard is inside dsValidateDoc');
ok(kIdx >= 0 && gIdx > kIdx,
  'A5 and AFTER the kind refusal, so a file of another family is still refused for its own reason');

/* ======================================================== B. what it accepts
 * Every dataset key that exists in this repository must pass, or the guard
 * would refuse legitimate work. */
console.log('');
console.log('B. every real dataset key in the repository is accepted');

const OUT_DIR = path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/Data/out');
let realKeys = [];
try {
  realKeys = fs.readdirSync(OUT_DIR).filter(f => /\.json$/.test(f)).map(f => {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'));
      return j && j.dataset && j.dataset.key ? j.dataset.key : null;
    } catch (e) { return null; }
  }).filter(Boolean);
} catch (e) { /* reported below */ }
realKeys = [...new Set(realKeys)];

if (!realKeys.length) {
  ok(false, 'B0 dataset manifests were found and read (none found under Data/out)');
} else {
  console.log('       keys found: ' + realKeys.join(', '));
  realKeys.forEach(k => ok(RULE ? RULE.test(k) : false,
    'B: the shipped key ' + JSON.stringify(k) + ' is accepted'));
}

/* ======================================================== C. what it refuses
 * Each of these would otherwise become a stored identifier AND a $filter
 * value. The percent form is the one the quote-doubling alone cannot stop. */
console.log('');
console.log('C. hostile and malformed keys are refused');

const REFUSE = [
  ["x' or cr2bf_isactive eq true or ''='", 'direct quote -- OData literal breakout attempt'],
  ['x%27 or cr2bf_isactive eq false or %27', 'PERCENT-ENCODED quote -- survives quote-doubling'],
  ['x&$top=1', 'ampersand -- would start a new query parameter'],
  ['x#frag', 'hash -- would truncate the filter'],
  ['x+y', 'plus -- would decode to a space'],
  ['x%2527', 'double-encoded percent'],
  ['x y', 'space'],
  ['UPPER', 'upper case -- outside the layer charset'],
  ['has-hyphen', 'hyphen -- outside the layer charset'],
  ['', 'empty'],
  ['a'.repeat(101), '101 characters -- over the stored column slice'],
];
REFUSE.forEach(([k, why]) => ok(RULE ? !RULE.test(k) : false,
  'C: refused -- ' + why));

/* ============================================================== D. boundaries */
console.log('');
console.log('D. boundaries');
ok(RULE ? RULE.test('a') : false, 'D1 one character is accepted');
ok(RULE ? RULE.test('a'.repeat(100)) : false, 'D2 exactly 100 characters is accepted');
ok(RULE ? !RULE.test('a'.repeat(101)) : false, 'D3 101 is not');
ok(RULE ? RULE.test('nyserda_dac_v2_0') : false, 'D4 digits and underscores are accepted');

/* ===================================================== E. the other families
 * Not a style note: it is why this guard belongs in ONE validator and not four. */
console.log('');
console.log('E. the other three families pin their key to a constant');
[['DS_GEOMETRY_KEY', 'geometry'], ['DS_CONED_KEY', 'coned'], ['DS_TERRITORY_KEY', 'territories']]
  .forEach(([c, fam]) => ok(SRC.indexOf('ds.key !== ' + c) >= 0,
    'E: the ' + fam + ' family compares ds.key against ' + c));

console.log('');
console.log('======================================================================');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
console.log('======================================================================');

/* ---- committed run output ---- */
try {
  const _outPath = process.env.DAC_OUT || path.join(__dirname, 'dataset-key-output.txt');
  fs.writeFileSync(_outPath, _lines.join('\n') + '\n');
} catch (e) { /* a read-only checkout must not fail the suite */ }

process.exit(fail ? 1 : 0);
