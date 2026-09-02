import fs from 'fs';
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const validationCode = `
  // Filter out charts that reference non-existent columns or mismatch chart types
  const schemaKeys = data.length > 0 ? Object.keys(data[0]) : [];
  
  const validateChart = (chart: any) => {
    if (!schemaKeys.includes(chart.x) || (chart.y && !schemaKeys.includes(chart.y))) {
      return false; // Column does not exist
    }
    
    // Check cardinality for pie charts
    if (chart.type === 'pie') {
      const uniqueValues = new Set(data.map(r => String(r[chart.x]))).size;
      if (uniqueValues > 10) {
        chart.type = 'bar'; // Auto-convert to bar chart if cardinality is too high
      }
    }
    return true;
  };

  const activePageData = pages.find(p => p.id === activeCategoryId) || pages[0] || { kpis: [], charts: [], insights: [], id: '', title: '' };
  
  // Create a validated copy
  const validatedPageData = {
    ...activePageData,
    charts: (activePageData.charts || []).filter(validateChart)
  };
`;

code = code.replace(
  "const activePageData = pages.find(p => p.id === activeCategoryId) || pages[0] || { kpis: [], charts: [], insights: [], id: '', title: '' };",
  validationCode
).replace(
  "activePageData.kpis.map",
  "validatedPageData.kpis.map"
).replace(
  "activePageData.insights.map",
  "validatedPageData.insights.map"
).replace(
  "activePageData.charts.map",
  "validatedPageData.charts.map"
).replace(
  "activePageData.insights.length",
  "validatedPageData.insights.length"
);

fs.writeFileSync('src/components/DashboardView.tsx', code);
