/* CLCPA-248: ONE ANATOMY ACROSS THE TWO COMPARE PANELS.
 *
 * THE AUDIT'S FIRST ANSWER, and it shaped the fix: the prior panel is NOT
 * hardcoded. Both panels already called the SAME renderTable with the SAME
 * opts object, and the only CSS distinguishing them sets the header strip to
 * the colour it already had. There was never a second render path.
 *
 * WHAT ACTUALLY DIFFERED was the layout each table negotiated for ITSELF.
 * `.year-cols` is `grid-template-columns: 1fr 1fr`, and `1fr` is
 * minmax(AUTO, 1fr): a track whose min-content is larger takes more than its
 * half and leaves the other the remainder. Measured on I1 2099-vs-2025:
 * 29 characters of min-content against 205, a ratio of 7.07.
 *
 * AND WHY I1's MIN-CONTENT WAS 205. columnNumericMask marks a column numeric
 * if ONE cell in it is a number. I1's value columns hold numbers in five rows
 * and 96-character prose in four others, so the prose inherited `nowrap` from
 * `.num`, could not break, and demanded ~96 characters. Measured payload-wide:
 * 10 such cells, ALL in I1, longest 96. That is why the defect is GLOBAL in
 * mechanism and VISIBLE only on a long-text table.
 *
 * THE FIX, as ruled: one width vector computed from the CURRENT panel and
 * emitted as a colgroup in BOTH, with table-layout: fixed scoped to the
 * compare path so the colgroup is the authority. The text-cell wrap ships with
 * it because the colgroup cannot deliver one anatomy without it: under fixed
 * layout a nowrap 96-character cell overflows its column instead of wrapping.
 * Stated as a concern before building, built, and measured here.
 *
 * GEOMETRY, NOT RENDERING. A browser is not available, so what is proven is
 * that both panels receive an IDENTICAL colgroup and that the single-panel
 * view receives none. Emely's eye is the acceptance.
 *
 * BASE is d0d0a45.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSS = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-248-evidence/suite-248-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || 'd0d0a45';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);

const SRC = fs.readFileSync(APP, 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const CSS_SRC = fs.readFileSync(path.join(REPO, CSS), 'utf8');
const CSS_BASE = execSync('git show ' + BASE + ':"' + CSS + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));
const BS = String.fromCharCode(92);

/* CSS COMMENTS STRIPPED BEFORE ANY STRUCTURAL ASSERTION.
 *
 * styles.css carries a DEAD block: an unclosed block-comment opener swallows a
 * `.data-table { table-layout: fixed; }` rule, which therefore never applies.
 * My first version of C2 matched that commented text and reported the shared
 * table as fixed-layout when it is in fact auto. That is the comment-as-code
 * trap this project has met eight times in JavaScript, appearing here one
 * language over -- and it is exactly why the assertion is made against a
 * stripped copy rather than the raw file. */
