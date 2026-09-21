/* CLCPA-304: parseB2Plugs has no newest-year schema fallback.
 *
 * getTableSchema has carried one since CLCPA-244, and its own comment says
 * why: a brand-new year has no schema_by_year entry, and taking
 * Object.keys(...)[0] hands back the OLDEST year's shape. parseB2Plugs does
 * not fall back at all -- it takes `(table.schema_by_year || {})[yr] || []`,
 * so a new year gets an EMPTY schema, every colOf() returns -1, and every
 * plug count parses as 0.
 *
 * This measures what each of the two readers says for a year that does not
 * exist yet, and what Section B therefore renders.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'probe-304-freshyear-output.txt');

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

const H = harness(SRC, ['parseB2Plugs', 'getTableSchema']);

log('CLCPA-304: what the two schema readers say for a year with no schema');
log('app.js: ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* A FRESH YEAR AS THE APP MAKES ONE: rows exist (the operator imported or
 * typed them) and schema_by_year has no entry yet. 2099 is used here and is
 * never written anywhere -- this is a copy of the table, in memory. */
const B2 = JSON.parse(JSON.stringify(P.tables.B2));
const donor = Object.keys(B2.data).sort().pop();
B2.data['2099'] = B2.data[donor].map(r => r.slice());
/* schema_by_year deliberately NOT given a 2099 entry */

log('  the fresh year 2099 carries ' + B2.data['2099'].length + ' rows copied from ' +
    donor + ', and no schema entry of its own.');
log('');

['2025', '2099'].forEach((y) => {
  const viaGetTableSchema = H.attempt(api => api.getTableSchema(B2, y));
  const viaParse = (B2.schema_by_year || {})[y] || [];
  log('  ' + y);
  log('      getTableSchema  -> ' + JSON.stringify(viaGetTableSchema));
  log('      parseB2Plugs\'s own read -> ' + JSON.stringify(viaParse));
  const plugs = H.attempt(api => api.parseB2Plugs(B2, y));
  log('      parseB2Plugs    -> ' + JSON.stringify(plugs));
  const tot = (plugs && plugs.Total) || {};
  log('      Section B would show Total plugs = ' + JSON.stringify(tot.Total) +
      ', L2 = ' + JSON.stringify(tot.L2) + ', DCFC = ' + JSON.stringify(tot.DCFC));
  log('');
});

const fresh = H.attempt(api => api.parseB2Plugs(B2, '2099'));
const allZero = Object.keys(fresh).length > 0 &&
  Object.keys(fresh).every(k => Object.keys(fresh[k])
    .every(kk => fresh[k][kk] === 0));
log('--- summary -----------------------------------------------------------');
log('  the fresh year parses every plug count as zero: ' + allZero);
log('  while the very same rows, read through getTableSchema, carry the ' +
    B2.data['2099'].reduce((m, r) => Math.max(m, r.length), 0) + ' columns they always had.');

fs.writeFileSync(OUT, lines.join('\n') + '\n');
