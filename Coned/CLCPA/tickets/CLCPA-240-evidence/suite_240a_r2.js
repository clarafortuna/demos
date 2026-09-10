/* CLCPA-240 first half, ROUND 2: hierarchical structure rows are protected.
 *
 * Emely's finding after the round-1 hosted pass: the import works, but the
 * structure it depends on is unguarded on both surfaces. In Report Data a
 * group header row rendered as an ordinary row -- editable label, editable
 * cells, delete button -- and deleting one silently re-keys every row beneath
 * it, because the group context IS the preceding header. In the downloaded
 * template a header row carried no marking at all, so an operator could type
 * values into it with nothing saying not to.
 *
 * THE GUARD THAT MATTERS MOST is R below: the round trip must STILL WORK with
 * the new marker present. Round 1 made blank header cells the structural
 * signal the importer reads, so any "do not edit" text in them is capable of
 * undoing the build that shipped an hour ago. That is asserted first and it is
 * asserted end to end, through the real workbook and the real importer.
 *
 * DRIVEN, NOT READ. The editor guards assemble the shipped renderIngestEditor
 * with its real dependency list and CALL it, then read the HTML it produced. A
 * source-level pin cannot tell an input from a read-only span, and a hand-fed
 * slice cannot see a missing closure.
 *
 * BASE is 438bf64, the round-1 build as deployed, so every claim here is a
 * difference against the thing Emely actually tested.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-240-evidence/suite-240a-r2-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || '438bf64';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);

const SRC = fs.readFileSync(APP, 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
const say = (m) => lines.push(m);
function guard(label, fn) {
  try { fn(); } catch (e) {
    fail++; lines.push('  FAIL ' + label + ' THREW: ' + (e && e.message));
  }
}

/* ---------- extraction ---------------------------------------------------- */
function grab(name, src) {
  src = src || SRC;
  for (const pad of ['  ', '    ', '']) for (const kw of ['function ', 'async function ']) {
    const head = '\r\n' + pad + kw + name + '(';
    const i = src.indexOf(head);
    if (i < 0) continue;
    const close = '\r\n' + pad + '}';
    const j = src.indexOf(close, i + head.length);
    if (j <= i) continue;
    return src.slice(i + 2, j + close.length);
  }
  return null;
}
/* Bounded to the first `;` at bracket depth zero. The block-scanning variants
 * elsewhere in this repo over-read a single-line const and swallow the next
 * declaration, which surfaces as "already declared" rather than a wrong
 * answer. */
function grabConst(name, src) {
  src = src || SRC;
  const m = src.match(new RegExp('\\r\\n  (?:const|var|let) ' + name + '\\s*='));
  if (!m) return null;
  const start = src.indexOf(m[0]) + 2;
  let d = 0, q = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i], p = src[i - 1];
    if (q) { if (c === q && p !== '\\') q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i); if (e < 0) return null; i = e + 1; continue; }
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\r\n', i); if (e < 0) return null; i = e; continue; }
    if (c === '(' || c === '{' || c === '[') d++;
    else if (c === ')' || c === '}' || c === ']') d--;
    else if (c === ';' && d === 0) return src.slice(start, i + 1);
  }
  return null;
}
function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');
}

/* ---------- the editor, assembled and CALLED ------------------------------ */
const EDITOR_FNS = ['renderIngestEditor', 'recomputeTotals', 'detectPctColumns',
  'detectAvgColumns', 'unreconciledTotals', 'totalRowSums', 'totalRowFlags',
  'isStrictTotalRowLabel', 'isHierarchicalTotalLabel', 'columnGrandTotals', 'applyDerivedCols',
  'applyDerivedRows', 'recomputeDirty', 'ingestStatusClass', 'ingestStatusText',
  'columnNumericMask', 'detectCurrencyColumns', 'isNumeric', 'rawNum',
  'isSplitCell', 'formatIngestValue', 'fmtDerivedCell', 'sumDerivedCols',
  'withinSourceRounding', 'addsOnlyPrecision', 'storedDecimals',
  /* D2/D3/D4/F7 reach this one; without it those four threw rather than
   * comparing, which read as a difference when it was a missing dependency. */
  'unreconciledDerivedRows',
  /* round 2: the lock reads the shared table set and the header predicate */
  'ingestIsHeaderRow', 'ingestIsShapeBlank', 'ingestIsBlankCell', 'normIngestKey'];
const EDITOR_DECLS = ['DERIVED_COLS', 'DERIVED_ROWS', 'HIERARCHICAL_TABLES',
  'INGEST_CALC_MARKER', 'INGEST_NOVALUE_MARKER'];

function renderFor(tableId, year, mutate, src) {
  src = src || SRC;
  const t = P.tables[tableId];
  const rows = JSON.parse(JSON.stringify((t.data || {})[year] || []));
  const state = { payload: P, ingest: {
    tableId: tableId, year: year,
    schema: (t.schema_by_year || {})[year],
    baseline: JSON.parse(JSON.stringify(rows)),
    draft: mutate ? mutate(JSON.parse(JSON.stringify(rows))) : rows,
    dirty: false,
  } };
  /* THE LIST IS A SEED, NOT THE ANSWER. A hardcoded dependency list rots: this
   * one was missing unreconciledDerivedRows and then derivedRowValue, and each
   * absence surfaced as four tables "differing" from BASE when they had merely
   * thrown. Missing names are resolved by following the ReferenceError, and
   * the resolved set is reported so the harness cannot quietly shrink. */
  const fns = EDITOR_FNS.slice(), decls = EDITOR_DECLS.slice();
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  for (let iter = 0; iter < 200; iter++) {
    const body = decls.map(n => grabConst(n, src)).filter(Boolean).join('\n') + '\n' +
      fns.map(n => grab(n, src)).filter(Boolean).join('\n') +
      '\nreturn renderIngestEditor;';
    try {
      const f = new Function('state', 'escapeHtml', 'document', body)(
        state, esc, { getElementById: () => null });
      return { html: f(), state: state, deps: fns.length + decls.length };
    } catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) throw e;
      if (grab(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm, src) && decls.indexOf(nm) < 0) { decls.push(nm); continue; }
      throw new Error('renderFor(' + tableId + ':' + year + ') cannot resolve ' + nm);
    }
  }
  throw new Error('renderFor(' + tableId + ':' + year + '): no convergence');
}
const rowsOf = (html) => (html.match(/<tr[^>]*data-row="\d+"[\s\S]*?<\/tr>/g) || []);
const hasInput = (tr) => /<input/.test(tr);
const hasDelete = (tr) => /ingest-row-delete/.test(tr);

