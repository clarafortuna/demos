/* CLCPA-238 STEP 4, part 2 of 3: THE FOUR PRE-FLIGHT CHECKS AND THE BACKUP.
 *
 * READ-ONLY BY CONSTRUCTION. Self-checked before the network: no PATCH, POST,
 * DELETE or PUT against the org anywhere in this file. The backup it exports is
 * the rollback artifact, and it must be committed and pushed BEFORE any write
 * happens -- which is why the writing is a separate script, part 3.
 *
 * THE FOUR GATES, as ruled:
 *   1. the prvRead names for the three new tables, READ from metadata via
 *      $select=Privileges. Never composed. My step-3 attempt used
 *      $expand=Privileges and got a 400, so the strings were reported MISSING
 *      rather than guessed; this is the corrected read.
 *   2. the integer bounds of cr2bf_number verified against the printed payload
 *      (MinValue 0, MaxValue 999). Step 3 verified its TYPE but not its bounds,
 *      because the compare loop only checked MaxLength, which integers do not
 *      have. That gap is closed here.
 *   3. solution membership confirmed via solutioncomponents for all three
 *      tables AND both new columns. Anything in Default instead of
 *      CLCPADACDashboard is a half-state to NAME, not to seed on top of.
 *   4. row counts of all four target tables at their expected pre-seed state.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ORG = 'https://org9076e69b.crm.dynamics.com';
const API = ORG + '/api/data/v9.2/';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d';
const TENANT = 'organizations';
const SOLUTION = 'CLCPADACDashboard';
const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const BACKDIR = REPO + '/deploy-backups/2026-09-08-clcpa238-pre-seed';

const TARGETS = [
  { logical: 'cr2bf_dacingesttesttabledata1', set: 'cr2bf_dacingesttesttabledata1s',
    id: 'cr2bf_dacingesttesttabledata1id', expect: 2, file: 'tabledata.json' },
  { logical: 'cr2bf_dacreporttable', set: 'cr2bf_dacreporttables',
    id: 'cr2bf_dacreporttableid', expect: 0, file: 'reporttable.json' },
  { logical: 'cr2bf_dacreportsection', set: 'cr2bf_dacreportsections',
    id: 'cr2bf_dacreportsectionid', expect: 0, file: 'reportsection.json' },
  { logical: 'cr2bf_dacreportmetric', set: 'cr2bf_dacreportmetrics',
    id: 'cr2bf_dacreportmetricid', expect: 0, file: 'reportmetric.json' },
];
const NEW_TABLES = ['cr2bf_dacreporttable', 'cr2bf_dacreportsection', 'cr2bf_dacreportmetric'];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
function flush(tail) {
  if (tail) lines.push('', tail);
  try {
    fs.mkdirSync(BACKDIR, { recursive: true });
    fs.writeFileSync(path.join(BACKDIR, 'preflight.log'), lines.join('\n') + '\n');
  } catch (e) { /* console is still the record */ }
  try { fs.writeFileSync(path.join(__dirname, 'preflight_238.log'), lines.join('\n') + '\n'); }
  catch (e) {}
}
const stop = (m) => {
  log(''); log('##################################################################');
  log('STOP: ' + m);
  log('##################################################################');
  log('Nothing was written. This script cannot write.');
  flush('ABORTED'); process.exit(1);
};
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
let GETS = 0;
let GATES = 0, GATEFAIL = 0;
const gate = (c, m) => {
  GATES++;
  if (c) log('  ok   ' + m); else { GATEFAIL++; log('  FAIL ' + m); }
  return !!c;
};

