import fs from 'fs';

const code = fs.readFileSync('server.ts', 'utf8');

const apiCode = `
app.get('/api/jobs', (req, res) => {
  const email = req.query.email;
  const token = req.headers.authorization?.split(' ')[1];
  if (!email || !token) return res.status(401).json({ error: 'Unauthorized' });
  
  // Note: in a real app, verify the access token belongs to the email.
  // We trust it for this prototype.
  
  const userJobs = Array.from(jobs.values())
    .filter(j => j.email === email)
    .map(j => ({
      id: j.id,
      fileName: j.fileName,
      status: j.status,
      timestamp: j.id // we can just use id as a rough sort, but let's add timestamp
    }));
    
  res.json(userJobs);
});

app.get('/api/job/:jobId', (req, res) => {
  const { jobId } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  const reqToken = req.query.token || req.headers['x-job-token'];
  
  const job = jobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Not found' });
  
  if (job.jobToken !== reqToken) return res.status(401).json({ error: 'Unauthorized' });
  
  // Exclude buffers for the JSON response
  const { originalBuffer, reportPdf, reportHtml, ...safeJob } = job;
  res.json(safeJob);
});
`;

if (!code.includes('app.get(\'/api/jobs\'')) {
  fs.writeFileSync('server.ts', code.replace('app.get(\'/api/job/:jobId/stream\'', apiCode + '\napp.get(\'/api/job/:jobId/stream\''));
}
