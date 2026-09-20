# CLCPA-241 + 289: the fold-in is buildable, but two published cells move

**Raised:** 2026-09-20, on `caf0dbb2ee`
**Status:** STOPPED before code. Nothing written.
**Why:** 241's own acceptance criterion, *value identity for untouched data*,
fails on two cells, and the failure republishes figures Con Edison filed.

---

## 1. The scope is smaller than "122 cells across ten tables"

Measured on the tip, every stored percent-string cell classified by whether its
column has a derive rule and whether its table is already stripped:

| group | cells | state |
|---|---|---|
| A10, J3, J4, J6, J7 | **69** | already ruled **and** already stripped -- the mechanism working |
| **A9 col 5 and col 6, "% Change"** | **20** | **241's actual target** |
| C2, F7, J1, J8 | **33** | unruled, and **not percent-change** |
| | **122** | |

The 33 are share and percentage source data -- C2's bare `31%` strings, F7's
"% of Grand Total" row, J1's `DAC % of Total`, J8 (which is in
`NOT_RECONCILED_TABLES`). **Nothing can rebuild them.** Stripping them would be
the G1 data-loss shape `stripDerivedForPersist` already refuses:

> strip a cell ONLY IF the app can rebuild it [...] Nulling it on save would
> delete it permanently, and nothing could bring it back.

So the honest target is **A9's 20 cells**. Adding A9 to `PERSIST_STRIP_TABLES`
touches only A9's declared columns, so the other 33 are safe either way -- but
the instruction's figure should be 20, not 122.

## 2. The rule is right, and 18 of 20 reproduce exactly

`% Change` is a quotient of two columns present in A9's own schema:

```
col5 = (col3 - col1) / col1        col6 = (col4 - col2) / col2
```

Verified against **every stored cell in both years**, rendered at zero decimals:

- **18 of 20 match the filed figure exactly.**
- **2 do not.**

| row | inputs | formula | filed |
|---|---|---|---|
| 2024 "Energy Savings (MMBtu)" | 4,019,790 -> 5,360,879 | **+33.362%** | **8%** |
| 2024 "Average Incentive per Participant" | 112 -> 182 | **+62.500%** | **62%** |

The second is a rounding convention: 62.5 rounds half-up to 63, and the source
kept 62. Its DAC sibling (67.593 -> `68%`) rounds the other way, so the source
is not consistent with itself either.

**The first is not rounding.** 33.362% against a filed 8% is a figure that does
not follow the formula at all, while its own DAC sibling (49.826% -> `50%`)
does.

## 3. Why that is a STOP and not a detail

`applyDerivedCols` **overwrites a stored cell unconditionally on the display
path**. Measured: with a rule registered, A9's stored `"-26%"` was replaced by
the computed value. The `derivedRowKeepsStored` guard protects the EDITOR
(`recomputeTotals`), not the render.

So registering the rule republishes all 20 cells. For 18 the rendered text is
byte-identical and nobody would see a change. For the two above, the report
would show **33%** where Con Edison filed **8%**, and **63%** where they filed
**62%**.

That is the class of change the owner reserved to the client on CLCPA-290:

> changing a published stored-year figure is a reporting decision for the
> client

And the codebase has already named this exact situation, in CLCPA-144 Tier 3:

> A percentage that disagrees with its own two rows IN THE SOURCE AS PUBLISHED
> is a data question to ConEd, and recomputing it would resolve that question
> by accident.

A9/2024's `8%` is that cell.

## 4. The options

**(a) Build as ordered.** The rule, the strip, the markers. Two filed figures
are republished. 241's criteria are met in full and the report changes without
Con Edison having been asked.

**(b) Extend the CLCPA-144 Tier 3 protection to the display path.** RECOMMENDED.
The rule computes; a cell the source does not reproduce keeps its filed value
and is named; every edit recomputes, which is 241's real complaint; and 289's
`(calculated)` marker becomes honest because the app genuinely computes the
column. The strip then applies to the 18 reproducible cells and refuses the 2,
exactly as it already refuses G1's -- so *no stored percent-change cell
anywhere* holds for 18 of 20, with two named exceptions that are **data
questions, not derived copies**.

**(c) Ship nothing and take the two cells to Con Edison first.** Cleanest for
the report, slowest for the ticket, and leaves 289 blocked meanwhile.

**Recommendation: (b).** It satisfies what 241 exists to fix -- a stale stored
figure that never recomputes -- without resolving a data question by accident,
and it reuses a protection the engine already has rather than inventing one.
The two cells go to Con Edison as a question either way.

## 5. What ships either way, once ruled

- the `percentChange` rule type in the shared derive engine, A9 cols 5 and 6
  declared from the schema, no per-table literal
- A9 in `PERSIST_STRIP_TABLES`, bounded by the existing rebuild guard
- the composer updated
- 289: A9's `% Change` pair marked `(calculated)`, honest because it computes
- A10's markers unregressed, asserted

**Not built. No code was written.**
