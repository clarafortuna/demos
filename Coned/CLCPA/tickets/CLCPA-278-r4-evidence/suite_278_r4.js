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
/* CLCPA-278 round 4: the cell the operator READS.
 *
 * THE GESTURE, in a real browser on a served build, H1 / 2099 (user-added):
 *
 *   PRE-FIX   Manhattan 99 + 999 = 1098; edit DAC to 500 digit by digit
 *             ROW cell    stays 1,098
 *             TOTALS cell moves to 2,597, consistent with Manhattan at 599
 *             -> two figures for the same row on one screen
 *
 *   POST-FIX  ROW cell reads 599, from the same recompute the totals consume
 *
 * THE CAUSE. recomputeDerivableSums RETURNS the columns it rewrote, and the
 * blur handler discarded that return. On a DATA row the derivable total is an
 * ordinary <input> -- the row is not a total row, so it is not a calc span --
 * and refreshIngestCalcCells only repaints spans. The draft held 599, the
 * totals row consumed 599, and the row's own input went on displaying 1098.
 *
 * The engine half landed in round 3 and is untouched here: this round repaints
 * what was already computed, through the formatter the cell uses at rest. No
 * second source, which is the sin the bareNumber ruling forbade.
 *
 * BASE predates the change: 4e1491b, CLCPA-274 round 4.
 *
 * Run:  node suite_278_r4.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { boot } = require('../_kit/live_editor.js');

const REPO = _dacRepo() + '';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || '4e1491b';
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

const ROWS = [['Manhattan', 99, 999, 1098], ['Queens', 999, 999, 1998],
  ['Bronx', 100, 10000, 10008], ['Grand Total', 1198, 11998, 13194]];

/** H1 on a user-added year, or on a seed year, with the same rows */
const openAt = (src, year) => {
  const pay = JSON.parse(JSON.stringify(P));
  pay.tables.H1.data[year] = ROWS.map(r => r.slice());
  if (year !== '2025') pay.meta.years = [year].concat(pay.meta.years);
  return boot({ payload: pay, tableId: 'H1', year: year, src: src });
};
/** type digit by digit, exactly as a person does */
const dbd = (H, r, c, digits) => {
  const el = H.cell(r, c);
  if (!el) throw new Error('no cell at ' + r + ',' + c);
  let acc = '';
  String(digits).split('').forEach((d) => { acc += d; el.value = acc; el.dispatchEvent({ type: 'input' }); });
  el.dispatchEvent({ type: 'blur' });
};
/** what the cell DISPLAYS, input or span alike */
const shown = (H, r, c) => {
  const el = H.cell(r, c) || H.calcCell(r, c);
  if (!el) return null;
  return el.tagName === 'input' ? el.value : el.textContent.trim();
};
const says = (H) => (H.noticeText() || '').indexOf('Does not add up') >= 0;

log('======================================================================');
log('CLCPA-278 round 4 -- the row cell shows what was computed');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the defect, on BASE, both provenances --------------------------- */
log('');
log('A. THE DEFECT, ON THE BUILD THAT SHIPPED IT');
guard('A-block', () => {
  [['user-added', '2099'], ['seed', '2025']].forEach(([name, y]) => {
    const H = openAt(BASE_SRC, y);
    ok(shown(H, 0, 3) === '1,098', 'A1.' + name + ' Manhattan starts at 1,098');
    dbd(H, 0, 2, '500');
    ok(H.draft()[0][3] === 599,
      'A2.' + name + ' the DRAFT is recomputed to 599 -- the engine half landed');
    ok(shown(H, 0, 3) === '1,098',
      'A3.' + name + ' but the CELL still shows 1,098 -- ' + shown(H, 0, 3));
  });
});

/* ---- B. the fix ---------------------------------------------------------- */
log('');
log('B. THE CELL FOLLOWS THE RECOMPUTE');
guard('B-block', () => {
  [['user-added', '2099'], ['seed', '2025']].forEach(([name, y]) => {
    const H = openAt(SRC, y);
    dbd(H, 0, 2, '500');
    ok(H.draft()[0][3] === 599, 'B1.' + name + ' the draft says 599');
    ok(shown(H, 0, 3) === '599',
      'B2.' + name + ' and so does the cell -- ' + shown(H, 0, 3));
    ok(shown(H, 0, 2) === '500', 'B3.' + name + ' the edited cell keeps what was typed');
  });
});

