/* Mutation controls for CLCPA-249.
 *
 * The dangerous directions:
 *
 *   THE RULE SHIPS INERT -- the pair is present, correct, and outranked.
 *   That is what CLCPA-248 did twice and what the eight defeated
 *   declarations in this stylesheet did for far longer. Every control that
 *   restores an !important or a higher-specificity loser belongs here.
 *
 *   THE FIRST COLUMN MOVES -- row labels centre with everything else, which
 *   is the one thing the filed rule forbids.
 *
 *   THE TWO SURFACES DRIFT -- the report centres and the editor does not, or
 *   the other way round. They must read the same for the same cell.
 *
 *   CLCPA-248 IS DISTURBED -- the compare skeleton stops resolving to fixed,
 *   or the wrap modifier stops wrapping.
 *
 *   THE CLIP MATH MOVES -- the label column stops being left, so the
 *   CLCPA-245 tooltip starts measuring something else.
 *
 *   THE RESOLVER LIES -- it is shared kit and it just grew structural
 *   pseudos. A wrong answer here makes every assertion above worthless while
 *   looking green.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-249-evidence';
const CSS = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const KIT = REPO + '/Coned/CLCPA/tickets/_kit/css_cascade.js';
const SUITE = DIR + '/suite_249.js';

const M = [
  /* ---- the rule ships inert --------------------------------------------- */
  { t: CSS, name: 'THE OLD !important IS BACK, so the pair ships inert',
    from: '.data-table th,\r\n.data-table td {\r\n  text-align: center;\r\n}',
    to:   '.data-table th:not(.num),\r\n.data-table td:not(.num) {\r\n  text-align: left !important;\r\n}\r\n' +
          '.data-table th,\r\n.data-table td {\r\n  text-align: center;\r\n}',
    /* present, correct, outranked: the exact shape of the defect */
    expect: 'A1 th column 2' },
  { t: CSS, name: 'the pair is declared but a LATER rule re-aligns the cells',
    from: '.data-table thead tr:first-child > th:first-child,\r\n.data-table tbody tr > td:first-child {\r\n  text-align: left;\r\n}',
    to:   '.data-table thead tr:first-child > th:first-child,\r\n.data-table tbody tr > td:first-child {\r\n  text-align: left;\r\n}\r\n' +
          '.data-table td.num { text-align: right; }',
    expect: 'A1 td.num column 2' },
  { t: CSS, name: 'centring becomes left: the rule says nothing new at all',
    from: '.data-table th,\r\n.data-table td {\r\n  text-align: center;\r\n}',
    to:   '.data-table th,\r\n.data-table td {\r\n  text-align: left;\r\n}',
    expect: 'A1 th column 2' },

  /* ---- round 2, finding 1: text columns ---------------------------------- */
  { t: CSS, name: 'ROUND 1 BACK: text columns centre with everything else',
    from: '.data-table td:not(.num) {\r\n  text-align: left;\r\n}',
    to:   '',
    /* the state Emely rejected on the hosted pass */
    expect: 'A1 td plain column 4' },
  { t: CSS, name: 'the text rule is a CELL test, so composites go left too',
    from: '.data-table td:not(.num) {\r\n  text-align: left;\r\n}',
    to:   '.data-table td.num-text,\r\n.data-table td:not(.num) {\r\n  text-align: left;\r\n}',
    /* C2's composites live in NUMERIC columns and were ruled to stay centred:
     * this is the per-cell reading of the rule, which the ruling forbids */
    expect: 'A1 td.num.num-text column 4' },
  { t: CSS, name: 'the editor keeps text columns centred, so the surfaces drift',
    from: '.ingest-cell-text { text-align: left; }',
    to:   '.ingest-cell-text { text-align: center; }',
    expect: 'A4 editor input .ingest-cell-text' },

  /* ---- round 2, findings 2 and 3: the sub-header ------------------------- */
  { t: CSS, name: 'THE BUG RETURNS: th:first-child unscoped again',
    from: '.data-table thead tr:first-child > th:first-child,\r\n.data-table tbody tr > td:first-child {\r\n  text-align: left;\r\n}',
    to:   '.data-table th:first-child,\r\n.data-table td:first-child {\r\n  text-align: left;\r\n}',
    /* A9/A10s "TOTAL" and F6s "NON-EXCLUDABLE" go left among centred
     * siblings, which is exactly what the hosted pass photographed */
    expect: 'A3 band ROW2 col1 -- the bug' },
  { t: CSS, name: 'the scope goes the other way: no first column at all',
    from: '.data-table thead tr:first-child > th:first-child,\r\n.data-table tbody tr > td:first-child {\r\n  text-align: left;\r\n}',
    to:   '.data-table thead tr:first-child > th:first-child {\r\n  text-align: left;\r\n}',
    /* a NUMERIC first column then centres: the text rule cannot save it */
    expect: 'A1 td.num column 1' },

  /* ---- the first column moves ------------------------------------------- */
  { t: CSS, name: 'THE ROW LABEL CENTRES: the one thing the rule forbids',
    from: '.data-table thead tr:first-child > th:first-child,\r\n.data-table tbody tr > td:first-child {\r\n  text-align: left;\r\n}',
    to:   '',
    /* a plain first-column cell is still caught by the text-column rule,
     * so the observable is the NUMERIC first column, which nothing else
     * protects. That is the case the old stylesheet used to settle by
     * source order between two equal selectors. */
    expect: 'A1 td.num column 1' },
  { t: CSS, name: 'the label column is addressed by CLASS, not position',
    from: '.data-table thead tr:first-child > th:first-child,\r\n.data-table tbody tr > td:first-child {\r\n  text-align: left;\r\n}',
    to:   '.data-table th:not(.num),\r\n.data-table td:not(.num) {\r\n  text-align: left;\r\n}',
    /* a numeric first column then centres with everything else, which is the
     * case the old stylesheet decided by source order */
    expect: 'A1 td.num column 1' },
  { t: CSS, name: 'the editor label input centres too',
    from: '.ingest-cell-label {\r\n  font-family: var(--font-sans);\r\n  font-weight: 600;\r\n  text-align: left;\r\n}',
    to:   '.ingest-cell-label {\r\n  font-family: var(--font-sans);\r\n  font-weight: 600;\r\n  text-align: center;\r\n}',
    /* G4 owns it: the clip math measures that input */
    expect: 'G4 and it still resolves LEFT' },

  /* ---- the two surfaces drift ------------------------------------------- */
  { t: CSS, name: 'THE SURFACES DRIFT: the editor keeps numbers right',
    from: '.ingest-cell-num { text-align: center; }',
    to:   '.ingest-cell-num { text-align: right; }',
    expect: 'A4 editor input .ingest-cell-num' },
  /* RETIRED, and why: this control flipped the editor's text inputs from
   * centre back to CLCPA-140's left. Round 2 rules that text columns read
   * LEFT, so left is now the shipped state and the mutation is a no-op.
   * The property it guarded -- the two surfaces agreeing -- is covered by
   * "the editor keeps text columns centred, so the surfaces drift", which
   * mutates in the direction that is now wrong. */
  { t: CSS, name: 'the grey derived box keeps its right alignment',
    from: '  text-align: center;\r\n  font-weight: 600;\r\n  border: 1px dashed var(--line);',
    to:   '  text-align: right;\r\n  font-weight: 600;\r\n  border: 1px dashed var(--line);',
    expect: 'A4 editor derived box .ingest-cell-calc' },

  /* ---- the retirement is not real --------------------------------------- */
  { t: CSS, name: 'ONE INERT RULE SURVIVES: the band centre comes back',
    from: '/* CLCPA-249, and this is CLCPA-241\'s rider closing with it:',
    to:   '.data-table-2level thead th { text-align: center; }\r\n' +
          '/* CLCPA-249, and this is CLCPA-241\'s rider closing with it:',
    /* it is not inert any more -- it WINS over the pair on specificity -- so
     * B2 stays green and B3 is what sees the extra declaration */
    expect: 'B3 and exactly three declarations can reach these cells' },
  { t: CSS, name: 'the dac-yes centring is restored, inert again',
    from: '.data-table td.dac-yes { color: var(--mauve-shadow); font-weight: 700; }',
    to:   '.data-table td.dac-yes { color: var(--mauve-shadow); font-weight: 700; text-align: center; }',
    expect: 'B7 gone: the inert dac-yes centre' },
  { t: CSS, name: 'the is-definitions !important is left loaded',
    from: '.edit-table.is-definitions th,\r\n.edit-table.is-definitions td,\r\n.data-table.is-definitions th,\r\n.data-table.is-definitions td {\r\n  vertical-align: top;\r\n}',
    to:   '.edit-table.is-definitions th,\r\n.edit-table.is-definitions td,\r\n.data-table.is-definitions th,\r\n.data-table.is-definitions td {\r\n  text-align: left !important;\r\n  vertical-align: top;\r\n}',
    expect: 'B9 zero !important alignment declarations on any table cell' },

  /* ---- the dead block surgery ------------------------------------------- */
  { t: CSS, name: 'the surgery took a LIVE rule with it',
    from: '.data-table tbody tr td:first-child:nth-last-child(2) {\r\n  width: 35%;\r\n  font-weight: 600;\r\n}',
    to:   '',
    expect: 'D3 still live and untouched' },
  { t: CSS, name: 'the comments-do-not-nest warning is dropped',
    from: 'CSS comments do not nest',
    to:   'CSS comments are fine',
    expect: 'D2 and the trap is named in place' },

  /* ---- CLCPA-248 is disturbed ------------------------------------------- */
  { t: CSS, name: 'THE 248 SKELETON: the compare table goes back to auto',
    from: '.data-table.data-table-cmp { table-layout: fixed; }',
    to:   '.data-table-cmp { table-layout: fixed; }',
    expect: 'C1 the compare table still resolves table-layout: fixed' },
  { t: CSS, name: 'and the wrap modifier stops wrapping',
    from: '.data-table td.num.num-text {\r\n  white-space: normal;\r\n  word-break: break-word;\r\n}',
    to:   '.data-table td.num.num-text {\r\n  word-break: break-word;\r\n}',
    expect: 'C3 a text cell in a numeric column still wraps' },

  /* ---- the resolver, shared kit ----------------------------------------- */
  { t: KIT, name: 'KIT: :first-child matches at every position',
    from: "    if (p === ':first-child') { if (el.index !== 1) return false; continue; }",
    to:   "    if (p === ':first-child') { continue; }",
    expect: 'K2 and does not match at index 2' },
  { t: KIT, name: 'KIT: :not() stops excluding, so it matches what it forbids',
    from: '      if (r === true) return false;        /* it matched, so :not() excludes us */',
    to:   '      if (r === true) { continue; }',
    expect: 'K6 :not(.num) EXCLUDES a .num cell' },
  { t: KIT, name: 'KIT: an unknown position is GUESSED instead of refused',
    from: '    if (needsPos && (el.index == null || el.of == null)) { conditional = true; continue; }',
    to:   '    if (needsPos && (el.index == null || el.of == null)) { continue; }',
    expect: 'K8 without index/of a structural pseudo stays CONDITIONAL' },
  { t: KIT, name: 'KIT: :hover is judged as if it always applied',
    /* the first cut of this control replaced the fallback at the END of the
     * pseudo loop, which :hover never reaches: it is caught earlier by the
     * guard that refuses any leftover : or [. A control aimed past its
     * target cannot go red. */
    from: '  if (/[\\[:]/.test(rest)) return \'conditional\';',
    to:   '  if (false) return \'conditional\';',
    expect: 'K9 and :hover is still refused' },
  { t: KIT, name: 'KIT: :not() counts toward specificity again',
    from: "  const s = String(sel).replace(/:not\\(([^()]*)\\)/g, '$1');",
    to:   '  const s = String(sel);',
    expect: 'K10 :not() adds nothing itself, its argument counts' },

  /* ---- the harness itself ------------------------------------------------ */
  { t: SUITE, name: 'HARNESS: the population census renders ONE table',
    /* dropping renderSourceTables from the seed list was the first cut and it
     * moved nothing: the ReferenceError loop simply adds it back. The census
     * has to be starved of TABLES to go quiet. */
    from: '  Object.keys(P.tables).sort().forEach(id => {\r\n    const t = P.tables[id];\r\n    Object.keys(t.data || {}).sort().forEach(y => {\r\n      let h;',
    to:   '  Object.keys(P.tables).sort().slice(0, 1).forEach(id => {\r\n    const t = P.tables[id];\r\n    Object.keys(t.data || {}).sort().forEach(y => {\r\n      let h;',
    expect: 'P1 header cells' },
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || 'eef4d6f';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X4 BASE is a literal commit sha' },
  { t: SUITE, name: 'HARNESS: the inert census measures ONE table family',
    from: "  [['data-table'], ['data-table', 'data-table-cmp'], ['data-table', 'data-table-2level']].forEach(tc => {\r\n    for (let i = 1; i <= N; i++) {\r\n      shapes.push(cell('th', [], i, tc));",
    to:   "  [['data-table']].forEach(tc => {\r\n    for (let i = 1; i <= N; i++) {\r\n      shapes.push(cell('th', [], i, tc));",
    /* the count is IN the message, so the expect must not carry the number */
    expect: 'element shapes measured' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-249 -- mutation controls');
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
  try { out = execFileSync('node', ['suite_249.js'], { cwd: DIR, encoding: 'utf8' }); }
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

/* the clean re-run, loudly */
let clean = '';
try { clean = execFileSync('node', ['suite_249.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-249-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
