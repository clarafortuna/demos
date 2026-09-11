/* CLCPA-244: the wrong (calculated) on E1, and the fossilized year.
 *
 * DEFECT 1. DERIVED_COLS is keyed by COLUMN, so a rule claims every row. That
 * is right for a pct(), which computes from each row's own cells, and wrong
 * for E1's weighted mean: the four category shares are what ConEd REPORTS --
 * there is no DAC-dollar column to divide by -- and only the Grand Total is an
 * aggregate. All four source rows rendered read-only grey, the template
 * stamped them (calculated), and the import landed 0 of 5. Typing over the
 * marker did not help, because the skip reads ingestComputed rather than the
 * file.
 *
 * DEFECT 2. getTableSchema fell back to Object.keys(...)[0], the OLDEST year,
 * while ingestTemplateSource borrows the most recent year WITH ROWS. A fresh
 * year therefore got 2023's headings above 2025's labels. The stored schemas
 * were never wrong.
 *
 * THE GATE, and Emely named it as such: getTableSchema is read by the composer
 * and the report as well as the importer, so the suite proves across all 52
 * tables that no year which HAS its own schema can move.
 *
 * BASE is 18f11e2, the build in front of this change.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-244-evidence/suite-244-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || '18f11e2';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);

const SRC = fs.readFileSync(APP, 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));
const BS = String.fromCharCode(92);

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
const say = (m) => lines.push(m);
function guard(label, fn) {
  try { fn(); } catch (e) {
    fail++; lines.push('  FAIL ' + label + ' THREW: ' + (e && e.message));
  }
}

function grab(name, src) {
  src = src || SRC;
  for (const p of ['  ', '    ', '']) for (const k of ['function ', 'async function ']) {
    const head = '\r\n' + p + k + name + '(';
    const i = src.indexOf(head); if (i < 0) continue;
    const close = '\r\n' + p + '}';
    const j = src.indexOf(close, i + head.length);
    if (j <= i) continue;
    return src.slice(i + 2, j + close.length);
  }
  return null;
}
function grabConst(name, src) {
  src = src || SRC;
  const m = src.match(new RegExp('\\r\\n  (?:const|var|let) ' + name + '\\s*='));
  if (!m) return null;
  const start = src.indexOf(m[0]) + 2;
  let d = 0, q = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i], p = src[i - 1];
    if (q) { if (c === q && p !== BS) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i); if (e < 0) return null; i = e + 1; continue; }
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\r\n', i); if (e < 0) return null; i = e; continue; }
    if (c === '(' || c === '{' || c === '[') d++;
    else if (c === ')' || c === '}' || c === ']') d--;
    else if (c === ';' && d === 0) return src.slice(start, i + 1);
  }
  return null;
}
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

function build(src, tag) {
  const fns = ['renderIngestEditor', 'ingestComputed', 'buildIngestImport',
    'totalRowFlags', 'recomputeTotals', 'getTableSchema', 'getTableBody',
    'ingestTemplateSource', 'normIngestKey'];
  const cs = [];
  const STATE = { payload: P, ingest: {} };
  for (let it = 0; it < 400; it++) {
    const body = '"use strict";\n' +
      'const console = { warn: () => {}, info: () => {}, log: () => {}, error: () => {} };\n' +
      'const document = { getElementById: () => null, querySelectorAll: () => [] };\n' +
      cs.map(n => grabConst(n, src)).join('\n') + '\n' +
      fns.map(n => grab(n, src)).filter(Boolean).join('\n') + '\n' +
      'return {' + fns.filter(n => grab(n, src)).join(',') + ', DERIVED_COLS};';
    let api;
    try {
      api = new Function('P', 'state', 'escapeHtml', body)(P, STATE,
        (s) => String(s == null ? '' : s).replace(/&/g, '&amp;')
          .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'));
    } catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) throw new Error(tag + ' shell: ' + e.message);
      if (grab(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm, src) && cs.indexOf(nm) < 0) { cs.push(nm); continue; }
      throw new Error(tag + ' cannot resolve ' + nm);
    }
    try {
      /* DRIVE every path the guards use. The E1 audit's own sweep skipped 25
       * of 26 tables on one missing dependency and printed a clean-looking
       * table containing only E1, because a catch swallowed the throw. */
      const sc = P.tables.E1.schema_by_year['2025'];
      const r = P.tables.E1.data['2025'].map(x => x.slice());
      STATE.ingest = { tableId: 'E1', year: '2025', schema: sc,
        baseline: r.map(x => x.slice()), draft: r.map(x => x.slice()), dirty: false };
      api.renderIngestEditor();
      api.recomputeTotals(r, sc, 'E1', []);
      api.ingestComputed(r, 'E1', sc);
      api.buildIngestImport([sc, ['Environmental', 1, 0.5]], sc, [], 'E1');
      ['A1', 'A5', 'G1', 'D2'].forEach(id => {
        const ys = Object.keys(P.tables[id].data || {}).filter(y => (P.tables[id].data[y] || []).length);
        if (!ys.length) return;
        const y = ys[ys.length - 1];
        const s2 = (P.tables[id].schema_by_year || {})[y] || [];
        const d2 = P.tables[id].data[y].map(x => x.slice());
        STATE.ingest = { tableId: id, year: y, schema: s2,
          baseline: d2.map(x => x.slice()), draft: d2.map(x => x.slice()), dirty: false };
        api.renderIngestEditor();
        api.recomputeTotals(d2, s2, id, []);
      });
      api.STATE = STATE;
      return api;
    } catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) throw new Error(tag + ' call: ' + e.message);
      if (grab(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm, src) && cs.indexOf(nm) < 0) { cs.push(nm); continue; }
      throw new Error(tag + ' cannot resolve ' + nm + ' (call)');
    }
  }
  throw new Error(tag + ': no convergence');
}

