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
/* THE FINAL STACKED GATE for the Section C fix package.
 *
 * Every group in this package proved itself against the group below it. That
 * is the right baseline for a group, and it is the WRONG baseline for the
 * package: five suites each saying "I changed only what I named, relative to
 * the thing before me" does not add up to a statement about what a deploy
 * would put on the screen. Only a comparison against the LAST DEPLOYED build
 * does that.
 *
 * So: BASE is main as it stood before group B, which is the build now hosted.
 * NEW is the complete stack, A through E, as it will be merged. Both sides
 * render ALL 149 stored table-years, TWICE -- once as the single-year panel
 * and once as the compare panel, which is the second anatomy CLCPA-248 spent
 * three rounds on and which no group suite drives over the whole payload.
 *
 * Every difference must be claimed by a named ticket. An unclaimed one fails.
 * A claim that matches nothing fails too, because a ticket that changed
 * nothing on 149 stored years is a ticket whose fix did not land.
 *
 * WHAT THIS DOES NOT PROVE: the editor, the import, and the Report Data page
 * are out of its reach -- those are their own suites' work and Emely's hosted
 * pass. This gate is about the REPORT PAGE, both its panels, on the years an
 * operator already has.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const kit = require('../_kit/caption_diff.js');

const REPO = _dacRepo() + '';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const OUT = path.join(REPO,
  'Coned/CLCPA/tickets/section-c-package-evidence/gate-149-stacked-output.txt');

/* The DEPLOYED build, pinned to a literal sha: group A's head, which is what
 * main carries. Never HEAD -- a baseline that moves with the tree is not a
 * baseline.
 *
 * Why this commit and not main's tip 5f3735d: the tip is the MERGE commit for
 * group A, and this stack branched from group A's head, so the merge commit is
 * not an ancestor of it. X2 below caught that -- it is the same sha the whole
 * stack's suites pin, and `git rev-parse` says the two commits carry the same
 * app.js blob 0829870, so nothing is given up by pinning the ancestor. */
const BASE = process.env.DAC_BASE_COMMIT || '9699f62';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);
const SRC = fs.readFileSync(APP, 'utf8');
/* git blobs are LF, the working tree is CRLF. Without this every CRLF-anchored
 * slice below returns -1 and silently reads from the end of the file. */
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

/* ---- the assembler, line-indexed, resolving deps by ReferenceError ------ */
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
  const want = ['renderSourceTables', 'getTableSchema', 'recomputeTotals'];
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
say('Section C package -- THE FINAL STACKED GATE');
say('  BASE ' + BASE + '  (main before group B: the DEPLOYED build)');
say('  NEW  the complete stack, groups A through E');
say('======================================================================');

/* ---- THE CLAIMS. Every difference must match one; every one must match
 * something. A ticket whose claim matches nothing did not land. -------- */
/* CLCPA-241 IS DELIBERATELY NOT A CLAIM HERE, and the reason is the ticket's
 * whole point. It was written as one and matched nothing, twice.
 *
 * A9's "% Change" pair now computes instead of rendering a stored string that
 * never recomputed. But the ruling admits exactly the eighteen cells whose
 * stored figures the derivation REPRODUCES, and keeps the two it does not. So
 * on all 149 stored table-years the rendered panel is byte-identical: value
 * identity is the condition on which those cells may be computed at all, and
 * a claim here would be asserting a visible change the ticket exists to avoid.
 *
 * The first two attempts DID move A9, and both were defects this gate caught:
 * the computed ratio rendered as "-0.26" because a two-level heading gave
 * detectPctColumns nothing to detect, and then as "-25.8%" because the report
 * renders declared percentages at one decimal while A9's figures are filed as
 * whole percents. Z2 below is now the assertion: A9 moves NOTHING. What the
 * ticket does change is what happens when an input is EDITED, which is
 * suite_241_289's to prove, not this gate's. */
