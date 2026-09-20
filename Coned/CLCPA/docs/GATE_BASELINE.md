# CLCPA — Gate baseline

**Purpose: a trustworthy reference so a future engineer delta can be judged against it.**
Nothing here is repaired. This records what the estate does *today*, and why.

Measured at integration head `0b2387c`, reconciled through engineer tip `74458b2`,
build `a0c04d51be`.

```
runners discovered      129
assertions passed     8,719     <- inflated; see "double counting" below
assertions failed        55     <- 33 distinct
runners not reporting    14     <- 12 broken, 2 healthy
```

## The four categories

| Category | Runners | Distinct failing assertions | Attributable to our work? |
|---|---|---|---|
| **Genuine application failures** | **0** | **0** | — |
| **Provenance / change-accounting** | `suite_245`, `suite_249`, `suite_254_255_261`, `suite_260`, `suite_263`, `gate_149_stacked` | **28** | Yes — caused by our security edits having no ticket number |
| **Broken test infrastructure** | 12 × undefined `REL`; 3 × stale pinned source (`mut_274_r2`, `mut_274_r3`, `mut_278_r2`) | **5** (from the 3 stale-pinned) | No — pre-existing |
| **Expected / non-reporting utilities** | `mut_245`, `mut_composer` | 0 | No — healthy, different output format |

## Double counting — why 55 is really 33

Every `mut_*` wrapper re-runs its own suite and prints **that suite's** tally. Verified by running
each pair side by side: the numbers are identical, and each wrapper references its suite in source.

| Wrapper | Echoes | Tally (both) | Failures double-counted |
|---|---|---|---|
| `mut_249` | `suite_249` | 194 / 3 | 3 |
| `mut_254_255_261` | `suite_254_255_261` | 168 / 4 | 4 |
| `mut_collateral` | `suite_254_255_261` | 168 / 4 | 4 |
| `mut_260` | `suite_260` | 184 / 4 | 4 |
| `mut_263` | `suite_263` | 177 / 4 | 4 |
| `mut_gate_149` | `gate_149_stacked` | 21 / 3 | 3 |
| | | | **22** |

`55 − 22 = 33 distinct` → **28 provenance/attribution + 5 stale-pinned-source + 0 application.**

The same pattern inflates the **passing** total by at least 912 (the echoed passes above), and
probably more from wrappers whose suites are green — which I did not enumerate. **Treat 8,719 as an
upper bound, not a measurement.** The per-runner table below is the baseline; the aggregate is not.

## Category 1 — provenance / change-accounting (28)

These are the estate's drift-accounting assertions. Two shapes:

**"the change to X is accounted for"** — every changed function must be attributed to a declared
ticket. The functions named are exactly the ones our security work touched:

```
dsValidateDoc   odataLiteral   renderTable   renderSectionE/F/H
wireFTooltips   wireHTooltips  drawSectionEArc   resolveTablePrivileges
```

**"Z2/Z5/S4 … byte-identical: A1:2023 … A2:2025"** — attribution. These tickets assert they *solely*
own a rendered difference; our escaping adds a legitimate second owner on the `&`-bearing tables.

| Runner | Failing | Composition |
|---|---|---|
| `suite_245` | 10 | 9 × "change to X accounted for" + 1 × census count (`X8: 79`) |
| `suite_249` | 3 | 2 × "moved, named by a later ticket" + 1 × "CLCPA-249 touched no JavaScript" |
| `suite_254_255_261` | 4 | 1 attribution (`Z2`) + 2 accounted-for + 1 census (`X1: 62`) |
| `suite_260` | 4 | 1 attribution (`Z2`) + 2 accounted-for + 1 census (`X1: 63`) |
| `suite_263` | 4 | 1 attribution (`S4`) + 2 accounted-for + 1 census (`X1: 57`) |
| `gate_149_stacked` | 3 | `Z2`, `Z5` attribution + `C1` CLCPA-252 sole-ownership |

**All 28 clear the moment the security change is assigned a ticket number and declared.** They are
not defects; they are the estate correctly refusing to let an unattributed change pass unnoticed.

## Category 2 — broken test infrastructure (5 failing + 12 dead)

**12 runners reference an undefined `REL` and crash at load.** Verified present at the engineer's own
baseline `75e8eec` — line 22 uses `REL`, and there is no `const/let/var REL` anywhere in the file.
**These have never validated anything**, on any machine, including hers.

```
mut_233_237  mut_237f  mut_240a_r2  mut_240a_r3  mut_240a_r4  mut_240b
mut_242      mut_242_r2  mut_244    mut_badge    mut_daccol   mut_prewalk
```

