# Handoff package — clean-room verification

Evidence that `coned-dac-dashboard-data-tools.zip` is self-sufficient. Not
asserted: the zip was unpacked in a directory outside this repository and every
command in the three operator guides was run against it.

Built by `Coned/CLCPA/make_handoff_package.py`, which is committed so the package
is reproducible rather than hand-assembled.

## The package

| | |
|---|---|
| zip | **6,769,464 bytes** (6.8 MB) |
| files | 31 |
| scripts | **7** (see below — the brief named 5) |
| guides | 3 |
| `Data/out/` | ships **empty** |

## Two scripts the brief did not name, and why they ship

Five scripts were requested. Seven are required, because two are imported rather
than run, and a package without them fails on the first command:

| runs | imports | why |
|---|---|---|
| `convert_nyserda_raw.py` | `build_tract_dataset.py` | that is where the indicator catalogue is parsed out of `app.js` |
| `build_coned_dataset.py` | `build_base_map_payload.py` | that is where the spreadsheet reader lives; the ConEd builder imports it rather than reimplementing the header matching |

Both are import-safe — each has an `if __name__ == "__main__"` guard — so
importing one does not run it.

## `Data/out/` ships empty, on purpose

Everything in it is an output, **including the tract geometry that the other two
builders read as their tract universe**. So the package's own first command
produces it.

Shipping a prebuilt copy would let an operator run guide 1 successfully without
ever running guide 2, and never discover that the two are ordered — until the day
the prebuilt file was stale.

## The clean-room run

Unpacked to `C:\cleanroom-coned-…\coned-dac-dashboard-data-tools`, outside the
repository. Run twice: once on the system interpreter, then again after wiping
every output and installing `requirements.txt` into a fresh virtual environment
inside the package, using **only** that interpreter.

The second run is the one that proves `requirements.txt` is complete. The first
alone would only have proven the *files* were sufficient, since the machine
already had the packages installed.

```
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
  -> openpyxl 3.1.5, pyproj 3.7.2, pyshp 3.1.6, shapely 2.1.2
```

### Guide 2 — `python Data/update_map_data.py --vintage 2010`

```
  dataset output             WILL WRITE     Data/out/tract_geometry_pure-2010.json
  territory overlay          WILL BUILD     Data/service_territories.geojson

TERRITORIES  (subprocess; this step needs the network)
  reason: missing
  overlay stamped 682970681ce90681, matching the shapefiles.

DATASET READY
  bytes   : 1587328 (1.59 MB)
  sha256  : 6e9f09f7414f59ed4381b59d0d66bb6baa24f5c162182934b4f9c7d756413f49
```

Built the territory overlay from nothing, and the geometry, with the stamps
agreeing.

### Guide 1 — `python Data/convert_nyserda_raw.py --version 1.0 --geoid-vintage 2010 --raw-date 2023-03-27`

```
raw features    : 1736 statewide -> 1059 in the six counties
tracts written  : 2333  (1059 DAC + 1274 Non-DAC roster)
KeyChecksum     : 711efa5bca09019e5e72e225bca8c3535fbd0da8a8a49913f373c7884bc406c8
bytes           : 1181466 (1.18 MB)
```

Consumed the geometry guide 2 had just produced, from an empty `out/`.

### Guide 3 — `python Data/build_coned_dataset.py --vintage 2010`

```
  universe   : 2333 tracts, from Data\out\tract_geometry_pure-2010.json
  output     : Data\out\coned_operational_v1_0-2010.json (176215 bytes)
```

Both `--vintage 2020` paths were run as well.

## Outputs compared against this repository

| file | result |
|---|---|
| `tract_geometry_pure-2010.json` | **identical** — `6e9f09f7414f59ed` |
| `coned_operational_v1_0-2010.json` | **identical** — `b9e7a4d6e971b2b3` |
| `coned_operational_v1_0-2020.json` | **identical** — `772ab8a78ffedba3` |
| `service_territories.geojson` | **identical** — `5ec5d04a57dcf8af` |
| `tract_geometry_pure-2020.json` | **differs by 87 bytes** — see below |
| `nyserda_dac_v1_0.json` | expected 129-byte difference from the uploaded copy (the longer source label), as documented in guide 1 |

### The 2020 difference is a finding about this repo, not the package

The clean-room 2020 build is **87 bytes larger**, and the difference is exactly
one added key:

```
dataset keys only in CLEAN : ['sourceFingerprint']
tracts list equal          : True
every field column equal   : True
geometry equal             : True
```

Slice 6c only rebuilt the 2010 geometry, so the committed `pure-2020` predates
the fingerprint stamping. **The clean-room output is the correct current-generation
file; the repo copy is stale.** Worth folding into the queue — the published 2020
geometry in Dataverse is also unstamped and also unverified.

## What could not be tested here

- **Uploading.** The package deliberately contains nothing that contacts the
  dashboard. Every guide ends at a built file, and the upload is a manual step.
- **A machine with no Python.** The package assumes Python is installed;
  `requirements.txt` covers only the third-party packages.

## Con Edison internal data in the package

Fifteen files, listed under their own heading in `MANIFEST.txt` so nobody
forwards the package by accident:

- `map_payload.json` — per-tract account counts and EAP enrolment
- `Data/Electric.xlsx`, `Data/Gas.xlsx` — the same figures at source
- `Data/Extra_info/CECONY_*`, `ORU_Territory.*` — network and territory geometry
  (four parts each: `.shp`, `.shx`, `.dbf`, `.prj`)

`app.js` is the deployed dashboard — Con Edison's own application, not third-party
material.

**Nothing was included that a script does not actually read.** The `.cpg`, `.sbn`
and `.sbx` shapefile sidecars present in the repository are not packaged, and
`hvi_zcta_2020.geojson` is not packaged, because nothing in these five workflows
opens them.

## One documentation fix this run produced

Guide 2's preflight table did not list **`WILL WRITE`** — the status shown when
no output exists yet, which is exactly what a first-time operator sees. Added.
It only appeared because the clean room started with an empty `out/`, which is
the case the repo can never show.
