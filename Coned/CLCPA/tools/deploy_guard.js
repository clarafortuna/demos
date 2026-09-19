/* CLCPA deploy guard -- the two checks that must pass before any deploy write.
 *
 * WHY THIS EXISTS, and it is not a theoretical hardening.
 *
 * 1. THE GUIDS COLLIDE ACROSS ORGS. The Con Edison solution was exported from
 *    org9076e69b (Clara Fortuna Dev) and imported into orgc60845ae
 *    (Sustainability Design - Dev). The web resource rows carried their ids
 *    across, so app.js is 79151fe9-3c64-f111-ab0c-7c1e521c7110 in BOTH orgs,
 *    under the same name, in a solution with the same unique name.
 *
 *    Every deploy wave does `PATCH webresourceset(<guid>)` and gates on an
 *    id-to-name match. That gate passes in either org. The provenance gate --
 *    "is the org serving the build this wave expects?" -- is the only existing
 *    check that could notice, and it compares CONTENT, so it fails loudly only
 *    when the two orgs happen to differ. The single thing that decides which
 *    company receives a release is the org URL string in a scratch script that
 *    is re-authored every wave.
 *
 *    assertOrganization closes that. It compares the org id the platform
 *    reports against the one the wave declares, and it FAILS CLOSED: a missing
 *    expectation, a missing reading, or a mismatch all throw. An unknown org is
 *    never treated as permission to proceed.
 *
 * 2. PUBLISHALLXML IS NOT OURS TO CALL. `pac solution import --publish-changes`
 *    and `pac solution publish` both issue PublishAllXml, which publishes every
 *    unpublished component in the org. On 2026-09-19 that moved modifiedon on
 *    all seven legacy cr2bf_dactest/* resources during an import that touched
 *    none of them. Content was byte-identical afterwards and customizations.xml
 *    was unchanged, so nothing broke -- but a shared environment is not ours to
 *    republish, and the timestamps it overwrote were evidence.
 *
 *    buildPublishXml emits a ParameterXml naming only the components we own,
 *    and assertOwned refuses any component outside the clcpa_ line.
 *
 * Both checks are pure functions over values the caller supplies. Nothing here
 * performs I/O or authenticates -- that keeps them testable offline, which is
 * the only reason a deploy-time check ever actually gets tested.
 */
'use strict';

/* Known deploy targets. An entry with a null organizationId is DELIBERATELY
 * unusable: assertOrganization throws on it rather than skipping the check.
 * Fill one in only from a live WhoAmI read against that org, never by guessing,
 * because a wrong constant here is worse than an absent one -- it would turn a
 * fail-closed check into a confident green. */
const ENVIRONMENTS = {
  'coned-sustainability-dev': {
    label: 'Sustainability Design - Dev (Con Edison)',
    url: 'https://orgc60845ae.crm.dynamics.com/',
    environmentId: 'd491a3e9-379f-e433-8ccb-afb49607c31d',
    organizationId: '1dfebd7e-cd6f-f111-b27b-000d3a5cc314'
  },
  'customer-assistance-dev': {
    label: 'Customer Assistance - Dev (Con Edison)',
    url: 'https://orgbdb6dd88.crm.dynamics.com/',
    environmentId: '8e72fb69-de68-ecee-8b2a-0ecd9bfd1b05',
    /* READ FROM A LIVE CONNECTION on 2026-09-19, not guessed -- pac had silently
     * selected this org, and the guard refused the write. It holds the same
     * cr2bf_dactest/* resources under the SAME GUIDs, which is exactly why a
     * name-and-id gate cannot tell these environments apart. Recorded so a wave
     * can name it deliberately, never so it can be reached by accident. */
    organizationId: '0e48ff69-7fb6-f011-95c7-00224806e123'
  },
  'clara-fortuna-dev': {
    label: 'Clara Fortuna Dev (vendor)',
    url: 'https://org9076e69b.crm.dynamics.com/',
    environmentId: null,
    /* NOT YET READ. Every deploy manifest names this org, but no WhoAmI against
     * it has been recorded here, so it stays null and the guard refuses it. */
    organizationId: null
  }
};

/* The component prefix this project owns. The legacy line is cr2bf_; ours is
 * clcpa_. Anything else belongs to someone we did not ask. */
const OWNED_PREFIX = 'clcpa_';

/* Shapes that mean "publish the whole org". Kept as source strings because the
 * lint runs over deploy scripts as text, before anything is executed. */
const PUBLISH_ALL_SHAPES = [
  'PublishAllXml',
  '--publish-changes',
  'publish-changes',
  'pac solution publish'
];

/* A GUID compares equal regardless of braces, case or surrounding space. Every
 * other difference is a real difference. */
function normalizeId(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(/^\{|\}$/g, '').toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s) ? s : null;
}

function fail(msg) {
  const e = new Error('DEPLOY GUARD: ' + msg);
  e.deployGuard = true;
  throw e;
}

/* Check 1 -- the org actually being written to is the org the wave declared.
 *
 * `expected` may be an environment key from ENVIRONMENTS or a raw org id.
 * `actual` is whatever WhoAmI returned: the OrganizationId, or the response
 * object itself, so a caller cannot accidentally pass the wrong field. */
