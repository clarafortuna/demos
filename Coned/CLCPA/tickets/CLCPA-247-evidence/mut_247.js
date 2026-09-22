/* Mutation controls for suite_247.
 *
 * Every assertion is meant to be load-bearing, and the only way to know is to
 * break the thing it watches and see it go red ON THE ASSERTION THAT WATCHES
 * IT. A suite that fails for some other reason has proved nothing about the
 * guard under test.
 *
 * Nothing on disk is edited: each mutant is a temp copy of the shipped app.js
 * fed back through DAC_APP_OVERRIDE. The runner still ends with a clean
 * re-run, loudly, because the suite rewrites its own output file and that file
 * must describe the shipped build rather than the last mutant.
 *
 * TWO OF THESE MUTATE THE EXTRACTOR'S OWN SUBJECT. Block 0 exists because the
 * first cut of this suite used an indentation-anchored grab that over-read
 * seven column-0 functions by half the file and reported confident nonsense
 * about every one of them. M9 and M10 are the controls for the replacement.
 *
 * DISCLOSED LIMIT: block F reads the two verdicts files that repro_247 writes,
 * and block G reads the repository through git. No app.js override can redden
 * either. F is exercised by M11, which mutates a verdicts file instead; G is
 * not exercised here, and its G3 count assertion already failed once on a real
 * miscount, which is the only evidence offered that it can fail at all.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const DEV = path.join(__dirname, '../../ExecutiveDashboard_dev');
const APP = path.join(DEV, 'app.js');
const OUT = path.join(__dirname, 'mut-247-output.txt');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'clcpa247-'));
const CRLF = String.fromCharCode(13) + String.fromCharCode(10);

const APP_SRC = fs.readFileSync(APP, 'utf8');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; log('  PASS  ' + m); } else { fail++; log('  FAIL  ' + m); } };

/* a replacement that is PROVEN to have landed: String.replace returns the
 * input unchanged when the pattern misses, and a mutant that did not mutate is
 * the quietest way for a control to report success. The function form
 * throughout, because a replacement containing $' or $& expands. */
function sub(src, from, to, what) {
  const out = src.replace(from, () => to);
  if (out === src) throw new Error('mutation did not land: ' + what);
  return out;
}

function runSuite(env) {
  try {
    const stdout = execFileSync(process.execPath, [path.join(__dirname, 'suite_247.js')],
      { cwd: __dirname, env: Object.assign({}, process.env, env), encoding: 'utf8' });
    return { code: 0, stdout };
  } catch (e) {
    return { code: e.status === undefined ? -1 : e.status,
      stdout: (e.stdout || '') + (e.stderr || '') };
  }
}

const failedIds = (stdout) => stdout.split(/\r?\n/)
  .filter(l => /^\s+FAIL\s/.test(l))
  .map(l => (l.trim().replace(/^FAIL\s+/, '')
    .match(/^[0-9A-Z]+\.?[0-9A-Za-z_]*/) || [''])[0])
  .filter(Boolean);

/* ---- the mutants ---------------------------------------------------- */
const MUTANTS = [
  {
    n: 1, what: 'one of the fourteen keeps its raw positioner: section H goes back',
    targets: ['A2', 'A5.wireHTooltips', 'A6.wireHTooltips'],
    make: (s) => sub(s,
      "      slice.addEventListener('mousemove', e => {" + CRLF +
      '        placeTooltipAtPointer(tip, e);',
      "      slice.addEventListener('mousemove', e => {" + CRLF +
      "        tip.style.left = (e.pageX + 14) + 'px';" + CRLF +
      "        tip.style.top  = (e.pageY - 8) + 'px';",
      'H positioner'),
  },
  {
    n: 2, what: 'a section surface is dropped from OWNS_TIP: the J rows',
    targets: ['C4.12', 'C5'],
    make: (s) => sub(s,
      "      '.j-burden-html-row, .j-aff-block, .j-flow-stage, .j-dpa-group, ' +",
      "      '.j-aff-block, .j-flow-stage, .j-dpa-group, ' +",
      'OWNS_TIP J row'),
  },
  {
    n: 3, what: 'the list is REPLACED rather than extended: the five ' +
      'pre-existing surfaces are dropped',
    targets: ['C3.0', 'C5'],
    make: (s) => sub(s,
      "    const OWNS_TIP = '.dumb-row, .strip-row, .ai-header-card, .radar-dot, ' +" + CRLF +
      "      '.ingest-cell-label[data-label-tip], ' +",
      "    const OWNS_TIP = '' +",
      'OWNS_TIP heritage'),
  },
  {
    n: 4, what: 'the early-out is moved AFTER the hide, so it stops being one',
    targets: ['C7'],
    make: (s) => sub(s,
      '      if (ownsTip(e)) return;' + CRLF + '      hide();',
      '      hide();' + CRLF + '      if (ownsTip(e)) return;',
      'early-out order'),
  },
  {
    n: 5, what: 'the hide clears the box but not its content',
    targets: ['D7.0'],
    make: (s) => sub(s,
      "      tip.style.opacity = '0';" + CRLF + "      tip.innerHTML = '';",
      "      tip.style.opacity = '0';",
      'hide clears content'),
  },
  {
    n: 6, what: 'the hide list loses a section div, so one box can outlive its rows',
    targets: ['D2.2', 'D6'],
    make: (s) => sub(s,
      "  const POINTER_TIP_SELECTORS = ['.exec-tooltip', '.e-tt', '.j-tt', '.d-tt'," + CRLF +
      "    '.f-tt', '.h-pie-tt'];",
      "  const POINTER_TIP_SELECTORS = ['.exec-tooltip', '.e-tt', '.d-tt'," + CRLF +
      "    '.f-tt', '.h-pie-tt'];",
      'POINTER_TIP_SELECTORS'),
  },
  {
    n: 7, what: 'the section render path stops hiding on re-render',
    targets: ['D8', 'D10'],
    make: (s) => sub(s,
      '  function wireSectionInteractions(letter) {' + CRLF,
      '  function wireSectionInteractions(letter) {' + CRLF + '    // hide removed' + CRLF,
      'marker') .replace(
      /    hideExecTooltip\(\);\r\n    const tables = Object\.values/,
      () => '    const tables = Object.values'),
  },
  {
    n: 8, what: 'the shared positioner itself is edited, which this ticket ' +
      'must not do',
    targets: ['B1'],
    make: (s) => sub(s,
      '    const knownW = w > 0, knownH = h > 0;',
      '    const knownW = true, knownH = true;',
      'placeTooltipAtPointer body'),
  },
  {
    n: 9, what: 'EXTRACTOR CONTROL: a column-0 wiring function is given a ' +
      'stray unbalanced brace, which an indentation anchor would not notice',
    targets: ['0.1'],
    make: (s) => sub(s,
      'function wireHTooltips() {' + CRLF +
      "    if (state.route.sectionId !== 'H') return;",
      'function wireHTooltips() {' + CRLF +
      "    if (state.route.sectionId !== 'H') { return;",
      'wireHTooltips brace'),
  },
  {
    n: 10, what: 'EXTRACTOR CONTROL: a wiring function is renamed, so the ' +
      'extractor must return nothing rather than somebody else\'s block',
    targets: ['0.1', 'A4.wireDTooltips'],
    make: (s) => sub(s, 'function wireDTooltips() {', 'function wireDTooltipsX() {',
      'wireDTooltips name'),
  },
];

