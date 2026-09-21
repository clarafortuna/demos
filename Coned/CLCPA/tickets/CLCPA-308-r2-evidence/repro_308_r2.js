/* CLCPA-308 round 2: a declared computed row LOOKS computed, on both
 * surfaces. Reproduced before any code.
 *
 * THE RECORDED DECISION THIS SUPERSEDES, and it has to be said out loud.
 * CLCPA-270 deliberately left D2/D3/D4's percentage rows typeable, and its
 * comment gives the reason: "whose denominator is not in the table at all
 * (CLCPA-206) and which the preparer therefore has to type. Locking those
 * would have taken a figure away from the only person who can supply it."
 *
 * That was right when it was written. CLCPA-308 then DECLARED those very
 * rows in DERIVED_ROWS -- D2 rows 2 and 5, D3 rows 2 and 4, D4 rows 2, 4, 7
 * and 9 -- so the engine now computes them from rows that ARE in the table,
 * and PR #305 makes it compute them on the page as well. The premise of the
 * old decision is what changed, not the judgement: a row the engine fills
 * must not invite a figure, because anything typed there is discarded.
 *
 * So the role is taken from the DECLARATION, never from a label pattern or a
 * per-row list. isComputedShareLabel stays exactly as it is for J8 and F7.
 *
 *   node repro_308_r2.js                        the working tree
 *   DAC_308_BUILD=before node repro_308_r2.js   the pinned base
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const live = require('../_kit/live_browser.js');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const WHICH = (process.env.DAC_308_BUILD || 'after').toLowerCase();
const BASE = process.env.DAC_BASE_COMMIT || '2a45a7e';
const OUT = path.join(__dirname, 'repro-308-r2-' + WHICH + '-output.txt');
const CRLF = String.fromCharCode(13) + String.fromCharCode(10);

const HEAD = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; log('  PASS  ' + m); } else { fail++; log('  FAIL  ' + m); } };

const TABLE = 'D3', YEAR = '2098';
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

/* the declared rows, read from the source -- never a list written here */
const DECLARED = (() => {
  const src = fs.readFileSync(path.join(DEV, 'app.js'), 'utf8');
  const i = src.indexOf('const DERIVED_ROWS');
  const blk = src.slice(i, src.indexOf(CRLF + '  };', i));
  const m = new RegExp('^\\s*' + TABLE + ': \\[([^\\]]*)\\]', 'm').exec(blk);
  return m ? (m[1].match(/rowPct\((\d+)/g) || []).map(s => Number(/\d+/.exec(s)[0])) : [];
})();

/* the seed: D3's own newest stored year, so nothing about this table is
 * invented and the percentage rows carry real filed figures */
const SEED = (() => {
  const d = (P.tables[TABLE] || {}).data || {};
  const y = Object.keys(d).sort().pop();
  return (d[y] || []).map(r => r.slice());
})();

function serveDir() {
  if (WHICH !== 'before') return DEV;
  const dir = path.join(os.tmpdir(), 'clcpa308r2-base-' + BASE);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(DEV, dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'app.js'),
    execSync('git show ' + BASE + ':"' + REL + '"', { cwd: ROOT, maxBuffer: 1e9 })
      .toString('utf8').replace(new RegExp(String.fromCharCode(92) + 'r?' +
        String.fromCharCode(92) + 'n', 'g'), CRLF));
  return dir;
}

/* what the EDITOR offers in each cell of a row: an input, or a calc span */
const editorRow = (B, r) => B.eval(
  '(function(){var out=[];' +
  'document.querySelectorAll(\'#ingest-editor-mount tbody tr\')[' + r + ']' +
  '.querySelectorAll("td").forEach(function(td){' +
  'var i=td.querySelector("input");' +
  'if(i) out.push("INPUT:" + i.value);' +
  'else { var s=td.querySelector("span.ingest-cell-calc");' +
  'out.push((s?"CALC:":"TEXT:") + td.textContent.trim()); }});' +
  'return JSON.stringify(out);})()');

