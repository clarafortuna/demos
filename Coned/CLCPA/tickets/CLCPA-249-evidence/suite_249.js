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
/* CLCPA-249: dashboard-wide table alignment.
 *
 * THE RULE, as filed: on every table, report pages AND the Report Data
 * editor, column headers are CENTRED and the values under them are CENTRED;
 * the first column is the row label and stays LEFT. A text value in a
 * non-label column follows its column.
 *
 * WHY EVERY ASSERTION HERE RESOLVES THE CASCADE RATHER THAN MATCHING RULE
 * TEXT. This stylesheet already contained five declarations trying to centre
 * headers or columns, and every one of them was inert. They lost to
 *
 *     .data-table th:not(.num),
 *     .data-table td:not(.num) { text-align: left !important; }
 *
 * which no ordinary rule can outrank. So the file has claimed for a long time
 * that headers are centred while every header on the dashboard rendered left.
 * Counting eight inert declarations across 105 element shapes is what this
 * suite does first, and it is the reason the ticket is not a one-line diff.
 *
 * That is instances five through eight of the class CLCPA-248 named twice --
 * a declaration's presence is not its effect. There it was source order at
 * equal specificity; here it is !important.
 *
 * CSS ONLY. app.js is asserted byte-identical to BASE: both surfaces already
 * classify cells by column through the same columnNumericMask, so there was
 * nothing to change in the renderer.
 *
 * WHAT THIS CANNOT DO. No browser runs here. What is proven is which
 * DECLARATION wins for a given element, and that the two surfaces resolve to
 * the same answer for the same cell. Where the glyphs land is Emely's eye.
 *
 * BASE is eef4d6f.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const cascade = require('../_kit/css_cascade.js');

const REPO = _dacRepo() + '';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSS = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-249-evidence/suite-249-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || 'eef4d6f';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);
const CSS_PATH = process.env.DAC_CSS_OVERRIDE || path.join(REPO, CSS);

const SRC = fs.readFileSync(APP, 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const CSS_SRC = fs.readFileSync(CSS_PATH, 'utf8');
const CSS_BASE = execSync('git show ' + BASE + ':"' + CSS + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
const say = (m) => lines.push(m);
function guard(label, fn) {
  try { fn(); } catch (e) {
    fail++; lines.push('  FAIL ' + label + ' THREW: ' + (e && e.message));
  }
}
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

/* ---- element shapes, described the way the browser sees them ------------ */
const div = (c) => ({ tag: 'div', classes: c, index: 1, of: 1 });
const N = 7;
const REPORT_WRAP = [div(['section']), div(['table-wrap'])];
const CMP_WRAP = [div(['year-cols']), div(['year-col'])];
const EDIT_WRAP = [div(['ingest-grid-wrap'])];

function cell(tag, classes, index, tableCls, wrap, rowCls, of) {
  return {
    tag, classes, index, of: of || N,
    ancestors: (wrap || REPORT_WRAP).concat([
      { tag: 'table', classes: tableCls, index: 1, of: 1 },
      { tag: tag === 'th' ? 'thead' : 'tbody', classes: [], index: tag === 'th' ? 1 : 2, of: 2 },
      { tag: 'tr', classes: rowCls || [], index: 1, of: 1 },
    ]),
  };
}
const align = (el) => {
  const r = cascade.resolve(CSS_SRC, el, 'text-align');
  return { value: r.winner ? r.winner.value : null, sel: r.winner ? r.winner.sel : null,
           line: r.winner ? r.winner.line : null, cond: r.conditional.length, r };
};

say('======================================================================');
say('CLCPA-249 -- headers and values centred, the row label stays left');
say('  BASE ' + BASE);
say('======================================================================');

/* =================== K: the kit extension ============================= */
say('');
say('=== K. the resolver gained structural pseudos, and is checked first ===');
guard('K: synthetic input with a known right answer', () => {
  const EL = { tag: 'td', classes: ['num'], index: 1, of: 5 };
  const w = (css, el) => {
    const r = cascade.resolve(css, el || EL, 'text-align');
    return r.winner ? r.winner.value : null;
  };
  ok(w('td:first-child{text-align:left}') === 'left', 'K1 :first-child matches at index 1');
  ok(w('td:first-child{text-align:left}', { tag: 'td', classes: [], index: 2, of: 5 }) === null,
     'K2 and does not match at index 2');
  ok(w('td:last-child{text-align:left}', { tag: 'td', classes: [], index: 5, of: 5 }) === 'left',
     'K3 :last-child counts from the end');
  ok(w('td:nth-child(3){text-align:center}', { tag: 'td', classes: [], index: 3, of: 5 }) === 'center',
     'K4 :nth-child(n) matches its position');
  ok(w('td:nth-last-child(2){text-align:center}', { tag: 'td', classes: [], index: 4, of: 5 }) === 'center',
     'K5 :nth-last-child(n) too');
  ok(w('td:not(.num){text-align:left}') === null,
     'K6 :not(.num) EXCLUDES a .num cell, which is the whole 1899 rule');
  ok(w('td:not(.num){text-align:left}', { tag: 'td', classes: [], index: 2, of: 5 }) === 'left',
     'K7 and admits a cell without it');
  /* position unknown: judged as undecidable rather than guessed */
  const noPos = cascade.resolve('td:first-child{text-align:left}',
    { tag: 'td', classes: [] }, 'text-align');
  ok(noPos.winner === null && noPos.conditional.length === 1,
     'K8 without index/of a structural pseudo stays CONDITIONAL, never guessed');
  /* non-structural pseudos are still refused */
  const hov = cascade.resolve('td:hover{text-align:left}', EL, 'text-align');
  ok(hov.winner === null && hov.conditional.length === 1,
     'K9 and :hover is still refused: nothing here knows the pointer');
  /* specificity: :not() contributes its ARGUMENT, not itself */
  ok(JSON.stringify(cascade.specificity('.data-table th:not(.num)')) === '[0,2,1]',
     'K10 :not() adds nothing itself, its argument counts: ' +
     JSON.stringify(cascade.specificity('.data-table th:not(.num)')));
  ok(JSON.stringify(cascade.specificity('.data-table td.num')) === '[0,2,1]',
     'K11 which ties it with .data-table td.num, as CSS says');
  /* and the kit's first consumer is not disturbed */
  ok(cascade.resolve('.a.b{table-layout:fixed}\n.a{table-layout:auto}',
     { tag: 'table', classes: ['a', 'b'] }, 'table-layout').winner.value === 'fixed',
     'K12 the CLCPA-248 answer is unchanged by the extension');
});

