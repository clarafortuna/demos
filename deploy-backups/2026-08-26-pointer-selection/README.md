# cr2bf_dactest pre-deploy snapshot — 2026-08-26 (CLCPA-198 pointer selection)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

**Source: `main` @ `422736c`, deployed POST-MERGE** (PR #164, CLCPA-198). The
label in the deploy log is `source: ExecutiveDashboard_dev/ at main @ 422736c`,
and this time it is accurate rather than coincidentally right — see the note below.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 804,905 | yes → 813,062 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 (`?v=` stamp) |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 251,610 | **no — unchanged** |

Pre-deploy sha256 of the archived bytes:

| file | sha256 (truncated) |
|---|---|
| `app.js` | `e076b49f9e1aae3e…` |
| `styles.css` | `384cc2d41357b5ff…` |
| `ExecutiveDashboard.html` | `de50f1e61e50ff80…` |

## Build ids

| file | id | previous |
|---|---|---|
| `app.js` | **`a89ad80b8f`** | `9a5576f92c` |
| `styles.css` | `384cc2d413` | `384cc2d413` (unchanged) |

Read back and verified byte-identical after publish: app.js 813,062 B,
ExecutiveDashboard.html 11,856 B. `PublishXml` posted for both.

The resource listing under the prefix returned **7**, unchanged — the
`map_payload.json`, `hvi_zcta.geojson` and `service_territories.geojson`
deletions all still hold.

## What this deploy changed

CLCPA-198 only: tract selection moved from `layer.on('click')` to
`pointerdown`/`pointerup`. After a map filter is applied, mouse-compatibility
events stop being dispatched to the tract SVG paths on the hosted mount —
measured filtered: `mouseover 270`, `mousemove/mouseout/click/mousedown/mouseup 0`,
`pointerdown 4`, `pointerup 4`, `pointermove 400`. The click handler keeps its
stop-propagation shield and still selects for clicks the pointer path did not
claim, so keyboard and assistive-technology activation continue to work.

Everything else since the previous deploy (CLCPA-190, CLCPA-189-A, CLCPA-191) was
data, scripts or docs. `git diff 30339aa..422736c` over the app files is one file,
`app.js`, from one commit, `8b1eefc`.

## Two script defects fixed before this deploy, and one that cost a device code

**`UNSTAMPED` was used and never declared.** The first attempt at this deploy died
with `ReferenceError: UNSTAMPED is not defined` **after authentication and before
any write** — the org was untouched, but a device code was spent. The declaration
had been removed on 2026-08-21 when `map_payload.json` left `TARGETS`; the list had
exactly one member, so removing the member made the list look redundant, and two
readers were left behind. No deploy had run between that edit and this one, so the
line had never executed. `node --check` passes an undefined identifier — it is
valid syntax and only throws when reached.

`undeclared_scan.js` now screens the script for SCREAMING_CASE identifiers used but
never declared, and is a pre-deploy step alongside `node --check`. It found
`UNSTAMPED` and nothing else.

**The `main =` label is fixed.** It printed `at main = <sha>` as fixed text while
reading `HEAD`, which is why the 2026-08-21 snapshot has a note correcting its own
log. It now prints the checked-out branch and appends `*** NOT main ***` when it
differs. This is the follow-up recorded in that README, closed.

**`BACKUP_DIR` was stale**, still pointing at `2026-08-21-territory-fallback`. Left
alone the script would have refused to overwrite that snapshot and aborted — again
after spending a code. Same class of defect as `UNSTAMPED`: state left behind by a
previous deploy.

## Backup convention

Per the rule restated on 2026-08-24: **a backup is a pushed branch plus its sha
recorded here. No PR.** The open-PR marker never survived being merged on sight, so
it was ritual. Branch: `deploy-backup-2026-08-26-pointer-selection`.

## Verification still outstanding at the time of writing

The fix cannot be proven locally — the broken state does not exist off the hosted
mount. Hosted acceptance is: hard refresh, console reports
`[DAC dashboard] build a89ad80b8f`, then with a borough **and** a neighbourhood
filter applied, clicking a tract opens the detail panel.

**Known residual, not fixed:** `mousemove`/`mouseout` stay dead when filtered, so
the tooltip is placed where the pointer enters a tract, does not track the cursor
within it, and does not hide until the next tract is entered. `pointermove` is
alive, so migrating the tooltip the same way would repair it — recorded on
CLCPA-198 and on the root-cause ticket, not fixed here.
