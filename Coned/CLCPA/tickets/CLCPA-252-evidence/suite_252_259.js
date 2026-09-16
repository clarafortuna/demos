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
  /* ROUND 2 SUPERSEDES THIS. Round 1's claim was that a bald "Table A8"
   * became "Table A8. Residential Install" -- the short_title. Round 2's whole
   * point is that short_title is not what the stored years render, so A8:2023
   * now derives the full descriptive title from its newest sibling.
   *
   * Re-pinned rather than relaxed: the claim is still exact, it is just the
   * round-2 string. Round 1's own achievement -- that this caption is no
   * longer BALD -- is what T1b keeps, and that is the part this suite owns. */
  ok(cap(P.tables.A8, '2023') ===
     'Table A8. 2023 Installations by Measure Category for Residential Programs (Total and in DACs)',
     'T1 and it now reads "' + cap(P.tables.A8, '2023') + '"');
  ok(!/^Table A8$/.test(cap(P.tables.A8, '2023')),
     'T1c and it is not bald, which is what round 1 bought and round 2 keeps');
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
  /* ROUND 2 SUPERSEDES THE SHORT_TITLE FORM. Round 1 built a fresh year's
   * caption from the table's own short_title, and T2 above -- that nothing
   * renders bare -- is what round 1 actually bought and still holds.
   *
   * What changed is the SHAPE. short_title is not what the stored years
   * render, so round 2 derives the full descriptive title instead. These five
   * are re-pinned to the round-2 strings rather than relaxed to a pattern: a
   * tolerant assertion here would stop noticing a derivation that regressed.
   * The reach and the strategies are suite_252_r2's to prove; this suite only
   * has to show that round 1's claim survived the change to it. */
  const SAMPLE = {
    C1: 'Table C1. 2098 Summary of Con Edison Demand Response Programs',
    A8: 'Table A8. 2098 Installations by Measure Category for Residential Programs (Total and in DACs)',
    I1: 'Table I1. 2098 Year Totals',
    /* J8's donor carries a "|  Main  |  PDF page 55" tail, which the
     * derivation strips: a 2098 caption must not cite a 2025 page. */
    J8: 'Table J8. 2098 Amount Expended for EAP Discounts',
    /* C5's donor still reads "Summary4" HERE, because payload.json is the
     * frozen revert parachute and CLCPA-258 corrected the stored row in
     * Dataverse only. The divergence is recorded on the parachute item; this
     * assertion states what the FILE produces, which is what this suite
     * reads, rather than pretending the two agree. */
    C5: 'Table C5. 2098 Total Program Participation Summary4',
  };
  Object.keys(SAMPLE).forEach(id => {
    const got = cap(P.tables[id], '2098');
    ok(got === SAMPLE[id], 'T3 ' + id + ' -> "' + got + '"');
    ok(got !== 'Table ' + id + '. ' + P.tables[id].short_title,
       'T3b and ' + id + ' is no longer the round-1 short_title form');
  });
  /* D2 is the ONE table the derivation cannot reach -- its title reads
   * "Table D2.For All..." with no space after the period -- so it still takes
   * round 1's short_title path. Named, so "51 of 52" is a measured claim. */
  ok(cap(P.tables.D2, '2098') === 'Table D2. ' + P.tables.D2.short_title,
     'T4 D2 still falls back to short_title: "' + cap(P.tables.D2, '2098') + '"');
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
  /* Round 1's string was "Table A8. Residential Install"; round 2 derives the
   * full descriptive title instead. The CLAIM is unchanged -- BASE rendered a
   * bald caption and this build names the table -- so it is stated against
   * what the build actually produces rather than against round 1's wording. */
  ok(/Table A8\. 2023 Installations by Measure Category/.test(b),
     'Z4 this build names it: ' + (/(Table A8[^<]*)/.exec(b) || [])[1]);
  ok(/>Table A8</.test(a) || /Table A8\s*</.test(a),
     'Z4b and BASE rendered it bald: ' + JSON.stringify((/(Table A8[^<]*)/.exec(a) || [])[1]));
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
    dacCol: 'NOT this ticket: CLCPA-257, Section C group C: dacCols newest-year fallback',
    phantomSpacerCols: 'NOT this ticket: CLCPA-260, Section C group D: the phantom spacer columns, new',
    buildIngestWorkbook: 'NOT this ticket: CLCPA-260, Section C group D: the phantom spacer columns, the template stops emitting them',
    isDeclaredSummable: 'NOT this ticket: CLCPA-254, Section C group E: the declared-summable column, new',
    recomputeTotals: 'NOT this ticket: CLCPA-254, Section C group E: it consults that declaration',
    buildIngestImport: 'NOT this ticket: CLCPA-261, Section C group E: it collects the fraction notices',
    renderIngestImportResult: 'NOT this ticket: CLCPA-261, Section C group E: the summary announces them',
    deriveTableCaption: 'CLCPA-252 ROUND 2: the title derivation, new',
    deriveTableCaptionInfo: 'CLCPA-252 ROUND 2: the three strategies, new',
    declaredTableFromFilename: 'CLCPA-264: the filename extractor (new)',
    importIdentityNotice: 'CLCPA-264: the import identity advisory (new)',
    rowsForDisplay: 'CLCPA-263: it derives the value (pct) composites on its clone',
    applyCompositeShares: 'CLCPA-263: the derivation (new)',
    isCompositeShareCol: 'CLCPA-263: the declaration predicate (new)',
    compositeValueText: 'CLCPA-263: the value formatting (new)',
    bareNumber: 'CLCPA-263: the bare-number test (new)',
    openAddYearDialog: 'CLCPA-264: it attaches the advisory to the plan',
    stagedBlock: 'CLCPA-264: nested in openAddYearDialog, it renders the advisory',
    wire: 'CLCPA-264: nested in openAddYearDialog, it holds the call site',
    renderIngestImportResult: 'CLCPA-264: the result panel announces the advisory',
  };
  changed.forEach(n => ok(n in EXPECT, 'the change to ' + n + ' is accounted for'));
  /* THIS GROUPS four, plus whatever the groups stacked ON TOP add. Named, not
   * counted loosely: an unnamed change still turns X1 red. */
  const LATER = { dacCol: 'CLCPA-257, group C', phantomSpacerCols: 'CLCPA-260, group D',
    renderIngestEditor: 'CLCPA-252 AND CLCPA-260 both touch it; group D is the later one',
    buildIngestWorkbook: 'CLCPA-260, group D',
    isDeclaredSummable: 'CLCPA-254, group E', recomputeTotals: 'CLCPA-254, group E',
    buildIngestImport: 'CLCPA-261, group E', renderIngestImportResult: 'CLCPA-261, group E',
    /* CLCPA-263, later still: the composite shares on the display clone. */
    rowsForDisplay: 'CLCPA-263', applyCompositeShares: 'CLCPA-263',
    isCompositeShareCol: 'CLCPA-263', compositeValueText: 'CLCPA-263',
    bareNumber: 'CLCPA-263',
    /* ROUND 2 of this very ticket. It stacks on round 1, so from this
     * suite's point of view the two derivation functions belong to a
     * later round -- and tableCaption is claimed by BOTH, which is why
     * X1b still counts exactly two as uniquely round 1's. */
    deriveTableCaption: 'CLCPA-252 round 2', deriveTableCaptionInfo: 'CLCPA-252 round 2',
    declaredTableFromFilename: 'CLCPA-264', importIdentityNotice: 'CLCPA-264',
    openAddYearDialog: 'CLCPA-264', stagedBlock: 'CLCPA-264', wire: 'CLCPA-264',
    renderIngestImportResult: 'CLCPA-264',
    tableCaption: 'CLCPA-252 round 1 AND round 2; round 2 is the later one' };
  const mine = changed.filter(n => !(n in LATER));
  changed.forEach(n => ok(n in EXPECT || n in LATER,
    'X1 ' + n + ' is accounted for' + (n in LATER ? ' (' + LATER[n] + ')' : '')));
  /* renderIngestEditor is claimed by BOTH this group (the caption) and group D
   * (the spacer filter), so it counts in LATER and three remain uniquely
   * this group's. The caption call site itself is asserted in T7. */
  /* renderIngestEditor and renderSectionC are claimed by LATER groups too --
   * group D filters spacer columns in the editor, and group C touched nothing
   * there but group D did. Two remain uniquely this group's: the caption
   * helper and the report page that calls it. The editor's caption call site
   * is asserted directly in T7, so nothing goes unguarded. */
  /* ROUND 2 TOOK tableCaption OUT OF "uniquely this group's". Round 1 created
   * that helper and round 2 gave it a derivation to consult, so it is claimed
   * by both and counts in LATER -- the same treatment renderIngestEditor and
   * renderSectionC already get. ONE function remains uniquely round 1's: the
   * report page that calls the helper. The helper's own creation is not left
   * unguarded by this -- T1 and T3 drive it directly, and suite_252_r2 owns
   * the derivation. */
  ok(mine.length === 1 && mine.indexOf('renderSourceTables') >= 0,
     'X1b ONE function is uniquely round 1s, the report page: ' + mine.sort().join(', '));
  ok(changed.indexOf('tableCaption') >= 0,
     'X1c and tableCaption still moved, claimed by round 1 and round 2 both');
  /* recomputeTotals left this list under CLCPA-254, which puts one declared
   * column back in the sum. It is named in EXPECT and in LATER above instead,
   * so the change stays accounted for, just not as "untouched". */
  ['columnNumericMask', 'parseCPrograms', 'ingestComputed',
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
