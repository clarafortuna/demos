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
/* CLCPA-267 -- a borrowed schema keeps the donor's SHAPE, not its year words.
 *
 * E1's money column read "2025 Total Investment" on any reporting year. The
 * ticket called it a hardcode; it is not. The stored schemas are correct per
 * year, and getTableSchema's fallback (CLCPA-244) borrows the NEWEST year that
 * has one -- so a fresh year correctly borrows 2025's shape and incorrectly
 * inherits 2025's words.
 *
 * The fix cannot be "substitute the reporting year": this payload contains
 * headings that deliberately name a DIFFERENT year from the reporting one, and
 * overwriting those destroys a prior-year comparison. Both populations are
 * MEASURED here rather than taken from a code comment. Every year token shifts
 * by the same delta instead, so relative offsets survive.
 *
 * BASE predates the change: 6ee833b, this branch's parent (CLCPA-273's tip).
 *
 * Run:  node suite_267.js
 */
const fs = require('fs');
const { execFileSync } = require('child_process');

const REPO = _dacRepo() + '';
const PAYLOAD = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/payload.json';
const BASE = process.env.DAC_BASE_COMMIT || '6ee833b';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
/* PINNED ON BOTH SIDES (CLAUDE.md: "Pin both sides"). The post-change side
 * reads 4016675 instead of the working tree --
 * this ticket's OWN commit. A blast-radius claim ("nothing else moved")
 * can only be true at the commit that made the change, never on a tip that
 * also carries the four tickets merged after it.
 *
 * Both sides fixed makes this suite permanent evidence of what its ticket
 * shipped, and it can no longer be falsified by later work. NOT ONE
 * ASSERTION WAS CHANGED to achieve that: the claims are the claims, and
 * only the build they are asked about is now named.
 *
 * DAC_APP_OVERRIDE still wins, so the mutation runner keeps working. */
const NEWREV = process.env.DAC_NEW_COMMIT || '4016675';
const APP = process.env.DAC_APP_OVERRIDE || ('git show ' + NEWREV + ':' + REL);

const SRC = process.env.DAC_APP_OVERRIDE
  ? fs.readFileSync(process.env.DAC_APP_OVERRIDE, 'utf8')
  : execFileSync('git', ['show', NEWREV + ':' + REL],
      { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 }).replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(PAYLOAD, 'utf8'));
const baseSrc = execFileSync('git', ['show', BASE + ':' + REL],
  { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 }).replace(/\r?\n/g, '\r\n');

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, label) => { if (c) { pass++; log('  ok   ' + label); }
  else { fail++; log('  FAIL ' + label); } };
const guard = (label, fn) => {
  try { fn(); } catch (e) { fail++; log('  FAIL ' + label + ' -- THREW: ' + (e && e.message)); }
};
const codeOnly = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p);

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
    for (let r = 0; r < 400; r++) {
      try { return fn(make()); }
      catch (e) { const m = /(\w+) is not defined/.exec(e.message);
        if (m && add(m[1])) continue; throw e; }
    }
    throw new Error('dependency resolution did not converge');
  };
}
const now = api(SRC, ['getTableSchema', 'shiftSchemaYears', 'buildIngestImport']);
const was = api(baseSrc, ['getTableSchema']);

const YEARS = (() => {
  const s = new Set();
  Object.keys(P.tables).forEach(id =>
    Object.keys(P.tables[id].schema_by_year || {}).forEach(y => s.add(y)));
  return Array.from(s).sort();
})();
const tableYears = [];
Object.keys(P.tables).sort().forEach(id =>
  Object.keys(P.tables[id].schema_by_year || {}).sort()
    .forEach(y => tableYears.push([id, y])));

log('======================================================================');
log('CLCPA-267 -- a borrowed schema keeps the shape, not the year words');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('  stored table-years with a schema: ' + tableYears.length);
log('======================================================================');

/* ---- A. the reported defect -------------------------------------------- */
log('');
log('A. THE REPORTED DEFECT: E1\'s money column on a fresh year');
guard('A-block', () => {
  const fresh = now(a => a.getTableSchema(P.tables.E1, '2099'));
  const before = was(a => a.getTableSchema(P.tables.E1, '2099'));
  log('     BASE  2099: ' + JSON.stringify(before));
  log('     BUILD 2099: ' + JSON.stringify(fresh));
  ok(before[1] === '2025 Total Investment',
    'A1 on BASE a 2099 template read "2025 Total Investment" -- the defect was real');
  ok(fresh[1] === '2099 Total Investment',
    'A2 it now reads "2099 Total Investment" -- got ' + JSON.stringify(fresh[1]));
  ok(fresh.length === before.length,
    'A3 the SHAPE is unchanged: same column count');
  ok(fresh[0] === before[0] && fresh[2] === before[2],
    'A4 and the columns with no year in them are untouched');
});