const CLAIMS = [
  { id: 'CLCPA-252 r3',
    what: 'no caption carries a year, on any surface: every stored caption ' +
          'with a year token loses it at render time',
    /* the shared kit: everything outside the <h3> byte-identical, and each
     * caption its BASE self with year tokens removed. A reworded caption or a
     * changed cell still falls through to the next claim and then to the
     * unclaimed list. */
    hit: (id, y, a, b) => kit.onlyCaptionYearsChanged(b, a) },
  { id: 'CLCPA-252',
    what: 'the caption comes from the table definition, so a stored year with ' +
          'no title entry names itself instead of rendering bare',
    /* A8:2023 is the one stored table-year of 149 with no title entry */
    hit: (id, y, a, b) =>
      a.replace(/Table [A-Z]\d+[^<]*/g, 'CAP') === b.replace(/Table [A-Z]\d+[^<]*/g, 'CAP') },
  /* CLCPA-254 IS DELIBERATELY NOT A CLAIM HERE, and the first run of this gate
   * is why. It was written as one -- "C2's total computes instead of rendering
   * blank" -- and matched NOTHING, on either panel. The reason is that the
   * report page prints the STORED value, and C2/2025's stored total is already
   * 736.73. The blank the audit saw is what a RECOMPUTE returns, which is the
   * editor's path, not this one. So CLCPA-254 correctly moves nothing on 149
   * stored years, and section E below asserts that invisibility rather than
   * leaving it as an absence. The recompute itself is suite_254_255_261's. */
  { id: 'CLCPA-290',
    what: 'an average total ConEd filed nothing in renders the dash instead ' +
          'of a blank: A3 and A4 for 2023 and 2024',
    /* PRECISE, not permissive: strip the cells that NOW hold a dash and the
     * remainder must be a shape already claimed -- identical, or differing
     * only by CLCPA-252 r3's caption-year removal. A3:2023 carries BOTH
     * changes at once, which is why neither single claim matched it and why
     * this one has to name the composition rather than widen.
     *
     * A dash replacing a VALUE, or any other edit anywhere in the panel,
     * survives the substitution and still falls through to unclaimed. */
    hit: (id, y, a, b) => {
      const undashed = b.split('>—<').join('><');
      if (undashed === b) return false;          /* no dash appeared: not this */
      return undashed === a || kit.onlyCaptionYearsChanged(undashed, a);
    } },
  { id: 'CLCPA-294',
    what: 'a computed percentage that lost its x100 now shows it: a total ' +
          'fractionally above 1 read 1.0% where 100.0% is meant',
    /* The skeleton outside percentage cells must be identical, AND every
     * percentage that moved must have moved by exactly a factor of 100. A
     * percentage that changed any other way is NOT this ticket. */
    hit: (id, y, a, b) => {
      const PCT = />(-?[\d,]+\.?\d*)%</g;
      if (a.replace(PCT, '>P%<') !== b.replace(PCT, '>P%<')) return false;
      const A = a.match(PCT) || [], B = b.match(PCT) || [];
      if (A.length !== B.length || !A.length) return false;
      let movedOne = false;
      for (let i = 0; i < A.length; i++) {
        if (A[i] === B[i]) continue;
        const na = parseFloat(A[i].replace(/[>%<,]/g, ''));
        const nb = parseFloat(B[i].replace(/[>%<,]/g, ''));
        if (!isFinite(na) || !isFinite(nb)) return false;
        if (Math.abs(nb - na * 100) > Math.max(0.2, Math.abs(na))) return false;
        movedOne = true;
      }
      return movedOne;
    } },
  { id: 'CLCPA-319',
    what: "G1's 2023 and 2024 hold percentages with NO feet figure at all, so " +
          'their quantity cells are EMPTY. Declaring that column gives an empty ' +
          'cell the numeric alignment class it would have had with a figure in ' +
          'it. Nothing visible moves: the cell is empty on both sides.',
    /* Confined to G1 AND to the class attribute of an EMPTY cell. A cell that
     * gained or lost CONTENT still falls through to the unclaimed list.
     *
     * COMPOSED WITH THE CAPTION KIT, because a panel can carry two ticket's
     * changes at once and classify() returns only the first claim that fits.
     * G1:2023 has both: CLCPA-252 round 3 took the year out of its caption and
     * this ticket gave an empty cell its alignment class. Checking either
     * alone said "not mine" and the panel went to the unclaimed list. */
    hit: (id, y, a, b) => {
      if (id !== 'G1') return false;
      const norm = (h) => String(h)
        .replace(/<td><\/td>/g, 'EMPTY')
        .replace(/<td class="num"><\/td>/g, 'EMPTY');
      const na = norm(a), nb = norm(b);
      return na === nb || kit.onlyCaptionYearsChanged(nb, na);
    } },
];

