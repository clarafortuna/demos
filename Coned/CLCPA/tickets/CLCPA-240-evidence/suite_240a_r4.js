/* CLCPA-240 first half, ROUND 4: the label has a veto in the four tables.
 *
 * Emely's pass on 92b1a65b17 typed 999 into every row of A5:2099. Six DATA
 * rows then equalled the sum of what preceded them, were flagged as totals,
 * became segment boundaries, and every group total after them was summed over
 * the wrong rows -- 14,985 where the group holds 1,998.
 *
 * THE GUARD THIS SUITE EXISTS FOR, and the reason three rounds passed that
 * screen: every earlier assertion about a total was either a PRESENCE check
 * ("it holds a number") or an ENGINE-TO-ENGINE comparison (the import against
 * recomputeTotals of the stored rows). Neither can see the engine being wrong
 * the same way on both sides. So this suite computes the expected totals
 * INDEPENDENTLY, from the row structure alone, with no call into the derive
 * engine -- and asserts them on BOTH a uniform draft and a real one, because
 * uniform figures are what an arithmetic-confirmation design cannot survive
 * and real ones are what it was always tested with.
 *
 * WHAT THIS ROUND IS NOT. The general correction to confirms(), for all 52
 * tables, stays its own ticket. A label veto is defensible only where the
 * labels are known reliable, and the other 48 carry 111 rows that say "total"
 * without being one.
 *
 * BASE is c2a34ee, the round-3 build Emely tested.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-240-evidence/suite-240a-r4-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || 'c2a34ee';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);

const SRC = fs.readFileSync(APP, 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));
const BS = String.fromCharCode(92);

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

function grab(name, src) {
  src = src || SRC;
  for (const p of ['  ', '    ', '']) for (const k of ['function ', 'async function ']) {
    const head = '\r\n' + p + k + name + '(';
    const i = src.indexOf(head); if (i < 0) continue;
    const close = '\r\n' + p + '}';
    const j = src.indexOf(close, i + head.length);
    if (j <= i) continue;
    return src.slice(i + 2, j + close.length);
  }
  return null;
}
function grabConst(name, src) {
  src = src || SRC;
  const m = src.match(new RegExp('\\r\\n  (?:const|var|let) ' + name + '\\s*='));
  if (!m) return null;
  const start = src.indexOf(m[0]) + 2;
  let d = 0, q = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i], p = src[i - 1];
    if (q) { if (c === q && p !== BS) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i); if (e < 0) return null; i = e + 1; continue; }
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\r\n', i); if (e < 0) return null; i = e; continue; }
    if (c === '(' || c === '{' || c === '[') d++;
    else if (c === ')' || c === '}' || c === ']') d--;
    else if (c === ';' && d === 0) return src.slice(start, i + 1);
  }
  return null;
}
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

function build(src, tag) {
  const fns = ['recomputeTotals', 'totalRowFlags', 'getTableSchema', 'getTableBody',
    'ingestComputed', 'buildIngestImport', 'normIngestKey', 'ingestIsHeaderRow',
    'isHierarchicalTotalLabel'];
  const cs = [];
  for (let it = 0; it < 400; it++) {
    const body = '"use strict";\n' +
      'const state = { payload: P };\n' +
      'const console = { warn: () => {}, info: () => {}, log: () => {}, error: () => {} };\n' +
      cs.map(n => grabConst(n, src)).join('\n') + '\n' +
      fns.map(n => grab(n, src)).filter(Boolean).join('\n') + '\n' +
      'return {' + fns.filter(n => grab(n, src)).join(',') + '};';
    let api;
    try { api = new Function('P', body)(P); }
    catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) throw new Error(tag + ' shell: ' + e.message);
      if (grab(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm, src) && cs.indexOf(nm) < 0) { cs.push(nm); continue; }
      throw new Error(tag + ' cannot resolve ' + nm);
    }
    try {
      const s25 = P.tables.A5.schema_by_year['2025'];
      const d = P.tables.A5.data['2025'].map(r => r.slice());
      api.recomputeTotals(d, s25, 'A5', []);
      api.totalRowFlags(d, 'A5', s25);
      /* DRIVE THE SHAPES THE GUARDS USE, not just the stored one. A draft with
       * every value blanked, and a uniform one, reach paths the published data
       * never does -- and a mutation that changes which rows are totals reaches
       * more still. Without this the resolver stops early and a control comes
       * back as "withinSourceRounding is not defined" instead of as the
       * assertion it was aimed at. */
      const blank = P.tables.A5.data['2025'].map(r => [r[0], null, null, null]);
      api.recomputeTotals(blank, s25, 'A5', []);
      const uni = P.tables.A5.data['2025'].map(r => [r[0], 999, 333, null]);
      api.recomputeTotals(uni, s25, 'A5', P.tables.A5.data['2025'].map(r => r.slice()));
      api.totalRowFlags(uni, 'A5', s25);
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

