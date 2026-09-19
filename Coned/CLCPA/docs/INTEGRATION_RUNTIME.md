# CLCPA — Integration Runtime Handoff

**The parallel line is live in `Sustainability Design - Dev` and the legacy line is untouched.**

| | |
|---|---|
| Environment | **Sustainability Design - Dev** — `https://orgc60845ae.crm.dynamics.com/` |
| Environment id | `d491a3e9-379f-e433-8ccb-afb49607c31d` · Org `1dfebd7e-cd6f-f111-b27b-000d3a5cc314` |
| App | **CLCPA Executive Dashboard - Integration** · `2c35b607-4161-4576-8ae8-9d9dae7bcc0e` |
| Solution | `CLCPAExecutiveDashboardIntegration` 1.0.0.0, unmanaged |
| Publisher | `CLCPAIntegration`, prefix **`clcpa`** (newly created — no `cr2bf` publisher exists here) |
| Source | `clcpa-integration-candidate` · baseline `75e8eec` |
| Build | `app.js` **318977b6d8** · `styles.css` **2b9651445c** |

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

**1. The web resource GUIDs here are identical to Clara Fortuna Dev's.**

```
app.js                  79151fe9-3c64-f111-ab0c-7c1e521c7110   <- same in BOTH orgs
styles.css              7b151fe9-3c64-f111-ab0c-7c1e521c7110
ExecutiveDashboard.html 77151fe9-3c64-f111-ab0c-7c1e521c7110
```

They are the same rows because this solution was **exported from `org9076e69b` and imported here** —
which is also why its publisher still reads "Default Publisher for org9076e69b" and why the `cr2bf_`
prefix exists here with no `cr2bf` publisher behind it.

The engineer's deploy scripts `PATCH webresourceset(<guid>)` and gate on id-to-name. **Both the GUIDs
and the names match in both orgs.** The only thing separating a Clara Fortuna deploy from a Con Edison
deploy is the org URL in the script. That is a live misdirection risk on every wave, and it should be
closed before anyone deploys again — an org-id assertion in pre-flight costs one line.

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
document**. A future deploy here should publish only its own components.

The app is associated with the System Administrator and System Customizer role *templates*, the same
two the legacy app uses. That grants visibility of the new app; it does not modify either role.

## G. What is still open

1. **The org-id assertion in deploy pre-flight** (B.1). Cheapest high-value fix in this report.
2. **Who imported the solution 15 hours ago, and why a Sep-2 build?** (B.2)
3. **Does Con Edison want the Dataverse path here at all?** If yes, the three CLCPA-238 definition
   tables must be created and seeded; today the parallel app can only run file-backed.
4. **The 332-commit gap is a decision, not a defect.** Someone must choose whether this environment
   catches up to `75e8eec`, or stays a demonstration environment.
5. Everything in `HANDOFF.md` §Questions remains open; none of it was answered by this phase.

Rollback for the parallel line is deleting solution `CLCPAExecutiveDashboardIntegration`. It shares no
component with the legacy line, so removing it cannot affect `ExecutiveDashboard_test`.
