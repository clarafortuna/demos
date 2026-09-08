/* Mutation controls for the badge round.
 *
 * The one that matters most is the first: put the save handler back the way it
 * shipped. If that does not go red, the round's whole point is unguarded.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const DIR = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/badge-title-case-evidence';
const APP = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/app.js';

const M = [
  /* ---- THE DEFECT ITSELF ---------------------------------------------- */
  { name: 'THE SHIPPED BUG RESTORED: the save handler stops adopting the reference',
    from: "      i.baseline = clone2D(i.draft);\n      adoptIngestReference();",
    to:   "      i.baseline = clone2D(i.draft);\n      i.dirty = false;",
    /* Caught only by the STRUCTURAL pin, and that is the honest reading: the
     * behavioural test drives adoptIngestReference directly, so it cannot see
     * whether the save path calls it. Both guards exist for that reason. */
    expect: 'adopts the badge reference through the one helper' },
  { name: 'the save handler sets dirty by hand as well, so the pair can drift again',
    from: "      adoptIngestReference();",
    to:   "      adoptIngestReference();\n      i.dirty = false;",
    expect: 'does NOT set i.dirty by hand' },
  { name: 'the baseline is no longer moved to the saved draft',
    from: "      i.baseline = clone2D(i.draft);\n      adoptIngestReference();",
    to:   "      adoptIngestReference();",
    expect: 'still adopts the saved draft as the new baseline' },

  /* ---- the helper's internals ----------------------------------------- */
  { name: 'adoption stops recomputing, so the reference is the raw baseline',
    from: "    i.dirtyRef = clone2D(i.baseline);\n    recomputeTotals(i.dirtyRef, i.schema, i.tableId, i.baseline);",
    to:   "    i.dirtyRef = clone2D(i.baseline);",
    expect: 'the reference holds the COMPUTED value' },
  { name: 'adoption recomputes the BASELINE IN PLACE, corrupting the source',
    from: "    i.dirtyRef = clone2D(i.baseline);\n    recomputeTotals(i.dirtyRef, i.schema, i.tableId, i.baseline);",
    to:   "    recomputeTotals(i.baseline, i.schema, i.tableId, i.baseline);\n    i.dirtyRef = i.baseline;",
    expect: 'on a COPY, so the baseline itself is never recomputed' },
  { name: 'adoption leaves the draft dirty',
    from: "    i.dirtyRef = clone2D(i.baseline);\n    recomputeTotals(i.dirtyRef, i.schema, i.tableId, i.baseline);\n    i.dirty = false;",
    to:   "    i.dirtyRef = clone2D(i.baseline);\n    recomputeTotals(i.dirtyRef, i.schema, i.tableId, i.baseline);\n    i.dirty = true;",
    /* This one ran GREEN on the first pass and was the round's one real
     * harness gap: every caller renders immediately after adopting, and the
     * render recomputes, so a dirty flag left by adoption was always corrected
     * a moment later and nothing could see it. The suite now asserts adoption
     * is clean BEFORE any recompute, which is what makes this a control. */
    expect: 'adoption leaves the state clean by itself' },
  { name: 'recomputeDirty compares against the baseline again (CLCPA-212 returns)',
    from: "    const ref = i.dirtyRef || i.baseline;",
    to:   "    const ref = i.baseline;",
    expect: 'a table whose stored value is rounded opens CLEAN' },
  { name: 'loadIngestDraft stops adopting, so a fresh open has no reference',
    from: "    adoptIngestReference();\n    // CLCPA-85: a result describes ONE table-year.",
    to:   "    i.dirty = false;\n    // CLCPA-85: a result describes ONE table-year.",
    /* My first run predicted the function-level diff would catch this. It did
     * not: the mutated loadIngestDraft still differs from BASE, so it stays in
     * the accounted-for list. What caught it was the mention COUNT, which names
     * no caller -- so the suite now pins the caller by name and this expects
     * that. The mutation was always caught; my prediction was wrong. */
    expect: 'loadIngestDraft adopts the reference when a table is opened' },

  /* ---- the badge text ------------------------------------------------- */
  { name: 'the badge reverts to sentence case',
    from: "    return dirty ? '● Unsaved Changes' : '○ No Changes';",
    to:   "    return dirty ? '● Unsaved changes' : '○ No changes';",
    expect: 'the dirty badge reads "● Unsaved Changes"' },
  { name: 'the in-place refresh spells the words out again, so the two can drift',
    from: "      status.textContent = ingestStatusText(dirty);",
    to:   "      status.textContent = dirty ? '● Unsaved Changes' : '○ No Changes';",
    expect: 'the dirty/clean pair is written exactly once' },
  { name: 'the full draw spells them out again',
    from: "    const statusHtml = `<span class=\"${ingestStatusClass(i.dirty)}\">` +\n      escapeHtml(ingestStatusText(i.dirty)) + `</span>`;",
    to:   "    const statusHtml = i.dirty\n      ? `<span class=\"ingest-status modified\">● Unsaved Changes</span>`\n      : `<span class=\"ingest-status clean\">○ No Changes</span>`;",
    expect: 'the full draw calls it' },
  { name: 'the modified/clean class stops following the state',
    from: "    return 'ingest-status ' + (dirty ? 'modified' : 'clean');",
    to:   "    return 'ingest-status clean';",
    expect: 'the modified/clean class is centralised with it' },

  /* ---- the ruled and swept labels ------------------------------------- */
  { name: 'the Save button reverts',
    from: ">Save Changes</button>",
    to:   ">Save changes</button>",
    expect: 'the save button reads "Save Changes"' },
  { name: 'the add-row link reverts',
    from: ">+ Add Row</button>",
    to:   ">+ Add row</button>",
    expect: 'the add-row link is title case' },
  { name: 'the history heading reverts',
    from: "<h4>Change History <span class=\"ingest-history-count\">",
    to:   "<h4>Change history <span class=\"ingest-history-count\">",
    expect: 'the history heading, populated is title case' },
  { name: 'the toggle halves disagree: title case initially, sentence case after a click',
    from: "isOpen ? 'Show Details' : 'Hide Details'",
    to:   "isOpen ? 'Show details' : 'Hide details'",
    expect: 'the toggle in js is title case' },
  { name: 'the form labels revert',
    from: ">Your Name</label>",
    to:   ">Your name</label>",
    expect: 'the name field label is title case' },

  /* ---- THE RULE, not the list ---------------------------------------- */
  { name: 'A NEW sentence-case label is added, one the list does not mention',
    from: "          <button id=\"ingest-add-row\" class=\"btn btn-link\" type=\"button\">+ Add Row</button>",
    to:   "          <button id=\"ingest-add-row\" class=\"btn btn-link\" type=\"button\">+ Add Row</button>\n          <button id=\"ingest-copy-year\" class=\"btn btn-link\" type=\"button\">Copy from previous year</button>",
    /* This is the mutation the rule-based sweep exists for: a label nobody
     * pinned, added later, in the wrong case. */
    expect: 'UNEXPLAINED sentence-case label' },

  /* ---- the exclusions ------------------------------------------------- */
  { name: 'the CLCPA-226 tooltip is retitled, re-opening a closed ticket\'s evidence',
    from: "data-tip=\"Delete row\" aria-label=\"Delete row\"",
    to:   "data-tip=\"Delete Row\" aria-label=\"Delete Row\"",
    expect: 'the delete-row tooltip still reads "Delete row"' },
  { name: 'the history SUMMARY prose is title-cased, breaking its own family',
    from: "    if (!changes || changes.length === 0) return 'No changes';",
    to:   "    if (!changes || changes.length === 0) return 'No Changes';",
    expect: 'its "No changes" is unchanged: it is prose' },
  { name: 'the CLCPA-234 panel is edited, which this round may not do',
    from: "      '<p>Review the values below, then press Save. Nothing has been saved yet.</p>' +",
    to:   "      '<p>Review the values below, then press Save.</p>' +",
    expect: 'the import result panel is unchanged by this round' },

  /* ---- the blast-radius claim ---------------------------------------- */
  { name: 'an UNRELATED function is changed, which the round claims none were',
    from: "  function ingestSelectionKey() {",
    to:   "  function ingestSelectionKey() {\n    void 0;",
    expect: 'no function outside that list moved at all' },
  { name: 'a helper is renamed, so the new-function set no longer matches',
    from: "  function ingestStatusClass(dirty) {",
    to:   "  function ingestStatusClassName(dirty) {",
    expect: 'exactly the three intended helpers are new' },
];

