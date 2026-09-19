const _dacRepo = () => {
  const p = require('path'), f = require('fs');
  if (process.env.DAC_REPO) return p.resolve(process.env.DAC_REPO);
  let d = __dirname;
  for (let i = 0; i < 16; i++) {
    if (f.existsSync(p.join(d, '.clcpa-root'))) {
      const two = p.resolve(d, '..', '..');
      return f.existsSync(p.join(two, '.git')) ? two : d;
    }
    const u = p.dirname(d); if (u === d) break; d = u;
  }
  throw new Error('CLCPA project root not found above ' + __dirname + '; set DAC_REPO');
};
/* CLCPA-270 -- CENSUS FIRST, by ruling. This measures; it changes nothing.
 *
 * The ticket says structure-row protection is implemented three different
 * ways. Before collapsing three predicates into one model, this counts what
 * each one actually locks across every stored table-year -- because
 * collapsing predicates on a READING rather than a measurement is exactly how
 * the isTotalRowLabel defect (CLCPA-200) reached production, where an
 * unanchored substring match blanked 30 real data cells.
 *
 * The three properties the editor decides per row, read out of the shipped
 * render code at app.js renderIngestEditor:
 *
 *   LABEL EDITABLE     not if isHeaderRow, and not if (col 0 and lockTotalRow)
 *   VALUES EDITABLE    not if isHeaderRow, derived column, readOnlyByName, or isTotal
 *   DELETABLE          not if isHeaderRow, lockTotalRow, or isTotal
 *
 * where
 *   isHeaderRow   = rowIdx < headerRowCount (from header_levels) OR a group
 *                   header in the hierarchical family
 *   isTotal       = totalRowFlags(...), which is VALUE-dependent: a row is a
 *                   total when the arithmetic confirms it sums its segment
 *   lockTotalRow  = isTotal AND hierarchical family AND not a header AND the
 *                   LABEL says total (CLCPA-240 round 3)
 *
 * Run:  node census_270.js
 */
const fs = require('fs');

const REPO = _dacRepo() + '';
const APP = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const PAYLOAD = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/payload.json';

const SRC = fs.readFileSync(APP, 'utf8');
const P = JSON.parse(fs.readFileSync(PAYLOAD, 'utf8'));

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

function api(want) {
  const L = SRC.split('\r\n'); const TOP = [];
  L.forEach((ln, n) => { const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n }); });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (n) => { const k = TOP.findIndex(d => d.name === n);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n'); };
  const parts = [], have = new Set();
  const add = (n) => { if (have.has(n)) return false; const f = find(n);
    if (!f) return false; have.add(n); parts.push(f); return true; };
  want.forEach(add);
  const make = () => new Function('const state={};' + parts.join('\n\n') +
    '\nreturn {' + want.join(',') + '};')();
  return (fn) => {
    for (let r = 0; r < 500; r++) {
      try { return fn(make()); }
      catch (e) { const m = /(\w+) is not defined/.exec(e.message);
        if (m && add(m[1])) continue; throw e; }
    }
    throw new Error('dependency resolution did not converge');
  };
}
const run = api(['totalRowFlags', 'isHierarchicalTotalLabel', 'isStrictTotalRowLabel',
  'HIERARCHICAL_TABLES', 'detectPctColumns', 'normIngestKey', 'DERIVED_COLS']);

log('======================================================================');
log('CLCPA-270 -- CENSUS of structure-row protection');
log('  read from the shipped app.js; nothing is changed');
log('======================================================================');

const rowsOf = (id, y) => ((P.tables[id].data || {})[y] || []);
const census = [];

