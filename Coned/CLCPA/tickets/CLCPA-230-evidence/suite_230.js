/* CLCPA-230: the native dialogs become the app's own modal.
 *
 * The properties that matter here are BEHAVIOURAL, not textual, because the
 * ticket's risk is not the markup. window.confirm BLOCKS and a modal does not,
 * so every call site had to invert from "ask, then fall through" to "ask, and
 * pass the rest as a continuation". A site that forgot to move its work into
 * onConfirm would run it immediately -- cancel would delete the row anyway.
 *
 * So every site is driven through the REAL openConfirmModal with a DOM stub and
 * asserted from BOTH sides:
 *   cancel  runs NOTHING: state byte-identical, no continuation call;
 *   confirm runs the continuation EXACTLY ONCE.
 *
 * The round 6 lesson is applied without waiting to be told: a source-text read
 * of the handler is not evidence that the handler behaves. Where this suite
 * reads source it says so and does not claim more.
 *
 * TWO BASELINES, per the standing rule:
 *   BASE  pre-CLCPA-230 (main @ 4875d48), which had ten native dialogs;
 *   the working tree, which must have exactly one left until site 1 lands.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSS_REL = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const BASE = process.env.DAC_BASE_COMMIT || '4875d48';   // pre-230, as deployed
const SRC = fs.readFileSync(path.join(REPO, REL), 'utf8');
const CSS = fs.readFileSync(path.join(REPO, CSS_REL), 'utf8');
/* git show hands back the BLOB, which is LF; the working file on this machine
 * is CRLF. Comparing or offset-searching across that difference is how a
 * byte-identical file reads as changed and how an indexOf for '\r\n...' in LF
 * text returns -1 and slices from the end instead of failing loudly. Both
 * baselines are normalised to CRLF once, here, so every later comparison is
 * against text shaped like the disk. */
const toCRLF = (s) => s.replace(/\r?\n/g, '\r\n');
const BASE_SRC = toCRLF(execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
const BASE_CSS = toCRLF(execSync('git show ' + BASE + ':"' + CSS_REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
const PAYLOAD = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};

/* A section that THROWS records a named failure and the run continues. Without
 * this, one exception in a driven block discarded every result before it: the
 * suite had noticed the bug and then died before it could report it.
 *
 * `label` is what gets reported, so it has to identify the section.
 */
function guard(label, fn) {
  try { fn(); }
  catch (e) {
    ok(false, label + ' THREW instead of failing: ' +
       (e && e.message ? e.message : String(e)));
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

/* Strip comments and string literals before counting a call, so prose about
 * window.confirm in a doc comment is never mistaken for a call to it. That
 * distinction is the whole point of this count. */
function codeOnly(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '/*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? src.length : j + 2; continue; }
    if (two === '//') { const j = src.indexOf('\n', i); i = j < 0 ? src.length : j; continue; }
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === ch) { j++; break; }
        j++;
      }
      out += ' '; i = j; continue;
    }
    out += ch; i++;
  }
  return out;
}

lines.push('======================================================================');
lines.push('CLCPA-230 -- the native dialogs become the app s own modal');
lines.push('======================================================================');

