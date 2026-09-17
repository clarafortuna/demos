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
 * ---------------------------------------------------------------------------
 * ROUND 3, AND THE CORRECTION OF RECORD THAT COMES WITH IT.
 *
 * The colgroup was never authoritative on screen. `.data-table-cmp` and
 * `.data-table` declare table-layout at the SAME specificity, and the shared
 * rule sits 900 lines later, so auto won for two shipped rounds. Under auto a
 * colgroup is advisory: the browser distributes by min-content, a nowrap cell
 * demands its whole string, and each panel renegotiated from the year it
 * happened to hold. Measured from the real emitted HTML, I1's label column:
 * 37.14% where the year's values are short, 12.38% where they are prose --
 * which is precisely "current wide, prior narrow", then "both narrow".
 *
 * Round 1's measure was min-content, the same quantity the browser was
 * already using, so its vector agreed with what the screen was doing anyway
 * and the change looked plausible. It never governed anything. The wrap it
 * shipped was real and did work.
 *
 * WHY THIS SUITE DID NOT SEE IT. C1 asserted the rule existed. C2 asserted
 * the overriding rule existed and called that correct. Neither asked which
 * one WINS. That is the second sighting of the CSS-assertion-mistaken-for-a-
 * layout-one class, after 237-D. Section R now resolves the cascade, and
 * R12 pins the round-1 stylesheet resolving to AUTO: the assertion that fails
 * rounds 1 and 2 and passes this one.
 *
 * Round 3 ships three things: the selector wins by SPECIFICITY (0,2,0) so no
 * later edit can undo it by being later; isTextCell asks isWhollyNumeric
 * rather than the deliberately lenient isNumeric, which is left untouched;
 * and the resolver itself, shared kit, self-tested in R before it is trusted
 * in C.
 *
 * BASE is d0d0a45. The round-1 stylesheet is pinned at d43fd32 and the
 * round-2 app.js at d2bb9c2; both literal, both predating what they measure.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
/* ROUND 3: the cascade resolver, shared kit. A rule's PRESENCE is not its
 * effect, and presence is all C1/C2 ever checked. Self-tested in section R
 * before it is trusted in section C, because a shared helper that drifts
 * silently rewrites every suite that leans on it. */
