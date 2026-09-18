/* CLCPA-276 round 2: a notice is REPAINTED with the grid, not merely cleared.
 *
 * THE LIVE REPRODUCTION CAME FIRST. Round 1 cleared the right state and was
 * wired to no live path, and a suite driving slices could never have seen it.
 * Driven through the real page:
 *
 *   type into H1 2025 so a total stops adding up -> amber advisory appears
 *   press Reset and answer the discard guard      -> draft restored to
 *                                                     [Manhattan,1309,491,1800]
 *                                                     importResult is null
 *                                                     AND THE AMBER IS STILL
 *                                                     ON SCREEN, naming the
 *                                                     dead draft's figures
 *   switch 2025 -> 2024                           -> the notice follows, still
 *                                                     naming a 2025 row, while
 *                                                     2024 reconciles cleanly
 *
 * THE CAUSE, and it is one line's worth: the notices are not in the mount the
 * editor repaints. #ingest-import-mount and #ingest-editor-mount are SIBLINGS
 * in renderIngestPage, and rerenderIngestEditor() only ever touched the
 * second. Every exit the owner listed comes through it -- the year picker,
 * Reset, a successful save, delete-row, add-row -- while the section and table
 * pickers go through rerenderIngestAll(), which rebuilds the page and was the
 * only gesture that ever cleared anything. That is exactly the shape the
 * hosted pass reported.
 *
 * REPAINTED, NOT CLEARED, which is the ruling and which this suite separates:
 * the same repaint that drops a DEAD draft's advisory KEEPS a live one, because
 * renderIngestImport() recomputes from the current draft every time it runs. A
 * clear-only fix passes the first half and fails the second.
 *
 * BASE predates the change: ec6d208, CLCPA-274 round 2.
 *
 * Run:  node suite_276_r2.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { boot } = require('../_kit/live_editor.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || 'ec6d208';
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

const fresh = (src) => boot({ payload: JSON.parse(JSON.stringify(P)),
  tableId: 'H1', year: '2025', src: src });
const says = (H) => (H.noticeText() || '').indexOf('Does not add up') >= 0;
const ROW0 = '["Manhattan",1309,491,1800]';

log('======================================================================');
log('CLCPA-276 round 2 -- the notice area is repainted with the grid');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the two mounts are siblings, which is the whole cause ----------- */
log('');
log('A. WHY CLEARING THE STATE WAS NOT ENOUGH');
guard('A-block', () => {
  const H = fresh(SRC);
  const notice = H.doc.getElementById('ingest-import-mount');
  const editor = H.doc.getElementById('ingest-editor-mount');
  ok(notice && editor, 'A1 both mounts exist on the page');
  ok(notice !== editor, 'A2 and they are DIFFERENT nodes');
  ok(notice.parentNode === editor.parentNode,
    'A3 siblings, not nested -- so repainting one cannot repaint the other');
});

/* ---- B. the defect, reproduced on BASE ---------------------------------- */
log('');
log('B. THE DEFECT, ON THE BUILD THAT SHIPPED IT');
guard('B: Reset', () => {
  const H = fresh(BASE_SRC);
  H.typeInCell(0, 3, 9999);
  ok(says(H), 'B1 typing a disagreement raises the advisory');
  H.clickReset();
  ok(JSON.stringify(H.draft()[0]) === ROW0,
    'B2 Reset restores the draft -- ' + JSON.stringify(H.draft()[0]));
  ok(H.ingest().importResult === null, 'B3 and the STATE was cleared: importResult is null');
  ok(says(H), 'B4 yet the advisory is STILL ON SCREEN, describing the dead draft');
});
guard('B: year switch', () => {
  const H = fresh(BASE_SRC);
  H.typeInCell(0, 3, 9999);
  H.switchYear('2024');
  ok(says(H), 'B5 and it follows a year switch onto a year that reconciles cleanly');
  const rec = H.api.reconcileSumColumns(H.draft(), H.ingest().schema, 'H1');
  ok(rec.length === 0, 'B6 while 2024 has no discrepancy of its own -- ' + rec.length);
});

