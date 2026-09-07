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
lines.push('=== the Add or Edit Data dialog ===');
{
  const dlg = grab(SRC, 'openAddEditDialog');
  ok(!!dlg, 'the dialog exists');
  ok(/id="ingest-adddata" type="button">Add or Edit Data</.test(SRC),
     'the page header carries the one button, in title case');
  ok(/addEdit\.addEventListener\('click', openAddEditDialog\)/.test(grab(SRC, 'wireIngestPage')),
     'and it opens the dialog');

  // the shell is REUSED, not redesigned
  ['ingest-modal-overlay', 'ingest-modal-head', 'ingest-modal-body',
   'ingest-modal-foot', 'ingest-modal-close'].forEach(c => {
    ok(dlg.indexOf(c) >= 0 && BASE_SRC.indexOf(c) >= 0,
       'reuses the existing shell class ' + c);
  });

  // three states, one dialog
  ok(/let mode = 'choice';/.test(dlg), 'it opens on the choice');
  ['bodyChoice', 'bodyEdit', 'bodyAdd'].forEach(f =>
    ok(dlg.indexOf('function ' + f + '(') >= 0, 'it has a ' + f + ' state'));
  ok(/data-go="edit"/.test(dlg) && /data-go="add"/.test(dlg), 'with both paths offered');
  ok(/Edit Existing Data/.test(dlg) && /Add a New Year/.test(dlg), 'named in title case');

  // EDIT path funnels through loadIngestDraft, as the pickers do
  ok(/function applySelection\(\)/.test(dlg), 'the Edit path applies its selection in one place');
  ok(/state\.ingest\.sectionId = sel\.sectionId;[\s\S]{0,200}loadIngestDraft\(\);/.test(dlg),
     'and funnels through loadIngestDraft, exactly as the picker handlers do');
  ok(/act\('open', \(\) => \{[\s\S]{0,200}applySelection\(\);[\s\S]{0,80}close\(\);/.test(dlg),
     'Open For Editing applies, then closes, landing the operator in inline editing');
  // cancelling must change nothing
  ok(/let sel = \{/.test(dlg) && /sectionId: state\.ingest\.sectionId/.test(dlg),
     'the dialog keeps its OWN selection until confirmed, so Cancel changes nothing');

  // ADD path uses the shared mechanics and states the global truth
  ok(/addReportingYear\(/.test(dlg), 'the Add path calls the shared add-year mechanics');
  ok(/A new year appears in the year selector everywhere/.test(dlg),
     'and states that a year is GLOBAL');
  ok(/Every table[\s\S]{0,60}starts empty/.test(dlg),
     'and that every table starts empty, which is the per-table truth');

  // the import controls live here
  ok(/renderIngestImportBar\(\)/.test(dlg), 'the Edit path carries the import controls');
  ok(/renderIngestImportBar\('The template for a brand new year/.test(dlg),
     'and the Add path carries them with the new-year template note');
  ok(/wireIngestImport\(\{/.test(dlg), 'wired from inside the dialog');
  ok(/beforeRead: \(\) => \{ if \(mode === 'edit'\) applySelection\(\); \}/.test(dlg),
     'the target is applied BEFORE the file is read, so it lands where chosen');
  ok(/afterImport: \(\) => \{ close\(\); rerenderIngestAll\(\); \}/.test(dlg),
     'and the dialog closes after, good import or bad');

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
  ok((SRC.match(/renderIngestImportBar\(/g) || []).length === 3,
     'the bar has one definition and two dialog callers');
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
lines.push('=== the dialog, EXECUTED against a DOM stub ===');
/* The three body states are closures over the dialog's own mode and selection,
 * which is why they are not module-level functions. So instead of reading their
 * source, the REAL openAddEditDialog is driven: a minimal document stub captures
 * the modal it builds, and the buttons it wires are clicked. What follows is the
 * shipped dialog's own output, not a mockup of it. */
const dialogStates = {};
{
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
      // Query the innerHTML string, which is what the dialog actually builds.
      querySelector: (selr) => findIn(node.innerHTML, selr, node),
      querySelectorAll: (selr) => findAllIn(node.innerHTML, selr, node),
      getAttribute: () => null,
    };
    return node;
  };
  /* Tag stubs: the dialog only needs to attach handlers and read .value, so a
   * match returns a stub carrying the attribute that identified it. */
  /* MEMOISED by identity. Without this, querySelectorAll returned fresh stubs
   * on every call, so the dialog registered its handlers on throwaway objects
   * and the test's later lookup found nodes with no listeners. The cache is
   * cleared whenever the dialog redraws, which is what really happens. */
  let stubCache = {};
  const stubFor = (attrs) => {
    const key = JSON.stringify(attrs);
    if (stubCache[key]) return stubCache[key];
    const n = el('button');
    n._attrs = attrs;
    n.getAttribute = (k) => (attrs[k] === undefined ? null : attrs[k]);
    stubCache[key] = n;
    return n;
  };
  function findAllIn(html, selr, owner) {
    const out = [];
    const dataGo = /^\[data-go\]$/.test(selr);
    if (dataGo) {
      (html.match(/data-go="(\w+)"/g) || []).forEach(m => {
        out.push(stubFor({ 'data-go': m.match(/"(\w+)"/)[1] }));
      });
      return out;
    }
    const one = findIn(html, selr, owner);
    return one ? [one] : [];
  }
  function findIn(html, selr, owner) {
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
    getElementById: () => null,
    querySelector: () => null, querySelectorAll: () => [],
  };

  const deps = {
    document: documentStub,
    escapeHtml: (x) => String(x == null ? '' : x).replace(/&/g, '&amp;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    SHORT_TITLES: ST,
    allYears: () => (PAYLOAD.meta.years || []).slice(),
    compareTableIds: (a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10),
    getTableBody: (t, y) => ((t && t.data) || {})[y] || [],
    renderIngestImportBar: new Function(grab(SRC, 'renderIngestImportBar') +
      '\nreturn renderIngestImportBar;')(),
    loadIngestDraft: () => { deps._loaded = (deps._loaded || 0) + 1; },
    rerenderIngestAll: () => { deps._redrawn = (deps._redrawn || 0) + 1; },
    addReportingYear: (raw) => { deps._added = raw; return { ok: true, year: String(raw) }; },
    confirm: () => true,
    state: { payload: PAYLOAD, ingest: { sectionId: 'A', tableId: 'A1', year: '2025', dirty: false } },
    wireIngestImport: (h) => { deps._hooks = h; },
  };
  const keys = Object.keys(deps).filter(k => k[0] !== '_');
  const open = new Function(...keys,
    grab(SRC, 'openAddEditDialog') + '\nreturn openAddEditDialog;')(...keys.map(k => deps[k]));

  open();
  ok(!!created, 'the dialog created a node and appended it to the body');
  ok(created.className === 'ingest-modal-overlay',
     'using the existing overlay class: ' + created.className);
  dialogStates.choice = created.innerHTML;
  ok(/<h3 id="dlg-title">Add or Edit Data<\/h3>/.test(dialogStates.choice),
     'it opens titled Add or Edit Data');
  ok((dialogStates.choice.match(/ingest-choice-btn/g) || []).length === 2,
     'offering exactly two paths');
  ok(/<strong>Edit Existing Data<\/strong>/.test(dialogStates.choice) &&
     /<strong>Add a New Year<\/strong>/.test(dialogStates.choice), 'named in title case');
  ok(!/ingest-import-bar/.test(dialogStates.choice),
     'and the import controls are NOT on the choice screen');

  // click through to Edit
  const goBtns = created.querySelectorAll('[data-go]');
  ok(goBtns.length === 2, 'both choice buttons are wired');
  const goEdit = goBtns.filter(b => b.getAttribute('data-go') === 'edit')[0];
  goEdit._on.click[0]();
  dialogStates.edit = created.innerHTML;
  ok(/<h3 id="dlg-title">Edit Existing Data<\/h3>/.test(dialogStates.edit),
     'choosing Edit redraws the dialog into the Edit panel');
  ['dlg-section', 'dlg-table', 'dlg-year'].forEach(id =>
    ok(dialogStates.edit.indexOf('id="' + id + '"') >= 0, 'Edit has its ' + id + ' select'));
  ok(/ingest-import-bar/.test(dialogStates.edit), 'and the import controls');
  ok(/id="ingest-template"/.test(dialogStates.edit), 'including the template download');
  /* Derived from the payload, not hardcoded: I first wrote 25, which is A1's
   * 2023 count, while the dialog opens on 2025 where it is 23. A hint that
   * counts rows must be checked against the count it is describing. */
  const a1_2025 = PAYLOAD.tables['A1'].data['2025'].length;
  ok(dialogStates.edit.indexOf('A1 for 2025 has ' + a1_2025 + ' rows') >= 0,
     'with a hint counting the real rows of the real target: ' + a1_2025);
  ok(/Opening it changes nothing until you save/.test(dialogStates.edit),
     'and saying that opening it changes nothing');
  ok(/Open For Editing/.test(dialogStates.edit), 'and the confirm button');

  // the import hooks were handed over
  ok(deps._hooks && typeof deps._hooks.beforeRead === 'function' &&
     typeof deps._hooks.afterImport === 'function',
     'the dialog wires the import with both hooks');

  // Open For Editing applies the selection through loadIngestDraft and redraws
  const before = deps._loaded || 0;
  created.querySelector('[data-act="open"]')._on.click[0]();
  ok((deps._loaded || 0) === before + 1, 'Open For Editing calls loadIngestDraft exactly once');
  ok((deps._redrawn || 0) === 1, 'and redraws the page once');
  ok(deps.state.ingest.tableId === 'A1' && deps.state.ingest.year === '2025',
     'landing on the chosen target');

  // and the Add panel, from a fresh dialog
  open();
  const goAdd = created.querySelectorAll('[data-go]')
    .filter(b => b.getAttribute('data-go') === 'add')[0];
  goAdd._on.click[0]();
  dialogStates.add = created.innerHTML;
  ok(/<h3 id="dlg-title">Add a New Year<\/h3>/.test(dialogStates.add), 'the Add panel opens');
  ok(/id="dlg-newyear"/.test(dialogStates.add), 'with a year input');
  ok(/value="2026"/.test(dialogStates.add), 'suggesting the next year: 2026');
  ok(/Existing years: 2025, 2024, 2023/.test(dialogStates.add), 'and listing the existing ones');
  ok(/A new year appears in the year selector everywhere/.test(dialogStates.add),
     'stating that a year is GLOBAL');
  ok(/Every table starts empty/.test(dialogStates.add), 'and that every table starts empty');
  ok(/labels from the most recent year that has them, with the values left blank/
     .test(dialogStates.add), 'and what a new year\u2019s template contains');
  ok(/Add Year<\/button>/.test(dialogStates.add), 'with the Add Year action');
}

/* ---------- renders, now from the REAL renderer ------------------------- */
fs.mkdirSync(OUT, { recursive: true });
const shell = (title, note, body) => '<!doctype html><meta charset="utf-8"><title>' +
  title + '</title><link rel="stylesheet" href="../../../ExecutiveDashboard_dev/styles.css">' +
  '<style>body{margin:0;background:var(--white-smoke)}.w{padding:18px 24px 40px}' +
  '.n{font:12px/1.5 system-ui;color:#2A5A34;background:#E8F5E9;border:1px solid #A5D6A7;' +
  'border-radius:6px;padding:8px 12px;margin:0 0 16px}</style><body><div class="w">' +
  '<div class="n"><strong>From the shipped renderer.</strong> ' + note + '</div>' + body +
  '</div></body>';

const secOpts = (cur) => Object.entries(PAYLOAD.sections).map(([l, s]) =>
  '<option' + (l === cur ? ' selected' : '') + '>' + l + '. ' + s.full_name + '</option>').join('');
const yrOpts = (cur) => (PAYLOAD.meta.years || []).map(y =>
  '<option' + (y === cur ? ' selected' : '') + '>' + y + '</option>').join('');

const pickerFor = (sec, active) => `
  <div class="page-header" style="display:flex;justify-content:space-between;align-items:flex-start">
    <div><h1>Report Data</h1>
    <p class="page-sub">Enter or update values for any table, by year. Edits are saved to your browser and applied to the dashboard.</p></div>
    <button class="btn btn-primary" type="button">Add or Edit Data</button>
  </div>
  <div class="ingest-picker">
    <div class="ingest-picker-field"><label>Section</label>
      <select class="ingest-select">${secOpts(sec)}</select></div>
    <div class="ingest-picker-field"><label>Year</label>
      <div class="ingest-year-row"><select class="ingest-select">${yrOpts('2025')}</select></div></div>
  </div>
  <div class="ingest-srctables">
    <div class="ingest-srctables-label">Source Tables</div>
    ${renderRow(tablesIn(sec), active, { attr: 'data-ingest-table' })}
  </div>`;

fs.writeFileSync(path.join(OUT, '1-picker-source-tables.html'),
  shell('Picker row with Source Tables tabs',
    'The row comes from renderSrcTabRow, the same call the shipped page makes. ' +
    'Section A, ten tables.', pickerFor('A', 'A1')));

fs.writeFileSync(path.join(OUT, '1b-picker-few-tables.html'),
  shell('Picker row: sections with few tables',
    'Ruling 1: the EXACT rule is reused, so few tables render exactly as the report ' +
    'pages render them, at repeat(10, 1fr). B has two tables, I has one. This is ' +
    'identity, not a variant.',
    '<h3 style="font:600 13px system-ui">B, two tables</h3>' + pickerFor('B', 'B1') +
    '<hr style="margin:28px 0">' +
    '<h3 style="font:600 13px system-ui">I, one table</h3>' + pickerFor('I', 'I1') +
    '<hr style="margin:28px 0">' +
    '<h3 style="font:600 13px system-ui">The same section on a REPORT page, for comparison</h3>' +
    renderRow(tablesIn('B'), 'B1')));

/* The dialog renders are the SAME strings the assertions above checked, so a
 * render and its assertion cannot disagree. */
const dlgShell = (t, html) => shell(t,
  'This is the innerHTML the shipped openAddEditDialog built, captured from the ' +
  'driven dialog above.',
  '<div class="ingest-modal-overlay" style="position:static;background:transparent;padding:0">' +
  html.replace('class="ingest-modal"', 'class="ingest-modal" style="margin:0"') + '</div>');
fs.writeFileSync(path.join(OUT, '2-dialog-choice.html'),
  dlgShell('Dialog: the opening choice', dialogStates.choice));
fs.writeFileSync(path.join(OUT, '3-dialog-edit-path.html'),
  dlgShell('Dialog: Edit Existing Data', dialogStates.edit));
fs.writeFileSync(path.join(OUT, '4-dialog-add-path.html'),
  dlgShell('Dialog: Add a New Year', dialogStates.add));

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
      head.replace('<header class="topbar">', '<header class="topbar" style="position:static">') +
      '<h3 style="font:600 13px system-ui;margin-top:24px">Report Data</h3>' +
      hidden.replace('<header class="topbar">', '<header class="topbar" style="position:static">')));
}

lines.push('');
lines.push('renders regenerated from the shipped code:');
['1-picker-source-tables.html', '1b-picker-few-tables.html', '2-dialog-choice.html',
 '3-dialog-edit-path.html', '4-dialog-add-path.html', '5-topbar.html']
  .forEach(f => lines.push('   ' + f));

lines.push('');
lines.push('======================================================================');
lines.push('  ' + pass + ' passed, ' + fail + ' failed');
lines.push('======================================================================');
const out = lines.join('\n');
console.log(out);
fs.writeFileSync(path.join(__dirname, 'suite-round2-output.txt'), out + '\n');
process.exitCode = fail ? 1 : 0;
