/* security -- OData literal vs URL transport safety.
 *
 * Part of the combined XSS + OData remediation. This suite FAILS against the
 * vulnerable implementation and PASSES against the remediated one; mut_security.js
 * drives both directions so the pass is never mistaken for a vacuous one.
 */
/* SECURITY REGRESSION -- OData literal safety AND URL transport safety.
 *
 * TWO PROPERTIES, AND THEY ARE NOT THE SAME THING.
 *
 *   LITERAL safety : the value cannot terminate its own '...' literal and
 *                    append a predicate.  Shipped rule: v.replace(/'/g,"''").
 *   TRANSPORT safety: the value survives the URL intact -- it cannot introduce
 *                    a new query parameter, truncate the filter, or smuggle a
 *                    quote through percent-decoding.  Shipped rule: NONE.
 *
 * THE BYPASS. The doubling runs on the RAW string; percent-decoding happens
 * later, at the transport layer. So `%27` is not a quote when the escaping
 * inspects it and IS a quote by the time Dataverse parses the query. The
 * doubling never sees it.
 *
 * WHY IT MATTERS HERE RATHER THAN BEING A CURIOSITY. The rows this filter
 * returns are fed straight into a WRITE:
 *     for (...) await dvUpdate(setTractDataset, sid, { cr2bf_isactive: false });
 * so a widened filter retires datasets that should not be retired. Slice 5d
 * removed the file-served map fallback, so the visible result is a blank map.
 *
 * NO NETWORK. This suite reasons about URL construction only. The live GET-only
 * probe is separate (probe_q4_odata_live.js) and is not required to show that
 * the remediation is correct.
 *
 * SCOPE, measured against the current revision: three $filter sites. Two
 * interpolate dataset.key. Of the four dataset families, geometry / coned /
 * territories pin ds.key to a constant (DS_*_KEY), so only INDICATORS accepts
 * an arbitrary key from an uploaded manifest.
 */
'use strict';

/* capture what we print, so the committed output file matches the console */
const _lines = [];
{ const _log = console.log; console.log = function () {
    const s = Array.prototype.join.call(arguments, ' ');
    _lines.push(s); _log.apply(console, arguments); }; }


const fs = require('fs');
const path = require('path');

/* DAC_APP_OVERRIDE is the house convention and is what the mutation runner
 * sets; DAC_APP stays supported for a direct invocation. Reading only DAC_APP
 * silently skipped section E under mut_security, so a removed encodeURIComponent
 * went undetected -- which is precisely what the mutation control exists to
 * catch, and did. */
function findRepoRoot(start) {
  let d = start;
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(d, 'Coned', 'CLCPA', 'ExecutiveDashboard_dev', 'app.js'))) return d;
    const up = path.dirname(d); if (up === d) break; d = up;
  }
  return null;
}
/* DEFAULTS TO THE REPOSITORY COPY, and that matters more than it looks.
 * Earlier this read only the env vars, so running the suite the way the gate
 * runs it -- bare, no override -- silently skipped section E and reported 13
 * green instead of 24. A suite that quietly drops its most important
 * assertions when invoked normally is the exact failure mode these tests
 * exist to prevent. */
