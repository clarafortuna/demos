# CLCPA-278 round 3: the org-store measurement, and the ruling on it

**Type:** ticket comment, for the record
**Date:** 2026-09-18
**Build under test:** `3b20bdbd6d` (the deployed build at the time of the read)
**Evidence:** `tickets/org-reads-evidence/read_store_2098_2099.js`,
`tickets/org-reads-evidence/store-read-2098-2099.txt`

## Why this read happened

The ruling on CLCPA-278 round 3 approved the shared-reader change under four
conditions. Condition 2 required the zero-effect measurement to cover the ORG
STORE, not only `payload.json`, because the user-added years live in the store
and 2098/2099 hold saved rows from the parallel audit.

That half could not be measured offline: there is no local copy of the store. It
was reported as MISSING rather than estimated, and settled by one read-only
authenticated run on the owner's explicit GO.

## What was read

One filtered `GET` against `cr2bf_dacingesttesttabledata1s` for
`cr2bf_year eq 2098 or cr2bf_year eq 2099`, selecting key, section, tableid,
year, rows and schema. **51 override rows.** No writes, no deletes. The only
non-`GET` in the script is the device-code exchange to
`login.microsoftonline.com`, which carries no org data, and the script audits
its own text for both facts before requesting the code.

`bareNumber` was sliced out of the shipped `app.js` rather than retyped, and
behaviour-checked (`"1,098"` -> `1098`, `"33%"` -> `null`) before it counted
anything. A retyped copy of the rule under test is how a measurement comes back
agreeing with itself.

Column 0 is excluded throughout: it is the row label and text by design.

## The numbers

| | value cells | string cells | numeric-looking |
|---|---|---|---|
| 2098 + 2099, all tables | 2,100 | 112 | **44** |

Concentrated in two table-years, one column:

| year | table | rows | value cells | string cells | numeric-looking |
|---|---|---|---|---|---|
| 2098 | A3 | 45 | 180 | 44 | **22** |
| 2098 | A4 | 45 | 180 | 44 | **22** |
| 2098 | C1 | 5 | 25 | 10 | 0 |
| 2098 | I1 | 9 | 18 | 10 | 0 |
| 2099 | I1 | 9 | 18 | 4 | 0 |

Every other table in both years holds **no** string value cells at all, and
**2099 has no numeric-looking cells**. The other 68 string cells (C1, I1) are
not numeric-looking, so `bareNumber` refuses them before and after.

All 44 sit in **column 1** of A3 and A4 for 2098, on rows labelled Residential,
Multisector, Multifamily and Commercial. The raw values are patterned:
`"333" "111" "888" "666" "444" "222" "999" "777" "555"` in A3, and
`"907" "507" "107" "607" "207" "707" "307" "807" "407"` in A4. Every one is
listed individually in `store-read-2098-2099.txt`.

## The behavioural change on those 44 cells

Under the build that was deployed, those cells are invisible to the sum engine:
`typeof !== 'number'`, so A3 and A4's column 1 takes no part in any total, any
reconciliation, or any consistency judgement.

After the change they become readable, so on those two table-years:

- `columnGrandTotals` starts summing column 1, so `recomputeTotals` may write
  different figures into A3/A4 2098's totals;
- `reconcileSumColumns` may raise or drop advisories there;
- `rowSumIsConsistent` may newly judge those rows.

NOT MEASURED, and stated as such: by how much any figure moves. That needs the
engine driven against the real store rows, which is more than a read of raw
cells.

## The ruling

The owner ruled that A3/A4 2098 is **parallel-audit scaffolding, not reporting
data** -- the same seeded family the CLCPA-274 round 3 finding surfaced in F6's
template -- and that the whole 2098/2099 residue is already sentenced to the
CLCPA-224 cleanup.

Disposition: **the behavioural change on those 44 cells is ACCEPTED AS
DISCLOSED.** No design revision. No out-of-turn Dataverse write to correct the
data, because it buys nothing the CLCPA-224 cleanup will not. The 44 cells are
named explicitly in that cleanup's residue list, see
`CLCPA-224-residue-2098-2099.md`.

**Condition 2 closes as measured-and-ruled**, not as zero-effect. The correct
statement of the change's blast radius is:

- `payload.json`: 668 string value cells, **0** newly readable; across all 149
  stored table-years `recomputeTotals` writes identical figures and the
  advisory count is unchanged.
- the org store, 2098/2099: **44** newly readable cells, all audit scaffolding
  in A3/A4 2098 column 1.

## A correction to the record

My round 3 report led with the `payload.json` number and described the change as
zero-effect on stored data. That was true of the half I could read and wrong as
a general claim, and the store half was the one that mattered. The MISSING flag
was correct; the emphasis around it was not.
