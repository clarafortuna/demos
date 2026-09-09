# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

A collection of client demo sites served statically from `demo.clarafortuna.com` (see `CNAME`). Almost all engineering effort lives in one of them: the **Con Edison CLCPA DAC dashboard**, a single-page app deployed as Dataverse web resources into a Power Apps model-driven app.

There is **no build step, no package manager, no test framework**. No `package.json`, no `requirements.txt`. Everything is hand-written HTML/CSS/JS run directly, plus standalone Node and Python scripts. `python` and `python3` both resolve to 3.14 here.

## The active app, and the two copies that are not

```
Coned/CLCPA/ExecutiveDashboard_dev/     <- THE current build. All work happens here.
Coned/CLCPA/ExecutiveDashboard_Test/    <- older, ~9k lines, has its own dual backend
Coned/CLCPA/ExecutiveDashboard/         <- older still, ~8.7k lines
Coned/Dac_Dashboard/                    <- V2, single app.js (~5.2k lines), has the only README
Coned/CLCPA/Dac_Dashboard_V1/           <- V1, split into per-section HTML + per-page JS
```

`_dev` is the one that deploys. `_Test` is **not** newer despite the name. `Coned/Dac_Dashboard/README.md` is the repo's only README and describes V2, so its file sizes and layout do not apply to `_dev`.

Inside `_dev`:

| file | role |
|---|---|
| `app.js` | the whole application, ~21.7k lines, one IIFE |
| `ExecutiveDashboard.html` | the real shell, and the deployed web resource |
| `index.html` | a client-side password gate that redirects to the shell; not deployed logic |
| `styles.css` | ~9.1k lines |
| `payload.json` | the legacy single source of report data, now a revert parachute (see below) |
| `map_payload.json` | map base data; **diverges from its own pipeline** and is not fully reproducible |
| `Data/` | the Python data pipeline, the Node checkers, and `stamp_build.js` |

Run it locally from the app directory (`fetch()` needs HTTP, not `file://`):

```bash
cd Coned/CLCPA/ExecutiveDashboard_dev && python -m http.server 8000
# then open http://localhost:8000/ExecutiveDashboard.html
```

## app.js architecture

One IIFE with banner-comment sections. To list them with their titles:

```bash
grep -A1 -E "^  // ={10,}" app.js | grep -E "^[0-9]*-?  // [A-Z]"
```

The parts that need several files to understand:

**Two interchangeable storage backends, one interface.** `Storage` (near the top) wraps either `dvBackend` (Dataverse Web API, detected when hosted) or `lsBackend` (localStorage, used on localhost). `Storage.init()` is awaited once in boot and picks one; every other method keeps a synchronous signature so callers are unaware. `dvBackend` loads all rows into memory at init, serves getters from cache, and pushes writes in the background. Three Dataverse tables back the three localStorage buckets -- `cr2bf_dacingesttesttabledata1s` (overrides), `…changehistories`, `…reportingyears`. Entity set names are resolved from `EntityDefinitions` at init rather than hardcoded.

**Report data comes from Dataverse, not `payload.json`.** `var DAC_SOURCE = 'dataverse'` (~line 13928) is the switch. `composePayloadFromRows()` builds the payload shape from Dataverse rows; `loadPayload()` still runs first, and the composed result only replaces it when the flag says `dataverse`. A compose that throws or returns null falls back on its own. `payload.json` stays deployed as an instant-revert parachute -- reverting is that one word, no deploy.

**Stored vs derived is the central design rule.** Stored: table values, schemas, titles, mapping, presentation hints, section copy, KPI and chart *definitions*, two config numbers. Derived: every chart value, every KPI value, `meta.years`, `meta.current_year`. A stored copy of a computed figure is a second source of truth, and a long run of tickets (CLCPA-141 through -143, and CLCPA-238) exists because rounded copies drifted from their sources. Do not add a stored copy of anything computable.

**One shared derive engine.** `DERIVED_COLS` / `DERIVED_ROWS`, `applyDerivedCols`, `rowsForDisplay` (clones -- never mutates), `recomputeTotals`, `kpiDacPct`. The composer runs the same engine the renderer does, so the two cannot drift.

**`dacShadowCompare`** loads both sources and canonically compares them (`dacCanon`, `dacFirstDiff` -- key order ignored, array order significant). Both sides must go through the same display view or the comparison lies.

**`header_levels` is not a count of header rows.** `2` means `data[0]` is a second header row (A9, A10, F6). `0` means something else entirely -- D1 carries `0` and its first row is genuine, editable data. A predicate of "has a `header_levels` key" is wrong and has caused a real defect.

## Tests: node scripts under `tickets/`, one directory per ticket

```
Coned/CLCPA/tickets/<TICKET>-evidence/
  suite_<n>.js            acceptance assertions
  mut_<n>.js              mutation controls for that suite
  <name>-output.txt       the committed run output
```

`suite_*` are the acceptance suites; `mut_*` are mutation runners; `derive_*`, `diag_*`, `probe_*`, `gen_seed`, `seed_*`, `schema_*`, `preflight_*` are one-off offline proofs kept as evidence.

