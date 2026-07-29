interface DataTableProps {
  columns: { key: string; label: string }[];
  rows: Record<string, unknown>[];
  className?: string;
  onRowClick?: (row: Record<string, unknown>, index: number) => void;
}

export default function DataTable({ columns, rows, className = '', onRowClick }: DataTableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-fusion-border-light">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-2 py-1.5 text-[10px] font-semibold text-fusion-text-muted uppercase tracking-wider whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row, i)}
              className={`border-b border-fusion-border-light last:border-0 ${onRowClick ? 'cursor-pointer' : ''} hover:bg-fusion-card-soft`}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-2 py-1.5 text-[11px] text-fusion-text whitespace-nowrap">
                  {row[col.key] as React.ReactNode}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
