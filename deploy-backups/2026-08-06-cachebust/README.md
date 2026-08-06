# cr2bf_dactest pre-deploy snapshot — 2026-08-06 (cache-busting + Tract shapes card)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `cb0e984`
(PR #95, "build-id cache-busting, and Tract shapes as its own card").
Pushed and published: **all three files**.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 651,441 | yes → 653,573 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 238,014 | yes → 238,382 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 10,738 | yes → 10,764 |

Second snapshot of 2026-08-06, after `2026-08-06-pure-vintage/`. Each keeps its
own folder because restoring an earlier one would roll back the deploys made
since it.

## Build id

**`7f54c517b4`** for `app.js`, **`bb644ba899`** for `styles.css`.

This is the first deploy that stamps. The HTML now references its subresources
with those ids:

```
<link rel="stylesheet" href="styles.css?v=bb644ba899">
<script src="app.js?v=7f54c517b4"></script>
```

and `app.js` carries the same id in a sentinel it prints at boot:

```
[DAC dashboard] build 7f54c517b4
```

The Map Layers page shows it at the bottom. **Confirming a client reports that
id is now a required step of the deploy ritual**, because a deploy verified on
the server says nothing about which build a browser is running: a client
previously held a three-generation-old `app.js` across several deploys, and
identifying it took archaeology on renamed strings.

The ids are `sha256(file)[0:10]` computed by `Data/stamp_build.js` over the
canonical unstamped file. The repo copies are never stamped, so a locally served
build reports itself as `dev` rather than impersonating a deploy.

## What this deploy changed

- `ExecutiveDashboard.html` — `?v=<id>` on the `app.js` and `styles.css`
  references. **This file will now be pushed on every deploy that changes
  either of them**, because its stamped content genuinely differs. That also
  refreshes its own `modifiedon`/ETag each time.
- `app.js` — the build sentinel and the boot log; Tract shapes split out of the
  Tract datasets card into its own sibling card, `renderGeomCard`.
- `styles.css` — the build-id footer style, and the removal of the inset divider
  the Tract shapes section used to need when it lived inside another card.

No Dataverse schema change, and no dataset was uploaded.

## Restoring

All three must be restored **together**. `styles.css` styles markup that only
the new `app.js` emits, and the stamped HTML points at `?v=` URLs that only make
sense alongside the app.js they were stamped for.

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
{ "ParameterXml": "<importexportxml><webresources><webresource>{<webResourceId>}</webresource>…</webresources></importexportxml>" }
```

Note the restored HTML has **no** `?v=` stamps and the restored `app.js` reports
`build dev`, since those bytes predate stamping. That is correct for a rollback,
but it means the client check described above does not apply to a rolled-back
build: fall back to the older tell, the `live:` chip wording.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed — check it before and
after a restore.
