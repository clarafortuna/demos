/* CLCPA-307: the generated workbook instructions name controls that have been
 * renamed.
 *
 * CLCPA-226 set the rule this rests on: a control has ONE name. CLCPA-234
 * renamed the page button from "Add New Year" to "Add Data" precisely so the
 * button and the dialog it opens would agree -- and the workbook's step 4,
 * which is generated text an operator reads while looking at that button, was
 * not moved with it.
 *
 * THE CONTROL NAMES ARE READ OUT OF app.js BY ELEMENT ID, never retyped here.
 * A probe that hardcodes "Add Data" proves only that I typed it twice.
 *
 * The first cut of this pattern-matched verbs against the prose and was junk:
 * it reported "File" and "CSV UTF" as missing controls (they are Excel's own
 * menus) and never noticed "Add New Year" at all, because that phrase does not
 * follow a verb. The reliable question is narrower and exact -- step 4 names
 * three controls and a page, so read what those are CALLED and check the text
 * uses those names.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'probe-307-names-output.txt');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
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

const H = harness(SRC, ['xlsxInstructionBlocks']);
const code = codeOnly(SRC);

/** the visible text of <button id="…">…</button>, template bits stripped */
function labelOfId(id) {
  const re = new RegExp('<button[^>]*id="' + id + '"[^>]*>([^<]*)<');
  const m = re.exec(code);
  return m ? m[1].replace(/\$\{[^}]*\}/g, '').trim() : null;
}
/** the text of the <label class="btn …"> that wraps a hidden file input */
function labelWrapping(id) {
  const i = code.indexOf('id="' + id + '"');
  if (i < 0) return null;
  const before = code.slice(Math.max(0, i - 400), i);
  const m = /<label[^>]*>([\s\S]*)$/.exec(before);
  if (!m) return null;
  /* CUT AT THE FIRST `<`. Stripping tags with <[^>]*> leaves an UNTERMINATED
   * one behind -- the hidden <input type="file" that this label wraps -- and
   * it rode along into the name, which then matched nothing and reported a
   * control as misnamed when step 4 names it correctly. */
  return m[1].replace(/'\s*\+\s*'/g, '').replace(/\r\n\s*/g, '')
    .replace(/\$\{[^}]*\}/g, '').split('<')[0].trim();
}
function h1Text(t) {
  const m = new RegExp('<h1>(' + t + ')</h1>').exec(code);
  return m ? m[1] : null;
}

const CONTROLS = [
  { what: 'the page button that opens the dialog', name: labelOfId('ingest-addyear') },
  { what: 'the file control inside the dialog', name: labelWrapping('ingest-file') },
  { what: 'the button that commits the draft', name: labelOfId('ingest-save') },
  { what: 'the page itself', name: h1Text('Report Data') },
];

log('CLCPA-307: does the generated workbook name the controls as they read?');
log('app.js: ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');
log('  the controls step 4 sends the operator to, named as app.js names them:');
CONTROLS.forEach(c => log('    ' + String(c.what).padEnd(42) + JSON.stringify(c.name)));
log('');

const blocks = H.attempt(api => api.xlsxInstructionBlocks('Table B2. Plugs', '2025'));
const text = blocks.map(b => b.text).filter(Boolean).join('\n');
const step4 = (text.split('\n').find(l => /^4\./.test(l.trim())) || '').trim();
log('  step 4 as generated:');
log('    ' + JSON.stringify(step4));
log('');

let bad = 0;
log('  does step 4 use each control\'s real name?');
CONTROLS.forEach((c) => {
  if (!c.name) { log('    ' + String(c.what).padEnd(42) + 'LABEL NOT FOUND IN SOURCE'); bad++; return; }
  const hit = step4.indexOf(c.name) >= 0;
  if (!hit) bad++;
  log('    ' + JSON.stringify(c.name).padEnd(20) +
      (hit ? 'used' : 'NOT USED  -- step 4 calls it something else'));
});

const stale = step4.indexOf('Add New Year') >= 0;
log('');
log('  step 4 still says "Add New Year": ' + stale +
    (stale ? '   (CLCPA-234 renamed that button to ' +
      JSON.stringify(labelOfId('ingest-addyear')) + ')' : ''));

log('');
log('--- summary -----------------------------------------------------------');
log('  controls step 4 names wrongly or not at all: ' + bad);
if (bad) {
  log('');
  log('  CLCPA-226 is the rule this breaks: a control has ONE name. Text the');
  log('  app GENERATES for an operator, telling them to press something that');
  log('  is not on the screen, is the same defect as two buttons sharing a');
  log('  name. It just happens in a file rather than in the page.');
}

fs.writeFileSync(OUT, lines.join('\n') + '\n');
