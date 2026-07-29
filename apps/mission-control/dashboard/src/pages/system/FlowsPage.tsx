import { useEffect, useState } from 'react';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson } from '../../lib/api';

export default function FlowsPage(props: { title?: string; subtitle?: string }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setErr(null);
    try {
      setData(await fetchJson('/api/flows?limit=25'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const flows = (data?.flows || data?.rows || data || []) as any[];

  return (
    <ShellCard title={props.title || 'Live Flow View'} subtitle={props.subtitle || 'Source: /api/flows'} right={
      <button
        onClick={refresh}
        className="rounded-2xl px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition"
      >
        Refresh
      </button>
    }>
      {err && <div className="text-sm text-red-200">{err}</div>}
      <div className="space-y-3">
        {flows.slice(0, 50).map((f, idx) => (
          <div key={f.root_run_id || idx} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">root_run_id: {f.root_run_id || '—'}</div>
              <div className="text-xs text-white/45">runs: {f.runs ?? '—'} • any_failed: {String(f.any_failed ?? '—')}</div>
            </div>
            <div className="mt-2 text-xs text-white/70">{f.root_task_summary || '—'}</div>
            <div className="mt-3 space-y-1">
              {(f.chain || f.flow || []).map?.((step: any, sidx: number) => (
                <div key={sidx} className="text-xs text-white/70">
                  {sidx + 1}. {step.tool_id || step.tool || '—'} — {step.task_type || ''}
                </div>
              ))}
              {!Array.isArray(f.chain) && !Array.isArray(f.flow) && (
                <div className="text-xs text-white/50">(Chain details depend on API shape.)</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </ShellCard>
  );
}
