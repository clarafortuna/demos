/* CLCPA-85 round 4: the .xlsx template.
 *
 * The workbook is BUILT by the shipped buildIngestWorkbook, then UNZIPPED and
 * inspected. No inflate is needed to read it, because the writer stores rather
 * than compresses, which is the same decision that made the writer
 * dependency-free.
 *
 * TWO PROOFS carry this suite:
 *
 *   1. PER-CELL LOCKING. Every cell of the table sheet is resolved through
 *      styles.xml to a locked flag, and each is checked against what it should
 *      be: headers, labels and (calculated) cells locked, value cells unlocked.
 *      Per cell, not per sheet, so a single wrong style index is caught.
 *
 *   2. THE ROUND TRIP. The CSV that Excel's "Save As" of the table sheet would
 *      produce is reconstructed from that sheet's own cells and fed to the
 *      SHIPPED buildIngestImport. That proves the workbook and the CSV importer
 *      agree, using the real engine rather than a description of it.
 *
 * HOSTED-ONLY, recorded CLCPA-220 style and NOT provable here:
 *   - Excel honouring the protection: locked cells refusing typing, unlocked
 *     ones accepting it.
 *   - The Save As CSV UTF-8 flow writing only the ACTIVE sheet with the
 *     encoding intact.
 *   - Excel opening the workbook at all, without a repair prompt.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || '11e2b96';   // pre-85, as deployed
const SRC = fs.readFileSync(path.join(REPO, REL), 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8');
const PAYLOAD = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => { if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); } return !!c; };

function grab(name) {
  for (const pad of ['  ', '    ', '']) for (const kw of ['function ', 'async function ']) {
    const head = '\r\n' + pad + kw + name + '(';
    const i = SRC.indexOf(head); if (i < 0) continue;
    const close = '\r\n' + pad + '}';
    const j = SRC.indexOf(close, i + head.length);
    if (j >= 0) return SRC.slice(i + 2, j + close.length);
  } return null;
}
function grabDecl(name) {
  const L = SRC.split('\r\n');
  let s = -1, e = -1;
  const open = new RegExp('^  const ' + name + ' = ');
  for (let i = 0; i < L.length; i++) {
    if (s < 0) { if (open.test(L[i])) s = i; }
    else if (/^  \}\)\(\);/.test(L[i]) || /^  \};/.test(L[i])) { e = i; break; }
  }
  return (s < 0 || e < 0) ? null : L.slice(s, e + 1).join('\n');
}

const NAMES = ['crc32', 'zipStored', 'xmlEsc', 'xlsxSheetName', 'xlsxCol',
  'xlsxStylesXml', 'xlsxCell', 'xlsxSheetXml', 'xlsxInstructionLines',
  'buildIngestWorkbook', 'ingestTemplateSource', 'ingestComputed', 'totalRowFlags',
  'isStrictTotalRowLabel', 'isSplitCell', 'cellText', 'cellCount', 'cellPct',
  'getTableSchema', 'getTableBody', 'rawNum',
  'parseCsvRows', 'normIngestKey', 'parseNumericInput', 'formatIngestValue',
  'buildIngestImport', 'compareTableIds'];
const missing = NAMES.filter(n => !grab(n));
if (missing.length) { console.error('EXTRACTION FAILED: ' + missing.join(', ')); process.exit(1); }
const CONSTS = ['XLSX_STYLE_DEFAULT', 'XLSX_STYLE_HEADER', 'XLSX_STYLE_INPUT',
  'XLSX_STYLE_LOCKED'].map(n => {
  const m = SRC.match(new RegExp('  const ' + n + ' = \\d+;'));
  if (!m) { console.error('EXTRACTION FAILED: ' + n); process.exit(1); }
  return m[0].trim();
});

let api;
try {
  api = new Function('PAYLOAD', 'TextEncoder',
    '"use strict";\nconst state = { payload: PAYLOAD };\n' +
    'const console = { warn: () => {}, info: () => {} };\n' +
    grabDecl('CRC_TABLE') + '\n' + grabDecl('SHORT_TITLES') + '\n' +
    grabDecl('DERIVED_COLS') + '\n' + CONSTS.join('\n') + '\n' +
    NAMES.map(grab).join('\n') + '\n' +
    'return { buildIngestWorkbook, zipStored, crc32, xlsxSheetName, xlsxCol,' +
    ' xlsxInstructionLines, buildIngestImport, parseCsvRows, getTableSchema,' +
    ' getTableBody, ingestComputed, ingestTemplateSource, normIngestKey };')(
    PAYLOAD, TextEncoder);
} catch (e) {
  console.error('SHELL FAILED: ' + e.message); process.exit(1);
}

/* ---------- a STORED-only unzip. No inflate, by design. ------------------ */
function unzipStored(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eo = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eo = i; break; }
  }
  if (eo < 0) throw new Error('no EOCD');
  /* The EOCD's own fields are checked, not just skipped past. A wrong disk
   * number or entry count is corruption a lenient reader would ignore, so
   * mutating it changed nothing until this was recorded. */
  const eocd = {
    diskNo: dv.getUint16(eo + 4, true),
    cdDisk: dv.getUint16(eo + 6, true),
    entriesThisDisk: dv.getUint16(eo + 8, true),
    entriesTotal: dv.getUint16(eo + 10, true),
    cdSize: dv.getUint32(eo + 12, true),
    cdOffset: dv.getUint32(eo + 16, true),
    commentLen: dv.getUint16(eo + 20, true),
    at: eo,
  };
  const count = eocd.entriesTotal;
  const cdOff = eocd.cdOffset;
  const out = {}; const order = [];
  let p = cdOff;
  for (let k = 0; k < count; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('bad CD signature');
    const method = dv.getUint16(p + 10, true);
    const crc = dv.getUint32(p + 16, true);
    const csize = dv.getUint32(p + 20, true);
    const usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true);
    const elen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nlen));
    if (dv.getUint32(lho, true) !== 0x04034b50) throw new Error('bad LFH: ' + name);
    const lnlen = dv.getUint16(lho + 26, true);
    const lelen = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lnlen + lelen;
    const data = bytes.subarray(start, start + csize);
    /* The LOCAL header is read too, and compared with the central directory.
     * A disagreement between the two is corruption that readers handle
     * inconsistently, and reading only the central copy meant a mutation of the
     * local one went unnoticed. */
    out[name] = { text: new TextDecoder().decode(data), method: method, crc: crc,
                  csize: csize, usize: usize, actualCrc: api.crc32(data),
                  actualLen: data.length,
                  localMethod: dv.getUint16(lho + 8, true),
                  localCrc: dv.getUint32(lho + 14, true),
                  localCsize: dv.getUint32(lho + 18, true),
                  localUsize: dv.getUint32(lho + 22, true) };
    order.push(name);
    p += 46 + nlen + elen + clen;
  }
  return { parts: out, order: order, count: count, eocd: eocd, cdEnd: p };
}

