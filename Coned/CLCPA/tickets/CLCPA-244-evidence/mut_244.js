/* Mutation controls for CLCPA-244.
 *
 * The dangerous directions:
 *
 *   THE MARKING REVERTS -- E1's shares become unimportable again, which is the
 *   whole defect.
 *
 *   THE EXEMPTION SPREADS -- a pct column stops being calculated, which would
 *   let an operator type a figure the engine then silently overwrites. Worse
 *   than the defect, and it is why the predicate keys on the rule TYPE.
 *
 *   THE GRAND TOTAL LOSES ITS RULE -- the weighted mean stops being computed
 *   or stops being protected, and a real aggregate becomes typeable.
 *
 *   THE FALLBACK MOVES A STORED YEAR -- getTableSchema is read by the composer
 *   and the report, so this is the gate Emely named.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DIR = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/CLCPA-244-evidence';
const APP = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_244.js';

const M = [
  /* ---- defect 1, reverted ---------------------------------------------- */
  { t: APP, name: 'THE DEFECT: the marking claims every row again',
    from: '      any: (r, c) => !!totals[r] ||\n        (!!derived[c] && !isTotalOnlyDerived(derived[c])),',
    to:   '      any: (r, c) => !!totals[r] || !!derived[c],',
    expect: 'D1d the template leaves all four category cells FILLABLE' },
  { t: APP, name: 'the editor reverts, so the shares go read-only again',
    from: '        if (dDesc && !(isTotalOnlyDerived(dDesc) && !isTotal)) {',
    to:   '        if (dDesc) {',
    expect: 'D1a all four category rows render an EDITABLE percentage' },
  { t: APP, name: 'the predicate never matches',
    from: "    return !!d && d.type === 'weightedMean';",
    to:   '    return false;',
    expect: 'D1a all four category rows render an EDITABLE percentage' },

  /* ---- the exemption spreads ------------------------------------------- */
  { t: APP, name: 'THE SPREAD: every derived column becomes total-row-only',
    from: "    return !!d && d.type === 'weightedMean';",
    to:   '    return !!d;',
    /* a pct column would then be typeable on a data row and silently
     * overwritten by the engine on the next recompute */
    expect: 'D1x2 not one cell changes its calculated marking' },
  { t: APP, name: 'the predicate keys on the TABLE instead of the rule',
    from: "    return !!d && d.type === 'weightedMean';",
    to:   "    return !!d && d.column === 2;",
    /* column 2 is a pct column in G1-G10, J5, J9, F2 and F8 */
    expect: 'D1x2 not one cell changes its calculated marking' },
  { t: APP, name: 'the editor exempts a total row as well as a body row',
    from: '        if (dDesc && !(isTotalOnlyDerived(dDesc) && !isTotal)) {',
    to:   '        if (dDesc && !isTotalOnlyDerived(dDesc)) {',
    /* BEHAVIOURALLY INVISIBLE on this payload: the Grand Total then renders
     * through the isTotal branch instead, and for a numeric column the two
     * produce byte-identical markup. Caught structurally by S10 instead, and
     * the coincidence is recorded rather than papered over. */
    expect: 'S10 the editor exempts a total-row-only rule ONLY on a body row' },
  { t: APP, name: 'the template stops marking the Grand Total',
    from: '      any: (r, c) => !!totals[r] ||\n        (!!derived[c] && !isTotalOnlyDerived(derived[c])),',
    to:   '      any: (r, c) => (!!derived[c] && !isTotalOnlyDerived(derived[c])),',
    expect: 'D1e and still writes (calculated) on the Grand Total' },

  /* ---- the rule itself must not be edited ------------------------------ */
  { t: APP, name: 'DERIVED_COLS is edited instead of the marking',
    from: '      E1: [wmean(2, 1, 2)],',
    to:   '      E1: [],',
    /* this would "fix" the editor by deleting the Grand Total's rule */
    expect: 'S9 and DERIVED_COLS itself is unchanged' },
  { t: APP, name: 'the weighted mean becomes a plain ratio',
    from: '      E1: [wmean(2, 1, 2)],',
    to:   "      E1: [pct(2, [1], [1], 'row', 2)],",
    expect: 'S9 and DERIVED_COLS itself is unchanged' },

  /* ---- defect 2 --------------------------------------------------------- */
  { t: APP, name: 'THE FOSSIL: the fallback takes the first key again',
    from: '      const years = Object.keys(table.schema_by_year)\n        .filter(y => Array.isArray(table.schema_by_year[y]))\n        .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));\n      if (years.length) return table.schema_by_year[years[0]].slice();',
    to:   '      const anyYear = Object.keys(table.schema_by_year)[0];\n      if (anyYear) return table.schema_by_year[anyYear].slice();',
    expect: 'D2a a fresh year now borrows 2025s heading' },
  { t: APP, name: 'the sort runs ascending, so it takes the oldest',
    from: '        .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));',
    to:   '        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));',
    expect: 'D2a a fresh year now borrows 2025s heading' },
  { t: APP, name: 'THE GATE: the fallback fires even when the year HAS a schema',
    from: '    if (table.schema_by_year && table.schema_by_year[year]) {\n      return table.schema_by_year[year].slice();\n    }',
    to:   '    if (false) {\n      return table.schema_by_year[year].slice();\n    }',
    /* every stored year would then be served the newest schema instead of its
     * own -- the composer and the report read this function */
    expect: 'D2f NOT ONE of them changes' },
  { t: APP, name: 'the sort is lexical, which breaks at a century boundary',
    from: '        .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));',
    to:   '        .sort().reverse();',
    /* I declared this a blind spot and was WRONG: lexical order works for
     * 2023-2025 so no behavioural guard sees it, but the structural pin does.
     * Promoted to a real control. */
    expect: 'S5 getTableSchema sorts its fallback years descending' },

  /* ---- the harness itself ---------------------------------------------- */
  { t: SUITE, name: 'HARNESS: the gate stops exercising the fallback',
    from: "    ['2099', '2098'].forEach(y => {",
    to:   "    [].forEach(y => {",
    /* D2f would then pass while testing nothing about fallbacks */
    expect: 'D2g and the fallback path was actually exercised' },
  { t: SUITE, name: 'HARNESS: the Grand Total is checked against the engine',
    from: '  let num = 0, den = 0;\n  SOURCE.forEach(i => { num += E1[i][1] * E1[i][2]; den += E1[i][1]; });\n  const want = num / den;',
    to:   '  const ref = E1.map(r => r.slice());\n  NEW.recomputeTotals(ref, E1SC, "E1", []);\n  const want = ref[GRAND][2];',
    /* engine-to-engine again, the CLCPA-240 lesson. Declared a blind spot
     * first, then given a guard: S11 asserts the oracle computes its own
     * expectation. A blind spot that can be closed should be. */
    expect: 'S11 and the weighted-mean check computes its own expectation' },
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '18f11e2';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'S12 the baseline is a literal commit sha' },
];

