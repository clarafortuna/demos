# Operator script facts — source material for the Con Edison documentation

Written for whoever writes the operator-facing documentation. **This is not the
document to hand to Con Edison** — it is the verified fact base to write it from.
Every command, output block and byte count below was produced by running the
scripts, not from memory, and both builders reproduced their committed outputs
byte-identically at the time of writing.

Two decisions are still open and are marked **OPEN** where they appear. The docs
cannot claim a fully reproducible path until they are answered.

---

## 0. One naming correction, first

The current geometry builder is **`build_pure_geometry_dataset.py`**.

`build_geometry_dataset.py` also exists. It is the **older hybrid**, still carries
**9** properties including `hvi`, and is kept as the rollback. An operator
following a document that names it will build the wrong file, and the app will
refuse it on the field-count check.

---

## 1. `convert_nyserda_raw.py` — NYSERDA release to indicator dataset

Run from `ExecutiveDashboard_dev/`, the folder that contains `Data/`.

```
python Data/convert_nyserda_raw.py --version 1.0 --geoid-vintage 2010 --raw-date 2023-03-27
```

### Arguments

| argument | required | notes |
|---|---|---|
| `--version` | **yes** | version label, e.g. `1.0`. Also names the output file. |
| `--geoid-vintage` | **yes** | `2010` or `2020` only. Anything else is rejected. |
| `--raw-date` | no, but **always pass it** | `YYYY-MM-DD`, written into the source label. Omitted, it falls back to the raw file's modification date and says so on stdout. That is a checkout date, not a release date. |
| `--raw PATH` | no | default `Data/NYS_DAC.geojson` |
| `--universe PATH` | no | default `Data/out/tract_geometry_pure-<vintage>.json` |
| `--source-label TEXT` | no | replaces the generated label. Still capped at 254 characters. |
| `--verify-against FILE` | no | compares the built bytes against an existing dataset file |
| `--no-write` | no | build and check without writing the output |

### What the input is, and where it comes from

`Data/NYS_DAC.geojson` — NY Department of State Geographic Information Gateway:

```
https://opdgig.dos.ny.gov/datasets/2579112b69b04b4c9a09f4cf013983dc
```

Export as **GeoJSON** and save with that exact filename. The file is **statewide
and DAC-only**: 1,736 features, every one of them a designated DAC. It contains
no Non-DAC rows at all, which is why the script has to build the Non-DAC roster
itself.

The DAC criteria were finalised by the NYS Climate Justice Working Group on
**2023-03-27**, which is the `--raw-date` in the example above.

### What a successful run prints

Verbatim, paths shortened:

```
==================================================================
NYSERDA RAW -> DATASET
==================================================================
raw file        : ...\Data\NYS_DAC.geojson
raw dated       : 2023-03-27
universe        : ...\Data\out\tract_geometry_pure-2010.json
------------------------------------------------------------------
raw features    : 1736 statewide -> 1059 in the six counties
tracts written  : 2333  (1059 DAC + 1274 Non-DAC roster)
fields          : 56
discarded       : OBJECTID, Shape__Area, Shape__Length
carried by raw, not by the dataset:
                  HH_Low_Cnt, NYC_Region, REDC, Trib_Desig, Urb_Rural
------------------------------------------------------------------
version         : 1.0   vintage: 2010
sourceLabel     : 228 chars (max 254)
KeyChecksum     : 711efa5bca09019e5e72e225bca8c3535fbd0da8a8a49913f373c7884bc406c8
bytes           : 1181466 (1.18 MB)
------------------------------------------------------------------
written         : ...\Data\out\nyserda_dac_v1_0.json
==================================================================
```

**The extras report is those two lines in the middle.** `discarded` is the three
ArcGIS export artefacts, dropped on purpose. `carried by raw, not by the
dataset` is five real NYSERDA columns the dashboard does not use.

If a future NYSERDA release adds or removes a column, an extra paragraph appears
beginning `NOTE:`, saying the list no longer matches what was recorded when the
script was written. **That NOTE is a decision point** — somebody has to decide
whether the dashboard should carry the new column — **not a warning to pass
over.**

### Where the output lands

`Data/out/nyserda_dac_v<version, dots replaced by underscores>.json`

`--version 1.0` produces `Data/out/nyserda_dac_v1_0.json`.

### One number that will otherwise cause a false alarm

A fresh run produces **1,181,466 bytes**. The v1.0 file currently uploaded to
Dataverse is **1,181,337 bytes**. The 129-byte difference is entirely the longer
source label (228 characters against 99) — every tract value is identical. An
operator comparing file sizes should not conclude something is broken.

