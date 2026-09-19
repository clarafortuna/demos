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
/* CLCPA-277 round 2: the STAGED year advisory, which was never reachable.
 *
 * THE LIVE REPRODUCTION CAME FIRST, driven through the real Add Data dialog
 * with the real file input, the real FileReader and the real dry run:
 *
 *   stage H1-2099-example.csv into 2097 -> the staged card reads
 *     "2 rows, 2 matching columns, 4 values ready to import." and says NOTHING
 *     about the year, while the wrong-TABLE twin does warn on that same card.
 *
 * TWO CAUSES, both measured, and the first hides the second.
 *
 *   1. target() returned { tableId, schema } and no year. stagedBlock() asks
 *      importYearNotice(staged.name, target().year), and the notice returns
 *      null for a destination it does not know -- so it could never render.
 *      tableId WAS there, which is exactly why the table twin worked.
 *
 *   2. Once it rendered, it did not FOLLOW the year box. The table advisory
 *      follows its dropdown because that handler calls restage() then draw().
 *      The year handler deliberately does not redraw: CLCPA-234 updates the
 *      consequence line and the button label in place so typing does not lose
 *      focus. A redraw here would have fixed the advisory and broken the box.
 *
 * So the advisory is now the THIRD thing that follows the field in place, from
 * the same source as the first draw. The post-load half is untouched and is
 * asserted unchanged.
 *
 * BASE predates the change: 062d3f9, CLCPA-276 round 2.
 *
 * Run:  node suite_277_r2.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { boot } = require('../_kit/live_editor.js');

const REPO = _dacRepo() + '';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || '062d3f9';
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

const CSV = 'Borough / County,Non-DAC Repairs,DAC Repairs\nManhattan,10,20\nQueens,30,40\n';
const staged = (src, year, fileName) => {
  const H = boot({ payload: JSON.parse(JSON.stringify(P)), tableId: 'H1', year: year, src: src });
  H.openAddYear();
  H.stageFile(fileName, CSV);
  return H;
};
const yearWarn = (H) => {
  const e = H.doc.body.querySelector('#dlg-year-warn');
  return e ? e.textContent : null;
};
const tableWarn = (H) => !!H.doc.body.querySelector('#dlg-identity-warn');

log('======================================================================');
log('CLCPA-277 round 2 -- the staged year advisory is reachable, and follows');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the defect, reproduced on BASE ---------------------------------- */
log('');
log('A. THE DEFECT, ON THE BUILD THAT SHIPPED IT');
guard('A-block', () => {
  const H = staged(BASE_SRC, '2097', 'H1-2099-example.csv');
  ok(H.stagedText() !== null, 'A1 the file really did stage -- ' +
    JSON.stringify((H.stagedText() || '').slice(0, 60)));
  ok(yearWarn(H) === null, 'A2 and the staged card says NOTHING about the year');
  /* the notice function itself was never the problem */
  ok(typeof H.api.importYearNotice === 'function' &&
     !!H.api.importYearNotice('H1-2099-example.csv', '2097'),
    'A3 while importYearNotice(name, 2097) returns the sentence perfectly well');
  ok(H.api.importYearNotice('H1-2099-example.csv', undefined) === null,
    'A4 and returns null for a destination it is not given -- which is what it got');
});

/* ---- B. the wrong-table twin, which did work ---------------------------- */
log('');
log('B. THE TWIN THAT WORKED, AND WHY');
guard('B-block', () => {
  const H = staged(BASE_SRC, '2097', 'B2-2097-example.csv');
  ok(tableWarn(H), 'B1 on BASE the wrong-TABLE advisory DOES render on the staged card');
  ok(yearWarn(H) === null, 'B2 on the same card, in the same box, the year one does not');
});

/* ---- C. the fix: it renders --------------------------------------------- */
log('');
log('C. THE ADVISORY RENDERS');
guard('C-block', () => {
  const H = staged(SRC, '2097', 'H1-2099-example.csv');
  const w = yearWarn(H);
  ok(!!w, 'C1 staging a 2099 file into 2097 warns on the staged card');
  ok(/named for 2099/.test(w) && /into 2097/.test(w),
    'C2 naming both years -- ' + JSON.stringify((w || '').slice(0, 64)));
  ok(/just as wrong in the wrong year/.test(w),
    'C3 in the wording the post-load half already uses');
  /* ADVISORY ONLY: nothing is rejected and the primary button stays live */
  const btn = H.doc.body.querySelector('[data-act="addyear"]');
  ok(btn && !btn.disabled, 'C4 and the Add Year button is untouched -- advisory, not a rejection');
  ok(!/is-bad/.test(H.doc.body.querySelector('#dlg-stagedbox').className),
    'C5 the staged card is not marked bad');
});

