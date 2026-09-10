/* Mutation controls for CLCPA-233 (A+B) and CLCPA-237 (E+D).
 *
 * ONE RUNNER, TWO LEDGERS. The two tickets share app.js and styles.css, so a
 * single runner applies each mutation once and reports which ticket's suite
 * caught it -- but the tallies stay separate, per the CLCPA-235/234 precedent.
 * A mutation that only its own ticket's suite catches is the healthy case; one
 * caught by the OTHER ticket's suite is worth seeing, because it means the
 * two are coupled where I thought they were not.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const T = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/';
const APP = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSS = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/styles.css';
const SUITES = [
  { ticket: 'CLCPA-233', dir: T + 'CLCPA-233-evidence', file: 'suite_233.js' },
  { ticket: 'CLCPA-237', dir: T + 'CLCPA-237-evidence', file: 'suite_237.js' },
];

const M = [
  /* ================= CLCPA-233 item A ================= */
  { ticket: 'CLCPA-233', target: APP,
    name: 'THE HEADER ROW IS EDITABLE AGAIN: the header branch is skipped',
    from: "        if (isHeaderRow) {",
    to:   "        if (false) {",
    expect: 'row 0 contains NO input' },
  { ticket: 'CLCPA-233', target: APP,
    name: 'the delete button comes back on the header row',
    /* Anchor updated when CLCPA-240 round 2 extended this condition to
     * `(isHeaderRow || lockTotalRow)`. A mutation whose anchor has rotted
     * reports "ANCHOR 0, NOT APPLIED", which is a dead control rather than a
     * passing one, so it is repointed at the line as it now reads. */
    from: "        <td class=\"ingest-td-actions\">${(isHeaderRow || lockTotalRow) ? ''",
    to:   "        <td class=\"ingest-td-actions\">${false ? ''",
    expect: 'NO delete button' },
  { ticket: 'CLCPA-233', target: APP,
    name: 'header_levels is ignored, so no table has a sub-header',
    from: "      if (typeof lv !== 'number' || lv < 2) return 0;",
    to:   "      return 0; if (typeof lv !== 'number' || lv < 2) return 0;",
    expect: 'row 0 is marked as the sub-header' },
  { ticket: 'CLCPA-233', target: APP,
    name: 'D1 IS DRAGGED IN: any header_levels key counts as a sub-header',
    from: "      if (typeof lv !== 'number' || lv < 2) return 0;\n      return Math.min(lv - 1, i.draft.length);",
    to:   "      if (typeof lv !== 'number') return 0;\n      return Math.min(Math.max(lv, 2) - 1, i.draft.length);",
    /* D1 carries header_levels = 0 and its data[0] is genuine data. This is
     * the trap the audit named, and it must go red. */
    expect: 'D1 row 0 is NOT marked a sub-header' },
  { ticket: 'CLCPA-233', target: APP,
    name: 'the header row is DROPPED instead of made read-only',
    from: "    const bodyRowsHtml = i.draft.map((row, rowIdx) => {",
    to:   "    const bodyRowsHtml = i.draft.slice(headerRowCount).map((row, rowIdx) => {",
    /* dropping it from the render would ALSO drop it from the draft's row
     * indices and eventually from the store: worse than the original bug */
    expect: 'every stored row is still rendered' },
  { ticket: 'CLCPA-233', target: APP,
    name: 'the header branch runs AFTER the derived branch',
    from: "        if (isHeaderRow) {\n          const text = (v == null || v === '') ? '' : String(v);",
    to:   "        if (isHeaderRow && !derivedByCol[colIdx]) {\n          const text = (v == null || v === '') ? '' : String(v);",
    /* A10 cols 3 and 6 have a derive rule, so the sub-header's "% DAC" would
     * be routed through fmtDerivedCell */
    expect: 'A10 row 0 still shows its "% DAC" header text verbatim' },

  /* ================= CLCPA-233 item B ================= */
  { ticket: 'CLCPA-233', target: APP,
    name: 'A9 % Change is typeable again',
    from: "        if (readOnlyByName[colIdx]) {",
    to:   "        if (false) {",
    expect: 'BOTH "% Change" columns offer no input' },
  { ticket: 'CLCPA-233', target: APP,
    name: 'the name match loosens and catches more than % Change',
    from: "      if (h != null && /^\\s*%\\s*change\\s*$/i.test(String(h))) readOnlyByName[idx] = true;",
    to:   "      if (h != null && /%/.test(String(h))) readOnlyByName[idx] = true;",
    /* a bare /%/ would freeze every percentage column in every table */
    /* caught by the J1 control, which is the assertion this mutation forced
     * into existence: on A9 alone the loose and strict rules pick the same two
     * columns, so the guard had to be tested against a table the loose one
     * would wrongly freeze. */
    expect: 'J1 percentage columns 2 and 4 are STILL EDITABLE' },
  { ticket: 'CLCPA-233', target: APP,
    name: 'read-only becomes read-only AND blank, losing the published value',
    from: "          const text = (v == null || v === '') ? '—' : String(v);\n          return `<td class=\"ingest-td-calc\"><span class=\"ingest-cell-calc ingest-cell-calc-text\" data-row=\"${rowIdx}\" data-col=\"${colIdx}\">${escapeHtml(text)}</span></td>`;\n        }\n        if (isTotal) {",
    to:   "          return `<td class=\"ingest-td-calc\"><span class=\"ingest-cell-calc ingest-cell-calc-text\" data-row=\"${rowIdx}\" data-col=\"${colIdx}\"></span></td>`;\n        }\n        if (isTotal) {",
    expect: 'showing the value the source published' },
  { ticket: 'CLCPA-233', target: APP,
    name: 'item C is smuggled in: A9 gains a derive rule',
    from: "      A1: [pct(3, [2], [1], 'row', 1)],",
    to:   "      A9: [pct(5, [3], [1], 'row', 0)],\n      A1: [pct(3, [2], [1], 'row', 1)],",
    /* item C is post-Sept-10 by ruling. A rule appearing quietly must fail. */
    expect: 'A9 still has NO derive rule' },

  /* ================= CLCPA-233, the store ================= */
  { ticket: 'CLCPA-233', target: APP,
    name: 'the import stops rejecting a label-less row, so it could reach the header',
    from: "      if (!k) { res.notTouched.unmatchedRows.push({ label: r[labelCol], why: 'the row has no label' }); return; }",
    to:   "      if (!k) { res.notTouched.unmatchedRows.push({ label: r[labelCol], why: 'no label' }); return; }",
    expect: 'rejects a file row with no label, naming the reason' },
  { ticket: 'CLCPA-233', target: APP,
    name: 'the import indexes empty labels, making the sub-header a target',
    from: "      if (k && labelIndex[k] === undefined) labelIndex[k] = idx;",
    to:   "      if (labelIndex[k] === undefined) labelIndex[k] = idx;",
    expect: 'the import indexes a row ONLY when its label is non-empty' },

  /* ================= CLCPA-233, the CSS ================= */
  { ticket: 'CLCPA-233', target: CSS,
    name: 'the sub-header loses its header styling and reads as a calc row',
    from: ".ingest-row-subheader td {",
    to:   ".ingest-row-subheader-off td {",
    expect: '.ingest-row-subheader td exists' },
  { ticket: 'CLCPA-233', target: CSS,
    name: 'the sub-header cells lose their weight',
    from: "  color: var(--text-2);\n  font-weight: 600;\n}",
    to:   "  color: var(--text-2);\n}",
    /* "font-weight: 600;" alone appears 124 times in styles.css, so the anchor
     * had to include the line above it. A non-unique anchor is not a mutation,
     * it is a coin flip. */
    expect: 'its cells are weighted' },

  /* ================= CLCPA-237 item E ================= */
  { ticket: 'CLCPA-237', target: APP,
    name: 'THE PHANTOM RETURNS: the guard goes back to the undefined test',
    from: "        const usable = v && (typeof v.total === 'number' || typeof v.dac === 'number');\n        if (usable) {",
    to:   "        const usable = v && (v.total !== undefined || v.dac !== undefined);\n        if (usable) {",
    expect: 'NO reported KPI has a 2099 entry' },
  { ticket: 'CLCPA-237', target: APP,
    name: 'the guard requires BOTH, silencing clean_energy_jobs everywhere',
    from: "typeof v.total === 'number' || typeof v.dac === 'number'",
    to:   "typeof v.total === 'number' && typeof v.dac === 'number'",
    /* clean_energy_jobs has a total and no dac in EVERY year, so requiring
     * both drops a real KPI from 2023, 2024 and 2025 */
    expect: 'reported KPIs, same as BASE' },
  { ticket: 'CLCPA-237', target: APP,
    name: 'clean_energy_jobs stops returning dac: null',
    from: "      dac: null }),",
    to:   "      dac: 0 }),",
    /* the fix belongs in the GUARD, not in the rule: 0 would be a false claim
     * that zero jobs went to DAC communities */
    expect: 'clean_energy_jobs still returns dac: null' },

  /* ================= CLCPA-237 item D ================= */
  { ticket: 'CLCPA-237', target: APP,
    name: 'the empty branch loses the solo modifier',
    from: "<div class=\"exec-shares-grid exec-shares-grid-solo\" id=\"exec-shares-grid\">",
    to:   "<div class=\"exec-shares-grid\" id=\"exec-shares-grid\">",
    expect: 'the EMPTY branch carries the solo modifier' },
  { ticket: 'CLCPA-237', target: APP,
    name: 'the POPULATED branch gains it too, stacking the three cards',
    from: "        <div class=\"exec-shares-grid\" id=\"exec-shares-grid\">\n          ${renderDumbbell(baseline, year, sections)}",
    to:   "        <div class=\"exec-shares-grid exec-shares-grid-solo\" id=\"exec-shares-grid\">\n          ${renderDumbbell(baseline, year, sections)}",
    expect: 'exactly once in the whole function' },
  { ticket: 'CLCPA-237', target: APP,
    name: 'the map is dropped from the empty branch, undoing CLCPA-158',
    from: "          <div class=\"exec-shares-grid exec-shares-grid-solo\" id=\"exec-shares-grid\">\n            ${renderDACMap(baseline, year, sections)}",
    to:   "          <div class=\"exec-shares-grid exec-shares-grid-solo\" id=\"exec-shares-grid\">\n            ${''}",
    /* caught by the unchanged-from-BASE assertion: removing the map removes
     * the div it sat in, which is a bigger edit than the class. */
    expect: 'renderExecutiveSummary is otherwise UNCHANGED from BASE' },
  { ticket: 'CLCPA-237', target: CSS,
    name: 'the solo rule moves BEFORE the media query, so it loses the cascade',
    from: "/* CLCPA-237 item D: the EMPTY-YEAR branch",
    to:   "/* MOVED-EARLY MARKER */\n.exec-shares-grid-solo { grid-template-columns: 1fr; }\n/* CLCPA-237 item D: the EMPTY-YEAR branch",
    /* two copies now exist; the assertion counts on the LAST one winning, so
     * this must be caught by the ordering check rather than pass silently */
    /* caught by the exactly-once assertion, which this mutation forced into
     * existence: a second copy earlier in the file left the LAST one winning,
     * so every ordering check passed by accident. */
    expect: 'declared exactly ONCE in styles.css' },
  { ticket: 'CLCPA-237', target: CSS,
    name: 'the solo rule sets three columns, doing nothing',
    from: ".exec-shares-grid-solo { grid-template-columns: 1fr; }",
    to:   ".exec-shares-grid-solo { grid-template-columns: 1fr 1fr 1fr; }",
    expect: 'the solo modifier is one column' },
];

