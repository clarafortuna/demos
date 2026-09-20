/* CLCPA-278 round 3: one shared reader for "what number is in this cell".
 *
 * THE REPRODUCTION, on BOTH provenances, digit by digit, on the shipped build:
 *
 *   user-added 2099, all-numeric row   -> recomputes to 599   NOT the defect
 *   seed 2025, all-numeric row         -> recomputes to 1809  NOT the defect
 *   any year, a component that is a
 *     NUMERIC-LOOKING STRING           -> total FROZEN at 1098
 *                                         advisory "filed 1098 ... = 599"
 *
 * So year provenance is NOT the differentiator: cell TYPE is. User-added years
 * are simply where non-numeric cells arise -- their values come by import or
 * from the composed Dataverse path, and parseNumericInput returns the ORIGINAL
 * TEXT when it cannot parse ("1 098", "(999)"), by design.
 *
 * THE CAUSE. rowSumIsConsistent required every component to be typeof number.
 * One numeric-looking string made the row unjudgeable, so the total was kept as
 * the preparer's -- and after the edit the row was fully numeric again, so the
 * CLCPA-272 advisory fired on the very figure the engine had declined to
 * maintain. Two functions disagreeing about one row.
 *
 * THE FIX, per the ruling: ONE helper, bareNumber, consumed by all three --
 * rowSumIsConsistent, reconcileSumColumns, and the engine's own summing in
 * columnGrandTotals, which is how recomputeTotals adds (directly and through
 * totalRowSums, which delegates there for every segment). No per-function
 * copies.
 *
 * WHAT IT STILL REFUSES: an explicit percent is a UNIT (CLCPA-244) and a split
 * cell is published text (CLCPA-216). Both stay unreadable, so a row holding
 * one is still unjudgeable, the filed total is still kept, and the advisory
 * still names it -- asserted on both provenances below.
 *
 * BASE predates the change: 72f1591, CLCPA-281.
 *
 * Run:  node suite_278_r3.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { boot } = require('../_kit/live_editor.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || '72f1591';
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

/** type a number the way an operator does: one input event per keystroke */
const dbd = (H, r, c, digits) => {
  const el = H.cell(r, c);
  if (!el) throw new Error('no cell at ' + r + ',' + c);
  let acc = '';
  digits.split('').forEach((d) => { acc += d; el.value = acc; el.dispatchEvent({ type: 'input' }); });
  el.dispatchEvent({ type: 'blur' });
};
/** a SEED year carrying the row under test */
const seed = (src, row) => {
  const pay = JSON.parse(JSON.stringify(P));
  pay.tables.H1.data['2025'] = [row.slice(), ['Grand Total', 99, 999, 1098]];
  return boot({ payload: pay, tableId: 'H1', year: '2025', src: src });
};
/** a USER-ADDED year carrying the row under test, created and saved as the operator does */
const added = (src, row) => {
  const H = boot({ payload: JSON.parse(JSON.stringify(P)), tableId: 'H1', year: '2025', src: src });
  H.addYear('2099');
  H.state().payload.tables.H1.data['2099'] = [row.slice(), ['Grand Total', 99, 999, 1098]];
  H.api.loadIngestDraft();
  H.repaintPage();
  return H;
};
const says = (H) => (H.noticeText() || '').indexOf('Does not add up') >= 0;
const NUMS = ['Manhattan', 99, 999, 1098];
const STRPART = ['Manhattan', 99, '999', 1098];
const PCTPART = ['Manhattan', 99, '33%', 1098];
const TEXTPART = ['Manhattan', 99, 'n/a', 1098];

log('======================================================================');
log('CLCPA-278 round 3 -- one reader, three consumers');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. what does NOT differentiate: the year ---------------------------- */
log('');
log('A. PROVENANCE IS NOT THE DIFFERENTIATOR');
guard('A-block', () => {
  const a = added(BASE_SRC, NUMS);
  ok(a.provenance('2099') === 'user-added', 'A1 2099 is user-added');
  dbd(a, 0, 2, '500');
  ok(a.draft()[0][3] === 599,
    'A2 and on BASE an all-numeric row there RECOMPUTES -- ' + JSON.stringify(a.draft()[0]));
  const s = seed(BASE_SRC, NUMS);
  dbd(s, 0, 2, '500');
  ok(s.draft()[0][3] === 599, 'A3 exactly as it does on a seed year');
});

/* ---- B. what does: the cell type ---------------------------------------- */
log('');
log('B. THE DEFECT, ON BOTH PROVENANCES, ON BASE');
guard('B-block', () => {
  [['seed', seed], ['user-added', added]].forEach(([name, mk]) => {
    const H = mk(BASE_SRC, STRPART);
    dbd(H, 0, 2, '500');
    ok(H.draft()[0][3] === 1098,
      'B1.' + name + ' a numeric-STRING component freezes the total at 1098 -- ' +
      JSON.stringify(H.draft()[0]));
    ok(says(H), 'B2.' + name + ' and the advisory fires on it');
  });
});

