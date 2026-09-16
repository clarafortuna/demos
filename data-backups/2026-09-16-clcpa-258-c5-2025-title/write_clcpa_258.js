/* CLCPA-258: the stray "4" in C5's stored 2025 title.
 *
 * ONE CHARACTER, ONE FIELD, ONE ROW, ONE YEAR, and it is PRODUCTION DATA.
 *
 *   before: "Table C5. Total Program Participation Summary4"
 *   after:  "Table C5. Total Program Participation Summary"
 *
 * This is NOT a deploy. No web resource is touched, no build id moves. It is a
 * write to a stored reporting year in Dataverse -- the class of thing every
 * other ticket in this project has been under standing orders NOT to do -- and
 * it is authorized explicitly, by name, for this one field. So the discipline
 * is the deploy discipline with the gates pointed at a row instead of a file:
 *
 *   - the WHOLE ROW is backed up, committed AND pushed, before the write. A
 *     restore needs every field, not the one being changed.
 *   - the current value is proven to be exactly the expected "before" string.
 *     If someone already fixed it, or it says something else, this stops.
 *   - the query must match EXACTLY ONE row. Zero is a wrong filter; two is a
 *     duplicate and the wrong one could be written.
 *   - the PATCH body is asserted to carry exactly one key.
 *   - the read-back proves the new title AND that every other field in the row
 *     is byte-identical to the backup. "I only meant to change one field" is
 *     not evidence that only one field changed.
 *   - the caption is RENDERED from the real tableCaption(), before and after,
 *     because the title is a stored string but the caption is what an operator
 *     actually sees.
 *
 * THIS WRITE IS ITS OWN CLCPA-224 NOTE: a stored-year touch, authorized, on
 * C5:2025 only, recorded here and in the backup manifest.
 *
 * Everything offline happens BEFORE the device code is requested.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const SRC = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev';
const ORG = 'https://org9076e69b.crm.dynamics.com';
const API = ORG + '/api/data/v9.2/';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d';
const TENANT = 'organizations';

const ENT_TABLEDATA = 'cr2bf_dacingesttesttabledata1';
const ID_TABLEDATA = 'cr2bf_dacingesttesttabledata1id';

const TABLE_ID = 'C5';
const YEAR = 2025;
const FIELD = 'cr2bf_title';
const BEFORE = 'Table C5. Total Program Participation Summary4';
const AFTER = 'Table C5. Total Program Participation Summary';

const BACKUP_SLUG = '2026-09-16-clcpa-258-c5-2025-title';
const BACKDIR = REPO + '/data-backups/' + BACKUP_SLUG;

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const die = (m) => {
  console.error('\nSTOP: ' + m);
  try { flushLog('ABORTED: ' + m); } catch (e) {}
  process.exit(1);
};
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
let GETS = 0, PATCHES = 0;

let ARCHIVED = false;
function flushLog(tail) {
  if (tail) lines.push('', tail);
  try {
    if (ARCHIVED || fs.existsSync(BACKDIR + '/row-before.json')) {
      fs.writeFileSync(BACKDIR + '/write.log', lines.join('\n') + '\n');
    } else {
      fs.writeFileSync(path.join(__dirname, 'write_clcpa_258_abort.log'),
        lines.join('\n') + '\n');
    }
  } catch (e) { /* the console output is still the record */ }
}

