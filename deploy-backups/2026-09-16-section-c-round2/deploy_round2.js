/* ExecutiveDashboard_dev -> cr2bf_dactest deploy: THE SECTION C ROUND-2 WAVE.
 *
 * Three tickets: CLCPA-252 round 2 (a fresh year derives its title), CLCPA-264
 * (a file names its table, and a mismatch is an advisory) and CLCPA-263 (the
 * value (pct) composites, derived at render).
 *
 * STYLES.CSS MOVES THIS TIME, for the first time since CLCPA-249: CLCPA-264
 * adds .ingest-staged-warn. So all THREE web resources are replaced, and
 * PRE-FLIGHT 3b carries a stylesheet half -- an app.js-only fingerprint would
 * have said nothing at all about the rule that ships beside it.
 *
 * THE PREVIOUS-BUILD CONSTANTS ARE READ FROM THE ORG, never derived from git.
 * The package deploy earned that rule: group A had merged to main and was
 * never deployed, so main's tip derived 671929eb23 while the org served
 * 9a59621784, and a git-derived expectation would have halted on a perfectly
 * healthy org. Here the org is expected to serve 9eb3bab955 + af0c14ea64, and
 * the script halts if it hands back anything else.
 *
 * AND THE TWO CSS CONSTANTS CAME APART THIS TIME. The package left styles.css
 * in place, so "the id being pushed" and "the id that is live" were the same
 * statement and one constant served both. This wave REPLACES the stylesheet,
 * and the inherited check -- live css against EXPECT_CSS_ID -- would have
 * compared af0c14ea64 with 25ca2005dc and died on a healthy org, AFTER the
 * device code was spent. EXPECT_PREV_CSS exists for that reason. It was caught
 * by reading every use of the constant before running, not by running it.
 *
 * ORDER, and it matters: everything offline happens BEFORE the device code is
 * requested, so a mistake in this script cannot burn a code. This one checks
 * itself first.
 *
 * PRE-FLIGHT 3b is DIFFERENTIAL AND PER-TICKET: three tickets, each with its
 * own symbol group counted in the COMMITTED BLOB, plus the stylesheet half. An
 * id gate proves the bytes were reviewed; it cannot prove a particular fix is
 * in them. Each group names its ticket, so a failure says WHICH ticket is
 * missing rather than that something is.
 *
 * THE ROLLBACK IS DURABLE BEFORE ANY PATCH: archived, proven by content three
 * ways to be 9eb3bab955, then committed AND pushed AND verified on the remote,
 * and only then is anything written to Dataverse.
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
const BACKUP_SLUG = '2026-09-16-section-c-round2';

/* What Emely approved, by name, in advance. */
const EXPECT_APP_ID = 'b1108e5fcf';
const EXPECT_CSS_ID = '25ca2005dc';
/* What the ORG serves. Read from the org, never derived from main: the
 * package deploy proved that lesson when a merged-but-undeployed group A made
 * main's tip describe a build that had never shipped. */
const EXPECT_PREV_BUILD = '9eb3bab955';
/* the live stylesheet, which this deploy REPLACES rather than leaves */
const EXPECT_PREV_CSS = 'af0c14ea64';

/* The three commits this wave ships. Every one must be an ancestor of HEAD,
 * checked by name: a stacked merge that silently did not land is the failure
 * this deploy already met once today. */
const PACKAGE_COMMITS = [
  { sha: '63dea00', what: 'CLCPA-252 round 2: the title derivation' },
  { sha: 'c6d0453', what: 'CLCPA-264: the import identity advisory' },
  { sha: '4d9012c', what: 'CLCPA-263: the render-derived composites' },
];

const RES = [
  { file: 'app.js', name: PREFIX + 'app.js', id: '79151fe9-3c64-f111-ab0c-7c1e521c7110' },
  { file: 'styles.css', name: PREFIX + 'styles.css', id: '7b151fe9-3c64-f111-ab0c-7c1e521c7110' },
  { file: 'ExecutiveDashboard.html', name: PREFIX + 'ExecutiveDashboard.html', id: '77151fe9-3c64-f111-ab0c-7c1e521c7110' },
];

