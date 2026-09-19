/* security -- rendering equivalence on the real payload.
 *
 * Part of the combined XSS + OData remediation. This suite FAILS against the
 * vulnerable implementation and PASSES against the remediated one; mut_security.js
 * drives both directions so the pass is never mistaken for a vacuous one.
 */
/* RENDERING REGRESSION -- real payload, not synthetic attack strings.
 *
 * THE QUESTION THIS ANSWERS. The remediation adds escapeHtml to the table body
 * cell path. Does that change ANY table a user actually sees?
 *
 * METHOD. Render every table-year in payload.json twice -- once through the
 * BASELINE renderTable and once through the PATCHED one -- and compare:
 *
 *   1. the emitted HTML, byte for byte;
 *   2. where it differs, the VISIBLE TEXT after parsing, which is what a reader
 *      actually gets. An escaping-only change must leave (2) identical while
 *      changing (1) exactly where a bare &, < or > was previously emitted raw.
 *
 * A difference in (2) is a real regression. A difference in (1) alone is the
 * fix doing its job.
 *
 * Both renderers are extracted from their respective sources with the same
 * auto-resolving reader the other suites use, so neither is a hand-built copy.
 */
'use strict';

/* capture what we print, so the committed output file matches the console */
const _lines = [];
{ const _log = console.log; console.log = function () {
    const s = Array.prototype.join.call(arguments, ' ');
    _lines.push(s); _log.apply(console, arguments); }; }


const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findRepoRoot(start) {
  let d = start;
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(d, 'Coned', 'CLCPA', 'ExecutiveDashboard_dev', 'app.js'))) return d;
    const up = path.dirname(d); if (up === d) break; d = up;
  }
  return null;
}
const REPO = process.env.DAC_REPO || findRepoRoot(__dirname);
if (!REPO) { console.error('ABORT: repo root not found; set DAC_REPO'); process.exit(1); }
/* THE BASELINE IS A PINNED COMMIT, as the house suites do it, not an env var.
 * Requiring DAC_BASE_APP meant a bare run compared the file against itself and
 * reported a vacuous green. BASE is the last commit BEFORE the security change,
 * so what this suite proves is exactly: the escaping moved HTML on the cells
 * that hold a bare ampersand, and moved VISIBLE TEXT on none of the 149.
 *
 * git is a hard dependency here. When it cannot resolve BASE the suite FAILS
 * loudly rather than skipping -- a silent skip is how a regression guard stops
 * guarding without anyone noticing. */
const BASE = process.env.DAC_BASE_COMMIT || '75e8eec';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
let BASE_SRC = null, baseErr = null;
if (process.env.DAC_BASE_APP) {
  BASE_SRC = fs.readFileSync(process.env.DAC_BASE_APP, 'utf8');
} else {
  try {
    BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8')
      .replace(new RegExp('\r?\n', 'g'), '\r\n');
  } catch (e) { baseErr = e.message; }
}
const PATCHED_APP = process.env.DAC_PATCHED ||
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/app.js');
const PAYLOAD = process.env.DAC_PAYLOAD || path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json');
const KIT = process.env.DAC_KIT || path.join(REPO, 'Coned/CLCPA/tickets/_kit/live_page.js');
const { makeDocument } = require(KIT);

function api(src, want) {
  const EOL = src.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const L = src.split(EOL);
  const TOP = [];
  L.forEach((ln, n) => {
    const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (n) => {
    const k = TOP.findIndex(d => d.name === n);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n');
  };
  const parts = [], have = new Set();
  const add = (n) => {
    if (have.has(n)) return false;
    const f = find(n); if (!f) return false;
    have.add(n); parts.push(f); return true;
  };
  want.forEach(add);
  const make = () => new Function(
    'const state={payload:{tables:{}},year:"2025"};' +
    parts.join('\n\n') + '\nreturn {' + want.join(',') + '};')();
  return (fn) => {
    for (let r = 0; r < 800; r++) {
      try { return fn(make()); }
      catch (e) {
        const m = /(\w+) is not defined/.exec(e.message);
        if (m && add(m[1])) continue;
        throw e;
      }
    }
    throw new Error('dependency resolution did not converge');
  };
}

const runBase = BASE_SRC ? api(BASE_SRC, ['renderTable']) : null;
const runPatch = api(fs.readFileSync(PATCHED_APP, 'utf8'), ['renderTable']);
const payload = JSON.parse(fs.readFileSync(PAYLOAD, 'utf8'));

/* MEASUREMENT CORRECTION, and the evidence for it.
 *
 * _kit/live_page.js does not decode HTML entities: its parser stores attribute
 * and text content verbatim and textContent returns it unchanged. Measured:
 *     <td>A &amp; B</td>  -> textContent "A &amp; B"     (a browser: "A & B")
 *
 * Without correcting for that, every cell the patch escapes looks like a text
 * regression. The proof that it is a HARNESS gap and not a patch defect is the
 * HEADER path: it is escaped in BOTH builds, ships that way today, and shows
 * the identical artifact --
 *     <th>A &amp; B</th>  -> textContent "A &amp; B"
 * Asserted as control C1/C2 below so this reasoning cannot be lost.
 *
 * So the comparison decodes entities the way a browser would before comparing
 * visible text. */
const decodeEntities = (s) => String(s)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&amp;/g, '&');           // last, so &amp;lt; -> &lt; not <

const textOf = (html) => {
  const { document } = makeDocument();
  const host = document.createElement('div');
  host.innerHTML = html;
  return decodeEntities(host.textContent);
};

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };

