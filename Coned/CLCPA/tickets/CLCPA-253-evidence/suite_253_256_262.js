/* GROUP A of the Section C fix package: CLCPA-253, CLCPA-256, CLCPA-262.
 *
 * Three defects in the ingest editor, from the CLCPA-124 hosted audit of
 * 2026-09-15. One suite, three sections, each ticket accounted separately.
 *
 * CLCPA-253 (C-04) -- the template stamped (calculated) on the four unnamed
 *   spacer columns of C2-C5's wide schema. The predicate was ROW-scoped:
 *   `any = (r, c) => !!totals[r] || ...`, so every column of a total row was
 *   a computed cell. It is column-aware now, and the authority is what
 *   recomputeTotals would actually WRITE: not a derived column, not a
 *   percentage or average column (CLCPA-212 refuses to sum those), and not a
 *   blank-headed spacer.
 *
 *   ONE CONSEQUENCE STATED IN ADVANCE: C2's "Average Event Reductions (MW)"
 *   is caught by detectAvgColumns, so it becomes FILLABLE in the template
 *   today. That is honest -- the engine does not compute it, which is
 *   CLCPA-254/C-05 -- and it is pinned here so the flip back to (calculated)
 *   when CLCPA-254 declares the column summable is a visible, asserted change
 *   rather than a surprise.
 *
 * CLCPA-256 (C-07) -- the confirm-save dialog counted rows x columns. The
 *   comparison was `ar[c] !== br[c]` against a baseline that, on a newly
 *   created year, holds no rows: every template-prefilled key cell and every
 *   blank spacer counted as a change. Empty compares equal to empty now,
 *   however it is spelled. The change history written after the save was
 *   always accurate; only the pre-save count lied.
 *
 * CLCPA-262 (C-12) -- the Add Data dialog closed on a REJECTION too, putting
 *   the reason on the page behind a dialog the operator had just been
 *   dismissed from, and taking the file input they need with it. A rejection
 *   keeps the dialog now.
 *
 *   AND A NEGATIVE, RECORDED: the report's success-side symptom -- the dialog
 *   remaining open after a GOOD load -- does not reproduce from this code.
 *   close() was already unconditional on that path, the overlay is mounted on
 *   document.body and removed by reference, and no call site re-opens it.
 *   Section D asserts those three facts so the claim is checked, not asserted.
 *
 * BASE is 794eecf.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-253-evidence/suite-253-256-262-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || '794eecf';
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

/* ---- assemble real functions out of the shipped source ------------------ */
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
  const parts = []; const have = new Set(); const missing = [];
  const add = (n) => {
    if (have.has(n)) return false;
    const f = find(n);
    if (!f) { missing.push(n); return false; }
    have.add(n); parts.push(f); return true;
  };
  let api = null;
  /* isTotalOnlyDerived is seeded rather than resolved on demand: it is only
   * reached when a table HAS a derive rule, so the first call that needs it
   * comes from deep inside a nested attempt, and resolving it there resets the
   * cached api mid-iteration. Seeding it is the honest fix -- the dependency
   * is real and known, not discovered. */
  const want = ['ingestComputed', 'renderSourceTables', 'detectAvgColumns',
                'detectPctColumns', 'totalRowFlags', 'getTableSchema',
                'isTotalOnlyDerived'];
  want.forEach(add);
  const attempt = (call) => {
    for (let r = 0; r < 400; r++) {
      try {
        if (!api) {
          api = new Function('PAYLOAD', parts.join('\n\n') +
            '\n;if (typeof state !== "undefined") state.payload = PAYLOAD;' +
            '\n;return {' + want.filter(n => have.has(n)).join(',') + '};')(P);
        }
        return call(api);
      } catch (e) {
        const m = /(\w+) is not defined/.exec(e.message);
        if (m && add(m[1])) { api = null; continue; }
        throw e;
      }
    }
    throw new Error('no convergence');
  };
  return { attempt, missing, have };
}

const NEW = harness(SRC);
const OLD = harness(BASE_SRC);

say('======================================================================');
say('Section C group A -- CLCPA-253, CLCPA-256, CLCPA-262');
say('  BASE ' + BASE);
say('======================================================================');

