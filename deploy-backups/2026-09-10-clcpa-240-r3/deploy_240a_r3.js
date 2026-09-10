/* ExecutiveDashboard_dev -> cr2bf_dactest deploy, CLCPA-240 first half.
 *
 * The hierarchical / composite-key matcher. Pushes app.js and the HTML; the
 * HTML goes every time because it carries the ?v=<id> stamps, and app.js
 * carries APP_BUILD, so the URL that fetched a file and the file's own claim
 * about itself agree. styles.css is untouched by this ticket and the decision
 * to push it is made on BYTES, never on length.
 *
 * ORDER, and it matters: everything offline happens BEFORE the device code is
 * requested, so a mistake in this script cannot burn a code. A `sha is not
 * defined` TDZ in an earlier script cost one, and the pre-flight that would
 * have caught it only scanned app.js and not the script doing the scanning.
 * This one checks itself first.
 *
 * WHAT IS DIFFERENT IN THIS ONE, both at Emely's instruction:
 *
 *   PRE-FLIGHT 3b -- the eight symbols this ticket added or changed are
 *   counted in the COMMITTED BLOB, not the working tree. An id gate proves the
 *   bytes were reviewed; it cannot prove a particular fix is in them. A hollow
 *   commit earlier in this project is why this exists.
 *
 *   THE ROLLBACK IS DURABLE BEFORE ANY PATCH. The live bytes are archived,
 *   proven by content to be build b201bb3fcd three ways, then committed AND
 *   pushed AND verified on the remote -- and only then is anything written to
 *   Dataverse. A snapshot of an unidentified build is not a rollback, and a
 *   rollback that exists only on this machine is one disk away from nothing.
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
const BACKUP_SLUG = '2026-09-10-clcpa-240-r3';

/* What Emely approved, by name, in advance. */
const EXPECT_APP_ID = '92b1a65b17';
const EXPECT_CSS_ID = '37d0e57db0';
/* The build currently live, which this deploy replaces and which the archive
 * must be proven to hold. */
const EXPECT_PREV_BUILD = 'd91e1d19ff';

const RES = [
  { file: 'app.js', name: PREFIX + 'app.js', id: '79151fe9-3c64-f111-ab0c-7c1e521c7110' },
  { file: 'styles.css', name: PREFIX + 'styles.css', id: '7b151fe9-3c64-f111-ab0c-7c1e521c7110' },
  { file: 'ExecutiveDashboard.html', name: PREFIX + 'ExecutiveDashboard.html', id: '77151fe9-3c64-f111-ab0c-7c1e521c7110' },
];

/* PRE-FLIGHT 3b: this ticket's fingerprint, counted in the committed blob.
 *
 * Round 1's symbols stay, because round 2 must not have removed them, plus
 * round 2's own. An id gate proves the bytes were reviewed; only this proves a
 * particular fix is in them. It also caught a real thing on the round-2
 * commit: a comment still naming HIERARCHICAL_TOTALS after the rename. */
