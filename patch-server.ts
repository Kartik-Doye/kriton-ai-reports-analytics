import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

// Remove nodemailer import
code = code.replace(/import nodemailer from 'nodemailer';\n/g, '');

// Remove email route
const emailRouteRegex = /app\.post\('\/api\/job\/:jobId\/email', async \(req: Request, res: Response\) => \{[\s\S]*?\}\);\n\n/g;
code = code.replace(emailRouteRegex, '');

// Remove sendEmail function
const sendEmailRegex = /\/\*\*[\s\S]*?async function sendEmail[\s\S]*?throw emailError;\n  \}\n\}\n/g;
code = code.replace(sendEmailRegex, '');

fs.writeFileSync('server.ts', code);