const isEmptyV = v => v === null || v === undefined || String(v).trim() === '';
const isHdrRow = r => Array.isArray(r) && r.length > 1 && !isEmptyV(r[0]) &&
  r.slice(1).every(isEmptyV);
const hasNumV = r => Array.isArray(r) && r.slice(1).some(
  v => typeof v === 'number' && isFinite(v));
const totalish = l => /total/i.test(String(l == null ? '' : l));

/* ---------- the import side, assembled and CALLED ------------------------- */
const ENTRY = ['buildIngestWorkbook', 'buildIngestImport', 'totalRowFlags',
  'recomputeTotals', 'getTableSchema', 'getTableBody', 'ingestComputed',
  'ingestTemplateSource', 'normIngestKey', 'crc32', 'xlsxCol'];
const OPTIONAL = ['ingestRowKey', 'ingestIsHeaderRow', 'ingestGroupOf',
  'ingestKeyColCount', 'ingestIsBlankCell', 'ingestIsShapeBlank'];

function buildEnv(src, tag) {
  const fns = ENTRY.concat(OPTIONAL.filter(n => grab(n, src)));
  const consts = [];
  for (let iter = 0; iter < 500; iter++) {
    const body = '"use strict";\n' +
      'const state = { payload: P };\n' +
      'const console = { warn: () => {}, info: () => {}, log: () => {}, error: () => {} };\n' +
      'const document = { getElementById: () => null, querySelectorAll: () => [] };\n' +
      consts.map(n => grabConst(n, src)).join('\n') + '\n' +
      fns.map(n => grab(n, src)).join('\n') + '\n' +
      'return {' + ENTRY.join(', ') + ', ' +
      OPTIONAL.map(n => n + ': (typeof ' + n + ' === "function" ? ' + n + ' : null)').join(', ') +
      '};';
    let cand;
    try {
      cand = new Function('P', 'TextEncoder', 'TextDecoder', body)(P, TextEncoder, TextDecoder);
    } catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) throw new Error(tag + ' shell: ' + e.message);
      if (grab(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm, src) && consts.indexOf(nm) < 0) { consts.push(nm); continue; }
      throw new Error(tag + ' cannot resolve ' + nm);
    }
    try {
      cand.buildIngestWorkbook('A5', '2099');
      cand.buildIngestImport([P.tables.A5.schema_by_year['2025'], ['HVAC', 1, 1, null]],
        P.tables.A5.schema_by_year['2025'], [], 'A5');
      /* recomputeTotals has to be CALLED here too, or its own dependencies are
       * never resolved and every guard that uses it dies with
       * "detectPctColumns is not defined" -- which is what happened. */
      const d = P.tables.A5.data['2025'].map(r => r.slice());
      cand.recomputeTotals(d, P.tables.A5.schema_by_year['2025'], 'A5', null);
      cand.totalRowFlags(d, 'A5', P.tables.A5.schema_by_year['2025']);
      return cand;
    } catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) throw new Error(tag + ' call: ' + e.message);
      if (grab(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm, src) && consts.indexOf(nm) < 0) { consts.push(nm); continue; }
      throw new Error(tag + ' cannot resolve ' + nm + ' (call time)');
    }
  }
  throw new Error(tag + ': no convergence');
}
let NEW = null, OLD = null;
guard('both sources assemble and RUN', () => {
  NEW = buildEnv(SRC, 'NEW');
  OLD = buildEnv(BASE_SRC, 'BASE');
  ok(!!NEW && !!OLD, 'the changed source and BASE (' + BASE + ') both assemble and run');
});
if (!NEW || !OLD) {
  lines.forEach(l => console.log(l));
  console.log('\n  ' + pass + ' passed, ' + fail + ' failed  (assembly failed)');
  process.exit(1);
}

