# cr2bf_dactest pre-deploy snapshot — 2026-08-05 (Phase 1, slices 1-2)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the Phase 1 geometry-dataset deploy. This is the rollback point for it.

Third snapshot of 2026-08-05, after `2026-08-05/` (tract datasets) and
`2026-08-05-polish/` (client copy, mount guard, detail-box layout). Each keeps
its own folder because restoring an earlier one would roll back the deploys in
between as well. To undo only this deploy, restore from **this** folder.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `00c13ee`
(PR #91, "CLCPA Phase 1 slices 1-2: tract geometry as a vintage-paired
dataset"). Pushed and published: `app.js`, `styles.css`.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 622,639 | yes → 645,236 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 236,797 | yes → 238,014 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 10,738 | no, already current |

`ExecutiveDashboard.html` is archived even though this deploy did not replace
it, so the folder is a complete picture of what was live at that moment rather
than a partial one.

## What this deploy changed

**`app.js`** — the geometry dataset family:

- `tract_geometry` as a second `DatasetKey` family in `cr2bf_dactractdataset`,
  with a `kind` discriminator in the manifest and a validator of its own
- geometry paired by vintage to the active indicator dataset, resolved before
  the coverage gate, with the payload as the fallback whenever no geometry
  family exists
- a generation counter on the geo cache, so a build started before a geometry
  change can no longer overwrite the newer geo when it lands
- the dataset card's refusal and warning notices are dismissable, clear on a
  new file choice and on re-entering the page, and warnings now render in the
  refusal state alongside the errors

**`styles.css`** — the close button on those notices and the Tract shapes
section. Without it the close button renders unstyled and the shapes section
loses its divider, so the two files must be deployed together.

**No Dataverse schema change.** No new table, no new columns. The geometry
dataset file itself is uploaded through the admin card, not as a web resource.

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

Restore `app.js` and `styles.css` **together**: the older `app.js` does not
render the new markup the newer CSS styles, and the newer `app.js` needs the
newer CSS.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed — check it before and
after a restore.

Rolling back the web resources does **not** delete any `tract_geometry` row
uploaded through the admin card. The restored build simply does not know about
that family, ignores the row, and draws the payload geometry as before.
