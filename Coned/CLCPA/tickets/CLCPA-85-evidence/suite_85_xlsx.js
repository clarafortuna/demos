/* CLCPA-85 rounds 4 to 6: the .xlsx example workbook.
 *
 * Built by the shipped buildIngestWorkbook, then UNZIPPED and inspected. No
 * inflate is needed, because the writer stores rather than compresses, which is
 * the same decision that made the writer dependency-free.
 *
 * THREE PROOFS carry this suite:
 *
 *   1. THE STRUCTURAL LOCK. Round 5 removed the unlocked cell format entirely,
 *      so the claim is not "no cell is unlocked" but "no cell CAN be": styles.xml
 *      contains no xf with locked="0". Checked at the styles level AND per cell
 *      on BOTH sheets.
 *
 *   2. ROUND 6, THE LOGO IS GONE. What round 5 proved as the omit-logo case is
 *      now the ONLY case, so the assertions are INVERTED: seven parts, no image
 *      or drawing part, no rel chain, no png content type, no dangling drawing
 *      reference, and no rasteriser, drawing writer or inlined base64 constant
 *      left in the source. The builder is synchronous again, asserted.
 *
 *   3. THE ROUND TRIP. The CSV that Excel's "Save As" of the table sheet would
 *      produce is reconstructed from that sheet's own cells and fed to the
 *      SHIPPED buildIngestImport, including the operator's own path of APPENDING
 *      new program rows.
 *
 * Round 6 also brings the table sheet's LOOK under assertion: the header and
 * total rows are taken from the dashboard's own CSS rules, checked against
 * styles.css itself rather than against hex strings retyped here, and the column
 * widths are checked against labels MEASURED in the payload.
 *
 * HOSTED-ONLY, recorded CLCPA-220 style and NOT provable here:
 *   - Excel honouring the full lock: nothing typeable anywhere.
 *   - The Save As CSV UTF-8 flow writing only the ACTIVE sheet, encoding intact.
 *   - Excel opening the workbook without a repair prompt.
 *   - Round 6, Emely's pass: gridlines actually hidden, the right alignment, the
 *     colours and the column widths AS RENDERED by real Excel.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSS_REL = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const BASE = process.env.DAC_BASE_COMMIT || '11e2b96';   // pre-85, as deployed
const SRC = fs.readFileSync(path.join(REPO, REL), 'utf8');
const CSS = fs.readFileSync(path.join(REPO, CSS_REL), 'utf8');
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
  'xlsxStylesXml', 'xlsxCell', 'xlsxSheetXml', 'xlsxInstructionBlocks',
  'buildIngestWorkbook', 'ingestTemplateSource', 'ingestComputed',
  'totalRowFlags', 'isStrictTotalRowLabel', 'isSplitCell', 'cellText', 'cellCount',
  'cellPct', 'getTableSchema', 'getTableBody', 'rawNum', 'parseCsvRows',
  'normIngestKey', 'parseNumericInput', 'formatIngestValue', 'buildIngestImport',
  /* CLCPA-240 dependencies: buildIngestImport and buildIngestWorkbook read
     these, so the functions cannot be assembled without them. */
  'ingestKeyColCount', 'ingestIsBlankCell', 'ingestIsShapeBlank', 'ingestIsHeaderRow', 'ingestGroupOf', 'ingestRowKey',
  'compareTableIds'];
const missing = NAMES.filter(n => !grab(n));
if (missing.length) { console.error('EXTRACTION FAILED: ' + missing.join(', ')); process.exit(1); }
const STYLE_CONSTS = ['XLSX_STYLE_DEFAULT', 'XLSX_STYLE_HEADER', 'XLSX_STYLE_LOCKED',
  'XLSX_STYLE_HDRBAND', 'XLSX_STYLE_APPNAME', 'XLSX_STYLE_TITLE', 'XLSX_STYLE_SUBTITLE',
  'XLSX_STYLE_SECTION', 'XLSX_STYLE_BODY', 'XLSX_STYLE_BAND', 'XLSX_STYLE_NOTE',
  'XLSX_STYLE_LABEL', 'XLSX_STYLE_TOTAL', 'XLSX_STYLE_TOTAL_LABEL'];
const consts = STYLE_CONSTS.concat([
  /* CLCPA-240: read from the source, so the harness cannot pass while the
     real declarations say something else. */
  'INGEST_KEY_COLS', 'INGEST_GROUPED', 'INGEST_KEY_SEP', 'INGEST_CALC_MARKER',
  /* CLCPA-240 round 2 */
  'INGEST_NOVALUE_MARKER', 'HIERARCHICAL_TABLES',
  'XLSX_INK', 'XLSX_DUSK', 'XLSX_DUSK_TINT',
  'XLSX_TEXT2', 'XLSX_TEXT3', 'XLSX_WHITE', 'XLSX_PALE',
  'XLSX_SMOKE', 'XLSX_TEXT']).map(n => {
  const m = SRC.match(new RegExp('  const ' + n + ' = [^;]+;'));
  if (!m) { console.error('EXTRACTION FAILED: ' + n); process.exit(1); }
  return m[0].trim();
});

