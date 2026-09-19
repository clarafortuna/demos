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
/* Mutation controls for CLCPA-274 round 2.
 *
 * The control that carries this ticket is the DERIVATION: a header row
 * count that stops being shared, or a predicate that reads "has the key",
 * must turn the suite red rather than quietly blanking a row again.
 *
 * THE MUTATION TARGET IS THE PINNED BUILD, not the working tree: the suite is
 * handed the mutant through DAC_APP_OVERRIDE, which is mut_271's shape and the
 * standing one. Mutating the repo's own file is what disarmed all seven
 * runners last wave.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync, execSync } = require('child_process');

const REPO = _dacRepo() + '';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-274-r2-evidence';
const SUITE = DIR + '/suite_274_r2.js';
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || null;
const APP = path.join(os.tmpdir(), 'clcpa-274-r2-app.js');
fs.writeFileSync(APP, NEW_COMMIT
  ? execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n')
  : fs.readFileSync(path.join(REPO, REL), 'utf8'));

const CRLF = String.fromCharCode(13) + String.fromCharCode(10);
const M = [
  { t: APP, name: "THE DEFECT RETURNS: the writer stops knowing about header rows",
    from: "    const templateHeaderRows = ingestHeaderRowCount(table, src.rows.length);",
    to:   "    const templateHeaderRows = 0;",
    expect: "C1 F6 row 2 is now the stored sub-header",
    alt: "D1.A9 emits its stored sub-header verbatim" },
  { t: APP, name: "THE PREDICATE becomes \"has a header_levels key\", which claims D1",
    from: "    if (typeof lv !== 'number' || lv < 2) return 0;",
    to:   "    if (lv === undefined) return 0;",
    expect: "D4 and D1 row 2 is still its DATA row",
    alt: "F6 and the predicate is \"a number, at least 2\"" },
  { t: APP, name: "THE HEADER ROW is emitted but blanked, as before",
    from: "          text: row[c] == null || row[c] === '' ? null : String(row[c]),",
    to:   "          text: null,",
    expect: "C1 F6 row 2 is now the stored sub-header",
    alt: "D1.A10 emits its stored sub-header verbatim" },
  { t: APP, name: "THE MARKER reaches the header row again",
    from: "          text: row[c] == null || row[c] === '' ? null : String(row[c]),",
    to:   "          text: INGEST_CALC_MARKER,",
    expect: "C4 the header row carries NO (calculated) marker",
    alt: "C1 F6 row 2 is now the stored sub-header" },
  { t: APP, name: "THE EDITOR goes back to its own inline copy",
    from: "    const headerRowCount = ingestHeaderRowCount(table, i.draft.length);",
    to:   "    const headerRowCount = (function () { const lv = table.header_levels;\n      if (typeof lv !== 'number' || lv < 2) return 0;\n      return Math.min(lv - 1, i.draft.length); })();",
    expect: "F2 declared once and called from BOTH readers",
    alt: "F3 the editor reads it" },
  { t: APP, name: "THE FIX LEAKS onto a one-level table",
    from: "      if (idx < templateHeaderRows) {",
    to:   "      if (idx < 1) {",
    expect: "E1.H1 identical to BASE",
    alt: "E1.B2 identical to BASE" },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-274 round 2 -- mutation controls');
log('======================================================================');

let caught = 0, missed = 0, applied = 0;
M.forEach((m) => {
  /* THE FILE IS CRLF and every multi-line anchor here is written with LF.
   * An indexOf of LF text in a CRLF file finds nothing, and this runner
   * reports that as ANCHOR 0 -- which looks exactly like a control that was
   * applied and passed. Normalised so a multi-line mutation is possible. */
  m.from = m.from.replace(/\r?\n/g, CRLF);
  m.to = m.to.replace(/\r?\n/g, CRLF);
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const n = m.all ? (base.split(m.from).length - 1) : (base.split(m.from).length - 1);
  if (n < 1 || (!m.all && n !== 1)) {
    log('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED');
    missed++; return;
  }
  applied++;
  let mutated = m.all ? base.split(m.from).join(m.to) : base.replace(m.from, () => m.to);
  if (m.from2 !== undefined) {
    const f2 = m.from2.replace(/\r?\n/g, CRLF);
    if (mutated.indexOf(f2) < 0) { log('  ???  ' + m.name + '  -- SECOND ANCHOR MISSING'); fs.writeFileSync(m.t, base); missed++; applied--; return; }
    mutated = mutated.replace(f2, () => m.to2.replace(/\r?\n/g, CRLF));
  }
  fs.writeFileSync(m.t, mutated);
  let out = '';
  try {
    out = execFileSync('node', [path.basename(SUITE)],
      { cwd: DIR, encoding: 'utf8',
        env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) });
  } catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
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
try {
  clean = execFileSync('node', [path.basename(SUITE)],
    { cwd: DIR, encoding: 'utf8',
      env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) });
} catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-274-r2-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
