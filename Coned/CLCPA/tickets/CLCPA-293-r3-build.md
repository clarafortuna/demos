# CLCPA-293 round 3: the ruled fix was built, measured, and withdrawn

**Built and withdrawn:** 2026-09-20, under the ruling that
registry-derivability governs the import guard.
**Status:** NOT SHIPPED. `app.js` is unchanged. **The ruling as worded
collides with CLCPA-88**, and the corrected form needs a ruling.
**Evidence:** `CLCPA-293-r3-evidence/` and
`CLCPA-293-r2-evidence/probe_293_r3.js`.

This is the third fix this ticket has withdrawn, and the first withdrawn
**before** merge rather than after. `CLCPA-293-r3-stop.md` stands as the
diagnosis; this document is what building it found.

---

## 1. What was built, and it did work

`ingestRebuildableTotals` refusing a total cell only where a **declared**
rule derives it: a derived column, a declared derived row, or a
`detectSumColumns` relationship. The value probe still ran, but could no
longer make a cell the engine's on its own.

Against the conditions on the ruling, all met:

| condition | result |
|---|---|
| browser reproduction per anatomy, before and after | five anatomies, both builds, `repro_293_r3.js` |
| staged count and landed count agree | 40 staged, 40 landed, 0 excluded |
| both controls in the same evidence | A8's 777/222 accepted, kept and named |
| value identity per stored year | 6,135 cells, 0 table-years move, 0 KPI figures move |
| the census committed | block E |

48 assertions, 0 failed, on `probe_293_r3_candidate.js`.

## 2. Why it does not ship

**A1's Total accepts 111,111 from a file.** Measured:

```
shipped     taken from the preparer 0, the row holds [282132686, 148672653]
candidate   taken from the preparer 2, the row holds [111111, 222222]
```

`suite_293`'s own D block calls this "the CLCPA-88 defect coming back". It is
the same guard that killed the first withdrawn fix in round 2, and it caught
this one too, on the regression sweep running last.

**The reason is a gap in the ruling's premise.** The ruling's control
condition says A1's Total "HAS a declared rule". That is true of **one**
column. A1's schema is

```
["Program Name","Total Funds Expended ($)","DAC Funding ($)","% in DACs"]
```

and `DERIVED_COLS.A1` declares column 3 alone. Columns 1 and 2 of the Total
row are plain additive totals: the engine rebuilds them through
`recomputeTotals`' generic path, which is a **rule but not a registry
entry**. So the doctrine, read literally, hands them to the preparer.

It is not one table: **262 of 432** total-row cells the engine rebuilds today
would be handed over.

## 3. The distinction the doctrine actually needs

A8's grand total and A1's Total are not alike, and no structural or
value-based test separates them:

- A1's Total genuinely **is** the sum of its rows.
- A8's "Total CES Programs Installations" is legitimately **more** than its
  rows itemise, because it covers programmes not in the table. The engine can
  compute a number for it; that number is wrong by design.

That difference is domain knowledge, which is exactly what "B7-class by
standing ruling" means. So the correct implementation is the **inverse** of
what was built: not "refuse only where a registry rule derives it", but
**accept only where the total is declared to belong to the preparer**, from
an explicit B7 registry, refusing elsewhere as before.

That form protects CLCPA-88 by construction, needs no census, and is a small
list rather than a predicate. It also makes the scope a decision about which
totals are B7-class, which is a question only the owner and ConEd can answer.

## 4. The second surface, which stands whatever is ruled

Independently of the above: the import guard is half the path. Even where the
candidate accepted the preparer's figure, the editor's next recompute
overwrote it. Measured end to end on A8/2098, anatomy 5:

```
after the import       777 / 222        what the advisory claims
after the recompute    283,936          the engine's column sum
what a SAVE writes     283,936
what the REPORT shows  283,936
```

So any fix to the import guard alone makes the advisory describe an outcome
that does not happen, which is the defect CLCPA-309 was raised for. The
narrow answer is to protect the cells an import has just accepted, sourced
from the import's own `preparerTotals` record rather than from the baseline's
arithmetic. Applying registry-derivability to `recomputeTotals` instead is
not the answer: it would stop the editor maintaining 262 of 432 total cells,
and keeping a total in step with its rows is a feature.

## 5. What is needed

1. A ruling on the **B7 registry** form in section 3, and on which totals
   belong to it. A8's grand total is one; J8's Total is another by standing
   ruling.
2. A ruling on the **second surface** in section 4, which any version of this
   fix needs to be truthful.

## 6. A harness defect worth carrying forward

The census was reported four times - 445/275, 472/302, 439/272, and finally
**407/240 across 23 tables**. Every earlier figure was measured through
`ingestRebuildableTotals`' exception branch, because that function wraps
`recomputeTotals` in a production try/catch and the catch eats the
ReferenceError the offline assembler follows. **Sixteen** dependencies were
being swallowed.

Block H of the candidate probe now proves, on all 149 stored table-years,
that the probe runs before any figure is quoted. Only the last census has
that proof. The same class bit the browser script too, where anatomy 4 was
built from a retyped sum and all five anatomies behaved alike until the
figures were taken from the engine instead.
