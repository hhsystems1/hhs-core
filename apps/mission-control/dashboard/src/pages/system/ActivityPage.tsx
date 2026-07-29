import { useEffect, useState } from 'react';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson, formatWhen } from '../../lib/api';

export default function ActivityPage(props: { title?: string; subtitle?: string }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setErr(null);
    try {
      setData(await fetchJson('/api/activity'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const rows = (data?.events || data?.rows || data || []) as any[];

  return (
    <ShellCard title={props.title || 'Activity Feed'} subtitle={props.subtitle || 'Source: /api/activity'} right={
      <button
        onClick={refresh}
        className="rounded-2xl px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition"
      >
        Refresh
      </button>
    }>
      {err && <div className="text-sm text-red-200">{err}</div>}
      <div className="space-y-2">
        {rows.slice(0, 80).map((e, idx) => (
          <div key={e.event_id || e.id || idx} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">{e.event_type || e.type || 'event'}</div>
              <div className="text-xs text-white/45">{formatWhen(e.occurred_at || e.created_at)}</div>
            </div>
            <div className="mt-2 text-xs text-white/60 break-words">
              level: {e.event_level || e.level || '—'} • artifact: {e.artifact_id || '—'}
            </div>
          </div>
        ))}
      </div>
    </ShellCard>
  );
}
