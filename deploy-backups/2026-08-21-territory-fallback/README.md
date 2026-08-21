# cr2bf_dactest pre-deploy snapshot — 2026-08-21 (CLCPA-177 corrective)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

**Source: branch `fix-clcpa-177-territory-fallback` @ `30339aa`, deployed
PRE-MERGE**, at the operator's instruction, because hosted was in a deliberately
degraded state (the territory row deactivated) for the before/after verification
and waiting for a merge round-trip would have prolonged it. PR open at the time of
deploy.

> The deploy script's own log line reads `source: ... at main = 30339aa`. That is
> the script mislabelling itself: it prints `main =` as fixed text and reads
> `HEAD`. `30339aa` was on the branch, not on main. Recorded here so the folder
> does not claim a provenance it does not have. Fixing that label is a follow-up on
> the script, which is a scratch artifact and not committed.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 804,067 | yes → 804,905 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 (`?v=` stamp) |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 251,610 | **no — unchanged** |
| `cr2bf_dactest/map_payload.json` | `9a93efd4-296b-f111-ab0d-7c1e521c7110` | 4,794,147 | **no — and see the finding below** |

## Build ids

| file | id | previous |
|---|---|---|
| `app.js` | **`9a5576f92c`** | `9d6020f8ab` |
| `styles.css` | `384cc2d413` | **unchanged** |

```
[DAC dashboard] build 9a5576f92c
```

## What this deploy changes

The last code path that fetched file-served map data is gone.
`dsFetchTerritoryWebResource` called `fetch('./Data/service_territories.geojson')`
and slice 6e had already **deleted** that web resource, so live code pointed at a
404. Slice 5d's acceptance — *no code path may fetch `map_payload.json` or any
file-served map data* — was signed off while this remained.

Its three callers now refuse with three different reasons, because they are three
different problems: nothing published (upload one), download failed (retryable, and
it is retried), file malformed (names the error, and `rec.loadError` puts the same
text on the Territory overlays card). One message for all three was the mistake 5d
made in its first cut.

### Verified on hosted, before and after, with the overlay row deactivated

| | `9d6020f8ab` (before) | `9a5576f92c` (after) |
|---|---|---|
| network | `service_territories.geojson` **404** | **0 requests of 363** |
| toast | `service_territories.geojson 404` | `No territory overlay is published. Upload one from Map Layers…` |
| console | fetch error | `no territory overlay is published` |
| checkbox | — | flips itself back off |

The row (`2dc99594-6b97-f111-b8db-000d3a8a80a1`) was PATCHed `IsActive=false` for
the test and PATCHed back to `true` afterwards, verified by read-back both ways.

The difference that matters is not "no outlines" — that was already true. It is
that the message names **an action** instead of a file that no longer exists.

## FINDING: `map_payload.json` is still in the org

Recorded as deleted on 2026-08-14, with a browser 404 confirmed. It is **present**,
id `9a93efd4-296b-f111-ab0d-7c1e521c7110`, and today's deploy read **4,794,147
bytes of its content** — which a deleted row cannot return. Live read of the
`cr2bf_dactest/` prefix on 2026-08-21 shows **8** resources including it.

The other two deletions did take: `Data/hvi_zcta.geojson` and
`Data/service_territories.geojson` are both **absent**.

Most likely mechanism, **unconfirmed**: the resource was removed from the published
set — hence the browser 404 — while the row itself survived. That would explain
both observations without either being wrong. It needs checking in the portal
rather than guessing.

Consequences, all live today:

- **4.8 MB of unread data still ships in the solution** and will travel to any new
  environment. `MIGRATION_READINESS.md` lists it under dead weight as *"safe to
  delete"*, which is still true — but it reads as done, and it is not.
- **`deploy_stamped.js` still lists it in `TARGETS`**, which is why every deploy
  keeps backing up 4.8 MB. Worse, a future deploy that found local bytes differing
  would `PATCH` it — **re-publishing a resource we intend to be gone**.

Fix, in order: remove it from the deploy script's `TARGETS` and `KNOWN` (scratch
artifact, one edit), re-delete the resource in the portal, then re-verify with the
same live read rather than a browser check — a browser 404 did not distinguish
*unpublished* from *deleted*, which is exactly how this got recorded wrong.

## Restoring

`app.js` and `ExecutiveDashboard.html` restore **together** — the HTML's `?v=`
stamp matches only the copy in this folder. `styles.css` and `map_payload.json`
need no action.

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

**Clean rollback, and one thing it brings back.** A rolled-back client reports
`9d6020f8ab` and regains the territory web-resource fallback — a code path that
requests a file which no longer exists. With an overlay published it is unreachable
and harmless; with none published it produces the 404 this deploy removed.

Take the base64 from the files **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The `sha256`
in `manifest.json` is over the bytes as deployed — check it before and after a
restore.
