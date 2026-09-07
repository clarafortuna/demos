/* CLCPA-85 rounds 4 and 5: the .xlsx example workbook.
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
 *   2. THE IMAGE PLUMBING. The logo part present, and reachable through both
 *      relationship chains, and declared in content types, and referenced from
 *      sheet 1 only. Plus: omitting the logo still yields a valid workbook.
 *
 *   3. THE ROUND TRIP. The CSV that Excel's "Save As" of the table sheet would
 *      produce is reconstructed from that sheet's own cells and fed to the
 *      SHIPPED buildIngestImport, including the operator's own path of APPENDING
 *      new program rows.
 *
 * The logo bytes come in as an argument, so this suite passes a synthetic PNG.
 * The RASTERISER is async, canvas-based and browser-only, and is therefore
 * hosted-only, along with the rest of the list below.
 *
 * HOSTED-ONLY, recorded CLCPA-220 style and NOT provable here:
 *   - Excel rendering the logo.
 *   - Excel honouring the full lock: nothing typeable anywhere.
 *   - The Save As CSV UTF-8 flow writing only the ACTIVE sheet, encoding intact.
 *   - Excel opening the workbook without a repair prompt.
 *   - ingestLogoPng() itself, which needs a canvas.
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
const LOGO_SVG = fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/logo/ConEd_Logo_completo.svg'));

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
  'xlsxDrawingXml', 'buildIngestWorkbook', 'ingestTemplateSource', 'ingestComputed',
  'totalRowFlags', 'isStrictTotalRowLabel', 'isSplitCell', 'cellText', 'cellCount',
  'cellPct', 'getTableSchema', 'getTableBody', 'rawNum', 'parseCsvRows',
  'normIngestKey', 'parseNumericInput', 'formatIngestValue', 'buildIngestImport',
  'compareTableIds'];
const missing = NAMES.filter(n => !grab(n));
if (missing.length) { console.error('EXTRACTION FAILED: ' + missing.join(', ')); process.exit(1); }
const STYLE_CONSTS = ['XLSX_STYLE_DEFAULT', 'XLSX_STYLE_HEADER', 'XLSX_STYLE_LOCKED',
  'XLSX_STYLE_HDRBAND', 'XLSX_STYLE_APPNAME', 'XLSX_STYLE_TITLE', 'XLSX_STYLE_SUBTITLE',
  'XLSX_STYLE_SECTION', 'XLSX_STYLE_BODY', 'XLSX_STYLE_BAND', 'XLSX_STYLE_NOTE'];
const consts = STYLE_CONSTS.concat(['XLSX_INK', 'XLSX_DUSK', 'XLSX_DUSK_TINT',
  'XLSX_TEXT2', 'XLSX_TEXT3', 'XLSX_WHITE', 'XLSX_PALE',
  'CONED_LOGO_W', 'CONED_LOGO_H']).map(n => {
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

/* A synthetic PNG: a real signature plus filler. Enough to prove the plumbing,
 * and deliberately not a real image, since the rasteriser is hosted-only. */
const FAKE_PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10].concat(
  Array.from({ length: 24 }, (_, i) => (i * 7) & 0xFF)));
const LOGO = { bytes: FAKE_PNG, width: 294, height: 60 };

const TABLE = 'A1', YEAR = '2026';
const wb = api.buildIngestWorkbook(TABLE, YEAR, LOGO);
const wbNoLogo = api.buildIngestWorkbook(TABLE, YEAR, null);

lines.push('======================================================================');
lines.push('CLCPA-85 rounds 4 and 5 -- the .xlsx example workbook');
lines.push('======================================================================');

