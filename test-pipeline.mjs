import fs from 'fs';
import fetch from 'node-fetch'; // Requires node-fetch or native fetch in node 22

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

// Poll status
let status = 'pending';
while(status !== 'complete' && status !== 'error') {
  await new Promise(r => setTimeout(r, 1000));
  const sRes = await fetch(`http://localhost:3000/api/job/${jobId}/status?token=${jobToken}`);
  const sData = await sRes.json();
  status = sData.status;
  console.log("Status:", status);
}

if(status === 'complete') {
  const pRes = await fetch(`http://localhost:3000/api/job/${jobId}/download/pdf?token=${jobToken}`);
  console.log("PDF length:", (await pRes.buffer()).length);
}
