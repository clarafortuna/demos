# Session Log — Con Edison DAC Dashboard

Running log of what landed and what's next, so a fresh session (human or Claude Code)
has fast context without reconstructing it from `git log`. Newest entry first.

---

## 2026-07-10

**`main` at end of session:** `1da8d5a` (Merge PR #69). Local `main` == `origin/main`; no unpushed commits, no stashes.

### Landed on `main` today (code, in repo)
- **CLCPA-152** — Report source tables derive column headers from `getTableSchema` (same source as the ingest editor) instead of reading `schema_by_year[yr]` directly, so newly-created-year tables no longer render data row 0 as the header. Commits `333f405` → merge `162ff51`.
- **CLCPA-163** — Section A "Programs Ranked by Incentive Spend" (Chart 1) + the Impact Quadrant now compute live from the A1 table via a shared `parseA1Programs` helper (reused for current + prior year), instead of the precomputed `payload.charts.A1_programs`. So new years render bars. Commit `23cffe5` → merge `80a9d5c` (#68).
- **_Test promotions + PowerApps deploys** for both: CLCPA-152 promote `59cced9` → #67; CLCPA-163 promote `f001d46` → #69. Each deployed `app.js` to PowerApps app `cr2bf_dactest` (web resource `79151fe9-3c64-f111-ab0c-7c1e521c7110`) via device-code Web API, PublishXml, base64 round-trip verified. Dev-only features (Edit map files / EAP layer / Dataverse read-overlay) kept stripped in `_Test`.

### Dataverse Test-env data changes today (NOT in repo — record here)
Org `org9076e69b` / `cr2bf_dactest`. Done via direct Web API DELETE by ID (never the app's "Remove year").
- **CLCPA-161** — deleted the stray `cr2bf_dacingesttestreportingyears` records for **2023** and **2024** (they were mislabeling seed years as "· added").
- **CLCPA-153** — deleted the empty added years **2020 / 2021 / 2022** (reporting-year records; they had no tabledata).
- **Post-demo cleanup** — deleted test years **2099** and **2100** completely (reporting-year records + their tabledata: A1:2099, A1:2100, A2:2100).
- **Result:** `cr2bf_dacingesttestreportingyears` is now **empty**. Seed tabledata intact: **2023 = 45, 2024 = 52, 2025 = 52** (verified live). Seed years carry no reporting-year record (correct — that's why they don't show "· added").

### Open / next work
- **CLCPA-157** — Executive Summary live-compute (its header cards + KPI grid + equity charts are mostly precomputed; only the J4 arrears card is live).
- **CLCPA-158** — map render.
- **CLCPA-162** — F3 metric-label direct read of `schema_by_year` (low priority; label only, has a fallback).
- **CLCPA-159 remediation (precomputed → live)** — from the report-view audit, the charts that do NOT reflect ingested edits and their precomputed feeds, each convertible to live from its source table using the **CLCPA-163 pattern** (`parseXxx` helper off `p.tables`):
  - **Section E** — fully precomputed (both charts) via `charts.E1_categories` → convert from E1 table.
  - **Section B** — the "DAC vs Non-DAC · By Metric" tornado: L2/DCFC/plug-growth rows from `charts.B2_plugs` → convert from B2 table. (Funding rows already live from B1.)
  - **Section C** — both charts' DAC group (`charts.C3_programs`) and Total group (`charts.C5_programs`) → convert from C3/C5 tables. (Low-income group already live from C4.)
  - **Executive Summary** — reported-KPI cards + header cards 1&2 + equity charts via `kpis.reported` / `charts.E1_categories` → convert from source tables.
  - Feeds to retire: `B2_plugs`, `C3_programs`, `C5_programs`, `E1_categories`, `kpis.reported` (and `A1_programs`, already unused after CLCPA-163).
- **Map-data-storage design** — decide how map overlay data is stored/edited (relates to CLCPA-158 and the stripped Dataverse read-overlay).

### Uncommitted / unpushed state
- None needing attention. Working tree has 3 pre-existing untracked items unrelated to today's work, intentionally not committed: `Coned/CLCPA/Draft documents/`, `Coned/CLCPA/ExecutiveDashboard_dev/sources-update-guide.html`, `app_diff.txt`.

### Working conventions (reminder)
- Feature tickets: edit `ExecutiveDashboard_dev/` only. Promotions copy to `ExecutiveDashboard_Test/` (keep the 3 dev-only features stripped). Never touch `ExecutiveDashboard/` (public client). PowerApps upload only on explicit deploy steps.
- New branch → commit → PR into `main`; the user merges. `CLCPA-XXX:` prefix. English; no co-author / "Generated with Claude Code" trailer.
