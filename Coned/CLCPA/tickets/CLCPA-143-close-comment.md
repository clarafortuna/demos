# CLCPA-143 close comment

Both items shipped and verified. CLCPA-143 is complete.

**Item (a)**, deployed as build **`342094b187`** from `main @ 72b4ec9` (PR #173):
all three readers of `payload.kpis.reported[].values[yr].dac_pct` now derive the
share from the KPI's own `dac / total` instead of reading a stored copy. Hosted
verification passed on all four checks: the 8 figures, section J's header at 43.7%
matching J9, F9 and J8 byte-identical to stored, and section E unchanged at
40.0 / 50.0 / 45.0 as a documented residual.

**Item (b)**, a payload-only micro-deploy from `main @ e26f09b` (PR #174): the
hardcoded `43.5%` is removed from the `ev_equity_ratio` narrative. The live
`payload.json` web resource was fingerprinted read-only first and matched the repo
byte for byte (296,646 bytes, sha256 `8d606ecb9a003f50...`), so the edit landed on a
known base. Verified by **read-back SHA256**, not by byte count, since the edit
removes 8 bytes from a 296KB file: live now reads 296,638 bytes, sha256
`4757f60e896850ca...`, byte-identical to the local file, with the live narrative
parsed from the read-back bytes to confirm the figure is gone. `app.js` was not a
target, so the build id is unchanged.

Note on item (b): the `narrative` field has **zero readers** in
`ExecutiveDashboard_dev/app.js` and in the HTML, so the changed sentence renders
nowhere in the hosted dashboard. The edit is preventive, removing a stale figure
from the data so that if narratives are ever surfaced they cannot carry a number
that has already drifted.

**Three readers, not the two in the ticket text.** The third, the "DAC share" row in
the Clean Energy Incentive Spend card tooltip, was found by sweeping every
`kpis.reported` and `.values[` access. Grepping for `dac_pct` alone misses it,
because the read is aliased through `ces` then `cesCurr`.

**Eight figures changed on screen**, all corrections of one defect: the stored
`dac_pct` was a rounded copy of a source table's percentage cell, and those cells
began deriving when CLCPA-141 added A1, A2 and J9 to `PERSIST_STRIP_TABLES`.

| KPI | year | before | after |
|---|---|---|---|
| clean_energy_spend | 2023 | 49.0% | 49.4% |
| clean_energy_spend | 2024 | 54.0% | 53.9% |
| clean_energy_spend | 2025 | 53.0% | 52.7% |
| energy_savings | 2023 | 41.0% | 41.3% |
| energy_savings | 2025 | 52.0% | 52.5% |
| dr_participation | 2023 | 31.0% | 31.1% |
| dr_participation | 2024 | 32.0% | 31.6% |
| residential_customers | 2025 | 44.0% | 43.7% |

The last one is the reported symptom: section J's header KPI now reads 43.7% for
2025, matching table J9.

## What this ticket does NOT resolve, stated explicitly

Six KPI-years still disagree with their source table, in three families. All are
pinned in the CLCPA-143 harness, so a new divergence fails a test, and each pin must
be deleted by the ticket that fixes its case, which means neither fix can land
silently.

**1. A2/2023: the table-versus-KPI disagreement persists, INVERTED. Tracked as
CLCPA-207.** A2/2023's stored Total exceeds the sum of its 28 program rows by 7.5%,
so the TABLE derives its Total percentage against an incomplete denominator and
shows **44.64%**, while the KPI card now correctly shows **41.29%**. Before this
change both were wrong in the same direction; now the card is right and the table is
still wrong. This is the only case in the whole sweep where the table is the wrong
side.

**2. strategic_capital, all three years. Tracked as CLCPA-208.** Section E's card
stays at 40.0 / 50.0 / 45.0 while table E1 renders 39.91 / 49.87 / 45.28. Cause:
this KPI's `dac` is not independent data. It is exactly `total x the stored rounded
percentage`, verified to the cent in all three years, so `dac / total` can only ever
return that rounded number. Making section E agree means reading E1's weighted mean
directly or regenerating the payload's `dac` for E. CLCPA-208 also records the
possibility that DAC dollars for section E never existed as source data, since E1
stores a percentage per category and no DAC dollar column, in which case dropping
the field is more honest than recomputing it.

**3. main_replacement 2023 and 2024. Also CLCPA-208.** Card 45.94 and 46.36 against
G1 showing 46.00 for both. Cause: G1 stores percentages with null feet for those two
years and has no "Systemwide Total" row, so the table can derive nothing and falls
back to its stored 0.46, while the KPI's inputs come from outside G1.
`main_replacement/2025` does agree, because G1/2025 has real feet, and that contrast
is the evidence that 2023 and 2024 are a data gap rather than a routing mistake.

**Family note.** CLCPA-207 and the `strategic_capital` half of CLCPA-208 both belong
with **CLCPA-206**: figures that arrived pre-computed from upstream and cannot be
reproduced from the data supplied alongside them. The known members are J8's
"% of Total" (206), F3/2025's "Con Edison (Overall)" = 6, A2/2023's Total (207) and
strategic_capital's DAC dollars (208). If the CLCPA-206 spelunk of the shared source
data recovers ConEd's actual formulas, it may explain several at once, so 206 is
worth running before 207 and 208 are investigated separately.

## Equivalence guard

`dac / total` is asserted against the source tables' stored totals for 30 of 33
KPI-years, so data that breaks the equivalence fails a test instead of diverging
quietly. Three years cannot be asserted and are declared with proven reasons:
`dr_participation/2023` (C2/2023's DAC row holds only percentage strings) and
`main_replacement/2023` and `/2024` (G1's null feet). The harness asserts that set is
exactly those three.

## Evidence

88 assertions with 6 negative controls in `clcpa143_kpi_test.js`, baseline pinned by
sha to `71f0875` and verified in-test to stamp as `3af6ee199f`, the build that was
live before this work. Negative control as specified: `rowsForDisplay` output across
the whole payload moves not one cell, F9 and J8 stay byte-identical to stored, and
six engine functions plus five descriptor constants are byte-identical.

Full sweep at close: **12 suites, 583 assertions, 0 failures.**

Two harness defects were found and fixed during the slice, both of which produced
false results rather than errors and are worth recording:

- Expected values for the 8 figures were transcribed as 7dp floats from an
  exploratory run, and **four of the eight were wrong**. That test was checking my
  typing rather than the code. They are now asserted as the **displayed strings**,
  which is what the render sites emit and what the table above quotes.
- Blast radius was measured by diffing the working tree against a baseline sha,
  which isolates a slice only until the next one lands. Item (b) then edited
  `payload.json` in the same tree and two suites reported a scope violation that was
  really just later work existing. Both now diff their own commit against its
  parent, which is stable permanently.
