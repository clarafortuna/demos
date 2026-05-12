# Con Edison · DAC Report — Executive Dashboard

Split into 11 self-contained HTML files for easier navigation, faster iteration, and shareable per-section views.

## How to use

**Open `index.html`** in any modern browser (double-click works on Windows/Mac/Linux). The sidebar navigates between the Executive Summary and each of the 10 reporting areas.

Each HTML file is **self-contained** — the data is embedded inline, so no local server is needed and there are no CORS issues.

## File structure

```
dac_dashboard/
├── index.html          ← Executive Summary (start here)
├── section_A.html      ← Clean Energy Spending
├── section_B.html      ← EV Make-Ready Program
├── section_C.html      ← Demand Response
├── section_D.html      ← Distributed Energy Resources
├── section_E.html      ← Strategic Capital Investments
├── section_F.html      ← Customer Outages
├── section_G.html      ← Main Replacement Program
├── section_H.html      ← Leak Repairs
├── section_I.html      ← Clean Energy Jobs
├── section_J.html      ← Customer Operations
│
├── shared.css          ← All styling (theme, charts, tables, print rules)
├── shared.js           ← Chart primitives and shared utilities
├── index_page.js       ← Renderer for the Executive Summary
└── section_page.js     ← Renderer for any individual section
```

To share a single section with someone, send them that section's `.html` file plus `shared.css`, `shared.js`, and `section_page.js` (4 files in the same folder).

## Replacing the placeholder logo

The current logo is an SVG placeholder. To swap in the official Con Edison JPG:

1. Drop your `conedison-logo.jpg` into the `dac_dashboard/` folder.
2. In **every HTML file**, find the comment that says `<!-- LOGO PLACEHOLDER ... -->` (in the sidebar) and replace the `<div class="sidebar-brand-logo">…</div>` block with:
   ```html
   <div class="sidebar-brand-logo"><img src="conedison-logo.jpg" alt="Con Edison"></div>
   ```
3. Also replace the `<svg>` inside `<span class="topbar-logo">` with:
   ```html
   <span class="topbar-logo"><img src="conedison-logo.jpg" alt="Con Edison"></span>
   ```

Tip: the sidebar version sits on a dark navy background, so a light/white version of the logo works best there. The topbar version sits on white, so a dark/color version works best there. If you only have one version, the topbar will look perfect; the sidebar may need a wrapper.

## Year selector and PDF export

- **Year selector** (top right): switches every metric, chart, and table to either 2024 or 2023.
- **Export PDF** (top right): triggers the browser's print dialog. The current page exports cleanly as a multi-page PDF with the topbar and logo on every page.

## Comparability badges

Each source table shows a status badge:

- **SAME** — identical schema across years
- **CHANGED** — schema or definition changed
- **NEW IN 2024** — no 2023 baseline
- **NO 2023 BASELINE** — appears when viewing a 2024 table that didn't exist in 2023
- **PARTIAL YEAR 2023** — 2023 data covers Apr–Dec only (collections-suspension period)

These come straight from the mapping workbook and provide critical context for cross-year comparisons.

## Reported vs Analytical KPIs

The dashboard distinguishes two kinds of metrics, color-coded:

- **Reported KPIs** (blue/navy) — copied directly from the source PDFs. No derivation, no rollups.
- **Analytical KPIs** (mauve/crimson) — composite measures we built. The formula is shown on each card (`ƒ = ...`) so it's clear how each is computed.

This separation lets executives trust the reported numbers as audit-grade and use the analytical ones for decision-making.

## Source data

All numbers trace back to:

- `Con_Edison_2024_Disadvantaged_Communities_Report.pdf`
- `Con_Edison_2023_Disadvantaged_Communities_Report_May_31_2024_724_Update.pdf`
- `ConEd_DAC_Report_All_10_Areas_DR_fixed_2024_2023_mapping.xlsx`