const cssOnly = (s) => String(s).replace(/\/\*[\s\S]*?\*\//g, '');
const CSS_LIVE = cssOnly(fs.readFileSync(path.join(REPO, CSS), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
const say = (m) => lines.push(m);
function guard(label, fn) {
  try { fn(); } catch (e) {
    fail++; lines.push('  FAIL ' + label + ' THREW: ' + (e && e.message));
  }
}
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

function grab(name, src) {
  src = src || SRC;
  for (const p of ['  ', '    ', '']) for (const k of ['function ', 'async function ']) {
    const h = '\r\n' + p + k + name + '('; const i = src.indexOf(h); if (i < 0) continue;
    const c = '\r\n' + p + '}'; const j = src.indexOf(c, i + h.length); if (j <= i) continue;
    return src.slice(i + 2, j + c.length);
  } return null;
}
function grabConst(name, src) {
  src = src || SRC;
  const m = src.match(new RegExp('\\r\\n  (?:const|var|let) ' + name + '\\s*='));
  if (!m) return null;
  const st = src.indexOf(m[0]) + 2; let d = 0, q = null;
  for (let i = st; i < src.length; i++) {
    const c = src[i], p = src[i - 1];
    if (q) { if (c === q && p !== BS) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i); if (e < 0) return null; i = e + 1; continue; }
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\r\n', i); if (e < 0) return null; i = e; continue; }
    if (c === '(' || c === '{' || c === '[') d++;
    else if (c === ')' || c === '}' || c === ']') d--;
    else if (c === ';' && d === 0) return src.slice(st, i + 1);
  } return null;
}

function build(src, tag) {
  const fns = ['renderTable', 'getTableSchema', 'rowsForDisplay', 'columnNumericMask'];
  const cs = [];
  if (grab('compareColWidths', src)) fns.push('compareColWidths');
  for (let it = 0; it < 500; it++) {
    const body = '"use strict";\n' +
      'const console = { warn(){}, info(){}, log(){}, error(){} };\n' +
      'const document = { getElementById: () => null, querySelectorAll: () => [] };\n' +
      cs.map(n => grabConst(n, src)).filter(Boolean).join('\n') + '\n' +
      fns.map(n => grab(n, src)).filter(Boolean).join('\n') + '\n' +
      'return {' + fns.filter(n => grab(n, src)).join(',') + '};';
    let api;
    try { api = new Function('state', 'escapeHtml', body)({ payload: P },
      (s) => String(s == null ? '' : s)); }
    catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) throw new Error(tag + ' shell: ' + e.message);
      if (grab(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm, src) && cs.indexOf(nm) < 0) { cs.push(nm); continue; }
      throw new Error(tag + ' cannot resolve ' + nm);
    }
    try {
      /* I1 for the long-text path, A1 because the CLCPA-245 veto loop is
       * guarded by `if (!out[i]) continue` and a table that flags nothing
       * never reaches it -- that trap has cost three probes now. A5 for the
       * hierarchical branch. */
      ['I1', 'A1', 'A5'].forEach(id => {
        const t = P.tables[id], sc = api.getTableSchema(t, '2025');
        api.renderTable([sc, ...api.rowsForDisplay(t.data['2025'], sc, id)],
          { headerLevels: 1, tableId: id });
      });
      return api;
    } catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) throw new Error(tag + ' call: ' + e.message);
      if (grab(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm, src) && cs.indexOf(nm) < 0) { cs.push(nm); continue; }
      throw new Error(tag + ' cannot resolve ' + nm + ' (call)');
    }
  }
  throw new Error(tag + ': no convergence');
}

say('======================================================================');
say('CLCPA-248 -- one anatomy across the two compare panels');
say('  BASE ' + BASE);
say('======================================================================');

let NEW = null, OLD = null;
guard('both sources assemble and RUN', () => {
  NEW = build(SRC, 'NEW');
  OLD = build(BASE_SRC, 'BASE');
  ok(!!NEW && !!OLD, 'the changed source and BASE both assemble and render');
});
if (!NEW || !OLD) {
  lines.forEach(l => console.log(l));
  console.log('\n  ' + pass + ' passed, ' + fail + ' failed  (assembly failed)');
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(1);
}

const hlOf = (t) => (t.header_levels !== undefined ? t.header_levels : 1);
function resolveRows(api, t, yr) {
  const raw = yr ? (t.data || {})[yr] : null;
  if (!raw || raw.length === 0) return raw;
  const schema = api.getTableSchema(t, yr);
  const has = schema && schema.length > 0;
  const body = api.rowsForDisplay(raw, has ? schema : undefined, t.id);
  return has ? [schema, ...body] : body;
}
const colgroupOf = (h) => (/<colgroup>([\s\S]*?)<\/colgroup>/.exec(h) || [])[1] || null;

/* I1:2099 as Emely's import left it -- her exact mixed fill */
const I1 = JSON.parse(JSON.stringify(P.tables.I1));
I1.data['2099'] = P.tables.I1.data['2025'].map((r, i) =>
  (i === 1) ? [r[0], '', ''] : (i === 0 || i === 2 ? [r[0], 'Hybrid', 'Hybrid'] : [r[0], 9999, 9999]));
const tableOf = (id) => (id === 'I1' ? I1 : P.tables[id]);

