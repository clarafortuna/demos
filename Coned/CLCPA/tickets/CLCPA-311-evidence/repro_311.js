/* CLCPA-311 / D-04, reproduced in a real browser against a served build,
 * BEFORE any code.
 *
 * The Section D chart prints a share for "LMI subscribers (EAP)". D3 stores
 * that share: 0.093 cumulative for 2025, 0.063 for 2024. The chart is handed
 * dac = null and computes null / total, which JavaScript coerces to 0, so the
 * honest dash is never reached and the page prints 0.0%.
 */
const path = require('path');
const { execSync } = require('child_process');
const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const { open } = require(path.join(ROOT, 'Coned/CLCPA/tickets/_kit/live_browser.js'));
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const READ_BARS = `
(function(){
  var out = [];
  document.querySelectorAll('.d-bar-metric').forEach(function(m){
    var rows = [];
    m.querySelectorAll('.d-bar-row').forEach(function(r){
      var yr  = r.querySelector('.d-bar-yr');
      var num = r.querySelector('.d-bar-num');
      var tot = r.querySelector('.d-bar-total');
      rows.push({
        year:  yr  ? yr.textContent.trim()  : '',
        value: num ? num.textContent.trim() : '',
        share: tot ? tot.textContent.trim() : ''
      });
    });
    out.push({
      label: m.getAttribute('data-label'),
      table: m.getAttribute('data-table'),
      isLmi: m.getAttribute('data-is-lmi') === 'true',
      rows: rows
    });
  });
  return out;
})()`;

(async () => {
  const D = await open({ dir: DEV });
  await D.B.run('location.hash = "#/section/D";');
  await sleep(3000);

  const bars = await D.B.eval(READ_BARS);
  console.log('  === Section D, the bar metrics as the page renders them ===');
  console.log('');
  (bars || []).forEach((b) => {
    console.log('  ' + (b.isLmi ? '[LMI] ' : '      ') + String(b.label).padEnd(24) +
      ' (' + b.table + ')');
    b.rows.forEach(r => console.log('           ' + String(r.year).padEnd(8) +
      String(r.value).padEnd(10) + ' share: ' + r.share));
  });

  const lmi = (bars || []).find(b => b.isLmi);
  console.log('');
  if (!lmi) {
    console.log('  NO LMI bar found on the page.');
  } else {
    const shares = lmi.rows.map(r => r.share);
    console.log('  THE DEFECT: the LMI bar prints ' + JSON.stringify(shares));
    console.log('  D3 stores 0.093 cumulative for 2025 and 0.063 for 2024,');
    console.log('  so the honest figures are 9.3% and 6.3%.');
    const bad = shares.some(s => /^0\.0\s*%$/.test(String(s).trim()));
    console.log('  prints a fabricated 0.0%: ' + bad);
  }
  console.log('');
  console.log('  page errors: ' + JSON.stringify(D.errors()).slice(0, 200));
  try { await D.shot(path.join(__dirname, 'repro-311-sectionD.png')); } catch (e) {}
  await D.close();
})().catch(e => { console.error('REPRO THREW: ' + e.stack); process.exit(1); });
