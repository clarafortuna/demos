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
/* Mutation controls for Section C group C: CLCPA-257.
 *
 * The dangerous directions:
 *
 *   THE OLD FALLBACK RETURNS -- the oldest year, or the first key, or any
 *   choice that is not "the newest year with a schema".
 *
 *   IT STOPS FALLING BACK AT ALL -- a year with no schema then resolves
 *   nothing, which is a different way to print a dash.
 *
 *   A STORED YEAR MOVES -- the hard gate must be able to see it.
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
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-257-evidence';
/* THE MUTATION TARGET IS THE PINNED BUILD, not the working tree.
 * suite_257 reads 2361a6a unless DAC_APP_OVERRIDE says
 * otherwise, so mutating the repo's app.js would change a file the suite
 * never opens and every control would pass. Same pattern as mut_244_r2. */
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || '2361a6a';
const APP = path.join(os.tmpdir(), 'clcpa-257-app-' + NEW_COMMIT + '.js');
fs.writeFileSync(APP, execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n'));
const SUITE = DIR + '/suite_257.js';

const M = [
  { t: APP, name: 'THE DEFECT: the oldest-year fallback returns',
    from: '      const years = Object.keys(by)\r\n        .filter(k => Array.isArray(by[k]) && by[k].length)\r\n        .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));\r\n      s = years.length ? by[years[0]] : null;',
    to:   '      const anyYear = Object.keys(by)[0];\r\n      s = anyYear ? by[anyYear] : null;',
    expect: 'R2 and it now resolves to column' },
  /* the sort line alone appears TWICE -- getTableSchema carries the same one
   * since CLCPA-244 -- so both of these anchor on the filter line above it */
  { t: APP, name: 'the sort runs the wrong way, so it picks the oldest again',
    from: '        .filter(k => Array.isArray(by[k]) && by[k].length)\r\n        .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));',
    to:   '        .filter(k => Array.isArray(by[k]) && by[k].length)\r\n        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));',
    expect: 'R2 and it now resolves to column' },
  { t: APP, name: 'the years are sorted as STRINGS, which is not the same rule',
    from: '        .filter(k => Array.isArray(by[k]) && by[k].length)\r\n        .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));',
    to:   '        .filter(k => Array.isArray(by[k]) && by[k].length)\r\n        .sort().reverse();',
    /* it agrees on this payload and stops agreeing the moment a year is not
     * four digits, so the pin is on the arithmetic, not the outcome */
    expect: 'R6 dacCol sorts the schema years descending' },
  { t: APP, name: 'it stops falling back at all',
    from: '      s = years.length ? by[years[0]] : null;',
    to:   '      s = null;',
    expect: 'N1 C2 "Committed" -> column' },
  { t: APP, name: 'an EMPTY schema counts as a schema, so it picks a useless one',
    from: '        .filter(k => Array.isArray(by[k]) && by[k].length)',
    to:   '        .filter(k => Array.isArray(by[k]))',
    /* no stored table has an empty schema array, so this is inert against the
     * real payload -- and that is exactly why it is written down here rather
     * than left as an unstated assumption. The suite has no assertion that
     * can see it, and inventing a synthetic one would test the filter, not
     * the ticket. RETIRED with its reason, not counted as a guard. */
    retired: true },

  /* ---- the hard gate ---------------------------------------------------- */
  { t: APP, name: 'THE HARD GATE: a stored year resolves differently',
    from: '    let s = by[y];',
    to:   "    let s = (String(y) === '2023') ? null : by[y];",
    /* 2023 would then borrow the newest schema: 49 stored table-years move */
    expect: 'G4 and not one differs' },

  /* ---- the harness ------------------------------------------------------ */
  { t: SUITE, name: 'HARNESS: the gate stops probing any column',
    /* gutting the COMPARISON leaves `same` correct and `diff` empty, so the
     * gate still reads green -- the first cut of this control did exactly
     * that and could not fail. Starving it of PROBES is what G3's count
     * sees. */
    from: '  const PROBES = [/participants/i, /committed/i, /delivered/i, /total/i,\r\n                  /dac/i, /incentive/i, /savings/i, /%/];',
    to:   '  const PROBES = [];',
    expect: 'G3 ' },
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '3e47e89';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X3 BASE is a literal commit sha' },
].filter(m => !m.retired);

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('Section C group C -- mutation controls');
log('======================================================================');
log('  RETIRED, with its reason: "an EMPTY schema counts as a schema". No');
log('  stored table carries an empty schema array, so the mutation is inert');
log('  against the real payload, and a synthetic case would test the filter');
log('  rather than the ticket. Written down rather than counted.');

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
  try { out = execFileSync('node', ['suite_257.js'],
    { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }
  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const hit = fails.filter(l => l.indexOf(m.expect) >= 0);
  if (hit.length) {
    log('  red  ' + m.name);
    log('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 104));
    caught++;
  } else if (fails.length) {
    log('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    log('       want: ' + m.expect);
    log('       got : ' + fails[0].trim().slice(5, 104));
    missed++;
  } else { log('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.'); missed++; }
});

log('');
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length + ' guards');
let clean = '';
try { clean = execFileSync('node', ['suite_257.js'],
    { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-257-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
