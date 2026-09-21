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
/* CLCPA-245: the general label veto, and the editor label tooltip.
 *
 * THE DEFECT. Outside the four declared hierarchical tables, totalRowFlags
 * decided a total purely by arithmetic -- "structure proposes, arithmetic
 * confirms". Arithmetic cannot tell a total from a coincidence when the
 * figures are uniform, and CLCPA-240 round 4 fixed that only inside the
 * family, saying explicitly that the general correction stayed its own ticket.
 * This is that ticket.
 *
 * Measured driving 999 and 9999 imports across all 52 tables: 24 tables
 * mis-flagged, 72 data rows flagged with no total label. I1 is the cleanest
 * case -- it has NO total row in any year -- and Emely's mixed-fill import of
 * 2099 locked FIVE of its nine data rows. The count moves with which row is
 * left blank (5,4,3,2,1,0 as the blank walks down), because a blank row reads
 * as a structural header and re-segments the grouped branch.
 *
 * THE RULE, and why it is not the obvious one. The ticket proposed
 * CLCPA-200's strict whole-label rule. Measured across all 149 stored
 * table-years it LOSES 21 legitimate totals: every G-family "County Total"
 * plus G1's "Systemwide Total", none of which is the bare word. Emely
 * corrected the plan on that measurement. The shipped rule anchors at the END
 * instead, which keeps all 21 and still refuses I1's
 * "Total number of hires at Con Edison from [the Academy]..." -- a data row
 * whose label BEGINS with the word. A substring match flags that row; this is
 * CLCPA-200's lesson in a table CLCPA-200 never saw.
 *
 * THE HARD GATE: 149 stored table-years, zero flags gained, zero lost.
 *
 * THE ORACLE. Totals are checked against arithmetic computed HERE, from the
 * row structure alone, calling nothing in app.js -- the CLCPA-240 round 4
 * pattern. An engine-to-engine comparison cannot see the engine being wrong
 * the same way on both sides, and that is exactly how three rounds of 240
 * passed a screen that was broken.
 *
 * BASE is 00d6dd3.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = _dacRepo() + '';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-245-evidence/suite-245-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || '00d6dd3';
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
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

function grab(name, src) {
  src = src || SRC;
  for (const p of ['  ', '    ', '']) for (const k of ['function ', 'async function ']) {
    const h = '\r\n' + p + k + name + '('; const i = src.indexOf(h); if (i < 0) continue;
    const c = '\r\n' + p + '}'; const j = src.indexOf(c, i + h.length); if (j <= i) continue;
    return src.slice(i + 2, j + c.length);
  } return null;
}
/* brace-matching, for the column-0 functions grab() over-reads on */
function grabFn(name, src) {
  src = src || SRC;
  const re = new RegExp('(?:^|\\r\\n)([ \\t]*)(?:async )?function ' + name + '\\s*\\(');
  const m = re.exec(src); if (!m) return null;
  const start = src.indexOf(m[0]) + (m[0].startsWith('\r\n') ? 2 : 0);
  let i = src.indexOf('{', start); if (i < 0) return null;
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i], n2 = src[i + 1];
    if (c === '/' && n2 === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 1; continue; }
    if (c === '/' && n2 === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      for (i++; i < src.length; i++) { if (src[i] === BS) { i++; continue; } if (src[i] === q) break; }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
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
  }
  return null;
}

/* ---- assemble, DRIVING the veto path inside the resolution loop ---------
 *
 * The veto loop opens with `if (!out[i]) continue`, so a table with zero flags
 * never reaches it. I1 has none -- that is the whole point of the ticket -- so
 * driving I1 alone left isAnchoredTotalRowLabel unresolved and the probe threw
 * outside the loop. A1 has a real Total row and drives the path. */
function build(src, tag) {
  const fns = ['totalRowFlags', 'isStrictTotalRowLabel', 'recomputeTotals'];
  const cs = ['DERIVED_COLS', 'HIERARCHICAL_TABLES'];
  for (let it = 0; it < 500; it++) {
    const body = '"use strict";\n' +
      'const console = { warn(){}, info(){}, log(){}, error(){} };\n' +
      cs.map(n => grabConst(n, src)).filter(Boolean).join('\n') + '\n' +
      fns.map(n => grab(n, src)).filter(Boolean).join('\n') + '\n' +
      'return {' + fns.filter(n => grab(n, src)).join(',') +
      (grabConst('HIERARCHICAL_TABLES', src) ? ',HIERARCHICAL_TABLES' : '') + '};';
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
      /* a FAMILY table, a flagging NON-family table, and a value-less draft:
       * three different paths through the tail */
      api.totalRowFlags(P.tables.A5.data['2025'].map(r => r.slice()), 'A5',
        P.tables.A5.schema_by_year['2025']);
      api.totalRowFlags(P.tables.A1.data['2025'].map(r => r.slice()), 'A1',
        P.tables.A1.schema_by_year['2025']);
      api.totalRowFlags(P.tables.A1.data['2025'].map(r => [r[0], null, null, null]), 'A1',
        P.tables.A1.schema_by_year['2025']);
      api.recomputeTotals(P.tables.A1.data['2025'].map(r => r.slice()),
        P.tables.A1.schema_by_year['2025'], 'A1', []);
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
say('CLCPA-245 -- the general label veto, and the label tooltip');
say('  BASE ' + BASE);
say('======================================================================');

let NEW = null, OLD = null;
guard('both sources assemble and RUN', () => {
  NEW = build(SRC, 'NEW');
  OLD = build(BASE_SRC, 'BASE');
  ok(!!NEW && !!OLD, 'both sources assemble and drive the veto path');
});
if (!NEW || !OLD) {
  lines.forEach(l => console.log(l));
  console.log('\n  ' + pass + ' passed, ' + fail + ' failed  (assembly failed)');
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(1);
}

const HIER = NEW.HIERARCHICAL_TABLES || {};
const lab = (rows, i) => String((rows[i] || [])[0] == null ? '' : rows[i][0]).trim();
const isNum = (v) => typeof v === 'number' && isFinite(v);

/* ===================== G: THE HARD GATE ================================= */
say('');
say('=== G. THE GATE: 149 stored table-years, nothing moves ===============');
guard('G: every stored table-year flags exactly as it did at BASE', () => {
  let years = 0, gained = [], lost = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach(y => {
      const rows = t.data[y]; if (!rows || !rows.length) return;
      const schema = (t.schema_by_year || {})[y] || null;
      years++;
      const a = NEW.totalRowFlags(rows.map(r => r.slice()), id, schema) || [];
      const b = OLD.totalRowFlags(rows.map(r => r.slice()), id, schema) || [];
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (a[i] && !b[i]) gained.push(id + ':' + y + ' r' + i + ' ' + lab(rows, i));
        if (!a[i] && b[i]) lost.push(id + ':' + y + ' r' + i + ' ' + lab(rows, i));
      }
    });
  });
  ok(years === 149, 'G1 compared ' + years + ' stored table-years (expected 149)');
  ok(lost.length === 0, 'G2 ZERO flags lost' +
     (lost.length ? ': ' + lost.slice(0, 6).join(' | ') : ''));
  ok(gained.length === 0, 'G3 ZERO flags gained' +
     (gained.length ? ': ' + gained.slice(0, 6).join(' | ') : ''));
});

