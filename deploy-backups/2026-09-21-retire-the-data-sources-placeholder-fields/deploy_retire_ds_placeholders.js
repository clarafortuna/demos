/* ExecutiveDashboard_dev -> cr2bf_dactest deploy.
 *
 * PARAMETERISED, as its own task before this script was cut.
 *
 * Four record corrections across two deploys all had one cause: this script is
 * copied from the last surviving one, and copying carries its PROSE as well as
 * its gates. A header sentence naming the previous deploy's build, a slice line
 * naming the previous deploy's tickets, a snapshot commit message describing
 * the wrong wave -- none of them reached a gate, and every one of them put a
 * false statement into a permanent record. A deploy-backup whose prose misnames
 * the build it archives is the failure mode that costs a rollback later.
 *
 * So every per-deploy fact now lives in ONE declaration -- DEPLOY, below -- and
 * nothing else in this file may name a build id, a ticket, a slug or a commit.
 * PRE-FLIGHT 0 AUDITS THIS FILE'S OWN TEXT and refuses to run if a build-id or
 * ticket-shaped token appears anywhere outside DEPLOY and the fingerprint map.
 * That is the gate the four corrections needed: the script cannot describe a
 * deploy it is not performing.
 *
 * Everything else is the proven shape: everything offline happens BEFORE the
 * device code is requested, the rollback is archived and PUSHED before any
 * PATCH, and the previous build is read from the ORG rather than derived from
 * git -- a merged-but-undeployed commit once made main's tip describe a build
 * that had never shipped.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

/* =======================================================================
 * THE ONLY PLACE PER-DEPLOY FACTS LIVE
 * ======================================================================= */
const DEPLOY = {
  slug: '2026-09-21-retire-the-data-sources-placeholder-fields',
  what: 'the Data Sources family tabs drop the DELIVERED BY and UPDATE CADENCE placeholder rows, and the origin block closes up without them',
  tickets: ['CLCPA-280'],
  /* what this deploy PUSHES, re-derived from the real merged HEAD before any
   * write. THE STYLESHEET MOVES THIS TIME -- the rule that painted the
   * placeholders as conspicuous amber pills is retired with them, so expectCss
   * differs from prevCss and the stylesheet carries a fingerprint of its own. */
  expectApp: '22d065d93a',
  expectCss: '4993f5eee9',
  /* what the ORG is expected to be serving, proven from ORG CONTENT by both
   * readings -- the canonicalised hash and the file's own APP_BUILD stamp --
   * and never derived from git. */
  prevApp: '0067415e4f',
  prevCss: 'e6de22bc37',
  commits: [
    { sha: '0d13eee', what: 'the two placeholder origin rows, with the renderer branch and the rule that painted them' },
  ],
  headMustBe: 'ca60e4e',
  acceptance: [
    'THE PLACEHOLDERS ARE GONE. Open Map Data, then Data Sources, and walk',
    '   all five family tabs. Under "Where the data comes from", no row may',
    '   read a bracketed to-do and nothing may be painted as an amber dashed',
    '   pill. The two that were there named a Con Edison contact and an',
    '   update cadence.',
    '',
    'WHAT STAYS, per tab. DAC Indicators: Published by, Obtained from.',
    '   Tract Shapes: Published by, Obtained from, Neighborhood crosswalks.',
    '   Electric and Gas Figures: Published by. Territory Overlays:',
    '   Published by. Map Layers has no row list and keeps its source',
    '   sentence, exactly as before.',
    '',
    'NOTHING ELSE ON THE TABS MOVED. What this data is, Authoritative',
    '   source, File requirements, How to update, How the file is made and',
    '   Full procedure must read exactly as they do today on all five tabs,',
    '   and the Back and close controls must behave as they do now.',
    '   Measured off the rendered block before the deploy: it closes from',
    '   156px to 62px on Electric and Gas Figures and on Territory',
    '   Overlays, 156px to 109px on DAC Indicators and 203px to 156px on',
    '   Tract Shapes, and the gap to the next section is unchanged at 18px',
    '   on all five.',
  ],
  disclosed: [
    'THE FOUR AFFECTED TABS COULD NOT BE CLICKED TO IN THE BUILD',
    '   ENVIRONMENT, so walking them is the owner hosted pass. The family',
    '   tab row is gated on Storage.isDataverse(), the sandbox runs on',
    '   localStorage, and driving the real page in Chrome reaches Data',
    '   Sources through the real button and then finds no tab element at',
    '   all. Measured, not assumed. Each tab was instead produced by the',
    '   shipped renderer and painted under the real stylesheet, which is',
    '   where the measurements above come from.',
    'THE BLOCK KEEPS MORE THAN PUBLISHED BY, which the ticket text did not',
    '   say: Obtained from and Neighborhood crosswalks are facts the',
    '   repository does record, and they are preserved with the same values',
    '   in the same order.',
    'AN UNRECORDED ORIGIN IS NOW OMITTED RATHER THAN NAMED AS A GAP. That',
    '   is a change of rule, not an oversight: the rule that no origin may',
    '   be invented is unchanged, and a row appears only when there is a',
    '   fact to put in it. If a contact or a cadence is supplied later, it',
    '   is added as a row like any other.',
    'TWO PRE-EXISTING FAILURES ON MAIN ARE UNTOUCHED AND UNRELATED.',
    '   Data/check_doc_claims.js fails with four findings about CSV upload',
    '   wording, proven pre-existing by running it on the tree before this',
    '   change. A CLCPA-221 render harness carries nine failures about',
    '   tooltip wording, a long dash in a null glyph and a Data Source',
    '   label; it was nine before this change and is nine after it. Neither',
    '   is in this lane and neither ships in the web resources.',
    'THE HTML DOES NOT CHANGE in this wave beyond its cache-busting stamps,',
    '   and the byte comparison against the live copy is what decides what',
    '   is pushed, not this note.',
  ],
};

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const SRC = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev';
const ORG = 'https://org9076e69b.crm.dynamics.com';
const API = ORG + '/api/data/v9.2/';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d';
const TENANT = 'organizations';
const PREFIX = 'cr2bf_dactest/';

