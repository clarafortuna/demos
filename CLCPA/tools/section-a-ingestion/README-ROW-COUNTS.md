# Section A ingestion — row count confirmation

| Artifact | Rows |
|----------|-----:|
| `cf_DIMPERIOD` | **4** (2023–2026, grain YEAR) |
| `cf_DACSTATUS` | **2** (DAC, NON_DAC) |
| `cf_DIMPROGRAM` | **5** (Section A programs) |
| `cf_FACTCLEANENERGYSPENDING` | **20** (5 programs × 2 DAC statuses × 2 years: 2023, 2024) |

**Totals:** 4 + 2 + 5 + 20 = **31** new data rows (plus schema columns added first).

**Verified:** \(5 \times 2 \times 2 = 20\) fact rows.
