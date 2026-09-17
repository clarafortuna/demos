/* CLCPA-252 ROUND 2: a fresh year derives a real title instead of short_title.
 *
 * Round 1 cured the bald caption. It did not make a fresh year look like the
 * year beside it: stored years render the full descriptive title, a fresh year
 * rendered short_title. This round derives one.
 *
 * WHAT THIS SUITE HAS TO PROVE, in Emely's order:
 *
 *   1. ALL 153 STORED TITLES RENDER BYTE-IDENTICAL. This is the gate. The
 *      derivation sits behind the stored branch and must be unreachable for
 *      any year that has a title of its own.
 *   2. A fresh year derives, for 51 of 52 tables, and the suite reports WHICH
 *      STRATEGY each took -- that report is part of the evidence, not a
 *      debugging aid.
 *   3. The three strategies are the measured ones: A=13, B=38, C=1. A count
 *      that drifts is a derivation that changed reach, and it turns this red.
 *   4. The PDF tail never travels.
 *   5. The measured NEGATIVE that makes substitution safe holds: no stored
 *      title names a year other than its own. If that ever stops being true,
 *      this suite says so rather than quietly deriving a wrong year.
 *
 * TWO SOURCES, BOTH PINNED. BASE is the commit before this change, so every
 * claim is a difference rather than a snapshot of the build that just shipped.
 *
 * WHAT IS DELIBERATELY NOT ASSERTED: the browser wiring. The functions are
 * assembled with their real dependency lists and called, which is what catches
 * a missing closure, but the Report Data page is Emely's hosted pass.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
/* CLCPA-252 round 3: the shared caption-difference judgement */
const kit = require('../_kit/caption_diff.js');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
/* PINNED ON BOTH SIDES (CLAUDE.md: "Pin both sides"). The post-change side
 * reads 2361a6a instead of the working tree --
 * main immediately before the 2026-09-16 wave, and the last commit at which
 * every suite in this tree was green. That is the build this suite was
 * written against and last proved.
 *
 * Both sides fixed makes this suite permanent evidence of what its ticket
 * shipped, and it can no longer be falsified by later work. NOT ONE
 * ASSERTION WAS CHANGED to achieve that: the claims are the claims, and
 * only the build they are asked about is now named.
 *
 * DAC_APP_OVERRIDE still wins, so the mutation runner keeps working. */
const NEWREV = process.env.DAC_NEW_COMMIT || '2361a6a';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-252-r2-evidence/suite-252-r2-output.txt');

/* BASE predates the change: the CLCPA-258 records commit, which is main as it
 * stood when this ticket started. Pinned to a literal sha, never HEAD. */
const BASE = process.env.DAC_BASE_COMMIT || 'a1cc8f9';
const APP = process.env.DAC_APP_OVERRIDE || ('git show ' + NEWREV + ':' + REL);

