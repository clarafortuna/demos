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

const M = [
  /* ---- the two anatomies return ----------------------------------------- */
  { t: APP, name: 'THE DEFECT: no colgroup is emitted at all',
    from: '    const colGroup = Array.isArray(opts.colWidths) && opts.colWidths.length',
    to:   '    const colGroup = false && Array.isArray(opts.colWidths) && opts.colWidths.length',
    expect: 'O2 every compare panel carries a colgroup' },
  { t: APP, name: 'the prior panel gets its OWN widths again',
    from: '      const priorContent = hasPrevData\r\n        ? renderTable(dataPrev, cmpOpts)',
    to:   '      const priorContent = hasPrevData\r\n        ? renderTable(dataPrev, Object.assign({}, renderOpts, { colWidths: compareColWidths(dataPrev, renderOpts) }))',
    /* two anatomies again, which is the ticket */
    /* GREEN on the first run: comparePair REPRODUCES the compare branch, so
     * a mutation to the SHIPPED branch moved nothing. OS3 is the pin that
     * sees it -- the same cmpOpts object must reach both panels. */
    expect: 'OS3 and the SAME cmpOpts object reaches both panels' },
  { t: APP, name: 'the width vector is computed from the PRIOR panel',
    from: '        { colWidths: compareColWidths(dataCurrent, renderOpts) });',
    to:   '        { colWidths: compareColWidths(dataPrev, renderOpts) });',
    /* still one anatomy, but the wrong one: the prior no longer inherits the
     * current's, which is what Emely ruled */
    /* GREEN on the first run, same cause. OS2 owns it. */
    expect: 'OS2 and from the CURRENT panels rows' },

  /* ---- the colgroup is advisory ----------------------------------------- */
  { t: CSS, name: 'THE ADVISORY COLGROUP: the compare table stays auto',
    from: '.data-table-cmp { table-layout: fixed; }',
    to:   '.data-table-cmp { table-layout: auto; }',
    /* emitted but powerless: min-content wins and the anatomies diverge again */
    expect: 'C1 table-layout: fixed is on .data-table-cmp only' },
  { t: APP, name: 'the compare class is never applied, so the CSS cannot bind',
    from: '    const cmpCls = colGroup ? tblCls + \' data-table-cmp\' : tblCls;',
    to:   '    const cmpCls = tblCls;',
    /* GREEN on the first run: the class is applied inside renderTable and the
     * suite built its own opts, so the shipped decision was never exercised.
     * OS5 is the pin that sees it. */
    expect: 'OS5 and the compare class is applied exactly when a colgroup' },

  /* ---- it leaks into the single-panel view ------------------------------ */
  { t: APP, name: 'THE LEAK: every table gets a colgroup, compare or not',
    from: '      const cmpOpts = Object.assign({}, renderOpts,\r\n        { colWidths: compareColWidths(dataCurrent, renderOpts) });',
    to:   '      const cmpOpts = Object.assign({}, renderOpts,\r\n        { colWidths: compareColWidths(dataCurrent, renderOpts) });\r\n      renderOpts.colWidths = cmpOpts.colWidths;',
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
    expect: 'C4 and it restores wrapping' },
  { t: APP, name: 'the modifier is never applied to any cell',
    from: '        const isTextCell = typeof cv === \'string\' && !isNumeric(cv);',
    to:   '        const isTextCell = false;',
    expect: 'N2 and EVERY one carries the wrap modifier' },
  { t: APP, name: 'OVER-APPLIED: a real number gets the wrap modifier too',
    from: '        const isTextCell = typeof cv === \'string\' && !isNumeric(cv);',
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
    expect: 'W2 and no label column falls below its 25% floor' },
  { t: APP, name: 'the vector stops summing to 100',
    from: '      pct = [LABEL_FLOOR].concat(pct.slice(1).map(p => p / restNow * rest));',
    to:   '      pct = [LABEL_FLOOR].concat(pct.slice(1));',
    expect: 'W1 every vector sums to 100 with positive columns' },
  { t: APP, name: 'a column can come out at zero width',
    from: '      mins.push(Math.max(m, 4));',
    to:   '      mins.push(m);',
    expect: 'W1 every vector sums to 100 with positive columns' },

  /* ---- the harness itself ------------------------------------------------ */
  { t: SUITE, name: 'HARNESS: the CSS assertions read the RAW file again',
    from: 'const CSS_LIVE = cssOnly(fs.readFileSync(path.join(REPO, CSS), \'utf8\'));',
    to:   'const CSS_LIVE = fs.readFileSync(path.join(REPO, CSS), \'utf8\');',
    /* the dead block then reads as live and C2 reports the shared table as
     * fixed-layout when it is auto -- the trap this suite exists to avoid */
    expect: 'C2 the shared .data-table keeps table-layout: auto' },
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
