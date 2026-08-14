# cr2bf_dactest pre-deploy snapshot — 2026-08-14 (the payload funeral, slice 5d)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `e640839`,
carrying PR #156 (slice 5d, the payload path removed).

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 802,394 | yes → 804,067 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 250,881 | yes → 251,610 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 (`?v=` stamps) |
| `cr2bf_dactest/map_payload.json` | `9a93efd4-296b-f111-ab0d-7c1e521c7110` | 4,794,147 | **no — and now unread** |

## Build ids

| file | id | previous |
|---|---|---|
| `app.js` | **`9d6020f8ab`** | `da3ba85ac5` |
| `styles.css` | **`384cc2d413`** | `6ea0bb1891` |

```
[DAC dashboard] build 9d6020f8ab
```

## What this deploy changes

**The app no longer fetches `map_payload.json`.** `MAP_BASE` is gone, replaced by
`Storage.isDataverse()` — not a rename, because the old flag asked "compose, or
fetch the file" and the new test asks "compose, or there is no map". That second
question has error states, and building them was most of the slice.

Nothing changes in the normal, fully-populated case, and that is proven rather
than asserted: `payload_funeral_proof.js` booted the **pre-5d** `app.js` and the
**post-5d** `app.js` against identical seeds and compared all 2,333 tracts on
every property and polygon, plus the rendered fills, the KPI block and the legend.
Identical. A negative control altering one value was detected.

### Four states the payload was hiding, now on screen

Each existed before and was invisible because the payload silently drew instead:

| state | what the card now says |
|---|---|
| no Dataverse context | this page is not running inside it, so there is nothing to draw |
| no geometry published | publish a tract geometry dataset from Map Layers |
| geometry published, no dataset active | activate a dataset version — geometry only pairs through the active dataset's vintage |
| vintage mismatch | names which vintages **are** published rather than claiming none are |

The last two were wrong in the first cut of this slice, which printed
"publish geometry" to an operator who already had. Found by probing the states.

### Three regressions 5d introduced and this build fixes

1. a refused, undownloadable or unparseable dataset **blanked the map**. Those
   paths returned early, which was safe only while the payload drew. The record's
   vintage survives a bad file, so the shapes now stay and only the values drop.
2. the coverage gate undid a vintage mismatch by clearing the **geometry**.
   Dropping the **indicators** removes the same mismatch and leaves the map up.
3. with nothing drawn, coverage had nothing to measure — so the **first** indicator
   dataset could not be uploaded into an org that had none, which is exactly the
   fresh-org migration path. The gate is deferred to activation, where it already
   runs, not dropped.

### Two lines of operator copy were false

The extracts card still said the electric and gas figures reach the dashboard by
rebuilding and redeploying `map_payload.json`. Slice 7 changed that and the card
did not. Both corrected; `check_doc_claims` still passes on five surfaces.

## Dataverse state at deploy time — unchanged by this deploy

| key | version | state |
|---|---|---|
| `nyserda_dac` | 1.0 | active |
| `tract_geometry` | pure-2010 | published |
| `tract_geometry` | pure-2020 | published (unstamped, unverified) |
| `service_territories` | 1.0 | published |
| `coned_operational` | 1.0-2010 | published |

## Restoring

All three pushed files restore **together** — the HTML's `?v=` stamps match only
the copies in this folder, and this is the first deploy in a while where
`styles.css` also moved. `map_payload.json` needs no action.

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

**Clean rollback, and one thing it depends on.** A rolled-back client reports
`da3ba85ac5` and fetches `map_payload.json` again — so **the rollback only works
while that web resource still exists.** Once it is deleted, rolling back to
`da3ba85ac5` or earlier gives a client that fetches a 404 and cannot draw.

That is the whole reason for the three soak checks before the delete. If the
payload resource is ever removed, the bytes remain here and in every earlier
backup folder in this series, and restoring the resource is then part of the
rollback.

Take the base64 from the files **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed — check it before and
after a restore.
