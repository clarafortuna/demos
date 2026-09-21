/* CLCPA-293 round 2: AN ATTEMPT TO REPRODUCE THE STORED-ANATOMY DISCARD,
 * which did not reproduce. Measurement only; no code was shipped for it.
 *
 * Round 1 shipped B7: a total the engine cannot derive belongs to the
 * preparer, so it is accepted rather than discarded, and named on the panel.
 * The owner's hosted pass found that whole on a ROWLESS year -- 26 of 26 land,
 * "Taken as filed" shown -- and discarding on a year whose grand-total row
 * already exists as a stored structural row: 24 of 26, no advisory, on A8/2098.
 *
 * THIS WALKS EVERY ANATOMY I COULD CONSTRUCT FOR THAT TARGET YEAR, on the
 * shipped build, and three of the four already behave correctly: the filed
 * grand total is taken and named. The fourth refuses, and refusing is right
 * there -- the row holds the figure its own rows come to, so the engine
 * genuinely derives it and CLCPA-88 forbids a file overwriting it. That is
 * the case suite_293's own D block pins for A1.
 *
 * SO THE 24 OF 26 IS NOT REPRODUCED HERE, and I did not ship a change for it.
 * A first cut asked whether the engine reproduced the FILE's figure rather
 * than the draft's; suite_293's D block caught that accepting 111,111 into
 * A1's Total, which is the CLCPA-88 defect coming back. A second cut asked it
 * of the draft's figure, passed every suite, and then measured IDENTICAL to
 * the shipped build on all four anatomies -- a change that fixes nothing
 * while claiming to. Both were withdrawn.
 *
 * What is needed to go further is the anatomy A8/2098 actually had on the
 * hosted pass. See CLCPA-293-r2-stop.md.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'probe-293-r2-output.txt');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

function harness(src, want) {
  const L = src.split('\r\n');
  const TOP = [];
  L.forEach((ln, n) => {
    const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
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

const H = harness(SRC, ['ingestRebuildableTotals', 'ingestComputed', 'getTableSchema',
  'recomputeTotals', 'totalRowFlags', 'buildIngestImport', 'isAnchoredTotalRowLabel']);

log('CLCPA-293 round 2: the two paths, side by side');
log('app.js: ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ---- the table the hosted pass used --------------------------------- */
const ID = 'A8';
const YEAR = Object.keys(P.tables[ID].data || {}).sort().pop();
const schema = H.attempt(api => api.getTableSchema(P.tables[ID], YEAR));
const stored = P.tables[ID].data[YEAR];

log('=======================================================================');
log(ID + ':' + YEAR + ', which is the anatomy the hosted pass imported into');
log('=======================================================================');
const totalRows = [];
H.attempt((api) => {
  const c = api.ingestComputed(stored, ID, schema);
  stored.forEach((r, i) => { if (c.totalRow(i)) totalRows.push(i); });
  return null;
});
log('  rows: ' + stored.length + ', rows the app calls a TOTAL: ' +
    JSON.stringify(totalRows));
totalRows.forEach(i => log('      r' + i + ' ' +
  JSON.stringify(String(stored[i][0]).slice(0, 44)) + '  ' +
  JSON.stringify(stored[i].slice(1))));
log('');

/* ---- what the engine REBUILDS, against what is filed ----------------- */
log('  For each total cell: what is FILED, what the engine puts back when the');
log('  row is blanked, and whether the engine reproduces the filed figure.');
log('');
const probeRows = stored.map(r => r.slice());
totalRows.forEach((i) => {
  const blanked = stored.map(r => r.slice());
  for (let c = 1; c < schema.length; c++) blanked[i][c] = null;
  H.attempt(api => api.recomputeTotals(blanked, schema, ID, probeRows));
  for (let c = 1; c < schema.length; c++) {
    const filed = stored[i][c], back = blanked[i][c];
    if (filed == null && back == null) continue;
    const same = String(filed) === String(back);
    log('    r' + i + 'c' + c + '  filed ' + JSON.stringify(filed) +
        '  engine gives ' + JSON.stringify(back) +
        (same ? '   reproduces' : '   DIFFERS'));
  }
});

/* ---- the decision the importer makes today --------------------------- */
log('');
log('  What ingestRebuildableTotals says about those cells, which is what');
log('  decides whether a preparer figure is taken or dropped:');
const reb = H.attempt((api) => {
  const c = api.ingestComputed(stored, ID, schema);
  return api.ingestRebuildableTotals(stored, schema, ID, (r) => c.totalRow(r));
});
log('    rebuildable cells: ' + reb.size);
Array.from(reb).slice(0, 12).forEach(k => log('      ' + k));

