/* Mutation controls for the three pre-walkthrough fixes. */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DIR = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/prewalkthrough-evidence';
const APP = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const CSS = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/styles.css';

const M = [
  /* ---- item 1, the chip ---------------------------------------------- */
  { t: APP, name: 'THE CHIP LIES AGAIN: the NEW-status disjunct comes back',
    from: "    const isNew = !hasPrevData;",
    to:   "    const isNew = !hasPrevData || (mapping.status || '') === 'NEW';",
    expect: 'A9 on 2025 with 2024 present: NO CHIP' },
  { t: APP, name: 'the chip stops rendering even when the baseline IS absent',
    from: "    const isNew = !hasPrevData;",
    to:   "    const isNew = false;",
    expect: 'A9 on 2024, where 2023 is genuinely absent: the chip RENDERS' },
  { t: APP, name: 'the header-row skip is dropped from the baseline check',
    from: "    const storedHeaderRows = Math.max(0, headerLevels - 1);\n    const bodyRowsCurrent",
    to:   "    const storedHeaderRows = 0;\n    const bodyRowsCurrent",
    expect: 'the check skips stored header rows' },

  /* ---- item 2, the header band --------------------------------------- */
  { t: CSS, name: 'the dashed input border comes back on the sub-header',
    from: "  border: none;\n  background: transparent;\n  border-radius: 0;\n  font-family: inherit;",
    to:   "  border-radius: 0;\n  font-family: inherit;",
    expect: 'no border: the dashed box is gone' },
  { t: CSS, name: 'the mono figure face comes back on the header labels',
    from: "  font-family: inherit;\n  text-align: center;",
    to:   "  text-align: center;",
    expect: 'not the mono figure face' },
  { t: CSS, name: 'the sub-labels stop centring',
    from: "  font-family: inherit;\n  text-align: center;\n  padding: 6px 4px;",
    to:   "  font-family: inherit;\n  padding: 6px 4px;",
    expect: 'sub-labels centre in their columns (editor)' },
  { t: CSS, name: 'the editor group headers stop centring',
    from: ".ingest-grid-2level thead th { text-align: center; }",
    to:   ".ingest-grid-2level thead th { text-align: left; }",
    expect: 'group headers centre in the editor' },
  { t: CSS, name: 'the VIEWER group headers stop centring',
    from: ".data-table-2level thead th { text-align: center; }",
    to:   ".data-table-2level thead th { text-align: left; }",
    expect: 'and in the read-only viewer' },
  { t: CSS, name: 'the centring loses its scope and hits every editor grid',
    from: ".ingest-grid-2level thead th { text-align: center; }",
    to:   ".ingest-grid thead th { text-align: center; }",
    /* 48 of the 52 tables are single-level and must keep their alignment */
    expect: 'the centring is scoped to two-level tables' },
  { t: APP, name: 'the editor stops merging group headers, so 2024 appears twice',
    from: "      if (!isTwoLevel) {",
    to:   "      if (true) {",
    expect: 'which merges to 4 header cells' },
  { t: APP, name: 'the merge runs on SINGLE-level tables too',
    from: "      if (!isTwoLevel) {\n        return i.schema.map((col, idx) =>",
    to:   "      if (false) {\n        return i.schema.map((col, idx) =>",
    expect: 'single-level tables take the untouched path' },
  { t: APP, name: 'THE DEFECT THE SWEEP CAUGHT: a name from another function',
    from: "      if (!isTwoLevel) {",
    to:   "      if (storedHeaderRows === 0) {",
    /* renderIngestEditor has no such name: every Report Data render throws */
    expect: 'storedHeaderRows is not defined' },
  { t: APP, name: 'the thead merge is coupled to the draft length again',
    from: "    const isTwoLevel = headerLevelsNum >= 2;",
    to:   "    const isTwoLevel = headerLevelsNum >= 2 && i.draft.length > 0;",
    expect: 'a two-level table with an EMPTY draft still merges' },
  { t: APP, name: 'the two-level marker is decided by the row count, not the level',
    from: "    const headerLevelsNum = (typeof table.header_levels === 'number')\n      ? table.header_levels : 1;",
    to:   "    const headerLevelsNum = i.draft.length;",
    expect: 'A1, single-level, renders and does NOT get the marker' },
  { t: APP, name: 'the viewer loses its two-level marker',
    from: "    const tblCls = headerLevels === 2 ? 'data-table data-table-2level' : 'data-table';",
    to:   "    const tblCls = 'data-table';",
    expect: 'the viewer table carries the marker the stylesheet needs' },
  { t: APP, name: 'BEHAVIOUR CREEP: the header row becomes editable again',
    from: "        if (isHeaderRow) {\n          const text",
    to:   "        if (false) {\n          const text",
    /* the brief said presentation only; a behavioural change must fail */
    expect: 'the header row still renders read-only' },

  /* ---- item 3, the empty state: CONTROLS REMOVED, SUBJECT DELETED ----
   *
   * CLCPA-237 item F deleted the empty branch, so these 12 controls had
   * nothing left to mutate -- they reported "ANCHOR 0, NOT APPLIED" rather
   * than catching anything, and suite_prewalk section 3 now reads the pinned
   * d658ab7 where its subject still exists.
   *
   * Every one has a live successor in mut_237f, and one transfer matters:
   * THE REGRESSION GUARD -- "the POPULATED branch is edited", the 2025
   * zero-visual-diff control -- lives there now and goes red there. The
   * claim changed owner; it was not dropped. */
  /* ---- the exclusions the brief named -------------------------------- */
  { t: APP, name: 'EXCLUSION: D.1 is dragged into the header family',
    from: "      if (typeof lv !== 'number' || lv < 2) return 0;",
    to:   "      if (typeof lv !== 'number') return 0; if (lv < 2) return Math.min(1, i.draft.length);",
    expect: 'D.1 stays outside the header family' },
  { t: APP, name: 'EXCLUSION: the derive engine is touched',
    from: "  function applyDerivedCols(rows, tableId, colSum, schema) {",
    to:   "  function applyDerivedCols(rows, tableId, colSum, schema) {\n    void 0;",
    expect: 'applyDerivedCols is byte-identical to BASE' },
  { t: APP, name: 'EXCLUSION: DAC_SOURCE is flipped back',
    from: "  var DAC_SOURCE = 'dataverse';",
    to:   "  var DAC_SOURCE = 'payload';",
    expect: "DAC_SOURCE is still 'dataverse'" },
  { t: APP, name: 'EXCLUSION: a function outside the four is changed',
    from: "  function ingestSelectionKey() {",
    to:   "  function ingestSelectionKey() {\n    void 0;",
    expect: 'no function outside those seven moved at all' },
];

