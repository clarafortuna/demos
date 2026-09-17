/* Mutation controls for CLCPA-269 round 2.
 *
 * The control that matters most is the HARNESS one: round 1's bench reported
 * 12 for a shape the live build counted as 20, because it compared a
 * hand-built pair instead of the draft the editor holds. A bench that stops
 * building the live draft must turn this red, or the same false pass returns.
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
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-269-evidence';
/* THE MUTATION TARGET IS THE PINNED BUILD, not the working tree. The suite
 * reads NEWREV unless DAC_APP_OVERRIDE says otherwise, so mutating the
 * repo's own file would change something the suite never opens and every
 * control would pass green. Same pattern as mut_271 and mut_244_r2. */
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || '5d584c5';
const APP = path.join(os.tmpdir(), 'clcpa-269-r2-app-' + NEW_COMMIT + '.js');
fs.writeFileSync(APP, execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n'));
const SUITE = DIR + '/suite_269_r2.js';

const M = [
  /* ---- the defect returns ------------------------------------------------ */
  { t: APP, name: 'THE DEFECT RETURNS: every cell counts again',
    from: '          if (c < keyCols) continue;\r\n          if (computed.any(r, c)) continue;\r\n',
    to:   '',
    expect: 'A6 it now says 12' },
  { t: APP, name: 'KEY CELLS count again: the labels come back',
    from: '          if (c < keyCols) continue;\r\n',
    to:   '',
    expect: 'A6 it now says 12', alt: 'E6 and renaming BOTH of them counts 0' },
  { t: APP, name: 'ENGINE CELLS count again: the total row comes back',
    from: '          if (computed.any(r, c)) continue;\r\n',
    to:   '',
    expect: 'A6 it now says 12', alt: 'C4a and the three cells removed are exactly' },

  /* ---- the exclusions must be the SHIPPED ones --------------------------- */
  { t: APP, name: 'THE KEY COLUMNS are assumed to be column 0',
    from: '      const keyCols = Math.max(1, ingestKeyColCount(i.tableId));',
    to:   '      const keyCols = 1;',
    /* A3 and A4 declare two */
    expect: 'E6 and renaming BOTH of them counts 0', alt: 'E2 and the key columns from the shipped declaration' },
  { t: APP, name: 'THE ENGINE CELLS are decided by the row index instead',
    from: '          if (computed.any(r, c)) continue;',
    to:   '          if (r === (a.length - 1)) continue;',
    expect: 'E3 both exclusions are applied in the count',
    alt: 'A6 it now says 12' },
  { t: APP, name: 'THE COUNT excludes the derivable column too, so an import reads 8',
    from: '          if (computed.any(r, c)) continue;',
    to:   '          if (computed.marksInTemplate(r, c)) continue;',
    /* this is the alternative decision the ticket asked me to consider, and
     * the number it produces is why it was rejected */
    expect: 'A6 it now says 12', alt: 'C3 specifically 12' },

  /* ---- the empty-baseline shape ------------------------------------------ */
  { t: APP, name: 'EMPTY IS NO LONGER EMPTY: the null normalisation is dropped',
    from: "        const nx = (x == null || x === '') ? '' : x;",
    to:   '        const nx = x;',
    expect: 'E6 and renaming BOTH of them counts 0', alt: 'C4 an untouched draft still counts 0' },

  /* ---- the harness -------------------------------------------------------- */
  { t: SUITE, name: 'HARNESS: the bench stops building the LIVE draft (round 1\'s defect)',
    from: '  const plan = run(a => a.buildIngestImport(FILE, SCHEMA, BASELINE.map(r => r.slice()), \'H1\'));\r\n  const d = plan.candidate;',
    to:   '  const plan = { addedRows: [1, 2, 3, 4, 5], populated: new Array(12), candidate: [] };\r\n  const d = P.tables.H1.data[\'2025\'].map(r => r.slice());',
    expect: 'X3b the draft under test IS the import plan',
    alt: 'A5 on BASE the dialog said 20' },
  { t: SUITE, name: 'HARNESS: the counter is re-implemented instead of cut from the dialog',
    from: "  const body = src.slice(i0, i1 + 9);",
    to:   "  const body = '    const changeCount = (() => { let n = 0; const a = i.draft, b = i.baseline || []; a.forEach((r, ri) => r.forEach((v, ci) => { if (ci > 0 && v !== (b[ri] || [])[ci]) n++; })); return n; })();';",
    expect: 'A6 it now says 12', alt: 'A5 on BASE the dialog said 20' },
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || 'ed44cae';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X1 BASE is a literal sha' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-269 round 2 -- mutation controls');
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
  try { out = execFileSync('node', ['suite_269_r2.js'], { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
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
try { clean = execFileSync('node', ['suite_269_r2.js'], { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-269-r2-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