/* ---- the REAL tableCaption, cut out of the shipped app.js -------------- */
function loadCaption() {
  const src = fs.readFileSync(SRC + '/app.js', 'utf8');
  const L = src.split('\r\n');
  const TOP = [];
  L.forEach((ln, n) => {
    const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (nm) => {
    const k = TOP.findIndex(d => d.name === nm);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n');
  };
  const parts = [], have = new Set();
  const add = (n) => { if (have.has(n)) return false; const f = find(n); if (!f) return false;
    have.add(n); parts.push(f); return true; };
  if (!add('tableCaption')) die('tableCaption not found in app.js.');
  let api = null;
  const attempt = (call) => {
    for (let r = 0; r < 200; r++) {
      try {
        if (!api) api = new Function(parts.join('\n\n') + '\n;return { tableCaption };')();
        return call(api);
      } catch (e) {
        const m = /(\w+) is not defined/.exec(e.message);
        if (m && add(m[1])) { api = null; continue; }
        throw e;
      }
    }
    throw new Error('no convergence assembling tableCaption');
  };
  return attempt;
}

/* =======================================================================
 * PRE-FLIGHT, entirely offline
 * ======================================================================= */
log('=== CLCPA-258: C5 2025 stored title, one character ===');
log('org: ' + ORG);
log('row: ' + ENT_TABLEDATA + ' where tableid=' + TABLE_ID + ' and year=' + YEAR);
log('field: ' + FIELD);
log('');

/* --- 0. this script checks itself ------------------------------------- */
{
  const required = { fs, path, crypto, execSync, log, die, sha256, flushLog, loadCaption };
  const missing = Object.keys(required).filter(k => typeof required[k] !== 'function' &&
    typeof required[k] !== 'object');
  if (missing.length) die('this script is broken: ' + missing.join(', ') + ' unusable.');
  const consts = { REPO, SRC, API, CLIENT_ID, TENANT, ENT_TABLEDATA, ID_TABLEDATA,
    TABLE_ID, FIELD, BEFORE, AFTER, BACKUP_SLUG, BACKDIR };
  const empty = Object.keys(consts).filter(k => !consts[k]);
  if (empty.length) die('unset constant(s): ' + empty.join(', '));
  if (typeof YEAR !== 'number') die('YEAR must be a number.');
  log('PRE-FLIGHT 0  helpers present, constants set.');
}

/* --- 1. the change is EXACTLY one trailing character ------------------- */
{
  if (BEFORE === AFTER) die('BEFORE and AFTER are the same string.');
  if (BEFORE.length - AFTER.length !== 1) {
    die('the change is ' + (BEFORE.length - AFTER.length) + ' characters, not 1.');
  }
  if (BEFORE.slice(0, -1) !== AFTER) {
    die('AFTER is not BEFORE with its last character removed.');
  }
  if (BEFORE.slice(-1) !== '4') {
    die('the character being removed is ' + JSON.stringify(BEFORE.slice(-1)) + ', not "4".');
  }
  log('PRE-FLIGHT 1  the change is exactly one trailing "4" and nothing else:');
  log('                 before ' + JSON.stringify(BEFORE) + '  (' + BEFORE.length + ' chars)');
  log('                 after  ' + JSON.stringify(AFTER) + '  (' + AFTER.length + ' chars)');
}

/* --- 2. git state ------------------------------------------------------ */
const HEAD = execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim();
const BRANCH = execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO }).toString().trim();
if (BRANCH !== 'main') die('not on main (on "' + BRANCH + '").');
{
  const remote = execSync('git ls-remote origin refs/heads/main', { cwd: REPO })
    .toString().trim().split(/\s+/)[0];
  const localFull = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim();
  if (remote !== localFull) {
    die('local main ' + localFull.slice(0, 7) + ' is not remote main ' + remote.slice(0, 7) +
        '. The backup commit must land on a branch the remote agrees with.');
  }
}
log('PRE-FLIGHT 2  on main @ ' + HEAD + ', local == remote.');

/* --- 3. the caption renderer assembles and answers --------------------- */
const caption = loadCaption();
{
  const probeBefore = caption(api => api.tableCaption(
    { id: TABLE_ID, short_title: 'Total Program', title_by_year: { '2025': BEFORE } }, '2025'));
  const probeAfter = caption(api => api.tableCaption(
    { id: TABLE_ID, short_title: 'Total Program', title_by_year: { '2025': AFTER } }, '2025'));
  if (probeBefore !== BEFORE) die('tableCaption does not return the stored title: ' + probeBefore);
  if (probeAfter !== AFTER) die('tableCaption does not return the corrected title: ' + probeAfter);
  /* and it is the STORED value that wins, not the short_title fallback -- if
   * that were not true this ticket would be changing nothing an operator sees */
  const noTitle = caption(api => api.tableCaption(
    { id: TABLE_ID, short_title: 'Total Program', title_by_year: {} }, '2025'));
  if (noTitle === BEFORE || noTitle === AFTER) {
    die('tableCaption returns the same thing with no stored title, so this write ' +
        'would change nothing that renders.');
  }
  log('PRE-FLIGHT 3  the real tableCaption() assembles and echoes the stored title.');
  log('              (with no stored title it would render ' + JSON.stringify(noTitle) + ')');
}

/* --- 4. the backup directory must be ABSENT --------------------------- */
if (fs.existsSync(BACKDIR)) {
  die('data-backups/' + BACKUP_SLUG + ' already exists. The backup must be ' +
      'CREATED, not overwritten.');
}
log('PRE-FLIGHT 4  backup directory is absent, so the backup will be created.');
log('');

if (process.env.DAC_DRY_RUN) {
  log('DRY RUN: the offline half completed with no errors. Stopping before');
  log('authentication. Nothing was requested and nothing was written.');
  process.exit(0);
}
log('Nothing above touched the network. Requesting the device code now.');
log('');

