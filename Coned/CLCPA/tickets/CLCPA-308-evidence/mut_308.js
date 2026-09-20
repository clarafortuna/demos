/* Mutation controls for suite_308.
 *
 * Applied to a TEMP COPY through DAC_APP_OVERRIDE, because the suite pins its
 * baseline to a commit.
 *
 * Control 3 is the one that matters most. It restores this build's own first
 * cut, which registered the derived row in `any` as well as in the workbook --
 * a change that reads as more complete and would have had the importer discard
 * 47 filed figures. The suite has to go red on it, or the measurement that
 * withdrew it was never guarding anything.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const APP = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_308.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const SHA = (s) => require('crypto').createHash('sha256').update(s).digest('hex').slice(0, 12);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mut308-'));

const MUTATIONS = [
  {
    name: 'THE DEFECT ITSELF: the workbook stops reading declared derived rows',
    from: '        if (!!derivedRowSet[r] && c >= 1 && engineWrites(c)) return true;\r\n',
    to:   '',
    expect: ['A2', 'B1'],
  },
  {
    name: 'only the FIRST value column is marked, so the second still invites ' +
          'a figure the engine overwrites',
    from: '        if (!!derivedRowSet[r] && c >= 1 && engineWrites(c)) return true;',
    to:   '        if (!!derivedRowSet[r] && c === 1 && engineWrites(c)) return true;',
    /* NOT B1: the row still moves, so a row count cannot see this. B5 counts
     * cells and A2 pins the exact set, and they are here because this control
     * walked straight through the first version of both. */
    expect: ['A2', 'B5'],
  },
  {
    name: 'THIS BUILDS OWN WITHDRAWN FIRST CUT: the derived row also gates the ' +
          'IMPORT, which would discard 47 filed figures on re-import',
    from: '      any: (r, c) => (!!totals[r] && (!!derived[c] || engineWrites(c))) ||\r\n' +
          '        (!!derived[c] && !isTotalOnlyDerived(derived[c])),',
    to:   '      any: (r, c) => (!!totals[r] && (!!derived[c] || engineWrites(c))) ||\r\n' +
          '        (!!derived[c] && !isTotalOnlyDerived(derived[c])) ||\r\n' +
          '        (!!derivedRowSet[r] && c >= 1 && engineWrites(c)),',
    expect: ['C1', 'C2'],
  },
  {
    name: 'the row index is off by one, so the marker lands on the row BELOW ' +
          'the declared one',
    from: '    ((tableId && DERIVED_ROWS[tableId]) || []).forEach((d) => { derivedRowSet[d.row] = d; });',
    to:   '    ((tableId && DERIVED_ROWS[tableId]) || []).forEach((d) => { derivedRowSet[d.row + 1] = d; });',
    expect: ['A2', 'B4'],
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
console.log('  MUTATION CONTROLS: CLCPA-308');
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
