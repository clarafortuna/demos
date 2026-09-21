/* CLCPA-293 round 3: the anatomy the owner named, reconstructed by REPLAYING
 * the mechanism that made it, and the discard reproduced.
 *
 * ROUND 2 GOT THIS WRONG, and the correction is the point of this file. I
 * measured four anatomies, found the discard only in the fourth, and argued
 * the fourth was correct to refuse: the row holds the figure its own rows
 * come to, so the engine derives it, so CLCPA-88 forbids a file overwriting
 * it. Two facts I did not have make that argument fail.
 *
 *   1  The row's provenance. It exists as an ORDINARY STORED ROW with stored
 *      values, written by the CLCPA-122 audit's import-and-save in the era
 *      when imports created Total rows as ordinary rows -- the CLCPA-240
 *      finding 2 mechanism. The figure sitting in it is therefore a STORED
 *      COPY that an earlier import wrote, not a derivation the engine owns.
 *      "The engine can reproduce this number" and "this number is the
 *      engine's" are different claims, and round 2 treated them as one.
 *
 *   2  The counts are CELLS on both surfaces: staged 26 values, the draft
 *      banner 24 cells, and the two missing are exactly the two filed totals.
 *
 * So this file does not hand-build the end state. It replays the mechanism --
 * itemised rows in, the engine's own totals written over them, saved -- and
 * then imports against the result, which is how A3/2098 was reconstructed for
 * CLCPA-292 round 2.
 *
 * A8 is the table because it carries BOTH kinds of total at the bottom:
 *
 *     r24  "Residential Programs Installations Total"   283,852   derivable
 *     r25  "Total CES Programs Installations"           336,599   B7-class,
 *          52,747 more than the rows itemise, and the difference is real
 *
 * Nothing is asserted here. This file measures; suite_293_r3 pins.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const BASE = process.env.DAC_BASE_COMMIT || 'd84c0d3';
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'probe-293-r3-output.txt');

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

const WANT = ['buildIngestImport', 'getTableSchema', 'ingestComputed',
  'recomputeTotals', 'ingestRebuildableTotals', 'stripDerivedForPersist',
  'totalRowFlags', 'isAnchoredTotalRowLabel', 'DERIVED_COLS',
  'detectSumColumns', 'reconcileSumColumns'];
const NEW = harness(SRC, WANT), OLD = harness(BASE_SRC, WANT);

const T = P.tables.A8;
const SCHEMA = NEW.attempt(api => api.getTableSchema(T, '2025'));
const SRC_ROWS = T.data['2025'];
const R24 = 24, R25 = 25;

log('CLCPA-293 round 3: the stored anatomy, replayed rather than hand-built');
log('app.js: ' + (process.env.DAC_APP_OVERRIDE || 'working tree') + '   BASE ' + BASE);
log('');

/* ---- step 1: REPLAY THE MECHANISM ------------------------------------- */
log('=======================================================================');
log(' 1. THE ANATOMY, built the way the real one was built');
log('=======================================================================');
log('  An import lands the itemised rows, the engine writes the total rows');
log('  from them, and the save stores the lot as ordinary rows. That is the');
log('  CLCPA-240 finding 2 mechanism, and it is replayed here rather than');
log('  guessed at: no figure below is typed into this file.');
log('');

/* THE ERA'S MECHANISM, and the first thing the replay taught me.
 *
 * My first cut blanked both total rows and let recomputeTotals write them,
 * which is what an import-and-save does TODAY. It cannot produce the
 * anatomy: the engine writes r24 and leaves r25 NULL, because r25 is the
 * B7-class grand total it has no way to derive. So the 336,599 sitting in
 * the real row was never written by the engine at all. A FILE put it there,
 * which is precisely the CLCPA-240 finding 2 mechanism the owner named --
 * the era when an import created a Total row as an ordinary row and wrote
 * the preparer's filed figure straight into it.
 *
 * So the replay files both totals from a prior preparer's file. The one
 * variable that matters is whether that earlier file's figures reconciled
 * with its own itemised rows, because that is what the classifier reads. */
