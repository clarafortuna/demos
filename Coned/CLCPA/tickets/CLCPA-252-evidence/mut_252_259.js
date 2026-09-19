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
/* Mutation controls for Section C group B: CLCPA-252, CLCPA-259.
 *
 * The dangerous directions:
 *
 *   252 -- THE FALLBACK NEVER FIRES (the bare caption returns), or it fires
 *   TOO OFTEN and overwrites a stored title, which would silently replace 148
 *   filed wordings with terse ones.
 *
 *   259 -- THE PANEL GOES BACK TO A CONSTANT, or it reads the wrong column,
 *   or it INVENTS a caption where the year has nothing -- the fossil this
 *   ticket exists to remove.
 *
 *   THE 149-YEAR GATE -- it must notice a second table-year moving, not just
 *   count to 149.
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
const DIR = REPO + '/Coned/CLCPA/tickets/CLCPA-252-evidence';
/* THE MUTATION TARGET IS THE PINNED BUILD, not the working tree.
 * suite_252_259 reads 2361a6a unless DAC_APP_OVERRIDE says
 * otherwise, so mutating the repo's app.js would change a file the suite
 * never opens and every control would pass. Same pattern as mut_244_r2. */
const NEW_COMMIT = process.env.DAC_NEW_COMMIT || '2361a6a';
const APP = path.join(os.tmpdir(), 'clcpa-252_259-app-' + NEW_COMMIT + '.js');
fs.writeFileSync(APP, execSync('git show ' + NEW_COMMIT + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n'));
const SUITE = DIR + '/suite_252_259.js';

const M = [
  /* ---- 252 -------------------------------------------------------------- */
  { t: APP, name: '252 THE DEFECT: the bare caption comes back',
    from: "    const short = t.short_title || SHORT_TITLES[t.id] || '';",
    to:   "    const short = '';",
    expect: 'T2 bare captions on a fresh year' },
  { t: APP, name: '252 the fallback OVERWRITES a stored title',
    from: '    const stored = (t.title_by_year || {})[year];\r\n    if (stored) return stored;',
    to:   '    const stored = null;',
    /* 148 filed wordings replaced by terse ones, silently */
    expect: 'T5 and every one is returned unchanged' },
  { t: APP, name: '252 the report page keeps the old inline expression',
    from: '    const titleCurrent = tableCaption(t, year);   /* CLCPA-252 */',
    to:   "    const titleCurrent = (t.title_by_year || {})[year] || ('Table ' + t.id);",
    expect: 'T6 the report page uses tableCaption' },
  { t: APP, name: '252 the EDITOR keeps the old inline expression',
    from: '    const tableTitle = tableCaption(table, i.year);   /* CLCPA-252 */',
    to:   "    const tableTitle = (table.title_by_year || {})[i.year] || ('Table ' + i.tableId);",
    expect: 'T7 and so does the Report Data editor' },
  { t: APP, name: '252 the caption loses the table id it names',
    from: "    return short ? ('Table ' + t.id + '. ' + short) : ('Table ' + t.id);",
    to:   "    return short ? short : ('Table ' + t.id);",
    expect: 'T3 C1 -> ' },

  /* ---- 259 -------------------------------------------------------------- */
  { t: APP, name: '259 THE DEFECT: the hard-coded map returns',
    from: '      const PROG_CATEGORIES = (() => {',
    to:   "      const PROG_CATEGORIES = { 'CSRP': 'Peak Shaving', 'DLRP': 'Contingency',\n" +
          "        'Term-DLM': 'Peak Shaving', 'Auto-DLM': 'Multi-purpose', 'BYOT': 'Mass-market' };\n" +
          '      const UNUSED_PROG_CATEGORIES = (() => {',
    expect: 'C1 the hard-coded map is gone' },
  { t: APP, name: '259 it reads the DESCRIPTION column instead of Category',
    from: "        const catIdx = schema.findIndex(h => /^\\s*category\\s*$/i.test(String(h == null ? '' : h)));",
    to:   "        const catIdx = schema.findIndex(h => /description/i.test(String(h == null ? '' : h)));",
    expect: 'C3 2025: CSRP -> ' },
  { t: APP, name: '259 the short-code join goes, so C3/C4/C5 match nothing',
    from: '          const paren = /\\(([^)]+)\\)\\s*$/.exec(label);\r\n          if (paren) out[paren[1].trim()] = cat;',
    to:   '',
    expect: 'C7 and so does the parenthetical short code' },
  { t: APP, name: '259 A FOSSIL IS INVENTED where the year has nothing',
    from: '        if (!schema || !rows.length) return out;',
    to:   "        if (!schema || !rows.length) { out['CSRP'] = 'Peak Shaving'; return out; }",
    expect: 'C8 a year with no C1 data yields an EMPTY map' },
  { t: APP, name: '259 an empty Category cell is written as an empty caption',
    from: '          if (!label || !cat) return;',
    to:   '          if (!label) return;',
    /* an absent category must be ABSENT, not an empty string masquerading as
     * a read value: C9 counts the keys each stored year resolves */
    /* the real payload has no blank Category, so this is inert against it:
     * C11 exercises it on a synthetic C1-shaped table, which is the only way
     * the assertion can fail at all. */
    expect: 'C11 and rows whose Category is empty or null are ABSENT' },

  /* ---- the 149-year gate ------------------------------------------------ */
  { t: APP, name: 'THE STORED-YEAR GATE: a SECOND table-year moves',
    from: "    const stored = (t.title_by_year || {})[year];\r\n    if (stored) return stored;",
    to:   "    const stored = (t.title_by_year || {})[year];\r\n    if (stored && t.id !== 'C1') return stored;",
    /* C1's three stored years would start reading the short caption */
    expect: 'Z2 exactly ONE moved, and it is A8:2023' },

  /* ---- the harness itself ------------------------------------------------ */
  { t: SUITE, name: 'HARNESS: the stored-year sweep stops rendering',
    /* mutating the COUNTER line only mutates the assertion; starving it of a
     * render is what proves Z1b is watching the output */
    from: '      const b = NEW.attempt(api => api.renderSourceTables([t], y, {}, id));',
    to:   "      const b = '';",
    expect: 'Z1b and every one produced a <table>' },
  { t: SUITE, name: 'HARNESS: the baseline is repointed at a symbolic ref',
    from: "const BASE = process.env.DAC_BASE_COMMIT || '9699f62';",
    to:   "const BASE = process.env.DAC_BASE_COMMIT || 'HEAD';",
    expect: 'X3 BASE is a literal commit sha' },
];

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
log('======================================================================');
log('Section C group B -- mutation controls');
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
  let out = '';
  try { out = execFileSync('node', ['suite_252_259.js'],
    { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
  catch (e) { out = (e.stdout || '') + (e.stderr || ''); }
  fs.writeFileSync(m.t, base);
  const back = crypto.createHash('sha256').update(fs.readFileSync(m.t, 'utf8')).digest('hex');
  if (back !== baseSha) { console.error('RESTORE FAILED after ' + m.name); process.exit(1); }
  const fails = (out.match(/^  FAIL .*$/gm) || []);
  const hit = fails.filter(l => l.indexOf(m.expect) >= 0);
  if (hit.length) {
    log('  red  ' + m.name);
    log('       ' + fails.length + ' red, incl: ' + hit[0].trim().slice(5, 104));
    caught++;
  } else if (fails.length) {
    log('  ???  ' + m.name + '  -- ' + fails.length + ' red, not the expected one');
    log('       want: ' + m.expect);
    log('       got : ' + fails[0].trim().slice(5, 104));
    missed++;
  } else { log('  GREEN ' + m.name + '  -- NOT NOTICED. Not a guard.'); missed++; }
});

log('');
log('  ' + caught + ' caught, ' + missed + ' not caught, of ' + M.length + ' guards');
let clean = '';
try { clean = execFileSync('node', ['suite_252_259.js'],
    { cwd: DIR, encoding: 'utf8', env: Object.assign({}, process.env, { DAC_APP_OVERRIDE: APP }) }); }
catch (e) { clean = (e.stdout || '') + (e.stderr || ''); }
const tally = (clean.match(/(\d+) passed, (\d+) failed/) || []);
log('  clean re-run against byte-restored source: ' +
    (tally[2] === '0' ? 'PASSES' : 'FAILS') + ' -- ' + (tally[0] || 'no tally'));
fs.writeFileSync(DIR + '/mut-252-259-output.txt', lines.join('\n') + '\n');
process.exit(missed || tally[2] !== '0' ? 1 : 0);
