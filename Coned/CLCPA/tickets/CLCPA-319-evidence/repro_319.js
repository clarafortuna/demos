/* CLCPA-319, reproduced in a real browser as an OWNER GESTURE, against both
 * the shipped build and the fix.
 *
 * THE GESTURE:
 *
 *   Report Data -> Section G -> G1 -> 2025
 *   change "Feet Replaced within DAC" from 202,384 to 302,384
 *   save (which is TWO clicks: the button, then the confirm dialog)
 *   look at the Section G report page
 *
 * WHAT THIS SCRIPT WAS WRITTEN TO SHOW, AND WHAT IT ACTUALLY SHOWED. It was
 * written expecting the shipped report page to keep printing the filed
 * 430,538 while the editor moved on. It does not. Both builds print 530,538
 * and both keep the operator's 302,384. The expectation was wrong and the
 * comment it came from has been corrected in app.js.
 *
 * The difference is in WHAT IS PERSISTED, which is why this script reads the
 * store as well as the page:
 *
 *   shipped   ["Systemwide Total", 530538, null]
 *   fix       ["Systemwide Total", null,   null]
 *
 * The shipped total is right because the EDITOR recomputes it and saves it.
 * It is a stored copy that one surface keeps in step, not a derivation, and
 * the repo's central rule is that a computable figure gets no stored copy.
 * G10/2024 is what the copy costs when nothing corrects it: it files 241.2279
 * against rows summing 241.22, and the page publishes the filed figure.
 *
 * On stored data alone the difference is invisible: every in-scope year files
 * a total equal to its own rows (probe_319_gboard.js: 21 of 21 years that
 * file one, G1 filing no total row at all for 2023 or 2024).
 *
 *   node repro_319.js           both builds
 *   node repro_319.js base      the shipped build alone
 *   node repro_319.js fix       the working tree alone
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

/* ---- a served copy of the SHIPPED build ------------------------------- */
function baseDir() {
  const d = path.join(os.tmpdir(), 'clcpa-319-base-' + BASE);
  fs.mkdirSync(d, { recursive: true });
  ['ExecutiveDashboard.html', 'index.html', 'styles.css', 'payload.json',
   'map_payload.json'].forEach((f) => {
    const src = path.join(DEV, f);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(d, f));
  });
  const app = execSync('git show ' + BASE + ':"' + REL + '"', { cwd: ROOT, maxBuffer: 1e9 });
  fs.writeFileSync(path.join(d, 'app.js'), app);
  return d;
}

/* the total row of G1 as the REPORT PAGE prints it, read off the rendered
 * cells rather than any internal value */
const READ_REPORT = `
(function(){
  var out = null;
  document.querySelectorAll('.table-card').forEach(function(card){
    var h = card.querySelector('h3');
    if (!h || !/Table G1\\b/.test(h.textContent)) return;
    var rows = [];
    card.querySelectorAll('tr').forEach(function(tr){
      var cells = [];
      tr.querySelectorAll('th,td').forEach(function(td){ cells.push(td.textContent.trim()); });
      if (cells.length) rows.push(cells);
    });
    out = { caption: h.textContent.trim(), rows: rows };
  });
  return out;
})()`;

/* the same cell as the EDITOR holds it */
const READ_EDITOR = `
(function(){
  var out = [];
  document.querySelectorAll('#ingest-editor-mount tr').forEach(function(tr){
    var cells = [];
    tr.querySelectorAll('td,th').forEach(function(td){
      var i = td.querySelector('input');
      cells.push(i ? ('[' + i.value + ']') : td.textContent.trim());
    });
    if (cells.length) out.push(cells);
  });
  return out;
})()`;

async function run(label, dir) {
  log('');
  log('=== ' + label + '   (' + dir + ')');
  const D = await open({ dir });
  try {
    await D.gotoIngest();
    await D.pick('G', 'G1', '2025');
    await sleep(600);

    log('  the editor as opened:');
    (await D.B.eval(READ_EDITOR) || []).forEach(r => log('      ' + JSON.stringify(r)));

    /* THE GESTURE: correct the DAC feet figure */
    await D.typeCell(0, 1, '302384');
    await sleep(600);
    log('  after typing 302384 into "Feet Replaced within DAC":');
    const after = await D.B.eval(READ_EDITOR) || [];
    after.forEach(r => log('      ' + JSON.stringify(r)));

    /* SAVE IS TWO GESTURES, and missing the second one is how the first cut of
     * this script "reproduced" a report page that had simply never been saved
     * to. Every step reports what it did, so a silent no-op cannot read as
     * evidence. */
    const clicked = await D.B.eval(
      '(function(){var b=document.getElementById("ingest-save");' +
      'if(!b) return "NO SAVE BUTTON"; if(b.disabled) return "SAVE DISABLED";' +
      'b.click(); return "clicked";})()');
    log('  save button: ' + clicked);
    await sleep(900);
    const confirmed = await D.B.eval(
      '(function(){var b=document.getElementById("ingest-modal-confirm");' +
      'if(!b) return "no confirm dialog"; b.click(); return "confirmed";})()');
    log('  confirm dialog: ' + confirmed);
    await sleep(1800);
    /* WHAT WAS PERSISTED, which is where the two builds actually differ. The
     * page looking right says nothing about whether the total is a derivation
     * or a stored copy that the editor happens to keep in step. */
    const saved = await D.B.eval(
      '(function(){try{var o=JSON.parse(localStorage.getItem("dac:overrides")||"{}");' +
      'var k=Object.keys(o).filter(function(k){return /^G1[:|]/.test(k);});' +
      'if(!k.length) return "NOTHING STORED";' +
      'return k[0] + " = " + JSON.stringify(o[k[0]]);}catch(e){return "READ FAILED: "+e.message;}})()');
    log('  what was PERSISTED: ' + saved);

    await D.B.run('location.hash = "#/section/G";');
    await sleep(2500);
    const rep = await D.B.eval(READ_REPORT);
    log('  the REPORT PAGE after saving:');
    if (!rep) log('      G1 panel not found');
    else {
      log('      ' + rep.caption);
      rep.rows.forEach(r => log('      ' + JSON.stringify(r)));
    }
    try { await D.shot(path.join(__dirname, 'repro-319-' + label + '.png')); } catch (e) {}
    log('  page errors: ' + JSON.stringify(D.errors()).slice(0, 300));
  } finally {
    await D.close();
  }
}

(async () => {
  const which = (process.argv[2] || 'both').toLowerCase();
  log('CLCPA-319 REPRODUCTION: an operator corrects a G1 quantity');
  log('shipped build pinned at ' + BASE);
  if (which === 'both' || which === 'base') await run('base', baseDir());
  if (which === 'both' || which === 'fix') await run('fix', DEV);
  fs.writeFileSync(path.join(__dirname, 'repro-319-output.txt'), lines.join('\n') + '\n');
})().catch((e) => {
  log('REPRO THREW: ' + (e && e.stack));
  fs.writeFileSync(path.join(__dirname, 'repro-319-output.txt'), lines.join('\n') + '\n');
  process.exit(1);
});