const TICKET_SYMBOLS = {
  /* --- round 1, which must survive ------------------------------------- */
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
  /* --- round 2 ---------------------------------------------------------- */
  'const HIERARCHICAL_TABLES = { A5: true, A6: true, A7: true, A8: true };': 1,
  'const INGEST_NOVALUE_MARKER = \'(no value)\';': 1,
  'function ingestIsShapeBlank(': 1,
  'rowIdx < headerRowCount || isGroupHeaderRow(row)': 1,
  /* round 3 added the label condition to this line, so the round-2 form is
   * gone and the round-3 form is asserted instead */
  'const lockTotalRow = isTotal && isHierFamily && !isHeaderRow &&': 1,
  '(isHeaderRow || lockTotalRow) ? \'\'': 1,
  'if (isGroupHeader) return { style: style, text: INGEST_NOVALUE_MARKER };': 1,
  '=== INGEST_NOVALUE_MARKER) {': 1,
  'marked (no value) across its columns': 1,
  /* the renamed constant must be gone from the whole file, comments included:
   * the round-2 commit shipped one stale reference and this is what found it */
  'HIERARCHICAL_TOTALS': 0,
  /* --- round 3 ---------------------------------------------------------- */
  'function isHierarchicalTotalLabel(': 1,
  'const groupHeaderLabels = (() => {': 1,
  'if (base.length) {': 1,
  'const rows = i.draft || [];': 1,
  'if (rowHasNumber(rows[k])) { out[normIngestKey(r[0])] = true; return; }': 1,
  'isHierarchicalTotalLabel(row[0]);': 1,
  'if (!isHierarchicalTotalLabel(rows[i][0])) continue;': 1,
  /* round 2's name for the header set is gone, replaced by the one that also
   * covers the empty-baseline fallback */
  'baselineHeaderLabels': 0,
};

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
/* THE LOG MUST NOT CREATE THE SNAPSHOT DIRECTORY.
 *
 * A bug in the round-2 script, hit immediately on round 3: an OFFLINE abort
 * called die(), die() called flushLog(), and flushLog() did mkdirSync(BACKDIR)
 * -- so a pre-flight failure created the very directory that PRE-FLIGHT 3d
 * then refuses to overwrite. The script deadlocked itself, and the second run
 * stopped on a folder holding nothing but the first run's abort message.
 *
 * So the log goes into BACKDIR only once the ARCHIVE is really there. Before
 * that it goes beside the script, where it is a record and not a landmine. */
let ARCHIVED = false;
function flushLog(tail) {
  if (tail) lines.push('', tail);
  try {
    if (ARCHIVED || fs.existsSync(BACKDIR + '/manifest.json')) {
      fs.writeFileSync(BACKDIR + '/deploy.log', lines.join('\n') + '\n');
    } else {
      fs.writeFileSync(path.join(__dirname, 'deploy_240a_r3_abort.log'),
        lines.join('\n') + '\n');
    }
  } catch (e) { /* the console output is still the record */ }
}

/* The canonical form: APP_BUILD forced back to 'dev'. The id is the hash of
 * THIS, so stamping is idempotent and re-running cannot drift the id. Used
 * both to derive the id we push and to identify the build we are replacing. */
const BUILD_SENTINEL = "var APP_BUILD = 'dev';   /* BUILD_ID */";
function canonicaliseApp(text) {
  return text.replace(/var APP_BUILD = '[^']*';   \/\* BUILD_ID \*\//,
                      BUILD_SENTINEL);
}
function stampOf(text) {
  const m = text.match(/var APP_BUILD = '([^']*)';   \/\* BUILD_ID \*\//);
  return m ? m[1] : null;
}

/* =======================================================================
 * PRE-FLIGHT, entirely offline
 * ======================================================================= */
log('=== ExecutiveDashboard_dev -> cr2bf_dactest deploy ===');
log('org: ' + ORG);
log('slice: CLCPA-240 round 3 (the lock on a year not yet saved)');
log('files: ' + RES.map(r => r.file).join(', '));
log('');

