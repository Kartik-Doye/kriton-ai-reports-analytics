import 'dotenv/config';
import express from 'express';
import path from 'path';
import multer from 'multer';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import { PipelineJob, CleaningPlan, DashboardSpec } from './src/types.js';
import { parseFile, applyCleaningPlan, computeStats, sampleData } from './src/utils/data-processing.js';
import { generateReportPdf } from './src/utils/pdf-generator.js';
import { generateInteractiveHtml } from './src/utils/html-generator.js';

import * as archiverModule from 'archiver';
const archiver = (archiverModule as any).default || archiverModule;

// Setup basic server
const app = express();
const PORT = 3000;
app.use(express.json({ limit: '50mb' })); // for receiving the base64 dashboard image

// Retry helper for API calls
async function withRetry<T>(fn: () => Promise<T>, retries = 5, initialDelay = 2000): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const msg = String(error.message || error);
      const isRetryable = msg.includes('503') || msg.includes('429') || msg.includes('500') || msg.includes('UNAVAILABLE') || msg.includes('RESOURCE_EXHAUSTED') || error.status === 503 || error.status === 429;
      
      if (attempt >= retries || !isRetryable) {
        throw error;
      }
      const delay = initialDelay * Math.pow(2, attempt - 1);
      console.warn(`API call failed, retrying in ${delay}ms... (Attempt ${attempt}/${retries})`);
      console.error(error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("API call failed after retries.");
}

// Job store (in-memory for this session)
const jobs = new Map<string, PipelineJob>();
// SSE connections
const clients = new Map<string, express.Response>();

// File upload setup
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

// Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
});

const sendEvent = (jobId: string, event: string, data: any) => {
  const client = clients.get(jobId);
  if (client) {
    client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
};

app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const email = req.body.email;
    const accessToken = req.body.accessToken;
    if (!email) return res.status(400).json({ error: 'No email provided' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!['.csv', '.xls', '.xlsx'].includes(ext)) {
      return res.status(400).json({ error: 'Invalid file type. Please upload a .csv, .xls, or .xlsx file.' });
    }

    const jobId = crypto.randomUUID();
    jobs.set(jobId, {
      id: jobId,
      email,
      accessToken,
      fileName: req.file.originalname,
      originalBuffer: req.file.buffer,
      status: 'pending'
    });

    res.json({ jobId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/job/:jobId/stream', (req, res) => {
  const jobId = req.params.jobId;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).send('Job not found');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  clients.set(jobId, res);

  req.on('close', () => {
    clients.delete(jobId);
  });

  // Start the pipeline in background
  if (job.status === 'pending') {
    job.status = 'cleaning';
    runPipeline(job).catch(err => {
      console.error(err);
      job.status = 'error';
      sendEvent(jobId, 'error', { message: err.message });
      clients.delete(jobId);
    });
  }
});

app.post('/api/job/:jobId/dashboard-image', async (req, res) => {
  const jobId = req.params.jobId;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  job.dashboardImage = req.body.image; // data URL
  
  // Check if we are ready to send email
  if (job.status === 'waiting_for_dashboard' && job.reportText) {
    job.reportPdf = await generateReportPdf(job.reportText, job.dashboardImage);
    job.status = 'complete';
    sendEvent(jobId, 'status', { status: job.status });
    clients.delete(jobId);
  }
  
  res.json({ success: true });
});

app.get('/api/job/:jobId/download/:fileType', async (req, res) => {
  const { jobId, fileType } = req.params;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).send('Job not found');

  if (fileType === 'csv' && job.cleanedData) {
    const Papa = await import('papaparse');
    const csvStr = Papa.default.unparse(job.cleanedData);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="cleaned_data.csv"');
    res.send(csvStr);
  } else if (fileType === 'png' && job.dashboardImage) {
    const dashImageBase64 = job.dashboardImage.replace(/^data:image\/\w+;base64,/, '');
    const dashBuffer = Buffer.from(dashImageBase64, 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', 'attachment; filename="dashboard.png"');
    res.send(dashBuffer);
  } else if (fileType === 'pdf' && job.reportPdf) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="report.pdf"');
    res.send(job.reportPdf);
  } else if (fileType === 'html' && job.reportHtml) {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', 'attachment; filename="interactive_report.html"');
    res.send(job.reportHtml);
  } else if (fileType === 'zip' && job.cleanedData && job.dashboardImage && job.reportPdf) {
    const Papa = await import('papaparse');
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="analytics_package.zip"');

    archive.pipe(res);

    // CSV
    const csvStr = Papa.default.unparse(job.cleanedData);
    archive.append(csvStr, { name: 'cleaned_data.csv' });

    // PNG
    const dashImageBase64 = job.dashboardImage.replace(/^data:image\/\w+;base64,/, '');
    const dashBuffer = Buffer.from(dashImageBase64, 'base64');
    archive.append(dashBuffer, { name: 'dashboard.png' });

    // PDF
    archive.append(job.reportPdf, { name: 'report.pdf' });

    // HTML
    if (job.reportHtml) {
      archive.append(job.reportHtml, { name: 'interactive_report.html' });
    }

    archive.finalize();
  } else {
    res.status(404).send('File not ready or not found');
  }
});

