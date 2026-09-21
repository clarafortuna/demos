/* CLCPA-293 round 4 -- THE B7 CENSUS, by ruling. This measures; it changes
 * nothing.
 *
 * Membership of the B7 registry derives from MEASUREMENT, never from memory.
 * The lineage is CLCPA-270's: census first, because collapsing a rule onto a
 * READING rather than a measurement is how the unanchored-substring defect
 * reached production.
 *
 * THE QUESTION, per total cell: what does the ENGINE'S OWN ATTEMPT produce,
 * against what the source STORED there? The engine is asked the way the
 * import guard asks it -- blank the row, run recomputeTotals over the rest,
 * read back what it wrote -- so this census and that guard cannot disagree
 * about what "derivable" means.
 *
 * THREE OUTCOMES, and only the first two are candidates:
 *
 *   SILENT     the engine writes NOTHING. It has no way to produce this
 *              figure at all, so the number in the table can only have come
 *              from the preparer. The strongest possible evidence.
 *   DIVERGENT  the engine writes a number that is NOT what is stored. Either
 *              the total legitimately covers more than the rows itemise, or
 *              the source disagrees with its own arithmetic. The census
 *              cannot tell those apart -- that is a judgement about the
 *              data, and it is why the owner confirms the list.
 *   OWNED      the engine reproduces the stored figure in every stored year.
 *              The engine owns it, and a file must not overwrite it.
 *
 * TOTAL ROWS ARE IDENTIFIED BY LABEL, deliberately. A registry keyed on
 * arithmetic would move as the numbers move, which is the whole defect
 * CLCPA-293 round 3 was withdrawn over.
 *
 * AND THE LABEL TEST HERE IS DELIBERATELY WIDER THAN THE APP'S. The first
 * cut used isAnchoredTotalRowLabel, which anchors at the END of the label,
 * and it silently excluded the row this ticket is about: A8's grand total is
 * "Total CES Programs Installations", with the total word at the START. The
 * census reported 0 candidate cells for a row the standing ruling names as a
 * member, which is the census failing rather than the row qualifying.
 *
 * So this collects any row whose label CONTAINS a total word, anywhere.
 * CLCPA-200 is the standing warning against an unanchored match, and it does
 * not apply here: that defect was an unanchored match DRIVING behaviour, and
 * this one only nominates candidates for a human to confirm. The registry
 * itself is an explicit list, so nothing in the app ever runs this predicate.
 *
 * Run:  node census_293_r4.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'census-293-r4-output.txt');
const JSONOUT = path.join(__dirname, 'census-293-r4-summary.json');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

function harness(src, want) {
  const L = src.split('\r\n');
  const TOP = [];
  L.forEach((ln, n) => {
    const m = /^ {2}(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (nm) => {
    const k = TOP.findIndex(d => d.name === nm);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n');
  };
  const parts = [], have = new Set();
  const add = (n) => {
    if (have.has(n)) return false;
    const f = find(n);
    if (!f) return false;
    have.add(n); parts.push(f); return true;
  };
  want.forEach(add);
  let api = null;
  const attempt = (call) => {
    for (let r = 0; r < 400; r++) {
      try {
        if (!api) {
          api = new Function('PAYLOAD', 'const state = { payload: PAYLOAD };\n' +
            parts.join('\n\n') +
            '\n;return {' + want.filter(n => have.has(n)).join(',') + '};')(P);
        }
        return call(api);
      } catch (e) {
        const m = /(\w+) is not defined/.exec(String(e && e.message));
        if (m && add(m[1])) { api = null; continue; }
        throw e;
      }
    }
    throw new Error('assembly did not converge');
  };
  return { attempt };
}

/* THE SIXTEEN NAMES THE ASSEMBLER CANNOT DISCOVER. recomputeTotals is
 * reached here directly, but the import guard wraps it in a production
 * try/catch that eats the ReferenceError this harness follows -- and a
 * census taken through that fallback is a census of the harness. Round 3
 * reported the same figure four times before this list existed. */
