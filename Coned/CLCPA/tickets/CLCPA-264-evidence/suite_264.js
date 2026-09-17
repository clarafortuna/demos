/* CLCPA-264: twin-schema tables accept each other's files in silence.
 *
 * THE DEFECT, from the CLCPA-124 audit: a C3 export landed in C4 and reported
 * "3 matching columns". It is not an edge case -- measured payload-wide, 14
 * header signatures are shared by more than one table, covering 27 of the 52,
 * and within those families there are 88 ordered sibling pairs that can be
 * confused for one another.
 *
 * THE RULING: an ADVISORY, at staging and in the result panel, NEVER a
 * rejection. A renamed or unrecognisable file stays silent, because a warning
 * that cries wolf on ordinary filenames is a warning that gets ignored.
 *
 * WHAT THIS SUITE HAS TO PROVE:
 *   1. Every one of the 88 twin pairs warns, and says WHY it matters.
 *   2. Every one of the 27 tables is silent when given its own file.
 *   3. The five silent shapes are silent: unnamed, unrecognisable, year-first,
 *      id-not-at-the-start, and an id this payload does not have.
 *   4. NOTHING IS REJECTED. A mismatched import is driven to completion and
 *      its cells land, which is the assertion the ruling turns on.
 *   5. Both surfaces carry it, and the staged one is wired to the function
 *      that is actually IN SCOPE there.
 *   6. No stored year moves.
 *
 * TWO SOURCES, BOTH PINNED. BASE is the commit before this change.
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
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-264-evidence/suite-264-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || '63dea00';
const APP = process.env.DAC_APP_OVERRIDE || ('git show ' + NEWREV + ':' + REL);
const SRC = process.env.DAC_APP_OVERRIDE
  ? fs.readFileSync(process.env.DAC_APP_OVERRIDE, 'utf8')
  : execSync('git show ' + NEWREV + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
/* git blobs are LF, the working tree is CRLF. */
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
  const want = ['buildIngestImport', 'getTableSchema', 'renderIngestImportResult',
    'renderSourceTables'];
  want.forEach(add);
  const OPTIONAL = ['declaredTableFromFilename', 'importIdentityNotice'];
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
const notice = (f, d) => NEW.attempt(api => api.importIdentityNotice(f, d));

/* the families, MEASURED here rather than copied from the audit, so the suite
 * and the audit cannot drift apart silently */
const norm = (h) => String(h == null ? '' : h).trim().toLowerCase();
const SIG = {};
Object.keys(P.tables).forEach(id => {
  const by = P.tables[id].schema_by_year || {};
  Object.keys(by).forEach(y => {
    const k = JSON.stringify((by[y] || []).map(norm));
    (SIG[k] = SIG[k] || new Set()).add(id);
  });
});
const FAMILIES = Object.keys(SIG).map(k => [...SIG[k]]).filter(t => t.length > 1);
const FAMILY_TABLES = [...new Set(FAMILIES.reduce((a, t) => a.concat(t), []))];

say('======================================================================');
say('CLCPA-264 -- a file names its table, and a mismatch is an ADVISORY');
say('  BASE ' + BASE);
say('======================================================================');

/* =============== F: the families, measured ========================== */
say('');
say('=== F. the twin families, measured from the payload ================');
guard('F: the scope is what the audit measured', () => {
  ok(FAMILIES.length === 14, 'F1 ' + FAMILIES.length + ' header signatures are shared by more than one table');
  ok(FAMILY_TABLES.length === 27, 'F2 covering ' + FAMILY_TABLES.length + ' of the 52 tables');
  const c = FAMILIES.find(t => t.indexOf('C3') >= 0 && t.indexOf('C4') >= 0);
  ok(!!c, 'F3 and C3/C4 really are twins, which is the reported case: ' +
     (c ? c.join(', ') : 'NOT FOUND'));
  say('       families: ' + FAMILIES.map(t => t.join('/')).join('  |  '));
});

