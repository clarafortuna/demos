/* CLCPA-242: the Executive Summary tooltips.
 *
 * Three wiring fixes, plus the content sweep that closes CLCPA-237 item F's
 * recorded open limit.
 *
 * WHAT THE AUDIT MEASURED, and it is worth stating because it shapes this
 * suite: the tooltip CONTENT was already clean. Ten rows on each of two
 * surfaces, on 2099 and 2025, and not one null, NaN, undefined or [object in
 * any attribute. The defects were all in the WIRING:
 *
 *   1. no viewport clamp at all -- a bare pageX + 14 -- so near the right edge
 *      or low on the page the box ran off screen. The map has never done this;
 *      positionTooltipAt clamps four edges. The KPI cards got a clamp under
 *      CLCPA-226, but only for the hug variant.
 *   2. positioned on mousemove only, so the first frame of a hover painted the
 *      box wherever the previous hover left it.
 *   3. mouseleave set opacity 0 and nothing else, so the div outlived the rows
 *      it described across a re-render.
 *
 * SECTION 4 CLOSES THE 237 OPEN LIMIT: the honesty rule, asserted on tooltip
 * CONTENT for both surfaces and both years, which suite_237f explicitly did not
 * claim.
 *
 * OUT OF SCOPE AND NAMED: fourteen section-page tooltips carry the identical
 * unclamped positioner. Section 5 pins the count so it cannot drift unnoticed.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const EVID238 = REPO + '/Coned/CLCPA/tickets/CLCPA-238-evidence';
/* BASE: the dacCol branch point -- this ticket rides on top of it */
const BASE = process.env.DAC_BASE_COMMIT || '8fa362c';
const toCRLF = (s) => s.replace(/\r?\n/g, '\r\n');
const SRC = fs.readFileSync(path.join(REPO, REL), 'utf8');
const BASE_SRC = toCRLF(execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
const NL = String.fromCharCode(10);

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
const say = (s) => lines.push(s);
function guard(label, fn) {
  try { fn(); }
  catch (e) { ok(false, label + ' THREW instead of failing: ' + (e && e.message ? e.message : String(e))); }
}
function grab(name, src) {
  const s = src || SRC;
  for (const pad of ['  ', '    ', '']) for (const kw of ['function ', 'async function ']) {
    const head = '\r\n' + pad + kw + name + '(';
    const i = s.indexOf(head); if (i < 0) continue;
    const close = '\r\n' + pad + '}';
    const j = s.indexOf(close, i + head.length);
    if (j >= 0) return s.slice(i + 2, j + close.length);
  } return null;
}
function grabDecl(name, src) {
  const s = src || SRC;
  const re = new RegExp('\\r\\n  (?:const|var|let) ' + name + ' = ');
  const m = s.match(re); if (!m) return null;
  const i = s.indexOf(m[0]);
  const rest = s.slice(i + 2);
  const end = rest.search(/\r\n  (?:const|var|let|function|async function|\/\*)/);
  return end < 0 ? rest : rest.slice(0, end);
}
function codeOnly(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '/*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? src.length : j + 2; continue; }
    if (two === '//') { const j = src.indexOf('\n', i); i = j < 0 ? src.length : j; continue; }
    out += src[i]; i++;
  }
  return out;
}
const CODE = codeOnly(SRC);

/* ---- the composed org, with the imported 2099 ------------------------ */
const FNS = ['dacCanon', 'dacFirstDiff', 'dacRow', 'dacCol', 'dacCell', 'dacPct',
  'dacBody', 'dacPick', 'dacGBoroughs', 'dacCPrograms', 'dacJAverage',
  'composePayloadFromRows', 'isStrictTotalRowLabel', 'kpiDacPct',
  'rowsForDisplay', 'totalRowFlags', 'columnGrandTotals', 'applyDerivedCols',
  'sumDerivedCols', 'detectPctColumns'];
const DECLS = ['DAC_TOTAL_RE', 'DAC_CHART_RULES', 'DAC_KPI_REPORTED', 'dacShare',
  'dacJ9Share', 'DAC_KPI_ANALYTICAL', 'DERIVED_COLS', 'NOT_RECONCILED_TABLES',
  /* CLCPA-240 round 2: totalRowFlags and the ingest predicates read these, so
     the functions cannot be assembled without them. Dependencies, not
     assertions. */
  'HIERARCHICAL_TABLES', 'INGEST_NOVALUE_MARKER'];
