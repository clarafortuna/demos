/* READ-ONLY. One device code, one field: cr2bf_schema for H1:2098.
 *
 * No PATCH, no PublishXml. The only POSTs are the OAuth device-code request
 * and the token poll, both to login.microsoftonline.com.
 */
const ORG = 'https://org9076e69b.crm.dynamics.com';
const API = ORG + '/api/data/v9.2/';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d';
const TENANT = 'organizations';
const SET = 'cr2bf_dacingesttesttabledata1s';

(async () => {
  const dcRes = await fetch('https://login.microsoftonline.com/' + TENANT + '/oauth2/v2.0/devicecode', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: ORG + '/.default offline_access' }),
  });
  const dc = await dcRes.json();
  if (!dcRes.ok) { console.error('device code failed: ' + JSON.stringify(dc)); process.exit(1); }
  console.log(['', '################  ACTION NEEDED  ################',
    '  Open:  ' + dc.verification_uri, '  Code:  ' + dc.user_code,
    '  (READ-ONLY: one field. Nothing is written.)',
    '#################################################', ''].join('\n'));

  let token = null;
  const t0 = Date.now();
  let iv = (dc.interval || 5) * 1000;
  while (Date.now() - t0 < (dc.expires_in || 900) * 1000 && !token) {
    await new Promise(r => setTimeout(r, iv));
    const res = await fetch('https://login.microsoftonline.com/' + TENANT + '/oauth2/v2.0/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: CLIENT_ID, device_code: dc.device_code,
      }),
    });
    const j = await res.json();
    if (res.ok && j.access_token) { token = j.access_token; break; }
    if (j.error === 'authorization_pending') continue;
    if (j.error === 'slow_down') { iv += 5000; continue; }
    console.error('token poll failed: ' + JSON.stringify(j)); process.exit(1);
  }
  if (!token) { console.error('timed out'); process.exit(1); }
  console.log('Authorized. One GET.');
  console.log('');

  const get = async (u) => {
    const r = await fetch(API + u, {
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json',
        'OData-MaxVersion': '4.0', 'OData-Version': '4.0' },
    });
    const body = await r.text();
    if (!r.ok) {
      console.error('GET ' + u + ' -> ' + r.status);
      console.error(body.slice(0, 700));
      process.exit(1);
    }
    return JSON.parse(body);
  };

  const q = await get(SET + "?$select=cr2bf_key,cr2bf_schema&$filter=cr2bf_key eq 'H1:2098'");
  const recs = q.value || [];
  console.log('======================================================================');
  console.log('cr2bf_schema for H1:2098');
  console.log('======================================================================');
  if (!recs.length) {
    console.log('  NO RECORD with cr2bf_key = "H1:2098".');
    console.log('  Nothing further read.');
    console.log('');
    console.log('Done. Nothing was written.');
    return;
  }
  const rec = recs[0];
  console.log('  cr2bf_key    : ' + JSON.stringify(rec.cr2bf_key));
  console.log('');
  console.log('  cr2bf_schema VERBATIM:');
  console.log('    ' + (rec.cr2bf_schema === null ? 'null' : String(rec.cr2bf_schema)));
  console.log('');

  /* Parsed only so the column names are legible. No interpretation beyond this. */
  if (rec.cr2bf_schema != null) {
    let s = null;
    try { s = JSON.parse(rec.cr2bf_schema); } catch (e) {
      console.log('  (did not parse as JSON: ' + e.message + ')');
    }
    if (Array.isArray(s)) {
      console.log('  parsed, ' + s.length + ' columns:');
      s.forEach((h, i) => console.log('    [' + i + '] ' + JSON.stringify(h)));
      const gt = s.findIndex(h => h != null && /^Grand Total$/i.test(String(h)));
      const dr = s.findIndex(h => h != null && /^DAC Repairs/i.test(String(h)));
      console.log('');
      console.log('    index of a header matching /^Grand Total$/i  : ' + gt);
      console.log('    index of a header matching /^DAC Repairs/i   : ' + dr);
    }
  }
  console.log('');
  console.log('Done. Nothing was written.');
})().catch((e) => { console.error('ERROR: ' + (e && e.stack ? e.stack : e)); process.exit(2); });
