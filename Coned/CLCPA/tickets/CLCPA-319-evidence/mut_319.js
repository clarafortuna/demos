/* Mutation controls for suite_319.
 *
 * Applied to a TEMP COPY through DAC_APP_OVERRIDE, because the suite pins its
 * baseline to a commit: a runner editing the working tree would mutate a file
 * half the assertions never read.
 *
 * Four of these seven are not hypotheticals. Mutations 1, 2, 3 and 4 each
 * restore a defect this build actually shipped into a browser during the
 * round, and three of them passed a full green sweep at the time. They are
 * here so that the assertions written afterwards can be shown to fail on the
 * exact code that fooled the sweep.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawnSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const APP = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const SUITE = path.join(__dirname, 'suite_319.js');
const ORIGINAL = fs.readFileSync(APP, 'utf8');
const SHA = (s) => require('crypto').createHash('sha256').update(s).digest('hex').slice(0, 12);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mut319-'));

const MUTATIONS = [
  {
    name: 'THE SHIPPED DEFECT: the strip nulls a columnTotal on every row, ' +
          'so saving eats the operator figure',
    from: '        if (totalOnly[ci] && !totalRole[i]) return;\r\n',
    to:   '',
    expect: ['S-STRIP-1', 'S-STRIP-2'],
  },
  {
    name: 'THE SHIPPED DEFECT: a column total formats as a ratio, so 430538 ' +
          'renders bare beneath rows rendering 202,384',
    from: "    if (d.type === 'columnTotal') return formatIngestValue(v, isMoney);\r\n",
    to:   '',
    expect: ['S-FMT-1', 'S-FMT-2'],
  },
  {
    name: 'THE SHIPPED DEFECT: the confirmer skips a columnTotal column, so ' +
          'nothing confirms the total and every G percentage halves',
    from: "      .filter(d => d.type !== 'columnTotal')\r\n",
    to:   '',
    expect: ['S-PCT-1', 'S-PCT-2'],
  },
  {
    name: 'THE SHIPPED DEFECT: the rule gates on the ARITHMETIC confirmation, ' +
          'so an edit that breaks the match stops the recompute',
    from: '          if (!isAnchoredTotalRowLabel(row[0])) return;',
    to:   '          if (!isTot) return;',
    expect: ['C1'],
  },
  {
    name: 'the kept-figure guardian is switched off, so an unreproduced filed ' +
          'total is silently republished',
    from: "      ({ column, type: 'columnTotal', keepFiled: true,",
    to:   "      ({ column, type: 'columnTotal', keepFiled: false,",
    expect: ['R4', 'G1', 'G2'],
  },
  {
    name: 'a columnTotal stops being total-only, so the whole column reads as ' +
          "the engine's rather than as source data",
    from: "    return !!d && (d.type === 'weightedMean' || d.type === 'columnTotal');",
    to:   "    return !!d && d.type === 'weightedMean';",
    expect: ['R5'],
  },
  {
    name: 'the probe blanks the whole column again, so the rule sums an empty ' +
          'column and nothing is ever found rebuildable',
    from: '        if (totalOnly[ci] && !totalRole[ri]) return;   /* source data, left alone */\r\n',
    to:   '',
    expect: ['S-STRIP-3'],
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
    /* the ids in this suite are S-STRIP-1 and V2 alike, so the matcher takes
     * letters, digits and dashes rather than the one-letter-one-digit shape */
    const m = /^\s*FAIL\s+([A-Z][A-Z0-9-]*[0-9])\b/.exec(l);
    if (m) red.push(m[1]);
    else if (/^\s*FAIL\s/.test(l)) red.push(l.trim().slice(0, 46));
  });
  return { red, status: r.status };
};

console.log('='.repeat(72));
console.log('  MUTATION CONTROLS: CLCPA-319');
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
