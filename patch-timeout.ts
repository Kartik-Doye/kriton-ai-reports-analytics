import fs from 'fs';
const code = fs.readFileSync('server.ts', 'utf8');
const patched = code.replace(/setTimeout\(\(\) => \{\n\s*jobs.delete\(jobId\);\n\s*clients.delete\(jobId\);\n\s*\}, 60 \* 60 \* 1000\); \/\/ 1 hour memory cleanup\n/, '');
fs.writeFileSync('server.ts', patched);
