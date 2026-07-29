interface DemoCardProps {
  number: number;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export default function DemoCard({ number, title, children, className = '' }: DemoCardProps) {
  return (
    <div
      className={`bg-fusion-card rounded-xl border border-fusion-border shadow-sm overflow-hidden ${className}`}
    >
      <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-fusion-border-light">
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-fusion-blue text-white text-xs font-bold shrink-0">
          {number}
        </span>
        <h3 className="text-sm font-semibold text-fusion-text">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
