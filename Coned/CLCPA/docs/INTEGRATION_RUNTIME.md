# CLCPA — Integration Runtime Handoff

**The parallel line is live in `Sustainability Design - Dev` and the legacy line is untouched.**

| | |
|---|---|
| Environment | **Sustainability Design - Dev** — `https://orgc60845ae.crm.dynamics.com/` |
| Environment id | `d491a3e9-379f-e433-8ccb-afb49607c31d` · Org `1dfebd7e-cd6f-f111-b27b-000d3a5cc314` |
| App | **CLCPA Executive Dashboard - Integration** · `2c35b607-4161-4576-8ae8-9d9dae7bcc0e` |
| Solution | `CLCPAExecutiveDashboardIntegration` 1.0.0.2, unmanaged |
| Publisher | `CLCPAIntegration`, prefix **`clcpa`** (newly created — no `cr2bf` publisher exists here) |
| Source | `clcpa-integration-candidate`, pushed to **`clarafortuna/demos`** · integration base `75e8eec` |
| Reconciled through | **`fff9e47`** (`origin/main` — round 2) · 0 outstanding |
| Build | `app.js` **8ff294bd16** · `styles.css` **9039bfc509** |

Open it at `main.aspx?appid=2c35b607-4161-4576-8ae8-9d9dae7bcc0e`.

## A. The finding that reframes this phase

The environment was **not** running a recent build. It serves `app.js` **342094b187**, which is commit
`b4583b7` — *"deploy-backups: snapshot for build 342094b187 (CLCPA-143 item a)"*, **2026-09-02**, the
same day the solution was created.

```
342094b187 (b4583b7, Sep 2)  ...332 commits, 96 of them app.js...  75e8eec (Sep 19)
                                 73 deploy waves · 80 CLCPA tickets · 16.4 days
```

The deployed legacy build has no `DAC_SOURCE`, no `odataLiteral` and no `escapeHtml(formatCell` — it
predates CLCPA-238 entirely and carries **both** vulnerabilities the candidate fixes.

Consequence: a behavioural diff against `ExecutiveDashboard_test` would be dominated by 80 tickets of
*intended* change, not regressions. Validation was therefore run as smoke plus candidate-vs-candidate,
and the legacy delta is recorded as inventory rather than diffed. That was Randdy's call, made with
these numbers in hand.

## B. Two things nobody asked about, that matter more than the above

**1. The web resource GUIDs are identical across at least THREE orgs.**

```
app.js                  79151fe9-3c64-f111-ab0c-7c1e521c7110   <- same in ALL THREE
styles.css              7b151fe9-3c64-f111-ab0c-7c1e521c7110
ExecutiveDashboard.html 77151fe9-3c64-f111-ab0c-7c1e521c7110

org9076e69b   Clara Fortuna Dev            (vendor; all 102 deploy manifests)
orgc60845ae   Sustainability Design - Dev  (this one)
orgbdb6dd88   Customer Assistance - Dev    (found only because the guard fired — see F2)
```

They are the same rows because the solution was **exported from `org9076e69b` and imported**
elsewhere — which is also why its publisher still reads "Default Publisher for org9076e69b" and why
the `cr2bf_` prefix exists here with no `cr2bf` publisher behind it.

The engineer's deploy scripts `PATCH webresourceset(<guid>)` and gate on id-to-name. **Both the GUIDs
and the names match in every one of those orgs.** The only thing separating a Clara Fortuna deploy
from a Con Edison one is the org URL in a scratch script that is re-authored every wave. This is not
a theoretical risk — see §F2, where it very nearly happened.

**2. Someone is active here.** All seven legacy resources shared one `modifiedon`, and it included
`index.html` and both logos — files `DEPLOYMENT.md` says are *never* deployed. A uniform timestamp
across never-deployed files is a **solution import**, not a PATCH wave. It happened roughly 15 hours
before this inventory, and it carried the Sep-2 build.

## C. What is in the environment, and what is not

Seven DAC tables exist. **Every one holds zero rows.** The three CLCPA-238 definition tables —
`cr2bf_dacreporttable`, `cr2bf_dacreportsection`, `cr2bf_dacreportmetric` — **do not exist at all**,
confirmed by differential probe: a control table resolved and failed on query syntax, while these
three failed at metadata resolution.

So the candidate ships `DAC_SOURCE = 'dataverse'`, finds no definition tables, and takes the parachute.
That is designed behaviour, it is boot-safe, and it was **observed**, not assumed — see D.

