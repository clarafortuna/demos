/* CLCPA-226: ten native `title` tooltips become the dashboard's own styled one.
 *
 * THE ONE-STRING RULE is the property that matters, and it is checked as a RULE
 * over every converted site rather than as ten literals: one set of words per
 * control, used as whichever ARIA relation is correct for that control. A
 * tooltip that disagrees with the accessible name gives sighted and screen
 * reader users two different answers to the same question -- the reasoning
 * already written at dsAboutButton, now enforced.
 *
 * ONE DEVIATION FROM THE RULING, reported not slipped: "tooltip === aria-label"
 * is correct where the tooltip IS the accessible name, i.e. a control with no
 * visible text. Applied to a control that already has visible text it would
 * REPLACE that name -- "Clear all" announcing as "Reset borough and
 * neighborhood filters" -- which is the WCAG 2.5.3 Label-in-Name failure the
 * rule exists to prevent. Those three get aria-describedby while the tip shows
 * (the APG tooltip pattern) and keep their visible name. Still one string per
 * control, which is the ruling's intent.
 *
 * TWO BASELINES: BASE is pre-CLCPA-226 (main @ 0527e01, deployed 5b044d5ccc).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSS_REL = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const BASE = process.env.DAC_BASE_COMMIT || '0527e01';
const SRC = fs.readFileSync(path.join(REPO, REL), 'utf8');
/* styles.css PINNED TO THE LAST COMMIT THAT TOUCHED IT DURING THIS TICKET'S
 * LIFETIME, not read from the working tree.
 *
 * This suite asserts a HISTORICAL claim Emely ruled explicitly: "the only CSS
 * diff in this ticket is that consolidation", checked as "EVERY other byte of
 * styles.css is unchanged". True when written, still true of the file it was
 * written about, and it began failing the moment CLCPA-233 legitimately added a
 * sub-header rule -- correctly, because the working tree is no longer this
 * ticket.
 *
 * 1926366 is this ticket's own round 2, the last commit to change styles.css
 * before CLCPA-233. Widening the expected diff to absorb another ticket's rule
 * would turn a precise ruling into a vague one. */
