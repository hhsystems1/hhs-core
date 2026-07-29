import { useEffect, useState } from 'react';
import { X, BookOpen, Eye } from 'lucide-react';
import { fetchKnowledgeArticles } from '../lib/queries';
import type { KnowledgeCategory, KnowledgeArticle } from '../types';

interface ArticleViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: KnowledgeCategory | null;
}

export default function ArticleViewerModal({ isOpen, onClose, category }: ArticleViewerModalProps) {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<KnowledgeArticle | null>(null);

  useEffect(() => {
    if (!isOpen || !category) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      setSelectedArticle(null);
      try {
        const data = await fetchKnowledgeArticles(category.id);
        setArticles(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isOpen, category]);

  if (!isOpen || !category) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-fusion-text">{category.title}</h2>
          <button onClick={onClose} className="text-fusion-text-muted hover:text-fusion-text">
            <X size={16} />
          </button>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="text-[13px] text-fusion-text-muted text-center py-8">Loading articles...</div>
          ) : error ? (
            <div className="text-[13px] text-red-400 text-center py-8">{error}</div>
          ) : selectedArticle ? (
            <div className="space-y-4">
              <button
                onClick={() => setSelectedArticle(null)}
                className="text-[11px] text-fusion-blue hover:underline"
              >
                &larr; Back to articles
              </button>
              <h3 className="text-lg font-bold text-fusion-text">{selectedArticle.title}</h3>
              <p className="text-sm text-fusion-text leading-relaxed whitespace-pre-wrap">
                {selectedArticle.content || 'No content available'}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-fusion-text-muted">
                <Eye size={12} />
                <span>{selectedArticle.views} views</span>
              </div>
            </div>
          ) : articles.length === 0 ? (
            <div className="text-[13px] text-fusion-text-muted text-center py-8">
              <BookOpen size={24} className="mx-auto mb-2 text-fusion-text-muted/50" />
              No articles in this category yet
            </div>
          ) : (
            <div className="space-y-2">
              {articles.map((article) => (
                <button
                  key={article.id}
                  onClick={() => setSelectedArticle(article)}
                  className="w-full text-left bg-fusion-card-soft rounded-lg p-3 border border-fusion-border-light hover:border-fusion-blue/30 transition-colors"
                >
                  <span className="text-sm font-semibold text-fusion-text block">{article.title}</span>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-fusion-text-muted">
                    <span className="flex items-center gap-1"><Eye size={10} />{article.views} views</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
