/* Mutation controls for CLCPA-244 round 4, the revert.
 *
 * A revert is the easiest change to get subtly wrong, because "mostly
 * restored" looks identical in a diff summary. The dangerous directions:
 *
 *   A FRAGMENT SURVIVES -- any part of rounds 2 or 3's sizing left behind.
 *   The strip would then be neither the original nor the thing that was built.
 *
 *   THE REVERT REACHES TOO FAR -- round 2's percent-unit discipline is a
 *   different piece and Emely ruled it STAYS. Taking it out with the sizing is
 *   the most plausible way to over-revert.
 *
 *   IT REACHES PAST THE TICKET -- round 1's marking and schema fallback are
 *   older than the sizing and must not be touched by reverting to "before".
 *
 *   THE ORIGINAL IS NOT ACTUALLY RESTORED -- close, but not byte-identical.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DIR = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/CLCPA-244-evidence';
const APP = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_244_r4.js';

const M = [
  /* ---- a fragment survives --------------------------------------------- */
  { t: APP, name: 'A FRAGMENT SURVIVES: the radius is scaled again',
    from: '    const R_OUT = 82, R_IN = 54, SW_OUT = 20, SW_IN = 18;',
    to:   '    const k = 1;\r\n    const R_OUT = 82 * k, R_IN = 54, SW_OUT = 20, SW_IN = 18;',
    expect: 'O1 BYTE-IDENTICAL to' },
  { t: APP, name: 'the gap rule keeps round 2s scaled minimum',
    from: '    const GAP = Math.max(8, (CW - TOTAL_ARCS_W) / (cats.length + 1));',
    to:   '    const GAP = Math.max(8 * 1, (CW - TOTAL_ARCS_W) / (cats.length + 1));',
    expect: 'O6 and the original gap rule, clamped at 8' },
  { t: APP, name: 'the resize redraw is wired back up',
    from: "    if (letter === 'E') drawSectionEArc();",
    to:   "    if (letter === 'E') { drawSectionEArc(); wireSectionEArcResize(); }",
    expect: 'O4 wireSectionEArcResize is gone' },
  { t: APP, name: 'the arc keeps a per-gauge centre line',
    from: '      ctx.arc(cx, CY, r, Math.PI, endAngle, false);',
    to:   '      ctx.arc(cx, CY + 0, r, Math.PI, endAngle, false);',
    expect: 'O1 BYTE-IDENTICAL to' },
  { t: APP, name: 'x goes back to being column-derived',
    from: '      const cx = SIDE_PAD + i * SPACING;',
    to:   '      const cx = SIDE_PAD + (i % cats.length) * SPACING;',
    expect: 'O8 x comes from the index again, so there is one row' },

  /* ---- the revert reaches too far --------------------------------------- */
  { t: APP, name: 'OVER-REVERT: the percent rule is taken out with the sizing',
    from: '    const pm = /^([-+]?(?:\\d+\\.?\\d*|\\.\\d+))\\s*%$/.exec(cleaned);',
    to:   '    const pm = null;',
    /* the single most plausible way to get this revert wrong */
    expect: 'U1 "10%" still lands 0.1' },
  { t: APP, name: 'the percent rule survives but changes its convention',
    from: '      if (isFinite(p)) return p / 100;',
    to:   '      if (isFinite(p)) return p;',
    expect: 'U1 "10%" still lands 0.1' },
  { t: APP, name: 'parseNumericInput is restored to pre-ticket as well',
    from: '    const cleaned = trimmed.replace(/[$,]/g, \'\');\r\n    /* An explicit percent sign, and nothing else unparseable around it. The',
    to:   '    const cleaned = trimmed.replace(/[$,]/g, \'\');\r\n    /* REVERTED TOO FAR. The',
    /* A COMMENT-ONLY edit, and U5 is what owns it: byte-identical to the
     * rejected build is the check that notices a change the eye skims past.
     * Retargeted after this control landed on U5 rather than U6 -- the suite
     * was right, my aim was not. */
    expect: 'U5 byte-identical to the rejected build' },

  /* ---- it reaches past the ticket --------------------------------------- */
  { t: APP, name: 'PAST THE TICKET: round 1s schema fallback is reverted too',
    from: '        .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));',
    to:   '        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));',
    expect: 'E4 round 1s getTableSchema is intact' },
  { t: APP, name: 'round 1s marking predicate is reverted too',
    from: "    return !!d && d.type === 'weightedMean';",
    to:   '    return false;',
    expect: 'E4 round 1s isTotalOnlyDerived is intact' },

  /* ---- the strong claim ------------------------------------------------- */
  { t: APP, name: 'THE STRONG CLAIM: a second function differs from pre-ticket',
    from: '  function formatTimeAgo(ts) {',
    to:   '  function formatTimeAgo(ts) {\r\n    /* an unrelated edit */',
    /* E1 is the assertion that makes this revert provable rather than
     * plausible: EXACTLY one function may differ */
    expect: 'E1 exactly ONE function differs from pre-ticket' },

  /* ---- the harness itself ------------------------------------------------ */
  { t: SUITE, name: 'HARNESS: the pre-ticket reference is repointed at the rejected build',
    from: "const ORIG = process.env.DAC_244_ORIG || 'dc47788';",
    to:   "const ORIG = process.env.DAC_244_ORIG || '4f74597';",
    /* ORIG and BASE would then be the same commit and every comparison would
     * be a build against itself */
    expect: 'B3 and they are different commits' },
  { t: SUITE, name: 'HARNESS: the gone-symbol list compares the build against ITSELF',
    from: '  const code = codeOnly(SRC), rej = codeOnly(BASE_SRC);',
    to:   '  const code = codeOnly(SRC), rej = codeOnly(SRC);',
    /* THE RIGHT TARGET, found by the control going green on the wrong one.
     *
     * The first version neutered the per-symbol O4b line, and that correctly
     * changed nothing: O4a had already made it redundant by counting presence
     * separately. A mutation that deletes a redundant line is not a finding.
     *
     * The property actually worth guarding is that the two sides are two
     * DIFFERENT builds. Point rej at the current source and every symbol is
     * absent from both, so "it was there before" becomes vacuous -- which is
     * exactly the shape of harness lie this project keeps meeting. */
    expect: 'O4a all 9 symbols really WERE in the rejected build' },
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '4f74597';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    /* B1 owns this: the literal-sha check is what a symbolic ref trips. */
    expect: 'B1 rejected build is a literal sha' },
];

