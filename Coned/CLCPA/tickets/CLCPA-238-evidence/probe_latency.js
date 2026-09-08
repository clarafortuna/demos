/* CLCPA-238 STEP ZERO: what a Dataverse round trip actually costs.
 *
 * READ-ONLY BY CONSTRUCTION, self-checked before the network: no PATCH, DELETE
 * or PUT anywhere in this file, its only two POSTs are the OAuth token calls to
 * login.microsoftonline.com, and no request against the org carries a method at
 * all.
 *
 * WHAT THIS MEASURES: the five requests dvBackend boot actually issues, timed
 * individually, then the three cacheable reads timed SEQUENTIALLY (as shipped,
 * app.js:809/817/823) against the same three in PARALLEL. That is the
 * Promise.all question answered with numbers instead of assertion.
 *
 * WHAT THIS DOES NOT MEASURE, and must not be read as measuring:
 *   - the BROWSER. This is Node on Emely's machine with a bearer token. The
 *     hosted app runs same-origin inside Power Apps with cookie auth, a
 *     different TLS session, and a different network path. Browser parse,
 *     layout and script-eval time are absent entirely.
 *   - ConEd's network. Whatever a ConEd viewer experiences is not this.
 *   - the 1,271 ms boot figure's composition. Nothing here attributes a split
 *     of it; that needs instrumentation inside the running page.
 * So these numbers bound the SHAPE of the cost (how many round trips, what one
 * costs, what parallelising saves) and not the walkthrough's boot time.
 */
const fs = require('fs');
const path = require('path');

const ORG = 'https://org9076e69b.crm.dynamics.com';
const API = ORG + '/api/data/v9.2/';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d';
const TENANT = 'organizations';
const N = 5;                       // iterations, so a median exists

const SET_TABLEDATA = 'cr2bf_dacingesttesttabledata1s';
const SET_HISTORY = 'cr2bf_dacingesttestchangehistories';
const SET_YEARS = 'cr2bf_dacingesttestreportingyears';
const ID_TABLEDATA = 'cr2bf_dacingesttesttabledata1id';
const ID_HISTORY = 'cr2bf_dacingesttestchangehistoryid';
const ID_YEARS = 'cr2bf_dacingesttestreportingyearid';

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const die = (m) => { console.error('\nSTOP: ' + m); flush(); process.exit(1); };
function flush() {
  try { fs.writeFileSync(path.join(__dirname, 'probe_latency.log'), lines.join('\n') + '\n'); }
  catch (e) { /* console is still the record */ }
}
let GETS = 0;

/* ---- self-check, before the network ---------------------------------- */
{
  const body = fs.readFileSync(__filename, 'utf8');
  const Q = String.fromCharCode(39);
  const mutating = ['PAT' + 'CH', 'DELE' + 'TE', 'P' + 'UT'];
  const found = mutating.filter(v => body.indexOf(Q + v + Q) >= 0 || body.indexOf('"' + v + '"') >= 0);
  if (found.length) die('this probe contains a mutating verb: ' + found.join(', '));
  const posts = body.split('method: ' + Q + 'PO' + 'ST' + Q).length - 1;
  const logins = body.split('fetch(' + Q + 'https://login.microsoftonline.com/').length - 1;
  if (posts !== 2 || logins !== 2) {
    die('expected exactly 2 POSTs both to the login host; found ' + posts + '/' + logins);
  }
  if (/fetch\(API[^)]*method/.test(body)) die('an org request carries a method.');
  log('SELF-CHECK  no ' + mutating.join('/') + '; 2 POSTs, both to the login host;');
  log('            no org request carries a method. Read-only by construction.');
  log('');
}

log('=== CLCPA-238 step zero: Dataverse round-trip cost ===');
log('org: ' + ORG + '   iterations: ' + N);
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
/* the only request helper: no method parameter, so every call is a GET */
async function get(url) {
  GETS++;
  const res = await fetch(API + url, { headers: {
    Authorization: 'Bearer ' + TOKEN, Accept: 'application/json',
    'OData-MaxVersion': '4.0', 'OData-Version': '4.0' } });
  const txt = await res.text();
  return { ok: res.ok, status: res.status, bytes: Buffer.byteLength(txt),
           json: (() => { try { return JSON.parse(txt); } catch (e) { return null; } })() };
}
/* follow nextLink, as the shipped getAll does */
async function getAll(url) {
  let bytes = 0, rows = 0, reqs = 0;
  let r = await get(url); reqs++;
  if (!r.ok) return { ok: false, status: r.status, bytes: 0, rows: 0, reqs: reqs };
  bytes += r.bytes; rows += (r.json && r.json.value ? r.json.value.length : 0);
  let next = r.json && r.json['@odata.nextLink'];
  while (next) {
    GETS++; reqs++;
    const res = await fetch(next, { headers: {
      Authorization: 'Bearer ' + TOKEN, Accept: 'application/json',
      'OData-MaxVersion': '4.0', 'OData-Version': '4.0' } });
    if (!res.ok) break;
    const t = await res.text(); bytes += Buffer.byteLength(t);
    const j = JSON.parse(t); rows += (j.value || []).length; next = j['@odata.nextLink'];
  }
  return { ok: true, bytes: bytes, rows: rows, reqs: reqs };
}

const ms = () => Number(process.hrtime.bigint()) / 1e6;
const stat = (a) => {
  const s = a.slice().sort((x, y) => x - y);
  return { min: s[0], med: s[(s.length - 1) >> 1], max: s[s.length - 1] };
};
const fmt = (s) => s.med.toFixed(0) + ' ms  (min ' + s.min.toFixed(0) + ', max ' + s.max.toFixed(0) + ')';