/* ---- self-check, before the network ---------------------------------- */
{
  const body = fs.readFileSync(__filename, 'utf8');
  const Q = String.fromCharCode(39);
  const banned = ['PAT' + 'CH', 'DELE' + 'TE', 'P' + 'UT'];
  const found = banned.filter(v => body.indexOf(Q + v + Q) >= 0 || body.indexOf('"' + v + '"') >= 0);
  if (found.length) { console.error('STOP: contains ' + found.join(', ')); process.exit(1); }
  const posts = body.split('method: ' + Q + 'PO' + 'ST' + Q).length - 1;
  const logins = body.split('fetch(' + Q + 'https://login.microsoftonline.com/').length - 1;
  if (posts !== 2 || logins !== 2) {
    console.error('STOP: expected 2 POSTs both to the login host; found ' + posts + '/' + logins);
    process.exit(1);
  }
  if (/fetch\(API[^)]*method/.test(body)) { console.error('STOP: an org request carries a method'); process.exit(1); }
  log('SELF-CHECK  no ' + banned.join('/') + '; the only 2 POSTs go to the login');
  log('            host; no org request carries a method. Read-only.');
  log('');
}

log('======================================================================');
log('CLCPA-238 STEP 4 part 2: pre-flight gates and the backup');
log('  org: ' + ORG);
log('======================================================================');

async function deviceCode() {
  const res = await fetch('https://login.microsoftonline.com/' + TENANT + '/oauth2/v2.0/devicecode', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: ORG + '/.default offline_access' }),
  });
  const j = await res.json();
  if (!res.ok) stop('device code request failed: ' + JSON.stringify(j));
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
    if (j.error === 'expired_token') stop('the device code expired.');
    if (j.error === 'authorization_declined') stop('sign-in was declined.');
    stop('token poll failed: ' + JSON.stringify(j));
  }
  stop('timed out waiting for authorization.');
}

let TOKEN = null;
async function get(url, extra) {
  GETS++;
  const res = await fetch(API + url, { headers: Object.assign({
    Authorization: 'Bearer ' + TOKEN, Accept: 'application/json',
    'OData-MaxVersion': '4.0', 'OData-Version': '4.0' }, extra || {}) });
  const txt = await res.text();
  return { ok: res.ok, status: res.status, text: txt,
           json: (() => { try { return JSON.parse(txt); } catch (e) { return null; } })() };
}
async function getAll(url) {
  const out = [];
  let r = await get(url);
  if (!r.ok) return { ok: false, status: r.status, text: r.text };
  if (r.json.value) out.push.apply(out, r.json.value);
  let next = r.json['@odata.nextLink'];
  while (next) {
    GETS++;
    const res = await fetch(next, { headers: {
      Authorization: 'Bearer ' + TOKEN, Accept: 'application/json',
      'OData-MaxVersion': '4.0', 'OData-Version': '4.0' } });
    if (!res.ok) break;
    const j = await res.json();
    if (j.value) out.push.apply(out, j.value);
    next = j['@odata.nextLink'];
  }
  return { ok: true, value: out };
}

