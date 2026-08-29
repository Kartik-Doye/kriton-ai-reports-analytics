const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const htmlAttachmentRegex = /if \(options\.attachHtml && job\.reportHtml\) \{[\s\S]*?\}/;
code = code.replace(htmlAttachmentRegex, "");

fs.writeFileSync('server.ts', code);
