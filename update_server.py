import re

with open('server.ts', 'r') as f:
    content = f.read()

# Update route
old_route = """app.post('/api/job/:jobId/email', async (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).send('Job not found');
  if (job.status !== 'complete') return res.status(400).send('Job not complete');

  try {
    await sendEmail(job);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});"""

new_route = """app.post('/api/job/:jobId/email', async (req, res) => {
  const { jobId } = req.params;
  const options = req.body;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).send('Job not found');
  if (job.status !== 'complete') return res.status(400).send('Job not complete');

  try {
    await sendEmail(job, options);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});"""

content = content.replace(old_route, new_route)

# Update sendEmail
old_send = """async function sendEmail(job: PipelineJob) {"""
new_send = """async function sendEmail(job: PipelineJob, options: { to: string, cc?: string, bcc?: string, subject?: string, body?: string }) {"""
content = content.replace(old_send, new_send)

# Update mailOptions in sendEmail
old_mailOptions = """  const mailOptions = {
    to: job.email,
    subject: 'Your Kriton Analytics Package',
    html: '<p>Hello,</p><p>Your automated analytics package is ready. Please find attached:</p><ul><li>Cleaned Dataset (CSV)</li><li>Dashboard Export (PNG)</li><li>Narrative Report (PDF)</li><li>Data Profiling Report (HTML)</li></ul>',
    attachments: ["""

new_mailOptions = """  const mailOptions: any = {
    to: options.to || job.email,
    subject: options.subject || 'Your Kriton Analytics Package',
    html: options.body || '<p>Hello,</p><p>Your automated analytics package is ready. Please find attached:</p><ul><li>Cleaned Dataset (CSV)</li><li>Dashboard Export (PNG)</li><li>Narrative Report (PDF)</li><li>Data Profiling Report (HTML)</li></ul>',
    attachments: ["""

content = content.replace(old_mailOptions, new_mailOptions)

# Add cc and bcc if present
# But we can just add it below "html" in new_mailOptions
new_mailOptions_with_cc = """  const mailOptions: any = {
    to: options.to || job.email,
    subject: options.subject || 'Your Kriton Analytics Package',
    html: options.body || '<p>Hello,</p><p>Your automated analytics package is ready. Please find attached:</p><ul><li>Cleaned Dataset (CSV)</li><li>Dashboard Export (PNG)</li><li>Narrative Report (PDF)</li><li>Data Profiling Report (HTML)</li></ul>',
    ...(options.cc ? { cc: options.cc } : {}),
    ...(options.bcc ? { bcc: options.bcc } : {}),
    attachments: ["""
content = content.replace(new_mailOptions, new_mailOptions_with_cc)

with open('server.ts', 'w') as f:
    f.write(content)