Run one:

```bash
cd Coned/CLCPA/tickets/CLCPA-238-evidence && node suite_composer.js
```

Every suite prints `N passed, M failed` and exits non-zero on failure. **There is no test-name filter** -- the way to run a variant is the env pins each suite reads: `DAC_BASE_COMMIT` (the pre-change baseline, in 16 suites), `DAC_APP_OVERRIDE` (feed a deliberately broken `app.js` in -- this is how mutation controls work), plus per-suite pins like `DAC_NEW_COMMIT`, `DAC_237_COMMIT`, `DAC_CSS_COMMIT`, `CLCPA212_BASE`.

Full sweep, all suites:

```bash
cd "$(git rev-parse --show-toplevel)"
for f in Coned/CLCPA/tickets/*/suite_*.js Coned/CLCPA/tickets/*/derive_*.js \
         Coned/CLCPA/tickets/*/diag_*.js; do
  d=$(dirname "$f"); b=$(basename "$f")
  printf "%-28s %s\n" "$b" "$( (cd "$d" && node "$b" 2>&1) | grep -E '[0-9]+ passed' | tail -1)"
done
```

Deliberately excluded from sweeps: `gen_seed.js` rewrites `seed_manifest.json` with a fresh timestamp, and that file must keep the timestamp of the seed actually written to Dataverse. Also note `controls_193_199.js` writes ~17 MB of mutant `app.js` copies into a `mutants/` directory -- delete it, never commit it.

The other checkers live beside the pipeline: `Data/check_*.py` and `Data/check_*.js` (`check_doc_claims.js`, `check_hidden_guard.js`, `check_no_file_served_map.js`, `check_territory_coupling.py`, `check_territory_simplification.py`).

### The harness pattern

Suites test the **shipped bytes**, not a copy. They read `app.js` as text and either regex it or evaluate slices of it:

- `grab(name, src)` / `grabDecl(name, src)` extract a function or declaration by indentation-anchored search. Anchors are `'\r\n' + pad + 'function ' + name + '('`.
- `codeOnly(src)` strips comments. **Always pass structural pins through it** -- a doc comment quoting the old code will satisfy a search for the old code, which has happened eight times.
- `guard(label, fn)` wraps each block so a throw becomes a *named* failure instead of discarding the whole run.
- To drive real logic, cut the block out of `app.js` and `new Function(...)` it, resolving dependencies by following `ReferenceError`s. But note the limit: **a hand-fed slice cannot see a missing closure.** At least one guard per user-reachable function must assemble it with its real dependency list and call it.
- Baselines come from `git show <commit>:<path>` and must be normalised to CRLF (`.replace(/\r?\n/g, '\r\n')`) -- git blobs are LF, the working tree is CRLF, and an `indexOf('\r\n…')` in LF text returns -1 and silently slices from the end.

### Rules that are load-bearing

- **The acceptance baseline must predate the change.** Pin `BASE` to a commit, never `HEAD`. New-vs-new equivalence is blind to regressions.
- **Pin both sides.** A suite whose post-change side reads the working tree silently becomes a check on every later round. `suite_193_199` and `suite_237` are pinned to `54540ce` and `40642e2` for exactly this reason.
- **Every mutation must turn its suite red on the assertion it targets**, and the runner must end with a clean re-run against byte-restored source and say so loudly.
- **Regenerate committed `*-output.txt` from clean source immediately before committing**, and **run the regression sweep LAST** -- a sweep run before mutations leaves output files describing a mutated, red run.
- Re-pin stale suites rather than widening assertions. A tolerant assertion is a deleted guard.
- Suites rewrite their own output files on every run with LF endings. `git status` will show them as modified when `git diff` shows no content change -- that is the line-ending mismatch, not a real diff. Compare content with `git diff --quiet`.

## Deploying to Dataverse

**A deploy happens only on an explicit go, and so does a commit during a freeze.** Every deploy in this repo's history was approved first, by name, with the expected build id stated in advance. Do the offline half, report the derived ids, and wait. Presentation dates put hard freezes on the app, and `payload.json` has its own freeze independent of the code: no value *and* no shape changes to it outside a review phase, because it is the revert parachute.

Target: org `https://org9076e69b.crm.dynamics.com`, solution `CLCPADACDashboard` (**not** `…Dev`, which does not resolve), publisher prefix `cr2bf`, app `cr2bf_dactest`. Three web resources, all pushed together:

