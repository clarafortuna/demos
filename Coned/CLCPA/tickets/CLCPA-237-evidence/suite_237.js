/* CLCPA-237 items E and D: the phantom KPI entry, and the empty-branch grid.
 *
 * ITEM E IS CORRECTNESS, NOT COSMETICS, and it exists because of a defect the
 * CLCPA-237 audit found in the CLCPA-238 composer I shipped hours earlier.
 *
 * renderExecutiveSummary decides its empty state with
 *   p.kpis.reported.some(k => k.values && k.values[year])
 * which is truthy for a KEY THAT EXISTS. The composer's guard was
 *   v.total !== undefined || v.dac !== undefined
 * and clean_energy_jobs hard-codes `dac: null` because no DAC breakdown for
 * jobs exists. For 2099, I1 has no data so total is undefined -- but
 * `null !== undefined` is TRUE, so an entry was written with every value null.
 *
 * Consequence: 2099 rendered the FULL executive summary, dumbbell and strip
 * included, off a year holding one table. 2099 is in the year selector, and the
 * walkthrough is tomorrow.
 *
 * The fix asks whether a NUMBER came out. A KPI-year with neither figure is not
 * a KPI-year.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSSREL = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const EVID238 = REPO + '/Coned/CLCPA/tickets/CLCPA-238-evidence';
const BASE = process.env.DAC_BASE_COMMIT || '358da70';
const SRC = fs.readFileSync(path.join(REPO, REL), 'utf8');
const CSS = fs.readFileSync(path.join(REPO, CSSREL), 'utf8');
const toCRLF = (s) => s.replace(/\r?\n/g, '\r\n');
const BASE_SRC = toCRLF(execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
const say = (s) => lines.push(s);
function guard(label, fn) {
  try { fn(); }
  catch (e) { ok(false, label + ' THREW instead of failing: ' + (e && e.message ? e.message : String(e))); }
}
function grab(name, src) {
  const s = src || SRC;
  for (const pad of ['  ', '    ', '']) for (const kw of ['function ', 'async function ']) {
    const head = '\r\n' + pad + kw + name + '(';
    const i = s.indexOf(head); if (i < 0) continue;
    const close = '\r\n' + pad + '}';
    const j = s.indexOf(close, i + head.length);
    if (j >= 0) return s.slice(i + 2, j + close.length);
  } return null;
}
function grabDecl(name, src) {
  const s = src || SRC;
  const re = new RegExp('\\r\\n  (?:const|var|let) ' + name + ' = ');
  const m = s.match(re); if (!m) return null;
  const i = s.indexOf(m[0]);
  const rest = s.slice(i + 2);
  const end = rest.search(/\r\n  (?:const|var|let|function|async function|\/\*)/);
  return end < 0 ? rest : rest.slice(0, end);
}
function codeOnly(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '/*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? src.length : j + 2; continue; }
    if (two === '//') { const j = src.indexOf('\n', i); i = j < 0 ? src.length : j; continue; }
    out += src[i]; i++;
  }
  return out;
}
const CODE = codeOnly(SRC);

say('======================================================================');
say('CLCPA-237 items E + D -- the phantom KPI entry and the empty-year grid');
say('  BASE ' + BASE + ' (main before this session)');
say('======================================================================');

/* ---- the shipped composer, driven over the reconstructed org state ---- */
const FNS = ['dacCanon', 'dacFirstDiff', 'dacRow', 'dacCol', 'dacCell', 'dacPct',
  'dacBody', 'dacPick', 'dacGBoroughs', 'dacCPrograms', 'dacJAverage',
  'composePayloadFromRows', 'isStrictTotalRowLabel', 'kpiDacPct',
  'rowsForDisplay', 'totalRowFlags', 'columnGrandTotals', 'applyDerivedCols',
  'sumDerivedCols', 'detectPctColumns'];
const DECLS = ['DAC_TOTAL_RE', 'DAC_CHART_RULES', 'DAC_KPI_REPORTED', 'dacShare',
  'dacJ9Share', 'DAC_KPI_ANALYTICAL', 'DERIVED_COLS', 'NOT_RECONCILED_TABLES',
  /* CLCPA-240 round 2: totalRowFlags and the ingest predicates read these, so
     the functions cannot be assembled without them. Dependencies, not
     assertions. */
  'HIERARCHICAL_TABLES', 'INGEST_NOVALUE_MARKER'];

