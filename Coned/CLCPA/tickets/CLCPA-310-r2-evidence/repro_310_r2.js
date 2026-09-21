/* CLCPA-310 round 2: a near-zero percentage must not read as absent.
 * Reproduced before any code, on both surfaces.
 *
 * THE PROOF CASE, built so the ENGINE produces the figure rather than a
 * planted string. CLCPA-308 round 2 made D3's declared percentage rows
 * computed and read-only, so the honest reproduction sets the two COUNTS the
 * rule divides and lets the engine derive the share:
 *
 *     1 subscriber in a DAC out of 7,400  ->  0.000135135...  ->  0.0135%
 *
 * which is the owner's figure. A planted stored value would have been kept
 * by the kept-figure rail and proved nothing about the formatter.
 *
 * Today: "0" in the editor, because formatIngestValue hands a fraction to
 * toLocaleString, and "0.0%" on the section page, because the percentage
 * branch is toFixed(1). Both read as "none", and the true answer is that one
 * subscriber in seven thousand four hundred is in a DAC.
 *
 *   node repro_310_r2.js                        the working tree
 *   DAC_310_BUILD=before node repro_310_r2.js   the pinned base
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const live = require('../_kit/live_browser.js');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const WHICH = (process.env.DAC_310_BUILD || 'after').toLowerCase();
const BASE = process.env.DAC_BASE_COMMIT || '9dabbf6';
const OUT = path.join(__dirname, 'repro-310-r2-' + WHICH + '-output.txt');
const CRLF = String.fromCharCode(13) + String.fromCharCode(10);

const HEAD = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; log('  PASS  ' + m); } else { fail++; log('  FAIL  ' + m); } };

const TABLE = 'D3', YEAR = '2098';
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

/* the declared rows and the columns they divide, read from the source */
const RULES = (() => {
  const src = fs.readFileSync(path.join(DEV, 'app.js'), 'utf8');
  const i = src.indexOf('const DERIVED_ROWS');
  const blk = src.slice(i, src.indexOf(CRLF + '  };', i));
  const m = new RegExp('^\\s*' + TABLE + ': \\[([^\\]]*)\\]', 'm').exec(blk);
  if (!m) return [];
  return (m[1].match(/rowPct\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g) || []).map((s) => {
    const n = s.match(/\d+/g).map(Number);
    return { row: n[0], numerator: n[1], denominator: n[2] };
  });
})();

/* D3's own newest stored year, with the FIRST declared rule's two count rows
 * set so the share the engine derives is the owner's near-zero figure. The
 * shape of the table is untouched; only two numbers move, and both are counts
 * an operator types. */
const SEED = (() => {
  const d = (P.tables[TABLE] || {}).data || {};
  const y = Object.keys(d).sort().pop();
  const rows = (d[y] || []).map(r => r.slice());
  const rule = RULES[0];
  if (rule && rows[rule.denominator] && rows[rule.numerator]) {
    rows[rule.denominator][1] = 7400;
    rows[rule.numerator][1] = 1;
  }
  /* AND THE DECLARED ROWS ARE LEFT EMPTY, which is what a preparer who obeys
   * the template does. The first cut seeded the counts and left the stored
   * percentages in place, and the kept-figure rail correctly KEPT the filed
   * 0.348 -- so the panel showed 34.8% and the near-zero figure was never
   * derived. A reproduction that cannot produce the value it is about proves
   * nothing. */
  RULES.forEach((r) => {
    if (!rows[r.row]) return;
    for (let c = 1; c < rows[r.row].length; c++) rows[r.row][c] = null;
  });
  return rows;
})();

function serveDir() {
  if (WHICH !== 'before') return DEV;
  const dir = path.join(os.tmpdir(), 'clcpa310r2-base-' + BASE);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.cpSync(DEV, dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'app.js'),
    execSync('git show ' + BASE + ':"' + REL + '"', { cwd: ROOT, maxBuffer: 1e9 })
      .toString('utf8').replace(new RegExp(String.fromCharCode(92) + 'r?' +
        String.fromCharCode(92) + 'n', 'g'), CRLF));
  return dir;
}

const editorRowText = (B, r) => B.eval(
  '(function(){var tr=document.querySelectorAll(\'#ingest-editor-mount tbody tr\')[' + r + '];' +
  'if(!tr) return "[]"; var out=[];' +
  'tr.querySelectorAll("td").forEach(function(td){' +
  'var i=td.querySelector("input");' +
  'out.push(i ? i.value : td.textContent.trim());});' +
  'return JSON.stringify(out);})()');

