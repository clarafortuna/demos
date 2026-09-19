const _dacRepo = () => {
  const p = require('path'), f = require('fs');
  if (process.env.DAC_REPO) return p.resolve(process.env.DAC_REPO);
  let d = __dirname;
  for (let i = 0; i < 16; i++) {
    if (f.existsSync(p.join(d, '.clcpa-root'))) {
      const two = p.resolve(d, '..', '..');
      return f.existsSync(p.join(two, '.git')) ? two : d;
    }
    const u = p.dirname(d); if (u === d) break; d = u;
  }
  throw new Error('CLCPA project root not found above ' + __dirname + '; set DAC_REPO');
};
/* Mutation controls for CLCPA-274.
 *
 * The control that carries this ticket is the SEPARATION: folding the marker
 * into `any` would make the importer start discarding figures preparers
 * actually filed, which is the opposite of CLCPA-272 ruling (b). That
 * mutation must turn the behaviour assertions red, not just a text pin.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync, execSync } = require('child_process');

const REPO = _dacRepo() + '';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-274-evidence';
const SUITE = DIR + '/suite_274.js';
/* THE MUTATION TARGET IS THE PINNED BUILD, not the working tree. The suite
 * reads NEWREV unless DAC_APP_OVERRIDE says otherwise, so mutating the
 * repo's own file would change something the suite never opens and every
 * control would pass green. Same pattern as mut_271 and mut_244_r2. */
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || 'b902b0b';
const APP = path.join(os.tmpdir(), 'clcpa-274-app-' + NEW_COMMIT + '.js');
fs.writeFileSync(APP, execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n'));

const M = [
  { t: APP, name: 'THE DEFECT RETURNS: the template writer goes back to `any`',
    from: '        if (computed.marksInTemplate(idx, c)) {',
    to:   '        if (computed.any(idx, c)) {',
    expect: 'A3 they are now marked (calculated)', alt: 'D2 and the workbook writer calls it' },

  /* THE ONE THIS TICKET EXISTS TO AVOID */
  { t: APP, name: 'THE MARKER IS FOLDED INTO `any`: the importer starts discarding filed figures',
    from: '      any: (r, c) => (!!totals[r] && (!!derived[c] || engineWrites(c))) ||\n        (!!derived[c] && !isTotalOnlyDerived(derived[c])),\n\n      /* CLCPA-274',
    to:   '      any: (r, c) => (!!totals[r] && (!!derived[c] || engineWrites(c))) ||\n        (!!derived[c] && !isTotalOnlyDerived(derived[c])) || sumCols.indexOf(c) >= 0,\n\n      /* CLCPA-274',
    expect: 'B2 and the provided 1500 LANDS -- not skipped as computed',
    alt: 'D5 the `any` accessor is BYTE-IDENTICAL to BASE' },

  { t: APP, name: 'THE IMPORT consults the template accessor',
    from: '        if (computed.any(t.rowIdx, cIdx)) {',
    to:   '        if (computed.marksInTemplate(t.rowIdx, cIdx)) {',
    expect: 'B2 and the provided 1500 LANDS -- not skipped as computed',
    alt: 'D3 while the IMPORT still calls `any`' },

  /* the relationship must stay the schema's, and CLCPA-272's */
  /* THESE FOUR ARE ANCHORED ON THE FOLLOW-UP'S SOURCE, not the first cut's.
   * The header-row fix replaced the `sumCols` array with a `sumRel` map keyed
   * by column, so the anchors written against the first cut stopped matching
   * and the runner reported them "ANCHOR 0, NOT APPLIED" -- four controls
   * silently absent, which is indistinguishable from four controls passing if
   * nobody reads the applied count. The runner exits non-zero on a missed
   * control, and that is what caught it. */
  { t: APP, name: 'THE DERIVABLE COLUMNS become a hardcoded list',
    from: "    detectSumColumns(schema, rows, tableId).forEach((s) => { sumRel[s.column] = s; });",
    to:   "    if (tableId === 'H1') sumRel[3] = { column: 3, parts: [1, 2] };",
    expect: 'C1 exactly the seven enumerated tables change',
    alt: 'D8 the derivable columns come from the schema, not a list' },
  { t: APP, name: 'THE DERIVABLE COLUMNS are detected without the body rows',
    from: '    detectSumColumns(schema, rows, tableId).forEach((s) => { sumRel[s.column] = s; });',
    to:   '    detectSumColumns(schema, null, tableId).forEach((s) => { sumRel[s.column] = s; });',
    /* without the rows the numeric mask cannot run and F4/F5's second label
     * column comes back as an addend, changing which columns are derivable */
    expect: 'D8 the derivable columns come from the schema, not a list',
    alt: 'C1 exactly the seven enumerated tables change' },
  { t: APP, name: 'THE MARKER reaches every column, not the derivable ones',
    from: '        const rel = sumRel[c];\r\n        if (!rel) return false;',
    to:   '        const rel = sumRel[c] || { parts: [] };',
    expect: 'C2 and 81 cells in total', alt: 'C1 exactly the seven enumerated tables change' },
  { t: APP, name: 'THE MARKER stops reaching the body rows',
    from: '        return !partHasText;',
    to:   '        return false;',
    expect: 'A3 they are now marked (calculated)' },
  /* and the header-row guard the follow-up added is itself a control now */
  { t: APP, name: 'THE HEADER-ROW GUARD is dropped: a second header row is marked again',
    from: '        return !partHasText;',
    to:   '        return true;',
    expect: 'C2b2 its SECOND header row is NOT marked',
    alt: 'C2 and 81 cells in total' },
  { t: APP, name: 'THE GUARD counts BLANKS as text: a fresh template stops being marked',
    from: "      return v != null && v !== '' && typeof v !== 'number';",
    to:   "      return typeof v !== 'number';",
    expect: 'C2b4 and a body row whose figures are BLANK is still marked',
    alt: 'C2 and 81 cells in total' },

  /* the group-header marker must still win */
  { t: APP, name: 'A GROUP HEADER starts claiming (calculated) instead of (no value)',
    from: '        if (isGroupHeader) return { style: style, text: INGEST_NOVALUE_MARKER };',
    to:   '        if (false) return { style: style, text: INGEST_NOVALUE_MARKER };',
    expect: 'D9 the group-header branch above it is unchanged',
    alt: 'D10 and it is still checked BEFORE the calculated branch' },

  /* harness */
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '83fd9c1';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X1 BASE is a literal sha' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-274 -- mutation controls');
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
  try { out = execFileSync('node', ['suite_274.js'], { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
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
try { clean = execFileSync('node', ['suite_274.js'], { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-274-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