let NEW = null, OLD = null;
guard('both sources assemble and RUN', () => {
  NEW = build(SRC, 'NEW');
  OLD = build(BASE_SRC, 'BASE');
  ok(!!NEW && !!OLD, 'the changed source and BASE (' + BASE + ') both assemble and run');
});
if (!NEW || !OLD) {
  lines.forEach(l => console.log(l));
  console.log('\n  ' + pass + ' passed, ' + fail + ' failed  (assembly failed)');
  process.exit(1);
}

const E1 = P.tables.E1.data['2025'];
const E1SC = P.tables.E1.schema_by_year['2025'];
const GRAND = 4;                    // the Grand Total row index
const SOURCE = [0, 1, 2, 3];        // the four category rows

function renderE1(api, draft) {
  api.STATE.ingest = { tableId: 'E1', year: '2025', schema: E1SC,
    baseline: E1.map(r => r.slice()),
    draft: (draft || E1).map(r => r.slice()), dirty: false };
  const html = api.renderIngestEditor();
  const by = {};
  (html.match(/<tr[^>]*data-row="\d+"[\s\S]*?<\/tr>/g) || []).forEach(t => {
    const m = /data-row="(\d+)"/.exec(t); if (m) by[parseInt(m[1], 10)] = t;
  });
  return (i) => {
    const t = by[i] || '';
    const tds = t.match(/<td[\s\S]*?<\/td>/g) || [];
    return { row: t, col2: tds[2] || '' };
  };
}
const editable = (cell) => /<input/.test(cell);

/* ===================== D1: E1's shares are the operator's ============== */
say('');
say('=== D1. E1: the four shares are source, the Grand Total is the output ==');
guard('D1: the EDITOR', () => {
  const at = renderE1(NEW);
  const open = SOURCE.filter(i => editable(at(i).col2));
  ok(open.length === 4,
     'D1a all four category rows render an EDITABLE percentage: ' + open.length +
     ' of 4');
  ok(!editable(at(GRAND).col2),
     'D1b and the Grand Total stays read-only grey, because it IS a computed ' +
     'weighted mean');
  const beforeAt = renderE1(OLD);
  ok(beforeAt && SOURCE.every(i => !editable(beforeAt(i).col2)),
     'D1c on BASE all four were read-only, which is the defect');
});

guard('D1: the TEMPLATE', () => {
  const comp = NEW.ingestComputed(E1, 'E1', E1SC);
  const blank = SOURCE.filter(i => !comp.any(i, 2));
  ok(blank.length === 4,
     'D1d the template leaves all four category cells FILLABLE: ' + blank.length);
  ok(comp.any(GRAND, 2),
     'D1e and still writes (calculated) on the Grand Total');
  const before = OLD.ingestComputed(E1, 'E1', E1SC);
  ok(SOURCE.every(i => before.any(i, 2)),
     'D1f on BASE every one was marked (calculated)');
});

