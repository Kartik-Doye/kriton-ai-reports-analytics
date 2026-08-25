import http from 'http';

async function run() {
  const fileContent = "id,name,value\n1,Alice,10\n2,Bob,20\n";
  const formData = new FormData();
  formData.append('file', new Blob([fileContent]), 'test.csv');
  formData.append('email', 'test@example.com');
  
  const res = await fetch('http://localhost:3000/api/upload', {
    method: 'POST',
    body: formData
  });
  
  const { jobId } = await res.json();
  console.log('Started job', jobId);

  const req = http.request(`http://localhost:3000/api/job/${jobId}/stream`, (res) => {
    let buffer = '';
    res.on('data', async (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep last incomplete line
      let eventName = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventName = line.substring(7);
        } else if (line.startsWith('data: ')) {
          const data = JSON.parse(line.substring(6));
          if (eventName === 'status') {
            console.log('STATUS:', data.status);
            if (data.status === 'complete') process.exit(0);
          } else if (eventName === 'log') {
            console.log('LOG:', data.text);
          } else if (eventName === 'error') {
            console.log('ERROR:', data.message);
            process.exit(1);
          } else if (eventName === 'spec') {
            console.log('Got SPEC, uploading image');
            const imgData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
            await fetch(`http://localhost:3000/api/job/${jobId}/dashboard-image`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: imgData })
            });
          }
        }
      }
    });
  });
  req.end();
}
run();
