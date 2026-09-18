/* CLCPA-276 -- a notice lives exactly as long as the draft it describes.
 *
 * Four shapes were verified on the hosted build, and they are one bug: the
 * notices are state on `i`, and only the table-year picker cleared them.
 *
 * This drives the STATE TRANSITIONS -- open, import, reset, save, switch --
 * and asks what the notice mount renders after each, using the shipped
 * renderer rather than reading the handlers.
 *
 * BASE predates the change: 5d584c5 (CLCPA-269 r2's tip).
 *
 * Run:  node suite_276.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
/* PINNED ON BOTH SIDES (CLAUDE.md), the standing model. The post-change
 * side reads 22c96cc, this ticket's own commit, because a
 * blast-radius claim can only be true at the commit that made the change
 * -- never on a tip that also carries the tickets merged after it.
 * DAC_APP_OVERRIDE still wins, so the mutation runner keeps working. */
const NEWREV = process.env.DAC_NEW_COMMIT || '22c96cc';
const BASE = process.env.DAC_BASE_COMMIT || '5d584c5';
const APP = process.env.DAC_APP_OVERRIDE || ('git show ' + NEWREV + ':' + REL);
const SRC = process.env.DAC_APP_OVERRIDE
  ? fs.readFileSync(process.env.DAC_APP_OVERRIDE, 'utf8')
  : execSync('git show ' + NEWREV + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => { try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); } };
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p);

function api(src, want) {
  const L = src.split('\r\n'); const TOP = [];
  L.forEach((ln, n) => { const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n }); });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (n) => { const k = TOP.findIndex(d => d.name === n);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n'); };
  const parts = [], have = new Set();
  const add = (n) => { if (have.has(n)) return false; const f = find(n);
    if (!f) return false; have.add(n); parts.push(f); return true; };
  want.forEach(add);
  const make = () => new Function('const state=globalThis.__st||{};' + parts.join('\n\n') +
    '\nreturn {' + want.join(',') + '};')();
  return (fn) => {
    for (let r = 0; r < 500; r++) {
      try { return fn(make()); }
      catch (e) { const m = /(\w+) is not defined/.exec(e.message);
        if (m && add(m[1])) continue; throw e; }
    }
    throw new Error('dependency resolution did not converge');
  };
}
const WANT = ['renderIngestImport', 'clearIngestNotices', 'buildIngestImport',
  'getTableSchema', 'getTableBody', 'reconcileSumColumns'];
const run = api(SRC, WANT);

const H = P.tables.H1;
const SCHEMA = H.schema_by_year['2025'];
const FILE = [SCHEMA.map(h => (h == null ? '' : String(h))),
  ['Manhattan', '1309', '491', '1800'],
  ['Queens', '1563', '281', '1844'],
  ['Westchester', '1886', '1094', '1500'],   /* deliberately does not add up */
];

/* one shared state object, mutated in place: the assembled module binds
 * `state` when it is built, so reassigning the global would leave it looking
 * at the old one */
const shared = { ingest: null };
globalThis.__st = shared;

function openWithImport() {
  const baseline = H.data['2025'].map(r => r.slice());
  shared.ingest = { tableId: 'H1', year: '2025', sectionId: 'H',
    schema: SCHEMA, baseline: baseline, draft: baseline.map(r => r.slice()),
    importResult: null, typedUnitNotices: [] };
  const plan = run(a => a.buildIngestImport(FILE, SCHEMA, shared.ingest.draft, 'H1'));
  shared.ingest.draft = plan.candidate;
  shared.ingest.importResult = plan;
  shared.ingest.typedUnitNotices = [{ key: '0:2', label: 'Manhattan',
    column: 'DAC Repairs', read: '10%', landed: 0.1 }];
  return plan;
}
const mount = () => run(a => a.renderIngestImport());

log('======================================================================');
log('CLCPA-276 -- a notice lives as long as the draft it describes');
log('  app.js : ' + APP);
log('  BASE   : ' + BASE + ' (predates this change)');
log('======================================================================');

/* ---- A. the notices exist while the draft does -------------------------- */
log('');
log('A. WHILE THE DRAFT LIVES, the notices are on screen');
guard('A-block', () => {
  const plan = openWithImport();
  const html = mount();
  ok(plan.ok === true, 'A1 the import succeeded');
  ok(/Imported into the draft/.test(html), 'A2 the receipt is rendered');
  ok(/Read as a fraction/.test(html), 'A3 and the typed advisory');
  ok(/Does not add up/.test(html),
    'A4 and the reconciliation advisory, because Westchester does not add up');
});

