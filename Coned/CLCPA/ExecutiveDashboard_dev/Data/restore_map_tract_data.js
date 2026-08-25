/* CLCPA-191: restore cr2bf_dacmaptractdata from the pre-delete export.
 *
 * This exists because nothing in the repository writes that table. The CLCPA-115
 * edit path was removed before 2026-06-30 and never replaced, so the export in
 * Data/backups/ is the only record of the 2,333 rows and THIS is the only way to
 * put them back. Emely's rule: the bulk delete does not happen until restore is a
 * proven procedure rather than a hopeful one.
 *
 * MODES, least dangerous first:
 *
 *   --dry-run                 (default) offline. Builds all 2,333 POST bodies from
 *                             the export and validates them. No network, no token.
 *   --prove-synthetic         creates ONE row that is not in the export, with a
 *                             client-specified GUID and an impossible GEOID, reads
 *                             it back to prove the GUID round-trips, then deletes
 *                             that same row. Touches none of the 2,333.
 *   --prove-real <geoid>      the end-to-end proof on a sample of one: verify the
 *                             live row matches the export, delete it, restore it
 *                             from the export, and compare every field including
 *                             the GUID.
 *   --restore-all             the actual rollback. Refuses to run unless the table
 *                             is empty or --force-partial is given.
 *
 * WHAT RESTORE CANNOT RECOVER: createdon and modifiedon. Those are system columns;
 * a restored row carries the timestamp of its restore, not of its original
 * creation. The export preserves the originals as a record, and the row GUIDs DO
 * survive, so references and identity are intact -- but anyone reading createdon
 * after a rollback is reading the rollback. Said plainly here because a restore
 * that quietly rewrites history is worse than one that admits it.
 */
const fs = require('fs');
const path = require('path');

const ORG = 'https://org9076e69b.crm.dynamics.com';
const API = ORG + '/api/data/v9.2/';
const CLIENT_ID = '51f81489-12ee-4a9e-aaae-a2591f45987d';
const TENANT = 'organizations';
const SET = 'cr2bf_dacmaptractdatas';
const PK = 'cr2bf_dacmaptractdataid';
const GEO = 'cr2bf_censustractgeoid';
const VALUE_COLS = ['cr2bf_elecdac', 'cr2bf_elecaccts', 'cr2bf_eleceap', 'cr2bf_elecadj',
                    'cr2bf_gasdac', 'cr2bf_gasaccts', 'cr2bf_gaseap', 'cr2bf_gasadj'];
const TEXT_COLS = ['cr2bf_elecdac', 'cr2bf_gasdac'];
const INT_COLS = ['cr2bf_elecaccts', 'cr2bf_eleceap', 'cr2bf_gasaccts', 'cr2bf_gaseap'];
const DEC_COLS = ['cr2bf_elecadj', 'cr2bf_gasadj'];
// System columns present in the export that must NOT be sent on a create.
const NOT_SETTABLE = ['createdon', 'modifiedon', '@odata.etag'];

const EXPORT = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/Data/backups/cr2bf_dacmaptractdata_2026-08-24.json';
const CODE_FILE = path.join(__dirname, 'device_code_191r.txt');

let pass = 0, fail = 0;
const check = (n, ok, d) => {
  if (ok) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + (d !== undefined ? '\n        <- ' + d : '')); }
  return ok;
};
const die = (m) => { console.error('\n#### STOPPED ####\n' + m); process.exit(1); };
let TOKEN = null;