const WANT = ['recomputeTotals', 'getTableSchema', 'isAnchoredTotalRowLabel',
  'totalRowFlags', 'isStrictTotalRowLabel', 'DERIVED_COLS', 'DERIVED_ROWS', 'detectSumColumns',
  'unreconciledTotals', 'totalRowSums', 'columnGrandTotals', 'bareNumber',
  'withinSourceRounding', 'applyDerivedCols', 'sumDerivedCols',
  'derivedCellWrite', 'applyDerivedRows', 'addsOnlyPrecision',
  'storedDecimals', 'isDeclaredSummable', 'unreconciledDerivedRows',
  'SUMMABLE_COLS', 'derivedRowValue', 'derivedRowKeepsStored'];
const H = harness(SRC, WANT);

/* WIDER THAN THE APP'S PREDICATE, and only ever used to nominate. A row
 * whose label mentions a total at all is a candidate for inspection; what
 * decides membership is the engine's attempt, below, and the owner's
 * confirmation after it. */
const looksLikeTotal = (lbl) => lbl != null && /\btotals?\b/i.test(String(lbl));

log('CLCPA-293 round 4: THE B7 CENSUS');
log('app.js: ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* --- the harness must be running the real thing ----------------------- */
{
  const threw = [];
  let n = 0;
  Object.keys(P.tables).sort().forEach((id) => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach((y) => {
      const rows = t.data[y];
      if (!rows || !rows.length) return;
      n++;
      try {
        H.attempt((api) => {
          const schema = api.getTableSchema(t, y);
          if (!schema || !schema.length) return null;
          api.recomputeTotals(rows.map(r => r.slice()), schema, id,
            rows.map(r => r.slice()));
          return null;
        });
      } catch (e) { threw.push(id + ':' + y + ' ' + (e && e.message)); }
    });
  });
  log('HARNESS  recomputeTotals runs on all ' + n + ' stored table-years' +
      (threw.length ? ', EXCEPT: ' + JSON.stringify(threw.slice(0, 4)) : '.'));
  if (threw.length) {
    log('  STOPPING: every figure below would describe the fallback branch.');
    fs.writeFileSync(OUT, lines.join('\n') + '\n');
    process.exit(2);
  }
  log('         so the engine attempts below are the engine, not the harness.');
}
log('');

/* --- the census ------------------------------------------------------- */
/* one entry per TABLE + ROW LABEL + COLUMN, gathering every stored year, so
 * a row that is derivable in one year and not another is visible as such
 * rather than averaged away */