/* ---- B. the four shapes ------------------------------------------------- */
log('');
log('B. THE FOUR SHAPES FROM THE HOSTED BUILD');
guard('B-block', () => {
  /* (1) Reset */
  openWithImport();
  shared.ingest.draft = shared.ingest.baseline.map(r => r.slice());
  run(a => a.clearIngestNotices(shared.ingest));
  let html = mount();
  ok(!/Imported into the draft/.test(html),
    'B1 shape 1: the receipt is GONE after Reset');
  ok(!/Read as a fraction/.test(html), 'B2 and so is the typed advisory');
  ok(!/Does not add up/.test(html),
    'B3 and the reconciliation advisory, because the reset draft reconciles');

  /* (3) a successful save */
  openWithImport();
  const saved = shared.ingest.draft.map(r => r.slice());
  shared.ingest.baseline = saved;
  run(a => a.clearIngestNotices(shared.ingest));
  html = mount();
  ok(!/Imported into the draft/.test(html),
    'B4 shape 3: the receipt is GONE after a successful save');
  ok(!/Nothing has been saved yet/.test(html),
    'B5 so "Nothing has been saved yet" cannot sit beside a recorded save');

  /* THE RECOMPUTED HALF of the ruling: the saved rows still do not add up, so
   * the reconciliation advisory is still TRUE and comes back on its own. */
  ok(/Does not add up/.test(html),
    'B6 but the reconciliation advisory RETURNS -- recomputed from the saved ' +
    'draft, which still does not add up. Cleared would have hidden a live fact');

  /* (2) and (4): a table-year switch clears everything, receipt and advisory */
  openWithImport();
  shared.ingest.tableId = 'H1'; shared.ingest.year = '2097';
  shared.ingest.draft = []; shared.ingest.baseline = [];
  run(a => a.clearIngestNotices(shared.ingest));
  html = mount();
  ok(html === '',
    'B7 shapes 2 and 4: after a year switch onto an empty year the mount is ' +
    'EMPTY -- no receipt, no advisory (got ' + JSON.stringify(html.slice(0, 40)) + ')');
});

/* ---- C. one helper, called everywhere the draft ends -------------------- */
log('');
log('C. ONE HELPER, EVERY EXIT');
guard('C-block', () => {
  const code = codeOnly(SRC), base = codeOnly(BASE_SRC);
  ok(/function clearIngestNotices\(i\)/.test(code), 'C1 the helper exists');
  const calls = (code.match(/clearIngestNotices\(/g) || []).length;
  ok(calls === 4, 'C2 declared once and called from THREE places -- found ' +
    (calls - 1) + ' calls');
  ok(/state\.ingest\.draft = clone2D\(state\.ingest\.baseline\);[\s\S]{0,200}clearIngestNotices/.test(code),
    'C3 Reset clears');
  ok(/adoptIngestReference\(\);[\s\S]{0,300}clearIngestNotices\(i\);/.test(code),
    'C4 a successful save clears');
  ok(/clearIngestNotices\(i\);[\s\S]{0,400}i\.loadedKey = ingestSelectionKey\(\);/.test(code),
    'C5 and loading a table-year clears');

  /* on BASE only the loader cleared, and it did it inline */
  ok(/i\.importResult = null;/.test(base) && !/clearIngestNotices/.test(base),
    'C6 on BASE the clearing was inline and happened in ONE place only');
  ok(!/i\.importResult = null;/.test(code),
    'C7 and no inline clear survives -- a fourth exit cannot half-clear');
});

/* ---- D. lifecycle only -------------------------------------------------- */
log('');
log('D. LIFECYCLE ONLY: the component and the texts are untouched');
guard('D-block', () => {
  const grab = (s, n) => {
    const a = s.indexOf('\r\n  function ' + n + '(');
    return a < 0 ? null : s.slice(a, s.indexOf('\r\n  }', a));
  };
  ['renderIngestImportResult', 'renderTypedUnitNotice', 'renderReconcileNotice']
    .forEach((n) => {
      ok(grab(SRC, n) && grab(SRC, n) === grab(BASE_SRC, n),
        'D1 ' + n + ' is BYTE-IDENTICAL to BASE');
    });
  const added = SRC.split('\r\n').filter(l => BASE_SRC.indexOf(l) < 0)
    .filter(l => l.trim() && !/^\s*[*/]/.test(l.trim()));
  ok(!added.some(l => /ingest-import-notice|is-warn|is-alert/.test(l)),
    'D2 no added code line touches the CLCPA-266 component');
  ok(!added.some(l => /Imported into the draft|Read as a fraction|Does not add up/.test(l)),
    'D3 nor any notice text');
  /* the draft-derived advisory must NOT be cleared: it is recomputed */
  const helper = code_helper(SRC);
  ok(!/reconcile/i.test(helper),
    'D4 the helper does NOT clear the reconciliation advisory -- it is ' +
    'recomputed from the draft, which is the "recomputed, not cleared" half');
  function code_helper(s) {
    const a = s.indexOf('  function clearIngestNotices(i) {');
    return a < 0 ? '' : s.slice(a, s.indexOf('\r\n  }', a));
  }
});

/* ---- X. the harness ----------------------------------------------------- */
log('');
log('X. THE HARNESS');
guard('X-block', () => {
  const self = fs.readFileSync(__filename, 'utf8');
  const m = /const BASE = process\.env\.DAC_BASE_COMMIT \|\| '([0-9a-f]+)';/.exec(self);
  ok(!!m && /^[0-9a-f]{7,40}$/.test(m[1]), 'X1 BASE is a literal sha -- ' + (m ? m[1] : 'none'));
  ok(BASE_SRC.indexOf('function clearIngestNotices') < 0, 'X2 and predates this ticket');
  /* the mount really is the shipped renderer, and it really reacts to state */
  openWithImport();
  const before = mount();
  run(a => a.clearIngestNotices(shared.ingest));
  ok(before !== mount(), 'X3 the mount under test reacts to the state it is given');
});
delete globalThis.__st;

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-276-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
