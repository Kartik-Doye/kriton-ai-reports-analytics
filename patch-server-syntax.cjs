const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Replace the invalid closing brackets
code = code.replace(/];\n  \);\n  \}/, "];");

fs.writeFileSync('server.ts', code);
