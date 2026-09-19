/* CLCPA security regression -- the two deploy-time safeguards.
 *
 * WHAT THESE DEFEND, and neither is hypothetical.
 *
 * A. WRONG-ORG WRITE. The Con Edison solution was exported from Clara Fortuna
 *    Dev and imported into Sustainability Design - Dev, so the web resource
 *    rows kept their ids. app.js is 79151fe9-3c64-f111-ab0c-7c1e521c7110 in
 *    BOTH orgs, under the same name, in a solution with the same unique name.
 *    A deploy wave PATCHes by that guid and gates on an id-to-name match --
 *    which passes in either org. Only the org URL in a per-wave scratch script
 *    decides which company receives the release.
 *
 * B. PUBLISH-ALL. `--publish-changes` and `pac solution publish` both issue
 *    PublishAllXml. On 2026-09-19 an import that touched no legacy component
 *    still moved modifiedon on all seven cr2bf_dactest/* resources. Content was
 *    byte-identical and customizations.xml unchanged, so nothing broke -- but
 *    republishing a shared environment is not ours to do, and the timestamps it
 *    overwrote were evidence of who had been in there.
 *
 * The guard is pure, so this suite runs offline with no org and no credentials.
 * That is deliberate: a deploy-time check that can only be exercised during a
 * deploy is a check that never gets tested.
 */
'use strict';

const _lines = [];
{ const _log = console.log; console.log = function () {
    const s = Array.prototype.join.call(arguments, ' ');
    _lines.push(s); _log.apply(console, arguments); }; }

const fs = require('fs');
const path = require('path');

function findRepoRoot(start) {
  let d = start;
  for (;;) {
    if (fs.existsSync(path.join(d, '.clcpa-root'))) return d;
    const up = path.dirname(d);
    if (up === d) throw new Error('.clcpa-root marker not found above ' + start);
    d = up;
  }
}
const ROOT = findRepoRoot(__dirname);
const GUARD_PATH = path.join(ROOT, 'tools', 'deploy_guard.js');
const G = require(GUARD_PATH);

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ok   ' + msg); }
  else { fail++; console.log('  FAIL ' + msg); }
}
/* every guard failure must be an exception, never a falsy return */
function throws(fn, matcher, msg) {
  let threw = false, m = '';
  try { fn(); } catch (e) { threw = true; m = e.message; }
  ok(threw && (!matcher || matcher.test(m)), msg + (threw && matcher && !matcher.test(m) ? ' (wrong message: ' + m + ')' : ''));
}

const CONED = '1dfebd7e-cd6f-f111-b27b-000d3a5cc314';
const OTHER = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

console.log('======================================================================');
console.log('  CLCPA -- deploy guard');
console.log('======================================================================');
console.log('');
console.log('A. id normalization -- braces, case and space are not differences');
ok(G.normalizeId('{1DFEBD7E-CD6F-F111-B27B-000D3A5CC314}') === CONED, 'A: braces and upper case normalize to the canonical form');
ok(G.normalizeId('  ' + CONED + ' ') === CONED, 'A: surrounding space is ignored');
ok(G.normalizeId('not-a-guid') === null, 'A: a non-GUID normalizes to null, never to itself');
ok(G.normalizeId(null) === null, 'A: null normalizes to null');

console.log('');
console.log('B. assertOrganization -- the check that stops a wrong-company write');
ok(G.assertOrganization(CONED, CONED).organizationId === CONED, 'B: matching ids pass');
ok(G.assertOrganization('coned-sustainability-dev', CONED).organizationId === CONED, 'B: a known environment key resolves and passes');
ok(G.assertOrganization(CONED, { OrganizationId: CONED }).organizationId === CONED, 'B: a WhoAmI response object is accepted directly');
throws(() => G.assertOrganization(CONED, OTHER), /WRONG ORGANIZATION/, 'B: a different org THROWS');
throws(() => G.assertOrganization(null, CONED), /must declare its target org/, 'B: a missing expectation THROWS (never defaults to allow)');
throws(() => G.assertOrganization(CONED, null), /unverified connection/, 'B: an unreadable connection THROWS');
throws(() => G.assertOrganization(CONED, 'garbage'), /unverified connection/, 'B: a malformed reading THROWS');

console.log('');
console.log('C. fail-closed on an environment whose org id was never read');
ok(G.ENVIRONMENTS['clara-fortuna-dev'].organizationId === null, 'C: clara-fortuna-dev has no recorded org id (it has never been read)');
throws(() => G.assertOrganization('clara-fortuna-dev', CONED), /no recorded/, 'C: an unrecorded environment THROWS rather than skipping the check');

console.log('');
console.log('D. the collision itself -- the reason B exists');
const APP_JS_GUID = '79151fe9-3c64-f111-ab0c-7c1e521c7110';
ok(G.normalizeId(APP_JS_GUID) === APP_JS_GUID, 'D: the app.js web resource id is a valid GUID in both orgs');
throws(() => G.assertOrganization('coned-sustainability-dev', OTHER), /identical in both orgs/,
  'D: the refusal explains that the GUIDs are identical, so nothing downstream would notice');

