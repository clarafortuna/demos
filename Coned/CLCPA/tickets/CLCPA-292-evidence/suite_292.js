/* CLCPA-292: the template pre-fills EVERY key column, not just the first.
 *
 * A3 and A4 declare TWO key columns -- Participant Type and Program Name --
 * and emitted column B blank in 22 of 23 rows while column A repeated the
 * participant type. A preparer had no way to know which programme belonged on
 * which line, so matching could only be positional, which is the thing
 * row-key matching exists to avoid.
 *
 * TWO HALVES, AND ONE WAS ALREADY CLOSED. CLCPA-274 option (c) landed first in
 * this stack: a year that HOLDS data exports every column, Program Name
 * included. So the populated half closed on its own, and what remains is the
 * FRESH-year half, where labels are borrowed and no value is exported.
 *
 *   A3/2094 before : ["Residential","","","",""]
 *   A3/2094 after  : ["Residential","Clean Heat - Midstream Heat Pump ...","","",""]
 *
 * The count comes from ingestKeyColCount, the SAME declaration the importer
 * matches rows on. One declaration, both directions -- which is the property
 * that was missing.
 *
 * BASE predates the change: e8942b6.
 *
 * Run:  node suite_292.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { boot } = require('../_kit/live_editor.js');
const { templateRows, dense, worksheets } = require('../_kit/xlsx_read.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || 'e8942b6';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);
const SRC = fs.readFileSync(APP, 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => { try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); } };
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p);

/** a FRESH year: present in meta.years, holding nothing */
const freshPay = () => {
  const p = JSON.parse(JSON.stringify(P));
  p.meta.years = ['2094'].concat(p.meta.years);
  return p;
};
const tmplFresh = (id, src) => templateRows(
  boot({ payload: freshPay(), tableId: id, year: '2094', src: src })
    .api.buildIngestWorkbook(id, '2094')).map(dense);
const tmplYear = (id, y, src) => templateRows(
  boot({ payload: P, tableId: id, year: y, src: src })
    .api.buildIngestWorkbook(id, y)).map(dense);
const totalRow = (rows) => rows.find(r => /^total$/i.test(String(r[0] || '').trim()));

log('======================================================================');
log('CLCPA-292 -- every key column is pre-filled');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the defect, on the build that shipped it ----------------------- */
log('');
log('A. THE DEFECT, ON BASE');
guard('A-block', () => {
  ['A3', 'A4'].forEach((id) => {
    const r = tmplFresh(id, BASE_SRC);
    const filled = r.slice(1).filter(x => x[1] && String(x[1]).trim() !== '' &&
      String(x[1]).trim() !== '(no value)').length;
    ok(filled === 0,
      'A1.' + id + ' a fresh year emitted NO Program Name at all -- ' + filled +
      ' of ' + (r.length - 1) + ' rows');
    ok(r[1] && r[1][0] === 'Residential',
      'A2.' + id + ' while column A repeated the participant type -- ' +
      JSON.stringify(r[1]).slice(0, 44));
  });
});

/* ---- B. the fix --------------------------------------------------------- */
log('');
log('B. THE KEY IS WRITTEN');
guard('B-block', () => {
  ['A3', 'A4'].forEach((id) => {
    const r = tmplFresh(id, SRC);
    const body = r.slice(1);
    const filled = body.filter(x => x[1] && String(x[1]).trim() !== '' &&
      String(x[1]).trim() !== '(no value)').length;
    ok(filled === body.length - 1,
      'B1.' + id + ' every data row carries its Program Name -- ' + filled +
      ' of ' + (body.length - 1) + ' data rows');
    ok(r[1][1] && /Clean Heat/.test(String(r[1][1])),
      'B2.' + id + ' and it is the real key -- ' + JSON.stringify(r[1][1]).slice(0, 44));
    /* the VALUES stay blank: this is a fresh year, and (c) says blank form */
    ok(r[1].slice(2).every(v => v === '' || v === null),
      'B3.' + id + ' while the value columns stay blank, per option (c)');
    /* the total row keeps CLCPA-291's marker rather than an empty label */
    const t = totalRow(r);
    ok(t && String(t[1]).trim() === '(no value)',
      'B4.' + id + ' and the Total row keeps (no value), not a blank label -- ' +
      JSON.stringify(t));
  });
});