function unzipStored(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eo = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; }
  }
  if (eo < 0) throw new Error('no EOCD');
  const total = dv.getUint16(eo + 10, true);
  const out = {};
  let p = dv.getUint32(eo + 16, true);
  for (let k = 0; k < total; k++) {
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nlen));
    const lnlen = dv.getUint16(lho + 26, true);
    const lelen = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lnlen + lelen;
    out[name] = new TextDecoder().decode(bytes.subarray(start, start + csize));
    p += 46 + nlen + elen + clen;
  }
  return out;
}
function readCells(xml) {
  const out = {};
  const re = /<c r="([A-Z]+)(\d+)" s="(\d+)"(?:\s*\/>|[^>]*>([\s\S]*?)<\/c>)/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const t = m[4] ? (m[4].match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] : null;
    out[m[1] + m[2]] = { text: t == null ? null : t.replace(/&amp;/g, '&')
      .replace(/&apos;/g, "'").replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>') };
  }
  return out;
}
function templateOf(api, tableId, year) {
  const wb = api.buildIngestWorkbook(tableId, year);
  if (!wb || !wb.bytes) throw new Error('no workbook for ' + tableId + ':' + year);
  const parts = unzipStored(wb.bytes);
  const cells = readCells(parts['xl/worksheets/sheet2.xml']);
  const schema = api.getTableSchema(P.tables[tableId], year);
  const rows = [];
  for (let r = 1; ; r++) {
    const row = [];
    let any = false;
    for (let c = 1; c <= schema.length; c++) {
      const cell = cells[api.xlsxCol(c) + r];
      row.push(cell ? cell.text : null);
      if (cell && cell.text != null && String(cell.text) !== '') any = true;
    }
    if (!any) break;
    rows.push(row);
  }
  return { rows: rows, schema: schema, instructions: parts['xl/worksheets/sheet1.xml'] };
}
/* The operator's half: type numbers into the cells left blank, and leave every
 * marker exactly as the template wrote it. */
function fillLikeOperator(tplRows, stored) {
  return tplRows.map((row, i) => {
    if (i === 0) return row.slice();
    const src = stored[i - 1] || [];
    return row.map((cell, c) => {
      if (c === 0) return cell;
      if (cell != null && String(cell).trim() !== '') return cell;
      const v = src[c];
      return (v == null || v === '') ? null : v;
    });
  });
}

/* ===================== R: THE ROUND TRIP STILL WORKS ===================== */
say('');
say('=== R. the guard that could undo the build that shipped an hour ago ===');
guard('R: A5 own template -> empty 2099, WITH the marker present', () => {
  const stored = P.tables.A5.data['2025'];
  const tpl = templateOf(NEW, 'A5', '2099');
  const hdrIdx = stored.map((r, i) => i).filter(i => isHdrRow(stored[i]));
  const marked = hdrIdx.filter(i => tpl.rows[i + 1].slice(1)
    .every(c => String(c).trim() === '(no value)'));
  ok(marked.length === hdrIdx.length && hdrIdx.length === 9,
     'R1 all ' + hdrIdx.length + ' group headers are marked "(no value)" in ' +
     'every value column: ' + marked.length);

  const file = fillLikeOperator(tpl.rows, stored);
  const res = NEW.buildIngestImport(file, tpl.schema, [], 'A5');
  ok(res.rejections.length === 0,
     'R2 the importer still ACCEPTS the marked file' +
     (res.rejections.length ? ': ' + res.rejections[0].why : ''));
  if (!res.ok) { ok(false, 'R3 import did not complete'); return; }
  ok(res.candidate.length === 50, 'R3 all 50 rows still land: ' + res.candidate.length);

  NEW.recomputeTotals(res.candidate, tpl.schema, 'A5', null);

  /* THE MARKER IS STRUCTURE, NOT DATA: the group rows must still be read as
   * headers, or the rows beneath them key to the wrong group.
   *
   * Asserted AFTER recomputeTotals, and my first version asserted it before,
   * which was wrong for a reason worth keeping: until the totals are computed
   * an imported total row is blank and therefore shape-identical to a header,
   * so 19 rows looked like headers instead of 9. That ambiguity is exactly why
   * (calculated) must not count as shape-blank. */
  const gotHdr = res.candidate.map((r, i) => i).filter(i => isHdrRow(res.candidate[i]));
  ok(JSON.stringify(gotHdr) === JSON.stringify(hdrIdx),
     'R4 the 9 headers land at the same indices, so the marker is still ' +
     'import-equivalent to blank: ' + JSON.stringify(gotHdr));
  const totIdx = stored.map((r, i) => i).filter(i => totalish(stored[i][0]));
  const filled = totIdx.filter(i => hasNumV(res.candidate[i]));
  ok(filled.length === totIdx.length,
     'R5 all ' + totIdx.length + ' totals still compute: ' + filled.length);

  /* AND THE MARKER IS NEVER DATA. */
  const leaked = [];
  res.candidate.forEach((r, i) => r.forEach((v, c) => {
    if (typeof v === 'string' && /\(no value\)|\(calculated\)/.test(v)) leaked.push('r' + i + 'c' + c);
  }));
  ok(leaked.length === 0,
     'R6 neither marker is ever written into a cell' +
     (leaked.length ? ': ' + leaked.slice(0, 4).join(', ') : ''));

  const want = stored.map(r => r.slice());
  NEW.recomputeTotals(want, tpl.schema, 'A5', null);
  const eq = (a, b) => (isEmptyV(a) && isEmptyV(b)) ||
    (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < 1e-9) ||
    String(a) === String(b);
  const diff = [];
  want.forEach((row, i) => row.forEach((v, c) => {
    if (!eq(v, res.candidate[i][c])) diff.push('r' + i + 'c' + c);
  }));
  ok(diff.length === 1 && diff[0] === 'r49c1',
     'R7 and the round trip still reproduces A5:2025 everywhere except the one ' +
     'grand total the payload stores short' +
     (diff.length !== 1 || diff[0] !== 'r49c1' ? ': ' + diff.slice(0, 5).join(', ') : ''));

  /* A RE-IMPORT still matches instead of appending.
   *
   * Against the 2025 SCHEMA, not the 2099 one. My first version passed
   * tpl.schema, which for a year that has none resolves to a different year's
   * headings, and the import correctly rejected a file whose label column was
   * named something else. That is the disclosed finding in D below. */
  const s2025 = P.tables.A5.schema_by_year['2025'];
  const re = NEW.buildIngestImport(fillLikeOperator(templateOf(NEW, 'A5', '2025').rows, stored),
    s2025, stored.map(r => r.slice()), 'A5');
  ok(re.rejections.length === 0 && (re.candidate || []).length === 50 &&
     (re.addedRows || []).length === 0,
     'R8 re-importing into a populated year still MATCHES: ' +
     (re.candidate || []).length + ' rows, ' + (re.addedRows || []).length + ' created' +
     (re.rejections.length ? ' -- ' + re.rejections[0].why.slice(0, 60) : ''));
});

