# CLCPA Executive Dashboard — Development

## Run it

```bash
cd Coned/CLCPA/ExecutiveDashboard_dev
python -m http.server 8000          # fetch() needs HTTP, not file://
# open http://localhost:8000/ExecutiveDashboard.html
```

Served this way there is no Dataverse context, so `Storage` falls back to `localStorage` and the app
reports itself as build `dev` (unstamped). That is deliberate: a locally served copy must not
impersonate a deploy.

## Project root — how paths resolve

Nothing hard-codes a checkout path any more. Resolution walks **up** from the calling file until it
finds the marker `.clcpa-root`, so the same code works from any directory, any checkout, any OS, and
in CI.

```js
const { projectRoot, repoRoot, appDir } = require('<…>/tools/project_root.js');
```

- `projectRoot()` — the directory holding `.clcpa-root`. Today `Coned/CLCPA`; after the repository
  split, the repo root. **This is the stable anchor.**
- `repoRoot()` — the git repository containing the project. Derived from `projectRoot()`, so callers
  that say `REPO + '/Coned/CLCPA/...'` keep working today and only this file changes at migration.
- `appDir()` — the application directory.

Overrides: `DAC_PROJECT_ROOT`, `DAC_REPO`. Resolution **throws** when the marker is missing rather
than guessing — a resolver that silently returns a plausible-but-wrong directory makes a suite read
the wrong `app.js` and report green.

To re-check after moving files: `node tools/migrate_paths.js --verify` (exit 1 on any unexpected
absolute path). Three exceptions are known and correct: a temp simulation directory in
`validate_outputs.js`, and the Chrome and Edge binaries `_kit/cdp.js` locates.

## Tests

```bash
sh tools/run_security.sh                              # the security set: 125 assertions, 9 mutants
cd tickets/<TICKET>-evidence && node suite_<n>.js     # one suite
```

Conventions the estate relies on:

- every suite prints `N passed, M failed` as its last line — the gate parses exactly that;
- `DAC_APP_OVERRIDE=<path>` swaps the `app.js` under test; this is how mutation runners work;
- `DAC_OUT=<path>` redirects the committed `*-output.txt`;
- `mut_*.js` proves its `suite_*.js` can fail, and ends with a byte-restored clean re-run.

### Do not modify source fixtures by accident

Two ways this has already bitten:

**Suites write their output next to themselves.** Run them with `REPO` pointed at a real checkout and
they overwrite committed `*-output.txt` files. If you build a harness that runs many suites, redirect
writes (`DAC_OUT`) or sandbox them. This happened during integration; nineteen files had to be
restored from `origin/main`.

**Line endings are part of a fixture's identity.** The four CLCPA-238 seed files have their sha256
recorded in `seed_manifest.json`. `.gitattributes` pins them to LF; without that, `core.autocrlf`
rewrites them on checkout and `suite_composer` and `diag_shadow_baseline` fail on files nobody edited.

## Harness limitations to know before writing a test

- **`_kit/live_page.js` does not decode HTML entities.** `dataset.name` returns `&lt;img&gt;` where a
  browser gives `<img>`, and `textContent` keeps `&amp;`. Driving an attribute round-trip through it
  reports vulnerable code as safe. The security suites supply the decoding step themselves and say so.
- **Many suites read a pinned historical revision**, not the working tree — the `NEWREV` / `BASE`
  constants. They assert that a past proof still reproduces, which is not the same as validating the
  current build.
- **`DAC_APP_OVERRIDE` is not behaviour-neutral** for those suites: it replaces a pinned revision with
  current content. Comparing before and after must use the *same* mechanism on both sides.

## Reconciling the other engineer's work

```bash
node tools/reconcile.js status     # what is outstanding
node tools/reconcile.js impact     # the delta, classified, with security-control flags
node tools/reconcile.js mark <sha> # record a tip as reconciled
node tools/reconcile.js map        # the source -> integration ledger
```

It determines the live branch from the commit graph, never from names: a branch is live only if it is
ahead of `main` **and not behind it**, and the tip of a stack is the branch no other live branch
descends from.