/* PRE-FLIGHT 3b: THREE TICKETS, THREE FINGERPRINTS, counted in the committed
 * blob -- plus a STYLESHEET half, because styles.css moves in this wave and an
 * app.js-only fingerprint would say nothing about the rule shipping beside it.
 *
 * Each string is a line the ticket ADDED, chosen so it cannot be satisfied by
 * the code that was there before. Where a ticket REPLACED a line, the old form
 * is pinned at 0 as well -- the half that catches a fix applied alongside the
 * thing it was meant to replace. */
const TICKET_SYMBOLS = {
  'CLCPA-252 r2: a fresh year DERIVES its title': {
    'function deriveTableCaptionInfo(t, year) {': 1,
    'function deriveTableCaption(t, year) {': 1,
    'const derived = deriveTableCaption(t, year);': 1,
    /* strategy A: the own-year token, exactly once and the only year */
    "if (years.length === 1 && years[0] === donorYear &&": 1,
    'donor.split(donorYear).length - 1 === 1) {': 1,
    /* strategy B: NO year at all, after a clean Table/Chart prefix */
    'if (years.length === 0) {': 1,
    '(?:Table|Chart)': 1,
    /* the PDF tail never travels */
    "const donor = String(by[donorYear]).replace(/\\s*\\|.*$/, '').trim();": 1,
    /* the donor is the NEWEST year, not the first key */
    'const donorYear = Object.keys(by)': 1,
  },
  'CLCPA-264: the import identity advisory': {
    'function declaredTableFromFilename(name) {': 1,
    'function importIdentityNotice(fileName, destTableId) {': 1,
    /* anchored at the START of the basename: "notes-about-C3.csv" declares
     * nothing, which is what stops it crying wolf */
    'const m = /^([A-Za-z])(\\d{1,2})(?=[-_. ]|$)/.exec(base);': 1,
    /* it must be a table this payload really has */
    'return Object.prototype.hasOwnProperty.call(tables, id) ? id : null;': 1,
    /* silent on its own destination */
    'if (!declared || !destTableId || declared === destTableId) return null;': 1,
    /* raised at STAGING, from the handle that is actually in scope */
    'const idNote = importIdentityNotice(staged.name, target().tableId);': 1,
    /* and NOT getTarget, which is a parameter of wireIngestStaging */
    'importIdentityNotice(staged.name, getTarget()': 0,
    /* and in the result panel */
    'plan.identityNotice = importIdentityNotice(staged.name, i.tableId);': 1,
    "'</div>' + notices + identity;": 1,
  },
  'CLCPA-263: the value (pct) composites, derived at render': {
    'const COMPOSITE_SHARE_COLS = {': 1,
    'function isCompositeShareCol(tableId, header) {': 1,
    'function applyCompositeShares(rows, tableId, schema, colSum) {': 1,
    'function compositeValueText(v) {': 1,
    'function bareNumber(v) {': 1,
    'applyCompositeShares(clone, tableId, schema, colSum);': 1,
    /* the total row is found by LABEL, never by the arithmetic flags */
    'const isTotal = rows.map(r => isStrictTotalRowLabel((r || [])[0]));': 1,
    'applyCompositeShares(clone, tableId, schema, totalFlags': 0,
    /* a zero denominator derives nothing */
    'if (!denom) continue;': 1,
  },
};

/* THE STYLESHEET HALF. styles.css moves for the first time since CLCPA-249,
 * and it moves by exactly one rule. Counted in the committed blob the same way
 * the app symbols are, and the amber is pinned against the red deliberately:
 * this is an advisory, and red would say "stopped" about something that did
 * not stop. */