function classify(id, y, a, b) {
  for (const c of CLAIMS) if (c.hit(id, y, a, b)) return c.id;
  return null;
}

/* =============== Z: 149 table-years, the SINGLE-YEAR panel ============= */
say('');
say('=== Z. the single-year panel, all 149 stored table-years ===========');
const singleBy = {};
/* what the single-year loop actually rendered, keyed by table-year. The
 * compare loop reads this to prove it drove a DIFFERENT path rather than the
 * same one twice -- see C2. */
const singleHtml = {};
guard('Z: every stored table-year renders, and every difference is claimed', () => {
  let checked = 0, tables = 0, threw = 0;
  const moved = [], unclaimed = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach(y => {
      if (!(t.data[y] || []).length) return;
      checked++;
      let a, b;
      try {
        a = String(OLD.attempt(api => api.renderSourceTables([t], y, {}, id)));
        b = String(NEW.attempt(api => api.renderSourceTables([t], y, {}, id)));
      } catch (e) { threw++; unclaimed.push(id + ':' + y + ' THREW ' + e.message); return; }
      singleHtml[id + ':' + y] = b;
      /* a render that produced no table is a render that proved nothing */
      if (/<table/.test(b)) tables++;
      if (a === b) return;
      moved.push(id + ':' + y);
      const c = classify(id, y, a, b);
      if (c) (singleBy[c] = singleBy[c] || []).push(id + ':' + y);
      else unclaimed.push(id + ':' + y);
    });
  });
  ok(threw === 0, 'Z0 nothing threw: ' + threw);
  ok(checked === 149, 'Z1 ' + checked + ' stored table-years rendered on both sides');
  ok(tables === 149, 'Z1b and every one produced a <table>: ' + tables);
  ok(unclaimed.length === 0,
     'Z2 every difference is claimed by a named ticket' +
     (unclaimed.length ? ': ' + unclaimed.slice(0, 6).join(', ') : ''));
  say('       moved: ' + moved.length + ' of ' + checked);
  CLAIMS.forEach(c => {
    const n = (singleBy[c.id] || []).length;
    say('       ' + c.id + ': ' + n + (n ? ' -- ' + (singleBy[c.id] || []).slice(0, 6).join(', ') : ''));
  });
});

/* =============== Z: the same 149, the COMPARE panel =================== */
say('');
say('=== Z. the compare panel, the second anatomy =======================');
const cmpBy = {};
/* how many of the 149 came back DIFFERENT from their single-year render. C2
 * reads this: it is what distinguishes a gate that drove two anatomies from
 * one that drove the same one twice while printing the same counts. */
let twoPaths = 0;
guard('Z: the compare panel renders too, and every difference is claimed', () => {
  let checked = 0, tables = 0, threw = 0;
  const moved = [], unclaimed = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach(y => {
      if (!(t.data[y] || []).length) return;
      checked++;
      const view = {}; view[id] = 'both';       // "Compare with previous"
      let a, b;
      try {
        a = String(OLD.attempt(api => api.renderSourceTables([t], y, view, id)));
        b = String(NEW.attempt(api => api.renderSourceTables([t], y, view, id)));
      } catch (e) { threw++; unclaimed.push(id + ':' + y + ' THREW ' + e.message); return; }
      if (/<table/.test(b)) tables++;
      if (b !== singleHtml[id + ':' + y]) twoPaths++;
      if (a === b) return;
      moved.push(id + ':' + y);
      const c = classify(id, y, a, b);
      if (c) (cmpBy[c] = cmpBy[c] || []).push(id + ':' + y);
      else unclaimed.push(id + ':' + y);
    });
  });
  ok(threw === 0, 'Z3 nothing threw in compare: ' + threw);
  ok(checked === 149, 'Z4 ' + checked + ' table-years rendered in COMPARE on both sides');
  ok(tables === 149, 'Z4b and every one produced a <table>: ' + tables);
  ok(unclaimed.length === 0,
     'Z5 every compare difference is claimed by a named ticket' +
     (unclaimed.length ? ': ' + unclaimed.slice(0, 6).join(', ') : ''));
  say('       moved: ' + moved.length + ' of ' + checked);
  CLAIMS.forEach(c => {
    const n = (cmpBy[c.id] || []).length;
    say('       ' + c.id + ': ' + n + (n ? ' -- ' + (cmpBy[c.id] || []).slice(0, 6).join(', ') : ''));
  });
});

