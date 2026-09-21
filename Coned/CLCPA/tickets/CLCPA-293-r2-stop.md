# CLCPA-293 round 2: the discard does not reproduce, and I did not ship a fix for it

**Raised:** 2026-09-20, measured on the shipped build (`d84c0d3`) and on two
candidate fixes, both withdrawn.
**Status:** MEASURED AND STOPPED. **No `app.js` change.**
**Evidence:** `CLCPA-293-r2-evidence/probe_293_r2.js` and its committed output.

---

## 1. What was asked

> when the target year's grand-total row already exists as a stored structural
> row, the import gives the filed figure the same kept-and-named treatment;
> staged and landed counts agree or the report says what was excluded; A1's
> derivable Total still refuses.

with the hosted finding: rowless **26 of 26** land with the advisory; stored
anatomy **24 of 26**, no advisory, on A8/2098.

## 2. What I measured

Every anatomy the target year can be in, on A8, importing a file whose grand
total the itemised rows do not come to. **On the shipped build:**

| the year's grand-total row | cells landed | totals named | filed figure kept |
|---|---|---|---|
| 1. no rows at all (rowless) | 40 | 16 | **yes** |
| 2. exists, no figures in it | 28 | 4 | **yes** |
| 3. exists, holding a figure its rows do not come to | 27 | 1 | **yes** |
| 4. exists, holding the figure its rows DO come to | 26 | 0 | no |

**Three of the four already do what the ticket asks.** Round 1's own
`suite_293` C block covers case 2 directly: its fixture is
`data[Y].map(r => [r[0], null, null, null])`, the structure with its values
nulled, and it asserts the preparer's 777 and 222 land and are named.

Row 4 refuses, and **refusing is correct there**: the row holds the figure its
own rows come to, so the engine genuinely derives it, and CLCPA-88 forbids a
file overwriting a derived figure. That is exactly what `suite_293`'s D block
pins for A1's Total.

The other two clauses hold on the shipped build as well:

- **staged against landed**: of the cells dropped on a stored-anatomy import,
  **every one** is a cell the workbook marked `(calculated)`. Nothing the
  preparer was invited to fill goes missing: **0 such cells**.
- **A1's derivable Total refuses**, with its own figures and with a file
  offering 111,111 instead. It refuses for a reason nothing here touches: A1's
  total columns are declared DERIVED COLUMNS and the guard reads
  `!computed.derivedCol(cIdx) && ...`, so a derived column is refused whatever
  the file offers.

## 3. Two fixes built and both withdrawn, and why

**(a) Ask whether the engine reproduces THE FILE'S figure.** Rejected by
`suite_293`'s own D block: it accepted 111,111 into A1's Total, which is the
CLCPA-88 defect coming back. Caught by an existing suite, not by me.

**(b) Ask whether the engine reproduces THE DRAFT'S figure** (a total row
holding the figure its rows come to is the engine's; one holding nothing, or
holding a figure they do not come to, is the preparer's). This passed every
suite in the sweep, and then measured **identical to the shipped build on all
four anatomies**. A change that alters nothing while claiming to fix something
is worse than no change, so it is not in the stack.

Both are reverted. `app.js` on this branch is untouched for this ticket.

## 4. What I need to go further

**Which anatomy was A8/2098 in when the hosted pass saw 24 of 26?** That one
fact decides which row of the table above the report describes, and none of
the four I could construct produces it. Useful forms of the answer:

- the two numbers the panel showed (`Imported into the draft: N cells`) and
  whether the amber "Taken as filed" box was present;
- or what A8/2098 held **before** that import: no rows, the labels with blank
  figures, or figures from an earlier import;
- or simply leaving 2098 in place on the org for me to read.

**A second possibility worth ruling out:** 26 and 24 may be counting ROWS
rather than cells. A8/2025 has 26 rows and 7 of them are totals, so "24 of 26"
does not map onto any cell count I produced. If the hosted figures were rows,
the two missing rows would name the case immediately.

---

**Nothing has been written to `app.js` for this ticket.** The measurement is
the deliverable; the fix waits on the anatomy.
