import { useState } from 'react';
import { X, Calendar } from 'lucide-react';
import { createTicket } from '../lib/queries';

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ServiceModal({ isOpen, onClose }: ServiceModalProps) {
  const [description, setDescription] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) {
      setError('Please describe the service needed');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createTicket({
        subject: `Service Request${preferredDate ? ` — ${preferredDate}` : ''}`,
        description: description.trim(),
        priority: 'Med',
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-fusion-text">Schedule Service</h2>
          <button onClick={onClose} className="text-fusion-text-muted hover:text-fusion-text">
            <X size={16} />
          </button>
        </div>
        <div className="p-6">
          {success ? (
            <div className="text-center py-4">
              <Calendar size={32} className="mx-auto mb-2 text-fusion-success" />
              <p className="text-sm font-semibold text-fusion-text mb-1">Service Request Submitted</p>
              <p className="text-[11px] text-fusion-text-muted">A support ticket has been created. We'll follow up within 24 hours.</p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-fusion-blue text-white text-sm font-medium rounded-lg hover:bg-fusion-blue-light transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
              )}
              <div>
                <label className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Preferred Date</label>
                <input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Describe the Issue *</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="What needs service? Describe the issue..."
                  className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full bg-fusion-blue text-white font-semibold py-2 rounded-lg hover:bg-fusion-blue-light transition-colors disabled:opacity-50"
              >
                {saving ? 'Submitting...' : 'Submit Service Request'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
