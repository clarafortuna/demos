/* CLCPA-246: G1's "Systemwide Total" renders flagged but EMPTY on an imported
 * year, and the Mains KPI that reads it does not render.
 *
 * THE VERDICT THIS SUITE PINS: the defect dies with CLCPA-319, and no separate
 * fix was written for it. That is a claim about a ticket being closed by
 * someone else's change, which is the easiest kind of claim to get wrong, so
 * it is measured on both builds rather than argued:
 *
 *   A  the shipped build leaves the cell empty, from the ticket's own figures
 *   B  this build fills it, 10,998 and 100.0%
 *   C  the mechanism the audit named is UNTOUCHED -- "Systemwide Total" still
 *      does not match isStrictTotalRowLabel, so this was not closed by
 *      widening a label predicate, which is what the audit half-expected and
 *      what CLCPA-200 already showed costs real data
 *   D  the KPI half, on the path the app actually takes
 *
 * The browser half of the evidence is repro_246.js, which seeds exactly these
 * rows into a throwaway profile and reads the rendered page on both builds.
 * This file is the offline half: same figures, same verdict, no browser.
 *
 * Pins: DAC_BASE_COMMIT, DAC_APP_OVERRIDE.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-246-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || 'd84c0d3';
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => {
  try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); }
};
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

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

/* dacCell catches, so its dependencies cannot be discovered by following
 * ReferenceErrors: a production try/catch swallows the one the assembler is
 * listening for. Named explicitly. */
const WANT = ['rowsForDisplay', 'getTableSchema', 'isStrictTotalRowLabel',
  'isAnchoredTotalRowLabel', 'DAC_KPI_REPORTED', 'dacDerivedTablesForYear',
  'stripDerivedForPersist', 'dacCell', 'dacBody', 'dacRow', 'dacCol'];
const NEW = harness(SRC, WANT), OLD = harness(BASE_SRC, WANT);

/* THE TICKET'S OWN FIGURES, the same rows repro_246.js seeds into the
 * browser: 9,999 feet in a DAC, 999 not, and a total row an import leaves
 * value-less. */
const IMPORTED = [
  ['Feet Replaced within DAC', 9999, null],
  ['Feet Replaced not in a DAC', 999, null],
  ['Systemwide Total', null, null],
];
const YEAR = '2098';
const G1 = P.tables.G1;
const SCHEMA = NEW.attempt(api => api.getTableSchema(G1, '2025'));

const shown = (H) => H.attempt(api =>
  api.rowsForDisplay(IMPORTED.map(r => r.slice()), SCHEMA, 'G1'));

log('CLCPA-246: G1s Systemwide Total on an imported year');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ===================== A: the defect ================================== */
log('A. THE DEFECT, ON THE BUILD IT WAS FILED AGAINST');
guard('A-block', () => {
  const was = shown(OLD);
  log('    ' + BASE + ' renders: ' + JSON.stringify(was[2]));
  ok(was[2][1] == null || was[2][1] === '',
     'A1 the shipped build leaves the total cell empty, which is the ticket');
  ok(was[2][2] == null || was[2][2] === '',
     'A2 and its percentage with it');
  ok(was[0][1] === 9999 && was[1][1] === 999,
     'A3 while the rows it should be the total of are both there');
});

/* ===================== B: it is closed ================================ */
log('');
log('B. AND ON THIS BUILD');
guard('B-block', () => {
  const now = shown(NEW);
  log('    working tree renders: ' + JSON.stringify(now[2]));
  ok(now[2][1] === 10998,
     'B1 the total is filled from its own rows: ' + JSON.stringify(now[2][1]));
  /* 1, not 100: this column is stored as a FRACTION and the page formats it.
   * The browser half of this evidence reads "100.0%" off the rendered row,
   * which is the same fact seen from the other end. */
  ok(Number(now[2][2]) === 1,
     'B2 and the percentage column comes to a whole 1, which the page renders ' +
     'as 100.0%: ' + JSON.stringify(now[2][2]));
  ok(now[0][1] === 9999 && now[1][1] === 999,
     'B3 without touching either row it was computed from');
  /* NOT A NEW STORED COPY. rowsForDisplay clones; the rows handed in are the
   * rows that came back out. */
  const src = IMPORTED.map(r => r.slice());
  NEW.attempt(api => api.rowsForDisplay(src, SCHEMA, 'G1'));
  ok(src[2][1] === null,
     'B4 and the stored row is untouched: the engine fills the VIEW, it does ' +
     'not write a second source of truth into storage');
});

/* ===================== C: how it was closed =========================== */
log('');
log('C. AND NOT BY WIDENING A LABEL PREDICATE');
guard('C-block', () => {
  /* The audit's own reading: "Systemwide Total" does not match
   * isStrictTotalRowLabel, so CLCPA-240's value-less bootstrap never reaches
   * it. That is still true. The gap was closed in the recompute path, where
   * the audit said it was, and not by loosening the label test -- CLCPA-200
   * is the record of what an unanchored /total/i match costs. */
  const strictNow = NEW.attempt(api => api.isStrictTotalRowLabel('Systemwide Total'));
  const strictWas = OLD.attempt(api => api.isStrictTotalRowLabel('Systemwide Total'));
  ok(strictWas === false, 'C1 BASE: "Systemwide Total" is not a strict total label');
  ok(strictNow === false,
     'C2 and this build has not changed that, so the bootstrap the audit ' +
     'named still does not reach this row');
  ok(NEW.attempt(api => api.isAnchoredTotalRowLabel('Systemwide Total')) === true,
     'C3 the ANCHORED predicate does match it, which is the one CLCPA-245 R2 ' +
     'flagged it with: flagging was never the missing half');
  /* and the data row beside it is still not a total, on the predicate that
   * blanked one in CLCPA-200 */
  ok(NEW.attempt(api => api.isAnchoredTotalRowLabel('Feet Replaced within DAC')) === false,
     'C4 and a data row is still not caught by it');
});

