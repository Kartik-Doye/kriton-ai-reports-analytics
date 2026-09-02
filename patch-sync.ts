import fs from 'fs';

const code = fs.readFileSync('server.ts', 'utf8');
const syncCode = `
setInterval(() => {
  for (const job of jobs.values()) {
    saveJobToDisk(job);
  }
}, 5000);
`;

if (!code.includes('setInterval(() => {\\n  for (const job of jobs.values()) {')) {
  fs.writeFileSync('server.ts', code.replace('const emailRateLimit = new Map<string, number>();', 'const emailRateLimit = new Map<string, number>();\n' + syncCode));
}
