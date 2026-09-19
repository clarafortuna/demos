/* Mutation controls for CLCPA security regression.
 *
 * A security suite that passes proves nothing on its own -- it has to be shown
 * capable of failing, and failing on the RIGHT assertion. Each mutant below
 * re-introduces exactly one of the remediated defects into the shipped source,
 * hands the mutant to the suite through DAC_APP_OVERRIDE (mut_271's shape and
 * the standing one here), and requires the named assertion to go red.
 *
 * The run ends with a CLEAN re-run against byte-restored source, and says so
 * loudly, because a mutation runner that leaves a mutant behind would make
 * every later suite lie.
 *
 * Usage:
 *   DAC_APP_OVERRIDE=<remediated app.js> node mut_security.js
 *   (without it, the repository copy is used -- which is only a valid control
 *    once the remediation has landed)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

function findRepoRoot(start) {
  let d = start;
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(d, 'Coned', 'CLCPA', 'ExecutiveDashboard_dev', 'app.js'))) return d;
    const up = path.dirname(d); if (up === d) break; d = up;
  }
  return null;
}
const REPO = process.env.DAC_REPO || findRepoRoot(__dirname);
if (!REPO) { console.error('ABORT: repo root not found; set DAC_REPO'); process.exit(1); }
const DIR = __dirname;
const BASE_APP = process.env.DAC_APP_OVERRIDE ||
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const ORIGINAL = fs.readFileSync(BASE_APP, 'utf8');
const MUT_APP = path.join(os.tmpdir(), 'clcpa-security-mutant-app.js');
const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const ORIGINAL_SHA = sha(ORIGINAL);

/* name, the remediated text, what to put back, the suite that must notice,
 * and the assertion id that must go red. */
const MUTANTS = [
  { name: 'THE DEFECT RETURNS: the body cell is emitted unescaped',
    from: '${escapeHtml(formatCell(cv, i, row[0]))}',
    to:   '${formatCell(cv, i, row[0])}',
    suite: 'suite_xss_table_cells.js',
    expect: ['A1', 'A3'] },

  /* This mutant is the reason suite_label_sinks exists. On the first run it
   * broke nothing: the table-cell suite drives renderTable and the tooltip
   * suite drives the read side, so a section renderer could quietly go back to
   * emitting a borough name raw. The census cannot see those functions either
   * (grabFn returns null at indent 0), so nothing at all would have caught it. */
  { name: 'a borough name is emitted into its attribute unescaped',
    from: 'data-name="${escapeHtml(b.name)}"',
    to:   'data-name="${b.name}"',
    suite: 'suite_label_sinks.js',
    expect: ['A:'] },

  { name: 'the E1 category is emitted into its text node unescaped',
    from: '<div class="e-yoy-label">${escapeHtml(cat.name)}</div>',
    to:   '<div class="e-yoy-label">${cat.name}</div>',
    suite: 'suite_label_sinks.js',
    expect: ['A:'] },

  { name: 'the palette lookup key is "tidied" into an escape -- a silent break',
    from: 'background:${boroughColors[b.name]}',
    to:   'background:${boroughColors[escapeHtml(b.name)]}',
    suite: 'suite_label_sinks.js',
    expect: ['C1'] },

  { name: 'the Section E tooltip reads dataset.name back unescaped',
    from: 'escapeHtml(row.dataset.name)',
    to:   'row.dataset.name',
    suite: 'suite_xss_tooltip_dataset.js',
    expect: ['B1'] },

  { name: 'the Section F tooltip reads dataset.name back unescaped',
    from: 'escapeHtml(b.dataset.name)',
    to:   'b.dataset.name',
    suite: 'suite_xss_tooltip_dataset.js',
    expect: ['B2'] },

  { name: 'the Section H tooltip reads dataset.name back unescaped',
    from: 'escapeHtml(slice.dataset.name)',
    to:   'slice.dataset.name',
    suite: 'suite_xss_tooltip_dataset.js',
    expect: ['B3'] },

  { name: 'the OData literal is no longer URL-encoded',
    from: 'return encodeURIComponent(String(v == null ? \'\' : v).replace(/\'/g, "\'\'"));',
    to:   'return String(v == null ? \'\' : v).replace(/\'/g, "\'\'");',
    suite: 'suite_odata_encoding.js',
    expect: ['E2'] },

  { name: 'the dataset.key charset guard is removed',
    from: '    if (!/^[a-z0-9_]{1,100}$/.test(dsKey)) {',
    to:   '    if (false) {',
    suite: 'suite_dataset_key.js',
    expect: ['A1'] },
];