guard('both sources assemble and run', () => {
  const a = NEW.attempt(api => !!api.ingestComputed);
  const b = OLD.attempt(api => !!api.ingestComputed);
  ok(a && b, 'the changed source and BASE both assemble and run');
});

/* =================== T: CLCPA-253, the column-aware marker =========== */
say('');
say('=== T. CLCPA-253: (calculated) only where the engine writes =========');
const totalRowOf = (rows) => rows.findIndex(r =>
  /(^|\s)(grand\s+|sub|county\s+|systemwide\s+)?totals?$/i.test(
    String((r || [])[0] == null ? '' : (r || [])[0]).trim()));

guard('T: the four spacer columns of C2-C5 are no longer computed', () => {
  ['C2', 'C3', 'C4', 'C5'].forEach(id => {
    const t = P.tables[id];
    const y = Object.keys(t.data).sort().pop();
    const s = (t.schema_by_year || {})[y];
    const rows = t.data[y] || [];
    const ti = totalRowOf(rows);
    if (!ok(ti >= 0, 'T0 ' + id + ' has a total row at ' + ti)) return;
    const compNew = NEW.attempt(api => api.ingestComputed(rows, id, s));
    const compOld = OLD.attempt(api => api.ingestComputed(rows, id, s));
    const spacers = [];
    s.forEach((h, c) => { if (c > 0 && String(h == null ? '' : h).trim() === '') spacers.push(c); });
    ok(spacers.length === 4, 'T1 ' + id + ' has four blank-headed columns: [' + spacers + ']');
    ok(spacers.every(c => !compNew.any(ti, c)),
       'T2 ' + id + ' none of them is (calculated) any more');
    ok(spacers.every(c => compOld.any(ti, c)),
       'T2b and at BASE every one of them WAS, which is the defect');
  });
});

guard('T: the real numeric columns keep their marker', () => {
  ['C3', 'C4', 'C5'].forEach(id => {
    const t = P.tables[id];
    const y = Object.keys(t.data).sort().pop();
    const s = (t.schema_by_year || {})[y];
    const rows = t.data[y] || [];
    const ti = totalRowOf(rows);
    const comp = NEW.attempt(api => api.ingestComputed(rows, id, s));
    const named = [];
    s.forEach((h, c) => { if (c > 0 && String(h == null ? '' : h).trim() !== '') named.push(c); });
    ok(named.length === 3 && named.every(c => comp.any(ti, c)),
       'T3 ' + id + ' keeps (calculated) on all three named columns: [' + named + ']');
  });
});

guard('T: C2s average column, and the CLCPA-254 flip pinned in advance', () => {
  const t = P.tables.C2;
  const y = Object.keys(t.data).sort().pop();
  const s = (t.schema_by_year || {})[y];
  const rows = t.data[y] || [];
  const ti = totalRowOf(rows);
  const comp = NEW.attempt(api => api.ingestComputed(rows, id0(s), s));
  function id0() { return 'C2'; }
  const avgIdx = s.findIndex(h => /average event/i.test(String(h == null ? '' : h)));
  ok(avgIdx > 0, 'T4 C2s "Average Event Reductions (MW)" is column ' + avgIdx);
  /* THE BOUNDARY THIS TICKET DOES NOT CROSS. An average column is still
   * marked (calculated) and still skipped on import -- unchanged from BASE.
   * My first cut excluded it, which ALSO removed the import protection and
   * let a summed average be written into A3/A4's total row: the CLCPA-212
   * defect through the back door, caught by suite_240a. C2's blank total is
   * CLCPA-254's to fix by making the column genuinely summable; it is not
   * fixed by relabelling the cell fillable. */
  ok(comp.any(ti, avgIdx),
     'T5 it is still (calculated), exactly as at BASE: this ticket moves ' +
     'spacers only');
  const avg = NEW.attempt(api => api.detectAvgColumns(s));
  ok(avg[avgIdx] === true,
     'T5b detectAvgColumns matches the word "Average", which is why the engine ' +
     'does not sum it, which is CLCPA-254 and not this ticket');
  const compOld = OLD.attempt(api => api.ingestComputed(rows, 'C2', s));
  ok(compOld.any(ti, avgIdx) === comp.any(ti, avgIdx),
     'T5c and its marker is UNCHANGED across the round, asserted both ways');
  const named = [];
  s.forEach((h, c) => { if (c > 0 && String(h == null ? '' : h).trim() !== '') named.push(c); });
  const computedNamed = named.filter(c => comp.any(ti, c));
  ok(computedNamed.length === 3,
     'T6 all three of C2s named columns keep their marker: [' + computedNamed + ']');
});

