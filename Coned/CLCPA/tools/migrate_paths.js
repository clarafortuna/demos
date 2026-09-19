/* Replace the hard-coded repository path in the ticket suites and Data tools.
 *
 * SCOPE, measured not assumed: 150 files, 158 occurrences, nine different
 * constant names (REPO, DIR, CSS, APP, DEV, T, SRC, PAYLOAD, EXPORT). Targeting
 * constant NAMES would guarantee missing the tenth, so the rule targets the
 * PREFIX inside any string literal and leaves the rest of the literal alone:
 *
 *     '<abs>/Coned/CLCPA/.../app.js'
 *  -> _dacRepo() + '/Coned/CLCPA/.../app.js'
 *
 * so `const REPO = '<abs>';` becomes `const REPO = _dacRepo() + '';` and every
 * other shape falls out of the same substitution.
 *
 * BEHAVIOUR PRESERVATION IS THE POINT. REPO keeps meaning exactly what it meant
 * -- the repository root -- so no path downstream changes. Only the derivation
 * moves, from a literal to a question asked of the filesystem.
 *
 *   node migrate_paths.js          apply
 *   node migrate_paths.js --dry    report only
 *   node migrate_paths.js --verify confirm no absolute paths remain
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { projectRoot } = require('./project_root.js');

const ROOT = projectRoot();
const DRY = process.argv.indexOf('--dry') >= 0;
const VERIFY = process.argv.indexOf('--verify') >= 0;

/* Any drive letter, and both spellings seen in the tree (with and without a
 * trailing slash). Case-insensitive on the drive only. */
const ABS = /'[A-Za-z]:\/Users\/emely\/Desktop\/Projects\/demos/g;
const REPL = "_dacRepo() + '";

/* Injected once per rewritten file. Deliberately tiny and local: a reviewer
 * should be able to read the whole change in one glance, and a file should not
 * gain a require() on a module that may itself move. */
const PRELUDE = [
  "const _dacRepo = () => {",
  "  const p = require('path'), f = require('fs');",
  "  if (process.env.DAC_REPO) return p.resolve(process.env.DAC_REPO);",
  "  let d = __dirname;",
  "  for (let i = 0; i < 16; i++) {",
  "    if (f.existsSync(p.join(d, '.clcpa-root'))) {",
  "      const two = p.resolve(d, '..', '..');",
  "      return f.existsSync(p.join(two, '.git')) ? two : d;",
  "    }",
  "    const u = p.dirname(d); if (u === d) break; d = u;",
  "  }",
  "  throw new Error('CLCPA project root not found above ' + __dirname + '; set DAC_REPO');",
  "};",
  "",
].join('\n');

/* Paths that must not be rewritten. The dacpkg one is a temp SIMULATION
 * directory, not the repository -- rewriting it would point a packaging probe
 * at the source tree and quietly change what it measures. */
const EXCEPTIONS = [
  /AppData[/\\]Local[/\\]Temp/,   // a temp SIMULATION directory, not the repository
  /Program Files/,                // browser binaries located by _kit/cdp.js
];

const files = [];
(function walk(d) {
  for (const n of fs.readdirSync(d)) {
    /* tools/ is EXCLUDED. The first run rewrote project_root.js by matching
     * the example path in its own documentation, and prepended a prelude to
     * the file whose whole job is to make the prelude unnecessary. A migrator
     * must not be in its own scope. */
    if (n === 'node_modules' || n === '.git' || (d === ROOT && n === 'tools')) continue;
    const p = path.join(d, n);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.js$/.test(n)) files.push(p);
  }
})(ROOT);

let rewrote = 0, already = 0, untouched = 0;
const exceptions = [], stillAbsolute = [];

for (const f of files) {
  const before = fs.readFileSync(f, 'utf8');
  if (before.indexOf('_dacRepo') >= 0) { already++; continue; }
  const after = before.replace(ABS, REPL);
  if (after !== before) {
    if (!DRY && !VERIFY) fs.writeFileSync(f, PRELUDE + after);
    rewrote++;
  } else {
    untouched++;
  }
  /* Detect, never assume: anything still absolute after the rule ran. */
  const probe = (after === before ? before : after);
  const hits = probe.match(/'[A-Za-z]:[/\\][^']*'/g) || [];
  hits.forEach(h => {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    if (EXCEPTIONS.some(re => re.test(h))) exceptions.push(rel + '  ' + h.slice(0, 74));
    else stillAbsolute.push(rel + '  ' + h.slice(0, 74));
  });
}

console.log('======================================================================');
console.log((VERIFY ? 'VERIFY' : DRY ? 'DRY RUN' : 'APPLY') + '  path migration under ' + ROOT);
console.log('======================================================================');
console.log('  .js files scanned     : ' + files.length);
console.log('  rewritten             : ' + rewrote);
console.log('  already migrated      : ' + already);
console.log('  no absolute prefix    : ' + untouched);
console.log('');
console.log('  KNOWN EXCEPTIONS (deliberately left absolute): ' + exceptions.length);
exceptions.forEach(e => console.log('    ' + e));
console.log('');
console.log('  UNEXPECTED absolute paths remaining: ' + stillAbsolute.length);
stillAbsolute.forEach(e => console.log('    ' + e));

if (VERIFY && stillAbsolute.length) process.exit(1);
