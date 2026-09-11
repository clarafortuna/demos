/* Mutation controls for CLCPA-240 first half, ROUND 4.
 *
 * The directions that matter here:
 *
 *   THE VETO IS GONE -- back to Emely's screen, 14,985 where the group holds
 *   1,998.
 *
 *   THE VETO ESCAPES ITS FOUR TABLES -- a label rule applied to the other 48
 *   is CLCPA-209 in a new costume, because 94 rows there say "total" and are
 *   correctly not flagged.
 *
 *   THE VETO EATS A REAL TOTAL -- worse than the defect, because a group total
 *   would stop computing entirely.
 *
 *   THE ORACLE STOPS BEING INDEPENDENT. This is the one that matters most for
 *   the long run: three rounds passed this screen because every assertion
 *   about a total went through the engine on both sides. If the oracle ever
 *   borrows from app.js again, the suite is decorative.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DIR = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/CLCPA-240-evidence';
const APP = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_240a_r4.js';

const M = [
  /* ---- the veto removed ------------------------------------------------ */
  { t: APP, name: 'EMELYS SCREEN: the veto is removed',
    from: '      for (let i = 0; i < rows.length; i++) {\n        if (!out[i]) continue;\n        if (!isHierarchicalTotalLabel((rows[i] || [])[0])) out[i] = false;\n      }',
    to:   '',
    expect: 'V2 uniform: every group and grand total equals the sum this suite computed itself' },
  { t: APP, name: 'the veto is inverted: only UNlabelled rows survive',
    from: '        if (!isHierarchicalTotalLabel((rows[i] || [])[0])) out[i] = false;',
    to:   '        if (isHierarchicalTotalLabel((rows[i] || [])[0])) out[i] = false;',
    /* vetoing every real total changes which rows recomputeTotals touches and
     * reaches a path the probe does not, so it surfaces as a THROW rather than
     * as V4. Caught either way, and named for what it does. */
    expect: 'V: uniform figures THREW' },
  { t: APP, name: 'the veto only clears rows that hold no numbers',
    from: '        if (!isHierarchicalTotalLabel((rows[i] || [])[0])) out[i] = false;',
    to:   '        if (!hasNumbers(rows[i]) && !isHierarchicalTotalLabel((rows[i] || [])[0])) out[i] = false;',
    /* the mis-flagged data rows all HOLD values, so this reaches none of them */
    expect: 'V3 uniform: no DATA row is flagged as a total' },

  /* ---- the veto escapes its scope -------------------------------------- */
  { t: APP, name: 'CLCPA-209 DIRECTION: the veto moves outside the family branch',
    from: '      for (let i = 0; i < rows.length; i++) {\n        if (!out[i]) continue;\n        if (!isHierarchicalTotalLabel((rows[i] || [])[0])) out[i] = false;\n      }\n    }\n    return out;',
    to:   '    }\n    for (let i = 0; i < rows.length; i++) {\n      if (!out[i]) continue;\n      if (!isHierarchicalTotalLabel((rows[i] || [])[0])) out[i] = false;\n    }\n    return out;',
    /* On STORED data a veto outside the family is a no-op -- nothing there
     * is flagged without the word -- so only the structural pin can see the
     * scope being lost. */
    expect: 'S2b and the veto sits INSIDE it' },
  { t: APP, name: 'a flat table joins the family',
    from: '  const HIERARCHICAL_TABLES = { A5: true, A6: true, A7: true, A8: true };',
    to:   '  const HIERARCHICAL_TABLES = { A5: true, A6: true, A7: true, A8: true, D2: true };',
    /* invisible on stored data; the fresh-import parity guard is where D2s
     * total-labelled rows come within reach */
    expect: 'O5 and on a simulated fresh import not one of them flags differently' },
  { t: APP, name: 'a table LEAVES the family, so its screen breaks again',
    from: '  const HIERARCHICAL_TABLES = { A5: true, A6: true, A7: true, A8: true };',
    to:   '  const HIERARCHICAL_TABLES = { A6: true, A7: true, A8: true };',
    expect: 'V2 uniform: every group and grand total equals the sum this suite computed itself' },

  /* ---- the label rule itself ------------------------------------------- */
  { t: APP, name: 'the label rule becomes a whole-word match',
    from: '    return v != null && /total/i.test(String(v));',
    to:   '    return v != null && /^total$/i.test(String(v));',
    /* A5s totals are "<group> Total" and "Subtotal", so a whole-word rule
     * vetoes every one of them */
    expect: 'V4 uniform: and every real total IS flagged' },
  { t: APP, name: 'the label rule becomes case-sensitive',
    from: '    return v != null && /total/i.test(String(v));',
    to:   '    return v != null && /total/.test(String(v));',
    /* "Subtotal" survives, "<group> Total" does not */
    expect: 'V4 uniform: and every real total IS flagged' },

  /* ---- round 1-3 must not regress -------------------------------------- */
  { t: APP, name: 'the value-less bootstrap is removed, so a fresh import computes nothing',
    from: '        if (!isHierarchicalTotalLabel(rows[i][0])) continue;\n        out[i] = true;',
    to:   '        if (!isHierarchicalTotalLabel(rows[i][0])) continue;\n        out[i] = false;',
    expect: 'V4 uniform: and every real total IS flagged' },
  { t: APP, name: 'the editor lock is touched, when this round must not touch it',
    from: '      const isHeaderRow = rowIdx < headerRowCount || isGroupHeaderRow(row);',
    to:   '      const isHeaderRow = rowIdx < headerRowCount;',
    expect: 'S6 and renderIngestEditor is untouched' },

  /* ---- the harness itself ---------------------------------------------- */
  { t: SUITE, name: 'HARNESS: the oracle borrows the engine it is meant to check',
    from: '  const want = {};\n  let prevTotal = -1;',
    to:   '  const want = {}; void recomputeTotals;\n  let prevTotal = -1;',
    /* the exact failure that let three rounds pass: an assertion about the
     * engine, computed by the engine */
    /* the injected reference is out of scope, so it throws before V8 reads
     * the text; both are the same finding */
    expect: 'V: uniform figures THREW' },
  /* The control that reverted the oracle's `starts` array is GONE, because the
   * array is: once segments were measured from the previous TOTAL rather than
   * the previous header, reverting it changed no answer and the control stayed
   * green. Replaced by one that attacks what the oracle actually rests on --
   * which rows it counts as data. */
  { t: SUITE, name: 'HARNESS: the oracle counts total rows as data',
    from: '  const isData = rows.map((r, i) => !hdrLike(r) && !isTot[i]);',
    to:   '  const isData = rows.map((r, i) => !hdrLike(r));',
    /* It inflates the whole-table sum that only r49 falls back on, and r49
     * was already licensed to differ -- so only the assertion that pins the
     * NUMBERS can see it. */
    expect: 'V13 and the difference is exactly the disclosed one' },
  { t: SUITE, name: 'HARNESS: the oracle measures from the header again',
    from: '    for (let k = prevTotal + 1; k < i; k++) {',
    to:   '    for (let k = 0; k < i; k++) {',
    expect: 'V2 uniform: every group and grand total equals the sum this suite computed itself' },
  { t: SUITE, name: 'HARNESS: only real figures are tested, as before',
    from: "[['uniform', 999], ['real', 0]].forEach(([mode, val]) => {",
    to:   "[['real', 0]].forEach(([mode, val]) => {",
    /* this is what every earlier round did, and it is why the screen shipped
     * three times. A missing test is not a failure, so only the coverage
     * self-check can see it. */
    expect: 'V9 the UNIFORM input really ran' },
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || 'c2a34ee';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'S7 the baseline is a literal commit sha' },
];

