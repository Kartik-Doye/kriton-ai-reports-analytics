const fs = require('fs');
let code = fs.readFileSync('src/components/EmailModal.tsx', 'utf8');

// Remove attachHtml state
code = code.replace(/const \[attachHtml, setAttachHtml\] = useState\(false\);\n/, "");

// Remove attachHtml from onSend parameter
code = code.replace(/attachHtml: boolean/g, "");

// Remove the checkbox for HTML
const checkboxRegex = /<div className="flex items-center gap-2 mt-4 p-3 bg-blue-50 dark:bg-blue-900\/20 border border-blue-200 dark:border-blue-800 rounded-lg">[\s\S]*?<\/div>/;
code = code.replace(checkboxRegex, "");

// Remove the HTML file indicator from attachments section
const htmlIndicatorRegex = /\{attachHtml && \([\s\S]*?\}\)/;
code = code.replace(htmlIndicatorRegex, "");

// Update onSend call
code = code.replace(/onSend\(\{ to, cc, bcc, subject, body, attachHtml \}\)/g, "onSend({ to, cc, bcc, subject, body })");

fs.writeFileSync('src/components/EmailModal.tsx', code);
