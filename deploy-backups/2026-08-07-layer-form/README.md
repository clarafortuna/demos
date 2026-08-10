# cr2bf_dactest pre-deploy snapshot — 2026-08-07 (layer form redesign)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `b492fb4`
(PR #122, layer upload form redesign). Eleventh deploy of the day.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 716,425 | yes → 726,216 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 244,151 | yes → 248,370 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 |

The HTML is the same length either side and was still replaced, because the `?v=`
stamps moved with the two files they point at.

## Build ids

| file | id | previous |
|---|---|---|
| `app.js` | **`53e3dffcda`** | `37eebaba43` |
| `styles.css` | `b21d855626` | `a865179e2d` |

Both moved, so the ordinary console check verifies this deploy.

## What this deploy changes

**Layout only, plus two read-only elements.** Validation, `cr2bf_RampConfig`
persistence, hydration, and the discrete and zero-transparency semantics are all
unchanged, and **the legend the map draws is untouched**.

The "Add a layer" form's style section is now a nested **Layer style** card:

- a context line naming the field, its value range and its distinct-value count
- a two-column grid, capped at 1100px
- **left, in decision order:** Class breaks (mode radios, then a
  number-of-classes stepper), Colours, Options
- **right, always visible:** the live legend, and one bar per class over its
  feature count

In manual mode the break inputs became **class rows**: colour, the edge you can
move, and a live count. The last row's upper bound is the data maximum and is not
editable, because the top class ends where the data ends.

### The live preview is the real legend

It is rendered by `mlLegendHtml`, the same function the map calls, fed a
draft-shaped entry. A test renders both and compares the markup, so this is an
assertion rather than a claim. Its `(i)` button is wired by a second delegated
handler, because the map's delegate lives on `#dac-map-panels` and that element
does not exist on the Map Layers page; the panel opens inline beneath the legend
rather than floating, since there is no map here to float over.

The preview sits inside `#ml-style-preview` and carries `data-ml-preview`, so a
query can never confuse it with the legend on the map. That distinguishability is
asserted.

### Where the class range labels went

In computed mode the per-class range labels are no longer listed in the form.
They are in the legend's `(i)` panel and on each bar's tooltip. Deliberate: the
strip shows shape, the live legend shows labels, and duplicating them would
re-clutter what this redesign cleaned.

**No dataset or geometry row was uploaded**, so the hosted data state is
unchanged: `nyserda_dac v1.0` live on `tract_geometry pure-2010`. Existing saved
layers are unaffected -- nothing about how a layer is stored or drawn changed.

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

A rolled-back client reports `build 37eebaba43` and gets the previous single-column
form back.

**This rollback is clean, unlike the previous two.** Nothing about storage or
rendering changed in this deploy, so there is no asymmetry: every layer saved
before or after it reads and draws identically on either build. The only
difference is what the upload form looks like.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed -- check it before and
after a restore.
