# CLCPA-208: payload KPI fields that routing cannot fix, strategic_capital manufactured dac and main_replacement missing G1 inputs

**Type:** Bug
**Priority:** Medium
**Component:** ExecutiveDashboard_dev, payload data
**Found:** while closing CLCPA-143 item (a), 2026-08-28
**Related:** CLCPA-143 (routing, shipped as build `342094b187`), CLCPA-207 (A2/2023 denominator), CLCPA-206 (J8 formula spelunk)

## Summary

CLCPA-143 routed the reported-KPI DAC share to derive from the KPI's own
`dac / total`. That fixed 8 figures. It cannot fix two more groups, because in each
one the inputs needed to derive a correct answer are **not present in the payload**.
Routing is the wrong tool for both: these are data-shape problems.

Five KPI-years are affected. Both groups are pinned as known residuals in the
CLCPA-143 harness, so a new divergence fails a test rather than passing unnoticed.

## Group 1: strategic_capital, all three years. `dac` is not independent data

Section E's KPI card shows a DAC share that can never agree with table E1, because
the KPI's `dac` field is not a measured quantity. It is exactly
`total x the stored rounded percentage`:

| year | KPI total | KPI dac | total x stored E1 pct | identical? |
|---|---|---|---|---|
| 2023 | 1,298,253,000 | 519,301,200 | 1,298,253,000 x 0.40 = 519,301,200.00 | yes |
| 2024 | 976,591,848 | 488,295,924 | 976,591,848 x 0.50 = 488,295,924.00 | yes |
| 2025 | 1,188,983,989 | 535,042,795.05 | 1,188,983,989 x 0.45 = 535,042,795.05 | yes |

To the cent, in all three years. So `dac / total` can only ever return the rounded
percentage it was built from, and the card stays at 40.0 / 50.0 / 45.0.

Meanwhile table E1's Grand Total now renders the **usage-weighted mean** introduced
in Block 3 phase 1:

| year | E1 table renders | section E card shows |
|---|---|---|
| 2023 | 39.91% | 40.0% |
| 2024 | 49.87% | 50.0% |
| 2025 | 45.28% | 45.0% |

This is circular: a percentage was rounded, multiplied by a total to manufacture a
dollar figure, and that figure is now divided by the same total to recover the
rounded percentage. No amount of routing breaks the circle.

**Two candidate fixes:**

1. **Read E1's weighted mean directly for this KPI.** Correct and small, but it is
   the one KPI that would need a table mapping, which CLCPA-143 deliberately avoided
   (reported KPIs carry no `source_calc`). Acceptable as a single declared exception
   if it is documented as such.
2. **Regenerate `strategic_capital.dac` in the payload** from the source data, so it
   carries real dollars rather than a product of a rounded percentage. Better if the
   source has per-category DAC dollars; E1 stores only percentages per category, so
   this may not be recoverable from what is on disk.

Note the wider question option 2 raises: E1 stores a **percentage per category and no
DAC dollar column**, so "DAC dollars for section E" may never have existed as data.
If so, option 1 is the honest fix and the KPI's `dac` field should arguably be
dropped rather than kept as a derived artifact presented as a measurement.

## Group 2: main_replacement 2023 and 2024. G1 has no inputs to derive from

| year | card | G1 table | why |
|---|---|---|---|
| 2023 | 45.94% | 46.00% | G1 has `null` in "Feet Replaced" for both rows and **no "Systemwide Total" row at all**, so the table can derive nothing and falls back to its stored 0.46 |
| 2024 | 46.36% | 46.00% | as above, stored 0.46 |
| 2025 | 47.00% | 47.00% | **agrees**, because G1/2025 has real feet (202,384 within DAC, 430,538 systemwide) |

**2025 agreeing is the proof that 2023 and 2024 are a data gap, not a routing
mistake.** Same code path, same KPI, different result purely because the data is
present in one year and absent in the others.

The KPI's own `total` and `dac` for 2023 and 2024 (422,428 / 194,062 and
411,275 / 190,672) came from somewhere other than G1, since G1 holds no feet for
those years. That source is unidentified and finding it is part of CLCPA-208.

This is the same G1 hole that forced `stripDerivedForPersist` to be made
**self-limiting** in Block 3 phase 1: an unconditional strip would have destroyed
G1/2023-24's stored percentages on save with nothing able to rebuild them. So the
gap is already load-bearing in the code, and closing it would let that carve-out be
revisited.

**Fix:** locate the 2023 and 2024 feet figures in the source data and populate G1,
after which the table derives and both years agree on their own. If the feet are
genuinely unavailable, decide explicitly whether the KPI card should show the stored
0.46 for those years rather than a figure derived from an unidentified source.

## Family: source-authored figures that do not reconcile

Cross-reference **CLCPA-206** and **CLCPA-207**. Group 2 is a plain missing
input, but Group 1 belongs with the family of figures that arrived pre-computed from
upstream and cannot be reproduced from the data supplied alongside them:

- J8's "% of Total" column, 62 / 38 / 100 for 2025 where no available denominator
  yields 62% (CLCPA-206)
- F3/2025 "Con Edison (Overall)" = 6 against 110 and 106 in the prior years
- A2/2023's Total exceeding the sum of its program rows by 7.5%
- strategic_capital's DAC dollars, this ticket (CLCPA-208)

If the CLCPA-206 spelunk of `Data/Electric.xlsx`, `Data/Gas.xlsx` and the built
`coned_operational` dataset recovers ConEd's actual formulas, it may explain several
of these at once. Worth reading CLCPA-208 again in that light before starting.

## Acceptance

1. **strategic_capital:** section E's card and table E1 show the same figure in all
   three years, by whichever of the two options is chosen, and the choice is recorded
   with its reasoning. If option 1, the table mapping is documented as a declared
   exception to CLCPA-143's no-mapping design.
2. **main_replacement:** G1/2023 and G1/2024 either carry real feet, or the card's
   behaviour for those years is an explicit decision rather than an accident.
3. The CLCPA-143 harness pins these five KPI-years as known residuals. **Those pins
   must be removed as part of CLCPA-208**, or the harness will fail once the
   figures agree. That is deliberate: it makes the fix impossible to land silently.
4. All-years validation, per the standing rule: any rule chosen is checked against
   2023, 2024 and 2025, not only the year that prompted it.
5. If `strategic_capital.dac` turns out never to have existed as source data, say so
   in the close comment rather than leaving a derived artifact presented as a
   measurement.
