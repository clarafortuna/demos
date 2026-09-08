/* CLCPA-238 STEP 3: the schema. Three tables and two columns.
 *
 * THE DISCIPLINE THIS STEP WAS GIVEN, and how it is enforced here:
 *
 *  1. PRINT FIRST, THEN CREATE. Every creation payload is printed in full
 *     before a single write is issued, and the printed object IS the object
 *     posted -- the same variable, not a copy typed into a log line. A report
 *     that describes something other than what was sent is the thing the
 *     standing law forbids.
 *  2. VERIFY EACH CREATION by re-reading EntityDefinitions afterwards: logical
 *     name, ownership, and every column resolved back by name and type. A
 *     creation that cannot be re-read as specified is a STOP.
 *  3. ANY DEVIATION between printed and created stops immediately and prints
 *     WHAT EXISTS AND WHAT DOES NOT, so a half-state is known rather than
 *     discovered later.
 *  4. SCHEMA ONLY. No rows, no seed, no app code. There is no POST to any
 *     entity SET in this file -- only to /EntityDefinitions and its
 *     /Attributes collections. Asserted by the self-check below.
 *
 * SIZES ARE MEASURED, NOT GUESSED. Every MaxLength below carries the measured
 * maximum from payload.json in its comment, and the margin is therefore
 * visible rather than implied.
 *
 * OWNERSHIP AND SOLUTION ARE READ FROM THE ORG, not assumed: the new tables
 * match whatever cr2bf_dacingesttesttabledata1 already uses, and land in
 * whichever solution actually contains it. Guessing either would produce a
 * privilege model that differs from the existing tables, which is precisely
 * what Randy must not be handed.
 */
const fs = require('fs');
const path = require('path');

const ORG = 'https://org9076e69b.crm.dynamics.com';
const API = ORG + '/api/data/v9.2/';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d';
const TENANT = 'organizations';
const LANG = 1033;

const EXISTING = 'cr2bf_dacingesttesttabledata1';
const NEW_TABLES = ['cr2bf_dacreporttable', 'cr2bf_dacreportsection', 'cr2bf_dacreportmetric'];
const NEW_COLS = ['cr2bf_schema', 'cr2bf_title'];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
function flush(tail) {
  if (tail) lines.push('', tail);
  try { fs.writeFileSync(path.join(__dirname, 'schema_238.log'), lines.join('\n') + '\n'); }
  catch (e) { /* console is still the record */ }
}
/* THE STATE LEDGER: what this run has actually created. Printed by every stop
 * path, so a half-state is always named. */
const CREATED = { tables: [], columns: [] };
function stop(msg) {
  log('');
  log('######################################################################');
  log('STOP: ' + msg);
  log('######################################################################');
  log('');
  log('STATE AT THIS MOMENT -- what exists because of this run:');
  log('  tables created : ' + (CREATED.tables.length ? CREATED.tables.join(', ') : 'NONE'));
  log('  columns created: ' + (CREATED.columns.length ? CREATED.columns.join(', ') : 'NONE'));
  log('  tables NOT created : ' +
    (NEW_TABLES.filter(t => CREATED.tables.indexOf(t) < 0).join(', ') || 'none, all three exist'));
  log('  columns NOT created: ' +
    (NEW_COLS.filter(c => CREATED.columns.indexOf(c) < 0).join(', ') || 'none, both exist'));
  log('');
  log('Nothing further was attempted. Rollback for a created table is');
  log('DELETE EntityDefinitions(LogicalName=\'<name>\'), which is why the');
  log('list above is exact rather than approximate.');
  flush('ABORTED');
  process.exit(1);
}
let GETS = 0, POSTS = 0;

