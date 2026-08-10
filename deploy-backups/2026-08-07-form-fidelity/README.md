# cr2bf_dactest pre-deploy snapshot — 2026-08-07 (layer form fidelity, CSS only)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `74d0edf`
(PR #124, layer form fidelity). Twelfth deploy of the day.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 248,370 | yes → 248,985 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 |
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 726,216 | **no — untouched** |

`app.js` is archived here anyway, so this folder is a complete picture of the
live app rather than a partial one.

## The console build id does NOT verify this deploy

| file | id | previous |
|---|---|---|
| `app.js` | `53e3dffcda` | **unchanged** |
| `styles.css` | **`352d4448b7`** | `b21d855626` |

CSS only, so `app.js` hashes to exactly what it did before and the console still
prints `build 53e3dffcda` either side. Check the stylesheet stamp instead:

```js
document.querySelector('link[href*="styles.css"]').getAttribute('href')
// -> styles.css?v=352d4448b7   (rolled back: styles.css?v=b21d855626)
```

Third time this has come up. The console id verifies `app.js` and nothing else.

## What this deploy changes

Two visual deviations from the approved mockup, in the layer upload form. **CSS
only: no markup, no behaviour, no persistence, and nothing about how a layer is
stored or drawn.**

**1. The 1100px cap moved from the card to the inner grid.** It had been on
`.ml-style`, which made the style card narrower than every other card on the page
and left dead space beside it. It now constrains the two-column grid, centred,
and the card fills its column like its neighbours.

Measured at four viewports. The space beside the card is a constant 32px at every
width, which is the block's own padding rather than a gap:

| viewport | card body | style card | gap beside card | grid | gutters |
|---|---|---|---|---|---|
| 1280 | 1010 | 978 | 32 | 948 | 1 / 1 |
| 1440 | 1170 | 1138 | 32 | 1100 | 5 / 5 |
| 1600 | 1330 | 1298 | 32 | 1100 | 85 / 85 |
| 1920 | 1650 | 1618 | 32 | 1100 | 245 / 245 |

At 1280 the cap does not bite; from 1440 up it holds at 1100 and centres. Before
the fix, at 1600 the card was 1100 inside a 1330 body -- a 230px dead strip.

**2. The class-mode radios are vertical.** They are a decision list, and in a row
they read as three unrelated toggles.

**Nothing was uploaded**, so the hosted data state is unchanged: `nyserda_dac
v1.0` live on `tract_geometry pure-2010`.

## Restoring

`styles.css` and `ExecutiveDashboard.html` restore **together** -- the HTML's
`?v=` stamp for the stylesheet matches only the copy in this folder. `app.js`
needs no action; the live copy already matches the one here.

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

A rolled-back client reports `styles.css?v=b21d855626` and gets the narrower
style card with the dead space beside it, and the horizontal radios back.

**Clean rollback.** Nothing about storage or rendering changed, so every saved
layer reads and draws identically on either build, and the map is unaffected.
Confirm a rollback by the stylesheet stamp, not by a build id.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed -- check it before and
after a restore.