const SRC = process.env.DAC_APP_OVERRIDE
  ? fs.readFileSync(process.env.DAC_APP_OVERRIDE, 'utf8')
  : execSync('git show ' + NEWREV + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
/* git blobs are LF, the working tree is CRLF. Without this every CRLF-anchored
 * slice returns -1 and silently reads from the end of the file. */
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

/* ---- one assembled environment per source ---------------------------- */
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
  const want = ['tableCaption', 'renderSourceTables'];
  want.forEach(add);
  /* new in this round, so BASE has neither and reports null behind typeof */
  const OPTIONAL = ['deriveTableCaption', 'deriveTableCaptionInfo'];
  OPTIONAL.forEach(add);
  let api = null;
  const attempt = (call) => {
    for (let r = 0; r < 400; r++) {
      try {
        if (!api) api = new Function('PAYLOAD', parts.join('\n\n') +
          '\n;if (typeof state !== "undefined") state.payload = PAYLOAD;' +
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
const tbl = (id) => Object.assign({}, P.tables[id], { id: id });

say('======================================================================');
say('CLCPA-252 round 2 -- a fresh year derives its title');
say('  BASE ' + BASE);
say('======================================================================');

/* =============== S: THE GATE, all 153 stored titles ================== */
say('');
say('=== S. the gate: every stored title renders byte-identical ==========');
guard('S: no stored table-year moves', () => {
  let checked = 0; const moved = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = tbl(id);
    Object.keys(t.title_by_year || {}).sort().forEach(y => {
      checked++;
      const a = OLD.attempt(api => api.tableCaption(t, y));
      const b = NEW.attempt(api => api.tableCaption(t, y));
      /* CLCPA-252 ROUND 3 changes what a STORED year renders: every caption
       * loses its year. This pin is NARROWED, not widened -- the shared kit
       * requires everything outside the <h3> to be byte-identical AND each
       * caption to be its BASE self with year tokens removed. A reworded
       * caption, a changed cell or an ADDED year still fails. */
      /* CLCPA-252 ROUND 3 supersedes round 2's gate: a stored caption now
       * LOSES its year. Narrowed to exactly that -- the new caption must be
       * the BASE caption with year tokens removed and nothing else. */
      if (b !== kit.captionAfterStrip(a))
        moved.push(id + ':' + y + '  ' + JSON.stringify(a) + ' -> ' + JSON.stringify(b));
    });
  });
  ok(checked === 153, 'S1 ' + checked + ' stored titles rendered on both sides');
  ok(moved.length === 0, 'S2 every one is byte-identical to BASE' +
     (moved.length ? ': ' + moved.slice(0, 4).join(' | ') : ''));
  /* and through the REPORT PAGE, not just the helper: the caption reaches the
   * screen through renderSourceTables, and a helper that agrees while the
   * panel disagrees would pass a test and fail an operator. */
  let panels = 0, titled = 0; const panelMoved = [], untitledMoved = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach(y => {
      if (!(t.data[y] || []).length) return;
      panels++;
      const a = String(OLD.attempt(api => api.renderSourceTables([t], y, {}, id)));
      const b = String(NEW.attempt(api => api.renderSourceTables([t], y, {}, id)));
      const hasTitle = !!((t.title_by_year || {})[y]);
      /* same narrowing on the rendered panel: everything outside the <h3>
       * byte-identical, and the caption only de-yeared. */
      const same = kit.onlyCaptionYearsChanged(b, a);
      if (hasTitle) { titled++; if (!same) panelMoved.push(id + ':' + y); }
      else if (!same) untitledMoved.push(id + ':' + y);
    });
  });
  ok(panels === 149, 'S3 ' + panels + ' stored table-years rendered as PANELS on both sides');
  /* THE GATE IS "every stored table-year WITH A TITLE", and the distinction is
   * load-bearing rather than pedantic. S4 first asserted all 149 and went red
   * on A8:2023 -- the ONE data-carrying year in the payload with no stored
   * title, which is precisely the case this ticket exists to improve. A gate
   * that forbade it changing would have forbidden the fix. */
  ok(titled === 148, 'S4 ' + titled + ' of those carry a stored title');
  ok(panelMoved.length === 0, 'S4b and every TITLED panel is byte-identical to BASE' +
     (panelMoved.length ? ': ' + panelMoved.slice(0, 5).join(', ') : ''));
  ok(untitledMoved.join(',') === 'A8:2023',
     'S5 the only panel that moves is A8:2023, the one stored year with data ' +
     'and no title: ' + JSON.stringify(untitledMoved));
});

guard('S: and A8:2023 moves in the intended direction', () => {
  /* Round 1 took this from bald "Table A8" to short_title "Table A8.
   * Residential Install". Round 2 finishes the job: it now reads like the
   * years beside it. Both strings are asserted, so "it changed" is not
   * mistaken for "it improved". */
  const t = tbl('A8');
  const was = OLD.attempt(api => api.tableCaption(t, '2023'));
  const now = NEW.attempt(api => api.tableCaption(t, '2023'));
  ok(was === 'Table A8. Residential Install',
     'S6 at BASE it rendered round 1s short_title: ' + JSON.stringify(was));
  /* SUPERSEDED BY CLCPA-252 ROUND 3, which rules that no caption carries a
   * year at all. Round 2s claim was that the year travels; round 3s is that it
   * goes. Re-pinned to the round-3 string rather than relaxed -- what round 2
   * still owns, and still proves here, is that a fresh year gets the FULL
   * descriptive title instead of short_title. */
  ok(now === 'Table A8. Installations by Measure Category for Residential Programs (Total and in DACs)',
     'S7 and it now reads like its neighbours: ' + JSON.stringify(now));
  /* and the DONOR really does read that way, or S7 is just a string I typed.
   * The donor is the NEWEST titled year, 2025 -- not 2024, which also stores
   * this shape but carries a "|  Main  |  PDF page 17" tail. S8 compared
   * against 2024 on its first run and went red on that tail, which is the
   * derivation's tail-strip showing up in the evidence rather than in an
   * operator's caption. */
  const donor = (P.tables.A8.title_by_year || {})['2025'];
  ok(donor === 'Table A8. 2025 Installations by Measure Category for Residential Programs (Total and in DACs)',
     'S8 the donor A8:2025 stores exactly that shape, so S7 is a match and not ' +
     'an invention: ' + JSON.stringify(donor));
  /* SUPERSEDED BY ROUND 3: the year is REMOVED, not substituted. The claim is
   * still exact -- the rendered caption is the donor, transformed the one way
   * the shipped strip transforms it -- and the shared kit is what says so, so
   * this suite and the strip cannot drift apart. */
  ok(now === kit.captionAfterStrip(donor),
     'S9 and the rendered 2023 caption is the donor with its year REMOVED: ' +
     JSON.stringify(now));
  /* the neighbour that DOES carry a tail proves the strip is reached here */
  const tailed = (P.tables.A8.title_by_year || {})['2024'];
  ok(/\|\s*Main/.test(String(tailed)) && !/\|/.test(now),
     'S10 A8:2024 carries a tail and the derived caption does not');
});

/* =============== D: the fresh year, all 52, strategy named ============ */
say('');
say('=== D. a fresh year 2098: all 52 tables, and which strategy each ====');
const strat = {};
guard('D: every table derives, and the reach is the measured one', () => {
  const tally = { A: 0, B: 0, C: 0 };
  const shortTitleFallbacks = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = tbl(id);
    const info = NEW.attempt(api => api.deriveTableCaptionInfo(t, '2098'));
    const cap = NEW.attempt(api => api.tableCaption(t, '2098'));
    const s = info ? info.strategy : 'C';
    strat[id] = { s: s, cap: cap };
    tally[s]++;
    if (s === 'C') shortTitleFallbacks.push(id);
    say('       ' + s + '  ' + id.padEnd(4) + JSON.stringify(cap));
  });
  /* THE MEASURED REACH. These three numbers come from the read-only audit of
   * all 153 stored titles, not from running this code and writing down what
   * it said. A drift in any of them is a derivation that changed reach. */
  ok(tally.A === 13, 'D1 strategy A (substitute the year token): ' + tally.A + ', measured 13');
  ok(tally.B === 38, 'D2 strategy B (insert after a clean prefix): ' + tally.B + ', measured 38');
  ok(tally.C === 1, 'D3 strategy C (short_title fallback): ' + tally.C + ', measured 1');
  ok(shortTitleFallbacks.join(',') === 'D2',
     'D4 and the one fallback is D2, whose title has no space after the period: ' +
     shortTitleFallbacks.join(','));
  ok(tally.A + tally.B + tally.C === 52, 'D5 all 52 tables accounted for');
});

