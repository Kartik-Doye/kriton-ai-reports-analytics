const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const regex = /app\.post\('\/api\/job\/:jobId\/dashboard-image', async \(req, res\) => \{[\s\S]*?res\.json\(\{ success: true \}\);\n\}\);/g;
code = code.replace(regex, "");

fs.writeFileSync('server.ts', code);
