# cr2bf_dactest pre-deploy snapshot — 2026-08-07 (HVI overlay retired)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `d59532b`
(PR #107, built-in HVI overlay retired, plus the layer tooltip and legend popup
changes). Sixth deploy of the day.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 688,856 | yes → 685,277 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 242,815 | yes → 242,138 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 |

Both code files got **smaller** — the first deploy of the day where that is true.
The HTML is the same length either side and was still replaced, because the `?v=`
stamps moved with the two files they point at.

## Build ids

| file | id | previous |
|---|---|---|
| `app.js` | **`e29cb586b6`** | `e173f8f221` |
| `styles.css` | `d8500ef7cf` | `b968d47a4f` |

Both moved, so the ordinary console check verifies this deploy.

## What this deploy changed

Render only. **No dataset or geometry row was uploaded**, so the hosted data
state is unchanged: `nyserda_dac v1.0` live on `tract_geometry pure-2010`,
`pure-2020` published.

- **The built-in HVI overlay is gone, not hidden.** `ensureHviGeo`,
  `buildHviLayer`, `refreshHviLayer`, `hviStyle`, `HVI_RAMP`, `_hviToggleOn`,
  the module-level fetch caches, the hidden checkbox row, the legend block and
  ten CSS rules. Heat Vulnerability is an uploaded saved layer now, carrying its
  own provenance, legend and tooltip; the built-in one duplicated it from a
  source that could not say where it came from.
- **The layer tooltip reads name and value** — `Heat Vulnerability Index: 4`,
  not `Heat_Vulnerability_Index__HVI_: 4`. The field key is how a source file
  spells a column, not what a reader needs.
- **The legend (i) popup is a separate floating panel.** It used to expand inside
  the legend card, growing a tall box over the map. The card no longer changes
  size at all. Content is Source and Class ranges only.

### The 1.5 MB file, and why nothing broke

`Data/hvi_zcta.geojson` was deleted from the repo with the overlay that read it.
It was **never a web resource** — the retired code fetched it with a relative
URL that does not resolve inside a model-driven app, so hosted, that overlay had
almost certainly been inert behind its hidden checkbox for some time. Deleting
the file changes nothing about the hosted app; the saving is in the repo and on
the public Pages site.

`enrich_hvi.py` still emits that file as a pipeline output. Nothing reads it.
Its docstring says so, and the emission itself stops in the payload-retirement
slice rather than here.

### One thing this deploy is evidence for

Removing `ensureHviGeo().then(... .addTo(map))` removes the **only asynchronous
layer add** in the codebase, which was one of the last surviving candidates for
the FAIL 2 freeze. The opt-in diagnostic (build `e173f8f221`) shipped one deploy
earlier on purpose, so that if the freeze recurs after this, that candidate is
eliminated rather than merely absent. Keep the diagnostic armed.

## Restoring

All three must be restored **together**: `styles.css` styles markup only this
`app.js` emits, and the HTML's `?v=` stamps match only the pair in this folder.

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

A rolled-back client reports `build e173f8f221`. Rolling back brings back the
hidden HVI checkbox and its legend markup, the field key in the layer tooltip,
and the in-card expanding popup.

**One caveat specific to this rollback:** the restored code fetches
`./Data/hvi_zcta.geojson`, which no longer exists in the repo. Hosted that is
harmless, because the fetch never resolved there anyway and the code logs a
warning and gives up. Served from the repo or from Pages, an unhidden HVI
checkbox would warn in the console instead of drawing. If the overlay is ever
genuinely wanted back, restore the file from this commit's parent as well.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed — check it before and
after a restore.