app.post('/api/job/:jobId/chat', async (req, res) => {
  const { jobId } = req.params;
  const { message } = req.body;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).send('Job not found');

  try {
    const statsStr = JSON.stringify(job.stats || {}).substring(0, 5000);
    const schemaStr = job.cleanedData && job.cleanedData.length > 0 ? Object.keys(job.cleanedData[0]).join(', ') : '';
    const sampleStr = job.cleanedData ? JSON.stringify(job.cleanedData.slice(0, 5)) : '';
    
    const prompt = `You are an expert Data Analysis Assistant for the 'Kriton Analytics' platform.
    
Dataset Schema: ${schemaStr}
Basic Statistics: ${statsStr}
Data Sample (first 5 rows): ${sampleStr}

Please answer the user's question about their data based strictly on this context. Since you only see summary statistics and a small sample (to protect performance and privacy of large datasets), politely explain if a question requires querying specific rows that aren't available to you, but provide whatever insights you can infer from the statistics. Use clean Markdown formatting for your reply.

User's Question: ${message}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt
    });
    
    res.json({ reply: response.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/job/:jobId/email', async (req, res) => {
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
});

app.post('/api/job/:jobId/export-docs', async (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).send('Job not found');
  if (job.status !== 'complete') return res.status(400).send('Job not complete');

  try {
    const docsUrl = await exportToGoogleDocs(job);
    res.json({ success: true, url: docsUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function runPipeline(job: PipelineJob) {
  sendEvent(job.id, 'status', { status: 'cleaning' });
  sendEvent(job.id, 'log', { text: 'Parsing raw data...' });

  const rawData = parseFile(job.originalBuffer, job.fileName);
  if (rawData.length === 0) throw new Error('File has no data rows');

  sendEvent(job.id, 'log', { text: `Computing statistics (smart sampling for fast planning)...` });
  const sampledForStats = sampleData(rawData, 2000);
  const stats = computeStats(sampledForStats);

  sendEvent(job.id, 'log', { text: 'Asking Gemini for cleaning plan...' });
  
  // Stage 2 - Clean
  const sample = rawData.slice(0, 5);
  const prompt1 = `You are a Senior Analytics Developer with over 20 years of experience in data engineering and quality assurance. You'll be given a list of columns with their inferred type, basic stats (null %, min, max, unique count, up to 8 example values), and a sample of up to 5 rows. You will not see the full dataset — your plan will be applied programmatically to every row, so decide rules, not individual values.

For each column, decide:
- type: "string", "number", "date", "boolean", or "category"
- format: for "date" columns only, the format to standardize to (e.g. "YYYY-MM-DD")
- null_handling: "drop_row", "fill_median" (numbers only), "fill_mode" (categories only), "fill_value:<value>", or "leave"

Also decide:
- dedup_keys: the column(s) that together uniquely identify a row (empty array if none)
- outliers: columns where extreme values look like data-entry errors, each with rule "flag_only" or "clip_to_3std"

Rules: Use your extensive experience to make robust choices. Prefer "leave" over guessing when a column's purpose is unclear. Only use "drop_row" for essential columns like IDs or dates used in time-series analysis — never for optional descriptive fields. Respond with ONLY the JSON object — no explanation, no markdown fences.

Schema & Stats: ${JSON.stringify(stats)}
Sample rows: ${JSON.stringify(sample)}`;

  const cleanResp = await withRetry(() => ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: prompt1,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          columns: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                type: { type: Type.STRING },
                format: { type: Type.STRING },
                null_handling: { type: Type.STRING }
              },
              required: ['name', 'type', 'null_handling']
            }
          },
          dedup_keys: { type: Type.ARRAY, items: { type: Type.STRING } },
          outliers: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                column: { type: Type.STRING },
                rule: { type: Type.STRING },
                threshold: { type: Type.STRING }
              },
              required: ['column', 'rule', 'threshold']
            }
          }
        },
        required: ['columns', 'dedup_keys', 'outliers']
      }
    }
  }));

  let cleaningPlan: CleaningPlan;
  try {
    cleaningPlan = JSON.parse(cleanResp.text.trim());
    sendEvent(job.id, 'log', { text: '✓ AI Cleaning Plan generated successfully' });
  } catch (err: any) {
    sendEvent(job.id, 'log', { text: `[Fallback] AI Cleaning Plan failed (${err.message}). Using empty plan.` });
    cleaningPlan = { columns: [], dedup_keys: [], outliers: [] };
  }

  sendEvent(job.id, 'log', { text: 'Applying cleaning plan...' });

  const { cleanedData, log } = applyCleaningPlan(rawData, cleaningPlan);
  job.cleanedData = cleanedData;
  job.cleaningLog = log;
  
  sendEvent(job.id, 'log', { text: log });
  sendEvent(job.id, 'status', { status: 'planning' });
  sendEvent(job.id, 'log', { text: 'Planning dashboard and insights...' });

  // Stage 3 - Plan
  const sampledForCleanedStats = sampleData(cleanedData, 2000);
  const cleanedStats = computeStats(sampledForCleanedStats);
  job.stats = cleanedStats;
  const cleanedSample = cleanedData.slice(0, 5);
  const prompt2 = `You are a Senior Analytics Developer with over 20 years of experience building enterprise dashboards. Your task is to design a highly comprehensive, multi-faceted, Power BI-style dashboard configuration based on deep statistical analysis of a complex dataset. You'll be given the cleaned dataset's schema, summary statistics, and a sample of rows.

Return a JSON object with:
- pages: an array of 3-5 pages (or categories) representing a professional BI report structure.
Each page must have:
  - id: unique string
  - title: page title (e.g., "Executive Overview", "Deep Dive", "Geographic Analysis")
  - kpis: 4-6 summary metrics worth surfacing
  - charts: 4-8 chart definitions across multiple analytical perspectives. DO NOT repeat the same visualization type or x/y axis pairings constantly. Vary the chart types ('line', 'bar', 'pie') intelligently based on the data.
  - insights: 3-5 deep, analytical observations — trends, comparisons, correlations, or anomalies worth calling out

Rules: 
1. Only reference columns that exist in the schema.
2. Choose visualizations thoughtfully: Use "line" strictly for time-series or sequential data. Use "bar" for comparing categorical data or ranking. Use "pie" ONLY for composition of a whole, and only when there are 6 or fewer distinct categories.
3. Ensure variety. A page should not just be 6 bar charts. Mix aggregations and dimensions logically.
4. You were only shown a sample and stats — describe directional trends in insights, don't invent precise numbers you can't know. 
5. The dashboard MUST be comprehensive and span multiple pages according to the data. Respond with ONLY the JSON object.
6. Every chart must have a clear \`chartTitle\`, \`xAxisLabel\`, and \`yAxisLabel\` so a business stakeholder can understand it at a glance.

Schema & Stats: ${JSON.stringify(cleanedStats)}
Sample rows: ${JSON.stringify(cleanedSample)}`;

  let dashboardSpec: DashboardSpec;
  try {
    const planResp = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt2,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  kpis: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        label: { type: Type.STRING },
                        field: { type: Type.STRING },
                        agg: { type: Type.STRING, description: 'sum, avg, min, max, or count' }
                      },
                      required: ['label', 'field', 'agg']
                    }
                  },
                  charts: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        type: { type: Type.STRING, description: 'line, bar, or pie' },
                        title: { type: Type.STRING },
                        chartTitle: { type: Type.STRING },
                        xAxisLabel: { type: Type.STRING },
                        yAxisLabel: { type: Type.STRING },
                        x: { type: Type.STRING },
                        y: { type: Type.STRING },
                        agg: { type: Type.STRING, description: 'sum, avg, min, max, or count' },
                        filter: { type: Type.STRING }
                      },
                      required: ['id', 'type', 'title', 'chartTitle', 'xAxisLabel', 'yAxisLabel', 'x', 'y', 'agg']
                    }
                  },
                  insights: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  }
                },
                required: ['id', 'title', 'kpis', 'charts', 'insights']
              }
            }
          },
          required: ['pages']
        }
      }
    }));

    dashboardSpec = JSON.parse(planResp.text.trim());
    
    if (!dashboardSpec.pages || !Array.isArray(dashboardSpec.pages)) {
      throw new Error('Invalid dashboard spec returned from AI');
    }
    sendEvent(job.id, 'log', { text: '✓ AI Dashboard Plan generated successfully' });
  } catch (err: any) {
    console.error('AI Dashboard generation failed:', err);
    sendEvent(job.id, 'log', { text: `[Fallback] AI Dashboard Plan failed (${err.message}). Using fallback.` });
    const cols = Object.keys(cleanedStats);
    dashboardSpec = {
      pages: [{
        id: 'overview', title: 'Fallback Overview',
        kpis: cols.slice(0, 3).map(c => ({ label: c, field: c, agg: 'count' })),
        charts: cols.slice(0, 2).map((c, i) => ({
          id: `chart-${i}`, type: 'bar', title: `${c} Chart`, chartTitle: `${c} Overview`,
          xAxisLabel: c, yAxisLabel: 'Count', x: c, y: c, agg: 'count'
        })),
        insights: ['AI generation failed, this is a fallback overview.']
      }]
    };
  }

  job.dashboardSpec = dashboardSpec;

  sendEvent(job.id, 'status', { status: 'waiting_for_dashboard' });
  sendEvent(job.id, 'spec', { spec: dashboardSpec, data: cleanedData });
  sendEvent(job.id, 'log', { text: 'Generating narrative report...' });

  // Stage 4 - Report (parallel with client building dashboard)
  // First, compute the exact KPI values
  const allKpis = dashboardSpec.pages.flatMap(p => p.kpis);
  const kpisWithValues = allKpis.map(kpi => {
    let result = 0;
    if (kpi.agg === 'count') {
      result = cleanedData.length;
    } else {
      const values = cleanedData.map(row => Number(row[kpi.field])).filter(val => !isNaN(val));
      if (kpi.agg === 'sum') {
        result = values.reduce((sum, val) => sum + val, 0);
      } else if (kpi.agg === 'avg') {
        result = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
      } else if (kpi.agg === 'min') {
        result = values.length > 0 ? Math.min(...values) : 0;
      } else if (kpi.agg === 'max') {
        result = values.length > 0 ? Math.max(...values) : 0;
      }
    }
    return { ...kpi, exact_value: result };
  });

  const prompt3 = `You are writing an executive summary for a non-technical business stakeholder based on a dataset's KPIs and insights. Avoid statistical jargon (no 'standard deviation', 'p-value', 'outlier removal'). Use plain business language. 

Write in clean Markdown with the following structure (max 300 words total):
1) Key Takeaway (1-2 sentences summarizing the most critical finding).
2) Supporting Insights (3 short bullet points citing exact KPI values).
3) Recommended Action (1-2 concrete, practical next steps).

Rules: Use the exact KPI values you're given. Don't introduce claims not supported by the data.

KPIs with values: ${JSON.stringify(kpisWithValues, null, 2)}
Insights: ${JSON.stringify(dashboardSpec.pages.flatMap(p => p.insights), null, 2)}`;

  try {
    const reportResp = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt3
    }));
    job.reportText = reportResp.text || '';
    sendEvent(job.id, 'log', { text: '✓ AI Executive Narrative generated successfully' });
  } catch (aiError: any) {
    console.warn('AI report generation failed, using fallback:', aiError.message);
    sendEvent(job.id, 'log', { text: `[Fallback] AI narrative generation failed (${aiError.message}). Using fallback.` });
    job.reportText = `# Executive Summary\n\nAutomated narrative generation was unavailable due to an AI service error.\n\nHowever, your cleaned dataset and dashboard have been successfully generated and are available for download.\n\n## Key Metrics\n` + kpisWithValues.map(k => `- **${k.label}**: ${k.value}`).join('\n');
  }
  
  if (job.dashboardSpec && job.cleanedData) {
    job.reportHtml = generateInteractiveHtml(job.dashboardSpec, job.cleanedData);
    sendEvent(job.id, 'log', { text: '✓ Interactive HTML export generated successfully' });
  }

  if (job.dashboardImage) {
    job.reportPdf = await generateReportPdf(job.reportText, job.dashboardImage);
    job.status = 'complete';
    sendEvent(job.id, 'status', { status: job.status });
    clients.delete(job.id);
  } else {
    job.reportPdf = await generateReportPdf(job.reportText);
    sendEvent(job.id, 'log', { text: 'Waiting for dashboard export to finish...' });
  }
}

