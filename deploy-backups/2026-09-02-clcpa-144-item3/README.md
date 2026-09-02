# cr2bf_dactest pre-deploy snapshot, 2026-09-02 (CLCPA-144 item 3)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

**Source deployed: branch `main` @ `c115db4`** (merge of PR #176,
`clcpa-144-hierarchy-derived`, commit `5cac24f`), as build **`cd652d8419`**.

## Provenance of these bytes, verified rather than assumed

| step | value |
|---|---|
| `app.js` archived here | 849,060 B, sha256 `7893fb9d4865f398...` |
| matched against the last 25 `main` commits | **`0aa8156`** |
| build id that commit stamps | **`0ca68491c6`**, the CLCPA-205 item 1 deploy |

Method: the deploy path reads from disk where `app.js` is CRLF, while a git blob
is LF-normalised. Convert LF to CRLF, canonicalise the `APP_BUILD` sentinel to
`'dev'`, hash for the build id, re-stamp, then sha256.

## Build ids deployed

| file | build id | pushed |
|---|---|---|
| `app.js` | **`cd652d8419`** | yes, 853,888 B (was 849,060 B) |
| `styles.css` | `384cc2d413` | no, byte-identical at 251,610 B |
| `ExecutiveDashboard.html` | n/a | yes, 11,856 B, `?v=` cache-bust only |

Client check: the console must report `[DAC dashboard] build cd652d8419`.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 849,060 | yes |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 251,610 | no |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes |

`cr2bf_dactest/payload.json` was not a target and is not in this snapshot.

Restore by PATCHing `webresourceset({webResourceId})` with the base64 of the
saved file, then `PublishXml`. `manifest.json` carries the ids and sha256s.

## What shipped: CLCPA-144 item 3

`applyDerivedCols` is now hierarchy-aware on segment total rows. A total row's
derived cell used to come from the whole-table `colSum`, so every segment total in
a hierarchical table displayed the table-wide ratio. A5/2025 "Commercial &
Industrial Total" rendered 37.0% where its own segment gives 154/612 = 25.2% and
the stored value is 0.25. Under the ruling that the dashboard reproduces ConEd's
report and the stored values are the reference, the data was right and the derive
was wrong, in the client report.

Each total row's derived cell now comes from its own segment, reusing the
positional rule CLCPA-205 item 1 gave `recomputeTotals`. Positional, not
label-matched, because A5 says "Subtotal" in 2023 and "<segment> Total" later.

**66 cells changed on screen**, across A5, A6, A7 and A8. 62 now agree with the
stored value at 2dp; the other 4 sit within one rounding step of it. The complete
census is in `Coned/CLCPA/tickets/CLCPA-144-item3-evidence.md`.

The scope split, approved as designed: the numerator always comes from the
segment; the denominator comes from the segment only for `denominatorScope: 'row'`
and stays `colSum` for `'total'`, because "share of the table total" is what that
scope means. No table exercises the difference today, so the harness pins it with
a synthetic hierarchical table under G1's real rule.

## Two cells keep their stored value instead of a ratio

| cell | before | after | stored |
|---|---|---|---|
| A6/2025 row 31 | 71.4%, wrong and table-wide | **0** | 0 |
| A7/2025 row 2 | a dash | **0** | 0 |

Both segments hold `null` rather than `0` in the DAC column, so no numerator
exists. Blanking would have put a new dash where the stored value and ConEd's
report both say 0%. The rule is narrow: it applies only to a total row that HAS a
segment, so a whole-table Grand Total still blanks when it cannot derive, which is
the CLCPA-88 behaviour behind the dashes on E1 and F9.

**A7 moves here, and the CLCPA-205 claim still stands.** CLCPA-205 item 1 asserted
A7 byte-identical; that was about `recomputeTotals` and remains true there. This
slice changes `applyDerivedCols`, a different function. A7/2024 is byte-identical
in both slices.

## Provably unchanged, verified rather than argued

Grand total rows (empty segment, `colSum` fallback), 108 flat table-years
including G1-G9, the all-totals tables G10/J3/J4/J6/J7 (scope `'totalRow'`,
handled before this branch, so CLCPA-205 item 2's ruling of no auto-calculation is
untouched), E1 (`weightedMean` returns first), J9/2023, and F9/J8.

F9 and J8 are safe because **neither is in `DERIVED_COLS`**, so `applyDerivedCols`
returns immediately. NOT because of `rowsForDisplay`'s `NOT_RECONCILED` early
return, which actually runs after `applyDerivedCols`. The suite asserts the real
reason and the ordering itself.

## Editor

The editor shares the engine, so A5/2025 row 23 now reads 612 / 154 / 25.2%,
internally consistent for the first time. After item 1 it showed the correct
segment sums in columns 1 and 2 beside a table-wide 37.0% in column 3.

## Harness

`clcpa144_item3_test.js`, 69 assertions with 6 negative controls, baseline pinned
by sha to `0aa8156` and verified in-test to stamp as `0ca68491c6`. All 66 cells
asserted against segment ratios computed independently in the test.

Six other suites carried payload-wide stability censuses that this slice
legitimately breaks, since `applyDerivedCols` is the shared derive engine. Each
was updated to attribute A5/A6/A7/A8 to this slice by name rather than relaxed
into an allowlist. Full sweep at deploy time: 14 suites, 755 assertions, 0
failures.

## Known gap at deploy time

PR #176 merged commit `5cac24f`, the app.js fix, but NOT `bf32238`, which carries
the 66-row evidence document. The document is docs-only and has no effect on this
build, but it was not on `main` when this deploy ran. It remains on the branch
`clcpa-144-hierarchy-derived` and needs a second merge.
