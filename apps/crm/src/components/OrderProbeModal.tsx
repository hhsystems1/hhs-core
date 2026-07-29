import { useState } from 'react';
import { X, ShoppingCart } from 'lucide-react';
import { createTicket } from '../lib/queries';

interface OrderProbeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PROBE_MODELS = [
  { id: 'f44x-pro', name: 'Fusion44x Pro', desc: 'Advanced water quality probe', price: '$2,499' },
  { id: 'f44x-std', name: 'Fusion44x Standard', desc: 'Standard monitoring probe', price: '$1,299' },
  { id: 'f44x-mini', name: 'Fusion44x Mini', desc: 'Compact probe for small systems', price: '$799' },
];

export default function OrderProbeModal({ isOpen, onClose }: OrderProbeModalProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  async function handleOrder() {
    if (!selected) return;
    const model = PROBE_MODELS.find((m) => m.id === selected);
    setSaving(true);
    setError(null);
    try {
      await createTicket({
        subject: `Order Request: ${model?.name}`,
        description: `I would like to order a ${model?.name} (${model?.price}). Stripe checkout integration will be completed in Phase 2.`,
        priority: 'Low',
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit order');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-fusion-text">Order a Probe</h2>
          <button onClick={onClose} className="text-fusion-text-muted hover:text-fusion-text">
            <X size={16} />
          </button>
        </div>
        <div className="p-6">
          {success ? (
            <div className="text-center py-4">
              <ShoppingCart size={32} className="mx-auto mb-2 text-fusion-success" />
              <p className="text-sm font-semibold text-fusion-text mb-1">Order Submitted</p>
              <p className="text-[11px] text-fusion-text-muted">We'll reach out to confirm your order. Full Stripe checkout coming soon.</p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-fusion-blue text-white text-sm font-medium rounded-lg hover:bg-fusion-blue-light transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {error && (
                <div className="bg-red-50 text-red-700 text-sm rounded-lg px-3 py-2">{error}</div>
              )}
              {PROBE_MODELS.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelected(model.id)}
                  className={`w-full text-left bg-fusion-card-soft rounded-lg p-3 border transition-colors ${
                    selected === model.id
                      ? 'border-fusion-blue bg-blue-50'
                      : 'border-fusion-border-light hover:border-fusion-blue/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-fusion-text block">{model.name}</span>
                      <span className="text-[11px] text-fusion-text-muted">{model.desc}</span>
                    </div>
                    <span className="text-sm font-bold text-fusion-blue">{model.price}</span>
                  </div>
                </button>
              ))}
              <button
                onClick={handleOrder}
                disabled={!selected || saving}
                className="w-full bg-fusion-blue text-white font-semibold py-2 rounded-lg hover:bg-fusion-blue-light transition-colors disabled:opacity-50 mt-2"
              >
                {saving ? 'Processing...' : 'Request Order'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
