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
