/* CLCPA-234: Add Data. One dialog, two cases, told apart by the typed year.
 *
 * THE ACCEPTANCE that matters most: it must be impossible to create a year the
 * operator did not intend. That is asserted by DRIVING the handler with a
 * recording addReportingYear and requiring it is never called on the
 * existing-year path -- not by reading a guard, because a guard can be right
 * and still be reached.
 *
 * The shared invariant is asserted here too, per the ruling, on this ticket's
 * own new path: an existing year that consumes a staged file must leave a draft
 * or a panel, never neither.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || 'c58da34';   // post-235, pre-234
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
/* Source with STRING CONCATENATION SEAMS CLOSED UP, so a sentence written
 * across two lines for the sake of 80 columns reads as one sentence. Wrapping
 * is a formatting choice; the words are the claim. */
function joined(src) {
  return String(src).replace(/'\s*\+\s*'/g, '');
}

/* the title-case rule, as CLCPA-226 round 2 implemented it */
const CONN = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in', 'into',
  'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'up', 'via', 'with'];
function titleCaseProblems(s) {
  const words = String(s).replace(/[?:.,!]/g, ' ').split(/\s+/).filter(Boolean);
  const bad = [];
  words.forEach((w, i) => {
    if (!/[A-Za-z]/.test(w)) return;
    const cap = /^[A-Z]/.test(w);
    if (i === 0) { if (!cap) bad.push(w); return; }
    if (CONN.indexOf(w.toLowerCase()) >= 0) { if (w !== w.toLowerCase()) bad.push(w); return; }
    if (!cap) bad.push(w);
  });
  return bad;
}

lines.push('======================================================================');
lines.push('CLCPA-234 -- Add Data: one dialog, two cases');
lines.push('======================================================================');

/* ==================================================================== */
lines.push('');
lines.push('=== the names, and the title-case rule ===');
guard('the names', () => {
  ok(SRC.indexOf('id="ingest-addyear" type="button">Add Data</button>') >= 0,
     'the page button reads Add Data');
  ok(SRC.indexOf('<h3 id="dlg-title">Add Data</h3>') >= 0,
     'and so does the dialog it opens');
  ok(BASE_SRC.indexOf('>Add New Year</button>') >= 0 &&
     BASE_SRC.indexOf('<h3 id="dlg-title">Add New Year</h3>') >= 0,
     'BASE control: both said Add New Year');
  ok(SRC.indexOf('>Add New Year<') < 0,
     'and the old name survives nowhere in the markup');
  /* ONE NAME for one control, which is the CLCPA-226 rule applied to a button
   * and the dialog it opens rather than to a tooltip and its aria-label. */
  ok(titleCaseProblems('Add Data').length === 0, 'Add Data is title case');
  ok(titleCaseProblems('Load Data').length === 0, 'Load Data is title case');
  ok(titleCaseProblems('Add Year').length === 0, 'Add Year is title case');
});