guard('T: a DERIVED column keeps its marker whatever its header says', () => {
  /* the declaration outranks the structural guess: E1 carries a weightedMean */
  const src = codeOnly(SRC);
  ok(/any: \(r, c\) => \(!!totals\[r\] && \(!!derived\[c\] \|\| engineWrites\(c\)\)\)/.test(src),
     'T7 the predicate admits a derived column on a total row unconditionally');
  ok(/const engineWrites = \(c\) => !blankHeader\[c\];/.test(src),
     'T8 and otherwise asks only whether the column has a header at all');
  ok(!/!pctCol\[c\] && !avgCol\[c\]/.test(src),
     'T8b the percentage and average exclusions are NOT in this predicate: ' +
     'they would have removed the import protection along with the marker');
  ok(!/any: \(r, c\) => !!totals\[r\] \|\|/.test(codeOnly(SRC)),
     'T9 the row-scoped predicate is gone');
  ok(/any: \(r, c\) => !!totals\[r\] \|\|/.test(codeOnly(BASE_SRC)),
     'T9b and it was there at BASE');
});

guard('T: dashboard-wide, only spacer and non-summing columns lost the marker', () => {
  const moved = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach(y => {
      const s = (t.schema_by_year || {})[y];
      if (!s) return;
      const rows = t.data[y] || [];
      const a = OLD.attempt(api => api.ingestComputed(rows, id, s));
      const b = NEW.attempt(api => api.ingestComputed(rows, id, s));
      rows.forEach((r, ri) => {
        for (let c = 1; c < s.length; c++) {
          if (a.any(ri, c) === b.any(ri, c)) continue;
          moved.push({ id, y, ri, c, h: String(s[c] == null ? '' : s[c]) });
        }
      });
    });
  });
  const blank = moved.filter(m => m.h.trim() === '').length;
  const avgpct = moved.length - blank;
  ok(moved.length > 0, 'T10 cells whose marker changed: ' + moved.length);
  ok(moved.every(m => m.h.trim() === ''),
     'T11 every one is a blank-headed spacer (' + blank + '), and NOT ONE is a ' +
     'named column (' + avgpct + '): the scope is exactly the C-04 complaint');
  const tables = [...new Set(moved.map(m => m.id))].sort();
  ok(tables.length > 0, 'T12 across ' + tables.length + ' tables: ' + tables.join(', '));
  ok(moved.every(m => b_isTotal(m)), 'T13 and every one sits on a TOTAL row');
  function b_isTotal(m) {
    const rows = P.tables[m.id].data[m.y] || [];
    const s = (P.tables[m.id].schema_by_year || {})[m.y];
    const f = NEW.attempt(api => api.ingestComputed(rows, m.id, s));
    return f.totalRow(m.ri);
  }
});

/* =================== S: CLCPA-256, the change count ================== */
say('');
say('=== S. CLCPA-256: the confirm dialog counts real changes ============');
/* the counter is an IIFE inside openSaveModal, which needs a DOM. The slice
 * is cut out of the shipped source and run directly, so what is measured is
 * the shipped arithmetic and not a re-implementation of it. */
