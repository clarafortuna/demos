/* THE CASCADE RESOLVER. Standing kit, CLCPA-248 round 3.
 *
 * WHY THIS EXISTS. Twice now a CLCPA-248 build shipped a stylesheet rule that
 * was present, correct, and inert. `.data-table-cmp { table-layout: fixed; }`
 * sat at styles.css:592 while `.data-table { table-layout: auto; }` sat at
 * :1503 with the SAME specificity, 900-odd lines later, so auto won every
 * time and the compare colgroup was never authoritative. The suite asserted
 * that the rule EXISTED, and it did exist. It even asserted that the shared
 * rule still said auto and called that correct, which is the defect wearing
 * the badge of a passing test.
 *
 * A declaration's presence says nothing about whether it applies. From here
 * on, any assertion about how something LOOKS resolves the cascade instead of
 * matching rule text: given a stylesheet and an element's tag and classes,
 * which declaration of a property actually wins.
 *
 * WHAT IT DOES NOT DO, stated so nobody reads more into a green run:
 *   - no layout. It answers which DECLARATION wins, not what the browser then
 *     draws with it. A colgroup under table-layout: fixed is authoritative;
 *     how the pixels land is still an eye's job.
 *   - no inheritance, no initial values, no user-agent sheet.
 *   - descendant and child combinators are judged ONLY when the caller
 *     supplies the element's full ancestor chain. Without it, a rule whose
 *     rightmost compound matches is returned in `conditional`, never silently
 *     counted and never silently dropped. A caller that ignores `conditional`
 *     is back to guessing.
 *   - sibling combinators, at-rule bodies, attribute and pseudo selectors are
 *     always conditional: nothing here knows the document.
 *
 * Pure, no I/O. Every consumer self-tests it on synthetic input before
 * trusting it on a real file, because this module is shared and a shared
 * helper that drifts silently rewrites the history of every suite using it.
 */
'use strict';

/* Comment stripper that preserves line numbers, and reports an unterminated
 * comment rather than swallowing the rest of the file. styles.css carries a
 * dead block that has fooled a reader of this project before. */
function stripComments(css) {
  let out = '', i = 0, inC = false, openedAt = -1;
  while (i < css.length) {
    if (!inC && css[i] === '/' && css[i + 1] === '*') { inC = true; openedAt = i; i += 2; continue; }
    if (inC && css[i] === '*' && css[i + 1] === '/') { inC = false; openedAt = -1; i += 2; continue; }
    if (!inC) out += css[i];
    else if (css[i] === '\n') out += '\n';
    i++;
  }
  return { css: out, unterminated: inC ? css.slice(0, openedAt).split('\n').length : 0 };
}

