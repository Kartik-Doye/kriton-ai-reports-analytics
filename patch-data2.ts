import fs from 'fs';
let code = fs.readFileSync('src/utils/data-processing.ts', 'utf8');

code = code.replace(
  'export function parseFile(buffer: Buffer, fileName: string): any[] {',
  'export function parseFile(buffer: Buffer, fileName: string): { data: any[], warnings: string[] } {'
).replace(
  'return result.data;',
  'const warnings = duplicateWarnings > 0 ? [`Found ${duplicateWarnings} duplicate column headers. They have been renamed.`] : [];\n    return { data: result.data, warnings };'
).replace(
  'return xlsx.utils.sheet_to_json(sheet);',
  'return { data: xlsx.utils.sheet_to_json(sheet), warnings: [] };'
).replace(
  'if (Array.isArray(data)) return data;',
  'if (Array.isArray(data)) return { data, warnings: [] };'
).replace(
  'if (Array.isArray(data[key])) return data[key];',
  'if (Array.isArray(data[key])) return { data: data[key], warnings: [] };'
).replace(
  'return [];\n}',
  'return { data: [], warnings: [] };\n}'
);

fs.writeFileSync('src/utils/data-processing.ts', code);
