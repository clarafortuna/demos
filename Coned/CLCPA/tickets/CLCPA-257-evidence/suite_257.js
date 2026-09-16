/* GROUP C of the Section C fix package: CLCPA-257.
 *
 * dacCol resolved a column index against the FIRST key of schema_by_year,
 * which for this payload is the OLDEST year. The C-family schema widens
 * between 2023 and 2024 -- C2 is 4 columns in 2023 and 8 from 2024, with
 * unnamed spacer columns interleaved -- so a year with no schema of its own
 * indexed the narrow shape and then read those indexes out of wide rows,
 * landing on a spacer and finding nothing.
 *
 * THAT IS THE CLCPA-124 AUDIT'S C-08. On a year with complete Section C data
 * the Executive Summary showed "Demand Resp --" while Section C itself
 * computed a 10.0% DAC share from the same saved rows: Section C reads
 * schema_by_year[y] directly, the summary comes through dacCol.
 *
 * Measured, and it is the whole ticket in two numbers: for a new year, C2's
 * "Participants" resolves to column 1 under the old fallback and column 3
 * under the new one. The wide rows put it at 3; column 1 is a spacer.
 *
 * THE HARD GATE, as ruled: no stored table-year moves. All 149 carry their
 * own schema, so the fallback branch is never reached for any of them --
 * asserted rather than assumed, on both the index and the composed render.
 *
 * BASE is 3e47e89 (Group B's head). This branch stacks on it.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const OUT = path.join(REPO, 'Coned/CLCPA/tickets/CLCPA-257-evidence/suite-257-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || '3e47e89';
const APP = process.env.DAC_APP_OVERRIDE || path.join(REPO, REL);
const SRC = fs.readFileSync(APP, 'utf8');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const ok = (c, m) => {
  if (c) { pass++; lines.push('  ok   ' + m); } else { fail++; lines.push('  FAIL ' + m); }
  return !!c;
};
const say = (m) => lines.push(m);
function guard(label, fn) {
  try { fn(); } catch (e) { fail++; lines.push('  FAIL ' + label + ' THREW: ' + (e && e.message)); }
}
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

function harness(src) {
  const LINES = src.split('\r\n');
  const TOP = [];
  LINES.forEach((ln, n) => {
    const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([LINES.length]);
  const find = (nm) => {
    const k = TOP.findIndex(d => d.name === nm);
    return k < 0 ? null : LINES.slice(TOP[k].line, bound[k + 1]).join('\n');
  };
  const parts = []; const have = new Set();
  const add = (n) => { if (have.has(n)) return false; const f = find(n); if (!f) return false;
    have.add(n); parts.push(f); return true; };
  const want = ['dacCol', 'dacCell', 'renderSourceTables', 'getTableSchema', 'tableCaption'];
  want.forEach(add);
  let api = null;
  const attempt = (call) => {
    for (let r = 0; r < 400; r++) {
      try {
        if (!api) api = new Function('PAYLOAD', parts.join('\n\n') +
          '\n;if (typeof state !== "undefined") state.payload = PAYLOAD;' +
          '\n;return {' + want.filter(n => have.has(n)).join(',') + '};')(P);
        return call(api);
      } catch (e) {
        const m = /(\w+) is not defined/.exec(e.message);
        if (m && add(m[1])) { api = null; continue; }
        throw e;
      }
    }
    throw new Error('no convergence');
  };
  return { attempt };
}
const NEW = harness(SRC), OLD = harness(BASE_SRC);

say('======================================================================');
say('Section C group C -- CLCPA-257, dacCols schema fallback');
say('  BASE ' + BASE + '   (stacked on Group B)');
say('======================================================================');

/* =================== R: the root cause, driven ======================= */
say('');
say('=== R. the fallback, and what it cost =============================');
guard('R: the two numbers that are the whole ticket', () => {
  const a = OLD.attempt(api => api.dacCol(P.tables, 'C2', '2098', /participants/i));
  const b = NEW.attempt(api => api.dacCol(P.tables, 'C2', '2098', /participants/i));
  ok(a === 1, 'R1 BASE resolved C2 "Participants" to column ' + a +
     ' on a year with no schema: the 2023 shape');
  ok(b === 3, 'R2 and it now resolves to column ' + b + ': the newest shape');
  const wide = P.tables.C2.schema_by_year['2025'];
  const narrow = P.tables.C2.schema_by_year['2023'];
  ok(narrow.length === 4 && wide.length === 8,
     'R3 because C2 is ' + narrow.length + ' columns in 2023 and ' +
     wide.length + ' from 2024');
  ok(String(wide[1] == null ? '' : wide[1]).trim() === '',
     'R4 and column 1 in the wide shape is an unnamed spacer, which is why ' +
     'the summary found nothing and printed a dash');
  ok(String(wide[3]).toLowerCase().indexOf('participants') >= 0,
     'R5 while the value it wanted sits at column 3: "' + wide[3] + '"');
});