guard('G: the 21 the REJECTED rule would have lost are still flagged', () => {
  /* the ticket proposed the strict whole-label rule; measured, it strips every
   * G-family "County Total" and G1's "Systemwide Total". They must survive. */
  let checked = 0, missing = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach(y => {
      const rows = t.data[y]; if (!rows || !rows.length) return;
      const schema = (t.schema_by_year || {})[y] || null;
      const f = NEW.totalRowFlags(rows.map(r => r.slice()), id, schema) || [];
      rows.forEach((r, i) => {
        const L = lab(rows, i);
        if (!/^(county|systemwide) total$/i.test(L)) return;
        checked++;
        if (!f[i]) missing.push(id + ':' + y + ' r' + i + ' ' + L);
        ok.silent = true;
      });
    });
  });
  ok(checked === 21, 'G4 found all 21 County/Systemwide Total rows: ' + checked);
  ok(missing.length === 0, 'G5 and EVERY one is still flagged' +
     (missing.length ? ': ' + missing.join(' | ') : ''));
  /* and the rejected rule really would have dropped them, or G4/G5 prove nothing */
  const wouldDrop = !NEW.isStrictTotalRowLabel('County Total');
  ok(wouldDrop, 'G6 the whole-label rule really does reject "County Total", ' +
     'which is why the shipped rule anchors at the END instead');
});

/* ===================== M: the mis-flags are gone ======================== */
say('');
say('=== M. uniform imports: the arithmetic coincidence is vetoed =========');
function uniformDraft(rows, V) {
  return rows.map(r => [r[0], ...r.slice(1).map(v => isNum(v) ? V : '')]);
}
guard('M: 52 tables driven at 999 and 9999', () => {
  let misNew = 0, misOld = 0, tablesNew = {}, tablesOld = {};
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    const ys = Object.keys(t.data || {}).filter(y => (t.data[y] || []).length);
    if (!ys.length) return;
    const y = ys[ys.length - 1];
    const rows = t.data[y];
    const schema = (t.schema_by_year || {})[y] || null;
    [999, 9999].forEach(V => {
      const d = uniformDraft(rows, V);
      const a = NEW.totalRowFlags(d.map(r => r.slice()), id, schema) || [];
      const b = OLD.totalRowFlags(d.map(r => r.slice()), id, schema) || [];
      a.forEach((f, i) => {
        if (f && !NEW.isStrictTotalRowLabel(lab(rows, i)) && !HIER[id]) {
          misNew++; tablesNew[id] = 1;
        }
      });
      b.forEach((f, i) => {
        if (f && !NEW.isStrictTotalRowLabel(lab(rows, i)) && !HIER[id]) {
          misOld++; tablesOld[id] = 1;
        }
      });
    });
  });
  ok(misOld > 0, 'M1 BASE mis-flagged ' + misOld + ' rows across ' +
     Object.keys(tablesOld).length + ' tables, which is the defect');
  ok(misNew === 0, 'M2 the shipped rule mis-flags NONE outside the family: ' +
     misNew + (misNew ? ' in ' + Object.keys(tablesNew).join(',') : ''));
});

/* ===================== I: I1, the clean case =========================== */
say('');
say('=== I. I1 has no total row, so it flags NOTHING ======================');
guard('I: every fill pattern, including Emelys mixed 2099', () => {
  const rows0 = P.tables.I1.data['2025'];
  const schema = P.tables.I1.schema_by_year['2025'];
  const labels = rows0.map(r => String(r[0]));
  const V = 9999, TXT = 'Hybrid';
  const PATTERNS = {
    'all filled': rows0.map(r => [r[0], V, V]),
    'numeric filled, text blank': rows0.map(r => [r[0], isNum(r[1]) ? V : '', isNum(r[2]) ? V : '']),
    'EMELY 2099 mixed: 0 and 2 text, 1 blank, 3-8 uniform':
      labels.map((L, i) => i === 1 ? [L, '', ''] : (i === 0 || i === 2 ? [L, TXT, TXT] : [L, V, V])),
    'stored, untouched': rows0.map(r => r.slice()),
  };
  Object.keys(PATTERNS).forEach(name => {
    const a = NEW.totalRowFlags(PATTERNS[name].map(r => r.slice()), 'I1', schema) || [];
    const b = OLD.totalRowFlags(PATTERNS[name].map(r => r.slice()), 'I1', schema) || [];
    const onA = a.filter(Boolean).length, onB = b.filter(Boolean).length;
    ok(onA === 0, 'I1 [' + name + '] flags NOTHING now: ' + onA +
       '   (BASE flagged ' + onB + ')');
  });
  /* the blank row sweep: the count used to move with WHICH row is blank */
  let worstBase = 0;
  for (let bIdx = 0; bIdx < labels.length; bIdx++) {
    const d = labels.map((L, i) => i === bIdx ? [L, '', ''] :
      ((i === 0 || i === 1 || i === 2 || i === 7) ? [L, TXT, TXT] : [L, V, V]));
    const b = OLD.totalRowFlags(d.map(r => r.slice()), 'I1', schema) || [];
    worstBase = Math.max(worstBase, b.filter(Boolean).length);
    const a = NEW.totalRowFlags(d.map(r => r.slice()), 'I1', schema) || [];
    ok(a.filter(Boolean).length === 0, 'I2 blank row ' + bIdx + ': 0 flags now');
  }
  ok(worstBase >= 4, 'I3 and BASE flagged up to ' + worstBase +
     ' of 9 across that sweep, which is the defect Emely photographed');
});

