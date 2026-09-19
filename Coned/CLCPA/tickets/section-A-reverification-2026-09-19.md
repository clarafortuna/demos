# Section A board, re-verified on the current tip

**Re-verified:** 2026-09-19, against the CLCPA-282 tip (`f66e7ae`)
**Findings originally recorded against:** `b1108e5fcf`, many waves back
**Rule applied:** a finding already fixed retires with evidence and no code.

Every measurement below is from the tip: stored shape read from
`payload.json`, template output read out of the generated workbook, the derive
engine driven through its real functions, and the rendered surfaces driven in
Chrome on a served build.

## Verdicts

| ticket | verdict | one line |
|---|---|---|
| **285** | **CLOSED** | by the CLCPA-282 build in this stack -- A9/A10 import their template CSVs |
| **286** | **RETIRED** | its premise is false: no Section A table scaffolds a fresh year, by design |
| **296** | **RETIRED** | no group header shares a label with any other row; the suffix convention IS applied |
| **287** | reproduces | needs a build |
| **289** | reproduces | needs a build |
| **290** | reproduces | needs a build; the exact shape needs confirming on the editor surface |
| **291** | reproduces | needs a build |
| **292** | reproduces | needs a build |
| **294** | reproduces | needs a build |
| **295** | reproduces | **needs a ruling first** -- the strings are stored schema |
| **300** | reproduces | needs a build, low severity, owner pre-ruling already recorded |

Two retirements and one closure out of eleven. Both retirements are premise
failures, not fixes that happened along the way.

---

## RETIRED: CLCPA-296 -- the collision is still latent, not actual

The ticket upgrades CLCPA-124/C-01 from LATENT to **CONFIRMED ACTUAL**, on the
claim that in A5 a group-header row and its per-group subtotal both read
`Clean Heat – Commercial & Industrial Air Source Heat Pump`.

Measured, A5 rows 0-2:

```
 0  [GROUP HEADER]  "Clean Heat – Commercial & Industrial Air Source Heat Pump"
 1  [data]          "HVAC"
 2  [subtotal]      "Clean Heat – Commercial & Industrial Air Source Heat Pump Total"
```

They differ: the subtotal carries the `" Total"` suffix. Across **A5, A6, A7
and A8**, the count of group headers whose label also appears on any
non-header row is **zero**.

The duplicate first-column values that do exist -- `HVAC` 18 times in A5, 14 in
A6, 5 in A8 -- are **data rows in different groups**, which is exactly the case
CLCPA-240 already handles with the composite (group, label) key. Counting bare
labels overstates it; that is the trap this re-verification had to avoid.

A7 has **zero** duplicate first-column values at all, so the ticket naming
A5/A6/A7 is wrong on A7 twice over.

**No stored keys need touching**, so the ticket's own STOP clause does not
fire. C-01 stays LATENT.

## RETIRED: CLCPA-286

Recorded in full in `CLCPA-286-reverification.md`. In short: no Section A table
scaffolds a fresh year, A9 and A10 are not exceptional, and the counts the
ticket quotes are seed-year rows. What made the two tables unfillable was the
blocked import path, fixed here.

---

## Reproduces, with the measurement

### CLCPA-289 -- A9's derived pair is not marked

A9's template contains **0** `(calculated)` markers. A10's contains **10**.

A9's `% Change` pair is genuinely derived: stored 2025 reads
`["Incentives", 380265714, 204785586, 282132687, 148672655, "-26%", "-27%"]`,
and 282132687 against 380265714 is -25.8%, which rounds to the stored -26%.

So the template presents two derived columns as preparer-entered. Confirmed.

### CLCPA-291 -- a text cell marked (calculated)

A3 and A4 template Total row, measured:

```
["Total","(calculated)","(calculated)","(calculated)","(calculated)"]
```

Column B is `Program Name`, a text column the engine cannot compute. It should
carry the structural `(no value)` marker. Confirmed, both tables.

### CLCPA-292 -- the key column is not pre-filled

A3 and A4 emit a non-blank column B in **1 of 23** template rows, and that one
is the Total row's `(calculated)`. Every real row's `Program Name` is blank
while column A repeats the Participant Type. Confirmed.

