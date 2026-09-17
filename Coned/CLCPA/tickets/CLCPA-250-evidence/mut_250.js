/* Mutation controls for CLCPA-250.
 *
 * The controls that carry this ticket: the two triggers, the no-movement gate,
 * the parachute gate (without which a year change silently moves published
 * percentages), and the "one derive engine" rule -- a recompute carrying its
 * own copy of a KPI rule would be a second source of truth for the same
 * figure, which is the defect the whole composer exists to prevent.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-250-evidence';
const APP = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_250.js';

const M = [
  /* ---- the triggers -------------------------------------------------------- */
  { t: APP, name: 'THE DEFECT RETURNS: a save no longer re-derives',
    from: '      recomposeYearIfComposed(i.year);',
    to:   '',
    expect: 'E2 a SAVE re-derives the year it just wrote',
    alt: 'E1 the gate is declared once and called twice' },
  { t: APP, name: 'THE YEAR TRIGGER is removed',
    from: '      recomposeYearIfComposed(state.year);',
    to:   '',
    expect: 'E3 and changing the reporting year re-derives the year selected',
    alt: 'E1 the gate is declared once and called twice' },
  { t: APP, name: 'THE SAVE RE-DERIVES THE WRONG YEAR',
    from: '      recomposeYearIfComposed(i.year);',
    to:   '      recomposeYearIfComposed(state.year);',
    expect: 'E2 a SAVE re-derives the year it just wrote' },

  /* ---- the parachute gate --------------------------------------------------- */
  { t: APP, name: 'THE PARACHUTE GATE IS REMOVED: payload.json figures start moving',
    from: "    if (DAC_SOURCE !== 'dataverse') return 0;",
    to:   '',
    expect: 'G2 and the recompute is gated to the composed source' },
  { t: APP, name: 'THE GATE IS INVERTED',
    from: "    if (DAC_SOURCE !== 'dataverse') return 0;",
    to:   "    if (DAC_SOURCE === 'dataverse') return 0;",
    expect: 'G2 and the recompute is gated to the composed source' },

  /* ---- the engine ----------------------------------------------------------- */
  /* THE ANCHORS TAKE THEIR LEADING NEWLINE. The recompute and the composer
   * carry the same two lines at different depths (6 spaces against 8), and a
   * 6-space anchor is a SUBSTRING of the 8-space line -- both reported
   * ANCHOR 2 and applied nothing. Indentation only pins a line when the line
   * break in front of it is part of the anchor. */
  { t: APP, name: 'CLCPA-237 ITEM E IS UNDONE: a phantom entry is written again',
    from: "\r\n      const usable = v && (typeof v.total === 'number' || typeof v.dac === 'number');",
    to:   '\r\n      const usable = v && (v.total !== undefined || v.dac !== undefined);',
    expect: 'F6 "has a usable value" (CLCPA-237 item E) is the test IN THE RECOMPUTE, unchanged',
    alt: 'B2 NOT ONE composed year\'s KPI or chart values moved' },
  { t: APP, name: 'A STALE ENTRY SURVIVES when a year stops being derivable',
    from: '      } else if (k.values[y] !== undefined) {\r\n        delete k.values[y];\r\n      }',
    to:   '      }',
    expect: 'F7 a year that stops being derivable LOSES its entry' },
  { t: APP, name: 'dac_pct IS COMPUTED INLINE instead of through the shipped helper',
    from: '\r\n        e.dac_pct = kpiDacPct(e);\r\n        k.values[y] = e;\r\n        wrote++;',
    to:   '\r\n        e.dac_pct = (typeof e.dac === \'number\' && e.total) ? e.dac / e.total : null;\r\n        k.values[y] = e;\r\n        wrote++;',
    expect: 'F9 and dac_pct IN THE RECOMPUTE still goes through the shipped kpiDacPct' },
  { t: APP, name: 'THE RECOMPUTE TOUCHES EVERY YEAR, not the one it was given',
    from: '    const T = dacDerivedTablesForYear(payload, y);',
    to:   '    const T = dacDerivedTablesForYear(payload, y);\r\n    Object.keys((payload.charts) || {}).forEach(k2 => { const c2 = payload.charts[k2]; if (c2 && c2.values) Object.keys(c2.values).forEach(y2 => { if (y2 !== y) delete c2.values[y2]; }); });',
    expect: 'B4 and every OTHER year is untouched by a recompute of 2097',
    alt: 'B2 NOT ONE composed year\'s KPI or chart values moved' },
  { t: APP, name: 'THE DISPLAY VIEW is skipped, so the recompute sees different rows',
    from: '      if (rows) d.data[year] = rowsForDisplay(rows, getTableSchema(t, year), id);',
    to:   '      if (rows) d.data[year] = rows;',
    /* C6 cannot catch this: H1 has no derived columns, so its rows survive the
     * display view unchanged either way. The divergence count does move,
     * because other tables DO have derive rules. */
    expect: 'G1 exactly 19 stored KPI entries disagree with the engine',
    alt: 'B2 NOT ONE composed year\'s KPI or chart values moved' },

  /* ---- the composer's schema fallback ---------------------------------------- */
  { t: APP, name: 'THE THIRD LIFE RETURNS: the composer reads the schema directly again',
    from: '        d.data[y] = rowsForDisplay(t.data[y], getTableSchema(t, y), id);',
    to:   '        d.data[y] = rowsForDisplay(t.data[y], (t.schema_by_year || {})[y] || null, id);',
    expect: 'C2 that direct read is gone FROM THE COMPOSER',
    alt: 'C3 and the composer now resolves it through getTableSchema, as the editor does' },
  { t: APP, name: 'THE SHADOW COMPARATOR is changed too, which this ticket did not ask for',
    from: '          const schema = (t.schema_by_year || {})[y] || null;\r\n          d.data[y] = rowsForDisplay(t.data[y], schema, id);',
    to:   '          d.data[y] = rowsForDisplay(t.data[y], getTableSchema(t, y), id);',
    expect: 'C2b and the shadow comparator keeps its own symmetric read, untouched' },

  /* ---- no hardcoding, nothing stored ----------------------------------------- */
  { t: APP, name: 'A TABLE IS HARDCODED into the recompute',
    from: '    const src = (payload && payload.tables) || {};',
    to:   "    const src = (payload && payload.tables) || {};\r\n    if (!src['H1']) return 0;",
    expect: 'F1 no added code line names a table id' },
  { t: APP, name: 'THE RECOMPUTE STARTS WRITING to storage',
    from: '    let wrote = 0;\r\n    const kpis = payload.kpis || {};',
    to:   '    let wrote = 0;\r\n    Storage.saveTable(null, y, []);\r\n    const kpis = payload.kpis || {};',
    expect: 'F4 the recompute writes nothing to storage' },

  /* ---- the harness ------------------------------------------------------------ */
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '4016675';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X1 BASE is pinned to a literal commit sha' },
  { t: SUITE, name: 'HARNESS: the no-movement gate is baselined on payload.json again',
    from: '  const composed = clone(P);\r\n  storedYears.forEach(y => now(a => a.recomputeYearDerived(composed, y)));',
    to:   '  const composed = clone(P);',
    /* the round-1 mistake: comparing the recompute against stored values that
     * this engine never produced. It must not be able to come back unnoticed. */
    expect: 'B2 NOT ONE composed year\'s KPI or chart values moved' },
  { t: SUITE, name: 'HARNESS: the org fixtures are retyped with a wrong total',
    from: "  ['Grand Total', 3919188, 3919188, 7838376]];",
    to:   "  ['Grand Total', 3919188, 3919188, 7838377]];",
    expect: 'X4 the 2097 fixture reconciles with itself',
    alt: 'A5 with the total from the org\'s own rows' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-250 -- mutation controls');
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
  try { out = execFileSync('node', ['suite_250.js'], { cwd: DIR, encoding: 'utf8' }); }
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
try { clean = execFileSync('node', ['suite_250.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-250-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
