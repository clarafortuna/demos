/* Mutation controls for CLCPA-244 round 2.
 *
 * The dangerous directions:
 *
 *   THE PERCENT SIGN REVERTS -- a string lands in a numeric cell again and
 *   empties the weighted total, the KPI and the header. The whole defect.
 *
 *   THE CONVENTION SLIPS -- "10%" lands 10 instead of 0.1, which renders the
 *   same in the table (the magnitude guess) and 1000% in the header. Worse
 *   than the defect, because it looks right on the screen the operator is on.
 *
 *   MAGNITUDE GUESSING LEAKS IN -- a BARE number gets reinterpreted. Ruled out
 *   deliberately: a second guess to paper over the first is not a fix.
 *
 *   THE GAUGE STOPS SHRINKING, or shrinks so far it goes degenerate.
 *
 *   THE READERS GET "DEFENSIVE" -- Emely ruled option B OUT, so a mutation
 *   that adds the magnitude guard to the header must turn the suite red.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-244-evidence';
const SUITE = DIR + '/suite_244_r2.js';

/* MUTATE A MATERIALISED COPY OF ROUND 2'S BUILD, not the working tree.
 *
 * suite_244_r2 is now pinned on both sides -- round 3 moved the layout, and a
 * suite reading the working tree would re-judge every later round. That pin
 * broke these controls: they were editing an app.js the suite no longer reads,
 * so 14 of 17 mutations stopped registering and the run reported them as
 * uncaught. The controls were not wrong; their subject had moved.
 *
 * So round 2's source is written out here and DAC_APP_OVERRIDE points the
 * suite at it. The controls go on proving what they were written to prove, on
 * the build they were written for, and they stay runnable rather than becoming
 * a frozen number nobody can reproduce.
 */