let api;
try {
  api = new Function('PAYLOAD', 'TextEncoder',
    '"use strict";\nconst state = { payload: PAYLOAD };\n' +
    'const console = { warn: () => {}, info: () => {} };\n' +
    grabDecl('CRC_TABLE') + '\n' + grabDecl('SHORT_TITLES') + '\n' +
    grabDecl('DERIVED_COLS') + '\n' + consts.join('\n') + '\n' +
    NAMES.map(grab).join('\n') + '\n' +
    'return { buildIngestWorkbook, zipStored, crc32, xlsxSheetName, xlsxCol,' +
    ' xlsxInstructionBlocks, buildIngestImport, parseCsvRows, getTableSchema,' +
    ' getTableBody, ingestComputed, ingestTemplateSource, normIngestKey,' +
    ' styleConsts: {' + STYLE_CONSTS.map(n => n + ': ' + n).join(', ') + '} };')(
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
  const eocd = {
    diskNo: dv.getUint16(eo + 4, true), cdDisk: dv.getUint16(eo + 6, true),
    entriesThisDisk: dv.getUint16(eo + 8, true), entriesTotal: dv.getUint16(eo + 10, true),
    cdSize: dv.getUint32(eo + 12, true), cdOffset: dv.getUint32(eo + 16, true),
    commentLen: dv.getUint16(eo + 20, true), at: eo,
  };
  const out = {}; const order = [];
  let p = eocd.cdOffset;
  for (let k = 0; k < eocd.entriesTotal; k++) {
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
    out[name] = { text: new TextDecoder().decode(data), bytes: data, method: method,
      crc: crc, csize: csize, usize: usize, actualCrc: api.crc32(data),
      actualLen: data.length, localMethod: dv.getUint16(lho + 8, true),
      localCrc: dv.getUint32(lho + 14, true), localCsize: dv.getUint32(lho + 18, true),
      localUsize: dv.getUint32(lho + 22, true) };
    order.push(name);
    p += 46 + nlen + elen + clen;
  }
  return { parts: out, order: order, count: eocd.entriesTotal, eocd: eocd, cdEnd: p };
}

const TABLE = 'A1', YEAR = '2026';
/* Round 6: ONE argument list, because there is no logo to pass or omit. */
const wb = api.buildIngestWorkbook(TABLE, YEAR);

lines.push('======================================================================');
lines.push('CLCPA-85 rounds 4 to 6 -- the .xlsx example workbook');
lines.push('======================================================================');

lines.push('');
lines.push('=== the archive itself ===');
let z = null;
{
  /* The message must not dereference what the assertion is testing for. It
   * used to read wb.bytes.length, and under the mutation that makes the
   * builder async again it CRASHED the suite instead of failing it. */
  ok(!!wb && wb.bytes && wb.bytes.length > 0, 'a workbook is produced: ' +
     (wb && wb.bytes && wb.bytes.length != null ? wb.bytes.length + ' bytes'
      : 'NO BYTES: ' + Object.prototype.toString.call(wb)));
  try { z = unzipStored(wb.bytes); } catch (e) { ok(false, 'it reads back: ' + e.message); }
  if (z) {
    /* ROUND 6, INVERTED: seven parts is now the only case. Round 5 proved this
     * exact shape as the omit-logo branch; the branch is gone and the shape is
     * what the builder always produces. */
    ok(z.count === 7, 'SEVEN parts, no logo: ' + z.count);
    ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
     'xl/_rels/workbook.xml.rels', 'xl/styles.xml',
     'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml'].forEach(n => {
      ok(!!z.parts[n], 'part present: ' + n);
    });
    ['xl/media/image1.png', 'xl/drawings/drawing1.xml',
     'xl/drawings/_rels/drawing1.xml.rels',
     'xl/worksheets/_rels/sheet1.xml.rels',
     'xl/worksheets/_rels/sheet2.xml.rels'].forEach(n => {
      ok(!z.parts[n], 'part ABSENT, as round 6 requires: ' + n);
    });
    ok(z.count === 7 && Object.keys(z.parts).length === 7,
       'and nothing else rode along: the archive holds exactly those seven');
    /* ADDED because a mutation got past this suite: re-emitting a dangling
     * <drawing r:id="rId1"/> on sheet 1 left every assertion green, because
     * absent PARTS and absent REFERENCES are two different claims. A dangling
     * reference is exactly what makes Excel offer to repair the file. */
    ['sheet1', 'sheet2'].forEach(s => {
      const t = z.parts['xl/worksheets/' + s + '.xml'].text;
      ok(!/<drawing/.test(t), s + ': no <drawing> element, dangling or otherwise');
      ok(!/r:id=/.test(t), s + ': and no relationship reference of any kind');
      ok(!/legacyDrawing|picture|oleObject/.test(t),
         s + ': nor any other part reference that would need a rels file');
    });
    /* And the converse: sheet 1 declares the r: namespace but must not USE it,
     * which is the state a half-finished removal would leave behind. */
    ok(/xmlns:r=/.test(z.parts['xl/worksheets/sheet1.xml'].text),
       'sheet 1 still declares the r: namespace, harmlessly and unchanged');
    Object.keys(z.parts).forEach(n => {
      const e = z.parts[n];
      ok(e.method === 0 && e.localMethod === 0, n + ': STORED in both headers');
      ok(e.crc === e.actualCrc, n + ': CRC32 matches the bytes');
      ok(e.usize === e.actualLen && e.csize === e.actualLen, n + ': sizes match');
      ok(e.localCrc === e.crc && e.localCsize === e.csize && e.localUsize === e.usize,
         n + ': the local header agrees with the directory');
    });
    ok(z.eocd.diskNo === 0 && z.eocd.cdDisk === 0, 'the EOCD is single-disk');
    ok(z.eocd.entriesThisDisk === z.eocd.entriesTotal, 'its entry counts agree');
    ok(z.eocd.entriesTotal === Object.keys(z.parts).length,
       'and match the parts present: ' + z.eocd.entriesTotal);
    ok(z.eocd.cdSize === z.cdEnd - z.eocd.cdOffset, 'the directory size matches its span');
    ok(z.cdEnd === z.eocd.at, 'and it ends where the EOCD begins');
    // every XML part well-formed enough to balance
    Object.keys(z.parts).filter(n => /\.xml$|\.rels$/.test(n)).forEach(n => {
      const t = z.parts[n].text;
      ok(/^<\?xml version="1\.0" encoding="UTF-8" standalone="yes"\?><[A-Za-z]/.test(t),
         n + ': XML declaration then a root element');
      const opens = (t.match(/<[A-Za-z][^>]*[^\/]>/g) || []).length;
      const closes = (t.match(/<\/[A-Za-z][^>]*>/g) || []).length;
      ok(opens === closes, n + ': tags balance (' + opens + '/' + closes + ')');
    });
  }
}

