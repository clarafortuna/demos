# cr2bf_dactest pre-deploy snapshot — 2026-08-07 (class breaks + zero transparency)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `9620845`
(PR #118, custom class breaks and zero-value transparency). Ninth deploy of the
day.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 691,376 | yes → 704,583 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 242,138 | yes → 243,379 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 |

The HTML is the same length either side and was still replaced, because the `?v=`
stamps moved with the two files they point at.

## Build ids

| file | id | previous |
|---|---|---|
| `app.js` | **`fe910a6f8c`** | `e0f63407f5` |
| `styles.css` | `841e182939` | `d8500ef7cf` |

Both moved, so the ordinary console check verifies this deploy.

## What this deploy adds

Two per-layer display settings, chosen **at upload only**, persisted in
`cr2bf_RampConfig`, and re-applied when anyone else's session hydrates the
layer.

**Custom class breaks.** A manual mode beside the computed default: four values,
prefilled from the computed breaks. Refused when they are not four numbers, not
strictly ascending, or fall outside the data. Add to map is disabled while they
are invalid. Reset returns to quantiles.

**Zero-value transparency.** Off by default, so every layer already saved renders
pixel-identical. Features whose value is exactly 0 draw with no fill and no
stroke rather than in the lowest class colour. Stated in the legend's (i) panel
as one line inside Class ranges.

Neither control appears for a single-value field: there are no classes to cut,
and no colour to hide that is not the only colour there is.

### The part that was hard, and why it matters for support

`mlHydrateOne` **recomputes** a saved layer's scale from the downloaded file on
every load. Manual breaks that were stored but not re-applied would therefore
render correctly for whoever chose them and silently revert to quantiles for
every other reader, with nothing on screen to indicate it. `mlScaleFor` overlays
the stored breaks at draw time, and the uploader's own preview goes through the
same function, so one code path decides what everybody sees.

If a report ever arrives that "the classes look different for me", the thing to
check is `cr2bf_RampConfig` on that row: `manualBreaks` should be an array of
four ascending numbers, and the legend should read **5 custom classes** rather
than 5 quantile classes.

**No dataset or geometry row was uploaded by this deploy**, so the hosted data
state is unchanged: `nyserda_dac v1.0` live on `tract_geometry pure-2010`.
Existing saved layers are unaffected: both settings default off, and a ramp
config without them hydrates exactly as before.

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

A rolled-back client reports `build e0f63407f5`.

**One asymmetry worth knowing before rolling back.** The two settings live in
`cr2bf_RampConfig` on the layer row, and a rollback does not touch Dataverse. So
a layer saved with manual breaks keeps them stored, but the older build ignores
the extra keys and draws quantiles instead. Nothing is lost or corrupted -- the
`manualBreaks` and `zeroTransparent` keys sit there unread until a build that
understands them is deployed again. Re-deploying restores the intended
rendering with no re-upload.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed -- check it before and
after a restore.
