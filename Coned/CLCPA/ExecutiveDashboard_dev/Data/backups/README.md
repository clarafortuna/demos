# Dataverse backups

Exports taken immediately before a destructive change to a live Con Edison table.
Internal operational backups. **These never ship in the Con Edison handoff
package** — `make_handoff_package.py` refuses to build if anything under this
directory is staged, by a directory-prefix rule rather than a filename rule, so a
future dated export is covered automatically.

---

## `cr2bf_dacmaptractdata_2026-08-24.{json,csv}`

**Why this exists.** CLCPA-191 deletes the 2,333 mirror rows from
`cr2bf_dacmaptractdata` so the table returns to its design intent: only deliberate
corrections live there, overlaid on the `coned_operational` dataset.

**This file is the only rollback.** Nothing in this repository writes that table.
The CLCPA-115 edit path was removed before 2026-06-30 and never replaced, so there
is no script that re-seeds it from source and no UI that recreates a row. If these
files are lost, the rows are gone.

| | |
|---|---|
| exported | 2026-08-24T23:55:46Z |
| rows | 2,333 (2,333 unique GUIDs, 2,333 unique GEOIDs) |
| JSON | 1,066,535 bytes, sha256 `0b90821fa96f75dd0990803901df829a5d4a48c74bb95fac8a7e0a7e9d3c6748` |
| CSV | 302,663 bytes |

**The JSON is authoritative.** It carries all 12 columns including the row GUIDs,
`createdon`/`modifiedon`, and a manifest recording source, org, timestamp, row
count and purpose. The CSV is a convenience copy for a portal Data Import and
carries no manifest.

### What was verified before the delete

- **The table was a full mirror carrying zero corrections.** 18,664 cells
  (2,333 × 8) compared against `Data/out/coned_operational_v1_0-2010.json`:
  **0 differences**, 0 rows outside the dataset. Compared with the `_adj` columns
  rounded to 4dp, because the table stores `Decimal(4)` while the dataset carries
  14–15 dp — comparing raw makes a faithful mirror look like 2,333 corrections.
- **With the table empty, every tract falls through to the dataset unchanged.**
  Proven against the real app: all 18,664 composed cells equal the dataset, no key
  vanished, 13,182 non-null values in the comparison. A mutated build that treats
  row-absence as data-absence breaks 13,182 cells, so the check demonstrably
  detects the failure mode.
- **Audit cost is nil.** The table has `IsAuditEnabled: true` but the org has
  `isauditenabled: false`, and Dataverse requires both — so deleting these rows
  writes no audit records.

## Restoring

`../restore_map_tract_data.js`, which reads the JSON in this directory.

```
node restore_map_tract_data.js --dry-run           # offline: validate all 2,333 bodies
node restore_map_tract_data.js --prove-synthetic   # 1 throwaway row, round-tripped
node restore_map_tract_data.js --prove-real        # delete + rebuild 1 real row
node restore_map_tract_data.js --restore-all       # the rollback
```

**Proven end to end on 2026-08-25, 26 assertions green.** A client-specified GUID
is accepted on create, and real row `36005000200` (`4a300f6e-2d6c-f111-ab0e-7c1e521963d9`,
8 of 8 columns populated) was deleted, confirmed gone with a 404, rebuilt from this
export, and came back at its original GUID with all eight values identical. Row
count returned to 2,333.

**What restore cannot recover: `createdon` and `modifiedon`.** They are system
columns, so a restored row carries the timestamp of its restore. Row GUIDs *do*
survive, so identity and any references are intact, and the originals are preserved
in this export as a record — but after a rollback, `createdon` describes the
rollback, not the history.

## One thing to know about the end state

After the delete there is **no way to create a correction from the app**. The write
path is gone, so the override table stays empty until either a write path is
restored (see CLCPA-176) or rows are created by hand in the maker portal. The
overlay behaves correctly when empty — that is proven above — but the capability is
dormant rather than available.

Related: `cr2bf_dacmapchangehistory` holds 51 rows, the residue of the removed edit
UI. Nothing reads or writes it. **Keep them** — they are the only surviving record
that anyone ever hand-edited this data, and they are unreproducible.