/* =================== A: the resolved winners, both surfaces =========== */
say('');
say('=== A. every element shape, RESOLVED, on both surfaces ===============');
guard('A: the report surface', () => {
  const SHAPES = [
    ['th column 1',              cell('th', [], 1, ['data-table']),                       'left'],
    ['th column 2',              cell('th', [], 2, ['data-table']),                       'center'],
    ['th column 7 (last)',       cell('th', [], 7, ['data-table']),                       'center'],
    ['td column 1, row label',   cell('td', [], 1, ['data-table']),                       'left'],
    ['td.num column 1',          cell('td', ['num'], 1, ['data-table']),                  'left'],
    ['td.num column 2',          cell('td', ['num'], 2, ['data-table']),                  'center'],
    ['td.num.num-text column 4', cell('td', ['num', 'num-text'], 4, ['data-table']),      'center'],
    /* ROUND 2: a column whose CONTENT is text reads left. The test is the
     * mask, which is already what puts .num on a cell, so `td:not(.num)`
     * IS "this column is a text column". */
    ['td plain column 4',        cell('td', [], 4, ['data-table']),                       'left'],
    ['td.dac-yes column 3',      cell('td', ['dac-yes'], 3, ['data-table']),              'left'],
    ['td.num in a TOTAL row',    cell('td', ['num'], 3, ['data-table'], null, ['is-total']), 'center'],
    ['td.num in a SUBTOTAL row', cell('td', ['num'], 3, ['data-table'], null, ['is-subtotal']), 'center'],
  ];
  SHAPES.forEach(([label, el, want]) => {
    const a = align(el);
    ok(a.value === want, 'A1 ' + label.padEnd(26) + ' -> ' + String(a.value) +
       ' (want ' + want + ')' + (a.sel ? '  from ' + a.sel + ' @' + a.line : ''));
    ok(a.cond === 0, 'A1b ' + label.padEnd(26) + ' has no undecidable rule in play');
  });
});

guard('A: the compare panels, which carry the CLCPA-248 skeleton', () => {
  [['th column 1', cell('th', [], 1, ['data-table', 'data-table-cmp'], CMP_WRAP), 'left'],
   ['th column 2', cell('th', [], 2, ['data-table', 'data-table-cmp'], CMP_WRAP), 'center'],
   ['td column 1', cell('td', [], 1, ['data-table', 'data-table-cmp'], CMP_WRAP), 'left'],
   ['td.num column 2', cell('td', ['num'], 2, ['data-table', 'data-table-cmp'], CMP_WRAP), 'center'],
  ].forEach(([label, el, want]) => {
    const a = align(el);
    ok(a.value === want, 'A2 compare ' + label.padEnd(18) + ' -> ' + String(a.value) +
       ' (want ' + want + ')');
  });
});

guard('A: the A9/A10/F6 header band, CLCPA-241s rider', () => {
  /* a th in header ROW `row` of a two-row thead, at column `i` */
  const bandTh = (cls, i, row) => ({
    tag: 'th', classes: cls, index: i, of: N,
    ancestors: REPORT_WRAP.concat([
      { tag: 'table', classes: ['data-table', 'data-table-2level'], index: 1, of: 1 },
      { tag: 'thead', classes: [], index: 1, of: 2 },
      { tag: 'tr', classes: [], index: row, of: 2 }]),
  });
  [['band th column 1', cell('th', [], 1, ['data-table', 'data-table-2level']), 'left'],
   ['band th column 2', cell('th', [], 2, ['data-table', 'data-table-2level']), 'center'],
   ['band th column 5', cell('th', [], 5, ['data-table', 'data-table-2level']), 'center'],
   /* THE ROUND-2 BUG, and it is one mechanism behind both sightings.
    * Measured in the emitted markup: A9 row 1 is `<th rowspan="2">` for the
    * label plus three `th.th-group` with colspan 2; row 2 is six
    * `th.th-detail`. Because the label header spans both rows, row 2's
    * FIRST child is the first DATA column's header -- A9/A10's "TOTAL",
    * F6's "NON-EXCLUDABLE" -- and a bare th:first-child caught it. These
    * shapes are the real ones, not a synthetic subheader row: the band's
    * second line lives in THEAD, not in tbody. */
   ['band row1 col1, rowspan=2 label', bandTh(['th-group'], 1, 1), 'left'],
   ['band row1 col2, group header',    bandTh(['th-group'], 2, 1), 'center'],
   ['band ROW2 col1 -- the bug',       bandTh(['th-detail'], 1, 2), 'center'],
   ['band ROW2 col2, its sibling',     bandTh(['th-detail'], 2, 2), 'center'],
   ['band ROW2 col4',                  bandTh(['th-detail'], 4, 2), 'center'],
  ].forEach(([label, el, want]) => {
    const a = align(el);
    ok(a.value === want, 'A3 ' + label.padEnd(22) + ' -> ' + String(a.value) + ' (want ' + want + ')');
  });
});

guard('A: the editor surface reads the SAME as the report', () => {
  const eth = (cls, i) => ({ tag: 'th', classes: cls, index: i, of: N,
    ancestors: EDIT_WRAP.concat([{ tag: 'table', classes: ['ingest-grid'], index: 1, of: 1 },
      { tag: 'thead', classes: [], index: 1, of: 2 }, { tag: 'tr', classes: [], index: 1, of: 1 }]) });
  const einput = (cls, i) => ({ tag: 'input', classes: ['ingest-cell'].concat(cls), index: 1, of: 1,
    ancestors: EDIT_WRAP.concat([{ tag: 'table', classes: ['ingest-grid'], index: 1, of: 1 },
      { tag: 'tbody', classes: [], index: 2, of: 2 }, { tag: 'tr', classes: [], index: 1, of: 1 },
      { tag: 'td', classes: [], index: i, of: N }]) });
  const ecalc = (cls, i) => ({ tag: 'span', classes: ['ingest-cell-calc'].concat(cls), index: 1, of: 1,
    ancestors: EDIT_WRAP.concat([{ tag: 'table', classes: ['ingest-grid'], index: 1, of: 1 },
      { tag: 'tbody', classes: [], index: 2, of: 2 }, { tag: 'tr', classes: [], index: 1, of: 1 },
      { tag: 'td', classes: ['ingest-td-calc'], index: i, of: N }]) });
  [['th label column', eth(['ingest-th-label'], 1), 'left'],
   ['th column 3', eth([], 3), 'center'],
   ['input .ingest-cell-label', einput(['ingest-cell-label'], 1), 'left'],
   ['input .ingest-cell-num', einput(['ingest-cell-num'], 3), 'center'],
   ['input .ingest-cell-text', einput(['ingest-cell-text'], 3), 'left'],
   ['derived box .ingest-cell-calc', ecalc([], 3), 'center'],
   ['derived box, text column', ecalc(['ingest-cell-calc-text'], 3), 'left'],
  ].forEach(([label, el, want]) => {
    const a = align(el);
    ok(a.value === want, 'A4 editor ' + label.padEnd(30) + ' -> ' + String(a.value) +
       ' (want ' + want + ')');
  });
});

