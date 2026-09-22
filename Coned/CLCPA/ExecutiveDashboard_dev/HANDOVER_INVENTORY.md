# HANDOVER INVENTORY

**The Con Edison CLCPA DAC dashboard. Read this file first.**

Written 2026-09-21, against the build deployed that night. Everything in it is
measured or quoted from the code; anything that could not be measured is marked
**MISSING** rather than estimated.

---

## 1. What is live right now

| | |
|---|---|
| **app.js build id** | `670da36609` |
| **styles.css build id** | `4993f5eee9` |
| **Rollback pair (the build before it)** | `22d065d93a` + `4993f5eee9` |
| Org | `https://org9076e69b.crm.dynamics.com` |
| Solution | `CLCPADACDashboard` (**not** `…Dev`, which does not resolve) |
| Publisher prefix | `cr2bf` |
| App | `cr2bf_dactest` |
| Source commit deployed from | `main` at `4d10429` |

Three web resources, always pushed together:

| resource | web resource id |
|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` |

**Verify the folder you hold is the live build**, from inside it, with no network:

```bash
node -e "console.log(require('./Data/stamp_build.js').prepare('./').ids)"
# must print { 'app.js': '670da36609', 'styles.css': '4993f5eee9' }
```

That was run from a copy outside the repository on 2026-09-21 and printed exactly
that pair. It is the whole byte-identity check: `stamp_build.js` hashes the
canonical form of each file, so it cannot drift and needs nothing but Node.

**The HTML goes on every deploy.** It carries `?v=<id>` cache-busting stamps and
is frequently the same byte length before and after with different content, so
push decisions are made on **bytes, never on length**.

---

## 2. Where everything lives, and what does not travel

This folder is `Coned/CLCPA/ExecutiveDashboard_dev/` inside the `demos`
repository. **Four things it depends on are outside it** and a naive extraction
loses all of them. This is the most important section in the file.

| what | where it is now | size | disposition |
|---|---|---|---|
| **All verification**: 197 suites, mutation runners, gates, `_kit/`, every evidence directory, the ticket bodies, the CE reports, the residue lists, `org-reads-evidence/` | `Coned/CLCPA/tickets/` | 24 MB | **MOVE IN** — not done, see §8 |
| **All deploy records**: 115 pre-deploy snapshots and 32 archived deploy scripts | `deploy-backups/` at repo root | 176 MB | **MOVE IN** — not done, see §8 |
| **Operating instructions** | `CLAUDE.md` at repo root | 12 KB | **COPY IN** — not done, see §8 |
| **Handoff package lane**: `make_handoff_package.py`, `verify_handoff_package.py`, `make_operator_guides.py`, `make_operator_notebooks.py`, `operator-docs/`, `operator-guides/`, `operator-notebooks/`, `OPERATOR_SCRIPT_FACTS.md`, `HANDOFF_PACKAGE_VERIFICATION.md`, `MIGRATION_READINESS.md` | `Coned/CLCPA/` | — | **MOVE IN** — not done, see §8 |

Inside the folder, and self-sufficient:

- `app.js` — the whole application, ~27,100 lines, one IIFE
- `styles.css` — ~9,300 lines
- `ExecutiveDashboard.html` — the deployed shell
- `index.html` — a client-side password gate that redirects to the shell; not deployed logic
- `payload.json` — the legacy single source of report data, now the **revert parachute**
- `map_payload.json` — map base data; **diverges from its own pipeline** and is not fully reproducible
- `Data/` — the Python pipeline, the Node checkers, `stamp_build.js`
- `.gitattributes` — **new, added in this handover**; see §7

---

## 3. Running it

**Locally**, from this folder (`fetch()` needs HTTP, not `file://`):

```bash
python -m http.server 8000
# then open http://localhost:8000/ExecutiveDashboard.html
```

On localhost the app runs on **localStorage**, not Dataverse. Consequences worth
knowing before you conclude anything from a local run:

- `Storage.isDataverse()` is false, so the Map Data **family tab row is not
  rendered at all** and four of the five Data Sources entries are unreachable by
  clicking. Measured, not assumed.
- Saved map layers and datasets are session-only.
- The map itself does not load without network: `ExecutiveDashboard.html` pulls
  Leaflet and Turf from `unpkg.com` and the repo vendors no copy. `window.L` is
  undefined, `renderDACMap` never builds the map, and `renderMapKPI` never runs.

**The sweep** (suites, mutation controls, gates). From the repository root today:

