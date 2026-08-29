const fs = require('fs');
let viewCode = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

viewCode = viewCode.replace(
  /const \[selectedColumns, setSelectedColumns\] = useState<string\[\]>\(allColumns\.slice\(0, 10\)\);/,
  "const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set(allColumns.slice(0, 10)));"
);

viewCode = viewCode.replace(
  /selectedColumns\.forEach\(c => exportRow\[c\] = row\[c\]\);/,
  "Array.from(selectedColumns).forEach(c => exportRow[c] = row[c]);"
);

fs.writeFileSync('src/components/DashboardView.tsx', viewCode);

let serverCode = fs.readFileSync('server.ts', 'utf8');
serverCode = serverCode.replace(
  /job\.reportPdf = await generateReportPdf\(job\.reportText, job\.dashboardSpec, job\.cleanedData\);/,
  "job.reportPdf = await generateReportPdf(job.reportText!, typeof job.dashboardSpec === 'string' ? JSON.parse(job.dashboardSpec) : job.dashboardSpec, job.cleanedData);"
);
fs.writeFileSync('server.ts', serverCode);