/* ---- B. no stored table-year moves -------------------------------------- */
log('');
log('B. THE 149-TABLE-YEAR NO-MOVEMENT GATE');
guard('B-block', () => {
  let moved = 0, checked = 0;
  const detail = [];
  tableYears.forEach(([id, y]) => {
    const a = now(x => x.getTableSchema(P.tables[id], y));
    const b = was(x => x.getTableSchema(P.tables[id], y));
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) { moved++; detail.push(id + ':' + y); }
  });
  log('     stored table-years compared: ' + checked);
  ok(checked === tableYears.length && checked > 100,
    'B1 every stored table-year with a schema was compared (' + checked + ')');
  ok(moved === 0,
    'B2 NOT ONE stored table-year moved -- ' + moved + ' moved' +
    (detail.length ? ': ' + detail.slice(0, 6).join(', ') : ''));
  /* and the reason it cannot: a year with its own schema never reaches the
   * fallback. Proven by construction, not asserted. */
  tableYears.slice(0, 5).forEach(([id, y]) => {
    const a = now(x => x.getTableSchema(P.tables[id], y));
    ok(JSON.stringify(a) === JSON.stringify(P.tables[id].schema_by_year[y]),
      'B3 ' + id + ':' + y + ' returns its OWN stored schema, byte for byte');
  });
});

/* ---- C. the two populations, MEASURED ----------------------------------- */
log('');
log('C. THE POPULATIONS THIS FIX HAD TO RESPECT (measured, not quoted)');
guard('C-block', () => {
  const YEAR_RE = /(?:19|20)\d{2}/;
  let withYear = 0, otherYear = 0;
  const others = [];
  tableYears.forEach(([id, y]) => {
    const s = P.tables[id].schema_by_year[y] || [];
    const hit = s.some(h => h != null && YEAR_RE.test(String(h)));
    if (!hit) return;
    withYear++;
    /* "names a DIFFERENT year" = carries a year token that is not its own */
    const foreign = s.some((h) => {
      if (h == null) return false;
      const ys = String(h).match(/(?:19|20)\d{2}/g) || [];
      return ys.some(t => t !== String(y));
    });
    if (foreign) { otherYear++; others.push(id + ':' + y); }
  });
  log('     schemas carrying a year literal        : ' + withYear);
  log('     of those, naming a year that is NOT    : ' + otherYear);
  log('       their own reporting year             : ' + others.slice(0, 8).join(', '));
  ok(withYear > 0, 'C1 year literals really are present in stored schemas (' + withYear + ')');
  ok(otherYear > 0,
    'C2 and some deliberately name a DIFFERENT year (' + otherYear + ') -- ' +
    'so blanket substitution WOULD have corrupted them');

  /* the offsets survive the shift */
  let offsetsKept = 0, offsetsChecked = 0;
  others.forEach((k) => {
    const [id, y] = k.split(':');
    const stored = P.tables[id].schema_by_year[y];
    const shifted = now(a => a.getTableSchema(P.tables[id], '2099'));
    /* only meaningful when this year is the donor the fallback would pick */
    const donor = Object.keys(P.tables[id].schema_by_year)
      .filter(k2 => Array.isArray(P.tables[id].schema_by_year[k2]))
      .sort((p, q) => parseInt(q, 10) - parseInt(p, 10))[0];
    if (donor !== y) return;
    offsetsChecked++;
    const d = 2099 - parseInt(y, 10);
    const want = stored.map(h => h == null ? h : String(h)
      .replace(/(\d?)((?:19|20)\d{2})(\d?)/g,
        (m, b, yy, aa) => (b || aa) ? m : String(parseInt(yy, 10) + d)));
    if (JSON.stringify(shifted) === JSON.stringify(want)) offsetsKept++;
  });
  ok(offsetsChecked > 0 && offsetsKept === offsetsChecked,
    'C3 every different-year heading keeps its RELATIVE offset when borrowed (' +
    offsetsKept + ' of ' + offsetsChecked + ')');

  /* the named example, spelled out */
  const a9 = now(a => a.getTableSchema(P.tables.A9, '2099'));
  log('     A9 stored 2025: ' + JSON.stringify(P.tables.A9.schema_by_year['2025']));
  log('     A9 fresh  2099: ' + JSON.stringify(a9));
  ok(JSON.stringify(a9) === JSON.stringify(['', '2098', '2098', '2099', '2099', '% Change', '% Change']),
    'C4 A9\'s prior-year comparison becomes 2098/2098/2099/2099, still a comparison');
});

