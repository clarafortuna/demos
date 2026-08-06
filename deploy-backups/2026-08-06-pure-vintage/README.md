# cr2bf_dactest pre-deploy snapshot — 2026-08-06 (Phase 1 slice 3, pure-vintage geometry)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the slice 3 deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `759bbb0`
(PR #93, "Phase 1 slice 3: pure 2010 geometry, and the change document").
Pushed and published: `app.js` only.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 645,236 | yes → 651,441 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 238,014 | no, already current |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 10,738 | no, already current |

Unlike the previous deploy, this one moves `app.js` alone: slice 3 touched no
CSS and no markup. The other two are archived anyway so the folder is a
complete picture of what was live, not a partial one.

## Nothing visible changed

This deploy ships the pure-vintage geometry **engine**, not any pure-vintage
geometry. The hosted map still draws the `mixed-2020-2010` hybrid, because that
is still the only published `tract_geometry` version, and no dataset was
uploaded as part of this deploy. The new code paths are live but dormant:

- the vintage-aware guard wording, which under mixed geometry produces exactly
  the sentences it produced before
- `dsRepairGeometryPairing`, which only fires when a geometry upload changes
  the pairing
- the one-published-geometry-per-vintage sweep, which only fires on upload
- support for a ninth `neighborhoodSource` property column, which the hybrid
  does not carry

The canary for "nothing was uploaded" is the neighborhood filter: **231 options
with the hybrid**. 277 would mean pure 2010 is live and the 129 tracts have
gained names, which is a separate, explicitly gated step.

## What the deployed app.js adds

- pure-vintage geometry support, with names resolved per tract from the newest
  crosswalk holding the key and the resolution recorded in `neighborhoodSource`
- one published geometry per vintage, enforced at upload, after the file is
  verified, so a failed upload can never retire the incumbent
- guard messages that describe the geometry actually drawn instead of assuming
  the hybrid, leaving the mixed wording byte-identical
- a fix for silent data reversion: swapping geometry discards the cached geo,
  and the indicator values had been merged into it, so the pairing is now
  re-established in full after a geometry change

## Restoring

For each row, PATCH the content back and publish:

```
PATCH https://org9076e69b.crm.dynamics.com/api/data/v9.2/webresourceset(<webResourceId>)
If-Match: *
Content-Type: application/json

{ "content": "<base64 of the saved file>" }
```

then

```
POST https://org9076e69b.crm.dynamics.com/api/data/v9.2/PublishXml
{ "ParameterXml": "<importexportxml><webresources><webresource>{<webResourceId>}</webresource></webresources></importexportxml>" }
```

Only `app.js` needs restoring to undo this deploy; the other two were not
touched. The `styles.css` in this folder is already the version the restored
`app.js` expects, since slice 3 did not change it.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed — check it before and
after a restore.

Rolling back does not delete any dataset row uploaded through the admin card.
The restored build simply does not understand a ninth property column or a
pure-vintage geometry version; it would keep drawing the hybrid.