const TABLE = 'A1', YEAR = '2026';
const wb = api.buildIngestWorkbook(TABLE, YEAR);

lines.push('======================================================================');
lines.push('CLCPA-85 round 4 -- the .xlsx template');
lines.push('======================================================================');

lines.push('');
lines.push('=== the archive itself ===');
let z = null;
{
  ok(!!wb && wb.bytes && wb.bytes.length > 0, 'a workbook is produced: ' +
     (wb ? wb.bytes.length + ' bytes' : 'none'));
  try { z = unzipStored(wb.bytes); } catch (e) {
    ok(false, 'the archive reads back: ' + e.message);
  }
  if (z) {
    ok(z.count === 7, 'seven parts: ' + z.count);
    ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
     'xl/_rels/workbook.xml.rels', 'xl/styles.xml',
     'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml'].forEach(n => {
      ok(!!z.parts[n], 'part present: ' + n);
    });
    // the writer's own consistency, which is why timestamps are pinned
    Object.keys(z.parts).forEach(n => {
      const e = z.parts[n];
      ok(e.method === 0, n + ': STORED, not compressed');
      ok(e.crc === e.actualCrc, n + ': CRC32 in the directory matches the bytes');
      ok(e.usize === e.actualLen && e.csize === e.actualLen,
         n + ': both sizes match the bytes (' + e.actualLen + ')');
      // and the LOCAL header agrees with the central directory
      ok(e.localMethod === e.method, n + ': local method matches the directory');
      ok(e.localCrc === e.crc, n + ': local CRC matches');
      ok(e.localCsize === e.csize && e.localUsize === e.usize,
         n + ': local sizes match');
      ok(e.localMethod === 0, n + ': and the LOCAL header also says STORED');
    });
    // the EOCD's own fields
    ok(z.eocd.diskNo === 0 && z.eocd.cdDisk === 0,
       'the EOCD is single-disk: ' + z.eocd.diskNo + '/' + z.eocd.cdDisk);
    ok(z.eocd.entriesThisDisk === z.eocd.entriesTotal,
       'its two entry counts agree: ' + z.eocd.entriesThisDisk + '/' + z.eocd.entriesTotal);
    ok(z.eocd.entriesTotal === Object.keys(z.parts).length,
       'and match the parts actually present: ' + z.eocd.entriesTotal);
    ok(z.eocd.cdSize === z.cdEnd - z.eocd.cdOffset,
       'the central directory size matches its span: ' + z.eocd.cdSize);
    ok(z.cdEnd === z.eocd.at, 'the directory ends exactly where the EOCD begins');
    ok(z.eocd.commentLen === 0, 'and there is no trailing comment');
    // every part is well-formed enough to have a single root element
    Object.keys(z.parts).forEach(n => {
      const t = z.parts[n].text;
      ok(/^<\?xml version="1\.0" encoding="UTF-8" standalone="yes"\?><[A-Za-z]/.test(t),
         n + ': starts with an XML declaration and a root element');
      const opens = (t.match(/<[A-Za-z][^>]*[^\/]>/g) || []).length;
      const closes = (t.match(/<\/[A-Za-z][^>]*>/g) || []).length;
      const selfs = (t.match(/<[A-Za-z][^>]*\/>/g) || []).length;
      ok(opens === closes, n + ': tags balance (' + opens + ' open, ' + closes +
         ' close, ' + selfs + ' self-closing)');
    });
    // the rels point at parts that exist
    const rels = z.parts['xl/_rels/workbook.xml.rels'].text;
    ['worksheets/sheet1.xml', 'worksheets/sheet2.xml', 'styles.xml'].forEach(t => {
      ok(rels.indexOf('Target="' + t + '"') >= 0, 'workbook rels target ' + t);
      ok(!!z.parts['xl/' + t], 'and xl/' + t + ' is really in the archive');
    });
    ok(z.parts['_rels/.rels'].text.indexOf('Target="xl/workbook.xml"') >= 0,
       'the root rel targets the workbook');
    // content types cover every part
    const ct = z.parts['[Content_Types].xml'].text;
    ['/xl/workbook.xml', '/xl/worksheets/sheet1.xml', '/xl/worksheets/sheet2.xml',
     '/xl/styles.xml'].forEach(pn => {
      ok(ct.indexOf('PartName="' + pn + '"') >= 0, 'content type declared for ' + pn);
    });
  }
}

