import re

with open('server.ts', 'r') as f:
    content = f.read()

# Remove sendEmail from the POST dashboard-image handler
old_dashboard_handler = """  if (job.status === 'waiting_for_dashboard' && job.reportText) {
    job.reportPdf = await generateReportPdf(job.reportText, job.dashboardImage);
    job.status = 'emailing';
    sendEvent(jobId, 'status', { status: job.status });
    try {
      await sendEmail(job);
    } catch (err: any) {
      console.error(err);
      job.status = 'error';
      sendEvent(jobId, 'error', { message: err.message });
    }
  }"""

new_dashboard_handler = """  if (job.status === 'waiting_for_dashboard' && job.reportText) {
    job.reportPdf = await generateReportPdf(job.reportText, job.dashboardImage);
    job.status = 'complete';
    sendEvent(jobId, 'status', { status: job.status });
    clients.delete(jobId);
  }"""

content = content.replace(old_dashboard_handler, new_dashboard_handler)

# Remove sendEmail from runPipeline
old_runPipeline_finish = """  if (job.dashboardImage) {
    job.reportPdf = await generateReportPdf(job.reportText, job.dashboardImage);
    job.status = 'emailing';
    sendEvent(job.id, 'status', { status: job.status });
    await sendEmail(job);
  } else {
    job.reportPdf = await generateReportPdf(job.reportText);
    sendEvent(job.id, 'log', { text: 'Waiting for dashboard export to finish...' });
  }"""

new_runPipeline_finish = """  if (job.dashboardImage) {
    job.reportPdf = await generateReportPdf(job.reportText, job.dashboardImage);
    job.status = 'complete';
    sendEvent(job.id, 'status', { status: job.status });
    clients.delete(job.id);
  } else {
    job.reportPdf = await generateReportPdf(job.reportText);
    sendEvent(job.id, 'log', { text: 'Waiting for dashboard export to finish...' });
  }"""

content = content.replace(old_runPipeline_finish, new_runPipeline_finish)

with open('server.ts', 'w') as f:
    f.write(content)

