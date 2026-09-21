/* Mutation controls for suite_311.
 *
 * Applied to a TEMP COPY through DAC_APP_OVERRIDE, because the suite pins its
 * baseline to a commit: a runner editing the working tree would mutate a file
 * half the assertions never read.
 *
 * Mutation 1 is the defect itself, restored. Mutation 3 is the one worth
 * having: it keeps the null guard but drops the stored share, which leaves the
 * bar honest and useless -- a dash where D3 files 9.3%. A suite that only
 * checked "no longer zero" would pass it.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const APP = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_311.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const SHA = (s) => require('crypto').createHash('sha256').update(s).digest('hex').slice(0, 12);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mut311-'));

const MUTATIONS = [
  {
    name: 'the share is computed from a null again (the defect itself)',
    /* CRLF: the working tree is CRLF throughout, so a multi-line anchor joined
     * with \n matches nothing and the control reports itself BROKEN rather
     * than passing quietly. */
    from: '        const dacShare = (share && share.curr != null) ? share.curr\r\n' +
          '          : ((total && dac != null) ? (dac / total) : null);',
    to:   '        const dacShare = total ? (dac / total) : null;',
    expect: ['C1', 'C3', 'C4', 'F1'],
  },
  {
    name: 'the slot gates on the total again, so the dash is unreachable',
    from: "                <span class=\"d-bar-total\">${dacShare != null ? fmtPct(dacShare) : '—'}</span>",
    to:   "                <span class=\"d-bar-total\">${total != null ? fmtPct(dacShare) : '—'}</span>",
    /* NOT F1: this mutation restores a line BASE already had, so nothing
     * counts as added and the attribution check is right to stay green. */
    expect: ['D1', 'D3'],
  },
  {
    name: 'the stored share is dropped: honest, and useless',
    from: '                                   { curr: d3LmiPct.upTo, prev: d3LmiPct.prevCum })}',
    to:   '                                   null)}',
    expect: ['E2', 'F1'],
  },
  {
    name: 'the call reads the COUNT row instead of the share (the "percentage" term goes)',
    from: "      const d3LmiPct  = getDRow('D3', ['percentage', 'low-income', 'energy affordability']);",
    to:   "      const d3LmiPct  = getDRow('D3', ['low-income', 'energy affordability']);",
    expect: ['E1', 'F1'],
  },
  {
    name: 'a filed share of zero is treated as missing',
    from: '        const dacShare = (share && share.curr != null) ? share.curr',
    to:   '        const dacShare = (share && share.curr) ? share.curr',
    expect: ['C5', 'F1'],
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
    const m = /^\s*FAIL\s+([A-Z]\d+)/.exec(l);
    if (m) red.push(m[1]);
    else if (/^\s*FAIL\s/.test(l)) red.push(l.trim().slice(0, 46));
  });
  return { red, status: r.status };
};

console.log('='.repeat(72));
console.log('  MUTATION CONTROLS: CLCPA-311 / D-04');
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
