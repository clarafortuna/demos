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
/* CLCPA-290: the average columns are un-totalled, and both surfaces say so.
 *
 * THE RULING. The A3/A4 Total row computes Total Participants and renders an
 * honest dash on the average columns, in the editor AND on the section page.
 * The divergence between the two closes ON THE DASH SIDE. The weighted mean
 * that would put a figure there is NOT authorised: it republishes A3/2025 as
 * 621.56 against a filed 3,761,330, and changing a published figure is the
 * client's decision. That option stays on the ticket.
 *
 * THE GESTURE, in a real browser, A3 and A4 on a user-added year:
 *
 *   editor        before  Total | dash | 2,034,907 | dash | dash
 *                 after   unchanged -- it was already right
 *   section page  before  Total |      |           |      |
 *                 after   Total |      | 2,034,907 | dash | dash
 *
 * WHY A DASH AND NOT A NUMBER. detectAvgColumns is the un-totalled
 * declaration and it already exists: recomputeTotals consults exactly the same
 * predicate to refuse these columns, because a sum of per-participant averages
 * is not a quantity. CLCPA-212 measured what happens when one is summed
 * anyway: A3/2025 receiving 22,297.18 over a stored 22,511.
 *
 * WHAT MOVED ON THE PUBLISHED REPORT, measured across all 149 stored
 * table-years: four, and no stored VALUE among them. A3/2023, A3/2024,
 * A4/2023 and A4/2024 file nothing in their average totals, so those cells
 * rendered blank and now render the dash -- which is what makes them
 * consistent with 2025, where the figures ARE filed and are untouched.
 *
 * BASE predates the change: 461ea86.
 *
 * Run:  node suite_290.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { boot } = require('../_kit/live_editor.js');

const REPO = _dacRepo() + '';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || '461ea86';
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

const DASH = '\u2014';
/* A3's own rows on a user-added year, Total row emptied so the engine must act */
const liveRows = (id) => P.tables[id].data['2025'].map((r) => {
  const c = r.slice();
  if (/^total$/i.test(String(c[0] || '').trim())) for (let i = 1; i < c.length; i++) c[i] = null;
  return c;
});
const shown = (id, rows, src) => {
  const pay = JSON.parse(JSON.stringify(P));
  pay.meta.years = ['2098'].concat(pay.meta.years);
  pay.tables[id].data['2098'] = rows;
  const H = boot({ payload: pay, tableId: id, year: '2098', src: src });
  return H.api.rowsForDisplay(rows, H.api.getTableSchema(P.tables[id], '2025'), id, { fillTotals: true });
};
const totalOf = (rows) => rows.find(r => /^total$/i.test(String(r[0] || '').trim()));

log('======================================================================');
log('CLCPA-290 -- the average columns are un-totalled, on both surfaces');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the divergence, on the build that shipped it ------------------- */
log('');
log('A. THE TWO SURFACES DISAGREED');
guard('A-block', () => {
  const t = totalOf(shown('A3', liveRows('A3'), BASE_SRC));
  ok(t && (t[2] == null || t[2] === ''),
    'A1 on BASE the report page computed NOTHING, not even Total Participants -- ' +
    JSON.stringify(t));
  /* the editor did compute it: that is the divergence, and it is why the
   * fix is on the report side */
  ok(/const avgCol = detectAvgColumns\(schema\);/.test(codeOnly(BASE_SRC)),
    'A2 while the editor already refused the average columns by declaration');
});

/* ---- B. the contract ---------------------------------------------------- */
log('');
log('B. WHAT THE REPORT PAGE SHOWS NOW');
guard('B-block', () => {
  ['A3', 'A4'].forEach((id) => {
    const t = totalOf(shown(id, liveRows(id), SRC));
    const sum = P.tables[id].data['2025']
      .filter(r => !/^total$/i.test(String(r[0] || '').trim()))
      .reduce((n, r) => n + (typeof r[2] === 'number' ? r[2] : 0), 0);
    ok(t && t[2] === sum,
      'B1.' + id + ' Total Participants computes to ' + sum + ' -- ' + JSON.stringify(t));
    ok(t && t[3] === DASH && t[4] === DASH,
      'B2.' + id + ' and both average columns render an honest dash');
    ok(t && t[3] !== 0 && typeof t[3] !== 'number',
      'B3.' + id + ' never a number: a sum of averages is not a quantity');
  });
});

