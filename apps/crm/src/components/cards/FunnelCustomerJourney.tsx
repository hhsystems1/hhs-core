import { useEffect, useState } from 'react';
import DemoCard from '@hhs/shared-ui'DemoCard';
import { fetchFunnelMetrics } from '../../lib/queries';
import type { FunnelMetric } from '../../types';

const STAGE_COLORS: Record<string, string> = {
  Awareness: '#0057D9',
  Interest: '#0A66FF',
  Consideration: '#1A7AFF',
  Purchase: '#8BA0C4',
};

const STAGE_ORDER = ['Awareness', 'Interest', 'Consideration', 'Purchase'];

interface FunnelGroup {
  title: string;
  stages: { label: string; count: number; color: string }[];
}

export default function FunnelCustomerJourney() {
  const [funnels, setFunnels] = useState<FunnelGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFunnelMetrics()
      .then((metrics: FunnelMetric[]) => {
        const grouped: Record<string, FunnelGroup> = {};
        for (const m of metrics) {
          if (!grouped[m.funnel_name]) {
            grouped[m.funnel_name] = { title: m.funnel_name, stages: [] };
          }
          grouped[m.funnel_name].stages.push({
            label: m.stage_name,
            count: m.count,
            color: STAGE_COLORS[m.stage_name] ?? '#0057D9',
          });
        }
        for (const g of Object.values(grouped)) {
          g.stages.sort((a, b) => STAGE_ORDER.indexOf(a.label) - STAGE_ORDER.indexOf(b.label));
        }
        setFunnels(Object.values(grouped));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const maxCount = Math.max(0, ...funnels.flatMap((f) => f.stages.map((s) => s.count)));

  return (
    <DemoCard number={5} title="Funnel & Customer Journey">
      {loading ? (
        <div className="text-[11px] text-fusion-text-muted py-4 text-center">Loading...</div>
      ) : error ? (
        <div className="text-[11px] text-red-400 py-4 text-center">{error}</div>
      ) : funnels.length === 0 ? (
        <div className="text-[11px] text-fusion-text-muted py-4 text-center">No funnel data yet</div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {funnels.map((funnel) => (
            <div key={funnel.title} className="bg-fusion-card-soft rounded-lg p-3 border border-fusion-border-light">
              <span className="text-[10px] font-bold text-fusion-text uppercase tracking-wider block mb-2">
                {funnel.title}
              </span>
              <div className="space-y-2">
                {funnel.stages.map((stage) => (
                  <div key={stage.label}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] text-fusion-text-muted">{stage.label}</span>
                      <span className="text-[10px] font-bold text-fusion-text">{stage.count}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(stage.count / maxCount) * 100}%`,
                          backgroundColor: stage.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-2 border-t border-fusion-border-light">
                <span className="text-[10px] text-fusion-text-muted">Conversion: </span>
                <span className="text-[10px] font-bold text-fusion-success">
                  {funnel.stages[3] && funnel.stages[0]
                    ? `${Math.round((funnel.stages[3].count / funnel.stages[0].count) * 100)}%`
                    : 'N/A'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </DemoCard>
  );
}
