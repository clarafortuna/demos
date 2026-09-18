/* CLCPA-277 -- the wrong YEAR is named, as the wrong TABLE already was.
 *
 * CLCPA-264 catches a file named for another table. The year was silent:
 * H1-2099-example.csv imported into 2097 raised nothing anywhere, and a year's
 * figures are exactly as wrong in the wrong year.
 *
 * Generic and digit-bounded: no list of years, so it works on a reporting year
 * nobody has added yet, and "v20991" is not a year.
 *
 * BASE predates the change: 22c96cc (CLCPA-276's tip).
 *
 * Run:  node suite_277.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
/* PINNED ON BOTH SIDES (CLAUDE.md), the standing model. The post-change
 * side reads 7260063, this ticket's own commit, because a
 * blast-radius claim can only be true at the commit that made the change
 * -- never on a tip that also carries the tickets merged after it.
 * DAC_APP_OVERRIDE still wins, so the mutation runner keeps working. */
const NEWREV = process.env.DAC_NEW_COMMIT || '7260063';
const BASE = process.env.DAC_BASE_COMMIT || '22c96cc';
const APP = process.env.DAC_APP_OVERRIDE || ('git show ' + NEWREV + ':' + REL);
const SRC = process.env.DAC_APP_OVERRIDE
  ? fs.readFileSync(process.env.DAC_APP_OVERRIDE, 'utf8')
  : execSync('git show ' + NEWREV + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => { try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); } };
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p);

function api(src, want) {
  const L = src.split('\r\n'); const TOP = [];
  L.forEach((ln, n) => { const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n }); });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (n) => { const k = TOP.findIndex(d => d.name === n);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n'); };
  const parts = [], have = new Set();
  const add = (n) => { if (have.has(n)) return false; const f = find(n);
    if (!f) return false; have.add(n); parts.push(f); return true; };
  want.forEach(add);
  const make = () => new Function('const state={};' + parts.join('\n\n') +
    '\nreturn {' + want.join(',') + '};')();
  return (fn) => {
    for (let r = 0; r < 500; r++) {
      try { return fn(make()); }
      catch (e) { const m = /(\w+) is not defined/.exec(e.message);
        if (m && add(m[1])) continue; throw e; }
    }
    throw new Error('dependency resolution did not converge');
  };
}
const run = api(SRC, ['declaredYearFromFilename', 'importYearNotice',
  'renderIngestImportResult']);

const year = (n) => run(a => a.declaredYearFromFilename(n));
const notice = (n, y) => run(a => a.importYearNotice(n, y));

log('======================================================================');
log('CLCPA-277 -- the wrong year is named');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the reported case ----------------------------------------------- */
log('');
log('A. THE REPORTED CASE');
guard('A-block', () => {
  ok(year('H1-2099-example.csv') === '2099',
    'A1 H1-2099-example.csv declares 2099');
  const n = notice('H1-2099-example.csv', '2097');
  ok(!!n, 'A2 importing it into 2097 raises an advisory');
  ok(/\b2099\b/.test(n) && /\b2097\b/.test(n),
    'A3 naming BOTH years -- the file\'s and the target\'s');
  ok(notice('H1-2099-example.csv', '2099') === null,
    'A4 and importing it into 2099 says nothing');
});

/* ---- B. generic, digit-bounded, no list -------------------------------- */
log('');
log('B. DERIVED GENERICALLY, WITH DIGIT BOUNDARIES');
guard('B-block', () => {
  ok(year('A10-2025.csv') === '2025',
    'B1 a table id in the name does not become a year -- A10-2025 gives 2025');
  ok(year('A19-2025.csv') === '2025' && year('A20-1999.csv') === '1999',
    'B1b including ids whose digits look year-ish. MEASURED: a table id is a ' +
    'letter and one or two digits and cannot reach four, so the id-stripping ' +
    'step I first wrote changed the answer for NONE of 13 plausible names and ' +
    'was deleted rather than left as a branch that cannot fire');
  ok(year('2097_H1.csv') === '2097', 'B2 a leading year is found');
  ok(year('B2-1999-old.csv') === '1999', 'B3 and a 19xx year');
  ok(year('H1.csv') === null, 'B4 a name with no year declares none');
  /* THE CLCPA-252 LESSON: \b sits between a digit and a letter */
  ok(year('v20991-notes.csv') === null,
    'B5 a five-digit run is NOT a year -- the digit boundary holds');
  ok(year('report-12099.csv') === null, 'B6 nor one with a digit in front');
  ok(year('H1-2024-vs-2025.csv') === null,
    'B7 a name carrying TWO different years declares neither');
  ok(year('H1-2099-example (1).csv') === '2099',
    'B8 and a browser\'s "(1)" suffix does not confuse it');
  /* a year nobody has added yet still works: no list is consulted */
  ok(year('H1-2088-draft.csv') === '2088',
    'B9 a year that is in no payload and no selector still resolves');
  const code = codeOnly(SRC);
  ok(!/\b(2023|2024|2025)\b/.test(codeOnly(
    code.slice(code.indexOf('function declaredYearFromFilename'),
      code.indexOf('function importIdentityNotice')))),
    'B10 and the derivation names no year at all');
});

