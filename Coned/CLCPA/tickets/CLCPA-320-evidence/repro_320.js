/* CLCPA-320, the OWNER'S NAMED VERIFICATION: the two-download pair on G3, plus
 * the A3 fresh-template control.
 *
 * A real browser, the real button, the real workbook bytes. The download is
 * captured by wrapping URL.createObjectURL, so everything up to and including
 * buildIngestWorkbook runs exactly as it does for an operator -- nothing here
 * calls the builder directly, because a harness that calls the builder proves
 * the builder works and not that the button reaches it.
 *
 * WHAT IT SHOWED, and the first half is not what the ticket expected:
 *
 *   G3 2025 and G3 2098 agree on BOTH builds -- "County Total",
 *   "(calculated)", "(calculated)". For G3 the marker was already the same in
 *   a populated year and a fresh one, so the pair the ticket names as the
 *   proof does not demonstrate the defect. It is still worth having: it is now
 *   the control showing the G board is unregressed.
 *
 *   A3 2098, the fresh-template control, is unchanged: "Total", "(no value)",
 *   then three "(calculated)".
 *
 *   A3 2023 IS THE DEFECT, and it is stark. The shipped build writes
 *       ["Total", "", 2354317, "", ""]
 *   -- one bare figure, and three EMPTY cells in a total row, which is an
 *   invitation to type into them. The same row of the same table in the 2098
 *   workbook says (calculated) in all four. After this change 2023 matches:
 *       ["Total", "(no value)", "(calculated)", "(calculated)", "(calculated)"]
 *
 *   J8 2025 likewise moves from ["Total", 192638756, 38743914, "100%"] to
 *   three (calculated). J8 is the table whose total does NOT sum its own rows,
 *   so this one carries a consequence and is called out in the report rather
 *   than buried here.
 *
 *   node repro_320.js            both builds
 *   node repro_320.js fix        the working tree alone
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
  const d = path.join(os.tmpdir(), 'clcpa-320-base-' + BASE);
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

/* capture the bytes the app hands to the browser as a download */
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

/* THE DIALOG IS THE DOOR. #ingest-template lives inside the Add Data modal,
 * not on the page, so the first cut of this script clicked nothing at all and
 * reported "NO TEMPLATE BUTTON" three times. Opening it the way an operator
 * does is also the only way the year box exists to type into. */
const OPEN_DIALOG = `
(function(){
  /* CLOSE ANY DIALOG STILL OPEN FIRST. Leaving the previous one up made the
   * second and third downloads come back as the first table's workbook --
   * three rows of evidence, two of them quietly describing the wrong file. */
  var x = document.querySelector('.ingest-modal-close');
  if (x) x.click();
  var b = document.getElementById('ingest-addyear');
  if (!b) return 'NO ADD DATA BUTTON';
  b.click();
  return 'opened';
})()`;

/* THE TABLE IS CHOSEN IN THE DIALOG, not on the page behind it. The first cut
 * of this script picked the table on the page and left the dialog on its own
 * default, so the "G3" and the "A3" workbooks were both A1 and came back
 * byte-identical -- a pair of downloads that agreed for the worst reason. */
const SET_TARGET = (section, table, year) => `
(function(){
  var sec = document.getElementById('dlg-section');
  var tab = document.getElementById('dlg-table');
  var yr  = document.getElementById('dlg-newyear');
  if (!sec || !tab || !yr) return 'DIALOG FIELDS MISSING';
  sec.value = ${JSON.stringify(String(section))};
  sec.dispatchEvent(new Event('change', {bubbles:true}));
  return 'section=' + sec.value;
})()`;

const SET_TABLE_YEAR = (table, year) => `
(function(){
  var tab = document.getElementById('dlg-table');
  var yr  = document.getElementById('dlg-newyear');
  if (!tab || !yr) return 'DIALOG FIELDS MISSING';
  var have = Array.prototype.map.call(tab.options || [], function(o){ return o.value; });
  if (have.indexOf(${JSON.stringify(String(table))}) < 0)
    return 'TABLE NOT OFFERED: ' + JSON.stringify(have);
  tab.value = ${JSON.stringify(String(table))};
  tab.dispatchEvent(new Event('change', {bubbles:true}));
  yr.value = ${JSON.stringify(String(year))};
  yr.dispatchEvent(new Event('input', {bubbles:true}));
  yr.dispatchEvent(new Event('change', {bubbles:true}));
  return 'table=' + tab.value + ' year=' + yr.value;
})()`;

/* READ THE FIELDS AT CLICK TIME, and put them in the evidence. The dialog
 * re-renders on a change event and can reset the year box to its own
 * suggestion, so what was typed a moment ago is not necessarily what the
 * button acts on. Every row of this report now carries the target the app
 * actually used, so a download of the wrong table cannot read as a result. */
