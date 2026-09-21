/* CLCPA-293 / A-10: A8's grand-total row discarded preparer-entered values.
 *
 * THE DEFECT, reproduced on the import path before any code. The audit filed
 * 777 / 222 into A8's grand-total row exactly as the template invites, and the
 * import plan came back with populated: 0. The values were dropped at the PLAN
 * stage into notTouched.computed with the reason "this row is a calculated
 * total", and the renderer drops notTouched on a success, so nothing was said.
 *
 * WHAT MAKES IT INDEFENSIBLE. totalRowFlags does NOT flag A8's
 * "Total CES Programs Installations" on the stored rows, so the engine never
 * computes it: blank it and recompute and nothing comes back. Nothing computes
 * the cell and nothing may fill it. Its filed figure of 336,599 exceeds the
 * 283,852 its own itemised rows come to, because not all of its components
 * appear in the table, which is precisely why the engine cannot derive it.
 *
 * And the classification is not even stable: it reads the VALUES, so supplying
 * a figure is part of what makes the row look computed, which is then the
 * reason for refusing the figure. Measured: the probe run on the candidate
 * "rebuilds" 777, the file's own number.
 *
 * B7 GOVERNS. A total the engine cannot fully derive belongs to the preparer:
 * accept, reconcile, advise, never silently overwrite. The question is asked
 * the way stripDerivedForPersist asks it for columns -- blank the row,
 * recompute, see what comes back -- of the DRAFT, never of the candidate.
 *
 * NOTHING STORED AND NO KEYS ARE CONSULTED, which is why this did not stop.
 *
 * Pins: DAC_BASE_COMMIT, DAC_APP_OVERRIDE.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const KIT = path.join(ROOT, 'Coned/CLCPA/tickets/_kit');
const { boot } = require(path.join(KIT, 'live_editor.js'));
const { templateRows, dense } = require(path.join(KIT, 'xlsx_read.js'));

const BASE = process.env.DAC_BASE_COMMIT || '72f31e9';
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => { try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); } };
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

const Y = '2025', FRESH = '2094';
const SCHEMA = P.tables.A8.schema_by_year[Y];
const STORED = () => P.tables.A8.data[Y].map(r => r.slice());
const GRAND = 'Total CES Programs Installations';
const SUB = 'Residential Programs Installations Total';

/* the template a preparer receives for a FRESH year, which is the ticket's
 * scenario: on a populated year CLCPA-274 option (c) exports the figures. */
function freshTemplate(src) {
  const pay = JSON.parse(JSON.stringify(P));
  pay.meta.years = [FRESH].concat(P.meta.years.map(String));
  const b = boot({ payload: pay, tableId: 'A8', year: FRESH, src: src });
  b.state().seedYears = P.meta.years.map(String);
  return { rows: templateRows(b.api.buildIngestWorkbook('A8', FRESH)).map(dense), api: b.api };
}
/* fill the grand-total row and import, against a draft holding the structure */
function importFilled(src) {
  const t = freshTemplate(src);
  const gi = t.rows.findIndex(r => String(r[0]).indexOf('Total CES Programs') >= 0);
  const filled = t.rows.map(r => r.slice());
  if (gi >= 0) { filled[gi][1] = 777; filled[gi][2] = 222; }
  const draft = P.tables.A8.data[Y].map(r => [r[0], null, null, null]);
  return { plan: t.api.buildIngestImport(filled, SCHEMA, draft, 'A8'), gi: gi, tmpl: t.rows };
}

log('='.repeat(70));
log('CLCPA-293 / A-10 -- the grand total belongs to the preparer');
log('  BASE : ' + BASE + ' (predates this change)');
log('='.repeat(70));

log('');
log('A. THE DEFECT, ON THE BUILD THAT SHIPPED IT');
guard('A-block', () => {
  const { plan, gi, tmpl } = importFilled(BASE_SRC);
  ok(gi >= 0 && String(tmpl[gi][1]).trim() === '',
    'A1 the template offers the grand-total cells BLANK and fillable');
  ok((plan.populated || []).length === 0,
    'A2 BASE: filling 777 and 222 into them imports NOTHING -- populated ' +
    (plan.populated || []).length);
  const why = (plan.notTouched.computed || [])
    .filter(c => c.label === GRAND && /calculated total/.test(c.why));
  ok(why.length === 2, 'A3 both were dropped as "this row is a calculated total"');
  ok(!/preparerTotals/.test(codeOnly(BASE_SRC)),
    'A4 and nothing on BASE recorded, let alone reported, that it had happened');
});

