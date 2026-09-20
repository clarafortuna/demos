# CLCPA-330: the defect is real and reproduced, and the honest fix needs a row type that does not exist

**Raised:** 2026-09-20, on `6d90274`
**Status:** STOPPED before code. Nothing written to `app.js`.
**Why:** every way to fix this either writes stored data into a frozen
`payload.json` or hardcodes dashboard data in the app. Both are lines the
owner has drawn.

---

## 1. It reproduces, in a browser, on the real section page

Section A, table A9, through the real tab. What the page renders today:

| row | renders | should be |
|---|---|---|
| Incentives | `$380.3M` | correct, money |
| **Energy Savings (MMBtu)** | **`$4.4M`** | `4.4M`, MMBtu |
| **Participation** | **`$2.1M`** | `2.1M`, participants |
| Average Incentive per Participant | `$182` | correct, money |
| **Average Energy Savings Per Participant** | **`$2.09`** | `2.09`, MMBtu |

**Three of the five data rows are wrong.** The `% Change` columns are
unaffected: they are columns 5 and 6, and `currency_cols` does not name them.

## 2. The cause is that the declaration is per COLUMN and the table is not

```
A9.currency_cols = [1, 2, 3, 4]
```

That is a statement about columns. A9's columns are `Total` and `DAC` for two
years, and every one of them holds money on one row and MMBtu on the next. The
unit belongs to the **row**, and the table definition has no way to say so.

## 3. What could be derived, measured rather than assumed

- **A per-row type key.** Across every table in the payload the definition
  keys are exactly: `currency_cols, data, header_levels, id, mapping, number,
  schema_by_year, section, short_title, title_by_year`. **There is no per-row
  type anywhere.**
- **A cross-reference to another table.** Each of A9's five row labels was
  searched against every column heading of every table and year.
  **None of them appears as a column heading anywhere.** So the unit cannot be
  inherited from the table that supplies the figure.
- **The value itself.** `4,360,879` MMBtu and `380,265,714` dollars are both
  plain numbers. Nothing in the data separates them.

That leaves the row label, and reading it means a keyword map from
`Incentive` to money, which is hardcoded dashboard data.

## 4. So both routes are blocked, and each by a standing rule

**(a) Declare a row type in the table definition.** This is the correct model:
it says the true thing, it is read not computed, and it makes every row format
by its own type. It is also a **shape change to `payload.json`**, which the
freeze forbids outside a review phase, and it is stored data.

**(b) Map row labels to units in code.** No stored data, no shape change, and
it would work today. It is also exactly the hardcoded dashboard data the
standing rules forbid, and it breaks the moment Con Edison renames a row.

**(c) Drop `currency_cols` from A9.** No stored-data write, but it loses the
`$` on the two rows that are genuinely money. It trades three wrong cells for
two, which is not a fix.

## 5. The CLCPA-325 interaction, as ordered: it is NOT one shared fix

Measured across the whole payload with the app's own `detectCurrencyColumns`
and `isPercentLiteral`:

> **a percent value sitting in a currency column: 0 occurrences.**

And J8 on the section page renders its percent rows correctly:

```
["% of total in DAC",     "67%", "59%", ""]
["% of total in non-DAC", "33%", "41%", ""]
```

**CLCPA-325 does not reproduce from `payload.json`.** J8's percent rows are
saved by being stored as the *strings* `"67%"`, which `bareNumber` refuses by
design. The `$` on J8's other three rows is correct: they are Electric and Gas
dollar amounts, and J8 declares no `currency_cols`, so the currency columns
there are inferred.

The two tickets therefore have **different roots**:

| | CLCPA-330 (A9) | CLCPA-325 (J8) |
|---|---|---|
| declaration | `currency_cols` explicit | inferred |
| what is wrong | the row's unit is unknowable | a percent would need to be numeric |
| reproduces here | **yes, 3 rows** | **no, 0 occurrences** |

One fix does not cover both. If 325 is real in the org, the likely mechanism is
a J8 year whose percent cells are stored **numerically** rather than as `"67%"`
strings, which would put a real percent into an inferred currency column. That
is a question about the org's stored values, and reading them is not authorised
here.

## 6. Recommendation

**Option (a), taken with the schema freeze lift already queued.** CLCPA-295 is
waiting on exactly that lift for A6 and A7's stray `" Total"` headings, and
this is the same class of change: a correction to what the table definition
*says*, not to what the app computes. Declaring A9's row types belongs in that
wave.

The preparation that does not need the lift is done and recorded here: the
three wrong rows are identified, the two correct ones are identified, and the
`% Change` columns are confirmed out of scope.

**Not built. No code was written.**