function generateDataProfileHtml(stats: any): Buffer {
  let html = `<!DOCTYPE html>
<html>
<head>
<title>Data Profiling Report</title>
<style>
body { font-family: sans-serif; padding: 20px; }
table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
th { background-color: #f2f2f2; }
</style>
</head>
<body>
<h1>Data Profiling Report</h1>
<p>Automated Pandas Profiling-style summary.</p>
<h2>Dataset Statistics</h2>
<table>
<tr><th>Column</th><th>Type</th><th>Null %</th><th>Min</th><th>Max</th><th>Unique Count</th></tr>
`;
  if (stats) {
    for (const [col, info] of Object.entries(stats)) {
      const i = info as any;
      html += `<tr>
<td>${col}</td>
<td>${i.inferred_type || ''}</td>
<td>${((i.null_pct || 0) * 100).toFixed(2)}%</td>
<td>${i.min ?? ''}</td>
<td>${i.max ?? ''}</td>
<td>${i.unique_count ?? ''}</td>
</tr>\n`;
    }
  }
  html += `</table>
</body>
</html>`;
  return Buffer.from(html, 'utf-8');
}


async function sendEmail(job: PipelineJob, options: { to?: string, cc?: string, bcc?: string, subject?: string, body?: string, attachHtml?: boolean } = {}) {
  sendEvent(job.id, 'log', { text: 'Sending email via Gmail API...' });
  
  if (!job.accessToken) {
    throw new Error('Not authenticated with Google. Cannot send email. Please ensure you logged in with Google and granted Gmail permissions.');
  }
  
  const { auth, gmail } = await import('@googleapis/gmail');
  const MailComposer = (await import('nodemailer/lib/mail-composer/index.js')).default;
  
  const dashImageBase64 = job.dashboardImage!.replace(/^data:image\/\w+;base64,/, '');
  const dashBuffer = Buffer.from(dashImageBase64, 'base64');
  
  const defaultSubject = `[${job.fileName.split('.')[0] || 'Dataset'}] — Analytics Report & Executive Summary`;
  
  const attachments = [
    { filename: 'dashboard.png', content: dashBuffer },
    { filename: 'report.pdf', content: job.reportPdf! }
  ];

  if (options.attachHtml && job.reportHtml) {
    attachments.push({ filename: 'interactive_report.html', content: job.reportHtml });
  }

  const mailOptions: any = {
    to: options.to || job.email,
    subject: options.subject || defaultSubject,
    html: options.body || '<p>Hello,</p><p>Your automated analytics package is ready. Please find attached your Executive Summary (PDF) and Dashboard Export (PNG).</p>',
    ...(options.cc ? { cc: options.cc } : {}),
    ...(options.bcc ? { bcc: options.bcc } : {}),
    attachments
  };

  try {
    const mail = new MailComposer(mailOptions);
    const message = await mail.compile().build();
    const rawMessage = Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const oauth2Client = new auth.OAuth2();
    oauth2Client.setCredentials({ access_token: job.accessToken });
    
    const client = gmail({ version: 'v1', auth: oauth2Client });
    await client.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: rawMessage
      }
    });

    sendEvent(job.id, 'log', { text: `Successfully sent email to ${job.email}` });
  } catch (emailError: any) {
    console.error('Email sending failed:', emailError);
    sendEvent(job.id, 'log', { text: `Warning: Email delivery failed (${emailError.message}).` });
    throw emailError;
  }
}

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 15MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal Server Error' });
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
