/* CLCPA-238 SEED ADDENDUM: store current_year in the meta row.
 *
 * ONE ROW, ONE FIELD. The composer now reads meta.current_year from the store
 * instead of deriving it from the newest year with data, because a 2099 test row
 * made that derivation open the dashboard on a year holding one table. This
 * writes the value the payload publishes.
 *
 * THE HASH DISCIPLINE, unchanged from step 4: the value written comes from
 * seed_reportmetric.json, whose sha256 is checked against seed_manifest.json
 * BEFORE the device code is requested. So the bytes that land are the bytes that
 * were reviewed and committed, not something composed here.
 *
 * SCOPE: exactly one PATCH, to exactly one row, setting exactly one field.
 * Asserted by the self-check: one patch call site, and the body is built from a
 * single-element field list.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ORG = 'https://org9076e69b.crm.dynamics.com';
const API = ORG + '/api/data/v9.2/';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d';
const TENANT = 'organizations';
const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const EVID = REPO + '/Coned/CLCPA/tickets/CLCPA-238-evidence';
const BACKDIR = REPO + '/deploy-backups/2026-09-08-clcpa238-pre-seed';
const SET = 'cr2bf_dacreportmetrics';
const IDF = 'cr2bf_dacreportmetricid';
const PATCH_FIELDS = ['cr2bf_spec'];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
function flush(tail) {
  if (tail) lines.push('', tail);
  try { fs.writeFileSync(path.join(__dirname, 'addendum_238.log'), lines.join('\n') + '\n'); } catch (e) {}
  try { fs.writeFileSync(path.join(EVID, 'addendum-238-output.txt'), lines.join('\n') + '\n'); } catch (e) {}
}
const stop = (m) => {
  log(''); log('##################################################################');
  log('STOP: ' + m);
  log('##################################################################');
  log('State: ' + (PATCHED ? 'the row WAS patched' : 'NOTHING was written'));
  flush('ABORTED'); process.exit(1);
};
let PATCHED = false;
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
let GETS = 0, PATCHES = 0;

/* ---- self-check ------------------------------------------------------- */
{
  const body = fs.readFileSync(__filename, 'utf8');
  const Q = String.fromCharCode(39);
  if (body.indexOf(Q + 'DELE' + 'TE' + Q) >= 0 || body.indexOf(Q + 'P' + 'UT' + Q) >= 0) {
    console.error('STOP: contains DELETE or PUT'); process.exit(1);
  }
  const sites = (body.match(/await patch\(/g) || []).length;
  if (sites !== 1) { console.error('STOP: expected 1 patch site, found ' + sites); process.exit(1); }
  if (PATCH_FIELDS.length !== 1 || PATCH_FIELDS[0] !== 'cr2bf_spec') {
    console.error('STOP: PATCH_FIELDS is not exactly [cr2bf_spec]'); process.exit(1);
  }
  const posts = (body.match(/await post\(/g) || []).length;
  if (posts !== 0) { console.error('STOP: this addendum must create nothing'); process.exit(1); }
  log('SELF-CHECK  no DELETE, no PUT, no POST to any entity set: this addendum');
  log('            creates nothing. ONE patch site, and its body is built from');
  log('            PATCH_FIELDS = [cr2bf_spec] alone.');
  log('');
}

log('======================================================================');
log('CLCPA-238 SEED ADDENDUM: current_year into the meta row');
log('======================================================================');

/* ---- the value, from the hashed seed file ----------------------------- */
const MAN = JSON.parse(fs.readFileSync(path.join(EVID, 'seed_manifest.json'), 'utf8'));
const mf = MAN.files.filter(f => f.entitySet === SET)[0];
if (!mf) stop('the manifest has no entry for ' + SET);
const txt = fs.readFileSync(path.join(EVID, mf.file), 'utf8');
const got = sha(txt);
if (got !== mf.sha256) {
  stop(mf.file + ' sha256 ' + got.slice(0, 16) + ' does not match the manifest ' +
    mf.sha256.slice(0, 16) + '. The file on disk is not the reviewed one.');
}
log('  ' + mf.file + '  sha256 ' + got.slice(0, 16) + '  MATCHES the manifest');
const rows = JSON.parse(txt);
const metaSeed = rows.filter(r => r.cr2bf_kind === 'meta')[0];
if (!metaSeed) stop('the seed has no meta row');
const spec = JSON.parse(metaSeed.cr2bf_spec);
if (spec.current_year !== '2025') {
  stop('the seed meta row stores current_year = ' + JSON.stringify(spec.current_year) +
    ', not "2025". Refusing to write a value the reviewed seed does not hold.');
}
log('  the reviewed seed stores current_year = ' + JSON.stringify(spec.current_year));
log('');
log('  THE EXACT PAYLOAD, printed before anything is written:');
log('  PATCH ' + SET + '(<id of cr2bf_metrickey eq \'meta\'>)');
const BODY = {};
PATCH_FIELDS.forEach(f => { BODY[f] = metaSeed[f]; });
log(JSON.stringify(BODY, null, 2));
log('');

async function deviceCode() {
  const res = await fetch('https://login.microsoftonline.com/' + TENANT + '/oauth2/v2.0/devicecode', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: ORG + '/.default offline_access' }) });
  const j = await res.json();
  if (!res.ok) stop('device code failed: ' + JSON.stringify(j));
  return j;
}
async function pollToken(dc, iv, exp) {
  const t0 = Date.now(); let interval = (iv || 5) * 1000;
  while (Date.now() - t0 < (exp || 900) * 1000) {
    await new Promise(r => setTimeout(r, interval));
    const res = await fetch('https://login.microsoftonline.com/' + TENANT + '/oauth2/v2.0/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
                                 client_id: CLIENT_ID, device_code: dc }) });
    const j = await res.json();
    if (res.ok && j.access_token) return j.access_token;
    if (j.error === 'authorization_pending') continue;
    if (j.error === 'slow_down') { interval += 5000; continue; }
    if (j.error === 'expired_token') stop('the device code expired.');
    if (j.error === 'authorization_declined') stop('sign-in declined.');
    stop('token poll failed: ' + JSON.stringify(j));
  }
  stop('timed out.');
}
let TOKEN = null;
async function req(method, url, body) {
  if (method === 'GET') GETS++; else PATCHES++;
  const headers = Object.assign({
    Authorization: 'Bearer ' + TOKEN, Accept: 'application/json',
    'OData-MaxVersion': '4.0', 'OData-Version': '4.0' },
    body ? { 'Content-Type': 'application/json' } : {});
  const res = await fetch(API + url, { method: method, headers: headers,
    body: body ? JSON.stringify(body) : undefined });
  const t = await res.text();
  return { ok: res.ok, status: res.status, text: t,
           json: (() => { try { return JSON.parse(t); } catch (e) { return null; } })() };
}
const get = (u) => req('GET', u, null);
const patch = (u, b) => req('PA' + 'TCH', u, b);