const CLICK_TEMPLATE = (table, year) => `
(function(){
  var btn = document.getElementById('ingest-template');
  if (!btn) return 'NO TEMPLATE BUTTON';
  var t = document.getElementById('dlg-table');
  var y = document.getElementById('dlg-newyear');
  if (!t || !y) return 'DIALOG FIELDS MISSING';
  /* SET THE YEAR IN THE SAME BREATH AS THE CLICK. Changing the table
   * re-renders the dialog, and the re-render puts its own suggested year back
   * in the box -- so a year typed before the table change was silently
   * replaced by 2025, and four of five downloads were the 2025 workbook. */
  y.value = ${JSON.stringify(String(year))};
  y.dispatchEvent(new Event('input', {bubbles:true}));
  var live = t.value + '/' + y.value;
  if (live !== ${JSON.stringify(String(table) + '/' + String(year))})
    return 'TARGET DRIFTED: asked for ' + ${JSON.stringify(String(table) + '/' + String(year))} +
           ', dialog holds ' + live;
  window.__grab = null;
  btn.click();
  var err = document.querySelector('#dlg-error');
  var msg = (err && err.style.display !== 'none' && err.textContent.trim())
    ? (' dialog error: ' + err.textContent.trim()) : '';
  return 'clicked on ' + live + msg;
})()`;

async function grab(D, section, table, year) {
  await D.B.run(HOOK);
  const opened = await D.B.eval(OPEN_DIALOG);
  await sleep(700);
  const s = await D.B.eval(SET_TARGET(section, table, year));
  await sleep(400);
  const ty = await D.B.eval(SET_TABLE_YEAR(table, year));
  await sleep(400);
  const what = opened + '; ' + s + '; ' + ty + '; ' + await D.B.eval(CLICK_TEMPLATE(table, year));
  for (let i = 0; i < 60; i++) {
    const g = await D.B.eval('window.__grab');
    if (g && !/^ERROR/.test(g)) return { note: what, b64: g };
    await sleep(120);
  }
  return { note: what, b64: null };
}

/* the total row of the sheet, as the workbook holds it */
function totalRow(b64) {
  if (!b64) return null;
  const buf = Buffer.from(b64, 'base64');
  /* a captured blob that is not a ZIP is not a workbook, and saying so beats
   * a parser error that names neither the capture nor the click */
  if (buf.slice(0, 2).toString('latin1') !== 'PK') {
    return { found: false, notAZip: true, bytes: buf.length,
             head: JSON.stringify(buf.slice(0, 40).toString('latin1')) };
  }
  /* templateRows() calls worksheets() ITSELF. Passing it worksheets(buf)
   * handed it an array of XML strings, which Buffer.from turned into garbage
   * and which read back as zero worksheets -- a parse failure that looked
   * exactly like a malformed workbook, on three workbooks that were fine. */
  let rows;
  try { rows = XL.templateRows(buf); }
  catch (e) { return { found: false, parseError: e.message, bytes: buf.length }; }
  const dense = rows.map(r => XL.dense(r));
  const i = dense.findIndex(r => /(^|\s)(grand\s+|sub)?totals?$/i.test(String(r[0] || '').trim()));
  return i < 0 ? { found: false, rows: dense.length } : { found: true, at: i, cells: dense[i] };
}

async function run(label, dir) {
  log('');
  log('=== ' + label + '   (' + dir + ')');
  const D = await open({ dir });
  try {
    /* The first three are the pair and the control the ticket names. The last
     * two are where this build actually differs, and leaving them out would
     * have produced a verification that passed without testing the change. */
    for (const spec of [['G', 'G3', '2025'], ['G', 'G3', '2098'], ['A', 'A3', '2098'],
                        ['A', 'A3', '2023'], ['J', 'J8', '2025']]) {
      const [sec, id, yr] = spec;
      await D.gotoIngest();
      await sleep(400);
      const g = await grab(D, sec, id, yr);
      const t = totalRow(g.b64);
      log('  ' + id + ' workbook for ' + yr + '   ' + g.note);
      if (!g.b64) { log('      NO BYTES CAPTURED'); continue; }
      log('      bytes: ' + Buffer.from(g.b64, 'base64').length);
      log('      total row: ' + JSON.stringify(t));
    }
    log('  page errors: ' + JSON.stringify(D.errors()).slice(0, 250));
  } finally {
    await D.close();
  }
}

(async () => {
  const which = (process.argv[2] || 'both').toLowerCase();
  log('CLCPA-320 REPRODUCTION: the workbook a preparer downloads');
  log('shipped build pinned at ' + BASE);
  if (which === 'both' || which === 'base') await run('base', baseDir());
  if (which === 'both' || which === 'fix') await run('fix', DEV);
  fs.writeFileSync(path.join(__dirname, 'repro-320-output.txt'), lines.join('\n') + '\n');
})().catch((e) => {
  log('REPRO THREW: ' + (e && e.stack));
  fs.writeFileSync(path.join(__dirname, 'repro-320-output.txt'), lines.join('\n') + '\n');
  process.exit(1);
});