/* =================== B: nothing is left inert ========================= */
say('');
say('=== B. the eight defeated declarations, retired ======================');
guard('B: no reachable text-align rule loses everywhere any more', () => {
  const shapes = [];
  [['data-table'], ['data-table', 'data-table-cmp'], ['data-table', 'data-table-2level']].forEach(tc => {
    for (let i = 1; i <= N; i++) {
      shapes.push(cell('th', [], i, tc));
      [[], ['num'], ['num', 'num-text'], ['dac-yes']].forEach(cc => shapes.push(cell('td', cc, i, tc)));
    }
  });
  const winners = new Set(), reachable = new Map();
  shapes.forEach(el => {
    const r = cascade.resolve(CSS_SRC, el, 'text-align');
    if (r.winner) winners.add(r.winner.line);
    r.candidates.forEach(c => { if (!reachable.has(c.line)) reachable.set(c.line, c); });
  });
  const inert = Array.from(reachable.keys()).filter(l => !winners.has(l));
  ok(shapes.length === 105, 'B1 ' + shapes.length + ' element shapes measured');
  ok(inert.length === 0, 'B2 ZERO reachable declarations are inert' +
     (inert.length ? ': ' + inert.map(l => reachable.get(l).sel + '@' + l).join(', ') : ''));
  ok(reachable.size === 3, 'B3 and exactly three declarations can reach these cells: ' +
     Array.from(reachable.values()).map(c => c.sel + '@' + c.line).join(', '));

  /* the same census at BASE, which is where the eight were */
  const wB = new Set(), rB = new Map();
  shapes.forEach(el => {
    const r = cascade.resolve(CSS_BASE, el, 'text-align');
    if (r.winner) wB.add(r.winner.line);
    r.candidates.forEach(c => { if (!rB.has(c.line)) rB.set(c.line, c); });
  });
  const inertB = Array.from(rB.keys()).filter(l => !wB.has(l));
  ok(inertB.length === 8, 'B4 and at BASE there were EIGHT: ' + inertB.length);
  const centring = inertB.filter(l => rB.get(l).value === 'center');
  ok(centring.length === 5, 'B5 five of them were trying to CENTRE something: ' +
     centring.map(l => rB.get(l).sel.slice(0, 34) + '@' + l).join(', '));
  ok(wB.size === 3 && Array.from(wB).some(l => rB.get(l).important),
     'B6 and one of the three BASE winners carried !important, which is why');
});

guard('B: the retired declarations are gone from the file', () => {
  const live = cascade.stripComments(CSS_SRC).css;
  const liveBase = cascade.stripComments(CSS_BASE).css;
  const GONE = [
    ['.data-table th:not(.num)', 'the !important that governed everything'],
    ['.data-table-2level thead th { text-align: center; }', 'the inert band centre'],
    ['.data-table td.dac-yes { color: var(--mauve-shadow); font-weight: 700; text-align: center; }',
      'the inert dac-yes centre'],
    ['.data-table thead tr th:nth-child(2)', 'the inert nth-child header centre'],
    ['.data-table tbody tr td:nth-child(2):not(.num)', 'the inert nth-child value centre'],
  ];
  GONE.forEach(([s, why]) => {
    ok(live.indexOf(s) < 0, 'B7 gone: ' + why);
    ok(liveBase.indexOf(s) >= 0, 'B7b and it WAS at BASE, so the assertion means something');
  });
  ok(!/text-align:\s*right/.test(
      (/\.data-table td\.num \{([^}]*)\}/.exec(live) || [, ''])[1]),
     'B8 .data-table td.num no longer declares text-align: right');
  ok(/font-variant-numeric: tabular-nums/.test(
      (/\.data-table td\.num \{([^}]*)\}/.exec(live) || [, ''])[1]),
     'B8b while its mono figures and nowrap are untouched');
});

guard('B: and NO !important is left on a table cells alignment', () => {
  const live = cascade.stripComments(CSS_SRC).css;
  const imps = (live.match(/[^}]*text-align:\s*[a-z]+\s*!important[^}]*/g) || []);
  const onCells = imps.filter(s => /data-table|ingest-|edit-table|rows-table/.test(s));
  ok(onCells.length === 0, 'B9 zero !important alignment declarations on any table cell' +
     (onCells.length ? ': ' + onCells.length : ''));
  const baseLive = cascade.stripComments(CSS_BASE).css;
  const baseOn = (baseLive.match(/[^}]*text-align:\s*[a-z]+\s*!important[^}]*/g) || [])
    .filter(s => /data-table|ingest-|edit-table|rows-table/.test(s));
  ok(baseOn.length === 2, 'B9b where BASE had two: ' + baseOn.length);
});

/* =================== D: the dead block surgery ======================== */
say('');
say('=== D. the commented block, and the trap named in place ==============');
guard('D: only the proven-inert span went', () => {
  const live = cascade.stripComments(CSS_SRC).css;
  const liveBase = cascade.stripComments(CSS_BASE).css;
  ok(CSS_SRC.indexOf('.data-table {\r\n  table-layout: fixed;\r\n  width: 100%;\r\n}') < 0,
     'D1 the commented-out table-layout: fixed block is deleted');
  ok(CSS_BASE.indexOf('.data-table {\r\n  table-layout: fixed;\r\n  width: 100%;\r\n}') >= 0,
     'D1b and it was there at BASE');
  ok(/CSS comments do not nest/.test(CSS_SRC),
     'D2 and the trap is named in place for the next reader');
  /* 1551-1578 UNTOUCHED, by ruling: they are LIVE rules with real effects */
  /* MEMBERSHIP IN THE RULE SET, not indexOf. `...nth-last-child(2)` is a
   * SUBSTRING of `...nth-last-child(2) ~ td`, so a deleted rule still
   * answered present and the control that deleted it went red on the wrong
   * assertion. That is the same substring trap the CLCPA-248 strippers hit. */
  const selSet = (c) => new Set(cascade.parseRules(cascade.stripComments(c).css)
    .map(r => r.selectorText.replace(/\s+/g, ' ').trim()));
  const nowSet = selSet(CSS_SRC), baseSet = selSet(CSS_BASE);
  ['.data-table tbody tr td:first-child:nth-last-child(2)',
   '.data-table tbody tr td:first-child:nth-last-child(2) ~ td',
   '.data-table thead tr th:first-child:nth-last-child(2)',
   '.data-table thead tr th:first-child:nth-last-child(2) ~ th',
   '.data-table thead tr:first-child .th-group',
   '.data-table thead tr:nth-child(2) .th-detail:nth-child(2n)'].forEach(sel => {
    ok(nowSet.has(sel) && baseSet.has(sel),
       'D3 still live and untouched: ' + sel.slice(0, 52));
  });
  /* and they are still LIVE, not merely present: the width rules are the
   * finding queued for its own ticket, so their status is pinned */
  const twoCol = cascade.resolve(CSS_SRC,
    { tag: 'td', classes: [], index: 1, of: 2,
      ancestors: REPORT_WRAP.concat([{ tag: 'table', classes: ['data-table'], index: 1, of: 1 },
        { tag: 'tbody', classes: [], index: 2, of: 2 }, { tag: 'tr', classes: [], index: 1, of: 1 }]) },
    'width');
  ok(twoCol.winner !== null && twoCol.winner.value === '35%',
     'D4 the 35%/65% rules on two-column tables are LIVE, queued as their own ' +
     'finding and deliberately not touched here: ' +
     (twoCol.winner ? twoCol.winner.value : 'NOT LIVE'));
});

