/* CLCPA-304: parseB2Plugs reads the SHARED schema reader.
 *
 * It took `(table.schema_by_year || {})[yr] || []` and fell to an EMPTY schema
 * for a year with no entry of its own. Every column index became -1 and every
 * plug count parsed as 0.
 *
 * REPRODUCED IN A BROWSER on the shipped build, with B2's rows present for an
 * imported 2099 (repro_304.js). Section B's tornado:
 *
 *   base   0 L2 plugs 0      0 DCFC 0      -100% plug growth
 *   fix    2,966 L2 plugs 4,516   170 DCFC 1,229
 *
 * The year is not hypothetical. app.js says so itself at the composed-layer
 * fallback: "a year created by import carries cr2bf_schema = null, so the
 * composed table has no schema_by_year entry for it". getTableSchema has
 * carried the newest-year fallback since CLCPA-244, and dacCol was pointed at
 * it in the CLCPA-240 follow-up for this same reason. This was the reader left
 * behind.
 *
 * Pins: DAC_BASE_COMMIT, DAC_APP_OVERRIDE.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-304-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || 'd84c0d3';
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const say = (s) => log(s);
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => {
  try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); }
};
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

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

const WANT = ['parseB2Plugs', 'getTableSchema'];
const NEW = harness(SRC, WANT), OLD = harness(BASE_SRC, WANT);

/* THE STATE AN IMPORT LEAVES: rows present, no schema entry of its own. */
function importedYear(year) {
  const B2 = JSON.parse(JSON.stringify(P.tables.B2));
  const donor = Object.keys(B2.data).sort().pop();
  B2.data[year] = B2.data[donor].map(r => r.slice());
  delete (B2.schema_by_year || {})[year];
  return { table: B2, donor: donor };
}

log('CLCPA-304: parseB2Plugs and the year with no schema of its own');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ===================== A: the imported year ============================ */
say('=== A. a year created by import ====================================');
guard('A: the plug counts come back', () => {
  const { table, donor } = importedYear('2099');
  const now = NEW.attempt(api => api.parseB2Plugs(table, '2099'));
  const was = OLD.attempt(api => api.parseB2Plugs(table, '2099'));
  const want = NEW.attempt(api => api.parseB2Plugs(table, donor));

  ok(JSON.stringify(now) === JSON.stringify(want),
     'A1 the imported year parses exactly as the year its rows came from: ' +
     JSON.stringify(now.Total));
  const zeros = Object.keys(was).length > 0 &&
    Object.keys(was).every(k => Object.keys(was[k]).every(kk => was[k][kk] === 0));
  ok(zeros,
     'A2 while BASE parsed every count as ZERO, which is the browser ' +
     'reproduction: ' + JSON.stringify(was.Total));
  /* the 5-column shape, which an oldest-year fallback would also lose */
  ok(now.DAC && now.DAC.Micromobility === 2,
     'A3 and the Micromobility column, which only 2025 has, is read: ' +
     JSON.stringify(now.DAC));
});

/* ===================== B: nothing stored moves ========================= */
say('');
say('=== B. every stored year is untouched ===============================');
guard('B: no regression on stored data', () => {
  const moved = [];
  Object.keys(P.tables.B2.data || {}).sort().forEach((y) => {
    const a = OLD.attempt(api => api.parseB2Plugs(P.tables.B2, y));
    const b = NEW.attempt(api => api.parseB2Plugs(P.tables.B2, y));
    if (JSON.stringify(a) !== JSON.stringify(b)) moved.push(y);
  });
  ok(moved.length === 0,
     'B1 the three stored years parse identically on both builds: ' +
     JSON.stringify(moved));
  /* a year that genuinely has NO rows still returns nothing, rather than
   * inventing a shape from the donor */
  const B2 = JSON.parse(JSON.stringify(P.tables.B2));
  ok(JSON.stringify(NEW.attempt(api => api.parseB2Plugs(B2, '1999'))) === '{}',
     'B2 and a year with no rows at all still returns nothing');
});

/* ===================== X: the shape and the baseline =================== */
say('');
say('=== X. one schema reader ============================================');
guard('X: structure', () => {
  const code = codeOnly(SRC);
  const fn = code.slice(code.indexOf('function parseB2Plugs'));
  const body = fn.slice(0, fn.indexOf('\r\n  }'));
  ok(/const schema = getTableSchema\(table, yr\) \|\| \[\];/.test(body),
     'X1 parseB2Plugs reads getTableSchema');
  ok(!/schema_by_year/.test(body),
     'X2 and has no second schema reader of its own left in it');
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X3 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: ROOT }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'X4 and HEAD descends from it');
  const oldFn = codeOnly(BASE_SRC).slice(codeOnly(BASE_SRC).indexOf('function parseB2Plugs'));
  ok(/schema_by_year/.test(oldFn.slice(0, oldFn.indexOf('\r\n  }'))),
     'X5 while BASE reads schema_by_year directly, so this suite cannot pass on it');
});

say('');
log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
if (fail) process.exit(1);