```bash
for f in Coned/CLCPA/tickets/*/suite_*.js Coned/CLCPA/tickets/*/derive_*.js \
         Coned/CLCPA/tickets/*/diag_*.js Coned/CLCPA/tickets/*/gate_*.js; do
  d=$(dirname "$f"); b=$(basename "$f")
  printf "%-28s %s\n" "$b" "$( (cd "$d" && node "$b" 2>&1) | grep -E '[0-9]+ passed' | tail -1)"
done
```

Every suite prints `N passed, M failed` and exits non-zero on failure. There is
**no test-name filter**; variants are driven by env pins, chiefly
`DAC_BASE_COMMIT` (the pre-change baseline) and `DAC_APP_OVERRIDE` (feed a
deliberately broken `app.js` in — this is how mutation controls work).

**Deliberately excluded from sweeps:** `gen_seed.js` rewrites
`seed_manifest.json` with a fresh timestamp, and that file must keep the
timestamp of the seed actually written to Dataverse. `controls_193_199.js`
writes ~17 MB of mutant `app.js` copies into a `mutants/` directory — delete it,
never commit it.

**A deploy.** Read §5 first. Deploy scripts are scratch artifacts written per
deploy and archived afterwards; copy the most recent surviving one as a
template:

```bash
ls -t deploy-backups/*/deploy_*.js | head -1
```

Prove the offline half without touching the network or spending a device code:

```bash
DAC_DRY_RUN=1 node deploy_<slug>.js
```

---

## 4. The state of the Dataverse stores after the 2026-09-21 cleanup

Three tables back the report editor:

| table | holds |
|---|---|
| `cr2bf_dacingesttesttabledata1s` | the per-table-year data rows (overrides) |
| `cr2bf_dacingesttestchangehistories` | the audit trail |
| `cr2bf_dacingesttestreportingyears` | the record of which years were **added** |

Map stores: `cr2bf_dacmaplayers`, `cr2bf_dacmapchangehistories`,
`cr2bf_dactractdatasets`, `cr2bf_dacmaptractdatas`.

**Measured after the cleanup:**

| | |
|---|---|
| Data rows for 2098/2099 | **0** (were 10) |
| History rows for 2098/2099 | **0** (were 186) |
| Rows in `cr2bf_dacingesttestreportingyears` | **0, for every year** |
| 2023 / 2024 / 2025 | untouched, hash-identical before and after |
| Data rows, all years | 154 |
| History rows, all years | 20 |

Pre-delete backup: **commit `6928905`**, `deploy-backups/2026-09-21-clcpa224-2098-2099-cleanup/`
— every removed row, every field, with a manifest and per-row hashes. Restore by
POSTing each row back to its entity set with its own id field removed.

### What the empty reporting-years table means (the CLCPA-328 facts)

The Remove-year control's visibility is one line:

```js
const show = yr != null && Storage.getAddedYears().includes(yr) && !isYearProtected(yr);
```

and `seedYears`, which is the whole of what `isYearProtected` reads, is derived
at boot as the composed years **minus** the added-year table:

```js
.map(String).filter(y => addedYears.indexOf(y) < 0);
```

Because that subtraction has already removed everything in the added-year table,
the second condition is automatically true for anything in it, and **the rule
reduces to one question: does the year have a row in
`cr2bf_dacingesttestreportingyears`?**

The table now holds **zero rows**, so `getAddedYears()` returns nothing and
**the Remove-year control can offer no year at all.**

This is also how a year becomes unremovable. `dvBackend.removeYear` deletes the
**year row first**, then the data rows one at a time, in a **non-awaited
background promise**, and returns `true` to the UI immediately:

```js
removeYear(year) {
  const y = String(year);
  const idx = cYears.findIndex(o => o.year === y); if (idx < 0) return false;
  const rec = cYears[idx]; cYears.splice(idx, 1);
  const delIds = [];
  Object.keys(cOverrides).forEach(k => { if (k.endsWith(':' + y)) { if (cOverrides[k].id) delIds.push(cOverrides[k].id); delete cOverrides[k]; } });
  bg((async () => {
    if (rec.id) await dvDelete(SET_YEARS, rec.id);
    for (let i = 0; i < delIds.length; i++) await dvDelete(SET_TABLEDATA, delIds[i]);
  })(), 'Remove year in Dataverse failed for ' + y);
  return true;
}
```

An interruption anywhere in that loop leaves **data rows with no year record**.
Such a year still appears in the report, because the composed `meta.years` is
derived from the data rows; but it is absent from the added-year table, so it
lands in `seedYears`, `isYearProtected` returns true, and the only control that
could clean it up classifies it as a published seed year and refuses. **The
defect is self-sealing**, and it fired twice on 2026-09-21: once producing the
2098 residue and once producing the 2099 residue. Change history is never
touched by `removeYear`, which is why audit trail outlives its data.

