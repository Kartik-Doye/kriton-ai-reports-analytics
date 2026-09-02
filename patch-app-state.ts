import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'const [cleanedData, setCleanedData] = useState<any[] | null>(null);',
  'const [cleanedData, setCleanedData] = useState<any[] | null>(null);\n  const [dataQuality, setDataQuality] = useState<any>(null);'
).replace(
  'setDashboardSpec(data.spec);\n        setCleanedData(data.data);',
  'setDashboardSpec(data.spec);\n        setCleanedData(data.data);\n        setDataQuality(data.dataQuality);'
).replace(
  'setCleanedData(null);',
  'setCleanedData(null);\n    setDataQuality(null);'
).replace(
  'DashboardView spec={dashboardSpec} data={cleanedData}',
  'DashboardView spec={dashboardSpec} data={cleanedData} dataQuality={dataQuality}'
);

fs.writeFileSync('src/App.tsx', code);
