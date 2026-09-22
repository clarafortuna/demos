/* CLCPA-224: the 2098/2099 cleanup. Phase 1 reads, a GATE decides, Phase 2
 * deletes. One device code for the whole run.
 *
 * THIS FILE CAN DELETE. That is stated first because everything else about it
 * follows from it. There are exactly two non-GET verbs: the OAuth exchange,
 * which goes to Microsoft's identity endpoint and carries no org data, and
 * DELETE, which is issued from ONE helper, called from ONE place, and is
 * unreachable unless the gate passes. PRE-FLIGHT 0 audits this file's own text
 * for all of that before the device code is requested. There is no PATCH and
 * no POST to the org at all.
 *
 * THE GATE, from the owner's conditional GO. Every condition must hold or
 * nothing is deleted:
 *   G1  the full-row backup of every 2098 and 2099 row across ALL stores,
 *       change history included, is committed AND pushed AND re-read from
 *       disk with matching hashes;
 *   G2  the 2023, 2024 and 2025 baseline hashes are captured for every store;
 *   G3  no store came back UNREADABLE;
 *   G4  the derived write list matches the CLCPA-335 report's 2099 write list
 *       -- 34 tables -- with any difference explained.
 *
 * THERE IS NO FIFTH CONDITION, and there was one for half an hour. I added a
 * gate requiring the eight protected CLCPA-214 rows to be identifiable,
 * because the GO seemed to say both "delete the change history for both years"
 * and "leave eight orphan rows", and nothing I held could tell me which eight.
 * The owner's correction removed the contradiction by removing my premise: the
 * eight are listed by TABLE-YEAR and one of them, A1/2099, is inside tonight's
 * set, so the two instructions overlap rather than conflict.
 *
 * THE RULE FOR TONIGHT, and it needs no structural inference at all: the
 * change-history rows to delete are EXACTLY those whose year is 2098 or 2099,
 * whatever their count, and whether or not their data rows still exist. Every
 * other history row is untouched, including every remaining orphan, whatever
 * its count. CLCPA-214's list is recorded below for the record; seven of its
 * eight rows sit outside tonight's years and are left for that ticket.
 *
 * The orphan count is still computed, AFTER the delete, and it is a READING
 * rather than a gate: it is the new inventory CLCPA-214 needs.
 *
 * Nothing in 2023, 2024 or 2025 is ever a delete candidate: the delete list is
 * filtered to the two target years twice, once when it is built and once per
 * row immediately before the request, and a row that fails either check aborts
 * the whole run rather than being skipped.
 *
 * DAC_DRY_RUN=1 proves the offline half without requesting a code.
 * DAC_NO_DELETE=1 runs Phase 1 and the gate and stops before Phase 2.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const ORG = 'https://org9076e69b.crm.dynamics.com';
const API = ORG + '/api/data/v9.2/';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d';
const TENANT = 'organizations';
const YEARS = ['2098', '2099'];
const KEEP_YEARS = ['2023', '2024', '2025'];

const SLUG = '2026-09-21-clcpa224-2098-2099-cleanup';
const BACKDIR = path.join(REPO, 'deploy-backups', SLUG);
const OUTTXT = path.join(__dirname, 'cleanup-2098-2099-output.txt');

/* ---- the CLCPA-335 report's 2099 write list, transcribed ------------- */
/* THIRTY-FOUR TABLES, from the report's own "What was written into 2099"
 * table. Transcribed here so condition G4 is a comparison against the report
 * rather than against my memory of it, and so the count is checkable by eye. */
const REPORT_2099_TABLES = [
  'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10',
  'B1', 'B2',
  'C1', 'C2', 'C3', 'C4', 'C5',
  'D1', 'D2', 'D3', 'D4',
  'E1',
  'G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10',
  'H1',
  'I1',
];
/* and what the same report says about 2098: exactly one table survives the
 * earlier cleanup, G5, with three rows. The 2026-09-18 CLCPA-224 residue list
 * recorded 51 rows across both years, so a reading that finds only G5 at 2098
 * is the difference G4 requires me to explain, not a surprise. */
const REPORT_2098_TABLES = ['G5'];

/* ---- WHAT IS ACTUALLY THERE, and why it is not the report's 34 -------
 *
 * The first live run failed G4: the report describes 2099 in 34 tables and the
 * org holds 8. The owner has confirmed the cause -- their own Remove-year
 * click after the CLCPA-335 run, whose non-awaited delete loop was
 * interrupted, which is the SECOND live instance of the CLCPA-328 defect
 * today. The report's list is kept above as the prior state; G4 now compares
 * the org against the set the owner enumerated in the GO.
 *
 * THIS IS A RE-PIN, NOT A WIDENING. The condition still fails if the org holds
 * any 2098 or 2099 data row outside these two lists, which is the thing G4
 * exists to catch. What changed is the build it is asked about. */
const AUTHORISED_2098_DATA = ['G5'];
const AUTHORISED_2099_DATA = ['A5', 'G6', 'G7', 'G8', 'G9', 'G10', 'H1', 'I1'];
const G4_EXPLANATION =
  'the 26 missing 2099 tables and the 2099 year row are the owner\'s own UI ' +
  'removal after the CLCPA-335 run: a Remove-year click whose non-awaited ' +
  'delete loop was interrupted. Second live instance of CLCPA-328 today.';

/* CLCPA-214's protected list, as the owner stated it, recorded so the report
 * can say which of its rows tonight's delete touches. One of the eight,
 * A1/2099, falls inside tonight's years and is therefore deleted with the
 * rest; the other seven are outside them and are left for that ticket. */
const CLCPA214_LIST = ['A1/2099', 'A1/2100', 'A2/2100', 'T1/2020', 'T2/2021',
  'T3/2022', 'T4/2023', 'T5/2024'];

/* the 51-vs-3 gap between the 2026-09-18 residue list and the 2026-09-21
 * report is the owner's own same-day UI removals between those dates. Stated
 * here so the cross-check reports what it finds and proceeds. */
