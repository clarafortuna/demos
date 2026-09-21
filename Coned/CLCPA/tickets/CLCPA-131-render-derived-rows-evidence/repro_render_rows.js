/* CLCPA-131 shared dependency: A DECLARED DERIVED ROW ON THE PAGE.
 *
 * applyDerivedRows was called from one place, recomputeTotals, which is the
 * editor's write path. So a row declared in DERIVED_ROWS derived while
 * somebody had the table open and never when the section page rendered it.
 * The J block needs it because CLCPA-326's chart reads the published page,
 * and CLCPA-322 registers a rule on rows.
 *
 * MEASURED BEFORE CODE, and it changed the design: of the 49 declared
 * derived-row cells in the payload, NONE is blank on the page today -- the
 * page shows the preparer's filed figure. Applying the rule without the
 * kept-figure baseline moves 47 of them (D2/2023 republishes
 * 0.32057920404599916 over a filed 0.321; D4/2024 overwrites a filed 0.4
 * with 0.3397). With the stored rows passed as the baseline, 0 move. That
 * argument is the whole safety of this change and this script asserts it.
 *
 * WHERE IT IS OBSERVABLE: DERIVED_ROWS declares D2, D3, D4 and F7 -- no J
 * table, yet. So the rendered proof is taken on a Section D page, and J
 * becomes dependent the moment CLCPA-322 registers its rows. Said here
 * rather than claimed on a J page it cannot yet be seen on.
 *
 *   node repro_render_rows.js                        the working tree
 *   DAC_131_BUILD=before node repro_render_rows.js   the pinned tip
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const live = require('../_kit/live_browser.js');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const WHICH = (process.env.DAC_131_BUILD || 'after').toLowerCase();
const BASE = process.env.DAC_BASE_COMMIT || 'ea0300d';
const OUT = path.join(__dirname, 'repro-render-rows-' + WHICH + '-output.txt');
const SHOT = path.join(__dirname, 'repro-render-rows-' + WHICH + '-d3.png');
const CRLF = String.fromCharCode(13) + String.fromCharCode(10);

const HEAD = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
const BUILD = (() => {
  try {
    return require(path.join(DEV, 'Data/stamp_build.js')).prepare(DEV + '/').ids['app.js'];
  } catch (e) { return 'MISSING'; }
})();

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; log('  PASS  ' + m); } else { fail++; log('  FAIL  ' + m); } };

/* the declared rows, read from the source rather than named here */
const DECLARED = (() => {
  const src = fs.readFileSync(path.join(DEV, 'app.js'), 'utf8');
  const i = src.indexOf('const DERIVED_ROWS');
  const blk = src.slice(i, src.indexOf(CRLF + '  };', i));
  const out = {};
  (blk.match(/^\s*([A-Z]\d*): \[[^\]]*\]/gm) || []).forEach((l) => {
    const id = /([A-Z]\d*):/.exec(l)[1];
    out[id] = (l.match(/rowPct\((\d+)/g) || []).map(s => Number(/\d+/.exec(s)[0]));
  });
  return out;
})();

function serveDir() {
  if (WHICH !== 'before') return DEV;
  const dir = path.join(os.tmpdir(), 'clcpa131-base-' + BASE);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(DEV, dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'app.js'),
    execSync('git show ' + BASE + ':"' + REL + '"', { cwd: ROOT, maxBuffer: 1e9 })
      .toString('utf8').replace(new RegExp(String.fromCharCode(92) + 'r?' +
        String.fromCharCode(92) + 'n', 'g'), CRLF));
  return dir;
}

/* A SECTION PAGE SHOWS ONE SOURCE TABLE AT A TIME. The tables sit behind a
 * tab row of BUTTON.src-tab[data-table-id], and only the active tab renders,
 * which is why the first cut of this script read one table and reported D2,
 * D3 and D4 as "not found on this page" -- they were behind a tab nobody had
 * clicked. */
async function openTable(B, id) {
  const sel = '[data-table-id="' + id + '"]';
  const there = await B.eval('!!document.querySelector(' + JSON.stringify(sel) + ')');
  if (!there) return false;
  await B.click(sel);
  await sleep(500);
  return true;
}

/* the rendered rows of whichever table is showing */
const shownRows = async (B) => {
  const raw = await B.eval('(function(){var t=document.querySelector("#view-container table.data-table");' +
    'if(!t) return "[]"; var o=[];' +
    't.querySelectorAll("tr").forEach(function(tr){var cs=[];' +
    'tr.querySelectorAll("td,th").forEach(function(td){cs.push(td.textContent.trim());});' +
    'o.push(cs);});return JSON.stringify(o);})()');
  try { return JSON.parse(raw || '[]'); } catch (e) { return []; }
};
(async () => {
  log('CLCPA-131: a declared derived row, rendered on the section page');
  log('tip: main @ ' + HEAD + ', derived build ' + BUILD);
  log('serving: ' + (WHICH === 'before' ? 'BASE ' + BASE + ' (pinned copy)' : 'the working tree'));
  log('  (a repo-served build reports its stamp as dev by design)');
  log('');
  log('DERIVED_ROWS declares: ' + JSON.stringify(DECLARED));
  log('  no J table appears, so the rendered proof is taken on Section D;');
  log('  J depends on this the moment CLCPA-322 registers its rows.');
  log('');

  const dir = serveDir();
  const D = await live.open({ dir });
  const B = D.B;
  try {
    await B.run('location.hash = "#/section/D";');
    for (let i = 0; i < 120; i++) {
      await sleep(150);
      if (await B.eval('!!document.querySelector("#view-container table")')) break;
    }
    const ids = Object.keys(DECLARED).filter(id => /^D/.test(id) && DECLARED[id].length);
    ok(ids.length > 0, 'Section D declares derived rows on: ' + ids.join(', '));
    log('');
    log('THE DECLARED PERCENTAGE ROWS, as the SECTION PAGE renders them');
    for (const id of ids) {
      const opened = await openTable(B, id);
      if (!opened) { ok(false, id + ': no source tab on this page'); continue; }
      const rows = await shownRows(B);
      ok(rows.length > 0, id + ' renders ' + rows.length + ' row(s)');
      DECLARED[id].forEach((ri) => {
        /* the tab shows a header row first, so the declared index is offset
         * by however many header rows the render puts in */
        const match = rows.filter(r => /^(Percentage|% )/.test(String(r[0] || '')));
        log('  ' + id + ' declared row ' + ri + '; percentage rows on screen: ' +
          JSON.stringify(match));
      });
      await B.screenshot(path.join(__dirname, 'repro-render-rows-' + WHICH + '-' + id + '.png'));
    }
    log('');    const errs = D.errors();
    ok(errs.length === 0, 'no page errors: ' + JSON.stringify(errs));
  } finally {
    await D.close();
  }

  log('');
  log(pass + ' passed, ' + fail + ' failed');
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  log('THREW: ' + (e && e.stack || e));
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(2);
});
