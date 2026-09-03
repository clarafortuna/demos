# CLCPA-212: ingest editor reports unsaved changes with no user edits, and can persist recomputed values over stored ones

**Type:** Bug
**Priority:** High (the write path), Low (the badge)
**Component:** ExecutiveDashboard ingest editor
**Found:** 2026-09-03, hosted verification of build `e6d7903772` (CLCPA-209)
**Related:** CLCPA-209 (found during its verification, not caused by it), CLCPA-207 (A2/2023), CLCPA-206 (F9), CLCPA-142 (the override contamination this could recreate), CLCPA-213 (rides the same deploy)

## Summary

Opening a table in the ingest editor shows the "Unsaved changes" badge with Reset and Save active, with no user edit. In **70 of 149 table-years**. For **9 of those**, pressing Save would persist values differing from what the source stored, including a 10x error on a client-facing table and a silent overwrite of a figure that is an open question to ConEd.

## Cause

`renderIngestTable` calls `recomputeTotals(i.draft, ...)` and then `recomputeDirty()`. `recomputeDirty` diffs the draft against `i.baseline`, which is the **stored** rows. `recomputeTotals` mutates the draft on every render, so any cell it changes makes the editor look edited.

Most differences are precision only: the payload stores rounded derived values (`0.47`) and the engine recomputes full precision (`0.4700723281104107`).

It is **not** triggered by cell focus.

## Two defects, separable

### Defect 1: the badge (cosmetic, but it invites a harmful Save)

70 of 149 table-years. Harmless in itself for the 61 where a Save writes nothing, but it trains the operator to ignore the badge, and on 9 tables the Save is not harmless.

**Proposed fix:** recompute the baseline once in `loadIngestDraft`, and have `recomputeDirty` compare against that recomputed reference. The badge then reflects user edits only.

### Defect 2: a Save can persist recomputed values over stored ones (the real bug)

9 table-years. `recomputeTotals` writes an additive column sum into any row it classifies as a total, for every column without a `DERIVED_COLS` rule -- **including percentage columns**, which do not sum.

| table-year | cell | stored | would persist | severity |
|---|---|---|---|---|
| F9/2025 | r6c4 `Grand Total`, `Non-DAC % of System Total` | 0.17 | **1.7999999999999998** | **10x, client-facing, not stripped** |
| A2/2023 | r28c1 `Total` | 4,019,790 | 3,718,099 | **overwrites the CLCPA-207 figure** |
| A8/2023 | r12c1 `Subtotal` | 34,410 | 34,326 | data-quality gap |
| A8/2023 | r32c1 | 47,350 | 47,266 | data-quality gap |
| A4/2024 | r26c3, r26c4 | `""` | 3,284,542 / 13,613.04 | writes numbers into empty cells |
| A3/2025 | r22c4 | 22,511 | 22,297.18 | sums rounded averages |
| A4/2025 | r22c4 | 12,372 | 12,153.2 | sums rounded averages |
| E1/2023 | r4c2 | 0.4 | 0.399065128291635 | precision only |
| E1/2024 | r4c2 | 0.5 | 0.49866709233477036 | precision only |
| E1/2025 | r4c2 | 0.45 | 0.45279327779072387 | precision only |

F9/2025 and A2/2023 are the two that must not ship another day without a guard. A2/2023 in particular would resolve an open ConEd question in the wrong direction, silently, from a single click.

### Defect 3: the CLCPA-209 rounding guard's absolute floor is not magnitude-aware

The guard is `|stored - computed| <= max(1.5, |computed| * 1e-4)`. The 1.5 floor suits integer rounding on large counts and is enormous on fractional columns. F9/2025 col 2 (stored 0.1, computes 0.97) is suppressed by it -- the right outcome for the wrong reason -- while col 4 (0.17 vs 1.8) crosses it at 1.63 and writes. The floor should scale with the values, or apply only to integral columns.

## Not caused by CLCPA-209

Measured against `7b9add6`, the commit before that slice:

| | before | after |
|---|---|---|
| opens dirty | 84 of 149 | 70 of 149 |
| a Save would write something | 32 | 9 |
| opens dirty now but not before | -- | **NONE** |

CLCPA-209 reduced both, by 14 and 23 table-years. Defect 3 is its own.

## Acceptance criteria

1. Opening any table-year in the ingest editor, with no user edit, leaves the badge clear and Save inactive. All 149 asserted.
2. `recomputeTotals` never writes into a detected percentage column that has no `DERIVED_COLS` rule. F9/2025 r6c4 asserted by value.
3. The rounding guard's tolerance is magnitude-aware; F9/2025 r6c2 is suppressed on the right grounds, and each of the 9 cells above is asserted individually.
4. A Save with no user edit writes nothing, or is refused. Asserted payload-wide, both years and all tables.
5. A Save WITH a user edit still persists exactly that edit. Negative control, so the fix does not disable saving.
6. A2/2023 r28c1 and F9/2025 r6c4 keep their stored values through open, render and save.

## Reproduction

Open the hosted app, ingest editor, section G, table G1, year 2025. The badge appears immediately. Nothing has been typed.

Read-only reproduction of all of it: `dirty_on_open.js`, which replays one render per table-year against both the current build and `7b9add6` and reports the badge cells and the would-persist cells separately.
