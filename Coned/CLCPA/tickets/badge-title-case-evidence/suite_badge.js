/* THE BADGE ROUND: the status badge goes clean after a successful Save, and
 * the three ruled labels plus the Report Data stragglers are title case.
 *
 * NO TICKET NUMBER YET. Emely assigns numbers, so this folder is named for what
 * it holds; rename it when the number exists.
 *
 * THE DEFECT, in one sentence: recomputeDirty() compares the draft against
 * i.dirtyRef, and i.dirtyRef was set in exactly one place -- loadIngestDraft --
 * while i.baseline was set in two. A successful Save updated the baseline and
 * left the reference holding the values from when the table was OPENED, so the
 * next render compared the saved draft against them, found a difference (there
 * always is one: Save is only enabled when something was typed) and put the
 * badge back to "Unsaved Changes" with Reset and Save live.
 *
 * HOW IT IS PROVEN HERE, and this is the part that matters: by running the
 * REAL recomputeDirty against the REAL adoptIngestReference. The unadopted case
 * is not a simulation of the old code, it is the shipped comparison function
 * shown a stale reference -- which is precisely what the old code handed it.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
/* BASE: main before this round. It never moves. PREV is the same commit,
 * because this is round 1. */
const BASE = process.env.DAC_BASE_COMMIT || '4e85514';
const SRC = fs.readFileSync(path.join(REPO, REL), 'utf8');
const toCRLF = (s) => s.replace(/\r?\n/g, '\r\n');
const BASE_SRC = toCRLF(execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
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
const BASE_CODE = codeOnly(BASE_SRC);

lines.push('======================================================================');
lines.push('THE BADGE ROUND -- acceptance');
lines.push('  BASE  ' + BASE + ' (main before this round)');
lines.push('======================================================================');

/* ==================================================================== */
lines.push('');
lines.push('=== 1. THE DEFECT: the badge is clean after a successful Save ===');

guard('the reference pair, driven', () => {
  const adopt = grab('adoptIngestReference');
  const dirtyFn = grab('recomputeDirty');
  ok(!!adopt, 'adoptIngestReference is found in app.js');
  ok(!!dirtyFn, 'recomputeDirty is found in app.js');
  if (!adopt || !dirtyFn) return;

  /* clone2D is the shipped one. recomputeTotals is STUBBED, and the stub is
   * justified rather than convenient: what is under test is which reference the
   * badge compares against, and recomputeTotals' own behaviour is CLCPA-212's
   * subject, already covered by its suite. The stub RECORDS its call so the
   * assertion below can prove adoption still runs it -- a stub nobody checks is
   * how a harness starts lying. */
  const clone2D = grab('clone2D');
  ok(!!clone2D, 'clone2D is the shipped one, not a harness copy');

  const build = () => {
    const calls = [];
    const state = { ingest: {
      tableId: 'A1', year: '2025', schema: ['Program', 'Spend'],
      baseline: [['Heat Pumps', 10], ['Insulation', 20]],
      draft: [['Heat Pumps', 10], ['Insulation', 20]],
    } };
    const env = new Function('state', 'recordCall',
      clone2D + '\n' +
      'function recomputeTotals(rows, schema, tableId, baseline) {' +
      '  recordCall({ rows: rows, schema: schema, tableId: tableId, baseline: baseline }); }\n' +
      adopt + '\n' + dirtyFn + '\n' +
      'return { adopt: adoptIngestReference, recompute: recomputeDirty };')(
      state, (c) => calls.push(c));
    return { state, env, calls };
  };

  /* --- THE OPEN: nothing typed, badge clean ------------------------- */
  {
    const { state, env, calls } = build();
    state.ingest.dirty = true;          // as a pending edit would leave it
    env.adopt();
    /* BEFORE any recompute. A mutation that made adoption leave dirty=true went
     * unnoticed without this, because every caller happens to render straight
     * afterwards and the render recomputes -- so the flag was always corrected
     * a moment later. Adoption still has to mean "clean" on its own, or the one
     * caller that ever forgets to render inherits a badge that lies. */
    ok(state.ingest.dirty === false,
       'adoption leaves the state clean by itself, before any recompute');
    ok(calls.length === 1, 'adoption runs recomputeTotals exactly once: ' + calls.length);
    ok(calls[0] && calls[0].tableId === 'A1' && calls[0].baseline === state.ingest.baseline,
       'and passes it the draft-shaped copy plus the real baseline');
    ok(calls[0] && calls[0].rows !== state.ingest.baseline,
       'on a COPY, so the baseline itself is never recomputed');
    env.recompute();
    ok(state.ingest.dirty === false, 'on open the badge is clean');
  }

  /* --- THE EDIT: something typed, badge dirty ---------------------- */
  {
    const { state, env } = build();
    env.adopt();
    state.ingest.draft[0][1] = 99;
    env.recompute();
    ok(state.ingest.dirty === true, 'after typing, the badge is dirty');
  }

  /* --- THE SAVE, adopted: this is the fix -------------------------- */
  {
    const { state, env } = build();
    env.adopt();
    state.ingest.draft[0][1] = 99;          // the operator types
    env.recompute();
    ok(state.ingest.dirty === true, 'dirty before the save, so Save is enabled');
    /* exactly what the save handler now does */
    state.ingest.baseline = JSON.parse(JSON.stringify(state.ingest.draft));
    env.adopt();
    env.recompute();
    ok(state.ingest.dirty === false,
       'AFTER A SUCCESSFUL SAVE THE BADGE IS CLEAN -- the round is about this');
  }

  /* --- WHY THE REFERENCE IS NOT THE BASELINE (CLCPA-212) ----------
   *
   * With recomputeTotals stubbed as a no-op, i.dirtyRef and i.baseline hold the
   * same values and the tests above cannot tell them apart -- so they would
   * pass even if the reference were dropped entirely. That is the harness
   * hiding the reason the reference exists.
   *
   * So here the stub ROUNDS, which is what the real engine does to G1/2025:
   * the source stores 0.47 and the engine computes 0.4700723281104107. The
   * editor recomputes the draft on every render, so the draft holds the
   * computed value while the baseline still holds the stored one. Comparing
   * against the baseline is the 70-of-149 bug; comparing against the recomputed
   * reference is correct. */
  {
    const STORED = 0.47, COMPUTED = 0.4700723281104107;
    const calls = [];
    const state = { ingest: {
      tableId: 'G1', year: '2025', schema: ['Program', 'Share'],
      baseline: [['Electrification', STORED]],
      draft: [['Electrification', STORED]],
    } };
    const env = new Function('state', 'record', 'COMPUTED',
      clone2D + '\n' +
      /* the engine: a stored 0.47 becomes the computed value */
      'function recomputeTotals(rows, schema, tableId, baseline) {' +
      '  record(1); rows.forEach(r => { if (r[1] === 0.47) r[1] = COMPUTED; }); }\n' +
      adopt + '\n' + dirtyFn + '\n' +
      'return { adopt: adoptIngestReference, recompute: recomputeDirty,' +
      '         render: () => recomputeTotals(state.ingest.draft) };')(
      state, () => calls.push(1), COMPUTED);

    env.adopt();
    ok(state.ingest.dirtyRef[0][1] === COMPUTED,
       'the reference holds the COMPUTED value, not the stored one');
    ok(state.ingest.baseline[0][1] === STORED,
       'while the baseline still holds what ConEd published: ' + state.ingest.baseline[0][1]);
    env.render();                       // the editor recomputes the draft
    env.recompute();
    ok(state.ingest.dirty === false,
       'so a table whose stored value is rounded opens CLEAN -- the CLCPA-212 fix');
    /* and the counterfactual, with the REAL comparison function */
    state.ingest.dirtyRef = state.ingest.baseline;
    env.recompute();
    ok(state.ingest.dirty === true,
       'against the BASELINE the same table would open dirty: why dirtyRef exists');
  }

  /* --- THE SAVE, unadopted: the shipped bug, shown red ------------- */
  {
    const { state, env } = build();
    env.adopt();
    const openedRef = state.ingest.dirtyRef;
    state.ingest.draft[0][1] = 99;
    /* the OLD save: baseline moves, the reference does not. Not a mock of the
     * old code -- the real recomputeDirty, handed the reference the old code
     * left in place. */
    state.ingest.baseline = JSON.parse(JSON.stringify(state.ingest.draft));
    env.recompute();
    ok(state.ingest.dirty === true,
       'WITHOUT adoption the same save leaves the badge DIRTY: the defect, reproduced');
    ok(state.ingest.dirtyRef === openedRef,
       'because the reference still holds the values from when the table opened');
  }
});

guard('the save handler adopts the reference', () => {
  /* Structural, and said to be: the behavioural proof above shows what adoption
   * does, this shows the save path performs it. Both are needed -- a correct
   * helper nobody calls fixes nothing. */
  const modal = grab('openSaveModal');
  ok(!!modal, 'openSaveModal is found');
  if (!modal) return;
  const code = codeOnly(modal);
  ok(/i\.baseline = clone2D\(i\.draft\);/.test(code),
     'it still adopts the saved draft as the new baseline');
  ok(/adoptIngestReference\(\);/.test(code),
     'and adopts the badge reference through the one helper');
  ok(!/i\.dirty = false/.test(code),
     'and does NOT set i.dirty by hand, which is what let the pair drift');

  /* THE TWO-BASELINE CLAIM: the bug was really there before this round. */
  const baseModal = grab('openSaveModal', BASE_SRC);
  ok(!!baseModal, 'the BASE save handler is found');
  if (baseModal) {
    const baseCode = codeOnly(baseModal);
    ok(/i\.baseline = clone2D\(i\.draft\);/.test(baseCode),
       'at BASE it moved the baseline');
    ok(!/adoptIngestReference/.test(baseCode) && !/dirtyRef/.test(baseCode),
       'and touched the badge reference NOWHERE: the defect shipped');
  }
});

guard('the reference is set in exactly one place', () => {
  /* The root cause was two writers for baseline and one for dirtyRef. */
  const refWrites = (CODE.match(/\.dirtyRef = /g) || []).length;
  ok(refWrites === 1, 'i.dirtyRef is assigned once in the whole file: ' + refWrites);
  const adopt = grab('adoptIngestReference');
  ok(!!adopt && /\.dirtyRef = /.test(codeOnly(adopt)),
     'and that one assignment is inside adoptIngestReference');
  const loaders = (CODE.match(/adoptIngestReference\(\)/g) || []).length;
  ok(loaders >= 3,
     'the helper is declared once and called from load and save: ' + loaders + ' mentions');
  /* NAMED, not counted. A count catches the removal but does not say which
   * caller lost it, and the two callers are the whole point of the helper. */
  const loader = grab('loadIngestDraft');
  ok(!!loader && /adoptIngestReference\(\);/.test(codeOnly(loader)),
     'loadIngestDraft adopts the reference when a table is opened');
  ok(!!loader && !/\.dirtyRef = /.test(codeOnly(loader)),
     'and no longer sets it itself');
  ok((BASE_CODE.match(/\.dirtyRef = /g) || []).length === 1,
     'at BASE it was also assigned once -- one writer, two callers needing it');
});

/* ==================================================================== */
lines.push('');
lines.push('=== 2. THE BADGE TEXT LIVES ONCE ===');

guard('one definition of the badge text', () => {
  /* Two sites rendered it independently. Counted in CODE ONLY, because the
   * comment on the helper quotes the string while explaining the round -- the
   * fifth time in two sessions that prose has been counted as code, so it is
   * now the default here. */
  ok((CODE.match(/Unsaved Changes/g) || []).length >= 1, 'the string exists');
  const badgeDefs = (CODE.match(/'● Unsaved Changes' : '○ No Changes'/g) || []).length;
  ok(badgeDefs === 1, 'the dirty/clean pair is written exactly once: ' + badgeDefs);
  const helper = grab('ingestStatusText');
  ok(!!helper && /Unsaved Changes/.test(helper) && /No Changes/.test(helper),
     'and it is inside ingestStatusText');

  /* both consumers go through it */
  const render = grab('renderIngestEditor');
  const refresh = grab('refreshIngestStatus');
  ok(!!render && /ingestStatusText\(/.test(codeOnly(render)),
     'the full draw calls it');
  ok(!!refresh && /ingestStatusText\(/.test(codeOnly(refresh)),
     'and so does the in-place refresh');
  ok(!!render && !/● Unsaved/.test(codeOnly(render)),
     'the full draw no longer carries its own copy of the words');
  ok(!!refresh && !/● Unsaved/.test(codeOnly(refresh)),
     'and neither does the refresh');

  /* AT BASE, two copies -- the drift risk this closes */
  const baseRender = grab('renderIngestEditor', BASE_SRC);
  const baseRefresh = grab('refreshIngestStatus', BASE_SRC);
  ok(!!baseRender && /● Unsaved changes/.test(codeOnly(baseRender)) &&
     !!baseRefresh && /● Unsaved changes/.test(codeOnly(baseRefresh)),
     'at BASE both sites spelled it out separately, so they could drift');

  /* the class follows the same route */
  const cls = grab('ingestStatusClass');
  ok(!!cls && /modified/.test(cls) && /clean/.test(cls),
     'the modified/clean class is centralised with it');
});

/* ==================================================================== */
lines.push('');
lines.push('=== 3. TITLE CASE, BY RULE ===');

/* The CLCPA-220 round 4 rule, as CLCPA-230 stated it: first letter of every
 * word capitalised, short connectors allowed lowercase. Interpolated values are
 * exempt -- they are data, not our copy. */
const SMALL = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'from', 'in',
  'into', 'nor', 'of', 'on', 'only', 'or', 'per', 'the', 'to', 'v', 'via', 'with'];
function titleCaseProblems(s) {
  const cleaned = String(s)
    .replace(/\$\{[^}]*\}/g, ' ')      // interpolations are data
    .replace(/[●○×+·(),.:;?!"']/g, ' ')
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  const bad = [];
  words.forEach((w, idx) => {
    if (/^\d+$/.test(w)) return;                       // numbers
    if (!/^[a-z]/.test(w)) return;                     // already capitalised
    if (idx > 0 && SMALL.indexOf(w.toLowerCase()) >= 0) return;  // connector
    bad.push(w);
  });
  return bad;
}

guard('the checker itself', () => {
  /* Asserted before it is trusted, on answers that are not in doubt. */
  ok(titleCaseProblems('Unsaved Changes').length === 0, 'it accepts a correct label');
  ok(titleCaseProblems('Unsaved changes').length === 1,
     'it rejects the sentence-case version, naming the word: ' +
     titleCaseProblems('Unsaved changes').join(','));
  ok(titleCaseProblems('● Unsaved Changes').length === 0, 'the badge glyph is not a word');
  ok(titleCaseProblems('+ Add Row').length === 0, 'nor is the plus');
  ok(titleCaseProblems('Show All ${history.length} Saves').length === 0,
     'an interpolation is exempt');
  ok(titleCaseProblems('Show all ${history.length} saves').length === 2,
     'but the words around it are not: ' +
     titleCaseProblems('Show all ${history.length} saves').join(','));
  ok(titleCaseProblems('Remove 2027 from the Dashboard?').length === 0,
     'connectors and numbers are allowed');
  ok(titleCaseProblems('Save Changes').length === 0 &&
     titleCaseProblems('Save changes').length === 1,
     'and it separates the two spellings of the ruled button');
});

guard('the three RULED strings', () => {
  const ruled = [
    ['● Unsaved Changes', 'the dirty badge'],
    ['○ No Changes', 'the clean badge'],
    ['Save Changes', 'the save button'],
  ];
  ruled.forEach(([text, what]) => {
    ok(CODE.indexOf(text) >= 0, what + ' reads "' + text + '"');
    ok(titleCaseProblems(text).length === 0, '  and satisfies the rule');
  });
  /* and the old spellings are GONE from the code */
  [['● Unsaved changes', 'the dirty badge'], ['○ No changes', 'the clean badge'],
   ['>Save changes<', 'the save button']].forEach(([text, what]) => {
    ok(CODE.indexOf(text) < 0, what + ' has no sentence-case copy left');
  });
});

guard('the swept stragglers', () => {
  /* Read out of app.js, so this is about what ships. Each is a LABEL: a button,
   * a heading or a form label. */
  const swept = [
    ['>+ Add Row</button>', '+ Add Row', 'the add-row link'],
    ['<h4>Change History</h4>', 'Change History', 'the history heading, empty state'],
    ['<h4>Change History <span', 'Change History', 'the history heading, populated'],
    ['>Show Details</button>', 'Show Details', 'the history toggle, initial'],
    ["isOpen ? 'Show Details' : 'Hide Details'", 'Show Details Hide Details', 'the toggle in js'],
    ['Show All ${history.length} Saves', 'Show All Saves', 'the show-all link'],
    ['>Show Recent 10 Only</button>', 'Show Recent 10 Only', 'the show-less link'],
    ['>Your Name</label>', 'Your Name', 'the name field label'],
    ['>Your Email</label>', 'Your Email', 'the email field label'],
  ];
  swept.forEach(([needle, text, what]) => {
    ok(CODE.indexOf(needle) >= 0, what + ' is title case');
    ok(titleCaseProblems(text).length === 0, '  and satisfies the rule');
  });
  /* the toggle's two halves must agree, or the button changes vocabulary
   * halfway through its own interaction */
  ok(CODE.indexOf("'Show Details' : 'Hide Details'") >= 0 &&
     CODE.indexOf('>Show Details</button>') >= 0,
     'the toggle label agrees with its initial render');
  /* and none of the OLD spellings survive */
  ['+ Add row<', '<h4>Change history', '>Show details<', "'Show details'",
   '>Show recent 10 only<', '>Your name<', '>Your email<'].forEach(old => {
    ok(CODE.indexOf(old) < 0, 'no sentence-case copy of ' + JSON.stringify(old));
  });
});

guard('every Report Data label passes the rule, not just the ones I listed', () => {
  /* A LIST of labels is a list; a RULE catches the one added next week. The
   * region is the Report Data page: from renderIngestPage to the end of the
   * save modal. */
  const from = SRC.indexOf('function renderIngestPage(');
  const to = SRC.indexOf('function wireIngestStaging(');
  ok(from > 0 && to > from, 'the Report Data region is located');
  if (!(from > 0 && to > from)) return;
  const region = codeOnly(SRC.slice(from, to));

  /* THE COPY, not the code. A label built by concatenation --
   *   '...>' + escapeHtml(primaryLabel()) + '<...'
   * -- captured whole, and my first version fed "escapeHtml(o.cancelLabel ||"
   * to the checker, which duly reported "escapeHtml" as a lowercase word. Those
   * are computed labels: the same exemption the CLCPA-230 guard gives ${...},
   * reached through a different syntax. So the code spans are removed and only
   * the words WE wrote are judged. */
  const literalOnly = (s) => s
    .replace(/'\s*\+[\s\S]*?\+\s*'/g, ' ')   // ' + expression + '
    .replace(/'\s*\+[\s\S]*$/g, ' ')          // a trailing ' + expression
    .replace(/^[\s\S]*?\+\s*'/g, ' ')         // a leading expression + '
    .replace(/\s+/g, ' ')
    .trim();

  const labels = [];
  const push = (re, kind) => {
    let m; const r = new RegExp(re.source, 'g');
    while ((m = r.exec(region))) {
      const text = literalOnly(m[1]);
      if (text) labels.push({ text: text, kind: kind, raw: m[1].trim() });
    }
  };
  push(/<button[^>]*>([^<>{}]+)<\/button>/, 'button');
  push(/<h4>([^<>{}]+)<\/h4>/, 'h4');
  push(/<label[^>]*>([^<>{}]+)<\/label>/, 'label');

  ok(labels.length >= 8, 'labels found in the region: ' + labels.length);
  ok(labels.every(l => !/escapeHtml|\|\|/.test(l.text)),
     'no captured label still carries code: ' +
     (labels.filter(l => /escapeHtml|\|\|/.test(l.text))[0] || { text: 'none' }).text);
  const offenders = labels
    .map(l => ({ l: l, bad: titleCaseProblems(l.text) }))
    .filter(x => x.bad.length);

  /* THE DELIBERATE EXCEPTIONS, each named with its reason. An unnamed offender
   * fails; these are the ones Emely's rule does not reach. */
  const EXEMPT = {
    'Nothing was imported':
      'a status SENTENCE, the same family as the CLCPA-234 success panel ' +
      'heading below, which Emely approved as delivered',
    'Imported into the draft: cell':
      'THE CLCPA-234 SUCCESS PANEL, approved verbatim two days ago. I cited it ' +
      'as the precedent for the exemption above and then left it out of the ' +
      'list, so the suite reported it -- correctly',
  };
  const unexplained = offenders.filter(x => !(x.l.text in EXEMPT));
  unexplained.forEach(x => ok(false,
    'UNEXPLAINED sentence-case label: ' + JSON.stringify(x.l.text) +
    ' (' + x.l.kind + ', words: ' + x.bad.join(',') + ')'));
  ok(unexplained.length === 0,
     'no Report Data button, h4 or label is sentence case except the named exemption');
  Object.keys(EXEMPT).forEach(text => {
    ok(offenders.some(x => x.l.text === text),
       'the exemption is REAL and still present: ' + JSON.stringify(text));
    lines.push('       exempt: ' + JSON.stringify(text) + ' -- ' + EXEMPT[text]);
  });
});

/* ==================================================================== */
lines.push('');
lines.push('=== 4. WHAT WAS DELIBERATELY LEFT ALONE ===');

guard('the prose is untouched', () => {
  /* buildHistorySummary returns one of a family of SENTENCE fragments --
   * "3 cells edited", "1 row added". Title-casing only the empty case would
   * make it the odd one out. */
  const sum = grab('buildHistorySummary');
  ok(!!sum, 'buildHistorySummary is found');
  if (sum) {
    ok(/return 'No changes';/.test(codeOnly(sum)),
       'its "No changes" is unchanged: it is prose, not the badge');
    ok(/cell\$\{cells\s*!==\s*1/.test(sum) || /cells\s*>\s*0/.test(codeOnly(sum)),
       'and it sits with the "N cells edited" family that proves it is prose');
  }
  /* the badge and the summary are now DIFFERENT strings, which is the point */
  ok(CODE.indexOf("'No changes'") >= 0 && CODE.indexOf("'○ No Changes'") >= 0,
     'so the two coexist deliberately: prose lowercase, badge title case');
});

guard('the CLCPA-226 tooltip is not disturbed', () => {
  /* "Delete row" is a TOOLTIP and an aria-label, not a visible label, and it is
   * pinned in SIX assertions in suite_226 -- including a measured shrink-to-fit
   * width. Title-casing it would re-open a closed ticket's evidence to change a
   * string no user reads as a label. Left alone, and raised for Emely instead. */
  ok(CODE.indexOf('data-tip="Delete row" aria-label="Delete row"') >= 0,
     'the delete-row tooltip still reads "Delete row", both attributes');
  ok(CODE.indexOf('aria-label="Delete Row"') < 0,
     'and was not quietly retitled');
});

guard('the CLCPA-234 panel text is byte-identical', () => {
  /* Approved as delivered, verbatim, two days ago. This round must not touch
   * it. */
  const r = grab('renderIngestImportResult');
  ok(!!r, 'renderIngestImportResult is found');
  const baseR = grab('renderIngestImportResult', BASE_SRC);
  ok(!!baseR, 'and at BASE');
  ok(r === baseR, 'the import result panel is unchanged by this round');
  ok(!!r && r.indexOf('Review the values below, then press Save. ' +
     'Nothing has been saved yet.') >= 0,
     'including the reminder Emely approved verbatim');
});

guard('nothing else in app.js moved', () => {
  /* The whole-file claim, asserted at FUNCTION granularity.
   *
   * My first version compared multisets of code LINES and reported five
   * off-topic changes that were nothing of the kind: `}`, `const i =
   * state.ingest;` and `if (!i) return;` -- the generic lines any new function
   * brings with it. A guard whose failures are all false is worse than no
   * guard, so it is replaced rather than loosened: which FUNCTIONS differ is
   * the claim I actually want, and it has no such noise. */
  /* PINNED TO THIS ROUND'S OWN MERGE COMMIT, not to the working tree.
   *
   * This guard read app.js from disk, and it was right to fail the moment
   * CLCPA-238 started adding functions: the working tree is no longer this
   * round. But a closed round's blast radius is a HISTORICAL FACT -- "the badge
   * round changed these six functions and added those three" -- and it does not
   * become false because later work landed on top. Re-pointing it at the round's
   * own merge keeps the claim true and checkable forever, where updating the
   * expected lists to swallow CLCPA-238's diff would have made this suite
   * quietly assert somebody else's change. */
  const ROUND = process.env.DAC_ROUND_COMMIT || '97e2df0';
  const ROUND_SRC = toCRLF(execSync('git show ' + ROUND + ':"' + REL + '"',
    { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
  ok(ROUND_SRC.length > 0, 'app.js at the badge round\'s merge ' + ROUND + ' is readable');

  const names = new Set();
  [ROUND_SRC, BASE_SRC].forEach(s => {
    const r = /\r\n  (?:async )?function (\w+)\(/g;
    let m; while ((m = r.exec(s))) names.add(m[1]);
  });
  ok(names.size > 300, 'top-level functions enumerated: ' + names.size);

  const changed = [], appeared = [], vanished = [];
  names.forEach(n => {
    const a = grab(n, BASE_SRC), b = grab(n, ROUND_SRC);
    if (a == null && b != null) { appeared.push(n); return; }
    if (a != null && b == null) { vanished.push(n); return; }
    if (a !== b) changed.push(n);
  });

  /* NEW, and each one is the round's own mechanism. */
  const EXPECT_NEW = ['adoptIngestReference', 'ingestStatusText', 'ingestStatusClass'];
  /* CHANGED, each with the reason it had to be. */
  const EXPECT_CHANGED = {
    loadIngestDraft: 'sets the reference through the helper now',
    openSaveModal: 'adopts the reference after a save -- THE FIX, plus Your Name/Your Email',
    renderIngestEditor: 'the badge via ingestStatusText, and Save Changes / + Add Row',
    refreshIngestStatus: 'the badge via the same helper instead of its own copy',
    renderIngestHistory: 'Change History, Show Details, Show All N Saves, Show Recent 10 Only',
    wireIngestHistory: 'the Show Details / Hide Details toggle',
  };

  appeared.sort(); changed.sort();
  lines.push('       new functions     : ' + (appeared.join(', ') || 'none'));
  lines.push('       changed functions : ' + (changed.join(', ') || 'none'));
  lines.push('       removed functions : ' + (vanished.join(', ') || 'none'));

  ok(vanished.length === 0, 'no function was removed');
  ok(appeared.length === EXPECT_NEW.length &&
     EXPECT_NEW.every(n => appeared.indexOf(n) >= 0),
     'exactly the three intended helpers are new');
  /* The message says what a PASS means. Written the other way round it printed
   * "ok UNEXPLAINED changed function: loadIngestDraft", which reads as its own
   * contradiction -- evidence has to be legible to someone who did not write
   * it. */
  changed.forEach(n => ok(n in EXPECT_CHANGED,
    'the change to ' + n + ' is accounted for'));
  Object.keys(EXPECT_CHANGED).forEach(n => ok(changed.indexOf(n) >= 0,
    n + ' changed as intended: ' + EXPECT_CHANGED[n]));
  ok(changed.every(n => n in EXPECT_CHANGED),
     'and no function outside that list moved at all');
});

/* ==================================================================== */
lines.push('');
lines.push('======================================================================');
lines.push('  ' + pass + ' passed, ' + fail + ' failed');
lines.push('======================================================================');

const out = lines.join('\n') + '\n';
process.stdout.write(out);
fs.writeFileSync(path.join(__dirname, 'suite-badge-output.txt'), out);
process.exitCode = fail ? 1 : 0;
