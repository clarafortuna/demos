/* check_no_file_served_map.js -- slice 5d's acceptance criterion, machine-checked.
 *
 * "No code path can fetch map_payload.json or any file-served map data."
 *
 * 5d removed the payload path and that criterion was signed off. It was not
 * literally true: dsFetchTerritoryWebResource still called
 * fetch('./Data/service_territories.geojson'), and slice 6e had already DELETED
 * that web resource -- so live code pointed at a 404. It survived review twice
 * because it is unreachable while an overlay is published, which is the state this
 * org happens to be in. A fresh environment, where nothing is published yet, is
 * exactly where it would have fired first.
 *
 * Re-auditing that by eye is how it survived. This asserts it instead.
 *
 * WHAT COUNTS AS A VIOLATION
 * A fetch/XHR whose URL is a relative or same-origin FILE path -- './Data/x.json',
 * '/webresources/y.geojson', 'map_payload.json'. Dataverse Web API calls are the
 * point of the app and are not violations; they are identified by going through the
 * API base rather than by a path literal.
 *
 * Comments and operator-facing copy are EXEMPT. Both legitimately name these files
 * -- the guides explain what replaced them, and app.js comments record why the
 * paths went away. The claim under test is about code that RUNS.
 *
 * Run:  node Data/check_no_file_served_map.js
 * Exits non-zero on failure.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const DATA = path.basename(HERE) === 'Data' ? HERE : path.join(HERE, 'Data');
const ROOT = path.dirname(DATA);
const APP = path.join(ROOT, 'app.js');

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  if (ok) { pass++; console.log('  PASS  ' + name); }
  else {
    fail++;
    console.log('  FAIL  ' + name +
      (detail !== undefined ? '\n          ' + String(detail).replace(/\n/g, '\n          ') : ''));
  }
};

/* Strip // line comments, block comments and template/quoted operator copy is NOT
 * stripped -- copy lives in template literals that also contain code, so removing
 * them would blind the check. Comments are the only exemption applied
 * mechanically; the assertions below are written so prose cannot trip them, because
 * they require the fetch/XHR CALL syntax and not merely the filename. */
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  let inS = null;       // quote char of the string we are inside
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (inS) {
      if (c === '\\') { out += '  '; i += 2; continue; }
      if (c === inS) inS = null;
      out += c; i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { inS = c; out += c; i++; continue; }
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (c === '/' && d === '*') {
      i += 2; out += '  ';
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += (src[i] === '\n' ? '\n' : ' '); i++; }
      i += 2; out += '  ';
      continue;
    }
    out += c; i++;
  }
  return out;
}

if (!fs.existsSync(APP)) {
  console.error('FAIL  cannot find ' + APP);
  process.exit(1);
}
const raw = fs.readFileSync(APP, 'utf8');
const code = stripComments(raw);

console.log('== 1. no fetch of a file path ==');

/* fetch( '<literal>' ) where the literal looks like a file path rather than an API
 * URL. Deliberately narrow to LITERALS: a computed URL is how the Dataverse calls
 * are built, and flagging those would make the guard useless and get it deleted. */
const FETCH_LITERAL = /\bfetch\(\s*(['"`])([^'"`]+)\1/g;
const XHR_OPEN = /\.open\(\s*(['"`])[A-Z]+\1\s*,\s*(['"`])([^'"`]+)\2/g;

const FILEISH = /(^|[/'"])([\w.\-]+\.(json|geojson|csv|xlsx|geojson))(\?|$|['"])|(^|\s)\.{0,2}\/[\w.\-/]+\.(json|geojson|csv)/i;
const API_ISH = /\/api\/data\/v[\d.]+\//i;

/* The ONE file the app legitimately fetches, listed rather than pattern-matched so
 * that adding a second is a visible act in a diff.
 *
 * payload.json is NOT map data. It is the dashboard's own dataset -- the borough
 * charts, the reported KPIs and the report tables read it -- and it is on the keep
 * list from the migration audit, where it is easily confused with the deleted
 * map_payload.json. The criterion under test is about MAP data reaching the browser
 * from a file, which 5d and its corrective removed. Retiring payload.json is a
 * different arc and is not claimed here.
 *
 * This guard found it on its first run, which is the reason the boundary is written
 * down instead of assumed. */
const ALLOWED = ['payload.json'];

const offenders = [];
const allowedSeen = [];
let m;
while ((m = FETCH_LITERAL.exec(code))) {
  const url = m[2];
  if (API_ISH.test(url)) continue;
  if (ALLOWED.indexOf(url) >= 0) { allowedSeen.push(url); continue; }
  if (FILEISH.test(url)) {
    offenders.push({ kind: 'fetch', url, line: code.slice(0, m.index).split('\n').length });
  }
}
while ((m = XHR_OPEN.exec(code))) {
  const url = m[3];
  if (API_ISH.test(url)) continue;
  if (ALLOWED.indexOf(url) >= 0) { allowedSeen.push(url); continue; }
  if (FILEISH.test(url)) {
    offenders.push({ kind: 'XHR', url, line: code.slice(0, m.index).split('\n').length });
  }
}

check('app.js makes no fetch/XHR to a file path',
      offenders.length === 0,
      offenders.map(o => 'app.js:' + o.line + '  ' + o.kind + " '" + o.url + "'").join('\n'));

check('the allowlist holds exactly one file, and it is payload.json',
      ALLOWED.length === 1 && ALLOWED[0] === 'payload.json', ALLOWED.join(', '));
check('payload.json IS still fetched (this guard must not be read as retiring it)',
      allowedSeen.indexOf('payload.json') >= 0, allowedSeen.join(', ') || '(not seen)');

console.log('\n== 2. the specific files that were removed ==');
// Named individually so a regression names the file that came back, not just "a
// file path". These three were the whole point.
[
  ['map_payload.json', 'the payload path, removed in 5d'],
  ['service_territories.geojson', 'the territory fallback, removed in the 5d corrective'],
  ['hvi_zcta.geojson', 'the HVI file, superseded by the saved layer'],
].forEach(([file, why]) => {
  const hit = offenders.filter(o => o.url.indexOf(file) >= 0);
  check(file + ' is never fetched  (' + why + ')', hit.length === 0,
        hit.map(o => 'app.js:' + o.line).join(', '));
});

console.log('\n== 3. the guard can actually fail ==');
// Without this, a broken regex would report a clean sweep forever.
const planted = "  const x = fetch('./Data/service_territories.geojson');";
const probe = stripComments(planted);
let caught = 0;
FETCH_LITERAL.lastIndex = 0;
while ((m = FETCH_LITERAL.exec(probe))) {
  if (!API_ISH.test(m[2]) && FILEISH.test(m[2])) caught++;
}
check('a planted fetch of a file path IS detected', caught === 1, 'caught=' + caught);

// And prose naming the same file must NOT trip it.
const prose = "  // slice 6e deleted Data/service_territories.geojson, so nothing fetches it";
const proseCode = stripComments(prose);
let proseHits = 0;
FETCH_LITERAL.lastIndex = 0;
while ((m = FETCH_LITERAL.exec(proseCode))) proseHits++;
check('a comment naming the same file does NOT trip it', proseHits === 0, 'hits=' + proseHits);

console.log('\n' + (fail ? 'FAILED ' : 'ALL PASS ') + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