const RES = [
  { file: 'app.js', name: PREFIX + 'app.js', id: '79151fe9-3c64-f111-ab0c-7c1e521c7110' },
  { file: 'styles.css', name: PREFIX + 'styles.css', id: '7b151fe9-3c64-f111-ab0c-7c1e521c7110' },
  { file: 'ExecutiveDashboard.html', name: PREFIX + 'ExecutiveDashboard.html', id: '77151fe9-3c64-f111-ab0c-7c1e521c7110' },
];

const TICKET_SYMBOLS = {
  'CLCPA-280': {
    "            : escapeHtml(v)) + '</dd>').join('') + '</dl>'": 1,
    '   * CLCPA-280: an origin the repository does not record is now OMITTED, not': 1,
    [["        ['Published by', 'Con Edison, internal. Not public.'],",
      '      ],',
    ].join(String.fromCharCode(10))]: 1,
  },
};

/* THE STYLESHEET MOVES IN THIS WAVE, so it carries a fingerprint of its own.
 * PRE-FLIGHT 0 refuses an empty one the moment the two ids differ, and
 * refuses a fingerprint here while they are equal.
 *
 * The change is a REMOVAL: the rule that painted an unrecorded origin as an
 * amber dashed pill is gone. A gate has to check for something that is
 * present, so the fingerprint is the tombstone comment that replaced it
 * sitting directly against the rule that follows. That text cannot exist
 * while the rule is still there.
 *
 * JOINED WITH CRLF, and the two halves genuinely differ here. The app half
 * matches against the raw blob, which is LF; this half normalises the blob
 * to CRLF first, because it is the one that carries multi-line rules. */