**This environment is structure without data.** Anyone expecting the parallel app to exercise the
Dataverse path here will be disappointed; it renders from `payload.json`.

## D. Runtime validation — what was actually observed

Identity was verified first via `WhoAmI` (`felizr@coned.com`, org `1dfebd7e…`), because the browser
attachment silently flips between tenant profiles.

| Check | Result |
|---|---|
| App boots | **Yes** — renders Executive Summary, 10 sections, 52 tables |
| Running build announces itself | `APP_BUILD` = **`318977b6d8`** |
| Subresources resolve from the parallel path | `app.js?v=318977b6d8`, `styles.css?v=2b9651445c` |
| Data source actually taken | **payload.json** — `meta.years` = `[2025,2024,2023]`, the file baseline, *not* the composed set that would carry 2097–2099 |
| Section A render | 1 table, 92 `<td>`, 4 `<th>`, **0 raw injected tags** |
| Report Data (editor) | Renders, selectors and editable grid populated |
| Map Data | Renders; correct empty state, "no saved layers" |
| Uncaught runtime errors | **0** |

`escapeHtml` was executed against the shipped bytes in the live page:
`<b>bold</b>` → `&lt;b&gt;bold&lt;/b&gt;`, `Q1 & Q2` → `Q1 &amp; Q2`, `"` → `&quot;`.
**The security control is live in production bytes, not merely in source.**

Nothing was written. Save and upload were never clicked; the editor was validated by rendering only.

## E. Deployed-byte control census

Counted in the deployed `app.js` of each line — not in source:

| Control | Integration | Legacy |
|---|---|---|
| `APP_BUILD = '318977b6d8'` | 1 | 0 |
| `DAC_SOURCE = 'dataverse'` | 1 | 0 |
| `function odataLiteral` | 1 | 0 |
| `escapeHtml(formatCell` | 1 | 0 |
| `escapeHtml(p.name)` / `escapeHtml(cat.name)` | 1 / 2 | 0 / 0 |
| dataset-key charset guard | 1 | 0 |
| `escapeHtml(` call sites | 225 | 157 |
| `encodeURIComponent(` call sites | 2 | 1 |

The call-site totals are **not** a pure security delta — legacy is 332 commits behind, so ordinary
feature work is mixed in. The named single-site controls above are the meaningful comparison.

## F. What I changed, including one thing I did not intend

Created, all additive: publisher `CLCPAIntegration`, solution `CLCPAExecutiveDashboardIntegration`,
six `clcpa_dashboard/*` web resources, sitemap and app module `clcpa_ExecutiveDashboard_integration`.
Every deployed byte was **read back and compared** — 6 of 6 identical to what was staged.

**I imported with `--publish-changes`, which is org-wide `PublishAllXml`, not a targeted publish. It
moved `modifiedon` on all seven legacy `cr2bf_dactest/*` resources** (2:40 AM → 7:06 PM).

I verified the effect was confined to that timestamp:

- All 7 legacy web resources: **byte-identical** before and after.
- Legacy `customizations.xml`: **identical** — app, sitemap and definitions unchanged.
- Legacy `solution.xml`: one added `<MissingDependency>` record, computed at export time, not stored state.

No content was altered. But a forensic signal was destroyed: the uniform 2:40 AM timestamp that
revealed the recent import is now overwritten, and the **pre-import timestamps survive only in this
document**:

```
before my import   all 7 cr2bf_dactest/* resources   modifiedon 2026-09-19 02:40 AM
after my import    all 7 cr2bf_dactest/* resources   modifiedon 2026-09-19 07:06 PM
```

This is now prevented rather than merely regretted — see §F1.

The app is associated with the System Administrator and System Customizer role *templates*, the same
two the legacy app uses. That grants visibility of the new app; it does not modify either role.

## F1. The two deploy safeguards

`tools/deploy_guard.js`, covered by `suite_deploy_guard.js` (37 assertions, 7 mutation controls).
Both checks are pure functions over caller-supplied values — no I/O, no credentials — because a
deploy-time check that can only run during a deploy never gets tested.

**1. `assertOrganization(expected, actual)` — fails closed.** Compares the org id the platform
reports against the one the wave declares. A mismatch, a missing expectation, an unreadable
connection, or an environment whose org id was never recorded all **throw**. `ENVIRONMENTS` carries
Con Edison's verified id and deliberately leaves `clara-fortuna-dev` as `null`, because no WhoAmI has
been read against it — and a guessed constant would turn a fail-closed check into a confident green.

