// ==========================================================================
// shared.js — Chart primitives, formatters, and table renderers
// Used by: index.html (Executive Summary) and section_A.html ... section_J.html
// All functions exposed under window.__DASH
// ==========================================================================

window.__DASH = window.__DASH || {};

// ---------- Format helpers ----------
window.__DASH.fmtNum = function(v, kind) {
  if (v === null || v === undefined || v === '' || v === 'N/A') return '—';
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[, $%]/g,''));
    if (isNaN(n)) return v;
    v = n;
  }
  if (kind === 'currency') {
    if (Math.abs(v) >= 1e9) return '$' + (v/1e9).toFixed(2) + 'B';
    if (Math.abs(v) >= 1e6) return '$' + (v/1e6).toFixed(1) + 'M';
    if (Math.abs(v) >= 1e3) return '$' + (v/1e3).toFixed(0) + 'K';
    return '$' + v.toFixed(0);
  }
  if (kind === 'currency_decimal') return '$' + v.toFixed(2);
  if (kind === 'pct') return (Math.abs(v) <= 1 ? v*100 : v).toFixed(1) + '%';
  if (kind === 'ratio') return v.toFixed(2) + 'x';
  if (kind === 'decimal') return Math.abs(v) >= 1000 ? v.toLocaleString(undefined, {maximumFractionDigits: 1}) : v.toFixed(2);
  if (kind === 'int') return Math.round(v).toLocaleString();
  return v.toLocaleString();
};

window.__DASH.fmtCompact = function(v) {
  if (v === null || v === undefined) return '—';
  if (Math.abs(v) >= 1e9) return (v/1e9).toFixed(2) + 'B';
  if (Math.abs(v) >= 1e6) return (v/1e6).toFixed(1) + 'M';
  if (Math.abs(v) >= 1e3) return (v/1e3).toFixed(0) + 'K';
  return Math.round(v).toLocaleString();
};

window.__DASH.fmtCell = function(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') {
    if (Number.isInteger(v) || Math.abs(v) >= 100) return v.toLocaleString();
    if (Math.abs(v) <= 1) return (v*100).toFixed(1) + '%';
    return v.toLocaleString(undefined, {maximumFractionDigits: 2});
  }
  return String(v);
};

window.__DASH.isNumeric = function(v) {
  if (typeof v === 'number') return true;
  if (typeof v !== 'string') return false;
  const cleaned = v.replace(/[, $%]/g,'');
  return cleaned !== '' && !isNaN(parseFloat(cleaned)) && isFinite(parseFloat(cleaned));
};

window.__DASH.deltaPct = function(curr, prev) {
  if (curr === null || prev === null || prev === 0 || prev === undefined || curr === undefined) return null;
  return (curr - prev) / Math.abs(prev);
};

