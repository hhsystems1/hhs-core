import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchJson, formatWhen } from '../../lib/api';

type PanelRecord = {
  type: 'person' | 'contact' | 'opportunity' | 'account';
  id: string;
  label: string;
};

type TimelineEvent = {
  id: string;
  event_type: string;
  event_level: string;
  occurred_at: string | null;
  source_channel: string | null;
  title: string | null;
  description: string | null;
  payload_json: Record<string, unknown>;
};

type CrmTask = {
  id: string;
  title: string | null;
  status: string;
  priority: string;
  review: { status: string };
  created_at: string | null;
};

type PersonDetail = {
  id: string;
  full_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  notes: string | null;
  lifecycle_stage: string | null;
  created_at: string | null;
  updated_at: string | null;
  crm_contact?: {
    id: string;
    account_id: string | null;
    status: string;
    account_name: string | null;
  } | null;
};

export default function RecordDetailPanel({ record, onClose }: { record: PanelRecord | null; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [personData, setPersonData] = useState<PersonDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'tasks' | 'info'>('timeline');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('normal');
  const [creatingTask, setCreatingTask] = useState(false);

  useEffect(() => {
    if (!record || record.type !== 'person') return;
    let cancelled = false;
    const personId = record.id;
    Promise.all([
      fetchJson<{ person: PersonDetail }>(`/api/v1/crm/people/${personId}`),
      fetchJson<{ timeline: TimelineEvent[] }>(`/api/v1/crm/people/${personId}/timeline?limit=50`),
      fetchJson<{ tasks: CrmTask[] }>(`/api/v1/crm/tasks?person_id=${personId}&limit=50`),
    ])
      .then(([personRes, timelineRes, tasksRes]) => {
        if (cancelled) return;
        setPersonData(personRes.person);
        setTimeline(timelineRes.timeline || []);
        setTasks(tasksRes.tasks || []);
      })
      .catch(() => {
        if (!cancelled) setPersonData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [record]);

  const createTask = async () => {
    const title = newTaskTitle.trim();
    if (!title || !record || record.type !== 'person') return;
    setCreatingTask(true);
    try {
      await fetchJson(`/api/v1/crm/people/${record.id}/tasks/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, priority: newTaskPriority }),
      });
      setNewTaskTitle('');
      setNewTaskPriority('normal');
      // reload tasks
      const tasksRes = await fetchJson<{ tasks: CrmTask[] }>(`/api/v1/crm/tasks?person_id=${record.id}&limit=50`);
      setTasks(tasksRes.tasks || []);
    } catch {
      // ignore
    } finally {
      setCreatingTask(false);
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (record) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [record, onClose]);

  if (!record) return null;

  const displayType = record.type;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div ref={panelRef} className="fixed top-0 right-0 h-full w-full max-w-lg bg-zinc-900 border-l border-white/10 z-50 shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-zinc-900 border-b border-white/10 z-10">
          <div className="flex items-center justify-between p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  displayType === 'person' ? 'bg-sky-400/15 text-sky-200' :
                  displayType === 'contact' ? 'bg-emerald-400/15 text-emerald-200' :
                  displayType === 'opportunity' ? 'bg-amber-400/15 text-amber-200' :
                  'bg-purple-400/15 text-purple-200'
                }`}>{displayType}</span>
                {personData?.crm_contact && (
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    personData.crm_contact.status === 'active' ? 'bg-emerald-400/15 text-emerald-200' : 'bg-white/10 text-white/50'
                  }`}>{personData.crm_contact.status}</span>
                )}
              </div>
              <div className="mt-1 text-lg font-bold truncate">{record.label}</div>
            </div>
            <button onClick={onClose} className="shrink-0 rounded-full p-1.5 hover:bg-white/10 text-white/60 hover:text-white transition">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          {displayType === 'person' && personData && (
            <div className="px-4 pb-3 space-y-1 text-sm">
              <div className="flex items-center gap-3 text-white/70">
                {personData.primary_email && <span className="truncate">{personData.primary_email}</span>}
                {personData.primary_phone && <span>{personData.primary_phone}</span>}
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-white/40">
                <span>Lifecycle: {personData.lifecycle_stage || 'unknown'}</span>
                <span>Created: {formatWhen(personData.created_at)}</span>
                {personData.crm_contact?.account_name && <span>Account: {personData.crm_contact.account_name}</span>}
              </div>
            </div>
          )}
        </div>

        <div className="flex border-b border-white/10 sticky top-[116px] bg-zinc-900 z-10">
          {(['timeline', 'tasks', 'info'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveSubTab(tab)}
              className={`flex-1 px-3 py-2 text-xs font-medium text-center transition ${
                activeSubTab === tab ? 'text-white border-b-2 border-sky-400' : 'text-white/40 hover:text-white/70'
              }`}
            >{tab === 'timeline' ? `Activity (${timeline.length})` : tab === 'tasks' ? `Tasks (${tasks.length})` : 'Details'}</button>
          ))}
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-sm text-white/40 text-center py-8">Loading...</div>
          ) : activeSubTab === 'timeline' ? (
            timeline.length === 0 ? (
              <div className="text-sm text-white/30 text-center py-8">No activity yet</div>
            ) : (
              <div className="space-y-2">
                {timeline.map((ev) => (
                  <div key={ev.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-semibold text-white/80">{ev.title || ev.event_type}</div>
                      <span className="shrink-0 text-[10px] text-white/35">{formatWhen(ev.occurred_at)}</span>
                    </div>
                    {ev.description && <div className="mt-1 text-xs text-white/50 line-clamp-2">{ev.description}</div>}
                    <div className="mt-1.5 flex flex-wrap gap-1 text-[10px] text-white/30">
                      <span>{ev.event_type}</span>
                      {ev.source_channel && <span>via {ev.source_channel}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeSubTab === 'tasks' ? (
            <div className="space-y-3">
              {record.type === 'person' && (
                <div className="flex gap-2">
                  <input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)}
                    placeholder="New task title..."
                    className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-300/50"
                    onKeyDown={(e) => { if (e.key === 'Enter') createTask(); }}
                  />
                  <select value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-xs text-white outline-none focus:border-sky-300/50"
                  >
                    <option value="normal">normal</option>
                    <option value="high">high</option>
                    <option value="urgent">urgent</option>
                    <option value="low">low</option>
                  </select>
                  <button onClick={createTask} disabled={creatingTask || !newTaskTitle.trim()}
                    className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100 disabled:opacity-50 hover:bg-emerald-400/20"
                  >{creatingTask ? '...' : 'Add'}</button>
                </div>
              )}
              {tasks.length === 0 ? (
                <div className="text-sm text-white/30 text-center py-8">No tasks</div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                  <div key={task.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold">{task.title || 'Untitled'}</div>
                      <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        task.status === 'open' ? 'bg-amber-400/10 text-amber-200 border border-amber-400/20' :
                        task.status === 'completed' ? 'bg-emerald-400/10 text-emerald-200 border border-emerald-400/20' :
                        'bg-white/10 text-white/50 border border-white/10'
                      }`}>{task.status}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] text-white/40">
                      <span>{task.priority}</span>
                      <span>Review: {task.review.status}</span>
                      <span>{formatWhen(task.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              {personData?.notes && (
                <div>
                  <div className="text-xs font-semibold text-white/50 mb-1">Notes</div>
                  <div className="text-white/70 whitespace-pre-wrap">{personData.notes}</div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-white/40">Created</div>
                  <div className="mt-0.5 text-white/80">{formatWhen(personData?.created_at)}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-white/40">Updated</div>
                  <div className="mt-0.5 text-white/80">{formatWhen(personData?.updated_at)}</div>
                </div>
              </div>
              {record.type === 'person' && (
                <div className="flex gap-2 pt-2">
                  <Link to={`/crm/people/${record.id}/timeline`}
                    className="flex-1 text-center rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-400/20"
                  >Full profile →</Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
