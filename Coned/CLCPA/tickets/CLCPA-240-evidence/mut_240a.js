/* Mutation controls for CLCPA-240 first half.
 *
 * Each entry breaks ONE thing and names the assertion that must go red. A
 * mutation that leaves the suite green is reported as NOT A GUARD, because an
 * assertion that cannot be made to fail is worse than no assertion.
 *
 * The dangerous directions for this change are all OVER-widening, so they get
 * their own controls rather than being left implied:
 *   - keying without the group, which is the bug being fixed
 *   - dropping the duplicate rejection entirely, which would let a genuinely
 *     ambiguous file half-apply
 *   - letting the substring total match escape its four declared tables, which
 *     is CLCPA-209 reopening
 *   - stamping the calculated marker back into group headers, which is what
 *     made the group unreadable in the first place
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DIR = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/CLCPA-240-evidence';
const APP = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_240a.js';

const M = [
  /* ---- the declarations ------------------------------------------------ */
  { t: APP, name: 'A3/A4 lose their second key column',
    from: '  const INGEST_KEY_COLS = { A3: 2, A4: 2 };',
    to:   '  const INGEST_KEY_COLS = {};',
    expect: 'C1 the importer accepts A3 own template' },
  { t: APP, name: 'the key-column count is DETECTED instead of declared',
    from: '  const INGEST_KEY_COLS = { A3: 2, A4: 2 };',
    to:   '  const INGEST_KEY_COLS = { A3: 2, A4: 2, C1: 6 };',
    expect: 'S1 INGEST_KEY_COLS declares exactly A3:2 and A4:2' },
  { t: APP, name: 'A5 stops being grouped, so the label alone is the key again',
    from: '  const INGEST_GROUPED = { A5: true, A6: true, A8: true };',
    to:   '  const INGEST_GROUPED = { A6: true, A8: true };',
    expect: 'R3 the importer ACCEPTS the file the template wrote' },
  { t: APP, name: 'A7 is added to the grouped set, changing a key it should not',
    from: '  const INGEST_GROUPED = { A5: true, A6: true, A8: true };',
    to:   '  const INGEST_GROUPED = { A5: true, A6: true, A7: true, A8: true };',
    expect: 'S2 INGEST_GROUPED declares exactly A5, A6, A8' },
  { t: APP, name: 'the hierarchical total scope is dropped',
    from: '  const HIERARCHICAL_TOTALS = { A5: true, A6: true, A7: true, A8: true };',
    to:   '  const HIERARCHICAL_TOTALS = {};',
    expect: 'H4 A5:2025 bootstraps' },
  { t: APP, name: 'THE CLCPA-209 DIRECTION: the scope grows to a flat table',
    from: '  const HIERARCHICAL_TOTALS = { A5: true, A6: true, A7: true, A8: true };',
    to:   '  const HIERARCHICAL_TOTALS = { A5: true, A6: true, A7: true, A8: true, D2: true };',
    expect: 'P2 on a simulated FRESH IMPORT the 48 flat tables flag identically to BASE' },
  { t: APP, name: 'THE CLCPA-209 DIRECTION: the branch is gated structurally, not declared',
    from: '    if (tableId && HIERARCHICAL_TOTALS[tableId]) {',
    to:   '    if (starts.length) {',
    expect: 'P4 NONE of those 111 is flagged on a fresh import' },

  /* ---- the key builder -------------------------------------------------- */
  { t: APP, name: 'the group is dropped from the key',
    from: '    const group = grouped ? ingestGroupOf(rows, idx, labelCols) : \'\';',
    to:   '    const group = \'\';',
    expect: 'R3 the importer ACCEPTS the file the template wrote' },
  { t: APP, name: 'only the first key column enters the key',
    from: '      labelCols.map(c => (ingestIsBlankCell(row[c]) ? \'\' : normIngestKey(row[c])))\n        .join(INGEST_KEY_SEP);',
    to:   '      normIngestKey(row[labelCols[0]]);',
    expect: 'C1 the importer accepts A3 own template' },
  { t: APP, name: 'the calculated marker is keyed as literal text again',
    from: '      labelCols.map(c => (ingestIsBlankCell(row[c]) ? \'\' : normIngestKey(row[c])))',
    to:   '      labelCols.map(c => normIngestKey(row[c]))',
    /* Invisible on a FRESH import, which matches nothing, so a wrong key costs
     * nothing there. Guard M2 re-imports into a POPULATED year, which is where
     * it bites. */
    expect: 'M2 A3: it MATCHES all 23 rows' },
  { t: APP, name: 'headers stop having their own namespace, so one can shadow a data row',
    from: '    if (grouped && ingestIsHeaderRow(row, labelCols)) return \'h\' + INGEST_KEY_SEP + label;',
    to:   '    if (false) return \'h\' + INGEST_KEY_SEP + label;',
    /* Unreachable in the frozen payload -- no group header shares a name with a
     * data row -- so guard M4 supplies a file where one does. */
    expect: 'M4 a group header named after a data row is not a collision' },
  { t: APP, name: 'an unkeyable row is given a key anyway',
    from: '    if (!label) return \'\';',
    to:   '    if (!label) return \'r\' + INGEST_KEY_SEP;',
    /* The template never writes an unlabelled row, so guard M8 supplies one. */
    expect: 'M8 and is not created as a row' },
  { t: APP, name: 'the group scan walks DOWN instead of up',
    from: '    for (let i = idx - 1; i >= 0; i--) {\n      if (ingestIsHeaderRow(rows[i], labelCols)) {\n        return normIngestKey(rows[i][labelCols[0]]);\n      }\n    }',
    to:   '    for (let i = idx + 1; i < rows.length; i++) {\n      if (ingestIsHeaderRow(rows[i], labelCols)) {\n        return normIngestKey(rows[i][labelCols[0]]);\n      }\n    }',
    /* A round trip cannot see this: both sides walk the same wrong way and
     * therefore agree. Guard M10 asserts the key against a fixture. */
    expect: 'M10 row 1 keys under g1' },
  { t: APP, name: 'the header test ignores the value cells, so every row is a header',
    from: '      if (row[c] != null && String(row[c]).trim() !== \'\') return false;',
    to:   '      if (false) return false;',
    /* Corrected prediction: this goes red on R3, not on R8 -- the file is
     * rejected as ambiguous before any group index is compared. */
    expect: 'R3 the importer ACCEPTS the file the template wrote' },
  { t: APP, name: 'THE RE-IMPORT DIRECTION: the marker counts as blank for SHAPE again',
    from: '      if (row[c] != null && String(row[c]).trim() !== \'\') return false;',
    to:   '      if (!ingestIsBlankCell(row[c])) return false;',
    /* The defect guard M2 caught: a total row in the file then reads as a group
     * header, matches nothing, and A5 re-imports as 60 rows instead of 50. */
    expect: 'M2 A5: it MATCHES all 50 rows' },
  { t: APP, name: 'the marker stops counting as an empty cell in a KEY',
    from: '    return s === \'\' || s === INGEST_CALC_MARKER;',
    to:   '    return s === \'\';',
    /* Corrected prediction: the marker then lands in A3's key column, so C4 is
     * what notices, not R3. */
    expect: 'C4 every Program Name survives as its own text' },

  /* ---- the duplicate rule ---------------------------------------------- */
  { t: APP, name: 'THE OVER-WIDE DIRECTION: the duplicate rejection is removed',
    from: '    Object.keys(dupLabel).forEach(k => {\n      if (dupLabel[k] > 1) {',
    to:   '    Object.keys(dupLabel).forEach(k => {\n      if (false) {',
    expect: 'D1 two rows identical in group AND label are rejected' },
  { t: APP, name: 'duplicates are counted on the label again, not the composite key',
    from: '      const k = ingestRowKey(body, bi, labelCols, grouped);\n      if (!k) return;\n      dupLabel[k] = (dupLabel[k] || 0) + 1;',
    to:   '      const k = normIngestKey(r[labelCols[0]]);\n      if (!k) return;\n      dupLabel[k] = (dupLabel[k] || 0) + 1;',
    expect: 'R3 the importer ACCEPTS the file the template wrote' },

  /* ---- colMap ----------------------------------------------------------- */
  { t: APP, name: 'a key column falls through to colMap as a VALUE',
    from: '      if (labelCols.indexOf(idx) >= 0 || !h) return;',
    to:   '      if (idx === labelCol || !h) return;',
    expect: 'C6 Program Name is NOT in matchedColumns' },
  { t: APP, name: 'a missing second key column is accepted silently',
    from: '      const fIdx = header.indexOf(normIngestKey(schema[s]));\n      if (fIdx < 0) {',
    to:   '      const fIdx = header.indexOf(normIngestKey(schema[s]));\n      if (false) {',
    /* A3's own template always carries Program Name, so guard M15 feeds a file
     * that does not. */
    expect: 'M16b and it is the MISSING-COLUMN rejection' },

  /* ---- the new-row path ------------------------------------------------- */
  { t: APP, name: 'only the label is carried into a created row',
    from: '        fresh[s] = ingestIsBlankCell(r[c]) ? null : String(r[c]).trim();',
    to:   '        fresh[s] = s === 0 ? String(r[c]).trim() : null;',
    expect: 'C4 every Program Name survives as its own text' },
  { t: APP, name: 'the marker is written into a created key column',
    from: '        fresh[s] = ingestIsBlankCell(r[c]) ? null : String(r[c]).trim();',
    to:   '        fresh[s] = r[c] == null ? null : String(r[c]).trim();',
    expect: 'C4 every Program Name survives as its own text' },

  /* ---- the template ----------------------------------------------------- */
  { t: APP, name: 'THE ORIGINAL DEFECT: headers are stamped (calculated) again',
    from: '        if (!isGroupHeader && computed.any(idx, c)) {',
    to:   '        if (computed.any(idx, c)) {',
    expect: 'R2 all 9 group headers carry NO "(calculated)"' },
  { t: APP, name: 'THE OVER-WIDE DIRECTION: the marker is dropped from every row',
    from: '        if (!isGroupHeader && computed.any(idx, c)) {',
    to:   '        if (false && computed.any(idx, c)) {',
    expect: 'T3 every one of the 282 non-header rows KEEPS its marker' },
  { t: APP, name: 'the header test in the template reads the wrong column',
    from: '      const isGroupHeader = ingestIsHeaderRow(row, [0]);',
    to:   '      const isGroupHeader = ingestIsHeaderRow(row, [1]);',
    expect: 'T2 not one of them is stamped "(calculated)" any more' },

  /* ---- stage 3 ---------------------------------------------------------- */
  { t: APP, name: 'the hierarchical branch requires a strict label after all',
    from: '        if (lbl == null || !/total/i.test(String(lbl))) continue;',
    to:   '        if (lbl == null || !isStrictTotalRowLabel(lbl)) continue;',
    expect: 'H4 A5:2025 bootstraps' },
  { t: APP, name: 'THE MAGNITUDE DIRECTION: the branch stops requiring an empty row',
    from: '        if (hasNumbers(rows[i])) continue;\n        if (!Array.isArray(rows[i])) continue;\n        const lbl = rows[i][0];',
    to:   '        if (!Array.isArray(rows[i])) continue;\n        const lbl = rows[i][0];',
    expect: 'P1 on STORED data the flags are identical to BASE' },
  /* NOT LISTED, and deliberately so: removing `if (out[i]) continue;` from the
   * hierarchical branch cannot change any outcome. The branch only runs on
   * rows holding no number, and setting out[i] = true on a row already true is
   * idempotent. The line stays in the code for symmetry with the branch above
   * it, and it is honestly not a guard -- recorded here rather than left in
   * the list as a permanent uncaught miss. */

  /* ---- the harness itself ----------------------------------------------- */
  { t: SUITE, name: 'HARNESS: the baseline is repointed at the working tree',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '899fd8a698';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    /* A no-op while the change is uncommitted, and a silent baseline collapse
     * the moment it is not -- so guard M18 pins the SHAPE of the baseline
     * rather than waiting for its effect to become visible. */
    expect: 'M18 the baseline in this file is a literal commit sha' },
  { t: SUITE, name: 'HARNESS: the CRLF normalisation of the baseline is removed',
    from: "  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\\r?\\n/g, '\\r\\n');",
    to:   "  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8');",
    expect: 'BASE' },
  { t: APP, name: 'HARNESS: a declaration is deleted and left quoted in a comment',
    from: '  const INGEST_GROUPED = { A5: true, A6: true, A8: true };',
    to:   '  /* was: const INGEST_GROUPED = { A5: true, A6: true, A8: true }; */\r\n  const INGEST_GROUPED = { A6: true };',
    /* This is precisely what codeOnly() exists for. Without it S2 finds the
     * declaration in the COMMENT and passes while the real one is gone -- the
     * failure that has fooled eight pins in this repository. */
    expect: 'S2 INGEST_GROUPED declares exactly A5, A6, A8' },
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
  try { out = execFileSync('node', ['suite_240a.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }

  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const hit = fails.filter(l => l.indexOf(m.expect) >= 0);
  if (hit.length) {
    report.push('  red  ' + m.name);
    report.push('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 108));
    caught++;
  } else if (fails.length) {
    report.push('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    report.push('       want: ' + m.expect);
    report.push('       got : ' + fails[0].trim().slice(5, 108));
    missed++;
  } else {
    report.push('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.');
    missed++;
  }
});

let cleanOk = true, cleanOut = '';
try { cleanOut = execFileSync('node', ['suite_240a.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) {
  cleanOk = false;
  cleanOut = (e.stdout || '') + (e.stderr || '');
}

console.log('======================================================================');
console.log('CLCPA-240 first half -- mutation controls');
console.log('======================================================================');
report.forEach(l => console.log(l));
console.log('');
console.log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length);
console.log('  clean re-run against byte-restored source: ' +
  (cleanOk ? 'PASSES -- ' + (cleanOut.match(/\d+ passed, \d+ failed/) || [''])[0]
           : 'FAILED'));
if (!cleanOk) {
  console.log(cleanOut.split('\n').filter(l => /FAIL/.test(l)).join('\n'));
}
try {
  fs.writeFileSync(DIR + '/mut-240a-output.txt', [
    '======================================================================',
    'CLCPA-240 first half -- mutation controls',
    '======================================================================',
  ].concat(report).concat(['',
    '  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length,
    '  clean re-run against byte-restored source: ' +
      (cleanOk ? 'PASSES -- ' + (cleanOut.match(/\d+ passed, \d+ failed/) || [''])[0] : 'FAILED'),
  ]).join('\n') + '\n');
} catch (e) { /* stdout still carries the run */ }
process.exitCode = (missed || !cleanOk) ? 1 : 0;
