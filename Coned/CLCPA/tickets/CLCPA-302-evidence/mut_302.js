/* Mutation controls for suite_302.
 *
 * Control 3 is the CLCPA-271 shape again: pass the tableId from one backend
 * and not the other. The localStorage path is what every suite and every
 * local run exercises, so a fix applied there alone looks complete and leaves
 * the hosted Dataverse path counting the old way.
 *
 * Control 4 inverts the failure direction: a classifier that cannot run makes
 * the history count NOTHING instead of everything. That is the dangerous way
 * round -- a silent empty record rather than a noisy full one.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const APP = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_302.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const SHA = (s) => require('crypto').createHash('sha256').update(s).digest('hex').slice(0, 12);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mut302-'));

const MUTATIONS = [
  {
    name: 'THE DEFECT ITSELF: the history counts every cell again',
    from: '        if (!computed) return true;\r\n        if (c < keyCols) return false;\r\n        return !computed.any(r, c);',
    to:   '        return true;',
    expect: ['A3'],
  },
  {
    name: 'KEY CELLS ONLY are excluded, so the engine cells come back',
    from: '        if (c < keyCols) return false;\r\n        return !computed.any(r, c);',
    to:   '        return c >= keyCols;',
    expect: ['A3'],
  },
  {
    name: 'ONE BACKEND ONLY: localStorage passes the tableId and Dataverse ' +
          'does not, so every local run looks fixed',
    /* anchored on the Dataverse call site alone: the two backends' call lines
     * are byte-identical, so the comment that follows this one is what tells
     * them apart. Adding a THIRD call instead of replacing this one was the
     * first cut, and X2 counts occurrences -- it stayed at two and went
     * green. */
    from: '          const changes = diffRows(oldRows, newRows, ctx.schema || [], tableId);\r\n\r\n          // --- synchronous cache update (instant UI) ---',
    to:   '          const changes = diffRows(oldRows, newRows, ctx.schema || []);\r\n\r\n          // --- synchronous cache update (instant UI) ---',
    expect: ['X2'],
  },
  {
    name: 'THE FAILURE DIRECTION IS INVERTED: a classifier that cannot run ' +
          'makes the history count nothing instead of everything',
    from: '        if (!computed) return true;',
    to:   '        if (!computed) return false;',
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
    const m = /^\s*FAIL\s+([A-Z][A-Z0-9-]*[0-9])\b/.exec(l);
    if (m) red.push(m[1]);
    else if (/^\s*FAIL\s/.test(l)) red.push(l.trim().slice(0, 46));
  });
  return { red, status: r.status };
};

console.log('='.repeat(72));
console.log('  MUTATION CONTROLS: CLCPA-302');
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
