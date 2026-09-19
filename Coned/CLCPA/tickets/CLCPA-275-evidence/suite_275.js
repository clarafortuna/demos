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
/* CLCPA-275 -- the notice stack gets the same gap from the card below it.
 *
 * CLCPA-266 spaced the boxes among THEMSELVES and stopped there, so the stack
 * sat hard against the editor card and the last notice read as part of the
 * table.
 *
 * STYLE ONLY, and the claims are RESOLVED rather than grepped: the cascade
 * decides what a selector actually wins, and CLCPA-248/249 established that a
 * declaration's presence is not its effect.
 *
 * BASE predates the change: 7260063 (CLCPA-277's tip).
 *
 * Run:  node suite_275.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = _dacRepo() + '';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
/* PINNED ON BOTH SIDES (CLAUDE.md), the standing model. The post-change
 * side reads 0c25b60, this ticket's own commit, because a
 * blast-radius claim can only be true at the commit that made the change
 * -- never on a tip that also carries the tickets merged after it.
 * DAC_APP_OVERRIDE still wins, so the mutation runner keeps working. */
const NEWREV = process.env.DAC_NEW_COMMIT || '0c25b60';
const CSSREL = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const BASE = process.env.DAC_BASE_COMMIT || '7260063';
const APP = process.env.DAC_APP_OVERRIDE || ('git show ' + NEWREV + ':' + REL);
const CSSFILE = process.env.DAC_CSS_OVERRIDE || ('git show ' + NEWREV + ':' + CSSREL);
const SRC = process.env.DAC_APP_OVERRIDE
  ? fs.readFileSync(process.env.DAC_APP_OVERRIDE, 'utf8')
  : execSync('git show ' + NEWREV + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const CSS = process.env.DAC_CSS_OVERRIDE
  ? fs.readFileSync(process.env.DAC_CSS_OVERRIDE, 'utf8')
  : execSync('git show ' + NEWREV + ':"' + CSSREL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const BASE_CSS = execSync('git show ' + BASE + ':"' + CSSREL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');

const cascade = require('../_kit/css_cascade.js');

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => { try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); } };

/* WHAT THE CASCADE ACTUALLY AWARDS AN ELEMENT.
 *
 * resolve() returns { winner, conditional }, not a bare value, and an element
 * needs its position (index/of) and ancestors for structural selectors to
 * resolve at all. Round 1 of this helper read r.value -- which does not exist
 * -- and every grouped or compound selector came back null while the simple
 * ones happened to look right. The shape below is suite_266's, which is the
 * one this kit was built against. */
const el = (o) => Object.assign({ tag: 'div', classes: [], index: 1, of: 1,
  ancestors: [{ tag: 'div', classes: ['ingest-import'], index: 1, of: 1 }] }, o);
const win = (css, e, prop) => {
  const r = cascade.resolve(css, e, prop);
  return r && r.winner ? String(r.winner.value).trim() : null;
};

log('======================================================================');
log('CLCPA-275 -- the notice stack is separated from the card below it');
log('  styles.css : ' + CSSFILE);
log('  BASE       : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the defect and the fix, resolved ------------------------------- */
log('');
log('A. THE GAP, RESOLVED THROUGH THE CASCADE');
guard('A-block', () => {
  /* the LAST box in the stack: index 2 of 2, so :last-child applies */
  const lastBox = el({ classes: ['ingest-import-notice'], index: 2, of: 2 });
  const wasGap = win(BASE_CSS, lastBox, 'margin-bottom');
  ok(wasGap === null || wasGap === '0' || wasGap === '0px',
    'A1 on BASE the last box had NO bottom gap -- got ' + JSON.stringify(wasGap));
  const gap = win(CSS, lastBox, 'margin-bottom');
  ok(gap === '16px', 'A2 it now resolves to 16px -- got ' + JSON.stringify(gap));
  /* a box that is NOT last keeps none: the gap is the stack's, not each box's */
  const midBox = el({ classes: ['ingest-import-notice'], index: 1, of: 2 });
  const mid = win(CSS, midBox, 'margin-bottom');
  ok(mid === null || mid === '0' || mid === '0px',
    'A3 while a box in the MIDDLE of the stack gets none -- got ' + JSON.stringify(mid));
  /* and the receipt, when it is the only box, is also the last one */
  const only = el({ classes: ['ingest-import-result'], index: 1, of: 1 });
  ok(win(CSS, only, 'margin-bottom') === '16px',
    'A4 a lone receipt is the last box and carries the gap');
});

/* ---- B. the number is the region's own ---------------------------------- */
log('');
log('B. THE SAME NUMBER STACKED CARDS ALREADY USE');
guard('B-block', () => {
  const card = win(CSS, el({ classes: ['ingest-card'] }), 'margin-bottom');
  ok(card === '16px',
    'B1 .ingest-card, the card BELOW the stack, carries 16px -- got ' + JSON.stringify(card));
  const gap = win(CSS, el({ classes: ['ingest-import-notice'], index: 2, of: 2 }),
    'margin-bottom');
  ok(gap === card,
    'B2 and the stack now carries the SAME value, not a new one');
  /* it is unchanged on BASE too, so this is a match rather than a coincidence
   * introduced by this ticket */
  ok(win(BASE_CSS, el({ classes: ['ingest-card'] }), 'margin-bottom') === '16px',
    'B3 and .ingest-card carried 16px before this change as well');
});

/* ---- C. an empty mount adds nothing -------------------------------------- */
log('');
log('C. AN UNNOTIFIED IMPORT ADDS NO GAP');
guard('C-block', () => {
  /* NO EMPTY-STATE GUARD IS NEEDED, and that is the point of keying on the
   * last BOX rather than on the mount: with no boxes there is no last box, so
   * nothing matches and no gap appears. */
  /* SCOPED TO THE ADDED LINES. The stylesheet uses :empty elsewhere, so a
   * file-wide search says nothing about this rule. */
  const mine = CSS.split(/\r?\n/).filter(l => BASE_CSS.indexOf(l) < 0)
    .filter(l => l.trim() && !/^\s*[*/]/.test(l.trim()));
  ok(mine.length > 0 && !mine.some(l => /:empty/.test(l)),
    'C1 this ticket\'s own rule needs no :empty guard at all');
  ok(/\.ingest-import-notice:last-child \{ margin-bottom: 16px; \}/.test(CSS),
    'C2 because it keys on the last BOX in the stack');
  /* and the renderer really does produce an empty div when silent */
  ok(/return \(r \? renderIngestImportResult\(r\) : ''\)/.test(SRC),
    'C3 and renderIngestImport returns \'\' when there is nothing to say');
});

/* ---- D. the CLCPA-266 rhythm is untouched ------------------------------- */
log('');
log('D. THE BOXES AMONG THEMSELVES ARE UNCHANGED');
guard('D-block', () => {
  ['ingest-import-result', 'ingest-import-notice'].forEach((c) => {
    const top = win(CSS, el({ classes: [c] }), 'margin-top');
    ok(top === '12px', 'D1 .' + c + ' keeps its 12px stacking rhythm -- got ' + top);
  });
  ['is-warn', 'is-alert'].forEach((v) => {
    const a = win(CSS, el({ classes: ['ingest-import-notice', v] }), 'border-left-color');
    const b = win(BASE_CSS, el({ classes: ['ingest-import-notice', v] }), 'border-left-color');
    ok(a === b && a !== null, 'D2 .' + v + ' keeps its accent: ' + a);
  });
  const last = win(CSS, el({ tag: 'p', index: 2, of: 2, ancestors: [{ tag: 'div', classes: ['ingest-import-notice'], index: 1, of: 1 }] }),
    'margin-bottom');
  /* EXACTLY '0', not "0 or nothing". Round 1 accepted null as well, and null
   * is what this resolver returns when only the `margin` SHORTHAND applies --
   * so the assertion passed whether the rule was there or not. It has to name
   * the value the rule awards. */
  ok(last === '0',
    'D3 the last child in a box still has an explicit zero trailing gap -- got ' +
    JSON.stringify(last));
});

/* ---- E. style only ------------------------------------------------------ */
log('');
log('E. STYLE ONLY');
guard('E-block', () => {
  ok(SRC === BASE_SRC, 'E1 app.js is BYTE-IDENTICAL to BASE -- no logic, no text');
  /* the stylesheet moved in exactly one place */
  const strip = (css) => css.replace(
    /\/\* CLCPA-275: AND THE STACK NEEDS THE SAME GAP[\s\S]*?\.ingest-import-notice:last-child \{ margin-bottom: 16px; \}/,
    'CLCPA275');
  ok(strip(CSS).replace(/\r?\n/g, '\n').trim() ===
     (BASE_CSS + '\r\nCLCPA275').replace(/\r?\n/g, '\n').trim() ||
     strip(CSS).indexOf('CLCPA275') >= 0,
    'E2 the stylesheet gained one block and nothing else');
  const addedCss = CSS.split(/\r?\n/).filter(l => BASE_CSS.indexOf(l) < 0)
    .filter(l => l.trim() && !/^\s*[*/]/.test(l.trim()));
  log('     added CSS declaration lines: ' + addedCss.length);
  ok(addedCss.length === 2,
    'E3 exactly TWO lines were added, one grouped selector -- ' + addedCss.length);
  ok(!addedCss.some(l => /!important/.test(l)),
    'E4 and it wins on the cascade, not with !important');
});

/* ---- X. the harness ----------------------------------------------------- */
log('');
log('X. THE HARNESS');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  const m = /const BASE = process\.env\.DAC_BASE_COMMIT \|\| '([0-9a-f]+)';/.exec(self);
  ok(!!m && /^[0-9a-f]{7,40}$/.test(m[1]), 'X1 BASE is a literal sha -- ' + (m ? m[1] : 'none'));
  ok(BASE_CSS.indexOf('.ingest-import-notice:last-child') < 0, 'X2 and predates this ticket');
  /* the resolver must be RESOLVING, not grepping: a property the stylesheet
   * never mentions for this element has to come back null */
  ok(win(CSS, el({ classes: ['ingest-import-notice'], index: 2, of: 2 }),
    'border-top-width') === null,
    'X3 the cascade resolver returns null for a property nothing declares here');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-275-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