Note the interaction the ticket names: 292 must emit whatever key convention
296 lands -- and 296 has just retired, so **the existing suffix convention
stands and 292 is unblocked**.

### CLCPA-294 -- a computed ratio loses its x100 at 1

Driven through the real display derivation on A1's `% in DACs`:

| parts | ratio | rendered value |
|---|---|---|
| 333 of 888 | 0.375 | `0.375` -> shows 37.5% |
| 333 of 333 | 1 | **`1`** |
| 777 of 333 | 2.333 | **`2.3333333333333335`** |
| 555 of 0.1 | 5550 | **`5550`** |

Below 1 the derivation yields a fraction the formatter scales; at or above 1 it
yields the raw ratio and the scaling never happens. Confirmed, and the ticket's
own caveat stands: this fires only on data where DAC exceeds Total, which is
itself invalid -- but it disguises exactly the anomaly those cells exist to
expose.

### CLCPA-290 -- the A3/A4 Total row

Reproduces, and **the shape needs pinning down before a build**. On the display
derivation, with the Total row emptied so the engine must fill it, A3 and A4
both return `["Total", null, null, null, null]` -- *none* of the three compute,
where the ticket reports one of three computing. That is a different surface
from the ticket's observation, which was the editor on a fresh year.

The column sums are present and computable: A3 col 2 sums to 2,034,907 over 22
rows, col 3 to 3,761,329 over 21, col 4 to 22,297.2 over 21. So the data is
there and the engine declines it.

**First act of the build is the browser reproduction on the editor surface**,
per the standing standard, to establish which of the two shapes is the live one.

### CLCPA-287 -- the rejection is never reported on the page

Observed live during the CLCPA-282 work, twice, on A9 and A10: after a rejected
import, the dialog's red note appears and `#ingest-import-mount` on the page is
**empty**. The dialog's own promise -- "Add Year will still add the year, and
the page will say what was rejected" -- is not kept. Confirmed.

### CLCPA-300 -- the matching-columns count

Observed live during this session's runs. H1 with one data row reports
**"3 matching columns, 2 values"**: the third counted column is the calculated
Grand Total, which is not imported. The value count is right; the column count
is not a check figure. Confirmed, low severity, and the owner's pre-ruling
already names both acceptable answers.

---

## Needs a ruling before any code: CLCPA-295

Measured:

| table | heading[0] | is it a total-row label? |
|---|---|---|
| A5 | `Commercial Programs Installations` | no |
| A6 | `Multifamily Programs Installations Total` | **yes, character for character** |
| A7 | `Multisector Programs Installations Total` | **yes, and it appears in A7's own rows** |
| A8 | `Residential Programs Installations` | no |

So A6 and A7 carry a stray `" Total"` that A5 and A8 do not, exactly as filed.

**These strings live in `schema_by_year`, which is stored data.** The ticket's
own note requires stating which kind of fix this is before building, and the
payload is frozen. The options:

1. **Render-side strip.** Derive the displayed heading by removing a trailing
   `" Total"` when it duplicates a total-row label in the same table. No stored
   data moves. The cost is a derivation that exists only to paper over two
   strings, and it would silently alter any future heading that legitimately
   ends in "Total".
2. **Ruled data touch.** Correct the two strings in `schema_by_year`. One line
   of data, exactly right, and it needs the payload freeze lifted for it.
3. **Leave it.** Cosmetic, two headings, and the report has shipped this way.

**Recommendation: (2)**, as a single ruled data correction when the freeze next
lifts, because the strings are simply wrong and a derivation built to hide two
wrong strings is worse than the strings. **(1)** if the freeze will not lift
before the deadline. No code written either way.

---

## What this leaves to build

Six builds -- **287, 289, 290, 291, 292, 294** -- plus **300** if the reword is
wanted, and **295** on a ruling.

**Not priced.** The owner's instruction was to price the Section A builds when
the re-verification ran, and the re-verification has changed what they are: two
retired, one closed, and 290's shape still unsettled. Pricing 290 before its
surface is established would be inventing a number, and 295 has no scope until
it is ruled. The remaining five are small and share two mechanisms -- marker
semantics (289, 291, 292) and the derive engine (290, 294) -- so they will cost
less together than apart.
