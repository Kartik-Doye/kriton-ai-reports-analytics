const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(/const attachments = \[\n    \{ filename: 'report\.pdf', content: job\.reportPdf! \}\n  \];\n  \);\n  \}/g, "const attachments = [{ filename: 'report.pdf', content: job.reportPdf! }];");

fs.writeFileSync('server.ts', code);
