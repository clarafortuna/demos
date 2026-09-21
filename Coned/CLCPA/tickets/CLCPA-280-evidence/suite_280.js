/* CLCPA-280 acceptance: the DELIVERED BY and UPDATE CADENCE placeholder fields
 * are gone from the Data Sources family tabs, and nothing else on those tabs is.
 *
 * The rendered half is repro_280.js: the five tabs painted in Chrome under the
 * app's own stylesheet, both sides pinned, with the block heights measured.
 * This suite pins the data, the renderer, the stylesheet and the sweep, against
 * a BASE that predates the change.
 *
 * Every read is of the SHIPPED bytes. DS_DICT is not retyped here: both builds'
 * dictionaries are extracted and run, because a suite that carries its own copy
 * of the data is checking the copy.
 *
 * Pins:
 *   DAC_BASE_COMMIT    the pre-change baseline, default fcf4587
 *   DAC_APP_OVERRIDE   feed a deliberately broken app.js in (mut_280.js)
 *   DAC_CSS_OVERRIDE   the same for styles.css, which DAC_APP_OVERRIDE cannot
 *                      reach and which carries one of the four claims
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const R280 = require('./render_280.js');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSSREL = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const OUT = path.join(__dirname, 'suite-280-output.txt');
const CRLF = String.fromCharCode(13) + String.fromCharCode(10);
const LF = new RegExp(String.fromCharCode(92) + 'r?' + String.fromCharCode(92) + 'n', 'g');

const BASE = process.env.DAC_BASE_COMMIT || 'fcf4587';
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const CSS = fs.readFileSync(process.env.DAC_CSS_OVERRIDE || path.join(DEV, 'styles.css'), 'utf8');
/* git blobs are LF, the working tree is CRLF, and the extractor anchors on
 * CRLF: an un-normalised baseline resolves nothing and renders an empty page
 * that would read as "the placeholders were never there" */
const show = (rel) => execSync('git show ' + BASE + ':"' + rel + '"',
  { cwd: ROOT, maxBuffer: 1 << 29 }).toString('utf8').replace(LF, CRLF);
const BASE_SRC = show(REL), BASE_CSS = show(CSSREL);

/* the three strings the ticket names, spelled once */
const GONE = ['TO BE FILLED', 'Delivered by', 'Update cadence'];
const TITLES = {
  layers: 'Map Layers', indicators: 'DAC Indicators', shapes: 'Tract Shapes',
  coned: 'Electric and Gas Figures', territory: 'Territory Overlays',
};

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  PASS  ' + m); } else { fail++; log('  FAIL  ' + m); } };
const guard = (label, fn) => {
  try { fn(); } catch (e) { fail++; log('  FAIL  ' + label + ' threw: ' + (e && e.message)); }
};
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const count = (s, needle) => s.split(needle).length - 1;

log('CLCPA-280: the placeholder origin fields are retired from Data Sources');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree') +
  '   styles.css ' + (process.env.DAC_CSS_OVERRIDE || 'working tree'));
log('');

