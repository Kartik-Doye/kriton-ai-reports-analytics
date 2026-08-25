import re

with open('server.ts', 'r') as f:
    content = f.read()

old_auth_check = """  if (!job.accessToken) {
    console.warn('No access token available. Skipping email.');
    sendEvent(job.id, 'log', { text: 'Not authenticated with Google, skipping email delivery.' });
    job.status = 'complete';
    sendEvent(job.id, 'status', { status: 'complete' });
    clients.delete(job.id);
    return;
  }"""

new_auth_check = """  if (!job.accessToken) {
    throw new Error('Not authenticated with Google. Cannot send email. Please ensure you logged in with Google and granted Gmail permissions.');
  }"""

content = content.replace(old_auth_check, new_auth_check)

with open('server.ts', 'w') as f:
    f.write(content)

