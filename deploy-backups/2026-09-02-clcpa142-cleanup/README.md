# CLCPA-142 cleanup: pre-cleanup snapshot, plan, execution record and verification

Rollback artifact and full audit trail for the CLCPA-142 cleanup of the CLCPA
ingest store in `org9076e69b.crm.dynamics.com`, run 2026-09-02.

The cleanup writes no change-history entries by design, so this folder and the
findings report are the audit trail instead.

## Files

| file | what |
|---|---|
| `tabledata.json` | **the rollback point.** All 149 override records verbatim, as they were before any write. sha256 `1fdd355932054c3f...`, 119,254 bytes |
| `changehistory.json` | all 16 history entries, reference copy. Nothing in the cleanup touched this table. sha256 `871b58f7e9b03a3e...`, 9,192 bytes |
| `manifest.json` | ids, counts, hashes and the restore procedure |
| `cleanup_plan.json` | the per-record classification phase 2 executed |
| `phase2_result.json` | what was actually written, with request counts |
| `verification_rescan_report.json` | the acceptance test |
| `verification_rescan_clcpa142_hits.json` | empty array. Family 1 after cleanup |
| `verification_rescan_clcpa209_hits.json` | empty array. Family 2 after cleanup |

## How to restore

Restore one record by PATCHing
`cr2bf_dacingesttesttabledata1s(<cr2bf_dacingesttesttabledata1id>)` with its saved
`cr2bf_rows` from `tabledata.json`. Re-create a deleted record by POSTing its
fields: `cr2bf_key`, `cr2bf_section`, `cr2bf_tableid`, `cr2bf_year`, `cr2bf_rows`.

Note that restoring all 148 deleted records would put the contamination back. They
were deleted because each was byte-equal to `payload.json` and therefore carried no
information: the app falls back to the payload wherever no override exists.

## What ran, in three phases

### Phase 1, read-only

3 GET requests, zero writes. Read both tables in full, wrote this backup, and
classified all 149 records:

| bucket | rule | count |
|---|---|---|
| A | whole record byte-equal to the payload | **148**, delete |
| B | any non-derived cell differs | **1**, A1/2025, keep and null |
| C | only derived cells differ | 0 |
| D | no payload table-year | 0 |
| E | unparsable blob | 0 |

C, D and E empty means no record fell outside the stated rule.

### A correction that superseded a ruling

Phase 1 found that A1/2025 has **six** differences from the payload, not the three
the original scan reported. The original scan inspects derived columns only, so it
could not see the other three.

**Column 2, "DAC Funding ($)", not derived. The genuine typed data:**

| cell | stored | payload |
|---|---|---|
| r2c2, r10c2, r17c2 | 0 | null |

**Column 3, "% in DACs", derived. Computed from those zeros, not typed:**

| cell | stored | payload | |
|---|---|---|---|
| r10c3 | 0 | null | 0 DAC funding gives 0% |
| r17c3 | 0 | null | same |
| r22c3 | 9.48 | 0.53 | the CLCPA-141 contamination, confirmed surviving here |

The earlier ruling "keep the two typed zeros" rested on the first report describing
the column-3 zeros as typed. They are arithmetic consequences of the column-2
zeros. Emely superseded that ruling on 2026-09-02: **null all 23**.

Nulling all 23 loses nothing. Rows 2, 10 and 17 still render 0, because the engine
recomputes them from the column-2 zeros which the strip leaves untouched, and row
22 renders 0.5270 instead of the wrong 9.48. It is also what lets the final re-scan
reach zero; keeping two derived cells would have left it at 2.

### Phase 2, the writes

| method | count |
|---|---|
| GET | 3 |
| PATCH | 1 |
| DELETE | 148 |
| POST to Dataverse | 0 |
| change-history entries written | **0** |

Zero history writes is structural rather than intentional: the phase-2 script
contains no reference to the history table at all.

**Gates that passed before the first write:**

- all 149 live records byte-identical to this backup, so no concurrent edit could
  be overwritten or deleted
- live record count equal to the backup's 149
- all 148 delete targets present live
- the patch verified to change exactly 23 cells, all in derived columns, all to
  null, column 2 untouched, with r22c3 among them

The PATCH ran **before** any DELETE, so the one record that had to survive was
correct before anything was removed.

### Phase 3, verification

Re-ran the identical scan script, output to files:

| check | result |
|---|---|
| records in the store | **1** (was 149) |
| Family 1 cells, CLCPA-142 | **0** |
| Family 2 cells, CLCPA-209 | **0** |
| overlap | **0** |
| delete targets remaining | 0 |
| A1/2025 matches the intended blob | true |
| of the 23 cells, now null | 23 |
| column-2 typed zeros preserved | **3 / 3** |
| change history entries | 16, unchanged |

## Left deliberately untouched

**The 8 orphan change-history entries**: A1/2099, A1/2100, A2/2100 and T1/2020
through T5/2024 reference table-years that do not exist in the payload. Ruled out
of this cleanup on 2026-09-02: audit tables are a different risk class and these
contaminate nothing. Recorded here and in the CLCPA-142 close as a known leftover.

## The dev store: READ and CLEAN

Checked 2026-09-02 from the web-resource frame on the hosted origin, evidence in
`devstore_check_org9076e69b.json`:

| field | value |
|---|---|
| origin | `https://org9076e69b.crm.dynamics.com` |
| frame | `isTopFrame: false`, href ends `cr2bf_dactest/ExecutiveDashboard.html` |
| localStorage keys present | **18**, all Office and UCI shell keys |
| `dac:overrides` | **null** |
| `dac:history`, `dac:years` | **null** |

**The zero is a genuine result, not a wrong-frame read.** Storage was reachable, 18
keys came back, and the frame is confirmed twice over. The snippet reports the key
count precisely so an empty read in the parent frame cannot be mistaken for a clean
one.

`dac:years` and `dac:history` being absent too means the app has **never written to
localStorage on this origin**. That answers a specific concern: the app falls back
to localStorage when a Dataverse read returns 401, and a 401 did occur earlier in
this work, but no fallback save followed it.

**Coverage: 1 origin scanned, 2 ruled out by declaration.** The public build's host
and localhost or file paths were ruled out by Emely on the grounds that the ingest
editor was never used on either. One caveat worth stating: a browser data clear
would erase this evidence, so this shows no contamination present rather than
proving none ever existed.

## Why the cleanup will last

CLCPA-143 closed the strip-set gap that let derived cells persist in the first
place, and `stripDerivedForPersist` is now self-limiting, so it nulls only what it
can rebuild. Every judgement in this cleanup was made by that shipped function
rather than by a re-typed rule, which is why the count matched what the cleanup
actually did.
