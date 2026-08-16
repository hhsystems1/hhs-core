import { Link } from 'react-router-dom';
import { JobStatusBadge } from './JobStatusBadge';

export interface AgentJob {
  id: string;
  tenant_id: string;
  agent_id: string;
  capability: string;
  status: string;
  approval_required: boolean;
  input: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export function AgentJobCard({ job }: { job: AgentJob }) {
  return (
    <Link 
      to={`/agents/jobs/${job.id}`} 
      className="group block rounded-2xl border border-white/10 bg-black/40 p-4 hover:border-white/30 transition-all hover:bg-white/5 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <JobStatusBadge status={job.status} />
        <div className="text-[10px] text-white/30 font-mono">{job.id.slice(0, 8)}</div>
      </div>
      
      <div className="mb-3">
        <div className="text-sm font-semibold text-white group-hover:text-white/80 truncate">
          {job.capability}
        </div>
        <div className="text-xs text-white/50 truncate">
          Agent: {job.agent_id}
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-white/30 mt-auto">
        <span>{new Date(job.created_at).toLocaleDateString()}</span>
        {job.approval_required && (
          <span className="text-yellow-500 font-bold">Approval Required</span>
        )}
      </div>
    </Link>
  );
}