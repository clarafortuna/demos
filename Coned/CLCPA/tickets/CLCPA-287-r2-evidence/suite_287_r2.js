/* CLCPA-287 round 2: the dialog dismisses either way, and a rejection names a
 * column the operator can find.
 *
 * THE GESTURE, reproduced in a real browser against a served build BEFORE any
 * code was written (repro-287r2-output.txt, committed beside this):
 *
 *   Report Data -> A9 -> 2025 -> Add Data -> stage a CSV whose headings A9
 *   does not have -> Load Data
 *
 *     dialog still open : true                     <-- half 1, the defect
 *     #dlg-error        : The file has no "" column, which is the one that
 *                         says which row each value belongs to.
 *                                                  <-- half 2, the defect
 *     an ACCEPTED load on the same dialog: closes
 *
 * HALF 1. CLCPA-262 deliberately kept the dialog open on a rejection, and its
 * reason was sound then: closing put the reason on a page that said nothing.
 * Round 1 of this ticket removed that premise by drawing the report. The owner
 * ruled in round 2 that dismissal is now one rule for both outcomes, so the
 * failure path falls through to the same close(). What does NOT survive 262 is
 * its second reason, that the file input goes with the dialog: it does, and a
 * retry means reopening Add Data. Recorded, not hidden.
 *
 * HALF 2. The two key-column rejections interpolated schema[s] straight, and
 * SIX published table-years have no heading in a key column: A9 and A10 carry
 * "" (and their SECOND heading row is null there too, so no name exists to
 * recover anywhere), F7 carries null, which rendered as the word "null".
 * A column that has a heading keeps its wording TO THE BYTE; only the
 * unheaded branch is new.
 *
 * Pins: DAC_BASE_COMMIT, DAC_APP_OVERRIDE.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const BASE = process.env.DAC_BASE_COMMIT || '8551769';

const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const PAYLOAD = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => { try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); } };
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

function grabFn(name, src) {
  const a = '\r\n  function ' + name + '(';
  const i = src.indexOf(a);
  if (i < 0) return null;
  let j = src.indexOf('{', i), d = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) { j = k; break; } }
  }
  return src.slice(i + 2, j + 1);
}
function grabConst(name, src) {
  const m = new RegExp('\\r\\n  (?:const|var|let) ' + name + '\\s*=').exec(src);
  if (!m) return null;
  let i = m.index + 2, j = i;
  let d = 0, started = false;
  for (let k = i; k < src.length; k++) {
    const c = src[k];
    if (c === '{' || c === '[') { d++; started = true; }
    else if (c === '}' || c === ']') { d--; }
    else if (c === ';' && (!started || d === 0)) { j = k; break; }
  }
  return src.slice(i, j + 1);
}

/* One assembled environment per source, resolving dependencies by FOLLOWING
 * ReferenceErrors at construct time AND at call time. A hand-fed list cannot
 * see a missing closure; this can, and it fails loudly rather than answering
 * from a stale slice. */
const ENTRY = ['buildIngestImport'];
function buildEnv(src, tag) {
  const fns = ENTRY.slice();
  const consts = [];
  for (let iter = 0; iter < 400; iter++) {
    const body = '"use strict";\n' +
      'const state = { payload: PAYLOAD,' +
      ' seedYears: ((PAYLOAD.meta && PAYLOAD.meta.years) || []).map(String) };\n' +
      'const console = { warn: () => {}, info: () => {}, log: () => {}, error: () => {} };\n' +
      'const document = { getElementById: () => null, querySelectorAll: () => [],' +
      ' querySelector: () => null };\n' +
      consts.map(n => grabConst(n, src)).join('\n') + '\n' +
      fns.map(n => grabFn(n, src)).join('\n') + '\n' +
      'return { buildIngestImport: buildIngestImport, __fns: ' + JSON.stringify(fns) + '};';
    let cand;
    try {
      cand = new Function('PAYLOAD', body)(PAYLOAD);
    } catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) throw new Error(tag + ' shell: ' + e.message);
      if (grabFn(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm, src) && consts.indexOf(nm) < 0) { consts.push(nm); continue; }
      throw new Error(tag + ' cannot resolve ' + nm);
    }
    try {
      const sch = PAYLOAD.tables.A1.schema_by_year['2025'];
      cand.buildIngestImport([sch, ['x', 1, 1, null]], sch, [], 'A1');
      /* A TWO-LEVEL TABLE TOO, and the omission was not harmless: a
       * single-level warm-up never reaches ingestYearCarriesHeaderRows, so the
       * resolver never learns it, and the suite threw from inside C and D
       * rather than answering. A9 declares header_levels 2. */
      const s9 = PAYLOAD.tables.A9.schema_by_year['2025'];
      cand.buildIngestImport([s9, s9.map((_, i) => 'sub' + i), s9.map((_, i) => (i ? 1 : 'r'))],
        s9, [], 'A9');
      /* and a REJECTING call, since the rejection branch is the one under
       * test and it reaches code the accepting branch does not */
      cand.buildIngestImport([s9.map((_, i) => 'Zz ' + i), s9.map((_, i) => 'Zs' + i),
        s9.map((_, i) => (i ? 1 : 'r'))], s9, [], 'A9');
      return cand;
    } catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) throw new Error(tag + ' call: ' + e.message);
      if (grabFn(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm, src) && consts.indexOf(nm) < 0) { consts.push(nm); continue; }
      throw new Error(tag + ' cannot resolve ' + nm + ' (call time)');
    }
  }
  throw new Error(tag + ': no convergence');
}

