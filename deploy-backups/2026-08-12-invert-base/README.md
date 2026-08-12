# cr2bf_dactest pre-deploy snapshot — 2026-08-12 (slice 5c, invert the base)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `3a2c977`
(PR #139, slice 5c: invert the base).

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 727,305 | yes → 740,314 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 250,293 | yes → 250,881 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 |
| `cr2bf_dactest/map_payload.json` | `9a93efd4-296b-f111-ab0d-7c1e521c7110` | 4,794,147 | **no — unchanged** |

Both `app.js` and `styles.css` changed this time: the skeleton the map card shows
while it waits for hydration is new CSS. The HTML is the same length and carries
the two new `?v=` stamps.

`map_payload.json` was byte-identical and skipped by the comparison rather than
re-pushed -- the first time that check has had a data resource to skip, since 5b
added it to the target list.

## Build ids

| file | id | previous |
|---|---|---|
| `app.js` | **`bc1b672227`** | `59ec7f6405` |
| `styles.css` | **`6ea0bb1891`** | `f9490ed2f1` |

```
[DAC dashboard] build bc1b672227
document.querySelector('link[href*="styles.css"]').getAttribute('href')
// -> styles.css?v=6ea0bb1891
```

Both are worth checking here: the console id covers `app.js`, and `styles.css`
changed too, so the stamp is the only way to confirm the second half arrived.

## What this deploy changes

**The map is now composed from Dataverse.** The geometry dataset is the base --
tract universe, polygons and 8 fields -- the indicator dataset adds 56, and the
editable overlay adds 8. After slice 5b that is exactly the 72 properties
`map_payload.json` carried, with no gaps and no overlap between the two datasets.

**The map card waits for hydration; the dashboard does not.** An 8-second hard
timeout falls back to the payload with a console line, and a skeleton shows while
it waits.

**A real flash is gone.** The previous boot painted the payload's 2020/2010 hybrid
geometry and then repainted with `pure-2010`, and all 2,333 polygons differ
between those two. Measured against the deployed baseline: 2 geo builds become 1,
and the map appears **59-137ms EARLIER**, not later.

**Proven identical in the settled state**, 11 assertions against `2ba1260`'s own
`app.js`, `styles.css` and HTML: same feature count, same GEOID sequence,
identical property key sets, every one of 2,333 tracts identical in all 73
properties AND its polygon, same rendered path count, same per-path fill and
stroke. Plus a negative control that detects a sabotaged geometry dataset, so the
comparison is not vacuous.

Also: `dsUsePayload` became `dsUsePayloadIndicators` across four call sites,
because none of those cases abandons Dataverse any more -- they lose the indicator
dataset while the geometry dataset keeps drawing. A fifth mode, no geometry
dataset available, falls back to the payload as base and says so.

`MAP_BASE` ('dataverse' | 'payload') is the rollback lever inside the code: one
word plus an `app.js` redeploy, no data change. It is scaffolding and slice 5d
removes it.

**Nothing was uploaded to Dataverse tables**, so the hosted data state is
unchanged: `nyserda_dac v1.0` live on `tract_geometry pure-2010`.

## Restoring

All three replaced files restore **together** -- the HTML's two `?v=` stamps match
only the copies in this folder. `map_payload.json` needs no action; the live copy
already matches the one here.

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

**Clean rollback, and cheaper than usual.** Nothing about storage, validation or
what is published changed, so every dataset and every saved layer reads the same
on either build. A rolled-back client reports `bc1b672227` -> `59ec7f6405`, paints
the payload's hybrid geometry first and repaints, and shows no skeleton.

There is also a **partial** rollback available without touching this folder: set
`MAP_BASE = 'payload'` in `app.js` and redeploy that one file. It restores the
pre-5c composition order while keeping everything else in this build.

Take the base64 from the files **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed -- check it before and
after a restore.
