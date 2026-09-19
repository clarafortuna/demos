/* Where is this project, and where is the repository it currently lives in?
 *
 * THE PROBLEM THIS REPLACES. 150 files under tickets/ and Data/ carried
 *     const REPO = 'c:' + '/Users/emely/Desktop/Projects/demos';
 * 158 times across nine different constant names. Every one of them fails on
 * any machine but one, which is why the suites could not run in CI, on Linux,
 * or on a second developer's checkout.
 *
 * WHY THE ANCHOR IS A PROJECT MARKER AND NOT THE GIT ROOT. The obvious fix is
 * to walk up until .git appears. That works today and breaks on the day this
 * project moves into its own repository, because then the git root IS the
 * project root and every 'Coned/CLCPA/...' path below it is wrong by two
 * levels. Anchoring instead on a marker file placed at the PROJECT root means
 * the same resolver answers correctly in both layouts:
 *
 *     demos today          <demos>/Coned/CLCPA/.clcpa-root
 *     standalone later     <clcpa>/.clcpa-root
 *
 * projectRoot() is therefore the stable thing, and repoRoot() is derived from
 * it. Callers that already say REPO + '/Coned/CLCPA/...' keep working unchanged
 * today, and on migration only this file needs to know that the two roots have
 * become the same directory.
 *
 * FAILS LOUDLY. A resolver that silently returns a wrong-but-plausible
 * directory would make a suite read the wrong app.js and report green. When the
 * marker cannot be found this throws and names the directory it started from.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const MARKER = '.clcpa-root';

function projectRoot(start) {
  if (process.env.DAC_PROJECT_ROOT) return path.resolve(process.env.DAC_PROJECT_ROOT);
  let d = start || __dirname;
  for (let i = 0; i < 16; i++) {
    if (fs.existsSync(path.join(d, MARKER))) return d;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  throw new Error('CLCPA project root not found above ' + (start || __dirname) +
    ' (looking for ' + MARKER + '); set DAC_PROJECT_ROOT to override.');
}

/* The repository that currently contains the project. In the demos layout the
 * project sits two levels down; once the project owns its repository the two
 * are the same directory and this returns the project root itself. */
function repoRoot(start) {
  if (process.env.DAC_REPO) return path.resolve(process.env.DAC_REPO);
  const p = projectRoot(start);
  const twoUp = path.resolve(p, '..', '..');
  return fs.existsSync(path.join(twoUp, '.git')) ? twoUp : p;
}

/* The application directory, which is what most callers actually want. */
function appDir(start) {
  const p = projectRoot(start);
  const inPlace = path.join(p, 'ExecutiveDashboard_dev');
  return fs.existsSync(inPlace) ? inPlace : path.join(p, 'app');
}

module.exports = { projectRoot, repoRoot, appDir, MARKER };