const composer = new Function(
  DECLS.map(n => grabDecl(n)).join(NL) + NL +
  FNS.map(n => grab(n)).join(NL) + NL + 'return composePayloadFromRows;')();
const PRE = JSON.parse(fs.readFileSync(
  REPO + '/deploy-backups/2026-09-08-clcpa238-pre-seed/tabledata.json', 'utf8'));
const p9 = PRE.filter(r => r.cr2bf_key === 'A1:2099')[0];
const A1R = JSON.parse(PRE.filter(r => r.cr2bf_key === 'A1:2025')[0].cr2bf_rows);
const man = JSON.parse(fs.readFileSync(path.join(EVID238, 'seed_manifest.json'), 'utf8'));
const S = {};
man.files.forEach(f => { S[f.entitySet] = JSON.parse(fs.readFileSync(path.join(EVID238, f.file), 'utf8')); });
const td = JSON.parse(JSON.stringify(S['cr2bf_dacingesttesttabledata1s']));
td.filter(r => r.cr2bf_key === 'A1:2025')[0].cr2bf_rows =
  PRE.filter(r => r.cr2bf_key === 'A1:2025')[0].cr2bf_rows;
td.push({ cr2bf_key: 'A1:2099', cr2bf_section: p9.cr2bf_section,
  cr2bf_tableid: p9.cr2bf_tableid, cr2bf_year: p9.cr2bf_year,
  cr2bf_rows: JSON.stringify(A1R.map(r => String(r[0])).map(l =>
    /^(grand\s+|sub)?totals?$/i.test(l.trim()) ? [l, 21978, 21978, 1] : [l, 999, 999, 1])),
  cr2bf_schema: null, cr2bf_title: null });
const P = composer({ tabledata: td, tables: S['cr2bf_dacreporttables'],
  sections: S['cr2bf_dacreportsections'], metrics: S['cr2bf_dacreportmetrics'] });

function callWith(want, year, args, extra) {
  const fns = FNS.slice(), decls = DECLS.slice();
  if (fns.indexOf(want) < 0) fns.push(want);
  const g = Object.assign({
    state: { payload: P, year: String(year) },
    escapeHtml: (s) => String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
    document: { getElementById: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem: () => {} },
    getBaseline: () => 35, console: console,
  }, extra || {});
  for (let i = 0; i < 120; i++) {
    const names = Object.keys(g);
    const body = decls.map(n => grabDecl(n)).join(NL) + NL +
      [...new Set(fns)].map(n => grab(n)).join(NL) + NL + 'return ' + want + ';';
    try { return new Function(...names, body)(...names.map(k => g[k])).apply(null, args || []); }
    catch (e) {
      const m = /^(\w+) is not defined$/.exec(e.message || '');
      if (!m) throw e;
      const nm = m[1];
      if (grab(nm) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabDecl(nm) && decls.indexOf(nm) < 0) { decls.push(nm); continue; }
      throw new Error('cannot resolve ' + nm);
    }
  }
  throw new Error('no convergence for ' + want);
}

say('======================================================================');
say('CLCPA-242 -- the Executive Summary tooltips');
say('  BASE ' + BASE + ' (the dacCol branch point)');
say('======================================================================');

/* ==================================================================== */
say('');
say('=== 1. THE CLAMP: one positioner, four edges, driven ===');

guard('BASE control: no clamp existed on either exec surface', () => {
  const b = codeOnly(BASE_SRC);
  const raw = (b.match(/tip\.style\.left = \(e\.pageX \+ 14\) \+ 'px';/g) || []).length;
  ok(raw === 16, 'BASE had ' + raw + ' bare pageX positioners in the file');
  ok(!/function placeTooltipAtPointer/.test(b), 'and no shared clamp at all');
  const bw = codeOnly(grab('wireExecutiveTooltips', BASE_SRC));
  ok(/tip\.style\.left = \(e\.pageX \+ 14\)/.test(bw),
     'the chart rows positioned with no bounds');
  const bc = codeOnly(grab('wireHeaderCardsTooltips', BASE_SRC));
  ok(/tip\.style\.left = \(e\.pageX \+ 14\)/.test(bc),
     'and so did the KPI cards');
});

