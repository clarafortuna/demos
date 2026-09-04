# Handoff package — verification

Evidence that `coned-dac-dashboard-data-tools.zip` is self-sufficient and that
the commands its guides give an operator actually run.

Built by `Coned/CLCPA/make_handoff_package.py`. Checked by
`Coned/CLCPA/verify_handoff_package.py`, which unpacks the zip to a temp
directory outside this repository and runs each guide's own commands against it.

**Re-verified 2026-09-04 (CLCPA-219) against current `main`.** The previous
version of this document described the August package and had been wrong for
roughly ten days: the package changed on 2026-08-26 and this record did not.
What it claimed, and what is true now:

| that record said | actually |
|---|---|
| 6,769,464 bytes | **5,782,222** |
| 15 client-data files | **14** |
| `map_payload.json` ships | it does not, and must not |
| `app.js` ships | it does not |
| commands are `python Data/<script>.py` | `python <script>.py` — see F3 below |

## The package

| | |
|---|---|
| zip | **5,782,222 bytes** (5.8 MB) |
| **sha256** | **`997ab8b94dd465d24a2f6d479ab3ee14569d8c22c62cdd09e5d0dce36ba4a374`** |
| entries / files | 35 / 31 |
| scripts | 7 (five run, two imported) |
| guides | 3 |
| client-data files | 14, listed under their own heading in `MANIFEST.txt` |
| `Data/out/` | ships **empty** |
| built from | `main` at the commit that carries this file |

## The zip is now reproducible, and was not before

Two runs of `make_handoff_package.py` a minute apart used to differ by exactly
**16 bytes**: four files are generated at build time — `MANIFEST.txt`,
`README.txt`, `requirements.txt`, `Data/out/.keep` — so their mtime was "now",
and four entries × two header copies × the two-byte DOS *time* field is 16. The
date matched, being the same day. **No entry's content differed**; every CRC and
compressed size was equal.

The invisible half of that bug mattered more. The other 31 entries carried the
**working copy's** mtimes, which in one checkout spanned 1 June to 24 August. A
fresh `git clone` stamps checkout time on all of them, so the same commit
packaged on a different machine produced a completely different zip — meaning
the sha256 recorded here was never checkable by anyone but the machine that
built it.

`make_handoff_package.py` now pins every entry to the zip epoch (1980-01-01) and
sets `external_attr` explicitly, so the archive depends on neither the clock nor
the host filesystem. Nothing is lost: per-file provenance is the sha256 list in
`MANIFEST.txt`, and the commit is the build's identity.

Proven three ways:

```
two consecutive runs                     997ab8b94dd465d2...  identical
a third run from a simulated fresh clone 997ab8b94dd465d2...  identical
  (all 82 source files re-stamped with today's mtimes)
```

## F3 — every command in all three guides failed. Fixed.

The restructure moved the seven scripts from `Data/` to the package root.
`README.txt` was updated. **The three guides were not.** Every command in all
three read `python Data/<script>.py`, and in the shipped package that is nothing:

```
python Data/convert_nyserda_raw.py --version 1.0 --geoid-vintage 2010 --raw-date 2023-03-27
  -> can't open file '...\coned-dac-dashboard-data-tools\Data\convert_nyserda_raw.py':
     [Errno 2] No such file or directory
```

An operator following the documented procedure failed on the **first command of
every guide**, while `README.txt` two directories away said the opposite: *"The
scripts are here at the top level… Run them from THIS folder, not from inside
`Data/`."* The package contradicted itself.

Eight occurrences across three guides, five distinct scripts, all corrected to
the package-root form. Input paths (`Data/NYS_DAC.geojson`) and output paths
(`Data/out/…`) were already right and are untouched. The guides' working-directory
instruction — "from the folder that contains `Data/`" — was also already right.

Nothing caught this for ten days because nothing connected a command written in a
guide to the package that guide ships inside. That gap is now closed by
`verify_handoff_package.py`, which **extracts the commands from the guides rather
than listing them**, so a path that drifts again fails the check. Confirmed to
fail on the defect: replaying the pre-fix guides into a zip turns all eight
`resolves` checks red and exits non-zero.

## What `verify_handoff_package.py` checks

```
STRUCTURE   the zip unpacks; requirements.txt, README.txt and MANIFEST.txt are
            present; three guides present; Data/out/ ships empty; nothing from
            MUST_NOT_SHIP leaked; and the verifier's exclusion list is
            cross-checked against the packager's so the two cannot drift.
RESOLVES    every `python <script>` in every guide names a file that exists at
            the path the guide gives. This is the F3 guard.
IMPORTABLE  each shipped script is imported as a module inside the package,
            proving it parses and that every module it imports ships with it.
SAFE MODE   the guide's own command, run with its no-write flag.
```

Two calibrations worth recording, because the obvious choices were wrong:

- **`--help` is not a usable probe here.** `update_map_data.py` has a hand-rolled
  parser that refuses it outright ("unknown argument '--help'") and
  `build_pure_geometry_dataset.py` prints usage and exits 1. Importing each
  script tests the same property — the file parses, its dependencies ship — and
  works across all of them.
