/* CLCPA-300: the staged summary's "matching columns" counts columns that are
 * never imported, and misses one that is.
 *
 * H1: four columns, one of them the calculated Grand Total. A file supplying
 * all four reports "3 matching columns" while only TWO carry values into the
 * draft -- the third counted column is the calculated one, which the importer
 * deliberately skips. The VALUE count is right.
 */
const { open } = require('c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/_kit/live_browser.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const LABEL = process.argv[2] || 'PRE-FIX';
const CSV = [
  'Borough / County,Non-DAC Repairs,DAC Repairs,Grand Total',
  'Manhattan,100,200,(calculated)',
  'Queens,300,400,(calculated)',
].join('\n');
const SEED = `localStorage.setItem('dac:years', JSON.stringify(['2094']));
  localStorage.setItem('dac:overrides', JSON.stringify({}));`;
const textOf = async (B, sel) => {
  const t = await B.eval('(function(){var e=document.querySelector(' + JSON.stringify(sel) + ');return e?e.textContent:"";})()');
  return String(t || '').split(/\s+/).join(' ').trim();
};
(async () => {
  const D = await open({ seedStorage: SEED });
  const B = D.B;
  console.log('=== CLCPA-300 ' + LABEL + ' ===');
  console.log('H1 has 4 columns; the file supplies all 4; Grand Total is calculated and skipped.');
  console.log('So TWO columns carry values. The value count (4) is right either way.');
  console.log('');
  await D.gotoIngest(); await D.pick('H', 'H1', '2094'); await sleep(500);
  await B.click('#ingest-addyear'); await sleep(700);
  await B.run('var y=document.getElementById("dlg-newyear");if(y){y.value="2094";y.dispatchEvent(new Event("input",{bubbles:true}));y.dispatchEvent(new Event("change",{bubbles:true}));}'
    + 'var s=document.getElementById("dlg-section");if(s){s.value="H";s.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(400);
  await B.run('var t=document.getElementById("dlg-table");if(t){t.value="H1";t.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(400);
  await B.run('var dt=new DataTransfer();dt.items.add(new File([' + JSON.stringify(CSV) + '],"H1_2094.csv",{type:"text/csv"}));'
    + 'var el=document.getElementById("ingest-file");el.files=dt.files;el.dispatchEvent(new Event("change",{bubbles:true}));');
  await sleep(900);
  console.log('  STAGED SUMMARY : ' + (await textOf(B, '.ingest-staged')).slice(0, 160));
  await D.close();
})().catch(e => { console.error('FAILED: ' + (e && e.stack || e)); process.exit(1); });
