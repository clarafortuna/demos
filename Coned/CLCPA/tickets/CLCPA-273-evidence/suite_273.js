/* CLCPA-273 -- the percentage-to-fraction advisory fires on every route.
 *
 * THE TICKET'S PREMISE WAS REFUTED BEFORE THIS WAS BUILT, and the suite keeps
 * the refutation as evidence. The advisory was never table-specific: driving
 * buildIngestImport with one CSV row carrying "10%" in a non-percent column
 * fires it for H1, I1, C2 and C3 alike. The discriminator is the ENTRY ROUTE.
 * Typing into a cell called parseNumericInput directly, with no notice at all,
 * in every table -- H1 included. That is what "a DAC hire count silently
 * became 0.1" actually was.
 *
 * So: one predicate, both routes, import path byte-unchanged.
 *
 * BASE predates the change: be1d2a2, this branch's parent (CLCPA-271's tip).
 *
 * Run:  node suite_273.js
 */
const fs = require('fs');
const { execFileSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const PAYLOAD = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/payload.json';
const BASE = process.env.DAC_BASE_COMMIT || 'be1d2a2';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
/* PINNED ON BOTH SIDES (CLAUDE.md: "Pin both sides"). The post-change side
 * reads 6ee833b instead of the working tree --
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
const NEWREV = process.env.DAC_NEW_COMMIT || '6ee833b';
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

/* ---- assemble from the SHIPPED bytes ------------------------------------ */
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
  const make = () => new Function('const state=globalThis.__st||{};' + parts.join('\n\n') +
    '\nreturn {' + want.join(',') + '};')();
  return {
    call: (fn) => {
      for (let r = 0; r < 400; r++) {
        try { return fn(make()); }
        catch (e) { const m = /(\w+) is not defined/.exec(e.message);
          if (m && add(m[1])) continue; throw e; }
      }
      throw new Error('dependency resolution did not converge');
    },
    deps: () => have.size,
  };
}

log('======================================================================');
log('CLCPA-273 -- the percent advisory fires on every entry route');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the refutation, kept as evidence -------------------------------- */
log('');
log('A. THE PREMISE: the IMPORT advisory was never table-specific');
guard('A-block', () => {
  const h = api(SRC, ['buildIngestImport']);
  const CASES = [['H1', 2], ['I1', 1], ['C2', 5], ['C3', 5]];
  const got = h.call(a => CASES.map(([id, col]) => {
    const t = P.tables[id];
    const y = Object.keys(t.schema_by_year).sort().pop();
    const schema = t.schema_by_year[y];
    const rows = (t.data[y] || []).map(r => r.slice());
    const label = String((rows.find(r => r[0] && String(r[0]).trim()) || ['x'])[0]);
    const line = schema.map(() => ''); line[0] = label; line[col] = '10%';
    const res = a.buildIngestImport([schema.map(x => x == null ? '' : String(x)), line],
      schema, rows, id);
    return { id: id, col: schema[col], n: (res.unitNotices || []).length,
      landed: (res.populated.find(p => p.column === schema[col]) || {}).value };
  }));
  got.forEach(g => log('     ' + g.id + '  ' + JSON.stringify(g.col) +
    '  landed ' + g.landed + '  advisory ' + (g.n ? 'FIRES' : 'SILENT')));
  ok(got.every(g => g.n === 1),
    'A1 the import advisory fires for ALL FOUR tables (H1, I1, C2, C3)');
  ok(got.every(g => g.landed === 0.1),
    'A2 and all four landed 0.1 -- the conversion itself is the CLCPA-244 convention');
});

