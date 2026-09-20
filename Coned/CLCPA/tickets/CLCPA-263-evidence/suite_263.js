const _dacRepo = () => {
  const p = require('path'), f = require('fs');
  if (process.env.DAC_REPO) return p.resolve(process.env.DAC_REPO);
  let d = __dirname;
  for (let i = 0; i < 16; i++) {
    if (f.existsSync(p.join(d, '.clcpa-root'))) {
      const two = p.resolve(d, '..', '..');
      return f.existsSync(p.join(two, '.git')) ? two : d;
    }
    const u = p.dirname(d); if (u === d) break; d = u;
  }
  throw new Error('CLCPA project root not found above ' + __dirname + '; set DAC_REPO');
};
/* CLCPA-263: the "value (pct)" composites, DERIVED at render.
 *
 * THE DEFECT: C2's stored 2024 and 2025 rows carry the composite INSIDE the
 * string -- "37,988 (33%)" -- and nothing in this app computes that share. It
 * was typed. So a fresh year, where the operator enters bare numbers, renders
 * bare numbers beside a stored year that shows shares.
 *
 * WHAT THIS SUITE HAS TO PROVE:
 *   1. THE GATE: every stored table-year renders byte-identical. The
 *      derivation fires only on a BARE NUMBER, and no stored cell is one.
 *   2. A fresh year derives, and REPRODUCES C2:2025's own stored composites
 *      character for character -- 8 of the 9.
 *   3. The ninth is the stored inconsistency the audit found, named and
 *      disclosed rather than quietly matched.
 *   4. The SCOPE is what was measured: C2 alone, three columns. A payload-wide
 *      scan proves nothing else carries a composite.
 *   5. The value half is formatted the way renderTable would format it,
 *      proven by driving renderTable rather than by copying its rule.
 *   6. Nothing is stored: rowsForDisplay clones, and the input is untouched.
 *
 * TWO SOURCES, BOTH PINNED.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
/* CLCPA-252 round 3: the shared caption-difference judgement */
const kit = require('../_kit/caption_diff.js');