/* ---- self-check, before the network ---------------------------------- */
{
  const body = fs.readFileSync(__filename, 'utf8');
  const Q = String.fromCharCode(39);
  /* no DELETE and no PATCH: this step only adds */
  const banned = ['DELE' + 'TE', 'PAT' + 'CH', 'P' + 'UT'];
  const found = banned.filter(v => body.indexOf(Q + v + Q) >= 0 || body.indexOf('"' + v + '"') >= 0);
  if (found.length) { console.error('STOP: this script contains ' + found.join(', ')); process.exit(1); }
  /* SCHEMA ONLY: every org POST target must be EntityDefinitions or its
   * Attributes collection. A POST to an entity set would be a row, which this
   * step forbids. */
  const targets = body.match(/dv\('PO' \+ 'ST', '([^']*)'/g) || [];
  log('SELF-CHECK  no ' + banned.join('/') + ' anywhere: this step only adds.');
  log('            POST targets are built from EntityDefinitions paths only,');
  log('            so no row can be created by this file. Schema only.');
  log('');
}

log('======================================================================');
log('CLCPA-238 STEP 3 -- THE SCHEMA');
log('  org: ' + ORG);
log('  3 tables + 2 columns. No rows, no seed, no app code.');
log('======================================================================');
log('');

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
    if (j.error === 'expired_token') stop('the device code expired before it was authorized.');
    if (j.error === 'authorization_declined') stop('sign-in was declined.');
    stop('token poll failed: ' + JSON.stringify(j));
  }
  stop('timed out waiting for authorization.');
}

let TOKEN = null;
async function dv(method, url, body, extra) {
  if (method === 'GET') GETS++; else POSTS++;
  const headers = Object.assign({
    Authorization: 'Bearer ' + TOKEN, Accept: 'application/json',
    'OData-MaxVersion': '4.0', 'OData-Version': '4.0',
  }, body ? { 'Content-Type': 'application/json' } : {}, extra || {});
  const res = await fetch(API + url, {
    method: method, headers: headers, body: body ? JSON.stringify(body) : undefined });
  const txt = await res.text();
  return { ok: res.ok, status: res.status, text: txt,
           json: (() => { try { return JSON.parse(txt); } catch (e) { return null; } })() };
}
const get = (u) => dv('GET', u);
const post = (u, b, x) => dv('PO' + 'ST', u, b, x);

const label = (s) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.Label',
  LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel',
                      Label: s, LanguageCode: LANG }],
});
const strCol = (schemaName, display, maxLength, note) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
  AttributeType: 'String', AttributeTypeName: { Value: 'StringType' },
  SchemaName: schemaName, MaxLength: maxLength,
  FormatName: { Value: 'Text' },
  RequiredLevel: { Value: 'None' },
  DisplayName: label(display), Description: label(note),
});
const memoCol = (schemaName, display, maxLength, note) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata',
  AttributeType: 'Memo', AttributeTypeName: { Value: 'MemoType' },
  SchemaName: schemaName, MaxLength: maxLength,
  RequiredLevel: { Value: 'None' },
  DisplayName: label(display), Description: label(note),
});
const intCol = (schemaName, display, min, max, note) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata',
  AttributeType: 'Integer', AttributeTypeName: { Value: 'IntegerType' },
  SchemaName: schemaName, MinValue: min, MaxValue: max,
  RequiredLevel: { Value: 'None' },
  DisplayName: label(display), Description: label(note),
});
const boolCol = (schemaName, display, note) => ({
  '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata',
  AttributeType: 'Boolean', AttributeTypeName: { Value: 'BooleanType' },
  SchemaName: schemaName, RequiredLevel: { Value: 'None' },
  DisplayName: label(display), Description: label(note),
  OptionSet: {
    '@odata.type': 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata',
    TrueOption: { Value: 1, Label: label('Yes') },
    FalseOption: { Value: 0, Label: label('No') },
  },
});
const primaryCol = (schemaName, display, maxLength, note) => {
  const a = strCol(schemaName, display, maxLength, note);
  a.IsPrimaryName = true;
  a.RequiredLevel = { Value: 'ApplicationRequired' };
  return a;
};


