/* CLCPA-252 ROUND 3: NO CAPTION CARRIES A YEAR. Any table, any year, any
 * surface.
 *
 * This SUPERSEDES round 2's ruling entirely. Round 2 made a fresh year's
 * caption carry its year the way a stored one does; round 3 says the year does
 * not belong in a caption at all. Today 2023, 2098 and 2099 render "Table C1.
 * 2099 Summary of ..." and that is the FAIL.
 *
 * WHAT THIS SUITE HAS TO PROVE:
 *   1. NO caption carries a year -- every table, every stored year, every
 *      fresh year, on every surface.
 *   2. STORED DATA IS UNTOUCHED. The strip is render-side; the payload keeps
 *      its 67 year tokens exactly where they are.
 *   3. THE STRIP IS SAFE. Every four-digit run in every stored title, every
 *      short_title and SHORT_TITLES is a standalone 19xx/20xx token -- and the
 *      strip is proven unable to touch a table id, a measure code, or a run of
 *      three or five digits.
 *   4. NOTHING IS HARDCODED: no year list, no table-id list, no per-table
 *      caption. Driven on synthetic years and synthetic tables the payload has
 *      never seen.
 *   5. Round-2 behaviour survives: no caption cites a PDF page, and D2 still
 *      falls back to short_title.
 *   6. The captions READ correctly -- no dangling preposition, no empty
 *      parentheses, no doubled space.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-252-r3-evidence/suite-252-r3-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || '2724b8d';
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
  const want = ['tableCaption', 'renderSourceTables'];
  want.forEach(add);
  const OPTIONAL = ['stripCaptionYear', 'deriveTableCaptionInfo', 'deriveTableCaption'];
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
const tbl = (id) => Object.assign({}, P.tables[id], { id: id });
const cap = (id, y) => NEW.attempt(api => api.tableCaption(tbl(id), y));
/* THE PERMISSIVE FORM, and this is the suite's OWN defect corrected. It read
 * /\b(19|20)\d{2}\b/ and so could not see the two stored titles that glue the
 * year to the next word -- "Table A1. 2023Incentive" and "Table D4. 2023For".
 * The shipped strip had the identical blind spot, which is exactly how a
 * harness signs off a build broken in the one place the harness cannot look.
 * Digit boundaries, never word boundaries, on both sides of this ticket. */
const YEAR = /(?:^|[^\d])(?:19|20)\d{2}(?:[^\d]|$)/;
/* the tail strip both caption surfaces already apply at their call site */
const asShown = (s) => String(s).split('|')[0].trim();

say('======================================================================');
say('CLCPA-252 round 3 -- no caption carries a year, on any surface');
say('  BASE ' + BASE);
say('======================================================================');

/* =============== A: THE RULING, over everything ===================== */
say('');
say('=== A. every table, every year: no caption carries a year ===========');
guard('A: all 52 tables across stored and fresh years', () => {
  const YEARS = ['2023', '2024', '2025', '2098', '2099'];
  let n = 0; const bad = [];
  Object.keys(P.tables).sort().forEach(id => YEARS.forEach(y => {
    n++;
    const c = cap(id, y);
    if (YEAR.test(c)) bad.push(id + ':' + y + ' ' + JSON.stringify(c));
  }));
  ok(n === 260, 'A1 ' + n + ' captions rendered (52 tables x 5 years)');
  ok(bad.length === 0, 'A2 NOT ONE carries a year' +
     (bad.length ? ': ' + bad.slice(0, 4).join(' | ') : ''));
  /* and BASE did, which is the defect */
  const was = OLD.attempt(api => api.tableCaption(tbl('C1'), '2099'));
  ok(YEAR.test(was), 'A3 at BASE C1:2099 read ' + JSON.stringify(was));
  ok(cap('C1', '2099') === 'Table C1. Summary of Con Edison Demand Response Programs',
     'A4 and it now reads ' + JSON.stringify(cap('C1', '2099')));
  /* the same caption for every year is the point of the ruling */
  /* AS SHOWN: the stored 2024 title keeps its "| Main | PDF page 20" tail in
   * tableCaption's return and both surfaces strip it at the call site, so a
   * raw comparison here would differ on the tail rather than on the caption. */
  const all = YEARS.map(y => asShown(cap('C1', y)));
  ok(new Set(all).size === 1,
     'A5 C1 renders the SAME caption on all five years: ' + JSON.stringify(all[0]));
});

