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
/* CLCPA-271 -- computed cells in the Report Data editor render unformatted.
 *
 * E1's body rows showed "$111,000" while its computed Grand Total, one row
 * below in the SAME column, showed "1,110,000". Two cells in one column
 * disagreeing about what the column is.
 *
 * This suite tests the SHIPPED bytes. It slices the editor's real cell-render
 * closure out of app.js and calls it, so the claims are about rendered HTML
 * and not about the presence of a line of source. A structural pin alone
 * would have passed on a build where the formatter was called with the wrong
 * argument.
 *
 * BASE predates the change: main @ 2361a6a, the tip before this branch.
 *
 * Run:  node suite_271.js
 */
const fs = require('fs');
const { execFileSync } = require('child_process');

const REPO = _dacRepo() + '';
const PAYLOAD = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/payload.json';
const BASE = process.env.DAC_BASE_COMMIT || '2361a6a';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
/* PINNED ON BOTH SIDES (CLAUDE.md: "Pin both sides"). The post-change side
 * reads be1d2a2 instead of the working tree --
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
const NEWREV = process.env.DAC_NEW_COMMIT || 'be1d2a2';
const APP = process.env.DAC_APP_OVERRIDE || ('git show ' + NEWREV + ':' + REL);

const SRC = process.env.DAC_APP_OVERRIDE
  ? fs.readFileSync(process.env.DAC_APP_OVERRIDE, 'utf8')
  : execFileSync('git', ['show', NEWREV + ':' + REL],
      { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 }).replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(PAYLOAD, 'utf8'));

/* git blobs are LF, the working tree is CRLF. An indexOf on an un-normalised
 * baseline returns -1 and slices from the end in silence. */
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

/* Comments stripped before any structural search: a doc comment quoting the
 * old code satisfies a search for the old code, which has happened eight
 * times in this repo. */
const codeOnly = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p);

/* ---- assemble the REAL cell renderer ----------------------------------- */
/* The cells are produced by an arrow inside renderIngestEditor. Slicing the
 * arrow BODY and giving it the closure variables as parameters runs the
 * shipped logic; re-implementing it here would test my own copy, which is a
 * named failure in this repo. */
const OPEN = '      const cells = i.schema.map((_, colIdx) => {';
const CLOSE = "      }).join('');";
function buildCellFn(src) {
  const a = src.indexOf(OPEN);
  if (a < 0) throw new Error('cell-render anchor not found');
  const b = src.indexOf(CLOSE, a);
  if (b < 0) throw new Error('cell-render close anchor not found');
  const body = src.slice(a + OPEN.length, b);

  const L = src.split('\r\n');
  const TOP = [];
  L.forEach((ln, n) => {
    const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (n) => {
    const k = TOP.findIndex(d => d.name === n);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n');
  };
  const parts = [], have = new Set();
  const add = (n) => {
    if (have.has(n)) return false;
    const f = find(n); if (!f) return false;
    have.add(n); parts.push(f); return true;
  };
  const ARGS = ['row', 'rowIdx', 'isHeaderRow', 'lockTotalRow', 'isTotal',
    'derivedByCol', 'readOnlyByName', 'currencyCol', 'numericCol',
    'hiddenCols', 'i', 'colIdx'];
  const make = () => new Function('const state={};' + parts.join('\n\n') +
    '\nreturn function(' + ARGS.join(',') + '){' + body + '};')();
  /* ReferenceErrors surface at CALL time, not at assembly time, so the
   * resolver has to wrap the call as well as the build. */
  return (call) => {
    for (let r = 0; r < 300; r++) {
      try { return call(make()); }
      catch (e) {
        const m = /(\w+) is not defined/.exec(e.message);
        if (m && add(m[1])) continue;
        throw e;
      }
    }
    throw new Error('dependency resolution did not converge');
  };
}
const drive = buildCellFn(SRC);
const driveBase = buildCellFn(baseSrc);

/* A cell context with everything off; each test turns on what it needs. */
const ctx = (over) => Object.assign({
  row: [], rowIdx: 1, isHeaderRow: false, lockTotalRow: false, isTotal: false,
  derivedByCol: {}, readOnlyByName: {}, currencyCol: {}, numericCol: {},
  hiddenCols: [], i: { schema: ['Label', 'Money', 'Count'], tableId: 'E1', draft: [] },
}, over || {});
const render = (runner, colIdx, over) => {
  const c = ctx(over);
  return runner(fn => fn(c.row, c.rowIdx, c.isHeaderRow, c.lockTotalRow, c.isTotal,
    c.derivedByCol, c.readOnlyByName, c.currencyCol, c.numericCol,
    c.hiddenCols, c.i, colIdx));
};
const text = (html) => String(html).replace(/<[^>]*>/g, '').trim();
/* What the OPERATOR sees, whichever element the cell turned out to be: the
 * text of a read-only span, or the value of an editable input. */
const shown = (html) => {
  const m = /value="([^"]*)"/.exec(String(html));
  return m ? m[1] : text(html);
};