/* ---- D. the shift itself ------------------------------------------------- */
log('');
log('D. THE SHIFT');
guard('D-block', () => {
  const f = now(a => a.shiftSchemaYears);
  ok(/^function shiftSchemaYears\b/.test(String(f)),
    'D0 the function under test is the one sliced from app.js');
  const S = (arr, from, to) => now(a => a.shiftSchemaYears(arr, from, to));
  ok(JSON.stringify(S(['2025 Total Investment'], '2025', '2099')) ===
     JSON.stringify(['2099 Total Investment']), 'D1 a single year shifts');
  ok(JSON.stringify(S(['2024', '2025'], '2025', '2099')) ===
     JSON.stringify(['2098', '2099']), 'D2 two years shift by the same delta');
  ok(JSON.stringify(S(['x'], '2025', '2099')) === JSON.stringify(['x']),
    'D3 a heading with no year is untouched');
  ok(JSON.stringify(S([null, ''], '2025', '2099')) === JSON.stringify([null, '']),
    'D4 null and empty headings survive');
  ok(JSON.stringify(S(['2025 v 2025'], '2025', '2026')) ===
     JSON.stringify(['2026 v 2026']), 'D5 repeated tokens all move');
  ok(JSON.stringify(S(['20231'], '2025', '2099')) === JSON.stringify(['20231']),
    'D6 a 5-digit run is NOT a year -- the digit boundary holds where \\b would not');
  ok(JSON.stringify(S(['12025'], '2025', '2099')) === JSON.stringify(['12025']),
    'D7 nor is a year with a digit in front of it');
  ok(JSON.stringify(S(['2023Incentive'], '2023', '2099')) ===
     JSON.stringify(['2099Incentive']),
    'D8 but a year followed by a LETTER is still a year (the CLCPA-252 r3 trap)');
  ok(JSON.stringify(S(['2025 Total'], '2025', '2025')) === JSON.stringify(['2025 Total']),
    'D9 a zero delta changes nothing');
  ok(JSON.stringify(S(['2025 Total'], '2025', 'nonsense')) === JSON.stringify(['2025 Total']),
    'D10 an unparseable target changes nothing rather than producing NaN');
  ok(JSON.stringify(S(['1999 Total'], '1999', '2001')) === JSON.stringify(['2001 Total']),
    'D11 a shift across the century boundary works');
  ok(S(null, '2025', '2099') === null, 'D12 a non-array is returned untouched');
});

