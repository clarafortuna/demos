# CLCPA-293 — decision memo: who owns a total cell?

**For the owner. No code is proposed and none has been written for this.**
Prepared 2026-09-21 against integration build `c2554b3841`, from her three
CLCPA-293 records, the CLCPA-303/B2 follow-up, and the shipped source.

The ask was a decision expressed as an **invariant that governs future tables**,
not an exception for this ticket. Section 10 is that invariant. Sections 1–9 are
what it has to survive.

---

## 1. The exact CLCPA-88 rule

Stated in `Storage.saveTable`:

> **CLCPA-88: never persist derived columns for stripped tables** — the app
> re-derives them at render.

Implemented by `stripDerivedForPersist`, which nulls derived cells on save for
the 26 tables in `PERSIST_STRIP_TABLES`, and by the import guard, which refuses
to let a file write a cell the engine derives. Its purpose is that **the store
never holds a copy of something the engine computes**, so a stale copy can never
contradict the computation.

Its guard rail, from `stripDerivedForPersist`'s own comment:

> strip a cell ONLY IF the app can rebuild it […] Nulling it on save would
> delete it permanently, and nothing could bring it back.

## 2. The exact CLCPA-293 rule that conflicts with it

From the ruling as worded:

> **registry-derivability governs the import guard** — a total cell is refused
> only where a *declared* rule derives it: a derived column, a declared derived
> row, or a `detectSumColumns` relationship.

Everything not so declared is handed to the preparer.

## 3. The concrete scenario that exposes the conflict

**A1's Total row.** A1's schema is

```
["Program Name", "Total Funds Expended ($)", "DAC Funding ($)", "% in DACs"]
```

`DERIVED_COLS.A1` declares **column 3 alone**. Columns 1 and 2 of the Total row
are plain additive totals, rebuilt through `recomputeTotals`' generic path —
**a rule, but not a registry entry**. Read literally, CLCPA-293 hands them to the
preparer. Measured on the built candidate:

```
shipped     taken from the preparer 0    row holds [282,132,686, 148,672,653]
candidate   taken from the preparer 2    row holds [111,111, 222,222]
```

A file wrote `111,111` over a filed figure. That is the CLCPA-88 defect,
reproduced. It is **not one table: 262 of 432** total-row cells the engine
rebuilds today would be handed over.

## 4. What the file owns

The preparer's filed figures for totals the engine **cannot** legitimately
compute. A8 is the case:

```
r24  "Residential Programs Installations Total"   283,852   engine can compute
r25  "Total CES Programs Installations"           null      engine CANNOT
```

`336,599` sits in r25 because an earlier import wrote it. r25 covers programmes
that are not rows in the table, so it is legitimately **more** than its rows
itemise. Any number the engine computes for it is wrong by design.

## 5. What the engine derives

Two disjoint populations, and the conflict lives in the gap between them:

| | mechanism | registry entry? |
|---|---|---|
| Declared derived columns | `DERIVED_COLS[table]` | **yes** |
| Declared derived rows | `columnTotal`, CLCPA-319 | **yes** |
| Plain additive totals | `recomputeTotals` generic path | **no** — 262 of 432 cells |

CLCPA-293 as worded sees only the first two.

## 6. What is currently persisted

- 26 tables in `PERSIST_STRIP_TABLES`: derived cells are **nulled on save**.
- Every other table: the derived figure is **stored as well as derived**.
- A8's grand total: stored, written by a CLCPA-122-era import, never by the engine.
- **B2, as of CLCPA-303** (§9): newly derivable, not stripped — stored *and*
  derived.

## 7. What happens on import, under each interpretation

| | A8 r25 (file owns) | A1 Total c1–c2 (engine owns) |
|---|---|---|
| **I1 — arithmetic decides** (today) | discarded **in silence** when the stored figures happen to add up; accepted when they do not | refused, correctly |
| **I2 — registry-derivability** (the ruling as worded) | accepted and named — the goal | **accepted, overwriting a filed figure** — CLCPA-88 breached, ×262 cells |
| **I3 — declared preparer-ownership** | accepted and named **iff** declared B7-class | refused by default, correctly |

I1's defect is that a classifier reading **values** decides what happens to
those values: the same cell changes owner depending on whether its stored
numbers happen to sum. This engine has ruled against that shape three times
already — CLCPA-293's own comment, CLCPA-319's `columnTotal` identifying its row
by label, and the CLCPA-320 marker ruling.

## 8. Behaviour of the already-built 48/0 candidate

