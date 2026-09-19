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
/* Mutation controls for CLCPA-263.
 *
 * The dangerous directions, and every one of them looks like success:
 *
 *   IT REACHES A STORED YEAR. The gate. If the derivation stops requiring a
 *   BARE NUMBER it starts rewriting filed composites, and the screen would
 *   still look plausible while 149 stored table-years moved.
 *
 *   IT IS STORED. The whole rule of this project: a stored copy of a computed
 *   figure is a second source of truth. Mutating the input instead of the
 *   clone is how that happens by accident.
 *
 *   THE DENOMINATOR IS WRONG. Body sum instead of the total row, or the total
 *   row included in its own share.
 *
 *   THE FORMATTING SILENTLY REGRESSES. The value half stops looking like
 *   renderTable's, and every composite loses its thousands separators.
 *
 *   IT SPREADS. The declaration widens past the three measured columns, or
 *   past C2.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = _dacRepo() + '';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-263-evidence';
const APP = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_263.js';

const M = [
  /* ---- the gate ---------------------------------------------------------- */
  { t: APP, name: 'THE GATE: it stops requiring a bare number and rewrites stored cells',
    from: "    if (!/^[-+]?[\\d,]*\\.?\\d+$/.test(s)) return null;",
    to:   "    if (!/[\\d]/.test(s)) return null;",
    expect: 'S2 and every one is byte-identical to BASE',
    alt: 'S7 C2:2025 is returned unchanged' },
  { t: APP, name: 'THE GATE: a percentage string is treated as a bare number',
    from: "    if (!/^[-+]?[\\d,]*\\.?\\d+$/.test(s)) return null;",
    to:   "    if (!/^[-+]?[\\d,]*\\.?\\d+%?$/.test(s)) return null;",
    expect: 'S7 C2:2023 is returned unchanged',
    alt: 'S2 and every one is byte-identical to BASE' },

  /* ---- it is stored ------------------------------------------------------ */
  { t: APP, name: 'IT IS STORED: the derivation runs on the input, not the clone',
    from: '    applyCompositeShares(clone, tableId, schema, colSum);',
    to:   '    applyCompositeShares(rawRows, tableId, schema, colSum);\r\n' +
          '    applyCompositeShares(clone, tableId, schema, colSum);',
    expect: 'R1 rowsForDisplay left its input untouched' },

  /* ---- the denominator --------------------------------------------------- */
  { t: APP, name: 'THE DENOMINATOR: the total row shares in its own total',
    from: '        if (isTotal[r]) continue;                 // a total is 100% of itself',
    to:   '        if (false) continue;',
    expect: 'D5 the total row column 3 is untouched' },
  /* THE TOTAL ROW IS FOUND BY LABEL, NOT BY ARITHMETIC. Reverting to
   * totalRowFlags is the defect two of this suite's own cases caught: a filed
   * total that does not equal its rows goes unflagged, falls through to the
   * body sum, and counts itself into its own denominator. */
  { t: APP, name: 'THE DENOMINATOR: the total row is found by ARITHMETIC again',
    from: '    const isTotal = rows.map(r => isStrictTotalRowLabel((r || [])[0]));',
    to:   '    const isTotal = rows.map(() => false);',
    expect: 'N1b the share is of the TOTAL ROW (100), not the body sum (40)',
    alt: 'D5 the total row column 3 is untouched' },
  { t: APP, name: 'THE DENOMINATOR: zero is accepted and produces Infinity',
    from: '      if (!denom) continue;                       // nothing to divide by, and 0 is not a denominator',
    to:   '      if (denom === null) continue;',
    expect: 'N1g and neither does a value against a zero total' },

  /* ---- the formatting ---------------------------------------------------- */
  { t: APP, name: 'THE FORMATTING REGRESSES: the raw value is concatenated',
    from: "        rows[r][c] = compositeValueText(v) + ' (' + pct + '%)';",
    to:   "        rows[r][c] = String(raw).trim() + ' (' + pct + '%)';",
    /* this is the trap the ticket nearly shipped: 37988 instead of 37,988 */
    expect: 'F4 the derived cell keeps the separator' },
  { t: APP, name: 'THE FORMATTING: decimals are truncated to integers',
    from: '    if (Number.isInteger(v) || Math.abs(v) >= 100) return v.toLocaleString();\r\n' +
          '    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });',
    to:   '    return Math.round(v).toLocaleString();',
    expect: 'F6 and a small decimal' },
  { t: APP, name: 'THE ROUNDING: the share is truncated instead of rounded',
    from: '        const pct = Math.round((v / denom) * 100);',
    to:   '        const pct = Math.floor((v / denom) * 100);',
    expect: 'D1 EIGHT of the nine match the stored string exactly' },

  /* ---- it spreads -------------------------------------------------------- */
  { t: APP, name: 'IT SPREADS: the declaration reaches every table',
    from: '    const list = tableId && COMPOSITE_SHARE_COLS[tableId];\r\n    if (!list) return false;',
    to:   '    const list = COMPOSITE_SHARE_COLS[tableId] || COMPOSITE_SHARE_COLS.C2;',
    expect: 'C5 and the same heading in another table is not, because it is per TABLE',
    alt: 'N4 C3 derives nothing' },
  { t: APP, name: 'IT SPREADS: every column of C2 derives',
    from: "      if (!isCompositeShareCol(tableId, schema[c])) continue;",
    to:   '      if (false) continue;',
    expect: 'N2 the spacer column is untouched' },

  /* ---- the harness ------------------------------------------------------- */
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || 'c6d0453';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X3 BASE is a literal commit sha' },
  { t: SUITE, name: 'HARNESS: the fresh fixture stops using C2s own figures',
    from: "  ['DAC', null, null, 37988, null, 389.65, null, 299.57],",
    to:   "  ['DAC', null, null, 1000, null, 100, null, 100],",
    /* the fixture's whole point is that the arithmetic is the TABLE'S, not a
     * set of numbers chosen to agree with the answer */
    expect: 'D1 EIGHT of the nine match the stored string exactly' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-263 -- mutation controls');
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
  try { out = execFileSync('node', ['suite_263.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }
  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const want = [m.expect].concat(m.alt ? [m.alt] : []);
  const hit = fails.filter(l => want.some(w => l.indexOf(w) >= 0));
  if (hit.length) {
    log('  red  ' + m.name);
    log('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 104));
    caught++;
  } else if (fails.length) {
    log('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    log('       want: ' + want.join(' OR '));
    log('       got : ' + fails[0].trim().slice(5, 104));
    missed++;
  } else { log('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.'); missed++; }
});

log('');
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length + ' guards');
let clean = '';
try { clean = execFileSync('node', ['suite_263.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-263-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
