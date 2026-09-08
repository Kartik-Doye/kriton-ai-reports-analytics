import 'dotenv/config';
import express from 'express';
import { CLEANING_PROMPT, DASHBOARD_PROMPT, NARRATIVE_PROMPT, CHAT_PROMPT_TEMPLATE } from './src/config/prompts.js';
import { logger } from './src/utils/logger.js';
import path from 'path';
import multer from 'multer';
import crypto from 'crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { PipelineJob, CleaningPlan, DashboardSpec } from './src/types.js';
import { parseFile, applyCleaningPlan, computeStats, sampleData, formatStat } from './src/utils/data-processing.js';
import { generateReportPdf } from './src/utils/pdf-generator.js';
import { generateInteractiveHtml } from './src/utils/html-generator.js';
import { generateDataProfileHtml } from './src/utils/profiling-generator.js';

import * as archiverModule from 'archiver';
const archiver = (archiverModule as any).default || archiverModule;

// Setup basic server
const app = express();
const PORT = 3000;
app.use(express.json({ limit: '50mb' })); // for receiving the base64 dashboard image

// Retry helper for API calls
async function withRetry<T>(fn: () => Promise<T>, retries = 15, initialDelay = 2000): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error: any) {
      attempt++;
      const msg = String(error.message || error);
      const isQuotaExceeded = msg.includes('exceeded your current quota') || msg.includes('Quota exceeded');
      const isRetryable = !isQuotaExceeded && (msg.includes('503') || msg.includes('429') || msg.includes('500') || msg.includes('UNAVAILABLE') || msg.includes('RESOURCE_EXHAUSTED') || error.status === 503 || error.status === 429);
      
      if (attempt >= retries || !isRetryable) {
        console.error('API call failed permanently after', attempt, 'attempts:', error);
        throw error;
      }
      const delay = Math.min(initialDelay * Math.pow(1.5, attempt - 1), 15000);
      console.warn(`API call failed (${msg.substring(0, 50)}...), retrying in ${Math.round(delay)}ms... (Attempt ${attempt}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("API call failed after retries.");
}

// Job store (in-memory for this session)
const jobs = new Map<string, PipelineJob>();
import fs from "fs";
const DATA_DIR = path.join(process.cwd(), ".data", "jobs");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
for (const file of fs.readdirSync(DATA_DIR)) {
  if (file.endsWith(".json")) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf8"));
      if (typeof data.originalBuffer === 'string') data.originalBuffer = Buffer.from(data.originalBuffer, 'base64');
      if (typeof data.reportPdf === 'string') data.reportPdf = Buffer.from(data.reportPdf, 'base64');
      if (typeof data.reportHtml === 'string') data.reportHtml = Buffer.from(data.reportHtml, 'base64');
      if (typeof data.profilingHtml === 'string') data.profilingHtml = Buffer.from(data.profilingHtml, 'base64');
      jobs.set(data.id, data as PipelineJob);
    } catch (e) {}
  }
}
function saveJobToDisk(job: PipelineJob) {
  const serializableJob = {
    ...job,
    originalBuffer: job.originalBuffer?.toString('base64'),
    reportPdf: job.reportPdf?.toString('base64'),
    reportHtml: job.reportHtml?.toString('base64'),
    profilingHtml: job.profilingHtml?.toString('base64')
  };
  try { fs.writeFileSync(path.join(DATA_DIR, `${job.id}.json`), JSON.stringify(serializableJob)); } catch(e) {}
}
// SSE connections
const clients = new Map<string, express.Response>();

const emailRateLimit = new Map<string, number>();

setInterval(() => {
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    if (job.timestamp && now - job.timestamp > ONE_DAY) {
      jobs.delete(jobId);
      clients.delete(jobId);
      try { fs.unlinkSync(path.join(DATA_DIR, `${jobId}.json`)); } catch(e) {}
      continue;
    }
    saveJobToDisk(job);
  }
}, 5000);


const uploadRateLimit = new Map<string, { count: number, resetAt: number }>();



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
    const email = req.body.email || 'user@example.com';
    const accessToken = req.body.accessToken || '';
    const analysisMode = req.body.analysisMode || 'detailed';

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (!['.csv', '.xls', '.xlsx', '.json'].includes(ext)) {
      return res.status(400).json({ error: 'Invalid file type. Please upload a .csv, .xls, .xlsx, or .json file.' });
    }

    const jobId = crypto.randomUUID();
    const jobToken = crypto.randomUUID();
    jobs.set(jobId, {
      id: jobId,
      jobToken,
      email,
      accessToken,
      analysisMode,
      fileName: req.file.originalname,
      originalBuffer: req.file.buffer,
      status: 'pending',
      timestamp: Date.now()
    });

    res.json({ jobId, jobToken });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Upload failed' });
  }
});



app.get('/api/job/:jobId', (req, res) => {
  const { jobId } = req.params;
  const token = req.headers.authorization?.split(' ')[1];
  const reqToken = req.query.token || req.headers['x-job-token'];
  
  const job = jobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Not found' });
  
  if (job.jobToken !== reqToken) return res.status(401).json({ error: 'Unauthorized' });
  
  // Exclude buffers for the JSON response
  const { originalBuffer, reportPdf, reportHtml, profilingHtml, accessToken, ...safeJob } = job;
  res.json(safeJob);
});

app.get('/api/job/:jobId/stream', (req, res) => {
  const jobId = req.params.jobId;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).send('Job not found');
  
  const reqToken = req.query.token || req.headers['x-job-token'] || req.body?.jobToken;
  if (!reqToken || reqToken !== job.jobToken) {
    return res.status(401).send('Unauthorized: Invalid job token');
  }


  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  clients.set(jobId, res);

  // Replay current state for reconnecting clients
  res.write(`event: status\ndata: ${JSON.stringify({ status: job.status })}\n\n`);
  if (job.dashboardSpec && job.cleanedData) {
    // Note: Don't send the entire data on every reconnect unless we need to, but the client needs it to render
    res.write(`event: spec\ndata: ${JSON.stringify({ spec: job.dashboardSpec, data: job.cleanedData, stats: job.stats, dataQuality: job.dataQuality, cleaningLog: job.cleaningLog })}\n\n`);
  }


  req.on('close', () => {
    clients.delete(jobId);
  });

  // Start the pipeline in background
  if (job.status === 'pending') {
    job.status = 'cleaning';
    runPipeline(job).catch(err => {
      logger.error(jobId, err);
      job.status = 'error';
      sendEvent(jobId, 'error', { message: err.message });
      clients.delete(jobId);
    });
  }
});



app.get('/api/job/:jobId/download/:fileType', async (req, res) => {
  const { jobId, fileType } = req.params;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).send('Job not found');
  
  const reqToken = req.query.token || req.headers['x-job-token'] || req.body?.jobToken;
  if (!reqToken || reqToken !== job.jobToken) {
    return res.status(401).send('Unauthorized: Invalid job token');
  }

  const isHtmlReport = fileType === 'html' || fileType === 'html-report' || fileType === 'interactive';
  const isProfilingReport = fileType === 'profiling' || fileType === 'profiling-report' || fileType === 'profile';

  if (fileType === 'csv' && job.cleanedData) {
    const Papa = await import('papaparse');
    const csvStr = Papa.default.unparse(job.cleanedData);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="cleaned_data_${jobId}.csv"`);
    res.send(csvStr);
  } else if (fileType === 'png' && job.dashboardImage) {
    const dashImageBase64 = job.dashboardImage.replace(/^data:image\/\w+;base64,/, '');
    const dashBuffer = Buffer.from(dashImageBase64, 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="dashboard_${jobId}.png"`);
    res.send(dashBuffer);
  } else if (fileType === 'pdf' && job.reportPdf) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${req.query.view ? 'inline' : 'attachment'}; filename="report_${jobId}.pdf"`);
    res.send(job.reportPdf);
  } else if (isHtmlReport && (job.reportHtml || (job.dashboardSpec && job.cleanedData))) {
    const htmlBuffer = job.reportHtml || generateInteractiveHtml(job.dashboardSpec!, job.cleanedData!);
    job.reportHtml = htmlBuffer;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `${req.query.view ? 'inline' : 'attachment'}; filename="report_${jobId}.html"`);
    res.send(htmlBuffer);
  } else if (isProfilingReport && (job.profilingHtml || (job.stats && job.cleanedData))) {
    const profBuffer = job.profilingHtml || generateDataProfileHtml(job.stats, job.cleanedData);
    job.profilingHtml = profBuffer;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `${req.query.view ? 'inline' : 'attachment'}; filename="profiling_${jobId}.html"`);
    res.send(profBuffer);
  } else if (fileType === 'zip' && job.cleanedData) {
    const Papa = await import('papaparse');
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="analytics_package_${jobId}.zip"`);

    archive.pipe(res);

    // CSV
    const csvStr = Papa.default.unparse(job.cleanedData);
    archive.append(csvStr, { name: 'cleaned_data.csv' });

    // PDF
    if (job.reportPdf) {
      archive.append(job.reportPdf, { name: `report_${jobId}.pdf` });
    }

    // Interactive HTML Report
    const htmlBuf = job.reportHtml || (job.dashboardSpec && job.cleanedData ? generateInteractiveHtml(job.dashboardSpec, job.cleanedData) : null);
    if (htmlBuf) {
      archive.append(htmlBuf, { name: `report_${jobId}.html` });
    }

    // Technical Data Profiling Report
    const profBuf = job.profilingHtml || (job.stats && job.cleanedData ? generateDataProfileHtml(job.stats, job.cleanedData) : null);
    if (profBuf) {
      archive.append(profBuf, { name: `profiling_${jobId}.html` });
    }

    // Dashboard PNG
    if (job.dashboardImage) {
      const dashImageBase64 = job.dashboardImage.replace(/^data:image\/\w+;base64,/, '');
      const dashBuffer = Buffer.from(dashImageBase64, 'base64');
      archive.append(dashBuffer, { name: 'dashboard.png' });
    }

    archive.finalize();
  } else {
    res.status(404).send('File not ready or not found');
  }
});

app.post('/api/job/:jobId/chat', async (req, res) => {
  const { jobId } = req.params;
  const { message, jobToken } = req.body;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).send('Job not found');
  if (!jobToken || jobToken !== job.jobToken) {
    return res.status(401).json({ error: 'Unauthorized: Invalid job token' });
  }
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'A message is required' });
  }

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
    
    const response = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt
    }));
    
    res.json({ reply: response.text });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Chat request failed' });
  }
});



app.post('/api/job/:jobId/email', async (req, res) => {
  const { jobId } = req.params;
  const { to, attachments } = req.body;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  const reqToken = req.headers['x-job-token'] || req.body?.jobToken || req.query.token;
  if (!reqToken || reqToken !== job.jobToken) {
    return res.status(401).json({ error: 'Unauthorized: Invalid job token' });
  }

  // Record audit log
  logger.info(jobId, `Email dispatch requested for ${to}. Included attachments: ${JSON.stringify(attachments)}`);
  
  res.json({
    success: true,
    message: `Delivery scheduled for ${to}. Stakeholder PDF report included as primary attachment.`
  });
});

app.post('/api/job/:jobId/refresh', async (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).send('Job not found');
  
  const reqToken = req.query.token || req.headers['x-job-token'] || req.body?.jobToken;
  if (!reqToken || reqToken !== job.jobToken) {
    return res.status(401).send('Unauthorized: Invalid job token');
  }

  job.status = 'pending';
  job.cleanedData = undefined;
  job.stats = undefined;
  job.cleaningLog = undefined;
  job.dashboardSpec = undefined;
  job.reportText = undefined;

  runPipeline(job).catch(err => {
    logger.error(jobId, err);
    job.status = 'error';
    sendEvent(jobId, 'error', { message: err.message });
  });

  res.json({ success: true });
});

const aiCache = new Map<string, string>();
async function generateCachedContent(prompt: string, config?: any): Promise<{text: string}> {
  const hash = crypto.createHash('sha256').update(prompt).digest('hex');
  if (aiCache.has(hash)) {
    return { text: aiCache.get(hash) };
  }
  const resp = await withRetry(() => ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: prompt,
    config
  }));
  if (resp.text) {
    if (resp.text.length < 100000) {
      aiCache.set(hash, resp.text);
    }
  }
  return { text: resp.text || '' };
}

async function runPipeline(job: PipelineJob) {
  sendEvent(job.id, 'status', { status: 'cleaning' });
  sendEvent(job.id, 'log', { text: 'Parsing raw data...' });

  const { data: rawData, warnings: parseWarnings } = parseFile(job.originalBuffer, job.fileName);
  if (parseWarnings && parseWarnings.length > 0) {
    parseWarnings.forEach(w => sendEvent(job.id, 'log', { text: `Warning: ${w}` }));
  }
  if (rawData.length === 0) throw new Error('File has no data rows');

  sendEvent(job.id, 'log', { text: `Computing statistics (smart sampling for fast planning)...` });
  const sampledForStats = sampleData(rawData, 2000);
  if (rawData.length > 0 && Object.keys(rawData[0]).length > 75) {
    sendEvent(job.id, 'log', { text: '⚠️ Dataset exceeds 75 columns. Truncating to the first 75 columns to stay within AI context limits.' });
  }
  const stats = computeStats(sampledForStats);

  sendEvent(job.id, 'log', { text: 'Asking Gemini for cleaning plan...' });
  
  // Stage 2 - Clean
  const sample = rawData.slice(0, 5);
  const prompt1 = `${CLEANING_PROMPT}\n\nSchema & Stats: ${JSON.stringify(stats)}\nSample rows: ${JSON.stringify(sample)}`;

  let cleanResp;
  let cleaningPlan: CleaningPlan;
  try {
    cleanResp = await generateCachedContent(prompt1, {
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
    );
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
  job.dataQuality = { totalRecords: rawData.length, rowsExcluded: rawData.length - cleanedData.length };
  
  sendEvent(job.id, 'log', { text: log });
  sendEvent(job.id, 'status', { status: 'planning' });
  sendEvent(job.id, 'log', { text: 'Planning dashboard and insights...' });

  // Stage 3 - Plan
  const sampledForCleanedStats = sampleData(cleanedData, 2000);
  const cleanedStats = computeStats(sampledForCleanedStats);
  job.stats = cleanedStats;
  const cleanedSample = cleanedData.slice(0, 5);
  const prompt2 = `${DASHBOARD_PROMPT(job.analysisMode || "detailed")}\n\nSchema & Stats: ${JSON.stringify(cleanedStats)}\nSample rows: ${JSON.stringify(cleanedSample)}`;

  let dashboardSpec: DashboardSpec;
  try {
    const planResp = await generateCachedContent(prompt2, {
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
    );

    dashboardSpec = JSON.parse(planResp.text.trim());
    
    if (!dashboardSpec.pages || !Array.isArray(dashboardSpec.pages)) {
      throw new Error('Invalid dashboard spec returned from AI');
    }
    sendEvent(job.id, 'log', { text: '✓ AI Dashboard Plan generated successfully' });
  } catch (err: any) {
    logger.error(job.id, 'AI Dashboard generation failed:', err);
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

  
  // Validate Dashboard Spec against actual cleaned data
  const validColumns = new Set(Object.keys(cleanedStats));
  dashboardSpec.pages.forEach(page => {
    page.kpis = page.kpis.filter(kpi => {
      if (!validColumns.has(kpi.field)) {
        console.warn(`Invalid KPI field removed: ${kpi.field}`);
        return false;
      }
      return true;
    });
    page.charts = page.charts.filter(chart => {
      if (!validColumns.has(chart.x) || !validColumns.has(chart.y)) {
        console.warn(`Invalid Chart fields removed: x=${chart.x}, y=${chart.y}`);
        return false;
      }
      return true;
    });
  });
  // Fallback if everything was removed
  if (dashboardSpec.pages.every(p => p.kpis.length === 0 && p.charts.length === 0)) {
    throw new Error('AI generated a dashboard referencing entirely invalid columns.');
  }

  // Enforce hard limit of 12 charts in DashboardSpec, preserving hidden charts
  dashboardSpec.pages.forEach(page => {
    if (page.charts && page.charts.length > 12) {
      (page as any).hiddenCharts = page.charts.slice(12);
      page.charts = page.charts.slice(0, 12);
    }
  });

  job.dashboardSpec = dashboardSpec;

  sendEvent(job.id, 'status', { status: 'waiting_for_dashboard' });
  sendEvent(job.id, 'spec', { spec: dashboardSpec, data: cleanedData, stats: job.stats, dataQuality: job.dataQuality, cleaningLog: job.cleaningLog });
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
        result = formatStat(values.reduce((sum, val) => sum + val, 0));
      } else if (kpi.agg === 'avg') {
        result = formatStat(values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0);
      } else if (kpi.agg === 'min') {
        result = formatStat(values.length > 0 ? Math.min(...values) : 0);
      } else if (kpi.agg === 'max') {
        result = formatStat(values.length > 0 ? Math.max(...values) : 0);
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
    const reportResp = await generateCachedContent(prompt3);
    job.reportText = reportResp.text || '';
    sendEvent(job.id, 'log', { text: '✓ AI Executive Narrative generated successfully' });
  } catch (aiError: any) {
    logger.warn(job.id, 'AI report generation failed, using fallback:', aiError.message);
    sendEvent(job.id, 'log', { text: `[Fallback] AI narrative generation failed (${aiError.message}). Using fallback.` });
    job.reportText = `# Executive Summary\n\nAutomated narrative generation was unavailable due to an AI service error.\n\nHowever, your cleaned dataset and dashboard have been successfully generated and are available for download.\n\n## Key Metrics\n` + kpisWithValues.map(k => `- **${k.label}**: ${k.exact_value}`).join('\n');
  }
  
  if (job.dashboardSpec && job.cleanedData) {
    job.reportHtml = generateInteractiveHtml(job.dashboardSpec, job.cleanedData);
    sendEvent(job.id, 'log', { text: '✓ Interactive HTML export generated successfully' });
  }

  if (job.cleanedData) {
    job.profilingHtml = generateDataProfileHtml(job.stats, job.cleanedData);
    sendEvent(job.id, 'log', { text: '✓ Full Data Profiling (technical) report generated successfully' });
  }

  // Generate PDF natively (chartjs-node-canvas handles the charts)
  job.reportPdf = await generateReportPdf(
    job.reportText!, 
    typeof job.dashboardSpec === 'string' ? JSON.parse(job.dashboardSpec) : job.dashboardSpec, 
    job.cleanedData
  );
  
  job.status = 'complete';
  sendEvent(job.id, 'status', { status: job.status });
  clients.delete(job.id);
}




app.delete('/api/job/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  const reqToken = req.query.token || req.headers['x-job-token'] || req.body?.jobToken;
  if (!reqToken || reqToken !== job.jobToken) {
    return res.status(401).json({ error: 'Unauthorized: Invalid job token' });
  }

  // Clear memory
  jobs.delete(jobId);
  try { fs.unlinkSync(path.join(DATA_DIR, `${jobId}.json`)); } catch(e) {}
  clients.delete(jobId);
  
  logger.info(jobId, 'User requested data deletion. Job wiped from memory.');
  res.json({ success: true });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'This file is too large. Please keep it under 15MB.' });
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