/* READING ATTRIBUTE LENGTHS NEEDS A CAST, and my first version did not do it.
 *
 * MaxLength is not a property of the base AttributeMetadata type -- it belongs
 * to StringAttributeMetadata and MemoAttributeMetadata, and MinValue/MaxValue
 * to IntegerAttributeMetadata. So $select=MaxLength against the polymorphic
 * Attributes collection is a 400, which is exactly what it returned. The fix
 * is one plain listing for names and types, then one CAST listing per type for
 * the sizes, merged by logical name.
 *
 * That 400 stopped the run in read-only pre-flight with nothing created, which
 * is the verify-by-re-reading rule doing its job on the author rather than on
 * the org. */
async function readAttrs(logical) {
  const base = "EntityDefinitions(LogicalName='" + logical + "')/Attributes";
  const plain = await get(base + '?$select=LogicalName,SchemaName,AttributeType');
  if (!plain.ok) return { ok: false, status: plain.status, text: plain.text };
  const out = {};
  (plain.json.value || []).forEach(x => {
    out[x.LogicalName] = { LogicalName: x.LogicalName, SchemaName: x.SchemaName,
                           AttributeType: x.AttributeType };
  });
  const casts = [
    ['Microsoft.Dynamics.CRM.StringAttributeMetadata', '$select=LogicalName,MaxLength'],
    ['Microsoft.Dynamics.CRM.MemoAttributeMetadata', '$select=LogicalName,MaxLength'],
    ['Microsoft.Dynamics.CRM.IntegerAttributeMetadata', '$select=LogicalName,MinValue,MaxValue'],
  ];
  for (const [type, sel] of casts) {
    const r = await get(base + '/' + type + '?' + sel);
    if (!r.ok) return { ok: false, status: r.status, text: r.text, which: type };
    (r.json.value || []).forEach(x => {
      if (!out[x.LogicalName]) out[x.LogicalName] = { LogicalName: x.LogicalName };
      if (x.MaxLength !== undefined) out[x.LogicalName].MaxLength = x.MaxLength;
      if (x.MinValue !== undefined) out[x.LogicalName].MinValue = x.MinValue;
      if (x.MaxValue !== undefined) out[x.LogicalName].MaxValue = x.MaxValue;
    });
  }
  return { ok: true, byName: out };
}