**3 runners fail their own "clean re-run against byte-restored source" step**, contributing 5
failures. The cause is that they restore `app.js` from a *pinned historical commit* and then run a
suite that has since moved on. The decisive check: each underlying suite is **green standalone
against the working tree**.

| Runner | Its own report | Underlying suite, standalone |
|---|---|---|
| `mut_274_r2` | 30 / 3 | `suite_274_r2` **33 / 0** |
| `mut_274_r3` | 28 / 1 | `suite_274_r3` **29 / 0** |
| `mut_278_r2` | 32 / 1 | `suite_278_r2` **33 / 0** |

Also verified byte-identical before and after our merge, against a pre-merge worktree at `dd1aaef`.

## Category 3 — expected / non-reporting (2)

`mut_245` and `mut_composer` are **healthy**. They print `N caught, M not caught, of N` plus
`clean re-run against restored source: PASSES`, not `N passed, M failed`, so any harness grepping for
the latter records them as errored. `mut_composer` reports **39 caught, 0 not caught, of 39**.

This is a flaw in the *harness*, not the runners — worth fixing whenever the gate runner is made
permanent, by accepting both summary formats.

## How to judge the next delta against this

1. `node tools/reconcile.js impact` — classify her commits.
2. `node tools/migrate_paths.js` — **always**; her files hardcode her own absolute path.
3. `sh tools/run_security.sh` — must stay **green** (166 assertions). Any red here is real.
4. Run her new suites — must be green against our escaped `app.js`.
5. Compare the six provenance runners' **failure counts** against this table. Unchanged counts with
   rising pass counts means her work added assertions and no failures. A *new* failing assertion, or
   a count that moves, is the signal worth investigating.
6. Ignore the 12 `REL` runners and the 2 format-mismatch utilities. They carry no information.

**Do not "fix" the 28 provenance failures by relaxing an assertion.** They are load-bearing: they are
what would catch an unattributed change. They clear with a ticket number, not with an edit.

---

# Round 2 — after absorbing `origin/main` @ `fff9e47`

36 commits, 10 touching `app.js`, 8 PRs (`clarafortuna/demos#276`–`#283`). `styles.css` moved for the
first time. Machine-readable in `tools/gate_baseline.json`; round 1 retained under `history`.

```
runners discovered      147   (was 129)
assertions passed     9,448   (upper bound, same double counting)
assertions failed        55   -> 37 distinct  (was 33)
runners not reporting    14
```

| Category | Round 1 | Round 2 | Why it moved |
|---|---|---|---|
| Genuine application failures | 0 | **0** | — |
| Provenance / attribution | 28 | **25** | She declared tickets: `suite_249` −1, `suite_254_255_261` −1, `suite_260` −1, `suite_263` −1. `gate_149_stacked` **+1** — a new `C1` naming **her** CLCPA-290. |
| Broken test infrastructure | 5 | **12** | `mut_274_r2` 3→9, `mut_274_r3` 1→2 |
| Expected / non-reporting | 2 | **4** | `reverify_290`, `reverify_sectionA` added — diagnostics, not pass/fail |

**The infrastructure jump is hers, and it is the same stale-pinned-source cause.** Her CLCPA-274
option (c) (`6b2cddd`) moved the code those runners' pinned anchors point at; `mut_274_r2` now reports
**5 mutants as `ANCHOR 0, NOT APPLIED`**. She re-pinned some harness in `e8942b6` but not these two.
The baseline's decisive test still passes — every underlying suite is green standalone:

```
suite_274_r2 33/0    suite_274_r3 29/0    suite_274_r4 26/0    suite_278_r2 33/0
```

**The new `gate_149_stacked` failure is hers too:** `C1 CLCPA-290 … renders the dash instead of a
blank: A3 and A4 for 2023 and 2024`. It fires against her unmodified `app.js`, and escaping `&`
cannot produce a dash. Same attribution class as the existing CLCPA-252 `C1`.

Her 18 new runners are **all green against our escaped build**: `suite_282` 34/0, `suite_283` 32/0,
`suite_287` 25/0, `suite_290` 28/0, `suite_291` 32/0, `suite_292` 25/0, `suite_294` 24/0,
`suite_300` 17/0, `suite_black_button` 28/0, and each paired `mut_*`.

**34 more of her files** needed `migrate_paths.js` this round. This is not going away.

## A tooling defect found this round

`reconcile.js` reported **"no live engineer branch"** — a false all-clear — while 36 unreconciled
commits sat on `main`. Her workflow changed to merge-PR-and-delete-branch, which the original model
did not cover. Fixed: with no live branch the reconciler now reads the **trunk**, because
merged-and-deleted work is still work we have not absorbed. A reconciliation tool that goes quiet is
the worst failure mode it has.
