# CLCPA — Handoff

The application's author is leaving. This is what a successor needs, and what only she can still tell
us. Everything answerable from the repository is answered here rather than asked.

## Bus factor

`er-clara` authored 673 of ~820 commits. `app.js` is ~24.8k lines in one IIFE with ~533 functions. The
code is unusually well commented and ticket-traced — inline comments routinely cite the ticket that
motivated the line — so the *reasoning* is mostly recoverable. What is not written down is listed
under "Questions" below.

## Facts established from the repository (do not re-ask these)

| | |
|---|---|
| Deployed source | `Coned/CLCPA/ExecutiveDashboard_dev` — proven by build-id recomputation, not by folder name |
| Live build | `app.js fcc9fa30bd`, `styles.css 2b9651445c` |
| Environment | **One.** `org9076e69b.crm.dynamics.com`, prefix `cr2bf_dactest`, across all 102 manifests |
| Data source | Dataverse, not `payload.json` (`DAC_SOURCE = 'dataverse'`); the file is a revert parachute |
| Tables | Ten, inventoried with row counts in `../MIGRATION_READINESS.md` |
| Auth | Ambient user cookie; no token, no service identity; privileges read from the platform, fail closed |
| Auditing | **Off at the org level** — `cr2bf_dacmaptractdata` is configured to audit and records nothing |
| Rollback | Pre-deploy bytes committed and pushed before any write |
| `TODO`/`FIXME` in `app.js` | **Zero** |
| Live branches | One stack: `clcpa-278-r4-row-cell-render` (3 ahead of main, 0 behind) |
| Abandoned branches | Eight, each 159–702 commits behind `main` — not reconciliation input |

## Special build steps

- `Data/stamp_build.js` produces the build id; the repo copy is deliberately never stamped.
- Deploy pre-flight runs the whole suite estate (`3c`) and dies on any red.
- `TICKET_SYMBOLS` in each deploy script is hand-written: exact source strings with expected counts.
- Device-code interactive login is required for every deploy. **No service principal exists.**

## Known data quirks

- Years **2097, 2098, 2099** are synthetic audit scaffolding in the live store, not reporting data.
  2098's A3/A4 column 1 holds 44 numeric-*looking strings* (`"333"`, `"907"`, …) that became visible
  to the sum engine under CLCPA-278 r3. Measured, disclosed, ruled scaffolding, sentenced to the
  CLCPA-224 cleanup. **By how much any figure moves was explicitly not measured.**
- `header_levels` is not a row count. `0`, absent and `2` mean three different things; D1 carries `0`
  and its first row is real data.
- `map_payload.json` "diverges from its own pipeline and is not fully reproducible" — her words, in
  `CLAUDE.md`. It is dead at runtime but the divergence is unexplained.

## Questions only she can answer

Ordered by what is lost if unasked.

1. **Is `org9076e69b` (Clara Fortuna Dev) the only environment this has ever run in?** No Con Edison
   environment appears anywhere in the repository. If one exists, how does code reach it?
2. **How does Con Edison receive a release today** — managed solution export, manual upload, or a path
   not represented here? All 102 deploys patch web resources directly.
3. **Can a service principal be provisioned?** Every deploy so far has required her interactive login.
   Without one, unattended CI is impossible and releases stop when she leaves.
4. **`map_payload.json` — what is the divergence from its pipeline?** It is retired at runtime, but if
   it is ever regenerated we need to know what the file knows that the pipeline does not.
5. **The 2098 A3/A4 figures — how far do they move** under the shared-reader change? She measured the
   cells but explicitly not the effect on totals.
6. **Which of the eight abandoned branches, if any, hold work worth keeping?** They are 159–702
   commits behind; the graph says dead, but she may know otherwise.
7. **The three `dacingesttest*` table names** now hold live report data. Logical names are immutable —
   carry the names forward, or create correctly named tables and migrate 155 rows?
8. **`_kit/cdp.js`** drives Chrome/Edge via DevTools Protocol. Is it part of the intended test story,
   or scaffolding? Nothing in the gate runs it.
9. **Is the `index.html` password gate still required** for the public demo origin, and is anything
   real behind it?
10. **Anything in flight that is not pushed?** The repository can only show what she has pushed.

## First week for a successor

1. Read `ARCHITECTURE.md`, then `app.js`'s banner sections (`grep -A1 -E "^  // ={10,}" app.js`).
2. Run `sh tools/run_security.sh` and one ticket suite. Understand the `N passed, M failed` contract.
3. Read a `deploy.log` end to end. It is the best single description of how this ships.
4. Do **not** add a stored copy of anything computable — see the stored-vs-derived rule in
   `ARCHITECTURE.md` and the CLCPA-141…143 / CLCPA-238 history behind it.
5. Treat `_kit/live_page.js`'s lack of entity decoding as a known trap before writing any DOM test.
