import { useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ClipboardCheck, RefreshCw, X } from 'lucide-react';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson, formatWhen } from '../../lib/api';

type ReviewItem = {
  review_id?: string;
  review_type?: string | null;
  status?: string | null;
  reviewer?: string | null;
  requested_at?: string | null;
  decided_at?: string | null;
  decision?: string | null;
  promotion_target?: string | null;
  target_workspace_id?: string | null;
  notes?: string | null;
  artifact_id?: string | null;
  artifact_title?: string | null;
  artifact_type?: string | null;
  scope?: string | null;
  has_primary_anchor?: boolean | null;
};

type ReviewQueueResponse = {
  ok?: boolean;
  items?: ReviewItem[];
  rows?: ReviewItem[];
};

type DecisionResponse = {
  ok?: boolean;
  status?: string;
  error?: string;
};

const STATUS_FILTERS = ['all', 'queued', 'in_review', 'changes_requested', 'approved', 'rejected', 'promoted'] as const;

function statusStyle(status?: string | null) {
  switch (status) {
    case 'queued': return 'border-white/15 bg-white/5 text-white/70';
    case 'in_review': return 'border-sky-400/25 bg-sky-400/10 text-sky-100';
    case 'changes_requested': return 'border-amber-400/25 bg-amber-400/10 text-amber-100';
    case 'approved': return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100';
    case 'rejected': return 'border-red-400/25 bg-red-400/10 text-red-100';
    case 'promoted': return 'border-violet-400/25 bg-violet-400/10 text-violet-100';
    default: return 'border-white/10 bg-white/5 text-white/60';
  }
}

