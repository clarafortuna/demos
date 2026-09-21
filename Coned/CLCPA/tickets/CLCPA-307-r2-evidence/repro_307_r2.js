/* CLCPA-307 round 2: the fossil strings, re-reproduced BEFORE any code.
 *
 * Round 1 fixed the template's Instructions sheet and left two surfaces
 * saying "Add Year". The new fact the round 1 gestures exposed is that the
 * dialog's confirm button is CONTEXTUAL -- "Add Year" for a year that does
 * not exist yet, "Load Data" for one that does -- so the two survivors are
 * not merely stale, they are blind to state:
 *
 *   the rejection notice names a button that is not on screen AND promises
 *   a year addition that will not happen;
 *   the help text sits on the same screen as a button reading Load Data.
 *
 * Measured here on BOTH paths against the current tip, because a string that
 * happens to be right in one path and wrong in the other cannot be judged
 * from one screenshot. The third surface is checked too: a round 1 fix that
 * has silently regressed would otherwise be reported as still fixed.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const live = require('../_kit/live_browser.js');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'repro-307-r2-output.txt');
const SHOT = path.join(__dirname, 'repro-307-r2-existing-year.png');
const DL = fs.mkdtempSync(path.join(os.tmpdir(), 'clcpa307r2-dl-'));

const HEAD = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
const BUILD = (() => {
  try {
    return require(path.join(DEV, 'Data/stamp_build.js')).prepare(DEV + '/').ids['app.js'];
  } catch (e) { return 'MISSING'; }
})();

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const TABLE = 'B2';
const EXISTING = '2098';   /* seeded below, so the dialog takes the Load path */
const FRESH = '2099';      /* never seeded, so it takes the Add path */
const SEED = [['DAC', 143, 10, 0, 153], ['Non-DAC', 100, 40, 0, 140],
  ['Total', 243, 50, 0, 293]];

/* a formula is a HARD rejection by name, and it is a real thing a saved
 * spreadsheet does, so it reaches the rejection notice without inventing a
 * failure mode the importer does not have */
const REJECTED_CSV = [
  'Category,L2 Plugs,DCFC Plugs,Micromobility Power Cabinets,Total Plugs',
  'DAC,=SUM(B2:B3),10,0,(calculated)',
  'Non-DAC,100,40,0,(calculated)',
].join('\r\n') + '\r\n';

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
const sheetText = (xml) => (xml.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || [])
  .map(t => t.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));

