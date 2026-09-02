# CLCPA-142 phase 2 and CLCPA-209 scan half: findings and proposed cleanup

**Type:** Findings report, read-only scan
**Ran:** 2026-09-02
**Estimate for this read-only half:** 1.5 to 2.5 hours (stated before starting)
**Changes made:** none. 3 GET requests, zero writes of any kind.
**Related:** CLCPA-142 (persisted derived cells), CLCPA-209 (predicate
misclassification), CLCPA-143 (the strip-set gap, closed, which is why a cleanup
will now last)

## Headline

| family | result |
|---|---|
| **CLCPA-142** | **644 contaminated cells** across **66 table-years**. Contamination is **seeded, not save-driven**: 641 of 644 stored values are byte-equal to the payload, and 65 of the 66 table-years have no save history at all. |
| **CLCPA-209** | **0 cells.** Genuine cleanliness, not absence: D2, D3, D4 and F7 each hold three override records with correct row counts, and none carries the corruption signature. |
| **overlap** | **0 cells.** The two families do not interact, so the cleanups are independent. |

**The three genuine edits are the interesting part.** Only 3 of the 644 differ from
the payload, all in A1/2025, and one of them is the original CLCPA-141 contamination
still sitting in Dataverse.

## Evidence files, exported this time

The 2026-08-03 scan left its results in `window.__clcpa142` and they died with the
page reload. These are files.

| file | contents |
|---|---|
| `CLCPA-142-209-scan-clcpa142-hits.json` | all 644 Family 1 cells, with record id, key, table, year, row, column, row label, stored value |
| `CLCPA-142-209-scan-clcpa142-hits.csv` | the same, flat, for pasting into a ticket |
| `CLCPA-142-209-scan-clcpa142-edited-cells.json` | the 3 cells that differ from the payload |
| `CLCPA-142-209-scan-clcpa209-hits.json` | Family 2, an empty array, kept so the zero is an artifact and not a claim |
| `CLCPA-142-209-scan-report.json` | the full run record: counts, distributions, save history, per-record index, GET count |

### A note on the dashes in the hit lists

`CLCPA-142-209-scan-clcpa142-hits.json` and its CSV contain 80 en dashes, inside row
labels such as "Clean Heat - Residential ASHP". Those are copied VERBATIM from the
override records, which hold the payload's own program names. Same standing decision
as the CLCPA-144 evidence: the no-long-dash rule governs text I author, and quoted
data is reproduced faithfully, because altering a row label inside a hit list would
break the coordinate it identifies.

## What was read

| store | records |
|---|---|
| `cr2bf_dacingesttesttabledata1s` | **149** override records, 52 distinct tables, all blobs parsed cleanly |
| `cr2bf_dacingesttestchangehistories` | **16** entries |
| `localStorage dac:overrides` (dev store) | **NOT READ.** Browser-only, unreachable from Node. Reported as unread, not as clean. A console snippet that downloads its result is offered below. |

3 GET requests. No PATCH, no PublishXml, no DELETE, no POST to Dataverse.

## Family 1, CLCPA-142: 644 cells

### How a cell was judged contaminated

By the **shipped** `stripDerivedForPersist`, extracted from the working tree, not by
a re-typed rule. A cell counts when the shipped function would null it and the store
holds a non-null value there.

That matters because CLCPA-143 made the strip **self-limiting**: a derived cell that
cannot be rebuilt is deliberately left alone. Those cells are correctly absent from
the hit list, so the count already matches what a cleanup would actually do.
Visible in the data:

| table-year | would null | derived but kept |
|---|---|---|
| G1/2023 | 0 | **2** (null feet, nothing to rebuild from) |
| G1/2024 | 0 | **2** (same) |
| G1/2025 | 3 | 0 |
| G2/2023 through G9/2025 | 3 each | 0 |

The August scan reported 661 and this one reports 644. Part of that 17-cell
difference is the self-limiting strip now protecting G1/2023-24. **I cannot
reconcile the rest**, because the August list was never exported. That is precisely
the argument for exporting, and it is why these lists are files.

### Distribution by table

| table | cells | | table | cells |
|---|---|---|---|---|
| A5 | 117 | | G10 | 9 |
| A6 | 77 | | G2 | 9 |
| A8 | 77 | | G4 | 9 |
| A1 | 76 | | G6 | 9 |
| A2 | 76 | | G8 | 9 |
| F8 | 42 | | G3, G5, G7, G9 | 6 each |
| A10 | 19 | | J5 | 12 |
| F2 | 18 | | J7 | 7 |
| J3, J4, J6 | 14 each | | J9 | 6 |
| A7 | 3 | | G1 | 3 |

