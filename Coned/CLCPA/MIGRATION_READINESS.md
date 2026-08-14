# DAC dashboard — migration readiness

**For Randy, who directs the migration. This document supplies facts, not a plan.**

Everything below was read from `org9076e69b.crm.dynamics.com` (Clara Fortuna Dev,
solution `CLCPADACDashboardDev`, publisher prefix `cr2bf`) on **2026-08-14**, by a
read-only audit that performed no write of any kind. Row counts, byte sizes,
privilege names and column facts are measured, not recalled. Where something could
not be read, it says so rather than guessing.

Four sections: **inventory**, **dead weight**, **security roles**, **open
questions**. The open questions are the only part that needs an answer from Con
Edison; the rest is description.

---

## 1. Solution inventory

### 1a. Tables — seven, all unmanaged

| Logical name | Display name | Rows | Purpose | Audit |
|---|---|---|---|---|
| `cr2bf_dactractdataset` | DAC Tract Dataset | **9** | Every versioned data file the map reads. Four families in one table, told apart by `cr2bf_DatasetKey`. | off |
| `cr2bf_dacmaptractdata` | DAC Map Tract Data | **2,333** | One row per census tract. Eight editable electric/gas columns, applied over the dataset values. | **on** |
| `cr2bf_dacmapchangehistory` | DAC Map Change History | **49** | Audit trail: one row per map upload, with per-field counts and the changed GEOID list. | off |
| `cr2bf_dacmaplayer` | DAC Map Layer | **2** | Saved GeoJSON overlay layers with their colour ramps. | off |
| `cr2bf_dacingesttestreportingyear` | DAC Ingest Test Reporting Year | **0** | Report editor: extra reporting years. | off |
| `cr2bf_dacingesttesttabledata1` | DAC Ingest Test - Table Data | **149** | Report editor: per-table cell overrides. | off |
| `cr2bf_dacingesttestchangehistory` | DAC Ingest Test Change History | **16** | Report editor: audit trail. | off |

**`cr2bf_dactractdataset` holds four different things.** The record-level
discriminator is `cr2bf_DatasetKey`, so what a row is can be known without
downloading its file. This matters for migration because the four have different
activation rules:

| DatasetKey | What it carries | `IsActive` means | Resolved by |
|---|---|---|---|
| `nyserda_dac` | ~56 NYSERDA indicator values per tract | **live** — exactly one at a time | an operator's toggle |
| `tract_geometry` | tract polygons + 8 map properties | **published** — several at once | the live dataset's GEOID vintage |
| `service_territories` | the electric/gas/ORU outlines | **published** — exactly one | nothing; it is simply the one |
| `coned_operational` | 8 per-tract electric/gas figures | **published** — one per vintage | the live dataset's GEOID vintage |

The file itself lives in a **File column** (`cr2bf_DataFile`), configured at
`MaxSizeInKB = 131072` (128 MB). Uploads above 1 MB use the chunked protocol.

**The three `dacingesttest` tables are named after an early spike and now hold
live report data.** See open question 1 — logical names cannot be changed after
creation.

### 1b. Web resources — nine, 7.75 MB total

| Name | Type | Bytes | What it is |
|---|---|---|---|
| `cr2bf_dactest/app.js` | JavaScript | 804,067 | The whole application. |
| `cr2bf_dactest/styles.css` | CSS | 251,610 | Its stylesheet. |
| `cr2bf_dactest/ExecutiveDashboard.html` | HTML | 11,856 | The page. Loads the two above with `?v=` cache stamps. |
| `cr2bf_dactest/index.html` | HTML | 3,764 | The entry/sign-in shim. |
| `cr2bf_dactest/payload.json` | XML* | 296,646 | **Live and required.** Feeds the borough charts and the report figures. |
| `cr2bf_dactest/map_payload.json` | XML* | 4,794,147 | **No longer read.** See dead weight. |
| `cr2bf_dactest/Data/hvi_zcta.geojson` | XML* | 1,566,418 | **No longer read.** See dead weight. |
| `cr2bf_dactest/logo/ConEd_Logo_completo.svg` | SVG | 8,075 | Logo. |
| `cr2bf_dactest/logo/ConEd_Logo_fondo_blanco.jpeg` | JPG | 10,418 | Logo. |

