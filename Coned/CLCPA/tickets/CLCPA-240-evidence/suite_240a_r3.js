/* CLCPA-240 first half, ROUND 3: the lock works on the screen it exists for.
 *
 * Round 2 shipped and Emely's hosted pass on d91e1d19ff failed it. The lock
 * identified group headers from i.baseline, and i.baseline is
 * getTableBody(table, year) -- EMPTY for a table-year whose data has never
 * been saved, which is exactly the state an operator is in immediately after
 * importing into a fresh year. All nine of A5:2099's headers rendered with an
 * open input and a delete button.
 *
 * THE DESIGN ERROR WAS MINE. I chose baseline identification to avoid trapping
 * a half-typed row, argued it well enough that it was ratified, and never
 * asked what the baseline actually holds on the one screen the feature is for.
 * Both my suites missed it because both always supplied a populated baseline --
 * and neither ever drove the baseline-bearing recompute at all: the first time
 * I did, it threw "unreconciledTotals is not defined". Two states reachable in
 * one click, neither tested.
 *
 * So this suite's first duty is to render the editor in the states an operator
 * is really in, not the one that was convenient:
 *
 *   STATE A  after Save          baseline = the saved rows
 *   STATE B  imported, unsaved   baseline = []          <-- the failing screen
 *   STATE C  hand-built rows     baseline = [], typed at the bottom
 *
 * BASE is 5b6e57e, the round-2 build that failed, so every claim is a
 * difference against the thing that was actually rejected.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-240-evidence/suite-240a-r3-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || '5b6e57e';
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

/* ---------- ONE scope per source, resolved by following ReferenceErrors ---
 *
 * The seed list is a seed. A hardcoded list rots, and this ticket has now lost
 * three rounds of time to names missing from one -- so the probe below DRIVES
 * every path the guards use, including the baseline-bearing recompute and a
 * real render, and anything unresolved is added rather than guessed at. */