/* ---- B. the predicate, extracted not rewritten --------------------------- */
log('');
log('B. ONE PREDICATE');
guard('B-block', () => {
  const h = api(SRC, ['isPercentLiteral']);
  const f = h.call(a => a.isPercentLiteral);
  /* THE THING UNDER TEST IS THE SHIPPED FUNCTION. A behavioural table alone
   * passes just as happily against a correct copy written in this file, which
   * is the named "harness tests its own copy" failure -- the mutation that
   * swaps the slice for a local arrow went green until this landed. */
  ok(/^function isPercentLiteral\b/.test(String(f)),
    'B0 the predicate under test is the NAMED function sliced from app.js');
  ok(SRC.indexOf(String(f).replace(/\n/g, '\r\n')) >= 0,
    'B0b and its body is byte-present in the shipped app.js');
  [['10%', true], [' 45 % ', true], ['-3.5%', true], ['+2%', true], ['1,234%', true],
   ['10', false], ['0.1', false], ['up 10% or so', false], ['%', false],
   ['10%%', false], ['', false]].forEach(([s, want]) => {
    ok(f(s) === want, 'B1 isPercentLiteral(' + JSON.stringify(s) + ') === ' + want);
  });
  /* lifted VERBATIM: the import path must not have been quietly retuned */
  const re = /\/\^\\s\*\[-\+\]\?\[\\d\.,\]\+\\s\*%\\s\*\$\//;
  ok(re.test(codeOnly(SRC)), 'B2 the regex is the one CLCPA-261 shipped, character for character');
  ok((codeOnly(SRC).match(/\^\\s\*\[-\+\]\?\[\\d\.,\]\+\\s\*%\\s\*\$/g) || []).length === 1,
    'B3 and it now appears exactly ONCE -- the inline copy is gone');
});

/* ---- C. the editor route now notices ------------------------------------ */
log('');
log('C. THE TYPED ROUTE');
guard('C-block', () => {
  const h = api(SRC, ['noteTypedPercent', 'renderTypedUnitNotice']);
  const H = P.tables.H1;
  const schema = H.schema_by_year['2025'];
  const mk = () => ({ ingest: { schema: schema, tableId: 'H1',
    draft: H.data['2025'].map(r => r.slice()), typedUnitNotices: [] } });

  /* a percent typed into a COUNT column */
  let st = mk(); globalThis.__st = st;
  let out = h.call(a => { a.noteTypedPercent(0, 2, '10%'); return a.renderTypedUnitNotice(); });
  ok(st.ingest.typedUnitNotices.length === 1, 'C1 a percent typed into a count column is recorded');
  ok(/ingest-import-notice is-warn/.test(out),
    'C2 and renders in the CLCPA-266 AMBER box');
  ok(/Read as a fraction: 1 cell</.test(out), 'C3 with CLCPA-261\'s wording, H1 as the reference');
  ok(/Manhattan/.test(out) && /DAC Repairs/.test(out),
    'C4 naming the row and the column, as the import advisory does');
  ok(/10% read as 0\.1/.test(out), 'C5 and what was read and what landed');

  /* a percent typed into a PERCENTAGE column says nothing */
  const E = P.tables.E1;
  st = { ingest: { schema: E.schema_by_year['2025'], tableId: 'E1',
    draft: E.data['2025'].map(r => r.slice()), typedUnitNotices: [] } };
  globalThis.__st = st;
  out = h.call(a => { a.noteTypedPercent(0, 2, '45%'); return a.renderTypedUnitNotice(); });
  ok(st.ingest.typedUnitNotices.length === 0,
    'C6 a percent typed into a PERCENTAGE column says nothing (same rule as the import)');
  ok(out === '', 'C7 and renders no box at all');

  /* retyping the same cell replaces, it does not stack */
  st = mk(); globalThis.__st = st;
  h.call(a => { a.noteTypedPercent(0, 2, '10%'); a.noteTypedPercent(0, 2, '20%'); });
  ok(st.ingest.typedUnitNotices.length === 1, 'C8 retyping one cell REPLACES its advisory');
  ok(st.ingest.typedUnitNotices[0].read === '20%', 'C9 keeping the latest value');

  /* correcting the cell clears it */
  st = mk(); globalThis.__st = st;
  h.call(a => { a.noteTypedPercent(0, 2, '10%'); a.noteTypedPercent(0, 2, '491'); });
  ok(st.ingest.typedUnitNotices.length === 0,
    'C10 and correcting the value REMOVES the advisory -- it is not a permanent mark');

  /* two different cells accumulate */
  st = mk(); globalThis.__st = st;
  out = h.call(a => { a.noteTypedPercent(0, 2, '10%'); a.noteTypedPercent(1, 1, '20%');
    return a.renderTypedUnitNotice(); });
  ok(st.ingest.typedUnitNotices.length === 2, 'C11 two different cells accumulate');
  ok(/Read as a fraction: 2 cells</.test(out), 'C12 and the count is plural and right');

  /* the LABEL column is never a unit conversion */
  st = mk(); globalThis.__st = st;
  h.call(a => a.noteTypedPercent(0, 0, '10%'));
  ok(st.ingest.typedUnitNotices.length === 0, 'C13 the label column is exempt');
  delete globalThis.__st;
});

