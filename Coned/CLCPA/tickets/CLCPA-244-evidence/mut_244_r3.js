/* Mutation controls for CLCPA-244 round 3.
 *
 * The dangerous directions:
 *
 *   THE DEAD BAND RETURNS -- wrapping is disabled or never wins, and a narrow
 *   window is back to small gauges floating in an empty card.
 *
 *   THE ACCEPTED LAYOUT MOVES -- a wide window stops rendering 4x1 at full
 *   size. Emely has accepted that layout twice; this round must not touch it.
 *
 *   IT REGRESSES -- the search returns something SMALLER than round 2's
 *   width-only answer, which would be worse than not shipping.
 *
 *   IT OVERCLAIMS HEIGHT -- a wrapped strip taller than the card it measured,
 *   which would push the rest of the section down. That is the failure my own
 *   first draft had, caught by the planner/renderer height disagreement.
 *
 *   THE PLANNER FORKS FROM THE RENDERER -- a second height model, which is the
 *   defect that produced 321px against 320px of card.
 *
 *   THE SECOND ROW IS DRAWN BUT NOT WIRED -- arcs stack while the labels or
 *   the tooltips still assume one row.
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
const SUITE = DIR + '/suite_244_r3.js';

/* RETIRED, and mutating a materialised copy for it.
 *
 * Emely reverted this round's sizing code after the hosted pass, so the
 * working tree no longer contains the subject of these controls. They mutate
 * round 3's own build instead and point the suite at it, exactly as
 * mut_244_r2 does: the controls go on proving what they were written to prove,
 * on the build they were written for, rather than becoming a number nobody can
 * reproduce. */
