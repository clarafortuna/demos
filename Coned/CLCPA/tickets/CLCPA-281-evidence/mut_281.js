/* Mutation controls for CLCPA-281.
 *
 * The controls that carry this ticket: the header row must be DRAWN in the
 * thead, must leave the body, and must not renumber the rows every handler
 * addresses by data-row.
 *
 * The mutant is handed to the suite through DAC_APP_OVERRIDE, which is
 * mut_271's shape and the standing one. Ends with a CLEAN re-run against
 * byte-restored source and says so loudly.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync, execSync } = require('child_process');

const CRLF = String.fromCharCode(13) + String.fromCharCode(10);
const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-281-evidence';
const SUITE = 'suite_281.js';
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || null;
const APP = path.join(os.tmpdir(), 'clcpa-281-app.js');
fs.writeFileSync(APP, NEW_COMMIT
  ? execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, CRLF)
  : fs.readFileSync(path.join(REPO, REL), 'utf8'));

const M = [
  { name: "THE DEFECT RETURNS: no second header row is drawn",
    from: "              ${subHeaderCells}",
    to:   "",
    expect: "B1.F6 draws TWO header rows",
    alt: "B3 the body has exactly one row fewer" },
  { name: "THE HEADER ROW is drawn AND left in the body",
    from: "      if (rowIdx < headerRowCount) return '';",
    to:   "",
    expect: "B3 the body has exactly one row fewer",
    alt: "B4 and the first body row is no longer the sub-header" },
  { name: "THE BODY is FILTERED instead of blanked, renumbering every row",
    from: "    const bodyRowsHtml = i.draft.map((row, rowIdx) => {",
    to:   "    const bodyRowsHtml = i.draft.slice(headerRowCount).map((row, __i) => {\n      const rowIdx = __i;",
    expect: "B3 the body has exactly one row fewer",
    alt: "E3 and an edit lands on draft row 1" },
  { name: "THE SUB-HEADER is taken from the year only, never borrowed",
    from: "      const rows = ingestYearCarriesHeaderRows(i.draft, count)\n        ? i.draft.slice(0, count)\n        : ingestStoredHeaderRows(table, count);",
    to:   "      const rows = i.draft.slice(0, count);",
    expect: "C2 borrowing the table's sub-header",
    alt: "C1 a user-added year still gets both levels" },
  { name: "EVERY TABLE is treated as two-level",
    from: "    const lv = table && table.header_levels;",
    to:   "    const lv = 2;",
    expect: "D1.H1 still draws one header row",
    alt: "D2.H1 and the same number of body rows" },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-281 -- mutation controls');
log('======================================================================');

let caught = 0, missed = 0, applied = 0;
M.forEach((m) => {
  const from = m.from.replace(/\r?\n/g, CRLF);
  const to = m.to.replace(/\r?\n/g, CRLF);
  const base = fs.readFileSync(APP, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const n = base.split(from).length - 1;
  if (n < 1 || (!m.all && n !== 1)) {
    log('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED');
    missed++; return;
  }
  applied++;
  fs.writeFileSync(APP, m.all ? base.split(from).join(to) : base.replace(from, () => to));
  let out = '';
  try {
    out = execFileSync('node', [SUITE], { cwd: DIR, encoding: 'utf8',
      env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) });
  } catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(APP, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(APP, 'utf8')).digest('hex');
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
try {
  clean = execFileSync('node', [SUITE], { cwd: DIR, encoding: 'utf8',
    env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) });
} catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-281-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
