import { useEffect, useMemo, useState } from 'react';
import { CircleDollarSign, Package, ShoppingCart, TrendingUp } from 'lucide-react';
import DemoCard from '@hhs/shared-ui'DemoCard';
import DataTable from '@hhs/shared-ui'DataTable';
import KpiCard from '@hhs/shared-ui'KpiCard';
import { MiniLineChart, MiniPieChart } from '@hhs/shared-ui'Charts';
import { fetchOrderItems, fetchOrders } from '../../lib/queries';
import type { Order, OrderItem } from '../../types';

const PROBE_RE = /(probe|fusion44x|f44x)/i;

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
  }).format(amount / 100);
}

function isProbeLineItem(item: OrderItem): boolean {
  return PROBE_RE.test(item.product_name);
}

export default function ProbeSalesDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchOrders(), fetchOrderItems()])
      .then(([orderRows, itemRows]) => {
        setOrders(orderRows);
        setItems(itemRows);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const probeOrderMap = useMemo(() => {
    const byOrderId = new Map<string, OrderItem[]>();
    for (const item of items) {
      if (!isProbeLineItem(item)) continue;
      const next = byOrderId.get(item.order_id) ?? [];
      next.push(item);
      byOrderId.set(item.order_id, next);
    }
    return byOrderId;
  }, [items]);

  const probeOrders = useMemo(
    () =>
      orders
        .filter((order) => probeOrderMap.has(order.id))
        .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
    [orders, probeOrderMap]
  );

  const probeItems = useMemo(
    () => items.filter((item) => isProbeLineItem(item)),
    [items]
  );

  const totalRevenue = probeOrders.reduce((sum, order) => sum + order.amount_total, 0);
  const totalUnits = probeItems.reduce((sum, item) => sum + item.quantity, 0);
  const averageOrderValue = probeOrders.length > 0 ? totalRevenue / probeOrders.length : 0;

  const recentTrend = probeOrders
    .slice(0, 6)
    .map((order) => order.amount_total / 100)
    .reverse();

  const statusTotals = probeOrders.reduce<Record<string, number>>((acc, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1;
    return acc;
  }, {});

  const statusSegments = Object.entries(statusTotals).map(([status, count]) => ({
    value: count,
    color:
      status === 'paid' || status === 'complete'
        ? '#16A34A'
        : status === 'pending'
          ? '#F59E0B'
          : status === 'failed'
            ? '#DC2626'
            : '#0057D9',
  }));

  const modelTotals = probeItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.product_name] = (acc[item.product_name] ?? 0) + item.quantity;
    return acc;
  }, {});

  const modelRows = Object.entries(modelTotals)
    .map(([product, quantity]) => ({ product, quantity }))
    .sort((a, b) => b.quantity - a.quantity);

  const tableColumns = [
    { key: 'customer', label: 'Customer' },
    { key: 'model', label: 'Model' },
    { key: 'items', label: 'Items' },
    { key: 'status', label: 'Status' },
    { key: 'date', label: 'Date' },
    { key: 'total', label: 'Total' },
  ];

  const tableRows = probeOrders.map((order) => {
    const orderProbeItems = probeOrderMap.get(order.id) ?? [];
    const modelLabel = orderProbeItems.length > 0 ? orderProbeItems[0].product_name : 'Probe order';

    return {
      customer: order.customer_name ?? order.customer_email ?? 'Unknown',
      model: modelLabel,
      items: orderProbeItems.reduce((sum, item) => sum + item.quantity, 0),
      status: order.status,
      date: formatDate(order.created_at),
      total: formatCurrency(order.amount_total, order.currency),
    };
  });

  return (
    <DemoCard number={11} title="Probe Sales" className="xl:col-span-2">
      {loading ? (
        <div className="py-4 text-center text-[11px] text-fusion-text-muted">Loading...</div>
      ) : error ? (
        <div className="py-4 text-center text-[11px] text-red-400">{error}</div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            <KpiCard label="Orders" value={String(probeOrders.length)} icon={<ShoppingCart size={12} />} />
            <KpiCard label="Units" value={String(totalUnits)} icon={<Package size={12} />} />
            <KpiCard label="Revenue" value={formatCurrency(totalRevenue, probeOrders[0]?.currency ?? 'usd')} icon={<CircleDollarSign size={12} />} />
            <KpiCard label="Avg Order" value={formatCurrency(averageOrderValue, probeOrders[0]?.currency ?? 'usd')} icon={<TrendingUp size={12} />} />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-fusion-border-light bg-fusion-card-soft p-3">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-fusion-text-muted">
                Revenue trend
              </span>
              {recentTrend.length > 0 ? (
                <MiniLineChart data={recentTrend} color="#0057D9" />
              ) : (
                <div className="rounded-lg border border-dashed border-fusion-border-light px-3 py-4 text-center text-[11px] text-fusion-text-muted">
                  No probe sales yet. When checkout lands, this line wakes up.
                </div>
              )}
            </div>

            <div className="rounded-lg border border-fusion-border-light bg-fusion-card-soft p-3">
              <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-fusion-text-muted">
                Order status
              </span>
              {statusSegments.length > 0 ? (
                <div className="flex items-center gap-3">
                  <MiniPieChart segments={statusSegments} size={60} />
                  <div className="space-y-1">
                    {Object.entries(statusTotals).map(([status, count]) => (
                      <div key={status} className="flex items-center gap-1.5">
                        <span className="text-[10px] text-fusion-text-muted capitalize">{status}</span>
                        <span className="text-[10px] font-semibold text-fusion-text">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-fusion-border-light px-3 py-4 text-center text-[11px] text-fusion-text-muted">
                  No order status data yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-fusion-border-light bg-fusion-card-soft p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-fusion-text-muted">
                Probe models
              </span>
              <span className="text-[10px] text-fusion-text-muted">{probeItems.length} line items</span>
            </div>
            {modelRows.length > 0 ? (
              <div className="space-y-2">
                {modelRows.map((row) => (
                  <div key={row.product} className="flex items-center justify-between rounded-lg border border-fusion-border-light bg-white px-3 py-2">
                    <span className="text-xs font-medium text-fusion-text">{row.product}</span>
                    <span className="text-[10px] font-semibold text-fusion-blue">{row.quantity}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-fusion-border-light px-3 py-4 text-center text-[11px] text-fusion-text-muted">
                No probe line items yet.
              </div>
            )}
          </div>

          <div>
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-fusion-text-muted">
              Recent probe orders
            </span>
            {tableRows.length > 0 ? (
              <DataTable columns={tableColumns} rows={tableRows} />
            ) : (
              <div className="rounded-lg border border-dashed border-fusion-border-light px-3 py-4 text-center text-[11px] text-fusion-text-muted">
                No probe sales are recorded yet.
              </div>
            )}
          </div>

          <div className="rounded-lg border border-fusion-border-light bg-white px-3 py-2 text-[11px] text-fusion-text-muted">
            This card reads the real `orders` and `order_items` tables, so once checkout starts writing sales, the dashboard updates itself.
          </div>
        </div>
      )}
    </DemoCard>
  );
}