log('');
log('B. THE ENGINE NEVER COMPUTED IT, WHICH IS WHY REFUSING WAS WRONG');
guard('B-block', () => {
  const b = boot({ payload: P, tableId: 'A8', year: Y, src: SRC });
  const flags = b.api.totalRowFlags(STORED(), 'A8', SCHEMA);
  const gi = P.tables.A8.data[Y].findIndex(r => r[0] === GRAND);
  const si = P.tables.A8.data[Y].findIndex(r => r[0] === SUB);
  ok(gi > 0 && !flags[gi], 'B1 totalRowFlags does not flag the grand total at all');
  ok(si > 0 && !!flags[si], 'B2 while it does flag the subtotal above it');
  /* and the arithmetic says the same thing, computed here, not by the engine */
  const grand = P.tables.A8.data[Y][gi][1], sub = P.tables.A8.data[Y][si][1];
  ok(grand > sub, 'B3 the grand total (' + grand + ') exceeds what the rows itemise (' +
    sub + '), by ' + (grand - sub));
  /* blank the row and recompute: nothing comes back */
  const probe = STORED();
  for (let c = 1; c < SCHEMA.length; c++) probe[gi][c] = null;
  b.api.recomputeTotals(probe, SCHEMA, 'A8', STORED());
  ok(probe[gi][1] == null,
    'B4 blanked and recomputed, the engine returns nothing for it -- ' +
    JSON.stringify(probe[gi][1]));
  const probe2 = STORED();
  for (let c = 1; c < SCHEMA.length; c++) probe2[si][c] = null;
  b.api.recomputeTotals(probe2, SCHEMA, 'A8', STORED());
  ok(probe2[si][1] === sub,
    'B5 while the subtotal comes back at ' + JSON.stringify(probe2[si][1]) + ', rebuilt');
});

log('');
log('C. THE FIX: THE PREPARER\'S FIGURES ARE TAKEN');
guard('C-block', () => {
  const { plan } = importFilled(SRC);
  const vals = (plan.populated || []).filter(p => p.label === GRAND).map(p => p.value);
  ok(vals.length === 2, 'C1 both cells import -- ' + JSON.stringify(vals));
  ok(vals.indexOf(777) >= 0 && vals.indexOf(222) >= 0,
    'C2 as the figures the preparer filed, unchanged');
  const named = (plan.preparerTotals || []).filter(p => p.label === GRAND);
  ok(named.length === 2, 'C3 and both are RECORDED as taken from the preparer');
  ok(named.every(p => typeof p.value === 'number'),
    'C4 carrying the value that was written, not a re-parse of the file');
});

log('');
log('D. A TOTAL THE ENGINE CAN REBUILD IS STILL REFUSED');
guard('D-block', () => {
  /* A1's "Total" IS the sum of its own rows. Accepting a file's value there
   * would be the CLCPA-88 defect coming back, so it must still be refused. */
  const b = boot({ payload: P, tableId: 'A1', year: Y, src: SRC });
  const sch = P.tables.A1.schema_by_year[Y];
  const rows = P.tables.A1.data[Y];
  const file = [sch.slice()];
  rows.forEach(r => file.push([r[0], r[1], r[2], null]));
  const ti = file.findIndex((r, i) => i > 0 && String(r[0]).trim().toLowerCase() === 'total');
  file[ti][1] = 111111; file[ti][2] = 222222;
  const plan = b.api.buildIngestImport(file, sch, rows.map(r => r.slice()), 'A1');
  ok((plan.preparerTotals || []).filter(p => /^total$/i.test(p.label)).length === 0,
    'D1 A1s Total is NOT taken from the preparer');
  ok((plan.notTouched.computed || []).some(
      c => /^total$/i.test(c.label) && /calculated total/.test(c.why)),
    'D2 it is still refused as a calculated total');
  const row = (plan.candidate || []).filter(r => /^total$/i.test(String(r[0]).trim()))[0];
  ok(row && row[1] === rows[rows.length - 1][1],
    'D3 and the row keeps its own figure -- ' + JSON.stringify(row && row[1]));
  /* a derived COLUMN is never handed over either */
  const { plan: a8 } = importFilled(SRC);
  ok((a8.notTouched.computed || []).some(
      c => c.label === GRAND && /column is calculated/.test(c.why)),
    'D4 and the grand rows own % in DACs stays computed: only the total-row half moved');
});