**2. `buildPublishXml(ids)` + `assertOwned(names)` — targeted publish only.** Emits a `PublishXml`
ParameterXml naming only the given web resource ids, and refuses any component outside the `clcpa_`
prefix. `scanForPublishAll` / `assertNoPublishAll` lint deploy scripts as text for `PublishAllXml`,
`--publish-changes` and `pac solution publish`, so the footgun is caught in review rather than in an
org. `node tools/deploy_guard.js lint <files...>` is the CLI form.

The suite asserts the exact command used on 2026-09-19 is flagged, and that `deploy_guard.js` is the
only file in `tools/` permitted to contain those shapes.

## F2. The guard fired on its first live use, and it was right

Redeploying after the CLCPA-301 reconciliation, `assertOrganization` **refused**:

```
Expected  1dfebd7e-cd6f-f111-b27b-000d3a5cc314  (Sustainability Design - Dev)
Reported  0e48ff69-7fb6-f011-95c7-00224806e123  (Customer Assistance - Dev)
```

The `pac` CLI's active org had silently switched to **Customer Assistance - Dev** — a third Con Edison
environment that no one had mentioned, and which turns out to carry the **same `cr2bf_dactest/*`
resources under the same GUIDs**. Without the check, `pac solution import` would have written the
CLCPA integration solution into it and reported success.

Two consequences, both now standing policy:

- **`pac`'s ambient selected org is not trustworthy.** It flipped twice in one session, unprompted —
  once before the import and again a few commands later. Every `pac` call now passes `--environment`
  explicitly rather than relying on the profile. Note the residual gap: the guard and the write are
  separate processes, so the assertion narrows the window but does not close it. Pinning
  `--environment` on the writing command is what actually closes it.
- **The collision is three-way, not two-way** (§B.1). It was found only because the guard printed the
  org it saw.

The second safeguard was then proven directly. This deploy used `import` with no publish flag,
followed by a targeted `PublishXml` naming only our six ids:

```
legacy cr2bf_dactest/*  before this deploy   modifiedon 2026-09-19 07:06 PM
legacy cr2bf_dactest/*  after  this deploy   modifiedon 2026-09-19 07:06 PM   <- unchanged
ours   clcpa_dashboard/*                     modifiedon 2026-09-19 08:16 PM
```

The org-wide publish moved all seven legacy timestamps. The targeted publish moved none.

## F3. Reconciliation round 1 — CLCPA-281 r3 and CLCPA-301

Her r4 stack merged to `main` via `clarafortuna/demos#268`, `#269` and `#270` — all three in
**`clarafortuna/demos`**, the only repository this project has ever lived in — and the three branches
were deleted. `75e8eec` is now
an ancestor of `main`, and the content delta from it to `main` outside `deploy-backups` is **empty**.

The live line is now `clcpa-301-import-row-totals` (it contains `clcpa-281-r3-section-header`).
Absorbed into `c51bddc`:

| Result | |
|---|---|
| `app.js` merge | **clean** — every conflict was a generated `*-output.txt`, resolved by re-running its suite |
| Security review of her diff | no HTML sink, no interpolation, no control text added or removed |
| Her suites against our escaped build | `suite_281_r3` 35/0, `mut_281_r3` 35/0, `suite_301` 32/0, `mut_301` 32/0 |
| Drift suites | failure counts **identical** pre/post (10, 3, 0, 4, 4, 4, 0); passing counts rose |
| Full gate | 8,719 assertions passed |
| Build | `318977b6d8` → **`a0c04d51be`**; `styles.css` unchanged |

**Nothing in the 55 failures or 14 non-reporting runners is attributable to the merge.** Twelve of
those runners reference an undefined `REL` and were already dead at `75e8eec` — they have never
validated anything. Two more (`mut_245`, `mut_composer`) are healthy and merely print a
"N caught, M not caught" summary. `mut_274_r2`, `mut_274_r3` and `mut_278_r2` return byte-identical
results before and after, verified against a pre-merge worktree.

**A standing step in the loop:** her seven new test files hardcoded `c:/Users/emely/Desktop/Projects/demos`
and errored outright on any other machine. `migrate_paths.js` fixed all seven (157 migrated, the two
Chrome/Edge exceptions still detected rather than assumed, 0 unexpected). Expect this with every delta.