/* ---- A. THE DATA: the six rows are gone, and BASE had them ----------- */
log('A. THE DICTIONARY');
guard('A  data', () => {
  const baseDict = R280.makeRenderer(BASE_SRC, 'base');
  const nowDict = R280.makeRenderer(SRC, 'now');
  if (baseDict.error) throw new Error('BASE renderer: ' + baseDict.error);
  if (nowDict.error) throw new Error('working renderer: ' + nowDict.error);
  const B = baseDict.api.dsDict(), N = nowDict.api.dsDict();

  ok(B.length === 5 && N.length === 5,
    'A1 both builds carry five family entries: ' + B.length + ' -> ' + N.length);

  const rowsOf = (d, id) => ((d.filter(e => e.id === id)[0] || {}).origin || []);
  const labels = (d, id) => rowsOf(d, id).map(r => r[0]);
  let baseHits = 0, nowHits = 0;
  Object.keys(TITLES).forEach((id) => {
    const bl = labels(B, id), nl = labels(N, id);
    baseHits += bl.filter(k => k === 'Delivered by' || k === 'Update cadence').length;
    nowHits += nl.filter(k => k === 'Delivered by' || k === 'Update cadence').length;
    log('    ' + TITLES[id].padEnd(26) + JSON.stringify(bl));
    log('    ' + ''.padEnd(26) + '-> ' + JSON.stringify(nl));
  });
  ok(baseHits === 6, 'A2 BASE ' + BASE + ' carried six placeholder rows: ' + baseHits);
  ok(nowHits === 0, 'A3 the shipped build carries none: ' + nowHits);

  /* THE KEPT ROWS ARE KEPT, value and order. This is the half a removal gets
   * wrong: taking two rows out of an array by index is one slip away from
   * taking a third. */
  Object.keys(TITLES).forEach((id) => {
    const kept = rowsOf(B, id).filter(
      ([k]) => k !== 'Delivered by' && k !== 'Update cadence');
    ok(JSON.stringify(kept) === JSON.stringify(rowsOf(N, id)),
      'A4.' + id + ' ' + TITLES[id] + ': the rows left are BASE minus those two, ' +
      'same values, same order');
  });

  /* AND NOTHING ELSE IN THE DICTIONARY MOVED. Every other field of every
   * entry, compared whole. */
  const rest = (e) => JSON.stringify(Object.keys(e).sort()
    .filter(k => k !== 'origin').map(k => [k, e[k]]));
  Object.keys(TITLES).forEach((id) => {
    const be = B.filter(e => e.id === id)[0], ne = N.filter(e => e.id === id)[0];
    ok(rest(be) === rest(ne),
      'A5.' + id + ' ' + TITLES[id] + ': title, text, source, requirements, update ' +
      'and script are untouched');
  });
});

/* ---- B. THE RENDERER: the placeholder branch is gone ---------------- */
log('');
log('B. THE RENDERER');
guard('B  renderer', () => {
  const code = codeOnly(SRC), was = codeOnly(BASE_SRC);
  /* pinned through codeOnly on BOTH sides: a doc comment quoting the old
   * branch would otherwise satisfy a search for the old branch, which is the
   * single most repeated way a harness in this repo has lied */
  ok(/ds-dict-gap/.test(was),
    'B1 BASE emitted a <span class="ds-dict-gap"> for an unrecorded origin');
  ok(!/ds-dict-gap/.test(code),
    'B2 no code path emits that class any more');
  ok(!/TO BE FILLED/.test(code),
    'B3 and no code path tests for, or writes, the placeholder string');

  /* THE FUNCTION, RUN. A source check alone cannot see a branch that still
   * fires through some other spelling. */
  const R = R280.pagesFor(SRC, 'now'), P = R280.pagesFor(BASE_SRC, 'base');
  let before = 0, after = 0;
  Object.keys(TITLES).forEach((id) => {
    before += count(P[id], 'TO BE FILLED');
    after += count(R[id], 'TO BE FILLED');
  });
  ok(before === 6, 'B4 BASE rendered six placeholders across the five tabs: ' + before);
  ok(after === 0, 'B5 the shipped renderer emits none: ' + after);
  Object.keys(TITLES).forEach((id) => {
    ok(count(R[id], 'ds-dict-gap') === 0,
      'B6.' + id + ' ' + TITLES[id] + ': no gap pill in the rendered markup');
  });

  /* THE BLOCK STILL RENDERS ITS REMAINING ROWS. Removing every row from an
   * entry would also produce zero placeholders, and would be a regression:
   * the block would silently fall through to the source sentence. */
  ['indicators', 'shapes', 'coned', 'territory'].forEach((id) => {
    ok(/<dl class="ds-dict-origin">/.test(R[id]),
      'B7.' + id + ' ' + TITLES[id] + ': "Where the data comes from" is still a row list');
    ok(count(R[id], '<dt>') >= 1 && /Published by/.test(R[id]),
      'B8.' + id + ' ' + TITLES[id] + ': and it still carries Published by');
  });
  ok(!/<dl class="ds-dict-origin">/.test(R.layers),
    'B9 Map Layers still has no row list, as it never had one');
  ok(/Any source you choose/.test(R.layers),
    'B10 and still falls back to its source sentence');
});

