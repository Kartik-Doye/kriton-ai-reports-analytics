const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const pngRouteRegex = /app\.get\('\/api\/job\/:jobId\/download\/png', async \(req, res\) => \{[\s\S]*?\}\);/g;
code = code.replace(pngRouteRegex, "");

code = code.replace(
  /archive\.append\(Buffer\.from\(job\.dashboardImage\.replace\(\/\^data:image\\\\\/\\\\w\+;base64,\/, ''\), 'base64'\), \{ name: 'dashboard\.png' \}\);/,
  ""
);

fs.writeFileSync('server.ts', code);
