/* CLCPA-319 round 2: the live draft recompute on blur, in a real browser.
 *
 * THE GESTURE, exactly as the ticket states it: open the editor on a G
 * table, type 500 into a data row, BLUR, and read the percentages off the
 * draft BEFORE saving. The reported defect is that those percentages come
 * out against a doubled denominator -- 49.33 / 1.34 / 50.67 where load and
 * save give 97.36 / 2.64 / 100.00.
 *
 * WHY THIS HAS TO BE A BROWSER TEST. The offline harness can call
 * recomputeTotals with any baseline it likes, and the answer depends
 * entirely on which one. Only the page knows what state.ingest.baseline
 * actually holds for a scratch year, and that is the whole question.
 *
 * ALL THREE PATHS, against the same expected figures:
 *
 *   LOAD   what the editor shows when the year is opened
 *   BLUR   what it shows after the edit, before any save
 *   SAVE   what it shows after saving and reloading the page
 *
 * AND THE IMPORT PATH, which the ticket says does NOT carry the defect and
 * which the fix must not touch: an imported draft is checked for the exact
 * figures the hosted pass saw.
 *
 *   node repro_319_r2.js            both builds
 *   node repro_319_r2.js base       the deployed build alone
 *   node repro_319_r2.js fix
 *
 * 2098 is this probe's own year on a throwaway profile. The live org is not
 * touched and 2096, which is CLCPA-301's reproduction, is not gone near.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const { open } = require('../_kit/live_browser.js');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev';
const BASE_REF = process.env.DAC_BASE_COMMIT || '8bf5ea7';
const OUT = path.join(__dirname, 'repro-319-r2-output.txt');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* the DEPLOYED build, which is what is live in the org */
function baseDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dac-base-'));
  ['app.js', 'ExecutiveDashboard.html', 'index.html', 'styles.css',
   'payload.json', 'map_payload.json'].forEach((f) => {
    try {
      fs.writeFileSync(path.join(d, f),
        execSync('git show ' + BASE_REF + ':"' + REL + '/' + f + '"',
          { cwd: ROOT, maxBuffer: 1e9 }));
    } catch (e) { /* a file that build did not have */ }
  });
  return d;
}

const ID = 'G1';
const YEAR = '2098';
/* the scratch year the ticket describes: two data rows and a total row */
const SEED = [
  ['Feet Replaced within DAC', 9999, null],
  ['Feet Replaced not in a DAC', 999, null],
  ['Systemwide Total', null, null],
];
const EDIT_ROW = 0, EDIT_TO = 500;

const gridOf = async (B) => {
  const g = await B.eval('(function(){var o=[];' +
    'document.querySelectorAll("#ingest-editor-mount tr").forEach(function(tr){' +
    'var cs=[];tr.querySelectorAll("td,th").forEach(function(td){' +
    'var i=td.querySelector("input");' +
    'cs.push(i?("["+i.value+"]"):td.textContent.trim());});' +
    'if(cs.length)o.push(cs);});return JSON.stringify(o);})()');
  try { return JSON.parse(g || '[]'); } catch (e) { return []; }
};
const pctColumn = (rows) => rows.slice(1).map(r => r[2]);

async function seedYear(D, rows) {
  const B = D.B;
  await B.run('(function(){' +
    'var o={};try{o=JSON.parse(localStorage.getItem("dac:overrides")||"{}");}catch(e){}' +
    'o[' + JSON.stringify(ID + ':' + YEAR) + ']=' + JSON.stringify(rows) + ';' +
    'localStorage.setItem("dac:overrides",JSON.stringify(o));' +
    'var y=[];try{y=JSON.parse(localStorage.getItem("dac:years")||"[]");}catch(e){}' +
    'if(y.indexOf("' + YEAR + '")<0)y.push("' + YEAR + '");' +
    'localStorage.setItem("dac:years",JSON.stringify(y));})()');
  await B.goto(D.base + 'ExecutiveDashboard.html', '#view-container');
  await sleep(900);
  await D.gotoIngest();
  await D.pick('G', ID, YEAR);
  await sleep(700);
}