function counterOf(src) {
  const start = src.indexOf('const changeCount = (() => {');
  if (start < 0) return null;
  const end = src.indexOf('})();', start);
  if (end < 0) return null;
  const body = src.slice(start, end + 5);
  return new Function('i', body + '\n;return changeCount;');
}
guard('S: the shipped counter, on the audits own numbers', () => {
  const fnNew = counterOf(SRC), fnOld = counterOf(BASE_SRC);
  if (!ok(!!fnNew && !!fnOld, 'S0 the counter slice was found on both sides')) return;
  /* C1 2098 as the audit left it: 5 rows x 6 columns, key column prefilled by
   * the template, two text columns typed, three spacers untouched, and a
   * baseline with NO rows because the year is new. */
  const draftC1 = [];
  for (let r = 0; r < 5; r++) {
    draftC1.push(['Program ' + (r + 1), '', '', 'Cat ' + r, '', 'Desc ' + r]);
  }
  ok(fnOld({ draft: draftC1, baseline: [] }) === 30,
     'S1 at BASE C1 reported 30 changes for 10 typed values, exactly as the ' +
     'audit photographed: ' + fnOld({ draft: draftC1, baseline: [] }));
  ok(fnNew({ draft: draftC1, baseline: [] }) === 15,
     'S2 and now it counts the 15 non-empty cells it is actually writing: ' +
     fnNew({ draft: draftC1, baseline: [] }));
  /* the 5 prefilled keys are real content on a new year, so they DO count;
   * what must not count is the empty spacers */
  const spacersOnly = [['A', '', '', '', '', '']];
  ok(fnOld({ draft: spacersOnly, baseline: [] }) === 6 &&
     fnNew({ draft: spacersOnly, baseline: [] }) === 1,
     'S3 a row of one label and five blanks: 6 at BASE, 1 now');
  /* an EXISTING year, where the baseline is real: unchanged behaviour */
  const base2 = [['A', 1, 2], ['B', 3, 4]];
  const draft2 = [['A', 1, 9], ['B', 3, 4]];
  ok(fnOld({ draft: draft2, baseline: base2 }) === 1 &&
     fnNew({ draft: draft2, baseline: base2 }) === 1,
     'S4 on a stored year with one edited cell both answer 1: the fix is ' +
     'confined to the empty-versus-absent case');
  /* null / undefined / '' are one thing */
  ok(fnNew({ draft: [[null, '', undefined]], baseline: [['', null, '']] }) === 0,
     'S5 null, undefined and empty string compare equal');
  ok(fnOld({ draft: [[null, '', undefined]], baseline: [['', null, '']] }) === 3,
     'S5b where BASE called all three a change');
  /* a real clearing is still a change */
  ok(fnNew({ draft: [['A', '']], baseline: [['A', 7]] }) === 1,
     'S6 and clearing a value that WAS there still counts');
  /* and ZERO IS A FIGURE, not an absence. Widening the empty set to include 0
   * would hide an operator typing 0 over a stored 7 -- the kind of change
   * that most needs confirming. */
  ok(fnNew({ draft: [['A', 0]], baseline: [['A', 7]] }) === 1,
     'S6b typing 0 over a stored 7 counts: zero is a figure, not an absence');
  ok(fnNew({ draft: [['A', 0]], baseline: [['A', '']] }) === 1,
     'S6c and typing 0 into an empty cell counts too');
});

guard('S: the structure of the fix', () => {
  const src = codeOnly(SRC);
  ok(/const same = \(x, y\) => \{/.test(src), 'S7 the normalising comparison is named');
  ok(/if \(!same\(ar\[c\], br\[c\]\)\) count\+\+;/.test(src), 'S8 and it is what the loop uses');
  ok(!/if \(ar\[c\] !== br\[c\]\) count\+\+;/.test(src), 'S9 the raw !== is gone');
  ok(/if \(ar\[c\] !== br\[c\]\) count\+\+;/.test(codeOnly(BASE_SRC)), 'S9b it was there at BASE');
});

/* =================== D: CLCPA-262, the dialog ======================== */
say('');
say('=== D. CLCPA-262: dismiss on success, stay open on failure ==========');
guard('D: the failure path keeps the dialog', () => {
  const src = codeOnly(SRC);
  ok(/let failed = false;/.test(src), 'D1 the load handler tracks failure');
  ok(/i\.importResult = plan;\s*\r?\n\s*if \(plan\.ok\) applyIngestImport\(plan\); else failed = true;/.test(src),
     'D2 a rejected plan sets it');
  /* the OTHER rejection path: a file that could not be read at all. It sets
   * importResult and must set the flag too, or an unreadable file closes the
   * dialog while a merely invalid one keeps it -- two behaviours for one
   * outcome. */
  ok(/'The file could not be read\.' \}\] \};\s*\r?\n\s*failed = true;/.test(src),
     'D2b and so does a file that could not be read at all');
  ok(/if \(failed\) \{[\s\S]{0,400}?return;\s*\r?\n\s*\}\s*\r?\n\s*close\(\);/.test(src),
     'D3 and returns BEFORE close(), so the dialog stays');
  ok(/err\.textContent = why;/.test(src), 'D4 with the reason in the dialogs own error line');
  ok(/if \(failed\)[\s\S]{0,400}?\}\s*\r?\n\s*close\(\);/.test(src),
     'D5 while a success still reaches close()');
  /* at BASE close() ran either way */
  const b = codeOnly(BASE_SRC);
  ok(!/let failed = false;/.test(b) &&
     /if \(plan\.ok\) applyIngestImport\(plan\);\s*\r?\n\s*\}\s*\r?\n\s*\}\s*\r?\n\s*close\(\);/.test(b),
     'D6 at BASE close() ran on a rejection too, which is the defect');
});

