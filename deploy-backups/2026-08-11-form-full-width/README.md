# cr2bf_dactest pre-deploy snapshot — 2026-08-11 (full-width style grid, CSS only)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `37388a8`
(PR #126, full-width style grid).

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 248,985 | yes → 249,373 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 |
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 726,216 | **no — untouched** |

`app.js` is archived here anyway, so this folder is a complete picture of the
live app rather than a partial one.

## The console build id does NOT verify this deploy

| file | id | previous |
|---|---|---|
| `app.js` | `53e3dffcda` | **unchanged** |
| `styles.css` | **`ced0a4df4c`** | `352d4448b7` |

CSS only, so `app.js` hashes to exactly what it did before and the console prints
`build 53e3dffcda` either side. Check the stylesheet stamp:

```js
document.querySelector('link[href*="styles.css"]').getAttribute('href')
// -> styles.css?v=ced0a4df4c   (rolled back: styles.css?v=352d4448b7)
```

Fourth CSS-or-HTML-only deploy in a row where this applies. The console id
verifies `app.js` and nothing else.

## What this deploy changes

The layer upload form's style grid now fills the card. The result column
("ON THE MAP" and "YOUR DATA") is a fixed 340px pinned against the card's right
edge, and the decision column absorbs the whole difference -- so the COLOURS
gradient strip is the only element that grows or shrinks with the window.

**CSS only: no markup, no behaviour, no persistence, and nothing about how a
layer is stored or drawn.**

Measured 1280 -> 1920:

| what | 1280 | 1920 | flexes? |
|---|---|---|---|
| grid | 948 | 1588 | yes, equals card content width |
| decision column | 586 | 1226 | yes |
| **gradient strip** | **304** | **944** | **yes -- the only control that does** |
| result column | 340 | 340 | no |
| manual class row | 420 | 420 | no |
| break input | 92 | 92 | no |

### Three positions on the cap, recorded so it is not relitigated

- capping the **card** made it narrower than every other card and opened dead
  space beside it
- capping the **grid** moved the dead space inside the card, to whichever side
  the leftover width fell
- **no cap** is correct, because nothing in the decision column stretches badly:
  the break inputs and the stepper are fixed, and a wide gradient is easier to
  pick from

The one genuine exception is the manual class row, whose count column would
stretch. It is capped at 420px per ROW -- the thing that would look wrong --
rather than on the whole grid.

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

A rolled-back client reports `styles.css?v=352d4448b7` and gets the grid capped
at 1100px again, with the result column short of the card's right edge at wide
viewports.

**Clean rollback.** Nothing about storage or rendering changed, so every saved
layer reads and draws identically on either build and the map is unaffected.
Confirm a rollback by the stylesheet stamp, not by a build id.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed -- check it before and
after a restore.
