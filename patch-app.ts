import fs from 'fs';
const code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `
  const handleRestoreJob = (id: string, token: string, status: string) => {
    setJobId(id);
    setJobToken(token);
    setJobStatus(status as any);
    setLogs(['Restoring session...']);
    setStartTime(Date.now());
    setEndTime(null);
  };
`;

const patched = code.replace(
  '<UploadForm onSuccess={handleUploadSuccess} />', 
  '<UploadForm onSuccess={handleUploadSuccess} onRestore={handleRestoreJob} />'
).replace(
  'const handleJobComplete = () => {',
  replacement + '\n  const handleJobComplete = () => {'
);
fs.writeFileSync('src/App.tsx', patched);
