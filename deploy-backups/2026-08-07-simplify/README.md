# cr2bf_dactest pre-deploy snapshot — 2026-08-07 (simplify the surface)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `62286b6`
(PR #100, "simplify the Map Layers surface"). Pushed and published: **all
three files**.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 671,532 | yes → 673,622 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 239,460 | yes → 239,782 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,165 | yes → 11,165 |

The HTML is the **same length** either side and was still replaced: its content
differs because the `?v=` stamps changed. Length is not identity, which is why
the deploy compares bytes rather than sizes.

## Build id

**`27db48866b`** for `app.js`, **`5323135324`** for `styles.css`.
The snapshot here is the previous build, **`2c65315239`**, which is what a
rolled-back client reports.

## What this deploy changed

UI only, plus one generated-label fix. **No resolver change and nothing was
uploaded**, so the hosted data state is unchanged: `nyserda_dac v1.0` live on
`tract_geometry pure-2010`, `pure-2020` published, `2.0-demo` inactive.

- **The Territory overlays card and every "How to update" opener are hidden**,
  behind `SHOW_TERRITORY_CARD` and `SHOW_HELP_BUTTONS`, both `false` in
  `app.js`. The card, the drawer machinery and all five documentation topics are
  intact; flipping either flag brings them straight back.
- **Tract shapes lists published sets only.** A retired set stays in Dataverse
  untouched, because it is the rollback. It is simply not rendered.
- **The built-in HVI row is genuinely hidden now.** An author `display: flex`
  beat the browser's `[hidden]` rule, so the previous build shipped the
  attribute with no effect; `.dac-map-terr-opt[hidden] { display: none; }` fixes
  it.
- **The source label no longer arrives truncated.** The geometry builder emitted
  433 characters into a 300-character column and the write path cut it silently,
  mid-word. The builder now emits 254 and refuses to emit more, and the upload
  path warns when a label would be cut.

### One thing this deploy does NOT fix

The `tract_geometry` rows already in Dataverse keep their truncated source
labels. Nothing here rewrites stored data. Re-uploading the rebuilt
`pure-2010` and `pure-2020` files carries the shorter labels, and doing so
retires and replaces the current rows.

## Restoring

All three must be restored **together**: `styles.css` styles markup only the new
`app.js` emits, and the HTML's `?v=` stamps only make sense alongside the
`app.js` they were stamped for.

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

A rolled-back client reports `build 2c65315239`. Rolling back brings back the
Territory overlays card, the "How to update" buttons, the retired shape set in
the list, and the visible built-in HVI row. It touches **no** uploaded dataset
or geometry row.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed — check it before and
after a restore.
