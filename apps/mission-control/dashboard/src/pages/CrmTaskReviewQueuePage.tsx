import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ShellCard } from '../components/ShellCard';
import { fetchJson, formatWhen } from '../lib/api';

type CrmTask = {
  id: string;
  title: string | null;
  description: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  created_at: string | null;
  contact?: { source_person_id: string | null; full_name: string | null; primary_email: string | null; primary_phone: string | null } | null;
  account?: { name: string | null } | null;
  review: { status: string; approval_required: boolean; decision_notes?: string | null };
  safety: { customer_facing: boolean; external_action_taken: boolean; draft_only: boolean };
};

function Pill(props: { children: string | number | boolean | null | undefined; tone?: 'green' | 'blue' | 'amber' | 'red' | 'gray' }) {
  const tone = props.tone || 'gray';
  const classes = {
    green: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
    blue: 'border-sky-400/25 bg-sky-400/10 text-sky-100',
    amber: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
    red: 'border-red-400/25 bg-red-400/10 text-red-100',
    gray: 'border-white/10 bg-white/5 text-white/65',
  }[tone];
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}>{String(props.children ?? 'unknown')}</span>;
}

export default function CrmTaskReviewQueuePage() {
  const [searchParams] = useSearchParams();
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const reviewStatus = searchParams.get('review_status') || 'queued';

  const loadTasks = () => {
    setLoading(true);
    setError(null);
    fetchJson<{ tasks: CrmTask[] }>(`/api/v1/crm/tasks?review_status=${encodeURIComponent(reviewStatus)}&limit=50`)
      .then((result) => setTasks(result.tasks || []))
      .catch((e) => setError(e?.message || String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTasks();
  }, [reviewStatus]);

  const decide = async (taskId: string, decision: 'approved' | 'changes_requested' | 'rejected') => {
    setBusyTask(taskId);
    setError(null);
    try {
      await fetchJson(`/api/v1/crm/tasks/${taskId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes: `${decision} from CRM internal review queue` }),
      });
      loadTasks();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusyTask(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link to="/crm" className="text-sm font-semibold text-sky-200 hover:text-sky-100">← CRM / Entities</Link>
        <Pill tone="green">Internal review only</Pill>
      </div>

      <ShellCard title="CRM task review queue" subtitle="Approval-gated internal CRM tasks. No customer-facing send or external action happens here.">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/45">Review status</div>
            <div className="mt-2 text-xl font-bold">{reviewStatus}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/45">Queued items</div>
            <div className="mt-2 text-xl font-bold">{tasks.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-xs text-white/45">Safety posture</div>
            <div className="mt-2 text-sm font-semibold text-emerald-100">Draft / approval required</div>
          </div>
        </div>
        {error && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>}
      </ShellCard>

      <ShellCard title="Tasks" subtitle="Review internal work before anyone acts on it.">
        <div className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/45">Loading CRM tasks…</div>
          ) : tasks.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/45">No CRM tasks in this queue.</div>
          ) : (
            tasks.map((task) => (
              <div key={task.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="font-semibold">{task.title || 'Untitled task'}</div>
                    <div className="mt-1 text-xs text-white/45">
                      {task.contact?.full_name || 'No linked contact'} • {task.account?.name || 'No account'} • created {formatWhen(task.created_at)}
                    </div>
                    {task.description && <div className="mt-3 text-sm text-white/70">{task.description}</div>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Pill tone="blue">{task.priority}</Pill>
                      <Pill tone="amber">{task.review.status}</Pill>
                      <Pill tone={task.safety.customer_facing ? 'red' : 'green'}>{`customer_facing=${task.safety.customer_facing}`}</Pill>
                      <Pill tone={task.safety.external_action_taken ? 'red' : 'green'}>{`external_action=${task.safety.external_action_taken}`}</Pill>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {task.contact?.source_person_id && (
                      <Link className="rounded-full border border-white/10 px-3 py-2 text-xs text-sky-100 hover:bg-white/10" to={`/crm/people/${task.contact.source_person_id}/timeline`}>
                        Open profile
                      </Link>
                    )}
                    <button disabled={busyTask === task.id} onClick={() => decide(task.id, 'approved')} className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-100 disabled:opacity-50">Approve</button>
                    <button disabled={busyTask === task.id} onClick={() => decide(task.id, 'changes_requested')} className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-100 disabled:opacity-50">Changes</button>
                    <button disabled={busyTask === task.id} onClick={() => decide(task.id, 'rejected')} className="rounded-full border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-100 disabled:opacity-50">Reject</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ShellCard>
    </div>
  );
}
