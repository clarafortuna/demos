/* GROUP B of the Section C fix package: CLCPA-252 and CLCPA-259.
 *
 * Both are the same defect wearing two faces: a composed surface reading
 * something OTHER than the reporting year's own definition.
 *
 * CLCPA-252 (C-03) -- the caption. Both surfaces read
 * `(t.title_by_year||{})[year] || ('Table ' + id)`, and a newly created year
 * has no title entry for any of the 52 tables, so every caption on a fresh
 * year rendered bare. Dashboard-wide, not Section C. And not only a new-year
 * problem: A8:2023 is a STORED year with no title entry and has been
 * rendering bare all along -- 148 of 149 stored table-years carry a title,
 * that one does not. The fallback is built from short_title, which all 52
 * tables carry and which does not depend on the year.
 *
 * CLCPA-259 (C-11) -- the Program Performance panel. A hard-coded map of
 * programme categories, which the audit caught reading Peak Shaving /
 * Contingency / Multi-purpose / Mass-market on a fresh year while Table C1
 * below it showed that year's own values. Two of those captions appear in NO
 * year's C1, which is how you can tell it was reading nothing at all.
 *
 * EXPECTED, DISCLOSED, AND ASSERTED: fixing it CHANGES two captions on the
 * stored years too. Auto-DLM and BYOT both read "Peak Shaving and
 * Contingency" in C1 for 2023, 2024 and 2025, where the map said
 * "Multi-purpose" and "Mass-market". The panel was wrong on every year it
 * has ever rendered; this is not collateral, it is the ticket.
 *
 * BASE is 9699f62 (Group A's head). This branch stacks on it.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-252-evidence/suite-252-259-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || '9699f62';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);
const SRC = fs.readFileSync(APP, 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

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
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

function harness(src) {
  const LINES = src.split('\r\n');
  const TOP = [];
  LINES.forEach((ln, n) => {
    const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([LINES.length]);
  const find = (nm) => {
    const k = TOP.findIndex(d => d.name === nm);
    return k < 0 ? null : LINES.slice(TOP[k].line, bound[k + 1]).join('\n');
  };
  const parts = []; const have = new Set();
  const add = (n) => { if (have.has(n)) return false; const f = find(n); if (!f) return false;
    have.add(n); parts.push(f); return true; };
  const want = ['renderSourceTables', 'getTableSchema', 'tableCaption', 'SHORT_TITLES'];
  want.forEach(add);
  let api = null;
  const attempt = (call) => {
    for (let r = 0; r < 400; r++) {
      try {
        if (!api) api = new Function('PAYLOAD', parts.join('\n\n') +
          '\n;if (typeof state !== "undefined") state.payload = PAYLOAD;' +
          '\n;return {' + want.filter(n => have.has(n)).join(',') + '};')(P);
        return call(api);
      } catch (e) {
        const m = /(\w+) is not defined/.exec(e.message);
        if (m && add(m[1])) { api = null; continue; }
        throw e;
      }
    }
    throw new Error('no convergence');
  };
  return { attempt, have };
}
const NEW = harness(SRC), OLD = harness(BASE_SRC);

say('======================================================================');
say('Section C group B -- CLCPA-252 (captions), CLCPA-259 (programme categories)');
say('  BASE ' + BASE + '   (stacked on Group A)');
say('======================================================================');

/* =================== T: CLCPA-252, the caption ======================= */
say('');
say('=== T. CLCPA-252: the caption comes from the table =================');
guard('T: the live bare caption is healed', () => {
  const cap = (t, y) => NEW.attempt(api => api.tableCaption(t, y));
  ok(!(P.tables.A8.title_by_year || {})['2023'],
     'T0 A8:2023 genuinely has no stored title, which is why it rendered bare');
  ok(cap(P.tables.A8, '2023') === 'Table A8. Residential Install',
     'T1 and it now reads "' + cap(P.tables.A8, '2023') + '"');
  /* the BASE side, driven rather than described: at BASE the same call
   * returns the bare string. An `ok(true, ...)` placeholder stood here for
   * one run; an assertion that cannot fail is not an assertion. */
  const capOld = OLD.attempt(api => api.tableCaption
    ? api.tableCaption(P.tables.A8, '2023') : null);
  ok(capOld === null || capOld === 'Table A8',
     'T1b at BASE it was ' + (capOld === null
       ? 'not even a helper -- the expression was inline' : JSON.stringify(capOld)));
});

guard('T: no table renders bare on a year that does not exist yet', () => {
  const cap = (t, y) => NEW.attempt(api => api.tableCaption(t, y));
  const bare = Object.keys(P.tables).filter(id =>
    /^Table \w+$/.test(cap(P.tables[id], '2098')));
  ok(bare.length === 0, 'T2 bare captions on a fresh year: ' + bare.length +
     ' of ' + Object.keys(P.tables).length + (bare.length ? ' -- ' + bare.join(',') : ''));
  /* and each is built from the table's own short_title */
  const sample = ['C1', 'C5', 'A8', 'I1', 'J8'];
  sample.forEach(id => {
    const t = P.tables[id];
    ok(cap(t, '2098') === 'Table ' + id + '. ' + t.short_title,
       'T3 ' + id + ' -> "' + cap(t, '2098') + '"');
  });
});

