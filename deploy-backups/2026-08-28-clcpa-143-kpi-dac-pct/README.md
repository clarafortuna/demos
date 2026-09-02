# cr2bf_dactest pre-deploy snapshot, 2026-08-28 (CLCPA-143 item a)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

**Source deployed: branch `main` @ `72b4ec9`** (merge of PR #173,
`clcpa-143-kpi-dac-pct`, commit `19c5006`), as build **`342094b187`**.

## Provenance of these bytes, verified rather than assumed

| step | value |
|---|---|
| `app.js` archived here | 842,166 B, sha256 `d604cf2213f33c83...` |
| matched against the last 25 `main` commits | **`71f0875`** |
| build id that commit stamps | **`3af6ee199f`**, the Block 3 phase 2 deploy |

So this snapshot is the rollback point for the phase 2 build, which Emely
verified hosted.

Method, recorded in each of these READMEs because it is not obvious: the deploy
path reads from disk where `app.js` is CRLF, while a git blob is LF-normalised.
Convert LF to CRLF, canonicalise the `APP_BUILD` sentinel to `'dev'`, hash for
the build id, re-stamp with that id, then sha256.

## Build ids deployed

| file | build id | pushed |
|---|---|---|
| `app.js` | **`342094b187`** | yes, 844,747 B (was 842,166 B) |
| `styles.css` | `384cc2d413` | no, byte-identical at 251,610 B |
| `ExecutiveDashboard.html` | n/a | yes, 11,856 B, `?v=` cache-bust only |

Client check: the console must report `[DAC dashboard] build 342094b187`.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 842,166 | yes |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 251,610 | no |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes |

`cr2bf_dactest/payload.json` (`7d151fe9-3c64-f111-ab0c-7c1e521c7110`) was **not
a target** and is not in this snapshot. It remains an untouched deploy target;
CLCPA-143 item (b) begins by fingerprinting it against the repo copy.

Restore by PATCHing `webresourceset({webResourceId})` with the base64 of the
saved file, then `PublishXml`. `manifest.json` carries the ids and sha256s.

## What shipped: CLCPA-143 item (a)

The three readers of `payload.kpis.reported[].values[yr].dac_pct` now derive the
share from the KPI's own `dac / total` through a new `kpiDacPct` helper, instead
of reading a stored copy. The stored field was never computed: it was copied
from the matching source table's percentage cell when those cells still held
hand-rounded values, and CLCPA-141 later made those cells derive at render.

The three readers, found by sweeping every `kpis.reported` and `.values[` access
rather than grepping for `dac_pct`:

1. `buildSectionDAC` to `pctByYear`, which feeds the radar, dumbbell and strip
2. the section header stat groups, the 44.0 versus 43.7 site on section J
3. the `clean_energy_spend` card tooltip, **not named in the ticket**, found
   only by the sweep because the read is aliased through `ces` then `cesCurr`

## The 8 figures that changed on screen

| KPI | section | year | before | after |
|---|---|---|---|---|
| clean_energy_spend | A | 2023 | 49.0% | 49.4% |
| clean_energy_spend | A | 2024 | 54.0% | 53.9% |
| clean_energy_spend | A | 2025 | 53.0% | 52.7% |
| energy_savings | A | 2023 | 41.0% | 41.3% |
| energy_savings | A | 2025 | 52.0% | 52.5% |
| dr_participation | C | 2023 | 31.0% | 31.1% |
| dr_participation | C | 2024 | 32.0% | 31.6% |
| residential_customers | J | 2025 | 44.0% | 43.7% |

`energy_savings/2024` changes arithmetically but renders 57.0% either way.

Table rendering moves **zero cells**: F9 and J8 stay byte-identical to stored,
and six engine functions plus five descriptor constants are byte-identical to
the previous build.

## Six residual disagreements that this deploy does NOT resolve

Documented so nobody reads the remaining gaps as a regression. All are pinned in
the harness, so a new divergence fails a test.

| KPI-year | card | table | cause |
|---|---|---|---|
| energy_savings/2023 | 41.29% | A2 44.64% | A2/2023's stored Total exceeds the sum of its 28 program rows by 7.5%, so the TABLE derives against an incomplete denominator. The card is right. |
| strategic_capital 2023 | 40.00% | E1 39.91% | the KPI's `dac` is not independent data: it equals `total x the stored rounded percentage`, so `dac/total` can only return the rounded number |
| strategic_capital 2024 | 50.00% | E1 49.87% | as above |
| strategic_capital 2025 | 45.00% | E1 45.28% | as above, against phase 1's weighted mean |
| main_replacement 2023 | 45.94% | G1 46.00% | G1 stores percentages with null feet and no Systemwide Total row, so the table falls back to its stored 0.46 |
| main_replacement 2024 | 46.36% | G1 46.00% | as above |

`main_replacement/2025` agrees, because G1/2025 has real feet. That contrast is
the evidence that 2023 and 2024 are a data gap and not a routing mistake.

Two tickets carry these: one for A2/2023, one for the payload-field issues
(`strategic_capital` and `main_replacement`). Both cross-reference CLCPA-206,
whose spelunk may explain the whole family of source-authored figures that do
not reconcile.
