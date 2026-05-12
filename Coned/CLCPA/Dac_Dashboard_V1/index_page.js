// ==========================================================================
// index_page.js — Executive Summary page
// ==========================================================================

(function () {
  const D = window.__DASH;
  const PAYLOAD = JSON.parse(document.getElementById('payload').textContent);
  const KPIS_REPORTED   = PAYLOAD.kpis;
  const KPIS_ANALYTICAL = PAYLOAD.analytical;
  const CHARTS          = PAYLOAD.charts;

  let state = { year: '2024' };

  const NO_PCT_IDS = new Set(['clean_energy_jobs']);

  const BASELINE_KEY = 'coned_dac_baseline_pct';
  function getBaseline() {
    const v = parseInt(localStorage.getItem(BASELINE_KEY), 10);
    return (v === 35 || v === 40) ? v : 35;
  }

  function renderHero() {
    const el = document.getElementById('hero-meta');
    el.innerHTML = `<div><dt>Year</dt><dd>${state.year}</dd></div>`;
  }

  function fmtDacHero(k, cur) {
    if (k.format === 'currency' && cur.dac != null) {
      return D.fmtNum(cur.dac, 'currency');
    }
    if (cur.dac != null) {
      const num  = D.fmtNum(cur.dac, k.format);
      const unit = (k.unit && k.unit !== '$') ? ' ' + k.unit : '';
      return num + unit;
    }
    const num  = D.fmtNum(cur.total, k.format);
    const unit = (k.unit && k.unit !== '$') ? ' ' + k.unit : '';
    return num + unit;
  }

  // ---------- Analytical KPI cards ----------
  function renderAnalyticalKPIs() {
    const grid = document.getElementById('kpi-grid-analytical');
    if (!grid) return;
    const yrkey        = 'y' + state.year;
    const prevKey      = state.year === '2024' ? 'y2023' : null;
    const prevYearLabel = state.year === '2024' ? '2023' : '2022';
    const featuredIds  = new Set(['equity_index']);
    grid.innerHTML = KPIS_ANALYTICAL.map(k => {
      const cur    = k[yrkey];
      const prev   = prevKey ? k[prevKey] : null;
      const hasPrev = prev && prev.value !== null && prev.value !== undefined;
      const delta  = hasPrev ? D.deltaPct(cur.value, prev.value) : null;
      const inv    = k.lower_is_better ? ' invert' : '';
      let deltaCls = 'neutral', deltaArrow = '·';
      if (delta !== null) {
        if (delta > 0.005)       { deltaCls = 'up';   deltaArrow = '↑'; }
        else if (delta < -0.005) { deltaCls = 'down'; deltaArrow = '↓'; }
      }
      const featured = featuredIds.has(k.id) ? ' featured' : '';
      const caveat   = k.caveat_2023 && prevKey === 'y2023'
        ? `<span style="background:rgba(184,134,11,0.18); color:var(--amber); padding:1px 5px; border-radius:2px; font-size:9px; font-weight:700; letter-spacing:0.04em; margin-left:4px;">${k.caveat_2023}</span>`
        : '';
      const sectionTag = k.section === 'MULTI' ? 'COMPOSITE' : 'Section ' + k.section;
      const href       = (k.section && k.section !== 'MULTI') ? `section_${k.section}.html` : '#';
      return `<a class="kpi-card analytical${featured}" href="${href}" style="text-decoration:none; color:inherit;">
        <span class="kpi-tag">${sectionTag}</span>
        <div class="kpi-label">${k.label}</div>
        <div class="kpi-value-row">
          <span class="kpi-value-current">${D.fmtNum(cur.value, k.format)}</span>
        </div>
        <div class="kpi-prev-row">
          <div class="kpi-prev">${hasPrev
            ? `vs <span class="kpi-prev-value">${D.fmtNum(prev.value, k.format)}</span> · ${prevYearLabel}${caveat}`
            : `<span style="color:var(--text-4)">— no ${prevYearLabel} baseline</span>`}</div>
          ${delta !== null ? `<span class="kpi-delta ${deltaCls}${inv}">${deltaArrow} ${(Math.abs(delta)*100).toFixed(1)}%</span>` : ''}
        </div>
        <div class="kpi-tooltip">
          <div class="kpi-tooltip-title">${k.label}</div>
          ${k.narrative ? `<div class="kpi-tooltip-body">${k.narrative}</div>` : ''}
          <div class="kpi-tooltip-formula">ƒ = ${k.source_calc}</div>
        </div>
      </a>`;
    }).join('');
  }

  function rerenderAll() {
    renderHero();
    renderAnalyticalKPIs();
  }

  document.addEventListener('baseline:changed', () => {
    rerenderAll();
  });

  D.boot(newYear => {
    state.year = newYear;
    rerenderAll();
  });

  rerenderAll();
})();