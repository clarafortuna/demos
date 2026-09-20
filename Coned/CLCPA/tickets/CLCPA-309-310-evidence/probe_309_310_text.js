/* CLCPA-309 and CLCPA-310, measured together because they are the same
 * sentence.
 *
 *   309: the fraction advisory reports a CONVERSION RESULT.
 *   310: raw floating-point artifacts reach operator-facing text.
 *
 * The advisory reads "<cell>: <read> read as <landed>". On the shipped build
 * `landed` was whatever parseNumericInput returned, printed by string
 * concatenation with no formatter anywhere between the division and the
 * operator's eye, and eight of the twenty strings below printed an artifact.
 *
 * This runs the app's own parseNumericInput over the percent strings a
 * preparer actually types, and shows the value through unitNoticeValue, which
 * is what the advisory now renders. Run it with DAC_APP_OVERRIDE pointing at a
 * pre-CLCPA-310 app.js and the artifacts come back, which is the comparison
 * the suite pins.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'probe-309-310-text-output.txt');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

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

const H = harness(SRC, ['parseNumericInput', 'isPercentLiteral', 'unitNoticeValue']);

log('CLCPA-309 / CLCPA-310: the sentence the fraction advisory builds');
log('app.js: ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');
log('  The advisory line is built as:');
log('      cell + ": " + x.read + " read as " + unitNoticeValue(x.read, x.landed)');
log('  with x.landed = parseNumericInput(raw), formatted for the sentence.');
log('');

/* percent strings a preparer plausibly types, including the ones that came
 * out of this payload's own stored figures */
const INPUTS = ['10%', '45%', '5%', '9.3%', '3.7%', '5.9%', '32.4%', '0.7%',
  '1.1%', '2.9%', '7.3%', '8.2%', '29%', '33%', '58%', '62.5%', '100%',
  '0.05%', '12.34%', '99.99%'];

let ugly = 0;
log('  typed        lands as                      the operator reads');
log('  ' + '-'.repeat(68));
INPUTS.forEach((raw) => {
  const landed = H.attempt(api => api.parseNumericInput(raw));
  const shownVal = H.attempt(api => (api.unitNoticeValue ? api.unitNoticeValue(raw, landed) : String(landed)));
  const shown = 'Total / % in DAC: ' + raw + ' read as ' + landed;
  /* an artifact is a decimal expansion no human typed: more than a few
   * places, or the tell-tale run of 0s or 9s */
  const s = String(shownVal);
  const bad = /\.\d{8,}/.test(s) || /(00000|99999)\d*$/.test(s.replace(/^0\./, ''));
  if (bad) ugly++;
  log('  ' + raw.padEnd(12) + s.padEnd(30) + (bad ? 'ARTIFACT  ' : '          ') +
      (bad ? shown : ''));
});

log('');
log('--- summary -----------------------------------------------------------');
log('  percent strings tried: ' + INPUTS.length);
log('  of those, ones whose advisory line carries a floating-point artifact: ' + ugly);
log('');
log('  CLCPA-309 is the other half of the same line. "read as 0.093" reports');
log('  the CONVERSION RESULT -- the fraction the engine stored -- to an');
log('  operator who typed a percentage and thinks in percentages. The number');
log('  is correct and it answers a question nobody asked.');

fs.writeFileSync(OUT, lines.join('\n') + '\n');
