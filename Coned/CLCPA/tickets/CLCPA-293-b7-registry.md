# The B7 registry: totals that belong to the preparer

**Status:** CONFIRMED as shipped, 2026-09-21. Two rows, five cells.
**Code:** `B7_PREPARER_TOTALS` and `isB7PreparerTotal` in
`ExecutiveDashboard_dev/app.js`.
**Measurement of record:** `CLCPA-293-r4-evidence/census_293_r4.js` and its
committed output.
**Acceptance:** `CLCPA-293-r4-evidence/suite_293_r4.js`, 54 assertions, with
seven mutation controls and a five-anatomy browser reproduction.

---

## 1. What the registry is, and why it is a list

A total in this registry is one the engine **cannot honestly derive**, so the
figure can only have come from the preparer. The import accepts it, keeps it
and names it in the amber advisory; the editor's recompute leaves it alone;
the workbook does not mark it `(calculated)`.

It is an explicit list rather than a predicate because no predicate
distinguishes its members. Whether a total legitimately covers more than its
rows itemise is a fact about Con Edison's reporting, not about the table.
CLCPA-293 round 3 built the inverse -- refuse only where a registry rule
derives the cell -- and it was withdrawn before merge because, read
literally, it handed 262 of 432 total-row cells to the preparer and let a
file overwrite A1's Total.

**The failure mode is safe by construction.** A total left out behaves
exactly as it does today: the engine owns it and a file cannot overwrite it.
So an omission costs nothing that is not already the case, while a wrong
inclusion is the only way to do harm. `suite_293_r4` block E asserts this
directly, across every total cell of every stored table-year.

Keyed by table, row **label** and column **heading**, never by index: B2's
schema gains a column in 2025 and every index after it shifts.

## 2. Confirmed members

Both by standing ruling and by measurement. "Engine" is what
`recomputeTotals` produces when the row is blanked and the rest of the table
recomputed -- the same question the import guard asks.

| table | row | column | year | stored | engine |
|---|---|---|---|---|---|
| A8 | Total CES Programs Installations | Total Installations | 2025 | 336,599 | nothing |
| A8 | Total CES Programs Installations | DAC Installations | 2025 | 190,180 | nothing |
| J8 | Total | Electric | 2025 | 192,638,756 | nothing |
| J8 | Total | Gas | 2025 | 38,743,914 | nothing |
| J8 | Total | % of Total | 2025 | "100%" | nothing |

A8's grand total covers programmes that are not rows of that table: 336,599
against 283,852 itemised, and the 52,747 difference is real. J8's Total is
B7-class by standing ruling, its dollar figures being the preparer's.

## 3. REJECTED: the three C2 nominees

**Ruled 2026-09-21. Not members, and not deferred either.**

| table | row | column | years measured silent |
|---|---|---|---|
| C2 | Total | Participants | 2023, 2024, 2025 |
| C2 | Total | Committed Load Relief (MW) | 2023, 2024, 2025 |
| C2 | Total | Average Event Reductions (MW) | 2023, 2024, 2025 |

**The reason the census was wrong about these.** All three measure SILENT in
every stored year, which is the strongest signal the census produces. It is
still not evidence of membership here, because C2's silence is
**data-shaped, not structural**: its body rows store composite strings such
as `"37,988 (33%)"`, a value with its share in parentheses, and there is
nothing in them for the engine to sum. Given plain numbers the engine sums
those columns perfectly well, which `suite_254_255_261` has asserted since
the C-05 audit.

**And one axis is already the engine's by a standing ruling.** CLCPA-254
DECLARED `Average Event Reductions (MW)` summable, after that audit found
its total sitting empty. A registry entry would have contradicted it.

`isB7PreparerTotal` therefore refuses a declared-summable column
**structurally**, not only by omission from the list, so the registry and
CLCPA-254 cannot contradict each other even if this list is edited without
reading it.

