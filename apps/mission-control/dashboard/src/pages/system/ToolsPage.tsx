import { useEffect, useState } from 'react';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson, formatWhen } from '../../lib/api';

export default function ToolsPage(props: { title?: string; subtitle?: string }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setErr(null);
    try {
      setData(await fetchJson('/api/tools'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const rows = (data?.tools || data?.rows || data || []) as any[];

  return (
    <ShellCard title={props.title || 'Tool View'} subtitle={props.subtitle || 'Source: /api/tools'} right={
      <button
        onClick={refresh}
        className="rounded-2xl px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition"
      >
        Refresh
      </button>
    }>
      {err && <div className="text-sm text-red-200">{err}</div>}
      <div className="space-y-2">
        {rows.map((t) => (
          <div key={t.tool_id || t.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">{t.tool_id}</div>
              <div className="text-xs text-white/45">status: {t.status || '—'}</div>
            </div>
            <div className="mt-2 text-xs text-white/60">
              role: {t.role || '—'} • priority: {t.routing_priority ?? '—'} • last_used: {formatWhen(t.last_used_at)}
            </div>
            <div className="mt-1 text-xs text-white/55 break-words">last result: {t.last_result_summary || t.last_result || '—'}</div>
          </div>
        ))}
      </div>
    </ShellCard>
  );
}
