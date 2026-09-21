/* CLCPA-308 round 2 acceptance: a declared computed row looks computed on
 * both surfaces, and the computed mechanism does not regress.
 *
 * The ruling: "derived from the computed role in the table definition, not a
 * per-row list ... The computed mechanism must NOT regress: typing into the
 * cell is still discarded on blur, a count edit still recomputes the row,
 * the save still bills only the operator's own cell (the CLCPA-302
 * exclusion). Verify on both the section page and the editor."
 *
 * The rendered halves are in repro_308_r2 (both surfaces, both builds, plus
 * the save gesture). This pins the reader, the two call sites, and the one
 * thing a presentation change must never touch: what the engine computes.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-308-r2-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || '2a45a7e';
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

const WANT = ['isDeclaredComputedRow', 'ingestRowRole', 'ingestRoleOpen',
  'isComputedShareLabel', 'DERIVED_ROWS', 'rowsForDisplay', 'getTableSchema',
  'applyDerivedRows', 'INGEST_ROLE_OPEN'];
const NEW = harness(SRC, WANT), OLD = harness(BASE_SRC, WANT);

/* WARM THE ASSEMBLERS BEFORE ANYTHING ASSERTS.
 *
 * attempt() replays its whole callback each time it resolves a name, so any
 * assertion inside one attempt is counted once per retry: C3 to C5 printed
 * four times each and the tally was inflated by nine passes. One throwaway
 * call per build resolves the graph first, and the assertion blocks then run
 * exactly once. An inflated pass count is a suite lying about how much it
 * checked, which is worse than a red one. */
[NEW, OLD].forEach((H) => {
  H.attempt((api) => {
    Object.keys(api.DERIVED_ROWS || {}).forEach((id) => {
      const t = P.tables[id];
      if (!t) return;
      const y = Object.keys(t.data).sort().pop();
      const schema = api.getTableSchema(t, y);
      api.rowsForDisplay(t.data[y].map(r => r.slice()), schema, id, { fillTotals: true });
    });
    api.ingestRowRole('x', 'D3', false, 2);
    /* the undeclared-table variant too: block C asks it about A1, and a
     * name resolved only on that path left the block replaying once more */
    api.ingestRowRole('Percentage of subscribers in DACs', 'A1', false, 2);
    api.ingestRoleOpen('computed', false);
    /* OPTIONAL BY NAME: this warm-up runs for BOTH builds and the new reader
     * does not exist on BASE, so calling it unconditionally threw before a
     * single assertion ran. A warm-up must never be able to fail the run it
     * is preparing. */
    if (typeof api.isDeclaredComputedRow === 'function') api.isDeclaredComputedRow('D3', 2);
    if (typeof api.isComputedShareLabel === 'function') {
      api.isComputedShareLabel('% of total in DAC');
    }
    return null;
  });
});

log('CLCPA-308 round 2: a declared computed row, read-only on both surfaces');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ---- A. the reader, asked of the declaration ------------------------ */
log('A. THE READER, ASKED OF THE TABLE DEFINITION');
guard('A  structure', () => {
  const code = codeOnly(SRC);
  ok(/function isDeclaredComputedRow\(tableId, rowIndex\)/.test(code),
    'A1 isDeclaredComputedRow is declared');
  /* BRACE-MATCHED, not a character count. A fixed 420-char slice ran past
   * the end of the function into the next declaration, which mentions
   * "label" -- so A3 failed on text that is not in the function it is
   * about. */
  const bodyOf = (src, name) => {
    const at = src.indexOf('function ' + name);
    if (at < 0) return '';
    let d = 0;
    for (let i = src.indexOf('{', at); i < src.length; i++) {
      if (src[i] === '{') d++;
      else if (src[i] === '}') { d--; if (!d) return src.slice(at, i + 1); }
    }
    return '';
  };
  const fn = bodyOf(code, 'isDeclaredComputedRow');
  ok(/DERIVED_ROWS\[tableId\]/.test(fn),
    'A2 and reads DERIVED_ROWS, the table definition');
  ok(!/Percentage|percent of|label/i.test(fn),
    'A3 with no label pattern and no per-row list inside it');
  ok(/if \(isDeclaredComputedRow\(tableId, rowIndex\)\) return 'computed';/.test(code),
    'A4 the row role consults it');
  ok(/function ingestRowRole\(label, tableId, isHeaderRow, rowIndex\)/.test(code),
    'A5 which is why the role now takes the row index');
  /* the OLD predicate is untouched: J8 and F7 still answer by wording */
  const oldPred = (t) => bodyOf(codeOnly(t), 'isComputedShareLabel');
  ok(oldPred(SRC) === oldPred(BASE_SRC),
    'A6 isComputedShareLabel is byte-identical to BASE: J8 and F7 are untouched');
});

