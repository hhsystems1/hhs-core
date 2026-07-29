import { useEffect, useState } from 'react';
import { BookOpen, Wrench, FileQuestion, GraduationCap, Shield, HelpCircle, type LucideIcon } from 'lucide-react';
import DemoCard from '@hhs/shared-ui'DemoCard';
import ArticleViewerModal from '../ArticleViewerModal';
import { fetchKnowledgeCategories } from '../../lib/queries';
import type { KnowledgeCategory } from '../../types';

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen, Wrench, FileQuestion, GraduationCap, Shield, HelpCircle,
};

const DEFAULT_COLORS: Record<string, string> = {
  'Product Specs': '#0057D9',
  'Installation Guides': '#0A66FF',
  'Troubleshooting': '#1A7AFF',
  'Training Materials': '#8BA0C4',
  'Compliance': '#16A34A',
  'FAQ': '#F59E0B',
};

export default function InternalKnowledgeBase() {
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory | null>(null);

  useEffect(() => {
    fetchKnowledgeCategories()
      .then(setCategories)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DemoCard number={7} title="Internal Knowledge Base">
      {loading ? (
        <div className="text-[11px] text-fusion-text-muted py-4 text-center">Loading...</div>
      ) : error ? (
        <div className="text-[11px] text-red-400 py-4 text-center">{error}</div>
      ) : categories.length === 0 ? (
        <div className="text-[11px] text-fusion-text-muted py-4 text-center">No categories yet</div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {categories.map((cat) => {
            const Icon = ICON_MAP[cat.icon_name ?? ''] ?? BookOpen;
            const color = cat.color ?? DEFAULT_COLORS[cat.title] ?? '#0057D9';
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat)}
                className="w-full text-left bg-fusion-card-soft rounded-lg p-3 border border-fusion-border-light hover:border-fusion-blue/30 transition-colors cursor-pointer"
              >
                <Icon size={16} style={{ color }} className="mb-1.5" />
                <span className="text-[10px] font-semibold text-fusion-text block leading-tight">{cat.title}</span>
                <span className="text-lg font-bold text-fusion-text">{cat.count}</span>
              </button>
            );
          })}
        </div>
      )}
      <ArticleViewerModal
        isOpen={!!selectedCategory}
        onClose={() => setSelectedCategory(null)}
        category={selectedCategory}
      />
    </DemoCard>
  );
}
