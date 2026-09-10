/* CLCPA-240 round 2: INSPECT the live state, then finish the approved deploy.
 *
 * WHAT HAPPENED. deploy_240a_r2.js completed every gate, archived the live
 * bytes, proved them to be 69d8b300a7 three ways, committed and PUSHED the
 * rollback (bf9a8a2, remote-verified), and then threw "TypeError: fetch
 * failed" during the app.js PATCH. So:
 *
 *   - the rollback exists off this machine. That gate did its job.
 *   - app.js may hold the new bytes, or the old ones, or a partial write.
 *   - ExecutiveDashboard.html was NOT sent.
 *   - PublishXml was NOT called, so whatever is staged is not published.
 *
 * A partial deploy is not a thing to reason about from a log. This script
 * READS the three resources first and refuses to write unless the live state
 * is one of exactly two known ones: entirely the previous build, or app.js
 * already carrying the new bytes. Any third state stops it, because a torn
 * write is a restore decision and not mine to make silently.
 *
 * IT DOES NOT TOUCH THE ARCHIVE. deploy-backups/2026-09-10-clcpa-240-r2/
 * holds the rollback and its manifest; this appends to the log and writes
 * nothing else there.
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
const BACKUP_SLUG = '2026-09-10-clcpa-240-r2';
const BACKDIR = REPO + '/deploy-backups/' + BACKUP_SLUG;

const EXPECT_APP_ID = 'd91e1d19ff';
const EXPECT_CSS_ID = '37d0e57db0';
const EXPECT_PREV_BUILD = '69d8b300a7';
const ROLLBACK_COMMIT = 'bf9a8a2';

const RES = [
  { file: 'app.js', name: PREFIX + 'app.js', id: '79151fe9-3c64-f111-ab0c-7c1e521c7110' },
  { file: 'styles.css', name: PREFIX + 'styles.css', id: '7b151fe9-3c64-f111-ab0c-7c1e521c7110' },
  { file: 'ExecutiveDashboard.html', name: PREFIX + 'ExecutiveDashboard.html', id: '77151fe9-3c64-f111-ab0c-7c1e521c7110' },
];

const TICKET_SYMBOLS = {
  'function ingestRowKey(': 1,
  'function ingestGroupOf(': 1,
  'function ingestIsHeaderRow(': 1,
  'function ingestIsBlankCell(': 1,
  'function ingestKeyColCount(': 1,
  'const INGEST_KEY_COLS = { A3: 2, A4: 2 };': 1,
  'const INGEST_GROUPED = { A5: true, A6: true, A8: true };': 1,
  'const INGEST_KEY_SEP = String.fromCharCode(31);': 1,
  'ingestRowKey(body, bi, labelCols, grouped)': 2,
  'ingestRowKey(candidate, idx, draftCols, grouped)': 1,
  'labelCols.indexOf(idx) >= 0': 1,
  'const HIERARCHICAL_TABLES = { A5: true, A6: true, A7: true, A8: true };': 1,
  'const INGEST_NOVALUE_MARKER = \'(no value)\';': 1,
  'function ingestIsShapeBlank(': 1,
  'rowIdx < headerRowCount || isGroupHeaderRow(row)': 1,
  'const lockTotalRow = isTotal && isHierFamily && !isHeaderRow;': 1,
  '(isHeaderRow || lockTotalRow) ? \'\'': 1,
  'if (isGroupHeader) return { style: style, text: INGEST_NOVALUE_MARKER };': 1,
  '=== INGEST_NOVALUE_MARKER) {': 1,
  'baselineHeaderLabels': 2,
  'marked (no value) across its columns': 1,
  'HIERARCHICAL_TOTALS': 0,
};

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const die = (m) => { console.error('\nSTOP: ' + m); try { flushLog('ABORTED: ' + m); } catch (e) {} process.exit(1); };
const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
let GETS = 0, PATCHES = 0, POSTS = 0;

function flushLog(tail) {
  if (tail) lines.push('', tail);
  try {
    fs.appendFileSync(BACKDIR + '/deploy.log',
      '\n\n===== RESUMED by finish_240a_r2.js after "fetch failed" =====\n' +
      lines.join('\n') + '\n');
  } catch (e) { /* the console output is still the record */ }
}