const ledger = {};
SUITES.forEach(s => { ledger[s.ticket] = { caught: 0, missed: 0, cross: 0 }; });
const report = [];

function runSuite(s) {
  try { return execFileSync('node', [s.file], { cwd: s.dir, encoding: 'utf8' }); }
  catch (e) { return (e.stdout || '') + (e.stderr || ''); }
}

M.forEach((m) => {
  if (m.skipIfSame && m.from === m.to) {
    report.push('  skip ' + m.ticket + '  ' + m.name + ' -- from and to identical, not a mutation');
    return;
  }
  const base = fs.readFileSync(m.target, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  if (n !== 1) {
    report.push('  ??? ' + m.ticket + '  ' + m.name + ' -- ANCHOR ' + n + ', NOT APPLIED');
    ledger[m.ticket].missed++; return;
  }
  fs.writeFileSync(m.target, base.replace(from, () => to));
  const outs = {};
  SUITES.forEach(s => { outs[s.ticket] = runSuite(s); });
  fs.writeFileSync(m.target, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.target, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }

  const failsOf = (t) => (outs[t].match(/^  FAIL .*$/gm) || []);
  const own = failsOf(m.ticket);
  const hit = own.filter(l => l.indexOf(m.expect) >= 0);
  const other = SUITES.filter(s => s.ticket !== m.ticket)[0].ticket;
  const otherFails = failsOf(other).length;

  if (hit.length) {
    report.push('  red  ' + m.ticket + '  ' + m.name);
    report.push('         ' + own.length + ' red in its own suite, incl: ' + hit[0].trim().slice(5, 96));
    if (otherFails) {
      report.push('         (also ' + otherFails + ' red in ' + other + ': the two share app.js)');
      ledger[m.ticket].cross++;
    }
    ledger[m.ticket].caught++;
  } else if (own.length) {
    report.push('  ??? ' + m.ticket + '  ' + m.name + ' -- ' + own.length + ' red, not the expected one');
    report.push('         want: ' + m.expect);
    report.push('         got : ' + own[0].trim().slice(5, 96));
    ledger[m.ticket].missed++;
  } else if (otherFails) {
    report.push('  ??? ' + m.ticket + '  ' + m.name + ' -- GREEN in its own suite, ' +
      otherFails + ' red in ' + other + ': the guard is in the WRONG ticket');
    ledger[m.ticket].missed++;
  } else {
    report.push('  GREEN ' + m.ticket + '  ' + m.name + ' -- NOT NOTICED. Not a guard.');
    ledger[m.ticket].missed++;
  }
});

/* CLEAN RE-RUN of both suites against restored source, per the standing law. */
let cleanOk = true;
SUITES.forEach(s => {
  const out = runSuite(s);
  if (/FAIL/.test(out)) {
    cleanOk = false;
    console.error('THE CLEAN RE-RUN FAILED for ' + s.ticket);
    console.error(out.split('\n').filter(l => /FAIL/.test(l)).join('\n'));
  }
});

console.log('======================================================================');
console.log('CLCPA-233 + CLCPA-237 -- mutation controls, separate ledgers');
console.log('======================================================================');
report.forEach(l => console.log(l));
console.log('');
SUITES.forEach(s => {
  const L = ledger[s.ticket];
  console.log('  ' + s.ticket + ': ' + L.caught + ' caught, ' + L.missed +
    ' not caught' + (L.cross ? '   (' + L.cross + ' also seen by the other suite)' : ''));
});
console.log('  clean re-run of BOTH suites against restored source: ' + (cleanOk ? 'PASSES' : 'FAILED'));
const missed = SUITES.reduce((a, s) => a + ledger[s.ticket].missed, 0);
process.exitCode = (missed || !cleanOk) ? 1 : 0;
