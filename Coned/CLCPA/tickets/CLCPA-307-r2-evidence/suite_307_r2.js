/* CLCPA-307 round 2 acceptance: the button names itself once, and both
 * strings read it.
 *
 * The ruling: "the CLCPA-226 one-string rule extended to context: both
 * strings derive the button name from the same source that renders the
 * button label, never a literal; in the existing-year path the rejection
 * notice must also drop the 'will still add the year' promise (nothing is
 * added); sweep the bundle for any remaining 'Add New Year' / 'Add Year'
 * literals in operator-facing text."
 *
 * The rendered half is in repro_307_r2 (both paths, plus live typing). This
 * pins the source and the sentence, and the BASE side is pinned so the
 * suite cannot pass on the build that had the defect.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-307-r2-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || 'cb93541';
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  PASS  ' + m); } else { fail++; log('  FAIL  ' + m); } };
const guard = (label, fn) => {
  try { fn(); } catch (e) { fail++; log('  FAIL  ' + label + ' threw: ' + (e && e.message)); }
};

/* JS comments AND HTML ones: the markup is built in template literals that
 * carry HTML comment prose, and counting that prose as code made the sweep
 * in repro_307_r2 report three operator-facing literals where there are two. */
const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

function harness(src, want) {
  const L = src.split('\r\n');
  const TOP = [];
  L.forEach((ln, n) => {
    const m = /^ {2}(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (nm) => {
    const k = TOP.findIndex(d => d.name === nm);
    return k >= 0 ? L.slice(TOP[k].line, bound[k + 1]).join('\n') : null;
  };
  const parts = [], have = new Set();
  const add = (n) => {
    if (have.has(n)) return false;
    const f = find(n);
    if (!f) return false;
    have.add(n); parts.push(f); return true;
  };
  want.forEach(add);
  let api = null;
  const attempt = (call) => {
    for (let r = 0; r < 400; r++) {
      try {
        if (!api) {
          api = new Function(parts.join('\n\n') +
            '\n;return {' + want.filter(n => have.has(n)).join(',') + '};')();
        }
        return call(api);
      } catch (e) {
        const m = /(\w+) is not defined/.exec(String(e && e.message));
        if (m && add(m[1])) { api = null; continue; }
        throw e;
      }
    }
    throw new Error('assembly did not converge');
  };
  return { attempt, have };
}

const WANT = ['ingestStagedSummary', 'ingestPrimaryLabel', 'ingestRejectedStillDoes'];
const NEW = harness(SRC, WANT), OLD = harness(BASE_SRC, WANT);

/* a rejected plan, in the shape the dialog hands to the summary */
const REJECTED = { name: 'x.csv', dry: { ok: false, rejections: [{ why: 'A reason.' }] } };

log('CLCPA-307 round 2: one source for the button name, read by both strings');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ---- A. the one source --------------------------------------------- */
log('A. THE ONE SOURCE');
guard('A  structure', () => {
  const code = codeOnly(SRC);
  ok(/function ingestPrimaryLabel\(yearAlreadyExists\)/.test(code),
    'A1 ingestPrimaryLabel is declared');
  ok(/function ingestRejectedStillDoes\(yearAlreadyExists\)/.test(code),
    'A2 ingestRejectedStillDoes is declared');
  ok(/const primaryLabel = \(\) => ingestPrimaryLabel\(isExisting\(\)\);/.test(code),
    'A3 the dialogs button label reads it');
  ok(!/const primaryLabel = \(\) => \(isExisting\(\) \? 'Load Data' : 'Add Year'\);/
    .test(code), 'A4 and no longer carries the words itself');
  ok(/'it; it is imported when you press ' \+ primaryLabel\(\) \+ '\.'/.test(code),
    'A5 the help text derives the word from the same place');
  /* BOTH SITES, COUNTED. The first draw and the live refresh each call it,
   * and a global test of the pattern stayed green when one of the two was
   * removed -- mutation 6 found that, which is what mutation controls are
   * for. A count cannot be satisfied by the survivor. */
  const ctxCalls = (code.match(
    /ingestStagedSummary\(staged, \{ existing: isExisting\(\) \}\)/g) || []).length;
  ok(ctxCalls === 2, 'A6 both sites tell the summary which path it is on: ' +
    ctxCalls + ' of 2');
});

/* ---- B. the sentence, on each path --------------------------------- */
log('');
log('B. WHAT A REJECTED FILE SAYS, PER PATH');
guard('B  sentences', () => {
  const say = (H, ctx) => H.attempt(api => api.ingestStagedSummary(REJECTED, ctx));
  const existing = say(NEW, { existing: true });
  const fresh = say(NEW, { existing: false });
  log('    existing: ' + JSON.stringify(existing));
  log('    fresh   : ' + JSON.stringify(fresh));
  ok(/Load Data will still load the table-year/.test(existing),
    'B1 the existing path names the button that IS on screen');
  ok(!/add the year/.test(existing),
    'B2 and drops the promise to add a year, because nothing is added');
  ok(/Add Year will still add the year/.test(fresh),
    'B3 the fresh path is unchanged, where the words were already right');
  ok(!/Load Data/.test(fresh), 'B4 and does not name the other button');
  /* NO CONTEXT, NO CLAIM: a caller that cannot say which path it is on must
   * not have a button invented for it. */
  const blind = say(NEW, undefined);
  ok(blind.indexOf('A reason.') >= 0, 'B5 with no context the reason still shows');
  ok(!/Add Year|Load Data/.test(blind),
    'B6 and no button is named at all: ' + JSON.stringify(blind));
});

/* ---- C. the word comes from one function --------------------------- */
log('');
log('C. THE WORD ITSELF');
guard('C  label', () => {
  ok(NEW.attempt(api => api.ingestPrimaryLabel(true)) === 'Load Data',
    'C1 an existing year gives Load Data');
  ok(NEW.attempt(api => api.ingestPrimaryLabel(false)) === 'Add Year',
    'C2 a fresh one gives Add Year');
  ok(NEW.attempt(api => api.ingestRejectedStillDoes(true)) === 'load the table-year',
    'C3 and what the button will still do differs with it');
  ok(NEW.attempt(api => api.ingestRejectedStillDoes(false)) === 'add the year',
    'C4 on the other path');
});

/* ---- D. the guard has to fail on the build that had the defect ------ */
log('');
log('D. BASE ' + BASE + ', WHICH HAD THE DEFECT');
guard('D  base', () => {
  const was = OLD.attempt(api => api.ingestStagedSummary(REJECTED,
    { existing: true }));
  log('    BASE, existing path: ' + JSON.stringify(was));
  ok(/Add Year will still add the year/.test(was),
    'D1 BASE names Add Year on the existing path, where the button reads Load Data');
  ok(!/Load Data/.test(was), 'D2 and never names the button that is on screen');
  const code = codeOnly(BASE_SRC);
  ok(!/function ingestPrimaryLabel\(/.test(code),
    'D3 BASE has no single source for the word');
  ok(/'it; it is imported when you press Add Year\.'/.test(code),
    'D4 and the help text is a literal there');
});

/* ---- E. the sweep, and it counts CODE ------------------------------ */
log('');
log('E. THE SWEEP: NO OPERATOR-FACING LITERAL LEFT');
guard('E  sweep', () => {
  const code = codeOnly(SRC);
  const hits = code.split(/\r?\n/)
    .map((l, n) => ({ n: n + 1, l: l.trim() }))
    .filter(x => /Add Year|Add New Year/.test(x.l));
  hits.forEach(h => log('    ' + h.n + ': ' + h.l));
  /* the two that MAY carry the words: the one source, and the in-place
   * refresh that swaps one for the other as the year is typed */
  const allowed = hits.filter(h =>
    /return yearAlreadyExists \? 'Load Data' : 'Add Year';/.test(h.l) ||
    /press \(Add Year\|Load Data\)/.test(h.l));
  ok(hits.length === 2, 'E1 exactly two lines carry the words: ' + hits.length);
  ok(allowed.length === hits.length,
    'E2 and both are the source and its live refresh, not a message');
  /* the words must not appear in any other string handed to the operator */
  ok(!/'Add Year will still add the year/.test(code),
    'E3 the rejection sentence is no longer a literal');
  ok(!/press Add Year\.'/.test(code),
    'E4 nor is the help sentence');
});

/* ---- F. and they follow the year box, not just the first draw ------ */
log('');
log('F. THE STRINGS FOLLOW THE BOX AS IT IS TYPED');
guard('F  live refresh', () => {
  const code = codeOnly(SRC);
  const h = code.indexOf("yin.addEventListener('input'");
  const block = code.slice(h, h + 1400);
  ok(/btn\.textContent = primaryLabel\(\);/.test(block),
    'F1 the button is refreshed, as it already was');
  ok(/#ingest-import-note/.test(block),
    'F2 the help text is refreshed with it');
  ok(/#dlg-staged-summary/.test(block),
    'F3 and so is the staged summary, which carries the rejection sentence');
  ok(/ingestStagedSummary\(staged, \{ existing: isExisting\(\) \}\)/.test(block),
    'F4 through the same context the first draw used');
});

log('');
log(pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
