import { useEffect, useState } from 'react';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson, formatWhen } from '../../lib/api';

type RunRow = {
  run_id?: string;
  tool_id?: string | null;
  task_summary?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  status?: string | null;
  decision_status?: string | null;
  failure_reason?: string | null;
};

type RunsResponse = {
  ok?: boolean;
  runs?: RunRow[];
  rows?: RunRow[];
};

export default function RunsPage(props: { title?: string; subtitle?: string }) {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<RunsResponse>('/api/runs?limit=100')
      .then((res) => {
        if (!cancelled) setRuns(res.runs || res.rows || []);
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
      const res = await fetchJson<RunsResponse>('/api/runs?limit=100');
      setRuns(res.runs || res.rows || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <ShellCard title={props.title || 'Run View'} subtitle={props.subtitle || 'Source: /api/runs'} right={
      <button
        onClick={() => void refresh()}
        className="rounded-2xl px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition"
      >
        Refresh
      </button>
    }>
      {err && <div className="text-sm text-red-200">{err}</div>}
      <div className="space-y-2">
        {runs.slice(0, 120).map((r) => (
          <div key={r.run_id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">{r.tool_id || '—'}</div>
              <div className="text-xs text-white/45">{r.status || '—'}</div>
            </div>
            <div className="mt-2 text-xs text-white/70 break-words">{r.task_summary || '—'}</div>
            <div className="mt-2 text-xs text-white/55">
              started: {formatWhen(r.started_at)} • completed: {formatWhen(r.completed_at)} • decision: {r.decision_status ?? '—'}
            </div>
            {r.failure_reason && <div className="mt-2 text-xs text-red-200/80 break-words">{r.failure_reason}</div>}
          </div>
        ))}
      </div>
    </ShellCard>
  );
}
