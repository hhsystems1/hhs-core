import { useEffect, useState } from 'react';
import KpiCard from '@hhs/shared-ui'KpiCard';
import { MiniLineChart, MiniPieChart } from '@hhs/shared-ui'Charts';
import DataTable from '@hhs/shared-ui'DataTable';
import DemoCard from '@hhs/shared-ui'DemoCard';
import { fetchDistributors, fetchLeads, fetchFunnelMetrics } from '../../lib/queries';
import type { Distributor, Lead } from '../../types';

const SOURCE_COLORS: Record<string, string> = {
  crm: '#0057D9',
  website_form: '#0A66FF',
  referral: '#16A34A',
  social: '#8BA0C4',
  direct: '#F59E0B',
  other: '#6B7280',
};

export default function ManufacturerDashboard() {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [lineData, setLineData] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetchDistributors(),
      fetchLeads(),
      fetchFunnelMetrics(),
    ])
      .then(([dists, leadsData, metrics]) => {
        setDistributors(dists);
        setLeads(leadsData);
        const funnelCounts = metrics
          .filter((m) => m.funnel_name === 'Spa & Wellness')
          .map((m) => m.count);
        if (funnelCounts.length >= 4) {
          setLineData(funnelCounts);
        } else {
          setLineData([40, 28, 15, 8]);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const totalRevenue = distributors.reduce((sum, d) => {
    const num = parseInt((d.revenue ?? '').replace(/[$,Kk]/g, ''), 10);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);

  const distColumns = [
    { key: 'name', label: 'Distributor' },
    { key: 'region', label: 'Region' },
    { key: 'status', label: 'Status' },
    { key: 'revenue', label: 'Revenue' },
  ];

  const distRows = distributors.map((d) => ({
    name: d.name,
    region: d.region ?? '—',
    status: d.status,
    revenue: d.revenue ?? '—',
  }));

  const sourceCounts: Record<string, number> = {};
  for (const l of leads) {
    const s = l.source || 'other';
    sourceCounts[s] = (sourceCounts[s] || 0) + 1;
  }
  const sourceTotal = Object.values(sourceCounts).reduce((a, b) => a + b, 0) || 1;
  const pieSegments = Object.entries(sourceCounts).map(([source, count]) => ({
    value: count,
    color: SOURCE_COLORS[source] ?? '#6B7280',
    label: source.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    pct: `${Math.round((count / sourceTotal) * 100)}%`,
  }));

  return (
    <DemoCard number={1} title="Manufacturer Dashboard">
      {loading ? (
        <div className="text-[11px] text-fusion-text-muted py-4 text-center">Loading...</div>
      ) : error ? (
        <div className="text-[11px] text-red-400 py-4 text-center">{error}</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <KpiCard label="Total Distributors" value={String(distributors.length)} />
            <KpiCard label="Active Leads" value={String(leads.length)} />
            <KpiCard label="Revenue" value={`$${totalRevenue}K`} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-fusion-card-soft rounded-lg p-3 border border-fusion-border-light">
              <span className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider">Funnel Stages (Spa)</span>
              <MiniLineChart data={lineData} />
            </div>
            <div className="bg-fusion-card-soft rounded-lg p-3 border border-fusion-border-light">
              <span className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider">Lead Sources</span>
              <div className="flex items-center gap-3 mt-1">
                <MiniPieChart segments={pieSegments} size={56} />
                <div className="space-y-1">
                  {pieSegments.map((s) => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-[10px] text-fusion-text-muted">{s.label} {s.pct}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <span className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider mb-1 block">Top Distributors</span>
              {distRows.length > 0 ? (
                <DataTable columns={distColumns} rows={distRows} />
              ) : (
                <div className="text-[11px] text-fusion-text-muted">No distributors yet</div>
              )}
            </div>
          </div>
        </div>
      )}
    </DemoCard>
  );
}
