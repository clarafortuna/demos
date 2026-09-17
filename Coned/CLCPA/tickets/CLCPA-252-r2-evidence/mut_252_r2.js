/* Mutation controls for CLCPA-252 round 2.
 *
 * The dangerous directions, and every one of them is a way to be plausibly
 * wrong rather than obviously broken:
 *
 *   THE STORED BRANCH IS BYPASSED -- the derivation runs for a year that has
 *   its own title, and 153 filed captions quietly change wording.
 *
 *   STRATEGY A STOPS REFUSING -- the guards that make substitution safe are
 *   loosened, so a donor naming two years, or its own year twice, gets a blind
 *   rewrite. This is the CLCPA-244 shape: ten headings deliberately name a
 *   different year, and titles were measured NOT to share the trap. A loosened
 *   A would make the measurement stop protecting anything.
 *
 *   STRATEGY B OVERREACHES -- it fires on a donor that DOES name a year,
 *   producing "Table X. 2098 2019 Legacy Baseline".
 *
 *   THE TAIL TRAVELS -- a derived 2098 caption cites "PDF page 19".
 *
 *   THE DONOR IS THE OLDEST -- the CLCPA-257 defect, in a new place.
 *
 * Each must turn the suite red on the assertion it targets. Ends with a CLEAN
 * re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync, execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-252-r2-evidence';
/* THE MUTATION TARGET IS THE PINNED BUILD, not the working tree.
 * suite_252_r2 reads 2361a6a unless DAC_APP_OVERRIDE says
 * otherwise, so mutating the repo's app.js would change a file the suite
 * never opens and every control would pass. Same pattern as mut_244_r2. */
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || '2361a6a';
const APP = path.join(os.tmpdir(), 'clcpa-252_r2-app-' + NEW_COMMIT + '.js');
fs.writeFileSync(APP, execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n'));
const SUITE = DIR + '/suite_252_r2.js';

const M = [
  /* ---- the stored branch ------------------------------------------------ */
  { t: APP, name: 'THE GATE: the derivation runs even when a title is stored',
    from: '    const stored = (t.title_by_year || {})[year];\r\n    if (stored) return stored;',
    to:   '    const stored = (t.title_by_year || {})[year];\r\n' +
          '    if (stored && !deriveTableCaption(t, year)) return stored;',
    expect: 'S2 every one is byte-identical to BASE' },

  /* ---- strategy A stops refusing ---------------------------------------- */
  { t: APP, name: 'A STOPS REFUSING a donor that names TWO years',
    from: '    if (years.length === 1 && years[0] === donorYear &&\r\n' +
          '        donor.split(donorYear).length - 1 === 1) {',
    to:   '    if (years.indexOf(donorYear) >= 0) {',
    expect: 'N5 a donor naming two years does not take strategy A' },
  /* The split count is NOT redundant beside the match count, and finding out
   * why took a green mutation. A repeated year gives TWO match entries, so
   * `years.length === 1` already refuses it and N6 could not see this edit.
   * What only the split count catches is a year appearing as a SUBSTRING:
   * "2025A" fails the \b boundary, so the match list has one entry while the
   * string holds the token twice. N8 drives that case. */
  { t: APP, name: 'A stops refusing a donor whose year recurs as a SUBSTRING',
    from: '        donor.split(donorYear).length - 1 === 1) {',
    to:   '        donor.split(donorYear).length - 1 >= 1) {',
    expect: 'N8 a donor whose year also appears as a substring is refused by A' },

  /* ---- strategy B overreaches ------------------------------------------- */
  /* NOT `if (years.length === 0)` -> `>= 0`: that edits the exact literal X5
   * greps for, so X5 fails and the mutation proves only that the grep works.
   * A control whose mutation is visible to the pin it is testing is a
   * tautology. Emptying the year LIST leaves both structural pins intact and
   * makes B overreach for real. */
  { t: APP, name: 'B OVERREACHES onto a donor that already names a year',
    from: '    const years = donor.match(/\\b(19|20)\\d{2}\\b/g) || [];',
    to:   '    const years = [];',
    expect: 'N7 and a donor naming only ANOTHER year is refused by A and by B',
    alt: 'D1 strategy A (substitute the year token)' },
  /* On THIS payload F3 takes strategy A, so removing "Chart" from the prefix
   * changes no real table and only X6 saw it -- the same tautology. N9 now
   * drives a synthetic Chart donor with no year, so the predicate is guarded
   * by what it does. */
  { t: APP, name: 'B stops recognising Chart',
    from: "      const m = /^((?:Table|Chart)\\s+[A-Z]\\d+\\.\\s+)/.exec(donor);",
    to:   "      const m = /^((?:Table|Graph)\\s+[A-Z]\\d+\\.\\s+)/.exec(donor);",
    expect: 'N9 a Chart donor with no year takes strategy B' },

  /* ---- the tail --------------------------------------------------------- */
  { t: APP, name: 'THE TAIL TRAVELS into a derived caption',
    from: "    const donor = String(by[donorYear]).replace(/\\s*\\|.*$/, '').trim();",
    to:   '    const donor = String(by[donorYear]).trim();',
    expect: 'T1 no derived caption carries a "|" tail' },

  /* ---- the donor -------------------------------------------------------- */
  { t: APP, name: 'THE DONOR IS THE OLDEST year, the CLCPA-257 defect again',
    from: '      .sort((a, b) => parseInt(b, 10) - parseInt(a, 10))[0];',
    to:   '      .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))[0];',
    expect: 'E1 the donor is 2025' },
  { t: APP, name: 'a BLANK title counts as a donor',
    from: "      .filter(k => /^\\d{4}$/.test(k) && by[k] && String(by[k]).trim())",
    to:   "      .filter(k => /^\\d{4}$/.test(k) && by[k] != null)",
    expect: 'E4 a blank title is not a donor' },

  /* ---- the reach counts are real ---------------------------------------- */
  { t: APP, name: 'the derivation is switched off entirely',
    from: '    const derived = deriveTableCaption(t, year);\r\n    if (derived) return derived;',
    to:   '    const derived = null;\r\n    if (derived) return derived;',
    expect: 'D1 strategy A (substitute the year token)',
    alt: 'D6 C1 renders the commissioned string' },

  /* ---- the harness ------------------------------------------------------ */
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || 'a1cc8f9';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X9 BASE is a literal commit sha' },
  { t: SUITE, name: 'HARNESS: the stored-panel sweep stops driving BASE',
    from: "      const b = String(NEW.attempt(api => api.renderSourceTables([t], y, {}, id)));\r\n" +
          "      const hasTitle = !!((t.title_by_year || {})[y]);",
    to:   "      const b = a;\r\n" +
          "      const hasTitle = !!((t.title_by_year || {})[y]);",
    /* every panel would compare equal to itself and S4b would pass on nothing.
     * S5 is what notices, because it REQUIRES A8:2023 to have moved. */
    expect: 'S5 the only panel that moves is A8:2023' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-252 round 2 -- mutation controls');
log('======================================================================');

let caught = 0, missed = 0;
M.forEach((m) => {
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  /* THE ANCHOR IS NORMALISED TO THE TARGET FILE'S OWN LINE ENDINGS. app.js is
   * CRLF; this suite was written LF, and a multi-line CRLF anchor against it
   * reported ANCHOR 0 and skipped the control silently. That is the same
   * LF-versus-CRLF trap the baselines carry, arriving in the mutation runner
   * instead -- and a skipped control looks exactly like a passing one until
   * the tally is read. */
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  if (n !== 1) { log('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED'); missed++; return; }
  fs.writeFileSync(m.t, base.replace(from, () => to));
  let out = '';
  try { out = execFileSync('node', ['suite_252_r2.js'],
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
try { clean = execFileSync('node', ['suite_252_r2.js'],
    { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-252-r2-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