// ---------- Chart builders ----------
window.__DASH.donut = function(dac, total, opts) {
  opts = opts || {};
  const size = opts.size || 130;
  const stroke = opts.stroke || 18;
  const r = (size - stroke) / 2;
  const cx = size/2, cy = size/2;
  const C = 2 * Math.PI * r;
  const pct = total > 0 ? dac/total : 0;
  const dash = C * pct;
  const colorDac = opts.colorDac || 'var(--dusk)';
  const colorTrack = opts.colorTrack || 'var(--white-smoke)';
  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colorTrack}" stroke-width="${stroke}"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${colorDac}" stroke-width="${stroke}"
              stroke-dasharray="${dash} ${C}" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round"/>
    </svg>`;
};

window.__DASH.stackedBar = function(items, opts) {
  opts = opts || {};
  const max = opts.max || Math.max(...items.map(i => i.total));
  const labelW = opts.labelW || 140;
  const fmtCompact = window.__DASH.fmtCompact;
  return `<div class="bar-chart">${items.map(item => {
    const totalPct = max > 0 ? (item.total / max) : 0;
    const trackWidth = `${(totalPct * 100).toFixed(2)}%`;
    const dacPct = item.total > 0 ? item.dac / item.total : 0;
    const nondacPct = 1 - dacPct;
    const subVal = opts.showDacSplit !== false
      ? `<span class="bar-value-sub">${(dacPct*100).toFixed(0)}% DAC</span>`
      : '';
    return `
      <div class="bar-row" style="grid-template-columns: ${labelW}px 1fr auto;">
        <div class="bar-label" title="${item.name}">${item.name}</div>
        <div class="bar-track" style="width:100%; background:transparent;">
          <div style="width:${trackWidth}; display:flex; height:100%; background:var(--white-smoke); border-radius:3px; overflow:hidden;">
            <div class="seg seg-dac" style="width:${(dacPct*100).toFixed(2)}%"></div>
            <div class="seg seg-nondac" style="width:${(nondacPct*100).toFixed(2)}%"></div>
          </div>
        </div>
        <div class="bar-value">${opts.fmt ? opts.fmt(item.total) : fmtCompact(item.total)}${subVal}</div>
      </div>`;
  }).join('')}</div>`;
};

window.__DASH.compareRows = function(items, opts) {
  opts = opts || {};
  const max = Math.max(...items.flatMap(i => [i.curr, i.prev]).filter(v => v != null));
  const labelW = opts.labelW || 100;
  const yearLabel = opts.yearLabel || '2024';
  const prevLabel = opts.prevLabel || '2023';
  const fmt = opts.fmt || window.__DASH.fmtCompact;
  const deltaPct = window.__DASH.deltaPct;
  return `<div>${items.map(item => {
    const cPct = max > 0 ? (item.curr / max * 100) : 0;
    const pPct = max > 0 ? (item.prev / max * 100) : 0;
    const d = deltaPct(item.curr, item.prev);
    const dCls = d == null ? '' : (d > 0.005 ? 'up' : d < -0.005 ? 'down' : '');
    const dArrow = d == null ? '' : (d > 0.005 ? '↑' : d < -0.005 ? '↓' : '·');
    const dLabel = d == null ? '—' : `${dArrow} ${(Math.abs(d)*100).toFixed(1)}%`;
    const inv = opts.lower_is_better ? ' invert' : '';
    return `
      <div class="comp-row" style="grid-template-columns: ${labelW}px 1fr auto;">
        <div class="comp-label">${item.name}</div>
        <div class="comp-bars">
          <div class="comp-bar-line"><span class="yr">${yearLabel}</span><div class="bar-fill"><div style="width:${cPct.toFixed(1)}%"></div></div><span class="bar-num">${fmt(item.curr)}</span></div>
          <div class="comp-bar-line prev"><span class="yr">${prevLabel}</span><div class="bar-fill"><div style="width:${pPct.toFixed(1)}%"></div></div><span class="bar-num">${fmt(item.prev)}</span></div>
        </div>
        <div class="comp-delta ${dCls}${inv}">${dLabel}</div>
      </div>`;
  }).join('')}</div>`;
};

window.__DASH.sparkLine = function(values, opts) {
  opts = opts || {};
  const w = opts.width || 80, h = opts.height || 24;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const padY = 3;
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - padY - ((v - min) / range) * (h - 2*padY);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const fillPoints = `0,${h} ${points.join(' ')} ${w},${h}`;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
    <polygon class="spark-fill" points="${fillPoints}" fill="rgba(47,84,150,0.15)"/>
    <polyline class="spark-line" points="${points.join(' ')}" fill="none" stroke="var(--dusk)" stroke-width="1.5" stroke-linecap="round"/>
    <circle class="spark-dot" cx="${points[points.length-1].split(',')[0]}" cy="${points[points.length-1].split(',')[1]}" r="2.5" fill="var(--dusk)"/>
  </svg>`;
};

