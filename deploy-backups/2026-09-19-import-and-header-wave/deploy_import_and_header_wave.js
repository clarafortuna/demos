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
  slug: '2026-09-19-import-and-header-wave',
  what: 'the section page header, the import totals, the remove-year contract, the button and the two-level CSV',
  tickets: ['CLCPA-281', 'CLCPA-301', 'CLCPA-283', 'CLCPA-282', 'BLACK-BUTTON'],
  /* what this deploy PUSHES, named by the owner in advance and re-derived from
   * the real merged HEAD before any write. BOTH halves move this wave. */
  expectApp: 'c0f8f1a9e6',
  expectCss: '9039bfc509',
  /* what the ORG is expected to be serving, read from the org at snapshot time
   * and never derived from git. */
  prevApp: 'abb8d99439',
  prevCss: '2b9651445c',
  /* every merge this wave ships, each checked by name as an ancestor */
  commits: [
    { sha: '0fd068b', what: 'the read-only surfaces ask the same header question' },
    { sha: 'c0735ba', what: 'the import path computes the row Grand Total' },
    { sha: '18bd1e7', what: 'one contract for removing a year' },
    { sha: '9fd23de', what: 'Add Row keeps its background on hover and active' },
    { sha: '8d4a6d4', what: 'a two-level table round-trips, and the Section A triage' },
  ],
  headMustBe: '8d4a6d4',
  acceptance: [
    'CLCPA-281  THE SECTION PAGE DRAWS BOTH HEADER LEVELS.',
    '   Section F, table F6, on a USER-ADDED year. Both header levels must',
    '   draw, and the body must hold EVERY data row. Under the previous build',
    '   the first data row was promoted into the header band and vanished from',
    '   the body -- a lost row, not merely a missing heading. A9 and A10 the',
    '   same. A seed year must look exactly as it did.',
    '   Also worth a glance: a user-added year holding ONE row should still',
    '   offer its prior-year panel and show no false NO BASELINE chip.',
    'CLCPA-301  AN IMPORTED ROW GETS ITS TOTAL.',
    '   Import a CSV into H1 on a user-added year with the total column left',
    '   as the template writes it, (calculated). Every fully numeric row must',
    '   show its own Grand Total. SAVE AND RELOAD: the totals must still be',
    '   there. A row that files a total which disagrees keeps the filed figure',
    '   and raises the advisory. Editing a component digit by digit must still',
    '   bring the row total with it.',
    'CLCPA-283  A YEAR YOU ADDED IS YOURS TO REMOVE.',
    '   Add a year, save a value into it, then Remove it and confirm. The year',
    '   and its data must go, and it must leave the year selector everywhere.',
    '   Under the previous build the dialog promised exactly that and then',
    '   refused with a red toast, so no user-added year that had ever been',
    '   saved could be removed at all.',
    '   A SEED YEAR must still offer no Remove control. And a dirty draft must',
    '   still raise the discard prompt when the year is switched.',
    'BLACK BUTTON  + ADD ROW KEEPS ITS BACKGROUND.',
    '   Hover + Add Row, and hold the mouse down on it. It must stay clear',
    '   with its blue label, not invert to near-black. Download Template the',
    '   same. Save Changes and Add Data must STILL darken on hover.',
    'CLCPA-282  A TWO-LEVEL TABLE ROUND-TRIPS.',
    '   Download A9s template for a user-added year, save it as CSV, type',
    '   figures in and import it. It must land, and the values must reach the',
    '   RIGHT columns -- check that a 2024 DAC figure did not arrive in the',
    '   2025 DAC column. A10 the same, including its calculated columns. A',
    '   one-level table such as H1 must import exactly as before.',
    '   Use the template for the YEAR BEING FILLED: the group row names the',
    '   years, so a sheet built from a different years template will not match.',
  ],
  disclosed: [
    'CLCPA-290s SHAPE IS NOT SETTLED and no fix for it ships here. On the',
    '   display derivation none of A3/A4s three Total cells compute, where the',
    '   ticket reports one of three. Different surface, and the build starts',
    '   with a browser reproduction rather than a guess.',
    'CLCPA-295 AWAITS A RULING and is untouched: A6 and A7 headings carry a',
    '   stray " Total" that matches a total-row label character for character,',
    '   and those strings live in schema_by_year, which is frozen stored data.',
    'STILL OPEN, each measured and reproducing: 287 (a rejected import is',
    '   never reported on the page, only in the dialog that closes), 289 (A9s',
    '   template carries no calculated markers at all), 291, 292, 294 (a',
    '   computed ratio at or above 1 keeps the raw ratio, so 777 against 333',
    '   reads 2.3 where 233.3% is meant), 300.',
    'RETIRED BY MEASUREMENT, no code: CLCPA-296 -- no group header shares a',
    '   label with any other row in A5 to A8, so the C-01 collision stays',
    '   LATENT -- and CLCPA-286, since no Section A table scaffolds a fresh',
    '   year, by design.',
    'THE BLACK BUTTON IS FIXED SCOPED TO THE CONTROL, not on the shared rule.',
    '   The shared fix was written and backed out because CLCPA-85 round 2',
    '   ruled against restyling a shared rule for one control. The case for',
    '   changing that ruling is filed with the blast radius measured.',
    'CARRIED FORWARD, unchanged: the 44 numeric-looking strings in A3/A4 for',
    '   2098; the remove-year control still reads the composed payload rather',
    '   than the store; and on a fresh A8 the bootstrap would compute 283,852',
    '   into a grand total whose real figure is 336,599.',
    'BOTH HALVES MOVE in this wave: app.js and styles.css.',
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
  'CLCPA-281': {
    /* the shared answer, and the section table borrowing the sub-header rather
     * than eating a data row to fill the slot renderTable's slice assumes */
    '  function storedHeaderRowsInYear(table, year) {': 1,
    '      const borrowed = storedHeaderRowsInYear(t, yr)': 1,
    /* the unconditional subtraction that ate the row must be GONE */
    '    const storedHeaderRows = Math.max(0, headerLevels - 1);': 0,
  },
  'CLCPA-301': {
    /* the import path's own entry into the one engine, and the single apply
     * funnel calling it before the column totals are struck */
    '  function fillDerivableSumsOnImport(rows, headerRow, tableId) {': 1,
    '    res.derivedOnImport = fillDerivableSumsOnImport(i.draft, i.schema, i.tableId);': 1,
  },
  'CLCPA-283': {
    /* protection is seed-year only now, and the predicate that made the two
     * readers disagree between render and click is deleted outright */
    '    return (state.seedYears || []).map(String).includes(y);': 1,
    'function yearHasData': 0,
    'has data (or is a seed year) and cannot be removed': 0,
  },
  'CLCPA-282': {
    /* the composed pair, and the schema side composed the same way so the two
     * sides cannot disagree about what a column is */
    '  function ingestHeaderKeys(rows, headerCount) {': 1,
    '    const schemaNorm = ingestHeaderKeys(': 1,
    '    const body = fileRows.slice(headerCount);': 1,
  },
};

/* THE STYLESHEET DOES NOT MOVE IN THIS WAVE, so it has no differential half:
 * the expected id equals the one the org already serves, and the id gate plus
 * the byte-identical read-back are what prove it unchanged. PRE-FLIGHT 0
 * refuses a fingerprint here while that is true, and refuses an EMPTY one the
 * moment the two ids differ. */
/* THE STYLESHEET MOVES IN THIS WAVE, so it has a differential half of its own.
 * Counted against a CRLF-normalised copy, which is why this anchor carries
 * \r\n: git hands back LF blobs and the working tree is CRLF, and a multi-line
 * rule written with the wrong ending matches nothing and reports "0 of 1" on a
 * perfectly good stylesheet. */
const CSS_SYMBOLS = {
  'BLACK-BUTTON': {
    '#ingest-add-row:hover,\r\n#ingest-add-row:active { background: transparent; }': 1,
    /* .btn:hover keeps its fill: solid buttons must still darken */
    '\r\n.btn:hover { background: var(--ink-2); }': 1,
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
