import re

with open('server.ts', 'r') as f:
    content = f.read()

old_email_catch = """  } catch (emailError: any) {
    console.error('Email sending failed:', emailError);
    sendEvent(job.id, 'log', { text: `Warning: Email delivery failed (${emailError.message}). You can still download the files below.` });
  }

  job.status = 'complete';
  sendEvent(job.id, 'status', { status: 'complete' });
  clients.delete(job.id);"""

new_email_catch = """  } catch (emailError: any) {
    console.error('Email sending failed:', emailError);
    sendEvent(job.id, 'log', { text: `Warning: Email delivery failed (${emailError.message}).` });
    throw emailError;
  }"""

content = content.replace(old_email_catch, new_email_catch)

with open('server.ts', 'w') as f:
    f.write(content)