- **`--no-fetch` must not be added to `--dry-run`.** `update_map_data` rejects the
  pair: *"Drop --no-fetch, or run the builder directly and accept that nothing
  checks the coupling for you."* `--dry-run` alone is already offline and says so:
  *"Nothing was written and no socket was opened."*

## What is deliberately not checked here

- **The dataset builds.** `build_pure_geometry_dataset.py`,
  `build_coned_dataset.py` and `_make_territories.py` have no no-write mode, and
  `--refresh-territories` needs the network. Those are the operator simulation's
  business, not a fast guard's.
- **Guide 1's command in isolation.** `convert_nyserda_raw.py` reads
  `Data/out/tract_geometry_pure-<vintage>.json`, which guide 2 produces.
  `Data/out/` ships empty on purpose, so guide 1 genuinely cannot run until guide
  2 really has. That ordering is the package's design — shipping a prebuilt
  geometry would let an operator run guide 1 and never learn the two are ordered.
- **The upload.** The package contains nothing that contacts the dashboard. Every
  guide ends at a built file; the upload is a manual step.
- **A machine with no Python.** `requirements.txt` covers third-party packages
  only.

## The pipeline, run end to end from the package alone

All three guides run in their documented order inside a freshly unpacked
package, using only the venv built from its own `requirements.txt`. Every
command exited 0.

| output | bytes | sha256 | vs repo |
|---|---|---|---|
| `tract_geometry_pure-2010.json` | 1,587,328 | `6e9f09f7414f59ed…` | identical |
| `tract_geometry_pure-2020.json` | 1,285,052 | `d288460f7907a79e…` | identical |
| `coned_operational_v1_0-2010.json` | 176,215 | `b9e7a4d6e971b2b3…` | identical |
| `service_territories.geojson` | 239,162 | `a45ae7f05d4aac95…` | identical |
| `nyserda_dac_v1_0.json` | 1,181,466 | `6df6a4d8378390c6…` | +129 B, expected |

The 2010 geometry reproduces **August's clean-room hash exactly**, across a
month and a substantial amount of churn in the builders. The territory overlay
differs from August (`5ec5d04a57dcf8af` then, `a45ae7f05d4aac95` now) because it
was rebuilt by the simplification work since; it matches the committed copy,
which is the property that matters.

### F7 — RESOLVED for the repository half

August recorded `tract_geometry_pure-2020.json` as stale: 87 bytes short and
missing `sourceFingerprint`. It is neither now. A clean build reproduces the
committed file **byte for byte**, and the committed file carries
`sourceFingerprint 682970681ce906812e89066841e50f0611c447b4` under `dataset` —
the same stamp the territory overlay reports. Whatever fixed it was not recorded
against the finding, but the finding is closed.

### F7 — RESOLVED for the published half too

Read from Dataverse on 2026-09-04, read-only, GET only. Nine rows in
`cr2bf_dactractdatasets`, five of them `tract_geometry`, two active — one per
vintage, which is the documented design ("several vintages are published at once").

Both active geometry datasets are **stamped**, and both are **byte-identical to a
clean build from the handoff package**:

| active row | bytes | sha256 | vs clean build |
|---|---|---|---|
| `tract_geometry` vintage 2010 | 1,587,328 | `6e9f09f7414f59ed…` | identical |
| `tract_geometry` vintage 2020 | 1,285,052 | `d288460f7907a79e…` | identical |

Both carry
`sourceFingerprint 682970681ce906812e89066841e50f0611c447b4de8e7a0e82532c4a966ba599`,
which is exactly the repository value. **The August concern that the published
2020 geometry was unstamped and unverified is closed on both counts.**

That is also the strongest end-to-end result this ticket produced: the handoff
package, run by its own guides in a clean room, reproduces byte for byte what is
actually published and drawing on the map.

One false alarm, mine: the probe's first report said the published fingerprint
DIFFERED from the repository's. It did not. My expected constant held the first
40 characters of the hash, because an earlier check had printed the repo value
through a `[:40]` slice and I copied the truncation into the probe. The lesson is
the dull one -- compare whole hashes or do not compare -- and it is now recorded
in the probe itself.

Incidentally confirmed by the same read, and useful for CLCPA-220: the active
`service_territories` row stores its GEOID vintage as **null**. The data model
already treats a territory overlay as vintage-less, so the upload form asking
for one is a form-level defect and nothing deeper.
### The +129 bytes: August's explanation was right, my first check was not

`nyserda_dac_v1_0.json` differs from the committed copy by 129 bytes, which
August attributed to a longer source label. A first pass here compared
top-level scalars, found no `sourceLabel` there, and wrongly reported the
explanation as not holding. `sourceLabel` is nested under `dataset`. A full
leaf-by-leaf walk finds **exactly one** difference in the whole file:

```
clean-room (228 chars): NYSERDA / NYS Climate Justice Working Group, Final
  Disadvantaged Communities criteria. Converted from the raw release file
  NYS_DAC.geojson (dated 2023-03-27) by Data/convert_nyserda_raw.py, scoped to
  the six Con Edison counties.
repo (99 chars): NYSERDA / NYS Climate Justice Working Group, Final
  Disadvantaged Communities criteria, 2023 release
```

