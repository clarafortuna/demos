# Section A ingestion — row count confirmation

| Artifact | Rows |
|----------|-----:|
| `cf_DIMPERIOD` | **4** (2023–2026, grain YEAR) |
| `cf_DACSTATUS` | **2** (DAC, NON_DAC) |
| `cf_DIMPROGRAM` | **5** (Section A program metadata / portal codes) |
| `cf_FACTCLEANENERGYSPENDING` | **0** in `cf_FACTCLEANENERGYSPENDING_seed.csv` (portfolio `f444…` facts removed; chart-grain facts come from **demo LEGACY_A1** CMT / `cf_FACT_legacyA1_demo.csv`, not this seed). |

**Totals:** 4 + 2 + 5 + 0 = **11** new data rows from base seed CSVs (plus schema columns added first).

**A1 chart-grain facts:** Use **`Build-DemoLegacyA1Import.ps1`** (typically **48** rows: legacy A1 program names × DAC/NON_DAC × 2023/2024).
