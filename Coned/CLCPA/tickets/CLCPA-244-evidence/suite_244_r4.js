/* CLCPA-244 ROUND 4: the gauge sizing is REVERTED to pre-ticket geometry.
 *
 * Emely's ruling after the round-3 hosted pass: the 3+1 wrap -- System
 * Expansion alone on a second row with the tooltip floating over the gap --
 * reads worse than the original clipping. The narrow-window clipping is
 * ACCEPTED AS-WAS and is no longer this ticket's finding; if it ever matters it
 * gets its own ticket with a design conversation first.
 *
 * So rounds 2 and 3's SIZING code comes out and the strip goes back to four in
 * one row at the original fixed geometry. Round 2's percent-unit discipline
 * STAYS: it is a different piece and this revert does not touch it.
 *
 * WHAT THIS SUITE IS FOR. A revert is the easiest change to get subtly wrong --
 * "mostly restored" looks identical in a diff summary and is not what was
 * ruled. So the claim asserted here is the strong one: the ONLY difference
 * between the shipped app.js and the pre-ticket build is parseNumericInput.
 * Not "the gauges look original", not "the sizing is gone": exactly one
 * function differs, and it is the one that was meant to.
 *
 * PRE-TICKET is dc47788. CLCPA-244 round 1 changed getTableSchema,
 * ingestComputed, renderIngestEditor and isTotalOnlyDerived -- it never touched
 * drawSectionEArc -- so that commit's copy of the strip IS the original, and
 * round 1's own work is preserved by comparing against it rather than against
 * something older.
 *
 * THE RETIRED GUARDS, stated rather than silently dropped. suite_244_r2's
 * geometry half and the whole of suite_244_r3 guarded code that no longer
 * ships. Both are pinned to their own builds and carry a RETIRED banner: they
 * remain the record of what was built and why it was rejected. This suite is
 * what guards the strip now, and what it guards is that nobody changed it.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-244-evidence/suite-244-r4-output.txt');

/* the build Emely rejected, for the "it really is gone" direction */
const BASE = process.env.DAC_BASE_COMMIT || '4f74597';
/* the pre-ticket build the strip must match byte for byte */
const ORIG = process.env.DAC_244_ORIG || 'dc47788';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);

const SRC = fs.readFileSync(APP, 'utf8');
const show = (c) => execSync('git show ' + c + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const BASE_SRC = show(BASE);
const ORIG_SRC = show(ORIG);
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));
const BS = String.fromCharCode(92);

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

/* brace matching, never the dedented-} heuristic: the strip lives at column 0,
 * which is exactly where grab() over-reads by half the file. */