const REPO = _dacRepo() + '';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-263-evidence/suite-263-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || 'c6d0453';
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
  const L = src.split('\r\n');
  const TOP = [];
  L.forEach((ln, n) => {
    const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (nm) => {
    const k = TOP.findIndex(d => d.name === nm);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n');
  };
  const parts = [], have = new Set();
  const add = (n) => { if (have.has(n)) return false; const f = find(n); if (!f) return false;
    have.add(n); parts.push(f); return true; };
  const want = ['rowsForDisplay', 'getTableSchema', 'renderSourceTables',
    'detectPctColumns'];
  want.forEach(add);
  const OPTIONAL = ['applyCompositeShares', 'isCompositeShareCol', 'compositeValueText'];
  OPTIONAL.forEach(add);
  let api = null;
  const attempt = (call) => {
    for (let r = 0; r < 400; r++) {
      try {
        if (!api) api = new Function('PAYLOAD', 'const state = { payload: PAYLOAD };\n' +
          parts.join('\n\n') +
          '\n;return {' + want.filter(n => have.has(n)).join(',') + ', ' +
          OPTIONAL.map(n => n + ': (typeof ' + n + ' === "function" ? ' + n + ' : null)').join(', ') +
          '};')(P);
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
const C2S = NEW.attempt(api => api.getTableSchema(P.tables.C2, '2025'));

say('======================================================================');
say('CLCPA-263 -- the value (pct) composites, derived at render');
say('  BASE ' + BASE);
say('======================================================================');

/* =============== S: THE GATE ======================================== */
say('');
say('=== S. the gate: every stored table-year renders byte-identical =====');
guard('S: rowsForDisplay moves nothing on any stored year', () => {
  let checked = 0; const moved = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach(y => {
      const rows = t.data[y] || []; if (!rows.length) return;
      checked++;
      const s = NEW.attempt(api => api.getTableSchema(t, y));
      const a = OLD.attempt(api => api.rowsForDisplay(rows, s, id));
      const b = NEW.attempt(api => api.rowsForDisplay(rows, s, id));
      if (JSON.stringify(a) !== JSON.stringify(b)) moved.push(id + ':' + y);
    });
  });
  ok(checked === 149, 'S1 ' + checked + ' stored table-years put through the display view');
  /* BACK TO ZERO, and deliberately so. CLCPA-290 briefly moved four years
   * here, then was scoped: its total-row fill is OPT-IN and only the section
   * page asks for it, because filling unconditionally reached the KPI composer
   * and gave 2099 a reported value. This call does not opt in, so the plain
   * display view is byte-identical again -- which is the stronger statement. */
  ok(moved.length === 0, 'S2 and every one is byte-identical to BASE' +
     (moved.length ? ': ' + moved.slice(0, 5).join(', ') : ''));
});

guard('S: and the whole report page is unchanged too', () => {
  let checked = 0; const moved = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach(y => {
      if (!(t.data[y] || []).length) return;
      checked++;
      const a = String(OLD.attempt(api => api.renderSourceTables([t], y, {}, id)));
      const b = String(NEW.attempt(api => api.renderSourceTables([t], y, {}, id)));
      /* CLCPA-252 ROUND 3 changes what a STORED year renders: every caption
       * loses its year. This pin is NARROWED, not widened -- the shared kit
       * requires everything outside the <h3> to be byte-identical AND each
       * caption to be its BASE self with year tokens removed. A reworded
       * caption, a changed cell or an ADDED year still fails. */
      if (!kit.onlyCaptionYearsChanged(b, a)) moved.push(id + ':' + y);
    });
  });
  ok(checked === 149, 'S3 ' + checked + ' panels rendered on both sides');
  /* RE-POINTED, still exact. Two causes, both named, and a panel outside this
   * list still turns it red:
   *   G10:2024 and J4:2025 -- CLCPA-294, a computed total fractionally above 1
   *     on floating point, rendered 1.0% where 100.0% is meant.
   *   A3/A4 2023 and 2024 -- CLCPA-290, average totals ConEd filed nothing in,
   *     rendering the dash instead of a blank. No stored value moved.
   * The message prints the WHOLE list: it used to slice(0, 5) and hid the
   * sixth entry, so the assertion and its own message disagreed about why. */
  ok(JSON.stringify(moved.slice().sort()) ===
     JSON.stringify(['A3:2023', 'A3:2024', 'A4:2023', 'A4:2024', 'G10:2024', 'J4:2025']),
     'S4 the panels move on exactly six, four CLCPA-290 dashes and two ' +
     'CLCPA-294 corrections: ' + JSON.stringify(moved.slice().sort()));
});

guard('S: C2s own composite cells are what the gate is about', () => {
  /* the three stored years each hold a DIFFERENT convention, and none of them
   * is a bare number -- which is exactly why none of them is touched */
  const c23 = P.tables.C2.data['2023'][0];
  const c25 = P.tables.C2.data['2025'][0];
  ok(String(c23[1]) === '31%', 'S5 C2:2023 stores a bare PERCENTAGE: ' + JSON.stringify(c23[1]));
  ok(/^37,988 \(33%\)$/.test(String(c25[3])),
     'S6 C2:2025 stores a COMPOSITE: ' + JSON.stringify(c25[3]));
  ['2023', '2024', '2025'].forEach(y => {
    const s = NEW.attempt(api => api.getTableSchema(P.tables.C2, y));
    const out = NEW.attempt(api => api.rowsForDisplay(P.tables.C2.data[y], s, 'C2'));
    ok(JSON.stringify(out) === JSON.stringify(P.tables.C2.data[y]),
       'S7 C2:' + y + ' is returned unchanged');
  });
});

/* =============== D: the fresh year derives ========================== */
say('');
say('=== D. a fresh year of typed numbers derives the composites ========');
const FRESH = () => [
  ['DAC', null, null, 37988, null, 389.65, null, 299.57],
  ['Low-Income', null, null, 9492, null, 6.84, null, 2.82],
  ['All Others', null, null, 69101, null, 558.57, null, 434.34],
  ['Total', null, null, 116581, null, 955.06, null, 736.73],
];
guard('D: it reproduces C2:2025s stored composites, character for character', () => {
  const out = NEW.attempt(api => api.rowsForDisplay(FRESH(), C2S, 'C2'));
  const stored = P.tables.C2.data['2025'];
  let same = 0; const diff = [];
  [0, 1, 2].forEach(r => [3, 5, 7].forEach(c => {
    if (String(out[r][c]) === String(stored[r][c])) same++;
    else diff.push('r' + r + 'c' + c + ' derived ' + JSON.stringify(out[r][c]) +
      ' stored ' + JSON.stringify(stored[r][c]));
  }));
  /* THE FIGURES ARE C2:2025'S OWN, so this is the table's arithmetic and not a
   * fixture that agrees with itself. */
  ok(same === 8, 'D1 EIGHT of the nine match the stored string exactly: ' + same);
  ok(diff.length === 1, 'D2 and exactly one differs: ' + diff.join(' | '));
  /* THE ONE DIFFERENCE IS THE STORED INCONSISTENCY THE AUDIT FOUND. 434.34 of
   * 736.73 is 58.96%, which rounds to 59; the payload stores 58. Disclosed,
   * not matched -- reproducing a stored rounding error would mean teaching the
   * derivation to be wrong in the same place. */
  ok(/derived "434.34 \(59%\)" stored "434.34 \(58%\)"/.test(diff[0] || ''),
     'D3 and it is the disclosed C2:2025 rounding disagreement, not a new one');
  const exact = 434.34 / 736.73 * 100;
  ok(Math.abs(exact - 58.96) < 0.01 && Math.round(exact) === 59,
     'D4 the arithmetic: 434.34/736.73 = ' + exact.toFixed(2) + '%, which rounds to 59');
});

guard('D: the TOTAL row keeps its bare number', () => {
  const out = NEW.attempt(api => api.rowsForDisplay(FRESH(), C2S, 'C2'));
  [3, 5, 7].forEach(c => ok(out[3][c] === FRESH()[3][c],
    'D5 the total row column ' + c + ' is untouched: ' + JSON.stringify(out[3][c])));
  ok(!/%/.test(String(out[3][3]) + String(out[3][5]) + String(out[3][7])),
     'D6 a total is 100% of itself, and saying so would be noise');
});

guard('D: BASE derived nothing, which is the defect', () => {
  const out = OLD.attempt(api => api.rowsForDisplay(FRESH(), C2S, 'C2'));
  ok(out[0][3] === 37988, 'D7 at BASE the fresh cell stays a bare number: ' +
     JSON.stringify(out[0][3]));
  ok(OLD.attempt(api => api.applyCompositeShares) === null,
     'D8 and BASE has no derivation at all');
});

/* =============== N: only a BARE NUMBER fires ======================== */
say('');
say('=== N. it fires on a bare number and nothing else ==================');
guard('N: every other cell shape is left alone', () => {
  const CASES = [
    ['37,988 (33%)', 'an already-composite string'],
    ['31%', 'a bare percentage string'],
    ['n/a', 'text'],
    ['', 'empty'],
    [null, 'null'],
    ['1,234 ', 'a number with a trailing space -- still bare, so it DOES fire'],
  ];
  CASES.forEach(([v, why]) => {
    const rows = [['DAC', null, null, v, null, null, null, null],
                  ['Total', null, null, 100, null, null, null, null]];
    const out = NEW.attempt(api => api.rowsForDisplay(rows, C2S, 'C2'));
    if (why.indexOf('DOES fire') >= 0) {
      ok(/\(\d+%\)$/.test(String(out[0][3])),
         'N1 "1,234 " is a bare number and derives: ' + JSON.stringify(out[0][3]));
      return;
    }
    /* "LEFT ALONE" MEANS UNCHANGED, not "carries no percent suffix". This
     * first tested for the absence of a "(nn%)" ending and went red on the
     * already-composite case -- which ends that way BECAUSE it was already
     * composite and correctly untouched. The assertion was wrong, not the
     * code: comparing against the input is what the claim actually is. */
    ok(out[0][3] === v, 'N1 left alone: ' + JSON.stringify(v) + '  (' + why + ')' +
       (out[0][3] === v ? '' : ' -> ' + JSON.stringify(out[0][3])));
  });
});

guard('N: the denominator is the TOTAL ROW, not the body sum', () => {
  /* ON EVERY OTHER FIXTURE HERE THE TWO AGREE, so neither choice could be
   * told from the other and a mutation swapping them stayed GREEN. They come
   * apart exactly where C2:2024 already does: a year whose rows do not add up
   * to its filed total -- 2024 stores 104,025 against two rows summing to
   * 41,848, because it has no "All Others" row at all. An operator entering
   * that shape must see the shares the SOURCE reports, not shares of a subtotal
   * this app invented.
   *
   * 25 of 100 is 25%. 25 of the body sum (25 + 15 = 40) would be 63%. */
  const rows = [['DAC', null, null, 25, null, null, null, null],
                ['Low-Income', null, null, 15, null, null, null, null],
                ['Total', null, null, 100, null, null, null, null]];
  const out = NEW.attempt(api => api.rowsForDisplay(rows, C2S, 'C2'));
  ok(String(out[0][3]) === '25 (25%)',
     'N1b the share is of the TOTAL ROW (100), not the body sum (40): ' +
     JSON.stringify(out[0][3]));
  ok(String(out[1][3]) === '15 (15%)',
     'N1c and so is the second row: ' + JSON.stringify(out[1][3]));
  /* and the two genuinely differ here, or N1b passes for the wrong reason */
  ok(Math.round(25 / 40 * 100) === 63,
     'N1d the body-sum answer would have been 63%, so N1b was not free');
});

guard('N: a zero denominator derives nothing', () => {
  /* the guard is `if (!denom) continue`, and a `denom === null` version would
   * divide by zero. NaN% and Infinity% are both cells an operator could be
   * shown, and neither means anything. */
  const zeros = [['DAC', null, null, 0, null, null, null, null],
                 ['Total', null, null, 0, null, null, null, null]];
  const out = NEW.attempt(api => api.rowsForDisplay(zeros, C2S, 'C2'));
  ok(out[0][3] === 0, 'N1e a zero total derives nothing: ' + JSON.stringify(out[0][3]));
  ok(!/NaN|Infinity/.test(JSON.stringify(out)),
     'N1f and no cell reads NaN% or Infinity%: ' + JSON.stringify(out[0]));
  /* a NON-zero value against a zero total is the Infinity case specifically */
  const inf = [['DAC', null, null, 5, null, null, null, null],
               ['Total', null, null, 0, null, null, null, null]];
  const out2 = NEW.attempt(api => api.rowsForDisplay(inf, C2S, 'C2'));
  ok(out2[0][3] === 5 && !/Infinity/.test(JSON.stringify(out2)),
     'N1g and neither does a value against a zero total: ' + JSON.stringify(out2[0][3]));
});

guard('N: only the DECLARED columns derive', () => {
  /* column 1 of C2's schema is an unnamed spacer; it must never derive */
  const rows = [['DAC', 500, null, 37988, null, 389.65, null, 299.57],
                ['Total', 1000, null, 116581, null, 955.06, null, 736.73]];
  const out = NEW.attempt(api => api.rowsForDisplay(rows, C2S, 'C2'));
  ok(out[0][1] === 500, 'N2 the spacer column is untouched: ' + JSON.stringify(out[0][1]));
  ok(/\(\d+%\)$/.test(String(out[0][3])), 'N3 while the declared column derives');
  /* and NO other table derives, even with the same headings */
  const c3 = P.tables.C3, y3 = Object.keys(c3.data).sort().pop();
  const s3 = NEW.attempt(api => api.getTableSchema(c3, y3));
  const synth = [['Row A', 10, 20, 30], ['Total', 100, 200, 300]];
  const o3 = NEW.attempt(api => api.rowsForDisplay(synth, s3, 'C3'));
  ok(!/\(\d+%\)/.test(JSON.stringify(o3)),
     'N4 C3 derives nothing, because the declaration names C2 alone: ' + JSON.stringify(o3[0]));
});

/* =============== C: the scope, measured ============================= */
say('');
say('=== C. the scope: C2 alone, three columns ==========================');
guard('C: nothing else in the payload carries a composite', () => {
  const COMPOSITE = /^\s*[-+]?[\d,]*\.?\d+\s*\(\s*[-+]?[\d,]*\.?\d+\s*%\s*\)\s*$/;
  const hit = {};
  Object.keys(P.tables).forEach(id => {
    Object.keys(P.tables[id].data || {}).forEach(y => {
      (P.tables[id].data[y] || []).forEach(row => (row || []).forEach((v, c) => {
        if (c === 0 || v == null) return;
        if (COMPOSITE.test(String(v))) (hit[id] = hit[id] || new Set()).add(c);
      }));
    });
  });
  const ids = Object.keys(hit).sort();
  ok(ids.length === 1 && ids[0] === 'C2',
     'C1 exactly ONE table stores composites: ' + ids.join(', '));
  ok([...(hit.C2 || [])].sort((a, b) => a - b).join(',') === '3,5,7',
     'C2 in exactly three columns: ' + [...(hit.C2 || [])].sort((a, b) => a - b).join(','));
  /* and the declaration names those three by HEADING */
  [3, 5, 7].forEach(c => ok(
    NEW.attempt(api => api.isCompositeShareCol('C2', C2S[c])) === true,
    'C3 declared: ' + JSON.stringify(C2S[c])));
  ok(NEW.attempt(api => api.isCompositeShareCol('C2', 'Customer Group')) === false,
     'C4 and the label column is not');
  ok(NEW.attempt(api => api.isCompositeShareCol('C3', C2S[3])) === false,
     'C5 and the same heading in another table is not, because it is per TABLE');
});

/* =============== F: the value formatting ============================ */
say('');
say('=== F. the value half looks as renderTable would have printed it ====');
guard('F: driven against renderTable, not copied from it', () => {
  /* THE TRAP: renderTable formats a NUMBER cell before printing -- 37988
   * reaches the screen as "37,988". A composite STRING bypasses that branch,
   * so a derivation that concatenated the raw value would silently drop the
   * separators every stored composite carries. Proven by rendering the SAME
   * numbers through the real panel at BASE and reading what it printed. */
  const bare = [['DAC', null, null, 37988, null, 389.65, null, 2.82],
                ['Total', null, null, 116581, null, 955.06, null, 736.73]];
  const t = { id: 'C2', short_title: P.tables.C2.short_title,
    title_by_year: P.tables.C2.title_by_year,
    schema_by_year: { '2099': C2S }, data: { '2099': bare } };
  const html = String(OLD.attempt(api => api.renderSourceTables([t], '2099', {}, 'C2')));
  ok(/37,988/.test(html), 'F1 BASE prints 37988 as "37,988"');
  ok(/389\.65/.test(html), 'F2 and 389.65 as "389.65"');
  ok(/2\.82/.test(html), 'F3 and 2.82 as "2.82"');
  /* now the derived strings must carry those same renderings */
  const out = NEW.attempt(api => api.rowsForDisplay(FRESH(), C2S, 'C2'));
  ok(/^37,988 \(/.test(String(out[0][3])), 'F4 the derived cell keeps the separator: ' +
     JSON.stringify(out[0][3]));
  ok(/^389\.65 \(/.test(String(out[0][5])), 'F5 and the decimals: ' + JSON.stringify(out[0][5]));
  ok(/^2\.82 \(/.test(String(out[1][7])), 'F6 and a small decimal: ' + JSON.stringify(out[1][7]));
  /* the two rules agree, driven both ways */
  ok(NEW.attempt(api => api.compositeValueText(37988)) === (37988).toLocaleString(),
     'F7 compositeValueText matches toLocaleString for an integer');
  ok(NEW.attempt(api => api.compositeValueText(6.84)) === '6.84',
     'F8 and keeps two decimals under 100');
});

guard('F: C2s columns take renderTables DEFAULT numeric branch', () => {
  /* the copied rule is only right while these columns are neither percentage
   * nor currency columns. If one ever became either, renderTable would take a
   * different branch and this copy would silently diverge. */
  const pct = NEW.attempt(api => api.detectPctColumns(C2S));
  [3, 5, 7].forEach(c => ok(!pct[c],
    'F9 column ' + c + ' is not a percentage column, so the default branch applies'));
  const cur = (P.tables.C2.currency_cols || []);
  ok(cur.length === 0 || ![3, 5, 7].some(c => cur.indexOf(c) >= 0),
     'F10 and none of the three is a currency column: ' + JSON.stringify(cur));
});

/* =============== R: render-only ===================================== */
say('');
say('=== R. render-only: nothing composite is ever stored ===============');
guard('R: the input rows are not mutated', () => {
  const input = FRESH();
  const before = JSON.stringify(input);
  NEW.attempt(api => api.rowsForDisplay(input, C2S, 'C2'));
  ok(JSON.stringify(input) === before,
     'R1 rowsForDisplay left its input untouched, so nothing derived can be saved');
  /* and the clone really did change, or R1 proves nothing */
  const out = NEW.attempt(api => api.rowsForDisplay(FRESH(), C2S, 'C2'));
  ok(JSON.stringify(out) !== before, 'R2 while the returned clone did derive');
});

guard('R: the derivation lives in the display view, not the engine', () => {
  const code = codeOnly(SRC);
  ok(/applyCompositeShares\(clone, tableId, schema, colSum\);/.test(code),
     'R3 it is called from rowsForDisplay, on the clone');
  /* totalFlags is deliberately NOT passed: which row is the total is a LABEL
   * question here, and the flags require arithmetic confirmation. N1b and N1g
   * are what caught that. */
  ok(!/applyCompositeShares\([^)]*totalFlags/.test(code),
     'R3b and NOT the arithmetic totalFlags, which cannot see an unbalanced total');
  /* never from the engine that writes values back */
  ['recomputeTotals', 'applyIngestImport', 'buildIngestImport'].forEach(n => {
    const i = SRC.indexOf('\r\n  function ' + n + '(');
    const body = i < 0 ? '' : SRC.slice(i, SRC.indexOf('\r\n  }', i));
    ok(!/applyCompositeShares|compositeValueText/.test(body),
       'R4 ' + n + ' does not touch it');
  });
});

/* =============== X: blast radius and baseline ======================= */
say('');
say('=== X. what else moved =============================================');
function grabFn(n, src) {
  const L = src.split('\r\n');
  for (const pad of ['  ', '    ', '']) {
    const decl = new RegExp('^' + pad + '(?:async )?function ' + n + '\\s*\\(');
    const anyDecl = new RegExp('^' + pad + '(?:async )?function \\w+\\s*\\(');
    const start = L.findIndex(l => decl.test(l));
    if (start < 0) continue;
    const close = pad + '}';
    for (let i = start + 1; i < L.length; i++) {
      if (L[i] === close) return L.slice(start, i + 1).join('\r\n');
      if (anyDecl.test(L[i])) break;
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

    openAddYearDialog: 'CLCPA-277: the staged surface carries it too',

    stagedBlock: 'CLCPA-277: nested in openAddYearDialog, it renders the line',

    wire: 'CLCPA-277: nested in openAddYearDialog, it holds the call site',

    /* CLCPA-250, 267, 271, 272, 273 -- the eight-ticket wave of 2026-09-16. */

    renderIngestEditor: 'CLCPA-271 and CLCPA-272: the calc-cell format; the draft reconciliation',

    buildIngestImport: 'CLCPA-272 and CLCPA-273: it reconciles, and calls the extracted predicate',

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
    rowsForDisplay: 'CLCPA-263: it applies the shares to the clone',
    applyCompositeShares: 'CLCPA-263: the derivation, new',
    isCompositeShareCol: 'CLCPA-263: the declaration predicate, new',
    compositeValueText: 'CLCPA-263: the value formatting, new',
    bareNumber: 'CLCPA-263: the bare-number test, new',
    /* BOTH SIDES PRESERVED. CLCPA-252 round 3 landed on main while CLCPA-266
     * was in flight, and both extended this same census map. Neither set is
     * dropped: a census that forgets a landed ticket stops being an inventory. */
    stripCaptionYear: 'NOT this ticket: CLCPA-252 round 3, the caption year strip (new)',
    deriveTableCaptionInfo: 'NOT this ticket: CLCPA-252 round 3, it stops carrying the year across',
    tableCaption: 'NOT this ticket: CLCPA-252 round 3, it strips on all three paths',
    renderIngestImportResult: 'NOT this ticket: CLCPA-266, the notice boxes gain their accent classes',
  };
  changed.forEach(n => ok(n in EXPECT, 'the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  /* 5 -> 9, MEASURED on the merged state, not arithmetic: CLCPA-263's five,
   * plus CLCPA-252 round 3's three and CLCPA-266's one, all named above. The
   * number was read from this suite's own sentinel run, which reported the
   * nine by name before it was written here. */
  /* 30 -> 43: the review follow-up package moved 13 more, every one of them named in the map above. The delta equals the number of entries added to that map, so nothing entered this count unattributed. */
  /* +1: the A8 ruling added ingestRoleOpen, named in the map above. */
  /* +2: CLCPA-274 round 2 added ingestHeaderRowCount and CLCPA-276
   * round 2 moved rerenderIngestEditor, both named in the map above. */
  ok(changed.length === 69, 'X1 exactly this many functions changed: ' + changed.length);
  /* the derive engine itself is untouched */
  ['applyDerivedCols', 'recomputeTotals', 'totalRowFlags',
   'kpiDacPct', 'detectPctColumns'].forEach(n => {
    ok(grabFn(n, SRC) === grabFn(n, BASE_SRC), 'X2 ' + n + ' is byte-identical to BASE');
  });
});

guard('X: the baseline', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X3 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: REPO }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'X4 and HEAD descends from it');
  ok(SRC !== BASE_SRC, 'X5 and the two sources genuinely differ');
});

say('');
say('  ' + pass + ' passed, ' + fail + ' failed');
lines.forEach(l => console.log(l));
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