const cells = {};
Object.keys(P.tables).sort().forEach((id) => {
  const t = P.tables[id];
  Object.keys(t.data || {}).sort().forEach((y) => {
    const rows = t.data[y];
    if (!rows || !rows.length) return;
    H.attempt((api) => {
      const schema = api.getTableSchema(t, y);
      if (!schema || !schema.length) return null;
      rows.forEach((row, ri) => {
        if (!looksLikeTotal(row[0])) return;
        /* the engine's attempt, asked exactly as the import guard asks it */
        const probe = rows.map(r => (Array.isArray(r) ? r.slice() : r));
        for (let c = 1; c < schema.length; c++) probe[ri][c] = null;
        try {
          api.recomputeTotals(probe, schema, id, rows.map(r => r.slice()));
        } catch (e) { return; }
        for (let c = 1; c < schema.length; c++) {
          const stored = row[c];
          if (stored == null || String(stored).trim() === '') continue;
          const attempt = probe[ri] ? probe[ri][c] : null;
          const key = id + '\u0000' + String(row[0]) + '\u0000' + String(schema[c]);
          const e = cells[key] = cells[key] || {
            table: id, row: String(row[0]), column: String(schema[c]),
            years: [], silent: 0, divergent: 0, owned: 0,
            /* WHAT THE APP ITSELF THINKS THIS ROW IS. Needed because
             * "the engine wrote nothing" is trivially true of every
             * ordinary data row, and a data row whose label happens to
             * begin with the word Total is not a B7 total. */
            anchored: !!api.isAnchoredTotalRowLabel(row[0]),
            strict: !!api.isStrictTotalRowLabel(row[0]),
            flagged: false,
            lastRow: ri === rows.length - 1,
            rowIdx: ri, ofRows: rows.length,
          };
          if ((api.totalRowFlags(rows, id, schema) || [])[ri]) e.flagged = true;
          const blank = attempt == null || String(attempt).trim() === '';
          /* THE ENGINE'S OWN TOLERANCE, not an equality I invented.
           *
           * The first cut compared the two as strings and nominated 94
           * cells, almost all of them artefacts: A1/2023's total stored
           * 262,524,921 against a computed 262,524,920, and its percentage
           * stored 0.49 against a computed 0.49397. Neither is a total the
           * engine cannot derive; the first is the source's own rounding
           * and the second is a figure stored at two decimals. Calling
           * those B7 would hand 94 cells to the preparer for arithmetic
           * reasons, which is round 3's mistake with a census attached.
           *
           * withinSourceRounding and addsOnlyPrecision are the tests the
           * engine already uses to decide whether a stored figure IS the
           * computation. Asking them here means the census and the engine
           * cannot disagree about what "reproduces" means. */
          const same = !blank && (String(attempt) === String(stored) ||
            api.withinSourceRounding(stored, attempt) ||
            api.addsOnlyPrecision(stored, attempt));
          e.years.push({ year: y, stored: stored, attempt: blank ? null : attempt,
            verdict: blank ? 'SILENT' : (same ? 'OWNED' : 'DIVERGENT') });
          if (blank) e.silent++; else if (same) e.owned++; else e.divergent++;
        }
      });
      return null;
    });
  });
});

const all = Object.keys(cells).map(k => cells[k]);
/* A CELL IS A CANDIDATE IF THE ENGINE EVER FAILS TO REPRODUCE IT. One year
 * of silence or divergence is enough: a registry that admitted a cell only
 * when EVERY year failed would exclude exactly the rows whose figures
 * happen to reconcile this year, which is the value-classifier trap wearing
 * a census for a hat. */
const candidates = all.filter(e => e.silent > 0 || e.divergent > 0);
const owned = all.filter(e => e.silent === 0 && e.divergent === 0);

log('=======================================================================');
log(' TOTAL CELLS MEASURED');
log('=======================================================================');
log('  total-labelled rows, cells with a stored figure : ' + all.length);
log('  the engine reproduces in every stored year      : ' + owned.length +
    '   (OWNED, must stay refused)');
log('  the engine fails in at least one year           : ' + candidates.length +
    '   (CANDIDATES)');
log('');

/* --- THE NOMINATION RULE, stated ------------------------------------- */
/* A candidate becomes a NOMINEE when the table itself treats the row as a
 * total, by any of the app's own signals, or when it is the table's LAST
 * row and its label mentions a total.
 *
 * The second clause exists for one measured reason: A8's grand total,
 * "Total CES Programs Installations", passes NONE of the app's signals. It
 * is not strict, not end-anchored, and totalRowFlags does not confirm it,
 * because the figure it holds is not its rows' sum. It is structurally
 * invisible to the app as a total, which is exactly why it behaved oddly,
 * and a nomination rule built only on app signals would exclude the row
 * this ticket exists for.
 *
 * Nothing here decides membership. The owner confirms the list. */
const nominated = candidates.filter(e =>
  e.anchored || e.strict || e.flagged || (e.lastRow && /\btotals?\b/i.test(e.row)));
const notNominated = candidates.filter(e => nominated.indexOf(e) < 0);

log('=======================================================================');
log(' THE NOMINEES: candidates the table itself treats as a total');
log('=======================================================================');
log('  candidates                          : ' + candidates.length);
log('  of those NOMINATED for the registry : ' + nominated.length);
log('  set aside: a DATA row whose label mentions a total, where the engine');
log('  writing nothing means only that it is not a total at all: ' +
    notNominated.length);