lines.push('');
lines.push('=== ROUND 5: the STRUCTURAL lock. No unlocked format exists. ===');
let lockedByIndex = null;
if (z) {
  const styles = z.parts['xl/styles.xml'].text;
  ok(!/locked="0"/.test(styles),
     'styles.xml contains NO xf with locked="0": no cell CAN be unlocked');
  ok(SRC.indexOf('XLSX_STYLE_INPUT =') < 0,
     'and the unlocked style constant is removed, not merely unused');
  ok(BASE_SRC.indexOf('locked="0"') < 0, 'BASE control: no styles existed at all');
  const xfs = (styles.match(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/) || []);
  const xfList = (xfs[2] || '').match(/<xf [\s\S]*?<\/xf>/g) || [];
  ok(xfList.length === 14, 'FOURTEEN cell formats after round 6: ' + xfList.length);
  ok(parseInt(xfs[1], 10) === xfList.length,
     'and the declared count matches the actual: ' + xfs[1]);
  ok(xfList.every(x => /applyProtection="1"/.test(x)),
     'every format sets applyProtection, or Excel ignores the lock');
  ok(xfList.every(x => /<protection locked="1"\/>/.test(x)),
     'and every one of them locks');
  lockedByIndex = xfList.map(x => !/locked="0"/.test(x));
  ok(lockedByIndex.every(Boolean), 'so every style index resolves LOCKED');
  // the style constants point at real formats
  Object.keys(api.styleConsts).forEach(k => {
    const i = api.styleConsts[k];
    ok(i >= 0 && i < xfList.length, k + ' = ' + i + ', a real format');
  });
}

lines.push('');
lines.push('=== the app s own palette, from its own tokens ===');
if (z) {
  const styles = z.parts['xl/styles.xml'].text;
  /* Each colour is checked against the value in styles.css, not against a hex
   * string retyped here, so a token change shows up as a failure. */
  const token = (name) => {
    const m = CSS.match(new RegExp('--' + name + ': (#[0-9A-Fa-f]{6});'));
    return m ? 'FF' + m[1].slice(1).toUpperCase() : null;
  };
  [['ink', 'XLSX_INK'], ['dusk', 'XLSX_DUSK'], ['dusk-tint', 'XLSX_DUSK_TINT'],
   ['text-2', 'XLSX_TEXT2'], ['text-3', 'XLSX_TEXT3'],
   ['text-4', 'XLSX_PALE']].forEach(([tok, name]) => {
    const want = token(tok);
    const m = SRC.match(new RegExp('  const ' + name + " = '([0-9A-F]{8})';"));
    ok(!!want && !!m && m[1] === want,
       name + ' is --' + tok + ' in ARGB: ' + (m && m[1]) + ' vs ' + want);
    ok(styles.indexOf(want) >= 0, 'and ' + want + ' really appears in styles.xml');
  });
  ok(/<fill><patternFill patternType="solid"><fgColor rgb="FF031824"/.test(styles),
     'the header band is filled with --ink');
  ok(/<fill><patternFill patternType="solid"><fgColor rgb="FFE5EBF5"/.test(styles),
     'and the callout band with --dusk-tint');
  const fonts = (styles.match(/<fonts count="(\d+)">([\s\S]*?)<\/fonts>/) || []);
  ok((fonts[2] || '').match(/<font>/g).length === parseInt(fonts[1], 10),
     'the font count matches the fonts declared: ' + fonts[1]);
  ok(/<font><b\/><sz val="18"\/><color rgb="FFFFFFFF"/.test(styles),
     'the title font is large, bold and white');
}