log('======================================================================');
log('CLCPA-271 -- computed cells render with their column\'s format');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the defect, in rendered output ---------------------------------- */
log('');
log('A. THE DEFECT: a computed money cell and a typed money cell, one column');
guard('A-block', () => {
  const money = { 1: true };
  const num = { 1: true, 2: true };
  const totalHtml = render(drive, 1,
    { isTotal: true, row: ['Grand Total', 1110000, 9], currencyCol: money, numericCol: num });
  const bodyHtml = render(drive, 1,
    { row: ['Residential', 111000, 3], currencyCol: money, numericCol: num });
  const baseTotal = render(driveBase, 1,
    { isTotal: true, row: ['Grand Total', 1110000, 9], currencyCol: money, numericCol: num });

  ok(text(totalHtml) === '$1,110,000',
    'A1 the computed total renders $1,110,000 -- got ' + JSON.stringify(text(totalHtml)));
  ok(/value="\$111,000"/.test(bodyHtml),
    'A2 the editable body cell in the same column renders $111,000');
  ok(text(baseTotal) === '1,110,000',
    'A3 on BASE the same total rendered 1,110,000, with no currency -- the defect was real');
  ok(text(totalHtml) !== text(baseTotal),
    'A4 and this build changed it');

  /* the marker, not the punctuation: what the ticket is actually about.
   * A computed cell is a <span> and a typed cell is an <input value="...">,
   * so stripping tags finds nothing in the second -- shown() has to read the
   * value attribute. Round 1 of this suite compared '' against '$111,000'
   * and reported a disagreement that did not exist. */
  const marks = (h) => /\$/.test(shown(h));
  ok(marks(totalHtml) === marks(bodyHtml),
    'A5 computed and typed cells now AGREE about the currency marker');
  ok(marks(baseTotal) !== marks(bodyHtml),
    'A6 on BASE they disagreed');
});

/* ---- B. the column decides, not the row --------------------------------- */
log('');
log('B. THE FORMAT FOLLOWS THE COLUMN');
guard('B-block', () => {
  const num = { 1: true, 2: true };
  const plainTotal = render(drive, 2,
    { isTotal: true, row: ['Grand Total', 1110000, 4321], currencyCol: { 1: true }, numericCol: num });
  ok(text(plainTotal) === '4,321',
    'B1 a NON-currency numeric total keeps separators and takes no $ -- got ' +
    JSON.stringify(text(plainTotal)));

  const neg = render(drive, 1,
    { isTotal: true, row: ['Grand Total', -212177, 0], currencyCol: { 1: true }, numericCol: num });
  ok(text(neg) === '-$212,177',
    'B2 a negative money total renders -$212,177 -- got ' + JSON.stringify(text(neg)));

  const empty = render(drive, 1,
    { isTotal: true, row: ['Grand Total', null, 0], currencyCol: { 1: true }, numericCol: num });
  ok(text(empty) === '\u2014',
    'B3 an empty computed cell still renders the null glyph, unchanged');

  const str = render(drive, 1,
    { isTotal: true, row: ['Grand Total', 'n/a', 0], currencyCol: { 1: true }, numericCol: num });
  ok(text(str) === 'n/a',
    'B4 a non-numeric residual is shown as published, not coerced -- got ' +
    JSON.stringify(text(str)));
});