/* ---- C. one declaration, both directions -------------------------------- */
log('');
log('C. THE SAME COUNT THE IMPORTER MATCHES ON');
guard('C-block', () => {
  const code = codeOnly(SRC);
  ok(/const keyCols = Math\.max\(1, Math\.min\(ingestKeyColCount\(tableId\), schema\.length\)\);[\s\S]{0,400}const code = tableId\.replace/.test(code),
    'C1 the writer takes its key count from ingestKeyColCount');
  ok((code.match(/const keyCols = Math\.max\(1, Math\.min\(ingestKeyColCount\(tableId\), schema\.length\)\);/g) || []).length === 2,
    'C2 clamped EXACTLY as the importer clamps it, in both places');
  ok(/if \(c < keyCols\) \{/.test(code),
    'C3 and every key column takes the label branch');
  const H = boot({ payload: P, tableId: 'A3', year: '2025', src: SRC });
  ok(H.api.ingestKeyColCount('A3') === 2, 'C4 A3 declares two key columns');
  ok(H.api.ingestKeyColCount('H1') === 1, 'C5 H1 declares one');
});

/* ---- D. what must not change ------------------------------------------- */
log('');
log('D. EVERY OTHER TABLE');
guard('D-block', () => {
  let changed = [];
  Object.keys(P.tables).sort().forEach((id) => {
    const ys = Object.keys(P.tables[id].data || {});
    if (!ys.length) return;
    let a, b;
    try { a = JSON.stringify(tmplFresh(id, BASE_SRC)); b = JSON.stringify(tmplFresh(id, SRC)); }
    catch (e) { return; }
    if (a !== b) changed.push(id);
  });
  /* RE-PINNED: CLCPA-289 marks A9's "% Change" pair (calculated) on a fresh
   * year, because CLCPA-241 gave it a rule and the app now genuinely computes
   * it. A9 is named rather than the count relaxed. */
  /* RE-PINNED again: CLCPA-308 marks the derived ROWS of D2, D3, D4 and F7,
   * so the fresh-year set grows by four. Every mover is named; an unnamed one
   * still fails this. */
  /* RE-PINNED again: CLCPA-320 marks a total row by its ROLE rather than by
   * arithmetic confirmation, and J8's "Total" does not sum its own rows --
   * 192,638,756 filed against 192,401,325 from the two rows above it -- so
   * it was the one total row the confirmation refused. NAMED, not counted:
   * a ninth table moving still fails this. */
  ok(JSON.stringify(changed.slice().sort()) ===
     JSON.stringify(['A3', 'A4', 'A9', 'D2', 'D3', 'D4', 'F7']),
    'D1 A3 and A4 for this ticket, A9 for CLCPA-289, D2/D3/D4/F7 for ' +
    'CLCPA-308. J8 was here until the pre-merge amendment to CLCPA-320 ' +
    'withheld its marker: its Total is not derivable from its own rows -- ' +
    JSON.stringify(changed));
  /* a one-key table is untouched, which is what keeps this narrow */
  const h = tmplFresh('H1', SRC);
  ok(h[1][0] === 'Manhattan' && h[1][1] === '',
    'D2 H1 declares one key column and is unchanged -- ' + JSON.stringify(h[1]));
  /* and the POPULATED year was already handled by option (c) */
  const pop = tmplYear('A3', '2025', BASE_SRC);
  ok(pop[1][1] && /Clean Heat/.test(String(pop[1][1])),
    'D3 the populated year already carried the key on BASE: option (c) closed that half');
});

/* ---- E. the bytes the operator receives -------------------------------- */
log('');
log('E. THE ENCODING OF THE KEYS NOW BEING WRITTEN');
guard('E-block', () => {
  /* THESE LABELS CARRY AN EN DASH. CLCPA-235 is the ticket about a
   * mis-decoded file creating duplicate rows, so a template that emits a
   * programme name wrongly encoded would feed exactly that. Checked on the
   * real bytes: the xlsx_read kit reads latin1 by design, which is why the
   * label LOOKS like mojibake through it and is not. */
  const wb = boot({ payload: freshPay(), tableId: 'A3', year: '2094', src: SRC })
    .api.buildIngestWorkbook('A3', '2094');
  const buf = Buffer.from(wb.bytes);
  const latin = buf.toString('latin1');
  let bad = 0, sawDash = false;
  worksheets(wb.bytes).forEach((sheetLatin) => {
    const start = latin.indexOf(sheetLatin);
    const xml = buf.slice(start, start + Buffer.byteLength(sheetLatin, 'latin1')).toString('utf8');
    bad += (xml.match(/\uFFFD/g) || []).length;
    if (xml.indexOf('\u2013') >= 0) sawDash = true;
  });
  ok(bad === 0, 'E1 no U+FFFD in any worksheet -- ' + bad);
  ok(sawDash === true, 'E2 and the en dash in the programme names survived as itself');
});

/* ---- X. the harness ------------------------------------------------------ */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(codeOnly(self)),
    'X1 BASE is a literal sha that predates the change');
  ok(/Object\.keys\(P\.tables\)\.sort\(\)\.forEach/.test(self),
    'X2 the blast radius is measured across every table');
  /* E reads the REAL bytes rather than the kit's latin1 view: the kit's view
   * shows a correct en dash as mojibake, and trusting it would have reported
   * an encoding defect that does not exist. */
  ok(/toString\('utf8'\)/.test(self) && /toString\('latin1'\)/.test(self),
    'X3 the encoding check reads the real bytes, not the kit\'s latin1 view');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-292-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
