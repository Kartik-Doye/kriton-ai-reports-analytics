const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Update generateReportPdf call
code = code.replace(
  /job\.reportPdf = await generateReportPdf\(job\.reportText, job\.dashboardImage\);/,
  "job.reportPdf = await generateReportPdf(job.reportText, job.dashboardSpec, job.cleanedData);"
);

code = code.replace(
  /if \(job\.dashboardImage\) \{[\s\S]*?\} else \{[\s\S]*?clients\.delete\(job\.id\);\n    \}\), 300000\);\n  \}/,
  "job.reportPdf = await generateReportPdf(job.reportText, job.dashboardSpec, job.cleanedData);\n  job.status = 'complete';\n  sendEvent(job.id, 'status', { status: job.status });\n  clients.delete(job.id);"
);

fs.writeFileSync('server.ts', code);
