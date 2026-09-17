/* Mutation controls for CLCPA-270.
 *
 * The controls that carry the ruling: arithmetic must not creep back in as an
 * arbiter, the label predicate must not narrow (which UNLOCKS rows -- the
 * regression the census diff caught in my own first attempt), and it must not
 * widen onto the data rows CLCPA-200 proved an unanchored match will claim.
 *
 * Both suites are driven: suite_270 for the model, suite_270_census for the
 * 149-table-year diff. A control that only one of them can see is marked.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-270-evidence';
const APP = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_270.js';
const CENSUS = DIR + '/suite_270_census.js';

const M = [
  /* ---- arithmetic must stay out of protection --------------------------- */
  { t: APP, name: 'THE DEFECT RETURNS: the label lock is gated on arithmetic again',
    from: '      const lockTotalRow = !roleOpen.label && !isHeaderRow;',
    to:   '      const lockTotalRow = !roleOpen.label && !isHeaderRow && !!editorTotalFlags[rowIdx];',
    expect: 'D3 the label lock is the role\'s', suites: ['suite_270.js', 'suite_270_census.js'],
    alt: 'C1 every changed row is covered by a ruled consequence' },
  { t: APP, name: 'ARITHMETIC creeps into the role itself',
    from: '  function ingestRowRole(label, tableId, isHeaderRow) {\r\n    if (isHeaderRow) return \'header\';',
    to:   '  function ingestRowRole(label, tableId, isHeaderRow, flags) {\r\n    if (isHeaderRow) return \'header\';\r\n    if (flags && !flags.any) return \'data\';',
    expect: 'C1 ingestRowRole takes exactly three arguments', suites: ['suite_270.js'] },
  { t: APP, name: 'THE VALUE LOCK goes back to the arithmetic flags',
    from: '      const isTotal = !roleOpen.values && !isHeaderRow;',
    to:   '      const isTotal = editorTotalFlags[rowIdx];',
    expect: 'D4 the value lock is the role\'s', suites: ['suite_270.js', 'suite_270_census.js'],
    alt: 'A1 NOT ONE row became more open' },
  { t: APP, name: 'THE DELETE BUTTON re-derives its own three-way test',
    from: "        <td class=\"ingest-td-actions\">${!roleOpen.deletable ? ''",
    to:   "        <td class=\"ingest-td-actions\">${(isHeaderRow || lockTotalRow || isTotal) ? ''",
    expect: 'D5 the delete button is the role\'s', suites: ['suite_270.js'] },

  /* ---- the A8 amendment: the VALUE half follows derivability ------------- */
  { t: APP, name: 'THE AMENDMENT IS REVERTED: a non-derivable total locks in full again',
    from: "    if (role !== 'total' || engineDerivesValues) return base;",
    to:   '    if (true) return base;',
    expect: 'B5b a total the engine does NOT derive keeps typeable values',
    suites: ['suite_270.js', 'suite_270_census.js'],
    alt: 'B3b and EXACTLY these five rows keep typeable values' },
  { t: APP, name: 'THE AMENDMENT OVER-REACHES: it unlocks the LABEL too',
    from: "    return { label: base.label, values: true, deletable: base.deletable };",
    to:   '    return { label: true, values: true, deletable: base.deletable };',
    expect: 'B5f and the amendment moves the VALUE bit alone',
    suites: ['suite_270.js', 'suite_270_census.js'],
    alt: 'B3a the LABEL lock and the delete guard are identical on every total-role row' },
  { t: APP, name: 'THE AMENDMENT OVER-REACHES: it makes the row deletable again',
    from: "    return { label: base.label, values: true, deletable: base.deletable };",
    to:   '    return { label: base.label, values: true, deletable: true };',
    expect: 'B5f and the amendment moves the VALUE bit alone',
    suites: ['suite_270.js', 'suite_270_census.js'],
    alt: 'A1 NOT ONE row became more open' },
  { t: APP, name: 'THE AMENDMENT REACHES THE COMPUTED ROWS, whose share IS derivable',
    from: "    if (role !== 'total' || engineDerivesValues) return base;",
    to:   "    if ((role !== 'total' && role !== 'computed') || engineDerivesValues) return base;",
    expect: 'B5c a COMPUTED share row is unaffected',
    suites: ['suite_270.js', 'suite_270_census.js'],
    alt: 'B5 every computed-share row is locked in full' },
  { t: APP, name: 'THE ACCESSOR MUTATES THE SHARED TABLE instead of returning a new object',
    from: "    return { label: base.label, values: true, deletable: base.deletable };",
    to:   '    base.values = true; return base;',
    expect: 'B5g and asking for the open shape did not mutate the declared table',
    suites: ['suite_270.js'],
    alt: 'B2 total is closed on all three' },
  { t: APP, name: 'THE RULE IS HARDCODED TO A8 instead of derived (the 259 lesson)',
    from: "    if (role !== 'total' || engineDerivesValues) return base;",
    to:   "    if (role !== 'total' || engineDerivesValues || true) return base;",
    expect: 'B3b and EXACTLY these five rows keep typeable values',
    suites: ['suite_270_census.js'],
    alt: 'B5b a total the engine does NOT derive keeps typeable values' },
  { t: APP, name: 'THE STYLING follows the value lock, so a typeable total stops looking like one',
    from: "        : (isTotalRole ? ' class=\"ingest-row-total\"' : '');",
    to:   "        : (isTotal ? ' class=\"ingest-row-total\"' : '');",
    expect: 'D2c and the row class follows THAT, not the value lock',
    suites: ['suite_270.js'] },
  { t: APP, name: 'THE DERIVED-COLUMN GATE follows the value lock, so a weighted mean goes editable',
    from: '        if (dDesc && !(isTotalOnlyDerived(dDesc) && !isTotalRole)) {',
    to:   '        if (dDesc && !(isTotalOnlyDerived(dDesc) && !isTotal)) {',
    expect: 'D2d as does the total-only derived-column gate',
    suites: ['suite_270.js'] },
  { t: APP, name: 'THE RENDERER asks the accessor without the engine flag',
    from: '      const roleOpen = ingestRoleOpen(rowRole, !!editorTotalFlags[rowIdx]);',
    to:   '      const roleOpen = ingestRoleOpen(rowRole, true);',
    expect: 'D2 and reads its protections from the one accessor',
    suites: ['suite_270.js', 'suite_270_census.js'],
    alt: 'B3b and EXACTLY these five rows keep typeable values' },

  /* ---- the label predicate: narrowing UNLOCKS ---------------------------- */
  { t: APP, name: 'NARROWED to the strict classifier: 21 G-table rows UNLOCK',
    from: '    if (isAnchoredTotalRowLabel(v)) return true;',
    to:   '    if (isStrictTotalRowLabel(v)) return true;',
    /* this is the regression the census diff caught in my own round 1 */
    expect: 'A1 NOT ONE row became more open', suites: ['suite_270_census.js'],
    alt: 'A3 "County Total" is a total' },
  { t: APP, name: 'THE DECLARED FAMILY is dropped, so 55 group totals UNLOCK',
    from: '    return !!(tableId && HIERARCHICAL_TABLES[tableId]) && isHierarchicalTotalLabel(v);',
    to:   '    return false;',
    expect: 'A5 including one that carries the word in the MIDDLE', suites: ['suite_270.js'],
    alt: 'A1 NOT ONE row became more open' },
  { t: APP, name: 'WIDENED to an unanchored match: the CLCPA-200 data rows are claimed',
    from: '    if (isAnchoredTotalRowLabel(v)) return true;',
    to:   '    if (isHierarchicalTotalLabel(v)) return true;',
    expect: 'A11 J1\'s "Total amount of residential electric usage (kWh)" is DATA',
    suites: ['suite_270.js'], alt: 'C1 every changed row is covered by a ruled consequence' },
  { t: APP, name: 'THE LOOSE FORM escapes the declared family',
    from: '    return !!(tableId && HIERARCHICAL_TABLES[tableId]) && isHierarchicalTotalLabel(v);',
    to:   '    return isHierarchicalTotalLabel(v);',
    expect: 'A11 J1\'s "Total amount of residential electric usage (kWh)" is DATA',
    suites: ['suite_270.js'] },

  /* ---- the computed-share rule ------------------------------------------ */
  { t: APP, name: 'THE SHARE RULE drops "of total", claiming the preparer\'s percentages',
    from: "    return /(^|\\s)(?:%|percent(?:age)?)\\s+of\\s+(?:the\\s+)?(?:grand\\s+)?total\\b/i\r\n      .test(String(v));",
    to:   "    return /(^|\\s)(?:%|percent(?:age)?)\\b/i.test(String(v));",
    expect: 'A13.1 "Percentage of projects in DACs" stays DATA', suites: ['suite_270.js'],
    alt: 'B7 and it claimed NONE of D2/D3/D4\'s percentage rows' },
  { t: APP, name: 'THE SHARE RULE is hardcoded to J8\'s two labels',
    from: '  function isComputedShareLabel(v) {\r\n    if (v == null) return false;',
    to:   "  function isComputedShareLabel(v) {\r\n    if (v == null) return false;\r\n    return /^% of total in (non-)?DAC$/i.test(String(v));",
    expect: 'A7 and the same rule reaches F7', suites: ['suite_270.js'],
    alt: 'B6 and the rule reached an EQUIVALENT outside J8' },

  /* ---- the role table ---------------------------------------------------- */
  { t: APP, name: 'A ROLE GOES HALF-OPEN: computed keeps an editable label',
    from: "    computed: { label: false, values: false, deletable: false },",
    to:   "    computed: { label: true,  values: false, deletable: false },",
    expect: 'B4 computed is not half-open', suites: ['suite_270.js'],
    alt: 'B5 every computed-share row is locked in full' },
  { t: APP, name: 'TOTALS BECOME DELETABLE again',
    from: "    total:    { label: false, values: false, deletable: false },",
    to:   "    total:    { label: false, values: false, deletable: true  },",
    expect: 'B2 total is closed on all three', suites: ['suite_270.js'],
    alt: 'A1 NOT ONE row became more open' },
  { t: APP, name: 'A HEADER stops winning over a total label',
    from: "    if (isHeaderRow) return 'header';",
    to:   "    if (isComputedShareLabel(label)) return 'computed';\r\n    if (isHeaderRow) return 'header';",
    expect: 'A10b and a header whose caption reads like a computed share is still a HEADER',
    suites: ['suite_270.js'], alt: 'A9 a structural header wins over everything' },

  /* ---- the footer note --------------------------------------------------- */
  { t: APP, name: 'THE FOOTER NOTE goes back to the arithmetic flags',
    from: "          ${(i.draft || []).some((r, idx) => {",
    to:   "          ${editorTotalFlags.some(Boolean) && (i.draft || []).some((r, idx) => {",
    expect: 'D10 where BASE asked the arithmetic flags',
    alt: 'D9 the "auto-calculated" footer note follows the role too', suites: ['suite_270.js'] },

  /* ---- the harness -------------------------------------------------------- */
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || 'ca4c90a';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X1 BASE is pinned to a literal commit sha', suites: ['suite_270.js'] },
  { t: SUITE, name: 'HARNESS: the role is re-implemented instead of sliced',
    from: '  const role = (l, t, h) => run(a => a.ingestRowRole(l, t, h));',
    to:   "  const role = (l, t, h) => h ? 'header' : (/total/i.test(l) ? 'total' : 'data');",
    expect: 'A0 the function under test is the one sliced from app.js', suites: ['suite_270.js'],
    alt: 'A6 a percentage OF A TOTAL is computed, not a total' },
  /* THE DEFECT THIS ROUND FOUND IN THE CENSUS ITSELF: it declared NEWREV and
   * then read the working tree, so its pin was decoration. Restoring that
   * shape must turn it red, or the pin is still decoration. */
  { t: CENSUS, name: 'HARNESS: the census pin goes back to being dead code',
    from: "  : execSync('git show ' + NEWREV + ':\"' + REL + '\"',\r\n" +
          "      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\\r?\\n/g, '\\r\\n');",
    to:   '  : fs.readFileSync(path.join(REPO, REL), \'utf8\');',
    expect: 'X2 the census reads the PINNED build, not the working tree',
    suites: ['suite_270_census.js'] },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-270 -- mutation controls');
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
  (m.suites || ['suite_270.js']).forEach((s) => {
    try { out += execFileSync('node', [s], { cwd: DIR, encoding: 'utf8' }); }
    catch (e) { out += (e.stdout || '') + (e.stderr || ''); }
  });
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
['suite_270.js', 'suite_270_census.js'].forEach((s) => {
  try { clean += execFileSync('node', [s], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { clean += (e.stdout || '') + (e.stderr || ''); }
});
const tallies = clean.match(/(\d+) passed, (\d+) failed/g) || [];
const anyRed = tallies.some(t => !/, 0 failed/.test(t));
log('  clean re-run against byte-restored source: ' + (anyRed ? 'FAILS' : 'PASSES') +
    ' -- ' + tallies.join('  |  '));
fs.writeFileSync(DIR + '/mut-270-output.txt', lines.join('\n') + '\n');
process.exit(missed || anyRed ? 1 : 0);