const BUILD_SENTINEL = "var APP_BUILD = 'dev';   /* BUILD_ID */";
const canonicaliseApp = (t) =>
  t.replace(/var APP_BUILD = '[^']*';   \/\* BUILD_ID \*\//, BUILD_SENTINEL);
const stampOf = (t) => {
  const m = t.match(/var APP_BUILD = '([^']*)';   \/\* BUILD_ID \*\//);
  return m ? m[1] : null;
};

/* ===================== offline, before any device code ================== */
log('=== CLCPA-240 round 2: inspect, then finish the approved deploy ===');
log('org: ' + ORG);
log('');

{
  const req = { fs, path, crypto, execSync, log, die, sha256, flushLog, canonicaliseApp, stampOf };
  const miss = Object.keys(req).filter(k => req[k] === undefined);
  if (miss.length) die('this script is broken: ' + miss.join(', '));
  const probe = "x\nvar APP_BUILD = 'abc1234567';   /* BUILD_ID */\ny";
  if (stampOf(probe) !== 'abc1234567') die('stampOf() does not read a stamp.');
  if (canonicaliseApp(probe).indexOf(BUILD_SENTINEL) < 0) die('canonicaliseApp() is broken.');
  log('PRE-FLIGHT 0  self-check: helpers present and self-tested.');
}

const HEAD = execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim();
const BRANCH = execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO }).toString().trim();
const DIRTY = execSync('git status --porcelain -- Coned/CLCPA/ExecutiveDashboard_dev',
  { cwd: REPO }).toString().trim();
log('PRE-FLIGHT 1  branch = ' + BRANCH + ', HEAD = ' + HEAD);
if (BRANCH !== 'main') die('not on main (on "' + BRANCH + '").');
if (DIRTY) die('the source folder has uncommitted changes:\n' + DIRTY);
try {
  execSync('git merge-base --is-ancestor 68567b8 HEAD', { cwd: REPO });
} catch (e) { die('HEAD does not contain 68567b8, the round-2 commit.'); }
log('              clean, and 68567b8 is an ancestor.');

/* THE ROLLBACK MUST STILL BE THERE, and still be on the remote. */
{
  if (!fs.existsSync(BACKDIR + '/app.js') || !fs.existsSync(BACKDIR + '/manifest.json')) {
    die('the archive in deploy-backups/' + BACKUP_SLUG + ' is incomplete.');
  }
  const arch = fs.readFileSync(BACKDIR + '/app.js', 'utf8');
  const aStamp = stampOf(arch);
  const aDerived = sha256(Buffer.from(canonicaliseApp(arch), 'utf8')).slice(0, 10);
  if (aStamp !== EXPECT_PREV_BUILD || aDerived !== EXPECT_PREV_BUILD) {
    die('the archived app.js is not ' + EXPECT_PREV_BUILD +
        ' (stamp ' + aStamp + ', derived ' + aDerived + ').');
  }
  const remote = execSync('git ls-remote origin refs/heads/main', { cwd: REPO })
    .toString().trim().split(/\s+/)[0];
  const has = execSync('git branch -r --contains ' + ROLLBACK_COMMIT + ' 2>&1 || true',
    { cwd: REPO }).toString();
  if (has.indexOf('origin/main') < 0) {
    die('the rollback commit ' + ROLLBACK_COMMIT + ' is not on origin/main.');
  }
  log('PRE-FLIGHT 1b the rollback is intact and pushed: archive proves ' +
      EXPECT_PREV_BUILD + ',');
  log('              ' + ROLLBACK_COMMIT + ' is on origin/main (now at ' +
      remote.slice(0, 7) + ').');
}

try { execSync('node --check "' + SRC + '/app.js"', { cwd: REPO }); }
catch (e) { die('app.js does not parse.'); }
log('PRE-FLIGHT 2  app.js parses.');

