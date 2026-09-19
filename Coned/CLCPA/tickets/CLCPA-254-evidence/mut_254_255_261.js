const _dacRepo = () => {
  const p = require('path'), f = require('fs');
  if (process.env.DAC_REPO) return p.resolve(process.env.DAC_REPO);
  let d = __dirname;
  for (let i = 0; i < 16; i++) {
    if (f.existsSync(p.join(d, '.clcpa-root'))) {
      const two = p.resolve(d, '..', '..');
      return f.existsSync(p.join(two, '.git')) ? two : d;
    }
    const u = p.dirname(d); if (u === d) break; d = u;
  }
  throw new Error('CLCPA project root not found above ' + __dirname + '; set DAC_REPO');
};
/* Mutation controls for Section C group E: CLCPA-254, 255, 261.
 *
 * The dangerous directions:
 *
 *   254 -- THE REGEX IS LOOSENED instead of the column declared, which is the
 *   CLCPA-212 defect returning on A3/A4; or the declaration is widened past
 *   the one column it was ruled for; or it stops being consulted at all.
 *
 *   255 -- THE X COMES BACK on a total row, or the ruling is overshot and the
 *   LABEL is locked too, reversing the CLCPA-205 exemption Emely upheld.
 *
 *   261 -- IT REJECTS instead of noticing, or it notices nothing, or it
 *   notices a percentage typed into a percentage column, which is noise.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = _dacRepo() + '';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-254-evidence';
const APP = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_254_255_261.js';

const M = [
  /* ---- 254 -------------------------------------------------------------- */
  { t: APP, name: '254 THE DEFECT: the declaration is never consulted',
    from: "        if ((pctCol[c] || avgCol[c]) &&\r\n            !isDeclaredSummable(tableId, schema[c])) continue;",
    to:   '        if (pctCol[c] || avgCol[c]) continue;',
    expect: 'S2 and it now computes' },
  { t: APP, name: '254 THE REGEX IS LOOSENED instead, which re-breaks A3/A4',
    from: "      return /\\bavg\\b/.test(s) || /\\baverage\\b/.test(s) ||",
    to:   "      return /\\bavg\\b/.test(s) ||",
    /* A3/A4's "Avg." still matches, but "Average Event Reductions" stops
     * being an average column -- the shortcut the ruling forbids. S9 pins
     * detectAvgColumns byte-identical, which is what sees it. */
    expect: 'S9 and detectAvgColumns is BYTE-IDENTICAL to BASE' },
  { t: APP, name: '254 the declaration is widened to every table',
    from: "  const SUMMABLE_COLS = {\r\n    C2: ['average event reductions (mw)'],\r\n  };",
    to:   "  const SUMMABLE_COLS = {\r\n    C2: ['average event reductions (mw)'],\r\n    A3: ['avg. incentives by participant', 'avg. energy savings by participant'],\r\n  };",
    expect: 'S11 the declaration names A3 nowhere' },
  { t: APP, name: '254 it matches on the heading of ANY table',
    from: '    const list = tableId && SUMMABLE_COLS[tableId];\r\n    if (!list) return false;',
    to:   '    const list = SUMMABLE_COLS[tableId] || SUMMABLE_COLS.C2;',
    expect: 'S13 per TABLE, so the same heading elsewhere is untouched' },

  /* ---- 255 -------------------------------------------------------------- */
  { t: APP, name: '255 THE X COMES BACK on a recognised total row',
    from: "        <td class=\"ingest-td-actions\">${(isHeaderRow || lockTotalRow || isTotal) ? ''",
    to:   "        <td class=\"ingest-td-actions\">${(isHeaderRow || lockTotalRow) ? ''",
    expect: 'D1 the actions cell is empty for a total row' },
  { t: APP, name: '255 OVERSHOT: the total rows LABEL is locked too',
    from: '            <input type="text" value="${escapeHtml(rawNum(v))}"${labelTip} data-row="${rowIdx}" data-col="0" class="ingest-cell ingest-cell-label" />',
    to:   '            ${isTotal ? `<span class="ingest-cell-calc">${escapeHtml(rawNum(v))}</span>` : `<input type="text" value="${escapeHtml(rawNum(v))}"${labelTip} data-row="${rowIdx}" data-col="0" class="ingest-cell ingest-cell-label" />`}',
    /* this is the CLCPA-205 exemption being reversed, which Emely upheld */
    expect: 'D3 the label input is byte-identical to BASE' },

  /* ---- 261 -------------------------------------------------------------- */
  { t: APP, name: '261 IT REJECTS instead of noticing',
    from: '          res.unitNotices.push(Object.assign({',
    to:   "          reject('A percentage cannot be imported into this column.', where);\r\n          res.unitNotices.push(Object.assign({",
    /* res.ok is not flipped by a rejection at this point, so N1 stays green;
     * N5b is the assertion that counts rejections. */
    expect: 'N5b with NOTHING rejected' },
  { t: APP, name: '261 it notices nothing at all',
    from: "        if (/^\\s*[-+]?[\\d.,]+\\s*%\\s*$/.test(String(raw)) && !pctCols[cIdx]) {",
    to:   '        if (false) {',
    expect: 'N2 and three cells are noticed' },
  { t: APP, name: '261 it notices a percentage in a PERCENTAGE column too',
    from: "        if (/^\\s*[-+]?[\\d.,]+\\s*%\\s*$/.test(String(raw)) && !pctCols[cIdx]) {",
    to:   "        if (/^\\s*[-+]?[\\d.,]+\\s*%\\s*$/.test(String(raw))) {",
    expect: 'N7 and a "45%" typed into it raises NO notice' },
  { t: APP, name: '261 the panel stops rendering the notices',
    from: '      '.repeat(0) + "    const notices = (r.unitNotices || []).length",
    to:   '    const notices = false && (r.unitNotices || []).length',
    /* the STRING survives in the dead expression, so N9 stays green; N5c
     * drives the panel and reads what it produced. */
    expect: 'N5c and the success panel announces them' },

  /* ---- the stored-year gate --------------------------------------------- */
  { t: APP, name: 'THE STORED-YEAR GATE: a recompute rewrites a filed total',
    from: '        if (!sums.colHasNum[c]) continue;             // nothing to sum: keep stored',
    to:   '        if (false) continue;',
    expect: 'Z3 C2/2025 is returned unchanged' },

  /* ---- the harness ------------------------------------------------------ */
  { t: SUITE, name: 'HARNESS: the audit case stops being driven on BASE',
    from: '  OLD.attempt(api => api.recomputeTotals(a, C2S, \'C2\', []));',
    to:   '  a[3][7] = null;',
    /* S1 still passes -- the line sets exactly what S1 checks. S3 is what
     * notices BASE was never driven, because it compares the other two
     * columns across the two sides. */
    expect: 'S3 while the other two totals are unchanged' },
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '8eaa2ac';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X3 BASE is a literal commit sha' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('Section C group E -- mutation controls');
log('======================================================================');

let caught = 0, missed = 0;
M.forEach((m) => {
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  if (n !== 1) { log('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED'); missed++; return; }
  fs.writeFileSync(m.t, base.replace(from, () => to));
  let out = '';
  try { out = execFileSync('node', ['suite_254_255_261.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }
  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const hit = fails.filter(l => l.indexOf(m.expect) >= 0);
  if (hit.length) {
    log('  red  ' + m.name);
    log('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 104));
    caught++;
  } else if (fails.length) {
    log('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    log('       want: ' + m.expect);
    log('       got : ' + fails[0].trim().slice(5, 104));
    missed++;
  } else { log('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.'); missed++; }
});

log('');
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length + ' guards');
let clean = '';
try { clean = execFileSync('node', ['suite_254_255_261.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-254-255-261-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