async function run(tag, dir) {
  log('');
  log('=======================================================================');
  log(' ' + tag);
  log('=======================================================================');
  const D = await open({ dir: dir });
  const B = D.B;
  try {
    await seedYear(D, SEED);

    const atLoad = await gridOf(B);
    log('  LOAD   ' + JSON.stringify(atLoad.slice(1).map(r => r.slice(1))));

    /* THE GESTURE. Type into the cell and blur it, the way a person does:
     * an input event while typing, then change + blur on leaving. Nothing
     * is saved. */
    await B.run('(function(){' +
      'var rows=document.querySelectorAll("#ingest-editor-mount tbody tr");' +
      'var tr=rows[' + EDIT_ROW + '];if(!tr)return "no row";' +
      'var i=tr.querySelectorAll("input")[1];if(!i)return "no input";' +
      'i.focus();i.value="' + EDIT_TO + '";' +
      'i.dispatchEvent(new Event("input",{bubbles:true}));' +
      'i.dispatchEvent(new Event("change",{bubbles:true}));' +
      'i.blur();i.dispatchEvent(new Event("blur",{bubbles:true}));' +
      'return "edited";})()');
    await sleep(1200);
    const atBlur = await gridOf(B);
    log('  BLUR   ' + JSON.stringify(atBlur.slice(1).map(r => r.slice(1))));

    /* and then save, and reload, so the third path is read from storage */
    await B.click('#ingest-save');
    await sleep(900);
    const hasDlg = await B.eval('!!document.getElementById("ingest-modal-confirm")');
    if (!hasDlg) {
      log('  SAVE   the confirm dialog did not open, so nothing was saved');
    } else {
      await B.run('var n=document.getElementById("ingest-modal-name");' +
        'if(n){n.value="Repro";n.dispatchEvent(new Event("input",{bubbles:true}));}' +
        'var e=document.getElementById("ingest-modal-email");' +
        'if(e){e.value="repro@example.invalid";' +
        'e.dispatchEvent(new Event("input",{bubbles:true}));}');
      await sleep(400);
      await B.click('#ingest-modal-confirm');
      await sleep(1500);
      await B.goto(D.base + 'ExecutiveDashboard.html', '#view-container');
      await sleep(900);
      await D.gotoIngest();
      await D.pick('G', ID, YEAR);
      await sleep(800);
      const atSave = await gridOf(B);
      log('  SAVE   ' + JSON.stringify(atSave.slice(1).map(r => r.slice(1))));
      const p = pctColumn(atSave), q = pctColumn(atBlur);
      log('');
      log('  the percentage column, the three paths side by side:');
      log('      load ' + JSON.stringify(pctColumn(atLoad)));
      log('      blur ' + JSON.stringify(q));
      log('      save ' + JSON.stringify(p));
      log('      blur and save agree: ' + (JSON.stringify(q) === JSON.stringify(p)));
    }

    /* --- AND THE IMPORT PATH, which must not move ------------------- */
    const csv = 'Category,Feet Replaced,Percentage\n' +
      'Feet Replaced within DAC,2000,\n' +
      'Feet Replaced not in a DAC,1000,\n' +
      'Systemwide Total,,\n';
    await seedYear(D, SEED);
    await B.click('#ingest-addyear');
    await sleep(700);
    await B.run('var y=document.getElementById("dlg-newyear");' +
      'if(y){y.value="' + YEAR + '";y.dispatchEvent(new Event("input",{bubbles:true}));' +
      'y.dispatchEvent(new Event("change",{bubbles:true}));}' +
      'var s=document.getElementById("dlg-section");' +
      'if(s){s.value="G";s.dispatchEvent(new Event("change",{bubbles:true}));}');
    await sleep(450);
    await B.run('var t=document.getElementById("dlg-table");' +
      'if(t){t.value="' + ID + '";t.dispatchEvent(new Event("change",{bubbles:true}));}');
    await sleep(450);
    if (await B.eval('!!document.getElementById("ingest-file")')) {
      await B.run('var dt=new DataTransfer();dt.items.add(new File([' +
        JSON.stringify(csv) + '],"' + ID + '_' + YEAR + '.csv",{type:"text/csv"}));' +
        'var el=document.getElementById("ingest-file");el.files=dt.files;' +
        'el.dispatchEvent(new Event("change",{bubbles:true}));');
      await sleep(1000);
      await B.run('(function(){var b=null;document.querySelectorAll("button").forEach(' +
        'function(e){if(e.textContent.trim()==="Load Data")b=e;});if(b)b.click();})()');
      await sleep(1400);
      const imported = await gridOf(B);
      log('');
      log('  IMPORT into a SCRATCH year (2,000 and 1,000)');
      log('      ' + JSON.stringify(imported.slice(1).map(r => r.slice(1))));
    } else {
      log('  IMPORT the dialog did not open');
    }

    /* --- AND IMPORT INTO A YEAR WHOSE TOTAL ROW HOLDS A FIGURE -------
     *
     * The ticket says the import path does not carry the defect, and the
     * hosted pass saw 66.67 / 33.33 exact. The scratch-year import above
     * does not show those figures on the deployed build, so the two
     * observations are of different states and the difference has to be
     * measured rather than argued.
     *
     * The variable is whether the BASELINE's total row can be confirmed.
     * The scratch seed leaves it empty, so totalRowFlags cannot confirm it
     * from arithmetic and it is swept into the denominator. Seed the same
     * year with the total row POPULATED and import the same file: if that
     * is the whole story, this case is clean on both builds. */
    await seedYear(D, [
      ['Feet Replaced within DAC', 9999, null],
      ['Feet Replaced not in a DAC', 999, null],
      ['Systemwide Total', 10998, null],
    ]);
    await B.click('#ingest-addyear');
    await sleep(700);
    await B.run('var y=document.getElementById("dlg-newyear");' +
      'if(y){y.value="' + YEAR + '";y.dispatchEvent(new Event("input",{bubbles:true}));' +
      'y.dispatchEvent(new Event("change",{bubbles:true}));}' +
      'var s=document.getElementById("dlg-section");' +
      'if(s){s.value="G";s.dispatchEvent(new Event("change",{bubbles:true}));}');
    await sleep(450);
    await B.run('var t=document.getElementById("dlg-table");' +
      'if(t){t.value="' + ID + '";t.dispatchEvent(new Event("change",{bubbles:true}));}');
    await sleep(450);
    if (await B.eval('!!document.getElementById("ingest-file")')) {
      await B.run('var dt=new DataTransfer();dt.items.add(new File([' +
        JSON.stringify(csv) + '],"' + ID + '_' + YEAR + '.csv",{type:"text/csv"}));' +
        'var el=document.getElementById("ingest-file");el.files=dt.files;' +
        'el.dispatchEvent(new Event("change",{bubbles:true}));');
      await sleep(1000);
      await B.run('(function(){var b=null;document.querySelectorAll("button").forEach(' +
        'function(e){if(e.textContent.trim()==="Load Data")b=e;});if(b)b.click();})()');
      await sleep(1400);
      const imp2 = await gridOf(B);
      log('');
      log('  IMPORT into a year whose TOTAL ROW ALREADY HOLDS 10,998');
      log('      ' + JSON.stringify(imp2.slice(1).map(r => r.slice(1))));
    } else {
      log('  IMPORT (populated total) the dialog did not open');
    }

    log('');
    log('  page errors: ' + JSON.stringify(D.errors()));
  } finally { await D.close(); }
}

(async () => {
  const which = (process.argv[2] || 'both').toLowerCase();
  log('CLCPA-319 round 2: the blur-path denominator, in a real browser');
  log('the gesture: ' + EDIT_TO + ' into ' + JSON.stringify(SEED[EDIT_ROW][0]) +
      ' on ' + ID + '/' + YEAR + ', then BLUR, read before saving');
  log('(2098 is this probe\'s own year on a throwaway profile; the live org');
  log(' is not touched and 2096 is not gone near.)');
  if (which === 'both' || which === 'base') await run('BEFORE (the deployed build ' + BASE_REF + ')', baseDir());
  if (which === 'both' || which === 'fix') await run('AFTER (this build)', DEV);
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
})().catch((e) => {
  log('REPRO THREW: ' + (e && e.stack));
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(1);
});