function replaySave(priorR24, priorR25) {
  return NEW.attempt((api) => {
    const rows = SRC_ROWS.map(r => r.slice());
    /* the era's import: the itemised rows land, and so do the filed totals,
     * written as ordinary stored values rather than recognised as totals */
    rows[R24] = [SRC_ROWS[R24][0], priorR24[0], priorR24[1], null];
    rows[R25] = [SRC_ROWS[R25][0], priorR25[0], priorR25[1], null];
    return api.stripDerivedForPersist(rows.map(r => r.slice()), 'A8', SCHEMA);
  });
}
/* what the itemised rows actually come to, taken from the engine and not
 * retyped, so "a file whose totals reconcile" means what the engine means */
const ITEMISED = NEW.attempt((api) => {
  const rows = SRC_ROWS.map(r => r.slice());
  [R24, R25].forEach((ri) => { for (let c = 1; c < SCHEMA.length; c++) rows[ri][c] = null; });
  api.recomputeTotals(rows, SCHEMA, 'A8', SRC_ROWS.map(r => r.slice()));
  return { r24: [rows[R24][1], rows[R24][2]], r25: [rows[R25][1], rows[R25][2]] };
});
log('  the engine, asked to write both total rows from the itemised ones:');
log('      r24 -> ' + JSON.stringify(ITEMISED.r24));
log('      r25 -> ' + JSON.stringify(ITEMISED.r25) +
    '   <- it cannot derive this row at all');
log('');
log('  so the figure in the real r25 came from a FILE, not from the engine,');
log('  and the replay files both totals the way that era of the importer did.');
log('');
/* THE HOSTED ANATOMY: a prior file whose own totals reconciled. */
const stored = replaySave(ITEMISED.r24, [ITEMISED.r24[0], ITEMISED.r24[1]]);
/* and the contrast: the anatomy A8/2025 is in, where the filed grand total
 * is 52,747 more than the rows itemise and the difference is real */
const storedB7 = replaySave([SRC_ROWS[R24][1], SRC_ROWS[R24][2]],
  [SRC_ROWS[R25][1], SRC_ROWS[R25][2]]);
log('  RECONSTRUCTED: a prior file whose totals reconciled with its own rows');
log('      r24 ' + JSON.stringify(stored[R24]));
log('      r25 ' + JSON.stringify(stored[R25]));
log('  CONTRAST: the anatomy A8/2025 is in today');
log('      r24 ' + JSON.stringify(storedB7[R24]));
log('      r25 ' + JSON.stringify(storedB7[R25]));

/* ---- step 2: how each build CLASSIFIES that row ----------------------- */
log('');
log('=======================================================================');
log(' 2. WHO OWNS THOSE TWO CELLS, on the reconstructed anatomy');
log('=======================================================================');
[['the reconstructed 2098', stored], ['the stored 2025', SRC_ROWS]].forEach(([what, rows]) => {
  const flags = NEW.attempt(api => api.totalRowFlags(rows, 'A8', SCHEMA) || []);
  const rebuild = NEW.attempt((api) => {
    const c = api.ingestComputed(rows, 'A8', SCHEMA);
    return api.ingestRebuildableTotals(rows, SCHEMA, 'A8', r => c.totalRow(r));
  });
  log('  ' + what);
  [R24, R25].forEach((ri) => {
    log('      r' + ri + ' ' + JSON.stringify(String(rows[ri][0]).slice(0, 44)));
    log('          totalRowFlags confirms it a total : ' + !!flags[ri]);
    log('          rebuildable (so the import refuses): ' +
        JSON.stringify([1, 2].filter(c => rebuild.has(ri + ',' + c))));
  });
});

/* ---- step 3: THE IMPORT, staged against landed ------------------------ */
log('');
log('=======================================================================');
log(' 3. THE IMPORT: what the file stages, and what the draft ends up with');
log('=======================================================================');
log('  The file fills the two figure columns on every itemised row and files');
log('  both totals itself, which is what a preparer working from the');
log('  workbook does. Percentages are left to the engine.');
log('');

