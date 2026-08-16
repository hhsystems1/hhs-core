import { useEffect, useState } from 'react';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson, formatWhen } from '../../lib/api';

type ActivityEvent = {
  id?: string;
  event_level?: string;
  event_type?: string;
  occurred_at?: string;
  actor?: string;
  artifact_id?: string;
  workspace_id?: string;
  person_id?: string;
};

type ActivityResponse = {
  ok?: boolean;
  events?: ActivityEvent[];
  rows?: ActivityEvent[];
};

export default function ActivityPage(props: { title?: string; subtitle?: string }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<ActivityResponse>('/api/activity')
      .then((res) => {
        if (!cancelled) setEvents(res.events || res.rows || []);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function refresh() {
    setErr(null);
    try {
      const res = await fetchJson<ActivityResponse>('/api/activity');
      setEvents(res.events || res.rows || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <ShellCard title={props.title || 'Activity Feed'} subtitle={props.subtitle || 'Source: /api/activity'} right={
      <button
        onClick={() => void refresh()}
        className="rounded-2xl px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition"
      >
        Refresh
      </button>
    }>
      {err && <div className="text-sm text-red-200">{err}</div>}
      <div className="space-y-2">
        {events.slice(0, 80).map((e, idx) => (
          <div key={e.id || e.event_type || idx} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">{e.event_type || 'event'}</div>
              <div className="text-xs text-white/45">{formatWhen(e.occurred_at)}</div>
            </div>
            <div className="mt-2 text-xs text-white/60 break-words">
              level: {e.event_level || '—'} • artifact: {e.artifact_id || '—'}
            </div>
          </div>
        ))}
      </div>
    </ShellCard>
  );
}