const NEW_COMMIT = process.env.DAC_244R2_COMMIT || 'b256467';
const APP = path.join(os.tmpdir(), 'clcpa244r2-app-' + NEW_COMMIT + '.js');
fs.writeFileSync(APP, execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n'));

const M = [
  /* ---- part 1: the percent sign ---------------------------------------- */
  { t: APP, name: 'THE DEFECT: the percent sign is unhandled again',
    from: "    const pm = /^([-+]?(?:\\d+\\.?\\d*|\\.\\d+))\\s*%$/.exec(cleaned);",
    to:   '    const pm = null;',
    expect: 'U1 "10%" lands 0.1' },
  { t: APP, name: 'THE CONVENTION SLIPS: "10%" lands 10, not 0.1',
    from: '      if (isFinite(p)) return p / 100;',
    to:   '      if (isFinite(p)) return p;',
    /* renders identically in the table thanks to the magnitude guess, and
     * 1000% in the header -- the failure that LOOKS fine where you are */
    expect: 'U1 "10%" lands 0.1' },
  { t: APP, name: 'the divide goes the wrong way',
    from: '      if (isFinite(p)) return p / 100;',
    to:   '      if (isFinite(p)) return p * 100;',
    expect: 'U1 "10%" lands 0.1' },
  { t: APP, name: 'MAGNITUDE GUESSING leaks in: a bare number is reinterpreted',
    from: '    const n = Number(cleaned);\r\n    return isFinite(n) ? n : trimmed;',
    to:   '    const n = Number(cleaned);\r\n    if (isFinite(n) && n > 1) return n / 100;\r\n    return isFinite(n) ? n : trimmed;',
    /* this is the "fix" that would silently rewrite every number an operator
     * types in every column of every table */
    expect: 'U3 "10" lands 10, unchanged: a BARE number is never reinterpreted' },
  { t: APP, name: 'the anchors go, so text containing % becomes a number',
    from: "    const pm = /^([-+]?(?:\\d+\\.?\\d*|\\.\\d+))\\s*%$/.exec(cleaned);",
    to:   "    const pm = /([-+]?(?:\\d+\\.?\\d*|\\.\\d+))\\s*%/.exec(cleaned);",
    /* "up 10% YoY" would become 0.1 and the operator's note would vanish */
    expect: 'U8 "up 10% YoY" still falls through as text' },

  /* ---- part 2: the gauges ---------------------------------------------- */
  { t: APP, name: 'THE CLIP RETURNS: the radius is hardcoded again',
    from: '    const k = Math.max(0.25, Math.min(1, CW > 0 ? CW / NATURAL_W : 1));',
    to:   '    const k = 1;',
    /* This one found a REAL harness defect: with the scale line gone,
     * layoutFrom could not read the constants, rightEdge went NaN, and G6
     * reported NO CLIPPING for a build that clips -- an assertion that could
     * not fail. G2b/G3b now catch the unreadable case, and this control is
     * aimed at them, which is where the defect actually is. */
    expect: 'G2b the shipped layout constants were actually READ' },
  { t: APP, name: 'the floor goes back to a value that still clips',
    from: '    const k = Math.max(0.25, Math.min(1, CW > 0 ? CW / NATURAL_W : 1));',
    to:   '    const k = Math.max(0.45, Math.min(1, CW > 0 ? CW / NATURAL_W : 1));',
    /* the exact draft the sweep already rejected once */
    expect: 'G8 the scale floor is 0.25' },
  { t: APP, name: 'the scale is allowed to go degenerate',
    from: '    const k = Math.max(0.25, Math.min(1, CW > 0 ? CW / NATURAL_W : 1));',
    to:   '    const k = Math.min(1, CW > 0 ? CW / NATURAL_W : 1);',
    expect: 'G8 the scale floor is 0.25' },
  { t: APP, name: 'a WIDE window stops reproducing the old layout',
    from: '    const R_OUT_F = 82, R_IN_F = 54, SW_OUT_F = 20, SW_IN_F = 18;',
    to:   '    const R_OUT_F = 74, R_IN_F = 54, SW_OUT_F = 20, SW_IN_F = 18;',
    /* shrink-to-fit must not quietly restyle the chart Emely already accepted */
    expect: 'G3 the FULL-SIZE radius is unchanged at 82' },
  { t: APP, name: 'the resize redraw is never wired',
    from: "    if (letter === 'E') { drawSectionEArc(); wireSectionEArcResize(); }",
    to:   "    if (letter === 'E') drawSectionEArc();",
    expect: 'G12 and section E calls it on mount' },
  { t: APP, name: 'listeners accumulate on every re-mount',
    from: "  if (_eArcResizeHandler) window.removeEventListener('resize', _eArcResizeHandler);",
    to:   '  /* removed */',
    expect: 'G13 the prior handler is removed before a new one is added' },
  { t: APP, name: 'the redraw stops being coalesced',
    from: '    window.requestAnimationFrame(function () {',
    to:   '    (function () {',
    expect: 'G14 and the redraw is rAF-coalesced' },

  /* ---- the exclusion Emely ruled ---------------------------------------- */
  { t: APP, name: 'OPTION B SNEAKS IN: the header gets the magnitude guard',
    from: "        group.push({ label: 'DAC Share', value: (secDacPct * 100).toFixed(1) + '%' });",
    to:   "        group.push({ label: 'DAC Share', value: (Math.abs(secDacPct) <= 1 ? secDacPct * 100 : secDacPct).toFixed(1) + '%' });",
    /* ruled OUT: masking while equity_index sits inflated is worse than nothing */
    expect: 'X1 the section header still multiplies unconditionally, as ruled' },
  { t: APP, name: 'round 1s schema fallback is reverted while nobody is looking',
    from: '        .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));',
    to:   '        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));',
    expect: 'X6 round 1s getTableSchema fix is unchanged' },

  /* ---- the harness itself ------------------------------------------------ */
  { t: SUITE, name: 'HARNESS: the stored-year gate stops comparing anything',
    from: '      if (!rows || !rows.length) return;',
    to:   '      if (!rows || !rows.length || true) return;',
    expect: 'S1 compared' },
  { t: SUITE, name: 'HARNESS: the geometry sweep goes back to the broken extractor',
    from: '  const changed = names.filter(n => grabFn(n) !== grabFn(n, BASE_SRC));',
    to:   '  const changed = names.filter(n => grab(n) !== grab(n, BASE_SRC));',
    /* the over-reading grab() reported twenty untouched functions as changed */
    expect: 'exactly FOUR functions changed' },
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || 'dc47788';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X8 BASE is a literal commit sha' },
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
  try { out = execFileSync('node', ['suite_244_r2.js'],
    { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
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
try { cleanOut = execFileSync('node', ['suite_244_r2.js'],
  { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
catch (e) { cleanOk = false; cleanOut = (e.stdout || '') + (e.stderr || ''); }

const head = [
  '======================================================================',
  'CLCPA-244 round 2 -- mutation controls',
  '======================================================================',
];
const tail = ['',
  '  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length + ' guards',
  '  clean re-run against byte-restored source: ' +
    (cleanOk ? 'PASSES -- ' + (cleanOut.match(/\d+ passed, \d+ failed/) || [''])[0] : 'FAILED'),
];
head.concat(report).concat(tail).forEach(l => console.log(l));
if (!cleanOk) console.log(cleanOut.split('\n').filter(l => /FAIL/.test(l)).join('\n'));
try {
  fs.writeFileSync(DIR + '/mut-244-r2-output.txt',
    head.concat(report).concat(tail).join('\n') + '\n');
} catch (e) { /* stdout is the record */ }
process.exitCode = (missed || !cleanOk) ? 1 : 0;