log('');
{
  const byT = {};
  nominated.forEach(e => { (byT[e.table] = byT[e.table] || []).push(e); });
  Object.keys(byT).sort().forEach((id) => {
    log('  ' + id);
    byT[id].forEach((e) => {
      const sig = [e.strict ? 'strict' : null, e.anchored ? 'anchored' : null,
        e.flagged ? 'flagged' : null,
        (e.lastRow ? 'last row ' + e.rowIdx + ' of ' + e.ofRows : null)]
        .filter(Boolean).join(', ') || 'no app signal';
      log('    ' + JSON.stringify(e.row.slice(0, 42)) + '  /  ' +
          JSON.stringify(e.column.slice(0, 24)) + '   [' + sig + ']');
      e.years.forEach(y => log('        ' + y.year + '  stored ' +
        JSON.stringify(y.stored) + '  engine ' + JSON.stringify(y.attempt) +
        '  ' + y.verdict));
    });
  });
}
log('');

/* --- THE PROPOSED MEMBERSHIP, deliberately conservative -------------- */
/* THE ASYMMETRY DECIDES THE RULE. A total left OUT of the registry behaves
 * exactly as it does today: refused. So an omission costs nothing that is
 * not already the case, while a wrong INCLUSION hands a cell the engine
 * really does own to a file, which is CLCPA-88. The proposal therefore
 * takes only the strongest evidence and lets the owner add to it.
 *
 *   SILENT IN EVERY STORED YEAR  the engine has never once produced this
 *                                figure, in any year the source has filed
 *   AND an app total signal      strict, end-anchored, or arithmetically
 *                                confirmed, so the table itself agrees the
 *                                row is a total
 *
 * PLUS the two members named by standing ruling, which is how A8's grand
 * total gets in: it passes no app signal at all, and that is precisely the
 * anomaly the ruling already settled.
 *
 * WHAT THIS EXCLUDES, and why it should: I1's "Total number of hires at Con
 * Edison from [...]" is a DATA row whose label begins with the word, which
 * is CLCPA-245's own example, and it reaches the nominee list only through
 * the last-row clause. J9's row is the single row of a one-row table. A
 * label rule cannot tell either of them from A8's grand total, and that is
 * the argument for an explicit registry rather than a predicate. */
const NAMED = [
  { table: 'A8', row: 'Total CES Programs Installations' },
  { table: 'J8', row: 'Total' },
];
const isNamed = (e) => NAMED.some(n => n.table === e.table && n.row === e.row);
const proposed = nominated.filter(e =>
  (e.silent === e.years.length && (e.strict || e.anchored || e.flagged)) ||
  isNamed(e));
const heldBack = nominated.filter(e => proposed.indexOf(e) < 0);

log('=======================================================================');
log(' THE PROPOSED MEMBERSHIP, for confirmation');
log('=======================================================================');
log('  nominees                 : ' + nominated.length);
log('  PROPOSED as members      : ' + proposed.length);
log('  held back for a decision : ' + heldBack.length);
log('');
{
  const byT = {};
  proposed.forEach(e => { (byT[e.table] = byT[e.table] || []).push(e); });
  Object.keys(byT).sort().forEach((id) => {
    log('  ' + id + '  (' + byT[id].length + ')');
    byT[id].forEach((e) => {
      log('    ' + JSON.stringify(e.row.slice(0, 42)) + '  /  ' +
          JSON.stringify(e.column.slice(0, 26)) +
          (isNamed(e) ? '   [NAMED BY RULING]' : '') );
      log('        engine silent in all ' + e.years.length + ' stored year(s); ' +
          'stored ' + e.years.map(y => y.year + '=' + JSON.stringify(y.stored)).join(' '));
    });
  });
}
log('');
log('  HELD BACK, each with the reason it is not proposed:');
heldBack.forEach((e) => {
  const why = e.silent !== e.years.length
    ? 'the engine reproduces or diverges in at least one year, so silence is not the whole story'
    : 'no app total signal: nominated only by being the last row of its table';
  log('    ' + e.table + '  ' + JSON.stringify(e.row.slice(0, 40)) + '  /  ' +
      JSON.stringify(e.column.slice(0, 22)));
  log('        ' + why);
});
log('');