/* [ids, classes+attributes+pseudo-classes, types+pseudo-elements] */
function specificity(sel) {
  const s = String(sel);
  return [
    (s.match(/#[A-Za-z0-9_-]+/g) || []).length,
    (s.match(/\.[A-Za-z0-9_-]+|\[[^\]]*\]|:(?!:)[a-z-]+/gi) || []).length,
    (s.match(/(?:^|[\s>+~])[a-z][a-z0-9]*/gi) || []).length +
      (s.match(/::[a-z-]+/gi) || []).length,
  ];
}

/* Rule walker. Tracks brace depth so at-rule bodies are visited with their
 * prelude recorded, and @keyframes / @font-face are skipped entirely. */
function parseRules(css) {
  const rules = [];
  let i = 0, buf = '', line = 1, startLine = 1;
  const at = [];
  while (i < css.length) {
    const c = css[i];
    if (c === '\n') line++;
    /* THE LINE A RULE STARTS ON is the line of the first non-space character
     * of its prelude, taken as that character is read. Setting it after the
     * previous rule closed put every rule on the line of the one before it,
     * so adjacent rules tied on `line` and the order tie-break -- the exact
     * thing this module exists to compute -- silently did nothing. Found by a
     * mutation control that could not go red. */
    if (buf.trim() === '' && !/\s/.test(c) && c !== '{' && c !== '}') startLine = line;
    if (c === '{') {
      const prelude = buf.trim();
      buf = '';
      if (prelude[0] === '@') {
        const name = (/^@([a-z-]+)/i.exec(prelude) || [, ''])[1].toLowerCase();
        if (name === 'keyframes' || name === 'font-face' || name === 'page' ||
            name === 'counter-style' || name === 'property') {
          let d = 1; i++;
          while (i < css.length && d) { if (css[i] === '{') d++; else if (css[i] === '}') d--; else if (css[i] === '\n') line++; i++; }
          startLine = line; continue;
        }
        at.push(prelude);            /* @media, @supports, @layer: descend */
        i++; startLine = line; continue;
      }
      /* a style rule: read its body */
      let d = 1, body = '';
      i++;
      while (i < css.length && d) {
        if (css[i] === '{') d++;
        else if (css[i] === '}') { d--; if (!d) break; }
        else if (css[i] === '\n') line++;
        body += css[i]; i++;
      }
      i++;
      rules.push({ selectorText: prelude, body, line: startLine, at: at.slice() });
      startLine = line;
      continue;
    }
    if (c === '}') { at.pop(); buf = ''; i++; startLine = line; continue; }
    buf += c; i++;
  }
  return rules;
}

/* The LAST declaration of a property in a block is the one that counts. */
function lastDeclaration(body, prop) {
  const re = new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*([^;!]+?)\\s*(!important)?\\s*(?=;|$)', 'gi');
  let m, last = null;
  while ((m = re.exec(body))) last = { value: m[1].trim(), important: !!m[2] };
  return last;
}

function compoundMatches(compound, el) {
  if (/[\[:]/.test(compound)) return 'conditional';
  const tag = (/^[A-Za-z][A-Za-z0-9]*/.exec(compound) || [null])[0];
  const id = (/#([A-Za-z0-9_-]+)/.exec(compound) || [, null])[1];
  const classes = (compound.match(/\.[A-Za-z0-9_-]+/g) || []).map(c => c.slice(1));
  if (compound === '*') return true;
  if (tag && el.tag && tag.toLowerCase() !== String(el.tag).toLowerCase()) return false;
  if (id && id !== el.id) return false;
  const own = el.classes || [];
  if (!classes.every(c => own.indexOf(c) >= 0)) return false;
  return true;
}

function compare(a, b) {
  if (a.important !== b.important) return a.important ? 1 : -1;
  for (let k = 0; k < 3; k++) if (a.spec[k] !== b.spec[k]) return a.spec[k] - b.spec[k];
  return a.line - b.line;
}

/* Split "a > b c" into [{comb:null,compound:'a'},{comb:'>',compound:'b'},
 * {comb:' ',compound:'c'}]. Returns null for anything with a sibling
 * combinator, which nothing here can judge. */
function parseSelector(sel) {
  const parts = [];
  const re = /\s*([>+~])\s*|\s+/g;
  let last = 0, m, comb = null;
  while ((m = re.exec(sel))) {
    const piece = sel.slice(last, m.index).trim();
    if (piece) { parts.push({ comb, compound: piece }); comb = m[1] || ' '; }
    else if (m[1]) comb = m[1];
    last = re.lastIndex;
  }
  const tail = sel.slice(last).trim();
  if (tail) parts.push({ comb, compound: tail });
  if (parts.some(p => p.comb === '+' || p.comb === '~')) return null;
  return parts;
}

/* Right-to-left match of a compound sequence against ancestors + element.
 * `chain` is root-most first and ENDS with the element itself. */
function chainMatches(parts, chain) {
  let ci = chain.length - 1;
  let conditional = false;
  for (let pi = parts.length - 1; pi >= 0; pi--) {
    const want = parts[pi];
    if (pi === parts.length - 1) {
      const m = compoundMatches(want.compound, chain[ci]);
      if (m === false) return false;
      if (m === 'conditional') conditional = true;
      ci--;
      continue;
    }
    if (want.comb === '>' || parts[pi + 1].comb === '>') {
      if (ci < 0) return false;
      const m = compoundMatches(want.compound, chain[ci]);
      if (m === false) return false;
      if (m === 'conditional') conditional = true;
      ci--;
    } else {
      let found = false;
      while (ci >= 0) {
        const m = compoundMatches(want.compound, chain[ci]);
        ci--;
        if (m !== false) { if (m === 'conditional') conditional = true; found = true; break; }
      }
      if (!found) return false;
    }
  }
  return conditional ? 'conditional' : true;
}

/**
 * resolve(cssText, element, property)
 *   element: { tag, id, classes: [...], ancestors?: [{tag,id,classes}, ...] }
 *            ancestors are root-most first. Supply them and descendant/child
 *            selectors are judged; omit them and such selectors land in
 *            `conditional` instead of being guessed at.
 * returns { winner, candidates, conditional, unterminatedCommentAt }
 *   winner      the declaration that applies, or null if none does
 *   candidates  every decidable matching declaration, source order
 *   conditional matches this resolver refuses to judge. NEVER ignore it.
 */
function resolve(cssText, element, property) {
  const s = stripComments(String(cssText));
  const rules = parseRules(s.css);
  const candidates = [], conditional = [];
  const hasChain = Array.isArray(element.ancestors);
  const chain = (hasChain ? element.ancestors : []).concat([element]);
  rules.forEach(r => {
    const decl = lastDeclaration(r.body, property);
    if (!decl) return;
    r.selectorText.split(',').forEach(raw => {
      const sel = raw.trim();
      if (!sel) return;
      const parts = parseSelector(sel);
      const entry = {
        sel, value: decl.value, important: decl.important,
        spec: specificity(sel), line: r.line, at: r.at,
      };
      if (!parts) {                       /* sibling combinator: undecidable */
        if (compoundMatches(sel.split(/[+~]/).pop().trim(), element) !== false) conditional.push(entry);
        return;
      }
      if (!hasChain && parts.length > 1) {
        if (compoundMatches(parts[parts.length - 1].compound, element) !== false) conditional.push(entry);
        return;
      }
      const m = chainMatches(parts, chain);
      if (m === false) return;
      if (m === 'conditional' || r.at.length) conditional.push(entry);
      else candidates.push(entry);
    });
  });
  const winner = candidates.slice().sort(compare).pop() || null;
  return { winner, candidates, conditional, unterminatedCommentAt: s.unterminated };
}

module.exports = {
  resolve, specificity, stripComments, parseRules, lastDeclaration,
  parseSelector, chainMatches,
};