const CSS_AT = process.env.DAC_CSS_COMMIT || '1926366';
const CSS = execSync('git show ' + CSS_AT + ':"' + CSS_REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const toCRLF = (s) => s.replace(/\r?\n/g, '\r\n');
const BASE_SRC = toCRLF(execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
const BASE_CSS = toCRLF(execSync('git show ' + BASE + ':"' + CSS_REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
function guard(label, fn) {
  try { fn(); }
  catch (e) {
    ok(false, label + ' THREW instead of failing: ' + (e && e.message ? e.message : String(e)));
  }
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
/* code with comments and string literals blanked, for counting real calls */
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

lines.push('======================================================================');
lines.push('CLCPA-226 -- the native tooltips become the app s own styled one');
lines.push('======================================================================');

/* ==================================================================== */
lines.push('');
lines.push('=== the CSS diff is EXACTLY the .dac-map-tooltip consolidation ===');
guard('the css diff', () => {
  /* BASE had the class twice, with different values, so what rendered was a
   * cascade merge whose winning shadow was pure black. */
  const baseDecls = (BASE_CSS.match(/^\.dac-map-tooltip \{/gm) || []).length;
  ok(baseDecls === 2, 'BASE control: the class was declared TWICE: ' + baseDecls);
  ok(/box-shadow: 0 4px 12px rgba\(0,0,0,0\.08\)/.test(BASE_CSS),
     'BASE control: and the winning shadow was pure black, not the ink token');

  const decls = (CSS.match(/^\.dac-map-tooltip \{/gm) || []).length;
  ok(decls === 1, 'now declared ONCE: ' + decls);
  const block = CSS.slice(CSS.indexOf('.dac-map-tooltip {'),
    CSS.indexOf('}', CSS.indexOf('.dac-map-tooltip {')) + 1);
  ok(/box-shadow: 0 4px 14px rgba\(3,24,36,\.12\)/.test(block),
     'carrying the INK TOKEN shadow, per the ruling');
  /* SCOPED to the tooltips. rgba(0,0,0,0.08) is also used by four unrelated
   * rules -- two borders and two other shadows -- so "gone from styles.css"
   * was never a true claim and would have failed for the wrong reason. What
   * matters is that no TOOLTIP carries the off-token shadow any more. */
  ok(!/box-shadow:[^;]*rgba\(0,0,0,0\.08\)/.test(block),
     'the consolidated tooltip does not carry the black shadow');
  ['.exec-tooltip', '.h-pie-tt', '.dac-map-tooltip', '.dac-kpi-tt'].forEach(sel => {
    const i = CSS.indexOf(sel + ' {');
    const b = i < 0 ? '' : CSS.slice(i, CSS.indexOf('}', i) + 1);
    ok(b.length > 0 && /box-shadow: 0 4px 14px rgba\(3, ?24, ?36, ?0?\.12\)/.test(b),
       'all four live tooltip families now share the ink-token shadow: ' + sel);
  });
  /* the values that were winning, now stated explicitly rather than inherited */
  [['padding: 10px 12px', 'the winning padding'],
   ['min-width: 200px', 'the winning min-width'],
   ['max-width: 260px', 'the winning max-width'],
   ['color: var(--text-2)', 'the colour that only the second block had']].forEach(([d, why]) => {
    ok(block.indexOf(d) >= 0, 'stated explicitly: ' + d + ' (' + why + ')');
  });
  /* and the properties the second block never re-set, which only survived by
   * cascade, are now in the same declaration */
  [['position: absolute', 'position'], ['z-index: 1000', 'z-index'],
   ['font-family: var(--font)', 'font-family'],
   ['pointer-events: none', 'pointer-events']].forEach(([d, why]) => {
    ok(block.indexOf(d) >= 0, 'no longer relying on cascade for ' + why);
  });

  /* THE RULING: the only CSS diff in this ticket is this consolidation. Proven
   * by excising the declarations from both sides and comparing the remainder
   * byte for byte -- so any other change anywhere in 8000 lines fails here. */
  const cut = (css) => {
    let out = css, i;
    while ((i = out.indexOf('.dac-map-tooltip {')) >= 0) {
      out = out.slice(0, i) + out.slice(out.indexOf('}', i) + 1);
    }
    /* ROUND 2 added one rule, so the ticket's CSS diff is now two things: the
     * consolidation and the hug modifier. Both are excised; anything else
     * still fails. */
    out = out.replace(/\.exec-tooltip\.exec-tooltip-hug \{[^}]*\}/g, '');
    /* the comments this ticket added alongside them */
    return out.replace(/\/\* CLCPA-226[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
  };
  const a = cut(BASE_CSS), b = cut(CSS);
  ok(a === b, 'EVERY other byte of styles.css is unchanged, once this ticket s ' +
     'two rules are excised' +
     (a === b ? '' : ': remainders differ by ' + Math.abs(a.length - b.length) + ' chars'));
});

/* ==================================================================== */
lines.push('');
lines.push('=== the ten conversions, and the six natives that STAY ===');

/* The ruled scope. Each entry: the words, and whether the control has a visible
 * label of its own (which decides name vs description). */
const CONVERTED = [
  { key: 'Data Source', words: 'Data Source', named: true, what: 'the (i) on the Map Data family tabs' },
  { key: 'Close Data Sources and return to', words: null, named: true, what: 'the close X' },
  { key: 'Select all in', words: null, named: true, what: 'the borough group checkbox' },
  { key: 'Delete row', words: 'Delete row', named: true, what: 'the delete-row x' },
  { key: 'Reset borough and neighborhood filters', words: 'Reset borough and neighborhood filters', named: false, what: 'Clear all' },
  { key: 'Export the tracts in the current scope as CSV', words: 'Export the tracts in the current scope as CSV', named: false, what: 'Export' },
  { key: 'Remove ', words: null, named: false, what: 'the Remove Year button' },
  { key: 'The top class ends at the data maximum', words: 'The top class ends at the data maximum', named: null, what: 'the fixed top-class note' },
  { key: 'You have read-only access to saved layers.', words: 'You have read-only access to saved layers.', named: null, what: 'the read-only layer toggle' },
  { key: 'Required to save', words: 'Required to save', named: null, what: 'the required asterisk' },
];

guard('the conversions', () => {
  ok(CONVERTED.length === 10, 'ten sites in the ruled scope');
  CONVERTED.forEach(c => {
    const hasTip = SRC.indexOf('data-tip="' + c.key) >= 0 ||
                   SRC.indexOf("data-tip', '" + c.key) >= 0;
    ok(hasTip, c.what + ': carries data-tip');
    /* and its title is GONE. Checked on the words, so a title left behind on
     * some other control cannot mask it. */
    ok(SRC.indexOf('title="' + c.key) < 0,
       c.what + ': the native title is REMOVED');
    ok(BASE_SRC.indexOf('title="' + c.key) >= 0 ||
       BASE_SRC.indexOf("title = 'Remove ' + yr") >= 0,
       c.what + ': BASE control -- it WAS a native title');
  });
});

guard('the natives that stay', () => {
  /* CATEGORY B, ruled to stay native WITH the reason: for clipped text the
   * browser tooltip shows the full string exactly where it is cut, and
   * converting buys nothing. */
  const B = [
    ['bar-label', 'the bar label'],
    ['dac-td-label', 'the DAC table label'],
    ['ingest-history-when', 'the relative timestamp'],
  ];
  B.forEach(([cls, what]) => {
    const i = SRC.indexOf(cls);
    ok(i > 0 && SRC.slice(i, i + 200).indexOf('title="') >= 0,
       what + ': STAYS native (clipped text -- the browser tooltip is right)');
  });
  ok(/' title="' \+ escapeHtml\(labels\[i\] \|\| ''\) \+ ': '/.test(SRC),
     'the class-break bar readout stays native too');
  /* THE ERROR CHIPS, ruled out of scope: an error s surface is the panel and
   * the toast, not a hover. */
  const chips = (SRC.match(/ml-chip-err" title="/g) || []).length;
  ok(chips === 2, 'both error chips keep their native title: ' + chips);
  /* RULING 4: entry.valueField stays, deliberate -- an operator page
   * surfacing the Dataverse column name is useful vocabulary there. */
  const vf = (codeOnly(SRC).match(/\.title = entry\.valueField/g) || []).length;
  ok(vf === 2, 'the territory valueField tooltips stay, as ruled: ' + vf);
  ok(codeOnly(SRC).indexOf('label.title = why') >= 0,
     'and the territory load-error title with them');

  /* the count adds up: nothing was converted by accident and nothing missed */
  const staticTitles = (SRC.match(/title="/g) || []).length;
  ok(staticTitles === 6,
     'SIX static native titles remain -- 4 category B plus 2 error chips: ' + staticTitles);
  const baseStatic = (BASE_SRC.match(/title="/g) || []).length;
  ok(baseStatic === 15, 'BASE control: there were 15, so 9 static were converted: ' + baseStatic);
  const dyn = (codeOnly(SRC).match(/\.title = /g) || []).length;
  ok(dyn === 3, 'THREE dynamic titles remain, all ruled deliberate: ' + dyn);
  const baseDyn = (codeOnly(BASE_SRC).match(/\.title = /g) || []).length;
  ok(baseDyn === 4, 'BASE control: there were 4, so 1 dynamic was converted: ' + baseDyn);
});

/* ==================================================================== */
lines.push('');
lines.push('=== THE ONE-STRING RULE, checked as a rule over every site ===');
guard('the one-string rule', () => {
  /* Every data-tip in the source, paired with the aria-label on the same tag
   * where there is one. Read out of app.js, so this is about what SHIPS. */
  const tags = SRC.match(/<[a-z][^>]*data-tip=[^>]*>/g) || [];
  ok(tags.length >= 6, 'literal tags carrying data-tip: ' + tags.length);
  let checked = 0;
  tags.forEach(t => {
    const tip = (t.match(/data-tip="([^"]*)"/) || [])[1];
    const lbl = (t.match(/aria-label="([^"]*)"/) || [])[1];
    if (tip == null || lbl == null) return;
    checked++;
    ok(tip === lbl, 'same words as name and as tooltip: ' + JSON.stringify(tip));
  });
  ok(checked >= 2, 'at least two sites carry both, so the rule has subjects: ' + checked);

  /* the concatenated ones, which a tag regex cannot see whole */
  ok(/data-tip="Select all in ' \+ escMap\(boro\) \+ '" aria-label="Select all in ' \+ escMap\(boro\)/
     .test(SRC), 'the group checkbox builds tip and label from the SAME expression');
  ok(/'aria-label="Data Source" data-tip="Data Source" '/.test(SRC),
     'the (i) carries the same two words as both');

  /* THE PANEL TITLE, where one exists: the (i) opens a panel headed with the
   * same three words, which is the third leg of the agreement. */
  const panel = grab('dsAboutPanel');
  ok(!!panel && /dac-td-note-title">Data Source</.test(panel),
     'the (i) panel is headed with the same words again');

  /* FINDING 3, the reason this rule exists: the Remove Year control said two
   * different things after CLCPA-230 round 2 changed only its modal. */
  ok(/data-tip', 'Remove ' \+ yr \+ ' from the Dashboard'/.test(SRC),
     'the Remove Year tooltip says "from the Dashboard"');
  ok(/title: 'Remove ' \+ yr \+ ' from the Dashboard\?'/.test(SRC),
     'and its modal title says the same, capital D and all');
  ok(BASE_SRC.indexOf("'Remove ' + yr + ' from the dashboard'") >= 0,
     'BASE control: it said "dashboard" lowercase while the modal said Dashboard');

  /* THE CLOSE X had the same disagreement, in the other direction */
  ok(BASE_SRC.indexOf('title="Close and return to') >= 0 &&
     BASE_SRC.indexOf('aria-label="Close Data Sources and return to') >= 0,
     'BASE control: the close X title and aria-label were DIFFERENT strings');
  ok(SRC.indexOf('data-tip="Close and return to') < 0,
     'the shorter one is gone');
  /* On the TAG, not by counting mentions: my own comment above the button
   * explains the old disagreement and therefore mentions the string a third
   * time. Prose about a label is not a label. */
  const xTag = (SRC.match(/<button[^>]*ds-dict-x[\s\S]{0,400}?>/) || [''])[0];
  ok(xTag.indexOf('data-tip="Close Data Sources and return to') >= 0 &&
     xTag.indexOf('aria-label="Close Data Sources and return to') >= 0,
     'both attributes on the button now carry the longer string');
  ok(xTag.indexOf('title=') < 0, 'and the button carries no title at all');
});

/* ==================================================================== */
lines.push('');
lines.push('=== accessible names SURVIVE, in both directions ===');
guard('accessible names', () => {
  /* THE RULING: no converted control ends with neither title nor aria-label.
   * Reported deviation: three of them keep a VISIBLE name instead and take the
   * tooltip as a description, because an aria-label would have overwritten it. */
  const iconOnly = [
    ['aria-label="Data Source"', 'the (i), whose only content is an svg'],
    ['aria-label="Close Data Sources and return to', 'the close X'],
    ['aria-label="Select all in', 'the group checkbox, whose check span is aria-hidden'],
    ['aria-label="Delete row"', 'the delete-row x'],
  ];
  iconOnly.forEach(([needle, what]) => {
    ok(SRC.indexOf(needle) >= 0, what + ': has an aria-label, so the words ARE its name');
  });
  const visible = [
    ['>Clear all<', 'Clear all'],
    ['>Export<', 'Export'],
    ["btn.textContent = '× Remove ' + yr", 'the Remove Year button'],
  ];
  visible.forEach(([needle, what]) => {
    ok(SRC.indexOf(needle) >= 0,
       what + ': keeps its VISIBLE name, which an aria-label would have replaced');
  });
  /* AND THE CONVERSE, which is the assertion that was missing. Keeping the
   * visible text is not enough: adding an aria-label ALONGSIDE it overrides it
   * as the accessible name, which is the Label-in-Name failure this whole
   * name-versus-description split exists to avoid. Found by the mutation that
   * invented one on Clear all and left the suite green.
   *
   * Checked on the TAG, so an aria-label anywhere else cannot mask it. */
  [['dac-map-clearall', 'Clear all'],
   ['dac-map-export', 'Export']].forEach(([id, what]) => {
    const tag = (SRC.match(new RegExp('<button[^>]*' + id + '[^>]*>')) || [''])[0];
    ok(tag.length > 0, what + ': its tag is found');
    ok(tag.indexOf('data-tip=') >= 0, what + ': carries data-tip');
    ok(tag.indexOf('aria-label') < 0,
       what + ': and NO aria-label, so its visible name is still its name');
  });
  /* the Remove Year button is built in JS, so the same check reads the code */
  const ry = grab('syncRemoveYearButton');
  ok(!!ry, 'the Remove Year wiring is found');
  ok(/setAttribute\('data-tip'/.test(ry), 'it sets data-tip');
  ok(!/aria-label/.test(ry),
     'and never an aria-label: its visible text is × Remove <year>');
  /* and the helper is what attaches the description for exactly those */
  const w = grab('wireControlTips');
  ok(!!w, 'wireControlTips is present');
  ok(/if \(!el\.getAttribute\('aria-label'\)\) \{[\s\S]{0,120}aria-describedby/.test(w),
     'the helper attaches aria-describedby ONLY where there is no aria-label');
  ok(/described\.removeAttribute\('aria-describedby'\)/.test(w),
     'and removes it again, so no control is described by another one s tooltip');
  const ens = grab('ensureTooltip');
  ok(/tip\.id = 'dac-tip'/.test(ens) && /setAttribute\('role', 'tooltip'\)/.test(ens),
     'the shared tip has the id describedby points at, and role=tooltip');
  ok(BASE_SRC.indexOf("tip.id = 'dac-tip'") < 0, 'BASE control: it had neither');
});

/* ==================================================================== */
lines.push('');
lines.push('=== DRIVEN: hover, FOCUS, escape, and one shared node ===');

/* One viewport for every driven test, so the numbers in the assertions below
 * mean something specific rather than depending on a default. */
const VIEW = { width: 1200, ch: 5.8, pad: 22, maxw: 240, word: 76 };

function makeDom() {
  const rec = { doc: {}, appended: 0 };
  const mk = (over) => {
    const n = Object.assign({
      tagName: 'button', _attrs: {}, style: {}, id: '', className: '',
      _text: '', _rect: { left: 100, bottom: 40, top: 20, right: 160 },
      getAttribute: (k) => (n._attrs[k] === undefined ? null : n._attrs[k]),
      setAttribute: (k, v) => { n._attrs[k] = String(v); },
      removeAttribute: (k) => { delete n._attrs[k]; },
      getBoundingClientRect: () => n._rect,
      closest: (sel) => (sel === '[data-tip]' && n._attrs['data-tip'] != null ? n : null),
      appendChild: () => {},
      set textContent(v) { n._text = v; }, get textContent() { return n._text; },
      _classes: [],
      classList: {
        add: (c) => { if (n._classes.indexOf(c) < 0) n._classes.push(c); },
        remove: (c) => { const i = n._classes.indexOf(c); if (i >= 0) n._classes.splice(i, 1); },
        contains: (c) => n._classes.indexOf(c) >= 0,
      },
    }, over || {});
    /* SHRINK-TO-FIT, modelled. An absolutely positioned box with only `left`
     * set takes min(max-content, available), floored by its longest
     * unbreakable word -- and `available` is the room between `left` and the
     * right edge. That last clause is the whole round 3 defect: measuring the
     * box while it sits somewhere narrow measures a squeezed box.
     *
     * VIEW.width is the viewport, CHAR the per-character width at 11px, PAD
     * the rule's 8px+8px horizontal padding plus borders, MAXW the shared
     * max-width, and WORD the widest single word in the ten labels
     * ("neighborhood", 12 chars). */
    Object.defineProperty(n, 'offsetWidth', {
      get() {
        const natural = Math.min(VIEW.maxw,
          Math.round(String(n._text || '').length * VIEW.ch) + VIEW.pad);
        const leftPx = parseFloat(n.style.left || '0') || 0;
        const available = VIEW.width - leftPx;
        return Math.min(natural, Math.max(VIEW.word, available));
      },
      configurable: true,
    });
    /* the width the box WOULD take with all the room in the world */
    Object.defineProperty(n, '_natural', {
      get() {
        return Math.min(VIEW.maxw,
          Math.round(String(n._text || '').length * VIEW.ch) + VIEW.pad);
      },
      configurable: true,
    });
    return n;
  };
  let created = null;
  const documentStub = {
    body: { appendChild: () => { rec.appended++; } },
    createElement: () => { created = mk({ tagName: 'div' }); return created; },
    querySelector: (s) => (s === '.exec-tooltip' ? created : null),
    addEventListener: (k, fn) => { (rec.doc[k] = rec.doc[k] || []).push(fn); },
    removeEventListener: () => {},
  };
  return { mk, rec, documentStub, tip: () => created,
           tipNode: () => created };
}
function tipApi(dom) {
  const body = grab('wireControlTips') + '\n' + grab('ensureTooltip') +
    '\nreturn { wireControlTips, ensureTooltip };';
  return new Function('document', 'window', body)(dom.documentStub,
    { innerWidth: 1200, pageXOffset: 0, pageYOffset: 0 });
}

guard('driven: the delegated wiring', () => {
  const dom = makeDom();
  const api = tipApi(dom);
  api.wireControlTips();
  ['mouseover', 'mouseout', 'focusin', 'focusout', 'keydown'].forEach(k => {
    ok((dom.rec.doc[k] || []).length === 1, 'one document listener for ' + k);
  });
  /* DELEGATED: wiring twice must not double-bind. Half these controls live in
   * panels that re-render constantly, and this is what makes rewiring
   * unnecessary rather than merely unnecessary-looking. */
  api.wireControlTips();
  ok((dom.rec.doc.mouseover || []).length === 1,
     'calling it again binds NOTHING further: it is idempotent');
});

guard('driven: an icon-only control (the words are its name)', () => {
  const dom = makeDom();
  const api = tipApi(dom);
  api.wireControlTips();
  const el = dom.mk({ _attrs: { 'data-tip': 'Data Source', 'aria-label': 'Data Source' } });
  dom.rec.doc.mouseover[0]({ target: el });
  const tip = dom.tip();
  ok(!!tip, 'the shared tip is created on first hover');
  ok(tip.textContent === 'Data Source', 'showing the words: ' + tip.textContent);
  ok(tip.style.opacity === '1', 'and made visible');
  ok(tip.id === 'dac-tip' && tip._attrs.role === 'tooltip',
     'with the id and role aria-describedby needs');
  ok(el.getAttribute('aria-describedby') === null,
     'NO describedby: it already has an aria-label, so the words are its name');
  ok(dom.rec.appended === 1, 'one node appended');
  dom.rec.doc.mouseout[0]({ target: el });
  ok(tip.style.opacity === '0', 'mouseout hides it');

  /* the SAME node is reused rather than one per hover */
  dom.rec.doc.mouseover[0]({ target: el });
  ok(dom.rec.appended === 1, 'a second hover reuses the node: still ' + dom.rec.appended);
});

guard('driven: a control with a visible name (the words are a description)', () => {
  const dom = makeDom();
  const api = tipApi(dom);
  api.wireControlTips();
  const el = dom.mk({ _attrs: { 'data-tip': 'Reset borough and neighborhood filters' } });
  dom.rec.doc.mouseover[0]({ target: el });
  ok(dom.tip().textContent === 'Reset borough and neighborhood filters',
     'the tip shows the words');
  ok(el.getAttribute('aria-describedby') === 'dac-tip',
     'and the control is DESCRIBED by it, its visible name untouched');
  ok(el.getAttribute('aria-label') === null,
     'no aria-label was invented, which would have replaced the visible name');
  dom.rec.doc.mouseout[0]({ target: el });
  ok(el.getAttribute('aria-describedby') === null,
     'and the description is detached again on hide');

  /* moving between two described controls must not leave the first pointing */
  const a2 = dom.mk({ _attrs: { 'data-tip': 'A' } });
  const b2 = dom.mk({ _attrs: { 'data-tip': 'B' } });
  dom.rec.doc.mouseover[0]({ target: a2 });
  dom.rec.doc.mouseover[0]({ target: b2 });
  ok(a2.getAttribute('aria-describedby') === null || b2.getAttribute('aria-describedby') === 'dac-tip',
     'moving to another control does not leave two pointing at one tip');
});

guard('driven: KEYBOARD FOCUS, the functional gain', () => {
  const dom = makeDom();
  const api = tipApi(dom);
  api.wireControlTips();
  const el = dom.mk({ _attrs: { 'data-tip': 'Delete row', 'aria-label': 'Delete row' } });
  dom.rec.doc.focusin[0]({ target: el });
  ok(dom.tip() && dom.tip().style.opacity === '1',
     'FOCUS shows the tooltip -- which a native title never did');
  ok(dom.tip().textContent === 'Delete row', 'with the same words as the hover');
  dom.rec.doc.focusout[0]({ target: el });
  ok(dom.tip().style.opacity === '0', 'and blur hides it');
});

/* Its own guard. When the driven block above throws -- and removing the
 * focusin binding makes it throw, because there is no listener to fire -- a
 * shared guard would swallow these too and report one failure where there are
 * three. A guard limits the blast radius; it does not remove the need to keep
 * independent claims independent. */
guard('focus is bound so delegation can see it', () => {
  /* focusin/focusout rather than focus/blur, because those do not bubble and
   * delegation would never see them. */
  const w = grab('wireControlTips');
  ok(/'focusin'/.test(w) && /'focusout'/.test(w), 'bound as focusin/focusout');
  ok(!/addEventListener\('focus'/.test(w) && !/addEventListener\('blur'/.test(w),
     'and NOT as focus/blur, which do not bubble to the document');
});

guard('driven: escape, and non-tip targets', () => {
  const dom = makeDom();
  const api = tipApi(dom);
  api.wireControlTips();
  const el = dom.mk({ _attrs: { 'data-tip': 'Required to save' } });
  dom.rec.doc.mouseover[0]({ target: el });
  ok(dom.tip().style.opacity === '1', 'shown');
  dom.rec.doc.keydown[0]({ key: 'Escape' });
  ok(dom.tip().style.opacity === '0', 'ESCAPE dismisses it, like every other transient surface');
  dom.rec.doc.mouseover[0]({ target: el });
  dom.rec.doc.keydown[0]({ key: 'a' });
  ok(dom.tip().style.opacity === '1', 'and an unrelated key does not');

  /* hovering something with no data-tip hides rather than showing stale text */
  const plain = dom.mk({ _attrs: {}, closest: () => null });
  dom.rec.doc.mouseover[0]({ target: plain });
  ok(dom.tip().style.opacity === '0', 'hovering a plain element hides the tip');
  /* and an element with no text does not blank the tip into a floating box */
  const empty = dom.mk({ _attrs: { 'data-tip': '' } });
  empty.closest = (s) => (s === '[data-tip]' ? empty : null);
  dom.rec.doc.mouseover[0]({ target: empty });
  ok(dom.tip().style.opacity === '0', 'an empty data-tip shows nothing');
});

guard('driven: the text is TEXT, not markup', () => {
  const dom = makeDom();
  const api = tipApi(dom);
  api.wireControlTips();
  const el = dom.mk({ _attrs: { 'data-tip': '<img src=x onerror=alert(1)>' } });
  dom.rec.doc.mouseover[0]({ target: el });
  ok(dom.tip().textContent === '<img src=x onerror=alert(1)>',
     'set through textContent, so a label can never become markup');
  const w = grab('wireControlTips');
  ok(/tip\.textContent = text/.test(w) && !/tip\.innerHTML/.test(w),
     'and the helper never touches innerHTML');
});

/* ==================================================================== */
lines.push('');
lines.push('=== the ensureTooltip consolidation ===');
guard('consolidation', () => {
  const INLINE = "let tip = document.querySelector('.exec-tooltip');";
  const n = (SRC.match(/let tip = document\.querySelector\('\.exec-tooltip'\);/g) || []).length;
  ok(n === 1, 'the lazy-singleton block exists ONCE, inside ensureTooltip: ' + n);
  const baseN = (BASE_SRC.match(/let tip = document\.querySelector\('\.exec-tooltip'\);/g) || []).length;
  ok(baseN === 6, 'BASE control: it was copy-pasted SIX times: ' + baseN);
  /* CALLS, not mentions: /ensureTooltip\(\)/ also matches the line
   * `function ensureTooltip() {`, which made both counts one high. */
  const calls = (s) => (codeOnly(s).match(/(^|[^\w])ensureTooltip\(\)/gm) || [])
    .filter(m => !/function/.test(m)).length -
    (codeOnly(s).match(/function ensureTooltip\(\)/g) || []).length;
  const callers = calls(SRC);
  ok(callers === 9,
     'NINE callers now: the 3 that already used it, the 5 that duplicated its ' +
     'body, and wireControlTips itself -- ' + callers);
  const baseCallers = calls(BASE_SRC);
  ok(baseCallers === 3,
     'BASE control: the helper existed with only 3, while 5 sites copied it: ' +
     baseCallers);
  ok(/wireControlTips\(\);/.test(codeOnly(grab('boot'))),
     'and wireControlTips is called from boot, once');
});


/* ==================================================================== */
lines.push('');
lines.push('=== ROUND 2: a control tooltip HUGS its text ===');

/* THE DEFECT: .exec-tooltip carries min-width: 160px, for the CHART tooltips
 * that share the class -- a multi-row readout looks ragged narrow. Being a
 * MINIMUM it is invisible on long strings and pads short ones.
 *
 * Node has no layout engine, so "the rendered box hugs its text" cannot be
 * measured here. What CAN be computed exactly is the property the box is laid
 * out from: the WINNING min-width for a given set of classes, resolved through
 * the real cascade in styles.css. That is what these assertions do. */

/* A small cascade resolver: which declaration of `prop` wins for an element
 * carrying `classes`. Selectors are class chains only, which is all this
 * question involves. Specificity first, then source order. */
function winning(prop, classes, sheet) {
  const rules = [];
  /* COMMENTS STRIPPED FIRST. [^{}]+ captures everything since the previous
   * closing brace, so a comment above a rule lands inside the selector and the
   * rule is silently skipped -- which made every answer null until the
   * self-test below said so. */
  const flat = (sheet == null ? CSS : sheet).replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /([^{}]+)\{([^}]*)\}/g;
  let m, order = 0;
  while ((m = re.exec(flat)) !== null) {
    const sels = m[1].split(',').map(s => s.trim());
    const body = m[2];
    const dm = new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;]+)').exec(body);
    if (!dm) { order++; continue; }
    sels.forEach(sel => {
      if (!/^(\.[A-Za-z0-9_-]+)+$/.test(sel)) return;      // class chains only
      const need = sel.split('.').filter(Boolean);
      if (!need.every(c => classes.indexOf(c) >= 0)) return;  // does not match
      rules.push({ spec: need.length, order: order, value: dm[1].trim() });
    });
    order++;
  }
  if (!rules.length) return null;
  rules.sort((x, y) => (x.spec - y.spec) || (x.order - y.order));
  return rules[rules.length - 1].value;
}

guard('round 2: the cascade resolver checks itself first', () => {
  /* Trusted only after it answers questions whose answers are not in doubt. */
  ok(winning('min-width', ['exec-tooltip']) === '160px',
     'a plain .exec-tooltip still resolves min-width 160px: ' +
     winning('min-width', ['exec-tooltip']));
  ok(winning('padding', ['exec-tooltip']) === '8px 10px',
     'and padding 8px 10px, which is the rule s own');
  ok(winning('min-width', ['exec-tooltip', 'not-a-real-class']) === '160px',
     'an unrelated extra class changes nothing');
  ok(winning('font-size', ['dac-map-tooltip']) === '11px',
     'it resolves a different family too: .dac-map-tooltip font-size');

  /* SPECIFICITY, proven on a sheet where it DISAGREES with source order.
   * In the real stylesheet the two-class modifier also happens to come later,
   * so source order alone gives the right answer and the specificity sort was
   * carried along unexercised -- a code path that cannot be shown to matter.
   * Here the one-class rule is LAST, so only specificity can decide. */
  const conflict = '.a.b { min-width: 0; }\n.a { min-width: 160px; }';
  ok(winning('min-width', ['a', 'b'], conflict) === '0',
     'the two-class rule wins even though the one-class rule comes LAST: ' +
     winning('min-width', ['a', 'b'], conflict));
  ok(winning('min-width', ['a'], conflict) === '160px',
     'and an element without the modifier class still gets the one-class value');
  /* and source order still decides between EQUAL specificity */
  const tie = '.a { min-width: 10px; }\n.a { min-width: 20px; }';
  ok(winning('min-width', ['a'], tie) === '20px',
     'between equal specificity the LATER rule wins: ' + winning('min-width', ['a'], tie));
});

guard('round 2: the CONTROL tip carries no inflating minimum', () => {
  const CONTROL = ['exec-tooltip', 'exec-tooltip-hug'];
  /* THE ASSERTION EMELY ASKED FOR: no minimum pads the box beyond its content
   * plus the rule's own padding. */
  const mw = winning('min-width', CONTROL);
  ok(mw === '0' || mw === '0px',
     'the winning min-width for a control tip is ZERO: ' + mw);
  ok(winning('min-height', CONTROL) === null,
     'and there is no min-height anywhere in its cascade');
  ok(winning('width', CONTROL) === null,
     'nor a fixed width');
  /* the rule's OWN padding is untouched, which is what "plus the rule's own
   * padding" means -- the box is not being made tighter than its siblings */
  ok(winning('padding', CONTROL) === '8px 10px',
     'the padding is still the shared rule s 8px 10px, same as every other site');
  ok(winning('line-height', CONTROL) === null,
     'and no line-height is overridden: it inherits body s 1.5, like the others');
  /* max-width is deliberately NOT reset: a long label must still wrap */
  ok(winning('max-width', CONTROL) === '240px',
     'max-width still applies, so a long label wraps rather than running off: ' +
     winning('max-width', CONTROL));
});

guard('round 2: the CHART tips are provably unchanged', () => {
  /* The shared rule is byte-identical to before round 2, so the eight chart
   * callers and the six control tips whose text already exceeded 160px cannot
   * have moved. Compared block to block rather than argued. */
  const blk = (css) => {
    const i = css.indexOf('.exec-tooltip {');
    return i < 0 ? null : css.slice(i, css.indexOf('}', i) + 1);
  };
  ok(blk(CSS) !== null, 'the shared rule is found');
  ok(blk(CSS) === blk(BASE_CSS),
     'and is BYTE-IDENTICAL to the deployed baseline: nothing that shares it moved');
  ok(/min-width: 160px/.test(blk(CSS)),
     'it still carries the 160px minimum the chart readouts want');
  /* and the modifier cannot reach a tip that does not carry it */
  const hug = (CSS.match(/\.exec-tooltip\.exec-tooltip-hug \{[^}]*\}/) || [''])[0];
  ok(hug.length > 0, 'the modifier rule exists');
  ok(/^\.exec-tooltip\.exec-tooltip-hug /.test(hug),
     'SCOPED to both classes, so it cannot apply on its own: ' + hug);
  ok(hug.indexOf('max-width') < 0 && hug.indexOf('padding') < 0,
     'and it changes NOTHING but the minimum: ' + hug);
});

guard('round 2: driven -- who gets the modifier and who does not', () => {
  const dom = makeDom();
  const api = tipApi(dom);
  api.wireControlTips();
  const el = dom.mk({ _attrs: { 'data-tip': 'Data Source', 'aria-label': 'Data Source' } });
  dom.rec.doc.mouseover[0]({ target: el });
  ok(dom.tip()._classes.indexOf('exec-tooltip-hug') >= 0,
     'a control hover adds the modifier');
  /* THE ORDERING TRAP: a chart tooltip opened after a control one must not
   * inherit the modifier. ensureTooltip clears it, so every caller resets. */
  const same = api.ensureTooltip();
  ok(same === dom.tip(), 'the chart path gets the same shared node');
  ok(same._classes.indexOf('exec-tooltip-hug') < 0,
     'and ensureTooltip CLEARED the modifier, so the chart box keeps its minimum');
  /* and back again */
  dom.rec.doc.mouseover[0]({ target: el });
  ok(dom.tip()._classes.indexOf('exec-tooltip-hug') >= 0,
     'hovering the control again re-adds it');
  /* the reset is in ensureTooltip, not hide: hide does not run before a chart
   * tooltip opens, which is why one point of truth is the whole design */
  const ens = grab('ensureTooltip');
  ok(/classList\.remove\('exec-tooltip-hug'\)/.test(ens),
     'the reset lives in ensureTooltip, which every caller passes through');
  const w = grab('wireControlTips');
  ok(/classList\.add\('exec-tooltip-hug'\)/.test(w),
     'and only the control path adds it');
  /* no chart caller adds it anywhere */
  const adds = (codeOnly(SRC).match(/classList\.add\('exec-tooltip-hug'\)/g) || []).length;
  ok(adds === 1, 'exactly ONE place in the app adds it: ' + adds);
});

guard('round 2: WHICH sites were inflated, measured', () => {
  /* Reported as one site, the (i). It was FOUR: the minimum bites every string
   * narrower than 160px, and the (i) is simply the one that was hovered.
   * Widths are approximate (11px font, ~5.8px per character) and are here to
   * record which side of the 160px line each label falls on, not to measure
   * the box -- that is Emely's pass. */
  const TIPS = [
    ['Delete row', 58], ['Data Source', 64], ['Required to save', 93],
    ['Select all in Brooklyn', 128],
    ['Remove 2026 from the Dashboard', 174],
    ['Reset borough and neighborhood filters', 220],
    ['The top class ends at the data maximum', 220],
    ['Close Data Sources and return to Map Data', 238],
    ['You have read-only access to saved layers.', 244],
    ['Export the tracts in the current scope as CSV', 261],
  ];
  const est = (s) => Math.round(s.length * 5.8);
  TIPS.forEach(([t, want]) => {
    ok(Math.abs(est(t) - want) <= 1, 'estimate holds for ' + JSON.stringify(t.slice(0, 26)));
  });
  const under = TIPS.filter(([t]) => est(t) < 160);
  ok(under.length === 4,
     'FOUR of the ten fell under the 160px minimum, not one: ' +
     under.map(x => JSON.stringify(x[0])).join(', '));
  ok(under.some(x => x[0] === 'Data Source'),
     'including the one reported, the (i)');
  ok(under.some(x => x[0] === 'Delete row') && under.some(x => x[0] === 'Required to save'),
     'and three that were not reported, which the fix covers too');
});

/* ==================================================================== */
lines.push('');
lines.push('=== ROUND 3: the width the box is LAID OUT at, both directions ===');

/* THE RULE, content-based rather than a list of sites: the box is laid out at
 * its NATURAL width capped by the shared max-width, and the position is then
 * chosen so that width fits. Short labels hug, long ones wrap at the cap in
 * full-width lines, and nothing is ever laid out in less room than it
 * measured. No per-site branch, so a new tooltip needs no entry anywhere. */

/* Anchors, in viewport coordinates. The X is the one that broke: it sits at
 * the top RIGHT of the Data Sources header, and the room between its left
 * edge and the right of the screen is far less than its label needs. */
const ANCHORS = {
  farRight: { left: 1150, right: 1176, top: 20, bottom: 44 },
  midRight: { left: 900, right: 940, top: 20, bottom: 44 },
  left: { left: 40, right: 70, top: 300, bottom: 324 },
};
function showAt(dom, api, text, anchor, opts) {
  const o = opts || {};
  const el = dom.mk({ _attrs: Object.assign({ 'data-tip': text }, o.attrs || {}),
                      _rect: anchor });
  /* A PRIOR tooltip leaves `left` behind, and that is what round 3 is about:
   * the old code measured the box at whatever position the last one used.
   *
   * The node is created lazily on the first show, so it has to be brought
   * into existence before a stale position can be put on it. */
  if (o.staleLeft != null) {
    api.ensureTooltip().style.left = o.staleLeft + 'px';
  }
  dom.rec.doc.mouseover[0]({ target: el });
  const tip = dom.tipNode();
  return { el: el, tip: tip, left: parseFloat(tip.style.left) || 0,
           width: tip.offsetWidth, natural: tip._natural };
}

guard('round 3: the stub models shrink-to-fit before it is trusted', () => {
  const dom = makeDom();
  const api = tipApi(dom);
  api.wireControlTips();
  /* force the node into existence, then reason about it directly */
  const tip = api.ensureTooltip();
  tip.textContent = 'Close Data Sources and return to DAC Indicators';
  tip.style.left = '0px';
  ok(tip.offsetWidth === VIEW.maxw,
     'with the whole viewport available a long label takes the max-width cap: ' +
     tip.offsetWidth);
  tip.style.left = '1150px';
  ok(tip.offsetWidth < 100,
     'and squeezed against the right edge it COLLAPSES, which is the defect ' +
     'being modelled: ' + tip.offsetWidth + 'px');
  tip.textContent = 'Data Source';
  tip.style.left = '0px';
  ok(tip.offsetWidth < VIEW.maxw && tip.offsetWidth === tip._natural,
     'a short label takes its natural width, well under the cap: ' + tip.offsetWidth);
});

guard('round 3: THE DEFECT -- a long label at the right edge', () => {
  const dom = makeDom();
  const api = tipApi(dom);
  api.wireControlTips();
  const TEXT = 'Close Data Sources and return to DAC Indicators';
  /* staleLeft is what a previous tooltip left behind. Under the old code the
   * box was MEASURED there, came back collapsed, and the collapsed width then
   * fed the clamp -- so it was placed too far right for its text and stayed
   * collapsed on every later hover. */
  const s = showAt(dom, api, TEXT, ANCHORS.farRight, { staleLeft: 1100 });
  ok(s.width === s.natural,
     'the X tooltip is laid out at its full width despite a stale position: ' +
     s.width + 'px of ' + s.natural + 'px');
  ok(s.width === VIEW.maxw,
     'which for this label is the shared max-width, so it wraps in full-width ' +
     'lines rather than one-word columns: ' + s.width);
  ok(VIEW.width - s.left >= s.width,
     'and it is placed where that width FITS: ' + (VIEW.width - s.left) +
     'px of room for ' + s.width + 'px');
  ok(s.left < ANCHORS.farRight.left,
     'nudged back from the anchor to make that room: left ' + s.left +
     ' vs anchor ' + ANCHORS.farRight.left);

  /* SELF-REINFORCEMENT was the nastiest part: once collapsed it stayed
   * collapsed. Hovering repeatedly must give the same answer every time. */
  const widths = [];
  for (let i = 0; i < 4; i++) {
    widths.push(showAt(dom, api, TEXT, ANCHORS.farRight).width);
  }
  ok(widths.every(w => w === VIEW.maxw),
     'four hovers in a row all give the full width, so nothing degrades: ' +
     widths.join(', '));
});

guard('round 3: the DYNAMIC part of that label, across tab names', () => {
  /* "return to {tab}" varies, so the fix has to hold for every tab name
   * rather than for the one in the screenshot. */
  const dom = makeDom();
  const api = tipApi(dom);
  api.wireControlTips();
  const TABS = ['DAC Indicators', 'Map Layers', 'Tract Geometry', 'Territories',
                'ConEd Figures', 'Report Data'];
  const bad = [];
  TABS.forEach(t => {
    const s = showAt(dom, api, 'Close Data Sources and return to ' + t,
                     ANCHORS.farRight, { staleLeft: 1100 });
    if (s.width !== s.natural) bad.push(t + ' (' + s.width + '/' + s.natural + ')');
    if (VIEW.width - s.left < s.width) bad.push(t + ' does not fit');
  });
  ok(bad.length === 0,
     'every tab name lays out at its natural width and fits' +
     (bad.length ? ': ' + bad.join(', ') : ' (' + TABS.length + ' checked)'));
});

guard('round 3: BOTH DIRECTIONS -- four short hug, six long at proper width', () => {
  const dom = makeDom();
  const api = tipApi(dom);
  api.wireControlTips();
  /* The ten ruled sites, with the anchor each one plausibly sits at. The
   * point is not the exact anchor but that the RULE holds at any of them. */
  const SITES = [
    ['Data Source', ANCHORS.midRight, 'under'],
    ['Delete row', ANCHORS.farRight, 'under'],
    ['Required to save', ANCHORS.left, 'under'],
    ['Select all in Brooklyn', ANCHORS.left, 'under'],
    /* ~196px: wider than round 2's 160px minimum, narrower than round 3's
     * 240px cap. It takes its natural width on one line, which is the rule
     * working, not an exception to it. */
    ['Remove 2026 from the Dashboard', ANCHORS.midRight, 'under'],
    ['Reset borough and neighborhood filters', ANCHORS.left, 'cap'],
    ['The top class ends at the data maximum', ANCHORS.left, 'cap'],
    ['Close Data Sources and return to DAC Indicators', ANCHORS.farRight, 'cap'],
    ['You have read-only access to saved layers.', ANCHORS.midRight, 'cap'],
    ['Export the tracts in the current scope as CSV', ANCHORS.farRight, 'cap'],
  ];
  let hugged = 0, wrapped = 0; const bad = [];
  SITES.forEach(([text, anchor, kind]) => {
    const s = showAt(dom, api, text, anchor, { staleLeft: 1100 });
    /* NEVER laid out in less room than it measured -- the one-word-wide rule */
    if (s.width !== s.natural) { bad.push(text.slice(0, 24) + ' squeezed'); return; }
    if (VIEW.width - s.left < s.width) { bad.push(text.slice(0, 24) + ' overflows'); return; }
    if (kind === 'under') {
      if (s.width < VIEW.maxw) hugged++;
      else bad.push(text.slice(0, 24) + ' should hug but hit the cap');
    } else {
      if (s.width === VIEW.maxw) wrapped++;
      else bad.push(text.slice(0, 24) + ' should reach the cap, got ' + s.width);
    }
  });
  ok(bad.length === 0, 'every one of the ten obeys the rule' +
     (bad.length ? ': ' + bad.join('; ') : ''));
  /* TWO DIFFERENT BOUNDARIES, and mixing them is what made this assertion
   * wrong the first time. Round 2's is the 160px minimum that used to inflate
   * anything narrower: four labels were under it. Round 3's is the 240px cap:
   * FIVE are under that, because "Remove {yr} from the Dashboard" at ~196px
   * falls between the two. Both counts are right about their own boundary. */
  ok(hugged === 5, 'FIVE labels are under the 240px cap and take their own width: ' +
     hugged);
  ok(wrapped === 5, 'and FIVE reach the cap and wrap in full-width lines: ' + wrapped);
  const r2short = SITES.filter(([t]) => Math.round(t.length * VIEW.ch) + VIEW.pad < 160);
  ok(r2short.length === 4,
     'while round 2 s 160px boundary still has FOUR under it, as reported then: ' +
     r2short.length);
  /* no per-site branch anywhere: the rule is content-based */
  const w = grab('wireControlTips');
  ok(!/data-ds-dict-back|ingest-row-delete|dac-map-clearall|ml-req/.test(w),
     'and the helper names NO site: the rule is content-based, not a list');
});

guard('round 3: measured before placing, and shown only when placed', () => {
  const w = grab('wireControlTips');
  /* the ORDER is the fix, so it is asserted as an order */
  const iReset = w.indexOf("tip.style.left = '0px'");
  const iMeasure = w.indexOf('tip.offsetWidth');
  const iPlace = w.indexOf("tip.style.left = Math.max");
  const iTop = w.indexOf('tip.style.top = (r.bottom');
  const iShow = w.indexOf("tip.style.opacity = '1'");
  ok(iReset > 0 && iMeasure > iReset,
     'the box is moved to an unsqueezed position BEFORE it is measured');
  ok(iPlace > iMeasure, 'and placed only after it is measured');
  /* BOTH coordinates, not just left. Checking only the left let a mutation
   * move the reveal above the top assignment, which would show the tip at its
   * final left and the PREVIOUS tooltip's top. */
  ok(iTop > 0 && iShow > iPlace && iShow > iTop,
     'and made visible only after BOTH coordinates are final, so neither the ' +
     'measuring position nor a stale top is ever painted');
  /* document coordinates on both sides of the clamp */
  ok(/const maxLeft = sx \+ vw - w - 8;/.test(w),
     'the clamp is computed in document coordinates, like the left it compares');
  ok(/Math\.max\(sx \+ 8, left\)/.test(w),
     'and the floor is document-relative too');
});

guard('round 3: the chart tips and the ordering case are untouched', () => {
  const dom = makeDom();
  const api = tipApi(dom);
  api.wireControlTips();
  /* a control, then a chart: the chart box keeps the shared minimum */
  showAt(dom, api, 'Data Source', ANCHORS.midRight, { attrs: { 'aria-label': 'Data Source' } });
  ok(dom.tipNode()._classes.indexOf('exec-tooltip-hug') >= 0, 'the control hug is on');
  const chart = api.ensureTooltip();
  ok(chart._classes.indexOf('exec-tooltip-hug') < 0,
     'and the chart path cleared it, as round 2 established');
  ok(winning('min-width', ['exec-tooltip']) === '160px',
     'so a chart tip still resolves the 160px minimum');
  /* ROUND 3 IS A POSITIONING FIX and changes no CSS. Counting the two rules
   * this ticket owns is a weak form of that claim -- it cannot see a THIRD
   * rule added under a new name. The real guard is the byte comparison in the
   * first section, which excises exactly those two and requires every other
   * byte to match; a new rule fails there. Kept here as a cheap sanity check
   * with its limit stated, not as the guarantee. */
  const owned = (CSS.match(/\.dac-map-tooltip \{/g) || []).length +
    (CSS.match(/\.exec-tooltip\.exec-tooltip-hug \{/g) || []).length;
  ok(owned === 2,
     'this ticket still owns exactly two CSS rules (the byte comparison ' +
     'above is what would catch a third): ' + owned);
});
lines.push('');
lines.push('======================================================================');
lines.push('  ' + pass + ' passed, ' + fail + ' failed');
lines.push('======================================================================');
const out = lines.join('\n');
console.log(out);
fs.writeFileSync(path.join(__dirname, 'suite-226-output.txt'), out + '\n');
process.exitCode = fail ? 1 : 0;