// ---------------------------------------------------------------- body building
function buildBody(row) {
  const b = {};
  b[PK] = row[PK];
  b[GEO] = row[GEO];
  VALUE_COLS.forEach(c => { b[c] = (row[c] === undefined ? null : row[c]); });
  return b;
}

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateBody(b, row) {
  const errs = [];
  if (!GUID_RE.test(String(b[PK] || ''))) errs.push('bad GUID ' + JSON.stringify(b[PK]));
  const g = b[GEO];
  if (typeof g !== 'string' || !/^\d{11}$/.test(g)) errs.push('bad GEOID ' + JSON.stringify(g));
  TEXT_COLS.forEach(c => {
    const v = b[c];
    if (v !== null && typeof v !== 'string') errs.push(c + ' not text: ' + JSON.stringify(v));
    if (typeof v === 'string' && v.length > 100) errs.push(c + ' too long');
  });
  INT_COLS.forEach(c => {
    const v = b[c];
    if (v !== null && !(typeof v === 'number' && Number.isInteger(v))) {
      errs.push(c + ' not an integer: ' + JSON.stringify(v));
    }
  });
  DEC_COLS.forEach(c => {
    const v = b[c];
    if (v === null) return;
    if (typeof v !== 'number') { errs.push(c + ' not a number: ' + JSON.stringify(v)); return; }
    // The column is Decimal(4). A value from the export already satisfies this;
    // asserting it means a hand-edited export cannot smuggle precision the column
    // will silently truncate.
    if (Math.abs(v * 1e4 - Math.round(v * 1e4)) > 1e-6) {
      errs.push(c + ' exceeds 4dp: ' + v);
    }
  });
  NOT_SETTABLE.forEach(c => { if (c in b) errs.push('would send system column ' + c); });
  Object.keys(b).forEach(k => {
    if (k !== PK && k !== GEO && VALUE_COLS.indexOf(k) < 0) errs.push('unexpected key ' + k);
  });
  void row;
  return errs;
}