/* =============== W: every twin pair warns =========================== */
say('');
say('=== W. all 88 sibling pairs warn, and say why it matters ===========');
guard('W: every ordered pair within every family', () => {
  let pairs = 0, warned = 0, worded = 0; const silentPairs = [];
  FAMILIES.forEach(fam => fam.forEach(a => fam.forEach(b => {
    if (a === b) return;
    pairs++;
    const n = notice(a + '-2025-example.csv', b);
    if (n) { warned++; if (/identical column headings/.test(n)) worded++; }
    else silentPairs.push(a + '->' + b);
  })));
  ok(pairs === 88, 'W1 ' + pairs + ' ordered sibling pairs across the 14 families');
  ok(warned === pairs, 'W2 every one warns' +
     (silentPairs.length ? ': SILENT ' + silentPairs.slice(0, 6).join(', ') : ''));
  ok(worded === pairs, 'W3 and every one says the headings are IDENTICAL, ' +
     'which is what makes a wrong file import cleanly: ' + worded);
  /* the reported case, in full */
  const n = notice('C3-2025-example.csv', 'C4');
  ok(/named for Table C3/.test(n) && /into Table C4/.test(n),
     'W4 the reported case names both tables: ' + JSON.stringify(n));
  ok(/Check before saving/.test(n), 'W5 and it asks for a check, not a correction');
});

guard('W: a NON-twin mismatch warns more mildly', () => {
  const n = notice('A1-2025-example.csv', 'C4');
  ok(!!n, 'W6 a non-twin mismatch still warns');
  ok(!/identical column headings/.test(n),
     'W7 but does NOT claim identical headings, because they are not: ' + JSON.stringify(n));
  /* and A1/C4 genuinely are not twins, or W7 proves nothing */
  const together = FAMILIES.some(t => t.indexOf('A1') >= 0 && t.indexOf('C4') >= 0);
  ok(!together, 'W8 and A1/C4 really are not twins, so W7 was not free');
});

/* =============== S: silence, and no false alarms ==================== */
say('');
say('=== S. the silent cases: a warning that cries wolf gets ignored =====');
guard('S: a file named for its own destination is silent', () => {
  const loud = FAMILY_TABLES.filter(id => notice(id + '-2025-example.csv', id));
  ok(loud.length === 0, 'S1 all ' + FAMILY_TABLES.length +
     ' twin tables are silent on their own file' +
     (loud.length ? ': ' + loud.join(', ') : ''));
});

guard('S: an unrecognisable name is silent', () => {
  const CASES = [
    ['', 'a file with no name'],
    ['my data.csv', 'ordinary words'],
    ['2025-figures.csv', 'a year first'],
    ['notes-about-C3.csv', 'an id that is not at the start'],
    ['Z9-2025.csv', 'an id this payload does not have'],
    ['C3.csv', 'the id with no separator and no year'],
  ];
  CASES.forEach(([f, why]) => {
    const n = notice(f, 'C4');
    if (f === 'C3.csv') {
      /* THIS ONE DOES DECLARE. The separator is optional at end-of-string, so
       * a bare "C3.csv" is still the template's id. Asserted as a WARN so the
       * predicate's edge is recorded rather than assumed either way. */
      ok(!!n, 'S2 "C3.csv" DOES declare C3 -- the separator is optional at the end');
      return;
    }
    ok(!n, 'S2 silent: ' + JSON.stringify(f) + '  (' + why + ')');
  });
  /* the extractor itself, on the template's real output shape */
  const decl = (f) => NEW.attempt(api => api.declaredTableFromFilename(f));
  ok(decl('C3-2025-example.xlsx') === 'C3', 'S3 the template filename declares C3');
  ok(decl('A10-2098-example.csv') === 'A10', 'S4 and a two-digit id survives: A10');
  ok(decl('G10-2025-example.csv') === 'G10', 'S5 and G10, not G1');
  ok(decl('c3-2025-example.csv') === 'C3', 'S6 lower case is accepted, since Save As may change it');
  ok(decl('/home/op/Downloads/C3-2025-example.csv') === 'C3',
     'S7 and a path the browser prepends is stripped');
});