\* Dataverse has no JSON web-resource type; `.json` and `.geojson` files are
stored as type XML. That is normal and not a defect.

**`payload.json` and `map_payload.json` are different files with confusingly
similar names.** The first is live; the second is dead. Anyone deleting one should
work from the id, not the name — see dead weight below.

---

## 2. Dead weight — what can be deleted before migrating

Two candidates. **Both were verified by reading the content of all nine web
resources, not by assuming `app.js` was the only place to look.** Nothing is listed
here on the strength of "it looks unused".

### 2a. `map_payload.json` — 4,794,147 bytes, **safe to delete**

Web resource id **`9a93efd4-296b-f111-ab0d-7c1e521c7110`**.

This was the map's original data file: tract shapes, indicator values and the
ConEd operational figures, all in one 4.8 MB blob served on every page load. Slices
5b through 7c moved every part of it into Dataverse datasets, and slice 5d removed
the code that fetched it.

Evidence it is unread, in the order it was gathered:

1. **Empirical.** With the current build deployed, the network panel was filtered
   on `map_payload` and all four routes were walked, plus a territory-layer toggle:
   **zero requests.**
2. **All nine web resources grepped.** One mentions the string: `app.js`.
3. **Those mentions classified.** Sixteen occurrences — **fourteen comments, one
   console message, two lines of operator help text. Zero fetches.** No `fetch`,
   no `XMLHttpRequest`, no request of any kind survives in the shipped code.

The blunt string search reported "not clean" and the classification is what
settles it. Recorded that way because a future reviewer running the same grep
should not conclude the check failed.

**One consequence to hold, because it is the only real risk here.** Rolling the app
back to build `da3ba85ac5` or earlier gives a client that *does* fetch this file.
**So the rollback path depends on the resource existing.** Once it is deleted,
restoring it is part of any such rollback. The bytes are preserved in the repository
under `deploy-backups/2026-08-14-payload-funeral/` and in every earlier folder in
that series.

### 2b. `Data/hvi_zcta.geojson` — 1,566,418 bytes, **safe to delete**

Web resource id **`36dfa2aa-b686-f111-8075-6045bddab7dd`**.

Heat Vulnerability Index polygons by ZIP code. It was a built-in map layer; that
layer now exists as a **saved layer row in `cr2bf_dacmaplayer`** with its own
provenance and colour ramp, so the file has no reader.

Same verification: nine resources grepped, one mention — a comment in `app.js`
illustrating how layer names are turned into slugs (`"hvi_zcta_2020 (final)" ->
"hvi_zcta_2020_final"`). **No fetch of it exists anywhere.**

Deleting both removes **6.36 MB, 82% of the solution's total web-resource
payload**, and removes the last two large files that would otherwise be carried
into the new environment for no purpose.

### 2c. What is NOT dead weight, stated so nobody tidies it away

- **`payload.json`** (296,646 bytes) is live. It feeds the borough charts and the
  report. The name similarity to `map_payload.json` is the trap in this solution.
- **`cr2bf_dacingesttestreportingyear` has 0 rows** but its table is read on every
  report load and written when a year is added. Zero rows is an empty feature, not
  a dead table.
- **The 4 retired rows in `cr2bf_dactractdataset`** are rollback points, not
  clutter. Of the 9 rows, 5 are published/active and 4 are retired.

---

## 3. Security-role specification

Two roles are needed. The app already probes privileges at boot and hides controls
it cannot use, so a role that is too narrow degrades cleanly rather than erroring —
but it degrades **silently**, which is why getting this right matters.

**Privilege names below were read from table metadata, not constructed.** They use
the table's **SchemaName** casing (`cr2bf_DACTractDataset`), not the lowercase
logical name. A hand-built `prvCreatecr2bf_dactractdataset` does not exist, the
probe fails, and every control it guards disappears with no error. This has already
been hit once in this project.

Scope: **Organization** for all of it. These tables hold reference data shared by
every user; there is no per-record ownership model.

### 3a. Role: **DAC Dashboard Operator**

Can upload and activate data, edit tract values, and manage saved layers.

