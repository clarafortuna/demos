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
/* CLCPA-282 (option A) and CLCPA-285: a two-level table round-trips.
 *
 * THE GESTURE, in a real browser through the real Add Data dialog and the real
 * file input, on a user-added year, with CSVs taken from the TEMPLATES THEMSELVES
 * for that year rather than invented:
 *
 *   PRE-FIX   A9  "This file cannot be imported: The file has two columns with
 *                  the same heading, so which one wins is ambiguous."  0 rows
 *             A10 the same.  0 rows
 *             H1  imports, 3 matching columns
 *
 *   POST-FIX  A9  6 matching columns, 12 values,
 *                  Incentives 100 50 200 120 100 140
 *             A10 6 matching columns, 8 values, and its % DAC columns compute
 *             H1  unchanged, 3 matching columns
 *             A9 with a SINGLE header row: still refused on its own
 *                  duplicates, and no data row is eaten
 *
 * THE CAUSE. A9, A10 and F6 carry their headings on two rows and NEITHER ROW
 * identifies a column alone: A9's group row repeats each year, its sub row
 * repeats Total and DAC three times each. Only (group, sub) is unique. The
 * importer read fileRows[0], so a CSV saved from the app's OWN template was
 * refused with a complaint that is true of that row and says nothing about the
 * file. A9 and A10 had no working CSV ingestion on any year.
 *
 * THE RULING: option A. Two header rows, matched on the pair through the
 * shared header-anatomy helpers, N=1 collapsing to today's behaviour, and the
 * duplicate-heading rejection made pair-aware.
 *
 * BASE predates the change: 7dd0b90.
 *
 * Run:  node suite_282.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = _dacRepo() + '';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || '7dd0b90';
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
function grabDecl(name, src) {
  let i = src.indexOf('\r\n  const ' + name + ' = ');
  if (i < 0) i = src.indexOf('\r\n  var ' + name + ' = ');
  if (i < 0) throw new Error('grabDecl: no declaration ' + name);
  let d = 0;
  for (let k = i + 2; k < src.length; k++) {
    const c = src[k];
    if (c === '{' || c === '[' || c === '(') d++;
    else if (c === '}' || c === ']' || c === ')') d--;
    else if (c === ';' && d === 0) return src.slice(i + 2, k + 1);
  }
  throw new Error('grabDecl: unterminated ' + name);
}
const grabAny = (n, s) => { try { return grab(n, s); } catch (e) { return grabDecl(n, s); } };
function assemble(names, src, extra) {
  const body = names.map(n => grabAny(n, src)).join('\n');
  const decl = Object.keys(extra || {});
  return new Function(...decl, body + '\nreturn {' + names.map(n => n + ':' + n).join(',') + '};')
    (...decl.map(k => extra[k]));
}

const KEYS = ['ingestHeaderKeys', 'ingestHeaderName', 'normIngestKey', 'INGEST_KEY_SEP'];
/* the real header rows of the real tables, taken from the payload */
const A9_GROUP = P.tables.A9.schema_by_year['2025'];
const A9_SUB = P.tables.A9.data['2025'][0];
const F6_GROUP = P.tables.F6.schema_by_year['2025'];
const F6_SUB = P.tables.F6.data['2025'][0];
const H1_GROUP = P.tables.H1.schema_by_year['2025'];

log('======================================================================');
log('CLCPA-282 / 285 -- a column is identified by its header PAIR');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the defect, on the build that shipped it ----------------------- */
log('');
log('A. THE DEFECT, ON BASE');
guard('A-block', () => {
  ok(!/function ingestHeaderKeys/.test(codeOnly(BASE_SRC)),
    'A1 BASE had no notion of a composed header key');
  const b = grab('buildIngestImport', BASE_SRC);
  ok(/const header = fileRows\[0\]\.map\(normIngestKey\);/.test(b),
    'A2 it read fileRows[0] and nothing else');
  ok(/const body = fileRows\.slice\(1\);/.test(b),
    'A3 and took every later row as data');
  /* the rows that made that fatal: each alone repeats */
  const dup = (row) => {
    const seen = {}, out = [];
    row.forEach((v) => {
      const k = String(v == null ? '' : v).trim().toLowerCase();
      if (!k) return;
      if (seen[k]) out.push(k); else seen[k] = 1;
    });
    return out;
  };
  ok(dup(A9_GROUP).length > 0,
    'A4 A9 group row repeats on its own: ' + JSON.stringify(dup(A9_GROUP)));
  ok(dup(A9_SUB).length > 0,
    'A5 and so does its sub row: ' + JSON.stringify(dup(A9_SUB)));
  ok(dup(F6_SUB).length > 0,
    'A6 F6 too -- its sub-labels sit under two different spans: ' +
    JSON.stringify(dup(F6_SUB)));
});

