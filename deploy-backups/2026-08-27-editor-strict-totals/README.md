# cr2bf_dactest pre-deploy snapshot — 2026-08-27 (editor strict totals, J1/J2)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured immediately before
the deploy. This is the rollback point for it.

**Source: `main` @ `f1bba98`, deployed POST-MERGE** (PR #170).

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 824,787 | yes → 827,037 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 (`?v=` restamp) |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 251,610 | **no — unchanged** |

Pre-deploy sha256 of the archived bytes:

| file | sha256 |
|---|---|
| `app.js` | `83fad00efbf31fe2cb16eb3778032e62b9dc11cfd60955c6ccc6f5cd3e496023` |
| `styles.css` | `384cc2d41357b5ff97a6beec56d682c3784df3f1aacf45dbfbabeb947b49d30a` |
| `ExecutiveDashboard.html` | `dfd4dd4a006e3b7990f4e00d40f547123b9796ae79d286c6e107fadaf6e1565a` |

## Build ids

| file | id | previous |
|---|---|---|
| `app.js` | **`97a7ebcfba`** | `3d176690bc` |
| `styles.css` | `384cc2d413` | `384cc2d413` (unchanged) |

Read back and verified byte-identical after publish: app.js 827,037 B,
ExecutiveDashboard.html 11,856 B. `PublishXml` posted for both.

**What rolling back gets you: a live data-loss path.** Build `3d176690bc` is the
CLCPA-144 build, in which the ingest editor writes the average row's values over
J1's and J2's totals — 347.1 in place of 5,223,783,448 kWh. The dashboard reads
correctly there; the editor does not. **If this is ever rolled back, reinstate the
mitigation: nobody opens J1 or J2 in the ingest editor.** The tell is "Unsaved
changes" appearing without a keystroke.

## What this deploy changed

`EDITOR_STRICT_TOTALS = {'J1','J2'}`. Those two tables now use the strict
whole-label predicate in the ingest editor, so their "Total amount of residential
… usage" rows are treated as editable **data** rather than auto-calculated totals.

The bug: the loose predicate classified those rows as totals, and each table's only
other row is a **non-summable average**, so `recomputeTotals` wrote the average
straight over the total.

    J1/2025 row 0 stored   5,223,783,448 | 40% | 7,980,741,755 | 60%
            editor wrote           347.1 | 40% |          992.2 | 60%

`recomputeTotals` runs on every editor render, so opening the table was enough to
flag "Unsaved changes", and J1 is not in `PERSIST_STRIP_TABLES` — a save would have
persisted it. J2 was worse: its percentages are stored as numbers, so all four
columns were overwritten.

**Pre-existing.** Verified against `72aac13~1`: the wrong values were written both
before and after the CLCPA-144 editor null fix. What that fix changed is that J1's
percentage columns went from blank to the stored 40%/60% — so the row stopped
looking obviously broken and started looking plausible next to numbers wrong by
seven orders of magnitude. It improved the disguise while improving the behaviour.

**Both render sites moved to the same test**, not just the write path. Left on the
loose predicate the row would still render grey with the "auto-calculated" note —
uneditable, and the fix half-applied.

Per-table rather than global, because A5–A8 and G1–G9 have genuine hierarchical
subtotals labelled "X Total" and a global change would stop the editor calculating
them at all.

## Known, unfixed, and held in its own ticket

**`recomputeTotals` is blind to hierarchy.** It writes one column sum into every
total row, so A5/2025's ten "X Total" rows all receive 27,834 — including
"Commercial & Industrial Total" (real value 612) and "Small-Medium Business Total"
(real value 23,715). Also a write path. Filed with two related items: editor
auto-calc for the five all-totals tables, and the A5–A8 subtotal percentages that
all show the grand total's ratio.

The behaviour is **pinned in `editor_strict_test.js` section 4 and explicitly
marked not-endorsed**, so the harness records it without blessing it. That assertion
should flip when the hierarchy work lands, and be rewritten rather than deleted.

## Pre-flight

Full rather than diff-scoped: `node --check` clean, `undeclared_scan.js` clean,
backup directory confirmed absent, all three targets confirmed to resolve to real
Buffers, and the `cartocdn` ledger check returning 0 on `main` for both builds.

## Backup convention

Per the rule restated 2026-08-24: **a backup is a pushed branch plus its sha
recorded here. No PR.** Branch: `deploy-backup-2026-08-27-editor-strict-totals`.
