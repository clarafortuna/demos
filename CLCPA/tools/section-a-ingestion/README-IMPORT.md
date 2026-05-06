# Section A seed import (CLCPA) — instructions

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
4. Import **dimension** CSVs, then **fact** CSV (order below).
5. Publish customizations again if your import tool requires it.

`pac data import` only accepts a **zip** produced by **Configuration Migration Tool (CMT)** with a **schema.xml** — not raw CSV. Use **one** of the import paths in the next section.

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

## 2) Import seed data (CSV)

CSV files use **fixed GUIDs** for primary keys and lookups so `cf_FACTCLEANENERGYSPENDING_seed.csv` can reference periods, programs, and DAC status without a separate lookup step.

**Import order**

1. `cf_DIMPERIOD_seed.csv`
2. `cf_DACSTATUS_seed.csv`
3. `cf_DIMPROGRAM_seed.csv`
4. `cf_FACTCLEANENERGYSPENDING_seed.csv`

### Option A — Power Apps “Import data” / Excel (per table)

For each CSV:

1. Open [Power Apps](https://make.powerapps.com) → **Tables** → select the entity (e.g. **DIM PERIOD**).
2. **Import** → **Import data** → upload the CSV.
3. Map columns (GUID columns map to **Primary column** / lookups as **ID** fields when prompted).
4. Complete the import and resolve any validation errors (e.g. required owner, choice values).

Repeat in the order above.

### Option B — Configuration Migration Tool + `pac data import`

1. Launch CMT from PAC:

   ```powershell
   pac tool cmt
   ```

2. Create a **new** export schema including, at minimum, the four tables and the columns present in the CSVs (plus system owner columns if your environment requires them).
3. Import your CSVs into the tool’s data set (or use the tool’s export format), then build **`Data.zip`**.
4. Import:

   ```powershell
   pac data import --data .\Data.zip --verbose
   ```

Use the same environment profile as `pac auth`.

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
| `Add-SectionASchemaFields.ps1` | Web API metadata script |
| `cf_DIMPERIOD_seed.csv` | 4 YEAR rows (2023–2026), targets/floors |
| `cf_DACSTATUS_seed.csv` | DAC + NON_DAC |
| `cf_DIMPROGRAM_seed.csv` | 5 Section A programs + portal short labels |
| `cf_FACTCLEANENERGYSPENDING_seed.csv` | 20 fact rows (2023–2024, A1 program grain) |
