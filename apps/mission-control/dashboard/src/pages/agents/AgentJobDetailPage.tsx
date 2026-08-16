import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchJson } from '../../lib/api';
import { AgentJobCard } from '../../components/agents/AgentJobCard';
import type { AgentJob } from '../../components/agents/AgentJobCard';
import { JobStatusBadge } from '../../components/agents/JobStatusBadge';
import { ShellCard } from '../../components/ShellCard';

export default function AgentJobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await fetchJson<{ ok: boolean; jobs: AgentJob[] }>('/api/v1/jobs');
        if (result.ok) setJobs(result.jobs);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-white/40 animate-pulse">Loading job...</div>;
  }

  const job = jobs.find((j) => j.id === jobId);
  const siblings = jobs.filter((j) => j.id !== jobId).slice(0, 8);

  if (!job) {
    return (
      <ShellCard title="Job not found" subtitle={`No agent job with id ${jobId}.`}>
        <Link to="/agents/board" className="text-sm font-semibold text-sky-200 hover:text-sky-100">Back to Job Board</Link>
      </ShellCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/agents/board" className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10">← Board</Link>
          <div>
            <div className="text-sm font-semibold">{job.capability}</div>
            <div className="mt-0.5 font-mono text-xs text-white/40">{job.id}</div>
          </div>
        </div>
        <JobStatusBadge status={job.status} />
      </div>

      <ShellCard title="Job details" subtitle={`Agent: ${job.agent_id}`}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <Detail label="Created" value={new Date(job.created_at).toLocaleString()} />
          <Detail label="Updated" value={new Date(job.updated_at).toLocaleString()} />
          <Detail label="Approval required" value={job.approval_required ? 'yes' : 'no'} />
          <Detail label="Status" value={job.status} />
        </div>
        {job.input && (
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-white/40">Input</div>
            <pre className="mt-2 max-h-72 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/70 whitespace-pre-wrap break-words">
              {typeof job.input === 'string' ? job.input : JSON.stringify(job.input, null, 2)}
            </pre>
          </div>
        )}
        {job.result && (
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-widest text-white/40">Result</div>
            <pre className="mt-2 max-h-96 overflow-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-white/70 whitespace-pre-wrap break-words">
              {typeof job.result === 'string' ? job.result : JSON.stringify(job.result, null, 2)}
            </pre>
          </div>
        )}
      </ShellCard>

      {siblings.length > 0 && (
        <ShellCard title="Recent jobs" subtitle="Latest jobs from the board.">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {siblings.map((j) => <AgentJobCard key={j.id} job={j} />)}
          </div>
        </ShellCard>
      )}
    </div>
  );
}

function Detail(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div className="text-xs text-white/45">{props.label}</div>
      <div className="mt-1 text-sm font-semibold break-words">{props.value}</div>
    </div>
  );
}
