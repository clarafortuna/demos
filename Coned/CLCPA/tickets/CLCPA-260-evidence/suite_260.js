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
/* CLCPA-252 round 3: the shared caption-difference judgement */
const kit = require('../_kit/caption_diff.js');

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
      /* CLCPA-252 ROUND 3 changes what a STORED year renders: every caption
       * loses its year. This pin is NARROWED, not widened -- the shared kit
       * requires everything outside the <h3> to be byte-identical AND each
       * caption to be its BASE self with year tokens removed. A reworded
       * caption, a changed cell or an ADDED year still fails. */
      if (!kit.onlyCaptionYearsChanged(b, a))
        { (((t.title_by_year || {})[y]) ? moved : derivedOnly).push(id + ':' + y); }
    });
  });
  ok(checked === 149 && tables === 149,
     'Z1 all 149 stored table-years rendered, every one with a <table>');
  ok(derivedOnly.join(',') === 'A8:2023',
     'Z1b the only untitled year is A8:2023, and CLCPA-252 round 2 derives it: ' +
     JSON.stringify(derivedOnly));
  /* RE-POINTED, not widened: an exact list of two, so a third still fails. */
  /* +2 for CLCPA-319, NAMED so a ninth still fails: G1 files no feet figure
   * for 2023 or 2024, so declaring that column gives an EMPTY cell its
   * numeric alignment class. Measured on this suite's own harness against
   * its own BASE: nothing else in those two panels moves, and G3, which
   * does file that figure, is untouched. Sorted, to match the comparison.
   * The message now prints the WHOLE list rather than a slice that could
   * hide the entry that broke it. */
  ok(JSON.stringify(moved.slice().sort()) === JSON.stringify(['A3:2023', 'A3:2024', 'A4:2023', 'A4:2024', 'G10:2024', 'G1:2023', 'G1:2024', 'J4:2025']),
     'Z2 and the REPORT page moves on exactly eight panels -- CLCPA-294 corrects two, where a computed total lands fractionally above 1 (1.0000327 and 1.0000000013) and the old size guess rendered 1.0% for 100.0%; CLCPA-290 four; CLCPA-319 aligns two empty cells -- got ' +
     JSON.stringify(moved.slice().sort()));
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
    /* re-pinned, named so the count stays exact */
    xlsxInstructionBlocks: 'NOT this ticket: CLCPA-282 operator-prose sweep: the workbook instructions and one rejection message say how many heading rows a table has',
    /* re-pinned, named so the count stays exact */
    ingestStagedSummary: 'NOT this ticket: CLCPA-300: the staged summary counts the columns that receive values',
    /* re-pinned, named so the count stays exact */
    derivedPctCols: 'NOT this ticket: CLCPA-294: a declared percentage column is always scaled, never guessed by value size',
    fmtDerivedCell: 'NOT this ticket: CLCPA-294: a declared percentage column is always scaled, never guessed by value size',
    formatCell: 'NOT this ticket: CLCPA-294: a declared percentage column is always scaled, never guessed by value size',
    renderTable: 'NOT this ticket: CLCPA-294: a declared percentage column is always scaled, never guessed by value size',
    /* re-pinned, named so the count stays exact */
    xlsxCell: 'NOT this ticket: CLCPA-274 option (c): a populated year exports its values, and a number is written as a number',
    /* CLCPA-291, named so the count stays exact */
    ingestTextOnlyColumn: 'NOT this ticket: CLCPA-291: a text column in a structure row is (no value), not (calculated) (new)',
    /* CLCPA-319, named so the count stays exact */
    isTotalOnlyDerived: 'NOT this ticket: CLCPA-319: G1 to G9s total row is computed from the rows beneath it, so the report follows its own figures instead of showing a stored copy (a columnTotal is derived on the total row alone)',
    totalRowFlags: 'NOT this ticket: CLCPA-319: G1 to G9s total row is computed from the rows beneath it, so the report follows its own figures instead of showing a stored copy (a columnTotal column CONFIRMS a total, so it is not skipped)',
    /* CLCPA-293 / A-10, named so the count stays exact */
    ingestRebuildableTotals: 'NOT this ticket: CLCPA-293 / A-10: a total the engine cannot derive is accepted from the preparer instead of being discarded in silence (new: it asks the engine which totals it can rebuild)',
    renderPreparerTotalsNotice: 'NOT this ticket: CLCPA-293 / A-10: a total the engine cannot derive is accepted from the preparer instead of being discarded in silence (new: the advisory that names one)',
    /* CLCPA-241 advisory, named so the count stays exact */
    renderKeptFigureNotice: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (new: the amber advisory that names a kept figure)',
    /* CLCPA-241 option (B), named so the count stays exact */
    applyDerivedCols: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten',
    stripDerivedForPersist: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (the strip refuses a kept cell)',
    derivedCellWrite: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (new)',
    derivedFiledReproduced: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (new)',
    unreconciledDerivedCols: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (new)',
    /* CLCPA-287 round 2, named so the count stays exact */
    ingestKeyColDescription: 'NOT this ticket: CLCPA-287 round 2: a key-column rejection names an unheaded column by role, not by its empty heading (new)',
    /* CLCPA-292 round 2, named so the count stays exact */
    ingestTemplateSource: 'NOT this ticket: CLCPA-292 round 2: a fresh-year template borrows its structure from a PUBLISHED year, never from a scratch one',
    /* CLCPA-282, named so the count stays exact */
    ingestHeaderKeys: 'NOT this ticket: CLCPA-282: a column on a two-level table is identified by its header PAIR (new)',
    ingestHeaderName: 'NOT this ticket: CLCPA-282: a column on a two-level table is identified by its header PAIR, and this names one for a message (new)',
    wireIngestPage: 'NOT this ticket: CLCPA-283: the remove-year handler it wires, and its refusal toast',
    /* CLCPA-283, named so the count stays exact */
    isYearProtected: 'NOT this ticket: CLCPA-283: a year the operator added is removable, data and all; protection is seed-year only',
    boot: 'NOT this ticket: CLCPA-283: a year the operator added is removable, data and all; protection is seed-year only (the seedYears note it carries)',
    /* CLCPA-301, named so the count stays exact */
    applyIngestImport: 'NOT this ticket: CLCPA-301: the import path computes the row total the importer deliberately left blank',
    fillDerivableSumsOnImport: 'NOT this ticket: CLCPA-301: the import path computes the row total the importer deliberately left blank (new)',
    /* CLCPA-281 round 3, named so the count stays exact */
    compareColWidths: 'NOT this ticket: CLCPA-281 round 3: the read-only surfaces ask the per-year header question through storedHeaderRowsInYear',
    renderSourceTables: 'NOT this ticket: CLCPA-281 round 3: the read-only surfaces ask the per-year header question through storedHeaderRowsInYear (it holds resolveRows and the has-data check)',
    storedHeaderRowsInYear: 'NOT this ticket: CLCPA-281 round 3: the read-only surfaces ask the per-year header question through storedHeaderRowsInYear (new)',

    /* CLCPA-269 r2, 270, 274, 275, 276, 277, 278 -- the review follow-up package of 2026-09-17. */

    ingestRowIsStoredHeader: 'CLCPA-274 round 3: is this row a stored header, by its blank label (new)',
    ingestYearCarriesHeaderRows: 'CLCPA-274 round 3: does THIS year carry them, or must it borrow (new)',
    ingestStoredHeaderRows: 'CLCPA-274 round 3: the table\'s own header rows, from a year that has them (new)',
    columnGrandTotals: 'CLCPA-278 round 3: and the engine\'s own summing, which is how recomputeTotals adds',
    ingestHeaderRowCount: 'CLCPA-274 round 2: how many leading data[] rows are really header, shared by the editor and the template writer (new)',
    rerenderIngestEditor: 'CLCPA-276 round 2: the editor repaint now repaints the notice mount beside it',
    ingestRoleOpen: 'CLCPA-270 amendment (the A8 ruling): the value half of the protection follows derivability (new)',
    ingestRowRole: 'CLCPA-270: the row role, from its label (new)',

    isTotalRoleLabel: 'CLCPA-270: the total-role label test (new)',

    isComputedShareLabel: 'CLCPA-270: a percentage OF A TOTAL (new)',

    ingestComputed: 'CLCPA-274: the template gains its own accessor',

    rowSumIsConsistent: 'CLCPA-278: whose figure is this total (new)',

    recomputeDerivableSums: 'CLCPA-278: a consistent total follows the edit (new)',

    clearIngestNotices: 'CLCPA-276: one helper for every notice exit (new)',

    declaredYearFromFilename: 'CLCPA-277: the year token in a filename (new)',

    importYearNotice: 'CLCPA-277: the wrong-year advisory (new)',

    /* CLCPA-250, 267, 271, 272, 273 -- the eight-ticket wave of 2026-09-16. */

    shiftSchemaYears: 'CLCPA-267: the borrowed-schema year shift (new)',

    getTableSchema: 'CLCPA-267: its fallback shifts the donor year',

    isPercentLiteral: 'CLCPA-273: the percent predicate, lifted out of buildIngestImport (new)',

    noteTypedPercent: 'CLCPA-273: records a percent typed into a cell (new)',

    renderTypedUnitNotice: 'CLCPA-273: the typed advisory, in the amber box (new)',

    refreshIngestNotices: 'CLCPA-273: repaints the notice mount in place (new)',

    wireIngestEditor: 'CLCPA-273: the blur handler reads the text before the parse',

    loadIngestDraft: 'CLCPA-273: clears the typed advisories on a table-year change',

    renderIngestImport: 'CLCPA-273 and CLCPA-272: the mount carries both advisories',

    refreshIngestCalcCells: 'CLCPA-271: calc cells keep their column format on repaint',

    dacDerivedTablesForYear: 'CLCPA-250: one year of display tables (new)',

    recomputeYearDerived: 'CLCPA-250: the composer KPI pass, re-runnable (new)',

    recomposeYearIfComposed: 'CLCPA-250: the composed-source gate (new)',

    composePayloadFromRows: 'CLCPA-250: it resolves a schema through getTableSchema',

    buildYearSelector: 'CLCPA-250: a year change re-derives that year',

    openSaveModal: 'CLCPA-250 and CLCPA-272: a save re-derives, and the dialog advises',

    detectSumColumns: 'CLCPA-272: the schema-derived sum relationship (new)',

    reconcileSumColumns: 'CLCPA-272: the reconciliation itself (new)',

    renderReconcileNotice: 'CLCPA-272: the reconciliation advisory box (new)',
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
    stripCaptionYear: 'NOT this ticket: CLCPA-252 round 3: the caption year strip (new)',
    deriveTableCaptionInfo: 'NOT this ticket: CLCPA-252 round 2, the three strategies (new)',
    declaredTableFromFilename: 'CLCPA-264: the filename extractor (new)',
    importIdentityNotice: 'CLCPA-264: the import identity advisory (new)',
    rowsForDisplay: 'CLCPA-263: it derives the value (pct) composites on its clone',
    applyCompositeShares: 'CLCPA-263: the derivation (new)',
    isCompositeShareCol: 'CLCPA-263: the declaration predicate (new)',
    compositeValueText: 'CLCPA-263: the value formatting (new)',
    bareNumber: 'CLCPA-263: the bare-number test (new)',
    openAddYearDialog: 'CLCPA-264: it attaches the advisory to the plan',
    stagedBlock: 'CLCPA-264: nested in openAddYearDialog, it renders the advisory',
    wire: 'CLCPA-264: nested in openAddYearDialog, it holds the call site',
    renderIngestImportResult: 'CLCPA-264: the result panel announces the advisory',
  };
  changed.forEach(n => ok(n in EXPECT, 'the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  /* 7 -> 10: CLCPA-252 round 2 added two and changed tableCaption, all named. */
  /* 10 -> 15: CLCPA-264 moved five this suite can see, all named above. */
  /* 15 -> 20: CLCPA-263 moved five, all named above. */
  /* 40 -> 49: the review follow-up package moved 9 more, every one of them named in the map above. The delta equals the number of entries added to that map, so nothing entered this count unattributed. */
  /* +1: the A8 ruling added ingestRoleOpen, named in the map above. */
  /* +2: CLCPA-274 round 2 added ingestHeaderRowCount and CLCPA-276
   * round 2 moved rerenderIngestEditor, both named in the map above. */
  /* 52 -> 56: CLCPA-274 round 3, CLCPA-281 and CLCPA-278 round 3,
   * every one named in the map above. */
  ok(changed.length === 86, 'X1 exactly this many functions changed: ' + changed.length);
  /* buildIngestImport and recomputeTotals left this list when group E moved
   * them; both are named in EXPECT above. */
  /* tableCaption LEFT this list under CLCPA-252 round 2, which gave it a
   * derivation to consult. It is named in the map above instead, so the
   * change stays accounted for, just not as 'untouched'. */
  /* ingestComputed LEFT this list under CLCPA-274, which gave the template
   * writer its own accessor. It is named in the map above instead, so the
   * change stays accounted for, just not as 'untouched'. */
  ['dacCol'].forEach(n => {
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
