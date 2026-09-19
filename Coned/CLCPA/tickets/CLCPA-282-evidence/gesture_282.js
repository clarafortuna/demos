/* CLCPA-282 / CLCPA-285, in a real browser: a two-level table cannot
 * round-trip through the app's own importer.
 *
 * The CSVs below are EXACTLY what the templates hand the preparer for the
 * TARGET YEAR -- read out of the generated workbooks, not invented. Saving
 * that sheet as CSV is what the workbook instructs.
 *
 *   A9/2094 row 0 (group)  ,2093,2093,2094,2094,% Change,% Change
 *           row 1 (sub)    ,Total,DAC,Total,DAC,Total,DAC
 *
 * Neither row identifies a column on its own: the group row repeats each
 * year, the sub row repeats Total and DAC three times each. Only the PAIR is
 * unique. The importer read fileRows[0] and nothing else.
 *
 * THE HEADINGS NAME THE YEAR, so a CSV built from the 2025 template does not
 * import into 2094 -- the group row reads 2093/2094 there. The first cut of
 * this script made exactly that mistake and produced two columns matching out
 * of six, which looked like a defect in the fix. The template for the year
 * being filled is the one to use, and the workbook says so.
 *
 * Usage: node repro_282.js [label]
 */
const path = require('path');
const { open } = require('c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/_kit/live_browser.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const LABEL = process.argv[2] || 'PRE-FIX';

/* A9, template-shaped for 2094, with figures typed into the value columns */
const A9_CSV = [
  ',2093,2093,2094,2094,% Change,% Change',
  ',Total,DAC,Total,DAC,Total,DAC',
  'Incentives,100,50,200,120,100,140',
  'Energy Savings (MMBtu),300,150,400,220,33,47',
].join('\n');

/* A10 carries a THIRD sub-label and a calculated column */
const A10_CSV = [
  ',2093,2093,2093,2094,2094,2094',
  ',Total,DAC,% DAC,Total,DAC,% DAC',
  'Installations,1000,400,(calculated),1200,600,(calculated)',
  'Commercial,500,200,(calculated),600,300,(calculated)',
].join('\n');

/* H1 is ONE level: it must behave exactly as it does today */
const H1_CSV = [
  'Borough / County,Non-DAC Repairs,DAC Repairs,Grand Total',
  'Manhattan,100,200,(calculated)',
].join('\n');

/* A two-level table given a SINGLE header row: the old shape. It must still
 * be read as one header row and refused on its own duplicates, not silently
 * eat a data row. */
const A9_ONE_ROW_CSV = [
  ',2093,2093,2094,2094,% Change,% Change',
  'Incentives,100,50,200,120,100,140',
].join('\n');

const seedFor = (year) => `
  localStorage.setItem('dac:years', JSON.stringify(['${year}']));
  localStorage.setItem('dac:overrides', JSON.stringify({}));
`;

const textOf = async (B, sel) => {
  const t = await B.eval('(function(){var e=document.querySelector(' +
    JSON.stringify(sel) + ');return e?e.textContent:"";})()');
  return String(t || '').split(/\s+/).join(' ').trim();
};

async function attempt(B, D, section, table, year, csv, note, say) {
  say('');
  say('--- ' + table + ' / ' + year + '  ' + note + ' ---------------------');
  await D.gotoIngest();
  await D.pick(section, table, year);
  await sleep(400);

  await B.click('#ingest-addyear');
  await sleep(700);
  await B.run(
    'var y=document.getElementById("dlg-newyear"); if(y){y.value=' + JSON.stringify(year) +
    '; y.dispatchEvent(new Event("input",{bubbles:true})); y.dispatchEvent(new Event("change",{bubbles:true}));}' +
    'var s=document.getElementById("dlg-section"); if(s){s.value=' + JSON.stringify(section) +
    '; s.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(400);
  await B.run('var t=document.getElementById("dlg-table"); if(t){t.value=' + JSON.stringify(table) +
    '; t.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(400);
  await B.run(
    'var dt=new DataTransfer();' +
    'dt.items.add(new File([' + JSON.stringify(csv) + '], ' +
    JSON.stringify(table + '_' + year + '.csv') + ', {type:"text/csv"}));' +
    'var el=document.getElementById("ingest-file"); el.files=dt.files;' +
    'el.dispatchEvent(new Event("change",{bubbles:true}));');
  await sleep(900);
  say('  STAGED  : ' + (await textOf(B, '.ingest-staged')).slice(0, 200));

  await B.run('var b=Array.from(document.querySelectorAll("button"))' +
    '.filter(function(x){return x.textContent.trim()==="Load Data";})[0]; if(b)b.click();');
  await sleep(1500);

  const err = await textOf(B, '.ingest-modal .ingest-error, .ingest-modal [style*="display: block"]');
  if (err) say('  DIALOG ERROR : ' + err.slice(0, 200));
  say('  NOTICE  : ' + (await textOf(B, '#ingest-import-mount')).slice(0, 200));
  const n = await D.editableRowCount();
  say('  rows in editor: ' + n);
  for (let r = 0; r < Math.min(n, 3); r++) {
    const cells = [];
    for (let c = 0; c < 7; c++) cells.push(await D.cellText(r, c));
    say('    row ' + r + ': ' + JSON.stringify(cells.filter(x => x !== null)));
  }
}

(async () => {
  const say = (s) => console.log(s);
  say('======================================================================');
  say('CLCPA-282 / 285 ' + LABEL + ' -- a two-level CSV through the importer');
  say('======================================================================');
  const CASES = [
    ['A', 'A9', A9_CSV, '(template shape, two header rows)'],
    ['A', 'A10', A10_CSV, '(three sub-labels + a calculated column)'],
    ['H', 'H1', H1_CSV, '(ONE level -- must not change)'],
    ['A', 'A9', A9_ONE_ROW_CSV, '(a hand-made file with ONE header row)'],
  ];
  for (const [sec, tbl, csv, note] of CASES) {
    const D = await open({ seedStorage: seedFor('2094') });
    try { await attempt(D.B, D, sec, tbl, '2094', csv, note, say); }
    finally { await D.close(); }
  }
})().catch(e => { console.error('REPRO FAILED: ' + (e && e.stack || e)); process.exit(1); });