/* ---- C. THE DEAD STYLE WENT WITH IT --------------------------------- */
log('');
log('C. THE STYLESHEET');
guard('C  css', () => {
  ok(/\.ds-dict-gap\s*\{/.test(BASE_CSS), 'C1 BASE styled the gap pill');
  ok(!/\.ds-dict-gap\s*\{/.test(codeOnly(CSS)),
    'C2 the rule is gone from the shipped stylesheet');
  /* the sibling rules that carry the REMAINING rows must not have gone with
   * it: .ds-dict-origin is what draws Published by */
  ['.ds-dict-origin', '.ds-dict-origin dt', '.ds-dict-origin dd'].forEach((sel, i) => {
    ok(CSS.indexOf(sel + ' {') >= 0 || new RegExp(
      sel.replace(/\./g, '\\.') + '\\s*\\{').test(CSS),
    'C3.' + i + ' ' + sel + ' is still styled');
  });
});

/* ---- D. THE SWEEP, WHICH IS THE GATE -------------------------------- */
log('');
log('D. THE SWEEP');
guard('D  sweep', () => {
  /* RAW BYTES, no comment filter. The ticket's gate is that these strings
   * appear NOWHERE in what ships, and a filtered count would make the answer
   * depend on which filter ran. The retirement comments are written not to
   * quote them, so this can be absolute. */
  const FILES = ['app.js', 'styles.css', 'ExecutiveDashboard.html', 'index.html',
                 'data-sources.html', 'sources-update-guide.html'];
  FILES.forEach((f) => {
    const text = f === 'app.js' ? SRC
      : f === 'styles.css' ? CSS
        : fs.readFileSync(path.join(DEV, f), 'utf8');
    GONE.forEach((needle) => {
      const n = count(text, needle);
      if (n) log('    ' + f + ': "' + needle + '" x' + n);
      ok(n === 0, 'D1 ' + f.padEnd(26) + ' carries no "' + needle + '": ' + n);
    });
  });
  /* and the class name survives only as a tombstone: named in a comment so it
   * can be found later, in no rule and in no markup */
  ok(count(codeOnly(CSS), 'ds-dict-gap') === 0 && count(CSS, 'ds-dict-gap') === 1,
    'D2 ds-dict-gap survives only as the retirement comment: ' +
    count(CSS, 'ds-dict-gap') + ' mention(s), ' +
    count(codeOnly(CSS), 'ds-dict-gap') + ' in live CSS');
});

/* ---- E. THE CHANGE IS THE CHANGE ------------------------------------ */
log('');
log('E. WHAT ELSE MOVED');
guard('E  scope', () => {
  /* APP CODE ONLY. The handoff package is CLCPA-279's lane and is named in
   * the ticket as untouched, so this is asserted rather than remembered. */
  const changed = execSync('git diff --name-only ' + BASE, { cwd: ROOT })
    .toString().trim().split(/\r?\n/).filter(Boolean);
  /* AN ALLOW-LIST, NAMED, not a pattern loose enough to swallow whatever
   * turns up. render_221.js is on it because CLCPA-280 spends one of its
   * pins: CLCPA-221 asserted the placeholders were VISIBLE, and that
   * assertion is inverted there rather than widened. This block caught that
   * edit on the first sweep, which is the only reason it is declared here
   * instead of discovered later. */
  const ALLOWED = [
    /^Coned\/CLCPA\/ExecutiveDashboard_dev\/(app\.js|styles\.css)$/,
    /^Coned\/CLCPA\/tickets\/CLCPA-280-evidence\//,
    /^Coned\/CLCPA\/tickets\/CLCPA-221-evidence\/render_221\.js$/,
    /* The five cross-ticket LEDGERS. Each holds an exact inventory of every
     * app.js function and every stylesheet rule that has moved since its own
     * baseline, with the ticket that moved it named and the count pinned. A
     * change that does not declare itself there turns them red, which is what
     * they are for and what they did on the first sweep of this one. Named
     * individually so a sixth ledger appearing later is a failure, not a
     * silent pass. */
    /^Coned\/CLCPA\/tickets\/CLCPA-245-evidence\/suite_245\.js$/,
    /^Coned\/CLCPA\/tickets\/CLCPA-249-evidence\/suite_249\.js$/,
    /^Coned\/CLCPA\/tickets\/CLCPA-254-evidence\/suite_254_255_261\.js$/,
    /^Coned\/CLCPA\/tickets\/CLCPA-260-evidence\/suite_260\.js$/,
    /^Coned\/CLCPA\/tickets\/CLCPA-263-evidence\/suite_263\.js$/,
    /* and the committed run outputs, which every suite rewrites from its own
     * run: these are the record OF a run, not source, and are regenerated
     * from clean source immediately before the commit */
    /^Coned\/CLCPA\/tickets\/[^/]+\/[^/]*-output\.txt$/,
  ];
  const outside = changed.filter(f => !ALLOWED.some(re => re.test(f)));
  log('    changed since ' + BASE + ': ' + JSON.stringify(changed));
  ok(outside.length === 0,
    'E1 only the two web resources, this evidence directory, the one spent ' +
    'CLCPA-221 pin, the five ledgers and committed run outputs changed: ' +
    JSON.stringify(outside));
  /* CLCPA-221's captured renders are frozen evidence: they describe the build
   * of the day and are not rewritten to match a later one */
  ok(!changed.some(f => /^Coned\/CLCPA\/tickets\/CLCPA-221-evidence\/renders\//.test(f)),
    'E1b and CLCPA-221\'s captured renders are untouched');
  ok(!changed.some(f => /make_handoff_package|verify_handoff_package|operator-docs|OPERATOR_SCRIPT_FACTS/.test(f)),
    'E2 the handoff package lane is untouched');

  /* the app.js diff is the six rows, the one branch and the comments that
   * explain them, and nothing else */
  const diff = execSync('git diff -U0 ' + BASE + ' -- "' + REL + '"',
    { cwd: ROOT, maxBuffer: 1 << 28 }).toString();
  const added = diff.split(/\r?\n/).filter(l => /^\+/.test(l) && !/^\+\+\+/.test(l));
  const nonComment = added.map(l => l.slice(1))
    .filter(l => l.trim() && !/^\s*(\/\/|\*|\/\*)/.test(l));
  log('    added non-comment lines: ' + JSON.stringify(nonComment.map(l => l.trim())));
  /* ONE. Not five, which is what this said before it was run: the removal is
   * six array rows and a nested ternary losing its inner arm, so the only line
   * git sees as ADDED is the one that used to end the inner arm and now ends
   * the outer one. Counted off the diff, not reasoned about. */
  ok(nonComment.length === 1,
    'E3 exactly one added line of code, the collapsed branch tail: ' + nonComment.length);
  ok(/escapeHtml\(v\)\)/.test(nonComment[0] || ''),
    'E3b and it is that tail: ' + JSON.stringify((nonComment[0] || '').trim()));
  ok(nonComment.every(l => !/TO BE FILLED|ds-dict-gap|Delivered by|Update cadence/.test(l)),
    'E4 and not one of them reintroduces a placeholder');
  /* no long dash anywhere in what was added, code or comment */
  ok(!added.some(l => /[—–]|&mdash;|&ndash;/.test(l)),
    'E5 nothing added carries a long dash');
});

log('');
log(pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