(async () => {
  const dc = await deviceCode();
  log(['', '################  ACTION NEEDED  ################',
       '  Open:  ' + dc.verification_uri, '  Code:  ' + dc.user_code,
       '#################################################', ''].join('\n'));
  fs.writeFileSync(path.join(__dirname, 'device_code.txt'), dc.user_code + '\n' + dc.verification_uri + '\n');
  log('Waiting for authorization...');
  TOKEN = await pollToken(dc.device_code, dc.interval, dc.expires_in);
  log('Authorized. Every org request below is a GET.');
  log('');

  const who = await get('WhoAmI');
  if (!who.ok) stop('WhoAmI failed ' + who.status);
  log('WhoAmI UserId = ' + who.json.UserId);

  /* =================================================================
   * GATE 1: the prvRead names, READ not composed
   * ================================================================= */
  log('');
  log('======================================================================');
  log('GATE 1  the prvRead privilege names, read via $select=Privileges');
  log('======================================================================');
  const PRIV = {};
  for (const t of NEW_TABLES) {
    const r = await get("EntityDefinitions(LogicalName='" + t + "')" +
      '?$select=LogicalName,SchemaName,EntitySetName,Privileges');
    if (!r.ok) { gate(false, t + ': privileges unreadable (' + r.status + ') ' +
      String(r.text || '').slice(0, 160)); continue; }
    const all = r.json.Privileges || [];
    const read = all.filter(p => /^prvRead/i.test(p.Name || ''));
    PRIV[t] = { entitySet: r.json.EntitySetName, schema: r.json.SchemaName,
                privileges: all.map(p => p.Name).sort(), read: read.map(p => p.Name) };
    log('  ' + t + '   (EntitySetName ' + r.json.EntitySetName + ')');
    all.slice().sort((a, b) => String(a.Name).localeCompare(String(b.Name)))
      .forEach(p => log('      ' + String(p.Name).padEnd(42) +
        ' basic=' + p.CanBeBasic + ' local=' + p.CanBeLocal +
        ' deep=' + p.CanBeDeep + ' global=' + p.CanBeGlobal));
    gate(read.length === 1, t + ': exactly one prvRead name, read from metadata: ' +
      (read.map(p => p.Name).join(',') || 'NONE'));
  }

  /* =================================================================
   * GATE 2: the integer bounds of cr2bf_number
   * ================================================================= */
  log('');
  log('======================================================================');
  log('GATE 2  cr2bf_number bounds, the step-3 verification gap');
  log('======================================================================');
  {
    const r = await get("EntityDefinitions(LogicalName='cr2bf_dacreporttable')/Attributes" +
      '/Microsoft.Dynamics.CRM.IntegerAttributeMetadata' +
      '?$select=LogicalName,MinValue,MaxValue');
    if (!r.ok) gate(false, 'cannot read integer attributes: ' + r.status);
    else {
      const n = (r.json.value || []).find(a => a.LogicalName === 'cr2bf_number');
      if (!n) gate(false, 'cr2bf_number is not an integer attribute');
      else {
        log('  cr2bf_number  MinValue ' + n.MinValue + '  MaxValue ' + n.MaxValue);
        log('  printed payload said   MinValue 0    MaxValue 999');
        gate(n.MinValue === 0 && n.MaxValue === 999,
          'the bounds match what step 3 printed');
      }
    }
  }

  /* =================================================================
   * GATE 3: solution membership for 3 tables AND 2 columns
   * ================================================================= */
  log('');
  log('======================================================================');
  log('GATE 3  solution membership. Default instead of ' + SOLUTION + ' is a');
  log('        half-state to NAME, not to seed on top of.');
  log('======================================================================');
  {
    /* componenttype 1 = Entity, 2 = Attribute */
    const want = [];
    for (const t of NEW_TABLES) {
      const md = await get("EntityDefinitions(LogicalName='" + t + "')?$select=MetadataId");
      if (!md.ok) { gate(false, 'cannot read MetadataId for ' + t); continue; }
      want.push({ label: t, type: 1, id: md.json.MetadataId });
    }
    const cols = await get("EntityDefinitions(LogicalName='cr2bf_dacingesttesttabledata1')" +
      '/Attributes?$select=LogicalName,MetadataId');
    if (!cols.ok) gate(false, 'cannot read tabledata1 attributes: ' + cols.status);
    else {
      ['cr2bf_schema', 'cr2bf_title'].forEach(ln => {
        const a = (cols.json.value || []).find(x => x.LogicalName === ln);
        if (!a) gate(false, 'column ' + ln + ' not found on tabledata1');
        else want.push({ label: 'cr2bf_dacingesttesttabledata1.' + ln, type: 2, id: a.MetadataId });
      });
      /* and report whether the presentation column exists yet, because the
       * offline generator now produces a value for it */
      const pres = (cols.json.value || []).find(x => x.LogicalName === 'cr2bf_presentation');
      log('  (cr2bf_presentation on cr2bf_dacreporttable is checked separately below)');
    }
    for (const w of want) {
      const r = await get('solutioncomponents?$select=componenttype,objectid' +
        '&$filter=componenttype eq ' + w.type + " and objectid eq " + w.id +
        '&$expand=solutionid($select=uniquename)');
      if (!r.ok) { gate(false, w.label + ': solutioncomponents unreadable ' + r.status); continue; }
      const sols = (r.json.value || []).map(v => v.solutionid && v.solutionid.uniquename)
        .filter(Boolean);
      const inTarget = sols.indexOf(SOLUTION) >= 0;
      const inDefault = sols.some(s => s === 'Default' || s === 'Cr80881');
      log('  ' + w.label.padEnd(48) + ' solutions: ' + (sols.join(', ') || 'NONE'));
      gate(inTarget, w.label + ' is in ' + SOLUTION +
        (inDefault && !inTarget ? '  <- IT IS IN DEFAULT INSTEAD' : ''));
    }
  }

  /* the presentation column, which the offline generator now needs */
  log('');
  log('  THE NEW FINDING from part 1: cr2bf_presentation on cr2bf_dacreporttable');
  {
    const r = await get("EntityDefinitions(LogicalName='cr2bf_dacreporttable')/Attributes" +
      '?$select=LogicalName,AttributeType');
    if (!r.ok) log('    cannot read: ' + r.status);
    else {
      const names = (r.json.value || []).map(a => a.LogicalName);
      const has = names.indexOf('cr2bf_presentation') >= 0;
      log('    cr2bf_presentation exists: ' + has +
        (has ? '' : '   <- the seed needs it; schema addendum awaiting GO'));
      log('    custom columns present: ' + names.filter(n => /^cr2bf_/.test(n)).sort().join(', '));
    }
  }

  /* =================================================================
   * GATE 4: pre-seed row counts
   * ================================================================= */
  log('');
  log('======================================================================');
  log('GATE 4  pre-seed row counts');
  log('======================================================================');
  const dumps = {};
  for (const t of TARGETS) {
    const r = await getAll(t.set + '?$count=true');
    if (!r.ok) { gate(false, t.set + ': unreadable ' + r.status); continue; }
    dumps[t.file] = r.value;
    log('  ' + t.set.padEnd(38) + String(r.value.length).padStart(4) + ' rows  (expected ' +
      t.expect + ')');
    gate(r.value.length === t.expect, t.logical + ' is at its expected pre-seed count');
  }

  /* =================================================================
   * THE BACKUP: every row of every affected table. This is the rollback
   * artifact and it is committed and pushed BEFORE part 3 writes anything.
   * ================================================================= */
  log('');
  log('======================================================================');
  log('THE BACKUP -- the rollback artifact');
  log('======================================================================');
  fs.mkdirSync(BACKDIR, { recursive: true });
  const manifest = { org: ORG, capturedAt: new Date().toISOString(),
    capturedBy: who.json.UserId, solution: SOLUTION,
    note: 'CLCPA-238 step 4 PRE-SEED snapshot: every row of all four target ' +
          'tables as they were before the seed. Restore a row by re-creating ' +
          'it from its saved fields; delete a seeded row to undo the seed. ' +
          'Three of the four tables were empty, which is itself the fact that ' +
          'makes the seed reversible: undoing it means deleting what it added.',
    tables: [] };
  for (const t of TARGETS) {
    const rows = dumps[t.file] || [];
    const txt = JSON.stringify(rows, null, 2);
    fs.writeFileSync(path.join(BACKDIR, t.file), txt);
    manifest.tables.push({ set: t.set, logical: t.logical, idField: t.id,
      records: rows.length, file: t.file, bytes: Buffer.byteLength(txt), sha256: sha(txt) });
    log('  ' + t.file.padEnd(22) + String(rows.length).padStart(4) + ' rows  ' +
      String(Buffer.byteLength(txt)).padStart(8) + ' B  sha256 ' + sha(txt).slice(0, 16));
  }
  /* the privilege facts travel with the backup, so the Randy note has a source */
  fs.writeFileSync(path.join(BACKDIR, 'privileges.json'), JSON.stringify(PRIV, null, 2));
  manifest.privilegeFile = 'privileges.json';
  fs.writeFileSync(path.join(BACKDIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  log('  privileges.json        the prvRead names as READ from metadata');
  log('  manifest.json          counts and sha256 per file');

  log('');
  log('======================================================================');
  log('  gates: ' + (GATES - GATEFAIL) + ' passed, ' + GATEFAIL + ' failed, of ' + GATES);
  log('  requests: GET ' + GETS + '. Nothing was written.');
  log('======================================================================');
  flush();
  process.exitCode = GATEFAIL ? 1 : 0;
})().catch(e => { log('UNCAUGHT: ' + (e && e.stack || e)); flush('ABORTED'); process.exit(1); });
