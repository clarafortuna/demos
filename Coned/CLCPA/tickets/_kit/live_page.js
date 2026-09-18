/* A DOM good enough to run the REAL Report Data page.
 *
 * WHY THIS EXISTS. Three defects in one wave shipped with green suites --
 * CLCPA-269's count, CLCPA-278's recompute, CLCPA-276's exits -- and every one
 * of them passed because the suite drove a hand-built slice instead of the
 * page. A slice cannot see which MOUNT a repaint touches, cannot see a handler
 * that was never attached, and cannot see a value read after the write that
 * should have been read before it. Those are precisely the three bugs.
 *
 * So this is a small DOM: a real node tree parsed from the real markup, real
 * getElementById / querySelector, real addEventListener and dispatchEvent,
 * real input .value. It is not a browser. It has no layout, no CSS, no focus
 * model beyond recording, and its selector engine handles the shapes this app
 * actually uses and refuses the rest LOUDLY rather than returning null -- a
 * selector that silently matches nothing is how a driver lies about a handler
 * being absent.
 *
 * Exports: parse(html) -> node, makeDocument() -> { document, root, ... }.
 */

/* ------------------------------------------------------------------ parser */

const VOID = { br: 1, hr: 1, img: 1, input: 1, meta: 1, link: 1, source: 1 };

function parseAttrs(s) {
  const attrs = {};
  const re = /([:@\w-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(s))) {
    const v = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : (m[5] !== undefined ? m[5] : ''));
    attrs[m[1]] = v;
  }
  return attrs;
}