/* ==================================================================== */
lines.push('');
lines.push('=== the inventory: what the audit found, and what is left ===');
const CODE = codeOnly(SRC);
const BASE_CODE = codeOnly(BASE_SRC);
guard("the inventory: what the audit found, and what is left", () => {
  const count = (s, re) => (s.match(re) || []).length;
  const baseConfirm = count(BASE_CODE, /\bconfirm\s*\(/g);
  const baseAlert = count(BASE_CODE, /\balert\s*\(/g);
  const basePrompt = count(BASE_CODE, /\bprompt\s*\(/g);
  /* dsConfirmActivate and openConfirmModal/confirmDiscardChanges are NAMES
   * containing "confirm", not calls to window.confirm. Word-boundary matching
   * would count them, so they are excluded by name. */
  const nativeCalls = (s) => {
    const hits = [];
    const re = /(^|[^\w.$])(confirm|alert|prompt)\s*\(/g;
    let m;
    while ((m = re.exec(s)) !== null) hits.push(m[2]);
    return hits;
  };
  const baseHits = nativeCalls(BASE_CODE);
  ok(baseHits.length === 10,
     'BASE control: the audit found TEN native dialogs, and BASE has ' + baseHits.length);
  ok(baseConfirm === 8 && baseAlert === 2 && basePrompt === 0,
     'BASE control: 8 confirm, 2 alert, 0 prompt -- exactly the audit inventory');

  const hits = nativeCalls(CODE);
  /* ZERO. This read `<= 1` while site 1 was still outstanding, which was true
   * before and after its commit and therefore stopped being a guard the
   * moment site 1 landed: a mutation restoring the native confirm left the
   * count at 1 and the assertion still passed. Caught by that very mutation.
   *
   * The claim of this ticket is that NO native dialog remains, so the number
   * is zero and nothing else. */
  ok(hits.length === 0,
     'ZERO native dialogs remain, all ten replaced: ' + hits.length);
  ok(BASE_CODE.indexOf('confirm(lines.join') >= 0 &&
     CODE.indexOf('confirm(lines.join') < 0,
     'including site 1, the last one and the highest-consequence one');
  ok(hits.filter(h => h === 'alert').length === 0,
     'BOTH alerts are gone: a notification is not a confirmation');
  ok(hits.filter(h => h === 'prompt').length === 0, 'and still no prompt anywhere');
  const dsFn = grab('dsConfirmActivate');
  ok(!!dsFn && !/[^.$\w]confirm\(/.test(codeOnly(dsFn)),
     'dsConfirmActivate calls no native confirm');
  ok(!!dsFn && /openConfirmModal\(/.test(dsFn),
     'it asks through the app s own modal instead');
  ok(!!dsFn && /function dsConfirmActivate\(dvId, onConfirm\)/.test(dsFn),
     'and takes a CALLBACK, because a modal has no boolean to return in time');
});

/* ==================================================================== */
lines.push('');
lines.push('=== NO new CSS, and no new button variant ===');
guard("NO new CSS, and no new button variant", () => {
  /* CLCPA-226 consolidated the duplicated .dac-map-tooltip declaration, which
   * is a change to this file that CLCPA-230 did not make. The claim here is
   * still CLCPA-230's -- that IT added no CSS -- so the comparison excises
   * that one rule from both sides rather than asserting the file has been
   * frozen forever. Any other byte differing still fails.
   *
   * Written this way because the earlier form conflated "this ticket adds no
   * CSS" with "no ticket ever will", and only the first was ever true. */
  /* ALL comments off BOTH sides, then the two rules a later ticket is
   * accountable for, by name. Comments are not CSS behaviour, so they cannot
   * be a difference that matters, and stripping them symmetrically is safe.
   *
   * I first tried to generalise this by removing each attributed comment PLUS
   * the declaration following it. That is wrong: the comment marking where the
   * duplicate .dac-map-tooltip block was DELETED introduces no rule, so it
   * swallowed the innocent one after it and the comparison reported a
   * difference created by its own excision. Naming the rules means this line
   * must be edited deliberately when CSS changes again, which is better than a
   * line that auto-excuses anything with a comment above it. */
  const cutLater = (css) => css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\.dac-map-tooltip \{[^}]*\}/g, '')
    .replace(/\.exec-tooltip\.exec-tooltip-hug \{[^}]*\}/g, '')
    .replace(/\s+/g, ' ').trim();
  ok(cutLater(CSS) === cutLater(BASE_CSS),
     'apart from the two tooltip rules CLCPA-226 owns, styles.css is identical ' +
     'to BASE: CLCPA-230 itself adds no CSS');
  ok(CSS.indexOf('.btn-danger') < 0 && BASE_CSS.indexOf('.btn-danger') < 0,
     'and neither side has a .btn-danger, which is what CLCPA-230 was asked ' +
     'not to invent');
  ok(CSS.indexOf('.btn-danger') < 0,
     'there is no .btn-danger, and none was invented for the destructive actions');
  const modal = grab('openConfirmModal');
  ok(!!modal, 'openConfirmModal is present');
  /* Every class the helper emits must already exist in styles.css. A class that
   * does not is a silent redesign: it renders unstyled. */
  const emitted = [];
  (modal.match(/class=\\?"([^"\\]+)/g) || []).forEach(m => {
    m.replace(/class=\\?"/, '').split(/\s+/).forEach(c => { if (c) emitted.push(c); });
  });
  const uniq = emitted.filter((c, i) => emitted.indexOf(c) === i);
  ok(uniq.length > 0, 'it emits classes to check: ' + uniq.join(' '));
  const unknown = uniq.filter(c => CSS.indexOf('.' + c) < 0);
  ok(unknown.length === 0,
     'every class it emits is already styled' + (unknown.length ? ': ' + unknown : ''));
  const save = grab('openSaveModal');
  ok(!!save, 'openSaveModal, the shell it reuses, is present');
  ['ingest-modal-overlay', 'ingest-modal', 'ingest-modal-head', 'ingest-modal-body',
   'ingest-modal-foot', 'ingest-modal-close'].forEach(c => {
    ok(modal.indexOf(c) >= 0 && save.indexOf(c) >= 0,
       'shared with openSaveModal, not reinvented: ' + c);
  });
});

/* ==================================================================== */
lines.push('');
lines.push('=== FINDING A: the call site resolves IN SCOPE ===');
guard("FINDING A: the call site resolves IN SCOPE", () => {
  /* showToast is declared inside the Storage IIFE and exposed as Storage.toast.
   * The bare name outside that IIFE was a ReferenceError waiting for a table
   * with no columns. */
  const iifeEnd = SRC.indexOf('\r\n  })();');
  ok(iifeEnd > 0, 'the Storage IIFE close is located: offset ' + iifeEnd);
  const decl = SRC.indexOf('function showToast(');
  ok(decl > 0 && decl < iifeEnd,
     'showToast is declared INSIDE that IIFE, which is why it is not global');
  const after = SRC.slice(iifeEnd);
  const bare = (codeOnly(after).match(/(^|[^\w.$])showToast\s*\(/g) || []).length;
  ok(bare === 0,
     'and NO bare showToast( call survives outside it: ' + bare);
  const baseAfter = BASE_SRC.slice(BASE_SRC.indexOf('\r\n  })();'));
  const baseBare = (codeOnly(baseAfter).match(/(^|[^\w.$])showToast\s*\(/g) || []).length;
  ok(baseBare === 1,
     'BASE control: exactly ONE such call existed, which is the defect: ' + baseBare);
  ok(/Storage\.toast\('No example workbook/.test(SRC),
     'the template site now goes through Storage.toast, the exposed door');
  /* and the reason it was unreachable, restated from the payload rather than
   * from memory: every table yields a schema, so the branch never fires. */
  const noSchema = Object.keys(PAYLOAD.tables).filter(id => {
    const t = PAYLOAD.tables[id];
    const yrs = Object.keys((t.data || {}));
    return yrs.length === 0 && !(t.columns && t.columns.length);
  });
  ok(noSchema.length === 0,
     'LATENT not live: no table in the frozen payload could reach that branch');
});

/* ==================================================================== */
lines.push('');
lines.push('=== the DOM stub, and openConfirmModal driven for real ===');

/* A stub that records what the helper does, including the document-level
 * keydown listener, which the CLCPA-85 stub ignored. Escape parity cannot be
 * proven without capturing it. */
function makeDom() {
  const rec = { removed: 0, docListeners: {}, docRemoved: [], focused: [] };
  const el = (tag) => {
    const n = {
      tagName: tag, _cls: '', _attrs: {}, _on: {}, _html: '', style: {}, value: '',
      set innerHTML(v) { this._html = v; n._nodes = {}; },
      get innerHTML() { return this._html; },
      set className(v) { this._cls = v; }, get className() { return this._cls; },
      set textContent(v) { this._text = v; },
      get textContent() { return this._text === undefined ? '' : this._text; },
      addEventListener: (k, fn) => { (n._on[k] = n._on[k] || []).push(fn); },
      removeEventListener: () => {},
      remove: () => { rec.removed++; },
      appendChild: () => {}, removeChild: () => {},
      focus: () => { rec.focused.push(n._attrs['data-cfm'] || n._attrs.id || n.tagName); },
      getAttribute: (k) => (n._attrs[k] === undefined ? null : n._attrs[k]),
      setAttribute: (k, v) => { n._attrs[k] = v; },
      querySelector: (s) => nodeFor(s, n),
      querySelectorAll: (s) => { const o = nodeFor(s, n); return o ? [o] : []; },
      _nodes: {},
    };
    return n;
  };
  function nodeFor(selr, owner) {
    const html = owner.innerHTML || '';
    let key = null, present = false, m;
    if ((m = selr.match(/^\[data-cfm="([\w-]+)"\]$/))) {
      key = 'cfm:' + m[1]; present = html.indexOf('data-cfm="' + m[1] + '"') >= 0;
    } else if ((m = selr.match(/^\[data-act="([\w-]+)"\]$/))) {
      key = 'act:' + m[1]; present = html.indexOf('data-act="' + m[1] + '"') >= 0;
    } else if ((m = selr.match(/^#([\w-]+)$/))) {
      key = 'id:' + m[1]; present = html.indexOf('id="' + m[1] + '"') >= 0;
    } else if ((m = selr.match(/^\.([\w-]+)$/))) {
      key = 'cls:' + m[1]; present = html.indexOf('class="' + m[1] + '"') >= 0;
    }
    if (!key || !present) return null;
    if (owner._nodes[key]) return owner._nodes[key];
    const n = el('el');
    const c = key.match(/^cfm:(.+)$/); if (c) n._attrs['data-cfm'] = c[1];
    const a = key.match(/^act:(.+)$/); if (a) n._attrs['data-act'] = a[1];
    const i = key.match(/^id:(.+)$/); if (i) n._attrs.id = i[1];
    owner._nodes[key] = n;
    return n;
  }
  let created = null;
  const documentStub = {
    body: { appendChild: () => {} },
    createElement: (t) => { created = el(t); return created; },
    addEventListener: (k, fn) => { (rec.docListeners[k] = rec.docListeners[k] || []).push(fn); },
    removeEventListener: (k, fn) => { rec.docRemoved.push(k); },
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  };
  return { el, rec, documentStub, last: () => created };
}

function confirmApi(dom) {
  const body = grab('openConfirmModal') + '\n' + grab('confirmDiscardChanges') + '\n' +
    'return { openConfirmModal, confirmDiscardChanges };';
  return new Function('document', 'escapeHtml', body)(
    dom.documentStub,
    (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
}

guard("section 4", () => {
  const dom = makeDom();
  const api = confirmApi(dom);
  let outcome = [];
  api.openConfirmModal({
    title: 'Remove 2027 from the Dashboard?',
    body: ['This will also delete any saved data for 2027.', 'This cannot be undone.', ''],
    cancelLabel: 'Cancel', confirmLabel: 'Remove 2027',
    onConfirm: () => outcome.push('confirm'),
    onCancel: () => outcome.push('cancel'),
  });
  const m = dom.last();
  ok(!!m, 'the modal element is created and appended');
  ok(m.className === 'ingest-modal-overlay', 'with the shared overlay class');
  const h = m.innerHTML;
  ok(/role="dialog"/.test(h) && /aria-modal="true"/.test(h), 'announced as a modal dialog');
  ok(/aria-labelledby="cfm-title"/.test(h) && /id="cfm-title"/.test(h),
     'and labelled by its own title');
  ok(h.indexOf('Remove 2027 from the Dashboard?') >= 0, 'the title is rendered');
  ok((h.match(/<p>/g) || []).length === 2,
     'the two non-empty paragraphs render, and the empty one is dropped: ' +
     (h.match(/<p>/g) || []).length);
  ok(/class="btn btn-secondary" type="button" data-cfm="cancel">Cancel</.test(h),
     'cancel is the SECONDARY button, labelled Cancel');
  ok(/class="btn btn-primary" type="button" data-cfm="confirm">Remove 2027</.test(h),
     'and the destructive action is NAMED on the primary button');
  ok(h.indexOf('>OK<') < 0 && h.indexOf('OK</button>') < 0, 'the word OK appears nowhere');
  ok(h.indexOf('btn-danger') < 0, 'and no danger variant is used');
  ok(dom.rec.focused[0] === 'cancel',
     'focus lands on CANCEL, so a stray Enter cannot delete anything: ' +
     JSON.stringify(dom.rec.focused));
  ok(outcome.length === 0, 'and nothing has run yet: opening decides nothing');
});

lines.push('');
lines.push('=== every way OUT of the modal, and which one it counts as ===');
[
  ['[data-cfm="cancel"]', 'click', 'cancel', 'the Cancel button'],
  ['[data-cfm="confirm"]', 'click', 'confirm', 'the primary button'],
  ['.ingest-modal-close', 'click', 'cancel', 'the X'],
].forEach(([sel, ev, want, label]) => {
  const dom = makeDom();
  const api = confirmApi(dom);
  const outcome = [];
  api.openConfirmModal({ title: 't', body: ['b'], cancelLabel: 'Keep', confirmLabel: 'Go',
    onConfirm: () => outcome.push('confirm'), onCancel: () => outcome.push('cancel') });
  const node = dom.last().querySelector(sel);
  ok(!!node, label + ': the node exists');
  if (node) node._on[ev][0]({});
  ok(outcome.length === 1 && outcome[0] === want,
     label + ' counts as ' + want.toUpperCase() + ': ' + JSON.stringify(outcome));
  ok(dom.rec.removed === 1, label + ': the modal is removed exactly once');
  ok(dom.rec.docRemoved.indexOf('keydown') >= 0,
     label + ': and the document keydown listener is removed, so they cannot pile up');
});

guard("section 5", () => {
  /* Escape parity with window.confirm, which this replaces. */
  const dom = makeDom();
  const api = confirmApi(dom);
  const outcome = [];
  api.openConfirmModal({ title: 't', body: ['b'],
    onConfirm: () => outcome.push('confirm'), onCancel: () => outcome.push('cancel') });
  const esc = (dom.rec.docListeners.keydown || [])[0];
  ok(typeof esc === 'function', 'a document keydown listener is registered for Escape');
  esc({ key: 'a' });
  ok(outcome.length === 0, 'an unrelated key does nothing');
  esc({ key: 'Escape' });
  ok(outcome.length === 1 && outcome[0] === 'cancel',
     'ESCAPE cancels, matching window.confirm rather than losing the behaviour');
});

guard("section 6", () => {
  /* the backdrop */
  const dom = makeDom();
  const api = confirmApi(dom);
  const outcome = [];
  api.openConfirmModal({ title: 't', body: ['b'],
    onConfirm: () => outcome.push('confirm'), onCancel: () => outcome.push('cancel') });
  const m = dom.last();
  m._on.click[0]({ target: m.querySelector('[data-cfm="cancel"]') });
  ok(outcome.length === 0, 'a click INSIDE the dialog does not dismiss it');
  m._on.click[0]({ target: m });
  ok(outcome.length === 1 && outcome[0] === 'cancel', 'a click on the BACKDROP cancels');
});

guard("section 7", () => {
  /* the settled guard: one outcome, whatever happens */
  const dom = makeDom();
  const api = confirmApi(dom);
  let n = 0;
  api.openConfirmModal({ title: 't', body: ['b'], onConfirm: () => { n++; } });
  const btn = dom.last().querySelector('[data-cfm="confirm"]');
  btn._on.click[0]({});
  btn._on.click[0]({});
  btn._on.click[0]({});
  ok(n === 1, 'THREE clicks on the primary button run the continuation ONCE: ' + n);
  ok(dom.rec.removed === 1, 'and remove it once');
  const esc = (dom.rec.docListeners.keydown || [])[0];
  esc({ key: 'Escape' });
  ok(n === 1, 'and Escape after confirming does not then also cancel');
});

guard("section 8", () => {
  /* an absent handler must not throw: openConfirmModal is called with only
   * onConfirm at three sites. */
  const dom = makeDom();
  const api = confirmApi(dom);
  let threw = null;
  try {
    api.openConfirmModal({ title: 't', body: ['b'], onConfirm: () => {} });
    dom.last().querySelector('[data-cfm="cancel"]')._on.click[0]({});
  } catch (e) { threw = e.message; }
  ok(threw === null, 'cancelling with no onCancel given is a no-op, not a crash');
});

lines.push('');
lines.push('=== the shared vocabulary: Discard Changes means one thing ===');
guard("the shared vocabulary: Discard Changes means one thing", () => {
  const dom = makeDom();
  const api = confirmApi(dom);
  const outcome = [];
  api.confirmDiscardChanges(() => outcome.push('confirm'), () => outcome.push('cancel'));
  const h = dom.last().innerHTML;
  ok(h.indexOf('Discard Unsaved Changes?') >= 0, 'the title is Discard Unsaved Changes?');
  ok(/data-cfm="cancel">Keep Editing</.test(h), 'cancel is Keep Editing');
  ok(/data-cfm="confirm">Discard Changes</.test(h), 'and confirm is Discard Changes');
  const dc = grab('confirmDiscardChanges');
  ok((SRC.match(/confirmDiscardChanges\(/g) || []).length - 1 === 5,
     'FIVE callers share it: four dirty guards and Reset');
  /* CODE only. My own comment at site 10 says "Discard Changes means one thing
   * everywhere on this page", and prose about a label is not a second
   * definition of it. */
  ok(!/Discard Changes/.test(codeOnly(SRC).replace(codeOnly(dc), '')),
     'and the label is defined ONCE in code, not retyped at any call site');
  ok((SRC.match(/Discard Changes/g) || []).length >= 2,
     'it does appear in prose too, which is why that check reads code only');
});


/* ==================================================================== */
lines.push('');
lines.push('=== THE SITES, driven for real: cancel runs NOTHING ===');

/* wireIngestPage and wireIngestEditor register the handlers for sites 2, 3, 4,
 * 5, 6, 8, 9 and 10. Both are driven with the REAL openConfirmModal, so what
 * is proven is the whole path: click -> modal -> the button -> the
 * continuation, or no continuation at all.
 *
 * This is the assertion that matters most in this ticket. window.confirm
 * blocked, so the old code could ask and then fall through; a modal cannot. A
 * site that left its work outside onConfirm would do the work on CANCEL, and
 * only driving it catches that -- reading the source does not. */
function sitesDriver(over) {
  const dom = makeDom();
  const api = confirmApi(dom);
  const calls = [];
  const ing = Object.assign({
    sectionId: 'A', tableId: 'A1', year: '2025', dirty: false,
    schema: ['Program Name', 'Total Funds Expended ($)'],
    draft: [['Alpha', 1], ['Beta', 2]],
    baseline: [['Alpha', 1], ['Beta', 2]],
  }, over || {});
  const state = { payload: PAYLOAD, year: '2025', ingest: ing };

  const secNode = dom.el('select'); secNode.value = 'A';
  const yearNode = dom.el('select'); yearNode.value = '2025';
  const tabNode = dom.el('button'); tabNode._attrs['data-ingest-table'] = 'A5';
  const removeBtn = dom.el('button');
  const addBtn = dom.el('button');
  const resetBtn = dom.el('button');
  const delBtn = dom.el('button'); delBtn.dataset = { row: '1' };
  const byId = { 'ingest-section': secNode, 'ingest-year': yearNode,
    'ingest-remove-year': removeBtn, 'ingest-addyear': addBtn,
    'ingest-reset': resetBtn };
  const pageDoc = {
    body: { appendChild: () => {} },
    createElement: dom.documentStub.createElement,
    addEventListener: dom.documentStub.addEventListener,
    removeEventListener: dom.documentStub.removeEventListener,
    getElementById: (id) => (byId[id] === undefined ? null : byId[id]),
    querySelector: () => null,
    querySelectorAll: (s) => {
      if (s.indexOf('.src-tab') >= 0) return [tabNode];
      if (s.indexOf('.ingest-row-delete') >= 0) return [delBtn];
      return [];
    },
  };
  const deps = {
    document: pageDoc,
    state: state,
    openConfirmModal: api.openConfirmModal,
    confirmDiscardChanges: api.confirmDiscardChanges,
    Storage: {
      removeYear: (y) => { calls.push('Storage.removeYear:' + y); return over && over._refuse ? false : true; },
      toast: (m, t) => { calls.push('toast:' + m); },
    },
    compareTableIds: (x, y) => String(x).localeCompare(String(y)),
    loadIngestDraft: () => calls.push('loadIngestDraft'),
    rerenderIngestAll: () => calls.push('rerenderIngestAll'),
    rerenderIngestEditor: () => calls.push('rerenderIngestEditor'),
    rerenderIngestHistory: () => calls.push('rerenderIngestHistory'),
    syncRemoveYearButton: () => calls.push('syncRemoveYearButton'),
    wireIngestEditor: () => {}, wireIngestHistory: () => {},
    openAddYearDialog: () => calls.push('openAddYearDialog'),
    buildYearSelector: () => calls.push('buildYearSelector'),
    mostRecentYear: () => '2025',
    recomputeTotals: () => calls.push('recomputeTotals'),
    clone2D: (m) => m.map(r => r.slice()),
    refreshIngestStatus: () => {}, parseNumericInput: (s) => s,
    escapeHtml: (s) => String(s == null ? '' : s),
  };
  const keys = Object.keys(deps);
  const runPage = new Function(...keys,
    grab('wireIngestPage') + '\nreturn wireIngestPage;')(...keys.map(k => deps[k]));
  const runEditor = new Function(...keys,
    grab('wireIngestEditor') + '\nreturn wireIngestEditor;')(...keys.map(k => deps[k]));
  return { dom: dom, calls: calls, state: state, ing: ing, runPage: runPage,
    runEditor: runEditor, secNode: secNode, yearNode: yearNode, tabNode: tabNode,
    removeBtn: removeBtn, resetBtn: resetBtn, delBtn: delBtn,
    modal: () => dom.last(),
    press: (which) => {
      const n = dom.last().querySelector('[data-cfm="' + which + '"]');
      if (!n) return false;
      n._on.click[0]({});
      return true;
    },
  };
}

/* --- SITE 3, the source-table tab: the simplest of the four guards ----- */
guard("SITE 3, the source-table tab: the simplest of the four guards", () => {
  const d = sitesDriver({ dirty: true });
  d.runPage();
  ok(!!d.tabNode._on.click, 'site 3: the tab is wired');
  d.tabNode._on.click[0]({});
  ok(!!d.modal() && /Discard Unsaved Changes\?/.test(d.modal().innerHTML),
     'site 3: a dirty tab click OPENS the modal rather than a native confirm');
  ok(d.ing.tableId === 'A1',
     'site 3: and the table has NOT moved while the question is open');
  d.press('cancel');
  ok(d.ing.tableId === 'A1', 'site 3 CANCEL: the table is still A1');
  ok(d.calls.indexOf('loadIngestDraft') < 0 && d.calls.indexOf('rerenderIngestAll') < 0,
     'site 3 CANCEL: nothing was loaded or rerendered -- the continuation never ran');

  const e = sitesDriver({ dirty: true });
  e.runPage();
  e.tabNode._on.click[0]({});
  e.press('confirm');
  ok(e.ing.tableId === 'A5', 'site 3 CONFIRM: the table moves to A5');
  ok(e.calls.filter(c => c === 'loadIngestDraft').length === 1,
     'site 3 CONFIRM: the continuation ran EXACTLY once');
  ok(e.calls.indexOf('rerenderIngestAll') >= 0,
     'site 3 CONFIRM: and the PAGE rerenders, so the active tab moves with it');

  const f = sitesDriver({ dirty: false });
  f.runPage();
  f.tabNode._on.click[0]({});
  ok(f.ing.tableId === 'A5' && !f.dom.last(),
     'site 3 CLEAN: with nothing unsaved there is no question at all');
});

/* --- SITES 2 and 4, the dropdowns: revert on open, re-apply on confirm - */
guard("SITES 2 and 4, the dropdowns: revert on open, re-apply on confirm", () => {
  const d = sitesDriver({ dirty: true });
  d.runPage();
  ok(!!d.secNode._on.change, 'site 2: the Section dropdown is wired');
  d.secNode.value = 'B';
  d.secNode._on.change[0]({ target: d.secNode });
  ok(!!d.modal(), 'site 2: a dirty change opens the modal');
  ok(d.secNode.value === 'A',
     'site 2 REVERT ON OPEN: the select shows A again while the modal is up, ' +
     'not the B the page is not on');
  ok(d.ing.sectionId === 'A', 'site 2: and the page state is untouched');
  d.press('cancel');
  ok(d.secNode.value === 'A' && d.ing.sectionId === 'A',
     'site 2 CANCEL: both the select and the state stay on A');
  ok(d.calls.indexOf('loadIngestDraft') < 0, 'site 2 CANCEL: no continuation ran');

  const e = sitesDriver({ dirty: true });
  e.runPage();
  e.secNode.value = 'B';
  e.secNode._on.change[0]({ target: e.secNode });
  e.press('confirm');
  ok(e.ing.sectionId === 'B',
     'site 2 CONFIRM: the chosen section B is RE-APPLIED, not the reverted A');
  ok(e.calls.indexOf('rerenderIngestAll') >= 0,
     'site 2 CONFIRM: rerenderIngestAll rebuilds the picker, so the select follows');

  const g = sitesDriver({ dirty: true });
  g.runPage();
  ok(!!g.yearNode._on.change, 'site 4: the Year dropdown is wired');
  g.yearNode.value = '2023';
  g.yearNode._on.change[0]({ target: g.yearNode });
  ok(g.yearNode.value === '2025',
     'site 4 REVERT ON OPEN: the year select shows 2025 while the modal is up');
  g.press('confirm');
  ok(g.ing.year === '2023', 'site 4 CONFIRM: the state moves to 2023');
  ok(g.yearNode.value === '2023',
     'site 4 CONFIRM: and the select is set back to 2023 ITSELF, because this ' +
     'path rerenders only the editor and would otherwise leave 2025 showing');

  const h = sitesDriver({ dirty: true });
  h.runPage();
  h.yearNode.value = '2023';
  h.yearNode._on.change[0]({ target: h.yearNode });
  h.press('cancel');
  ok(h.yearNode.value === '2025' && h.ing.year === '2025',
     'site 4 CANCEL: select and state both remain on 2025');
});

/* --- SITE 5 and 6: Remove Year, and the refusal that is now a toast ---- */
guard("SITE 5 and 6: Remove Year, and the refusal that is now a toast", () => {
  const d = sitesDriver({ year: '2027' });
  d.runPage();
  ok(!!d.removeBtn._on.click, 'site 5: Remove Year is wired');
  d.removeBtn._on.click[0]({});
  const h = d.modal().innerHTML;
  ok(h.indexOf('Remove 2027 from the Dashboard?') >= 0, 'site 5: the year is in the title');
  ok(/data-cfm="confirm">Remove 2027</.test(h),
     'site 5: and NAMED on the button, so the destructive action is unmistakable');
  ok(h.indexOf('This cannot be undone.') >= 0, 'site 5: the warning survives the move');
  d.press('cancel');
  ok(d.calls.indexOf('Storage.removeYear:2027') < 0,
     'site 5 CANCEL: Storage.removeYear was NEVER called -- the year survives');
  ok(d.state.payload.meta.years.indexOf('2027') === PAYLOAD.meta.years.indexOf('2027'),
     'site 5 CANCEL: and meta.years is untouched');

  const e = sitesDriver({ year: '2027' });
  e.runPage();
  e.removeBtn._on.click[0]({});
  e.press('confirm');
  ok(e.calls.filter(c => c === 'Storage.removeYear:2027').length === 1,
     'site 5 CONFIRM: removeYear called exactly once');
  ok(e.calls.indexOf('buildYearSelector') >= 0,
     'site 5 CONFIRM: and the whole continuation ran, down to the year selector');

  /* SITE 6: the refusal. A toast, not a modal, and not an alert. */
  const f = sitesDriver({ year: '2027', _refuse: true });
  f.runPage();
  f.removeBtn._on.click[0]({});
  f.press('confirm');
  const toasts = f.calls.filter(c => c.indexOf('toast:') === 0);
  ok(toasts.length === 1, 'site 6: the refusal raises exactly one toast');
  ok(/has data \(or is a seed year\) and cannot be removed/.test(toasts[0]),
     'site 6: with the same words the alert had: ' + toasts[0]);
  ok(f.calls.indexOf('buildYearSelector') < 0,
     'site 6: and the continuation STOPS there -- nothing else was touched');
});

/* --- SITES 8, 9 and 10, on the editor ---------------------------------- */
guard("SITES 8, 9 and 10, on the editor", () => {
  const d = sitesDriver({});
  d.runEditor();
  ok(!!d.delBtn._on.click, 'site 9: the delete-row button is wired');
  d.delBtn._on.click[0]({});
  ok(!!d.modal() && /Delete This Row\?/.test(d.modal().innerHTML),
     'site 9: it asks through the modal');
  ok(/data-cfm="confirm">Delete Row</.test(d.modal().innerHTML),
     'site 9: with Delete Row on the button');
  ok(d.ing.draft.length === 2, 'site 9: and the row is still there while it asks');
  d.press('cancel');
  ok(d.ing.draft.length === 2, 'site 9 CANCEL: the row SURVIVES');
  ok(d.calls.indexOf('recomputeTotals') < 0, 'site 9 CANCEL: nothing recomputed');

  const e = sitesDriver({});
  e.runEditor();
  e.delBtn._on.click[0]({});
  e.press('confirm');
  ok(e.ing.draft.length === 1, 'site 9 CONFIRM: the row is removed');
  ok(e.ing.draft[0][0] === 'Alpha', 'site 9 CONFIRM: and the RIGHT row went');
  ok(e.calls.filter(c => c === 'recomputeTotals').length === 1,
     'site 9 CONFIRM: totals recomputed once');

  /* SITE 8: the last row cannot go, and that is a notification. */
  const f = sitesDriver({ draft: [['Only', 1]], baseline: [['Only', 1]] });
  f.runEditor();
  f.delBtn.dataset = { row: '0' };
  f.delBtn._on.click[0]({});
  ok(!f.dom.last(), 'site 8: no modal opens -- there is nothing to decide');
  const t8 = f.calls.filter(c => c.indexOf('toast:') === 0);
  ok(t8.length === 1 && /Cannot delete the last row/.test(t8[0]),
     'site 8: a toast says so instead: ' + (t8[0] || 'none'));
  ok(f.ing.draft.length === 1, 'site 8: and the row is still there');

  /* SITE 10: Reset, sharing the dirty-guard vocabulary. */
  const g = sitesDriver({ dirty: true, draft: [['Alpha', 99], ['Beta', 2]] });
  g.runEditor();
  ok(!!g.resetBtn._on.click, 'site 10: Reset is wired');
  g.resetBtn._on.click[0]({});
  ok(/Discard Unsaved Changes\?/.test(g.modal().innerHTML),
     'site 10: it uses the SAME question as the dirty guards');
  ok(/data-cfm="confirm">Discard Changes</.test(g.modal().innerHTML),
     'site 10: and the same Discard Changes label');
  g.press('cancel');
  ok(g.ing.draft[0][1] === 99, 'site 10 CANCEL: the edit is KEPT');

  const i = sitesDriver({ dirty: true, draft: [['Alpha', 99], ['Beta', 2]] });
  i.runEditor();
  i.resetBtn._on.click[0]({});
  i.press('confirm');
  ok(i.ing.draft[0][1] === 1,
     'site 10 CONFIRM: the draft is back to the baseline');
  ok(i.ing.draft !== i.ing.baseline,
     'and it is a COPY, not the baseline itself: clone2D, so editing cannot ' +
     'corrupt what reset restores to');
});

/* ==================================================================== */
lines.push('');
lines.push('=== FINDING B: the rejected-inputs table, the acceptance ===');
guard("FINDING B: the rejected-inputs table, the acceptance", () => {
  /* The defect: <input type="number"> reads EMPTY when its text is not a valid
   * number, and the old typedYear() substituted the SUGGESTION for empty. So
   * 2099e could add 2026 while the box said 2099e.
   *
   * Two ends, both asserted here:
   *   1. entry filtering, so the value cannot become non-numeric;
   *   2. typedYear returning what the box holds, so even if end 1 were
   *      bypassed the result is a NAMED ERROR and never a different year. */
  const dlg = grab('openAddYearDialog');
  ok(!!dlg, 'openAddYearDialog is present');

  /* END 1: the filter, driven. e.data covers typing; dataTransfer covers paste. */
  const filterSrc = dlg.slice(dlg.indexOf("const yin = modal.querySelector('#dlg-newyear')"));
  ok(filterSrc.length > 0, 'the entry filter is wired inside the dialog');
  const runFilter = new Function('handlers',
    'const modal = { querySelector: () => ({ addEventListener: (k, fn) => { handlers[k] = fn; } }) };' +
    filterSrc.slice(0, filterSrc.indexOf('\r\n      }') + 9) + '\nreturn handlers;');
  const H = {};
  runFilter(H);
  ok(typeof H.beforeinput === 'function', 'a beforeinput handler is bound');
  ok(typeof H.keydown === 'function', 'and a keydown handler as the second line');

  const tryInput = (ev) => {
    let prevented = false;
    H.beforeinput(Object.assign({ preventDefault: () => { prevented = true; } }, ev));
    return prevented;
  };
  const tryKey = (key) => {
    let prevented = false;
    H.keydown({ key: key, preventDefault: () => { prevented = true; } });
    return prevented;
  };

  /* THE TABLE, exactly as ruled. */
  [['2099e', 'e in a typed year'], ['+2026', 'a leading plus'],
   ['-1', 'a negative'], ['20.26', 'a decimal point'],
   ['2e3', 'exponent notation']].forEach(([text, why]) => {
    ok(tryInput({ data: text }), 'REJECTED as typed text (' + why + '): ' + text);
    ok(tryInput({ data: null, dataTransfer: { getData: () => text } }),
       'REJECTED as a PASTE (' + why + '): ' + text);
  });
  ['e', 'E', '+', '-', '.'].forEach(k => {
    ok(tryKey(k), 'the keydown guard also rejects the bare key: ' + JSON.stringify(k));
  });
  ok(!tryInput({ data: '2' }) && !tryInput({ data: '2099' }),
     'digits are ACCEPTED, single and multiple');
  ok(!tryInput({ data: null }), 'and a deletion passes through, so backspace works');
  ok(!tryKey('Backspace') && !tryKey('ArrowUp') && !tryKey('7'),
     'the keydown guard leaves Backspace, the arrows and digits alone');

  /* END 2: no path reaches addReportingYear with a year the operator did not
   * type. Driven through the real validateReportingYear. */
  const validate = new Function('allYears',
    grab('validateReportingYear') + '\nreturn validateReportingYear;')(
    () => (PAYLOAD.meta.years || []).slice());
  const suggested = String(Math.max.apply(null,
    (PAYLOAD.meta.years || []).map(y => parseInt(y, 10))) + 1);
  ok(validate('').ok === false,
     'an EMPTY year is a named error, not a silent substitution: ' + validate('').error);
  ok(validate('').error.indexOf(suggested) < 0,
     'and the error does not name the suggestion either: nothing points at ' + suggested);
  /* the shape of the old defect, asserted as impossible at the source level:
   * typedYear must not mention `suggested` at all. */
  const ty = dlg.slice(dlg.indexOf('const typedYear ='), dlg.indexOf('const drawYear ='));
  ok(ty.indexOf('suggested') < 0,
     'typedYear() no longer references the suggestion in any branch');
  const dy = dlg.slice(dlg.indexOf('const drawYear ='));
  ok(dy.slice(0, 120).indexOf('suggested') >= 0,
     'drawYear() does, which is the suggestion demoted to an initial value');
  ok(/escapeHtml\(drawYear\(\)\)/.test(dlg),
     'and the INPUT is drawn from drawYear, so the box still opens pre-filled');
  ok(/validateReportingYear\(typedYear\(\)\)/.test(dlg),
     'while VALIDATION reads typedYear, which is what the operator left there');
  ok(!/validateReportingYear\(drawYear\(\)\)/.test(dlg),
     'and never drawYear: validating the suggestion is the defect itself');

  /* the template download stopped guessing a year too */
  ok(/const y = typedYear\(\);[\s\S]{0,400}?if \(!y\) \{/.test(dlg),
     'the template refuses an empty year rather than naming a file for a ' +
     'year nobody chose');
  ok(/Please enter a year\./.test(dlg),
     'and says so on the dialog s own error line');
});

/* ==================================================================== */
lines.push('');
lines.push('=== SITE 1, dsConfirmActivate, driven for real ===');
guard('site 1', () => {
  /* The last native dialog, and the highest-consequence one: it changes what
   * every viewer's map draws. Driven the same way as the other nine. */
  const dom = makeDom();
  const api = confirmApi(dom);
  const RECS = [
    { dvId: 'A', datasetKey: 'dac_tracts', version: 'v3', name: 'DAC tracts',
      geoidVintage: '2020', active: false },
    { dvId: 'B', datasetKey: 'dac_tracts', version: 'v2', name: 'DAC tracts',
      geoidVintage: '2020', active: true },
    { dvId: 'C', datasetKey: 'dac_tracts', version: 'v1', name: 'DAC tracts',
      geoidVintage: '2010', active: true },
  ];
  const deps = {
    dsRecords: () => RECS,
    dsRecIsTerritories: () => false,
    openConfirmModal: api.openConfirmModal,
  };
  const keys = Object.keys(deps);
  const fn = new Function(...keys,
    grab('dsConfirmActivate') + '\nreturn dsConfirmActivate;')(...keys.map(k => deps[k]));

  let ran = 0;
  const opened = fn('A', () => { ran++; });
  ok(opened === true, 'it reports that it asked');
  const m = dom.last();
  ok(!!m, 'a modal opened rather than a native confirm');
  const h = m.innerHTML;
  /* ACTIVATE, the word the Indicators tab already uses. */
  ok(h.indexOf('Activate DAC tracts v3?') >= 0, 'the question is the title: ' +
     (h.match(/<h3[^>]*>([^<]*)</) || [])[1]);
  ok(h.indexOf('Publish') < 0,
     'and the old verb appears nowhere in the dialog, title or body');
  ok(/data-cfm="confirm">Activate DAC tracts v3</.test(h),
     'the action is NAMED on the button, with what is being activated');
  ok(h.indexOf('GEOID vintage 2020.') >= 0, 'the vintage line survives the move');
  ok(h.indexOf('The file is downloaded and checked again before anything changes.') >= 0,
     'so does the re-check line');
  ok(h.indexOf('This changes what everyone sees on the map.') >= 0,
     'and the warning that matters most');
  /* the retire list: same vintage, same family, still active -> B only. C is
   * 2010, a different vintage, so it is NOT retired by this. */
  ok(h.indexOf('This retires 1 active version') >= 0,
     'the retire count is computed and shown, in the same vocabulary: ' +
     (h.match(/This retires [^<]*/) || [])[0]);
  ok(h.indexOf('DAC tracts v2') >= 0, 'naming the version it retires');
  ok(h.indexOf('DAC tracts v1') < 0,
     'and NOT the 2010 one, which a different vintage does not retire');
  ok(ran === 0, 'and nothing has been published yet');
  m.querySelector('[data-cfm="cancel"]')._on.click[0]({});
  ok(ran === 0, 'site 1 CANCEL: the continuation never runs, so nothing publishes');

  const dom2 = makeDom();
  const api2 = confirmApi(dom2);
  const fn2 = new Function(...keys, grab('dsConfirmActivate') +
    '\nreturn dsConfirmActivate;')(() => RECS, () => false, api2.openConfirmModal);
  let ran2 = 0;
  fn2('A', () => { ran2++; });
  dom2.last().querySelector('[data-cfm="confirm"]')._on.click[0]({});
  ok(ran2 === 1, 'site 1 CONFIRM: the continuation runs exactly once');

  /* a record that does not exist is REFUSED, not guessed at */
  const dom3 = makeDom();
  const api3 = confirmApi(dom3);
  const fn3 = new Function(...keys, grab('dsConfirmActivate') +
    '\nreturn dsConfirmActivate;')(() => RECS, () => false, api3.openConfirmModal);
  let ran3 = 0;
  const res3 = fn3('NOPE', () => { ran3++; });
  ok(res3 === false, 'an unknown dataset id is refused: ' + res3);
  ok(!dom3.last(), 'no dialog opens for it');
  ok(ran3 === 0, 'and nothing publishes');

  /* THE CALLER: the checkbox reverts on open, re-checks on confirm. */
  const handler = SRC.slice(SRC.indexOf("const ds = e.target.closest('input[data-ds-active]');"));
  const end = handler.indexOf('\r\n      }') + 9;
  const src = handler.slice(0, end);
  ok(/ds\.checked = false;/.test(src), 'the caller clears the box');
  const before = src.indexOf('ds.checked = false;');
  const asks = src.indexOf('dsConfirmActivate(');
  ok(before >= 0 && asks >= 0 && before < asks,
     'and does so BEFORE it asks, which is what revert-on-open means');
  ok(/ds\.checked = true;[\s\S]{0,120}dsSetActive/.test(src),
     'the box is re-checked and the activation started, both inside onConfirm');
  const cb = { checked: true, dataset: { dsActive: 'A' } };
  const dom4 = makeDom();
  const api4 = confirmApi(dom4);
  const setCalls = [];
  const run = new Function('ds', 'dsConfirmActivate', 'dsSetActive',
    src.replace(/^\s*const ds = [^;]*;/, '') + '\nreturn true;');
  const ask = new Function(...keys, grab('dsConfirmActivate') +
    '\nreturn dsConfirmActivate;')(() => RECS, () => false, api4.openConfirmModal);
  run(cb, ask, (id, on) => setCalls.push(id + ':' + on));
  ok(cb.checked === false,
     'DRIVEN: the box is unchecked while the question is open, not left showing ' +
     'a dataset as published');
  ok(setCalls.length === 0, 'and dsSetActive has not been called');
  dom4.last().querySelector('[data-cfm="cancel"]')._on.click[0]({});
  ok(cb.checked === false && setCalls.length === 0,
     'CANCEL: the box stays off and nothing is published');

  const cb2 = { checked: true, dataset: { dsActive: 'A' } };
  const dom5 = makeDom();
  const api5 = confirmApi(dom5);
  const setCalls2 = [];
  const ask2 = new Function(...keys, grab('dsConfirmActivate') +
    '\nreturn dsConfirmActivate;')(() => RECS, () => false, api5.openConfirmModal);
  run(cb2, ask2, (id, on) => setCalls2.push(id + ':' + on));
  dom5.last().querySelector('[data-cfm="confirm"]')._on.click[0]({});
  ok(cb2.checked === true, 'CONFIRM: the box goes back on');
  ok(setCalls2.length === 1 && setCalls2[0] === 'A:true',
     'and the activation starts exactly once, for that dataset: ' + setCalls2);
});

/* ==================================================================== */
lines.push('');
lines.push('=== ROUND 2: modal TITLES are title case, structurally ===');

/* The standing CLCPA-220 round 4 ruling: first letter of each word
 * capitalised, short connectors lowercase. Checked as a RULE rather than only
 * as four literal strings, so a fifth modal added later cannot slip past it.
 *
 * INTERPOLATED VALUES ARE EXEMPT, and that exemption is the interesting part:
 * site 1's title is 'Publish ' + name + ' ' + version + '?', where name comes
 * from Dataverse ('DAC tracts', lowercase t). That is somebody's data, not our
 * copy, and title-casing it would be rewriting a record. The guard therefore
 * checks only the words WE wrote. */
const TITLE_CONNECTORS = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for',
  'from', 'in', 'into', 'nor', 'of', 'on', 'or', 'per', 'the', 'to', 'up',
  'via', 'with'];
const DATA_MARK = '\u0000';
function titleCaseProblems(s, exempt) {
  let t = String(s == null ? '' : s);
  (exempt || []).forEach(e => { t = t.split(e).join(' ' + DATA_MARK + ' '); });
  const words = t.replace(/[?:.,!]/g, ' ').split(/\s+/).filter(Boolean);
  const bad = [];
  words.forEach((w, i) => {
    if (w === DATA_MARK) return;                 // interpolated data, not copy
    /* A NUMERAL HAS NO CASE. Without this, '2027' in Remove 2027 from the
     * Dashboard? and 'v3' in a version string are both reported as
     * uncapitalised content words. Caught by this checker's own self-test
     * before it was trusted on anything. */
    if (!/[A-Za-z]/.test(w)) return;
    const low = w.toLowerCase();
    const cap = /^[A-Z]/.test(w);
    if (i === 0) {
      if (!cap) bad.push(w + ' (first word must be capitalised)');
      return;
    }
    if (TITLE_CONNECTORS.indexOf(low) >= 0) {
      if (w !== low) bad.push(w + ' (short connector must be lowercase)');
      return;
    }
    if (!cap) bad.push(w + ' (content word must be capitalised)');
  });
  return bad;
}

guard('title case, the checker itself', () => {
  /* The checker is asserted before it is trusted, on cases whose answers are
   * not in doubt. A guard that cannot fail is worse than none, and one that
   * fails wrongly is worse still. */
  ok(titleCaseProblems('Discard Unsaved Changes?').length === 0,
     'it accepts a correct title');
  ok(titleCaseProblems('Discard unsaved changes?').length === 2,
     'it rejects the sentence-case version, naming both words: ' +
     titleCaseProblems('Discard unsaved changes?').join(', '));
  ok(titleCaseProblems('Remove 2027 from the Dashboard?').length === 0,
     'it allows lowercase short connectors');
  ok(titleCaseProblems('Remove 2027 from the Dashboard?', []).length === 0,
     'and treats the numeral 2027 as caseless rather than uncapitalised, ' +
     'which it did not until this checker s own self-test said so');
  /* And the limit of that rule, stated rather than assumed: 'v3' is NOT
   * caseless, because it contains a letter, so it is flagged without an
   * exemption. That is exactly why site 1 exempts its version string instead
   * of trusting the numeral rule to cover it. */
  ok(titleCaseProblems('Publish Dataset v3?').length === 1,
     'a version token like v3 is still flagged: it has a letter, so it is not ' +
     'caseless -- ' + titleCaseProblems('Publish Dataset v3?').join(', '));
  ok(titleCaseProblems('Publish Dataset v3?', ['v3']).length === 0,
     'and exempting it as data is what makes site 1 conform');
  ok(titleCaseProblems('Remove 2027 From The Dashboard?').length === 2,
     'and REJECTS capitalised ones, which is the half a naive check misses: ' +
     titleCaseProblems('Remove 2027 From The Dashboard?').join(', '));
  ok(titleCaseProblems('the Wrong Start?').length === 1,
     'the first word must be capitalised even when it is a connector');
  ok(titleCaseProblems('Publish DAC tracts v3?').length === 2,
     'with no exemption it would flag Dataverse data: ' +
     titleCaseProblems('Publish DAC tracts v3?').join(', '));
  ok(titleCaseProblems('Publish DAC tracts v3?', ['DAC tracts', 'v3']).length === 0,
     'and with the data exempt it passes, which is why site 1 already conforms');
});

guard('title case, the shipped titles', () => {
  /* Read out of app.js, so this is about what SHIPS, not about strings
   * retyped here. */
  const titles = [];
  const push = (re, exempt, label) => {
    const m = SRC.match(re);
    ok(!!m, label + ': the title is found in app.js');
    if (m) titles.push({ text: m[1], exempt: exempt, label: label });
  };
  push(/title: '(Discard [^']*)',/, [], 'the dirty guards and Reset');
  /* Assembled, not a fragment: the first-word rule only means something
   * against a whole title, and this one starts with Remove, three tokens
   * earlier than the captured piece. */
  {
    /* NOT / from the [^']*\/: hardcoding the lowercase connectors meant that
     * capitalising them made the title unfindable, and the suite then said
     * "not found" instead of "not title case". Match any tail. */
    const m = SRC.match(/title: 'Remove ' \+ yr \+ '([^']*)',/);
    ok(!!m, 'Remove Year: the title is found in app.js');
    if (m) titles.push({ text: 'Remove 2027' + m[1], exempt: ['2027'],
                         label: 'Remove Year' });
  }
  push(/title: '(Delete [^']*)',/, [], 'Delete Row');
  ok(titles.length === 3, 'all three of our own titles read back: ' + titles.length);
  titles.forEach(t => {
    const bad = titleCaseProblems(t.text, t.exempt);
    ok(bad.length === 0, t.label + ': ' + JSON.stringify(t.text) +
       ' is title case' + (bad.length ? ' -- ' + bad.join(', ') : ''));
  });
  /* Remove Year's title is a template, and the fragment above omits the leading
   * word, so it is checked whole with the year exempt. */
  ok(titleCaseProblems('Remove 2027 from the Dashboard?', ['2027']).length === 0,
     'Remove Year reads correctly once assembled, with the year exempt');

  /* SITE 1 conforms already, and only because its data is exempt. */
  const ds = grab('dsConfirmActivate');
  ok(/lines = \['Activate ' \+ name \+ '\?'\]/.test(ds),
     'site 1 builds its title as Activate <name> <version>?');
  ok(titleCaseProblems('Activate X?', []).length === 0,
     'whose only word of OUR copy is Activate, already capitalised');
  /* The consequence warning STAYS. It is what the old verb was leaning on, and
   * dropping it while softening the verb would lose the point of the dialog. */
  ok(/This changes what everyone sees on the map\./.test(ds),
     'and the everyone-sees warning is kept, carrying the consequence');
  ok(!/'Publish /.test(ds) && !/published version/.test(ds),
     'with no trace of the old verb left in the function');

  /* THE BODIES STAY SENTENCE CASE. Without this the rule would creep, and a
   * title-cased paragraph is worse than the problem it solved. */
  const bodies = [
    'This table has changes that have not been saved. Continuing will discard them.',
    'This will also delete any saved data for ',
    'This cannot be undone.',
    'The row is removed from the draft. Nothing is stored until you press Save.',
  ];
  bodies.forEach(b => {
    ok(SRC.indexOf(b) >= 0, 'body copy unchanged: ' + JSON.stringify(b.slice(0, 44)));
  });
  ok(titleCaseProblems(bodies[0]).length > 3,
     'and the bodies are deliberately NOT title case: the checker flags ' +
     titleCaseProblems(bodies[0]).length + ' words in the first, as it should');

  /* BUTTON LABELS were already compliant, and are now checked as SHIPPED.
   * These were retyped literals until a mutation lowercased the real label and
   * every one of them stayed green: a string typed in the harness says nothing
   * about the code. Read out of app.js instead. */
  const labelRe = /(?:cancelLabel|confirmLabel): '([^']*)'/g;
  const shipped = [];
  let lm;
  while ((lm = labelRe.exec(SRC)) !== null) {
    if (shipped.indexOf(lm[1]) < 0) shipped.push(lm[1]);
  }
  ok(shipped.length >= 5,
     'the shipped button labels read back from app.js: ' + shipped.join(' | '));
  ok(shipped.indexOf('Keep Editing') >= 0 && shipped.indexOf('Discard Changes') >= 0 &&
     shipped.indexOf('Delete Row') >= 0 && shipped.indexOf('Cancel') >= 0,
     'including the four this ticket named');
  shipped.forEach(lbl => {
    /* 'Remove ' and 'Publish ' end in a space because the year and the dataset
     * name are concatenated on; the trailing token is data and exempt. */
    const bad = titleCaseProblems(lbl.trim(), []);
    ok(bad.length === 0, 'shipped button label is title case: ' +
       JSON.stringify(lbl) + (bad.length ? ' -- ' + bad.join(', ') : ''));
  });
  ok(/confirmLabel: 'Remove ' \+ yr,/.test(SRC),
     'and Remove <year> keeps the year on the button, unchanged by this round');
});
lines.push('');
lines.push('======================================================================');
lines.push('  ' + pass + ' passed, ' + fail + ' failed');
lines.push('======================================================================');
const out = lines.join('\n');
console.log(out);
fs.writeFileSync(path.join(__dirname, 'suite-230-output.txt'), out + '\n');
process.exitCode = fail ? 1 : 0;