/* ---- B. the pair is unique --------------------------------------------- */
log('');
log('B. THE PAIR IDENTIFIES THE COLUMN');
guard('B-block', () => {
  const H = assemble(KEYS, SRC, {});
  const uniq = (keys) => {
    const seen = {}, dups = [];
    keys.forEach((k) => { if (!k) return; if (seen[k]) dups.push(k); else seen[k] = 1; });
    return dups;
  };
  const a9 = H.ingestHeaderKeys([A9_GROUP, A9_SUB], 2);
  ok(uniq(a9).length === 0, 'B1 A9 has no duplicate pair -- ' + JSON.stringify(uniq(a9)));
  ok(a9.length === A9_GROUP.length, 'B2 one key per column');
  const f6 = H.ingestHeaderKeys([F6_GROUP, F6_SUB], 2);
  ok(uniq(f6).length === 0, 'B3 F6 has none either');
  /* the SPAN: a blank group cell means "same group as the cell to my left" */
  ok(f6[2].split(H.INGEST_KEY_SEP)[0] === f6[3].split(H.INGEST_KEY_SEP)[0],
    'B4 F6 columns 2 and 3 share a carried-forward group');
  ok(f6[2] !== f6[3], 'B5 but differ by their sub-label, which is the point');
  ok(f6[2].split(H.INGEST_KEY_SEP)[0] !== f6[4].split(H.INGEST_KEY_SEP)[0],
    'B6 and columns 2 and 4 sit under DIFFERENT spans');
  /* ONE LEVEL IS UNCHANGED, which is what keeps this narrow */
  const h1 = H.ingestHeaderKeys([H1_GROUP], 1);
  ok(JSON.stringify(h1) === JSON.stringify(H1_GROUP.map(H.normIngestKey)),
    'B7 a one-level table composes exactly the old single-row keys');
  ok(h1.every(k => k.indexOf(H.INGEST_KEY_SEP) < 0),
    'B8 with no separator in them at all');
  /* a column blank on BOTH rows stays blank, so the spacer guards still work */
  const blank = H.ingestHeaderKeys([['', 'x'], ['', 'y']], 2);
  ok(blank[0] === '', 'B9 a column blank on both rows composes to blank');
});

/* ---- C. the importer asks the shared question -------------------------- */
log('');
log('C. HOW MANY OF THE FILE\'S ROWS ARE HEADER');
guard('C-block', () => {
  const code = codeOnly(grab('buildIngestImport', SRC));
  ok(/const declaredSub = ingestHeaderRowCount\(iTable, Infinity\);/.test(code),
    'C1 the TABLE says how many it can have');
  ok(/ingestYearCarriesHeaderRows\(fileRows\.slice\(1\), declaredSub\)/.test(code),
    'C2 and the FILE says whether it does -- the same shared predicate');
  ok(/const body = fileRows\.slice\(headerCount\);/.test(code),
    'C3 the body starts after however many header rows were read');
  ok(/const schemaNorm = ingestHeaderKeys\(/.test(code),
    'C4 the schema side is composed the SAME way, so the two cannot disagree');
  ok(/const labelCol = header\.indexOf\(schemaNorm\[0\]\);/.test(code),
    'C5 the label column is matched on the composed key like any other');
  ok(!/header\.indexOf\(normIngestKey\(schema\[s\]\)\)/.test(code),
    'C6 and no column is matched on a raw single-row heading any more');
  ok(/column: ingestHeaderName\(headerLines, headerCount, idx\)/.test(code),
    'C7 a rejection names the column as the eye reads it, both rows joined');
});

/* ---- D. the guardians --------------------------------------------------- */
log('');
log('D. WHAT MUST NOT CHANGE');
guard('D-block', () => {
  const H = assemble(KEYS, SRC, {});
  /* a two-level file given ONE header row still reads as one, and is refused
   * on its own duplicates rather than quietly consuming a data row */
  const one = H.ingestHeaderKeys([A9_GROUP], 1);
  const seen = {};
  let dup = false;
  one.forEach((k) => { if (!k) return; if (seen[k]) dup = true; seen[k] = 1; });
  ok(dup === true,
    'D1 a single-header-row A9 file still collides, exactly as before');
  /* the separator cannot be forged from a spreadsheet cell */
  ok(H.INGEST_KEY_SEP === String.fromCharCode(31),
    'D2 the separator is a control character, so a heading cannot forge a pair');
  ok(H.normIngestKey('  Total  ') === 'total',
    'D3 normIngestKey still trims, lowercases and collapses whitespace');
  /* D1 is the table's own declaration, untouched by this ticket */
  ok(P.tables.D1.header_levels === 0,
    'D4 D1 still declares 0 and is not swept into the two-level family');
  ok(JSON.stringify(P.tables.A9.data['2025'][0]) === JSON.stringify(A9_SUB),
    'D5 and no stored data was touched');
});

/* ---- E. the name a message uses ---------------------------------------- */
log('');
log('E. WHAT A REJECTION CALLS A COLUMN');
guard('E-block', () => {
  const H = assemble(KEYS, SRC, {});
  ok(H.ingestHeaderName([A9_GROUP, A9_SUB], 2, 1) === '2024 / Total',
    'E1 both rows, joined -- ' + H.ingestHeaderName([A9_GROUP, A9_SUB], 2, 1));
  ok(H.ingestHeaderName([H1_GROUP], 1, 1) === 'Non-DAC Repairs',
    'E2 and a one-level table names its single heading');
  ok(H.ingestHeaderName([['', 'a'], ['', 'b']], 2, 0) === '',
    'E3 a column blank on both rows has no name to give');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha that predates the change');
  /* the header rows come from the PAYLOAD, not retyped: a value retyped into a
   * harness is a value the harness can agree with while the app is wrong */
  ok(/P\.tables\.A9\.schema_by_year\['2025'\]/.test(self) &&
     /P\.tables\.A9\.data\['2025'\]\[0\]/.test(self),
    'X2 the header rows are read from the payload, never retyped');
  ok(fs.existsSync(path.join(__dirname, 'gesture_282.js')),
    'X3 the browser gesture is committed beside this suite');
  const g = fs.readFileSync(path.join(__dirname, 'gesture_282.js'), 'utf8');
  ok(/ONE header row/.test(g),
    'X4 and it drives the single-header-row case too, not only the happy one');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-282-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
