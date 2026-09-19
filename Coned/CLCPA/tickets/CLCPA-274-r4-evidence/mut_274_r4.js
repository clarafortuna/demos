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
/* Mutation controls for CLCPA-274-r4.
 *
 * The template surface of the same fix, plus a guard on the value half:
 * the blank-format behaviour is PINNED here so the deferred
 * template-as-export decision cannot be made by accident.
 *
 * The mutant is handed to the suite through DAC_APP_OVERRIDE, mut_271's shape.
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync, execSync } = require('child_process');

const CRLF = String.fromCharCode(13) + String.fromCharCode(10);
const REPO = _dacRepo() + '';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-274-r4-evidence';
const SUITE = 'suite_274_r4.js';
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || null;
const APP = path.join(os.tmpdir(), 'clcpa-274-r4-app.js');
fs.writeFileSync(APP, NEW_COMMIT
  ? execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, CRLF)
  : fs.readFileSync(path.join(REPO, REL), 'utf8'));

const M = [
  { name: "THE DEFECT RETURNS: the predicate accepts any blank-label row",
    from: "    if (!(label == null || String(label).trim() === '')) return false;\n    return row.slice(1).some(v => v != null && String(v).trim() !== '');",
    to:   "    return label == null || String(label).trim() === '';",
    expect: "B1 row 2 is the four sub-labels",
    alt: "D4 because the ONE predicate they both consume" },
  { name: "THE TEMPLATE starts emitting stored values -- the deferred decision, taken",
    from: "        return { style: style, text: null };",
    to:   "        return { style: style, text: row[c] == null ? null : String(row[c]) };",
    expect: "C1 Test Row carries NO stored values",
    alt: "C3.H1 label emitted, values blank" },
  { name: "THE PHANTOM ROW is dropped instead of shown as data",
    from: "    const skip = ingestYearCarriesHeaderRows(src.rows, headerCount) ? headerCount : 0;",
    to:   "    const skip = headerCount;",
    expect: "B3 the phantom empty row renders as an empty DATA row",
    alt: "B5 four rows in total" },
  { name: "THE HEADER ROWS stop being borrowed, so a year without them loses its labels",
    from: "  function ingestStoredHeaderRows(table, headerCount) {",
    to:   "  function ingestStoredHeaderRows(table, headerCount) { if (true) return [];",
    expect: "B1 row 2 is the four sub-labels",
    alt: "E1 every SEED-year template is byte-identical to BASE" },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-274-r4 -- mutation controls');
log('======================================================================');

let caught = 0, missed = 0, applied = 0;
M.forEach((m) => {
  const from = m.from.replace(/\r?\n/g, CRLF);
  const to = m.to.replace(/\r?\n/g, CRLF);
  const base = fs.readFileSync(APP, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const n = base.split(from).length - 1;
  if (n !== 1) {
    log('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED');
    missed++; return;
  }
  applied++;
  fs.writeFileSync(APP, base.replace(from, () => to));
  let out = '';
  try {
    out = execFileSync('node', [SUITE], { cwd: DIR, encoding: 'utf8',
      env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) });
  } catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(APP, base);
  if (crypto.createHash('sha256').update(fs.readFileSync(APP, 'utf8')).digest('hex') !== baseSha) {
    console.error('RESTORE FAILED after ' + m.name); process.exit(1);
  }
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
fs.writeFileSync(DIR + '/mut-274-r4-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