const CSS_SYMBOLS = {
  '.ingest-staged-warn {': 1,
  '/* CLCPA-264: the import identity advisory.': 1,
  'color: var(--warn-fg, #8a5a00);': 2,
  '.ingest-staged-warn {\r\n  margin: 8px 0 0;\r\n  color: var(--red)': 0,
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
/* THE LOG MUST NOT CREATE THE SNAPSHOT DIRECTORY: an offline abort calling
 * die() -> flushLog() -> mkdir would create the very directory PRE-FLIGHT 3d
 * then refuses to overwrite, and the script would deadlock itself. */
let ARCHIVED = false;
function flushLog(tail) {
  if (tail) lines.push('', tail);
  try {
    if (ARCHIVED || fs.existsSync(BACKDIR + '/manifest.json')) {
      fs.writeFileSync(BACKDIR + '/deploy.log', lines.join('\n') + '\n');
    } else {
      /* NOT in __dirname: that is the SOURCE folder, and PRE-FLIGHT 1 refuses
       * to deploy with anything uncommitted in it. An abort log written there
       * makes the next run fail on the wreckage of the last one -- which is
       * exactly what the first dry run of this script did. One level up is
       * outside the deployed tree. */
      fs.writeFileSync(path.join(__dirname, '..', 'deploy_section_c_abort.log'),
        lines.join('\n') + '\n');
    }
  } catch (e) { /* the console output is still the record */ }
}

/* The canonical form: APP_BUILD forced back to 'dev'. The id is the hash of
 * THIS, so stamping is idempotent and re-running cannot drift the id. */
const BUILD_SENTINEL = "var APP_BUILD = 'dev';   /* BUILD_ID */";
function canonicaliseApp(text) {
  return text.replace(/var APP_BUILD = '[^']*';   \/\* BUILD_ID \*\//,
                      BUILD_SENTINEL);
}
function stampOf(text) {
  const m = text.match(/var APP_BUILD = '([^']*)';   \/\* BUILD_ID \*\//);
  return m ? m[1] : null;
}
function symbolCount() {
  return Object.keys(TICKET_SYMBOLS)
    .reduce((n, t) => n + Object.keys(TICKET_SYMBOLS[t]).length, 0);
}

/* =======================================================================
 * PRE-FLIGHT, entirely offline
 * ======================================================================= */
log('=== ExecutiveDashboard_dev -> cr2bf_dactest deploy ===');
log('org: ' + ORG);
log('slice: THE SECTION C ROUND-2 WAVE -- three tickets');
log('       CLCPA-252 round 2, CLCPA-263, CLCPA-264');
log('files: ' + RES.map(r => r.file).join(', '));
log('');

/* --- 0. this script checks itself ------------------------------------- */
{
  const required = { fs, path, crypto, execSync, log, die, sha256, flushLog,
    canonicaliseApp, stampOf, symbolCount };
  const missing = Object.keys(required).filter(k => required[k] === undefined ||
    (typeof required[k] !== 'function' && typeof required[k] !== 'object'));
  if (missing.length) die('this deploy script is broken: ' + missing.join(', ') + ' unusable.');
  const consts = { REPO, SRC, API, CLIENT_ID, TENANT, PREFIX, BACKUP_SLUG, BACKDIR,
    EXPECT_APP_ID, EXPECT_CSS_ID, EXPECT_PREV_BUILD, EXPECT_PREV_CSS, BUILD_SENTINEL };
  const empty = Object.keys(consts).filter(k => !consts[k]);
  if (empty.length) die('unset constant(s): ' + empty.join(', '));
  if (!Array.isArray(RES) || RES.length !== 3) die('the resource list is not the expected three.');
  RES.forEach(r => { if (!r.file || !r.name || !r.id) die('incomplete resource entry: ' + JSON.stringify(r)); });
  if (Object.keys(TICKET_SYMBOLS).length !== 3) {
    die('PRE-FLIGHT 3b should carry THREE tickets, carries ' +
        Object.keys(TICKET_SYMBOLS).length + '.');
  }
  if (!Object.keys(CSS_SYMBOLS).length) die('3b has no STYLESHEET symbols to count.');
  Object.keys(TICKET_SYMBOLS).forEach(t => {
    if (!Object.keys(TICKET_SYMBOLS[t]).length) die('ticket group "' + t + '" has no symbols.');
  });
  if (PACKAGE_COMMITS.length !== 3) die('the wave should be three commits.');
  /* self-test the helpers, so a broken regex is caught here and not after the
   * archive has been called proven */
  const probe = "x\nvar APP_BUILD = 'abc1234567';   /* BUILD_ID */\ny";
  if (stampOf(probe) !== 'abc1234567') die('stampOf() does not read a stamp.');
  if (canonicaliseApp(probe).indexOf(BUILD_SENTINEL) < 0) die('canonicaliseApp() does not restore the sentinel.');
  if (stampOf('no stamp here') !== null) die('stampOf() invents a stamp where there is none.');
  if (symbolCount() < 15) die('symbolCount() reports ' + symbolCount() + ', which is too few to be right.');
  log('PRE-FLIGHT 0  this script self-checks: helpers present and self-tested,');
  log('              constants set, 3 resources, 3 ticket groups,');
  log('              ' + symbolCount() + ' app symbols + ' +
      Object.keys(CSS_SYMBOLS).length + ' stylesheet symbols, 3 commits.');
}