lines.push('');
lines.push('=== ROUND 6: the logo is GONE, source and workbook both ===');
{
  /* INVERTED from round 5, which asserted each of these present. Every one of
   * them fails if the removal is partly undone. */
  ['CONED_LOGO_SVG_B64', 'CONED_LOGO_W', 'CONED_LOGO_H', 'function ingestLogoPng',
   'function xlsxDrawingXml', 'oneCellAnchor', 'xdr:', 'image1.png', 'drawing1.xml',
   'toDataURL', "Extension=\"png\""].forEach(s => {
    ok(SRC.indexOf(s) < 0, 'removed from app.js entirely: ' + s);
  });
  ok(!/hasLogo/.test(SRC), 'and no hasLogo flag survives on the result');
  ok(!/const EMU = /.test(SRC), 'nor the EMU-per-pixel constant the anchor needed');

  /* The builder is SYNCHRONOUS again: the raster was the only await. */
  const bld = grab('buildIngestWorkbook');
  ok(/function buildIngestWorkbook\(tableId, year\) \{/.test(bld),
     'buildIngestWorkbook takes no logo argument any more');
  ok(!/await |\.then\(|async /.test(bld), 'and contains nothing asynchronous');
  ok(typeof wb === 'object' && wb !== null && typeof wb.then !== 'function',
     'it RETURNS a workbook rather than a promise');

  /* The dialog stopped awaiting too, which is what makes the above visible to
   * the operator rather than merely true of the builder. */
  const dlgAt = SRC.indexOf("querySelector('#ingest-template')");
  const dlg = dlgAt > 0 ? SRC.slice(dlgAt, dlgAt + 1400) : '';
  ok(dlgAt > 0, 'the template button handler is found in the dialog wiring');
  ok(dlg.length > 0 && !/ingestLogoPng/.test(dlg),
     'the template button no longer rasterises anything first');
  ok(/buildIngestWorkbook\(sel\.tableId, y\)/.test(dlg),
     'it calls the builder directly, with the table and the typed year');

  /* The SVG file itself is untouched: the sidebar still uses it. Round 5 read
   * it to prove the inlined copy matched; round 6 proves the app still ships it
   * while the workbook no longer reaches for it. */
  ok(fs.existsSync(path.join(REPO,
     'Coned/CLCPA/ExecutiveDashboard_dev/logo/ConEd_Logo_completo.svg')),
     'the sidebar logo asset is left in place, not deleted with the code');
  ok(SRC.indexOf("fetch('logo/") < 0 && SRC.indexOf('fetch("logo/') < 0,
     'and nothing fetches it, which was true before and stays true');
}

lines.push('');
lines.push('=== ROUND 6: the Instructions sheet reads as a document ===');
if (z) {
  const s1 = z.parts['xl/worksheets/sheet1.xml'].text;
  /* 1. GRIDLINES OFF, at the sheet VIEW level, and on sheet 1 only. */
  ok(/<sheetViews><sheetView showGridLines="0" workbookViewId="0"\/><\/sheetViews>/.test(s1),
     'sheet 1 hides its gridlines');
  const viewAt = s1.indexOf('<sheetViews>');
  ok(viewAt > 0 && viewAt < s1.indexOf('<cols>') && viewAt < s1.indexOf('<sheetData>'),
     'and sheetViews comes FIRST, before cols and sheetData, as the schema demands');
  ok(!/showGridLines/.test(z.parts['xl/worksheets/sheet2.xml'].text),
     'the TABLE sheet keeps its gridlines: it is a grid, and reads as one');

  /* 3. ROW 1 is the app name, RIGHT ALIGNED, in place of the logo. */
  const styles = z.parts['xl/styles.xml'].text;
  const xfAll = ((styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/) || [])[1] || '')
    .match(/<xf [\s\S]*?<\/xf>/g) || [];
  const appXf = xfAll[api.styleConsts.XLSX_STYLE_APPNAME] || '';
  ok(/horizontal="right"/.test(appXf), 'the app-name style is right aligned');
  ok(xfAll.filter(x => /horizontal="right"/.test(x)).length === 1,
     'and it is the ONLY right-aligned format, so nothing else moved');
  const row1 = (s1.match(/<row r="1"[\s\S]*?<\/row>/) || [''])[0];
  ok(new RegExp('s="' + api.styleConsts.XLSX_STYLE_APPNAME + '"').test(row1),
     'row 1 carries that style');
  ok(/Con Edison DAC Annual Report/.test(row1), 'and reads Con Edison DAC Annual Report');
  ok(!/Con Edison \u00b7/.test(s1) && !/\u00b7 DAC Annual Report/.test(row1),
     'the middot separator is gone from it, per the round 6 text');

  /* 4. ONE BLANK ROW before the second section heading. */
  const rowsOf = (xml) => (xml.match(/<row r="\d+"[\s\S]*?<\/row>/g) || []);
  const rows = rowsOf(s1);
  const textOf = (r) => (r.match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1];
  const howAt = rows.findIndex(r => textOf(r) === 'How to prepare your file');
  ok(howAt > 0, 'the second section heading is on the sheet');
  const before = rows[howAt - 1];
  ok(textOf(before) === undefined, 'the row immediately before it is BLANK');
  ok(new RegExp('s="' + api.styleConsts.XLSX_STYLE_BODY + '"').test(before),
     'a real cell in the body style, not a missing row, so the height applies');
  /* MEASURED, and the reason this counts BODY rows rather than all blank ones:
   * sheet 1 has two cells with no text, and the other is the header band's own
   * spacer row (style 3), which round 5 put there and round 6 leaves alone. */
  const blanks = rows.filter(r => textOf(r) === undefined);
  ok(blanks.length === 2, 'two rows on the sheet carry no text: ' + blanks.length);
  const bodyBlanks = blanks.filter(r =>
    new RegExp('s="' + api.styleConsts.XLSX_STYLE_BODY + '"').test(r));
  ok(bodyBlanks.length === 1,
     'exactly ONE of them is a body-style separator: one blank row, not padding');
  const bandBlanks = blanks.filter(r =>
    new RegExp('s="' + api.styleConsts.XLSX_STYLE_HDRBAND + '"').test(r));
  ok(bandBlanks.length === 1, 'and the other is the header band, untouched by round 6');
  const aboutAt = rows.findIndex(r => textOf(r) === 'About this workbook');
  ok(aboutAt >= 0, 'the first section heading is on the sheet too');
  /* Against the separator's OWN index. Phrased as aboutAt < howAt - 1 this
   * could not be made to fail: moving the blank row above the first heading
   * left it true, and only the check above went red. */
  const sepAt = rows.indexOf(bodyBlanks[0]);
  ok(sepAt > aboutAt && sepAt < howAt,
     'and the separator sits AFTER the first heading and BEFORE the second: ' +
     aboutAt + ' < ' + sepAt + ' < ' + howAt);
}

lines.push('');
lines.push('=== ROUND 6: the table sheet wears the dashboard s own colours ===');
if (z) {
  const styles = z.parts['xl/styles.xml'].text;
  const xfAll = ((styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/) || [])[1] || '')
    .match(/<xf [\s\S]*?<\/xf>/g) || [];
  const fonts = ((styles.match(/<fonts[^>]*>([\s\S]*?)<\/fonts>/) || [])[1] || '')
    .match(/<font>[\s\S]*?<\/font>/g) || [];
  const fills = ((styles.match(/<fills[^>]*>([\s\S]*?)<\/fills>/) || [])[1] || '')
    .match(/<fill>[\s\S]*?<\/fill>/g) || [];
  const borders = ((styles.match(/<borders[^>]*>([\s\S]*?)<\/borders>/) || [])[1] || '')
    .match(/<border\/>|<border>[\s\S]*?<\/border>/g) || [];
  const idOf = (xf, attr) => parseInt((xf.match(new RegExp(attr + '="(\\d+)"')) || [])[1], 10);
  /* The CSS is read, not retyped: a token or rule change fails this rather than
   * drifting silently. Both rules are quoted in app.js beside the formats. */
  const tokenHex = (name) => {
    const m = CSS.match(new RegExp('--' + name + ': (#[0-9A-Fa-f]{6});'));
    return m ? 'FF' + m[1].slice(1).toUpperCase() : null;
  };
  const ruleOf = (sel) => {
    const i = CSS.indexOf(sel + ' {');
    return i < 0 ? '' : CSS.slice(i, CSS.indexOf('}', i) + 1);
  };

  // ---- the HEADER row, from .data-table thead th (styles.css line 555) ----
  const thRule = ruleOf('.data-table thead th');
  ok(thRule.length > 0, 'the source rule .data-table thead th is found in styles.css');
  ok(/background: var\(--white-smoke\)/.test(thRule) &&
     /color: var\(--text-3\)/.test(thRule) && /font-weight: 700/.test(thRule),
     'and it is what the format claims to copy: white-smoke, text-3, bold');
  const hXf = xfAll[api.styleConsts.XLSX_STYLE_HEADER];
  const hFont = fonts[idOf(hXf, 'fontId')] || '';
  const hFill = fills[idOf(hXf, 'fillId')] || '';
  ok(/<b\/>/.test(hFont), 'the header format is BOLD, as the rule is');
  ok(hFont.indexOf(tokenHex('text-3')) >= 0,
     'in --text-3 (' + tokenHex('text-3') + '), read from the token');
  ok(hFill.indexOf(tokenHex('white-smoke')) >= 0,
     'on a --white-smoke ground (' + tokenHex('white-smoke') + ')');
  ok(/wrapText="1"/.test(hXf),
     'and it WRAPS, so the longest header cannot bleed over its neighbour');
  /* Stated rather than tested, and stated because it is a deliberate
   * divergence: the rule also sets text-transform: uppercase, which xlsx cannot
   * do at render time. Honouring it would mean uppercasing the header STRINGS,
   * and those strings are the example of what the import matches on. */
  ok(/text-transform: uppercase/.test(thRule) &&
     !/toUpperCase/.test(grab('buildIngestWorkbook')),
     'the rule uppercases; the workbook deliberately does NOT alter the strings');

  // ---- the TOTAL row, from .data-table tbody tr.is-total td (line 565) ----
  const totRule = ruleOf('.data-table tbody tr.is-total td');
  ok(totRule.length > 0, 'the source rule .data-table tbody tr.is-total td is found');
  ok(/font-weight: 700/.test(totRule) && /background: var\(--white-smoke\)/.test(totRule) &&
     /border-top: 2px solid var\(--ink\)/.test(totRule) && /color: var\(--text\)/.test(totRule),
     'and carries all four properties the formats copy');
  [['XLSX_STYLE_TOTAL', false], ['XLSX_STYLE_TOTAL_LABEL', true]].forEach(([k, wraps]) => {
    const xf = xfAll[api.styleConsts[k]];
    const font = fonts[idOf(xf, 'fontId')] || '';
    const fill = fills[idOf(xf, 'fillId')] || '';
    const bid = idOf(xf, 'borderId');
    ok(/<b\/>/.test(font), k + ': bold, per font-weight 700');
    ok(font.indexOf(tokenHex('text')) >= 0, k + ': in --text');
    ok(fill.indexOf(tokenHex('white-smoke')) >= 0, k + ': on --white-smoke');
    ok(bid === 1 && /<top style="medium">/.test(borders[bid] || ''),
       k + ': with a top border, the nearest xlsx form of border-top 2px');
    ok((borders[bid] || '').indexOf(tokenHex('ink')) >= 0, k + ': in --ink');
    ok(/applyBorder="1"/.test(xf), k + ': and applyBorder, or Excel drops it');
    ok(/wrapText="1"/.test(xf) === wraps,
       k + ': wraps=' + wraps + ', matching its column');
  });
  /* HONEST about the palette: --text and --ink are the SAME hex in this theme,
   * so the total row's font colour alone cannot distinguish them. The
   * distinction that IS proven is structural: the border uses the ink token and
   * the font the text token, as the two CSS declarations do. */
  ok(tokenHex('text') === tokenHex('ink'),
     'noted: --text and --ink are the same hex (' + tokenHex('text') + ')');

  // ---- and the styles actually reach the cells ----
  const s2 = z.parts['xl/worksheets/sheet2.xml'].text;
  const table = PAYLOAD.tables[TABLE];
  const schema = api.getTableSchema(table, YEAR);
  const src = api.ingestTemplateSource(table, YEAR);
  const computed = api.ingestComputed(src.rows, TABLE, schema);
  const totalIdx = src.rows.map((r, i) => i).filter(i => computed.totalRow(i));
  ok(totalIdx.length > 0, TABLE + ' has a Total row to style: ' + totalIdx.length);
  const rowXml = {};
  (s2.match(/<row r="\d+"[\s\S]*?<\/row>/g) || []).forEach(r => {
    rowXml[parseInt(r.match(/r="(\d+)"/)[1], 10)] = r;
  });
  let styledWhole = 0;
  totalIdx.forEach(i => {
    const r = rowXml[i + 2] || '';
    const used = (r.match(/s="(\d+)"/g) || []).map(m => parseInt(m.slice(3), 10));
    const wantLbl = api.styleConsts.XLSX_STYLE_TOTAL_LABEL;
    const wantRest = api.styleConsts.XLSX_STYLE_TOTAL;
    if (used.length === schema.length && used[0] === wantLbl &&
        used.slice(1).every(s => s === wantRest)) styledWhole++;
  });
  ok(styledWhole === totalIdx.length,
     'every Total row is styled WHOLE, label and values alike: ' + styledWhole);
  /* And the converse, which is the assertion that would catch styling leaking
   * onto data rows: no ordinary row wears either total format. */
  const leaked = src.rows.map((r, i) => i)
    .filter(i => !computed.totalRow(i))
    .filter(i => {
      const r = rowXml[i + 2] || '';
      return new RegExp('s="' + api.styleConsts.XLSX_STYLE_TOTAL + '"').test(r) ||
             new RegExp('s="' + api.styleConsts.XLSX_STYLE_TOTAL_LABEL + '"').test(r);
    });
  ok(leaked.length === 0,
     'and NO data row wears it' + (leaked.length ? ': rows ' + leaked.slice(0, 5) : ''));
  ok(new RegExp('<c r="A2" s="' + api.styleConsts.XLSX_STYLE_LABEL + '"').test(s2),
     'ordinary label cells use the wrapped label format');
}

