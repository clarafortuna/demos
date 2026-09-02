# CLCPA-206 findings: the source-authored-figures spelunk

**Type:** Findings report, read-only investigation
**Ran:** 2026-09-02
**Scope:** reproduce, from the source data ConEd already shared, the formulas behind
the family of figures that do not reconcile with their own tables
**Changes made:** none. No code, no deploy, no Dataverse writes.

## Headline

**J8's "% of Total" is REPRODUCED, and the premise of this ticket dissolves.** The
column is a plain DAC share. It reproduces 2023 and 2024 exactly. The 2025 cell is
**stale: it carries 2024's value verbatim**, and the figure the derive engine
computes was right all along.

The other two family members are **NOT REPRODUCIBLE from shared data**, for the same
structural reason: the shared spreadsheets do not contain their subject matter.

| figure | verdict |
|---|---|
| J8 "% of Total" | **REPRODUCED** for 2023 and 2024; 2025 is a copy-forward error |
| A2/2023 Total vs its program rows | **NOT REPRODUCIBLE** from shared data |
| F3/2025 "Con Edison (Overall)" = 6 | **NOT REPRODUCIBLE**, and impossible as a blend |
| the five all-totals tables | **all reconcile**, all three years |

## What the shared data actually is

| file | rows | columns |
|---|---|---|
| `Data/Electric.xlsx`, sheet "Export" | 2,289 body | Geo ID, DAC Indicator, Total Accts, Total EAP Accts, Total Adjustment |
| `Data/Gas.xlsx`, sheet "Export" | 1,038 body | same five |

Both carry a footer recording the query that produced them. The electric footer:

    Applied filters:
    SVC_TYPE_CD is E
    Year is 2025
    CIS_DIVISION is NY
    CUST_CL_CD is R
    SA_STATUS is Active or is Pending Stop
    SUB_SA_SW is N
    SVC_TYPE_CD is E or G

**Two limits that shaped everything below.** First, both extracts are **Year 2025
only**, so they cannot validate any 2023 or 2024 figure. Second, they are **per-tract
EAP account and adjustment data**: five columns, no MMBtu, no programs, no
interruption counts. Anything outside EAP accounts and dollars has no source here.

Aggregated by DAC Indicator:

| | rows | accounts | EAP accounts | adjustment |
|---|---|---|---|---|
| Electric DAC | 1,020 | 1,357,284 | 287,252 | -125,046,765.73 |
| Electric Non-DAC | 1,267 | 1,725,427 | 145,577 | -61,712,802.59 |
| Electric Unknown | 1 | 18,584 | 810 | -339,556.06 |
| Gas DAC | 548 | 463,862 | 96,001 | -22,020,986.70 |
| Gas Non-DAC | 488 | 426,392 | 24,321 | -15,270,209.96 |
| Gas Unknown | 1 | 6,321 | 335 | -178,121.35 |

Note the **Unknown** bucket. It matters below.

## 1. J8 "% of Total": REPRODUCED

### The formula

    DAC share = (Electric DAC + Gas DAC) / ((Electric DAC + Gas DAC) + (Electric Non-DAC + Gas Non-DAC))

The denominator is **DAC plus Non-DAC**, NOT the table's own Total row. That
distinction is the whole answer.

| year | DAC (E+G) | Non-DAC (E+G) | denominator | computed | stored | verdict |
|---|---|---|---|---|---|---|
| 2023 | 131,748,136.95 | 69,237,850.60 | 200,985,987.55 | **65.55%** | 66% | REPRODUCED |
| 2024 | 191,496,694.00 | 118,631,275.00 | 310,127,969.00 | **61.75%** | 62% | REPRODUCED |
| 2025 | 151,890,380.00 | 79,106,326.00 | 230,996,706.00 | **65.75%** | 62% | **MISMATCH** |

The Non-DAC row reproduces on the same denominator: 34.45% against stored 34% for
2023, 38.25% against 38% for 2024, and 34.25% against a stored 38% for 2025.

### Why the earlier attempts missed it

The five candidates recorded in the ticket all used **J8/2025's Total row** as the
denominator, which gives 65.64%. That row is larger than DAC plus Non-DAC:

| | DAC + Non-DAC | Total row | unallocated |
|---|---|---|---|
| Electric | 192,401,325 | 192,638,756 | 237,431 |
| Gas | 38,595,381 | 38,743,914 | 148,533 |

The unallocated remainder is the **Unknown** DAC Indicator bucket visible in the
source extracts (electric 339,556, gas 178,121 for the 2025 vintage). So the Total
row includes tracts that are neither DAC nor Non-DAC, and dividing by it is a
slightly different question from the one the column asks.

Crucially, **2023 and 2024 have no Total row at all**, so DAC plus Non-DAC was the
only available denominator there, and it works. Testing only 2025, which is what the
five candidates did, hid the formula behind the one year that does not obey it.

