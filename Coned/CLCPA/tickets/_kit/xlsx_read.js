/* Read back a workbook this app generated, cell by cell.
 *
 * WHY IT IS ITS OWN FILE WITH ITS OWN TEST. My first cut of this reader used
 * `<c r="A1"([^>]*)(?:\/>|>...)`, and the greedy attribute group swallowed the
 * closing slash of an EMPTY cell -- `<c r="B2" s="2"/>` -- so two blank cells
 * and the one after them merged into a single reading. That made a correct H1
 * template look like it had lost four columns, and I was one step from
 * reporting a fabricated defect in a ticket. A reader that mis-parses is
 * indistinguishable from an app that mis-writes.
 *
 * The archive is STORED (no compression) by design, so the sheet XML sits in
 * the bytes verbatim and no inflate is needed.
 */

/** Every <worksheet> payload, in archive order. */
function worksheets(bytes) {
  const s = Buffer.from(bytes).toString('latin1');
  const out = [];
  let k = 0;
  for (;;) {
    const j = s.indexOf('<worksheet', k);
    if (j < 0) break;
    const e = s.indexOf('</worksheet>', j);
    if (e < 0) break;
    out.push(s.slice(j, e + 12));
    k = e + 1;
  }
  return out;
}

/** One sheet -> array of rows; each row is a map of column letter -> text. */
function sheetRows(xml) {
  const rows = xml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || [];
  return rows.map((r) => {
    const cells = {};
    /* SELF-CLOSING CELLS FIRST, and the attribute run must not cross the
     * slash: [^>] would eat it and merge this cell with the next. */
    const re = /<c\s+([^>\/]*?)\s*(\/>|>([\s\S]*?)<\/c>)/g;
    let m;
    while ((m = re.exec(r))) {
      const attrs = m[1] || '';
      const ref = /r="([A-Z]+)\d+"/.exec(attrs);
      if (!ref) continue;
      const inner = m[3] === undefined ? '' : m[3];
      const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner);
      const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
      cells[ref[1]] = t ? t[1] : (v ? v[1] : '');
    }
    return cells;
  });
}

/** Column letters actually present in a row, in spreadsheet order. */
const colsOf = (row) => Object.keys(row).sort((a, b) =>
  (a.length - b.length) || (a < b ? -1 : a > b ? 1 : 0));

/** A row as a dense array over columns A..last, blanks included. */
function dense(row) {
  const cols = colsOf(row);
  if (!cols.length) return [];
  const idx = (L) => L.split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
  const last = idx(cols[cols.length - 1]);
  const out = [];
  for (let i = 1; i <= last; i++) {
    const L = (function name(n) {
      let s = '';
      while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
      return s;
    })(i);
    out.push(row[L] === undefined ? null : row[L]);
  }
  return out;
}

/** The data sheet of a generated template (sheet 1 is the instructions). */
function templateRows(wb) {
  const ws = worksheets(wb.bytes !== undefined ? wb.bytes : wb);
  if (ws.length < 2) throw new Error('xlsx_read: expected at least two worksheets, got ' + ws.length);
  return sheetRows(ws[1]);
}

module.exports = { worksheets, sheetRows, colsOf, dense, templateRows };