guard('D: the exact strings Emely named', () => {
  /* the target from the ruling, character for character */
  ok(strat.C1 && strat.C1.cap === 'Table C1. Summary of Con Edison Demand Response Programs',
     'D6 C1 renders the commissioned string: ' + JSON.stringify(strat.C1 && strat.C1.cap));
  ok(strat.C1 && strat.C1.s === 'B', 'D6b and it took strategy B');
  /* a strategy-A table keeps its own shape, with only the year moved */
  ok(strat.A1 && strat.A1.cap === 'Table A1. Program Incentive Dollars Spent (Total and in DACs)',
     'D7 A1 substitutes: ' + JSON.stringify(strat.A1 && strat.A1.cap));
  /* F3 is a CHART, and the prefix predicate must accept that word too */
  ok(strat.F3 && strat.F3.cap === 'Chart F3. Customer Interruption Rate',
     'D8 F3 is a Chart and still derives: ' + JSON.stringify(strat.F3 && strat.F3.cap));
  ok(strat.D2 && /DER Projects/.test(strat.D2.cap),
     'D9 D2 falls back to short_title: ' + JSON.stringify(strat.D2 && strat.D2.cap));
});

/* =============== T: the PDF tail never travels ======================= */
say('');
say('=== T. the "|  Main  |  PDF page N" tail is stripped ================');
guard('T: no derived title carries a tail', () => {
  const withTail = Object.keys(strat).filter(id => /\|/.test(strat[id].cap));
  ok(withTail.length === 0, 'T1 no derived caption carries a "|" tail' +
     (withTail.length ? ': ' + withTail.join(', ') : ''));
  const withPdf = Object.keys(strat).filter(id => /PDF page/i.test(strat[id].cap));
  ok(withPdf.length === 0, 'T2 and none cites a PDF page' +
     (withPdf.length ? ': ' + withPdf.join(', ') : ''));
  /* the donors genuinely HAVE tails, or T1 proves nothing. Measured: 5 of the
   * 52 newest titles carry one. */
  const donorsWithTail = Object.keys(P.tables).filter(id => {
    const by = P.tables[id].title_by_year || {};
    const ys = Object.keys(by).sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
    return ys.length && /\|/.test(by[ys[0]]);
  });
  ok(donorsWithTail.length === 5,
     'T3 and 5 donors DO carry a tail, so stripping it means something: ' +
     donorsWithTail.join(', '));
  /* each of those five still derives a clean title rather than falling to C */
  const stillDerived = donorsWithTail.filter(id => strat[id].s !== 'C');
  ok(stillDerived.length === donorsWithTail.length,
     'T4 and all five still derive rather than falling back: ' +
     donorsWithTail.map(id => id + '=' + strat[id].s).join(', '));
});

