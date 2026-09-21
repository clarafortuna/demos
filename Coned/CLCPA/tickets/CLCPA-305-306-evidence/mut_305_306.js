/* Mutation controls for suite_305_306.
 *
 * Control 4 is this build's own withdrawn first cut: suppress TOTAL ROWS as a
 * class. It removes the double report perfectly well, and it also takes away
 * H1's frozen total -- a KEPT FILED figure the engine could not reproduce,
 * which is the case CLCPA-278 round 3 exists to report. suite_278_r3 caught it
 * when it was live; block F of this suite has to catch it here.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const APP = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_305_306.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const SHA = (s) => require('crypto').createHash('sha256').update(s).digest('hex').slice(0, 12);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mut305-'));

const FILTER_BODY =
  '      if (!isTotalRow(n.rowIndex)) return true;\r\n' +
  '      const below = byColumn[n.column];\r\n' +
  '      if (below === undefined || below === 0) return true;\r\n' +
  '      return !withinSourceRounding(n.filed - n.computed, below);';

const MUTATIONS = [
  {
    name: 'CLCPA-305 DEFECT: the panel renders the import-time list again',
    from: "      '</div>' + notices + identity + yearAdvisory +\r\n",
    to:   "      '</div>' + notices + identity + yearAdvisory +\r\n" +
          "      renderReconcileNotice(r.reconcileNotices) +\r\n",
    expect: ['A1'],
  },
  {
    name: 'CLCPA-305 DEFECT: the page stands aside whenever an import produced ' +
          'a list of its own',
    from: '    return (r ? renderIngestImportResult(r) : \'\') + renderTypedUnitNotice() +\r\n' +
          '      renderReconcileNotice(draftReconcile) +',
    to:   '    return (r ? renderIngestImportResult(r) : \'\') + renderTypedUnitNotice() +\r\n' +
          '      (r && r.reconcileNotices && r.reconcileNotices.length\r\n' +
          '        ? \'\' : renderReconcileNotice(draftReconcile)) +',
    /* NOT A2: the call is still there, inside the ternary, so "the page
     * renders it from the draft" stays true. A3 is the assertion that
     * targets this, and it is why A3 exists as a separate line. */
    expect: ['A3'],
  },
  {
    name: 'CLCPA-306 DEFECT: the filter is removed, so one wrong figure is ' +
          'reported twice again',
    from: FILTER_BODY,
    to:   '      return true;',
    expect: ['C3', 'C4'],
  },
  {
    name: 'THIS BUILDS OWN WITHDRAWN FIRST CUT: suppress total rows as a CLASS, ' +
          'which also hides a kept filed total',
    from: FILTER_BODY,
    to:   '      return !isTotalRow(n.rowIndex);',
    expect: ['F1', 'F2'],
  },
  {
    name: 'the gap is compared the wrong way round, so a coincidental match ' +
          'suppresses and a real duplicate survives',
    from: '      return !withinSourceRounding(n.filed - n.computed, below);',
    to:   '      return withinSourceRounding(n.filed - n.computed, below);',
    expect: ['C3', 'C4'],
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
console.log('  MUTATION CONTROLS: CLCPA-305 / CLCPA-306');
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