const pageRows = (B) => B.eval(
  '(function(){var t=document.querySelector("#view-container table.data-table");' +
  'if(!t) return "[]"; var o=[];' +
  't.querySelectorAll("tbody tr").forEach(function(tr){var cs=[];' +
  'tr.querySelectorAll("td,th").forEach(function(td){cs.push(td.textContent.trim());});' +
  'o.push(cs);});return JSON.stringify(o);})()');

async function openTab(B, id) {
  const sel = '[data-table-id="' + id + '"]';
  if (!await B.eval('!!document.querySelector(' + JSON.stringify(sel) + ')')) return false;
  await B.click(sel);
  await sleep(500);
  return true;
}

(async () => {
  log('CLCPA-310 round 2: a near-zero percentage, on both surfaces');
  log('base ' + BASE + ' (PR #306 head)   tip ' + HEAD);
  log('serving: ' + (WHICH === 'before' ? 'BASE ' + BASE + ' (pinned copy)' : 'the working tree'));
  log('');
  const rule = RULES[0];
  log('the rule under test: ' + JSON.stringify(rule));
  log('  seeded so the engine derives it: row ' + (rule && rule.numerator) +
    ' = 1 out of row ' + (rule && rule.denominator) + ' = 7,400');
  log('  the true share: ' + (1 / 7400) + '  =  ' + ((1 / 7400) * 100).toFixed(4) + '%');
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
    const cells = JSON.parse(await editorRowText(B, rule.row) || '[]');
    log('  the declared row reads: ' + JSON.stringify(cells).slice(0, 160));
    const shown = String(cells[1] == null ? '' : cells[1]);
    log('  the cell under test   : ' + JSON.stringify(shown));
    ok(!/^0$|^0\.0%?$|^0%$/.test(shown),
      'the editor does not render a near-zero share as a bare zero: ' + JSON.stringify(shown));
    ok(/%/.test(shown), 'and it renders as a percentage at all: ' + JSON.stringify(shown));
    await B.screenshot(path.join(__dirname, 'repro-310-r2-' + WHICH + '-editor.png'));
    log('');

    /* ---- SURFACE 2: THE SECTION PAGE ------------------------------- */
    log('SURFACE 2  the section page, #/section/D, the ' + TABLE + ' tab');
    await B.run('location.hash = "#/section/D";');
    for (let i = 0; i < 120; i++) {
      await sleep(150);
      if (await B.eval('!!document.querySelector("#view-container table")')) break;
    }
    ok(await openTab(B, TABLE), 'the ' + TABLE + ' source tab opened');
    const rows = JSON.parse(await pageRows(B) || '[]');
    rows.forEach((r, i) => log('  row ' + i + ': ' + JSON.stringify(r).slice(0, 120)));
    const pageCell = String((rows[rule.row] || [])[1] == null ? '' : (rows[rule.row] || [])[1]);
    log('  the cell under test: ' + JSON.stringify(pageCell));
    ok(!/^0\.0%$|^0%$|^0$/.test(pageCell),
      'the page does not render it as an absent zero: ' + JSON.stringify(pageCell));
    await B.screenshot(path.join(__dirname, 'repro-310-r2-' + WHICH + '-page.png'));
    log('');

    /* ---- THE FLOAT HALF MUST NOT REGRESS --------------------------- */
    log('NON-REGRESSION  the float-formatting half of CLCPA-310 round 1');
    const clean = rows.filter(r => /^Percentage/.test(String(r[0] || '')));
    clean.forEach(r => log('  ' + JSON.stringify(r).slice(0, 130)));
    const tails = [];
    rows.forEach(r => r.forEach((c) => {
      if (/\d\.\d{6,}/.test(String(c))) tails.push(String(c));
    }));
    ok(tails.length === 0,
      'no 17-digit float tails anywhere on the panel: ' + JSON.stringify(tails.slice(0, 3)));
    /* one precision per row: every percentage cell in a row shows the same
     * number of decimals, which is what round 1 established */
    const precisions = clean.map(r => r.slice(1).filter(c => /%$/.test(String(c)))
      .map(c => (String(c).match(/\.(\d+)%$/) || [null, ''])[1].length));
    log('  decimals per percentage row: ' + JSON.stringify(precisions));
    ok(precisions.every(p => new Set(p).size <= 1),
      'one precision per row is preserved: ' + JSON.stringify(precisions));

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
