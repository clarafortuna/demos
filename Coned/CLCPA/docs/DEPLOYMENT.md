# CLCPA Executive Dashboard — Deployment

**Nothing here is automated. Every deploy is a hand-run Node script with an interactive login.**

## What ships

Three web resources, one org:

```
org        https://org9076e69b.crm.dynamics.com   (solution CLCPADACDashboard, publisher cr2bf)
resources  cr2bf_dactest/app.js                   79151fe9-3c64-f111-ab0c-7c1e521c7110
           cr2bf_dactest/styles.css               7b151fe9-3c64-f111-ab0c-7c1e521c7110
           cr2bf_dactest/ExecutiveDashboard.html  77151fe9-3c64-f111-ab0c-7c1e521c7110
```

`payload.json` and `map_payload.json` exist as legacy web resources from earlier waves and are no
longer pushed. `index.html`, `logo/` and `Data/` are **not** deployed.

**There is exactly one environment.** All 102 deploy manifests name the same org and the same
`cr2bf_dactest` prefix. There is no Dev→Test→Prod chain in this repository, and no Con Edison-owned
environment appears anywhere in it. See `HANDOFF.md`.

## Build identity

`Data/stamp_build.js` is the contract, and it lives in the repo precisely because it must not rot.

```
buildId   = sha256(canonical file)[0:10]
canonical = the file with APP_BUILD forced back to 'dev'
```

Hashing the canonical form makes stamping **idempotent** — re-stamping an already-stamped file yields
the same id, so a re-run cannot drift. The repo copy is never stamped: `app.js` says `dev` on disk, so
a locally served copy reports itself unstamped instead of impersonating a deploy.

Two stamps ship. `app.js` carries the id in a sentinel it prints at boot; `ExecutiveDashboard.html`
references `app.js?v=<id>` and `styles.css?v=<id>` so a fresh document cannot pull a stale subresource
from cache. The sentinel is the one that earns its keep — if the HTML itself is stale its script tags
are stale too, but the running build still announces which it is.

## The deploy sequence, as it actually runs

Each wave is a fresh `deploy-backups/<date>-<slice>/deploy_<slice>.js`. Pre-flight, before any network:

```
0  self-check: declared tickets, commits, resources, symbol counts; prose audit
1  branch = main, HEAD clean, local == remote, every declared commit an ancestor
2  app.js parses
3  build ids recomputed and matched against what the wave declares
3b declared ticket symbols present in the COMMITTED blob; 0 NUL bytes
3c ALL suites executed; dies if any is red            <- the real gate
3d snapshot directory absent
4  stamps applied IN MEMORY; nothing on disk is modified
```

Then: interactive device-code login, an id-to-name gate on all three resources, a provenance check
that the org is serving the expected previous build, **a rollback snapshot committed and pushed to the
remote before any write**, `PATCH webresourceset(<guid>)` per file, one `POST PublishXml`, and finally
a read-back with sha256 comparison of every resource.

## Rollback

The pre-deploy bytes are committed and pushed *before* the first write, so the rollback is durable off
the deploying machine. Reverting is a PATCH of the archived `app.js` back to its web resource id plus
`PublishXml`. The `prevApp` gate refuses to run if the org is not serving what the wave expects. When
`styles.css` does not move, a rollback touches one resource.

## Manual steps and assumptions

| | |
|---|---|
| **Interactive device-code auth** | Blocks unattended CI. No service principal exists. |
| **Per-wave scratch script** | ~800 lines re-authored each time; the suite gate is re-implemented inside it |
| **`TICKET_SYMBOLS` written by hand** | Exact source strings with expected counts |
| **One org, one prefix** | No promotion path defined |
| **Auditing off at org level** | A direct-API write leaves no trace |

The pre-flight discipline is genuinely strong and should be **preserved and extracted**, not replaced.
The obvious first step is lifting 3c into a standalone runner — `tools/run_security.sh` is the model —
so the gate stops being rewritten every wave.

## Integration candidate

The integration branch is not deployable as-is: its build id differs from what the org serves, and the
security change is undeclared in any wave. Deploying it requires a ticket number, `TICKET_SYMBOLS`
entries, and the provenance updates listed in the integration report.

```
live now   app.js fcc9fa30bd   styles.css 2b9651445c
candidate  app.js 318977b6d8   styles.css 2b9651445c (unchanged)
```