function composerFrom(src) {
  const body = DECLS.map(n => grabDecl(n, src)).join('\n') + '\n' +
    FNS.map(n => grab(n, src)).join('\n') +
    '\nreturn composePayloadFromRows;';
  return new Function(body)();
}
/* the org, reconstructed the way the CLCPA-238 evidence does: the hashed seed
 * plus the two rows step 4 deliberately left as they were */
function orgRows() {
  const man = JSON.parse(fs.readFileSync(path.join(EVID238, 'seed_manifest.json'), 'utf8'));
  const S = {};
  man.files.forEach(f => { S[f.entitySet] = JSON.parse(fs.readFileSync(path.join(EVID238, f.file), 'utf8')); });
  const PRE = JSON.parse(fs.readFileSync(
    REPO + '/deploy-backups/2026-09-08-clcpa238-pre-seed/tabledata.json', 'utf8'));
  const td = JSON.parse(JSON.stringify(S['cr2bf_dacingesttesttabledata1s']));
  const pa = PRE.filter(r => r.cr2bf_key === 'A1:2025')[0];
  const p9 = PRE.filter(r => r.cr2bf_key === 'A1:2099')[0];
  td.filter(r => r.cr2bf_key === 'A1:2025')[0].cr2bf_rows = pa.cr2bf_rows;
  td.push({ cr2bf_key: 'A1:2099', cr2bf_section: p9.cr2bf_section,
    cr2bf_tableid: p9.cr2bf_tableid, cr2bf_year: p9.cr2bf_year,
    cr2bf_rows: p9.cr2bf_rows, cr2bf_schema: null, cr2bf_title: null });
  return { tabledata: td, tables: S['cr2bf_dacreporttables'],
           sections: S['cr2bf_dacreportsections'], metrics: S['cr2bf_dacreportmetrics'] };
}

say('');
say('=== 1. ITEM E: no phantom 2099 KPI entry ===');
guard('the guard, driven', () => {
  const src = orgRows();
  const composed = composerFrom(SRC)(src);
  const with2099 = composed.kpis.reported.filter(k => k.values && k.values['2099']);
  ok(with2099.length === 0,
     'NO reported KPI has a 2099 entry: ' + with2099.length + ' (was 1)' +
     (with2099.length ? ' -- ' + with2099.map(k => k.id).join(',') : ''));

  /* THE BASE CONTROL: the phantom really was there, and it was exactly one */
  const baseComposed = composerFrom(BASE_SRC)(src);
  const baseWith = baseComposed.kpis.reported.filter(k => k.values && k.values['2099']);
  ok(baseWith.length === 1,
     'at BASE exactly ONE did: ' + baseWith.map(k => k.id).join(','));
  ok(baseWith.length === 1 && baseWith[0].id === 'clean_energy_jobs',
     'and it was clean_energy_jobs, the only rule that hard-codes dac: null');
  if (baseWith.length) {
    const v = baseWith[0].values['2099'];
    ok(v.total === null && v.dac === null,
       'with every value null: ' + JSON.stringify(v) +
       ' -- a key that exists and says nothing');
  }

  /* AND THE EXEC SUMMARY DISJUNCT, which is the reason it mattered */
  const disj = (pay) => pay.kpis.reported.some(k => k.values && k.values['2099']);
  ok(disj(baseComposed) === true,
     'at BASE the exec-summary KPI test was TRUE for 2099, so the empty state ' +
     'did not fire and 2099 drew a full page off one table');
  ok(disj(composed) === false,
     'and is now FALSE, so 2099 gets the "no data" banner it should have had');

  /* the years that DO have data are untouched: the fix must not silence them */
  ['2023', '2024', '2025'].forEach(y => {
    const n = composed.kpis.reported.filter(k => k.values && k.values[y]).length;
    const b = baseComposed.kpis.reported.filter(k => k.values && k.values[y]).length;
    ok(n === b && n > 0, y + ' still has ' + n + ' reported KPIs, same as BASE');
  });
});

