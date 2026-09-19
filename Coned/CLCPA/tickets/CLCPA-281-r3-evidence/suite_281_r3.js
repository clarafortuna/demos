const _dacRepo = () => {
  const p = require('path'), f = require('fs');
  if (process.env.DAC_REPO) return p.resolve(process.env.DAC_REPO);
  let d = __dirname;
  for (let i = 0; i < 16; i++) {
    if (f.existsSync(p.join(d, '.clcpa-root'))) {
      const two = p.resolve(d, '..', '..');
      return f.existsSync(p.join(two, '.git')) ? two : d;
    }
    const u = p.dirname(d); if (u === d) break; d = u;
  }
  throw new Error('CLCPA project root not found above ' + __dirname + '; set DAC_REPO');
};
/* CLCPA-281 round 3: the READ-ONLY surfaces ask the same header question.
 *
 * THE GESTURE, reproduced in a REAL BROWSER against a served build before any
 * code and again after it (per-step readings in the PR, screenshots beside
 * this file). Section F, table F6, year 2099, user-added:
 *
 *   PRE-FIX   level 1: Network or Load Area | Borough / County |
 *                      NON-NETWORK(x2) | NETWORK(x2) | Grand Total
 *             level 2: Bay Ridge | Brooklyn | 11 | 22 | 33 | 44 | 110
 *             body rows: 1
 *             -> a REAL DATA ROW promoted into the header band, and gone from
 *                the body. Not "a missing header level": a lost row.
 *
 *   POST-FIX  level 2: Non- Excludable | Excludable | Non- Excludable |
 *                      Excludable
 *             body rows: 2  (Bay Ridge restored, Test Row after it)
 *
 *   SEED 2025 unchanged either side: same two levels, 24 body rows.
 *
 * THE CAUSE, and it is round 2's cause on three more surfaces. What the TABLE
 * declares (header_levels) and whether a GIVEN YEAR carries those rows are two
 * questions. Round 2 taught the editor to ask the second. These three still
 * subtracted the declared count unconditionally:
 *
 *   resolveRows      -> renderTable slices headerLevels off the top, so the
 *                       first data row became the second header line, and
 *                       pctHeader/columnNumericMask were then measured off it
 *   compareColWidths -> over EVERY year, so each user-added year lost its
 *                       first row from the width vector
 *   bodyRowsCurrent/Prev -> the has-data check behind the prior-year panel and
 *                       the NO BASELINE chip
 *
 * This suite proves the logic and the structure. The rendered surface is the
 * browser's job: suite output is not sufficient on its own, which is why the
 * three hosted FAILs happened.
 *
 * BASE predates the change: 88e7923.
 *
 * Run:  node suite_281_r3.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = _dacRepo() + '';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || '88e7923';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);
const SRC = fs.readFileSync(APP, 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => { try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); } };
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p);

/** pull a 2-space-indented function out of app.js by name, brace-balanced */
function grab(name, src) {
  const anchor = '\r\n  function ' + name + '(';
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error('grab: no function ' + name);
  let j = src.indexOf('{', i), d = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) { j = k; break; } }
  }
  return src.slice(i + 2, j + 1);
}

/** pull a 2-space-indented const/let/var out of app.js, balanced to its ; */
function grabDecl(name, src) {
  const anchor = '\r\n  const ' + name + ' = ';
  let i = src.indexOf(anchor);
  let kw = 'const';
  if (i < 0) { i = src.indexOf('\r\n  var ' + name + ' = '); kw = 'var'; }
  if (i < 0) { i = src.indexOf('\r\n  let ' + name + ' = '); kw = 'let'; }
  if (i < 0) throw new Error('grabDecl: no declaration ' + name);
  let d = 0;
  for (let k = i + 2; k < src.length; k++) {
    const c = src[k];
    if (c === '{' || c === '[' || c === '(') d++;
    else if (c === '}' || c === ']' || c === ')') d--;
    else if (c === ';' && d === 0) return src.slice(i + 2, k + 1);
  }
  throw new Error('grabDecl: unterminated ' + kw + ' ' + name);
}

/** a function if there is one, otherwise a declaration -- never a stub */
function grabAny(name, src) {
  try { return grab(name, src); } catch (e) { return grabDecl(name, src); }
}

