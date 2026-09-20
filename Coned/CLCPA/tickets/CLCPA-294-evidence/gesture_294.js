/* CLCPA-294, in a real browser: a computed percentage at or above 1 loses the
 * x100 and renders as a tiny number.
 *
 * A1's "% in DACs" is computed from two columns in the same row. Four rows,
 * chosen to straddle the heuristic's boundary at 1.
 */
const fs = require('fs');
const path = require('path');
const { open } = require('c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/_kit/live_browser.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const LABEL = process.argv[2] || 'PRE-FIX';

const SEED = `
  localStorage.setItem('dac:years', JSON.stringify(['2098']));
  localStorage.setItem('dac:overrides', JSON.stringify({
    'A1:2098': [
      ["Below one", 888, 333, null],
      ["Exactly one", 333, 333, null],
      ["Above one", 333, 777, null],
      ["Far above", 0.1, 555, null],
      ["Small share", 100000, 500, null]
    ]
  }));
`;
const rowsOf = (B, sel) => B.eval(
  '(function(){return Array.from(document.querySelectorAll(' + JSON.stringify(sel) + '))' +
  '.map(function(tr){return Array.from(tr.querySelectorAll("td,th")).map(function(c){' +
  'var i=c.querySelector("input"); return i? i.value : c.textContent.trim();});})' +
  '.filter(function(r){return r.length;});})()');

(async () => {
  const D = await open({ seedStorage: SEED });
  const B = D.B;
  console.log('=== CLCPA-294 ' + LABEL + ' ===');
  console.log('expected: 333/888=37.5%, 333/333=100%, 777/333=233.3%, 555/0.1=555000%, 500/100000=0.5%');
  console.log('');
  console.log('--- SECTION PAGE, A1 / 2098 ---');
  await B.run('location.hash = "#/section/A";'); await sleep(1100);
  await B.run('var y=document.getElementById("year-select"); if(y){y.value="2098";y.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(800);
  await B.click('[data-table-id="A1"]'); await sleep(900);
  (await rowsOf(B, 'table tbody tr')).slice(0, 6).forEach(r => console.log('  ' + JSON.stringify(r)));
  console.log('');
  console.log('--- EDITOR, A1 / 2098 ---');
  await D.gotoIngest(); await D.pick('A', 'A1', '2098'); await sleep(700);
  (await rowsOf(B, '#ingest-editor-mount tbody tr')).slice(0, 6).forEach(r => console.log('  ' + JSON.stringify(r)));
  await B.screenshot(path.join(__dirname, 'repro_294_' + LABEL.toLowerCase().replace(/[^a-z]/g,'') + '.png'));
  console.log('');
  console.log('  page errors: ' + (D.errors().join(' | ') || 'none'));
  await D.close();
})().catch(e => { console.error('FAILED: ' + (e && e.stack || e)); process.exit(1); });