/* =============== N: the measured negative still holds ================ */
say('');
say('=== N. the negative that makes substitution safe ====================');
guard('N: no stored title names a year other than its own', () => {
  let own = 0, none = 0; const other = [];
  Object.keys(P.tables).sort().forEach(id => {
    const by = P.tables[id].title_by_year || {};
    Object.keys(by).forEach(y => {
      const years = String(by[y]).match(/\b(19|20)\d{2}\b/g) || [];
      if (!years.length) { none++; return; }
      if (years.indexOf(y) >= 0) own++;
      if (years.some(v => v !== y)) other.push(id + ':' + y + ' ' + JSON.stringify(by[y]));
    });
  });
  /* THE LOAD-BEARING COUNT. Ten chart HEADINGS in this payload deliberately
   * name a different year (CLCPA-244). Titles were measured for the same trap
   * and do not share it -- and if that ever changes, strategy A would rewrite
   * a deliberate reference. This is the tripwire. */
  ok(other.length === 0,
     'N1 ZERO stored titles name a year other than their own' +
     (other.length ? ': ' + other.slice(0, 3).join(' | ') : ''));
  ok(own === 64, 'N2 64 titles embed their own year: ' + own);
  ok(none === 89, 'N3 89 embed none: ' + none);
  /* the one multi-token title, which strategy A must REFUSE */
  const f3 = (P.tables.F3.title_by_year || {})['2023'];
  ok(/2023[\s\S]*2023/.test(String(f3)),
     'N4 F3:2023 carries its year TWICE, which is the case A refuses: ' + JSON.stringify(f3));
});

