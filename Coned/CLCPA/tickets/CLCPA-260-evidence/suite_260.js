/* GROUP D of the Section C fix package: CLCPA-260, the phantom spacer columns.
 *
 * C1's schema is 3 columns in 2023 and 6 from 2024; C2-C5 go 4 to 8. The extra
 * columns are UNNAMED and hold nothing in any stored year. They render as
 * blank, unlabelled, apparently-fillable cells in the editor and as blank
 * columns in the template, and a preparer cannot tell them from a cell they
 * are meant to fill. Ruled: they do not render and they are not emitted --
 * C1 shows 3, C2-C5 show 4.
 *
 * THE PREDICATE IS THREE CONDITIONS, all three load-bearing:
 *   1. the header is blank
 *   2. no stored year of the same schema WIDTH has data in the column
 *   3. the table is not two-level
 *
 * Condition 2 is what stops this erasing real data: 50 blank-headed columns
 * exist dashboard-wide and TWELVE carry values -- A9/A10/F7's label column and
 * F6's detail columns, up to 25 values each. Condition 3 keeps the two-level
 * families out, where a blank header is structure rather than a spacer.
 *
 * PER YEAR, and that is not a detail. My first cut asked whether a column was
 * blank in EVERY year, which read 2023's "Category" at index 1 as a reason to
 * keep 2025's spacer at index 1, and left C1 six columns wide. Schemas of
 * different widths make the same index a different column, so indexes are only
 * comparable within a width. Self-caught before it shipped; pinned below.
 *
 * THE STORED SCHEMA IS NOT TOUCHED. This filters what is rendered and what is
 * emitted. data[] rows keep every column, data-col carries the real index, and
 * a save writes the shape it read.
 *
 * THE EMIT HALF STAYS IN THIS PACKAGE, after the audit Emely ruled for. The
 * round-trip discrepancy the sweep caught was the HARNESS: suite_240a's
 * fillLikeOperator filled a template by POSITION while the importer reads by
 * HEADING, and the two agreed only while the template emitted every stored
 * column. Measured on C2:2025, filling by position put "37,988 (33%)" -- the
 * Participants figure -- under "Average Event Reductions (MW)". The app round
 * trip, driven directly on a wide file and a narrow one, is identical: that is
 * section R below.
 *
 * BASE is 0076083 (Group C's head). This branch stacks on it.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-260-evidence/suite-260-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || '0076083';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);
const SRC = fs.readFileSync(APP, 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
const say = (m) => lines.push(m);
function guard(label, fn) {
  try { fn(); } catch (e) { fail++; lines.push('  FAIL ' + label + ' THREW: ' + (e && e.message)); }
}
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

function harness(src) {
  const LINES = src.split('\r\n');
  const TOP = [];
  LINES.forEach((ln, n) => {
    const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([LINES.length]);
  const find = (nm) => {
    const k = TOP.findIndex(d => d.name === nm);
    return k < 0 ? null : LINES.slice(TOP[k].line, bound[k + 1]).join('\n');
  };
  const parts = []; const have = new Set();
  const add = (n) => { if (have.has(n)) return false; const f = find(n); if (!f) return false;
    have.add(n); parts.push(f); return true; };
  const want = ['phantomSpacerCols', 'getTableSchema', 'buildIngestImport',
                'renderSourceTables', 'ingestComputed', 'normIngestKey'];
  want.forEach(add);
  let api = null;
  const attempt = (call) => {
    for (let r = 0; r < 400; r++) {
      try {
        if (!api) api = new Function('PAYLOAD', parts.join('\n\n') +
          '\n;if (typeof state !== "undefined") state.payload = PAYLOAD;' +
          '\n;return {' + want.filter(n => have.has(n)).join(',') +
          ', __has: function (n) { return have_.indexOf(n) >= 0; } };'
            .replace('have_', JSON.stringify(Array.from(have))))(P);
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

say('======================================================================');
say('Section C group D -- CLCPA-260, the phantom spacer columns');
say('  BASE ' + BASE + '   (stacked on Group C)');
say('======================================================================');

/* =================== T: the predicate =============================== */
say('');
say('=== T. the three conditions, and the ruled widths ==================');
const spacers = (t, y) => NEW.attempt(api => api.phantomSpacerCols(t, y));