lines.push('');
lines.push('=== ROUND 6: real column widths, from MEASURED labels ===');
if (z) {
  /* Excel does not autofit at generation time, so the widths are written. They
   * are MEASURED per table rather than set to one global number: the payload's
   * longest label is 136 characters and A1's longest is 60, and a 136-wide
   * column would be unusable on every other sheet. */
  const widthsOf = (xml) => (xml.match(/<col [^>]*>/g) || []).map(c => ({
    min: parseInt(c.match(/min="(\d+)"/)[1], 10),
    w: parseInt(c.match(/width="(\d+)"/)[1], 10),
    custom: /customWidth="1"/.test(c),
  }));
  const longestIn = (id) => {
    const t = PAYLOAD.tables[id];
    const s = api.ingestTemplateSource(t, YEAR);
    return s.rows.reduce((m, r) => Math.max(m, String(r[0] == null ? '' : r[0]).length), 0);
  };
  /* the measurement itself, stated as a number in the evidence */
  const allLabels = Object.keys(PAYLOAD.tables).map(id => ({ id: id, n: longestIn(id) }))
    .sort((x, y) => y.n - x.n);
  ok(allLabels[0].n === 136 && allLabels[0].id === 'I1',
     'MEASURED: the longest label in the payload is ' + allLabels[0].n +
     ' chars, in ' + allLabels[0].id);
  ok(longestIn('A1') === 60, 'and A1 s longest is 60, which is why one number would not do');

  const cols = widthsOf(z.parts['xl/worksheets/sheet2.xml'].text);
  const schema = api.getTableSchema(PAYLOAD.tables[TABLE], YEAR);
  ok(cols.length === schema.length,
     'a width for every column, not just the first: ' + cols.length);
  ok(cols.every(c => c.custom), 'each declared customWidth, or Excel ignores it');
  ok(cols.every((c, i) => c.min === i + 1), 'and they cover columns 1..n in order');
  ok(cols[0].w === Math.min(64, Math.max(30, longestIn(TABLE) + 2)),
     TABLE + ' label column is ' + cols[0].w + ', its own longest label plus 2');
  ok(cols.slice(1).every(c => c.w >= 16 && c.w <= 28),
     'value columns sit inside the 16 to 28 clamp');
  const hdrLen = Math.max.apply(null, schema.slice(1).map(h => String(h).length));
  ok(cols.slice(1).some(c => c.w === Math.min(28, Math.max(16, hdrLen + 2))),
     'the widest of them is sized for its header (' + hdrLen + ' chars)');

  /* the clamp, and the reason it is SAFE: the label column wraps */
  const wide = api.buildIngestWorkbook('I1', YEAR);
  const wideCols = widthsOf(unzipStored(wide.bytes).parts['xl/worksheets/sheet2.xml'].text);
  ok(longestIn('I1') > 64 && wideCols[0].w === 64,
     'I1 s 136-char label CLAMPS to 64 rather than producing an unusable column');
  const styles = unzipStored(wide.bytes).parts['xl/styles.xml'].text;
  const xfAll = ((styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/) || [])[1] || '')
    .match(/<xf [\s\S]*?<\/xf>/g) || [];
  ok(/wrapText="1"/.test(xfAll[api.styleConsts.XLSX_STYLE_LABEL]) &&
     /wrapText="1"/.test(xfAll[api.styleConsts.XLSX_STYLE_TOTAL_LABEL]),
     'and the clamp is SAFE because both label formats wrap: nothing bleeds');
  const s2wide = unzipStored(wide.bytes).parts['xl/worksheets/sheet2.xml'].text;
  ok(!/customHeight="1"/.test(s2wide),
     'no row heights are set on the table sheet, so Excel auto-fits the wrapped rows');

  /* every table builds, and none of them produces a column outside the clamps */
  const ids = Object.keys(PAYLOAD.tables);
  let built = 0; const bad = [];
  ids.forEach(id => {
    const w = api.buildIngestWorkbook(id, YEAR);
    if (!w) return;
    built++;
    const c = widthsOf(unzipStored(w.bytes).parts['xl/worksheets/sheet2.xml'].text);
    if (!(c[0].w >= 30 && c[0].w <= 64)) bad.push(id + ' label ' + c[0].w);
    if (!c.slice(1).every(x => x.w >= 16 && x.w <= 28)) bad.push(id + ' value');
  });
  ok(built === ids.length, 'all ' + built + ' tables produce a workbook');
  ok(bad.length === 0, 'and every column on every one of them respects the clamps' +
     (bad.length ? ': ' + bad.slice(0, 5).join(', ') : ''));
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
  // the guard, measured and NOT currently load-bearing
  ok(api.xlsxSheetName('A.1 With: Bad/Chars [x]') === 'A.1 With Bad Chars x',
     'the guard replaces forbidden characters');
  ok(api.xlsxSheetName('x'.repeat(40)).length === 31, 'and truncates to 31');
  const longest = Object.values(PAYLOAD.tables).map(t =>
    t.id.replace(/^([A-Z])(\d+)$/, '$1.$2') + ' ' + (t.short_title || ''))
    .sort((a, b) => b.length - a.length)[0];
  ok(longest.length <= 31,
     'but no real table needs it: longest is ' + longest.length + ' chars');
}

