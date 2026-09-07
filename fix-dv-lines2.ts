import fs from 'fs';
const lines = fs.readFileSync('src/components/DashboardView.tsx', 'utf8').split('\n');
const duplicateLineIdx = lines.findIndex((l, i) => l.includes('{(viewMode === \'detailed\' || autoExport) && (') && lines[i+1] && lines[i+1].includes('{(viewMode === \'detailed\' || autoExport) && ('));

if (duplicateLineIdx !== -1) {
  lines.splice(duplicateLineIdx, 1);
  fs.writeFileSync('src/components/DashboardView.tsx', lines.join('\n'));
}