guard('T: the ruled widths, exactly', () => {
  const WANT = { C1: 3, C2: 4, C3: 4, C4: 4, C5: 4 };
  Object.keys(WANT).forEach(id => {
    const t = P.tables[id];
    const s = t.schema_by_year['2025'];
    const hide = spacers(t, '2025');
    ok(s.length - hide.length === WANT[id],
       'T1 ' + id + ':2025  ' + s.length + ' stored -> ' + (s.length - hide.length) +
       ' visible (ruled ' + WANT[id] + '), hiding [' + hide + ']');
  });
});

guard('T: 2023 was already narrow and is untouched', () => {
  ['C1', 'C2', 'C3', 'C4', 'C5'].forEach(id => {
    const t = P.tables[id];
    ok(spacers(t, '2023').length === 0,
       'T2 ' + id + ':2023 hides nothing: its schema names every column');
  });
});

guard('T: condition 2 -- the twelve data-carrying blanks are UNTOUCHED', () => {
  /* the exact set the audit measured */
  const CARRIERS = [['A9', 0], ['A10', 0], ['F7', 0], ['F6', 3], ['F6', 5]];
  CARRIERS.forEach(([id, col]) => {
    const t = P.tables[id];
    const years = Object.keys(t.data || {});
    const hidden = years.some(y => spacers(t, y).indexOf(col) >= 0);
    ok(!hidden, 'T3 ' + id + ' col' + col + ' is never hidden, in any year');
  });
  /* and prove they really do carry values, or T3 is vacuous */
  let carried = 0;
  CARRIERS.forEach(([id, col]) => {
    const t = P.tables[id];
    Object.keys(t.data || {}).forEach(y => {
      (t.data[y] || []).forEach(r => {
        const v = (r || [])[col];
        if (v != null && String(v).trim() !== '') carried++;
      });
    });
  });
  ok(carried > 50, 'T3b and between them they hold ' + carried + ' real values');
});

guard('T: conditions 2 and 3 on SYNTHETIC tables, because the payload cannot', () => {
  /* MEASURED AND STATED: on this payload, conditions 2 and 3 are defence in
   * depth rather than load-bearing. No single-level table has a blank-headed
   * column past index 0 that holds data, and the two-level families have no
   * blank-headed column past index 0 at all -- A9's is index 0, which the
   * loop never considers. So removing either condition changes nothing here,
   * and the mutation controls aimed at them went GREEN until this guard
   * existed. A condition whose guard cannot fail is a comment.
   *
   * These tables are built in the real shape, in this suite, so each
   * condition has something that can break it. */
  const carrier = {
    id: 'ZZ1', header_levels: 1,
    schema_by_year: { 2096: ['Label', null, 'Named', null] },
    data: { 2096: [
      ['row one', 'kept', 1, null],       /* col1 blank-headed but CARRIES data */
      ['row two', null, 2, null],
    ] },
  };
  const h2 = spacers(carrier, '2096');
  ok(h2.indexOf(1) < 0,
     'T3c condition 2: a blank-headed column holding "kept" is NOT hidden');
  ok(h2.indexOf(3) >= 0,
     'T3d while its empty neighbour at index 3 IS: [' + h2 + ']');

  /* condition 2 across YEARS of the same width: the value lives in 2095 and
   * the column is empty in 2096, so a predicate that asked only about the
   * year on screen would hide a column that is live in the other. */
  const twoYear = {
    id: 'ZZ3', header_levels: 1,
    schema_by_year: { 2095: ['Label', null, 'Named'], 2096: ['Label', null, 'Named'] },
    data: { 2095: [['a', 'live', 1]], 2096: [['b', null, 2]] },
  };
  ok(spacers(twoYear, '2096').indexOf(1) < 0,
     'T3e condition 2 spans the WIDTH, not the year: col1 is empty in 2096 ' +
     'but holds "live" in 2095, so it is not hidden');
  ok(spacers(twoYear, '2095').indexOf(1) < 0,
     'T3f and the same answer viewing 2095');

  /* THE LABEL COLUMN IS NEVER A CANDIDATE. No stored single-level table has a
   * blank label header, so only a synthetic table can prove the loop starts
   * at 1 rather than 0. */
  const blankLabel = {
    id: 'ZZ4', header_levels: 1,
    schema_by_year: { 2096: [null, 'Named'] },
    data: { 2096: [[null, 1], [null, 2]] },
  };
  ok(spacers(blankLabel, '2096').indexOf(0) < 0,
     'T3g the label column is never hidden, even when its header is blank ' +
     'and every cell is empty: [' + spacers(blankLabel, '2096') + ']');

  const twoLevel = {
    id: 'ZZ2', header_levels: 2,
    schema_by_year: { 2096: ['Label', null, null, 'Named'] },
    data: { 2096: [['Total', null, null, 'DAC'], ['row', null, null, 1]] },
  };
  ok(spacers(twoLevel, '2096').length === 0,
     'T4c condition 3: the same shape marked two-level hides nothing');
  const oneLevel = Object.assign({}, twoLevel, { header_levels: 1 });
  ok(spacers(oneLevel, '2096').length === 2,
     'T4d and marked single-level it hides both blanks: [' +
     spacers(oneLevel, '2096') + '] -- so condition 3 is what makes the ' +
     'difference, not an accident of the data');
});