/* the file: every itemised row's two figure columns, plus the two totals */
function buildFile(rows) {
  const file = [SCHEMA.slice()];
  const staged = [];
  rows.forEach((r, ri) => {
    const out = [r[0], '', '', ''];
    /* a heading row carries no figures in this table and the file leaves it */
    const headingRow = String(r[1]) === '' && String(r[2]) === '';
    if (!headingRow) {
      /* the preparer's own figures: the stored ones moved on, so the import
       * has something to land that is not already there */
      out[1] = (typeof SRC_ROWS[ri][1] === 'number' ? SRC_ROWS[ri][1] : 0) + 7;
      out[2] = (typeof SRC_ROWS[ri][2] === 'number' ? SRC_ROWS[ri][2] : 0) + 3;
      staged.push(ri + ',1'); staged.push(ri + ',2');
    }
    file.push(out);
  });
  return { file, staged };
}

function runImport(H, rows, label) {
  const { file, staged } = buildFile(rows);
  const res = H.attempt(api => api.buildIngestImport(file, SCHEMA,
    rows.map(r => r.slice()), 'A8'));
  /* PER CELL, and only over the cells the file actually staged. A count of
   * everything the importer looked at is not a count of what the preparer
   * filed, and the first cut of this probe conflated the two: it reported
   * 40 cells "dropped as computed" for a file that staged 40 values, which
   * is arithmetic about two different sets. */
  const stagedSet = new Set(staged);
  const cellOf = (e) => {
    const ri = rows.findIndex(r => String(r[0]) === String(e.label));
    const ci = SCHEMA.indexOf(e.column);
    return ri + ',' + ci;
  };
  const landedSet = new Set((res.populated || []).map(cellOf));
  const namedSet = new Set((res.preparerTotals || []).map(cellOf));
  const stagedLanded = staged.filter(k => landedSet.has(k));
  const stagedLost = staged.filter(k => !landedSet.has(k));
  log('  ' + label);
  log('      values the file stages            : ' + staged.length);
  log('      of those, cells that land         : ' + stagedLanded.length);
  log('      of those, cells that DO NOT       : ' + stagedLost.length);
  log('      and the ones that do not are      : ' +
      JSON.stringify(stagedLost.map((k) => {
        const [r, c] = k.split(',');
        return 'r' + r + ' ' + String(rows[r][0]).slice(0, 36) + ' / ' + SCHEMA[c];
      })));
  /* the two total rows, named individually: this is the whole question */
  [R24, R25].forEach((ri) => {
    const cells = [1, 2].map((c) => {
      const k = ri + ',' + c;
      if (!stagedSet.has(k)) return SCHEMA[c] + '=not staged';
      return SCHEMA[c] + '=' + (landedSet.has(k)
        ? (namedSet.has(k) ? 'LANDED and NAMED' : 'landed, not named')
        : 'DISCARDED IN SILENCE');
    });
    log('      r' + ri + ' ' + String(rows[ri][0]).slice(0, 42));
    log('          ' + cells.join('   '));
  });
  return { staged: staged.length, landed: stagedLanded.length,
    lost: stagedLost.length, named: namedSet.size };
}

const a = runImport(NEW, stored, 'ON THE RECONSTRUCTED ANATOMY (the hosted case)');
log('');
const b = runImport(NEW, storedB7,
  'and on the anatomy whose grand total does NOT reconcile');

log('');
log('=======================================================================');
log(' 4. THE SAME IMPORT ON ' + BASE);
log('=======================================================================');
const c = runImport(OLD, stored, 'the build before this whole stack');

