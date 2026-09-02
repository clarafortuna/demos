# CLCPA-2xx: F3/2025 "Con Edison (Overall)" of 6 is below both of its components

**Type:** Bug, data
**Priority:** Medium
**Component:** ExecutiveDashboard_dev, source data
**Found:** 2026-08-28, characterised during CLCPA-206, 2026-09-02
**Related:** CLCPA-206 (investigation, complete), CLCPA-207 (A2/2023 denominator),
the consolidated ConEd data-question package dated 2026-09-02
**Number:** pending assignment

## Summary

Table F3 reports customers interrupted per 1,000 customers served. For 2025 the
"Con Edison (Overall)" row reads **6**, which is below both figures it should sit
between.

| year | National | NY excl. Con Edison | Con Edison (Overhead) | Con Edison (Overall) | Con Edison (Network) |
|---|---|---|---|---|---|
| 2023 | 990 | 1,030 | 398 | **110** | 12 |
| 2024 | 940 | 940 | 373 | **106** | 15.6 |
| 2025 | 1,000 | 970 | 372 | **6** | 15.6 |

In 2023 and 2024 Overall lies between Network and Overhead, which is what a combined
figure across the two service territories must do. In 2025 it lies below both:
6 against Network 15.6 and Overhead 372.

**No weighting of two numbers can produce a result smaller than the smaller of
them.** So 6 is not a combination of the Network and Overhead figures shown beside
it, whatever the weights.

The series also shows the definition did not change: two years behave as a combined
figure and only the third breaks. A transcription slip is the most economical
explanation (106 losing a digit, or a value in the 60s truncated), but that is
inference and not established.

## Why this could not be resolved in house

CLCPA-206 checked the source data Con Edison has shared with us. `Data/Electric.xlsx`
and `Data/Gas.xlsx` hold tract-level Energy Affordability Program figures only: Geo
ID, DAC Indicator, Total Accounts, Total EAP Accounts, Total Adjustment. There are
**no interruption counts and no customer denominators**, so F3 has no source among
the files we hold and cannot be recomputed.

This is the same structural reason CLCPA-207 could not be resolved in house. Contrast
J8, whose formula CLCPA-206 did reproduce, because J8's own table carried enough
figures to test candidates against.

## Status in the dashboard

**Renders as stored, and no code change is proposed.** Ruled 2026-09-02: the
dashboard reproduces Con Edison's report, errors included, until Con Edison corrects
its own figure. F3 has no derive rule, so nothing in the application computes or
validates this cell; it is displayed exactly as supplied.

F3 was touched by CLCPA-162, which routed its tile caption through `getTableSchema`.
That was a label fix and did not alter any figure.

## Family

Third member of the source-authored-figures family, alongside:

- **J8/2025's "% of Total"**, where CLCPA-206 reproduced the formula and showed the
  published 62% / 38% to be 2024's pair carried forward; the computed value is
  65.75%, rounding to 66% / 34%
- **A2/2023's Total** (CLCPA-207), exceeding the sum of its 28 program rows by 7.5%,
  301,691 MMBtu

All three went to Con Edison together in the consolidated data-question package
dated 2026-09-02. J8's question is a yes or no; these two ask for either the
underlying extracts or a definition.

## Acceptance

1. Con Edison confirms whether 6 is correct, and if so what population "Overall"
   covers for 2025 given it falls below both Network and Overhead.
2. If it is an error, the corrected figure lands in the payload through the normal
   ingestion path, and this ticket records the before and after.
3. If it is correct as published, that is recorded here with the definition, and the
   ticket closes without a code change. A figure that looks impossible but is
   intended is worth documenting so nobody re-opens it.
4. No derive rule is added for F3 either way. The table is source data with no
   internal arithmetic to check against, which is what made this unverifiable in the
   first place.

## Note on scope

This ticket asks only about the 2025 Overall cell. The 2023 and 2024 figures are
internally plausible and are not in question.
