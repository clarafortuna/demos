/* Mutation controls for CLCPA-240 first half, ROUND 2.
 *
 * The dangerous directions here are not "the lock is missing". They are:
 *
 *   THE MARKER BREAKS THE ROUND TRIP. Round 1 made blank header cells the
 *   structural signal the importer reads. Any change that lets (no value) stop
 *   counting as shape-blank, or lets (calculated) start counting as shape-blank,
 *   silently undoes the build that shipped an hour ago. Four controls.
 *
 *   THE LOCK SPREADS. A rule that locks more than group headers and confirmed
 *   totals takes the page away from the operator, which is worse than the
 *   defect it fixes. Controls for the family scope, for data rows, and for a
 *   newly added row.
 *
 *   THE MARKER BECOMES DATA. Either marker parsed into a cell is the round-1
 *   defect returning in a new costume.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DIR = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/CLCPA-240-evidence';
const APP = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_240a_r2.js';

const M = [
  /* ---- the marker, in both predicates ---------------------------------- */
  { t: APP, name: 'THE ROUND TRIP: (no value) stops counting as shape-blank',
    from: '    return s === \'\' || s === INGEST_NOVALUE_MARKER;',
    to:   '    return s === \'\';',
    /* Corrected prediction: the header rows in a downloaded file then read as
     * ORDINARY rows, so A5's six "HVAC" rows collide inside one group and the
     * file is rejected outright. R2 fires before R4 is ever reached -- the
     * round trip does not degrade quietly, it stops. */
    expect: 'R2 the importer still ACCEPTS the marked file' },
  { t: APP, name: 'THE ROUND TRIP: (calculated) starts counting as shape-blank',
    from: '    return s === \'\' || s === INGEST_NOVALUE_MARKER;',
    to:   '    return s === \'\' || s === INGEST_NOVALUE_MARKER || s === INGEST_CALC_MARKER;',
    /* round 1s defect exactly: every total row reads as a header */
    expect: 'M2 (calculated) is NOT shape-blank' },
  { t: APP, name: 'the two predicates are collapsed into one',
    from: '  function ingestIsShapeBlank(v) {\n    if (v == null) return true;\n    const s = String(v).trim();\n    return s === \'\' || s === INGEST_NOVALUE_MARKER;\n  }',
    to:   '  function ingestIsShapeBlank(v) {\n    return ingestIsBlankCell(v);\n  }',
    expect: 'M2 (calculated) is NOT shape-blank' },
  { t: APP, name: 'the marker stops being "not operator input" for KEYS',
    from: '    return s === \'\' || s === INGEST_CALC_MARKER || s === INGEST_NOVALUE_MARKER;',
    to:   '    return s === \'\' || s === INGEST_CALC_MARKER;',
    expect: 'M5 BOTH markers count as "not operator input"' },

  /* ---- the marker must never become data ------------------------------- */
  { t: APP, name: 'THE MARKER BECOMES DATA: the import stops skipping (no value)',
    from: '        if (String(raw).trim() === INGEST_NOVALUE_MARKER) {',
    to:   '        if (false) {',
    expect: 'M10 neither marker lands in any cell' },
  { t: APP, name: 'the skip is silent: the cell is dropped with no report',
    /* My first version of this mutation referenced an identifier that is not
     * in scope there, so it failed to build rather than failing an assertion
     * -- a broken control, which reports as "not the expected one" and is
     * worth no more than a green one. */
    from: '          res.notTouched.computed.push(Object.assign({\n            why: \'this row is a group heading, so it holds no values\',\n          }, where));\n          return;',
    to:   '          return;',
    expect: 'M13 and it is REPORTED, not silently dropped' },

  /* ---- the template ---------------------------------------------------- */
  { t: APP, name: 'THE ORIGINAL FINDING: headers go back to unmarked blanks',
    from: '        if (isGroupHeader) return { style: style, text: INGEST_NOVALUE_MARKER };',
    to:   '        if (isGroupHeader) return { style: style, text: null };',
    expect: 'R1 all 9 group headers are marked' },
  { t: APP, name: 'the marker is written into TOTAL rows as well',
    from: '        if (isGroupHeader) return { style: style, text: INGEST_NOVALUE_MARKER };\n        if (computed.any(idx, c)) {',
    to:   '        if (isGroupHeader || isTotal) return { style: style, text: INGEST_NOVALUE_MARKER };\n        if (computed.any(idx, c)) {',
    expect: 'T3 headers marked (no value), totals still (calculated)' },
  { t: APP, name: 'the marker leaks into flat tables',
    from: '      const isGroupHeader = ingestIsHeaderRow(row, [0]);',
    to:   '      const isGroupHeader = true;',
    expect: 'T4 no flat table template carries the marker' },
  { t: APP, name: 'the calculated branch is tested first again',
    from: '        if (isGroupHeader) return { style: style, text: INGEST_NOVALUE_MARKER };\n        if (computed.any(idx, c)) {\n          return { style: style, text: INGEST_CALC_MARKER };\n        }',
    to:   '        if (computed.any(idx, c)) {\n          return { style: style, text: INGEST_CALC_MARKER };\n        }\n        if (isGroupHeader) return { style: style, text: INGEST_NOVALUE_MARKER };',
    /* A5s derived column would then stamp (calculated) into a header again */
    expect: 'R1 all 9 group headers are marked' },
  { t: APP, name: 'the instructions stop explaining the marker',
    from: '        \'Some tables group their rows under a heading, and a heading row is \' +',
    to:   '        \'PLACEHOLDER. \' +',
    /* This was GREEN until T6 got specific: the rest of the same paragraph
     * still contained the word "heading", so a /heading/i test could not tell
     * the explanation had been deleted. */
    expect: 'T6 and says in so many words that a heading row is marked' },

  /* ---- the editor lock ------------------------------------------------- */
  { t: APP, name: 'THE FINDING: the lock is reverted',
    from: '      const isHeaderRow = rowIdx < headerRowCount || isGroupHeaderRow(row);',
    to:   '      const isHeaderRow = rowIdx < headerRowCount;',
    expect: 'L2 not one of the 9 group headers has an input' },
  { t: APP, name: 'the delete button comes back on locked rows',
    from: '        <td class="ingest-td-actions">${(isHeaderRow || lockTotalRow) ? \'\'',
    to:   '        <td class="ingest-td-actions">${false ? \'\'',
    expect: 'L3 and not one has a delete button' },
  { t: APP, name: 'THE LOCK SPREADS: every row in the family locks',
    from: '    const isGroupHeaderRow = (row) => isHierFamily && Array.isArray(row) &&\n      !!groupHeaderLabels[normIngestKey(row[0])] && !rowHasNumber(row);',
    to:   '    const isGroupHeaderRow = (row) => isHierFamily && Array.isArray(row);',
    expect: 'L9 every one of them KEEPS its inputs' },
  { t: APP, name: 'THE LOCK SPREADS: the family scope is dropped',
    from: '    const isHierFamily = !!(i.tableId && HIERARCHICAL_TABLES[i.tableId]);',
    to:   '    const isHierFamily = true;',
    expect: 'F2 every one is byte-identical to BASE' },
  { t: APP, name: 'THE LOCK SPREADS: identification moves to the DRAFT shape',
    from: '      !!groupHeaderLabels[normIngestKey(row[0])] && !rowHasNumber(row);',
    to:   '      !ingestIsHeaderRow(row, [0]) === false;',
    /* a row the operator is still filling in would lock on the next render */
    expect: 'N2 a label that is NOT in the baseline stays editable' },
  { t: APP, name: 'the "holds no number" condition is dropped',
    from: '      !!groupHeaderLabels[normIngestKey(row[0])] && !rowHasNumber(row);',
    to:   '      !!groupHeaderLabels[normIngestKey(row[0])];',
    expect: 'N6 and the "holds no number" condition is what keeps a DATA row' },
  /* DELETED in round 3, with the reason kept. This control mutated the header
   * set to read the DRAFT instead of the baseline, on the premise that reading
   * the draft was the defect. Round 3 established the opposite: the baseline is
   * EMPTY on a year imported but not yet saved, so the draft is a legitimate
   * fallback and reading it is the fix, not the bug. The risk that replaced it
   * -- using the fallback even when a baseline exists -- is covered by
   * mut_240a_r3's "the fallback is skipped whenever the baseline exists as an
   * array". A control whose premise is gone is a dead control. */

  /* ---- the total-row half (item 2) ------------------------------------- */
  { t: APP, name: 'ITEM 2 REVERTED: a total row label is editable again',
    from: '        if (colIdx === 0 && lockTotalRow) {',
    to:   '        if (false) {',
    expect: 'L6 their LABELS are locked too' },
  { t: APP, name: 'ITEM 2 SPREADS: flat-table totals get locked too',
    /* Anchor repointed: round 3 added the label condition to this line. */
    from: '      const lockTotalRow = isTotal && isHierFamily && !isHeaderRow &&\n        isHierarchicalTotalLabel(row[0]);',
    to:   '      const lockTotalRow = isTotal && !isHeaderRow &&\n        isHierarchicalTotalLabel(row[0]);',
    /* CLCPA-205 item 2 is a pending decision on the all-totals tables and this
     * round must not pre-empt it */
    expect: 'F4 its label is still editable, because A1 is not in the family' },
  { t: APP, name: 'the locked label is rendered as an input anyway',
    from: '          return `<td class="ingest-td-calc"><span class="ingest-cell-calc ingest-cell-calc-text" data-row="${rowIdx}" data-col="${colIdx}">${escapeHtml(text)}</span></td>`;\n        }\n        if (colIdx === 0) {',
    to:   '          return `<td class="ingest-td-label"><input type="text" value="${escapeHtml(text)}" data-row="${rowIdx}" data-col="0" class="ingest-cell ingest-cell-label" /></td>`;\n        }\n        if (colIdx === 0) {',
    expect: 'L6 their LABELS are locked too' },

  /* ---- the shared declaration ----------------------------------------- */
  { t: APP, name: 'the family set is duplicated instead of shared',
    from: '    const isHierFamily = !!(i.tableId && HIERARCHICAL_TABLES[i.tableId]);',
    to:   '    const isHierFamily = !!(i.tableId && { A5: 1, A6: 1, A7: 1, A8: 1 }[i.tableId]);',
    expect: 'S5 the editor reads the shared set rather than its own copy' },
  { t: APP, name: 'a table leaves the family',
    from: '  const HIERARCHICAL_TABLES = { A5: true, A6: true, A7: true, A8: true };',
    to:   '  const HIERARCHICAL_TABLES = { A5: true, A6: true, A8: true };',
    expect: 'S1 HIERARCHICAL_TABLES is declared once at module scope' },
  { t: APP, name: 'the marker string is inlined rather than named',
    from: '  const INGEST_NOVALUE_MARKER = \'(no value)\';',
    to:   '  const INGEST_NOVALUE_MARKER = \'(no values)\';',
    expect: 'S3 the marker is one constant' },

  /* ---- CSS must not move ---------------------------------------------- */
  { t: 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/styles.css',
    name: 'styles.css is touched, when the whole point is that it need not be',
    from: '.ingest-row-subheader td {',
    to:   '.ingest-row-subheader td { outline: 0;',
    expect: 'S8 styles.css is byte-identical to BASE' },

  /* ---- the harness itself --------------------------------------------- */
  { t: SUITE, name: 'HARNESS: the baseline is repointed at the working tree',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '438bf64';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    /* HEAD is the round-1 build while this is uncommitted, so the effect is
     * invisible; what catches it is that BASE must be a literal sha */
    expect: 'S9 the baseline in this file is a literal commit sha' },
  { t: SUITE, name: 'HARNESS: the lock check looks for a class instead of an input',
    from: 'const hasInput = (tr) => /<input/.test(tr);',
    to:   'const hasInput = (tr) => /ingest-row-subheader/.test(tr) === false && false;',
    /* a CSS class is not the absence of an input -- the CLCPA-226 lesson */
    expect: 'L11 on BASE all 9 group headers had editable inputs' },
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
  try { out = execFileSync('node', ['suite_240a_r2.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }

  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const hit = fails.filter(l => l.indexOf(m.expect) >= 0);
  if (hit.length) {
    report.push('  red  ' + m.name);
    report.push('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 106));
    caught++;
  } else if (fails.length) {
    report.push('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    report.push('       want: ' + m.expect);
    report.push('       got : ' + fails[0].trim().slice(5, 106));
    missed++;
  } else {
    report.push('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.');
    missed++;
  }
});

let cleanOk = true, cleanOut = '';
try { cleanOut = execFileSync('node', ['suite_240a_r2.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { cleanOk = false; cleanOut = (e.stdout || '') + (e.stderr || ''); }

console.log('======================================================================');
console.log('CLCPA-240 first half, ROUND 2 -- mutation controls');
console.log('======================================================================');
report.forEach(l => console.log(l));
console.log('');
console.log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length);
console.log('  clean re-run against byte-restored source: ' +
  (cleanOk ? 'PASSES -- ' + (cleanOut.match(/\d+ passed, \d+ failed/) || [''])[0] : 'FAILED'));
if (!cleanOk) console.log(cleanOut.split('\n').filter(l => /FAIL/.test(l)).join('\n'));
try {
  fs.writeFileSync(DIR + '/mut-240a-r2-output.txt', [
    '======================================================================',
    'CLCPA-240 first half, ROUND 2 -- mutation controls',
    '======================================================================',
  ].concat(report).concat(['',
    '  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length,
    '  clean re-run against byte-restored source: ' +
      (cleanOk ? 'PASSES -- ' + (cleanOut.match(/\d+ passed, \d+ failed/) || [''])[0] : 'FAILED'),
  ]).join('\n') + '\n');
} catch (e) { /* stdout is still the record */ }
process.exitCode = (missed || !cleanOk) ? 1 : 0;
