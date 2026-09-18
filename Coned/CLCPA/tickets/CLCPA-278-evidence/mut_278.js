/* Mutation controls for CLCPA-278.
 *
 * The two that carry the ruling are opposites and both must bite: recomputing
 * a total the PREPARER filed (which is CLCPA-272 (b) undone), and refusing to
 * recompute one the ENGINE filed (which is the defect this ticket names).
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-278-evidence';
const APP = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_278.js';

const M = [
  /* ---- the two opposite failures ---------------------------------------- */
  { t: APP, name: 'THE DEFECT RETURNS: the engine\'s own figure is frozen again',
    from: '        recomputeDerivableSums(state.ingest.draft, state.ingest.schema,\r\n                               state.ingest.tableId, r, beforeRow, c);\r\n',
    to:   '',
    expect: 'F3a all three steps of the blur handler are present',
    alt: 'F2 and the blur handler captures it BEFORE the write' },
  { t: APP, name: 'CLCPA-272 (b) UNDONE: the preparer\'s filed total is computed over',
    from: '      if (!rowSumIsConsistent(beforeRow, rel)) return;',
    to:   '',
    expect: 'A2 a total that ALREADY disagreed is KEPT' },

  /* ---- consistency is read from the PRE-EDIT row ------------------------ */
  { t: APP, name: 'CONSISTENCY is read from the row AFTER the edit',
    from: '      if (!rowSumIsConsistent(beforeRow, rel)) return;',
    to:   '      if (!rowSumIsConsistent(rows[rowIndex], rel)) return;',
    /* after the edit the components never match, so nothing ever recomputes */
    expect: 'A1 a CONSISTENT total follows the edit' },
  { t: APP, name: 'THE BLUR HANDLER captures the row AFTER the write',
    from: "        const beforeRow = Array.isArray(state.ingest.draft[r])\r\n          ? state.ingest.draft[r].slice() : null;\r\n        state.ingest.draft[r][c] = (c === 0) ? e.target.value : parseNumericInput(e.target.value);",
    to:   "        state.ingest.draft[r][c] = (c === 0) ? e.target.value : parseNumericInput(e.target.value);\r\n        const beforeRow = Array.isArray(state.ingest.draft[r])\r\n          ? state.ingest.draft[r].slice() : null;",
    expect: 'F3 they run in order: capture the row, write the cell, then recompute' },

  /* ---- the edges --------------------------------------------------------- */
  { t: APP, name: 'EDITING THE TOTAL ITSELF triggers a recompute over it',
    from: "      if (typeof editedCol === 'number' && rel.parts.indexOf(editedCol) < 0) return;",
    to:   '',
    expect: 'B1 editing the TOTAL ITSELF is the preparer filing one' },
  { t: APP, name: 'A PARTIAL ROW is summed as though it were complete',
    from: '      if (seen !== rel.parts.length) return;\r\n      rows[rowIndex][rel.column] = sum;',
    to:   '      rows[rowIndex][rel.column] = sum;',
    expect: 'B3b and an edit that EMPTIES a component leaves the total alone' },
  { t: APP, name: 'A BLANK total counts as consistent, so a figure is invented',
    from: "    const filed = row[rel.column];\r\n    if (typeof filed !== 'number') return false;",
    to:   '    const filed = row[rel.column];\r\n    if (filed == null) return true;',
    expect: 'B2 a BLANK total is not consistent, so nothing is invented into it',
    alt: 'B4 a non-numeric total is left alone' },
  { t: APP, name: 'THE TOLERANCE is dropped, so a rounded total stops following',
    from: '    return withinSourceRounding(filed, sum);',
    to:   '    return filed === sum;',
    expect: 'B5 a total within the engine\'s own rounding tolerance counts as consistent',
    alt: 'F4 consistency uses the engine\'s own tolerance, not a new one' },

  /* ---- scope: the import must not move ---------------------------------- */
  { t: APP, name: 'THE IMPORT starts recomputing too',
    from: '    res.reconcileNotices = reconcileSumColumns(candidate, schema, tableId);',
    to:   '    (candidate || []).forEach((row, ri) => recomputeDerivableSums(candidate, schema, tableId, ri, row));\r\n    res.reconcileNotices = reconcileSumColumns(candidate, schema, tableId);',
    expect: 'D4 buildIngestImport is BYTE-IDENTICAL to BASE' },

  /* ---- no hardcoding ----------------------------------------------------- */
  { t: APP, name: 'THE RELATIONSHIP is hardcoded instead of read from the schema',
    from: '    const rels = detectSumColumns(headerRow, rows, tableId);\r\n    const done = [];',
    to:   "    const rels = tableId === 'H1' ? [{ column: 3, parts: [1, 2] }] : [];\r\n    const done = [];",
    expect: 'C1 the rule works on all 7 enumerated tables',
    alt: 'F5 the relationship comes from the schema' },

  /* ---- the harness -------------------------------------------------------- */
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || 'f2c7137';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X1 BASE is a literal sha' },
  { t: SUITE, name: 'HARNESS: the mutation of state moves back INSIDE the retry loop',
    from: 'const edit = (rows, r, c, v) => {\r\n  const before = rows[r].slice();\r\n  rows[r][c] = v;\r\n  run(a => a.recomputeDerivableSums(rows, SCH, \'H1\', r, before, c));\r\n  return rows;\r\n};',
    to:   'const edit = (rows, r, c, v) => run((a) => {\r\n  const before = rows[r].slice();\r\n  rows[r][c] = v;\r\n  a.recomputeDerivableSums(rows, SCH, \'H1\', r, before, c);\r\n  return rows;\r\n});',
    /* the resolver re-runs its callback, so the capture reads an already
     * edited row and the feature looks broken. This is a HARNESS defect that
     * reported a false failure, and it must stay caught. */
    expect: 'A1 a CONSISTENT total follows the edit' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-278 -- mutation controls');
log('======================================================================');

let caught = 0, missed = 0, applied = 0;
M.forEach((m) => {
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  if (n !== 1) { log('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED'); missed++; return; }
  applied++;
  fs.writeFileSync(m.t, base.replace(from, () => to));
  let out = '';
  try { out = execFileSync('node', ['suite_278.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }
  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const want = [m.expect].concat(m.alt ? [m.alt] : []);
  const hit = fails.filter(l => want.some(w => l.indexOf(w) >= 0));
  if (hit.length) {
    log('  red  ' + m.name);
    log('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 110));
    caught++;
  } else if (fails.length) {
    log('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    log('       want: ' + want.join(' OR '));
    log('       got : ' + fails[0].trim().slice(5, 110));
    missed++;
  } else { log('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.'); missed++; }
});

log('');
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + applied + ' applied');
let clean = '';
try { clean = execFileSync('node', ['suite_278.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-278-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
