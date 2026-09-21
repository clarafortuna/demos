/* CLCPA-303 round 2: the owner's gesture, re-reproduced BEFORE any code.
 *
 * The finding was measured on the previous hosted build. This runs the same
 * four steps against the CURRENT tip in a real browser, because a defect
 * that has already been fixed by a later round must not be "fixed" again,
 * and a defect whose shape has MOVED must be re-measured before it is
 * described.
 *
 *   1. Download Template exports every computed cell as "(calculated)":
 *      the whole Total row and the Total Plugs column.
 *   2. The operator files a divergent COLUMN total: Total row, L2 Plugs,
 *      "(calculated)" replaced with 999.
 *   3. The stager's count excludes the 999 with no mention.
 *   4. Load Data: the draft's Total row still shows the computed figure, no
 *      advisory names the dropped value, and the state reads No Changes.
 *
 * Plus the CONTRAST the owner named: the row-wise kept figure surfaces its
 * amber advisory in the same box, so keep-and-name demonstrably exists and
 * the column axis simply cannot reach it.
 *
 * WHOSE FIGURES: 999 and 243 are the owner's, and the component split that
 * produces 243 is mine (143 + 100), since the report does not give it. Every
 * other number below is measured here.
 *
 * The template is .xlsx and the import input accepts .csv only -- the
 * operator saves the sheet as CSV, which is what the template's own comment
 * says. So leg A reads the real downloaded workbook and leg B feeds the CSV
 * that saving it produces.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const live = require('../_kit/live_browser.js');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
/* the working tree is CRLF and a git blob is LF; a pinned copy served with LF
 * endings is a different file from the one that shipped */
const CRLF = String.fromCharCode(13) + String.fromCharCode(10);
/* WHICH BUILD. "before" serves a throwaway copy of the tree carrying the
 * pinned pre-change app.js, so the BEFORE measurement survives the fix
 * instead of being overwritten by it -- the two legs then differ in that one
 * file and nothing else. */
const WHICH = (process.env.DAC_303_BUILD || 'after').toLowerCase();
const BASE = process.env.DAC_BASE_COMMIT || 'cb93541';
const OUT = path.join(__dirname, 'repro-303-r2-' + WHICH + '-output.txt');
const SHOT = path.join(__dirname, 'repro-303-r2-' + WHICH + '-import.png');
const DL = fs.mkdtempSync(path.join(os.tmpdir(), 'clcpa303r2-dl-'));

const HEAD = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
const BUILD = (() => {
  try {
    return require(path.join(DEV, 'Data/stamp_build.js')).prepare(DEV + '/').ids['app.js'];
  } catch (e) { return 'MISSING'; }
})();

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const TABLE = 'B2', YEAR = '2098';
/* L2 Plugs sums to 243 across the two category rows, which is the figure the
 * owner saw the draft keep. Total Plugs per row and the whole Total row are
 * what the engine derives. */
const SEED = [['DAC', 143, 10, 0, 153], ['Non-DAC', 100, 40, 0, 140],
  ['Total', 243, 50, 0, 293]];
const FILED = 999;
/* A1 seeded from its own newest stored year, so the refusal leg runs on a
 * real anatomy and nothing about this table is invented here */
const A1_ROWS = (function () {
  const p = JSON.parse(fs.readFileSync(path.join(DEV, "payload.json"), "utf8"));
  const d = (p.tables.A1 || {}).data || {};
  const y = Object.keys(d).sort().pop();
  return d[y] || [];
})();
const A1_SEED = "localStorage.setItem('dac:years', JSON.stringify(['" + YEAR +
  "']));" + "localStorage.setItem('dac:overrides', JSON.stringify({'A1:" + YEAR +
  "': " + JSON.stringify(A1_ROWS) + "}));" +
  "localStorage.setItem('dac:history', '[]');";

/* --- the stored-zip reader, as suite_85_xlsx has read these since round 4 -- */
function unzipStored(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eo = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; }
  }
  if (eo < 0) throw new Error('no EOCD: the download is not a zip');
  const total = dv.getUint16(eo + 10, true);
  const cdOffset = dv.getUint32(eo + 16, true);
  const out = {};
  let p = cdOffset;
  for (let k = 0; k < total; k++) {
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nlen));
    const lnlen = dv.getUint16(lho + 26, true);
    const lelen = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lnlen + lelen;
    out[name] = new TextDecoder().decode(bytes.subarray(start, start + csize));
    p += 46 + nlen + elen + clen;
  }
  return out;
}

