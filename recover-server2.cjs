const fs = require('fs');
const map = JSON.parse(fs.readFileSync('dist/server.cjs.map', 'utf8'));
console.log(map.sources);
