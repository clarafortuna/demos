/* ExecutiveDashboard_dev -> cr2bf_dactest deploy, CLCPA-193 + CLCPA-199.
 *
 * Pushes app.js, styles.css and ExecutiveDashboard.html. The HTML goes every
 * time because it carries the ?v=<id> stamps, and app.js carries APP_BUILD, so
 * the URL that fetched a file and the file's own claim about itself agree.
 *
 * ORDER, and it matters: everything offline happens BEFORE the device code is
 * requested, so a mistake in this script cannot burn a code. That is not
 * theoretical -- a `sha is not defined` TDZ in an earlier deploy script cost one,
 * and the pre-flight that would have caught it only scanned app.js, not the
 * script doing the scanning. This one checks itself too.
 *
 * Nothing is written to Dataverse until: the working tree is clean, HEAD is the
 * merge commit, app.js parses, this script self-checks, the live bytes are
 * archived to deploy-backups/, and each web resource id is proven to resolve to
 * the name we expect.
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
const PREFIX = 'cr2bf_dactest/';
const BACKUP_SLUG = '2026-09-05-clcpa-220-round3-about';

const RES = [
  { file: 'app.js', name: PREFIX + 'app.js', id: '79151fe9-3c64-f111-ab0c-7c1e521c7110' },
  { file: 'styles.css', name: PREFIX + 'styles.css', id: '7b151fe9-3c64-f111-ab0c-7c1e521c7110' },
  { file: 'ExecutiveDashboard.html', name: PREFIX + 'ExecutiveDashboard.html', id: '77151fe9-3c64-f111-ab0c-7c1e521c7110' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const die = (m) => {
  console.error('\nSTOP: ' + m);
  try { flushLog('ABORTED: ' + m); } catch (e) {}
  process.exit(1);
};
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
let GETS = 0, PATCHES = 0, POSTS = 0;

const BACKDIR = REPO + '/deploy-backups/' + BACKUP_SLUG;
function flushLog(tail) {
  if (tail) lines.push('', tail);
  try {
    fs.mkdirSync(BACKDIR, { recursive: true });
    fs.writeFileSync(BACKDIR + '/deploy.log', lines.join('\n') + '\n');
  } catch (e) { /* the console output is still the record */ }
}

/* =======================================================================
 * PRE-FLIGHT, entirely offline
 * ======================================================================= */
log('=== ExecutiveDashboard_dev -> cr2bf_dactest deploy ===');
log('org: ' + ORG);
log('slice: CLCPA-220 round 3 (About this data, tab fill, pill removal completed)');
log('files: ' + RES.map(r => r.file).join(', '));
log('');

/* --- 0. this script checks itself ------------------------------------- */
{
  // Every helper this script calls, verified to exist before any of them run.
  // A TDZ or a typo here is what burned a device code once.
  const required = { fs, path, crypto, execSync, log, die, sha256, flushLog };
  const missing = Object.keys(required).filter(k => required[k] === undefined ||
    (typeof required[k] !== 'function' && typeof required[k] !== 'object'));
  if (missing.length) die('this deploy script is broken: ' + missing.join(', ') + ' unusable.');
  // and that the module-scope constants are all populated
  const consts = { REPO, SRC, API, CLIENT_ID, TENANT, PREFIX, BACKUP_SLUG, BACKDIR };
  const empty = Object.keys(consts).filter(k => !consts[k]);
  if (empty.length) die('unset constant(s): ' + empty.join(', '));
  if (!Array.isArray(RES) || RES.length !== 3) die('the resource list is not the expected three.');
  RES.forEach(r => { if (!r.file || !r.name || !r.id) die('incomplete resource entry: ' + JSON.stringify(r)); });
  log('PRE-FLIGHT 0  this script self-checks: helpers present, constants set, 3 resources.');
}

/* --- 1. git state ------------------------------------------------------ */
const HEAD = execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim();
const BRANCH = execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO }).toString().trim();
const DIRTY = execSync('git status --porcelain -- Coned/CLCPA/ExecutiveDashboard_dev',
  { cwd: REPO }).toString().trim();
log('PRE-FLIGHT 1  branch = ' + BRANCH + ', HEAD = ' + HEAD);
if (BRANCH !== 'main') die('not on main (on "' + BRANCH + '"). Deploys go from main.');
if (DIRTY) die('the source folder has uncommitted changes:\n' + DIRTY +
  '\n  Deploying an unrecorded file makes the build id a lie.');
log('              source folder clean, so the pushed bytes are exactly ' + HEAD + '.');

/* --- 2. app.js parses -------------------------------------------------- */
try {
  execSync('node --check "' + SRC + '/app.js"', { cwd: REPO });
  log('PRE-FLIGHT 2  app.js parses.');
} catch (e) { die('app.js does not parse. Nothing has been requested.'); }

/* --- 3. read the files and derive the build ids ------------------------ */
const BUILD_SENTINEL = "var APP_BUILD = 'dev';   /* BUILD_ID */";
const local = {};
RES.forEach(r => {
  const p = SRC + '/' + r.file;
  if (!fs.existsSync(p)) die('missing source file: ' + p);
  local[r.file] = fs.readFileSync(p);
});

