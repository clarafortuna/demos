/* CLCPA-219 F7 probe: is the PUBLISHED 2020 tract geometry stamped?
 *
 * READ ONLY. GET requests only -- no PATCH, no POST, no DELETE, and no
 * activation. The script has no code path that writes; that is asserted below
 * before a token is requested, so the claim is checkable rather than promised.
 *
 * THE QUESTION. The August clean-room record said the repository's
 * tract_geometry_pure-2020.json was stale -- 87 bytes short, missing
 * sourceFingerprint -- and added that "the published 2020 geometry in Dataverse
 * is also unstamped and also unverified". The repo half is now resolved: a clean
 * build from the handoff package reproduces the committed file byte for byte
 * (d288460f7907a79e, 1,285,052 B) and it carries
 * sourceFingerprint 682970681ce906812e89066841e50f0611c447b4 under `dataset`.
 *
 * What nobody has checked is what is actually PUBLISHED. If the active 2020
 * geometry row in Dataverse predates the fingerprint stamping, then the map is
 * drawing 2020 geometry whose provenance cannot be tied to any build -- which is
 * the whole reason the stamp exists.
 *
 * WHAT IT READS
 *   cr2bf_dactractdataset rows for the tract_geometry family: which are active,
 *   their declared vintage, version, and whether the stored file's `dataset`
 *   block carries sourceFingerprint. The file column is fetched for the ACTIVE
 *   2020 row only, and hashed rather than printed.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ORG = 'https://org9076e69b.crm.dynamics.com';
const API = ORG + '/api/data/v9.2/';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d';
const TENANT = 'organizations';

const EXPECT_REPO_SHA = 'd288460f7907a79e2bc4f9c6f578cf66ac0aee840fbdeffb38670021c24b875e';
const EXPECT_FINGERPRINT = '682970681ce906812e89066841e50f0611c447b4';

const log = (...a) => console.log(...a);
const die = (m) => { console.error('\nSTOP: ' + m); process.exit(1); };
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
let GETS = 0;

/* ---- READ-ONLY, ENFORCED AT RUNTIME ------------------------------------
 *
 * The first version of this audit scanned the script's own text for write
 * verbs. It was wrong twice: it tripped on the very list it was checking
 * against, because the regex literals doing the stripping contain apostrophes,
 * so quote-pairing broke and later string literals survived the strip. A
 * text heuristic that cannot parse its own source is not a guarantee.
 *
 * So the rule is enforced instead of asserted. Every outbound request goes
 * through this wrapper, which permits exactly two things:
 *
 *   POST to login.microsoftonline.com   (the device-code and token endpoints)
 *   GET  to anything else               (the reads this probe exists to do)
 *
 * Anything else throws before it reaches the network. A write cannot be added
 * to this script by accident, and no reader has to take my word for it.
 */
const _rawFetch = globalThis.fetch;
let BLOCKED = 0;
globalThis.fetch = function (url, opts) {
  const method = ((opts && opts.method) || 'GET').toUpperCase();
  const u = String(url);
  const isAuth = u.indexOf('https://login.microsoftonline.com/') === 0;
  if (isAuth && method === 'POST') return _rawFetch(url, opts);
  if (!isAuth && method === 'GET') return _rawFetch(url, opts);
  BLOCKED++;
  throw new Error('BLOCKED by the read-only wrapper: ' + method + ' ' +
    u.slice(0, 90) + '\n  This probe may only GET from the org and POST to the ' +
    'token endpoint. Nothing was sent.');
};
log('PRE-FLIGHT  read-only is ENFORCED, not asserted: every request passes a');
log('            wrapper that permits GET to the org and POST only to the token');
log('            endpoint, and throws on anything else before it reaches the wire.');
log('');

async function deviceCode() {
  const res = await fetch('https://login.microsoftonline.com/' + TENANT + '/oauth2/v2.0/devicecode', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: ORG + '/.default offline_access' }),
  });
  const j = await res.json();
  if (!res.ok) die('device code request failed: ' + JSON.stringify(j));
  return j;
}
async function pollToken(dc, iv, exp) {
  const t0 = Date.now(); let interval = (iv || 5) * 1000;
  while (Date.now() - t0 < (exp || 900) * 1000) {
    await new Promise(r => setTimeout(r, interval));
    const res = await fetch('https://login.microsoftonline.com/' + TENANT + '/oauth2/v2.0/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                                 client_id: CLIENT_ID, device_code: dc }),
    });
    const j = await res.json();
    if (res.ok && j.access_token) return j.access_token;
    if (j.error === 'authorization_pending') continue;
    if (j.error === 'slow_down') { interval += 5000; continue; }
    if (j.error === 'expired_token') die('the device code expired before it was authorized.');
    if (j.error === 'authorization_declined') die('sign-in was declined.');
    die('token poll failed: ' + JSON.stringify(j));
  }
  die('timed out waiting for authorization.');
}
let TOKEN = null;
async function get(url) {
  GETS++;
  const res = await fetch(API + url, {
    headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/json',
               'OData-MaxVersion': '4.0', 'OData-Version': '4.0' },
  });
  if (res.status === 401 || res.status === 403) {
    die('permission error ' + res.status + ' reading ' + url + '\n' +
        (await res.text()).slice(0, 300) + '\nNot retrying, not changing roles.');
  }
  if (!res.ok) die('GET ' + url + ' -> ' + res.status + '\n' + (await res.text()).slice(0, 300));
  const t = await res.text();
  return t ? JSON.parse(t) : {};
}

