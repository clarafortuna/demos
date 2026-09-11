/* CLCPA-244 ROUND 2: unit discipline at entry, and shrink-to-fit gauges.
 *
 * Emely's hosted pass on 19987bbd95 passed items 1-4 and surfaced two things.
 *
 * THE FIRST COLLAPSED UNDER THE PROBE. The section-E header read 2625.0% on
 * 2099, and I first reported a second x100 somewhere in the KPI path. The
 * probe proved the opposite: driving the SHIPPED strategic_capital rule, a
 * fraction-stored year yields 31.7% and a points-stored year 3170.4%, so the
 * one x100 at line 10814 is correct and the reading was STALE -- rendered
 * before Emely's Save. Her hard refresh then read 22.5%, the weighted value of
 * the table. There is no defect in that path and none is "fixed" here.
 *
 * WHAT THE PROBE DID FIND, and what this round ships:
 *
 *   1. parseNumericInput strips $ and commas but NOT %. "10%" fails Number(),
 *      falls through to `return trimmed`, and a STRING lands in a numeric
 *      cell. Measured: E1's weighted Grand Total goes null, the KPI goes null,
 *      the header dashes. Reachable in that column for the first time in round
 *      1, which made those cells typeable, and both the editor inputs and the
 *      importer parse through this one function.
 *
 *   2. The section-E arc strip hardcoded R_OUT = 82 and clamped GAP at 8, so
 *      four gauges needed a 768px canvas. Narrower, and the fourth was drawn
 *      past the bitmap edge and vanished. It also never redrew on resize.
 *
 * THE LIMIT ON PART 2, RECORDED RATHER THAN GLOSSED: these are GEOMETRY
 * assertions, not RENDERING assertions. A canvas cannot be read from node, so
 * what is proven here is that every computed centre and radius falls inside
 * the bitmap across a width sweep -- which is exactly the property that broke.
 * It is NOT proof that the strip looks right. Emely's eye stays the acceptance,
 * and calling a geometry check a rendering check is the mistake this project
 * has already made once with CSS.
 *
 * BASE is dc47788, the build Emely tested, so every claim is a difference
 * against the thing that was actually passed.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-244-evidence/suite-244-r2-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || 'dc47788';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);

/* BOTH SIDES PINNED, as suite_193_199 and suite_237 already are.
 *
 * Round 3 replaced this round's width-only scale with a two-dimensional
 * search, so a suite whose post-change side read the working tree would keep
 * re-judging every later round against a layout that no longer exists -- and
 * it did: eleven guards went red on a build that is strictly better. The
 * readability guard added in this very round is what caught it rather than
 * letting the sweeps go quietly vacuous.
 *
 * This suite is ROUND 2'S EVIDENCE, so its subject is round 2's build.
 * Round 3's geometry is covered by suite_244_r3, whose guards are strictly
 * stronger: they sweep height as well as width and run the SHIPPED search
 * rather than a model of it. DAC_APP_OVERRIDE still wins, so the mutation
 * controls keep working.
 */
const NEW_COMMIT = process.env.DAC_244R2_COMMIT || 'b256467';
const SRC = process.env.DAC_APP_OVERRIDE
  ? fs.readFileSync(APP, 'utf8')
  : execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
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

/* A REAL extractor, because grab() lies on this file.
 *
 * grab() ends a function at the first dedented "}". That works for the
 * IIFE-nested functions it was written for, and OVER-READS catastrophically
 * for the ones declared at column 0: in BASE it returned 559,434 characters
 * for renderSectionC -- half the file -- so "did this function change" was
 * comparing giant overlapping regions and answered yes for twenty functions
 * that were never touched. Adding one column-0 function shortened the
 * over-read and the noise appeared.
 *
 * That is the ninth pin in this project to read something other than what it
 * claimed. This one counts braces, skipping strings, template literals,
 * regex literals and comments, so the slice really is the function. */
function grabFn(name, src) {
  src = src || SRC;
  const re = new RegExp('(?:^|\\r\\n)([ \\t]*)(?:async )?function ' + name + '\\s*\\(');
  const m = re.exec(src);
  if (!m) return null;
  const start = src.indexOf(m[0]) + (m[0].startsWith('\r\n') ? 2 : 0);
  let i = src.indexOf('{', start);
  if (i < 0) return null;
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i], n2 = src[i + 1];
    if (c === '/' && n2 === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 1; continue; }
    if (c === '/' && n2 === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      for (i++; i < src.length; i++) {
        if (src[i] === BS) { i++; continue; }
        if (src[i] === q) break;
      }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}