### 2025 is a copy-forward

| | DAC | Non-DAC |
|---|---|---|
| J8/2024 stored | 62% | 38% |
| J8/2025 stored | **62%** | **38%** |
| J8/2025 computed | 65.75% | 34.25% |

2025 should read **66% / 34%**, the same as 2023, and instead carries 2024's pair
verbatim. Both cells, both digits. That is a copy-forward when the report rolled
from 2024 to 2025, not a formula anyone needs to recover.

The difference is 3.75 percentage points, far outside rounding: 65.75 rounds to 66
by any convention.

### The consequence, which is a ruling and not a code change

CLCPA-145's interim was "render the stored values as-is with a not-reconciled note,
because the formula cannot be reproduced". That premise no longer holds. The
formula reproduces for two of three years, and the third year's stored value is
stale. **The derive engine's computation was correct and the stored 2025 cell is
wrong**, which is the reverse of the assumption behind `NOT_RECONCILED_TABLES`.

This bears on the ruling that stored values are the reference. That rule assumed
the stored figure is ConEd's authored answer. Here the stored figure is a
transcription slip, so treating it as the reference propagates the slip. Which way
to resolve it is Emely's call. The options I can see:

1. Correct the stored 2025 cell to 66% / 34% and leave the interim in place.
2. Remove J8 from `NOT_RECONCILED_TABLES` and let the derive engine compute the
   column, having established the formula. That would also need `DERIVED_COLS` to
   express "denominator is DAC plus Non-DAC, excluding the Total row", which is close
   to but not identical to the existing `totalRow` scope.
3. Confirm with ConEd that 2025 should be 66% before changing anything, since the
   figure is in a delivered report.

**J7 is fine, and is not the source of the 66%.** J7's own percentages reconcile in
all three years on the same kind of rule, using the sum of its three service columns
as the denominator: 66.10%, 65.88%, 66.48%, all rounding to the stored 66%. J8/2023
also being 66% is a coincidence of two similar shares, not a copy between tables.

### One caveat on the 2025 dollars themselves

The source extracts do **not** reproduce J8/2025's dollar figures. They run 2.7% to
3.9% low across every cell:

| | source | J8/2025 | difference |
|---|---|---|---|
| Electric DAC | 125,046,766 | 128,986,182 | -3.05% |
| Electric Non-DAC | 61,712,803 | 63,415,143 | -2.68% |
| Gas DAC | 22,020,987 | 22,904,198 | -3.86% |
| Gas Non-DAC | 15,270,210 | 15,691,183 | -2.68% |

So the extract is a different vintage or scope from the one J8 was built on. That
does not weaken the finding, because the formula was verified against **J8's own
figures**, which is the right test for an internal-consistency question. It does mean
the extracts cannot be used to re-derive J8's dollars, only to explain its structure,
which is where the Unknown bucket came from.

## 2. A2/2023: NOT REPRODUCIBLE from shared data

A2 is Lifetime Energy Savings by program, in MMBtu. The shared spreadsheets contain
**no MMBtu column and no program dimension**. Their five columns are tract-level
account and EAP-adjustment figures. A2's source is simply not in the repository.

Restating the defect, which stands:

| quantity | value |
|---|---|
| stored Total row, col 1 | 4,019,790 MMBtu |
| sum of the 28 program rows | 3,718,099 MMBtu |
| gap | 301,691 MMBtu, 7.5% |

Two candidate explanations tested and neither confirmed:

- **A missing program.** The 2023 program list is not comparable to 2024 or 2025 by
  name: 2023 uses forms like "AMEEP - Electric & Gas" while later years spell out
  "Affordable Multifamily Energy Efficiency Program". A name-based diff reports 19
  programs "new" in 2024 or 2025, but they are renames, so the diff is not evidence
  either way. Two 2024 programs are near the gap in magnitude (Multifamily 292,367
  and Residential Home Energy Reports 298,526, both within 3%), which is suggestive
  and nothing more.
- **A wider report scope in the Total.** Consistent with the gap being in column 1
  only while column 2 (DAC) reconciles to within 2 units, but unverifiable without
  the source.

**Verdict: NOT REPRODUCIBLE.** Escalation to ConEd is the next step for CLCPA-207,
and the specific question is narrow and worth asking as such: *does A2/2023's Total
of 4,019,790 MMBtu include programs not itemised in the 28 rows, and if so which?*

## 3. F3/2025 "Con Edison (Overall)" = 6: NOT REPRODUCIBLE, and impossible as a blend

F3 is customers interrupted per 1,000 customers served. No source for it exists in
the shared spreadsheets either.