/** assemble named functions from app.js and hand back their real closure */
function assemble(names, src, extra) {
  const body = names.map(n => grabAny(n, src)).join('\n');
  const decl = Object.keys(extra || {});
  const fn = new Function(...decl,
    body + '\nreturn {' + names.map(n => n + ':' + n).join(',') + '};');
  return fn(...decl.map(k => extra[k]));
}

/* Follow the ReferenceErrors, which is how a real closure is discovered.
 *
 * EVERY name resolved this way is GRABBED FROM app.js -- nothing is stubbed.
 * A stub would be the harness testing its own copy, which is a named defect in
 * this repo: a sweep once ran nine mutations against a re-implementation and
 * moved nothing. If a name cannot be grabbed, this throws rather than
 * substituting anything, and the resolved list is printed so the evidence
 * says exactly what was assembled. */
function assembleResolving(seed, src, extra, label, probe) {
  const names = seed.slice();
  for (let i = 0; i < 40; i++) {
    try {
      const H = assemble(names, src, extra);
      /* EXERCISED, not merely built. Dependencies reached only on the call
       * path -- columnNumericMask reaches detectCurrencyColumns that way --
       * are invisible to assembly alone, and a guard that stopped at "it
       * assembled" would be reporting success for a function it never ran. */
      if (probe) probe(H);
      if (label) log('       ' + label + ' assembled and exercised, ' + names.length +
        ' real functions: ' + names.join(', '));
      return H;
    } catch (e) {
      const m = /(\w+) is not defined/.exec((e && e.message) || '');
      if (!m) throw e;
      if (names.indexOf(m[1]) >= 0) throw e;   /* grabbed and still missing */
      names.push(m[1]);                        /* grabAny() throws if it is not there */
    }
  }
  throw new Error('assembleResolving: still unresolved after 40 rounds');
}

/* F6 shaped two ways: a year that CARRIES its sub-header, and a user-added one
 * that does not. Taken from the real table so the shape is not invented. */
const SUB = P.tables.F6.data['2025'][0];
const DATA_A = ['Bay Ridge', 'Brooklyn', 11, 22, 33, 44, 110];
const DATA_B = ['Test Row', 'Queens', 1, 2, 3, 4, 10];
const f6 = (rows2099) => {
  const t = JSON.parse(JSON.stringify(P.tables.F6));
  t.data['2099'] = rows2099.map(r => r.slice());
  return t;
};

