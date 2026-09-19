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
/* Mutation controls for CLCPA-277.
 *
 * The digit-boundary controls are the ones with history: CLCPA-252 round 3
 * shipped a \b guard that missed glued tokens AND an assertion that used the
 * same \b, so the harness was blind exactly where the code was. Both
 * directions are controlled here.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync, execSync } = require('child_process');

const REPO = _dacRepo() + '';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-277-evidence';
/* THE MUTATION TARGET IS THE PINNED BUILD, not the working tree. The suite
 * reads NEWREV unless DAC_APP_OVERRIDE says otherwise, so mutating the
 * repo's own file would change something the suite never opens and every
 * control would pass green. Same pattern as mut_271 and mut_244_r2. */
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || '7260063';
const APP = path.join(os.tmpdir(), 'clcpa-277-app-' + NEW_COMMIT + '.js');
fs.writeFileSync(APP, execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n'));
const SUITE = DIR + '/suite_277.js';

const M = [
  /* ---- the defect returns ------------------------------------------------ */
  { t: APP, name: 'THE DEFECT RETURNS: the year advisory is never raised',
    from: "    if (!declared || !destYear || declared === String(destYear)) return null;",
    to:   '    return null;',
    expect: 'A2 importing it into 2097 raises an advisory' },
  { t: APP, name: 'IT FIRES ON THE RIGHT YEAR TOO, so it says nothing useful',
    from: '    if (!declared || !destYear || declared === String(destYear)) return null;',
    to:   '    if (!declared || !destYear) return null;',
    expect: 'A4 and importing it into 2099 says nothing' },
  { t: APP, name: 'ONLY ONE YEAR is named, so the operator cannot compare',
    from: "    return 'This file is named for ' + declared +\r\n      ', but it is being imported into ' + String(destYear) + '. ' +",
    to:   "    return 'This file is named for another year. ' +",
    expect: 'A3 naming BOTH years -- the file\'s and the target\'s',
    alt: 'C6 and both years' },

  /* ---- the digit boundary, both directions ------------------------------- */
  { t: APP, name: 'THE \\b TRAP: word boundaries instead of digit capture',
    from: "    base.replace(/(\\d?)((?:19|20)\\d{2})(\\d?)/g, (m, before, y, after) => {\r\n      if (!before && !after) out.push(y);\r\n      return m;\r\n    });",
    to:   "    (base.match(/\\b(?:19|20)\\d{2}\\b/g) || []).forEach(y => out.push(y));",
    /* the \b form also loses "2097_H1" entirely: _ is a word character, so
     * there is no boundary between the digits and the underscore. That is a
     * sharper demonstration of the trap than the glued-token case. */
    expect: 'B2 a leading year is found',
    alt: 'B5 a five-digit run is NOT a year -- the digit boundary holds' },
  { t: APP, name: 'NO BOUNDARY AT ALL: any four digits count',
    from: '      if (!before && !after) out.push(y);',
    to:   '      out.push(y);',
    expect: 'B5 a five-digit run is NOT a year -- the digit boundary holds',
    alt: 'B6 nor one with a digit in front' },

  /* ---- the rest of the derivation ---------------------------------------- */
  /* THE TABLE-ID STRIP HAS NO CONTROL, because it no longer exists. I wrote
   * one, measured it across 13 plausible template names, found it changed the
   * answer for none of them -- a table id is a letter and one or two digits
   * and cannot reach four -- and deleted it. A mutation of code that cannot
   * fire would have been a control that cannot fail, so there is none, and
   * the measurement is recorded in suite_277 B1b instead. */
  { t: APP, name: 'TWO DIFFERENT YEARS in a name now declare the first',
    from: '    return uniq.length === 1 ? uniq[0] : null;',
    to:   '    return uniq.length ? uniq[0] : null;',
    expect: 'B7 a name carrying TWO different years declares neither' },
  { t: APP, name: 'THE YEARS ARE LOOKED UP IN A LIST instead of derived',
    from: '    const uniq = out.filter((y, i, a) => a.indexOf(y) === i);',
    to:   "    const uniq = out.filter((y, i, a) => a.indexOf(y) === i)\r\n      .filter(y => ['2023', '2024', '2025'].indexOf(y) >= 0);",
    expect: 'B9 a year that is in no payload and no selector still resolves',
    alt: 'B10 and the derivation names no year at all' },

  /* ---- the two surfaces --------------------------------------------------- */
  { t: APP, name: 'THE STAGED SURFACE loses the advisory',
    from: "        (yrNote ? '<p class=\"ingest-staged-warn\" id=\"dlg-year-warn\">' +\r\n          escapeHtml(yrNote) + '</p>' : '') +\r\n",
    to:   '',
    expect: 'C2 with its own staged line' },
  { t: APP, name: 'THE POST-LOAD SURFACE loses the advisory',
    from: "      '</div>' + notices + identity + yearAdvisory +\r\n      renderReconcileNotice(r.reconcileNotices);",
    to:   "      '</div>' + notices + identity +\r\n      renderReconcileNotice(r.reconcileNotices);",
    expect: 'C4 the post-load box is RED', alt: 'C7 a file wrong in BOTH ways raises TWO red boxes' },
  { t: APP, name: 'THE BOX IS AMBER, so it reads as advice rather than a mismatch',
    from: "    const yearAdvisory = r.yearNotice\r\n      ? '<div class=\"ingest-import-notice is-alert\">' +\r\n        '<h4>Check the year this file was for</h4>' +",
    to:   "    const yearAdvisory = r.yearNotice\r\n      ? '<div class=\"ingest-import-notice is-warn\">' +\r\n        '<h4>Check the year this file was for</h4>' +",
    expect: 'C4 the post-load box is RED', alt: 'C7 a file wrong in BOTH ways raises TWO red boxes' },
  { t: APP, name: 'THE STAGED SURFACE reads the wrong year (the table\'s, not the target\'s)',
    from: '      const yrNote = importYearNotice(staged.name, target().year);',
    to:   '      const yrNote = importYearNotice(staged.name, i && i.year);',
    expect: 'C1 STAGED in the Add Data modal, from the dropdown the operator can change' },

  /* ---- CLCPA-264 must not move -------------------------------------------- */
  { t: APP, name: 'CLCPA-264\'s own notice is "improved" alongside',
    from: "    return 'This file is named for Table ' + nameOf(declared) +",
    to:   "    return 'This file appears to be for Table ' + nameOf(declared) +",
    expect: 'D3 importIdentityNotice is BYTE-IDENTICAL to BASE' },

  /* ---- the harness -------------------------------------------------------- */
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '22c96cc';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X1 BASE is a literal sha' },
  { t: SUITE, name: 'HARNESS: the derivation is re-implemented instead of sliced',
    from: 'const year = (n) => run(a => a.declaredYearFromFilename(n));',
    to:   "const year = (n) => { const m = /((?:19|20)\\d{2})/.exec(String(n)); return m ? m[1] : null; };",
    expect: 'X3 the function under test is the one sliced from app.js',
    alt: 'B5 a five-digit run is NOT a year' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-277 -- mutation controls');
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
  try { out = execFileSync('node', ['suite_277.js'], { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }
  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const want = [m.expect].concat(m.alt ? [m.alt] : []);
  const hit = fails.filter(l => want.some(w => l.indexOf(w) >= 0));
  if (hit.length) {
    log('  red  ' + m.name);
    log('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 110));
    caught++;
  } else if (fails.length) {
    log('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    log('       want: ' + want.join(' OR '));
    log('       got : ' + fails[0].trim().slice(5, 110));
    missed++;
  } else { log('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.'); missed++; }
});

log('');
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + applied + ' applied');
let clean = '';
try { clean = execFileSync('node', ['suite_277.js'], { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-277-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
