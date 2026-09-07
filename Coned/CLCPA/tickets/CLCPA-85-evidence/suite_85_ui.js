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
lines.push('=== round 3: the dialog is SINGLE PURPOSE ===');
{
  const dlg = grab(SRC, 'openAddYearDialog');
  ok(!!dlg, 'the Add New Year dialog exists');
  ok(/id="ingest-addyear" type="button">Add New Year</.test(SRC),
     'the page header button says Add New Year, in title case');
  ok(/addYear\.addEventListener\('click', openAddYearDialog\)/.test(grab(SRC, 'wireIngestPage')),
     'and it opens that dialog');

  /* INVERTED from round 2. These pinned the choice state and the Edit path
   * present; they now pin them ABSENT, per the round 3 cut. */
  ok(SRC.indexOf('openAddEditDialog') < 0, 'the two-path dialog is gone by name');
  ok(SRC.indexOf('bodyChoice') < 0, 'the choice state is gone');
  ok(SRC.indexOf('bodyEdit') < 0, 'and the Edit panel with it');
  ok(SRC.indexOf('data-go=') < 0, 'no choice buttons remain in the markup');
  ok(SRC.indexOf('Edit Existing Data') < 0, 'nor its label');
  ok(SRC.indexOf('Open For Editing') < 0, 'nor its confirm button');
  ok(SRC.indexOf('ingest-adddata') < 0, 'nor the old button id');
  ok(SRC.indexOf('Add or Edit Data') < 0,
     'and no comment still names the old dialog, which would mislead the next reader');
  const css = fs.readFileSync(path.join(REPO, CSS_REL), 'utf8');
  ok(!/\.ingest-choice/.test(css), 'the choice-state CSS is deleted, not left orphaned');

  /* the RECORDED CONSEQUENCE: the engine still supports an existing year, only
   * the door is gone. Asserted so re-exposing it stays a small change. */
  /* Corrected: my first two attempts here asserted the absence of the WORD
   * "year", which the dialog uses legitimately ("Existing years: ...") and the
   * engine uses in an error message. What actually matters is that the only
   * year the dialog can produce is a NEW one, and that the engine takes no
   * year at all. */
  ok(!/<select id="dlg-year"/.test(dlg) && !/allYears\(\)\.map/.test(dlg),
     'the dialog has no year PICKER, so the only year it yields is the new one');
  const engine = grab(SRC, 'buildIngestImport');
  // grab() keeps the leading indentation, so ^ cannot match "function" directly.
  ok(/^\s*function buildIngestImport\(fileRows, schema, draft, tableId\)/.test(engine),
     'and buildIngestImport takes no year parameter, so the mechanism is year-agnostic');
  ok(!/state\.ingest\.year|i\.year/.test(engine),
     'nor reads one from state, which is why re-exposing an existing year stays small');

  // the shell is still the existing one
  ['ingest-modal-overlay', 'ingest-modal-head', 'ingest-modal-body',
   'ingest-modal-foot', 'ingest-modal-close'].forEach(c => {
    ok(dlg.indexOf(c) >= 0 && BASE_SRC.indexOf(c) >= 0,
       'still reuses the existing shell class ' + c);
  });

  /* TWO STAGES, and the order is load-bearing: the import controls act on
   * state.ingest, so offering them before the year exists would land a file in
   * whatever year the page was showing. */
  ok(/let stage = 'year';/.test(dlg), 'it opens on the year stage');
  ok(/function bodyYear\(\)/.test(dlg) && /function bodyFill\(\)/.test(dlg),
     'and has exactly the two stages');
  const yearBody = dlg.slice(dlg.indexOf('function bodyYear()'), dlg.indexOf('function bodyFill()'));
  ok(!/renderIngestImportBar/.test(yearBody),
     'the import controls are NOT offered before the year exists');
  const fillBody = dlg.slice(dlg.indexOf('function bodyFill()'), dlg.indexOf('function foot()'));
  ok(/renderIngestImportBar\(/.test(fillBody), 'and ARE offered once it does');
  ok(/stage = 'fill';/.test(dlg), 'the stage advances only after the year is added');
  const addBlock = dlg.slice(dlg.indexOf("act('addyear'"));
  ok(addBlock.indexOf('addedYear = res.year;') < addBlock.indexOf("stage = 'fill';"),
     'and only on success, after addReportingYear returns ok');
  ok(/if \(!res\.ok\) \{[\s\S]{0,120}return; \}/.test(addBlock),
     'a rejected year keeps the dialog on the year stage with its error');

  // Section AND Table in the fill stage, per the ruling
  ok(/id="dlg-section"/.test(fillBody), 'the fill stage offers Section');
  ok(/id="dlg-table"/.test(fillBody), 'and Table');
  ok(/addedYear \+ ' has been added/.test(fillBody), 'and says the year was added');

  // the page's state changes in ONE place, funnelled as the pickers are
  ok(/function applySelection\(\)/.test(dlg), 'the selection is applied in one place');
  ok(/state\.ingest\.tableId = sel\.tableId;[\s\S]{0,60}loadIngestDraft\(\);/.test(dlg),
     'through loadIngestDraft, exactly as the picker handlers do');
  ok(/beforeRead: applySelection/.test(dlg),
     'applied BEFORE the file is read, so the import lands on the chosen table');
  ok(/afterImport: \(\) => \{ close\(\); rerenderIngestAll\(\); \}/.test(dlg),
     'ruling 4 still holds: the dialog closes after an import, good or bad');
  // a year added but not filled still has to reach the page
  ok(/if \(addedYear\) rerenderIngestAll\(\);/.test(dlg),
     'closing after adding a year redraws the page, so the year is not lost');

  // closes three ways
  ok(/e\.key === 'Escape'/.test(dlg), 'Escape closes it');
  ok(/if \(e\.target === modal\) close\(\)/.test(dlg), 'so does a backdrop click');
  ok(/removeEventListener\('keydown', onEsc\)/.test(dlg),
     'and the Escape handler is removed on close, so handlers cannot accumulate');
}


lines.push('');
lines.push('=== the old add-year modal is GONE, its mechanics kept ===');
{
  ok(SRC.indexOf('function openAddYearModal') < 0, 'the dead modal is deleted');
  ok(SRC.indexOf('add-year-input') < 0 && SRC.indexOf('add-year-confirm') < 0,
     'with its markup');
  ok(BASE_SRC.indexOf('function openAddYearModal') >= 0, 'BASE control: it existed');
  const add = grab(SRC, 'addReportingYear');
  ok(!!add, 'its validation survives as addReportingYear');
  ['Please enter a valid year.', 'Year must be between 2000 and 2100.', 'already exists.']
    .forEach(m => ok(add.indexOf(m) >= 0 && BASE_SRC.indexOf(m) >= 0,
      'same message as before: "' + m + '"'));
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
lines.push('=== round 3: the dialog, EXECUTED against a DOM stub ===');
/* The stage bodies are closures over the dialog's own stage and selection, so
 * rather than read their source the REAL openAddYearDialog is driven: a minimal
 * document stub captures the modal it builds, and the real buttons are clicked.
 * What follows is the shipped dialog's own output. */
const dialogStates = {};
{
  let stubCache = {};
  const el = (tag) => {
    const node = {
      tagName: tag, className: '', children: [], _on: {},
      set innerHTML(v) { this._html = v; stubCache = {}; },
      get innerHTML() { return this._html === undefined ? '' : this._html; },
      hidden: false, value: '', textContent: '', style: {},
      addEventListener: (k, fn) => { (node._on[k] = node._on[k] || []).push(fn); },
      removeEventListener: () => {},
      remove: () => {},
      appendChild: (c) => { node.children.push(c); return c; },
      removeChild: () => {},
      focus: () => {},
      querySelector: (selr) => findIn(node.innerHTML, selr),
      querySelectorAll: (selr) => { const o = findIn(node.innerHTML, selr); return o ? [o] : []; },
      getAttribute: () => null,
    };
    return node;
  };
  /* Memoised by identity: without this the dialog registered handlers on
   * throwaway stubs and a later lookup found nodes with no listeners. */
  const stubFor = (attrs) => {
    const key = JSON.stringify(attrs);
    if (stubCache[key]) return stubCache[key];
    const n = el('button');
    n.getAttribute = (k) => (attrs[k] === undefined ? null : attrs[k]);
    if (attrs.id === 'dlg-newyear') n.value = '2026';
    stubCache[key] = n;
    return n;
  };
  function findIn(html, selr) {
    let m;
    if ((m = selr.match(/^\[data-act="(\w+)"\]$/))) {
      return html.indexOf('data-act="' + m[1] + '"') >= 0 ? stubFor({ 'data-act': m[1] }) : null;
    }
    if ((m = selr.match(/^#([\w-]+)$/))) {
      return html.indexOf('id="' + m[1] + '"') >= 0 ? stubFor({ id: m[1] }) : null;
    }
    if ((m = selr.match(/^\.([\w-]+)$/))) {
      return html.indexOf('class="' + m[1] + '"') >= 0 ? stubFor({ cls: m[1] }) : null;
    }
    return null;
  }

  const body = el('body');
  let created = null;
  const documentStub = {
    body: body,
    createElement: (t) => { created = el(t); return created; },
    addEventListener: () => {}, removeEventListener: () => {},
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  };

  const deps = {
    document: documentStub,
    escapeHtml: (x) => String(x == null ? '' : x).replace(/&/g, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    SHORT_TITLES: ST,
    allYears: () => (PAYLOAD.meta.years || []).slice(),
    compareTableIds: (x, y) => parseInt(x.slice(1), 10) - parseInt(y.slice(1), 10),
    renderIngestImportBar: new Function(grab(SRC, 'renderIngestImportBar') +
      '\nreturn renderIngestImportBar;')(),
    loadIngestDraft: () => { deps._loaded = (deps._loaded || 0) + 1; },
    rerenderIngestAll: () => { deps._redrawn = (deps._redrawn || 0) + 1; },
    addReportingYear: (raw) => {
      deps._addArg = raw;
      if (deps._failNext) { deps._failNext = false; return { ok: false, error: 'nope' }; }
      return { ok: true, year: String(raw) };
    },
    confirm: () => true,
    state: { payload: PAYLOAD, ingest: { sectionId: 'A', tableId: 'A1', year: '2025', dirty: false } },
    wireIngestImport: (h) => { deps._hooks = h; },
  };
  const keys = Object.keys(deps).filter(k => k[0] !== '_');
  const open = new Function(...keys,
    grab(SRC, 'openAddYearDialog') + '\nreturn openAddYearDialog;')(...keys.map(k => deps[k]));

  // ---- stage one: the year -----------------------------------------------
  open();
  ok(!!created, 'the dialog created a node and appended it to the body');
  ok(created.className === 'ingest-modal-overlay',
     'using the existing overlay class: ' + created.className);
  dialogStates.year = created.innerHTML;
  ok(/<h3 id="dlg-title">Add New Year<\/h3>/.test(dialogStates.year),
     'it opens DIRECTLY on Add New Year, with no choice screen');
  ok(!/ingest-choice/.test(dialogStates.year), 'and no choice buttons');
  ok(!/Edit Existing Data/.test(dialogStates.year), 'and no Edit path');
  ok(/id="dlg-newyear"/.test(dialogStates.year), 'with the year input');
  ok(/value="2026"/.test(dialogStates.year), 'suggesting the next year: 2026');
  ok(/Existing years: 2025, 2024, 2023/.test(dialogStates.year), 'and listing the existing ones');
  ok(/A new year appears in the year selector everywhere/.test(dialogStates.year),
     'stating that a year is GLOBAL');
  ok(/Every table starts empty/.test(dialogStates.year), 'and that every table starts empty');
  ok(!/ingest-import-bar/.test(dialogStates.year),
     'and NOT offering the import before the year exists, which would target the wrong year');
  ok(!/id="dlg-section"/.test(dialogStates.year) && !/id="dlg-table"/.test(dialogStates.year),
     'nor the section and table pickers yet');

  // a REJECTED year keeps the dialog where it is
  deps._failNext = true;
  created.querySelector('[data-act="addyear"]')._on.click[0]();
  ok(/<h3 id="dlg-title">Add New Year<\/h3>/.test(created.innerHTML),
     'a rejected year leaves the dialog on the year stage');
  ok(!/ingest-import-bar/.test(created.innerHTML), 'with the import still not offered');

  // ---- stage two: fill ----------------------------------------------------
  created.querySelector('[data-act="addyear"]')._on.click[0]();
  ok(deps._addArg === '2026', 'Add Year passes the entered year to addReportingYear');
  dialogStates.fill = created.innerHTML;
  ok(/<h3 id="dlg-title">Fill 2026<\/h3>/.test(dialogStates.fill),
     'success advances to the fill stage, titled for the new year');
  ok(/2026 has been added/.test(dialogStates.fill), 'saying the year was added');
  ok(/id="dlg-section"/.test(dialogStates.fill), 'the fill stage offers Section');
  ok(/id="dlg-table"/.test(dialogStates.fill), 'and Table');
  ok(/ingest-import-bar/.test(dialogStates.fill), 'and the import controls');
  ok(/id="ingest-template"/.test(dialogStates.fill), 'including the template download');
  ok(/The template for 2026 carries the row labels/.test(dialogStates.fill),
     'with the new-year template note, naming the year');
  ok(/Done<\/button>/.test(dialogStates.fill), 'and a Done action');

  /* CANCEL IS FREE, checked behaviourally.
   *
   * A source check for `let sel = { ... }` passed under a mutation that aliased
   * sel to state.ingest and left the old literal in place unused. So the real
   * test: change the dialog's Section and assert the PAGE has not moved. */
  const pageSectionBefore = deps.state.ingest.sectionId;
  const pageTableBefore = deps.state.ingest.tableId;
  const secSel = created.querySelector('#dlg-section');
  ok(!!secSel, 'the fill stage has a section select to change');
  secSel._on.change[0]({ target: { value: 'B' } });
  ok(deps.state.ingest.sectionId === pageSectionBefore &&
     deps.state.ingest.tableId === pageTableBefore,
     'changing the dialog Section does NOT move the page: cancel is free');
  ok(/B\. /.test(created.innerHTML), 'though the dialog itself did follow the change');
  // put it back so the later assertions describe the same target
  created.querySelector('#dlg-section')._on.change[0]({ target: { value: 'A' } });

  // the import hooks are handed over, and beforeRead applies the selection
  ok(deps._hooks && typeof deps._hooks.beforeRead === 'function' &&
     typeof deps._hooks.afterImport === 'function', 'the import is wired with both hooks');
  const loadedBefore = deps._loaded || 0;
  deps._hooks.beforeRead();
  ok((deps._loaded || 0) === loadedBefore + 1,
     'beforeRead applies the selection through loadIngestDraft');
  ok(deps.state.ingest.tableId === 'A1', 'landing on the table the dialog shows');

  // closing after adding a year redraws the page, so the year is not lost
  const redrawnBefore = deps._redrawn || 0;
  created.querySelector('[data-act="done"]')._on.click[0]();
  ok((deps._redrawn || 0) === redrawnBefore + 1,
     'Done redraws the page, because a year was added even if nothing was filled');
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
fs.writeFileSync(path.join(OUT, '2-dialog-add-year.html'),
  dlgShell('Dialog stage 1: Add New Year', dialogStates.year));
fs.writeFileSync(path.join(OUT, '3-dialog-fill-year.html'),
  dlgShell('Dialog stage 2: Fill the new year', dialogStates.fill));
['2-dialog-choice.html', '3-dialog-edit-path.html', '4-dialog-add-path.html'].forEach(f => {
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
 '2-dialog-add-year.html', '3-dialog-fill-year.html', '5-topbar.html']
  .forEach(f => lines.push('   ' + f));


lines.push('');
lines.push('======================================================================');
lines.push('  ' + pass + ' passed, ' + fail + ' failed');
lines.push('======================================================================');
const out = lines.join('\n');
console.log(out);
fs.writeFileSync(path.join(__dirname, 'suite-round2-output.txt'), out + '\n');
process.exitCode = fail ? 1 : 0;
