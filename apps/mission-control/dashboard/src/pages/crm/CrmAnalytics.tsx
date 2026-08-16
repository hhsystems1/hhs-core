import { useEffect, useState } from 'react';
import { ShellCard } from '../../components/ShellCard';
import { fetchJson } from '../../lib/api';

type KanbanRow = { id: string; name: string | null; stage: string | null; estimated_value_cents: number | null; expected_close_date: string | null };

type OppRow = {
  id: string;
  name: string | null;
  stage: string | null;
  status: string | null;
  estimated_value_cents: number | null;
  expected_close_date: string | null;
};

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  proposal: 'Proposal',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

function currency(cents: number | null | undefined) {
  if (cents == null) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

export default function CrmAnalytics() {
  const [columns, setColumns] = useState<Record<string, KanbanRow[]>>({});
  const [stages, setStages] = useState<string[]>([]);
  const [opportunities, setOpportunities] = useState<OppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchJson<{ ok: boolean; columns: Record<string, KanbanRow[]>; stages: string[] }>('/api/v1/crm/kanban'),
      fetchJson<{ opportunities: OppRow[] }>('/api/v1/crm/opportunities?status=all&limit=200'),
    ])
      .then(([kanban, opps]) => {
        if (cancelled) return;
        setColumns(kanban.columns || {});
        setStages(kanban.stages || []);
        setOpportunities(opps.opportunities || []);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stageNames = stages.length > 0 ? stages : Object.keys(columns);

  const stageStats = stageNames.map((stage) => {
    const cards = columns[stage] || [];
    const value = cards.reduce((sum, c) => sum + (c.estimated_value_cents || 0), 0);
    return { stage, count: cards.length, value };
  });

  const totalValue = stageStats.reduce((sum, s) => sum + s.value, 0);
  const maxCount = Math.max(1, ...stageStats.map((s) => s.count));

  const openDeals = opportunities.filter((o) => o.status === 'open');
  const closedWon = opportunities.filter((o) => o.stage === 'closed_won' || o.status === 'won');
  const closedLost = opportunities.filter((o) => o.stage === 'closed_lost' || o.status === 'lost');
  const wonValue = closedWon.reduce((sum, o) => sum + (o.estimated_value_cents || 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold">Analytics</div>
        <div className="mt-1 text-xs text-white/55">Pipeline distribution, deal value, and win/loss posture.</div>
      </div>

      {error && <div className="rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">{error}</div>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Open deals" value={String(openDeals.length)} />
        <StatCard label="Pipeline value" value={currency(totalValue)} />
        <StatCard label="Closed won" value={String(closedWon.length)} detail={currency(wonValue)} />
        <StatCard label="Closed lost" value={String(closedLost.length)} />
      </div>

      <ShellCard title="Pipeline by stage" subtitle="Count and value per pipeline stage">
        {loading ? (
          <div className="text-sm text-white/50">Loading pipeline stats...</div>
        ) : stageStats.length === 0 ? (
          <div className="text-sm text-white/45">No pipeline data yet.</div>
        ) : (
          <div className="space-y-3">
            {stageStats.map((s) => (
              <div key={s.stage}>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold text-white/75">{STAGE_LABELS[s.stage] || s.stage}</span>
                  <span className="text-white/45">{s.count} deals • {currency(s.value)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500/70 to-emerald-500/70"
                    style={{ width: `${(s.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </ShellCard>

      <ShellCard title="Open deals" subtitle="Up to 200 opportunities in the pipeline.">
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {openDeals.length === 0 ? (
            <div className="text-sm text-white/45">No open deals.</div>
          ) : (
            openDeals.slice(0, 60).map((o) => (
              <div key={o.id} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{o.name || 'Unnamed deal'}</div>
                    <div className="mt-1 text-xs text-white/45">{o.stage || 'no stage'} • {o.expected_close_date ? `closes ${o.expected_close_date.slice(0, 10)}` : 'no close date'}</div>
                  </div>
                  <div className="shrink-0 text-sm font-semibold text-white/80">{currency(o.estimated_value_cents)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </ShellCard>
    </div>
  );
}

function StatCard(props: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 sm:p-5">
      <div className="text-xs text-white/50">{props.label}</div>
      <div className="mt-2 text-2xl font-bold">{props.value}</div>
      {props.detail && <div className="mt-1 text-xs text-white/40">{props.detail}</div>}
    </div>
  );
}