let NEW = null, OLD = null;
guard('both sources assemble and run', () => {
  NEW = build(SRC, 'NEW');
  OLD = build(BASE_SRC, 'BASE');
  ok(!!NEW && !!OLD, 'the changed source and BASE (' + BASE + ') both assemble and run');
});
if (!NEW || !OLD) {
  lines.forEach(l => console.log(l));
  console.log('\n  ' + pass + ' passed, ' + fail + ' failed  (assembly failed)');
  process.exit(1);
}

const isEmptyV = v => v === null || v === undefined || String(v).trim() === '';
const hdrLike = r => Array.isArray(r) && r.length > 1 && !isEmptyV(r[0]) &&
  r.slice(1).every(isEmptyV);
const totalish = l => /total|subtotal/i.test(String(l == null ? '' : l));
const num = v => (typeof v === 'number' && isFinite(v)) ? v : 0;

/* ===================== THE INDEPENDENT ORACLE ==========================
 *
 * Computed from the row LABELS and the header structure alone. It calls
 * nothing in app.js -- not totalRowFlags, not recomputeTotals, not a derive
 * helper. That is the whole point: every earlier assertion about a total went
 * through the engine on both sides and could not see the engine being wrong.
 *
 * The rule it encodes is the one recomputeTotals documents for itself: a total
 * row sums the data rows of its own segment, and a total row whose segment is
 * EMPTY -- a grand total sitting directly after another total -- sums the
 * whole table. Written here from that description, not from the code. */
function expectedTotals(rows, col) {
  const isTot = rows.map(r => totalish((r || [])[0]));
  /* A DATA ROW IS ONE THAT IS NEITHER A CAPTION NOR A TOTAL.
   *
   * My first version of this oracle split rows by emptiness alone and was
   * wrong for exactly the reason this ticket keeps circling: in a post-import
   * draft the totals are empty too, so they are shape-identical to headers.
   * It handed the whole-table sum to all ten totals.
   *
   * The second version carried a `starts` array of headers that, once the
   * segments were measured from the previous TOTAL rather than the previous
   * header, changed no answer at all -- a mutation reverting it stayed green.
   * Gone, rather than left as structure that cannot matter. */
  const isData = rows.map((r, i) => !hdrLike(r) && !isTot[i]);
  const wholeTable = rows.reduce((a, r, i) => a + (isData[i] ? num(r[col]) : 0), 0);
  /* A SEGMENT RUNS FROM THE PREVIOUS TOTAL ROW, NOT FROM THE HEADER.
   *
   * Written from what recomputeTotals states about itself: "each total row
   * sums ONLY ITS OWN SEGMENT: the non-total rows between it and the previous
   * total row", and "an EMPTY segment keeps the whole-table sum, which is what
   * makes a grand total sitting directly after the last segment total come out
   * right". My first version measured from the header instead and handed r49,
   * the grand total, its last group's 999 rather than the table's 30,969 --
   * wrong about the design, not about the code. */
  const want = {};
  let prevTotal = -1;
  for (let i = 0; i < rows.length; i++) {
    if (!isTot[i]) continue;
    let segSum = 0, segCount = 0;
    for (let k = prevTotal + 1; k < i; k++) {
      if (isData[k]) { segSum += num(rows[k][col]); segCount++; }
    }
    want[i] = segCount ? segSum : wholeTable;
    prevTotal = i;
  }
  return want;
}

