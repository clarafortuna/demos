/* CLCPA-193 + CLCPA-199 mutation controls.
 *
 * A green suite proves nothing on its own: it has to be shown to go RED when the
 * thing it guards is taken away. Each mutant below reverts exactly one part of
 * the change, and the control PASSES only if the suite fails AND the specific
 * assertion that should have caught it is the one that failed.
 *
 * This is the discipline that caught the circular census on CLCPA-209: a guard
 * that cannot fail is not a guard.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = path.join(__dirname, 'suite_193_199.js');
const SRC = fs.readFileSync(REPO + '/' + REL, 'utf8');
const TMP = path.join(__dirname, 'mutants');
fs.mkdirSync(TMP, { recursive: true });

const MUTANTS = [
  {
    name: 'M1  boot downloads again (revert the whole point)',
    // Put a download back into the boot loop.
    from: '      mlRegisterSavedMeta(rec);',
    to:   '      mlRegisterSavedMeta(rec);\r\n      Storage.getMapLayerFile(rec.dvId);',
    expect: 'HEADLINE: boot downloads ZERO GeoJSON files',
  },
  {
    name: 'M2  entries not marked pending',
    from: '    entry.geoPending = true;',
    to:   '    entry.geoPending = false;',
    expect: 'both marked geoPending',
  },
  {
    name: 'M3  refreshAll drops pending layers (a tick could never load)',
    from: '        if ((e.geo || e.geoPending || e.loadError) && e.active !== false) {',
    to:   '        if (e.geo && e.active !== false) {',
    expect: 'ticking a pending layer starts exactly one load',
  },
  {
    name: 'M4  refreshAll drops REFUSED layers (the defect PART 12 caught)',
    from: '        if ((e.geo || e.geoPending || e.loadError) && e.active !== false) {',
    to:   '        if ((e.geo || e.geoPending) && e.active !== false) {',
    expect: 're-ticking a refused layer unticks itself again',
  },
  {
    name: 'M5  no row for a pending layer (the layer becomes unreachable)',
    from: '        if (!entry.geo && !entry.geoPending) return;',
    to:   '        if (!entry.geo) return;',
    expect: 'initUploadedLayers builds a row for a pending layer',
  },
  {
    name: 'M6  the "superseded" chip is not excluded for pending layers',
    from: '            (!entry.geo && !entry.loadError && !entry.geoPending',
    to:   '            (!entry.geo && !entry.loadError',
    expect: 'the "superseded" chip excludes pending layers',
  },
  {
    name: 'M7  single-flight removed (concurrent ticks double-download)',
    from: '    if (_mlGeoFetch[entry.id]) return _mlGeoFetch[entry.id];',
    to:   '    if (false) return _mlGeoFetch[entry.id];',
    expect: 'THREE concurrent ensures download the file ONCE',
  },
  {
    name: 'M8  a superseded entry is allowed to fetch',
    from: '    if (!entry.geoPending || !entry.dvId) return Promise.resolve(null);',
    to:   '    if (!entry.dvId) return Promise.resolve(null);',
    expect: 'ensure on a superseded entry made no request',
  },
  {
    name: 'M9  the legend is built before the file arrives (empty breaks)',
    from: "        box.innerHTML = entry.geo ? mlLegendHtml(entry) : '';",
    to:   '        box.innerHTML = mlLegendHtml(entry);',
    expect: 'the legend box is left empty until the file arrives',
  },
  {
    name: 'M10 a failed load leaves the checkbox ticked',
    from: "            const cbErr = document.querySelector('#dac-map-terr input[data-ml-layer=\"' + entry.id + '\"]');\r\n            if (cbErr) cbErr.checked = false;",
    to:   "            const cbErr = null;\r\n            if (cbErr) cbErr.checked = false;",
    expect: 'the checkbox is UNTICKED, so the map matches the panel',
  },
  {
    name: 'M11 the byte-length helper allocates again',
    from: '    const parsed = mlValidateGeoJSON(text, utf8ByteLength(text));',
    to:   '    const parsed = mlValidateGeoJSON(text, new TextEncoder().encode(text).length);',
    expect: 'exactly two TextEncoder uses remain in code',
  },
  {
    name: 'M12 CLCPA-199: the tooltip stops hiding when the pointer leaves a tract',
    from: '        // Over the map but not over any feature. This is the dead mouseout.\r\n        clear();',
    to:   '        // Over the map but not over any feature. This is the dead mouseout.\r\n        return;',
    expect: 'over no feature: the tooltip IS hidden (the dead mouseout, restored)',
  },
  {
    name: 'M13 CLCPA-199: the overlay hand-off is removed (steals overlay tooltips)',
    from: "        if (e.target.closest('path')) return;",
    to:   "        if (false) return;",
    expect: "over an overlay path: the overlay's own tooltip is left alone",
  },
  {
    name: 'M14 CLCPA-199: no tracking inside a tract (the reported symptom)',
    from: '          positionTooltipAt({ originalEvent: e });\r\n          return;',
    to:   '          return;',
    expect: 'over a tract: the tooltip is repositioned',
  },
  {
    name: 'M15 CLCPA-199: the mouse bindings are removed (not additive any more)',
    from: "      layer.on('mousemove', positionTooltipAt);",
    to:   '',
    expect: 'ADDITIVE: the mousemove binding is untouched',
  },
  {
    name: 'M16 CLCPA-199: pointerleave not wired (tooltip strands off-map)',
    from: "      host.addEventListener('pointerleave', clear, true);",
    to:   '',
    expect: 'a pointerleave listener is installed',
  },
];

let redAsExpected = 0, problems = [];
console.log('Running ' + MUTANTS.length + ' mutation controls. Each MUST turn the suite red.');
console.log('');

MUTANTS.forEach((m, i) => {
  const n = SRC.split(m.from).length - 1;
  if (n !== 1) {
    problems.push(m.name + ': mutation anchor matched ' + n + ' times (expected 1)');
    console.log('  ??  ' + m.name + '  -- ANCHOR MATCHED ' + n + ' TIMES, control not run');
    return;
  }
  const mutant = SRC.replace(m.from, m.to);
  const f = path.join(TMP, 'app_m' + (i + 1) + '.js');
  fs.writeFileSync(f, mutant);

  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath, [SUITE],
      { env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: f }),
        cwd: REPO, maxBuffer: 1 << 28 }).toString();
  } catch (e) {
    code = e.status === undefined ? -1 : e.status;
    out = (e.stdout ? e.stdout.toString() : '') + (e.stderr ? e.stderr.toString() : '');
  }

  const wentRed = code !== 0;
  const failedLines = out.split('\n').filter(l => l.indexOf('  FAIL ') === 0);
  const caughtByExpected = failedLines.some(l => l.indexOf(m.expect) >= 0);

  if (wentRed && caughtByExpected) {
    redAsExpected++;
    console.log('  RED ' + m.name);
    console.log('      caught by: "' + m.expect + '"' +
      (failedLines.length > 1 ? '  (+' + (failedLines.length - 1) + ' more)' : ''));
  } else if (!wentRed) {
    problems.push(m.name + ': the suite stayed GREEN -- nothing guards this');
    console.log('  !!! ' + m.name + '  -- SUITE STAYED GREEN, THIS IS UNGUARDED');
  } else {
    problems.push(m.name + ': went red, but not on "' + m.expect + '" (got: ' +
      failedLines.map(l => l.trim()).join(' | ') + ')');
    console.log('  ~   ' + m.name + '  -- red, but a different assertion caught it');
    failedLines.forEach(l => console.log('      ' + l.trim()));
  }
});

console.log('');
console.log('================================================================');
console.log('  mutation controls: ' + redAsExpected + ' of ' + MUTANTS.length +
  ' turned the suite red on the expected assertion');
if (problems.length) {
  console.log('  PROBLEMS:');
  problems.forEach(p => console.log('    - ' + p));
}
console.log('================================================================');
process.exit(problems.length ? 1 : 0);
