import fs from 'fs';
const code = fs.readFileSync('server.ts', 'utf8');
const patched = code.replace(
  'jobs.delete(jobId);',
  'jobs.delete(jobId);\n  try { fs.unlinkSync(path.join(DATA_DIR, `${jobId}.json`)); } catch(e) {}'
);
fs.writeFileSync('server.ts', patched);