/* ==================================================================== */
lines.push('');
lines.push('=== the suggestion is GONE; the page year is the default ===');
guard('the default year', () => {
  ok(BASE_SRC.indexOf('const suggested = String(Math.max.apply(null,') >= 0,
     'BASE control: the next-unused-year suggestion existed');
  ok(codeOnly(SRC).indexOf('const suggested =') < 0,
     'it is gone from the code, not merely unused');
  const dlg = grab('openAddYearDialog');
  ok(!!dlg, 'the dialog is found');
  ok(/const pageYear = String\(\(state\.ingest && state\.ingest\.year\)/.test(dlg),
     'the default comes from the year the PAGE is on');
  ok(/const drawYear = \(\) => \{ const v = fieldYear\(\); return v == null \? pageYear : v; \};/
     .test(dlg), 'and that is what the field is drawn from');
  ok(!/Math\.max/.test(codeOnly(dlg)),
     'with no max-plus-one arithmetic left anywhere in the dialog');
  /* CLCPA-226 finding B stays fixed: validation still reads the box, never a
   * fallback. */
  ok(/validateReportingYear\(typed\)/.test(dlg),
     'validation still reads what the operator typed');
  ok(!/validateReportingYear\(drawYear\(\)\)/.test(dlg),
     'and never the drawn value, which was CLCPA-226 finding B');
});

/* ==================================================================== */
lines.push('');
lines.push('=== ONE PREDICATE decides the case, so nothing can disagree ===');
guard('one predicate', () => {
  const dlg = grab('openAddYearDialog');
  ok(/const yearExists = \(y\) => years\.indexOf\(String\(y\)\) >= 0;/.test(dlg),
     'existence is asked of the year list, once');
  /* DISPLAY reads drawYear, not typedYear. Pinning typedYear here was the
   * first-draw defect written down as an assertion; the section below drives
   * the difference. */
  ok(/const isExisting = \(\) => yearExists\(drawYear\(\)\);/.test(dlg),
     'and the case is derived from the value the FIELD shows');
  /* the label, the consequence line and the handler all read the same thing */
  ok((dlg.match(/isExisting\(\)/g) || []).length >= 2,
     'the label and the consequence line both use it: ' +
     (dlg.match(/isExisting\(\)/g) || []).length + ' uses');
  ok(/const existing = yearExists\(typed\);/.test(dlg),
     'and the handler asks the same question of the same list');
  ok(!/typedYear\(\) === |year === '20/.test(codeOnly(dlg).replace(/yearExists[\s\S]{0,80}/g, '')),
     'with no second, hand-rolled test of whether a year exists');
});

/* ==================================================================== */
lines.push('');
lines.push('=== the consequence line: on screen BEFORE the button ===');
guard('the consequence', () => {
  const dlg = grab('openAddYearDialog');
  ok(/id="dlg-consequence"/.test(dlg), 'the line exists');
  const words = joined(dlg);
  ok(/already exists\. Values will load into the editor as a draft\. Nothing is created\./
     .test(words), 'the existing case says nothing is created');
  ok(/is new\. It will be created and added to the year selector everywhere\./.test(words),
     'and the new case says it will be created, and where it shows up');
  /* ONE definition of each, which is what stops the line and the button
   * disagreeing. I first wrote both sentences out twice. */
  /* CODE ONLY for the counting, because the comment above isExisting quotes
   * both sentences while explaining the first-draw defect -- and prose about a
   * sentence is not a second definition of it. The fourth time this family has
   * bitten in this session. */
  const codeWords = joined(codeOnly(dlg));
  ok((codeWords.match(/already exists\. Values will load/g) || []).length === 1,
     'the existing sentence appears ONCE in the code');
  ok((codeWords.match(/is new\. It will be created/g) || []).length === 1,
     'and so does the new one');
  ok((words.match(/is new\. It will be created/g) || []).length > 1,
     'it does appear in prose too, which is why that counts code only');
  ok((dlg.match(/'Load Data'/g) || []).length === 1,
     'and the Load Data label is written once: ' +
     (dlg.match(/'Load Data'/g) || []).length);
  /* it FOLLOWS the box, so it cannot describe a different year than the button
   * is about to act on */
  ok(/yin\.addEventListener\('input'/.test(dlg),
     'it updates as the year is typed');
  const inputHandler = dlg.slice(dlg.indexOf("yin.addEventListener('input'"));
  ok(/dlg-consequence/.test(inputHandler) && /data-act="addyear"/.test(inputHandler),
     'updating BOTH the line and the button label together');
  ok(/cons\.textContent = consequenceText\(\);/.test(inputHandler) &&
     /btn\.textContent = primaryLabel\(\);/.test(inputHandler),
     'both from the SAME two functions the first draw uses, so they cannot ' +
     'drift apart');
  ok(/escapeHtml\(consequenceText\(\)\)/.test(dlg) &&
     /escapeHtml\(primaryLabel\(\)\)/.test(dlg),
     'and the first draw calls those same two');
  ok(BASE_SRC.indexOf('dlg-consequence') < 0, 'BASE control: there was no such line');
});

/* ==================================================================== */
lines.push('');
lines.push('=== DRIVEN: which case gets WHICH sentence ===');
guard('the sentence mapping', () => {
  /* THE HOLE THIS CLOSES: I asserted both sentences exist and that each
   * appears once, and never which case gets which. A mutation swapping them
   * left the suite green -- so the line could have read "Nothing is created"
   * while a year was being created, which is the one thing it is for. */
  const dlg = grab('openAddYearDialog');
  const start = dlg.indexOf('const consequenceText = () => {');
  const end = dlg.indexOf('const primaryLabel =');
  ok(start > 0 && end > start, 'consequenceText is found in the dialog');
  const body = dlg.slice(start, end);
  const make = (exists, typed) => new Function('typedYear', 'pageYear', 'isExisting',
    body + '\nreturn consequenceText();')(
    () => typed, '2025', () => exists);

  const forExisting = make(true, '2025');
  ok(/^2025 already exists\./.test(forExisting),
     'an EXISTING year gets the exists sentence: ' + forExisting.slice(0, 58));
  ok(/Nothing is created\.$/.test(forExisting),
     'ending in the promise that matters: nothing is created');
  ok(!/is new/.test(forExisting), 'and never says it is new');

  const forNew = make(false, '2100');
  ok(/^2100 is new\./.test(forNew),
     'a NEW year gets the new sentence: ' + forNew.slice(0, 58));
  ok(/will be created/.test(forNew), 'saying it will be created');
  ok(!/Nothing is created/.test(forNew),
     'and NEVER says nothing is created, which is the swap that must be ' +
     'impossible');

  /* and the label maps the same way */
  const lstart = dlg.indexOf('const primaryLabel =');
  const lbody = dlg.slice(lstart, dlg.indexOf(';', lstart) + 1);
  const label = (exists) => new Function('isExisting',
    lbody + '\nreturn primaryLabel();')(() => exists);
  ok(label(true) === 'Load Data', 'the existing case is labelled Load Data');
  ok(label(false) === 'Add Year', 'and the new case Add Year');
});

lines.push('');
lines.push('=== DRIVEN: it is impossible to create a year not intended ===');

const NAMES = ['initIngestState', 'loadIngestDraft', 'ingestSelectionKey', 'recomputeDirty',
  'recomputeTotals', 'clone2D', 'getTableSchema', 'getTableBody', 'compareTableIds',
  'mostRecentYear', 'allYears', 'validateReportingYear', 'buildIngestImport',
  'parseCsvRows', 'normIngestKey', 'parseNumericInput', 'formatIngestValue',
  'ingestComputed', 'totalRowFlags', 'isStrictTotalRowLabel', 'isSplitCell',
  'cellText', 'cellCount', 'cellPct', 'rawNum', 'applyIngestImport',
  'addsOnlyPrecision', 'ingestStagedSummary', 'detectPctColumns', 'detectAvgColumns',
  'unreconciledTotals', 'totalRowSums', 'columnGrandTotals', 'applyDerivedCols',
  'applyDerivedRows', 'sumDerivedCols', 'renderIngestImport', 'renderIngestImportResult',
  'withinSourceRounding', 'storedDecimals'];
const missingEngine = NAMES.filter(n => !grab(n));
if (missingEngine.length) {
  console.error('EXTRACTION FAILED: ' + missingEngine.join(', '));
  process.exit(1);
}

/* the real engine, with the two functions CLCPA-235 taught us never to stub */
function engine() {
  const added = [];
  const state = { payload: JSON.parse(JSON.stringify(PAYLOAD)), year: '2025', ingest: null };
  const Storage = {
    getOverride: () => null, getAddedYears: () => added.slice(),
    addYear: (y) => { if (added.indexOf(y) < 0) added.push(y); },
    isDataverse: () => false, getHistory: () => [], toast: () => {},
  };
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const api = new Function('PAYLOAD', 'Storage', 'state', 'console', 'escapeHtml',
    grabDeclAll() + '\n' + NAMES.map(n => grab(n)).join('\n') + '\n' +
    'return { initIngestState, loadIngestDraft, buildIngestImport, parseCsvRows,' +
    ' applyIngestImport, getTableSchema, allYears, validateReportingYear,' +
    ' renderIngestImport, mostRecentYear, ingestStagedSummary };')(
    state.payload, Storage, state, { warn: () => {}, info: () => {}, error: () => {} }, esc);
  return { api: api, state: state, Storage: Storage, esc: esc };
}
function grabDeclAll() {
  const one = (name) => {
    const L = SRC.split('\r\n');
    let s = -1, e = -1;
    const open = new RegExp('^  const ' + name + ' = ');
    for (let i = 0; i < L.length; i++) {
      if (s < 0) { if (open.test(L[i])) s = i; }
      else if (/^  \}\)\(\);/.test(L[i]) || /^  \};/.test(L[i])) { e = i; break; }
    }
    return (s < 0 || e < 0) ? '' : L.slice(s, e + 1).join('\n');
  };
  return one('DERIVED_COLS') + '\n' + one('DERIVED_ROWS') + '\n' + one('SHORT_TITLES');
}

