/* Acceptance: the "Coming soon" placeholder is retired from the DAC Tracts
 * map's Customer Counts panel, and nothing else in the panel moves.
 *
 * The rendered halves are in repro_coming_soon (both panels painted in
 * Chrome under the app's own stylesheet, with the gaps measured). This pins
 * the source, the CSS, and the panel the shipped function produces from the
 * real map payload.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSSREL = 'Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-coming-soon-output.txt');
const CRLF = String.fromCharCode(13) + String.fromCharCode(10);

const BASE = process.env.DAC_BASE_COMMIT || 'facc1bc';
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(DEV, 'styles.css'), 'utf8');
const show = (rel) => execSync('git show ' + BASE + ':"' + rel + '"',
  { cwd: ROOT, maxBuffer: 1e9 }).toString('utf8')
  .replace(new RegExp(String.fromCharCode(92) + 'r?' + String.fromCharCode(92) + 'n', 'g'), CRLF);
const BASE_SRC = show(REL), BASE_CSS = show(CSSREL);

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  PASS  ' + m); } else { fail++; log('  FAIL  ' + m); } };
const guard = (label, fn) => {
  try { fn(); } catch (e) { fail++; log('  FAIL  ' + label + ' threw: ' + (e && e.message)); }
};
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '').replace(/^[ \t]*\/\/.*$/gm, '');

log('The DAC map Customer Counts panel: the placeholder is retired');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ---- A. the markup is gone, and BASE had it ------------------------- */
log('A. THE SOURCE');
guard('A  markup', () => {
  const code = codeOnly(SRC), was = codeOnly(BASE_SRC);
  ok(/dac-kpi-card-placeholder/.test(was),
    'A1 BASE ' + BASE + ' carried the placeholder card');
  ok(/Coming soon/.test(was.slice(was.indexOf('function renderMapKPI'),
    was.indexOf('function renderMapKPI') + 12000)),
  'A2 and it read "Coming soon" inside renderMapKPI');
  ok(!/dac-kpi-card-placeholder/.test(code),
    'A3 the card is gone from the shipped code');
  const fn = code.slice(code.indexOf('function renderMapKPI'),
    code.indexOf('function renderMapKPI') + 12000);
  ok(!/Coming soon/i.test(fn),
    'A4 and renderMapKPI carries no "Coming soon" anywhere');
  /* it was MARKUP, not data or schema: nothing outside this function fed it */
  ok(!/placeholder/i.test(fn), 'A5 nor any other placeholder in that panel');
});

/* ---- B. the CSS went with it --------------------------------------- */
log('');
log('B. THE DEAD STYLE WENT WITH IT');
guard('B  css', () => {
  ok(/\.dac-kpi-card-placeholder\s*\{/.test(BASE_CSS),
    'B1 BASE styled the placeholder card');
  ok(/\.dac-kpi-label-placeholder\s*\{/.test(BASE_CSS),
    'B2 and its label');
  ok(!/\.dac-kpi-card-placeholder\s*\{/.test(CSS),
    'B3 the card rule is gone');
  ok(!/\.dac-kpi-label-placeholder\s*\{/.test(CSS),
    'B4 and the label rule is gone');
  /* and neither selector is used anywhere else, which is why removing them
   * is safe rather than merely tidy */
  ok(!/dac-kpi-card-placeholder|dac-kpi-label-placeholder/.test(codeOnly(SRC)),
    'B5 and no markup anywhere still asks for those classes');
});

/* ---- C. the panel the shipped function produces --------------------- */
log('');
log('C. THE PANEL, RENDERED FROM THE REAL MAP PAYLOAD');
guard('C  rendered', () => {
  /* RENDERED FROM THE BUILD UNDER TEST, not read from a file.
   *
   * This block used to read panel-before.html and panel-after.html off disk,
   * and mutation 1 proved what that was worth: putting the placeholder card
   * back into app.js left C1 and C2 green, because no change to the source
   * can move a file somebody generated earlier. The renderer is imported and
   * driven against SRC and BASE_SRC here; the two files remain as evidence
   * artifacts, which is all they ever should have been. */
  const R = require('./render_panel.js');
  const after = R.renderWith(SRC);
  const before = R.renderWith(BASE_SRC);
  const cards = (s) => (s.match(/class="dac-kpi-card[^"]*"/g) || []);
  /* the trailing "<" is part of the match, not part of the value: leaving it
   * on made C3's identity check pass while every literal check failed on a
   * character the panel does not contain */
  const values = (s) => (s.match(/class="dac-kpi-bd-v[^"]*">([^<]*)</g) || [])
    .map(m => m.replace(/.*>/, '').replace(/<$/, ''));
  log('    cards  before ' + cards(before).length + '  after ' + cards(after).length);
  log('    values before ' + JSON.stringify(values(before)));
  log('    values after  ' + JSON.stringify(values(after)));
  ok(cards(before).length - cards(after).length === 1,
    'C1 exactly one card fewer: ' + cards(before).length + ' -> ' + cards(after).length);
  ok(/Coming soon/i.test(before) && !/Coming soon/i.test(after),
    'C2 and it is the placeholder that went');
  ok(JSON.stringify(values(before)) === JSON.stringify(values(after)),
    'C3 every value cell is identical');
  ['1.82M', '2.15M', '383K', '170K'].forEach((v, i) => {
    ok(values(after).indexOf(v) >= 0, 'C' + (4 + i) + ' the panel still reads ' + v);
  });
  /* the remaining markup is the BEFORE markup with exactly that card cut out */
  const cut = before.replace(
    /<div class="dac-kpi-card dac-kpi-card-placeholder">[\s\S]*?<\/div>/, '');
  ok(cut === after,
    'C8 and the rest of the panel is byte-identical to BASE with the card removed');
});

/* ---- D. the sweep: no other OPERATOR-FACING placeholder ------------- */
log('');
log('D. THE SWEEP');
guard('D  sweep', () => {
  const code = codeOnly(SRC);
  const hits = [];
  code.split(CRLF).forEach((l, n) => {
    if (/Coming soon/i.test(l)) hits.push({ n: n + 1, l: l.trim().slice(0, 80) });
  });
  hits.forEach(h => log('    ' + h.n + ': ' + h.l));
  ok(hits.length === 1,
    'D1 exactly one "Coming soon" remains in the bundle: ' + hits.length);
  /* and it is DEAD: declared into a variable that is never interpolated */
  ok(/const placeholder = /.test(code),
    'D2 it is the Section D `const placeholder`, assigned to a variable');
  const used = (code.match(/\$\{placeholder\}/g) || []).length;
  ok(used === 0,
    'D3 which is never interpolated, so it reaches no operator: ' + used + ' use(s)');
  log('    -> reported to the owner rather than removed: it is dead code, not');
  log('       an operator-facing placeholder, and removing it is its own change.');
});

log('');
log(pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
