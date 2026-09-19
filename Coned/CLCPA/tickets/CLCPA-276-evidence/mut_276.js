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
/* Mutation controls for CLCPA-276.
 *
 * Each of the three exits must be provable on its own: removing any one of
 * them has to turn a NAMED shape red, not just a text pin. And the
 * "recomputed, not cleared" half needs its own control -- clearing the
 * reconciliation advisory would hide a fact that is still true after a save.
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
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-276-evidence';
/* THE MUTATION TARGET IS THE PINNED BUILD, not the working tree. The suite
 * reads NEWREV unless DAC_APP_OVERRIDE says otherwise, so mutating the
 * repo's own file would change something the suite never opens and every
 * control would pass green. Same pattern as mut_271 and mut_244_r2. */
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || '22c96cc';
const APP = path.join(os.tmpdir(), 'clcpa-276-app-' + NEW_COMMIT + '.js');
fs.writeFileSync(APP, execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n'));
const SUITE = DIR + '/suite_276.js';

const M = [
  /* ---- the helper itself -------------------------------------------------- */
  { t: APP, name: 'THE DEFECT RETURNS: the helper stops clearing the receipt',
    from: '    t.importResult = null;',
    to:   '',
    expect: 'B1 shape 1: the receipt is GONE after Reset',
    alt: 'B4 shape 3: the receipt is GONE after a successful save' },
  { t: APP, name: 'THE TYPED ADVISORY is left behind',
    from: '    t.typedUnitNotices = [];',
    to:   '',
    expect: 'B2 and so is the typed advisory' },

  /* ---- the three exits, one at a time ------------------------------------ */
  { t: APP, name: 'RESET stops clearing (hosted shape 1)',
    from: '          /* CLCPA-276: the draft these notices described is gone. */\r\n          clearIngestNotices(state.ingest);\r\n',
    to:   '',
    expect: 'C3 Reset clears', alt: 'C2 declared once and called from THREE places' },
  { t: APP, name: 'A SUCCESSFUL SAVE stops clearing (hosted shape 3)',
    from: '      clearIngestNotices(i);\r\n\r\n      close();',
    to:   '\r\n      close();',
    expect: 'C4 a successful save clears', alt: 'C2 declared once and called from THREE places' },
  { t: APP, name: 'LOADING A TABLE-YEAR stops clearing (hosted shapes 2 and 4)',
    from: '    clearIngestNotices(i);\r\n\r\n    /* CLCPA-235: RECORD WHAT THIS LOAD WAS FOR',
    to:   '\r\n    /* CLCPA-235: RECORD WHAT THIS LOAD WAS FOR',
    expect: 'C5 and loading a table-year clears', alt: 'C2 declared once and called from THREE places' },

  /* ---- the "recomputed, not cleared" half -------------------------------- */
  { t: APP, name: 'THE RECONCILIATION ADVISORY is cleared too, hiding a live fact',
    from: '    t.importResult = null;\r\n    t.typedUnitNotices = [];',
    to:   '    t.importResult = null;\r\n    t.typedUnitNotices = [];\r\n    t.reconcileSuppressed = true;',
    /* the suppression flag is inert, so this is caught by the TEXT pin that
     * forbids the helper mentioning reconciliation at all */
    expect: 'D4 the helper does NOT clear the reconciliation advisory' },

  /* ---- lifecycle only ----------------------------------------------------- */
  { t: APP, name: 'A NOTICE TEXT is reworded while "fixing" the lifecycle',
    from: "      '<h4>Imported into the draft: ' + r.populated.length + ' cell' +",
    to:   "      '<h4>Imported into this draft: ' + r.populated.length + ' cell' +",
    expect: 'D1 renderIngestImportResult is BYTE-IDENTICAL to BASE',
    alt: 'A2 the receipt is rendered' },
  { t: APP, name: 'THE COMPONENT is restyled while "fixing" the lifecycle',
    from: "    return '<div class=\"ingest-import-notice is-warn\">' +\r\n      '<h4>Does not add up: '",
    to:   "    return '<div class=\"ingest-import-notice is-alert\">' +\r\n      '<h4>Does not add up: '",
    expect: 'D1 renderReconcileNotice is BYTE-IDENTICAL to BASE' },

  /* ---- the harness -------------------------------------------------------- */
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '5d584c5';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X1 BASE is a literal sha' },
  { t: SUITE, name: 'HARNESS: the mount is stubbed instead of driven',
    from: 'const mount = () => run(a => a.renderIngestImport());',
    to:   "const mount = () => '';",
    expect: 'A2 the receipt is rendered', alt: 'X3 the mount under test reacts to the state it is given' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-276 -- mutation controls');
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
  try { out = execFileSync('node', ['suite_276.js'], { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
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
try { clean = execFileSync('node', ['suite_276.js'], { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-276-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