guard('T: a STORED title still wins, byte for byte', () => {
  const cap = (t, y) => NEW.attempt(api => api.tableCaption(t, y));
  let checked = 0, moved = [];
  Object.keys(P.tables).forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).forEach(y => {
      const stored = (t.title_by_year || {})[y];
      if (!stored) return;
      checked++;
      if (cap(t, y) !== stored) moved.push(id + ':' + y);
    });
  });
  ok(checked === 148, 'T4 ' + checked + ' stored table-years carry a title');
  ok(moved.length === 0, 'T5 and every one is returned unchanged' +
     (moved.length ? ': ' + moved.slice(0, 5).join(', ') : ''));
});

guard('T: both surfaces call it, and neither keeps the old expression', () => {
  const src = codeOnly(SRC);
  ok(/const titleCurrent = tableCaption\(t, year\);/.test(src),
     'T6 the report page uses tableCaption');
  ok(/const tableTitle = tableCaption\(table, i\.year\);/.test(src),
     'T7 and so does the Report Data editor');
  ok(!/title_by_year \|\| \{\}\)\[year\] \|\| \('Table ' \+ t\.id\)/.test(src),
     'T8 the old report-page expression is gone');
  ok(!/title_by_year \|\| \{\}\)\[i\.year\] \|\| \('Table ' \+ i\.tableId\)/.test(src),
     'T9 and so is the editor one');
  const b = codeOnly(BASE_SRC);
  ok(/title_by_year \|\| \{\}\)\[year\] \|\| \('Table ' \+ t\.id\)/.test(b) &&
     /title_by_year \|\| \{\}\)\[i\.year\] \|\| \('Table ' \+ i\.tableId\)/.test(b),
     'T10 both were there at BASE, which is the defect');
});

/* =================== C: CLCPA-259, the categories =================== */
say('');
say('=== C. CLCPA-259: the panel reads C1 for the year on screen ========');
function catMap(src, yr) {
  const i = src.indexOf('const PROG_CATEGORIES = (() => {');
  if (i < 0) return null;
  const j = src.indexOf('})();', i) + 5;
  const body = src.slice(i, j);
  const gts = NEW.attempt(api => api.getTableSchema);
  return new Function('p', 'yr', 'getTableSchema', body + '\n;return PROG_CATEGORIES;')(
    { tables: P.tables }, yr, gts);
}
guard('C: the lookup is built from C1, per year', () => {
  ok(!/'CSRP': 'Peak Shaving',/.test(codeOnly(SRC)),
     'C1 the hard-coded map is gone');
  ok(/'CSRP': 'Peak Shaving',/.test(codeOnly(BASE_SRC)),
     'C1b and it was there at BASE');
  ok(/'Auto-DLM': 'Multi-purpose'/.test(codeOnly(BASE_SRC)) &&
     !/Multi-purpose/.test(codeOnly(SRC)),
     'C1c including "Multi-purpose", a caption that appears in NO years C1');
  const m = catMap(SRC, '2025');
  ok(m !== null, 'C2 the new lookup is a per-year expression, not a constant');
  ok(m && m.CSRP === 'Peak Shaving' && m.DLRP === 'Contingency',
     'C3 2025: CSRP -> ' + (m && m.CSRP) + ', DLRP -> ' + (m && m.DLRP));
  /* THE TWO THE MAP GOT WRONG, named */
  ok(m && m['Auto-DLM'] === 'Peak Shaving and Contingency',
     'C4 Auto-DLM reads C1s "Peak Shaving and Contingency", where the map ' +
     'said "Multi-purpose"');
  ok(m && m.BYOT === 'Peak Shaving and Contingency',
     'C5 BYOT likewise, where the map said "Mass-market"');
});

guard('C: it joins the long C1 label to the short programme code', () => {
  const m = catMap(SRC, '2025');
  ok(m && m['Commercial System Relief Program (CSRP)'] === 'Peak Shaving',
     'C6 the long C1 label resolves');
  ok(m && m.CSRP === 'Peak Shaving',
     'C7 and so does the parenthetical short code C3/C4/C5 use');
});

