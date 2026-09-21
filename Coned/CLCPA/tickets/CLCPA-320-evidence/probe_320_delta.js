/* CLCPA-320, THE DELTA: every cell in the payload whose workbook marker moves.
 *
 * "Declare every surface each relationship touches" -- so this does not check
 * the G board and call it done. It walks EVERY table and EVERY stored year,
 * and the same tables again with their figures emptied (the state a preparer
 * downloads a fresh template in), and reports every cell where marksInTemplate
 * answers differently on the two builds.
 *
 * Both builds are executed. Neither side is re-implemented here.
 *
 *   node probe_320_delta.js                 working tree vs DAC_BASE_COMMIT
 *   DAC_BASE_COMMIT=<sha> node probe_320_delta.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const BASE = process.env.DAC_BASE_COMMIT || 'd84c0d3';
const SRC = fs.readFileSync(path.join(DEV, 'app.js'), 'utf8');
/* CRLF: a git blob is LF and every anchor in this harness is CRLF */
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'probe-320-delta-output.txt');

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

const WANT = ['ingestComputed', 'getTableSchema', 'isAnchoredTotalRowLabel'];

/* THREE BUILDS, because the working tree carries three tickets and a two-way
 * delta would hand CLCPA-308's Section D rows to CLCPA-320. MID is the working
 * tree with THIS ticket's clause reverted and nothing else, so:
 *
 *   NEW vs MID   is CLCPA-320, alone
 *   MID vs OLD   is everything else in the tree, named and separated
 *
 * The revert is a string replacement on this ticket's own line, and it is
 * asserted to hit exactly once -- a silent miss would make CLCPA-320 look
 * like it changed nothing at all. */
/* the clause as it stands after the pre-merge amendment: role AND
 * derivability. Reverting it to the arithmetic term alone is what isolates
 * this ticket from everything else in the tree. */
const C320_NEW = '((!!totals[r] || !!totalRole[r]) && engineDerives(r, c) &&\r\n' +
  '             (!!derived[c] || engineWrites(c)))';
const C320_OLD = '(!!totals[r] && (!!derived[c] || engineWrites(c)))';
const hits = SRC.split(C320_NEW).length - 1;
if (hits !== 1) {
  console.error('probe_320_delta: the CLCPA-320 clause matched ' + hits +
    ' times, expected 1. Refusing to report an attribution it cannot make.');
  process.exit(1);
}
const MID_SRC = SRC.replace(C320_NEW, () => C320_OLD);

const NEW = harness(SRC, WANT), OLD = harness(BASE_SRC, WANT),
      MID = harness(MID_SRC, WANT);

/* every accessor call inside attempt, so a missing closure is resolved rather
 * than thrown (the limit of a hand-fed slice) */
function marks(H, rows, id, schema) {
  return H.attempt((api) => {
    const c = api.ingestComputed(rows, id, schema);
    const out = [];
    rows.forEach((r, i) => {
      const row = [];
      for (let col = 1; col < (schema || []).length; col++) {
        if (c.marksInTemplate(i, col)) row.push(col);
      }
      out.push({ marks: row, any: !!c.any(i, 1), total: !!c.totalRow(i) });
    });
    return out;
  });
}

log('CLCPA-320 DELTA: every workbook marker that moves');
log('BASE ' + BASE + '  vs the working tree');
log('');

let cells = 0;
const acc = {
  '320': { rows: 0, any: 0, byTable: {}, anyRows: [] },
  'other': { rows: 0, any: 0, byTable: {}, anyRows: [] },
};

function compare(bucket, A, B, label, id, y, rows, schema) {
  const a = marks(A, rows, id, schema);
  const b = marks(B, rows, id, schema);
  rows.forEach((r, i) => {
    const before = (a[i] || {}).marks || [], after = (b[i] || {}).marks || [];
    if (bucket === '320') cells += Math.max(before.length, after.length);
    const gained = after.filter(c => before.indexOf(c) < 0);
    const lost = before.filter(c => after.indexOf(c) < 0);
    const acc2 = acc[bucket];
    if (gained.length || lost.length) {
      acc2.rows++;
      (acc2.byTable[id] = acc2.byTable[id] || []).push(
        label + ' ' + y + ' r' + i + ' ' + JSON.stringify(String(r[0]).slice(0, 30)) +
        '  +' + JSON.stringify(gained) + ' -' + JSON.stringify(lost));
    }
    if ((a[i] || {}).any !== (b[i] || {}).any) {
      acc2.any++;
      acc2.anyRows.push(id + ':' + label + ':' + y + ' r' + i);
    }
  });
}

function walk(label, getRows) {
  Object.keys(P.tables).sort().forEach((id) => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach((y) => {
      const rows = getRows(t, y);
      if (!rows || !rows.length) return;
      const schema = NEW.attempt(api => api.getTableSchema(t, y));
      compare('320', MID, NEW, label, id, y, rows, schema);
      compare('other', OLD, MID, label, id, y, rows, schema);
    });
  });
}

walk('stored', (t, y) => t.data[y]);
walk('BLANK', (t, y) => (t.data[y] || []).map(r => r.map((v, c) => (c === 0 ? v : null))));

log('=======================================================================');
log('  CLCPA-320 ALONE  (the working tree against itself with this ticket');
log('  reverted, so nothing else in the tree can be credited to it)');
log('=======================================================================');
Object.keys(acc['320'].byTable).sort().forEach((id) => {
  log('=== ' + id);
  acc['320'].byTable[id].forEach(l => log('    ' + l));
});

log('');
log('=======================================================================');
log('  EVERYTHING ELSE IN THE TREE  (CLCPA-308 and CLCPA-319), separated so');
log('  that no moved cell in this report is left unattributed');
log('=======================================================================');
Object.keys(acc.other.byTable).sort().forEach((id) => {
  log('=== ' + id + '   (' + acc.other.byTable[id].length + ' rows)');
  acc.other.byTable[id].slice(0, 3).forEach(l => log('    ' + l));
  if (acc.other.byTable[id].length > 3) log('    ... and ' + (acc.other.byTable[id].length - 3) + ' more');
});

log('');
log('--- summary -----------------------------------------------------------');
log('  marker cells compared (stored years and blank years): ' + cells);
log('  CLCPA-320: rows whose MARKER set moves: ' + acc['320'].rows);
log('  CLCPA-320: rows whose IMPORT SKIP moves: ' + acc['320'].any +
    (acc['320'].anyRows.length ? '  ' + JSON.stringify(acc['320'].anyRows.slice(0, 10)) : ''));
log('  the rest of the tree: marker rows ' + acc.other.rows +
    ', import-skip rows ' + acc.other.any);
log('');
log('  CLCPA-320s import-skip figure must be ZERO. CLCPA-272 ruled that a');
log('  provided value is accepted and reconciled, never rejected, so widening');
log('  what the importer refuses would start discarding figures preparers');
log('  actually filed. This ticket changes the workbook GUIDANCE and nothing');
log('  else. The import-skip rows in the other bucket are CLCPA-308s Section D');
log('  percentage rows, which the engine genuinely computes and which that');
log('  ticket exists to register.');

fs.writeFileSync(OUT, lines.join('\n') + '\n');
