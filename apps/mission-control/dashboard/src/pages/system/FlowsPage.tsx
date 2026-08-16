import { useEffect, useState } from 'react';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson } from '../../lib/api';

type FlowRow = {
  root_run_id?: string;
  root_task_summary?: string | null;
  root_started_at?: string | null;
  runs?: number;
  any_failed?: boolean;
  any_partial?: boolean;
  any_running?: boolean;
};

type FlowsResponse = {
  ok?: boolean;
  flows?: FlowRow[];
  rows?: FlowRow[];
};

export default function FlowsPage(props: { title?: string; subtitle?: string }) {
  const [flows, setFlows] = useState<FlowRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<FlowsResponse>('/api/flows?limit=25')
      .then((res) => {
        if (!cancelled) setFlows(res.flows || res.rows || []);
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
      const res = await fetchJson<FlowsResponse>('/api/flows?limit=25');
      setFlows(res.flows || res.rows || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <ShellCard title={props.title || 'Live Flow View'} subtitle={props.subtitle || 'Source: /api/flows'} right={
      <button
        onClick={() => void refresh()}
        className="rounded-2xl px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition"
      >
        Refresh
      </button>
    }>
      {err && <div className="text-sm text-red-200">{err}</div>}
      <div className="space-y-3">
        {flows.slice(0, 50).map((f) => (
          <div key={f.root_run_id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">root_run_id: {f.root_run_id || '—'}</div>
              <div className="text-xs text-white/45">runs: {f.runs ?? '—'}</div>
            </div>
            <div className="mt-2 text-xs text-white/70">{f.root_task_summary || '—'}</div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {f.any_running && <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-2 py-0.5 text-[10px] font-semibold text-sky-100">running</span>}
              {f.any_failed && <span className="rounded-full border border-red-400/25 bg-red-400/10 px-2 py-0.5 text-[10px] font-semibold text-red-100">failed</span>}
              {f.any_partial && <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">partial</span>}
              {!f.any_running && !f.any_failed && !f.any_partial && (
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">clean</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </ShellCard>
  );
}