guard('C: HONEST ABSENCE where the year has nothing to read', () => {
  const m = catMap(SRC, '2098');
  ok(m !== null && Object.keys(m).length === 0,
     'C8 a year with no C1 data yields an EMPTY map, not a fossil: ' +
     JSON.stringify(m));
  /* every stored year does resolve, so C8 is not vacuous */
  ['2023', '2024', '2025'].forEach(y => {
    const mm = catMap(SRC, y);
    ok(mm && Object.keys(mm).length >= 10,
       'C9 ' + y + ' resolves ' + (mm ? Object.keys(mm).length : 0) + ' keys');
  });
  /* A ROW WITH NO CATEGORY MUST BE ABSENT, not present-and-empty. No stored
   * C1 row has a blank Category, so the real payload cannot exercise this --
   * the guard is checked on a synthetic table built in the C1 shape, which is
   * the only way the assertion can fail at all. */
  const saved = P.tables.C1;
  P.tables = Object.assign({}, P.tables, { C1: {
    id: 'C1', short_title: 'DR Programs', header_levels: 1,
    schema_by_year: { 2097: ['Program', null, null, 'Category', null, 'Description'] },
    data: { 2097: [
      ['Alpha Program (ALPHA)', null, null, 'Peak Shaving', null, 'x'],
      ['Beta Program (BETA)', null, null, '', null, 'y'],
      ['Gamma Program (GAMMA)', null, null, null, null, 'z'],
    ] }, title_by_year: {} } });
  const syn = catMap(SRC, '2097');
  P.tables = Object.assign({}, P.tables, { C1: saved });
  ok(syn && syn.ALPHA === 'Peak Shaving',
     'C10 a row WITH a category resolves: ALPHA -> ' + (syn && syn.ALPHA));
  ok(syn && !('BETA' in syn) && !('GAMMA' in syn),
     'C11 and rows whose Category is empty or null are ABSENT, not present ' +
     'with an empty caption: ' + JSON.stringify(Object.keys(syn || {})));
});

/* =================== Z: the 149 stored table-years ================== */
say('');
say('=== Z. the stored years: one caption moves, and it is the fix ======');
guard('Z: exactly one stored table-year renders differently', () => {
  let checked = 0, tables = 0;
  const moved = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach(y => {
      const a = OLD.attempt(api => api.renderSourceTables([t], y, {}, id));
      const b = NEW.attempt(api => api.renderSourceTables([t], y, {}, id));
      checked++;
      if (/<table/.test(String(b))) tables++;
      if (a !== b) moved.push(id + ':' + y);
    });
  });
  ok(checked === 149, 'Z1 ' + checked + ' stored table-years rendered on both sides');
  ok(tables === 149, 'Z1b and every one produced a <table>');
  ok(moved.length === 1 && moved[0] === 'A8:2023',
     'Z2 exactly ONE moved, and it is A8:2023: ' + JSON.stringify(moved));
  /* and the move is the caption, nothing else */
  const t = P.tables.A8;
  const a = OLD.attempt(api => api.renderSourceTables([t], '2023', {}, 'A8'));
  const b = NEW.attempt(api => api.renderSourceTables([t], '2023', {}, 'A8'));
  ok(a.replace(/Table A8[^<]*/g, 'CAP') === b.replace(/Table A8[^<]*/g, 'CAP'),
     'Z3 and with the caption masked the two renders are identical, so the ' +
     'caption is the ONLY thing that moved');
  ok(/Table A8\. Residential Install/.test(b) && !/Table A8\. Residential Install/.test(a),
     'Z4 BASE rendered it bare; this build names it');
});

/* =================== X: blast radius and baseline =================== */
say('');
say('=== X. what else moved ============================================');
function grabFn(n, src) {
  const lines = src.split('\r\n');
  for (const pad of ['  ', '    ', '']) {
    const decl = new RegExp('^' + pad + '(?:async )?function ' + n + '\\s*\\(');
    const anyDecl = new RegExp('^' + pad + '(?:async )?function \\w+\\s*\\(');
    const start = lines.findIndex(l => decl.test(l));
    if (start < 0) continue;
    const close = pad + '}';
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i] === close) return lines.slice(start, i + 1).join('\r\n');
      if (anyDecl.test(lines[i])) break;
    }
    return null;
  }
  return null;
}
guard('X: the blast radius', () => {
  const names = [...new Set((SRC.match(/(?:^|\r\n)[ \t]*(?:async )?function (\w+)\s*\(/g) || [])
    .map(m => /function (\w+)/.exec(m)[1]))];
  const changed = names.filter(n => grabFn(n, SRC) !== grabFn(n, BASE_SRC));
  say('       changed: ' + changed.sort().join(', '));
  const EXPECT = {
    tableCaption: 'CLCPA-252: the caption helper, new',
    renderSourceTables: 'CLCPA-252: the report page calls it',
    renderIngestEditor: 'CLCPA-252: the editor calls it',
    renderSectionC: 'CLCPA-259: the panel reads C1',
  };
  changed.forEach(n => ok(n in EXPECT, 'the change to ' + n + ' is accounted for'));
  ok(changed.length <= 4, 'X1 at most four functions changed: ' + changed.length);
  ['recomputeTotals', 'columnNumericMask', 'parseCPrograms', 'ingestComputed',
   'openSaveModal'].forEach(n => {
    ok(grabFn(n, SRC) === grabFn(n, BASE_SRC), 'X2 ' + n + ' is byte-identical to BASE');
  });
});
guard('X: the baseline', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X3 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: REPO }); anc = true; }
  catch (e) {}
  ok(anc, 'X4 and an ancestor of HEAD, so this group stacks on Group A');
});

lines.forEach(l => console.log(l));
console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n  ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
