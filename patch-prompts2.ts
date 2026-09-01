import fs from 'fs';
let code = fs.readFileSync('src/config/prompts.ts', 'utf8');

code = code.replace(
  'pages: an array of 3-5 pages (or categories) representing a professional BI report structure.',
  'pages: an array of pages. If the analysisMode is "brief", generate EXACTLY 1 page summarizing the most important metrics. If "detailed", generate 3-5 pages for a deep dive.'
).replace(
  'The dashboard MUST be comprehensive and span multiple pages according to the data.',
  'The dashboard MUST reflect the requested analysisMode.'
).replace(
  'export const DASHBOARD_PROMPT = (analysisMode: string) => `You are a Senior Analytics Developer',
  'export const DASHBOARD_PROMPT = (analysisMode: string) => `You are a Senior Analytics Developer (${analysisMode} mode)'
);

fs.writeFileSync('src/config/prompts.ts', code);
