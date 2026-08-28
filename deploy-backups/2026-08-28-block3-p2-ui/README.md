# cr2bf_dactest pre-deploy snapshot — 2026-08-28 (Block 3 phase 2, UI)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

**Source deployed: branch `main` @ `eedfb5d`** (merge of PR #172,
`block3-p2-ui`, commit `8397c47`), as build **`3af6ee199f`**.

## Provenance of these bytes — verified, not assumed

| step | value |
|---|---|
| `app.js` archived here | 839,383 B, sha256 `8a53677d1a7b2a73…` |
| matched against the last 25 `main` commits | **`eea4703`** |
| build id that commit stamps | **`20daf1a5d6`** — the Block 3 phase 1 deploy |

So this snapshot is the rollback point for the phase 1 build, which Emely
verified hosted (E1 Grand Total 45.3%, F9/J8 stored values, J9 43.7%/56.3%).

`eea4703` is the *backups* commit rather than the phase 1 merge `9df3df3` — the
two are byte-identical in `app.js`, since `eea4703` only added files under
`deploy-backups/`. The content match picks whichever is newest; either is a
correct answer for these bytes.

Method (see the `2026-08-28-block3-p1-derive-routing` README for the full note):
the deploy path reads from disk where `app.js` is **CRLF**, while a git blob is
LF-normalised. Convert LF→CRLF, canonicalise the `APP_BUILD` sentinel to
`'dev'`, hash for the build id, re-stamp, then sha256.

## Build ids deployed

| file | build id | pushed |
|---|---|---|
| `app.js` | **`3af6ee199f`** | yes — 842,166 B (was 839,383 B) |
| `styles.css` | `384cc2d413` | no — byte-identical at 251,610 B |
| `ExecutiveDashboard.html` | — | yes — 11,856 B, `?v=` cache-bust only |

Client check: the console must report `[DAC dashboard] build 3af6ee199f`.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 839,383 | yes |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 251,610 | no |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes |

Restore by PATCHing `webresourceset({webResourceId})` with the base64 of the
saved file, then `PublishXml`. `manifest.json` carries the ids and sha256s.

## What shipped

UI only — **no figure moves anywhere in the payload**, asserted directly by
comparing `rowsForDisplay` output across every table and year against the live
build, plus seven engine functions and four descriptor constants proven
byte-identical.

1. **The client-facing "Not reconciled…" banner is removed** from F9 and J8, its
   only two sites. It named CLCPA-206 and admitted a gap in our own source data,
   in a report read by Con Edison executives. `NOT_RECONCILED_TABLES` survives
   untouched, so both tables still render their stored percentage columns exactly
   as before. The knowledge lives in comments at the render site and on the set,
   both of which say explicitly not to re-add a caveat.

2. **CLCPA-162** — F3's tile caption reads through `getTableSchema` instead of
   indexing `schema_by_year[yr]` directly. The direct read had no fallback for a
   year with no schema entry, so it dropped to a hardcoded literal worded
   *differently* from the real label ("Customers interrupted per 1,000 served"
   vs "Customers Interrupted per 1,000 Customers Served") — the caption quietly
   changed wording on a newly added year instead of inheriting.

3. **CLCPA-158** — the DAC map no longer disappears on a year with no table
   data. Verified rather than argued: `renderDACMap(baseline, year, sections)`
   reads **none** of its three arguments; it is driven wholly by `_mapState` and
   the hydrated tract datasets, which carry no reporting year. The `anyData` gate
   never had a data reason to hide it. The empty-state message stays.

## Open, and deliberately not in this deploy

**CLCPA-143 stays OPEN.** A fourth reader of the derived values was found during
Emely's phase 1 verification and is still unrouted:
`payload.kpis.reported[].values[yr].dac_pct` is **precomputed** and read at two
sites, so for 2025 the KPI card shows **44.0%** while table J9 shows **43.7%** —
a live disagreement on screen. Also `kpis.analytical` → `ev_equity_ratio`'s
narrative hardcodes the string "the DAC share of residential customers (43.5%)",
which is J9/2024's derived share baked into prose and will drift.

Both were added to CLCPA-143's scope so it cannot close green, and both are
figures changes — hence excluded from this UI slice. They are the next figures
slice.