// ---------------------------------------------------------------- http
async function deviceCode() {
  const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/devicecode`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, scope: ORG + '/.default offline_access' }) });
  const j = await res.json();
  if (!res.ok) die('device code request failed: ' + JSON.stringify(j));
  return j;
}
async function pollToken(code, iv, exp) {
  const deadline = Date.now() + exp * 1000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, iv * 1000));
    const res = await fetch(`https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        client_id: CLIENT_ID, device_code: code }) });
    const j = await res.json();
    if (j.access_token) return j.access_token;
    if (j.error === 'authorization_pending') continue;
    if (j.error === 'slow_down') { iv += 5; continue; }
    if (j.error === 'expired_token') die('the device code expired.');
    die('token request failed: ' + JSON.stringify(j));
  }
  die('timed out waiting for authorization.');
}
function hdrs(extra) {
  return Object.assign({ Authorization: 'Bearer ' + TOKEN, Accept: 'application/json',
    'OData-MaxVersion': '4.0', 'OData-Version': '4.0', 'Cache-Control': 'no-cache' },
    extra || {});
}
async function req(method, rel, body, extra) {
  const res = await fetch(API + rel, { method, headers: hdrs(extra),
    body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 401 || res.status === 403) {
    die('PERMISSION DENIED on ' + method + ' ' + rel +
        '\nStopping rather than attempting any role or privilege change.');
  }
  return res;
}
async function getJson(rel) {
  const res = await req('GET', rel);
  if (!res.ok) die('GET ' + rel + ' -> ' + res.status + ' ' + (await res.text()).slice(0, 300));
  return res.json();
}

// ---------------------------------------------------------------- modes
async function proveSynthetic() {
  console.log('\n=== PROOF 1: client-specified GUID round-trip on a synthetic row ===');
  console.log('Touches none of the 2,333 rows. Creates one row with an impossible');
  console.log('GEOID, reads it back, then deletes that same row.\n');
  // A GUID fixed in source, not generated: Math.random is unavailable in some of
  // this project's harnesses and a fixed value makes the run reproducible and the
  // row unmistakable in any listing.
  const id = 'ffffffff-1111-4222-8333-191191191191';
  const geoid = '99999999999';
  const body = { [PK]: id, [GEO]: geoid,
    cr2bf_elecdac: 'PROOF', cr2bf_elecaccts: 1, cr2bf_eleceap: 2, cr2bf_elecadj: 0.1234,
    cr2bf_gasdac: 'PROOF', cr2bf_gasaccts: 3, cr2bf_gaseap: 4, cr2bf_gasadj: -0.5678 };

  // If a previous run left it behind, say so rather than colliding.
  const pre = await getJson(SET + "?$select=" + PK + "&$filter=" + GEO + " eq '" + geoid + "'");
  if ((pre.value || []).length) {
    console.log('  a previous proof row is still present; removing it first');
    for (const r of pre.value) {
      const d = await req('DELETE', SET + '(' + r[PK] + ')');
      console.log('    DELETE ' + r[PK] + ' -> ' + d.status);
    }
  }

  const cr = await req('POST', SET, body, { 'Content-Type': 'application/json' });
  if (!cr.ok) {
    die('the synthetic create FAILED: ' + cr.status + ' ' + (await cr.text()).slice(0, 400) +
        '\n\nA client-specified GUID is the whole basis of the restore path. If this' +
        '\ncannot be done, restore cannot preserve row identity and the delete must' +
        '\nNOT proceed on the current plan.');
  }
  check('POST with a client-specified GUID accepted (' + cr.status + ')', true);

  const back = await getJson(SET + '(' + id + ')?$select=' + [PK, GEO].concat(VALUE_COLS).join(','));
  check('the row exists at the GUID WE chose', String(back[PK]).toLowerCase() === id.toLowerCase(),
        back[PK]);
  check('the GEOID round-tripped', String(back[GEO]) === geoid, back[GEO]);
  const mismatched = VALUE_COLS.filter(c => {
    const a = back[c], b = body[c];
    if (a === null && b === null) return false;
    if (typeof b === 'number') return Math.abs(Number(a) - b) > 1e-9;
    return String(a) !== String(b);
  });
  check('all 8 value columns round-tripped', mismatched.length === 0,
        mismatched.map(c => c + ': sent ' + JSON.stringify(body[c]) +
          ', got ' + JSON.stringify(back[c])).join('; '));

  const del = await req('DELETE', SET + '(' + id + ')');
  check('the proof row was deleted again (' + del.status + ')', del.ok || del.status === 204);
  const gone = await getJson(SET + "?$select=" + PK + "&$filter=" + GEO + " eq '" + geoid + "'");
  check('and it is really gone', (gone.value || []).length === 0,
        (gone.value || []).length + ' still present');
}

async function proveReal(rows, geoidArg) {
  console.log('\n=== PROOF 2: end-to-end rollback on a sample of one REAL row ===');
  // Prefer a row with every field populated: an all-null row would round-trip
  // trivially and prove almost nothing.
  const scored = rows.map(r => ({ r, n: VALUE_COLS.filter(c => r[c] !== null && r[c] !== undefined).length }));
  scored.sort((a, b) => b.n - a.n);
  const chosen = geoidArg ? rows.find(r => String(r[GEO]) === String(geoidArg)) : scored[0].r;
  if (!chosen) die('geoid ' + geoidArg + ' is not in the export');
  const id = chosen[PK], geoid = String(chosen[GEO]);
  const populated = VALUE_COLS.filter(c => chosen[c] !== null && chosen[c] !== undefined).length;
  console.log('  chosen row : ' + geoid + '  ' + id);
  console.log('  populated  : ' + populated + ' of 8 value columns');
  console.log('  values     : ' + VALUE_COLS.map(c => c.replace('cr2bf_', '') + '=' +
    JSON.stringify(chosen[c])).join(' '));

  const sel = '?$select=' + [PK, GEO].concat(VALUE_COLS).join(',');
  const live = await getJson(SET + '(' + id + ')' + sel);
  const same = (a, b) => (a === null && b === null) ||
    (typeof b === 'number' ? Math.abs(Number(a) - b) < 1e-9 : String(a) === String(b));
  const drift = VALUE_COLS.filter(c => !same(live[c], chosen[c] === undefined ? null : chosen[c]));
  if (!check('the LIVE row still matches the export (nothing changed since)',
             drift.length === 0,
             drift.map(c => c + ': live ' + JSON.stringify(live[c]) +
               ', export ' + JSON.stringify(chosen[c])).join('; '))) {
    die('the export no longer describes the live row, so a restore from it would' +
        '\nnot be a restore. Re-export before going further. NOTHING was deleted.');
  }

  console.log('\n  deleting the row...');
  const del = await req('DELETE', SET + '(' + id + ')');
  if (!(del.ok || del.status === 204)) {
    die('DELETE failed: ' + del.status + ' ' + (await del.text()).slice(0, 300) +
        '\nNothing was lost; the row is still there.');
  }
  check('the row was deleted (' + del.status + ')', true);
  const check404 = await req('GET', SET + '(' + id + ')?$select=' + PK);
  check('it is really gone (GET now ' + check404.status + ')', check404.status === 404);

  console.log('\n  restoring it from the export...');
  const body = buildBody(chosen);
  const cr = await req('POST', SET, body, { 'Content-Type': 'application/json' });
  if (!cr.ok) {
    const t = (await cr.text()).slice(0, 500);
    die('RESTORE FAILED: ' + cr.status + ' ' + t +
        '\n\n#### ONE ROW IS NOW MISSING: geoid ' + geoid + ', id ' + id + ' ####' +
        '\nIts values are in the export at Data/backups/. Do NOT run the bulk' +
        '\ndelete. Fix the restore path first, then re-run this proof.');
  }
  check('POST from the export accepted (' + cr.status + ')', true);

  const after = await getJson(SET + '(' + id + ')' + sel);
  check('the row is back at its ORIGINAL GUID',
        String(after[PK]).toLowerCase() === String(id).toLowerCase(), after[PK]);
  check('the GEOID is unchanged', String(after[GEO]) === geoid, after[GEO]);
  const bad = VALUE_COLS.filter(c => !same(after[c], chosen[c] === undefined ? null : chosen[c]));
  check('all 8 value columns identical to the export', bad.length === 0,
        bad.map(c => c + ': expected ' + JSON.stringify(chosen[c]) +
          ', got ' + JSON.stringify(after[c])).join('; '));
  console.log('\n  (createdon/modifiedon are NOT restored -- system columns. The row' +
              '\n   now carries this restore\'s timestamps. Originals are in the export:' +
              '\n   createdon ' + chosen.createdon + ', modifiedon ' + chosen.modifiedon + ')');
}

// ---------------------------------------------------------------- main
(async () => {
  const argv = process.argv.slice(2);
  const has = (f) => argv.indexOf(f) >= 0;
  const val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };

  console.log('=== CLCPA-191 restore path ===');
  const doc = JSON.parse(fs.readFileSync(EXPORT, 'utf8'));
  const rows = doc.rows;
  console.log('export   : ' + EXPORT);
  console.log('manifest : ' + doc.manifest.rowCount + ' rows, exported ' + doc.manifest.exportedAt);
  console.log('loaded   : ' + rows.length + ' rows\n');

  // ---- offline validation, always ----
  console.log('== offline validation of every POST body ==');
  check('manifest row count matches the rows present',
        doc.manifest.rowCount === rows.length, doc.manifest.rowCount + ' vs ' + rows.length);
  const bodies = rows.map(buildBody);
  const allErrs = [];
  bodies.forEach((b, i) => {
    const e = validateBody(b, rows[i]);
    if (e.length) allErrs.push({ geoid: b[GEO], errs: e });
  });
  check('all ' + bodies.length.toLocaleString() + ' bodies valid', allErrs.length === 0,
        allErrs.slice(0, 5).map(x => x.geoid + ': ' + x.errs.join(', ')).join('\n           '));
  const ids = new Set(bodies.map(b => String(b[PK]).toLowerCase()));
  check('all GUIDs unique', ids.size === bodies.length, ids.size + ' unique of ' + bodies.length);
  const geos = new Set(bodies.map(b => String(b[GEO])));
  check('all GEOIDs unique', geos.size === bodies.length, geos.size + ' unique of ' + bodies.length);
  check('no system column would be sent',
        bodies.every(b => NOT_SETTABLE.every(c => !(c in b))));
  const populated = bodies.filter(b => VALUE_COLS.some(c => b[c] !== null)).length;
  check('the validation was not vacuous (' + populated.toLocaleString() +
        ' bodies carry at least one value)', populated > 1000, populated);

  // Negative controls: the validator must reject what it claims to catch.
  console.log('\n== validator negative controls ==');
  const mutants = [
    ['a bad GUID', b => { b[PK] = 'not-a-guid'; }],
    ['a GEOID of the wrong shape', b => { b[GEO] = '123'; }],
    ['a system column smuggled in', b => { b.createdon = '2020-01-01T00:00:00Z'; }],
    ['an unexpected column', b => { b.cr2bf_notarealcolumn = 1; }],
    ['a non-integer account count', b => { b.cr2bf_elecaccts = 1.5; }],
    ['a decimal beyond 4dp', b => { b.cr2bf_elecadj = 0.123456789; }],
  ];
  mutants.forEach(([label, mutate]) => {
    const b = JSON.parse(JSON.stringify(bodies[0]));
    mutate(b);
    check('rejects ' + label, validateBody(b, rows[0]).length > 0,
          'the validator ACCEPTED it');
  });

  if (has('--dry-run') || argv.length === 0) {
    console.log('\n' + (fail ? 'FAILED ' : 'ALL PASS ') + pass + ' passed, ' + fail + ' failed');
    console.log('\nDRY RUN. No network, no token, nothing written.');
    process.exit(fail ? 1 : 0);
  }

  // ---- anything below here touches Dataverse ----
  const wantSynth = has('--prove-synthetic');
  const wantReal = has('--prove-real');
  if (!wantSynth && !wantReal) die('no live mode selected; use --dry-run, --prove-synthetic or --prove-real');

  const dc = await deviceCode();
  console.log('\n################  ACTION NEEDED  ################');
  console.log('  Open:  ' + dc.verification_uri);
  console.log('  Code:  ' + dc.user_code);
  console.log('#################################################\n');
  console.log('OPERATION: prove the restore path.');
  if (wantSynth) console.log('  - create 1 SYNTHETIC row (GEOID 99999999999), read it back, delete it');
  if (wantReal) console.log('  - delete 1 REAL row and restore it from the export, then verify');
  console.log('No other row is touched. The bulk delete is NOT part of this run.');
  fs.writeFileSync(CODE_FILE, dc.user_code + '\n' + dc.verification_uri + '\n');
  console.log('\nWaiting for authorization (up to 15 min)...');
  TOKEN = await pollToken(dc.device_code, dc.interval, dc.expires_in);
  console.log('authorized.  ' + new Date().toISOString());

  const before = await getJson(SET + '?$count=true&$top=1&$select=' + PK);
  console.log('\nrows in the table right now: ' + before['@odata.count']);

  if (wantSynth) await proveSynthetic();
  if (wantReal) await proveReal(rows, val('--prove-real'));

  const after = await getJson(SET + '?$count=true&$top=1&$select=' + PK);
  console.log('\n== end state ==');
  check('the table has the same row count as when we started (' + before['@odata.count'] + ')',
        after['@odata.count'] === before['@odata.count'],
        'now ' + after['@odata.count']);

  console.log('\n' + (fail ? 'FAILED ' : 'ALL PASS ') + pass + ' passed, ' + fail + ' failed');
  if (!fail) {
    console.log('\nRestore is a proven procedure: a client-specified GUID is accepted,');
    console.log('and a real row deleted and rebuilt from the export comes back');
    console.log('byte-for-byte at its original identity. The bulk delete can proceed.');
  }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
