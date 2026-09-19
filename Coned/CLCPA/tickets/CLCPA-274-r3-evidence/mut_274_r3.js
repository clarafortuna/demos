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
/* Mutation controls for CLCPA-274-r3.
 *
 * The control that carries this round is PROVENANCE: the sub-header must
 * come from the table, so a year that carries none still gets it, and a
 * year that carries one must not have it emitted twice.
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
const REPO = _dacRepo() + '';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-274-r3-evidence';
const SUITE = 'suite_274_r3.js';
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || null;
const APP = path.join(os.tmpdir(), 'clcpa-274-r3-app.js');
fs.writeFileSync(APP, NEW_COMMIT
  ? execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, CRLF)
  : fs.readFileSync(path.join(REPO, REL), 'utf8'));

const M = [
  { name: "THE DEFECT RETURNS: the count is applied to the source year again",
    from: "    const headerCount = ingestHeaderRowCount(table, Infinity);\n    const headerRows = ingestStoredHeaderRows(table, headerCount);",
    to:   "    const headerCount = ingestHeaderRowCount(table, src.rows.length);\n    const headerRows = src.rows.slice(0, headerCount);",
    expect: "C1 user-added WITH data: row 2 is the four sub-labels",
    alt: "C2 and the data row moved to row 3" },
  { name: "THE SOURCE YEAR stops skipping the rows it carries, so they double",
    from: "    const skip = ingestYearCarriesHeaderRows(src.rows, headerCount) ? headerCount : 0;",
    to:   "    const skip = 0;",
    expect: "C3 emitted once, not twice",
    alt: "D1 every SEED-year template is byte-identical to BASE" },
  { name: "THE HEADER TEST stops looking at the label column",
    from: "    return label == null || String(label).trim() === '';",
    to:   "    return true;",
    expect: "C3 emitted once, not twice",
    alt: "C1 user-added WITH data: row 2 is the four sub-labels" },
  { name: "THE TABLE stops lending its header rows to a year without them",
    from: "  function ingestStoredHeaderRows(table, headerCount) {",
    to:   "  function ingestStoredHeaderRows(table, headerCount) { if (true) return [];",
    expect: "C1 user-added WITH data: row 2 is the four sub-labels",
    alt: "C4 user-added with NO data still correct" },
  { name: "EVERY TABLE is treated as two-level",
    from: "    const lv = table && table.header_levels;",
    to:   "    const lv = 2;",
    expect: "F3 and a one-level table has no header rows to borrow at all",
    alt: "D1 every SEED-year template is byte-identical to BASE" },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-274-r3 -- mutation controls');
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
fs.writeFileSync(DIR + '/mut-274-r3-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
