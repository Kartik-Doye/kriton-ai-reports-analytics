const fs = require('fs');
let code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const effectRegex = /useEffect\(\(\) => \{[\s\S]*?if \(autoExport && !exported && containerRef\.current\) \{[\s\S]*?\}, \[autoExport, exported, jobId\]\);/g;
code = code.replace(effectRegex, "");

// Remove autoExport prop if we want, but it might be used to conditionally render things. We can keep it or remove it entirely.
// Since we don't capture the dashboard from UI anymore, we don't need autoExport to hide tabs. 
// Actually, `App.tsx` handles status 'waiting_for_dashboard'. If that status is gone, the pipeline just goes to 'complete'.

fs.writeFileSync('src/components/DashboardView.tsx', code);
