import { ArrowUpRight } from 'lucide-react';

interface StatusBadgeProps {
  variant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  children: React.ReactNode;
}

const variants: Record<string, string> = {
  success: 'bg-green-50 text-fusion-success border-green-200',
  warning: 'bg-amber-50 text-fusion-warning border-amber-200',
  danger: 'bg-red-50 text-fusion-danger border-red-200',
  info: 'bg-blue-50 text-fusion-blue border-blue-200',
  neutral: 'bg-gray-50 text-fusion-text-muted border-gray-200',
};

export default function StatusBadge({ variant, children }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${variants[variant]}`}
    >
      {children}
    </span>
  );
}

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
}

export function ArrowButton({ children, onClick }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-fusion-blue text-white text-xs font-medium rounded-lg hover:bg-fusion-blue-light transition-colors"
    >
      {children}
      <ArrowUpRight size={12} />
    </button>
  );
}

export function GhostButton({ children, onClick }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 text-fusion-blue text-xs font-medium rounded-lg border border-fusion-blue hover:bg-blue-50 transition-colors"
    >
      {children}
      <ArrowUpRight size={12} />
    </button>
  );
}
