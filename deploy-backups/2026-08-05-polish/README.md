# cr2bf_dactest pre-deploy snapshot — 2026-08-05 (polish slice)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the polish deploy. This is the rollback point for it.

Second snapshot of 2026-08-05. The `2026-08-05/` folder is the rollback point for
this morning's tract-dataset deploy and is deliberately left untouched; restoring
that one would undo the tract-dataset build as well.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `6294585`
(PR #89, "restore the detail box's two-column zone layout", on top of PR #88,
"client-facing dataset copy, a mount guard, and a vintage-guard fixture").
Pushed and published: `app.js` only.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 621,220 | yes → 622,639 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 236,797 | no, already current |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 10,738 | no, already current |

`styles.css` and `ExecutiveDashboard.html` are archived even though this deploy
did not replace them, so the folder is a complete picture of what was live at
that moment rather than a partial one.

## What this deploy changed

Only `app.js`:

- the Tract datasets card rewritten for a ConEd reader (no script names, no
  `map_payload.json`, no "dataset key")
- `mountDACMap` re-resolves its container after `await getMapGeo()` and the call
  site catches, fixing an `Uncaught (in promise) Error: Map container not found`
  that was **pre-existing on main**
- the detail box's missing `</div>` on `.dac-td-zone`, which had been stacking
  the Environmental Burden and Population Vulnerability zones instead of showing
  them side by side

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

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed — check it before and
after a restore.
