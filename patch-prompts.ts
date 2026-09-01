import fs from 'fs';
let code = fs.readFileSync('src/config/prompts.ts', 'utf8');

code = code.replace(
  'pages: DashboardPage[];',
  'pages: DashboardPage[];\n  anomalies?: { description: string }[];'
).replace(
  'export const DASHBOARD_PROMPT = `You are a Senior Analytics Developer',
  'export const DASHBOARD_PROMPT = (analysisMode: string) => `You are a Senior Analytics Developer'
).replace(
  'Return a JSON object with:\\n- pages: an array of 3-5 pages',
  'Return a JSON object with:\\n- pages: an array of pages. If the user requested a "brief" analysis, generate EXACTLY 1 page summarizing the most important metrics. If "detailed", generate 3-5 pages for a deep dive.\\n- anomalies: an array of 2-4 strings describing statistically unusual findings, spikes, outliers, or warnings in the data.'
).replace(
  '- insights: an array of 2-3 string sentences summarizing what a stakeholder should look for on this page.',
  '- insights: an array of 2-3 string sentences summarizing what a stakeholder should look for on this page.\n  - anomalies: an array of 1-3 strings calling out statistically unusual findings, spikes, or outliers relevant to this page (optional).'
);

fs.writeFileSync('src/config/prompts.ts', code);