const NEW_COMMIT = process.env.DAC_244R3_COMMIT || '7746463';
const APP = path.join(os.tmpdir(), 'clcpa244r3-app-' + NEW_COMMIT + '.js');
fs.writeFileSync(APP, execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n'));

const M = [
  /* ---- the dead band returns ------------------------------------------- */
  { t: APP, name: 'THE DEFECT: wrapping is gated off entirely',
    from: '    if (availH > 0) {',
    to:   '    if (false) {',
    expect: 'R3 the shipped layout has the wrap search' },
  { t: APP, name: 'the search never accepts a wrapped candidate',
    from: '        if (lo > plan.k + 1e-9) plan = { cols: c, rows: rows, k: lo };',
    to:   '        if (false) plan = { cols: c, rows: rows, k: lo };',
    expect: 'D1 all six narrow widths render BIGGER than round 2' },
  { t: APP, name: 'the card height is never measured',
    from: '      availH = (card ? card.clientHeight : 0) - (head ? head.offsetHeight : 0) - padV;',
    to:   '      availH = 0;',
    /* behaviourally identical to round 2 -- the dead band, exactly */
    expect: 'D1 all six narrow widths render BIGGER than round 2' },

  /* ---- the accepted layout moves --------------------------------------- */
  { t: APP, name: 'THE ACCEPTED LAYOUT MOVES: the full-size cap is lifted',
    from: '      k: Math.min(1, CW > 0 ? CW / NATURAL_W : 1) };',
    to:   '      k: (CW > 0 ? CW / NATURAL_W : 1) };',
    /* a wide window would then draw gauges LARGER than Emely accepted */
    expect: 'W1 every wide width, at EVERY height, still renders 4x1 at full size' },
  { t: APP, name: 'wrapping is allowed to win at full width too',
    from: '      if (lo > plan.k + 1e-9) plan = { cols: c, rows: rows, k: lo };',
    to:   '      if (lo >= plan.k - 1e-9) plan = { cols: c, rows: rows, k: lo };',
    /* ties now go to the WRAPPED layout, so a wide window stacks rows for no
     * gain -- the accepted layout changes without getting any bigger */
    expect: 'W1 every wide width, at EVERY height, still renders 4x1 at full size' },

  /* ---- regression and overclaim ---------------------------------------- */
  { t: APP, name: 'IT REGRESSES: the width-only answer stops being the floor',
    from: '    let plan = single;',
    to:   '    let plan = { cols: N, rows: 1, k: 0 };',
    expect: 'S4 nothing is smaller than round 2 rendered it' },
  { t: APP, name: 'IT OVERCLAIMS: the height test is dropped from the search',
    from: '          if (rowHeightFor(mid) * rows <= availH) lo = mid; else hi = mid;',
    to:   '          lo = mid;',
    expect: 'S3 no WRAPPED layout claims height it does not have' },
  { t: APP, name: 'the height test uses one row instead of all of them',
    from: '          if (rowHeightFor(mid) * rows <= availH) lo = mid; else hi = mid;',
    to:   '          if (rowHeightFor(mid) <= availH) lo = mid; else hi = mid;',
    /* two rows would then be accepted in a card that fits only one */
    expect: 'S3 no WRAPPED layout claims height it does not have' },

  /* ---- the planner forks from the renderer ------------------------------ */
  { t: APP, name: 'THE FORK: the renderer stops calling the shared formula',
    from: '    const ROW_H = rowHeightFor(k);',
    to:   '    const ROW_H = TOP_PAD + R_OUT + LABEL_PAD + LINE_H * 3 + 4;',
    /* the exact second-source-of-truth that measured 321 against 320 */
    expect: 'G2 the renderer CALLS it rather than re-deriving the height' },
  { t: APP, name: 'the shared formula forgets the text floor',
    from: '      return (swo / 2 + 4) + R_OUT_F * kk + 1 + (22 * Math.max(0.7, kk)) * 3 + 4;',
    to:   '      return (swo / 2 + 4) + R_OUT_F * kk + 1 + (22 * kk) * 3 + 4;',
    /* The planner then UNDER-estimates each row and wraps into cards that
     * cannot hold the result. F1 owns that property: a card too short to wrap
     * into must fall back to round 2 exactly. Retargeted after this control
     * pointed at S3 and landed on F1 -- the suite was right, my aim was not. */
    expect: 'F1 all' },

  /* ---- the second row is drawn but not wired ---------------------------- */
  { t: APP, name: 'THE ROW IS NOT WIRED: every arc goes back to one centre line',
    from: '      const cy = cyOf(i);',
    to:   '      const cy = CY;',
    expect: 'G8 and y from the row' },
  { t: APP, name: 'x stops using the column, so rows overlap horizontally',
    from: '      const cx = SIDE_PAD + colOf(i) * SPACING;',
    to:   '      const cx = SIDE_PAD + i * SPACING;',
    expect: 'G7 x comes from the COLUMN, not the index' },
  { t: APP, name: 'the labels hang off row 0 for every gauge',
    from: '      let ty = cy + LABEL_PAD;',
    to:   '      let ty = CY + LABEL_PAD;',
    expect: 'G9 labels hang off their own gauge, not off row 0' },
  { t: APP, name: 'the hit test goes back to x-only',
    from: '      const hit = hitZones.find(z => Math.abs(mx - z.cx) < SPACING/2 &&\r\n        my >= z.cy - (TOP_PAD + R_OUT) && my < z.cy - (TOP_PAD + R_OUT) + ROW_H);',
    to:   '      const hit = hitZones.find(z => Math.abs(mx - z.cx) < SPACING/2);',
    /* row 2 would show row 1's tooltip */
    expect: 'G10 the hit test is two-dimensional' },

  /* ---- round 2 must survive --------------------------------------------- */
  { t: APP, name: 'round 2s percent rule is reverted while nobody is looking',
    from: '      if (isFinite(p)) return p / 100;',
    to:   '      if (isFinite(p)) return p;',
    expect: 'X1 parseNumericInput is byte-identical to BASE' },
  { t: APP, name: 'OPTION B SNEAKS IN: the header gets the magnitude guard',
    from: "        group.push({ label: 'DAC Share', value: (secDacPct * 100).toFixed(1) + '%' });",
    to:   "        group.push({ label: 'DAC Share', value: (Math.abs(secDacPct) <= 1 ? secDacPct * 100 : secDacPct).toFixed(1) + '%' });",
    expect: 'X3 the section header still multiplies unconditionally, as ruled' },

  /* ---- the harness itself ------------------------------------------------ */
  { t: SUITE, name: 'HARNESS: the search extraction silently stops extracting',
    from: "  const A = fn.indexOf('const R_OUT_F = ');",
    to:   "  const A = fn.indexOf('const NOT_A_REAL_ANCHOR = ');",
    /* THE PROPERTY THIS ROUND ADDED, and the one most worth guarding. The
     * sweeps run the SHIPPED search now; if that slice anchor ever moves they
     * must fail loudly rather than quietly testing nothing. The first draft of
     * this suite modelled the search instead, and its own controls showed NINE
     * of nineteen mutations going unnoticed. */
    expect: 'R1 the shipped constants AND rowHeightFor were really read' },
  { t: SUITE, name: 'HARNESS: the sweep stops sweeping heights',
    from: 'const HEIGHTS = [0, 100, 160, 200, 240, 320, 400, 520, 700];',
    to:   'const HEIGHTS = [320];',
    expect: 'S1 swept' },
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '3cdb178';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X7 BASE is a literal commit sha' },
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
  try { out = execFileSync('node', ['suite_244_r3.js'],
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
try { cleanOut = execFileSync('node', ['suite_244_r3.js'],
    { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
catch (e) { cleanOk = false; cleanOut = (e.stdout || '') + (e.stderr || ''); }

const head = [
  '======================================================================',
  'CLCPA-244 round 3 -- mutation controls',
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
  fs.writeFileSync(DIR + '/mut-244-r3-output.txt',
    head.concat(report).concat(tail).join('\n') + '\n');
} catch (e) { /* stdout is the record */ }
process.exitCode = (missed || !cleanOk) ? 1 : 0;