| year | National | NY excl. ConEd | Overhead | **Overall** | Network |
|---|---|---|---|---|---|
| 2023 | 990 | 1,030 | 398 | **110** | 12 |
| 2024 | 940 | 940 | 373 | **106** | 15.6 |
| 2025 | 1,000 | 970 | 372 | **6** | 15.6 |

In 2023 and 2024, Overall sits **between** Network and Overhead, which is what a
blend of the two service territories must do. In 2025 it sits **below both** (6
against Network 15.6 and Overhead 372). No weighting of two numbers can produce a
result below the smaller of them, so 6 is not a blend of the values shown.

The shared data cannot tell us whether "Overall" is defined more narrowly, because
it contains no interruption data at all. What the series does show is that the
definition did not change: 2023 and 2024 behave as a blend, and only 2025 breaks.
Combined with 106 in the prior year, **a data-entry slip is the most economical
explanation** (106 losing its middle digit, or a 60-ish value truncated), but that is
inference, not reproduction.

**Verdict: NOT REPRODUCIBLE.** This still has no ticket. It deserves one, and the
question for ConEd is again narrow: *is F3/2025's Con Edison (Overall) of 6 correct,
given it is below both the Network and Overhead figures in the same column?*

## 4. Opportunistic check: the five all-totals tables

CLCPA-205 item 2 was ruled NO auto-calculation, with a reopen condition that all five
tables be proven to reconcile from source. Checked against each table's own figures,
which is the available test since the shared extracts do not cover these subjects.

| table | 2023 | 2024 | 2025 |
|---|---|---|---|
| G10 | YES, 45.87% vs stored 0.46 | YES, 51.90% vs 0.52 | YES, 54.43% vs 0.54 |
| J3 | YES, both columns | YES, both columns | YES, both columns |
| J4 | YES, both columns | YES, both columns | YES, both columns |
| J6 | YES, both columns | YES, both columns | YES, both columns |
| J7 | YES, 66.10% vs 66% | YES, 65.88% vs 66% | YES, 66.48% vs 66% |

**All five reconcile internally, in all three years.** The reopen condition is
satisfied on the evidence available.

One methodological note on J7. My first automated pass reported J7 as failing, at
80% against a stored 66%. That was the script's fault, not the table's: it paired the
percentage column with the nearest numeric column to its left, which for J7 is "Dual
Service" alone rather than the sum of Electric-only, Gas-only and Dual Service.
Recomputed with the correct denominator, J7 reconciles in every year. Worth recording
because a column-pairing heuristic that works for four tables can quietly mis-read
the fifth.

## Method note: an unconstrained search proved nothing, and I checked

Before finding the formula I ran a brute-force search over 153 candidate magnitudes
drawn from the spreadsheets, the built `coned_operational` dataset and every numeric
cell in the J-section tables, looking for any pair whose ratio hit the target within
0.4 percentage points. It returned 20 hits for 62% and 27 for 66%, several of which
looked plausible at a glance.

They were noise. Running the same search against arbitrary targets:

| target | hits | | target | hits |
|---|---|---|---|---|
| 62% | 20 | | 47% | 27 |
| 66% | 27 | | 53% | 23 |
| 38% | 30 | | 71% | 27 |
| 34% | 50 | | 12% | 73 |

An arbitrary 47% gets more hits than the real 62%. With roughly 23,000 ordered pairs
and a 0.8pp window, the expected coincidence count is exactly this order of
magnitude, so **the search cannot distinguish signal from noise at this scale** and
every hit it produced was discarded.

The formula was found instead by reading J8's three years side by side and noticing
that 2023 and 2024 lack a Total row, which forced the question of what the
denominator could have been in those years.

Recording this because the search looked productive and was not. A ratio search over
a payload this size will always return candidates; without a false-positive baseline
they are indistinguishable from arithmetic accidents.

## Time

Ticket estimate 1 to 2 hours. **Actual approximately 1.6 hours**, inside range:
roughly 0.3 h inventorying the spreadsheets, 0.4 h on candidate testing including the
brute-force detour and its false-positive check, 0.4 h finding and verifying the
formula across all three years, 0.2 h on A2, F3 and the all-totals check, 0.3 h
writing this up.

## What needs a ruling from Emely

1. **J8/2025's 62%.** Correct the stored cell to 66%, let the derive engine own the
   column now that the formula is known, or ask ConEd first. This is a figure in a
   delivered report.
2. **Whether `NOT_RECONCILED_TABLES` should still contain J8.** Its justification was
   that the formula was unknown. It is now known.
3. **CLCPA-207 and the F3 case** both become questions for ConEd rather than further
   in-house work, and the F3 case still needs a ticket number.
4. **The stored-values-are-the-reference rule** meets its first real edge here: the
   stored 2025 figure is a transcription slip, not an authored answer. Worth deciding
   how the rule should read when those two come apart.
