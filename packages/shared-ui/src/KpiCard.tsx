import { TrendingUp, TrendingDown } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: 'up' | 'down';
  icon?: React.ReactNode;
}

export default function KpiCard({ label, value, change, changeType = 'up', icon }: KpiCardProps) {
  return (
    <div className="bg-fusion-card-soft rounded-lg p-3 border border-fusion-border-light">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-fusion-text-muted uppercase tracking-wider">
          {label}
        </span>
        {icon && <span className="text-fusion-text-muted">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-xl font-bold text-fusion-text">{value}</span>
        {change && (
          <span
            className={`flex items-center gap-0.5 text-[11px] font-medium ${
              changeType === 'up' ? 'text-fusion-success' : 'text-fusion-danger'
            }`}
          >
            {changeType === 'up' ? (
              <TrendingUp size={12} />
            ) : (
              <TrendingDown size={12} />
            )}
            {change}
          </span>
        )}
      </div>
    </div>
  );
}
