/* CLCPA-280 gate: the placeholder strings are nowhere in the shipped app, and
 * every place they DO still appear is a place that is allowed to have them.
 *
 * A sweep that only greps the app proves the app is clean and says nothing
 * about whether the change leaked. This one walks the whole repository, sorts
 * every hit into a declared class, and FAILS on any hit it cannot place. The
 * classes are:
 *
 *   SHIPPED       the web resources that deploy. Must be zero.
 *   FROZEN        CLCPA-221's evidence: renders/*.html captured from the build
 *                 of the day, and render_221.js which asserts against them.
 *                 Evidence describes a build at a date and is not rewritten.
 *   ARCHIVE       deploy-backups/, which holds the live bytes of past deploys.
 *                 Rewriting one would destroy the rollback it exists to be.
 *   THIS TICKET   this directory, where the strings appear as the thing being
 *                 removed.
 *
 * The handoff package is CLCPA-279's lane and is named in the ticket as
 * untouched: it is not exempted here, it is ASSERTED clean, so that a leak
 * into it would fail this gate rather than pass it quietly.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const OUT = path.join(__dirname, 'gate-280-output.txt');
const GONE = ['TO BE FILLED', 'Delivered by', 'Update cadence'];
const SHIPPED = [
  'Coned/CLCPA/ExecutiveDashboard_dev/app.js',
  'Coned/CLCPA/ExecutiveDashboard_dev/styles.css',
  'Coned/CLCPA/ExecutiveDashboard_dev/ExecutiveDashboard.html',
  'Coned/CLCPA/ExecutiveDashboard_dev/index.html',
  'Coned/CLCPA/ExecutiveDashboard_dev/data-sources.html',
  'Coned/CLCPA/ExecutiveDashboard_dev/sources-update-guide.html',
];
const HANDOFF = /^Coned\/CLCPA\/(make_handoff_package\.py|verify_handoff_package\.py|operator-docs\/|OPERATOR_SCRIPT_FACTS\.md|HANDOFF_PACKAGE_VERIFICATION\.md)/;

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  PASS  ' + m); } else { fail++; log('  FAIL  ' + m); } };

/* TRACKED FILES ONLY, from git: a walk of the working tree would sweep
 * node_modules, mutants/ and whatever a previous run left in place, and a gate
 * whose scope depends on what is lying around is not a gate. */
const tracked = execSync('git ls-files', { cwd: ROOT, maxBuffer: 1 << 28 })
  .toString().split(/\r?\n/).filter(Boolean);

const BINARY = /\.(png|jpg|jpeg|gif|zip|xlsx|pdf|ico|woff2?|ttf)$/i;
const hits = [];
tracked.forEach((rel) => {
  if (BINARY.test(rel)) return;
  let text;
  try { text = fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return; }
  GONE.forEach((needle) => {
    const n = text.split(needle).length - 1;
    if (n) hits.push({ rel, needle, n });
  });
});

const cls = (rel) =>
  SHIPPED.indexOf(rel) >= 0 ? 'SHIPPED'
    : /^Coned\/CLCPA\/tickets\/CLCPA-280-evidence\//.test(rel) ? 'THIS TICKET'
      : /^Coned\/CLCPA\/tickets\/CLCPA-221-evidence\//.test(rel) ? 'FROZEN'
        : /(^|\/)deploy-backups\//.test(rel) ? 'ARCHIVE'
          : 'UNPLACED';

log('CLCPA-280 gate: where the retired strings still appear');
log('swept ' + tracked.length + ' tracked files for ' + JSON.stringify(GONE));
log('');
const byClass = {};
hits.forEach((h) => {
  const c = cls(h.rel);
  (byClass[c] = byClass[c] || []).push(h);
});
['SHIPPED', 'UNPLACED', 'FROZEN', 'ARCHIVE', 'THIS TICKET'].forEach((c) => {
  const rows = byClass[c] || [];
  log(c + ': ' + rows.length + ' hit(s)');
  rows.slice(0, 12).forEach(h => log('    ' + h.rel + '  "' + h.needle + '" x' + h.n));
  if (rows.length > 12) log('    ... and ' + (rows.length - 12) + ' more');
});
log('');

log('ASSERTIONS');
ok(hits.length > 0,
  'the sweep found something somewhere, so it is reading files at all: ' +
  hits.length + ' hit(s)');
ok((byClass.SHIPPED || []).length === 0,
  'the shipped web resources carry none of the three strings: ' +
  (byClass.SHIPPED || []).length);
ok((byClass.UNPLACED || []).length === 0,
  'every remaining hit is in a declared class, none unplaced: ' +
  JSON.stringify((byClass.UNPLACED || []).map(h => h.rel)));

/* each shipped file named individually, so a file dropped from SHIPPED by a
 * later edit cannot quietly shrink the gate */
SHIPPED.forEach((rel) => {
  ok(tracked.indexOf(rel) >= 0, 'the gate still covers ' + rel);
});

/* the handoff lane, asserted rather than exempted */
const handoffHits = hits.filter(h => HANDOFF.test(h.rel));
ok(handoffHits.length === 0,
  'the handoff package lane is clean and was not edited: ' +
  JSON.stringify(handoffHits.map(h => h.rel)));

/* AND NO ORPHAN: the class the placeholders were painted with exists in no
 * rule and in no markup that ships */
const app = fs.readFileSync(path.join(ROOT, SHIPPED[0]), 'utf8');
const css = fs.readFileSync(path.join(ROOT, SHIPPED[1]), 'utf8');
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');
ok(codeOnly(app).indexOf('ds-dict-gap') < 0,
  'no shipped code path emits the ds-dict-gap class');
ok(codeOnly(css).indexOf('ds-dict-gap') < 0,
  'no shipped rule styles it');

log('');
log(pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