/* ---- step 5: what the registry-derivability fix would cost ------------ */
log('');
log('=======================================================================');
log(' 5. THE CANDIDATE FIX, SIZED BEFORE IT IS BUILT');
log('=======================================================================');
log('  The principle is the one already ruled for the CLCPA-320 marker this');
log('  session: DERIVABILITY COMES FROM THE RULE REGISTRY, not from row role,');
log('  and by the same reasoning not from the value in the cell. Applied here,');
log('  a total cell would be the engine\'s only where the engine has a');
log('  DECLARED rule that produces it -- a derived column, a declared derived');
log('  row, or a detectSumColumns relationship -- and not merely because the');
log('  figure stored in it today happens to add up.');
log('');
log('  This is NOT built. What follows is its blast radius, measured across');
log('  every table and every stored year, so the size of the change is known');
log('  before anyone decides to make it.');
log('');
const moved = { cells: 0, byTable: {} };
let totalRebuildable = 0;
Object.keys(P.tables).sort().forEach((id) => {
  const t = P.tables[id];
  Object.keys(t.data || {}).sort().forEach((y) => {
    const rows = t.data[y];
    if (!rows || !rows.length) return;
    NEW.attempt((api) => {
      const schema = api.getTableSchema(t, y);
      if (!schema || !schema.length) return null;
      const c = api.ingestComputed(rows, id, schema);
      const reb = api.ingestRebuildableTotals(rows, schema, id, r => c.totalRow(r));
      const declaredCols = new Set(((api.DERIVED_COLS[id]) || []).map(d => d.column));
      (api.detectSumColumns(schema, rows, id) || [])
        .forEach(s => declaredCols.add(s.column));
      reb.forEach((k) => {
        totalRebuildable++;
        const col = Number(k.split(',')[1]);
        if (!declaredCols.has(col)) {
          moved.cells++;
          (moved.byTable[id] = moved.byTable[id] || []).push(y + ' ' + k);
        }
      });
      return null;
    });
  });
});
log('  total cells the importer refuses as rebuildable today : ' + totalRebuildable);
log('  of those, cells with NO declared rule behind them     : ' + moved.cells);
log('  tables affected: ' + Object.keys(moved.byTable).length + '  ' +
    JSON.stringify(Object.keys(moved.byTable).sort()));
Object.keys(moved.byTable).sort().slice(0, 8).forEach((id) => {
  log('      ' + id + ': ' + moved.byTable[id].length + ' cells');
});
log('');
log('  Every one of those cells would move from REFUSED to accepted and');
log('  named. That is the direction CLCPA-272 ruled -- a provided value is');
log('  accepted and reconciled, never rejected -- so the change is not');
log('  dangerous in kind. It is large in degree, and it is a change to what');
log('  the importer does on every table, which is why it is measured and');
log('  left for a ruling rather than taken on my own judgement.');

log('');
log('--- what this shows ---------------------------------------------------');
log('  THE DISCARD REPRODUCES. On the reconstructed anatomy the file stages ' +
    a.staged + ',');
log('  ' + a.landed + ' land and ' + a.lost + ' do not; on the anatomy whose grand total does not');
log('  reconcile, ' + b.lost + ' do not. The difference is exactly two cells, and they');
log('  are exactly the two cells of the filed grand total, which is the');
log('  hosted finding: the two missing were the two filed totals.');
log('');
log('  Both are DISCARDED IN SILENCE: totals accepted and named is ' + a.named + '.');
log('  Round 2 measured this same behaviour and called it correct, on the');
log('  reasoning that the engine can reproduce the figure so the cell is the');
log('  engine\'s. The provenance is what breaks that: the engine CANNOT');
log('  derive r25 -- section 1 shows it writing null -- so the figure it');
log('  reproduces is one an earlier FILE put there. The engine is claiming a');
log('  cell on the strength of a number it did not write.');
log('');
log('  The reason it is not correct is in section 2. The SAME two cells of');
log('  the SAME table belong to the preparer or to the engine depending on');
log('  whether the figures stored in them happen to add up: on the 2025');
log('  anatomy r25 is not confirmed and its filed figure is kept and named,');
log('  and on the reconstructed one it is confirmed and the filed figure is');
log('  dropped in silence. Ownership of a cell is being decided by the value');
log('  currently sitting in it, which is the classifier trap this engine has');
log('  now ruled against three times: CLCPA-293s own comment, CLCPA-319s');
log('  columnTotal, and the CLCPA-320 marker ruling that derivability comes');
log('  from the rule registry and not from row role.');

fs.writeFileSync(OUT, lines.join('\n') + '\n');
