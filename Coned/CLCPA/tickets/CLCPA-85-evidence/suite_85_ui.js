/* CLCPA-85 round 2: the source tables row, the Add or Edit Data dialog, and
 * the two removals.
 *
 * THE HEADLINE PROOF is row identity. Ruling 1: the Report Data tab row and the
 * report pages' row must render IDENTICALLY, not similarly, and a difference at
 * any table count is a defect. Two things prove it here:
 *
 *   1. There is ONE renderer. renderSrcTabRow draws both, so the markup exists
 *      in a single place and cannot drift (the CLCPA-221 round 2 precedent).
 *   2. Belt and braces anyway: the two rendered rows are compared CHARACTER FOR
 *      CHARACTER with only the action attribute normalised, for EVERY section,
 *      i.e. at every table count from 1 to 10.
 *
 * And a regression guard the ruling implies: the report pages' row must still
 * be byte-identical to what it was BEFORE this ticket, which is checked by
 * rebuilding it from the pre-85 commit's own markup.
 *
 * BASE is the pre-85 deploy and never moves. There is no PREV: round 1 was
 * never deployed, so this ticket has one baseline.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSS_REL = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const HTML_REL = 'Coned/CLCPA/ExecutiveDashboard_dev/ExecutiveDashboard.html';
const BASE = process.env.DAC_BASE_COMMIT || '11e2b96';   // pre-85, as deployed
const OUT = path.join(__dirname, 'renders-round2');

const toCRLF = (t) => t.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
const SRC = fs.readFileSync(path.join(REPO, REL), 'utf8');
const CSS = fs.readFileSync(path.join(REPO, CSS_REL), 'utf8');
const HTML = fs.readFileSync(path.join(REPO, HTML_REL), 'utf8');
const g = (rel) => toCRLF(execSync('git show ' + BASE + ':"' + rel + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
const BASE_SRC = g(REL), BASE_CSS = g(CSS_REL), BASE_HTML = g(HTML_REL);
const PAYLOAD = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => { if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); } return !!c; };

function grab(src, name) {
  for (const pad of ['  ', '    ', '']) {
    for (const kw of ['function ', 'async function ']) {
      const head = '\r\n' + pad + kw + name + '(';
      const i = src.indexOf(head);
      if (i < 0) continue;
      const close = '\r\n' + pad + '}';
      const j = src.indexOf(close, i + head.length);
      if (j >= 0) return src.slice(i + 2, j + close.length);
    }
  }
  return null;
}
function grabDecl(src, name) {
  const L = src.split('\r\n');
  let s = -1, e = -1;
  const open = new RegExp('^  const ' + name + ' = ');
  for (let i = 0; i < L.length; i++) {
    if (s < 0) { if (open.test(L[i])) s = i; }
    else if (/^  \}\)\(\);/.test(L[i]) || /^  \};/.test(L[i])) { e = i; break; }
  }
  return (s < 0 || e < 0) ? null : L.slice(s, e + 1).join('\n');
}

const ESC = 'const escapeHtml = (s) => String(s == null ? "" : s)' +
  '.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")' +
  '.replace(/"/g, "&quot;");\n';

/* the CURRENT shared renderer */
const rowFn = grab(SRC, 'renderSrcTabRow');
if (!rowFn) { console.error('EXTRACTION FAILED: renderSrcTabRow'); process.exit(1); }
const renderRow = new Function('SHORT_TITLES',
  ESC + rowFn + '\nreturn renderSrcTabRow;')(
  new Function(grabDecl(SRC, 'SHORT_TITLES') + '\nreturn SHORT_TITLES;')());

/* the PRE-85 row, rebuilt from that commit's own inline markup, so the
 * regression guard compares against what actually shipped rather than against
 * my memory of it. */
const baseBlock = (function () {
  const i = BASE_SRC.indexOf('    // -- Tab bar ---');
  const j = BASE_SRC.indexOf(".join('');", i);
  return i < 0 || j < 0 ? null : BASE_SRC.slice(i, j + 10);
})();
if (!baseBlock) { console.error('EXTRACTION FAILED: BASE tab bar'); process.exit(1); }
const renderBaseRow = new Function('tables', 'activeId', 'SHORT_TITLES',
  ESC + baseBlock + '\nreturn `<div class="src-tabs-row">${tabsHtml}</div>`;');
const ST = new Function(grabDecl(SRC, 'SHORT_TITLES') + '\nreturn SHORT_TITLES;')();

const sections = Array.from(new Set(Object.values(PAYLOAD.tables).map(t => t.section))).sort();
const tablesIn = (sec) => Object.values(PAYLOAD.tables).filter(t => t.section === sec)
  .sort((a, b) => parseInt(a.id.slice(1), 10) - parseInt(b.id.slice(1), 10));

lines.push('======================================================================');
lines.push('CLCPA-85 round 2 -- source tables row, the dialog, the removals');
lines.push('======================================================================');

