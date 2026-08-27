# cr2bf_dactest pre-deploy snapshot — 2026-08-27 (CLCPA-200)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured immediately before
the deploy. This is the rollback point for it.

**Source: `main` @ `bedee7d`, deployed POST-MERGE** (PR #167). Log line:
`source: ExecutiveDashboard_dev/ at main @ bedee7d`.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 815,128 | yes → 818,688 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 (`?v=` restamp) |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 251,610 | **no — unchanged** |

Pre-deploy sha256 of the archived bytes:

| file | sha256 |
|---|---|
| `app.js` | `81bdbb7b079b2de04b8baf0b1158f491f320cebd2f13a387d27a5271a13dd5db` |
| `styles.css` | `384cc2d41357b5ff97a6beec56d682c3784df3f1aacf45dbfbabeb947b49d30a` |
| `ExecutiveDashboard.html` | `bf0b8afbdff582cd5ff794c6d35af352a59b604eb3dd84ab55ed3c4116a52bf7` |

## Build ids

| file | id | previous |
|---|---|---|
| `app.js` | **`483a20777d`** | `647646a28d` |
| `styles.css` | `384cc2d413` | `384cc2d413` (unchanged) |

Read back and verified byte-identical after publish: app.js 818,688 B,
ExecutiveDashboard.html 11,856 B. `PublishXml` posted for both.

**What rolling back gets you:** build `647646a28d` — the Esri basemap fix, without
CLCPA-200. J1 and J2 would return to showing dashes where percentages belong. A
working dashboard with a known cosmetic defect, not a broken one.

## What this deploy changed

CLCPA-200 only. `rowsForDisplay`'s blanking pass now uses a strict whole-label
predicate (`isStrictTotalRowLabel`) instead of `isTotalRowLabel`, which is an
unanchored `/total|grand total|subtotal/i` substring match and was classifying
**data** rows as totals.

Restored, all previously visible and dashed since CLCPA-88 added the pass:

- **J1** "Total amount of residential electric usage (kWh)" — DAC % and Non-DAC %,
  6 cells across 2023–2025 (`"39%"`/`"40%"`, `"61%"`/`"60%"`)
- **J2** "Total amount of residential gas usage (ccf)" — 6 cells (`0.46`/`0.41`/`0.4`
  and complements, rendered as percentages by the existing `formatCell`)

Deliberately unchanged: **E1** and **F9** "Grand Total" rows still dash, correctly —
they are genuine totals (verified: they sum their columns) whose percentages the app
cannot yet derive. Those belong to the CLCPA-143 derive arc, now widened to E/F/G/J
so E1 has an owner.

**J8 is held on the old predicate** via `TOTAL_ROW_STRICT_PENDING`. Its six flagged
rows could not be classified — J8 has no additive column, so the
does-it-sum-its-column test never ran — and the strict predicate would have restored
four cells on rows that might genuinely be totals. Pending a read of that table.

`isTotalRowLabel` itself and its other five callers are untouched: two of them feed
figures (`columnGrandTotals` and the row-building path) and would change numbers if
it narrowed. That audit is its own ticket.

## Pre-flight

Full rather than diff-scoped, per the rule adopted after `UNSTAMPED`: `node --check`
clean, `undeclared_scan.js` clean, backup directory confirmed absent, and all three
targets confirmed to resolve to real Buffers before spending the device code. Also
verified the ledger check — `cartocdn` returns 0 on `main` for both builds, so the
basemap watermark cannot return via a deploy from main.

## Backup convention

Per the rule restated 2026-08-24: **a backup is a pushed branch plus its sha
recorded here. No PR.** Branch: `deploy-backup-2026-08-27-clcpa-200`.
