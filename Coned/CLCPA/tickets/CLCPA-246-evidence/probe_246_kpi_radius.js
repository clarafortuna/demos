/* CLCPA-246: A REGRESSION I THOUGHT CLCPA-319 INTRODUCED, AND DID NOT.
 *
 * main_replacement reads G1's "Systemwide Total" cell and falls back to
 * summing G2/G4/G6/G8 when it is not a number:
 *
 *     const t = dacCell(T, 'G1', y, /^Systemwide Total$/i, /^Feet Replaced$/i);
 *     if (typeof t === 'number' && ...) return { total: t, dac: d };
 *     const B = ['G2', 'G4', 'G6', 'G8'];      <- otherwise four boroughs
 *
 * CLCPA-319 makes that cell derived and STRIPS it on persist, so the stored
 * cell is null after any save. Feeding the rule the RAW stored tables, as
 * this probe does below, the Executive Summary goes from 430,538 / 202,384
 * to 416,717 / 193,384 -- not missing, wrong, and silently.
 *
 * THE APP NEVER FEEDS IT THE RAW TABLES. recomputeYearDerived calls every
 * rule with dacDerivedTablesForYear, which has always passed the rows through
 * rowsForDisplay, and the columnTotal write is not gated by the fillTotals
 * opt-in. Through that path the figure is 430,538 / 202,384 on the stripped
 * year and 10,998 / 9,999 on a value-less imported one, with or without any
 * change to the accessor. A candidate fix in dacCell was written, measured to
 * change nothing on the real path, and REMOVED.
 *
 * So this file is kept as what it is: the measurement that would matter if
 * any consumer ever read the stored rows directly, and the record that the
 * KPI layer does not. The 3 "moved" rows below are the reason a general
 * display-view route was not taken either -- it moves published figures.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
/* THE PRE-CHANGE BUILD, because the only comparison that answers "does this
 * stack move a published KPI" is the real path on BOTH builds. Comparing the
 * real path against payload.kpis does not: those are STORED figures and three
 * of them are already stale against their own tables, which is CLCPA-238's
 * finding and nothing to do with this ticket. */
const BASE = process.env.DAC_BASE_COMMIT || 'd84c0d3';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'probe-246-kpi-radius-output.txt');

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

const H = harness(SRC, ['DAC_KPI_REPORTED', 'getTableSchema', 'rowsForDisplay',
  'stripDerivedForPersist', 'dacCell', 'dacBody',
  /* same reason: dacCell's fallback catches, so these cannot be discovered */
  'dacRow', 'dacCol',
  /* THE REAL PATH, called rather than re-implemented. Both KPI call sites --
   * recomputeYearDerived at the edit, composePayloadFromRows at the compose --
   * hand the rules the output of this, never the stored tables. */
  'dacDerivedTablesForYear']);
const B = harness(BASE_SRC, ['DAC_KPI_REPORTED', 'getTableSchema', 'rowsForDisplay',
  'stripDerivedForPersist', 'dacCell', 'dacBody', 'dacRow', 'dacCol',
  'dacDerivedTablesForYear']);

const YEARS = Array.from(new Set(Object.keys(P.tables).reduce((a, id) =>
  a.concat(Object.keys(P.tables[id].data || {})), []))).sort();
const KPIS = H.attempt(api => Object.keys(api.DAC_KPI_REPORTED || {}));

