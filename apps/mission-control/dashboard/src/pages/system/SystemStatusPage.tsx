import { useEffect, useState } from 'react';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson } from '../../lib/api';

export default function SystemStatusPage() {
  const [status, setStatus] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    setErr(null);
    try {
      setStatus(await fetchJson('/api/system-status'));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <ShellCard title="System Status" subtitle="Source: /api/system-status" right={
      <button
        onClick={refresh}
        className="rounded-2xl px-4 py-2 text-sm font-semibold border border-white/10 bg-white/5 hover:bg-white/10 transition"
      >
        Refresh
      </button>
    }>
      {err && <div className="text-sm text-red-200">{err}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/55">Artifacts</div>
          <div className="mt-1 text-lg font-semibold">{status?.totals?.artifacts ?? '—'}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/55">Knowledge docs</div>
          <div className="mt-1 text-lg font-semibold">{status?.totals?.knowledge_documents_v2 ?? status?.totals?.docs ?? '—'}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/55">Knowledge chunks</div>
          <div className="mt-1 text-lg font-semibold">{status?.totals?.knowledge_chunks_v2 ?? status?.totals?.chunks ?? '—'}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="text-xs text-white/55">Events</div>
          <div className="mt-1 text-lg font-semibold">{status?.totals?.events_v2 ?? '—'}</div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-sm font-semibold">Ingestion activity</div>
        <div className="mt-2 text-sm text-white/70">
          {status?.ingestion_activity_24h?.has_activity === true
            ? `Active (last 24h count: ${status?.ingestion_activity_24h?.count ?? '—'})`
            : 'No activity indicator available.'}
        </div>
        <div className="mt-2 text-xs text-white/45">last_event_at: {status?.last_event_at ?? '—'}</div>
      </div>
    </ShellCard>
  );
}
