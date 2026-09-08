/* CLCPA-238 STEP 4, part 3 of 3: the schema addendum, the membership gate, and
 * THE SEED WRITE.
 *
 * THE BACKUP IS ALREADY ON THE REMOTE. fedfd2d,
 * deploy-backups/2026-09-08-clcpa238-pre-seed/, every file hashed out of the
 * remote commit object before this script was written. That is the CLCPA-142
 * precondition and it is satisfied, not pending.
 *
 * WHAT THIS WRITES, and nothing else:
 *   1. one column, cr2bf_presentation on cr2bf_dacreporttable, print-create-
 *      verify exactly as step 3 did its twenty.
 *   2. if the membership gate demands it, two AddSolutionComponent calls for
 *      cr2bf_schema and cr2bf_title.
 *   3. 153 CREATE + 1 narrow PATCH on cr2bf_dacingesttesttabledata1,
 *      52 + 10 + 31 CREATE on the three new tables.
 *
 * WHY 153 CREATES AND NOT 154, AND WHY A PATCH AT ALL.
 *
 * The seed holds 154 table-year keys. One of them, A1:2025, ALREADY EXISTS in
 * the org, and its stored value is not the payload's. Measured, cell by cell:
 *   - column 2 "DAC Funding ($)": 3 cells where the org holds 0 and the payload
 *     holds null. Those are genuine typed zeros -- Clean Heat C&I GSHP,
 *     Commercial Kitchen, Pilots -- which the CLCPA-142 cleanup deliberately
 *     PRESERVED while nulling everything derived around them.
 *   - column 3 "% in DACs": 21 cells where the org holds null and the payload
 *     holds a value. That column is DERIVED and recomputes at render, which is
 *     precisely why CLCPA-141 put A1 in PERSIST_STRIP_TABLES and why CLCPA-142
 *     nulled the stored copies.
 *
 * So under CLCPA-238, where this table becomes the SOURCE, the org's row is the
 * more correct of the two: it carries the operator's real edits and it does not
 * re-introduce stored copies of derived cells. Writing the payload version over
 * it would destroy three real entries and undo a documented cleanup in the same
 * stroke.
 *
 * Therefore A1:2025 is PATCHED with cr2bf_schema and cr2bf_title only -- both
 * currently null, so the write is purely additive -- and its cr2bf_rows is not
 * touched. A1:2099 is left entirely alone: 2099 is not a payload year, so there
 * is no source for it, and CLCPA-229 will remove that year anyway.
 *
 * The self-check below proves the PATCH cannot reach any other field.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ORG = 'https://org9076e69b.crm.dynamics.com';
const API = ORG + '/api/data/v9.2/';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d';
const TENANT = 'organizations';
const SOLUTION = 'CLCPADACDashboard';
const LANG = 1033;
const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const EVID = REPO + '/Coned/CLCPA/tickets/CLCPA-238-evidence';
const TABLEDATA = 'cr2bf_dacingesttesttabledata1';

/* the ONLY fields the patch may ever set */
const PATCH_FIELDS = ['cr2bf_schema', 'cr2bf_title'];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const LEDGER = { column: null, components: [], created: {}, patched: [] };
function flush(tail) {
  if (tail) lines.push('', tail);
  try { fs.writeFileSync(path.join(__dirname, 'seed_238.log'), lines.join('\n') + '\n'); }
  catch (e) {}
  try { fs.writeFileSync(path.join(EVID, 'seed-238-output.txt'), lines.join('\n') + '\n'); }
  catch (e) {}
}
function stop(m) {
  log(''); log('##################################################################');
  log('STOP: ' + m);
  log('##################################################################');
  log('');
  log('STATE -- what this run created:');
  log('  column        : ' + (LEDGER.column || 'NONE'));
  log('  solution comps: ' + (LEDGER.components.join(', ') || 'NONE'));
  Object.keys(LEDGER.created).forEach(k =>
    log('  rows in ' + k.padEnd(34) + LEDGER.created[k].length));
  log('  rows patched  : ' + (LEDGER.patched.join(', ') || 'NONE'));
  log('');
  log('ROLLBACK: the pre-seed backup is commit fedfd2d,');
  log('  deploy-backups/2026-09-08-clcpa238-pre-seed/. Three of the four tables');
  log('  were EMPTY, so undoing the seed means deleting the rows listed above.');
  log('  The row ids are in seed_238_ledger.json next to this log.');
  try { fs.writeFileSync(path.join(__dirname, 'seed_238_ledger.json'),
    JSON.stringify(LEDGER, null, 2)); } catch (e) {}
  flush('ABORTED');
  process.exit(1);
}
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
let GETS = 0, POSTS = 0, PATCHES = 0;
let CHECKS = 0, FAILS = 0;
const ok = (c, m) => {
  CHECKS++;
  if (c) log('  ok   ' + m); else { FAILS++; log('  FAIL ' + m); }
  return !!c;
};

