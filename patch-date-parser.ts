import fs from 'fs';
let code = fs.readFileSync('src/utils/data-processing.ts', 'utf8');

const replacement = `
          // parse type
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
`;

code = code.replace(
  '          if (colPlan.type === \'number\') {\n            row[col] = Number(val) || 0;\n          }',
  replacement
);

fs.writeFileSync('src/utils/data-processing.ts', code);
