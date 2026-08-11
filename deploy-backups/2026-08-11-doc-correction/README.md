# cr2bf_dactest pre-deploy snapshot — 2026-08-11 (extracts doc correction)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `221c2d5`,
carrying PR #131 (extracts doc correction) and PR #132 (crosswalk prefix
resolution).

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 726,634 | yes → 726,806 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 250,293 | **no — unchanged** |

`styles.css` was byte-identical to the local copy and skipped by the deploy
script rather than re-pushed. It is archived here anyway, so this folder is a
complete picture of the live app rather than a partial one.

## The console build id verifies this deploy

| file | id | previous |
|---|---|---|
| `app.js` | **`a3d036a476`** | `462e0d769f` |
| `styles.css` | `f9490ed2f1` | **unchanged** |

```
[DAC dashboard] build a3d036a476
```

The Map Layers page footer shows the same id. A rolled-back client reports
`462e0d769f`.

## What this deploy changes

**Two lines of documentation copy.** The Con Edison customer extracts card, on
the Edit map files page, told the operator:

> Upload the file; the data flows in through the upload into the data store.
> **No rebuild and no code change.**

There is no such upload. Verified from code:

- `app.js` has no spreadsheet handling of any kind. The single occurrence of the
  string `xlsx` in it was that documentation line.
- Both file inputs accept `.geojson,.json` only.
- `Electric.xlsx` and `Gas.xlsx` are read by exactly one script,
  `build_base_map_payload.py` (`IN_ELEC` / `IN_GAS`, sheet `Export`), which is
  STEP 0 of the payload pipeline and produces `map_payload.json`. The geometry
  builder depends on them only transitively, through that file, and never reads
  an account or EAP figure.

The card now says the figures reach the dashboard by rebuilding
`map_payload.json` through the payload pipeline and redeploying it, that the
procedure is being validated, and to send the files to the maintainer. It
deliberately does **not** publish a procedure: `map_payload.json` is not
byte-reproducible from its own pipeline, so documenting a rebuild would document
something unvalidated. That divergence is a separate open item.

Also dropped "the only one you maintain directly", which read as self-service
next to the false sentence.

### Reachability, measured

The page is **not** in the sidebar nav (`hidden`, `display: none`, height 0 --
13 of 14 nav items visible) but **is** reachable by typing `#/edit-map-files`,
and clicking the card there opens a dialog containing this text. So the wrong
sentence was deployed and reachable by URL, not by navigation.

### What is NOT in this deploy

Four of the five files changed since the last deploy are repo-only and ship
nowhere:

| file | why it does not deploy |
|---|---|
| `Data/build_pure_geometry_dataset.py` | build script, not a web resource |
| `Data/check_crosswalk_resolution.py` | test, new |
| `Data/check_doc_claims.js` | static guard, new |
| `sources-update-guide.html` | operator doc, newly tracked, not a web resource |

The crosswalk fix (PR #132) therefore has **no runtime effect on the hosted
app**. It changes which NTA equivalency CSV a future geometry build reads, and
both current datasets rebuild byte-identical under it (`pure-2010`
`fab9a605...`, `pure-2020` `5f70c460...`).

**Nothing was uploaded**, so the hosted data state is unchanged: `nyserda_dac
v1.0` live on `tract_geometry pure-2010`.

## Restoring

`app.js` and `ExecutiveDashboard.html` restore **together** -- the HTML's `?v=`
stamp for `app.js` matches only the copy in this folder. `styles.css` needs no
action; the live copy already matches the one here.

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

**Clean rollback.** Documentation copy only: no behaviour, no styling, no
persistence, and nothing about how a layer is stored, classified or drawn. A
rolled-back client reports `462e0d769f` and shows the false upload sentence
again on the Edit map files page.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed -- check it before and
after a restore.
