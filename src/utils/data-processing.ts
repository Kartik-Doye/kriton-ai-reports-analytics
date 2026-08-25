import Papa from 'papaparse';
import * as xlsx from 'xlsx';
import { CleaningPlan } from '../types.js';

export function parseFile(buffer: Buffer, fileName: string): any[] {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    const result = Papa.parse(buffer.toString('utf-8'), { header: true, skipEmptyLines: true });
    return result.data;
  } else if (ext === 'xls' || ext === 'xlsx') {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(sheet);
  } else if (ext === 'json') {
    try {
      const data = JSON.parse(buffer.toString('utf-8'));
      if (Array.isArray(data)) return data;
      // Handle cases where data might be nested inside a property
      for (const key in data) {
        if (Array.isArray(data[key])) return data[key];
      }
    } catch (e) {
      console.error('Failed to parse JSON', e);
    }
  }
  return [];
}

export function sampleData(data: any[], maxRows: number = 500): any[] {
  if (data.length <= maxRows) return data;
  
  // Smart sampling: randomly select rows across the dataset
  const step = data.length / maxRows;
  const sampled = [];
  for (let i = 0; i < maxRows; i++) {
    sampled.push(data[Math.floor(i * step)]);
  }
  return sampled;
}

export function computeStats(data: any[]) {
  const stats: Record<string, any> = {};
  if (data.length === 0) return stats;
  
  const headers = Object.keys(data[0]);
  headers.forEach(h => {
    stats[h] = { type: 'unknown', nullCount: 0, uniqueCount: 0, min: null, max: null };
  });

  data.forEach(row => {
    headers.forEach(h => {
      const val = row[h];
      if (val === null || val === undefined || val === '') {
        stats[h].nullCount++;
      } else {
        if (typeof val === 'number') {
          stats[h].type = 'number';
          if (stats[h].min === null || val < stats[h].min) stats[h].min = val;
          if (stats[h].max === null || val > stats[h].max) stats[h].max = val;
        } else if (typeof val === 'string' && !isNaN(Number(val))) {
          stats[h].type = 'number';
          const n = Number(val);
          if (stats[h].min === null || n < stats[h].min) stats[h].min = n;
          if (stats[h].max === null || n > stats[h].max) stats[h].max = n;
        } else {
          stats[h].type = 'string';
        }
      }
    });
  });

  return stats;
}

export function applyCleaningPlan(data: any[], plan: CleaningPlan): { cleanedData: any[], log: string } {
  let logLines: string[] = [];
  let cleanedData = [...data];

  // 1. Remove duplicates
  if (plan.dedup_keys && plan.dedup_keys.length > 0) {
    const initialLength = cleanedData.length;
    const seen = new Set();
    cleanedData = cleanedData.filter(row => {
      const key = plan.dedup_keys.map(k => row[k]).join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const removed = initialLength - cleanedData.length;
    if (removed > 0) {
      logLines.push(`Removed ${removed} duplicate rows based on keys: ${plan.dedup_keys.join(', ')}.`);
    }
  }

  // 2. Column formatting and null handling
  if (plan.columns) {
    plan.columns.forEach(colPlan => {
      const col = colPlan.name;
      let filledCount = 0;
      let droppedCount = 0;
      
      let medianVal: number = 0;
      if (colPlan.null_handling === 'fill_median' || colPlan.null_handling === 'fill_mean') {
        const vals = cleanedData.map(r => Number(r[col])).filter(n => !isNaN(n));
        vals.sort((a, b) => a - b);
        if (vals.length > 0) medianVal = vals[Math.floor(vals.length / 2)];
      }

      cleanedData = cleanedData.filter(row => {
        let val = row[col];
        if (val === null || val === undefined || val === '') {
          if (colPlan.null_handling === 'drop_row') {
            droppedCount++;
            return false;
          } else if (colPlan.null_handling === 'fill_median' || colPlan.null_handling === 'fill_mean') {
            row[col] = medianVal;
            filledCount++;
          } else if (colPlan.null_handling.startsWith('fill_value:')) {
            row[col] = colPlan.null_handling.split(':')[1];
            filledCount++;
          }
        } else {
          // parse type
          if (colPlan.type === 'number') {
            row[col] = Number(val) || 0;
          }
        }
        return true;
      });

      if (droppedCount > 0) logLines.push(`Dropped ${droppedCount} rows with missing '${col}'.`);
      if (filledCount > 0) logLines.push(`Filled ${filledCount} missing values in '${col}'.`);
    });
  }

  return { cleanedData, log: logLines.join('\n') || 'No cleaning actions required.' };
}