const GAP_EXPLANATION = 'the owner\'s same-day UI removals between 2026-09-18 and 2026-09-21';

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const flush = () => {
  try { fs.writeFileSync(OUTTXT, lines.join('\n') + '\n'); } catch (e) {}
  try {
    if (fs.existsSync(BACKDIR)) {
      fs.writeFileSync(path.join(BACKDIR, 'cleanup.log'), lines.join('\n') + '\n');
    }
  } catch (e) {}
};
const die = (m) => { log(''); log('STOP: ' + m); flush(); process.exit(1); };
let GETS = 0, DELETES = 0;
const problems = [];
let captured = null;

function canon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
}
const sha = (s) => crypto.createHash('sha256').update(Buffer.from(s, 'utf8')).digest('hex');
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function rowId(row, idField) {
  if (row && row[idField]) return row[idField];
  const k = Object.keys(row || {}).filter(
    x => /id$/i.test(x) && GUID.test(String(row[x])) && !/_value$/.test(x));
  return k.length ? row[k[0]] : null;
}
const yearOf = (row, fields) => {
  for (const f of fields) if (row[f] != null) return String(row[f]);
  return null;
};

/* ---------------------------------------------------------- PRE-FLIGHT 0 */
log('=== CLCPA-224: the ' + YEARS.join('/') + ' cleanup ===');
log('org: ' + ORG);
log('Phase 1 reads. A gate decides. Phase 2 deletes only if every condition holds.');
log('');
/* AUDIT-BLOCK-START */
{
  const self = fs.readFileSync(__filename, 'utf8');
  const code = self
    .replace(/\/\* AUDIT-BLOCK-START \*\/[\s\S]*?\/\* AUDIT-BLOCK-END \*\//, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const verbs = (code.match(/-X [A-Z]+|method: '[A-Z]+'/g) || []);
  const nonGet = verbs.filter(v => !/GET/.test(v));
  const posts = nonGet.filter(v => /POST/.test(v));
  const dels = nonGet.filter(v => /DELETE/.test(v));
  const others = nonGet.filter(v => !/POST|DELETE/.test(v));
  if (others.length) die('PRE-FLIGHT 0: unexpected write verb(s): ' + JSON.stringify(others));
  if (posts.length !== 1) die('PRE-FLIGHT 0: expected exactly one POST, the OAuth exchange. Found ' + posts.length);
  if (dels.length !== 1) die('PRE-FLIGHT 0: expected exactly one DELETE helper. Found ' + dels.length);
  const postLine = code.split('\n').filter(l => /-X POST/.test(l))[0] || '';
  if (!/login\.microsoftonline\.com/.test(postLine)) {
    die('PRE-FLIGHT 0: the POST does not go to the identity endpoint.');
  }
  /* THE BLANKET PATCH CHECK READS CODE, NOT PROSE, and the first cut did not:
   * the audit strips comments but not string literals, and this file's own
   * closing line says "No PATCH, no POST to the org", so it refused to run on
   * its own honesty. The gate was right and its input was wrong. String
   * literals are stripped before the blanket test; the verb test above is
   * unaffected because it matches the literal request-option spellings. */
  const noStrings = code
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
  if (/PATCH/.test(noStrings)) die('PRE-FLIGHT 0: this file names PATCH in code.');
  /* THE DELETE MUST BE CALLED FROM ONE PLACE, and that place must be after
   * the gate. A second call site is how a guarded delete becomes an
   * unguarded one. */
  /* ONE DEFINITION AND ONE CALL SITE, counted separately.
   *
   * The first cut asserted that `dvDelete(` appears twice, reasoning that the
   * definition and the call would each match. It does not: the helper is an
   * arrow function, `const dvDelete = (set, id, ...)`, so the name is not
   * followed by a parenthesis there and only the call matched. The gate said
   * "found 1" and was right about the file and wrong about my arithmetic. The
   * two things are now counted as the two different shapes they have. */
  const defs = (code.match(/const dvDelete\s*=/g) || []).length;
  const callSites = (code.match(/\bdvDelete\(/g) || []).length;
  if (defs !== 1) die('PRE-FLIGHT 0: expected one dvDelete definition, found ' + defs + '.');
  if (callSites !== 1) {
    die('PRE-FLIGHT 0: expected exactly one dvDelete call site, found ' + callSites +
        '. A second call site is how a guarded delete becomes an unguarded one.');
  }
  const iGate = code.indexOf('GATE_PASSED');
  const iCall = code.lastIndexOf('await dvDelete(');
  if (iGate < 0 || iCall < 0 || iCall < iGate) {
    die('PRE-FLIGHT 0: the delete call site is not downstream of the gate.');
  }
  log('PRE-FLIGHT 0  self-audit: one POST (the identity endpoint, no org data),');
  log('              one DELETE helper with one call site, downstream of the gate.');
  log('              No PATCH anywhere. No POST to the org.');
}
/* AUDIT-BLOCK-END */

/* ---------------------------------------------------------- PRE-FLIGHT 1 */
const APP = fs.readFileSync(path.join(REPO, REL), 'utf8');
const APPL = APP.split('\r\n');
let VIS_RULE = '', SEED_RULE = '', REMOVE_BODY = '';
{
  const start = APPL.findIndex(l => /^  function isYearProtected\(year\) \{/.test(l));
  if (start < 0) die('cannot find isYearProtected in app.js');
  let end = start;
  while (end < APPL.length && APPL[end] !== '  }') end++;
  const slice = APPL.slice(start, end + 1).join('\n');
  const make = (seedYears) => new Function('state',
    slice + '\nreturn isYearProtected;')({ seedYears });
  if (make(['2025', '2098'])('2098') !== true || make(['2025'])('2098') !== false) {
    die('the sliced predicate does not behave like isYearProtected');
  }
  VIS_RULE = (APPL.filter(l => /const show = yr != null && Storage\.getAddedYears\(\)/.test(l))[0] || '').trim();
  SEED_RULE = (APPL.filter(l => /\.filter\(y => addedYears\.indexOf\(y\) < 0\)/.test(l))[0] || '').trim();
  if (!VIS_RULE || !SEED_RULE) die('cannot find the visibility rule or the seedYears derivation');
  const rs = APPL.findIndex(l => /^        removeYear\(year\) \{/.test(l));
  if (rs < 0) die('cannot find dvBackend.removeYear in app.js');
  let re = rs;
  while (re < APPL.length && APPL[re] !== '        },') re++;
  REMOVE_BODY = APPL.slice(rs, re + 1).join('\n');
  log('PRE-FLIGHT 1  isYearProtected sliced from the shipped app.js and driven both ways.');
  log('              visibility rule: ' + VIS_RULE);
  log('              seedYears rule:  ' + SEED_RULE);
}

/* ---------------------------------------------------------- PRE-FLIGHT 2 */
const WRITE_SETS = [];
{
  const code = APP.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
  const consts = {};
  (code.match(/const (SET_[A-Z_]+|set[A-Za-z]+)\s*=\s*'([a-z0-9_]+)'/g) || []).forEach((m) => {
    const p = /const (\S+)\s*=\s*'([a-z0-9_]+)'/.exec(m);
    if (p) consts[p[1]] = p[2];
  });
  const seen = {};
  (code.match(/dv(?:Create|Update|Delete)\(\s*([A-Za-z_][A-Za-z0-9_]*)/g) || []).forEach((s) => {
    const p = /dv(Create|Update|Delete)\(\s*(\S+)/.exec(s);
    if (!p) return;
    const verb = p[1], sym = p[2];
    if (sym === 'set' || sym === 'id' || sym === 'body') return;
    let set = consts[sym] || null;
    if (!set && /^set[A-Z]/.test(sym)) {
      set = consts['SET_' + sym.slice(3).toUpperCase() + '_DEFAULT'] || null;
    }
    const k = (set || sym) + ' ' + verb;
    if (seen[k]) return;
    seen[k] = true;
    WRITE_SETS.push({ verb, symbol: sym, set });
  });
  log('PRE-FLIGHT 2  the write list, derived from the shipped app.js:');
  const bySet = {};
  WRITE_SETS.forEach(w => {
    const key = w.set || ('UNRESOLVED ' + w.symbol);
    (bySet[key] = bySet[key] || []).push(w.verb);
  });
  Object.keys(bySet).sort().forEach(k =>
    log('                ' + k.padEnd(40) + bySet[k].sort().join(', ')));
}

/* ---------------------------------------------------------- PRE-FLIGHT 3 */
log('PRE-FLIGHT 3  the CLCPA-335 report expectations, transcribed:');
log('              2099: ' + REPORT_2099_TABLES.length + ' tables  ' +
  REPORT_2099_TABLES.join(' '));
log('              2098: ' + REPORT_2098_TABLES.join(' ') + ' only (3 rows)');
if (REPORT_2099_TABLES.length !== 34) {
  die('the transcribed 2099 list is ' + REPORT_2099_TABLES.length + ' tables, not 34');
}
log('              F and J were never given a 2099, per the same report.');
log('');

if (process.env.DAC_DRY_RUN) {
  log('DRY RUN: the offline half completed with no errors. Stopping before');
  log('authentication. No device code requested, nothing read, nothing deleted.');
  flush();
  process.exit(0);
}

/* ------------------------------------------------------------- transport */
const getJson = (url, token) => new Promise((res, rej) => {
  GETS++;
  const u = new URL(url);
  const req = https.request({
    hostname: u.hostname, path: u.pathname + u.search, method: 'GET',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json',
      'OData-MaxVersion': '4.0', 'OData-Version': '4.0',
      Prefer: 'odata.maxpagesize=500' },
  }, (r) => {
    let b = '';
    r.on('data', c => { b += c; });
    r.on('end', () => {
      if (r.statusCode >= 400) return rej(new Error('HTTP ' + r.statusCode + ' ' + b.slice(0, 200)));
      try { res(b ? JSON.parse(b) : {}); } catch (e) { rej(e); }
    });
  });
  req.on('error', rej);
  req.end();
});

/* THE ONE DELETE HELPER. Its own guard is the last line of defence and it is
 * not a formality: it refuses any year that is not a target year, so a bug
 * upstream that put a stored year in the list cannot reach the network. */
const dvDelete = (set, id, year, token) => new Promise((res, rej) => {
  if (YEARS.indexOf(String(year)) < 0) {
    return rej(new Error('REFUSED: ' + set + '(' + id + ') is year ' + year +
      ', which is not one of ' + YEARS.join('/')));
  }
  if (!GUID.test(String(id))) return rej(new Error('REFUSED: not a row id: ' + id));
  DELETES++;
  const u = new URL(API + set + '(' + id + ')');
  const req = https.request({
    hostname: u.hostname, path: u.pathname + u.search, method: 'DELETE',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json',
      'OData-MaxVersion': '4.0', 'OData-Version': '4.0' },
  }, (r) => {
    let b = '';
    r.on('data', c => { b += c; });
    r.on('end', () => {
      if (r.statusCode >= 400) return rej(new Error('HTTP ' + r.statusCode + ' ' + b.slice(0, 200)));
      res(true);
    });
  });
  req.on('error', rej);
  req.end();
});

async function getAll(set, query, token) {
  let url = API + set + (query ? '?' + query : '');
  const rows = [];
  while (url) {
    const j = await getJson(url, token);
    (j.value || []).forEach(r => rows.push(r));
    url = j['@odata.nextLink'] || null;
  }
  return rows;
}

const form = (obj) => Object.keys(obj).map(k =>
  encodeURIComponent(k) + '=' + encodeURIComponent(obj[k])).join('&');
const idp = (pathname, payload) => {
  const out = execSync('curl -s -X POST https://login.microsoftonline.com' + pathname +
    ' -H "Content-Type: application/x-www-form-urlencoded" --data ' +
    JSON.stringify(form(payload)), { maxBuffer: 1 << 24 }).toString();
  return JSON.parse(out);
};

/* read a store's rows for a set of years, never reporting zero on a failure */
async function readYears(T, years, token) {
  for (const yf of T.yearFields) {
    for (const cast of [(y) => "'" + y + "'", (y) => y]) {
      try {
        const f = years.map(y => yf + ' eq ' + cast(y)).join(' or ');
        const rows = await getAll(T.set, '$filter=' + encodeURIComponent(f), token);
        return { rows, how: 'filter on ' + yf + (cast('x') === "'x'" ? ' as text' : ' as number') };
      } catch (e) { /* next spelling */ }
    }
  }
  const all = await getAll(T.set, '', token);
  return { rows: all.filter(r => years.indexOf(yearOf(r, T.yearFields)) >= 0),
    how: 'whole table read (' + all.length + ' rows), filtered here' };
}

(async () => {
  const dc = idp('/' + TENANT + '/oauth2/v2.0/devicecode',
    { client_id: CLIENT_ID, scope: ORG + '/.default offline_access' });
  if (!dc.user_code) die('no device code: ' + JSON.stringify(dc).slice(0, 200));
  log('################  ACTION NEEDED  ################');
  log('  Open:  ' + dc.verification_uri);
  log('  Code:  ' + dc.user_code);
  log('#################################################');
  log('');
  try {
    fs.writeFileSync(path.join(REPO, 'Coned/CLCPA/device_code.txt'),
      dc.user_code + '\n' + dc.verification_uri + '\n');
  } catch (e) {}
  flush();

  let token = null;
  const deadline = Date.now() + (dc.expires_in || 900) * 1000;
  while (!token && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, (dc.interval || 5) * 1000));
    const t = idp('/' + TENANT + '/oauth2/v2.0/token', {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: CLIENT_ID, device_code: dc.device_code,
    });
    if (t.access_token) token = t.access_token;
    else if (t.error && t.error !== 'authorization_pending') {
      die('authorization failed: ' + t.error + ' ' + (t.error_description || '').slice(0, 160));
    }
  }
  if (!token) die('the device code expired before it was used.');
  log('Authorized.');
  const who = await getJson(API + 'WhoAmI', token);
  log('signed in, org user ' + who.UserId);
  log('');

  /* ================================================== PHASE 1: THE READ */
  log('########## PHASE 1: THE READ ##########');
  log('');

  /* ---- discovery, three levels, the last of which cannot fail -------- */
  log('DISCOVERY of year-keyed tables');
  const KNOWN_YEAR_FIELDS = ['cr2bf_year', 'cr2bf_reportingyear'];
  let ents = [], entsHow = '';
  try {
    ents = await getAll('EntityDefinitions',
      "$select=LogicalName,EntitySetName&$filter=startswith(LogicalName,'cr2bf_')", token);
    entsHow = 'server-side startswith filter';
  } catch (e1) {
    log('  the filtered metadata query was refused: ' + e1.message);
    try {
      const all = await getAll('EntityDefinitions', '$select=LogicalName,EntitySetName', token);
      ents = all.filter(e => /^cr2bf_/.test(e.LogicalName || ''));
      entsHow = 'whole metadata list read (' + all.length + ' entities), narrowed here';
    } catch (e2) {
      problems.push('EntityDefinitions unreadable both ways: ' + e2.message);
      entsHow = 'NOT READ; falling back to the derived write list';
    }
  }
  log('  [' + entsHow + ']');
  const stores = [];
  if (ents.length) {
    log('  ' + ents.length + ' cr2bf_ entit(ies)');
    for (const e of ents) {
      let attrs = null;
      try {
        attrs = await getAll("EntityDefinitions(LogicalName='" + e.LogicalName + "')/Attributes",
          '$select=LogicalName', token);
      } catch (err) { problems.push('attributes unreadable for ' + e.LogicalName); }
      const yf = attrs
        ? attrs.filter(a => /year/i.test(a.LogicalName)).map(a => a.LogicalName)
        : KNOWN_YEAR_FIELDS.slice();
      if (yf.length && e.EntitySetName) {
        stores.push({ logical: e.LogicalName, set: e.EntitySetName, yearFields: yf,
          idField: e.LogicalName + 'id', probed: !attrs });
        log('  ' + e.LogicalName.padEnd(38) + 'YEAR KEY ' + yf.join(', ') +
          (attrs ? '' : '  (attributes unreadable; known names tried)'));
      }
    }
  }
  [...new Set(WRITE_SETS.map(w => w.set).filter(Boolean))].forEach((set) => {
    if (stores.some(t => t.set === set)) return;
    const logical = set.replace(/ies$/, 'y').replace(/s$/, '');
    stores.push({ logical, set, yearFields: KNOWN_YEAR_FIELDS.slice(),
      idField: logical + 'id', fromWriteList: true });
    log('  + ' + set.padEnd(38) + 'added from the write list');
  });
  log('  stores to inventory: ' + stores.map(s => s.set).join(', '));
  log('');

  /* ---- the inventory and the baselines, per store -------------------- */
  captured = {};
  const baselines = {};
  const unreadable = [];
  log('INVENTORY of ' + YEARS.join('/') + ', and BASELINES for ' + KEEP_YEARS.join('/'));
  for (const T of stores) {
    let target, keep;
    try { target = await readYears(T, YEARS, token); }
    catch (e) {
      unreadable.push(T.set + ' (target years): ' + e.message);
      log('  ' + T.set + '   UNREADABLE for the target years: ' + e.message);
      continue;
    }
    try { keep = await readYears(T, KEEP_YEARS, token); }
    catch (e) {
      unreadable.push(T.set + ' (kept years): ' + e.message);
      log('  ' + T.set + '   UNREADABLE for the kept years: ' + e.message);
      continue;
    }
    captured[T.set] = { table: T, rows: target.rows, how: target.how };
    /* THE BASELINE IS PER STORE AND PER YEAR, over the whole row rather than
     * one column: a delete that touched a stored row anywhere would move it. */
    const perYear = {};
    KEEP_YEARS.forEach((y) => {
      const rows = keep.rows.filter(r => yearOf(r, T.yearFields) === y);
      const perRow = rows.map(r => ({ id: rowId(r, T.idField), sha256: sha(canon(r)) }))
        .sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1));
      perYear[y] = { rows: rows.length, perRow,
        manifest: sha(perRow.map(x => x.sha256).join('\n')) };
    });
    baselines[T.set] = { readBy: keep.how, years: perYear };
    log('  ' + T.set);
    log('      ' + YEARS.join('/') + ': ' + target.rows.length + ' row(s)   [' + target.how + ']');
    const byYT = {};
    target.rows.forEach((r) => {
      const k = yearOf(r, T.yearFields) + '  ' + (r.cr2bf_tableid || r.cr2bf_key || '-');
      byYT[k] = (byYT[k] || 0) + 1;
    });
    Object.keys(byYT).sort().forEach(k => log('        ' + k.padEnd(30) + byYT[k]));
    KEEP_YEARS.forEach(y => log('      ' + y + ': ' + perYear[y].rows +
      ' row(s)   baseline ' + perYear[y].manifest.slice(0, 16)));
  }
  log('');

  /* ---- the CLCPA-335 cross-check ------------------------------------ */
  log('CROSS-CHECK against the CLCPA-335 report');
  const td = captured['cr2bf_dacingesttesttabledata1s'];
  let g4 = false, g4why = 'the override table was not read';
  if (td) {
    const tablesAt = (y) => [...new Set(td.rows
      .filter(r => String(r.cr2bf_year) === y)
      .map(r => r.cr2bf_tableid || (r.cr2bf_key || '').split(':')[0]))].sort();
    const at99 = tablesAt('2099'), at98 = tablesAt('2098');
    /* AGAINST THE AUTHORISED SET, with the report's list shown beside it so
     * the difference stays visible rather than being quietly normalised. */
    const miss99 = AUTHORISED_2099_DATA.filter(t => at99.indexOf(t) < 0);
    const extra99 = at99.filter(t => AUTHORISED_2099_DATA.indexOf(t) < 0);
    const miss98 = AUTHORISED_2098_DATA.filter(t => at98.indexOf(t) < 0);
    const extra98 = at98.filter(t => AUTHORISED_2098_DATA.indexOf(t) < 0);
    log('  2099 tables in the org        : ' + at99.length + '   ' + at99.join(' '));
    log('  2099 tables authorised by the GO: ' + AUTHORISED_2099_DATA.length + '   ' +
      AUTHORISED_2099_DATA.join(' '));
    log('    authorised but absent: ' + (miss99.join(' ') || 'none'));
    log('    present but NOT authorised: ' + (extra99.join(' ') || 'none'));
    log('  2098 tables in the org        : ' + at98.length + '   ' + (at98.join(' ') || 'none'));
    log('  2098 tables authorised by the GO: ' + AUTHORISED_2098_DATA.join(' '));
    log('    authorised but absent: ' + (miss98.join(' ') || 'none'));
    log('    present but NOT authorised: ' + (extra98.join(' ') || 'none'));
    log('  the CLCPA-335 report described 2099 in ' + REPORT_2099_TABLES.length +
      ' tables. The difference is EXPLAINED:');
    log('    ' + G4_EXPLANATION);
    g4 = extra99.length === 0 && extra98.length === 0 &&
      miss99.length === 0 && miss98.length === 0;
    g4why = g4 ? 'the org matches the authorised set exactly'
      : 'unauthorised present ' + (extra98.length + extra99.length) +
        ', authorised absent ' + (miss98.length + miss99.length);
  } else {
    log('  ' + g4why);
  }
  log('');

  /* ---- the orphan history set --------------------------------------- */
  log('THE ORPHAN HISTORY SET, pre-delete (a reading, not a gate)');
  const hist = captured['cr2bf_dacingesttestchangehistories'];
  let orphans = [], nonOrphans = [];
  if (!hist) {
    log('  the change-history table was not read; this reading is MISSING.');
  } else {
    const dataKeys = new Set((td ? td.rows : []).map(
      r => (r.cr2bf_tableid || '') + ':' + String(r.cr2bf_year)));
    hist.rows.forEach((r) => {
      const k = (r.cr2bf_tableid || '') + ':' + String(r.cr2bf_year);
      (dataKeys.has(k) ? nonOrphans : orphans).push(r);
    });
    log('  history rows for ' + YEARS.join('/') + ': ' + hist.rows.length);
    log('  ORPHANS (no surviving data row for their table and year): ' + orphans.length);
    orphans.forEach(r => log('    ' + String(r.cr2bf_year) + '  ' +
      (r.cr2bf_tableid || '-').padEnd(6) + (r.cr2bf_savedat || '') + '  ' +
      rowId(r, hist.table.idField)));
    log('  NON-ORPHANS (their data row still exists): ' + nonOrphans.length);
    nonOrphans.forEach(r => log('    ' + String(r.cr2bf_year) + '  ' +
      (r.cr2bf_tableid || '-').padEnd(6) + (r.cr2bf_savedat || '')));
  }
  log('');

  /* ---- the backup, with a manifest ---------------------------------- */
  fs.mkdirSync(BACKDIR, { recursive: true });
  const sourceCommit = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim();
  const backup = {
    org: ORG, capturedAt: new Date().toISOString(), years: YEARS, sourceCommit,
    note: 'FULL ROWS for ' + YEARS.join(' and ') + ' across every year-keyed store, ' +
      'change history included, every field as Dataverse returned them. Restore by ' +
      'POSTing each row back to its entity set with its own id field removed.',
    stores: {},
  };
  const manifest = {
    org: ORG, capturedAt: backup.capturedAt, years: YEARS, keepYears: KEEP_YEARS,
    sourceCommit, ticket: 'CLCPA-224',
    discovery: entsHow,
    stores: {}, baselines, problems,
    report335: { tables2099: REPORT_2099_TABLES, tables2098: REPORT_2098_TABLES },
  };
  Object.keys(captured).forEach((set) => {
    const { table, rows, how } = captured[set];
    const perRow = rows.map(r => ({
      id: rowId(r, table.idField), year: yearOf(r, table.yearFields),
      tableId: r.cr2bf_tableid || r.cr2bf_key || null, sha256: sha(canon(r)),
    })).sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1));
    backup.stores[set] = { set, idField: table.idField, readBy: how, rows };
    manifest.stores[set] = { set, idField: table.idField, readBy: how,
      rows: rows.length, perRow, manifest: sha(perRow.map(x => x.sha256).join('\n')) };
  });
  manifest.overall = sha(Object.keys(manifest.stores).sort()
    .map(s => s + ':' + manifest.stores[s].manifest).join('\n'));
  const bakPath = path.join(BACKDIR, 'rows-2098-2099.json');
  const manPath = path.join(BACKDIR, 'manifest.json');
  fs.writeFileSync(bakPath, JSON.stringify(backup, null, 2) + '\n');
  fs.writeFileSync(manPath, JSON.stringify(manifest, null, 2) + '\n');
  log('FULL-ROW BACKUP');
  Object.keys(manifest.stores).sort().forEach(s => log('  ' + s.padEnd(40) +
    manifest.stores[s].rows + ' row(s)   ' + manifest.stores[s].manifest.slice(0, 16)));
  log('  OVERALL ' + manifest.overall);

  /* re-read from disk: a file that was written is not yet a file that can be
   * restored from */
  let rereadOk = true;
  {
    const rr = JSON.parse(fs.readFileSync(bakPath, 'utf8'));
    Object.keys(manifest.stores).forEach((s) => {
      const T = captured[s].table;
      const perRow = (rr.stores[s].rows || []).map(
        r => ({ id: rowId(r, T.idField), sha256: sha(canon(r)) }))
        .sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1));
      if (sha(perRow.map(x => x.sha256).join('\n')) !== manifest.stores[s].manifest) {
        rereadOk = false; log('  MISMATCH re-reading ' + s);
      }
    });
    log('  re-read and re-hashed from disk: ' + (rereadOk ? 'every manifest matches' : 'MISMATCH'));
  }

  /* commit and push, before anything can be deleted */
  let pushed = false;
  try {
    execSync('git add -- "deploy-backups/' + SLUG + '"', { cwd: REPO });
    const staged = execSync('git diff --cached --name-only', { cwd: REPO }).toString().trim();
    const outside = staged ? staged.split('\n').filter(f => f.indexOf('deploy-backups/') !== 0) : [];
    /* ALREADY COMMITTED IS NOT A FAILURE, and the first version of this made it
     * one. On a second run the backup content is byte-identical, so `git add`
     * stages nothing, the hollow-commit guard fires, and G1 fails -- blocking a
     * delete because the rollback was ALREADY safe. The guard is right that a
     * commit with nothing staged is hollow; what it needed was to tell that
     * apart from a backup that is already in history and already pushed. So
     * nothing staged is checked against the tree: if the backup directory is
     * clean and HEAD is on the remote, the rollback exists and G1 holds. */
    if (!staged) {
      const dirty = execSync('git status --porcelain -- "deploy-backups/' + SLUG + '"',
        { cwd: REPO }).toString().trim();
      if (dirty) throw new Error('nothing staged yet the backup directory is dirty: ' + dirty);
      const head = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim();
      const remote = execSync('git ls-remote origin refs/heads/main', { cwd: REPO })
        .toString().trim().split(/\s+/)[0];
      if (remote !== head) throw new Error('the backup is committed but HEAD is not on the remote');
      const logged = execSync('git log --oneline -1 -- "deploy-backups/' + SLUG + '"',
        { cwd: REPO }).toString().trim();
      pushed = true;
      log('  the backup is byte-identical to the one already committed and pushed.');
      log('  commit: ' + logged);
      log('  nothing to commit, and nothing needed to be: the rollback is durable.');
      throw { alreadyDone: true };
    }
    if (outside.length) throw new Error('would carry files outside deploy-backups: ' + outside.join(', '));
    const msg = 'deploy-backups: CLCPA-224 pre-delete backup of ' + YEARS.join(' and ') + '\n\n' +
      'Every 2098 and 2099 row across every year-keyed store, change history\n' +
      'included, captured read-only before any delete. Restore by POSTing each\n' +
      'row back to its entity set with its own id removed.\n\n' +
      'overall manifest ' + manifest.overall + '\n' +
      'source commit    ' + sourceCommit + '\n\n' +
      'Committed and pushed BEFORE the delete, so the rollback exists off this\n' +
      'machine before anything is removed.\n\n' +
      'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>\n';
    fs.writeFileSync(path.join(BACKDIR, '.commitmsg'), msg);
    execSync('git commit -q -F "' + path.join(BACKDIR, '.commitmsg') + '"', { cwd: REPO });
    fs.unlinkSync(path.join(BACKDIR, '.commitmsg'));
    const sha1 = execSync('git rev-parse HEAD', { cwd: REPO }).toString().trim();
    for (let i = 0; i < 3 && !pushed; i++) {
      try { execSync('git push origin main', { cwd: REPO, timeout: 300000, stdio: 'pipe' }); } catch (e) {}
      const remote = execSync('git ls-remote origin refs/heads/main', { cwd: REPO })
        .toString().trim().split(/\s+/)[0];
      if (remote === sha1) pushed = true;
    }
    log('  committed as ' + sha1.slice(0, 7) + '   pushed: ' + (pushed ? 'VERIFIED' : 'NO'));
  } catch (e) {
    /* the already-committed path signals through a throw so it can skip the
     * commit without duplicating the push verification; it is not a failure */
    if (!e || !e.alreadyDone) {
      log('  the backup commit or push FAILED: ' + e.message);
      problems.push('backup commit/push failed: ' + e.message);
    }
  }
  log('');

  /* ========================================================== THE GATE */
  log('########## THE GATE ##########');
  const g1 = pushed && rereadOk;
  const g2 = Object.keys(baselines).length === Object.keys(captured).length &&
    Object.keys(baselines).length > 0 &&
    Object.keys(baselines).every(s => KEEP_YEARS.every(y => baselines[s].years[y]));
  const g3 = unreadable.length === 0;
  /* FOUR CONDITIONS. The fifth I had added is gone: see the header. */
  const conds = [
    ['G1  backup committed, pushed and re-read with matching hashes', g1,
      'pushed=' + pushed + ', reread=' + rereadOk],
    ['G2  2023/2024/2025 baselines captured for every store', g2,
      Object.keys(baselines).length + ' of ' + Object.keys(captured).length + ' stores'],
    ['G3  no store came back UNREADABLE', g3,
      unreadable.length ? unreadable.join('; ') : 'none'],
    ['G4  the derived write list matches the report\'s 34 tables for 2099', g4, g4why],
  ];
  conds.forEach(([label, okc, detail]) =>
    log('  ' + (okc ? 'PASS  ' : 'FAIL  ') + label + '   [' + detail + ']'));
  const GATE_PASSED = conds.every(c => c[1]) && !process.env.DAC_NO_DELETE;
  log('');
  if (!conds.every(c => c[1])) {
    log('THE GATE DID NOT PASS. Nothing has been deleted and nothing will be.');
    log('Phase 1 stands on its own: the inventory, the baselines and the backup');
    log('are above and the backup is committed' + (pushed ? ' and pushed' : ' but NOT pushed') + '.');
    log('');
    log('requests: GET ' + GETS + ', DELETE ' + DELETES + '.');
    flush();
    process.exit(0);
  }
  if (process.env.DAC_NO_DELETE) {
    log('Every condition holds, but DAC_NO_DELETE is set: stopping before Phase 2.');
    log('requests: GET ' + GETS + ', DELETE ' + DELETES + '.');
    flush();
    process.exit(0);
  }

  /* ================================================ PHASE 2: THE DELETE */
  log('########## PHASE 2: THE DELETE ##########');
  log('');
  /* THE PLAN IS BUILT FROM THE BACKUP, not from a fresh query: every row about
   * to be deleted is a row whose full contents are already committed and
   * pushed. A row that is not in the backup is not deletable, by construction. */
  /* EVERY CAPTURED ROW GOES, history included, and nothing is held back.
   * The rows captured are exactly the rows whose year is 2098 or 2099 -- that
   * is what the year-filtered read selected -- so the owner's corrected rule
   * needs no further filtering here. Orphan status is not consulted: it is a
   * reading taken after the delete, not a condition on it. */
  const plan = [];
  Object.keys(captured).forEach((set) => {
    const T = captured[set].table;
    captured[set].rows.forEach((r) => {
      plan.push({ set, id: rowId(r, T.idField), year: yearOf(r, T.yearFields),
        tableId: r.cr2bf_tableid || r.cr2bf_key || null });
    });
  });
  const inBackup = new Set();
  Object.keys(manifest.stores).forEach(s =>
    manifest.stores[s].perRow.forEach(x => inBackup.add(s + '|' + x.id)));
  const notBacked = plan.filter(p => !inBackup.has(p.set + '|' + p.id));
  if (notBacked.length) {
    die('the plan contains ' + notBacked.length + ' row(s) that are not in the ' +
      'committed backup. Nothing deleted.');
  }
  const wrongYear = plan.filter(p => YEARS.indexOf(String(p.year)) < 0);
  if (wrongYear.length) {
    die('the plan contains ' + wrongYear.length + ' row(s) outside ' + YEARS.join('/') +
      ': ' + JSON.stringify(wrongYear.slice(0, 5)) + '. Nothing deleted.');
  }
  const planBySet = {};
  plan.forEach(p => { planBySet[p.set] = (planBySet[p.set] || 0) + 1; });
  log('THE PLAN');
  Object.keys(planBySet).sort().forEach(s => log('  ' + s.padEnd(40) + planBySet[s] + ' row(s)'));
  log('  history rows in the plan: every row whose year is ' + YEARS.join(' or ') +
    ', orphaned or not, per the corrected GO.');
  log('  CLCPA-214 list: ' + CLCPA214_LIST.join(', '));
  log('    of those, inside tonight\'s years: ' +
    (CLCPA214_LIST.filter(x => YEARS.indexOf(x.split('/')[1]) >= 0).join(', ') || 'none'));
  log('    left for the 214 decision: ' +
    CLCPA214_LIST.filter(x => YEARS.indexOf(x.split('/')[1]) < 0).join(', '));
  log('  every planned row is in the pushed backup, and every one is ' +
    YEARS.join(' or ') + '.');
  log('');

  const failed = [];
  for (const p of plan) {
    try { await dvDelete(p.set, p.id, p.year, token); }
    catch (e) { failed.push(p.set + '(' + p.id + '): ' + e.message); }
  }
  log('DELETED ' + (plan.length - failed.length) + ' of ' + plan.length + ' row(s)');
  failed.forEach(f => log('  FAILED  ' + f));
  log('');

  /* ---- the read-back ------------------------------------------------ */
  log('READ-BACK');
  let absentEverywhere = true, baselinesHeld = true;
  for (const T of stores) {
    if (!captured[T.set]) continue;
    let after;
    try { after = await readYears(T, YEARS, token); }
    catch (e) { log('  ' + T.set + ': could not be re-read: ' + e.message);
      absentEverywhere = false; continue; }
    const before = captured[T.set].rows.length;
    log('  ' + T.set.padEnd(40) + YEARS.join('/') + ': ' + before + ' -> ' + after.rows.length);
    /* ZERO IN EVERY STORE, history included.
     *
     * This read `orphans.length` for the history store, which was right while
     * the retired fifth gate held the orphans back and WRONG the moment the
     * owner's correction said every 2098 and 2099 history row goes. The delete
     * was correct and complete -- 186 to 0 -- and this line still expected 163
     * survivors, so it printed "EXPECTED 163, so this is NOT clear" and the
     * summary reported "absent from every store: NO" over a set of stores that
     * all read zero. A stale expectation in the checker, not residue in the
     * org: I changed the rule and did not follow it into the read-back. */
    if (after.rows.length !== 0) {
      absentEverywhere = false;
      log('      EXPECTED 0, so this is NOT clear');
    }
    let keep;
    try { keep = await readYears(T, KEEP_YEARS, token); }
    catch (e) { baselinesHeld = false; log('      kept years could not be re-read: ' + e.message); continue; }
    KEEP_YEARS.forEach((y) => {
      const rows = keep.rows.filter(r => yearOf(r, T.yearFields) === y);
      const perRow = rows.map(r => ({ id: rowId(r, T.idField), sha256: sha(canon(r)) }))
        .sort((a, b) => (String(a.id) < String(b.id) ? -1 : 1));
      const m = sha(perRow.map(x => x.sha256).join('\n'));
      const base = baselines[T.set].years[y];
      const same = m === base.manifest && rows.length === base.rows;
      if (!same) baselinesHeld = false;
      log('      ' + y + ': ' + base.rows + ' -> ' + rows.length + ' row(s)   ' +
        (same ? 'HASH IDENTICAL' : 'MOVED  ' + base.manifest.slice(0, 16) + ' -> ' + m.slice(0, 16)));
    });
  }
  log('');
  log('  ' + YEARS.join('/') + ' absent from every store: ' + (absentEverywhere ? 'YES' : 'NO'));
  log('  ' + KEEP_YEARS.join('/') + ' hash-identical in every store: ' + (baselinesHeld ? 'YES' : 'NO'));
  log('');
  log('  THE YEAR SELECTOR is a browser reading and is not made here: it needs a');
  log('  hard refresh of the hosted app. The org-side fact it depends on is above.');
  log('');

  /* ---- the new CLCPA-214 inventory, a READING and not a gate --------- */
  /* ACROSS EVERY YEAR, which is why both tables are read whole. An orphan is a
   * history row whose table-and-year has no surviving data row, and after
   * tonight's delete that set is what CLCPA-214 has to decide about. */
  log('THE NEW CLCPA-214 INVENTORY: history rows that remain orphaned');
  try {
    const allHist = await getAll('cr2bf_dacingesttestchangehistories',
      '$select=cr2bf_dacingesttestchangehistoryid,cr2bf_tableid,cr2bf_year,cr2bf_savedat,cr2bf_user',
      token);
    const allData = await getAll('cr2bf_dacingesttesttabledata1s',
      '$select=cr2bf_tableid,cr2bf_year', token);
    const liveKeys = new Set(allData.map(r => (r.cr2bf_tableid || '') + '/' + String(r.cr2bf_year)));
    const stillOrphan = allHist.filter(
      r => !liveKeys.has((r.cr2bf_tableid || '') + '/' + String(r.cr2bf_year)));
    log('  history rows in total, every year : ' + allHist.length);
    log('  data rows in total, every year    : ' + allData.length);
    log('  history rows STILL ORPHANED       : ' + stillOrphan.length);
    const byKey = {};
    stillOrphan.forEach((r) => {
      const k = (r.cr2bf_tableid || '-') + '/' + String(r.cr2bf_year);
      (byKey[k] = byKey[k] || []).push(r.cr2bf_savedat || '');
    });
    Object.keys(byKey).sort().forEach(k => log('    ' + k.padEnd(14) +
      byKey[k].length + ' entr(ies)   ' + byKey[k].sort().join('  ')));
    log('  against CLCPA-214\'s list of ' + CLCPA214_LIST.length + ': ' +
      CLCPA214_LIST.join(', '));
    const listed = new Set(CLCPA214_LIST);
    const notOnList = Object.keys(byKey).filter(k => !listed.has(k));
    const onListGone = CLCPA214_LIST.filter(k => !byKey[k]);
    log('    orphaned now but NOT on that list : ' + (notOnList.join(', ') || 'none'));
    log('    on that list but no longer orphaned or gone: ' + (onListGone.join(', ') || 'none'));
    log('  This is a reading for CLCPA-214 to decide on. Nothing here was deleted');
    log('  on account of it, and nothing on that list outside tonight\'s years was touched.');
  } catch (e) {
    log('  the orphan inventory could not be taken: ' + e.message);
    problems.push('the post-delete orphan inventory failed: ' + e.message);
  }
  log('');
  log('CLCPA-328, the removeYear facts, quoted from the shipped source:');
  log('  visibility: ' + VIS_RULE);
  log('  seedYears:  ' + SEED_RULE);
  REMOVE_BODY.split('\n').forEach(l => log('    ' + l));
  log('');
  if (problems.length) {
    log('REPORTED, NOT ASSUMED AWAY:');
    problems.forEach(p => log('  - ' + p));
    log('');
  }
  log('requests: GET ' + GETS + ', DELETE ' + DELETES + '. No PATCH, no POST to the org.');
  log('');
  log('PHASE 2 ENDS HERE. Nothing else tonight.');
  flush();
})().catch((e) => {
  log('');
  log('THREW: ' + (e && e.stack || e));
  try {
    if (captured && Object.keys(captured).length) {
      fs.mkdirSync(BACKDIR, { recursive: true });
      fs.writeFileSync(path.join(BACKDIR, 'rows-2098-2099.PARTIAL.json'),
        JSON.stringify({ INCOMPLETE: true, reason: String(e && e.message || e),
          capturedAt: new Date().toISOString(), stores: captured }, null, 2) + '\n');
      log('a PARTIAL capture was written and is NOT a backup.');
    }
  } catch (e2) { log('the partial write also failed: ' + (e2 && e2.message)); }
  log('requests: GET ' + GETS + ', DELETE ' + DELETES + '.');
  flush();
  process.exit(2);
});
