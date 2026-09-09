/* Mutation controls for CLCPA-240 second half.
 *
 * The controls that matter most are the ones that WIDEN the branch, because a
 * widening is how this fix would reopen CLCPA-209. Each of the three guards --
 * "no numbers", "whole label", "not already flagged" -- is removed in turn, and
 * the payload-wide equivalence assertion is what catches them.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DIR = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/CLCPA-240-evidence';
const APP = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
/* the suite itself, for the one control that attacks the HARNESS */
const SUITE = DIR + '/suite_240b.js';

const M = [
  /* ---- the fix, removed outright ------------------------------------- */
  { t: APP, name: 'THE FIX IS REVERTED: the branch is deleted',
    from: "    for (let i = 0; i < rows.length; i++) {\n      if (out[i]) continue;\n      if (hasNumbers(rows[i])) continue;\n      if (!Array.isArray(rows[i]) || !isStrictTotalRowLabel(rows[i][0])) continue;\n      out[i] = true;\n    }\n",
    to:   "",
    expect: 'the Total row IS recognised now' },

  /* ---- WIDENINGS: each one reopens CLCPA-209's failure mode ---------- */
  { t: APP, name: 'WIDENED: the no-numbers guard is dropped',
    from: "      if (hasNumbers(rows[i])) continue;",
    to:   "      if (false) continue;",
    /* now it can fire on a row that HOLDS a value: the 209 defect class */
    expect: 'NOT ONE classification differs from BASE' },
  { t: APP, name: 'WIDENED: the whole-label match becomes a substring match',
    from: "      if (!Array.isArray(rows[i]) || !isStrictTotalRowLabel(rows[i][0])) continue;",
    to:   "      if (!Array.isArray(rows[i]) || !/total/i.test(String(rows[i][0]))) continue;",
    /* isTotalRowLabel, the predicate CLCPA-209 retired, in all but name */
    expect: 'NOT ONE classification differs from BASE' },
  /* THE GUARDS OVERLAP, AND TWO CONTROLS PROVED IT BY GOING GREEN.
   *
   * Removing `if (out[i]) continue;` on its own changes nothing: a row the
   * arithmetic flagged necessarily HAS numbers, so the no-numbers guard has
   * already skipped it. And weakening the whole-label match to a start-anchored
   * one changes nothing either: the rows that would newly match -- J1 and J2's
   * "Total amount of residential ... usage", the CLCPA-200 pair -- both hold
   * numbers, so the no-numbers guard blocks them.
   *
   * Each guard is redundant against SOME attack and load-bearing against
   * others. That is defence in depth. Keeping those two as live controls would
   * be keeping two assertions that cannot fail, so they are recorded here and
   * the control below -- both guards removed together -- is the one that must
   * go red. */
  { t: APP, name: 'WIDENED: both guards dropped at once (this one MUST go red)',
    from: "      if (hasNumbers(rows[i])) continue;\n      if (!Array.isArray(rows[i]) || !isStrictTotalRowLabel(rows[i][0])) continue;",
    to:   "      if (!Array.isArray(rows[i])) continue;",
    expect: 'NOT ONE classification differs from BASE' },

  /* ---- NARROWINGS: the fix stops working ---------------------------- */
  { t: APP, name: 'NARROWED: it requires numbers, so it can never fire',
    from: "      if (hasNumbers(rows[i])) continue;",
    to:   "      if (!hasNumbers(rows[i])) continue;",
    expect: 'the Total row IS recognised now' },
  { t: APP, name: 'NARROWED: it marks the row false instead of true',
    from: "      out[i] = true;",
    to:   "      out[i] = false;",
    expect: 'the Total row IS recognised now' },
  { t: APP, name: 'the branch runs BEFORE the arithmetic instead of after',
    from: "    for (let i = 0; i < rows.length; i++) {\n      if (out[i]) continue;\n      if (hasNumbers(rows[i])) continue;\n      if (!Array.isArray(rows[i]) || !isStrictTotalRowLabel(rows[i][0])) continue;\n      out[i] = true;\n    }\n    return out;",
    to:   "    return out;",
    expect: 'the Total row IS recognised now' },

  /* ---- the downstream chain ----------------------------------------- */
  { t: APP, name: 'recomputeTotals classifies the BASELINE, never the draft',
    from: "    const classifySrc = aligned ? baseline : draft;",
    to:   "    const classifySrc = baseline;",
    /* a freshly imported year has no aligned baseline; classifying it would
     * throw or classify nothing, so the bootstrap never completes */
    expect: 'recomputeTotals fills Total Funds Expended' },
  { t: APP, name: 'the derived column stops computing for a flagged total',
    from: "    const totalFlags = totalRowFlags(clone, tableId, schema);\n    const nonTotal = clone.filter((r, i) => !totalFlags[i]);",
    to:   "    const totalFlags = totalRowFlags(clone, tableId, schema);\n    const nonTotal = clone.slice();",
    expect: 'the change to rowsForDisplay is accounted for' },

  /* ---- the cosmetic ------------------------------------------------- */
  { t: APP, name: 'THE SUFFIX RETURNS: the year reads "2099 - added" again',
    from: "    const yearOpts = years.map(y =>\n      `<option value=\"${y}\"${y === i.year ? ' selected' : ''}>${y}</option>`\n    ).join('');",
    to:   "    const yearOpts = years.map(y => {\n      const isAdded = addedYears.includes(y);\n      const label = isAdded ? y + ' \u00b7 added' : y;\n      return `<option value=\"${y}\"${y === i.year ? ' selected' : ''}>${label}</option>`;\n    }).join('');",
    expect: 'no " \u00b7 added" is emitted' },
  { t: APP, name: 'addedYears is removed too, breaking the Remove-year button',
    from: "    const addedYears = Storage.getAddedYears();",
    to:   "    const addedYearsX = Storage.getAddedYears();",
    expect: 'addedYears is still read, because the Remove-year button needs it' },
  { t: APP, name: 'the option loses the selected attribute',
    from: "      `<option value=\"${y}\"${y === i.year ? ' selected' : ''}>${y}</option>`",
    to:   "      `<option value=\"${y}\">${y}</option>`",
    expect: 'the option renders the year and nothing else' },

  /* ---- exclusions --------------------------------------------------- */
  { t: APP, name: 'EXCLUSION: the whole-label predicate itself is loosened',
    from: "    return /^(grand\\s+|sub)?totals?$/i.test(String(label).trim());",
    to:   "    return /total/i.test(String(label).trim());",
    expect: 'isStrictTotalRowLabel is byte-identical to BASE' },
  /* THE NAME MATTERS: this control reported ANCHOR 0, which is how the suite's
   * vacuous `grab('planIngestImport') === grab('planIngestImport', BASE)` was
   * found -- null === null on both sides. The planner is buildIngestImport. */
  { t: APP, name: 'EXCLUSION: the import planner is touched (the matcher half)',
    from: "  function buildIngestImport(fileRows, schema, draft, tableId) {",
    to:   "  function buildIngestImport(fileRows, schema, draft, tableId) {\n    void 0;",
    expect: 'buildIngestImport is byte-identical to BASE' },
  { t: SUITE, name: 'a name in the exclusion list is misspelled (the vacuous-pin class)',
    from: "   'applyIngestImport', 'composePayloadFromRows', 'computeHeaderCards',",
    to:   "   'applyIngestImportX', 'composePayloadFromRows', 'computeHeaderCards',",
    /* the non-null check must turn a typo into a FAILURE, not a silent pass */
    expect: 'exists in both sources, so comparing them means something' },
  { t: APP, name: 'EXCLUSION: DAC_SOURCE is flipped back',
    from: "  var DAC_SOURCE = 'dataverse';",
    to:   "  var DAC_SOURCE = 'payload';",
    expect: "DAC_SOURCE is still 'dataverse'" },
  { t: APP, name: 'EXCLUSION: a third function is changed',
    from: "  function rowsForDisplay(rawRows, schema, tableId) {",
    to:   "  function rowsForDisplay(rawRows, schema, tableId) {\n    void 0;",
    expect: 'exactly TWO functions changed' },
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
    report.push('  ??? ' + m.name + ' -- ANCHOR ' + n + ', NOT APPLIED');
    missed++; return;
  }
  fs.writeFileSync(m.t, base.replace(from, () => to));
  let out = '';
  try { out = execFileSync('node', ['suite_240b.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }

  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const hit = fails.filter(l => l.indexOf(m.expect) >= 0);
  if (hit.length) {
    report.push('  red  ' + m.name);
    report.push('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 110));
    caught++;
  } else if (fails.length) {
    report.push('  ??? ' + m.name + ' -- ' + fails.length + ' red, not the expected one');
    report.push('       want: ' + m.expect);
    report.push('       got : ' + fails[0].trim().slice(5, 110));
    missed++;
  } else {
    report.push('  GREEN ' + m.name + ' -- NOT NOTICED. Not a guard.');
    missed++;
  }
});

let cleanOk = true;
try { execFileSync('node', ['suite_240b.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) {
  cleanOk = false;
  console.error('THE CLEAN RE-RUN FAILED.');
  console.error((e.stdout || '').split('\n').filter(l => /FAIL/.test(l)).join('\n'));
}

console.log('======================================================================');
console.log('CLCPA-240 second half -- mutation controls');
console.log('======================================================================');
report.forEach(l => console.log(l));
console.log('');
console.log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length);
console.log('  clean re-run against restored source: ' + (cleanOk ? 'PASSES' : 'FAILED'));
process.exitCode = (missed || !cleanOk) ? 1 : 0;
