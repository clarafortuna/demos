/* CLCPA-219 Phase 3: run the APP'S OWN upload validation over the clean-room
 * pipeline outputs.
 *
 * The point is not "does the file look plausible" -- it is whether the four
 * validators the dashboard actually gates uploads on would ACCEPT what the
 * package's guides just produced. The guides all end at "upload this from the
 * Map Layers admin card", and until now nothing checked that the file they
 * produce is one the card takes.
 *
 * Read-only: the validators are extracted from app.js and run against files on
 * disk. Nothing contacts Dataverse.
 */
const fs = require('fs');
const path = require('path');

const APP = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SIM = process.argv[2] ||
  'C:/Users/emely/AppData/Local/Temp/dacpkg/sim/coned-dac-dashboard-data-tools';
const src = fs.readFileSync(APP, 'utf8');

/* ---- extract, indentation-anchored (the pattern the earlier suites use) --- */
function grab(name, indent) {
  const pad = { 0: '', 2: '  ', 4: '    ' }[indent];
  for (const head of [pad + 'function ' + name + '(', pad + 'async function ' + name + '(']) {
    const i = src.indexOf(head);
    if (i < 0) continue;
    const close = '\r\n' + pad + '}';
    const j = src.indexOf(close, i);
    if (j >= 0) return src.slice(i, j + close.length);
  }
  throw new Error('could not extract ' + name);
}
function grabConst(name) {
  let i = -1;
  for (const pre of ['  const ', '  let ', 'const ', 'let ', '  var ', 'var ']) {
    i = src.indexOf(pre + name + ' =');
    if (i >= 0) break;
  }
  if (i < 0) throw new Error('no const ' + name);
  // terminate at the first line that parses as a complete statement
  for (let j = src.indexOf('\n', i); j > 0; j = src.indexOf('\n', j + 1)) {
    const chunk = src.slice(i, j);
    try { new Function('"use strict";' + chunk); return chunk; } catch (e) { /* keep going */ }
    if (j - i > 20000) break;
  }
  throw new Error('could not terminate const ' + name);
}

const VALIDATORS = [
  ['dsValidateDoc', 'the indicator dataset (guide 1)'],
  ['dsValidateGeometryDoc', 'the tract geometry dataset (guide 2)'],
  ['dsValidateConedDoc', 'the electric & gas dataset (guide 3)'],
  ['dsValidateTerritoryDoc', 'the service-territory overlay (guide 2)'],
];

let pass = 0, fail = 0;
const lines = [];
function report(label, res, file) {
  const okd = res && res.ok;
  if (okd) { pass++; lines.push('  ACCEPTED  ' + label); }
  else {
    fail++;
    lines.push('  REFUSED   ' + label);
    const errs = (res && res.errors) || ['(validator returned no errors array)'];
    errs.slice(0, 6).forEach(e => lines.push('              ' + e));
  }
  if (res && res.warnings && res.warnings.length) {
    res.warnings.slice(0, 4).forEach(w => lines.push('     warn:  ' + w));
  }
}

/* ---- the closure the validators need ------------------------------------ */
const scope = {
  DS_MIN_COVERAGE: 0.98,
  console: { warn: () => {}, info: () => {}, error: () => {}, log: () => {} },
};

/* Resolve dependencies TRANSITIVELY rather than guessing a helper list.
 *
 * The first version of this harness hardcoded seven helpers and every validator
 * threw `dsKindRefusal is not defined`. Guessing the closure is the wrong shape
 * of work: scan each extracted body for the identifiers it references, pull
 * those, and repeat until nothing new appears. A helper that cannot be found is
 * NAMED in the output, so a validator that could not be assembled is never
 * mistaken for one that passed.
 */
