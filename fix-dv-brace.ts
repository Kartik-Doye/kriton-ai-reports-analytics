import fs from 'fs';
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');
code = code.replace(
  '        </div>\n      ))}\n      {autoExport',
  '        </div>\n      })}\n      {autoExport'
);
fs.writeFileSync('src/components/DashboardView.tsx', code);
