import { useEffect, useState } from 'react';
import { FileText, Share2, Eye } from 'lucide-react';
import KpiCard from '@hhs/shared-ui'KpiCard';
import DataTable from '@hhs/shared-ui'DataTable';
import { ArrowButton } from '@hhs/shared-ui'StatusBadge';
import DemoCard from '@hhs/shared-ui'DemoCard';
import ContentCreateModal from '../ContentCreateModal';
import { fetchContentAssets } from '../../lib/queries';
import type { ContentAsset } from '../../types';

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default function ContentEngine() {
  const [assets, setAssets] = useState<ContentAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    fetchContentAssets()
      .then(setAssets)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function handleCreated(asset: ContentAsset) {
    setAssets((prev) => [asset, ...prev]);
  }

  const totalViews = assets.reduce((s, a) => s + a.views, 0);
  const publishedCount = assets.filter((a) => a.status === 'Published').length;

  const typeCounts: Record<string, number> = {};
  for (const a of assets) {
    typeCounts[a.type] = (typeCounts[a.type] || 0) + 1;
  }

  const contentColumns = [
    { key: 'title', label: 'Title' },
    { key: 'type', label: 'Type' },
    { key: 'views', label: 'Views' },
    { key: 'engagement', label: 'Eng.' },
    { key: 'status', label: 'Status' },
  ];

  const contentRows = assets.map((a) => ({
    title: a.title,
    type: a.type,
    views: formatNumber(a.views),
    engagement: a.engagement ?? '—',
    status: a.status,
  }));

  return (
    <DemoCard number={6} title="Content Engine">
      {loading ? (
        <div className="text-[11px] text-fusion-text-muted py-4 text-center">Loading...</div>
      ) : error ? (
        <div className="text-[11px] text-red-400 py-4 text-center">{error}</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <KpiCard label="Total Assets" value={String(assets.length)} icon={<FileText size={12} />} />
            <KpiCard label="Published" value={String(publishedCount)} icon={<Share2 size={12} />} />
            <KpiCard label="Total Views" value={formatNumber(totalViews)} icon={<Eye size={12} />} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider mb-1 block">Top Content</span>
            <DataTable columns={contentColumns} rows={contentRows} />
          </div>
          {Object.keys(typeCounts).length > 0 && (
            <div className="flex gap-2">
              {Object.entries(typeCounts).map(([name, count]) => (
                <div key={name} className="flex-1 bg-fusion-card-soft rounded-lg p-2 border border-fusion-border-light text-center">
                  <span className="text-[9px] text-fusion-text-muted block">{name}</span>
                  <span className="text-xs font-bold text-fusion-text">{count}</span>
                </div>
              ))}
            </div>
          )}
          <ArrowButton onClick={() => setCreateOpen(true)}>
            Create New Content
          </ArrowButton>
        </div>
      )}
      <ContentCreateModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </DemoCard>
  );
}
