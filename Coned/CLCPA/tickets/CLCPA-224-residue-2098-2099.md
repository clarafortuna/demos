# CLCPA-224 residue: the 2098/2099 parallel-audit rows in the org store

**Type:** residue list entry, for the cleanup ticket
**Date:** 2026-09-18
**Raised by:** the CLCPA-278 round 3 store measurement
**Evidence:** `tickets/org-reads-evidence/store-read-2098-2099.txt`
(the full per-cell listing), `tickets/CLCPA-278-store-measurement.md`

## What the cleanup should name

The parallel audit's seeding left **51 ingest override rows** in
`cr2bf_dacingesttesttabledata1s` across years 2098 and 2099. Read-only, on
2026-09-18, one filtered `GET`. Nothing was written.

Within them, **44 cells hold numeric-looking STRINGS where the engine expects
numbers**, and those are the ones this ticket should name, because they are the
only part of the residue that changes how the application behaves rather than
merely occupying a year:

| year | table | column | cells | row labels |
|---|---|---|---|---|
| 2098 | **A3** | column 1 | **22** | Residential, Multisector, Multifamily, Commercial |
| 2098 | **A4** | column 1 | **22** | Residential, Multisector, Multifamily, Commercial |

Raw values, patterned and plainly synthetic:

- A3: `"333" "111" "888" "666" "444" "222" "999" "777" "555"`
- A4: `"907" "507" "107" "607" "207" "707" "307" "807" "407"`

Every cell is listed individually, with its row label and column, in
`store-read-2098-2099.txt`.

## The rest of the residue, for completeness

| | value cells | string cells | numeric-looking |
|---|---|---|---|
| 2098 + 2099, all 51 rows | 2,100 | 112 | 44 |

The other 68 string cells sit in C1 2098 (10), I1 2098 (10) and I1 2099 (4).
They are **not** numeric-looking, so no rule reads them as figures either
before or after CLCPA-278 round 3. They are residue to clear, but they change
no behaviour. **2099 carries no numeric-looking cells at all.**

Tables present in the residue: 2098 holds A1-A8, B1, B2, C1-C5, D1-D4, E1,
F1-F9, G1, G2, G5, G7, G9, H1, I1, J1. 2099 holds A1, A2, A5, B1, C1, C3, C4,
C5, E1, G1, H1, I1.

## Why it matters to this cleanup specifically

CLCPA-278 round 3 makes `bareNumber` the one reader for adding a row up, which
means a numeric-looking string becomes the number it spells. On those 44 cells
that is a real behavioural change: A3/A4 2098's column 1 goes from invisible to
the sum engine to summable, so totals, reconciliation advisories and
consistency judgements on those two table-years can all move.

That change was **disclosed and accepted** by ruling on 2026-09-18, on the
grounds that these are audit scaffolding rather than reporting data. It was
accepted BECAUSE this cleanup will remove them. If the cleanup is descoped or
deferred indefinitely, that acceptance should be revisited rather than
inherited.

Not measured, and not to be assumed: by how much any A3/A4 2098 figure actually
moves. Nobody has driven the engine against these rows.

## A related member of the same family

The CLCPA-274 round 3 finding came from the same seeding: F6's template for a
user-added year with saved rows emitted `"607" / "907" / "307"` style figures
into the sub-header position. That was an application defect and is fixed
independently, but the values that made it visible are this residue.