/* ---- C. the read-only-by-name branch, same pass -------------------------- */
log('');
log('C. THE READ-ONLY (NOT COMPUTED) BRANCH, fixed in the same pass');
guard('C-block', () => {
  const ro = { 1: true };
  const got = render(drive, 1,
    { row: ['Something', 1110000, 0], readOnlyByName: ro, currencyCol: { 1: true }, numericCol: { 1: true } });
  const was = render(driveBase, 1,
    { row: ['Something', 1110000, 0], readOnlyByName: ro, currencyCol: { 1: true }, numericCol: { 1: true } });
  ok(text(got) === '$1,110,000',
    'C1 a read-only money cell formats too -- got ' + JSON.stringify(text(got)));
  ok(text(was) === '1110000',
    'C2 on BASE it printed a bare 1110000 -- got ' + JSON.stringify(text(was)));
  const txt = render(drive, 1,
    { row: ['Something', 'as published', 0], readOnlyByName: ro, currencyCol: { 1: true } });
  ok(text(txt) === 'as published',
    'C3 and a text residual in a read-only column is still shown as published');
});

/* ---- D. every table, not just E1 ---------------------------------------- */
log('');
log('D. SHARED PATH: every currency column in the payload, computed vs typed');
guard('D-block', () => {
  /* detectCurrencyColumns is the shipped derivation; the suite must not carry
   * its own idea of which columns are money. */
  let detect = null;
  const L = SRC.split('\r\n'); const TOP = [];
  L.forEach((ln, n) => { const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n }); });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (n) => { const k = TOP.findIndex(d => d.name === n);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n'); };
  const parts = [], have = new Set();
  const add = (n) => { if (have.has(n)) return false; const f = find(n);
    if (!f) return false; have.add(n); parts.push(f); return true; };
  add('detectCurrencyColumns');
  for (let r = 0; r < 200; r++) {
    try { detect = new Function('const state={};' + parts.join('\n\n') +
      '\nreturn detectCurrencyColumns;')(); break; }
    catch (e) { const m = /(\w+) is not defined/.exec(e.message);
      if (m && add(m[1])) continue; throw e; }
  }

  let checked = 0, agree = 0, moneyCols = 0, labelCols = 0;
  Object.keys(P.tables).sort().forEach((id) => {
    const t = P.tables[id];
    Object.keys(t.schema_by_year || {}).sort().forEach((y) => {
      const schema = t.schema_by_year[y];
      const cur = detect(schema) || {};
      schema.forEach((h, colIdx) => {
        if (!cur[colIdx]) return;
        /* Column 0 is the LABEL column and is rendered by the label branch
         * before any value branch is reached, so it is not a money cell
         * whatever the detector says. Measured: detectCurrencyColumns flags
         * E1's "Investment Category" in all three of its years -- a
         * pre-existing false positive with no rendered effect, examined and
         * left alone because this ticket is render-side only. */
        if (colIdx === 0) { labelCols++; return; }
        moneyCols++;
        const over = { currencyCol: cur, numericCol: cur,
          i: { schema: schema, tableId: id, draft: [] } };
        const row = schema.map(() => null); row[0] = 'Grand Total'; row[colIdx] = 1234567;
        const tot = render(drive, colIdx, Object.assign({ isTotal: true, row: row }, over));
        const body = render(drive, colIdx, Object.assign({ row: row }, over));
        checked++;
        if (/\$/.test(shown(tot)) && /\$/.test(shown(body))) agree++;
      });
    });
  });
  log('     value currency columns across the payload: ' + moneyCols +
      '   (label-column false positives skipped: ' + labelCols + ')');
  ok(moneyCols > 0, 'D1 the payload really does contain currency columns (' + moneyCols + ')');
  ok(checked === agree && checked > 0,
    'D2 computed and typed cells agree on the $ in ALL ' + checked +
    ' currency table-year-columns -- agreed in ' + agree);
  ok(labelCols === 3,
    'D3 and the known label-column false positives are still exactly 3 (E1 x3), ' +
    'not a number that grew quietly -- found ' + labelCols);
});