/* =============== S: the surfaces ==================================== */
say('');
say('=== S. every caption surface, driven ===============================');
guard('S: the section page, single-year AND compare panels', () => {
  const h3 = (h) => { const m = /<h3>([^<]*)<\/h3>/.exec(String(h)); return m ? m[1] : null; };
  let n = 0; const bad = [], missing = [];
  Object.keys(P.tables).sort().forEach(id => ['2023', '2025', '2099'].forEach(y => {
    [{}, { [id]: 'both' }].forEach(view => {
      const t = h3(NEW.attempt(api => api.renderSourceTables([P.tables[id]], y, view, id)));
      n++;
      if (t === null) { missing.push(id + ':' + y); return; }
      if (YEAR.test(t)) bad.push(id + ':' + y + ' ' + JSON.stringify(t));
      if (/\|/.test(t)) bad.push('TAIL ' + id + ':' + y + ' ' + JSON.stringify(t));
    });
  }));
  ok(missing.length === 0, 'S1 every render produced an <h3>: ' + (n - missing.length) + '/' + n);
  ok(n === 312, 'S2 ' + n + ' panel captions rendered (52 x 3 years x 2 panels)');
  ok(bad.length === 0, 'S3 none carries a year or a PDF tail' +
     (bad.length ? ': ' + bad.slice(0, 4).join(' | ') : ''));
  /* the compare panel is a DIFFERENT render, or S2 counted one path twice */
  const one = String(NEW.attempt(api => api.renderSourceTables([P.tables.A1], '2025', {}, 'A1')));
  const two = String(NEW.attempt(api => api.renderSourceTables([P.tables.A1], '2025', { A1: 'both' }, 'A1')));
  ok(one !== two, 'S4 and the two panels are genuinely different renders');
});

