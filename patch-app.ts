import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  'const [dataQuality, setDataQuality] = useState<any>(null);',
  'const [dataQuality, setDataQuality] = useState<any>(null);\n  const [cleaningLog, setCleaningLog] = useState<string>("");'
).replace(
  'setDataQuality(data.dataQuality);',
  'setDataQuality(data.dataQuality);\n        setCleaningLog(data.cleaningLog || "");'
).replace(
  'setDataQuality(null);',
  'setDataQuality(null);\n    setCleaningLog("");'
).replace(
  'dataQuality={dataQuality}',
  'dataQuality={dataQuality}\n                        cleaningLog={cleaningLog}'
);

fs.writeFileSync('src/App.tsx', code);
