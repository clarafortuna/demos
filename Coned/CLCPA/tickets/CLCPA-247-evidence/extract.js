/* Pull a named function out of app.js BY BRACE MATCHING, not by indentation.
 *
 * AN INDENTATION ANCHOR CANNOT READ THIS FILE. Seven of the eleven wiring
 * functions this ticket touches are declared at COLUMN 0 inside the IIFE while
 * their bodies are indented four spaces and they close on `  }` at two. The
 * usual `'\r\n' + pad + '}'` close therefore never matches for them and the
 * scan runs on to the next dedented brace far below -- which is not a
 * theoretical risk: the first cut of suite_247 reported wireQuadrantTooltip as
 * containing TEN calls to the shared positioner when it contains one, and
 * reported eight renderSection* functions as changed when none was touched.
 * Every number it produced about those functions described a block half the
 * file long, and it looked exactly like success.
 *
 * So the block is found by counting braces from the function's own `{`,
 * skipping comments, strings and template literals -- including the `${ }`
 * expressions inside them, which is why a naive counter will not do: these
 * bodies are almost entirely template literals.
 *
 * Shared by suite_247 and gate_247 so there is ONE extractor, and suite_247's
 * block 0 self-tests it on both builds: every block must parse, and no block
 * may contain a sibling's head.
 */
const CRLF = String.fromCharCode(13) + String.fromCharCode(10);

function grab(name, src) {
  let i = -1;
  for (const pad of [CRLF + '    ', CRLF + '  ', CRLF]) {
    for (const kw of ['function ', 'async function ']) {
      const head = pad + kw + name + '(';
      const at = src.indexOf(head);
      if (at >= 0 && (i < 0 || at < i)) i = at + 2;
    }
  }
  if (i < 0) return null;
  const open = src.indexOf('{', src.indexOf('(', i));
  if (open < 0) return null;
  let depth = 0;
  const tpl = [];
  for (let k = open; k < src.length; k++) {
    const c = src[k], d = src[k + 1];
    if (!tpl.length) {
      if (c === '/' && d === '*') { k = src.indexOf('*/', k + 2) + 1; continue; }
      if (c === '/' && d === '/') { k = src.indexOf('\n', k); if (k < 0) break; continue; }
      if (c === '"' || c === "'") {
        const q = c;
        for (k++; k < src.length; k++) {
          if (src[k] === '\\') { k++; continue; }
          if (src[k] === q) break;
        }
        continue;
      }
      if (c === '`') { tpl.push(depth); continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) return src.slice(i, k + 1); }
    } else {
      if (c === '\\') { k++; continue; }
      if (c === '`') { tpl.pop(); continue; }
      if (c === '$' && d === '{') { tpl.push(-1); k++; continue; }
      if (tpl[tpl.length - 1] === -1 && c === '}') { tpl.pop(); continue; }
    }
  }
  return null;
}

/** every function declared at a line start, in source order, with its block */
function functionsIn(src) {
  const out = [];
  const re = /\r\n(?: {2}| {4})?(?:async )?function (\w+)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const body = grab(m[1], src);
    if (body) out.push({ name: m[1], body });
  }
  return out;
}

module.exports = { grab, functionsIn, CRLF };
