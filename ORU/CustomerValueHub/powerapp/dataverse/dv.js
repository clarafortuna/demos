// Shared helpers: tokens from the saved refresh token, and JSON calls against
// Dataverse, the Flow API and the Power Apps API (Clara Fortuna Dev).
const fs = require('fs');
const ORG = 'https://org9076e69b.crm.dynamics.com', API = ORG + '/api/data/v9.2/';
const ENV = '5c344ac0-7294-e6e9-8c4e-0ad374893c12';
const CLIENT = '51f81489-12ee-4a9e-aaae-a2591f45987d', TF = __dirname + '/token.json';
const cache = {};
async function token(scope) {
  if (cache[scope]) return cache[scope];
  const t = JSON.parse(fs.readFileSync(TF, 'utf8'));
  const r = await (await fetch('https://login.microsoftonline.com/organizations/oauth2/v2.0/token', { method: 'POST',
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: CLIENT, refresh_token: t.refresh_token, scope }) })).json();
  if (!r.access_token) throw new Error('token ' + scope + ': ' + r.error_description);
  if (r.refresh_token) fs.writeFileSync(TF, JSON.stringify({ ...t, refresh_token: r.refresh_token }));
  return (cache[scope] = r.access_token);
}
async function req(base, scope, m, p, body, extra = {}) {
  const r = await fetch(base + p, { method: m, body: body ? JSON.stringify(body) : undefined,
    headers: { Authorization: 'Bearer ' + await token(scope), 'Content-Type': 'application/json', Accept: 'application/json', ...extra } });
  const tx = await r.text();
  if (!r.ok) { const e = new Error(m + ' ' + p.slice(0, 120) + ' ' + r.status + ' ' + tx.slice(0, 400)); e.status = r.status; throw e; }
  return tx ? JSON.parse(tx) : null;
}
const dv = (m, p, b, h) => req(API, ORG + '/.default', m, p, b, h);
const flow = (m, p, b) => req(`https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/${ENV}/`, 'https://service.flow.microsoft.com//.default', m, p, b);
const L = s => ({ '@odata.type': 'Microsoft.Dynamics.CRM.Label', LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: s, LanguageCode: 1033 }] });
module.exports = { ORG, API, ENV, token, dv, flow, L };
