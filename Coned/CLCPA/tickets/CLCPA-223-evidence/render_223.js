/* CLCPA-223: the operator UI gate, and the deletion of the Edit map files page.
 *
 * Two baselines, neither of them HEAD:
 *   BASE  pre-223. Proves the gate is new and the deleted page existed.
 *   (no PREV: this is the ticket's first round, so BASE is the only baseline.)
 *
 * WHAT THIS HARNESS CAN AND CANNOT PROVE, stated up front because ruling 2
 * turns on it:
 *   - It EXECUTES renderNotOperable() and applyOperatorGate() against stubs, so
 *     the presentation half is really run, not merely read.
 *   - It reads SOURCE for the route gate and the probe wiring, because both sit
 *     inside functions with large DOM and network dependencies. Those checks
 *     prove the code is written and positioned, not that a browser reaches it.
 *   - It CANNOT prove detection: that a user who genuinely lacks Write is
 *     denied. Nothing in this repo can. That needs a non-operator Dataverse
 *     session and is recorded as asserted-only, per ruling 2.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const HTML_REL = 'Coned/CLCPA/ExecutiveDashboard_dev/ExecutiveDashboard.html';
const BASE = process.env.DAC_BASE_COMMIT || 'b7e7b37';   // pre-223, as deployed
// Round 2 adds a PREV. BASE proves the ticket's whole story; PREV proves what
// THIS round changed. Neither is HEAD.
const PREV = process.env.DAC_PREV_COMMIT || '52654de';   // 223 round 1, as deployed
const OUT = process.argv[2] || path.join(__dirname, 'renders');

const toCRLF = (t) => t.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
const SRC = fs.readFileSync(path.join(REPO, REL), 'utf8');
const HTML = fs.readFileSync(path.join(REPO, HTML_REL), 'utf8');
const BASE_SRC = toCRLF(execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
const BASE_HTML = toCRLF(execSync('git show ' + BASE + ':"' + HTML_REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
const PREV_SRC = toCRLF(execSync('git show ' + PREV + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
const CSS_REL = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const PREV_CSS = toCRLF(execSync('git show ' + PREV + ':"' + CSS_REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));
const BASE_CSS = toCRLF(execSync('git show ' + BASE + ':"' + CSS_REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8'));

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => { if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); } return !!c; };

/* ---------- extraction: line-start anchored at an exact indent ------------ */
function grab(src, name) {
  for (const pad of ['  ', '    ', '']) {
    for (const kw of ['function ', 'async function ']) {
      const head = '\r\n' + pad + kw + name + '(';
      const i = src.indexOf(head);
      if (i < 0) continue;
      const close = '\r\n' + pad + '}';
      const j = src.indexOf(close, i + head.length);
      if (j >= 0) return src.slice(i + 2, j + close.length);
    }
  }
  return null;
}

/* ---------- a runnable gate, with Storage and the DOM stubbed ------------- */
function makeGate(src) {
  const notOp = grab(src, 'renderNotOperable');
  const apply = grab(src, 'applyOperatorGate');
  if (!notOp || !apply) return { err: 'could not extract (' +
    (notOp ? '' : 'renderNotOperable ') + (apply ? '' : 'applyOperatorGate') + ')' };
  const body = '"use strict";\n' +
    'const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")' +
    '.replace(/>/g, "&gt;").replace(/"/g, "&quot;");\n' +
    'let _log = [];\n' +
    'const console = { info: (m) => _log.push(m), warn: (m) => _log.push(m) };\n' +
    'const el = { hidden: false };\n' +
    'let _present = true;\n' +
    'const document = { getElementById: (id) => (id === "nav-ingestion" && _present) ? el : null };\n' +
    notOp + '\n' + apply + '\n' +
    'return { notOp: renderNotOperable, apply: applyOperatorGate, el: el,' +
    ' log: () => _log, reset: () => { _log = []; el.hidden = false; },' +
    ' setPresent: (v) => { _present = v; } };';
  try { return { api: new Function('Storage', body) }; }
  catch (e) { return { err: e.message }; }
}

const built = makeGate(SRC);
if (built.err) {
  console.error('EXTRACTION FAILED: ' + built.err);
  process.exit(1);
}
// Storage doubles: exactly the four states the gate must distinguish.
const S = {
  operator:    { canOperateIngestion: () => true,  canOperateReportData: () => true,  canOperateMapData: () => true },
  viewer:      { canOperateIngestion: () => false, canOperateReportData: () => false, canOperateMapData: () => false },
  mapOnly:     { canOperateIngestion: () => true,  canOperateReportData: () => false, canOperateMapData: () => true },
  reportOnly:  { canOperateIngestion: () => true,  canOperateReportData: () => true,  canOperateMapData: () => false },
};