**This is the case that limits the census.** It is recorded here because the
next reader will see three cells with perfect SILENT evidence and wonder why
they are not members.

## 4. DEFERRED: data questions for the client conversation

**Ruled 2026-09-21.** No measurement settles whether these totals represent
more than their rows itemise. That is Con Edison's reporting semantics to
state. Deferral costs nothing: block E proves an omitted total behaves
exactly as it does today.

Each nominee's evidence, kept here for that conversation:

| table | row | column | year | stored | engine |
|---|---|---|---|---|---|
| A2 | Total | Total Energy Savings (MMBtu) | 2023 | 4,019,790 | nothing |
| A3 | Total | Avg. Incentives by Participant | 2025 | 3,761,330 | nothing |
| A3 | Total | Avg. Energy Savings by Participant (MMBtu) | 2025 | 22,511 | nothing |
| A4 | Total | Avg. Incentives by Participant | 2025 | 2,026,699 | nothing |
| A4 | Total | Avg. Energy Savings by Participant (MMBtu) | 2025 | 12,372 | nothing |
| F9 | Grand Total | DAC % of System Total | 2023, 2024, 2025 | 0.04, 0.043, 0.1 | nothing |
| F9 | Grand Total | Non-DAC % of System Total | 2023, 2024, 2025 | 0.07, 0.083, 0.17 | nothing |

For A3 and A4 the engine is silent because CLCPA-212 refuses to sum an
average column. For F9 the denominator is genuinely unreproduced, which is
why that table already sits in `NOT_RECONCILED_TABLES` for rendering.

### The eleventh nominee: RATIFIED as deferred

| table | row | column | year | stored | engine |
|---|---|---|---|---|---|
| A8 | Residential Programs Total Installations | Total | 2023 | 47,350 | nothing |

The census proposed sixteen cells; five ship and the first ruling addressed
ten of the remaining eleven, as three rejected and seven deferred. This was
the eleventh, and it was recorded as deferred on my own classification with
that fact flagged.

**Ratified 2026-09-21:** same family, same client question as its sibling.
The classification stands as ruled, and it joins the deferred set in section
4 rather than remaining an open item.

Note that it sits in A8's **2023** schema, whose figure column is headed
`Total`, not the `Total Installations` of 2025. That is why it appears as a
separate entry from the confirmed A8 member rather than another year of it.

## 5. The wider set of data questions this joins

These nominees are not the only figures waiting on the same conversation.
Recorded together so the conversation covers them at once:

- **The twelve kept-candidate cells** (CLCPA-241). Engaged for every rule,
  the kept-figure conditional would hold 14 cells rather than 2: A1/2024,
  A2/2023, eight across A6/2023-2025 and two in G5/2024. `keepFiled` stays
  opt-in and only the percent-change rule engages it, so those four tables
  keep today's published behaviour.
- **A9/2024's two filed figures** (CLCPA-241 / CLCPA-289). Energy Savings
  (MMBtu) files 8% where its own rows give 33.362%, and Average Incentive
  per Participant files 62% where they give 62.500%. Both are kept and
  named; the app refuses to resolve them by recomputing.
- **A5/2025 and A3/2025's stored grand totals** (CLCPA-238 lineage): A5
  stores 27,833 against 27,834 from its own parts, A3 is off by 31.
  Invisible on stored data, visible the moment a year is imported fresh.

## 6. How to add a member

1. Run `census_293_r4.js` and read the nominee's evidence: the engine's own
   attempt against the stored figure, in every stored year.
2. Establish that the silence is **structural**, not data-shaped. The C2
   case in section 3 is the test to apply: would the engine derive this cell
   if the body rows held plain numbers?
3. Confirm with the owner. Membership is a statement about Con Edison's
   reporting and is not ours to infer.
4. Add the entry, run `suite_293_r4.js` and `mut_293_r4.js`, and expect
   `suite_320`'s marker inventory and the drift registries to need
   re-pointing: a new member withholds a workbook marker.
