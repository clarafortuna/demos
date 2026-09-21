/* Mutation controls for suite_309_310.
 *
 * Control 3 is the one worth having. Rounding to a fixed two decimals is the
 * obvious way to kill a floating-point artifact, it makes every case in the
 * census look clean, and it silently reports "9.3% read as 0.09" -- a number
 * that is not what landed. An assertion that only checked "no artifact" would
 * pass it.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const APP = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_309_310.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const SHA = (s) => require('crypto').createHash('sha256').update(s).digest('hex').slice(0, 12);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mut310-'));

const MUTATIONS = [
  {
    name: 'THE DEFECT ITSELF: the import panel concatenates the raw value again',
    from: "          cell(x) + ': ' + x.read + ' read as ' +\r\n" +
          "          unitNoticeValue(x.read, x.landed))).join('') +",
    to:   "          cell(x) + ': ' + x.read + ' read as ' + x.landed)).join('') +",
    expect: ['D1', 'D2'],
  },
  {
    name: 'ONE SURFACE ONLY: the typed-cell notice is left raw, so the same ' +
          'cell reads one way while typing and another after import',
    from: "      n.map(x => li(cell(x) + ': ' + x.read + ' read as ' +\r\n" +
          "        unitNoticeValue(x.read, x.landed))).join('') +",
    to:   "      n.map(x => li(cell(x) + ': ' + x.read + ' read as ' + x.landed)).join('') +",
    expect: ['D1', 'D2'],
  },
  {
    name: 'ROUNDED TO TWO DECIMALS: no artifact anywhere, and "9.3%" now ' +
          'reports as 0.09, which is not what landed',
    from: '    const places = Math.min(typed + 2, 12);',
    to:   '    const places = 2;',
    expect: ['B1', 'B2'],
  },
  {
    name: 'the trailing-zero trim eats the value\'s own digits',
    from: "    return places ? fixed.replace(/\\.?0+$/, '') : fixed;",
    to:   "    return places ? fixed.replace(/0+$/, '') : fixed;",
    expect: ['B1'],
  },
];

const runSuite = (srcPath) => {
  const r = spawnSync(process.execPath, [SUITE], {
    cwd: __dirname, encoding: 'utf8',
    env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: srcPath }),
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const red = [];
  out.split(/\r?\n/).forEach((l) => {
    const m = /^\s*FAIL\s+([A-Z][A-Z0-9-]*[0-9])\b/.exec(l);
    if (m) red.push(m[1]);
    else if (/^\s*FAIL\s/.test(l)) red.push(l.trim().slice(0, 46));
  });
  return { red, status: r.status };
};

console.log('='.repeat(72));
console.log('  MUTATION CONTROLS: CLCPA-309 / CLCPA-310');
console.log('  app.js sha256[0:12] before: ' + SHA(ORIGINAL));
console.log('='.repeat(72));
console.log('');

let bad = 0;
MUTATIONS.forEach((m, i) => {
  console.log('  [' + (i + 1) + '] ' + m.name);
  const hits = ORIGINAL.split(m.from).length - 1;
  if (hits !== 1) {
    console.log('      BROKEN CONTROL: anchor matched ' + hits + ' times, expected 1');
    bad++; console.log(''); return;
  }
  const p = path.join(TMP, 'app_mut_' + (i + 1) + '.js');
  fs.writeFileSync(p, ORIGINAL.replace(m.from, () => m.to));
  const { red, status } = runSuite(p);
  const missing = m.expect.filter(e => red.indexOf(e) < 0);
  console.log('      expected red : ' + m.expect.join(', '));
  console.log('      actually red : ' + (red.length ? red.join(', ') : '(none)'));
  if (missing.length) { console.log('      SUITE DEFECT: did not fail: ' + missing.join(', ')); bad++; }
  else if (status === 0) { console.log('      SUITE DEFECT: the suite exited GREEN on mutated source'); bad++; }
  else console.log('      ok');
  console.log('');
});

const AFTER = fs.readFileSync(APP, 'utf8');
console.log('='.repeat(72));
console.log('  app.js sha256[0:12] after : ' + SHA(AFTER));
if (AFTER !== ORIGINAL) {
  console.log('  *** app.js WAS MODIFIED BY THIS RUN. Restoring. ***');
  fs.writeFileSync(APP, ORIGINAL); bad++;
} else {
  console.log('  app.js is byte-for-byte unchanged: every mutation went to a temp copy.');
}
try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}

console.log('');
console.log('  CLEAN RE-RUN against the restored source:');
const clean = spawnSync(process.execPath, [SUITE], { cwd: __dirname, encoding: 'utf8' });
const tally = ((clean.stdout || '').match(/(\d+) passed, (\d+) failed/) || [])[0] || '(no tally)';
console.log('    ' + tally + '   exit ' + clean.status);
if (clean.status !== 0) { console.log('    *** THE CLEAN RE-RUN IS NOT GREEN ***'); bad++; }
console.log('='.repeat(72));
console.log(bad ? '  ' + bad + ' PROBLEM(S)' : '  all ' + MUTATIONS.length +
  ' controls turned the suite red on the assertions they target, and the' +
  '\n  clean re-run is green against byte-restored source.');
console.log('='.repeat(72));
process.exit(bad ? 1 : 0);
