/* CLCPA-308 (the D-01 family): a DERIVED ROW registers as computed.
 *
 * Section D's shape is a count row, another count row, then a PERCENTAGE ROW
 * that is the quotient of the two. The quotient is declared in DERIVED_ROWS
 * and the engine recomputes it -- but ingestComputed read DERIVED_COLS and
 * nothing else, so a metric running down the ROWS was invisible to it.
 *
 * REPRODUCED IN A BROWSER FIRST, real downloads off the real button
 * (repro_308.js). D3's workbook for 2025, shipped build:
 *
 *   ["Percentage of subscribers in DACs", "0.348", "0.513"]
 *
 * a bare quotient in a cell the preparer is invited to overwrite, and two rows
 * down "0.09300000000000001", a raw floating-point artifact handed to an
 * operator. After this change both read "(calculated)".
 *
 * THE MARKER ONLY. The first cut of this build registered the derived row in
 * `any` as well, which marks the workbook AND makes the IMPORTER SKIP the
 * cell. That was withdrawn, and the reason is measured in
 * probe_308_keeps.js: 49 derived-row cells hold a stored figure and the
 * engine KEEPS 47 of them as filed, because derivedRowKeepsStored honours a
 * figure that merely adds precision. D2/2023 publishes the filed 0.321, not
 * the 0.32057920404599916 the quotient produces. Skipping those cells on
 * import would have replaced 47 published figures with raw quotients -- the
 * opposite of CLCPA-272's ruling that a provided value is accepted and
 * reconciled, never rejected.
 *
 * Pins: DAC_BASE_COMMIT, DAC_APP_OVERRIDE.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-308-output.txt');

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

const WANT = ['ingestComputed', 'getTableSchema', 'DERIVED_ROWS', 'DERIVED_COLS',
  'derivedRowKeepsStored', 'derivedRowValue', 'rowsForDisplay'];
const NEW = harness(SRC, WANT), OLD = harness(BASE_SRC, WANT);

function view(H, rows, id, schema) {
  return H.attempt((api) => {
    const c = api.ingestComputed(rows, id, schema);
    return rows.map((r, i) => {
      const m = [];
      for (let col = 1; col < (schema || []).length; col++) {
        if (c.marksInTemplate(i, col)) m.push(col);
      }
      const a = [];
      for (let col = 1; col < (schema || []).length; col++) {
        if (c.any(i, col)) a.push(col);
      }
      /* BASE has no derivedRow accessor at all -- it is one of the things
       * this ticket adds -- so asking for it unguarded threw on the OLD
       * harness and took three whole blocks down with it. */
      return { marks: m, any: a,
               derivedRow: (typeof c.derivedRow === 'function') ? !!c.derivedRow(i) : false };
    });
  });
}

log('CLCPA-308: a derived ROW registers as computed');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ===================== R: what is declared ============================= */
say('=== R. the declaration ==============================================');
guard('R: DERIVED_ROWS is what drives this', () => {
  const tables = NEW.attempt(api => Object.keys(api.DERIVED_ROWS || {}).sort());
  /* MEASURED. Written from memory this said C2, D2, D3, D4, F7; C2 is not in
   * DERIVED_ROWS at all. The measurement decides, not the recollection. */
  ok(JSON.stringify(tables) === JSON.stringify(['D2', 'D3', 'D4', 'F7']),
     'R1 the tables with declared derived rows: ' + JSON.stringify(tables));
  const same = JSON.stringify(tables) ===
    JSON.stringify(OLD.attempt(api => Object.keys(api.DERIVED_ROWS || {}).sort()));
  ok(same, 'R2 and the declaration itself is UNCHANGED: this ticket teaches the ' +
     'workbook to read a table that was always declared');
  ok(codeOnly(SRC).indexOf('derivedRowSet[r]') > 0,
     'R3 ingestComputed now consults the declared derived rows');
});