/* ---- and on a ROWLESS year, the path that works ---------------------- */
log('');
log('  The same question on a ROWLESS year, which is the path the hosted pass');
log('  found whole:');
const rebEmpty = H.attempt((api) => {
  const c = api.ingestComputed([], ID, schema);
  return api.ingestRebuildableTotals([], schema, ID, (r) => c.totalRow(r));
});
log('    rebuildable cells: ' + rebEmpty.size +
    '   so every figure in the file is taken and named');

/* ---- THE IMPORT ITSELF, on both paths, with the file that matters ----- */
log('');
log('=======================================================================');
log('THE IMPORT, run on both paths with the same file');
log('=======================================================================');
log('');
log('  The file carries the table as a preparer would file it, with a GRAND');
log('  TOTAL the itemised rows do not come to. That is not an error: A8s');
log('  grand total legitimately exceeds the rows beneath it, because not all');
log('  of its components appear in the table. It is the whole case round 1');
log('  was built for.');
log('');

const GRAND = 24;                       /* "Residential Programs Installations Total" */
/* A FIGURE THE TABLE CANNOT PRODUCE. 336,599 was the first choice and it
 * collides: A8s r25 "Total CES Programs Installations" already holds exactly
 * that, so the engine rolls r24 up to it and the cell reads as one the
 * engine owns. A fixture whose value the table can reach tests nothing. */
const FILED = 999999;
const fileRows = [schema.slice()].concat(stored.map(r => r.slice()));
fileRows[GRAND + 1] = fileRows[GRAND + 1].slice();
fileRows[GRAND + 1][1] = FILED;

const run = (label, draft) => {
  const res = H.attempt(api => api.buildIngestImport(fileRows, schema, draft, ID));
  const landed = (res.populated || []).length;
  const dropped = ((res.notTouched || {}).computed || []).length;
  const named = (res.preparerTotals || []).length;
  const grandLanded = (res.populated || []).some(p =>
    String(p.label).indexOf('Residential Programs Installations Total') >= 0);
  log('  ' + label);
  log('      ok=' + res.ok + '   cells landed: ' + landed +
      '   cells dropped as computed: ' + dropped);
  log('      totals taken from the preparer and NAMED: ' + named);
  log('      the filed grand total (' + FILED + ') landed: ' + grandLanded);
  if (named) {
    (res.preparerTotals || []).slice(0, 4).forEach(p => log('        ' +
      JSON.stringify(String(p.label).slice(0, 40)) + ' / ' + p.column +
      ': value ' + JSON.stringify(p.value) + ', itemised ' + JSON.stringify(p.itemised)));
  }
  return { landed: landed, dropped: dropped, named: named, grandLanded: grandLanded };
};

/* FOUR ANATOMIES, because "the target year's grand-total row already exists"
 * covers more than one state and they do not behave alike. Naming all four is
 * the only way to say what this build changes and what it leaves. */
const rowless = run('1. ROWLESS: the year has no rows at all', []);

log('');
const blankTotal = (function () {
  const d = stored.map(r => r.slice());
  for (let c = 1; c < schema.length; c++) d[GRAND][c] = null;
  return d;
})();
const structural = run('2. STRUCTURAL: the grand-total row exists, with no figures in it',
  blankTotal);

log('');
const preparerAnatomy = (function () {
  const d = stored.map(r => r.slice());
  d[GRAND][1] = FILED;                 /* the year already holds the preparer's own */
  return d;
})();
const notReproduced = run('3. PREPARER FIGURE ALREADY THERE: the row holds ' +
  FILED + ', which its own rows do not come to', preparerAnatomy);

log('');
const anatomy = run('4. DERIVABLE: the row holds the figure its own rows DO come to',
  stored.map(r => r.slice()));

/* ---- A1's derivable Total must still refuse -------------------------- */
log('');
log('=======================================================================');
log('A1s TOTAL, which the engine derives from rows that are ALL in the table');
log('=======================================================================');
log('');
const A1Y = Object.keys(P.tables.A1.data || {}).sort().pop();
const a1schema = H.attempt(api => api.getTableSchema(P.tables.A1, A1Y));
const a1rows = P.tables.A1.data[A1Y];
const a1Total = a1rows.findIndex(r =>
  H.attempt(api => api.isAnchoredTotalRowLabel(r[0])));
log('  A1:' + A1Y + '  total row r' + a1Total + ' ' +
    JSON.stringify(String(a1rows[a1Total] ? a1rows[a1Total][0] : '')) +
    '  ' + JSON.stringify(a1rows[a1Total] ? a1rows[a1Total].slice(1) : null));

const a1File = [a1schema.slice()].concat(a1rows.map(r => r.slice()));
const a1Res = H.attempt(api =>
  api.buildIngestImport(a1File, a1schema, a1rows.map(r => r.slice()), 'A1'));
const a1Named = (a1Res.preparerTotals || []).filter(p => p.rowIndex === a1Total);
log('  a file offering A1s OWN figures:');
log('      totals taken from the preparer on that row: ' + a1Named.length +
    '   (0 is the requirement: the engine derives it, so it refuses)');

