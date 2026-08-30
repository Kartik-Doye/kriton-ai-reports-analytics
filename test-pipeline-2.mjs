import fs from 'fs';

async function run() {
  const formData = new FormData();
  formData.append('email', 'test@example.com');
  formData.append('file', new Blob(['id,val\n1,10\n2,20\n3,30']), 'test.csv');

  console.log('Uploading...');
  const res = await fetch('http://localhost:3000/api/upload', { method: 'POST', body: formData });
  const data = await res.json();
  console.log('Upload response:', data);
  if (!data.jobId) return;

  console.log('Connecting to SSE...');
  const sseRes = await fetch(`http://localhost:3000/api/job/${data.jobId}/stream?token=${data.jobToken}`);
  const reader = sseRes.body.getReader();
  const decoder = new TextDecoder();

  const timer = setTimeout(() => {
     console.log('Timeout (60s)');
     process.exit(1);
  }, 60000);

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    console.log('SSE chunk:', chunk);
    if (chunk.includes('"status":"error"') || chunk.includes('"status":"complete"')) {
       break;
    }
  }
  clearTimeout(timer);
}
run();