| Table | Create | Read | Write | Delete | Append | AppendTo |
|---|---|---|---|---|---|---|
| `cr2bf_dactractdataset` | ✔ | ✔ | ✔ | — | ✔ | ✔ |
| `cr2bf_dacmaptractdata` | — | ✔ | ✔ | — | ✔ | ✔ |
| `cr2bf_dacmapchangehistory` | ✔ | ✔ | — | — | ✔ | ✔ |
| `cr2bf_dacmaplayer` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `cr2bf_dacingesttestreportingyear` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `cr2bf_dacingesttesttabledata1` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `cr2bf_dacingesttestchangehistory` | ✔ | ✔ | — | — | ✔ | ✔ |

Privilege names to grant:

```
prvCreatecr2bf_DACTractDataset             prvReadcr2bf_DACTractDataset
prvWritecr2bf_DACTractDataset              prvAppendcr2bf_DACTractDataset
prvAppendTocr2bf_DACTractDataset
prvReadcr2bf_DACMapTractData               prvWritecr2bf_DACMapTractData
prvAppendcr2bf_DACMapTractData             prvAppendTocr2bf_DACMapTractData
prvCreatecr2bf_DACMapChangeHistory         prvReadcr2bf_DACMapChangeHistory
prvAppendcr2bf_DACMapChangeHistory         prvAppendTocr2bf_DACMapChangeHistory
prvCreatecr2bf_DACMapLayer                 prvReadcr2bf_DACMapLayer
prvWritecr2bf_DACMapLayer                  prvDeletecr2bf_DACMapLayer
prvAppendcr2bf_DACMapLayer                 prvAppendTocr2bf_DACMapLayer
prvCreatecr2bf_DACIngestTestReportingYear  prvReadcr2bf_DACIngestTestReportingYear
prvWritecr2bf_DACIngestTestReportingYear   prvDeletecr2bf_DACIngestTestReportingYear
prvAppendcr2bf_DACIngestTestReportingYear  prvAppendTocr2bf_DACIngestTestReportingYear
prvCreatecr2bf_DACIngestTestTableData1     prvReadcr2bf_DACIngestTestTableData1
prvWritecr2bf_DACIngestTestTableData1      prvDeletecr2bf_DACIngestTestTableData1
prvAppendcr2bf_DACIngestTestTableData1     prvAppendTocr2bf_DACIngestTestTableData1
prvCreatecr2bf_DACIngestTestChangeHistory  prvReadcr2bf_DACIngestTestChangeHistory
prvAppendcr2bf_DACIngestTestChangeHistory  prvAppendTocr2bf_DACIngestTestChangeHistory
```

Four deliberate choices in that table:

- **No Delete on `cr2bf_dactractdataset`.** Superseding a version *retires* it
  (`IsActive = false`); the old row stays as the rollback. Deleting rows is a
  deliberate administrative act and should not be a routine operator power.
- **No Create on `cr2bf_dacmaptractdata`.** All 2,333 tract rows already exist, one
  per tract. An operator edits values; creating a 2,334th row would mean inventing
  a tract.
- **No Write on either change-history table.** Audit rows are appended and never
  amended. Create + Read is exactly what an append-only trail needs.
- **`Append` and `AppendTo` are included throughout** because the File-column
  upload and the audit relationships need them. Omitting them is a common way to
  produce an operator who can create a record but not attach its file.

`Assign` and `Share` are not needed by either role.

### 3b. Role: **DAC Dashboard Viewer**

Read-only. Sees the map, the reports and the exports; every upload, toggle and edit
control is hidden by the app's own privilege probe.

| Table | Read | everything else |
|---|---|---|
| all seven | ✔ | — |

```
prvReadcr2bf_DACTractDataset            prvReadcr2bf_DACMapTractData
prvReadcr2bf_DACMapChangeHistory        prvReadcr2bf_DACMapLayer
prvReadcr2bf_DACIngestTestReportingYear prvReadcr2bf_DACIngestTestTableData1
prvReadcr2bf_DACIngestTestChangeHistory
```

**Read on all seven is required, not optional.** A viewer missing
`prvReadcr2bf_DACTractDataset` gets no indicator values and no tract shapes, and as
of the current build the map says "the map has no data to draw" rather than failing
silently. That message is correct but it will be read as an outage, so the role
needs all seven from the start.