function buildRunner() {
  const wanted = VALIDATORS.map(([v]) => v);
  const bodies = new Map();      // name -> source
  const consts = new Map();
  const unresolved = new Set();
  const queue = wanted.slice();
  while (queue.length) {
    const name = queue.shift();
    if (bodies.has(name) || consts.has(name) || unresolved.has(name)) continue;
    let body = null;
    for (const ind of [2, 4, 0]) {
      try { body = grab(name, ind); break; } catch (e) { /* try next indent */ }
    }
    if (body) bodies.set(name, body);
    else {
      try { consts.set(name, grabConst(name)); continue; }
      catch (e) { unresolved.add(name); continue; }
    }
    // what does it reference?
    for (const id of new Set(body.match(/\b(?:ds|ml)[A-Z]\w*/g) || [])) {
      if (id !== name) queue.push(id);
    }
    // Any UPPER_CASE identifier could be a module-level constant. DS_ alone was
    // too narrow: IND_KNOWN_RAMPS and MAP_OVERLAY_FIELDS each broke a validator.
    for (const c of new Set(body.match(/\b[A-Z][A-Z0-9_]{2,}\b/g) || [])) {
      if (!(c in scope) && !['JSON', 'NaN', 'GEOID', 'NTA', 'CDTA'].includes(c)) queue.push(c);
    }
  }
  const missing = [...unresolved].filter(n => !(n in scope));
  const parts = [...consts.values(), ...bodies.values()];
  const body = '"use strict";\n' + parts.join('\n') + '\nreturn {' +
    wanted.join(',') + '};';
  const keys = Object.keys(scope);
  const api = new Function(...keys, body)(...keys.map(k => scope[k]));
  return { api, resolved: bodies.size, constants: consts.size, missing };
}

let api, built;
try {
  built = buildRunner();
  api = built.api;
} catch (e) {
  console.error('EXTRACTION FAILED: ' + e.message);
  console.error('The validators could not be lifted out of app.js, so nothing was');
  console.error('validated. This is a harness failure, NOT a passing result.');
  process.exit(2);
}

const CASES = [
  ['Data/out/nyserda_dac_v1_0.json', 'dsValidateDoc',
   { datasetKey: 'nyserda_dac', version: '1.0', geoidVintage: '2010' }],
  ['Data/out/tract_geometry_pure-2010.json', 'dsValidateGeometryDoc',
   { datasetKey: 'tract_geometry', version: '1.0', geoidVintage: '2010' }],
  ['Data/out/tract_geometry_pure-2020.json', 'dsValidateGeometryDoc',
   { datasetKey: 'tract_geometry', version: '1.0', geoidVintage: '2020' }],
  ['Data/out/coned_operational_v1_0-2010.json', 'dsValidateConedDoc',
   { datasetKey: 'coned_operational', version: '1.0', geoidVintage: '2010' }],
  ['Data/service_territories.geojson', 'dsValidateTerritoryDoc',
   { datasetKey: 'service_territories', version: '1.0', geoidVintage: '2010' }],
];

console.log('='.repeat(74));
console.log("APP'S OWN UPLOAD VALIDATION, run over the clean-room outputs");
console.log('='.repeat(74));
console.log('source: ' + SIM);
console.log('validators lifted from app.js: %d function(s), %d constant(s)'
  .replace('%d', built.resolved).replace('%d', built.constants));
if (built.missing.length) {
  console.log('COULD NOT RESOLVE: ' + built.missing.join(', '));
  console.log('(reported, not ignored -- see the per-file result)');
}
console.log('');

for (const [rel, vname, rec] of CASES) {
  const p = path.join(SIM, rel);
  if (!fs.existsSync(p)) { fail++; lines.push('  MISSING   ' + rel); continue; }
  let doc;
  try { doc = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { fail++; lines.push('  UNPARSEABLE ' + rel + ': ' + e.message); continue; }
  let res;
  try { res = api[vname](doc, rec); }
  catch (e) {
    fail++;
    lines.push('  ERRORED   ' + rel + ' in ' + vname + ': ' + e.message);
    lines.push('              a validator that threw is not a validator that passed');
    continue;
  }
  report(path.basename(rel) + '   [' + vname + ']', res, rel);
}

console.log(lines.join('\n'));
console.log('');
console.log('='.repeat(74));
console.log('  accepted by the app: ' + pass + '   refused/errored: ' + fail);
console.log('='.repeat(74));
process.exit(fail ? 1 : 0);
