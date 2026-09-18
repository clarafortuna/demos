/* CLCPA-278 round 2: the pre-edit row is captured before the FIRST write.
 *
 * THE LIVE REPRODUCTION CAME FIRST, and it is the reason this suite exists in
 * a different shape from round 1's. Driven through the real page:
 *
 *   H1 2025 Manhattan, 1309 + 491 = 1800, reconciles exactly.
 *   Type 500 into DAC Repairs, leave the cell.
 *     input then blur (a browser)      -> total FROZEN at 1800, advisory raised
 *     blur alone      (round 1's suite) -> total recomputes to 1809, green
 *
 * ROUND 1 PASSED 31/0 AGAINST A BEHAVIOUR THE LIVE PATH CONTRADICTS. The fix
 * was real and the capture was in the wrong event: the INPUT handler commits
 * on every keystroke -- by design, so the focused cell is never rebuilt and
 * multi-digit typing keeps focus -- so blur's "pre-edit" row was already
 * post-edit and rowSumIsConsistent was false BY CONSTRUCTION, for every edit.
 *
 * Every assertion below that drives a cell drives input THEN blur, and one
 * assertion drives blur alone and requires the SAME answer. That pair is the
 * permanent control against this class returning.
 *
 * BASE predates the change: 590703c, CLCPA-277 round 2.
 *
 * Run:  node suite_278_r2.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { boot } = require('../_kit/live_editor.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || '590703c';
/* PINNED ON BOTH SIDES (CLAUDE.md). This suite asserts what CLCPA-278 round 2
 * did to functions a LATER round has since changed, so its post-change side
 * reads that build rather than live main. A blast-radius claim can only be
 * true at the commit that made the change. DAC_APP_OVERRIDE still wins, so
 * the mutation runner keeps working. */