log('======================================================================');
log('CLCPA-281 round 3 -- the read-only surfaces ask the same question');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the shared helper exists and is the ONE place ------------------- */
log('');
log('A. ONE HELPER, ASKED PER YEAR');
guard('A-block', () => {
  ok(/function storedHeaderRowsInYear\(table, year\) \{/.test(codeOnly(SRC)),
    'A0 storedHeaderRowsInYear is declared');
  ok(!/function storedHeaderRowsInYear/.test(codeOnly(BASE_SRC)),
    'A1 and did NOT exist on BASE -- this is the new shared answer');
  const H = assemble(['ingestHeaderRowCount', 'ingestRowIsStoredHeader',
    'ingestYearCarriesHeaderRows', 'storedHeaderRowsInYear'], SRC);
  const carries = f6([SUB, DATA_A, DATA_B]);
  const added = f6([DATA_A, DATA_B]);
  ok(H.storedHeaderRowsInYear(carries, '2099') === 1,
    'A2 a year that CARRIES the sub-header reports 1 stored header row');
  ok(H.storedHeaderRowsInYear(added, '2099') === 0,
    'A3 a USER-ADDED year reports 0 -- its first row is data');
  ok(H.storedHeaderRowsInYear(carries, '2025') === 1,
    'A4 the seed year is unaffected');
  ok(H.storedHeaderRowsInYear(carries, '2044') === 0,
    'A5 a year the table does not have reports 0, not a throw');
  /* the two shapes that must not be swept in with the two-level family */
  ok(H.storedHeaderRowsInYear(P.tables.D1, '2025') === 0,
    'A6 D1 carries header_levels 0 and its first row is genuine data');
  ok(H.storedHeaderRowsInYear(P.tables.H1, '2025') === 0,
    'A7 a one-level table reports 0');
  ['A9', 'A10'].forEach((id) => {
    ok(H.storedHeaderRowsInYear(P.tables[id], '2025') === 1,
      'A8.' + id + ' the other two-level tables still report 1');
  });
  /* THE PHANTOM EMPTY ROW IS A LIVE CASE, not a hypothetical: F6/2099 carries
   * one in the org, the CLCPA-224 residue left by the build round 2 fixed. On
   * the read-only surfaces it must be DATA -- an empty row names no column, so
   * it is not anatomy, and the sub-header is borrowed over it.
   *
   * Added because a mutation went unnoticed without it: the guard above reads
   * a row with a LABEL, which returns false at the label check and never
   * reaches the predicate this assertion targets. */
  const phantom = f6([[null, null, null, null, null, null, null], DATA_B]);
  ok(H.storedHeaderRowsInYear(phantom, '2099') === 0,
    'A9p an ALL-EMPTY first row is data, so the year still reports 0');
});

/* ---- B. the three sites ask it, and the old form is GONE ---------------- */
log('');
log('B. EVERY READ-ONLY SURFACE ASKS THE SAME QUESTION');
guard('B-block', () => {
  const code = codeOnly(SRC);
  const was = codeOnly(BASE_SRC);
  ok(/const borrowed = storedHeaderRowsInYear\(t, yr\)/.test(code),
    'B1 the section table asks before it borrows');
  ok(/\.slice\(storedHeaderRowsInYear\(t, year\)\)/.test(code) &&
     /\.slice\(storedHeaderRowsInYear\(t, prevYear\)\)/.test(code),
    'B2 the has-data check asks PER YEAR, current and prior separately');
  ok(/\.slice\(storedHeaderRowsInYear\(table, y\)\)/.test(code),
    'B3 the width vector asks inside its own per-year loop');
  /* the unconditional subtraction, in each of its three spellings */
  ok(was.indexOf('const storedHeaderRows = Math.max(0, headerLevels - 1);') >= 0,
    'B4 (BASE really carried the unconditional form)');
  ok(code.indexOf('const storedHeaderRows = Math.max(0, headerLevels - 1);') < 0,
    'B5 and it is GONE, not merely outnumbered');
  ok(code.indexOf('.slice(Math.max(0, headerLevels - 1))') < 0,
    'B6 the width loop no longer subtracts a declared count');
  ok(!/const headerLevels = \(opts && opts\.headerLevels\) \|\| 1;/.test(code),
    'B7 and compareColWidths keeps no second copy of it to disagree with');
});

/* ---- C. the real closure, called ---------------------------------------- */
log('');
log('C. compareColWidths, ASSEMBLED WITH ITS REAL DEPENDENCIES');
guard('C-block', () => {
  /* A hand-fed slice cannot see a missing closure, so this one is built with
   * the dependency list the function actually has and then CALLED. */
  const names = ['compareColWidths', 'storedHeaderRowsInYear', 'ingestHeaderRowCount',
    'ingestRowIsStoredHeader', 'ingestYearCarriesHeaderRows', 'getTableSchema',
    'columnNumericMask', 'getTableBody', 'shiftSchemaYears'];
  let H = null, why = '';
  try { H = assembleResolving(names, SRC, { state: { payload: P }, NOT_RECONCILED_TABLES: [] }, 'NEW', function(H){ H.compareColWidths(f6([DATA_A, DATA_B]), { tableId: 'F6', headerLevels: 2 }); }); }
  catch (e) { why = e && e.message; }
  ok(H !== null, 'C0 it assembles with its real dependency list' + (why ? ' -- ' + why : ''));
  if (!H) return;
  const added = f6([DATA_A, DATA_B]);
  const w = H.compareColWidths(added, { tableId: 'F6', headerLevels: 2 });
  ok(w && w.length === 7, 'C1 it returns a width per column -- ' + (w && w.length));
  /* the behavioural proof: BASE dropped DATA_A from every user-added year, so
   * a table whose ONLY wide cell lives in that row sized its column short. */
  const wide = f6([['AN EXTREMELY LONG NETWORK NAME INDEED', 'Brooklyn', 11, 22, 33, 44, 110], DATA_B]);
  const wNow = H.compareColWidths(wide, { tableId: 'F6', headerLevels: 2 });
  let B = null;
  try { B = assembleResolving(['compareColWidths'], BASE_SRC,
    { state: { payload: P }, NOT_RECONCILED_TABLES: [] }, 'BASE', function(H){ H.compareColWidths(f6([DATA_A, DATA_B]), { tableId: 'F6', headerLevels: 2 }); }); } catch (e) { B = null; }
  ok(B !== null, 'C2 (BASE assembles too, so the comparison is like for like)');
  if (B) {
    const wWas = B.compareColWidths(wide, { tableId: 'F6', headerLevels: 2 });
    ok(wNow[0] > wWas[0],
      'C3 the long label now widens column 0 -- BASE never saw that row: ' +
      wWas[0] + ' -> ' + wNow[0]);
  }
  /* and a seed-only table must be byte-identical between the two builds */
  if (B) {
    const a = JSON.stringify(H.compareColWidths(P.tables.H1, { tableId: 'H1', headerLevels: 1 }));
    const b = JSON.stringify(B.compareColWidths(P.tables.H1, { tableId: 'H1', headerLevels: 1 }));
    ok(a === b, 'C4 a one-level table is measured EXACTLY as before');
    const a2 = JSON.stringify(H.compareColWidths(P.tables.F6, { tableId: 'F6', headerLevels: 2 }));
    const b2 = JSON.stringify(B.compareColWidths(P.tables.F6, { tableId: 'F6', headerLevels: 2 }));
    ok(a2 === b2, 'C5 and so is F6 on its seed years alone');
  }
});

/* ---- D. the borrowed anatomy is the TABLE's ----------------------------- */
log('');
log('D. WHAT A USER-ADDED YEAR BORROWS');
guard('D-block', () => {
  const H = assemble(['ingestHeaderRowCount', 'ingestRowIsStoredHeader',
    'ingestYearCarriesHeaderRows', 'ingestStoredHeaderRows'], SRC);
  const added = f6([DATA_A, DATA_B]);
  const borrowed = H.ingestStoredHeaderRows(added, H.ingestHeaderRowCount(added, Infinity));
  ok(borrowed.length === 1, 'D1 exactly one sub-header row is borrowed');
  ok(JSON.stringify(borrowed[0]) === JSON.stringify(SUB),
    'D2 and it is the TABLE\'s own, not the year\'s first row -- ' +
    JSON.stringify(borrowed[0]).slice(0, 60));
  ok(borrowed[0] !== SUB, 'D3 returned as a CLONE, so rendering cannot mutate the payload');
});

/* ---- E. nothing else moved ---------------------------------------------- */
log('');
log('E. THE SURFACES THAT WERE ALREADY RIGHT');
guard('E-block', () => {
  const code = codeOnly(SRC);
  ok(/const declaredHeaderRows = ingestHeaderRowCount\(table, Infinity\);/.test(code),
    'E1 the editor still asks its own question the way round 2 left it');
  ok(/const headerCount = ingestHeaderRowCount\(table, Infinity\);/.test(code),
    'E2 and the template writer still asks the table');
  ok(JSON.stringify(P.tables.F6.data['2025'][0]) === JSON.stringify(SUB),
    'E3 no stored data was touched by this change');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha that predates the change');
  ok(/if \(probe\) probe\(H\);/.test(self) && /assembleResolving\(names, SRC,/.test(self),
    'X2 at least one guard builds a real function with its real closure AND CALLS IT');
  ok(/return grabDecl\(name, src\);/.test(self),
    'X3a dependencies are grabbed from app.js, never stubbed');
  ok(fs.existsSync(path.join(__dirname, 'repro_281_r3_prefix.png')) &&
     fs.existsSync(path.join(__dirname, 'repro_281_r3_postfix.png')),
    'X3 the browser gesture evidence is committed beside this suite');
  /* the structural pins above are read from codeOnly, because a doc comment
   * quoting the old code has satisfied a search for the old code eight times */
  ok(codeOnly('/* const storedHeaderRows = Math.max(0, headerLevels - 1); */')
      .indexOf('storedHeaderRows') < 0,
    'X4 codeOnly really strips a comment quoting the old form');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-281-r3-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
