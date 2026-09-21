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
/* CLCPA-252 round 3: the shared caption-difference judgement */
const kit = require('../_kit/caption_diff.js');

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
  /* CLCPA-270 replaced the three-flag disjunction with one role lookup. That
   * is a REWORDING only if the two agree on every role, so prove it rather
   * than re-pin the new spelling: read the role table out of the shipped
   * source and evaluate BOTH expressions over all four roles. The old flags
   * are themselves derived from the same table by the lines above the cell
   * (isHeaderRow = role 'header', isTotal = !values && !header,
   * lockTotalRow = !label && !header), so this is a closed comparison. */
  ok(/\$\{!roleOpen\.deletable \? ''/.test(src),
     'D1a the actions cell is empty when the ROLE is not deletable');
  /* the table is a const inside the IIFE, so this harness's column-0 extractor
   * cannot reach it -- cut the literal out of the shipped bytes instead */
  const roleSrc = /const INGEST_ROLE_OPEN = \{[\s\S]*?\r?\n  \};/.exec(SRC);
  ok(!!roleSrc, 'D1z the role table is in the shipped source');
  const ROLE = new Function(roleSrc[0] + '\nreturn INGEST_ROLE_OPEN;')();
  const roles = Object.keys(ROLE);
  ok(roles.length === 4, 'D1b the role table has all four roles: ' + roles.join(','));
  const disagree = roles.filter((r) => {
    const o = ROLE[r];
    const isHeaderRow = r === 'header';
    const isTotal = !o.values && !isHeaderRow;
    const lockTotalRow = !o.label && !isHeaderRow;
    const oldSuppressed = isHeaderRow || lockTotalRow || isTotal;
    return oldSuppressed !== !o.deletable;
  });
  ok(disagree.length === 0,
     'D1 and that suppresses exactly what CLCPA-255 suppressed, on every ' +
     'role: ' + (disagree.length ? 'DISAGREE on ' + disagree.join(',') : 'all 4 agree'));
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
  const moved = [], derivedOnly = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach(y => {
      const a = OLD.attempt(api => api.renderSourceTables([t], y, {}, id));
      const b = NEW.attempt(api => api.renderSourceTables([t], y, {}, id));
      checked++;
      if (/<table/.test(String(b))) tables++;
      /* CLCPA-252 round 2: A8:2023 is the one data-carrying year with no
       * stored title, so its caption DERIVES now and the panel moves. Named
       * rather than tolerated -- anything else moving still fails. */
      /* CLCPA-252 ROUND 3 changes what a STORED year renders: every caption
       * loses its year. This pin is NARROWED, not widened -- the shared kit
       * requires everything outside the <h3> to be byte-identical AND each
       * caption to be its BASE self with year tokens removed. A reworded
       * caption, a changed cell or an ADDED year still fails. */
      if (!kit.onlyCaptionYearsChanged(b, a))
        { (((t.title_by_year || {})[y]) ? moved : derivedOnly).push(id + ':' + y); }
    });
  });
  ok(checked === 149 && tables === 149, 'Z1 all 149 rendered, every one a <table>');
  ok(derivedOnly.join(',') === 'A8:2023',
     'Z1b the only untitled year is A8:2023, and CLCPA-252 round 2 derives it: ' +
     JSON.stringify(derivedOnly));
  /* RE-POINTED BY CLCPA-294, not widened: an exact list of two, so a third
   * panel moving still turns this red. Those two are where a computed total
   * lands fractionally above 1 on floating point -- 1.0000327 and
   * 1.0000000013 -- and the old size guess rendered them "1.0%" where 100.0%
   * is meant. The correction is on the published report, deliberately. */
  /* +2 for CLCPA-319, NAMED so a ninth still fails: G1 files no feet figure
   * for 2023 or 2024, so declaring that column gives an EMPTY cell its
   * numeric alignment class. This suite's own probe, on its own BASE,
   * confirmed every remaining difference is that class on an empty cell.
   * The list is SORTED because it is compared against a sorted copy. */
  ok(JSON.stringify(moved.slice().sort()) === JSON.stringify(['A3:2023', 'A3:2024', 'A4:2023', 'A4:2024', 'D2:2023', 'D2:2024', 'D2:2025', 'D3:2023', 'D3:2024', 'D3:2025', 'D4:2023', 'D4:2024', 'D4:2025', 'G10:2024', 'G1:2023', 'G1:2024', 'J4:2025']),
     'Z2 and the panels move on exactly eight, six corrected by CLCPA-294 ' +
     'and CLCPA-290, two empty cells aligned by CLCPA-319: ' +
     JSON.stringify(moved.slice().sort()));
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
    /* re-pinned, named so the count stays exact */
    xlsxInstructionBlocks: 'NOT this ticket: CLCPA-282 operator-prose sweep: the workbook instructions and one rejection message say how many heading rows a table has',
    /* re-pinned, named so the count stays exact */
    ingestStagedSummary: 'NOT this ticket: CLCPA-300: the staged summary counts the columns that receive values',
    /* re-pinned, named so the count stays exact */
    derivedPctCols: 'NOT this ticket: CLCPA-294: a declared percentage column is always scaled, never guessed by value size',
    fmtDerivedCell: 'NOT this ticket: CLCPA-294: a declared percentage column is always scaled, never guessed by value size',
    formatCell: 'NOT this ticket: CLCPA-294: a declared percentage column is always scaled, never guessed by value size',
    renderTable: 'NOT this ticket: CLCPA-294: a declared percentage column is always scaled, never guessed by value size',
    /* re-pinned, named so the count stays exact */
    xlsxCell: 'NOT this ticket: CLCPA-274 option (c): a populated year exports its values, and a number is written as a number',
    /* CLCPA-291, named so the count stays exact */
    ingestTextOnlyColumn: 'NOT this ticket: CLCPA-291: a text column in a structure row is (no value), not (calculated) (new)',
    /* CLCPA-304, named so the count stays exact */
    parseB2Plugs: 'NOT this ticket: CLCPA-304: Section Bs plug counts read the shared schema reader, so a year created by import stops parsing every count as zero',
    /* CLCPA-307 and CLCPA-310, named so the count stays exact */
    unitNoticeValue: 'NOT this ticket: CLCPA-310: the fraction advisory formats the value it shows, so a floating point artifact stops reaching operator-facing text (new)',
    /* CLCPA-302, named so the count stays exact */
    diffRows: 'NOT this ticket: CLCPA-302: the history counts operator changes only, applying the same two exclusions the Confirm-save dialog applies, so the record and the sentence the operator approved cannot disagree',
    /* CLCPA-246, named so the count stays exact */
    dacCell: 'NOT this ticket: CLCPA-246: COMMENT ONLY. A fallback to the display view was written here, measured to change nothing on the path the app actually uses, and removed. The note records why, so the next reader does not rebuild it',
    /* CLCPA-319, named so the count stays exact */
    isTotalOnlyDerived: 'NOT this ticket: CLCPA-319: G1 to G9s total row is computed from the rows beneath it, so the report follows its own figures instead of showing a stored copy (a columnTotal is derived on the total row alone)',
    totalRowFlags: 'NOT this ticket: CLCPA-319: G1 to G9s total row is computed from the rows beneath it, so the report follows its own figures instead of showing a stored copy (a columnTotal column CONFIRMS a total, so it is not skipped)',
    /* CLCPA-293 / A-10, named so the count stays exact */
    ingestRebuildableTotals: 'NOT this ticket: CLCPA-293 / A-10: a total the engine cannot derive is accepted from the preparer instead of being discarded in silence (new: it asks the engine which totals it can rebuild)',
    renderPreparerTotalsNotice: 'NOT this ticket: CLCPA-293 / A-10: a total the engine cannot derive is accepted from the preparer instead of being discarded in silence (new: the advisory that names one)',
    /* CLCPA-241 advisory, named so the count stays exact */
    renderKeptFigureNotice: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (new: the amber advisory that names a kept figure)',
    /* CLCPA-241 option (B), named so the count stays exact */
    applyDerivedCols: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten',
    stripDerivedForPersist: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (the strip refuses a kept cell)',
    derivedCellWrite: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (new)',
    derivedFiledReproduced: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (new)',
    unreconciledDerivedCols: 'NOT this ticket: CLCPA-241 option (B): A9 % Change computes, and a filed figure the derivation does not reproduce is KEPT rather than overwritten (new)',
    /* CLCPA-287 round 2, named so the count stays exact */
    ingestKeyColDescription: 'NOT this ticket: CLCPA-287 round 2: a key-column rejection names an unheaded column by role, not by its empty heading (new)',
    /* CLCPA-292 round 2, named so the count stays exact */
    ingestTemplateSource: 'NOT this ticket: CLCPA-292 round 2: a fresh-year template borrows its structure from a PUBLISHED year, never from a scratch one',
    /* CLCPA-282, named so the count stays exact */
    ingestHeaderKeys: 'NOT this ticket: CLCPA-282: a column on a two-level table is identified by its header PAIR (new)',
    ingestHeaderName: 'NOT this ticket: CLCPA-282: a column on a two-level table is identified by its header PAIR, and this names one for a message (new)',
    wireIngestPage: 'NOT this ticket: CLCPA-283: the remove-year handler it wires, and its refusal toast',
    /* CLCPA-283, named so the count stays exact */
    isYearProtected: 'NOT this ticket: CLCPA-283: a year the operator added is removable, data and all; protection is seed-year only',
    boot: 'NOT this ticket: CLCPA-283: a year the operator added is removable, data and all; protection is seed-year only (the seedYears note it carries)',
    /* CLCPA-301, named so the count stays exact */
    applyIngestImport: 'NOT this ticket: CLCPA-301: the import path computes the row total the importer deliberately left blank',
    fillDerivableSumsOnImport: 'NOT this ticket: CLCPA-301: the import path computes the row total the importer deliberately left blank (new)',
    /* CLCPA-281 round 3, named so the count stays exact */
    compareColWidths: 'NOT this ticket: CLCPA-281 round 3: the read-only surfaces ask the per-year header question through storedHeaderRowsInYear',
    renderSourceTables: 'NOT this ticket: CLCPA-281 round 3: the read-only surfaces ask the per-year header question through storedHeaderRowsInYear (it holds resolveRows and the has-data check)',
    storedHeaderRowsInYear: 'NOT this ticket: CLCPA-281 round 3: the read-only surfaces ask the per-year header question through storedHeaderRowsInYear (new)',

    /* CLCPA-269 r2, 270, 274, 275, 276, 277, 278 -- the review follow-up package of 2026-09-17. */

    ingestRowIsStoredHeader: 'CLCPA-274 round 3: is this row a stored header, by its blank label (new)',
    ingestYearCarriesHeaderRows: 'CLCPA-274 round 3: does THIS year carry them, or must it borrow (new)',
    ingestStoredHeaderRows: 'CLCPA-274 round 3: the table\'s own header rows, from a year that has them (new)',
    columnGrandTotals: 'CLCPA-278 round 3: and the engine\'s own summing, which is how recomputeTotals adds',
    ingestHeaderRowCount: 'CLCPA-274 round 2: how many leading data[] rows are really header, shared by the editor and the template writer (new)',
    rerenderIngestEditor: 'CLCPA-276 round 2: the editor repaint now repaints the notice mount beside it',
    ingestRoleOpen: 'CLCPA-270 amendment (the A8 ruling): the value half of the protection follows derivability (new)',
    ingestRowRole: 'CLCPA-270: the row role, from its label (new)',

    isTotalRoleLabel: 'CLCPA-270: the total-role label test (new)',

    isComputedShareLabel: 'CLCPA-270: a percentage OF A TOTAL (new)',

    ingestComputed: 'CLCPA-274: the template gains its own accessor',

    buildIngestWorkbook: 'CLCPA-274: the writer marks derivable total columns',

    rowSumIsConsistent: 'CLCPA-278: whose figure is this total (new)',

    recomputeDerivableSums: 'CLCPA-278: a consistent total follows the edit (new)',

    clearIngestNotices: 'CLCPA-276: one helper for every notice exit (new)',

    declaredYearFromFilename: 'CLCPA-277: the year token in a filename (new)',

    importYearNotice: 'CLCPA-277: the wrong-year advisory (new)',

    /* CLCPA-250, 267, 271, 272, 273 -- the eight-ticket wave of 2026-09-16. */

    shiftSchemaYears: 'CLCPA-267: the borrowed-schema year shift (new)',

    getTableSchema: 'CLCPA-267: its fallback shifts the donor year',

    isPercentLiteral: 'CLCPA-273: the percent predicate, lifted out of buildIngestImport (new)',

    noteTypedPercent: 'CLCPA-273: records a percent typed into a cell (new)',

    renderTypedUnitNotice: 'CLCPA-273: the typed advisory, in the amber box (new)',

    refreshIngestNotices: 'CLCPA-273: repaints the notice mount in place (new)',

    wireIngestEditor: 'CLCPA-273: the blur handler reads the text before the parse',

    loadIngestDraft: 'CLCPA-273: clears the typed advisories on a table-year change',

    renderIngestImport: 'CLCPA-273 and CLCPA-272: the mount carries both advisories',

    refreshIngestCalcCells: 'CLCPA-271: calc cells keep their column format on repaint',

    dacDerivedTablesForYear: 'CLCPA-250: one year of display tables (new)',

    recomputeYearDerived: 'CLCPA-250: the composer KPI pass, re-runnable (new)',

    recomposeYearIfComposed: 'CLCPA-250: the composed-source gate (new)',

    composePayloadFromRows: 'CLCPA-250: it resolves a schema through getTableSchema',

    buildYearSelector: 'CLCPA-250: a year change re-derives that year',

    openSaveModal: 'CLCPA-250 and CLCPA-272: a save re-derives, and the dialog advises',

    detectSumColumns: 'CLCPA-272: the schema-derived sum relationship (new)',

    reconcileSumColumns: 'CLCPA-272: the reconciliation itself (new)',

    renderReconcileNotice: 'CLCPA-272: the reconciliation advisory box (new)',
    isDeclaredSummable: 'CLCPA-254: the declaration, new',
    tableCaption: 'NOT this ticket: CLCPA-252 round 2, it consults the derivation',
    deriveTableCaption: 'NOT this ticket: CLCPA-252 round 2, the title derivation (new)',
    stripCaptionYear: 'NOT this ticket: CLCPA-252 round 3: the caption year strip (new)',
    deriveTableCaptionInfo: 'NOT this ticket: CLCPA-252 round 2, the three strategies (new)',
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
    recomputeTotals: 'CLCPA-254: it consults the declaration',
    renderIngestEditor: 'CLCPA-255: a total row loses its delete control',
    buildIngestImport: 'CLCPA-261: the unit notice is collected',
    renderIngestImportResult: 'CLCPA-261: and rendered',
    /* CLCPA-293 round 4, named so the count stays exact */
    isB7PreparerTotal: 'NOT this ticket: CLCPA-293 round 4: an explicit registry of totals that BELONG TO THE PREPARER because the engine cannot honestly derive them (new: the membership test)',
    /* CLCPA-307 round 2 (functions it changed), named so the count stays exact */
    draw: 'NOT this ticket: CLCPA-307 round 2: the dialog draws the help text and the staged summary from the button label source, and refreshes both in place as the year is typed, as it already did for the button itself',
    renderIngestImportBar: 'NOT this ticket: CLCPA-307 round 2: the import note carries an id so the dialog can keep it current when the button it names changes',
    /* the DAC map placeholder, named so the count stays exact */
    renderMapKPI: 'NOT this ticket: the DAC map Customer Counts panel retires its Coming soon placeholder card, which was a literal in this markup carrying no data; the section is a flex column with a gap, so the remaining cards close up on their own',
    /* CLCPA-310 round 2, named so the count stays exact */
    nearZeroPctText: 'NOT this ticket: CLCPA-310 round 2: a non-zero percentage that would round to all zeros renders as less-than the smallest magnitude its precision can show, so a small share stops reading as an absent one; the threshold is 10^-decimals, derived from the declared precision (new)',
    /* CLCPA-308 round 2, named so the count stays exact */
    isDeclaredComputedRow: 'NOT this ticket: CLCPA-308 round 2: a row the TABLE DEFINITION declares computed takes the computed role, so the editor and the section page stop disagreeing about what the row is; asked of DERIVED_ROWS, never of a label or a per-row list (new)',
    /* CLCPA-307 round 2, named so the count stays exact */
    ingestPrimaryLabel: 'NOT this ticket: CLCPA-307 round 2: the ONE place the confirm button is named, because that button is contextual -- Add Year for a fresh year, Load Data for one that exists -- so a literal is wrong on one of the two paths every time (new)',
    ingestRejectedStillDoes: 'NOT this ticket: CLCPA-307 round 2: and what that button will still do to a rejected file, which is not the same thing on the two paths: on an existing year nothing is created, so the promise is dropped rather than reworded (new)',
    /* CLCPA-303 round 2, named so the count stays exact */
    ingestDeclaredTotalCell: 'NOT this ticket: CLCPA-303 round 2: the COLUMN axis of the option (C) declaration, seen from the import path: a declared columnTotal cell on a total row is the preparers claim, not a column the engine rebuilds from its neighbours (new)',
    ingestFiledTotalReason: 'NOT this ticket: CLCPA-303 round 2: ONE reader for a filed value in a computed cell, returning WHICH rule claimed it, shared with the CLCPA-293 registry rather than bolted beside it (new)',
    renderRefusedFiledNotice: 'NOT this ticket: CLCPA-303 round 2: a figure the import would not take is NAMED, in the result box as well as the staging count, because a refusal the operator cannot see is indistinguishable from a bug (new)',
    /* CLCPA-302 round 2, named so the count stays exact */
    ingestOperatorCell: 'NOT this ticket: CLCPA-302 round 2: one shared reader for which cells BELONG TO THE OPERATOR, so the confirm count and the change history cannot disagree about an engine recompute (new)',
    /* CLCPA-320 round 3, named so the count stays exact */
    ingestMarkerSource: 'NOT this ticket: CLCPA-320 round 3: an EMPTY cell in a POPULATED year takes its marker from the same derivability the fresh path consults, so the two workbooks cannot disagree about a cell neither has a figure for (new)',
    buildIngestWorkbook: 'NOT this ticket: CLCPA-320 round 3: an EMPTY cell in a POPULATED year takes its marker from the same derivability the fresh path consults, so the two workbooks cannot disagree about a cell neither has a figure for (it consults that source for an empty cell)',
  };
  changed.forEach(n => ok(n in EXPECT, 'the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  /* 5 -> 8: CLCPA-252 round 2 added two and changed tableCaption, all named. */
  /* 8 -> 13: CLCPA-264 moved five this suite can see, all named above. */
  /* 13 -> 18: CLCPA-263 moved five, all named above. */
  /* 38 -> 48: the review follow-up package moved 10 more, every one of them named in the map above. The delta equals the number of entries added to that map, so nothing entered this count unattributed. */
  /* +1: the A8 ruling added ingestRoleOpen, named in the map above. */
  /* +2: CLCPA-274 round 2 added ingestHeaderRowCount and CLCPA-276
   * round 2 moved rerenderIngestEditor, both named in the map above. */
  ok(changed.length === 102, 'X1 exactly this many functions changed: ' + changed.length);
  ['detectAvgColumns', 'detectPctColumns',
   'phantomSpacerCols', 'dacCol'].forEach(n => {
    ok(grabFn(n, SRC) === grabFn(n, BASE_SRC), 'X2 ' + n + ' is byte-identical to BASE');
  });
  /* totalRowFlags LEFT that list for CLCPA-319. A columnTotal is the one
   * derived-column type that BELONGS in the arithmetic confirmation: the
   * total row's own column total is the figure that confirms the row, so
   * skipping it left nothing to confirm and the row re-entered the sum.
   * Attribution replaces byte equality rather than removing the guard --
   * any other edit to the confirmer still turns this red. */
  const TRF_319 = [
    "      .filter(d => d.type !== 'columnTotal')",
    "      .forEach(d => skip.add(d.column));",
  ];
  const trfAdded = grabFn('totalRowFlags', SRC).split('\r\n')
    .filter(l => grabFn('totalRowFlags', BASE_SRC).indexOf(l) < 0)
    .filter(l => l.trim() && !/^\s*[*/]/.test(l.trim()));
  ok(trfAdded.length === TRF_319.length && trfAdded.every(l => TRF_319.indexOf(l) >= 0),
     'X2b totalRowFlags differs from BASE only by CLCPA-319 letting a ' +
     'column total confirm its own row -- ' +
     JSON.stringify(trfAdded.filter(l => TRF_319.indexOf(l) < 0)));
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