const PAIRS = [['I1', '2099', '2025'], ['I1', '2025', '2024'], ['I1', '2024', '2023'],
               ['A1', '2025', '2024'], ['A3', '2025', '2024'], ['A5', '2025', '2024'],
               ['D2', '2025', '2024'], ['F5', '2025', '2024'], ['J1', '2025', '2024'],
               ['A9', '2025', '2024'], ['F6', '2025', '2024'], ['C3', '2025', '2024']];

/* the shipped compare branch, reproduced: ONE vector from the CURRENT panel */
function comparePair(api, id, cur, prev) {
  const t = tableOf(id);
  const ro = { headerLevels: hlOf(t), tableId: id };
  const a = resolveRows(api, t, cur), b = resolveRows(api, t, prev);
  if (!a || !b) return null;
  /* ROUND 2: the vector is a property of the TABLE, so it is asked for once
   * and does not depend on which pair is being rendered. */
  const w = api.compareColWidths ? api.compareColWidths(t, ro) : null;
  const opts = w ? Object.assign({}, ro, { colWidths: w }) : ro;
  return { widths: w, cur: api.renderTable(a, opts), prev: api.renderTable(b, opts) };
}

/* =================== O: ONE ANATOMY =================================== */
say('');
say('=== O. both panels receive an IDENTICAL colgroup ====================');
guard('O: every pair, current and prior', () => {
  let checked = 0; const differ = [], missing = [];
  PAIRS.forEach(([id, cur, prev]) => {
    const r = comparePair(NEW, id, cur, prev);
    if (!r) return;
    checked++;
    const ga = colgroupOf(r.cur), gb = colgroupOf(r.prev);
    if (ga === null || gb === null) { missing.push(id + ':' + cur); return; }
    if (ga !== gb) differ.push(id + ' ' + cur + '/' + prev);
  });
  ok(checked >= 11, 'O1 compared ' + checked + ' current/prior pairs');
  ok(missing.length === 0, 'O2 every compare panel carries a colgroup' +
     (missing.length ? ': ' + missing.join(', ') : ''));
  ok(differ.length === 0, 'O3 and the two panels of a pair are IDENTICAL' +
     (differ.length ? ': ' + differ.join(', ') : ''));
});

