/* CLCPA-301, in a real browser: the IMPORT path never computes row Grand
 * Totals.
 *
 * The owner's live reproduction is preserved in H1/2096 on the org. 2096 is
 * NOT touched: this reproduces on fresh scratch years in localStorage.
 *
 * The file goes through the REAL Add Data dialog and the REAL hidden file
 * input, as a real File on a real change event, then Load Data is really
 * clicked. Feeding the parser directly would prove the parser and miss
 * everything the page does afterwards -- which is where the hosted FAILs live.
 *
 * Usage: node repro_301.js [label]
 */
const path = require('path');
const { open } = require('c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/_kit/live_browser.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const LABEL = process.argv[2] || 'PRE-FIX';

/* H1: Borough / County | Non-DAC Repairs | DAC Repairs | Grand Total
 *
 * Rows 1-3 fully numeric with the total column carrying the TEMPLATE'S OWN
 * (calculated) marker instead of a figure -- the shape the template hands the
 * preparer. Row 4 files a total that disagrees with its parts, which must be
 * KEPT and named: that is the CLCPA-278 guardian, and this ticket must not
 * trade one for the other. */
const CSV = [
  'Borough / County,Non-DAC Repairs,DAC Repairs,Grand Total',
  'Manhattan,100,200,(calculated)',
  'Queens,300,400,(calculated)',
  'Bronx,50,25,(calculated)',
  'Westchester,10,20,999',
].join('\n');

const seedFor = (year) => `
  localStorage.setItem('dac:years', JSON.stringify(['${year}']));
  localStorage.setItem('dac:overrides', JSON.stringify({
    'H1:${year}': [['Placeholder', 1, 2, 3]]
  }));
`;

/** text without a regex: an escaped \s in a CDP expression has eaten letters */
const textOf = async (B, sel) => {
  const t = await B.eval('(function(){var e=document.querySelector(' +
    JSON.stringify(sel) + ');return e?e.textContent:"";})()');
  return String(t || '').split(/\s+/).join(' ').trim();
};

async function run(B, D, year, provenance, say) {
  say('');
  say('--- ' + provenance + '  H1 / ' + year + ' -------------------------');
  await D.gotoIngest();
  await D.pick('H', 'H1', year);
  say('  editable rows before : ' + await D.editableRowCount());

  await B.click('#ingest-addyear');
  await sleep(700);
  await B.run(
    'var y=document.getElementById("dlg-newyear"); if(y){y.value=' + JSON.stringify(year) +
    '; y.dispatchEvent(new Event("input",{bubbles:true})); y.dispatchEvent(new Event("change",{bubbles:true}));}' +
    'var s=document.getElementById("dlg-section"); if(s){s.value="H"; s.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(400);
  await B.run(
    'var t=document.getElementById("dlg-table"); if(t){t.value="H1"; t.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(400);

  await B.run(
    'var dt = new DataTransfer();' +
    'dt.items.add(new File([' + JSON.stringify(CSV) + '], "H1_' + year + '.csv", { type: "text/csv" }));' +
    'var el = document.getElementById("ingest-file");' +
    'if (!el) throw new Error("no #ingest-file in the dialog");' +
    'el.files = dt.files;' +
    'el.dispatchEvent(new Event("change", { bubbles: true }));');
  await sleep(900);
  say('  staged notice        : ' + (await textOf(B, '.ingest-staged, .dlg-staged, .modal')).slice(0, 150));

  /* Load Data, really clicked */
  const clicked = await B.run(
    'var b=Array.from(document.querySelectorAll("button")).filter(function(x){' +
    'return x.textContent.trim()==="Load Data";})[0];' +
    'if(!b) return "NO LOAD DATA BUTTON"; b.click(); return "clicked";');
  say('  Load Data            : ' + clicked);
  await sleep(1500);

  say('  editable rows after  : ' + await D.editableRowCount());
  const n = await D.editableRowCount();
  for (let r = 0; r < Math.min(n, 6); r++) {
    const cells = [];
    for (let c = 0; c < 4; c++) cells.push(await D.cellText(r, c));
    say('    row ' + r + ': ' + JSON.stringify(cells));
  }
  const draft = await B.eval(
    'JSON.parse(JSON.stringify(window.__dacState ? window.__dacState.ingest.draft : null))');
  say('  DRAFT                : ' + JSON.stringify(draft));
  const notice = await textOf(B, '#ingest-import-mount');
  say('  notice               : ' + notice.slice(0, 200));
}

(async () => {
  const say = (s) => console.log(s);
  say('======================================================================');
  say('CLCPA-301 ' + LABEL + ' -- import and the row Grand Total, in Chrome');
  say('======================================================================');

  for (const [prov, year] of [['USER-ADDED', '2097'], ['SEED-SHAPED', '2095']]) {
    const D = await open({ seedStorage: seedFor(year) });
    try {
      await run(D.B, D, year, prov, say);
      await D.B.screenshot(path.join(__dirname,
        'repro_301_' + LABEL.toLowerCase().replace(/[^a-z]/g, '') + '_' + year + '.png'));
      say('  page errors          : ' + (D.errors().join(' | ') || 'none'));
    } finally { await D.close(); }
  }
})().catch(e => { console.error('REPRO FAILED: ' + (e && e.stack || e)); process.exit(1); });
