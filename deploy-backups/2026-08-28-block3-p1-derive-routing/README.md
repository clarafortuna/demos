# cr2bf_dactest pre-deploy snapshot — 2026-08-28 (CLCPA-143, Block 3 phase 1)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

**Source deployed: branch `main` @ `9df3df3`** (merge of PR #171,
`block3-p1-derive-routing`, commit `f3973fc`). Deployed post-merge; the script's
own log line reads `source: ExecutiveDashboard_dev/ at main @ 9df3df3` and that
label is now read from git rather than retyped, so it is accurate.

## Provenance of these bytes — verified, not assumed

The snapshot's `app.js` was **proven** to be `main @ f1bba98` (merge of PR #170,
the J1/J2 editor strict-totals fix), the build the operator verified hosted as
`97a7ebcfba`:

| step | value |
|---|---|
| `f1bba98` git blob, LF→CRLF converted, sentinel canonicalised | build id **`97a7ebcfba`** |
| sha256 of that stamped output | `8410407d8f476dfe…` |
| sha256 of `app.js` archived here | `8410407d8f476dfe…` |

So the rollback target is identified by content, not by inference from the
deploy order.

**Note for anyone reconstructing a build id from git:** the deploy path reads
from disk, where the file is **CRLF** (16,771 line endings, 0 bare LF). A git
blob is LF-normalised, so hashing `git show <ref>:…app.js` directly yields an id
that never matches any deployed build. Convert LF→CRLF first, then canonicalise
the `APP_BUILD` sentinel to `'dev'`, then hash — that is what reproduced
`97a7ebcfba` above.

## Build ids deployed

| file | build id | pushed |
|---|---|---|
| `app.js` | **`20daf1a5d6`** | yes — 839,383 B (was 827,037 B) |
| `styles.css` | `384cc2d413` | no — byte-identical at 251,610 B |
| `ExecutiveDashboard.html` | — | yes — 11,856 B, `?v=` cache-bust only |

Client check: the console must report `[DAC dashboard] build 20daf1a5d6`.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 827,037 | yes |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 251,610 | no |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes |

Restore by PATCHing `webresourceset({webResourceId})` with the base64 of the
saved file, then `PublishXml`. `manifest.json` carries the ids and sha256s.

## What shipped

CLCPA-143 as widened to E/F/G/J: three read sites (`getJData`'s `get()`,
`readPair`, `parseE1Categories`) now read derived display values instead of
stored cells; a `weightedMean` derivation type with E1's rule; `totalRow`
denominator scope for G10 and J3/J4/J6/J7 plus J7's rule; a `hasNonTotalRows`
guard; `NOT_RECONCILED_TABLES = {F9, J8}`; and `PERSIST_STRIP_TABLES` extended
from 8 to 25 tables with `stripDerivedForPersist` made self-limiting.

Figures that moved (all asserted against stored values, not merely against
"not a dash"): E1 Grand Total 2023/24/25 → 0.3991/0.4987/0.4528; F9 Grand Total
cols 2/4 → the stored pairs; J8 col 3 → the stored strings; J9/2023 cols 2/4 →
0.4331/0.5669; G3 and G5 2024 borough cards → derived. Frozen and asserted:
G1–G9, A5–A8, J1, J2.

## Gap this snapshot closes

`deploy-backups/` previously ended at `2026-08-27-clcpa-144`. Identifying each
snapshot by content (the LF→CRLF + canonicalise + hash method above) rather than
by folder name gives the real picture:

| build | deploy | rollback snapshot |
|---|---|---|
| `483a20777d` (CLCPA-200, `bedee7d`) | 2026-08-27 | **`2026-08-27-clcpa-144`** — that folder holds *this* build's bytes |
| `647646a28d` (basemap Esri swap) | 2026-08-27 | **none** — superseded, low value |
| `97a7ebcfba` (editor-strict, `f1bba98`) | 2026-08-27 | **`2026-08-28-block3-p1-derive-routing`** — this folder |

So the only build without a rollback point is the basemap swap, which was itself
superseded by `97a7ebcfba` hours later. **The mechanism is unconfirmed** — the
deploy script's `BACKUP_DIR` was
found pointing at `2026-08-27-editor-strict-totals`, a folder that does not
exist, which is not consistent with a run that reached the archive step, so
something other than the plain stale-name bug happened and it is not worth
reconstructing from here. What matters going forward: **the folder's existence
is the only evidence a snapshot was taken**, and the script's guard only refuses
to *overwrite* one — it never checks that the previous deploy left one behind.

**Naming lesson:** a snapshot folder is named for *the deploy that created it*,
so it holds the bytes of the build **before** that deploy. Read the folder name
as "the rollback point for what shipped on this date", never as "a copy of what
this date's deploy pushed". Identify by content when it matters.