guard('D1: the IMPORT lands typed percentages, by every route', () => {
  const comp = NEW.ingestComputed(E1, 'E1', E1SC);
  /* route 1: the template's own file, values typed into the blanks */
  const file = [E1SC.slice()];
  E1.forEach((r, i) => file.push([String(r[0]), r[1],
    comp.any(i, 2) ? '(calculated)' : r[2]]));
  const res = NEW.buildIngestImport(file, E1SC, E1.map(r => [r[0], null, null]), 'E1');
  ok(res.rejections.length === 0, 'D1g the file the template wrote is accepted');
  if (!res.ok) { ok(false, 'D1h import did not complete'); return; }
  const landed = SOURCE.filter(i => typeof res.candidate[i][2] === 'number');
  ok(landed.length === 4,
     'D1h all four shares LAND: ' + JSON.stringify(res.candidate.map(r => r[2])));
  ok(res.candidate[GRAND][2] == null,
     'D1i and the Grand Total is left to the dashboard, not taken from the file');
  /* the values are the operator's, not a coincidence */
  ok(SOURCE.every(i => res.candidate[i][2] === E1[i][2]),
     'D1j each landed value is the one in the file');

  /* route 2: a hand-made CSV with no markers at all */
  const plain = [E1SC.slice()];
  E1.forEach(r => plain.push([String(r[0]), r[1], r[2]]));
  const res2 = NEW.buildIngestImport(plain, E1SC, E1.map(r => [r[0], null, null]), 'E1');
  ok(res2.ok && SOURCE.filter(i => typeof res2.candidate[i][2] === 'number').length === 4,
     'D1k and a plain CSV with no markers lands them too');

  /* BASE could not do either */
  const b1 = OLD.buildIngestImport(plain, E1SC, E1.map(r => [r[0], null, null]), 'E1');
  ok(b1.ok && SOURCE.every(i => b1.candidate[i][2] == null),
     'D1l on BASE none of them landed, by any route');
});

guard('D1: the Grand Total is still computed, and still correct', () => {
  const draft = E1.map(r => r.slice());
  draft.forEach((r, i) => { if (i === GRAND) r[2] = null; });
  NEW.recomputeTotals(draft, E1SC, 'E1', []);
  /* the weighted mean, computed here rather than asked of the engine */
  let num = 0, den = 0;
  SOURCE.forEach(i => { num += E1[i][1] * E1[i][2]; den += E1[i][1]; });
  const want = num / den;
  ok(Math.abs(draft[GRAND][2] - want) < 1e-9,
     'D1m the Grand Total is the investment-weighted mean of the four shares: ' +
     draft[GRAND][2].toFixed(6) + ' against ' + want.toFixed(6));
  /* and a typed share still moves it */
  const d2 = E1.map(r => r.slice());
  d2[0][2] = 0.99;
  NEW.recomputeTotals(d2, E1SC, 'E1', []);
  ok(d2[0][2] === 0.99, 'D1n a typed share is never overwritten');
  ok(d2[GRAND][2] !== draft[GRAND][2],
     'D1o and the Grand Total follows it: ' + d2[GRAND][2].toFixed(6));
});

/* ===================== D1x: nothing else moved ========================= */
say('');
say('=== D1x. the other 25 derived tables are untouched ====================');
guard('D1x: every pct column still owns its column', () => {
  const DC = NEW.DERIVED_COLS || {};
  let checked = 0, diff = [];
  Object.keys(DC).sort().forEach(id => {
    if (id === 'E1') return;
    Object.keys(P.tables[id].data || {}).forEach(y => {
      const rows = (P.tables[id].data[y] || []).filter(Array.isArray);
      if (!rows.length) return;
      const sc = (P.tables[id].schema_by_year || {})[y] || [];
      const a = NEW.ingestComputed(rows, id, sc);
      const b = OLD.ingestComputed(rows, id, sc);
      checked++;
      rows.forEach((r, i) => sc.forEach((h, c) => {
        if (a.any(i, c) !== b.any(i, c)) diff.push(id + ':' + y + ' r' + i + 'c' + c);
      }));
    });
  });
  ok(checked >= 50, 'D1x1 compared ' + checked + ' table-years outside E1');
  ok(diff.length === 0,
     'D1x2 not one cell changes its calculated marking' +
     (diff.length ? ': ' + diff.slice(0, 5).join(', ') : ''));
  ok(Object.keys(DC).filter(id => (DC[id] || [])
       .some(d => d.type === 'weightedMean')).join(',') === 'E1',
     'D1x3 weightedMean is used by exactly one table, and it is E1');
});