/* ===================== C: the caution row ============================== */
say('');
say('=== C. the caution: a label that BEGINS with the word ================');
guard('C: I1 row 8 stays a data row', () => {
  const rows0 = P.tables.I1.data['2025'];
  const L = String(rows0[8][0]);
  ok(/^total/i.test(L.trim()), 'C1 the label really does begin with the word: ' +
     JSON.stringify(L.slice(0, 44)));
  ok(/total/i.test(L), 'C2 and a SUBSTRING rule would match it');
  const fn = grab('isAnchoredTotalRowLabel');
  if (!ok(fn !== null, 'C3 isAnchoredTotalRowLabel was found')) return;
  const pred = new Function(fn + '\nreturn isAnchoredTotalRowLabel;')();
  ok(pred(L) === false, 'C4 the SHIPPED predicate refuses it, because it anchors at the END');
  ok(pred('County Total') === true, 'C5 while "County Total" passes');
  ok(pred('Systemwide Total') === true, 'C6 and "Systemwide Total"');
  ok(pred('Total') === true && pred('Subtotal') === true && pred('Grand Total') === true,
     'C7 and the bare forms the strict rule already covered');
  ok(pred('Total # of projects') === false,
     'C8 and CLCPA-209s own row, "Total # of projects", stays data');
  ok(pred('Total amount of residential electric usage (kWh)') === false,
     'C9 and CLCPA-200s J1 row too');
  /* THE WORD BOUNDARY, asserted directly because the payload cannot exercise
   * it. No stored label ends in the letters "total" as part of a larger word,
   * so a mutation that drops the (^|\s) anchor changes nothing on real data
   * and went unnoticed by every other guard here -- its own mutation control
   * is what exposed that. A synthetic pair is the only way to pin it. */
  ok(pred('Xtotal') === false,
     'C10 a label ending in the LETTERS but not the WORD is refused');
  ok(pred('X total') === true,
     'C11 while the same with a word boundary is accepted');
  ok(pred('nontotal') === false && pred('non total') === true,
     'C12 and the boundary is what separates them, not the spelling');
});

/* ===================== O: the INDEPENDENT oracle ======================= */
say('');
say('=== O. totals checked against arithmetic computed HERE ===============');
/* Calls nothing in app.js. A total row sums the data rows of its own segment;
 * outside the family a total is a row whose label ends in the word. */
function oracleTotals(rows, tableId) {
  const isEmptyV = (v) => v === null || v === undefined || String(v).trim() === '';
  const isHdr = (r) => Array.isArray(r) && r.length > 1 && !isEmptyV(r[0]) &&
    r.slice(1).every(isEmptyV);
  const ends = (L) => /(^|\s)(grand\s+|sub)?totals?$/i.test(String(L == null ? '' : L).trim());
  return rows.map((r, i) => !isHdr(r) && ends((r || [])[0]));
}
guard('O: outside the family the flags ARE the label answer, both inputs', () => {
  let checkedReal = 0, badReal = [], checkedUni = 0, badUni = [];
  Object.keys(P.tables).sort().forEach(id => {
    if (HIER[id]) return;
    const t = P.tables[id];
    const ys = Object.keys(t.data || {}).filter(y => (t.data[y] || []).length);
    ys.forEach(y => {
      const rows = t.data[y];
      const schema = (t.schema_by_year || {})[y] || null;
      /* REAL input */
      const a = NEW.totalRowFlags(rows.map(r => r.slice()), id, schema) || [];
      const want = oracleTotals(rows, id);
      checkedReal++;
      a.forEach((f, i) => { if (f && !want[i]) badReal.push(id + ':' + y + ' r' + i); });
      /* UNIFORM input */
      [999, 9999].forEach(V => {
        const d = uniformDraft(rows, V);
        const b = NEW.totalRowFlags(d.map(r => r.slice()), id, schema) || [];
        const w2 = oracleTotals(d, id);
        checkedUni++;
        b.forEach((f, i) => { if (f && !w2[i]) badUni.push(id + ':' + y + '@' + V + ' r' + i); });
      });
    });
  });
  ok(checkedReal >= 100, 'O1 real inputs: ' + checkedReal + ' table-years');
  ok(badReal.length === 0, 'O2 no flag outside the family lacks the anchored label' +
     (badReal.length ? ': ' + badReal.slice(0, 5).join(', ') : ''));
  ok(checkedUni >= 200, 'O3 uniform inputs: ' + checkedUni + ' drives');
  ok(badUni.length === 0, 'O4 and the same holds under uniform figures' +
     (badUni.length ? ': ' + badUni.slice(0, 5).join(', ') : ''));
  /* the oracle must be capable of disagreeing, or O2/O4 prove nothing */
  const sample = P.tables.I1.data['2025'];
  const w = oracleTotals(sample, 'I1');
  ok(w.every(x => x === false), 'O5 the oracle says I1 has NO total row, independently');
  const g = P.tables.G2.data['2025'];
  ok(oracleTotals(g, 'G2').some(Boolean),
     'O6 and that it DOES find one in G2, so it is not simply always false');
});

/* ===================== T: the tooltip rider ============================ */
say('');
say('=== T. the label tooltip, in the DASHBOARDS OWN style =============');
/* ROUND 2, by ruling: round 1 used a native `title` and it must not. The
 * tooltip goes through the shared .exec-tooltip div and the shared pointer
 * clamp, so it reads like every other tooltip on the page. */
