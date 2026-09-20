/* CLCPA-310, and the part of CLCPA-309 that is unambiguous: the fraction
 * advisory formats the value it shows.
 *
 * The advisory is built as `read + " read as " + landed`, and `landed` was the
 * bare result of dividing by 100, concatenated with no formatter between the
 * division and the operator's eye. Measured over twenty percent strings a
 * preparer plausibly types, EIGHT printed an artifact:
 *
 *     9.3%   read as 0.09300000000000001
 *     0.7%   read as 0.006999999999999999
 *     99.99% read as 0.9998999999999999
 *
 * WHAT THIS DOES NOT SETTLE. CLCPA-309 is described as "the fraction advisory
 * reporting a conversion result". This build makes that result READABLE; it
 * does not stop the advisory reporting the fraction, because whether it should
 * report the fraction at all is a question the ticket body would answer and
 * the body is not in this repo. Stated here rather than quietly treated as
 * done, and raised in the combined report with the other open questions.
 *
 * Pins: DAC_BASE_COMMIT, DAC_APP_OVERRIDE.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-309-310-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || 'd84c0d3';
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const say = (s) => log(s);
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => {
  try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); }
};
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

function harness(src, want) {
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
          api = new Function('PAYLOAD', 'const state = { payload: PAYLOAD };\n' +
            parts.join('\n\n') +
            '\n;return {' + want.filter(n => have.has(n)).join(',') + '};')(P);
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
  return { attempt };
}

const NEW = harness(SRC, ['parseNumericInput', 'unitNoticeValue']);
const OLD = harness(BASE_SRC, ['parseNumericInput']);

/* the percent strings a preparer plausibly types, including ones taken from
 * this payload's own stored figures */
const INPUTS = ['10%', '45%', '5%', '9.3%', '3.7%', '5.9%', '32.4%', '0.7%',
  '1.1%', '2.9%', '7.3%', '8.2%', '29%', '33%', '58%', '62.5%', '100%',
  '0.05%', '12.34%', '99.99%'];
const isArtifact = (s) => /\.\d{8,}/.test(s) ||
  /(00000|99999)\d*$/.test(String(s).replace(/^0\./, ''));

log('CLCPA-310: the fraction advisory formats the value it shows');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ===================== A: the artifacts are gone ======================= */
say('=== A. what the operator reads =====================================');
guard('A: no artifact survives', () => {
  const badNow = [], badBefore = [];
  INPUTS.forEach((raw) => {
    const landed = NEW.attempt(api => api.parseNumericInput(raw));
    const shown = NEW.attempt(api => api.unitNoticeValue(raw, landed));
    if (isArtifact(shown)) badNow.push(raw + ' -> ' + shown);
    const was = OLD.attempt(api => String(api.parseNumericInput(raw)));
    if (isArtifact(was)) badBefore.push(raw + ' -> ' + was);
  });
  ok(badNow.length === 0,
     'A1 not one of the ' + INPUTS.length + ' percent strings shows an artifact: ' +
     JSON.stringify(badNow));
  ok(badBefore.length === 8,
     'A2 while BASE showed one on eight of them, which is the measurement ' +
     'this ticket comes from: ' + badBefore.length);
  ok(badBefore.some(x => /^9\.3%/.test(x)),
     'A3 including "9.3%", the value D3 actually files: ' +
     JSON.stringify(badBefore.filter(x => /^9\.3%/.test(x))));
});

/* ===================== B: it is exact ================================== */
say('');
say('=== B. the number shown is the number that landed ===================');
guard('B: precision comes from what was typed', () => {
  const cases = [['10%', '0.1'], ['9.3%', '0.093'], ['0.7%', '0.007'],
    ['12.34%', '0.1234'], ['99.99%', '0.9999'], ['100%', '1'], ['0.05%', '0.0005']];
  const wrong = [];
  cases.forEach(([raw, want]) => {
    const landed = NEW.attempt(api => api.parseNumericInput(raw));
    const shown = NEW.attempt(api => api.unitNoticeValue(raw, landed));
    if (shown !== want) wrong.push(raw + ' -> ' + shown + ', wanted ' + want);
  });
  ok(wrong.length === 0,
     'B1 a percentage written to N decimals reads back as a fraction to N+2, ' +
     'exactly: ' + JSON.stringify(wrong));
  /* and the shown value must still BE the value, to the precision shown */
  const off = [];
  INPUTS.forEach((raw) => {
    const landed = NEW.attempt(api => api.parseNumericInput(raw));
    const shown = Number(NEW.attempt(api => api.unitNoticeValue(raw, landed)));
    if (Math.abs(shown - landed) > 1e-9) off.push(raw + ': ' + shown + ' vs ' + landed);
  });
  ok(off.length === 0,
     'B2 and it never differs from the stored figure by more than rounding: ' +
     JSON.stringify(off));
  /* a non-number is shown as itself, so a text residual is not hidden */
  ok(NEW.attempt(api => api.unitNoticeValue('abc', 'abc')) === 'abc',
     'B3 a value that is not a finite number is shown as it is');
});

/* ===================== C: the stored value is untouched ================ */
say('');
say('=== C. this formats the sentence, not the figure ====================');
guard('C: parseNumericInput is byte-identical', () => {
  const grab = (src) => {
    const i = src.indexOf('function parseNumericInput(');
    return i < 0 ? null : src.slice(i, src.indexOf('\r\n  }', i));
  };
  ok(grab(SRC) === grab(BASE_SRC),
     'C1 parseNumericInput is byte-identical to BASE: the value that LANDS ' +
     'is not changed by this ticket');
  const moved = [];
  INPUTS.forEach((raw) => {
    const a = OLD.attempt(api => api.parseNumericInput(raw));
    const b = NEW.attempt(api => api.parseNumericInput(raw));
    if (a !== b) moved.push(raw);
  });
  ok(moved.length === 0, 'C2 and every one of them parses to the same number: ' +
     JSON.stringify(moved));
});

/* ===================== D: both surfaces =============================== */
say('');
say('=== D. both surfaces that render this sentence ======================');
guard('D: the CLCPA-271 lesson', () => {
  const code = codeOnly(SRC);
  const calls = (code.match(/unitNoticeValue\(x\.read, x\.landed\)/g) || []).length;
  ok(calls === 2,
     'D1 the formatter is called on BOTH surfaces, the typed-cell notice and ' +
     'the import panel: ' + calls);
  ok(!/read as ' \+ x\.landed/.test(code),
     'D2 and neither of them concatenates the raw value any more');
  const oldCode = codeOnly(BASE_SRC);
  ok((oldCode.match(/read as ' \+ x\.landed/g) || []).length === 2,
     'D3 while BASE concatenated it raw on both, so this suite cannot pass on it');
});

/* ===================== X: the baseline ================================ */
say('');
say('=== X. the baseline =================================================');
guard('X: pins', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X1 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: ROOT }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'X2 and HEAD descends from it');
  ok(codeOnly(BASE_SRC).indexOf('unitNoticeValue') < 0,
     'X3 while BASE has no such formatter at all');
});

say('');
log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
if (fail) process.exit(1);
