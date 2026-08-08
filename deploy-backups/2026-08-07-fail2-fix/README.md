# cr2bf_dactest pre-deploy snapshot — 2026-08-07 (FAIL 2 mount-generation guard)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `116542b`
(PR #114, FAIL 2 mount-generation guard). Seventh deploy of the day.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 685,277 | yes → 689,357 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 242,138 | **no — untouched** |

`styles.css` is archived here anyway, so the folder is a complete picture of the
live app rather than a partial one. The HTML is the same length either side and
was still replaced, because its `?v=` stamp for `app.js` changed.

## Build ids

| file | id | previous |
|---|---|---|
| `app.js` | **`cd8a361c60`** | `e29cb586b6` |
| `styles.css` | `d8500ef7cf` | unchanged |

`app.js` moved, so the ordinary console check verifies this deploy.

## What this deploy fixes

The freeze where every menu stops responding until the page is reloaded, and the
`ADD-TO-DEAD-MAP` entries the diagnostic captured on build `e29cb586b6`.

**Root cause.** `ensureTerritoryGeo()`'s fetch promise and cache are module
scope, shared by every mount, but the `.then()` that adds the layer closes over
*that mount's* `map`, and `service_territories.geojson` is 3.5 MB. Toggle a
territory overlay, get remounted while the fetch is in flight, and the callback
adds a layer to a map Leaflet has already removed. `getPane()` is undefined once
`remove()` has cleared the panes, so `Renderer.onAdd` throws on `appendChild` —
inside `leaflet.js`, which is cross-origin, which is why the captured window
error was the opaque `"Script error."`.

**The trap was set on essentially every page load, by design.** The map mounts
once from the payload, then the geometry dataset hydrates a second or two later
and `dsInstall(..., true)` calls `dsRemountMap()`. That is the 10ms
mount/remove/mount pair in the captured log — the normal path, not a glitch.

**The fix** is a module-scope `_mountGen`. Each mount claims a generation before
its first `await`, and every continuation checks it before touching `map`: the
territory fetch, three `requestAnimationFrame` callbacks, one settle timeout, and
the resume after `getMapGeo()`. It also clears the three `window._dacMap*` hooks
as the old map is removed, since they point into the previous mount's closure.

This is the second time this shape has bitten — the built-in HVI overlay was the
first — so the guard covers the class rather than the caller.

### Diagnostic changes in the same deploy

- A new **`mount-superseded`** entry is written whenever a guard stops a stale
  continuation, naming the site. The point is to see the fix working rather than
  trust it.
- The log is now addressable as **`dacDiag.entries`** at any time, and
  **`dacDiag('json')`** returns a parseable dump with no console output.

The diagnostic remains **opt-in and off by default**. An already-armed browser
stays armed across this deploy; `dac_diag` and `dac_diag_log` are untouched.

## What to look for after this deploy

Keep the diagnostic armed and repeat the reload-abuse session. Three outcomes,
all informative:

1. **No freeze, and `dacDiag()` shows `mount-superseded` with no
   `ADD-TO-DEAD-MAP`** — fixed, and visibly for the stated reason.
2. **No freeze, and no entries of either kind** — the conditions were not hit.
   Not yet evidence.
3. **Still freezes, but `mount-superseded` present and `ADD-TO-DEAD-MAP` absent**
   — the dead-map adds are fixed and the dead menus were a *separate* bug sharing
   the same precondition. That link was never demonstrated, and this is how it
   gets settled.

Two things this deploy explicitly does **not** claim to fix: the captured
`"Script error."` (the `.catch` on that chain swallows the throw, and the
reproduction produced no window error at all), and the causal link between the
dead-map adds and the dead menus.

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

A rolled-back client reports `build e29cb586b6`. Rolling back reinstates the
FAIL 2 defect and removes `mount-superseded` and the `dacDiag` addressability;
`dacDiag()` itself still works on the older build. No uploaded dataset or
geometry row is touched.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed — check it before and
after a restore.