function assertOrganization(expected, actual) {
  let want = null, label = null;

  if (typeof expected === 'string' && Object.prototype.hasOwnProperty.call(ENVIRONMENTS, expected)) {
    const env = ENVIRONMENTS[expected];
    label = env.label;
    if (env.organizationId == null) {
      fail('environment "' + expected + '" (' + env.label + ') has no recorded ' +
           'OrganizationId. Read it from WhoAmI against that org and record it ' +
           'in ENVIRONMENTS before deploying. Refusing to proceed unverified.');
    }
    want = normalizeId(env.organizationId);
  } else {
    want = normalizeId(expected);
    if (!want) {
      fail('no expected OrganizationId was supplied. The wave must declare its ' +
           'target org; the component GUIDs are identical across orgs, so ' +
           'nothing downstream can tell them apart.');
    }
  }

  const got = normalizeId(
    actual && typeof actual === 'object'
      ? (actual.OrganizationId != null ? actual.OrganizationId : actual.organizationId)
      : actual
  );
  if (!got) {
    fail('no OrganizationId could be read from the platform response. A deploy ' +
         'must not proceed on an unverified connection.');
  }

  if (got !== want) {
    fail('WRONG ORGANIZATION. Expected ' + want + (label ? ' (' + label + ')' : '') +
         ' but the connection reports ' + got + '. The web resource GUIDs are ' +
         'identical in both orgs, so this write would have succeeded silently ' +
         'against the wrong company. Aborting before any PATCH.');
  }
  return { organizationId: got, label: label };
}

/* Check 2a -- every component in this publish belongs to us. */
function assertOwned(names) {
  const list = Array.isArray(names) ? names : [names];
  if (!list.length) fail('a targeted publish named no components.');
  const foreign = list.filter(n => String(n || '').toLowerCase().indexOf(OWNED_PREFIX) !== 0);
  if (foreign.length) {
    fail('refusing to publish components outside the ' + OWNED_PREFIX + ' line: ' +
         foreign.join(', ') + '. The legacy cr2bf_ line is shared and is not ' +
         'ours to republish.');
  }
  return list;
}

/* Check 2b -- the ParameterXml for a PublishXml that names only our resources.
 *
 * PublishXml takes ids, not names, so the caller passes the web resource ids it
 * is about to PATCH. Each is normalized, which also rejects anything that is
 * not a GUID before it reaches the wire. */
function buildPublishXml(webResourceIds) {
  const list = Array.isArray(webResourceIds) ? webResourceIds : [webResourceIds];
  if (!list.length) fail('buildPublishXml was given no web resource ids.');
  const ids = list.map(id => {
    const n = normalizeId(id);
    if (!n) fail('not a web resource id: ' + JSON.stringify(id));
    return n;
  });
  const seen = Object.create(null);
  ids.forEach(id => {
    if (seen[id]) fail('duplicate web resource id in publish set: ' + id);
    seen[id] = true;
  });
  return '<importexportxml><webresources>' +
    ids.map(id => '<webresource>' + id + '</webresource>').join('') +
    '</webresources></importexportxml>';
}

/* Check 2c -- a text lint, so the footgun is caught in review rather than in
 * an org. Returns the shapes found; an empty array means clean. */
function scanForPublishAll(text) {
  const s = String(text == null ? '' : text);
  return PUBLISH_ALL_SHAPES.filter(shape => s.indexOf(shape) >= 0);
}

function assertNoPublishAll(text, where) {
  const hits = scanForPublishAll(text);
  if (hits.length) {
    fail('publish-all shape' + (hits.length > 1 ? 's' : '') + ' found' +
         (where ? ' in ' + where : '') + ': ' + hits.join(', ') +
         '. Use buildPublishXml with only the ' + OWNED_PREFIX + ' components.');
  }
  return true;
}

module.exports = {
  ENVIRONMENTS, OWNED_PREFIX, PUBLISH_ALL_SHAPES,
  normalizeId, assertOrganization, assertOwned,
  buildPublishXml, scanForPublishAll, assertNoPublishAll
};

/* ---- CLI ----
 *   node tools/deploy_guard.js envs
 *   node tools/deploy_guard.js publish-xml <id> [id...]
 *   node tools/deploy_guard.js lint <file> [file...]
 */
if (require.main === module) {
  const fs = require('fs');
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    if (cmd === 'envs') {
      Object.keys(ENVIRONMENTS).forEach(k => {
        const e = ENVIRONMENTS[k];
        console.log(k.padEnd(26) + (e.organizationId || '(NOT RECORDED -- guard will refuse)').padEnd(40) + e.label);
      });
    } else if (cmd === 'publish-xml') {
      console.log(buildPublishXml(rest));
    } else if (cmd === 'lint') {
      if (!rest.length) { console.error('lint needs at least one file'); process.exit(2); }
      let bad = 0;
      rest.forEach(f => {
        const hits = scanForPublishAll(fs.readFileSync(f, 'utf8'));
        if (hits.length) { bad++; console.log('PUBLISH-ALL  ' + f + '  -> ' + hits.join(', ')); }
        else console.log('clean        ' + f);
      });
      process.exit(bad ? 1 : 0);
    } else {
      console.error('usage: deploy_guard.js envs | publish-xml <id...> | lint <file...>');
      process.exit(2);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
