/* CLCPA-293 round 3, THE BROWSER HALF: every anatomy, before and after.
 *
 * The ruling made this a condition, and the reason is in the ticket's
 * history: two fixes were built and withdrawn, one of them after passing
 * every offline suite in the sweep. An offline harness assembles functions
 * out of app.js and can be wrong about which branch it is even running --
 * which is exactly what happened to this ticket's own census, measured
 * three times through an exception branch a production try/catch was
 * hiding. A real page importing a real file cannot make that mistake.
 *
 * Five anatomies of A8/2098, each seeded into a throwaway profile, each
 * imported into on BOTH builds:
 *
 *   1  rowless
 *   2  the grand-total row exists with no figures in it
 *   3  it holds a figure its rows do NOT come to
 *   4  it holds the figure its rows DO come to
 *   5  an ORDINARY STORED ROW with stored values, as an import-and-save of
 *      that era left it -- the hosted anatomy
 *
 * The file files the itemised rows and both totals, the grand total as
 * 777 and 222. What is read back off the page: the staged summary, the
 * draft banner, and whether the amber advisory names the filed total.
 *
 *   node repro_293_r3.js            both builds
 *   node repro_293_r3.js base       the build before this ticket alone
 *   node repro_293_r3.js fix
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
const MID_REF = process.env.DAC_MID_COMMIT || 'a331392';
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'repro-293-r3-output.txt');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* THE CANDIDATE IS NOT IN app.js. It was built under the ruling, measured,
 * and withdrawn when suite_293's own D block showed it hands A1's Total to
 * the preparer -- the CLCPA-88 defect. So "BEFORE" here is the shipped
 * build, and "AFTER" is a copy of it with the candidate patched in, served
 * out of a temp directory. Nothing in the repo carries the change.
 *
 * The patch is the one probe_293_r3_candidate.js applies, and each anchor
 * must hit exactly once or this refuses to run: a browser test that
 * silently serves the same build twice would report "no change" as a
 * result. */
const PATCH = [
  ['head',
   '  function ingestRebuildableTotals(rows, schema, tableId, totals) {\r\n' +
   '    const out = new Set();\r\n' +
   '    if (!Array.isArray(rows) || !rows.length || !schema || !schema.length) return out;\r\n' +
   '    rows.forEach((row, ri) => {',
   '  function ingestDeclaredDerives(schema, rows, tableId) {\r\n' +
   '    const cols = {};\r\n' +
   '    ((tableId && DERIVED_COLS[tableId]) || []).forEach((d) => { cols[d.column] = true; });\r\n' +
   '    try {\r\n' +
   '      (detectSumColumns(schema, rows, tableId) || []).forEach((s) => { cols[s.column] = true; });\r\n' +
   '    } catch (e) {}\r\n' +
   '    const rowSet = {};\r\n' +
   '    ((tableId && DERIVED_ROWS[tableId]) || []).forEach((d) => { rowSet[d.row] = true; });\r\n' +
   '    return (ri, c) => !!cols[c] || !!rowSet[ri];\r\n' +
   '  }\r\n\r\n' +
   '  function ingestRebuildableTotals(rows, schema, tableId, totals) {\r\n' +
   '    const out = new Set();\r\n' +
   '    if (!Array.isArray(rows) || !rows.length || !schema || !schema.length) return out;\r\n' +
   '    const declared = ingestDeclaredDerives(schema, rows, tableId);\r\n' +
   '    rows.forEach((row, ri) => {'],
  ['throw branch',
   "        for (let c = 1; c < schema.length; c++) out.add(ri + ',' + c);\r\n" +
   '        return;\r\n      }\r\n',
   '        for (let c = 1; c < schema.length; c++) {\r\n' +
   "          if (declared(ri, c)) out.add(ri + ',' + c);\r\n" +
   '        }\r\n        return;\r\n      }\r\n'],
  ['probe loop',
   '      for (let c = 1; c < schema.length; c++) {\r\n' +
   '        const back = probe[ri] ? probe[ri][c] : null;\r\n',
   '      for (let c = 1; c < schema.length; c++) {\r\n' +
   '        if (!declared(ri, c)) continue;\r\n' +
   '        const back = probe[ri] ? probe[ri][c] : null;\r\n'],
];
function candDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dac-cand-'));
  ['ExecutiveDashboard.html', 'index.html', 'styles.css',
   'payload.json', 'map_payload.json'].forEach((f) => {
    try { fs.copyFileSync(path.join(DEV, f), path.join(d, f)); }
    catch (e) { /* a file this build does not have */ }
  });
  let s = fs.readFileSync(path.join(DEV, 'app.js'), 'utf8');
  PATCH.forEach(([what, from, to]) => {
    const n = s.split(from).length - 1;
    if (n !== 1) {
      throw new Error('repro_293_r3: the ' + what + ' anchor matched ' + n +
        ' times, expected 1. Refusing to serve a build it cannot vouch for.');
    }
    s = s.replace(from, () => to);
  });
  fs.writeFileSync(path.join(d, 'app.js'), s);
  return d;
}