/* ===================== D2: the fallback takes the newest =============== */
say('');
say('=== D2. a year with no schema of its own borrows the MOST RECENT ======');
guard('D2: E1 in a fresh year', () => {
  const sc = NEW.getTableSchema(P.tables.E1, '2099');
  const before = OLD.getTableSchema(P.tables.E1, '2099');
  ok(sc[1] === P.tables.E1.schema_by_year['2025'][1],
     'D2a a fresh year now borrows 2025s heading: ' + JSON.stringify(sc[1]));
  ok(before[1] === P.tables.E1.schema_by_year['2023'][1],
     'D2b on BASE it borrowed 2023s: ' + JSON.stringify(before[1]));
  ok(!/2023/.test(String(sc[1])),
     'D2c so "2023 Total Investment ($)" no longer appears in a 2099 template');
  /* and the two halves now agree about which year to borrow */
  const src = NEW.ingestTemplateSource(P.tables.E1, '2099');
  const years = Object.keys(P.tables.E1.schema_by_year)
    .sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
  ok(String(src.year) === years[0],
     'D2d and ingestTemplateSource borrows the SAME year the schema now does: ' +
     src.year + ' both sides');
});

guard('D2: THE GATE -- no stored year can move, across all 52', () => {
  let withOwn = 0, moved = [], fellBack = 0;
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    const by = t.schema_by_year || {};
    Object.keys(by).forEach(y => {
      withOwn++;
      const a = NEW.getTableSchema(t, y);
      const b = OLD.getTableSchema(t, y);
      if (JSON.stringify(a) !== JSON.stringify(b)) moved.push(id + ':' + y);
      /* and it really is its OWN schema, not a fallback that happens to match */
      if (JSON.stringify(a) !== JSON.stringify(by[y])) moved.push(id + ':' + y + ' (not own)');
    });
    /* a year that does NOT have one is where the change is allowed to show */
    ['2099', '2098'].forEach(y => {
      if (by[y]) return;
      fellBack++;
      const a = NEW.getTableSchema(t, y);
      const keys = Object.keys(by).filter(k => Array.isArray(by[k]))
        .sort((x, z) => parseInt(z, 10) - parseInt(x, 10));
      if (keys.length && JSON.stringify(a) !== JSON.stringify(by[keys[0]])) {
        moved.push(id + ':' + y + ' (fallback not newest)');
      }
    });
  });
  ok(withOwn > 140,
     'D2e ' + withOwn + ' table-years have a schema of their own');
  ok(moved.length === 0,
     'D2f NOT ONE of them changes, and every fallback year takes the newest' +
     (moved.length ? ': ' + moved.slice(0, 5).join(', ') : ''));
  ok(fellBack >= 100,
     'D2g and the fallback path was actually exercised ' + fellBack + ' times, ' +
     'so D2f is not vacuous');
});

guard('D2: render-side substitution stays rejected, measured', () => {
  let lit = 0, deliberate = 0;
  Object.keys(P.tables).forEach(id => {
    const by = P.tables[id].schema_by_year || {};
    Object.keys(by).forEach(y => by[y].forEach(h => {
      const m = String(h).match(/\b(20\d\d)\b/);
      if (!m) return;
      lit++;
      if (m[1] !== y) deliberate++;
    }));
  });
  ok(lit === 38, 'D2h 38 schema headings carry a year literal: ' + lit);
  ok(deliberate === 10,
     'D2i and TEN deliberately name a different year -- prior-year comparison ' +
     'columns -- which is why substituting the year in the text was rejected: ' +
     deliberate);
  const a9 = P.tables.A9.schema_by_year['2025'];
  ok(a9.indexOf('2024') >= 0 && a9.indexOf('2025') >= 0,
     'D2j A9:2025 carries both years on purpose: ' + JSON.stringify(a9));
});