/* ===================== D: a finding this round did not cause ============= */
say('');
say('=== D. disclosed, not fixed: a new year mixes two years of schema ======');
guard('D: the template pairs the OLDEST headings with the NEWEST labels', () => {
  /* getTableSchema falls back to Object.keys(schema_by_year)[0], the OLDEST
   * year, while ingestTemplateSource deliberately borrows the MOST RECENT year
   * that has rows. So A5's template for a brand-new year carries 2023's column
   * headings above 2025's row labels.
   *
   * The round trip is unaffected, because the template and the importer use
   * the same fallback, which is why Emely's round-1 pass succeeded. But the
   * operator sees a heading from a year they did not ask for.
   *
   * PRE-EXISTING and asserted against BASE to prove this round did not cause
   * it. Changing a schema fallback reaches the composed layer and the editor as
   * well as the template, so it is its own ticket -- the same shape as
   * CLCPA-243, which took the first key too. */
  const newFirst = NEW.getTableSchema(P.tables.A5, '2099')[0];
  const baseFirst = OLD.getTableSchema(P.tables.A5, '2099')[0];
  const oldest = Object.keys(P.tables.A5.schema_by_year)[0];
  const borrowed = NEW.ingestTemplateSource(P.tables.A5, '2099').year;
  ok(newFirst === baseFirst,
     'D1 identical to BASE, so round 2 did not cause it: ' + JSON.stringify(newFirst));
  ok(newFirst === P.tables.A5.schema_by_year[oldest][0],
     'D2 the heading comes from the OLDEST year, ' + oldest);
  ok(String(borrowed) === '2025',
     'D3 while the row labels come from the most recent year with rows, ' + borrowed);
  ok(newFirst !== P.tables.A5.schema_by_year['2025'][0],
     'D4 and for A5 those two disagree: ' + JSON.stringify(newFirst) + ' vs ' +
     JSON.stringify(P.tables.A5.schema_by_year['2025'][0]));
});

/* ===================== M: the marker, in both predicates ================= */
say('');
say('=== M. (no value) vs (calculated): the difference is load-bearing ===');
guard('M: the two predicates disagree on purpose', () => {
  if (!NEW.ingestIsShapeBlank || !NEW.ingestIsBlankCell) {
    ok(false, 'M0 the predicates are not exported'); return;
  }
  ok(NEW.ingestIsShapeBlank('(no value)') === true,
     'M1 (no value) is SHAPE-blank, so a marked header is still a header');
  ok(NEW.ingestIsShapeBlank('(calculated)') === false,
     'M2 (calculated) is NOT shape-blank -- that is what tells a TOTAL row from ' +
     'a header, and treating it as blank cost 60 rows instead of 50 in round 1');
  ok(NEW.ingestIsShapeBlank('') === true && NEW.ingestIsShapeBlank(null) === true,
     'M3 genuinely empty is shape-blank');
  ok(NEW.ingestIsShapeBlank('0') === false && NEW.ingestIsShapeBlank(0) === false,
     'M4 a zero is a VALUE, not a blank');
  ok(NEW.ingestIsBlankCell('(no value)') === true &&
     NEW.ingestIsBlankCell('(calculated)') === true,
     'M5 BOTH markers count as "not operator input" for keys and created rows');
  ok(NEW.ingestIsBlankCell('HVAC') === false,
     'M6 and a real label does not');

  /* a header row carrying the marker is a header; a total row is not */
  const hdr = ['Group One', '(no value)', '(no value)', '(no value)'];
  const tot = ['Group One Total', '(calculated)', '(calculated)', '(calculated)'];
  ok(NEW.ingestIsHeaderRow(hdr, [0]) === true, 'M7 a marked header row reads as a header');
  ok(NEW.ingestIsHeaderRow(tot, [0]) === false, 'M8 a total row does NOT');
});

guard('M: the marker is skipped on import, never parsed', () => {
  const schema = P.tables.A5.schema_by_year['2025'];
  const f = [schema,
    ['Group One', '(no value)', '(no value)', '(no value)'],
    ['HVAC', 5, 2, '(calculated)'],
    ['Rogue', '(no value)', 7, '(calculated)']];
  const res = NEW.buildIngestImport(f, schema, [], 'A5');
  ok(res.rejections.length === 0, 'M9 a file carrying both markers is accepted');
  if (!res.ok) return;
  const anyMarker = res.candidate.some(r => r.some(
    v => typeof v === 'string' && /\(no value\)|\(calculated\)/.test(v)));
  ok(!anyMarker, 'M10 neither marker lands in any cell');
  ok(res.candidate[1][1] === 5, 'M11 real values beside a marker still land');
  /* a (no value) in a DATA row is skipped, and the row keeps its other value */
  ok(res.candidate[2][1] == null && res.candidate[2][2] === 7,
     'M12 a stray (no value) in a data row is skipped, not parsed: ' +
     JSON.stringify(res.candidate[2]));
  const noted = (res.notTouched.computed || []).filter(c => /group heading/.test(c.why || ''));
  ok(noted.length >= 1, 'M13 and it is REPORTED, not silently dropped: ' + noted.length);
});

