# Section A seed import (CLCPA) — instructions

## Demo legacy A1 (23 programs, 48 facts) — repair null lookups

Configuration Migration imports **drop entityreference fields** when the CSV GUID does not exist in the target org (e.g. seed `a111…` / `b222…` while the environment uses different period/DAC rows).

After `Build-DemoLegacyA1Import.ps1` / `pac data import` for facts, if lookups are null, run the Web API patch tool (Azure.Identity interactive/VS/CLI auth):

```text
cd verify-fact-a-integrity
dotnet run -- patch
dotnet run -- patch https://YOURORG.crm.dynamics.com
```

Then validate `mergeSectionA` against packaged legacy JSON:

```text
node verify-merge-section-a.mjs
```

### Optional: remove duplicate UI-created facts

If manual **Section A** entry created extra rows with `cf_sourcetable = UI-SectionA` (same program/year/DAC as seeded facts), delete them so incentives are not double-counted:

```text
cd verify-fact-a-integrity
dotnet run -- delete-ui-dupes
```

### STEP 2 — Table A2 MMBtu only (strict A1 + explicit alias map)

Patches **`cf_energysavingsmmbtu`** on active **`f55aaaaa…`** facts with **`cf_sourcetable`** starting **`LEGACY_A1`**, using **Table A2** from packaged **`cf_clcpa_dash_legacy`** and **`tools/clcpa/a1-a2-program-alias-map.json`** (STEP 1). Only programs listed in **`A1_programs_{year}`** are updated; **no fuzzy** name match to A2 rows (avoids e.g. Retail Lighting vs LMI collisions). Does **not** change **`cf_participants`** (use **`enrich-legacy-a1`** if you need A3 as well).

```text
cd verify-fact-a-integrity
dotnet run -- patch-legacy-a1-a2-mmbtu
dotnet run -- patch-legacy-a1-a2-mmbtu https://YOURORG.crm.dynamics.com
```

### STEP 3 — Table A2-only programs (`LEGACY_A2_*` facts)

Creates **`cf_dimprogram`** rows (if missing) and **`cf_factcleanenergyspending`** rows with **`cf_sourcetable`** `LEGACY_A2_{year}_{slug}_DAC` / `_ND`, **`cf_incentivedollars` = null**, and **`cf_energysavingsmmbtu`** from Table A2 for programs **not** already covered by A1 bar chart + **`tools/clcpa/a1-a2-program-alias-map.json`** (no double-count vs `LEGACY_A1` chart grain). Program **`POST`** uses **`Prefer: return=representation`**.

```text
cd verify-fact-a-integrity
dotnet run -- upsert-legacy-a2-mmbtu
dotnet run -- upsert-legacy-a2-mmbtu https://YOURORG.crm.dynamics.com
```

### STEP 4 — Verify A2 MMBtu completion (demo-dev expectations)

After Steps 2–3 on **Clara Fortuna Dev** (48 `LEGACY_A1` + 58 `LEGACY_A2` active facts):

```text
cd verify-fact-a-integrity
dotnet run -- verify-a2-mmbtu-step4 https://YOURORG.crm.dynamics.com
```

**Expected (demo import + Web API steps above):**

| Check | Expected |
|--------|-----------|
| Active Section A spending facts | **106** (48 `LEGACY_A1*` + 58 `LEGACY_A2*`) |
| Sum `cf_energysavingsmmbtu` **2023** | **3,682,726** (sum of Table A2 **program lines**, excludes Footer **Total**) |
| Sum **2024** | **4,360,879** (matches Table A2 program lines and **Grand Total**) |
| Lookups | **cf_period**, **cf_program**, **cf_dacstatus** → active rows |

**Known packaged legacy inconsistency (not a Dataverse bug):** Table A2 **2023** footer row **Total** shows **4,019,790** MMBtu, which is **337,064** **higher** than the sum of the **27** printed program lines (**3,682,726**). Dataverse is reconciled to **program-line** totals; the footer row in `__LEGACY_DASH` is inconsistent with those lines.

### Report MMBtu totals only

```text
dotnet run -- report-mmbtu-totals https://YOURORG.crm.dynamics.com
```

### Optional: align `f55…` `LEGACY_A1` rows with published tables (A2 / A3)

Legacy **`__LEGACY_DASH`** embeds **Table A2** (program energy savings, MMBtu) and **Table A3** (participants by program, summed across participant types). To copy those values onto **`cf_energysavingsmmbtu`** and **`cf_participants`** for every active fact whose id starts with `f55aaaaa` and whose `cf_sourcetable` starts with `LEGACY_A1`:

```text
cd verify-fact-a-integrity
dotnet run -- enrich-legacy-a1
```

- **Energy:** DAC rows get the **DAC Energy Savings (MMBtu)** column from A2; NON_DAC rows get **Total − DAC**. Program labels on facts are matched to A2/A3 rows by **exact name** or a **prefix/suffix** rule (e.g. fact `SMB Program` ↔ table `SMB Program - Electric & Gas`).
- **Participants:** A3 totals per program are split across DAC and NON_DAC fact rows using the **same DAC share** as in A2 (`DAC MMBtu / Total MMBtu`). If there is no A2 energy row for that program/year, **all** participants from A3 are written to the **NON_DAC** row and the DAC row gets **0** (still no double-count when summing dac + non-dac).

