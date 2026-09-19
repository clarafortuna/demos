/* CLCPA-286 re-verification on the current tip: do A9/A10 scaffold a fresh
 * year, and do their siblings really scaffold as the ticket claims?
 * Both halves measured, because a finding from b1108e5fcf may be stale. */
const { open } = require('c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/_kit/live_browser.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const SEED = `localStorage.setItem('dac:years', JSON.stringify(['2094']));
  localStorage.setItem('dac:overrides', JSON.stringify({}));`;
(async () => {
  const D = await open({ seedStorage: SEED });
  const B = D.B;
  await D.gotoIngest();
  console.log('Section A, year 2094 (user-added, nothing saved):');
  for (const t of ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10']) {
    await D.pick('A', t, '2094');
    await sleep(350);
    const rows = await D.editableRowCount();
    const first = rows ? await D.cellText(0,0) : null;
    const status = await D.rowCounterText();
    console.log('  ' + t.padEnd(4) + ' rows=' + String(rows).padEnd(4) +
      ' first=' + JSON.stringify(first) + '   ' + String(status||'').slice(0,60));
  }
  console.log('');
  console.log('and the same tables on the SEED year 2025, for contrast:');
  for (const t of ['A1','A9','A10']) {
    await D.pick('A', t, '2025');
    await sleep(350);
    console.log('  ' + t.padEnd(4) + ' rows=' + await D.editableRowCount());
  }
  await D.close();
})().catch(e => { console.error(e && e.stack || e); process.exit(1); });
