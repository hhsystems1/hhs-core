import { useState } from 'react';
import { X } from 'lucide-react';
import { createTicket } from '../lib/queries';
import type { SupportTicket } from '../types';

const PRIORITY_OPTIONS = ['Low', 'Med', 'High', 'Critical'];

interface TicketCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (ticket: SupportTicket) => void;
}

export default function TicketCreateModal({ isOpen, onClose, onCreated }: TicketCreateModalProps) {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Med');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) {
      setError('Subject is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ticket = await createTicket({
        subject: subject.trim(),
        description: description.trim() || undefined,
        priority,
      });
      onCreated?.(ticket);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-fusion-text">New Support Ticket</h2>
          <button onClick={onClose} className="text-fusion-text-muted hover:text-fusion-text">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
          )}
          <div>
            <label className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Subject *</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of the issue"
              className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Detailed description..."
              className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue resize-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue"
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-fusion-blue text-white font-semibold py-2 rounded-lg hover:bg-fusion-blue-light transition-colors disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create Ticket'}
          </button>
        </form>
      </div>
    </div>
  );
}
