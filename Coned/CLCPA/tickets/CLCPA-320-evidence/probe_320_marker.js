/* CLCPA-320, THE MEASUREMENT: does the template's total-row marker depend on
 * the YEAR the template is generated for?
 *
 * The ticket says the structural marker must derive from the row's ROLE in the
 * table definition and be identical whichever year is asked for. The suspect
 * is ingestComputed, which builds its `totals` from totalRowFlags -- the
 * value-dependent classifier, where structure proposes and ARITHMETIC
 * confirms. A year whose figures do not add up, or which has no figures at
 * all, cannot confirm anything.
 *
 * This asserts nothing. It prints, per table and year:
 *   role     the row's label says it is a total
 *   flagged  the arithmetic confirmation agrees
 *   marks    what marksInTemplate would write into each value column
 *
 * A row where role and flagged disagree is the ticket.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'probe-320-marker-output.txt');

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

const H = harness(SRC, ['ingestComputed', 'getTableSchema', 'totalRowFlags',
  'isAnchoredTotalRowLabel', 'ingestTemplateSource', 'INGEST_CALC_MARKER']);

/* EVERY CALL GOES THROUGH attempt, including the accessors on the object
 * ingestComputed returns. The assembler resolves a missing dependency by
 * catching the ReferenceError and adding it, so a call made OUTSIDE attempt
 * gets the raw throw -- which is the documented limit of a hand-fed slice: it
 * cannot see a missing closure. The first cut of this probe held the returned
 * object and called it directly, and it ran for one whole section before
 * marksInTemplate reached a branch that needed isTotalOnlyDerived. */
function markersFor(rows, id, schema) {
  return H.attempt((api) => {
    const computed = api.ingestComputed(rows, id, schema);
    return rows.map((r, i) => {
      const role = api.isAnchoredTotalRowLabel(r && r[0]);
      if (!role) return null;
      const marks = [];
      for (let c = 1; c < (schema || []).length; c++) {
        if (computed.marksInTemplate(i, c)) marks.push(c);
      }
      return { i: i, label: String(r[0]), role: role, flagged: !!computed.totalRow(i), marks: marks };
    }).filter(Boolean);
  });
}

log('CLCPA-320 MEASUREMENT: is the total-row marker the same in every year?');
log('app.js: ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* the boards the ticket names, plus the A-section control */
const IDS = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10', 'A3'];
let disagree = 0, rowsSeen = 0;
const offenders = [];

IDS.forEach((id) => {
  const t = P.tables[id];
  if (!t) return;
  const years = Object.keys(t.data || {}).sort();
  log('=== ' + id);
  years.forEach((y) => {
    const src = H.attempt(api => api.ingestTemplateSource(t, y));
    const rows = src.rows || [];
    const schema = H.attempt(api => api.getTableSchema(t, y));
    markersFor(rows, id, schema).forEach((m) => {
      rowsSeen++;
      const bad = m.role && !m.flagged;
      if (bad) { disagree++; offenders.push(id + ':' + y + ' r' + m.i); }
      log('    ' + y + (src.borrowed ? ' (borrowed from ' + src.year + ')' : '          ') +
          '  r' + m.i + ' ' + JSON.stringify(m.label.slice(0, 34)) +
          '  role=' + m.role + '  flagged=' + m.flagged +
          '  marks=' + JSON.stringify(m.marks) + (bad ? '   <-- DISAGREE' : ''));
    });
  });
});

/* AND THE CASE THE TICKET IS ACTUALLY ABOUT: a year with no figures yet.
 * A fresh year borrows a donor's rows; this asks what happens when the rows
 * that reach the classifier are the BLANK ones a preparer would be filling. */
log('');
log('--- the same total rows, with the figures not yet filled in ------------');
IDS.forEach((id) => {
  const t = P.tables[id];
  if (!t) return;
  const y = Object.keys(t.data || {}).sort().pop();
  const donor = (t.data[y] || []);
  if (!donor.length) return;
  const schema = H.attempt(api => api.getTableSchema(t, y));
  const blank = donor.map(r => r.map((v, c) => (c === 0 ? v : null)));
  markersFor(blank, id, schema).forEach((m) => {
    rowsSeen++;
    const bad = m.role && !m.flagged;
    if (bad) { disagree++; offenders.push(id + ':BLANK r' + m.i); }
    log('    ' + id + ' blank  r' + m.i + ' ' + JSON.stringify(m.label.slice(0, 34)) +
        '  role=' + m.role + '  flagged=' + m.flagged +
        '  marks=' + JSON.stringify(m.marks) + (bad ? '   <-- DISAGREE' : ''));
  });
});

log('');
log('--- summary -----------------------------------------------------------');
log('  total rows examined: ' + rowsSeen);
log('  rows whose ROLE says total but whose ARITHMETIC does not: ' + disagree);
if (offenders.length) log('  ' + JSON.stringify(offenders));

fs.writeFileSync(OUT, lines.join('\n') + '\n');
