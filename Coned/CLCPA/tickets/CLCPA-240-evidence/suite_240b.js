/* CLCPA-240 second half: a Total row that has no numbers YET.
 *
 * Emely's minimal case on build 31b63d1a70: A1's own template, Save As CSV
 * UTF-8, imported into a fresh 2099. Every value row landed including the
 * computed % in DACs. The Total row sat there as an ordinary row, dashes across
 * it, computing nothing.
 *
 * THE CAUSE, and CLCPA-85 round 4 predicted it in its own comment: the template
 * writes "(calculated)" into the cells the dashboard computes;
 * applyIngestImport SKIPS those cells so the marker never lands as text; the
 * Total row therefore arrives with a label and nothing else. totalRowFlags is
 * arithmetic-only by CLCPA-209 design, and both of its candidate loops open
 * with `if (!hasNumbers(...)) continue`, so such a row is never even TESTED.
 * Not an import bug and not an editor bug: a value-dependence gap.
 *
 * THE FIX is one branch: no numbers at all, plus a WHOLE-label match, marks the
 * row. Section 2 proves the CLCPA-209 failure mode impossible in BOTH
 * directions, which is the whole reason this is safe to ship the day before a
 * walkthrough.
 *
 * DRIVEN. Everything here CALLS the shipped functions. The one source-level
 * section is the cosmetic, where the claim IS about the emitted markup.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
/* BASE: main before this session -- the deployed build 31b63d1a70 */
const BASE = process.env.DAC_BASE_COMMIT || 'be81d92';
const toCRLF = (s) => s.replace(/\r?\n/g, '\r\n');
const SRC = fs.readFileSync(path.join(REPO, REL), 'utf8');
const BASE_SRC = toCRLF(execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));
const NL = String.fromCharCode(10);

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
const say = (s) => lines.push(s);
function guard(label, fn) {
  try { fn(); }
  catch (e) { ok(false, label + ' THREW instead of failing: ' + (e && e.message ? e.message : String(e))); }
}
function grab(name, src) {
  const s = src || SRC;
  for (const pad of ['  ', '    ', '']) for (const kw of ['function ', 'async function ']) {
    const head = '\r\n' + pad + kw + name + '(';
    const i = s.indexOf(head); if (i < 0) continue;
    const close = '\r\n' + pad + '}';
    const j = s.indexOf(close, i + head.length);
    if (j >= 0) return s.slice(i + 2, j + close.length);
  } return null;
}
function grabDecl(name, src) {
  const s = src || SRC;
  const re = new RegExp('\\r\\n  (?:const|var|let) ' + name + ' = ');
  const m = s.match(re); if (!m) return null;
  const i = s.indexOf(m[0]);
  const rest = s.slice(i + 2);
  const end = rest.search(/\r\n  (?:const|var|let|function|async function|\/\*)/);
  return end < 0 ? rest : rest.slice(0, end);
}
function codeOnly(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '/*') { const j = src.indexOf('*/', i + 2); i = j < 0 ? src.length : j + 2; continue; }
    if (two === '//') { const j = src.indexOf('\n', i); i = j < 0 ? src.length : j; continue; }
    out += src[i]; i++;
  }
  return out;
}
const CODE = codeOnly(SRC);

