# cr2bf_dactest pre-deploy snapshot — 2026-08-11 (legend tick alignment)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `c417816`
(PR #129, legend tick alignment).

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 726,216 | yes → 726,634 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 249,373 | yes → 250,293 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 |

All three replaced. The HTML is the same length either way: only its two `?v=`
stamps changed.

## The console build id DOES verify this deploy

`app.js` changed, so for the first time in four deploys the boot line is the
check:

| file | id | previous |
|---|---|---|
| `app.js` | **`462e0d769f`** | `53e3dffcda` |
| `styles.css` | **`f9490ed2f1`** | `ced0a4df4c` |

```
[DAC dashboard] build 462e0d769f
```

The Map Layers page footer shows the same id. A rolled-back client reports
`53e3dffcda` and `styles.css?v=ced0a4df4c`.

## What this deploy changes

The min/max tick labels under a layer legend's swatch strip now sit at the
strip's actual ends at **any** class count from 2 to 7.

They had been a sibling row whose width was `calc(5 * 18px + 4 * 3px)` — a
second copy of the swatch geometry, correct at five classes and nowhere else.
Measured before the fix, offsets from the strip's real ends:

| classes | strip | ticks row | min tick | max tick |
|---|---|---|---|---|
| 2 | 39px | 102px | −2.7 | **+60.3, past the last swatch** |
| 3 | 60px | 102px | −2.7 | **+39.3** |
| 4 | 81px | 102px | −2.7 | **+18.3** |
| 5 | 102px | 102px | −2.7 | −2.7 |
| 6 | 123px | 102px | −2.7 | **−24** |
| 7 | 144px | 102px | −2.7 | **−44.7, the reported defect** |

No class count was actually correct: the min tick was 2.7px off at every one,
including five, because the row's `22px` left margin was a guess at the width of
the "Low" label.

`mlLegendHtml` renders both the map legend and the upload form's live preview,
so the map legend carried the identical offset — measured at seven classes,
strip 144 against a 102px tick row — and one function fixed both surfaces.

**The fix removes the arithmetic rather than correcting it.** The ticks are now
a child of the swatch strip at `left: 0; right: 0`, so the row is the strip's
box by construction and no class count or swatch width is restated anywhere.
Being out of flow they also cannot widen the strip: a long max label overflows
to the right of the last swatch instead of stretching the ramp to fit itself.

Two consequences of the restructure, both measured rather than eyeballed:

- `.ml-legend-scale` moved to `align-items: flex-start`, since the swatch row
  now carries the tick row and centring would drop `Low`/`High` by half the
  ticks' height. The labels get `line-height: 10px`, the swatch height, which
  centres them on the swatches exactly as before — label-centre-vs-swatch-centre
  delta **0**.
- A `13px` bottom margin on the strip reserves the out-of-flow row's vertical
  space. Clearance to the source line is **3px**, unchanged.

After, at every class count, on both surfaces, min and max offsets are **0**.
All four tick paths were checked, since `discrete` and `single` relabel the ends.

**Markup and CSS only: nothing about how a layer is stored, classified or drawn,
and no change to `cr2bf_RampConfig`.**

**Nothing was uploaded**, so the hosted data state is unchanged: `nyserda_dac
v1.0` live on `tract_geometry pure-2010`.

## Restoring

All three restore **together** — the HTML's `?v=` stamps match only the copies
in this folder.

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

**Clean rollback.** Nothing about storage or rendering changed, so every saved
layer reads and draws identically on either build. A rolled-back client shows
the max tick 45px inside the last swatch again at seven classes.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed — check it before and
after a restore.
