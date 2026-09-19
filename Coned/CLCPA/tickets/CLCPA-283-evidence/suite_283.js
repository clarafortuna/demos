/* CLCPA-283: one coherent contract for removing a year.
 *
 * THE GESTURE, in a real browser on a served build, before any code. 2096 is
 * the owner's CLCPA-301 reproduction on the org and was NOT touched: this runs
 * on fresh scratch years.
 *
 *   1. add 2094  -> empty, so the Remove control is offered
 *   2. type a value and SAVE  -> the year now holds data
 *   3. the control is STILL on screen: its visibility was decided at render
 *   4. click it. The dialog promises "This will also delete any saved data
 *      for 2094. This cannot be undone."
 *   5. confirm
 *
 *   PRE-FIX   toast: "2094 has data (or is a seed year) and cannot be removed."
 *             dac:years unchanged ["2094","2093"], override H1:2094 still
 *             there, the year still in the selector. The dashboard promised a
 *             delete and refused it.
 *
 *   POST-FIX  no toast. dac:years ["2093"], override keys [], the year gone
 *             from the selector. The promise is kept.
 *
 *   Seed 2025: the control is hidden either side. It must stay that way.
 *
 * THE CAUSE. isYearProtected meant "a seed year OR a year holding data", and
 * two readers asked it at two different moments -- the button at render, the
 * guard at click. One save between them flipped the answer. Net effect: no
 * user-added year that had ever been saved could be removed at all.
 *
 * THE CONTRACT NOW: a seed year is never removable and is never offered; a
 * year the operator added is theirs to remove, data and all, behind the
 * warning the dialog already shows. Protection no longer depends on anything
 * that can change between render and click, so the two readers cannot drift.
 *
 * BASE predates the change: 74458b2.
 *
 * Run:  node suite_283.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || '74458b2';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);
const SRC = fs.readFileSync(APP, 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');

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
/** build a function with the real state it closes over, and CALL it */
function withState(names, src, state) {
  const body = names.map(n => grab(n, src)).join('\n');
  return new Function('state', body + '\nreturn {' + names.map(n => n + ':' + n).join(',') + '};')(state);
}

log('======================================================================');
log('CLCPA-283 -- one contract for removing a year');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the defect, on the build that shipped it ----------------------- */
log('');
log('A. THE TWO READINGS, ON BASE');
guard('A-block', () => {
  ok(/function yearHasData/.test(codeOnly(BASE_SRC)),
    'A1 BASE carried yearHasData');
  ok(/\|\| yearHasData\(y\);/.test(codeOnly(BASE_SRC)),
    'A2 and isYearProtected meant "seed year OR holds data"');
  /* the same predicate, run at the two moments the page runs it */
  const stateBase = { seedYears: ['2025', '2024', '2023'],
    payload: { tables: { H1: { data: {} } } } };
  const B = withState(['isYearProtected', 'yearHasData', 'isEmptyYearData'], BASE_SRC, stateBase);
  ok(B.isYearProtected('2094') === false,
    'A3 at RENDER, before any save, 2094 is not protected -- the control shows');
  /* the one save */
  stateBase.payload.tables.H1.data['2094'] = [['Manhattan', 100, 200, 300]];
  ok(B.isYearProtected('2094') === true,
    'A4 at CLICK, after one save, the SAME call says protected -- the guard refuses');
  ok(B.isYearProtected('2025') === true, 'A5 (a seed year was protected throughout)');
});

/* ---- B. the contract now ------------------------------------------------ */
log('');
log('B. ONE ANSWER, AT EITHER MOMENT');
guard('B-block', () => {
  const st = { seedYears: ['2025', '2024', '2023'],
    payload: { tables: { H1: { data: {} } } } };
  const H = withState(['isYearProtected'], SRC, st);
  ok(H.isYearProtected('2094') === false, 'B1 an added year is not protected when empty');
  st.payload.tables.H1.data['2094'] = [['Manhattan', 100, 200, 300]];
  ok(H.isYearProtected('2094') === false,
    'B2 and STILL not protected after a save -- the answer cannot flip underneath');
  ok(H.isYearProtected('2025') === true, 'B3 a seed year is protected');
  ok(H.isYearProtected(2025) === true, 'B4 whether it is given as a number or a string');
  ok(H.isYearProtected('2099') === false, 'B5 a year nobody has heard of is not protected');
  /* seedYears missing entirely must not throw and must not protect everything */
  const bare = withState(['isYearProtected'], SRC, {});
  ok(bare.isYearProtected('2025') === false,
    'B6 with no seedYears it protects nothing, rather than throwing');
});