/* ---- B. both surfaces ask the SAME reader --------------------------- */
log('');
log('B. BOTH SURFACES, ONE READER');
guard('B  call sites', () => {
  const code = codeOnly(SRC);
  const roleCalls = (code.match(/ingestRowRole\(/g) || []).length;
  ok(roleCalls >= 3, 'B1 the role is declared once and called from the editor: ' +
    roleCalls + ' occurrence(s)');
  ok(!/ingestRowRole\(r\[0\], i\.tableId, hdr\)\s*!==/.test(code),
    'B2 no editor call site was left without the index');
  ok(/if \(isDeclaredComputedRow\(opts\.tableId, idx \+ headerLevels - 1\)\) \{/.test(code),
    'B3 the SECTION PAGE asks the same reader, index-translated');
  ok(/cls = \(idx === body\.length - 1\) \? ' class="is-total"' : ' class="is-subtotal"';/
    .test(code), 'B4 and gives it the total-row treatment');
  ok(!/isDeclaredComputedRow/.test(codeOnly(BASE_SRC)),
    'B5 BASE ' + BASE + ' has no such reader at all');
});

/* ---- C. the reader's answers, per row ------------------------------- */
log('');
log('C. WHAT THE READER SAYS, ROW BY ROW');
guard('C  answers', () => {
  /* COUNTED, NOT ASSERTED PER ROW. The first cut called ok(false) inside the
   * loop with an ad-hoc label and then asserted the size of the RULES list,
   * which is a constant -- so C1 stayed green when the reader recognised
   * nothing and C2 stayed green when it claimed every row. Mutations 1 and 2
   * found both. The counts below are of the reader's ANSWERS, so they cannot
   * be satisfied by the declaration they are checking against. */
  NEW.attempt((api) => {
    let declared = 0, data = 0, missed = 0, claimed = 0;
    const examples = [];
    Object.keys(api.DERIVED_ROWS).forEach((id) => {
      const rules = (api.DERIVED_ROWS[id] || []).filter(r => r && typeof r.row === 'number');
      if (!rules.length) return;
      const t = P.tables[id];
      if (!t) return;
      const y = Object.keys(t.data).sort().pop();
      (t.data[y] || []).forEach((row, ri) => {
        const isDecl = rules.some(r => r.row === ri);
        const answer = api.isDeclaredComputedRow(id, ri);
        if (isDecl) {
          declared++;
          if (!answer) { missed++; if (examples.length < 3) examples.push(id + ' r' + ri + ' declared, not recognised'); }
        } else {
          data++;
          if (answer) { claimed++; if (examples.length < 3) examples.push(id + ' r' + ri + ' not declared, claimed'); }
        }
      });
    });
    log('    declared rows: ' + declared + ' (missed ' + missed + ')   data rows: ' +
      data + ' (wrongly claimed ' + claimed + ')');
    examples.forEach(e => log('      ' + e));
    ok(declared >= 9 && missed === 0,
      'C1 every one of the ' + declared + ' declared rows is recognised: missed ' + missed);
    ok(data >= 15 && claimed === 0,
      'C2 and none of the ' + data + ' data rows is claimed: claimed ' + claimed);
    return null;
  });
  /* the ROLE follows, and a role is fully closed */
  NEW.attempt((api) => {
    const role = api.ingestRowRole('Percentage of subscribers in DACs', 'D3', false, 2);
    ok(role === 'computed', 'C3 the declared row takes the computed role: ' + role);
    const open = api.ingestRoleOpen(role, false);
    ok(open.values === false, 'C4 whose value cells are not open');
    ok(open.label === false, 'C5 nor is its label, which is structure');
    const dataRole = api.ingestRowRole('Total # of subscribers', 'D3', false, 0);
    ok(dataRole === 'data', 'C6 and a data row keeps the data role: ' + dataRole);
    /* the SAME label in a table that does not declare it stays data */
    const elsewhere = api.ingestRowRole('Percentage of subscribers in DACs', 'A1', false, 2);
    ok(elsewhere === 'data',
      'C7 the label alone does not lock a row in an undeclared table: ' + elsewhere);
    return null;
  });
});

/* ---- D. the computed mechanism is untouched ------------------------- */
log('');
log('D. WHAT THE ENGINE COMPUTES DOES NOT MOVE');
guard('D  no derivation change', () => {
  const rowsOf = (H) => H.attempt((api) => {
    const out = {};
    Object.keys(api.DERIVED_ROWS).forEach((id) => {
      const t = P.tables[id];
      if (!t) return;
      Object.keys(t.data).sort().forEach((y) => {
        const schema = api.getTableSchema(t, y);
        out[id + '/' + y] = JSON.stringify(
          api.rowsForDisplay(t.data[y].map(r => r.slice()), schema, id, { fillTotals: true }));
      });
    });
    return out;
  });
  const now = rowsOf(NEW), was = rowsOf(OLD);
  const keys = Object.keys(now);
  const moved = keys.filter(k => now[k] !== was[k]);
  log('    table-years compared: ' + keys.length);
  moved.slice(0, 3).forEach(k => log('      MOVED: ' + k));
  ok(keys.length >= 12, 'D1 every declared table-year is compared: ' + keys.length);
  ok(moved.length === 0,
    'D2 and not one displayed row changes: this is presentation only (' +
    moved.length + ' moved)');
});

log('');
log(pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
