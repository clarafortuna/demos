/* ExecutiveDashboard_dev -> cr2bf_dactest deploy: THE SECTION C PACKAGE.
 *
 * Eleven tickets in one ship, groups A through E, plus CLCPA-124 which is the
 * audit that found them all. FIVE commits are being deployed at once, because
 * group A merged to main on 2026-09-15 and was never deployed: the live build
 * is 9a59621784, which is CLCPA-248 round 3, and main's tip at group A's head
 * derives 671929eb23 -- a build that has never left this repository.
 *
 * THAT IS WHY THE PREVIOUS-BUILD CONSTANT IS NOT DERIVED FROM GIT. Emely
 * corrected the framing before this script was written: the rollback archives
 * what the ORG serves, and the org's identity is only knowable by reading it.
 * Deriving "the live build" from main's tip would have expected 671929eb23 and
 * halted on a perfectly healthy org -- or worse, accepted a snapshot of the
 * wrong thing. The constant below says 9a59621784 because that is what the
 * org is expected to hand back, and the script halts if it hands back anything
 * else.
 *
 * ORDER, and it matters: everything offline happens BEFORE the device code is
 * requested, so a mistake in this script cannot burn a code. This one checks
 * itself first.
 *
 * PRE-FLIGHT 3b is DIFFERENTIAL AND PER-TICKET. Ten code tickets, each with
 * its own symbol group counted in the COMMITTED BLOB. An id gate proves the
 * bytes were reviewed; it cannot prove a particular fix is in them, and with
 * five commits riding together "the diff looked right" is not a statement
 * anyone can check afterwards. Each group names its ticket, so a failure says
 * WHICH ticket is missing rather than that something is.
 *
 * THE ROLLBACK IS DURABLE BEFORE ANY PATCH: archived, proven by content three
 * ways to be 9a59621784, then committed AND pushed AND verified on the remote,
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
const BACKUP_SLUG = '2026-09-16-section-c-package';

/* What Emely approved, by name, in advance. */
const EXPECT_APP_ID = '9eb3bab955';
const EXPECT_CSS_ID = 'af0c14ea64';
/* What the ORG serves, per Emely's correction. NOT derived from main. */
const EXPECT_PREV_BUILD = '9a59621784';

/* The five commits this package ships. Every one must be an ancestor of HEAD,
 * checked by name: a stacked merge that silently did not land is the failure
 * this deploy already met once today. */
const PACKAGE_COMMITS = [
  { sha: '9699f62', what: 'group A: CLCPA-253, CLCPA-256, CLCPA-262' },
  { sha: '3e47e89', what: 'group B: CLCPA-252, CLCPA-259' },
  { sha: '0076083', what: 'group C: CLCPA-257' },
  { sha: '8eaa2ac', what: 'group D: CLCPA-260' },
  { sha: 'f9b6e73', what: 'group E: CLCPA-254, CLCPA-255, CLCPA-261' },
];

const RES = [
  { file: 'app.js', name: PREFIX + 'app.js', id: '79151fe9-3c64-f111-ab0c-7c1e521c7110' },
  { file: 'styles.css', name: PREFIX + 'styles.css', id: '7b151fe9-3c64-f111-ab0c-7c1e521c7110' },
  { file: 'ExecutiveDashboard.html', name: PREFIX + 'ExecutiveDashboard.html', id: '77151fe9-3c64-f111-ab0c-7c1e521c7110' },
];

/* PRE-FLIGHT 3b: TEN TICKETS, TEN FINGERPRINTS, counted in the committed blob.
 *
 * Each string is a line the ticket ADDED, chosen so it cannot be satisfied by
 * the code that was there before. Where a ticket REPLACED a line, the old form
 * is pinned at 0 as well -- that is the half that catches a fix applied
 * alongside the thing it was meant to replace, which has happened here. */