/* ===================== L: the editor lock, DRIVEN ======================== */
say('');
say('=== L. the editor: group headers and totals are render-only ===');
guard('L: A5:2025 renders its structure rows locked', () => {
  const r = renderFor('A5', '2025');
  const trs = rowsOf(r.html);
  const stored = P.tables.A5.data['2025'];
  ok(trs.length === stored.length,
     'L1 the grid renders all ' + stored.length + ' rows: ' + trs.length);

  const hdrIdx = stored.map((x, i) => i).filter(i => isHdrRow(stored[i]));
  const badInput = hdrIdx.filter(i => hasInput(trs[i]));
  const badDel = hdrIdx.filter(i => hasDelete(trs[i]));
  const badCls = hdrIdx.filter(i => !/ingest-row-subheader/.test(trs[i]));
  ok(badInput.length === 0,
     'L2 not one of the ' + hdrIdx.length + ' group headers has an input' +
     (badInput.length ? ': rows ' + badInput.join(', ') : ''));
  ok(badDel.length === 0,
     'L3 and not one has a delete button, so the row cannot be removed' +
     (badDel.length ? ': rows ' + badDel.join(', ') : ''));
  ok(badCls.length === 0,
     'L4 and each carries CLCPA-233s .ingest-row-subheader band, reused as is' +
     (badCls.length ? ': rows ' + badCls.join(', ') : ''));

  const totIdx = stored.map((x, i) => i).filter(i => !isHdrRow(stored[i]) && totalish(stored[i][0]));
  const totInput = totIdx.filter(i => hasInput(trs[i]));
  const totDel = totIdx.filter(i => hasDelete(trs[i]));
  ok(totIdx.length === 10, 'L5 A5:2025 has ten total rows: ' + totIdx.length);
  ok(totInput.length === 0,
     'L6 their LABELS are locked too, not just their values' +
     (totInput.length ? ': rows ' + totInput.join(', ') : ''));
  ok(totDel.length === 0,
     'L7 and none carries a delete button' +
     (totDel.length ? ': rows ' + totDel.join(', ') : ''));

  const dataIdx = stored.map((x, i) => i)
    .filter(i => !isHdrRow(stored[i]) && !totalish(stored[i][0]));
  const noInput = dataIdx.filter(i => !hasInput(trs[i]));
  const noDel = dataIdx.filter(i => !hasDelete(trs[i]));
  ok(dataIdx.length === 31, 'L8 and 31 ordinary data rows: ' + dataIdx.length);
  ok(noInput.length === 0,
     'L9 every one of them KEEPS its inputs -- the lock did not spread' +
     (noInput.length ? ': rows ' + noInput.join(', ') : ''));
  ok(noDel.length === 0,
     'L10 and keeps its delete button' + (noDel.length ? ': rows ' + noDel.join(', ') : ''));
});

guard('L: BASE left them editable, so the defect was real', () => {
  const r = renderFor('A5', '2025', null, BASE_SRC);
  const trs = rowsOf(r.html);
  const stored = P.tables.A5.data['2025'];
  const hdrIdx = stored.map((x, i) => i).filter(i => isHdrRow(stored[i]));
  const editable = hdrIdx.filter(i => hasInput(trs[i]));
  const deletable = hdrIdx.filter(i => hasDelete(trs[i]));
  ok(editable.length === hdrIdx.length,
     'L11 on BASE all ' + hdrIdx.length + ' group headers had editable inputs: ' + editable.length);
  ok(deletable.length === hdrIdx.length,
     'L12 and all had a delete button: ' + deletable.length);
  const totIdx = stored.map((x, i) => i).filter(i => !isHdrRow(stored[i]) && totalish(stored[i][0]));
  ok(totIdx.filter(i => hasInput(trs[i])).length === totIdx.length,
     'L13 and every total row label was editable on BASE too');
});

guard('L: the four hierarchical tables, every year', () => {
  /* THE ORACLE IS THE ENGINE, NOT A LABEL TEST.
   *
   * My first version of this asked "does the label contain total?" and went
   * red on A8:2025 row 25. The code was right and the assertion was wrong: a
   * row is a total when totalRowFlags says so, and the editor locks exactly
   * those. See the L20 finding below for the row that exposed it. */
  let hdrs = 0, tots = 0, bad = [];
  ['A5', 'A6', 'A7', 'A8'].forEach(id => {
    Object.keys(P.tables[id].data || {}).sort().forEach(y => {
      const stored = P.tables[id].data[y];
      if (!stored || !stored.length) return;
      const schema = (P.tables[id].schema_by_year || {})[y] || [];
      const flags = NEW.totalRowFlags(stored, id, schema);
      let trs;
      try { trs = rowsOf(renderFor(id, y).html); }
      catch (e) { bad.push(id + ':' + y + ' threw: ' + e.message); return; }
      stored.forEach((row, i) => {
        if (isHdrRow(row)) {
          hdrs++;
          if (hasInput(trs[i]) || hasDelete(trs[i])) bad.push(id + ':' + y + ' header r' + i);
        } else if (flags[i]) {
          tots++;
          if (hasInput(trs[i]) || hasDelete(trs[i])) bad.push(id + ':' + y + ' total r' + i);
        }
      });
    });
  });
  ok(hdrs === 67, 'L14 67 group headers across the family: ' + hdrs);
  ok(tots === 78, 'L15 78 rows the engine confirms as totals: ' + tots);
  ok(bad.length === 0,
     'L16 every one of the ' + (hdrs + tots) + ' is render-only with no delete' +
     (bad.length ? ': ' + bad.slice(0, 4).join(' | ') : ''));
});