function sheetRows(xml) {
  const rows = [];
  const rowRe = /<row[^>]*>([\s\S]*?)<\/row>/g;
  let m;
  while ((m = rowRe.exec(xml))) {
    const cells = [];
    const cellRe = /<c\b[^>]*?(\/>|>([\s\S]*?)<\/c>)/g;
    let c;
    while ((c = cellRe.exec(m[1]))) {
      if (c[1] === '/>') { cells.push(''); continue; }
      const inner = c[2] || '';
      const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner);
      if (t) { cells.push(t[1]); continue; }
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
      cells.push(v ? v[1] : '');
    }
    rows.push(cells);
  }
  return rows;
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const toCsv = (rows) => rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

const textOf = (B, sel) => B.eval(
  '(function(){var e=document.querySelector(' + JSON.stringify(sel) + ');' +
  'return e? e.textContent.replace(/\\s+/g," ").trim() : null;})()');
const allText = (B, sel) => B.eval(
  '(function(){var o=[];document.querySelectorAll(' + JSON.stringify(sel) + ')' +
  '.forEach(function(e){o.push(e.textContent.replace(/\\s+/g," ").trim());});' +
  'return o;})()');
const gridRows = async (B) => {
  const raw = await B.eval('(function(){var o=[];' +
    'document.querySelectorAll("#ingest-editor-mount tr").forEach(function(tr){' +
    'var cs=[];tr.querySelectorAll("td,th").forEach(function(td){' +
    'var i=td.querySelector("input");' +
    'cs.push(i?("["+i.value+"]"):td.textContent.trim());});o.push(cs);});' +
    'return JSON.stringify(o);})()');
  try { return JSON.parse(raw || '[]'); } catch (e) { return []; }
};

/* the file input lives behind Add Data, and the dialog's confirm carries no
 * id, so it is found by the label it is RENDERING -- which item 2 of this
 * queue is about, and which this script therefore reads rather than assumes */
/* THE IMPORT CONTROLS ARE IN THE DIALOG, not on the page: Download Template
 * and the file input are both rendered by renderIngestImportBar, which round 2
 * of CLCPA-85 moved off the page. Clicking #ingest-template against the page
 * finds nothing, which is how the first cut of this script died. */
