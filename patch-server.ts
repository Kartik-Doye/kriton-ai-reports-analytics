import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  "sendEvent(job.id, 'spec', { spec: dashboardSpec, data: cleanedData });",
  "sendEvent(job.id, 'spec', { spec: dashboardSpec, data: cleanedData, stats: job.stats, dataQuality: job.dataQuality, cleaningLog: job.cleaningLog });"
).replace(
  "res.write(`event: spec\\ndata: ${JSON.stringify({ spec: job.dashboardSpec, data: job.cleanedData, stats: job.stats, dataQuality: job.dataQuality })}\\n\\n`);",
  "res.write(`event: spec\\ndata: ${JSON.stringify({ spec: job.dashboardSpec, data: job.cleanedData, stats: job.stats, dataQuality: job.dataQuality, cleaningLog: job.cleaningLog })}\\n\\n`);"
);

fs.writeFileSync('server.ts', code);