guard('L: the one total-labelled row the lock does NOT cover', () => {
  /* DISCLOSED, NOT FIXED. A8:2025 row 25, "Total CES Programs Installations",
   * holds 336,599 where the table's own rows sum to 283,852 -- it rolls up
   * figures A8 does not contain. Arithmetic therefore refuses to confirm it,
   * the engine does not treat it as a total, and so it keeps its input and its
   * delete button.
   *
   * Locking it would freeze a number nothing in this app can recompute, which
   * is the CLCPA-233 item B dilemma, and choosing that is Emely's call rather
   * than a thing to slip into a lock ticket. Asserted here so it is on the
   * record and so a later decision turns this red instead of passing quietly. */
  const stored = P.tables.A8.data['2025'];
  const schema = P.tables.A8.schema_by_year['2025'];
  const flags = NEW.totalRowFlags(stored, 'A8', schema);
  const trs = rowsOf(renderFor('A8', '2025').html);
  ok(String(stored[25][0]) === 'Total CES Programs Installations',
     'L17 the row is A8:2025 r25: ' + JSON.stringify(String(stored[25][0])));
  ok(flags[25] === false,
     'L18 the engine does not confirm it as a total, because ' + stored[25][1] +
     ' exceeds the table total ' + stored[24][1] + ' by ' + (stored[25][1] - stored[24][1]));
  ok(flags[23] === true && flags[24] === true,
     'L19 while the two totals it CAN confirm are locked');
  ok(hasInput(trs[25]) && hasDelete(trs[25]),
     'L20 so r25 remains editable and deletable -- the one total-labelled row ' +
     'in the family the lock does not reach');
});

/* ===================== N: a new row is never trapped ==================== */
say('');
say('=== N. the operator can still work: a new row never locks ===');
guard('N: an appended row stays editable', () => {
  const add = (rows) => { const c = rows.map(r => r.slice());
    c.push(['Brand New Program', null, null, null]); return c; };
  const r = renderFor('A5', '2025', add);
  const trs = rowsOf(r.html);
  const last = trs.length - 1;
  ok(trs.length === 51, 'N1 the appended row renders: ' + trs.length + ' rows');
  ok(hasInput(trs[last]),
     'N2 a label that is NOT in the baseline stays editable, so "+ Add Row" ' +
     'plus a re-render cannot trap the operator mid-edit');
  ok(hasDelete(trs[last]), 'N3 and keeps its delete button');

  /* the empty row "+ Add Row" actually creates */
  const addEmpty = (rows) => { const c = rows.map(r => r.slice());
    c.push(['', null, null, null]); return c; };
  const trs2 = rowsOf(renderFor('A5', '2025', addEmpty).html);
  ok(hasInput(trs2[trs2.length - 1]) && hasDelete(trs2[trs2.length - 1]),
     'N4 and the empty row + Add Row really creates is editable too');

  /* KNOWN LIMIT, asserted so it is on the record rather than discovered later:
   * a row typed with a label that EQUALS a stored group header, and holding no
   * numbers, does lock. Unreachable on the frozen payload -- zero of the 67
   * headers shares a name with a data row -- and recoverable with Reset. */
  const addClash = (rows) => { const c = rows.map(r => r.slice());
    c.push([rows[0][0], null, null, null]); return c; };
  const trs3 = rowsOf(renderFor('A5', '2025', addClash).html);
  ok(!hasInput(trs3[trs3.length - 1]),
     'N5 KNOWN LIMIT recorded: a new row whose label equals a stored group ' +
     'header, with no numbers, does lock');

  /* but not if it holds a number */
  const addClashNum = (rows) => { const c = rows.map(r => r.slice());
    c.push([rows[0][0], 5, null, null]); return c; };
  const trs4 = rowsOf(renderFor('A5', '2025', addClashNum).html);
  ok(hasInput(trs4[trs4.length - 1]),
     'N6 and the "holds no number" condition is what keeps a DATA row that ' +
     'shares a header name from being frozen');
});

/* ===================== H: the measured harm is unreachable =============== */
say('');
say('=== H. the three harm scenarios, and why the UI can no longer cause them ==');
guard('H: the harm is real, and the routes to it are closed', () => {
  const schema = P.tables.A5.schema_by_year['2025'];
  const stored = P.tables.A5.data['2025'];
  const totalsOf = (rows) => {
    const d = rows.map(r => r.slice());
    NEW.recomputeTotals(d, schema, 'A5', null);
    const f = NEW.totalRowFlags(d, 'A5', schema);
    return { n: f.filter(Boolean).length, byLabel: d.reduce((a, r, i) => {
      if (f[i]) a[String(r[0])] = r[1]; return a; }, {}) };
  };
  const A = totalsOf(stored);
  const delHdr = totalsOf(stored.filter((r, i) => i !== 3));
  const valHdr = totalsOf(stored.map((r, i) => { const c = r.slice(); if (i === 3) c[1] = 1; return c; }));
  ok(A.n === 10 && delHdr.n === 9 && valHdr.n === 9,
     'H1 the harm is real: deleting or valuing one group header drops a total ' +
     'row from 10 recognised to 9');
  ok(A.byLabel['Commercial Total'] === 27833 &&
     delHdr.byLabel['Commercial Total'] === 27836 &&
     valHdr.byLabel['Commercial Total'] === 27837,
     'H2 and moves the grand total: 27833 -> 27836 deleted, -> 27837 valued');

  /* the routes: both required a control the editor no longer renders */
  const trs = rowsOf(renderFor('A5', '2025').html);
  ok(!hasDelete(trs[3]), 'H3 route 1 closed: row 3 has no delete button');
  ok(!hasInput(trs[3]), 'H4 route 2 closed: row 3 has no input to type a value into');

  /* route 3, the silent re-key, measured through the real importer */
  const tpl = templateOf(NEW, 'A5', '2025');
  const file = fillLikeOperator(tpl.rows, stored);
  const intact = NEW.buildIngestImport(file, schema, stored.map(r => r.slice()), 'A5');
  const broken = NEW.buildIngestImport(file, schema, stored.filter((r, i) => i !== 3), 'A5');
  ok(intact.addedRows.length === 0,
     'H5 route 3: into the intact table the same file creates nothing');
  ok(broken.addedRows.length === 3,
     'H6 and into a table missing that header it creates ' +
     broken.addedRows.length + ' rows, which is the silent re-key -- now ' +
     'unreachable because the deletion is');
});

