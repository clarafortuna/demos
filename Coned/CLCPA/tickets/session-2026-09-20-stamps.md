# Session record, 2026-09-20: the registered queue, and the deploy of 16eda8c41e

Written at the owner's checkpoint before a machine restart, so nothing lives
only on this machine or in a terminal.

Recorded here rather than in `SESSION_LOG.md`, which this repo's own guidance
calls stale and tells the reader not to treat as current state. Reviving it
would make that warning wrong. Jira remains the record of ticket state.

---

## The measured stamps

The standing rule is THREE stamps per ticket: STARTED, BUILD FINISHED, CLOSED,
where CLOSED is the owner's green hosted pass and cannot be stamped from my own
work. Times are UTC, read from git as `%ct` epoch and rendered once, with a
second clock cross-checked at the time of writing (19:29:31 UTC).

| ticket | STARTED | BUILD FINISHED | CLOSED |
|---|---|---|---|
| CLCPA-241 + 289 (stop record) | MISSING | 2026-09-20 15:24:49 (`2201ce2`) | superseded by the build below |
| CLCPA-292 round 2 | MISSING | 2026-09-20 15:45:33 (`8551769`) | **MISSING** |
| CLCPA-287 round 2 | MISSING | 2026-09-20 16:13:28 (`6d90274`) | **MISSING** |
| CLCPA-330 (stop record) | MISSING | 2026-09-20 16:24:18 (`aca5faf`) | gated to the freeze-lift pass |
| CLCPA-241 + CLCPA-289 (build) | MISSING | 2026-09-20 17:37:07 (`72f31e9`) | **MISSING** |
| CLCPA-293 / A-10 | MISSING | 2026-09-20 18:10:50 (`192cab0`) | **MISSING** |

**STARTED is MISSING on every row, and that is a measurement I do not have.**
Per-ticket start times were never recorded during the session, and the earliest
artifact of the whole run (`2201ce2`, 15:24:49) is the session's first commit,
not any ticket's start. Reporting it as five tickets' STARTED would be a
fabricated figure in a calibration table, which the standing rule forbids
outright. The next session should stamp STARTED as each ticket is picked up.

**CLOSED is MISSING on every live ticket** because no hosted pass has happened.
A completed deploy is not a close.

## The deploy, and the records around it

| event | when | commit |
|---|---|---|
| six PRs merged to main | by 2026-09-20 18:57:15 | `34adc84` (merge of #289) |
| rollback snapshot, pushed before any PATCH | 2026-09-20 19:14:12 | `1cc754c` |
| deploy tail, records only | 2026-09-20 19:26:50 | `e5b88a0` |

Merge commits, in the declared order: `5827bbf` (#284), `f2e3cd8` (#285),
`5daa80c` (#286), `31dd66a` (#287), `663e986` (#288), `34adc84` (#289).

## What the deploy actually moved, decided on bytes

```
WILL PUSH  app.js                   deployed=1296389B  local=1327944B
unchanged  styles.css               deployed=286866B   local=286866B
WILL PUSH  ExecutiveDashboard.html  deployed=4080B     local=4080B
                                    (same length, different bytes)
```

Two of three, not one. I had reported the HTML as unchanged; it carries the
`?v=` cache-busting stamps, which follow app.js's build id, so it moves
whenever app.js does, at identical length. The correction is recorded in that
wave's `deploy.log` beneath the line it overturns.

Live after the deploy: **app.js `16eda8c41e`, styles.css `9039bfc509`**.
Previous build `caf0dbb2ee`, proven from org content three ways before the
write and archived in `deploy-backups/2026-09-20-kept-figures-and-preparer-totals/`.
All three resources read back byte-identical; the server copy carries both ids
and all five ticket symbol groups.

## Evidence at the close of the session

Sweep: **81 suites, 6460 assertions, 0 failed, 0 broken.**

Mutation controls added this session: 5 (CLCPA-292 r2), 6 (CLCPA-287 r2),
7 (CLCPA-241 + 289), 6 (CLCPA-293). Every one applied to a temp copy through
`DAC_APP_OVERRIDE`, `app.js` verified byte-restored by sha256, clean re-run
green.

Three defects were caught by evidence rather than by review, and each is worth
carrying forward as a habit:

- the 149-year gate caught A9's computed ratio rendering as `-0.26`, then as
  `-25.8%` against a filed `-26%`, which would have broken the value identity
  the CLCPA-241 ruling rests on;
- the browser caught the editor dashing a kept figure while the advisory
  beneath it read "filed 8%", on one screen;
- my own mutation controls caught an `every()` on an empty array in my suite
  that read green while the two figures it names had just been deleted.

## The two strays, decided

- `app_diff.txt` **deleted**: scratch, a `git diff` between two files both
  tracked in git, dated 2026-09-16 and regenerable in one command.
- `Coned/CLCPA/deploy_abort.log` **kept**, moved to
  `deploy-backups/2026-09-19-section-a-board/deploy-abort.log`. It is the
  record of that wave's deploy ABORTING at PRE-FLIGHT 3c because
  `gate_149_stacked.js` was red, which is the evidence that the deploy gate
  caught what my own regression sweep had missed. It belongs beside the
  successful run's log for the same wave, not loose in the tree.
