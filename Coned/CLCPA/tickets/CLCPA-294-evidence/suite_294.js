/* CLCPA-294: a computed percentage is always scaled, never guessed.
 *
 * THE GESTURE, in a real browser on a served build, A1 on a user-added year,
 * five rows chosen to straddle the heuristic's boundary. Both surfaces:
 *
 *   parts        ratio    BEFORE      AFTER
 *   333 / 888    0.375    37.5%       37.5%
 *   333 / 333    1        100.0%      100.0%
 *   777 / 333    2.333    2.3%   X    233.3%
 *   555 / 0.1    5550     5550.0% X   555000.0%
 *   500 / 100000 0.005    0.5%        0.5%
 *
 * THE CAUSE: `Math.abs(v) <= 1 ? v * 100 : v`. A value at or below 1 is taken
 * for a fraction and scaled; anything larger is assumed already a percentage.
 * On a COMPUTED ratio that guess is simply wrong -- the engine always produces
 * a fraction -- and it turns a DAC share above 100% into a small number, which
 * is exactly the anomaly those cells are read to catch.
 *
 * THE TICKET'S BOUNDARY IS SLIGHTLY OFF, and it is worth recording: a ratio of
 * EXACTLY 1 rendered correctly, because `<= 1` includes it. Only a ratio
 * strictly greater than 1 was mangled.
 *
 * WHY ALWAYS-SCALING IS SAFE, measured: across A1, A2 and A8, all 227 stored
 * values in these columns are fractions and NOT ONE is above 1. Stored and
 * computed hold the same units, so the column can be scaled by its declared
 * type rather than each value by its size.
 *
 * BASE predates the change: c99be38.
 *
 * Run:  node suite_294.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { boot } = require('../_kit/live_editor.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || 'c99be38';
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

function grab(name, src) {
  const anchor = '\r\n  function ' + name + '(';
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error('grab: no function ' + name);
  let j = src.indexOf('{', i), d = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) { j = k; break; } }
  }
  return src.slice(i + 2, j + 1);
}

const ROWS = [
  ['Below one', 888, 333, null],
  ['Exactly one', 333, 333, null],
  ['Above one', 333, 777, null],
  ['Far above', 0.1, 555, null],
  ['Small share', 100000, 500, null],
];
/** render A1 on a user-added year through the real display path */
const shown = (src) => {
  const pay = JSON.parse(JSON.stringify(P));
  pay.meta.years = ['2098'].concat(pay.meta.years);
  pay.tables.A1.data['2098'] = ROWS.map(r => r.slice());
  const H = boot({ payload: pay, tableId: 'A1', year: '2098', src: src });
  const sch = H.api.getTableSchema(P.tables.A1, '2025');
  return H.api.rowsForDisplay(pay.tables.A1.data['2098'], sch, 'A1');
};

log('======================================================================');
log('CLCPA-294 -- a computed percentage is always scaled');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the defect, on the build that shipped it ----------------------- */
log('');
log('A. THE GUESS, ON BASE');
guard('A-block', () => {
  const code = codeOnly(BASE_SRC);
  ok(/if \(d\.type === 'percentage'\) return \(Math\.abs\(v\) <= 1 \? v \* 100 : v\)/.test(code),
    'A1 the editor calc cell guessed by size');
  ok(/return \(Math\.abs\(c\) <= 1 \? c \* 100 : c\)\.toFixed\(1\) \+ '%';/.test(code),
    'A2 and so did the rendered table');
  ok(!/function derivedPctCols/.test(code),
    'A3 nothing asked what the COLUMN was declared to be');
});

/* ---- B. the values, through the real display path ---------------------- */
log('');
log('B. WHAT THE ENGINE PRODUCES, AND WHAT IS SHOWN');
guard('B-block', () => {
  const r = shown(SRC);
  const ratios = r.map(x => x[3]);
  /* the engine's own ratios are unchanged: this ticket is about FORMATTING */
  const b = shown(BASE_SRC).map(x => x[3]);
  ok(JSON.stringify(ratios) === JSON.stringify(b),
    'B1 the computed ratios themselves did NOT move -- ' + JSON.stringify(ratios));
  ok(Math.abs(ratios[0] - 0.375) < 1e-9, 'B2 333/888 is 0.375');
  ok(ratios[1] === 1, 'B3 333/333 is exactly 1');
  ok(Math.abs(ratios[2] - 7 / 3) < 1e-9, 'B4 777/333 is 2.333...');
  ok(Math.abs(ratios[4] - 0.005) < 1e-9, 'B5 500/100000 is 0.005');
});