guard('T: the native title is GONE and a data attribute replaced it', () => {
  const ed = grabFn('renderIngestEditor');
  if (!ok(ed !== null, 'T0 renderIngestEditor was found')) return;
  const code = codeOnly(ed);
  ok(!/ title="/.test(code),
     'T1 the label cell emits NO native title any more');
  ok(/data-label-tip="\$\{escapeHtml\(labelText\)\}"/.test(code),
     'T2 the full text rides on data-label-tip, ESCAPED');
  ok(/const labelTip = labelText\.trim\(\)/.test(code),
     'T3 and it is absent for a blank label');
  /* the attribute must not have leaked into any other cell */
  ok((codeOnly(SRC).match(/data-label-tip=/g) || []).length === 1,
     'T4 exactly one place emits it: ' +
     (codeOnly(SRC).match(/data-label-tip=/g) || []).length);
});

guard('T: it uses the SHARED tooltip machinery, not a fourth positioner', () => {
  const w = grabFn('wireIngestLabelTips');
  if (!ok(w !== null, 'T5 wireIngestLabelTips exists')) return;
  const code = codeOnly(w);
  ok(/ensureTooltip\(\)/.test(code),
     'T6 it opens the SHARED .exec-tooltip via ensureTooltip');
  ok(/placeTooltipAtPointer\(tip, e\)/.test(code),
     'T7 and positions it with the shared CLCPA-242 clamp');
  ok(!/style\.left|style\.top/.test(code),
     'T8 it does NOT position the box itself: one clamp, not a fifth');
  ok(/tip\.textContent = text;/.test(code) && !/innerHTML/.test(code),
     'T9 textContent, never innerHTML: a label is operator-supplied text');
  ok(/exec-tooltip-hug/.test(code),
     'T10 and the hug modifier, because this is one short string');
});

guard('T: CLCPA-242s ownership lesson is honoured', () => {
  const wc = grabFn('wireControlTips');
  if (!ok(wc !== null, 'T11 wireControlTips was found')) return;
  const code = codeOnly(wc);
  ok(/OWNS_TIP = /.test(code), 'T12 the tip-owning list is still there');
  ok(/ingest-cell-label\[data-label-tip\]/.test(code),
     'T13 and the ingest label is IN it, so the control-tip handler does not',
  );
  ok(/if \(ownsTip\(e\)\) return;/.test(code),
     'T14 hide the box the label just opened');
  /* and the label must not blanket-hide either: its own hide fires only
   * when the pointer leaves a LABEL, never on any other mouseout */
  const w = codeOnly(grabFn('wireIngestLabelTips') || '');
  ok(/mouseout.*if \(labelOf\(e\)\) hide\(\)/.test(w.replace(/\s+/g, ' ')),
     'T15 and the label hides the tip ONLY when the pointer leaves a label');
  ok(!/hideExecTooltip\(\)/.test(w),
     'T16 it never calls the global hide, which would close another surfaces tip');
});

guard('T: delegated once, so a rebuilt grid cannot stack handlers', () => {
  const w = codeOnly(grabFn('wireIngestLabelTips') || '');
  ok(/if \(wireIngestLabelTips\._wired\) return;/.test(w),
     'T17 it is idempotent, like wireControlTips');
  ok(/document\.addEventListener/.test(w) && !/querySelectorAll/.test(w),
     'T18 and DELEGATED rather than bound per row, since the grid is rebuilt');
  ok(/wireIngestLabelTips\(\);/.test(codeOnly(grabFn('wireIngestPage') || '')),
     'T19 and the page wiring calls it');
});

