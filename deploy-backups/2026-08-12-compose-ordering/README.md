# cr2bf_dactest pre-deploy snapshot — 2026-08-12 (compose ordering + parallel downloads)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `f0f4e0c`
(PR #142, compose from the dataset and stop the two downloads queueing).

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 740,314 | yes → 744,522 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 250,881 | **no — unchanged** |
| `cr2bf_dactest/map_payload.json` | `9a93efd4-296b-f111-ab0d-7c1e521c7110` | 4,794,147 | **no — unchanged** |

Two files pushed, two skipped by the byte comparison. All four archived.

## Build id

| file | id | previous |
|---|---|---|
| `app.js` | **`00b8ba7881`** | `bc1b672227` |
| `styles.css` | `6ea0bb1891` | **unchanged** |

```
[DAC dashboard] build 00b8ba7881
```

The console id is sufficient this time; the stylesheet did not change.

## What this deploy changes

Two defects in the 5c composed boot, both found in the hosted console rather than
locally. Neither was a validation failure -- the dataset validated, went active
and merged 2,333 tracts.

**1. The compose read map_payload.json on every healthy boot.** `getMapGeo` runs
INSIDE `dsHydrateActiveDataset` for the coverage gate, and reached that point with
`_dsIndicators` still null, because only `dsInstall` set it -- fourteen lines
later. So the composed base took the "no indicator dataset" branch, downloaded the
payload for its 56 values, and `dsInstall` then overwrote them:

```
[DAC map] payload indicators applied to 2333 tracts.
... composed from Dataverse ... indicators from map_payload.json.
[Tract datasets] merged 2333 tracts from "nyserda_dac v1.0" into the map.
```

The settled map was correct, which is why the 5c proof passed -- it compares
settled state -- but every boot downloaded 4.8 MB it then discarded, which is what
5c existed to stop, and it would have broken slice 5d where no payload remains to
fetch. The validated document is now retained the moment validation passes.

**2. The two dataset downloads were strictly serial.** Measured hosted: indicator
1,154 KB / 416ms and paired geometry 1,585 KB / 701ms, with the second request not
leaving until the first had fully arrived. Which geometry to fetch depends only on
the vintage declared in the list call, so nothing has to be parsed first. Both now
start together, and `dsPrepareGeometryFor` verifies the prefetch was for the record
it actually resolves to before using it.

The compose log now names the version -- `indicators from "1.0"` -- because at
compose time `dsState()` still reports 'payload' and could not say which dataset
had reached the map.

Proof harness 11 -> 14 assertions, all green against the deployed baseline at
`2ba1260`, including three that pin this deploy's intent: the composed boot fetches
`map_payload.json` **zero** times, the baseline **does** fetch it (so that
assertion can fail), and the compose names the dataset version.

**Nothing was uploaded to Dataverse tables.** Separately, and not part of this
deploy: five obsolete unpublished `tract_geometry` rows were deleted in the maker
portal the same day. The table is now 6 rows, one published geometry per vintage.

## Restoring

`app.js` and `ExecutiveDashboard.html` restore **together** -- the HTML's `?v=`
stamp for `app.js` matches only the copy in this folder. `styles.css` and
`map_payload.json` need no action; the live copies already match the ones here.

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

**Clean rollback.** Nothing about storage, validation or what is published changed.
A rolled-back client reports `bc1b672227`, fetches the payload on every boot again
and downloads the two dataset files one after the other. The map looks identical
either way -- these were both cost-and-correctness-of-path fixes, not rendering
changes.

Take the base64 from the files **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed -- check it before and
after a restore.