/* =================== C: CLCPA-248 is undisturbed ===================== */
say('');
say('=== C. the compare skeleton, which this ticket must not move =========');
guard('C: table-layout still resolves to fixed', () => {
  const cmp = { tag: 'table', classes: ['data-table', 'data-table-cmp'], index: 1, of: 1,
    ancestors: CMP_WRAP };
  const r = cascade.resolve(CSS_SRC, cmp, 'table-layout');
  ok(r.winner !== null && r.winner.value === 'fixed',
     'C1 the compare table still resolves table-layout: fixed, from "' +
     (r.winner ? r.winner.sel : 'NOTHING') + '"');
  ok(r.winner !== null && /data-table-cmp/.test(r.winner.sel) &&
     cascade.specificity(r.winner.sel)[1] === 2,
     'C1b still winning on SPECIFICITY, two classes');
  const one = cascade.resolve(CSS_SRC, { tag: 'table', classes: ['data-table'], index: 1, of: 1,
    ancestors: REPORT_WRAP }, 'table-layout');
  ok(one.winner !== null && one.winner.value === 'auto',
     'C2 and the single-panel table is still auto');
  /* the wrap modifier too */
  const inTable = REPORT_WRAP.concat([
    { tag: 'table', classes: ['data-table', 'data-table-cmp'], index: 1, of: 1 },
    { tag: 'tbody', classes: [], index: 2, of: 2 }, { tag: 'tr', classes: [], index: 1, of: 1 }]);
  const wrap = cascade.resolve(CSS_SRC,
    { tag: 'td', classes: ['num', 'num-text'], index: 3, of: N, ancestors: inTable }, 'white-space');
  ok(wrap.winner !== null && wrap.winner.value === 'normal',
     'C3 a text cell in a numeric column still wraps');
  const num = cascade.resolve(CSS_SRC,
    { tag: 'td', classes: ['num'], index: 3, of: N, ancestors: inTable }, 'white-space');
  ok(num.winner !== null && num.winner.value === 'nowrap',
     'C4 and a numeric cell still nowraps');
});

/* =================== G: CLCPA-245 clip detection ===================== */
say('');
say('=== G. the label tooltip, which measures a width ====================');
guard('G: the clip math cannot have moved', () => {
  const code = codeOnly(SRC);
  ok(/data-label-tip="\$\{escapeHtml\(labelText\)\}"/.test(code),
     'G1 data-label-tip is still emitted');
  const emit = /data-col="0" class="ingest-cell ingest-cell-label"/.test(code);
  ok(emit, 'G2 and ONLY on the data-col="0" input, which is the row label');
  ok((code.match(/data-label-tip/g) || []).length ===
     (codeOnly(BASE_SRC).match(/data-label-tip/g) || []).length,
     'G3 the same number of sites as BASE');
  /* the label column is the one column this ticket leaves alone */
  const lab = cascade.resolve(CSS_SRC,
    { tag: 'input', classes: ['ingest-cell', 'ingest-cell-label'], index: 1, of: 1,
      ancestors: EDIT_WRAP.concat([{ tag: 'table', classes: ['ingest-grid'], index: 1, of: 1 },
        { tag: 'tbody', classes: [], index: 2, of: 2 }, { tag: 'tr', classes: [], index: 1, of: 1 },
        { tag: 'td', classes: ['ingest-td-label'], index: 1, of: N }]) }, 'text-align');
  ok(lab.winner !== null && lab.winner.value === 'left',
     'G4 and it still resolves LEFT, so scrollWidth measures what it did before');
  const base = cascade.resolve(CSS_BASE, { tag: 'input',
    classes: ['ingest-cell', 'ingest-cell-label'], index: 1, of: 1,
    ancestors: EDIT_WRAP.concat([{ tag: 'table', classes: ['ingest-grid'], index: 1, of: 1 },
      { tag: 'tbody', classes: [], index: 2, of: 2 }, { tag: 'tr', classes: [], index: 1, of: 1 },
      { tag: 'td', classes: ['ingest-td-label'], index: 1, of: N }]) }, 'text-align');
  ok(base.winner && base.winner.value === lab.winner.value,
     'G5 identical to BASE, so the tooltip fires on exactly the labels it did');
  ok((SRC.match(/scrollWidth/g) || []).length ===
     (BASE_SRC.match(/scrollWidth/g) || []).length,
     'G6 and the number of scrollWidth readers is unchanged');
});

/* =================== P: the populations, for Emelys pass ============= */
say('');
say('=== P. what moves, counted through the real renderer =================');
let CENSUS = null;
guard('P: every table and year, one render each', () => {
  const LINES = SRC.split('\r\n');
  const TOP = [];
  LINES.forEach((ln, n) => {
    const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([LINES.length]);
  const find = (nm) => {
    const k = TOP.findIndex(d => d.name === nm);
    return k < 0 ? null : LINES.slice(TOP[k].line, bound[k + 1]).join('\n');
  };
  const parts = []; const have = new Set();
  const add = (n) => { if (have.has(n)) return false; const f = find(n); if (!f) return false;
    have.add(n); parts.push(f); return true; };
  ['renderSourceTables', 'columnNumericMask', 'getTableSchema'].forEach(add);
  let api = null;
  const attempt = (call) => {
    for (let r = 0; r < 300; r++) {
      try {
        if (!api) api = new Function('PAYLOAD', parts.join('\n\n') +
          '\n;if (typeof state !== "undefined") state.payload = PAYLOAD;' +
          '\n;return { renderSourceTables, columnNumericMask, getTableSchema };')(P);
        return call();
      } catch (e) {
        const m = /(\w+) is not defined/.exec(e.message);
        if (m && add(m[1])) { api = null; continue; }
        throw e;
      }
    }
  };
  const c = { th: 0, label: 0, num: 0, numText: 0, plain: 0, dacYes: 0 };
  const numTextBy = {}, plainBy = {};
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach(y => {
      let h;
      try { h = attempt(() => api.renderSourceTables([t], y, {}, id)); } catch (e) { return; }
      c.th += (h.match(/<th[^>]*>/g) || []).length;
      (h.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || []).forEach(row => {
        (row.match(/<td([^>]*)>([\s\S]*?)<\/td>/g) || []).forEach((x, i) => {
          const cls = (/class="([^"]*)"/.exec(x) || [, ''])[1];
          if (i === 0) { c.label++; return; }
          if (/\bnum-text\b/.test(cls)) { c.numText++; numTextBy[id] = (numTextBy[id] || 0) + 1; return; }
          if (/\bnum\b/.test(cls)) { c.num++; return; }
          if (/dac-yes/.test(cls)) { c.dacYes++; return; }
          c.plain++; plainBy[id] = (plainBy[id] || 0) + 1;
        });
      });
    });
  });
  CENSUS = c;
  ok(c.th === 798, 'P1 header cells, left -> centre (first column excepted): ' + c.th);
  ok(c.label === 1386, 'P2 row labels, LEFT and untouched: ' + c.label);
  /* +4 for CLCPA-319: G1 files no feet figure in 2023 or 2024, so declaring
   * that column gives four EMPTY cells the numeric alignment class. P6 below
   * loses the same four, which is what proves nothing gained content. */
  ok(c.num === 3769, 'P3 .num values, right -> centre: ' + c.num);
  ok(c.numText === 261, 'P4 text in a numeric column, follows its column: ' + c.numText);
  ok(JSON.stringify(numTextBy) ===
     '{"A3":7,"A4":7,"A5":81,"A6":45,"A7":5,"A8":69,"C2":15,"I1":28,"J1":2,"J2":2}',
     'P5 and they are in these ten tables: ' + JSON.stringify(numTextBy));
  /* -4, the same four P3 gained */
  ok(c.plain === 670, 'P6 text cells in the 20 TEXT columns, LEFT and unmoved ' +
     'after round 2: ' + c.plain);
  /* THIRTEEN now: G1's quantity column is declared, so it leaves the plain
   * text census entirely rather than contributing two empty cells to it. */
  ok(Object.keys(plainBy).length === 13,
     'P7 across thirteen tables: ' + Object.keys(plainBy).sort().join(','));
  ok(c.dacYes === 0, 'P8 and .dac-yes is emitted on zero cells, so its retired ' +
     'centring rule never centred anything');
  /* the editor population, from the SAME mask, must match cell for cell */
  let edLabel = 0, edNum = 0, edText = 0;
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    const hl = t.header_levels !== undefined ? t.header_levels : 1;
    Object.keys(t.data || {}).sort().forEach(y => {
      const schema = attempt(() => api.getTableSchema(t, y));
      const rows = t.data[y] || [];
      if (!rows.length || !schema) return;
      const mask = attempt(() => api.columnNumericMask(schema, rows.slice(Math.max(0, hl - 1)), id));
      rows.slice(Math.max(0, hl - 1)).forEach(() => {
        for (let k = 0; k < schema.length; k++) {
          if (k === 0) edLabel++; else if (mask[k]) edNum++; else edText++;
        }
      });
    });
  });
  ok(edLabel === c.label, 'P9 the editor has the same 1,386 label cells: ' + edLabel);
  ok(edNum === c.num + c.numText,
     'P10 and the same numeric population, 3,765 + 261 = ' + edNum);
  ok(edText === c.plain, 'P11 and the same 674 text cells: ' + edText);
});

