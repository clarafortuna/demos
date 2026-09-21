/* Mutation controls for suite_280.
 *
 * Every assertion in that suite is meant to be load-bearing. The only way to
 * know is to break the thing it watches and see it go red ON THE ASSERTION
 * THAT WATCHES IT -- a suite that fails for some other reason has not proved
 * anything about the guard under test.
 *
 * Nothing on disk is edited. Each mutant is a temp copy of the shipped file,
 * fed back through DAC_APP_OVERRIDE or DAC_CSS_OVERRIDE, which is why this
 * runner cannot leave a mutated app.js behind. It still ends with a clean
 * re-run, loudly, because the suite rewrites its own output file and that file
 * must describe the shipped build and not the last mutant.
 *
 * DISCLOSED LIMIT: block E reads the REPOSITORY (git diff against BASE), not
 * the override, so no mutant here can redden E1, E2 or E3. E3 is not therefore
 * unfalsifiable -- it failed on its first run, when it asserted five added
 * lines and the diff had one -- but nothing below exercises it.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const DEV = path.join(__dirname, '../../ExecutiveDashboard_dev');
const APP = path.join(DEV, 'app.js');
const CSSF = path.join(DEV, 'styles.css');
const OUT = path.join(__dirname, 'mut-280-output.txt');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'clcpa280-'));

const APP_SRC = fs.readFileSync(APP, 'utf8');
const CSS_SRC = fs.readFileSync(CSSF, 'utf8');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; log('  PASS  ' + m); } else { fail++; log('  FAIL  ' + m); } };

/* a replacement that is PROVEN to have landed: String.replace returns the
 * input unchanged when the pattern misses, and a mutant that did not mutate is
 * the quietest way for a control to report success. The function form is used
 * throughout because a replacement string containing $' or $& expands. */
function sub(src, from, to, what) {
  const out = src.replace(from, () => to);
  if (out === src) throw new Error('mutation did not land: ' + what);
  return out;
}