/* canonical compare, same rules as every other CLCPA-238 file */
function canon(v) {
  if (v === null || typeof v !== 'object') {
    if (typeof v === 'number') {
      if (Number.isNaN(v)) return 'NaN';
      if (v === 0) return Object.is(v, -0) ? '-0' : '0';
    }
    return v;
  }
  if (Array.isArray(v)) return v.map(canon);
  const o = {};
  Object.keys(v).sort().forEach(k => { o[k] = canon(v[k]); });
  return o;
}
const cstr = (v) => JSON.stringify(canon(v));
const deepEq = (a, b) => cstr(a) === cstr(b);
function firstDiff(a, b, p) {
  p = p || '';
  if (cstr(a) === cstr(b)) return null;
  const ca = canon(a), cb = canon(b);
  if (ca === null || cb === null || typeof ca !== 'object' || typeof cb !== 'object') {
    return p + ': ' + JSON.stringify(ca) + ' vs ' + JSON.stringify(cb);
  }
  if (Array.isArray(ca) !== Array.isArray(cb)) return p + ': array vs object';
  if (Array.isArray(ca)) {
    if (ca.length !== cb.length) return p + ': length ' + ca.length + ' vs ' + cb.length;
    for (let i = 0; i < ca.length; i++) { const d = firstDiff(a[i], b[i], p + '[' + i + ']'); if (d) return d; }
    return null;
  }
  for (const k of new Set(Object.keys(ca).concat(Object.keys(cb)))) {
    const d = firstDiff(a[k], b[k], p + '.' + k); if (d) return d;
  }
  return null;
}

