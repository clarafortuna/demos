const { open } = require('c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/_kit/live_browser.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const MALFORMED = ['Borough / County,Non-DAC Repairs,Non-DAC Repairs,Grand Total','Manhattan,100,200,300'].join('\n');
const SEED = `localStorage.setItem('dac:years', JSON.stringify(['2094','2093']));
  localStorage.setItem('dac:overrides', JSON.stringify({'H1:2094':[['Manhattan',1,2,3]]}));`;
const textOf = async (B, sel) => {
  const t = await B.eval('(function(){var e=document.querySelector(' + JSON.stringify(sel) + ');return e?e.textContent:"";})()');
  return String(t || '').split(/\s+/).join(' ').trim();
};
const has = async (B) => ((await textOf(B, '#ingest-import-mount')) || '').indexOf('Nothing was imported') >= 0;
const btns = (B) => B.eval('(function(){var r=document.getElementById("ingest-reset"),s=document.getElementById("ingest-save");return {reset:r?r.disabled:null,save:s?s.disabled:null,status:(document.querySelector(".ingest-status")||{}).textContent};})()');
(async () => {
  const D = await open({ seedStorage: SEED });
  const B = D.B;
  await D.gotoIngest(); await D.pick('H','H1','2094'); await sleep(600);
  console.log('rows in editor: ' + await D.editableRowCount());
  console.log('row 0 cells   : ' + JSON.stringify([0,1,2,3].map ? await Promise.all([0,1,2,3].map(c=>D.cellText(0,c))) : null));
  // reject
  await B.click('#ingest-addyear'); await sleep(800);
  await B.run('var y=document.getElementById("dlg-newyear");if(y){y.value="2094";y.dispatchEvent(new Event("input",{bubbles:true}));y.dispatchEvent(new Event("change",{bubbles:true}));}var s=document.getElementById("dlg-section");if(s){s.value="H";s.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(500);
  await B.run('var t=document.getElementById("dlg-table");if(t){t.value="H1";t.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(500);
  await B.run('var dt=new DataTransfer();dt.items.add(new File([' + JSON.stringify(MALFORMED) + '],"bad.csv",{type:"text/csv"}));var el=document.getElementById("ingest-file");el.files=dt.files;el.dispatchEvent(new Event("change",{bubbles:true}));');
  await sleep(900);
  await B.run('var b=Array.from(document.querySelectorAll("button")).filter(function(x){return x.textContent.trim()==="Load Data";})[0]; if(b)b.click();');
  await sleep(1300);
  await B.run('var c=document.getElementById("ingest-modal-close")||document.getElementById("ingest-modal-cancel"); if(c)c.click();');
  await sleep(700);
  console.log('report present : ' + await has(B));
  console.log('buttons        : ' + JSON.stringify(await btns(B)));
  // dirty it
  await D.typeCell(0, 1, '77'); await sleep(600);
  console.log('after typing   : ' + JSON.stringify(await btns(B)));
  console.log('report present : ' + await has(B));
  // reset
  await B.click('#ingest-reset'); await sleep(600);
  console.log('discard prompt : ' + await B.eval('!!document.querySelector(\'[data-cfm="confirm"]\')'));
  await B.run('var c=document.querySelector(\'[data-cfm="confirm"]\'); if(c)c.click();');
  await sleep(900);
  console.log('after Reset    : report present = ' + await has(B) + ', buttons = ' + JSON.stringify(await btns(B)));
  await D.close();
})().catch(e => { console.error('FAILED: ' + (e && e.stack || e)); process.exit(1); });