/* ---- C. both surfaces, like CLCPA-264 ---------------------------------- */
log('');
log('C. BOTH SURFACES');
guard('C-block', () => {
  const code = codeOnly(SRC);
  ok(/const yrNote = importYearNotice\(staged\.name, target\(\)\.year\);/.test(code),
    'C1 STAGED in the Add Data modal, from the dropdown the operator can change');
  ok(/id="dlg-year-warn"/.test(code), 'C2 with its own staged line');
  ok(/plan\.yearNotice = importYearNotice\(staged\.name, i\.year\);/.test(code),
    'C3 and POST-LOAD on the plan');

  const html = run(a => a.renderIngestImportResult({
    ok: true, populated: [1, 2], rejections: [], addedRows: [], blankSkipped: [],
    matchedColumns: [], keyColumns: [], fileRowCount: 2,
    notTouched: { computed: [], unmatchedColumns: [], unmatchedRows: [] },
    unitNotices: [], reconcileNotices: [], identityNotice: null,
    yearNotice: 'This file is named for 2099, but it is being imported into 2097. x',
  }));
  ok(/ingest-import-notice is-alert/.test(html),
    'C4 the post-load box is RED -- the CLCPA-266 component');
  ok(/Check the year this file was for/.test(html), 'C5 with its own heading');
  ok(/2099/.test(html) && /2097/.test(html), 'C6 and both years');

  /* both advisories can be true at once, and both are said */
  const both = run(a => a.renderIngestImportResult({
    ok: true, populated: [1], rejections: [], addedRows: [], blankSkipped: [],
    matchedColumns: [], keyColumns: [], fileRowCount: 1,
    notTouched: { computed: [], unmatchedColumns: [], unmatchedRows: [] },
    unitNotices: [], reconcileNotices: [],
    identityNotice: 'named for another table', yearNotice: 'named for another year',
  }));
  ok((both.match(/ingest-import-notice is-alert/g) || []).length === 2,
    'C7 a file wrong in BOTH ways raises TWO red boxes -- different mistakes');

  const none = run(a => a.renderIngestImportResult({
    ok: true, populated: [1], rejections: [], addedRows: [], blankSkipped: [],
    matchedColumns: [], keyColumns: [], fileRowCount: 1,
    notTouched: { computed: [], unmatchedColumns: [], unmatchedRows: [] },
    unitNotices: [], reconcileNotices: [], identityNotice: null, yearNotice: null,
  }));
  ok(!/is-alert/.test(none), 'C8 and a clean import raises neither');
});

/* ---- D. advisory only --------------------------------------------------- */
log('');
log('D. ADVISORY ONLY');
guard('D-block', () => {
  const code = codeOnly(SRC);
  const fn = code.slice(code.indexOf('function importYearNotice'),
    code.indexOf('function importIdentityNotice'));
  ok(!/reject|ok = false|throw/.test(fn), 'D1 the advisory rejects nothing');
  ok(!/plan\.ok[\s]*=/.test(code.slice(code.indexOf('plan.yearNotice'),
    code.indexOf('plan.yearNotice') + 200)),
    'D2 and the call site never touches plan.ok');
  /* CLCPA-264's own notice must be untouched */
  const grab = (s, n) => {
    const a = s.indexOf('\r\n  function ' + n + '(');
    return a < 0 ? null : s.slice(a, s.indexOf('\r\n  }', a));
  };
  ok(grab(SRC, 'importIdentityNotice') === grab(BASE_SRC, 'importIdentityNotice'),
    'D3 importIdentityNotice is BYTE-IDENTICAL to BASE');
  ok(grab(SRC, 'declaredTableFromFilename') === grab(BASE_SRC, 'declaredTableFromFilename'),
    'D4 and so is declaredTableFromFilename');
  const added = SRC.split('\r\n').filter(l => BASE_SRC.indexOf(l) < 0)
    .filter(l => l.trim() && !/^\s*[*/]/.test(l.trim()));
  ok(!added.some(l => /['"](?:19|20)\d{2}['"]/.test(l)),
    'D5 no added code line names a year');
  ok(!added.some(l => /['"][A-J]\d+['"]/.test(l)), 'D6 nor a table');
});

/* ---- X. the harness ----------------------------------------------------- */
log('');
log('X. THE HARNESS');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  const m = /const BASE = process\.env\.DAC_BASE_COMMIT \|\| '([0-9a-f]+)';/.exec(self);
  ok(!!m && /^[0-9a-f]{7,40}$/.test(m[1]), 'X1 BASE is a literal sha -- ' + (m ? m[1] : 'none'));
  ok(BASE_SRC.indexOf('declaredYearFromFilename') < 0, 'X2 and predates this ticket');
  ok(/^function declaredYearFromFilename\b/.test(String(run(a => a.declaredYearFromFilename))),
    'X3 the function under test is the one sliced from app.js');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-277-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