const stored25 = P.tables.A5.data['2025'];
const schema99 = NEW.getTableSchema(P.tables.A5, '2099');

/* the post-import draft: labels kept, headers empty, totals empty, data typed */
function draftOf(mode, val) {
  return stored25.map(r => {
    if (hdrLike(r)) return [r[0], null, null, null];
    if (totalish(r[0])) return [r[0], null, null, null];
    return mode === 'uniform' ? [r[0], val, Math.round(val / 3), null] : r.slice();
  });
}

/* ===================== V: totals against independent arithmetic ========= */
say('');
say('=== V. the guard that was missing: totals vs arithmetic this suite does ==');
[['uniform', 999], ['real', 0]].forEach(([mode, val]) => {
  guard('V: ' + mode + ' figures', () => {
    const rows = draftOf(mode, val);
    const want = expectedTotals(rows, 1);
    NEW.recomputeTotals(rows, schema99, 'A5', []);
    const idx = Object.keys(want).map(Number).sort((a, b) => a - b);
    const wrong = idx.filter(i => rows[i][1] !== want[i]);
    /* r49 is the payload discrepancy disclosed in PR #220 on REAL figures:
     * the stored grand total is 27,833 where the parts sum to 27,834. On
     * uniform figures there is no stored value involved and it must be exact. */
    const EXPECTED_OFF = (mode === 'real') ? [49] : [];
    const unexpected = wrong.filter(i => EXPECTED_OFF.indexOf(i) < 0);
    ok(idx.length === 10,
       'V1 ' + mode + ': ten total rows to check: ' + idx.length);
    ok(unexpected.length === 0,
       'V2 ' + mode + ': every group and grand total equals the sum this suite ' +
       'computed itself' +
       (unexpected.length ? ' -- ' + unexpected.length + ' wrong: ' +
         unexpected.map(i => 'r' + i + ' want ' + want[i] + ' got ' + rows[i][1])
           .slice(0, 4).join(' | ') : ''));
    const flags = NEW.totalRowFlags(rows, 'A5', schema99);
    const bogus = rows.map((r, i) => i)
      .filter(i => flags[i] && !totalish(rows[i][0]) && !hdrLike(stored25[i]));
    ok(bogus.length === 0,
       'V3 ' + mode + ': no DATA row is flagged as a total' +
       (bogus.length ? ': ' + bogus.map(i => String(rows[i][0]).slice(0, 16)).join(', ') : ''));
    const missed = idx.filter(i => !flags[i]);
    ok(missed.length === 0,
       'V4 ' + mode + ': and every real total IS flagged' +
       (missed.length ? ': ' + missed.join(', ') : ''));
  });
});