guard('O: THE SHIPPED COMPARE BRANCH, pinned structurally', () => {
  /* THE LIMIT, NAMED. comparePair above REPRODUCES the compare branch rather
   * than driving it -- renderSourceTables is DOM-bound and not extractable
   * here. Its own mutation controls proved the cost: FOUR mutations to the
   * SHIPPED branch moved nothing, because the sweeps were running my copy of
   * it. That is the CLCPA-245 class exactly, and naming it is the point.
   * Until the branch is extractable these are STRUCTURAL pins on the shipped
   * text, and they are what those four mutations trip. */
  const rs = codeOnly(grab('renderSourceTables') || '');
  if (!ok(rs !== '', 'OS0 renderSourceTables was found')) return;
  ok((rs.match(/compareColWidths\(/g) || []).length === 1,
     'OS1 the width vector is computed EXACTLY ONCE');
  ok(/compareColWidths\(t, renderOpts\)/.test(rs),
     'OS2 and from the TABLE, not from either years rows, so the skeleton ' +
     'cannot move with the pair');
  ok((rs.match(/renderTable\(dataPrev, cmpOpts\)/g) || []).length === 1 &&
     (rs.match(/renderTable\(dataCurrent, cmpOpts\)/g) || []).length === 1,
     'OS3 and the SAME cmpOpts object reaches both panels');
  ok(!/renderOpts\.colWidths/.test(rs),
     'OS4 renderOpts itself is never given widths, so the single-panel ' +
     'branch cannot inherit them');
  const rt = codeOnly(grab('renderTable') || '');
  ok(/const cmpCls = colGroup \? tblCls \+ ' data-table-cmp' : tblCls;/.test(rt),
     'OS5 and the compare class is applied exactly when a colgroup is emitted');
});
guard('O: BASE had no colgroup at all, which is the defect', () => {
  const r = comparePair(OLD, 'I1', '2025', '2024');
  ok(r !== null, 'O4 BASE renders the pair');
  ok(r && colgroupOf(r.cur) === null && colgroupOf(r.prev) === null,
     'O5 neither BASE panel emitted one, so each negotiated its own widths');
});

guard('O: the vector is INVARIANT across year pairs', () => {
  /* THE ROUND-2 RULING. Round 1 computed the widths from the CURRENT panel,
   * so both panels always matched each other but the anatomy moved as you
   * changed which years were compared. Measured on I1's label column across
   * the three pairs Emely tested: 44.83%, then 37.14%, then 25.00% -- which
   * her eye read as "twin and correct", "prior narrow", "both narrow", in
   * that order. The skeleton is now a property of the TABLE. */
  const t = tableOf('I1');
  const ro = { headerLevels: hlOf(t), tableId: 'I1' };
  const v = NEW.compareColWidths(t, ro);
  ok(!!v, 'O6 I1 has a width vector');
  const pairs = [['2099', '2025'], ['2025', '2024'], ['2024', '2023']];
  const seen = pairs.map(([a, b]) => {
    const r = comparePair(NEW, "I1", a, b);
    return r && r.widths ? JSON.stringify(r.widths) : null;
  });
  ok(seen.every(x => x !== null && x === seen[0]),
     'O7 all three of Emelys pairs get the IDENTICAL vector: ' +
     (seen[0] || 'MISSING'));
  /* and it does not depend on whether the imported year exists at all */
  const without = NEW.compareColWidths(P.tables.I1, ro);
  ok(JSON.stringify(without) === JSON.stringify(v),
     'O8 and adding or removing a year does not move it');
  /* THE RESOLVED WINNER, at the tested widths. O7 says the three pairs
   * AGREE; this says WHAT they agree on, so a change of measure that keeps
   * them agreeing -- longest-word instead of max-content, which put I1 on
   * the 25% floor and is the "both narrow" Emely photographed -- is still
   * caught. Agreement alone is not the requirement. */
  ok(JSON.stringify(v) === '[41.46,29.27,29.27]',
     'O9 and the resolved I1 vector is the accepted one: ' + JSON.stringify(v));
});
/* =================== W: the widths are sane =========================== */
say('');
say('=== W. the resolved widths, at the tested pairs ======================');
guard('W: every vector sums to 100 and keeps the label column readable', () => {
  let bad = [], cramped = [];
  PAIRS.forEach(([id, cur, prev]) => {
    const r = comparePair(NEW, id, cur, prev);
    if (!r || !r.widths) return;
    const sum = r.widths.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 100) > 0.5) bad.push(id + ':' + cur + ' sums ' + sum.toFixed(2));
    if (r.widths[0] < 25 - 0.01 || r.widths[0] > 45 + 0.01)
      cramped.push(id + ':' + cur + ' label ' + r.widths[0] + '%');
    r.widths.slice(1).forEach((x, i) => {
      if (x < 4 - 0.01) cramped.push(id + ':' + cur + ' col' + (i + 1) + ' ' + x + '%');
    });
    if (r.widths.some(w => !(w > 0))) bad.push(id + ':' + cur + ' has a non-positive column');
  });
  ok(bad.length === 0, 'W1 every vector sums to 100 with positive columns' +
     (bad.length ? ': ' + bad.join(', ') : ''));
  ok(cramped.length === 0, 'W2 label in its 25-45 band, no value column under 4%' +
     (cramped.length ? ': ' + cramped.join(', ') : ''));
  /* the floor must actually BITE somewhere, or W2 proves nothing */
  /* the band must genuinely BITE at both ends, or W2 proves nothing */
  const atCeil = [], atFloor = [];
  Object.keys(P.tables).forEach(id => {
    const tt = P.tables[id];
    const w = NEW.compareColWidths(tt, { headerLevels: hlOf(tt), tableId: id });
    if (!w) return;
    if (Math.abs(w[0] - 45) < 0.01) atCeil.push(id);
    if (Math.abs(w[0] - 25) < 0.01) atFloor.push(id);
  });
  ok(atCeil.length > 0, 'W3 the 45% ceiling bites on ' + atCeil.length +
     ' tables: ' + atCeil.slice(0, 6).join(', '));
  ok(atFloor.length > 0, 'W4 and the 25% floor on ' + atFloor.length +
     ' tables: ' + atFloor.slice(0, 6).join(', '));
  /* C1 is the per-column floor's own case: a 0.51% sliver before it */
  const c1 = NEW.compareColWidths(P.tables.C1, { headerLevels: hlOf(P.tables.C1), tableId: 'C1' });
  ok(c1 && c1.slice(1).every(x => x >= 4 - 0.01),
     'W5 and C1s sliver column is raised to the 4% minimum: ' + JSON.stringify(c1));
});

