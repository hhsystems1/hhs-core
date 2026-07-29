import { useEffect, useState } from 'react';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson, formatWhen } from '../../lib/api';

export default function RunsPage(props: { title?: string; subtitle?: string }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setErr(null);
    try {
      setData(await fetchJson('/api/runs?limit=100'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const rows = (data?.runs || data?.rows || data || []) as any[];

  return (
    <ShellCard title={props.title || 'Run View'} subtitle={props.subtitle || 'Source: /api/runs'} right={
      <button
        onClick={refresh}
        className="rounded-2xl px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition"
      >
        Refresh
      </button>
    }>
      {err && <div className="text-sm text-red-200">{err}</div>}
      <div className="space-y-2">
        {rows.slice(0, 120).map((r) => (
          <div key={r.run_id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">{r.tool_id}</div>
              <div className="text-xs text-white/45">{r.status || '—'}</div>
            </div>
            <div className="mt-2 text-xs text-white/70 break-words">{r.task_summary || '—'}</div>
            <div className="mt-2 text-xs text-white/55">
              started: {formatWhen(r.started_at)} • completed: {formatWhen(r.completed_at)} • decision: {r.decision_status ?? '—'}
            </div>
          </div>
        ))}
      </div>
    </ShellCard>
  );
}