window.__DASH.groupedBars = function(items, opts) {
  opts = opts || {};
  const w = 600, h = 180;
  const padL = 50, padR = 16, padT = 16, padB = 38;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const max = Math.max(...items.flatMap(i => [i.curr, i.prev]).filter(v => v != null));
  const niceMax = Math.ceil(max / Math.pow(10, Math.floor(Math.log10(max)))) * Math.pow(10, Math.floor(Math.log10(max)));
  const groupW = innerW / items.length;
  const barW = Math.min(20, groupW * 0.32);
  const gap = 3;
  const fmtCompact = window.__DASH.fmtCompact;
  let bars = '', labels = '', yticks = '';
  const tickCount = 4;
  for (let i = 0; i <= tickCount; i++) {
    const v = (niceMax / tickCount) * i;
    const y = padT + innerH - (v/niceMax) * innerH;
    yticks += `<line x1="${padL}" x2="${w-padR}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="0.5"/>`;
    yticks += `<text x="${padL - 6}" y="${y + 3}" font-size="9" fill="var(--text-3)" text-anchor="end" font-family="var(--font-mono)">${fmtCompact(v)}</text>`;
  }
  items.forEach((item, i) => {
    const groupX = padL + i*groupW + (groupW - 2*barW - gap)/2;
    if (item.curr != null) {
      const ch = (item.curr / niceMax) * innerH;
      const cy = padT + innerH - ch;
      bars += `<rect x="${groupX}" y="${cy}" width="${barW}" height="${ch}" fill="var(--dusk)" rx="1"/>`;
    }
    if (item.prev != null) {
      const ph = (item.prev / niceMax) * innerH;
      const py = padT + innerH - ph;
      bars += `<rect x="${groupX + barW + gap}" y="${py}" width="${barW}" height="${ph}" fill="var(--mauve-light)" rx="1"/>`;
    }
    const labelX = padL + i*groupW + groupW/2;
    labels += `<text x="${labelX}" y="${h - 18}" font-size="10" fill="var(--text-2)" text-anchor="middle" font-weight="600">${item.name}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="xMinYMid meet">${yticks}${bars}${labels}</svg>`;
};

window.__DASH.quadrant = function(items, opts) {
  opts = opts || {};
  const xLabel = opts.xLabel || 'Total Incentive Funding ($)';
  const xUnit  = opts.xUnit  || '';
  const w = 540, h = 360;
  const padL = 44, padR = 12, padT = 16, padB = 36;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const xmax = Math.max(...items.map(i => i.total));
  const niceXmax = (function () {
    if (xmax <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(xmax)));
    const n = xmax / pow;
    let nice;
    if (n <= 1) nice = 1;
    else if (n <= 2) nice = 2;
    else if (n <= 2.5) nice = 2.5;
    else if (n <= 5) nice = 5;
    else nice = 10;
    return nice * pow;
  })();
  const fmtCompact = window.__DASH.fmtCompact;
  let dots = '', xticks = '', yticks = '';
  for (let i = 0; i <= 4; i++) {
    const v = (niceXmax / 4) * i;
    const x = padL + (v/niceXmax)*innerW;
    xticks += `<line x1="${x}" x2="${x}" y1="${padT}" y2="${padT + innerH}" stroke="var(--line)" stroke-width="0.5"/>`;
    xticks += `<text x="${x}" y="${h - 16}" font-size="9" fill="var(--text-3)" text-anchor="middle" font-family="var(--font-mono)">${fmtCompact(v)}${xUnit ? ' ' + xUnit : ''}</text>`;
  }
  for (let i = 0; i <= 4; i++) {
    const v = i * 25;
    const y = padT + innerH - (v/100)*innerH;
    yticks += `<line x1="${padL}" x2="${w-padR}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="0.5"/>`;
    yticks += `<text x="${padL - 6}" y="${y + 3}" font-size="9" fill="var(--text-3)" text-anchor="end" font-family="var(--font-mono)">${v}%</text>`;
  }
  const refY = padT + innerH - 0.5*innerH;
  yticks += `<line x1="${padL}" x2="${w-padR}" y1="${refY}" y2="${refY}" stroke="var(--mauve-shadow)" stroke-width="0.8" stroke-dasharray="3 2"/>`;
  yticks += `<text x="${w-padR - 4}" y="${refY - 4}" font-size="8" fill="var(--mauve-shadow)" text-anchor="end" font-weight="600">50% parity</text>`;
  items.forEach(item => {
    const x = padL + (item.total/niceXmax)*innerW;
    const dacPct = item.dac_pct;
    const y = padT + innerH - (dacPct)*innerH;
    const r =  3 + Math.sqrt(item.total) * (opts.dotScale || 0.0007);
    const above = dacPct >= 0.5;
    const color = above ? 'var(--dusk)' : 'var(--mauve-shadow)';
    const totalFmt = fmtCompact(item.total) + (xUnit ? ' ' + xUnit : '');
    const tooltip = `${item.name}\n${xLabel.replace(/\s*\([^)]*\)$/, '')}: ${totalFmt}\nDAC share: ${(dacPct*100).toFixed(1)}%`;
    dots += `<circle cx="${x}" cy="${y}" r="${Math.min(r, 18)}" fill="${color}" opacity="0.75" style="cursor:pointer" data-name="${item.name.replace(/"/g, '&quot;')}" data-total="${totalFmt}" data-dac="${(dacPct*100).toFixed(1)}%"></circle>`;
  });
  const xlabelText = `<text x="${padL + innerW/2}" y="${h - 4}" font-size="10" fill="var(--text-3)" text-anchor="middle">${xLabel}</text>`;
  const ylabel = `<text x="14" y="${padT + innerH/2}" font-size="10" fill="var(--text-3)" text-anchor="middle" transform="rotate(-90 14 ${padT + innerH/2})">DAC Share</text>`;
  return `<svg class="scatter-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">${xticks}${yticks}${dots}${xlabelText}${ylabel}</svg>`;
};

// ---------- Table rendering ----------
window.__DASH.isTotalRow = function(row) {
  if (!row || !row[0]) return false;
  const s = String(row[0]).trim().toLowerCase();
  // Match exact totals, "subtotal", or any label that ends in "total" or "totals"
  return s === 'total' || s === 'grand total' || s === 'county total' ||
         s === 'subtotal' ||
         /\btotals?$/i.test(s) ||
         /\btotal\s+installations?$/i.test(s);
};

// Detect which columns are percentages, based on header text
window.__DASH.detectPctColumns = function(headerRow) {
  return headerRow.map(h => {
    if (h == null) return false;
    const s = String(h).toLowerCase().trim();
    // True for: "% in DACs", "% DAC", "% Change", "Total %", "DAC %", standalone "%",
    //          "Percentage Affecting DACs", "Percent of...", or any header starting with "percentage"/"percent"
    return /(^|[\s\(])%/.test(s) || /%\s*(in\s+)?dac/.test(s) || /%\s*change/.test(s) ||
           /\bpct\b/.test(s) || /^percent(age)?\b/.test(s);
  });
};

// Detect a subheader row: col 0 has text, all other cols empty/null
window.__DASH.isSubheaderRow = function(row) {
  if (!row || !row[0] || typeof row[0] !== 'string') return false;
  if (window.__DASH.isTotalRow(row)) return false;
  for (let i = 1; i < row.length; i++) {
    const c = row[i];
    if (c !== null && c !== undefined && c !== '') return false;
  }
  return true;
};

window.__DASH.renderTable = function(rows, opts) {
  opts = opts || {};
  const headerLevels = opts.headerLevels || 1;
  const isNumeric = window.__DASH.isNumeric;
  const isTotalRow = window.__DASH.isTotalRow;
  const isSubheaderRow = window.__DASH.isSubheaderRow;
  const detectPctColumns = window.__DASH.detectPctColumns;
  if (!rows || rows.length === 0) return '<div class="empty-pane">No data available for this view.</div>';

  // Determine % columns from the LAST header row (the one with detailed col names)
  const pctHeader = rows[headerLevels - 1] || rows[0];
  const pctCols = detectPctColumns(pctHeader);

  // Format individual cells
  function formatCell(c, colIdx, rowLabel) {
    if (c == null || c === '') return '';
    if (typeof c === 'string') return c;
    if (typeof c === 'number') {
      // Detect % by column header OR by row label (e.g. "Percentage of projects in DACs")
      const isPctRow = rowLabel && /^percentage|^%/i.test(String(rowLabel).trim());
      if (pctCols[colIdx] || isPctRow) {
        return (Math.abs(c) <= 1 ? c * 100 : c).toFixed(1) + '%';
      }
      // Regular number: keep integers with separator, decimals as-is
      if (Number.isInteger(c) || Math.abs(c) >= 100) return c.toLocaleString();
      return c.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
    return String(c);
  }

  // Build header (0, 1, or 2 levels)
  let headerHtml = '';
  if (headerLevels === 0) {
    headerHtml = '';
  } else if (headerLevels === 1) {
    const headerRow = rows[0];
    const cells = headerRow.map(c => `<th>${c == null ? '' : String(c)}</th>`).join('');
    headerHtml = `<thead><tr>${cells}</tr></thead>`;
  } else {
    // 2-level header support:
    //   - lvl1 with `null` after a value means "extend previous cell as colspan"
    //     e.g. ["A","B","NON-NETWORK",null,"NETWORK",null,"Total"] → A | B | NON-NETWORK (cs=2) | NETWORK (cs=2) | Total
    //   - Also handles the legacy "consecutive identical values" pattern (e.g. "GROUP","GROUP")
    //   - lvl2 cells that are null/empty under a non-null lvl1 cell collapse: that lvl1 gets rowspan=2
    const lvl1 = rows[0];
    const lvl2 = rows[1];

    // Pass 1: compute span (colspan) for each lvl1 cell. cell at index i has span N if positions i..i+N-1
    // are either equal to lvl1[i] or null (extension).
    const spans = new Array(lvl1.length).fill(0);
    let i = 0;
    while (i < lvl1.length) {
      const v = lvl1[i];
      let span = 1;
      while (i + span < lvl1.length) {
        const nxt = lvl1[i + span];
        // Extend span if next is null OR equal to current value (legacy pattern)
        if (nxt === null || nxt === undefined || nxt === '' || nxt === v) {
          span++;
        } else {
          break;
        }
      }
      spans[i] = span;
      i += span;
    }

    // Pass 2: decide which lvl1 cells get rowspan=2 (when their corresponding lvl2 slots are empty)
    // For a lvl1 cell at idx with colspan=span, look at lvl2[idx..idx+span-1].
    // If ALL those lvl2 cells are empty/null, this lvl1 cell becomes rowspan=2 and lvl2 emits no <th> for that range.
    const rowspans = new Array(lvl1.length).fill(1);
    for (let idx = 0; idx < lvl1.length; idx++) {
      if (spans[idx] === 0) continue;
      const span = spans[idx];
      let allEmpty = true;
      for (let j = idx; j < idx + span; j++) {
        const c = lvl2 ? lvl2[j] : null;
        if (c !== null && c !== undefined && c !== '') { allEmpty = false; break; }
      }
      if (allEmpty) rowspans[idx] = 2;
    }

    // Build lvl1 row
    let lvl1Cells = '';
    for (let idx = 0; idx < lvl1.length; idx++) {
      if (spans[idx] === 0) continue; // covered by previous colspan
      const v = lvl1[idx];
      const text = (v == null || v === '') ? '' : String(v);
      const colspanAttr = spans[idx] > 1 ? ` colspan="${spans[idx]}"` : '';
      const rowspanAttr = rowspans[idx] === 2 ? ' rowspan="2"' : '';
      const cls = (text === '') ? '' : ' class="th-group"';
      lvl1Cells += `<th${colspanAttr}${rowspanAttr}${cls}>${text}</th>`;
    }

    // Build lvl2 row, skipping cells already covered by rowspan=2 from lvl1
    let lvl2Cells = '';
    for (let idx = 0; idx < lvl1.length; idx++) {
      if (spans[idx] === 0) continue; // not a lvl1 anchor
      if (rowspans[idx] === 2) continue; // already covered by rowspan
      const span = spans[idx];
      for (let j = idx; j < idx + span; j++) {
        const c = lvl2 ? lvl2[j] : null;
        const text = (c == null || c === '') ? '' : String(c);
        lvl2Cells += `<th class="th-detail">${text}</th>`;
      }
    }

    headerHtml = `<thead><tr>${lvl1Cells}</tr><tr>${lvl2Cells}</tr></thead>`;
  }

  // Build body
  const body = rows.slice(headerLevels);
  const bodyRows = body.map((row, idx) => {
    let cls = '';
    if (isTotalRow(row)) {
      const isLastRow = idx === body.length - 1;
      cls = isLastRow ? ' class="is-total"' : ' class="is-subtotal"';
    } else if (isSubheaderRow(row)) {
      cls = ' class="is-subhead"';
    } else if (headerLevels === 2) {
      // In multilevel-header tables (A9, A10), every regular body row is a "row head" (label + numbers in bold)
      cls = ' class="is-rowhead"';
    }
    const cells = row.map((c, i) => {
      if (c == null || c === '') return '<td></td>';
      const isNAish = typeof c === 'string' && /^(n\/a|na|—|-)$/i.test(c.trim());
      const isNum = (typeof c === 'number' || (isNumeric(c) && i > 0) || (isNAish && i > 0));
      const numCls = isNum ? ' class="num"' : (c === 'Yes' && i > 0) ? ' class="dac-yes"' : '';
      return `<td${numCls}>${formatCell(c, i, row[0])}</td>`;
    }).join('');
    return `<tr${cls}>${cells}</tr>`;
  }).join('');

  return `<table class="data-table">${headerHtml}<tbody>${bodyRows}</tbody></table>`;
};

window.__DASH.statusBadge = function(mapping) {
  if (!mapping || !mapping.status) return '';
  const status = (mapping.status || '').toUpperCase();
  if (status === 'SAME') return '<span class="badge same">SAME</span>';
  if (status === 'CHANGED') return '<span class="badge changed">CHANGED</span>';
  if (status === 'NEW IN 2024') return '<span class="badge new">NEW IN 2024</span>';
  return '';
};

window.__DASH.renderSourceTables = function(tables, year, perTableView, activeTabId) {
  const showCurrent = year === '2024';
  const renderTable = window.__DASH.renderTable;
  const SHORT_TITLES = window.__DASH.SHORT_TITLES || {};
  if (!tables || tables.length === 0) return '';

  const activeId = activeTabId || tables[0].id;

  const tabsHtml = tables.map(t => {
    const tabNum = t.id.replace(/^([A-Z])(\d+)$/, '$1.$2');
    const shortTitle = SHORT_TITLES[t.id] || '';
    const isActive = t.id === activeId;
    return `<button class="src-tab${isActive ? ' active' : ''}" data-table-id="${t.id}" type="button">
        <span class="src-tab-num">${tabNum}</span>
        ${shortTitle ? `<span class="src-tab-title">${shortTitle}</span>` : ''}
      </button>`;
  }).join('');

  const t = tables.find(x => x.id === activeId) || tables[0];
  const yearView = perTableView[t.id] || 'current';
  const data_current = showCurrent ? t.data_2024 : t.data_2023;
  const data_prev = showCurrent ? t.data_2023 : t.data_2024;
  const title_current = showCurrent ? t.title_2024 : t.title_2023;
  const has_prev = data_prev && data_prev.length > 0;
// When viewing 2024 → prior is 2023 (data exists)
// When viewing 2023 → prior is 2022 (no data — show empty pane with message)
const prior_year_label = showCurrent ? '2023' : '2022';
const has_prior_data = showCurrent;
  const map = t.mapping || {};
  const headerLevels = t.header_levels !== undefined ? t.header_levels : 1;
  const renderOpts = { headerLevels: headerLevels };

  let bodyHtml = '';
 if (yearView === 'both') {
    const priorContent = has_prior_data
      ? renderTable(data_prev, renderOpts)
      : `<div class="empty-pane">No data available for this view.</div>`;
    bodyHtml = `<div class="year-cols">
        <div class="year-col current"><div class="year-col-header">${year} (current)</div>${renderTable(data_current, renderOpts)}</div>
        <div class="year-col"><div class="year-col-header">${prior_year_label} (prior)</div>${priorContent}</div>
      </div>`;
  } else {
    bodyHtml = renderTable(data_current, renderOpts);
  }

  const cleanTitle = (title_current || ('Table ' + t.id)).split('|')[0].trim();
  const partialBadge = (map.notes && /partial year/i.test(map.notes || '')) ? '<span class="badge partial">PARTIAL YEAR 2023</span>' : '';
  const no2023Badge = (showCurrent && (!has_prev || (map.status || '') === 'NEW IN 2024')) ? '<span class="badge no-2023">NO 2023 BASELINE</span>' : '';
  const noteHtml = (map.notes && map.notes.trim()) ? `<div class="mapping-note"><strong>Comparability:</strong> ${map.notes}</div>` : '';
  const yearToggleHtml = `
    <div class="year-toggle" data-table="${t.id}">
      <button data-year="current" class="${yearView === 'current' ? 'active' : ''}">Current Year</button>
      <button data-year="both" class="${yearView === 'both' ? 'active' : ''}">Compare with previous</button>
    </div>`;

  return `
    <div class="src-tabs-row">${tabsHtml}</div>
    <div class="table-card">
      <div class="table-card-header">
        <h3>${cleanTitle}</h3>
        <div class="table-meta-row">${no2023Badge}${partialBadge}${yearToggleHtml}</div>
        ${noteHtml}
      </div>
      <div class="table-card-body">${bodyHtml}</div>
    </div>`;
};

window.__DASH.SHORT_TITLES = {
  'A1': 'Incentive $',
  'A2': 'Energy Savings',
  'A3': 'Participants',
  'A4': 'DAC Participants',
  'A5': 'Commercial Install',
  'A6': 'Multifamily Install',
  'A7': 'Multisector Install',
  'A8': 'Residential Install',
  'A9': 'Comparison Summary',
  'A10': 'Install Compare',

  'B1': 'Funding Spent',
  'B2': 'Plugs Completed',

  'C1': 'DR Programs',
  'C2': 'All Customers',
  'C3': 'DAC Customers',
  'C4': 'Low-Income',
  'C5': 'Total Program',

  'D1': 'Compensation Types',
  'D2': 'DER Projects',
  'D3': 'CDG & RC',
  'D4': 'Net Metering',

  'E1': 'Capital Investments',

  'F1': 'Key Terms',
  'F2': 'System Outages',
  'F3': 'Interruption Rate',
  'F4': 'Non-Network',
  'F5': 'Network',
  'F6': 'Mixed Areas',
  'F7': 'DAC Outages',
  'F8': 'Customers by Type',
  'F9': 'Interrupted',

  'G1': 'Pipe Replaced',
  'G2': 'Bronx Replaced',
  'G3': 'Bronx Abandoned',
  'G4': 'Manhattan Replaced',
  'G5': 'Manhattan Abandoned',
  'G6': 'Queens Replaced',
  'G7': 'Queens Abandoned',
  'G8': 'Westchester Replaced',
  'G9': 'Westchester Abandoned',
  'G10': 'Emissions',

  'H1': 'Leaks Repaired',

  'I1': 'Year Totals',

  'J1': 'Electric Usage',
  'J2': 'Gas Usage',
  'J3': '60-90 Days Overdue',
  'J4': '90+ Days Overdue',
  'J5': 'Disconnects',
  'J6': 'DPAs',
  'J7': 'EAP Enrolled',
  'J8': 'EAP Spending',
  'J9': 'Residential Total'
};

// ---------- Boot helpers ----------
window.__DASH.boot = function(rerenderFn) {
  const yearSel = document.getElementById('year-select');
  if (yearSel) yearSel.addEventListener('change', e => rerenderFn(e.target.value));
  const exp = document.getElementById('btn-export');
  if (exp) exp.addEventListener('click', () => window.print());
};

window.__DASH.wireYearToggles = function(state, rerenderTablesFn) {
  document.querySelectorAll('.year-toggle').forEach(tg => {
    const tableId = tg.getAttribute('data-table');
    tg.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        state.perTableYearView[tableId] = btn.getAttribute('data-year');
        rerenderTablesFn();
      });
    });
  });
  document.querySelectorAll('.src-tab').forEach(tab => {
    tab.addEventListener('click', e => {
      e.stopPropagation();
      state.activeTableId = tab.getAttribute('data-table-id');
      rerenderTablesFn();
    });
  });
};