/* ---- C. the fix ---------------------------------------------------------- */
log('');
log('C. THE FIX, ON BOTH PROVENANCES');
guard('C-block', () => {
  [['seed', seed], ['user-added', added]].forEach(([name, mk]) => {
    const H = mk(SRC, STRPART);
    dbd(H, 0, 2, '500');
    ok(H.draft()[0][3] === 599,
      'C1.' + name + ' the total now follows the edit -- ' + JSON.stringify(H.draft()[0]));
    ok(!says(H), 'C2.' + name + ' and nothing is advised: the row adds up');
  });
});

/* ---- D. the kept-figure half must NOT regress (condition 4) -------------- */
log('');
log('D. A GENUINELY UNREADABLE CELL STILL KEEPS THE FILED TOTAL');
guard('D-block', () => {
  [['seed', seed], ['user-added', added]].forEach(([name, mk]) => {
    /* an explicit percent is a UNIT, not a number (CLCPA-244) */
    let H = mk(SRC, PCTPART);
    dbd(H, 0, 1, '42');
    ok(H.draft()[0][3] === 1098,
      'D1.' + name + ' a percent component leaves the filed total alone -- ' +
      JSON.stringify(H.draft()[0]));
    ok(says(H), 'D2.' + name + ' and the advisory names it');
    /* and ordinary text */
    H = mk(SRC, TEXTPART);
    dbd(H, 0, 1, '42');
    ok(H.draft()[0][3] === 1098, 'D3.' + name + ' text, the same');
    ok(says(H), 'D4.' + name + ' advisory, the same');
  });
});