/* =======================================================================
 * AUTH + WRITE
 * ======================================================================= */
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
/* retry on TRANSPORT, never on a status: a 4xx/5xx is an answer */
async function dv(method, url, body, extra) {
  if (method === 'GET') GETS++; else PATCHES++;
  const headers = Object.assign({
    Authorization: 'Bearer ' + TOKEN, Accept: 'application/json',
    'OData-MaxVersion': '4.0', 'OData-Version': '4.0',
  }, body ? { 'Content-Type': 'application/json' } : {}, extra || {});
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    let res;
    try {
      res = await fetch(API + url, { method, headers,
        body: body ? JSON.stringify(body) : undefined });
    } catch (e) {
      lastErr = e;
      log('   transport error on ' + method + ' ' + url.slice(0, 44) +
          ' (attempt ' + attempt + '/4): ' + (e && e.message));
      await new Promise(r => setTimeout(r, attempt * 4000));
      continue;
    }
    if (res.status === 401 || res.status === 403) {
      die('permission error ' + res.status + ' on ' + method + ' ' + url + '\n' +
          (await res.text()).slice(0, 400) + '\nNot retrying, not changing roles.');
    }
    if (!res.ok) die(method + ' ' + url + ' -> ' + res.status + '\n' + (await res.text()).slice(0, 400));
    const txt = await res.text();
    return txt ? JSON.parse(txt) : {};
  }
  die('four transport failures on ' + method + ' ' + url + ': ' + (lastErr && lastErr.message));
}

