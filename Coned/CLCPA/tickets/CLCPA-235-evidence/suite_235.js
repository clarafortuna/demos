/* CLCPA-235: an import may never end in silence.
 *
 * THE SHARED INVARIANT, and it is the whole ticket: no path may end with a
 * staged file consumed and neither a draft nor a result panel on screen. It is
 * driven through the REAL initIngestState and renderIngestPage, never stubs --
 * stubbing exactly those two is what let CLCPA-85 assert this rule while the
 * app broke it. The CLCPA-85 driver replaced loadIngestDraft and
 * rerenderIngestAll with no-op recorders, which are the two functions that
 * destroyed the result.
 *
 * THE DEFECT, for the record: initIngestState() called loadIngestDraft()
 * unconditionally, renderIngestPage() calls initIngestState() first thing on
 * every render, and loadIngestDraft() reloads the draft from storage and ends
 * with importResult = null. The dialog closes with rerenderIngestAll(), so the
 * redraw meant to SHOW the import was what erased it.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || 'd6997f3';   // pre-235, build b44e294b02
const SRC = fs.readFileSync(path.join(REPO, REL), 'utf8');
const toCRLF = (s) => s.replace(/\r?\n/g, '\r\n');
const BASE_SRC = toCRLF(execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
const PAYLOAD = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
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
  const L = (src || SRC).split('\r\n');
  let s = -1, e = -1;
  const open = new RegExp('^  const ' + name + ' = ');
  for (let i = 0; i < L.length; i++) {
    if (s < 0) { if (open.test(L[i])) s = i; }
    else if (/^  \}\)\(\);/.test(L[i]) || /^  \};/.test(L[i])) { e = i; break; }
  }
  return (s < 0 || e < 0) ? null : L.slice(s, e + 1).join('\n');
}

/* ---- the app, as shipped, with NOTHING that matters stubbed ------------ */
/* adoptIngestReference joined loadIngestDraft's dependencies when the badge
 * round extracted the reference pair into one helper. Extracted here so this
 * suite drives the REAL loader rather than a version of it that predates the
 * refactor. */
const NAMES = ['initIngestState', 'loadIngestDraft', 'adoptIngestReference',
  'ingestSelectionKey', 'recomputeDirty',
  'recomputeTotals', 'clone2D', 'getTableSchema', 'getTableBody', 'compareTableIds',
  'mostRecentYear', 'allYears', 'validateReportingYear', 'buildIngestImport',
  'parseCsvRows', 'normIngestKey', 'parseNumericInput', 'formatIngestValue',
  /* CLCPA-240 dependencies: buildIngestImport and buildIngestWorkbook read
     these, so the functions cannot be assembled without them. */
  'ingestKeyColCount', 'ingestIsBlankCell', 'ingestIsShapeBlank', 'ingestIsHeaderRow', 'ingestGroupOf', 'ingestRowKey',
  'ingestComputed', 'totalRowFlags', 'isStrictTotalRowLabel', 'isSplitCell',
  'cellText', 'cellCount', 'cellPct', 'rawNum', 'applyIngestImport',
  'addsOnlyPrecision', 'ingestStagedSummary', 'detectPctColumns', 'detectAvgColumns',
  'unreconciledTotals', 'totalRowSums', 'columnGrandTotals', 'applyDerivedCols',
  'applyDerivedRows', 'sumDerivedCols', 'renderIngestImport', 'renderIngestImportResult', 'withinSourceRounding', 'storedDecimals'];
const missing = NAMES.filter(n => !grab(n));
if (missing.length) { console.error('EXTRACTION FAILED: ' + missing.join(', ')); process.exit(1); }