/* ---- ONE scope per source, resolved by following ReferenceErrors ---------
 *
 * The seed is a seed. It also DRIVES the functions inside the resolution loop,
 * because rowsForDisplay reaches totalRowFlags only at CALL time -- a slice
 * that merely assembles proves nothing, which cost this ticket a probe round
 * already. */
function build(src, tag) {
  const fns = ['parseNumericInput', 'rowsForDisplay', 'kpiDacPct', 'dacPct',
    'dacCell', 'buildIngestImport', 'getTableSchema', 'totalRowFlags'];
  const cs = ['DAC_KPI_REPORTED'];
  for (let it = 0; it < 600; it++) {
    const body = '"use strict";\n' +
      'const console = { warn(){}, info(){}, log(){}, error(){} };\n' +
      'const document = { getElementById: () => null, querySelectorAll: () => [] };\n' +
      'const localStorage = { getItem: () => null, setItem(){} };\n' +
      cs.map(n => grabConst(n, src)).filter(Boolean).join('\n') + '\n' +
      fns.map(n => grab(n, src)).filter(Boolean).join('\n') + '\n' +
      'return {' + fns.filter(n => grab(n, src)).join(',') +
      (grabConst('DAC_KPI_REPORTED', src) ? ',DAC_KPI_REPORTED' : '') + '};';
    let api;
    try { api = new Function('state', body)({ payload: P }); }
    catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) throw new Error(tag + ' shell: ' + e.message);
      if (grab(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm, src) && cs.indexOf(nm) < 0) { cs.push(nm); continue; }
      throw new Error(tag + ' cannot resolve ' + nm);
    }
    try {
      const sc = P.tables.E1.schema_by_year['2025'];
      const disp = api.rowsForDisplay(P.tables.E1.data['2025'].map(r => r.slice()), sc, 'E1');
      api.DAC_KPI_REPORTED.strategic_capital(
        { E1: { data: { Y: disp }, schema_by_year: { Y: sc } } }, 'Y');
      api.parseNumericInput('1');
      /* a second table so the resolver sees the grouped/derived paths too */
      api.rowsForDisplay(P.tables.A5.data['2025'].map(r => r.slice()),
                         P.tables.A5.schema_by_year['2025'], 'A5');
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
say('CLCPA-244 ROUND 2 -- unit discipline at entry, shrink-to-fit gauges');
say('  BASE ' + BASE + ' (the build Emely passed items 1-4 on)');
say('======================================================================');

let NEW = null, OLD = null;
guard('both sources assemble and RUN', () => {
  NEW = build(SRC, 'NEW');
  OLD = build(BASE_SRC, 'BASE');
  ok(!!NEW && !!OLD, 'the changed source and BASE both assemble and run');
});
if (!NEW || !OLD) {
  lines.forEach(l => console.log(l));
  console.log('\n  ' + pass + ' passed, ' + fail + ' failed  (assembly failed)');
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(1);
}

/* =================== U: the convention, stated and proved ============== */
say('');
say('=== U. parseNumericInput: an explicit % is a UNIT ====================');
guard('U: the three cases Emely asked to have stated', () => {
  ok(NEW.parseNumericInput('10%') === 0.1,
     'U1 "10%" lands 0.1, the fraction every stored year uses: ' +
     JSON.stringify(NEW.parseNumericInput('10%')));
  ok(NEW.parseNumericInput('0.1') === 0.1,
     'U2 "0.1" lands 0.1, unchanged');
  ok(NEW.parseNumericInput('10') === 10,
     'U3 "10" lands 10, unchanged: a BARE number is never reinterpreted');
  /* the whole point of U3: no magnitude guessing is introduced */
  ok(NEW.parseNumericInput('0.5') === 0.5 && NEW.parseNumericInput('50') === 50,
     'U4 and the 0.5 / 50 ambiguity is left exactly as it was, not guessed at');
});

guard('U: BASE really did break on the percent sign', () => {
  const b = OLD.parseNumericInput('10%');
  ok(typeof b === 'string' && b === '10%',
     'U5 at BASE "10%" returned the STRING "10%": ' + JSON.stringify(b));
  ok(typeof NEW.parseNumericInput('10%') === 'number',
     'U6 and now returns a number, which is the whole defect');
});

guard('U: the edges, so the rule cannot be sloppy', () => {
  const cases = [
    ['35%', 0.35], ['  35 % ', 0.35], ['-10%', -0.1], ['+10%', 0.1],
    ['.5%', 0.005], ['100%', 1], ['0%', 0],
    ['$1,234', 1234], ['1,234', 1234], ['', null],
  ];
  cases.forEach(([inp, want]) => {
    const got = NEW.parseNumericInput(inp);
    ok(got === want, 'U7 ' + JSON.stringify(inp) + ' -> ' + JSON.stringify(got) +
       ' (want ' + JSON.stringify(want) + ')');
  });
  /* text must STILL fall through as text: a stray % inside prose is not a
   * number, and turning it into one would be worse than the defect */
  [['n/a', 'n/a'], ['up 10% YoY', 'up 10% YoY'], ['%', '%'], ['10%%', '10%%']]
    .forEach(([inp, want]) => {
      const got = NEW.parseNumericInput(inp);
      ok(got === want, 'U8 ' + JSON.stringify(inp) + ' still falls through as text: ' +
         JSON.stringify(got));
    });
});

/* =================== E: the defect, end to end ========================== */
say('');
say('=== E. the E1 chain that the string used to empty ====================');
function e1Chain(api, cells) {
  const W = [69138825, 385046065, 17636777, 717162322];
  const NAMES = ['Environmental', 'Risk Reduction', 'Safety and Security', 'System Expansion'];
  const sc = P.tables.E1.schema_by_year['2025'];
  const rows = NAMES.map((n, i) => [n, W[i], api.parseNumericInput(cells[i])]);
  rows.push(['Grand Total', W.reduce((a, b) => a + b, 0), null]);
  const disp = api.rowsForDisplay(rows.map(r => r.slice()), sc, 'E1');
  const v = api.DAC_KPI_REPORTED.strategic_capital(
    { E1: { data: { Y: disp }, schema_by_year: { Y: sc } } }, 'Y');
  const usable = v && (typeof v.total === 'number' || typeof v.dac === 'number');
  const e = usable ? { total: v.total == null ? null : v.total,
                       dac: v.dac === undefined ? null : v.dac } : null;
  const share = e ? api.kpiDacPct(e) : null;
  return { gt: disp[disp.length - 1][2], share: share,
           header: share == null ? null : +(share * 100).toFixed(1) };
}
guard('E: typing "10%" no longer empties the KPI', () => {
  const typed = ['10%', '20%', '35%', '40%'];
  const before = e1Chain(OLD, typed);
  const after = e1Chain(NEW, typed);
  ok(before.gt === null, 'E1 at BASE the weighted Grand Total was null: ' + before.gt);
  ok(before.share === null, 'E2 at BASE the KPI share was null, so the header dashed');
  ok(typeof after.gt === 'number' && isFinite(after.gt),
     'E3 now the Grand Total is a number: ' + after.gt);
  ok(after.header !== null && after.header > 0 && after.header < 100,
     'E4 and the header reads a sane percentage: ' + after.header + '%');
  /* the SAME figures typed as fractions must give the SAME answer: that is
   * what makes "10%" and "0.1" one convention rather than two */
  const asFrac = e1Chain(NEW, ['0.1', '0.2', '0.35', '0.4']);
  ok(Math.abs(after.gt - asFrac.gt) < 1e-12,
     'E5 "10%" and "0.1" produce the IDENTICAL stored total: ' +
     after.gt + ' vs ' + asFrac.gt);
  ok(after.header === asFrac.header,
     'E6 and the identical header: ' + after.header + '% vs ' + asFrac.header + '%');
});

/* =================== S: stored years cannot move ======================== */
say('');
say('=== S. THE GATE: every stored table-year is unchanged ================');
guard('S: all 52 tables, every stored year, derived output identical to BASE', () => {
  let checked = 0, moved = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).forEach(y => {
      const rows = t.data[y];
      if (!rows || !rows.length) return;
      const sc = (t.schema_by_year || {})[y] || null;
      let a, b;
      try {
        a = NEW.rowsForDisplay(rows.map(r => r.slice()), sc, id);
        b = OLD.rowsForDisplay(rows.map(r => r.slice()), sc, id);
      } catch (e) { moved.push(id + ':' + y + ' threw ' + e.message); return; }
      checked++;
      if (JSON.stringify(a) !== JSON.stringify(b)) moved.push(id + ':' + y);
    });
  });
  ok(checked >= 140, 'S1 compared ' + checked + ' stored table-years');
  ok(moved.length === 0,
     'S2 NOT ONE of them changed' + (moved.length ? ': ' + moved.slice(0, 6).join(', ') : ''));
});