let caught = 0, missed = 0;
const report = [];
M.forEach((m) => {
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  if (n !== 1) {
    report.push('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED');
    missed++; return;
  }
  fs.writeFileSync(m.t, base.replace(from, () => to));
  let out = '';
  try { out = execFileSync('node', ['suite_240a_r4.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }

  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const hit = fails.filter(l => l.indexOf(m.expect) >= 0);
  if (hit.length) {
    report.push('  red  ' + m.name);
    report.push('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 104));
    caught++;
  } else if (fails.length) {
    report.push('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    report.push('       want: ' + m.expect);
    report.push('       got : ' + fails[0].trim().slice(5, 104));
    missed++;
  } else {
    report.push('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.');
    missed++;
  }
});

let cleanOk = true, cleanOut = '';
try { cleanOut = execFileSync('node', ['suite_240a_r4.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { cleanOk = false; cleanOut = (e.stdout || '') + (e.stderr || ''); }

console.log('======================================================================');
console.log('CLCPA-240 first half, ROUND 4 -- mutation controls');
console.log('======================================================================');
report.forEach(l => console.log(l));
console.log('');
console.log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length);
console.log('  clean re-run against byte-restored source: ' +
  (cleanOk ? 'PASSES -- ' + (cleanOut.match(/\d+ passed, \d+ failed/) || [''])[0] : 'FAILED'));
if (!cleanOk) console.log(cleanOut.split('\n').filter(l => /FAIL/.test(l)).join('\n'));
try {
  fs.writeFileSync(DIR + '/mut-240a-r4-output.txt', [
    '======================================================================',
    'CLCPA-240 first half, ROUND 4 -- mutation controls',
    '======================================================================',
  ].concat(report).concat(['',
    '  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length,
    '  clean re-run against byte-restored source: ' +
      (cleanOk ? 'PASSES -- ' + (cleanOut.match(/\d+ passed, \d+ failed/) || [''])[0] : 'FAILED'),
  ]).join('\n') + '\n');
} catch (e) { /* stdout is the record */ }
process.exitCode = (missed || !cleanOk) ? 1 : 0;
