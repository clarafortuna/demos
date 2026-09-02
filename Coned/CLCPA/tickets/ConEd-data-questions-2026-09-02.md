# Con Edison data questions: three figures in the CLCPA DAC report that do not reconcile

**Raised:** 2026-09-02
**Source of the analysis:** `Coned/CLCPA/tickets/CLCPA-206-findings.md`
**Related tickets:** CLCPA-206 (investigation, complete), CLCPA-207 (A2/2023),
CLCPA-210 (F3/2025 Overall), CLCPA-211 (boss sync, the handoff vehicle for this
package)

Three figures in the published report cannot be reconciled against the other
figures in their own tables. In one case we have reproduced the formula and can be
specific about what looks wrong; in the other two the source data was not included
in what has been shared with us, so we cannot check them at all.

Nothing has been changed in the dashboard. It reproduces the report as published,
including these three figures, and will continue to do so until Con Edison
confirms or corrects them. We are asking rather than adjusting.

---

## Question 1: J8/2025 "% of Total" appears to carry 2024's values forward

**Table J8, EAP Spending, reporting year 2025, the "% of Total" column.**

The column reads **62% / 38%** for 2025. It reads the same **62% / 38%** for 2024.
Both cells, both digits, identical across the two years.

We reproduced the formula behind the column from the figures in the table itself:

    DAC share = (Electric DAC + Gas DAC) / ((Electric DAC + Gas DAC) + (Electric Non-DAC + Gas Non-DAC))

The denominator is DAC plus Non-DAC. It excludes the "Unknown" DAC-indicator bucket
that appears in the tract-level extracts and is reflected in J8/2025's Total row.

That formula reproduces two of the three years exactly:

| year | DAC (E+G) | Non-DAC (E+G) | computed | published | agrees |
|---|---|---|---|---|---|
| 2023 | 131,748,136.95 | 69,237,850.60 | **65.55%** | 66% | yes |
| 2024 | 191,496,694.00 | 118,631,275.00 | **61.75%** | 62% | yes |
| 2025 | 151,890,380.00 | 79,106,326.00 | **65.75%** | **62%** | **no** |

For 2025 the formula gives 65.75%, which rounds to **66% / 34%**, the same as 2023.
The published figure is 62% / 38%, which is 2024's value.

**The question:** does J8/2025's "% of Total" column carry 2024's values forward in
error, and should it read 66% / 34%?

Two supporting details, in case they help locate the cause:

- For 2025 the Total row is larger than DAC plus Non-DAC, by 237,431 for electric
  and 148,533 for gas. That difference matches the "Unknown" DAC-indicator bucket in
  the tract-level extracts. Dividing by the Total row instead gives 65.64%, which
  still rounds to 66%, so the answer does not depend on which of the two
  denominators is intended.
- The 2023 and 2024 tables have no Total row at all, which is why DAC plus Non-DAC
  is the only denominator those years could have used.

---

## Question 2: A2/2023 Total exceeds the sum of its own program rows by 7.5%

**Table A2, Lifetime Energy Savings by program, reporting year 2023, column
"Total Energy Savings (MMBtu)".**

| quantity | value |
|---|---|
| published Total row | 4,019,790 MMBtu |
| sum of the 28 itemised program rows | 3,718,099 MMBtu |
| difference | **301,691 MMBtu, 7.5% of the total** |

The DAC column in the same table reconciles: the itemised rows sum to 1,659,902
against a published 1,659,904, a difference of 2 units. So the DAC figures appear
fully itemised while roughly 300,000 MMBtu of total savings sits in the Total row
and in none of the program rows.

Only 2023 is affected. A2 for 2024 and 2025, and A1 for all three years, reconcile
to within rounding.

We cannot investigate this ourselves: the data shared with us
(`Electric.xlsx`, `Gas.xlsx`) contains tract-level account and Energy Affordability
Program figures only. It has no MMBtu column and no program dimension, so A2's
source is not among the files we hold.

**The question:** does A2/2023's Total of 4,019,790 MMBtu include programs that are
not itemised in the 28 rows, and if so which ones? Alternatively, is the Total drawn
from a wider reporting scope than the program list beneath it?

---

## Question 3: F3/2025 "Con Edison (Overall)" is below both of its components

**Table F3, Customers Interrupted per 1,000 Customers Served, reporting year 2025.**

| year | National | NY excluding Con Edison | Con Edison (Overhead) | Con Edison (Overall) | Con Edison (Network) |
|---|---|---|---|---|---|
| 2023 | 990 | 1,030 | 398 | **110** | 12 |
| 2024 | 940 | 940 | 373 | **106** | 15.6 |
| 2025 | 1,000 | 970 | 372 | **6** | 15.6 |

In 2023 and 2024 the Overall figure sits between Network and Overhead, which is what
a combined figure across the two service territories must do. In 2025 it sits below
both: 6, against Network 15.6 and Overhead 372.

No weighting of two numbers can produce a result smaller than the smaller of them,
so 6 cannot be a combination of the Network and Overhead figures shown beside it.
The prior year's 106 makes a transcription slip look plausible, but that is our
inference and not something we can verify.

As with A2, the shared data contains no interruption figures, so we cannot check
this against source.

**The question:** is F3/2025's Con Edison (Overall) figure of 6 correct? If it is,
what population does "Overall" cover in 2025, given it is below both the Network and
Overhead figures in the same column?

---

## What we have NOT done

- No figure in the dashboard has been altered. All three render exactly as
  published.
- We have not applied our reproduced formula to overwrite J8/2025. The dashboard's
  role is to reproduce the report, so a discrepancy of this kind is a question for
  Con Edison rather than something for us to correct silently.
- Questions 2 and 3 are not accusations of error. Both may have definitions we do
  not have visibility of, which is precisely why we are asking rather than assuming.

## What would help most

For question 1, a yes or no on the copy-forward is enough.

For questions 2 and 3, the underlying extracts would let us verify them the way we
verified J8: the program-level MMBtu figures behind A2, and the interruption counts
and customer denominators behind F3. If those cannot be shared, a definition of the
A2/2023 Total scope and of F3's "Overall" population would let us confirm the
figures are intended.