/* ---- C. the dead predicate is gone -------------------------------------- */
log('');
log('C. NO SECOND ANSWER LEFT LYING AROUND');
guard('C-block', () => {
  const code = codeOnly(SRC);
  ok(!/function yearHasData/.test(code),
    'C1 yearHasData is GONE -- isYearProtected was its only caller');
  ok(code.indexOf('yearHasData') < 0,
    'C2 and nothing references it anywhere');
  ok(/function isEmptyYearData/.test(code),
    'C3 isEmptyYearData stays: it has other callers and is not about removal');
  ok(!/has data \(or is a seed year\) and cannot be removed/.test(code),
    'C4 the toast no longer claims data is a reason to refuse');
  ok(/is a seed year and cannot be removed/.test(code),
    'C5 it names the only reason that remains');
});

/* ---- D. the guardians --------------------------------------------------- */
log('');
log('D. WHAT MUST NOT CHANGE');
guard('D-block', () => {
  const code = codeOnly(SRC);
  /* both readers still ask the SAME predicate -- that is the whole fix */
  ok(/const show = yr != null && Storage\.getAddedYears\(\)\.includes\(yr\) && !isYearProtected\(yr\);/.test(code),
    'D1 the button still asks isYearProtected');
  ok(/if \(isYearProtected\(year\)\) \{/.test(code),
    'D2 and Storage.removeYear still refuses a protected year -- last line of defence');
  /* the dialog still warns, and now tells the truth */
  ok(/This will also delete any saved data for /.test(code),
    'D3 the dialog still warns that saved data goes with the year');
  ok(/This cannot be undone\./.test(code), 'D4 and that it cannot be undone');
  /* CLCPA-297's discard prompt is a different guard and must survive */
  ok(/Discard Unsaved Changes\?/.test(SRC),
    'D5 the CLCPA-297 discard prompt is untouched (driven in the browser too)');
  /* The backend really deletes the data, which is what the dialog promises.
   *
   * removeYear is a METHOD on the backend object, not a 2-space function, so
   * grab() cannot see it -- the first cut of this guard threw rather than
   * failing, which is precisely what guard() exists to make visible. */
  ok(/Object\.keys\(overrides\)\.forEach\(k => \{ if \(k\.endsWith\(':' \+ y\)\) delete overrides\[k\]; \}\);/
    .test(codeOnly(SRC)),
    'D6 removing a year really deletes its overrides -- data and all');
});

/* ---- E. the seed-year derivation is now load-bearing -------------------- */
log('');
log('E. WHERE SEED YEARS COME FROM');
guard('E-block', () => {
  const code = codeOnly(SRC);
  ok(/state\.seedYears = \(\(state\.payload\.meta && state\.payload\.meta\.years\) \|\| \[\]\)\.map\(String\);/.test(code),
    'E1 seedYears is the published years, from the payload');
  ok(/\.map\(String\)\.filter\(y => addedYears\.indexOf\(y\) < 0\);/.test(code),
    'E2 minus the added-year table on the Dataverse path -- now the ONLY thing ' +
    'standing between an added year and permanence');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha that predates the change');
  /* A3/A4 are the whole point: the same built function, called twice, with one
   * save in between. A suite that called it once could not see this defect. */
  ok(/stateBase\.payload\.tables\.H1\.data\['2094'\] = /.test(self),
    'X2 the defect is shown by calling ONE predicate at TWO moments');
  ['gesture_283.js', 'guard_297.js', 'guard-297-output.txt',
   'repro_283_prefix.png', 'repro_283_postfix.png'].forEach((f) => {
    ok(fs.existsSync(path.join(__dirname, f)), 'X3 evidence committed: ' + f);
  });
  const g = fs.readFileSync(path.join(__dirname, 'guard-297-output.txt'), 'utf8');
  ok(/STILL FIRES/.test(g),
    'X4 and the CLCPA-297 guard was driven in a browser, not merely grepped');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-283-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