/* the REAL rejection text for a table whose file has none of its headings */
function whyRejected(api, tableId, year) {
  const sch = PAYLOAD.tables[tableId].schema_by_year[year];
  const levels = PAYLOAD.tables[tableId].header_levels === 2 ? 2 : 1;
  const bogus = sch.map((_, i) => 'Zz Heading ' + i);
  const rows = [bogus];
  if (levels === 2) rows.push(sch.map((_, i) => 'Zz Sub ' + i));
  rows.push(sch.map((_, i) => (i ? 1 : 'Zz Row')));
  const res = api.buildIngestImport(rows, sch, [], tableId);
  return ((res.rejections || []).map(x => x.why).filter(Boolean)[0]) || '';
}

log('='.repeat(70));
log('CLCPA-287 round 2 -- the dialog dismisses either way, and a rejection');
log('                     names a column the operator can find');
log('  BASE : ' + BASE + ' (predates this change)');
log('='.repeat(70));

const NEW = buildEnv(SRC, 'NEW');
const OLD = buildEnv(BASE_SRC, 'BASE');

log('');
log('A. THE BASELINE CARRIES BOTH DEFECTS');
guard('A-block', () => {
  ok(NEW.__fns.length > 1 && OLD.__fns.length > 1,
    'A0 both sources assemble, resolving ' + NEW.__fns.length + ' / ' +
    OLD.__fns.length + ' functions by following ReferenceErrors');
  const oldPath = codeOnly(grabFn('openAddYearDialog', BASE_SRC));
  ok(/refreshIngestNotices\(\);\s*\r?\n\s*return;/.test(oldPath),
    'A1 BASE: the failure path RETURNS, so the dialog survives a rejection');
  const why = whyRejected(OLD, 'A9', '2025');
  ok(/“”/.test(why),
    'A2 BASE: A9 is told the file has no "" column  ->  ' + JSON.stringify(why.slice(0, 48)));
  const whyF7 = whyRejected(OLD, 'F7', '2025');
  ok(/“null”/.test(whyF7),
    'A3 BASE: and F7 is told the word "null"  ->  ' + JSON.stringify(whyF7.slice(0, 44)));
});

log('');
log('B. THE DIALOG DISMISSES THE SAME WAY, EITHER WAY');
guard('B-block', () => {
  const now = codeOnly(grabFn('openAddYearDialog', SRC));
  ok(!/refreshIngestNotices\(\);\s*\r?\n\s*return;/.test(now),
    'B1 the early return is gone from the failure path');
  ok(/refreshIngestNotices\(\);\s*\r?\n\s*\}\s*\r?\n\s*close\(\);/.test(now),
    'B2 the path repaints the report and falls through to the same close()');
  /* ONE dismissal, not two that might drift. */
  ok((now.match(/\n\s*close\(\);/g) || []).length === 1,
    'B3 and there is exactly ONE close() in the handler, so the two outcomes cannot drift apart');
  /* the dialog error line painted an element destroyed microseconds later */
  ok(!/err\.textContent = why;/.test(now),
    'B4 the unreachable dialog error painting is gone');
  /* but #dlg-error still serves the paths that DO hold the dialog open */
  ok(/#dlg-error/.test(now) && /err\.textContent = v\.error;/.test(now),
    'B5 while year validation still writes it and still holds the dialog open');
});

