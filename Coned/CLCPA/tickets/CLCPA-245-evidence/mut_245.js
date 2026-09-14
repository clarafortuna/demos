/* Mutation controls for CLCPA-245.
 *
 * The dangerous directions:
 *
 *   THE VETO REVERTS -- arithmetic decides again outside the family, and a
 *   uniform import locks data rows in 22 tables. The whole defect.
 *
 *   THE REJECTED RULE COMES BACK -- the whole-label form the ticket originally
 *   proposed, which measurement showed strips 21 legitimate G-family totals.
 *   This is the one that looks right and fails the gate.
 *
 *   THE ANCHOR MOVES OR DISSOLVES -- a substring match flags I1's
 *   "Total number of hires...", which is CLCPA-200's defect returning; an
 *   anchor at the START does the same.
 *
 *   THE VETO LEAKS INTO THE FAMILY -- round 4's veto is a different, wider
 *   rule for four declared tables; replacing it here would silently narrow it.
 *
 *   THE TOOLTIP GOES UNESCAPED -- a label is operator-supplied text.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-245-evidence';
const APP = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_245.js';

const M = [
  /* ---- the veto reverts -------------------------------------------------- */
  { t: APP, name: 'THE DEFECT: the general veto is removed entirely',
    from: '        if (!isAnchoredTotalRowLabel((rows[i] || [])[0])) out[i] = false;',
    to:   '        if (false) out[i] = false;',
    expect: 'M2 the shipped rule mis-flags NONE outside the family' },
  { t: APP, name: 'the veto loop never runs, because the else branch is dead',
    from: '    } else {\r\n      /* CLCPA-245: OUTSIDE THE FAMILY, THE LABEL HAS A VETO TOO.',
    to:   '    } else if (false) {\r\n      /* CLCPA-245: OUTSIDE THE FAMILY, THE LABEL HAS A VETO TOO.',
    expect: 'M2 the shipped rule mis-flags NONE outside the family' },
  { t: APP, name: 'the predicate always says yes, so nothing is vetoed',
    from: '    return /(^|\\s)(grand\\s+|sub)?totals?$/i.test(String(label).trim());',
    to:   '    return true;',
    expect: 'M2 the shipped rule mis-flags NONE outside the family' },

  /* ---- the rejected rule comes back -------------------------------------- */
  { t: APP, name: 'THE REJECTED RULE: back to the whole-label form',
    from: '    return /(^|\\s)(grand\\s+|sub)?totals?$/i.test(String(label).trim());',
    to:   '    return /^(grand\\s+|sub)?totals?$/i.test(String(label).trim());',
    /* the ticket's own proposal: it strips 21 legitimate G-family totals, and
     * the gate is what catches it */
    expect: 'G2 ZERO flags lost' },

  /* ---- the anchor moves or dissolves ------------------------------------- */
  { t: APP, name: 'THE ANCHOR DISSOLVES: a substring match',
    from: '    return /(^|\\s)(grand\\s+|sub)?totals?$/i.test(String(label).trim());',
    to:   '    return /total/i.test(String(label).trim());',
    /* CLCPA-200s defect: I1 row 8 begins with the word and is a data row */
    expect: 'C4 the SHIPPED predicate refuses it' },
  { t: APP, name: 'the anchor moves to the START',
    from: '    return /(^|\\s)(grand\\s+|sub)?totals?$/i.test(String(label).trim());',
    to:   '    return /^(grand\\s+|sub)?totals?(\\s|$)/i.test(String(label).trim());',
    /* "Total number of hires..." passes; "County Total" fails. Both directions
     * wrong at once, which is why the suite asserts both. */
    expect: 'C4 the SHIPPED predicate refuses it' },
  { t: APP, name: 'the word boundary goes, so "subtotals" inside a word matches',
    from: '    return /(^|\\s)(grand\\s+|sub)?totals?$/i.test(String(label).trim());',
    to:   '    return /(grand\\s+|sub)?totals?$/i.test(String(label).trim());',
    /* NO PAYLOAD LABEL EXERCISES THIS. Nothing stored ends in the letters
     * "total" as part of a larger word, so dropping the anchor changes nothing
     * on real data, and this control went GREEN on its first run -- correctly,
     * because there was no guard to trip. C10-C12 now pin the boundary with a
     * synthetic pair, which is the only way to reach it. The control found a
     * gap in the suite rather than a defect in the code. */
    expect: 'C10 a label ending in the LETTERS but not the WORD is refused' },

  /* ---- the veto leaks into the family ------------------------------------ */
  { t: APP, name: 'THE LEAK: the family veto is replaced by this one',
    from: '        if (!isHierarchicalTotalLabel((rows[i] || [])[0])) out[i] = false;',
    to:   '        if (!isAnchoredTotalRowLabel((rows[i] || [])[0])) out[i] = false;',
    /* A5s grand total is "Commercial Programs Total Installations" -- the word
     * is in the MIDDLE, so the anchored rule strips it */
    expect: 'G2 ZERO flags lost' },
  { t: APP, name: 'the family branch is bypassed, so the family gets the general rule',
    from: '    if (tableId && HIERARCHICAL_TABLES[tableId]) {',
    to:   '    if (false && tableId && HIERARCHICAL_TABLES[tableId]) {',
    expect: 'G2 ZERO flags lost' },

  /* ---- the tooltip: ROUND 2, the dashboard own box -------------------- */
  { t: APP, name: 'THE NATIVE TITLE COMES BACK',
    from: '            ? ` data-label-tip="${escapeHtml(labelText)}"` : \'\';',
    to:   '            ? ` title="${escapeHtml(labelText)}"` : \'\';',
    /* the exact mechanism Emely ruled out */
    expect: 'T1 the label cell emits NO native title any more' },
  { t: APP, name: 'the tooltip text goes UNESCAPED onto the attribute',
    from: '            ? ` data-label-tip="${escapeHtml(labelText)}"` : \'\';',
    to:   '            ? ` data-label-tip="${labelText}"` : \'\';',
    expect: 'T2 the full text rides on data-label-tip, ESCAPED' },
  { t: APP, name: 'the attribute is emitted even for a blank label',
    from: '          const labelTip = labelText.trim()',
    to:   '          const labelTip = String(labelText)',
    /* T3 owns it: the structural check on the guard clause itself. T23 is
     * the driven twin and also goes red, but the aim should be the closer
     * of the two. */
    expect: 'T3 and it is absent for a blank label' },
  { t: APP, name: 'A FIFTH POSITIONER: it places the box itself',
    from: '      placeTooltipAtPointer(tip, e);\r\n      tip.style.opacity = \'1\';',
    to:   '      tip.style.left = e.pageX + 14 + "px";\r\n      tip.style.opacity = \'1\';',
    /* CLCPA-242 collapsed four positioners into one; this would make five,
     * and an unclamped one at that */
    /* T8 owns it: the assertion that this wiring does NOT position the box
     * itself. T7 checks the shared call is present, which this mutation
     * leaves in place. */
    expect: 'T8 it does NOT position the box itself' },
  { t: APP, name: 'innerHTML instead of textContent, on operator text',
    /* ANCHORED WITH ITS NEIGHBOUR: the bare line occurs TWICE -- wireControlTips
     * sets textContent the same way -- and a two-match anchor applies nothing
     * at all, which the runner reported as ANCHOR 2 rather than as a pass. */
    from: '      tip.textContent = text;\r\n      placeTooltipAtPointer(tip, e);',
    to:   '      tip.innerHTML = text;\r\n      placeTooltipAtPointer(tip, e);',
    expect: 'T9 textContent, never innerHTML' },
  { t: APP, name: 'THE OWNERSHIP LESSON IS LOST: the label leaves OWNS_TIP',
    from: '    const OWNS_TIP = \'.dumb-row, .strip-row, .ai-header-card, .radar-dot, \' +\r\n      \'.ingest-cell-label[data-label-tip]\';',
    to:   '    const OWNS_TIP = \'.dumb-row, .strip-row, .ai-header-card, .radar-dot\';',
    /* the control-tip handler would then hide the box the label just opened */
    expect: 'T13 and the ingest label is IN it' },
  { t: APP, name: 'THE LABEL BLANKET-HIDES: it calls the global hide',
    from: '    document.addEventListener(\'mouseout\', (e) => { if (labelOf(e)) hide(); });',
    to:   '    document.addEventListener(\'mouseout\', () => hideExecTooltip());',
    /* the other half of CLCPA-242 lesson: this would close every other
     * surface tooltip on any mouseout anywhere */
    expect: 'T15 and the label hides the tip ONLY when the pointer leaves a label' },
  { t: APP, name: 'the wiring stops being idempotent, so handlers stack',
    from: '    if (wireIngestLabelTips._wired) return;',
    to:   '    if (false) return;',
    expect: 'T17 it is idempotent, like wireControlTips' },
  { t: APP, name: 'the wiring is never called',
    from: '    wireIngestLabelTips();\r\n    /* Round 2: the import controls are NOT on the page any more, so nothing is',
    to:   '    /* Round 2: the import controls are NOT on the page any more, so nothing is',
    expect: 'T19 and the page wiring calls it' },

  /* ---- the harness itself ------------------------------------------------ */
  { t: SUITE, name: 'HARNESS: the gate stops comparing table-years',
    from: '      const rows = t.data[y]; if (!rows || !rows.length) return;\r\n      const schema = (t.schema_by_year || {})[y] || null;\r\n      years++;',
    to:   '      const rows = t.data[y]; if (!rows || !rows.length || true) return;\r\n      const schema = (t.schema_by_year || {})[y] || null;\r\n      years++;',
    expect: 'G1 compared' },
  { t: SUITE, name: 'HARNESS: the oracle borrows the shipped predicate',
    /* NOTE: this anchor was broken once by my own repair script, which
     * replaced every '' with \' on any from/to line and hit the empty-string
     * literal inside it. Same class as the dependency patch that matched two
     * call sites: a blanket edit with a guard that was not specific enough. */
    from: "  const ends = (L) => /(^|\\s)(grand\\s+|sub)?totals?$/i.test(String(L == null ? '' : L).trim());",
    to:   '  const ends = (L) => NEW.isStrictTotalRowLabel(String(L == null ? "" : L).trim());',
    /* engine-to-engine: the oracle must compute its own answer, which is the
     * CLCPA-240 round 4 lesson */
    expect: 'O2 no flag outside the family lacks the anchored label' },
  { t: SUITE, name: 'HARNESS: the 21-row check stops finding any rows',
    from: "        if (!/^(county|systemwide) total$/i.test(L)) return;",
    to:   "        if (!/^NOT_A_REAL_LABEL$/i.test(L)) return;",
    /* G5 would then pass over an empty set -- an assertion that cannot fail.
     * G4's exact count is what keeps it honest. */
    expect: 'G4 found all 21 County/Systemwide Total rows' },
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '00d6dd3';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X9 BASE is a literal commit sha' },
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
  try { out = execFileSync('node', ['suite_245.js'], { cwd: DIR, encoding: 'utf8' }); }
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
try { cleanOut = execFileSync('node', ['suite_245.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { cleanOk = false; cleanOut = (e.stdout || '') + (e.stderr || ''); }

const head = [
  '======================================================================',
  'CLCPA-245 -- mutation controls',
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
  fs.writeFileSync(DIR + '/mut-245-output.txt',
    head.concat(report).concat(tail).join('\n') + '\n');
} catch (e) { /* stdout is the record */ }
process.exitCode = (missed || !cleanOk) ? 1 : 0;
