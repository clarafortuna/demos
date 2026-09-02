# CLCPA-209: the editor total-row predicate misclassifies data rows, corrupting D2, D3, D4 and F7 on open

**Type:** Bug
**Priority:** High
**Component:** ExecutiveDashboard_dev, ingest editor
**Found:** while building CLCPA-205 item 1, 2026-09-02
**Related:** CLCPA-205 item 1 (hierarchy fix, ships the interim containment), CLCPA-142
(persisted-override cleanup, the same family as the scan half of this ticket)
**Supersedes the open question in:** CLCPA-203, which is CLOSED and therefore cannot
carry it

## Summary

`recomputeTotals` decides which rows are total rows using `editorTotalRowTest`,
which returns the **loose** predicate `isTotalRowLabel` for every table except J1
and J2. The loose predicate is an unanchored `/total/i` match, so any DATA row whose
label merely contains the word "total" is treated as a total row and has its cells
overwritten with a column sum.

Four tables are affected, and the values written are not close to the real ones:

| table | row | stored | editor writes |
|---|---|---|---|
| D2/2025 | `Total # of projects` | 88,150 | **0.688** |
| D2/2025 | `Total MW installed (All DERs)` | 1,234.34 | **0.688** |
| D3/2025 | `Total # of subscribers` | 20,679 | **0.441** |
| D4/2025 | `Total MW installed` | 775.8 | **0.709** |
| F7/2025 | `% of Grand Total` | `"32%"` | **167965** |

The written value is the sum of the rows the predicate did NOT match, which in
these tables are the percentage rows. So a magnitude in the tens of thousands is
replaced by a sum of two fractions.

**Measured exposure: 12 table-years, 74 cells.** D2, D3 and D4 across 2023, 2024
and 2025, and F7 across the same three years.

## Why this is a write path, not a display quirk

`recomputeTotals` runs on **every render of the ingest editor**, not only on edit.
Opening one of these tables is enough to put the corrupted values into the draft,
and any Save then persists them. This is the same mechanism recorded in the
CLCPA-144 comment about opening a table nulling its cells.

## Interim already in place

CLCPA-205 item 1 shipped a containment set:

```js
const RECOMPUTE_TOTALS_EXEMPT = new Set(['D2', 'D3', 'D4', 'F7']);
```

`recomputeTotals` writes no additive total cells for these four. None of them has a
`DERIVED_COLS` rule, so the function is a complete no-op for them and the corruption
path is closed. The CLCPA-205 harness asserts the no-op per table and per year, with
negative controls showing the pre-fix engine producing the corrupted values, so the
containment cannot silently regress.

**The fix in CLCPA-209 REMOVES that set.** Leaving it in place after the predicate
is corrected would be a silent carve-out.

## The real difficulty: loose is required and harmful at the same time

The obvious fix, tightening the predicate, is not available. A5's own segment total
labels fail the strict test, and A5 is one of the tables CLCPA-205 item 1 exists to
repair:

| label | source | loose `/total/i` | strict `/^(grand\s+\|sub)?totals?$/i` |
|---|---|---|---|
| `Total # of projects` | D2 data row | matches, **wrong** | no |
| `Total MW installed` | D4 data row | matches, **wrong** | no |
| `% of Grand Total` | F7 data row | matches, **wrong** | no |
| `Small-Medium Business Total` | A5 segment total | matches, **right** | **no** |
| `Commercial Total` | A5 grand total | matches, **right** | **no** |
| `Subtotal` | A5/2023 segment total | matches, right | yes |
| `Grand Total` | F7, E1 | matches, right | yes |

So neither predicate is correct for the whole payload. Loose misclassifies D2-style
data rows; strict misclassifies A5-style segment totals. A single label regex cannot
separate them, because the distinguishing property is not in the label.

## What the distinguishing property actually is

From the CLCPA-205 survey, a genuine total row has **structure** around it, not just
a word in its label:

- A5, A6 and A8 segment totals are preceded by a header row with empty values and
  then one or more data rows. The total row closes a segment.
- D2, D3 and D4 "Total ..." rows are consecutive, with no data rows between them,
  and the rows that are NOT matched are the percentage rows. There is no segment to
  close.
- F7's `% of Grand Total` sits directly after `Grand Total`, again closing nothing.

That suggests the reliable test is positional, the same insight CLCPA-205 item 1
used for segmentation: a row is a total row when it closes a non-empty segment, or
when it is the single trailing total of a flat table. Worth evaluating that against
the whole payload before choosing.

## Candidate approaches, none yet chosen

1. **Structural classification.** Replace the label test with the positional rule
   above. Most likely correct, and it removes the containment set and the
   `EDITOR_STRICT_TOTALS` carve-out for J1/J2 at the same time. Needs a payload-wide
   before-and-after because it reclassifies rows everywhere.
2. **Per-table declaration.** Add an explicit `total_rows` list per table and year
   to the payload, so classification stops being inferred at all. Most robust, most
   data work, and it is the direction CLCPA-139's "base inputs only" design points.
3. **Widen the carve-out sets.** What the interim does. Rejected as a permanent fix:
   it scales with the payload and every new table is a new opportunity to miss one.

## Second half of this ticket: has corrupted data already been saved?

**A scan is required, not optional.** The corruption reaches the draft on open and
persists on Save, so some already-saved override may carry it. This half is the same
family as **CLCPA-142** (cleaning contaminated persisted overrides), and should
probably be executed with it.

Scope of the scan:

- the dev store, `localStorage` key `dac:overrides`
- the Dataverse-backed store, `cr2bf_dacingesttesttabledata1`, which holds a JSON
  blob of rows per table and year, plus `cr2bf_dacingesttestchangehistory`
- for D2, D3, D4 and F7 specifically, compare each saved row against
  `payload.json` and flag any where a magnitude has been replaced by a value under 1
- report counts before proposing any write, and treat the write as its own
  authorised step

The signature is distinctive and easy to detect: a cell that should hold thousands
holding a number below 1, in a row whose label begins with "Total".

## Acceptance

1. D2, D3, D4 and F7 survive `recomputeTotals` unchanged, without needing
   `RECOMPUTE_TOTALS_EXEMPT`, and **that set is deleted**.
2. A5, A6 and A8 segment totals still compute correctly, and the CLCPA-205 harness
   still passes with its expected-movers census updated rather than relaxed.
3. J1 and J2 still survive untouched, and `EDITOR_STRICT_TOTALS` is either removed
   as redundant or its continued need is explained.
4. A payload-wide before-and-after census showing every row whose classification
   changes, with each change attributed as correct or accepted.
5. The saved-data scan is run and reported, even if the answer is that nothing was
   saved. A clean result is a finding worth recording.
6. All-years validation, per the standing rule: any rule chosen is checked against
   2023, 2024 and 2025.
