# cr2bf_dactest pre-deploy snapshot — 2026-08-27 (CLCPA-144)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the CLCPA-144 deploy. This is the rollback point for it.

Written retroactively on 2026-08-28: the folder was left untracked and without a
README when it was created. Nothing in it was modified — the files are the
originals from `2026-08-27T21:46:22Z` per `manifest.json`.

## Provenance — identified by content, not by deploy order

| step | value |
|---|---|
| `app.js` archived here | 818,688 B, sha256 `2b73073836ba480a…` |
| matched against the last 25 `main` commits | **`bedee7d`** |
| build id that commit stamps | **`483a20777d`** — the CLCPA-200 deploy |

So these bytes are the **CLCPA-200 build**, and this folder is that build's
rollback point. The folder is named for the deploy that *created* it
(CLCPA-144), not for the build it contains — the usual convention, and worth
stating because the two readings differ by one deploy.

Method: take the git blob (LF-normalised), convert LF→CRLF because the deploy
path reads from disk where the file is CRLF, canonicalise the `APP_BUILD`
sentinel to `'dev'`, hash for the build id, re-stamp with that id, then sha256
the result.

## What this deploy shipped (CLCPA-144)

`totalRow` denominator scope, filling the empty percentage columns in G10, J3,
J4, J6 and J7 with the explicit Total row's value as denominator; plus the
one-line editor null fix (178 cells across 11 tables). Verified hosted by the
operator: all five tables filled with the hand-computed values.

It also surfaced the J1/J2 ingest-editor bug (row 1 rendering grey/read-only and
showing row 2's values), fixed the following day as build `97a7ebcfba`.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 818,688 | yes |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 251,610 | no |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes |

Restore by PATCHing `webresourceset({webResourceId})` with the base64 of the
saved file, then `PublishXml`. `manifest.json` carries the ids and sha256s.
