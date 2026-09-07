const fs = require('fs');
let code = fs.readFileSync('server.ts.recovered', 'utf8');

// 1. Remove nodemailer import
code = code.replace(/import nodemailer from 'nodemailer';\n/, '');

// 2. Remove email route carefully (find app.post('/api/job/:jobId/email' and remove until its end)
const emailRouteStart = code.indexOf("app.post('/api/job/:jobId/email'");
if (emailRouteStart !== -1) {
  const emailRouteEnd = code.indexOf('});', emailRouteStart) + 3; // roughly, wait let's just find the next app. handler
  // actually, let's just use string parsing
  const nextApp = code.indexOf('app.', emailRouteStart + 10);
  code = code.substring(0, emailRouteStart) + code.substring(nextApp);
}

// 3. Remove sendEmail function carefully
const sendEmailStart = code.indexOf('async function sendEmail(');
if (sendEmailStart !== -1) {
  // Let's find the end of it. It ends with `throw emailError; } }`
  const endMarker = 'throw emailError;\n  }\n}';
  const endIdx = code.indexOf(endMarker, sendEmailStart);
  if (endIdx !== -1) {
    // Need to also remove the JSDoc block right above it
    const jsDocStart = code.lastIndexOf('/**', sendEmailStart);
    if (jsDocStart !== -1 && (sendEmailStart - jsDocStart < 200)) {
       code = code.substring(0, jsDocStart) + code.substring(endIdx + endMarker.length + 1);
    } else {
       code = code.substring(0, sendEmailStart) + code.substring(endIdx + endMarker.length + 1);
    }
  }
}

fs.writeFileSync('server.ts', code);
console.log('Fixed server.ts');
