// Device-code sign-in for the Dataverse Web API (Clara Fortuna Dev).
// The user signs in in their own browser; this script only receives a token,
// which it keeps in token.json next to it (deleted when the work is done).
const fs = require('fs');
const ORG = 'https://org9076e69b.crm.dynamics.com';
// Microsoft's public client used by the Dataverse samples.
const CLIENT = '51f81489-12ee-4a9e-aaae-a2591f45987d';
const TENANT = 'organizations';
const SCOPE = ORG + '/user_impersonation offline_access';

(async () => {
  const dc = await (await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/devicecode`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT, scope: SCOPE })
  })).json();
  if (!dc.device_code) { console.log('DEVICECODE ERROR', JSON.stringify(dc)); process.exit(1); }
  console.log('CODE', dc.user_code, dc.verification_uri);
  const until = Date.now() + dc.expires_in * 1000;
  while (Date.now() < until) {
    await new Promise(r => setTimeout(r, (dc.interval || 5) * 1000));
    const t = await (await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code', client_id: CLIENT, device_code: dc.device_code })
    })).json();
    if (t.access_token) {
      fs.writeFileSync(__dirname + '/token.json', JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token, exp: Date.now() + t.expires_in * 1000 }));
      const who = await (await fetch(ORG + '/api/data/v9.2/WhoAmI', { headers: { Authorization: 'Bearer ' + t.access_token } })).json();
      console.log('SIGNED IN', JSON.stringify(who));
      return;
    }
    if (t.error && t.error !== 'authorization_pending' && t.error !== 'slow_down') { console.log('TOKEN ERROR', t.error, t.error_description); process.exit(1); }
  }
  console.log('EXPIRED');
})();