guard('V: the oracle is independent, and it can fail', () => {
  /* A guard that cannot be made to fail is worse than none, so the oracle is
   * self-tested in both directions before anything is trusted to it. */
  const rows = draftOf('uniform', 999);
  const want = expectedTotals(rows, 1);
  ok(want[27] === 1998,
     'V5 the oracle says Commercial Water Heaters PEI Total is 2 rows x 999 = ' +
     '1998: ' + want[27] + '  (Emely saw 14,985)');
  ok(want[49] === 31 * 999,
     'V6 and the GRAND total sums the whole table, 31 data rows: ' + want[49]);
  const broken = rows.map(r => r.slice());
  broken[25][1] = 1;
  const want2 = expectedTotals(broken, 1);
  ok(want2[27] === 1000,
     'V7 change one data row and the oracle moves with it, so it is really ' +
     'computing rather than asserting a constant: ' + want2[27]);
  /* a CALL, not a mention: the comment above the oracle names recomputeTotals
   * when explaining which rule it encodes, and the first version of this test
   * could not tell prose from a call. */
  ok(!/(totalRowFlags|recomputeTotals|applyDerived\w*)\s*\(/.test(String(expectedTotals)),
     'V8 and it CALLS nothing in app.js: the comparison is not engine-to-engine');

  /* THE ORACLE AGAINST THE PUBLISHED TABLE, where the totals HOLD values.
   *
   * Every draft above blanks them, so a total is excluded from the data rows
   * by its empty shape and the oracle's "not a total" clause never has to do
   * anything -- a mutation dropping it stayed green. Here the totals carry
   * figures, which is the only state where that clause decides, and it also
   * checks the oracle against ConEd's own arithmetic rather than against a
   * draft this suite built. */
  const pub = stored25.map(r => r.slice());
  const wantPub = expectedTotals(pub, 1);
  const idxPub = Object.keys(wantPub).map(Number).sort((a, b) => a - b);
  const offPub = idxPub.filter(i => pub[i][1] !== wantPub[i]);
  ok(idxPub.length === 10, 'V11 ten totals in the published A5:2025: ' + idxPub.length);
  ok(offPub.length === 1 && offPub[0] === 49,
     'V12 and the oracle reproduces nine of them from the published figures, ' +
     'differing only at r49: ' + JSON.stringify(offPub.map(i => 'r' + i)));
  /* THE NUMBERS, not just the index. "r49 differs" is satisfied by any wrong
   * answer, which is how a mutation counting total rows as data stayed green:
   * it inflated the whole-table sum that r49 falls back on, and r49 was
   * already licensed to differ. */
  ok(wantPub[49] === 27834 && pub[49][1] === 27833,
     'V13 and the difference is exactly the disclosed one: the parts sum to ' +
     wantPub[49] + ' where the payload stores ' + pub[49][1]);
});

guard('V: both inputs were actually exercised', () => {
  /* A MISSING TEST IS NOT A FAILURE, which is why this exists. Dropping the
   * uniform case simply stops four assertions from running, and a suite that
   * only counts what it ran cannot notice. Every earlier round tested real
   * figures alone; that is the whole reason this screen shipped three times. */
  const ran = { uniform: 0, real: 0 };
  lines.forEach(l => {
    if (/^  (ok|FAIL) +V\d/.test(l)) {
      if (l.indexOf('uniform:') >= 0) ran.uniform++;
      if (l.indexOf('real:') >= 0) ran.real++;
    }
  });
  ok(ran.uniform >= 4,
     'V9 the UNIFORM input really ran: ' + ran.uniform + ' assertions');
  ok(ran.real >= 4,
     'V10 and so did the REAL input: ' + ran.real + ' assertions');
});

/* ===================== B: what BASE did on the same screen ============== */
say('');
say('=== B. the screen Emely tested, on the build she tested ================');
guard('B: BASE gets the uniform screen wrong', () => {
  const rows = draftOf('uniform', 999);
  const want = expectedTotals(rows, 1);
  OLD.recomputeTotals(rows, schema99, 'A5', []);
  const idx = Object.keys(want).map(Number);
  const wrong = idx.filter(i => rows[i][1] !== want[i]);
  ok(wrong.length === 7,
     'B1 on BASE seven of the ten totals are wrong: ' + wrong.length);
  ok(rows[27] && rows[27][1] === 14985,
     'B2 including Commercial Water Heaters PEI Total at 14,985, which is ' +
     'the number in the screenshot: ' + (rows[27] || [])[1]);
  ok(rows[31] && rows[31][1] === 15984 && rows[35] && rows[35][1] === 16983,
     'B3 and Instant Lighting 15,984 and Midstream 16,983');
  const flags = OLD.totalRowFlags(rows, 'A5', schema99);
  const bogus = rows.map((r, i) => i)
    .filter(i => flags[i] && !totalish(rows[i][0]) && !hdrLike(stored25[i]));
  ok(bogus.length === 6,
     'B4 six data rows flagged as totals on BASE: ' + bogus.length +
     '  ' + JSON.stringify(bogus.map(i => String(rows[i][0]).slice(0, 16))));
});

guard('B: and BASE was RIGHT on real figures, which is why it shipped', () => {
  const rows = draftOf('real', 0);
  const want = expectedTotals(rows, 1);
  OLD.recomputeTotals(rows, schema99, 'A5', []);
  const wrong = Object.keys(want).map(Number).filter(i => rows[i][1] !== want[i]);
  /* Corrected: with the oracle measuring segments from the previous total,
   * BASE gets ALL TEN right on real figures. The 27,833 discrepancy lives in
   * the STORED payload and never reaches a fresh import, where the grand total
   * is computed rather than kept. */
  ok(wrong.length === 0,
     'B5 on real figures BASE gets all ten right, which is why it shipped: ' +
     wrong.length + ' wrong');
  /* THE CLAIM THIS ROUND RESTS ON, stated as a comparison rather than as a
   * sentence: BASE is right on one input and wrong on the other, and the
   * changed build is right on both. */
  const uni = draftOf('uniform', 999);
  const wantU = expectedTotals(uni, 1);
  NEW.recomputeTotals(uni, schema99, 'A5', []);
  const rl = draftOf('real', 0);
  const wantR = expectedTotals(rl, 1);
  NEW.recomputeTotals(rl, schema99, 'A5', []);
  const wrongU = Object.keys(wantU).map(Number).filter(i => uni[i][1] !== wantU[i]);
  const wrongR = Object.keys(wantR).map(Number).filter(i => rl[i][1] !== wantR[i]);
  ok(wrongU.length === 0 && wrongR.length <= 1,
     'B6 the changed build is right on BOTH inputs: uniform ' + wrongU.length +
     ' wrong, real ' + wrongR.length + ' wrong' +
     (wrongR.length ? ' (' + wrongR.map(i => 'r' + i).join(',') +
       ', the payload discrepancy)' : ''));
});

/* ===================== N: the veto is a no-op on stored data =========== */
say('');
say('=== N. measurably free: no stored table-year changes a flag ===========');
guard('N: every stored table-year is identical to BASE', () => {
  let diff = [], years = 0, fam = 0;
  Object.keys(P.tables).sort().forEach(id => {
    Object.keys(P.tables[id].data || {}).sort().forEach(y => {
      const rows = (P.tables[id].data[y] || []).filter(Array.isArray);
      if (!rows.length) return;
      years++;
      const sc = (P.tables[id].schema_by_year || {})[y] || [];
      if (JSON.stringify(NEW.totalRowFlags(rows, id, sc)) !==
          JSON.stringify(OLD.totalRowFlags(rows, id, sc))) diff.push(id + ':' + y);
    });
  });
  ['A5', 'A6', 'A7', 'A8'].forEach(id => {
    Object.keys(P.tables[id].data || {}).forEach(y => {
      if ((P.tables[id].data[y] || []).length) fam++;
    });
  });
  ok(years > 140, 'N1 checked ' + years + ' stored table-years');
  ok(fam === 11, 'N2 of which ' + fam + ' are in the family');
  ok(diff.length === 0,
     'N3 not one changes a flag' + (diff.length ? ': ' + diff.slice(0, 5).join(', ') : ''));
});

guard('N: the veto could not have removed a real total', () => {
  let tot = 0, hdr = 0, vetoed = [];
  ['A5', 'A6', 'A7', 'A8'].forEach(id => {
    Object.keys(P.tables[id].data || {}).sort().forEach(y => {
      const rows = P.tables[id].data[y] || [];
      const sc = (P.tables[id].schema_by_year || {})[y] || [];
      const f = NEW.totalRowFlags(rows, id, sc);
      rows.forEach((r, i) => {
        if (hdrLike(r)) hdr++;
        if (totalish(r[0]) && !hdrLike(r)) tot++;
        if (f[i] && !totalish(r[0])) vetoed.push(id + ':' + y + ' r' + i);
      });
    });
  });
  ok(tot === 79, 'N4 the family holds 79 total rows: ' + tot);
  ok(hdr === 67, 'N5 and 67 group headers: ' + hdr);
  ok(vetoed.length === 0,
     'N6 and nothing flagged in stored data lacks the word, so the veto is a ' +
     'complete no-op there' + (vetoed.length ? ': ' + vetoed.slice(0, 4).join(', ') : ''));
});

/* ===================== O: the other 48 tables are untouched ============ */
say('');
say('=== O. the general confirms() correction stays OUT ====================');
guard('O: no flat table is vetoed', () => {
  const fam = { A5: 1, A6: 1, A7: 1, A8: 1 };
  let risky = 0, changed = [];
  Object.keys(P.tables).sort().forEach(id => {
    if (fam[id]) return;
    Object.keys(P.tables[id].data || {}).sort().forEach(y => {
      const rows = (P.tables[id].data[y] || []).filter(Array.isArray);
      if (!rows.length) return;
      const sc = (P.tables[id].schema_by_year || {})[y] || [];
      const a = NEW.totalRowFlags(rows, id, sc);
      const b = OLD.totalRowFlags(rows, id, sc);
      if (JSON.stringify(a) !== JSON.stringify(b)) changed.push(id + ':' + y);
      /* the rows a GENERALISED label rule would get wrong: their label says
       * total and they are correctly NOT flagged */
      rows.forEach((r, i) => { if (!a[i] && totalish(r[0])) risky++; });
    });
  });
  ok(changed.length === 0,
     'O1 not one of the 48 flat tables changes a flag' +
     (changed.length ? ': ' + changed.slice(0, 4).join(', ') : ''));
  /* My first version asserted the reverse and measured zero: on STORED data
   * the flat tables flag nothing whose label lacks the word, so a veto would
   * be a no-op there too. That is not the reason for scoping. The reason is
   * the other direction -- generalising the LABEL as evidence would wrongly
   * promote rows like D2's "Total # of projects", which is CLCPA-209. */
  ok(risky === 94,
     'O2 the 48 flat tables hold ' + risky + ' rows whose label says total and ' +
     'which are correctly NOT flagged -- so the label is evidence HERE and ' +
     'would be a defect if generalised, which is why the veto is scoped');
  /* the sparse case in a flat table is unchanged too */
  const a1 = P.tables.A1.data['2025'];
  const s1 = P.tables.A1.schema_by_year['2025'];
  const sparse = a1.map(r => [r[0], null, null, null]);
  for (let i = 0; i < 3 && i < sparse.length; i++) sparse[i][1] = 999;
  const fa = NEW.totalRowFlags(sparse, 'A1', s1);
  const fb = OLD.totalRowFlags(sparse, 'A1', s1);
  ok(JSON.stringify(fa) === JSON.stringify(fb),
     'O3 and a sparse FLAT draft flags identically to BASE');

  /* THE STATE WHERE SCOPE ACTUALLY BITES. On stored data a veto outside the
   * family would be a no-op -- nothing there is flagged without the word -- so
   * O1 alone cannot see the scope being lost. A simulated FRESH IMPORT can:
   * that is where the bootstrap reaches label-bearing rows, and where D2's
   * "Total # of projects" is one wrong rule away from CLCPA-209. */
  let freshDiff = [], reached = 0;
  Object.keys(P.tables).sort().forEach(id => {
    if (fam[id]) return;
    Object.keys(P.tables[id].data || {}).sort().forEach(y => {
      const rows = (P.tables[id].data[y] || []).filter(Array.isArray);
      if (!rows.length) return;
      const sc = (P.tables[id].schema_by_year || {})[y] || [];
      const blank = rows.map(r => { const c = r.slice();
        for (let k = 1; k < c.length; k++) c[k] = null; return c; });
      const a = NEW.totalRowFlags(blank, id, sc);
      const b = OLD.totalRowFlags(blank, id, sc);
      if (JSON.stringify(a) !== JSON.stringify(b)) freshDiff.push(id + ':' + y);
      rows.forEach((r, i) => { if (totalish(r[0])) reached++; });
    });
  });
  ok(reached > 100,
     'O4 the 48 flat tables carry ' + reached + ' total-labelled rows that a ' +
     'fresh import puts within reach of a label rule');
  ok(freshDiff.length === 0,
     'O5 and on a simulated fresh import not one of them flags differently ' +
     'from BASE' + (freshDiff.length ? ': ' + freshDiff.slice(0, 5).join(', ') : ''));
});

/* ===================== S: the shape of the change ===================== */
say('');
say('=== S. structure ======================================================');
guard('S: the veto is scoped and singular', () => {
  const tf = codeOnly(grab('totalRowFlags', SRC) || '');
  ok(/if \(!out\[i\]\) continue;\s*\r?\n\s*if \(!isHierarchicalTotalLabel\(\(rows\[i\] \|\| \[\]\)\[0\]\)\) out\[i\] = false;/.test(tf),
     'S1 the veto clears a flag whose label does not say total');
  /* INSIDE the branch, proved by brace matching rather than by "appears after",
   * which a veto moved below the closing brace would also satisfy. */
  const bi = tf.indexOf('HIERARCHICAL_TABLES[tableId]');
  let depth = 0, end = -1;
  for (let i = tf.indexOf('{', bi); i < tf.length && i >= 0; i++) {
    if (tf[i] === '{') depth++;
    else if (tf[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  ok(bi >= 0 && end > bi,
     'S2 the declared-family branch is locatable: chars ' + bi + '..' + end);
  ok(end > bi && tf.slice(bi, end).indexOf('out[i] = false') >= 0,
     'S2b and the veto sits INSIDE it, so the other 48 tables cannot reach it');
  ok((tf.split('out[i] = false').length - 1) === 1,
     'S3 exactly one veto: ' + (tf.split('out[i] = false').length - 1));
  ok(grab('confirms', SRC) === grab('confirms', BASE_SRC) ||
     grab('confirms', SRC) === null,
     'S4 confirms() itself is byte-identical to BASE: the general correction ' +
     'is not in this round');
  const css = fs.readFileSync(path.join(REPO,
    'Coned/CLCPA/ExecutiveDashboard_dev/styles.css'), 'utf8');
  const baseCss = execSync('git show ' + BASE +
    ':"Coned/CLCPA/ExecutiveDashboard_dev/styles.css"',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
  ok(css === baseCss, 'S5 styles.css is byte-identical to BASE');
  const ed = grab('renderIngestEditor', SRC);
  ok(ed === grab('renderIngestEditor', BASE_SRC),
     'S6 and renderIngestEditor is untouched: round 3s lock is unchanged');
  const declared = (fs.readFileSync(__filename, 'utf8')
    .match(/DAC_BASE_COMMIT \|\| '([^']*)'/) || [])[1];
  ok(/^[0-9a-f]{7,40}$/.test(String(declared)),
     'S7 the baseline is a literal commit sha: ' + JSON.stringify(declared));
});

/* ---------- report ------------------------------------------------------ */
console.log('======================================================================');
console.log('CLCPA-240 first half, ROUND 4 -- the label has a veto in four tables');
console.log('  app.js : ' + APP);
console.log('  BASE   : ' + BASE + '  (the round-3 build Emely tested)');
console.log('======================================================================');
lines.forEach(l => console.log(l));
console.log('');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
try {
  fs.writeFileSync(OUT, [
    '======================================================================',
    'CLCPA-240 first half, ROUND 4 -- the label has a veto in four tables',
    '  BASE   : ' + BASE + '  (the round-3 build Emely tested)',
    '======================================================================',
  ].concat(lines).concat(['', '  ' + pass + ' passed, ' + fail + ' failed']).join('\n') + '\n');
} catch (e) { /* stdout is the record */ }
process.exitCode = fail ? 1 : 0;