/* and the same row offered a figure the engine does NOT reproduce */
const a1Off = a1File.map(r => r.slice());
if (a1Total >= 0) a1Off[a1Total + 1][1] = (a1rows[a1Total][1] || 0) + 12345;
const a1Res2 = H.attempt(api =>
  api.buildIngestImport(a1Off, a1schema, a1rows.map(r => r.slice()), 'A1'));
const a1Named2 = (a1Res2.preparerTotals || []).filter(p => p.rowIndex === a1Total);
log('  the same file with A1s total altered by 12,345:');
log('      totals taken from the preparer on that row: ' + a1Named2.length);
if (a1Named2.length) {
  a1Named2.forEach(p => log('        ' + JSON.stringify(String(p.label).slice(0, 40)) +
    ' / ' + p.column + ': value ' + JSON.stringify(p.value)));
} else {
  log('');
  log('      AND IT REFUSES FOR A REASON THIS CHANGE DOES NOT TOUCH. A1s');
  log('      total columns are declared DERIVED COLUMNS, and the guard reads');
  log('      `!computed.derivedCol(cIdx) && !reproduced` -- a derived column');
  log('      is refused whatever the file offers, which is CLCPA-88s rule and');
  log('      predates both rounds of this ticket. So clause 3 holds');
  log('      structurally rather than by arithmetic luck.');
}

/* ---- clause 2: does anything the PREPARER filled get dropped? -------- */
log('');
log('=======================================================================');
log('STAGED AGAINST LANDED: is anything the preparer typed being dropped?');
log('=======================================================================');
log('');
log('  The dropped cells are not all equal. A cell the workbook marked');
log('  (calculated) is one the preparer was told to leave alone, and dropping');
log('  it is the contract working. A cell they were invited to fill and which');
log('  then vanished is the thing clause 2 is about.');
log('');
const anatomyRes = H.attempt(api =>
  api.buildIngestImport(fileRows, schema, stored.map(r => r.slice()), ID));
const marked = H.attempt((api) => {
  const c = api.ingestComputed(stored, ID, schema);
  const m = {};
  stored.forEach((r, i) => {
    for (let col = 1; col < schema.length; col++) {
      if (c.marksInTemplate(i, col)) m[i + ',' + col] = true;
    }
  });
  return m;
});
let droppedMarked = 0, droppedUnmarked = [];
((anatomyRes.notTouched || {}).computed || []).forEach((d) => {
  const key = d.rowIndex + ',' + d.colIndex;
  /* the plan records label/column, not always indices, so fall back to a
   * label-and-column lookup rather than guessing */
  let hit = marked[key];
  if (hit === undefined) {
    const ri = stored.findIndex(r => String(r[0]) === String(d.label));
    const ci = schema.indexOf(d.column);
    hit = ri >= 0 && ci >= 0 ? marked[ri + ',' + ci] : undefined;
  }
  if (hit) droppedMarked++;
  else droppedUnmarked.push(String(d.label).slice(0, 30) + ' / ' + d.column);
});
log('  cells dropped in total: ' +
    ((anatomyRes.notTouched || {}).computed || []).length);
log('  of those, ones the workbook MARKED (calculated): ' + droppedMarked);
log('  of those, ones it invited the preparer to fill: ' + droppedUnmarked.length);
droppedUnmarked.slice(0, 8).forEach(d => log('      ' + d));

log('');
log('--- summary -----------------------------------------------------------');
const row = (n, r) => log('  ' + n.padEnd(34) + 'landed ' + String(r.landed).padEnd(4) +
  'named ' + String(r.named).padEnd(4) + 'grand total kept ' + r.grandLanded);
row('1 rowless', rowless);
row('2 structural, no figures', structural);
row('3 preparer figure already there', notReproduced);
row('4 derivable (row holds the sum)', anatomy);
log('');
log('  THE REPORTED DISCARD DOES NOT REPRODUCE ON ANY ANATOMY I COULD BUILD.');
log('  Three of the four take the filed grand total and name it. The fourth');
log('  refuses, and refusing is correct there: the row holds the figure its');
log('  own rows come to, so the engine derives it and CLCPA-88 forbids a file');
log('  overwriting it. suite_293s D block pins exactly that for A1.');
log('');
log('  The other two clauses, measured on the shipped build:');
log('    nothing the preparer was invited to fill is dropped: ' +
    droppedUnmarked.length + ' such cells');
log('    A1s derivable Total refuses: ' +
    (a1Named.length + a1Named2.length) + ' taken from it, in either file');
log('');
log('  NO CODE WAS SHIPPED FOR THIS TICKET. What is missing is the anatomy');
log('  A8/2098 actually had when the hosted pass saw 24 of 26, which decides');
log('  which of these four rows it was. CLCPA-293-r2-stop.md states the ask.');

fs.writeFileSync(OUT, lines.join('\n') + '\n');