**It also deletes nothing quietly.** A filed value stored without an advisory,
without a change count and without a history entry is a separate live defect,
RC-02 below.

---

## 5. The standing discipline, in one page

These are not suggestions. Each one exists because its absence cost something.

**Deploys and merges**

1. **A deploy happens only on an explicit go**, and so does a commit during a
   freeze. Every deploy in this repository's history was approved first, by
   name, with the expected build id stated in advance.
2. **Declare the merge order** before merging anything, and **retarget each
   stacked PR's base to `main` via the API before merging**. An open PR
   retargets automatically only when its base branch is *deleted*; merging a
   stack without retargeting nests the merges.
3. **PRE-FLIGHT 3b**: verify the wave's fingerprint symbols in the **committed
   blob**, not the working tree, and count them again in the **server copy**
   after publishing. An id gate proves the bytes were reviewed; it cannot prove
   which fix is in them.
4. **Keep every fingerprint symbol single-line.** The map is counted against the
   raw `git show` blob (LF) *and* against the server copy (CRLF). One spelling
   cannot satisfy both; a multi-line symbol passes offline and then fails the
   server re-count on a correct build. This cost a false failure on
   `22d065d93a`.
5. **Prove the rollback from ORG content, never from git**: canonicalise the
   live `app.js` and hash it **and** read its own `APP_BUILD` stamp. Both must
   agree with the expected previous build. A snapshot of an unidentified build
   is not a rollback.
6. **Push the snapshot before the first PATCH**, so the rollback exists off the
   machine before anything is overwritten.
7. **Read back and require byte-identical** on all three resources, then check
   the server copy *carries* the ids.
8. **Commit the records tail** afterwards: the deploy log and the archived
   script, records only, no code.
9. **Everything offline happens before the device code is requested.** Device
   codes expire; a script that throws after authenticating wastes one. Support
   `DAC_DRY_RUN=1`.

**Dataverse writes**

10. **Discipline 142.** A GO authorises *reading*. Writes and deletes are their
    own phase, their own GO, and their own script. The script self-audits its
    own text for which verbs it contains before it requests a code. Build the
    delete plan only from rows already backed up, committed and pushed; filter
    to the target set twice; and let the one delete helper refuse anything else
    at the moment of the request.
11. **A rationed device code means the script must never die.** A table that
    refuses a filter is read whole and filtered locally; a table that refuses
    both is reported UNREADABLE, never counted as zero; a late throw still
    writes what was captured, marked as not a backup.

**Evidence**

12. **The acceptance baseline must predate the change.** Pin `BASE` to a
    commit, never `HEAD`. New-vs-new equivalence is blind to regressions.
13. **Pin both sides.** A suite whose post-change side reads the working tree
    silently becomes a check on every later round. This happens within days:
    `suite_280` grew it overnight and had to be re-pinned.
14. **Every mutation must turn its suite red on the assertion it targets**, and
    the runner must end with a clean re-run against byte-restored source and say
    so loudly.
15. **Regenerate committed `*-output.txt` from clean source immediately before
    committing**, and **run the regression sweep LAST** — a sweep run before
    mutations leaves output files describing a mutated, red run.
16. **Re-pin stale suites rather than widening assertions.** A tolerant
    assertion is a deleted guard.
17. **Any `app.js` function or `styles.css` rule you move must declare itself in
    five cross-ticket ledgers** with the ticket named and the pinned count
    bumped: `suite_245`, `suite_249`, `suite_254_255_261`, `suite_260`,
    `suite_263`. Expect them red on your first sweep; that is what they are for.
18. **`codeOnly()` must strip JS *and* HTML comments.** A doc comment quoting
    the old code satisfies a search for the old code. This has happened eight
    times.
19. **Baselines from `git show` are LF; the working tree is CRLF.** Normalise on
    read or an `indexOf('\r\n…')` returns -1 and silently slices from the end.
20. **An indentation anchor cannot read `app.js`.** Seven wiring functions are
    declared at **column 0** inside the IIFE with bodies at four spaces. A
    two-space anchor is a substring of a four-space line, so a naive `grab()`
    over-reads to the next dedented brace — half the file — and reports
    confident nonsense. Use brace matching that skips comments, strings and
    template literals, and self-test that every block parses.

**Data and prose**

21. **STOP at the PRs.** No merge, no deploy, no device code without an explicit
    go.
22. **Stored vs derived is the central design rule.** Stored: table values,
    schemas, titles, mapping, presentation hints, section copy, KPI and chart
    *definitions*. Derived: every chart value, every KPI value, `meta.years`,
    `meta.current_year`. **Never add a stored copy of anything computable** — a
    long run of tickets exists because rounded copies drifted from their
    sources.