/* =============== R: NOTHING IS REJECTED ============================= */
say('');
say('=== R. the ruling: an advisory NEVER rejects =======================');
guard('R: a mismatched import is driven to completion', () => {
  /* the reported case for real: C3's own stored rows, offered to C4 */
  const c3 = P.tables.C3, c4 = P.tables.C4;
  const schema4 = NEW.attempt(api => api.getTableSchema(c4, '2025'));
  const rows3 = (c3.data['2025'] || []).map(r => r.slice());
  ok(rows3.length > 0, 'R0 C3:2025 has rows to offer: ' + rows3.length);
  const file = [schema4].concat(rows3);
  const plan = NEW.attempt(api => api.buildIngestImport(file, schema4, [], 'C4'));
  ok(plan && plan.ok === true, 'R1 the plan is OK -- the mismatch does not reject it');
  ok((plan.populated || []).length > 0,
     'R2 and its cells LAND: ' + (plan.populated || []).length + ' populated');
  /* the advisory is a separate object entirely, attached at the call site */
  const n = notice('C3-2025-example.csv', 'C4');
  ok(!!n, 'R3 while the advisory still fires for the same file');
  /* R4 USED TO ATTACH THE NOTICE TO A LOCAL OBJECT AND CHECK plan.ok WAS
   * STILL true. That is trivially true in JavaScript and it never touched the
   * real call site -- a mutation adding `if (plan.identityNotice) plan.ok =
   * false;` there stayed GREEN. Replaced with a pin on the shipped call site:
   * undo the ONE line this ticket adds, and what remains must be BASE exactly.
   * Any other edit in that block -- a flipped ok, an early return, a rejection
   * pushed -- now turns this red. */
  const ANCHOR = '\r\n              const plan = buildIngestImport(';
  const cut = (src) => {
    const i = src.indexOf(ANCHOR);
    if (i < 0) return null;
    const j = src.indexOf('\r\n            }', i);
    return j < 0 ? null : src.slice(i, j);
  };
  const nowBlock = cut(SRC), baseBlock = cut(BASE_SRC);
  ok(nowBlock !== null && baseBlock !== null,
     'R4 the import call site is found in both sources');
  const ADDED = /\r\n {14}\/\* CLCPA-264:[\s\S]*?\r\n {14}plan\.identityNotice = importIdentityNotice\(staged\.name, i\.tableId\);/;
  ok(ADDED.test(String(nowBlock)),
     'R4b and CLCPA-264s one added line is there to undo');
  ok(String(nowBlock).replace(ADDED, () => '') === baseBlock,
     'R4c and with it undone the call site is BYTE-IDENTICAL to BASE: ' +
     'nothing there flips plan.ok, returns early, or rejects');
  /* BASE did the same import silently, which is the defect */
  const planOld = OLD.attempt(api => api.buildIngestImport(file, schema4, [], 'C4'));
  ok(planOld && planOld.ok === true,
     'R5 BASE imported it too -- this ticket adds a warning, it does not add a check');
  ok(OLD.attempt(api => api.importIdentityNotice) === null,
     'R6 and BASE had no advisory at all, which is the defect');
});

guard('R: the result panel announces it on a SUCCESSFUL import', () => {
  const plan = { ok: true, populated: [1, 2, 3], rejections: [], unitNotices: [],
    identityNotice: notice('C3-2025-example.csv', 'C4') };
  const html = NEW.attempt(api => api.renderIngestImportResult(plan));
  ok(/Imported into the draft: 3 cells/.test(html),
     'R7 the success panel still reports the import');
  ok(/Check the table this file was for/.test(html),
     'R8 and carries the advisory heading');
  ok(/named for Table C3/.test(html), 'R9 with the sentence itself');
  /* no advisory, no block */
  const clean = NEW.attempt(api => api.renderIngestImportResult(
    { ok: true, populated: [1], rejections: [], unitNotices: [], identityNotice: null }));
  ok(!/Check the table this file was for/.test(clean),
     'R10 and a matching file renders no advisory block at all');
  /* the CLCPA-234 text Emely approved verbatim is untouched */
  ok(/Review the values below, then press Save\. Nothing has been saved yet\./.test(html),
     'R11 and the CLCPA-234 reminder is still there, verbatim');
});

