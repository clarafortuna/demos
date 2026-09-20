/* Mutation controls for suite_320.
 *
 * Applied to a TEMP COPY through DAC_APP_OVERRIDE, because the suite pins its
 * baseline to a commit: a runner editing the working tree would mutate a file
 * half the assertions never read.
 *
 * Control 4 is the one worth having. It replaces the arithmetic term with the
 * role term instead of ADDING to it, which fixes the reported defect
 * perfectly well and quietly takes the marker off every total row whose label
 * does not end in "total" -- A5's "Commercial Programs Total Installations"
 * among them. A suite that only checked "A3/2023 is marked now" would pass it.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const APP = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_320.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const SHA = (s) => require('crypto').createHash('sha256').update(s).digest('hex').slice(0, 12);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mut320-'));

const MUTATIONS = [
  {
    name: 'THE DEFECT ITSELF: the marker goes back to asking the arithmetic',
    from: '        if (((!!totals[r] || !!totalRole[r]) && (!!derived[c] || engineWrites(c))) ||',
    to:   '        if (((!!totals[r]) && (!!derived[c] || engineWrites(c))) ||',
    expect: ['A1', 'B1', 'X2'],
  },
  {
    name: 'the role set is built from the UNANCHORED label test, so a data row ' +
          'that merely mentions a total is marked (CLCPA-209, reopened)',
    from: '    const totalRole = rows.map(r => Array.isArray(r) && isAnchoredTotalRowLabel(r[0]));',
    to:   "    const totalRole = rows.map(r => Array.isArray(r) && /total/i.test(String(r[0])));",
    expect: ['B2', 'D1', 'D2', 'D3', 'X1'],
  },
  {
    name: 'the role set is built from the STRICT whole-label test, so ' +
          '"County Total" and "Systemwide Total" stop counting',
    from: '    const totalRole = rows.map(r => Array.isArray(r) && isAnchoredTotalRowLabel(r[0]));',
    to:   '    const totalRole = rows.map(r => Array.isArray(r) && isStrictTotalRowLabel(r[0]));',
    expect: ['B1', 'X1'],
  },
  {
    name: 'role REPLACES the arithmetic instead of joining it, which still ' +
          'fixes A3 and silently unmarks the total rows labelled another way',
    from: '        if (((!!totals[r] || !!totalRole[r]) && (!!derived[c] || engineWrites(c))) ||',
    to:   '        if (((!!totalRole[r]) && (!!derived[c] || engineWrites(c))) ||',
    expect: ['B2', 'X2'],
  },
  {
    name: 'the role also gates the IMPORT, so the importer starts refusing ' +
          'figures a preparer actually filed (CLCPA-272, reopened)',
    from: '      any: (r, c) => (!!totals[r] && (!!derived[c] || engineWrites(c))) ||',
    to:   '      any: (r, c) => ((!!totals[r] || !!totalRole[r]) && (!!derived[c] || engineWrites(c))) ||',
    expect: ['C2', 'X3'],
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
console.log('  MUTATION CONTROLS: CLCPA-320');
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