const TICKET_SYMBOLS = {
  /* ---- GROUP A ------------------------------------------------------- */
  'CLCPA-253 (C-04): the (calculated) marker is column-aware': {
    'const blankHeader = (schema || []).map(h =>': 1,
    'const engineWrites = (c) => !blankHeader[c];': 1,
    'any: (r, c) => (!!totals[r] && (!!derived[c] || engineWrites(c))) ||': 1,
  },
  'CLCPA-256 (C-07): the save dialog counts REAL changes': {
    'const nx = (x == null || x === \'\') ? \'\' : x;': 1,
    'const ny = (y == null || y === \'\') ? \'\' : y;': 1,
    'if (!same(ar[c], br[c])) count++;': 1,
  },
  'CLCPA-262 (C-12): a rejected import keeps the dialog open': {
    'let failed = false;': 1,
    'if (plan.ok) applyIngestImport(plan); else failed = true;': 1,
    'if (failed) {': 1,
  },
  /* ---- GROUP B ------------------------------------------------------- */
  'CLCPA-252 (C-03): the caption comes from the table definition': {
    'function tableCaption(t, year) {': 1,
    "return short ? ('Table ' + t.id + '. ' + short) : ('Table ' + t.id);": 1,
    'const titleCurrent = tableCaption(t, year);   /* CLCPA-252 */': 1,
    'const tableTitle = tableCaption(table, i.year);   /* CLCPA-252 */': 1,
    /* the inline expression both call sites used, which must be GONE */
    "(table.title_by_year || {})[i.year] || ('Table ' + i.tableId)": 0,
  },
  'CLCPA-259 (C-11): the programme categories are read from C1': {
    'const PROG_CATEGORIES = (() => {': 1,
    'const catIdx = schema.findIndex(h => /^\\s*category\\s*$/i.test(String(h == null ? \'\' : h)));': 1,
    'const paren = /\\(([^)]+)\\)\\s*$/.exec(label);': 1,
  },
  /* ---- GROUP C ------------------------------------------------------- */
  'CLCPA-257 (C-08): dacCol falls back to the NEWEST year': {
    'const years = Object.keys(by)': 1,
    '.filter(k => Array.isArray(by[k]) && by[k].length)': 1,
    's = years.length ? by[years[0]] : null;': 1,
    /* the first-key fallback this replaced, which must be GONE. The newest-year
     * SORT itself is deliberately not pinned here: that exact line appears
     * three times in app.js -- getTableSchema (CLCPA-244) and two others -- so
     * counting it proves nothing about this ticket. The dry run caught it
     * reading 3 of 1, which is the fingerprint working. */
    'const anyYear = Object.keys(by)[0];': 0,
  },
  /* ---- GROUP D ------------------------------------------------------- */
  'CLCPA-260 (C-02): the phantom spacer columns': {
    'function phantomSpacerCols(t, year) {': 1,
    'if (hl === 2) return out;                     /* condition 3 */': 1,
    "if (h != null && String(h).trim() !== '') continue;      /* condition 1 */": 1,
    'const hidden = phantomSpacerCols(table, year);': 1,
    'const hiddenCols = phantomSpacerCols(': 1,
    'if (hiddenCols.indexOf(colIdx) >= 0) return \'\';': 1,
  },
  /* ---- GROUP E ------------------------------------------------------- */
  'CLCPA-254 (C-05): the declared-summable column': {
    'const SUMMABLE_COLS = {': 1,
    "C2: ['average event reductions (mw)'],": 1,
    'function isDeclaredSummable(tableId, header) {': 1,
    'if ((pctCol[c] || avgCol[c]) &&': 1,
    '!isDeclaredSummable(tableId, schema[c])) continue;': 1,
    /* THE RULING: the predicate is NOT loosened. The old unconditional refusal
     * must be gone, and detectAvgColumns's own test must still be there. */
    'if (pctCol[c] || avgCol[c]) continue;         // CLCPA-212: does not sum': 0,
    '/\\baverage\\b/.test(s)': 1,
  },
  'CLCPA-255 (C-06): a recognised total row loses its delete control': {
    "<td class=\"ingest-td-actions\">${(isHeaderRow || lockTotalRow || isTotal) ? ''": 1,
    /* the narrower form it replaced */
    "<td class=\"ingest-td-actions\">${(isHeaderRow || lockTotalRow) ? ''": 0,
    /* the CLCPA-205 exemption is UPHELD: the label is still an input, and the
     * rationale is a JS comment, not an HTML one that ships per row */
    'class="ingest-cell ingest-cell-label"': 1,
    '<!-- CLCPA-255': 0,
  },
  'CLCPA-261 (C-09): the fraction NOTICE, not a rejection': {
    'unitNotices: [],': 1,
    'const pctCols = detectPctColumns(schema);': 1,
    'res.unitNotices.push(Object.assign({': 1,
    "'<h4>Read as a fraction: ' + r.unitNotices.length + ' cell' +": 1,
    "'</div>' + notices;": 1,
    /* it NOTICES, it does not reject: no rejection is raised on this path */
    "reject('A percentage cannot be imported into this column.'": 0,
  },
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
log('slice: THE SECTION C PACKAGE -- groups A through E, eleven tickets');
log('       CLCPA-124 (the audit), 252, 253, 254, 255, 256, 257, 259, 260, 261, 262');
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
    EXPECT_APP_ID, EXPECT_CSS_ID, EXPECT_PREV_BUILD, BUILD_SENTINEL };
  const empty = Object.keys(consts).filter(k => !consts[k]);
  if (empty.length) die('unset constant(s): ' + empty.join(', '));
  if (!Array.isArray(RES) || RES.length !== 3) die('the resource list is not the expected three.');
  RES.forEach(r => { if (!r.file || !r.name || !r.id) die('incomplete resource entry: ' + JSON.stringify(r)); });
  if (Object.keys(TICKET_SYMBOLS).length !== 10) {
    die('PRE-FLIGHT 3b should carry TEN code tickets, carries ' +
        Object.keys(TICKET_SYMBOLS).length + '.');
  }
  Object.keys(TICKET_SYMBOLS).forEach(t => {
    if (!Object.keys(TICKET_SYMBOLS[t]).length) die('ticket group "' + t + '" has no symbols.');
  });
  if (PACKAGE_COMMITS.length !== 5) die('the package should be five commits.');
  /* self-test the helpers, so a broken regex is caught here and not after the
   * archive has been called proven */
  const probe = "x\nvar APP_BUILD = 'abc1234567';   /* BUILD_ID */\ny";
  if (stampOf(probe) !== 'abc1234567') die('stampOf() does not read a stamp.');
  if (canonicaliseApp(probe).indexOf(BUILD_SENTINEL) < 0) die('canonicaliseApp() does not restore the sentinel.');
  if (stampOf('no stamp here') !== null) die('stampOf() invents a stamp where there is none.');
  if (symbolCount() < 30) die('symbolCount() reports ' + symbolCount() + ', which is too few to be right.');
  log('PRE-FLIGHT 0  this script self-checks: helpers present and self-tested,');
  log('              constants set, 3 resources, 10 ticket groups,');
  log('              ' + symbolCount() + ' symbols to count, 5 package commits.');
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

