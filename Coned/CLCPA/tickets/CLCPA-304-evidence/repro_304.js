/* CLCPA-304, reproduced in a real browser: add a year to B2 the way an
 * operator does, then look at Section B.
 *
 * The gesture:
 *   Report Data -> Add Data -> Section B, table B2, year 2099 -> Add
 *   then Section B
 *
 * parseB2Plugs reads `(table.schema_by_year || {})[yr] || []` with no
 * fallback, while getTableSchema has fallen back to the newest year since
 * CLCPA-244. A year created at runtime has no schema entry of its own, so
 * parseB2Plugs gets an empty schema, every column index is -1, and every plug
 * count parses as 0.
 *
 *   node repro_304.js            both builds
 *   node repro_304.js base       the shipped build alone
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const { open } = require(path.join(ROOT, 'Coned/CLCPA/tickets/_kit/live_browser.js'));
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const BASE = process.env.DAC_BASE_COMMIT || 'd84c0d3';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const YEAR = '2099';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

function baseDir() {
  const d = path.join(os.tmpdir(), 'clcpa-304-base-' + BASE);
  fs.mkdirSync(d, { recursive: true });
  ['ExecutiveDashboard.html', 'index.html', 'styles.css', 'payload.json',
   'map_payload.json'].forEach((f) => {
    const src = path.join(DEV, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(d, f));
  });
  fs.writeFileSync(path.join(d, 'app.js'),
    execSync('git show ' + BASE + ':"' + REL + '"', { cwd: ROOT, maxBuffer: 1e9 }));
  return d;
}

/* THE STATE AN IMPORT LEAVES BEHIND, seeded directly.
 *
 * "+ Add year seeds NO rows" (CLCPA-240), so clicking Add Data creates an
 * empty year and Section B goes on showing 2025 -- the first cut of this
 * script did exactly that and reproduced nothing. The state this ticket is
 * about is the one an IMPORT leaves: rows present, and no schema entry,
 * because app.js says so in its own words at the composed-layer fallback --
 * "a year created by import carries cr2bf_schema = null, so the composed
 * table has no schema_by_year entry for it".
 *
 * So the rows are seeded into the override store exactly as a save writes
 * them, and no schema is written, which is precisely what the importer does.
 */
const SEED = (rows) => '(function(){' +
  'var o = {}; try { o = JSON.parse(localStorage.getItem("dac:overrides") || "{}"); } catch (e) {}' +
  'o["B2:' + YEAR + '"] = ' + JSON.stringify(rows) + ';' +
  'localStorage.setItem("dac:overrides", JSON.stringify(o));' +
  'var y = []; try { y = JSON.parse(localStorage.getItem("dac:years") || "[]"); } catch (e) {}' +
  'if (y.indexOf("' + YEAR + '") < 0) y.push("' + YEAR + '");' +
  'localStorage.setItem("dac:years", JSON.stringify(y));' +
  'return "seeded " + Object.keys(o).length + " override key(s), years " + JSON.stringify(y);' +
  '})()';

/* Section B's plug figures, read off the page */
const READ_B = `
(function(){
  var out = { year: null, cards: [] };
  var y = document.querySelector('#view-container [data-year], .year-pill.active, .year-tab.active');
  out.year = y ? (y.getAttribute('data-year') || y.textContent.trim()) : null;
  document.querySelectorAll('#view-container .kpi-card, #view-container .stat-card, #view-container .b-stat').forEach(function(c){
    var t = (c.textContent || '').replace(/\\s+/g, ' ').trim();
    if (/plug/i.test(t)) out.cards.push(t.slice(0, 120));
  });
  var txt = (document.querySelector('#view-container') || {}).textContent || '';
  var m = txt.replace(/\\s+/g, ' ').match(/[^.]*plugs?[^.]*\\./gi);
  out.sentences = (m || []).slice(0, 6).map(function(s){ return s.trim().slice(0, 160); });
  return out;
})()`;

async function run(label, dir) {
  log('');
  log('=== ' + label + '   (' + dir + ')');
  const rows = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'))
    .tables.B2.data['2025'];
  const D = await open({ dir, seedStorage: SEED(rows) });
  try {
    log('  ' + await D.B.eval(SEED(rows)));
    await D.B.run('location.reload();');
    await sleep(2500);

    /* the new year now exists in the store with no schema entry of its own */
    const stored = await D.B.eval(
      '(function(){try{var o=JSON.parse(localStorage.getItem("dac:overrides")||"{}");' +
      'return Object.keys(o).filter(function(k){return /^B2[:|]/.test(k);});}' +
      'catch(e){return "READ FAILED";}})()');
    log('  B2 keys now in the store: ' + JSON.stringify(stored));

    await D.B.run('location.hash = "#/section/B";');
    await sleep(2500);
    const b = await D.B.eval(READ_B);
    log('  Section B, year shown: ' + JSON.stringify(b.year));
    (b.cards || []).forEach(c => log('      card: ' + c));
    (b.sentences || []).forEach(s => log('      text: ' + s));
    log('  page errors: ' + JSON.stringify(D.errors()).slice(0, 250));
  } finally {
    await D.close();
  }
}

(async () => {
  const which = (process.argv[2] || 'both').toLowerCase();
  log('CLCPA-304 REPRODUCTION: Section B after a year is added at runtime');
  log('shipped build pinned at ' + BASE + ', year used: ' + YEAR);
  log('(2099 is this probe\'s own year, on a throwaway browser profile; the');
  log(' live org is not touched and 2096 is not gone near.)');
  if (which === 'both' || which === 'base') await run('base', baseDir());
  if (which === 'both' || which === 'fix') await run('fix', DEV);
  fs.writeFileSync(path.join(__dirname, 'repro-304-output.txt'), lines.join('\n') + '\n');
})().catch((e) => {
  log('REPRO THREW: ' + (e && e.stack));
  fs.writeFileSync(path.join(__dirname, 'repro-304-output.txt'), lines.join('\n') + '\n');
  process.exit(1);
});
