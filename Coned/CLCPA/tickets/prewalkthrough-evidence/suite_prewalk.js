/* PRE-WALKTHROUGH FIXES, three items, one session.
 *
 * NO TICKET NUMBERS YET. Item 1 is new; item 2 is CLCPA-233 A/B polish and
 * item 3 completes CLCPA-237 E. Their assertions live here together because the
 * three shipped as one brief; fold sections 2 and 3 into suite_233 and
 * suite_237 when the items get numbers.
 *
 * SCOPE IS ASSERTED, NOT PROMISED. The brief named four things not to touch --
 * D.1 first-row editability, the derive engine, DAC_SOURCE handling, and
 * anything outside the three items -- so section 4 pins each of them against
 * BASE.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSSREL = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
/* BASE: the deployed walkthrough build 4613f5bdc6, at main before this session */
const BASE = process.env.DAC_BASE_COMMIT || '1573d02';
const SRC = fs.readFileSync(path.join(REPO, REL), 'utf8');
const CSS = fs.readFileSync(path.join(REPO, CSSREL), 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const BASE_CSS = execSync('git show ' + BASE + ':"' + CSSREL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
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
say('PRE-WALKTHROUGH FIXES -- three items');
say('  BASE ' + BASE + ' (the deployed build 4613f5bdc6)');
say('======================================================================');

/* ==================================================================== */
say('');
say('=== 1. THE FALSE "NO 2024 BASELINE" CHIP ===');

guard('the cause, on the record', () => {
  /* THE BRIEF SUSPECTED A MIGRATION ARTEFACT: an old payload-shaped path, or a
   * key renamed by CLCPA-238, reporting "missing" against a dead source. It is
   * NOT that, and the evidence is in the data. */
  ok(P.tables.A9.mapping.status === 'NEW' && P.tables.A10.mapping.status === 'NEW',
     'A9 and A10 carry a STATIC mapping.status = "NEW"');
  ok(/No 2023 baseline/i.test(P.tables.A9.mapping.comparable),
     'and their own comparable field says "No 2023 baseline." -- a fixed fact ' +
     'about 2023: ' + JSON.stringify(P.tables.A9.mapping.comparable));
  ok(Object.keys(P.tables.A9.data).join(',') === '2024,2025',
     'while the data holds 2024 and 2025: ' + Object.keys(P.tables.A9.data).join(','));
  /* the old expression, quoted from BASE so the claim is checkable */
  const baseFn = codeOnly(grab('renderSourceTables', BASE_SRC));
  ok(/const isNew = !hasPrevData \|\| \(mapping\.status \|\| ''\) === 'NEW';/.test(baseFn),
     'BASE gated the chip on `!hasPrevData || status === "NEW"`');
  ok(/NO \$\{prevYear\} BASELINE/.test(baseFn),
     'while the chip TEXT interpolates prevYear dynamically -- so a fixed ' +
     'statement about 2023 printed as a claim about whichever year was selected');
  /* and hasPrevData was never the problem: it reads whatever payload.tables
   * holds, which under CLCPA-238 is the composed Dataverse data */
  ok(/\(t\.data \|\| \{\}\)\[prevYear\]/.test(codeOnly(grab('renderSourceTables'))),
     'the detection reads t.data[prevYear], which is the migrated source: the ' +
     'path was never payload-specific, so the migration is not the cause');
});

guard('the chip now renders only when the baseline is genuinely absent', () => {
  const fn = codeOnly(grab('renderSourceTables'));
  ok(/const isNew = !hasPrevData;/.test(fn),
     'isNew is now hasPrevData alone');
  ok(!/mapping\.status \|\| ''\) === 'NEW'/.test(fn),
     'the status disjunct is gone from the chip');
  /* mapping.status keeps its real job */
  ok(/mapping\.notes/.test(fn) && /Comparability:/.test(grab('renderSourceTables')),
     'and the comparability note still renders, which is where a permanent ' +
     'statement about 2023 belongs');

  /* DRIVEN FROM THE SHIPPED BYTES, both directions, both references.
   *
   * The first version of this block RETYPED the detection rule into the suite
   * and asserted on the copy. Every mutation of app.js left it green: it was
   * grading my transcription, not the dashboard. That is the values-retyped
   * defect class again, and the mutation run is what exposed it -- the control
   * `const isNew = false` went green here while only the structural pin moved.
   *
   * The rule now comes OUT of app.js as source text and is evaluated. Two
   * slices: the hasPrevData computation, and the isNew/noPrevBadge pair. So a
   * change to either line changes what runs below.
   *
   * `prevYear` and `headerLevels` are passed in as the SCENARIO ("viewing 2025,
   * prior year 2024"), not as part of the rule -- prevYear comes from
   * prevYearOf(year), pinned separately below. */
  const chipFn = (src) => {
    const f = grab('renderSourceTables', src);
    /* the block starts at storedHeaderRows in the fixed build and at
     * bodyRowsCurrent in BASE, which never had a header row to skip -- so the
     * anchor is whichever comes first, and BASE's slice simply declares one
     * fewer const */
    const s0 = f.indexOf('const storedHeaderRows');
    const c0 = f.indexOf('const bodyRowsCurrent');
    const a0 = (s0 >= 0 && s0 < c0) ? s0 : c0;
    const a1 = f.indexOf('\n', f.indexOf('const hasPrevData'));
    const b0 = f.indexOf('const isNew =');
    const b1 = f.indexOf('const noteHtml');
    if (c0 < 0 || a0 < 0 || a1 <= a0 || b0 < 0 || b1 <= b0) {
      throw new Error('the chip detection block could not be located');
    }
    return new Function('t', 'year', 'prevYear', 'headerLevels', 'mapping',
      f.slice(a0, a1) + '\n' + f.slice(b0, b1) + '\nreturn noPrevBadge;');
  };
  const chipOf = (src) => (id, year) => {
    const t = P.tables[id];
    const hl = t.header_levels !== undefined ? t.header_levels : 1;
    const years = P.meta.years;
    const i = years.indexOf(year);
    const prevYear = (i < 0 || i + 1 >= years.length) ? null : years[i + 1];
    const out = chipFn(src)(t, year, prevYear, hl, t.mapping || {});
    const m = /NO (\d{4}) BASELINE/.exec(out || '');
    return m ? m[0] : null;
  };
  const chip = chipOf(SRC);
  ok(P.meta.years.join(',') === '2025,2024,2023',
     'the year list is descending, so prevYearOf(2025) is 2024: ' +
     P.meta.years.join(','));

  ok(chip('A9', '2025') === null,
     'A9 on 2025 with 2024 present: NO CHIP -- the reported defect');
  ok(chip('A10', '2025') === null, 'A10 on 2025 with 2024 present: NO CHIP');
  ok(chip('A9', '2024') === 'NO 2023 BASELINE',
     'A9 on 2024, where 2023 is genuinely absent: the chip RENDERS');
  ok(chip('A10', '2024') === 'NO 2023 BASELINE',
     'A10 on 2024, likewise: absent means absent');
  ok(chip('A1', '2025') === null && chip('A1', '2024') === null,
     'A1 never shows it: it has all three years');
  ok(chip('F6', '2025') === null, 'F6 never shows it either');

  /* BASE CONTROL, same evaluator, the deployed build's own bytes: the defect
   * reproduces. Without this the fix is a claim about a chip nobody saw. */
  const baseChip = chipOf(BASE_SRC);
  ok(baseChip('A9', '2025') === 'NO 2024 BASELINE',
     'BASE control: A9 on 2025 DID print "NO 2024 BASELINE" -- the reported bug');
  ok(baseChip('A10', '2025') === 'NO 2024 BASELINE',
     'and A10 likewise');
  ok(baseChip('A9', '2024') === 'NO 2023 BASELINE' &&
     baseChip('A1', '2025') === null,
     'while BASE was right everywhere else, so only the false positive moved');
  ok((P.tables.A9.mapping || {}).status === 'NEW' &&
     /No 2023 baseline/.test((P.tables.A9.mapping || {}).comparable || ''),
     'and the static status that caused it is still on the table, unedited: ' +
     JSON.stringify(P.tables.A9.mapping));

  /* the header-row skip, which makes the check about DATA rather than markup */
  ok(/const storedHeaderRows = Math\.max\(0, headerLevels - 1\);/.test(fn),
     'and the check skips stored header rows, so a year holding only its own ' +
     'sub-header would not count as a baseline');
});

/* ==================================================================== */
say('');
say('=== 2. THE HEADER BAND: labels, not input chrome; centred ===');

guard('presentation only -- behaviour is untouched', () => {
  const ed = codeOnly(grab('renderIngestEditor'));
  const baseEd = codeOnly(grab('renderIngestEditor', BASE_SRC));
  /* the three behavioural facts the brief said not to change */
  ok(/if \(isHeaderRow\) \{/.test(ed), 'the header row still renders read-only');
  ok(/\$\{isHeaderRow \? ''/.test(ed), 'still has no delete button');
  ok(/if \(readOnlyByName\[colIdx\]\) \{/.test(ed), 'and % Change is still read-only');
  ok(/if \(isHeaderRow\) \{/.test(baseEd) && /if \(readOnlyByName\[colIdx\]\) \{/.test(baseEd),
     'all three were already true at BASE: this item changed none of them');
});

guard('the input chrome is gone', () => {
  const blk = (CSS.match(/\.ingest-row-subheader \.ingest-cell-calc \{[^}]*\}/) || [''])[0];
  ok(blk.length > 0, 'the sub-header cell rule is found');
  /* .ingest-cell-calc carries these four, and each has to be undone */
  ok(/border:\s*none/.test(blk), 'no border: the dashed box is gone');
  ok(/background:\s*transparent/.test(blk), 'no fill: the band supplies the shading');
  ok(/border-radius:\s*0/.test(blk), 'no radius');
  ok(/font-family:\s*inherit/.test(blk), 'and not the mono figure face');
  const baseBlk = (BASE_CSS.match(/\.ingest-row-subheader \.ingest-cell-calc \{[^}]*\}/) || [''])[0];
  ok(!/border:\s*none/.test(baseBlk),
     'BASE control: none of that was overridden, so the cells inherited the ' +
     'dashed input chrome');
  /* and the source of the chrome, quoted so the diagnosis is checkable */
  const calc = (CSS.match(/\n\.ingest-cell-calc \{[^}]*\}/) || [''])[0];
  ok(/border: 1px dashed/.test(calc),
     '.ingest-cell-calc is where the dashed border comes from');
});

guard('centring, in both views', () => {
  const blk = (CSS.match(/\.ingest-row-subheader \.ingest-cell-calc \{[^}]*\}/) || [''])[0];
  ok(/text-align:\s*center/.test(blk), 'sub-labels centre in their columns (editor)');
  ok(/\.ingest-row-subheader td:first-child \.ingest-cell-calc \{ text-align: left; \}/.test(CSS),
     'except the label column, which keeps its left edge');
  ok(/\.ingest-grid-2level thead th \{ text-align: center; \}/.test(CSS),
     'group headers centre in the editor');
  ok(/\.data-table-2level thead th \{ text-align: center; \}/.test(CSS),
     'and in the read-only viewer');
  ok(/\.data-table-2level thead tr:nth-child\(2\) th \{ text-align: center; \}/.test(CSS),
     'including the viewer second header line');
  /* SCOPED: single-level tables must be untouched, which is 48 of the 52 */
  ok(/\.ingest-grid-2level/.test(CSS) && !/\.ingest-grid thead th \{ text-align: center/.test(CSS),
     'the centring is scoped to two-level tables, never to every grid');
});

guard('the editor now merges group headers like the viewer always did', () => {
  const ed = grab('renderIngestEditor');
  ok(/colspan="\$\{span\}"/.test(ed),
     'the editor emits a colspan for repeated group labels');
  ok(/if \(!isTwoLevel\) \{/.test(ed),
     'and single-level tables take the untouched path');
  /* THE IDENTIFIER IS DECLARED IN THIS FUNCTION. The defect the sweep caught
   * was a name borrowed from renderSourceTables, which does not exist here. */
  ok(/const isTwoLevel = headerLevelsNum >= 2;/.test(codeOnly(ed)) &&
     /const headerLevelsNum = \(typeof table\.header_levels === 'number'\)/.test(codeOnly(ed)),
     'and both names it reads are declared inside renderIngestEditor itself');
  ok(!/storedHeaderRows/.test(codeOnly(ed)),
     'with no identifier borrowed from renderSourceTables left in it');
  /* drive it: A9's schema repeats each group label twice */
  const sch = P.tables.A9.schema_by_year['2025'];
  ok(JSON.stringify(sch) === '["","2024","2024","2025","2025","% Change","% Change"]',
     'A9 repeats each group label per column: ' + JSON.stringify(sch));
  /* DRIVEN FROM THE SHIPPED IIFE, not from a retyped copy of the rule.
   *
   * Same correction as section 1: the merge loop used to be transcribed into
   * the suite, so `if (true)` in app.js -- which turns the merge off entirely
   * -- left every arithmetic assertion here green. The headerCells IIFE is now
   * cut out of app.js and evaluated with `i` and escapeHtml supplied. */
  const headerCellsFn = (src) => {
    const f = grab('renderIngestEditor', src);
    const a0 = f.indexOf('const headerCells = ');
    /* both versions end the declaration at the blank line before "Build body
     * rows", and neither contains a blank line inside it -- an unchecked end
     * bound is a guess, so it is asserted rather than assumed */
    const a1 = f.indexOf('\r\n\r\n', a0);
    if (a0 < 0 || a1 <= a0) throw new Error('the headerCells declaration could not be located');
    return new Function('i', 'isTwoLevel', 'escapeHtml',
      f.slice(a0, a1) + '\nreturn headerCells;');
  };
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cells = (schema, isTwoLevel) =>
    headerCellsFn(SRC)({ schema: schema }, isTwoLevel, esc)
      .match(/<th[^>]*>/g) || [];

  const th = cells(sch, true);
  ok(th.length === 4, 'which merges to 4 header cells: ' + th.length);
  const spans = th.map(x => { const m = /colspan="(\d+)"/.exec(x); return m ? +m[1] : 1; });
  ok(spans.reduce((a, b) => a + b, 0) === sch.length,
     'and the spans still total the column count: ' +
     spans.join('+') + ' = ' + sch.length);
  ok(spans[1] === 2 && /<th colspan="2">2024<\/th>/.test(
       headerCellsFn(SRC)({ schema: sch }, true, esc)),
     '"2024" spans its Total/DAC pair');
  ok(th[0] === '<th class="ingest-th-label">',
     'and the row-label column keeps its own left-aligned class');
  /* SINGLE-LEVEL tables take the untouched path: one th per column, no span */
  const flat = cells(['Program', '2025', 'Notes'], false);
  ok(flat.length === 3 && !/colspan/.test(flat.join('')),
     'a single-level schema still emits one cell per column, unmerged: ' +
     flat.length);
  /* and the merge only ever collapses IDENTICAL adjacent labels */
  const mixed = cells(['', 'A', 'B', 'B'], true).map(x => /colspan="2"/.test(x));
  ok(mixed.join(',') === 'false,false,true',
     'only adjacent identical labels merge: ' + mixed.join(','));

  /* THE WHOLE EDITOR, RENDERED FOR REAL. Nothing above would have caught what
   * the regression sweep did: the first cut of this item referenced
   * `storedHeaderRows`, a name that lives in renderSourceTables and does not
   * exist in renderIngestEditor, so EVERY table in Report Data would have
   * thrown ReferenceError. Slicing the IIFE and supplying its inputs by hand
   * hid that -- a hand-fed slice cannot see a missing closure. So the function
   * is now assembled with its real dependencies and called. */
  const editorFor = (tableId, year) => {
    const t = P.tables[tableId];
    const st = { payload: P, ingest: {
      tableId: tableId, year: year,
      schema: (t.schema_by_year || {})[year],
      baseline: JSON.parse(JSON.stringify((t.data || {})[year] || [])),
      draft: JSON.parse(JSON.stringify((t.data || {})[year] || [])),
      dirty: false,
    } };
    const FNS = ['renderIngestEditor', 'recomputeTotals', 'detectPctColumns',
      'detectAvgColumns', 'unreconciledTotals', 'totalRowSums', 'totalRowFlags',
      'columnGrandTotals', 'applyDerivedCols', 'applyDerivedRows', 'recomputeDirty',
      'ingestStatusClass', 'ingestStatusText', 'columnNumericMask',
      'detectCurrencyColumns', 'isNumeric', 'rawNum', 'isSplitCell',
      'formatIngestValue', 'fmtDerivedCell', 'sumDerivedCols',
      'withinSourceRounding', 'addsOnlyPrecision', 'storedDecimals'];
    const body = ['DERIVED_COLS', 'DERIVED_ROWS'].map(n => grabDecl(n)).join('\n') +
      '\n' + FNS.map(n => grab(n)).join('\n') + '\nreturn renderIngestEditor;';
    return new Function('state', 'escapeHtml', 'document', body)(
      st, esc, { getElementById: () => null })();
  };
  const theadOf = (html) => {
    const m = /<thead>([\s\S]*?)<\/thead>/.exec(html);
    return m ? m[1] : '';
  };
  const a9 = editorFor('A9', '2025');
  ok(/<table class="ingest-grid ingest-grid-2level">/.test(a9),
     'A9 renders WITHOUT throwing, and its table carries the two-level marker');
  const a9th = (theadOf(a9).match(/<th[^>]*>/g) || []);
  ok(a9th.length === 5 && /colspan="2"/.test(theadOf(a9)),
     'its rendered thead really has the merge in it: 4 group cells plus the ' +
     'actions column = ' + a9th.length);
  ok(/<th colspan="2">2024<\/th>/.test(theadOf(a9)),
     'and "2024" spans its pair in the DOM the editor actually emits');
  const a1 = editorFor('A1', '2025');
  ok(/<table class="ingest-grid">/.test(a1),
     'A1, single-level, renders and does NOT get the marker');
  ok(!/colspan/.test(theadOf(a1)),
     'and its thead has no colspan at all: 48 of the 52 tables are untouched');
  /* an EMPTY two-level draft must still merge: the thead is not body-dependent */
  const empt = { tables: { A9: {
    header_levels: 2,
    schema_by_year: { '2025': P.tables.A9.schema_by_year['2025'] },
    data: { '2025': [] }, title_by_year: {}, mapping: {} } }, meta: P.meta };
  const savedP = P.tables.A9.data['2025'];
  ok((() => {
    const t = empt.tables.A9;
    const st = { payload: empt, ingest: { tableId: 'A9', year: '2025',
      schema: t.schema_by_year['2025'], baseline: [], draft: [], dirty: false } };
    const FNS2 = ['renderIngestEditor', 'recomputeTotals', 'detectPctColumns',
      'detectAvgColumns', 'unreconciledTotals', 'totalRowSums', 'totalRowFlags',
      'columnGrandTotals', 'applyDerivedCols', 'applyDerivedRows', 'recomputeDirty',
      'ingestStatusClass', 'ingestStatusText', 'columnNumericMask',
      'detectCurrencyColumns', 'isNumeric', 'rawNum', 'isSplitCell',
      'formatIngestValue', 'fmtDerivedCell', 'sumDerivedCols',
      'withinSourceRounding', 'addsOnlyPrecision', 'storedDecimals'];
    const body = ['DERIVED_COLS', 'DERIVED_ROWS'].map(n => grabDecl(n)).join('\n') +
      '\n' + FNS2.map(n => grab(n)).join('\n') + '\nreturn renderIngestEditor;';
    const html = new Function('state', 'escapeHtml', 'document', body)(
      st, esc, { getElementById: () => null })();
    return /colspan="2"/.test(theadOf(html)) &&
      /ingest-grid ingest-grid-2level/.test(html);
  })(),
     'and a two-level table with an EMPTY draft still merges: the group header ' +
     'reads header_levels, not the row count');
  ok(P.tables.A9.data['2025'] === savedP,
     'and the payload fixture was not mutated by any of that');

  /* BASE control: the editor did NOT merge, so 2024 appeared twice */
  const baseTh = (headerCellsFn(BASE_SRC)({ schema: sch }, true, esc)
    .match(/<th[^>]*>/g) || []);
  ok(baseTh.length === 7 && !/colspan/.test(baseTh.join('')),
     'BASE control: the editor emitted 7 unmerged cells, so each group label ' +
     'printed once per column: ' + baseTh.length);
  ok(/data-table-2level/.test(CODE),
     'and the viewer table carries the marker the stylesheet needs');
});

/* ==================================================================== */
say('');
say('=== 3. THE EMPTY EXECUTIVE SUMMARY (PINNED to d658ab7) ===');
/* SECTION 3'S SUBJECT WAS DELETED THE NEXT MORNING.
 *
 * Item 3 gave the empty year the populated anatomy in placeholder form. Emely
 * then ruled CLCPA-237 item F in and expanded it -- walkthrough-critical,
 * because a live import lands on this screen -- and item F deletes the empty
 * branch entirely: ONE layout for every year, the real renderers dashing where
 * a year has no data. The placeholders, the pair/solo grids and anyData all go
 * with it.
 *
 * So these assertions are true of d658ab7, which is the build item 3 shipped
 * as and what this brief is answerable for. They are pinned there rather than
 * relaxed, because relaxing them to tolerate a deletion would leave nothing
 * being checked. suite_237f owns the live claim, including the 2025
 * zero-visual-diff guard in its own section 5.
 *
 * Item F also settled why item 3's grid modifiers never rendered: a later
 * `.exec-shares-grid { ... !important }` block owned the columns and placed the
 * children by nth-child. Sections 1, 2 and 4 below are NOT pinned -- the chip
 * and the header band are untouched by item F and stay under a live check.
 */
const F_REV = process.env.DAC_PREWALK_COMMIT || 'd658ab7';
const P3_SRC = process.env.DAC_APP_OVERRIDE ? SRC
  : execSync('git show ' + F_REV + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const P3_CSS = process.env.DAC_APP_OVERRIDE ? CSS
  : execSync('git show ' + F_REV + ':"' + CSSREL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');

/* THE EMPTY BRANCH, BOUNDED AT ITS OWN END.
 *
 * My first version sliced from 'if (!anyData)' to indexOf('return `\n'), a
 * pattern that does not survive codeOnly -- so indexOf returned -1,
 * slice(i, -1) ran to the end of the function, and the POPULATED branch came
 * along with it. The id assertion then counted three ids instead of two and
 * failed on markup that was correct.
 *
 * Both branches end with the dac-tract-detail div, so the FIRST one after the
 * start is this branch's own end. A slice with an unchecked end bound is not a
 * slice, it is a guess. */
function emptyBranchOf(src) {
  const c = codeOnly(grab('renderExecutiveSummary', src));
  const i = c.indexOf('if (!anyData)');
  const j = c.indexOf('dac-tract-detail', i);
  if (i < 0 || j < 0) return '';
  return c.slice(i, j);
}

guard('every populated visual has a position in the empty state', () => {
  const ex = grab('renderExecutiveSummary', P3_SRC);
  const c = codeOnly(ex);
  const empty = emptyBranchOf(P3_SRC);
  ok(empty.length > 0, 'the empty branch is located');
  /* the populated reference: header cards, then the shares grid with three */
  ok(/renderHeaderCards\(\)/.test(c), 'the populated branch renders header cards');
  /* EXACT class attributes and EXACT call sites. The first version tested for
   * the substring 'exec-header-cards', which a rename to
   * 'exec-header-cards-gone' still satisfies -- a guard that survives the
   * thing it guards against is not a guard. */
  ok(/class="exec-header-cards exec-header-cards-empty" id="exec-header-cards"/.test(empty),
     'and the empty branch renders that row too, rather than dropping it');
  ok(/emptyCard\('Reported KPIs'/.test(empty),
     'holding a named placeholder where the KPI cards sit');
  ok(/emptyCard\('DAC Impact \u00b7 Movement vs Prior Year'/.test(empty),
     'the dumbbell position is held by a named placeholder');
  ok(/emptyCard\('DAC Impact by Section'/.test(empty),
     'and the strip position likewise');
  ok((empty.match(/emptyCard\(/g) || []).length === 3,
     'three placeholders and the helper that makes them, no more and no ' +
     'fewer: ' + (empty.match(/emptyCard\(/g) || []).length + ' call sites');
  ok(/renderDACMap\(baseline, year, sections\)/.test(empty),
     'and the map renders FOR REAL, not as a placeholder');
  ok((empty.match(/emptyYearPane\(/g) || []).length === 2,
     'each placeholder says so explicitly, through the shared empty pane');

  /* BASE control: they really did vanish */
  const baseEmpty = emptyBranchOf(BASE_SRC);
  ok(!/exec-header-cards/.test(baseEmpty),
     'BASE control: the empty branch rendered NO header cards');
  ok(!/DAC Impact by Section/.test(baseEmpty),
     'and no strip: every year-dependent visual disappeared');
  ok(/renderDACMap/.test(baseEmpty), 'only the map survived, alone');
});

guard('the map is full width, the placeholders are a pair', () => {
  const c = codeOnly(grab('renderExecutiveSummary', P3_SRC));
  const empty = emptyBranchOf(P3_SRC);
  ok(/exec-shares-grid-pair/.test(empty),
     'the two year-dependent placeholders share a two-column row');
  ok(/exec-shares-grid-solo/.test(empty),
     'and the map has a single-column row of its own: full width');
  ok(/\.exec-shares-grid-pair \{ grid-template-columns: 1fr 1fr; \}/.test(P3_CSS),
     'the pair modifier is two columns');
  ok(/\.exec-shares-grid-solo \{ grid-template-columns: 1fr; \}/.test(P3_CSS),
     'the solo modifier is one');
  ok(/\.exec-header-cards-empty \{ grid-template-columns: 1fr; \}/.test(P3_CSS),
     'and the single header placeholder spans its row instead of leaving gaps');
  /* NO DUPLICATE IDS: two grids in one page cannot share an id */
  const ids = (empty.match(/id="exec-shares-[a-z-]*"/g) || []);
  ok(ids.length === 2 && ids[0] !== ids[1],
     'the two grids carry DIFFERENT ids: ' + ids.join(', '));
  ok(!/getElementById\('exec-shares-grid'\)/.test(codeOnly(P3_SRC)),
     'and nothing looks that id up, so renaming one is safe');
});

guard('THE REGRESSION GUARD: 2025 renders with zero visual diff', () => {
  /* item 3 may only affect years WITHOUT data. The populated branch is
   * therefore asserted byte-identical to BASE -- which is the whole claim,
   * because 2025 takes that branch and nothing else. */
  /* THIS GUARD WAS VACUOUS AND THE MUTATION RUN CAUGHT IT.
   *
   * It searched for 'return `\n' -- a CRLF file has 'return `\r\n', so
   * indexOf returned -1 and slice(-1) took the LAST CHARACTER. The most
   * important assertion in the suite compared one character to one character
   * and could not fail. Exactly the defect the comment above emptyBranchOf
   * describes; I fixed it there and left it here. Eighth pin that read nothing.
   *
   * The populated branch is now bounded from BOTH ends: it starts at the first
   * `return \`` AFTER the empty branch's own dac-tract-detail, and runs to the
   * end of the function. Both bounds are checked, and the comparison is exact
   * -- no whitespace collapsing, because a reflow is a visual change too. */
  const populatedOf = (src) => {
    const c = codeOnly(grab('renderExecutiveSummary', src));
    const i = c.indexOf('if (!anyData)');
    const j = c.indexOf('dac-tract-detail', i);
    const k = c.indexOf('return `', j);
    if (i < 0 || j < 0 || k < 0) return null;
    return c.slice(k);
  };
  const popNow = populatedOf(P3_SRC), popBase = populatedOf(BASE_SRC);
  ok(popNow && popBase && popNow.length > 400 && popBase.length > 400,
     'both populated branches are located and bounded: ' +
     (popNow || '').length + ' vs ' + (popBase || '').length + ' chars');
  ok(popNow === popBase,
     'the POPULATED branch is byte-identical to BASE, so 2025 is untouched by ' +
     'item 3');
  /* and it really is the branch 2025 renders: the three real visuals are in it */
  ok(/renderHeaderCards\(\)/.test(popNow) &&
     /renderDumbbell\(baseline, year, sections\)/.test(popNow) &&
     /renderStripWithGap\(baseline, year, sections\)/.test(popNow),
     'and that branch is the one 2025 takes: header cards, dumbbell and strip ' +
     'all render for real in it');
  /* and anyData itself is unchanged: which years are "empty" has not moved */
  const anyOf = (src) => {
    const c = codeOnly(grab('renderExecutiveSummary', src));
    const i = c.indexOf('const anyData');
    return c.slice(i, c.indexOf(';', c.indexOf('kpis.reported.some', i))).replace(/\s+/g, ' ');
  };
  ok(anyOf(P3_SRC) === anyOf(BASE_SRC),
     'and the anyData test is unchanged, so no populated year becomes empty');
});

/* ==================================================================== */
say('');
say('=== 4. WHAT THE BRIEF SAID NOT TO TOUCH ===');

guard('the four exclusions', () => {
  /* D.1 first-row editability */
  const ed = codeOnly(grab('renderIngestEditor'));
  ok(/if \(typeof lv !== 'number' \|\| lv < 2\) return 0;/.test(ed),
     'D.1 stays outside the header family: header_levels 0 yields 0 header rows');
  ok(P.tables.D1.header_levels === 0,
     'and D1 does carry 0, so its first row is editable with its x');

  /* the derive engine */
  const dc = grabDecl('DERIVED_COLS'), baseDc = grabDecl('DERIVED_COLS', BASE_SRC);
  ok(dc === baseDc, 'DERIVED_COLS is byte-identical to BASE');
  ['applyDerivedCols', 'rowsForDisplay', 'recomputeTotals', 'kpiDacPct'].forEach(fn => {
    ok(grab(fn) === grab(fn, BASE_SRC), fn + ' is byte-identical to BASE');
  });

  /* DAC_SOURCE handling */
  ok(/var DAC_SOURCE = 'dataverse';/.test(CODE), "DAC_SOURCE is still 'dataverse'");
  ok(grab('composePayloadFromRows') === grab('composePayloadFromRows', BASE_SRC),
     'the composer is byte-identical to BASE');
  ok(grab('dacShadowCompare') === grab('dacShadowCompare', BASE_SRC),
     'and so is the shadow compare');

  /* and the blast radius, at function granularity */
  const names = new Set();
  [SRC, BASE_SRC].forEach(s => {
    const r = /\r\n  (?:async )?function (\w+)\(/g;
    let m; while ((m = r.exec(s))) names.add(m[1]);
  });
  const changed = [];
  names.forEach(n => { if (grab(n, BASE_SRC) !== grab(n, SRC)) changed.push(n); });
  changed.sort();
  say('       changed functions: ' + changed.join(', '));
  /* FIVE now, not four, and the fifth is NAMED rather than tolerated.
   *
   * CLCPA-237 item F -- ruled in the next morning as walkthrough-critical --
   * added computeHeaderCards, fixing two defects the empty branch had been
   * hiding: a null dereference that THREW on a new year beside a populated
   * prior one, and a reduce seeded at 0 that reported "$0 invested" for a year
   * with no data. Both are asserted in suite_237f, driven. Item F also rewrote
   * renderExecutiveSummary again, to delete the branch item 3 had built.
   *
   * A blast radius that silently grows is not a blast radius, so every member
   * is accounted for by name and the count is exact. */
  const EXPECT = {
    renderSourceTables: 'item 1, the chip, and the header-row skip',
    renderTable: 'item 2, the two-level table marker',
    renderIngestEditor: 'item 2, the merged group headers',
    renderExecutiveSummary: 'item 3, the empty-state layout -- then DELETED by ' +
      'CLCPA-237 item F, which suite_237f owns',
    computeHeaderCards: 'NOT this brief: CLCPA-237 item F, the card crash and ' +
      'the invented $0',
  };
  changed.forEach(n => ok(n in EXPECT, 'the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  ok(changed.length === 5, 'exactly FIVE functions changed: ' + changed.length);
  ok(changed.every(n => n in EXPECT),
     'and no function outside those five moved at all');
});

say('');
say('======================================================================');
say('  ' + pass + ' passed, ' + fail + ' failed');
say('======================================================================');

const out = lines.join('\n') + '\n';
process.stdout.write(out);
fs.writeFileSync(path.join(__dirname, 'suite-prewalk-output.txt'), out);
process.exitCode = fail ? 1 : 0;