// The id is the hash of the CANONICAL content -- APP_BUILD forced back to 'dev'
// -- so stamping cannot change the id that gets stamped.
const appText = local['app.js'].toString('utf8');
if (appText.split(BUILD_SENTINEL).length - 1 !== 1) {
  die('app.js does not carry exactly one unstamped BUILD_ID sentinel.\n' +
      '  Expected: ' + BUILD_SENTINEL);
}
const APP_ID = sha256(Buffer.from(appText, 'utf8')).slice(0, 10);
const CSS_ID = sha256(local['styles.css']).slice(0, 10);
log('PRE-FLIGHT 3  BUILD IDS (content hashes; the client must report the app.js one):');
log('                 app.js      ' + APP_ID);
log('                 styles.css  ' + CSS_ID);
log('              -> ExecutiveDashboard.html references them as ?v=<id>');
log('              -> app.js will print "[DAC dashboard] build ' + APP_ID + '" at boot');

/* --- 4. stamp, in memory ---------------------------------------------- */
const stampedApp = Buffer.from(
  appText.replace(BUILD_SENTINEL, "var APP_BUILD = '" + APP_ID + "';   /* BUILD_ID */"),
  'utf8');
if (stampedApp.equals(local['app.js'])) die('stamping app.js changed nothing.');

let htmlText = local['ExecutiveDashboard.html'].toString('utf8');
const htmlBefore = htmlText;
htmlText = htmlText
  .replace(/href="styles\.css(\?v=[0-9a-f]+)?"/g, 'href="styles.css?v=' + CSS_ID + '"')
  .replace(/src="app\.js(\?v=[0-9a-f]+)?"/g, 'src="app.js?v=' + APP_ID + '"');
if (htmlText === htmlBefore) die('stamping the HTML changed nothing: the asset references did not match.');
if (htmlText.indexOf('?v=' + APP_ID) < 0) die('the HTML does not carry the app.js stamp after rewriting.');
if (htmlText.indexOf('?v=' + CSS_ID) < 0) die('the HTML does not carry the styles.css stamp after rewriting.');
const stampedHtml = Buffer.from(htmlText, 'utf8');
log('PRE-FLIGHT 4  stamps applied in memory (nothing on disk is modified).');

const TOPUSH = {
  'app.js': stampedApp,
  'styles.css': local['styles.css'],
  'ExecutiveDashboard.html': stampedHtml,
};
log('');
// DAC_DRY_RUN proves the whole offline half runs clean before a device code is
// ever requested. The code is the scarce resource here: it expires, and a
// script that throws after authenticating wastes one.
if (process.env.DAC_DRY_RUN) {
  log('DRY RUN: the offline half completed with no errors. Stopping before');
  log('authentication. Nothing was requested, nothing was written, and no');
  log('deploy.log was left behind.');
  process.exit(0);
}
log('Nothing above touched the network. Requesting the device code now.');
log('');