/* =================== N: the nowrap prose ============================== */
say('');
say('=== N. a TEXT cell wraps even in a numeric column ====================');
guard('N: the 96-character prose no longer demands 96 characters', () => {
  const h = NEW.renderTable(resolveRows(NEW, P.tables.I1, '2025'),
    { headerLevels: 1, tableId: 'I1' });
  const tds = h.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
  const longNum = tds.filter(td => /class="num/.test(td) &&
    td.replace(/<[^>]*>/g, '').trim().length >= 40);
  ok(longNum.length > 0, 'N1 I1 has long text in numeric columns: ' + longNum.length + ' cells');
  ok(longNum.every(td => /class="num num-text"/.test(td)),
     'N2 and EVERY one carries the wrap modifier');
  /* alignment is untouched: the num class is still there */
  ok(longNum.every(td => /class="num/.test(td)),
     'N3 while keeping the num class, so CLCPA-140s column alignment holds');
  /* a genuinely numeric cell must NOT get it */
  const numeric = tds.filter(td => /class="num"/.test(td));
  ok(numeric.length > 0, 'N4 and plain numeric cells still exist: ' + numeric.length);
  ok(numeric.every(td => !/num-text/.test(td)),
     'N5 none of which carries the text modifier');
});

guard('N: BASE gave the prose nowrap, which is the crush', () => {
  const h = OLD.renderTable(resolveRows(OLD, P.tables.I1, '2025'),
    { headerLevels: 1, tableId: 'I1' });
  ok(!/num-text/.test(h), 'N6 BASE had no such modifier');
  const tds = h.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
  const longNum = tds.filter(td => /class="num"/.test(td) &&
    td.replace(/<[^>]*>/g, '').trim().length >= 40);
  ok(longNum.length > 0,
     'N7 and ' + longNum.length + ' prose cells sat in a nowrap numeric column');
});

/* =================== B: the blast radius, measured ==================== */
say('');
say('=== B. global mechanism, visible on long text only ===================');
guard('B: which tables hold text in a numeric column', () => {
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const hit = {};
  let cells = 0;
  Object.keys(P.tables).forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).forEach(y => {
      const rows = t.data[y] || []; if (!rows.length) return;
      const n = Math.max(...rows.map(r => (r || []).length));
      for (let c = 1; c < n; c++) {
        if (!rows.some(r => isNum((r || [])[c]))) continue;
        rows.forEach(r => {
          const v = (r || [])[c];
          if (typeof v === 'string' && v.trim().length >= 40) { cells++; hit[id] = 1; }
        });
      }
    });
  });
  ok(cells === 10, 'B1 exactly TEN such cells payload-wide: ' + cells);
  ok(Object.keys(hit).join(',') === 'I1',
     'B2 and all of them in I1: ' + Object.keys(hit).sort().join(','));
});

