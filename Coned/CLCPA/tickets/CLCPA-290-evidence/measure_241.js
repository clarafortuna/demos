/* CLCPA-241 measurement, no build: does editing an underlying year figure
 * recompute A9's % Change, or leave the stored string stale? */
const fs = require('fs');
const { open } = require('c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/_kit/live_browser.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const DEV = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/';
const P = JSON.parse(fs.readFileSync(DEV + 'payload.json', 'utf8'));

/* a user-added year carrying A9's own 2025 rows, sub-header included */
const SEED = `
  localStorage.setItem('dac:years', JSON.stringify(['2098']));
  localStorage.setItem('dac:overrides', JSON.stringify({
    'A9:2098': ${JSON.stringify(P.tables.A9.data['2025'])}
  }));
`;
(async () => {
  const D = await open({ seedStorage: SEED });
  const B = D.B;
  console.log('A9 schema  : ' + JSON.stringify(P.tables.A9.schema_by_year['2025']));
  console.log('A9 sub row : ' + JSON.stringify(P.tables.A9.data['2025'][0]));
  console.log('A9 row 1   : ' + JSON.stringify(P.tables.A9.data['2025'][1]));
  for (const year of ['2098', '2025']) {
    console.log('');
    console.log('--- A9 / ' + year + ' -----------------------------------');
    await D.gotoIngest();
    await D.pick('A', 'A9', year);
    await sleep(700);
    const before = [];
    for (let c = 0; c < 7; c++) before.push(await D.cellText(1, c));
    console.log('  row 1 BEFORE : ' + JSON.stringify(before));
    /* edit column 3 -- the current year's Total -- digit by digit */
    await D.typeCell(1, 3, '999999999');
    await sleep(500);
    const after = [];
    for (let c = 0; c < 7; c++) after.push(await D.cellText(1, c));
    console.log('  row 1 AFTER  : ' + JSON.stringify(after));
    const moved = before[5] !== after[5] || before[6] !== after[6];
    console.log('  % Change recomputed? ' + (moved ? 'YES' : 'NO -- the stored string is STALE'));
  }
  console.log('');
  console.log('  page errors: ' + (D.errors().join(' | ') || 'none'));
  await D.close();
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