guard('P: the named populations Emely asked to see', () => {
  let comp = 0; const compT = {};
  Object.keys(P.tables).forEach(id => {
    Object.keys(P.tables[id].data || {}).forEach(y => {
      (P.tables[id].data[y] || []).forEach(r => (r || []).forEach(v => {
        if (typeof v === 'string' && /^[\d.,]+ \(\d+%\)$/.test(v.trim())) { comp++; compT[id] = 1; }
      }));
    });
  });
  ok(comp === 15 && Object.keys(compT).join(',') === 'C2',
     'P12 the CLCPA-216 "value (pct)" composites: ' + comp + ' in ' + Object.keys(compT).join(','));
  const two = Object.keys(P.tables).filter(id => P.tables[id].header_levels === 2);
  ok(two.join(',') === 'A9,A10,F6', 'P13 the two-level bands: ' + two.join(','));
  let band = 0;
  two.forEach(id => Object.keys(P.tables[id].data || {}).forEach(y => {
    const r = (P.tables[id].data[y] || [])[0];
    if (r) band += r.length - 1;
  }));
  ok(band === 42, 'P14 and 42 band cells past column 1 move with them: ' + band);
});

/* =================== T: what makes a column a TEXT column ============ */
say('');
say('=== T. the column test, and the twenty columns that read left =======');
guard('T: the mask is the rule, and the alternative is measured not asserted', () => {
  const LINES = SRC.split('\r\n');
  const TOP = [];
  LINES.forEach((ln, n) => {
    const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([LINES.length]);
  const find = (nm) => {
    const k = TOP.findIndex(d => d.name === nm);
    return k < 0 ? null : LINES.slice(TOP[k].line, bound[k + 1]).join('\n');
  };
  const parts = []; const have = new Set();
  const add = (n) => { if (have.has(n)) return false; const f = find(n); if (!f) return false;
    have.add(n); parts.push(f); return true; };
  ['columnNumericMask', 'getTableSchema', 'isWhollyNumeric', 'cellText'].forEach(add);
  let api = null;
  const attempt = (call) => {
    for (let r = 0; r < 300; r++) {
      try {
        if (!api) api = new Function('PAYLOAD', parts.join('\n\n') +
          '\n;if (typeof state !== "undefined") state.payload = PAYLOAD;' +
          '\n;return { columnNumericMask, getTableSchema, isWhollyNumeric, cellText };')(P);
        return call();
      } catch (e) {
        const m = /(\w+) is not defined/.exec(e.message);
        if (m && add(m[1])) { api = null; continue; }
        throw e;
      }
    }
  };
  const cols = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    const years = Object.keys(t.data || {}).sort();
    if (!years.length) return;
    const hl = t.header_levels !== undefined ? t.header_levels : 1;
    const schema = attempt(() => api.getTableSchema(t, years[years.length - 1]));
    if (!schema) return;
    const body = [];
    years.forEach(y => (t.data[y] || []).slice(Math.max(0, hl - 1)).forEach(r => body.push(r)));
    const mask = attempt(() => api.columnNumericMask(schema, body, id));
    for (let c = 1; c < schema.length; c++) {
      let numeric = 0, text = 0;
      body.forEach(r => {
        const v = attempt(() => api.cellText((r || [])[c]));
        const str = v == null ? '' : String(v).trim();
        if (str === '') return;
        if (attempt(() => api.isWhollyNumeric(str))) numeric++; else text++;
      });
      cols.push({ id, c, header: String(schema[c] == null ? '' : schema[c]),
        mask: !!mask[c], numeric, text, majorityText: (numeric + text) > 0 && text > numeric });
    }
  });
  ok(cols.length === 177, 'T1 value columns across every table: ' + cols.length);
  const byMask = cols.filter(c => !c.mask);
  const byMaj = cols.filter(c => c.majorityText);
  ok(byMask.length === 20, 'T2 TEXT by the MASK, which is the shipped rule: ' + byMask.length);
  ok(byMaj.length === 15, 'T3 TEXT by majority-of-cells, the alternative: ' + byMaj.length);
  const disagree = cols.filter(c => (!c.mask) !== c.majorityText);
  ok(disagree.length === 13, 'T4 and they disagree on ' + disagree.length + ' columns, ' +
     'which is why the choice had to be measured');
  /* THE TWO THAT DECIDE IT. Majority would move the CLCPA-216 composite
   * columns Emely ruled stay centred, and I1's pair that passed in round 1. */
  const c2 = cols.filter(c => c.id === 'C2' && c.majorityText && c.mask);
  ok(c2.length === 2 && c2.every(c => c.text === 5 && c.numeric === 2),
     'T5 majority would send C2s two composite columns LEFT on 5 text against ' +
     '2 numeric, and the ruling says they stay centred: ' +
     c2.map(c => '"' + c.header + '"').join(', '));
  const i1 = cols.filter(c => c.id === 'I1' && c.majorityText && c.mask);
  ok(i1.length === 2 && i1.every(c => c.text === 14 && c.numeric === 13),
     'T6 and I1s Unique / Non-Unique on a margin of 14 to 13, which passed ' +
     'round 1 centred');
  /* THE ENUMERATION Emely asked for, so her pass has the list */
  const byTable = {};
  byMask.forEach(c => { (byTable[c.id] = byTable[c.id] || []).push(c); });
  ok(Object.keys(byTable).length === 12,
     'T7 the twenty text columns sit in twelve tables: ' +
     Object.keys(byTable).sort().join(', '));
  Object.keys(byTable).sort().forEach(id => {
    say('       ' + id.padEnd(4) + ' ' + byTable[id].map(c =>
      'col' + c.c + (c.header ? ' "' + c.header + '"' : ' (unnamed)')).join(', '));
  });
  /* every column Emely named by hand, checked one by one */
  [['A3', 'Program Name'], ['A4', 'Program Name'], ['C1', 'Category'],
   ['C1', 'Description'], ['D1', 'Description'], ['F1', 'Description'],
   ['F5', 'Borough / County'], ['F6', 'Borough / County']].forEach(([id, h]) => {
    const hit = cols.filter(c => c.id === id && c.header.indexOf(h) >= 0);
    ok(hit.length > 0 && hit.every(c => !c.mask),
       'T8 ' + id + ' "' + h + '" is classified TEXT and reads left');
  });
  /* and the ones that must NOT flip */
  ['Non-Excludable', 'Excludable', 'Grand Total'].forEach(h => {
    const hit = cols.filter(c => c.id === 'F5' && c.header.indexOf(h) >= 0);
    ok(hit.length > 0 && hit.every(c => c.mask),
       'T9 F5 "' + h + '" stays NUMERIC and centred');
  });
});

