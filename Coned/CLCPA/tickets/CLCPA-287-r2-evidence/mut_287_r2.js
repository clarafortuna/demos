/* Mutation controls for suite_287_r2.
 *
 * Applied to a TEMP COPY and fed in through DAC_APP_OVERRIDE, because this
 * suite pins its baseline to a commit: a runner that edited the working tree
 * while the suite read a pinned blob would be mutating a file half the
 * assertions never look at.
 *
 * Every mutation names the assertions it must turn red. One that leaves the
 * suite green is reported as a defect OF THE SUITE.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const APP = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_287_r2.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const SHA = (s) => require('crypto').createHash('sha256').update(s).digest('hex').slice(0, 12);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mut287r2-'));

const MUTATIONS = [
  {
    name: 'the failure path returns again, holding the dialog open (the defect itself)',
    from: '            refreshIngestNotices();\r\n          }\r\n          close();',
    to: '            refreshIngestNotices();\r\n            return;\r\n          }\r\n          close();',
    /* NOT B3: restoring the return adds no second close(), so the count B3
     * guards is untouched. Expecting it here would have been an expectation
     * the mutation cannot meet, which is why mutation 6 exists instead. */
    expect: ['B1', 'B2'],
  },
  {
    name: 'the label-column rejection interpolates schema[0] raw again',
    from: "      reject('The file has no ' + ingestKeyColDescription(schema, 0).phrase +\r\n        ', which is the one that says which row each value belongs to. Download ' +\r\n        'the template for this table and year to see the headings it expects.', {});",
    to: "      reject('The file has no “' + schema[0] + '” column, which is the one ' +\r\n        'that says which row each value belongs to. Download the template for this ' +\r\n        'table and year to see the headings it expects.', {});",
    expect: ['C1', 'C2', 'D2', 'X3', 'X4'],
  },
  {
    name: 'the unheaded branch describes nothing: an empty phrase',
    from: "    return { named: false, phrase: ord + ' column, unheaded in this table',",
    to: "    return { named: false, phrase: '“” column',",
    expect: ['C1', 'C2', 'D2'],
  },
  {
    name: 'a NAMED column is described by position too, losing its heading',
    from: "      return { named: true, phrase: '“' + raw + '” column',",
    to: "      return { named: true, phrase: 'first column, unheaded in this table',",
    expect: ['C4', 'C5'],
  },
  {
    name: 'the unreachable dialog error painting comes back',
    from: '          if (failed) {\r\n',
    to: "          if (failed) {\r\n            if (err) { err.textContent = why; err.style.display = 'block'; }\r\n",
    expect: ['B4'],
  },
  {
    /* B3 exists so the two outcomes cannot drift apart: a SECOND close() in
     * the failure branch is how that drift would start, and it is the shape
     * no other mutation here produces. Without this control B3 would be an
     * assertion nothing had ever shown could fail. */
    name: 'the failure branch gets its OWN close(), so the two paths can drift apart',
    from: '            refreshIngestNotices();\r\n          }\r\n          close();',
    to: '            refreshIngestNotices();\r\n            close();\r\n          }\r\n          close();',
    expect: ['B3'],
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
    else if (/^\s*FAIL\s/.test(l)) red.push(l.trim().slice(0, 50));
  });
  return { red, status: r.status };
};

console.log('='.repeat(70));
console.log('  MUTATION CONTROLS: CLCPA-287 round 2');
console.log('  app.js sha256[0:12] before: ' + SHA(ORIGINAL));
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
console.log('='.repeat(70));
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
console.log('='.repeat(70));
console.log(bad ? '  ' + bad + ' PROBLEM(S)' : '  all ' + MUTATIONS.length +
  ' controls turned the suite red on the assertions they target, and the' +
  '\n  clean re-run is green against byte-restored source.');
console.log('='.repeat(70));
process.exit(bad ? 1 : 0);