/* =============== the claims are REAL, not decorative ================== */
say('');
say('=== C. each claim matched something, on at least one panel =========');
guard('C: a claim that matches nothing is a fix that did not land', () => {
  CLAIMS.forEach(c => {
    const n = (singleBy[c.id] || []).length + (cmpBy[c.id] || []).length;
    ok(n > 0, 'C1 ' + c.id + ' changed something on the stored years (' + n +
       '): ' + c.what);
  });
  /* The two panels are DIFFERENT code paths, and the compare panel is the one
   * that took CLCPA-248 three rounds. Proven from what the compare LOOP
   * produced, not from a fresh render made here: a fresh render would pass
   * even if the loop above had been driving the single-year path 149 times
   * while printing "rendered in COMPARE". That is the failure this gate is
   * most exposed to, and mut_gate_149 mutates the loop to prove C2 sees it. */
  ok(twoPaths >= 100, 'C2 the compare panel is a DIFFERENT render for ' +
     twoPaths + ' of 149, so this gate drove two anatomies and not one twice');
});

/* =============== the specific figure the audit named ================== */
say('');
say('=== D. the audit case, read off the rendered panel =================');
guard('D: C2s system total is on the screen, and was already', () => {
  const t = P.tables.C2;
  const b = String(NEW.attempt(api => api.renderSourceTables([t], '2025', {}, 'C2')));
  const a = String(OLD.attempt(api => api.renderSourceTables([t], '2025', {}, 'C2')));
  ok(/736\.7/.test(b), 'D1 the rendered C2:2025 panel carries 736.7');
  /* This assertion read "and the deployed build did not" on the first run and
   * went red, correctly: the deployed build prints it too, because it is the
   * STORED value. Stating the measured truth instead, which is the whole
   * reason CLCPA-254 is invisible on this surface. */
  ok(/736\.7/.test(a), 'D2 and so did the deployed build, because the panel ' +
     'prints the STORED total: this surface never showed the defect');
  ok(a === b, 'D3 so C2:2025 renders byte-identically on both sides');
});

