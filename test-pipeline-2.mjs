import fs from 'fs';
import fetch from 'node-fetch'; 

const formData = new FormData();
const blob = new Blob(["id,name,value\n1,A,10\n2,B,20"], { type: 'text/csv' });
formData.append('file', blob, 'test.csv');
formData.append('email', 'test@example.com');

const res = await fetch('http://localhost:3000/api/upload', {
  method: 'POST',
  body: formData
});
const data = await res.json();
console.log("Upload result:", data);

const jobId = data.jobId;
const jobToken = data.jobToken;

// Poll PDF
let pdfOk = false;
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 2000));
  const pRes = await fetch(`http://localhost:3000/api/job/${jobId}/download/pdf?token=${jobToken}`);
  if (pRes.status === 200) {
    const buf = await pRes.buffer();
    console.log("PDF length:", buf.length);
    pdfOk = true;
    break;
  }
}
if (!pdfOk) {
  console.log("Timeout waiting for PDF");
}