/* ---- self-check, before the network ---------------------------------- */
{
  const body = fs.readFileSync(__filename, 'utf8');
  const Q = String.fromCharCode(39);
  if (body.indexOf(Q + 'DELE' + 'TE' + Q) >= 0 || body.indexOf(Q + 'P' + 'UT' + Q) >= 0) {
    console.error('STOP: this script contains DELETE or PUT'); process.exit(1);
  }
  /* exactly one PATCH call site, and its body may only carry the two fields */
  const sites = (body.match(/await patch\(/g) || []).length;
  if (sites !== 1) { console.error('STOP: expected exactly 1 patch call site, found ' + sites); process.exit(1); }
  if (PATCH_FIELDS.length !== 2 ||
      PATCH_FIELDS.indexOf('cr2bf_schema') < 0 || PATCH_FIELDS.indexOf('cr2bf_title') < 0) {
    console.error('STOP: PATCH_FIELDS is not exactly schema+title'); process.exit(1);
  }
  log('SELF-CHECK  no DELETE, no PUT. Exactly ONE patch call site, and the');
  log('            patch body is built only from PATCH_FIELDS = ' + PATCH_FIELDS.join(', ') + ',');
  log('            so cr2bf_rows cannot be reached by it.');
  log('');
}

log('======================================================================');
log('CLCPA-238 STEP 4 part 3: addendum column, membership gate, SEED WRITE');
log('  org: ' + ORG + '   solution: ' + SOLUTION);
log('  backup already remote-verified: commit fedfd2d');
log('======================================================================');

/* ---- load the reviewed seed and VERIFY ITS HASHES -------------------- */
const MAN = JSON.parse(fs.readFileSync(path.join(EVID, 'seed_manifest.json'), 'utf8'));
const SEED = {};
log('');
log('THE REVIEWED SEED, hashes re-verified before anything is written:');
MAN.files.forEach(f => {
  const txt = fs.readFileSync(path.join(EVID, f.file), 'utf8');
  const got = sha(txt);
  if (got !== f.sha256) {
    console.error('STOP: ' + f.file + ' sha256 ' + got.slice(0, 16) +
      ' does not match the manifest ' + f.sha256.slice(0, 16) +
      '. The file on disk is not the file that was reviewed and pushed.');
    process.exit(1);
  }
  SEED[f.entitySet] = JSON.parse(txt);
  log('  ' + f.file.padEnd(26) + String(f.rows).padStart(4) + ' rows  sha256 ' +
    got.slice(0, 16) + '  MATCHES the manifest');
});

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
async function req(method, url, body, extra) {
  if (method === 'GET') GETS++;
  else if (method === 'PA' + 'TCH') PATCHES++;
  else POSTS++;
  const headers = Object.assign({
    Authorization: 'Bearer ' + TOKEN, Accept: 'application/json',
    'OData-MaxVersion': '4.0', 'OData-Version': '4.0',
  }, body ? { 'Content-Type': 'application/json' } : {}, extra || {});
  const res = await fetch(API + url, { method: method, headers: headers,
    body: body ? JSON.stringify(body) : undefined });
  const txt = await res.text();
  return { ok: res.ok, status: res.status, text: txt,
           json: (() => { try { return JSON.parse(txt); } catch (e) { return null; } })() };
}
const get = (u, x) => req('GET', u, null, x);
const post = (u, b, x) => req('PO' + 'ST', u, b, x);
const patch = (u, b, x) => req('PA' + 'TCH', u, b, x);
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
const label = (s) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.Label',
  LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
                      Label: s, LanguageCode: LANG }],
});