lines.push('');
lines.push('=== the two sheets, in order, named as ruled ===');
if (z) {
  const wbx = z.parts['xl/workbook.xml'].text;
  const names = (wbx.match(/<sheet name="([^"]*)"/g) || []).map(m => m.match(/"([^"]*)"/)[1]);
  ok(names.length === 2, 'exactly two sheets: ' + names.length);
  ok(names[0] === 'Instructions', 'sheet 1 is Instructions');
  ok(names[1] === 'A.1 Incentive $', 'sheet 2 is named for the table: ' + names[1]);
  ok(wb.sheetName === names[1], 'and the builder reports that name back');
  ok(names[1].length <= 31, 'within Excel s 31-char limit: ' + names[1].length);
  ok(!/[:\\\/?*\[\]]/.test(names[1]), 'and free of the characters Excel forbids');
  ok(/sheetId="1" r:id="rId1"/.test(wbx) && /sheetId="2" r:id="rId2"/.test(wbx),
     'with sheet ids and rel ids in order');

  /* The name guard is MEASURED and NOT currently load-bearing: nothing in the
   * payload trips it. Exercised directly so it is not merely asserted. */
  ok(api.xlsxSheetName('A.1 With: Bad/Chars [x]') === 'A.1 With Bad Chars x',
     'the guard replaces forbidden characters: ' +
     api.xlsxSheetName('A.1 With: Bad/Chars [x]'));
  ok(api.xlsxSheetName('x'.repeat(40)).length === 31, 'and truncates to 31');
  const longest = Object.values(PAYLOAD.tables).map(t =>
    t.id.replace(/^([A-Z])(\d+)$/, '$1.$2') + ' ' + (t.short_title || ''))
    .sort((a, b) => b.length - a.length)[0];
  ok(longest.length <= 31,
     'but no real table needs it: longest is ' + longest.length + ' chars (' + longest + ')');
  ok(!Object.values(PAYLOAD.tables).some(t => /[:\\\/?*\[\]]/.test(t.short_title || '')),
     'and no short_title contains a forbidden character');
}

