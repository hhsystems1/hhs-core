import { useEffect, useState } from 'react';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson } from '../../lib/api';

export default function ReviewQueuePage(props: { title?: string; subtitle?: string }) {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setErr(null);
    try {
      setData(await fetchJson('/api/review-queue'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const rows = (data?.items || data?.rows || data || []) as any[];

  return (
    <ShellCard title={props.title || 'Review Queue'} subtitle={props.subtitle || 'Source: /api/review-queue'} right={
      <button
        onClick={refresh}
        className="rounded-2xl px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition"
      >
        Refresh
      </button>
    }>
      {err && <div className="text-sm text-red-200">{err}</div>}
      <div className="space-y-2">
        {rows.slice(0, 120).map((r, idx) => (
          <div key={r.id || idx} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">{r.artifact_title || r.title || r.artifact_id || 'Review item'}</div>
              <div className="text-xs text-white/45">status: {r.status || '—'}</div>
            </div>
            <div className="mt-2 text-xs text-white/60">
              type: {r.review_type || '—'} • reviewer: {r.reviewer || '—'} • promotion_target: {r.promotion_target || '—'}
            </div>
          </div>
        ))}
      </div>
    </ShellCard>
  );
}
