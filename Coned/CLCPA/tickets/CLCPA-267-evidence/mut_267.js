/* Mutation controls for CLCPA-267.
 *
 * The controls that matter: substituting instead of shifting (which is the
 * fix the ticket asked for and which the measured populations rule out), the
 * 149-table-year gate, and the importer round trip. Plus the digit-boundary
 * trap that CLCPA-252 round 3 shipped twice -- once in the code and once in
 * the assertion written to catch it.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-267-evidence';
const APP = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_267.js';

const M = [
  /* ---- the defect returns -------------------------------------------------- */
  { t: APP, name: 'THE DEFECT RETURNS: the donor schema is borrowed unshifted',
    from: '      if (years.length) {\r\n        return shiftSchemaYears(table.schema_by_year[years[0]], years[0], year);\r\n      }',
    to:   '      if (years.length) return table.schema_by_year[years[0]].slice();',
    expect: 'A2 it now reads "2099 Total Investment"',
    alt: 'E4 and the shifted money column is MATCHED by name' },

  /* ---- the fix the ticket asked for, which the data forbids ---------------- */
  { t: APP, name: 'SUBSTITUTION instead of a shift: every year becomes the reporting year',
    from: "      return String(h).replace(/(\\d?)((?:19|20)\\d{2})(\\d?)/g,\r\n        (m, before, y, after) => (before || after) ? m : String(parseInt(y, 10) + d));",
    to:   "      return String(h).replace(/(\\d?)((?:19|20)\\d{2})(\\d?)/g,\r\n        (m, before, y, after) => (before || after) ? m : String(parseInt(targetYear, 10)));",
    /* A9's prior-year comparison would become 2099/2099/2099/2099 */
    expect: 'C4 A9\'s prior-year comparison becomes 2098/2098/2099/2099, still a comparison',
    alt: 'C3 every different-year heading keeps its RELATIVE offset when borrowed' },

  /* ---- the digit boundary, both directions --------------------------------- */
  { t: APP, name: 'THE \\b TRAP: word boundaries instead of digit capture',
    from: "      return String(h).replace(/(\\d?)((?:19|20)\\d{2})(\\d?)/g,\r\n        (m, before, y, after) => (before || after) ? m : String(parseInt(y, 10) + d));",
    to:   "      return String(h).replace(/\\b((?:19|20)\\d{2})\\b/g,\r\n        (m, y) => String(parseInt(y, 10) + d));",
    expect: 'D8 but a year followed by a LETTER is still a year (the CLCPA-252 r3 trap)' },
  { t: APP, name: 'NO BOUNDARY AT ALL: a 5-digit run is mangled',
    from: '        (m, before, y, after) => (before || after) ? m : String(parseInt(y, 10) + d));',
    to:   '        (m, before, y, after) => before + String(parseInt(y, 10) + d) + after);',
    expect: 'D6 a 5-digit run is NOT a year',
    alt: 'D7 nor is a year with a digit in front of it' },

  /* ---- the no-movement gate ------------------------------------------------ */
  { t: APP, name: 'THE GATE BREAKS: a year with its own schema is shifted too',
    from: '    if (table.schema_by_year && table.schema_by_year[year]) {\r\n      return table.schema_by_year[year].slice();\r\n    }',
    to:   '    if (table.schema_by_year && table.schema_by_year[year]) {\r\n      return shiftSchemaYears(table.schema_by_year[year], \'2000\', year);\r\n    }',
    expect: 'B2 NOT ONE stored table-year moved',
    alt: 'B3 A1:2023 returns its OWN stored schema, byte for byte' },
  { t: APP, name: 'THE DONOR CHOICE is re-litigated back to the oldest year',
    /* the bare sort appears twice -- getTableSchema and dacCol carry the same
     * CLCPA-244/257 ordering -- so the anchor takes the preceding filter with
     * it. An ambiguous anchor reports ANCHOR 2 and applies nothing. */
    from: '        .filter(y => Array.isArray(table.schema_by_year[y]))\r\n        .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));',
    to:   '        .filter(y => Array.isArray(table.schema_by_year[y]))\r\n        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));',
    expect: "F5 getTableSchema's OWN newest-year donor choice (CLCPA-244) is unchanged",
    alt: 'A2 it now reads "2099 Total Investment"' },

  /* ---- the delta ----------------------------------------------------------- */
  { t: APP, name: 'THE DELTA IS INVERTED, so a fresh year reads older than the donor',
    from: '    const d = parseInt(targetYear, 10) - parseInt(donorYear, 10);',
    to:   '    const d = parseInt(donorYear, 10) - parseInt(targetYear, 10);',
    expect: 'A2 it now reads "2099 Total Investment"',
    alt: 'C4 A9\'s prior-year comparison becomes 2098/2098/2099/2099, still a comparison' },
  { t: APP, name: 'AN UNPARSEABLE TARGET produces NaN instead of leaving it alone',
    from: '    if (!isFinite(d) || d === 0) return schema.slice();',
    to:   '    if (d === 0) return schema.slice();',
    expect: 'D10 an unparseable target changes nothing rather than producing NaN' },
  { t: APP, name: 'A NON-ARRAY is coerced instead of returned',
    from: '    if (!Array.isArray(schema)) return schema;',
    to:   '    if (!Array.isArray(schema)) return [];',
    expect: 'D12 a non-array is returned untouched' },
  { t: APP, name: 'NULL HEADINGS are stringified into "null"',
    from: '      if (h == null) return h;',
    to:   '      if (h == null) return String(h);',
    expect: 'D4 null and empty headings survive' },

  /* ---- the surfaces --------------------------------------------------------- */
  { t: APP, name: 'THE SHIFT IS APPLIED TWICE, at a second borrow point',
    from: '  function stripCaptionYear(s) {',
    to:   '  function shiftSchemaYearsAgain(s) { return shiftSchemaYears(s, 1, 2); }\r\n  function stripCaptionYear(s) {',
    expect: 'E2 and shiftSchemaYears is DECLARED once and CALLED once -- one borrow point' },
  { t: APP, name: 'A TABLE IS HARDCODED into the borrow point',
    from: '        return shiftSchemaYears(table.schema_by_year[years[0]], years[0], year);',
    to:   "        return table.id === 'E1' ? shiftSchemaYears(table.schema_by_year[years[0]], years[0], year) : table.schema_by_year[years[0]].slice();",
    expect: 'F1 no added code line names a table id',
    alt: 'C4 A9\'s prior-year comparison becomes 2098/2098/2099/2099, still a comparison' },
  { t: APP, name: 'THE SCHEMA STARTS BEING WRITTEN BACK to Dataverse',
    from: '          const tdBody = { cr2bf_key: key,',
    to:   '          const tdBody = { cr2bf_schema: null, cr2bf_key: key,',
    expect: 'F6 nothing in app.js WRITES cr2bf_schema -- the shift cannot reach storage' },

  /* ---- the harness ---------------------------------------------------------- */
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '6ee833b';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X1 BASE is pinned to a literal commit sha' },
  { t: SUITE, name: 'HARNESS: the shift is re-implemented instead of sliced',
    from: '  const f = now(a => a.shiftSchemaYears);',
    to:   '  const f = (s) => s;',
    expect: 'D0 the function under test is the one sliced from app.js' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-267 -- mutation controls');
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
  try { out = execFileSync('node', ['suite_267.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }
  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const want = [m.expect].concat(m.alt ? [m.alt] : []);
  const hit = fails.filter(l => want.some(w => l.indexOf(w) >= 0));
  if (hit.length) {
    log('  red  ' + m.name);
    log('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 112));
    caught++;
  } else if (fails.length) {
    log('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    log('       want: ' + want.join(' OR '));
    log('       got : ' + fails[0].trim().slice(5, 112));
    missed++;
  } else { log('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.'); missed++; }
});

log('');
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + applied + ' applied');
let clean = '';
try { clean = execFileSync('node', ['suite_267.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-267-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
