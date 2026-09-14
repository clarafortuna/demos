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

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
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
say('=== T. the label tooltip =============================================');
guard('T: the label input carries a native title', () => {
  const ed = grabFn('renderIngestEditor');
  if (!ok(ed !== null, 'T0 renderIngestEditor was found')) return;
  const code = codeOnly(ed);
  ok(/const labelTitle = labelText\.trim\(\)/.test(code),
     'T1 a title is computed from the label text');
  ok(/title="\$\{escapeHtml\(labelText\)\}"/.test(code),
     'T2 and it is ESCAPED, like every other attribute here');
  ok(/\$\{labelTitle\}/.test(code), 'T3 and interpolated into the input');
  ok(!/title=/.test(codeOnly(grabFn('renderIngestEditor', BASE_SRC)) || ''),
     'T4 BASE had none, which is the rider');
});

guard('T: driven -- a long label gets a title, a blank one does not', () => {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const rows = [['A very long metric label that the editor would otherwise clip silently', 1, 2],
                ['', 3, 4]];
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
      if (!nm) { ok(false, 'T5 the editor would not assemble: ' + e.message); return; }
      if (grab(nm) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm) && cs.indexOf(nm) < 0) { cs.push(nm); continue; }
      ok(false, 'T5 cannot resolve ' + nm); return;
    }
    try { html = f(); break; }
    catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) { ok(false, 'T5 the editor threw: ' + e.message); return; }
      if (grab(nm) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm) && cs.indexOf(nm) < 0) { cs.push(nm); continue; }
      ok(false, 'T5 cannot resolve ' + nm + ' (call)'); return;
    }
  }
  if (!ok(html !== null, 'T5 the editor rendered')) return;
  ok(html.indexOf('title="A very long metric label that the editor would otherwise clip silently"') >= 0,
     'T6 the long label carries its full text as a title');
  const trs = html.match(/<tr[^>]*data-row="\d+"[\s\S]*?<\/tr>/g) || [];
  const blankRow = trs.find(tr => /data-row="1"/.test(tr));
  ok(blankRow && !/title=/.test(blankRow),
     'T7 and the blank label gets NO title rather than an empty one');
});

/* ===================== X: the exclusions =============================== */
say('');
say('=== X. what this ticket did NOT touch ================================');
guard('X: the family veto and the derive engine are untouched', () => {
  ok(grab('isHierarchicalTotalLabel') === grab('isHierarchicalTotalLabel', BASE_SRC),
     'X1 CLCPA-240 round 4s family predicate is byte-identical');
  ok(grab('isStrictTotalRowLabel') === grab('isStrictTotalRowLabel', BASE_SRC),
     'X2 and CLCPA-200s strict predicate');
  ok(grabConst('DERIVED_COLS') === grabConst('DERIVED_COLS', BASE_SRC),
     'X3 DERIVED_COLS is byte-identical');
  ok(grab('recomputeTotals') === grab('recomputeTotals', BASE_SRC),
     'X4 recomputeTotals is byte-identical: the ordering item is NOT bought here');
  ok(grab('parseNumericInput') === grab('parseNumericInput', BASE_SRC),
     'X5 and CLCPA-244s percent rule');
  const styles = fs.readFileSync(path.join(REPO,
    'Coned/CLCPA/ExecutiveDashboard_dev/styles.css'), 'utf8');
  const baseStyles = execSync('git show ' + BASE +
    ':"Coned/CLCPA/ExecutiveDashboard_dev/styles.css"',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
  ok(styles === baseStyles, 'X6 styles.css is byte-identical: the tooltip is native');
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
    totalRowFlags: 'the general label veto',
    isAnchoredTotalRowLabel: 'the anchored-suffix predicate (new)',
    renderIngestEditor: 'the label tooltip',
  };
  changed.forEach(n => ok(n in EXPECT, 'the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  ok(changed.length === 3, 'X8 exactly THREE functions changed: ' + changed.length);
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