const local = {};
RES.forEach(r => { local[r.file] = fs.readFileSync(SRC + '/' + r.file); });
const appText = local['app.js'].toString('utf8');
if (appText.split(BUILD_SENTINEL).length - 1 !== 1) die('app.js has no single unstamped sentinel.');
if (appText.indexOf(String.fromCharCode(0)) >= 0) die('app.js contains a raw NUL byte.');
const APP_ID = sha256(Buffer.from(appText, 'utf8')).slice(0, 10);
const CSS_ID = sha256(local['styles.css']).slice(0, 10);
log('PRE-FLIGHT 3  ids: app.js ' + APP_ID + ', styles.css ' + CSS_ID);
if (APP_ID !== EXPECT_APP_ID) die('app.js id is ' + APP_ID + ', approved was ' + EXPECT_APP_ID + '.');
if (CSS_ID !== EXPECT_CSS_ID) die('styles.css id is ' + CSS_ID + '.');

{
  const blob = execSync('git show HEAD:Coned/CLCPA/ExecutiveDashboard_dev/app.js',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8');
  const bad = Object.keys(TICKET_SYMBOLS)
    .filter(k => (blob.split(k).length - 1) !== TICKET_SYMBOLS[k]);
  if (bad.length) die('PRE-FLIGHT 3b: the committed blob does not carry this ticket: ' + bad.join(' | '));
  log('PRE-FLIGHT 3b all ' + Object.keys(TICKET_SYMBOLS).length +
      ' ticket symbols verified in the COMMITTED BLOB.');
}

const stampedApp = Buffer.from(
  appText.replace(BUILD_SENTINEL, "var APP_BUILD = '" + APP_ID + "';   /* BUILD_ID */"), 'utf8');
if (stampOf(stampedApp.toString('utf8')) !== APP_ID) die('the stamped app.js does not read back its id.');
let htmlText = local['ExecutiveDashboard.html'].toString('utf8');
htmlText = htmlText
  .replace(/href="styles\.css(\?v=[0-9a-f]+)?"/g, 'href="styles.css?v=' + CSS_ID + '"')
  .replace(/src="app\.js(\?v=[0-9a-f]+)?"/g, 'src="app.js?v=' + APP_ID + '"');
if (htmlText.indexOf('?v=' + APP_ID) < 0 || htmlText.indexOf('?v=' + CSS_ID) < 0) {
  die('the HTML does not carry both stamps after rewriting.');
}
const stampedHtml = Buffer.from(htmlText, 'utf8');
const TOPUSH = { 'app.js': stampedApp, 'styles.css': local['styles.css'],
                 'ExecutiveDashboard.html': stampedHtml };
log('PRE-FLIGHT 4  stamps applied in memory. Nothing on disk is modified.');
log('');
if (process.env.DAC_DRY_RUN) {
  log('DRY RUN: the offline half is clean. Stopping before authentication.');
  process.exit(0);
}
log('Nothing above touched the network. Requesting the device code now.');
log('');

/* ===================== auth ============================================= */
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
    if (j.error === 'expired_token') die('the device code expired.');
    if (j.error === 'authorization_declined') die('sign-in was declined.');
    die('token poll failed: ' + JSON.stringify(j));
  }
  die('timed out waiting for authorization.');
}
let TOKEN = null;
/* RETRY, because "fetch failed" is what put this script here. A transport
 * error is retried with a backoff; an HTTP status is never retried, because a
 * 4xx or 5xx is an answer and repeating the request would only repeat it. */
async function dv(method, url, body, extra) {
  if (method === 'GET') GETS++; else if (method === 'PATCH') PATCHES++; else POSTS++;
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
          (await res.text()).slice(0, 400));
    }
    if (!res.ok) die(method + ' ' + url + ' -> ' + res.status + '\n' + (await res.text()).slice(0, 400));
    const txt = await res.text();
    return txt ? JSON.parse(txt) : {};
  }
  die('four transport failures on ' + method + ' ' + url + ': ' +
      (lastErr && lastErr.message) + '\nNothing further was attempted.');
}