/* ---- E. the surfaces ----------------------------------------------------- */
log('');
log('E. EVERY SURFACE, because they all read getTableSchema');
guard('E-block', () => {
  const code = codeOnly(SRC);
  const callers = (code.match(/getTableSchema\(/g) || []).length;
  log('     getTableSchema call sites in app.js: ' + callers);
  ok(callers >= 4,
    'E1 the schema is read from one function by ' + callers + ' call sites, ' +
    'so the shift lands once for all of them');
  ok((code.match(/shiftSchemaYears\(/g) || []).length === 2,
    'E2 and shiftSchemaYears is DECLARED once and CALLED once -- one borrow point');

  /* THE ROUND TRIP THAT MATTERS: a file built from the template this build
   * writes must still import. If the importer matched on unshifted headings
   * the operator's own template would be rejected. */
  const E1 = P.tables.E1;
  const schema = now(a => a.getTableSchema(E1, '2099'));
  const header = schema.map(h => h == null ? '' : String(h));
  const line = schema.map(() => ''); line[0] = 'Electric'; line[1] = '1000';
  const res = now(a => a.buildIngestImport([header, line], schema, [], 'E1'));
  ok(res.ok === true,
    'E3 a CSV whose header is this build\'s own 2099 template IMPORTS (ok=' + res.ok +
    (res.rejections && res.rejections.length ? ', ' + res.rejections[0].why : '') + ')');
  ok((res.matchedColumns || []).indexOf('2099 Total Investment') >= 0,
    'E4 and the shifted money column is MATCHED by name');
  ok((res.notTouched.unmatchedColumns || []).length === 0,
    'E5 with no unmatched columns');

  /* the donor's own header must now NOT match, or the shift was cosmetic */
  const stale = ['Investment Category', '2025 Total Investment', 'Percentage Affecting DACs'];
  const res2 = now(a => a.buildIngestImport([stale, ['Electric', '1000', '']], schema, [], 'E1'));
  ok((res2.notTouched.unmatchedColumns || []).indexOf('2025 Total Investment') >= 0,
    'E6 a file still carrying the DONOR year is reported as unmatched, not silently accepted');
});

/* ---- F. style of change -------------------------------------------------- */
log('');
log('F. STYLE OF CHANGE');
guard('F-block', () => {
  const code = codeOnly(SRC);
  const added = SRC.split('\r\n').filter(l => baseSrc.indexOf(l) < 0);
  const codeAdded = added.filter(l => l.trim() && !/^\s*[*/]/.test(l.trim()));
  log('     added code lines: ' + codeAdded.length);
  ok(!codeAdded.some(l => /['"][A-J]\d+['"]/.test(l)), 'F1 no added code line names a table id');
  ok(!codeAdded.some(l => /['"](?:19|20)\d{2}['"]/.test(l)),
    'F2 no added code line names a literal year');
  ok(!codeAdded.some(l => /Total Investment|Investment Category/.test(l)),
    'F3 no added code line names a column');
  ok(baseSrc.indexOf('function shiftSchemaYears(') < 0 &&
     SRC.indexOf('function shiftSchemaYears(') >= 0, 'F4 shiftSchemaYears is new here');

  /* the fallback ORDER is CLCPA-244's and must not have been re-litigated */
  /* SCOPED. The same descending sort appears in dacCol (CLCPA-257), so a bare
   * search for it stays green while getTableSchema's own ordering is reversed
   * -- the mutation proved exactly that. The filter line pins which one. */
  ok(code.indexOf('.filter(y => Array.isArray(table.schema_by_year[y]))\r\n' +
    '        .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));') >= 0,
    'F5 getTableSchema\'s OWN newest-year donor choice (CLCPA-244) is unchanged');
  ok(code.indexOf('.sort((a, b) => parseInt(b, 10) - parseInt(a, 10))') >= 0,
    'F5b and dacCol\'s matching choice (CLCPA-257) is still there too');

  /* no stored data: a save writes rows only */
  ok(code.indexOf('cr2bf_schema:') < 0,
    'F6 nothing in app.js WRITES cr2bf_schema -- the shift cannot reach storage');
  ok(/cr2bf_rows: JSON\.stringify\(newRows\)/.test(code),
    'F7 a save still writes rows, as before');

  /* blast radius */
  /* Cut BOTH touched functions out of both files; what remains must be equal.
   * Inner blocks are indented deeper than two spaces, so '\r\n  }' is the
   * function's own close. Round 1 of this assertion hand-rolled a different
   * anchor per function and reported a difference that was its own. */
  /* Compare CODE, comments and blank lines removed. A raw byte comparison
   * fails on the new doc comment, which sits ABOVE the function and so
   * survives any cut anchored on the declaration -- round 1 of this assertion
   * reported a difference that was entirely its own commentary. */
  const norm = (s) => codeOnly(s).split(/\r?\n/).filter(l => l.trim()).join('\n');
  const cutFn = (s, name) => {
    const a = s.indexOf('  function ' + name + '(');
    if (a < 0) return s;
    const b = s.indexOf('\n  }', a);
    return b < 0 ? s : s.slice(0, a) + s.slice(b + 4);
  };
  /* and blanks are dropped AFTER the cut as well: splicing a function out
   * joins a line ending to a line start and leaves an empty line at the seam,
   * which appears in the build and not in the baseline purely because the
   * baseline has one fewer function to cut. */
  const cut = (s) => cutFn(cutFn(norm(s), 'shiftSchemaYears'), 'getTableSchema')
    .split('\n').filter(l => l.trim()).join('\n');
  ok(cut(SRC) === cut(baseSrc),
    'F8 every byte outside shiftSchemaYears and getTableSchema is identical to BASE');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  const m = /const BASE = process\.env\.DAC_BASE_COMMIT \|\| '([^']*)';/.exec(self);
  ok(!!m && /^[0-9a-f]{7,40}$/.test(m[1]),
    'X1 BASE is pinned to a literal commit sha -- got ' + (m ? JSON.stringify(m[1]) : 'none'));
  ok(baseSrc.indexOf('function shiftSchemaYears(') < 0,
    'X2 and that baseline really predates this ticket');
  ok(YEARS.length > 1, 'X3 the payload carries several schema years (' + YEARS.join(', ') + ')');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-267-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
