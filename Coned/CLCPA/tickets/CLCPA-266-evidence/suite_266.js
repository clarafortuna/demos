/* CLCPA-266: every post-load notice is a BOX, in one component.
 *
 * THE DEFECT, verified on build b1108e5fcf: only "Imported into the draft" had
 * a box. CLCPA-261's fraction notice and CLCPA-264's identity notice emitted
 * .ingest-import-notice, which had NO rule anywhere in styles.css, so both
 * rendered as loose text under the one box that did.
 *
 * STYLE ONLY, and this suite's first duty is proving that: both notices stay
 * advisory, nothing is rejected, and not one word of notice text moves.
 *
 * WHY THE STYLE ASSERTIONS RESOLVE THE CASCADE rather than grepping for rule
 * text. CLCPA-248 and CLCPA-249 both shipped a stylesheet whose declarations
 * were present and INERT -- eight of them, across 105 element shapes. A
 * declaration's presence is not its effect. The shared resolver answers which
 * declaration actually WINS for a given element, which is the only form of
 * this claim worth making offline.
 *
 * WHAT THIS CANNOT DO: no browser runs here. Where the pixels land is Emely's
 * eye. What is proven is the winning declaration for each box, that the three
 * accents are three different colours, and that the boxes cannot touch.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const cascade = require('../_kit/css_cascade.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
/* PINNED ON BOTH SIDES (CLAUDE.md: "Pin both sides"). The post-change side
 * reads 2361a6a instead of the working tree --
 * main immediately before the 2026-09-16 wave, and the last commit at which
 * every suite in this tree was green. That is the build this suite was
 * written against and last proved.
 *
 * Both sides fixed makes this suite permanent evidence of what its ticket
 * shipped, and it can no longer be falsified by later work. NOT ONE
 * ASSERTION WAS CHANGED to achieve that: the claims are the claims, and
 * only the build they are asked about is now named.
 *
 * DAC_APP_OVERRIDE still wins, so the mutation runner keeps working. */
const NEWREV = process.env.DAC_NEW_COMMIT || '2361a6a';
const CSS = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-266-evidence/suite-266-output.txt');

/* BASE is mains tip, 11c22d6, which carries CLCPA-252 round 3.
 *
 * It was 2724b8d -- the commit this branch forked from -- and that was right
 * until round 3 merged into main while this ticket was in flight. With the
 * older pin this suite measured BOTH tickets and reported four changed
 * functions where CLCPA-266 changes one.
 *
 * 11c22d6 still PREDATES every line of this ticket, which is the rule that
 * matters; it simply no longer predates a ticket that has already landed. The
 * diff it measures is now exactly CLCPA-266's. */
const BASE = process.env.DAC_BASE_COMMIT || '11c22d6';
const APP = process.env.DAC_APP_OVERRIDE || ('git show ' + NEWREV + ':' + REL);
const CSS_PATH = process.env.DAC_CSS_OVERRIDE || path.join(REPO, CSS);

