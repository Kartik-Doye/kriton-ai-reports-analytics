
export const logger = {
  info: (jobId: string, message: string, ...args: any[]) => {
    console.log(`[INFO] [Job: ${jobId}] ${message}`, ...args);
  },
  warn: (jobId: string, message: string, ...args: any[]) => {
    console.warn(`[WARN] [Job: ${jobId}] ${message}`, ...args);
  },
  error: (jobId: string, message: string, ...args: any[]) => {
    console.error(`[ERROR] [Job: ${jobId}] ${message}`, ...args);
  }
};
