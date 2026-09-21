/* CLCPA-310 round 2 acceptance: a near-zero percentage reads as small, not
 * as absent, on both surfaces, by one stated rule.
 *
 * THE RULE, as the PR states it: a non-zero percentage that would render as
 * all zeros at the precision in force renders as "<" plus the smallest
 * magnitude that precision can show -- "<0.1%" at one decimal, "<0.01%" at
 * two -- and a negative near-zero mirrors to ">-0.1%". The threshold is
 * 10^-decimals, derived from the declared precision, never a constant.
 *
 * The rendered halves are in repro_310_r2 (both surfaces, both builds). This
 * pins the rule, the two call sites, the boundary, and the round 1 float
 * behaviour that must not regress.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-310-r2-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || '9dabbf6';
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  PASS  ' + m); } else { fail++; log('  FAIL  ' + m); } };
const guard = (label, fn) => {
  try { fn(); } catch (e) { fail++; log('  FAIL  ' + label + ' threw: ' + (e && e.message)); }
};
const codeOnly = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '').replace(/^[ \t]*\/\/.*$/gm, '');

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
    const f = find(n); if (!f) return false;
    have.add(n); parts.push(f); return true;
  };
  want.forEach(add);
  let api = null;
  const attempt = (call) => {
    for (let r = 0; r < 600; r++) {
      try {
        if (!api) {
          api = new Function('PAYLOAD', 'const state = { payload: PAYLOAD };\n' +
            'const document = undefined;\n' + parts.join('\n\n') +
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

const WANT = ['nearZeroPctText', 'fmtDerivedCell', 'DERIVED_ROWS',
  'formatIngestValue', 'rowsForDisplay', 'getTableSchema'];
const NEW = harness(SRC, WANT), OLD = harness(BASE_SRC, WANT);
/* warm both assemblers so a retry cannot replay an assertion block */
[NEW, OLD].forEach((H) => {
  H.attempt((api) => {
    api.fmtDerivedCell(0.5, { type: 'percentage', decimals: 1 }, false);
    if (typeof api.nearZeroPctText === 'function') api.nearZeroPctText(0.01, 1);
    return null;
  });
});

log('CLCPA-310 round 2: a small share reads as small, not as absent');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ---- A. the rule exists, once --------------------------------------- */
log('A. THE RULE, STATED ONCE');
guard('A  structure', () => {
  const code = codeOnly(SRC);
  ok(/function nearZeroPctText\(pct, decimals\)/.test(code),
    'A1 nearZeroPctText is declared');
  const fn = (() => {
    const at = code.indexOf('function nearZeroPctText');
    let d = 0;
    for (let i = code.indexOf('{', at); i < code.length; i++) {
      if (code[i] === '{') d++;
      else if (code[i] === '}') { d--; if (!d) return code.slice(at, i + 1); }
    }
    return '';
  })();
  ok(/Math\.pow\(10, -d\)/.test(fn),
    'A2 the threshold is 10^-decimals, derived from the precision');
  ok(!/0\.1|0\.01/.test(fn.replace(/toFixed\(d\)/g, '')),
    'A3 with no hardcoded threshold constant in it');
  ok(/Number\(Math\.abs\(pct\)\.toFixed\(d\)\) !== 0/.test(fn),
    'A4 and it asks the RENDERED output, not a second rounding rule');
  ok(/pct < 0 \? '>-' : '<'/.test(fn),
    'A5 a negative near-zero mirrors rather than claiming the opposite');
  ok(!/nearZeroPctText/.test(codeOnly(BASE_SRC)),
    'A6 BASE ' + BASE + ' has no such rule');
});

