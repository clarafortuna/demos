# cr2bf_dactest pre-deploy snapshot — 2026-08-07 (dead menus, bind-once)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `a059022`
(PR #116, dead menus bind-once). Eighth deploy of the day.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 689,357 | yes → 691,376 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 242,138 | **no — untouched** |

`styles.css` is archived here anyway, so the folder is a complete picture of the
live app rather than a partial one. The HTML is the same length either side and
was still replaced, because its `?v=` stamp for `app.js` changed.

## Build ids

| file | id | previous |
|---|---|---|
| `app.js` | **`e0f63407f5`** | `cd8a361c60` |
| `styles.css` | `d8500ef7cf` | unchanged |

`app.js` moved, so the ordinary console check verifies this deploy.

## What this deploy fixes

The dropdowns that stopped responding after a reload, with a **completely clean
console** — the second half of FAIL 2, and a different bug from the dead-map
adds fixed in the previous deploy.

**Root cause.** `dsRemountMap()` re-runs `mountDACMap` without a route render,
and `mountDACMap` rewrites only the inner Leaflet div. The card holding the
dropdowns comes from the route render, so every node in it survives and a plain
`addEventListener` accumulates one handler per mount. `ddToggle` flips the
`open` class, so two handlers opened and closed the menu inside a single click.
Nothing failed, so nothing was logged.

Hosted, the remount arrives on essentially every load: the active geometry
dataset hydrates a second or two after first paint and `dsInstall(..., true)`
calls `dsRemountMap()`. Navigating away and back re-rendered the route, replaced
the nodes and rebound from scratch, which is why that revived it.

Listeners net out by **parity** — an even count is dead, an odd count works —
which explains the intermittency better than timing does.

**The fix** is a `bindOnce(node, type, key, fn)` helper that removes any handler
a previous mount left on the node before binding the new one. It removes rather
than skips, so the **live** mount's closure is what stays bound; a stale closure
holding the old map must not be the survivor.

### Wider than the dropdowns

All **15** element-level bindings in the mount now go through it, because the
same defect was behind three more symptoms:

| site | shape | symptom |
|---|---|---|
| legend **(i)** panel | toggle | the popup looked dead |
| detail-box help note | toggle | net zero |
| borough group collapse | toggle | net zero |
| CSV export | not a toggle | the file downloaded **twice** |

Applied uniformly, including where double-firing was already harmless. Judging
idempotence case by case is what let this survive.

The document- and window-level handlers in this file already did exactly this by
hand, with the comment "Replace prior handlers so they don't pile up across
re-renders". This is the same discipline at the element, where it had never been
applied.

### Diagnostic

A new **`duplicate-binding`** entry is written whenever a previous handler is
removed, so a remount that rebinds is visible rather than assumed. The
diagnostic remains opt-in and off by default; an already-armed browser stays
armed across this deploy.

## What to look for after this deploy

Reload Executive Summary repeatedly, which is the reproduction. On a load where
the geometry dataset hydrates and remounts the map:

- **Borough, Neighborhood and Color by all open on the first click.**
- **The legend (i) button opens its panel on the first click** — that one was
  broken by the same defect and is fixed here too.
- **Export CSV downloads exactly one file.**
- `dacDiag()` should show `duplicate-binding` entries on such a load. Their
  presence is the guard working, not a warning.
- `getEventListeners($('.dac-map-dd-trigger'))` should report **one** click
  listener, not two.

## Restoring

`app.js` and `ExecutiveDashboard.html` restore **together** — the HTML's `?v=`
stamp for `app.js` matches only the pair in this folder. `styles.css` needs no
action; the live copy already matches the one here.

```
PATCH https://org9076e69b.crm.dynamics.com/api/data/v9.2/webresourceset(<webResourceId>)
If-Match: *
Content-Type: application/json

{ "content": "<base64 of the saved file>" }
```

then

```
POST https://org9076e69b.crm.dynamics.com/api/data/v9.2/PublishXml
{ "ParameterXml": "<importexportxml><webresources><webresource>{<webResourceId>}</webresource>…</webresources></importexportxml>" }
```

A rolled-back client reports `build cd8a361c60`. Rolling back reinstates the
duplicate bindings: the dropdowns and the legend (i) panel go dead again on any
load that remounts the map, and Export CSV downloads twice. It does **not**
reinstate the dead-map defect, which was fixed one deploy earlier and is
unaffected by this rollback. No uploaded dataset or geometry row is touched.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed — check it before and
after a restore.
