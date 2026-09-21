/* CLCPA-302 round 2, THE RULING'S GESTURE IN A REAL BROWSER.
 *
 *   "Verify with the exact gesture: one edit on B2/2098, confirm says 1,
 *    history shows the operator's cell as EDIT and the recompute
 *    distinctly or not at all."
 *
 * The Node bench proves the logic and suite_302_r2 pins it. It cannot see
 * the sentence the operator reads in the confirm modal, and that sentence
 * is half of what the ticket is about. So the edit is typed into the real
 * cell, the real blur commits it, the modal's own words are read BEFORE it
 * is confirmed, and the history is read back out of the store afterwards.
 *
 * Run it against each build in turn:
 *   node live_302_r2.js            (the working tree)
 *   DAC_302_BUILD=base node live_302_r2.js   (the pre-change commit)
 *
 * The base leg serves a throwaway copy of the tree with the pinned app.js
 * dropped in, so the two legs differ in that one file and nothing else.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const live = require('../_kit/live_browser.js');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const BASE = process.env.DAC_BASE_COMMIT || '8bf5ea7';
const WHICH = (process.env.DAC_302_BUILD || 'now').toLowerCase();
const OUT = path.join(__dirname, 'live-302-r2-' + WHICH + '-output.txt');
const SHOT = path.join(__dirname, 'live-302-r2-' + WHICH + '-confirm.png');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; log('  PASS  ' + m); } else { fail++; log('  FAIL  ' + m); } };

/* The ticket's figures, seeded as the stored year so the gesture starts
 * from exactly what the owner had on screen.
 *
 * FIVE COLUMNS, and that is not cosmetic. B2's schema is year-dependent:
 * four columns in 2023 and 2024, five from 2025, and a year past the last
 * declared one resolves to the latest. Seeded four wide, the grid rendered
 * five, Total Plugs was the empty fifth, nothing recomputed on blur and
 * BOTH builds said 1 -- a differential with no difference in it, which
 * would have read as the fix working. */
const YEAR = '2098';
const SEED = [['DAC', 50, 10, 0, 60], ['Non-DAC', 97, 40, 0, 137],
  ['Total', 147, 50, 0, 197]];
const COL = { l2: 1, total: 4 };

/* serving directory: the tree itself, or a copy carrying the pinned app.js */
function serveDir() {
  if (WHICH !== 'base') return DEV;
  const dir = path.join(os.tmpdir(), 'clcpa302r2-base-' + BASE);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(DEV, dir, { recursive: true });
  const src = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
    .toString('utf8').replace(/\r?\n/g, '\r\n');
  fs.writeFileSync(path.join(dir, 'app.js'), src);
  return dir;
}