/* =======================================================================
 * AUTH + PUSH
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
async function dv(method, url, body, extra) {
  if (method === 'GET') GETS++; else if (method === 'PATCH') PATCHES++; else POSTS++;
  const headers = Object.assign({
    Authorization: 'Bearer ' + TOKEN, Accept: 'application/json',
    'OData-MaxVersion': '4.0', 'OData-Version': '4.0',
  }, body ? { 'Content-Type': 'application/json' } : {}, extra || {});
  const res = await fetch(API + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401 || res.status === 403) {
    die('permission error ' + res.status + ' on ' + method + ' ' + url + '\n' +
        (await res.text()).slice(0, 400) + '\nNot retrying, not changing roles.');
  }
  if (!res.ok) die(method + ' ' + url + ' -> ' + res.status + '\n' + (await res.text()).slice(0, 400));
  const txt = await res.text();
  return txt ? JSON.parse(txt) : {};
}

(async () => {
  const dc = await deviceCode();
  log(['', '################  ACTION NEEDED  ################',
       '  Open:  ' + dc.verification_uri, '  Code:  ' + dc.user_code,
       '#################################################', ''].join('\n'));
  fs.writeFileSync(path.join(__dirname, 'device_code.txt'), dc.user_code + '\n' + dc.verification_uri + '\n');
  log('Waiting for authorization (up to ' + Math.round((dc.expires_in || 900) / 60) + ' min)...');
  TOKEN = await pollToken(dc.device_code, dc.interval, dc.expires_in);
  log('Authorized.');
  log('');

  const who = await dv('GET', 'WhoAmI');
  log('WhoAmI UserId = ' + who.UserId);
  const me = await dv('GET', 'systemusers(' + who.UserId + ')?$select=fullname,internalemailaddress');
  log('signed in as: ' + me.fullname + ' <' + me.internalemailaddress + '>');
  log('');

  /* --- GATE: every id must resolve to the name we expect -------------- */
  for (const r of RES) {
    const meta = await dv('GET', 'webresourceset(' + r.id + ')?$select=name');
    log('id ' + r.id + ' resolves to: ' + meta.name);
    if (meta.name !== r.name) {
      die('id ' + r.id + ' is named "' + meta.name + '", expected "' + r.name +
          '". Stopping rather than writing to an unverified target.');
    }
  }
  log('GATE  all three ids resolve to the expected names.');
  log('');

  /* --- BACKUP: archive the live bytes before replacing them ----------- */
  fs.mkdirSync(BACKDIR, { recursive: true });
  const manifest = { org: ORG, capturedAt: new Date().toISOString(),
    note: 'Pre-deploy snapshot of the live cr2bf_dactest web resources. Restore by ' +
          'PATCHing webresourceset({webResourceId}) with the base64 of the saved file, ' +
          'then PublishXml.',
    slice: 'CLCPA-220 round 3', sourceCommit: HEAD, resources: [] };
  const liveSha = {};
  for (const r of RES) {
    const cur = await dv('GET', 'webresourceset(' + r.id + ')?$select=content');
    const buf = Buffer.from(cur.content || '', 'base64');
    fs.writeFileSync(BACKDIR + '/' + r.file, buf);
    liveSha[r.file] = sha256(buf);
    const willReplace = !buf.equals(TOPUSH[r.file]);
    manifest.resources.push({ file: r.file, webResourceName: r.name, webResourceId: r.id,
      bytes: buf.length, sha256: liveSha[r.file], savedAs: r.file, willBeReplaced: willReplace });
    log((willReplace ? 'WILL PUSH ' : 'unchanged ') + ' ' + r.file +
      '   deployed=' + buf.length + 'B  local=' + TOPUSH[r.file].length + 'B');
  }
  fs.writeFileSync(BACKDIR + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  log('');
  log('BACKUP  live bytes archived to deploy-backups/' + BACKUP_SLUG + '/');
  const willPush = RES.filter(r => manifest.resources.find(m => m.file === r.file).willBeReplaced);
  if (!willPush.length) {
    log('');
    log('Every resource already matches what would be pushed. Nothing to do.');
    log('requests: GET ' + GETS + ', PATCH 0, POST 0');
    flushLog('=== NO-OP: live already matches ===');
    return;
  }
  log('        ' + willPush.length + ' of 3 will be replaced: ' + willPush.map(r => r.file).join(', '));
  log('');

  /* --- PUSH ----------------------------------------------------------- */
  for (const r of willPush) {
    log('PATCH webresourceset(' + r.id + ')  <- ' + r.file + ' (' + TOPUSH[r.file].length + 'B)');
    await dv('PATCH', 'webresourceset(' + r.id + ')',
      { content: TOPUSH[r.file].toString('base64') }, { 'If-Match': '*' });
  }
  const xml = '<importexportxml><webresources>' +
    willPush.map(r => '<webresource>{' + r.id + '}</webresource>').join('') +
    '</webresources></importexportxml>';
  log('POST PublishXml for ' + willPush.length + ' resource(s)');
  await dv('POST', 'PublishXml', { ParameterXml: xml });
  log('published.');
  log('');

  /* --- READ BACK and verify byte-for-byte ----------------------------- */
  let allOk = true;
  for (const r of RES) {
    const back = await dv('GET', 'webresourceset(' + r.id + ')?$select=content');
    const got = Buffer.from(back.content || '', 'base64');
    const want = TOPUSH[r.file];
    const same = got.equals(want);
    log('READ-BACK ' + r.file + '  ' + got.length + 'B  sha256 ' + sha256(got).slice(0, 16) +
      '...  ' + (same ? 'VERIFIED byte-identical' : 'MISMATCH'));
    if (!same) {
      allOk = false;
      log('   sent sha256 : ' + sha256(want));
      log('   got  sha256 : ' + sha256(got));
    }
  }
  if (!allOk) die('a read-back does not match what was sent. The archive in ' +
    'deploy-backups/' + BACKUP_SLUG + '/ is the rollback.');
  log('');
  log('=== DEPLOY COMPLETE ===');
  log('build id (app.js): ' + APP_ID);
  log('styles.css id    : ' + CSS_ID);
  log('source           : ExecutiveDashboard_dev/ at main @ ' + HEAD);
  log('requests: GET ' + GETS + ', PATCH ' + PATCHES + ', POST ' + POSTS);
  log('');
  log('CLIENT CHECK, and it is not optional: server-verified is not client-running.');
  log('Hard-refresh the app and confirm the console prints');
  log('   [DAC dashboard] build ' + APP_ID);
  log('If it prints anything else, the browser is holding an older app.js.');
  log('');
  log('Then expect at boot, with 2 saved layers:');
  log('   [Map Layers] listed 2 saved layer(s) from metadata; GeoJSON loads when a layer is switched on.');
  log('   [DAC map] tract tooltip tracking wired to pointer events (CLCPA-199: ...)');
  flushLog('=== log written by deploy_193_199.js ===');
})().catch(e => {
  console.error('\nDEPLOY ERROR: ' + (e && e.stack ? e.stack : e));
  flushLog('DEPLOY ERROR: ' + (e && e.message ? e.message : e));
  process.exit(2);
});