/* ===================== F: flat tables untouched ========================== */
say('');
say('=== F. everything outside the family is byte-identical ==================');
guard('F: the editor renders flat tables exactly as BASE did', () => {
  const fam = { A5: 1, A6: 1, A7: 1, A8: 1 };
  let checked = 0, diff = [];
  Object.keys(P.tables).sort().forEach(id => {
    if (fam[id]) return;
    const years = Object.keys(P.tables[id].data || {}).filter(y => (P.tables[id].data[y] || []).length);
    if (!years.length) return;
    const y = years[years.length - 1];
    let a, b;
    try { a = renderFor(id, y).html; b = renderFor(id, y, null, BASE_SRC).html; }
    catch (e) { diff.push(id + ':' + y + ' threw: ' + e.message); return; }
    checked++;
    if (a !== b) diff.push(id + ':' + y);
  });
  ok(checked >= 40, 'F1 rendered ' + checked + ' tables outside the family');
  ok(diff.length === 0,
     'F2 every one is byte-identical to BASE' +
     (diff.length ? ': ' + diff.slice(0, 5).join(', ') : ''));
});

guard('F: a FLAT table keeps its editable total label and delete button', () => {
  /* A1 has a Total row and is not in the family. CLCPA-205 item 2 is pending
   * on the all-totals tables and this round must not pre-empt it. */
  const stored = P.tables.A1.data['2025'];
  const trs = rowsOf(renderFor('A1', '2025').html);
  const tIdx = stored.map((r, i) => i).filter(i => /^total$/i.test(String(stored[i][0]).trim()));
  ok(tIdx.length >= 1, 'F3 A1:2025 has a Total row: index ' + tIdx.join(','));
  ok(tIdx.every(i => hasInput(trs[i])),
     'F4 its label is still editable, because A1 is not in the family');
  ok(tIdx.every(i => hasDelete(trs[i])),
     'F5 and it still carries a delete button');
});

guard('F: totalRowFlags on stored data is identical to BASE everywhere', () => {
  let diff = [];
  Object.keys(P.tables).sort().forEach(id => {
    Object.keys(P.tables[id].data || {}).forEach(y => {
      const rows = (P.tables[id].data[y] || []).filter(Array.isArray);
      if (!rows.length) return;
      const schema = (P.tables[id].schema_by_year || {})[y] || [];
      if (JSON.stringify(NEW.totalRowFlags(rows, id, schema)) !==
          JSON.stringify(OLD.totalRowFlags(rows, id, schema))) diff.push(id + ':' + y);
    });
  });
  ok(diff.length === 0,
     'F6 no stored table-year changes its flags' +
     (diff.length ? ': ' + diff.slice(0, 4).join(', ') : ''));
});

guard('F: A5:2025 stored values are untouched by rendering', () => {
  const before = JSON.stringify(P.tables.A5.data['2025']);
  renderFor('A5', '2025');
  renderFor('A5', '2025', (rows) => { rows[3][1] = 99; return rows; });
  ok(JSON.stringify(P.tables.A5.data['2025']) === before,
     'F7 the payload is not mutated by rendering or by a mutated draft');
});

/* ===================== T: the template, every year ======================= */
say('');
say('=== T. the template marks headers and nothing else =====================');
guard('T: the marking is exactly scoped', () => {
  let hdrs = 0, tots = 0, data = 0, bad = [];
  ['A5', 'A6', 'A7', 'A8'].forEach(id => {
    Object.keys(P.tables[id].data || {}).sort().forEach(y => {
      const stored = P.tables[id].data[y];
      if (!stored || !stored.length) return;
      let tpl;
      try { tpl = templateOf(NEW, id, y); } catch (e) { bad.push(id + ':' + y + ' threw'); return; }
      /* Same oracle as the editor: the engine, not the label. */
      const flags = NEW.totalRowFlags(stored, id, (P.tables[id].schema_by_year || {})[y] || []);
      stored.forEach((row, i) => {
        const cells = (tpl.rows[i + 1] || []).slice(1).map(c => String(c).trim());
        if (isHdrRow(row)) {
          hdrs++;
          if (!cells.every(c => c === '(no value)')) bad.push(id + ':' + y + ' header r' + i + ' ' + JSON.stringify(cells));
        } else if (flags[i]) {
          tots++;
          if (!cells.every(c => c === '(calculated)')) bad.push(id + ':' + y + ' total r' + i + ' ' + JSON.stringify(cells));
        } else {
          data++;
          if (cells.some(c => c === '(no value)')) bad.push(id + ':' + y + ' data r' + i + ' marked');
        }
      });
    });
  });
  ok(hdrs === 67 && tots === 78, 'T1 67 headers and 78 engine-confirmed totals seen: ' + hdrs + ', ' + tots);
  ok(data > 0, 'T2 and ' + data + ' ordinary data rows');
  ok(bad.length === 0,
     'T3 headers marked (no value), totals still (calculated), data rows ' +
     'unmarked' + (bad.length ? ': ' + bad.slice(0, 3).join(' | ') : ''));
});

