/* Mutation controls for CLCPA-252 round 3.
 *
 * The dangerous directions:
 *
 *   THE WORD-BOUNDARY REGRESSION. This is the defect this ticket actually
 *   shipped once: `\b` after the year leaves "2023Incentive" and "2023For"
 *   untouched while 151 of 153 captions strip correctly. It looks like success
 *   everywhere an eye is likely to land. Its control is first.
 *
 *   IT REACHES A NON-YEAR. A rule loose enough to take four digits out of a
 *   measure code, a form number or a voltage.
 *
 *   IT WRITES BACK. The strip is render-side; mutating the stored title is the
 *   one thing the ruling forbids outright.
 *
 *   IT MISSES A SURFACE. A strip applied at one call site rather than in the
 *   shared helper leaves the other surface showing years.
 *
 *   IT LEAVES A MESS. A dangling "in", an empty "()", a doubled space.
 *
 *   ROUND 2 IS BROKEN. D2 stops falling back, or a caption cites a PDF page.
 *
 * Ends with a CLEAN re-run against byte-restored source and says so loudly.
 */
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-252-r3-evidence';
const APP = REPO + '/Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const SUITE = DIR + '/suite_252_r3.js';

const M = [
  /* ---- the defect this ticket shipped once -------------------------------- */
  { t: APP, name: 'THE WORD-BOUNDARY REGRESSION: the two glued titles keep their year',
    from: "    out = out.replace(/(\\d?)((?:19|20)\\d{2})(\\d?)/g,\r\n" +
          "                      (m, before, y, after) => (before || after) ? m : '');",
    to:   "    out = out.replace(/\\b(?:19|20)\\d{2}\\b/g, '');",
    expect: 'L6 A1:2023 stores "2023Incentive" with no space, and still strips',
    alt: 'A2 NOT ONE carries a year' },

  /* ---- it reaches a non-year --------------------------------------------- */
  { t: APP, name: 'IT REACHES A NON-YEAR: any four digits are stripped',
    from: "    out = out.replace(/(\\d?)((?:19|20)\\d{2})(\\d?)/g,\r\n" +
          "                      (m, before, y, after) => (before || after) ? m : '');",
    to:   "    out = out.replace(/(\\d?)(\\d{4})(\\d?)/g,\r\n" +
          "                      (m, before, y, after) => (before || after) ? m : '');",
    expect: 'N4 untouched:',
    alt: 'N4 untouched: "Table X2. Circuit 4160 Volts"' },
  { t: APP, name: 'IT REACHES A NON-YEAR: the digit guard is dropped, so 12345 loses its middle',
    from: '                      (m, before, y, after) => (before || after) ? m : \'\');',
    to:   "                      (m, before, y, after) => '');",
    expect: 'N4 untouched:' },

  /* ---- it writes back ----------------------------------------------------- */
  { t: APP, name: 'IT WRITES BACK: the stored title is mutated',
    from: '    const stored = (t.title_by_year || {})[year];\r\n    if (stored) return stripCaptionYear(stored);',
    to:   '    const stored = (t.title_by_year || {})[year];\r\n' +
          '    if (stored) { t.title_by_year[year] = stripCaptionYear(stored); return t.title_by_year[year]; }',
    expect: 'D2 carrying 67 year tokens between them, unchanged',
    alt: 'D3 and rendering a caption does not touch title_by_year' },

  /* ---- it misses a path or a surface -------------------------------------- */
  { t: APP, name: 'IT MISSES A PATH: the stored branch skips the strip',
    from: '    if (stored) return stripCaptionYear(stored);',
    to:   '    if (stored) return stored;',
    expect: 'A2 NOT ONE carries a year' },
  { t: APP, name: 'IT MISSES A PATH: the derived branch skips the strip',
    from: '    if (derived) return stripCaptionYear(derived);',
    to:   '    if (derived) return derived;',
    /* only a fresh year reaches the derived branch, and only strategy A's 13
     * donors carry a year -- so this is invisible on stored years alone */
    expect: 'A2 NOT ONE carries a year' },

  /* ---- it leaves a mess --------------------------------------------------- */
  { t: APP, name: 'IT LEAVES A MESS: the parenthesised-year pass is dropped',
    from: "    out = out.replace(/\\s*\\(\\s*(?:19|20)\\d{2}\\s*\\)/g, '');",
    to:   '    out = out;',
    expect: 'L4 F2 loses its empty parentheses' },
  { t: APP, name: 'IT LEAVES A MESS: the preposition pass is dropped',
    from: "    out = out.replace(/\\s+\\b(?:in|for|of|during|through)\\b\\s+(?:19|20)\\d{2}\\b/gi, '');",
    to:   '    out = out;',
    expect: 'L2 B1 loses its dangling "in"' },
  { t: APP, name: 'IT LEAVES A MESS: the tidy pass is dropped',
    from: "    out = out.replace(/\\s{2,}/g, ' ').replace(/\\s+([,.;:])/g, '$1')\r\n" +
          "             .replace(/[\\s,;:-]+$/, '').trim();",
    to:   '    out = out;',
    expect: 'L1 all 156 rendered captions are well formed' },
  { t: APP, name: 'THE PREPOSITION RULE OVERREACHES and eats "in DACs"',
    from: "    out = out.replace(/\\s+\\b(?:in|for|of|during|through)\\b\\s+(?:19|20)\\d{2}\\b/gi, '');",
    to:   "    out = out.replace(/\\s+\\b(?:in|for|of|during|through)\\b\\s+\\S+/gi, '');",
    expect: 'N6 "in DACs" survives' },

  /* ---- round 2 ------------------------------------------------------------ */
  { t: APP, name: 'ROUND 2 BREAKS: D2 stops falling back to short_title',
    from: "      const m = /^((?:Table|Chart)\\s+[A-Z]\\d+\\.\\s+)/.exec(donor);\r\n" +
          '      if (m) return { strategy: \'B\', donorYear: donorYear, text: donor };',
    to:   "      return { strategy: 'B', donorYear: donorYear, text: donor };",
    expect: 'R3 D2 derives NOTHING, so it falls back to short_title',
    alt: 'R5 the derivation reach is unchanged from round 2' },
  { t: APP, name: 'ROUND 2 BREAKS: the derivation stops stripping the PDF tail',
    from: "    const donor = String(by[donorYear]).replace(/\\s*\\|.*$/, '').trim();",
    to:   '    const donor = String(by[donorYear]).trim();',
    expect: 'R2 and the derivation strips it too' },

  /* ---- the harness -------------------------------------------------------- */
  /* THE PAIRED DEMONSTRATION, and it is the point of this whole control set.
   *
   * Reverting ONLY the suite's year test changes no verdict, because with the
   * code correct no caption carries a year under either regex -- so it cannot
   * be a red-turning mutation and pretending otherwise would be a control that
   * cannot fail. What it CAN show is why the pairing matters: break the code
   * AND the harness the same way, and the suite goes GREEN on a build whose
   * two glued captions still print their year.
   *
   * Expected GREEN, deliberately, and recorded as the demonstration rather
   * than counted as a miss. */
  { t: SUITE, name: 'PAIRED: harness and code share the word-boundary blind spot',
    from: "const YEAR = /(?:^|[^\\d])(?:19|20)\\d{2}(?:[^\\d]|$)/;",
    to:   "const YEAR = /\\b(19|20)\\d{2}\\b/;",
    alsoApply: { t: APP,
      from: "    out = out.replace(/(\\d?)((?:19|20)\\d{2})(\\d?)/g,\r\n" +
            "                      (m, before, y, after) => (before || after) ? m : '');",
      to:   "    out = out.replace(/\\b(?:19|20)\\d{2}\\b/g, '');" },
    /* the token COUNT is what still notices, because it does not go through
     * YEAR at all -- it counts the payload permissively and gets 67 either
     * way. If even that were reverted the suite would pass a broken build. */
    expect: 'L6 A1:2023 stores "2023Incentive" with no space, and still strips',
    alt: 'A2 NOT ONE carries a year' },
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '2724b8d';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X5 BASE is a literal commit sha' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('CLCPA-252 round 3 -- mutation controls');
log('======================================================================');

let caught = 0, missed = 0;
M.forEach((m) => {
  const base = fs.readFileSync(m.t, 'utf8');
  const baseSha = crypto.createHash('sha256').update(base).digest('hex');
  const eol = base.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const norm = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, eol);
  const from = norm(m.from), to = norm(m.to);
  const n = base.split(from).length - 1;
  if (n !== 1) { log('  ???  ' + m.name + '  -- ANCHOR ' + n + ', NOT APPLIED'); missed++; return; }
  fs.writeFileSync(m.t, base.replace(from, () => to));
  /* a SECOND file, for the paired demonstration: both sides broken the same
   * way, so the run shows what a shared blind spot costs. */
  let base2 = null, sha2 = null;
  if (m.alsoApply) {
    base2 = fs.readFileSync(m.alsoApply.t, 'utf8');
    sha2 = crypto.createHash('sha256').update(base2).digest('hex');
    const e2 = base2.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
    const n2 = (x) => x.replace(/\r\n/g, '\n').replace(/\n/g, e2);
    const f2 = n2(m.alsoApply.from), t2 = n2(m.alsoApply.to);
    if (base2.split(f2).length - 1 !== 1) {
      log('  ???  ' + m.name + '  -- SECOND ANCHOR not unique, NOT APPLIED');
      fs.writeFileSync(m.t, base); missed++; return;
    }
    fs.writeFileSync(m.alsoApply.t, base2.replace(f2, () => t2));
  }
  let out = '';
  try { out = execFileSync('node', ['suite_252_r3.js'], { cwd: DIR, encoding: 'utf8' }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  if (m.alsoApply) {
    fs.writeFileSync(m.alsoApply.t, base2);
    const b2 = crypto.createHash('sha256').update(fs.readFileSync(m.alsoApply.t, 'utf8')).digest('hex');
    if (b2 !== sha2) { console.error('RESTORE FAILED (second file) after ' + m.name); process.exit(1); }
  }
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
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length + ' guards');
let clean = '';
try { clean = execFileSync('node', ['suite_252_r3.js'], { cwd: DIR, encoding: 'utf8' }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-252-r3-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