lines.push('');
lines.push('=== ROUND 5: the Instructions sheet, redesigned and verbatim ===');
if (z) {
  const s1 = z.parts['xl/worksheets/sheet1.xml'].text;
  const texts = (s1.match(/<t xml:space="preserve">([\s\S]*?)<\/t>/g) || [])
    .map(m => m.replace(/^<t xml:space="preserve">/, '').replace(/<\/t>$/, '')
      .replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  const APPROVED = [
    'Con Edison DAC Annual Report',
    'Import Format Example',
    'A.1 Incentive $ \u00b7 reporting year 2026',
    'About this workbook',
    'This workbook is a read-only example of the import format for A.1 Incentive $, reporting year 2026. Every cell is locked on purpose: it is a reference, not a form.',
    'Nothing here is editable. Prepare your own CSV from the second sheet, as step 2 describes.',
    'How to prepare your file',
    '1. Go to the second sheet, named A.1 Incentive $. It shows the exact layout the import expects: the header row, one row per program name, and (calculated) marking the cells the dashboard computes after import.',
    '2. Create your own file from it: with that sheet ACTIVE (selected), use File, Save As, and choose CSV UTF-8 (Comma delimited). Excel saves only the active sheet, so these instructions are never part of your file.',
    /* CLCPA-240 round 2 amended step 3 and added the paragraph after it. The
     * approved text is a PIN, so it is updated deliberately and in full rather
     * than loosened: Emely ratified one instructions line explaining the
     * (no value) marking, because a blank header cell told the operator
     * nothing and typing into one silently moved computed totals. */
    '3. Open the CSV you saved and fill in the values. Type values only in the positions the example shows empty; leave (calculated) and (no value) positions exactly as they are; do not change the header row or the program names. You MAY add new program rows at the bottom: the import will create them.',
    'Some tables group their rows under a heading, and a heading row is marked (no value) across its columns. A heading is a caption for the rows beneath it, not a row of its own: it takes no figures, and the import uses it to know which group each row belongs to. Leave those rows alone.',
    '4. In the dashboard, open Report Data, Add New Year, choose this section and table, Import From File, and pick your CSV. The values land as a draft for your review; nothing is stored until you press Save.',
    'Generated by the DAC Annual Report dashboard from the live table definition. Re-download it whenever the table changes.',
  ];
  ok(texts.length === APPROVED.length,
     'the expected number of text blocks: ' + texts.length + ' of ' + APPROVED.length);
  APPROVED.forEach((want, i) => {
    ok(texts[i] === want, 'block ' + (i + 1) + ' is verbatim' +
       (texts[i] === want ? '' : ': got ' + JSON.stringify((texts[i] || '').slice(0, 80))));
  });
  ok(APPROVED[2].indexOf('A.1 Incentive $') >= 0 && APPROVED[2].indexOf('2026') >= 0,
     'the bracketed parts are substituted with the real table and year');
  ok(/read-only example/.test(texts.join(' ')) && /not a form/.test(texts.join(' ')),
     'and the text says the workbook is a read-only example, not a form');
  ok(/You MAY add new program rows at the bottom/.test(texts.join(' ')),
     'and tells the operator they may append program rows');
  // the header block uses the header styles, and the body wraps
  const cellStyles = (s1.match(/<c r="[A-Z]+\d+" s="(\d+)"/g) || [])
    .map(m => parseInt(m.match(/s="(\d+)"/)[1], 10));
  ok(cellStyles.indexOf(api.styleConsts.XLSX_STYLE_APPNAME) >= 0, 'the app label style is used');
  ok(cellStyles.indexOf(api.styleConsts.XLSX_STYLE_TITLE) >= 0, 'the title style is used');
  ok(cellStyles.indexOf(api.styleConsts.XLSX_STYLE_SECTION) >= 0, 'section headings are used');
  ok(cellStyles.indexOf(api.styleConsts.XLSX_STYLE_BAND) >= 0, 'the callout band is used');
  ok(cellStyles.indexOf(api.styleConsts.XLSX_STYLE_NOTE) >= 0, 'and the closing note');
  const styles = z.parts['xl/styles.xml'].text;
  const xfList = ((styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/) || [])[1] || '')
    .match(/<xf [\s\S]*?<\/xf>/g) || [];
  ok(/wrapText="1"/.test(xfList[api.styleConsts.XLSX_STYLE_BODY] || ''),
     'the body style wraps its text');
  ok(/wrapText="1"/.test(xfList[api.styleConsts.XLSX_STYLE_BAND] || ''),
     'and so does the callout');
  ok((s1.match(/customHeight="1"/g) || []).length >= 10,
     'rows carry set heights so the wrapped text is readable: ' +
     (s1.match(/customHeight="1"/g) || []).length);
  ok(/<cols><col min="1" max="1" width="96"/.test(s1),
     'and column A is wide enough to read');
}

