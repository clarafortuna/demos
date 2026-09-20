/* CLCPA-307: the generated workbook names controls as they read on screen.
 *
 * Step 4 said "Add New Year" and "press Save". CLCPA-234 renamed the page
 * button to "Add Data" so that it and the dialog it opens would stop having
 * two names, and the button that commits a draft has read "Save Changes"
 * throughout. Generated text telling an operator to press something that is
 * not on the screen breaks CLCPA-226's one-name rule exactly as two buttons
 * sharing a name would.
 *
 * EVERY NAME IS READ OUT OF app.js BY ELEMENT ID. A suite that hardcodes
 * "Add Data" asserts only that I typed it twice, and would go stale silently
 * the next time a button is renamed -- which is the very thing that happened
 * here.
 *
 * Pins: DAC_BASE_COMMIT, DAC_APP_OVERRIDE.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-307-output.txt');

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

function names(src) {
  const code = codeOnly(src);
  const byId = (id) => {
    const m = new RegExp('<button[^>]*id="' + id + '"[^>]*>([^<]*)<').exec(code);
    return m ? m[1].replace(/\$\{[^}]*\}/g, '').trim() : null;
  };
  const wrapping = (id) => {
    const i = code.indexOf('id="' + id + '"');
    if (i < 0) return null;
    const m = /<label[^>]*>([\s\S]*)$/.exec(code.slice(Math.max(0, i - 400), i));
    if (!m) return null;
    /* cut at the first `<`: the hidden input this label wraps is an
     * UNTERMINATED tag, and a <[^>]*> strip leaves it in the name */
    return m[1].replace(/'\s*\+\s*'/g, '').replace(/\r\n\s*/g, '')
      .replace(/\$\{[^}]*\}/g, '').split('<')[0].trim();
  };
  const h1 = (t) => {
    const m = new RegExp('<h1>(' + t + ')</h1>').exec(code);
    return m ? m[1] : null;
  };
  return {
    addData: byId('ingest-addyear'),
    importFile: wrapping('ingest-file'),
    save: byId('ingest-save'),
    page: h1('Report Data'),
  };
}

function step4Of(src) {
  const H = harness(src, ['xlsxInstructionBlocks']);
  const blocks = H.attempt(api => api.xlsxInstructionBlocks('Table B2. Plugs', '2025'));
  const text = blocks.map(b => b.text).filter(Boolean).join('\n');
  return { all: text, step4: (text.split('\n').find(l => /^4\./.test(l.trim())) || '').trim() };
}

log('CLCPA-307: the workbook names the controls as they read');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ===================== N: the names ==================================== */
say('=== N. every control step 4 sends the operator to ===================');
guard('N: names match', () => {
  const n = names(SRC);
  const { step4 } = step4Of(SRC);
  ok(n.addData && n.importFile && n.save && n.page,
     'N1 all four control names were read out of app.js: ' + JSON.stringify(n));
  ok(step4.indexOf(n.addData) >= 0,
     'N2 step 4 names the page button as it reads, ' + JSON.stringify(n.addData));
  ok(step4.indexOf(n.importFile) >= 0,
     'N3 and the file control, ' + JSON.stringify(n.importFile));
  ok(step4.indexOf(n.save) >= 0,
     'N4 and the button that commits the draft, ' + JSON.stringify(n.save));
  ok(step4.indexOf(n.page) >= 0,
     'N5 and the page itself, ' + JSON.stringify(n.page));
  ok(step4.indexOf('Add New Year') < 0,
     'N6 and the retired name is gone: ' + JSON.stringify(step4));
});

/* ===================== B: it really was wrong ========================== */
say('');
say('=== B. and BASE had it wrong, so this cannot pass by accident =======');
guard('B: the baseline', () => {
  const nb = names(BASE_SRC);
  const { step4 } = step4Of(BASE_SRC);
  ok(nb.addData === 'Add Data',
     'B1 BASE already called the button ' + JSON.stringify(nb.addData) +
     ', so the button and the workbook disagreed on the shipped build');
  ok(step4.indexOf('Add New Year') >= 0,
     'B2 while BASEs step 4 said "Add New Year"');
  ok(step4.indexOf(nb.save) < 0,
     'B3 and did not use ' + JSON.stringify(nb.save) + ' either');
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'B4 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: ROOT }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'B5 and HEAD descends from it');
});

/* ===================== X: nothing else moved ========================== */
say('');
say('=== X. the rest of the workbook text is untouched ===================');
guard('X: blast radius', () => {
  const now = step4Of(SRC).all.split('\n');
  const was = step4Of(BASE_SRC).all.split('\n');
  ok(now.length === was.length,
     'X1 the instruction sheet still has the same number of blocks: ' +
     now.length + ' and ' + was.length);
  const moved = now.filter((l, i) => l !== was[i]);
  ok(moved.length === 1,
     'X2 and exactly ONE block changed: ' + moved.length);
  ok(moved.length === 1 && /^4\./.test(moved[0].trim()),
     'X3 and it is step 4: ' + JSON.stringify(moved[0] || '').slice(0, 70));
  /* no long dashes anywhere in the generated text, which is a standing rule */
  ok(!/—|–/.test(step4Of(SRC).all),
     'X4 and no long dash entered the operator-facing text');
});

say('');
log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
if (fail) process.exit(1);
