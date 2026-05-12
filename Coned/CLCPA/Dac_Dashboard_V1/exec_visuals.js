// ==========================================================================
// exec_visuals.js — DAC Shares + Investment Trend block
// ==========================================================================

(function () {
  const PAYLOAD = JSON.parse(document.getElementById('payload').textContent);

  // ── Section DAC data ──
  function buildSectionDAC() {
    const map24 = {}, map23 = {};
    PAYLOAD.kpis.forEach(k => {
      const sec = k.section;
      const p24 = k.y2024 && k.y2024.dac_pct;
      if (p24 != null) {
        if (!map24[sec] || (k.format === 'currency' && map24[sec].format !== 'currency')) {
          map24[sec] = { pct: p24, format: k.format, label: k.label, dac: k.y2024.dac, total: k.y2024.total };
        }
      }
      const p23 = k.y2023 && k.y2023.dac_pct;
      if (p23 != null) {
        if (!map23[sec] || (k.format === 'currency' && map23[sec].format !== 'currency')) {
          map23[sec] = { pct: p23 };
        }
      }
    });
    const SECTION_NAMES = {
      A: 'Clean Energy', B: 'EV Make-Ready', C: 'Demand Response',
      D: 'DER', E: 'Strategic Cap', F: 'Outages',
      G: 'Main Replace', H: 'Leak Repairs', I: 'Jobs', J: 'Customer Ops'
    };
    const RADAR_SHORT_NAMES = {
      A: 'Clean Energy', B: 'EV Ready', C: 'Demand Resp',
      D: 'DER', E: 'Strategic', F: 'Outages',
      G: 'Mains', H: 'Leaks', I: 'Jobs', J: 'Cust Ops'
    };
    const sections = ['A','B','C','D','E','F','G','H','I','J'];
    return sections.map(s => ({
      id: s,
      name: SECTION_NAMES[s],
      radarName: RADAR_SHORT_NAMES[s],
      pct2024: map24[s] ? map24[s].pct : 0,
      pct2023: map23[s] ? map23[s].pct : null,
      hasData: !!map24[s],
      label: map24[s] ? map24[s].label : null,
      isWarn: s === 'F'
    }));
  }

  const SECTIONS = buildSectionDAC();
  let state = { year: '2024' };

  // ── Baseline toggle ──
  const BASELINE_KEY = 'coned_dac_baseline_pct';
  function getBaseline() {
    const v = parseInt(localStorage.getItem(BASELINE_KEY), 10);
    return (v === 35 || v === 40) ? v : 35;
  }
  function setBaseline(n) {
    localStorage.setItem(BASELINE_KEY, String(n));
    document.dispatchEvent(new CustomEvent('baseline:changed', { detail: n }));
  }

  function renderToggleBar() {
    const baseline = getBaseline();
    return `
      <div class="rkpi-toggle-bar exec-toggle-bar">
        <span class="rkpi-toggle-label">DAC EQUITY BASELINE</span>
        <div class="rkpi-toggle-group" role="tablist">
          <button class="rkpi-toggle-btn ${baseline === 35 ? 'active' : ''}" data-baseline="35">35%<span class="toggle-sub">· NY Climate Act</span></button>
          <button class="rkpi-toggle-btn ${baseline === 40 ? 'active' : ''}" data-baseline="40">40%<span class="toggle-sub">· NY Climate Act Goal</span></button>
        </div>
        <span class="rkpi-toggle-help">DAC % shown vs the ${baseline}% NY Climate Act ${baseline === 40 ? 'goal' : 'mandate'}</span>
      </div>
    `;
  }

  // ── Strip chart ──
  function renderStripWithGap(baseline, year) {
    const goal = baseline / 100;
    const data = SECTIONS.slice().sort((a, b) => a.id.localeCompare(b.id));
    const pctOf = s => year === '2023' ? s.pct2023 : s.pct2024;
    const hasOf = s => year === '2023' ? (s.pct2023 != null) : s.hasData;

    function statusPill(s) {
      const has = hasOf(s);
      if (!has) return `<span class="sg-pill sg-pill-na">—</span>`;
      const gap = (pctOf(s) - goal) * 100;
      if (s.isWarn) {
        if (gap > 5)  return `<span class="sg-pill sg-pill-below">Critical</span>`;
        if (gap > 0)  return `<span class="sg-pill sg-pill-near">Monitor</span>`;
                      return `<span class="sg-pill sg-pill-above">OK</span>`;
      }
      if (gap > 5)              return `<span class="sg-pill sg-pill-above">Above</span>`;
      if (Math.abs(gap) <= 0.5) return `<span class="sg-pill sg-pill-above">At goal</span>`;
      if (gap > -5)             return `<span class="sg-pill sg-pill-near">Near</span>`;
                                return `<span class="sg-pill sg-pill-below">Below</span>`;
    }

    const rows = data.map(s => {
      const has      = hasOf(s);
      const pct      = has ? pctOf(s) : 0;
      const pctNum   = pct * 100;
      const pctText  = has ? pctNum.toFixed(1) + '%' : '—';
      const dacWidth = has ? pctNum : 0;
      const gap = has ? +((pct - goal) * 100).toFixed(1) : null;
      let gapText, gapColor;
      if (gap === null)             { gapText = '—';              gapColor = 'var(--text-4)'; }
      else if (Math.abs(gap) < 0.5) { gapText = 'at goal';        gapColor = 'var(--green)';  }
      else if (gap > 0)             { gapText = '+' + gap + 'pp'; gapColor = 'var(--dusk)';   }
      else                          { gapText = gap + 'pp';       gapColor = 'var(--red)';    }
      const sectionPayload = PAYLOAD.kpis.find(k => k.section === s.id);
      const dacVal   = (sectionPayload && sectionPayload['y' + year]) ? sectionPayload['y' + year].dac   : null;
      const totalVal = (sectionPayload && sectionPayload['y' + year]) ? sectionPayload['y' + year].total : null;
      const kpiLabel = sectionPayload ? sectionPayload.label : '';
      const kpiUnit  = sectionPayload ? sectionPayload.unit  : '';
      const kpiFmt   = sectionPayload ? sectionPayload.format : 'int';
      const fmtVal = v => {
        if (v == null) return 'n/a';
        if (kpiFmt === 'currency') return v >= 1e9 ? '$'+(v/1e9).toFixed(2)+'B' : v >= 1e6 ? '$'+(v/1e6).toFixed(1)+'M' : '$'+Math.round(v/1e3)+'K';
        if (v >= 1e6) return (v/1e6).toFixed(2)+'M';
        if (v >= 1e3) return (v/1e3).toFixed(0)+'K';
        return Math.round(v).toLocaleString();
      };
      const tooltipData = `data-section="${s.id}" data-name="${s.name}" data-pct="${pctText}" data-baseline="${baseline}%" data-gap="${gapText}" data-kpi-label="${kpiLabel.replace(/"/g,"'")}" data-dac-val="${fmtVal(dacVal)}" data-total-val="${fmtVal(totalVal)}" data-unit="${kpiUnit}"`;
      return `
        <div class="strip-row" ${tooltipData}>
          <div class="strip-label">${s.name}</div>
          <div class="strip-pct">${pctText}</div>
          <div class="strip-bar">
            <div class="strip-fill" style="width:${dacWidth}%;"></div>
            <div class="strip-tick" style="left:${baseline}%;"></div>
            ${!has ? '<span class="strip-empty-label">N/A</span>' : ''}
          </div>
          ${statusPill(s)}
          <div class="strip-gap" style="color:${gapColor}">${gapText}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="exec-card sg-card" data-help="strip">
        <div class="chart-card-head">
          <div>
            <h3>DAC Equity by Section</h3>
            <p class="chart-sub">Each bar = DAC share · Tick = ${baseline}% goal · ${year}</p>
          </div>
          <div class="chart-head-right">
            <div class="chart-legend">
              <div class="legend-item"><span class="legend-swatch" style="background:var(--dusk)"></span>DAC</div>
              <div class="legend-item"><span class="legend-swatch" style="background:var(--pale-sky)"></span>Non-DAC</div>
              <div class="legend-item"><span class="legend-swatch" style="background:#2873BA;width:2px;"></span>${baseline}% goal</div>
              <div class="legend-item"><span class="legend-swatch" style="background:rgba(42,119,85,0.55)"></span>Above</div>
              <div class="legend-item"><span class="legend-swatch" style="background:rgba(178,59,42,0.55)"></span>Below</div>
            </div>
          </div>
        </div>
        <div class="chart-body">
          <div class="sg-col-header">
            <span class="sg-ch-section">Section</span>
            <span class="sg-ch-pct">DAC %</span>
            <span class="sg-ch-bar">Share vs ${baseline}% goal</span>
            <span class="sg-ch-status">Status</span>
            <span class="sg-ch-gap">Gap</span>
          </div>
          <div class="strip-body">${rows}</div>
        </div>
      </div>
    `;
  }

  // ── Dumbbell chart ──
  function renderDumbbell(baseline, year) {
    const hasBaseline = (year === '2024');
    const prevLabel = hasBaseline ? '2023' : '2022';
    const data = SECTIONS.slice().sort((a, b) => a.id.localeCompare(b.id));

    const rows = data.map(s => {
      const curr    = (year === '2024') ? s.pct2024 : s.pct2023;
      const prev    = (year === '2024') ? s.pct2023 : null;
      const hasCurr = (year === '2024') ? s.hasData : (s.pct2023 != null);
      const hasPrev = (prev != null);
      const hasBoth = hasCurr && hasPrev;

      let pillCls = 'dumb-pill-neutral';
      let pillText = '—';
      if (!hasBoth) {
        pillText = hasBaseline ? '—' : 'no ' + prevLabel;
      } else {
        const dpp = (curr - prev) * 100;
        if (s.isWarn) {
          if (dpp < -0.5)      { pillCls = 'dumb-pill-up';     pillText = '↓ ' + Math.abs(dpp).toFixed(1) + 'pp'; }
          else if (dpp > 0.5)  { pillCls = 'dumb-pill-down';   pillText = '↑ +' + dpp.toFixed(1) + 'pp'; }
          else                 { pillCls = 'dumb-pill-neutral'; pillText = '→ ' + Math.abs(dpp).toFixed(1) + 'pp'; }
        } else {
          if (dpp > 0.5)       { pillCls = 'dumb-pill-up';     pillText = '↑ +' + dpp.toFixed(1) + 'pp'; }
          else if (dpp < -0.5) { pillCls = 'dumb-pill-down';   pillText = '↓ ' + dpp.toFixed(1) + 'pp'; }
          else                 { pillCls = 'dumb-pill-neutral'; pillText = '→ ' + Math.abs(dpp).toFixed(1) + 'pp'; }
        }
      }

      let barInner;
      if (!hasCurr) {
        barInner = `<div class="dumb-tick" style="left:${baseline}%;"></div>`;
      } else if (!hasBoth) {
        const pctNum = curr * 100;
        barInner = `
          <div class="dumb-tick" style="left:${baseline}%;"></div>
          <div class="dumb-dot dumb-dot-curr" style="left:${pctNum}%;"></div>`;
      } else {
        const currNum = curr * 100;
        const prevNum = prev * 100;
        const left  = Math.min(currNum, prevNum);
        const width = Math.abs(currNum - prevNum);
        barInner = `
          <div class="dumb-tick" style="left:${baseline}%;"></div>
          <div class="dumb-connector" style="left:${left}%;width:${width}%;"></div>
          <div class="dumb-dot dumb-dot-prev" style="left:${prevNum}%;"></div>
          <div class="dumb-dot dumb-dot-curr" style="left:${currNum}%;"></div>`;
      }

      const currTxt     = hasCurr ? (curr * 100).toFixed(1) + '%' : '—';
      const prevTxt     = hasPrev ? (prev * 100).toFixed(1) + '%' : 'n/a';
      const sPayload    = PAYLOAD.kpis.find(k => k.section === s.id);
      const dacVal2     = (sPayload && sPayload['y' + year]) ? sPayload['y' + year].dac   : null;
      const totalVal2   = (sPayload && sPayload['y' + year]) ? sPayload['y' + year].total : null;
      const kpiLabel2   = sPayload ? sPayload.label : '';
      const kpiUnit2    = sPayload ? sPayload.unit  : '';
      const kpiFmt2     = sPayload ? sPayload.format : 'int';
      const fmtVal2 = v => {
        if (v == null) return 'n/a';
        if (kpiFmt2 === 'currency') return v >= 1e9 ? '$'+(v/1e9).toFixed(2)+'B' : v >= 1e6 ? '$'+(v/1e6).toFixed(1)+'M' : '$'+Math.round(v/1e3)+'K';
        if (v >= 1e6) return (v/1e6).toFixed(2)+'M';
        if (v >= 1e3) return (v/1e3).toFixed(0)+'K';
        return Math.round(v).toLocaleString();
      };
      const tooltipData = `data-section="${s.id}" data-name="${s.name}" data-pct="${currTxt}" data-baseline="${baseline}%" data-gap="${pillText}" data-prev-pct="${prevTxt}" data-kpi-label="${kpiLabel2.replace(/"/g,"'")}" data-dac-val="${fmtVal2(dacVal2)}" data-total-val="${fmtVal2(totalVal2)}" data-unit="${kpiUnit2}"`;
      return `
        <div class="dumb-row ${!hasCurr ? 'is-na' : ''}" ${tooltipData}>
          <div class="dumb-label">${s.name}</div>
          <div class="dumb-bar">${barInner}</div>
          <div class="dumb-pill ${pillCls}">${pillText}</div>
        </div>
      `;
    }).join('');

    const axisHtml = `
      <div class="dumb-axis">
        <div class="dumb-axis-inner">
          <span class="dumb-axis-tick">0%</span>
          <span class="dumb-axis-tick">25%</span>
          <span class="dumb-axis-tick dumb-axis-goal">${baseline}% goal</span>
          <span class="dumb-axis-tick">50%</span>
          <span class="dumb-axis-tick">75%</span>
          <span class="dumb-axis-tick">100%</span>
        </div>
      </div>
    `;

    const subText = hasBaseline
      ? `Each row shows ${prevLabel} → ${year} year-over-year movement per section`
      : `Showing ${year} only · No ${prevLabel} baseline available yet`;

    return `
      <div class="exec-card" data-help="dumbbell">
        <div class="chart-card-head">
          <div>
            <h3>DAC Equity · YoY Movement</h3>
            <p class="chart-sub">${subText}</p>
          </div>
          <div class="chart-head-right">
            <div class="chart-legend">
              <div class="legend-item"><span class="legend-swatch" style="background:#B0BCC9;border-radius:50%;width:11px;height:11px;"></span>${prevLabel}</div>
              <div class="legend-item"><span class="legend-swatch" style="background:var(--dusk);border-radius:50%;width:11px;height:11px;"></span>${year}</div>
              <div class="legend-item"><span class="legend-swatch" style="background:#2873BA;width:2px;"></span>${baseline}% goal</div>
            </div>
          </div>
        </div>
        <div class="chart-body">
          <div class="dumb-body">${rows}</div>
          ${axisHtml}
        </div>
      </div>
    `;
  }

  // ── Radar chart ──
  function renderRadar(baseline, year) {
    const N = SECTIONS.length;
    const cx = 230, cy = 195, R = 130;
    const max = 0.7;

    const ptsCurr = SECTIONS.map((s, i) => {
      const angle = (Math.PI * 2 * i / N) - Math.PI / 2;
      const v = year === '2023' ? (s.pct2023 || 0) : s.pct2024;
      const r = (v / max) * R;
      return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
    });
    const ptsBench = SECTIONS.map((s, i) => {
      const angle = (Math.PI * 2 * i / N) - Math.PI / 2;
      const r = (baseline / 100 / max) * R;
      return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
    });
    const pathFromPoints = pts =>
      'M ' + pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' L ') + ' Z';
    const gridCircles = [10, 20, 30, 40, 50, 60, 70].map(p => {
      const r = (p / 100 / max) * R;
      return `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(1)}" fill="none" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 3"/>`;
    }).join('');
    const axes = SECTIONS.map((s, i) => {
      const angle  = (Math.PI * 2 * i / N) - Math.PI / 2;
      const lineX  = cx + Math.cos(angle) * R;
      const lineY  = cy + Math.sin(angle) * R;
      const labelX = cx + Math.cos(angle) * (R + 22);
      const labelY = cy + Math.sin(angle) * (R + 22);
      let anchor = 'middle';
      if (Math.cos(angle) > 0.3) anchor = 'start';
      else if (Math.cos(angle) < -0.3) anchor = 'end';
      return `
        <line x1="${cx}" y1="${cy}" x2="${lineX.toFixed(1)}" y2="${lineY.toFixed(1)}" stroke="var(--line)" stroke-width="0.5"/>
        <text x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle"
              font-size="11" font-weight="600" fill="var(--text-2)">${s.radarName}</text>
      `;
    }).join('');
    const dots = ptsCurr.map((p, i) => {
      const s = SECTIONS[i];
      const v   = year === '2023' ? s.pct2023 : s.pct2024;
      const has = year === '2023' ? (s.pct2023 != null) : s.hasData;
      const pctText = has ? (v * 100).toFixed(1) + '%' : '—';
      const rPayload  = PAYLOAD.kpis.find(k => k.section === s.id);
      const rDacVal   = (rPayload && rPayload['y' + year]) ? rPayload['y' + year].dac   : null;
      const rTotalVal = (rPayload && rPayload['y' + year]) ? rPayload['y' + year].total : null;
      const rLabel    = rPayload ? rPayload.label : '';
      const rUnit     = rPayload ? rPayload.unit  : '';
      const rFmt      = rPayload ? rPayload.format : 'int';
      const fmtR = v => {
        if (v == null) return 'n/a';
        if (rFmt === 'currency') return v >= 1e9 ? '$'+(v/1e9).toFixed(2)+'B' : v >= 1e6 ? '$'+(v/1e6).toFixed(1)+'M' : '$'+Math.round(v/1e3)+'K';
        if (v >= 1e6) return (v/1e6).toFixed(2)+'M';
        if (v >= 1e3) return (v/1e3).toFixed(0)+'K';
        return Math.round(v).toLocaleString();
      };
      return `<circle class="radar-dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4" fill="var(--dusk)" stroke="white" stroke-width="1.5" data-section="${s.id}" data-name="${s.name}" data-pct="${pctText}" data-baseline="${baseline}%" data-kpi-label="${rLabel.replace(/"/g,"'")}" data-dac-val="${fmtR(rDacVal)}" data-total-val="${fmtR(rTotalVal)}" data-unit="${rUnit}"/>`;
    }).join('');
    const scaleLabels = [10, 30, 50, 70].map(p => {
      const r = (p / 100 / max) * R;
      return `<text x="${cx + 3}" y="${cy - r + 3}" font-size="9" fill="var(--text-3)" font-family="Inter">${p}%</text>`;
    }).join('');

    return `
      <div class="exec-card" data-help="radar">
        <div class="chart-card-head">
          <div>
            <h3>Equity Radar · 360° Profile</h3>
            <p class="chart-sub">Each axis = one section · Dashed line = ${baseline}% goal · ${year}</p>
          </div>
          <div class="chart-legend">
            <div class="legend-item"><span class="legend-swatch" style="background:var(--dusk)"></span>${year}</div>
            <div class="legend-item"><span class="legend-swatch" style="background:var(--mauve-shadow);width:8px;height:2px;"></span>${baseline}% goal</div>
          </div>
        </div>
        <div class="chart-body">
          <div class="radar-body">
            <svg viewBox="0 0 460 390" class="radar-svg">
              ${gridCircles}${axes}${scaleLabels}
              <path d="${pathFromPoints(ptsBench)}" fill="none" stroke="var(--mauve-shadow)" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.7"/>
              <path d="${pathFromPoints(ptsCurr)}" fill="var(--dusk)" fill-opacity="0.18" stroke="var(--dusk)" stroke-width="2"/>
              ${dots}
            </svg>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================================================
  // INVESTMENT TREND BLOCK
  // Hardcoded verified actuals · floor $0 on projections · hover tooltips
  // ==========================================================================

  var TREND_MODE_KEY = 'coned_dac_trend_mode';
  function getTrendMode() {
    var v = localStorage.getItem(TREND_MODE_KEY);
    return (v === 'total' || v === 'A' || v === 'B' || v === 'E') ? v : 'total';
  }
  function setTrendMode(m) { localStorage.setItem(TREND_MODE_KEY, m); }

  // Hardcoded verified actuals — source: Con Edison DAC Reports 2023 & 2024
  // TODO: replace TREND_DATA with Dataverse endpoint
  // Endpoint pattern: GET /dataverse/investment-trend?sections=A,B,E&years=2023,2024
  // Fields per section/year: dac, nondac totals
  // Projections (2025, 2026) calculated client-side as linear extrapolation
  var TREND_DATA = {
    total: {
      dac23: 659172170,    nondac23: 934207389,
      dac24: 711363338,    nondac24: 688293853,
      dacPct23: 41.4,      nondacPct23: 58.6,
      dacPct24: 50.8,      nondacPct24: 49.2,
      total23: 1593379559, total24: 1399657191,
      label: 'A + B + E'
    },
    A: {
      dac23: 129680235,   nondac23: 132844686,
      dac24: 204785586,   nondac24: 175480128,
      dacPct23: 49.4,     nondacPct23: 50.6,
      dacPct24: 53.9,     nondacPct24: 46.1,
      total23: 262524921,  total24: 380265714,
      label: 'Section A · Clean Energy'
    },
    B: {
      dac23: 10190735,    nondac23: 22410903,
      dac24: 18281828,    nondac24: 24517801,
      dacPct23: 31.3,     nondacPct23: 68.7,
      dacPct24: 42.7,     nondacPct24: 57.3,
      total23: 32601638,   total24: 42799629,
      label: 'Section B · EV Make-Ready'
    },
    E: {
      dac23: 519301200,   nondac23: 778951800,
      dac24: 488295924,   nondac24: 488295924,
      dacPct23: 40.0,     nondacPct23: 60.0,
      dacPct24: 50.0,     nondacPct24: 50.0,
      total23: 1298253000, total24: 976591848,
      label: 'Section E · Strategic Capital'
    }
  };

  function renderInlineToggle() {
    var mode  = getTrendMode();
    var modes = [
      { id: 'total', label: 'A+B+E' },
      { id: 'A',     label: 'A' },
      { id: 'B',     label: 'B' },
      { id: 'E',     label: 'E' }
    ];
    var btns = modes.map(function(m) {
      var active = m.id === mode ? ' active' : '';
      return '<button class="trend-inline-btn' + active + '" data-trend-mode="' + m.id + '">' + m.label + '</button>';
    }).join('');
    return '<div class="trend-inline-toggle" role="tablist">' + btns + '</div>';
  }

  function renderInvestmentTrend() {
    var mode = getTrendMode();
    var d    = TREND_DATA[mode];

    // Linear projection — floor at $0
    var dacDelta    = d.dac24    - d.dac23;
    var nondacDelta = d.nondac24 - d.nondac23;
    var dacProj25    = Math.max(0, d.dac24    + dacDelta);
    var nondacProj25 = Math.max(0, d.nondac24 + nondacDelta);
    var dacProj26    = Math.max(0, dacProj25    + dacDelta);
    var nondacProj26 = Math.max(0, nondacProj25 + nondacDelta);

    var total25  = dacProj25 + nondacProj25;
    var total26  = dacProj26 + nondacProj26;
    var dacPct25 = total25 > 0 ? (dacProj25 / total25 * 100).toFixed(1) : '—';
    var dacPct26 = total26 > 0 ? (dacProj26 / total26 * 100).toFixed(1) : '—';

    var W = 600, H = 80;
    var padL = 42, padR = 16, padT = 6, padB = 14;
    var innerW = W - padL - padR;
    var innerH = H - padT - padB;

    var dacVals    = [d.dac23,    d.dac24,    dacProj25,    dacProj26];
    var nonDacVals = [d.nondac23, d.nondac24, nondacProj25, nondacProj26];
    var years      = [2023, 2024, 2025, 2026];

    // Tooltip data per dot
    var dacTips = [
      { yr: 2023, val: d.dac23,   pct: d.dacPct23,           proj: false },
      { yr: 2024, val: d.dac24,   pct: d.dacPct24,           proj: false },
      { yr: 2025, val: dacProj25, pct: parseFloat(dacPct25), proj: true  },
      { yr: 2026, val: dacProj26, pct: parseFloat(dacPct26), proj: true  }
    ];
    var nondacTips = [
      { yr: 2023, val: d.nondac23,    pct: d.nondacPct23,                                               proj: false },
      { yr: 2024, val: d.nondac24,    pct: d.nondacPct24,                                               proj: false },
      { yr: 2025, val: nondacProj25,  pct: total25 > 0 ? (100 - parseFloat(dacPct25)).toFixed(1) : '—', proj: true  },
      { yr: 2026, val: nondacProj26,  pct: total26 > 0 ? (100 - parseFloat(dacPct26)).toFixed(1) : '—', proj: true  }
    ];

    var allVals = dacVals.concat(nonDacVals).filter(function(v) { return v > 0; });
    var rawMax  = Math.max.apply(null, allVals);
    var niceMax = Math.ceil(rawMax / 100e6) * 100e6;
    if (niceMax <= 0) niceMax = 1e9;

    var xFor = function(i) { return padL + (i / (years.length - 1)) * innerW; };
    var yFor = function(v) { return padT + innerH - (v / niceMax) * innerH; };

    var fmt = function(v) {
      if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
      if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M';
      return '$' + Math.round(v / 1e3) + 'K';
    };

    // Grid + Y labels
    var grid = '';
    for (var gi = 0; gi <= 3; gi++) {
      var gv = (gi / 5) * niceMax;
      var gy = yFor(gv);
      grid += '<line x1="' + padL + '" y1="' + gy.toFixed(1)
            + '" x2="' + (W - padR) + '" y2="' + gy.toFixed(1)
            + '" stroke="var(--line)" stroke-width="0.5" stroke-dasharray="2 3"/>';
      grid += '<text x="' + (padL - 3) + '" y="' + (gy + 2).toFixed(1)
            + '" font-size="6" fill="var(--text-3)" text-anchor="end" font-family="Inter">'
            + fmt(gv) + '</text>';
    }

    // X labels
    var xlabels = '';
    years.forEach(function(yr, i) {
      var x      = xFor(i);
      var isProj = yr >= 2025;
      xlabels += '<text x="' + x.toFixed(1) + '" y="' + (H - 3)
               + '" font-size="6" font-weight="' + (isProj ? 500 : 700) + '"'
               + ' fill="' + (isProj ? 'var(--text-4)' : 'var(--text-2)') + '"'
               + ' text-anchor="middle" font-family="Inter">'
               + yr + (isProj ? ' ·p' : '') + '</text>';
    });

    // Shaded projection zone
    var projStartX   = xFor(1);
    var projEndX     = xFor(3);
    var shadedRegion = '<rect x="' + projStartX.toFixed(1) + '" y="' + padT
                     + '" width="' + (projEndX - projStartX).toFixed(1)
                     + '" height="' + innerH + '" fill="rgba(3,24,36,0.03)"/>';
    var projLabelX   = ((xFor(2) + xFor(3)) / 2).toFixed(1);
    var projLabel    = '<text x="' + projLabelX + '" y="' + (padT + 5)
                     + '" font-size="6" font-weight="700" fill="var(--text-4)"'
                     + ' text-anchor="middle" letter-spacing="0.06em" font-family="Inter">PROJ.</text>';

    // Path helper
    var buildPath = function(vals, s, e) {
      var p = '';
      for (var pi = s; pi <= e; pi++) {
        p += (pi === s ? 'M ' : ' L ') + xFor(pi).toFixed(1) + ',' + yFor(vals[pi]).toFixed(1);
      }
      return p;
    };

    var dacColor    = 'var(--dusk)';
    var nondacColor = 'var(--mauve-shadow)';

    // Value labels
    var valLabels = '';
    dacVals.forEach(function(v, i) {
      if (v <= 0) return;
      var isProj = i >= 2;
      var anchor = (i === 2) ? 'end' : 'middle';
      var xOff   = (i === 2) ? -6 : 0;
      valLabels += '<text x="' + (xFor(i) + xOff).toFixed(1) + '" y="' + (yFor(v) - 2).toFixed(1)
                + '" font-size="6" font-weight="700" fill="' + dacColor + '"'
                + ' text-anchor="' + anchor + '" font-family="Inter"'
                + (isProj ? ' opacity="0.65"' : '') + '>' + fmt(v) + '</text>';
    });
    nonDacVals.forEach(function(v, i) {
      if (v <= 0) return;
      var isProj = i >= 2;
      var anchor = (i === 2) ? 'end' : 'middle';
      var xOff   = (i === 2) ? -6 : 0;
      valLabels += '<text x="' + (xFor(i) + xOff).toFixed(1) + '" y="' + (yFor(v) + 5).toFixed(1)
                + '" font-size="6" font-weight="700" fill="' + nondacColor + '"'
                + ' text-anchor="' + anchor + '" font-family="Inter"'
                + (isProj ? ' opacity="0.65"' : '') + '>' + fmt(v) + '</text>';
    });

    // Dots with tooltip attributes
    var dotsHtml = '';
    dacVals.forEach(function(v, i) {
      if (v <= 0) return;
      var tip    = dacTips[i];
      var isProj = i >= 2;
      dotsHtml += '<circle class="trend-dot" cx="' + xFor(i).toFixed(1) + '" cy="' + yFor(v).toFixed(1)
               + '" r="' + (isProj ? 2.5 : 3) + '"'
               + ' fill="' + (isProj ? 'var(--white)' : dacColor) + '"'
               + ' stroke="' + dacColor + '" stroke-width="' + (isProj ? 1.5 : 1) + '"'
               + ' data-seg="DAC" data-yr="' + tip.yr + '" data-val="' + fmt(tip.val) + '"'
               + ' data-pct="' + (isNaN(tip.pct) ? '—' : tip.pct + '%') + '"'
               + ' data-proj="' + tip.proj + '"/>';
    });
    nonDacVals.forEach(function(v, i) {
      if (v <= 0) return;
      var tip    = nondacTips[i];
      var isProj = i >= 2;
      var nPct   = isNaN(parseFloat(tip.pct)) ? '—' : tip.pct + '%';
      dotsHtml += '<circle class="trend-dot" cx="' + xFor(i).toFixed(1) + '" cy="' + yFor(v).toFixed(1)
               + '" r="' + (isProj ? 2.5 : 3) + '"'
               + ' fill="' + (isProj ? 'var(--white)' : nondacColor) + '"'
               + ' stroke="' + nondacColor + '" stroke-width="' + (isProj ? 1.5 : 1) + '"'
               + ' data-seg="Non-DAC" data-yr="' + tip.yr + '" data-val="' + fmt(tip.val) + '"'
               + ' data-pct="' + nPct + '"'
               + ' data-proj="' + tip.proj + '"/>';
    });

    // YoY meta
    var dacGrowthNum    = (d.dac24    - d.dac23)    / d.dac23    * 100;
    var nondacGrowthNum = (d.nondac24 - d.nondac23) / d.nondac23 * 100;

    var metaRow = function(color, label, num) {
      var gcolor = num >= 0 ? 'var(--green)' : 'var(--red)';
      var gval   = (num >= 0 ? '+' : '') + num.toFixed(1) + '%';
      return '<div class="trend-meta-row">'
        + '<span class="trend-meta-dot" style="background:' + color + ';"></span>'
        + '<span class="trend-meta-label">' + label + '</span>'
        + '<span class="trend-meta-val" style="color:' + gcolor + ';">' + gval + '</span>'
        + '</div>';
    };

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="trend-svg" preserveAspectRatio="xMidYMid meet">'
      + grid + shadedRegion + projLabel
      + '<path d="' + buildPath(nonDacVals, 0, 1) + '" fill="none" stroke="' + nondacColor + '" stroke-width="2.5"/>'
      + '<path d="' + buildPath(nonDacVals, 1, 3) + '" fill="none" stroke="' + nondacColor + '" stroke-width="2" stroke-dasharray="6 4" opacity="0.65"/>'
      + '<path d="' + buildPath(dacVals, 0, 1) + '" fill="none" stroke="' + dacColor + '" stroke-width="2.5"/>'
      + '<path d="' + buildPath(dacVals, 1, 3) + '" fill="none" stroke="' + dacColor + '" stroke-width="2" stroke-dasharray="6 4" opacity="0.65"/>'
      + dotsHtml + valLabels + xlabels
      + '</svg>';

    return '<div class="exec-card exec-trend-card" data-help="trend-line">'
      + '<div class="chart-card-head">'
        + '<div>'
          + '<h3>Investment Trend · DAC vs Non-DAC</h3>'
          + '<p class="chart-sub">' + d.label + ' · Solid = actuals · Dashed = linear projection (floor $0)</p>'
        + '</div>'
        + '<div class="chart-head-right">'
          + '<div class="chart-legend">'
            + '<div class="legend-item"><span class="legend-swatch" style="background:' + dacColor + '"></span>DAC</div>'
            + '<div class="legend-item"><span class="legend-swatch" style="background:' + nondacColor + '"></span>Non-DAC</div>'
            + '<div class="legend-item"><span class="legend-swatch" style="background:transparent;border:1px dashed var(--text-3);width:12px;height:1px;margin-top:4px;"></span>Projected</div>'
          + '</div>'
          + renderInlineToggle()
        + '</div>'
      + '</div>'
      + '<div class="chart-body">'
        + '<div class="trend-svg-wrap">' + svg + '</div>'
        + '<div class="trend-meta">'
          + metaRow(dacColor,    'DAC YoY 2023→2024',     dacGrowthNum)
          + metaRow(nondacColor, 'Non-DAC YoY 2023→2024', nondacGrowthNum)
        + '</div>'
        + '<div class="quadrant-help-trigger">'
          + '<button class="help-btn help-btn-icon-only" data-help-modal="trend-line" type="button" aria-label="How to read">'
            + '<span class="help-icon">?</span>'
          + '</button>'
        + '</div>'
      + '</div>'
    + '</div>';
  }

  function renderTrendAnalysis() {
    var trendsGrid = document.getElementById('exec-trends-grid');
    if (!trendsGrid) return;
    // Match the exact 3-col grid of exec-shares-grid above
    trendsGrid.style.display = 'grid';
    trendsGrid.style.gridTemplateColumns = '1fr';
    trendsGrid.style.gap = '12px';
    // Full width — same total width as the 3-col grid above
    trendsGrid.innerHTML = renderInvestmentTrend();

    // Wire inline toggle
    trendsGrid.querySelectorAll('.trend-inline-btn[data-trend-mode]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var newMode = btn.getAttribute('data-trend-mode');
        if (newMode !== getTrendMode()) {
          setTrendMode(newMode);
          renderTrendAnalysis();
        }
      });
    });

    // Wire dot tooltips
    var tip = document.querySelector('.exec-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'exec-tooltip';
      document.body.appendChild(tip);
    }
    trendsGrid.querySelectorAll('.trend-dot').forEach(function(dot) {
      dot.style.cursor = 'default';
      dot.addEventListener('mouseenter', function() {
        var seg  = dot.getAttribute('data-seg');
        var yr   = dot.getAttribute('data-yr');
        var val  = dot.getAttribute('data-val');
        var pct  = dot.getAttribute('data-pct');
        var proj = dot.getAttribute('data-proj') === 'true';
        var mode = getTrendMode();
        var d    = TREND_DATA[mode];

        var html = '<div class="tt-name">' + seg + ' · ' + yr
                 + (proj ? ' <span style="font-weight:500;color:var(--text-3);font-size:10px;">projected</span>' : '')
                 + '</div>';
        html += '<div class="tt-row" style="color:var(--text-3);font-size:9.5px;margin-bottom:4px"><span>Scope: ' + d.label + '</span></div>';
        html += '<div class="tt-row"><span>Investment ($)</span><span class="v">' + val + '</span></div>';
        html += '<div class="tt-row"><span>' + seg + ' share of total</span><span class="v">' + pct + '</span></div>';
        if (!proj) {
          html += '<div class="tt-row"><span>Source</span><span class="v">Filed DAC report ' + yr + '</span></div>';
        } else {
          html += '<div class="tt-row"><span>Method</span><span class="v">Linear projection</span></div>';
          html += '<div class="tt-row" style="margin-top:6px;padding-top:6px;border-top:1px solid var(--line)">' +
                  '<span style="font-size:9.5px;color:var(--text-3);line-height:1.4">Linear extrapolation from 2023 → 2024 trend, floored at $0. Not a forecast — illustrative only.</span>' +
                  '</div>';
        }
        tip.innerHTML = html;
        tip.style.opacity = '1';
      });
      dot.addEventListener('mousemove', function(e) {
        tip.style.left = (e.pageX + 14) + 'px';
        tip.style.top  = (e.pageY - 8)  + 'px';
      });
      dot.addEventListener('mouseleave', function() { tip.style.opacity = '0'; });
    });
  }

  // ==========================================================================
  // RENDER BLOCK + WIRING
  // ==========================================================================

  function renderBlock() {
    const toggleMount = document.getElementById('exec-toggle-mount');
    const sharesGrid  = document.getElementById('exec-shares-grid');
    if (!toggleMount || !sharesGrid) return;
    const baseline = getBaseline();
    toggleMount.innerHTML = renderToggleBar();
    if (!sharesGrid.classList.contains('exec-shares-grid')) {
      sharesGrid.classList.add('exec-shares-grid');
    }
    const yr = state.year;
    sharesGrid.innerHTML = `
      ${renderDumbbell(baseline, yr)}
      ${renderStripWithGap(baseline, yr)}
      ${renderRadar(baseline, yr)}
    `;
    renderTrendAnalysis();
    wireToggle();
    wireTooltips();
    wireHelpButtons();
  }

  function wireToggle() {
    document.querySelectorAll('.exec-toggle-bar .rkpi-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const newBase = parseInt(btn.dataset.baseline, 10);
        if (newBase !== getBaseline()) {
          setBaseline(newBase);
          renderBlock();
        }
      });
    });
  }

  function ensureTooltip() {
    let tip = document.querySelector('.exec-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'exec-tooltip';
      document.body.appendChild(tip);
    }
    return tip;
  }

  function wireTooltips() {
    const tip = ensureTooltip();
    const targets = document.querySelectorAll('.strip-row[data-section], .div-row[data-section], .dumb-row[data-section], .radar-dot[data-section]');
    targets.forEach(el => {
      el.addEventListener('mouseenter', () => {
        const id        = el.getAttribute('data-section');
        const name      = el.getAttribute('data-name');
        const pct       = el.getAttribute('data-pct');
        const bl        = el.getAttribute('data-baseline');
        const gap       = el.getAttribute('data-gap');
        const prevPct   = el.getAttribute('data-prev-pct');
        const kpiLabel  = el.getAttribute('data-kpi-label');
        const dacVal    = el.getAttribute('data-dac-val');
        const totalVal  = el.getAttribute('data-total-val');
        const unit      = el.getAttribute('data-unit');

        let html = `<div class="tt-name">Section ${id} · ${name}</div>`;
        if (kpiLabel) {
          html += `<div class="tt-row" style="color:var(--text-3);font-size:9.5px;margin-bottom:4px"><span>Primary KPI: ${kpiLabel}</span></div>`;
        }
        html += `<div class="tt-row"><span>DAC share · ${state.year}</span><span class="v">${pct}</span></div>`;
        if (prevPct && prevPct !== 'n/a') {
          html += `<div class="tt-row"><span>Prior year</span><span class="v">${prevPct}</span></div>`;
        }
        if (dacVal && dacVal !== 'n/a') {
          html += `<div class="tt-row"><span>DAC ${unit ? '(' + unit + ')' : 'value'}</span><span class="v">${dacVal}</span></div>`;
        }
        if (totalVal && totalVal !== 'n/a') {
          html += `<div class="tt-row"><span>Total ${unit ? '(' + unit + ')' : 'value'}</span><span class="v">${totalVal}</span></div>`;
        }
        html += `<div class="tt-row"><span>NY Climate Act goal</span><span class="v">${bl}</span></div>`;
        if (gap && gap !== '—') {
          html += `<div class="tt-row"><span>Gap vs goal</span><span class="v">${gap}</span></div>`;
        }
        html += `<div class="tt-row" style="margin-top:6px;padding-top:6px;border-top:1px solid var(--line)">` +
                `<span style="font-size:9.5px;color:var(--text-3);line-height:1.4">Source: filed DAC report. DAC % = DAC value ÷ total value for the primary metric of Section ${id}.</span>` +
                `</div>`;
        tip.innerHTML = html;
        tip.style.opacity = '1';
      });
      el.addEventListener('mousemove', e => {
        tip.style.left = (e.pageX + 14) + 'px';
        tip.style.top  = (e.pageY - 8)  + 'px';
      });
      el.addEventListener('mouseleave', () => { tip.style.opacity = '0'; });
    });
  }

  let helpDelegationWired = false;
  function wireHelpButtons() {
    if (helpDelegationWired) return;
    helpDelegationWired = true;
    document.addEventListener('click', e => {
      const btn = e.target.closest('.help-btn[data-help-modal]');
      if (!btn) return;
      if (!btn.closest('#exec-shares-block')) return;
      e.preventDefault();
      e.stopPropagation();
      const which    = btn.dataset.helpModal;
      const baseline = getBaseline();
      let title, body;

      if (which === 'strip') {
        title = 'How to read · DAC Equity by Section';
        body  = `
          <div class="exec-help-content">
            <p>Each row represents one of the ten CLCPA reporting sections (A through J). The <strong>dark blue fill</strong> shows the share of that section's primary metric that reached Disadvantaged Communities (DACs) in the selected year. The <strong>light blue remainder</strong> is the Non-DAC share. Together they always sum to 100%.</p>
            <p>The vertical <strong>blue tick mark</strong> shows the <strong>${baseline}% NY Climate Act benchmark</strong>. Bars that extend past the tick are meeting or exceeding the goal; bars that fall short of the tick need attention.</p>
            <p>The <strong>Status column</strong> summarizes each section at a glance — <em>Above</em> (more than 5pp over goal), <em>Near</em> (within ±5pp), or <em>Below</em> (more than 5pp under goal). Section F (Outages) uses <em>OK / Monitor / Critical</em> because a higher DAC share of outages is <em>worse</em>, not better.</p>
            <p>The <strong>Gap column</strong> shows the exact distance in percentage points from the ${baseline}% benchmark — blue numbers are above goal, red numbers are below.</p>
            <p class="exec-help-note">Section I (Jobs) shows N/A because the source report does not break out DAC participation for the Clean Energy Academy hiring data.</p>
          </div>`;
      } else if (which === 'dumbbell') {
        title = 'How to read · DAC Equity · YoY Movement';
        body  = `
          <div class="exec-help-content">
            <p>Each row is one section. The <strong>gray dot</strong> marks the prior year's DAC share; the <strong>blue dot</strong> marks the current year's DAC share. The line connecting them shows the direction and magnitude of the year-over-year change — a line moving right means the DAC share grew, a line moving left means it shrank.</p>
            <p>The vertical <strong>blue tick</strong> marks the <strong>${baseline}% Climate Act benchmark</strong>. Dots to the right of the tick are meeting or exceeding the goal; dots to the left fall short.</p>
            <p>The <strong>pill on the far right</strong> shows the year-over-year change: <span style="color:var(--green);font-weight:700;">↑ green</span> = improving, <span style="color:var(--red);font-weight:700;">↓ red</span> = declining, <span style="font-weight:700;">→ gray</span> = stable (within ±0.5pp).</p>
            <p class="exec-help-note">Section F (Outages) is inverted — ↓ shows green because a smaller DAC share of outages is better. Section I (Jobs) is N/A because no DAC breakdown is available.</p>
          </div>`;
      } else if (which === 'radar') {
        title = 'How to read · Equity Radar · 360° Profile';
        body  = `
          <div class="exec-help-content">
            <p>The radar chart gives a simultaneous view of DAC equity across all ten sections. Each of the ten axes radiating from the center represents one reporting section (labeled at the tip). The distance from the center to a data point on each axis equals that section's DAC share — the outermost ring represents <strong>70%</strong>.</p>
            <p>The <strong>solid blue polygon</strong> traces actual performance for the selected year. The <strong>dashed inner polygon</strong> marks the <strong>${baseline}% Climate Act benchmark</strong> on every axis at once. Wherever the blue polygon extends beyond the dashed line, that section is meeting or exceeding the benchmark; wherever it falls inside, it is below.</p>
            <p>A <strong>balanced, regular shape</strong> means equity is consistent across all sections. A <strong>spike</strong> on one axis means that section significantly over-performs relative to the others; a <strong>dent</strong> means it under-performs.</p>
            <p class="exec-help-note">Section I (Jobs) is plotted at 0% because no DAC participation breakdown is reported for that section — it does not mean performance is zero.</p>
          </div>`;
      } else if (which === 'trend-line') {
        title = 'How to read · Investment Trend · DAC vs Non-DAC';
        body  = `
          <div class="exec-help-content">
            <p>This chart aggregates investment dollars across three sections: <strong>Section A (Clean Energy Spending)</strong>, <strong>Section B (EV Make-Ready incentives)</strong>, and <strong>Section E (Strategic Capital)</strong>. Use the toggle to view each section individually. The <strong>blue line</strong> tracks DAC dollars; the <strong>mauve line</strong> tracks Non-DAC dollars.</p>
            <p><strong>Solid segments</strong> (2023 and 2024) are actuals from the filed reports. The <strong>dashed 2025–2026 segment</strong> is a linear projection based on the 2023→2024 trend, floored at $0.</p>
            <p>Hover any dot to see the exact investment amount and DAC share for that year. The key equity signal is the <strong>gap between the two lines</strong> — when the blue line grows faster than the mauve, DAC investment is catching up.</p>
            <p class="exec-help-note">Dollar amounts are shown in millions (M) or billions (B). The YoY growth rates below the chart summarize the 2023→2024 change for each group.</p>
          </div>`;
      } else {
        title = 'How to read';
        body  = `<div class="exec-help-content"><p>No additional help available for this chart.</p></div>`;
      }

      const modal = document.createElement('div');
      modal.className = 'help-modal-overlay';
      modal.innerHTML = `
        <div class="help-modal" role="dialog" aria-labelledby="help-modal-title">
          <div class="help-modal-head">
            <h3 id="help-modal-title">${title}</h3>
            <button class="help-modal-close" type="button" aria-label="Close">×</button>
          </div>
          <div class="help-modal-body">${body}</div>
        </div>`;
      document.body.appendChild(modal);
      const close = () => modal.remove();
      modal.addEventListener('click', e => { if (e.target === modal) close(); });
      modal.querySelector('.help-modal-close').addEventListener('click', close);
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
      });
    });
  }

  function init() {
    const yrSel = document.getElementById('year-select');
    if (yrSel) {
      state.year = yrSel.value || '2024';
      yrSel.addEventListener('change', e => {
        state.year = e.target.value;
        renderBlock();
      });
    }
    renderBlock();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();