const runSuite = (suite, appPath) => {
  try {
    return execFileSync(process.execPath, [path.join(DIR, suite)], {
      cwd: DIR, maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'],
      env: Object.assign({}, process.env, {
        DAC_APP_OVERRIDE: appPath,
        DAC_REPO: REPO,
        DAC_OUT: path.join(os.tmpdir(), 'clcpa-security-mut-out.txt'),
        DAC_PATCHED: appPath,
      }),
    }).toString();
  } catch (e) {
    return (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
  }
};

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };

console.log('======================================================================');
console.log('CLCPA security regression -- mutation controls');
console.log('base app: ' + path.basename(BASE_APP) + '  sha ' + ORIGINAL_SHA.slice(0, 12));
console.log('======================================================================');

/* PRE-FLIGHT: the unmutated source must be GREEN on every suite, or a red
 * mutant proves nothing. */
console.log('');
console.log('PRE-FLIGHT: the unmutated source is green');
const SUITES = [...new Set(MUTANTS.map(m => m.suite))];
SUITES.forEach(s => {
  const out = runSuite(s, BASE_APP);
  const m = /(\d+) passed, (\d+) failed/.exec(out);
  ok(m && m[2] === '0', 'clean run of ' + s + ' -> ' + (m ? m[0] : 'NO RESULT LINE'));
});

console.log('');
console.log('MUTANTS');
MUTANTS.forEach((mu, i) => {
  const n = ORIGINAL.split(mu.from).length - 1;
  if (n === 0) {
    ok(false, 'M' + (i + 1) + ' anchor not found, mutation impossible: ' + mu.name);
    return;
  }
  fs.writeFileSync(MUT_APP, ORIGINAL.split(mu.from).join(mu.to));
  const out = runSuite(mu.suite, MUT_APP);
  const res = /(\d+) passed, (\d+) failed/.exec(out);
  const failed = res ? parseInt(res[2], 10) : -1;

  console.log('  M' + (i + 1) + ' ' + mu.name + '   (x' + n + ')');
  if (mu.softFail) {
    ok(true, '     (no dedicated assertion; recorded, covered by the write/read pairing)');
    return;
  }
  ok(failed > 0, '     ' + mu.suite + ' goes RED: ' + (res ? res[0] : 'NO RESULT LINE'));
  mu.expect.forEach(id => {
    /* No \b: several assertion ids end in ':' (A:, B:, C:), and a word
     * boundary after a colon never matches, so every such expectation would
     * have reported a false FAIL. Escape the id and anchor on the FAIL prefix. */
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const hit = new RegExp('FAIL\\s+' + esc).test(out);
    ok(hit, '     and it is ' + id + ' that fails, not something else');
  });
});

/* CLEAN RE-RUN. Loudly, because a leftover mutant would poison every later run. */
console.log('');
console.log('CLEAN RE-RUN against byte-restored source');
fs.writeFileSync(MUT_APP, ORIGINAL);
ok(sha(fs.readFileSync(MUT_APP, 'utf8')) === ORIGINAL_SHA,
  'the restored file is byte-identical to the original (sha ' + ORIGINAL_SHA.slice(0, 12) + ')');
SUITES.forEach(s => {
  const out = runSuite(s, MUT_APP);
  const m = /(\d+) passed, (\d+) failed/.exec(out);
  ok(m && m[2] === '0', s + ' is green again -> ' + (m ? m[0] : 'NO RESULT LINE'));
});
try { fs.unlinkSync(MUT_APP); } catch (e) { /* best effort */ }

console.log('');
console.log('======================================================================');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
console.log('======================================================================');
process.exit(fail ? 1 : 0);
