# Follow-up: B2 and PERSIST_STRIP_TABLES

**Recorded:** 2026-09-20, by ruling, as a follow-up item and not this
session's work.
**Origin:** CLCPA-303 option (C), which declared both of B2's total
directions.

---

## The item

CLCPA-303 declared B2's column-wise total row with a `columnTotal` rule, so
the engine now derives that row. B2 is **not** in `PERSIST_STRIP_TABLES`, so
the row is still stored as well as derived.

That is a stored copy of something computable, which the repo's central
design rule is against.

## Why it was left

A strip change needs its own round-trip proof and its own turn. CLCPA-143's
finding is the reason: extending the strip without proving the app can
rebuild every cell it nulls opens a data-loss path on save, and that ticket
found real cases (G1/2023 and G1/2024 store a percentage with no feet
column at all, so nulling it would delete the only data in the row).

## Why it is safe to leave meanwhile

The CLCPA-303 declaration reconciles and advises on divergence in both
directions. A stored figure that stops agreeing with its own rows surfaces
as a kept figure with the amber advisory rather than drifting silently,
which is the guard the stored copy needs while it remains.

Measured at the time of the declaration: 12 of 12 cells agree in both
directions across all three stored years, and a save writes byte-identical
rows to what it wrote before (`suite_303` E4 and E5).

## What the follow-up has to do

1. Prove the round trip for B2: strip, render, and compare against rendering
   the unstripped rows, on every stored year.
2. Check the same shape CLCPA-143 found elsewhere - a year whose only data
   in a row is the cell the strip would null.
3. Then add B2 to `PERSIST_STRIP_TABLES`, or record why it cannot join.