/* ---- C. the formatter ---------------------------------------------------- */
log('');
log('C. THE FORMATTER SCALES BY THE COLUMN, NOT THE VALUE');
guard('C-block', () => {
  const code = codeOnly(SRC);
  ok(/function derivedPctCols\(tableId\) \{/.test(code),
    'C1 a declared-percentage set is derived from DERIVED_COLS');
  /* CALLED, not merely present. C1 asserts the function exists, which survives
   * a mutation that empties its body -- and one did, unnoticed, until this. */
  const H = new Function(
    grab('derivedPctCols', SRC) + '\n' +
    (function () {
      const i = SRC.indexOf('\r\n  const DERIVED_COLS = (function () {');
      const j = SRC.indexOf('\r\n  })();', i);
      return SRC.slice(i + 2, j + 8);
    })() +
    '\nreturn { derivedPctCols: derivedPctCols };')();
  const a1 = H.derivedPctCols('A1');
  /* RE-PINNED: CLCPA-241 made the entries carry their PRECISION rather than a
   * bare true, because A9's percent-change column must render at the zero
   * decimals its figures were filed with while A1 keeps the report's one.
   * Still asserting membership, and now the precision it must keep. */
  ok(a1 && a1[3] && a1[3].decimals === 1,
    'C1b and A1 column 3 really is in the declared set, at one decimal -- ' + JSON.stringify(a1));
  ok(Object.keys(H.derivedPctCols('H1') || {}).length === 0,
    'C1c while a table declaring no percentage has an empty set');
  /* RE-PINNED for CLCPA-241, which added the percentChange type to both
   * formatters. The ALWAYS-SCALED property this ticket exists to guarantee is
   * still what is pinned; only the set of types it covers grew. */
  ok(/if \(d\.type === 'percentage' \|\| d\.type === 'percentChange'\) \{\r?\n\s*return \(v \* 100\)\.toFixed\(d\.decimals \|\| 0\) \+ '%';/.test(code),
    'C2 the editor calc cell always scales: its input IS the engine ratio');
  ok(/if \(declaredPct\[colIdx\]\) return \(c \* 100\)\.toFixed\(declaredPct\[colIdx\]\.decimals\) \+ '%';/.test(code),
    'C3 and the rendered table scales a DECLARED percentage column always, at its declared precision');
  /* a column NOT declared keeps the old behaviour: stored source data in a
   * percent column is not guaranteed to be a fraction */
  ok(/return \(Math\.abs\(c\) <= 1 \? c \* 100 : c\)\.toFixed\(1\) \+ '%';/.test(code),
    'C4 while an undeclared percent column keeps the previous rule');
  /* fmtDerivedCell no longer guesses at all */
  ok(!/Math\.abs\(v\) <= 1 \? v \* 100 : v/.test(codeOnly(grab('fmtDerivedCell', SRC))),
    'C5 the derived formatter contains no size guess at all');
});

/* ---- D. why always-scaling is safe -------------------------------------- */
log('');
log('D. THE STORED YEARS, MEASURED');
guard('D-block', () => {
  let total = 0, overOne = 0, nonNumeric = 0;
  ['A1', 'A2', 'A8'].forEach((id) => {
    const t = P.tables[id];
    const sch = t.schema_by_year['2025'];
    sch.forEach((h, c) => {
      if (!/%/.test(String(h || ''))) return;
      Object.keys(t.data || {}).forEach((y) => {
        (t.data[y] || []).forEach((r) => {
          const v = r[c];
          if (v == null || String(v).trim() === '') return;
          total++;
          if (typeof v !== 'number') { nonNumeric++; return; }
          if (Math.abs(v) > 1) overOne++;
        });
      });
    });
  });
  ok(total === 227, 'D1 227 stored values in these columns -- ' + total);
  ok(nonNumeric === 0, 'D2 every one of them is a number -- ' + nonNumeric + ' were not');
  ok(overOne === 0,
    'D3 and NOT ONE is above 1, so stored and computed hold the same units -- ' + overOne);
});

/* ---- E. what must not change -------------------------------------------- */
log('');
log('E. THE SURFACES THIS MUST NOT DISTURB');
guard('E-block', () => {
  const code = codeOnly(SRC);
  /* the KPI formatter takes an explicit `kind` and is not a table cell */
  ok(/if \(kind === 'pct'\) return \(Math\.abs\(v\) <= 1 \? v \* 100 : v\)\.toFixed\(1\) \+ '%';/.test(code),
    'E1 the KPI formatter is untouched: it takes an explicit kind, not a column');
  /* the engine itself did not move */
  /* RE-POINTED, not widened. This ticket changes FORMATTING and still changes
   * no derivation. What does touch rowsForDisplay, later in the same stack, is
   * CLCPA-290's un-totalled contract, which fills a live-calculated total row
   * and dashes the average columns. That ONE block is normalised away; every
   * other byte of the function still has to match. */
  const strip290 = (t) => t
    .replace(/\r\n    \/\* CLCPA-290: THE TOTAL ROW OF A LIVE-CALCULATED YEAR[\s\S]*?\r\n    \}\);/, '')
    .replace('function rowsForDisplay(rawRows, schema, tableId, opts) {',
      'function rowsForDisplay(rawRows, schema, tableId) {');
  ok(strip290(grab('rowsForDisplay', SRC)) === grab('rowsForDisplay', BASE_SRC),
    'E2 rowsForDisplay matches BASE apart from the CLCPA-290 total-row block: ' +
    'this ticket changes no derivation');
  /* CLCPA-241 moved recomputeTotals by exactly one line: it now hands the
   * BASELINE to applyDerivedCols, which is what lets an edited input recompute
   * while a figure the source never reproduced stays as filed. Named and
   * REVERSED, the way the other deltas in this file are, so every other byte
   * still has to match. */
  const RT_NEW_241 =
    '    /* CLCPA-241: the BASELINE travels with it, so an edited input recomputes\r\n' +
    '     * while a figure the SOURCE never reproduced is kept. */\r\n' +
    '    applyDerivedCols(draft, tableId, colSum, schema, baseline);';
  const RT_OLD_241 = '    applyDerivedCols(draft, tableId, colSum, schema);';
  /* CLCPA-293 round 4 adds one more, for the same kind of reason: a total
   * the B7 registry says belongs to the preparer is skipped by the additive
   * write, so a figure an import accepted survives the recompute and the
   * save instead of being overwritten an instant later. Named and reversed
   * beside CLCPA-241's line; every other byte still has to match. */
  const RT_NEW_B7 = '        if (isB7PreparerTotal(tableId, draft[idx][0], schema[c])) continue;\r\n';
  const rtNow = grab('recomputeTotals', SRC);
  ok(rtNow.split(RT_NEW_B7).length - 1 === 1,
    'E3a the CLCPA-293 round 4 line is present exactly once, so reversing it ' +
    'tests something');
  ok(rtNow.replace(RT_NEW_241, () => RT_OLD_241)
       .replace(RT_NEW_B7, () => '')
       .replace(/[ ]*\/\* CLCPA-293 round 4: THE SECOND SURFACE\.[\s\S]*?\*\/\r\n/, '') ===
     grab('recomputeTotals', BASE_SRC),
    'E3 and so is recomputeTotals, apart from CLCPA-241 passing the baseline ' +
    'and CLCPA-293 round 4 standing off a registry total');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha that predates the change');
  /* B compares the engine's output on BOTH builds: if a "formatting" fix had
   * quietly changed a computed value, this is what would say so. */
  ok(/const b = shown\(BASE_SRC\)/.test(self),
    'X2 the computed ratios are compared across both builds, not assumed stable');
  ok(fs.existsSync(path.join(__dirname, 'gesture_294.js')),
    'X3 the browser gesture is committed beside this suite');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-294-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