**Total 644 across 66 table-years.** The A tables carry 445 of them, 69%.

Worth noting against the ticket text: the August observation was "visible spread
J4/J5/J6/J7 across 2023-2025". The J tables actually hold only **53** of the 644.
The August note recorded what was on screen, not the distribution, which is what
"full distribution never analyzed" meant.

### Uniform or save-driven: SEEDED

Two independent tests, both pointing the same way.

**Test 1, stored value against payload value:**

| | cells |
|---|---|
| stored value byte-equal to the payload | **641** |
| stored value differs from the payload | **3** |
| no payload cell to compare | 0 |

**Test 2, save history:**

| | table-years |
|---|---|
| contaminated | 66 |
| of those, with any save history | **1** (A1/2025) |
| of those, with none | **65** |

So the override store was **bulk-seeded from the payload, derived cells included**.
It is not the residue of user edits. 149 override records exist for 52 tables that,
with one exception, nobody has ever saved.

This changes the shape of the right cleanup, discussed below.

### The 3 genuine edits, all A1/2025

| row | col | label | stored | payload | reading |
|---|---|---|---|---|---|
| 10 | 3 | Commercial Kitchen | **0** | null | someone typed a zero where the payload has no value |
| 17 | 3 | Pilots | **0** | null | same |
| 22 | 3 | Total | **9.480000000000002** | 0.53 | **the original CLCPA-141 contamination** |

Row 22 is the summed 9.48 recorded in the CLCPA-141 notes as the single contaminated
cell found in the dev store. That store was cleaned by a console pass; **the
Dataverse copy was never touched and still holds it.** This scan is the first thing
to confirm it survived.

The two zeros are a genuine judgment call rather than obvious contamination: a
deliberate 0 and an absent value display differently, and both sit in a derived
column that the strip wants nulled.

### Change history: 16 entries, half of them orphans

| table-year | entries | exists in the payload |
|---|---|---|
| A1/2025 | 5 | yes |
| A1/2099 | 3 | **no** |
| A1/2100 | 2 | **no** |
| A2/2100 | 1 | **no** |
| T1/2020 through T5/2024 | 1 each | **no** |

**8 of the 16 entries reference table-years that do not exist in the payload**:
years 2099 and 2100, and tables T1 to T5. Those look like test artifacts from
reporting-year and table-creation trials. They are outside both families' scope and
outside this ticket, but they are in a production store and someone should decide
whether they stay.

## Family 2, CLCPA-209: 0 cells, and the zero is real

The corruption path was real. `recomputeTotals` turned D2/2025's 88,150 into 0.688
on open, and any Save would have persisted it. The question was whether any Save
happened before the containment shipped.

**It did not.** And the zero is cleanliness rather than absence, which the scan
distinguishes deliberately, because "no records" and "clean records" produce the same
count and mean opposite things:

| table | override records | row counts | signature hits |
|---|---|---|---|
| D2 | 3 (2023, 2024, 2025) | 6, 6, 6 | 0 |
| D3 | 3 | 5, 5, 5 | 0 |
| D4 | 3 | 10, 10, 10 | 0 |
| F7 | 3 | 4, 4, 4 | 0 |

Both signatures were tested: a magnitude replaced by a sub-1 value in a "Total ..."
row, and F7's percentage strings replaced by large sums. Neither appears anywhere.

**Consequence for CLCPA-209:** its scan half is complete and clean for the Dataverse
store. The ticket's cleanup obligation is discharged for that store, and what remains
is the predicate fix itself plus the dev-store check below.

## Overlap: 0 cells

No cell is hit by both families, so the cleanups are independent and can be
sequenced or skipped separately. That is expected given Family 2 is empty, and it is
recorded because the ticket asked and because a future re-scan may not be so tidy.

## Proposed cleanup plan, NOT executed

Writes are a separate authorized step. This is the design for approval.

### The design question the scan answered

Nulling 644 cells is the obvious plan and probably the wrong one. 641 of them are
byte-equal to the payload, and 65 of 66 contaminated table-years have never been
saved. An override record that matches the payload carries no information: the app
falls back to the payload when no override exists, so such a record is not an
override at all, only a copy.

**So there are two candidate shapes:**

| option | action | records touched | risk |
|---|---|---|---|
| **A. Null the cells** | set the 644 cells to null in place | up to 149 | Low and mechanical. Leaves 149 redundant records that will drift from the payload again on the next re-seed. |
| **B. Delete the redundant records, null the rest** | delete records that add nothing over the payload; null cells only in the ones that carry a genuine edit | ~148 deleted, 1 nulled | Smaller end state and removes the class. Needs one more check first, below. |

