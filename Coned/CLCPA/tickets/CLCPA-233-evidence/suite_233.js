/* CLCPA-233 items A and B: the editor honours header_levels, and A9's
 * "% Change" columns stop being typeable.
 *
 * DRIVEN, NOT READ. This extracts the SHIPPED renderIngestEditor from app.js
 * with its whole dependency closure -- 19 functions and 2 rule tables, resolved
 * by calling it and following each ReferenceError -- and renders the real HTML
 * for A9, A10, F6, D1 and a normal table. The assertions are about markup that
 * actually came out, not about source text that looks right.
 *
 * WHAT IS BEING FIXED. A9, A10 and F6 carry header_levels = 2: schema_by_year
 * is header row 1 and data[0] IS HEADER ROW 2, stored as a data row because
 * that is the only place it can live in this shape. renderTable has always
 * known (rows.slice(headerLevels)); the EDITOR never read the flag, so it drew
 * data[0] as an ordinary row with editable inputs and a delete button.
 *
 * ZERO STORED CHANGE, and that is asserted rather than asserted-about: the
 * sub-header stays exactly where it is, because that is where the report reads
 * it. No Dataverse row is touched by this ticket.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSSREL = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
/* BASE: main before this session. It never moves. */
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
say('CLCPA-233 items A + B -- the editor and the two-level header');
say('  BASE ' + BASE + ' (main before this session)');
say('======================================================================');

/* ---- the shipped renderer, with its real closure --------------------- */
const FNS = ['renderIngestEditor', 'recomputeTotals', 'detectPctColumns',
  'detectAvgColumns', 'unreconciledTotals', 'totalRowSums', 'totalRowFlags',
  /* CLCPA-240: totalRowFlags now calls the whole-label predicate for a
   * total row that has no numbers yet, so the closure needs it. */
  'isStrictTotalRowLabel', 'isHierarchicalTotalLabel',
  /* CLCPA-244: the editor now asks whether a derived rule is total-row-only. */
  'isTotalOnlyDerived',
  'columnGrandTotals', 'applyDerivedCols', 'applyDerivedRows', 'recomputeDirty',
  'ingestStatusClass', 'ingestStatusText', 'columnNumericMask',
  'detectCurrencyColumns', 'isNumeric', 'rawNum', 'isSplitCell',
  'formatIngestValue', 'fmtDerivedCell', 'sumDerivedCols', 'withinSourceRounding', 'addsOnlyPrecision', 'storedDecimals',
  /* CLCPA-240 round 2: the editor now locks the hierarchical family's group
   * header rows, which reaches these three. Dependencies of the function, not
   * assertions about it -- without them it cannot be assembled at all. */
  'ingestIsHeaderRow', 'ingestIsShapeBlank', 'normIngestKey'];
const DECLS = ['DERIVED_COLS', 'DERIVED_ROWS'];
/* CLCPA-240 round 2: single-line consts, read with a bounded one-line match.
 * The grabDecl above scans to the next dedented `};` and would swallow
 * whatever follows a one-liner. Read from the SOURCE, never retyped. */
const R2_DECLS = ['HIERARCHICAL_TABLES', 'INGEST_CALC_MARKER', 'INGEST_NOVALUE_MARKER']
  .map(n => (SRC.match(new RegExp('\\r\\n  const ' + n + ' = [^;\\r\\n]*;')) || [''])[0].trim())
  .filter(Boolean).join('\n');

