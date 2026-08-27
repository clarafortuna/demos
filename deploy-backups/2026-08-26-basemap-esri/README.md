# cr2bf_dactest pre-deploy snapshot — 2026-08-26 (basemap off CARTO)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. Captured `2026-08-26T18:23:06Z`.

**Source: branch `fix-basemap-carto-watermark` @ `6bab470`, deployed PRE-MERGE**,
because CARTO began watermarking the basemap during a live presentation and a
merge round-trip would have prolonged it. PR open at the time of deploy.

This time the script said so itself. Its log line reads:

```
source: ExecutiveDashboard_dev/ at fix-basemap-carto-watermark @ 6bab470   *** NOT main ***
```

The 2026-08-21 snapshot carries a hand-written note correcting the same log,
because the label was fixed text reading `main =` while the sha came from `HEAD`.
That fix landed the deploy before this one, and this is its second run — the
provenance is now printed rather than reconstructed afterwards.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 813,062 | yes → 815,128 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 (`?v=` restamp) |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 251,610 | **no — unchanged** |

Pre-deploy sha256 of the archived bytes:

| file | sha256 |
|---|---|
| `app.js` | `4d0f290c01f9b69136aebb1a535c07651c24b59a51a539e3b028d816b4f95e09` |
| `styles.css` | `384cc2d41357b5ff97a6beec56d682c3784df3f1aacf45dbfbabeb947b49d30a` |
| `ExecutiveDashboard.html` | `58b810f4603fdde8cae0adb931ac74c6a23812cd41f2344f92413e21e193478c` |

## Build ids

| file | id | previous |
|---|---|---|
| `app.js` | **`647646a28d`** | `a89ad80b8f` |
| `styles.css` | `384cc2d413` | `384cc2d413` (unchanged) |

Read back and verified byte-identical after publish: app.js 815,128 B,
ExecutiveDashboard.html 11,856 B. `PublishXml` posted for both.

**What rolling back gets you:** the CLCPA-198 build, `a89ad80b8f`. That is a
working dashboard with a **watermarked** basemap — the pointer-selection fix is in
it, the basemap fix is not. Rolling back trades one visible problem for another
rather than returning to a clean state, which is worth knowing before anyone
reaches for it.

## What this deploy changed

Basemap only. CARTO began serving `light_nolabels` with an "API KEY REQUIRED"
watermark painted **into the tile image** — HTTP 200, a valid 23 KB PNG, so no
error surfaced anywhere and nothing in the app could have detected it. Our URL had
not changed since `333f183`.

Swapped to Esri World Light Gray Base, the closest keyless match to the pale
label-free style that was chosen so the choropleth reads. Three details verified
against real NYC tiles rather than assumed:

- Esri orders the path `{z}/{y}/{x}` — **row before column**, the opposite of
  CARTO. Reversing it returns tiles for the wrong place, not an error.
- the layer stops at **z16**; z17+ answer 200 with a ~2.5 KB placeholder, so
  `maxZoom: 19` alone would blank the basemap on deep zoom. `maxNativeZoom: 16`
  keeps Leaflet upscaling instead.
- no `{s}` subdomain and no `{r}` retina suffix; both are CARTO-isms.

Attribution had been suppressed outright (`attributionControl: false`, no
`attribution` on the layer) — a licence gap under CARTO too, not created by this
change. Now enabled, credited, and positioned bottom **left** because the zoom
control owns bottom right and Leaflet defaults attribution to the same corner.

Verified locally at z10/12/14/16/18 with screenshots plus 7 assertions: every
basemap request goes to Esri, **zero** to cartocdn, every tile 200, nothing
requested above z16, attribution visible and crediting Esri without overlapping
the zoom control.

## Still outstanding at the time of writing

**The public build is still watermarked.** `ExecutiveDashboard/app.js` carries the
identical URL. GitHub Pages serves this repository from `main` (root `CNAME` =
`demo.clarafortuna.com`, no `gh-pages` branch), so that fix ships by merge — no
device code, no deploy script.

**A provider decision is queued.** Runtime third-party tiles are the one component
of this stack that no build freeze, harness or review of ours governs, and this one
changed under a live audience with a 200 OK and no warning. Self-hosted tiles
versus a provider with an SLA and a contractual key is a deliberate choice, not a
default.

## Backup convention

Per the rule restated 2026-08-24: **a backup is a pushed branch plus its sha
recorded here. No PR.** Branch: `deploy-backup-2026-08-26-basemap-esri`.