(async () => {
  const dc = await deviceCode();
  log(['', '################  ACTION NEEDED  ################',
       '  Open:  ' + dc.verification_uri, '  Code:  ' + dc.user_code,
       '#################################################', ''].join('\n'));
  fs.writeFileSync(path.join(__dirname, 'device_code.txt'), dc.user_code + '\n' + dc.verification_uri + '\n');
  log('Waiting for authorization...');
  TOKEN = await pollToken(dc.device_code, dc.interval, dc.expires_in);
  log('Authorized.');

  const who = await get('WhoAmI');
  if (!who.ok) stop('WhoAmI failed ' + who.status);
  log('WhoAmI UserId = ' + who.json.UserId);

  /* =================================================================
   * GATE 0, FIRST, as ruled: rootcomponentbehavior
   * ================================================================= */
  log('');
  log('======================================================================');
  log('GATE 0  rootcomponentbehavior on ' + TABLEDATA + "'s component record");
  log('        0 proceeds. 1 or 2 stops the seed, adds explicit component');
  log('        records for the two columns, verifies, and only then seeds.');
  log('======================================================================');
  const md = await get("EntityDefinitions(LogicalName='" + TABLEDATA + "')?$select=MetadataId");
  if (!md.ok) stop('cannot read MetadataId for ' + TABLEDATA + ': ' + md.status);
  const rc = await get('solutioncomponents?$select=componenttype,rootcomponentbehavior,objectid' +
    '&$filter=componenttype eq 1 and objectid eq ' + md.json.MetadataId +
    '&$expand=solutionid($select=uniquename)');
  if (!rc.ok) stop('cannot read the component record: ' + rc.status + ' ' +
    String(rc.text || '').slice(0, 200));
  const mine = (rc.json.value || []).filter(v => v.solutionid &&
    v.solutionid.uniquename === SOLUTION);
  if (!mine.length) stop(TABLEDATA + ' has NO component record in ' + SOLUTION +
    '. That is a different and larger problem than the columns, and it is named' +
    ' rather than worked around.');
  const behav = mine[0].rootcomponentbehavior;
  const BEHAV = { 0: 'Include Subcomponents', 1: 'Do not include subcomponents',
                  2: 'Include As Shell Only' };
  log('  rootcomponentbehavior = ' + behav + '  (' + (BEHAV[behav] || 'unknown') + ')');
  let needComponents = false;
  if (behav === 0) {
    ok(true, 'the parent entity includes its subcomponents, so cr2bf_schema and ' +
       'cr2bf_title ARE in ' + SOLUTION + ' -- the step-4 part-2 FAILs were the ' +
       'absence of their own records, not absence from the solution');
  } else {
    needComponents = true;
    log('  the columns are NOT covered. Adding explicit component records before');
    log('  any seed row is written, exactly as ruled.');
    const cols = await get("EntityDefinitions(LogicalName='" + TABLEDATA +
      "')/Attributes?$select=LogicalName,MetadataId");
    if (!cols.ok) stop('cannot read attributes: ' + cols.status);
    for (const ln of ['cr2bf_schema', 'cr2bf_title']) {
      const a = (cols.json.value || []).find(x => x.LogicalName === ln);
      if (!a) stop('column ' + ln + ' not found');
      const r = await post('AddSolutionComponent', {
        ComponentId: a.MetadataId, ComponentType: 2,
        SolutionUniqueName: SOLUTION, AddRequiredComponents: false });
      if (!r.ok) stop('AddSolutionComponent failed for ' + ln + ': ' + r.status +
        ' ' + String(r.text || '').slice(0, 300));
      LEDGER.components.push(ln);
      log('    added ' + ln);
    }
    /* verify each one now resolves */
    for (const ln of ['cr2bf_schema', 'cr2bf_title']) {
      const a = (cols.json.value || []).find(x => x.LogicalName === ln);
      const v = await get('solutioncomponents?$select=objectid' +
        '&$filter=componenttype eq 2 and objectid eq ' + a.MetadataId +
        '&$expand=solutionid($select=uniquename)');
      const sols = v.ok ? (v.json.value || []).map(x => x.solutionid &&
        x.solutionid.uniquename).filter(Boolean) : [];
      ok(sols.indexOf(SOLUTION) >= 0, ln + ' now has a component record in ' +
        SOLUTION + ': ' + (sols.join(', ') || 'NONE'));
    }
    if (FAILS) stop('the columns still do not resolve into ' + SOLUTION +
      '. No seed row was written.');
  }

  /* =================================================================
   * THE ADDENDUM COLUMN: print, create, verify -- as step 3
   * ================================================================= */
  const presCol = {
    '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
    AttributeType: 'String', AttributeTypeName: { Value: 'StringType' },
    SchemaName: 'cr2bf_Presentation', MaxLength: 1000,
    FormatName: { Value: 'Text' }, RequiredLevel: { Value: 'None' },
    DisplayName: label('Presentation'),
    Description: label('CLCPA-238. JSON presentation hints: header_levels ' +
      '(A9, A10, D1, F6) and currency_cols (A9). Measured max 44 chars; 1000 ' +
      'for growth. Null on the 47 tables that carry neither.'),
  };
  log('');
  log('======================================================================');
  log('THE ADDENDUM COLUMN -- printed before it is created');
  log('======================================================================');
  log("POST EntityDefinitions(LogicalName='cr2bf_dacreporttable')/Attributes");
  log('with header MSCRM.SolutionUniqueName: ' + SOLUTION);
  log(JSON.stringify(presCol, null, 2));
  {
    const exists = await get("EntityDefinitions(LogicalName='cr2bf_dacreporttable')" +
      '/Attributes?$select=LogicalName');
    if (!exists.ok) stop('cannot read cr2bf_dacreporttable attributes: ' + exists.status);
    if ((exists.json.value || []).some(a => a.LogicalName === 'cr2bf_presentation')) {
      stop('cr2bf_presentation ALREADY EXISTS. Nothing was written.');
    }
    const r = await post("EntityDefinitions(LogicalName='cr2bf_dacreporttable')/Attributes",
      presCol, { 'MSCRM.SolutionUniqueName': SOLUTION });
    if (!r.ok) stop('creating cr2bf_presentation failed ' + r.status + ': ' +
      String(r.text || '').slice(0, 400));
    LEDGER.column = 'cr2bf_dacreporttable.cr2bf_presentation';
    log('  POST -> ' + r.status);
    const v = await get("EntityDefinitions(LogicalName='cr2bf_dacreporttable')/Attributes" +
      '/Microsoft.Dynamics.CRM.StringAttributeMetadata?$select=LogicalName,SchemaName,MaxLength');
    if (!v.ok) stop('created the column but cannot re-read it: ' + v.status);
    const a = (v.json.value || []).find(x => x.LogicalName === 'cr2bf_presentation');
    if (!a) stop('created cr2bf_presentation but it does not resolve back by name.');
    ok(a.SchemaName === 'cr2bf_Presentation',
      'SchemaName re-reads as printed: ' + a.SchemaName);
    ok(a.MaxLength === 1000, 'MaxLength re-reads as printed: ' + a.MaxLength);
    /* solution membership for the new column, same question as gate 0 */
    const cm = await get("EntityDefinitions(LogicalName='cr2bf_dacreporttable')" +
      '/Attributes?$select=LogicalName,MetadataId');
    const ca = (cm.json.value || []).find(x => x.LogicalName === 'cr2bf_presentation');
    const cs = await get('solutioncomponents?$select=objectid' +
      '&$filter=componenttype eq 2 and objectid eq ' + ca.MetadataId +
      '&$expand=solutionid($select=uniquename)');
    const csols = cs.ok ? (cs.json.value || []).map(x => x.solutionid &&
      x.solutionid.uniquename).filter(Boolean) : [];
    log('  its own component record: ' + (csols.join(', ') || 'NONE') +
      (csols.length ? '' : '   (covered by the parent entity, per gate 0)'));
    if (FAILS) stop('the addendum column did not verify. No seed row was written.');
  }

  /* =================================================================
   * THE SEED WRITE
   * ================================================================= */
  log('');
  log('======================================================================');
  log('THE SEED WRITE');
  log('======================================================================');

  /* what already exists in tabledata1 */
  const pre = await getAll(TABLEDATA + 's?$select=cr2bf_dacingesttesttabledata1id,cr2bf_key');
  if (!pre.ok) stop('cannot read existing tabledata rows: ' + pre.status);
  const existing = {};
  pre.value.forEach(r => { existing[r.cr2bf_key] = r.cr2bf_dacingesttesttabledata1id; });
  log('  existing tabledata1 keys: ' + Object.keys(existing).sort().join(', '));

  const SETS = [
    { set: 'cr2bf_dacreporttables', id: 'cr2bf_dacreporttableid', key: 'cr2bf_tablekey' },
    { set: 'cr2bf_dacreportsections', id: 'cr2bf_dacreportsectionid', key: 'cr2bf_sectionkey' },
    { set: 'cr2bf_dacreportmetrics', id: 'cr2bf_dacreportmetricid', key: 'cr2bf_metrickey' },
  ];

  /* --- the three new tables, straight creates --- */
  for (const s of SETS) {
    const rows = SEED[s.set];
    LEDGER.created[s.set] = [];
    log('');
    log('  CREATE ' + rows.length + ' rows in ' + s.set);
    for (const row of rows) {
      const r = await post(s.set, row, { Prefer: 'return=representation' });
      if (!r.ok) stop('creating ' + row[s.key] + ' in ' + s.set + ' failed ' +
        r.status + ': ' + String(r.text || '').slice(0, 300));
      LEDGER.created[s.set].push(r.json[s.id]);
    }
    log('    ' + LEDGER.created[s.set].length + ' created');
  }

  /* --- tabledata1: 153 creates + 1 narrow patch --- */
  {
    const rows = SEED[TABLEDATA + 's'];
    LEDGER.created[TABLEDATA + 's'] = [];
    const toCreate = rows.filter(r => !existing[r.cr2bf_key]);
    const toPatch = rows.filter(r => existing[r.cr2bf_key]);
    log('');
    log('  ' + TABLEDATA + ': ' + toCreate.length + ' creates, ' +
      toPatch.length + ' narrow patch(es)');
    for (const row of toCreate) {
      const r = await post(TABLEDATA + 's', row, { Prefer: 'return=representation' });
      if (!r.ok) stop('creating ' + row.cr2bf_key + ' failed ' + r.status + ': ' +
        String(r.text || '').slice(0, 300));
      LEDGER.created[TABLEDATA + 's'].push(r.json.cr2bf_dacingesttesttabledata1id);
    }
    log('    ' + LEDGER.created[TABLEDATA + 's'].length + ' created');
    for (const row of toPatch) {
      /* THE ONLY PATCH. Body built from PATCH_FIELDS alone, so cr2bf_rows is
       * unreachable -- the operator's three typed zeros in A1:2025 survive. */
      const body = {};
      PATCH_FIELDS.forEach(f => { body[f] = row[f]; });
      log('    PATCH ' + row.cr2bf_key + ' fields: ' + Object.keys(body).join(', '));
      const r = await patch(TABLEDATA + 's(' + existing[row.cr2bf_key] + ')', body);
      if (!r.ok) stop('patching ' + row.cr2bf_key + ' failed ' + r.status + ': ' +
        String(r.text || '').slice(0, 300));
      LEDGER.patched.push(row.cr2bf_key);
    }
  }
  fs.writeFileSync(path.join(__dirname, 'seed_238_ledger.json'),
    JSON.stringify(LEDGER, null, 2));

  /* =================================================================
   * VERIFY: counts, per-row content sha256, recomposition
   * ================================================================= */
  log('');
  log('======================================================================');
  log('VERIFY 1  row counts');
  log('======================================================================');
  const after = {};
  const EXPECT = { 'cr2bf_dacreporttables': 52, 'cr2bf_dacreportsections': 10,
    'cr2bf_dacreportmetrics': 31 };
  EXPECT[TABLEDATA + 's'] = 155;   /* 154 seed keys + A1:2099, which is org-only */
  for (const set of Object.keys(EXPECT)) {
    const r = await getAll(set + '?$select=' + (set === TABLEDATA + 's' ?
      'cr2bf_key' : SETS.find(s => s.set === set).key));
    if (!r.ok) stop('cannot re-read ' + set + ': ' + r.status);
    after[set] = r.value;
    ok(r.value.length === EXPECT[set], set + ' holds ' + EXPECT[set] +
      ' rows: ' + r.value.length);
  }

  log('');
  log('======================================================================');
  log('VERIFY 2  per-row content sha256 against the reviewed seed');
  log('======================================================================');
  for (const s of SETS) {
    const cols = Object.keys(SEED[s.set][0]);
    const r = await getAll(s.set + '?$select=' + cols.join(','));
    if (!r.ok) stop('cannot re-read ' + s.set + ': ' + r.status);
    const byKey = {};
    r.value.forEach(x => { byKey[x[s.key]] = x; });
    let good = 0; const bad = [];
    SEED[s.set].forEach(want => {
      const got = byKey[want[s.key]];
      if (!got) { bad.push(want[s.key] + ' MISSING'); return; }
      const pick = {};
      cols.forEach(c => { pick[c] = got[c] === undefined ? null : got[c]; });
      if (sha(cstr(pick)) === sha(cstr(want))) good++;
      else bad.push(want[s.key] + ' ' + firstDiff(pick, want));
    });
    ok(bad.length === 0, s.set + ': all ' + SEED[s.set].length +
      ' rows hash-match the reviewed seed (' + good + ')' +
      (bad.length ? ' -- ' + bad.slice(0, 3).join(' | ') : ''));
  }
  /* tabledata1: the 153 created rows must hash-match; A1:2025 is the documented
   * exception and is checked separately and precisely */
  {
    const cols = ['cr2bf_key', 'cr2bf_section', 'cr2bf_tableid', 'cr2bf_year',
      'cr2bf_rows', 'cr2bf_schema', 'cr2bf_title'];
    const r = await getAll(TABLEDATA + 's?$select=' + cols.join(','));
    if (!r.ok) stop('cannot re-read tabledata1: ' + r.status);
    const byKey = {};
    r.value.forEach(x => { byKey[x.cr2bf_key] = x; });
    let good = 0; const bad = [];
    SEED[TABLEDATA + 's'].forEach(want => {
      const got = byKey[want.cr2bf_key];
      if (!got) { bad.push(want.cr2bf_key + ' MISSING'); return; }
      const pick = {};
      cols.forEach(c => { pick[c] = got[c] === undefined ? null : got[c]; });
      if (want.cr2bf_key === 'A1:2025') {
        /* schema and title must match the seed; rows must be the ORG value */
        const sOk = pick.cr2bf_schema === want.cr2bf_schema &&
                    pick.cr2bf_title === want.cr2bf_title;
        ok(sOk, 'A1:2025 schema and title now match the seed (the narrow patch landed)');
        return;
      }
      if (sha(cstr(pick)) === sha(cstr(want))) good++;
      else bad.push(want.cr2bf_key + ' ' + firstDiff(pick, want));
    });
    ok(bad.length === 0, 'tabledata1: all 153 seeded rows hash-match (' + good + ')' +
      (bad.length ? ' -- ' + bad.slice(0, 3).join(' | ') : ''));

    /* the 5 orphan title-years, asserted present in the ORG */
    const orph = ['A7:2023', 'G3:2023', 'G5:2023', 'G7:2023', 'G9:2023'];
    const missing = orph.filter(k => !byKey[k]);
    ok(missing.length === 0, 'the 5 orphan title-years are present in Dataverse: ' +
      orph.join(', ') + (missing.length ? ' MISSING ' + missing.join(',') : ''));
    ok(orph.every(k => byKey[k] && byKey[k].cr2bf_title &&
       (byKey[k].cr2bf_rows === null || byKey[k].cr2bf_rows === undefined)),
       'each carries its title and NO data, which is what they are');

    /* A1:2025's rows: the operator's typed zeros must be intact */
    const a1 = byKey['A1:2025'];
    const orgBackup = JSON.parse(fs.readFileSync(
      REPO + '/deploy-backups/2026-09-08-clcpa238-pre-seed/tabledata.json', 'utf8'));
    const before = orgBackup.find(x => x.cr2bf_key === 'A1:2025');
    ok(a1 && before && a1.cr2bf_rows === before.cr2bf_rows,
       "A1:2025 cr2bf_rows is BYTE-IDENTICAL to the pre-seed backup: the three " +
       'typed zeros in "DAC Funding ($)" were not touched');

    /* RECOMPOSITION from the org, canonically, against payload.json */
    log('');
    log('======================================================================');
    log('VERIFY 3  full canonical recomposition from DATAVERSE vs payload.json');
    log('======================================================================');
    const P = JSON.parse(fs.readFileSync(
      REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/payload.json', 'utf8'));
    const rt = await getAll('cr2bf_dacreporttables?$select=cr2bf_tablekey,cr2bf_section,' +
      'cr2bf_number,cr2bf_shorttitle,cr2bf_mapping,cr2bf_presentation');
    const rs = await getAll('cr2bf_dacreportsections?$select=cr2bf_sectionkey,cr2bf_name,' +
      'cr2bf_shortname,cr2bf_fullname,cr2bf_invertmetric,cr2bf_blurb');
    if (!rt.ok || !rs.ok) stop('cannot re-read for recomposition');

    const tables = {};
    rt.value.forEach(x => {
      const t = { id: x.cr2bf_tablekey, section: x.cr2bf_section, number: x.cr2bf_number,
        short_title: x.cr2bf_shorttitle,
        mapping: x.cr2bf_mapping == null ? undefined : JSON.parse(x.cr2bf_mapping),
        data: {}, title_by_year: {}, schema_by_year: {} };
      if (x.cr2bf_presentation) {
        const p = JSON.parse(x.cr2bf_presentation);
        if (p.header_levels !== undefined) t.header_levels = p.header_levels;
        if (p.currency_cols !== undefined) t.currency_cols = p.currency_cols;
      }
      tables[x.cr2bf_tablekey] = t;
    });
    r.value.forEach(x => {
      const t = tables[x.cr2bf_tableid]; if (!t) return;
      const y = String(x.cr2bf_year);
      if (x.cr2bf_rows != null) t.data[y] = JSON.parse(x.cr2bf_rows);
      if (x.cr2bf_schema != null) t.schema_by_year[y] = JSON.parse(x.cr2bf_schema);
      if (x.cr2bf_title != null) t.title_by_year[y] = x.cr2bf_title;
    });
    /* A1:2099 is org-only and has no payload counterpart, so it is removed
     * before the comparison -- and its removal is ASSERTED rather than silent */
    const had2099 = !!(tables.A1 && tables.A1.data['2099']);
    ok(had2099, 'A1:2099 recomposed from the org, as an extra the payload never had');
    if (tables.A1) delete tables.A1.data['2099'];

    /* A1:2025 differs by the documented 24 cells. Asserted EXACTLY, so a new
     * difference fails rather than hiding behind the known one. */
    const orgA1 = tables.A1 ? tables.A1.data['2025'] : null;
    const payA1 = P.tables.A1.data['2025'];
    let c2 = 0, c3 = 0, other = 0;
    if (orgA1) {
      orgA1.forEach((row, ri) => row.forEach((c, ci) => {
        const v = payA1[ri] ? payA1[ri][ci] : undefined;
        if (cstr(c) !== cstr(v)) { if (ci === 2) c2++; else if (ci === 3) c3++; else other++; }
      }));
    }
    ok(c2 === 3 && c3 === 21 && other === 0,
       'A1:2025 differs from the payload in EXACTLY the documented cells: 3 in ' +
       'column 2 (the preserved typed zeros) and 21 in column 3 (derived, ' +
       'nulled by CLCPA-142), and nowhere else. Got ' + c2 + '/' + c3 + '/' + other);
    if (tables.A1) tables.A1.data['2025'] = payA1;   /* the known exception, substituted explicitly */

    const tdiff = firstDiff(tables, P.tables);
    ok(tdiff === null, 'every other table-year recomposes EXACTLY from Dataverse' +
      (tdiff ? ': ' + tdiff : ''));

    const sections = {};
    rs.value.forEach(x => { sections[x.cr2bf_sectionkey] = {
      name: x.cr2bf_name, short_name: x.cr2bf_shortname, full_name: x.cr2bf_fullname,
      invert_metric: !!x.cr2bf_invertmetric, blurb: x.cr2bf_blurb }; });
    const sdiff = firstDiff(sections, P.sections);
    ok(sdiff === null, 'sections recompose EXACTLY from Dataverse' + (sdiff ? ': ' + sdiff : ''));

    const yrs = Array.from(new Set(r.value.filter(x => x.cr2bf_rows != null)
      .map(x => String(x.cr2bf_year)))).sort((a, b) => parseInt(b) - parseInt(a));
    log('  years derived from the org rows: ' + yrs.join(', '));
    ok(deepEq(yrs.filter(y => y !== '2099'), P.meta.years),
       'meta.years derives from the org rows, once 2099 is set aside: ' +
       yrs.filter(y => y !== '2099').join(','));
  }

  log('');
  log('======================================================================');
  log('=== SEED COMPLETE ===');
  log('  column created : ' + LEDGER.column);
  log('  solution comps : ' + (LEDGER.components.join(', ') || 'none needed'));
  Object.keys(LEDGER.created).forEach(k =>
    log('  rows created   : ' + k.padEnd(34) + LEDGER.created[k].length));
  log('  rows patched   : ' + (LEDGER.patched.join(', ') || 'none'));
  log('  checks: ' + (CHECKS - FAILS) + ' passed, ' + FAILS + ' failed, of ' + CHECKS);
  log('  requests: GET ' + GETS + ', POST ' + POSTS + ', PATCH ' + PATCHES);
  log('  ledger: seed_238_ledger.json (every created row id, for rollback)');
  log('======================================================================');
  flush();
  process.exitCode = FAILS ? 1 : 0;
})().catch(e => { log('UNCAUGHT: ' + (e && e.stack || e)); stop('uncaught exception'); });
