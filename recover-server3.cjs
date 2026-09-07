const fs = require('fs');
const map = JSON.parse(fs.readFileSync('dist/server.cjs.map', 'utf8'));
const index = map.sources.indexOf('../server.ts');
if (index !== -1) {
  fs.writeFileSync('server.ts.recovered', map.sourcesContent[index]);
  console.log('Recovered server.ts!');
} else {
  console.log('server.ts not found in sourcemap.');
}