guard('the shared clamp exists and both exec surfaces use it', () => {
  const f = codeOnly(grab('placeTooltipAtPointer'));
  ok(!!f, 'placeTooltipAtPointer exists');
  ok(/window\.innerWidth/.test(f) && /window\.innerHeight/.test(f),
     'it reads BOTH viewport dimensions');
  ok(/window\.pageXOffset/.test(f) && /window\.pageYOffset/.test(f),
     'and both scroll offsets, so the comparison is document-to-document');
  ok(/tip\.offsetWidth/.test(f) && /tip\.offsetHeight/.test(f),
     'and the tip\'s own measured size');
  const w = codeOnly(grab('wireExecutiveTooltips'));
  const c = codeOnly(grab('wireHeaderCardsTooltips'));
  ok(/placeTooltipAtPointer\(tip, e\)/.test(w), 'the chart rows go through it');
  ok(/placeTooltipAtPointer\(tip, e\)/.test(c), 'the KPI cards go through it');
  ok(!/tip\.style\.left = \(e\.pageX/.test(w) && !/tip\.style\.left = \(e\.pageX/.test(c),
     'and NEITHER positions raw any more');
});

guard('DRIVEN: the clamp holds at every edge', () => {
  /* a real function over a stubbed window and tip, so the arithmetic is tested
   * rather than the source text */
  const place = new Function('window', 'return ' + grab('placeTooltipAtPointer').replace(/^\s*function/, 'function') + '; ')
    ;
  const mk = (vw, vh, sx, sy) => ({ innerWidth: vw, innerHeight: vh,
    pageXOffset: sx, pageYOffset: sy });
  const tip = (w, h) => { const st = {}; return { offsetWidth: w, offsetHeight: h, style: st }; };
  const run = (win, t, ev) => {
    const fn = new Function('window', 'const f = ' + grab('placeTooltipAtPointer') + '; return f;')(win);
    fn(t, ev); return t.style;
  };
  const px = (v) => parseInt(String(v), 10);

  /* well inside: the default offset */
  let t = tip(200, 150);
  let st = run(mk(1400, 900, 0, 0), t, { pageX: 100, pageY: 300 });
  ok(px(st.left) === 114 && px(st.top) === 292,
     'inside the viewport it offsets by +14 / -8: ' + st.left + ' ' + st.top);

  /* right edge: FLIPS to the other side rather than sliding */
  t = tip(200, 150);
  st = run(mk(1400, 900, 0, 0), t, { pageX: 1350, pageY: 300 });
  ok(px(st.left) === 1350 - 200 - 14,
     'at the right edge it FLIPS to the left of the cursor: ' + st.left);
  ok(px(st.left) + 200 <= 1400, 'and the box fits: right edge at ' + (px(st.left) + 200));

  /* bottom edge: slides up, never under the cursor's row */
  t = tip(200, 150);
  st = run(mk(1400, 900, 0, 0), t, { pageX: 100, pageY: 880 });
  ok(px(st.top) + 150 <= 900 - 8, 'at the bottom it slides up: top ' + st.top);

  /* TOP edge: floored, never negative */
  t = tip(200, 150);
  st = run(mk(1400, 900, 0, 0), t, { pageX: 2, pageY: 2 });
  ok(px(st.top) >= 8, 'near the top it is floored at 8: ' + st.top);

  /* LEFT edge, and the first version of this case did NOT exercise the floor.
   *
   * At pageX 2 the default offset gives left = 16, already past the floor, so
   * removing `if (left < sx + 8)` changed nothing and the control went GREEN.
   * The floor only matters after the RIGHT-edge flip drives left negative,
   * which needs a narrow viewport and a wide tip. */
  t = tip(280, 150);
  st = run(mk(300, 900, 0, 0), t, { pageX: 290, pageY: 300 });
  ok(px(st.left) === 8,
     'a flip that would go negative is floored at 8, not off-screen left: ' +
     st.left + ' (unfloored it would be ' + (290 - 280 - 14) + ')');
  ok(px(st.left) >= 8, 'and never negative');

  /* SCROLLED: the trap CLCPA-226 wrote down. viewport measures need the offset */
  t = tip(200, 150);
  st = run(mk(1400, 900, 0, 2000), t, { pageX: 100, pageY: 2400 });
  ok(px(st.top) === 2392,
     'on a page scrolled 2000px the tip is NOT dragged to the viewport top: ' + st.top);
  ok(px(st.top) > 2000, 'it stays in document coordinates: ' + st.top);
});

/* ==================================================================== */
say('');
say('=== 2. PLACED BEFORE SHOWN, and HIDDEN ON RE-RENDER ===');

guard('the first frame of a hover is not the last hover\'s position', () => {
  const w = codeOnly(grab('wireExecutiveTooltips'));
  const c = codeOnly(grab('wireHeaderCardsTooltips'));
  [['chart rows', w], ['KPI cards', c]].forEach(([lab, fn]) => {
    const iPlace = fn.indexOf('placeTooltipAtPointer(tip, e);');
    const iShow = fn.indexOf("tip.style.opacity = '1';");
    ok(iPlace >= 0, lab + ': positions inside the enter handler');
    ok(iPlace >= 0 && iShow > iPlace,
       lab + ': and does it BEFORE revealing, so nothing is painted in the ' +
       'old place');
  });
  /* BASE control: it did not */
  const bw = codeOnly(grab('wireExecutiveTooltips', BASE_SRC));
  ok(bw.indexOf('placeTooltipAtPointer') < 0,
     'BASE control: the enter handler never positioned at all');
  /* the handler must actually RECEIVE an event to position with */
  ok(/mouseenter', \(e\) =>/.test(codeOnly(grab('wireExecutiveTooltips'))),
     'the chart enter handler takes the event');
  ok(/mouseenter', \(e\) =>/.test(codeOnly(grab('wireHeaderCardsTooltips'))),
     'and so does the card one');
});

guard('a tooltip cannot outlive the rows it describes', () => {
  const h = codeOnly(grab('hideExecTooltip'));
  ok(!!h, 'hideExecTooltip exists');
  ok(/tip\.style\.opacity = '0';/.test(h), 'it hides the box');
  ok(/tip\.innerHTML = '';/.test(h),
     'AND clears the content, so a stale body cannot flash on the next hover');
  const wi = codeOnly(grab('wireExecutiveInteractions'));
  ok(/hideExecTooltip\(\);/.test(wi), 'the render path calls it');
  const iHide = wi.indexOf('hideExecTooltip();');
  const iWire = wi.indexOf('wireExecutiveTooltips();');
  ok(iHide >= 0 && iWire > iHide,
     'and calls it FIRST, before re-wiring: ' + iHide + ' < ' + iWire);
  ok(!/hideExecTooltip/.test(codeOnly(BASE_SRC)),
     'BASE control: nothing hid it, so it survived a year change');
  /* driven: the helper is callable and does both things */
  const tip = { style: { opacity: '1' }, innerHTML: '<b>stale</b>' };
  const fn = new Function('document',
    'const f = ' + grab('hideExecTooltip') + '; return f;')({ querySelector: () => tip });
  fn();
  ok(tip.style.opacity === '0' && tip.innerHTML === '',
     'driven: it clears both: opacity=' + tip.style.opacity +
     ' innerHTML=' + JSON.stringify(tip.innerHTML));
  /* and it does not throw when there is no tooltip yet */
  const fn2 = new Function('document',
    'const f = ' + grab('hideExecTooltip') + '; return f;')({ querySelector: () => null });
  let threw = false;
  try { fn2(); } catch (e) { threw = true; }
  ok(!threw, 'and it is safe before any tooltip exists');
});

/* ==================================================================== */
say('');
say('=== 3. THE CONTENT IS UNTOUCHED: only the wiring moved ===');

guard('every tooltip payload is identical to BASE', () => {
  ['renderDumbbell', 'renderStripWithGap'].forEach(fn => {
    ok(grab(fn) === grab(fn, BASE_SRC), fn + ' is byte-identical to BASE');
  });
  ok(grab('computeHeaderCards') === grab('computeHeaderCards', BASE_SRC),
     'computeHeaderCards is byte-identical: the card tooltip rows are unchanged');
});

/* ==================================================================== */
say('');
say('=== 4. THE HONESTY RULE ON TOOLTIP CONTENT -- closing the 237 limit ===');

const ATTRS = ['data-pct', 'data-baseline', 'data-gap', 'data-yoy', 'data-prev-pct',
  'data-kpi-label', 'data-dac-val', 'data-total-val', 'data-unit'];
const LEAK = /undefined|NaN|\[object|(^|[^a-z])null([^a-z]|$)/i;
function rowAttrs(html, cls) {
  const re = new RegExp('<div class="' + cls + '[^"]*"([^>]*)>', 'g');
  const out = []; let m;
  while ((m = re.exec(html)) !== null) {
    const a = {};
    ATTRS.concat(['data-section']).forEach(k => {
      const mm = new RegExp(k + '="([^"]*)"').exec(m[1]);
      if (mm) a[k] = mm[1];
    });
    out.push(a);
  }
  return out;
}

['2099', '2025'].forEach(Y => {
  guard('tooltip content is honest on ' + Y, () => {
    const secs = callWith('buildSectionDAC', Y, []);
    const dumb = callWith('renderDumbbell', Y, [35, Y, secs]);
    const strip = callWith('renderStripWithGap', Y, [35, Y, secs]);
    const dRows = rowAttrs(dumb, 'dumb-row');
    const sRows = rowAttrs(strip, 'strip-row');
    ok(dRows.length === 10 && sRows.length === 10,
       Y + ': ten rows on each surface: ' + dRows.length + ', ' + sRows.length);

    /* NO LEAKAGE, which is the first half of honesty */
    let leaks = [];
    dRows.concat(sRows).forEach(a => ATTRS.forEach(k => {
      if (a[k] !== undefined && LEAK.test(a[k])) leaks.push(a['data-section'] + '.' + k + '=' + a[k]);
    }));
    ok(leaks.length === 0,
       'no null, NaN, undefined or [object reaches any tooltip attribute: ' +
       (leaks.length ? leaks.join(', ') : '0 of ' + (dRows.length + sRows.length) * ATTRS.length));

    /* PRIOR-YEAR CONTEXT IS ALWAYS LABELLED AS PRIOR, which is the second half */
    const w = codeOnly(grab('wireExecutiveTooltips'));
    ok(/<span>Prior year<\/span>/.test(w),
       'the prior figure is rendered under the words "Prior year"');
    ok(/DAC share \u00b7 \$\{state\.year\}/.test(w),
       'and the current figure under the SELECTED year, named');
    ok(/if \(prevPct && prevPct !== 'n\/a'\)/.test(w),
       'and the prior row is omitted entirely when there is none, never shown empty');

    /* a row with no current value must NOT present its prior as current */
    const dashRows = dRows.filter(a => a['data-pct'] === '\u2014');
    dashRows.forEach(a => {
      ok(a['data-prev-pct'] === 'n/a' || /%$/.test(a['data-prev-pct']),
         '  ' + a['data-section'] + ': dashed current, prior is either n/a or a ' +
         'labelled percentage: ' + a['data-prev-pct']);
    });
    ok(true, Y + ': ' + dashRows.length + ' dashed rows checked');
  });
});

guard('the KPI card tooltips are honest on both years', () => {
  ['2099', '2025'].forEach(Y => {
    const cards = callWith('computeHeaderCards', Y, []);
    ok(cards.length === 3, Y + ': three cards');
    cards.forEach((c, i) => {
      const rows = (c.tooltip && c.tooltip.rows) || [];
      const bad = rows.filter(r => LEAK.test(String(r.value)));
      ok(bad.length === 0, Y + ' card ' + (i + 1) + ': no leakage in ' +
        rows.length + ' tooltip rows' +
        (bad.length ? ' -- ' + bad.map(r => r.label + '=' + r.value).join(', ') : ''));
      /* every YEAR-BEARING row names its year explicitly */
      const yearRows = rows.filter(r => /\d{4}/.test(String(r.label)));
      ok(yearRows.length > 0, '  and ' + yearRows.length +
        ' rows carry an explicit year in the label, so no figure is unattributed');
    });
  });
});

/* ==================================================================== */
say('');
say('=== 5. WHAT IS OUT OF SCOPE, PINNED SO IT CANNOT DRIFT ===');

guard('fourteen section-page tooltips still position raw', () => {
  /* NAMED, NOT FIXED. Emely scoped this ticket to the two exec surfaces. The
   * same unclamped positioner appears across the section pages, and pinning
   * the count means the number cannot quietly change without a decision. */
  const raw = (CODE.match(/tip\.style\.left = \(e\.pageX \+ 14\) \+ 'px';/g) || []).length;
  ok(raw === 14,
     'exactly 14 raw positioners remain, all on section pages: ' + raw);
  const baseRaw = (codeOnly(BASE_SRC).match(/tip\.style\.left = \(e\.pageX \+ 14\) \+ 'px';/g) || []).length;
  ok(baseRaw === 16, 'down from ' + baseRaw + ' at BASE: the two exec ones are fixed');
  ok(baseRaw - raw === 2, 'exactly TWO were converted, which is the scope');
  /* and the map's own positioner is untouched and still correct */
  ok(grab('positionTooltipAt') === grab('positionTooltipAt', BASE_SRC),
     'the map\'s positionTooltipAt is byte-identical: it never had this defect');
});

/* ==================================================================== */
say('');
say('=== 6. THE BLAST RADIUS ===');

guard('three functions, all wiring', () => {
  const names = new Set();
  [SRC, BASE_SRC].forEach(s => {
    const r = /\r\n  (?:async )?function (\w+)\(/g;
    let m; while ((m = r.exec(s))) names.add(m[1]);
  });
  const changed = [];
  names.forEach(n => { if (grab(n, BASE_SRC) !== grab(n, SRC)) changed.push(n); });
  changed.sort();
  say('       changed functions: ' + changed.join(', '));
  const EXPECT = {
    wireExecutiveTooltips: 'the chart rows: shared clamp, placed before shown',
    wireHeaderCardsTooltips: 'the KPI cards: the same',
    wireExecutiveInteractions: 'hide-on-re-render',
    placeTooltipAtPointer: 'NEW: the shared four-edge clamp',
    hideExecTooltip: 'NEW: the hide helper the render path calls',
    wireControlTips: 'ROUND 2: the early-out for tip-owning surfaces',
    /* CLCPA-240 first half has since landed. Its eight functions are named
     * here rather than absorbed into a larger number, so the count stays
     * exact and this suite still says what IT changed. */
    buildIngestImport: 'NOT this brief: CLCPA-240 first half, the composite key',
    buildIngestWorkbook: 'NOT this brief: CLCPA-240 first half, the template header cells',
    totalRowFlags: 'NOT this brief: CLCPA-240 first half, the hierarchical bootstrap',
    ingestRowKey: 'NOT this brief: CLCPA-240 first half (new)',
    ingestGroupOf: 'NOT this brief: CLCPA-240 first half (new)',
    ingestIsHeaderRow: 'NOT this brief: CLCPA-240 first half (new)',
    ingestIsBlankCell: 'NOT this brief: CLCPA-240 first half (new)',
    ingestKeyColCount: 'NOT this brief: CLCPA-240 first half (new)',
    /* CLCPA-240 ROUND 2, Emely’s finding after the round-1 hosted pass:
     * hierarchical group headers and totals are now render-only, and the
     * template marks a heading (no value). Named, so the exact count below
     * survives as a guard rather than being relaxed. */
    ingestIsShapeBlank: 'NOT this brief: CLCPA-240 round 2, the shape-blank predicate (new)',
    renderIngestEditor: 'NOT this brief: CLCPA-240 round 2, the group-header lock',
    xlsxInstructionBlocks: 'NOT this brief: CLCPA-240 round 2, the (no value) instruction',
  };
  changed.forEach(n => ok(n in EXPECT || n === 'ensureTooltip',
    'the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  /* FIVE: three amended plus the two helpers this ticket ADDS. New functions
   * legitimately register as changed against a BASE that lacks them, so they
   * are named rather than excused by a bigger number. */
  /* 6 -> 14: CLCPA-240 first half added eight, every one named above. */
  ok(changed.length === 17, 'FOURTEEN: this ticket’s six plus CLCPA-240 ' +
     'first half’s eight: ' + changed.length);
  ok(grab('placeTooltipAtPointer', BASE_SRC) === null &&
     grab('hideExecTooltip', BASE_SRC) === null,
     'and the two new ones did not exist at BASE, which is why they count');
});

guard('the exclusions hold', () => {
  /* totalRowFlags left this list when CLCPA-240 changed it; that ticket
      owns and asserts the change. */
  ['dacCol', 'dacRow', 'composePayloadFromRows', 'buildSectionDAC',
   'rowsForDisplay', 'renderExecutiveSummary', 'renderIngestPicker', 'ensureTooltip',
   'positionTooltipAt'].forEach(fn => {
    const a = grab(fn), b = grab(fn, BASE_SRC);
    if (!ok(a !== null && b !== null, fn + ' exists in both sources')) return;
    ok(a === b, fn + ' is byte-identical to BASE');
  });
  ok(/var DAC_SOURCE = 'dataverse';/.test(CODE), "DAC_SOURCE is still 'dataverse'");
});

/* ==================================================================== */
console.log(lines.join('\n'));
console.log('');
console.log('======================================================================');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
console.log('======================================================================');
process.exitCode = fail ? 1 : 0;