guard('S: the Report Data editor header shares the same helper', () => {
  /* the editor does not assemble here -- it needs the whole ingest closure --
   * so what is proven is that it reads the SAME function, by name, and applies
   * the same call-site tail strip. A second caption path is what this guards
   * against, and the code is the evidence for that. */
  const ed = codeOnly(SRC.slice(SRC.indexOf('\r\n  function renderIngestEditor(')));
  const body = ed.slice(0, ed.indexOf('\r\n  }'));
  ok(/const tableTitle = tableCaption\(table, i\.year\);/.test(body),
     'S5 the editor header calls tableCaption');
  ok(/const cleanTitle = tableTitle\.split\('\|'\)\[0\]\.trim\(\);/.test(body),
     'S6 and strips the PDF tail at the call site');
  ok(/<h3>\$\{escapeHtml\(cleanTitle\)\}<\/h3>/.test(SRC.slice(SRC.indexOf('\r\n  function renderIngestEditor('))),
     'S7 and renders that, and nothing else, as its heading');
  /* THE WHOLE POINT: exactly two call sites, both through tableCaption */
  /* the DECLARATION is not a call site: "function tableCaption(" matched the
   * same pattern and made two look like three. */
  const calls = (codeOnly(SRC).match(/[^a-zA-Z]tableCaption\(/g) || []).length -
    (codeOnly(SRC).match(/function tableCaption\(/g) || []).length;
  ok(calls === 2, 'S8 tableCaption has exactly TWO call sites, so the strip ' +
     'lands once and covers both surfaces: ' + calls);
});

guard('S: the surfaces CHECKED and found already clean', () => {
  /* THE ADD DATA MODAL. Its table dropdown shows the id and short_title, never
   * a stored title -- so there is no year to strip. Proven twice: the code
   * reads short_title, and no short_title anywhere contains four digits. */
  const dlg = SRC.slice(SRC.indexOf('\r\n  function openAddYearDialog('));
  const dlgBody = dlg.slice(0, dlg.indexOf('\r\n  }'));
  ok(!/tableCaption\(/.test(codeOnly(dlgBody)),
     'S9 the Add Data modal never calls tableCaption');
  ok(/escapeHtml\(t\.short_title \|\| SHORT_TITLES\[t\.id\] \|\| ''\)/.test(dlgBody),
     'S10 its dropdown shows short_title, which carries no year');
  const dirty = Object.keys(P.tables).filter(id =>
    /\d{4}/.test(String(P.tables[id].short_title == null ? '' : P.tables[id].short_title)));
  ok(dirty.length === 0, 'S11 and no short_title in the payload contains four digits: ' +
     (dirty.join(', ') || 'none'));
  const stBlock = SRC.slice(SRC.indexOf('\r\n  const SHORT_TITLES = {'));
  const st = stBlock.slice(0, stBlock.indexOf('\r\n  };'));
  ok(!/\d{4}/.test(st), 'S12 nor does the SHORT_TITLES map');
  /* THE XLSX TEMPLATE. Its sheet label is the code plus short_title, and its
   * Instructions sheet deliberately states "reporting year N" -- that is a
   * document telling an operator which year the workbook is for, not a table
   * caption, and the ruling is about captions. Left alone, recorded here. */
  ok(/const label = code \+ ' ' \+ \(table\.short_title \|\| SHORT_TITLES\[tableId\] \|\| ''\);/.test(SRC),
     'S13 the xlsx sheet label is code + short_title, so it carries no year either');
  ok(/sheetLabel \+ ' \\u00b7 reporting year ' \+ year/.test(SRC),
     'S14 the xlsx Instructions sheet DOES say "reporting year N", deliberately: ' +
     'it is a document subtitle, not a table caption, and is left as it is');
});

/* =============== D: stored data is untouched ======================== */
say('');
say('=== D. render-side only: the payload keeps its years ===============');
guard('D: nothing is written back', () => {
  let tokens = 0, titles = 0;
  Object.keys(P.tables).forEach(id => {
    const by = P.tables[id].title_by_year || {};
    Object.keys(by).forEach(y => {
      titles++;
      /* the permissive count again: two of the 67 are glued to the next word,
       * and a word-boundary count reports 65 and calls it complete. */
      tokens += (String(by[y]).match(/(\d?)(?:19|20)\d{2}(\d?)/g) || [])
        .filter(t => !/\d{5,}/.test(t)).length;
    });
  });
  ok(titles === 153, 'D1 153 stored titles in the payload');
  ok(tokens === 67, 'D2 carrying 67 year tokens between them, unchanged: ' + tokens);
  /* rendering must not mutate the table object it was handed */
  const before = JSON.stringify(P.tables.C1.title_by_year);
  cap('C1', '2025'); cap('C1', '2099');
  ok(JSON.stringify(P.tables.C1.title_by_year) === before,
     'D3 and rendering a caption does not touch title_by_year');
});

/* =============== N: the strip is SAFE =============================== */
say('');
say('=== N. the strip cannot reach anything that is not a year ==========');
guard('N: the constraint-4 classification, re-measured here', () => {
  const runs = [];
  Object.keys(P.tables).forEach(id => {
    const by = P.tables[id].title_by_year || {};
    Object.keys(by).forEach(y => {
      const t = String(by[y]);
      let m; const re = /\d{4}/g;
      while ((m = re.exec(t)) !== null) {
        runs.push({ id, y, val: m[0],
          standalone: !/\d/.test(t[m.index - 1] || '') && !/\d/.test(t[m.index + 4] || ''),
          plausible: /^(19|20)/.test(m[0]) });
      }
    });
  });
  const odd = runs.filter(r => !(r.standalone && r.plausible));
  ok(runs.length === 67, 'N1 67 four-digit runs across the stored titles');
  ok(odd.length === 0, 'N2 every one is a STANDALONE 19xx/20xx token' +
     (odd.length ? ': ' + odd.slice(0, 3).map(r => r.id + ':' + r.y + ' ' + r.val).join(', ') : ''));
  /* the HALT condition, stated as an assertion: if this ever goes red the
   * ticket's own rule says stop and report, not guess */
  const five = [];
  Object.keys(P.tables).forEach(id => {
    const by = P.tables[id].title_by_year || {};
    Object.keys(by).forEach(y => {
      (String(by[y]).match(/\d{5,}/g) || []).forEach(v => five.push(id + ':' + y + ' ' + v));
    });
  });
  ok(five.length === 0, 'N3 and no run of five or more digits exists to be mangled');
});

guard('N: driven on shapes the strip must NOT touch', () => {
  const s = (x) => NEW.attempt(api => api.stripCaptionYear(x));
  const KEEP = [
    ['Table A10. Installations', 'a two-digit table id'],
    ['Table G10. Emissions Reductions (metric tons CH4)', 'a chemical formula'],
    ['Table J3. Accounts 60 to 90 Days Overdue', 'two-digit figures'],
    ['Table X1. Measure 12345 Detail', 'a FIVE-digit code'],
    ['Table X2. Circuit 4160 Volts', 'a four-digit number that is not 19xx/20xx'],
    ['Table X3. Form 1099 Filings', 'a four-digit form number outside the year range'],
    ['Table X4. 123 Main Street', 'a three-digit number'],
    /* THE DIGIT GUARD, made observable. A year-shaped run sitting INSIDE a
     * longer number is the only case the (before || after) guard exists for,
     * and without one of these the guard can be deleted with no assertion
     * noticing -- which a mutation proved by staying green. */
    ['Table X6. Meter 12025 Reading', 'a year-shaped run inside a longer number'],
    ['Table X7. Serial 20255 Batch', 'and one with the extra digit trailing'],
  ];
  KEEP.forEach(([t, why]) => ok(s(t) === t,
    'N4 untouched: ' + JSON.stringify(t) + '  (' + why + ')'));
  /* and the ones it MUST touch */
  const STRIP = [
    ['Table C1. 2099 Summary of Programs', 'Table C1. Summary of Programs'],
    ['Table B1. Funding Spent in 2025', 'Table B1. Funding Spent'],
    ['Table B2. Program In 2023', 'Table B2. Program'],
    ['Table F2. Outages, Network and Non-Network (2025)', 'Table F2. Outages, Network and Non-Network'],
    ['Chart F3. Customer Interruption Rate 2025', 'Chart F3. Customer Interruption Rate'],
    ['Table F3. 2023 Customer Interruption Rate 2023', 'Table F3. Customer Interruption Rate'],
    ['Table X5. Totals for 2099', 'Table X5. Totals'],
  ];
  STRIP.forEach(([t, want]) => ok(s(t) === want,
    'N5 ' + JSON.stringify(t) + ' -> ' + JSON.stringify(s(t))));
  /* "in DACs" is not a year phrase and must survive */
  ok(s('Table A1. Incentive Dollars Spent (Total and in DACs)') ===
     'Table A1. Incentive Dollars Spent (Total and in DACs)',
     'N6 "in DACs" survives: the preposition rule needs the YEAR right after it');
});

/* =============== H: nothing is hardcoded ============================ */
say('');
say('=== H. no year list, no table-id list, no per-table caption =========');
guard('H: the strip is generic, proven on data the payload has never seen', () => {
  const code = codeOnly(SRC.slice(SRC.indexOf('\r\n  function stripCaptionYear(')));
  const body = code.slice(0, code.indexOf('\r\n  }'));
  /* no literal year, no table id, in the function itself */
  ok(!/['"]20\d{2}['"]/.test(body), 'H1 the strip contains no literal year string');
  ok(!/\b(?:A|B|C|D|E|F|G|H|I|J)\d+\b/.test(body.replace(/19\|20/g, '')),
     'H2 and no table id');
  ok(/\(\?:19\|20\)\\d\{2\}/.test(body), 'H3 the year is a PATTERN, not a list');
  /* driven on a synthetic table and a synthetic far-future year */
  const synth = { id: 'Z9', short_title: 'Synthetic',
    title_by_year: { '2031': 'Table Z9. 2031 Something Measured' } };
  const c = NEW.attempt(api => api.tableCaption(synth, '2044'));
  ok(c === 'Table Z9. Something Measured',
     'H4 a table and years the payload has never seen: ' + JSON.stringify(c));
  const s = (x) => NEW.attempt(api => api.stripCaptionYear(x));
  ok(s('Table Z9. 1987 Legacy Baseline') === 'Table Z9. Legacy Baseline',
     'H5 and a 19xx year strips the same way');
});

/* =============== R: round-2 behaviour survives ====================== */
say('');
say('=== R. round 2s two guarantees still hold =========================');
guard('R: no caption cites a PDF page, and D2 still falls back', () => {
  let n = 0; const tails = [];
  Object.keys(P.tables).sort().forEach(id => ['2025', '2099'].forEach(y => {
    n++;
    const c = asShown(cap(id, y));
    if (/PDF page/i.test(c) || /\|/.test(c)) tails.push(id + ':' + y + ' ' + JSON.stringify(c));
  }));
  ok(tails.length === 0, 'R1 no caption as SHOWN cites a PDF page: ' + n + ' checked');
  /* the derivation strips the tail itself, for a fresh year */
  const derived = NEW.attempt(api => api.deriveTableCaptionInfo(tbl('J8'), '2099'));
  ok(derived && !/\|/.test(derived.text),
     'R2 and the derivation strips it too: ' + JSON.stringify(derived && derived.text));
  /* D2: the one table whose donor fails the prefix test, so it falls to C */
  const d2 = NEW.attempt(api => api.deriveTableCaptionInfo(tbl('D2'), '2099'));
  ok(d2 === null, 'R3 D2 derives NOTHING, so it falls back to short_title');
  ok(cap('D2', '2099') === 'Table D2. DER Projects',
     'R4 and renders its short title: ' + JSON.stringify(cap('D2', '2099')));
  /* the reach is unchanged from round 2: 13 A, 38 B, 1 C */
  const tally = { A: 0, B: 0, C: 0 };
  Object.keys(P.tables).forEach(id => {
    const info = NEW.attempt(api => api.deriveTableCaptionInfo(tbl(id), '2099'));
    tally[info ? info.strategy : 'C']++;
  });
  ok(tally.A === 13 && tally.B === 38 && tally.C === 1,
     'R5 the derivation reach is unchanged from round 2: A=' + tally.A +
     ' B=' + tally.B + ' C=' + tally.C);
  /* and neither strategy inserts a year any more */
  const aInfo = NEW.attempt(api => api.deriveTableCaptionInfo(tbl('A1'), '2099'));
  ok(aInfo && !/2099/.test(aInfo.text),
     'R6 strategy A no longer substitutes the requested year: ' + JSON.stringify(aInfo.text));
  const bInfo = NEW.attempt(api => api.deriveTableCaptionInfo(tbl('C1'), '2099'));
  ok(bInfo && !/2099/.test(bInfo.text),
     'R7 and strategy B no longer inserts it: ' + JSON.stringify(bInfo.text));
});

/* =============== L: the captions READ correctly ===================== */
say('');
say('=== L. no dangling preposition, no empty parentheses ==============');
guard('L: every rendered caption is well formed', () => {
  const bad = [];
  Object.keys(P.tables).sort().forEach(id => ['2023', '2025', '2099'].forEach(y => {
    const c = asShown(cap(id, y));
    if (/\(\s*\)/.test(c)) bad.push('EMPTY PARENS ' + id + ':' + y + ' ' + JSON.stringify(c));
    if (/\s(?:in|In|for|For|of|Of|during|through)\s*$/.test(c))
      bad.push('DANGLING ' + id + ':' + y + ' ' + JSON.stringify(c));
    if (/\s{2,}/.test(c)) bad.push('DOUBLE SPACE ' + id + ':' + y + ' ' + JSON.stringify(c));
    if (/[\s,;:-]$/.test(c)) bad.push('TRAILING SEP ' + id + ':' + y + ' ' + JSON.stringify(c));
    if (!c) bad.push('EMPTY ' + id + ':' + y);
  }));
  ok(bad.length === 0, 'L1 all 156 rendered captions are well formed' +
     (bad.length ? ': ' + bad.slice(0, 4).join(' | ') : ''));
  /* the four shapes a naive strip would have broken, named */
  ok(asShown(cap('B1', '2025')) === 'Table B1. Total Make-Ready Incentive Funding Spent',
     'L2 B1 loses its dangling "in": ' + JSON.stringify(asShown(cap('B1', '2025'))));
  ok(asShown(cap('B2', '2025')) === 'Table B2. Charging Plugs Completed Under the Make-Ready Program',
     'L3 B2 loses its dangling "In"');
  ok(asShown(cap('F2', '2025')) ===
     'Table F2. Excludable and Non-Excludable Outages System-Wide, Network and Non-Network',
     'L4 F2 loses its empty parentheses');
  /* F3:2023 is stored as "Table F3.", not "Chart F3." -- only its 2025 sibling
   * says Chart. Asserted against what the payload actually holds. */
  ok(asShown(cap('F3', '2023')) === 'Table F3. Customer Interruption Rate',
     'L5 F3:2023 carries its year TWICE and loses both: ' +
     JSON.stringify(asShown(cap('F3', '2023'))));
  /* THE TWO GLUED TITLES, named. A word-boundary strip leaves these two alone
   * while every other caption loses its year, which is the shape of a defect
   * that looks like success on 151 of 153 titles. */
  ok(asShown(cap('A1', '2023')) === 'Table A1. Incentive Dollars Spent (Total and in DACs)',
     'L6 A1:2023 stores "2023Incentive" with no space, and still strips: ' +
     JSON.stringify(asShown(cap('A1', '2023'))));
  ok(asShown(cap('D4', '2023')) === 'Table D4. For All Net Metering Projects',
     'L7 and D4:2023 stores "2023For": ' + JSON.stringify(asShown(cap('D4', '2023'))));
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
    stripCaptionYear: 'CLCPA-252 r3: the year strip, new',
    tableCaption: 'CLCPA-252 r3: it strips on all three paths',
    deriveTableCaptionInfo: 'CLCPA-252 r3: it stops carrying the year across',
  };
  changed.forEach(n => ok(n in EXPECT, 'the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  ok(changed.length === 3, 'X1 exactly THREE functions changed: ' + changed.length);
  /* the render paths themselves are untouched: this is a caption change */
  ['renderSourceTables', 'renderIngestEditor', 'renderTable', 'getTableSchema',
   'rowsForDisplay'].forEach(n => {
    ok(grabFn(n, SRC) === grabFn(n, BASE_SRC), 'X2 ' + n + ' is byte-identical to BASE');
  });
  const st = (s) => { const i = s.indexOf('\r\n  const SHORT_TITLES = {');
    return i < 0 ? null : s.slice(i, s.indexOf('\r\n  };', i)); };
  ok(st(SRC) !== null && st(SRC) === st(BASE_SRC), 'X3 SHORT_TITLES is byte-identical');
  /* styles.css is NOT this ticket's */
  const css = fs.readFileSync(path.join(REPO,
    'Coned/CLCPA/ExecutiveDashboard_dev/styles.css'), 'utf8');
  const baseCss = execSync('git show ' + BASE + ':"Coned/CLCPA/ExecutiveDashboard_dev/styles.css"',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
  ok(css === baseCss, 'X4 styles.css is byte-identical to BASE: this ticket is JS only');
});

guard('X: the baseline', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X5 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: REPO }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'X6 and HEAD descends from it');
  ok(SRC !== BASE_SRC, 'X7 and the two sources genuinely differ');
});

say('');
say('  ' + pass + ' passed, ' + fail + ' failed');
lines.forEach(l => console.log(l));
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
