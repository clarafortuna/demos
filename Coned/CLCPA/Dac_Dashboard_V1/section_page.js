// ==========================================================================
// section_page.js — Universal section page renderer
// Section A row: Programs Ranked by $ + Programs Ranked by MMBtu + Equity Quadrant
// All other sections unchanged.
// ==========================================================================

(function () {
  const D = window.__DASH;
  const PAYLOAD = JSON.parse(document.getElementById('payload').textContent);

  const LETTER = PAYLOAD.letter;
  const SECTION_NAME = PAYLOAD.section_name;
  const BLURB = PAYLOAD.blurb;
  const TABLES = PAYLOAD.tables;
  const REPORTED_KPIS = PAYLOAD.reported_kpis;
  const ANALYTICAL_KPIS = PAYLOAD.analytical_kpis;
  const CHARTS = PAYLOAD.charts;

  let state = { year: '2024', perTableYearView: {}, quadrantMetric: 'dollars' };

  function fillStats() {
    const dl = document.getElementById('section-stats');
    const yrkey = 'y' + state.year;
    const groups = [];

    // Group 1: tables count (always present)
    groups.push([{ label: 'Tables', value: TABLES.length }]);

    // Groups 2..N: each reported KPI with its own DAC share, in its own divider group
    if (REPORTED_KPIS && REPORTED_KPIS.length > 0) {
      REPORTED_KPIS.forEach(k => {
        const v = k[yrkey];
        if (!v) return;
        const group = [];
        // Shorten label: drop "Clean Energy" / "Lifetime" prefixes for compactness
        const shortLabel = k.label
          .replace(/^Clean Energy\s+/i, '')
          .replace(/^Lifetime\s+/i, '');
        group.push({
          label: shortLabel,
          value: D.fmtNum(v.total, k.format) + (k.unit === '$' || k.format === 'currency' ? '' : ' ' + k.unit)
        });
        if (v.dac_pct !== null && v.dac_pct !== undefined) {
          group.push({ label: 'DAC Share', value: (v.dac_pct * 100).toFixed(1) + '%' });
        }
        groups.push(group);
      });
    }

    dl.innerHTML = groups.map((g, i) => {
      const sep = i < groups.length - 1 ? '<span class="section-stats-sep">|</span>' : '';
      return g.map(s => `<div class="section-stat"><dt>${s.label}</dt><dd>${s.value}</dd></div>`).join('') + sep;
    }).join('');
  }

  function renderCharts() {
    const showCurrent = state.year === '2024';
    const yearLabel = state.year;
    const prevYearLabel = state.year === '2024' ? '2023' : '2022';
    const hasPrevData = state.year === '2024';

    if (LETTER === 'A') {
      const a1 = CHARTS[showCurrent ? 'A1_programs_2024' : 'A1_programs_2023'] || [];
      const rankBy = state.rankBy || 'total';
      const sorted = [...a1].sort((p, q) => (rankBy === 'dac' ? q.dac - p.dac : q.total - p.total));
      const top10 = sorted.slice(0, 10).map(p => ({
        name: p.name,
        dac: p.dac,
        nondac: p.total - p.dac,
        total: rankBy === 'dac' ? p.dac : p.total
      }));
      const subLabel = rankBy === 'dac' ? 'Sorted by DAC' : 'Sorted by total';

      const a2Table = TABLES.find(t => t.id === 'A2');
      const a2Raw = a2Table ? (showCurrent ? a2Table.data_2024 : a2Table.data_2023) : [];
      const a2Programs = [];
      a2Raw.forEach(row => {
        if (!row || !row[0]) return;
        const name = String(row[0]).trim();
        if (!name || /total|grand total/i.test(name)) return;
        const total = Number(row[1]);
        const dac = Number(row[2]);
        if (!isFinite(total) || total <= 0) return;
        a2Programs.push({ name: name, total: total, dac: isFinite(dac) ? dac : 0 });
      });
      const a2Sorted = [...a2Programs].sort((p, q) => (rankBy === 'dac' ? q.dac - p.dac : q.total - p.total));
      const a2Top10 = a2Sorted.slice(0, 10).map(p => ({
        name: p.name,
        dac: p.dac,
        nondac: p.total - p.dac,
        total: rankBy === 'dac' ? p.dac : p.total
      }));

      // Parse the FULL A1 table to get ALL programs for the quadrant (not just the 12 in CHARTS)
      const a1Table = TABLES.find(t => t.id === 'A1');
      const a1Raw = a1Table ? (showCurrent ? a1Table.data_2024 : a1Table.data_2023) : [];
      const a1Programs = [];
      a1Raw.forEach(row => {
        if (!row || !row[0]) return;
        const name = String(row[0]).trim();
        if (!name || /total|grand total|program name/i.test(name)) return;
        const total = Number(row[1]);
        const dac = Number(row[2]);
        if (!isFinite(total) || total <= 0) return;
        a1Programs.push({
          name: name,
          total: total,
          dac: isFinite(dac) ? dac : 0,
          dac_pct: total > 0 ? (isFinite(dac) ? dac / total : 0) : 0
        });
      });

      const quadrantMetric = state.quadrantMetric || 'dollars';
      let quadrantItems, quadrantXLabel, quadrantXUnit, quadrantSubLabel;
      if (quadrantMetric === 'mmbtu') {
        quadrantItems = a2Programs.map(p => ({
          name: p.name,
          total: p.total,
          dac: p.dac,
          dac_pct: p.total > 0 ? p.dac / p.total : 0
        }));
        quadrantXLabel = 'Total Energy Savings (MMBtu)';
        quadrantXUnit = 'MMBtu';
        quadrantSubLabel = 'DAC % vs total MMBtu saved';
      } else {
        quadrantItems = a1Programs;
        quadrantXLabel = 'Total Incentive Funding ($)';
        quadrantXUnit = '';
        quadrantSubLabel = 'DAC % vs total $';
      }

      return `
        <div class="chart-row cols-3">
          <div class="chart-card">
            <div class="chart-card-head">
              <div><h3>Programs Ranked by Incentive Spend</h3><p class="chart-sub">${yearLabel} · Top 10 of 30+ programs · ${subLabel}</p></div>
              <div class="chart-head-controls">
                <span class="chart-tag">Section A · DOLLARS</span>
                <div class="rank-toggle">
                  <button data-rank="total" class="${rankBy === 'total' ? 'active' : ''}">Total</button>
                  <button data-rank="dac" class="${rankBy === 'dac' ? 'active' : ''}">DAC</button>
                </div>
              </div>
            </div>
            <div class="chart-body">
              <div class="chart-legend"><div class="legend-item"><span class="legend-swatch" style="background:var(--dusk)"></span>DAC</div><div class="legend-item"><span class="legend-swatch" style="background:var(--pale-sky)"></span>Non-DAC</div></div>
              ${D.stackedBar(top10, {labelW: 160, fmt: D.fmtCompact})}
            </div>
          </div>
          <div class="chart-card">
            <div class="chart-card-head">
              <div><h3>Programs Ranked by Energy Savings</h3><p class="chart-sub">${yearLabel} · Top 10 of 30+ programs · ${subLabel}</p></div>
              <div class="chart-head-controls">
                <span class="chart-tag">Section A · MMBtu</span>
                <div class="rank-toggle">
                  <button data-rank="total" class="${rankBy === 'total' ? 'active' : ''}">Total</button>
                  <button data-rank="dac" class="${rankBy === 'dac' ? 'active' : ''}">DAC</button>
                </div>
              </div>
            </div>
            <div class="chart-body">
              <div class="chart-legend"><div class="legend-item"><span class="legend-swatch" style="background:var(--dusk)"></span>DAC</div><div class="legend-item"><span class="legend-swatch" style="background:var(--pale-sky)"></span>Non-DAC</div></div>
              ${D.stackedBar(a2Top10, {labelW: 160, fmt: v => D.fmtCompact(v) + ' MMBtu'})}
            </div>
          </div>
          <div class="chart-card analytical">
            <div class="chart-card-head">
              <div><h3>Equity Quadrant <span class="title-mode">· ${quadrantMetric === 'mmbtu' ? 'Energy Savings' : 'Incentive Spend'}</span></h3><p class="chart-sub">${quadrantSubLabel} · Hover any dot for details</p></div>
              <div class="chart-head-controls">
                <span class="chart-tag">Section A · QUAD</span>
                <div class="quadrant-metric-toggle">
                  <button data-metric="dollars" class="${quadrantMetric === 'dollars' ? 'active' : ''}">$</button>
                  <button data-metric="mmbtu" class="${quadrantMetric === 'mmbtu' ? 'active' : ''}">MMBtu</button>
                </div>
              </div>
            </div>
            <div class="chart-body">
             ${D.quadrant(quadrantItems, { xLabel: quadrantXLabel, xUnit: quadrantXUnit, dotScale: quadrantMetric === 'mmbtu' ? 0.005 : 0.0007 })}
              <div class="quadrant-help-trigger">
                <button class="help-btn" data-help="quadrant" type="button">
                  <span class="help-icon">?</span> How to read this chart
                </button>
              </div>
            </div>
          </div>
        </div>`;
    }
    if (LETTER === 'B') {
      const cur = showCurrent ? CHARTS.B2_plugs_2024 : CHARTS.B2_plugs_2023;
      const fmtCurrency = v => '$' + v.toLocaleString();
      const fmtCurrencyShort = v => {
        if (v >= 1e9) return '$' + (v/1e9).toFixed(0) + 'B';
        if (v >= 1e6) return '$' + (v/1e6).toFixed(0) + 'M';
        if (v >= 1e3) return '$' + (v/1e3).toFixed(0) + 'K';
        return '$' + v;
      };
      const fmtInt = v => v.toLocaleString();

      // ===== B1: Funding Spent =====
      const b1Table = TABLES.find(t => t.id === 'B1');
      const b1Data = b1Table ? (showCurrent ? b1Table.data_2024 : b1Table.data_2023) : [];
      let dacFunding = 0, nondacFunding = 0, totalFunding = 0;
      b1Data.forEach(row => {
        if (!row || !row[0]) return;
        const label = String(row[0]).toLowerCase();
        const val = Number(row[1]) || Number(row[2]) || 0;
        if (label.includes('dac') && !label.includes('non')) dacFunding = val;
        else if (label.includes('non-dac') || label.includes('non dac')) nondacFunding = val;
        else if (label.includes('total')) totalFunding = val;
      });
      if (totalFunding === 0) totalFunding = dacFunding + nondacFunding;
      if (nondacFunding === 0 && totalFunding > 0) nondacFunding = totalFunding - dacFunding;

      const niceMaxOf = m => {
        if (m <= 0) return 1;
        const pow = Math.pow(10, Math.floor(Math.log10(m)));
        const candidates = [pow, 1.5*pow, 2*pow, 2.5*pow, 3*pow, 4*pow, 5*pow, 7.5*pow, 10*pow];
        for (const c of candidates) { if (c >= m) return c; }
        return 10 * pow;
      };

      const niceMaxFunding = niceMaxOf(Math.max(dacFunding, nondacFunding, totalFunding));

      // 10 vertical gridlines (excluding edges, included via tick=0 and tick=max)
      const gridLines10 = (() => {
        let html = '';
        for (let i = 1; i < 10; i++) {
          html += `<div class="b-grid-line" style="left:${i*10}%;"></div>`;
        }
        return html;
      })();

      const fundingBar = (label, value, fillClass) => {
        const pct = (value / niceMaxFunding) * 100;
        return `
          <div class="b-bar-row">
            <div class="b-bar-label">${label}</div>
            <div class="b-bar-track">
              ${gridLines10}
              <div class="b-bar-fill ${fillClass}" style="width:${pct.toFixed(2)}%;">
                <span class="b-bar-value-inside">${fmtCurrency(value)}</span>
              </div>
            </div>
          </div>`;
      };

      const fundingAxis = (() => {
        let ticks = '';
        for (let i = 0; i <= 10; i++) {
          const v = (niceMaxFunding / 10) * i;
          ticks += `<span class="b-axis-tick">${fmtCurrencyShort(v)}</span>`;
        }
        return `<div class="b-axis-row"><div class="b-axis-spacer"></div><div class="b-axis-ticks">${ticks}</div></div>`;
      })();

      // ===== B2: Charging Plugs Completed =====
      const dacPlugs = cur.DAC || { L2: 0, DCFC: 0, Total: 0 };
      const nondacPlugs = cur['Non-DAC'] || { L2: 0, DCFC: 0, Total: 0 };
      const totalPlugs = cur.Total || { L2: 0, DCFC: 0, Total: 0 };

      const maxAllPlugs = Math.max(
        dacPlugs.L2 || 0, dacPlugs.DCFC || 0,
        nondacPlugs.L2 || 0, nondacPlugs.DCFC || 0,
        totalPlugs.L2 || 0, totalPlugs.DCFC || 0
      );
      const niceMaxPlugs = niceMaxOf(maxAllPlugs);

      // For each value, decide whether label goes inside (white) or outside (dark)
      // Threshold: if bar > 15% of axis, label goes inside
      const renderBar = (value, fillClass) => {
        const pct = (value / niceMaxPlugs) * 100;
        const labelInside = pct > 15;
        if (labelInside) {
          return `<div class="b-bar-fill ${fillClass}" style="width:${pct.toFixed(2)}%;"><span class="b-bar-value-inside">${fmtInt(value)}</span></div>`;
        } else {
          return `<div class="b-bar-fill ${fillClass}" style="width:${pct.toFixed(2)}%;"></div><span class="b-bar-value-outside" style="left:calc(${pct.toFixed(2)}% + 6px);">${fmtInt(value)}</span>`;
        }
      };

      const plugCategory = (label, plugs) => {
        return `
          <div class="b-plug-category">
            <div class="b-plug-label">${label}</div>
            <div class="b-plug-bars">
              <div class="b-bar-track b-bar-track-thin">
                ${gridLines10}
                ${renderBar(plugs.L2 || 0, 'b-fill-l2')}
              </div>
              <div class="b-bar-track b-bar-track-thin">
                ${gridLines10}
                ${renderBar(plugs.DCFC || 0, 'b-fill-dcfc')}
              </div>
            </div>
          </div>`;
      };

      const plugAxis = (() => {
        let ticks = '';
        for (let i = 0; i <= 10; i++) {
          const v = (niceMaxPlugs / 10) * i;
          ticks += `<span class="b-axis-tick">${Math.round(v).toLocaleString()}</span>`;
        }
        return `<div class="b-axis-row"><div class="b-axis-spacer"></div><div class="b-axis-ticks">${ticks}</div></div>`;
      })();

      return `
        <div class="chart-row cols-2">
          <div class="chart-card">
            <div class="chart-card-head">
              <div><h3>Total Make-Ready Incentive Funding Spent</h3></div>
              <span class="chart-tag">Section B · B1</span>
            </div>
            <div class="chart-body">
              ${fundingBar('DAC', dacFunding, 'b-fill-dac')}
              ${fundingBar('Non-DAC', nondacFunding, 'b-fill-nondac')}
              ${fundingBar('Total', totalFunding, 'b-fill-total')}
              ${fundingAxis}
            </div>
          </div>
          <div class="chart-card">
            <div class="chart-card-head">
              <div><h3>Charging Plugs Completed Under the Make-Ready Program</h3></div>
              <span class="chart-tag">Section B · B2</span>
            </div>
            <div class="chart-body">
              ${plugCategory('DAC Plugs', dacPlugs)}
              ${plugCategory('Non-DAC Plugs', nondacPlugs)}
              ${plugCategory('Total Program Plugs', totalPlugs)}
              ${plugAxis}
              <div class="b-plug-legend">
                <div class="legend-item"><span class="legend-swatch" style="background:#2F5496"></span>L2</div>
                <div class="legend-item"><span class="legend-swatch" style="background:#BDDBF5"></span>DCFC</div>
              </div>
            </div>
          </div>
        </div>`;
    }
      
    
    if (LETTER === 'C') {
      // ===== Source data =====
      const c5 = CHARTS[showCurrent ? 'C5_programs_2024' : 'C5_programs_2023'] || [];
      const c3 = CHARTS[showCurrent ? 'C3_programs_2024' : 'C3_programs_2023'] || [];

      // Parse C4 from TABLES (it's not in CHARTS)
      const c4Table = TABLES.find(t => t.id === 'C4');
      const c4Raw = c4Table ? (showCurrent ? c4Table.data_2024 : c4Table.data_2023) : [];
      const c4 = [];
      c4Raw.forEach(row => {
        if (!row || !row[0]) return;
        const name = String(row[0]).trim();
        if (!name || /program name|^total$/i.test(name)) return;
        const nums = row.slice(1).filter(v => v !== null && v !== undefined && v !== '');
        if (nums.length < 3) return;
        c4.push({
          name: name,
          participants: Number(nums[0]) || 0,
          committed: Number(nums[1]) || 0,
          delivered: Number(nums[2]) || 0
        });
      });

      // ===== C2 Equity Snapshot — segment totals =====
      // Sum across all 5 programs to get DAC, LI, Total per metric
      const sum = (arr, key) => arr.reduce((a, x) => a + (Number(x[key]) || 0), 0);
      const dacTotals = {
        participants: sum(c3, 'participants'),
        committed:    sum(c3, 'committed'),
        delivered:    sum(c3, 'delivered')
      };
      const liTotals = {
        participants: sum(c4, 'participants'),
        committed:    sum(c4, 'committed'),
        delivered:    sum(c4, 'delivered')
      };
      const totalTotals = {
        participants: sum(c5, 'participants'),
        committed:    sum(c5, 'committed'),
        delivered:    sum(c5, 'delivered')
      };

      const fmtInt = v => v.toLocaleString();
      const fmtMW = v => (v < 10 ? v.toFixed(2) : v.toFixed(1));
      const pctOf = (part, total) => total > 0 ? (part / total * 100).toFixed(0) + '%' : '—';

      const equityCard = (label, data, totalRef, segCls) => `
        <div class="c2-card c2-${segCls}">
          <div class="c2-card-top">
            <div class="c2-card-label">${label}</div>
            <div class="c2-card-num-wrap">
              <div class="c2-card-num">${fmtInt(data.participants)}</div>
              <div class="c2-card-pct">${segCls === 'total' ? 'all customers' : pctOf(data.participants, totalRef.participants) + ' of part.'}</div>
            </div>
          </div>
          <div class="c2-card-row"><span>Committed:</span><span>${fmtMW(data.committed)} MW${segCls !== 'total' ? ' (' + pctOf(data.committed, totalRef.committed) + ')' : ''}</span></div>
          <div class="c2-card-row"><span>Delivered:</span><span>${fmtMW(data.delivered)} MW${segCls !== 'total' ? ' (' + pctOf(data.delivered, totalRef.delivered) + ')' : ''}</span></div>
        </div>`;

      // ===== Card YoY: Participants comparison =====
      const cPrev = hasPrevData ? (CHARTS.C5_programs_2023 || []) : null;
      const partRows = cPrev ? c5.map(p => {
        const prev = cPrev.find(x => x.name === p.name);
        return { name: p.name, curr: p.participants, prev: prev ? prev.participants : null };
      }) : null;

      // ===== Card Performance Ratio =====
      const programs = c5.map(p => {
        const dac = c3.find(x => x.name === p.name) || { committed: 0, delivered: 0 };
        const li = c4.find(x => x.name === p.name) || { committed: 0, delivered: 0 };
        return {
          name: p.name,
          dac: { committed: dac.committed, delivered: dac.delivered },
          li:  { committed: li.committed,  delivered: li.delivered  },
          total: { committed: p.committed, delivered: p.delivered }
        };
      });

      const ratioCell = (committed, delivered) => {
        const fmt = v => (v < 10 ? v.toFixed(2) : v.toFixed(1));
        if (committed == null) {
          return `<td class="cell-num"><span class="cell-empty">—</span></td>
                  <td class="cell-num"><span class="cell-empty">—</span></td>
                  <td class="perf-cell-pct"><span class="cell-empty">—</span></td>`;
        }
        if (committed === 0) {
          return `<td class="cell-num">0</td>
                  <td class="cell-num">${delivered === 0 ? '0' : fmt(delivered)}</td>
                  <td class="perf-cell-pct"><span class="cell-empty">—</span></td>`;
        }
        const ratio = (delivered / committed) * 100;
        let cls;
        if (ratio < 50)        cls = 'bad';
        else if (ratio < 100)  cls = 'under';
        else if (ratio <= 150) cls = 'over';
        else                   cls = 'excellent';
        return `<td class="cell-num">${fmt(committed)}</td>
                <td class="cell-num">${fmt(delivered)}</td>
                <td class="perf-cell-pct"><span class="perf-pill perf-${cls}">${ratio.toFixed(1)}%</span></td>`;
      };

      const perfRows = programs.map(p => `
        <tr>
          <td class="program-name">${p.name}</td>
          ${ratioCell(p.dac.committed, p.dac.delivered)}
          ${ratioCell(p.li.committed, p.li.delivered)}
          ${ratioCell(p.total.committed, p.total.delivered)}
        </tr>
      `).join('');

      const perfTable = `
        <table class="perf-table">
          <thead>
            <tr class="group-row">
              <th class="program-th">Program</th>
              <th colspan="3">DAC</th>
              <th colspan="3" class="total-group">Low-Income</th>
              <th colspan="3" class="total-group">Total</th>
            </tr>
            <tr class="detail-row">
              <th></th>
              <th>Comm.</th><th>Deliv.</th><th>Ratio</th>
              <th>Comm.</th><th>Deliv.</th><th>Ratio</th>
              <th>Comm.</th><th>Deliv.</th><th>Ratio</th>
            </tr>
          </thead>
          <tbody>${perfRows}</tbody>
        </table>
        <div class="perf-legend">
          <span class="perf-pill perf-bad">&lt; 50%</span> Critical
          <span class="perf-pill perf-under">50-99%</span> Under
          <span class="perf-pill perf-over">100-150%</span> Over
          <span class="perf-pill perf-excellent">&gt; 150%</span> Excellent
        </div>`;

      return `
        <div class="chart-row cols-1-2">
          <div class="c-left-stack">
            <div class="chart-card">
              <div class="chart-card-head">
                <div><h3>Equity Snapshot · Customer Segments</h3></div>
                <span class="chart-tag">Section C · C2</span>
              </div>
              <div class="chart-body">
                <div class="c2-grid c2-grid-row">
                  ${equityCard('DAC', dacTotals, totalTotals, 'dac')}
                  ${equityCard('Low-Income', liTotals, totalTotals, 'li')}
                  ${equityCard('Total', totalTotals, totalTotals, 'total')}
                </div>
              </div>
            </div>
            <div class="chart-card">
              <div class="chart-card-head"><div><h3>DR Programs · Total Participants YoY</h3></div><span class="chart-tag">Section C · YOY C5</span></div>
              <div class="chart-body">
                ${partRows ? `
                  <div class="chart-legend"><div class="legend-item"><span class="legend-swatch" style="background:var(--dusk)"></span>${yearLabel}</div><div class="legend-item"><span class="legend-swatch" style="background:var(--mauve-light)"></span>${prevYearLabel}</div></div>
                  ${D.compareRows(partRows, { labelW: 80, fmt: D.fmtCompact, yearLabel, prevLabel: prevYearLabel })}
                ` : `<div class="empty-pane">No data available for this view.</div>`}
              </div>
            </div>
          </div>
          <div class="chart-card">
            <div class="chart-card-head">
              <div>
                <h3>Performance Ratio · Delivered vs Committed Load Relief (MW)</h3>
                <p class="chart-sub">Each cell shows delivery efficiency · Bar caps at 100%</p>
              </div>
              <span class="chart-tag">Section C · PERF C3 C4 C5</span>
            </div>
            <div class="chart-body">
              ${perfTable}
            </div>
          </div>
        </div>`;
    }
    if (LETTER === 'D') {
      const d = showCurrent ? CHARTS.D2_2024 : CHARTS.D2_2023;
      const fmtInt = v => v.toLocaleString();
      const pctOf = (part, total) => total > 0 ? (part / total * 100).toFixed(1) + '%' : '—';

      const tiles = [
        {
          segCls: 'dac',
          label: 'Total Projects',
          value: d.projects_total ? fmtInt(d.projects_total) : '—',
          sub: 'Cumulative through ' + yearLabel
        },
        {
          segCls: 'dac',
          label: 'DAC Projects',
          value: d.projects_dac ? fmtInt(d.projects_dac) : '—',
          sub: d.projects_total ? `${pctOf(d.projects_dac, d.projects_total)} of total` : ''
        },
        {
          segCls: 'li',
          label: 'Total MW',
          value: d.mw_total ? d.mw_total.toFixed(1) : '—',
          sub: 'All DERs combined'
        },
        {
          segCls: 'li',
          label: 'DAC MW',
          value: d.mw_dac ? d.mw_dac.toFixed(1) : '—',
          sub: d.mw_total ? `${pctOf(d.mw_dac, d.mw_total)} of capacity` : ''
        }
      ];

      return `
        <div class="chart-row cols-1">
          <div class="chart-card">
            <div class="chart-card-head"><div><h3>DER Snapshot · Cumulative through ${yearLabel}</h3><p class="chart-sub">Section D · Distribution-interconnected projects (CDG + RC + NM)</p></div><span class="chart-tag">Section D · CUMULATIVE</span></div>
            <div class="chart-body">
              <div class="c2-grid c2-grid-row">
                ${tiles.map(t => `
                  <div class="c2-card c2-${t.segCls}">
                    <div class="c2-card-label">${t.label}</div>
                    <div class="c2-card-num">${t.value}</div>
                    <div class="c2-card-pct">${t.sub}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>`;
    }
    if (LETTER === 'E') {
      const e2024 = CHARTS.E1_categories_2024 || [];
      const e2023 = CHARTS.E1_categories_2023 || [];

      // Normalize category names (2023 has "Safety and Security", 2024 "Safety And Security")
      const normalize = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
      const findPrev = (name) => e2023.find(x => normalize(x.name) === normalize(name));

      // Sort by current year total descending
      const sorted = [...e2024].sort((a, b) => b.total - a.total);
      const maxTotal = Math.max(...sorted.map(c => c.total), ...e2023.map(c => c.total));

      const fmtMoney = v => {
        if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
        if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
        if (v >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K';
        return '$' + v.toLocaleString();
      };

      // ====== YoY card (Idea 2) ======
      const yoyRows = sorted.map(c => {
        const prev = findPrev(c.name);
        const curr = c.total;
        const prevVal = prev ? prev.total : 0;
        const delta = prevVal > 0 ? ((curr - prevVal) / prevVal) * 100 : 0;
        const dCls = delta >= 0 ? 'up' : 'down';
        const arrow = delta >= 0 ? '↑' : '↓';
        const currPct = (curr / maxTotal) * 100;
        const prevPct = (prevVal / maxTotal) * 100;
        return `
          <div class="e-yoy-row">
            <div class="e-yoy-cat">${c.name}</div>
            <div class="e-yoy-bars">
              <div class="e-yoy-bar-line">
                <span class="yr">${yearLabel}</span>
                <div class="e-yoy-bar-fill"><div class="e-yoy-fill-curr" style="width:${currPct.toFixed(1)}%;"></div></div>
                <span class="num">${fmtMoney(curr)}</span>
              </div>
              <div class="e-yoy-bar-line">
                <span class="yr">${prevYearLabel}</span>
                <div class="e-yoy-bar-fill"><div class="e-yoy-fill-prev" style="width:${prevPct.toFixed(1)}%;"></div></div>
                <span class="num">${fmtMoney(prevVal)}</span>
              </div>
            </div>
            <span class="e-yoy-delta ${dCls}">${arrow} ${Math.abs(delta).toFixed(1)}%</span>
          </div>`;
      }).join('');

      // ====== DAC Exposure card (Idea 3) ======
      const expCards = sorted.map(c => {
        const prev = findPrev(c.name);
        const curr = (c.dac_pct || 0) * 100;
        const prevVal = prev ? (prev.dac_pct || 0) * 100 : null;
        const delta = prevVal !== null ? curr - prevVal : null;
        const dCls = delta === null ? '' : (delta > 0 ? 'up' : (delta < 0 ? 'down' : 'neutral'));
        const arrow = delta === null ? '' : (delta > 0 ? '↑' : (delta < 0 ? '↓' : '→'));
        return `
          <div class="e-exp-card">
            <div class="e-exp-cat">${c.name}</div>
            <div class="e-exp-num-row">
              <span class="e-exp-pct">${curr.toFixed(0)}%</span>
              ${delta !== null ? `<span class="e-exp-delta ${dCls}">${arrow} ${Math.abs(delta).toFixed(0)}pp</span>` : ''}
            </div>
            <div class="e-exp-bar"><div style="width:${curr.toFixed(1)}%;"></div></div>
            <div class="e-exp-total">${fmtMoney(c.total)} total</div>
          </div>`;
      }).join('');

      return `
        <div class="chart-row cols-2">
          <div class="chart-card">
            <div class="chart-card-head">
              <div>
                <h3>Capital Investment YoY · by Category</h3>
                <p class="chart-sub">${yearLabel} vs ${prevYearLabel} per investment category</p>
              </div>
              <span class="chart-tag">Section E · YOY E1</span>
            </div>
            <div class="chart-body">
              ${yoyRows || '<div class="empty-pane">No data available for this view.</div>'}
            </div>
          </div>
          <div class="chart-card">
            <div class="chart-card-head">
              <div>
                <h3>DAC Exposure Profile</h3>
                <p class="chart-sub">% of capital affecting DAC areas, with delta vs ${prevYearLabel}</p>
              </div>
              <span class="chart-tag">Section E · DAC E1</span>
            </div>
            <div class="chart-body">
              <div class="e-exp-grid">
                ${expCards}
              </div>
            </div>
          </div>
        </div>`;
    }
    if (LETTER === 'F') {
      const f8 = CHARTS[showCurrent ? 'F8_boroughs_2024' : 'F8_boroughs_2023'] || [];
      const rows = f8.filter(b => b.name !== 'Grand Total').map(b => ({ name: b.name, dac: b.dac, nondac: b.nondac, total: b.dac + b.nondac }));
      return `
        <div class="chart-row cols-1">
          <div class="chart-card">
            <div class="chart-card-head"><div><h3>Customers Interrupted by Borough</h3><p class="chart-sub">Section F (Table F8) · ${yearLabel} · DAC vs Non-DAC distribution</p></div><span class="chart-tag">Section F · GEO</span></div>
            <div class="chart-body">
              <div class="chart-legend"><div class="legend-item"><span class="legend-swatch" style="background:var(--dusk)"></span>DAC customers interrupted</div><div class="legend-item"><span class="legend-swatch" style="background:var(--pale-sky)"></span>Non-DAC</div></div>
              ${D.stackedBar(rows, { labelW: 110, fmt: D.fmtCompact })}
            </div>
          </div>
        </div>`;
    }
    if (LETTER === 'G') {
      const replaced = CHARTS[showCurrent ? 'G_replacement_2024' : 'G_replacement_2023'] || [];
      const aban = showCurrent ? CHARTS.G_abandonment_2024 : null;
      return `
        <div class="chart-row cols-2">
          <div class="chart-card">
            <div class="chart-card-head"><div><h3>Pipe Replacement by County (Feet)</h3><p class="chart-sub">${yearLabel} · Tables G2/G4/G6/G8 · DAC vs Non-DAC</p></div><span class="chart-tag">Section G · GEO</span></div>
            <div class="chart-body">
              <div class="chart-legend"><div class="legend-item"><span class="legend-swatch" style="background:var(--dusk)"></span>DAC</div><div class="legend-item"><span class="legend-swatch" style="background:var(--pale-sky)"></span>Non-DAC</div></div>
              ${D.stackedBar(replaced, { labelW: 110, fmt: v => D.fmtCompact(v) + ' ft' })}
            </div>
          </div>
          ${aban ? `<div class="chart-card analytical">
            <div class="chart-card-head"><div><h3>Pipe Abandonment by County (Feet) <span class="badge new" style="margin-left:6px;">NEW IN 2024</span></h3><p class="chart-sub">${yearLabel} · Tables G3/G5/G7/G9 · No 2023 baseline</p></div><span class="chart-tag">Section G · NEW</span></div>
            <div class="chart-body">
              <div class="chart-legend"><div class="legend-item"><span class="legend-swatch" style="background:var(--dusk)"></span>DAC</div><div class="legend-item"><span class="legend-swatch" style="background:var(--pale-sky)"></span>Non-DAC</div></div>
              ${D.stackedBar(aban, { labelW: 110, fmt: v => D.fmtCompact(v) + ' ft' })}
            </div>
          </div>` : `<div class="chart-card"><div class="chart-card-head"><div><h3>Pipe Abandonment</h3><p class="chart-sub">No 2023 baseline · NEW in 2024</p></div></div><div class="empty-pane">Abandonment tables (G3/G5/G7/G9) are NEW IN 2024 — switch the year selector to see them.</div></div>`}
        </div>`;
    }
    if (LETTER === 'H') {
      const h = CHARTS[showCurrent ? 'H1_boroughs_2024' : 'H1_boroughs_2023'] || [];
      return `
        <div class="chart-row cols-1">
          <div class="chart-card">
            <div class="chart-card-head"><div><h3>Gas Leak Repairs by Borough</h3><p class="chart-sub">${yearLabel} · Table H1 · DAC vs Non-DAC repair counts</p></div><span class="chart-tag">Section H · GEO</span></div>
            <div class="chart-body">
              <div class="chart-legend"><div class="legend-item"><span class="legend-swatch" style="background:var(--dusk)"></span>DAC repairs</div><div class="legend-item"><span class="legend-swatch" style="background:var(--pale-sky)"></span>Non-DAC repairs</div></div>
              ${D.stackedBar(h, { labelW: 120, fmt: v => v.toLocaleString() })}
            </div>
          </div>
        </div>`;
    }
    if (LETTER === 'I') {
      // I1 has descriptive rows mixed with numeric ones.
      // Read the table data directly from TABLES (charts:{} is empty in payload).
      const i1 = (TABLES || []).find(t => t.id === 'I1');
      const data2024 = i1 && i1.data_2024 ? i1.data_2024 : [];
      const data2023 = i1 && i1.data_2023 ? i1.data_2023 : [];

      // Helper: find a row by partial label match (case-insensitive) and return its 'unique' value (col 1)
      const findUnique = (rows, labelMatch) => {
        const r = rows.find(row => row[0] && typeof row[0] === 'string' &&
                                    row[0].toLowerCase().includes(labelMatch.toLowerCase()));
        if (!r) return null;
        const v = r[1];
        return typeof v === 'number' ? v : null;
      };

      const enrolled2024 = findUnique(data2024, 'students enrolled');
      const enrolled2023 = findUnique(data2023, 'students enrolled');
      const grad2024     = findUnique(data2024, 'students that graduate');
      const grad2023     = findUnique(data2023, 'students that graduate');
      const placed2024   = findUnique(data2024, 'jobs placed');
      const placed2023   = findUnique(data2023, 'jobs placed');
      const dacHires2024 = findUnique(data2024, 'who resided in a disadvantaged community');
      const dacHires2023 = findUnique(data2023, 'who resided in a disadvantaged community');

      const fmtInt = v => v == null ? '—' : v.toLocaleString();
      const computeDelta = (curr, prev) => {
        if (curr == null || prev == null || prev === 0) return null;
        return ((curr - prev) / prev) * 100;
      };
      const renderDelta = (curr, prev) => {
        const d = computeDelta(curr, prev);
        if (d == null) return '<span class="kpi-prev-row" style="color:var(--text-3);">No baseline</span>';
        const cls = d > 0 ? 'up' : (d < 0 ? 'down' : '');
        const arrow = d > 0 ? '↑' : (d < 0 ? '↓' : '·');
        return `<span class="kpi-prev-row ${cls}">${arrow} ${Math.abs(d).toFixed(1)}% vs ${prevYearLabel}</span>`;
      };

      // Pick which year is current vs prev based on selector
      const v = (a2024, a2023) => showCurrent ? { curr: a2024, prev: a2023 } : { curr: a2023, prev: a2024 };

      const tiles = [
        {
          segCls: 'dac',
          label: 'Students Enrolled',
          value: fmtInt(v(enrolled2024, enrolled2023).curr),
          delta: renderDelta(v(enrolled2024, enrolled2023).curr, v(enrolled2024, enrolled2023).prev)
        },
        {
          segCls: 'dac',
          label: 'Students Graduated',
          value: fmtInt(v(grad2024, grad2023).curr),
          delta: renderDelta(v(grad2024, grad2023).curr, v(grad2024, grad2023).prev)
        },
        {
          segCls: 'li',
          label: 'Job Placements',
          value: fmtInt(v(placed2024, placed2023).curr),
          delta: renderDelta(v(placed2024, placed2023).curr, v(placed2024, placed2023).prev)
        },
        {
          segCls: 'li',
          label: 'DAC Hires at Con Edison',
          value: fmtInt(v(dacHires2024, dacHires2023).curr),
          delta: renderDelta(v(dacHires2024, dacHires2023).curr, v(dacHires2024, dacHires2023).prev)
        }
      ];

      return `
        <div class="chart-row cols-1">
          <div class="chart-card">
            <div class="chart-card-head"><div><h3>Clean Energy Academy · ${yearLabel} Snapshot</h3><p class="chart-sub">Section I · Workforce development pipeline (unique counts)</p></div><span class="chart-tag">Section I · YOY I1</span></div>
            <div class="chart-body">
              <div class="c2-grid c2-grid-row">
                ${tiles.map(t => `
                  <div class="c2-card c2-${t.segCls}">
                    <div class="c2-card-label">${t.label}</div>
                    <div class="c2-card-num">${t.value}</div>
                    <div class="c2-card-pct">${t.delta}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>`;
    }
    if (LETTER === 'J') {
      // Average usage from CHARTS (J1 + J2)
      const j1 = (CHARTS.J1_avg_usage || {})[state.year] || {};
      const j2 = (CHARTS.J2_avg_gas || {})[state.year] || {};

      // Read tables for J7 (EAP) and J9 (residential customers)
      const j7 = (TABLES || []).find(t => t.id === 'J7');
      const j9 = (TABLES || []).find(t => t.id === 'J9');

      // J9: residential customers DAC + Non-DAC
      const j9data = (j9 && (showCurrent ? j9.data_2024 : j9.data_2023)) || [];
      const j9row = j9data[1] || [];
      const dacCustomers = typeof j9row[1] === 'number' ? j9row[1] : null;
      const nondacCustomers = typeof j9row[3] === 'number' ? j9row[3] : null;
      const totalCustomers = (dacCustomers != null && nondacCustomers != null)
        ? dacCustomers + nondacCustomers : null;

      // J7: EAP enrolled — sum electric-only + gas-only + dual for DAC and Non-DAC
      const j7data = (j7 && (showCurrent ? j7.data_2024 : j7.data_2023)) || [];
      const j7dacRow = j7data[1] || [];
      const j7nondacRow = j7data[2] || [];
      const sumNums = arr => arr.slice(1, 4).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
      const dacEap = j7dacRow.length ? sumNums(j7dacRow) : null;
      const nondacEap = j7nondacRow.length ? sumNums(j7nondacRow) : null;
      const totalEap = (dacEap != null && nondacEap != null) ? dacEap + nondacEap : null;

      // Format helpers
      const fmtInt = v => v == null ? '—' : v.toLocaleString();
      const fmtPct = (part, total) => (part == null || !total) ? '—' : ((part / total) * 100).toFixed(1) + '%';

      // Card 1: Average Residential Usage
      const usageTiles = [
        { segCls: 'dac', label: 'Avg Electric · DAC',     value: j1.dac != null ? j1.dac.toFixed(1) : '—',     sub: 'kWh per residential customer' },
        { segCls: 'dac', label: 'Avg Electric · Non-DAC', value: j1.nondac != null ? j1.nondac.toFixed(1) : '—', sub: 'kWh per residential customer' },
        { segCls: 'li',  label: 'Avg Gas · DAC',          value: j2.dac ? j2.dac.toFixed(1) : '—',             sub: 'ccf per residential customer' },
        { segCls: 'li',  label: 'Avg Gas · Non-DAC',      value: j2.nondac ? j2.nondac.toFixed(1) : '—',         sub: 'ccf per residential customer' }
      ];

      // Card 2: DAC Customer Base & EAP Reach
      const baseTiles = [
        { segCls: 'dac', label: 'Total Residential Customers', value: fmtInt(totalCustomers), sub: 'All residential customers (J9)' },
        { segCls: 'dac', label: 'DAC Customers',               value: fmtInt(dacCustomers),   sub: fmtPct(dacCustomers, totalCustomers) + ' of system base' },
        { segCls: 'li',  label: 'EAP Enrolled (Total)',        value: fmtInt(totalEap),       sub: fmtPct(dacEap, totalEap) + ' are DAC customers' },
        { segCls: 'li',  label: 'EAP DAC Enrolled',            value: fmtInt(dacEap),         sub: 'Customers in DACs receiving EAP' }
      ];

      return `
        <div class="chart-row cols-1">
          <div class="chart-card">
            <div class="chart-card-head"><div><h3>Average Residential Usage · ${yearLabel} Snapshot</h3><p class="chart-sub">Section J · Per-customer averages by segment (Tables J1, J2)</p></div><span class="chart-tag">Section J · USAGE</span></div>
            <div class="chart-body">
              <div class="c2-grid c2-grid-row">
                ${usageTiles.map(t => `
                  <div class="c2-card c2-${t.segCls}">
                    <div class="c2-card-label">${t.label}</div>
                    <div class="c2-card-num">${t.value}</div>
                    <div class="c2-card-pct">${t.sub}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          <div class="chart-card" style="margin-top: 16px;">
            <div class="chart-card-head"><div><h3>DAC Customer Base & EAP Reach · ${yearLabel}</h3><p class="chart-sub">Section J · Customer base and Energy Affordability Program penetration (Tables J7, J9)</p></div><span class="chart-tag">Section J · EAP</span></div>
            <div class="chart-body">
              <div class="c2-grid c2-grid-row">
                ${baseTiles.map(t => `
                  <div class="c2-card c2-${t.segCls}">
                    <div class="c2-card-label">${t.label}</div>
                    <div class="c2-card-num">${t.value}</div>
                    <div class="c2-card-pct">${t.sub}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>`;
    }
    return '';
  }

  function renderTables() {
    document.getElementById('tables-container').innerHTML = D.renderSourceTables(TABLES, state.year, state.perTableYearView, state.activeTableId);
    D.wireYearToggles(state, renderTables);
  }

  function wireQuadrantMetricToggle() {
    document.querySelectorAll('.quadrant-metric-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.quadrantMetric = btn.dataset.metric;
        rerenderAll();
      });
    });
  }

  function wireRankToggle() {
    document.querySelectorAll('.rank-toggle button').forEach(btn => {
      btn.addEventListener('click', () => {
        state.rankBy = btn.dataset.rank;
        rerenderAll();
      });
    });
  }

  function wireQuadrantTooltip() {
    let tip = document.querySelector('.scatter-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'scatter-tooltip';
      document.body.appendChild(tip);
    }
    const circles = document.querySelectorAll('.scatter-svg circle[data-name]');
    circles.forEach(c => {
      c.addEventListener('mouseenter', () => {
        const name = c.getAttribute('data-name');
        const total = c.getAttribute('data-total');
        const dac = c.getAttribute('data-dac');
        tip.innerHTML = `
          <div class="tt-name">${name}</div>
          <div class="tt-row"><span>Total</span><span class="v">${total}</span></div>
          <div class="tt-row"><span>DAC share</span><span class="v">${dac}</span></div>`;
        tip.style.opacity = '1';
      });
      c.addEventListener('mousemove', e => {
        tip.style.left = (e.pageX + 14) + 'px';
        tip.style.top  = (e.pageY - 8)  + 'px';
      });
      c.addEventListener('mouseleave', () => { tip.style.opacity = '0'; });
    });
  }

  function wireHelpButtons() {
    document.querySelectorAll('.help-btn[data-help="quadrant"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const isMMBtu = state.quadrantMetric === 'mmbtu';
        const xAxis = isMMBtu ? 'total energy savings (MMBtu)' : 'total funding ($)';
        const sizeNote = isMMBtu ? 'Bigger dots = more MMBtu saved.' : 'Bigger dots = more total spend.';
        const trDesc = isMMBtu
          ? 'Large savings · highly equitable. The ideal zone — impact + equity.'
          : 'Large programs · highly equitable. The ideal zone — scale + equity.';
        const brDesc = isMMBtu
          ? 'Large savings · low DAC share. Impact without equity — candidates for re-balancing.'
          : 'Large programs · low DAC share. Scale without equity — candidates for re-balancing.';
        const tlDesc = isMMBtu
          ? 'Small savings · highly equitable. Most savings reach DACs but limited impact.'
          : 'Small programs · highly equitable. Most funds reach DACs but limited scale.';
        const blDesc = isMMBtu
          ? 'Small savings · low DAC share. Limited reach in any dimension.'
          : 'Small programs · low DAC share. Limited reach in any dimension.';

        const modal = document.createElement('div');
        modal.className = 'help-modal-overlay';
        modal.innerHTML = `
          <div class="help-modal" role="dialog" aria-labelledby="help-modal-title">
            <div class="help-modal-head">
              <h3 id="help-modal-title">How to read the Equity Quadrant${isMMBtu ? ' · MMBtu mode' : ' · Dollars mode'}</h3>
              <button class="help-modal-close" type="button" aria-label="Close">×</button>
            </div>
            <div class="help-modal-body">
              <p>Each dot is a program. <em>X-axis</em> = ${xAxis}. <em>Y-axis</em> = share that reached DACs. ${sizeNote} The 50% dashed line splits the chart into four zones:</p>
              <div class="quadrant-zones">
                <div class="zone zone-tl"><span class="zone-label">↖ Top-Left</span><span class="zone-desc">${tlDesc}</span></div>
                <div class="zone zone-tr"><span class="zone-label">↗ Top-Right</span><span class="zone-desc">${trDesc}</span></div>
                <div class="zone zone-bl"><span class="zone-label">↙ Bottom-Left</span><span class="zone-desc">${blDesc}</span></div>
                <div class="zone zone-br"><span class="zone-label">↘ Bottom-Right</span><span class="zone-desc">${brDesc}</span></div>
              </div>
            </div>
          </div>`;
        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.addEventListener('click', e => { if (e.target === modal) close(); });
        modal.querySelector('.help-modal-close').addEventListener('click', close);
        document.addEventListener('keydown', function esc(e) {
          if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
        });
      });
    });
  }

  function rerenderAll() {
    fillStats();
    document.getElementById('charts-container').innerHTML = renderCharts();
    renderTables();
    wireRankToggle();
    wireQuadrantMetricToggle();
    wireHelpButtons();
    wireQuadrantTooltip();
  }

  D.boot(newYear => {
    state.year = newYear;
    state.perTableYearView = {};
    rerenderAll();
  });

  rerenderAll();
})();