/* --- 1. git state ------------------------------------------------------ */
const HEAD = execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim();
const BRANCH = execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO }).toString().trim();
const DIRTY = execSync('git status --porcelain -- Coned/CLCPA/ExecutiveDashboard_dev',
  { cwd: REPO }).toString().trim();
log('PRE-FLIGHT 1  branch = ' + BRANCH + ', HEAD = ' + HEAD);
if (BRANCH !== 'main') die('not on main (on "' + BRANCH + '"). Deploys go from main.');
/* this script lives in the source folder while it runs, so it is allowed to be
 * the one untracked thing there -- and nothing else is */
const dirtyLines = DIRTY ? DIRTY.split('\n').filter(l =>
  l.indexOf(path.basename(__filename)) < 0) : [];
if (dirtyLines.length) die('the source folder has uncommitted changes:\n' + dirtyLines.join('\n') +
  '\n  Deploying an unrecorded file makes the build id a lie.');
log('              source folder clean, so the pushed bytes are exactly ' + HEAD + '.');
/* EVERY package commit must really be in this history. The stacked merges
 * silently refused once today -- all four PRs read state=open, merged=false,
 * with main unmoved -- so this is checked commit by commit and by name. */
PACKAGE_COMMITS.forEach(c => {
  try {
    execSync('git merge-base --is-ancestor ' + c.sha + ' HEAD', { cwd: REPO });
    log('              ancestor: ' + c.sha + '  ' + c.what);
  } catch (e) { die('HEAD does not contain ' + c.sha + ' (' + c.what + ').'); }
});
/* and main must be where the remote says it is */
{
  const remote = execSync('git ls-remote origin refs/heads/main', { cwd: REPO })
    .toString().trim().split(/\s+/)[0];
  const localFull = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim();
  if (remote !== localFull) {
    die('local main ' + localFull.slice(0, 7) + ' is not remote main ' + remote.slice(0, 7) +
        '.\n  Deploying a commit the remote does not have makes the record unverifiable.');
  }
  log('              local main == remote main == ' + remote.slice(0, 7) + '.');
}

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
  die('app.js contains a raw NUL byte.');
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

