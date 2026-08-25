import re

with open('server.ts', 'r') as f:
    content = f.read()

old_report_gen = """  const reportResp = await withRetry(() => ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: prompt3
  }));

  job.reportText = reportResp.text || '';"""

new_report_gen = """  try {
    const reportResp = await withRetry(() => ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt3
    }));
    job.reportText = reportResp.text || '';
  } catch (aiError: any) {
    console.warn('AI report generation failed, using fallback:', aiError.message);
    sendEvent(job.id, 'log', { text: `Warning: AI narrative generation failed (${aiError.message}). Using fallback report.` });
    job.reportText = `# Executive Summary\\n\\nAutomated narrative generation was unavailable due to an AI service error (Quota Exceeded or similar).\\n\\nHowever, your cleaned dataset and dashboard have been successfully generated and are available for download.\\n\\n## Key Metrics\\n` + kpisWithValues.map(k => `- **${k.label}**: ${k.value}`).join('\\n');
  }"""

content = content.replace(old_report_gen, new_report_gen)

with open('server.ts', 'w') as f:
    f.write(content)

