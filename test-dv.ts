import fs from 'fs';
const code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');
const lines = code.split('\n');

let openDivs = 0;
let insideMap = false;
for (let i = 445; i < 635; i++) {
  const l = lines[i];
  if (l.includes('.map(page => {')) insideMap = true;
  if (insideMap) {
    const divs = (l.match(/<div/g) || []).length;
    const endDivs = (l.match(/<\/div>/g) || []).length;
    openDivs += divs - endDivs;
    console.log(`${i+1}: ${openDivs} ${l}`);
  }
}