/* THE HANDLER, extracted and run. Everything the dialog reaches for is real
 * except addReportingYear, which is RECORDED -- the whole question is whether
 * it is called at all. */
function runHandler(opts) {
  const o = opts || {};
  const e = engine();
  e.state.ingest = { sectionId: 'A', tableId: 'A1', year: o.pageYear || '2025' };
  e.api.initIngestState();
  const calls = [];
  const years = e.api.allYears();

  const dlg = grab('openAddYearDialog');
  const body = dlg.slice(dlg.indexOf("act('addyear'"));
  const handlerSrc = body.slice(body.indexOf('{') + 1,
    body.indexOf('\r\n      });'));

  const errNode = { textContent: '', style: {} };
  const btnNode = { textContent: '' };
  const consNode = { textContent: '' };
  const modal = {
    querySelector: (s) => (s === '#dlg-error' ? errNode
      : s === '[data-act="addyear"]' ? btnNode
      : s === '#dlg-consequence' ? consNode : null),
  };
  let closed = false, redrew = false;
  const fn = new Function('typedYear', 'yearExists', 'validateReportingYear',
    'state', 'sel', 'addReportingYear', 'loadIngestDraft', 'staged',
    'buildIngestImport', 'applyIngestImport', 'confirmDiscardChanges', 'close',
    'modal', 'markRedraw',
    'let needsRedraw = false;\n' + handlerSrc.replace(/needsRedraw = true;/g,
      'needsRedraw = true; markRedraw();'));
  /* A THROW IS AN OUTCOME. The handler threw under the mutation that makes an
   * existing year take the create branch -- v is null there -- and aborting
   * the block meant the assertion about what was CALLED never ran. Recorded
   * and returned instead, so every assertion still gets its answer. */
  let threw = null;
  try {
    fn(() => String(o.typed), (y) => years.indexOf(String(y)) >= 0,
       e.api.validateReportingYear,
       e.state, { sectionId: 'A', tableId: o.tableId || 'A1' },
       (y) => { calls.push('addReportingYear:' + y); e.Storage.addYear(y);
                e.state.ingest.year = y; e.api.loadIngestDraft();
                return { ok: true, year: y }; },
       () => { calls.push('loadIngestDraft'); e.api.loadIngestDraft(); },
       o.staged || null, e.api.buildIngestImport, e.api.applyIngestImport,
       (cb) => cb(), () => { closed = true; }, modal,
       () => { redrew = true; });
  } catch (err) { threw = err && err.message ? err.message : String(err); }
  return { engine: e, calls: calls, closed: closed, redrew: redrew,
           err: errNode.textContent, years: years, threw: threw };
}