`ingestRebuildableTotals` refusing only where a declared rule derives the cell.
It met every condition on the ruling:

| condition | result |
|---|---|
| browser reproduction per anatomy, before and after | 5 anatomies, both builds |
| staged and landed counts agree | 40 staged, 40 landed, 0 excluded |
| both controls in one evidence set | A8's 777/222 accepted, kept and named |
| value identity per stored year | 6,135 cells, 0 table-years move, 0 KPI figures move |
| census committed | block E |
| assertions | **48 passed, 0 failed** |

**It was still withdrawn, and rightly.** Its own regression sweep caught §3.
Green assertions measured what the ruling asked; the ruling asked the wrong
question. *A candidate that exists is not an argument for the interpretation
behind it.*

**It also only fixes half the path.** Where the candidate accepted the
preparer's figure, the editor's next recompute overwrote it:

```
after the import     777 / 222     what the advisory claims
after the recompute  283,936       the engine's column sum
```

Any ownership rule that binds only the import guard produces an advisory that
tells the operator something untrue by the next save.

## 9. CLCPA-303 / B2 — the same shape, analysed, not changed

CLCPA-303 gave B2's column-wise total row a `columnTotal` rule, so the engine
now derives it. B2 is **not** in `PERSIST_STRIP_TABLES`, so the row is stored as
well as derived — a stored copy of something computable.

It is safe today: the CLCPA-303 declaration reconciles in both directions and
surfaces divergence as a kept figure with an amber advisory, and 12 of 12 cells
agree across all three stored years. It was left because a strip change needs
its own round-trip proof — CLCPA-143 found real cases (G1/2023, G1/2024 store a
percentage with no feet column at all, so nulling it would delete the only data
in the row).

**Why it belongs in this memo.** B2 shows that "the engine derives it" and "it
should not be stored" are *different questions*, and the current design
conflates them. An invariant that answers only ownership will not tell anyone
what to do with B2.

## 10. The invariant

The three questions below are currently answered by one mechanism. Separating
them is the decision.

> **1. Ownership is declared, never inferred.**
> A total cell is **engine-owned** unless the registry declares it
> **preparer-owned**. No property of the *values* in a cell — whether they add
> up, whether they are present — may decide who owns it.
>
> **2. Ownership binds every write path, not just import.**
> An engine-owned cell is refused on import and re-derived at render. A
> preparer-owned cell is accepted, persisted, reconciled against the itemised
> rows with the divergence named, and **never overwritten by recompute**.
>
> **3. Persistence is a separate question from ownership.**
> An engine-owned cell should not be stored — but only once the app is proven
> able to rebuild every cell the strip would null. Until that proof exists the
> cell stays stored, and that is recorded as a **debt with a named table**, not
> as a third kind of ownership.

### What this gives, against each interpretation

- Default is **refuse**, so CLCPA-88 holds **by construction** rather than by a
  predicate that has to be got right. I2's 262-cell exposure cannot arise.
- The classifier trap is closed by rule 1: no value-reading test decides
  ownership, so A8's two cells stop changing owner with their own arithmetic.
- Rule 2 closes the second surface: acceptance that a later recompute undoes is
  not acceptance.
- Rule 3 gives B2 an answer — engine-owned, stored, **debt** — without changing
  it now, and gives every future mixed table the same answer without a ruling
  each time.

### Honest costs

- **It does not fix A8 by itself.** A8 r25 keeps being discarded until someone
  declares it preparer-owned. The invariant makes that a one-line registry entry
  and a domain question, which is the right shape, but it is not automatic.
- **Someone must enumerate the B7-class totals.** Only the owner and ConEd can
  say which totals legitimately exceed their rows. That work does not disappear;
  the invariant just puts it where the knowledge is.
- **Rule 3 creates a visible debt list** that will not be empty on day one — B2
  at least, and whatever the CLCPA-143 sweep finds.

### One thing worth doing whichever way rule 1 goes

The defect has two halves: the **wrong cell is discarded**, and it is discarded
**in silence**. The second is not a ruling question. Making a refused
preparer-supplied total *always* surface — refused-and-named rather than
dropped — converts a silent data loss into a visible one, and would have made
CLCPA-293 a support question rather than three rounds of archaeology. It is
independent of who is ruled to own the cell.

---

**No implementation is proposed here, and none should be started until rule 1 is
ruled on.** The three withdrawn candidates all failed for the same reason: they
encoded an answer to "who owns this cell" that had never been decided.
