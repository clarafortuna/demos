/* Mutation controls for CLCPA-248.
 *
 * The dangerous directions:
 *
 *   THE TWO ANATOMIES RETURN -- the colgroup is not emitted, or the two panels
 *   get different vectors. The whole defect.
 *
 *   THE COLGROUP IS ADVISORY -- emitted but the table stays table-layout: auto,
 *   so min-content wins and nothing changes. The fix that looks applied and is
 *   not.
 *
 *   IT LEAKS INTO THE SINGLE-PANEL VIEW -- 149 table-years that were never
 *   part of this ticket.
 *
 *   ALIGNMENT MOVES -- the wrap modifier touches text-align, which would
 *   re-align 95 cells across ten tables and contradict CLCPA-140. My own first
 *   cut did exactly this; the control keeps it shut.
 *
 *   THE WRAP IS LOST OR OVER-APPLIED -- prose stays nowrap (the crush), or a
 *   real number starts wrapping.
 *
 *   ROUND 3: THE RULE IS PRESENT AND INERT -- the selector drops back to one
 *   class and is beaten by `.data-table` 900 lines later at equal
 *   specificity. That is exactly what shipped twice, and no presence
 *   assertion can see it. "ROUND 3 UNDONE" is that mutation.
 *
 *   ROUND 3: THE RESOLVER LIES -- it is shared kit, so a wrong answer would
 *   make every CSS assertion built on it worthless while looking green. Six
 *   controls attack it directly, and one of them found a real defect in it:
 *   every rule reported the line of the one before it.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-248-evidence';
const APP = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSS = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const SUITE = DIR + '/suite_248.js';
/* ROUND 3: the shared cascade resolver. It is kit, not ticket code, so it
 * gets controls of its own -- a resolver that answers wrongly would make
 * every CSS assertion built on it worthless while looking green. */
const KIT = REPO + '/Coned/CLCPA/tickets/_kit/css_cascade.js';