log('');
log('E. THE ADVISORY SAYS SO');
guard('E-block', () => {
  /* built and CALLED from the shipped source: boot does not expose the
   * renderers, and asserting the HTML means running the real one. */
  const grab = (name, src) => {
    const a = '\r\n  function ' + name + '(';
    const i = src.indexOf(a);
    if (i < 0) throw new Error('no ' + name);
    let j = src.indexOf('{', i), d = 0;
    for (let k = j; k < src.length; k++) {
      if (src[k] === '{') d++;
      else if (src[k] === '}') { d--; if (!d) { j = k; break; } }
    }
    return src.slice(i + 2, j + 1);
  };
  const render = new Function('escapeHtml',
    grab('renderPreparerTotalsNotice', SRC) + '\nreturn renderPreparerTotalsNotice;'
  )(s => String(s));
  const html = render([
    { label: GRAND, column: 'Total Installations', value: 777, itemised: 283852 },
  ]);
  ok(/Taken as filed: 1 total cell/.test(html), 'E1 the panel names how many');
  ok(html.indexOf(GRAND) >= 0 && /filed 777/.test(html),
    'E2 which row and what was filed');
  ok(/283,852/.test(html), 'E3 and what the rows itemise instead');
  ok(/not necessarily an error/.test(html),
    'E4 saying plainly that a difference need not be a mistake');
  ok(render([]) === '',
    'E5 while an import that took nothing renders no box');
});

log('');
log('X. THE CHANGE IS WHERE IT SAYS IT IS');
guard('X-block', () => {
  const code = codeOnly(SRC);
  ok(/function ingestRebuildableTotals\(rows, schema, tableId, totals\) \{/.test(code),
    'X1 the engine is asked which totals it can rebuild');
  ok(/const baseRows = \(draft \|\| \[\]\)\.map\(row => \(row \|\| \[\]\)\.slice\(\)\);/.test(code),
    'X2 asked of the DRAFT, never of the candidate');
  /* RE-POINTED, not widened. Round 1's claim is unchanged: only the
   * total-row half of the refusal is relaxed, and a derived COLUMN is
   * still refused whatever the file offers. Round 4 adds ONE term in
   * front of it -- a total the B7 registry says belongs to the preparer
   * is accepted even where the value probe would have claimed it -- so
   * the derivedCol half is pinned separately here rather than as part of
   * one long line that a later ticket cannot extend without rewriting. */
  ok(/!computed\.derivedCol\(cIdx\) &&\s*\r?\n?\s*!rebuildableTotals\.has\(t\.rowIdx \+ ',' \+ cIdx\)/.test(code),
    'X3 and only the total-row half of the refusal is relaxed: a derived ' +
    'COLUMN is still refused');
  ok(/if \(b7 \|\| \(!computed\.derivedCol\(cIdx\) &&/.test(code),
    'X3b with CLCPA-293 round 4s registry term in front of it, which only ' +
    'ever WIDENS what is accepted');
  /* the conservative default: a probe that cannot run keeps the old refusal */
  ok(/for \(let c = 1; c < schema\.length; c\+\+\) out\.add\(ri \+ ',' \+ c\);/.test(code),
    'X4 a probe that throws marks the row rebuildable, so a broken check costs the fix, not the data');
  ok(codeOnly(BASE_SRC).indexOf('ingestRebuildableTotals') < 0,
    'X5 (BASE carries none of this)');
});

log('');
log('='.repeat(70));
log('  ' + pass + ' passed, ' + fail + ' failed');
log('='.repeat(70));
fs.writeFileSync(path.join(__dirname, 'suite-293-output.txt'), lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
