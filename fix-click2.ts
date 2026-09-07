import fs from 'fs';
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

code = code.replace(
  'onClick={(_, index) => { const entry = chartData[index]; handleChartClick(chart, { activePayload: [{ payload: entry }] }); }}',
  'onClick={(entry) => handleChartClick(chart, { activePayload: [{ payload: entry }] })}'
);

fs.writeFileSync('src/components/DashboardView.tsx', code);
