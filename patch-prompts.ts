import fs from 'fs';
let code = fs.readFileSync('src/config/prompts.ts', 'utf8');

code = code.replace(
  "- charts: an array of 3-6 charts for this page. Each needs an 'id', 'type' (line, bar, pie)",
  "- charts: an array of charts for this page. IMPORTANT: Limit the TOTAL number of charts across ALL pages to a maximum of 12, prioritizing the most surprising or strongest relationships (e.g., highest correlation). Each needs an 'id', 'type' (line, bar, pie)"
);

fs.writeFileSync('src/config/prompts.ts', code);
