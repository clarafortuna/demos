# CLCPA-213: table dropdown sorts lexicographically, so G.10 lands between G.1 and G.2

**Type:** Bug
**Priority:** Low
**Component:** ExecutiveDashboard, table selector
**Found:** 2026-09-03 by Emely, hosted verification of build `e6d7903772`
**Related:** CLCPA-212 (rides the same deploy; both are ingest-editor surface)

## Summary

The table selector orders entries as strings, so two-digit table numbers sort next to the single-digit one sharing their first digit:

```
   G.1
   G.10     <- belongs at the end
   G.2
   G.3
   ...
   G.9
```

Same for A.10, which lands between A.1 and A.2. Every other section is unaffected because none reaches ten tables.

## Cause

The table list is sorted with `a.id.localeCompare(b.id)`, which compares `"G10"` against `"G2"` character by character: `"1" < "2"`, so `G10` precedes `G2`.

`initIngestState` uses the same comparator to pick the default table, so the first entry in a section is whichever id sorts first lexicographically.

## Proposed fix

A natural sort in the selector: split each id into its letter prefix and numeric suffix, compare the prefix as a string and the suffix as a number.

```js
function compareTableIds(a, b) {
  const pa = /^([A-Z]+)(\d+)$/.exec(a) || [null, a, '0'];
  const pb = /^([A-Z]+)(\d+)$/.exec(b) || [null, b, '0'];
  return pa[1] === pb[1] ? Number(pa[2]) - Number(pb[2]) : pa[1].localeCompare(pb[1]);
}
```

Applied everywhere table ids are ordered for display, not just the dropdown.

## Acceptance criteria

1. Section G reads G.1, G.2, ... G.9, G.10. Section A reads A.1 ... A.9, A.10.
2. Every other section's order is unchanged. Asserted, since sections with fewer than ten tables must not move.
3. Ids that do not match `letter+digits` still sort deterministically and do not throw.
4. The default table a section opens on is asserted, since the comparator also feeds `initIngestState` and section A's default would change from A.1 only if A.1 stopped sorting first (it does not).
5. Any other display-ordered list of table ids uses the same comparator. The enumeration is part of the fix.

## Notes

Display-only, no figures involved. Rides the next deploy alongside CLCPA-212.