guard('T: condition 3 -- the two-level families are excluded outright', () => {
  ['A9', 'A10', 'F6'].forEach(id => {
    const t = P.tables[id];
    ok(t.header_levels === 2, 'T4 ' + id + ' is two-level');
    const any = Object.keys(t.data || {}).reduce((n, y) => n + spacers(t, y).length, 0);
    ok(any === 0, 'T4b and hides nothing: ' + any);
  });
});

guard('T: PER YEAR, which is the bug I caught before it shipped', () => {
  /* C1's 2023 schema names index 1 "Category"; its 2025 schema leaves index 1
   * blank. A predicate that asked "blank in every year" would keep index 1
   * and leave C1 six columns wide. */
  ok(String(P.tables.C1.schema_by_year['2023'][1]).trim() === 'Category',
     'T5 C1:2023 index 1 is "Category"');
  ok(String(P.tables.C1.schema_by_year['2025'][1] == null ? '' :
     P.tables.C1.schema_by_year['2025'][1]).trim() === '',
     'T5b while C1:2025 index 1 is blank');
  ok(spacers(P.tables.C1, '2025').indexOf(1) >= 0,
     'T5c and index 1 IS hidden in 2025, which a cross-year predicate would ' +
     'have refused');
  const src = codeOnly(SRC);
  ok(/const sameWidth = Object\.keys\(by\)\.filter\(y =>/.test(src),
     'T6 the source compares only years of the SAME schema width');
});

guard('T: dashboard-wide, nothing outside the C family moves', () => {
  const hit = {};
  Object.keys(P.tables).forEach(id => {
    Object.keys(P.tables[id].data || {}).forEach(y => {
      const n = spacers(P.tables[id], y).length;
      if (n) hit[id] = (hit[id] || 0) + n;
    });
  });
  ok(Object.keys(hit).sort().join(',') === 'C1,C2,C3,C4,C5',
     'T7 the tables with phantom spacers are exactly C1-C5: ' +
     Object.keys(hit).sort().join(','));
  const total = Object.keys(hit).reduce((n, k) => n + hit[k], 0);
  ok(total === 38, 'T8 and 38 table-year columns in all: ' + total);
  ok(OLD.attempt(api => typeof api.phantomSpacerCols) === 'undefined',
     'T9 BASE had no such predicate at all');
});

/* =================== R: THE ROUND TRIP, driven ====================== */
say('');
say('=== R. the app round trip, wide file and narrow file ================');
guard('R: the importer reads by HEADING, so a narrower file lands the same', () => {
  const ID = 'C2', YR = '2025';
  const schema = P.tables[ID].schema_by_year[YR];
  const stored = P.tables[ID].data[YR];
  const hide = spacers(P.tables[ID], YR);
  const wideHeader = schema.slice();
  const wideBody = stored.map(r => schema.map((h, c) => (r[c] == null ? '' : r[c])));
  const narrowHeader = schema.filter((_, i) => hide.indexOf(i) < 0);
  const narrowBody = stored.map(r =>
    schema.map((h, c) => (r[c] == null ? '' : r[c])).filter((_, i) => hide.indexOf(i) < 0));
  const plan = (header, body) => NEW.attempt(api =>
    api.buildIngestImport([header].concat(body), schema,
      JSON.parse(JSON.stringify(stored)), ID));
  /* THE TWO FILES MUST ACTUALLY DIFFER, or R4 compares a file with itself and
   * passes for nothing. The first version of this guard had no such check and
   * a control that stopped narrowing went green. */
  ok(wideHeader.length === 8 && narrowHeader.length === 4,
     'R0 the wide file has 8 headings and the narrow one 4: ' +
     wideHeader.length + ' vs ' + narrowHeader.length);
  const w = plan(wideHeader, wideBody), n = plan(narrowHeader, narrowBody);
  ok(w.ok && n.ok, 'R1 both files import cleanly');
  ok(JSON.stringify(w.matchedColumns) === JSON.stringify(n.matchedColumns),
     'R2 the same columns match: ' + JSON.stringify(n.matchedColumns));
  ok(w.populated.length === n.populated.length && n.populated.length === 9,
     'R3 and the same 9 values are populated: ' + n.populated.length);
  ok(JSON.stringify(w.candidate) === JSON.stringify(n.candidate),
     'R4 the resulting candidate rows are IDENTICAL, wide or narrow');
  /* and both return the stored table unchanged, so R4 is not two wrongs */
  ok(JSON.stringify(n.candidate) === JSON.stringify(stored),
     'R5 and equal to the stored rows, so the round trip is a true identity');
  /* THE HARNESS DEFECT, recorded as a positive fact about the app */
  const byName = /const sIdx = schemaNorm\.indexOf\(h\);/.test(codeOnly(SRC));
  ok(byName, 'R6 buildIngestImport maps a column by NAME, not by position, ' +
     'which is why the narrowing is safe');
});

/* =================== E: the emit half =============================== */
say('');
say('=== E. the template stops emitting them ============================');
guard('E: the emitter filters, and only there', () => {
  const src = codeOnly(SRC);
  ok(/const hidden = phantomSpacerCols\(table, year\);/.test(src),
     'E1 the workbook asks the predicate');
  ok(/const visible = \(arr\) => arr\.filter\(\(_, i\) => hidden\.indexOf\(i\) < 0\);/.test(src),
     'E2 with one filter used for header, body and widths');
  ok(/const rows = \[visible\(schema\)\.map/.test(src), 'E3 the heading row is filtered');
  ok(/rows\.push\(visible\(schema\.map\(\(h, c\) => \{/.test(src),
     'E4 the body maps over the FULL schema then filters, so c stays the REAL ' +
     'column index');
  ok(/const widths = visible\(schema\)\.map/.test(src), 'E5 and so are the widths');
  ok(!/const rows = \[schema\.map\(h => \(\{ style: XLSX_STYLE_HEADER/.test(src),
     'E6 the unfiltered heading row is gone');
  ok(/const rows = \[schema\.map\(h => \(\{ style: XLSX_STYLE_HEADER/.test(codeOnly(BASE_SRC)),
     'E6b and it was there at BASE');
});

guard('E: the editor filters, with the real index preserved', () => {
  const src = codeOnly(SRC);
  ok(/const hiddenCols = phantomSpacerCols\(/.test(src),
     'E7 the editor asks the predicate once per render');
  ok(/hiddenCols\.indexOf\(idx\) >= 0 \? '' :/.test(src),
     'E8 the heading cells skip a hidden column');
  ok(/if \(hiddenCols\.indexOf\(colIdx\) >= 0\) return '';/.test(src),
     'E9 and so do the body cells');
  ok(/data-col="\$\{colIdx\}"/.test(SRC) || /data-col="\$\{c\}"/.test(SRC),
     'E10 while data-col still carries the REAL index, so editing, importing ' +
     'and saving see the shape they always did');
});

/* =================== Z: stored years ================================ */
say('');
say('=== Z. the stored years, and what this ticket does NOT touch ========');
guard('Z: the report page is untouched', () => {
  let checked = 0, tables = 0;
  const moved = [], derivedOnly = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach(y => {
      const a = OLD.attempt(api => api.renderSourceTables([t], y, {}, id));
      const b = NEW.attempt(api => api.renderSourceTables([t], y, {}, id));
      checked++;
      if (/<table/.test(String(b))) tables++;
      /* CLCPA-252 round 2: A8:2023 is the one data-carrying year with no
       * stored title, so its caption DERIVES now and the panel moves. Named
       * rather than tolerated -- anything else moving still fails Z2. */
      if (a !== b) { (((t.title_by_year || {})[y]) ? moved : derivedOnly).push(id + ':' + y); }
    });
  });
  ok(checked === 149 && tables === 149,
     'Z1 all 149 stored table-years rendered, every one with a <table>');
  ok(derivedOnly.join(',') === 'A8:2023',
     'Z1b the only untitled year is A8:2023, and CLCPA-252 round 2 derives it: ' +
     JSON.stringify(derivedOnly));
  ok(moved.length === 0,
     'Z2 and the REPORT page is byte-identical on every one: this ticket ' +
     'changes the editor and the template, not the published tables' +
     (moved.length ? ' -- MOVED ' + moved.slice(0, 6).join(', ') : ''));
});

guard('Z: the stored schema and data are not rewritten', () => {
  const src = codeOnly(SRC);
  const fn = /function phantomSpacerCols\([\s\S]*?\n  \}/.exec(src);
  ok(!!fn, 'Z3 the predicate was located');
  ok(fn && !/schema_by_year\[[^\]]*\]\s*=/.test(fn[0]) && !/\.data\[[^\]]*\]\s*=/.test(fn[0]),
     'Z4 and it assigns to neither schema_by_year nor data: it only reads');
  ok(/\/\* THE STORED SCHEMA IS NOT TOUCHED/.test(SRC) ||
     /THE STORED SCHEMA IS NOT TOUCHED/.test(SRC),
     'Z5 which the source says in as many words');
});

/* =================== X: blast radius and baseline =================== */
say('');
say('=== X. what else moved ============================================');
function grabFn(n, src) {
  const lines2 = src.split('\r\n');
  for (const pad of ['  ', '    ', '']) {
    const decl = new RegExp('^' + pad + '(?:async )?function ' + n + '\\s*\\(');
    const anyDecl = new RegExp('^' + pad + '(?:async )?function \\w+\\s*\\(');
    const start = lines2.findIndex(l => decl.test(l));
    if (start < 0) continue;
    const close = pad + '}';
    for (let i = start + 1; i < lines2.length; i++) {
      if (lines2[i] === close) return lines2.slice(start, i + 1).join('\r\n');
      if (anyDecl.test(lines2[i])) break;
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
  const EXPECT = {
    phantomSpacerCols: 'CLCPA-260: the predicate, new',
    buildIngestWorkbook: 'CLCPA-260: the template stops emitting them',
    renderIngestEditor: 'CLCPA-260: the editor stops rendering them; and CLCPA-255, group E',
    /* Group E stacks on top of this one. Named, not absorbed into a wider
     * count: an UNNAMED change still turns the first assertion red. */
    isDeclaredSummable: 'NOT this ticket: CLCPA-254, group E: the declared-summable column, new',
    recomputeTotals: 'NOT this ticket: CLCPA-254, group E: it consults that declaration',
    buildIngestImport: 'NOT this ticket: CLCPA-261, group E: it collects the fraction notices',
    renderIngestImportResult: 'NOT this ticket: CLCPA-261, group E: the summary announces them',
    tableCaption: 'NOT this ticket: CLCPA-252 round 2, it consults the derivation',
    deriveTableCaption: 'NOT this ticket: CLCPA-252 round 2, the title derivation (new)',
    deriveTableCaptionInfo: 'NOT this ticket: CLCPA-252 round 2, the three strategies (new)',
  };
  changed.forEach(n => ok(n in EXPECT, 'the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  /* 7 -> 10: CLCPA-252 round 2 added two and changed tableCaption, all named. */
  ok(changed.length === 10, 'X1 exactly TEN functions changed: ' + changed.length);
  /* buildIngestImport and recomputeTotals left this list when group E moved
   * them; both are named in EXPECT above. */
  /* tableCaption LEFT this list under CLCPA-252 round 2, which gave it a
   * derivation to consult. It is named in the map above instead, so the
   * change stays accounted for, just not as 'untouched'. */
  ['renderSourceTables', 'dacCol',
   'ingestComputed'].forEach(n => {
    ok(grabFn(n, SRC) === grabFn(n, BASE_SRC), 'X2 ' + n + ' is byte-identical to BASE');
  });
});
guard('X: the baseline', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X3 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: REPO }); anc = true; }
  catch (e) {}
  ok(anc, 'X4 and an ancestor of HEAD, so this group stacks on Group C');
});

lines.forEach(l => console.log(l));
console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n  ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