guard('B: the A-family control is unaffected either way', () => {
  ['A1', 'A3', 'A5'].forEach(id => {
    const r = comparePair(NEW, id, '2025', '2024');
    if (!r) return;
    ok(colgroupOf(r.cur) === colgroupOf(r.prev),
       'B3 ' + id + ' compare panels are identical');
    /* B4 ORIGINALLY asserted these tables carry NO modifier, on the strength
     * of the >=40-character measurement. That was wrong: the modifier applies
     * to text of ANY length in a numeric column, and measured payload-wide
     * that is 95 cells across TEN tables (A3, A4, A9, A10, C2, F6, F7, I1, J2,
     * J8). Only I1's text is long enough to have caused the crush. The claim
     * is corrected to the one that is true and is this ticket's subject:
     * whatever the modifier does, both panels do it IDENTICALLY. */
    /* AND the count is NOT required to match. The modifier follows the CELL,
     * so two years with different content legitimately carry different
     * numbers of it -- A3 renders 0 against 3, A5 27 against 24. What this
     * ticket requires is one ANATOMY, which is the colgroup asserted in B3;
     * requiring equal counts would be requiring equal DATA. What is asserted
     * instead is the property: every cell carrying the modifier really is a
     * text cell in a numeric column. */
    [r.cur, r.prev].forEach((h, k) => {
      const tds = h.match(/<td[^>]*>[\s\S]*?<\/td>/g) || [];
      const wrong = tds.filter(td => /num-text/.test(td) &&
        /^\s*-?[\d.,$%]+\s*$/.test(td.replace(/<[^>]*>/g, '').trim()) &&
        td.replace(/<[^>]*>/g, '').trim() !== '');
      ok(wrong.length === 0,
         'B4 ' + id + ' ' + (k ? 'prior' : 'current') +
         ': every wrap-modified cell is genuinely text, not a number');
    });
  });
});

/* =================== S: the single-panel path ========================= */
say('');
say('=== S. the single-panel view is untouched ============================');
guard('S: no compare markup leaks into it', () => {
  let leaked = [], checked = 0;
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    const ys = Object.keys(t.data || {}).filter(y => (t.data[y] || []).length);
    if (!ys.length) return;
    ys.forEach(y => {
      checked++;
      const h = NEW.renderTable(resolveRows(NEW, t, y), { headerLevels: hlOf(t), tableId: id });
      if (/<colgroup>/.test(h) || /data-table-cmp/.test(h)) leaked.push(id + ':' + y);
    });
  });
  ok(checked >= 140, 'S1 rendered ' + checked + ' single-panel table-years');
  ok(leaked.length === 0, 'S2 NOT ONE carries a colgroup or the compare class' +
     (leaked.length ? ': ' + leaked.slice(0, 5).join(', ') : ''));
});

guard('S: and the single-panel HTML is otherwise byte-identical to BASE', () => {
  let checked = 0, moved = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).forEach(y => {
      if (!(t.data[y] || []).length) return;
      const ro = { headerLevels: hlOf(t), tableId: id };
      const a = NEW.renderTable(resolveRows(NEW, t, y), ro);
      const b = OLD.renderTable(resolveRows(OLD, t, y), ro);
      checked++;
      /* the ONLY permitted difference is the wrap modifier on a text cell */
      if (a.split(' num-text').join('') !== b) moved.push(id + ':' + y);
    });
  });
  ok(checked >= 140, 'S3 compared ' + checked + ' table-years against BASE');
  ok(moved.length === 0,
     'S4 and the ONLY difference anywhere is the num-text modifier' +
     (moved.length ? ': ' + moved.slice(0, 5).join(', ') : ''));
});