/* ---- B. both surfaces ask it --------------------------------------- */
log('');
log('B. BOTH SURFACES ASK THAT ONE RULE');
guard('B  call sites', () => {
  const code = codeOnly(SRC);
  ok(/const near = nearZeroPctText\(v \* 100, d\.decimals \|\| 0\);/.test(code),
    'B1 the derived-cell formatter asks it');
  ok(/const nearD = nearZeroPctText\(c \* 100, declaredPct\[colIdx\]\.decimals\);/.test(code),
    'B2 the section page asks it on the declared-precision branch');
  ok(/const near1 = nearZeroPctText\(scaled, 1\);/.test(code),
    'B3 and on the report default branch');
  ok(/rowDesc \? fmtDerivedCell\(v, rowDesc, currencyCol\[colIdx\]\)/.test(code),
    'B4 the editor routes a declared derived ROW through the same formatter');
  const n = (code.match(/nearZeroPctText\(/g) || []).length;
  ok(n === 4, 'B5 declared once and called three times, nowhere else: ' + n +
    ' occurrence(s)');
});

/* ---- C. the rule's answers, including the boundary ------------------ */
log('');
log('C. WHAT THE RULE ANSWERS');
guard('C  answers', () => {
  NEW.attempt((api) => {
    const f = api.nearZeroPctText;
    const cases = [
      [0.0135, 1, '<0.1%', 'the proof case: one in 7,400'],
      [-0.0135, 1, '>-0.1%', 'and its negative'],
      /* MY FIRST EXPECTATION HERE WAS WRONG, and the suite caught it: 0.0135
       * at two decimals renders as "0.01%", so there is nothing near-zero
       * about it and the rule correctly stands aside. The case that tests the
       * threshold FOLLOWING the precision is a value that still rounds to
       * zeros at two decimals. */
      [0.001, 2, '<0.01%', 'at two decimals the threshold follows the precision'],
      [0.0135, 2, null, 'and a value that renders at two decimals is left alone'],
      [0.0135, 4, null, 'as is one that renders at four'],
      [0.05, 1, null, 'the boundary: 0.05 rounds to 0.1, so it renders'],
      [0.04999, 1, '<0.1%', 'just below it does not'],
      [0, 1, null, 'a true zero is left alone: it IS absent'],
      [12.5, 1, null, 'an ordinary share is untouched'],
      [null, 1, null, 'a non-number is not a percentage'],
    ];
    cases.forEach(([v, d, want, why], k) => {
      const got = f(v, d);
      ok(got === want, 'C' + (k + 1) + ' ' + why + ': ' +
        JSON.stringify(v) + '@' + d + ' -> ' + JSON.stringify(got));
    });
    return null;
  });
});

/* ---- D. through the real formatter, both builds --------------------- */
log('');
log('D. THROUGH THE REAL FORMATTER');
guard('D  fmtDerivedCell', () => {
  const rule = { type: 'percentage', decimals: 1 };
  const now = NEW.attempt(api => api.fmtDerivedCell(1 / 7400, rule, false));
  const was = OLD.attempt(api => api.fmtDerivedCell(1 / 7400, rule, false));
  log('    now : ' + JSON.stringify(now));
  log('    BASE: ' + JSON.stringify(was));
  ok(now === '<0.1%', 'D1 the shared formatter renders the near-zero share: ' + now);
  ok(was === '0.0%', 'D2 and BASE ' + BASE + ' rendered it as absent: ' + was);
  /* and the clean cases are byte-identical on both builds */
  const clean = [0.348, 0.5127803860198227, 1, 0.0505];
  const a = clean.map(v => NEW.attempt(api => api.fmtDerivedCell(v, rule, false)));
  const b = clean.map(v => OLD.attempt(api => api.fmtDerivedCell(v, rule, false)));
  log('    clean cases now : ' + JSON.stringify(a));
  log('    clean cases BASE: ' + JSON.stringify(b));
  ok(JSON.stringify(a) === JSON.stringify(b),
    'D3 every case that already rendered is byte-identical to BASE');
});

/* ---- E. the float half of round 1 does not regress ----------------- */
log('');
log('E. THE ROUND 1 FLOAT BEHAVIOUR IS UNTOUCHED');
guard('E  no regression', () => {
  const cellsOf = (H) => H.attempt((api) => {
    const out = [];
    Object.keys(api.DERIVED_ROWS).forEach((id) => {
      const t = P.tables[id];
      if (!t) return;
      const rules = (api.DERIVED_ROWS[id] || []).filter(r => r && typeof r.row === 'number');
      Object.keys(t.data).sort().forEach((y) => {
        const schema = api.getTableSchema(t, y);
        const rows = api.rowsForDisplay(t.data[y].map(r => r.slice()), schema, id,
          { fillTotals: true });
        rules.forEach((r) => {
          for (let c = 1; c < schema.length; c++) {
            out.push(id + '/' + y + ' r' + r.row + ' c' + c + '=' +
              api.fmtDerivedCell((rows[r.row] || [])[c], r, false));
          }
        });
      });
    });
    return out;
  });
  const now = cellsOf(NEW), was = cellsOf(OLD);
  log('    declared derived-row cells formatted: ' + now.length);
  const moved = now.filter((s, i) => s !== was[i]);
  moved.slice(0, 3).forEach(m => log('      MOVED: ' + m));
  ok(now.length >= 49, 'E1 every declared cell in the payload is formatted: ' + now.length);
  ok(moved.length === 0,
    'E2 and not one already-rendering cell changes: ' + moved.length + ' moved');
  const tails = now.filter(s => /\d\.\d{6,}/.test(s));
  ok(tails.length === 0,
    'E3 no 17-digit float tails: ' + JSON.stringify(tails.slice(0, 2)));
  const decimals = now.map(s => (s.match(/\.(\d+)%$/) || [null, ''])[1].length)
    .filter(n => n > 0);
  ok(new Set(decimals).size <= 1,
    'E4 one precision across every declared percentage cell: ' +
    JSON.stringify([...new Set(decimals)]));
});

log('');
log(pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
