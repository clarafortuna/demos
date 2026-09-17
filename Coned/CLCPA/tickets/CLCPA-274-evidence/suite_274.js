/* CLCPA-274 -- the template marks derivable total COLUMN cells (calculated).
 *
 * H1's Grand Total column arrived blank on every body row and a blank cell
 * invites a figure. The total ROW already said "(calculated)".
 *
 * THE CARE THIS TICKET NEEDED, and it is the whole suite: the accessor that
 * writes the marker is the SAME one the importer consults to SKIP a cell.
 * Widening it would have made the importer discard figures preparers actually
 * filed -- the exact opposite of CLCPA-272 ruling (b). So the template gets
 * its own accessor and the import path is asserted byte-unchanged.
 *
 * BASE predates the change: 050c1c1 (CLCPA-270's tip).
 *
 * Run:  node suite_274.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const BASE = process.env.DAC_BASE_COMMIT || '050c1c1';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);
const SRC = fs.readFileSync(APP, 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => { try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); } };
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p);

function api(src, want) {
  const L = src.split('\r\n'); const TOP = [];
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
const run = api(SRC, ['ingestComputed', 'buildIngestImport', 'detectSumColumns']);
const runBase = api(BASE_SRC, ['ingestComputed']);

const newest = (id) => Object.keys(P.tables[id].schema_by_year || {}).sort().pop();

log('======================================================================');
log('CLCPA-274 -- the template marks derivable total columns (calculated)');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the reported shape --------------------------------------------- */
log('');
log('A. H1\'s GRAND TOTAL COLUMN, the shape the ticket names');
guard('A-block', () => {
  const y = newest('H1');
  const schema = P.tables.H1.schema_by_year[y];
  const rows = P.tables.H1.data[y];
  const gtCol = schema.indexOf('Grand Total');
  ok(gtCol === 3, 'A1 Grand Total is column 3');

  const marks = run(a => {
    const c = a.ingestComputed(rows, 'H1', schema);
    return rows.map((r, i) => [c.any(i, gtCol), c.marksInTemplate(i, gtCol)]);
  });
  const was = runBase(a => {
    const c = a.ingestComputed(rows, 'H1', schema);
    return rows.map((r, i) => c.any(i, gtCol));
  });

  const bodyRows = rows.map((r, i) => i).filter(i => !/^grand total$/i.test(String(rows[i][0])));
  ok(bodyRows.every(i => was[i] === false),
    'A2 on BASE every BODY row\'s Grand Total cell was unmarked -- blank and inviting');
  ok(bodyRows.every(i => marks[i][1] === true),
    'A3 they are now marked (calculated) -- ' + bodyRows.length + ' cells');
  ok(bodyRows.every(i => marks[i][0] === false),
    'A4 and the IMPORT accessor still says false for every one of them');

  const totalRow = rows.map((r, i) => i).find(i => /^grand total$/i.test(String(rows[i][0])));
  ok(marks[totalRow][0] === true && was[totalRow] === true,
    'A5 the total ROW was already marked and is unchanged');
});

/* ---- B. the import path is untouched ----------------------------------- */
log('');
log('B. BEHAVIOUR UNCHANGED: a provided value is still accepted');
guard('B-block', () => {
  const y = newest('H1');
  const schema = P.tables.H1.schema_by_year[y];
  const rows = P.tables.H1.data[y].map(r => r.slice());
  const header = schema.map(h => h == null ? '' : String(h));
  const line = schema.map(() => ''); line[0] = 'Westchester';
  line[1] = '666'; line[2] = '777'; line[3] = '1500';
  const res = run(a => a.buildIngestImport([header, line], schema, rows, 'H1'));
  ok(res.ok === true, 'B1 an import providing the Grand Total still succeeds');
  const landed = res.candidate.find(r => r[0] === 'Westchester');
  ok(landed && landed[3] === 1500,
    'B2 and the provided 1500 LANDS -- not skipped as computed');
  ok((res.reconcileNotices || []).length === 1,
    'B3 CLCPA-272 still reconciles it and advises');
  ok((res.notTouched.computed || []).every(x => x.column !== 'Grand Total' || /total/i.test(x.label)),
    'B4 no BODY row\'s Grand Total is reported as "not touched: computed"');

  /* and the marker itself, left in place, is still skipped */
  const line2 = schema.map(() => ''); line2[0] = 'Queens';
  line2[1] = '10'; line2[2] = '20'; line2[3] = '(calculated)';
  const res2 = run(a => a.buildIngestImport([header, line2], schema, rows, 'H1'));
  const q = res2.candidate.find(r => r[0] === 'Queens');
  ok(res2.ok === true && q && q[1] === 10 && q[2] === 20,
    'B5 a file that LEAVES the marker imports its other cells');
  ok((res2.notTouched.computed || []).some(x => /calculated/.test(x.why || '')),
    'B6 and the marker is reported as left to the dashboard, not imported as text');
});