log('');
log('C. A REJECTION NAMES A COLUMN THE OPERATOR CAN FIND');
guard('C-block', () => {
  const a9 = whyRejected(NEW, 'A9', '2025');
  ok(!/“”/.test(a9), 'C1 A9 is no longer told about a "" column');
  ok(/first column/.test(a9) && /unheaded in this table/.test(a9),
    'C2 it is described by position and role  ->  ' + JSON.stringify(a9.slice(0, 56)));
  const f7 = whyRejected(NEW, 'F7', '2025');
  ok(!/“null”/.test(f7) && /first column/.test(f7),
    'C3 and F7 is never told the word "null"');
  /* THE NAMED BRANCH DOES NOT MOVE. A1 has a real heading on its key column,
   * and its message must be what it was on BASE, to the byte. */
  const a1new = whyRejected(NEW, 'A1', '2025');
  const a1old = whyRejected(OLD, 'A1', '2025');
  ok(a1new === a1old && a1new.length > 0,
    'C4 a NAMED key column keeps its message byte-for-byte: ' + JSON.stringify(a1new.slice(0, 40)));
  ok(/“Program Name” column/.test(a1new),
    'C5 (and it still names the heading it wants)');
});

log('');
log('D. EVERY TABLE, NOT THE THREE THAT WERE LOOKED AT');
guard('D-block', () => {
  let checked = 0; const empties = []; const nulls = [];
  Object.keys(PAYLOAD.tables).forEach((id) => {
    Object.keys(PAYLOAD.tables[id].schema_by_year || {}).forEach((y) => {
      const sch = PAYLOAD.tables[id].schema_by_year[y];
      if (!sch || !sch.length) return;
      let why;
      try { why = whyRejected(NEW, id, y); } catch (e) { return; }
      if (!why) return;
      checked++;
      if (/“”/.test(why)) empties.push(id + ':' + y);
      if (/“null”|“undefined”/.test(why)) nulls.push(id + ':' + y);
    });
  });
  ok(checked >= 100, 'D1 measured over ' + checked + ' published table-years');
  ok(empties.length === 0,
    'D2 not one rejection anywhere names an EMPTY heading' +
    (empties.length ? ': ' + empties.slice(0, 5).join(', ') : ''));
  ok(nulls.length === 0,
    'D3 nor the words null or undefined' + (nulls.length ? ': ' + nulls.slice(0, 5).join(', ') : ''));
  /* and the baseline really did, on six of them */
  let oldBad = 0;
  ['A9', 'A10', 'F7'].forEach((id) => {
    Object.keys(PAYLOAD.tables[id].schema_by_year || {}).forEach((y) => {
      let w = ''; try { w = whyRejected(OLD, id, y); } catch (e) { return; }
      if (/“”|“null”/.test(w)) oldBad++;
    });
  });
  ok(oldBad === 6, 'D4 and BASE named an unusable heading on exactly 6 table-years (' + oldBad + ')');
});

log('');
log('X. THE CHANGE IS WHERE IT SAYS IT IS');
guard('X-block', () => {
  const code = codeOnly(SRC);
  ok(/function ingestKeyColDescription\(schema, s\) \{/.test(code),
    'X1 one helper describes a key column');
  ok(/const INGEST_COL_ORDINALS = /.test(code), 'X2 with the ordinals named once');
  /* both messages go through it: a second raw interpolation would be a second
   * source of this bug, and the first one shipped for months. */
  ok(!/no “' \+ schema\[0\] \+ '” column/.test(code) &&
     !/no “' \+ schema\[s\] \+ '” column/.test(code),
    'X3 and neither rejection interpolates a raw schema entry any more');
  /* the DEFINITION also reads "ingestKeyColDescription(schema, s)", so it is
   * excluded by name rather than by counting it in and calling that the total */
  ok((code.match(/(?<!function )ingestKeyColDescription\(schema, /g) || []).length === 3,
    'X4 both key-column rejections call it, at 3 call sites');
  ok(codeOnly(BASE_SRC).indexOf('ingestKeyColDescription') < 0,
    'X5 (the baseline carries none of this)');
});

log('');
log('='.repeat(70));
log('  ' + pass + ' passed, ' + fail + ' failed');
log('='.repeat(70));
fs.writeFileSync(path.join(__dirname, 'suite-287-r2-output.txt'), lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
