# cr2bf_dactest pre-deploy snapshot — 2026-08-13 (territories as the third family)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `21de55c`,
carrying PR #149 (slice 6c, one producer for both outputs) and PR #150
(slice 6d, service territories as the third DatasetKey family).

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 753,314 | yes → 781,709 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 (`?v=` stamp only) |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 250,881 | **no — unchanged** |
| `cr2bf_dactest/map_payload.json` | `9a93efd4-296b-f111-ab0d-7c1e521c7110` | 4,794,147 | **no — unchanged** |

## Build id

| file | id | previous |
|---|---|---|
| `app.js` | **`46ee3e8732`** | `4c07c86f61` |
| `styles.css` | `6ea0bb1891` | **unchanged** |

```
[DAC dashboard] build 46ee3e8732
```

## What this deploy changes, and what it deliberately does not

**Nothing on screen, yet.** Slice 6c ships no `app.js` change at all — it is
producer-side only. Slice 6d adds a third dataset family that has **no rows in
this org**, so every new path is dormant until an overlay is uploaded. That is
the honest framing for a verifier: the map, the tooltips, the legend and the
territory toggles all behave exactly as on `4c07c86f61`.

### 6d: service territories as the third DatasetKey family

The territory overlay can now come from a published Dataverse dataset instead of
the `Data/service_territories.geojson` web resource. With nothing published, the
resolver falls back to that web resource on first toggle and logs which route it
took, so the fallback is observable rather than assumed.

Three rules were narrowed rather than copied from the geometry family, and two
were traps rather than gaps:

- `saveTractDataset` filtered retire candidates on DatasetKey **and**
  GeoidVintage unconditionally. A territory row has no vintage, so the clause
  asked for `cr2bf_geoidvintage eq ''`, which does not match a row stored as
  **null** — the incumbent would have stayed published beside the newcomer.
  Callers now state the scope; absent, it stays vintage-scoped.
- three sites asked for the indicator family as `!dsRecIsGeometry(rec)`. Exact
  with two families; wrong with three. `dsHydrateActiveDataset` would have taken
  a published overlay as THE live indicator dataset.
- the overlay stays lazy: downloaded on first toggle, never on boot.

### The web resource is deliberately NOT updated

`Data/service_territories.geojson` (`11aff234-2d6b-f111-ab0d-7c1e521c7110`)
changed in the repo — slice 6c stamped it with a source fingerprint, and 6d laid
a dataset manifest on it — and is **not** in the deploy script's `TARGETS`. It is
not being pushed because 6d makes it a fallback and 6e deletes it, so pushing it
now would be work with a scheduled deletion.

The live copy therefore stays the pre-6c bytes, carrying **no fingerprint**.
That is exactly the "unverifiable, draw it" tier of the graduated rule, and it is
why that tier had to exist at runtime and not only in the builder.

**Nothing was uploaded to Dataverse tables**, so the hosted data state is
unchanged: `nyserda_dac v1.0` live on `tract_geometry pure-2010`, 6 dataset rows,
2 saved layers, **0 territory rows**.

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

**Clean rollback, with one thing it takes back.** A rolled-back client reports
`4c07c86f61` and loses the ability to read a territory dataset — it would refuse
one as "recognised but cannot yet use" and fall back to the web resource, which
is exactly what it does today. Nothing about stored data changes either way.

**This rollback stops being clean once an overlay is published and the web
resource is deleted (6e).** At that point a `4c07c86f61` client has no route to
the outlines at all: it cannot read the dataset, and the file it would fall back
to is gone. Restoring the web resource is then part of the rollback, and the
bytes for it are in `Coned/CLCPA/ExecutiveDashboard_dev/Data/` at `dc0886a`.

Take the base64 from the files **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed — check it before and
after a restore.