function grabFn(name, src) {
  src = src || SRC;
  const re = new RegExp('(?:^|\\r\\n)([ \\t]*)(?:async )?function ' + name + '\\s*\\(');
  const m = re.exec(src);
  if (!m) return null;
  const start = src.indexOf(m[0]) + (m[0].startsWith('\r\n') ? 2 : 0);
  let i = src.indexOf('{', start);
  if (i < 0) return null;
  let depth = 0;
  for (; i < src.length; i++) {
    const c = src[i], n2 = src[i + 1];
    if (c === '/' && n2 === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 1; continue; }
    if (c === '/' && n2 === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      for (i++; i < src.length; i++) { if (src[i] === BS) { i++; continue; } if (src[i] === q) break; }
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  return null;
}
const fnNames = (src) => [...new Set((src.match(/(?:^|\r\n)[ \t]*(?:async )?function (\w+)\s*\(/g) || [])
  .map(m => /function (\w+)/.exec(m)[1]))];

say('======================================================================');
say('CLCPA-244 ROUND 4 -- the gauge sizing is REVERTED');
say('  pre-ticket ' + ORIG + '   rejected build ' + BASE);
say('======================================================================');

/* =============== O: byte-identical to the original ===================== */
say('');
say('=== O. the strip is the ORIGINAL, byte for byte ======================');
guard('O: drawSectionEArc matches pre-ticket exactly', () => {
  const now = grabFn('drawSectionEArc', SRC);
  const orig = grabFn('drawSectionEArc', ORIG_SRC);
  const rejected = grabFn('drawSectionEArc', BASE_SRC);
  if (!ok(now !== null && orig !== null && rejected !== null,
          'O0 the function exists in all three sources, so comparing means something')) return;
  ok(now === orig, 'O1 BYTE-IDENTICAL to ' + ORIG + ': ' + now.length + ' vs ' + orig.length + ' chars');
  ok(now !== rejected, 'O2 and NOT the rejected build, which is the point of the revert');
  ok(rejected.length > orig.length,
     'O3 the rejected build was longer (' + rejected.length + ' vs ' + orig.length +
     '), so this is a removal, not a rewrite');
});

guard('O: the sizing machinery is GONE, named symbol by symbol', () => {
  const code = codeOnly(SRC), rej = codeOnly(BASE_SRC);
  const GONE = [
    ['rowHeightFor', 'round 3s shared height formula'],
    ['NATURAL_W', 'round 2s width-scale denominator'],
    ['floorK', 'round 3s degenerate-geometry floor'],
    ['availH', 'the card-height measurement'],
    ['colOf(i)', 'row-aware x'],
    ['cyOf(i)', 'row-aware y'],
    ['wireSectionEArcResize', 'round 2s resize redraw'],
    ['_eArcResizeHandler', 'its handler variable'],
    ['TEXT_K', 'round 2s text scale'],
  ];
  /* THE PRESENCE COUNT IS COMPUTED BEFORE ANYTHING IS ASSERTED.
   *
   * A first version asserted "it was present in the rejected build" inside the
   * per-symbol loop, and a mutation control neutered that one call -- leaving
   * "the symbol is absent" passing for symbols that never existed, which is an
   * assertion that cannot fail. Counting first and asserting the total
   * separately means the guard survives losing any single line. */
  const present = GONE.filter(([sym]) => rej.indexOf(sym) >= 0).length;
  ok(present === GONE.length,
     'O4a all ' + GONE.length + ' symbols really WERE in the rejected build (' +
     present + '), so their absence now means something');
  GONE.forEach(([sym, what]) => {
    ok(code.indexOf(sym) < 0, 'O4 ' + sym + ' is gone (' + what + ')');
    ok(rej.indexOf(sym) >= 0, 'O4b and it was present in the rejected build');
  });
});

guard('O: the original geometry is back, literally', () => {
  const code = codeOnly(SRC);
  ok(/const R_OUT = 82, R_IN = 54, SW_OUT = 20, SW_IN = 18;/.test(code),
     'O5 the fixed radii are restored');
  ok(/const GAP = Math\.max\(8, \(CW - TOTAL_ARCS_W\) \/ \(cats\.length \+ 1\)\);/.test(code),
     'O6 and the original gap rule, clamped at 8');
  ok(/ctx\.arc\(cx, CY, r, Math\.PI, endAngle, false\);/.test(code),
     'O7 every arc is back on one shared centre line');
  ok(/const cx = SIDE_PAD \+ i \* SPACING;/.test(code),
     'O8 x comes from the index again, so there is one row');
  ok(/const hit = hitZones\.find\(z => Math\.abs\(mx - z\.cx\) < SPACING\/2\);/.test(code),
     'O9 and the hit test is x-only again, which is correct for one row');
  ok(/if \(letter === 'E'\) drawSectionEArc\(\);/.test(code),
     'O10 the call site no longer wires a resize handler');
});

/* =============== U: the percent rule SURVIVES ========================== */
say('');
say('=== U. round 2s percent-unit discipline is untouched by the revert ===');
guard('U: parseNumericInput still treats % as a unit', () => {
  const fn = grabFn('parseNumericInput');
  if (!ok(fn !== null, 'U0 parseNumericInput was found')) return;
  const api = new Function(fn + '\nreturn parseNumericInput;')();
  ok(api('10%') === 0.1, 'U1 "10%" still lands 0.1');
  ok(api('0.1') === 0.1, 'U2 "0.1" still lands 0.1');
  ok(api('10') === 10, 'U3 "10" is still untouched: no magnitude guessing');
  ok(api('up 10% YoY') === 'up 10% YoY', 'U4 and prose still falls through as text');
  ok(grabFn('parseNumericInput') === grabFn('parseNumericInput', BASE_SRC),
     'U5 byte-identical to the rejected build: the revert did not reach it');
  ok(grabFn('parseNumericInput') !== grabFn('parseNumericInput', ORIG_SRC),
     'U6 and it is NOT the pre-ticket version, which is the whole point of keeping it');
});

/* =============== E: the strong claim =================================== */
say('');
say('=== E. EXACTLY ONE function differs from pre-ticket ==================');
guard('E: the revert is complete, not merely mostly complete', () => {
  const names = fnNames(SRC);
  const changed = names.filter(n => grabFn(n, SRC) !== grabFn(n, ORIG_SRC));
  say('       differing from ' + ORIG + ': ' + changed.sort().join(', '));
  ok(changed.length === 1 && changed[0] === 'parseNumericInput',
     'E1 exactly ONE function differs from pre-ticket, and it is parseNumericInput: ' +
     changed.join(', '));
  const origNames = fnNames(ORIG_SRC);
  const added = names.filter(n => origNames.indexOf(n) < 0);
  const removed = origNames.filter(n => names.indexOf(n) < 0);
  ok(added.length === 0, 'E2 no function was added since pre-ticket' +
     (added.length ? ': ' + added.join(', ') : ''));
  ok(removed.length === 0, 'E3 and none was lost' +
     (removed.length ? ': ' + removed.join(', ') : ''));
  /* round 1's work must still be there: reverting the SIZING must not have
   * reverted the ticket's first half by reaching too far back */
  ['getTableSchema', 'ingestComputed', 'isTotalOnlyDerived', 'renderIngestEditor']
    .forEach(n => ok(grabFn(n, SRC) === grabFn(n, ORIG_SRC),
      'E4 round 1s ' + n + ' is intact (unchanged from ' + ORIG + ', which contains it)'));
  ok(/return !!d && d\.type === 'weightedMean';/.test(codeOnly(SRC)),
     'E5 and isTotalOnlyDerived still keys on the rule type');
});

/* =============== S: nothing else moved ================================= */
say('');
say('=== S. the data layer is untouched ===================================');
guard('S: styles.css and the payload readers are unchanged', () => {
  const styles = fs.readFileSync(path.join(REPO,
    'Coned/CLCPA/ExecutiveDashboard_dev/styles.css'), 'utf8');
  const origStyles = execSync('git show ' + ORIG +
    ':"Coned/CLCPA/ExecutiveDashboard_dev/styles.css"',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
  ok(styles === origStyles, 'S1 styles.css is byte-identical to pre-ticket');
  ok(P.tables.E1.data['2025'].length === 5, 'S2 the payload is untouched: E1 still has 5 rows');
});

guard('S: the readers Emely ruled out are still ruled out', () => {
  const code = codeOnly(SRC);
  ok(code.indexOf("(secDacPct * 100).toFixed(1) + '%'") >= 0,
     'S3 the section header still multiplies unconditionally');
  ok(/const pctNum = has \? pct \* 100 : 0;/.test(code),
     'S4 and so does the section-goals gauge row');
});

/* =============== B: the baselines ====================================== */
say('');
say('=== B. the pins =====================================================');
guard('B: both reference commits are literal and real', () => {
  [[ORIG, 'pre-ticket'], [BASE, 'rejected build']].forEach(([c, what]) => {
    ok(/^[0-9a-f]{7,40}$/.test(c), 'B1 ' + what + ' is a literal sha: ' + c);
    let anc = false;
    try { execSync('git merge-base --is-ancestor ' + c + ' HEAD', { cwd: REPO }); anc = true; }
    catch (e) { anc = false; }
    ok(anc, 'B2 ' + what + ' ' + c + ' is an ancestor of HEAD');
  });
  ok(ORIG !== BASE, 'B3 and they are different commits, so the comparison has two sides');
});

lines.forEach(l => console.log(l));
console.log('');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n\n  ' + pass + ' passed, ' + fail + ' failed\n');
process.exitCode = fail ? 1 : 0;