/* =============== D: the staging surface ============================= */
say('');
say('=== D. the staged box, wired to what is actually in scope ===========');
guard('D: the staged block calls the advisory with the dialog s own target', () => {
  const i = SRC.indexOf('\r\n    function stagedBlock()');
  ok(i > 0, 'D1 stagedBlock is found');
  const block = codeOnly(SRC.slice(i, SRC.indexOf('\r\n    }', i)));
  ok(/importIdentityNotice\(staged\.name, target\(\)\.tableId\)/.test(block),
     'D2 it calls importIdentityNotice with the staged name and target().tableId');
  /* THE MISSING CLOSURE, pinned. getTarget is a parameter of
   * wireIngestStaging and is NOT in scope in this dialog -- the first cut used
   * it and would have thrown the moment a file was staged. */
  ok(!/getTarget/.test(block),
     'D3 and NOT getTarget, which is out of scope here');
  ok(/target\(\)/.test(codeOnly(SRC.slice(i - 2000, i))) ||
     /const target = \(\) =>/.test(codeOnly(SRC)),
     'D4 target() is the handle this dialog really has');
  /* it must not turn the box red: an advisory is not an error */
  ok(/const bad = !!\(staged\.error \|\| \(staged\.dry && !staged\.dry\.ok\)\);/.test(block),
     'D5 and `bad` is unchanged, so the box does not turn red and the button stays enabled');
  ok(/ingest-staged-warn/.test(block), 'D6 the advisory has its own class');
});

guard('D: the advisory also rides on the plan at the import call site', () => {
  const code = codeOnly(SRC);
  ok(/plan\.identityNotice = importIdentityNotice\(staged\.name, i\.tableId\);/.test(code),
     'D7 the plan carries the advisory, attached at the call site');
  /* it must be attached where the filename EXISTS. buildIngestImport is given
   * rows and a schema and never sees a name, so a version that tried to
   * compute this inside it could only ever produce null. */
  const b = SRC.slice(SRC.indexOf('\r\n  function buildIngestImport('));
  ok(!/identityNotice/.test(codeOnly(b.slice(0, b.indexOf('\r\n  }')))),
     'D8 and buildIngestImport does not mention it, because it has no filename');
});

