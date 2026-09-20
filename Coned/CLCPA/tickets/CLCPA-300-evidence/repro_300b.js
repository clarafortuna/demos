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
const { open } = require(_dacRepo() + '/Coned/CLCPA/tickets/_kit/live_browser.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const CSV = [
  'Participant Type,Program Name,Total Participants,Avg. Incentives by Participant,Avg. Energy Savings by Participant (MMBtu)',
  'Residential,EmPower+,100,200,3',
  'Residential,Other Programme,150,250,4',
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
  await D.gotoIngest(); await D.pick('A', 'A3', '2094'); await sleep(500);
  await B.click('#ingest-addyear'); await sleep(700);
  await B.run('var y=document.getElementById("dlg-newyear");if(y){y.value="2094";y.dispatchEvent(new Event("input",{bubbles:true}));y.dispatchEvent(new Event("change",{bubbles:true}));}'
    + 'var s=document.getElementById("dlg-section");if(s){s.value="A";s.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(400);
  await B.run('var t=document.getElementById("dlg-table");if(t){t.value="A3";t.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(400);
  await B.run('var dt=new DataTransfer();dt.items.add(new File([' + JSON.stringify(CSV) + '],"A3_2094.csv",{type:"text/csv"}));'
    + 'var el=document.getElementById("ingest-file");el.files=dt.files;el.dispatchEvent(new Event("change",{bubbles:true}));');
  await sleep(900);
  console.log('  A3 STAGED : ' + (await textOf(B, '.ingest-staged')).slice(0, 150));
  await D.close();
})().catch(e => { console.error('FAILED: ' + (e && e.stack || e)); process.exit(1); });
