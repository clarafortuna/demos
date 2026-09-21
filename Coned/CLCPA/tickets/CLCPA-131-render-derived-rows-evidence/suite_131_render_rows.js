/* CLCPA-131 acceptance: a declared derived row is computed on the PAGE, and
 * not one published figure moves.
 *
 * The ruling: "Fix it once in rowsForDisplay (the same fix the Section D
 * riders need), enumerate every surface it touches, and assert no stored
 * published figure moves on any section page as a result."
 *
 * The second half is the whole risk. applyDerivedRows without the
 * kept-figure baseline republishes the engine's raw quotient over the
 * preparer's filed figure -- 47 of the payload's 49 declared derived-row
 * cells -- so this suite drives BOTH callings and requires the difference.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-131-render-rows-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || 'ea0300d';
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  PASS  ' + m); } else { fail++; log('  FAIL  ' + m); } };
const guard = (label, fn) => {
  try { fn(); } catch (e) { fail++; log('  FAIL  ' + label + ' threw: ' + (e && e.message)); }
};
const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '').replace(/^[ \t]*\/\/.*$/gm, '');

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
    return k >= 0 ? L.slice(TOP[k].line, bound[k + 1]).join('\n') : null;
  };
  const parts = [], have = new Set();
  const add = (n) => {
    if (have.has(n)) return false;
    const f = find(n); if (!f) return false;
    have.add(n); parts.push(f); return true;
  };
  want.forEach(add);
  let api = null;
  const attempt = (call) => {
    for (let r = 0; r < 600; r++) {
      try {
        if (!api) {
          api = new Function('PAYLOAD', 'const state = { payload: PAYLOAD };\n' +
            'const document = undefined;\n' + parts.join('\n\n') +
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

const WANT = ['rowsForDisplay', 'applyDerivedRows', 'applyDerivedCols',
  'getTableSchema', 'DERIVED_ROWS', 'derivedRowKeepsStored', 'derivedRowValue',
  'columnGrandTotals', 'totalRowFlags', 'bareNumber'];
const NEW = harness(SRC, WANT), OLD = harness(BASE_SRC, WANT);

log('CLCPA-131: declared derived rows on the page, with nothing republished');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ---- A. the call, and its baseline ---------------------------------- */
log('A. THE CALL, AND THE ARGUMENT THAT MAKES IT SAFE');
guard('A  structure', () => {
  const code = codeOnly(SRC);
  ok(/applyDerivedRows\(clone, tableId, schema, rawRows\);/.test(code),
    'A1 rowsForDisplay applies the declared derived rows');
  ok(!/applyDerivedRows\(clone, tableId, schema\);/.test(code) &&
     !/applyDerivedRows\(clone, tableId, schema, null\);/.test(code),
  'A2 and passes the STORED rows as the kept-figure baseline, never null');
  /* it must sit after the column rules: a derived row divides figures the
   * column rules may have just filled */
  const i = code.indexOf('applyDerivedCols(clone, tableId, colSum, schema);');
  const j = code.indexOf('applyDerivedRows(clone, tableId, schema, rawRows);');
  ok(i >= 0 && j > i, 'A3 after the column rules, whose output it divides');
  ok(!/applyDerivedRows\(/.test(codeOnly(BASE_SRC)
    .slice(codeOnly(BASE_SRC).indexOf('function rowsForDisplay'),
      codeOnly(BASE_SRC).indexOf('function rowsForDisplay') + 4000)),
  'A4 BASE ' + BASE + ' did not call it from rowsForDisplay at all');
});

/* ---- B. not one published figure moves ------------------------------ */
log('');
log('B. NOT ONE PUBLISHED FIGURE MOVES, ACROSS EVERY DECLARED CELL');
guard('B  value identity', () => {
  let examined = 0, moved = 0, blankFilled = 0;
  const movers = [];
  NEW.attempt((api) => {
    Object.keys(api.DERIVED_ROWS).forEach((id) => {
      const t = P.tables[id];
      if (!t) return;
      const rules = (api.DERIVED_ROWS[id] || []).filter(r => r && typeof r.row === 'number');
      if (!rules.length) return;
      Object.keys(t.data).sort().forEach((y) => {
        const schema = api.getTableSchema(t, y);
        const stored = t.data[y].map(r => r.slice());
        const page = api.rowsForDisplay(stored.map(r => r.slice()), schema, id,
          { fillTotals: true });
        rules.forEach((rule) => {
          for (let c = 1; c < schema.length; c++) {
            const sv = (stored[rule.row] || [])[c];
            const pv = (page[rule.row] || [])[c];
            if (sv === undefined && pv === undefined) continue;
            examined++;
            const sEmpty = sv == null || String(sv).trim() === '';
            if (sEmpty) { if (pv != null && String(pv).trim() !== '') blankFilled++; continue; }
            if (String(sv) !== String(pv)) {
              moved++;
              if (movers.length < 4) movers.push(id + '/' + y + ' r' + rule.row + ' c' + c +
                ': stored ' + JSON.stringify(sv) + ' -> page ' + JSON.stringify(pv));
            }
          }
        });
      });
    });
    return null;
  });
  log('    declared derived-row cells examined: ' + examined);
  ok(examined >= 49, 'B1 every declared cell in the payload is examined: ' + examined);
  movers.forEach(m => log('      MOVED: ' + m));
  ok(moved === 0, 'B2 and NOT ONE stored published figure moves: ' + moved + ' moved');
});

/* ---- C. and the guard fails on the unsafe calling ------------------- */
log('');
log('C. THE UNSAFE CALLING, WHICH IS WHAT B EXISTS TO REFUSE');
guard('C  no baseline', () => {
  let moved = 0, examined = 0;
  const ex = [];
  NEW.attempt((api) => {
    Object.keys(api.DERIVED_ROWS).forEach((id) => {
      const t = P.tables[id];
      if (!t) return;
      const rules = (api.DERIVED_ROWS[id] || []).filter(r => r && typeof r.row === 'number');
      if (!rules.length) return;
      Object.keys(t.data).sort().forEach((y) => {
        const schema = api.getTableSchema(t, y);
        const stored = t.data[y].map(r => r.slice());
        /* the SAME engine, called the way the editor path must never be
         * copied onto the display path: no filed reference at all */
        const raw = stored.map(r => r.slice());
        api.applyDerivedRows(raw, id, schema, null);
        rules.forEach((rule) => {
          for (let c = 1; c < schema.length; c++) {
            const sv = (stored[rule.row] || [])[c];
            if (sv == null || String(sv).trim() === '') continue;
            examined++;
            if (String(sv) !== String((raw[rule.row] || [])[c])) {
              moved++;
              if (ex.length < 3) ex.push(id + '/' + y + ' r' + rule.row + ' c' + c +
                ': filed ' + JSON.stringify(sv) + ' -> ' +
                JSON.stringify((raw[rule.row] || [])[c]));
            }
          }
        });
      });
    });
    return null;
  });
  ex.forEach(e => log('      ' + e));
  ok(moved > 40, 'C1 without the baseline it republishes ' + moved + ' of ' +
    examined + ' filed figures, so B is guarding something real');
});

/* ---- D. an empty declared row IS computed now ----------------------- */
log('');
log('D. AN EMPTY DECLARED ROW IS COMPUTED, WHICH IS THE POINT');
guard('D  the fill', () => {
  const both = (H) => H.attempt((api) => {
    const t = P.tables.D3, y = Object.keys(t.data).sort().pop();
    const schema = api.getTableSchema(t, y);
    const rows = t.data[y].map(r => r.slice());
    (api.DERIVED_ROWS.D3 || []).forEach((d) => {
      if (typeof d.row !== 'number') return;
      for (let c = 1; c < schema.length; c++) rows[d.row][c] = null;
    });
    const page = api.rowsForDisplay(rows.map(r => r.slice()), schema, 'D3',
      { fillTotals: true });
    return (api.DERIVED_ROWS.D3 || []).filter(d => typeof d.row === 'number')
      .map(d => (page[d.row] || [])[1]);
  });
  const now = both(NEW), was = both(OLD);
  log('    now : ' + JSON.stringify(now));
  log('    BASE: ' + JSON.stringify(was));
  ok(now.every(v => typeof v === 'number' && isFinite(v)),
    'D1 every declared percentage row computes on the page: ' + JSON.stringify(now));
  ok(was.every(v => v == null),
    'D2 and on BASE ' + BASE + ' every one of them was blank: ' + JSON.stringify(was));
});

log('');
log(pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