/* ===================== A: the reproduced case ========================== */
say('');
say('=== A. D3s percentage rows, the case captured in the browser ========');
guard('A: D3 2025', () => {
  const t = P.tables.D3, y = '2025';
  const rows = t.data[y];
  const schema = NEW.attempt(api => api.getTableSchema(t, y));
  const now = view(NEW, rows, 'D3', schema), was = view(OLD, rows, 'D3', schema);
  const dr = NEW.attempt(api => (api.DERIVED_ROWS.D3 || []).map(d => d.row));
  ok(dr.length === 2, 'A1 D3 declares two derived rows: ' + JSON.stringify(dr));
  /* THE EXACT SET, not "at least one". A mutation that marked only the first
   * value column left "length > 0" perfectly green while the second column
   * still invited a figure the engine overwrites -- which is the whole defect,
   * surviving in half the cells. */
  ok(JSON.stringify(dr.map(i => now[i].marks)) === JSON.stringify([[1, 2], [1, 2]]),
     'A2 and the workbook now marks BOTH value columns of both: ' +
     JSON.stringify(dr.map(i => now[i].marks)));
  ok(dr.every(i => was[i].marks.length === 0),
     'A3 while BASE marked neither, which is what the browser download showed ' +
     'as a bare 0.348: ' + JSON.stringify(dr.map(i => was[i].marks)));
});

/* ===================== B: the census =================================== */
say('');
say('=== B. every table, every year ======================================');
guard('B: only declared derived rows move', () => {
  const tablesWithRows = NEW.attempt(api => Object.keys(api.DERIVED_ROWS || {}));
  const moved = [], strays = [];
  let gainedCells = 0;
  Object.keys(P.tables).sort().forEach((id) => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach((y) => {
      const rows = t.data[y];
      if (!rows || !rows.length) return;
      const schema = NEW.attempt(api => api.getTableSchema(t, y));
      const a = view(OLD, rows, id, schema), b = view(NEW, rows, id, schema);
      rows.forEach((r, i) => {
        if (JSON.stringify(a[i].marks) === JSON.stringify(b[i].marks)) return;
        /* CLCPA-320 is in the same tree and marks TOTAL rows by role. Named,
         * so this ticket's own set stays exact. */
        if (b[i].derivedRow) {
          moved.push(id + ':' + y + ' r' + i);
          gainedCells += b[i].marks.filter(c => a[i].marks.indexOf(c) < 0).length;
        }
        else strays.push(id + ':' + y + ' r' + i + ' ' +
          JSON.stringify(String(r[0]).slice(0, 26)));
      });
    });
  });
  /* 27, not 54: the census in probe_320_delta.js walks the stored years AND
   * the same rows with their figures emptied, and reports both. This block
   * walks the stored years alone, so it sees half. Naming the difference
   * rather than picking whichever number made the line green. */
  ok(moved.length === 27,
     'B1 exactly 27 declared derived rows gain their marker, across the ' +
     'stored years: ' + moved.length);
  const byTable = {};
  moved.forEach(m => { const k = m.split(':')[0]; byTable[k] = (byTable[k] || 0) + 1; });
  ok(JSON.stringify(Object.keys(byTable).sort()) === JSON.stringify(['D2', 'D3', 'D4', 'F7']),
     'B2 across D2, D3, D4 and F7: ' + JSON.stringify(byTable));
  ok(Object.keys(byTable).every(k => tablesWithRows.indexOf(k) >= 0),
     'B3 and every table that moves is one DERIVED_ROWS declares: ' +
     JSON.stringify(Object.keys(byTable).sort()));
  /* CELLS, not just rows. The row count cannot see a marker that lands on one
   * column of a two-column row. */
  ok(gainedCells === 48,
     'B5 and the marker lands on this many CELLS, which is what a row count ' +
     'cannot see: ' + gainedCells);
  const notMine = strays.filter(s => !/ r\d+ "(Total|County Total|Systemwide Total|Grand Total)"/.test(s));
  ok(notMine.length === 0,
     'B4 and every other mover is CLCPA-320 marking a total row by role: ' +
     JSON.stringify(notMine.slice(0, 6)));
});