/* =================== C: the CSS ======================================= */
say('');
say('=== C. the stylesheet, scoped to the compare path ====================');
guard('C: fixed layout is scoped, and the wrap is a modifier', () => {
  ok(/\.data-table-cmp \{ table-layout: fixed; \}/.test(CSS_LIVE),
     'C1 table-layout: fixed is on .data-table-cmp only');
  ok(!/^\.data-table \{[^}]*table-layout: fixed/m.test(CSS_LIVE),
     'C2 the shared .data-table keeps table-layout: auto');
  /* the dead block recorded, not left as a surprise for the next reader */
  ok(/\.data-table \{[\s\S]{0,40}table-layout: fixed/.test(CSS_SRC),
     'C2b a COMMENTED-OUT fixed-layout rule exists in the file, which is why ' +
     'this suite strips CSS comments before asserting anything');
  ok(/\.data-table td\.num\.num-text \{/.test(CSS_LIVE),
     'C3 the wrap is a MODIFIER on .num, not a replacement for it');
  ok(/white-space: normal;/.test(
      (/\.data-table td\.num\.num-text \{([\s\S]*?)\}/.exec(CSS_LIVE) || [])[1] || ''),
     'C4 and it restores wrapping');
  ok(!/text-align/.test(
      (/\.data-table td\.num\.num-text \{([\s\S]*?)\}/.exec(CSS_LIVE) || [])[1] || ''),
     'C4b and does NOT touch alignment: my first version set text-align:left, ' +
     'which would have silently re-aligned 95 cells across TEN tables');
  ok(!/\.data-table-cmp/.test(CSS_BASE) && !/num-text/.test(CSS_BASE),
     'C5 neither existed at BASE');
  /* the num rule itself must still carry nowrap for real numbers */
  ok(/\.data-table td\.num \{[^}]*white-space: nowrap/.test(CSS_LIVE),
     'C6 and .num still nowraps, which is what numbers need');
});

/* =================== T: the CLCPA-245 tooltip ========================= */
say('');
say('=== T. the CLCPA-245 label tooltip, in both panels ===================');
guard('T: it is an EDITOR feature and does not reach these panels', () => {
  /* Emely asked for it verified in both panels. The honest answer measured:
   * the tooltip binds to .ingest-cell-label[data-label-tip], which
   * renderIngestEditor emits. These compare panels are the REPORT view, built
   * by renderTable, which emits no such element -- so there is nothing to
   * verify in them and nothing that could have regressed. Recorded rather than
   * reported as "works". */
  const r = comparePair(NEW, 'I1', '2025', '2024');
  ok(r !== null, 'T1 the pair renders');
  ok(!/ingest-cell-label/.test(r.cur) && !/ingest-cell-label/.test(r.prev),
     'T2 neither compare panel contains an ingest label at all');
  ok(!/data-label-tip/.test(r.cur) && !/data-label-tip/.test(r.prev),
     'T3 nor the attribute the tooltip binds to');
  const w = grab('wireIngestLabelTips');
  ok(w !== null && /ingest-cell-label\[data-label-tip\]/.test(codeOnly(w)),
     'T4 the wiring targets the EDITOR label, which is why');
  ok(grab('wireIngestLabelTips') === grab('wireIngestLabelTips', BASE_SRC),
     'T5 and this ticket did not touch it');
});

/* =================== X: the exclusions ================================ */
say('');
say('=== X. what this ticket did NOT touch ================================');
guard('X: the data layer and the editor are untouched', () => {
  ['rowsForDisplay', 'totalRowFlags', 'recomputeTotals', 'columnNumericMask',
   'getTableSchema', 'renderIngestEditor', 'parseNumericInput'].forEach(n => {
    ok(grab(n) === grab(n, BASE_SRC), 'X1 ' + n + ' is byte-identical to BASE');
  });
  ok(grabConst('DERIVED_COLS') === grabConst('DERIVED_COLS', BASE_SRC),
     'X2 DERIVED_COLS is byte-identical');
});

guard('X: the blast radius', () => {
  const names = [...new Set((SRC.match(/(?:^|\r\n)[ \t]*(?:async )?function (\w+)\s*\(/g) || [])
    .map(m => /function (\w+)/.exec(m)[1]))];
  const changed = names.filter(n => grab(n) !== grab(n, BASE_SRC));
  say('       changed: ' + changed.sort().join(', '));
  const EXPECT = {
    renderTable: 'the colgroup and the text-cell modifier',
    compareColWidths: 'the shared width vector (new)',
    renderSourceTables: 'it computes the vector once and passes it to both',
  };
  changed.forEach(n => ok(n in EXPECT, 'the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  ok(changed.length === 3, 'X3 exactly THREE functions changed: ' + changed.length);
});

guard('X: the baseline', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X4 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: REPO }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'X5 and an ancestor of HEAD');
});

lines.forEach(l => console.log(l));
console.log('');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n\n  ' + pass + ' passed, ' + fail + ' failed\n');
process.exitCode = fail ? 1 : 0;