---

## 2. `build_pure_geometry_dataset.py` — tract geometry, 8 properties

Run from `ExecutiveDashboard_dev/`. **Both vintages, every time** (see gotcha 3):

```
python Data/build_pure_geometry_dataset.py --vintage 2010 --artifact
python Data/build_pure_geometry_dataset.py --vintage 2020
```

`--artifact` additionally writes the 2010 change document
(`Data/out/GEOMETRY_VINTAGE_CHANGE_2010.md` and `.json`). It applies to the 2010
build only.

### Inputs

| file | size | source |
|---|---|---|
| `Data/ny_tracts.geojson` | 1,437,222 | U.S. Census 2020 cartographic boundary file `cb_2020_36_tract_500k` (state 36 = NY), converted to GeoJSON. **Read for `--vintage 2020`.** Property used: `GEOID` |
| `Data/ny_tracts_2010.geojson` | 1,547,127 | same Census series, 2010 vintage. **Read for `--vintage 2010`.** Property used: `GEO_ID` |
| `Data/2020_Census_Tracts_to_2020_NTAs_and_CDTAs_Equivalency_20260601.csv` | 399,937 | NYC Department of City Planning, via NYC Open Data. **OPEN: the dataset ID is not recorded anywhere in the repository.** |
| `Data/2010_Census_Tract_to_Neighborhood_Tabulation_Area_Equivalency_table_20260806.csv` | 142,319 | NYC DCP, NYC Open Data dataset **`8ius-dhrr`**, "2010 Census Tract to Neighborhood Tabulation Area Equivalency table", 2,168 rows, published 2015-02-18 |
| `Data/Extra_info/CECONY_Electric.shp` + `.shx` `.dbf` `.prj` | 1.8 MB | **Con Edison supplied, not public.** Attribute used: `NETWORK` |
| `Data/Extra_info/CECONY_Gas.shp` + `.shx` `.dbf` `.prj` | 1.5 MB | **Con Edison supplied, not public.** Attribute used: `BORONAME` |
| `map_payload.json` | 4,954,060 | **in the folder above `Data/`.** Supplies the 2,333-GEOID universe; the builder does not decide scope on its own |
| `Data/service_territories.geojson` | 3,484,369 | optional. Only read for the staleness check in gotcha 2 |

Census landing page:
`https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.2020.html`

**OPEN:** no script in the repository converts the Census shapefiles into the
GeoJSON these builds expect. It was done by hand. Until that step is written
down, the documented path is not reproducible from the Census download alone.

### What a successful run prints

2010, verbatim (progress lines omitted):

```
recomputing spatial properties for 2333 tracts in NAD83 / New York Long Island (ftUS) ...
==================================================================
PURE 2010 GEOMETRY DATASET BUILT
==================================================================
file            : ...\Data\out\tract_geometry_pure-2010.json
bytes           : 1587241 (1.59 MB)
tracts          : 2333
properties      : 8
neighborhood    : 2333 named, 0 unnamed
names resolved  : 2010-table=129, 2020-table=1987, City_Town=217
spatial props   : recomputed in NAD83 / New York Long Island (ftUS)
------------------------------------------------------------------
Paste these into the Dataverse record:
  cr2bf_DatasetName    : Census tract geometry, 2010
  cr2bf_DatasetKey     : tract_geometry
  cr2bf_VersionLabel   : pure-2010
  cr2bf_GeoidVintage   : 2010
  cr2bf_TractCount     : 2333
  cr2bf_FieldCount     : 8
  cr2bf_KeyChecksum    : 711efa5bca09019e5e72e225bca8c3535fbd0da8a8a49913f373c7884bc406c8
  cr2bf_ManifestVersion: 1
  cr2bf_IsActive       : Yes  (published; uploading retires the previous 2010 set)
==================================================================
```

2020 differs only in these values:

```
bytes           : 1284965 (1.28 MB)
tracts          : 2183
neighborhood    : 2183 named, 0 unnamed
names resolved  : 2020-table=1987, City_Town=196
cr2bf_VersionLabel   : pure-2020
cr2bf_GeoidVintage   : 2020
cr2bf_TractCount     : 2183
cr2bf_KeyChecksum    : 5151c3f60227f3b87af8a44f633135470b39d8802e70d310bff2dcea0e6f636a
```

### `cr2bf_FieldCount` is 8 — say this twice

The app cross-checks the Dataverse record against the uploaded file and
**refuses the dataset outright** if they disagree:

```
record FieldCount (9) disagrees with the file (8).
```