## F4. Reconciliation mode — the standing cycle

Active as of 2026-09-20. Baseline `fff9e47`, integration tip `2c12f56`. **No new refactors or broad
cleanup while the engineer is still changing the project.**

Detection is scripted because it is mechanical and must not drift:

```sh
sh tools/reconcile_cycle.sh      # exit 0 = no delta, 10 = delta, 2 = cannot tell
```

It fetches `clarafortuna/demos`, refuses to run against any other remote, reads the baseline from
`tools/reconciled.json`, and counts commits on `origin/main` **and** on any live branch — with
`clcpa-integration-candidate` excluded, because our own branch is 0-behind after each merge and would
otherwise be mistaken for the engineer's line.

Both paths are verified, not assumed: rewound to `74458b2` it reports `36 commits` and exits **10**;
at the current baseline it reports no delta and exits **0**; the ledger is byte-identical afterwards.

Steps 4–14 are **deliberately not scripted**. Reviewing a diff, deciding what is legitimate, and
deploying to a client environment are judgement, and a script that merges and deploys unattended is
how an unreviewed change reaches Con Edison.

When a delta exists, in order:

1. Review the delta only — behaviour, security, paths, test assumptions.
2. Merge; resolve generated `*-output.txt` by **regenerating**, never by picking a side.
3. `node tools/migrate_paths.js` — **always**; every round so far has needed it (7, then 34 files).
4. `DAC_BASE_COMMIT=<tip being merged> sh tools/run_security.sh` — must stay green. Red here is real.

   **Pass the tip explicitly during a cycle.** `suite_render_equivalence` compares the working tree
   against engineer code *without* our escaping, so its baseline must be the engineer commit whose
   code is currently merged. It reads `tools/reconciled.json`, which step 14 has not advanced yet, so
   mid-cycle a bare run compares against the *previous* tip and charges her new visible-text changes
   to our security patch. On 2026-09-20 that produced 55 false "VISIBLE TEXT REGRESSIONS" of the form
   `0.43 -> 43.0%`. Pinned to the tip being merged, the same run is 7/0 with 0 differences. After
   step 14 the ledger matches and bare runs are correct again.
5. Run her new suites against our escaped build.
6. Compare to `tools/gate_baseline.json` **by category**, never by aggregate totals — the totals
   double-count, because every `mut_*` wrapper re-runs its suite and reports that suite's tally.
7. Stamp; deploy only `clcpa_*`; pin `--environment` on every write; assert the OrganizationId
   immediately before the operation, in the same session that performs it; targeted `PublishXml` only.
8. Smoke-test the app; confirm `cr2bf_dactest/*` timestamps are unchanged.
9. Push; then advance the baseline with `reconcile.js mark`.

Dataverse writes stay parked. No merge to `main`, no standalone repository, no deploy outside
`Sustainability Design - Dev`, no legacy modification without Randdy's explicit approval.

## G. What is still open

1. ~~The org-id assertion in deploy pre-flight~~ — **done**, §F1, and it already paid for itself
   (§F2). Wiring it into a permanent deploy script remains; every wave is still a scratch artifact.
2. **`clara-fortuna-dev` has no recorded OrganizationId**, and now neither does
   `customer-assistance-dev`. The guard refuses any environment it has not been told about. Both
   reads need credentials for those orgs, so they are Randdy's to trigger.
3. **Why does `Customer Assistance - Dev` hold the same `cr2bf_dactest/*` resources?** It was not
   known to this engagement until the guard named it. Someone should establish which Con Edison
   environments have received this solution, and which of them anyone still deploys to.
4. **Who imported the solution 15 hours ago, and why a Sep-2 build?** (B.2)
4. **The Dataverse path is parked by decision, not by defect.** The three CLCPA-238 definition tables
   are absent and all seven DAC tables are empty; file-backed operation is sufficient for the current
   objective. Creating or seeding those tables is not authorized.
5. **The 332-commit gap is a decision, not a defect.** Someone must choose whether this environment
   catches up to `75e8eec`, or stays a demonstration environment.
6. Everything in `HANDOFF.md` §Questions remains open; none of it was answered by this phase.

Rollback for the parallel line is deleting solution `CLCPAExecutiveDashboardIntegration`. It shares no
component with the legacy line, so removing it cannot affect `ExecutiveDashboard_test`.
