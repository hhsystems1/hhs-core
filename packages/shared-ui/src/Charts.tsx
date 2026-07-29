interface ProgressBarProps {
  value: number;
  label?: string;
  color?: string;
}

export default function ProgressBar({ value, label, color = '#0057D9' }: ProgressBarProps) {
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-fusion-text-muted">{label}</span>
          <span className="text-[11px] font-medium text-fusion-text">{value}%</span>
        </div>
      )}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function MiniLineChart({ data, color = '#0057D9' }: { data: number[]; color?: string }) {
  if (data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 30;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const pathD = `M ${points.join(' L ')}`;

  return (
    <div className="mini-chart flex items-end">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path
          d={`${pathD} L ${w},${h} L 0,${h} Z`}
          fill={`${color}15`}
        />
      </svg>
    </div>
  );
}

export function MiniPieChart({
  segments,
  size = 60,
}: {
  segments: { value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const r = size / 2 - 4;
  const cx = size / 2;
  const cy = size / 2;
  const arcs = segments.map((seg, index) => {
    const p = seg.value / total;
    const angle = p * 360;
    const cumulative = segments.slice(0, index).reduce((sum, item) => sum + item.value, 0);
    const startAngle = (cumulative / total) * 360;

    const startRad = ((startAngle - 90) * Math.PI) / 180;
    const endRad = ((startAngle + angle - 90) * Math.PI) / 180;

    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);

    const largeArc = angle > 180 ? 1 : 0;

    const pathD =
      seg.value === total
        ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return <path key={seg.color} d={pathD} fill={seg.color} />;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {arcs}
    </svg>
  );
}


