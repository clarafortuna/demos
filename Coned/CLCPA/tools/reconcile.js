/* CLCPA delta reconciliation.
 *
 * WHAT THIS IS FOR. The application's author is leaving, and until she does she
 * is still committing. Re-importing the whole project on every change is how a
 * migration turns into a permanent second job, so this reads ONE THING: what
 * moved between the engineer tip we last reconciled and the engineer tip now.
 *
 * It classifies each commit, flags the ones that touch a security control or a
 * path this integration line has already changed, and prints the reconciliation
 * work in the order it has to be done. It changes nothing. Porting is a
 * judgement call and stays a human one -- this removes the searching, not the
 * deciding.
 *
 * STATE lives in tools/reconciled.json, committed, so the mapping survives the
 * machine it was produced on.
 *
 *   node reconcile.js status            what is outstanding
 *   node reconcile.js delta             the commits, classified
 *   node reconcile.js impact            which of them touch our changed paths
 *   node reconcile.js mark <sha>        record a tip as reconciled
 *   node reconcile.js map               the source -> integration ledger
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findRepoRoot(start) {
  let d = start;
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(d, 'Coned', 'CLCPA', 'ExecutiveDashboard_dev', 'app.js'))) return d;
    const up = path.dirname(d); if (up === d) break; d = up;
  }
  return null;
}
const REPO = process.env.DAC_REPO || findRepoRoot(__dirname);
if (!REPO) { console.error('repo root not found; set DAC_REPO'); process.exit(1); }
const STATE = path.join(__dirname, 'reconciled.json');
const APP = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';

const git = (c) => execSync('git ' + c, { cwd: REPO, maxBuffer: 1 << 28 }).toString().trim();
const state = fs.existsSync(STATE)
  ? JSON.parse(fs.readFileSync(STATE, 'utf8'))
  : { engineerTip: null, integrationBase: null, ledger: [], note: '' };

/* The engineer's live line. Determined from the GRAPH, never from branch names:
 * a branch is live only if it is ahead of main and not behind it. */
function liveTips() {
  const branches = git('branch -r --format=%(refname:short)').split('\n')
    .map(s => s.trim()).filter(b => b && !/HEAD/.test(b));
  const out = [];
  for (const b of branches) {
    let counts;
    try { counts = git('rev-list --left-right --count origin/main...' + b).split(/\s+/); }
    catch (e) { continue; }
    const behind = parseInt(counts[0], 10), ahead = parseInt(counts[1], 10);
    if (ahead > 0) out.push({ branch: b, ahead, behind, date: git('log -1 --format=%ad --date=short ' + b) });
  }
  /* live = ahead AND not behind. Everything else is abandoned divergence, and
   * on this repository that distinction is stark: the live stack is 0 behind,
   * the stale ones are 159 to 702 behind. */
  const live = out.filter(b => b.behind === 0);
  /* A STACK IS NOT A SET OF PEERS. The three r4 branches are all 0-behind, so
   * a naive filter calls all three live and picking [0] picks an arbitrary one.
   * The tip is the branch that has every other live branch as an ancestor --
   * determined from the graph, because that is the only thing that knows. */
  const isAncestor = (a, b) => {
    try { execSync('git merge-base --is-ancestor ' + a + ' ' + b, { cwd: REPO }); return true; }
    catch (e) { return false; }
  };
  const tips = live.filter(b => !live.some(o => o.branch !== b.branch && isAncestor(b.branch, o.branch)));
  const stacked = live.filter(b => !tips.some(t => t.branch === b.branch));
  tips.sort((a, b) => b.ahead - a.ahead);
  return { live: tips, stacked: stacked, stale: out.filter(b => b.behind > 0) };
}

/* Classification is from the DIFF, not the commit subject -- a subject is a
 * claim, a path is a fact. */