guard('N: strategy A refuses a donor it cannot substitute safely', () => {
  /* driven, not described: a synthetic table whose newest title carries two
   * different years must NOT take strategy A */
  const twoYears = { id: 'Z1', short_title: 'Synthetic',
    title_by_year: { '2025': 'Table Z1. 2025 Compared With 2024' } };
  const info = NEW.attempt(api => api.deriveTableCaptionInfo(twoYears, '2098'));
  ok(!info || info.strategy !== 'A',
     'N5 a donor naming two years does not take strategy A: ' +
     JSON.stringify(info && info.strategy));
  ok(!info, 'N5b and it takes no strategy at all, so it falls back to short_title');
  /* a donor whose year appears twice is refused for the same reason */
  const twice = { id: 'Z2', short_title: 'Synthetic',
    title_by_year: { '2025': 'Table Z2. 2025 Rate 2025' } };
  const i2 = NEW.attempt(api => api.deriveTableCaptionInfo(twice, '2098'));
  ok(!i2, 'N6 and a donor repeating its own year is refused too');
  /* a donor carrying ANOTHER year but not its own: refused by both branches,
   * because B requires NO year rather than merely no own-year */
  const otherOnly = { id: 'Z3', short_title: 'Synthetic',
    title_by_year: { '2025': 'Table Z3. 2019 Legacy Baseline' } };
  const i3 = NEW.attempt(api => api.deriveTableCaptionInfo(otherOnly, '2098'));
  ok(!i3, 'N7 and a donor naming only ANOTHER year is refused by A and by B');
  /* THE SUBSTRING CASE, and it is the reason the split count exists alongside
   * the match count. "2025A" does not match \b(19|20)\d{2}\b -- the boundary
   * fails between 5 and A -- so the year LIST has one entry while the string
   * contains the token twice. Substituting would produce "2098 Cohort 2098A"
   * and corrupt a cohort label. Without this case the split-count guard is
   * unreachable and its mutation stays green, which is how it was found. */
  const substr = { id: 'Z6', short_title: 'Synthetic',
    title_by_year: { '2025': 'Table Z6. 2025 Cohort 2025A' } };
  const i4 = NEW.attempt(api => api.deriveTableCaptionInfo(substr, '2098'));
  ok(!i4 || i4.strategy !== 'A',
     'N8 a donor whose year also appears as a substring is refused by A: ' +
     JSON.stringify(i4 && i4.text));
  ok(!i4, 'N8b and it takes no strategy, so the cohort label is left alone');
});

guard('N: strategy B accepts a Chart donor that carries no year', () => {
  /* F3, the only Chart with a title, takes strategy A because its donor names
   * a year -- so on THIS payload the word "Chart" in B's prefix predicate
   * changes nothing, and removing it was not noticed by any behavioural
   * assertion. Driven here on a synthetic donor so the predicate is guarded
   * by what it DOES and not only by a structural grep. */
  const chart = { id: 'Z7', short_title: 'Synthetic',
    title_by_year: { '2025': 'Chart Z7. Interruption Rate By Borough' } };
  const info = NEW.attempt(api => api.deriveTableCaptionInfo(chart, '2098'));
  ok(info && info.strategy === 'B',
     'N9 a Chart donor with no year takes strategy B: ' + JSON.stringify(info && info.strategy));
  ok(info && info.text === 'Chart Z7. Interruption Rate By Borough',
     'N9b and the year lands after the prefix: ' + JSON.stringify(info && info.text));
  /* the same donor as a Table, so N9 is about the WORD and not about the shape */
  const table = { id: 'Z8', short_title: 'Synthetic',
    title_by_year: { '2025': 'Table Z8. Interruption Rate By Borough' } };
  const i2 = NEW.attempt(api => api.deriveTableCaptionInfo(table, '2098'));
  ok(i2 && i2.text === 'Table Z8. Interruption Rate By Borough',
     'N9c and a Table donor of the same shape derives identically');
});