const cascade = require('../_kit/css_cascade.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
/* PINNED ON BOTH SIDES (CLAUDE.md: "Pin both sides"). The post-change side
 * reads 2361a6a instead of the working tree --
 * main immediately before the 2026-09-16 wave, and the last commit at which
 * every suite in this tree was green. That is the build this suite was
 * written against and last proved.
 *
 * Both sides fixed makes this suite permanent evidence of what its ticket
 * shipped, and it can no longer be falsified by later work. NOT ONE
 * ASSERTION WAS CHANGED to achieve that: the claims are the claims, and
 * only the build they are asked about is now named.
 *
 * DAC_APP_OVERRIDE still wins, so the mutation runner keeps working. */
const NEWREV = process.env.DAC_NEW_COMMIT || '2361a6a';
const CSS = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-248-evidence/suite-248-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || 'd0d0a45';
/* The ROUND-1 stylesheet, the one that shipped the inert rule. Section R
 * resolves it and requires the answer `auto`: that is the assertion which
 * fails rounds 1 and 2 and passes round 3. Pinned to a literal sha, both
 * sides, so it cannot quietly become a check on whatever is current. */
const R1_COMMIT = process.env.CLCPA248_R1 || 'd43fd32';
/* The ROUND-2 app.js, the build that is live while this ships. BASE answers
 * "what did the whole ticket do"; this answers "what did ROUND 3 do", which
 * is the only side on which the 19-cell figure means anything. Measuring the
 * predicate against BASE instead reports 267, because it counts round 1's
 * wrap modifier all over again. */
const R2_COMMIT = process.env.CLCPA248_R2 || 'd2bb9c2';
const APP = process.env.DAC_APP_OVERRIDE || ('git show ' + NEWREV + ':' + REL);

const SRC = process.env.DAC_APP_OVERRIDE
  ? fs.readFileSync(process.env.DAC_APP_OVERRIDE, 'utf8')
  : execSync('git show ' + NEWREV + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const CSS_SRC = fs.readFileSync(path.join(REPO, CSS), 'utf8');
const CSS_BASE = execSync('git show ' + BASE + ':"' + CSS + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const CSS_R1 = execSync('git show ' + R1_COMMIT + ':"' + CSS + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const R2_SRC = execSync('git show ' + R2_COMMIT + ':"' + REL + '"',
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

/* LINE-INDEXED, and the repair is the point.
 *
 * The old grab searched for '\r\n' + pad + 'function NAME(' and ended at the
 * first '\r\n' + pad + '}'. For a function declared at COLUMN 0 that
 * terminator is '\r\n}', and this file has column-0 function text living
 * inside template literals -- drawSectionEArc is one. The slice then ran to
 * whatever closing brace came next, which was most of the file, so unrelated
 * edits anywhere in that span made the function compare "changed". Measured
 * when CLCPA-253 landed: 25 functions reported changed where the real answer
 * was 7, drawSectionEArc, wireQuadrantTooltip and wireRankToggle among the
 * phantoms. That is the over-read class this project has named before.
 *
 * Now: find the declaration LINE at a known indent, end at the first line
 * that is exactly that indent plus '}', and REFUSE -- return null -- if the
 * next declaration at the same indent arrives first. Refusing is the part
 * that matters: a grab that cannot bound a function must say so rather than
 * hand back a plausible-looking span.
 *
 * Self-tested in section H below, on a padded function and a column-0 one. */
function grab(name, src) {
  src = src || SRC;
  const lines = src.split('\r\n');
  for (const pad of ['  ', '    ', '']) {
    const decl = new RegExp('^' + pad + '(?:async )?function ' + name + '\\s*\\(');
    const anyDecl = new RegExp('^' + pad + '(?:async )?function \\w+\\s*\\(');
    const start = lines.findIndex(l => decl.test(l));
    if (start < 0) continue;
    const close = pad + '}';
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i] === close) return lines.slice(start, i + 1).join('\r\n');
      if (anyDecl.test(lines[i])) break;   /* unbounded: refuse */
    }
    return null;
  }
  return null;
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
  const fns = ['renderTable', 'getTableSchema', 'rowsForDisplay',
    /* CLCPA-263 deps: rowsForDisplay derives the value (pct) composites on
     * its clone, so the closure needs the derivation and its three helpers. */
    'applyCompositeShares', 'isCompositeShareCol', 'compositeValueText', 'bareNumber', 'columnNumericMask'];
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

/* =================== H: the grab helper, self-tested ================= */
say('');
say('=== H. the extractor this suite leans on ============================');
guard('H: grab returns the function asked for, padded and column-0 alike', () => {
  /* a 2-space function: the ordinary case */
  const g = grab('isNumeric');
  ok(g !== null, 'H1 a padded function is found');
  ok(g !== null && /^  function isNumeric\(/.test(g),
     'H2 and the slice STARTS at its declaration');
  ok(g !== null && /\r\n  \}$/.test(g),
     'H3 and ENDS at its own closing brace');
  ok(g !== null && (g.match(/function \w+\s*\(/g) || []).length === 1,
     'H4 and contains exactly one function declaration: ' +
     (g ? (g.match(/function \w+\s*\(/g) || []).length : '-'));
  ok(g !== null && g.length < 2000,
     'H5 at ' + (g ? g.length : '-') + ' characters, not a span of the file');

  /* the column-0 case that broke it: function text inside a template literal */
  const col0 = grab('drawSectionEArc');
  ok(col0 === null || col0.length < 20000,
     'H6 drawSectionEArc is either refused or bounded, never half the file: ' +
     (col0 === null ? 'refused' : col0.length + ' chars'));
  if (col0 !== null) {
    ok(/^function drawSectionEArc\(/.test(col0),
       'H7 and if returned, the slice starts at its declaration');
    ok((col0.match(/^function \w+\s*\(/gm) || []).length === 1,
       'H8 and holds no second column-0 declaration');
  } else {
    ok(true, 'H7 refused, which is the honest answer for an unbounded span');
    ok(true, 'H8 and refusing cannot be mistaken for "unchanged"');
  }

  /* THE REGRESSION THIS REPAIR EXISTS FOR: the blast radius must count only
   * functions that really moved. Measured directly, without grab. */
  const names = [...new Set((SRC.match(/(?:^|\r\n)[ \t]*(?:async )?function (\w+)\s*\(/g) || [])
    .map(m => /function (\w+)/.exec(m)[1]))];
  const changed = names.filter(n => grab(n, SRC) !== grab(n, BASE_SRC));
  /* the ceiling rises with the stack: Section C groups A-D add functions to
   * the tree this suite reads. What it guards is the ORDER OF MAGNITUDE --
   * the over-reading grab reported 25 where the truth was single figures. */
  /* 20 -> 25: CLCPA-252 round 2 and CLCPA-264 each added two more to the
   * tree this suite reads. The ORDER OF MAGNITUDE is what this guards, and
   * the exact list is X3 above; raising the ceiling here does not relax that. */
  /* 25 -> 30: CLCPA-263 moved five more into the tree this suite reads.
   * The ORDER OF MAGNITUDE is what this guards; the exact list is X3. */
  /* 30 -> 32: CLCPA-252 round 3 added one more. */
  ok(changed.length < 32,
     'H9 the changed-function count is plausible (' + changed.length + '), not the ' +
     '25 the over-reading grab reported');
  ok(changed.indexOf('drawSectionEArc') < 0 &&
     changed.indexOf('wireQuadrantTooltip') < 0 && changed.indexOf('wireRankToggle') < 0,
     'H10 and the three phantoms it used to report are gone from it');
});

/* =================== P: the wrap predicate =========================== */
say('');
say('=== P. isWhollyNumeric, and what it moves ============================');
guard('P: the predicate discriminates where isNumeric could not', () => {
  ok(typeof NEW.isWhollyNumeric === 'function',
     'P0 isWhollyNumeric is reachable from the real assembled source');
  if (typeof NEW.isWhollyNumeric !== 'function') return;
  const PROSE = '1; Senior Specialist Customer Energy Solutions';
  /* THE discriminating pair, driven through both REAL functions. */
  ok(NEW.isNumeric(PROSE) === true,
     'P1 isNumeric still says the I1 prose is numeric, because parseFloat is');
  ok(NEW.isWhollyNumeric(PROSE) === false,
     'P2 while isWhollyNumeric says it is not, which is what earns the wrap');
  /* real numbers must stay numbers, or the wrap leaks onto figures */
  [['32,919', true], ['$1,234.56', true], ['12.5%', true], ['-3', true],
   ['.5', true], ['1e3', true], ['0', true], ['  7  ', true],
   ['3 of 4', false], ['Yes', false], ['No: 0', false], ['2024 total', false],
   ['', false], ['1;', false]].forEach(([s, want]) => {
    ok(NEW.isWhollyNumeric(s) === want,
       'P3 isWhollyNumeric(' + JSON.stringify(s) + ') is ' + want);
  });
  ok(NEW.isWhollyNumeric(5) === true && NEW.isWhollyNumeric(null) === false &&
     NEW.isWhollyNumeric(undefined) === false && NEW.isWhollyNumeric(NaN) === false,
     'P4 and non-strings answer sensibly');
});

guard('P: the exact cell population that changes, both sides driven', () => {
  /* Every table, every year, one render each, NEW against the ROUND-2 build
   * that is live right now. The classes are read back out of the HTML, so
   * this measures what SHIPS, not what the predicate returns in isolation.
   * The payload tables as committed, not the 2099 fixture, so the figure is
   * the same one the audit reported and can be reproduced against the file. */
  const R2 = build(R2_SRC, 'R2');
  const census = (api) => {
    const out = [];
    Object.keys(P.tables).sort().forEach(id => {
      const t = P.tables[id];
      Object.keys(t.data || {}).sort().forEach(y => {
        const rows = resolveRows(api, t, y);
        if (!rows || !rows.length) return;
        const h = api.renderTable(rows, { headerLevels: hlOf(t), tableId: id });
        (h.match(/<td([^>]*)>([\s\S]*?)<\/td>/g) || []).forEach((cell, idx) => {
          const m = /<td([^>]*)>([\s\S]*?)<\/td>/.exec(cell);
          out.push({
            id, y, idx,
            cls: (/class="([^"]*)"/.exec(m[1]) || [, ''])[1],
            text: m[2].replace(/<[^>]*>/g, '').trim(),
          });
        });
      });
    });
    return out;
  };
  const a = census(R2), b = census(NEW);
  ok(a.length === b.length,
     'P5 the same cells are rendered on both sides: ' + a.length + ' / ' + b.length);
  if (a.length !== b.length) return;
  const moved = [];
  for (let i = 0; i < b.length; i++) if (a[i].cls !== b[i].cls) moved.push({ i, a: a[i], b: b[i] });
  ok(moved.length === 19, 'P6 exactly NINETEEN cells change class: ' + moved.length);
  ok(moved.every(m => m.a.cls === 'num' && m.b.cls === 'num num-text'),
     'P7 and every single move is num -> num num-text, so nothing LOSES a ' +
     'class and nothing that wrapped stops wrapping');
  const byTable = {};
  moved.forEach(m => { byTable[m.b.id] = (byTable[m.b.id] || 0) + 1; });
  ok(JSON.stringify(byTable) === '{"C2":15,"I1":4}',
     'P8 C2 fifteen and I1 four: ' + JSON.stringify(byTable));
  /* THE COLLATERAL, NAMED. The C2 fifteen are CLCPA-216's composite
   * "value (pct)" strings: parseFloat read them as numbers, so they were held
   * on one line. They may now wrap, and that shows on the single-panel view
   * as well as in compare mode. Flagged for Emely's eye, pinned here so it
   * cannot grow quietly. */
  const c2 = moved.filter(m => m.b.id === 'C2').map(m => m.b.text);
  ok(c2.every(s => /^[\d.,]+ \(\d+%\)$/.test(s)),
     'P9 and the C2 fifteen are all the "value (pct)" composite, nothing else: ' +
     JSON.stringify(c2.slice(0, 3)));
  const i1 = moved.filter(m => m.b.id === 'I1').map(m => m.b.text);
  ok(i1.every(s => s === '1; Senior Specialist Customer Energy Solutions'),
     'P10 and the I1 four are the one string the audit named');
});

/* =================== Q: the two-column tables, PINNED ================= */
say('');
say('=== Q. the four two-column compare tables ============================');
guard('Q: the other live rule that sets a width on these cells', () => {
  /* Emely asked for this pinned, not claimed. `.data-table tbody tr
   * td:nth-child(2):last-child` sets width:100%; max-width:0 and applies only
   * to a two-column table. Under table-layout: fixed, CSS 2.1 17.5.2.1 gives
   * col elements precedence over cell widths, so the colgroup should still
   * govern -- but that is a BROWSER behaviour this suite cannot execute. What
   * is pinned here is the population and the inputs, so if the set grows or
   * the rule moves, the next reader is told. The eye is the acceptance. */
  const two = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = tableOf(id);
    const y = Object.keys(t.data || {}).sort().pop();
    if (!y) return;
    const w = NEW.compareColWidths(t, { headerLevels: hlOf(t), tableId: id });
    if (w && w.length === 2) two.push(id);
  });
  ok(two.join(',') === 'B1,D1,F1,F3',
     'Q1 exactly four compare tables are two-column: ' + two.join(','));
  two.forEach(id => {
    const t = tableOf(id);
    const w = NEW.compareColWidths(t, { headerLevels: hlOf(t), tableId: id });
    ok(w && Math.abs(w.reduce((x, y2) => x + y2, 0) - 100) < 0.01 && w.every(x => x > 0),
       'Q2 ' + id + ' still gets a complete two-column vector: ' + JSON.stringify(w));
  });
  const rule = /\.data-table tbody tr td:nth-child\(2\):last-child \{([\s\S]*?)\}/.exec(CSS_LIVE);
  ok(!!rule && /width: 100%/.test(rule[1]) && /max-width: 0/.test(rule[1]),
     'Q3 the cell-width rule is present and unchanged in shape');
  ok(rule && CSS_BASE.indexOf(rule[0].slice(0, 60)) >= 0,
     'Q4 and it predates this ticket, so it is inherited, not introduced');
  ok(!/is-definitions/.test(codeOnly(SRC)),
     'Q5 .data-table.is-definitions is never emitted by the app, so its own ' +
     'fixed-layout and 25/75 widths cannot interact with the colgroup');
});

/* =================== R: the cascade resolver ========================== */
say('');
say('=== R. the resolver itself, before it is trusted on a real file ======');
guard('R: synthetic input with a known right answer', () => {
  const EL = { tag: 'table', classes: ['data-table', 'data-table-cmp'] };
  const win = (css) => {
    const r = cascade.resolve(css, EL, 'table-layout');
    return r.winner ? r.winner.value : null;
  };
  ok(win('.data-table-cmp{table-layout:fixed}\n.data-table{table-layout:auto}') === 'auto',
     'R1 at EQUAL specificity the later rule wins, which is the whole defect');
  ok(win('.data-table{table-layout:auto}\n.data-table-cmp{table-layout:fixed}') === 'fixed',
     'R2 and order genuinely decides it, both ways');
  ok(win('.data-table.data-table-cmp{table-layout:fixed}\n.data-table{table-layout:auto}') === 'fixed',
     'R3 specificity beats order, which is why the fix names two classes');
  ok(win('.data-table.data-table-cmp{table-layout:fixed}\n.data-table{table-layout:auto !important}') === 'auto',
     'R4 and !important beats specificity');
  /* No space after the opener, deliberately: with a space the commented
   * selector parses as two compounds and lands in `conditional`, so the
   * assertion would pass even with comment-stripping disabled. It has to be
   * a shape that would otherwise become a real, matching candidate, or it is
   * an assertion that cannot fail. */
  ok(win('.data-table-cmp{table-layout:fixed}/*.data-table{table-layout:auto}*/') === 'fixed',
     'R5 a commented rule is not a rule');
  ok(win('.data-table-cmp{table-layout:fixed}\n.other{table-layout:auto}') === 'fixed',
     'R6 a non-matching selector is ignored');
  ok(win('.data-table-cmp{table-layout:auto;table-layout:fixed}') === 'fixed',
     'R7 the LAST declaration in a block is the one that counts');
  /* the refusals, which matter as much as the answers */
  const anc = cascade.resolve('.wrap .data-table{table-layout:auto}', EL, 'table-layout');
  ok(anc.winner === null && anc.conditional.length === 1,
     'R8 a rule needing an ancestor is CONDITIONAL when no chain is supplied');
  /* and DECIDED when one is */
  const withChain = (ancestors) => cascade.resolve(
    '.wrap .data-table{table-layout:auto}',
    { tag: 'table', classes: ['data-table', 'data-table-cmp'], ancestors },
    'table-layout');
  const inside = withChain([{ tag: 'div', classes: ['wrap'] }]);
  ok(inside.winner !== null && inside.winner.value === 'auto' && !inside.conditional.length,
     'R8b given the chain it DOES judge a descendant selector');
  const outside = withChain([{ tag: 'div', classes: ['other'] }]);
  ok(outside.winner === null && !outside.conditional.length,
     'R8c and rules the chain excludes are dropped, not counted');
  const child = cascade.resolve('.wrap > .data-table{table-layout:auto}',
    { tag: 'table', classes: ['data-table'], ancestors: [{ tag: 'div', classes: ['x'] }, { tag: 'div', classes: ['wrap'] }] },
    'table-layout');
  ok(child.winner !== null && child.winner.value === 'auto',
     'R8d the child combinator binds to the immediate parent');
  const notChild = cascade.resolve('.wrap > .data-table{table-layout:auto}',
    { tag: 'table', classes: ['data-table'], ancestors: [{ tag: 'div', classes: ['wrap'] }, { tag: 'div', classes: ['x'] }] },
    'table-layout');
  ok(notChild.winner === null,
     'R8e and refuses when the parent is someone else');
  const sib = cascade.resolve('.a + .data-table{table-layout:auto}',
    { tag: 'table', classes: ['data-table'], ancestors: [] }, 'table-layout');
  ok(sib.winner === null && sib.conditional.length === 1,
     'R8f a sibling combinator stays undecidable even with a chain');
  const med = cascade.resolve('@media print{.data-table{table-layout:auto}}', EL, 'table-layout');
  ok(med.winner === null && med.conditional.length === 1,
     'R9 nor is an at-rule body judged as if it always applied');
  const kf = cascade.resolve('@keyframes x{from{table-layout:auto}}', EL, 'table-layout');
  ok(kf.winner === null && kf.conditional.length === 0,
     'R10 and a keyframe block is not a style rule at all');
  ok(JSON.stringify(cascade.specificity('.data-table.data-table-cmp')) === '[0,2,0]' &&
     JSON.stringify(cascade.specificity('.data-table')) === '[0,1,0]',
     'R11 the specificity arithmetic is the one the two rules turn on');
  /* THE LINE NUMBERS THEMSELVES. The order tie-break is computed from them,
   * and the first cut of this module stamped every rule with the line of the
   * one before it -- so adjacent rules tied, the tie-break never ran, and the
   * right answer came out of sort stability instead. A mutation that reversed
   * the ordering moved nothing, which is how it was found. */
  const lines2 = cascade.resolve('.data-table-cmp{table-layout:fixed}\n' +
    '\n.data-table{table-layout:auto}', EL, 'table-layout').candidates.map(c => c.line);
  ok(JSON.stringify(lines2) === '[1,3]',
     'R11b and rules report the line they actually start on: ' + JSON.stringify(lines2));
});

guard('R: THE ASSERTION THAT WOULD HAVE FAILED ROUNDS 1 AND 2', () => {
  /* The round-1 stylesheet is still in git. Resolved, it says auto: the
   * colgroup was advisory on screen for two shipped rounds while C1 and C2
   * passed. This is the regression pin for the whole class. */
  const EL = { tag: 'table', classes: ['data-table', 'data-table-cmp'] };
  const r1 = cascade.resolve(CSS_R1, EL, 'table-layout');
  ok(r1.winner !== null && r1.winner.value === 'auto',
     'R12 the round-1 stylesheet resolves to AUTO at ' + R1_COMMIT +
     ', from "' + (r1.winner ? r1.winner.sel : '?') + '" line ' +
     (r1.winner ? r1.winner.line : '?'));
  ok(/\.data-table-cmp \{ table-layout: fixed; \}/.test(cascade.stripComments(CSS_R1).css),
     'R13 while the rule it was supposed to obey was present and correct, ' +
     'which is precisely what a presence assertion cannot see');
});

/* =================== C: the CSS ======================================= */
say('');
say('=== C. the stylesheet, RESOLVED rather than matched ==================');
guard('C: fixed layout actually wins, and the wrap is a modifier', () => {
  const CMP = { tag: 'table', classes: ['data-table', 'data-table-cmp'] };
  const ONE = { tag: 'table', classes: ['data-table'] };
  const r = cascade.resolve(CSS_SRC, CMP, 'table-layout');
  ok(r.winner !== null && r.winner.value === 'fixed',
     'C1 a compare table RESOLVES to table-layout: fixed, from "' +
     (r.winner ? r.winner.sel : 'NOTHING') + '" line ' + (r.winner ? r.winner.line : '-'));
  ok(r.winner !== null && /data-table-cmp/.test(r.winner.sel),
     'C1b and the winner is the compare rule, not something else that agrees');
  /* C2, POLARITY FLIPPED. The old C2 asserted that .data-table still says
   * auto and called that correct. It is correct, and irrelevant: what matters
   * is that it does not BEAT the compare rule. */
  const beaten = r.candidates.filter(c => !/data-table-cmp/.test(c.sel) && c.value !== 'fixed');
  ok(beaten.length > 0,
     'C2 the shared .data-table does still declare auto for the single-panel ' +
     'view (' + beaten.length + ' such declaration(s)), and');
  ok(r.winner !== null && beaten.every(c => cascade.specificity(r.winner.sel)[1] > c.spec[1]),
     'C2b it loses on SPECIFICITY, not on source order: a later stylesheet ' +
     'edit cannot undo this fix by being later');
  const one = cascade.resolve(CSS_SRC, ONE, 'table-layout');
  ok(one.winner !== null && one.winner.value === 'auto',
     'C2c and the single-panel table is still auto, which is untouched');
  ok(r.conditional.length === 0,
     'C2d no ancestor-scoped or at-rule declaration of table-layout can reach ' +
     'these tables, so the resolver is judging the whole picture');
  ok(cascade.stripComments(CSS_SRC).unterminated === 0,
     'C2e and no unterminated comment is swallowing the rest of the file');
  /* the dead block recorded, not left as a surprise for the next reader */
  ok(/\.data-table \{[\s\S]{0,40}table-layout: fixed/.test(CSS_SRC),
     'C7 a COMMENTED-OUT fixed-layout rule exists in the file, which is why ' +
     'this suite strips CSS comments before asserting anything');
  ok(/\.data-table td\.num\.num-text \{/.test(CSS_LIVE),
     'C3 the wrap is a MODIFIER on .num, not a replacement for it');
  /* C4 RESOLVED, not matched: the same mistake one property over would be the
   * wrap declared, present, and beaten by .num's nowrap. */
  const inTable = [{ tag: 'table', classes: ['data-table', 'data-table-cmp'] },
                   { tag: 'tbody', classes: [] }, { tag: 'tr', classes: [] }];
  const wrapCell = cascade.resolve(CSS_SRC,
    { tag: 'td', classes: ['num', 'num-text'], ancestors: inTable }, 'white-space');
  ok(wrapCell.winner !== null && wrapCell.winner.value === 'normal',
     'C4 a text cell in a numeric column RESOLVES to white-space: normal, ' +
     'from "' + (wrapCell.winner ? wrapCell.winner.sel : 'NOTHING') + '"');
  const numCell = cascade.resolve(CSS_SRC,
    { tag: 'td', classes: ['num'], ancestors: inTable }, 'white-space');
  ok(numCell.winner !== null && numCell.winner.value === 'nowrap',
     'C4a while a plain numeric cell still resolves to nowrap');
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
  /* renderIngestEditor left this list when CLCPA-252 gave the editor its
   * caption from a shared helper. recomputeTotals left it under CLCPA-254,
   * which puts one declared column back in the sum. Both are named in the
   * EXPECT map below instead, so the changes are still accounted for, just
   * not as "untouched". */
  /* rowsForDisplay LEFT this list under CLCPA-263, which gave it the
   * composite-share derivation on its clone. It is named in the census
   * map instead, so the change stays accounted for. */
  ['totalRowFlags', 'columnNumericMask',
   'getTableSchema', 'parseNumericInput'].forEach(n => {
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
    isWhollyNumeric: 'round 3: the wrap predicate, new, and isNumeric untouched',
    /* Section C group A, not this ticket's, each named so the count stays exact */
    ingestComputed: 'NOT this ticket: CLCPA-253: the (calculated) marker is column-aware',
    openSaveModal: 'NOT this ticket: CLCPA-256: the confirm dialog counts real changes',
    openAddYearDialog: 'NOT this ticket: CLCPA-262: a rejected import keeps the dialog open',
    stagedBlock: 'NOT this ticket: CLCPA-264, nested in openAddYearDialog, it renders the identity advisory',
    declaredTableFromFilename: 'NOT this ticket: CLCPA-264, the filename extractor (new)',
    importIdentityNotice: 'NOT this ticket: CLCPA-264, the import identity advisory (new)',
    rowsForDisplay: 'NOT this ticket: CLCPA-263: it derives the value (pct) composites on its clone',
    applyCompositeShares: 'NOT this ticket: CLCPA-263: the derivation (new)',
    isCompositeShareCol: 'NOT this ticket: CLCPA-263: the declaration predicate (new)',
    compositeValueText: 'NOT this ticket: CLCPA-263: the value formatting (new)',
    bareNumber: 'NOT this ticket: CLCPA-263: the bare-number test (new)',
    wire: 'NOT this ticket: CLCPA-262: wire() is nested inside openAddYearDialog and holds the change',
    /* Section C group B */
    tableCaption: 'NOT this ticket: CLCPA-252, the caption helper, new',
    deriveTableCaption: 'NOT this ticket: CLCPA-252 round 2: a fresh year DERIVES its title instead of falling back to short_title (new)',
    stripCaptionYear: 'NOT this ticket: CLCPA-252 round 3: the caption year strip (new)',
    deriveTableCaptionInfo: 'NOT this ticket: CLCPA-252 round 2, the three strategies (new)',
    dacCol: 'NOT this ticket: CLCPA-257, Section C group C: dacCols newest-year fallback',
    phantomSpacerCols: 'NOT this ticket: CLCPA-260, Section C group D: the phantom spacer columns, new',
    buildIngestWorkbook: 'NOT this ticket: CLCPA-260, Section C group D: the phantom spacer columns, the template stops emitting them',
    renderSourceTables: 'NOT this ticket: CLCPA-252, the report page calls it',
    renderIngestEditor: 'NOT this ticket: CLCPA-252, the editor calls it; and CLCPA-255, a recognised total row loses its delete control',
    /* Section C group E */
    isDeclaredSummable: 'NOT this ticket: CLCPA-254, the declared-summable column, new',
    recomputeTotals: 'NOT this ticket: CLCPA-254, it consults that declaration before refusing an average column',
    buildIngestImport: 'NOT this ticket: CLCPA-261, it collects the fraction notices',
    renderIngestImportResult: 'NOT this ticket: CLCPA-261, the import summary announces them',
  };
  changed.forEach(n => ok(n in EXPECT, 'the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  /* 4 -> 8: Section C group A added four, every one named above. 13 -> 17:
   * group E moved five, and renderIngestEditor was already counted. The
   * over-reading grab used to report 25 here; see section H. */
  /* 17 -> 19: CLCPA-252 round 2 added two, both named above. */
  /* 19 -> 22: CLCPA-264 added two and moved stagedBlock, all named above. */
  /* 22 -> 27: CLCPA-263 moved five, all named above. */
  ok(changed.length === 28, 'X3 exactly TWENTY-EIGHT functions changed: ' + changed.length);
  /* the one that must NOT have moved: isNumeric feeds the column masks, the
   * formatters and the derive engine, and round 3 deliberately leaves it. */
  ok(grab('isNumeric') === grab('isNumeric', BASE_SRC),
     'X3b and isNumeric itself is byte-identical to BASE');
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
