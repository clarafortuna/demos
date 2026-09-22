/* CLCPA-247 gate: the sweep that does not read my list.
 *
 * suite_247 checks that the fourteen surfaces named in surfaces.js were fixed.
 * That is a check against an inventory I wrote, and an inventory I wrote can
 * be short. This gate goes the other way: it FINDS every pointer-following
 * tooltip in the shipped bundle by reading the code, and fails on any it finds
 * that this ticket did not handle. A fifteenth surface I never noticed is a
 * failure here, not a silent pass.
 *
 * Three sweeps, all over the shipped app.js:
 *
 *   1. NO RAW POINTER POSITIONER SURVIVES. Any assignment placing a tooltip
 *      from e.pageX/e.pageY outside the one shared clamp is a surface that
 *      never got the flip and the slide.
 *   2. EVERY CONSUMER OF THE SHARED DIV IS REGISTERED. A function that opens
 *      .exec-tooltip must have all of its target selectors in OWNS_TIP, or the
 *      delegated handler will hide the box it just opened.
 *   3. EVERY TIP DIV THE BUNDLE CREATES IS ON THE HIDE LIST, so none can
 *      outlive the rows it describes.
 *
 * App code only. Nothing here reads or touches data.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { grab, functionsIn } = require('./extract.js');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'gate-247-output.txt');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  PASS  ' + m); } else { fail++; log('  FAIL  ' + m); } };
const guard = (label, fn) => {
  try { fn(); } catch (e) { fail++; log('  FAIL  ' + label + ' threw: ' + (e && e.message)); }
};
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

const CODE = codeOnly(SRC);
const FNS = functionsIn(SRC);

log('CLCPA-247 gate: every pointer-following tooltip in the bundle, found by reading it');
log('app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree') +
  '   ' + FNS.length + ' top-level functions read');
log('');

/* ---- 1. no raw pointer positioner survives -------------------------- */
log('1. RAW POINTER POSITIONERS');
guard('1  raw', () => {
  /* THE SWEEP IS RUN AGAINST BOTH BUILDS, and that is not decoration.
   *
   * The first version asserted that placeTooltipAtPointer is the one function
   * allowed to match this pattern, and failed: the clamp assigns from local
   * `left` and `top` variables, so it does not match a pattern about e.pageX
   * at all. A sweep that finds nothing anywhere looks identical to a sweep
   * that found nothing because it is broken, so the BASE build is swept too
   * and must yield the fourteen. That is the only thing that makes a count of
   * zero on the shipped build mean anything. */
  const sweep = (src) => {
    const hits = [];
    functionsIn(src).forEach((f) => {
      const body = codeOnly(f.body);
      const m = body.match(/\.style\.(?:left|top)\s*=\s*\([^)]*e\.page[XY][^)]*\)/g) || [];
      /* A SITE IS A PAIR OF LINES, left and top, so the line count is twice
       * the site count. The first version of 1.1 expected fourteen and got
       * twenty-eight, which is the sweep being right and my arithmetic being
       * wrong; both numbers are reported now so neither can be guessed at. */
      const sites = (body.match(/\.style\.left\s*=\s*\([^)]*e\.pageX[^)]*\)/g) || []).length;
      if (m.length) hits.push({ fn: f.name, n: m.length, sites, sample: m[0].slice(0, 54) });
    });
    return hits;
  };
  const CRLFify = (s) => s.replace(
    new RegExp(String.fromCharCode(92) + 'r?' + String.fromCharCode(92) + 'n', 'g'),
    String.fromCharCode(13) + String.fromCharCode(10));
  const BASE = process.env.DAC_BASE_COMMIT || 'd880c0b';
  const baseSrc = CRLFify(execSync(
    'git show ' + BASE + ':"Coned/CLCPA/ExecutiveDashboard_dev/app.js"',
    { cwd: ROOT, maxBuffer: 1 << 29 }).toString('utf8'));

  const baseHits = sweep(baseSrc), hits = sweep(SRC);
  const lines_ = (h) => h.reduce((n, x) => n + x.n, 0);
  const sites_ = (h) => h.reduce((n, x) => n + x.sites, 0);
  baseHits.forEach(h => log('    BASE  ' + h.fn.padEnd(24) + h.sites + ' site(s), ' +
    h.n + ' line(s)   ' + h.sample));
  hits.forEach(h => log('    NOW   ' + h.fn.padEnd(24) + h.sites + ' site(s), ' +
    h.n + ' line(s)   ' + h.sample));
  ok(sites_(baseHits) === 14 && lines_(baseHits) === 28,
    '1.1 the sweep finds all fourteen sites in BASE ' + BASE + ', so it works: ' +
    sites_(baseHits) + ' sites / ' + lines_(baseHits) + ' lines in ' +
    baseHits.length + ' function(s)');
  ok(lines_(hits) === 0,
    '1.2 and not one line of it survives in the shipped build: ' + lines_(hits) + ' ' +
    JSON.stringify(hits.map(h => h.fn)));
});