/** Parse a fragment into a detached container node. */
function parse(html, makeNode) {
  const root = makeNode('#fragment');
  const stack = [root];
  const src = String(html == null ? '' : html);
  const tag = /<(\/?)([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g;
  let last = 0, m;
  const text = (s) => {
    if (!s) return;
    const t = s.replace(/\s+/g, ' ');
    if (!t.trim()) return;
    const n = makeNode('#text');
    n._text = t;
    stack[stack.length - 1]._children.push(n);
    n.parentNode = stack[stack.length - 1];
  };
  while ((m = tag.exec(src))) {
    text(src.slice(last, m.index));
    last = tag.lastIndex;
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    if (closing) {
      /* pop to the matching open tag; unbalanced markup pops nothing rather
       * than unwinding the whole document */
      for (let k = stack.length - 1; k > 0; k--) {
        if (stack[k].tagName === name) { stack.length = k; break; }
      }
      continue;
    }
    const n = makeNode(name);
    n._attrs = parseAttrs(m[3] || '');
    const parent = stack[stack.length - 1];
    parent._children.push(n);
    n.parentNode = parent;
    if (!VOID[name] && m[4] !== '/') stack.push(n);
  }
  text(src.slice(last));
  return root;
}

/** Back to markup, so a node built by the parser can still report its HTML. */
function serialise(n) {
  if (n.tagName === '#text') return n._text || '';
  const at = Object.keys(n._attrs)
    .map(k => ' ' + k + '="' + String(n._attrs[k]).replace(/"/g, '&quot;') + '"').join('');
  if (VOID[n.tagName]) return '<' + n.tagName + at + ' />';
  const inner = n._html !== undefined ? n._html : n._children.map(serialise).join('');
  return '<' + n.tagName + at + '>' + inner + '</' + n.tagName + '>';
}

/* ---------------------------------------------------------------- selector */

function matchSimple(node, sel) {
  let s = sel.trim();
  if (!s) return false;
  let m;
  /* tag */
  let tagWanted = null;
  m = /^([a-zA-Z][\w-]*)/.exec(s);
  if (m) { tagWanted = m[1].toLowerCase(); s = s.slice(m[1].length); }
  /* VALIDATE BEFORE MATCHING. The syntax check used to sit after the loop, so
   * any early `return false` on a class mismatch jumped over it and an
   * unsupported selector like td:not(.num) quietly matched nothing instead of
   * throwing -- the kit's own self-test caught it, which is the point of
   * testing the driver before trusting it. */
  const part = /(#[\w-]+)|(\.[\w-]+)|(\[[^\]]+\])/g;
  const parts = [];
  let p, seen = 0;
  while ((p = part.exec(s))) { parts.push(p); seen += p[0].length; }
  if (seen !== s.length) {
    throw new Error('live_page: unsupported selector fragment ' + JSON.stringify(sel) +
      ' -- extend the kit rather than letting it silently match nothing');
  }
  if (tagWanted && node.tagName !== tagWanted) return false;
  for (const q of parts) {
    if (q[1]) { if (node.id !== q[1].slice(1)) return false; }
    else if (q[2]) { if (!node.classList.contains(q[2].slice(1))) return false; }
    else if (q[3]) {
      const body = q[3].slice(1, -1);
      const eq = /^([:@\w-]+)\s*=\s*"?([^"\]]*)"?$/.exec(body);
      if (eq) { if (node.getAttribute(eq[1]) !== eq[2]) return false; }
      else if (node.getAttribute(body) === null) return false;
    }
  }
  return true;
}

/** Descendant combinators only (space). Comma-separated groups supported. */
function matches(node, selector) {
  return String(selector).split(',').some((group) => {
    const parts = group.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return false;
    if (!matchSimple(node, parts[parts.length - 1])) return false;
    let cur = node.parentNode, k = parts.length - 2;
    while (k >= 0) {
      let found = false;
      while (cur) {
        if (matchSimple(cur, parts[k])) { found = true; cur = cur.parentNode; break; }
        cur = cur.parentNode;
      }
      if (!found) return false;
      k--;
    }
    return true;
  });
}

/* -------------------------------------------------------------------- node */

function makeDocument() {
  const rec = { focused: [], removed: [], alerts: [], timeouts: [] };

  function makeNode(tagName) {
    const n = {
      tagName: tagName,
      _attrs: {},
      _children: [],
      _on: {},
      _text: undefined,
      parentNode: null,
      style: {},
      disabled: false,
      checked: false,
      files: null,
    };
    Object.defineProperty(n, 'id', {
      get() { return n._attrs.id === undefined ? '' : n._attrs.id; },
      set(v) { n._attrs.id = v; },
    });
    Object.defineProperty(n, 'className', {
      get() { return n._attrs.class === undefined ? '' : n._attrs.class; },
      set(v) { n._attrs.class = v; },
    });
    Object.defineProperty(n, 'value', {
      get() {
        if (n._value !== undefined) return n._value;
        return n._attrs.value === undefined ? '' : n._attrs.value;
      },
      set(v) { n._value = v == null ? '' : String(v); },
    });
    Object.defineProperty(n, 'children', { get() { return n._children.filter(c => c.tagName !== '#text'); } });
    Object.defineProperty(n, 'classList', {
      get() {
        return {
          contains: (c) => n.className.split(/\s+/).indexOf(c) >= 0,
          add: (c) => { if (n.className.split(/\s+/).indexOf(c) < 0) n.className = (n.className + ' ' + c).trim(); },
          remove: (c) => { n.className = n.className.split(/\s+/).filter(x => x && x !== c).join(' '); },
          toggle: (c, on) => { if (on === undefined ? n.classList.contains(c) : !on) n.classList.remove(c); else n.classList.add(c); },
        };
      },
    });
    Object.defineProperty(n, 'innerHTML', {
      /* SERIALISED FROM THE CHILDREN when this node came from the parser.
       * Returning '' for a parsed node made a sibling mount look EMPTY after a
       * repaint elsewhere, which is the exact thing these suites have to tell
       * apart: untouched and wiped must not read the same. */
      get() {
        if (n._html !== undefined) return n._html;
        return n._children.map(serialise).join('');
      },
      set(v) {
        n._html = String(v == null ? '' : v);
        const frag = parse(n._html, makeNode);
        n._children = frag._children;
        n._children.forEach((c) => { c.parentNode = n; });
      },
    });
    Object.defineProperty(n, 'textContent', {
      get() {
        if (n.tagName === '#text') return n._text || '';
        if (n._textSet !== undefined) return n._textSet;
        return n._children.map(c => c.textContent).join('');
      },
      set(v) { n._textSet = v == null ? '' : String(v); n._children = []; n._html = ''; },
    });

    /* the editor's handlers read e.target.dataset.row / .col, so a node
     * without dataset makes every real handler throw rather than run */
    Object.defineProperty(n, 'dataset', {
      get() {
        const d = {};
        Object.keys(n._attrs).forEach((k) => {
          const m = /^data-(.+)$/.exec(k);
          if (m) d[m[1].replace(/-([a-z])/g, (x, c) => c.toUpperCase())] = n._attrs[k];
        });
        return d;
      },
    });

    n.getAttribute = (k) => (n._attrs[k] === undefined ? null : n._attrs[k]);
    n.setAttribute = (k, v) => { n._attrs[k] = String(v); };
    n.removeAttribute = (k) => { delete n._attrs[k]; };
    n.hasAttribute = (k) => n._attrs[k] !== undefined;
    n.appendChild = (c) => { c.parentNode = n; n._children.push(c); return c; };
    n.removeChild = (c) => { n._children = n._children.filter(x => x !== c); return c; };
    n.remove = () => { rec.removed.push(n.tagName + '#' + n.id); if (n.parentNode) n.parentNode.removeChild(n); };
    n.focus = () => { rec.focused.push(n.id || n.tagName); };
    n.blur = () => {};
    n.click = () => n.dispatchEvent({ type: 'click' });
    n.closest = (sel) => { let c = n; while (c) { if (c.tagName !== '#text' && matches(c, sel)) return c; c = c.parentNode; } return null; };

    n._walk = function* () {
      for (const c of n._children) {
        if (c.tagName === '#text') continue;
        yield c;
        yield* c._walk();
      }
    };
    n.querySelector = (sel) => { for (const c of n._walk()) if (matches(c, sel)) return c; return null; };
    n.querySelectorAll = (sel) => { const out = []; for (const c of n._walk()) if (matches(c, sel)) out.push(c); return out; };

    n.addEventListener = (k, fn) => { (n._on[k] = n._on[k] || []).push(fn); };
    n.removeEventListener = (k, fn) => { n._on[k] = (n._on[k] || []).filter(f => f !== fn); };
    n.dispatchEvent = (ev) => {
      const e = Object.assign({ target: n, currentTarget: n, preventDefault() {}, stopPropagation() {} }, ev);
      /* the listener list is copied: a handler that rewires during dispatch
       * must not change who else hears THIS event */
      (n._on[e.type] || []).slice().forEach(fn => fn(e));
      /* bubble, because the editor delegates clicks to the grid */
      let p = n.parentNode;
      while (p) {
        const ev2 = Object.assign({}, e, { currentTarget: p });
        (p._on[e.type] || []).slice().forEach(fn => fn(ev2));
        p = p.parentNode;
      }
      return true;
    };
    return n;
  }

  const root = makeNode('div');
  root.setAttribute('id', 'root');

  const document = {
    _root: root,
    body: makeNode('body'),
    documentElement: makeNode('html'),
    createElement: (t) => makeNode(String(t).toLowerCase()),
    createTextNode: (t) => { const n = makeNode('#text'); n._text = t; return n; },
    getElementById: (id) => {
      for (const c of root._walk()) if (c.id === id) return c;
      for (const c of document.body._walk()) if (c.id === id) return c;
      return null;
    },
    /* BODY ONLY. root is appended INTO body, so querying both and
     * concatenating returned every match twice -- a grid with 8 <th> reported
     * 16, and any suite counting rendered elements would have been counting
     * the same nodes over again. */
    querySelector: (s) => document.body.querySelector(s),
    querySelectorAll: (s) => document.body.querySelectorAll(s),
    addEventListener: (k, fn) => { (document._on[k] = document._on[k] || []).push(fn); },
    removeEventListener: () => {},
    _on: {},
  };
  document.body.appendChild(root);

  return { document, root, rec, makeNode, parse: (h) => parse(h, makeNode), matches };
}

module.exports = { makeDocument, parse, matches };
