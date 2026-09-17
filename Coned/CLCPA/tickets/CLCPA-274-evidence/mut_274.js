/* Mutation controls for CLCPA-274.
 *
 * The control that carries this ticket is the SEPARATION: folding the marker
 * into `any` would make the importer start discarding figures preparers
 * actually filed, which is the opposite of CLCPA-272 ruling (b). That
 * mutation must turn the behaviour assertions red, not just a text pin.
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
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-274-evidence';
const SUITE = DIR + '/suite_274.js';
const APP = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js';

const M = [
  { t: APP, name: 'THE DEFECT RETURNS: the template writer goes back to `any`',
    from: '        if (computed.marksInTemplate(idx, c)) {',
    to:   '        if (computed.any(idx, c)) {',
    expect: 'A3 they are now marked (calculated)', alt: 'D2 and the workbook writer calls it' },

  /* THE ONE THIS TICKET EXISTS TO AVOID */
  { t: APP, name: 'THE MARKER IS FOLDED INTO `any`: the importer starts discarding filed figures',
    from: '      any: (r, c) => (!!totals[r] && (!!derived[c] || engineWrites(c))) ||\n        (!!derived[c] && !isTotalOnlyDerived(derived[c])),\n\n      /* CLCPA-274',
    to:   '      any: (r, c) => (!!totals[r] && (!!derived[c] || engineWrites(c))) ||\n        (!!derived[c] && !isTotalOnlyDerived(derived[c])) || sumCols.indexOf(c) >= 0,\n\n      /* CLCPA-274',
    expect: 'B2 and the provided 1500 LANDS -- not skipped as computed',
    alt: 'D5 the `any` accessor is BYTE-IDENTICAL to BASE' },

  { t: APP, name: 'THE IMPORT consults the template accessor',
    from: '        if (computed.any(t.rowIdx, cIdx)) {',
    to:   '        if (computed.marksInTemplate(t.rowIdx, cIdx)) {',
    expect: 'B2 and the provided 1500 LANDS -- not skipped as computed',
    alt: 'D3 while the IMPORT still calls `any`' },

  /* the relationship must stay the schema's, and CLCPA-272's */
  { t: APP, name: 'THE DERIVABLE COLUMNS become a hardcoded list',
    from: "    const sumCols = detectSumColumns(schema, rows, tableId).map(s => s.column);",
    to:   "    const sumCols = tableId === 'H1' ? [3] : [];",
    expect: 'C1 exactly the seven enumerated tables change',
    alt: 'D8 the derivable columns come from the schema, not a list' },
  { t: APP, name: 'THE DERIVABLE COLUMNS are detected without the body rows',
    from: '    const sumCols = detectSumColumns(schema, rows, tableId).map(s => s.column);',
    to:   '    const sumCols = detectSumColumns(schema, null, tableId).map(s => s.column);',
    /* without the rows the numeric mask cannot run and F4/F5's second label
     * column comes back as an addend, changing which columns are derivable */
    expect: 'D8 the derivable columns come from the schema, not a list',
    alt: 'C1 exactly the seven enumerated tables change' },
  { t: APP, name: 'THE MARKER reaches every column, not the derivable ones',
    from: '        return sumCols.indexOf(c) >= 0;',
    to:   '        return c > 0;',
    expect: 'C2 and 83 cells in total', alt: 'C1 exactly the seven enumerated tables change' },
  { t: APP, name: 'THE MARKER stops reaching the body rows',
    from: '        return sumCols.indexOf(c) >= 0;',
    to:   '        return false;',
    expect: 'A3 they are now marked (calculated)' },

  /* the group-header marker must still win */
  { t: APP, name: 'A GROUP HEADER starts claiming (calculated) instead of (no value)',
    from: '        if (isGroupHeader) return { style: style, text: INGEST_NOVALUE_MARKER };',
    to:   '        if (false) return { style: style, text: INGEST_NOVALUE_MARKER };',
    expect: 'D9 the group-header branch above it is unchanged',
    alt: 'D10 and it is still checked BEFORE the calculated branch' },

  /* harness */
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '050c1c1';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X1 BASE is a literal sha' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-274 -- mutation controls');
log('======================================================================');

let caught = 0, missed = 0, applied = 0;
M.forEach((m) => {
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  if (n !== 1) { log('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED'); missed++; return; }
  applied++;
  fs.writeFileSync(m.t, base.replace(from, () => to));
  let out = '';
  try { out = execFileSync('node', ['suite_274.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }
  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const want = [m.expect].concat(m.alt ? [m.alt] : []);
  const hit = fails.filter(l => want.some(w => l.indexOf(w) >= 0));
  if (hit.length) {
    log('  red  ' + m.name);
    log('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 110));
    caught++;
  } else if (fails.length) {
    log('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    log('       want: ' + want.join(' OR '));
    log('       got : ' + fails[0].trim().slice(5, 110));
    missed++;
  } else { log('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.'); missed++; }
});

log('');
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + applied + ' applied');
let clean = '';
try { clean = execFileSync('node', ['suite_274.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-274-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