lines.push('');
lines.push('=== RULING 1: the two rows are IDENTICAL, at every table count ===');
{
  ok((SRC.match(/class="src-tab\$\{isActive/g) || []).length === 1,
     'the tab markup exists in exactly ONE place in the source');
  // The definition line matches `renderSrcTabRow(` too, so count it separately
  // rather than folding it into the caller count.
  ok((SRC.match(/function renderSrcTabRow\(/g) || []).length === 1,
     'exactly one definition of the shared renderer');
  ok((SRC.match(/\$\{renderSrcTabRow\(/g) || []).length === 2,
     'and exactly two callers: the report pages and Report Data');

  const norm = (s) => s.replace(/data-ingest-table=/g, 'data-table-id=');
  let checked = 0, identical = 0;
  const diffs = [];
  sections.forEach(sec => {
    const ts = tablesIn(sec);
    ts.forEach(active => {
      const report = renderRow(ts, active.id);
      const ingest = renderRow(ts, active.id, { attr: 'data-ingest-table' });
      checked++;
      if (norm(ingest) === report) identical++;
      else diffs.push(sec + '/' + active.id);
    });
  });
  ok(checked === 52, 'compared every section at every active tab: ' + checked + ' rows');
  ok(checked === identical,
     'CHARACTER FOR CHARACTER identical with only the action attribute normalised: ' +
     identical + '/' + checked);
  if (diffs.length) lines.push('       differed: ' + diffs.join(', '));

  // per table count, which is the condition the ruling names
  const counts = {};
  sections.forEach(sec => { counts[tablesIn(sec).length] = sec; });
  Object.keys(counts).sort((a, b) => a - b).forEach(n => {
    const ts = tablesIn(counts[n]);
    ok(norm(renderRow(ts, ts[0].id, { attr: 'data-ingest-table' })) === renderRow(ts, ts[0].id),
       'identical at ' + n + ' table' + (n === '1' ? '' : 's') + ' (section ' + counts[n] + ')');
  });

  // and the ONLY difference really is the attribute: nothing else is swapped
  const ts = tablesIn('A');
  const rep = renderRow(ts, 'A1');
  const ing = renderRow(ts, 'A1', { attr: 'data-ingest-table' });
  ok(rep !== ing, 'the raw strings do differ, so the comparison is not vacuous');
  ok(rep.split('data-table-id=').length - 1 === 10 &&
     ing.split('data-ingest-table=').length - 1 === 10,
     'each row carries its own action attribute on all ten buttons');
}

lines.push('');
lines.push('=== the report pages\u2019 row did not change ===');
{
  sections.forEach(sec => {
    const ts = tablesIn(sec);
    const now = renderRow(ts, ts[0].id);
    const before = renderBaseRow(ts, ts[0].id, ST);
    ok(now === before, 'section ' + sec + ': byte-identical to the pre-85 build');
  });
  ok(BASE_SRC.indexOf('<div class="src-tabs-row">${tabsHtml}</div>') >= 0,
     'BASE control: the row was built inline before, which is what moved');
  ok(SRC.indexOf('<div class="src-tabs-row">${tabsHtml}</div>') >= 0,
     'and the same literal is now inside the shared renderer');
  // the row's own CSS is untouched, since identity depends on it
  const rule = (css) => css.slice(css.indexOf('.src-tabs-row {'), css.indexOf('.src-tab-num {'));
  ok(rule(CSS) === rule(BASE_CSS),
     '.src-tabs-row and .src-tab are byte-identical in CSS too, so nothing was restyled');
  ok(/grid-template-columns: repeat\(10, 1fr\);/.test(rule(CSS)),
     'the row is still repeat(10, 1fr), so few tables render exactly as the report pages render them');
}

lines.push('');
lines.push('=== the picker row: table dropdown out, tab row in ===');
{
  const picker = grab(SRC, 'renderIngestPicker');
  ok(!/id="ingest-table"/.test(picker), 'the table dropdown is gone from the picker');
  ok(!/const tableOpts/.test(picker), 'and so are the options it built');
  ok(/renderSrcTabRow\(tablesForSec, i\.tableId, \{ attr: 'data-ingest-table' \}\)/.test(picker),
     'the shared row is drawn with the Report Data action attribute');
  ok(/ingest-srctables-label">Source Tables</.test(picker), 'the divider label is present');
  // the label must be OUTSIDE the row, or the rows would not be identical
  const li = picker.indexOf('ingest-srctables-label');
  const ri = picker.indexOf('renderSrcTabRow');
  ok(li > 0 && ri > 0 && li < ri, 'and it sits OUTSIDE the row, above it');
  ok(!/id="ingest-add-year"/.test(picker), '+ Add year has left the picker row');
  ok(/id="ingest-remove-year"/.test(SRC), 'the Remove year button stays, being a year action');
  ok(BASE_SRC.indexOf('id="ingest-table"') >= 0, 'BASE control: the dropdown existed');
  ok(BASE_SRC.indexOf('id="ingest-add-year"') >= 0, 'BASE control: so did + Add year');

  // the picker grid lost a column with the field
  const pk = (css) => css.slice(css.indexOf('.ingest-picker {'), css.indexOf('.ingest-picker-field'));
  ok(/grid-template-columns: 2fr 1fr;/.test(pk(CSS)), 'the picker is two columns now');
  ok(/grid-template-columns: 2fr 2fr 1fr;/.test(pk(BASE_CSS)),
     'BASE control: it was three, which is why it had to change');

  // clicking a tab is wired, with the dropdown's own guards
  const wire = grab(SRC, 'wireIngestPage');
  ok(/\.src-tab\[data-ingest-table\]/.test(wire), 'the tabs are wired by their own attribute');
  ok(/if \(id === state\.ingest\.tableId\) return;/.test(wire), 'clicking the active tab is a no-op');
  ok(/confirm\('Discard unsaved changes\?'\)/.test(wire), 'and the dirty guard is kept');
  /* Bounded to the tab handler itself. Slicing from the selector to the end of
   * wireIngestPage matched the SECTION handler's rerenderIngestAll further
   * down, so the check passed with the tab handler mutated to an editor-only
   * redraw. */
  const tabStart = wire.indexOf(".src-tab[data-ingest-table]");
  const tabBlock = wire.slice(tabStart, wire.indexOf('\r\n    });', tabStart));
  ok(tabBlock.length > 0 && /rerenderIngestAll\(\);/.test(tabBlock),
     'a tab click redraws the PAGE, so the active tab moves with it');
  ok(!/rerenderIngestEditor\(\)|rerenderIngestHistory\(\)/.test(tabBlock),
     'and not just the editor, which would leave the old tab looking selected');
}

lines.push('');
lines.push('=== round 3: ONE STEP, every control live ===');
{
  const dlg = grab(SRC, 'openAddYearDialog');
  ok(!!dlg, 'the Add New Year dialog exists');
  ok(/id="ingest-addyear" type="button">Add New Year</.test(SRC),
     'the page header button says Add New Year, in title case');
  ok(/addYear\.addEventListener\('click', openAddYearDialog\)/.test(grab(SRC, 'wireIngestPage')),
     'and it opens that dialog');

  /* INVERTED across the rounds. Round 2 pinned a choice state and an Edit path
   * present; revision 1 pinned a gated fill half. Both are gone. */
  ok(SRC.indexOf('openAddEditDialog') < 0, 'the two-path dialog is gone by name');
  ok(SRC.indexOf('bodyChoice') < 0 && SRC.indexOf('bodyEdit') < 0,
     'the choice state and Edit panel are gone');
  ok(SRC.indexOf('data-go=') < 0, 'no choice buttons remain');
  ok(SRC.indexOf('Edit Existing Data') < 0 && SRC.indexOf('Open For Editing') < 0,
     'nor their labels');
  ok(SRC.indexOf('Add or Edit Data') < 0, 'and no comment still names the old dialog');
  ok(SRC.indexOf('enableFill') < 0, 'the two-phase enable is gone');
  ok(!/let stage\b/.test(SRC), 'and any stage variable with it');
  ok(!/is-disabled/.test(SRC), 'nothing in the dialog is disabled any more');
  const css0 = fs.readFileSync(path.join(REPO, CSS_REL), 'utf8');
  ok(!/\.ingest-choice/.test(css0), 'the choice CSS is deleted');
  ok(!/\.ingest-fill/.test(css0), 'and the gated-half CSS with it, not left orphaned');

  /* EVERY CONTROL LIVE: no disabled attribute anywhere in what draw() writes. */
  const drawFn = dlg.slice(dlg.indexOf('function draw()'), dlg.indexOf('function restage()'));
  ok(drawFn.length > 0, 'draw() was found to read');
  ok(!/ disabled/.test(drawFn), 'draw() writes no disabled attribute at all');
  ok(/renderIngestImportBar\(/.test(drawFn), 'the import bar is rendered');
  ok(!/renderIngestImportBar\([^)]*true\)/.test(drawFn), 'and NOT rendered inert');
  ['dlg-newyear', 'dlg-section', 'dlg-table'].forEach(id =>
    ok(drawFn.indexOf('id="' + id + '"') >= 0, 'draw() renders ' + id));
  ok(/Existing years: /.test(drawFn), 'with the existing-years hint');

  /* STAGING: choosing a file does not touch the draft. */
  const stage = grab(SRC, 'wireIngestStaging');
  ok(!!stage, 'there is a staging wiring');
  ok(!/applyIngestImport|state\.ingest\.draft|i\.draft/.test(stage),
     'which never touches the draft: staging is a read, not a write');
  ok(/buildIngestImport\(rows, t\.schema, \[\], t\.tableId\)/.test(stage),
     'the dry run plans against an EMPTY draft, which is what a new year has');
  ok(/onStaged\(\{ name: f\.name, rows: rows, dry: dry \}\)/.test(stage),
     'and hands back the file name, its rows and the dry run');
  ok((SRC.match(/function buildIngestImport/g) || []).length === 1,
     'ONE engine does both the dry run and the apply, so they cannot disagree');
  ok(/function ingestStagedSummary/.test(SRC), 'there is a one-line summary');
  const summ = grab(SRC, 'ingestStagedSummary');
  ok(/ready to import/.test(summ), 'which says what is ready');
  ok(/cannot be imported/.test(summ), 'or why it cannot be');
  ok(/Add Year will still add the year/.test(summ),
     'and says plainly that a bad file does not block the year');
  ok(/id="dlg-stagedbox"/.test(dlg), 'the summary has a box in the dialog');
  ok(/\.ingest-staged \{/.test(css0) && /\.ingest-staged\.is-bad/.test(css0),
     'styled, with a distinct look when the file cannot be imported');

  /* DOWNLOAD TEMPLATE keeps its resting background on hover.
   *
   * The dark fill came from .btn:hover (background: var(--ink-2), specificity
   * 0-2-0) outranking .btn-link { background: transparent } (0-1-0);
   * .btn-link:hover sets only text-decoration so it never contested it.
   *
   * Fixed SCOPED to this control by id, not by touching .btn-link:hover, which
   * is shared: that is the R2 lesson. So the shared rules must be byte-identical
   * to the pre-85 build, and that is asserted too. */
  const restBg = (css0.match(/\.btn-link \{[^}]*background: ([^;]+);/) || [])[1];
  ok(restBg === 'transparent', 'the resting background is transparent: ' + restBg);
  const hoverRule = (css0.match(/#ingest-template:hover \{[^}]*\}/) || [])[0];
  ok(!!hoverRule, 'there is a scoped hover rule for the control');
  // Gated, not dereferenced: without the fix hoverRule is undefined and the
  // suite CRASHED instead of naming the failure.
  const hoverBg = hoverRule ? (hoverRule.match(/background: ([^;]+);/) || [])[1] : undefined;
  ok(hoverBg === restBg,
     'and its hover background EQUALS its resting background: ' + hoverBg);
  ok(!!hoverRule && /#ingest-template:hover/.test(hoverRule),
     'scoped by id, so no other control is affected');
  // the shared rules are untouched
  const shared = (c) => [
    (c.match(/^\.btn:hover \{[^}]*\}/m) || [])[0],
    (c.match(/^\.btn-link \{[^}]*\}/m) || [])[0],
    (c.match(/^\.btn-link:hover \{[^}]*\}/m) || [])[0],
  ].join('|');
  ok(shared(css0) === shared(BASE_CSS),
     '.btn:hover, .btn-link and .btn-link:hover are byte-identical to pre-85');
  ok(/\.btn-link:hover \{ text-decoration: underline; \}/.test(css0),
     'so the underline on hover is the SIBLING rule s own, not one invented here');

  /* the template is live from the start and uses the TYPED year */
  ok(/const y = typedYear\(\);/.test(dlg), 'the template reads the typed year');
  /* Round 4: the template is an .xlsx WORKBOOK. The import path stays CSV,
   * which is why the workbook's instructions sheet spends a step on Save As. */
  ok(/buildIngestWorkbook\(sel\.tableId, y\)/.test(dlg),
     'generates the WORKBOOK for the selected table and the typed year');
  ok(/downloadBinaryFile\(sel\.tableId \+ '-' \+ y \+ '-template\.xlsx'/.test(dlg),
     'and names it .xlsx with that year');
  ok(/spreadsheetml\.sheet/.test(dlg), 'with the workbook MIME type');
  ok(SRC.indexOf('buildIngestTemplate') < 0, 'the CSV template generator is gone');

  /* ORDER INSIDE THE ONE CLICK: validate, then add, then apply. */
  const clickBlock = dlg.slice(dlg.indexOf("act('addyear'"));
  const iVal = clickBlock.indexOf('validateReportingYear(');
  const iAdd = clickBlock.indexOf('addReportingYear(v.year)');
  const iApply = clickBlock.indexOf('buildIngestImport(staged.rows');
  ok(iVal >= 0 && iAdd >= 0 && iApply >= 0, 'all three steps are present');
  ok(iVal < iAdd, 'validation comes FIRST, so an invalid year moves nothing');
  ok(iAdd < iApply,
     'and the year is ADDED BEFORE the staged file is applied, always');
  ok(/if \(!v\.ok\) \{[\s\S]{0,200}return;/.test(clickBlock),
     'an invalid year returns before anything is touched');
  const beforeAdd = clickBlock.slice(0, iAdd);
  ok(!/applyIngestImport|buildIngestImport/.test(beforeAdd),
     'nothing is imported before the add, even on the happy path');

  /* validation is SPLIT from the commit, which is what makes the above possible */
  ok(/function validateReportingYear\(raw\)/.test(SRC), 'validation is its own function');
  const val = grab(SRC, 'validateReportingYear');
  ok(!/Storage\.addYear|state\.payload|loadIngestDraft/.test(val),
     'and is side-effect free');
  const add = grab(SRC, 'addReportingYear');
  ok(/const v = validateReportingYear\(raw\);/.test(add),
     'and the commit uses it, so there is one set of rules');
  ok((SRC.match(/Storage\.addYear\(/g) || []).length === 1,
     'exactly ONE place adds a year');

  /* a hard rejection does not block the year */
  ok(/added = true;/.test(clickBlock), 'the year is marked added');
  ok(clickBlock.indexOf('added = true;') < iApply,
     'BEFORE the apply, so a rejected file cannot undo it');
  ok(/if \(plan\.ok\) applyIngestImport\(plan\);/.test(clickBlock),
     'only a clean plan is applied');
  ok(/i\.importResult = plan;/.test(clickBlock),
     'but the result is recorded either way, so the page can say why');
  ok(/if \(added\) rerenderIngestAll\(\);/.test(dlg),
     'and closing redraws the page, so the year and the receipt both appear');

  /* the recorded consequence: the engine is year-agnostic */
  ok(!/<select id="dlg-year"/.test(dlg), 'the dialog has no year PICKER');
  const engine = grab(SRC, 'buildIngestImport');
  ok(/^\s*function buildIngestImport\(fileRows, schema, draft, tableId\)/.test(engine),
     'buildIngestImport takes no year parameter');
  ok(!/state\.ingest\.year|i\.year/.test(engine), 'nor reads one from state');

  /* the hooked wiring built for immediate-apply is gone */
  ok(SRC.indexOf('function wireIngestImport') < 0,
     'wireIngestImport is deleted: one step needs nothing sequenced from outside');
  ok(SRC.indexOf('function rerenderIngestImport') < 0, 'and its rerender helper with it');
  ok(BASE_SRC.indexOf('function wireIngestImport') < 0,
     'BASE control: it never existed before this ticket either');

  // the shell is still the existing one
  ['ingest-modal-overlay', 'ingest-modal-head', 'ingest-modal-body',
   'ingest-modal-foot', 'ingest-modal-close'].forEach(c => {
    ok(dlg.indexOf(c) >= 0 && BASE_SRC.indexOf(c) >= 0,
       'still reuses the existing shell class ' + c);
  });
  ok(/data-act="cancel"/.test(drawFn) && /data-act="addyear"/.test(drawFn),
     'the footer offers Cancel and the ONE primary action');
  ok((drawFn.match(/data-act="/g) || []).length === 2, 'and nothing else');
  ok(/e\.key === 'Escape'/.test(dlg), 'Escape closes it');
  ok(/if \(e\.target === modal\) close\(\)/.test(dlg), 'so does a backdrop click');
  ok(/removeEventListener\('keydown', onEsc\)/.test(dlg),
     'and the Escape handler is removed on close');
}

lines.push('');
lines.push('=== the old add-year modal is GONE, its mechanics kept ===');
{
  ok(SRC.indexOf('function openAddYearModal') < 0, 'the dead modal is deleted');
  ok(SRC.indexOf('add-year-input') < 0 && SRC.indexOf('add-year-confirm') < 0,
     'with its markup');
  ok(BASE_SRC.indexOf('function openAddYearModal') >= 0, 'BASE control: it existed');
  const add = grab(SRC, 'addReportingYear');
  ok(!!add, 'its mechanics survive as addReportingYear');
  /* The MESSAGES moved again in revision 2, into validateReportingYear, when
   * validation was split from the commit. Repointed rather than deleted: that
   * the wording is unchanged from the deleted modal still matters. */
  const val0 = grab(SRC, 'validateReportingYear');
  ['Please enter a valid year.', 'Year must be between 2000 and 2100.', 'already exists.']
    .forEach(m => ok(val0.indexOf(m) >= 0 && BASE_SRC.indexOf(m) >= 0,
      'same message as the deleted modal: "' + m + '"'));
  ok(/Storage\.addYear\(yrStr\);/.test(add), 'same persistence call');
  ok(/buildYearSelector\(\);/.test(add), 'and it still refreshes the header year selector');
  ok((SRC.match(/Storage\.addYear\(/g) || []).length === 1,
     'exactly ONE place adds a year, so the two paths cannot diverge');
}

lines.push('');
lines.push('=== ruling 4: the receipt is on the PAGE, the controls are not ===');
{
  const pageImport = grab(SRC, 'renderIngestImport');
  ok(/return r \? renderIngestImportResult\(r\) : '';/.test(pageImport),
     'the page renders the receipt and nothing else');
  ok(!/ingest-import-bar/.test(pageImport), 'the control bar is NOT on the page');
  ok(/id="ingest-import-mount"/.test(grab(SRC, 'renderIngestPage')),
     'and the receipt has its mount, above the editor');
  const bar = grab(SRC, 'renderIngestImportBar');
  ok(/id="ingest-file"/.test(bar) && /id="ingest-template"/.test(bar),
     'both controls are in the bar, which only the dialog renders');
  /* Round 3 leaves ONE caller: the fill stage. Round 2 had two, because the
   * Edit path carried the bar as well. */
  ok((SRC.match(/renderIngestImportBar\(/g) || []).length === 2,
     'the bar has one definition and one caller, the fill stage');
  ok(!/wireIngestImport\(\);/.test(grab(SRC, 'wireIngestPage')),
     'the page no longer wires the controls it does not render');
}

lines.push('');
lines.push('=== ruling 5: Export PDF is gone from every page ===');
{
  ok(HTML.indexOf('btn-export') < 0, 'the button markup is gone');
  ok(HTML.indexOf('Export PDF') < 0, 'and its label');
  ok(SRC.indexOf('function wireExportButton') < 0, 'the wiring function is gone');
  ok(SRC.indexOf('wireExportButton()') < 0, 'and its boot call');
  ok(SRC.indexOf('window.print()') < 0, 'nothing calls window.print any more');
  // BASE controls for all four
  ok(BASE_HTML.indexOf('btn-export') >= 0 && BASE_SRC.indexOf('function wireExportButton') >= 0,
     'BASE control: button and wiring both existed');

  /* The print STYLES stay: the browser's own print still uses them, and the
   * button was never the only way to print. */
  ok(/@media print \{/.test(CSS), 'the @media print block is KEPT');
  const pr = CSS.slice(CSS.indexOf('@media print {'), CSS.indexOf('@media print {') + 1200);
  ok(/\.sidebar \{ display: none; \}/.test(pr), 'still hiding the sidebar');
  ok(/@page \{ margin/.test(pr), 'still setting page margins');
  const prBase = BASE_CSS.slice(BASE_CSS.indexOf('@media print {'),
    BASE_CSS.indexOf('@media print {') + 1200);
  ok(pr === prBase, 'and byte-identical to before, so printing is unchanged');
}

lines.push('');
lines.push('=== ruling 2: Reporting Year hidden on Report Data ONLY ===');
{
  const sync = grab(SRC, 'syncTopbarYear');
  ok(!!sync, 'there is a per-route sync');
  ok(/state\.route\.name === 'ingest'/.test(sync), 'keyed on the Report Data route');
  ok(/label\.hidden = !!onIngest/.test(sync) && /sel\.hidden = !!onIngest/.test(sync),
     'hiding BOTH the label and the select');
  ok(/syncTopbarYear\(\);/.test(grab(SRC, 'onRouteChange')),
     'and it runs on every route change');
  // hidden, not removed: 42 readers and buildYearSelector depend on the element
  ok(HTML.indexOf('id="year-select"') >= 0, 'the select stays in the DOM');
  ok(HTML.indexOf('class="year-label"') >= 0, 'and so does its label');
  ok(!/removeChild|\.remove\(\)/.test(sync), 'nothing is removed from the DOM');
  ok(/document\.getElementById\('year-select'\)/.test(grab(SRC, 'buildYearSelector')),
     'buildYearSelector still finds it, untouched');
  ok((SRC.match(/state\.year/g) || []).length > 30,
     'because state.year has many readers: ' + (SRC.match(/state\.year/g) || []).length);
}

lines.push('');
lines.push('=== round 3: the ONE STEP, EXECUTED against a DOM stub ===');
/* The real openAddYearDialog is driven. Every control is live, so there is no
 * disabled state to model: what has to be proven instead is ORDER and EFFECT.
 * The stub records the order of the calls the dialog makes, so "add before
 * apply" is checked against what actually ran rather than against source text.
 *
 * Scenarios, as ruled: open; template download wiring; staging a file with its
 * summary; Add Year with a staged file; Add Year with none; an invalid year;
 * and a staged file that hard-rejects.
 */
const dialogStates = {};
{
  let calls = [];
  const el = (tag) => {
    const n = {
      tagName: tag, _cls: '', _attrs: {}, _on: {}, _html: '',
      hidden: false, value: '', style: {},
      set innerHTML(v) { this._html = v; nodes = {}; },
      get innerHTML() { return this._html; },
      set className(v) { this._cls = v; }, get className() { return this._cls; },
      set textContent(v) { this._text = v; },
      get textContent() { return this._text === undefined ? '' : this._text; },
      addEventListener: (k, fn) => { (n._on[k] = n._on[k] || []).push(fn); },
      removeEventListener: () => {},
      remove: () => { calls.push('modal.remove'); },
      appendChild: () => {}, removeChild: () => {}, focus: () => {},
      getAttribute: (k) => (n._attrs[k] === undefined ? null : n._attrs[k]),
      setAttribute: (k, v) => { n._attrs[k] = v; },
      removeAttribute: (k) => { delete n._attrs[k]; },
      querySelector: (s) => nodeFor(s, n),
      querySelectorAll: (s) => { const o = nodeFor(s, n); return o ? [o] : []; },
    };
    return n;
  };
  let nodes = {};
  function nodeFor(selr, owner) {
    const html = owner.innerHTML || '';
    let key = null, present = false, m;
    if ((m = selr.match(/^\[data-act="([\w-]+)"\]$/))) {
      key = 'act:' + m[1]; present = html.indexOf('data-act="' + m[1] + '"') >= 0;
    } else if ((m = selr.match(/^#([\w-]+)$/))) {
      key = 'id:' + m[1]; present = html.indexOf('id="' + m[1] + '"') >= 0;
    } else if ((m = selr.match(/^\.([\w-]+)$/))) {
      key = 'cls:' + m[1]; present = html.indexOf('class="' + m[1] + '"') >= 0;
    }
    if (!key) return null;
    if (nodes[key]) return nodes[key];
    if (!present) return null;
    const n = el('el');
    const idm = key.match(/^id:(.+)$/);
    if (idm) {
      n._attrs.id = idm[1];
      if (idm[1] === 'dlg-newyear') n.value = deps._typed;
    }
    const am = key.match(/^act:(.+)$/);
    if (am) n._attrs['data-act'] = am[1];
    nodes[key] = n;
    return n;
  }

  let created = null;
  const documentStub = {
    body: { appendChild: () => {} },
    createElement: (t) => { created = el(t); return created; },
    addEventListener: () => {}, removeEventListener: () => {},
    getElementById: (id) => (id === 'ingest-file' ? fileInput : null),
    querySelector: () => null, querySelectorAll: () => [],
  };
  let fileInput = null;

  const realEngine = new Function('PAYLOAD',
    ESC + grabDecl(SRC, 'DERIVED_COLS') + '\n' +
    ['parseCsvRows', 'normIngestKey', 'ingestComputed', 'totalRowFlags',
     'isStrictTotalRowLabel', 'isSplitCell', 'cellText', 'cellCount', 'cellPct',
     'rawNum', 'parseNumericInput', 'formatIngestValue', 'buildIngestImport',
     'getTableSchema', 'getTableBody', 'csvField', 'ingestTemplateSource',
     'compareTableIds', 'ingestStagedSummary']
      .map(n => grab(SRC, n)).join('\n') +
    '\nreturn { parseCsvRows, buildIngestImport, getTableSchema, getTableBody,' +
    ' ingestStagedSummary, compareTableIds };')(PAYLOAD);

  const deps = {
    document: documentStub,
    escapeHtml: (x) => String(x == null ? '' : x).replace(/&/g, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    SHORT_TITLES: ST,
    allYears: () => (PAYLOAD.meta.years || []).slice(),
    compareTableIds: realEngine.compareTableIds,
    getTableSchema: realEngine.getTableSchema,
    parseCsvRows: realEngine.parseCsvRows,
    buildIngestImport: (rows, schema, draft, tableId) => {
      calls.push('buildIngestImport');
      return realEngine.buildIngestImport(rows, schema, draft, tableId);
    },
    ingestStagedSummary: realEngine.ingestStagedSummary,
    renderIngestImportBar: new Function(grab(SRC, 'renderIngestImportBar') +
      '\nreturn renderIngestImportBar;')(),
    buildIngestWorkbook: () => { calls.push('buildIngestWorkbook');
      return { bytes: new Uint8Array([1, 2, 3]), sheetName: 'A.1 Incentive $' }; },
    downloadBinaryFile: (name, bytes, mime) => {
      calls.push('download:' + name + ':' + bytes.length + 'B:' + mime); },
    downloadTextFile: (name, csv, mime, bom) => {
      calls.push('download:' + name + ':bom=' + !!bom);
    },
    validateReportingYear: new Function('allYears',
      grab(SRC, 'validateReportingYear') + '\nreturn validateReportingYear;')(
      () => (PAYLOAD.meta.years || []).slice()),
    addReportingYear: (raw) => {
      calls.push('addReportingYear');
      const v = deps.validateReportingYear(raw);
      if (!v.ok) return v;
      deps.state.ingest.year = v.year;
      deps.state.ingest.schema = realEngine.getTableSchema(
        PAYLOAD.tables[deps.state.ingest.tableId], v.year);
      deps.state.ingest.draft = [];   // a new year has no rows
      return { ok: true, year: v.year };
    },
    applyIngestImport: (res) => {
      calls.push('applyIngestImport');
      deps.state.ingest.draft = res.candidate;
      return true;
    },
    loadIngestDraft: () => { calls.push('loadIngestDraft'); },
    rerenderIngestAll: () => { calls.push('rerenderIngestAll'); },
    wireIngestStaging: new Function('document', 'parseCsvRows', 'buildIngestImport', 'FileReader',
      grab(SRC, 'wireIngestStaging') + '\nreturn wireIngestStaging;')(
      documentStub, realEngine.parseCsvRows,
      (rows, schema, draft, tableId) => {
        calls.push('dryRun');
        return realEngine.buildIngestImport(rows, schema, draft, tableId);
      },
      function FR() {
        const r = this;
        r.readAsText = (f) => { r.result = f._text; r.onload && r.onload(); };
        return r;
      }),
    showToast: () => {},
    confirm: () => true,
    state: { payload: PAYLOAD, ingest: { sectionId: 'A', tableId: 'A1', year: '2025',
      dirty: false, schema: null, draft: [] } },
    _typed: '2026',
  };
  const keys = Object.keys(deps).filter(k => k[0] !== '_');
  const openDlg = () => new Function(...keys,
    grab(SRC, 'openAddYearDialog') + '\nreturn openAddYearDialog;')(...keys.map(k => deps[k]))();

  // the file input the staging wiring binds to
  const newFileInput = () => { fileInput = el('input'); return fileInput; };
  const dropFile = (name, text) => {
    fileInput._on.change[0]({ target: { files: [{ name: name, _text: text }], value: '' } });
  };

  // ---- 1. OPEN: one step, everything live --------------------------------
  newFileInput(); calls = [];
  openDlg();
  dialogStates.open = created.innerHTML;
  const H = dialogStates.open;
  ok(/<h3 id="dlg-title">Add New Year<\/h3>/.test(H), 'one dialog, titled Add New Year');
  ok(/id="dlg-newyear"/.test(H) && /value="2026"/.test(H), 'the year input, suggesting 2026');
  ok(/Existing years: 2025, 2024, 2023/.test(H), 'with the existing-years hint');
  ok(/id="dlg-section"/.test(H) && /id="dlg-table"/.test(H), 'Section and Table, present');
  ok(/id="ingest-file"/.test(H) && /id="ingest-template"/.test(H), 'and both import controls');
  ok(!/ disabled/.test(H), 'NOTHING is disabled: every control is live');
  ok(!/is-disabled/.test(H), 'and nothing is greyed');
  ok(!/id="dlg-stagedbox"/.test(H), 'with no staged file yet');
  ok(/data-act="cancel"/.test(H) && /data-act="addyear"/.test(H),
     'the footer offers Cancel and Add Year');
  ok((H.match(/data-act="/g) || []).length === 2, 'and one primary action, not two');

  // ---- 2. TEMPLATE: live from the start, uses the typed year --------------
  created.querySelector('#ingest-template')._on.click[0]();
  ok(calls.indexOf('buildIngestWorkbook') >= 0, 'the template button is wired from the start');
  ok(calls.some(c => /^download:A1-2026-template\.xlsx:3B:.*spreadsheetml\.sheet$/.test(c)),
     'and downloads the WORKBOOK for the selected table and the TYPED year: ' +
     calls.filter(c => c.indexOf('download:') === 0).join(','));

  // ---- 3. STAGING: a file is described, not applied -----------------------
  const goodCsv = 'Program Name,Total Funds Expended ($),DAC Funding ($)\r\n' +
    '"AMEEP - Electric & Gas",40000000,36000000\r\n' +
    '"Clean Heat – C&I ASHP",7000000,3100000\r\n';
  /* Point the DIALOG at a different table than the page, so "the page is
   * pointed at the chosen table" is observable. With both on A1 the assignment
   * is a no-op and removing it changes nothing measurable, which is how that
   * mutation slipped through the first time. */
  deps.state.ingest.tableId = 'A5';
  created.querySelector('#dlg-table')._on.change[0]({ target: { value: 'A1' } });
  ok(deps.state.ingest.tableId === 'A5',
     'the page stays on its own table while the dialog shows another');
  calls = [];
  const draftBefore = deps.state.ingest.draft;
  dropFile('a1-2026.csv', goodCsv);
  ok(calls.indexOf('dryRun') >= 0, 'choosing a file runs the dry run');
  ok(calls.indexOf('applyIngestImport') < 0, 'and does NOT apply it');
  ok(deps.state.ingest.draft === draftBefore, 'the draft is untouched by staging');
  ok(calls.indexOf('addReportingYear') < 0, 'and no year was added');
  dialogStates.staged = created.innerHTML;
  ok(/id="dlg-stagedbox"/.test(dialogStates.staged), 'the staged box appears');
  ok(/a1-2026\.csv/.test(dialogStates.staged), 'naming the file');
  ok(/2 rows, 2 matching columns, 4 values ready to import/.test(dialogStates.staged),
     'with a one-line summary of what it holds');
  ok(!/is-bad/.test(dialogStates.staged), 'and not flagged bad');

  // ---- 4. ADD YEAR with a staged file: add BEFORE apply -------------------
  calls = [];
  created.querySelector('[data-act="addyear"]')._on.click[0]();
  const iAdd = calls.indexOf('addReportingYear');
  const iApply = calls.indexOf('applyIngestImport');
  ok(iAdd >= 0, 'Add Year added the year');
  ok(iApply >= 0, 'and applied the staged file');
  ok(iAdd < iApply, 'IN THAT ORDER: the add precedes the apply');
  ok(deps.state.ingest.year === '2026', 'the page is on the new year');
  ok(deps.state.ingest.tableId === 'A1',
     'and moved to the table the DIALOG chose, not the one it was on: ' +
     deps.state.ingest.tableId);
  ok(deps.state.ingest.draft && deps.state.ingest.draft.length === 2,
     'the draft holds the imported rows: ' +
     (deps.state.ingest.draft || []).length);
  ok(deps.state.ingest.importResult && deps.state.ingest.importResult.ok,
     'the result is recorded for the page panel');
  ok(calls.indexOf('modal.remove') >= 0, 'the dialog closed');
  ok(calls.indexOf('rerenderIngestAll') > calls.indexOf('modal.remove'),
     'and the page redrew after it');

  // ---- 5. INVALID YEAR: nothing happens ----------------------------------
  deps.state.ingest = { sectionId: 'A', tableId: 'A1', year: '2025', dirty: false,
    schema: null, draft: [] };
  deps._typed = '1999';
  newFileInput(); calls = [];
  openDlg();
  /* Change the dialog's Section to something the page is NOT on, so "nothing
   * moved" is observable. With both on A the assignment is a no-op and a
   * mutation that hoists it above validation changes nothing measurable, which
   * is exactly how it slipped through the first time. */
  created.querySelector('#dlg-section')._on.change[0]({ target: { value: 'B' } });
  ok(deps.state.ingest.sectionId === 'A' && deps.state.ingest.tableId === 'A1',
     'changing the dialog Section does NOT move the page: cancel is free');
  created.querySelector('[data-act="addyear"]')._on.click[0]();
  ok(calls.indexOf('addReportingYear') < 0, 'an invalid year adds nothing');
  ok(calls.indexOf('buildIngestImport') < 0, 'imports nothing');
  ok(calls.indexOf('modal.remove') < 0, 'and does not close the dialog');
  ok(deps.state.ingest.year === '2025', 'the page year is untouched');
  ok(deps.state.ingest.sectionId === 'A' && deps.state.ingest.tableId === 'A1',
     'and so are its section and table: an invalid year moves NOTHING');
  const errN = created.querySelector('#dlg-error');
  ok(errN && /between 2000 and 2100/.test(errN.textContent),
     'with the error shown on the field: ' + (errN && errN.textContent));

  // an EXISTING year is rejected the same way
  deps._typed = '2024';
  newFileInput(); calls = [];
  openDlg();
  created.querySelector('[data-act="addyear"]')._on.click[0]();
  ok(calls.indexOf('addReportingYear') < 0, 'an existing year adds nothing either');
  ok(/2024 already exists/.test(created.querySelector('#dlg-error').textContent),
     'and says so');

  // ---- 6. ADD YEAR with NO staged file -----------------------------------
  deps.state.ingest = { sectionId: 'A', tableId: 'A1', year: '2025', dirty: false,
    schema: null, draft: [] };
  deps._typed = '2027';
  newFileInput(); calls = [];
  openDlg();
  created.querySelector('[data-act="addyear"]')._on.click[0]();
  ok(calls.indexOf('addReportingYear') >= 0, 'the year is added');
  ok(calls.indexOf('buildIngestImport') < 0, 'nothing is imported');
  ok(!deps.state.ingest.importResult, 'and no result panel is set');
  ok(calls.indexOf('modal.remove') >= 0, 'the dialog closes');
  ok(calls.indexOf('rerenderIngestAll') >= 0, 'and the page redraws with the new year');

  // ---- 7. STAGED FILE THAT HARD-REJECTS: year still added ----------------
  deps.state.ingest = { sectionId: 'A', tableId: 'A1', year: '2025', dirty: false,
    schema: null, draft: [] };
  deps._typed = '2028';
  newFileInput(); calls = [];
  openDlg();
  dropFile('bad.csv', 'Program Name,DAC Funding ($)\r\n"AMEEP - Electric & Gas",=SUM(B2:B9)\r\n');
  dialogStates.stagedBad = created.innerHTML;
  ok(/is-bad/.test(dialogStates.stagedBad), 'a hard-rejecting file is flagged bad at staging');
  ok(/cannot be imported/.test(dialogStates.stagedBad), 'saying it cannot be imported');
  ok(/formula/.test(dialogStates.stagedBad), 'and why');
  ok(/Add Year will still add the year/.test(dialogStates.stagedBad),
     'and that the year will still be added');
  calls = [];
  created.querySelector('[data-act="addyear"]')._on.click[0]();
  ok(calls.indexOf('addReportingYear') >= 0, 'Add Year STILL adds the year');
  ok(deps.state.ingest.year === '2028', 'and the page moves to it');
  ok(calls.indexOf('applyIngestImport') < 0, 'nothing is applied');
  ok(deps.state.ingest.importResult && !deps.state.ingest.importResult.ok,
     'the failure is recorded for the page panel');
  ok((deps.state.ingest.importResult.rejections || []).length > 0,
     'with its reasons: ' + (deps.state.ingest.importResult.rejections || [])
       .map(r => r.why).join(' ').slice(0, 60));
  ok(calls.indexOf('modal.remove') >= 0, 'and the dialog closes');
}

/* ---------- renders, from the shipped code ------------------------------- */
fs.mkdirSync(OUT, { recursive: true });
const shell = (title, note, body) => '<!doctype html><meta charset="utf-8"><title>' +
  title + '</title><link rel="stylesheet" href="../../../ExecutiveDashboard_dev/styles.css">' +
  '<style>body{margin:0;background:var(--white-smoke)}.w{padding:18px 24px 40px}' +
  '.n{font:12px/1.5 system-ui;color:#2A5A34;background:#E8F5E9;border:1px solid #A5D6A7;' +
  'border-radius:6px;padding:8px 12px;margin:0 0 16px}</style><body><div class="w">' +
  '<div class="n"><strong>From the shipped code.</strong> ' + note + '</div>' + body +
  '</div></body>';

const secOpts = (cur) => Object.entries(PAYLOAD.sections).map(([l, sc]) =>
  '<option' + (l === cur ? ' selected' : '') + '>' + l + '. ' + sc.full_name +
  '</option>').join('');
const yrOpts = (cur) => (PAYLOAD.meta.years || []).map(y =>
  '<option' + (y === cur ? ' selected' : '') + '>' + y + '</option>').join('');

const pickerFor = (sec, active) =>
  '<div class="page-header" style="display:flex;justify-content:space-between;' +
  'align-items:flex-start"><div><h1>Report Data</h1>' +
  '<p class="page-sub">Enter or update values for any table, by year. Edits are ' +
  'saved to your browser and applied to the dashboard.</p></div>' +
  '<button class="btn btn-primary" type="button">Add New Year</button></div>' +
  '<div class="ingest-picker">' +
  '<div class="ingest-picker-field"><label>Section</label>' +
  '<select class="ingest-select">' + secOpts(sec) + '</select></div>' +
  '<div class="ingest-picker-field"><label>Year</label>' +
  '<div class="ingest-year-row"><select class="ingest-select">' + yrOpts('2025') +
  '</select></div></div></div>' +
  '<div class="ingest-srctables">' +
  '<div class="ingest-srctables-label">Source Tables</div>' +
  renderRow(tablesIn(sec), active, { attr: 'data-ingest-table' }) + '</div>';

fs.writeFileSync(path.join(OUT, '1-picker-source-tables.html'),
  shell('Picker row with Source Tables tabs',
    'The row comes from renderSrcTabRow, the same call the shipped page makes. ' +
    'Section A, ten tables. The header button now says Add New Year.',
    pickerFor('A', 'A1')));

fs.writeFileSync(path.join(OUT, '1b-picker-few-tables.html'),
  shell('Picker row: sections with few tables',
    'Ruling 1: the EXACT rule is reused, so few tables render exactly as the report ' +
    'pages render them, at repeat(10, 1fr). B has two tables, I has one.',
    '<h3 style="font:600 13px system-ui">B, two tables</h3>' + pickerFor('B', 'B1') +
    '<hr style="margin:28px 0">' +
    '<h3 style="font:600 13px system-ui">I, one table</h3>' + pickerFor('I', 'I1') +
    '<hr style="margin:28px 0">' +
    '<h3 style="font:600 13px system-ui">The same section on a REPORT page, for comparison</h3>' +
    renderRow(tablesIn('B'), 'B1')));

/* The dialog renders are the SAME strings the assertions above checked, so a
 * render and its assertion cannot disagree. Round 3 has TWO stages, not three
 * states: the choice and Edit renders are DELETED rather than left behind
 * showing a flow that no longer exists. */
const dlgShell = (t, html) => shell(t,
  'This is the innerHTML the shipped openAddYearDialog built, captured from the ' +
  'driven dialog above.',
  '<div class="ingest-modal-overlay" style="position:static;background:transparent;' +
  'padding:0">' +
  html.replace('class="ingest-modal"', 'class="ingest-modal" style="margin:0"') +
  '</div>');
fs.writeFileSync(path.join(OUT, '2-dialog-one-step.html'),
  dlgShell('The one step, as it opens: every control live', dialogStates.open));
fs.writeFileSync(path.join(OUT, '3-dialog-file-staged.html'),
  dlgShell('The same dialog with a file staged, ready for Add Year',
    dialogStates.staged));
fs.writeFileSync(path.join(OUT, '4-dialog-file-rejected.html'),
  dlgShell('A staged file that cannot be imported: the year is still added',
    dialogStates.stagedBad));
['2-dialog-choice.html', '3-dialog-edit-path.html', '4-dialog-add-path.html',
 '2-dialog-add-year.html', '3-dialog-fill-year.html',
 '2-dialog-before-add.html', '3-dialog-after-add.html'].forEach(f => {
  const old = path.join(OUT, f);
  if (fs.existsSync(old)) fs.unlinkSync(old);
});

/* The top bar, built from the SHIPPED html with syncTopbarYear's own rule
 * applied, rather than from a hand-written copy of the header. */
{
  const head = HTML.slice(HTML.indexOf('<header class="topbar">'),
                          HTML.indexOf('</header>') + 9)
    .replace('id="crumb-current">Loading…', 'id="crumb-current">Report Data')
    .replace('<img src="logo/ConEd_Logo_fondo_blanco.jpeg" alt="Con Edison">', '')
    .replace('<select id="year-select" class="year-select" aria-label="Reporting year"></select>',
      '<select class="year-select">' + yrOpts('2025') + '</select>');
  const hidden = head
    .replace('<span class="year-label">Reporting Year</span>',
             '<span class="year-label" hidden>Reporting Year</span>')
    .replace('<select class="year-select">', '<select class="year-select" hidden>');
  fs.writeFileSync(path.join(OUT, '5-topbar.html'),
    shell('Top bar: Export PDF gone, Reporting Year per route',
      'Both bars are the SHIPPED header markup. Export PDF is already absent from ' +
      'it, at every route. The second applies syncTopbarYear’s rule for the ' +
      'Report Data route.',
      '<h3 style="font:600 13px system-ui">Every page except Report Data</h3>' +
      head.replace('<header class="topbar">',
                   '<header class="topbar" style="position:static">') +
      '<h3 style="font:600 13px system-ui;margin-top:24px">Report Data</h3>' +
      hidden.replace('<header class="topbar">',
                     '<header class="topbar" style="position:static">')));
}

lines.push('');
lines.push('renders regenerated from the shipped code:');
['1-picker-source-tables.html', '1b-picker-few-tables.html',
 '2-dialog-one-step.html', '3-dialog-file-staged.html',
 '4-dialog-file-rejected.html', '5-topbar.html']
  .forEach(f => lines.push('   ' + f));


lines.push('');
lines.push('======================================================================');
lines.push('  ' + pass + ' passed, ' + fail + ' failed');
lines.push('======================================================================');
const out = lines.join('\n');
console.log(out);
fs.writeFileSync(path.join(__dirname, 'suite-round2-output.txt'), out + '\n');
process.exitCode = fail ? 1 : 0;