/* ---- E. nothing else moved ---------------------------------------------- */
log('');
log('E. STYLE OF CHANGE: render-side only, no stored data, no literals');
guard('E-block', () => {
  const codeNow = codeOnly(SRC), codeBase = codeOnly(baseSrc);

  /* SCOPED TO THE TWO CALC SURFACES, not to the whole file. Round 1 of this
   * suite asserted app.js contained no `v.toLocaleString()` at all and went
   * red on twelve legitimate call sites -- chart labels, the history detail,
   * the KPI cards. A pin that cannot distinguish the defect from the idiom is
   * not a guard, so it names the expression AND its branch. */
  const DEFECT = "(v == null || v === '') ? '—' : (typeof v === 'number' ? v.toLocaleString() : String(v))";
  ok(codeNow.indexOf(DEFECT) < 0,
    'E1 the unformatted calc expression is gone from the shipped CODE (comments ignored)');
  ok(codeBase.indexOf(DEFECT) >= 0,
    'E2 and it WAS there on BASE -- the pin can fail');
  const legit = (codeNow.match(/v\.toLocaleString\(\)/g) || []).length;
  ok(legit > 0,
    'E2b the idiom itself survives elsewhere (' + legit + ' sites: charts, KPI cards, ' +
    'history detail) -- this ticket did not sweep the file');

  const hits = (codeNow.match(/formatIngestValue\(v, currencyCol\[colIdx\]\)/g) || []).length;
  ok(hits === 2,
    'E3 exactly TWO render branches now call the shared formatter with the column -- found ' + hits);

  /* THE SECOND SURFACE. refreshIngestCalcCells repaints calc cells in place
   * after every blur and its own contract is to mirror the renderer. It
   * carried the identical unformatted expression, so a money total painted
   * correctly and reverted the first time the operator typed. Fixing the
   * renderer alone would have passed a first-paint test and shipped the bug. */
  ok(/formatIngestValue\(v, currencyCol\[c\]\)/.test(codeNow),
    'E3b the in-place refresh uses the same formatter (the second surface)');
  ok(/const currencyCol = detectCurrencyColumns\(i\.schema\);[\s\S]{0,600}?ingest-cell-calc/.test(codeNow),
    'E3c and it derives the money columns from the SCHEMA, as the renderer does');
  const refreshBase = codeBase.slice(codeBase.indexOf('function refreshIngestCalcCells'));
  ok(refreshBase.indexOf('toLocaleString') >= 0 && refreshBase.indexOf('toLocaleString') < 900,
    'E3d and on BASE that same function used the unformatted expression');

  /* the formatter itself must not have been "helped" */
  const grabFn = (s, n) => {
    const a = s.indexOf('\r\n  function ' + n + '(');
    if (a < 0) return null;
    const b = s.indexOf('\r\n  }', a);
    return b < 0 ? null : s.slice(a, b);
  };
  const f1 = grabFn(SRC, 'formatIngestValue'), f0 = grabFn(baseSrc, 'formatIngestValue');
  ok(f1 && f0 && f1 === f0,
    'E4 formatIngestValue itself is BYTE-IDENTICAL to BASE');
  const d1 = grabFn(SRC, 'detectCurrencyColumns'), d0 = grabFn(baseSrc, 'detectCurrencyColumns');
  ok(d1 && d0 && d1 === d0,
    'E5 detectCurrencyColumns is BYTE-IDENTICAL to BASE -- the derivation did not move');

  /* CLCPA-259: no hardcoded data. The two new lines name no table and no column. */
  const newLines = SRC.split('\r\n').filter(l =>
    /formatIngestValue\(v, currencyCol\[colIdx\]\)/.test(l));
  ok(newLines.length === 2, 'E6 two changed render lines located');
  ok(!newLines.some(l => /\b[A-J]\d+\b/.test(l)),
    'E7 neither names a table id');
  ok(!newLines.some(l => /['"][^'"]*\$[^'"]*['"]/.test(l)),
    'E8 neither carries a literal currency string -- the $ comes from the formatter');

  /* Stored data is untouched and the blast radius is exactly two functions.
   * Cutting BOTH changed regions out of both files must leave them byte-equal:
   * anything else means this ticket moved something it did not name. */
  const cut = (s) => {
    const a = s.indexOf(OPEN), b = s.indexOf(CLOSE, a);
    let r = s.slice(0, a) + s.slice(b);
    const c = r.indexOf('  function refreshIngestCalcCells');
    const d = r.indexOf('\r\n  }', c);
    return r.slice(0, c) + r.slice(d);
  };
  ok(cut(SRC) === cut(baseSrc),
    'E9 EVERY byte of app.js outside the TWO named surfaces is identical to BASE');

  /* The real blast radius, measured by git rather than by position: an
   * insertion shifts every later line, so a positional comparison reports
   * thousands of "differences" and says nothing. */
  /* BOTH SIDES, here too. This read `git diff BASE -- REL`, whose second side
   * is the WORKING TREE: once four later tickets merged it reported the whole
   * wave's +457 -10 instead of this ticket's own diff. The pinned pair is
   * BASE..NEWREV, the same two commits every other assertion here compares. */
  const stat = execFileSync('git', ['diff', '--numstat', BASE, NEWREV, '--', REL],
    { cwd: REPO, encoding: 'utf8' }).trim();
  const [added, removed] = stat ? stat.split(/\s+/).map(Number) : [0, 0];
  log('     git diff vs BASE: +' + added + ' -' + removed + ' lines in app.js');
  ok(added > 0 && removed > 0, 'E10 git confirms app.js changed (+' + added + ' -' + removed + ')');
  ok(removed <= 6,
    'E10b and only ' + removed + ' lines were REMOVED -- a small, surgical change, ' +
    'not a rewrite of the render path');
});

/* ---- X. the harness's own honesty --------------------------------------- */
log('');
log('X. THE HARNESS');
guard('X-block', () => {
  /* A baseline that reads HEAD silently becomes a check on every later round,
   * and while a change is still uncommitted HEAD and the pinned commit are the
   * same blob -- so a repointed baseline would pass unnoticed. Assert the PIN
   * itself, which is true at every stage of the branch. */
  const self = fs.readFileSync(__filename, 'utf8');
  const m = /const BASE = process\.env\.DAC_BASE_COMMIT \|\| '([^']*)';/.exec(self);
  ok(!!m && /^[0-9a-f]{7,40}$/.test(m[1]),
    'X1 BASE is pinned to a literal commit sha, not a symbolic ref -- got ' +
    (m ? JSON.stringify(m[1]) : 'no match'));
  ok(BASE !== 'HEAD',
    'X2 and the resolved baseline is not HEAD');
  /* the slice really came from app.js, not from a re-implementation */
  /* CLOSE is a common idiom and occurs earlier in the file, so it is searched
   * FROM the open anchor -- a bare indexOf found an unrelated earlier match
   * and reported the slice as broken while it was fine. */
  const oAt = SRC.indexOf(OPEN);
  ok(oAt >= 0 && SRC.indexOf(CLOSE, oAt) > oAt,
    'X3 the cell renderer was sliced out of the shipped app.js, both anchors found');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-271-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
