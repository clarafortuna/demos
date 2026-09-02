# CLCPA-205 item 1: corrections to the ticket text

Three statements in the ticket are wrong, all verified by simulating the shipped
`recomputeTotals` against every table and year rather than by reading the code.
Suggested replacement text follows each.

## 1. G1-G9 are not exposed

**Ticket says:** "Exposed tables: A5-A8 and G1-G9."

**Actual:** every G1-G9 year has 0 or 1 total row, so one column sum is the correct
sum and the hierarchy bug cannot occur.

| table | total rows per year |
|---|---|
| G1 | 2023: **0**, 2024: **0**, 2025: 1 |
| G2, G4, G6, G8 | 1 in 2023, 1 in 2024, 1 in 2025 |
| G3, G5, G7, G9 | 1 in 2024, 1 in 2025 |

G1/2023 and G1/2024 having zero total rows is the same null-feet, no-Systemwide-
Total hole recorded in **CLCPA-208**.

**Replacement text:** "Exposed tables: A5, A6 and A8. G1-G9 are flat, with 0 or 1
total row per year, so they cannot be affected; they are covered by the flat
negative control instead. G1/2023 and G1/2024 have zero total rows, per CLCPA-208."

## 2. A7 is structurally multi-total but coincidentally correct

**Ticket implies** all of A5-A8 carry the bug.

**Actual:** A7 has 2 total rows with segment sizes `[2, 0]`. Only one segment is
non-empty, so the whole-table sum already equalled that segment's sum. A7 was never
wrong, and the fix must keep it that way.

**Replacement text:** "A7 is structurally multi-total but coincidentally correct:
only one of its segments is non-empty, so the whole-table sum already matched. It
must remain byte-identical, and that is asserted."

## 3. The exposed set and its size

**Replacement text:** "Exposed: A5, A6, A8 across 2023, 2024 and 2025. Nine
table-years, **137 additive total cells** receiving a sum that is not their own
segment's."

Per-year breakdown, additive cells only, excluding the derived percentage column:

| table | 2023 | 2024 | 2025 |
|---|---|---|---|
| A5 | 20 | 16 | 18 |
| A6 | 10 | 10 | 9 |
| A8 | 16 | 18 | 12 |

## Two additions the ticket does not mention

### A. The containment set, shipped with item 1

`RECOMPUTE_TOTALS_EXEMPT = {D2, D3, D4, F7}`. Those four are not hierarchical: their
DATA rows carry labels containing "total", the loose predicate classified them as
total rows, and the editor overwrote real magnitudes with a sum of the percentage
rows. 12 table-years, 74 cells. Examples: D2/2025 `Total # of projects` 88,150
became 0.688; F7/2025 `% of Grand Total` `"32%"` became 167965.

The hierarchy fix does not address that and would have replaced the wrong values
with differently wrong ones. The predicate question is CLCPA-209, and that
ticket removes this set.

### B. Found and NOT fixed, needs a decision

The derived percentage column on segment totals is **also** hierarchy-blind, but in
`applyDerivedCols`, which the **report** shares with the editor. A total row's
derived cell is computed from the whole-table `colSum` rather than from that row's
own values, so every segment total displays the whole-table ratio.

| A5/2025 row | label | stored | report displays | own segment gives |
|---|---|---|---|---|
| 23 | Commercial & Industrial Total | 0.25 | **0.3698** | 0.2516 |
| 45 | Small-Medium Business Total | 0.37 | 0.3698 | 0.3666 |
| 9 | Clean Heat SMB ASHP Total | 0.47 | 0.3698 | 0.4653 |

The stored values match the correct segment ratios, so the source data is right and
the derive is wrong. **63 cells across 9 table-years in A5, A6 and A8, visible in
the delivered client report today.**

This is outside item 1's stated scope, which names `recomputeTotals`. Fixing it
moves figures in the report and needs its own before-and-after and sign-off, so
item 1 asserts the current behaviour unchanged and records the defect.

**RULED 2026-09-02.** This is **CLCPA-205 item 3**, and the evidence upgrades it
from a display preference to a defect: the stored value (0.25) is correct and
`applyDerivedCols` contradicts it on the client report (37%). Decision: **fix it**,
as its own slice AFTER the item 1 deploy verifies, with a before-and-after table of
all 63 cells as PR evidence because client-visible figures change. Its home is
**CLCPA-144**, since `applyDerivedCols` is the derive engine, folded into 144's
remaining scope as hierarchy-aware derived columns.
