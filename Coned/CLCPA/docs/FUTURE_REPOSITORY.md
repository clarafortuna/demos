# CLCPA — The standalone repository

**Not created. This is the proposal.**

## Name

`clcpa-executive-dashboard` — what it is, not who built it and not the client's internal ticket
prefix. `coned-dac-dashboard` is the alternative if the client-facing name matters more.

## Structure, derived from what the project actually contains

```
clcpa-executive-dashboard/
├── .clcpa-root                    the anchor every resolver walks up to
├── src/                           the deployed surface, nothing else
│   ├── app.js  styles.css  ExecutiveDashboard.html
│   ├── payload.json               revert parachute
│   └── logo/
├── data/
│   ├── pipeline/                  build_*.py, enrich_*.py, _make_territories.py
│   ├── checks/                    check_*.js|py  -- de-facto tests, today outside the gate
│   └── published/                 Data/out/*.json, via LFS
├── tests/
│   ├── kit/                       _kit/ -- the DOM, cascade and cdp harnesses
│   ├── security/                  the permanent security estate
│   ├── regression/<TICKET>/       the suite_* / mut_* estate, one dir per ticket
│   └── fixtures/                  seed data, and vendored BASE files (see below)
├── tools/                         project_root, reconcile, migrate_paths, run_security
├── deploy/
│   ├── deploy.js                  ONE script, env-parameterised
│   ├── stamp_build.js             the build-id contract, unchanged
│   └── manifests/                 one small JSON per release
├── docs/                          these six documents
└── .github/workflows/
```

Four directories that deliberately do **not** exist: no `lib/`, no `utils/`, no `common/`, no `core/`.
`app.js` is one IIFE today and inventing a module tree it does not have would be decoration.

## Branching and tickets

- Default branch `main`, protected, linear history.
- `clcpa-<n>-<slug>` for ticket work — already the convention, keep it.
- `security/<slug>` for security work that has no ticket yet, so it is visibly distinct.
- One PR per ticket, squash off. The project's commit messages are unusually informative; preserving
  them is worth more than a tidy graph.

## Release identity

Keep `stamp_build.js` exactly as it is. It is idempotent, content-addressed, and the repo copy is
deliberately unstamped. A release is:

```
git tag -s release/<date>-<slug>   ->   CI builds   ->   buildId   ->   manifest   ->   deploy   ->   read-back
```

with the manifest committed under `deploy/manifests/`. The bytes of the previous build stay a CI
artifact with a retention policy rather than living in git forever — that is what makes
`deploy-backups/` 156 MB today.

## What migrates, what stays

See `MIGRATION.md`. The short version: the deployed surface, the pipeline, the whole test estate,
`tools/`, `docs/` and the newest deploy contract migrate. 102 deploy backups, the three superseded
dashboard copies, `index.html`, `map_payload.json` and four unrelated clients stay behind.

## Migration sequence

1. Reconcile her final delta into the integration candidate; run the full gate.
2. Assign the security ticket; land the provenance updates.
3. Decide history: clean slate (recommended) versus `filter-repo`.
4. Vendor the 94 pinned BASE files as fixtures, or carry history — either way, decide before the move.
5. Create the repo, copy, move `.clcpa-root` to the root. **No test or tool should need editing**; if
   one does, the anchor design failed and that is the signal to stop and look.
6. Run the full gate in the new layout. It should be byte-identical in behaviour.
7. Stand up CI. Only then retire the `demos` line.

## CI — the smallest set that covers real risk

**Every PR** (fast, hermetic, no secrets, safe on a fork):

| Check | Why this project needs it |
|---|---|
| `node --check` on changed JS | PRE-FLIGHT 2 already does this; it has caught real breakage |
| `tools/migrate_paths.js --verify` | An absolute path re-entering the tree silently un-portables the estate |
| **security set** (`run_security.sh`) | 125 assertions, 9 mutants |
| **regression estate** | 72 suites, ~5.9k assertions |
| Secret scanning (gitleaks) | `dacdemo` is already in history at `10cd12d`; a tripwire is warranted |
| Semgrep, custom rules | Generic rules miss the shapes that actually bite here — see below |

**On `main` / release only** (slower, or needs credentials):

CodeQL; build-identity verification (build twice, fail if the ids differ); manifest generation;
`data/checks/`; deploy with its existing pre-flight.

**Custom Semgrep rules worth writing** — these encode the defects this codebase actually had:

```
dac-unescaped-td-cell        `<td…>${$F(…)}` where $F is not escapeHtml
dac-dataset-to-innerhtml     $EL.innerHTML = … $EL2.dataset.$K …      (no off-the-shelf rule finds this)
dac-odata-filter-unencoded   getAll(…,'$filter=' … + $V) without encodeURIComponent
dac-ad-hoc-escape            a hand-rolled entity replace outside src/security
dac-absolute-path            a drive-letter path literal in any .js
```

**Not recommended**: a coverage gate on a 24.8k-line monolith (noise, and it pressures the wrong
tests); DOMPurify (would be the first runtime dependency, to solve what six pure functions solve);
SonarQube (overlaps Semgrep + CodeQL + ESLint and adds infrastructure).

## Ownership

`CODEOWNERS` on `src/`, `deploy/` and `tests/security/` at minimum. The project has run on one person
for its whole life; the point of the split is that it stops doing so.