/* ---- 2. every consumer of the shared div is registered -------------- */
log('');
log('2. THE SHARED DIV AND ITS SURFACES');
guard('2  registered', () => {
  const wc = grab('wireControlTips', SRC);
  const decl = /const OWNS_TIP = ([\s\S]*?);\r\n/.exec(wc);
  ok(!!decl, '2.1 OWNS_TIP is declared');
  if (!decl) return;
  const owns = new Function('return ' + codeOnly(decl[1]).replace(/\r\n/g, ' ') + ';')()
    .split(',').map(s => s.trim()).filter(Boolean);
  log('    OWNS_TIP carries ' + owns.length + ' selectors');

  /* WHO OPENS THE SHARED DIV: a function that calls ensureTooltip() and then
   * shows it. wireControlTips is the handler itself and is excluded by name,
   * with the reason stated rather than assumed: it is the thing doing the
   * hiding, and its own controls are matched by [data-tip], not by this list. */
  const consumers = FNS.filter(f => f.name !== 'wireControlTips' &&
    /ensureTooltip\(\)/.test(codeOnly(f.body)) &&
    /\.style\.opacity = '1'/.test(codeOnly(f.body)));
  log('    functions that open the shared div: ' +
    consumers.map(c => c.name).join(', '));
  ok(consumers.length > 0, '2.2 the sweep found some, so it is reading the file');

  const unregistered = [];
  consumers.forEach((f) => {
    const body = codeOnly(f.body);
    const sels = [...new Set(
      (body.match(/querySelectorAll\((['"`])([^'"`]+)\1\)/g) || [])
        .map(m => m.replace(/querySelectorAll\((['"`])([^'"`]+)\1\)/, '$2')))];
    const ids = [...new Set(
      (body.match(/getElementById\((['"`])([^'"`]+)\1\)/g) || [])
        .map(m => '#' + m.replace(/getElementById\((['"`])([^'"`]+)\1\)/, '$2')))];
    [...sels, ...ids].forEach((sel) => {
      /* a comma-separated target list is registered when each of its terms is */
      const terms = sel.split(',').map(t => t.trim()).filter(Boolean);
      terms.forEach((t) => {
        /* COVERAGE IS DECIDED THE WAY closest() DECIDES IT, on the element the
         * selector ends at.
         *
         * The first version compared whole strings and reported
         * `#exec-header-cards .ai-header-card` as unregistered while
         * `.ai-header-card` was registered and does match those elements.
         * That is a false alarm from a rule that did not understand a
         * descendant selector: only the LAST compound names the element the
         * pointer is over, so that is what is compared -- and a registration
         * may be less specific than the target, since `.d-bar-metric` covers
         * `.d-bar-metric[data-table="F2"]`. */
        const tail = (sel) => sel.trim().split(/\s+/).pop();
        const target = tail(t);
        const covered = owns.some((o) => {
          const reg = tail(o);
          return target === reg || target.indexOf(reg) === 0;
        });
        if (!covered) unregistered.push(f.name + ' -> ' + t);
      });
    });
  });
  unregistered.forEach(u => log('    UNREGISTERED  ' + u));
  ok(unregistered.length === 0,
    '2.3 every target of every shared-div consumer is registered in OWNS_TIP: ' +
    unregistered.length + ' unregistered');
});

/* ---- 3. every tip div the bundle creates is hidden on re-render ----- */
log('');
log('3. THE HIDE LIST');
guard('3  hide', () => {
  const decl = /const POINTER_TIP_SELECTORS = ([\s\S]*?);\r\n/.exec(SRC);
  ok(!!decl, '3.1 the build declares one hide list');
  if (!decl) return;
  const list = new Function('return ' + decl[1].replace(/\r\n/g, ' ') + ';')();
  /* FOUND BY READING THE BUNDLE, not by reading the list: every div the code
   * creates and then positions from the pointer. */
  const created = [...new Set((CODE.match(/tip\.className = '([a-z0-9-]+)'/g) || [])
    .map(m => '.' + m.replace(/.*'([a-z0-9-]+)'.*/, '$1')))];
  log('    tip divs created by the bundle: ' + JSON.stringify(created));
  log('    hide list:                      ' + JSON.stringify(list));
  const missing = created.filter(c => list.indexOf(c) < 0);
  ok(missing.length === 0,
    '3.2 every one of them is on the hide list: ' + JSON.stringify(missing));
  const phantom = list.filter(c => created.indexOf(c) < 0);
  ok(phantom.length === 0,
    '3.3 and the list names nothing the bundle does not create: ' + JSON.stringify(phantom));

  /* AND BOTH RENDER PATHS CALL IT. A list nothing calls is decoration. */
  ['wireExecutiveInteractions', 'wireSectionInteractions'].forEach((fn, i) => {
    const b = grab(fn, SRC);
    ok(!!b && /hideExecTooltip\(\);/.test(codeOnly(b)),
      '3.4.' + i + ' ' + fn + ' hides everything before it wires anything');
  });
});

log('');
log(pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