const CSS_SYMBOLS = {
  'CLCPA-280': {
    [['/* CLCPA-280: .ds-dict-gap is retired. It painted the bracketed origin',
      '   placeholders as conspicuous amber pills, and there are no placeholders left',
      '   to paint: an origin the repository does not record is now omitted. */',
      '',
      '.ds-dict-actions { display: flex; align-items: center; gap: 10px; }',
    ].join(String.fromCharCode(13) + String.fromCharCode(10))]: 1,
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

const BACKDIR = REPO + '/deploy-backups/' + DEPLOY.slug;
/* the log must NOT create the snapshot directory: an offline abort calling
 * die() -> flushLog() -> mkdir would create the very directory PRE-FLIGHT 3d
 * refuses to overwrite, and the script would deadlock itself. */
let ARCHIVED = false;
function flushLog(tail) {
  if (tail) lines.push('', tail);
  try {
    if (ARCHIVED || fs.existsSync(BACKDIR + '/manifest.json')) {
      fs.writeFileSync(BACKDIR + '/deploy.log', lines.join('\n') + '\n');
    } else {
      /* one level UP: this script's own folder is the SOURCE folder, and
       * PRE-FLIGHT 1 refuses to deploy with anything uncommitted in it. An
       * abort log written there makes the next run fail on the last run's
       * wreckage. */
      fs.writeFileSync(path.join(__dirname, '..', 'deploy_abort.log'),
        lines.join('\n') + '\n');
    }
  } catch (e) { /* the console output is still the record */ }
}

const BUILD_SENTINEL = "var APP_BUILD = 'dev';   /* BUILD_ID */";
const canonicaliseApp = (t) =>
  t.replace(/var APP_BUILD = '[^']*';   \/\* BUILD_ID \*\//, BUILD_SENTINEL);
const stampOf = (t) => {
  const m = t.match(/var APP_BUILD = '([^']*)';   \/\* BUILD_ID \*\//);
  return m ? m[1] : null;
};
const symbolCount = () => Object.keys(TICKET_SYMBOLS)
  .reduce((n, t) => n + Object.keys(TICKET_SYMBOLS[t]).length, 0);
const cssSymbolCount = () => Object.keys(CSS_SYMBOLS)
  .reduce((n, t) => n + Object.keys(CSS_SYMBOLS[t]).length, 0);

/* =======================================================================
 * PRE-FLIGHT, entirely offline
 * ======================================================================= */
log('=== ExecutiveDashboard_dev -> cr2bf_dactest deploy ===');
log('org:     ' + ORG);
log('slice:   ' + DEPLOY.what + ' -- ' + DEPLOY.tickets.join(', '));
log('files:   ' + RES.map(r => r.file).join(', '));
log('');

/* --- 0. this script checks ITSELF, including its own prose ------------- */
{
  const required = { fs, path, crypto, execSync, log, die, sha256, flushLog,
    canonicaliseApp, stampOf, symbolCount };
  const missing = Object.keys(required).filter(k => typeof required[k] !== 'function' &&
    typeof required[k] !== 'object');
  if (missing.length) die('this script is broken: ' + missing.join(', ') + ' unusable.');
  ['slug', 'what', 'expectApp', 'expectCss', 'prevApp', 'prevCss', 'headMustBe']
    .forEach(k => { if (!DEPLOY[k]) die('DEPLOY.' + k + ' is not set.'); });
  if (!DEPLOY.tickets.length) die('DEPLOY.tickets is empty.');
  if (!DEPLOY.commits.length) die('DEPLOY.commits is empty.');
  if (!Array.isArray(RES) || RES.length !== 3) die('the resource list is not the expected three.');
  RES.forEach(r => { if (!r.file || !r.name || !r.id) die('incomplete resource entry.'); });
  if (!symbolCount()) die('PRE-FLIGHT 3b has no symbols to count.');
  /* A DIFFERENTIAL STYLESHEET HALF ONLY WHEN THE STYLESHEET MOVES. When the
   * expected css id equals the live one there is nothing for it to be
   * differential about, and demanding a fingerprint anyway would mean inventing
   * a ticket group for a file this wave does not touch. The id gate and the
   * byte-identical read-back still prove styles.css unchanged, and the
   * requirement comes straight back the moment the two ids differ. */
  const cssMoves = DEPLOY.expectCss !== DEPLOY.prevCss;
  if (cssMoves && !cssSymbolCount()) {
    die('the stylesheet MOVES in this wave and 3b has no stylesheet symbols.');
  }
  if (!cssMoves && cssSymbolCount()) {
    die('the stylesheet does NOT move in this wave, so a stylesheet fingerprint ' +
        'is a copied one.');
  }
  /* every ticket in EITHER fingerprint map must be a DECLARED ticket */
  [['app', TICKET_SYMBOLS], ['stylesheet', CSS_SYMBOLS]].forEach(([half, map]) => {
    Object.keys(map).forEach(t => {
      if (DEPLOY.tickets.indexOf(t) < 0) {
        die('PRE-FLIGHT 3b names "' + t + '" in the ' + half + ' half, which is ' +
            'not in DEPLOY.tickets. A fingerprint for a ticket this deploy is ' +
            'not shipping is a copied fingerprint.');
      }
    });
  });
  /* AT LEAST ONE HALF, because a stylesheet-only ticket has nothing to say in
   * app.js and an app-only ticket has nothing to say in styles.css. Requiring
   * both would have made this gate unsatisfiable for either shape; requiring
   * neither would let a ticket ship with no fingerprint at all. */
  DEPLOY.tickets.forEach(t => {
    if (!TICKET_SYMBOLS[t] && !CSS_SYMBOLS[t]) {
      die('DEPLOY ships "' + t + '" with no fingerprint in either half.');
    }
  });

  /* THE PROSE AUDIT. Every build-id-shaped and ticket-shaped token anywhere in
   * this file must be one this deploy declares. Four record corrections across
   * two deploys came from prose copied out of the previous script, and none of
   * them reached a gate -- this is that gate. */
  const self = fs.readFileSync(__filename, 'utf8');
  /* the declaration block and the fingerprint map are where these tokens
   * BELONG, so they are excised before the scan */
  const body = self
    .replace(/const DEPLOY = \{[\s\S]*?\n\};/, '')
    .replace(/const TICKET_SYMBOLS = \{[\s\S]*?\n\};/, '')
    .replace(/const CSS_SYMBOLS = \{[\s\S]*?\n\};/, '');
  /* DECLARED = the per-deploy facts, plus the STABLE identifiers this script
   * legitimately carries: the OAuth client and the three web-resource GUIDs.
   * Those are properties of the org, identical for every deploy, and they are
   * declared in CLIENT_ID and RES -- the audit is about facts that CHANGE per
   * deploy and get copied stale, not about every hex string in the file. Taken
   * from the constants themselves, so renaming a resource cannot leave the
   * allow-list behind. */
  const stable = [CLIENT_ID].concat(RES.map(r => r.id))
    .join(' ').match(/\b[0-9a-f]{4,}\b/g) || [];
  const declared = new Set([DEPLOY.expectApp, DEPLOY.expectCss, DEPLOY.prevApp,
    DEPLOY.prevCss, DEPLOY.headMustBe]
    .concat(DEPLOY.commits.map(c => c.sha))
    .concat(stable));
  const idLike = [...new Set((body.match(/\b[0-9a-f]{7,10}\b/g) || []))]
    .filter(t => /[0-9]/.test(t) && /[a-f]/.test(t) && !declared.has(t));
  if (idLike.length) {
    die('PRE-FLIGHT 0: this file names build ids or commits it does not declare: ' +
        idLike.join(', ') + '\n  Copied prose describing a DIFFERENT deploy is how ' +
        'four record corrections happened. Move the fact into DEPLOY or delete it.');
  }
  const ticketLike = [...new Set((body.match(/CLCPA-\d+[a-z0-9 ]*/gi) || []))]
    .map(t => t.trim())
    .filter(t => !DEPLOY.tickets.some(d => d.toLowerCase().indexOf(t.toLowerCase()) === 0 ||
                                           t.toLowerCase().indexOf(d.toLowerCase()) === 0));
  if (ticketLike.length) {
    die('PRE-FLIGHT 0: this file names tickets this deploy is not shipping: ' +
        ticketLike.join(' | ') + '\n  Same cause, same fix.');
  }
  log('PRE-FLIGHT 0  self-check: helpers present, ' + DEPLOY.tickets.length +
      ' declared tickets, ' + DEPLOY.commits.length + ' commits, 3 resources,');
  log('              ' + symbolCount() + ' app symbols across ' +
      Object.keys(TICKET_SYMBOLS).length + ' tickets + ' + cssSymbolCount() +
      ' stylesheet symbols across ' + Object.keys(CSS_SYMBOLS).length + '.');
  log('              PROSE AUDIT: no undeclared build id, commit or ticket ' +
      'anywhere in this file.');
}

/* --- 1. git state ------------------------------------------------------ */
const HEAD = execSync('git rev-parse --short HEAD', { cwd: REPO }).toString().trim();
const BRANCH = execSync('git rev-parse --abbrev-ref HEAD', { cwd: REPO }).toString().trim();
{
  log('PRE-FLIGHT 1  branch = ' + BRANCH + ', HEAD = ' + HEAD);
  if (BRANCH !== 'main') die('not on main (on "' + BRANCH + '"). Deploys go from main.');
  const dirty = execSync('git status --porcelain -- Coned/CLCPA/ExecutiveDashboard_dev',
    { cwd: REPO }).toString().trim();
  const stray = dirty ? dirty.split('\n').filter(l =>
    l.indexOf(path.basename(__filename)) < 0) : [];
  if (stray.length) die('the source folder has uncommitted changes:\n' + stray.join('\n') +
    '\n  Deploying an unrecorded file makes the build id a lie.');
  log('              source folder clean, so the pushed bytes are exactly ' + HEAD + '.');
  DEPLOY.commits.forEach(c => {
    try {
      execSync('git merge-base --is-ancestor ' + c.sha + ' HEAD', { cwd: REPO });
      log('              ancestor: ' + c.sha + '  ' + c.what);
    } catch (e) { die('HEAD does not contain ' + c.sha + ' (' + c.what + ').'); }
  });
  const remote = execSync('git ls-remote origin refs/heads/main', { cwd: REPO })
    .toString().trim().split(/\s+/)[0];
  const localFull = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim();
  if (remote !== localFull) {
    die('local main ' + localFull.slice(0, 7) + ' is not remote main ' + remote.slice(0, 7) + '.');
  }
  log('              local main == remote main == ' + remote.slice(0, 7) + '.');
  /* THE IDS WERE DERIVED, NOT NAMED IN ADVANCE, so they are bound to the
   * commit the owner produced by merging. Without this the approved-id gate
   * would be comparing a constant against itself. */
  if (HEAD !== DEPLOY.headMustBe) {
    die('HEAD is ' + HEAD + ', not the merge commit ' + DEPLOY.headMustBe +
        ' the ids were derived from.\n  The build ids in DEPLOY describe a tree ' +
        'nobody approved. Re-derive and re-state them before deploying.');
  }
  log('              HEAD is the merge commit the ids were derived from.');
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
  die('app.js does not carry exactly one unstamped BUILD_ID sentinel.');
}
if (appText.indexOf(String.fromCharCode(0)) >= 0) die('app.js contains a raw NUL byte.');
const APP_ID = sha256(Buffer.from(appText, 'utf8')).slice(0, 10);
const CSS_ID = sha256(local['styles.css']).slice(0, 10);
log('PRE-FLIGHT 3  BUILD IDS (content hashes; the client must report the app.js one):');
log('                 app.js      ' + APP_ID);
log('                 styles.css  ' + CSS_ID);
if (APP_ID !== DEPLOY.expectApp) die('app.js id is ' + APP_ID + ', DEPLOY says ' + DEPLOY.expectApp + '.');
if (CSS_ID !== DEPLOY.expectCss) die('styles.css id is ' + CSS_ID + ', DEPLOY says ' + DEPLOY.expectCss + '.');
log('              both match what DEPLOY declares for this wave.');

/* --- 3b. the fingerprints, in the COMMITTED BLOBS ---------------------- */
{
  const blob = execSync('git show HEAD:Coned/CLCPA/ExecutiveDashboard_dev/app.js',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8');
  if (sha256(Buffer.from(blob.replace(/\r?\n/g, '\r\n'), 'utf8')).slice(0, 10) !== APP_ID) {
    die('the committed blob does not hash to ' + APP_ID + '.');
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
        '\n  An id gate proves the bytes were reviewed. It cannot prove which fix is in them.');
  }
  if (blob.indexOf(String.fromCharCode(0)) >= 0) die('the committed blob contains a raw NUL byte.');
  log('PRE-FLIGHT 3b all ' + DEPLOY.tickets.length + ' ticket groups verified in the ' +
      'COMMITTED BLOB (' + counted + ' symbols), 0 NUL bytes.');

  /* NORMALISED TO CRLF BEFORE COUNTING, not only before hashing. git hands
   * back LF blobs and the working tree is CRLF, so a multi-line fingerprint
   * written with \r\n matches nothing in the raw blob and reports "0 of 1" on
   * a perfectly good stylesheet. The app half above hashes a normalised copy
   * and counts the raw one, which only works because its symbols are all
   * single-line -- this half has multi-line rules. */
  const css = execSync('git show HEAD:Coned/CLCPA/ExecutiveDashboard_dev/styles.css',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
  if (sha256(Buffer.from(css, 'utf8')).slice(0, 10) !== CSS_ID) {
    die('the committed styles.css does not hash to ' + CSS_ID + '.');
  }
  const cssBad = [];
  Object.keys(CSS_SYMBOLS).forEach(ticket => {
    const grp = CSS_SYMBOLS[ticket];
    const miss = [];
    Object.keys(grp).forEach(k => {
      const n = css.split(k).length - 1;
      if (n !== grp[k]) miss.push('      ' + n + ' of ' + grp[k] + '   ' + k);
    });
    if (miss.length) cssBad.push('  ' + ticket + '\n' + miss.join('\n'));
    else log('              ok  ' + ticket + '  (stylesheet)');
  });
  if (cssBad.length) die('PRE-FLIGHT 3b: the committed styles.css does not carry ' +
    'these tickets:\n' + cssBad.join('\n'));
  log('              and the STYLESHEET half: ' + cssSymbolCount() +
      ' symbols across ' + Object.keys(CSS_SYMBOLS).length +
      ' ticket group(s) verified in the committed styles.css.');
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
  die('deploy-backups/' + DEPLOY.slug + ' already exists.\n' +
      '  The archive must be CREATED, not overwritten.');
}
log('PRE-FLIGHT 3d snapshot directory is absent, so the archive will be created.');

/* --- 4. stamp, in memory ---------------------------------------------- */
const stampedApp = Buffer.from(
  appText.replace(BUILD_SENTINEL, "var APP_BUILD = '" + APP_ID + "';   /* BUILD_ID */"), 'utf8');
if (stampedApp.equals(local['app.js'])) die('stamping app.js changed nothing.');
if (stampOf(stampedApp.toString('utf8')) !== APP_ID) die('the stamped app.js does not read back its id.');
if (sha256(Buffer.from(canonicaliseApp(stampedApp.toString('utf8')), 'utf8')).slice(0, 10) !== APP_ID) {
  die('canonicalising the stamped app.js does not reproduce its id. Stamping is not idempotent.');
}
let htmlText = local['ExecutiveDashboard.html'].toString('utf8');
const htmlBefore = htmlText;
htmlText = htmlText
  .replace(/href="styles\.css(\?v=[0-9a-f]+)?"/g, 'href="styles.css?v=' + CSS_ID + '"')
  .replace(/src="app\.js(\?v=[0-9a-f]+)?"/g, 'src="app.js?v=' + APP_ID + '"');
if (htmlText === htmlBefore) die('stamping the HTML changed nothing.');
if (htmlText.indexOf('?v=' + APP_ID) < 0) die('the HTML lacks the app.js stamp.');
if (htmlText.indexOf('?v=' + CSS_ID) < 0) die('the HTML lacks the styles.css stamp.');
if (/\?v=[0-9a-f]+/.test(htmlText.replace(new RegExp('\\?v=' + APP_ID, 'g'), '')
    .replace(new RegExp('\\?v=' + CSS_ID, 'g'), ''))) {
  die('the HTML still carries a stale ?v= stamp that is neither new id.');
}
const stampedHtml = Buffer.from(htmlText, 'utf8');
log('PRE-FLIGHT 4  stamps applied in memory, both present, no stale third stamp.');
log('              Nothing on disk is modified.');

const TOPUSH = { 'app.js': stampedApp, 'styles.css': local['styles.css'],
  'ExecutiveDashboard.html': stampedHtml };
log('');
if (process.env.DAC_DRY_RUN) {
  log('DRY RUN: the offline half completed with no errors. Stopping before');
  log('authentication. Nothing requested, nothing written, no deploy.log left.');
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
/* retry on TRANSPORT, never on a status: a 4xx/5xx is an ANSWER and repeating
 * the request only repeats it. A "fetch failed" is no answer at all. */
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
      res = await fetch(API + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
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
    fs.writeFileSync(path.join(__dirname, '..', 'device_code.txt'),
      dc.user_code + '\n' + dc.verification_uri + '\n');
  } catch (e) {}
  log('Waiting for authorization (up to ' + Math.round((dc.expires_in || 900) / 60) + ' min)...');
  TOKEN = await pollToken(dc.device_code, dc.interval, dc.expires_in);
  log('Authorized.');
  log('');

  const who = await dv('GET', 'WhoAmI');
  const me = await dv('GET', 'systemusers(' + who.UserId + ')?$select=fullname,internalemailaddress');
  log('signed in as: ' + me.fullname + ' <' + me.internalemailaddress + '>');
  log('');

  for (const r of RES) {
    const meta = await dv('GET', 'webresourceset(' + r.id + ')?$select=name');
    log('id ' + r.id + ' resolves to: ' + meta.name);
    if (meta.name !== r.name) {
      die('id ' + r.id + ' is named "' + meta.name + '", expected "' + r.name + '".');
    }
  }
  log('GATE  all three ids resolve to the expected names.');
  log('');

  /* --- ARCHIVE the live bytes, and PROVE which build they are --------- */
  fs.mkdirSync(BACKDIR, { recursive: true });
  ARCHIVED = true;
  const manifest = { org: ORG, capturedAt: new Date().toISOString(),
    note: 'Pre-deploy snapshot of the live cr2bf_dactest web resources. Restore by ' +
          'PATCHing webresourceset({webResourceId}) with the base64 of the saved file, ' +
          'then PublishXml.',
    slice: DEPLOY.slug, tickets: DEPLOY.tickets, sourceCommit: HEAD, resources: [] };
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

  /* THREE WAYS, all from ORG CONTENT. A snapshot of an unidentified build is
   * not a rollback, and git cannot tell you what the org is serving. */
  const liveAppText = live['app.js'].toString('utf8');
  const liveStamp = stampOf(liveAppText);
  const liveDerived = sha256(Buffer.from(canonicaliseApp(liveAppText), 'utf8')).slice(0, 10);
  const liveCssId = sha256(live['styles.css']).slice(0, 10);
  /* --- 3b DIFFERENTIAL: the LIVE pair against the merged tree ---------
   *
   * Read from the ORG, never from git, and reported per resource before any
   * write. The offline 3b proves WHICH FIX is in the bytes; this proves
   * WHAT MOVES against what the org is actually serving, which is the only
   * side that can tell a deployed build from a merged one.
   *
   * THE BYTE RULE DECIDES. The HTML carries the ?v= stamps and therefore
   * follows app.js, but it is pushed because its bytes differ, not because
   * a note says it should be. */
  log('');
  log('PRE-FLIGHT 3b DIFFERENTIAL, live org bytes against the merged tree:');
  RES.forEach((r) => {
    const a = live[r.file], b = TOPUSH[r.file];
    const moves = !a.equals(b);
    log('  ' + r.file.padEnd(26) + (moves ? 'MOVES  ' : 'same   ') +
        a.length + 'B -> ' + b.length + 'B');
    log('      live ' + sha256(a).slice(0, 16) + '   new ' + sha256(b).slice(0, 16));
  });
  {
    const movers = RES.filter(r => !live[r.file].equals(TOPUSH[r.file])).map(r => r.file);
    log('  what moves: ' + (movers.length ? movers.join(', ') : 'nothing'));
    if (movers.indexOf('styles.css') >= 0 && DEPLOY.expectCss === DEPLOY.prevCss) {
      die('styles.css bytes differ from the live copy while DEPLOY says its id ' +
          'does not move. The declaration and the bytes disagree; the bytes win, ' +
          'so the declaration is wrong. Stopping before any write.');
    }
    if (movers.indexOf('app.js') >= 0 && movers.indexOf('ExecutiveDashboard.html') < 0) {
      die('app.js moves but the HTML does not, so the ?v= stamp on the live page ' +
          'would still point at the previous build and browsers would keep serving ' +
          'it from cache. Stopping before any write.');
    }
  }

  log('');
  log('PROVENANCE of the archive, read from the ORG:');
  log('  app.js APP_BUILD stamp        : ' + liveStamp);
  log('  app.js canonicalised + hashed : ' + liveDerived);
  log('  expected previous app.js      : ' + DEPLOY.prevApp);
  log('  styles.css LIVE (to replace)  : ' + liveCssId + '   expected ' + DEPLOY.prevCss);
  if (liveStamp !== DEPLOY.prevApp || liveDerived !== DEPLOY.prevApp) {
    die('the live app.js is not ' + DEPLOY.prevApp + ' (stamp ' + liveStamp +
        ', derived ' + liveDerived + ').\n' +
        '  Something was deployed that this deploy does not know about. Stopping\n' +
        '  BEFORE any write: an unidentified snapshot is not a rollback.');
  }
  if (liveCssId !== DEPLOY.prevCss) {
    die('the live styles.css is ' + liveCssId + ', not ' + DEPLOY.prevCss + '.');
  }
  manifest.provenance = { stampedAs: liveStamp, derivedBuildId: liveDerived,
    expectedPrevApp: DEPLOY.prevApp, liveStyleId: liveCssId, expectedPrevCss: DEPLOY.prevCss,
    matches: true, newAppId: APP_ID, newCssId: CSS_ID };
  fs.writeFileSync(BACKDIR + '/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  log('  -> all agree. The archive holds ' + DEPLOY.prevApp + ' + ' + DEPLOY.prevCss + '.');
  log('');

  const willPush = RES.filter(r => manifest.resources.find(m => m.file === r.file).willBeReplaced);
  if (!willPush.length) {
    log('Every resource already matches what would be pushed. Nothing to do.');
    flushLog('=== NO-OP: live already matches ===');
    return;
  }
  log('        ' + willPush.length + ' of 3 will be replaced: ' + willPush.map(r => r.file).join(', '));
  log('');

  /* --- MAKE THE ROLLBACK DURABLE, before any PATCH ------------------- */
  flushLog(null);
  {
    execSync('git add -- "deploy-backups/' + DEPLOY.slug + '"', { cwd: REPO });
    const staged = execSync('git diff --cached --name-only', { cwd: REPO }).toString().trim();
    if (!staged) die('nothing staged for the snapshot commit; it would have been hollow.');
    const outside = staged.split('\n').filter(f => f.indexOf('deploy-backups/') !== 0);
    if (outside.length) die('the snapshot commit would carry files outside ' +
                            'deploy-backups/: ' + outside.join(', '));
    const msg = 'deploy-backups: pre-deploy snapshot for ' + DEPLOY.what + '\n\n' +
      'The live cr2bf_dactest bytes as they stood before ' + APP_ID + ' + ' + CSS_ID +
      ' went up,\nshipping ' + DEPLOY.tickets.join(' and ') + '.\n\n' +
      'Identified by ORG CONTENT, never derived from git:\n' +
      '  - app.js APP_BUILD stamp        ' + liveStamp + '\n' +
      '  - app.js canonicalised + hashed ' + liveDerived + '\n' +
      '  - styles.css hashed             ' + liveCssId + '\n' +
      '  - expected                      ' + DEPLOY.prevApp + ' + ' + DEPLOY.prevCss + '\n\n' +
      'Committed and pushed BEFORE any PATCH, so the rollback exists off this\n' +
      'machine before anything is overwritten.\n\n' +
      'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>\n';
    fs.writeFileSync(BACKDIR + '/.commitmsg', msg);
    execSync('git commit -q -F "' + BACKDIR + '/.commitmsg"', { cwd: REPO });
    fs.unlinkSync(BACKDIR + '/.commitmsg');
    const snapSha = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim();
    log('ROLLBACK  snapshot committed as ' + snapSha.slice(0, 7));
    let pushed = false;
    for (let attempt = 1; attempt <= 3 && !pushed; attempt++) {
      try { execSync('git push origin main', { cwd: REPO, timeout: 300000, stdio: 'pipe' }); pushed = true; }
      catch (e) { log('          push attempt ' + attempt + ' did not return cleanly; checking the remote.'); }
      const remote = execSync('git ls-remote origin refs/heads/main', { cwd: REPO })
        .toString().trim().split(/\s+/)[0];
      if (remote === snapSha) { pushed = true; log('          remote main = ' + remote.slice(0, 7) + '  VERIFIED'); }
    }
    if (!pushed) {
      die('the snapshot commit is on this machine but NOT on the remote after three\n' +
          '  attempts. Stopping before any PATCH: the rollback is not durable.\n' +
          '  NOTHING has been written to Dataverse.');
    }
    log('          the rollback is durable off this machine. Proceeding to write.');
  }
  log('');

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

  let allOk = true;
  const server = {};
  for (const r of RES) {
    const back = await dv('GET', 'webresourceset(' + r.id + ')?$select=content');
    const got = Buffer.from(back.content || '', 'base64');
    server[r.file] = got;
    const same = got.equals(TOPUSH[r.file]);
    log('READ-BACK ' + r.file + '  ' + got.length + 'B  sha256 ' + sha256(got).slice(0, 16) +
      '...  ' + (same ? 'VERIFIED byte-identical' : 'MISMATCH'));
    if (!same) { allOk = false; log('   sent ' + sha256(TOPUSH[r.file])); log('   got  ' + sha256(got)); }
  }
  if (!allOk) die('a read-back does not match what was sent. The archive in ' +
    'deploy-backups/' + DEPLOY.slug + '/ is the rollback, and it is already pushed.');

  const srvStamp = stampOf(server['app.js'].toString('utf8'));
  const srvDerived = sha256(Buffer.from(canonicaliseApp(server['app.js'].toString('utf8')), 'utf8')).slice(0, 10);
  const srvCss = sha256(server['styles.css']).slice(0, 10);
  const srvHtml = server['ExecutiveDashboard.html'].toString('utf8');
  log('');
  log('SERVER-SIDE STAMPS:');
  log('  app.js APP_BUILD              : ' + srvStamp + (srvStamp === APP_ID ? '  ok' : '  WRONG'));
  log('  app.js canonicalised + hashed : ' + srvDerived + (srvDerived === APP_ID ? '  ok' : '  WRONG'));
  log('  styles.css hashed             : ' + srvCss + (srvCss === CSS_ID ? '  ok' : '  WRONG'));
  log('  HTML references app.js?v=     : ' + (srvHtml.indexOf('?v=' + APP_ID) >= 0 ? APP_ID + '  ok' : 'MISSING'));
  log('  HTML references styles.css?v= : ' + (srvHtml.indexOf('?v=' + CSS_ID) >= 0 ? CSS_ID + '  ok' : 'MISSING'));
  if (srvStamp !== APP_ID || srvDerived !== APP_ID || srvCss !== CSS_ID ||
      srvHtml.indexOf('?v=' + APP_ID) < 0 || srvHtml.indexOf('?v=' + CSS_ID) < 0) {
    die('the server copy does not carry the expected ids.');
  }
  {
    const srvApp = server['app.js'].toString('utf8');
    const missing = [];
    Object.keys(TICKET_SYMBOLS).forEach(t => {
      const grp = TICKET_SYMBOLS[t];
      const b = Object.keys(grp).filter(k => (srvApp.split(k).length - 1) !== grp[k]);
      if (b.length) missing.push(t + ': ' + b.join(' | '));
    });
    const srvCssText = server['styles.css'].toString('utf8');
    Object.keys(CSS_SYMBOLS).forEach(t => {
      const grp = CSS_SYMBOLS[t];
      const b = Object.keys(grp).filter(k => (srvCssText.split(k).length - 1) !== grp[k]);
      if (b.length) missing.push('styles.css ' + t + ': ' + b.join(' | '));
    });
    if (missing.length) die('the SERVER copy is missing this wave:\n  ' + missing.join('\n  '));
    log('  all ' + Object.keys(TICKET_SYMBOLS).length + ' app ticket groups and ' +
        cssSymbolCount() + ' stylesheet symbols across ' +
        Object.keys(CSS_SYMBOLS).length + ' group(s) present in the SERVER copy.');
  }

  log('');
  log('=== DEPLOY COMPLETE ===');
  log('slice            : ' + DEPLOY.what + ' -- ' + DEPLOY.tickets.join(', '));
  log('build id (app.js): ' + APP_ID);
  log('styles.css id    : ' + CSS_ID + '   (replaced ' + DEPLOY.prevCss + ')');
  log('previous build   : ' + DEPLOY.prevApp + ', archived and pushed before any write');
  log('source           : ExecutiveDashboard_dev/ at main @ ' + HEAD);
  log('requests: GET ' + GETS + ', PATCH ' + PATCHES + ', POST ' + POSTS);
  log('');
  log('CLIENT CHECK, and it is not optional: server-verified is not client-running.');
  log('Hard-refresh the app and confirm the console prints');
  log('   [DAC dashboard] build ' + APP_ID);
  log('');
  log('THE ACCEPTANCE PASS:');
  DEPLOY.acceptance.forEach(l => log('  ' + l));
  log('');
  log('STILL DISCLOSED, not defects in this build:');
  DEPLOY.disclosed.forEach(l => log('  - ' + l));
  flushLog('=== log written by ' + path.basename(__filename) + ' ===');
})().catch(e => {
  console.error('\nDEPLOY ERROR: ' + (e && e.stack ? e.stack : e));
  flushLog('DEPLOY ERROR: ' + (e && e.message ? e.message : e));
  process.exit(2);
});
