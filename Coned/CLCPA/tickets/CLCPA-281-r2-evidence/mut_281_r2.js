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
/* Mutation controls for CLCPA-281-r2.
 *
 * Two defects, and either alone leaves the bug standing: the predicate
 * that accepted an empty row, and the body count that measured the draft
 * by its LENGTH. Both are controlled separately.
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
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-281-r2-evidence';
const SUITE = 'suite_281_r2.js';
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || null;
const APP = path.join(os.tmpdir(), 'clcpa-281-r2-app.js');
fs.writeFileSync(APP, NEW_COMMIT
  ? execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, CRLF)
  : fs.readFileSync(path.join(REPO, REL), 'utf8'));

const M = [
  { name: "THE DEFECT RETURNS: the predicate accepts any blank-label row",
    from: "    if (!(label == null || String(label).trim() === '')) return false;\n    return row.slice(1).some(v => v != null && String(v).trim() !== '');",
    to:   "    return label == null || String(label).trim() === '';",
    expect: "A2 an ALL-EMPTY row does NOT",
    alt: "C4.1 and exactly 1 editable row(s) render" },
  { name: "THE BODY COUNT measures the draft by its LENGTH again",
    from: "    const declaredHeaderRows = ingestHeaderRowCount(table, Infinity);\n    const headerRowCount = ingestYearCarriesHeaderRows(i.draft, declaredHeaderRows)\n      ? declaredHeaderRows : 0;",
    to:   "    const headerRowCount = ingestHeaderRowCount(table, i.draft.length);",
    expect: "C4.1 and exactly 1 editable row(s) render",
    alt: "F3 then asks whether THIS DRAFT carries them" },
  { name: "THE PREDICATE demands a heading in EVERY value position, not one",
    from: "    return row.slice(1).some(v => v != null && String(v).trim() !== '');",
    to:   "    return row.slice(1).every(v => v != null && String(v).trim() !== '');",
    expect: "A5 ONE heading is enough",
    alt: "C1 at zero rows both header levels are drawn" },
  { name: "THE PREDICATE stops requiring a blank label, so data rows become headers",
    from: "    if (!(label == null || String(label).trim() === '')) return false;",
    to:   "    if (false) return false;",
    expect: "A4 nor a data row, which has a label" },
  { name: "THE EMPTY ROW loses its delete control, so the residue cannot be removed",
    from: "        <td class=\"ingest-td-actions\">${!roleOpen.deletable ? ''",
    to:   "        <td class=\"ingest-td-actions\">${true ? ''",
    expect: "D4 carrying a delete control" },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-281-r2 -- mutation controls');
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
fs.writeFileSync(DIR + '/mut-281-r2-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
