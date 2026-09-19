/* CLCPA-301: does the computed total SURVIVE THE SAVE and a reload?
 * The ticket's symptom is "land and SAVE with no row totals", so the save leg
 * is part of the gesture, not an extra. */
const { open } = require('c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/_kit/live_browser.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const CSV = ['Borough / County,Non-DAC Repairs,DAC Repairs,Grand Total',
  'Manhattan,100,200,(calculated)','Queens,300,400,(calculated)',
  'Bronx,50,25,(calculated)','Westchester,10,20,999'].join('\n');
const SEED = `
  localStorage.setItem('dac:years', JSON.stringify(['2097']));
  localStorage.setItem('dac:overrides', JSON.stringify({'H1:2097': [['Placeholder',1,2,3]]}));
`;
(async () => {
  const D = await open({ seedStorage: SEED });
  const B = D.B;
  await D.gotoIngest(); await D.pick('H','H1','2097');
  await B.click('#ingest-addyear'); await sleep(700);
  await B.run('var y=document.getElementById("dlg-newyear");if(y){y.value="2097";y.dispatchEvent(new Event("input",{bubbles:true}));y.dispatchEvent(new Event("change",{bubbles:true}));}'+
    'var s=document.getElementById("dlg-section");if(s){s.value="H";s.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(400);
  await B.run('var t=document.getElementById("dlg-table");if(t){t.value="H1";t.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(400);
  await B.run('var dt=new DataTransfer();dt.items.add(new File(['+JSON.stringify(CSV)+'],"H1_2097.csv",{type:"text/csv"}));'+
    'var el=document.getElementById("ingest-file");el.files=dt.files;el.dispatchEvent(new Event("change",{bubbles:true}));');
  await sleep(900);
  await B.run('var b=Array.from(document.querySelectorAll("button")).filter(function(x){return x.textContent.trim()==="Load Data";})[0];if(b)b.click();');
  await sleep(1400);

  console.log('AFTER IMPORT, before save:');
  for (let r=0;r<5;r++){const c=[];for(let k=0;k<4;k++)c.push(await D.cellText(r,k));console.log('  row '+r+': '+JSON.stringify(c));}

  const answered = await D.clickSave();
  console.log('save confirm dialog: ' + (answered ? 'answered' : 'none'));

  const stored = await B.eval('JSON.parse(localStorage.getItem("dac:overrides"))["H1:2097"]');
  console.log('STORED after save : ' + JSON.stringify(stored));

  /* and what a fresh page shows, which is what the operator comes back to */
  await B.run('location.reload();'); await sleep(2500);
  await D.gotoIngest(); await D.pick('H','H1','2097'); await sleep(600);
  console.log('AFTER RELOAD:');
  const n = await D.editableRowCount();
  for (let r=0;r<Math.min(n,5);r++){const c=[];for(let k=0;k<4;k++)c.push(await D.cellText(r,k));console.log('  row '+r+': '+JSON.stringify(c));}
  console.log('page errors: ' + (D.errors().join(' | ')||'none'));
  await D.close();
})().catch(e=>{console.error('FAILED: '+(e&&e.stack||e));process.exit(1);});