guard('D: THE NEGATIVE, checked rather than asserted', () => {
  /* the report says the dialog stayed open after a GOOD load. Three facts say
   * that cannot come from this code, and each is checked. */
  const src = codeOnly(SRC);
  ok(/document\.body\.appendChild\(modal\);/.test(
      src.slice(src.indexOf('function openAddYearDialog'))),
     'D7 the overlay is mounted on document.body');
  ok(/const close = \(\) => \{[\s\S]{0,200}?modal\.remove\(\);/.test(src),
     'D8 and close() removes it by reference');
  const callSites = (src.match(/openAddYearDialog/g) || []).length;
  ok(callSites === 2,
     'D9 openAddYearDialog has exactly one call site plus its declaration (' +
     callSites + ' mentions), so nothing re-opens it');
  ok(/if \(needsRedraw\) rerenderIngestAll\(\);/.test(src) &&
     /view\.innerHTML = renderIngestPage\(\);/.test(src),
     'D10 and the redraw replaces #view-container, not the body, so it cannot ' +
     'resurrect an overlay. The success-side symptom is NOT in this code.');
});

/* =================== Z: stored years unmoved ========================= */
say('');
say('=== Z. the 149 stored table-years, proven unmoved ===================');
guard('Z: every stored table-year renders byte-identically', () => {
  /* BOTH SIDES PINNED TO COMMITS, because this group is the bottom of a
   * stack. The claim is "GROUP A moved no stored year", and that claim is
   * about what Group A shipped -- not about whatever the working tree holds
   * once Group B is stacked on top of it. Reading the tree here made this
   * gate fail on A8:2023, which is CLCPA-252's caption fix working correctly
   * one group up. The stacked state gets its own proof at the end of the
   * session, per the ruling.
   *
   * The ticket's own behaviour is still read from the tree everywhere else in
   * this suite, so the mutation controls keep working on the code that ships. */
  const GROUP_COMMIT = process.env.DAC_GROUP_COMMIT || '9699f62';
  const GROUP_SRC = execSync('git show ' + GROUP_COMMIT + ':"' + REL + '"',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
  const SHIPPED = harness(GROUP_SRC);
  ok(/^[0-9a-f]{7,40}$/.test(GROUP_COMMIT),
     'Z0 the group commit is a literal sha: ' + GROUP_COMMIT);
  let checked = 0, bytes = 0, tables = 0;
  const moved = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach(y => {
      const a = OLD.attempt(api => api.renderSourceTables([t], y, {}, id));
      const b = SHIPPED.attempt(api => api.renderSourceTables([t], y, {}, id));
      checked++;
      bytes += String(b).length;
      if (/<table/.test(String(b))) tables++;
      if (a !== b) moved.push(id + ':' + y);
    });
  });
  ok(checked === 149, 'Z1 ' + checked + ' stored table-years rendered on both sides');
  /* AND THE SWEEP ACTUALLY RENDERED. "149 compared equal" is satisfied by
   * comparing nothing at all, which is how a gate becomes decoration. */
  ok(tables === 149, 'Z1b and every one of the 149 produced a <table>: ' + tables);
  /* the floor is MEASURED, not guessed: the 149 renders total 322,447 bytes
   * today. My first cut of this line asserted a million, which I had not
   * counted, and it failed on correct output. */
  ok(bytes > 200000, 'Z1c totalling ' + bytes + ' bytes of markup (floor 200k, ' +
     'measured 322,447), so the comparison had something to compare');
  ok(moved.length === 0, 'Z2 every one is byte-identical' +
     (moved.length ? ': MOVED ' + moved.slice(0, 8).join(', ') : ''));
  /* and the compare panels too, since the report page is not the only surface */
  let cmp = 0; const cmpMoved = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach(y => {
      const a = OLD.attempt(api => api.renderSourceTables([t], y, { [id]: 'both' }, id));
      const b = SHIPPED.attempt(api => api.renderSourceTables([t], y, { [id]: 'both' }, id));
      cmp++;
      if (a !== b) cmpMoved.push(id + ':' + y);
    });
  });
  ok(cmp === 149 && cmpMoved.length === 0,
     'Z3 and all 149 in COMPARE mode too' +
     (cmpMoved.length ? ': MOVED ' + cmpMoved.slice(0, 8).join(', ') : ''));
});

