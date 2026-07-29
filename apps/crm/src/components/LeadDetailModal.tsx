import { useEffect, useState } from 'react';
import { X, Edit3, Save } from 'lucide-react';
import { createLead, updateLead, fetchDistributors } from '../lib/queries';
import type { Lead, Distributor } from '../types';

const STATUS_OPTIONS = ['New', 'Contacted', 'Qualified', 'Closed', 'Lost'];

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead?: Lead | null;
  onCreated?: (lead: Lead) => void;
  onUpdated?: (lead: Lead) => void;
}

export default function LeadDetailModal({ isOpen, onClose, lead, onCreated, onUpdated }: LeadDetailModalProps) {
  const isCreate = !lead;
  const [editing, setEditing] = useState(isCreate);
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    score: 0,
    status: 'New' as string,
    source: 'crm' as string,
    notes: '',
    distributor_id: '',
  });

  useEffect(() => {
    if (!isOpen) return;
    fetchDistributors().then(setDistributors).catch(() => {});

    const nextForm = lead
      ? {
          name: lead.name ?? '',
          email: lead.email ?? '',
          phone: lead.phone ?? '',
          company: lead.company ?? '',
          score: lead.score ?? 0,
          status: lead.status ?? 'New',
          source: lead.source ?? 'crm',
          notes: lead.notes ?? '',
          distributor_id: lead.distributor_id ?? '',
        }
      : {
          name: '',
          email: '',
          phone: '',
          company: '',
          score: 0,
          status: 'New',
          source: 'crm',
          notes: '',
          distributor_id: '',
        };

    queueMicrotask(() => {
      setForm(nextForm);
      setEditing(!lead);
      setError(null);
    });
  }, [isOpen, lead]);

  if (!isOpen) return null;

  async function handleSave() {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        company: form.company.trim() || undefined,
        score: form.score,
        status: form.status,
        source: form.source,
        notes: form.notes.trim() || undefined,
        distributor_id: form.distributor_id || undefined,
      };

      if (isCreate) {
        const created = await createLead(payload);
        onCreated?.(created);
      } else {
        const updated = await updateLead(lead.id, payload);
        onUpdated?.(updated);
        setEditing(false);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function set(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-fusion-text">
            {isCreate ? 'New Lead' : editing ? 'Edit Lead' : 'Lead Details'}
          </h2>
          <div className="flex items-center gap-2">
            {!isCreate && !editing && (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-xs font-medium text-fusion-blue hover:text-fusion-blue-light"
              >
                <Edit3 size={12} /> Edit
              </button>
            )}
            <button onClick={onClose} className="text-fusion-text-muted hover:text-fusion-text">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                disabled={!editing}
                className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue disabled:bg-gray-50 disabled:text-fusion-text-muted"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Company</label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => set('company', e.target.value)}
                disabled={!editing}
                className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue disabled:bg-gray-50 disabled:text-fusion-text-muted"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                disabled={!editing}
                className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue disabled:bg-gray-50 disabled:text-fusion-text-muted"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                disabled={!editing}
                className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue disabled:bg-gray-50 disabled:text-fusion-text-muted"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              disabled={!editing}
              rows={3}
              className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue disabled:bg-gray-50 disabled:text-fusion-text-muted resize-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Status</label>
              {editing ? (
                <select
                  value={form.status}
                  onChange={(e) => set('status', e.target.value)}
                  className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <span className="block text-sm font-medium text-fusion-text">{lead?.status}</span>
              )}
            </div>
            <div>
              <label className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Score</label>
              {editing ? (
                <input
                  type="number"
                  value={form.score}
                  onChange={(e) => set('score', parseInt(e.target.value) || 0)}
                  min={0}
                  max={100}
                  className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue"
                />
              ) : (
                <span className="block text-sm font-medium text-fusion-text">{lead?.score}</span>
              )}
            </div>
            <div>
              <label className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Source</label>
              {editing ? (
                <select
                  value={form.source}
                  onChange={(e) => set('source', e.target.value)}
                  className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue"
                >
                  <option value="crm">CRM Manual</option>
                  <option value="website_form">Website Form</option>
                  <option value="referral">Referral</option>
                  <option value="social">Social Media</option>
                  <option value="direct">Direct</option>
                  <option value="other">Other</option>
                </select>
              ) : (
                <span className="block text-sm font-medium text-fusion-text">{lead?.source}</span>
              )}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider block mb-1">Assigned Distributor</label>
            {editing ? (
              <select
                value={form.distributor_id}
                onChange={(e) => set('distributor_id', e.target.value)}
                className="w-full px-3 py-2 border border-fusion-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-fusion-blue"
              >
                <option value="">Unassigned</option>
                {distributors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            ) : (
              <span className="block text-sm font-medium text-fusion-text">
                {lead?.distributor_id
                  ? distributors.find((d) => d.id === lead.distributor_id)?.name ?? lead.distributor_id
                  : 'Unassigned'}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-fusion-text-muted hover:text-fusion-text transition-colors"
          >
            {editing ? 'Cancel' : 'Close'}
          </button>
          {editing && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-fusion-blue text-white text-sm font-medium rounded-lg hover:bg-fusion-blue-light transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? 'Saving...' : isCreate ? 'Create Lead' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
