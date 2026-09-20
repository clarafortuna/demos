/* CLCPA-330 / CLCPA-325: row-type formatting, reproduced on the real section
 * pages in a real browser, through the real table tabs.
 *
 *   A9  currency_cols [1,2,3,4] is TABLE-WIDE, but A9's rows are not: row 2 is
 *       MMBtu, row 3 is a participant count, row 5 is MMBtu per participant.
 *   J8  declares no currency_cols at all, yet the owner reports a $ prefix on
 *       its percent rows.
 */
const path = require('path');
const { execSync } = require('child_process');
const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const { open } = require(path.join(ROOT, 'Coned/CLCPA/tickets/_kit/live_browser.js'));
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const READ = (tableId) => `
(function(){
  var t = document.querySelector('table[data-table-id=${JSON.stringify(tableId)}]');
  if (!t) return null;
  var out = [];
  t.querySelectorAll('tr').forEach(function(tr){
    var cells = [];
    tr.querySelectorAll('th,td').forEach(function(c){
      cells.push(c.textContent.replace(/\\s+/g,' ').trim());
    });
    if (cells.length) out.push(cells);
  });
  return out;
})()`;

const PICK = (tableId) => `
(function(){
  var tab = document.querySelector('[data-table-id=${JSON.stringify(tableId)}]:not(table)');
  if (!tab) return 'no tab';
  tab.click();
  return 'clicked';
})()`;

(async () => {
  const D = await open({ dir: DEV });
  for (const [section, tableId] of [['A', 'A9'], ['J', 'J8']]) {
    await D.B.run('location.hash = "#/section/' + section + '";');
    await sleep(2200);
    const picked = await D.B.eval(PICK(tableId));
    await sleep(1200);
    const rows = await D.B.eval(READ(tableId));
    console.log('');
    console.log('  === ' + tableId + ' as the section page renders it (tab: ' + picked + ') ===');
    if (!rows) { console.log('    (table not found)'); continue; }
    rows.forEach((r, i) => console.log('    [' + i + '] ' + JSON.stringify(r)));
    const moneyRows = rows.filter(r => r.some(c => /^\$/.test(c)));
    console.log('    rows carrying a $ prefix : ' + moneyRows.length);
    try { await D.shot(path.join(__dirname, 'repro-330-' + tableId + '.png')); } catch (e) {}
  }
  console.log('');
  console.log('  page errors: ' + JSON.stringify(D.errors()).slice(0, 200));
  await D.close();
})().catch(e => { console.error('REPRO THREW: ' + e.stack); process.exit(1); });