guard('R: the same fallback getTableSchema uses', () => {
  const fn = codeOnly(NEW.attempt(api => api.dacCol.toString()));
  ok(/parseInt\(b, 10\) - parseInt\(a, 10\)/.test(fn),
     'R6 dacCol sorts the schema years descending');
  const gts = codeOnly(NEW.attempt(api => api.getTableSchema.toString()));
  ok(/parseInt\(b, 10\) - parseInt\(a, 10\)/.test(gts),
     'R7 and so does getTableSchema, so the two no longer disagree');
  ok(!/const anyYear = Object\.keys\(by\)\[0\];/.test(codeOnly(SRC)),
     'R8 the oldest-year expression is gone from the source');
  ok(/const anyYear = Object\.keys\(by\)\[0\];/.test(codeOnly(BASE_SRC)),
     'R9 and it was there at BASE');
});

/* =================== G: THE HARD GATE ================================ */
say('');
say('=== G. the hard gate: no stored table-year moves ===================');
guard('G: every stored table-year carries its own schema', () => {
  let pairs = 0; const missing = [];
  Object.keys(P.tables).forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).forEach(y => {
      pairs++;
      if (!((t.schema_by_year || {})[y])) missing.push(id + ':' + y);
    });
  });
  ok(pairs === 149, 'G1 ' + pairs + ' stored table-years');
  ok(missing.length === 0,
     'G2 and every one has schema_by_year[y], so the fallback branch is ' +
     'NEVER reached for a stored year' + (missing.length ? ': ' + missing.join(', ') : ''));
});

guard('G: the resolved column index is identical, everywhere', () => {
  const PROBES = [/participants/i, /committed/i, /delivered/i, /total/i,
                  /dac/i, /incentive/i, /savings/i, /%/];
  let same = 0; const diff = [];
  Object.keys(P.tables).sort().forEach(id => {
    Object.keys(P.tables[id].data || {}).sort().forEach(y => {
      PROBES.forEach(re => {
        const a = OLD.attempt(api => api.dacCol(P.tables, id, y, re));
        const b = NEW.attempt(api => api.dacCol(P.tables, id, y, re));
        if (a === b) same++; else diff.push(id + ':' + y + ' ' + re);
      });
    });
  });
  /* THE LITERAL, not PROBES.length. Written as `149 * PROBES.length` this
   * assertion multiplied by the list it was checking, so emptying the list
   * satisfied it with zero comparisons -- a gate that cannot fail. 149
   * table-years x 8 probes = 1,192. */
  ok(same === 1192,
     'G3 ' + same + ' of 1,192 table-year x probe combinations resolved ' +
     'identically (149 years x 8 probes)');
  ok(diff.length === 0, 'G4 and not one differs' +
     (diff.length ? ': ' + diff.slice(0, 5).join(', ') : ''));
});

