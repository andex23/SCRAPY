export interface ScheduledJob {
  id: string;
  url: string;
  modules: string[];
  interval: number; // minutes
  lastRun?: number;
  nextRun: number;
  enabled: boolean;
}

const SCHEDULER_KEY = 'scrape_scheduler';

export function saveScheduledJob(job: ScheduledJob): void {
  if (typeof window === 'undefined') return;

  try {
    const jobs = getScheduledJobs();
    const existingIndex = jobs.findIndex((j) => j.id === job.id);
    
    if (existingIndex >= 0) {
      jobs[existingIndex] = job;
    } else {
      jobs.push(job);
    }

    localStorage.setItem(SCHEDULER_KEY, JSON.stringify(jobs));
  } catch (error) {
    console.error('Failed to save scheduled job:', error);
  }
}

export function getScheduledJobs(): ScheduledJob[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(SCHEDULER_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load scheduled jobs:', error);
    return [];
  }
}

export function deleteScheduledJob(id: string): void {
  if (typeof window === 'undefined') return;

  try {
    const jobs = getScheduledJobs();
    const filtered = jobs.filter((job) => job.id !== id);
    localStorage.setItem(SCHEDULER_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete scheduled job:', error);
  }
}

export function updateJobNextRun(id: string, nextRun: number): void {
  if (typeof window === 'undefined') return;

  try {
    const jobs = getScheduledJobs();
    const job = jobs.find((j) => j.id === id);
    if (job) {
      job.lastRun = Date.now();
      job.nextRun = nextRun;
      saveScheduledJob(job);
    }
  } catch (error) {
    console.error('Failed to update job:', error);
  }
}

// Check for jobs that need to run (client-side polling)
export function checkScheduledJobs(callback: (job: ScheduledJob) => void): void {
  if (typeof window === 'undefined') return;

  const jobs = getScheduledJobs().filter((job) => job.enabled);
  const now = Date.now();

  jobs.forEach((job) => {
    if (job.nextRun <= now) {
      callback(job);
      // Update next run time
      const nextRun = now + job.interval * 60 * 1000;
      updateJobNextRun(job.id, nextRun);
    }
  });
}
