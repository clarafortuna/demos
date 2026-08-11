# Is `map_payload.json` reproducible from its own pipeline?

Slice 5a of the map-data-to-Dataverse work. This document exists because the
payload cannot be retired honestly until it is known exactly what would be lost,
and because any replacement has to be reproducible in a way the payload is not.

**Short answer: 69 of its 73 properties reproduce exactly. Four do not, and one
cause explains two of them. Nothing that diverges is lost by the retirement,
because the Dataverse geometry dataset already carries the live values.**

No file was rebuilt in place. The live `map_payload.json` was copied aside first
and verified byte-identical afterwards.

## Method

The four `enrich_*` scripts resolve the payload as
`os.path.join(ROOT, "map_payload.json")` where `ROOT` is the parent of the
script's own directory, **not** the working directory. Running them from a
temporary cwd would still have overwritten the live file. So the whole `Data/`
directory was copied to a temporary root -- the five scripts plus every input --
and the chain was run there, writing its payload beside the copies.

```
scratchpad/rebuild_root/
  Data/                 the 5 scripts + ny_tracts*.geojson, NYS_DAC.geojson,
                        Electric.xlsx, Gas.xlsx, the 2020 crosswalk CSV,
                        Extra_info/{CECONY_Electric.*, CECONY_Gas.*,
                        hvi_zcta_2020.geojson}
  map_payload.json      the rebuilt article
```

Verified before and after: `a3fe94cf5af021e3...` on the live file both times, and
`git status` clean. The rebuild's own side effect -- `enrich_hvi.py` recreating
`Data/hvi_zcta.geojson` -- landed inside the temporary root.

| | bytes | features |
|---|---|---|
| live | 4,954,060 | 2,333 |
| rebuilt | 4,826,043 | 2,333 |

Same 2,333 GEOIDs, no additions, no removals.

## The pipeline is five scripts, and its own documentation says three

`build_base_map_payload.py` heads its docstring with:

```
python Data/build_base_map_payload.py   # 0. base build  (this script)
python Data/enrich_map_payload.py       # 1. + 48 DAC indicator / score fields
python Data/enrich_neighborhoods.py     # 2. + borough + neighborhood
```

`enrich_electric_network.py` and `enrich_hvi.py` are missing from that list, and
both write to the same file. They are steps 3 and 4, and each names the order
correctly in its own header -- so the omission is in the entry point, which is
the one place a reader starts.

Following the documented three steps produces a payload with **no
`electric_networks`, no `gas_areas` and no `hvi` at all**. That is not a
divergence; it is a reader being told to run 3 of 5 steps. Reported here because
it is the most likely way somebody rebuilds the wrong thing.

The results below are from the **full five-step chain**.

## Classification, all 2,333 x 73

| | count |
|---|---|
| properties identical on every tract | **69** |
| properties differing only by formatting | 0 |
| properties genuinely different | **4** |
| root block `nondac_by_county` | **equal** |

### 1. `City_Town` -- 1,274 tracts. Not derivable from any present input

| | tracts | rebuilt value |
|---|---|---|
| matches | 1,059 | -- |
| differs | **1,274** | `None` on every one |

The split is exact: all 1,059 matches are `DAC_Desig = "Designated as DAC"`, and
all 1,274 divergences are `DAC_Desig = "Non-DAC"`.

**Cause.** `build_base_map_payload.py` copies `DAC_FIELDS`, which includes
`City_Town`, from `NYS_DAC.geojson`. That file holds DAC tracts only -- 1,736
statewide. A Non-DAC tract has no row there, so there is nothing to copy, and the
field comes out null.

**But the live values are mechanically derivable.** For Non-DAC tracts there is
exactly one distinct value per county:

| county | live `City_Town` for Non-DAC | tracts |
|---|---|---|
| Bronx, Kings, New York, Queens, Richmond | `New York city` | 1,158 |
| Westchester | `Westchester` | 116 |

So the live payload was filled from the county, not from NYSERDA. The rule is six
lines long and reproduces all 1,274 values. It is not in any committed script.

Note the asymmetry that makes this safe to conclude: for **DAC** tracts the five
NYC counties are also uniformly `New York city`, but Westchester carries 17
distinct real city names (`Yonkers city`, `Mount Vernon city`, `New Rochelle
city`, ...). The county fill only ever applied where NYSERDA had no row.

### 2. `neighborhood` -- 116 tracts, all downstream of the above

All 116 are Westchester, and every one is inside the `City_Town`-divergent set.

**Cause.** `enrich_neighborhoods.py:99` sets Westchester's neighborhood to
`clean_city_town(p.get("City_Town"))`. With `City_Town` null in the rebuild, the
neighborhood is null too. One root cause, two symptoms -- not two independent
normalisation differences.

### 3. `electric_networks` -- 5 tracts of membership, 1 of order

2,327 identical. One tract differs only in ordering (`36061000700` and its
neighbours rank ties differently). Five differ in membership, **in both
directions**:

| tract | difference |
|---|---|
| `36061000700` | rebuilt adds `Borough Hall` |
| `36061000900` | live has `Cortlandt`, rebuilt does not |
| `36061009200` | live has `Turtle Bay`, rebuilt does not |
| `36061031704` | rebuilt adds `Cortlandt` |
| `36085012805` | rebuilt adds `Wainwright` |

