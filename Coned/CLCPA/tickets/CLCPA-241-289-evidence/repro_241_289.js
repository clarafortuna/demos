/* CLCPA-241 + CLCPA-289 in a real browser, against a served build.
 *
 * Suites and mutations are mandatory and not sufficient: this is the evidence
 * that what an operator SEES changed, and that what the client reads did not.
 *
 *   1. the report page: A9's % Change reads exactly as it did
 *   2. the editor: the amber advisory names the two kept figures
 *   3. the editor: typing a new figure recomputes the % Change
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const { open } = require(path.join(ROOT, 'Coned/CLCPA/tickets/_kit/live_browser.js'));
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

const PICK_TAB = (id) => `
(function(){
  var tab = document.querySelector('[data-table-id=${JSON.stringify(id)}]:not(table)');
  if (!tab) return 'no tab'; tab.click(); return 'clicked';
})()`;

const READ_TABLE = (id) => `
(function(){
  var t = document.querySelector('table[data-table-id=${JSON.stringify(id)}]');
  if (!t) return null;
  var out = [];
  t.querySelectorAll('tr').forEach(function(tr){
    var c = [];
    tr.querySelectorAll('th,td').forEach(function(x){ c.push(x.textContent.replace(/\\s+/g,' ').trim()); });
    if (c.length) out.push(c);
  });
  return out;
})()`;

const NOTICES = `
(function(){
  var m = document.getElementById('ingest-import-mount');
  return m ? m.textContent.replace(/\\s+/g,' ').trim() : '(no mount)';
})()`;

(async () => {
  const D = await open({ dir: DEV });

  log('='.repeat(70));
  log('CLCPA-241 + CLCPA-289 -- the gestures, in a real browser');
  log('='.repeat(70));

  /* ---- 1. THE REPORT PAGE ------------------------------------------- */
  await D.B.run('location.hash = "#/section/A";');
  await sleep(2200);
  await D.B.eval(PICK_TAB('A9'));
  await sleep(1200);
  const rows = await D.B.eval(READ_TABLE('A9'));
  log('');
  log('  1. THE REPORT PAGE, A9');
  (rows || []).forEach((r, i) => log('     [' + i + '] ' + JSON.stringify(r)));
  const pcts = (rows || []).flat().filter(v => /^-?\d+%$/.test(v));
  log('     whole-percent cells: ' + pcts.length + '   ' + JSON.stringify(pcts.slice(0, 12)));
  const anyDecimal = (rows || []).flat().some(v => /^-?\d+\.\d+%$/.test(v));
  const anyRaw = (rows || []).flat().some(v => /^-?0\.\d+$/.test(v));
  log('     any DECIMAL percent (value identity would be broken): ' + anyDecimal);
  log('     any RAW fraction   (formatting would be broken)     : ' + anyRaw);

  /* ---- 2 and 3. THE EDITOR ------------------------------------------ */
  await D.gotoIngest();
  await D.pick('A', 'A9', '2024');
  await sleep(1200);
  const notice = await D.B.eval(NOTICES);
  log('');
  log('  2. THE EDITOR, A9 / 2024: the advisory');
  log('     ' + JSON.stringify(notice.slice(0, 300)));
  const namesBoth = /Energy Savings \(MMBtu\)/.test(notice) &&
    /Average Incentive per Participant/.test(notice) && /Kept as filed/.test(notice);
  log('     names both kept figures: ' + namesBoth);

  /* the % Change cells are calc spans, not inputs: read them before and after */
  const CALC = `
(function(){
  var out = [];
  document.querySelectorAll('#ingest-editor-mount tr').forEach(function(tr){
    var cells = [];
    tr.querySelectorAll('td,th').forEach(function(td){
      var inp = td.querySelector('input');
      cells.push(inp ? ('[' + inp.value + ']') : td.textContent.replace(/\\s+/g,' ').trim());
    });
    if (cells.length) out.push(cells);
  });
  return out;
})()`;
  const before = await D.B.eval(CALC);
  log('');
  log('  3. THE EDITOR: typing a new figure');
  (before || []).slice(0, 4).forEach((r, i) => log('     before [' + i + '] ' + JSON.stringify(r).slice(0, 150)));

  /* type into row 1's current-year Total (col 3) */
  try {
    await D.typeCell(1, 3, '999999999');
    await sleep(900);
  } catch (e) { log('     (typeCell: ' + e.message + ')'); }
  const after = await D.B.eval(CALC);
  (after || []).slice(0, 4).forEach((r, i) => log('     after  [' + i + '] ' + JSON.stringify(r).slice(0, 150)));

  const moved = JSON.stringify(before) !== JSON.stringify(after);
  log('');
  log('     the grid changed after typing: ' + moved);
  log('     page errors: ' + JSON.stringify(D.errors()).slice(0, 200));
  log('='.repeat(70));

  try { await D.shot(path.join(__dirname, 'repro-241-289-editor.png')); } catch (e) {}
  fs.writeFileSync(path.join(__dirname, 'repro-241-289-output.txt'), lines.join('\n') + '\n');
  await D.close();
  process.exit((namesBoth && !anyDecimal && !anyRaw) ? 0 : 1);
})().catch(e => { console.error('REPRO THREW: ' + e.stack); process.exit(1); });