run((a) => {
  Object.keys(P.tables).sort().forEach((id) => {
    const t = P.tables[id];
    Object.keys(t.schema_by_year || {}).sort().forEach((y) => {
      const schema = t.schema_by_year[y];
      const rows = rowsOf(id, y);
      if (!rows.length) return;

      const lv = t.header_levels;
      const headerRowCount = (typeof lv !== 'number' || lv < 2)
        ? 0 : Math.min(lv - 1, rows.length);
      const isHierFamily = !!a.HIERARCHICAL_TABLES[id];
      const rowHasNumber = (r) => Array.isArray(r) &&
        r.slice(1).some(v => typeof v === 'number' && isFinite(v));

      /* the group-header set, rebuilt exactly as the editor rebuilds it */
      const structural = rows.map(r => Array.isArray(r) && !rowHasNumber(r));
      const groupHeaderLabels = {};
      if (isHierFamily) {
        rows.forEach((r, idx) => {
          if (!structural[idx] || !Array.isArray(r) || r[0] == null) return;
          for (let k = idx + 1; k < rows.length && !structural[k]; k++) {
            if (rowHasNumber(rows[k])) { groupHeaderLabels[a.normIngestKey(r[0])] = true; return; }
          }
        });
      }
      const isGroupHeaderRow = (row) => isHierFamily && Array.isArray(row) &&
        !!groupHeaderLabels[a.normIngestKey(row[0])] && !rowHasNumber(row);

      const totalFlags = a.totalRowFlags(rows, id, schema);
      const derivedSet = new Set(((a.DERIVED_COLS[id]) || []).map(d => d.column));
      const readOnlyByName = {};
      (schema || []).forEach((h, idx) => {
        if (h != null && /^\s*%\s*change\s*$/i.test(String(h))) readOnlyByName[idx] = true;
      });

      rows.forEach((row, r) => {
        const isHeaderRow = r < headerRowCount || isGroupHeaderRow(row);
        const isTotal = !!totalFlags[r];
        const lockTotalRow = isTotal && isHierFamily && !isHeaderRow &&
          a.isHierarchicalTotalLabel(row[0]);
        census.push({
          id: id, year: y, row: r,
          label: String(row[0] == null ? '' : row[0]),
          hier: isHierFamily,
          headerRow: isHeaderRow,
          total: isTotal,
          lockTotal: !!lockTotalRow,
          strictTotalLabel: !!a.isStrictTotalRowLabel(row[0]),
          hierTotalLabel: !!a.isHierarchicalTotalLabel(row[0]),
          labelEditable: !isHeaderRow && !lockTotalRow,
          valuesEditable: !isHeaderRow && !isTotal,
          deletable: !isHeaderRow && !lockTotalRow && !isTotal,
          derivedCols: derivedSet.size,
          readOnlyCols: Object.keys(readOnlyByName).length,
        });
      });
    });
  });
});

log('');
log('SCALE');
log('  table-years measured : ' +
  new Set(census.map(c => c.id + ':' + c.year)).size);
log('  rows measured        : ' + census.length);

/* ---- the distinct protection STATES actually in use --------------------- */
const key = (c) => [c.labelEditable ? 'L+' : 'L-', c.valuesEditable ? 'V+' : 'V-',
  c.deletable ? 'D+' : 'D-'].join(' ');
const states = {};
census.forEach((c) => { (states[key(c)] = states[key(c)] || []).push(c); });

log('');
log('DISTINCT PROTECTION STATES IN USE  (L=label V=values D=deletable, +=open)');
Object.keys(states).sort().forEach((k) => {
  const g = states[k];
  const tables = Array.from(new Set(g.map(c => c.id))).sort();
  log('  ' + k + '   ' + String(g.length).padStart(5) + ' rows   ' +
    tables.length + ' tables   ' + tables.slice(0, 10).join(',') +
    (tables.length > 10 ? ' ...' : ''));
});

/* ---- the question the ticket is really asking --------------------------- */
log('');
log('ROWS WHOSE LABEL SAYS "TOTAL" (the strict classifier), by treatment');
const totalish = census.filter(c => c.strictTotalLabel);
const tStates = {};
totalish.forEach((c) => { (tStates[key(c)] = tStates[key(c)] || []).push(c); });
log('  rows with a total LABEL: ' + totalish.length);
Object.keys(tStates).sort().forEach((k) => {
  const g = tStates[k];
  const tables = Array.from(new Set(g.map(c => c.id))).sort();
  log('  ' + k + '   ' + String(g.length).padStart(5) + ' rows   ' +
    tables.length + ' tables   ' + tables.slice(0, 12).join(',') +
    (tables.length > 12 ? ' ...' : ''));
});

/* THE DISAGREEMENT. Same structural role -- the label says total -- and a
 * different lock. This is what an owner ruling would have to settle. */
