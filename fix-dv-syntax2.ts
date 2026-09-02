import fs from 'fs';
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

code = code.replace(
  '          </div>\n          )}\n          )}',
  '          </div>\n          )}'
);

fs.writeFileSync('src/components/DashboardView.tsx', code);
