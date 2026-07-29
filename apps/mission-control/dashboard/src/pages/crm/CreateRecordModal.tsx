import { useEffect, useState } from 'react';
import { fetchJson } from '../../lib/api';

type EntityType = 'contact' | 'account' | 'opportunity' | 'task';

type FormState = Record<string, string>;

const FIELDS: Record<EntityType, Array<{ key: string; label: string; type: string; required?: boolean }>> = {
  contact: [
    { key: 'full_name', label: 'Full Name', type: 'text', required: true },
    { key: 'primary_email', label: 'Email', type: 'email' },
    { key: 'primary_phone', label: 'Phone', type: 'text' },
    { key: 'lifecycle_stage', label: 'Lifecycle Stage', type: 'select' },
    { key: 'status', label: 'Status', type: 'select' },
    { key: 'role_title', label: 'Role / Title', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  account: [
    { key: 'name', label: 'Account Name', type: 'text', required: true },
    { key: 'account_type', label: 'Type', type: 'select' },
    { key: 'lifecycle_stage', label: 'Lifecycle Stage', type: 'select' },
    { key: 'status', label: 'Status', type: 'select' },
    { key: 'website_url', label: 'Website URL', type: 'text' },
    { key: 'primary_email', label: 'Email', type: 'email' },
    { key: 'primary_phone', label: 'Phone', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  opportunity: [
    { key: 'name', label: 'Deal Name', type: 'text', required: true },
    { key: 'pipeline', label: 'Pipeline', type: 'text' },
    { key: 'stage', label: 'Stage', type: 'text' },
    { key: 'status', label: 'Status', type: 'select' },
    { key: 'estimated_value_cents', label: 'Value (cents)', type: 'number' },
    { key: 'expected_close_date', label: 'Expected Close', type: 'date' },
  ],
  task: [
    { key: 'title', label: 'Title', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'priority', label: 'Priority', type: 'select' },
    { key: 'status', label: 'Status', type: 'select' },
    { key: 'due_at', label: 'Due Date', type: 'datetime-local' },
  ],
};

const SELECT_OPTIONS: Record<string, string[]> = {
  lifecycle_stage: ['unknown', 'lead', 'subscriber', 'opportunity', 'customer', 'evangelist'],
  status_contact: ['active', 'inactive', 'archived', 'do_not_contact'],
  status_account: ['active', 'inactive', 'archived'],
  status_opportunity: ['open', 'won', 'lost', 'paused', 'archived'],
  status_task: ['open', 'in_progress', 'completed', 'cancelled'],
  priority: ['low', 'normal', 'high', 'urgent'],
  account_type: ['organization', 'customer', 'partner', 'vendor', 'referral_source', 'software_customer', 'internal'],
};

function getSelectOptions(key: string, entityType?: EntityType): string[] {
  if (key === 'status') {
    if (entityType === 'contact') return SELECT_OPTIONS.status_contact;
    if (entityType === 'account') return SELECT_OPTIONS.status_account;
    if (entityType === 'opportunity') return SELECT_OPTIONS.status_opportunity;
    if (entityType === 'task') return SELECT_OPTIONS.status_task;
  }
  return SELECT_OPTIONS[key] || [];
}

type Props = {
  entityType: EntityType;
  onClose: () => void;
  onCreated: (record: Record<string, unknown>) => void;
  prefill?: Record<string, string>;
};

export default function CreateRecordModal({ entityType, onClose, onCreated, prefill }: Props) {
  const [form, setForm] = useState<FormState>(() => {
    const initial: FormState = {};
    for (const field of FIELDS[entityType]) {
      initial[field.key] = prefill?.[field.key] || '';
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const endpointMap: Record<EntityType, string> = {
    contact: '/api/v1/crm/contacts',
    account: '/api/v1/crm/accounts',
    opportunity: '/api/v1/crm/opportunities',
    task: '/api/v1/crm/tasks',
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {};
      for (const field of FIELDS[entityType]) {
        const val = form[field.key]?.trim();
        if (val || field.required) {
          body[field.key] = val || null;
        }
      }
      // Convert numeric fields
      if (body.estimated_value_cents) {
        body.estimated_value_cents = parseInt(body.estimated_value_cents as string, 10) || null;
      }

      const res = await fetchJson(endpointMap[entityType], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      onCreated(res as Record<string, unknown>);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const setVal = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const title = `New ${entityType}`;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900 shadow-2xl">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-lg font-bold">{title}</h2>
            <button onClick={onClose} className="rounded-full p-1.5 hover:bg-white/10 text-white/60">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
            {FIELDS[entityType].map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-white/50 mb-1">
                  {field.label}
                  {field.required && <span className="text-red-300 ml-0.5">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea value={form[field.key]} onChange={(e) => setVal(field.key, e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-300/50"
                  />
                ) : field.type === 'select' ? (
                  <select value={form[field.key]} onChange={(e) => setVal(field.key, e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-300/50"
                  >
                    <option value="">—</option>
                    {getSelectOptions(field.key, entityType).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input value={form[field.key]} onChange={(e) => setVal(field.key, e.target.value)}
                    type={field.type}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-300/50"
                  />
                )}
              </div>
            ))}

            {error && <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">{error}</div>}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/5"
              >Cancel</button>
              <button type="submit" disabled={saving}
                className="flex-1 rounded-full border border-sky-400/25 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-400/20 disabled:opacity-50"
              >{saving ? 'Creating...' : `Create ${entityType}`}</button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