lines.push('');
lines.push('=== the archive itself ===');
let z = null;
{
  ok(!!wb && wb.bytes && wb.bytes.length > 0, 'a workbook is produced: ' +
     (wb ? wb.bytes.length + ' bytes' : 'none'));
  try { z = unzipStored(wb.bytes); } catch (e) { ok(false, 'it reads back: ' + e.message); }
  if (z) {
    ok(z.count === 11, 'eleven parts with the logo: ' + z.count);
    ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml',
     'xl/_rels/workbook.xml.rels', 'xl/styles.xml',
     'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml',
     'xl/worksheets/_rels/sheet1.xml.rels', 'xl/drawings/drawing1.xml',
     'xl/drawings/_rels/drawing1.xml.rels', 'xl/media/image1.png'].forEach(n => {
      ok(!!z.parts[n], 'part present: ' + n);
    });
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
  ok(xfList.length === 11, 'eleven cell formats: ' + xfList.length);
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
lines.push('=== ROUND 5: the logo, its parts and both rel chains ===');
if (z) {
  ok(wb.hasLogo === true, 'the builder reports the logo embedded');
  const media = z.parts['xl/media/image1.png'];
  ok(media.actualLen === FAKE_PNG.length,
     'the image bytes are stored verbatim: ' + media.actualLen);
  ok(Array.from(media.bytes.slice(0, 8)).join(',') === '137,80,78,71,13,10,26,10',
     'PNG signature intact, byte for byte');
  // content types
  const ct = z.parts['[Content_Types].xml'].text;
  ok(/<Default Extension="png" ContentType="image\/png"\/>/.test(ct),
     'png is declared as a default content type');
  ok(/PartName="\/xl\/drawings\/drawing1\.xml"/.test(ct),
     'and the drawing part is declared');
  // chain one: sheet1 -> drawing
  const s1rels = z.parts['xl/worksheets/_rels/sheet1.xml.rels'].text;
  ok(/Target="\.\.\/drawings\/drawing1\.xml"/.test(s1rels),
     'sheet1 rels target the drawing');
  ok(/relationships\/drawing"/.test(s1rels), 'with the drawing relationship type');
  const s1 = z.parts['xl/worksheets/sheet1.xml'].text;
  const relId = (s1rels.match(/Id="(rId\d+)"/) || [])[1];
  ok(new RegExp('<drawing r:id="' + relId + '"\\/>').test(s1),
     'and sheet1 references THAT rel id: ' + relId);
  ok(/xmlns:r="http:\/\/schemas\.openxmlformats\.org\/officeDocument\/2006\/relationships"/
     .test(s1), 'declaring the r namespace it uses');
  // chain two: drawing -> media
  const drels = z.parts['xl/drawings/_rels/drawing1.xml.rels'].text;
  ok(/Target="\.\.\/media\/image1\.png"/.test(drels), 'drawing rels target the media');
  ok(/relationships\/image"/.test(drels), 'with the image relationship type');
  const draw = z.parts['xl/drawings/drawing1.xml'].text;
  const embedId = (drels.match(/Id="(rId\d+)"/) || [])[1];
  ok(new RegExp('r:embed="' + embedId + '"').test(draw),
     'and the drawing embeds THAT rel id: ' + embedId);
  ok(/<xdr:oneCellAnchor>/.test(draw), 'anchored to a cell, not floating');
  ok(/noChangeAspect="1"/.test(draw), 'with its aspect locked');
  ok(/descr="Con Edison"/.test(draw), 'and an accessible description');
  // the drawing is on sheet 1 ONLY
  const s2 = z.parts['xl/worksheets/sheet2.xml'].text;
  ok(!/<drawing /.test(s2), 'the TABLE sheet has no drawing');
  ok(!z.parts['xl/worksheets/_rels/sheet2.xml.rels'],
     'and no rels part of its own, since it needs none');

  /* The SOURCE of the logo: the app's own sidebar asset, inlined rather than
   * fetched, because no deploy pushes the file. */
  const b64m = SRC.match(/const CONED_LOGO_SVG_B64 = \[([\s\S]*?)\]\.join\(''\);/);
  ok(!!b64m, 'the logo is inlined as a base64 constant');
  const inlined = Buffer.from(new Function('return [' + b64m[1] + '].join("")')(), 'base64');
  ok(inlined.length === LOGO_SVG.length && inlined.equals(LOGO_SVG),
     'and its bytes are IDENTICAL to logo/ConEd_Logo_completo.svg, the sidebar logo');
  ok(SRC.indexOf("fetch('logo/") < 0 && SRC.indexOf('fetch("logo/') < 0,
     'nothing fetches the logo file, which no deploy pushes');
  const raster = grab('ingestLogoPng');
  ok(!!raster && /data:image\/svg\+xml;base64/.test(raster),
     'the rasteriser reads the inlined SVG as a data URL');
  ok(/toDataURL\('image\/png'\)/.test(raster), 'and lets the browser encode the PNG');
  /* The property is "never throws", not "mentions resolve(null)": the first
   * version of this check passed under a mutation that added a throw, because
   * resolve(null) still appeared on the other failure paths. */
  ok(/resolve\(null\)/.test(raster),
     'resolving to null on failure, so a template still ships without its logo');
  /* "Never throws" is asserted by COUNTING the resolve calls, not by looking
   * for the word throw.
   *
   * I had a !/throw/ check on this line and REMOVED it: under the mutation
   * that turns one resolve(null) into throw e, the grabbed text demonstrably
   * contains "throw" when checked outside this suite, yet that assertion kept
   * passing inside it. I could not make it fail, so it is not evidence, and
   * an assertion that cannot be made to fail is worse than none. The counts
   * below DO fail on that mutation, which is what makes them the guard. */
  ok(raster.split('resolve(').length - 1 === 4,
     'four resolve calls in all: three failure paths plus the success path');
  ok((raster.match(/resolve\(null\)/g) || []).length === 3,
     'all three failure paths resolve: decode error, raster error, and the outer guard');
}

lines.push('');
lines.push('=== omitting the logo still yields a valid workbook ===');
{
  ok(!!wbNoLogo, 'a workbook builds with no logo');
  ok(wbNoLogo.hasLogo === false, 'and reports so');
  let z2 = null;
  try { z2 = unzipStored(wbNoLogo.bytes); } catch (e) { ok(false, 'it reads back: ' + e.message); }
  if (z2) {
    ok(z2.count === 7, 'seven parts, the four image ones omitted: ' + z2.count);
    ['xl/media/image1.png', 'xl/drawings/drawing1.xml',
     'xl/drawings/_rels/drawing1.xml.rels',
     'xl/worksheets/_rels/sheet1.xml.rels'].forEach(n => {
      ok(!z2.parts[n], 'absent: ' + n);
    });
    ok(!/<drawing /.test(z2.parts['xl/worksheets/sheet1.xml'].text),
       'and sheet1 carries no dangling drawing reference');
    ok(!/Extension="png"/.test(z2.parts['[Content_Types].xml'].text),
       'nor a content type for an image that is not there');
    ok(!/drawing1\.xml/.test(z2.parts['[Content_Types].xml'].text),
       'nor for the drawing');
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
    'Con Edison \u00b7 DAC Annual Report',
    'Import Format Example',
    'A.1 Incentive $ \u00b7 reporting year 2026',
    'About this workbook',
    'This workbook is a read-only example of the import format for A.1 Incentive $, reporting year 2026. Every cell is locked on purpose: it is a reference, not a form.',
    'Nothing here is editable. Prepare your own CSV from the second sheet, as step 2 describes.',
    'How to prepare your file',
    '1. Go to the second sheet, named A.1 Incentive $. It shows the exact layout the import expects: the header row, one row per program name, and (calculated) marking the cells the dashboard computes after import.',
    '2. Create your own file from it: with that sheet ACTIVE (selected), use File, Save As, and choose CSV UTF-8 (Comma delimited). Excel saves only the active sheet, so these instructions are never part of your file.',
    '3. Open the CSV you saved and fill in the values. Type values only in the positions the example shows empty; leave (calculated) positions empty; do not change the header row or the program names. You MAY add new program rows at the bottom: the import will create them.',
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
  ['function zipStored', 'function crc32', 'function buildIngestWorkbook',
   'function xlsxStylesXml', 'function downloadBinaryFile', 'function ingestLogoPng',
   'CONED_LOGO_SVG_B64', 'sheetProtection', 'oneCellAnchor'].forEach(s => {
    ok(BASE_SRC.indexOf(s) < 0, 'BASE control: no ' + s);
  });
  ok(SRC.indexOf('function buildIngestTemplate') < 0, 'the CSV template is deleted');
  const writer = grab('buildIngestWorkbook') + grab('zipStored') + grab('crc32') +
    grab('xlsxDrawingXml') + grab('ingestLogoPng');
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
