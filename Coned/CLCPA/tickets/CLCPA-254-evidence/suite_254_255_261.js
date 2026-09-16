/* GROUP E of the Section C fix package: CLCPA-254, CLCPA-255, CLCPA-261.
 *
 * All three under rulings Emely delivered at plan acceptance.
 *
 * CLCPA-254 (C-05) -- C2's "Average Event Reductions (MW)" total stayed blank.
 *   detectAvgColumns refuses to sum anything whose heading says "average",
 *   which is right for A3/A4's per-participant averages: CLCPA-212 measured
 *   A3/2025 receiving 22,297.18, the sum of 22 rounded averages, over a stored
 *   22,511. RULED: plain sum by NAMED DECLARATION, the regex untouched. The
 *   data settles the rule -- C2/2025's stored total is 736.73 and its rows sum
 *   to exactly 736.73, where a participants-weighted mean would be 355.29.
 *
 * CLCPA-255 (C-06) -- RULED: uphold the CLCPA-205 exemption, build only the
 *   narrow half. A recognised total row loses its delete control; its label
 *   stays editable. 35 tables carry an anchored total label and none of them
 *   gains a lock.
 *
 * CLCPA-261 (C-09) -- RULED: a visible NOTICE, never a rejection. The
 *   CLCPA-244 convention that an explicit "%" is a unit is unchanged; a
 *   percent string landing in a column that is not a percentage column is
 *   named in the import summary.
 *
 * BASE is 8eaa2ac (Group D's head). This branch stacks on it.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-254-evidence/suite-254-255-261-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || '8eaa2ac';
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
  try { fn(); } catch (e) { fail++; lines.push('  FAIL ' + label + ' THREW: ' + (e && e.message)); }
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
  const want = ['recomputeTotals', 'buildIngestImport', 'renderSourceTables',
                'detectAvgColumns', 'detectPctColumns', 'totalRowFlags',
                'getTableSchema', 'isDeclaredSummable',
                /* CLCPA-261: the panel is DRIVEN, not read */
                'renderIngestImportResult'];
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
  return { attempt };
}
const NEW = harness(SRC), OLD = harness(BASE_SRC);

say('======================================================================');
say('Section C group E -- CLCPA-254, CLCPA-255, CLCPA-261');
say('  BASE ' + BASE + '   (stacked on Group D)');
say('======================================================================');

/* =================== S: CLCPA-254 =================================== */
say('');
say('=== S. CLCPA-254: the declared plain sum ===========================');
const C2S = P.tables.C2.schema_by_year['2025'];
/* the audit's own C-05 screen: numbers typed into every data row */
const auditDraft = () => [
  ['DAC', null, null, 111, null, 222.5, null, 333.25],
  ['Low-Income', null, null, 444, null, 555.5, null, 0.1],
  ['All Others', null, null, 777, null, 888.5, null, 999.25],
  ['Total', null, null, null, null, null, null, null],
];

guard('S: the audits case, driven on both sides', () => {
  const a = auditDraft(), b = auditDraft();
  OLD.attempt(api => api.recomputeTotals(a, C2S, 'C2', []));
  NEW.attempt(api => api.recomputeTotals(b, C2S, 'C2', []));
  ok(a[3][7] === null, 'S1 at BASE the third total stayed EMPTY, which is C-05');
  ok(Math.abs(b[3][7] - 1332.6) < 1e-9,
     'S2 and it now computes ' + b[3][7] + ', the sum 333.25 + 0.1 + 999.25');
  ok(a[3][3] === b[3][3] && a[3][5] === b[3][5] && b[3][3] === 1332 && b[3][5] === 1666.5,
     'S3 while the other two totals are unchanged: ' + b[3][3] + ', ' + b[3][5]);
});