/* ---- D. every table, both routes ---------------------------------------- */
log('');
log('D. EVERY TABLE: typed and imported agree about what is noticeable');
guard('D-block', () => {
  const h = api(SRC, ['noteTypedPercent', 'detectPctColumns']);
  let agree = 0, checked = 0, fired = 0;
  const ids = Object.keys(P.tables).sort();
  /* The assembled module binds `state` ONCE, when it is built, so reassigning
   * globalThis.__st inside the call leaves the module looking at the old
   * object -- round 1 of this sweep reported the advisory firing on 0 of 156
   * columns while section C proved it fires. One shared object, mutated in
   * place, is what the module can actually see. */
  const shared = { ingest: null };
  globalThis.__st = shared;
  h.call(a => {
    ids.forEach((id) => {
      const t = P.tables[id];
      const y = Object.keys(t.schema_by_year || {}).sort().pop();
      if (!y) return;
      const schema = t.schema_by_year[y];
      const pct = a.detectPctColumns(schema) || [];
      schema.forEach((hd, c) => {
        if (c === 0 || hd == null || !String(hd).trim()) return;
        shared.ingest = { schema: schema, tableId: id,
          draft: [['row'].concat(schema.slice(1).map(() => null))], typedUnitNotices: [] };
        a.noteTypedPercent(0, c, '10%');
        const typedFired = shared.ingest.typedUnitNotices.length === 1;
        /* the import's rule, stated independently: notice unless pct column */
        const importWould = !pct[c];
        checked++;
        if (typedFired === importWould) agree++;
        if (typedFired) fired++;
      });
    });
  });
  delete globalThis.__st;
  log('     value columns checked across all 52 tables: ' + checked +
      '   advisory fires on ' + fired);
  ok(checked > 100, 'D1 a real sweep, not a handful (' + checked + ' columns)');
  ok(agree === checked,
    'D2 typed and imported agree on ALL ' + checked + ' columns -- agreed on ' + agree);
  ok(fired > 0 && fired < checked,
    'D3 and the rule discriminates: it fires on ' + fired + ' of ' + checked +
    ', not on everything and not on nothing');
});

