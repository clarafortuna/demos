/* CLCPA-308 (the D-01 family), reproduced in a real browser on both builds.
 *
 * Section D's shape is a count row, another count row, and then a PERCENTAGE
 * ROW that is the quotient of the two. The quotient is declared in
 * DERIVED_ROWS and the engine recomputes it on every edit -- but ingestComputed
 * read DERIVED_COLS and nothing else, so a metric running down the ROWS was
 * invisible to it. The workbook therefore offered those cells blank and
 * fillable, inviting a preparer to type a figure the next recompute overwrites.
 *
 * That is CLCPA-289 inverted: there a marker promised a computation that never
 * happened; here a computation happens and nothing tells the preparer.
 *
 * The download is captured off the real button by wrapping
 * URL.createObjectURL, so the whole path an operator uses is exercised.
 *
 *   node repro_308.js            both builds
 *   node repro_308.js fix        the working tree alone
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const { open } = require(path.join(ROOT, 'Coned/CLCPA/tickets/_kit/live_browser.js'));
const XL = require(path.join(ROOT, 'Coned/CLCPA/tickets/_kit/xlsx_read.js'));
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const BASE = process.env.DAC_BASE_COMMIT || 'd84c0d3';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

function baseDir() {
  const d = path.join(os.tmpdir(), 'clcpa-308-base-' + BASE);
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

const HOOK = `
(function(){
  window.__grab = null;
  if (window.__grabbed) return 'already';
  window.__grabbed = true;
  var real = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(blob){
    try {
      var fr = new FileReader();
      fr.onload = function(){
        var b = new Uint8Array(fr.result), s = '';
        for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
        window.__grab = btoa(s);
      };
      fr.readAsArrayBuffer(blob);
    } catch (e) { window.__grab = 'ERROR ' + e.message; }
    return real(blob);
  };
  return 'hooked';
})()`;

const OPEN_DIALOG = `
(function(){
  var x = document.querySelector('.ingest-modal-close');
  if (x) x.click();
  var b = document.getElementById('ingest-addyear');
  if (!b) return 'NO ADD DATA BUTTON';
  b.click();
  return 'opened';
})()`;

const SET_SECTION = (section) => `
(function(){
  var s = document.getElementById('dlg-section');
  if (!s) return 'NO SECTION SELECT';
  s.value = ${JSON.stringify(String(section))};
  s.dispatchEvent(new Event('change', {bubbles:true}));
  return 'section=' + s.value;
})()`;

const SET_TABLE = (table) => `
(function(){
  var t = document.getElementById('dlg-table');
  if (!t) return 'NO TABLE SELECT';
  var have = Array.prototype.map.call(t.options || [], function(o){ return o.value; });
  if (have.indexOf(${JSON.stringify(String(table))}) < 0)
    return 'TABLE NOT OFFERED: ' + JSON.stringify(have);
  t.value = ${JSON.stringify(String(table))};
  t.dispatchEvent(new Event('change', {bubbles:true}));
  return 'table=' + t.value;
})()`;

/* the year is set in the same breath as the click: changing the table
 * re-renders the dialog and puts its own suggested year back in the box */
const CLICK_TEMPLATE = (table, year) => `
(function(){
  var btn = document.getElementById('ingest-template');
  if (!btn) return 'NO TEMPLATE BUTTON';
  var t = document.getElementById('dlg-table');
  var y = document.getElementById('dlg-newyear');
  if (!t || !y) return 'DIALOG FIELDS MISSING';
  y.value = ${JSON.stringify(String(year))};
  y.dispatchEvent(new Event('input', {bubbles:true}));
  var live = t.value + '/' + y.value;
  if (live !== ${JSON.stringify(String(table) + '/' + String(year))})
    return 'TARGET DRIFTED: dialog holds ' + live;
  window.__grab = null;
  btn.click();
  return 'clicked on ' + live;
})()`;

async function grab(D, section, table, year) {
  await D.B.run(HOOK);
  const a = await D.B.eval(OPEN_DIALOG);
  await sleep(700);
  const b = await D.B.eval(SET_SECTION(section));
  await sleep(400);
  const c = await D.B.eval(SET_TABLE(table));
  await sleep(400);
  const d = await D.B.eval(CLICK_TEMPLATE(table, year));
  for (let i = 0; i < 60; i++) {
    const g = await D.B.eval('window.__grab');
    if (g && !/^ERROR/.test(g)) return { note: [a, b, c, d].join('; '), b64: g };
    await sleep(120);
  }
  return { note: [a, b, c, d].join('; '), b64: null };
}

/* every row whose label starts "Percentage" or "% ", which is the shape the
 * D-01 family is about */
function pctRows(b64) {
  if (!b64) return null;
  const buf = Buffer.from(b64, 'base64');
  if (buf.slice(0, 2).toString('latin1') !== 'PK') return { notAZip: true, bytes: buf.length };
  let rows;
  try { rows = XL.templateRows(buf).map(r => XL.dense(r)); }
  catch (e) { return { parseError: e.message, bytes: buf.length }; }
  return rows
    .map((r, i) => ({ i: i, cells: r }))
    /* `%\b` cannot match "% of Grand Total": \b needs a word character on one
     * side and "%" and " " are both non-word, so F7's row was silently absent
     * from this report rather than reported as unchanged. */
    .filter(x => /^(percentage\b|%)/i.test(String(x.cells[0] || '').trim()));
}

async function run(label, dir) {
  log('');
  log('=== ' + label + '   (' + dir + ')');
  const D = await open({ dir });
  try {
    for (const [sec, id, yr] of [['D', 'D3', '2025'], ['D', 'D2', '2025'], ['F', 'F7', '2025']]) {
      await D.gotoIngest();
      await sleep(400);
      const g = await grab(D, sec, id, yr);
      log('  ' + id + ' workbook for ' + yr + '   ' + g.note);
      if (!g.b64) { log('      NO BYTES CAPTURED'); continue; }
      log('      bytes: ' + Buffer.from(g.b64, 'base64').length);
      const rows = pctRows(g.b64);
      (rows || []).forEach(r => log('      r' + r.i + ' ' + JSON.stringify(r.cells)));
      if (rows && !rows.length) log('      (no percentage rows found in the sheet)');
    }
    log('  page errors: ' + JSON.stringify(D.errors()).slice(0, 250));
  } finally {
    await D.close();
  }
}

(async () => {
  const which = (process.argv[2] || 'both').toLowerCase();
  log('CLCPA-308 REPRODUCTION: what the workbook tells a preparer about a');
  log('percentage row the dashboard computes for them');
  log('shipped build pinned at ' + BASE);
  if (which === 'both' || which === 'base') await run('base', baseDir());
  if (which === 'both' || which === 'fix') await run('fix', DEV);
  fs.writeFileSync(path.join(__dirname, 'repro-308-output.txt'), lines.join('\n') + '\n');
})().catch((e) => {
  log('REPRO THREW: ' + (e && e.stack));
  fs.writeFileSync(path.join(__dirname, 'repro-308-output.txt'), lines.join('\n') + '\n');
  process.exit(1);
});
