# CLCPA-207: A2/2023 stored Total does not equal the sum of its program rows, so the derived Total percentage is wrong

**Type:** Bug
**Priority:** Medium
**Component:** ExecutiveDashboard_dev, source data
**Found:** while closing CLCPA-143 item (a), 2026-08-28
**Related:** CLCPA-143 (routing, shipped as build `342094b187`), CLCPA-208 (payload field residuals), CLCPA-206 (J8 formula spelunk)

## Summary

Table A2 (Lifetime Energy Savings by program) for **2023** stores a Total row whose
"Total Energy Savings (MMBtu)" figure is **7.5% larger than the sum of the 28 program
rows above it**. A2 has a derive rule, and that rule computes the Total row's
"% in DACs" against the sum of the non-total rows, so the table renders a percentage
built on an incomplete denominator.

| quantity | value |
|---|---|
| stored Total row, col 1 | 4,019,790 MMBtu |
| sum of the 28 program rows, col 1 | 3,718,099 MMBtu |
| gap | **301,691 MMBtu, 7.5% of the total** |
| stored Total row, col 2 (DAC) | 1,659,904 |
| sum of program rows, col 2 | 1,659,902 (agrees, off by 2) |

So column 2 reconciles and column 1 does not: the DAC figure is fully itemised while
about 300k MMBtu of total savings sits in the Total row but in no program row.

## Effect on the report

| where | shows | derivation |
|---|---|---|
| table A2, Total row, "% in DACs" | **44.64%** | 1,659,902 / 3,718,099, the row sums |
| section A KPI card, DAC share | **41.29%** | 1,659,904 / 4,019,790, the stored totals |

The **KPI card is correct**; the table is not. Note the direction: this is the one
case in the CLCPA-143 sweep where the table is wrong and the card is right.
Everywhere else it was the reverse.

Only 2023 is affected. A1 in all years and A2 in 2024 and 2025 reconcile to within
rounding (gaps of 0, 1 and 5 units on multi-million totals).

## Why this is not fixed in CLCPA-143

CLCPA-143 routed the KPI cards to derive their DAC share from the KPI's own
`dac / total`. That made the card right and left the table wrong, so the
table-versus-card disagreement on A2/2023 **persists, inverted**. That is stated
explicitly in the 143 close comment rather than being papered over.

Fixing it is a data or denominator question, not a routing one, which is why it is
here instead.

## Family: source-authored figures that do not reconcile

This is the **third** member of a family. All three are figures that arrived in the
source data and cannot be reproduced from the data supplied alongside them:

1. **J8's "% of Total" column** (CLCPA-206). Stores 62% / 38% / 100% for 2025 where
   no denominator available in the table produces 62%; the closest candidates are
   65.6% to 67%. The row percentages in the same table reconcile exactly, which is
   what makes the column's denominator look like a figure that did not survive into
   the payload.
2. **F3/2025 "Con Edison (Overall)" = 6**, against 110 in 2023 and 106 in 2024.
   An outlier of three orders of magnitude in a series that is otherwise stable.
3. **A2/2023 stored Total row**, this ticket (CLCPA-207).

**Cross-reference CLCPA-206.** Its charter is a 1 to 2 hour read-only spelunk of the
source data ConEd already shared (`Data/Electric.xlsx`, `Data/Gas.xlsx`, the built
`coned_operational` dataset) to reproduce J8's formula. **If that spelunk finds
ConEd's actual formula, it may explain all three**, because all three look like the
same thing: a figure computed upstream against a population the payload does not
carry. Worth doing 206 first and re-reading CLCPA-207 in its light before
investigating A2 separately.

## Candidate explanations, not yet tested

- The 2023 program list is truncated: a group of programs was itemised in 2024 and
  2025 but rolled up or omitted in 2023, while the Total kept the full figure.
- The Total is a systemwide figure including savings outside the programs listed,
  for example a category reported separately in the source workbook.
- The gap corresponds to a single missing program of roughly 301,691 MMBtu. Worth
  checking the 2024 and 2025 program lists for a name present there and absent in
  2023.

## Acceptance

1. Establish which figure is authoritative for 2023, the stored Total or the row
   sum, from the source data rather than by inference.
2. Either restore the missing program rows so the sum matches the Total, or give A2
   a denominator scope that uses the explicit Total row, matching what CLCPA-144 did
   for G10 and J3/J4/J6/J7.
3. After the fix, table A2/2023 and the section A KPI card must agree. The
   CLCPA-143 harness already pins `energy_savings/2023` as a known residual, so
   **that pin must be removed as part of CLCPA-207** or the harness will fail once
   the two agree. That is deliberate: it makes the fix impossible to land silently.
4. All-years validation, per the standing rule: whatever rule is chosen must be
   checked against 2023, 2024 and 2025, not only the year that prompted it.