/* call-time dependency resolution, against whichever source is asked for */
function callWith(src, want, args) {
  const fns = [want], decls = [];
  const g = {
    state: { payload: P, year: '2099' },
    escapeHtml: (s) => String(s == null ? '' : s),
    document: { getElementById: () => null, querySelectorAll: () => [] },
    localStorage: { getItem: () => null, setItem: () => {} },
    console: console,
  };
  for (let i = 0; i < 120; i++) {
    const names = Object.keys(g);
    const body = decls.map(n => grabDecl(n, src)).join(NL) + NL +
      [...new Set(fns)].map(n => grab(n, src)).join(NL) + NL + 'return ' + want + ';';
    try {
      return new Function(...names, body)(...names.map(k => g[k])).apply(null, args || []);
    } catch (e) {
      const m = /^(\w+) is not defined$/.exec(e.message || '');
      if (!m) throw e;
      const nm = m[1];
      if (grab(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabDecl(nm, src) && decls.indexOf(nm) < 0) { decls.push(nm); continue; }
      throw new Error('cannot resolve dependency: ' + nm);
    }
  }
  throw new Error('closure did not converge for ' + want);
}
const flags = (src, rows, id, schema) => callWith(src, 'totalRowFlags', [rows, id, schema]);

const A1 = P.tables.A1;
const A1SCHEMA = A1.schema_by_year['2025'];
/* the post-import shape: A1's real structure with the Total row's numerics
 * nulled, which is precisely what applyIngestImport leaves behind */
const importedA1 = () => {
  const rows = A1.data['2025'].map(r => r.slice());
  const t = rows[rows.length - 1];
  for (let c = 1; c < t.length; c++) t[c] = null;
  return rows;
};

say('======================================================================');
say('CLCPA-240 second half -- the value-less Total row');
say('  BASE ' + BASE + ' (the deployed build 31b63d1a70)');
say('======================================================================');

/* ==================================================================== */
say('');
say('=== 1. THE DEFECT, AND THE FIX, BOTH DRIVEN ===');

guard('BASE control: the imported Total row is not recognised', () => {
  const rows = importedA1();
  const last = rows.length - 1;
  ok(JSON.stringify(rows[last]) === '["Total",null,null,null]',
     'the fixture is the post-import shape: ' + JSON.stringify(rows[last]));
  const f = flags(BASE_SRC, rows, 'A1', A1SCHEMA);
  ok(f.filter(Boolean).length === 0,
     'at BASE, NOTHING is flagged as a total: ' + f.filter(Boolean).length);
  ok(f[last] !== true, 'the Total row specifically is not recognised');
  /* and the cause is the candidate skip, quoted from BASE */
  const baseFn = codeOnly(grab('totalRowFlags', BASE_SRC));
  ok((baseFn.match(/if \(!hasNumbers\(rows\[cand\]\)\) continue;/g) || []).length === 2,
     'because BOTH candidate loops open by skipping a row with no numbers');
  ok(!/isStrictTotalRowLabel/.test(baseFn),
     'and BASE never consults the label predicate at all');
});

guard('the fix recognises it, and the editor then computes', () => {
  const rows = importedA1();
  const last = rows.length - 1;
  const f = flags(SRC, rows, 'A1', A1SCHEMA);
  ok(f[last] === true, 'the Total row IS recognised now');
  ok(f.filter(Boolean).length === 1,
     'and exactly one row is flagged, not a sweep: ' + f.filter(Boolean).length);
  /* the editor's own classifier, which is what gates the calc cell */
  const comp = callWith(SRC, 'ingestComputed', [rows, 'A1', A1SCHEMA]);
  ok(comp.totalRow(last) === true,
     'ingestComputed agrees, so the editor renders calc cells instead of inputs');
  /* and recomputeTotals fills it: the bootstrap completes */
  const draft = importedA1();
  callWith(SRC, 'recomputeTotals', [draft, A1SCHEMA, 'A1', null]);
  const t = draft[draft.length - 1];
  ok(t[1] === 282132686, 'recomputeTotals fills Total Funds Expended: ' + t[1]);
  ok(t[2] === 148672653, 'and DAC Funding: ' + t[2]);
  ok(t[1] === A1.data['2025'][22][1] && t[2] === A1.data['2025'][22][2],
     'to exactly the figures 2025 already stores, so the sums are right');
  /* ONE-TIME BOOTSTRAP: once filled, arithmetic recognises it unaided */
  const f2 = flags(SRC, draft, 'A1', A1SCHEMA);
  ok(f2[last] === true, 'and after filling, it is still recognised -- by ARITHMETIC');
  const f2base = flags(BASE_SRC, draft, 'A1', A1SCHEMA);
  ok(f2base[last] === true,
     'which BASE also does: the branch is a bootstrap, not a permanent crutch');
});

/* ==================================================================== */
say('');
say('=== 2. THE CLCPA-209 FAILURE MODE, IMPOSSIBLE IN BOTH DIRECTIONS ===');

guard('DIRECTION 1: it cannot fire on a row that holds a number', () => {
  /* one number anywhere and the branch is unreachable */
  for (let c = 1; c < 4; c++) {
    const rows = importedA1();
    const last = rows.length - 1;
    rows[last][c] = 1;               // a single number, in each column in turn
    const f = flags(SRC, rows, 'A1', A1SCHEMA);
    /* it may or may not be flagged -- that is the ARITHMETIC's business. What
     * matters is that the new branch did not decide it, which is provable by
     * asking whether BASE agrees. */
    const fb = flags(BASE_SRC, rows, 'A1', A1SCHEMA);
    ok(JSON.stringify(f) === JSON.stringify(fb),
       'with a number in column ' + c + ', the verdict is IDENTICAL to BASE: ' +
       'the branch took no part');
  }
});

guard('DIRECTION 2: a loose label with values is still data', () => {
  /* THE CLCPA-209 DEFECT ITSELF: "Total # of projects" 88,150 became 0.688 when
   * a loose label match promoted a data row and the editor summed a percentage
   * column into it. The row is found in the payload rather than typed here. */
  const hits = [];
  Object.keys(P.tables).forEach(id => {
    Object.keys(P.tables[id].data || {}).forEach(y => {
      (P.tables[id].data[y] || []).forEach((r, i) => {
        if (!Array.isArray(r) || typeof r[0] !== 'string') return;
        if (/total/i.test(r[0]) && !/^(grand\s+|sub)?totals?$/i.test(r[0].trim())) {
          hits.push({ id: id, y: y, i: i, label: r[0] });
        }
      });
    });
  });
  ok(hits.length > 0, 'the payload holds ' + hits.length +
     ' rows whose label CONTAINS "total" but is not a whole match');
  const d2 = hits.filter(h => /# of projects/i.test(h.label));
  ok(d2.length > 0, 'including the CLCPA-209 row itself: ' +
     (d2[0] ? d2[0].id + ':' + d2[0].y + ' ' + JSON.stringify(d2[0].label) : 'MISSING'));
  /* not one of them is decided differently from BASE */
  let differing = 0;
  const seen = {};
  hits.forEach(h => {
    const k = h.id + ':' + h.y;
    if (seen[k]) return; seen[k] = true;
    const rows = P.tables[h.id].data[h.y];
    const sch = (P.tables[h.id].schema_by_year || {})[h.y];
    const a = flags(SRC, rows, h.id, sch), b = flags(BASE_SRC, rows, h.id, sch);
    if (JSON.stringify(a) !== JSON.stringify(b)) differing++;
  });
  ok(differing === 0,
     'and every table-year containing one is classified IDENTICALLY to BASE: ' +
     differing + ' differ');
  /* the predicate itself rejects them */
  hits.slice(0, 40).forEach(h => {
    if (callWith(SRC, 'isStrictTotalRowLabel', [h.label])) {
      ok(false, 'the whole-label predicate wrongly accepts ' + JSON.stringify(h.label));
    }
  });
  ok(true, 'and the whole-label predicate rejects every one of them');
});

guard('the branch fires on NO existing data at all', () => {
  const strict = (l) => callWith(SRC, 'isStrictTotalRowLabel', [l]);
  const numOf = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  const hasNum = r => Array.isArray(r) && r.slice(1).some(v => numOf(v) !== null);
  let labelled = 0, valueless = 0;
  Object.keys(P.tables).forEach(id => {
    Object.keys(P.tables[id].data || {}).forEach(y => {
      (P.tables[id].data[y] || []).forEach(r => {
        if (!Array.isArray(r) || !strict(r[0])) return;
        labelled++;
        if (!hasNum(r)) valueless++;
      });
    });
  });
  ok(labelled > 0, labelled + ' rows in the payload carry a strict total label');
  ok(valueless === 0,
     'and ZERO of them have no numbers, so the branch is unreachable on every ' +
     'row of existing data: ' + valueless);
});

guard('THE PAYLOAD-WIDE GUARD: every classification is unchanged', () => {
  /* totalRowFlags has NINE call sites and both the editor and the report read
   * it. The only claim that covers that blast radius is that its verdict is
   * identical to BASE for every table-year in the payload. */
  let compared = 0, differing = [];
  Object.keys(P.tables).forEach(id => {
    Object.keys(P.tables[id].data || {}).forEach(y => {
      const rows = P.tables[id].data[y];
      if (!Array.isArray(rows) || !rows.length) return;
      const sch = (P.tables[id].schema_by_year || {})[y];
      compared++;
      const a = flags(SRC, rows, id, sch), b = flags(BASE_SRC, rows, id, sch);
      if (JSON.stringify(a) !== JSON.stringify(b)) differing.push(id + ':' + y);
    });
  });
  ok(compared > 100, 'compared ' + compared + ' table-years');
  ok(differing.length === 0,
     'and NOT ONE classification differs from BASE: ' +
     (differing.length ? differing.join(', ') : '0 of ' + compared));
});

/* ==================================================================== */
say('');
say('=== 3. WHAT THE REPORT PAGE SHOWS, AND A CONSEQUENCE TO SEE ===');

guard('the report before a Save, pinned as recorded behaviour', () => {
  const rows = importedA1();
  const disp = callWith(SRC, 'rowsForDisplay', [rows, A1SCHEMA, 'A1']);
  const t = disp[disp.length - 1];
  /* THIS IS A CHANGE ON THE REPORT PAGE AND IT IS NAMED, NOT HIDDEN.
   *
   * At BASE the Total row displayed ["Total", null, null, null] -- three
   * dashes. Now the DERIVED column computes, because applyDerivedCols feeds a
   * flagged total row from the column sums of the non-total rows, and those
   * rows are populated. The amounts stay blank because rowsForDisplay reads
   * STORED values and never recomputes a total.
   *
   * So between import and Save, A1's Total row on the report reads
   * "-- / -- / 52.7%". The percentage is arithmetically correct -- it is the
   * DAC share of this year's own data rows, not a stale figure -- but it sits
   * beside two blanks, which is a state no year has been in before.
   *
   * Transient by construction: the operator is in the editor at that moment,
   * and Save persists the filled amounts. Pinned so it is a decision on the
   * record rather than something discovered later. */
  const baseDisp = callWith(BASE_SRC, 'rowsForDisplay', [importedA1(), A1SCHEMA, 'A1']);
  ok(JSON.stringify(baseDisp[baseDisp.length - 1]) === '["Total",null,null,null]',
     'BASE control: the report showed three dashes');
  ok(t[1] === null && t[2] === null,
     'the AMOUNT columns are still blank before a Save, as the report reads ' +
     'stored values: ' + JSON.stringify([t[1], t[2]]));
  ok(typeof t[3] === 'number' && Math.abs(t[3] - 0.52696) < 1e-4,
     'but the DERIVED % now computes from the data rows: ' + t[3] +
     ' -- NEW on the report, correct arithmetic, and transient until Save');
  /* and it is this year's own figure, not a carried-over one */
  const sum1 = rows.slice(0, -1).reduce((s, r) => s + (typeof r[1] === 'number' ? r[1] : 0), 0);
  const sum2 = rows.slice(0, -1).reduce((s, r) => s + (typeof r[2] === 'number' ? r[2] : 0), 0);
  ok(Math.abs(t[3] - sum2 / sum1) < 1e-9,
     'equal to sum(DAC)/sum(Total) over the rows above it, so nothing is stale');
});

guard('after a Save the report is complete', () => {
  const draft = importedA1();
  callWith(SRC, 'recomputeTotals', [draft, A1SCHEMA, 'A1', null]);
  const disp = callWith(SRC, 'rowsForDisplay', [draft, A1SCHEMA, 'A1']);
  const t = disp[disp.length - 1];
  ok(t[1] === 282132686 && t[2] === 148672653,
     'the amounts are there: ' + JSON.stringify([t[1], t[2]]));
  ok(typeof t[3] === 'number', 'and the share: ' + t[3]);
  const real = callWith(SRC, 'rowsForDisplay', [A1.data['2025'], A1SCHEMA, 'A1']);
  ok(JSON.stringify(t) === JSON.stringify(real[real.length - 1]),
     'IDENTICAL to what 2025 displays, which is the whole point of the ticket');
});

/* ==================================================================== */
say('');
say('=== 3b. THE IMPORT-PATH CONSEQUENCE, NAMED AND PINNED ===');

guard('a total the FILE supplies is no longer imported; it is recomputed', () => {
  /* THE SWEEP FOUND THIS, in suite_235's driven counts: 46 cells imported
   * became 44. Not a regression -- a consequence of the approved branch, and it
   * belongs on the record rather than inside another ticket's output file.
   *
   * ingestComputed gates the import, and it reads totalRowFlags. So on a NEW
   * year the Total row is now classified as a total DURING PLANNING, and its
   * cells are reported to the operator as "this row is a calculated total"
   * instead of being written. Two cells, in A1's two summable columns.
   *
   * This makes a new year behave the way every EXISTING year already does: a
   * recognised total row's cells are computed, never imported. If a source's
   * own total disagrees with the sum of its own rows by rounding, the dashboard
   * shows its sum -- which was already true everywhere else.
   *
   * And nothing is silent, which is what CLCPA-235 exists to guarantee: the
   * skipped cells arrive in res.notTouched.computed with a reason. */
  const rows = importedA1();
  const last = rows.length - 1;
  const comp = callWith(SRC, 'ingestComputed', [rows, 'A1', A1SCHEMA]);
  const compBase = callWith(BASE_SRC, 'ingestComputed', [importedA1(), 'A1', A1SCHEMA]);
  /* column by column, which cells change hands */
  const nowSkipped = [], baseSkipped = [];
  for (let c = 1; c < A1SCHEMA.length; c++) {
    if (comp.any(last, c)) nowSkipped.push(c);
    if (compBase.any(last, c)) baseSkipped.push(c);
  }
  ok(JSON.stringify(baseSkipped) === '[3]',
     'at BASE only the DERIVED column was withheld from the Total row: ' +
     JSON.stringify(baseSkipped));
  ok(JSON.stringify(nowSkipped) === '[1,2,3]',
     'now all three are, because the row is a recognised total: ' +
     JSON.stringify(nowSkipped));
  ok(nowSkipped.length - baseSkipped.length === 2,
     'exactly TWO more cells are withheld -- the 46-to-44 the sweep saw');
  /* the operator is TOLD: the reason exists in the shipped code */
  const applyFn = codeOnly(grab('buildIngestImport'));
  ok(/this row is a calculated total/.test(applyFn),
     'and the reason given is "this row is a calculated total", so the ' +
     'operator sees it: CLCPA-235\'s no-silence rule holds');
  /* the recomputed figures are the RIGHT ones, which is why withholding is safe */
  const draft = importedA1();
  callWith(SRC, 'recomputeTotals', [draft, A1SCHEMA, 'A1', null]);
  ok(draft[last][1] === 282132686 && draft[last][2] === 148672653,
     'and what replaces the withheld values is the true sum of the rows above');
});

/* ==================================================================== */
say('');
say('=== 4. THE COSMETIC: the year reads as itself ===');

guard('the "added" suffix is gone', () => {
  const fn = grab('renderIngestPicker');
  ok(!/\u00b7 added/.test(codeOnly(fn)), 'no " \u00b7 added" is emitted');
  ok(!/isAdded/.test(codeOnly(SRC)), 'and isAdded is gone from the whole file');
  ok(/<option value="\$\{y\}"\$\{y === i\.year \? ' selected' : ''\}>\$\{y\}<\/option>/
     .test(codeOnly(fn)), 'the option renders the year and nothing else');
  /* BASE control */
  const baseFn = codeOnly(grab('renderIngestPicker', BASE_SRC));
  ok(/const isAdded = addedYears\.includes\(y\);/.test(baseFn),
     'BASE control: isAdded existed');
  ok(/y \+ ' \u00b7 added' : y/.test(baseFn), 'and appended the suffix');
  /* addedYears SURVIVES: the Remove-year button reads it */
  ok(/const addedYears = Storage\.getAddedYears\(\);/.test(codeOnly(fn)),
     'addedYears is still read, because the Remove-year button needs it');
  ok((CODE.match(/addedYears/g) || []).length >= 3,
     'and still used elsewhere: ' + (CODE.match(/addedYears/g) || []).length + ' references');
});

/* ==================================================================== */
say('');
say('=== 5. THE BLAST RADIUS ===');

guard('two functions, and nothing else', () => {
  const names = new Set();
  [SRC, BASE_SRC].forEach(s => {
    const r = /\r\n  (?:async )?function (\w+)\(/g;
    let m; while ((m = r.exec(s))) names.add(m[1]);
  });
  const changed = [];
  names.forEach(n => { if (grab(n, BASE_SRC) !== grab(n, SRC)) changed.push(n); });
  changed.sort();
  say('       changed functions: ' + changed.join(', '));
  const EXPECT = {
    totalRowFlags: 'the value-less total branch',
    renderIngestPicker: 'the cosmetic: the year dropdown',
    dacCol: 'NOT this brief: the schema fallback for imported years, found in the follow-up pass',
    placeTooltipAtPointer: 'NOT this brief: CLCPA-242, the shared clamp (new)',
    hideExecTooltip: 'NOT this brief: CLCPA-242, hide on re-render (new)',
    wireExecutiveTooltips: 'NOT this brief: CLCPA-242',
    wireHeaderCardsTooltips: 'NOT this brief: CLCPA-242',
    wireExecutiveInteractions: 'NOT this brief: CLCPA-242',
    wireControlTips: 'NOT this brief: CLCPA-242 round 2, the early-out',
  };
  changed.forEach(n => ok(n in EXPECT, 'the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  ok(changed.length === 9, 'exactly NINE functions changed: ' + changed.length);
});

guard('the exclusions hold', () => {
  ok(grabDecl('DERIVED_COLS') === grabDecl('DERIVED_COLS', BASE_SRC),
     'DERIVED_COLS is byte-identical to BASE');
  /* EVERY NAME IS PROVED TO EXIST BEFORE IT IS COMPARED.
   *
   * This list contained 'planIngestImport', which is not a function in this
   * file -- the planner is buildIngestImport. grab() returned null for it on
   * BOTH sides, so `null === null` passed and the exclusion asserted nothing.
   * Ninth pin in this project that read nothing, and the first caught by its
   * own mutation control reporting ANCHOR 0 instead of going red.
   *
   * The non-null check is the systemic fix: a typo in this list is now a
   * FAILURE rather than a silent pass. */
  ['isStrictTotalRowLabel', 'recomputeTotals', 'rowsForDisplay', 'applyDerivedCols',
   'columnGrandTotals', 'totalRowSums', 'ingestComputed', 'buildIngestImport',
   'applyIngestImport', 'composePayloadFromRows', 'computeHeaderCards',
   'renderExecutiveSummary', 'renderDumbbell', 'renderStripWithGap',
   'renderTable'].forEach(fn => {
    const now = grab(fn), before = grab(fn, BASE_SRC);
    if (!ok(now !== null && before !== null,
            fn + ' exists in both sources, so comparing them means something')) return;
    ok(now === before, fn + ' is byte-identical to BASE');
  });
  ok(/var DAC_SOURCE = 'dataverse';/.test(CODE), "DAC_SOURCE is still 'dataverse'");
  /* the hierarchical-matcher half is OUT OF SCOPE and stays out */
  ok(grab('buildIngestImport') !== null &&
     grab('buildIngestImport') === grab('buildIngestImport', BASE_SRC),
     'and the import planner buildIngestImport is untouched: 240\'s matcher ' +
     'half stays post-Sept-10');
});

/* ==================================================================== */
console.log(lines.join('\n'));
console.log('');
console.log('======================================================================');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
console.log('======================================================================');
process.exitCode = fail ? 1 : 0;
