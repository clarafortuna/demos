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
/* Mutation controls for CLCPA-275.
 *
 * A style ticket's controls have to prove the style is APPLIED, not merely
 * declared: a rule that loses the cascade looks exactly like one that wins.
 * Every control here mutates styles.css and every claim is resolved.
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
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-275-evidence';
/* THE MUTATION TARGET IS THE PINNED BUILD, not the working tree. The suite
 * reads NEWREV unless DAC_APP_OVERRIDE says otherwise, so mutating the
 * repo's own file would change something the suite never opens and every
 * control would pass green. Same pattern as mut_271 and mut_244_r2. */
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || '0c25b60';
const APP = path.join(os.tmpdir(), 'clcpa-275-app-' + NEW_COMMIT + '.js');
fs.writeFileSync(APP, execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n'));
const CSSREL = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const CSS = path.join(os.tmpdir(), 'clcpa-275-css-' + NEW_COMMIT + '.css');
fs.writeFileSync(CSS, execSync('git show ' + NEW_COMMIT + ':"' + CSSREL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n'));
const SUITE = DIR + '/suite_275.js';

const RULE = '.ingest-import-result:last-child,\r\n.ingest-import-notice:last-child { margin-bottom: 16px; }';

const M = [
  { t: CSS, name: 'THE DEFECT RETURNS: the stack sits against the card again',
    from: RULE, to: '',
    expect: 'A2 it now resolves to 16px' },
  { t: CSS, name: 'A NEW NUMBER instead of the region\'s own',
    from: RULE,
    to: '.ingest-import-result:last-child,\r\n.ingest-import-notice:last-child { margin-bottom: 10px; }',
    expect: 'B2 and the stack now carries the SAME value, not a new one',
    alt: 'A2 it now resolves to 16px' },
  { t: CSS, name: 'EVERY BOX gets the gap, not just the last',
    from: RULE,
    to: '.ingest-import-result,\r\n.ingest-import-notice { margin-bottom: 16px; }',
    expect: 'A3 while a box in the MIDDLE of the stack gets none' },
  { t: CSS, name: 'ONLY THE NOTICE gets it, so a lone receipt sits tight',
    from: RULE,
    to: '.ingest-import-notice:last-child { margin-bottom: 16px; }',
    expect: 'A4 a lone receipt is the last box and carries the gap' },
  { t: CSS, name: 'IT WINS WITH !important instead of on the cascade',
    from: RULE,
    to: '.ingest-import-result:last-child,\r\n.ingest-import-notice:last-child { margin-bottom: 16px !important; }',
    expect: 'E4 and it wins on the cascade, not with !important' },
  { t: CSS, name: 'THE RULE IS OUTRANKED by a later one and silently does nothing',
    from: RULE,
    to: RULE + '\r\n.ingest-import-notice:last-child { margin-bottom: 0; }',
    /* declared, present, and beaten on source order: the exact shape CLCPA-248
     * proved a grep cannot see */
    expect: 'A2 it now resolves to 16px' },

  /* the CLCPA-266 rhythm must not move */
  { t: CSS, name: 'THE 12px STACKING RHYTHM is changed while "fixing" the gap',
    from: '  margin-top: 12px; padding: 14px 16px;',
    to:   '  margin-top: 16px; padding: 14px 16px;',
    expect: 'D1 .ingest-import-result keeps its 12px stacking rhythm' },
  { t: CSS, name: 'AN ACCENT is changed alongside',
    from: '.ingest-import-notice.is-warn { border-left-color: var(--amber); }',
    to:   '.ingest-import-notice.is-warn { border-left-color: var(--dusk); }',
    expect: 'D2 .is-warn keeps its accent' },
  { t: CSS, name: 'THE LAST CHILD INSIDE a box regains a trailing gap',
    from: '.ingest-import-result > :last-child,\r\n.ingest-import-notice > :last-child { margin-bottom: 0; }',
    to:   '',
    expect: 'D3 the last child in a box still has an explicit zero trailing gap' },

  /* the harness */
  { t: SUITE, name: 'HARNESS: the claim is grepped instead of resolved',
    from: '  const r = cascade.resolve(css, e, prop);\r\n  return r && r.winner ? String(r.winner.value).trim() : null;',
    to:   "  if (css.indexOf(prop) >= 0) return '16px';\r\n  const r = cascade.resolve(css, e, prop);\r\n  return r && r.winner ? String(r.winner.value).trim() : null;",
    expect: 'A1 on BASE the last box had NO bottom gap',
    alt: 'A3 while a box in the MIDDLE of the stack gets none' },
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '7260063';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X1 BASE is a literal sha' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-275 -- mutation controls');
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
  try { out = execFileSync('node', ['suite_275.js'], { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP, DAC_CSS_OVERRIDE: CSS }) }); }
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
try { clean = execFileSync('node', ['suite_275.js'], { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP, DAC_CSS_OVERRIDE: CSS }) }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-275-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
