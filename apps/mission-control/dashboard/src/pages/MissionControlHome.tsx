import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, CalendarDays, ClipboardList, MessageSquare, Network, ShieldCheck, Workflow } from 'lucide-react';
import { ShellCard } from '../components/ShellCard';
import { fetchJson, formatWhen } from '../lib/api';

type SystemStatus = {
  ok?: boolean;
  totals?: { artifacts?: number; knowledge_documents_v2?: number; knowledge_chunks_v2?: number; events_v2?: number; review_queue?: number };
  counts_by?: { event_level?: Array<{ event_level: string; n: number }>; review_status?: Array<{ status: string; n: number }> };
  last_event_at?: string | null;
  ingestion_activity_24h?: { has_activity?: boolean; count?: number };
};

type CrmTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_at: string | null;
  created_at: string;
  contact_full_name: string | null;
};

type ActivityEvent = { id: string; event_type: string; event_level: string; occurred_at: string; actor: string | null; artifact_id: string | null };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MissionControlHome() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchJson<SystemStatus>('/api/system-status').catch(() => null),
      fetchJson<{ tasks: CrmTask[] }>('/api/v1/crm/tasks?review_status=all&status=open&limit=40').catch(() => ({ tasks: [] as CrmTask[] })),
      fetchJson<{ events: ActivityEvent[] }>('/api/activity?hours=48').catch(() => ({ events: [] as ActivityEvent[] })),
    ])
      .then(([status, taskResult, activity]) => {
        if (cancelled) return;
        setSystemStatus(status);
        setTasks(taskResult.tasks || []);
        setEvents(activity.events || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reviewQueued = systemStatus?.counts_by?.review_status?.find?.((r) => r.status === 'queued')?.n ?? 0;

  const withDueDate = useMemo(() => tasks.filter((t) => t.due_at).sort((a, b) => (a.due_at! < b.due_at! ? -1 : 1)), [tasks]);
  const upcoming = withDueDate.filter((t) => !t.due_at || new Date(t.due_at) >= now);

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.16),_transparent_35%),linear-gradient(180deg,rgba(8,12,20,0.98),rgba(6,10,18,0.96))] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold text-sky-100">
              <Bot className="h-3.5 w-3.5" />
              Mission Control
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">One surface for the whole operation.</h1>
            <p className="mt-2 text-sm leading-6 text-white/60">
              System state, approval-gated tasks, scheduled appointments, and live agent activity — without opening a second tab.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 lg:w-[30rem]">
            <Metric label="Queued reviews" value={loading ? '…' : reviewQueued} detail="Approval-gated" />
            <Metric label="Open tasks" value={loading ? '…' : tasks.length} detail="CRM work" />
            <Metric label="Events" value={loading ? '…' : (systemStatus?.totals?.events_v2 ?? '—')} detail="48h activity" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <JumpTile icon={<MessageSquare className="h-4 w-4 text-sky-300" />} label="Chat" to="/chat" helper="Talk to agents" />
          <JumpTile icon={<Workflow className="h-4 w-4 text-violet-300" />} label="Agents" to="/agents" helper="Canvas & board" />
          <JumpTile icon={<ClipboardList className="h-4 w-4 text-emerald-300" />} label="CRM" to="/crm" helper="Customers & tasks" />
          <JumpTile icon={<Network className="h-4 w-4 text-amber-300" />} label="Solar" to="/solar/leads" helper="Lead inbox" />
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[1fr_1.05fr]">
        <ShellCard
          title="Upcoming schedule"
          subtitle="Appointments and tasks with a due date."
          right={<CalendarDays className="h-4 w-4 text-white/40" />}
        >
          <MonthCalendar tasks={withDueDate} month={now} />
          <div className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Next due</div>
            <div className="mt-2 space-y-2">
              {upcoming.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{t.title}</div>
                    <div className="mt-0.5 text-xs text-white/45">{t.contact_full_name ? `for ${t.contact_full_name}` : '—'}</div>
                  </div>
                  <div className="shrink-0 text-xs font-semibold text-white/70">{formatDay(t.due_at)}</div>
                </div>
              ))}
              {upcoming.length === 0 && <div className="text-sm text-white/45">Nothing scheduled yet.</div>}
            </div>
          </div>
        </ShellCard>

        <div className="space-y-4 sm:space-y-6">
          <ShellCard title="Open tasks" subtitle="Review-gated CRM work waiting on a decision." right={<Link to="/crm/tasks" className="text-xs font-semibold text-sky-200 hover:text-sky-100">Open queue</Link>}>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {tasks.length === 0 ? (
                <div className="text-sm text-white/45">No open tasks right now.</div>
              ) : (
                tasks.slice(0, 8).map((t) => (
                  <Link key={t.id} to="/crm/tasks" className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 hover:border-white/25 transition">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{t.title}</div>
                      <div className="mt-1 text-xs text-white/45 line-clamp-2">{t.description || 'No description.'}</div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                      t.status === 'done' ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
                      : t.status === 'needs_review' ? 'border-amber-400/25 bg-amber-400/10 text-amber-100'
                      : 'border-white/10 bg-white/5 text-white/60'
                    }`}>{t.status}</span>
                  </Link>
                ))
              )}
            </div>
          </ShellCard>

          <ShellCard title="Live activity" subtitle="Recent agent and system events." right={
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-100">
              <span className={`h-1.5 w-1.5 rounded-full ${systemStatus?.ingestion_activity_24h?.has_activity ? 'bg-emerald-400 animate-pulse' : 'bg-white/30'}`} />
              {systemStatus?.ingestion_activity_24h?.has_activity ? 'Active' : 'Quiet'}
            </span>
          }>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {events.slice(0, 10).map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{e.event_type}</div>
                    <div className="mt-1 text-xs text-white/45">{e.actor || 'system'}{e.artifact_id ? ` • ${String(e.artifact_id).slice(0, 12)}` : ''}</div>
                  </div>
                  <div className="shrink-0 text-[11px] text-white/45">{formatWhen(e.occurred_at)}</div>
                </div>
              ))}
              {events.length === 0 && <div className="text-sm text-white/45">No recent activity.</div>}
            </div>
            <div className="mt-3 border-t border-white/5 pt-3 text-xs text-white/40">
              Last event: {formatWhen(systemStatus?.last_event_at)} • <Link to="/system/activity" className="text-sky-200 hover:text-sky-100">full feed</Link>
            </div>
          </ShellCard>
        </div>
      </div>

      <ShellCard title="Safety posture" subtitle="How customer-facing work stays controlled." right={<ShieldCheck className="h-4 w-4 text-emerald-300" />}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-semibold">Approval-gated outbound</div>
            <p className="mt-1 text-xs text-white/55">SMS, email, calls, and appointments start as internal draft tasks. Nothing sends without a human review decision.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-semibold">One surface, one scope</div>
            <p className="mt-1 text-xs text-white/55">Mission Control is the operator surface. Solar keeps its own lead inbox; CRM keeps its customers. No duplicate entry points.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="text-sm font-semibold">Tenant isolation</div>
            <p className="mt-1 text-xs text-white/55">Every record is scoped to the active tenant, keeping the CRM module safe to expose to customers later.</p>
          </div>
        </div>
      </ShellCard>
    </div>
  );
}

function formatDay(dueAt: string | null) {
  if (!dueAt) return '';
  try {
    return new Date(dueAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function MonthCalendar(props: { tasks: CrmTask[]; month: Date }) {
  const { tasks, month } = props;
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leading = firstDay.getDay();

  const byDay = useMemo(() => {
    const map = new Map<number, CrmTask[]>();
    for (const t of tasks) {
      if (!t.due_at) continue;
      const d = new Date(t.due_at);
      if (d.getFullYear() === year && d.getMonth() === monthIndex) {
        const day = d.getDate();
        if (!map.has(day)) map.set(day, []);
        map.get(day)!.push(t);
      }
    }
    return map;
  }, [tasks, year, monthIndex]);

  const cells = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d: number) => d === nowDay() && month.getMonth() === nowMonth() && month.getFullYear() === nowYear();

  return (
    <div>
      <div className="mb-2 text-sm font-semibold capitalize">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-widest text-white/35">{w}</div>
        ))}
        {cells.map((day, i) => {
          if (day == null) return <div key={`e${i}`} />;
          const dayTasks = byDay.get(day) || [];
          return (
            <div
              key={day}
              className={`min-h-[52px] rounded-xl border p-1.5 ${
                isToday(day)
                  ? 'border-sky-400/50 bg-sky-400/10'
                  : dayTasks.length > 0
                    ? 'border-white/15 bg-black/20'
                    : 'border-white/5 bg-white/[0.02]'
              }`}
            >
              <div className={`text-xs font-semibold ${isToday(day) ? 'text-sky-100' : 'text-white/55'}`}>{day}</div>
              <div className="mt-1 space-y-0.5">
                {dayTasks.slice(0, 2).map((t) => (
                  <div key={t.id} className="truncate rounded bg-emerald-400/15 px-1 py-0.5 text-[9px] font-medium text-emerald-100" title={t.title}>{t.title}</div>
                ))}
                {dayTasks.length > 2 && <div className="px-1 text-[9px] text-white/40">+{dayTasks.length - 2} more</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function nowDay() { return new Date().getDate(); }
function nowMonth() { return new Date().getMonth(); }
function nowYear() { return new Date().getFullYear(); }

function Metric(props: { label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{props.label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{props.value}</div>
      <div className="mt-1 text-xs text-slate-400">{props.detail}</div>
    </div>
  );
}

function JumpTile(props: { icon: React.ReactNode; label: string; to: string; helper: string }) {
  return (
    <Link to={props.to} className="group rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-sky-500/40 hover:bg-slate-950">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 group-hover:text-slate-200">
        {props.icon}
        {props.label}
      </div>
      <div className="mt-2 text-sm text-white">{props.helper}</div>
    </Link>
  );
}