let caught = 0, missed = 0, expectedMisses = 0;
const report = [];
M.forEach((m) => {
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  const predicted = m.expect === 'NOT EXPECTED TO BE CAUGHT';
  if (n !== 1) {
    report.push('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED');
    missed++; return;
  }
  fs.writeFileSync(m.t, base.replace(from, () => to));
  let out = '';
  try { out = execFileSync('node', ['suite_244_r4.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }

  const fails = (out.match(/^  FAIL .*$/gm) || []);
  if (predicted) {
    report.push((fails.length ? '  red  ' : '  blind ') + m.name +
      '  -- DECLARED BLIND SPOT' + (fails.length ? ', but something caught it' : ''));
    expectedMisses++;
    return;
  }
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
try { cleanOut = execFileSync('node', ['suite_244_r4.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { cleanOk = false; cleanOut = (e.stdout || '') + (e.stderr || ''); }

const head = [
  '======================================================================',
  'CLCPA-244 round 4 -- mutation controls for the revert',
  '======================================================================',
];
const tail = ['',
  '  ' + caught + ' caught, ' + missed + ' not caught, of ' + (M.length - expectedMisses) + ' guards',
  '  ' + expectedMisses + ' declared blind spot(s), listed above',
  '  clean re-run against byte-restored source: ' +
    (cleanOk ? 'PASSES -- ' + (cleanOut.match(/\d+ passed, \d+ failed/) || [''])[0] : 'FAILED'),
];
head.concat(report).concat(tail).forEach(l => console.log(l));
if (!cleanOk) console.log(cleanOut.split('\n').filter(l => /FAIL/.test(l)).join('\n'));
try {
  fs.writeFileSync(DIR + '/mut-244-r4-output.txt',
    head.concat(report).concat(tail).join('\n') + '\n');
} catch (e) { /* stdout is the record */ }
process.exitCode = (missed || !cleanOk) ? 1 : 0;