guard('T: a flat table gets no (no value) anywhere', () => {
  let bad = [];
  ['A1', 'A3', 'D2', 'J1'].forEach(id => {
    const years = Object.keys(P.tables[id].data || {}).filter(y => (P.tables[id].data[y] || []).length);
    if (!years.length) return;
    const tpl = templateOf(NEW, id, years[years.length - 1]);
    tpl.rows.forEach((row, i) => row.forEach(c => {
      if (String(c).trim() === '(no value)') bad.push(id + ' r' + i);
    }));
  });
  ok(bad.length === 0,
     'T4 no flat table template carries the marker' +
     (bad.length ? ': ' + bad.slice(0, 4).join(', ') : ''));
});

guard('T: the instructions say what the marker means', () => {
  const tpl = templateOf(NEW, 'A5', '2025');
  const xml = tpl.instructions || '';
  ok(/\(no value\)/.test(xml),
     'T5 the instructions sheet mentions (no value)');
  /* Specific enough to fail. My first version tested /heading/i, which the
   * REST of the same paragraph satisfies, so deleting the sentence that
   * introduces the marker left the assertion green. */
  ok(/heading row is marked \(no value\)/.test(xml),
     'T6 and says in so many words that a heading row is marked (no value)');
  ok(/takes no figures/.test(xml),
     'T6b and that it takes no figures');
  const base = templateOf(OLD, 'A5', '2025');
  ok(!/\(no value\)/.test(base.instructions || ''),
     'T7 which BASE did not say, because there was nothing to say it about');
});

/* ===================== S: the source, structurally ====================== */
say('');
say('=== S. the shape of the change ========================================');
guard('S: the declarations and the reuse', () => {
  const code = codeOnly(SRC);
  ok(/\r\n  const HIERARCHICAL_TABLES = \{ A5: true, A6: true, A7: true, A8: true \};/.test(code),
     'S1 HIERARCHICAL_TABLES is declared once at module scope');
  ok((code.split('const HIERARCHICAL_TABLES').length - 1) === 1,
     'S2 exactly one definition: ' + (code.split('const HIERARCHICAL_TABLES').length - 1));
  ok(/const INGEST_NOVALUE_MARKER = '\(no value\)';/.test(code),
     'S3 the marker is one constant, not a scattered literal');
  ok((code.split("'(no value)'").length - 1) === 1,
     'S4 and appears as a literal exactly once: ' + (code.split("'(no value)'").length - 1));
  const ed = codeOnly(grab('renderIngestEditor', SRC) || '');
  ok(/HIERARCHICAL_TABLES\[/.test(ed),
     'S5 the editor reads the shared set rather than its own copy');
  ok(/rowIdx < headerRowCount \|\| isGroupHeaderRow\(row\)/.test(ed),
     'S6 and the lock EXTENDS CLCPA-233s isHeaderRow rather than adding a path');
  /* ROUND 3 CHANGED EXACTLY THIS, and the change is the reason this ticket had
   * a third round: the baseline is EMPTY on a year imported but not yet saved,
   * so baseline-only identification locked nothing on the one screen the
   * feature exists for. Restated to the claim round 2 was entitled to make --
   * identification is by LABEL rather than by row index -- with the fallback
   * itself owned and asserted by suite_240a_r3. */
  ok(/i\.baseline/.test(ed) && /groupHeaderLabels/.test(ed),
     'S7 identification is by LABEL, not by row index');
  ok(!/rowIdx <[^|]*isGroupHeaderRow\(rowIdx\)/.test(ed),
     'S7b and the group test takes a ROW, not an index, so rows moving cannot ' +
     'shift the lock');
  /* zero CSS: the band already existed */
  const css = fs.readFileSync(path.join(REPO,
    'Coned/CLCPA/ExecutiveDashboard_dev/styles.css'), 'utf8');
  const baseCss = execSync('git show ' + BASE +
    ':"Coned/CLCPA/ExecutiveDashboard_dev/styles.css"',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
  ok(css === baseCss, 'S8 styles.css is byte-identical to BASE: the round reuses ' +
     '.ingest-row-subheader and adds no CSS');
  /* The baseline's SHAPE, pinned. Repointing BASE at a symbolic ref is a no-op
   * while the change is uncommitted and a silent baseline collapse the moment
   * it is not, so there is nothing for a behavioural assertion to catch. */
  const declared = (fs.readFileSync(__filename, 'utf8')
    .match(/DAC_BASE_COMMIT \|\| '([^']*)'/) || [])[1];
  ok(/^[0-9a-f]{7,40}$/.test(String(declared)),
     'S9 the baseline in this file is a literal commit sha, not a symbolic ref: ' +
     JSON.stringify(declared));
});

/* ---------- report ------------------------------------------------------- */
console.log('======================================================================');
console.log('CLCPA-240 first half, ROUND 2 -- protecting the hierarchical structure');
console.log('  app.js : ' + APP);
console.log('  BASE   : ' + BASE + '  (the round-1 build as deployed)');
console.log('======================================================================');
lines.forEach(l => console.log(l));
console.log('');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
try {
  fs.writeFileSync(OUT, [
    '======================================================================',
    'CLCPA-240 first half, ROUND 2 -- protecting the hierarchical structure',
    '  BASE   : ' + BASE + '  (the round-1 build as deployed)',
    '======================================================================',
  ].concat(lines).concat(['', '  ' + pass + ' passed, ' + fail + ' failed']).join('\n') + '\n');
} catch (e) { /* stdout is still the record */ }
process.exitCode = fail ? 1 : 0;
