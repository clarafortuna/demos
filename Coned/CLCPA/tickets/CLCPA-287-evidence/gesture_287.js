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
/* CLCPA-287: the rejection report the dialog PROMISES is never rendered.
 *
 * The dialog's own words: "Add Year will still add the year, and the page will
 * say what was rejected." Measured: the page says nothing. The only trace is
 * the red note inside the dialog, which disappears when it closes.
 *
 * Both gestures the owner named: a WRONG-TABLE rejection and a MALFORMED-FILE
 * rejection.
 */
const { open } = require(_dacRepo() + '/Coned/CLCPA/tickets/_kit/live_browser.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const LABEL = process.argv[2] || 'PRE-FIX';

/* a file whose headings belong to a DIFFERENT table */
const WRONG_TABLE = [
  'Participant Type,Program Name,Total Participants',
  'Residential,EmPower+,100',
].join('\n');
/* a file with two columns sharing one heading: malformed for any table */
const MALFORMED = [
  'Borough / County,Non-DAC Repairs,Non-DAC Repairs,Grand Total',
  'Manhattan,100,200,300',
].join('\n');

const SEED = `localStorage.setItem('dac:years', JSON.stringify(['2094']));
  localStorage.setItem('dac:overrides', JSON.stringify({}));`;
const textOf = async (B, sel) => {
  const t = await B.eval('(function(){var e=document.querySelector(' + JSON.stringify(sel) + ');return e?e.textContent:"";})()');
  return String(t || '').split(/\s+/).join(' ').trim();
};

async function attempt(B, D, csv, name, note, say) {
  say('');
  say('--- ' + note + ' ---------------------------------');
  await D.gotoIngest(); await D.pick('H', 'H1', '2094'); await sleep(500);
  await B.click('#ingest-addyear'); await sleep(700);
  await B.run('var y=document.getElementById("dlg-newyear");if(y){y.value="2094";y.dispatchEvent(new Event("input",{bubbles:true}));y.dispatchEvent(new Event("change",{bubbles:true}));}'
    + 'var s=document.getElementById("dlg-section");if(s){s.value="H";s.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(400);
  await B.run('var t=document.getElementById("dlg-table");if(t){t.value="H1";t.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(400);
  await B.run('var dt=new DataTransfer();dt.items.add(new File([' + JSON.stringify(csv) + '],' + JSON.stringify(name) + ',{type:"text/csv"}));'
    + 'var el=document.getElementById("ingest-file");el.files=dt.files;el.dispatchEvent(new Event("change",{bubbles:true}));');
  await sleep(900);
  say('  DIALOG says   : ' + (await textOf(B, '.ingest-staged')).slice(0, 190));
  await B.run('var b=Array.from(document.querySelectorAll("button")).filter(function(x){return x.textContent.trim()==="Load Data";})[0]; if(b)b.click();');
  await sleep(1500);
  const dialogOpen = await B.eval('!!document.querySelector(".ingest-modal")');
  say('  dialog still open after Load Data: ' + dialogOpen);
  /* close it, as the operator would, and see what the PAGE says */
  await B.run('var c=document.getElementById("ingest-modal-close")||document.getElementById("ingest-modal-cancel"); if(c)c.click();');
  await sleep(700);
  const mount = await textOf(B, '#ingest-import-mount');
  say('  PAGE says     : ' + (mount ? mount.slice(0, 190) : '(NOTHING -- the mount is empty)'));
  say('  year added?   : ' + JSON.stringify(await B.eval('JSON.parse(localStorage.getItem("dac:years")||"[]")')));
}

(async () => {
  const say = (s) => console.log(s);
  say('=== CLCPA-287 ' + LABEL + ' ===');
  say('The dialog promises: "Add Year will still add the year, and the page will say what was rejected."');
  const D = await open({ seedStorage: SEED });
  try {
    await attempt(D.B, D, WRONG_TABLE, 'A3_wrong_table.csv', 'WRONG TABLE: an A3 file offered to H1', say);
    await attempt(D.B, D, MALFORMED, 'H1_malformed.csv', 'MALFORMED: two columns share one heading', say);
    say('');
    say('  page errors: ' + (D.errors().join(' | ') || 'none'));
  } finally { await D.close(); }
})().catch(e => { console.error('FAILED: ' + (e && e.stack || e)); process.exit(1); });