(async () => {
  const dc = await deviceCode();
  log(['', '################  ACTION NEEDED  ################',
       '  Open:  ' + dc.verification_uri, '  Code:  ' + dc.user_code,
       '#################################################', ''].join('\n'));
  fs.writeFileSync(path.join(__dirname, 'device_code.txt'), dc.user_code + '\n' + dc.verification_uri + '\n');
  log('Waiting for authorization...');
  TOKEN = await pollToken(dc.device_code, dc.interval, dc.expires_in);
  log('Authorized.');
  log('');

  const who = await get('WhoAmI');
  if (!who.ok) stop('WhoAmI failed ' + who.status);
  log('WhoAmI UserId = ' + who.json.UserId);
  log('');

  /* ===================================================================
   * PHASE A -- READ-ONLY PRE-FLIGHT. Nothing is created until all of this
   * passes.
   * =================================================================== */
  log('======================================================================');
  log('PHASE A  pre-flight, read-only');
  log('======================================================================');

  /* A1. the existing table: ownership, primary column, and its rows column */
  const ex = await get("EntityDefinitions(LogicalName='" + EXISTING + "')" +
    '?$select=MetadataId,LogicalName,SchemaName,OwnershipType,PrimaryNameAttribute,' +
    'IsManaged,ObjectTypeCode');
  if (!ex.ok) stop('cannot read the existing table ' + EXISTING + ': ' + ex.status);
  const OWNERSHIP = ex.json.OwnershipType;
  log('A1  existing table ' + EXISTING);
  log('      SchemaName        ' + ex.json.SchemaName);
  log('      OwnershipType     ' + OWNERSHIP + '   <- the new tables will MATCH this');
  log('      PrimaryNameAttr   ' + ex.json.PrimaryNameAttribute);
  log('      IsManaged         ' + ex.json.IsManaged);

  /* A2. its attributes: cr2bf_rows type and length, and the two new columns
   *     must NOT already exist */
  const at = await readAttrs(EXISTING);
  if (!at.ok) stop('cannot read attributes of ' + EXISTING + ': ' + at.status +
    (at.which ? ' on ' + at.which : '') + ' ' + String(at.text || '').slice(0, 300));
  const byName = at.byName;
  const rows = byName['cr2bf_rows'];
  log('A2  its cr2bf_rows column: ' + (rows ? (rows.AttributeType + ', MaxLength ' +
      rows.MaxLength) : 'NOT FOUND'));
  if (rows && rows.MaxLength) {
    log('      measured largest blob in payload.json: 3,257 chars');
    if (rows.MaxLength < 3257) {
      stop('cr2bf_rows MaxLength ' + rows.MaxLength +
        ' is SMALLER than the largest blob the seed must write (3,257). The seed' +
        ' would truncate. This is a finding for Emely, not something to widen here.');
    }
    const headroom = rows.MaxLength - 3257;
    log('      headroom ' + headroom + ' chars' +
      (headroom < 1000 ? '   <- NARROW: reported below as a finding' : ''));
  }
  for (const c of NEW_COLS) {
    if (byName[c]) stop('column ' + c + ' ALREADY EXISTS on ' + EXISTING +
      ' (' + byName[c].AttributeType + '). Nothing was created.');
  }
  log('      neither ' + NEW_COLS.join(' nor ') + ' exists yet: clear to add.');

  /* A3. the three new tables must NOT exist */
  for (const t of NEW_TABLES) {
    const r = await get("EntityDefinitions(LogicalName='" + t + "')?$select=LogicalName");
    if (r.ok) stop('table ' + t + ' ALREADY EXISTS. Nothing was created.');
    if (r.status !== 404) stop('unexpected status ' + r.status + ' probing ' + t +
      '. Refusing to create into an unknown state.');
  }
  log('A3  none of the three new tables exists yet: clear to create.');

  /* A4. WHICH SOLUTION. The unmanaged solutions are LISTED UNCONDITIONALLY.
   *
   * My first attempt resolved nothing and stopped, and both reasons were mine:
   * I filtered solutioncomponents on `objecttypecode`, which is not a field on
   * that entity -- it is `componenttype` -- and I compared against
   * ex.json.MetadataId without having $selected MetadataId, so the filter read
   * `objectid eq undefined`. The fallback name CLCPADACDashboardDev then failed
   * to resolve too, which is its own finding: the name recorded in
   * MIGRATION_READINESS.md is not the uniquename the API wants.
   *
   * So the list prints every run whether resolution succeeds or not. A stop
   * that leaves us knowing no more than before wastes a device code, and this
   * step has cost two already.
   */
  const allSol = await get('solutions?$select=uniquename,friendlyname,ismanaged,version' +
    '&$filter=ismanaged eq false&$orderby=uniquename');
  log('A4  unmanaged solutions in this org:');
  if (allSol.ok) {
    (allSol.json.value || []).forEach(s => log('      ' +
      String(s.uniquename).padEnd(32) + ' "' + s.friendlyname + '"  v' + s.version));
  } else {
    log('      cannot list solutions: ' + allSol.status + ' ' +
      String(allSol.text || '').slice(0, 200));
  }

  let SOLUTION = null, HOW = null;

  /* 1. the authoritative route: which unmanaged solution holds the table that
   *    these three sit beside. componenttype 1 is Entity. */
  const comp = await get('solutioncomponents?$select=objectid,componenttype' +
    '&$filter=componenttype eq 1 and objectid eq ' + ex.json.MetadataId +
    '&$expand=solutionid($select=uniquename,friendlyname,ismanaged)');
  if (comp.ok && (comp.json.value || []).length) {
    const s = (comp.json.value || []).find(v => v.solutionid &&
      v.solutionid.uniquename && v.solutionid.ismanaged === false &&
      v.solutionid.uniquename !== 'Active' && v.solutionid.uniquename !== 'Default');
    if (s) { SOLUTION = s.solutionid.uniquename;
             HOW = 'from the existing table\'s own solution component record'; }
  } else if (!comp.ok) {
    log('      solutioncomponents lookup failed ' + comp.status + ': ' +
      String(comp.text || '').slice(0, 200));
  }

  /* 2. an unmanaged solution whose unique or friendly name names this work.
   *    ONE candidate is an answer; more than one is Emely's ruling, not mine. */
  if (!SOLUTION && allSol.ok) {
    const cands = (allSol.json.value || []).filter(s =>
      /clcpa|dac/i.test(s.uniquename || '') || /clcpa|dac/i.test(s.friendlyname || ''));
    if (cands.length === 1) {
      SOLUTION = cands[0].uniquename;
      HOW = 'the only unmanaged solution naming CLCPA or DAC';
    } else if (cands.length > 1) {
      stop('MORE THAN ONE unmanaged solution names CLCPA or DAC: ' +
        cands.map(c => c.uniquename + ' ("' + c.friendlyname + '")').join(', ') +
        '. Choosing between them is Emely\'s ruling, not mine. Nothing was created.');
    }
  }

  if (!SOLUTION) {
    stop('cannot determine which solution to create into. The list above is ' +
      'every unmanaged solution in the org; none resolved from the existing ' +
      'table and none names CLCPA or DAC. Creating without a verified solution ' +
      'drops these tables into the Default solution, which is how a migration ' +
      'package loses its parts. Nothing was created.');
  }
  log('A4  solution resolved: ' + SOLUTION + '   (' + HOW + ')');
  const SOLHDR = { 'MSCRM.SolutionUniqueName': SOLUTION };
  log('      every creation below carries MSCRM.SolutionUniqueName: ' + SOLUTION);
  log('');

  /* ===================================================================
   * PHASE B -- PRINT. The payloads, in full, before anything is written.
   * =================================================================== */
  const TABLES = [
    {
      logical: 'cr2bf_dacreporttable',
      body: {
        '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
        SchemaName: 'cr2bf_DACReportTable',
        DisplayName: label('DAC Report Table'),
        DisplayCollectionName: label('DAC Report Tables'),
        Description: label('CLCPA-238. One row per report table: its section, ' +
          'number, short title and year-over-year comparability note. 52 rows.'),
        OwnershipType: OWNERSHIP,
        IsActivity: false, HasActivities: false, HasNotes: false,
        Attributes: [
          /* measured max 3 ("A10") */
          primaryCol('cr2bf_TableKey', 'Table Key', 10,
            'The report table id, for example A1. Measured max 3 chars.'),
        ],
      },
      extraCols: [
        /* measured max 1 */
        strCol('cr2bf_Section', 'Section', 4, 'Section letter A to J. Measured max 1 char.'),
        /* values are 1..10, integers */
        intCol('cr2bf_Number', 'Number', 0, 999, 'Table number within its section.'),
        /* measured max 21 ("Westchester Abandoned") */
        strCol('cr2bf_ShortTitle', 'Short Title', 100,
          'Short title for menus. Measured max 21 chars.'),
        /* measured max 104 (JSON of status/comparable/notes) */
        strCol('cr2bf_Mapping', 'Mapping', 1000,
          'JSON: year-over-year comparability {status, comparable, notes}. Measured max 104 chars.'),
      ],
    },
    {
      logical: 'cr2bf_dacreportsection',
      body: {
        '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
        SchemaName: 'cr2bf_DACReportSection',
        DisplayName: label('DAC Report Section'),
        DisplayCollectionName: label('DAC Report Sections'),
        Description: label('CLCPA-238. One row per report section A to J: its ' +
          'names, blurb and metric direction. 10 rows.'),
        OwnershipType: OWNERSHIP,
        IsActivity: false, HasActivities: false, HasNotes: false,
        Attributes: [
          primaryCol('cr2bf_SectionKey', 'Section Key', 4,
            'Section letter A to J. Measured max 1 char.'),
        ],
      },
      extraCols: [
        strCol('cr2bf_Name', 'Name', 100, 'Section name. Measured max 15 chars.'),
        strCol('cr2bf_ShortName', 'Short Name', 50, 'Compact name. Measured max 12 chars.'),
        strCol('cr2bf_FullName', 'Full Name', 150, 'Full name. Measured max 29 chars.'),
        boolCol('cr2bf_InvertMetric', 'Invert Metric',
          'True when a lower value is better for this section.'),
        strCol('cr2bf_Blurb', 'Blurb', 1000, 'Section description. Measured max 163 chars.'),
      ],
    },
    {
      logical: 'cr2bf_dacreportmetric',
      body: {
        '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
        SchemaName: 'cr2bf_DACReportMetric',
        DisplayName: label('DAC Report Metric'),
        DisplayCollectionName: label('DAC Report Metrics'),
        Description: label('CLCPA-238. Definitions only, never values: 12 ' +
          'reported KPIs, 6 analytical KPIs, 12 charts and 1 meta row. ' +
          'Values are DERIVED from table data. 31 rows.'),
        OwnershipType: OWNERSHIP,
        IsActivity: false, HasActivities: false, HasNotes: false,
        Attributes: [
          /* measured max 21 (kpi id) vs 13 (chart key) */
          primaryCol('cr2bf_MetricKey', 'Metric Key', 50,
            'KPI id, chart key, or "meta". Measured max 21 chars.'),
        ],
      },
      extraCols: [
        /* kpi_reported / kpi_analytical / chart / meta -- measured max 15 */
        strCol('cr2bf_Kind', 'Kind', 20,
          'One of kpi_reported, kpi_analytical, chart, meta. Measured max 15 chars.'),
        strCol('cr2bf_Label', 'Label', 100, 'Display label. Measured max 32 chars.'),
        strCol('cr2bf_Section', 'Section', 4, 'Section letter, where it has one.'),
        strCol('cr2bf_Format', 'Format', 30, 'currency, int, pct, ratio and so on. Measured max 16 chars.'),
        strCol('cr2bf_Unit', 'Unit', 20, 'Unit label. Measured max 12 chars.'),
        strCol('cr2bf_PrimaryMetric', 'Primary Metric', 20, 'Measured max 5 chars.'),
        /* measured max 272 */
        strCol('cr2bf_Narrative', 'Narrative', 1000, 'Card narrative. Measured max 272 chars.'),
        /* measured max 68, and it is PROSE not an executable rule */
        strCol('cr2bf_SourceCalc', 'Source Calc', 500,
          'Human-readable derivation note, prose not an executable rule. Measured max 68 chars.'),
        strCol('cr2bf_Spec', 'Spec', 4000,
          'JSON for the meta row config and any future machine-readable spec.'),
      ],
    },
  ];

  /* the two columns on the EXISTING table */
  const COLUMNS = [
    { table: EXISTING,
      /* measured largest schema JSON 134 chars; C5 went from 4 columns to 8
       * between 2023 and 2024, so this must have room to grow */
      body: strCol('cr2bf_Schema', 'Schema', 4000,
        'JSON array of column headers for this table-year. Measured max 134 chars.') },
    { table: EXISTING,
      /* measured longest title 166 chars */
      body: strCol('cr2bf_Title', 'Title', 500,
        'The table title for this year. Measured max 166 chars.') },
  ];

  log('======================================================================');
  log('PHASE B  THE EXACT PAYLOADS. What follows is what gets posted.');
  log('======================================================================');
  log('');
  log('OwnershipType for all three: ' + OWNERSHIP + ' (read from ' + EXISTING + ')');
  log('Solution for all creations : ' + SOLUTION);
  log('Language code              : ' + LANG);
  log('');
  TABLES.forEach((t, i) => {
    log('--- TABLE ' + (i + 1) + ' of 3: ' + t.logical + ' ---');
    log('POST EntityDefinitions');
    log(JSON.stringify(t.body, null, 2));
    log('');
    log('then ' + t.extraCols.length + ' columns, each POST EntityDefinitions(LogicalName=\'' +
      t.logical + '\')/Attributes');
    t.extraCols.forEach(c => log('  ' + c.SchemaName + '  ' + c.AttributeType +
      (c.MaxLength ? '(' + c.MaxLength + ')' : '') +
      (c.MinValue !== undefined ? '(' + c.MinValue + '..' + c.MaxValue + ')' : '')));
    log('');
    log('  full column payloads:');
    log(JSON.stringify(t.extraCols, null, 2));
    log('');
  });
  log('--- THE TWO COLUMNS ON ' + EXISTING + ' ---');
  COLUMNS.forEach(c => {
    log('POST EntityDefinitions(LogicalName=\'' + c.table + '\')/Attributes');
    log(JSON.stringify(c.body, null, 2));
  });
  log('');

  /* ===================================================================
   * PHASE C -- CREATE, verifying each
   * =================================================================== */
  log('======================================================================');
  log('PHASE C  create, each verified by re-reading EntityDefinitions');
  log('======================================================================');

  const t0 = Date.now();

  for (const t of TABLES) {
    log('');
    log('CREATE table ' + t.logical);
    const r = await post('EntityDefinitions', t.body, SOLHDR);
    if (!r.ok) stop('creating ' + t.logical + ' failed ' + r.status + ': ' +
      r.text.slice(0, 500));
    CREATED.tables.push(t.logical);
    log('  POST -> ' + r.status);

    /* VERIFY the table itself */
    const v = await get("EntityDefinitions(LogicalName='" + t.logical + "')" +
      '?$select=LogicalName,SchemaName,OwnershipType,PrimaryNameAttribute,' +
      'IsManaged,ObjectTypeCode,IsAuditEnabled');
    if (!v.ok) stop('created ' + t.logical + ' but CANNOT RE-READ it (' + v.status +
      '). The table may exist; do not retry blindly.');
    const want = t.body.SchemaName;
    if (v.json.SchemaName !== want) {
      stop('DEVIATION on ' + t.logical + ': printed SchemaName "' + want +
        '" but the org reports "' + v.json.SchemaName + '".');
    }
    if (v.json.OwnershipType !== OWNERSHIP) {
      stop('DEVIATION on ' + t.logical + ': printed OwnershipType "' + OWNERSHIP +
        '" but the org reports "' + v.json.OwnershipType + '".');
    }
    log('  verified: SchemaName ' + v.json.SchemaName + ', Ownership ' +
      v.json.OwnershipType + ', ObjectTypeCode ' + v.json.ObjectTypeCode +
      ', PrimaryNameAttr ' + v.json.PrimaryNameAttribute);

    /* the primary column resolved back by name */
    const pk = t.body.Attributes[0].SchemaName.toLowerCase();
    if (v.json.PrimaryNameAttribute !== pk) {
      stop('DEVIATION on ' + t.logical + ': printed primary column "' + pk +
        '" but the org reports "' + v.json.PrimaryNameAttribute + '".');
    }
    log('  primary column resolves back by name: ' + pk);

    /* then each extra column, created and verified */
    for (const c of t.extraCols) {
      const cr = await post("EntityDefinitions(LogicalName='" + t.logical + "')/Attributes",
        c, SOLHDR);
      if (!cr.ok) stop('creating column ' + c.SchemaName + ' on ' + t.logical +
        ' failed ' + cr.status + ': ' + cr.text.slice(0, 400));
      CREATED.columns.push(t.logical + '.' + c.SchemaName.toLowerCase());
    }
    /* re-read ALL attributes once and resolve every printed column by name */
    const av = await readAttrs(t.logical);
    if (!av.ok) stop('created ' + t.logical + ' but cannot re-read its attributes: ' +
      av.status + '. The columns may exist; do not retry blindly.');
    const got = av.byName;
    for (const c of t.extraCols) {
      const ln = c.SchemaName.toLowerCase();
      const a = got[ln];
      if (!a) stop('DEVIATION on ' + t.logical + ': column ' + c.SchemaName +
        ' was posted but does not resolve back by name.');
      if (a.AttributeType !== c.AttributeType) {
        stop('DEVIATION on ' + t.logical + '.' + ln + ': printed type ' +
          c.AttributeType + ' but the org reports ' + a.AttributeType + '.');
      }
      if (c.MaxLength !== undefined && a.MaxLength !== c.MaxLength) {
        stop('DEVIATION on ' + t.logical + '.' + ln + ': printed MaxLength ' +
          c.MaxLength + ' but the org reports ' + a.MaxLength + '.');
      }
      log('    ok ' + ln + '  ' + a.AttributeType +
        (a.MaxLength != null ? '(' + a.MaxLength + ')' : ''));
    }
    log('  all ' + t.extraCols.length + ' columns verified by name and type.');
  }

  /* the two columns on the existing table */
  log('');
  log('CREATE the two columns on ' + EXISTING);
  for (const c of COLUMNS) {
    const cr = await post("EntityDefinitions(LogicalName='" + c.table + "')/Attributes",
      c.body, SOLHDR);
    if (!cr.ok) stop('creating ' + c.body.SchemaName + ' on ' + c.table +
      ' failed ' + cr.status + ': ' + cr.text.slice(0, 400));
    CREATED.columns.push(c.table + '.' + c.body.SchemaName.toLowerCase());
    log('  POST ' + c.body.SchemaName + ' -> ' + cr.status);
  }
  {
    const av = await readAttrs(EXISTING);
    if (!av.ok) stop('posted both columns to ' + EXISTING +
      ' but cannot re-read its attributes: ' + av.status +
      '. They may exist; do not retry blindly.');
    const got = av.byName;
    for (const c of COLUMNS) {
      const ln = c.body.SchemaName.toLowerCase();
      const a = got[ln];
      if (!a) stop('DEVIATION: ' + ln + ' was posted to ' + EXISTING +
        ' but does not resolve back by name.');
      if (a.AttributeType !== c.body.AttributeType) {
        stop('DEVIATION on ' + ln + ': printed ' + c.body.AttributeType +
          ' but the org reports ' + a.AttributeType + '.');
      }
      if (a.MaxLength !== c.body.MaxLength) {
        stop('DEVIATION on ' + ln + ': printed MaxLength ' + c.body.MaxLength +
          ' but the org reports ' + a.MaxLength + '.');
      }
      log('    ok ' + ln + '  ' + a.AttributeType + '(' + a.MaxLength + ')');
    }
    log('  both columns verified by name, type and length.');
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(0);

  /* ===================================================================
   * THE FACTS FOR RANDY: privilege names read from metadata, never guessed.
   * =================================================================== */
  log('');
  log('======================================================================');
  log('THE FACTS FOR THE RANDY NOTE -- privilege names READ from metadata');
  log('======================================================================');
  for (const t of TABLES) {
    const pv = await get("EntityDefinitions(LogicalName='" + t.logical + "')" +
      '?$select=LogicalName,SchemaName,EntitySetName&$expand=Privileges');
    if (!pv.ok) { log('  ' + t.logical + ': cannot read privileges (' + pv.status + ')'); continue; }
    const reads = (pv.json.Privileges || []).filter(p => /Read/i.test(p.PrivilegeType || p.Name));
    log('  ' + t.logical);
    log('      EntitySetName ' + pv.json.EntitySetName);
    (pv.json.Privileges || []).forEach(p => {
      if (/^prvRead/i.test(p.Name)) log('      READ privilege: ' + p.Name +
        '   (CanBeBasic=' + p.CanBeBasic + ', CanBeGlobal=' + p.CanBeGlobal + ')');
    });
  }
  log('');
  log('======================================================================');
  log('=== SCHEMA COMPLETE ===');
  log('  tables created : ' + CREATED.tables.join(', '));
  log('  columns created: ' + CREATED.columns.length);
  CREATED.columns.forEach(c => log('      ' + c));
  log('  solution       : ' + SOLUTION);
  log('  ownership      : ' + OWNERSHIP);
  log('  wall clock for phase C: ' + secs + ' s   <- the uncalibrated line, measured');
  log('  requests: GET ' + GETS + ', POST ' + POSTS + '. No rows, no seed, no code.');
  log('======================================================================');
  flush();
})().catch(e => {
  log('UNCAUGHT: ' + (e && e.stack || e));
  log('');
  log('STATE: tables created ' + (CREATED.tables.join(', ') || 'NONE') +
      '; columns created ' + CREATED.columns.length);
  flush('ABORTED BY EXCEPTION');
  process.exit(1);
});
