/* Mutation controls for suite_293.
 *
 * TWO OF THESE MEASURED SOMETHING I HAD ASSERTED AND NOT CHECKED. I expected
 * both to turn block C red; neither does, and the reasons corrected the story
 * I had written into app.js:
 *
 *   2. candidate is a COPY of draft where the probe is called, so swapping one
 *      for the other does not change behaviour at all. It turns X2 red, the
 *      structural pin on that line, and nothing else. The comment in app.js
 *      claimed a measured difference; it now says what is true, that the draft
 *      is named so the rule holds wherever the call sits.
 *   4. A8's grand total is not FLAGGED as a total in the draft, so the probe
 *      never visits it. Its acceptance comes from the classifier not flagging
 *      it, and the probe is what protects the rows that ARE flagged. Kept as a
 *      NEGATIVE control, asserted to move nothing.
 *
 * A control that quietly confirms what I assumed is worth little; one that
 * contradicts the comment beside the code is worth the run.
 *
 * Applied to a TEMP COPY through DAC_APP_OVERRIDE: the suite pins its baseline
 * to a commit, so a runner editing the working tree would mutate a file half
 * the assertions never read.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const APP = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_293.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const SHA = (s) => require('crypto').createHash('sha256').update(s).digest('hex').slice(0, 12);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mut293-'));

const MUTATIONS = [
  {
    name: 'the total row is refused again, as before the ticket (the defect itself)',
    from: "          if (!computed.derivedCol(cIdx) && !rebuildableTotals.has(t.rowIdx + ',' + cIdx)) {",
    to: '          if (false) {',
    expect: ['C1', 'C2', 'C3'],
  },
  {
    /* candidate is a COPY of draft at this point, so this moves nothing
     * today and is expected to move nothing. It is kept as a recorded
     * NEGATIVE control: the comment in app.js says the draft is named for
     * independence from where the call sits, not because the two currently
     * differ, and this is the measurement behind that sentence. */
    name: 'the probe asks the CANDIDATE instead of the draft',
    from: '    const baseRows = (draft || []).map(row => (row || []).slice());',
    to: '    const baseRows = candidate.map(row => (row || []).slice());',
    /* It DOES turn X2 red, which is the structural pin on that exact line,
     * and that is the honest expectation: the behaviour does not move, the
     * declaration does. */
    expect: ['X2'],
  },
  {
    name: 'a derived COLUMN is handed over too, which is the CLCPA-88 defect returning',
    from: '          if (!computed.derivedCol(cIdx) && !rebuildableTotals.has',
    to: '          if (!rebuildableTotals.has',
    expect: ['D4'],
  },
  {
    /* Also a NEGATIVE control, and it taught me something worth recording:
     * A8's grand total is not FLAGGED as a total in the draft at all, so the
     * probe never visits it and this cannot reach it. Its acceptance comes
     * from the classifier not flagging it; the probe is what protects the
     * rows that ARE flagged, which mutation 3 and D1 to D3 cover. */
    name: 'every flagged total is called rebuildable (a NEGATIVE control)',
    from: '        if (back != null && String(back).trim() !== \'\') out.add(ri + \',\' + c);',
    to: "        out.add(ri + ',' + c);",
    expect: [], negative: true,
  },
  {
    name: 'a probe that throws hands the row to the preparer, the permissive default',
    from: "        for (let c = 1; c < schema.length; c++) out.add(ri + ',' + c);\r\n        return;",
    to: '        return;',
    expect: ['X4'],
  },
  {
    name: 'the advisory stops naming what was taken',
    from: "      '<h4>Taken as filed: ' + n.length + ' total cell' + (n.length === 1 ? '' : 's') + '</h4>' +",
    to: "      '<h4>Imported</h4>' +",
    expect: ['E1'],
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
    const m = /^\s*FAIL\s+([A-Z]\d+[a-z]?)/.exec(l);
    if (m) red.push(m[1]);
    else if (/^\s*FAIL\s/.test(l)) red.push(l.trim().slice(0, 46));
  });
  return { red, status: r.status };
};

console.log('='.repeat(70));
console.log('  MUTATION CONTROLS: CLCPA-293 / A-10');
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
  if (m.negative) {
    console.log('      NEGATIVE control: expected to move nothing');
    console.log('      actually red : ' + (red.length ? red.join(', ') : '(none)'));
    if (red.length) { console.log('      UNEXPECTED: it moved something'); bad++; }
    else console.log('      ok');
    console.log('');
    return;
  }
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