guard('T: driven -- the attribute lands, and not on a blank label', () => {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const LONG = 'A very long metric label that the editor would otherwise clip silently';
  const rows = [[LONG, 1, 2], ['', 3, 4]];
  const schema = ['Metric', 'Unique', 'Non-Unique'];
  const STATE = { payload: P, ingest: { tableId: 'I1', year: '2025', schema: schema,
    baseline: rows.map(r => r.slice()), draft: rows.map(r => r.slice()), dirty: false } };
  let fns = ['renderIngestEditor'], cs = [], html = null;
  for (let it = 0; it < 500; it++) {
    const body = '"use strict";\n' +
      'const console={warn(){},info(){},log(){},error(){}};\n' +
      'const document={getElementById:()=>null,querySelectorAll:()=>[]};\n' +
      'const localStorage={getItem:()=>null,setItem(){}};\n' +
      cs.map(n => grabConst(n)).filter(Boolean).join('\n') + '\n' +
      fns.map(n => grab(n)).filter(Boolean).join('\n') + '\nreturn renderIngestEditor;';
    let f;
    try { f = new Function('state', 'escapeHtml', body)(STATE, esc); }
    catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) { ok(false, 'T20 the editor would not assemble: ' + e.message); return; }
      if (grab(nm) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm) && cs.indexOf(nm) < 0) { cs.push(nm); continue; }
      ok(false, 'T20 cannot resolve ' + nm); return;
    }
    try { html = f(); break; }
    catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) { ok(false, 'T20 the editor threw: ' + e.message); return; }
      if (grab(nm) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm) && cs.indexOf(nm) < 0) { cs.push(nm); continue; }
      ok(false, 'T20 cannot resolve ' + nm + ' (call)'); return;
    }
  }
  if (!ok(html !== null, 'T20 the editor rendered')) return;
  ok(html.indexOf('data-label-tip="' + LONG + '"') >= 0,
     'T21 the long label carries its full text on the attribute');
  ok(html.indexOf(' title=') < 0,
     'T22 and NO native title anywhere in the grid');
  const trs = html.match(/<tr[^>]*data-row="\d+"[\s\S]*?<\/tr>/g) || [];
  const blankRow = trs.find(tr => /data-row="1"/.test(tr));
  ok(blankRow && !/data-label-tip/.test(blankRow),
     'T23 and the blank label gets no attribute at all');
});
/* ===================== X: the exclusions =============================== */
say('');
say('=== X. what this ticket did NOT touch ================================');
guard('X: the family veto and the derive engine are untouched', () => {
  ok(grab('isHierarchicalTotalLabel') === grab('isHierarchicalTotalLabel', BASE_SRC),
     'X1 CLCPA-240 round 4s family predicate is byte-identical');
  ok(grab('isStrictTotalRowLabel') === grab('isStrictTotalRowLabel', BASE_SRC),
     'X2 and CLCPA-200s strict predicate');
  /* RE-PINNED: CLCPA-241 declares A9's percent-change rule here. Byte equality
   * gives way to ATTRIBUTION rather than being dropped: every added CODE line
   * must be one of the four that ticket owns, so any other edit to the rule
   * table still fails this. */
  const DC_241 = [
    "    const pctChange = (column, current, previous, decimals) =>",
    "      ({ column, type: 'percentChange', current, previous, keepFiled: true, decimals,",
    "         numerator: [current], denominator: [previous], denominatorScope: 'row' });",
    "      A9: [pctChange(5, 3, 1, 0), pctChange(6, 4, 2, 0)],",
  ];
  /* CLCPA-319 declares the G total rows. Its OWN array, so the two tickets
   * stay separable and a line belonging to neither still fails. */
  const DC_319 = [
    '    const colTotal = (column) =>',
    "      ({ column, type: 'columnTotal', keepFiled: true,",
    '         numerator: [column], denominator: [column], denominatorScope: \'row\' });',
    "    const gPct = [colTotal(1), pct(2, [1], [1], 'total', 2)];  // G tables: the total row's own feet/mT, and feet/mT \u00f7 column total",
  ];
  const DC_OK = DC_241.concat(DC_319);
  const dcAdded = grabConst('DERIVED_COLS').split('\r\n')
    .filter(l => grabConst('DERIVED_COLS', BASE_SRC).indexOf(l) < 0)
    .filter(l => l.trim() && !/^\s*[*/]/.test(l.trim()));
  ok(dcAdded.length === DC_OK.length && dcAdded.every(l => DC_OK.indexOf(l) >= 0),
     'X3 DERIVED_COLS differs from BASE only by CLCPA-241s A9 rule and ' +
     'CLCPA-319s G total rows -- ' +
     JSON.stringify(dcAdded.filter(l => DC_OK.indexOf(l) < 0)));
  /* X4 said "byte-identical" until CLCPA-254 put one DECLARED column back in
   * the sum. Undoing that one exception -- the only edit that has landed in
   * this function since -- and requiring the rest to be BASE exactly keeps the
   * claim as narrow as it was. Widening it to a substring check would delete
   * the guard instead of re-pinning it. */
  const CLCPA254 = '/* CLCPA-212: does not sum -- unless CLCPA-254 has declared this\r\n' +
    '         * column summable by name. The declaration is the exception; the\r\n' +
    '         * predicate is unchanged. */\r\n' +
    '        if ((pctCol[c] || avgCol[c]) &&\r\n' +
    '            !isDeclaredSummable(tableId, schema[c])) continue;';
  const BASE254 = 'if (pctCol[c] || avgCol[c]) continue;         // CLCPA-212: does not sum';
  const rtNow = grab('recomputeTotals') || '';
  ok(rtNow.split(CLCPA254).length - 1 === 1,
     'X4a CLCPA-254s exception is present exactly once, so undoing it means something');
  /* CLCPA-241 adds one more line to reverse: recomputeTotals hands the
   * BASELINE to applyDerivedCols. Named and reversed beside CLCPA-254's
   * exception, so every other byte still has to match. */
  const RT_NEW_241 =
    '    /* CLCPA-241: the BASELINE travels with it, so an edited input recomputes\r\n' +
    '     * while a figure the SOURCE never reproduced is kept. */\r\n' +
    '    applyDerivedCols(draft, tableId, colSum, schema, baseline);';
  const RT_OLD_241 = '    applyDerivedCols(draft, tableId, colSum, schema);';
  ok(rtNow.replace(CLCPA254, () => BASE254).replace(RT_NEW_241, () => RT_OLD_241) ===
     grab('recomputeTotals', BASE_SRC),
     'X4 recomputeTotals is byte-identical once CLCPA-254s exception is undone: ' +
     'the ordering item is NOT bought here');
  ok(grab('parseNumericInput') === grab('parseNumericInput', BASE_SRC),
     'X5 and CLCPA-244s percent rule');
  const styles = /* DAC_CSS_PINNED: pinned to main before this package; the JS half stays live. A stylesheet claim about what THIS ticket did is history, and CLCPA-275 moved the stylesheet. */ execSync('git show ' + 'ca4c90a' + ':"Coned/CLCPA/ExecutiveDashboard_dev/styles.css"', { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
  const baseStyles = execSync('git show ' + BASE +
    ':"Coned/CLCPA/ExecutiveDashboard_dev/styles.css"',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
  /* CLCPA-248 CHANGED THE STYLESHEET, the first ticket to do so in several.
   * This pin stays EXACT rather than being dropped: the file may differ only
   * by the two rules that ticket adds, stripped by name below, and any other
   * change still turns it red. */
  const strip248 = (c) => String(c)
    .replace(/\/\* CLCPA-248[\s\S]*?\*\//g, '')
    .replace(/\/\* ALIGNMENT IS NOT TOUCHED[\s\S]*?\*\//g, '')
    .replace(/(?:\.data-table)?\.data-table-cmp \{ table-layout: fixed; \}/g, '')
    .replace(/\.data-table td\.num\.num-text \{[\s\S]*?\}/g, '')
    /* the dead-block surgery, both sides collapsed to one token: BASE has
       the commented-out block, this build has the note replacing it, and
       both end at the same two-column comment. Must precede the generic
       CLCPA-249 comment pattern below. */
    .replace(/\/\* =+\s*\.data-table \{\s*table-layout: fixed;[\s\S]*?col 2 = 65% \*\//g, 'DEADBLOCK')
    .replace(/\/\* CLCPA-249: fourteen lines deleted[\s\S]*?col 2 = 65% \*\//g, 'DEADBLOCK')
    /* CLCPA-249: the alignment rule. Every selector it retired or added is
       named here, so this comparison still fails on anything else. */
    .replace(/\/\* CLCPA-249[\s\S]*?\*\//g, '')
    .replace(/\/\* =+\s*THE ALIGNMENT RULE[\s\S]*?\*\//g, '')
    /* round 2: the refined rule and its own comment block */
    .replace(/\/\* ROUND 2, three findings from the hosted pass[\s\S]*?\*\//g, '')
    .replace(/\.data-table td:not\(\.num\) \{\s*text-align: left;\s*\}/g, '')
    .replace(/\.data-table thead tr:first-child > th:first-child,\s*\.data-table tbody tr > td:first-child \{\s*text-align: left;\s*\}/g, '')
    .replace(/\/\* READ THIS BEFORE SKIMMING[\s\S]*?\*\//g, '')
    .replace(/\.data-table th,\s*\.data-table td \{\s*text-align: center;\s*\}/g, '')
    .replace(/\.data-table th:first-child,\s*\.data-table td:first-child \{\s*text-align: left;\s*\}/g, '')
    .replace(/\.data-table th \{ text-align: center; \}/g, '')
    .replace(/\.data-table th:first-child \{ text-align: left; \}/g, '')
    .replace(/\.data-table td:first-child \{ text-align: left; \}/g, '')
    .replace(/\.data-table-2level thead th \{ text-align: center; \}/g, '')
    .replace(/\.data-table-2level thead th:first-child \{ text-align: left; \}/g, '')
    .replace(/\.data-table-2level thead tr:nth-child\(2\) th \{ text-align: center; \}/g, '')
    .replace(/\.data-table tbody tr td:nth-child\(2\):not\(\.num\),[\s\S]*?\}/g, '')
    .replace(/\.data-table thead tr th:nth-child\(2\),[\s\S]*?\}/g, '')
    .replace(/\.data-table th:not\(\.num\),[\s\S]*?\}/g, '')
    .replace(/\.data-table td\.dac-yes \{[^}]*\}/g, '')
    .replace(/\.data-table th, \.data-table td \{ (?:text-align: left; )?padding: 6px 10px;[^}]*\}/g, '')
    .replace(/\.data-table td\.num \{ font-family: var\(--font-mono\);[^}]*\}/g, '')
    .replace(/\.ingest-cell-num \{ text-align: (?:right|center); \}/g, '')
    .replace(/\.ingest-cell-text \{ text-align: (?:left|center); \}[^\n]*/g, '')
    .replace(/\.ingest-cell-calc-text \{ text-align: (?:left|center); \}[^\n]*/g, '')
    .replace(/text-align: (?:right|center);\s*\n?\s*font-weight: 600;/g, 'CALCBOX')
    .replace(/\.edit-table\.is-definitions th,[\s\S]*?\}/g, '')
    .replace(/\/\* and the viewer's second header line centres[\s\S]*?\*\//g, '')
    .replace(/\/\* Force first column always left[^*]*\*\//g, '')
    .replace(/\/\* Force ALL non-numeric cells[^*]*\*\//g, '')
    /* CLCPA-264: the import identity advisory's own rule, named so this
     * stripper stays exact rather than becoming tolerant. */
    .replace(/\/\* CLCPA-264: the import identity advisory[\s\S]*?\.ingest-staged-warn \{[\s\S]*?\}/g, '')
    /* CLCPA-266: the notice-box component and the restyled staged warning,
     * named so this stripper stays exact rather than becoming tolerant. */
    .replace(/\/\* ---- CLCPA-266: every post-load notice is a BOX[\s\S]*?\.ingest-import-notice > :last-child \{ margin-bottom: 0; \}/g, '')
    .replace(/\/\* CLCPA-264's import identity advisory, restyled by CLCPA-266[\s\S]*?font-weight: 500;\s*\}/g, '')
    .replace(/\/\* CLCPA-264: the import identity advisory\.[\s\S]*?font-weight: 500;\s*\}/g, '')
    .replace(/\.ingest-import-result \{[\s\S]*?\.ingest-import-result li \{[^}]*\}/g, '')
    .replace(/\s+/g, ' ').trim();
  ok(strip248(styles) === strip248(baseStyles),
     'X6 styles.css differs only by CLCPA-248s rules: the tooltip added none');
});

guard('X: item 3 closes at ZERO, measured not assumed', () => {
  let cost = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).forEach(y => {
      const rows = t.data[y]; if (!rows || !rows.length) return;
      const schema = (t.schema_by_year || {})[y] || null;
      const before = NEW.totalRowFlags(rows.map(r => r.slice()), id, schema) || [];
      const mut = rows.map(r => r.slice());
      try { NEW.recomputeTotals(mut, schema, id, []); } catch (e) { }
      const after = NEW.totalRowFlags(mut, id, schema) || [];
      before.forEach((f, i) => { if (f && !after[i]) cost.push(id + ':' + y + ' r' + i); });
    });
  });
  ok(cost.length === 0,
     'X7 recompute-before-flags costs ZERO flags on stored data' +
     (cost.length ? ': ' + cost.slice(0, 5).join(', ') : '') +
     '  -- which is why the proper fix is not bought');
});

guard('X: the blast radius', () => {
  const names = [...new Set((SRC.match(/(?:^|\r\n)[ \t]*(?:async )?function (\w+)\s*\(/g) || [])
    .map(m => /function (\w+)/.exec(m)[1]))];
  const changed = names.filter(n => grabFn(n) !== grabFn(n, BASE_SRC));
  say('       changed: ' + changed.sort().join(', '));
  const EXPECT = {
    /* re-pinned, named so the count stays exact */
    xlsxInstructionBlocks: 'NOT this ticket: CLCPA-282 operator-prose sweep: the workbook instructions and one rejection message say how many heading rows a table has',
    /* re-pinned, named so the count stays exact */
    ingestStagedSummary: 'NOT this ticket: CLCPA-300: the staged summary counts the columns that receive values',
    /* re-pinned, named so the count stays exact */
    derivedPctCols: 'NOT this ticket: CLCPA-294: a declared percentage column is always scaled, never guessed by value size',
    fmtDerivedCell: 'NOT this ticket: CLCPA-294: a declared percentage column is always scaled, never guessed by value size',
    formatCell: 'NOT this ticket: CLCPA-294: a declared percentage column is always scaled, never guessed by value size',
    /* re-pinned, named so the count stays exact */
    xlsxCell: 'NOT this ticket: CLCPA-274 option (c): a populated year exports its values, and a number is written as a number',
    /* CLCPA-291, named so the count stays exact */
    ingestTextOnlyColumn: 'NOT this ticket: CLCPA-291: a text column in a structure row is (no value), not (calculated) (new)',
    /* CLCPA-311 / D-04, named so the count stays exact */
    renderSectionD: 'NOT this ticket: CLCPA-311 / D-04: the LMI share is read from the figure D3 files instead of being computed out of a null, which printed 0.0% on every stored year',
    /* CLCPA-304, named so the count stays exact */
    parseB2Plugs: 'NOT this ticket: CLCPA-304: Section Bs plug counts read the shared schema reader, so a year created by import stops parsing every count as zero',
    /* CLCPA-307 and CLCPA-310, named so the count stays exact */
    unitNoticeValue: 'NOT this ticket: CLCPA-310: the fraction advisory formats the value it shows, so a floating point artifact stops reaching operator-facing text (new)',
    /* CLCPA-302, named so the count stays exact */
    diffRows: 'NOT this ticket: CLCPA-302: the history counts operator changes only, applying the same two exclusions the Confirm-save dialog applies, so the record and the sentence the operator approved cannot disagree',
    resolveTablePrivileges: 'NOT this ticket: CLCPA-302, and the NAME is the extractors doing rather than mine: grabFn over-reads this function by 42kB and its slice swallows the dvBackend saveTable whose diffRows call now passes tableId. The function itself is byte-identical, 2376 bytes on both builds',
    /* CLCPA-319, named so the count stays exact */
    isTotalOnlyDerived: 'NOT this ticket: CLCPA-319: G1 to G9s total row is computed from the rows beneath it, so the report follows its own figures instead of showing a stored copy (a columnTotal is derived on the total row alone)',
    /* CLCPA-293 / A-10, named so the count stays exact */
    ingestRebuildableTotals: 'NOT this ticket: CLCPA-293 / A-10: a total the engine cannot derive is accepted from the preparer instead of being discarded in silence (new: it asks the engine which totals it can rebuild)',
    renderPreparerTotalsNotice: 'NOT this ticket: CLCPA-293 / A-10: a total the engine cannot derive is accepted from the preparer instead of being discarded in silence (new: the advisory that names one)',
    /* CLCPA-241 advisory, named so the count stays exact */
    renderKeptFigureNotice: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (new: the amber advisory that names a kept figure)',
    /* CLCPA-241 option (B), named so the count stays exact */
    applyDerivedCols: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten',
    stripDerivedForPersist: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (the strip refuses a kept cell)',
    derivedCellWrite: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (new)',
    derivedFiledReproduced: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (new)',
    unreconciledDerivedCols: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (new)',
    /* CLCPA-287 round 2, named so the count stays exact */
    ingestKeyColDescription: 'NOT this ticket: CLCPA-287 round 2: a key-column rejection names an unheaded column by role, not by its empty heading (new)',
    /* CLCPA-292 round 2, named so the count stays exact */
    ingestTemplateSource: 'NOT this ticket: CLCPA-292 round 2: a fresh-year template borrows its structure from a PUBLISHED year, never from a scratch one',
    /* CLCPA-282, named so the count stays exact */
    ingestHeaderKeys: 'NOT this ticket: CLCPA-282: a column on a two-level table is identified by its header PAIR (new)',
    ingestHeaderName: 'NOT this ticket: CLCPA-282: a column on a two-level table is identified by its header PAIR, and this names one for a message (new)',
    /* CLCPA-283, named so the count stays exact */
    isYearProtected: 'NOT this ticket: CLCPA-283: a year the operator added is removable, data and all; protection is seed-year only',
    boot: 'NOT this ticket: CLCPA-283: a year the operator added is removable, data and all; protection is seed-year only (the seedYears note it carries)',
    /* CLCPA-301, named so the count stays exact */
    applyIngestImport: 'NOT this ticket: CLCPA-301: the import path computes the row total the importer deliberately left blank',
    fillDerivableSumsOnImport: 'NOT this ticket: CLCPA-301: the import path computes the row total the importer deliberately left blank (new)',
    /* CLCPA-281 round 3, named so the count stays exact */
    storedHeaderRowsInYear: 'NOT this ticket: CLCPA-281 round 3: the read-only surfaces ask the per-year header question through storedHeaderRowsInYear (new)',

    /* CLCPA-269 r2, 270, 274, 275, 276, 277, 278 -- the review follow-up package of 2026-09-17. */

    ingestRowIsStoredHeader: 'CLCPA-274 round 3: is this row a stored header, by its blank label (new)',
    ingestYearCarriesHeaderRows: 'CLCPA-274 round 3: does THIS year carry them, or must it borrow (new)',
    ingestStoredHeaderRows: 'CLCPA-274 round 3: the table\'s own header rows, from a year that has them (new)',
    columnGrandTotals: 'CLCPA-278 round 3: and the engine\'s own summing, which is how recomputeTotals adds',
    ingestHeaderRowCount: 'CLCPA-274 round 2: how many leading data[] rows are really header, shared by the editor and the template writer (new)',
    rerenderIngestEditor: 'CLCPA-276 round 2: the editor repaint now repaints the notice mount beside it',
    ingestRoleOpen: 'CLCPA-270 amendment (the A8 ruling): the value half of the protection follows derivability (new)',
    ingestRowRole: 'CLCPA-270: the row role, from its label (new)',

    isTotalRoleLabel: 'CLCPA-270: the total-role label test (new)',

    isComputedShareLabel: 'CLCPA-270: a percentage OF A TOTAL (new)',

    rowSumIsConsistent: 'CLCPA-278: whose figure is this total (new)',

    recomputeDerivableSums: 'CLCPA-278: a consistent total follows the edit (new)',

    clearIngestNotices: 'CLCPA-276: one helper for every notice exit (new)',

    declaredYearFromFilename: 'CLCPA-277: the year token in a filename (new)',

    importYearNotice: 'CLCPA-277: the wrong-year advisory (new)',

    /* CLCPA-250, 267, 271, 272, 273 -- the eight-ticket wave of 2026-09-16. */

    shiftSchemaYears: 'CLCPA-267: the borrowed-schema year shift (new)',

    getTableSchema: 'CLCPA-267: its fallback shifts the donor year',

    isPercentLiteral: 'CLCPA-273: the percent predicate, lifted out of buildIngestImport (new)',

    noteTypedPercent: 'CLCPA-273: records a percent typed into a cell (new)',

    renderTypedUnitNotice: 'CLCPA-273: the typed advisory, in the amber box (new)',

    refreshIngestNotices: 'CLCPA-273: repaints the notice mount in place (new)',

    wireIngestEditor: 'CLCPA-273: the blur handler reads the text before the parse',

    loadIngestDraft: 'CLCPA-273: clears the typed advisories on a table-year change',

    renderIngestImport: 'CLCPA-273 and CLCPA-272: the mount carries both advisories',

    refreshIngestCalcCells: 'CLCPA-271: calc cells keep their column format on repaint',

    dacDerivedTablesForYear: 'CLCPA-250: one year of display tables (new)',

    recomputeYearDerived: 'CLCPA-250: the composer KPI pass, re-runnable (new)',

    recomposeYearIfComposed: 'CLCPA-250: the composed-source gate (new)',

    composePayloadFromRows: 'CLCPA-250: it resolves a schema through getTableSchema',

    buildYearSelector: 'CLCPA-250: a year change re-derives that year',

    detectSumColumns: 'CLCPA-272: the schema-derived sum relationship (new)',

    reconcileSumColumns: 'CLCPA-272: the reconciliation itself (new)',

    renderReconcileNotice: 'CLCPA-272: the reconciliation advisory box (new)',
    totalRowFlags: 'the general label veto',
    isAnchoredTotalRowLabel: 'the anchored-suffix predicate (new)',
    renderIngestEditor: 'the label tooltip: data-label-tip, no native title',
    /* CLCPA-248 landed after this ticket and against the same BASE: the two
     * compare panels now share one colgroup. Three functions, each named so
     * this suite's count stays exact rather than being relaxed. */
    renderTable: 'NOT this brief: CLCPA-248, the colgroup and the text wrap',
    compareColWidths: 'NOT this brief: CLCPA-248, the shared width vector (new)',
    renderSourceTables: 'NOT this brief: CLCPA-248, it computes that vector',
    isWhollyNumeric: 'NOT this brief: CLCPA-248 round 3: the wrap predicate (new). isNumeric itself untouched',
    /* Section C group A, not this ticket's, each named so the count stays exact */
    ingestComputed: 'NOT this ticket: CLCPA-253: the (calculated) marker is column-aware',
    dacCol: 'NOT this ticket: CLCPA-257, Section C group C: dacCols newest-year fallback',
    phantomSpacerCols: 'NOT this ticket: CLCPA-260, Section C group D: the phantom spacer columns, new',
    buildIngestWorkbook: 'NOT this ticket: CLCPA-260, Section C group D: the phantom spacer columns, the template stops emitting them',
    /* Section C group B, not this ticket's */
    tableCaption: 'NOT this ticket: CLCPA-252, the caption helper',
    deriveTableCaption: 'NOT this ticket: CLCPA-252 round 2: a fresh year DERIVES its title instead of falling back to short_title (new)',
    stripCaptionYear: 'NOT this ticket: CLCPA-252 round 3: the caption year strip (new)',
    deriveTableCaptionInfo: 'NOT this ticket: CLCPA-252 round 2, the three strategies (new)',
    renderSectionC: 'NOT this ticket: CLCPA-259, the panel reads C1',
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
    /* ROUND 2, by ruling: the native title became the dashboard s own
     * tooltip, which needs a wiring, a call site, and the CLCPA-242
     * ownership entry. Three more functions, each named. */
    wireIngestLabelTips: 'round 2, the shared-tooltip wiring (new)',
    wireIngestPage: 'round 2, it calls that wiring',
    wireControlTips: 'round 2, the ingest label joins OWNS_TIP',
    /* Section C group E, not this ticket's, each named so the count stays exact */
    isDeclaredSummable: 'NOT this ticket: CLCPA-254: the declared-summable column (new)',
    recomputeTotals: 'NOT this ticket: CLCPA-254: it consults that declaration, and X4 above pins the rest of it to BASE',
    buildIngestImport: 'NOT this ticket: CLCPA-261: it collects the fraction notices',
    renderIngestImportResult: 'NOT this ticket: CLCPA-261: the import summary announces them',
  };
  changed.forEach(n => ok(n in EXPECT, 'the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  /* 6 -> 9: CLCPA-248 added three, every one named above. */
  /* 9 -> 10: CLCPA-248 round 3 added isWhollyNumeric. */
  /* 19 -> 23: Section C group E moved four this suite can see. */
  /* 23 -> 25: CLCPA-252 round 2 added two, both named above. */
  /* 25 -> 28: CLCPA-264 added two and moved stagedBlock, all named above. */
  /* 28 -> 33: CLCPA-263 moved five, all named above. */
  /* 52 -> 60: the review follow-up package moved 8 more, every one of them named in the map above. The delta equals the number of entries added to that map, so nothing entered this count unattributed. */
  /* +1: the A8 ruling added ingestRoleOpen, named in the map above. */
  /* +2: CLCPA-274 round 2 added ingestHeaderRowCount and CLCPA-276
   * round 2 moved rerenderIngestEditor, both named in the map above. */
  /* 63 -> 67: CLCPA-274 round 3, CLCPA-281 and CLCPA-278 round 3,
   * every one named in the map above. */
  ok(changed.length === 97, 'X8 exactly this many functions changed: ' + changed.length);
});

guard('X: the baseline', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X9 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: REPO }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'X10 and an ancestor of HEAD');
});

lines.forEach(l => console.log(l));
console.log('');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n\n  ' + pass + ' passed, ' + fail + ' failed\n');
process.exitCode = fail ? 1 : 0;
