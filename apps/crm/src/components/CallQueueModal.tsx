import { X, Phone, User } from 'lucide-react';
import type { Lead } from '../types';

interface CallQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  leads: Lead[];
}

export default function CallQueueModal({ isOpen, onClose, leads }: CallQueueModalProps) {
  if (!isOpen) return null;

  const callable = leads.filter((l) => l.phone && (l.status === 'Hot' || l.status === 'Warm' || l.status === 'New'));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-fusion-text">Call Queue</h2>
          <button onClick={onClose} className="text-fusion-text-muted hover:text-fusion-text">
            <X size={16} />
          </button>
        </div>
        <div className="p-6">
          {callable.length === 0 ? (
            <div className="text-[13px] text-fusion-text-muted text-center py-8">
              <Phone size={24} className="mx-auto mb-2 text-fusion-text-muted/50" />
              No leads ready to call
            </div>
          ) : (
            <div className="space-y-3">
              {callable.map((lead) => (
                <div key={lead.id} className="flex items-center justify-between bg-fusion-card-soft rounded-lg p-3 border border-fusion-border-light">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-fusion-blue/10 flex items-center justify-center">
                      <User size={14} className="text-fusion-blue" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-fusion-text block">{lead.name}</span>
                      <span className="text-[11px] text-fusion-text-muted">{lead.company}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      lead.status === 'Hot' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {lead.status}
                    </span>
                    <a
                      href={`tel:${lead.phone}`}
                      className="flex items-center gap-1 px-3 py-1.5 bg-fusion-blue text-white text-xs font-medium rounded-lg hover:bg-fusion-blue-light transition-colors"
                    >
                      <Phone size={12} /> Call
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