/* =============== CLCPA-254s invisibility, asserted ==================== */
say('');
say('=== E. CLCPA-254 moves nothing here, and that is the right answer ==');
guard('E: the declared column changes the RECOMPUTE, not the stored render', () => {
  /* The two halves, both driven. If the fix had leaked into the stored-year
   * render it would be rewriting filed figures, which is the CLCPA-215 hazard
   * this package is under standing orders not to repeat. */
  const t = P.tables.C2;
  ['2023', '2024', '2025'].filter(y => (t.data[y] || []).length).forEach(y => {
    const a = String(OLD.attempt(api => api.renderSourceTables([t], y, {}, 'C2')));
    const b = String(NEW.attempt(api => api.renderSourceTables([t], y, {}, 'C2')));
    /* CLCPA-252 round 3: C2:2023 stores "Table C2.2023 Participation..." with
     * the year glued to the table id, so its caption moves. The claim worth
     * keeping is about FIGURES, so it is narrowed to that: nothing outside the
     * caption moved, and the caption only lost a year. */
    ok(kit.onlyCaptionYearsChanged(b, a),
       'E1 C2:' + y + ' differs only by its caption losing a year: no filed figure moved');
  });
  /* and the recompute, which is where the fix lives: BASE refuses the column,
   * this build sums it. Driven on both sides rather than described.
   *
   * TWO WRONG VERSIONS OF E3/E4 STAND BEHIND THIS BLOCK, and running it is
   * what caught both. First it asserted the deployed build returns blank on
   * C2's stored rows: it does not, because recomputeTotals KEEPS a stored
   * figure when it refuses to compute one. Then it emptied the total cell to
   * remove that keep, and THIS build returned blank too -- measured, and
   * recorded as E5 below: with the total cells of columns 3, 5 and 7 all
   * emptied, C2:2025 recomputes none of them on either build, because its data
   * rows are split-format strings the sum does not read as numbers. That is
   * pre-existing and has nothing to do with CLCPA-254.
   *
   * So the case is driven where the defect actually lives, and where the audit
   * found it: a year whose rows carry TYPED NUMBERS. The figures below are
   * C2:2025's own three values, so the arithmetic is the table's. */
  const schema = t.schema_by_year['2025'];
  const col = schema.findIndex(h =>
    String(h || '').trim().toLowerCase() === 'average event reductions (mw)');
  ok(col >= 0, 'E2 C2:2025 has the declared column, at index ' + col);
  /* THE TOTAL CELL IS EMPTIED FIRST, and that is the case, not a convenience.
   * recomputeTotals KEEPS a stored figure when it refuses to compute one, so
   * fed C2's stored 2025 rows both builds hand back 736.73 and the defect is
   * invisible -- E3 said "the deployed build returns blank" on the first run
   * and went red for exactly that reason. The blank the audit photographed is
   * an IMPORTED year, where nothing is stored for the engine to keep. Emptying
   * the cell is what puts the two builds in that state. */
  const typed = () => [
    ['DAC', null, null, 111, null, 222.5, null, 299.57],
    ['Low-Income', null, null, 444, null, 555.5, null, 2.82],
    ['All Others', null, null, 777, null, 888.5, null, 434.34],
    ['Total', null, null, null, null, null, null, null],
  ];
  const run = (H) => {
    const rows = typed();
    return H.attempt(api => {
      api.recomputeTotals(rows, schema, 'C2', []);
      return rows[3][col];
    });
  };
  let was, now;
  try { was = run(OLD); } catch (e) { was = 'THREW ' + e.message; }
  try { now = run(NEW); } catch (e) { now = 'THREW ' + e.message; }
  ok(was === null || was === '' || was === undefined,
     'E3 on a year of typed numbers the deployed build leaves C2s total column ' +
     JSON.stringify(was) + ': the blank the audit photographed');
  ok(typeof now === 'number' && Math.abs(now - 736.73) < 0.005,
     'E4 and this build computes ' + JSON.stringify(now) +
     ', the sum of the three rows, which is C2:2025s own stored 736.73');
  /* the measurement the second wrong version turned up, recorded rather than
   * discarded: nothing recomputes from C2's stored split-format cells, on
   * either build, which is a second reason no filed C2 figure can move. */
  const emptied = (H) => {
    const rows = t.data['2025'].map(r => r.slice());
    [3, 5, 7].forEach(c => { rows[3][c] = ''; });
    return H.attempt(api => { api.recomputeTotals(rows, schema, 'C2', []);
      return [rows[3][3], rows[3][5], rows[3][7]]; });
  };
  ok(JSON.stringify(emptied(NEW)) === JSON.stringify(['', '', '']) &&
     JSON.stringify(emptied(OLD)) === JSON.stringify(['', '', '']),
     'E5 and C2s STORED split-format rows ("299.57 (41%)") sum to nothing on ' +
     'either build, so no filed C2 figure could move even if a total were cleared');
});

/* =============== the baseline itself =================================== */
say('');
say('=== X. the baseline ================================================');
guard('X: BASE is a literal commit that PREDATES the stack', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X1 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try {
    execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: REPO });
    anc = true;
  } catch (e) { anc = false; }
  ok(anc, 'X2 and HEAD descends from it, so it is the build this stack changed');
  ok(SRC !== BASE_SRC, 'X3 and the two sources genuinely differ');
});

say('');
say('  ' + pass + ' passed, ' + fail + ' failed');
lines.forEach(l => console.log(l));
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
