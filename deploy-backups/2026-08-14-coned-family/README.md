# cr2bf_dactest pre-deploy snapshot — 2026-08-14 (ConEd figures as the fourth family)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `1d4a5f9`,
carrying PR #152 (slice 7a, the converter and its equivalence guard — offline
only) and PR #153 (slice 7b, `coned_operational` as the fourth DatasetKey
family).

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 781,709 | yes → 802,394 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 (`?v=` stamp only) |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 250,881 | **no — unchanged** |
| `cr2bf_dactest/map_payload.json` | `9a93efd4-296b-f111-ab0d-7c1e521c7110` | 4,794,147 | **no — unchanged** |

## Build id

| file | id | previous |
|---|---|---|
| `app.js` | **`da3ba85ac5`** | `46ee3e8732` |
| `styles.css` | `6ea0bb1891` | **unchanged** |

```
[DAC dashboard] build da3ba85ac5
```

## What this deploy changes, and what it deliberately does not

**Nothing on screen, and that is proven rather than asserted.** The dataset row
`coned_operational v1.0-2010` was published *before* this deploy and the previous
build ignored it — `46ee3e8732` refuses `kind: "coned"` as unrecognised. This
build understands it and applies it, and the composed map is byte-identical
either way.

`coned_acceptance.js` booted the same `app.js` twice against the same overlay,
differing only in whether the ConEd dataset is published, and compared all 2,333
tracts — every property and the polygon — plus the rendered fills, KPI block and
legend. Identical. A negative control altering one ConEd value was detected, so
the comparison is not vacuous.

### Why it is identical: the override table is a full copy

The 7c audit read all 2,333 rows of `cr2bf_dacmaptractdata` and found **zero**
values differing from the spreadsheet-derived dataset — the two adjustment
columns compared at 4dp, because they are `Decimal(4dp)` in Dataverse and 14-15
decimals in the file, so a faithful copy can never match exactly. The null
pattern matches the dataset exactly too.

That table is a mirror, not a correction store. Since the overlay applies OVER
the ConEd dataset, it masks it completely, which is why nothing moves on screen.
The dataset's value today is provenance and rollback, plus the fact that an
override is finally distinguishable from source data. **What those 2,333 rows
should become is an open decision, deliberately not taken here.**

### The null rule changed

A null in `cr2bf_dacmaptractdata` no longer overwrites the value beneath it. It
still establishes the key — skipping outright made the key vanish on the composed
base and `invert_proof` caught it as 2,333 differing tracts — but it no longer
deletes a figure the ConEd dataset supplies. On this data the change is invisible,
because the table's nulls line up exactly with the dataset's.

## Dataverse state at deploy time

| key | version | state |
|---|---|---|
| `nyserda_dac` | 1.0 | published (live indicators, vintage 2010) |
| `tract_geometry` | pure-2010 | published (stamped, vintage 2010) |
| `tract_geometry` | pure-2020 | published (vintage 2020, **unverified**) |
| `service_territories` | 1.0 | published |
| `coned_operational` | 1.0-2010 | published (new, `0aee1749-8097-f111-b8db-000d3a8a80a1`) |

Four retired rows remain as rollbacks. `28a52f28-9f92-f111-b8db-7ced8d1b7887` is
the **verified** 2020 geometry and is one of them — it is retired, not published,
which is the opposite of what an earlier note in this series assumed.

## Restoring

`app.js` and `ExecutiveDashboard.html` restore **together** — the HTML's `?v=`
stamp for `app.js` matches only the copy in this folder. `styles.css` and
`map_payload.json` need no action.

```
PATCH https://org9076e69b.crm.dynamics.com/api/data/v9.2/webresourceset(<webResourceId>)
If-Match: *
Content-Type: application/json

{ "content": "<base64 of the saved file>" }
```

then

```
POST https://org9076e69b.crm.dynamics.com/api/data/v9.2/PublishXml
{ "ParameterXml": "<importexportxml><webresources><webresource>{<webResourceId>}</webresource>…</webresources></importexportxml>" }
```

**Clean rollback.** A rolled-back client reports `46ee3e8732`, stops
understanding `kind: "coned"` and ignores the published `coned_operational` row,
and writes overlay nulls through again. On the current data all three are
invisible, because the overlay supplies every value anyway. No stored data
changes either way, and the ConEd row can stay published across a rollback
without harm.

Take the base64 from the files **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed — check it before and
after a restore.
