import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'const accessToken = req.body.accessToken;',
  'const accessToken = req.body.accessToken;\n    const analysisMode = req.body.analysisMode || \'detailed\';'
).replace(
  'email,\n      accessToken,',
  'email,\n      accessToken,\n      analysisMode,'
).replace(
  'const { cleanedData, log } = applyCleaningPlan(rawData, cleaningPlan);\n  job.cleanedData = cleanedData;\n  job.cleaningLog = log;',
  'const { cleanedData, log } = applyCleaningPlan(rawData, cleaningPlan);\n  job.cleanedData = cleanedData;\n  job.cleaningLog = log;\n  job.dataQuality = { totalRecords: rawData.length, rowsExcluded: rawData.length - cleanedData.length };'
).replace(
  'res.write(`event: spec\\ndata: ${JSON.stringify({ spec: job.dashboardSpec, data: job.cleanedData })}\\n\\n`);',
  'res.write(`event: spec\\ndata: ${JSON.stringify({ spec: job.dashboardSpec, data: job.cleanedData, stats: job.stats, dataQuality: job.dataQuality })}\\n\\n`);'
).replace(
  'sendEvent(job.id, \'spec\', { spec: dashboardSpec, data: job.cleanedData });',
  'sendEvent(job.id, \'spec\', { spec: dashboardSpec, data: job.cleanedData, stats: job.stats, dataQuality: job.dataQuality });'
);

fs.writeFileSync('server.ts', code);