log('CLCPA-246 second half: the KPI layer against the derive engine');
log('app.js: ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* every table's rows AS SAVED, which is what storage holds after an edit */
function savedTables(api) {
  const T = JSON.parse(JSON.stringify(P.tables));
  Object.keys(T).forEach((id) => {
    Object.keys(T[id].data || {}).forEach((y) => {
      const rows = T[id].data[y];
      if (!rows || !rows.length) return;
      const schema = api.getTableSchema(T[id], y);
      T[id].data[y] = api.stripDerivedForPersist(rows.map(r => r.slice()), id, schema);
    });
  });
  return T;
}
/* and the same rows through the DISPLAY VIEW, which is what the report shows */
function displayedTables(api, from) {
  const T = JSON.parse(JSON.stringify(from));
  Object.keys(T).forEach((id) => {
    Object.keys(T[id].data || {}).forEach((y) => {
      const rows = T[id].data[y];
      if (!rows || !rows.length) return;
      const schema = api.getTableSchema(T[id], y);
      T[id].data[y] = api.rowsForDisplay(rows, schema, id, { fillTotals: true });
    });
  });
  return T;
}

log('=== every KPI, every year: payload, after a save, and displayed =====');
log('');
/* DECLARED, NOT ACCUMULATED, out here. The assembler re-runs its callback
 * every time it resolves another ReferenceError, so a counter incremented
 * inside it and declared outside counts the same grid several times. This
 * file reported 54 KPI-years for a 36-cell grid until the totals were moved
 * inside and handed back as a result. */
let broken = 0, healed = 0, moved = 0, checked = 0, realMoved = 0;
let brokenList = [], movedList = [], realList = [];

/* The pre-change build's real path, saved with ITS OWN strip: CLCPA-319
 * changed what persists as well as what displays, so each build has to be
 * asked the whole question in its own terms. */
const baseReal = {};
B.attempt((api) => {
  const saved = savedTables(api);
  KPIS.forEach((k) => {
    if (!api.DAC_KPI_REPORTED[k]) return;
    YEARS.forEach((y) => {
      baseReal[k + ':' + y] = JSON.stringify(api.DAC_KPI_REPORTED[k](
        api.dacDerivedTablesForYear({ tables: saved }, y), y));
    });
  });
  return null;
});

const TALLY = H.attempt((api) => {
  /* every counter re-zeroed inside the retrying callback, and handed back */
  broken = 0; healed = 0; moved = 0; checked = 0; realMoved = 0;
  brokenList = []; movedList = []; realList = [];
  const asSaved = savedTables(api);
  const asShown = displayedTables(api, asSaved);
  KPIS.forEach((k) => {
    YEARS.forEach((y) => {
      const fromPayload = api.DAC_KPI_REPORTED[k](P.tables, y);
      const fromSaved = api.DAC_KPI_REPORTED[k](asSaved, y);
      const fromShown = api.DAC_KPI_REPORTED[k](asShown, y);
      /* THE PATH THE APP ACTUALLY TAKES: the saved rows, through the real
       * accessor, exactly as recomputeYearDerived feeds them. */
      const fromReal = api.DAC_KPI_REPORTED[k](
        api.dacDerivedTablesForYear({ tables: asSaved }, y), y);
      const s = (x) => JSON.stringify(x);
      if (s(fromPayload) === '{}' || fromPayload == null) return;
      checked++;
      if (s(fromReal) !== baseReal[k + ':' + y]) {
        realMoved++;
        realList.push(k + ':' + y + '  before ' + baseReal[k + ':' + y] +
          '  after ' + s(fromReal));
      }
      if (s(fromSaved) !== s(fromPayload)) {
        broken++;
        brokenList.push(k + ':' + y + '  payload ' + s(fromPayload) +
          '  after a save ' + s(fromSaved));
        if (s(fromShown) === s(fromPayload)) healed++;
      }
      if (s(fromShown) !== s(fromPayload) && s(fromSaved) === s(fromPayload)) {
        moved++;
        movedList.push(k + ':' + y + '  payload ' + s(fromPayload) +
          '  displayed ' + s(fromShown));
      }
    });
  });
  return { checked: checked, broken: broken, realMoved: realMoved };
});

log('  KPI-years measured: ' + TALLY.checked);
log('');
log('  BROKEN BY THE SAVE (the stored cell is gone, the KPI reads storage): ' + broken);
brokenList.slice(0, 12).forEach(b => log('    ' + b));
if (brokenList.length > 12) log('    ... and ' + (brokenList.length - 12) + ' more');
log('');
log('  of those, HEALED by reading the display view instead: ' + healed +
    ' of ' + broken);
log('');
log('  KPI-years the display view would MOVE that the save does not break: ' + moved);
movedList.slice(0, 12).forEach(m => log('    ' + m));
if (movedList.length > 12) log('    ... and ' + (movedList.length - 12) + ' more');

log('');
log('  THE FIGURE THAT DECIDES THIS TICKET. Each build saved with its own');
log('  strip and read through its own dacDerivedTablesForYear, which is how');
log('  both KPI call sites feed the rules. KPI-years that move, ' + BASE);
log('  against the working tree: ' + realMoved);
realList.slice(0, 12).forEach(m => log('    ' + m));
if (realList.length > 12) log('    ... and ' + (realList.length - 12) + ' more');

log('');
log('--- summary -----------------------------------------------------------');
log('  A RETRACTION, kept in the file that made the claim.');
log('');
log('  The ' + broken + ' line above is real but it is NOT a regression, and an');
log('  earlier run of this probe said it was. It is measured by calling the');
log('  KPI rule with the RAW stored tables. Nothing in the app does that:');
log('  recomputeYearDerived and composePayloadFromRows both call the rules');
log('  with dacDerivedTablesForYear, which has always passed the rows through');
log('  rowsForDisplay. The line measures a caller that does not exist.');
log('');
log('  The figure that decides it is the one directly above: ' + realMoved +
    ' KPI-years move');
log('  on the real path, this build against ' + BASE + '. CLCPA-319 strips the');
log('  cell from storage and the display view puts it back before any rule');
log('  sees it, so the Executive Summary publishes what it published before.');
log('');
log('  The three strategic_capital lines in the MOVE count above are not');
log('  this stack moving anything. They are payload.kpis disagreeing with');
log('  its own tables, which is CLCPA-238s stored-copy finding, and they sit');
log('  identically on both builds -- which is why they do not appear here.');
log('');
log('  The other two counts are kept because they cost something to learn.');
log('  Reading the display view heals ' + healed + ' of the ' + broken +
    ' and moves ' + moved + ' others,');
log('  and those ' + moved + ' are why a general display-view route through the');
log('  accessor was written, measured, and then REMOVED: it would move');
log('  published figures to fix a path no caller takes.');

fs.writeFileSync(OUT, lines.join('\n') + '\n');