**Cause: marginal areas at the 5% threshold, not a rule change.** The rule keeps
every polygon whose intersection is at least 5% of the tract's area. Five tracts
have a polygon sitting within rounding distance of that line, and the comparison
falls the other way. Differences in both directions rule out a changed threshold
or a changed CRS, either of which would move every case the same way.

### 4. `hvi` -- 454 tracts, and 451 of them by 0.0005

| | tracts |
|---|---|
| identical | 1,663 |
| same ZCTAs, same scores, **different `overlap_fraction`** | **451** |
| different ZCTA membership | 4 |
| different score | 0 |
| present only in the rebuild | 1 |

```
36005003100  live  10455 @ 0.7579,  10454 @ 0.2421
             reb   10455 @ 0.7584,  10454 @ 0.2416
```

**Same cause as `electric_networks`**: tiny differences in computed intersection
area, visible directly in the fractions here and only visible at the threshold
there. No score changed, which is what would matter if the HVI source had moved.

`hvi` is being deleted in slice 5b, so this is recorded for corroboration rather
than for repair.

### Why the areas differ at all

The inputs are identical -- `ny_tracts*.geojson` and the CECONY shapefiles are
unchanged on disk, and the tract GeoJSONs have been independently proven
byte-reproducible from the Census archives. The code is unchanged. What is left
is the numerical stack:

```
python 3.14.5   shapely 2.1.2   pyproj 3.7.2 (PROJ 9.5.1)
pyshp 3.0.9     openpyxl 3.1.5
```

The live payload was built on 2026-07-23 with whatever versions were installed
then. Same inputs and same code producing fourth-decimal differences in projected
intersection areas is consistent with a library or PROJ-grid change, and nothing
else here explains it. **This is the best-supported explanation, not a proven
one** -- confirming it would mean pinning the versions used in July and re-running,
which is not worth doing to retire the file.

It is, however, the strongest argument in this document for the retirement:
**geometric properties recomputed at read time are not stable across a toolchain
upgrade, and properties frozen into a versioned dataset with a checksum are.**

## `nondac_by_county`: dead, and provably so

The root-level block reproduces **exactly**, so it is not a divergence. It is
simply unread:

- **one** occurrence in `app.js`, at line 4328, inside `dsApplyGeometryToGeo`,
  where it is copied onto the new FeatureCollection so a geometry swap does not
  drop it. Nothing reads it back.
- **zero** occurrences in `payload.json`, the dashboard's separate data file, so
  the borough charts do not source it either. The ~90 other `nondac*` matches in
  `app.js` are unrelated identifiers (`nondacFunding`, `nondacPct`,
  `nondac_customers`) belonging to the dashboard payload.

It can be deleted in 5b with the same confidence as `hvi`.

## What this means for the retirement

The four divergent properties are all already sourced from Dataverse, and the
replacement holds the **live** values:

| property | in `tract_geometry pure-2010` | agreement with the live payload |
|---|---|---|
| `City_Town` | non-null on all 2,333 | **2,333 of 2,333** |
| `neighborhood` | present | 2,204 of 2,333 |
| `electric_networks` | recomputed per vintage | -- |
| `gas_areas` | recomputed per vintage | -- |

`City_Town` matching on every tract is the important line: the geometry builder
reads it from the payload (`src.get("City_Town")`), so the un-reproducible county
fill has **already been captured** in the published dataset. Retiring the payload
does not lose it.

The 129 `neighborhood` differences against the geometry dataset are **deliberate**
and documented in `GEOMETRY_VINTAGE_CHANGE_2010.md`: the dataset applies the
newest-crosswalk rule across the 2010 and 2020 equivalency tables, while
`enrich_neighborhoods.py` uses the 2020 table alone. That is the replacement being
better sourced, not drifting.

## The recommendation

**Do not make `map_payload.json` reproducible.** It would mean committing a
county-fill rule that exists nowhere, pinning a July toolchain to reproduce
fourth-decimal areas, and maintaining a five-step chain whose own entry point
documents three steps -- all to keep regenerating a file that is being deleted.

Every field it carries either reproduces exactly, is already frozen correctly in
the geometry dataset, or is dead. Slice 5b can delete `hvi` and
`nondac_by_county` on the evidence here; 5c can invert the base knowing that
nothing in the payload is both live and unreproducible elsewhere.

## Reproducing this document

```
# 1. copy the live payload aside and record its sha256
# 2. copy Data/ (the 5 scripts + inputs) to a temporary root
# 3. from that root, in order:
python Data/build_base_map_payload.py
python Data/enrich_map_payload.py
python Data/enrich_neighborhoods.py
python Data/enrich_electric_network.py
python Data/enrich_hvi.py
# 4. classify every property over the union of both GEOID sets
# 5. verify the live file's sha256 is unchanged
```

The classifier used here treats a pair as `formatting` when two numbers agree to
6 decimal places, two strings agree after stripping, or two lists hold the same
members in a different order; everything else is `different`. On this comparison
the formatting bucket came out empty except for the single `electric_networks`
ordering case, which is reported above rather than hidden in a bucket.
