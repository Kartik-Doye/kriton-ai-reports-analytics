import fs from 'fs';
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

code = code.replace(
  'const handleChartClick = (e: any, chartSpec: any) => {',
  'const handleChartClick = (chartSpec: any, e: any) => {'
);

code = code.replace(
  'onClick={(e) => handleChartClick(chart, { payload: e })}',
  'onClick={(_, index) => { const entry = chartData[index]; handleChartClick(chart, { activePayload: [{ payload: entry }] }); }}'
);

fs.writeFileSync('src/components/DashboardView.tsx', code);
