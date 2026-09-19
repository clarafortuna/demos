const _dacRepo = () => {
  const p = require('path'), f = require('fs');
  if (process.env.DAC_REPO) return p.resolve(process.env.DAC_REPO);
  let d = __dirname;
  for (let i = 0; i < 16; i++) {
    if (f.existsSync(p.join(d, '.clcpa-root'))) {
      const two = p.resolve(d, '..', '..');
      return f.existsSync(p.join(two, '.git')) ? two : d;
    }
    const u = p.dirname(d); if (u === d) break; d = u;
  }
  throw new Error('CLCPA project root not found above ' + __dirname + '; set DAC_REPO');
};
/* Mutation controls for CLCPA-272.
 *
 * The controls that carry the RULING: option (b) advises and never computes
 * over the preparer's figure, so a mutation that overwrites the total or
 * rejects the import must turn this red. Plus the two false-positive traps --
 * the second label column and the blank heading that is a real column named in
 * a second header row -- because a rule that flags 60 correct F6 rows is worse
 * than no rule at all.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = _dacRepo() + '';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-272-evidence';
const APP = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_272.js';

const M = [
  /* ---- the defect returns -------------------------------------------------- */
  { t: APP, name: 'THE DEFECT RETURNS: nothing reconciles on import',
    from: '    res.reconcileNotices = reconcileSumColumns(candidate, schema, tableId);',
    to:   '    res.reconcileNotices = [];',
    expect: 'E3 and one reconciliation advisory',
    alt: 'F9 IMPORT reconciles the candidate' },
  { t: APP, name: 'THE SAVE HALF is dropped, so only imports are checked',
    from: '          ${renderReconcileNotice(reconcileSumColumns(i.draft, i.schema, i.tableId))}\r\n',
    to:   '',
    expect: 'F10 and SAVE reconciles the draft, in the confirm dialog' },

  /* ---- the ruling: advise, never compute over the figure ------------------- */
  { t: APP, name: 'OPTION (a) BY STEALTH: the engine computes over the filed total',
    from: '        if (withinSourceRounding(filed, sum)) return;',
    to:   '        if (withinSourceRounding(filed, sum)) return;\r\n        row[rel.column] = sum;',
    expect: 'A6 the filed value is NOT overwritten -- 1500 still stands',
    alt: 'A7 and the function is pure: the rows are unchanged' },
  { t: APP, name: 'THE ADVISORY STARTS REJECTING',
    from: '    res.reconcileNotices = reconcileSumColumns(candidate, schema, tableId);',
    to:   '    res.reconcileNotices = reconcileSumColumns(candidate, schema, tableId);\r\n    if (res.reconcileNotices.length) { reject(\'totals do not add up\', {}); return res; }',
    expect: 'E1 an import carrying a bad total still SUCCEEDS',
    alt: 'E2 with no rejections' },

  /* ---- the two false-positive traps ---------------------------------------- */
  { t: APP, name: 'TRAP 1 RETURNS: a second LABEL column becomes an addend',
    from: '        if (numeric ? !numeric[c2] : (h2 == null || !String(h2).trim())) return;',
    to:   '        if (h2 == null || !String(h2).trim()) return;',
    /* F6's merged columns drop out and 60 correct rows are flagged */
    expect: 'C2 and "Borough / County" (column 1, text) is NOT one of its parts',
    alt: 'B2 NOT ONE stored row is flagged' },
  { t: APP, name: 'TRAP 2 RETURNS: the numeric mask is not consulted at all',
    from: '    const numeric = Array.isArray(rows) && rows.length\r\n      ? columnNumericMask(headerRow, rows, tableId) : null;',
    to:   '    const numeric = null;',
    expect: 'C2 and "Borough / County" (column 1, text) is NOT one of its parts',
    alt: 'B2 NOT ONE stored row is flagged' },
  /* The second header row is protected TWICE -- its total is not a number and
   * its parts are not numbers -- so no single-anchor mutation can expose that
   * guard through F6. C11 is the case where only the first guard stands. */
  { t: APP, name: 'A TEXT TOTAL ("n/a") is treated as a disagreement',
    from: "        if (typeof filed !== 'number') return;",
    to:   '        if (filed == null) return;',
    expect: 'C11 a row whose total cell holds text is not flagged' },

  /* ---- the relationship is derived ----------------------------------------- */
  { t: APP, name: 'A PERCENTAGE COLUMN is counted as an addend',
    from: '        if (isTotalHead(h2) || pct[c2] || avg[c2]) return;',
    to:   '        if (isTotalHead(h2)) return;',
    expect: 'B2 NOT ONE stored row is flagged',
    alt: 'F4 the exclusions reuse the shipped percentage and average detectors' },
  { t: APP, name: 'A SINGLE PART is treated as a sum (a copy, not an addition)',
    from: '      if (parts.length >= 2) out.push({ column: c, parts: parts });',
    to:   '      if (parts.length >= 1) out.push({ column: c, parts: parts });',
    expect: 'B2 NOT ONE stored row is flagged',
    alt: 'D1 SEVEN tables carry a preparer-entered derivable column' },
  { t: APP, name: 'THE TOLERANCE is dropped, so rounding becomes a defect',
    from: '        if (withinSourceRounding(filed, sum)) return;',
    to:   '        if (filed === sum) return;',
    expect: 'F6 the tolerance is the totals engine\'s own',
    alt: 'B2 NOT ONE stored row is flagged' },
  { t: APP, name: 'A PARTIAL ROW is reconciled, so unfinished typing is flagged',
    from: '        if (seen !== rel.parts.length) return;',
    to:   '',
    expect: 'B2 NOT ONE stored row is flagged' },
  { t: APP, name: 'THE TABLE IS HARDCODED to H1',
    from: '      if (c === 0 || !isTotalHead(h)) return;',
    to:   "      if (c === 0 || !isTotalHead(h) || tableId !== 'H1') return;",
    expect: 'D2 and they are B2, F2, F4, F5, F6, F7, H1',
    alt: 'D1 SEVEN tables carry a preparer-entered derivable column' },

  /* ---- the box -------------------------------------------------------------- */
  { t: APP, name: 'THE WRONG ACCENT: the advisory turns red like a rejection',
    from: "    return '<div class=\"ingest-import-notice is-warn\">' +\r\n      '<h4>Does not add up: '",
    to:   "    return '<div class=\"ingest-import-notice is-alert\">' +\r\n      '<h4>Does not add up: '",
    expect: 'E5 it renders in the CLCPA-266 AMBER box' },
  { t: APP, name: 'THE ROW IS NOT NAMED, so the operator cannot find it',
    from: "      n.map(x => li(x.label + ' / ' + x.column + ': filed ' + x.filed +",
    to:   "      n.map(x => li('a row' + ': filed ' + x.filed +",
    expect: 'E7 naming the row',
    alt: 'A2 and it NAMES the row' },
  { t: APP, name: 'A CLEAN TABLE starts rendering an empty box',
    from: '    const n = list || [];\r\n    if (!n.length) return \'\';',
    to:   '    const n = list || [];',
    expect: 'E9 and a clean table renders no box at all' },

  /* ---- the harness ---------------------------------------------------------- */
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '6972a74';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X1 BASE is pinned to a literal commit sha' },
  { t: SUITE, name: 'HARNESS: the reconcile is re-implemented instead of sliced',
    from: '  const f = now(a => a.reconcileSumColumns);',
    to:   '  const f = () => [];',
    expect: 'X3 the function under test is the one sliced from app.js' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-272 -- mutation controls');
log('======================================================================');

let caught = 0, missed = 0, applied = 0;
M.forEach((m) => {
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  if (n !== 1) { log('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED'); missed++; return; }
  applied++;
  fs.writeFileSync(m.t, base.replace(from, () => to));
  let out = '';
  try { out = execFileSync('node', ['suite_272.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }
  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const want = [m.expect].concat(m.alt ? [m.alt] : []);
  const hit = fails.filter(l => want.some(w => l.indexOf(w) >= 0));
  if (hit.length) {
    log('  red  ' + m.name);
    log('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 112));
    caught++;
  } else if (fails.length) {
    log('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    log('       want: ' + want.join(' OR '));
    log('       got : ' + fails[0].trim().slice(5, 112));
    missed++;
  } else { log('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.'); missed++; }
});

log('');
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + applied + ' applied');
let clean = '';
try { clean = execFileSync('node', ['suite_272.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-272-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
