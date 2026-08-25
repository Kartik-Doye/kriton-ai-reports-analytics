import re

with open('server.ts', 'r') as f:
    content = f.read()

# Fix sendEmail missing argument
# In server.ts, sendEmail takes 2 arguments, the second is now optional? Let's make options optional, or default it to {}.
# Instead of `options: { to: string, cc?: string, bcc?: string, subject?: string, body?: string }`, let's make the whole options parameter optional.

content = content.replace(
    "async function sendEmail(job: PipelineJob, options: { to: string, cc?: string, bcc?: string, subject?: string, body?: string }) {",
    "async function sendEmail(job: PipelineJob, options: { to?: string, cc?: string, bcc?: string, subject?: string, body?: string } = {}) {"
)

with open('server.ts', 'w') as f:
    f.write(content)

with open('src/components/UploadForm.tsx', 'r') as f:
    upload_content = f.read()

# Fix duplicate identifiers
upload_content = upload_content.replace(
    "import { initAuth, googleSignIn, logout, getAccessToken } from '../lib/auth';\nimport { User } from 'firebase/auth';",
    "// auth imports handled below", 
    1
)

with open('src/components/UploadForm.tsx', 'w') as f:
    f.write(upload_content)

