import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bot, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, MessageSquare, ShieldCheck, Workflow, X } from 'lucide-react';
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
  contact?: { source_person_id?: string | null; full_name?: string | null } | null;
  appointment_status?: string | null;
  scheduled_at?: string | null;
};

type ActivityEvent = { id: string; event_type: string; event_level: string; occurred_at: string; actor: string | null; artifact_id: string | null };

type CalendarActivity = {
  id: string;
  kind: 'system' | 'communication';
  event_type: string;
  event_level: string;
  occurred_at: string;
  actor: string | null;
  source_channel: string | null;
  title: string;
  description: string | null;
  contact_name: string | null;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function MissionControlHome() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const [viewMonth, setViewMonth] = useState(() => new Date());
  const [monthData, setMonthData] = useState<{ tasks: CrmTask[]; activity: CalendarActivity[] }>({ tasks: [], activity: [] });
  const [monthLoading, setMonthLoading] = useState(true);
  const [monthError, setMonthError] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    const { first, last } = monthBounds(viewMonth);
    fetchJson<{ ok?: boolean; tasks: CrmTask[]; activity: CalendarActivity[] }>(
      `/api/calendar?from=${toDateParam(first)}&to=${toDateParam(last)}`
    )
      .then((data) => {
        if (cancelled) return;
        setMonthData({ tasks: data.tasks || [], activity: data.activity || [] });
        setMonthError(null);
      })
      .catch((e) => {
        if (!cancelled) setMonthError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setMonthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewMonth]);

  const reviewQueued = systemStatus?.counts_by?.review_status?.find?.((r) => r.status === 'queued')?.n ?? 0;

  const withDueDate = useMemo(() => tasks.filter((t) => t.due_at).sort((a, b) => (a.due_at! < b.due_at! ? -1 : 1)), [tasks]);
  const upcoming = withDueDate.filter((t) => !t.due_at || new Date(t.due_at) >= now);

  const goPrevMonth = () => {
    setMonthLoading(true);
    setSelectedDay(null);
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  };
  const goNextMonth = () => {
    setMonthLoading(true);
    setSelectedDay(null);
    setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  };
  const goToday = () => {
    setMonthLoading(true);
    setSelectedDay(new Date().getDate());
    setViewMonth(new Date());
  };

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
          <JumpTile icon={<Workflow className="h-4 w-4 text-violet-300" />} label="Agents" to="/agents" helper="Designer & monitor" />
          <JumpTile icon={<ClipboardList className="h-4 w-4 text-emerald-300" />} label="CRM" to="/crm" helper="Customers & tasks" />
          <JumpTile icon={<ShieldCheck className="h-4 w-4 text-amber-300" />} label="Review" to="/system/review" helper="Approval queue" />
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[1fr_1.05fr]">
        <ShellCard
          title="Upcoming schedule"
          subtitle="Appointments and tasks with a due date. Click a day for details."
          right={<CalendarDays className="h-4 w-4 text-white/40" />}
        >
          <MonthCalendar
            month={viewMonth}
            tasks={monthData.tasks}
            activity={monthData.activity}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
            onPrevMonth={goPrevMonth}
            onNextMonth={goNextMonth}
            onToday={goToday}
            loading={monthLoading}
            error={monthError}
          />
          <div className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">Next due</div>
            <div className="mt-2 space-y-2">
              {upcoming.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{t.title}</div>
                    <div className="mt-0.5 text-xs text-white/45">{t.contact?.full_name ? `for ${t.contact?.full_name}` : '—'}</div>
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
            <p className="mt-1 text-xs text-white/55">Mission Control is the operator surface. CRM keeps its customers and pipeline; System tracks status, reviews, and context. No duplicate entry points.</p>
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

function formatFullDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(iso?: string | null) {
  if (!iso) return 'All day';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'All day';
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0) return 'All day';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function monthBounds(month: Date) {
  const y = month.getFullYear();
  const m = month.getMonth();
  return { first: new Date(y, m, 1), last: new Date(y, m + 1, 0) };
}

function toDateParam(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type MonthCalendarProps = {
  month: Date;
  tasks: CrmTask[];
  activity: CalendarActivity[];
  selectedDay: number | null;
  onSelectDay: (day: number | null) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  loading?: boolean;
  error?: string | null;
};

function MonthCalendar({ month, tasks, activity, selectedDay, onSelectDay, onPrevMonth, onNextMonth, onToday, loading, error }: MonthCalendarProps) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const leading = firstDay.getDay();

  const { byDay, byActivity } = useMemo(() => {
    const byDayMap = new Map<number, CrmTask[]>();
    for (const t of tasks) {
      if (!t.due_at) continue;
      const d = new Date(t.due_at);
      if (d.getFullYear() === year && d.getMonth() === monthIndex) {
        const day = d.getDate();
        if (!byDayMap.has(day)) byDayMap.set(day, []);
        byDayMap.get(day)!.push(t);
      }
    }
    const byActivityMap = new Map<number, CalendarActivity[]>();
    for (const a of activity) {
      const d = new Date(a.occurred_at);
      if (d.getFullYear() === year && d.getMonth() === monthIndex) {
        const day = d.getDate();
        if (!byActivityMap.has(day)) byActivityMap.set(day, []);
        byActivityMap.get(day)!.push(a);
      }
    }
    return { byDay: byDayMap, byActivity: byActivityMap };
  }, [tasks, activity, year, monthIndex]);

  const cells = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d: number) => d === nowDay() && month.getMonth() === nowMonth() && month.getFullYear() === nowYear();

  const sortByTime = (a: { due_at?: string | null; occurred_at?: string | null }, b: { due_at?: string | null; occurred_at?: string | null }) => {
    const ta = a.due_at || a.occurred_at || '';
    const tb = b.due_at || b.occurred_at || '';
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  };

  const selectedDate = selectedDay != null ? new Date(year, monthIndex, selectedDay) : null;
  const selectedTasks = selectedDay != null ? byDay.get(selectedDay) || [] : [];
  const selectedEvents = selectedTasks.filter((t) => t.appointment_status === 'scheduled').sort(sortByTime);
  const selectedPlainTasks = selectedTasks.filter((t) => t.appointment_status !== 'scheduled').sort(sortByTime);
  const selectedActivity = selectedDay != null ? (byActivity.get(selectedDay) || []).slice().sort(sortByTime).slice(0, 50) : [];
  const hasSelected = selectedDay != null;
  const isEmpty = selectedEvents.length === 0 && selectedPlainTasks.length === 0 && selectedActivity.length === 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Previous month"
          className="rounded-full border border-white/10 p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold capitalize">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div>
          <button type="button" onClick={onToday} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/60 hover:text-white hover:bg-white/10 transition">
            Today
          </button>
        </div>
        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Next month"
          className="rounded-full border border-white/10 p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="pb-1 text-center text-[10px] font-semibold uppercase tracking-widest text-white/35">{w}</div>
        ))}
        {cells.map((day, i) => {
          if (day == null) return <div key={`e${i}`} />;
          const dayTasks = byDay.get(day) || [];
          const appointments = dayTasks.filter((t) => t.appointment_status === 'scheduled');
          const plain = dayTasks.filter((t) => t.appointment_status !== 'scheduled');
          const visible = [...appointments, ...plain];
          const dayActivity = byActivity.get(day) || [];
          const selected = selectedDay === day;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelectDay(selected ? null : day)}
              aria-pressed={selected}
              className={`relative min-h-[52px] w-full rounded-xl border p-1.5 text-left transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 ${
                selected
                  ? 'border-sky-400/70 bg-sky-400/15 ring-2 ring-sky-400/50'
                  : isToday(day)
                    ? 'border-sky-400/50 bg-sky-400/10 hover:bg-sky-400/15'
                    : dayTasks.length > 0 || dayActivity.length > 0
                      ? 'border-white/15 bg-black/20 hover:bg-sky-400/5 hover:border-sky-300/30'
                      : 'border-white/5 bg-white/[0.02] hover:bg-sky-400/5'
              }`}
            >
              <div className={`text-xs font-semibold ${selected || isToday(day) ? 'text-sky-100' : 'text-white/55'}`}>{day}</div>
              <div className="mt-1 space-y-0.5">
                {visible.slice(0, 2).map((t) => (
                  <div
                    key={t.id}
                    className={`truncate rounded px-1 py-0.5 text-[9px] font-medium ${t.appointment_status === 'scheduled' ? 'bg-sky-400/15 text-sky-100' : 'bg-emerald-400/15 text-emerald-100'}`}
                    title={t.title}
                  >
                    {t.title}
                  </div>
                ))}
                {dayTasks.length > 2 && <div className="px-1 text-[9px] text-white/40">+{dayTasks.length - 2} more</div>}
              </div>
              {dayActivity.length > 0 && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-sky-300/70" />}
            </button>
          );
        })}
      </div>

      {loading && <div className="mt-3 text-xs text-white/40">Loading this month…</div>}
      {!loading && error && <div className="mt-3 text-xs text-red-300/90">{error}</div>}

      {hasSelected && selectedDate && (
        <div className="mt-4 rounded-2xl border border-sky-400/25 bg-sky-400/[0.06] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold capitalize">{formatFullDate(selectedDate)}</div>
            <button
              type="button"
              onClick={() => onSelectDay(null)}
              aria-label="Close day detail"
              className="rounded-full border border-white/10 p-1 text-white/50 hover:text-white hover:bg-white/10 transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {isEmpty ? (
            <div className="mt-3 text-sm text-white/45">Nothing scheduled for this day.</div>
          ) : (
            <div className="mt-3 space-y-3">
              {selectedEvents.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Events ({selectedEvents.length})</div>
                  <div className="mt-1.5 space-y-1.5">
                    {selectedEvents.map((t) => (
                      <DayRow
                        key={t.id}
                        time={formatTime(t.due_at)}
                        title={t.title || 'Untitled appointment'}
                        subtitle={t.contact?.full_name ? `Appointment • ${t.contact.full_name}` : 'Appointment'}
                      />
                    ))}
                  </div>
                </div>
              )}

              {selectedPlainTasks.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Tasks ({selectedPlainTasks.length})</div>
                  <div className="mt-1.5 space-y-1.5">
                    {selectedPlainTasks.map((t) => (
                      <DayRow
                        key={t.id}
                        time={formatTime(t.due_at)}
                        title={t.title || 'Untitled task'}
                        subtitle={`${t.contact?.full_name || 'No contact'} • ${t.priority || 'normal'} • ${t.status || 'open'}`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {selectedActivity.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Activity ({selectedActivity.length})</div>
                  <div className="mt-1.5 space-y-1.5 max-h-[240px] overflow-y-auto">
                    {selectedActivity.map((a) => (
                      <DayRow
                        key={a.id}
                        time={formatTime(a.occurred_at)}
                        title={a.title || a.event_type}
                        subtitle={a.contact_name || a.source_channel || a.actor || a.event_type}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DayRow(props: { time: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
      <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-white/70">{props.time}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{props.title}</div>
        <div className="mt-0.5 text-xs text-white/45 line-clamp-2">{props.subtitle}</div>
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
