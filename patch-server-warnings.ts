import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'const rawData = parseFile(job.originalBuffer, job.fileName);',
  'const { data: rawData, warnings: parseWarnings } = parseFile(job.originalBuffer, job.fileName);\n  if (parseWarnings && parseWarnings.length > 0) {\n    parseWarnings.forEach(w => sendEvent(job.id, \'log\', { text: `Warning: ${w}` }));\n  }'
);

fs.writeFileSync('server.ts', code);
