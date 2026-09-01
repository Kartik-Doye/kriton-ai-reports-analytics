import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'data={cleanedData}',
  'data={cleanedData}\n                        dataQuality={dataQuality}'
);

fs.writeFileSync('src/App.tsx', code);
