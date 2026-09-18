/* THE REPORT DATA PAGE, BOOTED AND DRIVEN.
 *
 * Every gesture here is the real one: renderIngestPage() paints into a real
 * node tree, wireIngestEditor() attaches real listeners to real inputs, and a
 * blur is a dispatched blur on the input the operator would have been in. No
 * step reaches past a handler to do its work for it.
 *
 * WHY. Three defects in one wave shipped with green suites -- CLCPA-269's
 * count, CLCPA-278's recompute, CLCPA-276's exits -- and each passed because
 * the suite drove a hand-built slice. A slice cannot see which MOUNT a repaint
 * touched, cannot see a handler that was never attached, and cannot see a
 * value read after the write that should have been read before it. Those are
 * exactly the three bugs. If a reproduction here disagrees with a suite, the
 * suite is wrong.
 *
 * THE WHOLE IIFE BODY IS EVALUATED, not a set of extracted declarations.
 * Slicing by indentation kept producing bodies that parse but do not mean what
 * the file means: `n` sliced into a loop variable, and a cut function left
 * `str` dangling. Every one of those is a way for the harness to differ from
 * the app, which is the one thing it may not do. The body is truncated just
 * before the DOMContentLoaded kickoff so nothing boots itself, and the app's
 * own `state` is handed back so a gesture and an assertion look at one object.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { makeDocument } = require('./live_page.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';

function readApp(rev) {
  if (!rev) return fs.readFileSync(path.join(REPO, REL), 'utf8');
  return execSync('git show ' + rev + ':"' + REL + '"',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
}

/* what the harness hands back to a suite; a name the build cannot find is
 * simply absent rather than fatal, so a suite can ask whether it exists */
const EXPORTS = [
  'renderIngestPage', 'renderIngestPicker', 'renderIngestImport',
  'renderIngestImportResult', 'renderIngestEditor', 'renderIngestHistory',
  'wireIngestPage', 'wireIngestEditor', 'wireIngestStaging',
  'rerenderIngestEditor', 'rerenderIngestAll', 'rerenderIngestHistory',
  'refreshIngestNotices', 'refreshIngestStatus', 'refreshIngestCalcCells',
  'loadIngestDraft', 'initIngestState', 'clearIngestNotices', 'openSaveModal',
  'openAddYearDialog', 'buildIngestImport', 'applyIngestImport',
  'buildIngestWorkbook', 'ingestComputed', 'detectSumColumns',
  'reconcileSumColumns', 'recomputeTotals', 'totalRowFlags', 'rowsForDisplay',
  'ingestRowRole', 'ingestRoleOpen', 'INGEST_ROLE_OPEN', 'getTableSchema',
  'declaredYearFromFilename', 'importYearNotice', 'rowSumIsConsistent',
  'recomputeDerivableSums', 'ingestKeyColCount', 'normIngestKey',
  'parseNumericInput', 'adoptIngestReference', 'clone2D', 'DERIVED_COLS',
  'addReportingYear', 'allYears', 'Storage', 'saveIngestDraft', 'ingestHeaderRowCount',
  'ingestStoredHeaderRows', 'ingestYearCarriesHeaderRows', 'bareNumber', 'columnGrandTotals',
];

