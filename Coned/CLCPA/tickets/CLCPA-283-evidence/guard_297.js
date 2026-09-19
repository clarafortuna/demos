/* CLCPA-297 guardian: the dirty-draft prompt on a year switch must still fire.
 * The owner verified that prompt himself and it must not die in 283's change. */
const { open } = require('c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/_kit/live_browser.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const SEED = `
  localStorage.setItem('dac:years', JSON.stringify(['2094']));
  localStorage.setItem('dac:overrides', JSON.stringify({}));
`;
(async () => {
  const D = await open({ seedStorage: SEED });
  const B = D.B;
  await D.gotoIngest(); await D.pick('H','H1','2094');
  await D.clickAddRow(); await sleep(300);
  await D.typeCell(0,0,'DirtyDraft'); await sleep(300);
  console.log('draft is dirty, now switching year without saving...');
  await B.run('var y=document.getElementById("ingest-year"); y.value="2025"; y.dispatchEvent(new Event("change",{bubbles:true}));');
  await sleep(700);
  const prompt = await B.eval('(function(){var e=document.querySelector(\'[data-cfm="confirm"]\');' +
    'var m=document.querySelector(".ingest-modal,.modal,[role=dialog]");' +
    'return {guardPresent:!!e, text:m?m.textContent.replace(/[ ]+/g," ").trim().slice(0,180):""};})()');
  console.log('CLCPA-297 discard guard: ' + JSON.stringify(prompt));
  console.log(prompt.guardPresent ? '  -> STILL FIRES' : '  -> GONE (regression)');
  await D.close();
  process.exit(prompt.guardPresent ? 0 : 1);
})().catch(e=>{console.error(e&&e.stack||e);process.exit(1);});