const M = [
  /* ---- the two anatomies return ----------------------------------------- */
  { t: APP, name: 'THE DEFECT: no colgroup is emitted at all',
    from: '    const colGroup = Array.isArray(opts.colWidths) && opts.colWidths.length',
    to:   '    const colGroup = false && Array.isArray(opts.colWidths) && opts.colWidths.length',
    expect: 'O2 every compare panel carries a colgroup' },
  { t: APP, name: 'the prior panel gets its OWN widths again',
    from: '      const priorContent = hasPrevData\r\n        ? renderTable(dataPrev, cmpOpts)',
    to:   '      const priorContent = hasPrevData\r\n        ? renderTable(dataPrev, Object.assign({}, renderOpts, { colWidths: null }))',
    /* two anatomies again, which is the ticket */
    /* GREEN on the first run: comparePair REPRODUCES the compare branch, so
     * a mutation to the SHIPPED branch moved nothing. OS3 is the pin that
     * sees it -- the same cmpOpts object must reach both panels. */
    expect: 'OS3 and the SAME cmpOpts object reaches both panels' },
  { t: APP, name: 'THE ROUND-1 DEFECT: the skeleton is measured per YEAR again',
    from: '        { colWidths: compareColWidths(t, renderOpts) });',
    to:   '        { colWidths: compareColWidths({ data: { y: dataCurrent.slice(1) } }, renderOpts) });',
    /* still one anatomy, but the wrong one: the prior no longer inherits the
     * current's, which is what Emely ruled */
    /* GREEN on the first run, same cause. OS2 owns it. */
    expect: 'OS2 and from the TABLE, not from either years rows' },

  /* ---- the colgroup is advisory ----------------------------------------- */
  { t: CSS, name: 'THE ADVISORY COLGROUP: the compare table stays auto',
    from: '.data-table.data-table-cmp { table-layout: fixed; }',
    to:   '.data-table.data-table-cmp { table-layout: auto; }',
    /* emitted but powerless: min-content wins and the anatomies diverge again */
    expect: 'C1 a compare table RESOLVES to table-layout: fixed' },
  { t: CSS, name: 'ROUND 3 UNDONE: the selector drops back to ONE class',
    from: '.data-table.data-table-cmp { table-layout: fixed; }',
    to:   '.data-table-cmp { table-layout: fixed; }',
    /* THE SHIPPED DEFECT OF ROUNDS 1 AND 2, reproduced exactly: the rule is
     * present, correct, and beaten by `.data-table` 900 lines later at the
     * same specificity. Nothing about the rule text betrays it. This is the
     * mutation the old presence-matching C1 could not see. */
    expect: 'C1 a compare table RESOLVES to table-layout: fixed' },
  { t: CSS, name: 'the shared rule takes !important, outranking specificity',
    from: '.data-table {\r\n  table-layout: auto;\r\n}',
    to:   '.data-table {\r\n  table-layout: auto !important;\r\n}',
    /* specificity is not the only axis, and the resolver has to know it */
    expect: 'C1 a compare table RESOLVES to table-layout: fixed' },
  { t: APP, name: 'the compare class is never applied, so the CSS cannot bind',
    from: '    const cmpCls = colGroup ? tblCls + \' data-table-cmp\' : tblCls;',
    to:   '    const cmpCls = tblCls;',
    /* GREEN on the first run: the class is applied inside renderTable and the
     * suite built its own opts, so the shipped decision was never exercised.
     * OS5 is the pin that sees it. */
    expect: 'OS5 and the compare class is applied exactly when a colgroup' },

  /* ---- it leaks into the single-panel view ------------------------------ */
  { t: APP, name: 'THE LEAK: every table gets a colgroup, compare or not',
    from: '      const cmpOpts = Object.assign({}, renderOpts,\r\n        { colWidths: compareColWidths(t, renderOpts) });',
    to:   '      const cmpOpts = Object.assign({}, renderOpts,\r\n        { colWidths: compareColWidths(t, renderOpts) });\r\n      renderOpts.colWidths = cmpOpts.colWidths;',
    /* renderOpts is shared with the single-panel branch.
     * GREEN on the first run, same cause: the leak is planted in the SHIPPED
     * branch, which the suite reproduced rather than ran. OS4 owns it. */
    expect: 'OS4 renderOpts itself is never given widths' },

  /* ---- alignment moves --------------------------------------------------- */
  { t: CSS, name: 'ALIGNMENT MOVES: the wrap modifier re-aligns the cell',
    from: '.data-table td.num.num-text {\r\n  white-space: normal;\r\n  word-break: break-word;\r\n}',
    to:   '.data-table td.num.num-text {\r\n  white-space: normal;\r\n  text-align: left;\r\n  word-break: break-word;\r\n}',
    /* MY OWN FIRST CUT. 95 cells across ten tables, and it contradicts
     * CLCPA-140 and Emely's CLCPA-249 rule. The suite caught it; this keeps it
     * caught. */
    expect: 'C4b and does NOT touch alignment' },

  /* ---- the wrap is lost or over-applied ---------------------------------- */
  { t: CSS, name: 'THE CRUSH RETURNS: the wrap modifier does nothing',
    from: '.data-table td.num.num-text {\r\n  white-space: normal;\r\n  word-break: break-word;\r\n}',
    to:   '.data-table td.num.num-text {\r\n  word-break: break-word;\r\n}',
    expect: 'C4 a text cell in a numeric column RESOLVES to white-space' },
  { t: APP, name: 'the modifier is never applied to any cell',
    from: '        const isTextCell = typeof cv === \'string\' && !isWhollyNumeric(cv);',
    to:   '        const isTextCell = false;',
    expect: 'N2 and EVERY one carries the wrap modifier' },
  { t: APP, name: 'OVER-APPLIED: a real number gets the wrap modifier too',
    from: '        const isTextCell = typeof cv === \'string\' && !isWhollyNumeric(cv);',
    to:   '        const isTextCell = true;',
    /* N4 owns it and is the tighter statement: with every cell modified
     * there are no plain numeric cells LEFT, which is the first thing that
     * breaks. N5 then has an empty set to quantify over. */
    expect: 'N4 and plain numeric cells still exist' },
  { t: APP, name: 'the num class is dropped instead of modified',
    from: '          ? (isTextCell ? \' class="num num-text"\' : \' class="num"\')',
    to:   '          ? (isTextCell ? \' class="num-text"\' : \' class="num"\')',
    /* CLCPA-140s column alignment would go with it */
    /* N2 owns it: dropping num means the cell no longer matches the
     * `class="num num-text"` shape N2 requires. N3 is about alignment
     * surviving, which this mutation also breaks but second. */
    expect: 'N2 and EVERY one carries the wrap modifier' },

  /* ---- the width maths --------------------------------------------------- */
  { t: APP, name: 'the label floor is removed, so the label column collapses',
    from: '    const LABEL_FLOOR = 25;',
    to:   '    const LABEL_FLOOR = 0;',
    expect: 'W2 label in its 25-45 band' },
  { t: APP, name: 'the vector stops summing to 100',
    from: '      pct = [want].concat(pct.slice(1).map(p => p / restNow * rest));',
    to:   '      pct = [want].concat(pct.slice(1));',
    expect: 'W1 every vector sums to 100 with positive columns' },
  /* RETIRED, and why: this control removed the 4-character floor on the raw
   * measure, and round 2s MIN_COL now rescues any column that would have gone
   * slim, so the mutation changes nothing observable. A control that cannot
   * fail is not a control; the property it guarded is covered by the MIN_COL
   * control above, which does turn W5 red. */

  /* ---- the round-2 band, the per-column minimum, and the measure -------- */
  { t: APP, name: 'the label CEILING is removed, so text starves the numbers',
    from: '    const LABEL_CEIL = 45;',
    to:   '    const LABEL_CEIL = 100;',
    /* A1, A5, D2 and J1 all reach past half without it */
    expect: 'W2 label in its 25-45 band' },
  { t: APP, name: 'the per-column minimum goes, so C1 gets its sliver back',
    from: '    const MIN_COL = 4;',
    to:   '    const MIN_COL = 0;',
    expect: 'W5 and C1s sliver column is raised to the 4% minimum' },
  { t: APP, name: 'MEASURED BY LONGEST WORD AGAIN, which undersells the label',
    from: "        m = Math.max(m, String(v == null ? '' : v).length);",
    to:   "        m = Math.max(m, String(v == null ? '' : v).split(/\\s+/).reduce((x, w) => Math.max(x, w.length), 0));",
    /* the round-1 measure: it put I1 on the floor at 25%, which is the
     * "both narrow" Emely photographed */
    /* O7 cannot see it: a different MEASURE still makes the three pairs
     * agree with each other, just on the wrong numbers. O9 pins what they
     * agree ON, which is the resolved-winner assertion Emely asked for. */
    expect: 'O9 and the resolved I1 vector is the accepted one' },
  { t: APP, name: 'ONLY ONE YEAR IS MEASURED, so the pair can move the skeleton',
    from: '    const years = Object.keys(table.data).filter(y => (table.data[y] || []).length);',
    to:   '    const years = Object.keys(table.data).filter(y => (table.data[y] || []).length).slice(-1);',
    expect: 'O8 and adding or removing a year does not move it' },

  /* ---- round 3: the wrap predicate --------------------------------------- */
  { t: APP, name: 'THE PREDICATE REVERTS: the wrap asks isNumeric again',
    from: '        const isTextCell = typeof cv === \'string\' && !isWhollyNumeric(cv);',
    to:   '        const isTextCell = typeof cv === \'string\' && !isNumeric(cv);',
    /* the round-2 shipped state: prose beginning with a digit keeps nowrap */
    expect: 'P6 exactly NINETEEN cells change class' },
  { t: APP, name: 'the predicate accepts a leading number and trailing words',
    from: '    return cleaned !== \'\' && /^[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?$/.test(cleaned);',
    to:   '    return cleaned !== \'\' && /^[-+]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?/.test(cleaned);',
    /* THE ANCHOR DROPPED. One character, and the predicate collapses back
     * into isNumeric: this project has shipped an unanchored /total/i before
     * (CLCPA-200) and it cost a blanked data row. */
    expect: 'P2 while isWhollyNumeric says it is not' },
  { t: APP, name: 'the predicate calls everything text, so numbers wrap',
    from: '  function isWhollyNumeric(v) {\r\n    if (typeof v === \'number\') return isFinite(v);',
    to:   '  function isWhollyNumeric(v) {\r\n    if (true) return false;\r\n    if (typeof v === \'number\') return isFinite(v);',
    expect: 'P3 isWhollyNumeric("32,919") is true' },
  { t: APP, name: 'isNumeric is "fixed" instead, which moves the masks too',
    from: '    return cleaned !== \'\' && !isNaN(parseFloat(cleaned)) && isFinite(parseFloat(cleaned));',
    to:   '    return cleaned !== \'\' && /^[-+]?(?:\\d+\\.?\\d*|\\.\\d+)$/.test(cleaned);',
    /* the tempting shortcut, and the reason it is refused: isNumeric feeds
     * columnNumericMask, the formatters and the derive engine */
    expect: 'X3b and isNumeric itself is byte-identical to BASE' },

  /* ---- round 3: the two-column pin --------------------------------------- */
  { t: CSS, name: 'the two-column cell-width rule is deleted',
    from: '.data-table tbody tr td:nth-child(2):last-child {',
    to:   '.data-table tbody tr td:nth-child(2):last-child-REMOVED {',
    expect: 'Q3 the cell-width rule is present and unchanged in shape' },

  /* ---- round 3: the resolver, which is shared kit ------------------------ */
  { t: KIT, name: 'KIT: source order is REVERSED, so the defect reads as fixed',
    from: '  return a.line - b.line;',
    to:   '  return b.line - a.line;',
    /* `return 0` was the first cut and it moved nothing: candidates are
     * collected in source order and Array.sort is stable, so the last one
     * still won and the answer came out right by accident. A control that
     * cannot fail is not a control. */
    expect: 'R1 at EQUAL specificity the later rule wins' },
  { t: KIT, name: 'KIT: every rule reports the line of the one before it',
    from: '    if (buf.trim() === \'\' && !/\\s/.test(c) && c !== \'{\' && c !== \'}\') startLine = line;',
    to:   '    if (false) startLine = line;',
    /* the module's own first defect: adjacent rules then tie on line, the
     * order tie-break never runs, and the answer comes out of sort stability */
    expect: 'R11b and rules report the line they actually start on' },
  { t: KIT, name: 'KIT: specificity is ignored, so the FIX cannot be told apart',
    from: '  for (let k = 0; k < 3; k++) if (a.spec[k] !== b.spec[k]) return a.spec[k] - b.spec[k];',
    to:   '  for (let k = 0; k < 0; k++) if (a.spec[k] !== b.spec[k]) return a.spec[k] - b.spec[k];',
    expect: 'R3 specificity beats order' },
  { t: KIT, name: 'KIT: !important stops winning',
    from: '  if (a.important !== b.important) return a.important ? 1 : -1;',
    to:   '  if (false) return a.important ? 1 : -1;',
    expect: 'R4 and !important beats specificity' },
  { t: KIT, name: 'KIT: comments are code again, the eight-time trap',
    from: '    if (!inC && css[i] === \'/\' && css[i + 1] === \'*\') { inC = true; openedAt = i; i += 2; continue; }',
    to:   '    if (false) { inC = true; openedAt = i; i += 2; continue; }',
    expect: 'R5 a commented rule is not a rule' },
  { t: KIT, name: 'KIT: undecidable rules are counted as if they applied',
    from: '      if (m === \'conditional\' || r.at.length) conditional.push(entry);',
    to:   '      if (false) conditional.push(entry);',
    /* an @media print rule would then govern the screen */
    expect: 'R9 nor is an at-rule body judged as if it always applied' },
  { t: KIT, name: 'KIT: an ancestor selector matches anything, chain or not',
    from: '      if (!hasChain && parts.length > 1) {',
    to:   '      if (false) {',
    expect: 'R8 a rule needing an ancestor is CONDITIONAL' },

  /* ---- the harness itself ------------------------------------------------ */
  { t: SUITE, name: 'HARNESS: the round-1 pin is repointed off the broken build',
    from: "const R1_COMMIT = process.env.CLCPA248_R1 || 'd43fd32';",
    to:   "const R1_COMMIT = process.env.CLCPA248_R1 || 'd0d0a45';",
    /* The regression pin is only a pin while it points at the build that
     * SHIPPED the inert rule. Repointed at BASE it still resolves to auto --
     * there is no compare rule there at all -- so R12 stays green and R13,
     * which requires the rule to have been present, is what notices. Pointing
     * it at HEAD proves nothing either: HEAD carries the fix only after the
     * commit, so that control would pass or fail by timing. */
    expect: 'R13 while the rule it was supposed to obey was present' },
  { t: SUITE, name: 'HARNESS: the round-3 delta is measured against BASE again',
    from: "const R2_COMMIT = process.env.CLCPA248_R2 || 'd2bb9c2';",
    to:   "const R2_COMMIT = process.env.CLCPA248_R2 || 'd0d0a45';",
    /* it then reports 267 moved cells, counting round 1 all over again */
    expect: 'P6 exactly NINETEEN cells change class' },
  /* RETIRED, and why: this control fed the raw stylesheet to CSS_LIVE so the
   * dead block would read as live. It owned the old C1/C2, which matched rule
   * TEXT. Those assertions are gone: C1 and C2 now resolve the cascade, and
   * the resolver strips comments itself, so the property this control guarded
   * moved into the kit. It is guarded there by "KIT: comments are code
   * again", which turns R5 red. CSS_LIVE still feeds C3, C5, C6 and C7, and
   * raw text breaks none of them, so the mutation moved nothing: a control
   * that cannot fail is not a control. */
  { t: SUITE, name: 'HARNESS: the single-panel sweep stops rendering anything',
    from: '      checked++;\r\n      const h = NEW.renderTable(resolveRows(NEW, t, y), { headerLevels: hlOf(t), tableId: id });',
    to:   '      if (true) return;\r\n      checked++;\r\n      const h = NEW.renderTable(resolveRows(NEW, t, y), { headerLevels: hlOf(t), tableId: id });',
    expect: 'S1 rendered' },
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || 'd0d0a45';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X4 BASE is a literal commit sha' },
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
  try { out = execFileSync('node', ['suite_248.js'], { cwd: DIR, encoding: 'utf8' }); }
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
try { cleanOut = execFileSync('node', ['suite_248.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { cleanOk = false; cleanOut = (e.stdout || '') + (e.stderr || ''); }

const head = [
  '======================================================================',
  'CLCPA-248 -- mutation controls',
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
  fs.writeFileSync(DIR + '/mut-248-output.txt',
    head.concat(report).concat(tail).join('\n') + '\n');
} catch (e) { /* stdout is the record */ }
process.exitCode = (missed || !cleanOk) ? 1 : 0;
