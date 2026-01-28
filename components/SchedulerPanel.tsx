'use client';

import { useState, useEffect } from 'react';
import {
  ScheduledJob,
  getScheduledJobs,
  saveScheduledJob,
  deleteScheduledJob,
  checkScheduledJobs,
} from '@/lib/scheduler';

interface SchedulerPanelProps {
  onRunJob: (job: ScheduledJob) => void;
  onClose: () => void;
}

export default function SchedulerPanel({ onRunJob, onClose }: SchedulerPanelProps) {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newJob, setNewJob] = useState({
    url: '',
    modules: ['images'] as string[],
    interval: 60,
  });

  useEffect(() => {
    setJobs(getScheduledJobs());
    
    // Check for jobs every minute
    const interval = setInterval(() => {
      checkScheduledJobs((job) => {
        onRunJob(job);
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [onRunJob]);

  const handleAdd = () => {
    if (!newJob.url.trim()) return;

    const job: ScheduledJob = {
      id: Date.now().toString(),
      url: newJob.url.startsWith('http') ? newJob.url : `https://${newJob.url}`,
      modules: newJob.modules,
      interval: newJob.interval,
      nextRun: Date.now() + newJob.interval * 60 * 1000,
      enabled: true,
    };

    saveScheduledJob(job);
    setJobs(getScheduledJobs());
    setNewJob({ url: '', modules: ['images'], interval: 60 });
    setShowAdd(false);
  };

  const handleToggle = (job: ScheduledJob) => {
    job.enabled = !job.enabled;
    saveScheduledJob(job);
    setJobs(getScheduledJobs());
  };

  const handleDelete = (id: string) => {
    deleteScheduledJob(id);
    setJobs(getScheduledJobs());
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg text-foreground">scheduled scraping</h3>
          <button onClick={onClose} className="text-accent hover:text-foreground">
            ×
          </button>
        </div>

        {!showAdd ? (
          <div className="space-y-4">
            <button
              onClick={() => setShowAdd(true)}
              className="w-full px-4 py-2 bg-accent hover:bg-foreground text-background rounded text-sm"
            >
              + add scheduled job
            </button>

            {jobs.length === 0 ? (
              <p className="text-sm text-accent/60 text-center py-8">no scheduled jobs</p>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => {
                  const nextRun = new Date(job.nextRun);
                  return (
                    <div
                      key={job.id}
                      className="border border-border rounded p-3 hover:bg-hover/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-accent hover:text-foreground underline truncate block"
                          >
                            {job.url}
                          </a>
                          <div className="flex items-center gap-2 mt-1 text-xs text-accent/50">
                            <span>every {job.interval} min</span>
                            <span>•</span>
                            <span>{job.modules.join(', ')}</span>
                            <span>•</span>
                            <span>next: {nextRun.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggle(job)}
                            className={`px-3 py-1 text-xs rounded ${
                              job.enabled
                                ? 'bg-accent text-background'
                                : 'border border-border'
                            }`}
                          >
                            {job.enabled ? 'on' : 'off'}
                          </button>
                          <button
                            onClick={() => handleDelete(job.id)}
                            className="px-3 py-1 text-xs border border-border hover:bg-hover rounded"
                          >
                            delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-accent/50 mb-1 block">URL</label>
              <input
                type="text"
                value={newJob.url}
                onChange={(e) => setNewJob({ ...newJob, url: e.target.value })}
                placeholder="https://example.com"
                className="w-full px-3 py-2 text-sm border border-border bg-background rounded"
              />
            </div>

            <div>
              <label className="text-xs text-accent/50 mb-1 block">Modules (comma-separated)</label>
              <input
                type="text"
                value={newJob.modules.join(', ')}
                onChange={(e) =>
                  setNewJob({
                    ...newJob,
                    modules: e.target.value.split(',').map((m) => m.trim()),
                  })
                }
                placeholder="images, text, products"
                className="w-full px-3 py-2 text-sm border border-border bg-background rounded"
              />
            </div>

            <div>
              <label className="text-xs text-accent/50 mb-1 block">Interval (minutes)</label>
              <input
                type="number"
                min="1"
                value={newJob.interval}
                onChange={(e) =>
                  setNewJob({ ...newJob, interval: parseInt(e.target.value) || 60 })
                }
                className="w-full px-3 py-2 text-sm border border-border bg-background rounded"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="flex-1 px-4 py-2 bg-accent hover:bg-foreground text-background rounded text-sm"
              >
                save
              </button>
              <button
                onClick={() => {
                  setShowAdd(false);
                  setNewJob({ url: '', modules: ['images'], interval: 60 });
                }}
                className="px-4 py-2 border border-border hover:bg-hover rounded text-sm"
              >
                cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