guard('S: and every reported KPI derives identically', () => {
  const ids = Object.keys(NEW.DAC_KPI_REPORTED);
  let checked = 0, moved = [];
  const years = ['2023', '2024', '2025'];
  const T = (api) => {
    const out = {};
    Object.keys(P.tables).forEach(id => {
      const t = P.tables[id];
      const d = {};
      Object.keys(t.data || {}).forEach(y => {
        d[y] = api.rowsForDisplay(t.data[y].map(r => r.slice()),
                                  (t.schema_by_year || {})[y] || null, id);
      });
      out[id] = { data: d, schema_by_year: t.schema_by_year };
    });
    return out;
  };
  const tn = T(NEW), tb = T(OLD);
  ids.forEach(k => years.forEach(y => {
    let a, b;
    try { a = NEW.DAC_KPI_REPORTED[k](tn, y); } catch (e) { a = 'THREW ' + e.message; }
    try { b = OLD.DAC_KPI_REPORTED[k](tb, y); } catch (e) { b = 'THREW ' + e.message; }
    checked++;
    if (JSON.stringify(a) !== JSON.stringify(b)) moved.push(k + ':' + y);
  }));
  ok(checked >= 30, 'S3 compared ' + checked + ' reported KPI-years');
  ok(moved.length === 0,
     'S4 NOT ONE of them changed' + (moved.length ? ': ' + moved.join(', ') : ''));
});