/* ---- E. ONE reader, three consumers (condition 1) ----------------------- */
log('');
log('E. ONE HELPER, NO PER-FUNCTION COPIES');
guard('E-block', () => {
  const code = codeOnly(SRC);
  ok(/function bareNumber\(v\) \{/.test(code), 'E1 the reader is a named function');
  const uses = (code.match(/bareNumber\(/g) || []).length;
  ok(uses >= 6, 'E2 and it is consumed, not declared and ignored -- ' + uses + ' references');
  const fnOf = (n) => {
    const i = code.indexOf('function ' + n + '(');
    return i < 0 ? '' : code.slice(i, code.indexOf('\n  }', i));
  };
  ['rowSumIsConsistent', 'reconcileSumColumns', 'columnGrandTotals'].forEach((n) => {
    ok(/bareNumber\(/.test(fnOf(n)), 'E3.' + n + ' consumes it');
    ok(!/typeof [\w.[\]]+ === 'number'/.test(fnOf(n)),
      'E4.' + n + ' and carries no private copy of the test');
  });
  /* columnGrandTotals is how recomputeTotals adds, directly and through
   * totalRowSums -- so naming it is naming recomputeTotals */
  ok(/columnGrandTotals\(/.test(fnOf('totalRowSums')),
    'E5 totalRowSums delegates to it, so every segment reads the same way');
});

/* ---- F. the conventions it must not break ------------------------------- */
log('');
log('F. WHAT THE READER REFUSES');
guard('F-block', () => {
  const H = seed(SRC, NUMS);
  const f = H.api.bareNumber;
  ok(typeof f === 'function', 'F0 the reader is reachable');
  [[1098, 1098, 'a number'], ['1098', 1098, 'a plain numeric string'],
   ['1,098', 1098, 'thousands separators'], [' 999 ', 999, 'padding'],
   ['-5', -5, 'a negative'], ['1098.5', 1098.5, 'a decimal']].forEach(([v, want, what]) => {
    ok(f(v) === want, 'F1 reads ' + what + ': ' + JSON.stringify(v) + ' -> ' + f(v));
  });
  [['33%', 'an explicit percent is a UNIT (CLCPA-244)'],
   ['37,988 (33%)', 'a SPLIT cell is published text (CLCPA-216)'],
   ['1 098', 'a space separator it cannot claim to understand'],
   ['(999)', 'an accounting negative'], ['Total', 'a label'],
   ['', 'empty'], [null, 'null'], [undefined, 'undefined'],
   [NaN, 'NaN'], [Infinity, 'Infinity']].forEach(([v, what]) => {
    ok(f(v) === null, 'F2 refuses ' + what + ': ' + JSON.stringify(v));
  });
  /* it must never salvage a numeric PREFIX, which is how "37,988 (33%)" would
   * have become 37988 and a published split cell a number */
  ok(f('1098 apples') === null, 'F3 and never salvages a prefix');
});

/* ---- G. zero effect on stored data (condition 2, the half I can read) --- */
log('');
log('G. WHAT THIS CHANGES IN THE STORED PAYLOAD: NOTHING');
guard('G-block', () => {
  const NOW = boot({ payload: P, tableId: 'H1', year: '2025', src: SRC });
  const WAS = boot({ payload: P, tableId: 'H1', year: '2025', src: BASE_SRC });
  const f = NOW.api.bareNumber;
  let strCells = 0, newly = 0, examples = [];
  Object.keys(P.tables).forEach((id) => {
    const t = P.tables[id];
    Object.keys(t.data || {}).forEach((y) => {
      (t.data[y] || []).forEach((r) => {
        (r || []).slice(1).forEach((v) => {
          if (typeof v === 'string' && v !== '') {
            strCells++;
            if (f(v) !== null) { newly++; if (examples.length < 3) examples.push(id + ':' + y + ' ' + JSON.stringify(v)); }
          }
        });
      });
    });
  });
  ok(strCells > 600, 'G1 payload.json holds ' + strCells + ' string value cells');
  ok(newly === 0,
    'G2 and NONE of them becomes readable -- ' + newly + (examples.length ? ': ' + examples.join(' ') : ''));
  /* the engine's own output, every stored table-year */
  let n = 0, moved = [], advMoved = [];
  Object.keys(P.tables).forEach((id) => {
    const t = P.tables[id];
    Object.keys(t.data || {}).forEach((y) => {
      const sc = NOW.api.getTableSchema(t, y);
      if (!sc || !sc.length) return;
      n++;
      const a = JSON.parse(JSON.stringify(t.data[y])), b = JSON.parse(JSON.stringify(t.data[y]));
      try { NOW.api.recomputeTotals(a, sc, id, null); } catch (e) {}
      try { WAS.api.recomputeTotals(b, sc, id, null); } catch (e) {}
      if (JSON.stringify(a) !== JSON.stringify(b)) moved.push(id + ':' + y);
      const ra = NOW.api.reconcileSumColumns(t.data[y], sc, id) || [];
      const rb = WAS.api.reconcileSumColumns(t.data[y], sc, id) || [];
      if (ra.length !== rb.length) advMoved.push(id + ':' + y);
    });
  });
  ok(n === 149, 'G3 compared across ' + n + ' stored table-years');
  /* RE-PINNED: CLCPA-241 gave A9 a DERIVED_COLS rule, so recomputeTotals now
   * has derived columns to write there where it had none. A9's two stored
   * years are named; every other table must still be identical. */
  ok(JSON.stringify(moved.sort()) === JSON.stringify(['A9:2024', 'A9:2025']),
    'G4 recomputeTotals writes identical figures except A9, for CLCPA-241 -- ' +
    (moved.length ? moved.join(',') : 'every one'));
  ok(advMoved.length === 0,
    'G5 and the advisory count is unchanged everywhere -- ' +
    (advMoved.length ? advMoved.join(',') : 'every one'));
  /* THE OTHER HALF OF CONDITION 2 IS NOT MEASURED HERE. The org store holds
   * the user-added years, and reading it needs an authenticated run this
   * session was not authorised to make. Reported as MISSING, never estimated. */
});

/* ---- H. the behavioural surface on drafts (condition 3) ----------------- */
log('');
log('H. THE DRAFT SURFACE, SHAPE BY SHAPE');
guard('H-block', () => {
  const shapes = [
    ['all numbers', NUMS, 599, false, 599, false],
    ['numeric-string component', STRPART, 1098, true, 599, false],
    ['percent component', PCTPART, 1098, true, 1098, true],
    ['text component', TEXTPART, 1098, true, 1098, true],
  ];
  shapes.forEach(([label, row, wasTotal, wasAdv, nowTotal, nowAdv]) => {
    const a = seed(BASE_SRC, row), b = seed(SRC, row);
    dbd(a, 0, row === NUMS || row === STRPART ? 2 : 1, '500');
    dbd(b, 0, row === NUMS || row === STRPART ? 2 : 1, '500');
    ok(a.draft()[0][3] === wasTotal && says(a) === wasAdv,
      'H1 ' + label + ' BEFORE: total ' + JSON.stringify(a.draft()[0][3]) +
      ', advisory ' + says(a));
    ok(b.draft()[0][3] === nowTotal && says(b) === nowAdv,
      'H2 ' + label + ' AFTER:  total ' + JSON.stringify(b.draft()[0][3]) +
      ', advisory ' + says(b));
  });
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha');
  const src = fs.readFileSync(path.join(REPO, 'Coned/CLCPA/tickets/_kit/live_editor.js'), 'utf8');
  const t = /typeInCell: \(r, c, value\) => \{[\s\S]*?\n    \},/.exec(src);
  ok(!!t && t[0].indexOf("type: 'input'") < t[0].indexOf("type: 'blur'"),
    'X2 the driver sends input before blur');
  /* and this suite types digit by digit, which is the gesture round 2 missed */
  ok(/digits\.split\('' \)\.forEach|digits\.split\(''\)\.forEach/.test(self),
    'X3 and every edit here is typed one keystroke at a time');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-278-r3-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
