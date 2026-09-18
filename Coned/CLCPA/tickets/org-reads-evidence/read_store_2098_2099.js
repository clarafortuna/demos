/* READ ONLY. Completes CLCPA-278 round 3's ruling condition 2.
 *
 * Reads the ingest override rows for 2098 and 2099 from the org store and
 * counts, per year and per table: total value cells, string cells, and
 * NUMERIC-LOOKING string cells as bareNumber judges them -- then lists every
 * numeric-looking cell it finds, so the blast radius is concrete rather than a
 * number.
 *
 * NOTHING IS WRITTEN TO DATAVERSE. Every request that names the org goes
 * through one helper and that helper is GET. There is exactly one non-GET in
 * the file -- the device-code exchange, which a POST is the only way to make --
 * and it goes to Microsoft's identity endpoint carrying a client id and a
 * device code, never org data. PRE-FLIGHT 0 audits this file's own text for
 * both facts before the device code is requested, and says so plainly rather
 * than claiming a purity the OAuth flow does not allow.
 *
 * Discipline 142 stands: the GO authorises reading.
 *
 * THE PREDICATE IS THE SHIPPED ONE. bareNumber is sliced out of app.js rather
 * than re-typed here, because a re-typed copy of the rule under test is how a
 * measurement comes back agreeing with itself.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const ORG = 'https://org9076e69b.crm.dynamics.com';
const API = ORG + '/api/data/v9.2/';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d';
const TENANT = 'organizations';
const SET_TABLEDATA = 'cr2bf_dacingesttesttabledata1s';
const YEARS = [2098, 2099];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const die = (m) => { log(''); log('STOP: ' + m); flush(); process.exit(1); };
const flush = () => {
  try { fs.writeFileSync(path.join(__dirname, 'store-read-2098-2099.txt'),
    lines.join('\n') + '\n'); } catch (e) {}
};

/* ---------------------------------------------------------- PRE-FLIGHT 0 */
log('=== READ-ONLY store read: ingest overrides for ' + YEARS.join(' and ') + ' ===');
log('org: ' + ORG);
log('');
/* AUDIT-BLOCK-START */
{
  const self = fs.readFileSync(__filename, 'utf8');
  /* THE AUDIT EXCLUDES ITSELF, between the two markers, and nothing else.
   * Its own test patterns name the verbs it is looking for, so scanning the
   * whole file makes it report three POSTs where the code issues one. The
   * exclusion is one visible region rather than a clever spelling of the
   * verbs, which is what an earlier draft did -- and a gate that dodges its
   * own vocabulary is a gate written to pass. */
  const code = self
    .replace(/\/\* AUDIT-BLOCK-START \*\/[\s\S]*?\/\* AUDIT-BLOCK-END \*\//, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  /* THE ONE WRITE VERB IN THIS FILE IS THE OAUTH EXCHANGE, and it is stated
   * rather than hidden: a device-code flow cannot be done with a GET. It goes
   * to login.microsoftonline.com, carries a client id and a device code, and
   * never touches the org. An earlier draft of this audit built the forbidden
   * verbs out of concatenated characters so the file would not trip over its
   * own vocabulary -- which is a gate written to pass rather than to catch. */
  const writeVerbs = code.match(/-X [A-Z]+|method: '[A-Z]+'/g) || [];
  const toOrg = writeVerbs.filter(v => !/GET/.test(v));
  if (toOrg.length !== 1 || !/-X POST/.test(toOrg[0])) {
    die('expected exactly one non-GET, the identity exchange; found ' +
        JSON.stringify(writeVerbs));
  }
  const idpHost = 'login.microsoftonline.com';
  const postLine = code.split('\n').filter(l => /-X POST/.test(l))[0] || '';
  if (postLine.indexOf(idpHost) < 0) {
    die('the one POST does not go to the identity endpoint: ' + postLine.trim().slice(0, 90));
  }
  /* and every request that names the org must be a GET through the one helper */
  if (/API \+[\s\S]{0,400}?method: '(?!GET)/.test(code)) {
    die('a request to the org uses a verb other than GET.');
  }
  const gets = (code.match(/method: 'GET'/g) || []).length;
  if (gets !== 1) die('expected exactly one request helper, found ' + gets);
  log('PRE-FLIGHT 0  self-audit: ONE request helper and it is GET; the only');
  log('              non-GET is the device-code exchange to ' + idpHost + ',');
  log('              which carries no org data. Nothing can write to Dataverse.');
}
/* AUDIT-BLOCK-END */

/* ------------------------------------------------- the shipped predicate */
let bareNumber;
{
  const src = fs.readFileSync(path.join(REPO, REL), 'utf8');
  const L = src.split('\r\n');
  const start = L.findIndex(l => /^  function bareNumber\(v\) \{/.test(l));
  if (start < 0) die('cannot find bareNumber in app.js');
  let end = start;
  while (end < L.length && L[end] !== '  }') end++;
  const slice = L.slice(start, end + 1).join('\n');
  bareNumber = new Function(slice + '\nreturn bareNumber;')();
  if (bareNumber('1,098') !== 1098 || bareNumber('33%') !== null) {
    die('the sliced predicate does not behave like bareNumber');
  }
  log('PRE-FLIGHT 1  bareNumber sliced from the shipped app.js, behaviour checked.');
  log('              "1,098" -> 1098   "33%" -> null');
}
log('');

/* --------------------------------------------------------------- the read */
const getJson = (url, token) => new Promise((res, rej) => {
  const u = new URL(url);
  const req = https.request({
    hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/json',
      'OData-MaxVersion': '4.0', 'OData-Version': '4.0',
      Prefer: 'odata.maxpagesize=500',
    },
  }, (r) => {
    let b = '';
    r.on('data', c => { b += c; });
    r.on('end', () => {
      if (r.statusCode >= 400) return rej(new Error('HTTP ' + r.statusCode + ' ' + b.slice(0, 300)));
      try { res(JSON.parse(b)); } catch (e) { rej(e); }
    });
  });
  req.on('error', rej);
  req.end();
});

const form = (obj) => Object.keys(obj).map(k =>
  encodeURIComponent(k) + '=' + encodeURIComponent(obj[k])).join('&');

/* THE DEVICE-CODE EXCHANGE, and the only non-GET in this file. It goes to
 * Microsoft's identity endpoint, carries a client id and a device code, and
 * never names the org's data. Issued through curl so this file's own request
 * helper stays GET-only and the audit above can say so without qualification. */
const idp = (pathname, payload) => {
  const out = execSync('curl -s -X POST https://login.microsoftonline.com' + pathname +
    ' -H "Content-Type: application/x-www-form-urlencoded" --data ' +
    JSON.stringify(form(payload)), { maxBuffer: 1 << 24 }).toString();
  return JSON.parse(out);
};

(async () => {
  const dc = idp('/' + TENANT + '/oauth2/v2.0/devicecode',
    { client_id: CLIENT_ID, scope: ORG + '/.default offline_access' });
  if (!dc.user_code) die('no device code: ' + JSON.stringify(dc).slice(0, 200));
  log('');
  log('################  ACTION NEEDED  ################');
  log('  Open:  ' + dc.verification_uri);
  log('  Code:  ' + dc.user_code);
  log('#################################################');
  log('');
  flush();

  let token = null;
  const deadline = Date.now() + (dc.expires_in || 900) * 1000;
  while (!token && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, (dc.interval || 5) * 1000));
    const t = idp('/' + TENANT + '/oauth2/v2.0/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: CLIENT_ID, device_code: dc.device_code,
    });
    if (t.access_token) token = t.access_token;
    else if (t.error && t.error !== 'authorization_pending') {
      die('authorization failed: ' + t.error + ' ' + (t.error_description || '').slice(0, 160));
    }
  }
  if (!token) die('the device code expired before it was used.');
  log('Authorized.');

  const who = await getJson(API + 'WhoAmI', token);
  log('signed in, org user ' + (who.UserId || '(unknown)'));
  log('');

  /* read the override rows for the two years */
  const filter = YEARS.map(y => 'cr2bf_year eq ' + y).join(' or ');
  const url = API + SET_TABLEDATA +
    '?$select=cr2bf_key,cr2bf_section,cr2bf_tableid,cr2bf_year,cr2bf_rows,cr2bf_schema' +
    '&$filter=' + encodeURIComponent(filter);
  let page = await getJson(url, token);
  const rows = (page.value || []).slice();
  let guard = 0;
  while (page['@odata.nextLink'] && guard++ < 50) {
    page = await getJson(page['@odata.nextLink'], token);
    rows.push.apply(rows, page.value || []);
  }
  log('READ  ' + rows.length + ' override row(s) for ' + YEARS.join('/') +
      '   (GET only, nothing written)');
  log('');

  /* ------------------------------------------------------------- counting */
  const per = {};
  const hits = [];
  rows.forEach((r) => {
    const year = String(r.cr2bf_year);
    const tableId = r.cr2bf_tableid;
    let data = [];
    try { data = JSON.parse(r.cr2bf_rows || '[]'); } catch (e) { data = []; }
    let schema = [];
    try { schema = r.cr2bf_schema ? JSON.parse(r.cr2bf_schema) : []; } catch (e) { schema = []; }
    const k = year + '|' + tableId;
    per[k] = per[k] || { year: year, tableId: tableId, rows: data.length, cells: 0, strings: 0, numeric: 0 };
    data.forEach((row) => {
      if (!Array.isArray(row)) return;
      const label = row[0] == null ? '' : String(row[0]);
      /* VALUE cells only: column 0 is the row label, which is text by design */
      row.slice(1).forEach((v, j) => {
        const c = j + 1;
        per[k].cells++;
        if (typeof v !== 'string' || v === '') return;
        per[k].strings++;
        if (bareNumber(v) !== null) {
          per[k].numeric++;
          hits.push({ year: year, tableId: tableId, label: label,
            column: schema[c] == null ? ('col ' + c) : String(schema[c]), raw: v });
        }
      });
    });
  });

  log('PER YEAR AND TABLE');
  log('  year  table   rows   value cells   string cells   numeric-looking');
  const keys = Object.keys(per).sort();
  const tot = { cells: 0, strings: 0, numeric: 0 };
  keys.forEach((k) => {
    const p = per[k];
    tot.cells += p.cells; tot.strings += p.strings; tot.numeric += p.numeric;
    log('  ' + p.year + '  ' + String(p.tableId).padEnd(6) + '  ' +
        String(p.rows).padStart(4) + '   ' + String(p.cells).padStart(11) + '   ' +
        String(p.strings).padStart(12) + '   ' + String(p.numeric).padStart(15));
  });
  log('  ' + ''.padEnd(14) + 'TOTAL  ' + String(tot.cells).padStart(11) + '   ' +
      String(tot.strings).padStart(12) + '   ' + String(tot.numeric).padStart(15));
  log('');

  log('EVERY NUMERIC-LOOKING STRING CELL');
  if (!hits.length) {
    log('  none. Condition 2 closes: the store holds no cell whose judgement');
    log('  this change moves.');
  } else {
    hits.forEach((h) => {
      log('  ' + h.year + '  ' + String(h.tableId).padEnd(5) + '  row ' +
          JSON.stringify(h.label).slice(0, 34).padEnd(36) +
          'column ' + JSON.stringify(h.column).slice(0, 30).padEnd(32) +
          'raw ' + JSON.stringify(h.raw));
    });
  }
  log('');
  log('=== READ COMPLETE === requests: GET only. Nothing written, nothing deleted.');
  flush();
})().catch((e) => { die('read failed: ' + (e && e.message)); });
