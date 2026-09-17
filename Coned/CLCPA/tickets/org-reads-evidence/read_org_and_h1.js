/* READ-ONLY. One device code, two reads, nothing written.
 *
 *   (1) the three web resources -> what build the org actually serves
 *   (2) H1's stored rows for 2097 and 2099, verbatim
 *
 * No PATCH, no PublishXml. The only POST is the OAuth token poll.
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
const SET = 'cr2bf_dacingesttesttabledata1s';
const SEL = 'cr2bf_key,cr2bf_section,cr2bf_tableid,cr2bf_year,cr2bf_rows,cr2bf_schema,cr2bf_title';
const WANT_YEARS = ['2097', '2099'];
const EXP_APP = '804f35afc7';
const EXP_CSS = '04471d05bf';

const SENTINEL = "var APP_BUILD = 'dev';   /* BUILD_ID */";
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const canon = (t) => t.replace(/var APP_BUILD = '[^']*';   \/\* BUILD_ID \*\//, SENTINEL);
const stampOf = (t) => {
  const m = t.match(/var APP_BUILD = '([^']*)';   \/\* BUILD_ID \*\//);
  return m ? m[1] : null;
};
const typeTag = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);

(async () => {
  const dcRes = await fetch('https://login.microsoftonline.com/' + TENANT + '/oauth2/v2.0/devicecode', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: ORG + '/.default offline_access' }),
  });
  const dc = await dcRes.json();
  if (!dcRes.ok) { console.error('device code failed: ' + JSON.stringify(dc)); process.exit(1); }
  console.log(['', '################  ACTION NEEDED  ################',
    '  Open:  ' + dc.verification_uri, '  Code:  ' + dc.user_code,
    '  (READ-ONLY: web resources + H1 rows. Nothing is written.)',
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
  console.log('Authorized. GET only from here.');
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

  /* ---- READ 1: what the org actually serves ----------------------------- */
  console.log('======================================================================');
  console.log('READ 1  --  THE SERVED WEB RESOURCES');
  console.log('======================================================================');
  const out = {};
  for (const r of RES) {
    const j = await get('webresourceset(' + r.id + ')?$select=name,content');
    out[r.file] = Buffer.from(j.content || '', 'base64');
    console.log('  ' + r.file.padEnd(26) + j.name + '   ' + out[r.file].length + ' bytes');
  }
  const appText = out['app.js'].toString('utf8');
  const appId = sha256(Buffer.from(canon(appText), 'utf8')).slice(0, 10);
  const cssId = sha256(out['styles.css']).slice(0, 10);
  const html = out['ExecutiveDashboard.html'].toString('utf8');
  console.log('');
  console.log('  app.js APP_BUILD stamp        : ' + stampOf(appText));
  console.log('  app.js canonicalised + hashed : ' + appId);
  console.log('  styles.css hashed             : ' + cssId);
  console.log('  HTML ?v= stamps               : ' +
    ((html.match(/\?v=[0-9a-f]+/g) || []).join(' ') || 'none'));
  console.log('');
  console.log('  expected  app.js ' + EXP_APP + ' / styles.css ' + EXP_CSS);
  console.log('  VERDICT: ' + ((appId === EXP_APP && cssId === EXP_CSS)
    ? 'MATCH -- the org serves the expected pair'
    : 'MISMATCH -- served ' + appId + ' / ' + cssId));

  /* ---- READ 2: H1's stored rows for 2097 and 2099 ------------------------ */
  console.log('');
  console.log('======================================================================');
  console.log('READ 2  --  H1 STORED ROWS, YEARS 2097 AND 2099 (verbatim)');
  console.log('======================================================================');
  const q = await get(SET + '?$select=' + SEL + "&$filter=cr2bf_tableid eq 'H1'");
  const all = q.value || [];
  console.log('  H1 records in the table, all years: ' +
    all.map(r => String(r.cr2bf_year)).sort().join(', ') + '   (' + all.length + ' records)');
  console.log('');

  WANT_YEARS.forEach((y) => {
    const rec = all.find(r => String(r.cr2bf_year) === y);
    console.log('----------------------------------------------------------------------');
    console.log('H1 : ' + y);
    console.log('----------------------------------------------------------------------');
    if (!rec) { console.log('  NO RECORD for this table-year.'); console.log(''); return; }
    console.log('  cr2bf_key     : ' + JSON.stringify(rec.cr2bf_key));
    console.log('  cr2bf_section : ' + JSON.stringify(rec.cr2bf_section));
    console.log('  cr2bf_title   : ' + JSON.stringify(rec.cr2bf_title));
    console.log('  cr2bf_schema  : ' + (rec.cr2bf_schema == null
      ? 'null   <-- no schema of its own (the imported case)'
      : rec.cr2bf_schema));
    console.log('');
    console.log('  cr2bf_rows RAW:');
    console.log('    ' + (rec.cr2bf_rows == null ? 'null' : String(rec.cr2bf_rows)));
    console.log('');

    let rows = null;
    try { rows = JSON.parse(rec.cr2bf_rows); }
    catch (e) { console.log('  (rows did not parse: ' + e.message + ')'); console.log(''); return; }
    if (!Array.isArray(rows)) { console.log('  (rows is not an array)'); console.log(''); return; }

    console.log('  PARSED, cell by cell, with types:');
    rows.forEach((row, i) => {
      console.log('    [' + i + '] label ' + JSON.stringify((row || [])[0]));
      (row || []).forEach((c, j) => {
        console.log('          col ' + j + '  ' + JSON.stringify(c) + '   (' + typeTag(c) + ')');
      });
    });

    /* the two things CLCPA-250 turns on, stated plainly */
    const tot = rows.find(r => /^grand total$/i.test(String((r || [])[0])));
    const loose = rows.find(r => /total/i.test(String((r || [])[0])));
    console.log('');
    console.log('    a row matching /^Grand Total$/i exactly : ' + (tot ? 'FOUND' : 'NOT FOUND'));
    if (!tot && loose) {
      console.log('      but a row whose label CONTAINS "total" exists: ' +
        JSON.stringify(loose[0]) + '   <-- LABEL MISMATCH');
    }
    if (tot) {
      console.log('      its cells  : ' +
        tot.map(c => JSON.stringify(c) + ' (' + typeTag(c) + ')').join('  '));
      const nums = tot.slice(1).filter(c => typeof c === 'number').length;
      console.log('      numeric value cells: ' + nums + ' of ' + (tot.length - 1) +
        (nums === 0 ? '   <-- nothing numeric, so the KPI is omitted' : ''));
    }
    console.log('');
  });

  console.log('Done. Nothing was written.');
})().catch((e) => { console.error('ERROR: ' + (e && e.stack ? e.stack : e)); process.exit(2); });