/* ===================== S: the shape of the change ====================== */
say('');
say('=== S. structure ======================================================');
guard('S: scoped and singular', () => {
  const code = codeOnly(SRC);
  ok(/function isTotalOnlyDerived\(/.test(code),
     'S1 the total-row-only rule is one named predicate');
  ok((code.split('isTotalOnlyDerived(').length - 1) === 3,
     'S2 defined once and read twice, by ingestComputed and by the editor: ' +
     (code.split('isTotalOnlyDerived(').length - 1) + ' occurrences');
  ok(/d\.type === 'weightedMean'/.test(code),
     'S3 and it keys on the rule TYPE, not on a table id');
  ok(!/E1/.test(codeOnly(grab('ingestComputed', SRC) || '')) &&
     !/E1/.test(codeOnly(grab('renderIngestEditor', SRC) || '')),
     'S4 neither surface names E1: a second wmean table would be handled');
  const gts = codeOnly(grab('getTableSchema', SRC) || '');
  ok(/parseInt\(b, 10\) - parseInt\(a, 10\)/.test(gts),
     'S5 getTableSchema sorts its fallback years descending');
  ok(!/Object\.keys\(table\.schema_by_year\)\[0\]/.test(gts),
     'S6 and the first-key fallback is gone');
  ok(grab('recomputeTotals', SRC) === grab('recomputeTotals', BASE_SRC),
     'S7 recomputeTotals is byte-identical: the ENGINE was already right, only ' +
     'the marking was wrong');
  const css = fs.readFileSync(path.join(REPO,
    'Coned/CLCPA/ExecutiveDashboard_dev/styles.css'), 'utf8');
  const baseCss = execSync('git show ' + BASE +
    ':"Coned/CLCPA/ExecutiveDashboard_dev/styles.css"',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
  ok(css === baseCss, 'S8 styles.css is byte-identical to BASE');
  ok(grabConst('DERIVED_COLS', SRC) === grabConst('DERIVED_COLS', BASE_SRC),
     'S9 and DERIVED_COLS itself is unchanged: no rule was edited, only how ' +
     'the marking reads one');
  /* STRUCTURAL, because the two branches COINCIDE on this payload.
   *
   * Dropping the `&& !isTotal` clause sends E1's Grand Total to the isTotal
   * branch instead of the derived one -- and for a numeric column those two
   * render byte-identical markup, so no assertion about the output can see it.
   * A mutation proved exactly that. The clause still matters: a second
   * weighted-mean table, or a change to either branch, would separate them.
   * Asserted on the shape, and labelled as such rather than dressed up as a
   * behavioural guard. */
  const ed = codeOnly(grab('renderIngestEditor', SRC) || '');
  ok(/if \(dDesc && !\(isTotalOnlyDerived\(dDesc\) && !isTotal\)\) \{/.test(ed),
     'S10 the editor exempts a total-row-only rule ONLY on a body row');

  /* THE ORACLE MUST NOT BORROW THE ENGINE. CLCPA-240 lost three rounds to
   * assertions about the engine that were computed by the engine. D1m checks
   * the weighted mean against arithmetic written here; this checks that it
   * still is. */
  const self = fs.readFileSync(__filename, 'utf8');
  const d1m = self.slice(self.indexOf('D1: the Grand Total is still computed'),
                         self.indexOf('D1x: nothing else moved'));
  ok(/num \/ den/.test(d1m) && !/recomputeTotals\([a-z]*ref/i.test(d1m),
     'S11 and the weighted-mean check computes its own expectation rather ' +
     'than asking recomputeTotals for it');

  const declared = (self.match(/DAC_BASE_COMMIT \|\| '([^']*)'/) || [])[1];
  ok(/^[0-9a-f]{7,40}$/.test(String(declared)),
     'S12 the baseline is a literal commit sha: ' + JSON.stringify(declared));
});

/* ---------- report ------------------------------------------------------ */
console.log('======================================================================');
console.log('CLCPA-244 -- E1s source percentages, and the fallback year');
console.log('  app.js : ' + APP);
console.log('  BASE   : ' + BASE);
console.log('======================================================================');
lines.forEach(l => console.log(l));
console.log('');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
try {
  fs.writeFileSync(OUT, [
    '======================================================================',
    'CLCPA-244 -- E1s source percentages, and the fallback year',
    '  BASE   : ' + BASE,
    '======================================================================',
  ].concat(lines).concat(['', '  ' + pass + ' passed, ' + fail + ' failed']).join('\n') + '\n');
} catch (e) { /* stdout is the record */ }
process.exitCode = fail ? 1 : 0;
