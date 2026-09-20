/* CLCPA-308, THE SAFETY QUESTION the build has to answer before it lands.
 *
 * This ticket makes a DERIVED ROW register as computed. Doing that through
 * `any` also changes the IMPORT, because `any` is what the importer consults
 * to SKIP a cell -- and CLCPA-272 ruled that a provided value is accepted and
 * reconciled, never rejected.
 *
 * It would be harmless if the engine always overwrote those cells anyway. It
 * does not: derivedRowKeepsStored KEEPS a stored figure that merely adds
 * precision to the computed one, or that rounds to it and sits within 2%. A
 * cell like that is a figure the report publishes AS FILED -- so skipping it
 * on import would drop a number the dashboard would otherwise show.
 *
 * So the question is a count, not an opinion: across the payload, how many
 * derived-row cells hold a stored figure the engine KEEPS?
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'probe-308-keeps-output.txt');

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

const H = harness(SRC, ['DERIVED_ROWS', 'derivedRowKeepsStored', 'derivedRowValue',
  'getTableSchema', 'ingestComputed']);

log('CLCPA-308: how many derived-row cells hold a figure the engine KEEPS?');
log('app.js: ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

let cells = 0, kept = 0, skipped = 0;
const keptCells = [];

const tables = H.attempt(api => Object.keys(api.DERIVED_ROWS || {}));
log('tables with declared derived rows: ' + JSON.stringify(tables));
log('');

tables.forEach((id) => {
  const t = P.tables[id];
  if (!t) return;
  Object.keys(t.data || {}).sort().forEach((y) => {
    const rows = t.data[y];
    if (!rows || !rows.length) return;
    const schema = H.attempt(api => api.getTableSchema(t, y));
    H.attempt((api) => {
      const computed = api.ingestComputed(rows, id, schema);
      (api.DERIVED_ROWS[id] || []).forEach((d) => {
        const r = rows[d.row];
        if (!r) return;
        for (let c = 1; c < (schema || []).length; c++) {
          const stored = r[c];
          if (stored == null || stored === '') continue;
          const v = api.derivedRowValue(rows, d, c, schema);
          const held = api.derivedRowKeepsStored(stored, v);
          cells++;
          if (held && held.keep) {
            kept++;
            keptCells.push(id + ':' + y + ' r' + d.row + 'c' + c + ' filed=' +
              JSON.stringify(stored) + ' computed=' + JSON.stringify(v));
          }
          /* and would the IMPORT skip it as this build stands? */
          if (computed.any(d.row, c)) skipped++;
        }
      });
      return null;
    });
  });
});

log('--- summary -----------------------------------------------------------');
log('  derived-row cells holding a stored figure: ' + cells);
log('  of those, cells the engine KEEPS as filed: ' + kept);
log('  of those, cells this build would have the IMPORT skip: ' + skipped);
log('');
if (kept) {
  log('  THE KEPT ONES, which are figures the report publishes as filed and');
  log('  which an import would therefore have to carry, not discard:');
  keptCells.slice(0, 40).forEach(k => log('    ' + k));
  if (keptCells.length > 40) log('    ... and ' + (keptCells.length - 40) + ' more');
} else {
  log('  NONE. Every derived-row cell in the payload is recomputed rather than');
  log('  kept, so widening the import skip to cover these rows cannot drop a');
  log('  figure the dashboard would have published.');
}

fs.writeFileSync(OUT, lines.join('\n') + '\n');
