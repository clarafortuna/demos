# cr2bf_dactest pre-deploy snapshot — 2026-08-07 (opt-in map diagnostic)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `fde672d`
(PR #109, opt-in map diagnostic). Fifth deploy of the day, and deliberately a
solo one: the diagnostic is only useful if it is live and armed **before** the
next long session, and before the HVI overlay retirement removes one of the
remaining FAIL 2 candidates.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 682,652 | yes → 688,856 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 242,815 | **no — untouched** |

`styles.css` is archived here anyway, so the folder is a complete picture of the
live app rather than a partial one. The HTML is the same length either side and
was still replaced: its `?v=` stamp for `app.js` changed.

## Build ids

| file | id | previous |
|---|---|---|
| `app.js` | **`e173f8f221`** | `86e805d661` |
| `styles.css` | `b968d47a4f` | unchanged |

`app.js` moved, so the ordinary console check verifies this deploy.

## What this deploy changed

**Nothing visible, and nothing behavioural.** One `app.js` block was added: an
opt-in diagnostic that is **off by default** and, when off, wraps nothing and
adds no listener — it returns after a single `localStorage` read.

Its purpose is FAIL 2, the freeze where every dropdown stops responding until
the page is reloaded. Two candidate causes have been eliminated by directed
testing; the remaining one has never been caught in the act, because the reload
that clears the symptom also destroys the console evidence.

### Using it

```js
localStorage.setItem('dac_diag', '1')   // arm once, then reload
dacDiag()                              // read the log, any time
dacDiag('off')                         // disarm
dacDiag('clear')                       // empty the log
```

Armed state and the log both live in `localStorage`, so the diagnostic **stays
armed across sessions** and the log **survives the reload**. That is the whole
point: previously the evidence died with the recovery.

### What it records

| entry | meaning |
|---|---|
| `mount` | one per `L.map()`, giving every map a serial |
| `map-removed` | which serial was torn down |
| **`ADD-TO-DEAD-MAP`** | a layer added to a removed map, **with a stack trace** |
| `window-error` | uncaught errors and rejections, plus the mount count |

`ADD-TO-DEAD-MAP` is the one that matters. Leaflet's `getPane()` is undefined
only after `map.remove()`, so "a layer added to a removed map" is the single
certain fact about this failure; what is missing is which caller does it, and
that is one stack trace away.

Note that **one failure records several `ADD-TO-DEAD-MAP` lines**, not one: a
GeoJSON layer adds itself and then each child path, and every one hits the same
dead map. Read the first line's stack; the rest are the same event.

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

A rolled-back client reports `build 86e805d661`. Rolling back removes the
diagnostic. Because it is opt-in and inert when disarmed, a rollback changes
nothing a user can see either way — it only removes the ability to capture the
next occurrence. Nothing about the uploaded datasets or geometry rows is
touched.

If you roll back while the diagnostic is armed, the `dac_diag` and
`dac_diag_log` keys stay in `localStorage` harmlessly; the older build simply
ignores them, and `dacDiag()` will no longer exist.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed — check it before and
after a restore.