/* ---- D. and it FOLLOWS the field ---------------------------------------- */
log('');
log('D. IT FOLLOWS THE YEAR BOX, IN PLACE');
guard('D-block', () => {
  const H = staged(SRC, '2097', 'H1-2099-example.csv');
  ok(!!yearWarn(H), 'D1 warns at 2097');
  H.setDialogYear('2099');
  ok(yearWarn(H) === null, 'D2 retyping the destination to 2099 removes it: the years now agree');
  H.setDialogYear('2098');
  ok(!!yearWarn(H), 'D3 and typing 2098 brings it back');
  H.setDialogYear('2099');
  ok(yearWarn(H) === null, 'D4 and it goes again -- both directions, not one');
  /* the consequence line and the advisory must name the SAME destination */
  const cons = H.doc.body.querySelector('#dlg-consequence').textContent;
  ok(/^2099/.test(cons.trim()),
    'D5 and the consequence line agrees about the destination -- ' +
    JSON.stringify(cons.trim().slice(0, 28)));
  /* THE FIELD MUST SURVIVE. A redraw here would fix the advisory and take the
   * focus out of the box mid-typing, which is what CLCPA-234 forbids. */
  const f = H.doc.body.querySelector('#dlg-newyear');
  ok(f && f.value === '2099', 'D6 and the year box still holds what was typed -- no redraw');
});

/* ---- E. the shapes that must stay silent -------------------------------- */
log('');
log('E. WHAT IT DOES NOT SAY');
guard('E-block', () => {
  ok(yearWarn(staged(SRC, '2099', 'H1-2099-example.csv')) === null,
    'E1 a file staged into its OWN year says nothing');
  ok(yearWarn(staged(SRC, '2097', 'example.csv')) === null,
    'E2 a filename with no year says nothing');
  ok(yearWarn(staged(SRC, '2097', 'H1-2098-2099.csv')) === null,
    'E3 and one with two says nothing -- never a guess');
  /* the CLCPA-252 digit-boundary lesson, on the staged surface */
  ok(H2098(), 'E4 a four-digit token inside a longer run is not a year');
  function H2098() {
    return yearWarn(staged(SRC, '2097', 'H1-120994-example.csv')) === null;
  }
});

/* ---- F. the post-load half does not regress ----------------------------- */
log('');
log('F. THE POST-LOAD HALF IS UNTOUCHED');
guard('F-block', () => {
  const now = codeOnly(SRC), before = codeOnly(BASE_SRC);
  const grab = (s) => {
    const i = s.indexOf('function renderIngestImportResult(');
    return i < 0 ? null : s.slice(i, s.indexOf('\n  }', i));
  };
  ok(grab(now) === grab(before),
    'F1 renderIngestImportResult is byte-identical to BASE');
  const gy = (s) => {
    const i = s.indexOf('function importYearNotice(');
    return i < 0 ? null : s.slice(i, s.indexOf('\n  }', i));
  };
  ok(gy(now) === gy(before), 'F2 and so is importYearNotice itself');
  const gd = (s) => {
    const i = s.indexOf('function declaredYearFromFilename(');
    return i < 0 ? null : s.slice(i, s.indexOf('\n  }', i));
  };
  ok(gd(now) === gd(before), 'F3 and declaredYearFromFilename');
});

/* ---- G. the two changes, structurally ----------------------------------- */
log('');
log('G. THE CHANGE, IN THE SOURCE');
guard('G-block', () => {
  const code = codeOnly(SRC);
  ok(/const target = \(\) => \(\{\s*tableId: sel\.tableId,\s*year: drawYear\(\),/.test(code),
    'G1 target() now carries the destination year');
  ok(/const syncStagedYearWarn = \(\) => \{/.test(code),
    'G2 and the in-place updater exists');
  ok(/syncStagedYearWarn\(\);/.test(code), 'G3 called from the year input handler');
  /* it must NOT have been fixed by redrawing */
  const h = /yin\.addEventListener\('input', \(\) => \{[\s\S]*?\n        \}\);/.exec(code);
  ok(!!h && !/draw\(\)/.test(h[0]),
    'G4 and that handler still does not redraw the dialog');
  ok(/drawYear\(\)/.test(code) && /typedYear\(\)/.test(code),
    'G5 both year readings survive: display and validation are different questions');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha');
  /* the driver must really be staging through the app, not faking a card */
  const H = staged(SRC, '2097', 'H1-2099-example.csv');
  ok(/2 rows/.test(H.stagedText() || ''),
    'X2 the staged summary came from the real dry run -- ' +
    JSON.stringify((H.stagedText() || '').slice(0, 44)));
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-277-r2-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