guard('driven: an existing year creates NOTHING', () => {
  const r = runHandler({ typed: '2025', pageYear: '2025' });
  /* FIRST, and regardless of whether the handler completed: nothing was
   * created. This is the ticket's central claim and it must be answerable
   * even when the code under test falls over. */
  ok(r.calls.indexOf('addReportingYear:2025') < 0,
     'addReportingYear was NOT called: ' + JSON.stringify(r.calls));
  ok(r.threw === null, 'and the handler completed without throwing' +
     (r.threw ? ': ' + r.threw : ''));
  ok(!r.calls.some(c => c.indexOf('addReportingYear') === 0),
     'nor with any other year');
  ok(r.engine.state.ingest.year === '2025', 'the page is pointed at 2025');
  ok(r.engine.state.ingest.draft.length > 0,
     'and its draft is loaded: ' + r.engine.state.ingest.draft.length + ' rows');
  ok(r.redrew && r.closed, 'the dialog closes and the page redraws');
  ok(r.engine.api.allYears().length === r.years.length,
     'the year list is the same length as before: ' + r.engine.api.allYears().length);
});

guard('driven: a NEW year is created, exactly as before', () => {
  const r = runHandler({ typed: '2099', pageYear: '2025' });
  ok(r.calls.indexOf('addReportingYear:2099') >= 0,
     'addReportingYear IS called for a new year: ' + JSON.stringify(r.calls));
  ok(r.engine.state.ingest.year === '2099', 'and the page lands on it');
  ok(r.redrew && r.closed, 'the dialog closes and the page redraws');
});