const SRC = process.env.DAC_APP_OVERRIDE
  ? fs.readFileSync(process.env.DAC_APP_OVERRIDE, 'utf8')
  : execSync('git show ' + NEWREV + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
/* DAC_CSS_PINNED: same pinned commit as app.js. A frozen suite must be frozen
 * on BOTH files, or it fails on a stylesheet change it is not about -- which
 * is what CLCPA-275 caused. */
const CSS_SRC = process.env.DAC_CSS_OVERRIDE
  ? fs.readFileSync(process.env.DAC_CSS_OVERRIDE, 'utf8')
  : execSync('git show ' + NEWREV + ':"' + CSS + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const CSS_BASE = execSync('git show ' + BASE + ':"' + CSS + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');

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

/* ---- the real renderer, assembled and driven ------------------------- */
function harness(src) {
  const L = src.split('\r\n');
  const TOP = [];
  L.forEach((ln, n) => {
    const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (nm) => {
    const k = TOP.findIndex(d => d.name === nm);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n');
  };
  const parts = [], have = new Set();
  const add = (n) => { if (have.has(n)) return false; const f = find(n); if (!f) return false;
    have.add(n); parts.push(f); return true; };
  add('renderIngestImportResult');
  let api = null;
  const attempt = (call) => {
    for (let r = 0; r < 200; r++) {
      try {
        if (!api) api = new Function('const state = { payload: { tables: {} } };\n' +
          parts.join('\n\n') + '\n;return { renderIngestImportResult };')();
        return call(api);
      } catch (e) {
        const m = /(\w+) is not defined/.exec(e.message);
        if (m && add(m[1])) { api = null; continue; }
        throw e;
      }
    }
    throw new Error('no convergence');
  };
  return { attempt };
}
const NEW = harness(SRC), OLD = harness(BASE_SRC);

/* the plan an operator actually produces: an import that succeeded AND raised
 * both advisories, which is the only state in which all three boxes appear */
const PLAN = () => ({
  ok: true, populated: [1, 2, 3], rejections: [],
  unitNotices: [
    { label: 'DAC', column: 'Committed Load Relief (MW)', read: '9%', landed: 0.09 },
    { label: 'Low-Income', column: 'Committed Load Relief (MW)', read: '3%', landed: 0.03 },
  ],
  identityNotice: 'This file is named for Table C3 (DAC Customers), but it is ' +
    'being imported into Table C4 (Low-Income). Those tables have identical ' +
    'column headings, so the wrong file can import cleanly and still be the ' +
    'wrong data. Check before saving.',
});
const html = () => String(NEW.attempt(api => api.renderIngestImportResult(PLAN())));
const htmlOld = () => String(OLD.attempt(api => api.renderIngestImportResult(PLAN())));

/* element shapes, described the way the browser sees them */
const box = (classes) => ({ tag: 'div', classes: classes, index: 1, of: 1,
  ancestors: [{ tag: 'div', classes: ['ingest-import'], index: 1, of: 1 }] });
const win = (el, prop) => {
  const r = cascade.resolve(CSS_SRC, el, prop);
  return { value: r.winner ? r.winner.value : null, sel: r.winner ? r.winner.sel : null,
           cond: r.conditional.length };
};

say('======================================================================');
say('CLCPA-266 -- every post-load notice is a box, one component, three accents');
say('  BASE ' + BASE);
say('======================================================================');

/* =============== D: the defect, and that it was real ================= */
say('');
say('=== D. the defect: .ingest-import-notice had no rule at all =========');
guard('D: BASE emitted the class and styled nothing', () => {
  ok(/ingest-import-notice/.test(htmlOld()),
     'D1 BASE already emitted .ingest-import-notice');
  ok(CSS_BASE.indexOf('.ingest-import-notice') < 0,
     'D2 and BASE styles.css contained NO rule for it -- the notices were loose text');
  /* the one box that did exist */
  ok(/\.ingest-import-result \{/.test(CSS_BASE),
     'D3 while .ingest-import-result had the box all along');
  ok(CSS_SRC.indexOf('.ingest-import-notice') >= 0,
     'D4 and this build styles it');
});

/* =============== B: one component, three accents ==================== */
say('');
say('=== B. one component: the three boxes resolve to the same box =======');
const SHAPES = {
  info: box(['ingest-import-result']),
  bad: box(['ingest-import-result', 'ingest-import-bad']),
  warn: box(['ingest-import-notice', 'is-warn']),
  alert: box(['ingest-import-notice', 'is-alert']),
};
guard('B: the box itself is identical across all three', () => {
  const SAME = ['padding', 'background', 'border-radius', 'border-left-width', 'margin-top'];
  SAME.forEach(prop => {
    const v = Object.keys(SHAPES).map(k => win(SHAPES[k], prop).value);
    const distinct = [...new Set(v)];
    ok(distinct.length === 1 && distinct[0] !== null,
       'B1 ' + prop + ' is the same on all four shapes: ' + JSON.stringify(distinct[0]));
  });
});

guard('B: and ONLY the accent differs', () => {
  const acc = {};
  Object.keys(SHAPES).forEach(k => { acc[k] = win(SHAPES[k], 'border-left-color'); });
  Object.keys(acc).forEach(k => ok(acc[k].value !== null,
    'B2 ' + k + ' resolves an accent: ' + JSON.stringify(acc[k].value) +
    '  (from ' + acc[k].sel + ')'));
  ok(acc.info.value === 'var(--dusk)', 'B3 info keeps the blue it always had');
  ok(acc.warn.value === 'var(--amber)', 'B4 the fraction notice is AMBER');
  ok(acc.alert.value === 'var(--red)', 'B5 the identity notice is RED');
  ok(acc.bad.value === 'var(--red)', 'B6 and the rejected case is still red');
  /* THREE DIFFERENT COLOURS, or the accents are decoration */
  ok(new Set([acc.info.value, acc.warn.value, acc.alert.value]).size === 3,
     'B7 the three post-load accents are three DIFFERENT colours');
  /* every accent is a TOKEN, not a literal: "no hardcoded colors scattered
   * per notice" */
  Object.keys(acc).forEach(k => ok(/^var\(--[a-z-]+\)$/.test(String(acc[k].value)),
    'B8 ' + k + ' uses a token, not a literal colour: ' + acc[k].value));
});

guard('B: the accent is the ONLY thing a variant declares', () => {
  /* a variant that also changed padding or background would be a second
   * component wearing the first one's name */
  const block = CSS_SRC.slice(CSS_SRC.indexOf('.ingest-import-notice.is-warn'));
  const warnRule = block.slice(0, block.indexOf('}') + 1);
  ok(/^\.ingest-import-notice\.is-warn \{ border-left-color: var\(--amber\); \}$/.test(warnRule.trim()),
     'B9 .is-warn declares border-left-color and nothing else: ' + warnRule.trim());
  const b2 = CSS_SRC.slice(CSS_SRC.indexOf('.ingest-import-notice.is-alert'));
  const alertRule = b2.slice(0, b2.indexOf('}') + 1);
  ok(/^\.ingest-import-notice\.is-alert \{ border-left-color: var\(--red\); \}$/.test(alertRule.trim()),
     'B10 and so does .is-alert: ' + alertRule.trim());
});

/* =============== T: the typography comes with the box =============== */
say('');
say('=== T. the text inside a notice is styled like the text inside the box =');
guard('T: h4, p, ul and li resolve identically in both classes', () => {
  const inResult = (tag) => ({ tag: tag, classes: [], index: 1, of: 3,
    ancestors: [box(['ingest-import-result'])] });
  const inNotice = (tag) => ({ tag: tag, classes: [], index: 1, of: 3,
    ancestors: [box(['ingest-import-notice', 'is-warn'])] });
  [['h4', 'font-size'], ['h4', 'color'], ['p', 'font-size'], ['p', 'color'],
   ['li', 'font-size'], ['li', 'line-height'], ['ul', 'padding-left']].forEach(([tag, prop]) => {
    const a = win(inResult(tag), prop).value, b = win(inNotice(tag), prop).value;
    ok(a !== null && a === b,
       'T1 ' + tag + ' ' + prop + ' matches in both: ' + JSON.stringify(a));
  });
});

guard('T: the per-cell detail lines are INSIDE the amber box', () => {
  const h = html();
  const i = h.indexOf('ingest-import-notice is-warn');
  const close = h.indexOf('</div>', i);
  const inner = h.slice(i, close);
  ok(/<ul>/.test(inner) && /<li>/.test(inner),
     'T2 the fraction box contains the per-cell list');
  ok((inner.match(/<li>/g) || []).length === 2,
     'T3 with one line per noticed cell: ' + (inner.match(/<li>/g) || []).length);
  ok(/Committed Load Relief/.test(inner), 'T4 naming the column');
});

/* =============== S: the boxes stack and cannot touch ================ */
say('');
say('=== S. stacking: three boxes, in order, never touching ==============');
guard('S: the panel emits three sibling boxes in the order the notices occur', () => {
  const h = html();
  const boxes = (h.match(/<div class="(ingest-import-(?:result|notice)[^"]*)"/g) || [])
    .map(x => /class="([^"]+)"/.exec(x)[1]);
  ok(boxes.length === 3, 'S1 three boxes: ' + boxes.length);
  ok(boxes[0] === 'ingest-import-result', 'S2 first the info box');
  ok(boxes[1] === 'ingest-import-notice is-warn', 'S3 then the fraction notice');
  ok(boxes[2] === 'ingest-import-notice is-alert', 'S4 then the identity notice');
  /* THE ORDER IS BASE's ORDER. CLCPA-266 reorders nothing. */
  const oldOrder = (htmlOld().match(/<div class="(ingest-import-(?:result|notice)[^"]*)"/g) || [])
    .map(x => /class="([^"]+)"/.exec(x)[1].replace(/ is-(warn|alert)/, ''));
  ok(JSON.stringify(oldOrder) ===
     JSON.stringify(boxes.map(b => b.replace(/ is-(warn|alert)/, ''))),
     'S5 and it is BASEs order, unchanged: ' + JSON.stringify(oldOrder));
});

guard('S: the spacing that keeps them apart', () => {
  const mt = win(SHAPES.warn, 'margin-top');
  ok(mt.value === '12px', 'S6 every box carries margin-top: ' + mt.value);
  ok(win(SHAPES.info, 'margin-top').value === mt.value,
     'S7 the same value the info box already used, so the rhythm is the panels own');
  /* a last child inside a box must not add a trailing gap */
  const lastP = { tag: 'p', classes: [], index: 3, of: 3,
    ancestors: [box(['ingest-import-notice', 'is-alert'])] };
  ok(win(lastP, 'margin-bottom').value === '0',
     'S8 and the last element inside a box has no trailing margin: ' +
     win(lastP, 'margin-bottom').value);
});

/* =============== M: the modal twin ================================== */
say('');
say('=== M. the staged warning matches its post-load twin ================');
guard('M: the modal advisory is a red-accented box too', () => {
  const staged = { tag: 'p', classes: ['ingest-staged-warn'], index: 2, of: 2,
    ancestors: [{ tag: 'div', classes: ['ingest-staged'], index: 1, of: 1 }] };
  ok(win(staged, 'border-left-color').value === 'var(--red)',
     'M1 the staged warning resolves the SAME red accent as its twin: ' +
     win(staged, 'border-left-color').value);
  ok(win(staged, 'border-left-width').value === '3px',
     'M2 and the same 3px accent edge');
  ok(win(staged, 'background').value === 'var(--white)', 'M3 and the same ground');
  /* it was amber text with no box at BASE */
  ok(/\.ingest-staged-warn \{[^}]*--warn-fg/.test(CSS_BASE),
     'M4 at BASE it was text coloured with var(--warn-fg)');
  ok(!/--warn-fg/.test(CSS_SRC.slice(CSS_SRC.indexOf('.ingest-staged-warn'),
     CSS_SRC.indexOf('}', CSS_SRC.indexOf('.ingest-staged-warn')))),
     'M5 and no longer uses it');
  /* --warn-fg is not defined ANYWHERE, which is why this matters */
  ok(!/^\s*--warn-fg\s*:/m.test(CSS_SRC),
     'M6 --warn-fg is not a defined token in this stylesheet, so it was ' +
     'resolving to its literal fallback');
  /* the modal layout is otherwise untouched: the staged box itself is unchanged */
  const sb = (css) => css.slice(css.indexOf('.ingest-staged {'),
    css.indexOf('}', css.indexOf('.ingest-staged {')) + 1);
  ok(sb(CSS_SRC) === sb(CSS_BASE),
     'M7 and .ingest-staged itself is byte-identical: no row added, no layout moved');
});

/* =============== L: STYLE ONLY ====================================== */
say('');
say('=== L. style only: no logic, no wording, no rejection ===============');
guard('L: the only app.js change is two class attributes', () => {
  const a = codeOnly(SRC), b = codeOnly(BASE_SRC);
  /* undo the two class additions and require app.js to be BASE exactly */
  const undone = SRC
    .split('<div class="ingest-import-notice is-warn">').join('<div class="ingest-import-notice">')
    .split('<div class="ingest-import-notice is-alert">').join('<div class="ingest-import-notice">')
    /* and the two comments that explain them */
    .replace(/\r\n      \/\* CLCPA-266: the AMBER accent[\s\S]*?\*\/\r\n/, '\r\n')
    .replace(/\r\n      \/\* CLCPA-266: the RED accent[\s\S]*?\*\/\r\n/, '\r\n');
  ok(undone === BASE_SRC,
     'L1 with the two class attributes undone, app.js is BYTE-IDENTICAL to BASE');
});

guard('L: the notices are still advisory and still say the same words', () => {
  const h = html(), o = htmlOld();
  /* every sentence BASE printed, this build prints */
  const text = (s) => String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  ok(text(h) === text(o),
     'L2 the rendered TEXT is identical to BASE, word for word');
  ok(/Read as a fraction: 2 cells/.test(h), 'L3 the fraction heading is unchanged');
  ok(/Check the table this file was for/.test(h), 'L4 and the identity heading');
  ok(/Review the values below, then press Save\. Nothing has been saved yet\./.test(h),
     'L5 and the CLCPA-234 reminder Emely approved verbatim');
  /* the plan is untouched: nothing was rejected */
  const p = PLAN();
  NEW.attempt(api => api.renderIngestImportResult(p));
  ok(p.ok === true && p.rejections.length === 0,
     'L6 rendering rejects nothing and does not touch the plan');
  /* and a plan with NO advisories renders exactly one box */
  const plain = { ok: true, populated: [1], rejections: [], unitNotices: [], identityNotice: null };
  const ph = String(NEW.attempt(api => api.renderIngestImportResult(plain)));
  ok((ph.match(/<div class="ingest-import-/g) || []).length === 1,
     'L7 a clean import still renders exactly ONE box');
});

/* =============== X: blast radius and baseline ======================= */
say('');
say('=== X. what else moved =============================================');
function grabFn(n, src) {
  const L = src.split('\r\n');
  for (const pad of ['  ', '    ', '']) {
    const decl = new RegExp('^' + pad + '(?:async )?function ' + n + '\\s*\\(');
    const anyDecl = new RegExp('^' + pad + '(?:async )?function \\w+\\s*\\(');
    const start = L.findIndex(l => decl.test(l));
    if (start < 0) continue;
    const close = pad + '}';
    for (let i = start + 1; i < L.length; i++) {
      if (L[i] === close) return L.slice(start, i + 1).join('\r\n');
      if (anyDecl.test(L[i])) break;
    }
    return null;
  }
  return null;
}
guard('X: the blast radius', () => {
  const names = [...new Set((SRC.match(/(?:^|\r\n)[ \t]*(?:async )?function (\w+)\s*\(/g) || [])
    .map(m => /function (\w+)/.exec(m)[1]))];
  const changed = names.filter(n => grabFn(n, SRC) !== grabFn(n, BASE_SRC));
  say('       changed: ' + changed.sort().join(', '));
  ok(changed.length === 1 && changed[0] === 'renderIngestImportResult',
     'X1 exactly ONE function changed, and it is the panel: ' + changed.join(', '));
  ['buildIngestImport', 'applyIngestImport', 'importIdentityNotice',
   'declaredTableFromFilename', 'openAddYearDialog'].forEach(n => {
    ok(grabFn(n, SRC) === grabFn(n, BASE_SRC), 'X2 ' + n + ' is byte-identical to BASE');
  });
});

guard('X: the stylesheet moved only where this ticket says', () => {
  /* the CLCPA-266 block and the restyled staged warning, and nothing else */
  const strip = (css) => css
    .replace(/\/\* ---- CLCPA-266: every post-load notice is a BOX[\s\S]*?\.ingest-import-notice > :last-child \{ margin-bottom: 0; \}/, 'CLCPA266')
    .replace(/\/\* CLCPA-264's import identity advisory, restyled by CLCPA-266[\s\S]*?font-weight: 500;\r?\n\}/, 'STAGEDWARN')
    .replace(/\/\* CLCPA-264: the import identity advisory\.[\s\S]*?font-weight: 500;\r?\n\}/, 'STAGEDWARN')
    .replace(/\.ingest-import-result \{[\s\S]*?\.ingest-import-result li \{[^}]*\}/, 'CLCPA266');
  ok(strip(CSS_SRC) === strip(CSS_BASE),
     'X3 with the two CLCPA-266 blocks masked, styles.css is identical to BASE');
  ok(CSS_SRC !== CSS_BASE, 'X4 and the stylesheet genuinely moved');
});

guard('X: the baseline', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X5 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: REPO }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'X6 and HEAD descends from it');
});

say('');
say('  ' + pass + ' passed, ' + fail + ' failed');
lines.forEach(l => console.log(l));
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
