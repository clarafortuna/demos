const _dacRepo = () => {
  const p = require('path'), f = require('fs');
  if (process.env.DAC_REPO) return p.resolve(process.env.DAC_REPO);
  let d = __dirname;
  for (let i = 0; i < 16; i++) {
    if (f.existsSync(p.join(d, '.clcpa-root'))) {
      const two = p.resolve(d, '..', '..');
      return f.existsSync(p.join(two, '.git')) ? two : d;
    }
    const u = p.dirname(d); if (u === d) break; d = u;
  }
  throw new Error('CLCPA project root not found above ' + __dirname + '; set DAC_REPO');
};
/* The Report Data page, in a REAL browser, on a served build.
 *
 * The tightened verification standard: gestures are reproduced here, in Chrome,
 * against a served build, before any code and again after it. The Node bench
 * (live_editor.js) still proves logic and still runs in the suites; it is no
 * longer sufficient on its own, because three consecutive hosted FAILs lived in
 * the rendered surface it cannot see.
 *
 * The page password gate is set directly in sessionStorage. Its own comment
 * says it protects nothing and redirects one page; this is localhost against
 * the repo's own files.
 */
const path = require('path');
const { launch, serve } = require('./cdp.js');

const SRC = _dacRepo() + '/Coned/CLCPA/ExecutiveDashboard_dev';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * open({ port, cdpPort, year, section, table })
 * Returns a driver with gesture helpers and DOM readers.
 */
