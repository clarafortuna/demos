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

---

## Row counts (confirm before import)

| Table | Rows |
|------|-----:|
| `cf_DIMPERIOD` | 4 |
| `cf_DACSTATUS` | 2 |
| `cf_DIMPROGRAM` | 5 |
| `cf_FACTCLEANENERGYSPENDING` | 20 |
| **Total data rows** | **31** |

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