/* ---- C. every enumerated table, and only those ------------------------- */
log('');
log('C. THE ENUMERATED DERIVABLE-COLUMN TABLES');
guard('C-block', () => {
  const changed = run((a) => {
    const out = [];
    Object.keys(P.tables).sort().forEach((id) => {
      const y = newest(id); if (!y) return;
      const schema = P.tables[id].schema_by_year[y];
      const rows = (P.tables[id].data || {})[y] || [];
      if (!rows.length) return;
      const c = a.ingestComputed(rows, id, schema);
      let n = 0;
      rows.forEach((row, r) => schema.forEach((h, ci) => {
        if (!c.any(r, ci) && c.marksInTemplate(r, ci)) n++;
      }));
      if (n) out.push({ id, n });
    });
    return out;
  });
  changed.forEach(x => log('     ' + x.id.padEnd(4) + String(x.n).padStart(3) + ' cells'));
  const ids = changed.map(x => x.id);
  ok(JSON.stringify(ids) === JSON.stringify(['B2', 'F2', 'F4', 'F5', 'F6', 'F7', 'H1']),
    'C1 exactly the seven enumerated tables change -- got ' + ids.join(', '));
  ok(changed.reduce((s, x) => s + x.n, 0) === 83,
    'C2 and 83 cells in total -- got ' + changed.reduce((s, x) => s + x.n, 0));
  /* the relationship is CLCPA-272's, so the two cannot disagree */
  const rels = run(a => Object.keys(P.tables).sort().filter((id) => {
    const y = newest(id); if (!y) return false;
    const rows = (P.tables[id].data || {})[y] || [];
    return a.detectSumColumns(P.tables[id].schema_by_year[y], rows, id).length > 0;
  }));
  ok(JSON.stringify(rels) === JSON.stringify(ids),
    'C3 and they are exactly the tables detectSumColumns finds -- guidance and ' +
    'advisory cannot disagree about which columns are derivable');
});

/* ---- D. style of change ------------------------------------------------- */
log('');
log('D. STYLE OF CHANGE');
guard('D-block', () => {
  const code = codeOnly(SRC), base = codeOnly(BASE_SRC);
  ok(/marksInTemplate: \(r, c\) =>/.test(code), 'D1 the template has its own accessor');
  ok(/if \(computed\.marksInTemplate\(idx, c\)\)/.test(code),
    'D2 and the workbook writer calls it');
  ok(/if \(computed\.any\(t\.rowIdx, cIdx\)\)/.test(code),
    'D3 while the IMPORT still calls `any`');
  ok(base.indexOf('if (computed.any(idx, c))') >= 0,
    'D4 on BASE the workbook writer called `any` -- one accessor for both');
  /* `any` itself must be byte-identical: widening it is the defect this
   * ticket had to avoid */
  const grab = (s) => {
    const a = s.indexOf('      any: (r, c) =>');
    return a < 0 ? null : s.slice(a, s.indexOf('\r\n', s.indexOf('isTotalOnlyDerived', a)));
  };
  ok(grab(SRC) && grab(SRC) === grab(BASE_SRC),
    'D5 the `any` accessor is BYTE-IDENTICAL to BASE');
  const added = SRC.split('\r\n').filter(l => BASE_SRC.indexOf(l) < 0)
    .filter(l => l.trim() && !/^\s*[*/]/.test(l.trim()));
  ok(!added.some(l => /['"][A-J]\d+['"]/.test(l)), 'D6 no added code line names a table id');
  ok(!added.some(l => /Grand Total|Total Plugs/.test(l)), 'D7 nor a column');
  ok(/detectSumColumns\(schema, rows, tableId\)/.test(code),
    'D8 the derivable columns come from the schema, not a list');
  /* BLAST RADIUS in the writer. The marker branch sits directly below
   * CLCPA-240's group-header branch, which must keep winning: a header has
   * nothing to calculate whatever the schema says about its columns. A
   * mutation of that branch is invisible to the accessor tests above, so it
   * is pinned here. */
  ok(code.indexOf('if (isGroupHeader) return { style: style, text: INGEST_NOVALUE_MARKER };') >= 0 &&
     base.indexOf('if (isGroupHeader) return { style: style, text: INGEST_NOVALUE_MARKER };') >= 0,
    'D9 the group-header branch above it is unchanged and still checked FIRST');
  const order = code.indexOf('if (isGroupHeader) return { style: style, text: INGEST_NOVALUE_MARKER };') <
    code.indexOf('if (computed.marksInTemplate(idx, c))');
  ok(order, 'D10 and it is still checked BEFORE the calculated branch');
});

/* ---- X. the harness ----------------------------------------------------- */
log('');
log('X. THE HARNESS');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  const m = /const BASE = process\.env\.DAC_BASE_COMMIT \|\| '([0-9a-f]+)';/.exec(self);
  ok(!!m && /^[0-9a-f]{7,40}$/.test(m[1]), 'X1 BASE is a literal sha -- ' + (m ? m[1] : 'none'));
  ok(BASE_SRC.indexOf('marksInTemplate') < 0, 'X2 and predates this ticket');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-274-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