async function open(opts) {
  const o = opts || {};
  const httpPort = o.port || (8800 + Math.floor(Math.random() * 90));
  const cdpPort = o.cdpPort || (9400 + Math.floor(Math.random() * 90));
  const srv = serve(o.dir || SRC, httpPort);
  const B = await launch({ port: cdpPort });
  const base = 'http://127.0.0.1:' + httpPort + '/';

  await B.goto(base + 'index.html', 'body');
  await B.run('sessionStorage.setItem("dac_authenticated","true");');
  if (o.seedStorage) await B.run(o.seedStorage);
  await B.goto(base + 'ExecutiveDashboard.html', '#view-container');
  /* the app boots asynchronously: wait for its own console line rather than a
   * guessed delay, so a slow boot never reads as a missing element */
  for (let i = 0; i < 120; i++) {
    if (B.consoleLines.some(l => /\[DAC dashboard\] build/.test(l))) break;
    await sleep(150);
  }

  const D = {
    B, srv, base,
    console: () => B.consoleLines.slice(),
    errors: () => B.pageErrors.slice(),

    /** go to Report Data and wait for the grid to exist */
    gotoIngest: async () => {
      await B.run('location.hash = "#/ingest";');
      for (let i = 0; i < 120; i++) {
        await sleep(150);
        if (await B.eval('!!document.querySelector("#ingest-editor-mount")')) return D;
      }
      throw new Error('live_browser: the Report Data page never mounted');
    },

    /** choose section, table and year through the real pickers */
    pick: async (sectionId, tableId, year) => {
      if (sectionId) {
        await B.run('var s=document.getElementById("ingest-section"); if(s){s.value=' +
          JSON.stringify(sectionId) + '; s.dispatchEvent(new Event("change",{bubbles:true}));}');
        await sleep(250);
      }
      if (tableId) {
        /* the table picker is a TAB ROW, not a select: clicked, not set */
        const sel = '[data-ingest-table="' + tableId + '"]';
        const there = await B.eval('!!document.querySelector(' + JSON.stringify(sel) + ')');
        if (!there) throw new Error('live_browser: no table tab for ' + tableId +
          ' (is it in the selected section?)');
        await B.click(sel);
        await sleep(300);
      }
      if (year) {
        await B.run('var y=document.getElementById("ingest-year"); if(y){y.value=' +
          JSON.stringify(year) + '; y.dispatchEvent(new Event("change",{bubbles:true}));}');
        await sleep(250);
        /* A DIRTY DRAFT GUARDS THE SWITCH, and that guard is correct app
         * behaviour -- the one CLCPA-297 must preserve. A helper that walks
         * away from it leaves the OLD year on screen while the caller believes
         * it switched: it read 3 body rows for a 24-row table and looked like
         * a regression in the fix under test. Answered explicitly, and the
         * caller is told it happened. */
        if (await B.eval('!!document.querySelector(\'[data-cfm="confirm"]\')')) {
          if (o.refuseDiscard) throw new Error('live_browser: the year switch is ' +
            'guarded by a dirty draft and refuseDiscard is set');
          D.lastSwitchDiscarded = true;
          await B.click('[data-cfm="confirm"]');
          await sleep(400);
        } else {
          D.lastSwitchDiscarded = false;
        }
      }
      return D;
    },

    /* ---- what the operator can SEE ------------------------------------- */
    headerRows: () => B.eval(
      'Array.from(document.querySelectorAll("#ingest-editor-mount thead tr")).map(function(tr){' +
      'return Array.from(tr.querySelectorAll("th")).map(function(th){return th.textContent.trim();});})'),
    bodyRowCount: () => B.eval(
      'document.querySelectorAll("#ingest-editor-mount tbody tr").length'),
    /** rows that actually offer an editable cell -- what "a visible row" means */
    editableRowCount: () => B.eval(
      'Array.from(document.querySelectorAll("#ingest-editor-mount tbody tr"))' +
      '.filter(function(tr){return tr.querySelector("input.ingest-cell");}).length'),
    bodyRow: (n) => B.eval(
      '(function(){var tr=document.querySelectorAll("#ingest-editor-mount tbody tr")[' + n + '];' +
      'if(!tr) return null; return Array.from(tr.querySelectorAll("td")).map(function(td){' +
      'var i=td.querySelector("input"); return i? ("input:"+i.value) : td.textContent.trim();});})()'),
    /** the value the operator READS in a cell, input or calc span alike */
    cellText: (r, c) => B.eval(
      '(function(){var s="[data-row=\\"' + r + '\\"][data-col=\\"' + c + '\\"]";' +
      'var e=document.querySelector("#ingest-editor-mount "+s); if(!e) return null;' +
      'return e.tagName==="INPUT" ? e.value : e.textContent.trim();})()'),
    rowCounterText: () => B.eval(
      '(function(){var e=document.querySelector(".ingest-status, .ingest-card-foot");' +
      'return e? e.textContent.replace(/\\s+/g," ").trim().slice(0,120) : null;})()'),
    noticeText: () => B.eval(
      '(function(){var m=document.getElementById("ingest-import-mount");' +
      'return m? m.textContent.replace(/\\s+/g," ").trim() : "";})()'),
    draft: () => B.eval('JSON.parse(JSON.stringify(window.__dacState ? window.__dacState.ingest.draft : null))'),

    /* ---- gestures, dispatched by the browser ---------------------------- */
    clickAddRow: async () => { await B.click('#ingest-add-row'); await sleep(200); return D; },
    clickReset: async () => {
      await B.click('#ingest-reset'); await sleep(200);
      const has = await B.eval('!!document.querySelector(\'[data-cfm="confirm"]\')');
      if (has) { await B.click('[data-cfm="confirm"]'); await sleep(250); }
      return D;
    },
    /** Save Changes, through the confirmation it really raises.
     *
     * The save modal confirms on #ingest-modal-confirm, NOT on the
     * [data-cfm="confirm"] the discard prompt uses. A script that answers the
     * wrong one reports "saved" over a dialog still sitting open, and the
     * store never moves -- which is exactly how a save leg reads as a defect
     * that was never driven. Returns whether a dialog was answered. */
    clickSave: async () => {
      await B.click('#ingest-save');
      await sleep(600);
      const has = await B.eval('!!document.querySelector("#ingest-modal-confirm")');
      if (has) { await B.click('#ingest-modal-confirm'); await sleep(900); }
      return has;
    },
    /** what localStorage actually holds for a table-year, after a save */
    storedRows: (tableId, year) => B.eval(
      '(function(){try{var o=JSON.parse(localStorage.getItem("dac:overrides")||"{}");' +
      'return o[' + JSON.stringify(tableId) + '+":"+' + JSON.stringify(year) + '] || null;}' +
      'catch(e){return null;}})()'),
    /** type digit by digit into a cell and leave it, exactly as a person does */
    typeCell: async (r, c, text) => {
      const sel = '#ingest-editor-mount input[data-row="' + r + '"][data-col="' + c + '"]';
      await B.typeInto(sel, text);
      await B.blur(sel);
      await sleep(150);
      return D;
    },
    shot: (file) => B.screenshot(file),
    close: async () => { await B.close(); srv.stop(); },
  };
  return D;
}

module.exports = { open };