/* --- the candidates, per table, with their evidence ------------------- */
log('=======================================================================');
log(' EVERY CANDIDATE, INCLUDING THE ONES SET ASIDE');
log(' stored = what the source filed; engine = what the engine produces when');
log(' the row is blanked and the rest of the table recomputed');
log('=======================================================================');
const byTable = {};
candidates.forEach((e) => { (byTable[e.table] = byTable[e.table] || []).push(e); });
Object.keys(byTable).sort().forEach((id) => {
  log('');
  log('  ' + id);
  byTable[id].forEach((e) => {
    const shape = e.silent === e.years.length ? 'SILENT in every year'
      : e.divergent === e.years.length ? 'DIVERGENT in every year'
      : 'mixed (' + e.silent + ' silent, ' + e.divergent + ' divergent, ' +
        e.owned + ' reproduced)';
    log('    ' + JSON.stringify(e.row.slice(0, 44)) + '  /  ' +
        JSON.stringify(e.column.slice(0, 30)));
    log('        ' + shape);
    e.years.forEach((y) => {
      log('        ' + y.year + '  stored ' + JSON.stringify(y.stored) +
          '  engine ' + JSON.stringify(y.attempt) + '  ' + y.verdict);
    });
  });
});

log('');
log('=======================================================================');
log(' SHAPE OF THE CANDIDATE SET');
log('=======================================================================');
const silentAll = candidates.filter(e => e.silent === e.years.length);
const divAll = candidates.filter(e => e.divergent === e.years.length);
const mixed = candidates.filter(e => e.silent > 0 && e.owned > 0 ||
  e.divergent > 0 && e.owned > 0);
log('  SILENT in every stored year    : ' + silentAll.length +
    '   the engine has no way to produce these at all');
log('  DIVERGENT in every stored year : ' + divAll.length +
    '   the engine produces a different number every time');
log('  MIXED                          : ' + mixed.length +
    '   reproduced in some years and not others');
log('  tables involved                : ' +
    JSON.stringify(Object.keys(byTable).sort()));
log('');
log('  THE MIXED SET IS THE ONE THAT MATTERS MOST. A cell reproduced in one');
log('  year and not another is precisely the cell whose ownership the old');
log('  guard decided from the stored value, so it belonged to the preparer');
log('  or to the engine depending on which year was open.');

log('');
log('=======================================================================');
log(' THE TWO NAMED MEMBERS, CHECKED BY MEASUREMENT');
log('=======================================================================');
[['A8', /^Total CES Programs Installations$/i], ['J8', /^Total$/i]].forEach(([id, re]) => {
  const hits = candidates.filter(e => e.table === id && re.test(e.row));
  const missing = all.filter(e => e.table === id && re.test(e.row) &&
    hits.indexOf(e) < 0);
  log('  ' + id + ': ' + hits.length + ' candidate cell(s) on that row' +
      (missing.length ? ', and ' + missing.length + ' the engine reproduces' : ''));
  hits.forEach(e => log('      ' + JSON.stringify(e.column) + '  ' +
    e.years.map(y => y.year + ':' + y.verdict).join(' ')));
  missing.forEach(e => log('      ' + JSON.stringify(e.column) +
    '  OWNED in every year -- NOT a member'));
});

fs.writeFileSync(JSONOUT, JSON.stringify({
  measuredAt: 'census only, no code changed',
  cells: all.length, owned: owned.length, candidates: candidates.length,
  silentEveryYear: silentAll.length, divergentEveryYear: divAll.length,
  mixed: mixed.length,
  tables: Object.keys(byTable).sort(),
  nominated: nominated.length, proposed: proposed.map(e => ({ table: e.table, row: e.row, column: e.column, years: e.years })),
  heldBack: heldBack.length,
  members: candidates.map(e => ({ table: e.table, row: e.row, column: e.column,
    silent: e.silent, divergent: e.divergent, owned: e.owned,
    years: e.years })),
}, null, 2) + '\n');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
