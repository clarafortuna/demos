# CLCPA-303: B2's Total Plugs, measured on three surfaces, awaiting a ruling

**Raised:** 2026-09-20, measured on the working tree (CLCPA-319 + CLCPA-320 +
CLCPA-308 in the branch; none of them touches B2)
**Status:** MEASURED AND STOPPED before code, as directed: "I rule before you
build this one."
**Evidence:** `CLCPA-303-evidence/probe_303_totalplugs.js` and its committed
output. Every figure below is produced by executing the app's own functions;
nothing is re-implemented in the harness.

---

## 0. The shape of it, in one line

B2 is **two totals crossing**. `Total Plugs` is a COLUMN that sums the plug
types across a row. `Total` is a ROW that sums the categories down a column.
The cell where they meet is both at once, and it is the cell the headline KPI
reads.

```
2025    Category      L2 Plugs   DCFC Plugs   Micromobility   Total Plugs
        DAC               2966          170               2          3138
        Non-DAC           4516         1229               1          5746
        Total             7482         1399               3          8884   <- the corner
```

## 1. What each surface says on the current tip

| # | surface | what it says about Total Plugs |
|---|---|---|
| 1 | **the report page** | prints the STORED figure. `DERIVED_COLS.B2` is `null`, so nothing computes this column at render. Measured: across all three years the render changes **no cell at all**. |
| 2 | **`detectSumColumns`** | calls it a DERIVABLE SUM: column 3 (2023/24) or 4 (2025), parts `L2 Plugs`, `DCFC Plugs`, and `Micromobility Power Cabinets` where it exists. This is what the downloaded workbook marks `(calculated)` and what the import advisory reconciles against. |
| 3 | **the `ev_plugs` KPI** | reads the CORNER CELL as a stored figure: `dacCell(B2, Total row, Total Plugs)`. It never asks whether the figure reproduces. 2023 `3009/899`, 2024 `4312/1850`, 2025 `8884/3138`. |

`parseB2Plugs`, which Section B's chart and the tornado read, is a fourth
consumer but not a fourth description: it reads the same stored column.

**The tension is between rows 1 and 2 of that table, and it is CLCPA-289's
shape.** The workbook tells a preparer the cell is calculated; the report page
does not calculate it. Today that costs nothing, because the filed figure and
the derivation agree, and because the importer still accepts a figure typed
over the marker on the DAC and Non-DAC rows (measured: `import skips = false`
on both; `true` only on the Total row, which is the pre-existing total-row
rule).

## 2. What the honest derivation would be

Both directions are available and both are already implemented elsewhere in
the engine:

- **Across the row**, `Total Plugs = L2 + DCFC (+ Micromobility)`. This is
  exactly `detectSumColumns`' relationship and needs no new rule type.
- **Down the column**, the `Total` row is the sum of `DAC` and `Non-DAC`. This
  is the CLCPA-319 `columnTotal` rule that just landed for the G board.

The corner cell is the one place both apply, and they agree, so a build would
have to declare which one OWNS it rather than letting two rules write the same
cell. On the G board that question did not arise: there is only one total.

## 3. Would any stored published figure change? NO

Measured in both directions, every cell, every stored year:

```
  Total Plugs cells checked, both directions: 12
  cells where the filed figure and the derivation DISAGREE: 0
```

2023 `899 / 2110 / 3009`, 2024 `1850 / 2462 / 4312`, 2025 `3138 / 5746 / 8884`
all reproduce exactly, across the row and down the column alike. **No figure on
the published report moves under any of the options below.**

That is the important finding: this is a question about which surface OWNS the
number, not about correcting one.

## 4. The options, and what each costs

**(A) Leave it.** The three descriptions agree today. Cost: the workbook keeps
promising a calculation the report does not perform, and the day a preparer
files a Total Plugs that does not match its parts, the report publishes it and
only the import advisory notices.

**(B) Declare the ROW-WISE sum** (`Total Plugs` as a derived column, parts from
`detectSumColumns`). The marker becomes honest on every row. `keepFiled`
decides what happens to a filed figure the parts do not reproduce. Nothing
published moves. This is the smaller change and it matches what the workbook
already claims.

**(C) Declare BOTH**, adding the CLCPA-319 `columnTotal` for the `Total` row as
well, and rule which one owns the corner cell. Most complete, and it puts B2 on
the same rail as the G board. It also needs the ownership rule written down,
because two rules writing one cell is how a derive engine starts disagreeing
with itself.

**My reading, offered not assumed:** (B) is the honest minimum and carries no
published-figure risk; (C) is where the rail is heading and is the one that
makes B2 consistent with what just landed for G. I have built neither.

## 5. Two things found while measuring, outside this ticket

- **CLCPA-304 is confirmed by reading.** `parseB2Plugs` takes
  `(table.schema_by_year || {})[yr] || []` with **no fallback to the newest
  year**, while `getTableSchema` has carried exactly that fallback since
  CLCPA-244. On a brand-new year the schema is empty, every column index is
  `-1`, and every plug count parses as `0`.
- **The import/marker asymmetry on B2's body rows** (`marks = [3]` but
  `import skips = false`) is the CLCPA-274 split working as ruled: guidance in
  the workbook, and an accepted value on import. Recorded so the next reader
  does not mistake it for a defect.

---

**Nothing has been written to `app.js` for this ticket.** Awaiting the ruling
between (A), (B) and (C).