/* what the OPERATOR can read on this screen, and what the button SAYS */
async function dialogState(B, year) {
  await B.click('#ingest-addyear');
  await sleep(700);
  await B.run('var y=document.getElementById("dlg-newyear");' +
    'if(y){y.value="' + year + '";y.dispatchEvent(new Event("input",{bubbles:true}));' +
    'y.dispatchEvent(new Event("change",{bubbles:true}));}' +
    'var s=document.getElementById("dlg-section");' +
    'if(s){s.value="B";s.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(500);
  await B.run('var t=document.getElementById("dlg-table");' +
    'if(t){t.value="' + TABLE + '";t.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(500);
  const button = await B.eval('(function(){var f=null;' +
    'document.querySelectorAll(".ingest-modal-foot button").forEach(function(e){' +
    'var t=e.textContent.trim();if(t!=="Cancel")f=f||t;});return f;})()');
  const consequence = await B.eval('(function(){var e=' +
    'document.getElementById("dlg-consequence");' +
    'return e?e.textContent.replace(/\\s+/g," ").trim():null;})()');
  const help = await B.eval('(function(){var e=' +
    'document.querySelector(".ingest-import-note");' +
    'return e?e.textContent.replace(/\\s+/g," ").trim():null;})()');
  return { button, consequence, help };
}

async function stageRejected(B) {
  await B.run('var dt=new DataTransfer();dt.items.add(new File([' +
    JSON.stringify(REJECTED_CSV) + '],"rejected.csv",{type:"text/csv"}));' +
    'var el=document.getElementById("ingest-file");el.files=dt.files;' +
    'el.dispatchEvent(new Event("change",{bubbles:true}));');
  await sleep(1500);
  return B.eval('(function(){var e=document.querySelector(".ingest-staged");' +
    'return e?e.textContent.replace(/\\s+/g," ").trim():null;})()');
}

const closeDialog = (B) => B.run('(function(){var b=null;' +
  'document.querySelectorAll(".ingest-modal-foot button").forEach(function(e){' +
  'if(e.textContent.trim()==="Cancel")b=e;});if(b)b.click();})()');

(async () => {
  log('CLCPA-307 round 2: two fossil strings, and a button that changes name');
  log('re-reproduced against the current tip: main @ ' + HEAD + ', build ' + BUILD);
  log('  (a repo-served build reports its stamp as dev by design; the derived');
  log('   id above is what ties this run to the wave)');
  log('');

  /* ---- the served bundle's own literals, measured not assumed ---------- */
  log('THE LITERALS IN THE SERVED BUNDLE, comments stripped');
  const src = fs.readFileSync(path.join(DEV, 'app.js'), 'utf8');
  /* JS comments AND HTML ones. The markup is built in template literals
   * that carry HTML comment prose, so stripping only the JS comment forms
   * left a note about an old button rename in the hit list and made this
   * sweep report three operator-facing literals where there are two.
   * Comment prose counted as code is the oldest defect in this harness. */
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
  const hits = [];
  code.split(/\r?\n/).forEach((l, n) => {
    if (/Add Year|Add New Year/.test(l)) hits.push((n + 1) + ': ' + l.trim());
  });
  hits.forEach(h => log('  ' + h));
  log('  ' + hits.length + ' line(s) carry the literal outside comments.');
  log('');

  const seed = 'localStorage.setItem("dac:years", JSON.stringify(["' + EXISTING + '"]));' +
    'localStorage.setItem("dac:overrides", JSON.stringify({"' + TABLE + ':' + EXISTING +
    '": ' + JSON.stringify(SEED) + '}));' +
    'localStorage.setItem("dac:history", "[]");';

  const D = await live.open({ dir: DEV, seedStorage: seed });
  const B = D.B;
  try {
    await D.gotoIngest();
    await D.pick('B', TABLE, EXISTING);

    /* ---- SURFACE 3: the template's Instructions sheet ----------------- */
    log('SURFACE 3  the template Instructions sheet, which round 1 FIXED');
    await B.click('#ingest-addyear');
    await sleep(700);
    await B.run('var s=document.getElementById("dlg-section");' +
      'if(s){s.value="B";s.dispatchEvent(new Event("change",{bubbles:true}));}');
    await sleep(400);
    await B.run('var t=document.getElementById("dlg-table");' +
      'if(t){t.value="' + TABLE + '";t.dispatchEvent(new Event("change",{bubbles:true}));}');
    await sleep(400);
    await B.send('Browser.setDownloadBehavior',
      { behavior: 'allow', downloadPath: DL, eventsEnabled: true });
    await B.click('#ingest-template');
    let file = null;
    for (let i = 0; i < 60; i++) {
      await sleep(250);
      const f = fs.readdirSync(DL).filter(n => /\.xlsx$/i.test(n) && !/crdownload$/i.test(n));
      if (f.length) { file = path.join(DL, f[0]); break; }
    }
    if (!file) throw new Error('the template never landed');
    const parts = unzipStored(new Uint8Array(fs.readFileSync(file)));
    const s1 = Object.keys(parts).filter(n => /worksheets\/sheet1\.xml$/.test(n))[0];
    const instr = sheetText(parts[s1]);
    instr.filter(t => /press|Report Data|Add /i.test(t))
      .forEach(t => log('  ' + t));
    const stale = instr.filter(t => /Add Year|Add New Year/.test(t));
    log('  any "Add Year" left on the Instructions sheet? ' +
      (stale.length ? JSON.stringify(stale) : 'no, still fixed'));
    await closeDialog(B);
    await sleep(500);
    log('');

    /* ---- THE EXISTING-YEAR PATH: the button says Load Data ------------ */
    log('THE EXISTING-YEAR PATH  (' + EXISTING + ' is seeded, so nothing is added)');
    const ex = await dialogState(B, EXISTING);
    log('  the confirm button reads : ' + JSON.stringify(ex.button));
    log('  the consequence line says: ' + JSON.stringify(ex.consequence));
    log('  the import help text says: ' + JSON.stringify(ex.help));
    log('  does the help name a button that is NOT on screen? ' +
      (/Add Year/.test(String(ex.help)) && ex.button !== 'Add Year'));
    const exReject = await stageRejected(B);
    log('  a rejected file stages as: ' + JSON.stringify(exReject));
    log('  does the rejection name a button that is NOT on screen? ' +
      (/Add Year/.test(String(exReject)) && ex.button !== 'Add Year'));
    log('  does it promise a year addition that will NOT happen? ' +
      /will still add the year/.test(String(exReject)));
    await B.screenshot(SHOT);
    log('  screenshot: ' + path.basename(SHOT));
    await closeDialog(B);
    await sleep(500);
    log('');

    /* ---- THE FRESH-YEAR PATH: the button says Add Year --------------- */
    log('THE FRESH-YEAR PATH  (' + FRESH + ' does not exist, so a year IS added)');
    const fr = await dialogState(B, FRESH);
    log('  the confirm button reads : ' + JSON.stringify(fr.button));
    log('  the consequence line says: ' + JSON.stringify(fr.consequence));
    log('  the import help text says: ' + JSON.stringify(fr.help));
    const frReject = await stageRejected(B);
    log('  a rejected file stages as: ' + JSON.stringify(frReject));
    log('  on THIS path the same two strings happen to be right: ' +
      (fr.button === 'Add Year'));
    await closeDialog(B);
    log('');

    /* ---- AND THEY MUST FOLLOW THE BOX AS IT IS TYPED -------------- */
    log("LIVE TYPING  the operator retypes the year without closing the dialog");
    const live1 = await dialogState(B, FRESH);
    const liveStaged1 = await stageRejected(B);
    await B.run("var y=document.getElementById('dlg-newyear');" +
      "if(y){y.value='" + EXISTING + "';" +
      "y.dispatchEvent(new Event('input',{bubbles:true}));}");
    await sleep(700);
    const btn2 = await B.eval("(function(){var f=null;" +
      "document.querySelectorAll('.ingest-modal-foot button').forEach(" +
      "function(e){var t=e.textContent.trim();if(t!=='Cancel')f=f||t;});" +
      "return f;})()");
    const help2 = await B.eval("(function(){var e=" +
      "document.querySelector('.ingest-import-note');" +
      "return e?e.textContent.replace(/\\s+/g,' ').trim():null;})()");
    const staged2 = await B.eval("(function(){var e=" +
      "document.querySelector('.ingest-staged');" +
      "return e?e.textContent.replace(/\\s+/g,' ').trim():null;})()");
    log("  typed " + FRESH + ": button " + JSON.stringify(live1.button) +
      ", help ends " + JSON.stringify(String(live1.help).slice(-24)));
    log("  then " + EXISTING + ": button " + JSON.stringify(btn2) +
      ", help ends " + JSON.stringify(String(help2).slice(-24)));
    log("  the help text followed the button? " +
      (btn2 === "Load Data" && /press Load Data\./.test(String(help2))));
    log("  the rejection notice followed it too? " +
      (/Load Data will still load the table-year/.test(String(staged2))));
    log("  and it no longer promises a year addition? " +
      !/will still add the year/.test(String(staged2)));
    await closeDialog(B);
    log("");

    log('WHAT THIS MEASURES');
    log('  The two strings are literals. On the fresh path they agree with the');
    log('  button by coincidence; on the existing path the button reads ' +
      JSON.stringify(ex.button) + ',');
    log('  the help still says Add Year, and the rejection notice both names');
    log('  that absent button and promises a year addition that cannot happen.');

    const errs = D.errors();
    log('');
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
