/* Mutation controls for the final stacked gate.
 *
 * A package-level gate is the assertion most likely to be decorative: it runs
 * 298 renders, prints reassuring counts, and would print them just as happily
 * if it were comparing a source with itself. Each mutation below breaks
 * something the gate exists to catch, and must turn it red on the named
 * assertion. Ends with a CLEAN re-run against byte-restored source.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const DIR = REPO + '/Coned/CLCPA/tickets/section-c-package-evidence';
const APP = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const GATE = DIR + '/gate_149_stacked.js';

const M = [
  { t: APP, name: 'AN UNCLAIMED CHANGE reaches the report page',
    from: '  function renderSourceTables(tables, year, perTableView, activeTabId) {',
    to:   '  function renderSourceTables(tables, year, perTableView, activeTabId) {\r\n' +
          '    if (tables && tables[0] && tables[0].id === "B1") return "<table data-x=1></table>";',
    expect: 'Z2 every difference is claimed by a named ticket' },
  { t: APP, name: 'CLCPA-252 is reverted, so its claim matches nothing',
    from: "    return short ? ('Table ' + t.id + '. ' + short) : ('Table ' + t.id);",
    to:   "    return 'Table ' + t.id;",
    expect: 'C1 CLCPA-252 changed something on the stored years' },
  { t: GATE, name: 'HARNESS: the compare loop stops passing the view, so it runs one path twice',
    from: "      const view = {}; view[id] = 'both';       // \"Compare with previous\"",
    to:   '      const view = {};',
    /* This is the harness failure the gate is most exposed to: it would keep
     * printing "149 rendered in COMPARE" while rendering the single-year panel
     * twice, and every count would look right. C2 is the assertion that sees
     * it, because it reads what the compare LOOP produced rather than making a
     * fresh render of its own. */
    expect: 'C2 the compare panel is a DIFFERENT render' },
  { t: APP, name: 'CLCPA-254 is reverted: the declaration stops being consulted',
    from: "        if ((pctCol[c] || avgCol[c]) &&\r\n            !isDeclaredSummable(tableId, schema[c])) continue;",
    to:   '        if (pctCol[c] || avgCol[c]) continue;',
    expect: 'E4 and this build computes' },
  /* WIDENING THE DECLARATION IS NOT GUARDED HERE, and that is measured, not
   * assumed. It was written as a mutation -- SUMMABLE_COLS gaining two more C2
   * columns -- and the gate stayed GREEN, because the stored rows are
   * split-format and sum to nothing whatever the declaration says (E5). So the
   * direction is real but invisible on this surface, and pinning it here would
   * be an assertion that cannot fail. It belongs to suite_254_255_261, which
   * drives typed rows and pins the declaration structurally: mut_254_255_261
   * turns S11 red on "the declaration is widened to every table" and S13 red
   * on "it matches on the heading of ANY table". Recorded rather than dropped,
   * so the gap is visible. */
  { t: GATE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '9699f62';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X1 BASE is a literal commit sha',
    alt: 'X3 and the two sources genuinely differ' },
  { t: GATE, name: 'HARNESS: a render that produced no table is counted anyway',
    from: "      if (/<table/.test(b)) tables++;\r\n      if (a === b) return;\r\n      moved.push(id + ':' + y);\r\n      const c = classify(id, y, a, b);\r\n      if (c) (singleBy[c] = singleBy[c] || []).push(id + ':' + y);",
    to:   "      tables++;\r\n      if (a === b) return;\r\n      moved.push(id + ':' + y);\r\n      const c = classify(id, y, a, b);\r\n      if (c) (singleBy[c] = singleBy[c] || []).push(id + ':' + y);",
    /* paired with the app mutation above, this is the shape where a gate says
     * "149 tables" about 148 tables and one empty string. Run alone it must
     * still be visible, because Z1b stops being an assertion. */
    expect: 'NO SUCH ASSERTION -- see below',
    inert: true },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('Section C package -- mutation controls for the final stacked gate');
log('======================================================================');

let caught = 0, missed = 0, applied = 0;
M.forEach((m) => {
  if (m.inert) {
    /* This one is documented rather than run: deleting the <table> check makes
     * Z1b unconditionally true, which no single run can distinguish from a
     * genuine pass. The guard against it is that Z1b is PAIRED with Z1 and the
     * first mutation above, which substitutes a table for a stub and is caught
     * by Z2. Recorded so the gap is visible rather than assumed away. */
    log('  note ' + m.name);
    log('       NOT RUN: it makes an assertion unconditionally true, which a run ' +
        'cannot see. Covered by Z2 catching the stub-render mutation above.');
    return;
  }
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const n = base.split(m.from).length - 1;
  if (n !== 1) { log('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED'); missed++; return; }
  applied++;
  fs.writeFileSync(m.t, base.replace(m.from, () => m.to));
  let out = '';
  try { out = execFileSync('node', ['gate_149_stacked.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }
  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const want = [m.expect].concat(m.alt ? [m.alt] : []);
  const hit = fails.filter(l => want.some(w => l.indexOf(w) >= 0));
  if (hit.length) {
    log('  red  ' + m.name);
    log('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 104));
    caught++;
  } else if (fails.length) {
    log('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    log('       want: ' + want.join(' OR '));
    log('       got : ' + fails[0].trim().slice(5, 104));
    missed++;
  } else { log('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.'); missed++; }
});

log('');
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + applied + ' run');
let clean = '';
try { clean = execFileSync('node', ['gate_149_stacked.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-gate-149-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
