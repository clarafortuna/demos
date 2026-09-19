# CLCPA-286 re-verified on the current tip: the premise does not hold

**Ticket:** A9 and A10 provide no structural scaffold on a newly populated year
**Filed against:** `b1108e5fcf`
**Re-verified:** 2026-09-19, on the CLCPA-282 tip, in Chrome on a served build
**Verdict:** RETIRE the finding as filed. One real question survives and needs a
ruling; no code was written.

## What the ticket expects

> the draft opens pre-populated with the table's structural rows, as A1 (23
> rows), A5 (50), A6 (33), A7 (4) and A8 (26) do

## What is measured

Section A, year 2094, user-added, nothing saved. Every table opened in the
Report Data editor and its editable rows counted:

| table | rows on 2094 | rows on 2025 (seed) |
|---|---|---|
| A1 | **0** | 22 |
| A2 | **0** | - |
| A3 | **0** | - |
| A4 | **0** | - |
| A5 | **0** | - |
| A6 | **0** | - |
| A7 | **0** | - |
| A8 | **0** | - |
| A9 | **0** | 5 |
| A10 | **0** | 5 |

**No Section A table scaffolds a fresh year.** A9 and A10 are not the
exception the ticket describes; they behave exactly like A1 and A5 through A8.

## Why, and it is deliberate

`loadIngestDraft` sets the draft from `getTableBody(table, year)`, which is `[]`
for a year that holds nothing. There is no scaffold code for any table. The
design is stated in `app.js` in as many words:

> "+ Add year" seeds NOTHING. `applyAddedYears()` appends the year to
> `meta.years` and creates no table data, so `getTableBody()` returns `[]` and a
> freshly added year opens as a table with ZERO rows.

That comment predates the ticket. The counts the ticket quotes -- A1 23 rows,
A5 50, A6 33 -- are the rows those tables hold on a **seed** year, not rows a
fresh year is given.

## What actually made A9 and A10 unfillable

The ticket's own impact line is the real defect:

> With the import path blocked (285), a preparer's only option is Add Row
> against a table whose row identities and sub-header band they have no
> reference for.

**That is now fixed.** CLCPA-282 option A landed in this same stack and CLCPA-285
closes with it: A9 and A10 import their template-built CSVs, 6 matching columns
and the values in the right cells. The preparer's reference is the template,
which does carry the row labels -- measured, A9's 2094 template emits
`Incentives`, `Energy Savings (MMBtu)`, `Participation`.

So the condition that made these two tables unfillable is gone, by the fix the
ticket itself points at.

## The question that survives, for a ruling

**Should a freshly added year open pre-populated with the table's structural
rows, for every table?**

It is a fair product question and the answer is not obvious:

- **For it:** a preparer filling A5's fifty hierarchical rows by hand, in the
  right order, with the right group structure, is doing work the app already
  knows how to do. The import path exists precisely because that is unreasonable.
- **Against it:** a scaffolded year is not empty, and "empty" currently means
  something -- it is what `isEmptyYearData` and the remove-year contract read.
  Scaffolding would put label-only rows into every table-year an operator
  creates, and those rows would save. It also interacts with CLCPA-283, which
  this stack just changed.

**It is not an A9/A10 fix.** Scaffolding only those two would manufacture the
inconsistency the ticket complains about, pointing the other way.

**Recommendation:** leave the editor as it is and treat the template as the
reference it was designed to be. If scaffolding is wanted, file it as its own
ticket against the whole ingest path, decided together with what "an empty
year" means to the remove-year contract.

**No code written.** This is a measured retirement plus one escalation.