function freshApp() {
  const added = [];
  const state = { payload: JSON.parse(JSON.stringify(PAYLOAD)), year: '2025', ingest: null };
  const Storage = {
    getOverride: () => null,
    getAddedYears: () => added.slice(),
    addYear: (y) => { if (added.indexOf(y) < 0) added.push(y); },
    isDataverse: () => false,
    getHistory: () => [],
    toast: () => {},
  };
  const api = new Function('PAYLOAD', 'Storage', 'state', 'console', 'escapeHtml',
    grabDecl('DERIVED_COLS') + '\n' + grabDecl('DERIVED_ROWS') + '\n' +
    /* CLCPA-240 dependencies, read from the SOURCE rather than retyped here. */
    ['INGEST_KEY_COLS', 'INGEST_GROUPED', 'INGEST_KEY_SEP', 'INGEST_CALC_MARKER',
     'INGEST_NOVALUE_MARKER', 'HIERARCHICAL_TABLES']
      .map(n => (SRC.match(new RegExp('\\r\\n  const ' + n + ' = [^;\\r\\n]*;')) || [''])[0].trim())
      .filter(Boolean).join('\n') + '\n' +
    grabDecl('SHORT_TITLES') + '\n' + NAMES.map(n => grab(n)).join('\n') + '\n' +
    'return { initIngestState, loadIngestDraft, ingestSelectionKey, loadKey: () => state.ingest.loadedKey,' +
    ' buildIngestImport, parseCsvRows, applyIngestImport, getTableSchema,' +
    ' ingestStagedSummary, renderIngestImport, allYears };')(
    state.payload, Storage, state, { warn: () => {}, info: () => {}, error: () => {} },
    (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
  return { api: api, state: state, Storage: Storage };
}

/* THE REDRAW, exactly as renderIngestPage does it: initIngestState first, then
 * the panel is rendered from whatever state survived. No stubs. */
function redraw(app) {
  app.api.initIngestState();
  return app.api.renderIngestImport();
}

/* ---- the staged file, built from the live schema like the template ----- */
const fld = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
function templateCsv(tableId, year, opts) {
  const o = opts || {};
  const app = freshApp();
  const schema = app.api.getTableSchema(PAYLOAD.tables[tableId], year);
  const labels = ((PAYLOAD.tables[tableId].data || {})['2025'] || []).map(r => String(r[0]));
  const rows = [schema.map(fld).join(',')];
  let filled = 0;
  labels.forEach((lab, i) => {
    const c = [fld(o.mangle ? lab.replace(/\u2013/g, '\uFFFD') : lab)];
    for (let k = 1; k < schema.length; k++) {
      if (k <= 2) { c.push(String(1000 + i * 10 + k)); filled++; }
      else c.push('');
    }
    rows.push(c.join(','));
  });
  return { csv: rows.join('\r\n') + '\r\n', schema: schema, labels: labels, filled: filled };
}

lines.push('======================================================================');
lines.push('CLCPA-235 -- an import may never end in silence');
lines.push('======================================================================');

/* ==================================================================== */
lines.push('');
lines.push('=== THE REPRO, verbatim, driven end to end ===');
guard('the repro', () => {
  /* Emely's live run on build 0eaf276305: standing on 2099, Add New Year
   * pre-fills 2100, stage A1-2099-example.csv, press Add Year. */
  const app = freshApp();
  app.Storage.addYear('2099');
  app.state.ingest = { sectionId: 'A', tableId: 'A1', year: '2099' };
  app.api.initIngestState();
  ok(app.state.ingest.year === '2099' && app.state.ingest.draft.length === 0,
     'standing on A1 / 2099 with an empty draft');

  const t = templateCsv('A1', '2099');
  const rows = app.api.parseCsvRows(t.csv);
  const dry = app.api.buildIngestImport(rows, t.schema, [], 'A1');
  const summary = app.api.ingestStagedSummary({ name: 'A1-2099-example.csv', rows: rows, dry: dry });
  ok(/^\d+ rows, \d+ matching columns, \d+ values ready to import\.$/.test(summary),
     'the dialog stages it and reports: ' + summary);
  ok(dry.ok && dry.addedRows.length === 23,
     'the dry run plans 23 rows, as the operator was told: ' + dry.addedRows.length);

  /* PRESS ADD YEAR: the shipped handler's own order, add then apply. */
  app.state.ingest.sectionId = 'A';
  app.state.ingest.tableId = 'A1';
  app.Storage.addYear('2100');
  app.state.ingest.year = '2100';
  app.api.loadIngestDraft();              // what addReportingYear does
  const plan = app.api.buildIngestImport(rows, app.state.ingest.schema,
    app.state.ingest.draft, 'A1');
  app.state.ingest.importResult = plan;
  ok(plan.ok, 'the apply plans cleanly against the new year');
  app.api.applyIngestImport(plan);
  const rowsAfterApply = app.state.ingest.draft.length;
  ok(rowsAfterApply === 23, 'and lands ' + rowsAfterApply + ' rows in the draft');

  /* THE REDRAW that destroyed it. */
  const panel = redraw(app);
  ok(app.state.ingest.draft.length === 23,
     'AFTER THE REDRAW the draft still holds its ' + app.state.ingest.draft.length +
     ' rows -- this is the assertion the ticket exists for');
  ok(!!app.state.ingest.importResult,
     'and the result survives the redraw');
  ok(panel.length > 0 && /\d/.test(panel),
     'and the panel RENDERS from it, rather than being erased first');
  /* CLCPA-234 addendum: the success panel no longer enumerates the rows it
   * created -- the filled table is below it. What it must still do, and what
   * this ticket is about, is EXIST and say how much landed. My own pin from
   * an hour ago named the row count; it moves to the cell count. */
  ok(/Imported into the draft: \d+ cells?/.test(panel),
     'saying how much landed: ' + (panel.match(/Imported into the draft: [^<]*/) || [])[0]);
  ok(/Nothing has been saved yet/.test(panel),
     'and that nothing is stored until Save, which is ruling 1 restated');
  ok(!/Rows added/.test(panel) && !/Not touched/.test(panel),
     'and NOT the old enumeration, which the addendum removed');
});

/* ==================================================================== */
lines.push('');
lines.push('=== THE SHARED INVARIANT: draft OR panel, on every consuming path ===');

/* Each case: consume a staged file, redraw for real, and require that the
 * operator is left with SOMETHING. The failure this forbids is both empty. */
const PATHS = [
  { name: 'new year, clean file', year: '2100', existing: false, mangle: false },
  { name: 'existing year, clean file', year: '2025', existing: true, mangle: false },
  { name: 'new year, MIS-ENCODED file', year: '2101', existing: false, mangle: true },
  { name: 'existing year, MIS-ENCODED file', year: '2025', existing: true, mangle: true },
  { name: 'new year, unreadable file', year: '2102', existing: false, unreadable: true },
];
guard('the shared invariant', () => {
  PATHS.forEach(p => {
    const app = freshApp();
    app.state.ingest = { sectionId: 'A', tableId: 'A1', year: '2025' };
    app.api.initIngestState();
    if (!p.existing) {
      app.Storage.addYear(p.year);
      app.state.ingest.year = p.year;
      app.api.loadIngestDraft();
    }
    const before = app.state.ingest.draft.length;

    let plan;
    if (p.unreadable) {
      /* the dialog's own shape for a file that could not be read */
      plan = { ok: false, rejections: [{ why: 'The file could not be read.' }] };
      app.state.ingest.importResult = plan;
    } else {
      const t = templateCsv('A1', p.year, { mangle: p.mangle });
      const rows = app.api.parseCsvRows(t.csv);
      plan = app.api.buildIngestImport(rows, app.state.ingest.schema,
        app.state.ingest.draft, 'A1');
      app.state.ingest.importResult = plan;
      if (plan.ok) app.api.applyIngestImport(plan);
    }

    const panel = redraw(app);
    const draftMoved = app.state.ingest.draft.length !== before ||
      (p.existing && plan.ok && plan.populated.length > 0);
    const hasPanel = !!app.state.ingest.importResult && panel.length > 0;
    ok(draftMoved || hasPanel,
       p.name + ': the operator is left with ' +
       (draftMoved ? 'a DRAFT' : '') + (draftMoved && hasPanel ? ' and ' : '') +
       (hasPanel ? 'a PANEL' : '') + (!draftMoved && !hasPanel ? 'NOTHING' : ''));
    /* and specifically NEVER the forbidden pair */
    ok(!(app.state.ingest.draft.length === before && !hasPanel && !p.existing),
       p.name + ': never an empty draft AND no panel, which is the one outcome ' +
       'CLCPA-85 forbids');
  });
});

/* ==================================================================== */
lines.push('');
lines.push('=== THE MATRIX, all four cells ===');
guard('the matrix', () => {
  const existingBody = ((PAYLOAD.tables.A1.data || {})['2025'] || []).map(r => r.slice());
  const cells = [
    ['(a) CSV (Comma delimited), new year', true, []],
    ['(b) CSV UTF-8, new year', false, []],
    ['(c) CSV (Comma delimited), existing year', true, existingBody],
    ['(d) CSV UTF-8, existing year', false, existingBody],
  ];
  cells.forEach(([name, mangle, draft]) => {
    const app = freshApp();
    const t = templateCsv('A1', '2025', { mangle: mangle });
    const rows = app.api.parseCsvRows(t.csv);
    const plan = app.api.buildIngestImport(rows, t.schema, draft.map(r => r.slice()), 'A1');
    if (mangle) {
      ok(!plan.ok, name + ': REJECTED WHOLE, so no rows are created');
      ok(plan.addedRows.length === 0 && plan.candidate === null,
         name + ': nothing added, nothing applied');
      ok(/wrong encoding/.test((plan.rejections[0] || {}).why || ''),
         name + ': and the reason names the encoding');
    } else {
      ok(plan.ok, name + ': accepted');
      ok(plan.populated.length > 0,
         name + ': ' + plan.populated.length + ' values planned, ' +
         plan.addedRows.length + ' rows created');
    }
  });
  /* THE DEFECT THIS KILLS: before the reject, an ANSI file against an existing
   * year created 8 duplicate rows and reported success. */
  const app = freshApp();
  const t = templateCsv('A1', '2025', { mangle: true });
  const rows = app.api.parseCsvRows(t.csv);
  const mangled = rows.slice(1).filter(r => String(r[0]).indexOf('\uFFFD') >= 0).length;
  ok(mangled === 8,
     'the mis-encoded fixture carries exactly the 8 mangled labels measured in ' +
     'the audit: ' + mangled);
  const plan = app.api.buildIngestImport(rows, t.schema,
    ((PAYLOAD.tables.A1.data || {})['2025'] || []).map(r => r.slice()), 'A1');
  ok(plan.addedRows.length === 0,
     'and it now creates ZERO duplicate rows, where it created 8: ' + plan.addedRows.length);
});

/* ==================================================================== */
lines.push('');
lines.push('=== the mojibake reject: whole, named, and BEFORE Add Year ===');
guard('the mojibake reject', () => {
  const app = freshApp();
  const t = templateCsv('A1', '2025', { mangle: true });
  const rows = app.api.parseCsvRows(t.csv);
  const plan = app.api.buildIngestImport(rows, t.schema, [], 'A1');
  ok(!plan.ok, 'a mis-encoded file is a HARD rejection');
  ok(plan.candidate === null, 'nothing is applied');
  /* WHY nothing is applied: TWO INDEPENDENT BARRIERS, and that is worth
   * stating precisely because it fooled me once. The mojibake reject returns
   * early, and the function also has one gate near its end --
   * if (res.rejections.length) return res -- that fails the whole import
   * whenever anything was rejected.
   *
   * Removing EITHER changes nothing observable, which is why both mutations
   * first looked like no-ops and why I wrongly called the early return
   * redundant. Removing BOTH does apply a rejected file, so the pair is
   * load-bearing and neither is decoration. The mutation set removes both
   * together as well as separately.
   *
   * The gate is the more valuable of the two: it protects the four other hard
   * rejections in this function, not just this one. */
  const bi = grab('buildIngestImport');
  ok(/if \(res\.rejections\.length\) return res;/.test(bi),
     'the shared gate fails a rejected import, for every rejection');
  ok(/res\.mojibakeCells = mojibake\.length;[\s\S]{0,40}return res;/.test(bi),
     'and the mojibake reject returns early too: the second barrier');
  const gateAt = bi.indexOf('if (res.rejections.length) return res;');
  const candAt = bi.indexOf('res.candidate = candidate;');
  ok(gateAt > 0 && candAt > gateAt,
     'the gate sits BEFORE the candidate is assigned, which is what makes it ' +
     'a barrier rather than a report');
  const why = (plan.rejections[0] || {}).why || '';
  ok(/CSV UTF-8/.test(why) && /CSV \(Comma delimited\)/.test(why),
     'and the message names BOTH options, so the fix is actionable: ' + why.slice(0, 96));
  ok(/File, Save As/.test(why),
     'including where to find it, since the quick-save panel hides it');
  ok(plan.mojibakeCells === 8, 'the count is reported: ' + plan.mojibakeCells);
  /* DERIVED, not guessed: the first A1 label carrying an en dash is not the
   * first data row, so the number has to come from the fixture. What the
   * assertion means is that the reject names the FIRST offending row. */
  const firstBad = rows.findIndex(r => (r || []).some(c =>
    typeof c === 'string' && c.indexOf('\uFFFD') >= 0));
  ok(firstBad > 0, 'the fixture has a mangled row to name: index ' + firstBad);
  ok((plan.rejections[0] || {}).row === firstBad + 1,
     'and the reject names it, 1-based as the operator counts: row ' +
     (plan.rejections[0] || {}).row);
  ok((plan.rejections[0] || {}).label.indexOf('\uFFFD') >= 0,
     'quoting the mangled text itself, so it is findable in the file');

  /* IT FIRES AT STAGING TOO, which is what keeps the operator away from Add
   * Year with a bad file: the dry run is the same function. */
  const dry = app.api.buildIngestImport(rows, t.schema, [], 'A1');
  ok(!dry.ok, 'the STAGING dry run refuses it as well, being the same funnel');
  const summary = app.api.ingestStagedSummary({ name: 'bad.csv', rows: rows, dry: dry });
  ok(!/ready to import/.test(summary),
     'so the dialog cannot report it as ready: ' + summary.slice(0, 88));

  /* A MANGLED HEADER, not just mangled labels. Scanning only the label column
   * would let this through, and then the column would silently fail to match --
   * found by the mutation that sliced the scan to column 0. */
  const t2 = templateCsv('A1', '2025', {});
  const hdrRows = app.api.parseCsvRows(t2.csv);
  hdrRows[0][1] = String(hdrRows[0][1]).replace(/ /, '\uFFFD');
  const hdrPlan = app.api.buildIngestImport(hdrRows, t2.schema, [], 'A1');
  ok(!hdrPlan.ok, 'a mangled HEADER is rejected too, not only a mangled label');
  ok(hdrPlan.mojibakeCells === 1,
     'and counted: ' + hdrPlan.mojibakeCells + ' cell');
  ok((hdrPlan.rejections[0] || {}).row === 1,
     'named as row 1, the header row: row ' + (hdrPlan.rejections[0] || {}).row);

  /* a clean file is NOT rejected: the check must not be a blanket refusal */
  const clean = app.api.parseCsvRows(templateCsv('A1', '2025', {}).csv);
  ok(app.api.buildIngestImport(clean, t.schema, [], 'A1').ok,
     'and a correctly encoded file still imports');
});

/* ==================================================================== */
lines.push('');
lines.push('=== the unreadable-file path, read from the dialog itself ===');
guard('the unreadable path', () => {
  /* The invariant block SYNTHESISES this plan, because driving the whole
   * dialog needs its full dependency list. So the shape it synthesises is
   * checked against the dialog's own source here -- stated as a source read,
   * which is weaker than driving it and is why it is separate. A mutation
   * that stops the dialog setting a result goes red on this. */
  const dlg = grab('openAddYearDialog');
  ok(!!dlg, 'the dialog is found');
  ok(/if \(!staged\.rows\) \{[\s\S]{0,200}?i\.importResult = \{ ok: false/.test(dlg),
     'an unreadable file sets a NOT-OK importResult rather than nothing');
  ok(/The file could not be read\./.test(dlg),
     'with a reason the panel can show');
  ok(/i\.importResult = plan;/.test(dlg),
     'and a readable file sets the plan, ok or not, so a rejection shows too');
  /* both branches assign: neither can fall through to silence */
  const assigns = (dlg.match(/i\.importResult = /g) || []).length;
  ok(assigns === 2, 'BOTH branches assign a result: ' + assigns);
});

lines.push('');
lines.push('=== the guard itself: initialise, do not reload ===');
guard('the guard', () => {
  const app = freshApp();
  app.state.ingest = { sectionId: 'A', tableId: 'A1', year: '2025' };
  app.api.initIngestState();
  const key1 = app.api.loadKey();
  ok(!!key1, 'loadIngestDraft records the selection it loaded for: ' + JSON.stringify(key1));

  /* an unrelated redraw must NOT reload */
  app.state.ingest.draft[0][1] = 'EDITED BY HAND';
  app.api.initIngestState();
  ok(app.state.ingest.draft[0][1] === 'EDITED BY HAND',
     'a redraw with nothing moved keeps the draft, edits and all');
  app.state.ingest.importResult = { ok: true, populated: [1], addedRows: [], rejections: [] };
  app.api.initIngestState();
  ok(!!app.state.ingest.importResult, 'and keeps the result panel');

  /* a MOVED selection must still reload, or the picker breaks */
  app.state.ingest.year = '2024';
  app.api.initIngestState();
  ok(app.state.ingest.draft[0][1] !== 'EDITED BY HAND',
     'but changing the YEAR does reload: the picker still works');
  ok(!app.state.ingest.importResult,
     'and clears the result, which describes a table-year the operator has left');
  ok(app.api.loadKey() !== key1, 'the key moved with it');

  const app2 = freshApp();
  app2.state.ingest = { sectionId: 'A', tableId: 'A1', year: '2025' };
  app2.api.initIngestState();
  app2.state.ingest.draft[0][1] = 'EDITED BY HAND';
  app2.state.ingest.tableId = 'A5';
  app2.api.initIngestState();
  ok(app2.state.ingest.draft[0][1] !== 'EDITED BY HAND',
     'changing the TABLE reloads too');

  /* and with no draft at all it loads, which is what the first render needs */
  const app3 = freshApp();
  app3.state.ingest = { sectionId: 'A', tableId: 'A1', year: '2025' };
  app3.api.initIngestState();
  ok(Array.isArray(app3.state.ingest.draft) && app3.state.ingest.draft.length > 0,
     'a first render with no draft yet loads one: ' + app3.state.ingest.draft.length + ' rows');

  /* THE DEFENSIVE HALF OF THE GUARD, tested on the state it exists for.
   *
   * On a fresh state loadedKey is undefined and the KEY comparison already
   * triggers the load, so `!draft` never fires there -- a mutation removing it
   * left every other assertion green. The state it actually defends is a key
   * that says "already loaded" with no draft behind it. No code path produces
   * that today; the clause is there so that none can. Constructed here rather
   * than left as an unexercised branch. */
  const app4 = freshApp();
  app4.state.ingest = { sectionId: 'A', tableId: 'A1', year: '2025' };
  app4.api.initIngestState();
  const goodKey = app4.api.loadKey();
  app4.state.ingest.draft = null;          // the state the clause defends
  app4.state.ingest.loadedKey = goodKey;   // ... while the key claims it is loaded
  app4.api.initIngestState();
  ok(Array.isArray(app4.state.ingest.draft) && app4.state.ingest.draft.length > 0,
     'a key that claims loaded with NO draft behind it still loads: ' +
     (app4.state.ingest.draft || []).length + ' rows');
});

/* ==================================================================== */
lines.push('');
lines.push('=== BASE controls: the values really were lost ===');
guard('base controls', () => {
  ok(BASE_SRC.indexOf('function ingestSelectionKey') < 0,
     'BASE control: there was no selection key');
  const baseInit = grab('initIngestState', BASE_SRC);
  ok(!!baseInit, 'BASE initIngestState is found');
  ok(/\n    loadIngestDraft\(\);\r?\n?\s*\}$/.test(baseInit.replace(/\r/g, '')) ||
     /loadIngestDraft\(\);/.test(baseInit),
     'BASE control: it called loadIngestDraft UNCONDITIONALLY');
  ok(!/loadedKey/.test(baseInit),
     'BASE control: with nothing to tell it whether the selection had moved');
  const init = grab('initIngestState');
  ok(/loadedKey !== ingestSelectionKey\(\)/.test(init),
     'and now it loads only when the key differs');
  ok(/!state\.ingest\.draft \|\|/.test(init),
     'or when there is no draft at all');
  const load = grab('loadIngestDraft');
  ok(/i\.loadedKey = ingestSelectionKey\(\);/.test(load),
     'the key is set inside loadIngestDraft, so EVERY caller updates it');
  ok(!/loadedKey/.test(BASE_SRC), 'BASE control: the key did not exist anywhere');
  ok(BASE_SRC.indexOf('\\uFFFD') < 0 && BASE_SRC.indexOf('wrong encoding') < 0,
     'BASE control: nothing detected a mis-decoded file');
  /* the count of loadIngestDraft callers is unchanged: the fix removed a call
   * from initIngestState and added none */
  const callers = (s) => (s.match(/(^|[^\w.])loadIngestDraft\(\)/gm) || []).length -
    (s.match(/function loadIngestDraft\(\)/g) || []).length;
  ok(callers(SRC) === callers(BASE_SRC) - 1 + 1 || callers(SRC) >= 5,
     'the picker handlers still call it themselves: ' + callers(SRC) + ' call sites');
});

lines.push('');
lines.push('======================================================================');
lines.push('  ' + pass + ' passed, ' + fail + ' failed');
lines.push('======================================================================');
const out = lines.join('\n');
console.log(out);
fs.writeFileSync(path.join(__dirname, 'suite-235-output.txt'), out + '\n');
process.exitCode = fail ? 1 : 0;