23. **No hardcoded data.** No figure typed into the app or into a harness; read
    it from the source. A value retyped in a harness is not evidence about the
    code.
24. **MISSING over invented.** An unmeasured number is reported as MISSING,
    never estimated into a table. A fabricated data point poisons the
    calibration it feeds.
25. **No long dashes anywhere** — documents, UI strings and code comments alike.
    Numeric ranges and the null glyph are not punctuation and need a ruling
    before touching.
26. **CRLF everywhere in the working tree.** `sed -i` in this git-bash strips CR
    from CRLF files, and heredocs eat backslashes — patch scripts with regexes
    go through an editor, never a heredoc. Prefer an editor over shell string
    surgery for anything containing `\`, `${`, or a template literal, and
    `String.replace` with a replacement containing `$'` or `$&` **expands**
    rather than inserting: always use the function form, `a.replace(from, () => to)`.
27. **`header_levels` is not a count of header rows.** `2` means `data[0]` is a
    second header row. `0` means something else entirely — D1 carries `0` and
    its first row is genuine, editable data. A predicate of "has a
    `header_levels` key" is wrong and has caused a real defect.
28. **`payload.json` is frozen** outside a review phase: no value *and* no shape
    changes, because it is the revert parachute. `var DAC_SOURCE = 'dataverse'`
    is the switch; reverting is that one word, with no deploy.

---

## 6. Branches kept, and why

Every branch already merged to `main` was deleted (277 local). These remain:

| branch | head | why it is kept |
|---|---|---|
| `clcpa-312-f-row-total-wip` | `9519096` | **NOT FOR MERGE.** The parked Section F `rowTotal` work you resume. See §9. |
| `deploy-backup-2026-08-26-basemap-esri` | `8f5eb2f` | Carries the **only copy** of the pre-deploy snapshot for build `647646a28d`. Not in `main`. |
| `deploy-backup-2026-08-26-pointer-selection` | `cf55870` | Same, for build `a89ad80b8f`. |
| `deploy-backup-2026-08-27-clcpa-200` | `bd9181c` | Same, for build `483a20777d`. |
| `deploy-backup-2026-08-27-editor-strict-totals` | `19d3240` | Same, for build `97a7ebcfba`. |
| `feature-clcpa-114-how-the-map-is-built` | `a1516f7` | Holds `how-the-map-is-built.html`, which is **not in `main`**. PR #49 closed as stale (the Map Data UI it documents has been rebuilt), so this branch is the only copy. |
| `feature-clcpa-115-map-csv-upload` | `918964b` | PR #47 closed as superseded by the Map Data dataset upload flow. Kept for reference. |
| `clcpa-242-tooltip-wiring` | `a1720f4` | An unmerged `app.js` state plus five evidence files. Superseded by CLCPA-242's shipped rounds and CLCPA-247, but never ruled on. |
| `clcpa-144-hierarchy-derived` | `bf32238` | A different version of `CLCPA-144-item3-evidence.md` from the one in `main`. Needs a ruling on which is the record. |
| `add-coned-dac-dashboard-v2` | `5f6cbee` | A one-commit typo fix to the archived `Coned/Dac_Dashboard` V2 copy, never applied. Outside this folder's scope. |
| `feat-eap-tooltip` | `b18e645` | June 2026 EAP tooltip work on `app.js` and `styles.css`, never merged. |
| `feat-promote-dev-rendering-to-test` | `ba0f7a1` | A June promotion of `_dev` rendering into `_Test`. Historical. |
| `feat-sync-service-territories-geojson` | `87f432b` | Two commits touching `payload.json` in both `_dev` and `_Test`. **`payload.json` is frozen**, so this cannot be merged without a review-phase ruling. |
| `v1.0.21.14` (remote only) | `06be18b` | Holds the **only copy** of a Dataverse solution import package — `CLCPA/src/Other/Solution.xml` and the `cf_clcpa_dash_hybrid` web resource. A different deliverable from this folder. |
| `clcpa-integration-candidate` (remote only) | `71a914e` | **STANDING ORDER: do not touch, merge, cherry-pick or build against.** Another engineer's testing, outside this project's flow. `main` is the only truth. |

**Four of these branches are rollback records that exist nowhere else.** If they
are deleted, four pre-deploy snapshots are destroyed. They should be brought onto
`main` as records-only commits before anyone prunes branches again.

---

## 7. Portability findings and their disposition

Measured by copying this folder to a location **outside** the repository and
working only from inside the copy.

### Fixed in this handover

| finding | disposition |
|---|---|
| `Data/restore_map_tract_data.js` hardcoded an absolute path into `c:/Users/emely/Desktop/Projects/demos`, which resolves on one computer | **REWRITTEN** to `path.join(__dirname, 'backups', …)`, overridable with `DAC_MAP_EXPORT`. Verified: the export resolves at the relative path. |
| `data-sources.html` printed `# from Coned/CLCPA/ExecutiveDashboard_dev/` to the operator | **REWRITTEN** to "from the dashboard folder (the repository root once extracted)". |
| Three Python docstrings instruct `git show 1d4a5f9:Coned/CLCPA/ExecutiveDashboard_dev/app.js`, whose sha *and* path are `demos` coordinates | **ANNOTATED** at the point of use to fetch the legacy history first, pointing here. |
| **No `.gitattributes` anywhere**, yet 311 harness files anchor on CRLF and the convention was inherited from one machine's `core.autocrlf` | **ADDED** inside the folder. Measured: the repository stores **LF** (0 CRLF pairs, 27,142 lone LF in the stored `app.js`) and checkout converts. `text eol=crlf` matches that exactly, so there is no storage churn — confirmed, `git status` showed only the intended edits. **This was the largest day-one risk.** |

### Verified working from inside the copy, with no network and no repository

| | |
|---|---|
| `Data/stamp_build.js` | derives `670da36609 / 4993f5eee9` — the live pair |
| `node --check` on all six JS files | clean |
| `Data/check_hidden_guard.js` | exit 0 |
| `Data/check_no_file_served_map.js` | exit 0 |
| The Python builders' `HERE/Data` before `../Data` fallback | already handles a root-layout copy; **no change needed** |

### Found, measured, NOT yet fixed

These are the reason a fresh copy's sweep is **not** green today.

| finding | measured | disposition |
|---|---|---|
| **The folder contains no tests at all.** Every suite, mutation runner, gate, `_kit` helper and evidence file is outside it | 197 suites/gates/mutations, 107 evidence directories, 10 `_kit` files, 24 MB | **MOVE `tickets/` IN.** Not executed — see §8 |
| **194 harness files hardcode an absolute `Desktop/Projects/demos` path** | 194 files | **REWRITE** to a resolved root. Not executed |
| **261 harness files reference `Coned/CLCPA/ExecutiveDashboard_dev/…`** as a working-tree path | 261 files | **REWRITE** to a layout-independent resolver that walks up from `__dirname` until it finds `app.js` + `styles.css` — the same dual-layout trick the Python builders already use. Not executed |
| 98 harness files anchor on `git rev-parse --show-toplevel` | 98 files | Works in any repo; **no change needed** once the folder is a repo root |
| **Baselines are pinned to `demos` commit shas.** A subtree split rewrites shas, so every `git show <sha>:<path>` breaks in the new repo regardless of path fixes | ~197 suites | **Fetch the `demos` history into the new repo as a remote named `legacy`.** Then the original shas and the original paths resolve verbatim and no suite needs changing. This is why §8 keeps the legacy remote. |
| `deploy-backups/` is at the repository root, so the deploy script template source and 115 rollback snapshots do not travel | 176 MB, 32 archived scripts | **MOVE IN.** Not executed |
| `CLAUDE.md` is at the repository root | 12 KB | **COPY IN**, adapted for the new layout. Not executed |
| `Data/check_doc_claims.js` exits 1 | 4 findings, all about CSV upload wording and spreadsheet prose | **PRE-EXISTING, not portability.** Proven by running it on the tree before tonight's changes: same exit, same findings. Its own lane. |
| A CLCPA-221 render harness carries 9 failures | tooltip wording, a long dash in a null glyph, a Data Source label | **PRE-EXISTING.** Nine before tonight's work and nine after. Its AFTER side reads the working tree unpinned, which is the rot §5.13 warns about; re-pinning it is its own change. |

**No `package.json`, no lockfile, no `node_modules`, no git hooks, no CI
config** anywhere in the repository — so there are no dependency or pipeline
assumptions to carry. Node and Python 3 are the whole toolchain.

---

## 8. Extraction recipe

**Written, not executed.** Run it when you are ready to take the folder.

### 8.1 Before you split: bring the strays onto `main`

Four pre-deploy snapshots live only on unmerged branches (§6) and a subtree
split will not see them. Bring them in first, as records-only commits:

```bash
cd demos
git checkout main
for b in deploy-backup-2026-08-26-basemap-esri \
         deploy-backup-2026-08-26-pointer-selection \
         deploy-backup-2026-08-27-clcpa-200 \
         deploy-backup-2026-08-27-editor-strict-totals; do
  git merge --no-ff -m "deploy-backups: adopt the orphaned snapshot from $b" "$b"
done
git push origin main
```

Then move the four outside dependencies into the folder, so the split carries
them (this is the §7 work not yet executed):

```bash
git mv Coned/CLCPA/tickets                  Coned/CLCPA/ExecutiveDashboard_dev/tickets
git mv deploy-backups                        Coned/CLCPA/ExecutiveDashboard_dev/deploy-backups
git mv Coned/CLCPA/MIGRATION_READINESS.md    Coned/CLCPA/ExecutiveDashboard_dev/
git mv Coned/CLCPA/OPERATOR_SCRIPT_FACTS.md  Coned/CLCPA/ExecutiveDashboard_dev/
git mv Coned/CLCPA/HANDOFF_PACKAGE_VERIFICATION.md Coned/CLCPA/ExecutiveDashboard_dev/
mkdir -p Coned/CLCPA/ExecutiveDashboard_dev/handoff
git mv Coned/CLCPA/make_handoff_package.py   Coned/CLCPA/ExecutiveDashboard_dev/handoff/
git mv Coned/CLCPA/verify_handoff_package.py Coned/CLCPA/ExecutiveDashboard_dev/handoff/
git mv Coned/CLCPA/make_operator_guides.py   Coned/CLCPA/ExecutiveDashboard_dev/handoff/
git mv Coned/CLCPA/make_operator_notebooks.py Coned/CLCPA/ExecutiveDashboard_dev/handoff/
git mv Coned/CLCPA/operator-docs             Coned/CLCPA/ExecutiveDashboard_dev/handoff/
git mv Coned/CLCPA/operator-guides           Coned/CLCPA/ExecutiveDashboard_dev/handoff/
git mv Coned/CLCPA/operator-notebooks        Coned/CLCPA/ExecutiveDashboard_dev/handoff/
cp CLAUDE.md Coned/CLCPA/ExecutiveDashboard_dev/CLAUDE.md
git add -A && git commit -m "handover: move the dashboard's dependencies into its own folder"
```

`git mv` preserves history and `--follow` traces it, so nothing is lost.

### 8.2 Split the folder into a new repository, with history

```bash
cd demos
git subtree split --prefix=Coned/CLCPA/ExecutiveDashboard_dev -b dac-dashboard-extract
# -> a branch whose root is the folder, carrying only its history

mkdir ../dac-dashboard && cd ../dac-dashboard
git init -b main
git pull ../demos dac-dashboard-extract
```

`git filter-repo --path Coned/CLCPA/ExecutiveDashboard_dev --path-rename Coned/CLCPA/ExecutiveDashboard_dev/:`
is the equivalent and is faster on a repository this size; it rewrites shas the
same way, so §8.4 applies either way.

### 8.3 Carry the parked Section F work across

`clcpa-312-f-row-total-wip` is one commit, `9519096`, touching one file. Two
ways; do **both**, because the patch is the one that survives a sha rewrite.

```bash
# (a) export it as a patch series, from demos
cd demos
git format-patch --output-directory ../dac-dashboard/parked \
  main..clcpa-312-f-row-total-wip \
  -- Coned/CLCPA/ExecutiveDashboard_dev
# then, in the new repo, strip the leading path components when applying:
cd ../dac-dashboard
git checkout -b clcpa-312-f-row-total-wip
git am -p4 parked/0001-*.patch       # -p4 drops Coned/CLCPA/ExecutiveDashboard_dev/

# (b) or split that branch too, from demos
cd ../demos
git subtree split --prefix=Coned/CLCPA/ExecutiveDashboard_dev \
  clcpa-312-f-row-total-wip -b clcpa-312-extract
cd ../dac-dashboard
git fetch ../demos clcpa-312-extract:clcpa-312-f-row-total-wip
```

Keep it **NOT FOR MERGE** in the new repo too, and keep the reason with it.

### 8.4 Keep the legacy history reachable — do not skip this

Every acceptance baseline in ~197 suites is a **`demos` commit sha**, read with
`git show <sha>:Coned/CLCPA/ExecutiveDashboard_dev/<file>`. A split rewrites
shas, so those reads break in the new repo unless the original objects are
present. Make them present:

```bash
cd dac-dashboard
git remote add legacy ../demos          # or the demos remote URL
git fetch legacy '+refs/heads/*:refs/remotes/legacy/*' --no-tags
```

Now every pinned sha and every original path resolves verbatim, and **no suite
needs editing**. Verify with a baseline the suites actually use:

```bash
git show fcf4587:Coned/CLCPA/ExecutiveDashboard_dev/app.js | head -1
git show d880c0b:Coned/CLCPA/ExecutiveDashboard_dev/app.js | head -1
```

If you would rather not depend on a second repository, the alternative is to
convert each pinned baseline into a committed file snapshot under `tickets/`,
and that is a change to ~197 suites: cost it before choosing it.

### 8.5 What to set up on your machine

| | |
|---|---|
| **Node** | any recent LTS. No `package.json`, no install step. |
| **Python 3** | `python` and `python3` both resolve to 3.14 on the outgoing machine. No `requirements.txt`; the pipeline scripts state their own imports. |
| **git** | set `core.autocrlf=true`, or rely on the new `.gitattributes`, which makes the checkout CRLF regardless. **Confirm CRLF before running any suite.** |
| **Deploy credentials** | none to install. Auth is **device-code OAuth**: client `51f81489-12ee-4a9e-aaae-a2591f45987d`, tenant `organizations`, scope `<org>/.default offline_access`. It needs a human to sign in, so run deploy scripts in the background and surface the code. |
| **Org access** | a user with write access to the `CLCPADACDashboard` solution in `org9076e69b`. Privilege names are **schema**-cased (`prvCreatecr2bf_DACTractDataset`), so read them from metadata rather than composing them. |
| **`gh` CLI** | **not installed** on the outgoing machine. PRs were opened and merged through the REST API with the token from `git credential fill` (host `github.com`), which carries `repo` scope. Install `gh` if you prefer it. |

Dataverse API notes learned the hard way: use `$select=Privileges`, not
`$expand`; `MaxLength` needs cast segments
(`Attributes/Microsoft.Dynamics.CRM.StringAttributeMetadata`);
`solutioncomponents` filters on `componenttype` (1 = Entity, 2 = Attribute) and
needs `MetadataId` in `$select`; and **`EntityDefinitions` does not support
`startswith`** — it answers HTTP 501, so read the whole list and narrow it
locally. That one cost a device code.

### 8.6 First-day check

1. **CRLF**: `node -e "const s=require('fs').readFileSync('app.js','utf8');console.log((s.match(/\r\n/g)||[]).length)"` — must be ~27,142, not 0.
2. **Byte identity with the org**: `node -e "console.log(require('./Data/stamp_build.js').prepare('./').ids)"` — must print `670da36609` / `4993f5eee9`.
3. **Sweep green**: run §3's loop. Expect the five ledgers red until you declare any change you have made.
4. **The app runs**: `python -m http.server 8000`, open `ExecutiveDashboard.html`, and read the console stamp.
5. **Hosted**: hard refresh the Power Apps page and confirm the console prints
   `[DAC dashboard] build 670da36609`. **Server-verified is not
   client-running** — always match the printed id.
6. **One org read in dry run**: `DAC_DRY_RUN=1 node tickets/org-reads-evidence/phase1_2098_2099.js`
   — proves the offline half, requests no device code, reads nothing.

---

## 9. Work in flight

### 9.1 Parked: CLCPA-312, Section F row totals

Branch `clcpa-312-f-row-total-wip`, head `9519096`, **NOT FOR MERGE**. One
commit, one file, a ~195-line change adding a `rowTotal` rule type to the
derive engine. It was parked unfinished with two self-caught defects
outstanding. Resume by reading the branch's own commit message first, then the
derive engine: `DERIVED_COLS` / `DERIVED_ROWS`, `applyDerivedCols`,
`applyDerivedRows`, `rowsForDisplay`, `recomputeTotals`.

### 9.2 Open design question: CLCPA-322 descriptors

Ruled: register a computed rule **only** on the total rows (J1 row 1 and J2 row
1). Do **not** register one on the average rows — leave those preparer-filed and
let the kept-figure advisory name the divergence. The string-vs-number case (J1
holds strings, J2 holds numbers) is orthogonal: `bareNumber` semantics decide
how each stored cell is read on the rows you *do* register. **Do not touch the
stored data.** J3 through J9 are unaffected and their value identity per stored
year should be stated when the work is done.

### 9.3 The gated freeze-lift set

**CLCPA-295, 321, 323, 330 are GATED to the freeze-lift pass. Do not touch them.**

The freeze rule: `payload.json` has its own freeze independent of the code — **no
value and no shape changes outside a review phase**, because it is the revert
parachute. Presentation dates also put hard freezes on the app itself. A commit
during a freeze needs an explicit go, exactly like a deploy.

### 9.4 CLCPA-335 regression findings, RC-01 to RC-12

From the full regression circuit on test year 2099, build `4206a149a9`. Status
as of 2026-09-21.

| | finding | severity | status |
|---|---|---|---|
| **RC-01** | Test year 2098 survived an earlier cleanup and was offered in every year selector | Blocking | **CLOSED.** Tonight's cleanup removed 2098 and 2099 from every store. Backup `6928905`. Confirm with a hard refresh. |
| **RC-02** | A derivable G `County Total` accepts a filed figure with **no advisory, no change count and no history entry**, and the published Section G percentages and both charts then report roughly half the true DAC share | **Blocking** | **OPEN.** The highest-value fix outstanding. Treat `County Total` as a total-row label wherever `Grand Total` and `Systemwide Total` are, and route G's totals through the same filed-total path as A1 (refuse and name) or B2 (keep, name, reconcile, count, log). The audit-trail half should be fixed regardless. |
| **RC-03** | Total rows rendered as open inputs never recompute; A7's grand total double-counts a stale subtotal | High | **OPEN.** A3, A4, A7, B1, E1. A5/A6 have the same shape and compute correctly, so this is per-table, not structural. |
| **RC-04** | One manual edit strips `%` formatting from every percentage row in the table | High | **OPEN.** D2/D3/D4. The edit-path renderer is missing the format step the import path applies. |
| **RC-05** | "The figures in your file were used" when they were not; stale reconciliation figures; a stored filed value with no history entry | High | **OPEN.** B2. |
| **RC-06** | The result box and the confirm dialog count the same import differently | Medium | **OPEN.** Wording, not data. |
| **RC-07** | A chart pill and a composed table cell floor a tiny nonzero share to `0%` while the table beside them says `<0.1%` | Medium | **OPEN.** Sections A and C. Apply the same floor in `bar-value-sub` and the C2 composer. |
| **RC-08** | Section A's ranked-bar chart shows the DAC movement beside a Total bar, and prints `100% DAC` for every row in the DAC view | Medium | **OPEN.** The tooltip is correct, so the data is right and only the at-a-glance row is wrong. |
| **RC-09** | Composed `value (pct%)` source cells published unchanged, including a misleading `(0%)` for a 0.38% share | Low / owner-side | **OPEN.** Either normalise the source data or have the app recompute the parenthetical. |
| **RC-10** | Values filed into D's calculated percentage rows are discarded silently and counted as imported | Medium | **OPEN.** Route D's calculated rows through the same "Not imported" path A1 uses. |
| **RC-11** | A bare percentage in a free-text column is coerced to a number (`10%` stored as `0.1`) | Medium | **OPEN.** Sections C, D. |
| **RC-12** | The card sub-line counts schema slots, not columns | Low | **OPEN.** Presentation only; the schema is stored with null gaps and the import maps correctly into them. |

**Two blockers were named for the production pass. RC-01 is closed. RC-02 is
open and is the one to fix first.**

### 9.5 Also open

- **Nothing can CREATE a map overlay correction**, and a console line reads as
  broken (from CLCPA-191).
- **`payload.json`'s stored totals disagree with their own rows**: A5:2025 grand
  total stores 27,833 against 27,834 from its parts; A3:2025 is off by 31.
  Invisible on stored data, visible the moment a year is imported fresh.
  Disclosed and **not fixed** under the freeze; pinned in `suite_240a`.
- **`map_payload.json` is not fully reproducible** from its own pipeline
  (`City_Town`, neighborhood, `electric_networks` diverge). Only the
  `elec_dac`/`gas_dac` rename was adopted.
- **Tract geometry is the next performance lever** on the ~1,271 ms boot, but it
  needs *topology-preserving* simplification. Cost is **vertices, not decimal
  places** — territory geometry shipped 14.6x smaller that way.
- **Runtime third-party tiles are the one component no freeze or harness
  governs.** CARTO watermarked the basemap mid-presentation with an HTTP 200;
  both builds were swapped to Esri.

---

## 10. Reference documents

| | |
|---|---|
| `MIGRATION_READINESS.md` | measured facts about the Dataverse org: inventory, dead weight, security roles, open questions. Everything read from the org, dated, and marked MISSING where it could not be read. |
| `HANDOFF_PACKAGE_VERIFICATION.md` | evidence the Con Edison handoff zip is self-sufficient. |
| `OPERATOR_SCRIPT_FACTS.md`, `operator-docs/` | operator-facing documentation. |
| `tickets/*.md` | per-ticket findings and close comments beside their evidence directories. |
| `tickets/CLCPA-224-residue-2098-2099.md` | the residue list tonight's cleanup closed. |
| `SESSION_LOG.md` (in `demos`) | **stale**; newest entry 2026-07-10. Do not treat it as current state. |

Repo `.md` files are **frozen evidence**: they describe a build at a date.
Correct a wrong figure in a PR description and say so; leave merged commit
messages as they stand. Merged history is never rewritten.

Seven pipeline scripts plus three operator guides ship to Con Edison as a
handoff zip, assembled by `make_handoff_package.py` and checked by
`verify_handoff_package.py`, which unpacks the zip **outside the repository** and
runs each guide's own commands against it. **If you change a script's location
or interface, the guides and that verifier must move with it** — they went out
of sync for ten days once.
