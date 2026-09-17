/* Mutation controls for Section C group A: CLCPA-253, 256, 262.
 *
 * The dangerous directions:
 *
 *   253 -- THE MARKER GOES BACK TO ROW-SCOPED, which is the shipped defect, or
 *   it over-corrects and strips a DERIVED column of its marker (the
 *   declaration must outrank the structural guess), or it strips a plain
 *   numeric column the engine really does write.
 *
 *   256 -- THE COUNT LIES AGAIN, either by comparing raw (the defect) or by
 *   treating a real value as empty, which would hide a genuine change.
 *
 *   262 -- A REJECTION CLOSES THE DIALOG AGAIN, or a SUCCESS stops closing it.
 *
 *   THE 149-YEAR GATE -- the stored-years proof must be able to fail, or it is
 *   decoration on every ticket in this session.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync, execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-253-evidence';
/* THE MUTATION TARGET IS THE PINNED BUILD, not the working tree.
 * suite_253_256_262 reads 2361a6a unless DAC_APP_OVERRIDE says
 * otherwise, so mutating the repo's app.js would change a file the suite
 * never opens and every control would pass. Same pattern as mut_244_r2. */
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || '2361a6a';
const APP = path.join(os.tmpdir(), 'clcpa-253_256_262-app-' + NEW_COMMIT + '.js');
fs.writeFileSync(APP, execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n'));
const SUITE = DIR + '/suite_253_256_262.js';

const M = [
  /* ---- 253 -------------------------------------------------------------- */
  { t: APP, name: '253 THE DEFECT: the marker is row-scoped again',
    from: '      any: (r, c) => (!!totals[r] && (!!derived[c] || engineWrites(c))) ||',
    to:   '      any: (r, c) => !!totals[r] ||',
    expect: 'T2 C2 none of them is (calculated) any more' },
  { t: APP, name: '253 the derived carve-out goes, so a weightedMean loses its marker',
    from: '      any: (r, c) => (!!totals[r] && (!!derived[c] || engineWrites(c))) ||',
    to:   '      any: (r, c) => (!!totals[r] && engineWrites(c)) ||',
    /* T7 pins the predicate itself; the E1 weightedMean is what it protects */
    expect: 'T7 the predicate admits a derived column on a total row' },
  { t: APP, name: '253 blank headers stop counting, so the spacers come back',
    from: '    const engineWrites = (c) => !blankHeader[c];',
    to:   '    const engineWrites = (c) => true;',
    expect: 'T2 C2 none of them is (calculated) any more' },
  { t: APP, name: '253 MY OWN FIRST CUT: pct and avg excluded here too',
    from: '    const engineWrites = (c) => !blankHeader[c];',
    /* the DECLARATIONS come with it. The first cut of this control pasted the
     * predicate without them, so the mutant threw `pctCol is not defined` and
     * the suite went red on a crash instead of on T5. A control that fails
     * for the wrong reason is not testing what it claims to test. */
    to:   '    const pctCol = detectPctColumns(schema || []);\r\n' +
          '    const avgCol = detectAvgColumns(schema || []);\r\n' +
          '    const engineWrites = (c) => !blankHeader[c] && !pctCol[c] && !avgCol[c];',
    /* It reads like a tightening and it is a LOOSENING: this accessor also
     * gates the import skip, so excluding those columns stops PROTECTING
     * them and a summed average can be written into A3/A4's total row. That
     * is the CLCPA-212 defect returning. suite_240a caught it in the sweep;
     * T5 catches it here, at the ticket. */
    expect: 'T5 it is still (calculated), exactly as at BASE' },
  { t: APP, name: '253 OVER-CORRECTED: nothing on a total row is calculated',
    from: '    const engineWrites = (c) => !blankHeader[c];',
    to:   '    const engineWrites = (c) => false;',
    expect: 'T3 C3 keeps (calculated) on all three named columns' },

  /* ---- 256 -------------------------------------------------------------- */
  { t: APP, name: '256 THE DEFECT: the raw !== comparison returns',
    from: '          if (!same(ar[c], br[c])) count++;',
    to:   '          if (ar[c] !== br[c]) count++;',
    expect: 'S2 and now it counts the 15 non-empty cells' },
  { t: APP, name: '256 zero is treated as empty, hiding a real figure',
    from: "        const nx = (x == null || x === '') ? '' : x;",
    to:   "        const nx = (x == null || x === '' || x === 0) ? '' : x;",
    /* clearing a 7 would still count, but a 0 typed over a 7 would not */
    /* S6b stays green: 0 against a stored 7 still differs either way. It is 0
     * against an EMPTY cell that the widened predicate hides, so S6c owns it. */
    expect: 'S6c and typing 0 into an empty cell counts too' },
  { t: APP, name: '256 the comparison stops normalising the BASELINE side',
    from: "        const ny = (y == null || y === '') ? '' : y;",
    to:   '        const ny = y;',
    expect: 'S5 null, undefined and empty string compare equal' },

  /* ---- 262 -------------------------------------------------------------- */
  { t: APP, name: '262 THE DEFECT: a rejection closes the dialog again',
    from: '          if (failed) {',
    to:   '          if (false) {',
    expect: 'D3 and returns BEFORE close(), so the dialog stays' },
  { t: APP, name: '262 a rejected plan stops being recorded as a failure',
    from: '              if (plan.ok) applyIngestImport(plan); else failed = true;',
    to:   '              if (plan.ok) applyIngestImport(plan);',
    expect: 'D2 a rejected plan sets it' },
  { t: APP, name: '262 an unreadable file stops being recorded as a failure',
    from: "                'The file could not be read.' }] };\r\n              failed = true;",
    to:   "                'The file could not be read.' }] };",
    /* D2 pins the OTHER rejection path and stays green: this one is D2b's */
    expect: 'D2b and so does a file that could not be read at all' },

  /* ---- the 149-year gate ------------------------------------------------ */
  { t: APP, name: 'THE STORED-YEAR GATE: a report cell changes on every table',
    from: '        if (cv == null || cv === \'\') return `<td${numCls}></td>`;',
    to:   '        if (cv == null || cv === \'\') return `<td${numCls}>&nbsp;</td>`;',
    /* a change invisible to the ticket but real on 149 stored table-years */
    expect: 'Z2 every one is byte-identical' },

  /* ---- the harness itself ------------------------------------------------ */
  { t: SUITE, name: 'HARNESS: the stored-year sweep stops rendering anything',
    from: '      const a = OLD.attempt(api => api.renderSourceTables([t], y, {}, id));\r\n      const b = NEW.attempt(api => api.renderSourceTables([t], y, {}, id));\r\n      checked++;',
    to:   '      const a = 1, b = 1;\r\n      checked++;',
    expect: 'Z1b and every one of the 149 produced a <table>' },
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '794eecf';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X3 BASE is a literal commit sha' },
  { t: SUITE, name: 'HARNESS: the counter slice is re-implemented instead of cut out',
    from: "  const body = src.slice(start, end + 5);",
    to:   "  const body = 'const changeCount = 15;';",
    /* a suite that scores its own arithmetic proves nothing about the app */
    expect: 'S1 at BASE C1 reported 30 changes' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('Section C group A -- mutation controls');
log('======================================================================');

let caught = 0, missed = 0;
M.forEach((m) => {
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  if (n !== 1) {
    log('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED');
    missed++; return;
  }
  fs.writeFileSync(m.t, base.replace(from, () => to));
  let out = '';
  try { out = execFileSync('node', ['suite_253_256_262.js'],
    { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }

  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const hit = fails.filter(l => l.indexOf(m.expect) >= 0);
  if (hit.length) {
    log('  red  ' + m.name);
    log('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 104));
    caught++;
  } else if (fails.length) {
    log('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    log('       want: ' + m.expect);
    log('       got : ' + fails[0].trim().slice(5, 104));
    missed++;
  } else {
    log('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.');
    missed++;
  }
});

log('');
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length + ' guards');
let clean = '';
try { clean = execFileSync('node', ['suite_253_256_262.js'],
    { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-253-256-262-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
