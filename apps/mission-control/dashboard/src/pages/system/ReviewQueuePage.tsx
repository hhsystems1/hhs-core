import { useEffect, useState } from 'react';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson } from '../../lib/api';

type ReviewItem = {
  review_id?: string;
  id?: string;
  review_type?: string | null;
  status?: string | null;
  reviewer?: string | null;
  requested_at?: string | null;
  decided_at?: string | null;
  decision?: string | null;
  promotion_target?: string | null;
  target_workspace_id?: string | null;
  artifact_id?: string | null;
  artifact_title?: string | null;
};

type ReviewQueueResponse = {
  ok?: boolean;
  items?: ReviewItem[];
  rows?: ReviewItem[];
};

export default function ReviewQueuePage(props: { title?: string; subtitle?: string }) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<ReviewQueueResponse>('/api/review-queue')
      .then((res) => {
        if (!cancelled) setItems(res.items || res.rows || []);
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
      const res = await fetchJson<ReviewQueueResponse>('/api/review-queue');
      setItems(res.items || res.rows || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <ShellCard title={props.title || 'Review Queue'} subtitle={props.subtitle || 'Source: /api/review-queue'} right={
      <button
        onClick={() => void refresh()}
        className="rounded-2xl px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition"
      >
        Refresh
      </button>
    }>
      {err && <div className="text-sm text-red-200">{err}</div>}
      <div className="space-y-2">
        {items.slice(0, 120).map((r) => (
          <div key={r.review_id || r.artifact_id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">{r.artifact_title || r.artifact_id || 'Review item'}</div>
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