/* ---- C. the fix, on every exit the owner listed ------------------------- */
log('');
log('C. EVERY EXIT, ON THE LIVE PAGE');
guard('C: Reset', () => {
  const H = fresh(SRC);
  H.typeInCell(0, 3, 9999);
  ok(says(H), 'C1 the advisory appears on the edit');
  H.clickReset();
  ok(JSON.stringify(H.draft()[0]) === ROW0, 'C2 Reset restores the draft');
  ok(!says(H), 'C3 and the notice area is now empty -- ' +
    JSON.stringify(H.noticeText().slice(0, 40)));
});
guard('C: year switch', () => {
  const H = fresh(SRC);
  H.typeInCell(0, 3, 9999);
  H.switchYear('2024');
  ok(!says(H), 'C4 a year switch leaves nothing behind');
  ok(H.draft()[0][1] === 1242, 'C5 and really did load 2024 -- ' + JSON.stringify(H.draft()[0]));
});
guard('C: add row', () => {
  const H = fresh(SRC);
  H.typeInCell(0, 3, 9999);
  const add = H.doc.getElementById('ingest-add-row');
  ok(!!add, 'C6 the add-row control is on the page');
  add.dispatchEvent({ type: 'click' });
  /* THE HALF A CLEAR-ONLY FIX FAILS: the draft still disagrees, so the
   * advisory must SURVIVE this repaint. */
  ok(says(H), 'C7 a repaint KEEPS a live discrepancy -- recomputed, not cleared');
  ok(H.draft()[0][1] + H.draft()[0][2] !== H.draft()[0][3],
    'C8 and the draft really does still disagree');
});
guard('C: the discard guard is honoured', () => {
  const H = fresh(SRC);
  H.typeInCell(0, 3, 9999);
  const b = H.doc.getElementById('ingest-reset');
  b.dispatchEvent({ type: 'click' });
  ok(H.modalOpen(), 'C9 Reset opens the shared discard guard rather than acting at once');
  H.confirmModal('cancel');
  ok(H.draft()[0][3] === 9999,
    'C10 and CANCELLING it changes nothing -- ' + JSON.stringify(H.draft()[0]));
  ok(says(H), 'C11 including the advisory, which still describes the live draft');
});

/* ---- D. fixed in ONE place ---------------------------------------------- */
log('');
log('D. ONE PLACE, NOT FIVE');
guard('D-block', () => {
  const code = codeOnly(SRC);
  const fn = /function rerenderIngestEditor\(\) \{[\s\S]*?\n  \}/.exec(code);
  ok(!!fn, 'D1 rerenderIngestEditor is where the repaint lives');
  ok(/refreshIngestNotices\(\);/.test(fn[0]),
    'D2 and it now repaints the notice mount too');
  /* the callers that inherit the fix, counted in the shipped source */
  const callers = (code.match(/rerenderIngestEditor\(\);/g) || []).length;
  ok(callers === 5, 'D3 five call sites inherit it: the year picker, Reset, save, ' +
    'delete-row and add-row -- ' + callers);
  ok(/function rerenderIngestAll\(\) \{[\s\S]*?renderIngestPage\(\)/.test(code),
    'D4 while the section and table pickers rebuild the whole page as before');
  /* and the round-1 helper is still the thing that ends the draft's state */
  ok(/clearIngestNotices\(/.test(code), 'D5 clearIngestNotices survives: state and paint are different jobs');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha');
  /* Reset is TWO gestures. A driver that only pressed the button would measure
   * a Reset that never ran and "prove" a defect that was an unanswered modal. */
  const H = fresh(SRC);
  H.typeInCell(0, 3, 9999);
  H.doc.getElementById('ingest-reset').dispatchEvent({ type: 'click' });
  ok(H.modalOpen() && H.draft()[0][3] === 9999,
    'X2 pressing Reset alone does NOT reset: the guard is still open');
  H.confirmModal();
  ok(H.draft()[0][3] === 1800, 'X3 it takes answering the guard, which the driver does');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-276-r2-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
