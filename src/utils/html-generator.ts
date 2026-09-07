import { DashboardSpec } from '../types.js';

export function generateInteractiveHtml(spec: DashboardSpec, data: any[]): Buffer {
  const page = spec.pages && spec.pages.length > 0 ? spec.pages[0] : null;
  const pageTitle = page?.title || 'Interactive Analytics Report';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${pageTitle} - Interactive Report</title>
    <!-- Fully self-contained report; Chart.js loaded from CDN -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --bg: #f8fafc;
            --surface: #ffffff;
            --surface-hover: #f1f5f9;
            --text: #0f172a;
            --text-muted: #64748b;
            --border: #e2e8f0;
            --primary: #2563eb;
            --primary-light: #eff6ff;
            --primary-border: #bfdbfe;
            --emerald: #10b981;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            padding: 32px 24px;
            line-height: 1.5;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        .header {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px 28px;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 1px 3px rgba(0,0,0,0.03);
            flex-wrap: wrap;
            gap: 16px;
        }
        h1 { font-size: 22px; font-weight: 700; color: var(--text); }
        .header-sub { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
        .badge {
            display: inline-flex;
            align-items: center;
            padding: 4px 10px;
            font-size: 12px;
            font-weight: 600;
            border-radius: 9999px;
            background: var(--primary-light);
            color: var(--primary);
            border: 1px solid var(--primary-border);
        }
        .filter-bar {
            background-color: var(--primary-light);
            color: var(--primary);
            padding: 12px 20px;
            border-radius: 12px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 24px;
            display: none;
            cursor: pointer;
            align-items: center;
            justify-content: space-between;
            border: 1px solid var(--primary-border);
            transition: all 0.2s;
        }
        .filter-bar:hover { background-color: #dbeafe; }
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 32px;
        }
        .kpi-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.03);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .kpi-card:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .kpi-label { 
            font-size: 12px; 
            font-weight: 600; 
            color: var(--text-muted); 
            text-transform: uppercase; 
            letter-spacing: 0.04em; 
        }
        .kpi-value { 
            font-size: 26px; 
            font-weight: 700; 
            margin-top: 6px; 
            color: var(--text); 
        }
        .kpi-sub {
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 4px;
        }
        .chart-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(480px, 1fr));
            gap: 24px;
        }
        .chart-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.03);
            display: flex;
            flex-direction: column;
        }
        .chart-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }
        .chart-title { font-size: 15px; font-weight: 600; color: var(--text); }
        .chart-hint { font-size: 11px; color: var(--text-muted); }
        .chart-wrapper { position: relative; height: 320px; width: 100%; }
        
        .footer {
            margin-top: 48px;
            padding-top: 24px;
            border-top: 1px solid var(--border);
            text-align: center;
            font-size: 12px;
            color: var(--text-muted);
        }

        @media (max-width: 768px) {
            .chart-grid { grid-template-columns: 1fr; }
            body { padding: 16px; }
            .kpi-value { font-size: 22px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <h1 id="pageTitle">${pageTitle}</h1>
                <div class="header-sub">Automated Interactive Report • Click chart bars or slices to cross-filter</div>
            </div>
            <div>
                <span class="badge" id="recordCountBadge">Loading...</span>
            </div>
        </div>
        
        <div id="filterBar" class="filter-bar" onclick="clearFilter()">
            <span>🔍 Active Filter: <strong id="filterText"></strong></span>
            <span style="font-size: 12px; text-decoration: underline;">Click to clear filter ✕</span>
        </div>
        
        <div class="kpi-grid" id="kpis"></div>
        <div class="chart-grid" id="charts"></div>

        <div class="footer">
            Interactive Report • Standalone HTML Export • Generated by Kriton Analytics Platform
        </div>
    </div>

    <script>
        const spec = ${JSON.stringify(spec)};
        const rawData = ${JSON.stringify(data)};
        
        let currentFilter = null;
        const chartInstances = {};
        
        const COLORS = [
            '#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', 
            '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1'
        ];
        
        const page = spec.pages && spec.pages.length > 0 ? spec.pages[0] : null;
        
        if (page) {
            document.getElementById('pageTitle').innerText = page.title || 'Interactive Analytics Report';
            document.getElementById('recordCountBadge').innerText = rawData.length.toLocaleString() + ' Records';
            initDashboard();
        } else {
            document.getElementById('pageTitle').innerText = 'No dashboard data available.';
        }
        
        // Strictly formatted numbers - No unrounded raw decimals
        function formatNumber(num) {
            if (num === null || num === undefined || isNaN(num)) return '0';
            const rounded = Math.round(num * 100) / 100;
            if (Math.abs(rounded) >= 1000000) {
                return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(rounded);
            }
            return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(rounded);
        }

        function clearFilter() {
            currentFilter = null;
            updateDashboard();
        }

        function aggregateKpi(dataToUse, kpiSpec) {
            let sum = 0, count = 0, min = Infinity, max = -Infinity;
            dataToUse.forEach(row => {
                const rawVal = row[kpiSpec.field];
                if (kpiSpec.agg === 'count') {
                    if (rawVal !== null && rawVal !== undefined && rawVal !== '') count++;
                } else {
                    const yVal = Number(rawVal);
                    if (!isNaN(yVal)) {
                        sum += yVal; 
                        count++;
                        min = Math.min(min, yVal); 
                        max = Math.max(max, yVal);
                    }
                }
            });
            if (kpiSpec.agg === 'sum') return sum;
            if (kpiSpec.agg === 'avg') return count ? (sum / count) : 0;
            if (kpiSpec.agg === 'count') return count;
            if (kpiSpec.agg === 'max') return count ? max : 0;
            if (kpiSpec.agg === 'min') return count ? min : 0;
            return 0;
        }

        function aggregateChart(dataToUse, chartSpec) {
            const map = {};
            dataToUse.forEach(row => {
                const xVal = String(row[chartSpec.x] !== undefined && row[chartSpec.x] !== null && row[chartSpec.x] !== '' ? row[chartSpec.x] : 'Unspecified');
                let yVal = 0;
                if (chartSpec.agg !== 'count') {
                    yVal = Number(row[chartSpec.y]) || 0;
                }
                if (!map[xVal]) map[xVal] = { sum: 0, count: 0, min: Infinity, max: -Infinity };
                map[xVal].sum += yVal;
                map[xVal].count += 1;
                map[xVal].min = Math.min(map[xVal].min, yVal);
                map[xVal].max = Math.max(map[xVal].max, yVal);
            });

            return Object.entries(map).map(([x, stats]) => {
                let y = 0;
                if (chartSpec.agg === 'sum') y = Math.round(stats.sum * 100) / 100;
                else if (chartSpec.agg === 'avg') y = Math.round((stats.sum / (stats.count || 1)) * 100) / 100;
                else if (chartSpec.agg === 'count') y = stats.count;
                else if (chartSpec.agg === 'max') y = stats.max;
                else if (chartSpec.agg === 'min') y = stats.min;
                return { x, y };
            });
        }

        function initDashboard() {
            const chartsDiv = document.getElementById('charts');
            page.charts.forEach(chartSpec => {
                const card = document.createElement('div');
                card.className = 'chart-card';
                card.id = 'card-' + chartSpec.id;
                card.innerHTML = \`
                    <div class="chart-header">
                        <div class="chart-title">\${chartSpec.chartTitle || chartSpec.title}</div>
                        <div class="chart-hint">Click item to filter</div>
                    </div>
                    <div class="chart-wrapper"><canvas id="canvas-\${chartSpec.id}"></canvas></div>
                \`;
                chartsDiv.appendChild(card);
            });
            updateDashboard();
        }

        function updateDashboard() {
            const dataToUse = currentFilter ? rawData.filter(r => String(r[currentFilter.field]) === currentFilter.value) : rawData;
            
            // Update Filter Bar
            const fb = document.getElementById('filterBar');
            if (currentFilter) {
                fb.style.display = 'flex';
                document.getElementById('filterText').innerText = \`\${currentFilter.field} = "\${currentFilter.value}" (\${dataToUse.length.toLocaleString()} matching records)\`;
            } else {
                fb.style.display = 'none';
            }

            // Update KPIs
            const kpisDiv = document.getElementById('kpis');
            kpisDiv.innerHTML = '';
            page.kpis.forEach(kpi => {
                const val = aggregateKpi(dataToUse, kpi);
                const formatVal = formatNumber(val);
                kpisDiv.innerHTML += \`<div class="kpi-card">
                    <div class="kpi-label">\${kpi.label}</div>
                    <div class="kpi-value">\${formatVal}</div>
                    <div class="kpi-sub">\${kpi.agg.toUpperCase()} aggregation</div>
                </div>\`;
            });

            // Update Charts
            page.charts.forEach(chartSpec => {
                const chartData = aggregateChart(dataToUse, chartSpec);
                
                const cardEl = document.getElementById('card-' + chartSpec.id);
                if (chartData.length === 0 || chartData.every(d => d.y === 0)) {
                    if (cardEl) cardEl.style.display = 'none';
                    return;
                } else {
                    if (cardEl) cardEl.style.display = 'block';
                }

                if (chartSpec.type === 'bar' || chartSpec.type === 'pie') {
                    chartData.sort((a, b) => b.y - a.y);
                }
                
                // Limit to top 15 categories for clean visual display
                const displayData = chartData.slice(0, 15);
                const labels = displayData.map(d => d.x);
                const data = displayData.map(d => d.y);
                
                if (chartInstances[chartSpec.id]) {
                    chartInstances[chartSpec.id].data.labels = labels;
                    chartInstances[chartSpec.id].data.datasets[0].data = data;
                    chartInstances[chartSpec.id].update();
                } else {
                    const canvasEl = document.getElementById('canvas-' + chartSpec.id);
                    if (!canvasEl) return;
                    const ctx = canvasEl.getContext('2d');
                    const type = chartSpec.type === 'line' ? 'line' : (chartSpec.type === 'pie' ? 'pie' : 'bar');
                    
                    const backgroundColors = type === 'pie' 
                        ? COLORS.slice(0, data.length) 
                        : (type === 'line' ? 'rgba(37, 99, 235, 0.1)' : '#2563eb');
                    
                    chartInstances[chartSpec.id] = new Chart(ctx, {
                        type: type,
                        data: {
                            labels: labels,
                            datasets: [{
                                label: chartSpec.yAxisLabel || chartSpec.title || 'Value',
                                data: data,
                                backgroundColor: backgroundColors,
                                borderColor: type === 'line' ? '#2563eb' : (type === 'pie' ? '#ffffff' : '#1d4ed8'),
                                borderWidth: type === 'pie' ? 2 : 1,
                                fill: type === 'line',
                                tension: 0.3
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: { mode: 'index', intersect: false },
                            plugins: {
                                legend: { display: type === 'pie' },
                                tooltip: {
                                    callbacks: {
                                        label: function(context) {
                                            let label = context.dataset.label || '';
                                            if (label) label += ': ';
                                            if (context.parsed.y !== null && context.parsed.y !== undefined) {
                                                label += formatNumber(context.parsed.y);
                                            } else if (context.parsed !== null && context.parsed !== undefined) {
                                                label += formatNumber(context.parsed);
                                            }
                                            return label;
                                        }
                                    }
                                }
                            },
                            scales: type === 'pie' ? {} : {
                                x: { 
                                    title: { display: !!chartSpec.xAxisLabel, text: chartSpec.xAxisLabel },
                                    grid: { display: false },
                                    ticks: {
                                        maxRotation: 45,
                                        minRotation: 0,
                                        callback: function(val, index) {
                                            const label = this.getLabelForValue(val);
                                            return label && label.length > 15 ? label.substr(0, 15) + '…' : label;
                                        }
                                    }
                                },
                                y: { 
                                    title: { display: !!chartSpec.yAxisLabel, text: chartSpec.yAxisLabel },
                                    beginAtZero: true,
                                    ticks: {
                                        callback: function(value) {
                                            return formatNumber(value);
                                        }
                                    }
                                }
                            },
                            onClick: (e, elements) => {
                                if (elements.length > 0) {
                                    const index = elements[0].index;
                                    const xValue = chartInstances[chartSpec.id].data.labels[index];
                                    if (currentFilter && currentFilter.field === chartSpec.x && currentFilter.value === String(xValue)) {
                                        currentFilter = null;
                                    } else {
                                        currentFilter = { field: chartSpec.x, value: String(xValue) };
                                    }
                                    updateDashboard();
                                }
                            }
                        }
                    });
                }
            });
        }
    </script>
</body>
</html>`;

  return Buffer.from(html, 'utf-8');
}