const REPO = process.env.DAC_REPO || findRepoRoot(__dirname);
const APP = process.env.DAC_APP_OVERRIDE || process.env.DAC_APP ||
  (REPO ? path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js') : null);
let SRC = null;
if (APP && fs.existsSync(APP)) SRC = fs.readFileSync(APP, 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const API = 'https://example.crm.dynamics.com/api/data/v9.2/';
const SET = 'cr2bf_dactractdatasets';

/* ---- the SHIPPED construction, reproduced exactly ---------------------- */
const shippedLiteral = (v) => String(v).replace(/'/g, "''");
const shippedQuery = (key) =>
  '$select=id&$filter=' + "cr2bf_isactive eq true and cr2bf_datasetkey eq '" + shippedLiteral(key) + "'";

/* ---- the PROPOSED remediation ------------------------------------------
 * Order matters: double the quotes FIRST (literal safety), then encode
 * (transport safety). Encoding first would percent-encode the doubled quotes
 * into something the literal rule never produced. */
const escapeODataStringLiteral = (v) => String(v).replace(/'/g, "''");
const buildODataQuery = (parts) => Object.keys(parts)
  .filter(k => parts[k] !== undefined && parts[k] !== null)
  .map(k => k + '=' + encodeURIComponent(parts[k]))
  .join('&');
const fixedQuery = (key) => buildODataQuery({
  $select: 'id',
  $filter: "cr2bf_isactive eq true and cr2bf_datasetkey eq '" + escapeODataStringLiteral(key) + "'",
});

/* What the server actually parses out of a given query string. */
const serverSees = (query) => {
  const u = new URL(API + SET + '?' + query);
  return { params: [...u.searchParams.keys()], filter: u.searchParams.get('$filter') };
};

const LEGIT = [
  ['plain', 'nyserda_dac'],
  ['versioned', 'nyserda_dac_v2_0'],
  ['digits', 'coned_operational_2020'],
];
const HOSTILE = [
  ['direct quote',       "x' or cr2bf_isactive eq true or ''='"],
  ['PERCENT-ENCODED quote', "x%27 or cr2bf_isactive eq false or %27"],
  ['ampersand',          'x&$top=1'],
  ['hash',               'x#frag'],
  ['plus',               'x+y'],
  ['double percent',     'x%2527'],
];

console.log('======================================================================');
console.log('OData literal safety vs URL transport safety');
console.log('======================================================================');

/* ============================================================== A. legitimate
 * The fix must not change what a legitimate key means. */
console.log('');
console.log('A. legitimate keys survive the remediation unchanged');
LEGIT.forEach(([label, key]) => {
  const s = serverSees(shippedQuery(key));
  const f = serverSees(fixedQuery(key));
  ok(s.filter === f.filter && f.filter.indexOf("eq '" + key + "'") >= 0,
    'A: ' + label + ' -- shipped and fixed produce the same $filter');
});

/* ============================================================== B. literal
 * The shipped doubling is correct against a DIRECT quote. Say so plainly. */
console.log('');
console.log('B. the shipped quote-doubling is correct for a direct quote');
{
  const key = "x' or cr2bf_isactive eq true or ''='";
  const doubled = shippedLiteral(key);
  ok((doubled.match(/'/g) || []).length === (key.match(/'/g) || []).length * 2,
    'B1 every quote is doubled');
  ok(serverSees(shippedQuery(key)).filter.indexOf("eq 'x'' or") >= 0,
    'B2 the value stays inside one literal -- no injected predicate');
}

/* ============================================================== C. transport
 * Each hostile value must reach the server as DATA, under the fix. */
console.log('');
console.log('C. hostile values -- shipped is unsafe, remediated is safe');
HOSTILE.forEach(([label, key]) => {
  const s = serverSees(shippedQuery(key));
  const f = serverSees(fixedQuery(key));

  const shippedIntact = s.params.length === 2 &&
    s.filter !== null && s.filter.indexOf(shippedLiteral(key)) >= 0;
  const fixedIntact = f.params.length === 2 &&
    f.filter !== null && f.filter.indexOf(escapeODataStringLiteral(key)) >= 0;

  ok(fixedIntact, 'C: ' + label + ' -- REMEDIATED: exactly 2 params, value intact as data');
  if (!shippedIntact) {
    console.log('        (shipped is unsafe here, as expected: params=' +
      JSON.stringify(s.params) + ' filter=' + JSON.stringify(String(s.filter).slice(-52)) + ')');
  }
});

/* ============================================================== D. the bypass
 * The single most important assertion in this file. */
console.log('');
console.log('D. the percent-encoded bypass, stated precisely');
{
  const key = "x%27 or cr2bf_isactive eq false or %27";
  const shipped = serverSees(shippedQuery(key)).filter;
  const fixed = serverSees(fixedQuery(key)).filter;

  ok(/eq 'x' or cr2bf_isactive eq false or ''/.test(shipped),
    'D1 SHIPPED: the server receives a well-formed INJECTED predicate');
  ok(!/eq 'x' or /.test(fixed) && fixed.indexOf('%27') >= 0,
    'D2 REMEDIATED: the %27 stays literal text inside the quoted value');
  console.log('        shipped   -> ' + JSON.stringify(shipped));
  console.log('        remediated-> ' + JSON.stringify(fixed));
}

/* ============================================================== E. the code
 * Assert the remediation against the real source when one is supplied. */
if (SRC) {
  console.log('');
  console.log('E. the shipped source (' + path.basename(APP) + ')');
  const filters = (SRC.match(/\$filter=/g) || []).length;
  ok(filters === 3, 'E1 still exactly 3 $filter construction sites (found ' + filters + ')');

  /* E2 DRIVES THE SHIPPED HELPER rather than pattern-matching the call sites.
   *
   * Pattern-matching was not enough and the mutation runner proved it: removing
   * encodeURIComponent from odataLiteral's BODY left every call site reading
   * `odataLiteral(rec.datasetKey)`, so a text check still passed while the
   * defect was fully restored. Extracting the function and running it closes
   * that hole -- the assertion now fails for the only reason that matters,
   * which is that the value is no longer safe. */
  const helperSrc = (() => {
    const i = SRC.indexOf('function odataLiteral(');
    if (i < 0) return null;
    const j = SRC.indexOf('\n      }', i);
    return j < 0 ? null : SRC.slice(i, j + 8);
  })();
  let shippedHelper = null;
  if (helperSrc) {
    try { shippedHelper = new Function(helperSrc + '\nreturn odataLiteral;')(); }
    catch (e) { /* reported by E2 */ }
  }
  ok(typeof shippedHelper === 'function',
    'E2a the shipped odataLiteral is present and this suite can drive it');

  /* ASSERT THE SERVER-VISIBLE OUTCOME, not the helper's raw output.
   *
   * Two earlier drafts of this assertion were wrong, and both would have been
   * worse than useless. "contains a %" passes trivially, because encoding
   * introduces % by construction. Expecting x'y -> x%27%27y is also wrong:
   * encodeURIComponent does not escape an apostrophe, and it does not need to
   * -- ' is a sub-delim, legal in a query string, and the DOUBLING is what
   * gives literal safety there.
   *
   * What actually matters is what Dataverse parses. So each value is put
   * through the shipped helper, dropped into the real filter shape, and the
   * URL is parsed the way the service would: exactly two query parameters, and
   * the value present as DATA rather than as syntax. */
  const asServerSees = (raw) => {
    const f = "cr2bf_isactive eq true and cr2bf_datasetkey eq '" + shippedHelper(raw) + "'";
    const u = new URL(API + SET + '?$select=id&$filter=' + f);
    return { params: [...u.searchParams.keys()], filter: u.searchParams.get('$filter') };
  };
  const E2CASES = [
    ["x'y",                        "eq 'x''y'",  'a quote arrives doubled -- one literal, no predicate'],
    ['x&y',                        "eq 'x&y'",   'an ampersand cannot start a new query parameter'],
    ['x#y',                        "eq 'x#y'",   'a hash cannot truncate the filter'],
    ['x+y',                        "eq 'x+y'",   'a plus cannot decode to a space'],
    ['x%27',                       "eq 'x%27'",  'a percent-encoded quote stays literal text -- THE BYPASS'],
    ['x%27 or 1 eq 1 or %27',      "or 1 eq 1",  'the full injection arrives as one value'],
    ['nyserda_dac',                "eq 'nyserda_dac'", 'a legitimate key is unchanged'],
  ];
  if (typeof shippedHelper === 'function') {
    E2CASES.forEach(([input, want, why]) => {
      const s = asServerSees(input);
      const twoParams = s.params.length === 2;
      const asData = s.filter !== null && s.filter.indexOf(want) >= 0;
      /* the injection case must additionally NOT have escaped its literal */
      const noBreakout = !/eq '[^']*' or /.test(s.filter || '');
      ok(twoParams && asData && noBreakout, 'E2 ' + why);
      if (!(twoParams && asData && noBreakout)) {
        console.log('        params=' + JSON.stringify(s.params) +
          ' filter=' + JSON.stringify(s.filter));
      }
    });
  } else {
    ok(false, 'E2 skipped -- the shipped odataLiteral could not be driven');
  }

  const rawInterp = /\$filter=[^;]*?\+\s*String\((?:rec|layer)\.[A-Za-z]+[^)]*\)\.replace\(\/'\/g, *"''"\)/s.test(SRC);
  ok(!rawInterp,
    'E2 no $filter interpolates a value without encodeURIComponent');

  ok(/^\s*const DS_KEY_RE\s*=|\^\[a-z0-9_\]\{1,100\}\$/m.test(SRC),
    'E3 dataset.key is constrained to a charset (defence in depth for the indicators family)');
} else {
  console.log('');
  ok(false, 'E. NO SOURCE RESOLVED -- section E did not run. Set DAC_REPO or DAC_APP_OVERRIDE.');
}

console.log('');
console.log('======================================================================');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
console.log('======================================================================');
/* ---- committed run output -------------------------------------------------
 * Written beside the suite, as every other ticket directory does, so a reader
 * can see the result without running anything. DAC_OUT redirects it, which is
 * how the portable harness keeps test output out of the source tree. */
try {
  const _outPath = process.env.DAC_OUT ||
    require('path').join(__dirname, 'odata-encoding-output.txt');
  require('fs').writeFileSync(_outPath, _lines.join('\n') + '\n');
} catch (e) { /* a read-only checkout must not fail the suite */ }

process.exit(fail ? 1 : 0);