### 3c. Beyond the tables

- **Read on the web resources and the model-driven app** is required for both
  roles, or the page will not load.
- **Organization-level auditing is currently OFF.** `cr2bf_dacmaptractdata` has
  table-level auditing **on**, so its per-field history will only start recording
  once the org setting is enabled. See open question 4.

---

## 4. Open questions — only Con Edison or Randy can answer these

### Q1. The three `dacingesttest` table names

`cr2bf_dacingesttestreportingyear`, `cr2bf_dacingesttesttabledata1` and
`cr2bf_dacingesttestchangehistory` are named after an early ingest **test**, and one
carries a `1` suffix. They now hold live report data — 149 override rows and 16
audit rows.

**Logical names cannot be changed after a table is created.** So the choice is:

- carry the names into the new environment and accept that a production table is
  called "Ingest Test" forever; or
- create correctly named tables in the target and migrate the 165 rows, which also
  means updating the entity-set names in `app.js`.

Display names *can* be changed independently, which softens the first option but
does not fix what an administrator sees in the table list. **Nobody outside Con
Edison can decide how much this matters.**

### Q2. Which environment, and does the data travel with the solution?

The solution is **unmanaged** in a dev environment. Two things follow that need
deciding:

- **Target environment**, and whether the intended path is
  dev → test → production with managed solutions, or a single environment.
- **The data does not travel with the solution.** Tables and web resources do; the
  **9 dataset rows, 2,333 tract rows, 2 saved layers and 165 report rows do not.**
  Someone must decide whether the target starts empty and is repopulated through
  the operator flow (which works — the guides cover it, and the first-upload path
  was specifically fixed for this case), or whether the rows are migrated by tooling.

Repopulating through the app has a real advantage worth stating: it proves the
operator path end to end in the new environment, which a data migration does not.

### Q3. Who is the audience, and does that change the sign-in?

The current entry point is `index.html`, a shim with a session flag — not
enterprise authentication. If the target is production with real Con Edison users,
the sign-in model needs deciding, and it is not something this project has settled.

### Q4. Organization-level auditing

Currently **OFF** at the organization level. `cr2bf_dacmaptractdata` — the table
where hand corrections to customer figures are made — has table and column
auditing switched **on** and is therefore recording nothing.

Turning it on is a global setting with implications beyond this solution
(storage, performance, other apps in the environment), which is why it was left
alone. **If per-field history on tract edits is a requirement, this must be enabled
before go-live**, and it needs an owner who can weigh the org-wide effect.

### Q5. The 2020 tract geometry

Two `tract_geometry` rows carry vintage 2020. The **published** one has never been
inspected by anyone; the **retired** one has been, and is the only 2020 geometry
whose contents are known good. Neither carries the source fingerprint the 2010 set
now has.

Nothing in production depends on either today — the live dataset is 2010 — so this
is not urgent. It becomes urgent the day a 2020 NYSERDA release goes live, and
somebody should own it before then rather than during.

### Q6. `cr2bf_dacmaptractdata` holds a copy, not corrections

All 2,333 rows were measured against the source spreadsheets: **not one value
differs.** The table is a mirror of the extract rather than a record of human
corrections, so the "an edit wins over the source" behaviour has nothing to protect
yet.

That is a data decision, not a technical one: trim the table to real corrections
and let the dataset supply the rest, or leave the mirror in place. It affects what
gets migrated, so it is better decided before the move than after.

---

## What is already migration-ready

Stated for completeness, so the list above is read as the exceptions rather than
the picture.

- **All map data is in Dataverse.** No part of the map is served from a file at
  runtime; slice 5d removed the last one.
- **Every data file is versioned, with provenance.** Each dataset row records its
  source label, its GEOID vintage, its tract and field counts, a key checksum and
  a fingerprint of the source files it was built from.
- **Uploads are validated before they are stored, and re-validated before they go
  live.** A bad file is refused with a message naming the reason.
- **The operator flows are documented and tested from a clean machine.** Three
  guides, and a self-contained package proven by unpacking it outside the
  repository and running every documented command against a fresh virtual
  environment.
- **The rollback story is written down.** Every deploy has a byte-exact snapshot of
  what it replaced, with checksums and restore instructions.