(async () => {
  const dir = serveDir();
  log('CLCPA-302 round 2, in Chrome: the ruling\'s gesture on B2/' + YEAR);
  log('build: ' + (WHICH === 'base' ? 'BASE ' + BASE + ' (pinned copy)' : 'working tree'));
  log('served from: ' + dir);
  log('');

  const seed = 'localStorage.setItem("dac:years", JSON.stringify(["' + YEAR + '"]));' +
    'localStorage.setItem("dac:overrides", JSON.stringify({"B2:' + YEAR + '": ' +
    JSON.stringify(SEED) + '}));' +
    'localStorage.setItem("dac:history", "[]");';

  const D = await live.open({ dir, seedStorage: seed });
  try {
    await D.gotoIngest();
    await D.pick('B', 'B2', YEAR);

    /* the header is READ and asserted: a seed indexed by hand against a
     * year-dependent schema is how the first run of this measured nothing */
    const head = await D.headerRows();
    log('the header the grid renders  : ' + JSON.stringify(head[head.length - 1]));
    ok((head[head.length - 1] || [])[COL.total] === 'Total Plugs',
      'column ' + COL.total + ' is Total Plugs, as this seed assumes');
    ok((head[head.length - 1] || [])[COL.l2] === 'L2 Plugs',
      'column ' + COL.l2 + ' is L2 Plugs, the cell the operator edits');
    const before = await D.bodyRow(1);
    log('the Non-DAC row as it renders: ' + JSON.stringify(before));
    ok(String(before).indexOf('97') >= 0,
      'the seeded 97 is on screen before the edit');

    /* THE EDIT: typed, then blurred, which is what commits it */
    await D.typeCell(1, COL.l2, '100');
    const after = await D.bodyRow(1);
    log('after the edit and blur         : ' + JSON.stringify(after));
    ok(String(after).indexOf('140') >= 0,
      'the engine recomputed Total Plugs to 140 on blur');

    /* THE SENTENCE THE OPERATOR READS, before anything is confirmed */
    await D.B.click('#ingest-save');
    await new Promise(r => setTimeout(r, 700));
    const modal = await D.B.eval(
      '(function(){var m=document.querySelector(".ingest-modal");' +
      'return m? m.textContent.replace(/\\s+/g," ").trim() : null;})()');
    ok(!!modal, 'the confirm modal opened');
    const said = (/about to save (\d+) cell change/.exec(modal || '') || [])[1];
    log('');
    log('THE CONFIRM SAYS: "You are about to save ' + said + ' cell change' +
      (said === '1' ? '' : 's') + '"');
    await D.shot(SHOT);
    log('screenshot: ' + path.basename(SHOT));
    ok(said === (WHICH === 'base' ? '2' : '1'),
      'the confirm count is ' + said + ' (expected ' +
      (WHICH === 'base' ? '2 on the pre-change build' : '1, the operator\'s own cell') + ')');

    await D.B.click('#ingest-modal-confirm');
    await new Promise(r => setTimeout(r, 1200));

    /* THE HISTORY, read out of the store the save wrote */
    const hist = await D.B.eval(
      '(function(){try{return JSON.parse(localStorage.getItem("dac:history")||"[]");}' +
      'catch(e){return null;}})()');
    const entry = (hist || []).find(h => h.tableId === 'B2' && String(h.year) === YEAR);
    log('');
    log('THE HISTORY ENTRY the save wrote:');
    log('  ' + JSON.stringify(entry && entry.changes, null, 1).replace(/\n\s*/g, ' '));
    const cells = ((entry && entry.changes) || []).filter(c => c.kind === 'cell');
    ok(!!entry, 'a history entry was written');
    ok(cells.length === (WHICH === 'base' ? 2 : 1),
      'it records ' + cells.length + ' cell change(s)');
    const labels = cells.map(c => c.rowLabel + ' / ' + c.colLabel);
    ok(labels.indexOf('Non-DAC / L2 Plugs') >= 0,
      'the operator\'s own cell is recorded: ' + JSON.stringify(labels));
    if (WHICH === 'base') {
      ok(labels.indexOf('Non-DAC / Total Plugs') >= 0,
        'and BASE also bills them for the recompute, which is the defect');
    } else {
      ok(labels.indexOf('Non-DAC / Total Plugs') < 0,
        'and the recompute is NOT billed to them: ' + JSON.stringify(labels));
    }

    /* the stored figure still moves; only the attribution changed */
    const stored = await D.storedRows('B2', YEAR);
    log('');
    log('what the store holds after the save: ' + JSON.stringify(stored));
    ok(JSON.stringify(stored) === JSON.stringify(
      [['DAC', 50, 10, 0, 60], ['Non-DAC', 100, 40, 0, 140],
        ['Total', 150, 50, 0, 200]]),
    'the saved figures are the recomputed ones, unchanged by this round');

    const errs = D.errors();
    ok(errs.length === 0, 'no page errors: ' + JSON.stringify(errs));
  } finally {
    await D.close();
  }

  log('');
  log(pass + ' passed, ' + fail + ' failed');
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  log('THREW: ' + (e && e.stack || e));
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(2);
});
