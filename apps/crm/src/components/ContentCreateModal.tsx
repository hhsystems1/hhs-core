import { useState } from 'react';
import { X } from 'lucide-react';
import { createContentAsset } from '../lib/queries';
import type { ContentAsset } from '../types';

const CONTENT_TYPES = ['Video', 'Blog', 'Guide', 'Tool', 'Infographic'];

interface ContentCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (asset: ContentAsset) => void;
}

export default function ContentCreateModal({ isOpen, onClose, onCreated }: ContentCreateModalProps) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Blog');
  const [fileUrl, setFileUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const asset = await createContentAsset({
        title: title.trim(),
        type,
        file_url: fileUrl.trim() || undefined,
      });
      onCreated?.(asset);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create content');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-fusion-text">New Content</h2>
          <button onClick={onClose} className="text-fusion-text-muted hover:text-fusion-text">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
          )}
          <div>
            <label className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Content title"
              className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue"
            >
              {CONTENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">File URL (optional)</label>
            <input
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-fusion-blue text-white font-semibold py-2 rounded-lg hover:bg-fusion-blue-light transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Content'}
          </button>
        </form>
      </div>
    </div>
  );
}
