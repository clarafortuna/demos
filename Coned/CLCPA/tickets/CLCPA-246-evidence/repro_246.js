/* CLCPA-246, in a real browser, on both builds.
 *
 * TWO GESTURES, both of which the ticket describes:
 *
 *   A. an IMPORTED year: G1 holds 9,999 DAC and 999 non-DAC with the
 *      "Systemwide Total" row present and value-less, as an import leaves it.
 *      The ticket: the total renders flagged but EMPTY, and the Executive
 *      Summary renders nothing for G1's Mains figure.
 *
 *   B. a SAVED year: G1/2025 as it persists after an ordinary save. This one
 *      is not in the ticket -- it is a regression CLCPA-319 introduces, found
 *      while re-measuring, and it is the more serious of the two. The total
 *      is stripped on persist by design, main_replacement reads that stored
 *      cell, and when it is not a number the KPI falls through to summing
 *      G2/G4/G6/G8: a DIFFERENT aggregate, published silently.
 *
 *   node repro_246.js          both builds
 *   node repro_246.js base     the shipped build alone
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
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

function baseDir() {
  const d = path.join(os.tmpdir(), 'clcpa-246-base-' + BASE);
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

/* A: the imported year, exactly the ticket's figures.
 * B: G1/2025 as a save leaves it, with the derived total stripped. */
const IMPORTED = [
  ['Feet Replaced within DAC', 9999, null],
  ['Feet Replaced not in a DAC', 999, null],
  ['Systemwide Total', null, null],
];
const SAVED_2025 = [
  ['Feet Replaced within DAC', 202384, null],
  ['Feet Replaced not in a DAC', 228154, null],
  ['Systemwide Total', null, null],
];

const seed = (key, rows, years) => '(function(){' +
  'var o = {}; try { o = JSON.parse(localStorage.getItem("dac:overrides") || "{}"); } catch (e) {}' +
  'o[' + JSON.stringify(key) + '] = ' + JSON.stringify(rows) + ';' +
  'localStorage.setItem("dac:overrides", JSON.stringify(o));' +
  'var y = []; try { y = JSON.parse(localStorage.getItem("dac:years") || "[]"); } catch (e) {}' +
  JSON.stringify(years) + '.forEach(function(v){ if (y.indexOf(v) < 0) y.push(v); });' +
  'localStorage.setItem("dac:years", JSON.stringify(y));' +
  'return "seeded " + ' + JSON.stringify(key) + ';' +
  '})()';

/* the Executive Summary's Mains card, read off the page */
const READ_KPI = `
(function(){
  var out = { cards: [], g1: null };
  document.querySelectorAll('#view-container .kpi-card, #view-container .summary-card, #view-container [data-kpi]').forEach(function(c){
    var t = (c.textContent || '').replace(/\\s+/g, ' ').trim();
    if (/main|pipe|leak/i.test(t)) out.cards.push(t.slice(0, 140));
  });
  var txt = ((document.querySelector('#view-container') || {}).textContent || '')
    .replace(/\\s+/g, ' ');
  var m = txt.match(/[^.]{0,90}Main[^.]{0,90}/gi);
  out.sentences = (m || []).slice(0, 4).map(function(s){ return s.trim().slice(0, 150); });
  return out;
})()`;

async function run(label, dir) {
  log('');
  log('=== ' + label + '   (' + dir + ')');
  const D = await open({ dir });
  try {
    for (const [what, key, rows, year] of [
      ['A  imported year, total value-less', 'G1:2098', IMPORTED, '2098'],
      ['B  saved year, total stripped     ', 'G1:2025', SAVED_2025, '2025'],
    ]) {
      log('  ' + what);
      log('      ' + await D.B.eval(seed(key, rows, [year])));
      await D.B.run('location.reload();');
      await sleep(2600);
      await D.B.run('location.hash = "#/";');
      await sleep(2600);
      const k = await D.B.eval(READ_KPI);
      (k.cards || []).forEach(c => log('      card: ' + c));
      (k.sentences || []).forEach(s => log('      text: ' + s));

      /* and the G section page, where the total itself renders */
      await D.B.run('location.hash = "#/section/G";');
      await sleep(2200);
      const g1 = await D.B.eval(
        '(function(){var o=null;document.querySelectorAll(".table-card").forEach(function(c){' +
        'var h=c.querySelector("h3"); if(!h||!/Table G1\\b/.test(h.textContent))return;' +
        'var rows=[];c.querySelectorAll("tr").forEach(function(tr){var cs=[];' +
        'tr.querySelectorAll("th,td").forEach(function(td){cs.push(td.textContent.trim());});' +
        'if(cs.length)rows.push(cs);});o=rows;});return o;})()');
      (g1 || []).forEach(r => log('      G1 row: ' + JSON.stringify(r)));

      /* AND THE EDITOR, which is a second surface on the same figures. The
       * report page and the editor must not disagree about the total row. */
      await D.gotoIngest();
      await sleep(500);
      await D.B.eval('(function(){var s=document.getElementById("ingest-section");' +
        'if(s){s.value="G";s.dispatchEvent(new Event("change",{bubbles:true}));}return 1;})()');
      await sleep(400);
      await D.B.eval('(function(){var t=document.querySelector("[data-ingest-table=\\"G1\\"]");' +
        'if(t)t.click();return 1;})()');
      await sleep(400);
      await D.B.eval('(function(){var y=document.getElementById("ingest-year");' +
        'if(y){y.value=' + JSON.stringify(year) + ';' +
        'y.dispatchEvent(new Event("change",{bubbles:true}));}return 1;})()');
      await sleep(900);
      const grid = await D.B.eval(
        '(function(){var o=[];document.querySelectorAll("#ingest-editor-mount tr")' +
        '.forEach(function(tr){var cs=[];tr.querySelectorAll("td,th").forEach(function(td){' +
        'var i=td.querySelector("input");cs.push(i?("["+i.value+"]"):td.textContent.trim());});' +
        'if(cs.length)o.push(cs);});return o;})()');
      (grid || []).forEach(r => log('      editor: ' + JSON.stringify(r)));
      log('');
    }
    log('  page errors: ' + JSON.stringify(D.errors()).slice(0, 250));
  } finally {
    await D.close();
  }
}

(async () => {
  const which = (process.argv[2] || 'both').toLowerCase();
  log('CLCPA-246 REPRODUCTION: G1s total, and the Mains KPI that reads it');
  log('shipped build pinned at ' + BASE);
  log('(2098 is this probes own year, on a throwaway browser profile; the live');
  log(' org is not touched and 2096 is not gone near.)');
  if (which === 'both' || which === 'base') await run('base', baseDir());
  if (which === 'both' || which === 'fix') await run('fix', DEV);
  fs.writeFileSync(path.join(__dirname, 'repro-246-output.txt'), lines.join('\n') + '\n');
})().catch((e) => {
  log('REPRO THREW: ' + (e && e.stack));
  fs.writeFileSync(path.join(__dirname, 'repro-246-output.txt'), lines.join('\n') + '\n');
  process.exit(1);
});
