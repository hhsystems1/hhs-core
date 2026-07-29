import { useEffect, useState } from 'react';
import { ArrowButton } from '@hhs/shared-ui'StatusBadge';
import DemoCard from '@hhs/shared-ui'DemoCard';
import ServiceModal from '../ServiceModal';
import OrderProbeModal from '../OrderProbeModal';
import { fetchMyOrders } from '../../lib/queries';
import type { Order } from '../../types';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatAmount(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

export default function CustomerPortal() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [orderProbeOpen, setOrderProbeOpen] = useState(false);

  useEffect(() => {
    fetchMyOrders()
      .then(setOrders)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DemoCard number={3} title="Customer Portal">
      <div className="space-y-3">
        <div className="flex gap-2">
          <ArrowButton onClick={() => setServiceOpen(true)}>
            Schedule Service
          </ArrowButton>
          <ArrowButton onClick={() => setOrderProbeOpen(true)}>
            Order Probe
          </ArrowButton>
        </div>
        <div className="bg-fusion-card-soft rounded-lg p-3 border border-fusion-border-light">
          <span className="text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider mb-1 block">Recent Orders</span>
          {loading ? (
            <div className="text-[11px] text-fusion-text-muted">Loading...</div>
          ) : error ? (
            <div className="text-[11px] text-red-400">{error}</div>
          ) : orders.length === 0 ? (
            <div className="text-[11px] text-fusion-text-muted">No orders yet</div>
          ) : (
            <div className="space-y-1.5 text-[11px]">
              {orders.map((o) => (
                <div key={o.id} className="flex justify-between">
                  <span className="text-fusion-text">
                    {o.customer_name ?? 'Order'} — {formatAmount(o.amount_total, o.currency)}
                  </span>
                  <span className="text-fusion-text-muted">{formatDate(o.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <ServiceModal isOpen={serviceOpen} onClose={() => setServiceOpen(false)} />
      <OrderProbeModal isOpen={orderProbeOpen} onClose={() => setOrderProbeOpen(false)} />
    </DemoCard>
  );
}