guard('the guard asks the right question', () => {
  const comp = codeOnly(grab('composePayloadFromRows'));
  ok(/const usable = v && \(typeof v\.total === 'number' \|\| typeof v\.dac === 'number'\);/.test(comp),
     'the guard tests for a NUMBER, not for "a key is not undefined"');
  ok(!/v\.total !== undefined \|\| v\.dac !== undefined/.test(comp),
     'and the undefined test is gone');
  const baseComp = codeOnly(grab('composePayloadFromRows', BASE_SRC));
  ok(/v\.total !== undefined \|\| v\.dac !== undefined/.test(baseComp),
     'BASE control: the undefined test was there');
  /* the rule that triggered it is unchanged -- the fix is in the guard, not in
   * clean_energy_jobs, because `dac: null` is the honest answer for jobs */
  const rules = grabDecl('DAC_KPI_REPORTED');
  ok(/dac: null \}\)/.test(rules),
     'clean_energy_jobs still returns dac: null, which is correct -- no DAC ' +
     'breakdown for jobs exists, and the guard is what had to change');
});

say('');
say('=== 2. ITEM D: the empty-year grid anchor (PINNED to 40642e2) ===');
/* ITEM D'S SUBJECT NO LONGER EXISTS.
 *
 * CLCPA-237 item F deleted the empty-year branch outright and the three grid
 * modifiers with it, so "the empty branch carries the solo modifier" is a claim
 * about code that has been removed on purpose. It was TRUE at 40642e2, which is
 * what this ticket is answerable for, so this section reads that commit -- the
 * same treatment item E's claim already has, and for the same reason.
 *
 * Item F also proved WHY the modifier never mattered: a later
 * `.exec-shares-grid { ... !important }` block owned the property and placed
 * the children by nth-child, so the solo template lost the cascade regardless
 * of source order. The cascade assertions below are correct about ordering and
 * were still testing the wrong competitor. suite_237f owns the live claim now.
 */
