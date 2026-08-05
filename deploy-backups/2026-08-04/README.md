# cr2bf_dactest pre-deploy snapshot — 2026-08-04

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the CLCPA-171 slice 3 deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `e1757f1`
(PR #84, slice 3). Pushed and published: `app.js`, `styles.css`.
`ExecutiveDashboard.html` was already current and was **not** touched — it is
captured here anyway so the snapshot is complete.

| Web resource | Web resource id | Bytes | Replaced by this deploy |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 550,803 | yes → 571,965 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 232,871 | yes → 236,432 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 10,738 | no |

`manifest.json` carries the ids, byte counts and SHA-256 of each.

## Why the bodies are committed, and why `.gitattributes` matters

The first instinct was to skip the bodies, since the same *content* is in this
repo's history (`app.js` and `styles.css` as of `7a8f5f8`, the HTML as of
`8d3f842`). That reasoning was wrong, and the trap is worth writing down:

**This repo has `core.autocrlf=true`, so git stores LF while the deployed web
resources hold the CRLF working-tree bytes.** `git show 7a8f5f8:…/app.js` returns
539,636 bytes, not the 550,803 that were live. The content is equivalent and a
LF→CRLF conversion reproduces the live bytes exactly (verified), but a restore
following that route would fail the SHA-256 check in `manifest.json` and leave
whoever is doing it, mid-incident, unsure whether something is corrupt.

Committing the bodies naively hits the same trap from the other side: autocrlf
would normalize them on the way in and hand back LF on checkout. Hence
`deploy-backups/.gitattributes` with `* -text`, which disables EOL conversion for
everything under this directory so the snapshot survives a round trip untouched.

## Restoring

```bash
# 1. Verify the snapshot is intact (must match manifest.json)
sha256sum deploy-backups/2026-08-04/app.js deploy-backups/2026-08-04/styles.css

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

## Note for future captures

The deploy script reports byte counts and SHA-256 for everything it captures.
Always compare a capture against what you expect to be live — if a web resource
was edited by hand in the maker portal, this snapshot is the only copy of that
state, which is the whole reason the archive step exists.