log('CLCPA-247 mutation controls');
log('Each mutant must turn suite_247 red ON THE ASSERTION IT TARGETS.');
log('');

const clean0 = runSuite({});
log('CLEAN, before any mutation: exit ' + clean0.code + '  ' +
  (clean0.stdout.match(/\d+ passed, \d+ failed/) || ['?'])[0]);
ok(clean0.code === 0, 'the suite is green on the shipped build before mutating');
log('');

MUTANTS.forEach((m) => {
  let file;
  try {
    file = path.join(TMP, 'mut' + m.n + '.js');
    fs.writeFileSync(file, m.make(APP_SRC));
  } catch (e) {
    fail++; log('  FAIL  mutation ' + m.n + ' could not be built: ' + e.message);
    return;
  }
  const r = runSuite({ DAC_APP_OVERRIDE: file });
  const ids = failedIds(r.stdout);
  log('MUTATION ' + m.n + ': ' + m.what);
  log('   exit ' + r.code + '   ' + (r.stdout.match(/\d+ passed, \d+ failed/) || ['?'])[0]);
  log('   failed: ' + JSON.stringify([...new Set(ids)]).slice(0, 220));
  ok(r.code !== 0, 'M' + m.n + ' turns the suite red');
  m.targets.forEach((t) => ok(ids.indexOf(t) >= 0,
    'M' + m.n + ' reddens ' + t + ', which is the assertion that watches it'));
  log('');
});

/* ---- M11: the rendered half ----------------------------------------- */
/* Block F reads what the browser saw, so no app.js override can move it. The
 * control mutates the verdicts file instead, and RESTORES IT BYTE-FOR-BYTE
 * afterwards -- it is committed evidence of a real run. */
{
  const vf = path.join(__dirname, 'verdicts-after.json');
  const orig = fs.readFileSync(vf);
  try {
    const v = JSON.parse(orig.toString('utf8'));
    v[0].survives = false;                 // claim a surface still hides
    fs.writeFileSync(vf, JSON.stringify(v, null, 2) + '\n');
    const r = runSuite({});
    const ids = failedIds(r.stdout);
    log('MUTATION 11: the AFTER verdicts claim a surface still hides mid-travel');
    log('   exit ' + r.code + '   ' + (r.stdout.match(/\d+ passed, \d+ failed/) || ['?'])[0]);
    log('   failed: ' + JSON.stringify([...new Set(ids)]));
    ok(r.code !== 0, 'M11 turns the suite red');
    ok(ids.indexOf('F4') >= 0, 'M11 reddens F4, which is the assertion that watches it');
  } finally {
    fs.writeFileSync(vf, orig);
  }
  ok(fs.readFileSync(vf).equals(orig),
    'and verdicts-after.json is byte-restored: it is the record of a real run');
  log('');
}

/* ---- the clean re-run, which is the point --------------------------- */
log('='.repeat(64));
const clean = runSuite({});
const tally = (clean.stdout.match(/\d+ passed, \d+ failed/) || ['?'])[0];
ok(fs.readFileSync(APP, 'utf8') === APP_SRC,
  'app.js on disk is byte-identical to the file this runner started with');
ok(clean.code === 0, 'AND THE SUITE IS GREEN AGAIN ON THE SHIPPED BUILD: ' + tally);
log('suite-247-output.txt now describes the shipped build, not a mutant.');
log('='.repeat(64));

fs.rmSync(TMP, { recursive: true, force: true });
log('');
log(pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
