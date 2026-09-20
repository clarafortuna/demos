/* Mutation controls for suite_241_289.
 *
 * Mutation 1 is the defect I actually shipped mid-build and caught with a
 * probe: without the edit signal the conditional cannot tell a source
 * disagreement from an operator's edit, and the stale cell CLCPA-241 exists to
 * remove comes back. It is first here because it is the one that already
 * happened.
 *
 * Applied to a TEMP COPY through DAC_APP_OVERRIDE, because this suite pins its
 * baseline to a commit: a runner editing the working tree would mutate a file
 * half the assertions never read.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const APP = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_241_289.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const SHA = (s) => require('crypto').createHash('sha256').update(s).digest('hex').slice(0, 12);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mut241-'));

const MUTATIONS = [
  {
    name: 'the edit signal is ignored, so an edited input keeps the stale figure',
    from: '    if (inputsChanged) return { write: true };',
    to: '    if (false && inputsChanged) return { write: true };',
    expect: ['H4', 'H5'],
  },
  {
    name: 'the conditional never keeps: every filed figure is overwritten',
    from: '    if (!rule || !rule.keepFiled) return { write: true };',
    to: '    if (true) return { write: true };',
    expect: ['C3', 'D1', 'D2', 'D3', 'D4', 'E2', 'E3', 'E4', 'H2'],
  },
  {
    name: 'value identity gives way to derivedRowKeepsStored, whose relative gate over-keeps',
    from: '    return derivedFiledReproduced(stored, computed)',
    to: '    return derivedRowKeepsStored(stored, computed).keep',
    expect: ['C2', 'C3', 'D1', 'D4'],
  },
  {
    name: 'the strip stops asking, and nulls a kept figure',
    from: '        if (!derivedCellWrite(r[ci], rebuilt, d).write) return;',
    to: '        if (false) return;',
    expect: ['E2', 'E3', 'E4'],
  },
  {
    name: 'percentChange is no longer a declared percentage column',
    from: "      } else if (d.type === 'percentChange') {",
    to: "      } else if (false) {",
    expect: ['C1.2024', 'C1.2025'],
  },
  {
    name: 'the declared precision moves to one decimal, and value identity breaks',
    from: '      A9: [pctChange(5, 3, 1, 0), pctChange(6, 4, 2, 0)],',
    to: '      A9: [pctChange(5, 3, 1, 1), pctChange(6, 4, 2, 1)],',
    expect: ['C1.2024', 'C1.2025'],
  },
  {
    name: 'A9 loses its rule entirely',
    from: '      A9: [pctChange(5, 3, 1, 0), pctChange(6, 4, 2, 0)],',
    to: '',
    expect: ['B1', 'C2', 'C3', 'D1', 'E2', 'F2'],
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
    const m = /^\s*FAIL\s+([A-Z]\d+[a-z]?(?:\.\d+)?)/.exec(l);
    if (m) red.push(m[1]);
    else if (/^\s*FAIL\s/.test(l)) red.push(l.trim().slice(0, 46));
  });
  return { red, status: r.status };
};

console.log('='.repeat(70));
console.log('  MUTATION CONTROLS: CLCPA-241 + CLCPA-289');
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