/* --- 0. this script checks itself ------------------------------------- */
{
  const required = { fs, path, crypto, execSync, log, die, sha256, flushLog,
    canonicaliseApp, stampOf };
  const missing = Object.keys(required).filter(k => required[k] === undefined ||
    (typeof required[k] !== 'function' && typeof required[k] !== 'object'));
  if (missing.length) die('this deploy script is broken: ' + missing.join(', ') + ' unusable.');
  const consts = { REPO, SRC, API, CLIENT_ID, TENANT, PREFIX, BACKUP_SLUG, BACKDIR,
    EXPECT_APP_ID, EXPECT_CSS_ID, EXPECT_PREV_BUILD, BUILD_SENTINEL };
  const empty = Object.keys(consts).filter(k => !consts[k]);
  if (empty.length) die('unset constant(s): ' + empty.join(', '));
  if (!Array.isArray(RES) || RES.length !== 3) die('the resource list is not the expected three.');
  RES.forEach(r => { if (!r.file || !r.name || !r.id) die('incomplete resource entry: ' + JSON.stringify(r)); });
  if (!Object.keys(TICKET_SYMBOLS).length) die('PRE-FLIGHT 3b has no symbols to count.');
  /* self-test the two helpers, so a broken regex is caught here and not after
   * the archive has been called proven */
  const probe = "x\nvar APP_BUILD = 'abc1234567';   /* BUILD_ID */\ny";
  if (stampOf(probe) !== 'abc1234567') die('stampOf() does not read a stamp.');
  if (canonicaliseApp(probe).indexOf(BUILD_SENTINEL) < 0) die('canonicaliseApp() does not restore the sentinel.');
  if (stampOf('no stamp here') !== null) die('stampOf() invents a stamp where there is none.');
  log('PRE-FLIGHT 0  this script self-checks: helpers present and self-tested,');
  log('              constants set, 3 resources, ' + Object.keys(TICKET_SYMBOLS).length + ' ticket symbols to count.');
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
/* the merge must actually be in this history */
try {
  execSync('git merge-base --is-ancestor c71aa19 HEAD', { cwd: REPO });
  log('              and c71aa19, the round-3 commit, is an ancestor of HEAD.');
} catch (e) { die('HEAD does not contain c71aa19, the CLCPA-240 round-3 commit.'); }

/* --- 2. app.js parses -------------------------------------------------- */
try {
  execSync('node --check "' + SRC + '/app.js"', { cwd: REPO });
  log('PRE-FLIGHT 2  app.js parses.');
} catch (e) { die('app.js does not parse. Nothing has been requested.'); }

/* --- 3. read the files and derive the build ids ------------------------ */
const local = {};
RES.forEach(r => {
  const p = SRC + '/' + r.file;
  if (!fs.existsSync(p)) die('missing source file: ' + p);
  local[r.file] = fs.readFileSync(p);
});
const appText = local['app.js'].toString('utf8');
if (appText.split(BUILD_SENTINEL).length - 1 !== 1) {
  die('app.js does not carry exactly one unstamped BUILD_ID sentinel.\n' +
      '  Expected: ' + BUILD_SENTINEL);
}
if (appText.indexOf(String.fromCharCode(0)) >= 0) {
  die('app.js contains a raw NUL byte. An earlier round of this ticket put four ' +
      'there by writing \\u0000 into the source instead of an escape.');
}
const APP_ID = sha256(Buffer.from(appText, 'utf8')).slice(0, 10);
const CSS_ID = sha256(local['styles.css']).slice(0, 10);
log('PRE-FLIGHT 3  BUILD IDS (content hashes; the client must report the app.js one):');
log('                 app.js      ' + APP_ID);
log('                 styles.css  ' + CSS_ID);
if (APP_ID !== EXPECT_APP_ID) {
  die('app.js id is ' + APP_ID + ', but ' + EXPECT_APP_ID + ' was approved.\n' +
      '  The approved id is the whole point of approving in advance.');
}
if (CSS_ID !== EXPECT_CSS_ID) {
  die('styles.css id is ' + CSS_ID + ', expected ' + EXPECT_CSS_ID + '.');
}
log('              both match the ids approved in advance.');

/* --- 3b. the ticket's own fingerprint, in the COMMITTED BLOB ----------- */
{
  const blob = execSync('git show HEAD:Coned/CLCPA/ExecutiveDashboard_dev/app.js',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8');
  const bad = [];
  Object.keys(TICKET_SYMBOLS).forEach(k => {
    const n = blob.split(k).length - 1;
    if (n !== TICKET_SYMBOLS[k]) bad.push('  ' + n + ' of ' + TICKET_SYMBOLS[k] + '   ' + k);
  });
  if (bad.length) {
    die('PRE-FLIGHT 3b: the committed blob does not carry this ticket:\n' + bad.join('\n') +
        '\n  An id gate proves the bytes were reviewed. It cannot prove the fix is in them.');
  }
  if (blob.indexOf(String.fromCharCode(0)) >= 0) die('the committed blob contains a raw NUL byte.');
  log('PRE-FLIGHT 3b all ' + Object.keys(TICKET_SYMBOLS).length +
      ' ticket symbols verified in the COMMITTED BLOB, 0 NUL bytes.');
}

/* --- 3c. the acceptance suites --------------------------------------- */
{
  const dirs = fs.readdirSync(REPO + '/Coned/CLCPA/tickets');
  const runs = [];
  dirs.forEach(d => {
    const full = REPO + '/Coned/CLCPA/tickets/' + d;
    let st; try { st = fs.statSync(full); } catch (e) { return; }
    if (!st.isDirectory()) return;
    fs.readdirSync(full).forEach(f => {
      if (/^(suite|derive|diag)_.*\.js$/.test(f)) runs.push({ dir: full, file: f });
    });
  });
  if (runs.length < 20) die('only found ' + runs.length + ' suites; expected at least 20.');
  let red = [];
  runs.forEach(r => {
    let out = '';
    try { out = execSync('node "' + r.file + '"', { cwd: r.dir, maxBuffer: 1 << 28 }).toString(); }
    catch (e) { red.push(r.file + ' (exit ' + (e.status === undefined ? '?' : e.status) + ')'); return; }
    const m = out.match(/(\d+) passed, (\d+) failed/);
    if (!m) { red.push(r.file + ' (no result line)'); return; }
    if (parseInt(m[2], 10) !== 0) red.push(r.file + ' (' + m[0] + ')');
  });
  if (red.length) die('suites not green:\n  ' + red.join('\n  '));
  log('PRE-FLIGHT 3c all ' + runs.length + ' suites green.');
}

/* --- 3d. the snapshot directory must be ABSENT ------------------------ */
if (fs.existsSync(BACKDIR)) {
  die('deploy-backups/' + BACKUP_SLUG + ' already exists.\n' +
      '  The archive must be CREATED, not overwritten -- that is how the folder\n' +
      '  names in this repository once drifted a whole deploy out of step.');
}
log('PRE-FLIGHT 3d snapshot directory is absent, so the archive will be created.');

/* --- 4. stamp, in memory ---------------------------------------------- */
const stampedApp = Buffer.from(
  appText.replace(BUILD_SENTINEL, "var APP_BUILD = '" + APP_ID + "';   /* BUILD_ID */"),
  'utf8');
if (stampedApp.equals(local['app.js'])) die('stamping app.js changed nothing.');
if (stampOf(stampedApp.toString('utf8')) !== APP_ID) die('the stamped app.js does not read back its own id.');
if (sha256(Buffer.from(canonicaliseApp(stampedApp.toString('utf8')), 'utf8')).slice(0, 10) !== APP_ID) {
  die('canonicalising the stamped app.js does not reproduce ' + APP_ID + '. Stamping is not idempotent.');
}

let htmlText = local['ExecutiveDashboard.html'].toString('utf8');
const htmlBefore = htmlText;
htmlText = htmlText
  .replace(/href="styles\.css(\?v=[0-9a-f]+)?"/g, 'href="styles.css?v=' + CSS_ID + '"')
  .replace(/src="app\.js(\?v=[0-9a-f]+)?"/g, 'src="app.js?v=' + APP_ID + '"');
if (htmlText === htmlBefore) die('stamping the HTML changed nothing: the asset references did not match.');
if (htmlText.indexOf('?v=' + APP_ID) < 0) die('the HTML does not carry the app.js stamp after rewriting.');
if (htmlText.indexOf('?v=' + CSS_ID) < 0) die('the HTML does not carry the styles.css stamp after rewriting.');
if (/\?v=[0-9a-f]+/.test(htmlText.replace(new RegExp('\\?v=' + APP_ID, 'g'), '')
    .replace(new RegExp('\\?v=' + CSS_ID, 'g'), ''))) {
  die('the HTML still carries a stale ?v= stamp that is neither of the two new ids.');
}
const stampedHtml = Buffer.from(htmlText, 'utf8');
log('PRE-FLIGHT 4  stamps applied in memory, both verified present and no stale');
log('              third stamp left behind. Nothing on disk is modified.');

const TOPUSH = {
  'app.js': stampedApp,
  'styles.css': local['styles.css'],
  'ExecutiveDashboard.html': stampedHtml,
};
log('');
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
/* RETRY ON TRANSPORT, NEVER ON A STATUS.
 *
 * The round-2 deploy died with "TypeError: fetch failed" in the middle of the
 * app.js PATCH, having already archived and pushed the rollback. It cost a
 * device code and left a live state nobody could describe until a separate
 * script read it back. A transport failure and an HTTP status are different
 * things: a 4xx or 5xx is an ANSWER, and repeating the request only repeats
 * it, so those still die on the first reply. A "fetch failed" is no answer at
 * all and gets four attempts with a backoff. */
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
          (await res.text()).slice(0, 400) + '\nNot retrying, not changing roles.');
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
  } catch (e) { /* the console is still the record */ }
  log('Waiting for authorization (up to ' + Math.round((dc.expires_in || 900) / 60) + ' min)...');
  TOKEN = await pollToken(dc.device_code, dc.interval, dc.expires_in);
  log('Authorized.');
  log('');

  const who = await dv('GET', 'WhoAmI');
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

  /* --- ARCHIVE the live bytes, and PROVE which build they are --------- */
  fs.mkdirSync(BACKDIR, { recursive: true });
  ARCHIVED = true;   // from here the log belongs beside the archive
  const manifest = { org: ORG, capturedAt: new Date().toISOString(),
    note: 'Pre-deploy snapshot of the live cr2bf_dactest web resources. Restore by ' +
          'PATCHing webresourceset({webResourceId}) with the base64 of the saved file, ' +
          'then PublishXml.',
    slice: 'clcpa-240-r3', sourceCommit: HEAD, resources: [] };
  const live = {};
  for (const r of RES) {
    const cur = await dv('GET', 'webresourceset(' + r.id + ')?$select=content');
    const buf = Buffer.from(cur.content || '', 'base64');
    fs.writeFileSync(BACKDIR + '/' + r.file, buf);
    live[r.file] = buf;
    const willReplace = !buf.equals(TOPUSH[r.file]);
    manifest.resources.push({ file: r.file, webResourceName: r.name, webResourceId: r.id,
      bytes: buf.length, sha256: sha256(buf), savedAs: r.file, willBeReplaced: willReplace });
    log((willReplace ? 'WILL PUSH ' : 'unchanged ') + ' ' + r.file +
      '   deployed=' + buf.length + 'B  local=' + TOPUSH[r.file].length + 'B' +
      (buf.length === TOPUSH[r.file].length && willReplace ? '  (same length, different bytes)' : ''));
  }

  /* THREE WAYS, and all three must agree. A snapshot of an unidentified build
   * is not a rollback. */
  const liveAppText = live['app.js'].toString('utf8');
  const liveStamp = stampOf(liveAppText);
  const liveDerived = sha256(Buffer.from(canonicaliseApp(liveAppText), 'utf8')).slice(0, 10);
  const liveCssId = sha256(live['styles.css']).slice(0, 10);
  log('');
  log('PROVENANCE of the archive:');
  log('  app.js APP_BUILD stamp        : ' + liveStamp);
  log('  app.js canonicalised + hashed : ' + liveDerived);
  log('  expected previous build       : ' + EXPECT_PREV_BUILD);
  log('  styles.css id (cross-check)   : ' + liveCssId);
  if (liveStamp !== EXPECT_PREV_BUILD || liveDerived !== EXPECT_PREV_BUILD) {
    die('the live app.js is not ' + EXPECT_PREV_BUILD + ' (stamp ' + liveStamp +
        ', derived ' + liveDerived + ').\n' +
        '  Something was deployed that this deploy does not know about. Stopping\n' +
        '  BEFORE any write: an unidentified snapshot is not a rollback.');
  }
  if (liveCssId !== EXPECT_CSS_ID) {
    die('the live styles.css is ' + liveCssId + ', not the ' + EXPECT_CSS_ID +
        ' this deploy expects to leave in place.');
  }
  manifest.provenance = { stampedAs: liveStamp, derivedBuildId: liveDerived,
    expectedPrevBuildId: EXPECT_PREV_BUILD, styleId: liveCssId, matches: true,
    newBuildId: APP_ID };
  fs.writeFileSync(BACKDIR + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  log('  -> all three agree. The archive holds ' + EXPECT_PREV_BUILD + '.');
  log('');

  const willPush = RES.filter(r => manifest.resources.find(m => m.file === r.file).willBeReplaced);
  if (!willPush.length) {
    log('Every resource already matches what would be pushed. Nothing to do.');
    log('requests: GET ' + GETS + ', PATCH 0, POST 0');
    flushLog('=== NO-OP: live already matches ===');
    return;
  }
  log('        ' + willPush.length + ' of 3 will be replaced: ' + willPush.map(r => r.file).join(', '));
  log('');

  /* --- MAKE THE ROLLBACK DURABLE, before any PATCH ------------------- */
  flushLog(null);
  {
    execSync('git add -- "deploy-backups/' + BACKUP_SLUG + '"', { cwd: REPO });
    const staged = execSync('git diff --cached --name-only', { cwd: REPO }).toString().trim();
    if (!staged) die('nothing staged for the snapshot commit. A commit is verified the ' +
                     'way a deploy is, and this one would have been hollow.');
    const outside = staged.split('\n').filter(f => f.indexOf('deploy-backups/') !== 0);
    if (outside.length) die('the snapshot commit would carry files outside ' +
                            'deploy-backups/: ' + outside.join(', '));
    const msg = 'deploy-backups: pre-deploy snapshot for the CLCPA-240 round-3 deploy\n\n' +
      'The live cr2bf_dactest bytes as they stood before build ' + APP_ID + ' went up.\n' +
      'Identified by content three ways, all agreeing on ' + EXPECT_PREV_BUILD + ':\n' +
      '  - app.js APP_BUILD stamp        ' + liveStamp + '\n' +
      '  - app.js canonicalised + hashed ' + liveDerived + '\n' +
      '  - styles.css id, unchanged      ' + liveCssId + '\n' +
      'Committed and pushed BEFORE any PATCH, so the rollback exists off this\n' +
      'machine before anything is overwritten.\n\n' +
      'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>\n';
    fs.writeFileSync(BACKDIR + '/.commitmsg', msg);
    execSync('git commit -q -F "' + BACKDIR + '/.commitmsg"', { cwd: REPO });
    fs.unlinkSync(BACKDIR + '/.commitmsg');
    const snapSha = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim();
    log('ROLLBACK  snapshot committed as ' + snapSha.slice(0, 7));
    /* pushes on this machine hang and then succeed on retry */
    let pushed = false;
    for (let attempt = 1; attempt <= 3 && !pushed; attempt++) {
      try {
        execSync('git push origin main', { cwd: REPO, timeout: 300000, stdio: 'pipe' });
        pushed = true;
      } catch (e) {
        log('          push attempt ' + attempt + ' did not return cleanly; checking the remote.');
      }
      const remote = execSync('git ls-remote origin refs/heads/main', { cwd: REPO })
        .toString().trim().split(/\s+/)[0];
      if (remote === snapSha) { pushed = true; log('          remote main = ' + remote.slice(0, 7) + '  VERIFIED'); }
    }
    if (!pushed) {
      die('the snapshot commit is on this machine but NOT on the remote after three\n' +
          '  attempts. Stopping before any PATCH: the rollback is not durable yet.\n' +
          '  Nothing has been written to Dataverse. Push main by hand, then re-run\n' +
          '  (PRE-FLIGHT 3d will need the snapshot directory question resolved).');
    }
    log('          the rollback is durable off this machine. Proceeding to write.');
  }
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
  log('POST PublishXml for ' + willPush.length + ' resource(s)  (one call, all of them)');
  await dv('POST', 'PublishXml', { ParameterXml: xml });
  log('published.');
  log('');

  /* --- READ BACK, byte-for-byte, then check the SERVER's own stamps --- */
  let allOk = true;
  const server = {};
  for (const r of RES) {
    const back = await dv('GET', 'webresourceset(' + r.id + ')?$select=content');
    const got = Buffer.from(back.content || '', 'base64');
    server[r.file] = got;
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
    'deploy-backups/' + BACKUP_SLUG + '/ is the rollback, and it is already pushed.');

  /* The server copy must CARRY the ids, not merely match our bytes. */
  const srvStamp = stampOf(server['app.js'].toString('utf8'));
  const srvDerived = sha256(Buffer.from(canonicaliseApp(server['app.js'].toString('utf8')), 'utf8')).slice(0, 10);
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
  /* and the ticket itself is in the bytes now on the server */
  const srvApp = server['app.js'].toString('utf8');
  const missing = Object.keys(TICKET_SYMBOLS)
    .filter(k => (srvApp.split(k).length - 1) !== TICKET_SYMBOLS[k]);
  if (missing.length) die('the SERVER copy is missing this ticket: ' + missing.join(' | '));
  log('  all ' + Object.keys(TICKET_SYMBOLS).length + ' ticket symbols present in the SERVER copy.');

  log('');
  log('=== DEPLOY COMPLETE ===');
  log('build id (app.js): ' + APP_ID);
  log('styles.css id    : ' + CSS_ID + ' (not pushed; bytes identical to live)');
  log('previous build   : ' + EXPECT_PREV_BUILD + ', archived and pushed before any write');
  log('source           : ExecutiveDashboard_dev/ at main @ ' + HEAD);
  log('requests: GET ' + GETS + ', PATCH ' + PATCHES + ', POST ' + POSTS);
  log('');
  log('CLIENT CHECK, and it is not optional: server-verified is not client-running.');
  log('Hard-refresh the app and confirm the console prints');
  log('   [DAC dashboard] build ' + APP_ID);
  log('If it prints anything else, the browser is holding an older app.js.');
  log('');
  log('THE ACCEPTANCE PASS for CLCPA-240 round 3:');
  log('  1. THE SCREEN THAT FAILED. A.5, a fresh year, IMPORT and do NOT save.');
  log('     The 9 group headers render as BANDS: no input, no x. Round 2 left');
  log('     all nine open here, and that is the whole of this round.');
  log('  2. The 31 data rows KEEP their inputs and their x. The lock must not');
  log('     have spread.');
  log('  3. + Add Row, type a program name, then + Add Row again: the row you');
  log('     were filling in stays editable. It must not lock under you.');
  log('  4. Save, then reopen: unchanged from what you already accepted.');
  log('  5. Type a couple of values and leave the rest blank. A row such as');
  log('     "Building Shell" may still be wrongly inferred as a total -- that is');
  log('     pre-existing and has its own ticket -- but it KEEPS its input and');
  log('     its x, so you can correct it. Round 2 froze two such rows.');
  log('  6. A.1, a FLAT table: its Total row still has an editable label and');
  log('     an x. CLCPA-205 item 2 is deliberately untouched.');
  log('  7. The template is unchanged from round 2: headings read (no value),');
  log('     totals read (calculated), and the round trip still lands 50 rows.');
  log('');
  log('THINGS THAT ARE NOT DEFECTS IN THIS BUILD, all disclosed:');
  log('  - A8:2025 row 25, "Total CES Programs Installations", stays EDITABLE');
  log('    with its x. It holds 336,599 where A8s own rows sum to 283,852, so');
  log('    arithmetic cannot confirm it and the lock does not reach it.');
  log('  - 2099 A5 computes a grand total of 27,834 where 2025 shows the stored');
  log('    27,833. Correct-by-route, disclosed in PR #220.');
  log('  - A draft in which NOTHING has a value locks no headers at all. Nothing');
  log('    has landed in that state; one value in a group locks its caption.');
  log('  - The render calls recomputeTotals before computing its flags, so on a');
  log('    sparse draft a value-less total row loses its total status. Identical');
  log('    on the previous build; it goes with the sparse-inference ticket.');
  flushLog('=== log written by deploy_240a_r3.js ===');
})().catch(e => {
  console.error('\nDEPLOY ERROR: ' + (e && e.stack ? e.stack : e));
  flushLog('DEPLOY ERROR: ' + (e && e.message ? e.message : e));
  process.exit(2);
});
