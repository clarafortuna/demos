# CLCPA Executive Dashboard — Architecture

A single-page application delivered as three Dataverse web resources into a Power Apps model-driven
app. It reports Con Edison's CLCPA Disadvantaged Communities obligations across ten sections (A–J) and
52 source tables, and carries an in-browser editor that writes report figures back to Dataverse.

## Shape

```
Model-driven app  (org9076e69b.crm.dynamics.com, solution CLCPADACDashboard, prefix cr2bf)
   └─ cr2bf_dactest/ExecutiveDashboard.html     the shell
        ├─ styles.css?v=<id>                     ~9.3k lines
        ├─ Leaflet 1.9.4 + Turf 7 (unpkg CDN)
        └─ app.js?v=<id>                         ONE IIFE, ~24.8k lines, ~533 functions
```

`app.js` is a single `(function () { 'use strict'; … })()`. Nothing is exported except `window.Dash`
and `window.dacDiag`. Sections are delimited by banner comments; `grep -A1 -E "^  // ={10,}" app.js`
lists them.

## Boot

`boot()` runs 13 ordered steps. The order is load-bearing and each step is annotated with the ticket
that fixed it.

```
logBuildId → wireControlTips (delegated once, never per render)
  → loadPayload()                fetch payload.json; fatal view on failure
  → seedYears snapshot           BEFORE any merge (CLCPA-155)
  → await Storage.init()         backend detection + privilege probe
  → DAC_SOURCE==='dataverse'?    composePayloadFromDataverse() replaces the file payload
  → applyAddedYears → applyOverrides
  → state.year = mostRecentYear()
  → buildSidebar → applyOperatorGate → buildYearSelector      (gate BEFORE first paint)
  → hashchange + onRouteChange()                               ── FIRST PAINT ──
  → mlHydrateSavedLayers / dacShadowCompare / dsHydrationStart  not awaited, post-paint
```

## Data model

**Dataverse is the source of report figures**, not `payload.json`. `DAC_SOURCE = 'dataverse'` is the
switch; `payload.json` stays deployed as an instant-revert parachute — reverting is one word, no
deploy.

Ten tables. The report side is `cr2bf_dacingesttesttabledata1` (values) plus three definition tables
(`cr2bf_dacreporttable/section/metric`); the map side is `cr2bf_dactractdataset`,
`cr2bf_dacmaptractdata`, `cr2bf_dacmaplayer`, `cr2bf_dacmapchangehistory`. Full column inventory in
`../MIGRATION_READINESS.md`, audited against the live org.

**Stored vs derived is the central rule.** Stored: table values, schemas, titles, mapping,
presentation hints, section copy, KPI and chart *definitions*. Derived: every chart value, every KPI
value, `meta.years`, `meta.current_year`. A stored copy of a computed figure is a second source of
truth, and CLCPA-141…143 and CLCPA-238 were spent on exactly that class of defect. The composer runs
the same derive engine the renderer does, so the two cannot drift.

## Storage

One facade, two interchangeable backends, chosen once at `init()`:

- **dvBackend** — Dataverse Web API v9.2, `credentials:'same-origin'`. Entity set names resolved from
  `EntityDefinitions` rather than hardcoded. Loads all rows into memory at init; getters serve from
  cache synchronously; writes update the cache then push in the background.
- **lsBackend** — `localStorage`, used on localhost or when no Dataverse context is detected.

Every other method keeps a synchronous signature, so callers never know which backend they have.

## Authorization

The app holds no token, no key and no elevated identity. Every request is the signed-in user's own.

Privileges are **read from Dataverse**, not assumed: `EntityDefinitions(…)?$select=Privileges` for the
real privilege names, then `RetrieveUserPrivilegeByPrivilegeName` per user. The probe **fails closed** —
any error leaves `{canCreate:false, canWrite:false}` and the surface stays read-only.

`applyOperatorGate()` hides the ingestion nav. Its own log line states the model: *"The UI gate is
convenience; Dataverse enforces."* That is accurate and is the sentence to use in a security review.

## Rendering

String building → `innerHTML` on `#view-container`, then a paired `wire*()` re-binds listeners. No
virtual DOM, no diffing, no framework. Four routes: `/`, `/section/[A-J]`, `/ingest`, `/maplayers`.

Newer code prefers **delegated** handlers bound once at boot (CLCPA-226) over per-render binding.

## Map

`mountDACMap` is ~2.2k lines — the largest single function. Geometry and indicators are **composed from
Dataverse tract datasets**; the `map_payload.json` file fallback was removed in slice 5d, so the file
is dead at runtime though still present. Turf dissolves selected tract boundaries on the main thread.

## Known structural facts worth knowing before changing anything

- `header_levels` is **not** a row count. `2` means `data[0]` is a second header row; `0` means
  something else entirely (D1 carries `0` and its first row is real data). A predicate of "has a
  `header_levels` key" is wrong and has caused a defect.
- `bareNumber` is the single numeric reader for summing (CLCPA-278 r3). Three consumers share it.
- The Dataverse read cache is never invalidated after `init`, and writes are fire-and-forget with no
  ETag — two concurrent editors overwrite each other silently. See `SECURITY.md`.
