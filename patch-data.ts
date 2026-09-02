import fs from 'fs';
let code = fs.readFileSync('src/utils/data-processing.ts', 'utf8');

code = code.replace(
  'const result = Papa.parse(buffer.toString(\'utf-8\'), { header: true, skipEmptyLines: true });\\n    return result.data;',
  `const seenHeaders = new Set<string>();
    let duplicateWarnings = 0;
    const result = Papa.parse(buffer.toString('utf-8'), { 
      header: true, 
      skipEmptyLines: true,
      transformHeader: (header) => {
        let newHeader = header.trim();
        if (!newHeader) newHeader = 'Untitled_Column';
        if (seenHeaders.has(newHeader)) {
          duplicateWarnings++;
          let i = 2;
          while (seenHeaders.has(\`\${newHeader}_\${i}\`)) i++;
          newHeader = \`\${newHeader}_\${i}\`;
        }
        seenHeaders.add(newHeader);
        return newHeader;
      }
    });
    
    // Check for missing headers (if the first row's headers look completely like data values, e.g. all numbers/dates)
    let looksLikeMissingHeaders = false;
    const headers = Array.from(seenHeaders);
    if (headers.length > 0 && headers.every(h => !isNaN(Number(h)) || !isNaN(Date.parse(h)))) {
       looksLikeMissingHeaders = true;
    }
    
    if (duplicateWarnings > 0) console.warn(\`Found \${duplicateWarnings} duplicate column headers.\`);
    if (looksLikeMissingHeaders) throw new Error("MissingHeadersError: We couldn't detect column headers — please confirm your file has a header row.");
    
    return result.data;`
);

fs.writeFileSync('src/utils/data-processing.ts', code);