guard('driven: an invalid year does nothing at all', () => {
  const r = runHandler({ typed: '', pageYear: '2025' });
  ok(!r.calls.some(c => c.indexOf('addReportingYear') === 0),
     'nothing is created for an empty year');
  ok(!r.closed, 'the dialog stays open');
  ok(/valid year/.test(r.err), 'with a named error: ' + r.err);
  const r2 = runHandler({ typed: '1999', pageYear: '2025' });
  ok(!r2.calls.some(c => c.indexOf('addReportingYear') === 0),
     'nor for a year out of range');
  ok(/between 2000 and 2100/.test(r2.err), 'named too: ' + r2.err);
});

/* ==================================================================== */
lines.push('');
lines.push('=== THE SHARED INVARIANT on this ticket s new path ===');
guard('the shared invariant', () => {
  /* An EXISTING year that consumes a staged file must leave a draft or a panel.
   * Driven through the real loadIngestDraft, buildIngestImport and
   * applyIngestImport, and then the real initIngestState + renderIngestImport,
   * which is the redraw CLCPA-235 was about. */
  const e0 = engine();
  const schema = e0.api.getTableSchema(PAYLOAD.tables.A1, '2025');
  const labels = ((PAYLOAD.tables.A1.data || {})['2025'] || []).map(r => String(r[0]));
  const fld = (v) => (/[",\r\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  const csvLines = [schema.map(fld).join(',')];
  labels.forEach((lab, i) => {
    const c = [fld(lab)];
    for (let k = 1; k < schema.length; k++) c.push(k <= 2 ? String(500 + i) : '');
    csvLines.push(c.join(','));
  });
  const rows = e0.api.parseCsvRows(csvLines.join('\r\n') + '\r\n');

  const r = runHandler({ typed: '2025', pageYear: '2024',
                         staged: { name: 'a1.csv', rows: rows } });
  ok(!r.calls.some(c => c.indexOf('addReportingYear') === 0),
     'existing year with a staged file: still creates nothing');
  const i = r.engine.state.ingest;
  ok(!!i.importResult, 'a result is set');
  ok(i.importResult.ok, 'and it is a clean plan: ' +
     i.importResult.populated.length + ' values, ' + i.importResult.addedRows.length + ' rows added');
  ok(i.draft.length > 0, 'the draft holds rows: ' + i.draft.length);
  /* THE REDRAW, for real */
  r.engine.api.initIngestState();
  const panel = r.engine.api.renderIngestImport();
  ok(r.engine.state.ingest.draft.length > 0,
     'AFTER THE REDRAW the draft survives: ' + r.engine.state.ingest.draft.length + ' rows');
  ok(!!r.engine.state.ingest.importResult && panel.length > 0,
     'and the panel renders: the CLCPA-235 invariant holds on the new path too');
});

/* ==================================================================== */
lines.push('');
lines.push('=== the flag that would have lied ===');
guard('the flag', () => {
  const dlg = grab('openAddYearDialog');
  ok(/let needsRedraw = false;/.test(dlg), 'the redraw flag is named for what it does');
  ok(/if \(needsRedraw\) rerenderIngestAll\(\);/.test(dlg), 'and close reads it');
  ok(!/(^|[^\w])added(\s*=|\))/.test(codeOnly(dlg)),
     'no `added` remains in the dialog s code');
  ok(/let added = false;/.test(BASE_SRC),
     'BASE control: it was called `added`, which the existing-year case would ' +
     'have set true while adding nothing');
});


/* ==================================================================== */
lines.push('');
lines.push('=== THE ADDENDUM: a success panel of two lines, DRIVEN ===');
guard('the slim success panel', () => {
  /* Rendered from a REAL plan, both ways, because the claim is about what the
   * operator reads and not about which branch the code takes. */
  const e = engine();
  e.state.ingest = { sectionId: 'A', tableId: 'A1', year: '2025' };
  e.api.initIngestState();
  const schema = e.api.getTableSchema(PAYLOAD.tables.A1, '2025');
  const labels = ((PAYLOAD.tables.A1.data || {})['2025'] || []).map(r => String(r[0]));
  const fld = (v) => (/[",\r\n]/.test(String(v))
    ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));

  /* a file that populates, CREATES a row, has an UNMATCHED COLUMN and a BLANK:
   * every category the old panel enumerated, so their absence is meaningful */
  const head = schema.map(fld).concat(['Not A Column']).join(',');
  const body = labels.slice(0, 3).map((lab, i) =>
    [fld(lab), String(700 + i), '', '', 'x'].join(','));
  body.push([fld('A Brand New Program'), '999', '888', '', 'x'].join(','));
  const rows = e.api.parseCsvRows([head].concat(body).join('\r\n') + '\r\n');
  const plan = e.api.buildIngestImport(rows, schema,
    ((PAYLOAD.tables.A1.data || {})['2025'] || []).map(r => r.slice()), 'A1');
  ok(plan.ok, 'the fixture plans cleanly');
  ok(plan.addedRows.length === 1, 'creating one row: ' + JSON.stringify(plan.addedRows));
  ok(plan.notTouched.unmatchedColumns.length === 1,
     'with one unmatched column: ' + plan.notTouched.unmatchedColumns);
  ok(plan.blankSkipped.length > 0, 'and blanks skipped: ' + plan.blankSkipped.length);

  e.state.ingest.importResult = plan;
  const panel = e.api.renderIngestImport();
  /* TWO LINES, and only those */
  ok(/Imported into the draft: \d+ cells?/.test(panel),
     'line one is the cell count: ' + (panel.match(/Imported into the draft: [^<]*/) || [])[0]);
  ok(/Review the values below, then press Save\. Nothing has been saved yet\./
     .test(panel), 'line two is the review-and-save reminder, verbatim');
  ok(!/Rows added/.test(panel),
     'the row it CREATED is not enumerated, though the plan knows about it');
  ok(panel.indexOf('A Brand New Program') < 0,
     'not even by name');
  ok(!/Not touched/.test(panel), 'there is no not-touched section');
  ok(panel.indexOf('Not A Column') < 0, 'the unmatched column is not listed');
  ok(!/blank/.test(panel), 'nor the blanks');
  /* the whole panel is short, which is the point rather than a side effect */
  const paras = (panel.match(/<p>/g) || []).length;
  const heads = (panel.match(/<h4>/g) || []).length;
  ok(heads === 1 && paras === 1,
     'one heading and one paragraph, nothing more: ' + heads + ' + ' + paras);

  /* THE PLAN STILL CARRIES IT ALL, so a details view needs no engine change */
  const r = e.state.ingest.importResult;
  ok(r.addedRows.length === 1 && r.notTouched.unmatchedColumns.length === 1 &&
     r.blankSkipped.length > 0,
     'the result object still carries every category: only the RENDER dropped them');
});

guard('the addendum: a REJECTION keeps full detail', () => {
  const e = engine();
  const schema = e.api.getTableSchema(PAYLOAD.tables.A1, '2025');
  /* a duplicate label is a hard rejection with a named reason */
  const labels = ((PAYLOAD.tables.A1.data || {})['2025'] || []).map(r => String(r[0]));
  const fld = (v) => (/[",\r\n]/.test(String(v))
    ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  const rows = e.api.parseCsvRows([schema.map(fld).join(','),
    [fld(labels[0]), '1', '2', ''].join(','),
    [fld(labels[0]), '3', '4', ''].join(',')].join('\r\n') + '\r\n');
  const plan = e.api.buildIngestImport(rows, schema, [], 'A1');
  ok(!plan.ok, 'the fixture is rejected');
  e.state.ingest = { sectionId: 'A', tableId: 'A1', year: '2025' };
  e.api.initIngestState();
  e.state.ingest.importResult = plan;
  const panel = e.api.renderIngestImport();
  ok(/Nothing was imported/.test(panel), 'the panel says nothing was imported');
  ok(/draft below is untouched/.test(panel), 'and that the draft is untouched');
  ok(/rows with this label/.test(panel),
     'NAMING THE REASON, which is the CLCPA-85 law and is untouched here');
  ok((panel.match(/<li>/g) || []).length >= 1,
     'as a list, one entry per rejection: ' + (panel.match(/<li>/g) || []).length);
  /* the contrast is the ruling: detail where there is nothing else to read */
  ok(panel.length > 200,
     'a rejection panel is LONG where a success panel is two lines: ' +
     panel.length + ' chars');
});

/* ==================================================================== */
lines.push('');
lines.push('=== THE FIRST DRAW, where the predicate was wrong ===');
guard('the first draw', () => {
  /* THE DEFECT: before the first draw there is no input element, so
   * typedYear() is '' -- and isExisting() asked typedYear(). The dialog opened
   * on an existing year saying "2025 is new. It will be created" over an Add
   * Year button: the consequence line stating the wrong consequence, which is
   * the one thing it exists for.
   *
   * My earlier mapping test called consequenceText with an explicit isExisting
   * stub. That proved the MAPPING and never the PREDICATE, and the predicate
   * was what was broken. This drives the real chain instead, with the DOM
   * absent exactly as it is on the first draw. */
  const dlg = grab('openAddYearDialog');
  const from = dlg.indexOf('const fieldYear = () => {');
  const to = dlg.indexOf('const primaryLabel =');
  ok(from > 0 && to > from, 'the year accessors are found as one block');
  const block = dlg.slice(from, dlg.indexOf(';', to) + 1);

  /* modal.querySelector returns null on the first draw, and a node after it */
  const chain = (node, pageYear, years) => new Function('modal', 'pageYear', 'years',
    'const yearExists = (y) => years.indexOf(String(y)) >= 0;\n' + block +
    '\nreturn { drawYear: drawYear(), typedYear: typedYear(),' +
    ' isExisting: isExisting(), text: consequenceText(), label: primaryLabel() };')(
    { querySelector: () => node }, pageYear, years);

  const YEARS = ['2025', '2024', '2023'];
  /* FIRST DRAW, page standing on an EXISTING year */
  const first = chain(null, '2025', YEARS);
  ok(first.typedYear === '', 'on the first draw typedYear is empty, as it must be');
  ok(first.drawYear === '2025', 'while drawYear is the page year: ' + first.drawYear);
  ok(first.isExisting === true,
     'and the case is EXISTING, read from the value the field will show');
  ok(/^2025 already exists\./.test(first.text),
     'so the line says it exists: ' + first.text.slice(0, 52));
  ok(first.label === 'Load Data', 'and the button says Load Data: ' + first.label);

  /* FIRST DRAW, page standing on a year that does NOT exist */
  const firstNew = chain(null, '2099', YEARS);
  ok(firstNew.isExisting === false, 'a page year that does not exist reads as NEW');
  ok(/^2099 is new\./.test(firstNew.text), 'and the line says so: ' + firstNew.text.slice(0, 40));
  ok(firstNew.label === 'Add Year', 'with Add Year on the button');

  /* AFTER the draw, typing changes the case */
  const typedExisting = chain({ value: '2024' }, '2099', YEARS);
  ok(typedExisting.isExisting === true,
     'typing an existing year switches the case, whatever the page year was');
  ok(typedExisting.label === 'Load Data', 'and the label with it');
  const typedNew = chain({ value: '2100' }, '2025', YEARS);
  ok(typedNew.isExisting === false, 'and typing a new one switches back');
  ok(typedNew.label === 'Add Year', 'and the label again');
  ok(/^2100 is new\./.test(typedNew.text), 'naming the year typed, not the page year');

  /* THE SPLIT that makes both true: display follows the box, validation
   * follows what was typed. CLCPA-226 finding B is the second half. */
  ok(/const isExisting = \(\) => yearExists\(drawYear\(\)\);/.test(dlg),
     'DISPLAY reads drawYear, the value the field shows');
  ok(/const typedYear = \(\) => \{ const v = fieldYear\(\); return v == null \? '' : v; \};/
     .test(dlg), 'and typedYear still has NO fallback, for validation');
});
lines.push('');
lines.push('======================================================================');
lines.push('  ' + pass + ' passed, ' + fail + ' failed');
lines.push('======================================================================');
const out = lines.join('\n');
console.log(out);
fs.writeFileSync(path.join(__dirname, 'suite-234-output.txt'), out + '\n');
process.exitCode = fail ? 1 : 0;
