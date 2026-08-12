# cr2bf_dactest pre-deploy snapshot — 2026-08-12 (slice 5b, the first payload push)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `2ba1260`
(PR #137, slice 5b: delete the provably dead).

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 726,886 | yes → 727,305 |
| `cr2bf_dactest/map_payload.json` | `9a93efd4-296b-f111-ab0d-7c1e521c7110` | 4,954,060 | yes → **4,794,147** |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 250,293 | **no — unchanged** |

Four files, because this is the first deploy to include the payload. `styles.css`
was byte-identical and skipped; it is archived anyway so the folder is a complete
picture of the live app.

## The first payload push, and why that needed a script change

`map_payload.json` **is** a web resource, but the deploy script's `TARGETS` had
been `['app.js', 'styles.css', 'ExecutiveDashboard.html']` since it was written.
**No earlier deploy could have shipped a payload change**, and nothing said so.
Slice 5b is the first change to touch it, which is how the gap surfaced.

The script now carries it, with two additions specific to a data resource:

- an `UNSTAMPED` list. The payload has no `?v=` stamp -- the app fetches
  `./map_payload.json` directly -- so it ships byte-for-byte off disk rather than
  through `stamp.prepare()`. A target that is neither stamped nor listed now dies
  with an explanation instead of letting `undefined` reach `Buffer.equals`.
- its web resource id in the `KNOWN` cross-check. A 4.8 MB data resource is the
  one target where pushing to the wrong id would be least obvious on screen.

**Read-back is byte equality, not length.** The verify step does
`got.equals(p.local)` over the full content and prints the lengths alongside; the
log line `VERIFIED map_payload.json now=4794147B` means all 4,794,147 bytes came
back identical, not merely that the size matched. This mattered more here than on
any previous deploy.

## The console build id verifies the code half

| file | id | previous |
|---|---|---|
| `app.js` | **`59ec7f6405`** | `5c4f245e5b` |
| `styles.css` | `f9490ed2f1` | **unchanged** |

```
[DAC dashboard] build 59ec7f6405
```

The payload is not stamped, so it has no id of its own. Its check is the sha256
in `manifest.json` against a fresh read, or simply that the tract tooltip still
draws.

## What this deploy changes

Two dead things leave `map_payload.json`. Every deletion rests on a measurement
in `Data/out/MAP_PAYLOAD_DIVERGENCE.md` (slice 5a).

**`hvi`, from 2,117 tracts.** Read at exactly one place in `app.js`, behind
`SHOW_TRACT_HVI_LINE ? p.hvi : null`, and that flag is false -- so the ternary
never evaluated it. The property was already out of the geometry pipeline
(9 fields -> 8). Heat Vulnerability is an uploaded map layer now, carrying its
own provenance and its own tooltip.

**The `nondac_by_county` root block.** One occurrence in `app.js`, inside
`dsApplyGeometryToGeo`, which copied it onto the new FeatureCollection so a
geometry swap would not drop it. Nothing read it back, and `payload.json` -- the
dashboard's separate file, which feeds the borough charts -- does not contain it
at all. It reproduced exactly in 5a, so it was dead rather than divergent.

73 properties per tract become 72. `City_Town` remains non-null on all 2,333
tracts, which is the value the geometry dataset also carries and the one that
cannot be regenerated.

Alongside, in the repo but not deployed: `enrich_hvi.py` is retired and refuses to
run, `build_base_map_payload.py` stops emitting the roll-up and now lists all five
pipeline steps, and `Data/retire_dead_payload_fields.py` is the surgical
instrument that performed the removal.

**Nothing was uploaded to Dataverse tables**, so the hosted data state is
unchanged: `nyserda_dac v1.0` live on `tract_geometry pure-2010`.

## Restoring

`app.js` and `ExecutiveDashboard.html` restore **together** -- the HTML's `?v=`
stamp for `app.js` matches only the copy in this folder. `map_payload.json`
restores independently of them; `styles.css` needs no action.

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

**Clean rollback, with one asymmetry worth knowing.** Restoring the payload puts
`hvi` and `nondac_by_county` back, and the code that read neither is unchanged
either way, so a rolled-back payload is inert rather than wrong. Restoring
`app.js` alone is also safe: it reads neither field. The two halves are
independent, which is unusual for this project and worth stating plainly.

A rolled-back client reports `5c4f245e5b`.

Take the base64 from the files **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed -- check it before and
after a restore.