/* THE FIVE BOOT REQUESTS, as the shipped code issues them */
const Q_TABLEDATA = SET_TABLEDATA + '?$select=' + ID_TABLEDATA +
  ',cr2bf_key,cr2bf_section,cr2bf_tableid,cr2bf_year,cr2bf_rows';
const Q_HISTORY = SET_HISTORY + '?$select=' + ID_HISTORY +
  ',cr2bf_tableid,cr2bf_year,cr2bf_user,cr2bf_email,cr2bf_savedat,cr2bf_changes&$orderby=cr2bf_savedat desc';
const Q_YEARS = SET_YEARS + '?$select=' + ID_YEARS + ',cr2bf_reportingyear';

(async () => {
  const dc = await deviceCode();
  log(['', '################  ACTION NEEDED  ################',
       '  Open:  ' + dc.verification_uri, '  Code:  ' + dc.user_code,
       '#################################################', ''].join('\n'));
  fs.writeFileSync(path.join(__dirname, 'device_code.txt'), dc.user_code + '\n' + dc.verification_uri + '\n');
  log('Waiting for authorization...');
  TOKEN = await pollToken(dc.device_code, dc.interval, dc.expires_in);
  log('Authorized. Every request below is a GET.');
  log('');

  /* warm-up, discarded: the first request pays TLS and token validation that
   * no later one repeats, and reporting it as typical would overstate the cost */
  await get('WhoAmI');
  log('(one warm-up request made and discarded: it pays TLS setup the rest do not)');
  log('');

  const runs = { whoami: [], tabledata: [], history: [], years: [], meta: [],
                 sequential: [], parallel: [] };
  const info = {};

  for (let i = 0; i < N; i++) {
    let t;
    t = ms(); const w = await get('WhoAmI'); runs.whoami.push(ms() - t);
    if (!w.ok) die('WhoAmI failed ' + w.status);

    t = ms(); const a = await getAll(Q_TABLEDATA); runs.tabledata.push(ms() - t);
    t = ms(); const b = await getAll(Q_HISTORY); runs.history.push(ms() - t);
    t = ms(); const c = await getAll(Q_YEARS); runs.years.push(ms() - t);
    if (!a.ok || !b.ok || !c.ok) die('a boot read failed');
    info.tabledata = a; info.history = b; info.years = c;

    t = ms();
    const m = await get("EntityDefinitions(LogicalName='cr2bf_dacmaplayer')?$select=EntitySetName");
    runs.meta.push(ms() - t);

    /* SEQUENTIAL, exactly as app.js:809/817/823 does it */
    t = ms();
    await getAll(Q_TABLEDATA); await getAll(Q_HISTORY); await getAll(Q_YEARS);
    runs.sequential.push(ms() - t);

    /* PARALLEL, the proposed Promise.all */
    t = ms();
    await Promise.all([getAll(Q_TABLEDATA), getAll(Q_HISTORY), getAll(Q_YEARS)]);
    runs.parallel.push(ms() - t);
  }

  log('======================================================================');
  log('PER-REQUEST COST, median of ' + N);
  log('======================================================================');
  log('  WhoAmI                        ' + fmt(stat(runs.whoami)));
  log('  Table Data   (' + info.tabledata.rows + ' rows, ' +
      info.tabledata.bytes + ' B, ' + info.tabledata.reqs + ' req) ' + fmt(stat(runs.tabledata)));
  log('  Change History (' + info.history.rows + ' rows, ' +
      info.history.bytes + ' B, ' + info.history.reqs + ' req) ' + fmt(stat(runs.history)));
  log('  Reporting Year (' + info.years.rows + ' rows, ' +
      info.years.bytes + ' B, ' + info.years.reqs + ' req) ' + fmt(stat(runs.years)));
  log('  EntityDefinitions (1 resolve)  ' + fmt(stat(runs.meta)));
  log('');
  log('======================================================================');
  log('THE PROMISE.ALL QUESTION');
  log('======================================================================');
  const sq = stat(runs.sequential), pl = stat(runs.parallel);
  log('  the three reads SEQUENTIAL (as shipped) ' + fmt(sq));
  log('  the same three in PARALLEL              ' + fmt(pl));
  const saved = sq.med - pl.med;
  log('  median saved by Promise.all             ' + saved.toFixed(0) + ' ms  (' +
      (100 * saved / sq.med).toFixed(0) + '% of that segment)');
  log('');
  log('  Rows today are tiny (2 table-data rows). CLCPA-238 raises Table Data to');
  log('  154 rows, so the per-row cost matters: measured above at ' +
      info.tabledata.bytes + ' B for ' + info.tabledata.rows + ' row(s).');
  log('  A 154-row read is ONE page (the 5,000 default) so it stays ONE round');
  log('  trip -- the payload it carries grows, the trip count does not.');
  log('');
  log('LIMITS, restated so these numbers are not over-read:');
  log('  Node with a bearer token on this machine, NOT the browser, NOT');
  log('  same-origin cookie auth, NOT ConEd network. Browser parse and layout');
  log('  are absent. The composition of the 1,271 ms boot figure remains');
  log('  MISSING and needs instrumentation inside the running page.');
  log('');
  log('requests: GET ' + GETS + ', and nothing else. Nothing was written.');
  flush();
})().catch(e => { log('UNCAUGHT: ' + (e && e.stack || e)); flush(); process.exit(1); });
