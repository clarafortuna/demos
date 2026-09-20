/* Mutation controls for suite_292_r2.
 *
 * An assertion that cannot fail is not a guard, and this repo has shipped
 * several: nine mutations once moved nothing at all. So every mutation below
 * names the assertions it must turn red, and a mutation that leaves the suite
 * green is reported as a FAILURE OF THE SUITE, not a curiosity.
 *
 * The mutation is applied to a TEMP COPY and fed in through DAC_APP_OVERRIDE.
 * That matters here: this suite pins its baseline to a commit, and a runner
 * that edited the working tree while the suite read a pinned blob would
 * mutate a file the assertions never look at -- which is how eleven of
 * thirteen controls once went green while changing real code.
 *
 * The run ends by restoring byte-for-byte and re-running clean.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const APP = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_292_r2.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const SHA = (s) => require('crypto').createHash('sha256').update(s).digest('hex').slice(0, 12);
const SHA_BEFORE = SHA(ORIGINAL);

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mut292r2-'));

const MUTATIONS = [
  {
    name: 'the donor is the NEWEST year again, published or not (the defect itself)',
    from: 'const published = withRows.filter(y => isYearProtected(y));',
    to: 'const published = withRows.slice();',
    expect: ['B1', 'B2', 'B3', 'B4', 'B5'],
  },
  {
    name: 'the donor requires a published year rather than preferring one',
    from: 'const donor = published.length ? published[0] : withRows[0];',
    to: 'const donor = published[0];',
    expect: ['F1', 'F2'],
  },
  {
    name: 'the text-column predicate judges on ALL years again',
    from: 'const published = all.filter(y => isYearProtected(y));',
    to: 'const published = [];',
    expect: ['C1'],
  },
  {
    name: 'the donor takes the OLDEST published year instead of the newest',
    from: 'const donor = published.length ? published[0] : withRows[0];',
    to: 'const donor = published.length ? published[published.length - 1] : withRows[0];',
    expect: ['B5'],
  },
  {
    name: 'the published filter is inverted: only scratch years may donate',
    from: 'const published = withRows.filter(y => isYearProtected(y));',
    to: 'const published = withRows.filter(y => !isYearProtected(y));',
    expect: ['B1', 'B2', 'B3', 'B4', 'B5'],
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
    const m = /^\s*FAIL\s+([A-Z]\d+[a-z]?)\b/.exec(l);
    if (m) red.push(m[1]);
    else if (/^\s*FAIL\s/.test(l)) red.push(l.trim().slice(0, 60));
  });
  return { red, out, status: r.status };
};

console.log('='.repeat(70));
console.log('  MUTATION CONTROLS: CLCPA-292 round 2');
console.log('  app.js sha256[0:12] before: ' + SHA_BEFORE);
console.log('='.repeat(70));
console.log('');

let bad = 0;
MUTATIONS.forEach((m, i) => {
  console.log('  [' + (i + 1) + '] ' + m.name);
  const hits = ORIGINAL.split(m.from).length - 1;
  if (hits !== 1) {
    console.log('      BROKEN CONTROL: anchor matched ' + hits + ' times, expected 1');
    bad++; console.log(''); return;
  }
  /* the function form: a replacement string containing $& or $' expands */
  const mutated = ORIGINAL.replace(m.from, () => m.to);
  const p = path.join(TMP, 'app_mut_' + (i + 1) + '.js');
  fs.writeFileSync(p, mutated);

  const { red, status } = runSuite(p);
  const missing = m.expect.filter(e => red.indexOf(e) < 0);
  console.log('      expected red : ' + m.expect.join(', '));
  console.log('      actually red : ' + (red.length ? red.join(', ') : '(none)'));
  if (missing.length) {
    console.log('      SUITE DEFECT: these did not fail: ' + missing.join(', '));
    bad++;
  } else if (status === 0) {
    console.log('      SUITE DEFECT: the suite exited GREEN on mutated source');
    bad++;
  } else {
    console.log('      ok');
  }
  console.log('');
});

/* --------------------------------------------------------------- */
const AFTER = fs.readFileSync(APP, 'utf8');
console.log('='.repeat(70));
console.log('  app.js sha256[0:12] after : ' + SHA(AFTER));
if (AFTER !== ORIGINAL) {
  console.log('  *** app.js WAS MODIFIED BY THIS RUN. Restoring. ***');
  fs.writeFileSync(APP, ORIGINAL);
  bad++;
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
console.log('='.repeat(70));
console.log(bad ? '  ' + bad + ' PROBLEM(S)' : '  all ' + MUTATIONS.length +
  ' controls turned the suite red on the assertions they target, and the' +
  '\n  clean re-run is green against byte-restored source.');
console.log('='.repeat(70));
process.exit(bad ? 1 : 0);
