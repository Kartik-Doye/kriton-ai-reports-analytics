import { DashboardSpec } from '../types.js';

export function generateInteractiveHtml(spec: DashboardSpec, data: any[]): Buffer {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive Dashboard Export</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --bg: #f8fafc;
            --surface: #ffffff;
            --text: #0f172a;
            --text-muted: #64748b;
            --border: #e2e8f0;
            --primary: #3b82f6;
            --primary-light: #eff6ff;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            padding: 32px;
            line-height: 1.5;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        .header {
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        h1 { font-size: 24px; font-weight: 700; }
        .filter-bar {
            background-color: var(--primary-light);
            color: var(--primary);
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 24px;
            display: none;
            cursor: pointer;
            align-items: center;
            border: 1px solid #bfdbfe;
            transition: all 0.2s;
        }
        .filter-bar:hover { background-color: #dbeafe; }
        .kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 32px;
        }
        .kpi-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .kpi-label { font-size: 13px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .kpi-value { font-size: 28px; font-weight: 700; margin-top: 8px; color: var(--text); }
        .chart-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
            gap: 24px;
        }
        .chart-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            display: flex;
            flex-direction: column;
        }
        .chart-title { font-size: 16px; font-weight: 600; margin-bottom: 20px; }
        .chart-wrapper { position: relative; height: 300px; width: 100%; }
        
        @media (max-width: 768px) {
            .chart-grid { grid-template-columns: 1fr; }
            body { padding: 16px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 id="pageTitle">Dashboard</h1>
        </div>
        
        <div id="filterBar" class="filter-bar" onclick="clearFilter()">
            <span>Active Filter: <span id="filterText"></span></span>
            <span style="margin-left:auto; font-size:12px;">(Click to clear)</span>
        </div>
        
        <div class="kpi-grid" id="kpis"></div>
        <div class="chart-grid" id="charts"></div>
    </div>

    <script>
        const spec = ${JSON.stringify(spec)};
        const rawData = ${JSON.stringify(data)};
        
        let currentFilter = null;
        const chartInstances = {};
        
        const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
        
        const page = spec.pages && spec.pages.length > 0 ? spec.pages[0] : null;
        
        if (page) {
            document.getElementById('pageTitle').innerText = page.title || 'Interactive Dashboard Export';
            initDashboard();
        } else {
            document.getElementById('pageTitle').innerText = 'No dashboard data available.';
        }
        
        function formatNumber(num) {
            return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(num);
        }

        function clearFilter() {
            currentFilter = null;
            updateDashboard();
        }

        function aggregateKpi(dataToUse, kpiSpec) {
            let sum = 0, count = 0, min = Infinity, max = -Infinity;
            dataToUse.forEach(row => {
                const yVal = Number(row[kpiSpec.field]) || 0;
                sum += yVal; count++;
                min = Math.min(min, yVal); max = Math.max(max, yVal);
            });
            if (kpiSpec.agg === 'sum') return sum;
            if (kpiSpec.agg === 'avg') return count ? sum / count : 0;
            if (kpiSpec.agg === 'count') return count;
            if (kpiSpec.agg === 'max') return count ? max : 0;
            if (kpiSpec.agg === 'min') return count ? min : 0;
            return 0;
        }

        function aggregateChart(dataToUse, chartSpec) {
            const map = {};
            dataToUse.forEach(row => {
                const xVal = String(row[chartSpec.x] || 'Unknown');
                const yVal = Number(row[chartSpec.y]) || 0;
                if (!map[xVal]) map[xVal] = { sum: 0, count: 0, min: Infinity, max: -Infinity };
                map[xVal].sum += yVal;
                map[xVal].count += 1;
                map[xVal].min = Math.min(map[xVal].min, yVal);
                map[xVal].max = Math.max(map[xVal].max, yVal);
            });
            return Object.entries(map).map(([x, stats]) => {
                let y = 0;
                if (chartSpec.agg === 'sum') y = stats.sum;
                if (chartSpec.agg === 'avg') y = stats.sum / stats.count;
                if (chartSpec.agg === 'count') y = stats.count;
                if (chartSpec.agg === 'max') y = stats.max;
                if (chartSpec.agg === 'min') y = stats.min;
                return { x, y };
            });
        }

        function initDashboard() {
            // Create DOM elements for charts once
            const chartsDiv = document.getElementById('charts');
            page.charts.forEach(chartSpec => {
                const card = document.createElement('div');
                card.className = 'chart-card';
                card.innerHTML = \`<div class="chart-title">\${chartSpec.chartTitle || chartSpec.title}</div>
                                  <div class="chart-wrapper"><canvas id="canvas-\${chartSpec.id}"></canvas></div>\`;
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
                document.getElementById('filterText').innerText = \`\${currentFilter.field} = \${currentFilter.value}\`;
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
                </div>\`;
            });

            // Update Charts
            page.charts.forEach(chartSpec => {
                const chartData = aggregateChart(dataToUse, chartSpec);
                // Simple sort by y descending for bar charts, or leave as is
                if (chartSpec.type === 'bar' || chartSpec.type === 'pie') {
                    chartData.sort((a,b) => b.y - a.y);
                }
                
                const labels = chartData.map(d => d.x);
                const data = chartData.map(d => d.y);
                
                if (chartInstances[chartSpec.id]) {
                    chartInstances[chartSpec.id].data.labels = labels;
                    chartInstances[chartSpec.id].data.datasets[0].data = data;
                    chartInstances[chartSpec.id].update();
                } else {
                    const ctx = document.getElementById('canvas-' + chartSpec.id).getContext('2d');
                    const type = chartSpec.type === 'line' ? 'line' : (chartSpec.type === 'pie' ? 'pie' : 'bar');
                    
                    const backgroundColors = type === 'pie' ? COLORS.slice(0, data.length) : COLORS[0];
                    
                    chartInstances[chartSpec.id] = new Chart(ctx, {
                        type: type,
                        data: {
                            labels: labels,
                            datasets: [{
                                label: chartSpec.yAxisLabel || chartSpec.y,
                                data: data,
                                backgroundColor: type === 'line' ? 'rgba(59, 130, 246, 0.1)' : (type === 'pie' ? COLORS : COLORS[0]),
                                borderColor: type === 'line' ? COLORS[0] : (type === 'pie' ? '#fff' : COLORS[0]),
                                borderWidth: 1,
                                fill: type === 'line',
                                tension: 0.3
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            interaction: { mode: 'index', intersect: false },
                            plugins: {
                                legend: { display: type === 'pie' || type === 'line' },
                                tooltip: {
                                    callbacks: {
                                        label: function(context) {
                                            let label = context.dataset.label || '';
                                            if (label) {
                                                label += ': ';
                                            }
                                            if (context.parsed.y !== null) {
                                                label += new Intl.NumberFormat('en-US').format(context.parsed.y);
                                            }
                                            return label;
                                        }
                                    }
                                }
                            },
                            scales: type === 'pie' ? {} : {
                                x: { 
                                    title: { display: !!chartSpec.xAxisLabel, text: chartSpec.xAxisLabel },
                                    grid: { display: false }
                                },
                                y: { 
                                    title: { display: !!chartSpec.yAxisLabel, text: chartSpec.yAxisLabel },
                                    beginAtZero: true
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
