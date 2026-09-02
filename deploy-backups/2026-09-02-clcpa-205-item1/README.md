# cr2bf_dactest pre-deploy snapshot, 2026-09-02 (CLCPA-205 item 1)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

**Source deployed: branch `main` @ `ab9742f`** (merge of PR #175,
`clcpa-205-hierarchy-totals`, commit `39072d8`), as build **`0ca68491c6`**.

## Provenance of these bytes, verified rather than assumed

| step | value |
|---|---|
| `app.js` archived here | 844,747 B, sha256 `f56431a3432874b1...` |
| matched against the last 25 `main` commits | **`4a26204`** |
| build id that commit stamps | **`342094b187`**, the CLCPA-143 item (a) deploy |

Method: the deploy path reads from disk where `app.js` is CRLF, while a git blob
is LF-normalised. Convert LF to CRLF, canonicalise the `APP_BUILD` sentinel to
`'dev'`, hash for the build id, re-stamp, then sha256.

## Build ids deployed

| file | build id | pushed |
|---|---|---|
| `app.js` | **`0ca68491c6`** | yes, 849,060 B (was 844,747 B) |
| `styles.css` | `384cc2d413` | no, byte-identical at 251,610 B |
| `ExecutiveDashboard.html` | n/a | yes, 11,856 B, `?v=` cache-bust only |

Client check: the console must report `[DAC dashboard] build 0ca68491c6`.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 844,747 | yes |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 251,610 | no |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes |

`cr2bf_dactest/payload.json` was not a target and is not in this snapshot.

Restore by PATCHing `webresourceset({webResourceId})` with the base64 of the
saved file, then `PublishXml`. `manifest.json` carries the ids and sha256s.

## What shipped: CLCPA-205 item 1

`recomputeTotals` is now **hierarchy-aware**. It used to compute one column sum
over all non-total rows and write it into every total row, which is right for a
flat table with a single Total row and wrong for a hierarchical one. A5/2025 has
nine segment totals and all nine received 27,834 where the real values are 76, 2,
518, 612, 43, 2310, 527, 23715 and 31. The rows render grey in the editor so
nobody saw it, but the wrong sums sat in the draft and any Save persisted them.

Each total row now sums only its own segment: the non-total rows between it and
the previous total row. Positional, not label-matched, because the labels are not
consistent even within one table (A5 uses "Subtotal" in 2023 and
"<segment> Total" in 2024 and 2025).

An **empty segment keeps the whole-table sum**, which is what makes the change
safe rather than merely different:

| class | result |
|---|---|
| A5, A6, A8 segment totals | own segment sum, **137 cells corrected** |
| A5, A6, A8 grand total row | empty segment, unchanged |
| A7 | unchanged, only one non-empty segment so it was already correct |
| flat tables including G1-G9 | unchanged, one segment is the whole table |
| all-totals G10, J3, J4, J6, J7, J8 | unchanged, CLCPA-205 item 2 untouched |

Exposure measured, not assumed: A5, A6 and A8 across 2023, 2024 and 2025.

| table | 2023 | 2024 | 2025 |
|---|---|---|---|
| A5 | 20 | 16 | 18 |
| A6 | 10 | 10 | 9 |
| A8 | 16 | 18 | 12 |

## Three corrections to the ticket, verified by simulation

- **G1-G9 are NOT exposed.** Every year has 0 or 1 total row. G1/2023 and
  G1/2024 have **zero**, the same null-feet hole recorded in CLCPA-208.
- **A7 is structurally multi-total but coincidentally correct.** Only one segment
  is non-empty, so the whole-table sum already matched. Asserted unchanged.
- **The exposed set is A5, A6, A8.**

Full text in `Coned/CLCPA/tickets/CLCPA-205-item1-ticket-corrections.md`.

## Containment set shipped with this deploy

`RECOMPUTE_TOTALS_EXEMPT = {D2, D3, D4, F7}`. Those four are not hierarchical:
their DATA rows carry labels containing "total", the loose editor predicate
classified them as total rows, and the editor overwrote real magnitudes with a sum
of the percentage rows. **12 table-years, 74 cells**, from merely opening a table:

| table | row | stored | pre-fix editor wrote |
|---|---|---|---|
| D2/2025 | `Total # of projects` | 88,150 | 0.688 |
| D3/2025 | `Total # of subscribers` | 20,679 | 0.441 |
| D4/2025 | `Total MW installed` | 775.8 | 0.709 |
| F7/2025 | `% of Grand Total` | `"32%"` | 167965 |

None of the four has a `DERIVED_COLS` rule, so `recomputeTotals` is now a complete
no-op for them. **INTERIM**: the predicate ticket **CLCPA-209** removes this set.

## Known defect this deploy does NOT fix

The derived percentage column on segment totals is also hierarchy-blind, but in
`applyDerivedCols`, which the **report** shares with the editor. A5/2025 row 23
"Commercial & Industrial Total" **displays 37% where its own segment gives 25%**,
and the stored value is 0.25, so the source data is right and the derive is wrong.
**63 cells across 9 table-years in A5, A6, A8, visible in the delivered client
report.**

Ruled 2026-09-02 as **CLCPA-205 item 3**, homed in **CLCPA-144** as
hierarchy-aware derived columns, to run as its own slice after this deploy
verifies, with a before-and-after table of all 63 cells as PR evidence. Item 1
asserts the current behaviour unchanged, so **the 37% stays until that slice**.

## Harness

`clcpa205_test.js`, 95 assertions with 7 negative controls, baseline pinned by sha
to `4a26204` and verified in-test to stamp as `342094b187`. A5's every total row
checked against segment sums computed independently in the test; 108 flat
table-years byte-identical; all-totals tables byte-identical with additive cells
still equal to stored; the four contained tables proven complete no-ops with
controls showing the pre-fix engine corrupting them.

Extraction was also consolidated into `app_extract.js` after a fourth suite break
caused by a shipped function gaining a collaborator that a suite's own dependency
list did not name. Six suites now share one tolerant extractor. Full sweep at
deploy time: 13 suites, 692 assertions, 0 failures.