/* ---- E. the import path must not regress -------------------------------- */
log('');
log('E. H1 AND THE WHOLE IMPORT PATH, UNCHANGED');
guard('E-block', () => {
  const grabFn = (s, n) => {
    const a = s.indexOf('\r\n  function ' + n + '(');
    if (a < 0) return null;
    const b = s.indexOf('\r\n  }', a);
    return b < 0 ? null : s.slice(a, b);
  };
  const now = grabFn(SRC, 'buildIngestImport'), was = grabFn(baseSrc, 'buildIngestImport');
  ok(!!now && !!was, 'E1 buildIngestImport located in both');
  /* exactly one line differs: the inline regex became the shared predicate */
  const dn = now.split('\n').filter(l => was.indexOf(l) < 0)
    .filter(l => l.trim() && !/^\s*[*/]/.test(l.trim()));
  ok(dn.length === 1,
    'E2 exactly ONE non-comment line of buildIngestImport changed -- found ' + dn.length);
  ok(dn.length === 1 && /isPercentLiteral\(raw\) && !pctCols\[cIdx\]/.test(dn[0]),
    'E3 and it is the call to the extracted predicate');

  /* behaviour, not just text: drive BOTH builds on the same four tables */
  const hNow = api(SRC, ['buildIngestImport']);
  const hWas = api(baseSrc, ['buildIngestImport']);
  const run = (h) => h.call(a => ['H1', 'I1', 'C2', 'C3'].map((id) => {
    const t = P.tables[id];
    const y = Object.keys(t.schema_by_year).sort().pop();
    const schema = t.schema_by_year[y];
    const rows = (t.data[y] || []).map(r => r.slice());
    const label = String((rows.find(r => r[0] && String(r[0]).trim()) || ['x'])[0]);
    const line = schema.map(() => ''); line[0] = label;
    line[Math.min(2, schema.length - 1)] = '10%';
    const res = a.buildIngestImport([schema.map(x => x == null ? '' : String(x)), line],
      schema, rows, id);
    return JSON.stringify({ ok: res.ok, notices: res.unitNotices,
      populated: res.populated, rejections: res.rejections });
  }));
  const rNow = run(hNow), rWas = run(hWas);
  ok(JSON.stringify(rNow) === JSON.stringify(rWas),
    'E4 the import plan is IDENTICAL to BASE on all four tables, notices included');
});

/* ---- F. style of change -------------------------------------------------- */
log('');
log('F. STYLE OF CHANGE');
guard('F-block', () => {
  const code = codeOnly(SRC);
  ok(/noteTypedPercent\(r, c, e\.target\.value\);[\s\S]{0,200}parseNumericInput\(e\.target\.value\)/.test(code),
    'F1 the raw text is read BEFORE parseNumericInput destroys it');
  ok(code.indexOf('detectPctColumns(i.schema || [])') >= 0,
    'F2 the editor derives its percentage columns from the SCHEMA, as the importer does');
  const newFns = ['isPercentLiteral', 'noteTypedPercent', 'renderTypedUnitNotice',
    'refreshIngestNotices'];
  newFns.forEach(n => ok(baseSrc.indexOf('function ' + n + '(') < 0 &&
    SRC.indexOf('function ' + n + '(') >= 0, 'F3 ' + n + ' is new in this change'));
  /* CLCPA-259: nothing hardcoded */
  const added = SRC.split('\r\n').filter(l => baseSrc.indexOf(l) < 0);
  const codeAdded = added.filter(l => l.trim() && !/^\s*[*/]/.test(l.trim()));
  ok(!codeAdded.some(l => /['"][A-J]\d+['"]/.test(l)),
    'F4 no added CODE line names a table id (' + codeAdded.length + ' added code lines)');
  ok(!codeAdded.some(l => /(19|20)\d{2}/.test(l)),
    'F5 no added code line names a year');
  ok(!codeAdded.some(l => /Load Relief|Repairs|Unique|Participants/.test(l)),
    'F6 no added code line names a column');
  /* advisory, never a rejection */
  ok(!/typedUnitNotices[\s\S]{0,400}(reject|r\.ok = false)/.test(code),
    'F7 the typed advisory rejects nothing');
  ok(code.indexOf("i.typedUnitNotices = [];") >= 0,
    'F8 and the advisories are cleared when the editor changes table-year');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  const m = /const BASE = process\.env\.DAC_BASE_COMMIT \|\| '([^']*)';/.exec(self);
  ok(!!m && /^[0-9a-f]{7,40}$/.test(m[1]),
    'X1 BASE is pinned to a literal commit sha -- got ' + (m ? JSON.stringify(m[1]) : 'none'));
  ok(baseSrc.indexOf('function noteTypedPercent(') < 0,
    'X2 and that baseline really predates this ticket');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-273-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