lines.push('');
lines.push('=== PROTECTION on both sheets, no password ===');
if (z) {
  ['sheet1', 'sheet2'].forEach(n => {
    const t = z.parts['xl/worksheets/' + n + '.xml'].text;
    ok(/<sheetProtection sheet="1" objects="1" scenarios="1"\/>/.test(t),
       n + ': protected, structure and objects included');
    ok(!/password=/.test(t) && !/algorithmName=/.test(t) && !/hashValue=/.test(t),
       n + ': NO password, of any kind');
  });
  ok(true, 'protection is guidance against accidents, not security (stated, not tested)');
}

lines.push('');
lines.push('=== PER-CELL: every cell on BOTH sheets resolves LOCKED ===');
let sheet2Cells = null;
if (z && lockedByIndex) {
  const readCells = (xml) => {
    const out = {};
    const re = /<c r="([A-Z]+)(\d+)" s="(\d+)"(?:\s*\/>|[^>]*>([\s\S]*?)<\/c>)/g;
    let m;
    while ((m = re.exec(xml)) !== null) {
      const t = m[4] ? (m[4].match(/<t[^>]*>([\s\S]*?)<\/t>/) || [])[1] : null;
      out[m[1] + m[2]] = { col: m[1], row: parseInt(m[2], 10),
        style: parseInt(m[3], 10),
        text: t == null ? null : t.replace(/&amp;/g, '&').replace(/&apos;/g, "'")
          .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>') };
    }
    return out;
  };
  ['sheet1', 'sheet2'].forEach(n => {
    const cells = readCells(z.parts['xl/worksheets/' + n + '.xml'].text);
    const keys = Object.keys(cells);
    ok(keys.length > 0, n + ': has cells to check: ' + keys.length);
    const unlocked = keys.filter(k => lockedByIndex[cells[k].style] !== true);
    ok(unlocked.length === 0, n + ': EVERY one of its ' + keys.length +
       ' cells resolves locked' + (unlocked.length ? ': ' + unlocked.slice(0, 5) : ''));
    const badStyle = keys.filter(k => cells[k].style >= lockedByIndex.length);
    ok(badStyle.length === 0, n + ': and every style index is a real format');
  });

  // the table sheet's content, per cell
  const table = PAYLOAD.tables[TABLE];
  const schema = api.getTableSchema(table, YEAR);
  const src = api.ingestTemplateSource(table, YEAR);
  const computed = api.ingestComputed(src.rows, TABLE, schema);
  sheet2Cells = readCells(z.parts['xl/worksheets/sheet2.xml'].text);
  const expected = (src.rows.length + 1) * schema.length;
  ok(Object.keys(sheet2Cells).length === expected,
     'the table sheet writes every cell: ' + Object.keys(sheet2Cells).length +
     ' of ' + expected);

  let hdr = 0, lab = 0, calc = 0, empty = 0; const wrong = [];
  schema.forEach((h, c) => {
    const cell = sheet2Cells[api.xlsxCol(c + 1) + '1'];
    if (cell && cell.style === api.styleConsts.XLSX_STYLE_HEADER && cell.text === h) hdr++;
    else wrong.push(api.xlsxCol(c + 1) + '1 header');
  });
  src.rows.forEach((row, idx) => {
    const rn = idx + 2;
    schema.forEach((h, c) => {
      const ref = api.xlsxCol(c + 1) + rn;
      const cell = sheet2Cells[ref];
      if (!cell) { wrong.push(ref + ' missing'); return; }
      if (c === 0) { if (cell.text === row[0]) lab++; else wrong.push(ref + ' label'); }
      else if (computed.any(idx, c)) {
        if (cell.text === '(calculated)') calc++; else wrong.push(ref + ' calculated');
      } else if (cell.text === null) empty++;
      else wrong.push(ref + ' should be empty, got ' + JSON.stringify(cell.text));
    });
  });
  ok(wrong.length === 0, 'and every cell has the right content' +
     (wrong.length ? ': wrong at ' + wrong.slice(0, 6).join(', ') : ''));
  ok(hdr === schema.length, 'all ' + hdr + ' header cells: bold style, correct text');
  ok(lab === src.rows.length, 'all ' + lab + ' label cells: correct label');
  ok(calc > 0, calc + ' calculated cells marked (calculated)');
  ok(empty > 0, empty + ' value cells EMPTY, showing the format without filling it');
  ok(hdr + lab + calc + empty === expected,
     'and those four groups account for every cell: ' + (hdr + lab + calc + empty));
  const derivedCols = schema.filter((h, c) => c > 0 && computed.derivedCol(c)).length;
  const totalRows = src.rows.filter((r, i) => computed.totalRow(i)).length;
  ok(empty === (src.rows.length - totalRows) * (schema.length - 1 - derivedCols),
     'the empty count follows from the payload: (rows minus totals) x value columns');
  ok(src.borrowed && wb.borrowedFrom === src.year,
     'the labels are BORROWED for the new year, from ' + wb.borrowedFrom);
}

lines.push('');
lines.push('=== THE ROUND TRIP, through the shipped importer ===');
if (z && sheet2Cells) {
  const table = PAYLOAD.tables[TABLE];
  const schema = api.getTableSchema(table, YEAR);
  const src = api.ingestTemplateSource(table, YEAR);
  const maxRow = src.rows.length + 1;
  const fld = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csvLines = [];
  for (let r = 1; r <= maxRow; r++) {
    const row = [];
    for (let c = 1; c <= schema.length; c++) {
      const cell = sheet2Cells[api.xlsxCol(c) + r];
      row.push(fld(cell ? cell.text : ''));
    }
    csvLines.push(row.join(','));
  }
  const csv = csvLines.join('\r\n') + '\r\n';
  ok(csvLines[0] === schema.map(fld).join(','),
     'the reconstructed CSV starts with the schema header row');

  const res = api.buildIngestImport(api.parseCsvRows(csv), schema, [], TABLE);
  ok(res.ok, 'the SHIPPED importer plans it with no hard rejections' +
     (res.ok ? '' : ': ' + (res.rejections[0] || {}).why));
  ok(res.addedRows.length === src.rows.length,
     'creating a row per label, as a new year needs: ' + res.addedRows.length);
  ok(res.notTouched.computed.length > 0,
     'the (calculated) cells land in NOT TOUCHED: ' + res.notTouched.computed.length);
  ok(res.populated.length === 0,
     'and nothing is populated, because the example is deliberately empty');
  ok(res.notTouched.unmatchedColumns.length === 0, 'no column is unmatched');

  /* THE OPERATOR'S OWN PATH, which round 5 makes the only path: they fill the
   * values in their own CSV, and they MAY APPEND program rows. */
  const filled = csvLines.map((line, i) => {
    if (i === 0) return line;
    return line.split(',').map((v, c) => (c > 0 && v === '') ? String(100 + i) : v).join(',');
  });
  const appended = filled.concat([
    fld('New Program One') + ',7000,3000,',
    fld('New Program Two') + ',8000,4000,',
  ]).join('\r\n') + '\r\n';
  const res2 = api.buildIngestImport(api.parseCsvRows(appended), schema, [], TABLE);
  ok(res2.ok, 'with values filled in AND two program rows appended, it still plans cleanly');
  ok(res2.populated.length > 0, 'the typed values import: ' + res2.populated.length + ' cells');
  ok(res2.addedRows.length === src.rows.length + 2,
     'and the appended rows are CREATED: ' + res2.addedRows.length + ' rows added');
  ok(res2.addedRows.indexOf('New Program One') >= 0 &&
     res2.addedRows.indexOf('New Program Two') >= 0,
     'named in the result, so the operator sees what was created');
  ok(res2.notTouched.computed.length > 0,
     'and the calculated cells stay untouched: ' + res2.notTouched.computed.length);

  // duplicates and blanks in the operator's own file still behave
  const dup = filled.concat([fld('New Program One') + ',1,2,',
                             fld('New Program One') + ',3,4,']).join('\r\n') + '\r\n';
  const res3 = api.buildIngestImport(api.parseCsvRows(dup), schema, [], TABLE);
  ok(!res3.ok, 'a duplicated program name is a hard rejection');
  ok((res3.rejections[0] || {}).why && /rows with this label/.test(res3.rejections[0].why),
     'naming the ambiguity: ' + (res3.rejections[0] || {}).why);
  ok(res3.candidate === null, 'and nothing is applied');
  const noLabel = filled.concat([',9,9,']).join('\r\n') + '\r\n';
  const res4 = api.buildIngestImport(api.parseCsvRows(noLabel), schema, [], TABLE);
  ok(res4.ok, 'a row with no program name does not fail the import');
  ok(res4.notTouched.unmatchedRows.some(x => /the row has no label/.test(x.why)),
     'and is reported in the result panel with its reason');
}

lines.push('');
lines.push('=== BASE controls: none of this existed ===');
{
  /* Only things that exist NOW are worth a BASE control. The logo names moved
   * to the round 6 removal section, where they are asserted absent from the
   * SHIPPED source: absent from BASE too would be vacuous on both sides. */
  ['function zipStored', 'function crc32', 'function buildIngestWorkbook',
   'function xlsxStylesXml', 'function downloadBinaryFile',
   'sheetProtection', 'showGridLines'].forEach(s => {
    ok(BASE_SRC.indexOf(s) < 0, 'BASE control: no ' + s);
  });
  ok(SRC.indexOf('function buildIngestTemplate') < 0, 'the CSV template is deleted');
  const writer = grab('buildIngestWorkbook') + grab('zipStored') + grab('crc32') +
    grab('xlsxStylesXml') + grab('xlsxSheetXml');
  ok(!/require\(|import\s+\w+\s+from|unpkg|cdnjs|jsdelivr|SheetJS|xlsx\.min/.test(writer),
     'and the writer pulls in no dependency of any kind');
  ok(!/new (?:De)?CompressionStream|(?:De)?CompressionStream\(/.test(SRC),
     'nor ever CALLS a compression stream: STORED entries need none');
}

lines.push('');
lines.push('======================================================================');
lines.push('  ' + pass + ' passed, ' + fail + ' failed');
lines.push('======================================================================');
const out = lines.join('\n');
console.log(out);
fs.writeFileSync(path.join(__dirname, 'suite-xlsx-output.txt'), out + '\n');
process.exitCode = fail ? 1 : 0;
