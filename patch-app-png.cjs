const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const pngBtnRegex = /<a href=\{`\/api\/job\/\$\{jobId\}\/download\/png\?token=\$\{jobToken\}`\} download className="group relative overflow-hidden inline-flex items-center justify-center px-6 py-3 border border-slate-200\/50 dark:border-white\/10 text-sm font-semibold rounded-xl shadow-sm text-slate-700 dark:text-slate-200 bg-white\/50 dark:bg-white\/5 hover:bg-white dark:hover:bg-white\/10 focus:outline-none transition-all hover:scale-105">\s*Download PNG\s*<\/a>/g;
code = code.replace(pngBtnRegex, "");

fs.writeFileSync('src/App.tsx', code);