console.log('======================================================================');
console.log('RENDER EQUIVALENCE -- every real table-year in payload.json');
console.log('baseline: ' + (process.env.DAC_BASE_APP ? 'file ' + path.basename(process.env.DAC_BASE_APP) : 'commit ' + BASE));
console.log('patched : ' + path.basename(PATCHED_APP));
console.log('======================================================================');
console.log('');

let rendered = 0, htmlDiff = 0, textDiff = 0;
const diffs = [];
const textDiffs = [];

Object.keys(payload.tables || {}).sort().forEach((tid) => {
  const t = payload.tables[tid];
  Object.keys(t.data || {}).sort().forEach((yr) => {
    const rows = t.data[yr];
    if (!Array.isArray(rows) || !rows.length) return;
    const opts = { tableId: tid };
    if (t.header_levels !== undefined) opts.headerLevels = t.header_levels;
    let a, b;
    try {
      a = runBase((M) => M.renderTable(rows, opts));
      b = runPatch((M) => M.renderTable(rows, opts));
    } catch (e) {
      fail++; console.log('  FAIL ' + tid + ':' + yr + ' threw: ' + e.message);
      return;
    }
    rendered++;
    if (a !== b) {
      htmlDiff++;
      diffs.push(tid + ':' + yr);
      const ta = textOf(a), tb = textOf(b);
      if (ta !== tb) { textDiff++; textDiffs.push({ at: tid + ':' + yr, a: ta, b: tb }); }
    }
  });
});

console.log('  table-years rendered      : ' + rendered);
console.log('  HTML differs              : ' + htmlDiff + '   (expected: only where a bare & < > was emitted)');
console.log('  VISIBLE TEXT differs      : ' + textDiff + '   (expected: 0)');
console.log('');

ok(!baseErr, 'the BASE revision resolved' + (baseErr ? ' -- ' + String(baseErr).slice(0,90) : ' (' + BASE + ')'));
ok(rendered > 100, 'a meaningful number of table-years were rendered (' + rendered + ')');
ok(textDiff === 0, 'NO table-year changes what a reader sees');

if (htmlDiff) {
  console.log('');
  console.log('  table-years whose HTML changed (encoding only):');
  console.log('    ' + diffs.slice(0, 24).join(', ') + (diffs.length > 24 ? ', …+' + (diffs.length - 24) : ''));
}
if (textDiffs.length) {
  console.log('');
  console.log('  *** VISIBLE TEXT REGRESSIONS ***');
  textDiffs.slice(0, 5).forEach(d => {
    console.log('    ' + d.at);
    console.log('      baseline: ' + JSON.stringify(d.a.slice(0, 160)));
    console.log('      patched : ' + JSON.stringify(d.b.slice(0, 160)));
  });
}

/* Controls. C1/C2 record WHY textOf decodes entities; C3/C4 prove the
 * comparison is not vacuous. */
console.log('');
console.log('  controls:');
{
  const { document } = makeDocument();
  const raw = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent; };
  ok(raw('<table><thead><tr><th>A &amp; B</th></tr></thead></table>') === 'A &amp; B',
    'C1 the kit does NOT decode entities -- shown on the HEADER path');
  ok(textOf('<table><thead><tr><th>A &amp; B</th></tr></thead></table>') === 'A & B',
    'C2 ...and decoding restores what a browser would report');

  const rows = [['Program', 'Amount'], ['<b>x</b>', 1]];
  const a = runBase((M) => M.renderTable(rows, { tableId: 'A1' }));
  const b = runPatch((M) => M.renderTable(rows, { tableId: 'A1' }));
  ok(a !== b, 'C3 a cell containing markup DOES render differently between the two');
  ok(textOf(b).indexOf('<b>x</b>') >= 0, 'C4 and the patched build shows it as literal text');
}

console.log('');
console.log('======================================================================');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
console.log('======================================================================');
/* ---- committed run output -------------------------------------------------
 * Written beside the suite, as every other ticket directory does, so a reader
 * can see the result without running anything. DAC_OUT redirects it, which is
 * how the portable harness keeps test output out of the source tree. */
try {
  const _outPath = process.env.DAC_OUT ||
    require('path').join(__dirname, 'render-equivalence-output.txt');
  require('fs').writeFileSync(_outPath, _lines.join('\n') + '\n');
} catch (e) { /* a read-only checkout must not fail the suite */ }

process.exit(fail ? 1 : 0);
