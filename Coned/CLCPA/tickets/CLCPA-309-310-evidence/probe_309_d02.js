/* CLCPA-309 / D-02: the fraction advisory reports a conversion result that is
 * then overwritten by recomputation.
 *
 * FROM THE TICKET, verbatim in substance: importing "22.4%" into a percentage
 * row, the advisory says "22.4% read as 0.22399999999999998" while the value
 * written to the draft is the recomputed quotient 0.2239130434782609, which is
 * 412/1840. The number the advisory names never exists in the data at any
 * point. The advisory is the operator's only feedback on these cells and it
 * describes an outcome that did not happen.
 *
 * THE GATE the ticket sets: after the D-01 fix (CLCPA-308, which registers
 * percentage rows as computed), importing a percentage into a percentage row
 * must produce EITHER no fraction advisory OR one that truthfully describes
 * the computed outcome.
 *
 * This measures all three numbers on the current build: what the advisory
 * says, what the draft holds after the import, and what it holds after the
 * recompute that follows.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'probe-309-d02-output.txt');

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

const H = harness(SRC, ['buildIngestImport', 'getTableSchema', 'ingestComputed',
  'recomputeTotals', 'DERIVED_ROWS', 'derivedRowValue', 'derivedRowKeepsStored',
  'parseNumericInput', 'unitNoticeValue', 'detectPctColumns', 'rowsForDisplay']);

log('CLCPA-309 / D-02: what the advisory says against what the cell holds');
log('app.js: ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

const TYPED = '22.4%';

['D2', 'D3', 'D4'].forEach((id) => {
  const t = P.tables[id];
  const year = Object.keys(t.data || {}).sort().pop();
  const rows = t.data[year];
  const schema = H.attempt(api => api.getTableSchema(t, year));
  const drows = H.attempt(api => (api.DERIVED_ROWS[id] || []).map(d => d.row));
  if (!drows.length) return;
  const pr = drows[0];

  log('=== ' + id + ':' + year + '  percentage row r' + pr + ' ' +
      JSON.stringify(String(rows[pr][0]).slice(0, 40)));
  log('    stored: ' + JSON.stringify(rows[pr]));

  /* the file a preparer files, with a percentage typed into that row */
  const file = [schema.slice()].concat(rows.map(r => r.slice()));
  file[pr + 1] = file[pr + 1].slice();
  file[pr + 1][1] = TYPED;

  const res = H.attempt(api => api.buildIngestImport(file, schema, rows.map(r => r.slice()), id));
  const notices = (res.unitNotices || []).filter(n =>
    String(n.label).indexOf(String(rows[pr][0]).slice(0, 20)) >= 0);
  const marked = H.attempt(api => api.ingestComputed(rows, id, schema).marksInTemplate(pr, 1));
  const skipped = H.attempt(api => api.ingestComputed(rows, id, schema).any(pr, 1));

  log('    the workbook MARKS that cell (calculated): ' + marked);
  log('    the import SKIPS it: ' + skipped);
  log('    fraction advisory raised on it: ' + notices.length);
  notices.forEach((n) => {
    const shown = H.attempt(api => (api.unitNoticeValue
      ? api.unitNoticeValue(n.read, n.landed) : String(n.landed)));
    log('        says: "' + n.read + ' read as ' + shown + '"');
  });

  /* what the cell actually holds: after the import, and after the recompute
   * the editor runs on every change */
  const cand = res.candidate;
  if (cand) {
    log('    the draft holds, straight after the import : ' +
        JSON.stringify(cand[pr][1]));
    const after = cand.map(r => r.slice());
    H.attempt(api => api.recomputeTotals(after, schema, id, rows.map(r => r.slice())));
    log('    and after the recompute                    : ' +
        JSON.stringify(after[pr][1]));
    const shown = H.attempt(api => api.rowsForDisplay(after, schema, id, { fillTotals: true }));
    log('    and what the REPORT PAGE would show        : ' +
        JSON.stringify(shown[pr][1]));
  }
  log('');
});

log('--- the gate ----------------------------------------------------------');
log('  The ticket accepts EITHER: no fraction advisory on these cells, OR an');
log('  advisory that truthfully describes the computed outcome. The three');
log('  numbers above are what decides which of those the build delivers.');

fs.writeFileSync(OUT, lines.join('\n') + '\n');