console.log('');
console.log('E. assertOwned -- the legacy line is not ours to republish');
ok(G.assertOwned(['clcpa_dashboard/app.js']).length === 1, 'E: a clcpa_ component is accepted');
ok(G.assertOwned(['clcpa_dashboard/app.js', 'clcpa_dashboard/styles.css']).length === 2, 'E: several clcpa_ components are accepted');
throws(() => G.assertOwned(['cr2bf_dactest/app.js']), /outside the clcpa_ line/, 'E: a cr2bf_ component is REFUSED');
throws(() => G.assertOwned(['clcpa_dashboard/app.js', 'cr2bf_dactest/app.js']), /cr2bf_dactest/,
  'E: one foreign component poisons the whole set, and is named in the error');
throws(() => G.assertOwned([]), /named no components/, 'E: an empty publish set THROWS');

console.log('');
console.log('F. buildPublishXml -- targeted ParameterXml, ids only');
const xml = G.buildPublishXml(['BD88B33C-B8F8-4457-B387-6A8B8C0D00A6', 'f6386636-3edd-4525-b1ad-595c8a38b86b']);
ok(xml.indexOf('<importexportxml><webresources>') === 0, 'F: the payload opens with importexportxml/webresources');
ok(xml.indexOf('<webresource>bd88b33c-b8f8-4457-b387-6a8b8c0d00a6</webresource>') > 0, 'F: ids are emitted normalized (lower case, unbraced)');
ok((xml.match(/<webresource>/g) || []).length === 2, 'F: exactly the ids supplied are named, and no more');
ok(xml.indexOf('<entities>') < 0 && xml.indexOf('<optionsets>') < 0, 'F: no other component family is dragged in');
throws(() => G.buildPublishXml(['clcpa_dashboard/app.js']), /not a web resource id/, 'F: a NAME where an id belongs THROWS');
throws(() => G.buildPublishXml([CONED, CONED]), /duplicate/, 'F: a duplicated id THROWS');
throws(() => G.buildPublishXml([]), /no web resource ids/, 'F: an empty id set THROWS');

console.log('');
console.log('G. the publish-all lint -- catching the exact command that was run');
ok(G.scanForPublishAll('pac solution import --path x.zip --publish-changes').length > 0,
  'G: the command actually used on 2026-09-19 is flagged');
ok(G.scanForPublishAll('PublishAllXml').length > 0, 'G: a direct PublishAllXml call is flagged');
ok(G.scanForPublishAll('pac solution publish').length > 0, 'G: pac solution publish is flagged');
ok(G.scanForPublishAll('POST /api/data/v9.2/PublishXml').length === 0, 'G: a targeted PublishXml is NOT flagged');
ok(G.scanForPublishAll('').length === 0, 'G: empty text is clean');
throws(() => G.assertNoPublishAll('--publish-changes', 'deploy_x.js'), /deploy_x\.js/,
  'G: assertNoPublishAll names the offending file');

console.log('');
console.log('H. the guard is the only place these shapes may appear in tools/');
const toolsDir = path.join(ROOT, 'tools');
const offenders = fs.readdirSync(toolsDir)
  .filter(f => /\.(js|sh)$/.test(f))
  .filter(f => G.scanForPublishAll(fs.readFileSync(path.join(toolsDir, f), 'utf8')).length > 0);
ok(offenders.length === 1 && offenders[0] === 'deploy_guard.js',
  'H: deploy_guard.js is the sole file in tools/ carrying publish-all shapes (found: ' + (offenders.join(', ') || 'none') + ')');

console.log('');
console.log('I. the recorded Con Edison environment matches what the org reported');
ok(G.ENVIRONMENTS['coned-sustainability-dev'].organizationId === CONED,
  'I: the recorded org id is the one WhoAmI returned on 2026-09-19');
ok(G.ENVIRONMENTS['coned-sustainability-dev'].url.indexOf('orgc60845ae') > 0,
  'I: the recorded url is the Con Edison org, not the vendor org');
ok(G.ENVIRONMENTS['clara-fortuna-dev'].url.indexOf('org9076e69b') > 0,
  'I: the vendor org is recorded too, so a wave can name it explicitly');

console.log('');
console.log('J. the third org -- the one the guard found by refusing a write');
const CUST = '0e48ff69-7fb6-f011-95c7-00224806e123';
ok(G.ENVIRONMENTS['customer-assistance-dev'].organizationId === CUST,
  'J: Customer Assistance - Dev is recorded from the live reading that triggered the refusal');
throws(() => G.assertOrganization('coned-sustainability-dev', CUST), /WRONG ORGANIZATION/,
  'J: a wave targeting Sustainability Design is REFUSED when pac has selected Customer Assistance');
ok(G.assertOrganization('customer-assistance-dev', CUST).organizationId === CUST,
  'J: and it still passes when a wave names that org deliberately');
ok(G.ENVIRONMENTS['coned-sustainability-dev'].organizationId !== CUST,
  'J: the two Con Edison orgs are distinguishable by id -- the ONLY thing that distinguishes them');

console.log('');
console.log('======================================================================');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
console.log('======================================================================');

try {
  const _outPath = process.env.DAC_OUT || path.join(__dirname, 'deploy-guard-output.txt');
  fs.writeFileSync(_outPath, _lines.join('\n') + '\n');
} catch (e) { /* a read-only checkout must not fail the suite */ }

process.exit(fail ? 1 : 0);