const NEWREV = process.env.DAC_NEW_COMMIT || 'd548acc';
const APP = process.env.DAC_APP_OVERRIDE || ('git show ' + NEWREV + ':' + REL);
const SRC = process.env.DAC_APP_OVERRIDE
  ? fs.readFileSync(process.env.DAC_APP_OVERRIDE, 'utf8')
  : execSync('git show ' + NEWREV + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
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

const f = (src) => boot({ payload: JSON.parse(JSON.stringify(P)),
  tableId: 'H1', year: '2025', src: src });
const row0 = (H) => JSON.stringify(H.draft()[0]);
const says = (H) => (H.noticeText() || '').indexOf('Does not add up') >= 0;

log('======================================================================');
log('CLCPA-278 round 2 -- the pre-edit row, captured before the first write');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the defect, reproduced on BASE, the way a browser drives it ----- */
log('');
log('A. THE DEFECT, ON THE BUILD THAT SHIPPED IT');
guard('A-block', () => {
  const H = f(BASE_SRC);
  ok(row0(H) === '["Manhattan",1309,491,1800]', 'A1 Manhattan reconciles exactly to start');
  H.typeInCell(0, 2, 500);
  ok(H.draft()[0][3] === 1800,
    'A2 input THEN blur leaves the total FROZEN at 1800 -- ' + row0(H));
  ok(says(H), 'A3 and raises the advisory instead, which is what the hosted pass saw');
});
guard('A: what round 1 measured instead', () => {
  const H = f(BASE_SRC);
  const el = H.cell(0, 2);
  el.value = '500';
  el.dispatchEvent({ type: 'blur' });          /* blur ALONE, no input */
  ok(H.draft()[0][3] === 1809,
    'A4 blur alone DID recompute on BASE -- ' + row0(H) + '  <- why the suite was green');
});

/* ---- B. the fix, on the real gesture ------------------------------------ */
log('');
log('B. THE REAL GESTURE');
guard('B-block', () => {
  const H = f(SRC);
  H.typeInCell(0, 2, 500);
  ok(H.draft()[0][3] === 1809,
    'B1 input then blur now recomputes to 1809 -- ' + row0(H));
  ok(!says(H), 'B2 and raises no advisory: the row adds up again');
  ok(H.draft()[0][1] === 1309, 'B3 the untouched component is untouched');
});
guard('B: multi-keystroke typing, which is how a number is entered', () => {
  const H = f(SRC);
  const el = H.cell(0, 2);
  /* 5, then 50, then 500 -- three input events, one episode, one blur */
  ['5', '50', '500'].forEach((v) => { el.value = v; el.dispatchEvent({ type: 'input' }); });
  el.dispatchEvent({ type: 'blur' });
  ok(H.draft()[0][3] === 1809,
    'B4 the snapshot is the row before the FIRST keystroke, not the second -- ' + row0(H));
});
guard('B: blur with no input at all', () => {
  const H = f(SRC);
  const el = H.cell(0, 2);
  el.dispatchEvent({ type: 'blur' });
  ok(row0(H) === '["Manhattan",1309,491,1800]',
    'B5 focusing a cell and leaving it changes nothing -- ' + row0(H));
});
guard('B: blur alone must give the SAME answer as the real gesture', () => {
  const H = f(SRC);
  const el = H.cell(0, 2);
  el.value = '500';
  el.dispatchEvent({ type: 'blur' });
  ok(H.draft()[0][3] === 1809,
    'B6 the two drives now AGREE -- the permanent control on this class -- ' + row0(H));
});

/* ---- C. the other half of the ruling ------------------------------------ */
log('');
log('C. A TOTAL THAT ALREADY DISAGREED IS THE PREPARER\'S');
guard('C-block', () => {
  const H = f(SRC);
  H.typeInCell(0, 3, 9999);
  ok(H.draft()[0][3] === 9999, 'C1 the preparer types a total that does not add up');
  H.typeInCell(0, 2, 600);
  ok(H.draft()[0][3] === 9999,
    'C2 editing a component KEEPS it -- nothing computed over it -- ' + row0(H));
  ok(H.draft()[0][2] === 600, 'C3 while the component itself did change');
  ok(says(H), 'C4 and CLCPA-272 advises on it instead');
});
guard('C: the episode does not leak between rows', () => {
  const H = f(SRC);
  H.typeInCell(0, 2, 500);                      /* row 0: consistent -> recompute */
  ok(H.draft()[0][3] === 1809, 'C5 row 0 recomputed');
  H.typeInCell(1, 2, 300);                      /* row 1: also consistent */
  ok(H.draft()[1][3] === 1863,
    'C6 row 1 uses ITS OWN pre-edit row, not row 0\'s -- ' + JSON.stringify(H.draft()[1]));
});

/* ---- D. nothing stored moves -------------------------------------------- */
log('');
log('D. THE DRAFT ONLY');
guard('D-block', () => {
  const H = f(SRC);
  const stored = JSON.stringify(P.tables.H1.data['2025'][0]);
  H.typeInCell(0, 2, 500);
  ok(JSON.stringify(H.state().payload.tables.H1.data['2025'][0]) === stored,
    'D1 the stored row is untouched by an edit -- ' + stored);
  ok(JSON.stringify(H.baseline()[0]) === '["Manhattan",1309,491,1800]',
    'D2 and so is the baseline Reset restores');
});

/* ---- E. the shared path, every surface enumerated ------------------------ */
log('');
log('E. THE SHARED PATH THIS TOUCHES');
guard('E-block', () => {
  const code = codeOnly(SRC);
  const w = /function wireIngestEditor\(\) \{[\s\S]*?\n  \}/.exec(code);
  ok(!!w, 'E1 wireIngestEditor is the function that changed');
  ok(/\n    let preEdit = null;/.test(w[0]),
    'E2 the snapshot is scoped to ONE wiring, not to state.ingest');
  ok(!/state\.ingest\.preEdit|i\.preEdit/.test(code),
    'E3 nothing transient was hung on the stored state');
  /* the two handlers that share it */
  const inp = /input\.addEventListener\('input'[\s\S]*?\n      \}\);/.exec(w[0]);
  ok(!!inp && /if \(!preEdit \|\| preEdit\.r !== r\)/.test(inp[0]),
    'E4 the INPUT handler captures, once per episode');
  const blur = /input\.addEventListener\('blur'[\s\S]*?\n      \}\);/.exec(w[0]);
  ok(!!blur && /const beforeRow = \(preEdit && preEdit\.r === r\) \? preEdit\.row/.test(blur[0]),
    'E5 the BLUR handler reads it');
  ok(!!blur && /preEdit = null;/.test(blur[0]), 'E6 and releases it, so it cannot leak');
  /* CLCPA-276 round 2 lives in the same function and in rerenderIngestEditor,
   * which re-wires -- so a rerender ends any episode in flight. Both stated. */
  ok(/refreshIngestNotices\(\);/.test(
    /function rerenderIngestEditor\(\) \{[\s\S]*?\n  \}/.exec(code)[0]),
    'E7 CLCPA-276 round 2\'s repaint is still in rerenderIngestEditor');
  ok(/wireIngestEditor\(\);/.test(
    /function rerenderIngestEditor\(\) \{[\s\S]*?\n  \}/.exec(code)[0]),
    'E8 which re-wires, so a repaint ends any episode in flight -- the two agree');
  /* the handlers that must NOT have changed */
  const gf = (s, name) => {
    const m = new RegExp("input\\.addEventListener\\('" + name + "'[\\s\\S]*?\\n      \\}\\);")
      .exec(/function wireIngestEditor\(\) \{[\s\S]*?\n  \}/.exec(s)[0]);
    return m ? m[0] : null;
  };
  ok(gf(code, 'focus') === gf(codeOnly(BASE_SRC), 'focus'),
    'E9 the focus handler is byte-identical to BASE');
});

/* ---- F. the engine itself is untouched ---------------------------------- */
log('');
log('F. THE RULE ITSELF DID NOT MOVE');
guard('F-block', () => {
  const g = (s, n) => {
    const i = s.indexOf('function ' + n + '(');
    return i < 0 ? null : s.slice(i, s.indexOf('\n  }', i));
  };
  const now = codeOnly(SRC), was = codeOnly(BASE_SRC);
  ok(g(now, 'rowSumIsConsistent') === g(was, 'rowSumIsConsistent'),
    'F1 rowSumIsConsistent is byte-identical to BASE');
  ok(g(now, 'recomputeDerivableSums') === g(was, 'recomputeDerivableSums'),
    'F2 and recomputeDerivableSums: only WHEN it is asked changed, never what it does');
  ok(g(now, 'detectSumColumns') === g(was, 'detectSumColumns'),
    'F3 and the relationship it reads');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha');
  /* THE DRIVER MUST SEND BOTH EVENTS. If typeInCell ever stopped sending
   * `input`, every assertion above would go green against the old defect --
   * which is precisely what happened to round 1. */
  const src = fs.readFileSync(path.join(REPO, 'Coned/CLCPA/tickets/_kit/live_editor.js'), 'utf8');
  const t = /typeInCell: \(r, c, value\) => \{[\s\S]*?\n    \},/.exec(src);
  ok(!!t && /dispatchEvent\(\{ type: 'input' \}\)/.test(t[0]) &&
     /dispatchEvent\(\{ type: 'blur' \}\)/.test(t[0]),
    'X2 typeInCell sends input AND blur, in that order');
  ok(t[0].indexOf("type: 'input'") < t[0].indexOf("type: 'blur'"),
    'X3 and input really is first');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-278-r2-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