let caught = 0, missed = 0, expectedMisses = 0;
const report = [];
M.forEach((m) => {
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  const predicted = m.expect === 'NOT EXPECTED TO BE CAUGHT';
  if (n !== 1) {
    report.push('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED');
    missed++; return;
  }
  fs.writeFileSync(m.t, base.replace(from, () => to));
  let out = '';
  try { out = execFileSync('node', ['suite_244.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }

  const fails = (out.match(/^  FAIL .*$/gm) || []);
  if (predicted) {
    /* A KNOWN BLIND SPOT, declared in advance rather than discovered. Listing
     * it as a guard would be a lie; leaving it out entirely would hide it. */
    report.push((fails.length ? '  red  ' : '  blind ') + m.name +
      '  -- DECLARED BLIND SPOT' + (fails.length ? ', but something caught it' : ''));
    expectedMisses++;
    return;
  }
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
try { cleanOut = execFileSync('node', ['suite_244.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { cleanOk = false; cleanOut = (e.stdout || '') + (e.stderr || ''); }

console.log('======================================================================');
console.log('CLCPA-244 -- mutation controls');
console.log('======================================================================');
report.forEach(l => console.log(l));
console.log('');
console.log('  ' + caught + ' caught, ' + missed + ' not caught, of ' +
  (M.length - expectedMisses) + ' guards');
console.log('  ' + expectedMisses + ' declared blind spot(s), listed above and in the ticket');
console.log('  clean re-run against byte-restored source: ' +
  (cleanOk ? 'PASSES -- ' + (cleanOut.match(/\d+ passed, \d+ failed/) || [''])[0] : 'FAILED'));
if (!cleanOk) console.log(cleanOut.split('\n').filter(l => /FAIL/.test(l)).join('\n'));
try {
  fs.writeFileSync(DIR + '/mut-244-output.txt', [
    '======================================================================',
    'CLCPA-244 -- mutation controls',
    '======================================================================',
  ].concat(report).concat(['',
    '  ' + caught + ' caught, ' + missed + ' not caught, of ' + (M.length - expectedMisses) + ' guards',
    '  ' + expectedMisses + ' declared blind spot(s)',
    '  clean re-run against byte-restored source: ' +
      (cleanOk ? 'PASSES -- ' + (cleanOut.match(/\d+ passed, \d+ failed/) || [''])[0] : 'FAILED'),
  ]).join('\n') + '\n');
} catch (e) { /* stdout is the record */ }
process.exitCode = (missed || !cleanOk) ? 1 : 0;
