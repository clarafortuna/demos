# CLCPA-293 round 3: the discard reproduces, and round 2's verdict was wrong

**Raised:** 2026-09-20, after the owner supplied the anatomy and the counts.
**Status:** REPRODUCED AND DIAGNOSED. **No `app.js` change.** The fix is
sized and needs a ruling.
**Evidence:** `CLCPA-293-r2-evidence/probe_293_r3.js` and its committed
output.

`CLCPA-293-r2-stop.md` is left as it stands. It is the record of what round 2
measured and concluded, and this document corrects it rather than rewriting
it.

---

## 1. What round 2 got wrong

Round 2 measured four anatomies, found the discard only in the fourth, and
argued the fourth was **correct** to refuse: the row holds the figure its own
rows come to, so the engine derives it, so CLCPA-88 forbids a file
overwriting it.

Two facts supplied since make that argument fail.

**The row's provenance.** The grand-total row exists as an ordinary stored row
with stored values, written by the CLCPA-122 audit's import-and-save in the
era when imports created Total rows as ordinary rows (the CLCPA-240 finding 2
mechanism). The figure in it is a stored copy an earlier *file* put there.

Round 2 treated "the engine can reproduce this number" and "this number is the
engine's" as one claim. They are not, and A8 proves it in one line: asked to
write both total rows from the itemised ones, the engine produces

    r24  "Residential Programs Installations Total"   283,852
    r25  "Total CES Programs Installations"           null

It **cannot derive r25 at all**. The 336,599 that makes r25 look derivable in
the hosted anatomy was never written by the engine.

**The counts are cells.** Staged 26 values, the draft banner 24 cells, the two
missing exactly the two filed totals. No rows-versus-cells confusion to
explain away.

## 2. Reproduced

Reconstructed by replaying the mechanism rather than hand-building the end
state, as A3/2098 was reconstructed for CLCPA-292 round 2. The first replay
attempt is itself part of the finding: blanking both total rows and letting
`recomputeTotals` write them cannot produce the anatomy, because it leaves r25
null. The era's importer wrote the preparer's filed totals straight in, and
that is what the probe replays.

Importing a file that fills both figure columns on every itemised row and
files both totals:

| the prior file's grand total | staged | land | do not |
|---|---|---|---|
| reconciled with its own rows | 40 | 14 | **26** |
| did not (the A8/2025 shape) | 40 | 16 | **24** |

The difference is exactly two cells, and they are exactly the two cells of the
filed grand total. Both are **discarded in silence**: totals accepted and
named is 0.

## 3. The diagnosis

`ingestRebuildableTotals` blanks a total row and asks `recomputeTotals` to
rebuild it. `recomputeTotals` writes any row `totalRowFlags` confirms, and
`totalRowFlags` confirms a total **by arithmetic**.

So the same two cells of the same table belong to the preparer or to the
engine according to whether the figures stored in them happen to add up. On
the 2025 anatomy r25 is not confirmed and the preparer's figure lands; on the
reconstructed one it is confirmed and the figure is dropped with no advisory.

That is the classifier trap this engine has now ruled against three times: in
CLCPA-293's own comment ("a classifier that reads values must not decide what
happens to those values"), in CLCPA-319's `columnTotal` (which identifies its
row by label for exactly this reason), and in the CLCPA-320 marker ruling this
session, that derivability is read from the rule registry and not from row
role.

## 4. The fix, sized but not built

Apply the CLCPA-320 principle to the import guard: a total cell is the
engine's only where the engine has a **declared** rule that produces it (a
derived column, a declared derived row, or a `detectSumColumns`
relationship), not merely because today's stored figure adds up.

Measured across every table and every stored year:

- cells the importer refuses as rebuildable today: **445**
- of those, cells with no declared rule behind them: **275**
- tables affected: **24** (A1 to A8, B1, C2 to C5, E1, F2, F7, F8, F9, G10,
  H1, J3, J4, J6, J7)

Every one moves from refused to accepted-and-named, which is the direction
CLCPA-272 ruled: a provided value is accepted and reconciled, never rejected.
The change is therefore not dangerous in kind. It is large in degree, and it
changes what the importer does on every table.

**That is why it is not built.** A 275-cell change to the import guard across
24 tables is a ruling, not a judgement call, and the last two rounds of this
ticket each shipped a fix that had to be withdrawn.

## 5. What is needed

A ruling on whether to apply registry-derivability to the import guard, with
the 275/445 figure in view. If the answer is yes, the same amendment closes
the A8 case and every other instance of it at once; if it is no, the A8 case
needs a narrower rule and that rule needs its own scope.