guard('S: the rule is a SUM, and the data says so', () => {
  const rows = P.tables.C2.data['2025'];
  const ti = rows.findIndex(r => /^total$/i.test(String(r[0] || '').trim()));
  const num = (v) => {
    const m = /^\s*([-+]?[\d,]*\.?\d+)/.exec(String(v == null ? '' : v));
    return m ? parseFloat(m[1].replace(/,/g, '')) : null;
  };
  let sum = 0, wnum = 0, wden = 0;
  rows.forEach((r, i) => {
    if (i === ti) return;
    const a = num(r[7]), w = num(r[3]);
    if (a !== null) sum += a;
    if (a !== null && w !== null) { wnum += a * w; wden += w; }
  });
  const stored = num(rows[ti][7]);
  ok(Math.abs(stored - sum) < 0.005,
     'S4 C2/2025 stored ' + stored + ' equals the plain sum ' + sum.toFixed(2));
  ok(Math.abs(stored - (wnum / wden)) > 100,
     'S5 and NOT the participants-weighted mean ' + (wnum / wden).toFixed(2) +
     ', which is what rules out (a)');
});

guard('S: by DECLARATION, with the regex untouched', () => {
  const src = codeOnly(SRC);
  ok(/const SUMMABLE_COLS = \{/.test(src), 'S6 the declaration exists');
  ok(/C2: \['average event reductions \(mw\)'\]/.test(src),
     'S7 naming C2s column, matched on the heading rather than an index');
  ok(NEW.attempt(api => api.detectAvgColumns(['x', 'Average Event Reductions (MW)']))[1] === true,
     'S8 detectAvgColumns still calls it an average column');
  const grabFn = (n, s) => {
    const lines2 = s.split('\r\n');
    for (const pad of ['  ', '    ', '']) {
      const d = new RegExp('^' + pad + '(?:async )?function ' + n + '\\s*\\(');
      const any = new RegExp('^' + pad + '(?:async )?function \\w+\\s*\\(');
      const st = lines2.findIndex(l => d.test(l));
      if (st < 0) continue;
      for (let i = st + 1; i < lines2.length; i++) {
        if (lines2[i] === pad + '}') return lines2.slice(st, i + 1).join('\r\n');
        if (any.test(lines2[i])) break;
      }
      return null;
    }
    return null;
  };
  ok(grabFn('detectAvgColumns', SRC) === grabFn('detectAvgColumns', BASE_SRC),
     'S9 and detectAvgColumns is BYTE-IDENTICAL to BASE: the regex is not loosened');
  ok(grabFn('detectPctColumns', SRC) === grabFn('detectPctColumns', BASE_SRC),
     'S9b as is detectPctColumns');
});

guard('S: A3 and A4 keep the CLCPA-212 protection', () => {
  ['A3', 'A4'].forEach(id => {
    const s = P.tables[id].schema_by_year['2025'];
    const mk = () => {
      const d = P.tables[id].data['2025'].map(r => r.slice());
      const t = d.findIndex(r => /^total$/i.test(String(r[0] || '').trim()));
      if (t >= 0) { d[t][3] = null; d[t][4] = null; }
      return { d: d, t: t };
    };
    const A = mk(), B = mk();
    if (A.t < 0) { ok(false, 'S10 ' + id + ' has no Total row'); return; }
    OLD.attempt(api => api.recomputeTotals(A.d, s, id, []));
    NEW.attempt(api => api.recomputeTotals(B.d, s, id, []));
    ok(A.d[A.t][3] === B.d[B.t][3] && A.d[A.t][4] === B.d[B.t][4],
       'S10 ' + id + ' average columns are unchanged from BASE: ' +
       JSON.stringify([B.d[B.t][3], B.d[B.t][4]]));
    ok(B.d[B.t][3] === null && B.d[B.t][4] === null,
       'S10b and still refuse to sum, which is CLCPA-212');
  });
  ok(NEW.attempt(api => api.isDeclaredSummable('A3', 'Avg. Incentives by Participant')) === false,
     'S11 the declaration names A3 nowhere');
  ok(NEW.attempt(api => api.isDeclaredSummable('C2', 'Average Event Reductions (MW)')) === true,
     'S12 and names C2s column exactly');
  ok(NEW.attempt(api => api.isDeclaredSummable('C3', 'Average Event Reductions (MW)')) === false,
     'S13 per TABLE, so the same heading elsewhere is untouched');
});

/* =================== D: CLCPA-255 =================================== */
say('');
say('=== D. CLCPA-255: the narrow x-suppression =========================');
guard('D: a recognised total row loses its delete control', () => {
  const src = codeOnly(SRC);
  ok(/\$\{\(isHeaderRow \|\| lockTotalRow \|\| isTotal\) \? ''/.test(src),
     'D1 the actions cell is empty for a total row');
  ok(/\$\{\(isHeaderRow \|\| lockTotalRow\) \? ''/.test(codeOnly(BASE_SRC)),
     'D2 where BASE emitted the button for it');
});

guard('D: the LABEL stays editable -- the CLCPA-205 exemption is upheld', () => {
  const src = codeOnly(SRC);
  /* the label cell is built before the actions cell; nothing in this round
   * touches it, so the whole label branch must be byte-identical */
  const labelOf = (s) => {
    const i = s.indexOf('class="ingest-cell ingest-cell-label"');
    return i < 0 ? null : s.slice(i - 400, i + 200);
  };
  ok(labelOf(SRC) === labelOf(BASE_SRC),
     'D3 the label input is byte-identical to BASE: it is still an input');
  ok(/<input type="text"[^>]*class="ingest-cell ingest-cell-label"/.test(SRC),
     'D4 and it really is an <input>, not a read-only span');
  /* and the blast radius is one function */
  ok(!/isTotalRowLabelLocked|lockTotalLabel/.test(src),
     'D5 no label-lock was introduced under another name');
});

guard('D: the blast radius of the suppression, counted', () => {
  /* every table with an anchored total label -- the 35 the audit enumerated.
   * None of them gains a LOCK; all of them lose the x on that row. */
  let tables = 0;
  Object.keys(P.tables).forEach(id => {
    const t = P.tables[id];
    let hit = false;
    Object.keys(t.data || {}).forEach(y => {
      (t.data[y] || []).forEach(r => {
        const lab = String((r || [])[0] == null ? '' : (r || [])[0]).trim();
        if (/(^|\s)(grand\s+|sub|county\s+|systemwide\s+)?totals?$/i.test(lab)) hit = true;
      });
    });
    if (hit) tables++;
  });
  ok(tables === 35, 'D6 ' + tables + ' tables carry an anchored total-row label');
  say('       and every one of them keeps an editable label: the ruling was to');
  say('       uphold CLCPA-205 and build only the destructive half.');
});

/* =================== N: CLCPA-261 =================================== */
say('');
say('=== N. CLCPA-261: the notice, not a rejection ======================');
guard('N: a percent string in a non-percent column is named', () => {
  const stored = P.tables.C2.data['2025'].map(r => r.slice());
  const file = [C2S, ['DAC', null, null, '10%', null, '10%', null, '10%']];
  const plan = NEW.attempt(api => api.buildIngestImport(file, C2S, stored, 'C2'));
  ok(plan.ok === true, 'N1 the import still SUCCEEDS: this is not a rejection');
  ok((plan.unitNotices || []).length === 3,
     'N2 and three cells are noticed: ' + (plan.unitNotices || []).length);
  ok((plan.unitNotices || []).every(x => x.read === '10%' && x.landed === 0.1),
     'N3 each naming what was read and what landed: 10% -> 0.1');
  ok((plan.unitNotices || []).every(x => x.label && x.column),
     'N4 with the row label and the column, so the operator can find them');
  ok(plan.populated.length === 3,
     'N5 and the values ARE in the draft: the CLCPA-244 convention is unchanged');
  ok((plan.rejections || []).length === 0,
     'N5b with NOTHING rejected: ' + JSON.stringify((plan.rejections || []).map(r => r.why)));
  /* AND IT REACHES THE OPERATOR. A collected notice nobody renders is a
   * field on an object. The panel is driven, not read. */
  const html = NEW.attempt(api => api.renderIngestImportResult(plan));
  ok(/Read as a fraction: 3 cells/.test(html),
     'N5c and the success panel announces them: ' +
     ((/Read as a fraction[^<]*/.exec(html) || [])[0] || 'NOTHING RENDERED'));
  ok(/10% read as 0\.1/.test(html),
     'N5d naming what was read and what landed, in the panel itself');
});

guard('N: a percentage column says nothing, because nothing happened', () => {
  /* F9 carries "% of System Total" columns: 45% there is exactly right */
  const id = 'F9';
  const s = P.tables[id].schema_by_year['2025'];
  const pct = NEW.attempt(api => api.detectPctColumns(s));
  const idx = pct.findIndex((v, i) => v && i > 0);
  if (!ok(idx > 0, 'N6 ' + id + ' has a percentage column at ' + idx)) return;
  const stored = P.tables[id].data['2025'].map(r => r.slice());
  const row = s.map((h, c) => (c === 0 ? stored[0][0] : (c === idx ? '45%' : null)));
  const plan = NEW.attempt(api => api.buildIngestImport([s, row], s, stored, id));
  ok((plan.unitNotices || []).length === 0,
     'N7 and a "45%" typed into it raises NO notice: ' +
     JSON.stringify((plan.unitNotices || []).map(x => x.column)));
});

guard('N: BASE had no notice at all', () => {
  const stored = P.tables.C2.data['2025'].map(r => r.slice());
  const file = [C2S, ['DAC', null, null, '10%', null, '10%', null, '10%']];
  const plan = OLD.attempt(api => api.buildIngestImport(file, C2S, stored, 'C2'));
  ok(plan.ok === true && plan.unitNotices === undefined,
     'N8 BASE imported the same file with no unitNotices field at all');
  ok(/Read as a fraction/.test(SRC) && !/Read as a fraction/.test(BASE_SRC),
     'N9 and the panel that shows them is new');
});

/* =================== Z: the stored years ============================ */
say('');
say('=== Z. the stored years ===========================================');
guard('Z: the report page is byte-identical on all 149', () => {
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
  ok(checked === 149 && tables === 149, 'Z1 all 149 rendered, every one a <table>');
  ok(moved.length === 0, 'Z2 and every one is byte-identical' +
     (moved.length ? ': ' + moved.slice(0, 6).join(', ') : ''));
});

guard('Z: no stored total is rewritten by the declaration', () => {
  /* C2's stored rows hold composite strings, so colHasNum is false and the
   * engine keeps the stored value either way. Asserted rather than assumed,
   * because "it computes now" must not mean "it overwrites what is filed". */
  const s = C2S;
  const before = P.tables.C2.data['2025'].map(r => r.slice());
  const d = P.tables.C2.data['2025'].map(r => r.slice());
  NEW.attempt(api => api.recomputeTotals(d, s, 'C2', before.map(r => r.slice())));
  ok(JSON.stringify(d) === JSON.stringify(before),
     'Z3 C2/2025 is returned unchanged by a recompute of its stored rows');
});

/* =================== X: blast radius and baseline =================== */
say('');
say('=== X. what else moved ============================================');
function grabFn(n, src) {
  const lines2 = src.split('\r\n');
  for (const pad of ['  ', '    ', '']) {
    const decl = new RegExp('^' + pad + '(?:async )?function ' + n + '\\s*\\(');
    const anyDecl = new RegExp('^' + pad + '(?:async )?function \\w+\\s*\\(');
    const start = lines2.findIndex(l => decl.test(l));
    if (start < 0) continue;
    for (let i = start + 1; i < lines2.length; i++) {
      if (lines2[i] === pad + '}') return lines2.slice(start, i + 1).join('\r\n');
      if (anyDecl.test(lines2[i])) break;
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
    isDeclaredSummable: 'CLCPA-254: the declaration, new',
    recomputeTotals: 'CLCPA-254: it consults the declaration',
    renderIngestEditor: 'CLCPA-255: a total row loses its delete control',
    buildIngestImport: 'CLCPA-261: the unit notice is collected',
    renderIngestImportResult: 'CLCPA-261: and rendered',
  };
  changed.forEach(n => ok(n in EXPECT, 'the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  ok(changed.length === 5, 'X1 exactly FIVE functions changed: ' + changed.length);
  ['detectAvgColumns', 'detectPctColumns', 'totalRowFlags', 'columnGrandTotals',
   'renderSourceTables', 'phantomSpacerCols', 'dacCol'].forEach(n => {
    ok(grabFn(n, SRC) === grabFn(n, BASE_SRC), 'X2 ' + n + ' is byte-identical to BASE');
  });
});
guard('X: the baseline', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X3 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: REPO }); anc = true; }
  catch (e) {}
  ok(anc, 'X4 and an ancestor of HEAD, so this group stacks on Group D');
});

lines.forEach(l => console.log(l));
console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n  ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