(async () => {
  const dc = await deviceCode();
  log(['################  ACTION NEEDED  ################',
       '  Open:  ' + dc.verification_uri, '  Code:  ' + dc.user_code,
       '#################################################', ''].join('\n'));
  fs.writeFileSync(path.join(__dirname, 'device_code.txt'), dc.user_code + '\n');
  log('Waiting for authorization (up to ' + Math.round((dc.expires_in || 900) / 60) + ' min)...');
  TOKEN = await pollToken(dc.device_code, dc.interval, dc.expires_in);
  log('Authorized.');
  log('');

  const who = await get('WhoAmI');
  log('WhoAmI UserId = ' + who.UserId);

  // Resolve the entity set name from metadata rather than guessing the plural.
  const meta = await get("EntityDefinitions(LogicalName='cr2bf_dactractdataset')?$select=EntitySetName");
  const set = meta.EntitySetName;
  log('entity set: ' + set);
  log('');

  const cols = ['cr2bf_dactractdatasetid', 'cr2bf_datasetkey', 'cr2bf_version',
                'cr2bf_geoidvintage', 'cr2bf_isactive', 'cr2bf_datafile', 'createdon'];
  const rows = (await get(set + '?$select=' + cols.join(',') + '&$orderby=createdon asc')).value || [];
  log('rows in ' + set + ': ' + rows.length);
  log('');
  log('%-14s %-8s %-8s %-7s %s'.replace(/%-?(\d+)s/g, (m, n) => ' '.repeat(0)) ||
      '');
  const pad = (s, n) => String(s === null || s === undefined ? '-' : s).padEnd(n);
  log(pad('datasetKey', 20) + pad('version', 9) + pad('vintage', 9) +
      pad('active', 8) + pad('file?', 7) + 'created');
  log('-'.repeat(78));
  rows.forEach(r => {
    log(pad(r.cr2bf_datasetkey, 20) + pad(r.cr2bf_version, 9) +
        pad(r.cr2bf_geoidvintage, 9) + pad(r.cr2bf_isactive, 8) +
        pad(r.cr2bf_datafile != null ? 'yes' : 'NO', 7) +
        String(r.createdon || '').slice(0, 10));
  });
  log('');

  // The active tract_geometry rows, per vintage.
  const geom = rows.filter(r => String(r.cr2bf_datasetkey || '').indexOf('tract_geometry') >= 0);
  const active = geom.filter(r => r.cr2bf_isactive === true);
  log('tract_geometry rows: ' + geom.length + ', active: ' + active.length);
  if (!active.length) {
    log('');
    log('FINDING: no ACTIVE tract_geometry row. The map has no published geometry');
    log('         dataset, so it is drawing from whatever fallback remains.');
  }

  for (const r of active) {
    const id = r.cr2bf_dactractdatasetid;
    const v = r.cr2bf_geoidvintage;
    log('');
    log('=== ACTIVE tract_geometry, vintage ' + v + ' (' + id + ') ===');
    if (r.cr2bf_datafile == null) {
      log('  the file column is NULL: this row has metadata and no file.');
      continue;
    }
    const url = API + set + '(' + id + ')/cr2bf_datafile/$value';
    GETS++;
    const fres = await fetch(url, { headers: { Authorization: 'Bearer ' + TOKEN } });
    if (!fres.ok) { log('  could not read the file column: ' + fres.status); continue; }
    const text = await fres.text();
    const buf = Buffer.from(text, 'utf8');
    log('  bytes  : ' + buf.length);
    log('  sha256 : ' + sha256(buf));
    let doc = null;
    try { doc = JSON.parse(text); } catch (e) { log('  NOT VALID JSON: ' + e.message); continue; }
    const ds = doc.dataset || {};
    const fp = ds.sourceFingerprint;
    log('  dataset.version          : ' + (ds.version || '(none)'));
    log('  dataset.geoidVintage     : ' + (ds.geoidVintage || '(none)'));
    log('  dataset.sourceFingerprint: ' + (fp || 'ABSENT'));
    if (!fp) {
      log('  FINDING: published vintage ' + v + ' geometry is UNSTAMPED. Its');
      log('           provenance cannot be tied to any build.');
    } else if (fp === EXPECT_FINGERPRINT) {
      log('  stamped, and it MATCHES the current repo build (' + EXPECT_FINGERPRINT.slice(0, 16) + '...)');
    } else {
      log('  stamped, but with a DIFFERENT fingerprint than the current repo build:');
      log('           published ' + fp);
      log('           repo      ' + EXPECT_FINGERPRINT);
    }
    if (String(v) === '2020') {
      log('  vs the clean 2020 build (' + EXPECT_REPO_SHA.slice(0, 16) + '...): ' +
          (sha256(buf) === EXPECT_REPO_SHA ? 'BYTE-IDENTICAL' : 'differs'));
    }
  }

  log('');
  log('=== PROBE COMPLETE === read-only. GET ' + GETS + ', writes 0.');
})().catch(e => { console.error('\nPROBE ERROR: ' + (e && e.stack ? e.stack : e)); process.exit(2); });