/* and whether the page gives the row its total-row treatment */
const pageRowClasses = (B) => B.eval(
  '(function(){var out=[];' +
  'document.querySelectorAll("#view-container table.data-table tbody tr").forEach(function(tr){' +
  'var c0=tr.querySelector("td,th");' +
  'out.push({cls: tr.className || "", label: c0 ? c0.textContent.trim().slice(0,52) : ""});});' +
  'return JSON.stringify(out);})()');

async function openTab(B, id) {
  const sel = '[data-table-id="' + id + '"]';
  if (!await B.eval('!!document.querySelector(' + JSON.stringify(sel) + ')')) return false;
  await B.click(sel);
  await sleep(500);
  return true;
}

(async () => {
  log('CLCPA-308 round 2: a declared computed row, on both surfaces');
  log('base ' + BASE + ' (PR #305 head)   tip ' + HEAD);
  log('serving: ' + (WHICH === 'before' ? 'BASE ' + BASE + ' (pinned copy)' : 'the working tree'));
  log('');
  log('DERIVED_ROWS declares ' + TABLE + ' rows: ' + JSON.stringify(DECLARED));
  log('  those are the rows that must look computed; every other row must not.');
  log('');

  const seed = 'localStorage.setItem("dac:years", JSON.stringify(["' + YEAR + '"]));' +
    'localStorage.setItem("dac:overrides", JSON.stringify({"' + TABLE + ':' + YEAR +
    '": ' + JSON.stringify(SEED) + '}));' +
    'localStorage.setItem("dac:history", "[]");';

  const D = await live.open({ dir: serveDir(), seedStorage: seed });
  const B = D.B;
  try {
    /* ---- SURFACE 1: THE EDITOR ------------------------------------- */
    log('SURFACE 1  the editor, Report Data / ' + TABLE + ' / ' + YEAR);
    await D.gotoIngest();
    await D.pick('D', TABLE, YEAR);
    const nRows = await B.eval('document.querySelectorAll("#ingest-editor-mount tbody tr").length');
    log('  the grid renders ' + nRows + ' body row(s)');
    for (let r = 0; r < nRows; r++) {
      const cells = JSON.parse(await editorRow(B, r) || '[]');
      const declared = DECLARED.indexOf(r) >= 0;
      log('  ' + (declared ? 'DECLARED ' : '         ') + 'row ' + r + ': ' +
        JSON.stringify(cells).slice(0, 150));
    }
    log('');
    for (const r of DECLARED) {
      const cells = JSON.parse(await editorRow(B, r) || '[]');
      const values = cells.slice(1);
      const anyInput = values.some(c => /^INPUT:/.test(c));
      ok(!anyInput, 'a declared computed row offers NO typeable value cell (row ' +
        r + '): ' + JSON.stringify(values).slice(0, 110));
    }
    /* and a DATA row must stay typeable, or the fix has locked the table */
    const dataRow = (() => {
      for (let r = 0; r < nRows; r++) if (DECLARED.indexOf(r) < 0) return r;
      return -1;
    })();
    if (dataRow >= 0) {
      const cells = JSON.parse(await editorRow(B, dataRow) || '[]');
      ok(cells.slice(1).some(c => /^INPUT:/.test(c)),
        'a DATA row is still typeable (row ' + dataRow + ')');
    }
    await B.screenshot(path.join(__dirname, 'repro-308-r2-' + WHICH + '-editor.png'));
    log('');

    /* ---- SURFACE 2: THE SECTION PAGE ------------------------------- */
    log('SURFACE 2  the section page, #/section/D, ' + TABLE + ' tab');
    await B.run('location.hash = "#/section/D";');
    for (let i = 0; i < 120; i++) {
      await sleep(150);
      if (await B.eval('!!document.querySelector("#view-container table")')) break;
    }
    ok(await openTab(B, TABLE), 'the ' + TABLE + ' source tab opened');
    const rows = JSON.parse(await pageRowClasses(B) || '[]');
    rows.forEach((r, i) => log('  row ' + i + '  class=' + JSON.stringify(r.cls) +
      '  ' + JSON.stringify(r.label)));
    const pctRows = rows.filter(r => /^Percentage/.test(r.label));
    log('');
    pctRows.forEach((r) => {
      ok(/is-total|is-subtotal/.test(r.cls),
        'the page gives it the total-row treatment: ' + JSON.stringify(r.label.slice(0, 40)) +
        ' class=' + JSON.stringify(r.cls));
    });
    ok(pctRows.length > 0, 'the page shows ' + pctRows.length + ' percentage row(s)');
    await B.screenshot(path.join(__dirname, 'repro-308-r2-' + WHICH + '-page.png'));

    /* ---- THE MECHANISM MUST NOT REGRESS -------------------------- */
    log('');
    log('NON-REGRESSION  a count edit still recomputes the row, and the save');
    log('                still bills only the operator own cell (CLCPA-302)');
    await D.gotoIngest();
    await D.pick('D', TABLE, YEAR);
    const before = JSON.parse(await editorRow(B, DECLARED[0]) || '[]');
    log('  the declared row before the edit: ' + JSON.stringify(before.slice(1, 3)));
    /* edit a COUNT cell the percentage divides by */
    const sel = '#ingest-editor-mount input[data-row="1"][data-col="1"]';
    const had = await B.eval('!!document.querySelector(' + JSON.stringify(sel) + ')');
    ok(had, 'the count cell the percentage divides by is typeable');
    if (had) {
      await B.typeInto(sel, '9999');
      await B.blur(sel);
      await sleep(400);
      const after = JSON.parse(await editorRow(B, DECLARED[0]) || '[]');
      log('  the declared row after the edit : ' + JSON.stringify(after.slice(1, 3)));
      ok(JSON.stringify(before.slice(1, 3)) !== JSON.stringify(after.slice(1, 3)),
        'the declared row RECOMPUTED from the count edit');
      ok(after.slice(1, 3).every(c => /^CALC:/.test(c)),
        'and stayed read-only while doing it: ' + JSON.stringify(after.slice(1, 3)));
      /* the save: the confirm count and the history */
      await B.click('#ingest-save');
      await sleep(700);
      const modal = await B.eval('(function(){var m=document.querySelector(".ingest-modal");' +
        'return m? m.textContent.replace(/[ ]+/g," ").trim() : null;})()');
      const said = (/about to save (\d+) cell change/.exec(modal || '') || [])[1];
      log('  the confirm says: ' + said + ' cell change(s)');
      ok(said === '1', 'the confirm bills ONE cell, the operator own: ' + said);
      await B.click('#ingest-modal-confirm');
      await sleep(1000);
      const hist = await B.eval('(function(){try{return JSON.parse(' +
        'localStorage.getItem("dac:history")||"[]");}catch(e){return null;}})()');
      const cells = ((hist || [])[0] || {}).changes || [];
      const labels = cells.filter(c => c.kind === 'cell')
        .map(c => String(c.rowLabel).slice(0, 34) + ' / ' + c.colLabel);
      log('  the history records: ' + JSON.stringify(labels));
      ok(labels.length === 1, 'the history records one cell: ' + labels.length);
      ok(!labels.some(l => /^Percentage/.test(l)),
        'and it is NOT the computed row: ' + JSON.stringify(labels));
    }
    log('');

    const errs = D.errors();
    log('');
    ok(errs.length === 0, 'no page errors: ' + JSON.stringify(errs));
  } finally {
    await D.close();
  }

  log('');
  log(pass + ' passed, ' + fail + ' failed');
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(0);
})().catch((e) => {
  log('THREW: ' + (e && e.stack || e));
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(2);
});