function classify(sha) {
  const files = git('show --pretty=format: --name-only ' + sha).split('\n').filter(Boolean);
  const has = (re) => files.some(f => re.test(f));
  const tags = [];
  if (has(new RegExp(APP.replace(/[/.]/g, '\\$&')))) tags.push('APPLICATION');
  if (has(/ExecutiveDashboard_dev\/styles\.css$/)) tags.push('STYLES');
  if (has(/ExecutiveDashboard_dev\/.*\.html$/)) tags.push('HTML');
  if (has(/ExecutiveDashboard_dev\/(payload|map_payload)\.json$/)) tags.push('DATA');
  if (has(/ExecutiveDashboard_dev\/Data\//)) tags.push('PIPELINE');
  if (has(/tickets\/.*\/(suite|mut)_/)) tags.push('TESTS');
  if (has(/tickets\/_kit\//)) tags.push('HARNESS');
  if (has(/deploy-backups\//)) tags.push('DEPLOY');
  if (has(/\.md$/)) tags.push('DOCS');
  return { sha, files, tags: tags.length ? tags : ['OTHER'],
    subject: git('log -1 --format=%s ' + sha), date: git('log -1 --format=%ad --date=short ' + sha) };
}

/* Paths this integration line has already modified. A delta touching one of
 * these needs a real reconciliation rather than a copy. */
const OURS = [APP, 'Coned/CLCPA/tickets/security-evidence'];

/* The security controls. A delta that moves any of these text shapes is
 * reported loudly whatever its commit message says. */
const CONTROL_SHAPES = [
  'escapeHtml(formatCell(', 'escapeHtml(b.name)', 'escapeHtml(cat.name)',
  'escapeHtml(p.name)', 'escapeHtml(row.dataset.name)', 'escapeHtml(b.dataset.name)',
  'escapeHtml(slice.dataset.name)', 'odataLiteral(', 'test(dsKey)',
];

/* WHERE THE NEXT DELTA ACTUALLY LIVES.
 *
 * The original model assumed her work sits on a long-lived branch ahead of
 * main, so "no live branch" meant "nothing to do". On 2026-09-19 that stopped
 * being true twice: she merged each stack into main via PR and deleted the
 * branch immediately. The tool then reported "no live engineer branch" while
 * 36 unreconciled commits sat on main -- a false all-clear, which is the worst
 * failure mode a reconciliation tool can have.
 *
 * So the source is the live tip when one exists, and origin/main otherwise.
 * Work that has landed on the trunk is still work we have not absorbed. */
function reconcileSource(t) {
  if (t.live.length) return { ref: t.live[0].branch, kind: 'branch' };
  return { ref: 'origin/main', kind: 'main' };
}

function outstandingCount(from, ref) {
  try { return git('rev-list --count ' + from + '..' + ref); } catch (e) { return '?'; }
}

const cmd = process.argv[2] || 'status';

if (cmd === 'status') {
  const t = liveTips();
  console.log('RECONCILIATION STATUS');
  console.log('  integration base   : ' + (state.integrationBase || '(unset)'));
  console.log('  last reconciled tip: ' + (state.engineerTip || '(none)'));
  console.log('  origin/main        : ' + git('rev-parse --short origin/main'));
  console.log('');
  console.log('  LIVE engineer TIP(s) (ahead of main, not behind, not an ancestor of another):');
  if (!t.live.length) console.log('    (none)');
  t.live.forEach(b => console.log('    ' + String(b.ahead).padStart(3) + ' ahead  ' + b.date + '  ' + b.branch));
  if (t.stacked && t.stacked.length) {
    console.log('');
    console.log('  stacked BENEATH the tip (already contained in it):');
    t.stacked.forEach(b => console.log('    ' + String(b.ahead).padStart(3) + ' ahead  ' + b.date + '  ' + b.branch));
  }
  console.log('');
  console.log('  stale/abandoned (ahead but also behind -- not reconciliation input):');
  t.stale.slice(0, 8).forEach(b => console.log('    ' + String(b.ahead).padStart(3) + '/-' +
    String(b.behind).padEnd(4) + b.date + '  ' + b.branch));
  if (state.engineerTip) {
    const src = reconcileSource(t);
    const n = outstandingCount(state.engineerTip, src.ref);
    console.log('');
    if (src.kind === 'main') {
      console.log('  no live branch -- reading the TRUNK instead, because merged-and-deleted');
      console.log('  work is still work we have not absorbed.');
    }
    console.log('  OUTSTANDING: ' + n + ' commit(s) on ' + src.ref + ' since ' + state.engineerTip);
  }
} else if (cmd === 'delta' || cmd === 'impact') {
  const t = liveTips();
  const src = reconcileSource(t);
  if (src.kind === 'main') {
    console.log('(no live branch -- reading origin/main; her stacks are merged and deleted)');
    console.log('');
  }
  const tip = src.ref;
  const from = process.env.DAC_FROM || state.engineerTip || 'origin/main';
  let shas = [];
  try { shas = git('rev-list --reverse ' + from + '..' + tip).split('\n').filter(Boolean); }
  catch (e) { console.error('cannot range ' + from + '..' + tip); process.exit(1); }
  console.log('DELTA  ' + from + ' .. ' + tip + '   (' + shas.length + ' commit(s))');
  console.log('');
  shas.forEach(sha => {
    const c = classify(sha);
    console.log('  ' + sha.slice(0, 7) + '  ' + c.date + '  [' + c.tags.join(',') + ']');
    console.log('      ' + c.subject.slice(0, 96));
    if (cmd === 'impact') {
      const collide = c.files.filter(f => OURS.some(o => f === o || f.indexOf(o + '/') === 0));
      if (collide.length) {
        console.log('      >> TOUCHES PATHS THIS LINE HAS CHANGED: ' + collide.join(', '));
        /* does it move a security control? */
        let diff = '';
        try { diff = git('show --unified=0 ' + sha + ' -- ' + APP); } catch (e) {}
        const moved = CONTROL_SHAPES.filter(s => diff.indexOf(s) >= 0);
        if (moved.length) console.log('      >> !! MOVES A SECURITY CONTROL: ' + moved.join(', '));
        else console.log('      >> no security control text in this diff');
      }
      console.log('      files: ' + c.files.length);
    }
  });
  console.log('');
  console.log('  Next: review each, port, run tools/run_security.sh, then `reconcile.js mark <tip>`.');
} else if (cmd === 'mark') {
  const sha = process.argv[3];
  if (!sha) { console.error('usage: reconcile.js mark <sha>'); process.exit(1); }
  const full = git('rev-parse ' + sha);
  state.engineerTip = full.slice(0, 7);
  state.ledger.push({
    engineerCommit: full,
    engineerSubject: git('log -1 --format=%s ' + full),
    integrationCommit: git('rev-parse --short HEAD'),
    reconciledAt: new Date().toISOString().slice(0, 10),
    validation: process.env.DAC_VALIDATION || 'tools/run_security.sh green',
  });
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');
  console.log('marked ' + state.engineerTip + ' as reconciled into ' + git('rev-parse --short HEAD'));
} else if (cmd === 'map') {
  console.log('SOURCE -> INTEGRATION LEDGER');
  if (!state.ledger.length) console.log('  (empty)');
  state.ledger.forEach(e => {
    console.log('  ' + e.engineerCommit.slice(0, 7) + '  ' + e.engineerSubject.slice(0, 64));
    console.log('     -> ' + e.integrationCommit + '   ' + e.reconciledAt + '   ' + e.validation);
  });
} else {
  console.log('usage: reconcile.js status|delta|impact|mark <sha>|map');
}
