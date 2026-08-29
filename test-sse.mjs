import fetch from 'node-fetch';
const res = await fetch('http://localhost:3000/api/job/5fbdb6a9-3062-475c-8555-d5fc2c0aade3/stream?token=45098194-05f7-4135-be9c-55435b44606b');
const text = await res.text();
console.log(text);