const D_SRC = process.env.DAC_APP_OVERRIDE ? SRC : toCRLF(execSync(
  'git show 40642e2:"' + REL + '"', { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
const D_CSS = process.env.DAC_APP_OVERRIDE ? CSS : toCRLF(execSync(
  'git show 40642e2:"' + CSSREL + '"', { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
guard('the solo modifier', () => {
  const ex = grab('renderExecutiveSummary', D_SRC);
  ok(!!ex, 'renderExecutiveSummary is found');
  const c = codeOnly(ex);
  /* the empty branch is the one with the banner; the populated branch must NOT
   * gain the modifier or the three cards would stack in one column */
  const emptyBranch = c.slice(c.indexOf('if (!anyData)'), c.indexOf('return `\n'));
  ok(/exec-shares-grid exec-shares-grid-solo/.test(emptyBranch),
     'the EMPTY branch carries the solo modifier');
  const soloCount = (c.match(/exec-shares-grid-solo/g) || []).length;
  ok(soloCount === 1,
     'and exactly once in the whole function: ' + soloCount +
     ' -- the populated branch keeps its three columns');
  ok(/renderDACMap/.test(emptyBranch),
     'the map is still drawn in the empty branch (CLCPA-158: it is not gated ' +
     'on table data, because it draws geographic reference data)');

  /* BASE control */
  ok(!/exec-shares-grid-solo/.test(codeOnly(BASE_SRC)),
     'BASE had no solo modifier: the map sat in column 1 of 3');
});

guard('the CSS, and its cascade position', () => {
  ok(/\.exec-shares-grid \{[^}]*grid-template-columns: 1fr 1fr 1fr/.test(D_CSS),
     'the base grid is still three columns');
  ok(/\.exec-shares-grid-solo \{ grid-template-columns: 1fr; \}/.test(D_CSS),
     'and the solo modifier is one column');
  /* EXACTLY ONE, and a mutation exposed the need for this. Inserting a second
   * copy earlier in the file went GREEN: indexOf found the first, the last one
   * still won, and the ordering assertions were satisfied by accident. Two
   * copies of a cascade-sensitive rule is a drift waiting to happen -- whichever
   * one someone edits next may not be the one that applies. */
  const soloRules = (D_CSS.match(/\.exec-shares-grid-solo\s*\{/g) || []).length;
  ok(soloRules === 1,
     'and it is declared exactly ONCE in styles.css: ' + soloRules);
  /* CASCADE, checked rather than assumed: both selectors are one class, so
   * SOURCE ORDER decides. The modifier must come after the base rule AND after
   * the 1300px media query, or above 1300px the base three-column rule wins and
   * the fix does nothing. */
  const iBase = D_CSS.indexOf('.exec-shares-grid {');
  const iMedia = D_CSS.indexOf('.exec-shares-grid { grid-template-columns: 1fr; gap: 12px; }');
  const iSolo = D_CSS.indexOf('.exec-shares-grid-solo {');
  ok(iBase > 0 && iSolo > iBase,
     'the modifier is declared AFTER the base rule, so it wins at equal specificity');
  ok(iMedia > 0 && iSolo > iMedia,
     'and after the 1300px media query, which is what makes it apply on wide screens');
  ok(/@media \(max-width: 1300px\)/.test(D_CSS),
     'the media query still collapses to one column below 1300px, where the ' +
     'defect never showed');
});

say('');
say('=== 3. WHAT THIS TICKET DELIBERATELY DID NOT DO ===');
guard('item F stays post-Sept-10', () => {
  const ex = codeOnly(grab('renderExecutiveSummary'));
  /* anyData is still ONE boolean for the page. Item F -- per-section empty
   * state, matching what the section pages already do -- is a redesign of a
   * page Emely passed today, and is deliberately not in this ticket. */
  /* OBSOLETE BY RULING, not by drift. This pin existed to stop item F being
   * smuggled into a ticket that had not been authorised for it. Item F was
   * then ruled IN and expanded -- walkthrough-critical, since a live import
   * lands on this screen -- and it deleted anyData along with the branch. The
   * pin is replaced by the fact it was guarding against, stated plainly and
   * checked against the commit where it held. */
  ok(/const anyData = \(/.test(codeOnly(grab('renderExecutiveSummary', D_SRC))),
     'at 40642e2 anyData was still a single page-level boolean: item F was NOT ' +
     'smuggled into this ticket');
  ok(!/anyData/.test(codeOnly(SRC)),
     'and it is gone from the live build, by the later item F ruling, which ' +
     'suite_237f owns');
  /* THIS ONE CLAIM IS PINNED TO THE COMMIT 237 LANDED AS, not to the working
   * tree. It says "item E's only edit was the solo class", which was true at
   * 40642e2 and is what this ticket is answerable for. The pre-walkthrough
   * round then rewrote the whole empty branch on purpose -- three placeholders
   * and a full-width map -- so read against the tree the claim now reports a
   * change that is somebody else's, and is covered by suite_prewalk section 3
   * (which asserts the POPULATED branch byte-identical, so 2025 is untouched).
   *
   * Widening the strip() to tolerate the new markup would have deleted the
   * guard. Pinning keeps it exact and keeps it honest about which build it
   * describes. Verified: 28 passed, 0 failed at 40642e2. */
  const EREV = process.env.DAC_237_COMMIT || '40642e2';
  const EX_SRC = process.env.DAC_APP_OVERRIDE ? SRC
    : execSync('git show ' + EREV + ':"' + REL + '"',
        { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
  const exPinned = codeOnly(grab('renderExecutiveSummary', EX_SRC));
  const baseEx = codeOnly(grab('renderExecutiveSummary', BASE_SRC));
  /* the modifier is stripped WITH its leading space. Removing only the class
   * name left "exec-shares-grid " against "exec-shares-grid" and the assertion
   * failed on a single space -- which is the harness being imprecise, not the
   * code differing. Worth the extra character: a false red here would have sent
   * me looking for a change that was not there. */
  const strip = (s) => s.replace(/ exec-shares-grid-solo/g, '').replace(/\s+/g, ' ');
  ok(strip(exPinned) === strip(baseEx),
     'and renderExecutiveSummary is otherwise UNCHANGED from BASE: the only ' +
     'edit is the solo class');
  /* the section pages already degrade per section, which is the model item F
   * would follow -- asserted so the contrast is on the record */
  ok(/No data has been entered for \$\{sec\.full_name\} in \$\{yr\}/.test(SRC),
     'section pages already name the section in their empty state');
  ok(/Source tables for this section are shown below if any exist/.test(SRC),
     'and still show the source tables: per-section degradation already exists');
});

say('');
say('======================================================================');
say('  ' + pass + ' passed, ' + fail + ' failed');
say('======================================================================');

const out = lines.join('\n') + '\n';
process.stdout.write(out);
fs.writeFileSync(path.join(__dirname, 'suite-237-output.txt'), out);
process.exitCode = fail ? 1 : 0;