guard('G: and the composed render is byte-identical on all 149', () => {
  let checked = 0, tables = 0;
  const moved = [];
  Object.keys(P.tables).sort().forEach(id => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach(y => {
      const a = OLD.attempt(api => api.renderSourceTables([t], y, {}, id));
      const b = NEW.attempt(api => api.renderSourceTables([t], y, {}, id));
      checked++;
      if (/<table/.test(String(b))) tables++;
      if (a !== b) moved.push(id + ':' + y);
    });
  });
  ok(checked === 149 && tables === 149,
     'G5 all 149 rendered, and every one produced a <table>');
  ok(moved.length === 0, 'G6 and every one is byte-identical' +
     (moved.length ? ': ' + moved.slice(0, 6).join(', ') : ''));
});

/* =================== N: a NEW year is what moves ==================== */
say('');
say('=== N. the year that does move, which is the point =================');
guard('N: a year with no schema of its own now reads the wide shape', () => {
  const FAM = ['C2', 'C3', 'C4', 'C5'];
  FAM.forEach(id => {
    const a = OLD.attempt(api => api.dacCol(P.tables, id, '2098', /committed/i));
    const b = NEW.attempt(api => api.dacCol(P.tables, id, '2098', /committed/i));
    const wide = (P.tables[id].schema_by_year || {})['2025'] || [];
    const want = wide.findIndex(h => /committed/i.test(String(h == null ? '' : h)));
    ok(b === want, 'N1 ' + id + ' "Committed" -> column ' + b +
       ', which is where the newest schema puts it (' + want + ')');
    ok(a !== b, 'N1b and BASE said ' + a + ', which is where the 2023 shape put it');
  });
});

/* =================== X: blast radius and baseline =================== */
say('');
say('=== X. what else moved ============================================');
function grabFn(n, src) {
  const lines = src.split('\r\n');
  for (const pad of ['  ', '    ', '']) {
    const decl = new RegExp('^' + pad + '(?:async )?function ' + n + '\\s*\\(');
    const anyDecl = new RegExp('^' + pad + '(?:async )?function \\w+\\s*\\(');
    const start = lines.findIndex(l => decl.test(l));
    if (start < 0) continue;
    const close = pad + '}';
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i] === close) return lines.slice(start, i + 1).join('\r\n');
      if (anyDecl.test(lines[i])) break;
    }
    return null;
  }
  return null;
}
guard('X: the blast radius', () => {
  const names = [...new Set((SRC.match(/(?:^|\r\n)[ \t]*(?:async )?function (\w+)\s*\(/g) || [])
    .map(m => /function (\w+)/.exec(m)[1]))];
  const changed = names.filter(n => grabFn(n, SRC) !== grabFn(n, BASE_SRC));
  say('       changed: ' + changed.sort().join(', '));
  /* Group D stacks on top of this one, so its two functions are named here.
   * An unnamed change still turns X1 red. */
  const LATER = { phantomSpacerCols: 'CLCPA-260, group D', buildIngestWorkbook: 'CLCPA-260, group D',
    renderIngestEditor: 'CLCPA-260, group D' };
  const mine = changed.filter(n => !(n in LATER));
  changed.forEach(n => ok(n === 'dacCol' || n in LATER,
    'X1 ' + n + ' is accounted for' + (n in LATER ? ' (' + LATER[n] + ')' : '')));
  ok(mine.length === 1 && mine[0] === 'dacCol',
     'X1b exactly ONE function is THIS tickets, and it is dacCol: ' + mine.join(', '));
  ['getTableSchema', 'dacCell', 'renderSourceTables', 'tableCaption',
   'ingestComputed'].forEach(n => {
    ok(grabFn(n, SRC) === grabFn(n, BASE_SRC), 'X2 ' + n + ' is byte-identical to BASE');
  });
});
guard('X: the baseline', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X3 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: REPO }); anc = true; }
  catch (e) {}
  ok(anc, 'X4 and an ancestor of HEAD, so this group stacks on Group B');
});

lines.forEach(l => console.log(l));
console.log('\n  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n  ' + pass + ' passed, ' + fail + ' failed\n');
process.exit(fail ? 1 : 0);
