/* CLCPA-311: the DASH path. "No silent fallback to zero" is the whole point,
 * so a year that files no percentage row must show the dash, not 0.0% and not
 * a stale figure. Driven on a payload whose D3 percentage row is removed.
 */
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const { open } = require(path.join(ROOT, 'Coned/CLCPA/tickets/_kit/live_browser.js'));
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const os = require('os');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* serve a COPY whose D3 files no percentage row for the LMI metric */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'd311-'));
['ExecutiveDashboard.html', 'index.html', 'app.js', 'styles.css', 'map_payload.json']
  .forEach(f => { try { fs.copyFileSync(path.join(DEV, f), path.join(tmp, f)); } catch (e) {} });
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
let removed = 0;
Object.keys(P.tables.D3.data).forEach((y) => {
  const before = P.tables.D3.data[y].length;
  P.tables.D3.data[y] = P.tables.D3.data[y].filter(r =>
    !/^percentage of subscribers who are low-income/i.test(String(r[0] || '').trim()));
  removed += before - P.tables.D3.data[y].length;
});
fs.writeFileSync(path.join(tmp, 'payload.json'), JSON.stringify(P));
console.log('  removed ' + removed + ' stored percentage row(s) from D3, across every year');

const READ = `
(function(){
  var m = document.querySelector('.d-bar-metric[data-is-lmi="true"]');
  if (!m) return null;
  var out = [];
  m.querySelectorAll('.d-bar-row').forEach(function(r){
    var t = r.querySelector('.d-bar-total');
    out.push(t ? t.textContent.trim() : '');
  });
  return out;
})()`;

(async () => {
  const D = await open({ dir: tmp });
  await D.B.run('location.hash = "#/section/D";');
  await sleep(3000);
  const slots = await D.B.eval(READ);
  console.log('  the LMI share slots now read: ' + JSON.stringify(slots));
  const dashes = (slots || []).every(s => s === '—');
  const zeros = (slots || []).some(s => /^0\.0\s*%$/.test(String(s)));
  console.log('  all dashes            : ' + dashes);
  console.log('  any fabricated 0.0%   : ' + zeros);
  console.log('  page errors: ' + JSON.stringify(D.errors()).slice(0, 160));
  await D.close();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}
  process.exit(dashes && !zeros ? 0 : 1);
})().catch(e => { console.error('THREW: ' + e.stack); process.exit(1); });