function build(src, tag) {
  const fns = ['recomputeTotals', 'totalRowFlags', 'buildIngestImport',
    'getTableSchema', 'getTableBody', 'ingestComputed', 'ingestTemplateSource',
    'normIngestKey', 'ingestIsHeaderRow', 'ingestIsBlankCell',
    'renderIngestEditor', 'columnNumericMask'];
  const cs = [];
  const STATE = { payload: P, ingest: {} };
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  for (let it = 0; it < 400; it++) {
    const body = '"use strict";\n' +
      'const console = { warn: () => {}, info: () => {}, log: () => {}, error: () => {} };\n' +
      'const document = { getElementById: () => null, querySelectorAll: () => [] };\n' +
      cs.map(n => grabConst(n, src)).join('\n') + '\n' +
      fns.map(n => grab(n, src)).join('\n') + '\n' +
      'return {' + fns.join(',') + '};';
    let api;
    try {
      api = new Function('P', 'state', 'escapeHtml', body)(P, STATE, esc);
    } catch (e) {
      const nm = (/^(\w+) is not defined$/.exec(e.message || '') || [])[1];
      if (!nm) throw new Error(tag + ' shell: ' + e.message);
      if (grab(nm, src) && fns.indexOf(nm) < 0) { fns.push(nm); continue; }
      if (grabConst(nm, src) && cs.indexOf(nm) < 0) { cs.push(nm); continue; }
      throw new Error(tag + ' cannot resolve ' + nm);
    }
    try {
      const s25 = P.tables.A5.schema_by_year['2025'];
      const d = P.tables.A5.data['2025'].map(r => r.slice());
      /* BASELINE-BEARING, which is the path both earlier suites skipped */
      api.recomputeTotals(d, s25, 'A5', P.tables.A5.data['2025'].map(r => r.slice()));
      api.totalRowFlags(d, 'A5', s25);
      api.buildIngestImport([s25, ['HVAC', 1, 1, null]], s25, [], 'A5');
      STATE.ingest = { tableId: 'A5', year: '2025', schema: s25,
        baseline: P.tables.A5.data['2025'].map(r => r.slice()),
        draft: P.tables.A5.data['2025'].map(r => r.slice()), dirty: false };
      api.renderIngestEditor();
      /* and an EMPTY baseline, which is the state that failed */
      STATE.ingest.baseline = [];
      api.renderIngestEditor();
      /* D2 reaches a whole chain of derived-row helpers that A5 never touches
       * -- unreconciledDerivedRows, then derivedRowValue, then whatever those
       * reach. RENDER IT HERE rather than naming them in the seed list: a
       * hardcoded list rots, and each missing name surfaced as four tables
       * "differing" from BASE when they had merely thrown. Drive every path the
       * guards use, and the resolver finds the chain itself. */
      ['D2', 'A1', 'A3'].forEach(id => {
        const ys = Object.keys((P.tables[id] || {}).data || {})
          .filter(y => (P.tables[id].data[y] || []).length);
        if (!ys.length) return;
        const y = ys[ys.length - 1];
        STATE.ingest = { tableId: id, year: y,
          schema: (P.tables[id].schema_by_year || {})[y] || [],
          baseline: P.tables[id].data[y].map(r => r.slice()),
          draft: P.tables[id].data[y].map(r => r.slice()), dirty: false };
        api.renderIngestEditor();
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
guard('both sources assemble, and every path the guards use RUNS', () => {
  NEW = build(SRC, 'NEW');
  OLD = build(BASE_SRC, 'BASE');
  ok(!!NEW && !!OLD,
     'the changed source and BASE (' + BASE + ') both assemble, and both survive a ' +
     'baseline-bearing recompute plus a render with an EMPTY baseline');
});
if (!NEW || !OLD) {
  lines.forEach(l => console.log(l));
  console.log('\n  ' + pass + ' passed, ' + fail + ' failed  (assembly failed)');
  process.exit(1);
}

const isEmptyV = v => v === null || v === undefined || String(v).trim() === '';
const hdrLike = r => Array.isArray(r) && r.length > 1 && !isEmptyV(r[0]) &&
  r.slice(1).every(isEmptyV);
const hasNumV = r => Array.isArray(r) && r.slice(1).some(
  v => typeof v === 'number' && isFinite(v));
const totalish = l => /total/i.test(String(l == null ? '' : l));
const hasInput = t => /<input/.test(t);
const hasDel = t => /ingest-row-delete/.test(t);

function renderWith(api, tableId, year, schema, draft, baseline) {
  api.STATE.ingest = { tableId: tableId, year: year, schema: schema,
    baseline: baseline.map(r => r.slice()), draft: draft.map(r => r.slice()),
    dirty: false };
  const html = api.renderIngestEditor();
  const by = {};
  (html.match(/<tr[^>]*data-row="\d+"[\s\S]*?<\/tr>/g) || []).forEach(t => {
    const m = /data-row="(\d+)"/.exec(t); if (m) by[parseInt(m[1], 10)] = t;
  });
  return { html: html, row: (i) => by[i] || '', count: Object.keys(by).length };
}

/* the 2099 the operator actually has: the 2025 template, values typed in,
 * imported into a year that has nothing */
const schema99 = NEW.getTableSchema(P.tables.A5, '2099');
const stored25 = P.tables.A5.data['2025'];
function importedInto2099(api) {
  const comp = api.ingestComputed(stored25, 'A5', P.tables.A5.schema_by_year['2025']);
  const file = [schema99.slice()];
  stored25.forEach((row, idx) => {
    const out = [String(row[0])];
    for (let c = 1; c < schema99.length; c++) {
      if (hdrLike(row)) out.push('(no value)');
      else if (comp.any(idx, c)) out.push('(calculated)');
      else out.push(row[c] == null || row[c] === '' ? null : row[c]);
    }
    file.push(out);
  });
  const res = api.buildIngestImport(file, schema99, [], 'A5');
  if (!res.ok) throw new Error('the 2099 import did not complete: ' +
    (res.rejections[0] ? res.rejections[0].why : '?'));
  const rows = res.candidate.map(r => r.slice());
  api.recomputeTotals(rows, schema99, 'A5', []);
  return rows;
}
const HDR = stored25.map((r, i) => i).filter(i => hdrLike(stored25[i]));

/* ============ B: THE SCREEN THE FEATURE EXISTS FOR ===================== */
say('');
say('=== B. imported into a fresh year, NOT yet saved: baseline is [] ======');
guard('B: an empty baseline still locks every group header', () => {
  const rows = importedInto2099(NEW);
  const r = renderWith(NEW, 'A5', '2099', schema99, rows, []);
  ok(r.count === 50, 'B1 the grid renders all 50 imported rows: ' + r.count);
  const open = HDR.filter(i => hasInput(r.row(i)));
  const del = HDR.filter(i => hasDel(r.row(i)));
  ok(HDR.length === 9, 'B2 A5 has nine group headers: ' + HDR.length);
  ok(open.length === 0,
     'B3 not one of them has an input, with NOTHING saved yet' +
     (open.length ? ': rows ' + open.join(', ') : ''));
  ok(del.length === 0,
     'B4 and not one has a delete button' + (del.length ? ': rows ' + del.join(', ') : ''));
  const band = HDR.filter(i => /ingest-row-subheader/.test(r.row(i)));
  ok(band.length === 9, 'B5 and each carries the header band: ' + band.length);
  /* THE STATE ITSELF IS ASSERTED. Without this, quietly handing state B a
   * populated baseline makes every assertion above pass while testing the one
   * thing that already worked -- which is precisely how round 2 shipped. */
  ok((NEW.STATE.ingest.baseline || []).length === 0,
     'B5b and the baseline this was rendered with really is empty: ' +
     (NEW.STATE.ingest.baseline || []).length + ' rows');

  /* the data rows must keep working */
  const dataIdx = stored25.map((x, i) => i)
    .filter(i => !hdrLike(stored25[i]) && !totalish(stored25[i][0]));
  const lost = dataIdx.filter(i => !hasInput(r.row(i)) || !hasDel(r.row(i)));
  ok(lost.length === 0,
     'B6 all ' + dataIdx.length + ' data rows keep their input and their x' +
     (lost.length ? ': ' + lost.slice(0, 5).join(', ') : ''));
});

guard('B: BASE left all nine open, which is what Emely found', () => {
  const rows = importedInto2099(OLD);
  const r = renderWith(OLD, 'A5', '2099', schema99, rows, []);
  const open = HDR.filter(i => hasInput(r.row(i)));
  const del = HDR.filter(i => hasDel(r.row(i)));
  ok(open.length === 9,
     'B7 on BASE all nine headers had an open input: ' + open.length +
     '  ' + JSON.stringify(open));
  ok(del.length === 9, 'B8 and all nine had a delete button: ' + del.length);
  ok(/<td>\s*<input/.test(r.row(0)) || /<\/td><td>\s*<input/.test(r.row(0)),
     'B9 including an input in Total Installations on the FIRST header, ' +
     'which is the screenshot');
});

/* ============ A: after Save, unchanged from round 2 ==================== */
say('');
say('=== A. after Save: identical to the build Emely accepted on that point ==');
guard('A: a populated baseline behaves exactly as BASE did', () => {
  const rows = importedInto2099(NEW);
  const baseline = rows.map(r => r.slice());
  const a = renderWith(NEW, 'A5', '2099', schema99, rows, baseline);
  const b = renderWith(OLD, 'A5', '2099', schema99, importedInto2099(OLD),
    importedInto2099(OLD));
  ok(HDR.filter(i => hasInput(a.row(i)) || hasDel(a.row(i))).length === 0,
     'A1 every header is locked');
  ok(a.html === b.html,
     'A2 and the whole grid is byte-identical to BASE in this state, so ' +
     'round 3 changed nothing an operator had already accepted');
});

/* ============ C: a hand-typed row must never lock ====================== */
say('');
say('=== C. the operator building rows by hand, with nothing saved ==========');
guard('C: a typed bottom row stays editable', () => {
  const rows = importedInto2099(NEW);
  /* + Add Row appends this, then the operator types a name and Add Row again,
   * which re-renders the grid */
  const withNew = rows.concat([['Brand New Program', null, null, null]]);
  const r = renderWith(NEW, 'A5', '2099', schema99, withNew, []);
  const last = withNew.length - 1;
  ok(hasInput(r.row(last)) && hasDel(r.row(last)),
     'C1 a typed row at the bottom keeps its input and its x, because nothing ' +
     'follows it -- a group header always has a row beneath it');
  ok(!/ingest-row-subheader/.test(r.row(last)),
     'C2 and is not given the header band');

  /* the empty row Add Row really creates */
  const withEmpty = rows.concat([['', null, null, null]]);
  const r2 = renderWith(NEW, 'A5', '2099', schema99, withEmpty, []);
  ok(hasInput(r2.row(withEmpty.length - 1)),
     'C3 and so does the blank row Add Row actually creates');

  /* a whole table built by hand: labels typed, no values yet, nothing saved */
  const byHand = [['Group A', null, null, null], ['Thing One', null, null, null]];
  const r3 = renderWith(NEW, 'A5', '2099', schema99, byHand, []);
  ok(hasInput(r3.row(0)) && hasInput(r3.row(1)),
     'C4 a hand-built table with no values anywhere locks nothing: the ' +
     'fallback needs a value-bearing or total-labelled row beneath a header');

  /* KNOWN LIMIT, asserted rather than hoped: once a row beneath it holds a
   * value, the row above does read as a header. */
  const byHand2 = [['Group A', null, null, null], ['Thing One', 5, 2, null]];
  const r4 = renderWith(NEW, 'A5', '2099', schema99, byHand2, []);
  ok(!hasInput(r4.row(0)),
     'C5 KNOWN LIMIT recorded: give the row beneath a value and the row above ' +
     'locks as a header, which is correct for an import and a trap for a ' +
     'hand-built table');

  /* THE SCAN MUST STOP AT THE NEXT HEADER. Group A holds nothing; group B
   * holds a value. A scan that ran past the next header would find B's value
   * and lock A's caption, which is a row the operator may still be filling. */
  const twoGroups = [
    ['Group A', null, null, null],
    ['Thing One', null, null, null],
    ['Group B', null, null, null],
    ['Thing Two', 7, 3, null]];
  const r5 = renderWith(NEW, 'A5', '2099', schema99, twoGroups, []);
  ok(hasInput(r5.row(0)),
     'C6 a group with nothing under it does NOT lock, even when a LATER group ' +
     'has values: the follow-scan stops at the next header');
  ok(!hasInput(r5.row(2)),
     'C7 while the group that does have a value under it locks');

  /* KNOWN LIMIT, asserted so it is on the record rather than discovered later:
   * a draft where NOTHING holds a value locks nothing, because every row is
   * then shaped like a header and the scan cannot advance past the first one.
   * There is nothing to protect in that state -- no figures have landed -- and
   * one value in a group locks its caption. I first wrote an "or a
   * total-labelled row" alternative to cover this; it changed no outcome
   * anywhere, so it was deleted rather than kept as a branch that cannot
   * fire. */
  const blankImport = stored25.map(r => [r[0], null, null, null]);
  const r6 = renderWith(NEW, 'A5', '2099', schema99, blankImport, []);
  const openB = HDR.filter(i => hasInput(r6.row(i)));
  ok(openB.length === 9,
     'C8 KNOWN LIMIT: a template imported with NO values typed locks nothing, ' +
     'and all nine headers stay open: ' + openB.length);
  const oneValue = blankImport.map(r => r.slice());
  oneValue[1][1] = 5;
  const r7 = renderWith(NEW, 'A5', '2099', schema99, oneValue, []);
  ok(!hasInput(r7.row(0)) && hasInput(r7.row(3)),
     'C9 and one value in the first group locks THAT caption and no other, ' +
     'which is what the limit resolves into as soon as figures arrive');
});

/* ============ D: fix 2, a mis-flagged data row stays correctable ======== */
say('');
say('=== D. the sparse draft: a wrong inference must stay fixable ===========');
function sparseDraft(nPer, val) {
  const rows = stored25.map(r => [r[0], null, null, null]);
  const starts = stored25.map((r, i) => i).filter(i => hdrLike(stored25[i]));
  starts.forEach((s, k) => {
    const end = (k + 1 < starts.length ? starts[k + 1] : rows.length) - 1;
    let put = 0;
    for (let i = s + 1; i <= end && put < nPer; i++) {
      if (totalish(stored25[i][0])) continue;
      rows[i][1] = val; rows[i][2] = Math.round(val / 3); put++;
    }
  });
  return rows;
}
guard('D: fix 2 removes round 2s contribution and nothing else', () => {
  const mk = (api) => {
    const rows = sparseDraft(2, 999);
    api.recomputeTotals(rows, schema99, 'A5', []);
    const f = api.totalRowFlags(rows, 'A5', schema99);
    const r = renderWith(api, 'A5', '2099', schema99, rows, []);
    const misflagged = rows.map((x, i) => i)
      .filter(i => f[i] && !totalish(rows[i][0]) && !hdrLike(stored25[i]));
    return { rows: rows, f: f, r: r,
      misflagged: misflagged,
      frozen: misflagged.filter(i => !hasInput(r.row(i)) || !hasDel(r.row(i))) };
  };
  const now = mk(NEW), before = mk(OLD);
  ok(now.misflagged.length === before.misflagged.length && now.misflagged.length === 6,
     'D1 the same six data rows are mis-flagged on both builds: ' +
     now.misflagged.length + ' vs ' + before.misflagged.length +
     '  -- the inference is NOT what round 3 touched');
  ok(before.frozen.length === 2,
     'D2 on BASE two of them were FROZEN, label and delete gone: ' +
     JSON.stringify(before.frozen));
  ok(now.frozen.length === 0,
     'D3 and now none is: a wrong computed number stays correctable' +
     (now.frozen.length ? ': ' + JSON.stringify(now.frozen) : ''));
  const bs = now.rows.map((x, i) => i).filter(i => String(now.rows[i][0]) === 'Building Shell');
  const bsFlagged = bs.filter(i => now.f[i]);
  ok(bsFlagged.length >= 1 && bsFlagged.every(i => hasInput(now.r.row(i)) && hasDel(now.r.row(i))),
     'D4 "Building Shell", the row Emely named, is still flagged by the ' +
     'inference and still carries its input and its x');

  /* A REAL total, whose label says so, stays locked -- ASSERTED AGAINST THE
   * FLAGS THE RENDER ITSELF USED.
   *
   * My first version compared against flags computed BEFORE the render and
   * failed on three rows. The code was right and the oracle was wrong: the
   * render calls recomputeTotals on the draft as its first action, so it
   * computes its own flags on a draft that has already moved. That is finding
   * E below, and it is pre-existing. The claim worth making here is about the
   * flags that actually drove the markup. */
  const renderFlags = NEW.totalRowFlags(NEW.STATE.ingest.draft, 'A5', schema99);
  const realT = NEW.STATE.ingest.draft.map((x, i) => i)
    .filter(i => renderFlags[i] && totalish(NEW.STATE.ingest.draft[i][0]));
  const realOpen = realT.filter(i => hasInput(now.r.row(i)));
  ok(realT.length > 0 && realOpen.length === 0,
     'D5 every row the RENDER flagged, whose label says total, is locked: ' +
     realT.length + ' flagged, ' + realOpen.length + ' open');
});

/* ============ E: a finding this round did not cause ===================== */
say('');
say('=== E. disclosed, not fixed: the render defeats its own bootstrap =====');
guard('E: the leading recomputeTotals unflags a value-less total', () => {
  /* renderIngestEditor calls recomputeTotals(i.draft, ...) as its FIRST action,
   * before computing editorTotalFlags. On a sparse draft that write puts a
   * DERIVED value into a value-less total row, so by the time the flags are
   * computed the row is no longer value-less, the round-1 bootstrap cannot
   * reach it, and arithmetic cannot confirm it either. The row then renders as
   * an ordinary editable row.
   *
   * PRE-EXISTING: identical on BASE, asserted below. It does not bite the
   * operator's real flow, where recomputeTotals fills the sums first and the
   * totals then hold real numbers. It is adjacent to the sparse-draft
   * mis-inference Emely already routed to its own ticket, and it is
   * derive-engine ordering, so it goes with it rather than being fixed here. */
  const rows = sparseDraft(2, 999);
  NEW.recomputeTotals(rows, schema99, 'A5', []);
  const beforeFlags = NEW.totalRowFlags(rows, 'A5', schema99).filter(Boolean).length;
  renderWith(NEW, 'A5', '2099', schema99, rows, []);
  ok(beforeFlags === 12, 'E1 twelve rows are flagged before a render: ' + beforeFlags);
  const drift = NEW.STATE.ingest.draft.map((r, i) => i)
    .filter(i => hdrLike(rows[i]) !== hdrLike(NEW.STATE.ingest.draft[i]));
  ok(drift.length > 0,
     'E2 the render MUTATES its own draft: ' + drift.length +
     ' rows change shape, because recomputeTotals runs before the flags');
  const afterFlags = NEW.totalRowFlags(NEW.STATE.ingest.draft, 'A5', schema99)
    .filter(Boolean).length;
  ok(afterFlags < beforeFlags,
     'E3 so the flag count DROPS across one render: ' + beforeFlags +
     ' -> ' + afterFlags);
  /* and BASE does the same, which is what makes it not this round's */
  const rowsB = sparseDraft(2, 999);
  OLD.recomputeTotals(rowsB, schema99, 'A5', []);
  const bBefore = OLD.totalRowFlags(rowsB, 'A5', schema99).filter(Boolean).length;
  renderWith(OLD, 'A5', '2099', schema99, rowsB, []);
  const bAfter = OLD.totalRowFlags(OLD.STATE.ingest.draft, 'A5', schema99)
    .filter(Boolean).length;
  ok(bBefore === beforeFlags && bAfter === afterFlags,
     'E4 BASE behaves identically (' + bBefore + ' -> ' + bAfter +
     '), so this is disclosed and not introduced');
});

/* ============ F: nothing else moved ==================================== */
say('');
say('=== F. everything outside the family, and the round trip =============');
guard('F: flat tables render byte-identically to BASE', () => {
  const fam = { A5: 1, A6: 1, A7: 1, A8: 1 };
  let checked = 0, diff = [];
  Object.keys(P.tables).sort().forEach(id => {
    if (fam[id]) return;
    const years = Object.keys(P.tables[id].data || {})
      .filter(y => (P.tables[id].data[y] || []).length);
    if (!years.length) return;
    const y = years[years.length - 1];
    const schema = (P.tables[id].schema_by_year || {})[y] || [];
    const rows = P.tables[id].data[y];
    let a, b;
    try {
      a = renderWith(NEW, id, y, schema, rows, rows).html;
      b = renderWith(OLD, id, y, schema, rows, rows).html;
    } catch (e) { diff.push(id + ':' + y + ' threw: ' + e.message); return; }
    checked++;
    if (a !== b) diff.push(id + ':' + y);
    /* and with an EMPTY baseline too, since that is what round 3 changed */
    let a2, b2;
    try {
      a2 = renderWith(NEW, id, y, schema, rows, []).html;
      b2 = renderWith(OLD, id, y, schema, rows, []).html;
    } catch (e) { diff.push(id + ':' + y + ' (empty baseline) threw'); return; }
    if (a2 !== b2) diff.push(id + ':' + y + ' (empty baseline)');
  });
  ok(checked >= 40, 'F1 rendered ' + checked + ' tables outside the family, in both states');
  ok(diff.length === 0,
     'F2 every one is byte-identical to BASE' +
     (diff.length ? ': ' + diff.slice(0, 5).join(', ') : ''));
});

guard('F: A1s flat Total row is still editable and deletable', () => {
  const rows = P.tables.A1.data['2025'];
  const schema = P.tables.A1.schema_by_year['2025'];
  const r = renderWith(NEW, 'A1', '2025', schema, rows, rows);
  const t = rows.map((x, i) => i).filter(i => /^total$/i.test(String(rows[i][0]).trim()));
  ok(t.length >= 1, 'F3 A1:2025 has a Total row: ' + t.join(','));
  ok(t.every(i => hasInput(r.row(i)) && hasDel(r.row(i))),
     'F4 and it keeps its input and its x: CLCPA-205 item 2 stays pending');
});

guard('F: the round trip and the re-import are still green', () => {
  const rows = importedInto2099(NEW);
  ok(rows.length === 50, 'F5 A5s own template still lands 50 rows in a fresh year: ' + rows.length);
  const totIdx = stored25.map((r, i) => i).filter(i => totalish(stored25[i][0]));
  ok(totIdx.filter(i => hasNumV(rows[i])).length === totIdx.length,
     'F6 and all ' + totIdx.length + ' totals still compute');
  const gotHdr = rows.map((r, i) => i).filter(i => hdrLike(rows[i]));
  ok(JSON.stringify(gotHdr) === JSON.stringify(HDR),
     'F7 the headers still land at the same indices, so (no value) is still ' +
     'import-equivalent to blank');
  /* re-import into the populated year */
  const s25 = P.tables.A5.schema_by_year['2025'];
  const comp = NEW.ingestComputed(stored25, 'A5', s25);
  const file = [s25.slice()];
  stored25.forEach((row, idx) => {
    const out = [String(row[0])];
    for (let c = 1; c < s25.length; c++) {
      if (hdrLike(row)) out.push('(no value)');
      else if (comp.any(idx, c)) out.push('(calculated)');
      else out.push(row[c] == null || row[c] === '' ? null : row[c]);
    }
    file.push(out);
  });
  const re = NEW.buildIngestImport(file, s25, stored25.map(r => r.slice()), 'A5');
  ok(re.rejections.length === 0 && (re.candidate || []).length === 50 &&
     (re.addedRows || []).length === 0,
     'F8 and a re-import still MATCHES: ' + (re.candidate || []).length +
     ' rows, ' + (re.addedRows || []).length + ' created');
});

/* ============ S: the shape of the change =============================== */
say('');
say('=== S. structure ======================================================');
guard('S: the fallback and the shared predicate', () => {
  const code = codeOnly(SRC);
  const ed = codeOnly(grab('renderIngestEditor', SRC) || '');
  ok(/function isHierarchicalTotalLabel\(/.test(code),
     'S1 the "label says total" rule is one named function');
  /* My first version asserted the regex appears once in the whole file. It
   * appears three times, and the other two are unrelated chart-label filters
   * that predate all of this. The real claim is that the two consumers of the
   * HIERARCHICAL rule hold no copy of it. */
  ok(!/\/total\/i/.test(codeOnly(grab('totalRowFlags', SRC) || '')),
     'S2 totalRowFlags keeps no copy of the regex');
  ok(!/\/total\/i/.test(ed),
     'S2b and neither does renderIngestEditor');
  ok((code.split('function isHierarchicalTotalLabel(').length - 1) === 1,
     'S2c the rule has exactly one definition: ' +
     (code.split('function isHierarchicalTotalLabel(').length - 1));
  ok(/isHierarchicalTotalLabel\(/.test(codeOnly(grab('totalRowFlags', SRC) || '')),
     'S3 totalRowFlags reads it');
  ok(/isHierarchicalTotalLabel\(row\[0\]\)/.test(ed),
     'S4 and so does the editor label lock, rather than keeping its own copy');
  ok(/if \(base\.length\) \{/.test(ed),
     'S5 the header set uses the baseline WHEN IT HAS ROWS');
  ok(/const rows = i\.draft \|\| \[\];/.test(ed),
     'S6 and falls back to the draft when it does not');
  ok(/if \(rowHasNumber\(rows\[k\]\)\) \{ out\[normIngestKey\(r\[0\]\)\] = true; return; \}/.test(ed),
     'S7 with a header required to be FOLLOWED by a value-bearing row, which ' +
     'is what keeps a just-typed row free');
  const css = fs.readFileSync(path.join(REPO,
    'Coned/CLCPA/ExecutiveDashboard_dev/styles.css'), 'utf8');
  const baseCss = execSync('git show ' + BASE +
    ':"Coned/CLCPA/ExecutiveDashboard_dev/styles.css"',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
  ok(css === baseCss, 'S8 styles.css is byte-identical to BASE: still no CSS');
  const declared = (fs.readFileSync(__filename, 'utf8')
    .match(/DAC_BASE_COMMIT \|\| '([^']*)'/) || [])[1];
  ok(/^[0-9a-f]{7,40}$/.test(String(declared)),
     'S9 the baseline is a literal commit sha: ' + JSON.stringify(declared));
});

/* ---------- report ------------------------------------------------------ */
console.log('======================================================================');
console.log('CLCPA-240 first half, ROUND 3 -- the lock on the screen it is for');
console.log('  app.js : ' + APP);
console.log('  BASE   : ' + BASE + '  (the round-2 build that failed the pass)');
console.log('======================================================================');
lines.forEach(l => console.log(l));
console.log('');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
try {
  fs.writeFileSync(OUT, [
    '======================================================================',
    'CLCPA-240 first half, ROUND 3 -- the lock on the screen it is for',
    '  BASE   : ' + BASE + '  (the round-2 build that failed the pass)',
    '======================================================================',
  ].concat(lines).concat(['', '  ' + pass + ' passed, ' + fail + ' failed']).join('\n') + '\n');
} catch (e) { /* stdout is the record */ }
process.exitCode = fail ? 1 : 0;