/* ---- C. one source, not two --------------------------------------------- */
log('');
log('C. SHOWN, NOT RECOMPUTED');
guard('C-block', () => {
  const code = codeOnly(SRC);
  ok(/const rewritten = recomputeDerivableSums\(/.test(code),
    'C1 the blur handler KEEPS what the recompute returned');
  const blur = /input\.addEventListener\('blur'[\s\S]*?\n      \}\);/.exec(code)[0];
  ok(/\(rewritten \|\| \[\]\)\.forEach\(/.test(blur),
    'C2 and repaints exactly those columns');
  ok(!/recomputeDerivableSums[\s\S]{0,200}recomputeDerivableSums/.test(blur),
    'C3 calling the engine ONCE: the repaint recomputes nothing');
  ok(/formatIngestValue\(state\.ingest\.draft\[r\]\[col\]/.test(blur),
    'C4 through the same formatter the cell uses at rest');
  ok(/if \(col === c\) return;/.test(blur),
    'C5 and it does not fight the edited cell for its own value');
});

/* ---- D. the guardians --------------------------------------------------- */
log('');
log('D. WHAT MUST NOT REGRESS');
guard('D: a filed total that already disagrees is KEPT', () => {
  [['user-added', '2099'], ['seed', '2025']].forEach(([name, y]) => {
    const H = openAt(SRC, y);
    /* Bronx: filed 10008, parts give 10100 -- the preparer's figure */
    dbd(H, 2, 1, '200');
    ok(H.draft()[2][3] === 10008,
      'D1.' + name + ' Bronx keeps its filed 10,008 -- ' + JSON.stringify(H.draft()[2]));
    ok(shown(H, 2, 3) === '10,008',
      'D2.' + name + ' and the cell still shows it, unrepainted');
    ok(says(H), 'D3.' + name + ' while the advisory names it');
  });
});
guard('D: a percent typed into a numeric column is still coerced and noticed', () => {
  const H = openAt(SRC, '2099');
  dbd(H, 1, 2, '45%');
  ok(H.draft()[1][2] === 0.45,
    'D4 "45%" lands as 0.45, the CLCPA-244 convention -- ' + JSON.stringify(H.draft()[1]));
  ok((H.noticeText() || '').indexOf('Read as a fraction') >= 0,
    'D5 and the advisory says so');
});

/* ---- E. nothing else repaints ------------------------------------------- */
log('');
log('E. ONLY WHAT THE RECOMPUTE WROTE');
guard('E-block', () => {
  const H = openAt(SRC, '2099');
  const before = JSON.stringify(H.draft());
  /* editing the TOTAL itself is the preparer filing one: nothing is rewritten */
  dbd(H, 1, 3, '4242');
  ok(H.draft()[1][3] === 4242, 'E1 editing the total keeps what was typed');
  ok(shown(H, 1, 1) === '999' && shown(H, 1, 2) === '999',
    'E2 and its components are untouched on screen');
  ok(before !== JSON.stringify(H.draft()), 'E3 (the edit really happened)');
  const stored = JSON.stringify(P.tables.H1.data['2025']);
  ok(JSON.stringify(H.state().payload.tables.H1.data['2025']) === stored,
    'E4 and no stored year moved');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha');
  /* THIS SUITE READS A CELL, not a draft: the draft was already right on BASE,
   * and a suite that checked the draft would have passed through the defect. */
  ok(/el\.tagName === 'input' \? el\.value : el\.textContent\.trim\(\)/.test(self),
    'X2 every assertion above reads what the CELL displays');
  ok(fs.existsSync(path.join(REPO, 'Coned/CLCPA/tickets/_kit/live_browser.js')),
    'X3 and the gesture evidence comes from the browser driver');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-278-r4-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