function boot(opts) {
  const o = opts || {};
  const src = o.src || readApp(o.rev);
  const dom = makeDocument();
  /* the app shell this page lives in: renderIngestPage writes into page-mount,
   * and the YEAR SELECTOR is a sibling the app rebuilds whenever a year is
   * added. Without it buildYearSelector() throws on a null element and the
   * add-year path dies halfway, having already registered the year. */
  dom.root.innerHTML = '<select id="year-select"></select>' +
    '<div id="view-container"><div id="page-mount"></div></div>';

  const localStore = {};
  const sandbox = {
    document: dom.document,
    window: {
      addEventListener: () => {}, removeEventListener: () => {},
      location: { href: 'http://localhost/', hash: '' },
      matchMedia: () => ({ matches: false, addEventListener: () => {} }),
      getComputedStyle: () => ({ getPropertyValue: () => '' }),
      alert: (m) => { dom.rec.alerts.push(String(m)); },
      Dash: {},
    },
    localStorage: {
      getItem: (k) => (localStore[k] === undefined ? null : localStore[k]),
      setItem: (k, v) => { localStore[k] = String(v); },
      removeItem: (k) => { delete localStore[k]; },
      clear: () => { Object.keys(localStore).forEach(k => delete localStore[k]); },
      key: (n) => Object.keys(localStore)[n] || null,
      get length() { return Object.keys(localStore).length; },
    },
    console: { log: () => {}, warn: () => {}, error: () => {}, info: () => {}, debug: () => {} },
    /* run deferred work IMMEDIATELY and record it: the app defers focus and
     * some repaints, and a deferred repaint that never ran would make a broken
     * exit look like a working one */
    setTimeout: (fn) => { dom.rec.timeouts.push(fn); try { fn(); } catch (e) { dom.rec.alerts.push('deferred threw: ' + e.message); } return 0; },
    clearTimeout: () => {},
    setInterval: () => 0, clearInterval: () => {},
    requestAnimationFrame: (fn) => { fn(); return 0; },
    fetch: () => Promise.reject(new Error('live_editor: no network in the harness')),
    alert: (m) => { dom.rec.alerts.push(String(m)); },
    confirm: () => true,
    URL: { createObjectURL: () => 'blob:', revokeObjectURL: () => {} },
    navigator: { userAgent: 'live_editor' },
    /* staging reads the picked file through a FileReader, so the dialog cannot
     * be driven at all without one. Synchronous on purpose: the callbacks the
     * app hangs off onload are the thing under test, not the scheduling. */
    FileReader: function FileReader() {
      this.result = null;
      this.readAsText = (f) => {
        this.result = (f && f.__text) || '';
        if (this.onload) this.onload();
      };
    },
  };

  const KICK = '\r\n  // Kick off\r\n';
  const at = src.indexOf(KICK);
  if (at < 0) throw new Error('live_editor: cannot find the boot kickoff to cut before');
  /* THE LAST TOP-LEVEL IIFE, not the first. app.js opens with a small
   * diagnostics IIFE before the application one, so taking the first match
   * sliced from inside the wrong wrapper and the body closed a brace that was
   * never opened -- which new Function reports only as "Single function
   * literal required", a long way from the cause. Anchored at column 0 so a
   * nested `(function () {` inside a declaration cannot win. */
  const opens = [];
  const openRe = /(^|\r\n)\(function \(\) \{/g;
  let om;
  while ((om = openRe.exec(src)) && om.index < at) opens.push(om.index + om[1].length);
  if (!opens.length) throw new Error('live_editor: cannot find the application IIFE');
  const open = opens[opens.length - 1];
  const bodySrc = src.slice(src.indexOf('\n', open) + 1, at);

  const factorySrc = 'const __sb = arguments[0];\n' +
    Object.keys(sandbox).map(k => 'const ' + k + ' = __sb.' + k + ';').join('\n') + '\n' +
    bodySrc +
    '\n;const __exp = {};\n' +
    EXPORTS.map(n => 'try { __exp.' + n + ' = ' + n + '; } catch (e) {}').join('\n') +
    '\ntry { __exp.__state = () => state; } catch (e) {}\nreturn __exp;';

  let api;
  try { api = new Function(factorySrc)(sandbox); }
  catch (e) { throw new Error('live_editor: the app body would not evaluate -- ' + e.message); }
  if (!api.__state) throw new Error('live_editor: the app body exposed no state');

  const appState = api.__state();
  appState.payload = o.payload;

  /* THE SECTION MUST MATCH THE TABLE. initIngestState() keeps a tableId only
   * when it belongs to the current section and silently replaces it otherwise,
   * so seeding H1 without its section opens a different table and the whole
   * reproduction measures the wrong rows. Derived, never named here. */
  if (o.tableId) {
    const tbl = (o.payload.tables || {})[o.tableId];
    appState.ingest = Object.assign(appState.ingest || {}, {
      sectionId: o.sectionId || (tbl && tbl.section),
      tableId: o.tableId,
      year: o.year,
    });
  }

  const doc = dom.document;
  const H = {
    dom, doc, api, sandbox,
    state: () => appState,
    ingest: () => appState.ingest,
    draft: () => (appState.ingest || {}).draft,
    baseline: () => (appState.ingest || {}).baseline,
    alerts: () => dom.rec.alerts.slice(),

    /** the full page repaint, which is what a section change does */
    repaintPage: () => {
      doc.getElementById('page-mount').innerHTML = api.renderIngestPage();
      api.wireIngestEditor();
      return H;
    },
    noticeHtml: () => {
      const m = doc.getElementById('ingest-import-mount');
      return m ? m.innerHTML : null;
    },
    noticeText: () => {
      const m = doc.getElementById('ingest-import-mount');
      return m ? m.textContent.replace(/\s+/g, ' ').trim() : '';
    },
    editorHtml: () => {
      const m = doc.getElementById('ingest-editor-mount');
      return m ? m.innerHTML : null;
    },
    cell: (r, c) => doc.querySelector('input[data-row="' + r + '"][data-col="' + c + '"]'),
    calcCell: (r, c) => doc.querySelector('span[data-row="' + r + '"][data-col="' + c + '"]'),

    /** type and leave: the real input and blur handlers, in that order */
    typeInCell: (r, c, value) => {
      const el = H.cell(r, c);
      if (!el) throw new Error('live_editor: no editable cell at row ' + r + ' col ' + c);
      el.value = String(value);
      el.dispatchEvent({ type: 'input' });
      el.dispatchEvent({ type: 'blur' });
      return el;
    },
    /** the modal the discard guards open, answered the way the operator does */
    confirmModal: (which) => {
      const b = doc.body.querySelector('[data-cfm="' + (which || 'confirm') + '"]');
      if (!b) throw new Error('live_editor: no open confirm modal to answer');
      b.dispatchEvent({ type: 'click' });
      return H;
    },
    modalOpen: () => !!doc.body.querySelector('[data-cfm="confirm"]'),

    /* RESET IS TWO GESTURES, not one. It opens the shared discard guard and
     * does nothing until that is answered -- a first reproduction that only
     * pressed the button measured a Reset that had never run, and would have
     * "proved" a defect that was really an unanswered modal. */
    clickReset: (answer) => {
      const b = doc.getElementById('ingest-reset');
      if (!b) throw new Error('live_editor: no Reset button on the page');
      b.dispatchEvent({ type: 'click' });
      if (H.modalOpen()) H.confirmModal(answer || 'confirm');
      return H;
    },
    /** open the Add Data dialog, the real one, on document.body */
    openAddYear: () => {
      if (!api.openAddYearDialog) throw new Error('live_editor: openAddYearDialog not exposed');
      api.openAddYearDialog();
      return H;
    },
    /** type a year into the dialog's own field, as the operator does */
    setDialogYear: (y) => {
      const f = doc.body.querySelector('#dlg-newyear');
      if (!f) throw new Error('live_editor: the dialog has no year field (#dlg-newyear)');
      f.value = String(y);
      f.dispatchEvent({ type: 'input' });
      return H;
    },
    /** pick a file: the real change handler, the real FileReader, the real dry run */
    stageFile: (name, csvText) => {
      const f = doc.body.querySelector('#ingest-file') || doc.getElementById('ingest-file');
      if (!f) throw new Error('live_editor: no file input on screen');
      f.files = [{ name: name, __text: csvText }];
      f.dispatchEvent({ type: 'change' });
      return H;
    },
    /** what the staged card is saying right now */
    stagedText: () => {
      const b = doc.body.querySelector('#dlg-stagedbox');
      return b ? b.textContent.replace(/\s+/g, ' ').trim() : null;
    },
    dialogHtml: () => {
      const m = doc.body.querySelector('.ingest-modal-overlay');
      return m ? m.innerHTML : null;
    },

    /* CREATE A USER-ADDED YEAR, through the app's own commit path.
     *
     * THIS IS THE PROVENANCE THAT MATTERED. payload.json holds only seed years,
     * so every reproduction this harness has ever run was on a seed year --
     * and both round-2 defects reproduce only on a user-added one. A year the
     * operator adds is registered in the STORE and pushed onto meta.years; it
     * has no stored rows at all until something is saved into it, so
     * loadIngestDraft builds its draft by a different route.
     *
     * addReportingYear is the function the Add Year button calls: it registers
     * the year, updates meta, points the editor at it and loads the draft. */
    addYear: (y) => {
      if (!api.addReportingYear) throw new Error('live_editor: addReportingYear not exposed');
      const r = api.addReportingYear(String(y));
      if (!r || !r.ok) throw new Error('live_editor: addReportingYear refused ' + y +
        ' -- ' + ((r && r.error) || 'no reason given'));
      H.repaintPage();
      return H;
    },
    /** is this year the operator's, or one the published report shipped with? */
    provenance: (y) => {
      const seed = ((appState.payload.meta || {}).years || []).map(String);
      const added = (api.Storage && api.Storage.getAddedYears)
        ? api.Storage.getAddedYears().map(String) : [];
      return added.indexOf(String(y)) >= 0 ? 'user-added'
        : (seed.indexOf(String(y)) >= 0 ? 'seed' : 'unknown');
    },

    /** switch year the way the picker does: set it, reload, repaint */
    switchYear: (y) => {
      appState.ingest.year = y;
      api.loadIngestDraft();
      api.rerenderIngestEditor();
      return H;
    },
  };
  H.repaintPage();
  return H;
}

module.exports = { boot, readApp, EXPORTS };