For a *geometry* dataset a refusal means the map has no shapes for that vintage.
A record left at 9 from an earlier upload is the most likely way for this to go
wrong.

### Where the outputs land

```
Data/out/tract_geometry_pure-2010.json
Data/out/tract_geometry_pure-2020.json
```

### Operator gotchas

1. **The 2010 crosswalk is used as downloaded — do not clean it up.** It has no
   GEOID column, so the builder constructs the key itself as
   `'36' + county FIPS (3 digits) + tract (6 digits)`, stripping thousands
   separators and zero-padding as it goes, with a provenance guard on the
   result. This normalisation is entirely inside the builder. Any instruction to
   pre-format the CSV would be wrong and would break the key.

2. **The staleness NOTE is a stop, not a log line.** The two CECONY shapefiles
   feed *two* outputs: the per-tract `electric_networks` and `gas_areas` values
   in these datasets, and the `service_territories.geojson` overlay the map
   draws (built separately by `_make_territories.py`, which needs network
   access). Change the shapefiles and rebuild only one side, and the outlines on
   screen disagree with the tooltip values **silently**. The build prints a NOTE
   when it detects this.

3. **Rebuild both vintages when a shared input changes.** The CECONY shapefiles,
   both crosswalk CSVs and `map_payload.json` are shared by both builds. Only
   `ny_tracts.geojson` and `ny_tracts_2010.geojson` are vintage-specific. If a
   shared input changes, rebuild **and re-upload** 2010 and 2020.

4. **Upload 2020 first, then 2010.** 2010 is the vintage currently paired with
   the live indicator dataset, so it is the one that can visibly break. Doing
   2020 first proves the file and the record fields before the live pairing is
   touched.

5. **Re-uploading retires the previous set automatically**, and only *after* the
   new file has been uploaded and verified — so a failed upload cannot leave a
   vintage with no geometry. Retired sets disappear from the Tract shapes card
   but remain in Dataverse as the rollback.

---

## 3. The minimal self-contained package

The readers have no repository access, so the scripts have to travel with their
inputs. Two packages, because their dependencies differ.

### Package A — the NYSERDA converter

**Python standard library only. No `pip install`.**

```
ExecutiveDashboard_dev/
├── app.js                                  <-- REQUIRED, see the note below
└── Data/
    ├── convert_nyserda_raw.py
    ├── build_tract_dataset.py               <-- imported for the manifest
    ├── NYS_DAC.geojson                      <-- the NYSERDA download
    └── out/
        └── tract_geometry_pure-2010.json    <-- the universe
```

**`app.js` is not optional, and this is the least obvious thing in this
document.** `build_tract_dataset.py` parses the indicator catalogue *out of
`app.js`*, so that the dataset manifest provably matches the dashboard as
shipped. Without it the converter fails. Ship the same `app.js` that is
deployed.

### Package B — the geometry builder

**Three third-party packages:**

```
pip install pyshp pyproj shapely
```

Verified on **Python 3.14.5** with pyshp 3.0.9, pyproj 3.7.2, shapely 2.1.2.

```
ExecutiveDashboard_dev/
├── map_payload.json                         <-- the GEOID universe
└── Data/
    ├── build_pure_geometry_dataset.py
    ├── ny_tracts.geojson
    ├── ny_tracts_2010.geojson
    ├── 2020_Census_Tracts_to_2020_NTAs_and_CDTAs_Equivalency_20260601.csv
    ├── 2010_Census_Tract_to_Neighborhood_Tabulation_Area_Equivalency_table_20260806.csv
    ├── service_territories.geojson          <-- optional, staleness check only
    ├── Extra_info/
    │   ├── CECONY_Electric.shp / .shx / .dbf / .prj
    │   └── CECONY_Gas.shp / .shx / .dbf / .prj
    └── out/                                 <-- must exist or be creatable
```

### Both packages

Run with the working directory set to `ExecutiveDashboard_dev/`, invoking scripts
as `python Data/<script>.py`. The scripts resolve paths relative to their own
location, so running from anywhere else fails on inputs.

### Two contents warnings before this is packaged

- **`map_payload.json` and the `CECONY_*` shapefiles are Con Edison internal
  data** — per-tract customer account counts, EAP enrolment, and network
  geometry. Package B cannot be assembled without them, so whoever ships it is
  shipping client data back to the client. That is fine for a Con Edison
  audience and not fine for any other.
- **A stale comment in `build_pure_geometry_dataset.py`** still says the 2010
  crosswalk is "NOT YET IN THE REPO". It has been present since 2026-08-06. A
  documentation writer reading the source will be misled. Worth a one-line fix.
