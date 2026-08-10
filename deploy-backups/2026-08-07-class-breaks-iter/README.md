# cr2bf_dactest pre-deploy snapshot — 2026-08-07 (class breaks iteration)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `d9e336a`
(PR #120, class breaks iteration: order, selectable count, discrete mode).
Tenth deploy of the day.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 704,583 | yes → 716,425 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 243,379 | yes → 244,151 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 |

The HTML is the same length either side and was still replaced, because the `?v=`
stamps moved with the two files they point at.

## Build ids

| file | id | previous |
|---|---|---|
| `app.js` | **`37eebaba43`** | `fe910a6f8c` |
| `styles.css` | `a865179e2d` | `841e182939` |

Both moved, so the ordinary console check verifies this deploy.

## What this deploy adds

Three changes to the upload card, from first real use on the HVI layer.

**Class Breaks moved above Colour Range.** Breaks are decided before colours; the
card read backwards.

**Selectable class count, 2 to 7.** Five used to be structural rather than a
parameter. The default ramp generalises by SAMPLING the canonical YlOrRd path at
N positions, not by interpolating between its two ends -- a straight line cuts
the corner the ramp bends through and lands on muddy pink-browns. Sampling
returns the canonical colours exactly wherever a position lands on a stop, so
n=5 is the old ramp verbatim and **every layer saved before the count existed is
byte-identical**.

**Discrete mode, offered when a field has 2 to 7 distinct values.** Labels become
the value itself: HVI now reads `1 2 3 4 5` instead of `1 - 1.6`, `1.6 - 2.2`.
For HVI this is a labelling change only -- measured: no feature changes colour
and the per-class counts are identical. For a field with FEWER distinct values
than classes it is more than cosmetic: five classes over three values leaves two
colours that no feature has, and discrete removes them.

A discrete class whose value is 0, on a layer with zero-transparency on, stays
listed and is marked `(not filled)` with a hatched swatch. A legend that silently
omits a value in the data is the same problem as a mislabelled range.

**No dataset or geometry row was uploaded**, so the hosted data state is
unchanged: `nyserda_dac v1.0` live on `tract_geometry pure-2010`.

### For support

The three settings live in `cr2bf_RampConfig` on the layer row: `classCount`,
`manualBreaks`, `discreteValues`, plus `zeroTransparent`. If a layer's classes
ever look different for one reader than another, that column is the first thing
to read, and the legend's mode label states which scale is in force:
`N quantile classes`, `N equal-interval classes`, `N custom classes`, or
`N classes, one per value`.

A saved layer's scale is RECOMPUTED from its file on every load, so the stored
config is what makes the intended cut survive. That is the failure mode the
cross-session test exists to catch, and it is invisible from the uploading
session.

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

A rolled-back client reports `build fe910a6f8c`.

**The rollback asymmetry, same shape as the previous deploy but wider.** Nothing
in Dataverse is touched, so a layer saved with `classCount` other than 5, or with
`discreteValues`, keeps them stored -- and the previous build ignores both. A
7-class layer would come back as 5 with recomputed breaks, and a discrete layer
would come back as quantile ranges. Nothing is lost or corrupted; the keys sit
unread until a build that understands them is deployed again, and re-deploying
restores the intended rendering with **no re-upload**. Layers saved with five
classes and no discrete config are unaffected either way.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed -- check it before and
after a restore.
