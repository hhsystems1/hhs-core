import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchJson, formatWhen } from '../../lib/api';

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

const REVIEW_STATUSES = ['queued', 'approved', 'changes_requested', 'rejected'];
const STATUSES = ['all', 'open', 'in_progress', 'completed', 'cancelled'];

function Pill({ children, tone }: { children: string | number | boolean | null | undefined; tone?: 'green' | 'blue' | 'amber' | 'red' | 'gray' }) {
  const t = tone || 'gray';
  const classes = { green: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100', blue: 'border-sky-400/25 bg-sky-400/10 text-sky-100', amber: 'border-amber-400/25 bg-amber-400/10 text-amber-100', red: 'border-red-400/25 bg-red-400/10 text-red-100', gray: 'border-white/10 bg-white/5 text-white/65' }[t];
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${classes}`}>{String(children ?? 'unknown')}</span>;
}

function priorityColor(p: string) {
  if (p === 'urgent') return 'red';
  if (p === 'high') return 'amber';
  if (p === 'normal') return 'blue';
  if (p === 'low') return 'gray';
  return 'gray';
}

function statusColor(s: string) {
  if (s === 'open') return 'amber';
  if (s === 'in_progress') return 'blue';
  if (s === 'completed') return 'green';
  if (s === 'cancelled') return 'red';
  return 'gray';
}

export default function CrmTasksTab() {
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyTask, setBusyTask] = useState<string | null>(null);
  const [filterReview, setFilterReview] = useState('queued');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchText, setSearchText] = useState('');

  const loadTasks = () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ review_status: filterReview, limit: '100' });
    if (filterStatus !== 'all') params.set('status', filterStatus);
    fetchJson<{ tasks: CrmTask[] }>(`/api/v1/crm/tasks?${params.toString()}`)
      .then((result) => setTasks(result.tasks || []))
      .catch((e) => setError(e?.message || String(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTasks(); }, [filterReview, filterStatus]);

  const decide = async (taskId: string, decision: 'approved' | 'changes_requested' | 'rejected') => {
    setBusyTask(taskId);
    setError(null);
    try {
      await fetchJson(`/api/v1/crm/tasks/${taskId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes: `Reviewed from CRM workspace: ${decision}` }),
      });
      loadTasks();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyTask(null);
    }
  };

  const filtered = searchText
    ? tasks.filter((t) => (t.title || '').toLowerCase().includes(searchText.toLowerCase()) || (t.contact?.full_name || '').toLowerCase().includes(searchText.toLowerCase()))
    : tasks;

  const grouped = {
    queued: filtered.filter((t) => t.review.status === 'queued'),
    approved: filtered.filter((t) => t.review.status === 'approved'),
    changes_requested: filtered.filter((t) => t.review.status === 'changes_requested'),
    rejected: filtered.filter((t) => t.review.status === 'rejected'),
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1">
          {REVIEW_STATUSES.map((rs) => (
            <button key={rs} onClick={() => setFilterReview(rs)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                filterReview === rs ? 'bg-sky-400/15 text-sky-100 border border-sky-400/30' : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              }`}
            >{rs.replace('_', ' ')}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${
                filterStatus === s ? 'bg-white/10 text-white border border-white/20' : 'text-white/40 hover:text-white/70'
              }`}
            >{s}</button>
          ))}
        </div>
        <input value={searchText} onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search tasks..."
          className="ml-auto rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white outline-none focus:border-sky-300/50 w-44"
        />
      </div>

      {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{error}</div>}

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/45 text-center">Loading tasks...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/45 text-center">
          No tasks in {filterReview.replace('_', ' ')} status.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 text-xs text-white/40 px-1">
            <span>{filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>
            {Object.entries(grouped).map(([k, v]) => v.length > 0 && (
              <span key={k}>{k.replace('_', ' ')}: {v.length}</span>
            ))}
          </div>
          <div className="space-y-2">
            {filtered.map((task) => (
              <div key={task.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 hover:border-white/20 transition">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <div className="font-semibold text-sm">{task.title || 'Untitled task'}</div>
                      {task.due_at && new Date(task.due_at) < new Date() && task.status === 'open' && (
                        <span className="shrink-0 text-[10px] font-medium text-red-300 border border-red-400/30 bg-red-400/10 rounded-full px-2 py-0.5">overdue</span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-white/45">
                      {task.contact?.full_name || 'No contact'} {task.account?.name ? `• ${task.account.name}` : ''} • created {formatWhen(task.created_at)}
                    </div>
                    {task.description && <div className="mt-2 text-xs text-white/65 line-clamp-2">{task.description}</div>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Pill tone={priorityColor(task.priority)}>{task.priority}</Pill>
                      <Pill tone={statusColor(task.status)}>{task.status}</Pill>
                      <Pill tone={task.safety.draft_only ? 'amber' : 'green'}>{task.safety.draft_only ? 'draft' : 'live'}</Pill>
                      {task.safety.customer_facing && <Pill tone="red">customer-facing</Pill>}
                      {task.review.decision_notes && <Pill tone="gray">{task.review.decision_notes}</Pill>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    {task.contact?.source_person_id && (
                      <Link className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-sky-100 hover:bg-white/10" to={`/crm/people/${task.contact.source_person_id}/timeline`}>Profile</Link>
                    )}
                    {task.review.status === 'queued' && (
                      <>
                        <button disabled={busyTask === task.id} onClick={() => decide(task.id, 'approved')}
                          className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] text-emerald-100 disabled:opacity-50 hover:bg-emerald-400/20"
                        >Approve</button>
                        <button disabled={busyTask === task.id} onClick={() => decide(task.id, 'changes_requested')}
                          className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[10px] text-amber-100 disabled:opacity-50 hover:bg-amber-400/20"
                        >Changes</button>
                        <button disabled={busyTask === task.id} onClick={() => decide(task.id, 'rejected')}
                          className="rounded-full border border-red-400/25 bg-red-400/10 px-2.5 py-1 text-[10px] text-red-100 disabled:opacity-50 hover:bg-red-400/20"
                        >Reject</button>
                      </>
                    )}
                    {task.review.status !== 'queued' && (
                      <Pill tone={task.review.status === 'approved' ? 'green' : task.review.status === 'changes_requested' ? 'amber' : 'red'}>
                        {task.review.status}
                      </Pill>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