function runSuite(env) {
  try {
    const stdout = execFileSync(process.execPath, [path.join(__dirname, 'suite_280.js')],
      { cwd: __dirname, env: Object.assign({}, process.env, env), encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status, stdout: (e.stdout || '') + (e.stderr || '') };
  }
}

const failedIds = (stdout) => stdout.split(/\r?\n/)
  .filter(l => /^\s+FAIL\s/.test(l))
  /* the suffix after the dot is a tab id on some assertions and an INDEX on
   * others (C3.2). A [a-z]+ suffix read C3.2 as plain "C3" and reported a
   * control as missing its target when the control had worked. */
  .map(l => (l.trim().replace(/^FAIL\s+/, '').match(/^[A-Z]\d+[a-z]?(?:\.[A-Za-z0-9]+)?/) || [''])[0])
  .filter(Boolean);

/* ---- the mutants ---------------------------------------------------- */
const MUTANTS = [
  {
    n: 1, file: 'app',
    what: 'one Update cadence placeholder row is put back on Electric and Gas Figures',
    targets: ['A3', 'A4.coned', 'B5', 'D1'],
    make: (s) => sub(s,
      "        ['Published by', 'Con Edison, internal. Not public.'],",
      "        ['Published by', 'Con Edison, internal. Not public.'],\r\n" +
      "        ['Update cadence', '[Update cadence: TO BE FILLED]'],",
      'coned origin row'),
  },
  {
    n: 2, file: 'app',
    what: 'the placeholder branch is restored in renderDsDictView',
    targets: ['B2', 'B3'],
    make: (s) => sub(s,
      "            : escapeHtml(v)) + '</dd>').join('') + '</dl>'",
      "            : (/TO BE FILLED/.test(v)\r\n" +
      "              ? '<span class=\"ds-dict-gap\">' + escapeHtml(v) + '</span>'\r\n" +
      "              : escapeHtml(v))) + '</dd>').join('') + '</dl>'",
      'renderDsDictView branch'),
  },
  {
    n: 3, file: 'app',
    what: 'a KEPT row is removed too: Obtained from goes off DAC Indicators',
    targets: ['A4.indicators'],
    make: (s) => sub(s,
      "        ['Obtained from', 'https://opdgig.dos.ny.gov/datasets/2579112b69b04b4c9a09f4cf013983dc'],\r\n",
      '', 'indicators Obtained from'),
  },
  {
    n: 4, file: 'app',
    what: 'a KEPT value is altered: Territory Overlays Published by',
    targets: ['A4.territory'],
    make: (s) => sub(s,
      "['Published by', 'Con Edison internal GIS, CECONY and ORU. Not public.']",
      "['Published by', 'Con Edison internal GIS.']", 'territory Published by'),
  },
  {
    n: 5, file: 'app',
    what: 'the whole origin list is emptied on Electric and Gas Figures, so the ' +
      'block falls through to the source sentence',
    targets: ['A4.coned', 'B7.coned'],
    make: (s) => sub(s,
      "      origin: [\r\n        ['Published by', 'Con Edison, internal. Not public.'],\r\n      ],",
      '      origin: [],', 'coned origin array'),
  },
  {
    n: 6, file: 'app',
    what: 'a field that is none of this ticket\'s business changes: the Tract ' +
      'Shapes description',
    targets: ['A5.shapes'],
    make: (s) => sub(s,
      'The census tract boundaries the map draws.',
      'The census tract boundaries the map uses.', 'shapes what'),
  },
  {
    n: 7, file: 'css',
    what: 'the gap pill rule is restored in the stylesheet',
    targets: ['C2', 'D2'],
    make: (s) => sub(s, '.ds-dict-actions { display: flex;',
      '.ds-dict-gap {\r\n  display: inline-block; padding: 2px 7px;\r\n}\r\n\r\n' +
      '.ds-dict-actions { display: flex;', 'ds-dict-gap rule'),
  },
  {
    n: 8, file: 'css',
    what: 'a rule the REMAINING rows depend on is deleted: .ds-dict-origin dd',
    targets: ['C3.2'],
    make: (s) => sub(s,
      '.ds-dict-origin dd { margin: 2px 0 0; color: var(--text-2); word-break: break-word; }',
      '', 'ds-dict-origin dd rule'),
  },
];

log('CLCPA-280 mutation controls');
log('Each mutant must turn suite_280 red ON THE ASSERTION IT TARGETS.');
log('');

/* the clean run first, so "red" means something */
const clean0 = runSuite({});
log('CLEAN, before any mutation: exit ' + clean0.code + '  ' +
  (clean0.stdout.match(/\d+ passed, \d+ failed/) || ['?'])[0]);
ok(clean0.code === 0, 'the suite is green on the shipped build before mutating');
log('');

MUTANTS.forEach((m) => {
  let file;
  try {
    file = path.join(TMP, 'mut' + m.n + (m.file === 'app' ? '.js' : '.css'));
    fs.writeFileSync(file, m.make(m.file === 'app' ? APP_SRC : CSS_SRC));
  } catch (e) {
    fail++; log('  FAIL  mutation ' + m.n + ' could not be built: ' + e.message);
    return;
  }
  const env = m.file === 'app' ? { DAC_APP_OVERRIDE: file } : { DAC_CSS_OVERRIDE: file };
  const r = runSuite(env);
  const ids = failedIds(r.stdout);
  log('MUTATION ' + m.n + ': ' + m.what);
  log('   exit ' + r.code + '   ' + (r.stdout.match(/\d+ passed, \d+ failed/) || ['?'])[0]);
  log('   failed: ' + JSON.stringify([...new Set(ids)]));
  ok(r.code !== 0, 'M' + m.n + ' turns the suite red');
  m.targets.forEach((t) => ok(ids.indexOf(t) >= 0,
    'M' + m.n + ' reddens ' + t + ', which is the assertion that watches it'));
  log('');
});

/* ---- the clean re-run, which is the point --------------------------- */
log('='.repeat(64));
const clean = runSuite({});
const tally = (clean.stdout.match(/\d+ passed, \d+ failed/) || ['?'])[0];
ok(fs.readFileSync(APP, 'utf8') === APP_SRC,
  'app.js on disk is byte-identical to the file this runner started with');
ok(fs.readFileSync(CSSF, 'utf8') === CSS_SRC,
  'styles.css on disk is byte-identical to the file this runner started with');
ok(clean.code === 0, 'AND THE SUITE IS GREEN AGAIN ON THE SHIPPED BUILD: ' + tally);
log('suite-280-output.txt now describes the shipped build, not a mutant.');
log('='.repeat(64));

fs.rmSync(TMP, { recursive: true, force: true });
log('');
log(pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