(async () => {
  const dc = await deviceCode();
  log(['', '################  ACTION NEEDED  ################',
       '  Open:  ' + dc.verification_uri, '  Code:  ' + dc.user_code,
       '#################################################', ''].join('\n'));
  try {
    fs.writeFileSync(path.join(__dirname, 'device_code.txt'),
      dc.user_code + '\n' + dc.verification_uri + '\n');
  } catch (e) { /* console is the record */ }
  TOKEN = await pollToken(dc.device_code, dc.interval, dc.expires_in);
  log('Authorized.');
  const who = await dv('GET', 'WhoAmI');
  const me = await dv('GET', 'systemusers(' + who.UserId + ')?$select=fullname,internalemailaddress');
  log('signed in as: ' + me.fullname + ' <' + me.internalemailaddress + '>');
  log('');

  for (const r of RES) {
    const meta = await dv('GET', 'webresourceset(' + r.id + ')?$select=name');
    if (meta.name !== r.name) {
      die('id ' + r.id + ' is named "' + meta.name + '", expected "' + r.name + '".');
    }
  }
  log('GATE  all three ids resolve to the expected names.');
  log('');

  /* ---- READ the live state, and classify it ------------------------- */
  const live = {};
  for (const r of RES) {
    const cur = await dv('GET', 'webresourceset(' + r.id + ')?$select=content');
    live[r.file] = Buffer.from(cur.content || '', 'base64');
  }
  const archApp = fs.readFileSync(BACKDIR + '/app.js');
  const archHtml = fs.readFileSync(BACKDIR + '/ExecutiveDashboard.html');
  const liveAppText = live['app.js'].toString('utf8');
  const liveStamp = stampOf(liveAppText);
  const liveDerived = sha256(Buffer.from(canonicaliseApp(liveAppText), 'utf8')).slice(0, 10);

  log('LIVE STATE, read rather than assumed:');
  RES.forEach(r => {
    const b = live[r.file];
    const isNew = b.equals(TOPUSH[r.file]);
    const isOld = r.file === 'app.js' ? b.equals(archApp)
      : (r.file === 'ExecutiveDashboard.html' ? b.equals(archHtml) : b.equals(TOPUSH[r.file]));
    log('  ' + r.file.padEnd(24) + b.length + 'B  sha ' + sha256(b).slice(0, 12) +
        '  ' + (isNew ? 'NEW bytes' : (isOld ? 'previous bytes' : 'NEITHER -- unknown')));
  });
  log('  app.js APP_BUILD stamp        : ' + liveStamp);
  log('  app.js canonicalised + hashed : ' + liveDerived);
  log('');

  const appIsNew = live['app.js'].equals(TOPUSH['app.js']);
  const appIsOld = live['app.js'].equals(archApp);
  const cssOk = live['styles.css'].equals(TOPUSH['styles.css']);
  const htmlIsNew = live['ExecutiveDashboard.html'].equals(TOPUSH['ExecutiveDashboard.html']);
  const htmlIsOld = live['ExecutiveDashboard.html'].equals(archHtml);

  if (!cssOk) die('styles.css is neither what we expect to leave nor the archive. Stopping.');
  if (!appIsNew && !appIsOld) {
    die('THE LIVE app.js IS A THIRD STATE: not the new bytes and not the archived\n' +
        '  previous build (stamp ' + liveStamp + ', derived ' + liveDerived + ', ' +
        live['app.js'].length + 'B).\n' +
        '  A torn write is a RESTORE decision, and it is not mine to make silently.\n' +
        '  The rollback is deploy-backups/' + BACKUP_SLUG + '/, committed as ' +
        ROLLBACK_COMMIT + '.\n  Nothing has been written by this script.');
  }
  if (!htmlIsNew && !htmlIsOld) {
    die('the live HTML is neither the new bytes nor the archive. Stopping without writing.');
  }
  log('CLASSIFIED: app.js is ' + (appIsNew ? 'ALREADY the new bytes (the PATCH landed ' +
      'before the transport failed)' : 'still the previous build (the PATCH did not land)') +
      ', HTML is ' + (htmlIsNew ? 'new' : 'previous') + '.');
  log('            Either way the state is KNOWN, so finishing is safe.');
  log('');

  /* ---- finish: PATCH what differs, then ONE publish ----------------- */
  const need = RES.filter(r => !live[r.file].equals(TOPUSH[r.file]));
  for (const r of need) {
    log('PATCH webresourceset(' + r.id + ')  <- ' + r.file + ' (' + TOPUSH[r.file].length + 'B)');
    await dv('PATCH', 'webresourceset(' + r.id + ')',
      { content: TOPUSH[r.file].toString('base64') }, { 'If-Match': '*' });
  }
  if (!need.length) log('every resource already matches; nothing to PATCH.');

  /* PUBLISH BOTH CHANGED RESOURCES REGARDLESS. The first run never called
   * PublishXml, so an app.js that was already PATCHed is staged and unpublished
   * -- which is precisely why the app kept serving the old build. */
  const toPublish = RES.filter(r => r.file !== 'styles.css');
  const xml = '<importexportxml><webresources>' +
    toPublish.map(r => '<webresource>{' + r.id + '}</webresource>').join('') +
    '</webresources></importexportxml>';
  log('POST PublishXml for ' + toPublish.length + ' resource(s)  (one call)');
  await dv('POST', 'PublishXml', { ParameterXml: xml });
  log('published.');
  log('');

  /* ---- read back, byte-for-byte, then the server's own stamps -------- */
  let allOk = true;
  const server = {};
  for (const r of RES) {
    const back = await dv('GET', 'webresourceset(' + r.id + ')?$select=content');
    const got = Buffer.from(back.content || '', 'base64');
    server[r.file] = got;
    const same = got.equals(TOPUSH[r.file]);
    log('READ-BACK ' + r.file.padEnd(24) + got.length + 'B  sha256 ' +
        sha256(got).slice(0, 16) + '  ' + (same ? 'VERIFIED byte-identical' : 'MISMATCH'));
    if (!same) { allOk = false; log('   sent ' + sha256(TOPUSH[r.file])); log('   got  ' + sha256(got)); }
  }
  if (!allOk) die('a read-back does not match. The rollback is ' + ROLLBACK_COMMIT + '.');

  const srvApp = server['app.js'].toString('utf8');
  const srvStamp = stampOf(srvApp);
  const srvDerived = sha256(Buffer.from(canonicaliseApp(srvApp), 'utf8')).slice(0, 10);
  const srvHtml = server['ExecutiveDashboard.html'].toString('utf8');
  log('');
  log('SERVER-SIDE STAMPS:');
  log('  app.js APP_BUILD              : ' + srvStamp + (srvStamp === APP_ID ? '  ok' : '  WRONG'));
  log('  app.js canonicalised + hashed : ' + srvDerived + (srvDerived === APP_ID ? '  ok' : '  WRONG'));
  log('  HTML references app.js?v=     : ' + (srvHtml.indexOf('?v=' + APP_ID) >= 0 ? APP_ID + '  ok' : 'MISSING'));
  log('  HTML references styles.css?v= : ' + (srvHtml.indexOf('?v=' + CSS_ID) >= 0 ? CSS_ID + '  ok' : 'MISSING'));
  if (srvStamp !== APP_ID || srvDerived !== APP_ID ||
      srvHtml.indexOf('?v=' + APP_ID) < 0 || srvHtml.indexOf('?v=' + CSS_ID) < 0) {
    die('the server copy does not carry the expected ids.');
  }
  const missing = Object.keys(TICKET_SYMBOLS)
    .filter(k => (srvApp.split(k).length - 1) !== TICKET_SYMBOLS[k]);
  if (missing.length) die('the SERVER copy is missing this ticket: ' + missing.join(' | '));
  log('  all ' + Object.keys(TICKET_SYMBOLS).length + ' ticket symbols present in the SERVER copy.');

  log('');
  log('=== DEPLOY COMPLETE (resumed) ===');
  log('build id (app.js): ' + APP_ID);
  log('styles.css id    : ' + CSS_ID + ' (not pushed; bytes identical to live)');
  log('previous build   : ' + EXPECT_PREV_BUILD + ', archived and pushed as ' + ROLLBACK_COMMIT);
  log('source           : ExecutiveDashboard_dev/ at main @ ' + HEAD);
  log('requests: GET ' + GETS + ', PATCH ' + PATCHES + ', POST ' + POSTS);
  log('');
  log('CLIENT CHECK: hard-refresh and confirm the console prints');
  log('   [DAC dashboard] build ' + APP_ID);
  flushLog('=== resumed log written by finish_240a_r2.js ===');
})().catch(e => {
  console.error('\nRESUME ERROR: ' + (e && e.stack ? e.stack : e));
  flushLog('RESUME ERROR: ' + (e && e.message ? e.message : e));
  process.exit(2);
});