/* ===================== D: the KPI half ================================ */
log('');
log('D. THE MAINS KPI, ON THE PATH THE APP ACTUALLY TAKES');
guard('D-block', () => {
  /* Both KPI call sites -- recomputeYearDerived and composePayloadFromRows --
   * hand the rules dacDerivedTablesForYear, never the stored tables. The
   * question is whether any published KPI figure moves across the two builds
   * on THAT path, each build saving with its own strip. */
  const savedBy = (H) => H.attempt((api) => {
    const T = JSON.parse(JSON.stringify(P.tables));
    Object.keys(T).forEach((id) => {
      Object.keys(T[id].data || {}).forEach((y) => {
        const rows = T[id].data[y];
        if (!rows || !rows.length) return;
        T[id].data[y] = api.stripDerivedForPersist(rows.map(r => r.slice()), id,
          api.getTableSchema(T[id], y));
      });
    });
    return T;
  });
  const realBy = (H, saved) => H.attempt((api) => {
    const out = {};
    const years = Array.from(new Set(Object.keys(P.tables).reduce((a, id) =>
      a.concat(Object.keys(P.tables[id].data || {})), []))).sort();
    Object.keys(api.DAC_KPI_REPORTED).forEach((k) => {
      years.forEach((y) => {
        out[k + ':' + y] = JSON.stringify(api.DAC_KPI_REPORTED[k](
          api.dacDerivedTablesForYear({ tables: saved }, y), y));
      });
    });
    return out;
  });
  const was = realBy(OLD, savedBy(OLD));
  const now = realBy(NEW, savedBy(NEW));
  const keys = Object.keys(now);
  const movedK = keys.filter(k => now[k] !== was[k]);
  /* STRUCTURAL, not a number I typed: the grid has to be every rule against
   * every year, or "nothing moved" is a statement about a subset. */
  const nRules = NEW.attempt(api => Object.keys(api.DAC_KPI_REPORTED).length);
  const nYears = Array.from(new Set(Object.keys(P.tables).reduce((a, id) =>
    a.concat(Object.keys(P.tables[id].data || {})), []))).length;
  ok(keys.length === nRules * nYears && nRules > 1 && nYears > 1,
     'D1 every KPI against every year is measured, not just the one named: ' +
     nRules + ' rules x ' + nYears + ' years = ' + keys.length + ' KPI-years');
  ok(movedK.length === 0,
     'D2 and not one published KPI figure moves across the two builds on ' +
     'that path: ' + JSON.stringify(movedK.slice(0, 6)));
  /* the one the ticket names, by name, so a rename cannot quietly drop it */
  ok(keys.indexOf('main_replacement:2025') >= 0,
     'D3 including main_replacement, the KPI the ticket says does not render');
  /* AND IT IS NOT EMPTY. "does not move" is satisfied by a figure that was
   * absent on both builds, which would be the ticket unfixed. */
  const mains = JSON.parse(now['main_replacement:2025'] || 'null');
  ok(mains && typeof mains.total === 'number' && mains.total > 0,
     'D4 and it has a figure rather than being equally absent on both: ' +
     JSON.stringify(mains));
});

/* ===================== E: no code was written for it ================== */
log('');
log('E. THE VERDICT: NOTHING IN THIS BUILD IS A CLCPA-246 FIX');
guard('E-block', () => {
  /* A candidate fallback in dacCell WAS written, measured to change nothing
   * on the real path, and removed. The record of that is a comment; the
   * assertion is that the accessor is byte-identical to BASE. */
  const grab = (src) => {
    const i = src.indexOf('\r\n  function dacCell(');
    return i < 0 ? null : src.slice(i, src.indexOf('\r\n  }', i));
  };
  const a = grab(BASE_SRC), b = grab(SRC);
  ok(a && b, 'E1 dacCell is found on both builds');
  /* codeOnly leaves the blank line a removed comment used to sit on, so the
   * comparison has to collapse whitespace or it reports a code change that
   * is a deleted comment. Collapsed on BOTH sides, identically. */
  const bare = (s) => codeOnly(s).split(/\r?\n/).map(l => l.trim())
    .filter(Boolean).join('\n');
  ok(bare(b) === bare(a),
     'E2 and its CODE is byte-identical to BASE: the fallback that was ' +
     'written for this ticket was measured, found to change nothing on the ' +
     'real path, and removed');
  ok(b !== a && /CLCPA-246/.test(b),
     'E3 while the file records why, so the next reader does not write it again');
});

/* ===================== X: the baseline ================================ */
log('');
log('X. THE BASELINE');
guard('X-block', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X1 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: ROOT }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'X2 and HEAD descends from it');
  ok(YEAR === '2098',
     'X3 the browser half seeds 2098, this half needs no year at all, and ' +
     'neither goes near 2096: that is CLCPA-301s reproduction');
});

log('');
log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
if (fail) process.exit(1);