/* --- 3b. THREE TICKETS + THE STYLESHEET, in the COMMITTED BLOBS ------- */
{
  const blob = execSync('git show HEAD:Coned/CLCPA/ExecutiveDashboard_dev/app.js',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8');
  /* the blob must be the bytes about to be pushed, or 3b is checking a
   * different file from the one that ships */
  if (sha256(Buffer.from(blob.replace(/\r?\n/g, '\r\n'), 'utf8')).slice(0, 10) !== APP_ID) {
    die('the committed blob does not hash to ' + APP_ID + '. 3b would be ' +
        'checking a different file from the one about to be pushed.');
  }
  const bad = [];
  let counted = 0;
  Object.keys(TICKET_SYMBOLS).forEach(ticket => {
    const grp = TICKET_SYMBOLS[ticket];
    const miss = [];
    Object.keys(grp).forEach(k => {
      counted++;
      const n = blob.split(k).length - 1;
      if (n !== grp[k]) miss.push('      ' + n + ' of ' + grp[k] + '   ' + k);
    });
    if (miss.length) bad.push('  ' + ticket + '\n' + miss.join('\n'));
    else log('              ok  ' + ticket);
  });
  if (bad.length) {
    die('PRE-FLIGHT 3b: the committed blob does not carry these tickets:\n' + bad.join('\n') +
        '\n  An id gate proves the bytes were reviewed. It cannot prove which of\n' +
        '  three fixes is in them, which is why this is per ticket.');
  }
  if (blob.indexOf(String.fromCharCode(0)) >= 0) die('the committed blob contains a raw NUL byte.');
  log('PRE-FLIGHT 3b all 3 ticket groups verified in the COMMITTED BLOB (' +
      counted + ' symbols), 0 NUL bytes.');

  /* THE STYLESHEET HALF, against the committed blob and hashed to the id
   * about to be pushed -- the same two checks the app half gets. */
  const css = execSync('git show HEAD:Coned/CLCPA/ExecutiveDashboard_dev/styles.css',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8');
  if (sha256(Buffer.from(css.replace(/\r?\n/g, '\r\n'), 'utf8')).slice(0, 10) !== CSS_ID) {
    die('the committed styles.css does not hash to ' + CSS_ID + '.');
  }
  const cssBad = [];
  Object.keys(CSS_SYMBOLS).forEach(k => {
    const n = css.split(k.replace(/\\r\\n/g, '\r\n')).length - 1;
    if (n !== CSS_SYMBOLS[k]) cssBad.push('      ' + n + ' of ' + CSS_SYMBOLS[k] + '   ' + k);
  });
  if (cssBad.length) {
    die('PRE-FLIGHT 3b: the committed styles.css does not carry CLCPA-264s rule:\n' +
        cssBad.join('\n'));
  }
  log('              and the STYLESHEET half: ' + Object.keys(CSS_SYMBOLS).length +
      ' symbols verified in the committed styles.css.');
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
      if (/^(suite|derive|diag|gate)_.*\.js$/.test(f)) runs.push({ dir: full, file: f });
    });
  });
  if (runs.length < 30) die('only found ' + runs.length + ' suites; expected at least 30.');
  const red = [];
  let asserts = 0;
  runs.forEach(r => {
    let out = '';
    try { out = execSync('node "' + r.file + '"', { cwd: r.dir, maxBuffer: 1 << 28 }).toString(); }
    catch (e) { red.push(r.file + ' (exit ' + (e.status === undefined ? '?' : e.status) + ')'); return; }
    const m = out.match(/(\d+) passed, (\d+) failed/);
    if (!m) { red.push(r.file + ' (no result line)'); return; }
    asserts += parseInt(m[1], 10);
    if (parseInt(m[2], 10) !== 0) red.push(r.file + ' (' + m[0] + ')');
  });
  if (red.length) die('suites not green:\n  ' + red.join('\n  '));
  log('PRE-FLIGHT 3c all ' + runs.length + ' suites green, ' + asserts + ' assertions.');
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
/* RETRY ON TRANSPORT, NEVER ON A STATUS. A 4xx or 5xx is an ANSWER and
 * repeating the request only repeats it. A "fetch failed" is no answer at all
 * and gets four attempts with a backoff. */
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
    /* one level up, outside the deployed tree, for the same reason as the
     * abort log: nothing this script writes may land in the source folder. */
    fs.writeFileSync(path.join(__dirname, '..', 'device_code.txt'),
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
    slice: 'section-c-package', sourceCommit: HEAD, resources: [] };
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
   * is not a rollback. The expected value is what the ORG serves, not what
   * main derives -- group A merged and was never deployed, so those two
   * answers genuinely differ this time. */
  const liveAppText = live['app.js'].toString('utf8');
  const liveStamp = stampOf(liveAppText);
  const liveDerived = sha256(Buffer.from(canonicaliseApp(liveAppText), 'utf8')).slice(0, 10);
  const liveCssId = sha256(live['styles.css']).slice(0, 10);
  log('');
  log('PROVENANCE of the archive:');
  log('  app.js APP_BUILD stamp        : ' + liveStamp);
  log('  app.js canonicalised + hashed : ' + liveDerived);
  log('  expected previous build       : ' + EXPECT_PREV_BUILD + '  (CLCPA-248 round 3)');
  log('  styles.css LIVE (to replace)  : ' + liveCssId + '   expected ' + EXPECT_PREV_CSS);
  if (liveStamp !== EXPECT_PREV_BUILD || liveDerived !== EXPECT_PREV_BUILD) {
    die('the live app.js is not ' + EXPECT_PREV_BUILD + ' (stamp ' + liveStamp +
        ', derived ' + liveDerived + ').\n' +
        '  Something was deployed that this deploy does not know about. Stopping\n' +
        '  BEFORE any write: an unidentified snapshot is not a rollback.');
  }
  /* EXPECT_PREV_CSS, NOT EXPECT_CSS_ID. The package deploy left styles.css in
   * place, so comparing the live stylesheet against the id being PUSHED was
   * the same statement there. This wave REPLACES it, and the two constants
   * came apart: the live sheet is af0c14ea64 and the new one is 25ca2005dc,
   * so the inherited check would have halted on a perfectly healthy org --
   * after the device code had been spent. Caught by reading the constant's
   * every use before running, not by running it. */
  if (liveCssId !== EXPECT_PREV_CSS) {
    die('the live styles.css is ' + liveCssId + ', not the ' + EXPECT_PREV_CSS +
        ' this deploy expects to REPLACE.\n' +
        '  Something was deployed that this deploy does not know about. Stopping\n' +
        '  BEFORE any write: an unidentified snapshot is not a rollback.');
  }
  manifest.provenance = { stampedAs: liveStamp, derivedBuildId: liveDerived,
    expectedPrevBuildId: EXPECT_PREV_BUILD, styleId: liveCssId,
    expectedPrevStyleId: EXPECT_PREV_CSS, newStyleId: CSS_ID, matches: true,
    newBuildId: APP_ID,
    note: 'The previous build is CLCPA-248 round 3. Group A (9699f62) merged to ' +
          'main on 2026-09-15 and was NEVER deployed, so mains tip does not ' +
          'describe the live build and this constant was read from the org.' };
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
    const msg = 'deploy-backups: pre-deploy snapshot for the Section C package deploy\n\n' +
      'The live cr2bf_dactest bytes as they stood before build ' + APP_ID + ' went up.\n' +
      'Identified by content three ways, all agreeing on ' + EXPECT_PREV_BUILD + ':\n' +
      '  - app.js APP_BUILD stamp        ' + liveStamp + '\n' +
      '  - app.js canonicalised + hashed ' + liveDerived + '\n' +
      '  - styles.css id, unchanged      ' + liveCssId + '\n\n' +
      'The previous build is CLCPA-248 round 3, NOT mains tip before this deploy.\n' +
      'Group A (9699f62) merged to main on 2026-09-15 and was never deployed, so\n' +
      'main derived 671929eb23 while the org served ' + EXPECT_PREV_BUILD + '. The\n' +
      'expected value was read from the org, not from git.\n\n' +
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
          '  Nothing has been written to Dataverse.');
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
  /* and all TEN tickets are in the bytes now on the server, per ticket */
  {
    const srvApp = server['app.js'].toString('utf8');
    const missing = [];
    Object.keys(TICKET_SYMBOLS).forEach(ticket => {
      const grp = TICKET_SYMBOLS[ticket];
      const bad = Object.keys(grp).filter(k => (srvApp.split(k).length - 1) !== grp[k]);
      if (bad.length) missing.push(ticket + ': ' + bad.join(' | '));
    });
    if (missing.length) die('the SERVER copy is missing these tickets:\n  ' + missing.join('\n  '));
    log('  all 10 ticket groups (' + symbolCount() + ' symbols) present in the SERVER copy.');
  }

  log('');
  log('=== DEPLOY COMPLETE ===');
  log('build id (app.js): ' + APP_ID);
  log('styles.css id    : ' + CSS_ID + '  (REPLACED: it was ' + EXPECT_PREV_CSS + ')');
  log('previous build   : ' + EXPECT_PREV_BUILD + ', archived and pushed before any write');
  log('source           : ExecutiveDashboard_dev/ at main @ ' + HEAD);
  log('requests: GET ' + GETS + ', PATCH ' + PATCHES + ', POST ' + POSTS);
  log('');
  log('CLIENT CHECK, and it is not optional: server-verified is not client-running.');
  log('Hard-refresh the app and confirm the console prints');
  log('   [DAC dashboard] build ' + APP_ID);
  log('If it prints anything else, the browser is holding an older app.js.');
  log('');
  log('THE ROUND-2 PASS -- three screens:');
  log('  CLCPA-252 r2  A FRESH YEAR NAMES ITS TABLES LIKE A STORED ONE.');
  log('     Create 2098. Table C1 must read "Table C1. 2098 Summary of Con');
  log('     Edison Demand Response Programs", not "Table C1. DR Programs".');
  log('     51 of 52 derive; D2 alone still shows its short title, because');
  log('     its stored title has no space after the period. And NO derived');
  log('     caption may cite a PDF page: that tail belongs to one report.');
  log('     A8 on 2023 -- the one stored year with no title -- now reads');
  log('     like its 2025 sibling rather than "Table A8. Residential Install".');
  log('  CLCPA-264  A TWINS FILE WARNS, AND STILL IMPORTS.');
  log('     Download the C3 template, rename nothing, import it into C4.');
  log('     A soft amber notice appears in the staged box BEFORE the import');
  log('     and again in the result panel after it, naming both tables -- and');
  log('     the import still lands. Nothing is rejected, ever.');
  log('     Import C4s own file into C4: SILENT. Rename a file to anything');
  log('     that is not a table id: SILENT. No false alarms.');
  log('  CLCPA-263  A FRESH YEAR SHOWS ITS SHARES.');
  log('     Type C2s figures into a fresh year: Participants, Committed Load');
  log('     Relief and Average Event Reductions each render "value (pct%)",');
  log('     matching how 2025 reads. The TOTAL row stays a bare number.');
  log('     2023, 2024 and 2025 must look EXACTLY as they do today.');
  log('');
  log('STILL DISCLOSED, not defects in this build:');
  log('  - C2/2024 stores 766.94, which matches neither a sum (306.40) nor a');
  log('    weighted mean (239.12). Legacy stored value, disclosed not touched.');
  log('  - C2 s stored rows are split-format ("299.57 (41%)") and recompute to');
  log('    nothing on ANY build. Pre-existing, filed as its own finding.');
  log('  - A5:2025 stores a grand total of 27,833 where its own parts give');
  log('    27,834, and A3:2025 is off by 31. Under the payload freeze.');
  log('  - CLCPA-258, the stray "4" in C5 s stored 2025 title, is NOT in this');
  log('    build. It rides separately on its own GO.');
  log('  - The 2098 test residue in Dataverse belongs to CLCPA-224.');
  flushLog('=== log written by deploy_section_c_package.js ===');
})().catch(e => {
  console.error('\nDEPLOY ERROR: ' + (e && e.stack ? e.stack : e));
  flushLog('DEPLOY ERROR: ' + (e && e.message ? e.message : e));
  process.exit(2);
});