(async () => {
  const dc = await deviceCode();
  log(['', '################  ACTION NEEDED  ################',
       '  Open:  ' + dc.verification_uri, '  Code:  ' + dc.user_code,
       '#################################################', ''].join('\n'));
  try {
    fs.writeFileSync(path.join(__dirname, 'device_code.txt'),
      dc.user_code + '\n' + dc.verification_uri + '\n');
  } catch (e) {}
  log('Waiting for authorization (up to ' + Math.round((dc.expires_in || 900) / 60) + ' min)...');
  TOKEN = await pollToken(dc.device_code, dc.interval, dc.expires_in);
  log('Authorized.');
  log('');

  const who = await dv('GET', 'WhoAmI');
  const me = await dv('GET', 'systemusers(' + who.UserId + ')?$select=fullname,internalemailaddress');
  log('signed in as: ' + me.fullname + ' <' + me.internalemailaddress + '>');

  /* --- the entity set name comes from METADATA, never hardcoded ------- */
  const ed = await dv('GET', "EntityDefinitions(LogicalName='" + ENT_TABLEDATA +
    "')?$select=EntitySetName");
  const SET = ed.EntitySetName;
  if (!SET) die('EntitySetName missing for ' + ENT_TABLEDATA + '.');
  log('entity set resolved from metadata: ' + SET);
  log('');

  /* --- find the row. EXACTLY ONE. ------------------------------------- */
  const q = SET + '?$filter=cr2bf_tableid eq \'' + TABLE_ID + '\' and cr2bf_year eq ' + YEAR;
  const found = await dv('GET', q);
  const rows = (found && found.value) || [];
  log('query matched ' + rows.length + ' row(s) for ' + TABLE_ID + ':' + YEAR);
  if (rows.length !== 1) {
    die(rows.length === 0
      ? 'no row matched. The filter is wrong, or the row is not where this expects.'
      : rows.length + ' rows matched. A duplicate means the wrong one could be written.');
  }
  const ROWID = rows[0][ID_TABLEDATA];
  if (!ROWID) die('the matched row has no ' + ID_TABLEDATA + '.');
  log('row id: ' + ROWID);
  log('');

  /* --- BACK UP THE WHOLE ROW, then prove the current value ------------ */
  const before = await dv('GET', SET + '(' + ROWID + ')');
  fs.mkdirSync(BACKDIR, { recursive: true });
  ARCHIVED = true;
  fs.writeFileSync(BACKDIR + '/row-before.json', JSON.stringify(before, null, 2) + '\n');
  const beforeSha = sha256(Buffer.from(JSON.stringify(before), 'utf8'));
  log('BACKUP    whole row saved, ' + Object.keys(before).length + ' fields, sha256 ' +
      beforeSha.slice(0, 16) + '...');

  const cur = before[FIELD];
  log('          current ' + FIELD + ': ' + JSON.stringify(cur));
  if (cur !== BEFORE) {
    die('the stored title is not the expected "before" value.\n' +
        '  expected: ' + JSON.stringify(BEFORE) + '\n' +
        '  found   : ' + JSON.stringify(cur) + '\n' +
        '  Stopping BEFORE any write: something changed this row since the audit,\n' +
        '  and a blind correction could destroy it.');
  }
  log('          it matches the audit exactly, so the correction is the one planned.');

  /* THE BEFORE RENDER, from the value actually on the server. */
  const tblBefore = { id: TABLE_ID, short_title: 'Total Program',
    title_by_year: { '2025': cur } };
  const renderBefore = caption(api => api.tableCaption(tblBefore, '2025'));
  log('');
  log('RENDER BEFORE (real tableCaption on the SERVER value):');
  log('   ' + JSON.stringify(renderBefore));

  const manifest = { org: ORG, capturedAt: new Date().toISOString(),
    ticket: 'CLCPA-258', note: 'Pre-write backup of ONE stored reporting-year row. ' +
      'Restore by PATCHing ' + SET + '(' + ROWID + ') with the fields in row-before.json.',
    entity: ENT_TABLEDATA, entitySet: SET, rowId: ROWID,
    tableId: TABLE_ID, year: YEAR, field: FIELD,
    before: BEFORE, after: AFTER,
    rowSha256: beforeSha, fieldCount: Object.keys(before).length,
    sourceCommit: HEAD,
    clcpa224: 'This is a STORED-YEAR TOUCH on a production year, authorized ' +
      'explicitly for this one field. C5:2025 cr2bf_title only. No other field, ' +
      'no other row, no other year.' };
  fs.writeFileSync(BACKDIR + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  flushLog(null);

  /* --- MAKE THE BACKUP DURABLE, before the write --------------------- */
  {
    execSync('git add -- "data-backups/' + BACKUP_SLUG + '"', { cwd: REPO });
    const staged = execSync('git diff --cached --name-only', { cwd: REPO }).toString().trim();
    if (!staged) die('nothing staged for the backup commit; it would have been hollow.');
    const outside = staged.split('\n').filter(f => f.indexOf('data-backups/') !== 0);
    if (outside.length) die('the backup commit would carry files outside data-backups/: ' +
                            outside.join(', '));
    const msg = 'data-backups: pre-write backup of C5:2025 before CLCPA-258\n\n' +
      'The whole Dataverse row as it stood before one character was removed from\n' +
      'its stored title. CLCPA-258 takes a stray "4" off C5 2025 caption:\n\n' +
      '  before  ' + JSON.stringify(BEFORE) + '\n' +
      '  after   ' + JSON.stringify(AFTER) + '\n\n' +
      'entity   ' + ENT_TABLEDATA + '\n' +
      'set      ' + SET + '\n' +
      'row      ' + ROWID + '\n' +
      'field    ' + FIELD + '  (one field, nothing else)\n' +
      'row sha  ' + beforeSha + '\n\n' +
      'THIS IS A STORED-YEAR TOUCH ON A PRODUCTION YEAR, authorized explicitly\n' +
      'and scoped to this one field. It is its own CLCPA-224 note. The whole row\n' +
      'is saved, not just the field being changed, because a restore needs every\n' +
      'field. Committed and pushed BEFORE the write, so the backup exists off\n' +
      'this machine before anything is overwritten.\n\n' +
      'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>\n';
    fs.writeFileSync(BACKDIR + '/.commitmsg', msg);
    execSync('git commit -q -F "' + BACKDIR + '/.commitmsg"', { cwd: REPO });
    fs.unlinkSync(BACKDIR + '/.commitmsg');
    const snapSha = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim();
    log('');
    log('BACKUP    committed as ' + snapSha.slice(0, 7));
    let pushed = false;
    for (let attempt = 1; attempt <= 3 && !pushed; attempt++) {
      try { execSync('git push origin main', { cwd: REPO, timeout: 300000, stdio: 'pipe' }); pushed = true; }
      catch (e) { log('          push attempt ' + attempt + ' did not return cleanly; checking the remote.'); }
      const remote = execSync('git ls-remote origin refs/heads/main', { cwd: REPO })
        .toString().trim().split(/\s+/)[0];
      if (remote === snapSha) { pushed = true; log('          remote main = ' + remote.slice(0, 7) + '  VERIFIED'); }
    }
    if (!pushed) {
      die('the backup commit is on this machine but NOT on the remote after three\n' +
          '  attempts. Stopping before the write: the backup is not durable yet.\n' +
          '  NOTHING has been written to Dataverse.');
    }
    log('          the backup is durable off this machine. Proceeding to write.');
  }
  log('');

  /* --- THE WRITE: one field, asserted ------------------------------- */
  const patch = {};
  patch[FIELD] = AFTER;
  if (Object.keys(patch).length !== 1) die('the PATCH body does not carry exactly one key.');
  if (Object.keys(patch)[0] !== FIELD) die('the PATCH body key is not ' + FIELD + '.');
  log('PATCH ' + SET + '(' + ROWID + ')');
  log('   body: ' + JSON.stringify(patch));
  await dv('PATCH', SET + '(' + ROWID + ')', patch, { 'If-Match': '*' });
  log('written.');
  log('');

  /* --- READ BACK: the new title AND nothing else moved -------------- */
  const after = await dv('GET', SET + '(' + ROWID + ')');
  fs.writeFileSync(BACKDIR + '/row-after.json', JSON.stringify(after, null, 2) + '\n');
  log('READ-BACK ' + FIELD + ': ' + JSON.stringify(after[FIELD]));
  if (after[FIELD] !== AFTER) {
    die('the read-back title is not the corrected value. The backup in\n' +
        '  data-backups/' + BACKUP_SLUG + '/ is the restore, and it is already pushed.');
  }
  /* EVERY OTHER FIELD, byte for byte. Dataverse updates its own audit columns
   * on any write, so those are named and excused; anything else moving is a
   * failure. "I only meant to change one field" is not evidence. */
  const SYSTEM_FIELDS = ['modifiedon', '_modifiedby_value', '_modifiedonbehalfby_value',
    'versionnumber', '@odata.etag'];
  const moved = [];
  const keys = [...new Set(Object.keys(before).concat(Object.keys(after)))];
  keys.forEach(k => {
    if (k === FIELD) return;
    if (SYSTEM_FIELDS.indexOf(k) >= 0) return;
    if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) {
      moved.push(k + ': ' + JSON.stringify(before[k]) + ' -> ' + JSON.stringify(after[k]));
    }
  });
  if (moved.length) {
    die('fields other than ' + FIELD + ' changed:\n  ' + moved.join('\n  ') +
        '\n  Restore from data-backups/' + BACKUP_SLUG + '/row-before.json.');
  }
  log('          and every other field is byte-identical to the backup');
  log('          (' + keys.length + ' keys compared, ' + SYSTEM_FIELDS.length +
      ' Dataverse audit columns excused by name).');
  const sysMoved = SYSTEM_FIELDS.filter(k =>
    JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  log('          audit columns that did move, as expected: ' +
      (sysMoved.length ? sysMoved.join(', ') : 'none'));

  /* --- THE AFTER RENDER, from the server's own value ---------------- */
  const tblAfter = { id: TABLE_ID, short_title: 'Total Program',
    title_by_year: { '2025': after[FIELD] } };
  const renderAfter = caption(api => api.tableCaption(tblAfter, '2025'));
  log('');
  log('RENDER AFTER (real tableCaption on the SERVER value):');
  log('   ' + JSON.stringify(renderAfter));
  if (renderAfter === renderBefore) die('the rendered caption did not change.');
  if (renderAfter !== AFTER) die('the rendered caption is not the corrected title.');
  if (renderBefore.slice(0, -1) !== renderAfter) {
    die('the rendered captions differ by more than the trailing character.');
  }
  log('   the two renders differ by exactly the trailing "4", and nothing else.');

  manifest.completedAt = new Date().toISOString();
  manifest.renderBefore = renderBefore;
  manifest.renderAfter = renderAfter;
  manifest.verified = true;
  fs.writeFileSync(BACKDIR + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');

  log('');
  log('=== CLCPA-258 WRITE COMPLETE ===');
  log('row      ' + ROWID);
  log('field    ' + FIELD);
  log('before   ' + JSON.stringify(BEFORE));
  log('after    ' + JSON.stringify(AFTER));
  log('backup   data-backups/' + BACKUP_SLUG + '/  (committed and pushed before the write)');
  log('requests: GET ' + GETS + ', PATCH ' + PATCHES);
  log('');
  log('NO WEB RESOURCE WAS TOUCHED. The hosted build is still 9eb3bab955 and');
  log('no build id moved -- this was stored data, not code.');
  log('');
  log('YOUR CHECK: open C5 on 2025. The caption must read');
  log('   ' + AFTER);
  log('with no trailing 4. Nothing else on C5 or any other year should differ.');
  flushLog('=== log written by write_clcpa_258.js ===');
})().catch(e => {
  console.error('\nWRITE ERROR: ' + (e && e.stack ? e.stack : e));
  flushLog('WRITE ERROR: ' + (e && e.message ? e.message : e));
  process.exit(2);
});
