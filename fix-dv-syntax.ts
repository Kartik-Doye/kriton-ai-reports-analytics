import fs from 'fs';
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const regex = /          \}\)\n          <\/>\n          \}\)\n          \}\)\n          \{\(viewMode === 'detailed' \|\| autoExport\) && \(\n          <div className="mt-auto">/g;

code = code.replace(
  /          \}\)\n          <\/>\n          \}\)\n          \}\)\n          \{\(viewMode === 'detailed' \|\| autoExport\) && \(\n          <div className="mt-auto">/,
  `          )}
          </>
          )}
          </>
          )}
          {(viewMode === 'detailed' || autoExport) && (
          <div className="mt-auto">`
);

fs.writeFileSync('src/components/DashboardView.tsx', code);