let caught = 0, missed = 0;
const report = [];
M.forEach((m) => {
  const base = fs.readFileSync(APP, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  if (n !== 1) {
    report.push('  ??? ' + m.name + ' -- ANCHOR ' + n + ', NOT APPLIED');
    missed++; return;
  }
  fs.writeFileSync(APP, base.replace(from, () => to));
  let out = '';
  try { out = execFileSync('node', ['suite_badge.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(APP, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(APP, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }

  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const hit = fails.filter(l => l.indexOf(m.expect) >= 0);
  if (hit.length) {
    report.push('  red  ' + m.name);
    report.push('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 108));
    caught++;
  } else if (fails.length) {
    report.push('  ??? ' + m.name + ' -- ' + fails.length + ' red, not the expected one');
    report.push('       want: ' + m.expect);
    report.push('       got : ' + fails[0].trim().slice(5, 108));
    missed++;
  } else {
    report.push('  GREEN ' + m.name + ' -- NOT NOTICED. Not a guard.');
    missed++;
  }
});

/* CLEAN RE-RUN against restored source, per the standing law. */
let cleanOk = true;
try {
  execFileSync('node', ['suite_badge.js'], { cwd: DIR, encoding: 'utf8' });
} catch (e) {
  cleanOk = false;
  console.error('THE CLEAN RE-RUN FAILED: the restored source does not pass.');
  console.error((e.stdout || '').split('\n').filter(l => /FAIL/.test(l)).join('\n'));
}

console.log('======================================================================');
console.log('THE BADGE ROUND -- mutation controls');
console.log('======================================================================');
report.forEach(l => console.log(l));
console.log('');
console.log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length);
console.log('  clean re-run against restored source: ' + (cleanOk ? 'PASSES' : 'FAILED'));
process.exitCode = (missed || !cleanOk) ? 1 : 0;