lines.push('======================================================================');
lines.push('CLCPA-223 -- the operator gate, and the Edit map files deletion');
lines.push('======================================================================');

lines.push('');
lines.push('=== the sidebar gate, EXECUTED ===');
{
  const g = built.api(S.operator);
  g.reset(); g.apply();
  ok(g.el.hidden === false, 'an operator keeps the Data Ingestion group');

  const v = built.api(S.viewer);
  v.reset(); v.apply();
  ok(v.el.hidden === true, 'a viewer loses it: hidden, label and both entries with it');
  ok(v.log().join(' ').indexOf('convenience') >= 0,
     'and the log says plainly that the gate is convenience, not enforcement');

  // the UNION rule: either page alone keeps the section
  const m = built.api(S.mapOnly); m.reset(); m.apply();
  ok(m.el.hidden === false, 'Map Data alone keeps the section (union, not intersection)');
  const r = built.api(S.reportOnly); r.reset(); r.apply();
  ok(r.el.hidden === false, 'Report Data alone keeps it too');

  // absent container must not throw
  const n = built.api(S.viewer); n.reset(); n.setPresent(false);
  let threw = false;
  try { n.apply(); } catch (e) { threw = true; }
  ok(!threw, 'a missing container is a no-op, not a crash');
}

lines.push('');
lines.push('=== the not-available view, EXECUTED ===');
const views = {};
{
  const g = built.api(S.viewer);
  ['Report Data', 'Map Data'].forEach(name => {
    const h = g.notOp(name);
    views[name] = h;
    ok(h.indexOf('<h1>' + name + '</h1>') >= 0, name + ': the page names itself');
    ok(/Not available for your account/.test(h), name + ': and says it is not available');
    ok(/ask your Dataverse\s+administrator to check your security role/.test(h),
       name + ': and points at the role, which is the actionable part');
    ok(/href="#\/"/.test(h), name + ': with a way back');
    // ruling 1: the diagnosis lives in the DOCUMENT, not the menu or this page
    ok(!/cr2bf_/.test(h), name + ': it does NOT name tables to an unauthorised viewer');
    ok(!/prv|privilege/i.test(h), name + ': nor the privilege');
  });
  ok(views['Report Data'] !== views['Map Data'], 'the two pages render distinctly');
}

