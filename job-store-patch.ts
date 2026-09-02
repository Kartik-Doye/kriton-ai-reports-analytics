import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), '.data', 'jobs');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function saveJobToDisk(job: any) {
  // Save everything except buffers
  const { originalBuffer, reportPdf, reportHtml, ...serializableJob } = job;
  fs.writeFileSync(path.join(DATA_DIR, `${job.id}.json`), JSON.stringify(serializableJob));
}

export function loadJobsFromDisk() {
  const jobs = new Map<string, any>();
  if (!fs.existsSync(DATA_DIR)) return jobs;
  
  const files = fs.readdirSync(DATA_DIR);
  for (const file of files) {
    if (file.endsWith('.json')) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
        jobs.set(data.id, data);
      } catch (e) {
        console.error("Failed to load job", file);
      }
    }
  }
  return jobs;
}