(async () => {
  const dc = await deviceCode();
  log(['', '################  ACTION NEEDED  ################',
       '  Open:  ' + dc.verification_uri, '  Code:  ' + dc.user_code,
       '#################################################', ''].join('\n'));
  fs.writeFileSync(path.join(__dirname, 'device_code.txt'), dc.user_code + '\n' + dc.verification_uri + '\n');
  log('Waiting for authorization...');
  TOKEN = await pollToken(dc.device_code, dc.interval, dc.expires_in);
  log('Authorized.');

  const who = await get('WhoAmI');
  if (!who.ok) stop('WhoAmI failed ' + who.status);
  log('WhoAmI UserId = ' + who.json.UserId);

  /* ---- find the row, and prove there is exactly one ------------------ */
  const found = await get(SET + '?$select=' + IDF + ',cr2bf_metrickey,cr2bf_kind,cr2bf_spec' +
    "&$filter=cr2bf_metrickey eq 'meta'");
  if (!found.ok) stop('cannot read the meta row: ' + found.status + ' ' + found.text.slice(0, 200));
  const hits = found.json.value || [];
  if (hits.length !== 1) stop('expected exactly ONE meta row, found ' + hits.length);
  const row = hits[0];
  const id = row[IDF];
  log('');
  log('  target row id ' + id + '  kind=' + row.cr2bf_kind);
  log('  BEFORE cr2bf_spec = ' + row.cr2bf_spec);
  const before = row.cr2bf_spec;
  if (before === BODY.cr2bf_spec) {
    stop('the row ALREADY holds exactly this value. Nothing to do, and nothing ' +
      'was written.');
  }
  {
    /* the change must be ADDITIVE: the two config numbers must survive */
    const b = JSON.parse(before || '{}');
    const a = JSON.parse(BODY.cr2bf_spec);
    if (JSON.stringify(b.baseline_options) !== JSON.stringify(a.baseline_options) ||
        b.default_baseline !== a.default_baseline) {
      stop('the new spec would change baseline_options or default_baseline. This ' +
        'addendum adds current_year and nothing else. Nothing was written.');
    }
    if (b.current_year !== undefined) {
      stop('the row already has a current_year (' + b.current_year + '). Refusing ' +
        'to overwrite it silently.');
    }
    log('  the change is ADDITIVE: baseline_options and default_baseline unchanged,');
    log('  current_year added as ' + JSON.parse(BODY.cr2bf_spec).current_year);
  }

  /* ---- write ---------------------------------------------------------- */
  log('');
  const r = await patch(SET + '(' + id + ')', BODY);
  if (!r.ok) stop('the PATCH failed ' + r.status + ': ' + r.text.slice(0, 300));
  PATCHED = true;
  log('  PATCH -> ' + r.status);

  /* ---- re-read and verify -------------------------------------------- */
  const back = await get(SET + '(' + id + ')?$select=' + IDF + ',cr2bf_metrickey,cr2bf_kind,cr2bf_spec');
  if (!back.ok) stop('patched but CANNOT RE-READ the row: ' + back.status);
  log('  AFTER  cr2bf_spec = ' + back.json.cr2bf_spec);
  if (back.json.cr2bf_spec !== BODY.cr2bf_spec) {
    stop('DEVIATION: the row reads back as ' + back.json.cr2bf_spec +
      ' but ' + BODY.cr2bf_spec + ' was sent.');
  }
  log('  VERIFIED byte-identical to what was printed and sent.');
  const parsed = JSON.parse(back.json.cr2bf_spec);
  if (parsed.current_year !== '2025') stop('current_year reads back as ' + parsed.current_year);
  log('  current_year = ' + JSON.stringify(parsed.current_year) + ', read back from the org.');

  /* ---- the ledger ----------------------------------------------------- */
  const LEDGER = path.join(BACKDIR, 'seed_ledger.json');
  try {
    const L = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
    L.addenda = L.addenda || [];
    L.addenda.push({ at: new Date().toISOString(), set: SET, id: id,
      field: 'cr2bf_spec', added: 'current_year', value: '2025',
      before: before, after: back.json.cr2bf_spec,
      note: 'CLCPA-238 fix round item 1. current_year is stored rather than ' +
            'derived: the rows say which years have data, not which year the ' +
            'report covers. Reverting means PATCHing cr2bf_spec back to the ' +
            '`before` value in this entry.' });
    fs.writeFileSync(LEDGER, JSON.stringify(L, null, 2));
    log('  ledger updated: ' + LEDGER);
    log('  it records the BEFORE value, so the revert is one PATCH away.');
  } catch (e) {
    log('  LEDGER UPDATE FAILED (' + e.message + '). The before/after values are');
    log('  in this log, which is committed, so the revert is still recoverable.');
  }

  log('');
  log('======================================================================');
  log('=== ADDENDUM COMPLETE ===');
  log('  requests: GET ' + GETS + ', PATCH ' + PATCHES + '. One row, one field.');
  log('  the shadow should now read 3 of 5.');
  log('======================================================================');
  flush();
})().catch(e => { log('UNCAUGHT: ' + (e && e.stack || e)); flush('ABORTED'); process.exit(1); });