const ID = 'A8';
const YEAR = '2098';
const SRC_ROWS = P.tables[ID].data['2025'];
const SCHEMA = (P.tables[ID].schema_by_year || {})['2025'] || P.tables[ID].schema;
const SUBTOTAL = 24, GRAND = 25;
const F_TOTAL = 777, F_DAC = 222;

/* WHAT THE ITEMISED ROWS COME TO, TAKEN FROM THE ENGINE AND NOT RETYPED.
 *
 * Anatomies 4 and 5 only mean anything if the row holds the figure the
 * engine really does reproduce, and the first cut of this script summed a
 * hand-written list of row indices instead. The list included the segment
 * subtotals, so it double-counted, the anatomy held a number the engine
 * does not produce, and all five anatomies behaved alike on both builds --
 * a browser test that discriminated nothing while looking like a result.
 * This is the "values retyped in the harness are not evidence" defect, in
 * the one place I had told myself a browser could not have it.
 *
 * recomputeTotals is asked instead, on the rows with both total rows
 * blanked, exactly as suite_293_r3 builds the same anatomies. */
const ENGINE = (function () {
  const SRC = fs.readFileSync(path.join(DEV, 'app.js'), 'utf8');
  const L = SRC.split('\r\n');
  const TOP = [];
  L.forEach((ln, n) => {
    const m = /^ {2}(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (nm) => {
    const k = TOP.findIndex(d => d.name === nm);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n');
  };
  const want = ['recomputeTotals', 'getTableSchema'];
  const parts = [], have = new Set();
  const add = (n) => {
    if (have.has(n)) return false;
    const f = find(n);
    if (!f) return false;
    have.add(n); parts.push(f); return true;
  };
  want.forEach(add);
  for (let r = 0; r < 400; r++) {
    try {
      const api = new Function('PAYLOAD', 'const state = { payload: PAYLOAD };\n' +
        parts.join('\n\n') + '\n;return {' +
        want.filter(n => have.has(n)).join(',') + '};')(P);
      const rows = SRC_ROWS.map(x => x.slice());
      [SUBTOTAL, GRAND].forEach((ri) => {
        for (let c = 1; c < SCHEMA.length; c++) rows[ri][c] = null;
      });
      api.recomputeTotals(rows, SCHEMA, ID, SRC_ROWS.map(x => x.slice()));
      return { s1: rows[SUBTOTAL][1], s2: rows[SUBTOTAL][2] };
    } catch (e) {
      const m = /(\w+) is not defined/.exec(String(e && e.message));
      if (m && add(m[1])) continue;
      throw e;
    }
  }
  throw new Error('could not assemble recomputeTotals');
})();
const SUM1 = ENGINE.s1, SUM2 = ENGINE.s2;

const base = () => SRC_ROWS.map(r => r.slice());
const ANATOMIES = [
  ['1 rowless', null],
  ['2 the row exists with no figures in it', (() => {
    const d = base(); for (let c = 1; c < SCHEMA.length; c++) d[GRAND][c] = null; return d;
  })()],
  ['3 it holds a figure its rows do NOT come to', (() => {
    const d = base(); d[GRAND][1] = 999999; d[GRAND][2] = 888888; return d;
  })()],
  ['4 it holds the figure its rows DO come to', (() => {
    const d = base(); d[GRAND][1] = SUM1; d[GRAND][2] = SUM2; return d;
  })()],
  ['5 an ordinary stored row, as an import-and-save left it', (() => {
    /* the era's importer wrote the preparer's filed totals straight into
     * ordinary rows, and that file's figures reconciled with its own rows */
    const d = base();
    d[SUBTOTAL] = [SRC_ROWS[SUBTOTAL][0], SUM1, SUM2, null];
    d[GRAND] = [SRC_ROWS[GRAND][0], SUM1, SUM2, null];
    return d;
  })()],
];

/* the file a preparer files: every itemised figure, and both totals */
function csvFor(rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const out = [SCHEMA.map(esc).join(',')];
  let staged = 0;
  (rows || SRC_ROWS).forEach((r, i) => {
    const heading = String(SRC_ROWS[i][1]) === '' && String(SRC_ROWS[i][2]) === '';
    if (heading) { out.push([esc(r[0]), '', '', ''].join(',')); return; }
    const a = i === GRAND ? F_TOTAL
      : (typeof SRC_ROWS[i][1] === 'number' ? SRC_ROWS[i][1] + 7 : 0);
    const b = i === GRAND ? F_DAC
      : (typeof SRC_ROWS[i][2] === 'number' ? SRC_ROWS[i][2] + 3 : 0);
    staged += 2;
    out.push([esc(r[0]), a, b, ''].join(','));
  });
  return { csv: out.join('\n'), staged };
}

const textOf = async (B, sel) => {
  const t = await B.eval('(function(){var e=document.querySelector(' +
    JSON.stringify(sel) + ');return e?e.textContent:"";})()');
  return String(t || '').split(/\s+/).join(' ').trim();
};
const allText = async (B, sel) => {
  const t = await B.eval('(function(){var o=[];document.querySelectorAll(' +
    JSON.stringify(sel) + ').forEach(function(e){o.push(e.textContent.replace(/\\s+/g," ").trim());});' +
    'return JSON.stringify(o);})()');
  try { return JSON.parse(t || '[]'); } catch (e) { return []; }
};

async function runOne(D, label, rows) {
  const B = D.B;
  const { csv, staged } = csvFor(rows);
  /* seed the anatomy into this profile, then reload so the app reads it */
  const seed = '(function(){' +
    'var o={};try{o=JSON.parse(localStorage.getItem("dac:overrides")||"{}");}catch(e){}' +
    (rows ? 'o[' + JSON.stringify(ID + ':' + YEAR) + ']=' + JSON.stringify(rows) + ';'
          : 'delete o[' + JSON.stringify(ID + ':' + YEAR) + '];') +
    'localStorage.setItem("dac:overrides",JSON.stringify(o));' +
    'var y=[];try{y=JSON.parse(localStorage.getItem("dac:years")||"[]");}catch(e){}' +
    'if(y.indexOf("' + YEAR + '")<0)y.push("' + YEAR + '");' +
    'localStorage.setItem("dac:years",JSON.stringify(y));return "seeded";})()';
  await B.run(seed);
  /* reload so the app re-reads storage: the anatomy has to be in place
   * before boot, not swapped under a rendered page */
  await B.goto(D.base + 'ExecutiveDashboard.html', '#view-container');
  await sleep(900);
  await D.gotoIngest();
  await D.pick('A', ID, YEAR);
  await sleep(600);
  /* THE IMPORT LIVES BEHIND "Add Data", not beside the grid. There is no
   * file input on the page until that dialog is open, which is why the
   * first cut of this script set .files on null five times in a row. The
   * dialog takes the target year, so naming 2098 imports into the year
   * this profile was just seeded with rather than creating a new one. */
  await B.click('#ingest-addyear');
  await sleep(700);
  await B.run('var y=document.getElementById("dlg-newyear");' +
    'if(y){y.value="' + YEAR + '";y.dispatchEvent(new Event("input",{bubbles:true}));' +
    'y.dispatchEvent(new Event("change",{bubbles:true}));}' +
    'var s=document.getElementById("dlg-section");' +
    'if(s){s.value="A";s.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(450);
  await B.run('var t=document.getElementById("dlg-table");' +
    'if(t){t.value="' + ID + '";t.dispatchEvent(new Event("change",{bubbles:true}));}');
  await sleep(450);
  const hasInput = await B.eval('!!document.getElementById("ingest-file")');
  if (!hasInput) { log('    ' + label + '  NO FILE INPUT: the dialog did not open'); return null; }
  await B.run('var dt=new DataTransfer();dt.items.add(new File([' + JSON.stringify(csv) +
    '],"' + ID + '_' + YEAR + '.csv",{type:"text/csv"}));' +
    'var el=document.getElementById("ingest-file");el.files=dt.files;' +
    'el.dispatchEvent(new Event("change",{bubbles:true}));');
  await sleep(1400);

  const stagedTxt = await textOf(B, '.ingest-staged');

  /* AND THEN ACTUALLY IMPORT IT. The staged summary is the file being read,
   * not the file landing; the first cut of this script stopped here and
   * reported the same sentence for all five anatomies, which is exactly
   * what it should say before an import has happened. The dialog's confirm
   * is "Load Data" and carries no id, so it is found by its label. */
  await B.run('(function(){var b=null;document.querySelectorAll("button").forEach(' +
    'function(e){if(e.textContent.trim()==="Load Data")b=e;});if(b)b.click();})()');
  await sleep(1400);

  const banner = await textOf(B, '.ingest-import-summary, .ingest-import');
  const notices = await allText(B,
    '.ingest-import-notice');
  const grid = await B.eval('(function(){var o=[];' +
    'document.querySelectorAll("#ingest-editor-mount tr").forEach(function(tr){' +
    'var cs=[];tr.querySelectorAll("td,th").forEach(function(td){' +
    'cs.push(td.querySelector("input")?("["+td.querySelector("input").value+"]"):' +
    'td.textContent.trim());});o.push(cs);});return JSON.stringify(o);})()');
  let rowsOut = [];
  try { rowsOut = JSON.parse(grid || '[]'); } catch (e) { rowsOut = []; }
  const grandRow = rowsOut.filter(r => /Total CES Programs/.test(String(r[0] || '')));
  const advisory = notices.filter(n => /total/i.test(n)).slice(0, 2);

  log('    ' + label);
  log('        the file stages          : ' + staged + ' values');
  log('        the page\'s staged summary: ' + (stagedTxt || '(none)').slice(0, 130));
  log('        the draft banner         : ' + (banner || '(none)').slice(0, 130));
  grandRow.forEach(r => log('        the grand-total row now  : ' +
    JSON.stringify(r.slice(0, 4))));
  if (!grandRow.length) log('        the grand-total row now  : (not in the grid)');
  if (advisory.length) advisory.forEach(a => log('        advisory: ' + a.slice(0, 200)));
  else log('        advisory: (none naming a total)');
  return { staged, stagedTxt, banner, grandRow };
}

async function runBuild(tag, dir) {
  log('');
  log('=======================================================================');
  log(' ' + tag + '   ' + dir);
  log('=======================================================================');
  const D = await open({ dir: dir });
  try {
    for (const [label, rows] of ANATOMIES) {
      try { await runOne(D, label, rows); }
      catch (e) { log('    ' + label + '  THREW: ' + (e && e.message)); }
      log('');
    }
    log('  page errors: ' + JSON.stringify(D.errors()));
  } finally { await D.close(); }
}

(async () => {
  const which = (process.argv[2] || 'both').toLowerCase();
  log('CLCPA-293 round 3: every anatomy, in a real browser, before and after');
  log('before = the shipped build; after = the candidate, which is NOT in app.js');
  log('A8/' + YEAR + ', filed grand total ' + F_TOTAL + ' / ' + F_DAC +
      ', itemised rows come to ' + SUM1 + ' / ' + SUM2);
  log('(2098 is this probe\'s own year on a throwaway profile; the live org is');
  log(' not touched and 2096 is not gone near.)');
  if (which === 'both' || which === 'base') await runBuild('BEFORE (the shipped build)', DEV);
  if (which === 'both' || which === 'fix') await runBuild('AFTER (the candidate, NOT in app.js)', candDir());
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
})().catch((e) => {
  log('REPRO THREW: ' + (e && e.stack));
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(1);
});