function renderFor(tableId, year) {
  const t = P.tables[tableId];
  const state = { payload: P, ingest: {
    tableId: tableId, year: year,
    schema: (t.schema_by_year || {})[year],
    baseline: JSON.parse(JSON.stringify((t.data || {})[year] || [])),
    draft: JSON.parse(JSON.stringify((t.data || {})[year] || [])),
    dirty: false,
  } };
  const body = DECLS.map(n => grabDecl(n)).join('\n') + '\n' + R2_DECLS + '\n' +
    FNS.map(n => grab(n)).join('\n') + '\nreturn renderIngestEditor;';
  const f = new Function('state', 'escapeHtml', 'document', body)(
    state, (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;'),
    { getElementById: () => null });
  return f();
}
/* the rows of the rendered grid, as raw <tr> strings */
function rowsOf(html) {
  const m = html.match(/<tr[^>]*data-row="\d+"[\s\S]*?<\/tr>/g) || [];
  return m;
}

say('');
say('=== 1. THE FAMILY: which tables have a stored sub-header ===');
guard('the family', () => {
  const fam = {};
  Object.keys(P.tables).forEach(id => {
    const h = P.tables[id].header_levels;
    if (h !== undefined) fam[id] = h;
  });
  ok(JSON.stringify(fam) === JSON.stringify({ A9: 2, A10: 2, D1: 0, F6: 2 }),
     'exactly four tables carry header_levels: ' + JSON.stringify(fam));
  ok(fam.A9 === 2 && fam.A10 === 2 && fam.F6 === 2,
     'A9, A10 and F6 are the two-level family');
  /* D1 IS THE TRAP. It has the key and is NOT in the family, so "has a
   * header_levels key" would have been the wrong predicate and would have made
   * D1's first Compensation Type read-only for no reason. */
  ok(fam.D1 === 0, 'D1 carries header_levels = 0, which means something else');
  const d1 = P.tables.D1.data['2025'][0];
  ok(Array.isArray(d1) && /Community Distributed Generation/.test(String(d1[0])),
     'and D1 data[0] is genuine data, not a header: ' + String(d1[0]).slice(0, 40));

  /* every family member really does keep its sub-header in data[0], every year */
  ['A9', 'A10', 'F6'].forEach(id => {
    const years = Object.keys(P.tables[id].data || {});
    const allSub = years.every(y => {
      const r = P.tables[id].data[y][0];
      return Array.isArray(r) && (r[0] === null || r[0] === '') &&
        r.slice(1).some(c => typeof c === 'string');
    });
    ok(allSub, id + ' keeps a text sub-header in data[0] for all ' +
      years.length + ' of its years');
  });
});

say('');
say('=== 2. THE RENDER: a header row has no input and no delete ===');
guard('A9, A10 and F6 render row 0 as header', () => {
  ['A9', 'A10', 'F6'].forEach(id => {
    const years = Object.keys(P.tables[id].data || {});
    const y = years[years.length - 1];
    const html = renderFor(id, y);
    const rows = rowsOf(html);
    ok(rows.length === P.tables[id].data[y].length,
       id + ' ' + y + ': every stored row is still rendered (' + rows.length +
       ') -- the header row is not DROPPED, it is made read-only');
    const r0 = rows[0] || '';
    ok(/class="ingest-row-subheader"/.test(r0),
       '  row 0 is marked as the sub-header');
    ok(!/<input/.test(r0), '  row 0 contains NO input: nothing to type into');
    ok(!/ingest-row-delete/.test(r0), '  and NO delete button: the row cannot be removed');
    /* and the rows below it are still fully editable */
    const r1 = rows[1] || '';
    ok(/<input/.test(r1), '  row 1 still has inputs: only the header changed');
    ok(/ingest-row-delete/.test(r1), '  and row 1 still has its delete button');
  });
});

guard('the header branch wins over the derived branch', () => {
  /* A10's columns 3 and 6 HAVE a derive rule. Without the header check running
   * first, the sub-header's "% DAC" text would be routed through fmtDerivedCell
   * as though it were a percentage. */
  const html = renderFor('A10', '2025');
  const r0 = rowsOf(html)[0] || '';
  ok(/% DAC/.test(r0),
     'A10 row 0 still shows its "% DAC" header text verbatim');
  ok(!/<input/.test(r0), 'and offers nothing to type');
  const stored = P.tables.A10.data['2025'][0];
  stored.forEach((v, idx) => {
    if (v == null || v === '') return;
    ok(r0.indexOf(String(v)) >= 0,
      '  header cell ' + idx + ' (' + JSON.stringify(v) + ') survives the render');
  });
});

guard('tables OUTSIDE the family are untouched', () => {
  /* the regression that matters: 48 of 52 tables have no sub-header and must
   * still render row 0 as an editable, deletable data row */
  ['A1', 'B1', 'D1', 'J9'].forEach(id => {
    const years = Object.keys(P.tables[id].data || {});
    const y = years[years.length - 1];
    const rows = rowsOf(renderFor(id, y));
    const r0 = rows[0] || '';
    ok(!/ingest-row-subheader/.test(r0), id + ' row 0 is NOT marked a sub-header');
    ok(/<input/.test(r0), '  and still has inputs');
    ok(/ingest-row-delete/.test(r0), '  and still has its delete button');
  });
});

say('');
say('=== 3. ITEM B: A9 "% Change" is read-only, and only A9 ===');
guard('the read-only columns', () => {
  /* measured: /% Change/ matches A9 columns 5 and 6 in 2024 and 2025 and
   * NOTHING else in any of the 52 tables. So a name rule and a hard-coded A9
   * list are the same set today -- and the name rule survives a column moving. */
  const hits = [];
  Object.keys(P.tables).forEach(id => {
    Object.keys(P.tables[id].schema_by_year || {}).forEach(y => {
      (P.tables[id].schema_by_year[y] || []).forEach((h, idx) => {
        if (h != null && /^\s*%\s*change\s*$/i.test(String(h))) hits.push(id + ':' + y + ':' + idx);
      });
    });
  });
  ok(hits.join(',') === 'A9:2024:5,A9:2024:6,A9:2025:5,A9:2025:6',
     'the name rule matches exactly A9 cols 5 and 6, both years: ' + hits.join(','));

  const html = renderFor('A9', '2025');
  const rows = rowsOf(html);
  /* row 1 is the first DATA row */
  const r1 = rows[1] || '';
  const tds = r1.match(/<td[\s\S]*?<\/td>/g) || [];
  ok(tds.length === 8, 'a data row renders 7 cells plus the actions cell: ' + tds.length);
  ok(/<input/.test(tds[1]) && /<input/.test(tds[4]),
     'the 2024 and 2025 figure columns are still editable');
  ok(!/<input/.test(tds[5]) && !/<input/.test(tds[6]),
     'but BOTH "% Change" columns offer no input');
  ok(/ingest-cell-calc/.test(tds[5]) && /ingest-cell-calc/.test(tds[6]),
     'they render as read-only cells');
  ok(tds[5].indexOf('-26%') >= 0,
     'showing the value the source published, not a recomputed one: -26%');
  /* NOT computed -- item C is post-Sept-10, and this must not silently do it */
  /* THE CONTROL FOR THE NAME RULE, and a mutation exposed the need for it.
   *
   * Loosening the regex to a bare /%/ went GREEN, because A9's own schema has
   * no other column containing a percent sign -- so on A9 the loose and strict
   * rules pick the same two columns. The rule had to be tested against a table
   * that WOULD be caught by the loose version.
   *
   * J1 is that table: percentage columns at 2 and 4, and NO derive rule, so
   * they are legitimately editable today. A bare /%/ would freeze them. */
  const j1 = rowsOf(renderFor('J1', '2025'));
  const j1r0 = (j1[0] || '').match(/<td[\s\S]*?<\/td>/g) || [];
  ok(j1r0.length > 4, 'J1 renders its columns: ' + j1r0.length);
  ok(/<input/.test(j1r0[2]) && /<input/.test(j1r0[4]),
     'J1 percentage columns 2 and 4 are STILL EDITABLE: the name rule matches ' +
     '"% Change" and not every column with a percent sign in it');

  const derived = new Function(grabDecl('DERIVED_COLS') + '\nreturn DERIVED_COLS;')();
  ok(!derived.J1, 'and J1 has no derive rule, which is why those columns are input');
  ok(!derived.A9, 'A9 still has NO derive rule: read-only is not computed');
  ok(!!derived.A10 && derived.A10.length === 2,
     'while A10 keeps its two, which is why its % DAC is computed');
});

say('');
say('=== 4. ZERO STORED CHANGE, and the import cannot reach the header ===');
guard('nothing about the store moved', () => {
  /* the composer and the seed are the store's two authors in this project */
  const base = codeOnly(BASE_SRC);
  const comp = grab('composePayloadFromRows');
  const baseComp = grab('composePayloadFromRows', BASE_SRC);
  ok(!!comp && !!baseComp, 'the composer is found at HEAD and at BASE');
  /* CORRECTED. I asserted this was byte-identical to BASE and it is NOT --
   * because CLCPA-237 item E changed the phantom-KPI guard inside it, in the
   * same session. The claim I actually need is narrower and true: the composer's
   * only diff is that READ-SIDE guard, and CLCPA-233 contributes nothing to it.
   *
   * Asserting the wrong thing confidently is how the A7 shape error survived a
   * whole round, so the shape of this claim matters as much as its result. */
  const cDiff = codeOnly(comp).replace(/\s+/g, ' ');
  const bDiff = codeOnly(baseComp).replace(/\s+/g, ' ');
  ok(cDiff !== bDiff, 'the composer DID change in this session (CLCPA-237 item E)');
  ok(/const usable = v &&/.test(codeOnly(comp)),
     'and the change is the usable-value guard');
  /* the 233-relevant claim: nothing about the header or the read-only columns
   * reaches the composer at all */
  ok(!/header_levels/.test(codeOnly(comp).replace(/cr2bf_presentation[\s\S]{0,400}/, '')) ||
     /p\.header_levels/.test(codeOnly(comp)),
     'the composer touches header_levels only where it already did, to carry ' +
     'the presentation hint through');
  ok(!/% *[Cc]hange/.test(comp),
     'and knows nothing about "% Change": item B is editor-only');
  const save = grab('openSaveModal'), baseSave = grab('openSaveModal', BASE_SRC);
  ok(save === baseSave, 'and openSaveModal is byte-identical: the save path is untouched');
  ok(!/PERSIST_STRIP_TABLES = new Set\(\[\s*'A1', 'A2', 'A5', 'A6', 'A7', 'A8', 'A10'/.test(CODE) === false,
     'PERSIST_STRIP_TABLES is unchanged, so no column starts being stripped');

  /* THE IMPORT ALREADY CANNOT TARGET ROW 0, and asserting it locks that in.
   * labelIndex is built with `if (k && ...)`, and the sub-header's label
   * normalises to the empty string, so it is never indexed. A file row with no
   * label is rejected outright. */
  const bi = grab('buildIngestImport');
  ok(!!bi, 'buildIngestImport is found');
  ok(/if \(k && labelIndex\[k\] === undefined\) labelIndex\[k\] = idx;/.test(codeOnly(bi)),
     'the import indexes a row ONLY when its label is non-empty');
  ok(/the row has no label/.test(bi),
     'and rejects a file row with no label, naming the reason');
  const norm = new Function(grab('normIngestKey') + '\nreturn normIngestKey;')();
  ok(norm(null) === '' && norm('') === '',
     'a null or empty label normalises to the empty string, so the sub-header ' +
     'is unreachable by import: ' + JSON.stringify(norm(null)));
});

say('');
say('=== 5. BASE CONTROL: the defect really was there ===');
guard('BASE rendered it as an ordinary row', () => {
  const baseEditor = grab('renderIngestEditor', BASE_SRC);
  ok(!!baseEditor, 'the BASE editor is found');
  const bc = codeOnly(baseEditor);
  ok(!/header_levels/.test(bc),
     'at BASE the editor never mentioned header_levels');
  ok(!/ingest-row-subheader/.test(bc), 'and had no sub-header row class');
  ok(/ingest-row-delete/.test(bc),
     'while rendering a delete button -- for every row, including data[0]');
  /* and the report DID know, which is the asymmetry the ticket names */
  ok(/rows\.slice\(headerLevels\)/.test(codeOnly(BASE_SRC)),
     'renderTable already sliced header rows off at BASE: the report was right ' +
     'and only the editor was wrong');
});

say('');
say('=== 6. THE CSS: a header row looks like a header ===');
guard('the sub-header styling', () => {
  ok(/\.ingest-row-subheader td \{/.test(CSS),
     '.ingest-row-subheader td exists');
  const blk = (CSS.match(/\.ingest-row-subheader td \{[^}]*\}/) || [''])[0];
  ok(/background:/.test(blk), 'it sets a background, so the row reads as a header');
  ok(/border-bottom/.test(blk), 'and a bottom border separating it from the data');
  /* SCOPED TO THE BLOCK. My first version used a lazy [\s\S]*? between the
   * selector and the declaration, and a mutation that DELETED the font-weight
   * went green: the match simply carried on past the closing brace and found
   * one of the other 124 "font-weight: 600" declarations in the file. A regex
   * that can leave its own block is not testing that block. */
  const cellBlk = (CSS.match(/\.ingest-row-subheader \.ingest-cell-calc \{[^}]*\}/) || [''])[0];
  ok(/font-weight:\s*600/.test(cellBlk),
     'and its cells are weighted, so "Total / DAC" does not read as a computed row');
});

say('');
say('======================================================================');
say('  ' + pass + ' passed, ' + fail + ' failed');
say('======================================================================');

const out = lines.join('\n') + '\n';
process.stdout.write(out);
fs.writeFileSync(path.join(__dirname, 'suite-233-output.txt'), out);
process.exitCode = fail ? 1 : 0;
