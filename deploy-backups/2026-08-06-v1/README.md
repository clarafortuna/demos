# cr2bf_dactest pre-deploy snapshot — 2026-08-06 (V1 delivery)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the V1 deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `ebc1353`
(PR #97, "V1: in-context docs, a territory card, a neutral upload block, two
retirements"). Pushed and published: **all three files**.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 653,573 | yes → 671,532 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 238,382 | yes → 239,460 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 10,764 | yes → 11,165 |

Third snapshot of 2026-08-06, after `2026-08-06-pure-vintage/` and
`2026-08-06-cachebust/`. Each keeps its own folder because restoring an earlier
one would roll back the deploys made since it.

## Build id

**`2c65315239`** for `app.js`, **`b5ff33974c`** for `styles.css`.

Confirming a client reports `[DAC dashboard] build 2c65315239` is a required
step. The Map Layers page shows the same id at the bottom.

The snapshot in this folder is the previous build, **`7f54c517b4`**, which is
what a rolled-back client will report.

## What this deploy changed

UI only. **No resolver change, no dataset change, no Dataverse schema change**,
and nothing was uploaded. The hosted data state before and after is the same:
`nyserda_dac v1.0` live on `tract_geometry pure-2010`, `pure-2020` published and
available, `2.0-demo` loaded inactive.

- **In-context docs.** A "How to update" button on Saved layers, Tract datasets,
  Tract shapes, Territory overlays and the upload block, each opening a shared
  drawer with that card's content. The openers are delegated on `#ml-list-mount`
  because they live inside cards that re-render.
- **Territory overlays**, a new read-only card for the three built-in outlines.
- **The upload control moved** out of Tract datasets into its own "Upload data
  file" card below both cards. Same picker, same validator, same routing on the
  manifest's `kind`; it stays inside `#ml-list-mount` because all four of its
  controls are delegated there.
- **Edit map files** hidden from navigation. Route, page and wiring intact; the
  URL still works.
- **The built-in HVI overlay** hidden from the Layers control. Layer code,
  legend and `Data/hvi_zcta.geojson` all intact. This does NOT affect the
  per-tract HVI value in the tract tooltip, which comes from the shapes dataset
  and shares no code with the overlay.
- `styles.css` carries the new card, drawer and header-cluster styles.
- `ExecutiveDashboard.html` carries the hidden nav item and the `?v=` stamps.

`Data/build_pure_geometry_dataset.py` also gained a territory staleness warning,
but that is a build script and is not deployed.

## Restoring

All three must be restored **together**: `styles.css` styles markup only the new
`app.js` emits, the HTML's hidden nav item pairs with it, and the stamped `?v=`
URLs only make sense alongside the `app.js` they were stamped for.

For each row, PATCH the content back and publish:

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

A rolled-back client reports `build 7f54c517b4`. Rolling back restores the Edit
map files nav item and the built-in HVI layer row, removes the docs buttons and
the Territory overlays card, and puts the upload control back inside Tract
datasets. It does **not** touch any uploaded dataset or geometry row: the
restored build still resolves them exactly as it did this morning.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed — check it before and
after a restore.