lines.push('');
lines.push('=== the route gate covers the PAGE, not the menu (source) ===');
{
  const rcv = grab(SRC, 'renderCurrentView');
  ok(!!rcv, 'renderCurrentView was found to read');
  const gate = rcv.slice(0, rcv.indexOf("r.name === 'executive'"));
  ok(/r\.name === 'ingest' && !Storage\.canOperateReportData\(\)/.test(gate),
     'the ingest guard is BEFORE the first render branch');
  ok(/r\.name === 'maplayers' && !Storage\.canOperateMapData\(\)/.test(gate),
     'and so is the maplayers guard');
  ok((gate.match(/renderNotOperable\(/g) || []).length === 2,
     'both guards render the not-available view');
  ok((gate.match(/return;/g) || []).length === 2,
     'and both RETURN, so no page renderer runs underneath');
  // each page is gated on ITS OWN table's predicate, not one shared flag
  ok(!/canOperateIngestion\(\)/.test(gate),
     'the page gates use the per-page predicates, not the section union');
}

lines.push('');
lines.push('=== Write is the floor, probed per page (source) ===');
{
  ok(/const ENT_TABLEDATA = 'cr2bf_dacingesttesttabledata1';/.test(SRC),
     'the Report Data table is named by LOGICAL name, which the probe needs');
  ok(/resolveTablePrivileges\(ENT_TABLEDATA, userId\)/.test(SRC),
     'and it is probed by the EXISTING resolveTablePrivileges, not a new probe');
  ok((SRC.match(/async function resolveTablePrivileges/g) || []).length === 1,
     'there is still exactly ONE privilege probe in the app');
  // Read the ARRAY LITERAL, not a window of characters near it. The window
  // version passed under mutation P8, which moved the third probe OUT of the
  // Promise.all and made it sequential: the name was still within 400 chars.
  // Anchored on the SPECIFIC statement: resolveTablePrivileges has its own
  // inner Promise.all (holds(create), holds(write)) which comes first in the
  // file, and slicing from the first match read that one instead.
  const pa = SRC.slice(SRC.indexOf('const [ml, ds, ing] = await Promise.all(['));
  const arr = pa.slice(0, pa.indexOf(']);'));
  ['ENT_MAPLAYER', 'ENT_TRACTDATASET', 'ENT_TABLEDATA'].forEach(e => {
    ok(arr.indexOf(e) >= 0, 'inside the Promise.all array: ' + e);
  });
  ok((arr.match(/resolveTablePrivileges\(/g) || []).length === 3,
     'all THREE probes are in that one array: parallel, not a third round trip');
  ok(!/await resolveTablePrivileges\(/.test(pa.slice(pa.indexOf(']);'))),
     'and none was left to run sequentially after it');
  ok(/canOperateReportData\(\) \{ return ingestPrivs\.canWrite; \}/.test(SRC),
     'Report Data gates on WRITE, not Create');
  ok(/canOperateMapData\(\) \{ return mapPrivs\.canWrite \|\| dsPrivs\.canWrite; \}/.test(SRC),
     'Map Data is the union of its two tables, both on Write');
  ok(/return active\.canOperateReportData\(\) \|\| active\.canOperateMapData\(\);/.test(SRC),
     'and the SECTION is the union of the two pages');
  // fails closed
  ok(/const NO_PRIVS = \{ canCreate: false, canWrite: false, detected: false \};/.test(SRC),
     'the starting value denies');
  ok(/let ingestPrivs = NO_PRIVS;/.test(SRC), 'and the new flag starts there too');
  // probe-failed vs lacks-privilege: gated the same, logged differently
  ok(/could not be DETERMINED; treating as not-operable/.test(SRC),
     'a probe FAILURE is logged as a probe failure');
  ok(/user lacks Write on/.test(SRC), 'and a genuine lack is logged as a lack');
  ok(!/detected[\s\S]{0,80}canOperate/.test(SRC),
     'but neither predicate branches on `detected`: both states deny identically');
}

lines.push('');
lines.push('=== localStorage has no roles, so nothing is gated there ===');
{
  ok(/canOperateReportData\(\) \{ return true; \}/.test(SRC),
     'the localStorage backend reports operable');
  ok(/canOperateMapData\(\) \{ return true; \}/.test(SRC), 'for both pages');
  // this is the trap: canWriteLayers() is false on ls, and reusing it would
  // have hidden working pages from the only environment with no security model
  ok(/canWriteLayers\(\) \{ return false; \}/.test(SRC),
     'even though canWriteLayers() is false there, which is why a separate predicate exists');
}

lines.push('');
lines.push('=== the gate runs BEFORE the first render ===');
{
  const boot = SRC.slice(SRC.indexOf('async function boot'));
  const gi = boot.indexOf('applyOperatorGate();');
  const ri = boot.indexOf('onRouteChange();');
  const si = boot.indexOf('await Storage.init();');
  ok(gi > 0 && ri > 0 && si > 0, 'boot has all three steps');
  ok(si < gi, 'privileges are resolved (Storage.init awaits the probe) before the gate');
  ok(gi < ri, 'and the gate runs before the first render, so nothing flashes');
}

lines.push('');
lines.push('=== CLCPA-223 ruling 3: Edit map files is DELETED ===');
{
  ['emf', 'editmapfiles', 'edit-map-files', 'renderEditMapFiles',
   'wireEditMapFiles', '_emfEscHandler'].forEach(s => {
    ok(SRC.indexOf(s) < 0, 'app.js holds no "' + s + '"');
    ok(HTML.indexOf(s) < 0, 'the html holds no "' + s + '"');
  });
  ok(!/EDIT MAP FILES/.test(SRC), 'and its section banner is gone, not orphaned');
  ok(!/<style>/.test(HTML), 'the emf-only <style> block is gone from the html');
  // the stale policy comment that would have outlived it
  ok(!/Same policy as the\r?\n\s*\/\/ Edit map files page/.test(SRC),
     'the comment claiming it was HIDDEN rather than deleted is corrected');
  ok(/deleted in CLCPA-223/.test(SRC), 'and the surviving reference says so');

  // BASE controls: all of it really was there
  ok(BASE_SRC.indexOf('function renderEditMapFiles') >= 0,
     'BASE control: the page renderer existed');
  ok(BASE_SRC.indexOf('function wireEditMapFiles') >= 0, 'BASE control: and its wiring');
  ok(BASE_SRC.indexOf("path === '/edit-map-files'") >= 0,
     'BASE control: the route resolved, so a URL reached it');
  ok(BASE_HTML.indexOf('data-route="/edit-map-files"') >= 0,
     'BASE control: the hidden nav entry existed');
  ok(/<style>/.test(BASE_HTML), 'BASE control: the emf style block existed');

  // the STOP check, recorded: nothing live was cut
  const cutRegion = BASE_SRC.slice(BASE_SRC.indexOf('let _emfEscHandler'),
                                   BASE_SRC.indexOf('// MAP LAYERS PAGE'));
  ok(cutRegion.length > 4000, 'the deleted region was found in BASE to re-examine');
  ok(!/Storage\.|dvCreate|dvUpdate|dvDelete|fetch\(/.test(cutRegion),
     'STOP CHECK: it made no data call, so no capability was deleted');
  ok(/This panel is a visual mockup/.test(cutRegion),
     'STOP CHECK: its only control said so itself');
  ok(/<button class="btn" type="button" disabled>Upload<\/button>/.test(cutRegion),
     'STOP CHECK: and that button was disabled');
}

lines.push('');
lines.push('=== round 2: the card is CENTRED, without touching .content ===');
{
  const css = fs.readFileSync(path.join(REPO, CSS_REL), 'utf8');
  const h = views['Report Data'];
  ok(/<div class="gate-wrap"><div class="table-card gate-card">/.test(h),
     'the card is wrapped by .gate-wrap');
  // /<div /  misses the bare <div> in the page header, so the counts differed
  // by one and this failed on correct markup. Match either form.
  ok((h.match(/<\/div>/g) || []).length === (h.match(/<div[ >]/g) || []).length,
     'and the wrapper is closed: divs balance');
  const wrap = css.slice(css.indexOf('.gate-wrap {'), css.indexOf('.gate-card {'));
  ok(/display: flex;/.test(wrap) && /justify-content: center;/.test(wrap),
     'centred horizontally by the wrapper');
  ok(/align-items: center;/.test(wrap) && /min-height: 60vh;/.test(wrap),
     'and vertically inside its own 60vh of space');

  // THE POINT: .content is the scroll container for EVERY view. Centring by
  // changing it would re-lay-out the whole app, so it must be untouched.
  const contentNow = css.slice(css.indexOf('.content {'), css.indexOf('}', css.indexOf('.content {')) + 1);
  const contentPrev = PREV_CSS.slice(PREV_CSS.indexOf('.content {'),
    PREV_CSS.indexOf('}', PREV_CSS.indexOf('.content {')) + 1);
  ok(contentNow.length > 0 && contentNow === contentPrev,
     '.content is byte-identical to the deployed build: no shared rule was changed');
  ok(!/display: *flex/.test(contentNow), 'and it is still not a flex container');
  ok(BASE_CSS.indexOf('.gate-wrap') < 0 && PREV_CSS.indexOf('.gate-wrap') < 0,
     'PREV/BASE control: .gate-wrap is new, so the centring is this round');

  // ruling: the card CONTENT is unchanged. Only the box moved.
  ok(!/text-align/.test(css.slice(css.indexOf('.gate-wrap {'), css.indexOf('.gate-card a'))),
     'no text-align anywhere in the gate rules: the prose stays left-aligned');
  const prevView = PREV_SRC.slice(PREV_SRC.indexOf('function renderNotOperable'),
                                  PREV_SRC.indexOf('function renderCurrentView'));
  ['Not available for your account', 'ask your Dataverse',
   'Back to Executive Summary'].forEach(frag => {
    ok(h.indexOf(frag) >= 0 && prevView.indexOf(frag) >= 0,
       'card content unchanged from the deployed build: "' + frag.slice(0, 32) + '"');
  });
}

lines.push('');
lines.push('=== round 2: applyOperatorGate is on window.Dash ===');
{
  const dash = SRC.slice(SRC.indexOf('const Dash = {'), SRC.indexOf('window.Dash = Dash;'));
  ok(/^\s*applyOperatorGate,$/m.test(dash),
     'it is exported, so a hosted console runs the REAL gate');
  ok(!/^\s*applyOperatorGate,$/m.test(
       PREV_SRC.slice(PREV_SRC.indexOf('const Dash = {'), PREV_SRC.indexOf('window.Dash = Dash;'))),
     'PREV control: the deployed build did not expose it');
  // it can only HIDE: it reads Storage and sets .hidden, nothing else
  const fn = grab(SRC, 'applyOperatorGate');
  ok(!!fn && /group\.hidden = !ok;/.test(fn), 'its whole action is setting .hidden');
  ok(!/dvCreate|dvUpdate|dvDelete|fetch\(|innerHTML/.test(fn),
     'it writes no data and renders nothing, so exposing it adds no reach');
}

lines.push('');
lines.push('=== the not-available card is actually styled ===');
{
  const css = fs.readFileSync(path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css'), 'utf8');
  // .table-card has the tone and border but NO padding, so prose inside it
  // would sit flush against the border. .gate-card supplies it.
  ok(/.gate-card {/.test(css), '.gate-card exists, so the class in the markup is not dead');
  ok(/.gate-card {[^}]*padding:/.test(css), 'and it sets the padding .table-card does not');
  // Bounded by the rule's own closing brace. A fixed-width window ran past it
  // into .table-card-header, which DOES set padding, so the check read the
  // wrong rule and failed for the right reason.
  const tcAt = css.indexOf('.table-card {');
  const tc = css.slice(tcAt, css.indexOf('}', tcAt) + 1);
  ok(tc.length > 0 && !/padding:/.test(tc),
     'BASE fact: .table-card really has no padding of its own');
  ok(/.gate-card p {/.test(css) && /.gate-card h2 {/.test(css),
     'its prose and heading are sized, not left to browser defaults');
}

lines.push('');
lines.push('=== the sidebar, before and after (html) ===');
{
  ok(/<div id="nav-ingestion">/.test(HTML), 'the group has a container to hide');
  const grp = HTML.slice(HTML.indexOf('<div id="nav-ingestion">'),
                         HTML.indexOf('sidebar-foot'));
  ok(/sidebar-section">Data Ingestion</.test(grp), 'the LABEL is inside it');
  ok(/href="#\/ingest"/.test(grp) && /href="#\/maplayers"/.test(grp),
     'and both entries, so hiding it removes the whole group');
  ok((grp.match(/nav-item/g) || []).length === 2,
     'exactly two entries remain in the group: ' + (grp.match(/nav-item/g) || []).length);
  ok(!/<div id="nav-ingestion">/.test(BASE_HTML),
     'BASE control: there was no container before, which is why the html changed');
}

/* ---------- renders for the PR ------------------------------------------- */
fs.mkdirSync(OUT, { recursive: true });
const shell = (title, body) => '<!doctype html><meta charset="utf-8"><title>' + title +
  '</title><link rel="stylesheet" href="../../../ExecutiveDashboard_dev/styles.css">' +
  '<body style="background:#F2F2F2;padding:24px;">' +
  '<div style="font:600 12px system-ui;color:#666;margin-bottom:12px;">' + title + '</div>' +
  body + '</body>';

const sidebarOf = (html, hidden) => {
  const s = html.indexOf('<aside class="sidebar">');
  const e = html.indexOf('</aside>') + 8;
  let side = html.slice(s, e)
    .replace('<nav class="sidebar-nav" id="sidebar-sections"></nav>',
      '<nav class="sidebar-nav" id="sidebar-sections">' +
      ['A', 'B', 'C'].map(l => '<a class="nav-item" href="#"><span class="nav-letter">' + l +
        '</span> Reporting area ' + l + '</a>').join('') + '</nav>');
  if (hidden) side = side.replace('<div id="nav-ingestion">', '<div id="nav-ingestion" hidden>');
  return side;
};

fs.writeFileSync(path.join(OUT, 'sidebar-operator.html'),
  shell('Sidebar: OPERATOR (Data Ingestion present)', sidebarOf(HTML, false)));
fs.writeFileSync(path.join(OUT, 'sidebar-viewer.html'),
  shell('Sidebar: VIEWER (Data Ingestion hidden entirely)', sidebarOf(HTML, true)));
fs.writeFileSync(path.join(OUT, 'not-available-report-data.html'),
  shell('Direct route to #/ingest as a viewer', views['Report Data']));
fs.writeFileSync(path.join(OUT, 'not-available-map-data.html'),
  shell('Direct route to #/maplayers as a viewer', views['Map Data']));

lines.push('');
lines.push('renders written to ' + OUT + ':');
['sidebar-operator.html', 'sidebar-viewer.html',
 'not-available-report-data.html', 'not-available-map-data.html']
  .forEach(f => lines.push('   ' + f));

lines.push('');
lines.push('======================================================================');
lines.push('  ' + pass + ' passed, ' + fail + ' failed');
lines.push('======================================================================');
const out = lines.join('\n');
console.log(out);
fs.writeFileSync(path.join(__dirname, 'render-output.txt'), out + '\n');
process.exitCode = fail ? 1 : 0;