let caught = 0, missed = 0;
const report = [];
M.forEach((m) => {
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  if (n !== 1) {
    report.push('  ??? ' + m.name + ' -- ANCHOR ' + n + ', NOT APPLIED');
    missed++; return;
  }
  fs.writeFileSync(m.t, base.replace(from, () => to));
  let out = '';
  try { out = execFileSync('node', ['suite_prewalk.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }

  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const hit = fails.filter(l => l.indexOf(m.expect) >= 0);
  if (hit.length) {
    report.push('  red  ' + m.name);
    report.push('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 100));
    caught++;
  } else if (fails.length) {
    report.push('  ??? ' + m.name + ' -- ' + fails.length + ' red, not the expected one');
    report.push('       want: ' + m.expect);
    report.push('       got : ' + fails[0].trim().slice(5, 100));
    missed++;
  } else {
    report.push('  GREEN ' + m.name + ' -- NOT NOTICED. Not a guard.');
    missed++;
  }
});

let cleanOk = true;
try { execFileSync('node', ['suite_prewalk.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) {
  cleanOk = false;
  console.error('THE CLEAN RE-RUN FAILED.');
  console.error((e.stdout || '').split('\n').filter(l => /FAIL/.test(l)).join('\n'));
}

console.log('======================================================================');
console.log('PRE-WALKTHROUGH FIXES -- mutation controls');
console.log('======================================================================');
report.forEach(l => console.log(l));
console.log('');
console.log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length);
console.log('  clean re-run against restored source: ' + (cleanOk ? 'PASSES' : 'FAILED'));
process.exitCode = (missed || !cleanOk) ? 1 : 0;