228 − 99 = 129. Tract count, every field and all other metadata are equal.

Worth noting where that label ends up: it contains **`Data/convert_nyserda_raw.py`**,
the stale path from the open finding above. That string is stored in the dataset
and shown as its source, so the stale path is not confined to console output —
it would be published into Dataverse and displayed.

### The app's own upload validation accepts all five outputs

The four validators the dashboard gates uploads on were lifted from `app.js`
(9 functions and 9 constants, resolved transitively) and run against the
clean-room outputs:

```
ACCEPTED  nyserda_dac_v1_0.json              [dsValidateDoc]
ACCEPTED  tract_geometry_pure-2010.json      [dsValidateGeometryDoc]
ACCEPTED  tract_geometry_pure-2020.json      [dsValidateGeometryDoc]
ACCEPTED  coned_operational_v1_0-2010.json   [dsValidateConedDoc]
ACCEPTED  service_territories.geojson        [dsValidateTerritoryDoc]
```

One warning, from the app and not from the harness: the territory overlay
reports that *"this record declares GEOID vintage 2010, which means nothing for
a territory overlay: it carries no GEOIDs and pairs with no dataset"*. Guide 2
says "Upload the territory overlay" without saying which vintage to choose, and
the upload form requires one, so every operator picks arbitrarily and every
choice produces this warning. Small, and docs-side.

## Open findings, not fixed here

- **Stale `python Data/<script>.py` inside the shipped scripts' own docstrings and
  printed usage strings** — 23 occurrences across six of the seven. Seven are
  printed at runtime, so an operator who triggers a usage message is told the
  wrong path. Not fixed as documentation, because these scripts live at `Data/`
  **in this repository**, where `python Data/x.py` is correct: a blanket rewrite
  would break the repo-context instructions instead. Doing it properly means
  deriving the invocation path at runtime, which is a code change.
- **`_make_territories.py` has no `if __name__ == "__main__"` guard.** Its whole
  body runs on import, including opening the output file for writing and fetching
  a NADCON grid. It is only ever run, never imported, so nothing is broken — but
  an earlier version of the verifier's import probe was stopped from doing real
  work only by argparse rejecting its argv. The two scripts that *are* imported
  both have the guard, and the verifier now asserts that.
- **Windows `MAX_PATH` — ADDRESSED.** The longest path inside the package is 116
  characters
  (`Data/2010_Census_Tract_to_Neighborhood_Tabulation_Area_Equivalency_table_20260806.csv`),
  so an unpack root beyond roughly 144 characters fails with `WinError 3`, which
  names no file and reads like a corrupt download. This bit the verification run
  itself when an output directory name grew by two characters. `README.txt` now
  carries a "WHERE TO UNPACK IT" section with the symptom and the limit, and the
  verifier reports the longest internal path and its headroom on every run, so a
  newly added long filename is caught here rather than by an operator.

## The `map_payload.json` divergence: verified, and NOT moot

Recorded previously as possibly resolved because "map_payload.json was deleted at
`d9cf45b`". Checked, and that reading was wrong twice over:

1. **`d9cf45b` changed one file: `MIGRATION_READINESS.md`.** It recorded that the
   *deployed web resource* had been deleted from Dataverse. The repository file
   `ExecutiveDashboard_dev/map_payload.json` still exists, all 4,794,147 bytes.
2. **The divergence was preserved, not resolved.** It is now recorded permanently
   in `Data/tract_universe.json`'s own provenance block:

   > `derivedFrom: map_payload.json`, `derivedFromSha256: af2aa5cb…`
   > "City_Town is COPIED, not rebuilt. Re-running the payload pipeline returns
   > City_Town as null on the 1,274 Non-DAC tracts, because the values are copied
   > there from a DAC-only source; the live values are a county fill that exists
   > in no committed script, and 116 Westchester neighborhood names derive from
   > them."

So the pipeline still cannot reproduce `City_Town` for the Non-DAC tracts, and
116 Westchester neighborhood names depend on values no committed script can
regenerate. What changed is that the un-reproducible part is now frozen in a
71 KB file with its provenance stated, instead of being re-derived from a 4.8 MB
customer-data file — which is why the package no longer ships that file.

`app.js` does not read `map_payload.json`: all sixteen mentions are prose saying
so. No shipped script reads it in any operator flow —
`build_tract_dataset.py`'s read is inside `main()`, and it is only ever imported;
`build_pure_geometry_dataset.py`'s is behind `--artifact`, which refuses cleanly
and is now marked "not in this package" in guide 2.

## Carried into the operator simulation

The August record flagged repository `tract_geometry_pure-2020.json` as **stale** —
87 bytes smaller than a clean build, missing `sourceFingerprint` — and noted the
published 2020 geometry in Dataverse is *also* unstamped and unverified, "worth
folding into the queue". It appears not to have been. To be verified against
current `main` in the orchestrator phase rather than repeated here.