Some chart-only programs (e.g. **Commercial Kitchen**) may appear in A3 but not A2; in that case only participants are updated.

### Optional: remove portfolio-level `f444…` facts (not ConEd report grain)

If legacy seed or imports created **`f4444444…`** rows (`cf_sourcetable` like `A1_2023_RESI_DAC`), delete them so ingestion totals match **A1 chart grain** only (`f55…` + **`LEGACY_A1_`**). Roll-ups are computed in the dashboard.

```text
cd verify-fact-a-integrity
dotnet run -- delete-f444-portfolio
```

### Dual naming: chart grain only in facts

Section A **Figure A1** uses **discrete program labels** from **`A1_programs_YYYY`** in **`__LEGACY_DASH`**. Facts for that grain use **`f55aaaaa…`** ids and **`LEGACY_A1_*`** `cf_sourcetable` values (see **`Build-DemoLegacyA1Import.ps1`**). **`programMatchesLegacyForA1`** in `cf_clcpa_dash_hybrid` merges DV dollars into those bars using **exact** program name + acronym shortcuts (no substring match vs other programs).

**Portfolio** program names (e.g. Residential Energy Efficiency Program on deprecated `f444…` facts) are **not** loaded as separate fact rows in the seed path; **`cf_DIMPROGRAM`** rows with codes `A_RESI_RETROFIT`, … may still exist for metadata, but **incentives** live at chart-program grain only.

---

## Row counts (confirm before import)

| Table | Rows |
|------|-----:|
| `cf_DIMPERIOD` | 4 |
| `cf_DACSTATUS` | 2 |
| `cf_DIMPROGRAM` | 5 |
| `cf_FACTCLEANENERGYSPENDING` | **0** in base seed CSV (portfolio `f444…` rows removed; use **`Build-DemoLegacyA1Import.ps1`** / demo CMT for **LEGACY_A1** chart-grain facts). |
| **Total data rows** | **11** (4 + 2 + 5 + 0) from seed CSVs only |

---

## Order of operations

1. Authenticate (PAC).
2. **Add new columns** via **`Add-SectionAFields-patch.zip`** (`pac solution import`) **or** the legacy Web API mode on `Add-SectionASchemaFields.ps1`, **or** create the same logical names in **make.powerapps.com** if import is blocked by policy.
3. Publish customizations.
4. Import seed rows (**Option A — CMT zip**, **Option B — CSV / Power Apps**, or **Option C — raw CSV** only if your tool supports it).
5. Publish customizations again if your import tool requires it.

`pac data import` expects a zip in **Configuration Migration Tool** layout: **`data_schema.xml`** and **`data.xml`** at the root (see `Build-SectionASeedCmtPackage.ps1` or use the checked-in `SectionA_seed_data.zip`). Raw CSV is not accepted by `pac data import`.

---

## 1) Schema: solution patch (recommended)

Prerequisites: permission to customize tables; base **CLCPA** solution (or the same tables) already in the environment; same publisher **ClaraFortuna** as the patch.

```powershell
pac auth create --environment https://YOURORG.crm.dynamics.com
.\Add-SectionASchemaFields.ps1
```

This runs `pac solution import --path .\Add-SectionAFields-patch.zip --publish-changes` using your active auth profile (no bearer token).

