import Papa from 'papaparse';
import * as xlsx from 'xlsx';
import { CleaningPlan } from '../types.js';

export function parseFile(buffer: Buffer, fileName: string): { data: any[], warnings: string[] } {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'csv') {
    let duplicateWarnings = 0;
    const seenHeaders = new Set<string>();
    const result = Papa.parse(buffer.toString('utf-8'), {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => {
        const trimmed = header.trim();
        if (seenHeaders.has(trimmed)) {
          duplicateWarnings++;
          return `${trimmed}_${duplicateWarnings}`;
        }
        seenHeaders.add(trimmed);
        return trimmed;
      }
    });
    const warnings = duplicateWarnings > 0 ? [`Found ${duplicateWarnings} duplicate column headers. They have been renamed.`] : [];
    return { data: result.data, warnings };
  } else if (ext === 'xls' || ext === 'xlsx') {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return { data: xlsx.utils.sheet_to_json(sheet), warnings: [] };
  } else if (ext === 'json') {
    try {
      const data = JSON.parse(buffer.toString('utf-8'));
      if (Array.isArray(data)) return { data, warnings: [] };
      // Handle cases where data might be nested inside a property
      for (const key in data) {
        if (Array.isArray(data[key])) return { data: data[key], warnings: [] };
      }
    } catch (e) {
      console.error('Failed to parse JSON', e);
    }
  }
  return { data: [], warnings: [] };
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

export function formatStat(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeStats(data: any[]) {
  const stats: Record<string, any> = {};
  if (data.length === 0) return stats;
  
  let headers = Object.keys(data[0]);
  if (headers.length > 75) {
    console.warn('Dataset has too many columns. Truncating to 75 to protect AI token budget.');
    headers = headers.slice(0, 75);
  }
  headers.forEach(h => {
    stats[h] = { type: 'unknown', nullCount: 0, uniqueValues: new Set<string>(), min: null, max: null };
  });

  data.forEach(row => {
    headers.forEach(h => {
      const val = row[h];
      if (val === null || val === undefined || val === '') {
        stats[h].nullCount++;
      } else {
        stats[h].uniqueValues.add(String(val));
        if (typeof val === 'number') {
          if (stats[h].type === 'unknown' || stats[h].type === 'number') stats[h].type = 'number';
          if (stats[h].min === null || val < stats[h].min) stats[h].min = formatStat(val);
          if (stats[h].max === null || val > stats[h].max) stats[h].max = formatStat(val);
        } else if (typeof val === 'string' && !isNaN(Number(val))) {
          if (stats[h].type === 'unknown' || stats[h].type === 'number') stats[h].type = 'number';
          const n = Number(val);
          if (stats[h].min === null || n < stats[h].min) stats[h].min = formatStat(n);
          if (stats[h].max === null || n > stats[h].max) stats[h].max = formatStat(n);
        } else {
          stats[h].type = stats[h].type === 'unknown' ? 'string' : 'mixed';
        }
      }
    });
  });

  headers.forEach(h => {
    stats[h].uniqueCount = stats[h].uniqueValues.size;
    delete stats[h].uniqueValues;
  });

  return stats;
}

export function applyCleaningPlan(data: any[], plan: CleaningPlan): { cleanedData: any[], log: string } {
  let logLines: string[] = [];
  let cleanedData = data.map(row => ({ ...row }));

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
      if (!cleanedData.some(row => Object.prototype.hasOwnProperty.call(row, col))) return;
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
          if (colPlan.type === 'number') {
            if (typeof val === 'string') {
              // basic currency stripping
              val = val.replace(/[^0-9.-]+/g,"");
            }
            row[col] = Number(val) || 0;
          } else if (colPlan.type === 'date') {
            const parsed = new Date(val);
            if (!isNaN(parsed.getTime())) {
              row[col] = parsed.toISOString().split('T')[0]; // Store as YYYY-MM-DD
            } else {
              row[col] = null;
            }
          }

        }
        return true;
      });

      if (droppedCount > 0) logLines.push(`Dropped ${droppedCount} rows with missing '${col}'.`);
      if (filledCount > 0) logLines.push(`Filled ${filledCount} missing values in '${col}'.`);
    });
  }

  // Apply numeric outlier rules after type conversion and null handling.
  for (const outlierPlan of plan.outliers || []) {
    const values = cleanedData
      .map(row => Number(row[outlierPlan.column]))
      .filter(value => Number.isFinite(value));
    if (values.length < 2) continue;

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    if (standardDeviation === 0) continue;

    const lower = mean - 3 * standardDeviation;
    const upper = mean + 3 * standardDeviation;
    let affectedCount = 0;
    cleanedData.forEach(row => {
      const value = Number(row[outlierPlan.column]);
      if (!Number.isFinite(value) || value < lower || value > upper) {
        if (Number.isFinite(value)) affectedCount++;
        if (outlierPlan.rule === 'clip_to_3std' && Number.isFinite(value)) {
          row[outlierPlan.column] = Math.min(upper, Math.max(lower, value));
        }
      }
    });
    if (affectedCount > 0) {
      logLines.push(`${outlierPlan.rule === 'clip_to_3std' ? 'Clipped' : 'Flagged'} ${affectedCount} outlier values in '${outlierPlan.column}'.`);
    }
  }

  return { cleanedData, log: logLines.join('\n') || 'No cleaning actions required.' };
}