| resource | id |
|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` |

The HTML goes **every time**: it carries `?v=<id>` cache-busting stamps, and it is often the same byte length before and after with different content, so push decisions must be made on bytes, never on length.

`Data/stamp_build.js` owns build identity and is the only correct way to derive it:

```bash
cd Coned/CLCPA/ExecutiveDashboard_dev
node -e "console.log(require('./Data/stamp_build.js').prepare('./').ids)"
```

The id is `sha256(canonical form)[0:10]` per file, where canonical means `var APP_BUILD = 'dev';   /* BUILD_ID */` restored -- so stamping is idempotent and re-running cannot drift. `app.js` stays `'dev'` in the repo on purpose; the deploy stamps it in memory and prints it at boot, because a server-verified deploy says nothing about which build a *browser* is running.

Deploy scripts are scratch artifacts, written per deploy and archived in `deploy-backups/<date>-<slug>/`. Copy the most recent surviving one as a template (`ls -t deploy-backups/*/deploy_*.js | head -1`). The shape that matters:

1. **Everything offline happens before the device code is requested.** Device codes expire; a script that throws after authenticating wastes one. Support `DAC_DRY_RUN=1` to prove the offline half. The script self-checks its own helpers and constants first -- a TDZ in a deploy script has cost a code.
2. Gates: on `main`, source folder clean, `node --check app.js`, all suites green, derived ids equal the expected ids, snapshot directory **absent** (so the archive is created, not overwritten -- this is how folder names once drifted off by one deploy).
3. Auth is device-code OAuth: client `51f81489-12ee-4a9e-aaae-a2591f45987d`, tenant `organizations`, scope `<org>/.default offline_access`. This needs a human to sign in, so run the script in the background and surface the code.
4. Resolve each web resource id to its expected **name** before writing to it.
5. Archive the live bytes to `deploy-backups/` **and prove which build they are**: canonicalise the live `app.js` and hash it, and check the file's own `APP_BUILD` stamp. Both must agree with the expected previous build. A snapshot of an unidentified build is not a rollback.
6. `PATCH webresourceset({id})` with base64 content, then **one** `POST PublishXml` covering all three.
7. Read back and require byte-identical, then check the server copy *carries* the ids (`app.js` stamps itself, the HTML references both).
8. Commit the snapshot afterwards as a records-only commit, message `deploy-backups: pre-deploy snapshot for …`, identifying the archived build by content three ways: per-file sha256, the derived build id, and a cross-check against the previous deploy's own read-backs.

Dataverse API notes learned the hard way: privilege names are **schema**-cased (`prvCreatecr2bf_DACTractDataset`), so read them from metadata rather than composing them; use `$select=Privileges`, not `$expand`; `MaxLength` needs cast segments (`Attributes/Microsoft.Dynamics.CRM.StringAttributeMetadata`); `solutioncomponents` filters on `componenttype` (1 = Entity, 2 = Attribute) and needs `MetadataId` in `$select`.

**`gh` is not installed on this machine.** Open and merge PRs through the REST API using the token from `git credential fill` (host `github.com`), which carries `repo` scope.

## The data pipeline

`Coned/CLCPA/ExecutiveDashboard_dev/Data/` holds Python builders (`build_payload.py`, `build_tract_dataset.py`, `build_geometry_dataset.py`, `build_coned_dataset.py`, `build_indicator_catalog.py`, …), enrichers (`enrich_*.py`), and converters. Read each script's docstring -- they carry the pipeline order and the reasons behind their choices. `build_payload.py` builds `payload.json` from the legacy section HTMLs and documents how to add a reporting year.

Seven of these scripts plus three operator guides ship to Con Edison as a handoff zip, assembled by `Coned/CLCPA/make_handoff_package.py` and checked by `verify_handoff_package.py`, which unpacks the zip **outside this repo** and runs each guide's own commands against it. If you change a script's location or interface, the guides and that verifier must move with it -- they went out of sync for ten days once.

Geometry cost is **vertices, not decimal places**. Territory geometry shipped 14.6× smaller that way. Tract geometry is the next lever but needs *topology-preserving* simplification, not the same technique.

## Reference documents

- `Coned/CLCPA/MIGRATION_READINESS.md` -- measured facts about the Dataverse org for whoever directs the migration: inventory, dead weight, security roles, open questions. Everything in it is read from the org, dated, and marked MISSING where it could not be read.
- `Coned/CLCPA/HANDOFF_PACKAGE_VERIFICATION.md` -- evidence the handoff zip is self-sufficient.
- `Coned/CLCPA/OPERATOR_SCRIPT_FACTS.md`, `Coned/CLCPA/operator-docs/` -- operator-facing documentation.
- `Coned/CLCPA/tickets/*.md` -- per-ticket findings and close comments alongside their evidence directories.
- `SESSION_LOG.md` -- **stale**; its newest entry is 2026-07-10. Do not treat it as current state.

## Conventions

- **No long dashes anywhere** -- documents, UI strings, and code comments alike. Numeric ranges and the null glyph are not punctuation and need a ruling before touching.
- Repo `.md` files are frozen evidence: they describe a build at a date. Jira is the single record of ticket state; chat is the channel.
- Unmeasured numbers are reported as **MISSING**, never estimated into a table. A fabricated data point poisons the calibration it feeds.
- Merged history is never rewritten. Correct a wrong figure in the PR description and say so; leave the commit message as it stands.
- CRLF everywhere in the working tree. `sed -i` in this git-bash strips CR from CRLF files, and heredocs eat backslashes -- patch scripts with regexes go through the Write/Edit tools, not a heredoc.
- Prefer the Edit tool over shell string surgery for anything containing `\`, `${`, or a template literal. `String.replace` with a replacement string containing `$'` or `$&` expands rather than inserting -- always use the function form, `a.replace(from, () => to)`.