lines.push('');
lines.push('=== the Instructions sheet, verbatim and fully locked ===');
if (z) {
  const s1 = z.parts['xl/worksheets/sheet1.xml'].text;
  const texts = (s1.match(/<t xml:space="preserve">([\s\S]*?)<\/t>/g) || [])
    .map(m => m.replace(/^<t xml:space="preserve">/, '').replace(/<\/t>$/, ''));
  const APPROVED = [
    'How to fill and import this template',
    '1. Go to the second sheet of this workbook, named A.1 Incentive $. It holds the table for reporting year 2026.',
    '2. Type values ONLY in the empty cells. Headers, program names and calculated cells are locked on purpose; calculated cells are computed by the dashboard after import.',
    '3. When done, create a CSV from that sheet: with the table sheet ACTIVE (selected), use File, Save As, and choose CSV UTF-8 (Comma delimited). Excel saves only the active sheet, so the instructions are never part of the file.',
    '4. In the dashboard, open Report Data, Add New Year, choose this section and table, Import From File, and pick the CSV you saved. The values land as a draft for your review; nothing is stored until you press Save.',
    'Do not rename the table sheet or edit the header row; the import matches columns by header and rows by program name.',
  ];
  ok(texts.length === APPROVED.length,
     'six lines, one per approved line: ' + texts.length);
  APPROVED.forEach((want, i) => {
    const got = (texts[i] || '').replace(/&amp;/g, '&').replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    ok(got === want, 'line ' + (i + 1) + ' is verbatim' +
       (got === want ? '' : ': got ' + JSON.stringify(got.slice(0, 70))));
  });
  ok(APPROVED[1].indexOf('A.1 Incentive $') >= 0 && APPROVED[1].indexOf('2026') >= 0,
     'and the bracketed parts are substituted with the real table and year');
  // every cell locked
  const cells = s1.match(/<c r="[A-Z]+\d+" s="(\d+)"/g) || [];
  ok(cells.length === APPROVED.length, 'one cell per line: ' + cells.length);
  ok(cells.every(c => /s="3"/.test(c)), 'EVERY instructions cell uses the locked style');
  ok(/<sheetProtection sheet="1"/.test(s1), 'and the sheet is protected');
}

lines.push('');
lines.push('=== PROTECTION: present on both sheets, and no password ===');
if (z) {
  ['sheet1', 'sheet2'].forEach(n => {
    const t = z.parts['xl/worksheets/' + n + '.xml'].text;
    ok(/<sheetProtection sheet="1" objects="1" scenarios="1"\/>/.test(t),
       n + ': protected, structure and objects included');
    ok(!/password=/.test(t) && !/algorithmName=/.test(t) && !/hashValue=/.test(t),
       n + ': NO password, of any kind');
  });
  /* Said plainly, because the report says it too: this is guidance against
   * accidents, not security. Sheet protection is removable in a few clicks.
   * The real guard against bad data is the importer, which is why the round
   * trip below matters more than the locks. */
  ok(true, 'protection is guidance against accidents, not security (stated, not tested)');
}

