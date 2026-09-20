/* CLCPA-287 round 2: THE OWNER'S GESTURE, in a real browser, against a served
 * build, on BOTH sides of the change.
 *
 *   Report Data -> A9 -> 2025 -> Add Data -> stage a CSV whose headings A9
 *   does not have -> Load Data
 *
 * A9 is the table to drive because it is two-level AND its first column has no
 * heading anywhere: schema[0] is "" and its second heading row is null there
 * too. So it exercises both halves of the ticket in one gesture.
 *
 * The BASELINE side is served from a temp copy carrying that commit's app.js.
 * Nothing in the working tree moves, and the two runs are the same gesture
 * against two builds rather than one run and a memory of the other.
 *
 * Suites and mutations are mandatory and NOT sufficient for a UI ticket: this
 * is the evidence that the thing the owner does with a mouse changed.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { open } = require(path.join(
  execSync('git rev-parse --show-toplevel').toString().trim(),
  'Coned/CLCPA/tickets/_kit/live_browser.js'));

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const BASE = process.env.DAC_BASE_COMMIT || '8551769';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

const STAGE = (name, text) => `
(function(){
  var inp = document.getElementById('ingest-file');
  if (!inp) return 'NO FILE INPUT';
  var dt = new DataTransfer();
  dt.items.add(new File([${JSON.stringify(text)}], ${JSON.stringify(name)}, {type:'text/csv'}));
  inp.files = dt.files;
  inp.dispatchEvent(new Event('change', {bubbles:true}));
  return 'staged';
})()`;

/* A9 declares two heading rows, so the file carries two: the rejection under
 * test is the KEY COLUMN one, not the heading-count one. */
const BAD = 'Foo,Bar,Baz\nSub1,Sub2,Sub3\nIncentives,1,2\n';

/** a served copy of the app whose app.js is taken from `commit` */
function baselineDir(commit) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'repro287-'));
  ['ExecutiveDashboard.html', 'index.html', 'styles.css', 'payload.json', 'map_payload.json']
    .forEach((f) => { try { fs.copyFileSync(path.join(DEV, f), path.join(d, f)); } catch (e) {} });
  const blob = execSync('git show ' + commit + ':"' + REL + '"', { maxBuffer: 1e9 });
  fs.writeFileSync(path.join(d, 'app.js'), blob);
  return d;
}

async function gesture(dir, label) {
  const D = await open({ dir: dir });
  const out = {};
  try {
    await D.gotoIngest();
    await D.pick('A', 'A9', '2025');
    await sleep(400);
    await D.B.click('#ingest-addyear');
    await sleep(600);
    out.button = await D.B.eval('(document.querySelector(\'[data-act="addyear"]\')||{}).textContent');
    await D.B.eval(STAGE('wrong-headings.csv', BAD));
    await sleep(700);
    await D.B.click('[data-act="addyear"]');
    await sleep(1300);
    out.dialogOpen = await D.B.eval('!!document.querySelector(\'[data-act="addyear"]\')');
    out.dlgError = await D.B.eval(
      '(function(){var e=document.getElementById("dlg-error");' +
      'return e? e.textContent.replace(/\\s+/g," ").trim() : "(dialog gone)";})()');
    out.page = await D.B.eval(
      '(function(){var m=document.getElementById("ingest-import-mount");' +
      'return m? m.textContent.replace(/\\s+/g," ").trim() : "(no mount)";})()');
    out.errors = D.errors();
  } finally { await D.close(); }

  log('');
  log('  --- ' + label + ' ---');
  log('    button read            : ' + JSON.stringify(out.button));
  log('    dialog still open      : ' + out.dialogOpen);
  log('    dialog error line      : ' + JSON.stringify(String(out.dlgError).slice(0, 96)));
  log('    the page says          : ' + JSON.stringify(String(out.page).slice(0, 150)));
  log('    page errors            : ' + JSON.stringify(out.errors).slice(0, 120));
  return out;
}

(async () => {
  log('='.repeat(70));
  log('CLCPA-287 round 2 -- the owner\'s gesture, in a real browser');
  log('  gesture : Report Data -> A9 -> 2025 -> Add Data -> stage a CSV with');
  log('            headings A9 does not have -> Load Data');
  log('  BASE    : ' + BASE);
  log('='.repeat(70));

  const dir = baselineDir(BASE);
  const before = await gesture(dir, 'BEFORE, served from ' + BASE);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}

  const after = await gesture(DEV, 'AFTER, served from the working tree');

  log('');
  log('='.repeat(70));
  const half1 = before.dialogOpen === true && after.dialogOpen === false;
  const half2 = /“”/.test(String(before.dlgError)) &&
    !/“”/.test(String(after.page)) && /first column/.test(String(after.page));
  log('  HALF 1  the dialog dismisses on a rejected Load : ' +
    (half1 ? 'FIXED (was open, now closes)' : 'NOT SHOWN'));
  log('  HALF 2  the rejection names a column by role    : ' +
    (half2 ? 'FIXED (was “”, now "first column, unheaded in this table")' : 'NOT SHOWN'));
  log('  page errors either side                         : ' +
    ((before.errors || []).length + (after.errors || []).length));
  log('='.repeat(70));

  fs.writeFileSync(path.join(__dirname, 'repro-287-r2-output.txt'), lines.join('\n') + '\n');
  process.exit(half1 && half2 ? 0 : 1);
})().catch(e => { console.error('REPRO THREW: ' + e.stack); process.exit(1); });
