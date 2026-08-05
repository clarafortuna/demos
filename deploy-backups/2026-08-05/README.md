# cr2bf_dactest pre-deploy snapshot — 2026-08-05

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the tract-dataset deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `ed2e7c3`
(PR #86, "move the NYSERDA per-tract indicators to versioned Dataverse
datasets"). Pushed and published: `app.js`, `styles.css`.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 571,965 | yes → 621,220 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 236,432 | yes → 236,797 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 10,738 | no — already current |

All three bodies match `e1757f1` (PR #84, CLCPA-171 slice 3) **modulo line
endings** — see below for why that is not good enough to skip storing them.

## The tract dataset is not in here, and not in the deploy

`Data/out/nyserda_dac_v1_0.json` is **not a web resource**. It is uploaded
through the Tract datasets admin card so that it lands in Dataverse, which is the
entire point of the change. Rolling these web resources back does not touch any
uploaded dataset record; to revert the *data* side, deactivate the dataset version
and the app falls back to `map_payload.json` on its own.

## Why the bodies are committed

This repo has `core.autocrlf=true`, so git stores LF while the deployed web
resources hold the CRLF working-tree bytes. `git show e1757f1:…/app.js` returns
**560,402** bytes, not the 571,965 that were live (the difference is exactly the
11,563 line endings). A LF→CRLF conversion does
reproduce them exactly (verified for all three files), but a restore down that
route fails the SHA-256 check in `manifest.json` and leaves whoever is mid-incident
unsure whether the file is corrupt.

Committing them naively hits the same trap from the other side, since autocrlf
would normalize on the way in and hand back LF on checkout. `deploy-backups/
.gitattributes` therefore sets `* -text`, which disables EOL conversion for
everything under this directory.

## Restoring

```bash
# 1. Verify the snapshot is intact (must match manifest.json)
sha256sum deploy-backups/2026-08-05/app.js deploy-backups/2026-08-05/styles.css

# 2. For each resource, PATCH the content as base64 with header  If-Match: *
#    PATCH {org}/api/data/v9.2/webresourceset({webResourceId})
#    body: { "content": "<base64 of the file>" }

# 3. Publish
#    POST {org}/api/data/v9.2/PublishXml
#    body: { "ParameterXml": "<importexportxml><webresources>
#             <webresource>{id}</webresource>…</webresources></importexportxml>" }

# 4. Read back and confirm the bytes match before declaring success.
```

Auth is the device-code flow recorded in the `dac-dactest-deploy` project note
(public client `51f81489-12ee-4a9e-aaae-a2591f45987d`, scope
`{org}/.default offline_access`).
