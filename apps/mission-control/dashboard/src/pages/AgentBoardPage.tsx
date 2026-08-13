import { useEffect, useState } from 'react';
import { fetchJson } from '../lib/api';
import { AgentJobCard } from '../components/agents/AgentJobCard';
import type { AgentJob } from '../components/agents/AgentJobCard';

type Column = {
  id: string;
  title: string;
  status: string;
};

const COLUMNS: Column[] = [
  { id: 'intake', title: 'Intake', status: 'queued' },
  { id: 'planning', title: 'Planning', status: 'planning' },
  { id: 'approval', title: 'Awaiting Approval', status: 'needs_approval' },
  { id: 'running', title: 'Running', status: 'running' },
  { id: 'review', title: 'Review', status: 'review' },
  { id: 'done', title: 'Done', status: 'completed' },
  { id: 'failed', title: 'Failed', status: 'failed' },
];

export default function AgentBoardPage() {
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadJobs() {
      try {
        const result = await fetchJson<{ ok: boolean; jobs: AgentJob[] }>('/api/v1/jobs');
        if (result.ok) {
          setJobs(result.jobs);
        }
      } catch (e) {
        console.error('Failed to load board jobs:', e);
      } finally {
        setLoading(false);
      }
    }
    loadJobs();
  }, []);

  if (loading) {
    return (
      <div className="mc-page flex items-center justify-center min-h-[60vh]">
        <div className="text-white/40 animate-pulse">Loading Agent Board...</div>
      </div>
    );
  }

  return (
    <div className="mc-page space-y-6">
      <div className="mc-hero">
        <div>
          <div className="mc-eyebrow">Agent Operations</div>
          <h2>Agent Board</h2>
          <p>Real-time overview of all active agent workflows and execution states.</p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-6 snap-x">
        {COLUMNS.map((col) => (
          <div key={col.id} className="flex-shrink-0 w-80 snap-start space-y-4">
            <div className="flex items-center justify-between px-2 mb-2">
              <h3 className="text-sm font-bold uppercase tracking-widest text-white/60">
                {col.title}
              </h3>
              <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-white/40">
                {jobs.filter(j => j.status === col.status).length}
              </span>
            </div>
            
            <div className="space-y-3 min-h-[500px] rounded-2xl bg-white/[0.02] p-3 border border-white/5">
              {jobs
                .filter((job) => job.status === col.status)
                .map((job) => (
                  <AgentJobCard key={job.id} job={job} />
                ))}
              {jobs.filter(j => j.status === col.status).length === 0 && (
                <div className="text-center py-12 text-xs text-white/20 italic">
                  No jobs in this state
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}