lines.push('');
lines.push('=== PER-CELL LOCKING, resolved through styles.xml ===');
let sheet2Cells = null;
if (z) {
  /* Resolve each style index to its locked flag from styles.xml, rather than
   * trusting the constant names. A wrong index would otherwise pass. */
  const styles = z.parts['xl/styles.xml'].text;
  const xfs = (styles.match(/<cellXfs count="\d+">([\s\S]*?)<\/cellXfs>/) || [])[1] || '';
  const xfList = xfs.match(/<xf [\s\S]*?<\/xf>|<xf [^>]*\/>/g) || [];
  ok(xfList.length === 4, 'four cell formats: ' + xfList.length);
  const lockedByIndex = xfList.map(x => !/locked="0"/.test(x));
  const boldByIndex = xfList.map(x => /fontId="1"/.test(x));
  ok(xfList.every(x => /applyProtection="1"/.test(x)),
     'every format sets applyProtection, or Excel ignores the lock');
  ok(lockedByIndex[0] === true, 'style 0 (default) is locked');
  ok(lockedByIndex[1] === true, 'style 1 (header) is locked');
  ok(lockedByIndex[2] === false, 'style 2 (input) is UNLOCKED');
  ok(lockedByIndex[3] === true, 'style 3 (label and calculated) is locked');
  ok(boldByIndex[1] === true, 'and style 1 is the bold one');
  const fonts = (styles.match(/<fonts count="\d+">([\s\S]*?)<\/fonts>/) || [])[1] || '';
  ok(/<font><b\/>/.test(fonts), 'font 1 really carries <b/>');

  // now every cell of the table sheet
  const s2 = z.parts['xl/worksheets/sheet2.xml'].text;
  const table = PAYLOAD.tables[TABLE];
  const schema = api.getTableSchema(table, YEAR);
  const src = api.ingestTemplateSource(table, YEAR);
  const computed = api.ingestComputed(src.rows, TABLE, schema);

  const cellRe = /<c r="([A-Z]+)(\d+)" s="(\d+)"(?:\s*\/>|[^>]*>([\s\S]*?)<\/c>)/g;
  sheet2Cells = {};
  let m;
  while ((m = cellRe.exec(s2)) !== null) {
    const text = m[4] ? (m[4].match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] : null;
    sheet2Cells[m[1] + m[2]] = { col: m[1], row: parseInt(m[2], 10),
      style: parseInt(m[3], 10),
      text: text == null ? null : text.replace(/&amp;/g, '&').replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>') };
  }
  const expectedCells = (src.rows.length + 1) * schema.length;
  ok(Object.keys(sheet2Cells).length === expectedCells,
     'every cell is written: ' + Object.keys(sheet2Cells).length + ' of ' + expectedCells);

  let hdrOk = 0, labOk = 0, calcOk = 0, inpOk = 0, wrong = [];
  schema.forEach((h, c) => {
    const ref = api.xlsxCol(c + 1) + '1';
    const cell = sheet2Cells[ref];
    if (cell && cell.style === 1 && lockedByIndex[1] && cell.text === h) hdrOk++;
    else wrong.push(ref + ' header');
  });
  src.rows.forEach((row, idx) => {
    const rn = idx + 2;
    schema.forEach((h, c) => {
      const ref = api.xlsxCol(c + 1) + rn;
      const cell = sheet2Cells[ref];
      if (!cell) { wrong.push(ref + ' missing'); return; }
      const locked = lockedByIndex[cell.style];
      if (c === 0) {
        if (locked && cell.text === row[0]) labOk++; else wrong.push(ref + ' label');
      } else if (computed.any(idx, c)) {
        if (locked && cell.text === '(calculated)') calcOk++;
        else wrong.push(ref + ' calculated');
      } else {
        if (!locked && cell.text === null) inpOk++; else wrong.push(ref + ' input');
      }
    });
  });
  ok(wrong.length === 0, 'EVERY cell has the right lock and content' +
     (wrong.length ? ': wrong at ' + wrong.slice(0, 6).join(', ') : ''));
  ok(hdrOk === schema.length, 'all ' + hdrOk + ' header cells: locked, bold, correct text');
  ok(labOk === src.rows.length, 'all ' + labOk + ' label cells: locked, correct label');
  ok(calcOk > 0, calcOk + ' calculated cells: locked and marked (calculated)');
  ok(inpOk > 0, inpOk + ' value cells: UNLOCKED and EMPTY');
  ok(hdrOk + labOk + calcOk + inpOk === expectedCells,
     'and those four groups account for every cell, with none left over');

  /* The counts are not arbitrary: they follow from the payload. A1 has one
   * total row and one derived column, so the calculated cells are that row's
   * value cells plus the whole derived column. */
  const derivedCols = schema.filter((h, c) => c > 0 && computed.derivedCol(c)).length;
  const totalRows = src.rows.filter((r, i) => computed.totalRow(i)).length;
  ok(derivedCols === 1 && totalRows === 1,
     'A1 has ' + derivedCols + ' derived column and ' + totalRows + ' total row');
  ok(inpOk === (src.rows.length - totalRows) * (schema.length - 1 - derivedCols),
     'so the input count is exactly (rows minus totals) x (value columns): ' + inpOk);

  ok(src.borrowed && wb.borrowedFrom === src.year,
     'the labels are BORROWED for the new year, from ' + wb.borrowedFrom);
  ok(wb.rowCount === src.rows.length, 'and the builder reports the row count back');
}

lines.push('');
lines.push('=== THE ROUND TRIP, through the shipped importer ===');
if (z && sheet2Cells) {
  /* Reconstruct the CSV that Excel's Save As of the table sheet would produce:
   * the sheet's own cells, row by row, comma separated. Then hand it to the
   * REAL buildIngestImport. */
  const table = PAYLOAD.tables[TABLE];
  const schema = api.getTableSchema(table, YEAR);
  const src = api.ingestTemplateSource(table, YEAR);
  const maxRow = src.rows.length + 1;
  const csvField = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csvLines = [];
  for (let r = 1; r <= maxRow; r++) {
    const row = [];
    for (let c = 1; c <= schema.length; c++) {
      const cell = sheet2Cells[api.xlsxCol(c) + r];
      row.push(csvField(cell ? cell.text : ''));
    }
    csvLines.push(row.join(','));
  }
  const csv = csvLines.join('\r\n') + '\r\n';
  ok(csv.split('\r\n')[0] === schema.map(csvField).join(','),
     'the reconstructed CSV starts with the schema header row');

  const rows = api.parseCsvRows(csv);
  ok(rows.length === maxRow, 'it parses to header plus every label row: ' + rows.length);
  const res = api.buildIngestImport(rows, schema, [], TABLE);
  ok(res.ok, 'the SHIPPED importer plans it with no hard rejections' +
     (res.ok ? '' : ': ' + (res.rejections[0] || {}).why));
  ok(res.addedRows.length === src.rows.length,
     'creating a row per label, as a new year needs: ' + res.addedRows.length);
  ok(res.notTouched.computed.length > 0,
     'the (calculated) cells land in NOT TOUCHED, which is why they are marked: ' +
     res.notTouched.computed.length);
  ok(res.populated.length === 0,
     'and nothing is populated, because every value cell is deliberately empty');
  ok(res.notTouched.unmatchedColumns.length === 0,
     'no column is unmatched: the header row is the live schema');
  ok(res.blankSkipped.length > 0,
     'the empty value cells are counted as blanks left alone: ' + res.blankSkipped.length);

  /* And with values TYPED IN, which is what the operator actually returns. */
  const filled = csvLines.map((line, i) => {
    if (i === 0) return line;
    const cells = line.split(',');
    return cells.map((v, c) => (c > 0 && v === '') ? String(100 + i) : v).join(',');
  }).join('\r\n') + '\r\n';
  const res2 = api.buildIngestImport(api.parseCsvRows(filled), schema, [], TABLE);
  ok(res2.ok, 'with values typed into the unlocked cells it still plans cleanly');
  ok(res2.populated.length > 0,
     'and those values import: ' + res2.populated.length + ' cells');
  ok(res2.notTouched.computed.length === res.notTouched.computed.length,
     'the calculated cells stay untouched either way');
}

lines.push('');
lines.push('=== BASE controls: none of this existed ===');
{
  ['function zipStored', 'function crc32', 'function buildIngestWorkbook',
   'function xlsxStylesXml', 'function downloadBinaryFile',
   'sheetProtection'].forEach(s => {
    ok(BASE_SRC.indexOf(s) < 0, 'BASE control: no ' + s);
  });
  ok(SRC.indexOf('function buildIngestTemplate') < 0,
     'and the CSV template it replaced is deleted');
  /* No third-party dependency, which was the condition on this round. */
  ok(!/require\(|import\s+\w+\s+from|unpkg|cdnjs|jsdelivr|SheetJS|xlsx\.min/.test(
       grab('buildIngestWorkbook') + grab('zipStored') + grab('crc32')),
     'and the writer pulls in no dependency of any kind');
  /* Checked as a CALL, not as a word: the writer's own comment explains why it
   * needs no CompressionStream, and the first version of this assertion caught
   * that comment rather than a use. */
  ok(!/new (?:De)?CompressionStream|(?:De)?CompressionStream\(/.test(SRC),
     'and never CALLS a compression stream: STORED entries need none');
  ok(/no CompressionStream/.test(SRC),
     'though it says in prose why it does not, which is what the loose check hit');
}

lines.push('');
lines.push('======================================================================');
lines.push('  ' + pass + ' passed, ' + fail + ' failed');
lines.push('======================================================================');
const out = lines.join('\n');
console.log(out);
fs.writeFileSync(path.join(__dirname, 'suite-xlsx-output.txt'), out + '\n');
process.exitCode = fail ? 1 : 0;