/* =================== X: the exclusions and the baseline ============== */
say('');
say('=== X. CSS only, and the baseline ===================================');
guard('X: app.js is byte-identical to BASE', () => {
  /* CLCPA-249 IS STILL CSS ONLY. What changed is that LATER tickets are not:
   * Section C group A moved three functions in app.js, so byte-identity of
   * the whole file stopped being a statement about THIS ticket and became a
   * statement about everything since. Narrowed to the claim that is actually
   * CLCPA-249's: it touched no JavaScript, so every function it could have
   * touched is unchanged, and any function that DID move is named by a later
   * ticket. Re-pinned, not relaxed -- an unnamed change still turns it red. */
  const names = [...new Set((SRC.match(/(?:^|\r\n)[ \t]*(?:async )?function (\w+)\s*\(/g) || [])
    .map(m => /function (\w+)/.exec(m)[1]))];
  const grabFn = (n, src) => {
    const lines = src.split('\r\n');
    for (const pad of ['  ', '    ', '']) {
      const decl = new RegExp('^' + pad + '(?:async )?function ' + n + '\\s*\\(');
      const anyDecl = new RegExp('^' + pad + '(?:async )?function \\w+\\s*\\(');
      const start = lines.findIndex(l => decl.test(l));
      if (start < 0) continue;
      const close = pad + '}';
      for (let i = start + 1; i < lines.length; i++) {
        if (lines[i] === close) return lines.slice(start, i + 1).join('\r\n');
        if (anyDecl.test(lines[i])) break;
      }
      return null;
    }
    return null;
  };
  const changed = names.filter(n => grabFn(n, SRC) !== grabFn(n, BASE_SRC));
  const LATER = {
    /* re-pinned, named so the count stays exact */
    xlsxInstructionBlocks: 'NOT this ticket: CLCPA-282 operator-prose sweep: the workbook instructions and one rejection message say how many heading rows a table has',
    /* re-pinned, named so the count stays exact */
    ingestStagedSummary: 'NOT this ticket: CLCPA-300: the staged summary counts the columns that receive values',
    /* re-pinned, named so the count stays exact */
    derivedPctCols: 'NOT this ticket: CLCPA-294: a declared percentage column is always scaled, never guessed by value size',
    fmtDerivedCell: 'NOT this ticket: CLCPA-294: a declared percentage column is always scaled, never guessed by value size',
    renderTable: 'NOT this ticket: CLCPA-294: a declared percentage column is always scaled, never guessed by value size',
    formatCell: 'NOT this ticket: CLCPA-294: a declared percentage column is always scaled, never guessed by value size',
    /* re-pinned, named so the count stays exact */
    xlsxCell: 'NOT this ticket: CLCPA-274 option (c): a populated year exports its values, and a number is written as a number',
    /* CLCPA-291, named so the count stays exact */
    ingestTextOnlyColumn: 'NOT this ticket: CLCPA-291: a text column in a structure row is (no value), not (calculated) (new)',
    /* CLCPA-304, named so the count stays exact */
    parseB2Plugs: 'NOT this ticket: CLCPA-304: Section Bs plug counts read the shared schema reader, so a year created by import stops parsing every count as zero',
    /* CLCPA-307 and CLCPA-310, named so the count stays exact */
    unitNoticeValue: 'NOT this ticket: CLCPA-310: the fraction advisory formats the value it shows, so a floating point artifact stops reaching operator-facing text (new)',
    /* CLCPA-302, named so the count stays exact */
    diffRows: 'NOT this ticket: CLCPA-302: the history counts operator changes only, applying the same two exclusions the Confirm-save dialog applies, so the record and the sentence the operator approved cannot disagree',
    resolveTablePrivileges: 'NOT this ticket: CLCPA-302, and the NAME is the extractors doing rather than mine: grabFn over-reads this function by 42kB and its slice swallows the dvBackend saveTable whose diffRows call now passes tableId. The function itself is byte-identical, 2376 bytes on both builds',
    /* CLCPA-246, named so the count stays exact */
    dacCell: 'NOT this ticket: CLCPA-246: COMMENT ONLY. A fallback to the display view was written here, measured to change nothing on the path the app actually uses, and removed. The note records why, so the next reader does not rebuild it',
    /* CLCPA-319, named so the count stays exact */
    isTotalOnlyDerived: 'NOT this ticket: CLCPA-319: G1 to G9s total row is computed from the rows beneath it, so the report follows its own figures instead of showing a stored copy (a columnTotal is derived on the total row alone)',
    totalRowFlags: 'NOT this ticket: CLCPA-319: G1 to G9s total row is computed from the rows beneath it, so the report follows its own figures instead of showing a stored copy (a columnTotal column CONFIRMS a total, so it is not skipped)',
    /* CLCPA-293 / A-10, named so the count stays exact */
    ingestRebuildableTotals: 'NOT this ticket: CLCPA-293 / A-10: a total the engine cannot derive is accepted from the preparer instead of being discarded in silence (new: it asks the engine which totals it can rebuild)',
    renderPreparerTotalsNotice: 'NOT this ticket: CLCPA-293 / A-10: a total the engine cannot derive is accepted from the preparer instead of being discarded in silence (new: the advisory that names one)',
    /* CLCPA-241 advisory, named so the count stays exact */
    renderKeptFigureNotice: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (new: the amber advisory that names a kept figure)',
    /* CLCPA-241 option (B), named so the count stays exact */
    applyDerivedCols: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten',
    stripDerivedForPersist: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (the strip refuses a kept cell)',
    derivedCellWrite: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (new)',
    derivedFiledReproduced: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (new)',
    unreconciledDerivedCols: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (new)',
    /* CLCPA-287 round 2, named so the count stays exact */
    ingestKeyColDescription: 'NOT this ticket: CLCPA-287 round 2: a key-column rejection names an unheaded column by role, not by its empty heading (new)',
    /* CLCPA-292 round 2, named so the count stays exact */
    ingestTemplateSource: 'NOT this ticket: CLCPA-292 round 2: a fresh-year template borrows its structure from a PUBLISHED year, never from a scratch one',
    /* CLCPA-282, named so the count stays exact */
    ingestHeaderKeys: 'NOT this ticket: CLCPA-282: a column on a two-level table is identified by its header PAIR (new)',
    ingestHeaderName: 'NOT this ticket: CLCPA-282: a column on a two-level table is identified by its header PAIR, and this names one for a message (new)',
    wireIngestPage: 'NOT this ticket: CLCPA-283: the remove-year handler it wires, and its refusal toast',
    /* CLCPA-283, named so the count stays exact */
    isYearProtected: 'NOT this ticket: CLCPA-283: a year the operator added is removable, data and all; protection is seed-year only',
    boot: 'NOT this ticket: CLCPA-283: a year the operator added is removable, data and all; protection is seed-year only (the seedYears note it carries)',
    /* CLCPA-301, named so the count stays exact */
    applyIngestImport: 'NOT this ticket: CLCPA-301: the import path computes the row total the importer deliberately left blank',
    fillDerivableSumsOnImport: 'NOT this ticket: CLCPA-301: the import path computes the row total the importer deliberately left blank (new)',
    /* CLCPA-281 round 3, named so the count stays exact */
    compareColWidths: 'NOT this ticket: CLCPA-281 round 3: the read-only surfaces ask the per-year header question through storedHeaderRowsInYear',
    storedHeaderRowsInYear: 'NOT this ticket: CLCPA-281 round 3: the read-only surfaces ask the per-year header question through storedHeaderRowsInYear (new)',

    /* CLCPA-269 r2, 270, 274, 275, 276, 277, 278 -- the review follow-up package of 2026-09-17. */

    ingestRowIsStoredHeader: 'CLCPA-274 round 3: is this row a stored header, by its blank label (new)',
    ingestYearCarriesHeaderRows: 'CLCPA-274 round 3: does THIS year carry them, or must it borrow (new)',
    ingestStoredHeaderRows: 'CLCPA-274 round 3: the table\'s own header rows, from a year that has them (new)',
    columnGrandTotals: 'CLCPA-278 round 3: and the engine\'s own summing, which is how recomputeTotals adds',
    ingestHeaderRowCount: 'CLCPA-274 round 2: how many leading data[] rows are really header, shared by the editor and the template writer (new)',
    rerenderIngestEditor: 'CLCPA-276 round 2: the editor repaint now repaints the notice mount beside it',
    ingestRoleOpen: 'CLCPA-270 amendment (the A8 ruling): the value half of the protection follows derivability (new)',
    ingestRowRole: 'CLCPA-270: the row role, from its label (new)',

    isTotalRoleLabel: 'CLCPA-270: the total-role label test (new)',

    isComputedShareLabel: 'CLCPA-270: a percentage OF A TOTAL (new)',

    rowSumIsConsistent: 'CLCPA-278: whose figure is this total (new)',

    recomputeDerivableSums: 'CLCPA-278: a consistent total follows the edit (new)',

    clearIngestNotices: 'CLCPA-276: one helper for every notice exit (new)',

    declaredYearFromFilename: 'CLCPA-277: the year token in a filename (new)',

    importYearNotice: 'CLCPA-277: the wrong-year advisory (new)',

    /* CLCPA-250, 267, 271, 272, 273 -- the eight-ticket wave of 2026-09-16. */

    shiftSchemaYears: 'CLCPA-267: the borrowed-schema year shift (new)',

    getTableSchema: 'CLCPA-267: its fallback shifts the donor year',

    isPercentLiteral: 'CLCPA-273: the percent predicate, lifted out of buildIngestImport (new)',

    noteTypedPercent: 'CLCPA-273: records a percent typed into a cell (new)',

    renderTypedUnitNotice: 'CLCPA-273: the typed advisory, in the amber box (new)',

    refreshIngestNotices: 'CLCPA-273: repaints the notice mount in place (new)',

    wireIngestEditor: 'CLCPA-273: the blur handler reads the text before the parse',

    loadIngestDraft: 'CLCPA-273: clears the typed advisories on a table-year change',

    renderIngestImport: 'CLCPA-273 and CLCPA-272: the mount carries both advisories',

    refreshIngestCalcCells: 'CLCPA-271: calc cells keep their column format on repaint',

    dacDerivedTablesForYear: 'CLCPA-250: one year of display tables (new)',

    recomputeYearDerived: 'CLCPA-250: the composer KPI pass, re-runnable (new)',

    recomposeYearIfComposed: 'CLCPA-250: the composed-source gate (new)',

    composePayloadFromRows: 'CLCPA-250: it resolves a schema through getTableSchema',

    buildYearSelector: 'CLCPA-250: a year change re-derives that year',

    detectSumColumns: 'CLCPA-272: the schema-derived sum relationship (new)',

    reconcileSumColumns: 'CLCPA-272: the reconciliation itself (new)',

    renderReconcileNotice: 'CLCPA-272: the reconciliation advisory box (new)',
    ingestComputed: 'CLCPA-253, Section C group A',
    openSaveModal: 'CLCPA-256, Section C group A',
    openAddYearDialog: 'CLCPA-262, Section C group A',
    stagedBlock: 'CLCPA-264: nested in openAddYearDialog, it renders the identity advisory',
    declaredTableFromFilename: 'CLCPA-264: the filename extractor (new)',
    importIdentityNotice: 'CLCPA-264: the import identity advisory (new)',
    rowsForDisplay: 'CLCPA-263: it derives the value (pct) composites on its clone',
    applyCompositeShares: 'CLCPA-263: the derivation (new)',
    isCompositeShareCol: 'CLCPA-263: the declaration predicate (new)',
    compositeValueText: 'CLCPA-263: the value formatting (new)',
    bareNumber: 'CLCPA-263: the bare-number test (new)',
    wire: 'CLCPA-262, nested inside openAddYearDialog',
    tableCaption: 'CLCPA-252, Section C group B',
    deriveTableCaption: 'CLCPA-252 round 2: the derivation (new)',
    stripCaptionYear: 'CLCPA-252 round 3: the caption year strip (new)',
    deriveTableCaptionInfo: 'CLCPA-252 round 2: the three strategies (new)',
    dacCol: 'NOT this ticket: CLCPA-257, Section C group C: dacCols newest-year fallback',
    phantomSpacerCols: 'NOT this ticket: CLCPA-260, Section C group D: the phantom spacer columns, new',
    buildIngestWorkbook: 'NOT this ticket: CLCPA-260, Section C group D: the phantom spacer columns, the template stops emitting them',
    renderSourceTables: 'CLCPA-252, Section C group B',
    renderIngestEditor: 'CLCPA-252, Section C group B; and CLCPA-255, group E',
    renderSectionC: 'CLCPA-259, Section C group B',
    isDeclaredSummable: 'CLCPA-254, Section C group E: the declared-summable column, new',
    recomputeTotals: 'CLCPA-254, Section C group E: it consults that declaration',
    buildIngestImport: 'CLCPA-261, Section C group E: it collects the fraction notices',
    renderIngestImportResult: 'CLCPA-261, Section C group E: the summary announces them',
    /* CLCPA-293 round 4, named so the count stays exact */
    isB7PreparerTotal: 'NOT this ticket: CLCPA-293 round 4: an explicit registry of totals that BELONG TO THE PREPARER because the engine cannot honestly derive them (new: the membership test)',
    B7_PREPARER_TOTALS: 'NOT this ticket: CLCPA-293 round 4: an explicit registry of totals that BELONG TO THE PREPARER because the engine cannot honestly derive them (new: the registry itself)',
  };
  changed.forEach(n => ok(n in LATER,
     'X1 app.js function ' + n + ' moved, and it is named by a later ticket' +
     (n in LATER ? ': ' + LATER[n] : ' -- NO, it is unaccounted for')));
  ok(changed.every(n => n in LATER),
     'X1b CLCPA-249 itself touched no JavaScript: every moved function (' +
     changed.length + ') belongs to a later ticket');
});
guard('X: the stylesheet changed, and only where it should', () => {
  ok(CSS_SRC !== CSS_BASE, 'X2 styles.css did change');
  const strip = (c) => cascade.stripComments(c).css.replace(/\s+/g, ' ').trim();
  ok(strip(CSS_SRC) !== strip(CSS_BASE), 'X2b and not only in its comments');
  /* THE RULE SET, BY NAME. A count is the weaker statement and my first cut
   * of this assertion carried a guessed one: I wrote four, the file says
   * nine out and two in. Naming them cannot be satisfied by an accident. */
  const sels = (c) => cascade.parseRules(cascade.stripComments(c).css)
    .map(r => r.selectorText.replace(/\s+/g, ' ').trim());
  const cnt = (l) => l.reduce((m, s) => ((m[s] = (m[s] || 0) + 1), m), {});
  const a = cnt(sels(CSS_BASE)), b = cnt(sels(CSS_SRC));
  const removed = Object.keys(a).filter(k => (a[k] || 0) > (b[k] || 0)).sort();
  const added = Object.keys(b).filter(k => (b[k] || 0) > (a[k] || 0)).sort();
  /* LATER TICKETS retire and add rules here too, and each is named so this
   * inventory stays an exact statement rather than a widened one. CLCPA-266
   * folded the six .ingest-import-result rules into a shared component, so
   * the single-selector forms leave and the combined forms arrive. */
  const EXPECT_REMOVED = [
    '.ingest-import-result',
    '.ingest-import-result h4',
    '.ingest-import-result h4 ~ h4',
    '.ingest-import-result li',
    '.ingest-import-result p',
    '.ingest-import-result ul',
    '.data-table tbody tr td:nth-child(2):not(.num), .data-table tbody tr td:nth-child(3):not(.num)',
    '.data-table th',
    '.data-table th:first-child',
    '.data-table th:not(.num), .data-table td:not(.num)',
    '.data-table thead tr th:nth-child(2), .data-table thead tr th:nth-child(3)',
    '.data-table td:first-child',
    '.data-table-2level thead th',
    '.data-table-2level thead th:first-child',
    '.data-table-2level thead tr:nth-child(2) th',
  ].sort();
  const EXPECT_ADDED = [
    /* CLCPA-266: the shared notice-box component and its two accents */
    '.ingest-import-notice.is-alert',
    '.ingest-import-notice.is-warn',
    '.ingest-import-result > :last-child, .ingest-import-notice > :last-child',
    '.ingest-import-result h4 ~ h4, .ingest-import-notice h4 ~ h4',
    '.ingest-import-result h4, .ingest-import-notice h4',
    '.ingest-import-result li, .ingest-import-notice li',
    '.ingest-import-result p, .ingest-import-notice p',
    '.ingest-import-result ul, .ingest-import-notice ul',
    '.ingest-import-result, .ingest-import-notice',
    /* .ingest-staged-warn is NOT repeated here: the CLCPA-264 round already
     * named it further down, and listing it twice made this inventory claim
     * fourteen additions where the stylesheet has thirteen. CLCPA-266 restyles
     * that rule rather than adding it. */
    '.data-table th, .data-table td',
    '.data-table td:not(.num)',
    '.data-table thead tr:first-child > th:first-child, .data-table tbody tr > td:first-child',
    /* CLCPA-264 added a FOURTH rule: the import identity advisory. Named here
     * rather than excused, so this list stays an exact inventory of what the
     * stylesheet gained since BASE. */
    '.ingest-staged-warn',
    /* CLCPA-275 added a FIFTH: the gap below a trailing notice stack, so it
     * clears the card that follows it the way stacked cards already do.
     * Named here rather than excused, for the same reason as the line above. */
    '.ingest-import-result:last-child, .ingest-import-notice:last-child',
    /* The black-button ticket added a SIXTH: + Add Row keeps its resting
     * background on hover and on active. Scoped to the control, like the
     * #ingest-template patch beside it, because CLCPA-85 round 2 ruled that
     * a shared rule is not restyled to fix individual controls. Named here
     * rather than excused, for the same reason as the two lines above. */
    '#ingest-add-row:hover, #ingest-add-row:active',
  ].sort();
  ok(JSON.stringify(removed) === JSON.stringify(EXPECT_REMOVED),
     'X3 exactly these NINE rules were retired: ' + removed.length +
     (JSON.stringify(removed) === JSON.stringify(EXPECT_REMOVED) ? '' :
      '  GOT ' + JSON.stringify(removed)));
  ok(JSON.stringify(added) === JSON.stringify(EXPECT_ADDED),
     'X3b and exactly these were added, each named above: ' +
     'first column scoped so it cannot catch a sub-header: ' + added.length);
});
guard('X: the baseline', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X4 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: REPO }); anc = true; }
  catch (e) {}
  ok(anc, 'X5 and an ancestor of HEAD');
});

lines.forEach(l => console.log(l));
console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n  ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
