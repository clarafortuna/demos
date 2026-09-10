/* Mutation controls for CLCPA-240 first half, ROUND 3.
 *
 * Round 2 failed its hosted pass because the lock read a baseline that is
 * empty on the one screen the feature exists for. The controls therefore
 * attack in three directions:
 *
 *   THE FALLBACK IS GONE OR NEUTERED -- back to round 2's defect, and B3 must
 *   go red on a state nothing had ever rendered before this round.
 *
 *   THE FALLBACK IS TOO EAGER -- it locks a row the operator is still typing,
 *   which is worse than the defect it fixes and is exactly why round 2 used
 *   the baseline in the first place.
 *
 *   FIX 2 IS REVERTED OR WIDENED -- a mis-flagged data row frozen again, or a
 *   real total left open.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DIR = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/CLCPA-240-evidence';
const APP = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_240a_r3.js';

const M = [
  /* ---- the fallback, removed or crippled ------------------------------- */
  { t: APP, name: 'ROUND 2s DEFECT: the draft fallback is removed',
    from: '      const rows = i.draft || [];',
    to:   '      const rows = [];',
    expect: 'B3 not one of them has an input, with NOTHING saved yet' },
  { t: APP, name: 'the fallback is skipped whenever the baseline exists as an array',
    from: '      if (base.length) {',
    to:   '      if (base) {',
    expect: 'B3 not one of them has an input, with NOTHING saved yet' },
  /* REMOVED, not left as a miss: I originally had a control for dropping an
   * "or a total-labelled row" alternative from the follow-scan. That
   * alternative changed no outcome anywhere -- in an all-blank draft every row
   * is shaped like a header, so the scan stops at the first one either way --
   * so the alternative was deleted from app.js instead, and there is nothing
   * left for the control to break. C8 now asserts the limit that exposed it. */
  { t: APP, name: 'the follow-scan runs past the next header',
    from: '        for (let k = idx + 1; k < rows.length && !structural[k]; k++) {',
    to:   '        for (let k = idx + 1; k < rows.length; k++) {',
    /* a group with nothing under it would then borrow a LATER group's values
     * and lock a caption the operator may still be filling in */
    expect: 'C6 a group with nothing under it does NOT lock' },

  /* ---- the fallback, too eager ---------------------------------------- */
  { t: APP, name: 'TOO EAGER: every structural header in the draft locks',
    from: '      rows.forEach((r, idx) => {\n        if (!structural[idx]) return;\n        for (let k = idx + 1; k < rows.length && !structural[k]; k++) {\n          if (rowHasNumber(rows[k])) { out[normIngestKey(r[0])] = true; return; }\n        }\n      });',
    to:   '      rows.forEach((r, idx) => {\n        if (structural[idx]) out[normIngestKey(r[0])] = true;\n      });',
    expect: 'C4 a hand-built table with no values anywhere locks nothing' },
  { t: APP, name: 'TOO EAGER: the holds-no-number condition is dropped',
    from: '      !!groupHeaderLabels[normIngestKey(row[0])] && !rowHasNumber(row);',
    to:   '      !!groupHeaderLabels[normIngestKey(row[0])];',
    /* Corrected prediction: a data row sharing a header's name is then frozen,
     * and D3 is what notices -- not B6, whose rows do not share a name. */
    expect: 'D3 and now none is: a wrong computed number stays correctable' },
  { t: APP, name: 'TOO EAGER: the family scope is dropped',
    from: '    const isHierFamily = !!(i.tableId && HIERARCHICAL_TABLES[i.tableId]);',
    to:   '    const isHierFamily = true;',
    expect: 'F2 every one is byte-identical to BASE' },

  /* ---- fix 2 ---------------------------------------------------------- */
  { t: APP, name: 'FIX 2 REVERTED: the label lock follows the flag alone again',
    from: '      const lockTotalRow = isTotal && isHierFamily && !isHeaderRow &&\n        isHierarchicalTotalLabel(row[0]);',
    to:   '      const lockTotalRow = isTotal && isHierFamily && !isHeaderRow;',
    expect: 'D3 and now none is: a wrong computed number stays correctable' },
  { t: APP, name: 'FIX 2 WIDENED: no total row is locked at all',
    from: '      const lockTotalRow = isTotal && isHierFamily && !isHeaderRow &&\n        isHierarchicalTotalLabel(row[0]);',
    to:   '      const lockTotalRow = false;',
    expect: 'D5 every row the RENDER flagged, whose label says total, is locked' },
  { t: APP, name: 'the label test is inverted',
    from: '  function isHierarchicalTotalLabel(v) {\n    return v != null && /total/i.test(String(v));\n  }',
    to:   '  function isHierarchicalTotalLabel(v) {\n    return v != null && !/total/i.test(String(v));\n  }',
    expect: 'D5 every row the RENDER flagged, whose label says total, is locked' },
  { t: APP, name: 'the shared predicate becomes a whole-word match',
    from: '    return v != null && /total/i.test(String(v));',
    to:   '    return v != null && /^total$/i.test(String(v));',
    /* A5s totals are "<group> Total" and "Subtotal", so a whole-word rule
     * reaches none of them */
    expect: 'D5 every row the RENDER flagged, whose label says total, is locked' },

  /* ---- the round-2 behaviour must survive ----------------------------- */
  { t: APP, name: 'the header lock itself is reverted',
    from: '      const isHeaderRow = rowIdx < headerRowCount || isGroupHeaderRow(row);',
    to:   '      const isHeaderRow = rowIdx < headerRowCount;',
    expect: 'B3 not one of them has an input, with NOTHING saved yet' },
  { t: APP, name: 'the delete button returns on locked rows',
    from: '        <td class="ingest-td-actions">${(isHeaderRow || lockTotalRow) ? \'\'',
    to:   '        <td class="ingest-td-actions">${false ? \'\'',
    expect: 'B4 and not one has a delete button' },
  { t: APP, name: 'the marker stops being shape-blank, so the import breaks again',
    from: '    return s === \'\' || s === INGEST_NOVALUE_MARKER;',
    to:   '    return s === \'\';',
    /* Corrected prediction: the 2099 import is rejected outright, so the B
     * block throws with that message rather than assembly failing. */
    expect: 'the 2099 import did not complete' },
  /* NOT LISTED HERE, and deliberately: "the template stops marking headers".
   * This suite builds its import file itself rather than from the workbook, so
   * a change to the template emitter is invisible to it -- and a control that
   * cannot fail is worth nothing. mut_240a_r2 owns that one and catches it
   * ("THE ORIGINAL FINDING: headers go back to unmarked blanks"), which is the
   * suite that drives buildIngestWorkbook end to end. */

  /* ---- the shared declaration ----------------------------------------- */
  { t: APP, name: 'the editor keeps its own copy of the label rule',
    from: '        isHierarchicalTotalLabel(row[0]);',
    to:   '        /total/i.test(String(row[0]));',
    expect: 'S2b and neither does renderIngestEditor' },
  { t: APP, name: 'totalRowFlags keeps its own copy',
    from: '        if (!isHierarchicalTotalLabel(rows[i][0])) continue;',
    to:   '        if (!/total/i.test(String(rows[i][0] == null ? \'\' : rows[i][0]))) continue;',
    expect: 'S2 totalRowFlags keeps no copy of the regex' },
  { t: APP, name: 'a table leaves the family',
    from: '  const HIERARCHICAL_TABLES = { A5: true, A6: true, A7: true, A8: true };',
    to:   '  const HIERARCHICAL_TABLES = { A6: true, A7: true, A8: true };',
    expect: 'B3 not one of them has an input, with NOTHING saved yet' },

  /* ---- CSS must not move ---------------------------------------------- */
  { t: 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/styles.css',
    name: 'styles.css is touched, when the point is that it need not be',
    from: '.ingest-row-subheader td {',
    to:   '.ingest-row-subheader td { outline: 0;',
    expect: 'S8 styles.css is byte-identical to BASE' },

  /* ---- the harness itself --------------------------------------------- */
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '5b6e57e';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'S9 the baseline is a literal commit sha' },
  { t: SUITE, name: 'HARNESS: state B is rendered with a populated baseline after all',
    from: '  const r = renderWith(NEW, \'A5\', \'2099\', schema99, rows, []);\n  ok(r.count === 50,',
    to:   '  const r = renderWith(NEW, \'A5\', \'2099\', schema99, rows, rows);\n  ok(r.count === 50,',
    /* THIS IS THE MISTAKE THAT LET ROUND 2 SHIP, and it is why B5b exists:
     * handing state B a populated baseline makes every other assertion in the
     * block pass while testing the one state that already worked. Only an
     * assertion about the STATE ITSELF can see it. */
    expect: 'B5b and the baseline this was rendered with really is empty' },
  { t: SUITE, name: 'HARNESS: the lock check looks at a class instead of an input',
    from: 'const hasInput = t => /<input/.test(t);',
    to:   'const hasInput = t => !/ingest-row-subheader/.test(t) && false;',
    expect: 'B7 on BASE all nine headers had an open input' },
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
  try { out = execFileSync('node', ['suite_240a_r3.js'], { cwd: DIR, encoding: 'utf8' }); }
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
try { cleanOut = execFileSync('node', ['suite_240a_r3.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { cleanOk = false; cleanOut = (e.stdout || '') + (e.stderr || ''); }

console.log('======================================================================');
console.log('CLCPA-240 first half, ROUND 3 -- mutation controls');
console.log('======================================================================');
report.forEach(l => console.log(l));
console.log('');
console.log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length);
console.log('  clean re-run against byte-restored source: ' +
  (cleanOk ? 'PASSES -- ' + (cleanOut.match(/\d+ passed, \d+ failed/) || [''])[0] : 'FAILED'));
if (!cleanOk) console.log(cleanOut.split('\n').filter(l => /FAIL/.test(l)).join('\n'));
try {
  fs.writeFileSync(DIR + '/mut-240a-r3-output.txt', [
    '======================================================================',
    'CLCPA-240 first half, ROUND 3 -- mutation controls',
    '======================================================================',
  ].concat(report).concat(['',
    '  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length,
    '  clean re-run against byte-restored source: ' +
      (cleanOk ? 'PASSES -- ' + (cleanOut.match(/\d+ passed, \d+ failed/) || [''])[0] : 'FAILED'),
  ]).join('\n') + '\n');
} catch (e) { /* stdout is the record */ }
process.exitCode = (missed || !cleanOk) ? 1 : 0;