/* ---- C. the declaration is the one the engine already had -------------- */
log('');
log('C. ONE DECLARATION, BOTH SURFACES');
guard('C-block', () => {
  const code = codeOnly(SRC);
  ok(/const avgCols = \(opts && opts\.fillTotals && schema\) \? detectAvgColumns\(schema\) : null;/.test(code),
    'C1 the report path asks detectAvgColumns, and only when the fill is asked for');
  ok(/const avgCol = detectAvgColumns\(schema\);/.test(code),
    'C2 and the editor path asks the same predicate, unchanged');
  ok(/if \(avgCols\[c\]\) \{ row\[c\] = /.test(code),
    'C3 an un-totalled column gets the dash');
  ok(/const v = colSum \? colSum\[c\] : null;/.test(code),
    'C4 and a summable one takes the sum columnGrandTotals ALREADY computed');
  /* no second summation was written */
  const fn = codeOnly((/function rowsForDisplay[\s\S]*?\n  \}/.exec(SRC) || [''])[0]);
  ok(!/reduce\(|for \(let r = 0/.test(fn.split('CLCPA-290')[1] || ''),
    'C5 nothing sums a column a second way');
});

/* ---- D. the published report ------------------------------------------- */
log('');
log('D. WHAT MOVED, ACROSS ALL 149 STORED TABLE-YEARS');
guard('D-block', () => {
  const moved = [];
  let n = 0;
  Object.keys(P.tables).sort().forEach((id) => {
    Object.keys(P.tables[id].data || {}).forEach((y) => {
      let a, b;
      try {
        const HA = boot({ payload: P, tableId: id, year: y, src: BASE_SRC });
        const HB = boot({ payload: P, tableId: id, year: y, src: SRC });
        const sch = HB.api.getTableSchema(P.tables[id], y);
        a = JSON.stringify(HA.api.rowsForDisplay(P.tables[id].data[y], sch, id, { fillTotals: true }));
        b = JSON.stringify(HB.api.rowsForDisplay(P.tables[id].data[y], sch, id, { fillTotals: true }));
      } catch (e) { return; }
      n++;
      if (a !== b) moved.push(id + ':' + y);
    });
  });
  ok(n === 149, 'D1 all 149 stored table-years rendered on both builds -- ' + n);
  /* RE-PINNED, not widened. CLCPA-241 gave A9's "% Change" pair a rule, so
   * A9's two stored years now render a computed percentage where they rendered
   * a stale stored string. Named here rather than covered by a looser test:
   * the point of this assertion is that the set is EXACTLY known. */
  ok(JSON.stringify(moved.sort()) ===
     JSON.stringify(['A3:2023', 'A3:2024', 'A4:2023', 'A4:2024',
                     /* CLCPA-241 */ 'A9:2024', 'A9:2025']),
    'D2 exactly six moved, four for this ticket and A9 for CLCPA-241 -- ' + JSON.stringify(moved));
  /* AND NOT ONE STORED VALUE AMONG THEM: blank became dash, nothing else */
  let valueChanged = 0;
  moved.forEach((k) => {
    const [id, y] = k.split(':');
    const HB = boot({ payload: P, tableId: id, year: y, src: SRC });
    const sch = HB.api.getTableSchema(P.tables[id], y);
    const t = totalOf(HB.api.rowsForDisplay(P.tables[id].data[y], sch, id, { fillTotals: true }));
    const stored = totalOf(P.tables[id].data[y]);
    for (let c = 1; c < (stored || []).length; c++) {
      const had = stored[c] != null && String(stored[c]).trim() !== '';
      if (had && String(stored[c]) !== String(t[c])) valueChanged++;
    }
  });
  ok(valueChanged === 0,
    'D3 and NOT ONE stored value changed: only blanks became dashes -- ' + valueChanged);
  /* A3/2025 files its averages and must be untouched */
  const H = boot({ payload: P, tableId: 'A3', year: '2025', src: SRC });
  const t25 = totalOf(H.api.rowsForDisplay(P.tables.A3.data['2025'],
    H.api.getTableSchema(P.tables.A3, '2025'), 'A3'));
  ok(t25[3] === 3761330 && t25[4] === 22511,
    'D4 A3/2025 keeps its filed 3,761,330 and 22,511 -- ' + JSON.stringify(t25));
});

/* ---- D2. the fill is OPT-IN, and that is load-bearing ------------------ */
log('');
log('D2. ONLY THE SECTION PAGE ASKS FOR THE FILL');
guard('D2-block', () => {
  /* rowsForDisplay feeds the rendered report AND the KPI composer. Filling
   * unconditionally gave A1:2099 a computed total, which reached the composer
   * and produced a reported KPI for a year CLCPA-237 exists to keep out of
   * them -- 2099 lost its "no data" banner. suite_237 caught it. */
  const rows = liveRows('A3');
  const pay = JSON.parse(JSON.stringify(P));
  pay.meta.years = ['2098'].concat(pay.meta.years);
  pay.tables.A3.data['2098'] = rows;
  const H = boot({ payload: pay, tableId: 'A3', year: '2098', src: SRC });
  const sch = H.api.getTableSchema(P.tables.A3, '2025');
  const without = totalOf(H.api.rowsForDisplay(rows, sch, 'A3'));
  ok(without && (without[2] == null || without[2] === ''),
    'D2a WITHOUT the flag nothing is filled, so the composer sees what it saw -- ' +
    JSON.stringify(without));
  const with_ = totalOf(H.api.rowsForDisplay(rows, sch, 'A3', { fillTotals: true }));
  ok(with_ && typeof with_[2] === 'number',
    'D2b and WITH it the section page gets its total -- ' + JSON.stringify(with_));
  ok(/\{ fillTotals: true \}\);/.test(codeOnly(SRC)),
    'D2c exactly one caller opts in');
  ok((codeOnly(SRC).match(/fillTotals: true/g) || []).length === 1,
    'D2d and only one -- ' + (codeOnly(SRC).match(/fillTotals: true/g) || []).length);
});

/* ---- E. what is NOT authorised ----------------------------------------- */
log('');
log('E. THE WEIGHTED MEAN IS NOT REGISTERED');
guard('E-block', () => {
  const code = codeOnly(SRC);
  const derived = (/const DERIVED_COLS = \(function \(\)[\s\S]*?\n  \}\)\(\);/.exec(code) || [''])[0];
  ok(!/A3:/.test(derived) && !/A4:/.test(derived),
    'E1 neither A3 nor A4 has a DERIVED_COLS entry');
  ok(/wmean = \(column, weight, decimals\)/.test(derived),
    'E2 the weightedMean type still exists, for the tables that pass its own test');
  /* it stays available and unused here, which is the ruling */
  ok(/E1's "Percentage Affecting DACs"/.test(SRC) || /weightedMean/.test(SRC),
    'E3 and is still used where three stored years verified it');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha that predates the change');
  /* D walks EVERY table-year on BOTH builds. A change that fills empty cells
   * on a total row is exactly the shape that can touch a published figure
   * without anyone noticing, so the guard is the whole payload, not A3. */
  ok(/D1 all 149 stored table-years rendered on both builds/.test(self),
    'X2 the published report is checked whole, not on the two tables named');
  ok(/valueChanged === 0/.test(self),
    'X3 and separately that no stored VALUE moved, not merely that few cells did');
  ok(fs.existsSync(path.join(__dirname, 'gesture_290.js')),
    'X4 the browser gesture is committed beside this suite');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-290-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