To rebuild the zip after editing the canonical entity XML under `..\..\src\Entities\`:

1. Copy the updated entity folders into the patch source tree (PowerShell):

```powershell
$base = '..\..'
$dst = '.\Add-SectionAFields-patch-src\Entities'
foreach ($e in @('cf_FACTCLEANENERGYSPENDING','cf_DIMPERIOD','cf_DIMPROGRAM')) {
  Copy-Item -Recurse -Force (Join-Path $base "src\Entities\$e") (Join-Path $dst $e)
}
```

2. Pack:

```powershell
pac solution pack --zipfile Add-SectionAFields-patch.zip --folder .\Add-SectionAFields-patch-src
```

### Schema: Web API fallback (token required)

If you cannot import the patch, obtain a bearer token for the instance (example with Azure CLI) and use **`-UseWebApi`**:

```powershell
$envUrl = 'https://YOURORG.crm.dynamics.com'
$token = az account get-access-token --resource $envUrl --query accessToken -o tsv
.\Add-SectionASchemaFields.ps1 -UseWebApi -EnvironmentUrl $envUrl -AccessToken $token
```

Optional publish after manual Web API creation:

```powershell
pac solution publish
```

**Fields created / expected logical names**

- `cf_factcleanenergyspending.cf_highimpactdacpct` (Decimal 0–100, precision 2)
- `cf_dimperiod.cf_clcpa_sectiona_dacshare_target_pct`
- `cf_dimperiod.cf_clcpa_sectiona_dacshare_floor_pct`
- `cf_dimperiod.cf_clcpa_sectiona_kpi1_status_label`
- `cf_dimperiod.cf_clcpa_sectiona_kpi4_yoy_label`
- `cf_dimprogram.cf_portal_short_label`

If an attribute already exists, the script logs a warning and continues.

---

## 2) Import seed data

### Option A — CMT package + `pac data import` (recommended for CLI)

After schema columns exist and customizations are published, import the four tables in one step (order is enforced in the package: DIM PERIOD → DAC STATUS → DIM PROGRAM → FACT).

**Prebuilt zip:** `SectionA_seed_data.zip` (root contains `data_schema.xml` + `data.xml`).

```powershell
pac auth create --environment https://YOURORG.crm.dynamics.com
pac data import -d ".\SectionA_seed_data.zip"
```

**Regenerate** from the CSVs (same folder as this README; CSVs are not modified). The script queries `EntityDefinitions.ObjectTypeCode` for your signed-in org (via `cmt-etc-fetcher`); rerun after changing environments:

```powershell
.\Build-SectionASeedCmtPackage.ps1
# Skip import:  .\Build-SectionASeedCmtPackage.ps1 -SkipImport
```

### Option B — CSV / Power Apps (“Import data”)

For each CSV:

1. Open [Power Apps](https://make.powerapps.com) → **Tables** → select the entity (e.g. **DIM PERIOD**).
2. **Import** → **Import data** → upload the CSV.
3. Map columns (GUID columns map to **Primary column** / lookups as **ID** fields when prompted).
4. Complete the import and resolve any validation errors (e.g. required owner, choice values).

Repeat in this order:

1. `cf_DIMPERIOD_seed.csv`
2. `cf_DACSTATUS_seed.csv`
3. `cf_DIMPROGRAM_seed.csv`
4. `cf_FACTCLEANENERGYSPENDING_seed.csv`

### Option C — Manual schema in Configuration Migration Tool

If you do not use the prebuilt `SectionA_seed_data.zip`, create a CMT schema yourself, export **data.xml** + **data_schema.xml**, zip them, then:

```powershell
pac data import -d .\YourData.zip
```

Use the same `pac auth` profile as other steps.

---

## Unmanaged solution package (CLCPA 1.0.21.27)

Repo root: **`CLCPA_1.0.21.27_unmanaged.zip`** (unmanaged). Build from repo root:

```powershell
cd ..\..   # CLCPA repo root (parent of tools\section-a-ingestion)
pac auth create --environment https://YOURORG.crm.dynamics.com
pac solution pack --zipfile .\CLCPA_1.0.21.27_unmanaged.zip --folder .\src
pac solution import --path .\CLCPA_1.0.21.27_unmanaged.zip --publish-changes
```

`src\Other\Solution.xml` version **1.0.21.27** matches this zip. Data steps (A1 demo CMT / Steps 2–3 Web API) are separate from solution import.

---

## 3) `cf_sourcetable` (fact name column)

`cf_sourcetable` is the **primary name** on **FACT CLEAN ENERGY SPENDING** and must be **unique**. Seeds use values such as `A1_2024_RESI_DAC` so **`A1`** is the lineage prefix while the row remains unique. If you must store **exactly** `A1` for every row, you would need a separate non-key column or a model change; that is **not** in these seeds.

---

## 4) Post-import validation (-queries optional)

- **2024** DAC incentives sum = **$204.8M**; **2024** total incentives = **$395.6M** ⇒ DAC share ≈ **51.77%**.
- **2024** DAC participants = **46,390**; total participants = **82,500**.
- **2023** DAC incentives = **$129.7M**; section total = **$262,552,632** ⇒ share ≈ **49.4%**.
- Non-DAC rows: **`cf_highimpactdacpct`** empty / null.

---

## 5) Files in this folder

| File | Purpose |
|------|---------|
| `README-ROW-COUNTS.md` | Count checklist |
| `Add-SectionASchemaFields.ps1` | `pac solution import` for Section A columns (default) or `-UseWebApi` |
| `Build-SectionASeedCmtPackage.ps1` | Builds `SectionA_seed_data.zip` from the four CSVs (`data_schema.xml` + `data.xml`) |
| `SectionA_seed_data.zip` | CMT data package for `pac data import` |
| `cmt-etc-fetcher\` | Small dotnet helper: prints `LogicalName` + `ObjectTypeCode` (used by the build script) |
| `Add-SectionAFields-patch.zip` | Unmanaged solution layer for the six Section A columns |
| `Add-SectionAFields-patch-src\` | Unpacked patch solution (entity XML) |
| `cf_DIMPERIOD_seed.csv` | 4 YEAR rows (2023–2026), targets/floors |
| `cf_DACSTATUS_seed.csv` | DAC + NON_DAC |
| `cf_DIMPROGRAM_seed.csv` | 5 Section A programs + portal short labels |
| `cf_FACTCLEANENERGYSPENDING_seed.csv` | 20 fact rows (2023–2024, A1 program grain) |
| `verify-fact-a-integrity\` | .NET CLI: lookup patch; STEP 2–4 Table A2 `cf_energysavingsmmbtu`; `report-mmbtu-totals` |
| `tools/clcpa/a1-a2-program-alias-map.json` | A1 chart ↔ Table A2 aliases (STEP 1) |
