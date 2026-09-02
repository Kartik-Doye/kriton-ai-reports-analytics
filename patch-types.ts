import fs from 'fs';
const code = fs.readFileSync('src/types.ts', 'utf8');

const patched = code.replace(
  'export interface DashboardPage {',
  'export interface DashboardPage {\n  anomalies?: { description: string }[];'
).replace(
  'stats?: any;',
  'stats?: any;\n  dataQuality?: { totalRecords: number; rowsExcluded: number };\n  analysisMode?: \'brief\' | \'detailed\';'
);

fs.writeFileSync('src/types.ts', patched);