/* =================== G: the gauge geometry ============================== */
say('');
say('=== G. shrink-to-fit: GEOMETRY, not rendering ========================');
say('    (a canvas cannot be read from node. What is proven here is that every');
say('     computed centre and radius lands inside the bitmap -- the property');
say('     that actually broke. It is NOT proof the strip looks right.)');

/* The layout arithmetic, READ FROM THE SOURCE rather than retyped. Retyping
 * the constants would make this suite agree with itself instead of with the
 * shipped code -- the "values retyped in the harness" trap. */
function layoutFrom(src) {
  const fn = grabFn('drawSectionEArc', src);
  if (!fn) return null;
  const num = (re) => { const m = re.exec(fn); return m ? parseFloat(m[1]) : null; };
  const hasScale = /const k = Math\.max\(([\d.]+), Math\.min\(1,/.test(fn);
  const floor = hasScale ? num(/const k = Math\.max\(([\d.]+), Math\.min\(1,/) : null;
  const R_OUT_F = hasScale ? num(/R_OUT_F = (\d+)/) : num(/R_OUT = (\d+)/);
  const SW_OUT_F = hasScale ? num(/SW_OUT_F = (\d+)/) : num(/SW_OUT = (\d+)/);
  const MIN_GAP = hasScale ? num(/MIN_GAP = (\d+)/) : 8;
  /* NULL IS NOT AN ANSWER. A mutation that replaced the scale line with
   * `const k = 1` made hasScale false, sent the constant reads down the BASE
   * branch, and returned nulls -- so rightEdge computed NaN, every `> CW`
   * comparison was false, and the sweep cheerfully reported NO CLIPPING for a
   * build that clips. The guard could not fail. It is the mutation control
   * that found it, which is the only reason this reads correctly now. */
  const readable = [R_OUT_F, SW_OUT_F, MIN_GAP].every(v => typeof v === 'number' && isFinite(v)) &&
    (!hasScale || (typeof floor === 'number' && isFinite(floor)));
  return { hasScale, floor, R_OUT_F, SW_OUT_F, MIN_GAP, readable };
}
function rightEdge(L, CW, N) {
  const NATURAL_ARC = (L.R_OUT_F + L.SW_OUT_F / 2) * 2;
  let k = 1;
  if (L.hasScale) {
    const NATURAL_W = NATURAL_ARC * N + L.MIN_GAP * (N + 1);
    k = Math.max(L.floor, Math.min(1, CW > 0 ? CW / NATURAL_W : 1));
  }
  const R_OUT = L.R_OUT_F * k, SW_OUT = L.SW_OUT_F * k;
  const ARC = (R_OUT + SW_OUT / 2) * 2;
  const GAP = Math.max(L.MIN_GAP * (L.hasScale ? k : 1), (CW - ARC * N) / (N + 1));
  const SIDE = GAP + R_OUT + SW_OUT / 2;
  return { k, right: SIDE + (N - 1) * (ARC + GAP) + R_OUT + SW_OUT / 2 };
}

guard('G: the shipped layout is scale-aware and BASE was not', () => {
  const Ln = layoutFrom(SRC), Lb = layoutFrom(BASE_SRC);
  ok(!!Ln && !!Lb, 'G0 the draw function was found in both sources');
  ok(Ln.hasScale === true, 'G1 the shipped layout derives a scale factor');
  ok(Lb.hasScale === false, 'G2 BASE hardcoded the radius, which is the defect');
  ok(Ln.readable, 'G2b the shipped layout constants were actually READ, not nulls');
  ok(Lb.readable, 'G2c and so were BASEs: a null here makes the sweep vacuous');
  ok(Ln.R_OUT_F === 82 && Lb.R_OUT_F === 82,
     'G3 the FULL-SIZE radius is unchanged at 82, so a wide window is untouched');
});

guard('G: the width sweep -- nothing is ever drawn past the bitmap', () => {
  const Ln = layoutFrom(SRC), Lb = layoutFrom(BASE_SRC);
  if (!ok(Ln.readable && Lb.readable,
          'G3b both layouts are readable, so this sweep means something')) return;
  const WIDTHS = [1400, 1200, 1000, 900, 800, 768, 700, 600, 500, 420, 360];
  let clipNew = [], clipBase = [];
  [1, 2, 3, 4, 5, 6].forEach(N => {
    WIDTHS.forEach(CW => {
      if (rightEdge(Ln, CW, N).right > CW + 0.5) clipNew.push(N + '@' + CW);
      if (rightEdge(Lb, CW, N).right > CW + 0.5) clipBase.push(N + '@' + CW);
    });
  });
  ok(clipBase.length > 0,
     'G4 BASE clips in ' + clipBase.length + ' of the swept cases, incl ' +
     clipBase.slice(0, 4).join(', '));
  ok(clipBase.indexOf('4@700') >= 0 && clipBase.indexOf('4@600') >= 0,
     'G5 including FOUR gauges at 700 and 600, which is what Emely saw');
  ok(clipNew.length === 0,
     'G6 the shipped layout clips in NONE of the ' + (6 * WIDTHS.length) +
     ' swept cases' + (clipNew.length ? ': ' + clipNew.slice(0, 6).join(', ') : ''));
});

guard('G: a wide window reproduces the OLD layout exactly', () => {
  const Ln = layoutFrom(SRC), Lb = layoutFrom(BASE_SRC);
  let same = 0, diff = [];
  [1400, 1200, 1000, 900, 800].forEach(CW => {
    const a = rightEdge(Ln, CW, 4), b = rightEdge(Lb, CW, 4);
    if (Math.abs(a.right - b.right) < 1e-9 && a.k === 1) same++;
    else diff.push(CW + ' (' + a.right.toFixed(1) + ' vs ' + b.right.toFixed(1) + ')');
  });
  ok(diff.length === 0,
     'G7 at every width where BASE already fitted, the layout is IDENTICAL (' +
     same + ' widths)' + (diff.length ? ': ' + diff.join(', ') : ''));
});

guard('G: the floor only stops degenerate geometry, it does not clip', () => {
  const Ln = layoutFrom(SRC);
  ok(Ln.floor === 0.25, 'G8 the scale floor is 0.25, read from the source');
  /* WHY 0.25 AND NOT 0.45: the first draft floored at 0.45, and this very
   * sweep caught it still clipping six gauges at 500px -- the same defect
   * further along the axis. The floor now exists only to keep the radius
   * positive, and the no-clipping contract below is what it serves. */
  const WIDE = [1400, 1200, 1000, 900, 800, 768, 700, 600, 500, 420, 360, 320];
  let bad = [];
  [1, 2, 3, 4, 5, 6].forEach(N => WIDE.forEach(CW => {
    const r = rightEdge(Ln, CW, N);
    if (r.right > CW + 0.5) bad.push(N + '@' + CW);
    if (!(r.k > 0)) bad.push(N + '@' + CW + ' degenerate k');
  }));
  ok(bad.length === 0,
     'G9 THE CONTRACT: 1 to 6 gauges, 320px to 1400px, nothing clips and no ' +
     'radius goes degenerate'+ (bad.length ? ': ' + bad.slice(0, 6).join(', ') : ''));
  /* THE FLOOR IS REACHED, or the contract above proves nothing about it.
   * At 320px the six-gauge k is still 0.276, ABOVE the floor -- my first
   * version of this assertion claimed the floor was exercised there and was
   * simply wrong. It bites for FOUR gauges, which is what E1 actually has,
   * at 194px and narrower, and it still fits there. */
  ok(rightEdge(Ln, 194, 4).k === 0.25,
     'G10 at 194px the four-gauge scale sits ON the floor: ' + rightEdge(Ln, 194, 4).k);
  ok(rightEdge(Ln, 194, 4).right <= 194.5,
     'G11 and four gauges STILL fit there: right edge ' +
     rightEdge(Ln, 194, 4).right.toFixed(1));
  /* and the honest boundary: six gauges below ~290 is past the floor and
   * does clip. Disclosed rather than discovered later -- E1 has four. */
  ok(rightEdge(Ln, 280, 6).right > 280,
     'G12 DISCLOSED: six gauges under 290px clip, past the floor. E1 has four.');
});

guard('G: the resize redraw is wired, and cannot accumulate listeners', () => {
  const code = codeOnly(SRC);
  ok(/function wireSectionEArcResize\(\)/.test(code),
     'G11 a resize wirer exists');
  ok(/if \(letter === 'E'\) \{ drawSectionEArc\(\); wireSectionEArcResize\(\); \}/.test(code),
     'G12 and section E calls it on mount');
  ok(/if \(_eArcResizeHandler\) window\.removeEventListener\('resize', _eArcResizeHandler\);/.test(code),
     'G13 the prior handler is removed before a new one is added');
  ok(/requestAnimationFrame/.test(grabFn('wireSectionEArcResize') || ''),
     'G14 and the redraw is rAF-coalesced, since resize fires continuously');
  ok(!/wireSectionEArcResize/.test(codeOnly(BASE_SRC)),
     'G15 none of which existed at BASE');
});

/* =================== X: what this round did NOT do ====================== */
say('');
say('=== X. the exclusions, including the one Emely ruled OUT =============');
guard('X: the defensive readers were NOT added', () => {
  const code = codeOnly(SRC), base = codeOnly(BASE_SRC);
  /* Emely ruled option B out: masking while equity_index sits inflated is
   * worse than nothing. The header and gauge readers must be untouched. */
  ok(code.indexOf("(secDacPct * 100).toFixed(1) + '%'") >= 0,
     'X1 the section header still multiplies unconditionally, as ruled');
  ok(/const pctNum = has \? pct \* 100 : 0;/.test(code),
     'X2 and so does the section-goals gauge row');
  ok(grab('kpiDacPct') === grab('kpiDacPct', BASE_SRC),
     'X3 kpiDacPct is byte-identical to BASE');
  ok(grab('dacPct') === grab('dacPct', BASE_SRC),
     'X4 dacPct is byte-identical to BASE');
  ok(grabConst('DERIVED_COLS') === grabConst('DERIVED_COLS', BASE_SRC),
     'X5 DERIVED_COLS is byte-identical to BASE');
  ok(grab('getTableSchema') === grab('getTableSchema', BASE_SRC),
     'X6 round 1s getTableSchema fix is unchanged');
  ok(grab('isTotalOnlyDerived') === grab('isTotalOnlyDerived', BASE_SRC),
     'X7 and so is round 1s isTotalOnlyDerived');
});

guard('X: the blast radius, function by function', () => {
  const names = [...new Set((SRC.match(/\r\n\s*(?:async )?function (\w+)\(/g) || [])
    .map(m => /function (\w+)\(/.exec(m)[1]))];
  /* grabFn, never grab: see the note on the extractor above. */
  const changed = names.filter(n => grabFn(n) !== grabFn(n, BASE_SRC));
  say('       changed: ' + changed.sort().join(', '));
  const EXPECT = {
    parseNumericInput: 'the percent sign becomes a unit',
    drawSectionEArc: 'shrink to fit',
    wireSectionEArcResize: 'the resize redraw (new)',
    /* the call site: section E now wires the resize handler on mount. A
     * fourth function, named rather than absorbed into a looser count. */
    wireSectionInteractions: 'calls wireSectionEArcResize when E mounts',
  };
  changed.forEach(n => ok(n in EXPECT, 'the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  ok(changed.length === 4, 'exactly FOUR functions changed: ' + changed.length);
});

guard('X: the baseline is a literal commit, and predates the change', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X8 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try {
    execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: REPO });
    anc = true;
  } catch (e) { anc = false; }
  ok(anc, 'X9 and it is an ancestor of HEAD, so it really is the before-state');
});

lines.forEach(l => console.log(l));
console.log('');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n\n  ' +
  pass + ' passed, ' + fail + ' failed\n');
process.exitCode = fail ? 1 : 0;
