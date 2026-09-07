import fs from 'fs';
const code = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const regex = /<\/?([a-zA-Z0-9]+|)[^>]*>/g;
let match;
const stack = [];
const lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let m;
  const re = /<\/?([a-zA-Z0-9]+|)[^>]*>/g;
  while ((m = re.exec(line)) !== null) {
    const tag = m[0];
    if (tag.endsWith('/>')) continue; // self-closing
    if (tag.startsWith('</')) {
      const name = m[1];
      const last = stack.pop();
      if (!last || last.name !== name) {
        console.log(`Mismatch at line ${i+1}: expected </${last ? last.name : 'empty'}> but found </${name}>. Tag: ${tag}`);
      }
    } else {
      stack.push({ name: m[1], line: i+1 });
    }
  }
}
if (stack.length > 0) {
  console.log("Unclosed tags:", stack);
} else {
  console.log("All tags balanced perfectly!");
}
