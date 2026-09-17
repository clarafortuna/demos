/* CLCPA-270 -- one locking model, driven through the SHIPPED renderer.
 *
 * suite_270_census proves WHICH rows changed across all 149 table-years.
 * This proves the model itself: that one role decides all three protections,
 * that the role comes from the label and not from this year's arithmetic, and
 * that the rendered grid actually reflects it -- a locked label must have no
 * <input>, a locked row must have no delete button.
 *
 * BASE predates the change: ca4c90a, main before this package.
 *
 * Run:  node suite_270.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
/* PINNED ON BOTH SIDES (CLAUDE.md), the standing model. The post-change
 * side reads 83fd9c1, this ticket's own commit, because a
 * blast-radius claim can only be true at the commit that made the change
 * -- never on a tip that also carries the tickets merged after it.
 * DAC_APP_OVERRIDE still wins, so the mutation runner keeps working. */
const NEWREV = process.env.DAC_NEW_COMMIT || '83fd9c1';
const BASE = process.env.DAC_BASE_COMMIT || 'ca4c90a';
const APP = process.env.DAC_APP_OVERRIDE || ('git show ' + NEWREV + ':' + REL);
const SRC = process.env.DAC_APP_OVERRIDE
  ? fs.readFileSync(process.env.DAC_APP_OVERRIDE, 'utf8')
  : execSync('git show ' + NEWREV + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
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
const run = api(SRC, ['ingestRowRole', 'ingestRoleOpen', 'INGEST_ROLE_OPEN', 'isTotalRoleLabel',
  'isComputedShareLabel', 'isStrictTotalRowLabel', 'isAnchoredTotalRowLabel',
  'HIERARCHICAL_TABLES']);

log('======================================================================');
log('CLCPA-270 -- one locking model, keyed on the row\'s structural role');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the role, and that it is the LABEL's ---------------------------- */
log('');
log('A. THE ROLE COMES FROM THE LABEL');
guard('A-block', () => {
  /* CALLED THROUGH THE RESOLVER, not extracted from it. Pulling the function
   * out and invoking it afterwards leaves any closure it has not yet reached
   * unresolved: A1-A4 passed and A5 threw on isHierarchicalTotalLabel, which
   * only the hierarchical branch touches. The documented limit of this
   * harness, hit again. */
  const role = (l, t, h) => run(a => a.ingestRowRole(l, t, h));
  ok(/^function ingestRowRole\b/.test(String(run(a => a.ingestRowRole))),
    'A0 the function under test is the one sliced from app.js');

  ok(role('Total', 'B1', false) === 'total', 'A1 "Total" in a flat table is a total');
  ok(role('Grand Total', 'B1', false) === 'total', 'A2 "Grand Total" too');
  ok(role('County Total', 'G2', false) === 'total',
    'A3 "County Total" is a total -- the anchored form, which the strict one misses');
  ok(role('Commercial Total', 'A5', false) === 'total',
    'A4 a hierarchical group total is a total');
  ok(role('Commercial Programs Total Installations', 'A5', false) === 'total',
    'A5 including one that carries the word in the MIDDLE, inside the declared family');
  ok(role('% of total in DAC', 'J8', false) === 'computed',
    'A6 a percentage OF A TOTAL is computed, not a total');
  ok(role('% of Grand Total', 'F7', false) === 'computed',
    'A7 and the same rule reaches F7');
  ok(role('Manhattan', 'H1', false) === 'data', 'A8 an ordinary row is data');
  ok(role('anything', 'H1', true) === 'header', 'A9 a structural header wins over everything');
  ok(role('Total', 'A5', true) === 'header',
    'A10 a group header carrying the word "total" is a HEADER, not a total');
  /* and the ORDER matters: the computed-share test must sit BELOW the header
   * test, or a header row whose caption happens to read like a share would be
   * classified as computed. A10 alone cannot see that -- "Total" is not a
   * share label -- so the case is made explicit. */
  ok(role('% of total in DAC', 'J8', true) === 'header',
    'A10b and a header whose caption reads like a computed share is still a HEADER');

  /* THE CLCPA-200 DATA ROW. An unanchored match claimed it and blanked 30
   * cells; the role model must not repeat that. */
  ok(role('Total amount of residential electric usage (kWh)', 'J1', false) === 'data',
    'A11 J1\'s "Total amount of residential electric usage (kWh)" is DATA');
  ok(role('Total amount of residential gas usage (ccf)', 'J2', false) === 'data',
    'A12 and J2\'s equivalent');

  /* the denominator-not-in-the-table percentages stay the preparer's */
  ['Percentage of projects in DACs', 'Percentage MW installed in DACs',
   'Percentage of subscribers in DACs'].forEach((l, i) => {
    ok(role(l, 'D4', false) === 'data',
      'A13.' + (i + 1) + ' ' + JSON.stringify(l.slice(0, 34)) + ' stays DATA');
  });
});

/* ---- B. one role, three protections ------------------------------------ */
log('');
log('B. ONE ROLE DECIDES ALL THREE PROTECTIONS');
guard('B-block', () => {
  const open = run(a => a.INGEST_ROLE_OPEN);
  ok(Object.keys(open).sort().join(',') === 'computed,data,header,total',
    'B1 exactly four roles are declared: ' + Object.keys(open).sort().join(','));
  ['header', 'total', 'computed'].forEach((r) => {
    ok(open[r].label === false && open[r].values === false && open[r].deletable === false,
      'B2 ' + r + ' is closed on all three');
  });
  ok(open.data.label && open.data.values && open.data.deletable,
    'B3 data is open on all three');
  /* no role may be half-open: that was the old model's shape and the source
   * of "value-locked but still deletable" */
  Object.keys(open).forEach((r) => {
    const v = [open[r].label, open[r].values, open[r].deletable];
    ok(v.every(x => x === v[0]),
      'B4 ' + r + ' is not half-open -- ' + JSON.stringify(v));
  });

  /* ---- THE A8 AMENDMENT (Emely's ruling, option b) ---------------------- *
   * The TABLE stays all-or-nothing, above. The half-open shape is produced
   * by the ACCESSOR and only for a total the engine declines, which is the
   * whole of the ruling: structure to the system, a non-derivable figure to
   * the only person who can supply it. Driven on the real function, both
   * ways, for every role -- a structural pin would not notice the accessor
   * returning the wrong object. */
  const roleOpen = (role, derives) => run(a => a.ingestRoleOpen(role, derives));
  const shape = (o) => [o.label ? 'L+' : 'L-', o.values ? 'V+' : 'V-',
    o.deletable ? 'D+' : 'D-'].join(' ');
  ok(shape(roleOpen('total', true)) === 'L- V- D-',
    'B5 a total the engine DERIVES is locked in full -- ' +
    shape(roleOpen('total', true)));
  ok(shape(roleOpen('total', false)) === 'L- V+ D-',
    'B5b a total the engine does NOT derive keeps typeable values -- ' +
    shape(roleOpen('total', false)));
  ok(shape(roleOpen('computed', false)) === 'L- V- D-',
    'B5c a COMPUTED share row is unaffected: derivable by construction -- ' +
    shape(roleOpen('computed', false)));
  ok(shape(roleOpen('header', false)) === 'L- V- D-',
    'B5d a header row is unaffected -- ' + shape(roleOpen('header', false)));
  ok(shape(roleOpen('data', false)) === 'L+ V+ D+' &&
     shape(roleOpen('data', true)) === 'L+ V+ D+',
    'B5e a data row is unaffected either way');
  /* the half-open shape must move ONLY the value bit */
  const lockedT = roleOpen('total', true), openT = roleOpen('total', false);
  ok(lockedT.label === openT.label && lockedT.deletable === openT.deletable &&
     lockedT.values !== openT.values,
    'B5f and the amendment moves the VALUE bit alone -- label and delete are ' +
    'identical on both sides');
  /* it must not mutate the shared table: a returned object that IS the table
   * row would make the first typeable total unlock every total after it */
  /* IN ONE CLOSURE, because every run() rebuilds the module and a fresh table
   * cannot show damage done to a previous one. The first version of this
   * assertion asked in a second run() and therefore could not fail: the
   * mutation control that writes `base.values = true` sailed through it green,
   * which is how it was caught. */
  const leak = run((a) => {
    const asked = a.ingestRoleOpen('total', false);
    return { asked: asked.values, table: a.INGEST_ROLE_OPEN.total.values,
             again: a.ingestRoleOpen('total', true).values };
  });
  ok(leak.asked === true && leak.table === false && leak.again === false,
    'B5g and asking for the open shape did not mutate the declared table -- ' +
    'asked ' + leak.asked + ', table still ' + leak.table +
    ', next derivable total still ' + leak.again);
});

/* ---- C. arithmetic is not an arbiter ----------------------------------- */
log('');
log('C. THE SAME ROW, THE SAME PROTECTION, WHATEVER ITS FIGURES');
guard('C-block', () => {
  const role = run(a => a.ingestRowRole);
  /* A3's "Total" flapped between years because arithmetic flapped. The role
   * takes no data at all, so it cannot. */
  ok(role.length === 3,
    'C1 ingestRowRole takes exactly three arguments -- label, table, header (' +
    role.length + ')');
  const code = codeOnly(SRC);
  const body = code.slice(code.indexOf('function ingestRowRole'),
    code.indexOf('const INGEST_ROLE_OPEN'));
  ok(!/totalRowFlags|editorTotalFlags|rowHasNumber|withinSourceRounding/.test(body),
    'C2 and its body consults NO arithmetic');
  ok(!/\[\s*\d+\s*\]/.test(body),
    'C3 nor any cell value by index');
});

/* ---- D. the rendered grid actually reflects it -------------------------- */
log('');
log('D. THE RENDERED GRID');
guard('D-block', () => {
  const code = codeOnly(SRC), base = codeOnly(BASE_SRC);
  ok(/const rowRole = ingestRowRole\(row\[0\], i\.tableId, structuralHeader\);/.test(code),
    'D1 the renderer derives one role per row');
  ok(/const roleOpen = ingestRoleOpen\(rowRole, !!editorTotalFlags\[rowIdx\]\);/.test(code),
    'D2 and reads its protections from the one accessor, asking the derive ' +
    'engine about THIS row');
  ok(!/INGEST_ROLE_OPEN\[rowRole\]/.test(code),
    'D2a the role table is no longer read directly by the renderer');
  /* the amendment must not have leaked into the STYLING: a total the preparer
   * has to type is still a total row and must still read as one */
  ok(/const isTotalRole = rowRole === 'total' \|\| rowRole === 'computed';/.test(code),
    'D2b the renderer keeps a separate "is this a total row" question');
  ok(/isTotalRole \? ' class="ingest-row-total"'/.test(code),
    'D2c and the row class follows THAT, not the value lock');
  ok(/isTotalOnlyDerived\(dDesc\) && !isTotalRole/.test(code),
    'D2d as does the total-only derived-column gate');
  ok(/const lockTotalRow = !roleOpen\.label && !isHeaderRow;/.test(code),
    'D3 the label lock is the role\'s');
  ok(/const isTotal = !roleOpen\.values && !isHeaderRow;/.test(code),
    'D4 the value lock is the role\'s');
  ok(/\$\{!roleOpen\.deletable \? ''/.test(code),
    'D5 the delete button is the role\'s');

  ok(/lockTotalRow = isTotal && isHierFamily && !isHeaderRow/.test(base),
    'D6 on BASE the label lock was gated on ARITHMETIC and on the family');
  ok(!/lockTotalRow = isTotal && isHierFamily/.test(code),
    'D7 and that gate is gone');
  ok(/\(isHeaderRow \|\| lockTotalRow \|\| isTotal\) \? ''/.test(base),
    'D8 on BASE the delete button re-derived its own three-way test');

  /* the footer note explains the grey rows, so it must follow the same rule */
  ok(/ingestRowRole\(r\[0\], i\.tableId, hdr\) !== 'data'/.test(code),
    'D9 the "auto-calculated" footer note follows the role too');
  ok(/editorTotalFlags\.some\(Boolean\)/.test(base) &&
     !/editorTotalFlags\.some\(Boolean\)/.test(code),
    'D10 where BASE asked the arithmetic flags');
});

/* ---- E. style of change ------------------------------------------------- */
log('');
log('E. STYLE OF CHANGE');
guard('E-block', () => {
  const code = codeOnly(SRC);
  const added = SRC.split('\r\n').filter(l => BASE_SRC.indexOf(l) < 0);
  const codeAdded = added.filter(l => l.trim() && !/^\s*[*/]/.test(l.trim()));
  log('     added code lines: ' + codeAdded.length);
  ok(!codeAdded.some(l => /['"][A-J]\d+['"]/.test(l)),
    'E1 no added code line names a table id');
  ok(!codeAdded.some(l => /County Total|Systemwide|CES Programs|of total in DAC/.test(l)),
    'E2 nor a row label');
  /* the derive engine keeps its arithmetic */
  ok(/function totalRowFlags\(/.test(code),
    'E3 totalRowFlags survives -- it is the derive engine\'s, not protection\'s');
  ok(/recomputeTotals\(state\.ingest\.draft/.test(code),
    'E4 and recomputeTotals still runs on edit');
  /* no stored data */
  ok(code.indexOf('cr2bf_schema:') < 0, 'E5 nothing writes a schema');
  ok(/cr2bf_rows: JSON\.stringify\(newRows\)/.test(code), 'E6 a save still writes rows only');
  /* the classifier lineage is reused, not re-invented */
  ok(/isAnchoredTotalRowLabel\(v\)/.test(code) && /isHierarchicalTotalLabel\(v\)/.test(code),
    'E7 the role reuses the shipped classifiers rather than a fourth regex');
});

/* ---- X. the harness ----------------------------------------------------- */
log('');
log('X. THE HARNESS');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  const m = /const BASE = process\.env\.DAC_BASE_COMMIT \|\| '([0-9a-f]+)';/.exec(self);
  ok(!!m && /^[0-9a-f]{7,40}$/.test(m[1]),
    'X1 BASE is pinned to a literal commit sha -- got ' + (m ? m[1] : 'none'));
  ok(BASE_SRC.indexOf('function ingestRowRole(') < 0,
    'X2 and that baseline really predates this ticket');
  ok(P && P.tables && Object.keys(P.tables).length > 40,
    'X3 the payload the role was measured against is present (' +
    Object.keys(P.tables).length + ' tables)');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-270-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
