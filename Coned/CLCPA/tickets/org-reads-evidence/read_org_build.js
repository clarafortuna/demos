/* READ-ONLY: what is the org actually serving right now?
 *
 * The live build is only knowable by reading the org. This script authenticates
 * and does three GETs. It writes nothing, PATCHes nothing, publishes nothing,
 * and touches no file except its own console output.
 */
const crypto = require('crypto');

const ORG = 'https://org9076e69b.crm.dynamics.com';
const API = ORG + '/api/data/v9.2/';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d';
const TENANT = 'organizations';
const RES = [
  { file: 'app.js', id: '79151fe9-3c64-f111-ab0c-7c1e521c7110' },
  { file: 'styles.css', id: '7b151fe9-3c64-f111-ab0c-7c1e521c7110' },
  { file: 'ExecutiveDashboard.html', id: '77151fe9-3c64-f111-ab0c-7c1e521c7110' },
];
const SENTINEL = "var APP_BUILD = 'dev';   /* BUILD_ID */";
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const canon = (t) => t.replace(/var APP_BUILD = '[^']*';   \/\* BUILD_ID \*\//, SENTINEL);
const stampOf = (t) => {
  const m = t.match(/var APP_BUILD = '([^']*)';   \/\* BUILD_ID \*\//);
  return m ? m[1] : null;
};

(async () => {
  const dcRes = await fetch('https://login.microsoftonline.com/' + TENANT + '/oauth2/v2.0/devicecode', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: ORG + '/.default offline_access' }),
  });
  const dc = await dcRes.json();
  if (!dcRes.ok) { console.error('device code failed: ' + JSON.stringify(dc)); process.exit(1); }
  console.log(['', '################  ACTION NEEDED  ################',
    '  Open:  ' + dc.verification_uri, '  Code:  ' + dc.user_code,
    '  (READ-ONLY: three GETs, nothing is written)',
    '#################################################', ''].join('\n'));
  let token = null;
  const t0 = Date.now(); let iv = (dc.interval || 5) * 1000;
  while (Date.now() - t0 < (dc.expires_in || 900) * 1000 && !token) {
    await new Promise(r => setTimeout(r, iv));
    const res = await fetch('https://login.microsoftonline.com/' + TENANT + '/oauth2/v2.0/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: CLIENT_ID, device_code: dc.device_code }),
    });
    const j = await res.json();
    if (res.ok && j.access_token) { token = j.access_token; break; }
    if (j.error === 'authorization_pending') continue;
    if (j.error === 'slow_down') { iv += 5000; continue; }
    console.error('token poll failed: ' + JSON.stringify(j)); process.exit(1);
  }
  if (!token) { console.error('timed out'); process.exit(1); }
  console.log('Authorized. Reading (GET only).');
  console.log('');

  const get = async (u) => {
    const r = await fetch(API + u, { headers: { Authorization: 'Bearer ' + token,
      Accept: 'application/json', 'OData-MaxVersion': '4.0', 'OData-Version': '4.0' } });
    if (!r.ok) { console.error('GET ' + u + ' -> ' + r.status); process.exit(1); }
    return JSON.parse(await r.text());
  };

  const out = {};
  for (const r of RES) {
    const j = await get('webresourceset(' + r.id + ')?$select=name,content');
    const buf = Buffer.from(j.content || '', 'base64');
    out[r.file] = buf;
    console.log(r.file.padEnd(26) + j.name + '   ' + buf.length + 'B');
  }
  console.log('');
  const appText = out['app.js'].toString('utf8');
  console.log('THE ORG IS SERVING:');
  console.log('  app.js APP_BUILD stamp        : ' + stampOf(appText));
  console.log('  app.js canonicalised + hashed : ' +
    sha256(Buffer.from(canon(appText), 'utf8')).slice(0, 10));
  console.log('  styles.css hashed             : ' + sha256(out['styles.css']).slice(0, 10));
  const html = out['ExecutiveDashboard.html'].toString('utf8');
  console.log('  HTML ?v= stamps               : ' +
    ((html.match(/\?v=[0-9a-f]+/g) || []).join(' ') || 'none'));
  console.log('');
  /* the two findings this session must re-verify at the source level: are the
   * round-3 caption engine and the CLCPA-266 notice component really in the
   * bytes the org serves? */
  console.log('PRESENT IN THE SERVED app.js:');
  [['stripCaptionYear', 'function stripCaptionYear('],
   ['deriveTableCaptionInfo', 'function deriveTableCaptionInfo('],
   ['the is-warn accent class', 'ingest-import-notice is-warn'],
   ['the is-alert accent class', 'ingest-import-notice is-alert'],
   ['dacCol', 'function dacCol('],
  ].forEach(([label, needle]) =>
    console.log('  ' + (appText.indexOf(needle) >= 0 ? 'yes' : 'NO ') + '  ' + label));
  const css = out['styles.css'].toString('utf8');
  console.log('PRESENT IN THE SERVED styles.css:');
  [['the shared notice-box component', '.ingest-import-notice {'],
   ['.is-warn amber', '.ingest-import-notice.is-warn'],
   ['.is-alert red', '.ingest-import-notice.is-alert'],
  ].forEach(([label, needle]) =>
    console.log('  ' + (css.indexOf(needle) >= 0 ? 'yes' : 'NO ') + '  ' + label));
})().catch(e => { console.error('ERROR: ' + (e && e.stack ? e.stack : e)); process.exit(2); });