**I recommend B, conditional on one check I could not complete.** My scan exported
the hit list but not the full row blobs, so I can prove the 641 *contaminated cells*
match the payload and I **cannot** yet prove the whole record matches: a
non-derived cell could differ and would be lost by a delete. That check costs
nothing extra, because the cleanup run has to read the records again to take its
backup. **The plan below therefore starts with that check and branches on it.**

### Sequence

1. **Backup first, and it is the rollback artifact.** Read all 149 records and both
   history tables, write them to `deploy-backups/` with a manifest and sha256s,
   commit and push before any write. Same discipline as the CLCPA-191 restore, which
   was proven end to end before its delete ran.
2. **Complete the redundancy check.** For each record, compare the full row blob
   against `payload.json` with derived columns nulled on both sides. Classify as
   *redundant* (identical) or *carries an edit*. Report the split before writing.
3. **Branch.** If the redundant count is close to 148, execute option B. If many
   records carry non-derived differences, fall back to option A for those and delete
   only the provably redundant ones.
4. **A1/2025 is handled by hand, not by rule.** Its three edits are the only genuine
   ones in the store:
   - row 22 col 3, the 9.48, is contamination and gets nulled
   - rows 10 and 17 col 3, the two zeros, need a ruling: keep the deliberate 0 or
     null it with the rest. I would keep them and null only 9.48, on the grounds
     that a typed 0 is data and the strip's job is to remove *computed* values. That
     is a judgment call and yours to make.
5. **Verify by re-scan.** Re-run this exact scan afterwards. It must report 0 for
   Family 1 apart from any cells deliberately kept in step 4, and it must still
   report 0 for Family 2. The re-scan is the acceptance test, and its output goes
   into the ticket as a file, not a console line.

### Expected change-history footprint

**None, by design.** The cleanup should write through the Web API directly rather
than through the app's save path, so it appends no `cr2bf_dacingesttestchangehistories`
entries. A cleanup that logged 149 history rows would bury the 16 real ones,
including the 8 orphans that still need a decision.

That is a deliberate choice worth stating: it means the cleanup is invisible in the
app's own audit trail, and the backup plus this report are the audit instead.

### What NOT to touch

The standing guardrail holds until the cleanup lands: **no edits to the G, J or F8
tables** through the app. This plan touches them only through the API cleanup, and
only cells the shipped strip already wants nulled.

The 8 orphan history entries (A1/2099, A1/2100, A2/2100, T1 to T5) are **out of
scope** and stay untouched. They deserve their own small decision.

## The dev store, still unread

`localStorage dac:overrides` cannot be reached from Node. To cover it without a
device code, run this in the hosted app's console. It **downloads a file** rather
than leaving the result in a variable, which is the exact failure that lost the
August list:

```js
// READ ONLY. Reads two localStorage keys, writes nothing, downloads a JSON file.
(() => {
  const out = { scannedAt: new Date().toISOString(), keys: {} };
  ['dac:overrides', 'dac:history', 'dac:years'].forEach(k => {
    let raw = null;
    try { raw = localStorage.getItem(k); } catch (e) { raw = '<<unreadable: ' + e.message + '>>'; }
    out.keys[k] = raw === null ? null : raw;
  });
  const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dac-dev-store-' + Date.now() + '.json';
  a.click();
  console.log('downloaded; keys present:', Object.keys(out.keys).filter(k => out.keys[k] !== null));
})();
```

Send me the file and I will run both families against it and fold the result into
this report. Note the CLCPA-141 record says the dev store was already cleaned of the
9.48, so the expectation is a clean result there and a contaminated one in Dataverse,
which is what makes the pair worth comparing.

## Time

Estimate 1.5 to 2.5 hours for this read-only half. **Actual approximately 1.4 hours**,
just under: roughly 0.3 h establishing the store schema and writing the scan with its
audit gates, 0.2 h on the pre-flight verb audit and the false-positive check on
`undeclared_scan`, 0.1 h for the authorized run itself, 0.4 h on the follow-up
analysis that produced the seeded-versus-edited split, and 0.4 h writing this up.

## What needs a ruling

1. **Option A or B**, after step 2's redundancy check reports.
2. **A1/2025's two typed zeros**: keep or null. My recommendation is keep.
3. **The 8 orphan history entries** for 2099, 2100 and T1 to T5: leave, or clean in a
   separate pass.
4. **Whether to run the dev-store snippet**, which is the only part of the original
   scope still uncovered.
