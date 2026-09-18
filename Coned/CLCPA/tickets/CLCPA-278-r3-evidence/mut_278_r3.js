/* Mutation controls for CLCPA-278-r3.
 *
 * The controls that carry this round: ONE reader, consumed by all three,
 * and a reader that still refuses a unit and a split cell.
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
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-278-r3-evidence';
const SUITE = 'suite_278_r3.js';
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || null;
const APP = path.join(os.tmpdir(), 'clcpa-278-r3-app.js');
fs.writeFileSync(APP, NEW_COMMIT
  ? execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, CRLF)
  : fs.readFileSync(path.join(REPO, REL), 'utf8'));

const M = [
  { name: "THE DEFECT RETURNS: rowSumIsConsistent goes back to a private typeof test",
    from: "    const filed = sumCellNumber(row[rel.column]);\n    if (filed === null) return false;",
    to:   "    const filed = row[rel.column];\n    if (typeof filed !== 'number') return false;",
    expect: "C1.seed the total now follows the edit",
    alt: "E3.rowSumIsConsistent consumes it" },
  { name: "THE ADVISORY stops sharing the reader, so the two disagree again",
    from: "        const filed = sumCellNumber(row[rel.column]);\n        if (filed === null) return;",
    to:   "        const filed = row[rel.column];\n        if (typeof filed !== 'number') return;",
    expect: "E3.reconcileSumColumns consumes it",
    alt: "C2.seed and nothing is advised" },
  { name: "THE ENGINE stops sharing it, so what it WRITES and what it JUDGES differ",
    from: "      rows.forEach(r => { const v = sumCellNumber(r[c]); if (v !== null) { sum += v; any = true; } });",
    to:   "      rows.forEach(r => { const v = r[c]; if (typeof v === 'number' && isFinite(v)) { sum += v; any = true; } });",
    expect: "E3.columnGrandTotals consumes it" },
  { name: "THE READER starts accepting a PERCENT, against CLCPA-244",
    from: "    if (!/^[-+]?\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?$|^[-+]?\\d+(?:\\.\\d+)?$/.test(s)) return null;",
    to:   "    if (!/^[-+]?[\\d,.]+%?$/.test(s)) return null;",
    expect: "F2 refuses an explicit percent is a UNIT",
    alt: "D1.seed a percent component leaves the filed total alone" },
  { name: "THE READER starts salvaging a numeric PREFIX, which claims a split cell",
    from: "    const n = parseFloat(s.replace(/,/g, \"\"));",
    to:   "    const n = parseFloat(String(v).replace(/,/g, \"\"));",
    expect: "F3 and never salvages a prefix" },
  { name: "THE READER accepts any string parseFloat likes",
    from: "    if (!/^[-+]?\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)?$|^[-+]?\\d+(?:\\.\\d+)?$/.test(s)) return null;",
    to:   "",
    expect: "F3 and never salvages a prefix",
    alt: "F2 refuses a SPLIT cell is published text" },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-278-r3 -- mutation controls');
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
fs.writeFileSync(DIR + '/mut-278-r3-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
