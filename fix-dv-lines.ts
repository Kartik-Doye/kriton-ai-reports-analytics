import fs from 'fs';
const lines = fs.readFileSync('src/components/DashboardView.tsx', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('Show More Charts') || l.includes('More Charts'));
if (start !== -1) {
  let idx = start;
  while (!lines[idx].includes('<div className="mt-auto">') && idx < lines.length) {
    idx++;
  }
  
  // replace from start+3 to idx-2
  lines.splice(start + 3, idx - (start + 3) - 1,
    '          )}',
    '          </>',
    '          )}',
    '          </>',
    '          )}',
    '          {(viewMode === \'detailed\' || autoExport) && ('
  );
  fs.writeFileSync('src/components/DashboardView.tsx', lines.join('\n'));
}