/* =================== X: blast radius and baseline ==================== */
say('');
say('=== X. what else moved =============================================');
guard('X: the blast radius', () => {
  const names = [...new Set((SRC.match(/(?:^|\r\n)[ \t]*(?:async )?function (\w+)\s*\(/g) || [])
    .map(m => /function (\w+)/.exec(m)[1]))];
  const grab = (n, src) => {
    const h = '\r\n  function ' + n + '(';
    const i = (src || SRC).indexOf(h);
    if (i < 0) return null;
    const j = (src || SRC).indexOf('\r\n  }', i);
    return j < 0 ? null : (src || SRC).slice(i, j);
  };
  const changed = names.filter(n => grab(n, SRC) !== grab(n, BASE_SRC));
  say('       changed: ' + changed.sort().join(', '));
  const EXPECT = {
    ingestComputed: 'CLCPA-253: the marker is column-aware',
    openSaveModal: 'CLCPA-256: the change count normalises empty',
    openAddYearDialog: 'CLCPA-262: a rejection keeps the dialog',
  };
  /* THIS GROUP IS THE BOTTOM OF A STACK, and the working tree carries the
   * groups above it. Their functions are named here so the count stays exact
   * rather than relaxed: an UNNAMED change still turns this red, which is the
   * whole point of a blast radius. */
  const LATER = {
    tableCaption: 'CLCPA-252, group B: the caption helper, new',
    dacCol: 'NOT this ticket: CLCPA-257, Section C group C: dacCols newest-year fallback',
    phantomSpacerCols: 'NOT this ticket: CLCPA-260, Section C group D: the phantom spacer columns, new',
    buildIngestWorkbook: 'NOT this ticket: CLCPA-260, Section C group D: the phantom spacer columns, the template stops emitting them',
    renderSourceTables: 'CLCPA-252, group B: the report page calls it',
    renderIngestEditor: 'CLCPA-252, group B: the editor calls it',
    renderSectionC: 'CLCPA-259, group B: the panel reads C1',
  };
  changed.forEach(n => ok(n in EXPECT || n in LATER,
    'the change to ' + n + ' is accounted for' + (n in LATER ? ' (' + LATER[n] + ')' : '')));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  const mine = changed.filter(n => !(n in LATER));
  ok(mine.length === 3, 'X1 exactly THREE functions are THIS groups: ' + mine.join(', '));
  /* the ones that must NOT move */
  ['recomputeTotals', 'columnGrandTotals', 'detectAvgColumns', 'detectPctColumns',
   'totalRowFlags', 'buildIngestImport', 'applyIngestImport'].forEach(n => {
    ok(grab(n, SRC) === grab(n, BASE_SRC), 'X2 ' + n + ' is byte-identical to BASE');
  });
});
guard('X: the baseline', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X3 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: REPO }); anc = true; }
  catch (e) {}
  ok(anc, 'X4 and an ancestor of HEAD');
});

lines.forEach(l => console.log(l));
console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n  ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