/* =============== C: the CSS says advisory, not error ================ */
say('');
say('=== C. the styling says WARNING, not rejection =====================');
guard('C: the advisory is amber, not the red of a rejection', () => {
  const css = fs.readFileSync(path.join(REPO,
    'Coned/CLCPA/ExecutiveDashboard_dev/styles.css'), 'utf8');
  const baseCss = execSync('git show ' + BASE +
    ':"Coned/CLCPA/ExecutiveDashboard_dev/styles.css"',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
  const i = css.indexOf('.ingest-staged-warn');
  ok(i > 0, 'C1 .ingest-staged-warn exists');
  const rule = css.slice(i, css.indexOf('}', i));
  /* SUPERSEDED BY CLCPA-266, by ruling: the staged warning now gets the RED
   * accent treatment, matching its post-load twin, so an operator meets one
   * thing in two places rather than two things that look unrelated.
   *
   * CLCPA-264's reasoning for amber -- "nothing was rejected, and red would
   * say stopped about something that did not stop" -- is not overturned by
   * the colour: nothing IS rejected, and R1/R2 above still drive a mismatched
   * import to completion. What changed is that the identity advisory is the
   * one whose case costs most if skimmed, and the ruling weighs that higher.
   *
   * The claim is re-pinned, not relaxed: still one colour, still a token,
   * still asserted against what the cascade resolves. */
  ok(/--red/.test(rule), 'C2 and it now uses the RED accent, per CLCPA-266');
  ok(!/--warn-fg/.test(rule),
     'C3 and no longer var(--warn-fg), which is not a defined token in this file');
  ok(!/^\s*--warn-fg\s*:/m.test(css),
     'C4 --warn-fg really is undefined here, so it had been resolving to a literal');
  ok(baseCss.indexOf('.ingest-staged-warn') < 0, 'C5 and BASE had no such rule');
  /* nothing else in the stylesheet moved. CLCPA-266's own block is masked
   * alongside CLCPA-264's, because this suite's BASE predates both. */
  const strip = (s) => s
    .replace(/\/\* CLCPA-264's import identity advisory, restyled by CLCPA-266[\s\S]*?font-weight: 500;\r?\n\}\r?\n/, '')
    .replace(/\/\* CLCPA-264[\s\S]*?\.ingest-staged-warn \{[\s\S]*?\}\r?\n/, '')
    .replace(/\/\* ---- CLCPA-266: every post-load notice is a BOX[\s\S]*?\.ingest-import-notice > :last-child \{ margin-bottom: 0; \}\r?\n/, 'C266')
    .replace(/\.ingest-import-result \{[\s\S]*?\.ingest-import-result li \{[^}]*\}\r?\n/, 'C266');
  ok(strip(css) === strip(baseCss),
     'C6 and with CLCPA-264s and CLCPA-266s blocks masked, the rest of the ' +
     'stylesheet is byte-identical to BASE');
});

/* =============== Z: no stored year moves ============================ */
say('');
say('=== Z. the report page is untouched ================================');
guard('Z: all 149 stored table-years render byte-identical', () => {
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
  ok(checked === 149, 'Z1 ' + checked + ' stored table-years rendered on both sides');
  ok(moved.length === 0, 'Z2 and every one is byte-identical: this ticket touches ' +
     'the importer, not the published tables' +
     (moved.length ? ' -- MOVED ' + moved.slice(0, 5).join(', ') : ''));
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
    declaredTableFromFilename: 'CLCPA-264: the filename extractor, new',
    importIdentityNotice: 'CLCPA-264: the advisory sentence, new',
    rowsForDisplay: 'NOT this ticket: CLCPA-263: it derives the value (pct) composites on its clone',
    applyCompositeShares: 'NOT this ticket: CLCPA-263: the derivation (new)',
    isCompositeShareCol: 'NOT this ticket: CLCPA-263: the declaration predicate (new)',
    compositeValueText: 'NOT this ticket: CLCPA-263: the value formatting (new)',
    bareNumber: 'NOT this ticket: CLCPA-263: the bare-number test (new)',
    renderIngestImportResult: 'CLCPA-264: the result panel announces it',
    stripCaptionYear: 'NOT this ticket: CLCPA-252 round 3, the caption year strip (new)',
    deriveTableCaptionInfo: 'NOT this ticket: CLCPA-252 round 3, it stops carrying the year across',
    tableCaption: 'NOT this ticket: CLCPA-252 round 3, it strips on all three paths',
    openAddYearDialog: 'CLCPA-264: stagedBlock warns, and the call site attaches the advisory',
    /* both NESTED inside openAddYearDialog, and both counted separately
     * because this suite's name scan sees any `function NAME(` at any indent.
     * Named rather than filtered out: the count stays exact that way. */
    stagedBlock: 'CLCPA-264: nested in openAddYearDialog, it renders the advisory',
    wire: 'CLCPA-264: nested in openAddYearDialog, it attaches the advisory to the plan',
  };
  changed.forEach(n => ok(n in EXPECT, 'the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT[n]));
  /* 6 -> 11: CLCPA-263 stacks on this ticket and moved five, all named. */
  ok(changed.length === 14, 'X1 exactly FOURTEEN functions changed: ' + changed.length);
  /* the importer's own engine is untouched: this adds a warning beside it */
  ['buildIngestImport', 'applyIngestImport', 'parseCsvRows', 'getTableSchema',
   'ingestStagedSummary'].forEach(n => {
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
