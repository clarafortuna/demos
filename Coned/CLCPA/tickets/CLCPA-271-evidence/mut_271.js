/* Mutation controls for CLCPA-271.
 *
 * Every guard in suite_271 must fail on the defect it names. The ones that
 * matter most here are the two SURFACE controls: the defect existed in two
 * places and fixing either alone looks like success until the operator types.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync, execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-271-evidence';
/* THE MUTATION TARGET IS THE PINNED BUILD, not the working tree.
 * suite_271 reads be1d2a2 unless DAC_APP_OVERRIDE says
 * otherwise, so mutating the repo's app.js would change a file the suite
 * never opens and every control would pass. Same pattern as mut_244_r2. */
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || 'be1d2a2';
const APP = path.join(os.tmpdir(), 'clcpa-271-app-' + NEW_COMMIT + '.js');
fs.writeFileSync(APP, execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n'));
const SUITE = DIR + '/suite_271.js';

const OLD_CALC = "(v == null || v === '') ? '\u2014' : (typeof v === 'number' ? v.toLocaleString() : String(v))";

const M = [
  /* ---- surface 1: the renderer ------------------------------------------ */
  { t: APP, name: 'THE DEFECT RETURNS in the renderer: the total loses its currency',
    from: "          const display = (v == null || v === '') ? '\u2014'\r\n            : formatIngestValue(v, currencyCol[colIdx]);",
    to:   "          const display = (v == null || v === '') ? '\u2014' :\r\n            (typeof v === 'number' ? v.toLocaleString() : String(v));",
    expect: 'A1 the computed total renders $1,110,000',
    alt: 'A5 computed and typed cells now AGREE about the currency marker' },
  { t: APP, name: 'THE FORMATTER IS CALLED WITH THE ROW, not the column',
    from: '          const display = (v == null || v === \'\u2014\')',
    skipIfMissing: true,
    to:   '', expect: 'A1' },
  { t: APP, name: 'MONEY IS FORCED ON, so a count column grows a $',
    from: "          const display = (v == null || v === '') ? '\u2014'\r\n            : formatIngestValue(v, currencyCol[colIdx]);",
    to:   "          const display = (v == null || v === '') ? '\u2014'\r\n            : formatIngestValue(v, true);",
    expect: 'B1 a NON-currency numeric total keeps separators and takes no $',
    alt: 'D2 computed and typed cells agree on the $' },
  { t: APP, name: 'MONEY IS FORCED OFF, which is the original defect by another route',
    from: "          const display = (v == null || v === '') ? '\u2014'\r\n            : formatIngestValue(v, currencyCol[colIdx]);",
    to:   "          const display = (v == null || v === '') ? '\u2014'\r\n            : formatIngestValue(v, false);",
    expect: 'A1 the computed total renders $1,110,000',
    alt: 'D2 computed and typed cells agree on the $' },
  { t: APP, name: 'THE NULL GLYPH is replaced by an empty string',
    from: "          const display = (v == null || v === '') ? '\u2014'\r\n            : formatIngestValue(v, currencyCol[colIdx]);",
    to:   "          const display = (v == null || v === '') ? ''\r\n            : formatIngestValue(v, currencyCol[colIdx]);",
    expect: 'B3 an empty computed cell still renders the null glyph, unchanged' },

  /* ---- surface 2: the in-place refresh ----------------------------------- */
  /* THE CONTROL THIS TICKET TURNS ON. Fixing the renderer alone passes a
   * first-paint test and reverts on the first blur. If this mutation does not
   * turn the suite red, the suite is only testing first paint. */
  { t: APP, name: 'SURFACE 2 REVERTS: the in-place refresh drops the formatter',
    from: "        : ((v == null || v === '') ? '\u2014' : formatIngestValue(v, currencyCol[c]));",
    to:   '        : (' + OLD_CALC + ');',
    expect: 'E3b the in-place refresh uses the same formatter (the second surface)' },
  { t: APP, name: 'SURFACE 2 stops deriving its columns from the schema',
    from: '    const currencyCol = detectCurrencyColumns(i.schema);\r\n    document.querySelectorAll',
    to:   '    const currencyCol = {};\r\n    document.querySelectorAll',
    expect: 'E3c and it derives the money columns from the SCHEMA, as the renderer does' },

  /* ---- the read-only branch ---------------------------------------------- */
  { t: APP, name: 'THE READ-ONLY BRANCH is left on the old formatting',
    from: "          const text = (v == null || v === '') ? '\u2014'\r\n            : formatIngestValue(v, currencyCol[colIdx]);",
    to:   "          const text = (v == null || v === '') ? '\u2014' : String(v);",
    expect: 'C1 a read-only money cell formats too',
    alt: 'E3 exactly TWO render branches now call the shared formatter with the column' },

  /* ---- blast radius / no-hardcoding -------------------------------------- */
  { t: APP, name: 'A LITERAL $ is written into the render instead of deriving it',
    from: "          const display = (v == null || v === '') ? '\u2014'\r\n            : formatIngestValue(v, currencyCol[colIdx]);",
    to:   "          const display = (v == null || v === '') ? '\u2014'\r\n            : '$' + formatIngestValue(v, false);",
    expect: 'E8 neither carries a literal currency string',
    alt: 'B1 a NON-currency numeric total keeps separators and takes no $' },
  { t: APP, name: 'THE TABLE IS HARDCODED: E1 named in the render line',
    from: '            : formatIngestValue(v, currencyCol[colIdx]);\r\n          const calcCls',
    to:   "            : formatIngestValue(v, i.tableId === 'E1' || currencyCol[colIdx]);\r\n          const calcCls",
    expect: 'E7 neither names a table id',
    alt: 'B1 a NON-currency numeric total keeps separators and takes no $' },
  { t: APP, name: 'SOMETHING ELSE MOVED: the shared formatter is "helped"',
    from: "    return (v < 0 ? '-' : '') + (isCurrency ? '$' : '') + Math.abs(v).toLocaleString('en-US');",
    to:   "    return (v < 0 ? '-' : '') + '$' + Math.abs(v).toLocaleString('en-US');",
    expect: 'E4 formatIngestValue itself is BYTE-IDENTICAL to BASE',
    alt: 'B1 a NON-currency numeric total keeps separators and takes no $' },
  { t: APP, name: 'SOMETHING ELSE MOVED: the currency detector is widened',
    from: '  function detectCurrencyColumns(headerRow) {',
    to:   '  function detectCurrencyColumns(headerRow) {\r\n    if (headerRow) return headerRow.map(() => true);',
    expect: 'E5 detectCurrencyColumns is BYTE-IDENTICAL to BASE',
    alt: 'D3 and the known label-column false positives are still exactly 3' },

  /* ---- the harness ------------------------------------------------------- */
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '2361a6a';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X1 BASE is pinned to a literal commit sha, not a symbolic ref' },
  { t: SUITE, name: 'HARNESS: the renderer is re-implemented instead of sliced',
    from: 'const drive = buildCellFn(SRC);',
    to:   "const drive = (call) => call((row, rowIdx, isHeaderRow, lockTotalRow, isTotal, d, ro, cur, num, hc, i, c) => '<td><span>$' + row[c] + '</span></td>');",
    /* testing my own copy is a named failure class in this repo */
    expect: 'A1 the computed total renders $1,110,000',
    alt: 'B1 a NON-currency numeric total keeps separators and takes no $' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-271 -- mutation controls');
log('======================================================================');

let caught = 0, missed = 0, applied = 0;
M.forEach((m) => {
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  if (n !== 1) {
    if (m.skipIfMissing) { log('  --   ' + m.name + '  -- not applicable, skipped by design'); return; }
    log('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED');
    missed++; return;
  }
  applied++;
  fs.writeFileSync(m.t, base.replace(from, () => to));
  let out = '';
  try { out = execFileSync('node', ['suite_271.js'],
    { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }
  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const want = [m.expect].concat(m.alt ? [m.alt] : []);
  const hit = fails.filter(l => want.some(w => l.indexOf(w) >= 0));
  if (hit.length) {
    log('  red  ' + m.name);
    log('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 112));
    caught++;
  } else if (fails.length) {
    log('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    log('       want: ' + want.join(' OR '));
    log('       got : ' + fails[0].trim().slice(5, 112));
    missed++;
  } else {
    log('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.');
    missed++;
  }
});

log('');
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + applied + ' applied');
let clean = '';
try { clean = execFileSync('node', ['suite_271.js'],
    { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-271-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
