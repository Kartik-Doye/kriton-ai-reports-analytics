/**
 * Standalone Data Profiling Report Generator (Pandas Profiling / YData Profiling style)
 * Generates an accessible, fully self-contained HTML report with statistical analysis,
 * variable breakdowns, missing value analysis, distribution summaries, and sample records.
 */

export function generateDataProfileHtml(stats: any, data: any[] = []): Buffer {
  const rowCount = data.length;
  const colCount = data.length > 0 ? Object.keys(data[0]).length : Object.keys(stats || {}).length;
  const columns = data.length > 0 ? Object.keys(data[0]) : Object.keys(stats || {});

  // Compute comprehensive metrics per column
  let totalCells = rowCount * colCount;
  let totalMissingCells = 0;

  interface ColProfile {
    name: string;
    type: 'numeric' | 'categorical' | 'datetime' | 'boolean' | 'text';
    nullCount: number;
    nullPct: number;
    uniqueCount: number;
    uniquePct: number;
    // Numeric metrics
    min?: number | null;
    max?: number | null;
    mean?: number | null;
    median?: number | null;
    stdDev?: number | null;
    zerosCount?: number;
    zerosPct?: number;
    q25?: number | null;
    q75?: number | null;
    // Categorical metrics
    topValues?: { value: string; count: number; pct: number }[];
    // Sample values
    sampleValues?: string[];
  }

  const colProfiles: ColProfile[] = [];

  columns.forEach(col => {
    let nullCount = 0;
    const values: any[] = [];
    const valFreqMap: Record<string, number> = {};

    data.forEach(row => {
      const v = row[col];
      if (v === null || v === undefined || v === '') {
        nullCount++;
      } else {
        values.push(v);
        const strKey = String(v);
        valFreqMap[strKey] = (valFreqMap[strKey] || 0) + 1;
      }
    });

    totalMissingCells += nullCount;
    const nonNullCount = values.length;
    const uniqueCount = Object.keys(valFreqMap).length;
    const uniquePct = nonNullCount > 0 ? Math.round((uniqueCount / nonNullCount) * 1000) / 10 : 0;
    const nullPct = rowCount > 0 ? Math.round((nullCount / rowCount) * 1000) / 10 : 0;

    // Inferred type
    let numCount = 0;
    let dateCount = 0;
    let boolCount = 0;

    const sampleSlice = values.slice(0, 100);
    sampleSlice.forEach(v => {
      if (typeof v === 'number' || (!isNaN(Number(v)) && String(v).trim() !== '')) numCount++;
      if (typeof v === 'boolean' || v === 'true' || v === 'false') boolCount++;
      if (typeof v === 'string' && v.length >= 6 && !isNaN(Date.parse(v))) dateCount++;
    });

    let detectedType: ColProfile['type'] = 'categorical';
    if (numCount >= Math.max(1, Math.floor(sampleSlice.length * 0.7))) {
      detectedType = 'numeric';
    } else if (boolCount >= Math.max(1, Math.floor(sampleSlice.length * 0.7))) {
      detectedType = 'boolean';
    } else if (dateCount >= Math.max(1, Math.floor(sampleSlice.length * 0.7))) {
      detectedType = 'datetime';
    }

    const profile: ColProfile = {
      name: col,
      type: detectedType,
      nullCount,
      nullPct,
      uniqueCount,
      uniquePct,
      sampleValues: values.slice(0, 5).map(v => String(v))
    };

    if (detectedType === 'numeric') {
      const numVals = values.map(v => Number(v)).filter(n => !isNaN(n)).sort((a, b) => a - b);
      if (numVals.length > 0) {
        const sum = numVals.reduce((acc, v) => acc + v, 0);
        const mean = sum / numVals.length;
        const min = numVals[0];
        const max = numVals[numVals.length - 1];
        const median = numVals[Math.floor(numVals.length / 2)];
        const q25 = numVals[Math.floor(numVals.length * 0.25)];
        const q75 = numVals[Math.floor(numVals.length * 0.75)];

        // Variance & StdDev
        const sqDiffs = numVals.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0);
        const stdDev = Math.sqrt(sqDiffs / numVals.length);

        const zeros = numVals.filter(v => v === 0).length;

        profile.min = Math.round(min * 100) / 100;
        profile.max = Math.round(max * 100) / 100;
        profile.mean = Math.round(mean * 100) / 100;
        profile.median = Math.round(median * 100) / 100;
        profile.q25 = Math.round(q25 * 100) / 100;
        profile.q75 = Math.round(q75 * 100) / 100;
        profile.stdDev = Math.round(stdDev * 100) / 100;
        profile.zerosCount = zeros;
        profile.zerosPct = Math.round((zeros / numVals.length) * 1000) / 10;
      }
    } else {
      // Categorical frequency breakdown
      const sortedFreq = Object.entries(valFreqMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([value, count]) => ({
          value,
          count,
          pct: nonNullCount > 0 ? Math.round((count / nonNullCount) * 1000) / 10 : 0
        }));
      profile.topValues = sortedFreq;
    }

    colProfiles.push(profile);
  });

  const missingCellsPct = totalCells > 0 ? Math.round((totalMissingCells / totalCells) * 1000) / 10 : 0;

  // Duplicate rows detection
  let duplicateRowCount = 0;
  if (data.length > 0) {
    const seenRows = new Set<string>();
    data.forEach(r => {
      const hash = JSON.stringify(r);
      if (seenRows.has(hash)) {
        duplicateRowCount++;
      } else {
        seenRows.add(hash);
      }
    });
  }
  const duplicatePct = rowCount > 0 ? Math.round((duplicateRowCount / rowCount) * 1000) / 10 : 0;

  // Approximate memory size in KB
  const approxBytes = JSON.stringify(data).length;
  const memorySizeStr = approxBytes < 1024 * 1024 
    ? `${(approxBytes / 1024).toFixed(1)} KB` 
    : `${(approxBytes / (1024 * 1024)).toFixed(2)} MB`;

  // First 8 rows for sample table
  const sampleRows = data.slice(0, 8);

  const numCols = colProfiles.filter(c => c.type === 'numeric').length;
  const catCols = colProfiles.filter(c => c.type === 'categorical').length;
  const dateCols = colProfiles.filter(c => c.type === 'datetime').length;
  const boolCols = colProfiles.filter(c => c.type === 'boolean').length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Data Profiling Report (Technical)</title>
  <style>
    :root {
      --bg: #f8fafc;
      --surface: #ffffff;
      --surface-subtle: #f1f5f9;
      --border: #e2e8f0;
      --border-dark: #cbd5e1;
      --text: #0f172a;
      --text-muted: #64748b;
      --primary: #2563eb;
      --primary-light: #eff6ff;
      --success: #16a34a;
      --success-light: #f0fdf4;
      --warning: #d97706;
      --warning-light: #fffbeb;
      --danger: #dc2626;
      --danger-light: #fef2f2;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 32px 20px;
    }
    .container {
      max-width: 1280px;
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
    }
    .header-title h1 {
      font-size: 22px;
      font-weight: 700;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 3px 8px;
      border-radius: 6px;
    }
    .badge-primary { background: var(--primary-light); color: var(--primary); }
    .badge-numeric { background: #e0f2fe; color: #0369a1; }
    .badge-cat { background: #f3e8ff; color: #7e22ce; }
    .badge-date { background: #fef3c7; color: #b45309; }
    .badge-bool { background: #dcfce7; color: #15803d; }
    .badge-warning { background: var(--warning-light); color: var(--warning); }
    
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text);
      margin: 28px 0 14px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px 20px;
    }
    .stat-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: var(--text);
      margin-top: 4px;
    }
    .stat-sub {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    
    .variables-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }
    .var-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 20px 24px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
    .var-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--surface-subtle);
    }
    .var-name {
      font-size: 16px;
      font-weight: 700;
      color: var(--text);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .var-body {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
    }
    .metrics-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .metrics-table td {
      padding: 6px 0;
      border-bottom: 1px dashed var(--border);
    }
    .metrics-table td.label {
      color: var(--text-muted);
      font-weight: 500;
    }
    .metrics-table td.val {
      text-align: right;
      font-weight: 600;
      color: var(--text);
    }
    
    .freq-bar-container {
      margin-top: 4px;
    }
    .freq-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      margin-bottom: 4px;
    }
    .freq-label {
      max-width: 140px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 500;
    }
    .freq-track {
      flex: 1;
      height: 8px;
      background: var(--surface-subtle);
      border-radius: 4px;
      margin: 0 10px;
      overflow: hidden;
    }
    .freq-fill {
      height: 100%;
      background: var(--primary);
      border-radius: 4px;
    }
    .freq-count {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      min-width: 45px;
      text-align: right;
    }

    .table-wrapper {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow-x: auto;
      margin-top: 10px;
    }
    table.data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    table.data-table th {
      background: var(--surface-subtle);
      padding: 10px 14px;
      font-weight: 600;
      text-align: left;
      border-bottom: 1px solid var(--border);
      color: var(--text);
      white-space: nowrap;
    }
    table.data-table td {
      padding: 8px 14px;
      border-bottom: 1px solid var(--border);
      color: var(--text);
      white-space: nowrap;
    }
    table.data-table tr:last-child td {
      border-bottom: none;
    }

    .footer {
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid var(--border);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-title">
        <h1>Full Data Profiling Report <span class="badge badge-primary">Technical Analysis</span></h1>
        <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Comprehensive statistical dataset characterization and validation</p>
      </div>
      <div style="text-align: right;">
        <span class="badge badge-primary">Self-Contained</span>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">Local Browser Execution</div>
      </div>
    </div>

    <!-- Section 1: Overview -->
    <div class="section-title">Overview & Statistics</div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Observations</div>
        <div class="stat-value">${rowCount.toLocaleString()}</div>
        <div class="stat-sub">Rows analyzed</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Variables</div>
        <div class="stat-value">${colCount}</div>
        <div class="stat-sub">${numCols} Numeric, ${catCols} Categorical${dateCols > 0 ? `, ${dateCols} Date` : ''}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Missing Cells</div>
        <div class="stat-value" style="color: ${missingCellsPct > 10 ? 'var(--danger)' : 'inherit'};">
          ${totalMissingCells.toLocaleString()} <span style="font-size: 14px; font-weight: 500;">(${missingCellsPct}%)</span>
        </div>
        <div class="stat-sub">${totalMissingCells === 0 ? 'Zero missing values' : 'Cleaned / imputed'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Duplicate Rows</div>
        <div class="stat-value">${duplicateRowCount.toLocaleString()} <span style="font-size: 14px; font-weight: 500;">(${duplicatePct}%)</span></div>
        <div class="stat-sub">Identical records</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Memory Footprint</div>
        <div class="stat-value">${memorySizeStr}</div>
        <div class="stat-sub">JSON in-memory size</div>
      </div>
    </div>

    <!-- Section 2: Variables -->
    <div class="section-title">Variable Profiling (${colProfiles.length} Columns)</div>
    <div class="variables-grid">
      ${colProfiles.map(col => {
        const typeBadge = col.type === 'numeric' 
          ? '<span class="badge badge-numeric">Numeric</span>'
          : col.type === 'datetime'
          ? '<span class="badge badge-date">DateTime</span>'
          : col.type === 'boolean'
          ? '<span class="badge badge-bool">Boolean</span>'
          : '<span class="badge badge-cat">Categorical</span>';

        return `
        <div class="var-card">
          <div class="var-header">
            <div class="var-name">
              <strong>${col.name}</strong>
              ${typeBadge}
            </div>
            <div style="font-size: 12px; color: var(--text-muted);">
              Distinct: <strong>${col.uniqueCount}</strong> (${col.uniquePct}%) | 
              Missing: <strong>${col.nullCount}</strong> (${col.nullPct}%)
            </div>
          </div>

          <div class="var-body">
            <div>
              <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase;">
                Properties & Quantiles
              </div>
              <table class="metrics-table">
                <tr><td class="label">Distinct Values</td><td class="val">${col.uniqueCount}</td></tr>
                <tr><td class="label">Missing Count</td><td class="val">${col.nullCount} (${col.nullPct}%)</td></tr>
                ${col.type === 'numeric' ? `
                  <tr><td class="label">Minimum</td><td class="val">${col.min?.toLocaleString()}</td></tr>
                  <tr><td class="label">Maximum</td><td class="val">${col.max?.toLocaleString()}</td></tr>
                  <tr><td class="label">Mean</td><td class="val">${col.mean?.toLocaleString()}</td></tr>
                  <tr><td class="label">Median (Q50)</td><td class="val">${col.median?.toLocaleString()}</td></tr>
                  <tr><td class="label">Q25 - Q75</td><td class="val">${col.q25?.toLocaleString()} - ${col.q75?.toLocaleString()}</td></tr>
                  <tr><td class="label">Std Deviation</td><td class="val">${col.stdDev?.toLocaleString()}</td></tr>
                  <tr><td class="label">Zeros Count</td><td class="val">${col.zerosCount} (${col.zerosPct}%)</td></tr>
                ` : `
                  <tr><td class="label">Sample Values</td><td class="val">${(col.sampleValues || []).slice(0, 3).join(', ') || 'N/A'}</td></tr>
                `}
              </table>
            </div>

            <div>
              <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 8px; text-transform: uppercase;">
                ${col.type === 'numeric' ? 'Distribution & Range' : 'Common Frequency Breakdown'}
              </div>
              ${col.topValues && col.topValues.length > 0 ? `
                <div class="freq-bar-container">
                  ${col.topValues.map(tv => `
                    <div class="freq-row">
                      <span class="freq-label" title="${tv.value}">${tv.value || '(empty)'}</span>
                      <div class="freq-track">
                        <div class="freq-fill" style="width: ${Math.min(100, Math.max(4, tv.pct))}%;"></div>
                      </div>
                      <span class="freq-count">${tv.count} (${tv.pct}%)</span>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div style="background: var(--surface-subtle); padding: 14px; border-radius: 8px; font-size: 12px; color: var(--text-muted); line-height: 1.6;">
                  <div>Range: <strong>${col.min}</strong> to <strong>${col.max}</strong></div>
                  <div>Mean: <strong>${col.mean}</strong> (Std: <strong>${col.stdDev}</strong>)</div>
                  <div style="margin-top: 6px;">Interquartile Range: [${col.q25}, ${col.q75}]</div>
                </div>
              `}
            </div>
          </div>
        </div>
        `;
      }).join('')}
    </div>

    <!-- Section 3: Sample Records -->
    <div class="section-title">Sample Data Records (First ${sampleRows.length} Rows)</div>
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 40px;">#</th>
            ${columns.map(c => `<th>${c}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${sampleRows.map((row, idx) => `
            <tr>
              <td style="color: var(--text-muted); font-weight: 600;">${idx + 1}</td>
              ${columns.map(c => {
                const val = row[c];
                return `<td>${val !== null && val !== undefined ? String(val) : '<span style="color: var(--text-muted); font-style: italic;">null</span>'}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="footer">
      Generated automatically by Kriton Analytics Platform • Self-contained standalone technical profile • Open in any browser
    </div>
  </div>
</body>
</html>`;

  return Buffer.from(html, 'utf-8');
}