async function openDialog(B) {
  await B.click('#ingest-addyear');
  await sleep(700);
  await B.run('var y=document.getElementById("dlg-newyear");' +
    'if(y){y.value="' + YEAR + '";y.dispatchEvent(new Event("input",{bubbles:true}));' +
    'y.dispatchEvent(new Event("change",{bubbles:true}));}' +
    'var s=document.getElementById("dlg-section");' +
    'if(s){s.value="B";s.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(450);
  await B.run('var t=document.getElementById("dlg-table");' +
    'if(t){t.value="' + TABLE + '";t.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(450);
  if (!await B.eval('!!document.getElementById("ingest-file")')) {
    throw new Error('the Add Data dialog never opened a file input');
  }
}

/* the same dialog, for any table: the refusal leg drives A1 rather than B2 */
async function openDialogFor(B, section, table, year) {
  await B.click("#ingest-addyear");
  await sleep(700);
  await B.run("var y=document.getElementById('dlg-newyear');" +
    "if(y){y.value='" + year + "';y.dispatchEvent(new Event('input',{bubbles:true}));" +
    "y.dispatchEvent(new Event('change',{bubbles:true}));}" +
    "var s=document.getElementById('dlg-section');" +
    "if(s){s.value='" + section + "';s.dispatchEvent(new Event('change',{bubbles:true}));}");
  await sleep(500);
  await B.run("var t=document.getElementById('dlg-table');" +
    "if(t){t.value='" + table + "';t.dispatchEvent(new Event('change',{bubbles:true}));}");
  await sleep(500);
  if (!await B.eval("!!document.getElementById('ingest-file')")) {
    throw new Error("the Add Data dialog never opened a file input");
  }
}

/* download the real template, hand its sheet rows to `edit`, return CSV */
async function templateCsv(B, edit) {
  const before = fs.readdirSync(DL);
  await B.send("Browser.setDownloadBehavior",
    { behavior: "allow", downloadPath: DL, eventsEnabled: true });
  await B.click("#ingest-template");
  let file = null;
  for (let i = 0; i < 60; i++) {
    await sleep(250);
    const f = fs.readdirSync(DL).filter(function (n) {
      return /\.xlsx$/i.test(n) && before.indexOf(n) < 0; });
    if (f.length) { file = path.join(DL, f[0]); break; }
  }
  if (!file) throw new Error("the template never landed");
  const parts = unzipStored(new Uint8Array(fs.readFileSync(file)));
  const name = Object.keys(parts).filter(function (n) {
    return /worksheets\/sheet2\.xml$/.test(n); })[0];
  const rows = sheetRows(parts[name]);
  const header = rows[0];
  const edited = edit(rows.map(function (r) { return r.slice(); }), header);
  return edited ? toCsv(edited) : null;
}
async function importCsv(B, csv, name) {
  await B.run('var dt=new DataTransfer();dt.items.add(new File([' +
    JSON.stringify(csv) + '],' + JSON.stringify(name) + ',{type:"text/csv"}));' +
    'var el=document.getElementById("ingest-file");el.files=dt.files;' +
    'el.dispatchEvent(new Event("change",{bubbles:true}));');
  await sleep(1500);
  const staged = await textOf(B, '.ingest-staged');
  /* the CONFIRM BUTTON'S OWN LABEL, read off the screen */
  const label = await B.eval('(function(){var b=null;' +
    'document.querySelectorAll(".ingest-dialog button, .ingest-modal button, button")' +
    '.forEach(function(e){var t=e.textContent.trim();' +
    'if(t==="Load Data"||t==="Add Year")b=b||t;});return b;})()');
  const help = await B.eval('(function(){var o=[];' +
    'document.querySelectorAll(".ingest-dialog, .ingest-modal").forEach(function(e){' +
    'o.push(e.textContent.replace(/\\s+/g," ").trim());});return o.join(" | ");})()');
  return { staged, label, help };
}

async function loadData(B) {
  await B.run('(function(){var b=null;document.querySelectorAll("button").forEach(' +
    'function(e){var t=e.textContent.trim();if(t==="Load Data"||t==="Add Year")b=b||e;});' +
    'if(b)b.click();})()');
  await sleep(1600);
}

(async () => {
  log('CLCPA-303 round 2: a filed COLUMN total, through the import path');
  log('re-reproduced against the current tip: main @ ' + HEAD + ', build ' + BUILD);
  log('');
  log('seeded ' + TABLE + '/' + YEAR + ' = ' + JSON.stringify(SEED));
  log('  L2 Plugs across the two category rows: 143 + 100 = 243');
  log('');

  const seed = 'localStorage.setItem("dac:years", JSON.stringify(["' + YEAR + '"]));' +
    'localStorage.setItem("dac:overrides", JSON.stringify({"' + TABLE + ':' + YEAR +
    '": ' + JSON.stringify(SEED) + '}));' +
    'localStorage.setItem("dac:history", "[]");';

  const SERVE = (function () {
    if (WHICH !== 'before') return DEV;
    const dir = path.join(os.tmpdir(), 'clcpa303r2-base-' + BASE);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.cpSync(DEV, dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'app.js'),
      execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
        .toString('utf8').replace(new RegExp(String.fromCharCode(92)+"r?"+String.fromCharCode(92)+"n","g"), CRLF));
    return dir;
  })();
  log('serving: ' + (WHICH === 'before' ? 'BASE ' + BASE + ' (pinned copy)' : 'the working tree'));
  log('');
  const D = await live.open({ dir: SERVE, seedStorage: seed });
  const B = D.B;
  try {
    /* the build the BROWSER is running, not the one git derives */
    const stamp = (D.console().filter(l => /\[DAC dashboard\] build/.test(l))[0] || '')
      .replace(/.*build\s*/, '').trim();
    /* A LOCAL RUN READS 'dev' BY DESIGN: app.js carries 'dev' in the repo and
     * only a deploy stamps it, so the stamp below is not the hosted one and
     * a mismatch here is not a finding. What ties this run to the wave is the
     * derived id of the bytes being served. */
    log('the console stamp in this browser: ' + (stamp || 'MISSING') +
      '   (a repo-served build is unstamped by design)');
    log('the derived id of the bytes served: ' + BUILD +
      '   (the hosted build for this tip)');
    log('');

    await D.gotoIngest();
    await D.pick('B', TABLE, YEAR);

    /* ---- STEP 1: the template, from the real button ------------------- */
    log('STEP 1  Download Template, pressed inside the Add Data dialog');
    await openDialog(B);
    await B.send('Browser.setDownloadBehavior',
      { behavior: 'allow', downloadPath: DL, eventsEnabled: true });
    await B.click('#ingest-template');
    let file = null;
    for (let i = 0; i < 60; i++) {
      await sleep(250);
      const f = fs.readdirSync(DL).filter(n => /\.xlsx$/i.test(n) && !/crdownload$/i.test(n));
      if (f.length) { file = path.join(DL, f[0]); break; }
    }
    if (!file) throw new Error('the template never landed in ' + DL);
    const bytes = new Uint8Array(fs.readFileSync(file));
    log('  downloaded: ' + path.basename(file) + '  ' + bytes.length + ' bytes');
    const parts = unzipStored(bytes);
    const sheetName = Object.keys(parts).filter(n => /worksheets\/sheet2\.xml$/.test(n))[0];
    const rows = sheetRows(parts[sheetName]);
    const header = rows.find(r => String(r[0] || '').trim().toLowerCase() === 'category') ||
      rows[0];
    log('  the table sheet, as the workbook writes it:');
    rows.forEach(r => log('      ' + JSON.stringify(r)));
    const l2 = header.indexOf('L2 Plugs');
    const tp = header.indexOf('Total Plugs');
    log('  L2 Plugs is column ' + l2 + ', Total Plugs is column ' + tp);
    const totalRow = rows.find(r => String(r[0] || '').trim().toLowerCase() === 'total');
    log('  the Total row exports        : ' + JSON.stringify(totalRow));
    log('  the Total Plugs column exports: ' + JSON.stringify(
      rows.filter(r => r !== header).map(r => r[tp])));
    log('');

    /* ---- STEP 2: the operator files a divergent column total ---------- */
    log('STEP 2  the operator replaces the Total rows L2 Plugs marker with ' + FILED);
    const bodyIdx = rows.indexOf(header);
    const csvRows = rows.slice(bodyIdx).map(r => r.slice());
    const tIdx = csvRows.findIndex(r => String(r[0] || '').trim().toLowerCase() === 'total');
    const was = csvRows[tIdx][l2];
    csvRows[tIdx][l2] = String(FILED);
    log('  Total row / L2 Plugs: ' + JSON.stringify(was) + ' -> ' + FILED);
    log('  the CSV the operator saves, one row per line:');
    csvRows.forEach(r => log('      ' + r.join(',')));
    log('');

    /* ---- STEP 3: the stager's count ----------------------------------- */
    log('STEP 3  the file staged in the Add Data dialog');
    const st = await importCsv(B, toCsv(csvRows), TABLE + '_' + YEAR + '.csv');
    log('  the stager says   : ' + (st.staged || '(none)'));
    log('  the confirm button: ' + (st.label || 'MISSING'));
    const mentions999 = /999/.test(String(st.staged || '')) ||
      /999/.test(String(st.help || ''));
    log('  does anything on this screen mention the filed ' + FILED + '? ' + mentions999);
    await B.screenshot(SHOT);
    log('  screenshot: ' + path.basename(SHOT));
    log('');

    /* ---- STEP 4: Load Data -------------------------------------------- */
    log('STEP 4  Load Data');
    await loadData(B);
    const banner = await textOf(B, '.ingest-import-summary, .ingest-import');
    const notices = await allText(B, '.ingest-import-notice');
    const box = await textOf(B, '#ingest-import-mount');
    const grid = await gridRows(B);
    const gTotal = grid.find(r => /^\[?Total\]?$/.test(String(r[0] || '').trim()));
    /* the badge renders the glyph plus the words, so it is found by the
     * WORDS it can say rather than by a class guessed from the outside */
    const state = await B.eval('(function(){var f=null;' +
      'document.querySelectorAll("#view-container *").forEach(function(e){' +
      'if(e.children.length)return;var t=e.textContent.trim();' +
      'if(/^[^A-Za-z]*(No Changes|Unsaved Changes)$/.test(t))f=f||t;});return f;})()');
    log('  the result box says : ' + (banner || box || '(none)'));
    log('  the drafts Total row: ' + JSON.stringify(gTotal));
    log('  notices in the box  : ' + (notices.length ? '' : '(none)'));
    notices.forEach(n => log('      - ' + n));
    log('  any notice naming ' + FILED + '? ' +
      notices.some(n => n.indexOf(String(FILED)) >= 0));
    log('  the state reads     : ' + (state || 'MISSING'));
    log('');

    /* ---- THE CONTRAST: the row-wise kept figure ----------------------- */
    log('CONTRAST  the same gesture on the ROW axis, which the owner reports works');
    await B.goto(D.base + 'ExecutiveDashboard.html', '#view-container');
    await sleep(900);
    await B.run(seed);
    await B.goto(D.base + 'ExecutiveDashboard.html', '#view-container');
    await sleep(1200);
    await D.gotoIngest();
    await D.pick('B', TABLE, YEAR);
    const rowCsv = rows.slice(bodyIdx).map(r => r.slice());
    const dIdx = rowCsv.findIndex(r => String(r[0] || '').trim().toLowerCase() === 'dac');
    const wasRow = rowCsv[dIdx][tp];
    rowCsv[dIdx][tp] = '900';
    log('  DAC / Total Plugs: ' + JSON.stringify(wasRow) + ' -> 900   ' +
      '(its own components give ' + (SEED[0][1] + SEED[0][2] + SEED[0][3]) + ')');
    await openDialog(B);
    const st2 = await importCsv(B, toCsv(rowCsv), TABLE + '_' + YEAR + '_row.csv');
    log('  the stager says   : ' + (st2.staged || '(none)'));
    await loadData(B);
    const notices2 = await allText(B, '.ingest-import-notice');
    const banner2 = await textOf(B, '.ingest-import-summary, .ingest-import');
    const grid2 = await gridRows(B);
    log('  the result box says : ' + (banner2 || '(none)'));
    log('  notices in the box  : ' + (notices2.length ? '' : '(none)'));
    notices2.forEach(n => log('      - ' + n));
    log('  any notice naming 900? ' + notices2.some(n => n.indexOf('900') >= 0));
    const dacRow = grid2.find(r => /^\[?DAC\]?$/.test(String(r[0] || '').trim()));
    log('  the drafts DAC row  : ' + JSON.stringify(dacRow));
    log('');

    /* ---- WHAT STAYS REFUSED, AND MUST NOW SAY SO ------------------- */
    log("REFUSAL  a percentage column is the engine's on every row, so a");
    log("         filed figure there is still refused -- CLCPA-88. The point");
    log("         of this leg is that the refusal is NAMED, not silent.");
    await B.goto(D.base + "ExecutiveDashboard.html", "#view-container");
    await sleep(800);
    await B.run(A1_SEED);
    await B.goto(D.base + "ExecutiveDashboard.html", "#view-container");
    await sleep(1200);
    await D.gotoIngest();
    await D.pick("A", "A1", YEAR);
    await openDialogFor(B, "A", "A1", YEAR);
    const a1csv = await templateCsv(B, function (rows, header) {
      const pctCol = header.findIndex(function (h) { return /%/.test(String(h)); });
      const tIdx = rows.findIndex(function (r) {
        return String(r[0] || "").trim().toLowerCase() === "total"; });
      if (pctCol < 0 || tIdx < 0) return null;
      log("  A1 header            : " + JSON.stringify(header));
      log("  the percentage column: " + pctCol + " " + JSON.stringify(header[pctCol]));
      log("  Total row / that column: " + JSON.stringify(rows[tIdx][pctCol]) +
        " -> 88");
      rows[tIdx][pctCol] = "88";
      return rows;
    });
    if (!a1csv) { log("  SKIPPED: A1 has no percentage column in this schema"); }
    else {
      const stR = await importCsv(B, a1csv, "A1_" + YEAR + ".csv");
      log("  the stager says   : " + (stR.staged || "(none)"));
      log("  does the staging screen warn the figure will be dropped? " +
        /will not be imported/.test(String(stR.staged)));
      await loadData(B);
      const nR = await allText(B, ".ingest-import-notice");
      log("  notices in the box  : " + (nR.length ? "" : "(none)"));
      nR.forEach(function (n) { log("      - " + n); });
      log("  any notice naming the refused 88? " +
        nR.some(function (n) { return n.indexOf("88") >= 0; }));
      const gR = await gridRows(B);
      const tR = gR.find(function (r) {
        return /^\[?Total\]?$/.test(String(r[0] || "").trim()); });
      log("  the drafts Total row: " + JSON.stringify(tR));
    }
    log("");
    const errs = D.errors();
    log('page errors: ' + (errs.length ? JSON.stringify(errs) : 'none'));
  } finally {
    await D.close();
    try { fs.rmSync(DL, { recursive: true, force: true }); } catch (e) {}
  }

  fs.writeFileSync(OUT, lines.join('\n') + '\n');
})().catch((e) => {
  log('THREW: ' + (e && e.stack || e));
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(2);
});