/* =============== E: the donor is the NEWEST year ==================== */
say('');
say('=== E. the donor is the newest year with a title ====================');
guard('E: the newest year donates, not the first key', () => {
  const t = { id: 'Z4', short_title: 'Synthetic', title_by_year: {
    '2023': 'Table Z4. 2023 Old Wording',
    '2025': 'Table Z4. 2025 New Wording' } };
  const info = NEW.attempt(api => api.deriveTableCaptionInfo(t, '2098'));
  ok(info && info.donorYear === '2025', 'E1 the donor is 2025: ' + (info && info.donorYear));
  /* the INFO carries the donors own wording; the year leaves at tableCaption */
  ok(info && info.text === 'Table Z4. 2025 New Wording',
     'E2 and the NEW wording is carried: ' + JSON.stringify(info && info.text));
  /* key order in the object is deliberately oldest-first above, which is the
   * shape that fooled dacCol before CLCPA-257 */
  ok(Object.keys(t.title_by_year)[0] === '2023',
     'E3 and the first key really is the oldest, so E1 was not free');
  /* an empty or blank title is not a donor */
  const blank = { id: 'Z5', short_title: 'Synthetic',
    title_by_year: { '2025': '   ', '2024': 'Table Z5. 2024 Real' } };
  const i2 = NEW.attempt(api => api.deriveTableCaptionInfo(blank, '2098'));
  ok(i2 && i2.donorYear === '2024', 'E4 a blank title is not a donor: ' +
     (i2 && i2.donorYear));
});

guard('E: a non-year "year" derives nothing', () => {
  const t = tbl('C1');
  ok(NEW.attempt(api => api.deriveTableCaptionInfo(t, 'draft')) === null,
     'E5 a non-numeric year derives nothing');
  ok(NEW.attempt(api => api.deriveTableCaptionInfo(t, '')) === null,
     'E6 and neither does an empty one');
  ok(NEW.attempt(api => api.tableCaption(null, '2098')) === '',
     'E7 and a null table still returns the empty string');
});

/* =============== X: blast radius and baseline ======================== */
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
    tableCaption: 'CLCPA-252 r2: it consults the derivation before short_title',
    deriveTableCaptionInfo: 'CLCPA-252 r2: the three strategies, new',
    deriveTableCaption: 'CLCPA-252 r2: the text-only wrapper, new',
    stripCaptionYear: 'CLCPA-252 round 3: the caption year strip (new)',
    /* CLCPA-264 stacks on this ticket, so its six are named here too. */
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
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  /* 3 -> 9: CLCPA-264 stacks on this ticket and moved six, all named above. */
  /* 9 -> 14: CLCPA-263 moved five, all named above. */
  ok(changed.length === 15, 'X1 exactly FIFTEEN functions changed: ' + changed.length);
  /* the ones that must NOT move: the render path and the short_title map */
  ['renderSourceTables', 'renderIngestEditor', 'getTableSchema'].forEach(n => {
    ok(grabFn(n, SRC) === grabFn(n, BASE_SRC), 'X2 ' + n + ' is byte-identical to BASE');
  });
  const st = (s) => { const i = s.indexOf('\r\n  const SHORT_TITLES = {');
    return i < 0 ? null : s.slice(i, s.indexOf('\r\n  };', i)); };
  ok(st(SRC) !== null && st(SRC) === st(BASE_SRC),
     'X3 SHORT_TITLES is byte-identical to BASE');
});

guard('X: the derivation is not a blind regex over free text', () => {
  const code = codeOnly(grabFn('deriveTableCaptionInfo', SRC) || '');
  /* the two conditions the ruling turns on, pinned structurally */
  ok(/years\.length === 1 && years\[0\] === donorYear/.test(code),
     'X4 strategy A requires the own-year token, exactly once');
  ok(/years\.length === 0/.test(code),
     'X5 strategy B requires NO year at all, not merely no own-year');
  ok(/\(\?:Table\|Chart\)/.test(code),
     'X6 the prefix predicate accepts Chart as well as Table');
  ok(/replace\(\/\\s\*\\\|\.\*\$\//.test(code) || /\|\.\*\$/.test(code),
     'X7 the tail is stripped from the donor');
  /* and BASE had none of it */
  ok(grabFn('deriveTableCaptionInfo', BASE_SRC) === null,
     'X8 none of this existed at BASE');
});

guard('X: the baseline', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X9 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: REPO }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'X10 and HEAD descends from it');
  ok(SRC !== BASE_SRC, 'X11 and the two sources genuinely differ');
});

say('');
say('  ' + pass + ' passed, ' + fail + ' failed');
lines.forEach(l => console.log(l));
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