/* ===================== C: the import is NOT touched ==================== */
say('');
say('=== C. the importer still accepts a preparers figure ================');
guard('C: CLCPA-272 and the kept-figure rail', () => {
  let moved = [];
  Object.keys(P.tables).sort().forEach((id) => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach((y) => {
      const rows = t.data[y];
      if (!rows || !rows.length) return;
      const schema = NEW.attempt(api => api.getTableSchema(t, y));
      const a = view(OLD, rows, id, schema), b = view(NEW, rows, id, schema);
      rows.forEach((r, i) => {
        if (JSON.stringify(a[i].any) !== JSON.stringify(b[i].any)) {
          moved.push(id + ':' + y + ' r' + i);
        }
      });
    });
  });
  ok(moved.length === 0,
     'C1 the IMPORT SKIP does not move on a single row in the payload: ' +
     JSON.stringify(moved.slice(0, 8)));
  ok(!/derivedRowSet\[r\][^\n]*\n?[^\n]*any:/.test(codeOnly(SRC)) &&
     /any: \(r, c\) => \(!!totals\[r\][\s\S]{0,120}isTotalOnlyDerived\(derived\[c\]\)\),/
       .test(codeOnly(SRC)),
     'C2 because `any` does not consult the derived row at all');

  /* and the figures that would have been lost, counted.
   *
   * THE COUNTERS LIVE INSIDE THE CALLBACK. The assembler resolves a missing
   * dependency by catching the ReferenceError and RE-RUNNING the callback
   * from the top, so an accumulator declared outside it keeps whatever a
   * partial first pass added -- this counted 51 cells where there are 49,
   * and the two extra were simply counted twice. */
  const tally = NEW.attempt((api) => {
    let kept = 0, held = 0;
    Object.keys(api.DERIVED_ROWS || {}).forEach((id) => {
      const t = P.tables[id];
      if (!t) return;
      Object.keys(t.data || {}).forEach((y) => {
        const rows = t.data[y];
        const schema = api.getTableSchema(t, y);
        (api.DERIVED_ROWS[id] || []).forEach((d) => {
          const r = rows[d.row];
          if (!r) return;
          for (let c = 1; c < (schema || []).length; c++) {
            if (r[c] == null || r[c] === '') continue;
            held++;
            const v = api.derivedRowValue(rows, d, c, schema);
            if (api.derivedRowKeepsStored(r[c], v).keep) kept++;
          }
        });
      });
    });
    return { kept: kept, held: held };
  });
  const kept = tally.kept, held = tally.held;
  ok(held === 49 && kept === 47,
     'C3 and those cells are not hypothetical: 47 of 49 hold a figure the ' +
     'engine KEEPS as filed, which an import skip would have discarded: ' +
     kept + ' of ' + held);
});

/* ===================== D: nothing published moves ====================== */
say('');
say('=== D. the report page is untouched =================================');
guard('D: value identity', () => {
  let cells = 0, moved = [];
  Object.keys(P.tables).sort().forEach((id) => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach((y) => {
      const rows = t.data[y];
      if (!rows || !rows.length) return;
      const schema = NEW.attempt(api => api.getTableSchema(t, y));
      const a = OLD.attempt(api => api.rowsForDisplay(rows, schema, id, { fillTotals: true }));
      const b = NEW.attempt(api => api.rowsForDisplay(rows, schema, id, { fillTotals: true }));
      rows.forEach((r, i) => r.forEach((v, c) => {
        cells++;
        if (JSON.stringify((a[i] || [])[c]) !== JSON.stringify((b[i] || [])[c])) {
          moved.push(id + ':' + y + ' r' + i + 'c' + c);
        }
      }));
    });
  });
  ok(cells > 5000, 'D1 cells rendered on both builds: ' + cells);
  /* CLCPA-319 is in the same tree and does move G total-row quantities, which
   * is its whole purpose. Named, so this ticket's own figure is zero. */
  const notG = moved.filter(m => !/^G\d+:/.test(m));
  ok(notG.length === 0,
     'D2 and outside the G board this tree changes NOT ONE rendered figure: ' +
     JSON.stringify(notG.slice(0, 8)));
});

/* ===================== X: the baseline ================================= */
say('');
say('=== X. the baseline =================================================');
guard('X: pins', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X1 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: ROOT }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'X2 and HEAD descends from it');
  ok(codeOnly(BASE_SRC).indexOf('derivedRowSet') < 0,
     'X3 while BASE does not consult derived rows at all, so this suite ' +
     'cannot pass on it');
});

say('');
log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
if (fail) process.exit(1);