/* --- 3b. TEN TICKETS, counted in the COMMITTED BLOB -------------------- */
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
        '  eleven fixes is in them, which is why this is per ticket.');
  }
  if (blob.indexOf(String.fromCharCode(0)) >= 0) die('the committed blob contains a raw NUL byte.');
  log('PRE-FLIGHT 3b all 10 ticket groups verified in the COMMITTED BLOB (' +
      counted + ' symbols), 0 NUL bytes.');
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
  log('styles.css id    : ' + CSS_ID + ' (unchanged since the CLCPA-249 round-2 deploy)');
  log('previous build   : ' + EXPECT_PREV_BUILD + ', archived and pushed before any write');
  log('source           : ExecutiveDashboard_dev/ at main @ ' + HEAD);
  log('requests: GET ' + GETS + ', PATCH ' + PATCHES + ', POST ' + POSTS);
  log('');
  log('CLIENT CHECK, and it is not optional: server-verified is not client-running.');
  log('Hard-refresh the app and confirm the console prints');
  log('   [DAC dashboard] build ' + APP_ID);
  log('If it prints anything else, the browser is holding an older app.js.');
  log('');
  log('THE PACKAGE PASS -- ten screens, one per code ticket:');
  log('  C-03  CLCPA-252  A CAPTION ON EVERY TABLE. Table A8 on 2023 used to');
  log('        read bare "Table A8"; it must now read "Table A8. Residential');
  log('        Install". Create a fresh year: every one of the 52 tables names');
  log('        itself rather than rendering bare.');
  log('  C-11  CLCPA-259  Program Performance on a FRESH year shows that');
  log('        year s own C1 categories, not Peak Shaving / Contingency /');
  log('        Multi-purpose / Mass-market. On 2023-2025 Auto-DLM and BYOT now');
  log('        read "Peak Shaving and Contingency" -- that is the fix, not');
  log('        collateral: the panel was wrong on every year it ever rendered.');
  log('  C-08  CLCPA-257  Section C reads the NEWEST year s schema. C2');
  log('        Participants must show participant counts, not the spacer');
  log('        column it picked up from 2023 s four-column schema.');
  log('  C-02  CLCPA-260  C1-C5 in the Report Data editor render WITHOUT their');
  log('        unnamed spacer columns, and a downloaded template does not');
  log('        emit them either. C1 is six columns wide, not nine.');
  log('  C-05  CLCPA-254  IMPORT OR TYPE a C2 year with plain numbers: the');
  log('        "Average Event Reductions (MW)" total computes as the SUM.');
  log('        A3 and A4 s per-participant averages must STILL refuse to sum --');
  log('        that is CLCPA-212 and it is not loosened.');
  log('  C-06  CLCPA-255  A recognised total row has NO delete x, and its');
  log('        label is STILL editable. Body rows around it keep their x.');
  log('  C-09  CLCPA-261  Import "10%" into a MW column: the summary says');
  log('        "Read as a fraction: 1 cell" and the value is in the draft.');
  log('        It is a notice, not a rejection.');
  log('  C-04  CLCPA-253  The (calculated) marker no longer appears on spacer');
  log('        columns.');
  log('  C-07  CLCPA-256  The Save dialog s change count ignores empty-to-empty.');
  log('  C-12  CLCPA-262  A REJECTED import leaves the Add Year dialog OPEN,');
  log('        with the reason shown.');
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