log('');
log('DISAGREEMENT 1: rows whose label says TOTAL but which are fully OPEN');
const openTotals = totalish.filter(c => c.labelEditable && c.valuesEditable && c.deletable);
log('  count: ' + openTotals.length);
Array.from(new Set(openTotals.map(c => c.id + '  ' + c.label)))
  .sort().slice(0, 18).forEach(s => log('    ' + s));
if (new Set(openTotals.map(c => c.id + '  ' + c.label)).size > 18) log('    ...');

log('');
log('DISAGREEMENT 2: the SAME table-row open in one year and locked in another');
const byRow = {};
census.forEach((c) => {
  const k2 = c.id + '|' + c.label;
  (byRow[k2] = byRow[k2] || []).push(c);
});
const flipped = Object.keys(byRow).filter((k2) => {
  const g = byRow[k2];
  return new Set(g.map(key)).size > 1;
});
log('  labels whose treatment CHANGES between years: ' + flipped.length);
flipped.slice(0, 14).forEach((k2) => {
  const g = byRow[k2];
  log('    ' + k2.replace('|', '  ') + '   ' +
    g.map(c => c.year + ':' + key(c)).join('   '));
});
if (flipped.length > 14) log('    ...');

log('');
log('DISAGREEMENT 3: the hierarchical family against the flat tables');
const hierTotals = totalish.filter(c => c.hier);
const flatTotals = totalish.filter(c => !c.hier);
const lockedH = hierTotals.filter(c => !c.labelEditable).length;
const lockedF = flatTotals.filter(c => !c.labelEditable).length;
log('  hierarchical family : ' + hierTotals.length + ' total-labelled rows, ' +
  lockedH + ' with a LOCKED label');
log('  flat tables         : ' + flatTotals.length + ' total-labelled rows, ' +
  lockedF + ' with a LOCKED label');
log('  -> the label lock is available ONLY to the hierarchical family;');
log('     a flat table\'s total label is always editable, whatever its role.');

log('');
log('DISAGREEMENT 4: value-locked but still deletable, or the reverse');
const oddA = census.filter(c => !c.valuesEditable && c.deletable);
const oddB = census.filter(c => c.valuesEditable && !c.deletable && !c.headerRow);
log('  values LOCKED but row DELETABLE : ' + oddA.length);
log('  values OPEN but row NOT deletable: ' + oddB.length +
  (oddB.length ? '  e.g. ' + Array.from(new Set(oddB.map(c => c.id + ' ' + c.label))).slice(0, 4).join('; ') : ''));

/* ---- what a unified model would have to decide -------------------------- */
log('');
log('======================================================================');
log('WHAT A UNIFIED MODEL WOULD HAVE TO DECIDE');
log('======================================================================');
log('  1. Is a total row\'s LABEL structure in a FLAT table, as it already is');
log('     in the hierarchical family? Today it is not, and that is the single');
log('     largest source of the "three different ways" in the ticket.');
log('  2. Should DELETABILITY follow the same rule as the label lock? Today a');
log('     row can be value-locked and still deletable (' + oddA.length + ' rows).');
log('  3. isTotal is VALUE-dependent: it is arithmetic confirmation, not a');
log('     structural fact, so a row\'s protection changes as its numbers');
log('     change. ' + flipped.length + ' labels already differ between years.');
log('     A structural model would have to choose between the label (stable,');
log('     and what CLCPA-240 round 3 fell back to) and the arithmetic');
log('     (accurate on well-formed data, wrong on a half-filled draft).');
log('  4. CLCPA-205 item 2 (the all-totals tables) is still pending and would');
log('     be decided by the same ruling.');

const out = { measuredAt: 'census only, no code changed', rows: census.length,
  states: Object.keys(states).map(k => ({ state: k, rows: states[k].length })),
  openTotals: openTotals.length, flippedLabels: flipped.length,
  valueLockedButDeletable: oddA.length };
fs.writeFileSync(__dirname + '/census-270-summary.json', JSON.stringify(out, null, 2) + '\n');
fs.writeFileSync(__dirname + '/census-270-output.txt', lines.join('\n') + '\n');