export default function ReviewQueuePage(props: { title?: string; subtitle?: string }) {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]>('all');
  const [err, setErr] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ [reviewId: string]: 'approve' | 'reject' | null }>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshSpin, setRefreshSpin] = useState(true);

  async function refresh() {
    setErr(null);
    setRefreshSpin(true);
    try {
      const res = await fetchJson<ReviewQueueResponse>('/api/review-queue');
      setItems(res.items || res.rows || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshSpin(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    fetchJson<ReviewQueueResponse>('/api/review-queue')
      .then((res) => {
        if (!cancelled) setItems(res.items || res.rows || []);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setRefreshSpin(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function decide(item: ReviewItem, decision: 'approve' | 'reject') {
    const reviewId = item.review_id;
    if (!reviewId || busy) return;
    setBusy(reviewId);
    setErr(null);
    try {
      const res = await fetchJson<DecisionResponse>(`/api/review/${encodeURIComponent(reviewId)}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: decision === 'approve' ? 'approved' : 'rejected' }),
      });
      if (res.ok === false) {
        setErr(res.error || 'decision failed');
      } else {
        setItems((prev) =>
          prev.map((r) => (r.review_id === reviewId ? { ...r, status: res.status || (decision === 'approve' ? 'approved' : 'rejected'), decision: decision === 'approve' ? 'approved' : 'rejected', decided_at: new Date().toISOString() } : r))
        );
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setConfirming((prev) => ({ ...prev, [reviewId]: null }));
    }
  }

  const filtered = filter === 'all' ? items : items.filter((r) => r.status === filter);
  const counts = STATUS_FILTERS.reduce((acc, s) => {
    acc[s] = s === 'all' ? items.length : items.filter((r) => r.status === s).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4 sm:space-y-6">
      <ShellCard
        title={props.title || 'Review'}
        subtitle={props.subtitle || 'Agent-suggested tasks waiting on your approval.'}
        right={
          <button onClick={() => void refresh()} disabled={refreshSpin} className="mc-secondary-button gap-2">
            <RefreshCw className={`h-4 w-4 ${refreshSpin ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      >
        {err && <div className="mc-alert mb-4">{err}</div>}

        <div className="flex flex-wrap gap-1.5 mb-4">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filter === s
                  ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-100'
                  : 'border-white/10 bg-white/5 text-white/55 hover:bg-white/10'
              }`}
            >
              {s.replace(/_/g, ' ')} <span className="opacity-60">{counts[s]}</span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
            No reviews in this state. Agents will put their suggested tasks here for approval.
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.slice(0, 200).map((r) => {
              const reviewId = r.review_id || '';
              const isOpen = expandedId === reviewId;
              const isDecided = r.status === 'approved' || r.status === 'rejected' || r.status === 'changes_requested' || r.status === 'promoted';
              const confirmTarget = confirming[reviewId] || null;
              const pending = busy === reviewId;
              return (
                <div
                  key={reviewId || r.artifact_id}
                  className={`rounded-3xl border transition ${
                    isOpen ? 'border-sky-400/30 bg-white/[0.06] p-4 sm:p-6' : 'border-white/10 bg-black/20 p-4 hover:border-white/25'
                  }`}
                >
                  <button
                    onClick={() => setExpandedId(isOpen ? null : reviewId)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold break-words">{r.artifact_title || r.artifact_id || 'Untitled review'}</div>
                        <div className="mt-1 text-xs text-white/50">
                          {r.review_type || 'review'}{r.reviewer ? ` • reviewer: ${r.reviewer}` : ''}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusStyle(r.status)}`}>
                          {r.status || '—'}
                        </span>
                        <ChevronDown className={`h-4 w-4 text-white/40 transition ${isOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-white/40">{formatWhen(r.requested_at)}</div>
                  </button>

                  {isOpen && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 text-sm">
                        <Info label="Artifact ID" value={r.artifact_id} mono />
                        <Info label="Artifact type" value={r.artifact_type} />
                        <Info label="Scope" value={r.scope} />
                        <Info label="Promotion target" value={r.promotion_target} />
                        <Info label="Target workspace" value={r.target_workspace_id} mono />
                        <Info label="Primary anchor" value={r.has_primary_anchor ? 'yes' : r.has_primary_anchor === false ? 'no' : '—'} />
                        <Info label="Decision" value={r.decision} />
                        <Info label="Decided at" value={r.decided_at ? formatWhen(r.decided_at) : '—'} />
                      </div>

                      <div className="mt-4">
                        <div className="text-xs font-semibold uppercase tracking-widest text-white/40">Notes</div>
                        <div className="mt-1 rounded-2xl border border-white/5 bg-black/20 p-3 text-sm text-white/75 whitespace-pre-wrap">
                          {r.notes || 'No notes attached.'}
                        </div>
                      </div>

                      <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
                        {isDecided ? (
                          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
                            <ClipboardCheck className="h-4 w-4 text-emerald-300" />
                            Decided: <span className="font-semibold capitalize">{r.status}</span>
                          </div>
                        ) : (
                          <>
                            {confirmTarget === 'reject' ? (
                              <button
                                onClick={() => decide(r, 'reject')}
                                disabled={pending}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/40 bg-red-500/25 px-4 py-2.5 text-sm font-bold text-red-50 transition hover:bg-red-500/40"
                              >
                                {pending ? 'Rejecting…' : 'Click again to reject'}
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirming((prev) => ({ ...prev, [reviewId]: 'reject' }))}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-400/25 bg-red-400/10 px-4 py-2.5 text-sm font-bold text-red-100 transition hover:bg-red-400/20"
                              >
                                <X className="h-4 w-4" />
                                Reject
                              </button>
                            )}

                            {confirmTarget === 'approve' ? (
                              <button
                                onClick={() => decide(r, 'approve')}
                                disabled={pending}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/25 px-4 py-2.5 text-sm font-bold text-emerald-50 transition hover:bg-emerald-500/40"
                              >
                                {pending ? 'Approving…' : 'Click again to approve'}
                              </button>
                            ) : (
                              <button
                                onClick={() => setConfirming((prev) => ({ ...prev, [reviewId]: 'approve' }))}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-2.5 text-sm font-bold text-emerald-100 transition hover:bg-emerald-400/20"
                              >
                                <Check className="h-4 w-4" />
                                Approve
                              </button>
                            )}

                            {(confirmTarget === 'approve' || confirmTarget === 'reject') && (
                              <span className="inline-flex items-center gap-1.5 text-xs text-amber-200/80">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                Click again to confirm
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ShellCard>
    </div>
  );
}

function Info(props: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-white/40">{props.label}</div>
      <div className={`text-sm break-words ${props.mono ? 'font-mono text-xs mt-0.5' : ''}`}>{props.value || '—'}</div>
    </div>
  );
}
